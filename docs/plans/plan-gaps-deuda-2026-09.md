# Plan de Gaps y Deuda — ERP Suite (2026-09-08)

> Documento formal de brechas de producto y deuda técnica detectadas durante la
> sesión de trabajo T26–T32h (2026-09-08) más la revisión de código asociada.
> Objetivo: que ningún hallazgo se pierda con el cierre de la sesión; cada ítem
> tiene prioridad, descripción técnica y criterio de aceptación.
>
> **Cómo usar este documento:** cada ítem marcado `☐` es candidato a plan propio
> (como los existentes en `docs/plans/`). Al implementarse, moverse a
> `AUDIT.md` con su fila (T33+) y marcarse `✅` aquí.

---

## 1. Gaps de negocio (módulos ausentes o por potenciar)

### G1 — Costeo de importación: "Precios de Entrega" / Landing Cost ☐ · Prioridad ALTA

- **Qué falta:** no existe ningún documento de *landed cost* / "Precio de
  Entrega". El usuario lo necesita para costear una importación sumando todos
  los gastos adicionales (flete, seguro, nacionalización, despacho, etc.) al
  costo de los artículos.
- **Uso previsto (definido por el usuario):** agrupar todos los gastos de la
  importación en un **Proyecto** y luego aplicarlos en el documento de
  "Precio de Entrega", que reparte esos gastos sobre las líneas de la compra
  y actualiza el costo unitario/valorizado del inventario.
- **Aceptación sugerida:**
  - Documento cabecera + líneas donde el origen es una Factura de Compra
    (o Recepción) y los gastos extra se referencian por Proyecto.
  - Reparto de gastos prorrateado (por cantidad, valor o % configurable por
    línea) y persistencia del costo final en las líneas del artículo.
  - Actualización del costo promedio / valorización de inventario y su
    impacto contable (cuentas configurables por tipo de gasto).
  - Afectación de kardex y reportes de costo sin romper el flujo de
    importación manual actual.
- **Nota:** verificar sinergia con `ItemWarehouseAccounts` (cuentas por
  almacén) y con el módulo de revalorización G2 (comparten el motor de
  actualización de costos).

### G2 — Revalorización de artículos (por cantidad y por valor) ☐ · Prioridad ALTA

- **Qué falta:** el dato maestro deja claro que el costo NO se edita a mano
  ("se calcula por operaciones o revalorización futura" — ver ROADMAP DT.28);
  esa "revalorización futura" no existe aún.
- **Alcance esperado:**
  - **Por cantidad:** ajuste del costo unitario/cantidad valorizada de un
    artículo (o artículo+almacén+lote) cuando se detecta diferencia física o
    de registro.
  - **Por valor:** actualización del costo promedio / valor de inventario
    (p. ej. diferencia de cambio en mercadería importada, correcciones,
    gastos capitalizados).
- **Aceptación sugerida:**
  - Documento de revalorización con motivo, artículo(+almacén/lote), cantidad
    y costo nuevo; cálculo del delta valorizado.
  - Actualización de `avgCost`/stock valorizado + kardex con tipo de
    movimiento propio.
  - Asiento contable automático con cuentas configurables (y respetando el
    motor de determinación de cuentas por jerarquía).
  - Reversa/cancelación del documento sin romper promedios posteriores.
- **Relación:** comparte motor con G1; coordinar para no duplicar la
  actualización de costos.

### G3 — Módulo de Producción (potenciar) ☐ · Prioridad MEDIA

- **Estado actual:** existe el circuito de **ensamblaje** (Kits + BOMs +
  `AssemblyOrder` → asiento propio vía `AccountingEngine`), útil para
  producto terminado simple.
- **Qué falta (potenciar):**
  - Órdenes de fabricación con **múltiples componentes** y producto final
    (hoy el ensamblaje es 1 kit → 1 final).
  - **Costeo multi-nivel** (subensambles), mermas/desperdicio y subproductos.
  - Planificación simple (explosión de BOM, necesidades contra stock).
