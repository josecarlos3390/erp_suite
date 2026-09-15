# BACKEND_GUIDE.md — backend-erp

> Guía única y canónica para el desarrollo backend del ERP. Cualquier nuevo módulo, servicio, o endpoint debe seguir estos patrones.
> **Última actualización:** 2026-07-26 (estado de testing y consolidación de documentación).  
> **Scope:** NestJS 11.0.1, TypeScript 5.7.3, Prisma 6.19.2, PostgreSQL.

---

## Índice

1. [Arquitectura del backend](#1-arquitectura-del-backend)
2. [Seguridad de tipos](#2-seguridad-de-tipos)
3. [Deuda técnica — Fases completadas](#3-deuda-técnica--fases-completadas)
4. [Patrones de código](#4-patrones-de-código)
5. [Checklist de seguridad de tipos](#5-checklist-de-seguridad-de-tipos)
6. [Infraestructura y operaciones](#6-infraestructura-y-operaciones)
7. [Sistema de moneda en contabilidad](#7-sistema-de-moneda-en-contabilidad-multi-divisa)
8. [Integración bancaria — Bank Statement Posting](#8-integración-bancaria--bank-statement-posting)
9. [Testing](#9-testing)
10. [Documentación adicional del backend](#10-documentación-adicional-del-backend)

---

## 1. Arquitectura del backend

### Estructura de un módulo típico

```
src/<modulo>/
  <modulo>.module.ts
  <modulo>.controller.ts
  <modulo>.service.ts
  <modulo>.controller.spec.ts
  <modulo>.service.spec.ts
  dto/
    create-<modulo>.dto.ts
    update-<modulo>.dto.ts
```

### Motor contable (`src/common/accounting/`) — refactor por familia (2026-08-08)

El motor contable se dividió por dominio (antes monolito de 6,436 líneas en
`accounting-engine.service.ts`). La fachada `AccountingEngineService` mantiene la
**superficie pública estable** (los 15 `create*JournalEntry` + `previewJournalEntry` +
`previewJournalEntryFromDraft` + `persistManualJournalEntry` + `reverseJournalEntry`),
así que los 22 servicios que lo consumen y los 19 specs que lo mockean **no cambian**.

```
src/common/accounting/
  journal-entry-builder.ts      # JournalEntryBuilder + interfaces (lineas, preview)
  journal-entry-core.ts         # clase base: det/settingsService + helpers compartidos
  sales.journal-builder.ts      # 5 builders de ventas (invoice, delivery, NC, ND, return)
  purchases.journal-builder.ts  # 5 builders de compras (invoice, receipt, NC, ND, return)
  inventory.journal-builder.ts  # 4 builders de inventario (entry, exit, adjustment, transfer)
  payments.journal-builder.ts   # 2 builders de pagos (incoming, outgoing)
  accounting-engine.service.ts  # fachada: persiste y delega en los builders
```

**Reglas al añadir un nuevo tipo de asiento (ej. cierre de período, activos fijos):**
1. Añadir el builder `_buildXxx` (o `buildXxx`) al archivo de la familia correspondiente
   (`src/common/accounting/<familia>.journal-builder.ts`).
2. Añadir el `createXxxJournalEntry` a la fachada (`accounting-engine.service.ts`),
   que llama al builder y persiste vía `_persist` (heredado de `JournalEntryCore`).
3. Registrar el `case` en `previewJournalEntry` y `previewJournalEntryFromDraft` si
   el documento tiene preview.
4. Verificar con `npm test` (el spec del engine cubre los 15 builders existentes).

### Capas y patrones clave

- **`AppModule`** (`src/app.module.ts`) importa todos los módulos y registra guards/interceptores globales.
- **DTOs base:**
  - `BaseDocumentDto` — campos universales de cabecera (fecha, notas, referencia, almacén, sucursal, proyecto, moneda, UDFs, etc.).
  - `CommercialDocumentHeaderDto` — extiende la base con descuentos de cabecera, dimensiones y aliases SAP B1 (`cardCode`, `docDate`, `comments`, `discPrcnt`, etc.).
  - `CommercialLineItemDto` — líneas de documento comercial.
- **Servicios:** lógica de negocio pesada, transacciones Prisma (`this.prisma.$transaction`) y llamadas a utilidades compartidas.
- **Controladores:** decoradores Swagger, `@RequirePermission(...)`, `@CurrentUser()`, normalización de aliases SAP en entrada/salida.
- **Multitenancy:**
  - `TenantContext` + `TenantContextInterceptor` establecen el tenant desde el JWT.
  - `tenant-isolation.extension.ts` inyecta `tenantId` automáticamente en `findMany`, `count`, `updateMany`, `create`, `createMany`, etc., incluyendo escrituras anidadas (`create`/`createMany`/`connectOrCreate`) dentro de `create` y `update`.
  - `TenantGuard` protege endpoints por tenant.
- **PrismaService** (`src/prisma/prisma.service.ts`): extiende `PrismaClient`, aplica la extensión de aislamiento y logging condicional.
- **Autenticación:** JWT extraído de cookie `access_token`, header Bearer o query param `token`. El payload incluye `sub`, `username`, `tenantId`, `tenantSlug`, `tenantPlan`, `role`, `permissions` y flags de visibilidad (`canViewCosts`, etc.).

### Utilidades compartidas importantes

- `src/common/price-resolver.util.ts` — resolución de precios con jerarquía SAP-style.
- `src/common/stock.util.ts` / `document-stock.helper.ts` — movimientos de stock.
- `src/common/tax-indicator.util.ts` — impuestos bolivianos.
- `src/common/traceability.util.ts` — enlaces entre documentos.
- `src/common/document-totals.util.ts` — totales de documentos.
- `src/common/timezone.util.ts` — manejo de zonas horarias.

### Modelos de Prisma

El schema (`prisma/schema.prisma`) tiene ~106 modelos. Los más relevantes:

`Tenant`, `User`, `Employee`, `Partner`, `PartnerGroup`, `Item`, `ItemGroup`, `ItemBom`, `Warehouse`, `Branch`, `TaxIndicator`, `WithholdingTaxType`, `Account`, `JournalEntry`, `SalesQuotation`, `SalesOrder`, `DeliveryOrder`, `SaleInvoice`, `SaleReserveInvoice`, `SalesReturn`, `SalesCreditNote`, `SalesDebitNote`, `PurchaseRequest`, `PurchaseQuotation`, `PurchaseOrder`, `PurchaseReceipt`, `PurchaseInvoice`, `PurchaseReserveInvoice`, `PurchaseReturn`, `PurchaseCreditNote`, `PurchaseDebitNote`, `Stock`, `StockMovement`, `Batch`, `SerialNumber`, `StockEntry`, `StockExit`, `StockTransfer`, `StockAdjustment`, `StockCount`, `IncomingPayment`, `OutgoingPayment`, `DocumentLink`, `DocumentLineTracking`, `DocumentDraft`, `PosTerminal`, `PosSession`, `AuditLog`, `Alert`, `UserDefinedField`, `CustomFieldValue`, `TenantMetrics`, `SapSyncLog`.

---

## 2. Seguridad de tipos

### Política base

- **Objetivo: cero `as any` en producción** (`src/**/*.ts` sin `.spec`).
- **Cero anotaciones `: any`** en parámetros, variables y propiedades de producción.
- **Cero tipos anónimos inline** en firmas de servicios que reciban datos de controllers o de otros servicios.
- En archivos `.spec.ts` se permite `as unknown as T` para mocks parciales, pero nunca `as any`. Desde 2026-09-09 (AUDIT T47) la regla ESLint `@typescript-eslint/no-explicit-any: 'error'` está activa para `src/**/*.spec.ts` en `eslint.config.mjs` — el gate es automático (0 `any` en specs), no solo criterio de PR.

> **Estado real (2026-09-09):** **0 `as any` / `: any` en producción**
> (verificado con grep sobre `src/**/*.ts` sin `.spec`, AUDIT T40). Las
> excepciones históricas de la tabla de abajo quedaron eliminadas.

### Patrones seguros con `strictNullChecks: true`

| Situación | Patrón | Ejemplo |
|-----------|--------|---------|
| `tenantId?: number` usado en datos de Prisma | `tenantId: tenantId!` dentro del objeto de datos | `data: { tenantId: tenantId!, ... }` |
| `.find()` después de verificar existencia | `const x = arr.find(...)!;` | `const parent = parents.find(p => p.id === id)!;` |
| `Map.get()` en aritmética | `(map.get(key!) ?? 0)` | `const qty = (whItemMap.get(orderItemId!) ?? 0) + line.quantity;` |
| Campos JSON dinámicos (`customFields`) | `Record<string, unknown>` | `customFields: Record<string, unknown>` |
| `let x = null` luego usado como objeto | `let x: any = null` | `let siTaxInd: any = null;` |
| Optional relation (`di.order?.items`) | `di.order!.items` después de null-check | `for (const oi of di.order!.items) { ... }` |

### Lecciones aprendidas (deuda técnica)

1. **Un tipo inline anónimo es deuda técnica aunque no diga `any`.**
   Si una función de servicio recibe un objeto complejo, debe existir un DTO/interface con nombre. Si no hay nombre, no hay reutilización ni validación.

2. **`Record<string, any>` solo está permitido para `customFields`.**
   Es la única excepción aceptada porque el contenido es JSON arbitrario definido por el usuario. Cualquier otro uso de `any` (explícito o implícito) debe justificarse y documentarse.

3. **Crear un nuevo endpoint `createFrom*` implica crear su DTO **antes** de escribir el servicio.**
   El orden correcto es: DTO → controller → service. Si el servicio se escribe primero, el payload suele quedar inline.

4. **El linter no detecta tipos inline.**
   ESLint detecta `as any` y `: any`, pero no un objeto anónimo en una firma. Por eso se requiere revisión manual/arquitectónica en PRs de nuevos flujos `createFrom*`.

5. **Los DTOs formales descubren errores de diseño.**
   Al tipar con DTOs se detectaron:
   - `tenantId` empaquetado dentro del body en flujos `createFromMulti*`.
   - Campos con nombres distintos en fuente única vs multi.
   - DTOs existentes que faltaban campos usados en la práctica (`uomId`, `trackingAssignments`, etc.).

6. **Si un campo es opcional en el body, puede ser requerido en el servicio gracias a la transformación del controller.**
   El controller puede inyectar `tenantId` o `branchId` después de la validación del DTO, permitiendo que el servicio consuma un tipo interno más estricto sin exponerlo en la API.

7. **Usa Input-DTOs internos para campos inyectados por el controller.**
   Cuando el controller agrega `tenantId`, `createdById` o `branchId` al objeto que le pasa al servicio, el servicio debe declarar un DTO específico (`XxxInputDto`) que extienda el DTO público.

8. **Un helper / "draft getter" sin endpoint propio también merece tipo de retorno.**
   Si un método privado o helper devuelve un objeto complejo, declarar una interfaz local documenta el contrato y evita dependencias del tipo inferido.

9. **Discriminated unions > casts para mezclar fuentes de líneas.**
   Cuando un loop itera sobre líneas que pueden venir de un DTO o de una línea de Prisma, envolverlas en `{ kind: 'custom' | 'invoice', data: ... }` permite acceder a cada variante con narrowing de TypeScript y sin `as T`.

10. **Mantén los DTOs en `dto/` del módulo y extiende `CommercialLineItemDto`.**
    Extender el DTO base de líneas evita repetir campos transversales (`projectCode`, `dimension1-5`, `uomId`, `trackingAssignments`, `baseDocType`, etc.) y reduce la divergencia entre flujos.

### Excepciones actuales en producción (deuda técnica)

**Ninguna (2026-09-09, AUDIT T40).** Se eliminaron los últimos `as any` de
producción:

- `src/fiscal-years/fiscal-years.controller.ts` — la tabla histórica señalaba
  7 casts `undefined as any` para `tenantId`; el controller YA inyecta
  `@CurrentUser()` y pasa `user.tenantId` en todos los endpoints (tabla
  obsoleta, sin cambios requeridos).
- `src/payment-terms/payment-term-movement-checker.ts`,
  `src/tax-indicators/tax-indicator-movement-checker.ts` y
  `src/warehouses/warehouse-movement-checker.ts` — ya tipan el parámetro
  `prisma: PrismaService | Prisma.TransactionClient` (tabla obsoleta).
- Residuales reales detectados por grep y tipados (2026-09-09):
  `src/common/accounting-engine.service.ts` (`let origInvoice` → payload
  Prisma `PurchaseInvoiceGetPayload<{ include: { items: true } }>`) y
  `src/items/items.service.ts` (`findAllForSelector` → `select` extraído a
  `itemSelectorFields` con `satisfies Prisma.ItemSelect` y resultado tipado
  con `Prisma.ItemGetPayload`).

> **Specs en 0 `any` (2026-09-09, AUDIT T47):** barrido completo de los 50
> `.spec.ts` que aún tenían `any` (234 tokens entre anotaciones `: any`,
> casts `as any`, `(args: any)`, `let mockPrisma: any`) → migrados a mocks
> tipados: tipos estructurales locales de solo `jest.Mock` (delegados Prisma
> como `Record<string, jest.Mock>`), `jest.Mocked<PrismaService>` +
> `(delegate.method as jest.Mock)` por sitio, `as unknown as PrismaService` /
> `Prisma.TransactionClient` en providers, eliminación de `as any` donde el
> literal ya satisfacía el DTO real, y parámetros de callbacks sin anotación
> (`noImplicitAny: false`). Regla `no-explicit-any` activada como `error`
> para `src/**/*.spec.ts` (gate eslint 0/0 en specs; quedan 2 warnings
> informativos no-`any` preexistentes). Suite backend 161 suites / 1719
> tests en verde; typechecks `tsconfig.json` y `tsconfig.spec.json` en 0.
> `expect.any(...)` (matchers Jasmine) NO es `any` de tipo y quedó intacto.

### Checklist para nuevos flujos `createFrom*`

Antes de mergear un PR que agregue un flujo `createFrom*`, verificar:

- [ ] Existe un DTO formal (`CreateXxxFromYyyDto`) en el módulo `dto/`.
- [ ] El controller usa ese DTO en `@Body()`.
- [ ] El service recibe el DTO, no un objeto anónimo.
- [ ] Las líneas usan un item-DTO que extienda `CommercialLineItemDto` (o `BaseLineItemDto`) si corresponde.
- [ ] No hay `tenantId` en el DTO del body; se pasa como parámetro al servicio.
- [ ] `customFields` es el único campo que usa `Record<string, any>`.
- [ ] Si el controller inyecta `tenantId` / `createdById` / `branchId`, existe un Input-DTO interno para el servicio.
- [ ] Si el servicio itera sobre líneas de fuentes distintas (DTO vs modelo Prisma), usa una discriminated union en lugar de casts.
- [ ] La transacción `$transaction` retorna el documento creado: `return this.prisma.$transaction(...)` o `const x = await ...; return x` — **nunca** `await` a secas que descarte el resultado (ver §4 "Transacciones Prisma"). El endpoint debe responder con el documento, no `{}` con 201/200.
- [ ] **El vínculo con el documento origen se escribe en AMBOS sentidos** (T96): además del vínculo genérico de `setTargetOnSourceLine` (`targetDocType`/`targetDocId`/`targetLineId`) y de las cantidades denormalizadas, se rellena **la columna de relación que lee la API del documento destino** (`SaleInvoiceItem.deliveryOrderItemId`, `PurchaseInvoiceItem.purchaseReceiptItemId`, …) y, cuando aplique, la del origen (`SaleInvoice.deliveryOrderId`). Escribir solo el vínculo genérico deja al documento **contando mal su pendiente**: la lectura enriquece `invoicedQty`/`pendingInvoiceQty`/`hasPendingToInvoice` desde las relaciones, no desde `target*`. Ver AUDIT T96.
- [ ] **Los indicadores derivados se calculan por línea, no sumando campos que representan el mismo hecho**: `hasPendingToInvoice` se decide con `items.some(pendingInvoiceQty > 0)`; **nunca** `Σ(invoicedQty + reservedQty) < entregado`, que cuenta el doble cuando las dos columnas derivan de la misma fuente (T96) y oculta facturación legítima en entregas parciales.
- [ ] **Al derivar cantidades de los documentos, las DEVOLUCIONES se descuentan** (T100): una devolución de venta/compra revierte la entrega/recepción —`deliveredQty`/`receivedQty` ↓, `openQty` ↑ y el pedido se **reabre** para poder volver a entregar/recibir—, así que cualquier pendiente derivado (`Σ entregas/recepciones CLOSED − devoluciones`) que no las reste bloquea con «Pendiente: 0» un flujo legítimo; lo cazaron `purchase-flow.e2e-spec.ts` y `sales-flow.e2e-spec.ts` tras T97/T98. Se usa `sumPurchaseReturnsForOrders` / `sumSalesReturnsForOrders` (`common/return-quantity.util.ts`), que cubren **las dos formas de vínculo**: `baseLineId` cuando la devolución apunta a la línea del documento y, si el formulario la creó solo con el artículo (`baseLineId = null`), el reparto por `itemId` (los conjuntos son disjuntos: nunca se descuenta dos veces).
- [ ] **Un `cancel` revierte EXACTAMENTE lo que aplicó su `confirm`, y una sola vez** (T100): el mismo documento puede llegar por dos caminos (`orderItemId` y `purchaseReceiptItemId`/`deliveryOrderItemId`), así que revertir en los dos bloques descuenta dos veces la misma factura y deja columnas imposibles (`invoicedQty = −2`, `openQty = 4` sobre `quantity = 2`); cuando un `confirm` incrementa una columna, el `cancel` la decrementa **con la misma condición** y, si hay una invariante disponible (`openQty = quantity − receivedQty`), se **recalcula** en vez de incrementar a mano. Si además el `confirm` mueve la columna con la que se calcula el progreso del pedido, hay que llamar a `recalcPurchaseOrderProgress`/`recalcSalesOrderProgress` en **los dos** (T100: `PurchaseOrder.invoiceStatus` se quedaba en PENDING para siempre por la vía normal, recepción → factura).
- [ ] `npm run build`, `npm test` y `npm run lint` están verdes.

---

## 3. Deuda técnica — Fases completadas

### Fase 1: `(this.prisma as any)` — ✅ COMPLETADA

**Meta:** Eliminar los 58 casts restantes en 13 servicios.  
**Estrategia:** Reemplazo mecánico `this.prisma.model.*` (mismo patrón que `(tx as any)` ya resuelto).  
**Resultado:** 12 archivos, 109 insertions(+), 87 deletions(-). Build 0 errores, 178 tests passed.

### Fase 2: Acumuladores `any[]` — ✅ COMPLETADA

**Meta:** Tipar los acumuladores `any[]` en servicios.  
**Estrategia:** Usar tipos Prisma (`Omit<Prisma.XUncheckedCreateInput, ...>`) para acumuladores de creación; tipos locales (`DeliveryStockLine`, `BulkImportItemRow`) para acumuladores enriquecidos; interfaces específicas para utilidades (`PersistedLine`).  
**Resultado:** 0 acumuladores `: any[]` / `Array<any>` en producción. Build 0 errores, 953 tests passed.

### Fase 3: Parámetros/variables `: any` — ✅ COMPLETADA

**Meta:** Eliminar `any` en firmas de funciones y variables que propagan la deuda.  
**Estrategia:** Tipar con `Prisma.<Model>WhereInput`, interfaces Prisma (`XGetPayload`), DTOs y tipos locales.  
**Resultado:** 0 anotaciones `: any` en producción. Build 0 errores, 953 tests passed.

### Fase 4: Casts `(obj as any).campo` masivos — ✅ COMPLETADA

**Meta:** Reducir los ~1,241 casts de acceso a campos en los servicios más grandes.  
**Estrategia:** Tipar resultados de `findUnique`/`findMany` con `include` (Prisma infiere el payload); para objetos construidos manualmente usar `as const` o interfaces locales.  
**Resultado:** 0 `as any` en producción. Build 0 errores, 953 tests passed.

### Fase 5: Payloads `createFrom*` inline → DTOs formales — ✅ COMPLETADA

**Meta:** Extraer payloads anónimos de funciones `createFromQuotation`, `createFromOrder`, etc. a DTOs reutilizables.  
**Resultado:** 39 funciones `createFrom*` en 12 servicios ahora usan DTOs formales; controllers de endpoints `multi` también fueron migrados. Build 0 errores, 953 tests passed.

### Fase 6: Controllers — ✅ COMPLETADA

**Meta:** 9 `as any` en 4 controllers.  
**Resultado:** 0 `as any` en controllers de producción. Solo quedan en `.spec.ts`.

### Fase 7: Tests — ✅ COMPLETADA (cierre real 2026-09-09, AUDIT T47)

**Meta:** ~128 `as any` en 20 specs (mocks).  
**Resultado histórico:** migración a tipos seguros (`as unknown as T`, `Parameters<…>[0]`, tipos locales, `satisfies Partial<T>`); build 0 errores, 958 tests passed.  
**Cierre real (T47, 2026-09-09):** un barrido posterior (grep + eslint) reveló que quedaban `any` en 50 `.spec.ts` (234 tokens) pese a la Fase 7 histórica — migrados a 0 con mocks tipados estructurales de solo `jest.Mock` y casts `as unknown as T`; regla `@typescript-eslint/no-explicit-any: 'error'` activada para `src/**/*.spec.ts` (gate automático). Suite 161/1719 en verde. Ver AUDIT T47.

### Fase 8: Extensión Prisma de aislamiento de tenant — ✅ COMPLETADA

**Meta:** Cerrar el gap de la extensión defensiva de Prisma para que inyecte `tenantId` también en escrituras anidadas y dentro de `update` anidado.  
**Resultado:** La extensión ahora recorre recursivamente `create`/`createMany`/`connectOrCreate` en relaciones anidadas y cubre `update` anidado sin tocar el `where` raíz. Se agregaron tests unitarios y un test E2E de integración.

| Operación | Inyección de `tenantId` |
|---|---|
| `findFirst` / `findMany` / `count` / `aggregate` / `groupBy` | ✅ En `where` |
| `updateMany` / `deleteMany` | ✅ En `where` |
| `create` / `createMany` / `createManyAndReturn` | ✅ En `data` raíz y anidada |
| `update` | ✅ Solo en relaciones anidadas (`create`/`createMany`/`connectOrCreate`); `where` no se modifica |
| `findUnique` / `delete` / `upsert` | ❌ Intencionalmente excluidos por restricciones de unicidad |

### Fase 9: Diagnósticos temporales en `special-prices` — ✅ COMPLETADA

**Meta:** Eliminar métodos y endpoints de diagnóstico temporales.  
**Resultado:** Eliminados `debugResolve` y `debugGroupDiscount` de `special-prices.service.ts` y sus endpoints. Build 0 errores, tests verdes.

### Fase 10: Aviso de worker process force exited en tests — 🔄 REAPARECIÓ

**Meta:** Localizar y corregir el leak de recursos que provocaba el aviso *"A worker process has failed to exit gracefully..."* al ejecutar los tests unitarios.  
**Resultado inicial:** `prisma.service.spec.ts` ahora guarda la referencia al `TestingModule` y invoca `module.close()` en `afterEach`, lo que dispara `onModuleDestroy` y `$disconnect()`.  
**Estado actual (2026-07-26):** el aviso ha vuelto en `npm test` (default workers): 128 suites / 1247 tests passed, pero con *"A worker process has failed to exit gracefully..."* al finalizar. Se está diagnosticando con `--detectOpenHandles` para identificar el spec que reintrodujo el leak.

### Fase 11: Validación obligatoria de `date`/`postingDate` — DT.10 Fase 1 ✅ COMPLETADA

**Meta:** Hacer obligatorios los campos `date` y `postingDate` en documentos comerciales, eliminando `@default(now())` en Prisma y rechazando creaciones sin fecha.  
**Resultado:** Schema Prisma migrado, DTOs base creados (`CreateAccountingDocumentHeaderDto`, `CreateCommercialDocumentHeaderDto`), `buildBaseDocumentData` lanza `BadRequestException` si faltan fechas. Build 0 errores, 128 suites / 1247 tests passed.

### Fase 12: Validación obligatoria de `date`/`postingDate` — DT.10 Fase 2 ✅ COMPLETADA

**Meta:** Extender la validación obligatoria de fechas a documentos de inventario/logística (`StockEntry`, `StockExit`, `StockAdjustment`, `StockTransfer`, `StockCount`, `TransportGuide`, `AssemblyOrder`).  
**Resultado:** Schema Prisma migrado, DTOs base aplicados, controladores normalizados, servicios sin fallbacks. Build 0 errores, lint 0/0, 128 suites / 1247 tests passed.

### Fase 13: Pruebas de carga y concurrencia multitenant con k6 ✅ COMPLETADA

**Meta:** Suite de load testing con k6 que valide throughput, latencia y aislamiento de tenants bajo concurrencia, integrada en CI.  
**Resultado:** Suite k6 creada en `load-tests/k6/` con 5 escenarios (smoke, load, kardex, bulk-import-concurrency, multitenant-isolation). Job CI dedicado.  
**Validación (perfil `small`):** 5/5 escenarios passed, 0% fallos, aislamiento multitenant verificado.

| Escenario | Checks | Fallos |
|-----------|--------|--------|
| `sale-invoice-smoke` | 12/12 | 0% |
| `sale-invoice-load` | 1364/1364 | 0% |
| `kardex-report` | 1920/1920 | 0% |
| `bulk-import-concurrency` | 50/50 | 0% |
| `multitenant-isolation` | 924/924 | 0% |

---

## 4. Patrones de código

### Discriminated unions para delegados dinámicos de Prisma

Cuando un utility debe llamar diferentes modelos de Prisma dinámicamente (e.g. `tx.salesOrderItem.update` vs `tx.purchaseOrderItem.update`), **no** usar `unknown` args + `as any` dentro de un `switch`. Usar una discriminated union:

```typescript
type LineModelUpdatePayload =
  | { model: 'salesQuotationItem'; args: Prisma.SalesQuotationItemUpdateArgs }
  | { model: 'salesOrderItem';      args: Prisma.SalesOrderItemUpdateArgs }
  | { model: 'purchaseOrderItem';   args: Prisma.PurchaseOrderItemUpdateArgs };

async function updateLineModel(tx: TX, payload: LineModelUpdatePayload): Promise<void> {
  switch (payload.model) {
    case 'salesQuotationItem': await tx.salesQuotationItem.update(payload.args); break;
    case 'salesOrderItem':      await tx.salesOrderItem.update(payload.args);      break;
    case 'purchaseOrderItem':   await tx.purchaseOrderItem.update(payload.args);   break;
  }
}
```

### Prisma query payloads tipados

```typescript
const include = {
  partner: true,
  items: { include: { item: true } },
} as const;
type OrderWithItems = Prisma.SalesOrderGetPayload<{ include: typeof include }>;

const order = await tx.salesOrder.findUnique({ where: { id }, include });
// `order` tiene tipo `OrderWithItems | null`
```

### Service return types explícitos

```typescript
async findOne(id: number): Promise<SaleInvoiceDto> { ... }
async confirm(id: number): Promise<void> { ... }
```

### Transacciones Prisma: cuándo `return` vs `const x = await`

> **Lección aprendida (2026-08-08):** los `createFrom*` de `sale-invoices` y
> `purchase-invoices` usaban `await this.prisma.$transaction(...)` a secas,
> descartando el resultado del callback. El documento se creaba en BD pero el
> servicio retornaba `undefined` → Nest respondía **201 con body `{}`** (bug
> silencioso). Se corrigieron 15 métodos a `return this.prisma.$transaction(...)`.

Los **3 patrones válidos** para transacciones Prisma — la combinación está
permitida, cada uno con su justificación:

```typescript
// ── PATRÓN A (default recomendado): el método termina retornando la tx.
//    El callback retorna el documento; se propaga como respuesta del endpoint.
return this.prisma.$transaction(async (tx) => {
  const doc = await tx.saleInvoice.create({ ... });
  return this._executeConfirmLogic(tx, doc, tenantId, createdById);
});

// ── PATRÓN B: se necesita el resultado de la tx PARA ALGO MÁS después
//    (ej. resolver con findOne fuera de la tx, o validar el id antes de
//    responder). Equivalente en resultado a A; usar cuando hay lógica
//    posterior que depende del id capturado.
const orderId = await this.prisma.$transaction(async (tx) => {
  const order = await tx.purchaseOrder.create({ ... });
  return order.id;
});
return this.findOne(orderId, tenantId);

// ── PATRÓN C (PROHIBIDO): await sin capturar ni retornar el resultado.
//    El callback retorna algo pero el método lo descarta → undefined.
//    ❌ NUNCA:  await this.prisma.$transaction(async (tx) => { ... return doc; });
//    ❌ NUNCA:  this.prisma.$transaction(async (tx) => { ... return doc; });  (sin await ni return)
```

**Regla de verificación** (para reviews y la checklist de `createFrom*`):

1. Si el método **termina** en la tx → `return this.prisma.$transaction(...)` (Patrón A).
2. Si necesita el resultado para lógica posterior → `const x = await this.prisma.$transaction(...)` y retornar/usar `x` (Patrón B).
3. **Prohibido:** `await this.prisma.$transaction(...)` sin asignar el resultado a una variable ni retornarlo.
4. Al cambiar el patrón de una tx, verificar que el método **no tenga código después** de la tx que dependa de la variable capturada (rompería el retorno).
5. Test de humo: el endpoint debe devolver el documento creado (no `{}` con 201/200).

> **Nota sobre `await` vs `return` en rendimiento:** la diferencia es despreciable
> (un microtask de diferencia en el wrapping de la promesa). `await` da mejores
> stack traces de debugging, pero **solo** cuando se captura el resultado
> (Patrón B). Nunca justifica el Patrón C.

### Test mocks tipados

```typescript
{ provide: ItemsService, useValue: {
    findOne: jest.fn().mockResolvedValue(mockItem),
  } as unknown as ItemsService }
```

---

## 5. Checklist de seguridad de tipos

- [ ] ¿Cero `as any` en producción? (`src/**/*.ts` sin `.spec`)
- [ ] ¿Cero anotaciones `: any` en parámetros, variables y propiedades?
- [ ] ¿Cero tipos anónimos inline en firmas de servicios?
- [ ] ¿Los payloads `createFrom*` usan DTOs formales?
- [ ] ¿Los controllers usan DTOs en `@Body()`?
- [ ] ¿Los servicios declaran retornos explícitos (`Promise<T>`)?
- [ ] ¿Las queries Prisma con `include` tienen tipos de payload?
- [ ] ¿Los mocks de tests usan `as unknown as T` o `satisfies Partial<T>`?
- [ ] ¿Los nuevos modelos tienen `tenantId` y `@@index([tenantId])`?
- [ ] ¿`npm run build`, `npm test` y `npm run lint` están verdes?

---

## 6. Infraestructura y operaciones

### 6.1 Backups y Disaster Recovery

**RPO / RTO:**

| Métrica | Valor | Notas |
|---------|-------|-------|
| **RPO** (pérdida máxima de datos) | 24 horas | Backups diarios automáticos o manuales. |
| **RTO** (tiempo de recuperación) | 1-4 horas | Depende del tamaño de la DB y del medio de restore. |

**Comandos:**

```bash
cd backend-erp
npm run backup:db        # backup en backend-erp/backups/
npm run restore:db       # requiere BACKUP_FILE=... en .env
```

**Retención:** 7 diarios + 4 semanales. Aplicado automáticamente al final de cada backup.  
**Validación:** Restaurar en `erp_test` y ejecutar `npm run test:e2e`.  
**Variables:** `DATABASE_URL`, `BACKUP_DIR`, `BACKUP_KEEP_DAILY` (7), `BACKUP_KEEP_WEEKLY` (4).

### 6.2 Monitoreo y alertas

**Endpoints:**

- `GET /health` — health checks públicos (Prisma, memoria, disco).
- `GET /metrics` — métricas Prometheus (`http_requests_total`, `http_request_duration_seconds`, `http_request_errors_total` con labels `method`, `status`, `tenant`).

**Variables:** `HEALTH_MEMORY_THRESHOLD_PERCENT` (0.9), `HEALTH_DISK_THRESHOLD_PERCENT` (0.9).

**Archivos clave:** `src/monitoring/health/health.controller.ts`, `src/monitoring/metrics/metrics.controller.ts`, `src/monitoring/metrics/metrics.interceptor.ts`.

### 6.3 Rate limiting por tenant

**Límites por defecto:**

| Plan | Límite | Ventana |
|------|--------|---------|
| `SHARED` | 300 req/min | 60 segundos |
| `DEDICATED` | 2000 req/min | 60 segundos |
| Público / IP | 60 req/min | 60 segundos |
| Login | 5 intentos/min | 60 segundos |

**Implementación:** `TenantThrottlerGuard` extiende `ThrottlerGuard`. Tracker `tenant:<tenantId>` para autenticados; `ip:<ip>` para públicos.  
**Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.  
**Variables:** `THROTTLE_TTL_MS` (60000), `THROTTLE_LIMIT_SHARED` (300), `THROTTLE_LIMIT_DEDICATED` (2000), `THROTTLE_LIMIT_PUBLIC` (60).

### 6.4 Import masivo seguro

**Variable:** `BULK_IMPORT_SAFE_MODE=true` (default) — instancia dedicada. Nunca desactiva triggers PostgreSQL.  
**Variable:** `BULK_IMPORT_SAFE_MODE=false` — instancia compartida. Desactiva triggers temporalmente, usa lock global (`_BulkImportLock`), y hace `rebuild_all_custom_field_values()` al finalizar. Ventana de vulnerabilidad: ~10-20 segundos.

---

## 7. Sistema de moneda en contabilidad (Multi-divisa)

> Implementado en Jun 2026. Schema migrado, backend funcional, tests pasando.

### Modelo de datos

| Campo | Modelo | Descripción |
|-------|--------|-------------|
| `localCurrency` | `Tenant` | Moneda local del tenant (default: `BOB`) |
| `systemCurrency` | `Tenant` | Moneda del sistema (default: `USD`) |
| `currencyMode` | `Account` | `LOCAL` \| `SYSTEM` \| `MULTI` \| `SPECIFIC` |
| `currency` | `Account` | Moneda específica (solo cuando `currencyMode = SPECIFIC`) |
| `debitLocal` / `creditLocal` | `JournalEntryLine` | Monto en moneda local del tenant |
| `debitSystem` / `creditSystem` | `JournalEntryLine` | Monto en moneda del sistema |
| `currency` | `JournalEntryLine` | Moneda de la línea (heredada del asiento) |
| `isLocalCurrency` | `Currency` | Flag: esta moneda es la local del tenant |
| `isSystemCurrency` | `Currency` | Flag: esta moneda es la del sistema |

### Reglas de validación

Al crear o actualizar un asiento (`JournalEntriesService.create` / `update`):

1. **Validación de moneda por cuenta** (`validateAccountCurrencies`):
   - `LOCAL`: la moneda del asiento debe ser `tenant.localCurrency`
   - `SYSTEM`: la moneda del asiento debe ser `tenant.systemCurrency`
   - `SPECIFIC`: la moneda del asiento debe coincidir con `account.currency`
   - `MULTI`: sin restricción

2. **Cálculo de doble expresión** (`resolveDoubleExpression`):
   - Si el asiento está en moneda local: `debitLocal = debit`, `debitSystem = debit / systemRate`
   - Si el asiento está en moneda del sistema: `debitSystem = debit`, `debitLocal = debit * exchangeRate`
   - Si el asiento está en otra moneda: `debitLocal = debit * exchangeRate`, `debitSystem = debitLocal / systemRate`

3. **Expansión de reglas de distribución**: los campos `debitLocal`, `creditLocal`, `debitSystem`, `creditSystem` se distribuyen proporcionalmente junto con los montos originales.

### Configuración por tenant

```typescript
// Valores por defecto en Tenant
localCurrency:  'BOB'
systemCurrency: 'USD'
```

Para cambiar las monedas de un tenant, actualizar directamente el modelo `Tenant` (no solo `SystemSettings`).

---

## 7.5 Sistema ShortName — Cuentas Asociadas y Trazabilidad en Asientos

> Implementado en Jun 2026. Permite que una cuenta de mayor (CxC, CxP, etc.) se desagregue por código de partner en el libro mayor, manteniendo trazabilidad al documento origen. Detalle completo en `docs/guides/ACCOUNTING_ENTRIES_GUIDE.md`.

### Conceptos clave

| SAP B1 | Equivalente ERP | Campo |
|---|---|---|
| `JDT1.Account` | Cuenta contable real | `JournalEntryLine.accountId` |
| `JDT1.ShortName` | Código del partner (CxC/CxP) | `JournalEntryLine.partnerCode` |
| `JDT1.ContraAct` | Cuenta contraaria | `JournalEntryLine.contraAccountId` |
| `JDT1.TransId` | ID del asiento | `JournalEntry.id` |
| `JDT1.SourceID` / `SourceLine` | Documento origen | `JournalEntry.sourceDocumentType` + `sourceDocumentId` |

### Cuentas que requieren partner (`requiresPartner = true`)

El seed marca como `requiresPartner: true` las cuentas de CxC, CxP, documentos por cobrar/pagar, y anticipos de clientes/proveedores (ver `src/common/chart-of-accounts.data.ts`). Si una línea de asiento usa una de estas cuentas, `JournalEntriesService.validatePartnerRequirements` exige `partnerId`.

### Configuración en el maestro de partners

Cada partner debe tener configuradas sus cuentas contables en la pestaña "Contabilidad":

| Campo | Tipo de partner | Cuenta por defecto |
|---|---|---|
| `receivableAccountId` | Cliente / Ambos | `1.1.2.01.001` (CxC Clientes M/N) |
| `advanceReceivableAccountId` | Cliente / Ambos | `2.1.5.01.001` (Anticipo Clientes M/N) |
| `payableAccountId` | Proveedor / Ambos | `2.1.1.01.001` (CxP Proveedores M/N) |
| `advancePayableAccountId` | Proveedor / Ambos | `1.1.2.05.001` (Anticipos Proveedores Nacionales) |

### M/N vs M/E automático (T68, 2026-09-12)

El socio puede tener además las **variantes por moneda** (`receivableAccountIdLocal`,
`receivableAccountIdForeign`, `payableAccountIdLocal`, `payableAccountIdForeign`).
`AccountDeterminationService._resolvePartnerVariantAccount` elige la variante con
`isForeignSettlement()` (`src/common/partner-account-variants.util.ts`):

1. **Moneda del documento** ≠ moneda base (`settings.baseCurrency`) → **M/E**. Los
   builders de ventas, compras y pagos pasan la moneda del documento en el
   contexto (`currency`).
2. **Moneda por defecto del socio** (`Partner.currency`) ≠ moneda base → **M/E**
   (refuerzo cuando el documento no informa moneda).
3. **País del socio** ≠ país de la empresa (`Tenant.countryCode`) → **M/E**. El
   país del socio es texto libre ("Bolivia"), así que la comparación normaliza
   nombre↔ISO con una tabla corta de alias; si no se puede resolver, se asume
   **local** (un typo no cambia la cuenta de un socio que ya funcionaba).

Si la variante que corresponde está vacía, se cae a la cuenta **genérica** del
socio y luego al AccountMapping (comportamiento histórico intacto). Los
**anticipos** no tienen variante y siguen usando su cuenta genérica. Cuando el
socio no tiene ninguna variante configurada, ni siquiera se leen los settings.

### Flujo automático

`AccountingEngine._buildSaleInvoiceJournalEntryLines()` (y sus pares de compras/pagos/stock) determinan la cuenta vía `AccountDeterminationService`, setean `partnerId` y el backend denormaliza `partnerCode` desde `Partner.code` en `JournalEntryLine` al persistir.

### Validaciones y fixes recientes (Jul 2026)

- `reverseJournalEntry` copia todos los campos de doble expresión (`debitLocal`, `creditLocal`, `debitSystem`, `creditSystem`), moneda, dimensiones y referencias.
- `post()` revalida que `totalDebit === totalCredit` (tolerancia 0.001) antes de cambiar el estado a `POSTED`.
- `JournalEntryLine` incluye `projectId`, `ref1`, `ref2` y `dueDate`.

### Jerarquía de determinación (nivel ITEM, T67 2026-09-12)

En nivel `ITEM`, `_walkItemHierarchy` resuelve en este orden:

1. **Matriz artículo-almacén** (`ItemWarehouseAccount` activo para ese almacén).
2. **Maestro del artículo** (`Item.inventoryAccountId`, `salesRevenueAccountId`, …):
   antes los campos del formulario del artículo eran decorativos a nivel ITEM y
   un artículo sin fila en la matriz no podía contabilizar aunque tuviera la
   cuenta cargada.
3. AccountMapping global **solo** para los entry types de la lista
   `ITEM_ENTRY_TYPES_WITH_MAPPING_FALLBACK` (SALES_REVENUE, PURCHASES, GRIR,
   contrapartidas de inventario, diferencia de cambio, …). El resto es estricto y
   lanza `BadRequestException` con el nivel y las fuentes a configurar.

---

## 8. Integración bancaria — Bank Statement Posting

### 8.1 Flujo de posting de extractos bancarios

El extracto bancario (`BankStatement`) no genera asientos contables automáticamente al crearlo. El flujo es:

1. **Creación/Importación** — El usuario crea el extracto y carga líneas (manual o import CSV). Estado: `DRAFT`.
2. **Asignación de cuentas contables** — En cada línea del extracto, el usuario asigna opcionalmente:
   - `accountId` (cuenta contable del contra-asiento)
   - `partnerId` (socio de negocio, para trazabilidad)
   - `projectId` (proyecto, para dimensiones)
3. **Confirmación y posting** — El usuario presiona "Confirmar y Generar Asientos". El backend:
   - Valida que el estado sea `DRAFT` y no `RECONCILED` ni `POSTED`.
   - Filtra las líneas que tienen `accountId` asignado (o cargo tipificado: `ITF`, que resuelve su contrapartida por el mapeo `BANK_STATEMENT` / `FINANCIAL_TRANSACTION_TAX`).
   - Por cada línea, genera un asiento manual (`JournalEntry`) de tipo `BANK_STATEMENT` con `persistManualJournalEntry()`:
     - Lado banco: `debit` (si es débito del extracto) o `credit` (si es crédito) contra la cuenta GL vinculada al `BankAccount`.
     - Lado contrapartida: la cuenta `accountId` asignada por el usuario.
   - **Liga el asiento a la LÍNEA del extracto** (`sourceDocumentId` = id de la línea, T116): el vínculo es resoluble desde el documento y la reversión encuentra exactamente ese asiento.
   - Enlaza cada línea del extracto con su línea de asiento (`journalEntryLineId`) y la marca `MATCHED_AUTO` (el propio extracto la contabiliza).
   - Cambia el estado del extracto a `POSTED`.
4. **Des-contabilización (`unpost`, T116)** — `POST /bank-statements/:id/unpost` con `{ reason }` (obligatorio):
   - Solo sobre un extracto `POSTED`; un `RECONCILED` exige deshacer antes la conciliación.
   - Revierte **una por una** las líneas contabilizadas (`reverseJournalEntry('BANK_STATEMENT', line.id, …)`), libera la línea (`journalEntryLineId = null`, `UNRECONCILED`) y devuelve el extracto a `DRAFT`, de modo que se pueda corregir y volver a registrar.
   - Si una reversa no se puede hacer, **falla** en vez de continuar: dejar la línea como si nada con el asiento vivo es la degradación silenciosa que produjo T106.
5. **Balance dinámico** — El balance de cada `BankAccount` se calcula en tiempo real agregando `JournalEntryLine` (donde `journalEntry.status = 'POSTED'` y `accountId = BankAccount.accountId`). El campo `balance` del modelo Prisma se ignora en lectura; se reemplaza por el valor calculado en `findAccountsByBank` y `findAccounts`.

### 8.1.b Emparejamiento de la conciliación (`auto-match`) — rondas ordenadas (T116)

El auto-match **no** toma «el primero que cuadre»: evalúa el emparejamiento en **rondas
sucesivas** (como los *matching criteria* de SAP Business One y la jerarquía de reglas
de NetSuite), y dentro de cada ronda ordena los candidatos por **cercanía de fecha** y,
si persiste el empate, por **id** — el resultado es determinista:

| Ronda | `matchCriteria` | Criterio |
|---|---|---|
| 1 | `REFERENCE` | La referencia del extracto aparece en la del candidato (`ref1`/`ref2`/`ref3` del asiento o `referenceNo` del pago), con importe y fecha en la ventana corta. Solo aplica si la línea del extracto **trae** referencia. |
| 2 | `AMOUNT_DATE` | Importe dentro de la tolerancia y fecha dentro de la ventana corta (`bankReconciliationMatchWindowDays`, ±3 por defecto). |
| 3 | `AMOUNT_WIDE_DATE` | Importe dentro de la tolerancia y fecha dentro de la ventana **ancha** (`bankReconciliationWideMatchWindowDays`). **Desactivada por defecto** (0): emparejar solo por importe a 90 días puede cruzar dos movimientos iguales y distintos, así que se habilita a propósito. |

La ronda ganadora se guarda en `BankReconciliationLine.matchCriteria`, de modo que la
decisión del sistema es auditable (antes no quedaba rastro de *por qué* se eligió ese
candidato y no otro).


### 8.2 Endpoints del módulo bancario (relevantes para contabilidad)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/bank-statements` | Crear extracto (estado `DRAFT`) |
| `POST` | `/bank-statements/:id/import` | Importar líneas desde CSV/Excel |
| `PUT` | `/bank-statements/:id/lines/:lineId` | Editar `accountId`, `partnerId`, `projectId` de una línea |
| `POST` | `/bank-statements/:id/post` | **Contabilizar** el extracto. Genera asientos por cada línea con `accountId`. |
| `POST` | `/bank-statements/:id/unpost` | **Des-contabilizar** el extracto (T116): reversa por línea con `reason` obligatorio y vuelta a `DRAFT`. |
| `GET` | `/banks/accounts/:id/balance` | Devuelve balance dinámico (`debit - credit` de `JournalEntryLine` POSTED) |

### 8.3 Reglas críticas

- **Nunca postear un extracto reconciliado:** `POST` sobre `RECONCILED` lanza `ConflictException`.
- **Toda operación que postea se puede des-postear (T116).** `post` es irreversible por
  diseño (reintentarlo da `409`) y un extracto contabilizado **no se borra** (T114):
  sin `unpost` el usuario quedaba sin salida ante un registro equivocado. La regla
  general del motor es: **si algo se puede contabilizar, tiene que poder deshacerse**
  (reversión con motivo), y ninguna operación destructiva sustituye a la reversión.
- **El asiento apunta a un documento resoluble, con grano único (T116).** El asiento de
  un extracto se liga a la **línea** (`sourceDocumentId` = `BankStatementLine.id`, un
  asiento por línea), no al encabezado: `reverseJournalEntry` busca por `(tipo, id)` con
  `findFirst`, así que dos asientos con el mismo id de documento harían que la reversión
  encontrara solo uno y devolviera `null` en silencio (clase T106). El detector lo vigila
  con **R13d** (asiento de extracto cuya línea no existe = ERROR).
- **Líneas sin `accountId` se omiten:** Solo las líneas con cuenta contable asignada (o cargo tipificado `ITF`) generan asiento. Las demás quedan en el extracto como referencia sin impacto contable.
- **Un extracto contabilizado sí cuenta en su conciliación (T117):** el saldo conciliado
  suma las líneas ya resueltas (`MATCHED_AUTO`/`MATCHED_MANUAL`/`RECONCILED`) aunque no
  tengan fila de conciliación propia (las contabilizadas por el propio extracto), sin
  doble contar las que sí la tienen.
- **Balance siempre desde `JournalEntryLine`:** El `balance` persistente en `BankAccount` es un campo histórico. La API de lista (`GET /banks/:id/accounts`) devuelve el balance dinámico calculado por `_enrichWithBalances`.
- **Asientos de ajuste de conciliación:** La reconciliación bancaria (`BankReconciliation`) usa `persistManualJournalEntry()` con `documentType: 'BANK_RECONCILIATION_ADJUSTMENT'` y `status: 'DRAFT'` para asientos de ajuste manuales.
- **Link GL ↔ BankAccount:** Cada `BankAccount` tiene `accountId` (opcional). Si está vinculado, los asientos de pago usan esa cuenta directamente (vía `_resolveBankAccountId`). Si no está vinculado, usa `AccountDeterminationService` (fallback).

---

## 8.4 Reglas del dinero (obligatorias)

> **Origen (T125, 2026-09-14):** el POS rechazaba acreditar el saldo **completo** de una
> factura con el mensaje autocontradictorio `El crédito (62,98) supera el saldo restante
> de la factura (62,98)`. La causa no era la guarda, era la **aritmética**: la nota de
> crédito recalculaba sus importes con `Number(...)` y coma flotante
> (`priceNet * qty`, `taxAmount * ratio`, acumulando en variables `number`) y el total
> quedaba unas milésimas de centavo por encima del saldo almacenado.

El dinero **no es un `number`**: `0.1 + 0.2 !== 0.3`. La utilidad canónica es
**`src/common/money.util.ts`** y estas son las reglas, aplicables a todo código nuevo o
que se toque (hay una migración pendiente del resto del código, ver «Deuda» abajo):

| # | Regla | Herramienta |
|---|---|---|
| 1 | **Nunca comparar dinero con un épsilon inventado** (`x > y + 0.001`): comparar a la precisión real del dinero, el centavo | `moneyGt`, `moneyGtOrEq`, `moneyLt`, `moneyLtOrEq`, `moneyEquals`, `isZeroMoney` |
| 2 | **Nunca acumular dinero en `number`**: sumar en `Decimal` | `sumMoney`, `addMoney` |
| 3 | **Redondear una vez por concepto** (la línea, el documento), no en cada operación intermedia ni al final de una cadena de flotantes | `roundMoney`, `mulMoney`, `prorateMoney` |
| 4 | El redondeo es **mitad hacia arriba** (`ROUND_HALF_UP`), la convención contable — no `Math.round` (que redondea hacia +∞ en negativos) ni redondeo bancario | `roundMoney` |
| 5 | En repartos proporcionales (IVA por línea, descuento global, devolución parcial), **cuadrar la última línea con el total redondeado** para que la suma de las partes iguale el todo | `settlementDifference` |
| 6 | Cuando haga falta aritmética de enteros, **centavos** (nunca floats) | `toCents`, `fromCents` |
| 7 | En la base, los importes son `Decimal(14,2)`/`(14,6)`; en el código se pasan como `Decimal` (Prisma los acepta), no convertidos a `number` «para operar» | — |

**Ejemplo canónico** (el patrón que se aplicó en la nota de crédito):

```ts
const lineSubtotal = Money.mulMoney(priceNet, qty);          // redondeo a centavos
const lineTax = Money.prorateMoney(origLine.taxAmount ?? 0, ratio);
const lineTotal = Money.addMoney(lineSubtotal, lineTax);
subtotal = subtotal.plus(lineSubtotal);                       // Decimal, no number
// …
if (Money.moneyGt(total, remaining)) throw new BadRequestException(/* … */);
```

**Deuda declarada y plan de migración (T126):** la migración es **por criticidad**, no un
barrido a ciegas, y hay un **gate** que la gobierna:

```bash
npm run audit:money           # inventario priorizado (R1 épsilons, R2a Number(...)+aritmética, R2b redondeo manual, R2c .toFixed)
npm run audit:money:check     # ratchet: falla si la deuda AUMENTA respecto de la línea base (autoprueba primero)
npm run audit:money:self-test # prueba el DETECTOR contra 23 casos difíciles (positivos y negativos)
```

> **La métrica se autoprueba.** `--check` y `--update-baseline` ejecutan la autoprueba
> **antes** de mirar el número: si el detector deja de ver un caso que ya se pagó una vez
> (los **siete** límites de la tabla de abajo), el gate falla aunque el número sea «verde».
> Es la respuesta a la lección que este gate pagó seis veces: *una métrica en 0 sólo vale si
> el detector está probado contra los casos difíciles*.

| Fase | Alcance | Estado |
|---|---|---|
| 1 | **Guards que deciden dinero** (comparaciones con épsilon inventado) | 🔄 **EN CURSO (2026-09-15)**: reabierta al corregir el 5.º límite (R1 no veía `Math.abs(a - b) < 0.001`) y **medida de verdad** al corregir el 6.º (**R1 v2**, con autoprueba): eran **31 visibles**, fueron **35 reales**, quedan **22**. Migradas las **2 primeras** (los cuadres del núcleo contable), **las 10 de los journal builders** —`sales` (4), `payments` (2), `purchases` (3) y el cuadre de columnas Local/System de `journal-entry-core` (1)— y **las 13 de los cuadres contables** —`journal-entries` (4: `create`, `update`, `post` y el `isBalanced` del preview), `fiscal-years` (7: saldos y resultado de la apertura y del cierre + las dos guardas de balance) y `accounting-periods` (2: el saldo del informe y la ecuación contable, ya con la suma en `Decimal`)—, todas a **precisión de centavo** (`moneyEquals`/`isZeroMoney`). Quedan **22**: `bank-reconciliation` (5), los repartos de pago (`incoming`/`outgoing` 4+4), `reports` (3), `exchange-rate-adjustments` (3, **a decisión de negocio**), `document-drafts` (1), `common/discount-propagation` (1) e `items` (1). Familias y tolerancia acordada: cuadres de asiento → **0 centavos**; repartos de pago → **1 centavo** (`isSettled`/`exceedsBy`); diferencias de cambio → a decidir por negocio (que la línea de diferencia de cambio **exista** sí es un zero-check de dinero, y va a centavo) |
| 2 | **Totales persistidos** (journal builders, facturas, FRV, devoluciones/NC) | 🔄 **en curso**: **redondeo manual cerrado (R2b = 0)** con `scripts/migrate-round-money.mjs`, y **aritmética ya migrada** en `document-totals.util`, `payment-term.util`, `rc-iva.service.ts`, `iue.service.ts`, `delivery-orders.service.ts`, `price-lists.service.ts`, `price-resolver.util.ts`, `purchase-invoices.service.ts`, `sale-reserve-invoices.service.ts` y `sale-invoices.service.ts`. Con el **detector ya corregido** (R2c y R2a v2), el inventario es **83** (R2a 66 + R2c 17). Frente abierto por criticidad: `reports` (8), `partners` (6), `bank-reconciliation` (5), `sales-debit-notes` (4), `purchase-debit-notes` (3), `items`/`fiscal-years`/`drafts.journal-builder` (pequeños) |
| 3 | Reportes y lecturas | ⏳ |

**Procedimiento por archivo (fase 2 · aritmética — receta probada)**: la aritmética no se
migra con un transformador, porque cambia el importe calculado. El orden que ya se aplicó
con éxito en `document-totals.util` y `payment-term.util` es:

1. **Inventario del archivo**:
   `npm run audit:money -- --all` (o `--file=<substr>`) → anota cuántos `R2a` tiene y en
   qué líneas (`Number(<dinero>)` seguido de operación).
2. **Test de centavos ANTES de tocar nada**: fija el importe exacto que debe salir. Los
   casos útiles son los que **hoy fallan** por coma flotante —`0.07 × 7` da
   `0.49000000000000005`, mil centavos dan `9.999999999999831`, `0.1 + 0.2` da
   `0.30000000000000004`—, no los que ya coinciden. Si el camino es un servicio con mocks
   pesados, **apóyate en el spec existente y en la barrida** (que pinchan importes) antes
   que escribir un test apurado: lo que no vale es migrar sin ninguna red.
3. **Migrar a `Decimal` preservando los tipos** del archivo (`Money.addMoney(...).toNumber()`,
   `Money.mulMoney(...).toNumber()`): si el archivo está tipado con `number`, convertir en
   el borde evita refactorizar cientos de líneas a la vez.
4. **Verificar, en este orden**: `npx tsc --noEmit` → `npm run build` → los specs del
   módulo **sin cambiar expectativas** (que sigan verdes es la prueba de que el importe no
   cambió más que en las milésimas que eran error) → `npm test` → la **barrida completa**
   (`node scripts/flow-sweep.mjs`, que exige cada asiento cuadrado y cada reversa espejo) →
   `npm run audit:money -- --update-baseline` y `audit:money:check`.
5. **Si la barrida se pone roja, no la toques para que pase**: investiga si el fallo es del
   arnés (ya pasó dos veces: artículo no vendible y kit no comprable en el escenario de
   compras) o real. Esa distinción es el valor del procedimiento.

**Punto de continuación**: **la fase 1 con 22 guardas medidas** (de las 35 reales: los journal
builders y los cuadres contables ya están migrados). Orden por criticidad: **(1)**
`bank-reconciliation` (5: el auto-match por importe ×2, el del pago contra la línea del extracto,
el `difference` del cierre y la guarda de balance del asiento de ajuste); **(2)** `reports` (3: el
filtro de importes del mayor, la ecuación contable y `matchesCashChange`), `document-drafts` (1) y
`common/discount-propagation` (1) — **ojo con `document-drafts`**: compara el precio base del
borrador y **el precio puede venir a 6 decimales** (`Decimal(14,6)`), así que hay que decidir la
**precisión** antes de migrar (o `roundMoneyTo`/un `moneyEquals` de 6 decimales), no meterlo en el
mismo saco que los cuadres—; **(3)** los **repartos de pago**
—`incoming-payments` (4) y `outgoing-payments` (4), con la tolerancia de **1 centavo** y
`isSettled`/`exceedsBy`—; **(4)** `items` (1) y la **familia de diferencias de cambio**
(`exchange-rate-adjustments`, 3), que sigue **a decisión de negocio**. Y, en la fase 2, `reports`
(8 R2a), `partners` (6), `bank-reconciliation` (5), `sales-debit-notes` (4),
`purchase-debit-notes` (3). *(Ya migrados: `document-totals.util`, `payment-term.util`,
`rc-iva.service.ts`, `iue.service.ts`, `delivery-orders.service.ts`, `price-lists.service.ts`,
`price-resolver.util.ts`, `purchase-invoices.service.ts`, `sale-reserve-invoices.service.ts`,
`sale-invoices.service.ts` y `journal-entries.service.ts`.)* **Cuando el camino
tenga mocks de fe** (crear un documento completo desde el servicio), la red válida es la
**E2E del flujo** (`test/*.e2e-spec.ts`, con importes reales) **más** la barrida: es lo que se
hizo en `purchase-invoices` (13/13 de la E2E de compras) y en `sale-reserve-invoices` (11/11
de la de ventas) en lugar de un test de centavos apurado. Eso sí: **declarado** en el
CHANGELOG y en T126, no omitido en silencio.

**Procedimiento por archivo (fase 1 · guardas — receta probada, 2026-09-15)**: (1) inventario
del archivo (`npm run audit:money -- --file=<substr>` y `--all`); (2) **decidir si el cambio es
observable ANTES de migrar**: si el importe que decide la guarda ya viene de
`roundMoney`/`round2`, entonces `Math.abs(x) >= 0.01` ⟺ `x ≠ 0` y la migración es **exacta** —no
se escribe un test que pasa antes y después, se **declara la equivalencia**—; si viene de una
acumulación en flotante, hay **test de centavos que falla antes y pasa después** (se comprueba
revirtiendo la guarda a mano, como se hizo con la diferencia de cambio de cobros); (3) migrar a
`isZeroMoney` (zero-check), `moneyEquals` (cuadre) o `isSettled`/`exceedsBy` (reparto) según la
familia; (4) verificar en el orden de la fase 2 y **reiniciar el backend con el `dist` del
commit antes de la barrida**; (5) **si el sitio no lo ve el gate, declararlo** — el número que
baja es el del gate, no el del frente (así aparecieron los límites 2, 6 y 7 de la tabla de
abajo); y (6) si un literal no lo ve el gate y **no** hay que migrarlo (una tasa, una cantidad,
un precio a 6 decimales), marcarlo `// money-ok: <razón>` en vez de bajar la sensibilidad del
detector.

**Precios con 6 decimales (no todo importe es `Decimal(14,2)`)**: los **precios unitarios**
—listas de precios, precios especiales y sus escalas— viven en `Decimal(14,6)`, así que
redondearlos con `roundMoney` (centavos) **pierde precisión**. Para eso está
**`roundMoneyTo(valor, decimales)`**: la **misma** regla (`ROUND_HALF_UP`) con la precisión
del sitio. No es una segunda regla de redondeo y por eso no lleva un modo propio. Antes de
migrar un sitio, mira la **columna destino** (`Decimal(14,2)` → `roundMoney`/`mulMoney`;
`Decimal(14,6)` → `roundMoneyTo(..., 6)`): la precisión se **preserva**, no se «mejora», o el
cambio deja de ser una migración y pasa a ser un cambio de producto.

**Límites conocidos del detector** (declarados, no cierres silenciosos — la lección de R2b
es que *una métrica sólo vale si el detector está probado contra los casos difíciles*):

| # | Límite | Estado |
|---|---|---|
| 1 | El redondeo manual **multi-línea** (`Math.round(` + `* 100,` + `) / 100` en tres líneas) no se veía con la regex: el «R2b = 0» era un artefacto | ✅ **corregido** (escáner por paréntesis + `--all`) |
| 2 | Una **segunda forma** de redondear dinero (`(neto + IVA) × 100` → `Math.round` → `/ 100`) no está reconocida por el gate | ⚠️ **el sitio ya está migrado** (`sale-reserve-invoices:313-319` pasó a `Money.sumMoney` en la ronda de R2b); lo que el gate no reconoce es la **forma**, así que si reaparece no se vería (2026-09-14) |
| 3 | R2a se ancla en `Number(<dinero>)`/`parseFloat(...)`, así que era **ciego al dinero que ya llega como `number`** (parámetro o local) y se opera con `+(...).toFixed(2\|6)` | ✅ **corregido con la regla R2c** (2026-09-14): detecta las dos formas (`<dinero>.toFixed(N)` y `+(<expr>).toFixed(N)`) + marcador `// toFixed-ok:` para porcentajes y tasas + exclusión informada de plantillas de texto. Medición honesta: **R2c = 50** (2 justificados, 19 de presentación) → **el inventario real pasó de 95 a 145** |
| 4 | R2a exigía un **prefijo** antes del nombre del campo: `Number(line.price) * qty` se contaba, pero `Number(priceNet) * qty` (**el identificador es el nombre del campo**) **no** | ✅ **corregido con R2a v2** (2026-09-14): prefijo opcional + filtro de lo que no es dinero (tasas, porcentajes e ids). Medición: **+7 sitios reales** (p. ej. `round2(Number(amount) * exchangeRate)`), total **89 → 96** |
| 5 | R1 solo veía el épsilon **dentro** de la expresión (`x > y + 0.001`); la forma `Math.abs(a - b) < 0.001` —la firma de la tolerancia improvisada— era **invisible**, así que el «R1 = 0» con el que se declaró cerrada esta fase era una **medición corta** | ✅ **corregido** (2026-09-14): la regla cubre las dos formas, con filtro de cantidades y porcentajes (`assignedQty - needed`, `sum - 100`): crudo 47, **real 31** → la fase 1 se reabrió con 31 guardas en 13 archivos |
| 6 | R1 no reconocía ni el **medio centavo** (`Math.abs(x) < 0.005`, la forma que tenía el cuadre de las columnas convertidas) ni el dinero **nombrado por intención** en vez de por el nombre del campo (`diff`, `exchangeDiffLocal`, `difference`, `netDifference`, `raw`, `resultado`, `n`, `r`). Medido con un escáner propio sobre `src/**/*.ts` (sin specs): de **52** comparaciones `Math.abs(...)` contra un literal decimal el gate veía **22** y no veía **30**, de las que **23 son código real** — **13 guardas de dinero** y **10 legítimas** en su precisión (cantidades ×4, porcentajes ×2, tasas ×2, precios `Decimal(14,6)` ×2) | ✅ **corregido con R1 v2** (2026-09-15): la forma (b) reconoce ahora **dos caminos** —el nombre del campo **o** un literal de **escala de dinero** (`0.001`/`0.005`/`0.01`)—, deja fuera por diseño los literales de precisión fina (`0.0001`/`0.000001`, que son cantidad/tasa/precio a 6 decimales) y `Math.abs(<suma> - 100)` (porcentaje), y añade el marcador `// money-ok:`. Medición: **R1 22 → 35** (las 13 ocultas, verificadas una a una), total **104 → 117** |
| 7 | El **filtro de R2a v2** (tasas, porcentajes e ids) era **código muerto**: al envolver `MONEY_FIELD.source` —que ya traía paréntesis— la cola del identificador quedaba en el grupo 3 y el filtro leía el grupo 2, que era la **palabra de dinero**, así que `Number(taxRate) * base` se contaba como aritmética de dinero y `NOT_MONEY_WORD` **nunca filtraba** (sobre-conteo latente desde la ronda de R2a v2) | ✅ **corregido** (2026-09-15): el grupo de dinero va **sin capturar** y la cola es el grupo 1; **efecto medido hoy 0** (en el código actual no hay sitios de esa forma, así que R2a sigue en 65) y el caso queda **pinzado por la autoprueba del detector** |
| 8 | El aviso general: **el propio detector no estaba probado**. Cada límite de esta tabla se descubrió *después* de declarar un cierre con él | ✅ **corregido en el proceso** (2026-09-15): `npm run audit:money:self-test` ejecuta **23 casos sintéticos** (positivos y negativos de los siete límites) y `--check` y `--update-baseline` lo corren **antes** de mirar el número — un detector roto ya no puede dar un gate verde (el límite 7 lo cazó esa autoprueba en su primera corrida) |

**Regla de redondeo, en una línea**: nunca `Math.round(x * 100) / 100` **ni `.toFixed(N)`**
sobre dinero — las dos redondean el valor binario, no el decimal (`(2.675).toFixed(2) ===
'2.67'`, cuando la regla 4 manda `2.68`). El redondeo de dinero es **siempre**
`Money.roundMoney(x)` (centavos) o `Money.roundMoneyTo(x, decimales)` (precisión de la
columna, p. ej. 6 en precios unitarios). Los **porcentajes y tasas** que sí se redondean con
`.toFixed()` se marcan con `// toFixed-ok: <razón>` (en la línea o en la anterior) y el gate
los cuenta como justificados; el formateo de un importe dentro de una **plantilla de texto**
es presentación y el gate lo informa aparte, no lo cuenta. Para una **comparación** con épsilon
que no es dinero (una tasa, una cantidad, un precio a 6 decimales) el marcador equivalente es
**`// money-ok: <razón>`**. Y **no cierres un archivo «a
medias»** para que el gate baje: si el cambio no es observable con un test (p. ej. porque un
redondeo posterior a centavos lo absorbe), **no lo hagas** — dejar ese archivo en «0
hallazgos» con sitios reales dentro es peor que declararlo como frente abierto.

**Lección del paso 2, medida en `iue.service.ts` y `delivery-orders.service.ts`
(2026-09-14)**: el caso del test de centavos depende de la **forma** de la aritmética que se
migra. En una **suma** de importes de 2 decimales la deriva de la coma flotante **no cambia
el resultado redondeado** a volúmenes normales —la suma de valores de 2 decimales es de 2
decimales y `roundMoney` es la identidad sobre ella—: 30.000 simulaciones aleatorias dieron
**0 diferencias**, así que ahí el caso que falla de verdad es el de **volumen** (20.000
líneas de 1.234.567,89 Bs: exacto 24.691.357.800,00 y flotante 24.691.357.799,99). En un
**producto o prorrateo** (`importe × cantidad / cantidadTotal`), en cambio, el caso útil es
**pequeño y cotidiano**: entregar 3 de 4 unidades de una línea de 5.656,86 Bs cae exactamente
en el medio centavo (4.242,645) y el flotante lo baja a 4.242,64, cuando la regla 4 manda
subir a 4.242,65. Moraleja doble: hay que **saber qué forma se está migrando** antes de
escribir el test, y un test de cuatro líneas que «pasa antes y después» **no prueba la
migración** — escribirlo y llamarlo test de centavos es peor que no tenerlo, porque
convierte una métrica en una ilusión (la misma lección que dejó el escáner de R2b).

**Lección del borde del centavo, medida en `journal-entries.service.ts` (2026-09-15)**: cuando
la guarda es `|D − C| > 0,01`, el **par de importes elegido decide si el test discrimina**. Un
desbalance de exactamente un centavo se aceptaba o se rechazaba **según cómo cayera el
flotante**: `2,3 − 2,29 = 0,009999999999999787` (< 0,01 → **aceptado**, el defecto) mientras
`100 − 99,99 = 0,010000000000005116` (> 0,01 → rechazado). Un test escrito con el par «natural»
(100 − 99,99) **pasa antes y después** y no prueba nada; el que discrimina es el par cuyo
resto flotante cae **por debajo** del umbral. Antes de dar por bueno un test de centavos de una
guarda con tolerancia, **compruébese el valor flotante del par** (una línea de `node -e`
basta): si cae del lado del rechazo, el test es decorativo. Es la misma trampa de T125, ahora
en el propio arnés de pruebas.

**Herramienta de migración del redondeo manual** (`scripts/migrate-round-money.mjs`):
convierte `Math.round(<expr> * 100) / 100` en `Money.roundMoney(<expr>)` con un **escáner por
paréntesis** (no una regex: las expresiones llevan paréntesis anidados y saltos de
línea), informa en *dry-run* y sólo escribe con `--write`. Si el archivo está tipado con
`number`, se completa con `scripts/migrate-round-money-totypes.mjs`, que añade
`.toNumber()` en el borde para **preservar los tipos** y no obligar a refactorizar el
archivo entero: la fase 2 cambia la **regla de redondeo** (una sola, mitad hacia arriba),
no la aritmética — ésa es la fase posterior, y llega cuando se migren los `Number(<dinero>)`.

**Tolerancias de liquidación**: cuando una guarda necesite admitir una diferencia de
redondeo, la tolerancia se declara **explícita y en centavos** con `isSettled(x, y,
cents)` / `exceedsBy(x, y, cents)` (por defecto 1 centavo). Nunca un `0.001` suelto en
una comparación: 1 milésimo **no existe** en dinero y es la firma de T125. Bajar o subir
esa tolerancia es una **decisión de negocio**, no una migración mecánica.

**Regla de cierre:** un cambio de dinero no está terminado sin su **test de centavos**
(`money.util.spec.ts` es el modelo) — o sin la **equivalencia declarada**, cuando el importe
que decide la guarda ya viene redondeado a centavos y ningún test puede distinguir el antes del
después (procedimiento de la fase 1, arriba; se declara en el CHANGELOG y en T126) — y el gate
`audit:money:check` debe seguir en verde.


---

## 9. Testing

### Backend

- **Unitarios:** Jest + ts-jest. Archivos `*.spec.ts` en `src/` (128 specs).
- **E2E:** Jest con config `test/jest-e2e.json`, `maxWorkers: 1`, `workerIdleMemoryLimit: 1GB` (reinicia el worker entre suites si supera 1 GB de heap para evitar el OOM de la corrida completa), timeout 30s. `npm run test:e2e` lanza jest con `node --max-old-space-size=6144` (heap elevado, necesario al correr las 14 suites juntas). Setup en `test/setup-e2e.ts` apunta a base de test local.
- **Mocks:** PrismaService mockeado como `as unknown as PrismaService` o `satisfies Partial<PrismaService>`.
- **Flujos E2E cubiertos:** ventas, compras, stock, lotes/seriados, pagos, billing, devoluciones/NC, precios especiales con quantity breaks.

### Comandos

```bash
cd backend-erp
npm run build            # 0 errores
npm run lint             # 0 errores, 0 warnings
npm test                 # 128 suites / 1247 tests
npm run test:e2e         # 11 suites / 57 tests
npm run perf:k6          # 5/5 escenarios passed
```

### Estado actual (2026-07-26)

| Comando | Estado | Evidencia |
|---------|--------|-----------|
| `npm run build` | ✅ **OK** | 0 errores |
| `npm run lint` | ✅ **OK** | 0 errores, 0 warnings |
| `npm test` | ✅ **OK** (con observación) | 128 suites / 1247 tests passed. **⚠️ Warning:** al finalizar aparece *"A worker process has failed to exit gracefully and has been force exited"*. Estaba aparentemente resuelto en Fase 10 pero ha vuelto; se está diagnosticando con `--detectOpenHandles`. |
| `npm run test:e2e` | ✅ **OK** | 11 suites / 57 tests passed |
| `npm run perf:k6` | ✅ **OK** | 5/5 escenarios passed (perfil `small`) |

---

## 10. Documentación adicional del backend

Estos documentos complementan a esta guía canónica. No son obligatorios para tareas rutinarias, pero deben consultarse antes de trabajar en los dominios que cubren.

| Archivo | Contenido | Cuándo consultar |
|---------|-----------|------------------|
| `docs/guides/ACCOUNTING_ENTRIES_GUIDE.md` | Estructura de asientos contables por tipo de documento (ventas, compras, stock, pagos). | Al trabajar contabilidad, asientos automáticos o determinación de cuentas. |
| `docs/reference/ACCOUNTS_DETERMINATION_FIX.md` | Análisis y corrección de paridad de cuentas contables por nivel (artículo, grupo, almacén). | Como referencia del fix de paridad de cuentas y determinación. |
| `docs/reference/SAP_B1_VS_ERP_COMPARATIVE_ANALYSIS.md` | Análisis comparativo de determinación de cuentas: SAP B1 vs ERP. | Como referencia de arquitectura contable. |
| `backend-erp/docs/fixed-assets.md` | Documentación del módulo de Activos Fijos y depreciación. | Al trabajar en `backend-erp/src/fixed-assets/`. |
| `docs/archive/` | Informes históricos de frentes completados y cierres de fase. | Solo si se necesita trazabilidad histórica de una migración ya cerrada. |
