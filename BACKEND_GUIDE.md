# BACKEND_GUIDE.md — backend-erp

> Guía única y canónica para el desarrollo backend del ERP. Cualquier nuevo módulo, servicio, o endpoint debe seguir estos patrones.
> **Última actualización:** 2026-07-25 (sección ShortName y estado de testing).  
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
- En archivos `.spec.ts` se permite `as unknown as T` para mocks parciales, pero nunca `as any`.

> **Estado real (2026-07-25):** quedan `as any` justificados temporalmente en producción. Están documentados como deuda técnica activa en la lista de abajo y deben eliminarse en un refactor posterior.

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

Los siguientes archivos aún usan `as any` y deben refactorizarse:

| Archivo | Líneas | Motivo / Patrón a reemplazar |
|---------|--------|------------------------------|
| `src/fiscal-years/fiscal-years.controller.ts` | 27, 33, 39, 45, 51, 57, 63 | `undefined as any` usado como `tenantId`; el controller debería inyectar `tenantId` con `@CurrentUser()` y pasarlo al servicio. |
| `src/payment-terms/payment-term-movement-checker.ts` | 18 | `prisma as any` para acceder a un cliente Prisma genérico; tipar con `PrismaClient` o el tipo de transacción correspondiente. |
| `src/tax-indicators/tax-indicator-movement-checker.ts` | 17 | Idem `prisma as any`. |
| `src/warehouses/warehouse-movement-checker.ts` | 19 | Idem `prisma as any`. |

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

### Fase 7: Tests — ✅ COMPLETADA

**Meta:** ~128 `as any` en 20 specs (mocks).  
**Resultado:** Todos los `as any` de `src/**/*.spec.ts` fueron migrados a tipos seguros (`as unknown as T`, `Parameters<typeof service.method>[0]`, tipos locales y `satisfies Partial<T>`). Build 0 errores, lint 0/0, 958 tests passed.

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

### Fase 10: Aviso de worker process force exited en tests — ✅ COMPLETADA

**Meta:** Localizar y corregir el leak de recursos que provocaba el aviso *"A worker process has failed to exit gracefully..."* al ejecutar los tests unitarios.  
**Resultado:** `prisma.service.spec.ts` ahora guarda la referencia al `TestingModule` y invoca `module.close()` en `afterEach`, lo que dispara `onModuleDestroy` y `$disconnect()`.  
**Validación:** `npm test` (default workers): 114 suites / 958 tests passed, sin aviso de worker force exited en 5+ ejecuciones consecutivas. `--detectOpenHandles` limpio.

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

### Flujo automático

`AccountingEngine._buildSaleInvoiceJournalEntryLines()` (y sus pares de compras/pagos/stock) determinan la cuenta vía `AccountDeterminationService`, setean `partnerId` y el backend denormaliza `partnerCode` desde `Partner.code` en `JournalEntryLine` al persistir.

### Validaciones y fixes recientes (Jul 2026)

- `reverseJournalEntry` copia todos los campos de doble expresión (`debitLocal`, `creditLocal`, `debitSystem`, `creditSystem`), moneda, dimensiones y referencias.
- `post()` revalida que `totalDebit === totalCredit` (tolerancia 0.001) antes de cambiar el estado a `POSTED`.
- `JournalEntryLine` incluye `projectId`, `ref1`, `ref2` y `dueDate`.

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
   - Filtra las líneas que tienen `accountId` asignado.
   - Por cada línea, genera un asiento manual (`JournalEntry`) de tipo `BANK_STATEMENT` con `persistManualJournalEntry()`:
     - Lado banco: `debit` (si es débito del extracto) o `credit` (si es crédito) contra la cuenta GL vinculada al `BankAccount`.
     - Lado contrapartida: la cuenta `accountId` asignada por el usuario.
   - Enlaza cada línea del extracto con su línea de asiento (`journalEntryLineId`).
   - Cambia el estado del extracto a `POSTED`.
4. **Balance dinámico** — El balance de cada `BankAccount` se calcula en tiempo real agregando `JournalEntryLine` (donde `journalEntry.status = 'POSTED'` y `accountId = BankAccount.accountId`). El campo `balance` del modelo Prisma se ignora en lectura; se reemplaza por el valor calculado en `findAccountsByBank` y `findAccounts`.

### 8.2 Endpoints del módulo bancario (relevantes para contabilidad)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/bank-statements` | Crear extracto (estado `DRAFT`) |
| `POST` | `/bank-statements/:id/import` | Importar líneas desde CSV/Excel |
| `PUT` | `/bank-statements/:id/lines/:lineId` | Editar `accountId`, `partnerId`, `projectId` de una línea |
| `POST` | `/bank-statements/:id/post` | **Contabilizar** el extracto. Genera asientos por cada línea con `accountId`. |
| `GET` | `/banks/accounts/:id/balance` | Devuelve balance dinámico (`debit - credit` de `JournalEntryLine` POSTED) |

### 8.3 Reglas críticas

- **Nunca postear un extracto reconciliado:** `POST` sobre `RECONCILED` lanza `ConflictException`.
- **Líneas sin `accountId` se omiten:** Solo las líneas con cuenta contable asignada generan asiento. Las demás quedan en el extracto como referencia sin impacto contable.
- **Balance siempre desde `JournalEntryLine`:** El `balance` persistente en `BankAccount` es un campo histórico. La API de lista (`GET /banks/:id/accounts`) devuelve el balance dinámico calculado por `_enrichWithBalances`.
- **Asientos de ajuste de conciliación:** La reconciliación bancaria (`BankReconciliation`) usa `persistManualJournalEntry()` con `documentType: 'BANK_RECONCILIATION_ADJUSTMENT'` y `status: 'DRAFT'` para asientos de ajuste manuales.
- **Link GL ↔ BankAccount:** Cada `BankAccount` tiene `accountId` (opcional). Si está vinculado, los asientos de pago usan esa cuenta directamente (vía `_resolveBankAccountId`). Si no está vinculado, usa `AccountDeterminationService` (fallback).

---

## 9. Testing

### Backend

- **Unitarios:** Jest + ts-jest. Archivos `*.spec.ts` en `src/` (~114 specs).
- **E2E:** Jest con config `test/jest-e2e.json`, `maxWorkers: 1`, timeout 30s. Setup en `test/setup-e2e.ts` apunta a base de test local.
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

### Estado actual (2026-07-25)

| Comando | Estado | Evidencia |
|---------|--------|-----------|
| `npm run build` | ✅ **OK** | 0 errores |
| `npm run lint` | ✅ **OK** | 0 errores, 0 warnings |
| `npm test` | ✅ **OK** | 128 suites / 1247 tests passed |
| `npm run test:e2e` | ✅ **OK** | 11 suites / 57 tests passed |
| `npm run perf:k6` | ✅ **OK** | 5/5 escenarios passed (perfil `small`) |