- **Aceptación sugerida:** ampliar `AssemblyOrder` o modelo nuevo
  `ProductionOrder` con líneas de componentes (cantidad, costo) y salida de
  producto(s); costeo por nivel y asientos de producción consistentes con el
  plan contable BO; UI acorde a los patrones LUNA de documentos con líneas.

### G4 — Módulo de Servicios (potenciar) ☐ · Prioridad MEDIA

- **Estado actual:** hay **líneas de servicio** (artículos de servicio,
  líneas de cuenta `isAccountLine`) dentro de facturas/pedidos.
- **Qué falta:**
  - Órdenes de servicio / OT (apertura, asignación, avance, cierre).
  - Contratos de servicio / suscripciones con facturación recurrente.
- **Aceptación sugerida:** decidir con el usuario si el servicio es
  "producto sin stock" (ya soportado) o requiere ciclo de vida OT/contrato.
  En el segundo caso, plan propio con estado y facturación.

### G5 — Documentación canónica desactualizada ✅ (2026-09-08)

- **Hallazgo:** `AGENTS.md` y `ROADMAP.md` listan como **pendientes** módulos
  que **ya existen**: Activos Fijos (`fixed-assets`, con depreciación),
  Conciliación Bancaria (`bank-reconciliation`) y Revaluación por diferencia
  de cambio (`exchange-rate-adjustments`). La fecha de cabecera del ROADMAP
  (2026-09-05) y de AGENTS (2026-08-08) no reflejan el estado real.
- **Aceptación:** revisar y marcar como ✅ los módulos existentes, actualizar
  las fechas y el bloque "Próximos pasos" de AGENTS.md.
- **Cierre (2026-09-08, T33):** AGENTS.md — fecha a 2026-09-08, §5.7 filas
  8–11 marcadas ✅ con referencias a los módulos (`fiscal-years`,
  `exchange-rate-adjustments`, `bank-reconciliation`, `fixed-assets`), §8
  "Próximos pasos" reescrito (apunta al plan de gaps; F5.2 integración →
  conector SAP F5.3). ROADMAP.md — header intruso "Features de negocio
  pendientes" reubicado sobre la tabla real, filas DT.51/DT.52 reintegradas a
  la tabla de deuda, F7.2 marcada ✅ (ya completada) y pie con fecha 2026-09-08.

---

## 2. Deuda técnica / hallazgos de la sesión

### D1 — Borradores: migrar a "foto completa" (snapshot) en vez de hidratación manual ✅ (2026-09-09, T37) · Prioridad ALTA

- **Evidencia (T32, T32b, T32c):** cuatro bugs encadenados del ciclo
  guardar → listar → recuperar (cliente no restaurado, total con IVA
  duplicado, código de artículo perdido, price-check con falso positivo +
  doble descuento en "Actualizar precios"). Causa de fondo: cada form
  re-hidrata el borrador a mano (`hydrateFromDraft`, builders por form,
  resoluciones contra catálogos paginados), en vez de guardar y restaurar la
  misma estructura que produce el formulario.
- **Propuesta:** el borrador persiste el **payload serializado del documento**
  (lo que el form enviaría al crear) y al recuperar se construye con el MISMO
  camino que crea el documento nuevo (un solo `buildLineGroup`/builder por
  docType, sin parches por form). Esto elimina la clase entera de bugs y
  simplifica `saveAsDraft`/`hydrateFromDraft`.
- **Aceptación:** T32/T32b/T32c cubiertos por E2E (ya existen
  `qa-document-drafts.spec.ts`) + prueba manual de borrador viejo (pre-fix)
  recuperado correctamente; ningún form con lógica de hidratación propia.

- **Cierre (2026-09-09, T37):** auditoría con evidencia — el patrón snapshot
  ya está implementado de punta a punta (los fixes T32/T32b/T32c lo adoptaron):
  (A) **frontend:** una sola base `CommercialDocumentFormBase.saveAsDraft`
  persiste el payload serializado del documento (getRawValue + líneas + total
  con la MISMA fórmula del form) y `hydrateFromDraft` restaura por un único
  camino genérico (`restoreDraftParty` → `patchValue` → líneas vía un solo
  `buildLineFromDraft` → `resolveItemIdentityOnHydrate` → price-check); 1 solo
  override en los 14 forms (purchase-invoices `afterHydrateFromDraft`).
  (B) **backend:** `DraftConversionService.convert` + mapa `CONVERTERS`
  (14/14 docTypes, 1:1 con los docTypes de borrador del frontend) — un solo
  camino de conversión por docType. (C) los 14 forms tienen ≥1 control
  `itemCode` (base T32b). **Regresión en verde:** `qa-document-drafts.spec.ts`
  4/4 + `qa-multitienda.spec.ts` 9/9 chromium (12/12). **Fix de
  infraestructura E2E anexo (root cause de la regresión):** `auth.setup.ts`
  acuñaba el JWT con `exchangeRateRequired=true` cuando el día cambió y la
  tasa aún no se ingresaba (el seed no la crea por diseño y
  `reuseExistingServer` evita re-seed); como GET /auth/me devuelve el payload
  del JWT sin recalcular, el `exchangeRateGuard` redirigía TODA la suite a
  /exchange-rates. Ahora el setup garantiza la tasa del día ANTES del login
  (helper idempotente `ensureTodayExchangeRate`). **Residuales tipados
  resueltos (2026-09-09):** los tres `as any` de los mappers de flujo de
  sale-reserve-invoices se eliminaron sin cambio de comportamiento —
  `buildLineFromDraft(line as any)` (pedido→reserva) sobraba porque
  `DraftLineResult` (index signature `[extra: string]: unknown`) es asignable
  a `Record<string, unknown>`; y `buildDeliveryLine(line as any)` /
  `buildQuotationLine(line as any)` (entrega→reserva y cotización→reserva)
  tenían parámetros anónimos con campos requeridos que el mapper genérico no
  garantizaba → cada builder se tipó con la interfaz de línea de SU propio
  mapper (`DeliveryReserveInvoiceDraftLine` / `QuotationReserveInvoiceDraftLine`),
  cuerpo intacto, callback con downcast tipado. Cero `as any` en
  `sale-reserve-invoices-form.component.ts`. Typecheck OK, unit 10/10. E2E
  ventas→FRV intentado pero bloqueado por entorno (dev con Gestión 2026
  cerrada; journey specs con fecha de hoy) — no regresión del cambio.

### D2 — Costeo/validación de líneas duplicado entre servicios ✅ (2026-09-08, T36)

- **Evidencia:** el patrón "recálculo de costo promedio por línea + validación
  de almacén de línea + propagación" se repite en delivery-orders,
  sale-invoices, sale-reserve-invoices, returns, credit-notes y el lado de
  compras, con variaciones sutiles (origen de estos bugs en DT.37/DT.40).
- **Propuesta:** extraer un helper/`DocumentLineService` compartido
  (actualización de `avgCost`, `validateLineWarehouseAssignment`,
  propagación) usado por todos los servicios, como ya se hizo con
  `assertWarehousesInBranch` y `discount-propagation.util.ts`.
- **Aceptación:** mismo comportamiento observado (sin cambios de API) con
  tests de regresión de las suites de ventas/compras; sin `as any`.
- **Cierre (2026-09-08, T36):** auditoría con subagente de los 8 servicios
  grandes (sale-invoices, delivery-orders, sale-reserve-invoices,
  purchase-invoices, purchase-receipts, sales-returns, purchase-returns,
  sales-credit-notes, purchase-credit-notes). **Conclusión con evidencia:** la
  centralización de primitivas YA es suficiente — `getAvgCost` (78
  call-sites), `resolveUnitCost`, `validateDocumentLineTracking` +
  `syncDocumentLineTracking` (los 8 servicios), `validateDocumentLinesWarehouseAssignment`
  + `assertWarehousesInBranch` (~40 flujos), `calcLineWithIndicator`,
  `prorateLineAmounts`, `resolveLineTaxIndicator`, `computeConditionalTotal`/
  `recalcTotalsFromPersistedLines` (adoptados en sale-invoices, delivery,
  reserves, purchase-invoices). Un `DocumentLineService` global transversal
  sería refactor masivo de alto riesgo: los bloques repetidos (~582-634 y
  equivalentes) se repiten DENTRO de servicios de 5-7k líneas a lo largo de 8
  flujos legítimamente distintos, y la regla de costo difiere por familia
  deliberadamente (ventas = promedio; compras = `priceNet` NIC 2; retornos =
  copia del costo origen). **Acción ejecutada:** los únicos rezagados eran los
  totales condicionales hand-rolled (`hasCost/hasWeight + reduce`) →
  adoptados `recalcTotalsFromPersistedLines` + `computeConditionalTotal` en
  sales-returns, purchase-returns y purchase-receipts (3 bloques). Mismo
  resultado, cero API nueva. Unit 26/26 (3 suites) + typecheck/build OK.
  **Mejora futura documentada (no bloqueante):** builder compartido de líneas
  para el par de NC (sales/purchase-credit-notes ~170 líneas casi literales) y
  retornos (P1/P2) con ~4 variaciones de negocio a parametrizar — requiere
  tests de regresión de NC/retornos antes de tocar código. **Plan de alcance
  (T38–T39, P1+P2 ejecutados 2026-09-09):**
  `docs/plans/plan-builder-lineas-nc-retornos.md`.

### D3 — Auditoría de settings "huérfanos" ✅ (2026-09-08, T35)

- **Evidencia:** `enableBranches` existía en Ajustes y en `AppSettings` sin
  gobernar ninguna UI hasta T32h (se conectó hoy). Sospecha fundada de más
  flags con efecto parcial o nulo (p. ej. `enableWarehouseRestriction`,
  `enableSapIntegration` y otros).
- **Propuesta:** tabla de trazabilidad settings → dónde se lee en frontend y
  backend; marcar huérfanos y decidir: implementar el efecto, ocultar el
  switch o eliminarlo.
- **Aceptación:** documento/matriz con cada flag y su consumo real; cero
  switches en Ajustes sin efecto documentado.
- **Cierre (2026-09-08, T35):** auditoría de los **27 flags** de `AppSettings`
  (frontend + backend, con subagentes de grep y verificación cruzada). Matriz
  completa documentada abajo. **Hallazgo accionable:** `exportCreditAttributionPct`
  tenía efecto real (Form 200, exportaciones, `reports.service.ts:1438`) pero
  NO era parametrizable — faltaba en el DTO del controller y en `saveAll`.
  Resuelto: campo agregado al `UpdateSettingsDto` (`@IsNumber @Min(0) @Max(100)`)
  + persistencia en `saveAll` + UI en Ajustes (sección Contabilidad) +
  `AppSettings`/form/patch/payload del frontend. Unit backend 16/16 (2 suites)
  y frontend settings.component 5/5; builds OK.
  **Conclusión del resto de la matriz:** no hay switches de Ajustes sin
  efecto real; los flags sin lectura en negocio frontend se consumen
  server-side (`enableBatchTracking`/`enableSerialTracking` →
  `document-stock.helper`; `allowStockOperationsWithoutCost` → stock-*;
  `enableWarehouseRestriction` → `warehouse-restriction.service`;
  `posConsolidateMinorSales`/`posMinorSalesThreshold`/`posGenericPartnerId` →
  `pos.service`/`pos-sessions`; `bankReconciliationMatch*` →
  `bank-reconciliation.service`; `fixedAssetsAutoDepreciation` → cron de
  activos fijos vía fila SystemSettings) o en el frontend
  (`enableBranches`/`enableSapIntegration`/`locale`/`posQuantityStep`).
  `localizationBoliviaEnabled` es vestigial (derivado de `countryCode`,
  deprecado en el código, sin lectores reales) — se documenta y se eliminó del
  `UpdateSettingsDto` (2026-09-09: el PUT ya no anuncia un campo que `saveAll`
  ignora); el GET sigue devolviéndolo derivado de `countryCode` (contrato de
  lectura intacto).

#### Matriz de consumo real (D3, 2026-09-08)

| Flag | Frontend (UI/negocio) | Backend (negocio) | Veredicto |
|---|---|---|---|
| `baseCurrency` | ✅ decenas de forms/listados | ✅ ~40 archivos | OK |
| `foreignCurrency` | ✅ cuentas/asientos/preview | ✅ asientos/rates/auth | OK |
| `enableBatchTracking` | — | ✅ `document-stock.helper.ts:271` | OK (server) |
| `enableSerialTracking` | — | ✅ `document-stock.helper.ts:336` | OK (server) |
| `allowStockOperationsWithoutCost` | — | ✅ stock-entries/exits/transfers/adjustments | OK (server) |
| `validateStockOnSalesOrder` | ✅ sales-orders-form:2301 | ✅ sales-orders.service:1734 | OK |
| `enableSapIntegration` | ✅ sidebar + ~17 forms | — | OK (frontend UI) |
| `enableBranches` | ✅ base comercial (T32h) | — (branchId siempre obligatorio, por diseño) | OK (frontend UI) |
| `accountDeterminationLevel` | — (flag del tenant) | ✅ engine vía columna Tenant/Item | OK (server, otra vía) |
| `timeZone` | ✅ tenant-date.service | ✅ ~30+ archivos | OK |
| `countryCode` | ✅ forms compra (BO) | ✅ builders/reportes/pos | OK |
| `locale` | ✅ tenant-date.service | — | OK (frontend) |
| `localizationBoliviaEnabled` | — (deriva de countryCode) | — (derivado, deprecado) | Vestigial — fuera del DTO de update (2026-09-09); GET lo sigue derivando |
| `defaultCalculationMethod` | — | ✅ sale/purchase-invoices | OK (server) |
| `enableWarehouseRestriction` | — | ✅ warehouse-restriction.service:28 | OK (server) |
| `exchangeRateGainAccountId` | ✅ exchange-rate-revaluation | ✅ journal-entry-core/adjustments | OK |
| `exchangeRateLossAccountId` | ✅ ídem | ✅ ídem | OK |
| `posConsolidateMinorSales` | — | ✅ pos.service:500 / pos-sessions:173 | OK (server) |
| `posMinorSalesThreshold` | — | ✅ pos.service:503 | OK (server) |
| `posGenericPartnerId` | — | ✅ pos.service:501 / pos-sessions:179 | OK (server) |
| `posQuantityStep` | ✅ pos.component:1021 | — | OK (frontend) |
| `exportCreditAttributionPct` | ✅ (nuevo, Ajustes) | ✅ reports.service:1438 | **Resuelto en T35** (antes sin UI/DTO) |
| `accountingEnabled` | ✅ guard/sidebar/conciliación | ✅ journal-entry-core:61 | OK |
| `fixedAssetsAutoDepreciation` | — | ✅ cron activos fijos (fila SS) | OK (server) |
| `journalEntryAutoExchangeDifference` | ✅ journal-entries-form:654 | ✅ journal-entries.service:474 | OK |
| `bankReconciliationMatchWindowDays` | — | ✅ bank-reconciliation:327 | OK (server) |
| `bankReconciliationMatchTolerance` | — | ✅ bank-reconciliation:328 | OK (server) |
| `branding` | ✅ tenant-branding.service (bootstrap) | — | OK |

### D4 — Copy y textos sin normalizar ✅ (2026-09-08, T34)

- **Evidencia:** "Almacen" vs "Almacén", "Seleccionar almacen..." (sales-
  returns), encabezados con espacios que obligan a aserciones parciales en
  E2E.
- **Propuesta:** pasada de copy/accentos en labels y placeholders; revisar
  los E2E que dependen de texto exacto.
- **Aceptación:** grep de acentos/typos conocidos en `pages/` y `shared/`;
  E2E con `toHaveText` donde hoy se usa `toContainText` por espacios.
- **Cierre (2026-09-08, T34):** "Almacen" → "Almacén" (labels/placeholders/
  titles) en assembly-orders, branch-form, item-form, item-detail, item-boms,
  purchase-requests, purchase-returns, sales-returns, stock-entries/exits/
  adjustments/counts y stock-transfers ("Almacén Origen/Destino");
  "articulo"/"Fisico"/"Debito"/"Credito" → acentuados (item-boms,
  uom-conversions, item-price-histories, dashboard, warehouses,
  partner-detail); voseo rioplatense eliminado (incoming/outgoing-payments,
  hint de retenciones de purchase-invoices) → tuteo neutral consistente con
  el resto. Ningún E2E/spec dependía de los textos previos (verificado por
  grep). Unit 7 forms en verde + build AOT OK. La parte de "headers con
  espacios → toHaveText" se descarta como no-acción: son indentación normal
  del template y los E2E ya usan `toContainText` con éxito.

### D5 — Estado de la deuda de UX/cosmética ya conocida (referencia) ✅/🔄

- Residual ya documentado en ROADMAP (tokens de altura, `::ng-deep`,
  budget del POS 35.35 kB sobre 35.00 kB) — se deja constancia aquí para no
  perderlo; no requiere acción nueva.

---

## 3. Priorización sugerida (orden de trabajo)

| Orden | Ítem | Tipo | Justificación |
|---|---|---|---|
| ~~1~~ | ~~**D1 borradores snapshot**~~ | Deuda técnica | ✅ Cerrado (2026-09-09, T37) — el patrón snapshot ya estaba implementado (T32/T32b/T32c); auditoría con evidencia + regresión E2E 12/12 en verde; fix de orden en `auth.setup.ts` (tasa del día antes del login) |
| 2 | **G1 Precios de Entrega / Landing Cost** | Negocio | El usuario lo pidió explícitamente (importaciones) |
| 3 | **G2 Revalorización de artículos** | Negocio | El usuario lo pidió explícitamente; comparte motor con G1 |
| ~~4~~ | ~~**G5 Doc canónica desactualizada**~~ | Mantenimiento | ✅ Cerrado (2026-09-08, T33) — AGENTS.md + ROADMAP.md al día |
| ~~5~~ | ~~**D2 costeo duplicado backend**~~ | Deuda técnica | ✅ Cerrado (2026-09-08, T36) — auditoría: primitivas ya centralizadas; totales hand-rolled adoptan helper compartido en returns/receipts |
| ~~6~~ | ~~**D3 settings huérfanos**~~ | Deuda técnica | ✅ Cerrado (2026-09-08, T35) — matriz 27 flags + exportCreditAttributionPct parametrizable |
| 7 | **G3 Producción / G4 Servicios** | Negocio | Requieren definición de alcance con el usuario |
| ~~8~~ | ~~**D4 copy normalizado**~~ | Cosmético | ✅ Cerrado (2026-09-08, T34) — acentos + voseo normalizados |

---

## 4. Criterios de cierre (generales)

- Todo cambio de schema: migración Prisma + SQL manual si hay drift (patrón
  existente `prisma/manual/`) + `npm run generate-types`.
- Tests: unitarios por módulo + E2E autolimpiante cuando aplique; cero
  `as any` en código de producción.
- Multi-tenancy: todo modelo nuevo con `tenantId` + `@@index([tenantId])`.
- Al cerrar cada ítem: fila en `AUDIT.md`, nota en el CHANGELOG de la capa y
  marca `✅` aquí con fecha.

---

*Última actualización: 2026-09-09 (cierre G5 y D1–D4 — T33–T37).*
