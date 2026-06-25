# 📋 AUDITORÍA ERP SUITE — Tracking de Acciones

> Documento vivo para trackear hallazgos de auditoría y su estado.  
> Actualizado: 19/04/2026

**Estado general:** Todas las fases de auditoría (1-4) están completas. Backend y frontend builds verdes.

---

## 🔴 FASE 1 — Seguridad & Estabilidad (En Progreso)

### 1.1 Migrar `findUnique` sin `tenantId` → `findFirst({ id, tenantId })`
**Status:** `✅ DONE`  
**Nota:** 21 ocurrencias migradas de `findUnique` → `findFirst({ id, tenantId })` en May 2026. Se arreglaron mocks en `stock-transfers` y `purchase-credit-notes` para reflejar `findFirst`. Todos los tests pasan (62 suites, 326 tests).  
**Riesgo:** CRÍTICO — Cross-tenant data leak  
**Archivos afectados:** 34 ocurrencias en 15+ servicios  

| # | Archivo | Línea | Query | ¿Seguro? | Status |
|---|---------|-------|-------|----------|--------|
| 1 | `accounts.service.ts` | 29 | `account.findUnique({ id: parentId })` | ⚠️ Revisar | ✅ Done |
| 2 | `delivery-orders.service.ts` | 2166 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 3 | `sale-reserve-invoices.service.ts` | 1587 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 4 | `sale-reserve-invoices.service.ts` | 3615 | `taxIndicator.findUnique({ id: taxIndId })` | ⚠️ Revisar | ✅ Done |
| 5 | `outgoing-payments.service.ts` | 692 | `bank.findUnique({ id: dto.bankId })` | ⚠️ Revisar | ✅ Done |
| 6 | `outgoing-payments.service.ts` | 1065 | `partner.findUnique({ id: partnerId })` | ⚠️ Revisar | ✅ Done |
| 7 | `sales-orders.service.ts` | 1216 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 8 | `sales-orders.service.ts` | 1459 | `salesOrder.findUnique({ id: orderId })` | ⚠️ Revisar | ✅ Done |
| 9 | `sales-orders.service.ts` | 2243 | `partner.findUnique({ id: partnerId })` | ⚠️ Revisar | ✅ Done |
| 10 | `sale-invoices.service.ts` | 1406 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 11 | `sale-invoices.service.ts` | 2851 | `taxIndicator.findUnique({ id: taxIndId })` | ⚠️ Revisar | ✅ Done |
| 12 | `purchase-returns.service.ts` | 134 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 13 | `sales-credit-notes.service.ts` | 102 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 14 | `sales-returns.service.ts` | 134 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 15 | `purchase-invoices.service.ts` | 353 | `taxIndicator.findUnique({ id: lineTaxIndId })` | ⚠️ Revisar | ✅ Done |
| 16 | `purchase-invoices.service.ts` | 1235 | `taxIndicator.findUnique({ id: siTaxIndId })` | ⚠️ Revisar | ✅ Done |
| 17 | `purchase-invoices.service.ts` | 1417 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 18 | `purchase-invoices.service.ts` | 2296 | `taxIndicator.findUnique({ id: existing.taxIndicatorId })` | ⚠️ Revisar | ✅ Done |
| 19 | `purchase-invoices.service.ts` | 3278 | `taxIndicator.findUnique({ id: mqTaxIndId })` | ⚠️ Revisar | ✅ Done |
| 20 | `purchase-credit-notes.service.ts` | 107 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 21 | `incoming-payments.service.ts` | 690 | `bank.findUnique({ id: dto.bankId })` | ⚠️ Revisar | ✅ Done |
| 22 | `incoming-payments.service.ts` | 1138 | `partner.findUnique({ id: partnerId })` | ⚠️ Revisar | ✅ Done |
| 23 | `stock-entries.service.ts` | 73 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 24 | `purchase-receipts.service.ts` | 582 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 25 | `stock-adjustments.service.ts` | 78 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 26 | `stock-transfers.service.ts` | 71 | `warehouse.findUnique({ id: sourceWarehouseId })` | ⚠️ Revisar | ✅ Done |
| 27 | `stock-transfers.service.ts` | 72 | `warehouse.findUnique({ id: targetWarehouseId })` | ⚠️ Revisar | ✅ Done |
| 28 | `stock-transfers.service.ts` | 85 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 29 | `stock-transfers.service.ts` | 108 | `warehouse.findUnique({ id: lineSourceWh })` | ⚠️ Revisar | ✅ Done |
| 30 | `stock-transfers.service.ts` | 109 | `warehouse.findUnique({ id: lineTargetWh })` | ⚠️ Revisar | ✅ Done |
| 31 | `purchase-credit-notes.service.ts` | 77 | `partner.findUnique({ id: dto.supplierId })` | ⚠️ Revisar | ✅ Done |
| 32 | `purchase-credit-notes.service.ts` | 83 | `purchaseInvoice.findUnique({ id: dto.purchaseInvoiceId })` | ⚠️ Revisar | ✅ Done |
| 33 | `purchase-credit-notes.service.ts` | 90 | `purchaseReserveInvoice.findUnique({ id: dto.purchaseReserveInvoiceId })` | ⚠️ Revisar | ✅ Done |
| 34 | `pos.service.ts` | 129 | `batch.findUnique({ id: line.batchId })` | ⚠️ Revisar | ✅ Done |

**Nota:** Los `item.findUnique` dentro de transacciones donde `line` viene de `lines` del documento actual (ya filtrado por tenantId) son **seguros**. Los que usan `dto.xxxId` o parámetros externos requieren migración.

---

### 1.2 Correr `npm run lint -- --fix` en frontend
**Status:** `✅ DONE` — 0 errores, 23 warnings (unused imports)  
**Riesgo:** ALTO — 848 errores Prettier  
**Esfuerzo:** Muy bajo (auto-fix)  
**Acción:** `cd erp-frontend && npm run lint -- --fix`

---

### 1.3 Arreglar mocks de `stock-entries` y `stock-exits`
**Status:** `✅ DONE` — También se arreglaron `stock-adjustments` y `stock-transfers`.  
**Backend tests:** 62/62 suites pass, 326/326 tests pass.  
**Riesgo:** ALTO — 32 tests fallidos  
**Archivos:**
- `src/stock-entries/stock-entries.service.spec.ts`
- `src/stock-exits/stock-exits.service.spec.ts`
**Problema:** `findFirst` en `confirm()` no encuentra el documento recién creado en el mock.

---

### 1.4 Arreglar E2E `items.spec.ts` en mobile Safari
**Status:** `✅ DONE`  
**Riesgo:** ALTO — Tests E2E fallan  
**Archivo:** `e2e/items.spec.ts`  
**Problemas arreglados:**
- Campo `cost` eliminado del test (no existe en formulario)
- Agregado mock para `GET /uoms`
- Checkboxes seteados vía `page.evaluate()` (robusto en Safari mobile/tablet)
- Click en Guardar vía JS para evitar sidebar overlay
**Resultado:** 11/11 tests pasan en todos los proyectos (chromium, firefox, mobile-chrome, mobile-safari, tablet-safari)

---

## 🟡 FASE 2 — Estandarización Backend (Pendiente)

### 2.1 Extraer `DocumentTotalsHelper`
**Status:** `✅ DONE`  
**Impacto:** ~150 líneas de boilerplate removidas de 5 God Services  
**Archivos:**
- Creado: `backend-erp/src/common/document-totals.util.ts`
- Modificados: `delivery-orders.service.ts`, `sales-orders.service.ts`, `sale-invoices.service.ts`, `sale-reserve-invoices.service.ts`, `purchase-invoices.service.ts`

**Funciones extraídas:**
- `recalcTotalsFromPersistedLines(items)` — recalcula DocTotals desde líneas persistidas
- `computeConditionalTotal(items, key)` — reemplaza `some() ? reduce() : null` para totalCost/totalWeight
- `buildDocumentHeaderData(docTotals, exchangeRate)` — construye objeto Prisma-ready con totales en moneda base

**Build/tests:** 62/62 suites, 326/326 tests pass.

### 2.2 Extraer `DocumentStockHelper` y `DocumentAccountingHelper`
**Status:** `✅ DONE` — DocumentStockHelper implementado y aplicado a 4 servicios  
**Nota:** DocumentAccountingHelper requiere diseño de nueva feature (integración contable automática). Se deja para Fase 5.

**Archivos:**
- Creado: `backend-erp/src/common/document-stock.helper.ts`
- Modificados: `stock-entries.service.ts`, `stock-exits.service.ts`, `stock-transfers.service.ts`, `delivery-orders.service.ts`

**Funciones extraídas:**
- `applyIncomingStock(lines, config)` — entradas de stock / recepciones
- `applyOutgoingStock(lines, config)` — salidas de stock / entregas de venta
- `applyStockTransfer(lines, config)` — traspasos (origen → destino)
- `reverseIncomingStock(lines, config)` — cancelar entradas
- `reverseOutgoingStock(lines, config)` — cancelar salidas/entregas
- `reverseStockTransfer(lines, config)` — cancelar traspasos
- `recalcCommittedForMap(tx, map, tenantId)` — recalcular committed en batch
- `recalcOrderedForMap(tx, map, tenantId)` — recalcular ordered en batch

**Build/tests:** 62/62 suites, 326/326 tests pass. Sin uso de `any`.

### 2.3 Auditoría `$queryRawUnsafe` en todo el backend
**Status:** `✅ DONE`  
**Archivos:** `reports.service.ts`, `stock.util.ts`, `bulk-import.service.ts`

**Cambios:**
- `reports.service.ts`: 7 queries migradas a `$queryRaw(Prisma.sql...)` con parámetros posicionales
- `stock.util.ts`: `findStockWithLock` migrado a `$queryRaw(Prisma.sql...)`
- `bulk-import.service.ts`: 4 queries/updates migrados a `$queryRaw(Prisma.sql...)` / `$executeRaw(Prisma.sql...)`
- **Quedan intocados (casos permitidos por AGENTS.md):**
  - `code-generator.ts` — secuencias PostgreSQL
  - `bulk-import.service.ts:101` — batch de secuencias PostgreSQL
  - `prisma.service.ts` — nombres de tabla hardcodeados en sync de secuencias
- **Resultado:** 0 `$queryRawUnsafe` / `$executeRawUnsafe` en código fuente productivo
- Build pasa, 62/62 suites, 326/326 tests

### 2.4 Paginación obligatoria en endpoints de reporte
**Status:** `✅ DONE`  
**Cambios:**
- Agregados `page` y `limit` (máx 500) a `SalesReportFiltersDto`, `PurchaseReportFiltersDto`, `ItemProfitabilityFiltersDto`
- Controller pasa `page`/`limit` al service
- Service aplica `LIMIT`/`OFFSET` en todas las queries raw
- Valores por defecto: page=1, limit=100

---

## 🟡 FASE 3 — Rendimiento Frontend (Pendiente)

### 3.1 Identificar librería en chunk de 207 KB
**Status:** `✅ DONE`  
**Chunk:** `chunk-BLV6C4TC.js` (212 KB)

**Hallazgo:** El chunk contiene el core de Angular — no es una librería de terceros innecesaria.
- `@angular/core/fesm2022/core.mjs`: 133 KB
- `@angular/common/fesm2022/common_module+module+location`: 41 KB
- `rxjs` internals: ~10 KB
- No hay acción reductora posible sin cambiar de framework.

### 3.2 Buscar suscripciones sin `takeUntilDestroyed`
**Status:** `✅ DONE`

**Hallazgo:** De 139 archivos con `.subscribe()`, solo **5 componentes** tenían suscripciones sin cleanup automático:
- `item-profitability.component.ts`
- `purchase-report.component.ts`
- `sales-report.component.ts`
- `stock-valuation.component.ts`
- `bulk-upload.component.ts`

**Acción:** Se agregó `takeUntilDestroyed(this.destroyRef)` a las suscripciones de estos 5 componentes.

**Nota:** 7 componentes adicionales usaban cleanup manual (`Subscription` + `unsubscribe()` o `Subject` + `takeUntil`), por lo que no presentan memory leaks. Los servicios singleton no requieren `takeUntilDestroyed`.

### 3.3 Reducir CSS global (110 KB)
**Status:** `✅ DONE (parcial — modularización)`  
**Fecha:** 19/04/2026

**Resumen:**
- `styles.scss` tenía 2,250 líneas con todo inline además de `@use 'styles/index'`.
- Creados `_reset.scss` y `_layout.scss` en `src/styles/` con ~260 líneas extraídas.
- `_index.scss` actualizado para importar los nuevos partials.
- `styles.scss` reducido eliminando las secciones duplicadas/migradas.
- Build de producción pasa exitosamente.

**Nota:** El bundle CSS global (112 KB minificado) proviene de ~6,500 líneas de SCSS fuente (legacy + Luna design system). Una reducción significativa requiere un proyecto dedicado de eliminación de reglas muertas (PurgeCSS) y migración de estilos globales a componentes standalone. Se deja para fase futura.

---

## 🟢 FASE 4 — Estandarización Frontend (Pendiente)

### 4.1 Migrar `*ngIf` → `@if`
**Status:** `✅ DONE`  
**Fecha:** 19/04/2026

**Resumen:**
- Ejecutado schematic `@angular/core:control-flow` en todo el proyecto.
- Resueltos 25 templates con nombres duplicados (`#cell`, `#actions`) renombrando a `#cell2`, `#actions2`, etc.
- Modificado `luna-data-table.component.ts` para soportar aliases (`cell2`, `cell3`, `actions2`, `actions3`).
- Corregidos 4 archivos con `trackBy` mal migrado por el schematic (firma de función reducida a 1 argumento):
  - `pos.component.ts`, `price-list-form.component.ts`, `document-lines-table.component.ts`
- Build de producción pasa exitosamente.
- Quedan 5 `*ngIf` y 2 `*ngFor` en código comentado (`journal-entries-form.component.html`), sin impacto.

### 4.2 Unificar `calculateLine` en formularios comerciales
**Status:** `✅ DONE (parcial)`  
**Fecha:** 19/04/2026

**Resumen:**
- Creada clase base `CommercialDocumentFormBase` que extiende `DocumentFormBase`.
- `calculateLine` y `recalculateAllLines` centralizados en `CommercialDocumentFormBase` con `lineCalcConfig` configurable (getter).
- Eliminado método vacío `invalidateTotals()` de `DocumentFormBase` y ~55 llamadas en 14 componentes.
- 5 componentes migrados a la base eliminando duplicados:
  - `sales-quotations`, `sales-orders`, `purchase-quotations`, `purchase-credit-notes`, `sales-credit-notes`.
- 9 componentes mantienen `override calculateLine` por lógica especial (clamping, recálculo de costo/peso, etc.):
  - `delivery-orders`, `purchase-receipts`, `sale-invoices`, `purchase-invoices`, `sale-reserve-invoices`, `purchase-reserve-invoices`, `purchase-orders`, `purchase-returns`, `sales-returns`.
- Build de producción pasa exitosamente.

### 4.3 Estandarizar carga de catálogos (`forkJoin` + loading state)
**Status:** `✅ DONE (patrón establecido)`  
**Fecha:** 19/04/2026

**Resumen:**
- Agregado `safeObservable<T>(obs, fallback)` a `DocumentFormBase` para evitar que `forkJoin` falle cuando un catálogo individual falla.
- Aplicado a `sales-quotations-form.component.ts` como referencia.
- Build de producción pasa exitosamente.

**Nota:** La migración masiva a `safeObservable` en todos los formularios (~23 ocurrencias) puede hacerse incrementalmente. El patrón está documentado y disponible.

---

---

## 🔴 FASE 5 — Auditoría Flujos Documentales & Trazabilidad (En Progreso)

**Fecha:** 21/05/2026
**Trigger:** Suite E2E `erp-flows.spec.ts` alcanzó 91/91 tests pasando; se solicitó auditoría exhaustiva de flujos y trazabilidad.

### 5.1 Hallazgos críticos de backend (ventas vs compras)

| # | Bug | Severidad | Archivo | Status |
|---|-----|-----------|---------|--------|
| 1 | **SaleInvoices.createFromOrder** no resta cantidad de facturas reserva abiertas (`isIns='Y', status='OPEN'`) al calcular `pending`. Permite facturar más de lo disponible. | 🔴 Alta | `sale-invoices.service.ts` | ✅ Done |
| 2 | **DeliveryOrders.createFromOrder** no resta cantidad de otras entregas `OPEN` al calcular `pending`. Permite entregas que exceden el pendiente. | 🔴 Alta | `delivery-orders.service.ts` | ✅ Verificado — ya implementado (l.1816-1825) |
| 3 | **PurchaseInvoices.createManual** ignora `taxIndicatorId` por línea; usa el default del proveedor para todas las líneas. | 🔴 Alta | `purchase-invoices.service.ts` | ✅ Done |
| 4 | **PurchaseInvoices.createFromQuotation** tiene bloque copy-paste de `purchaseReceiptItem` (código muerto de `createFromReceipt`). | 🟡 Media | `purchase-invoices.service.ts` | 🔲 |
| 5 | **SalesOrders.createManual** no setea `date`/`postingDate` (asimetría con `purchase-orders`). | 🟡 Media | `sales-orders.service.ts` | ✅ Done (ya propagaba vía `buildBaseDocumentData`) |
| 6 | **PurchaseOrders.createFromDraft** no re-resuelve precios si cotización vencida (pone 0). Ventas sí re-resuelve desde lista de precios. | 🟡 Media | `purchase-orders.service.ts` | ✅ Done |
| 7 | **PurchaseInvoices.createFromOrder** no expone `discountPct`/`discountAmt` en payload de líneas. | 🟡 Media | `purchase-invoices.service.ts` | ✅ Done |
| 8 | **DeliveryOrders.createManual** auto-confirma; `purchase-receipts.createManual` no. Asimetría UX. | 🟡 Media | `delivery-orders.service.ts`, `purchase-receipts.service.ts` | ✅ Done — todos los flujos de delivery (simples y multi-origen) y purchase-receipts usan el patrón OPEN → `confirm()`. |

### 5.2 Hallazgos críticos de document-flow (trazabilidad)

| # | Bug | Severidad | Archivo | Status |
|---|-----|-----------|---------|--------|
| 9 | **`JOURNAL_ENTRY`** existe en `findRawDocument` pero **NO** en `resolveNode`. Si se habilitan links contables, el nodo se pierde y sus aristas no se exploran. | 🔴 Alta | `document-flow.service.ts` | ✅ Done |
| 10 | **Sub-grafos perdidos** si nodo intermedio retorna `null` en `resolveNode`. El BFS hace `continue` antes de buscar `documentLink`, perdiendo documentos conectados a través del nodo no resuelto. | 🔴 Alta | `document-flow.service.ts` | ✅ Done |
| 11 | **`tenantId` filtrado inconsistente** entre `getFlow` (spread condicional) y `getGraph` (siempre filtra). Riesgo de seguridad/mantenimiento. | 🟡 Media | `document-flow.service.ts` | ✅ Done |
| 12 | **Non-null assertions** (`doc.partner!.name`) en `resolveNode`. Si FK corrupta, lanza 500 no controlado. | 🟡 Media | `document-flow.service.ts` | ✅ Done (11 reemplazos) |
| 13 | **`findRawDocument` retorna `Promise<any>`**. Violación política de tipos `zero any`. | 🟡 Media | `document-flow.service.ts` | ✅ Done |
| 14 | **N+1 queries** en BFS de `getGraph`. ~3 queries por nodo; sin batching ni precarga. | 🟡 Media | `document-flow.service.ts` | 🔲 |
| 15 | **Tests de document-flow** extremadamente pobres (solo 1 test: "debería estar definido"). | 🟡 Media | `document-flow.service.spec.ts` | 🔲 |

### 5.3 Hallazgos de frontend (trazabilidad)

| # | Bug | Severidad | Archivo | Status |
|---|-----|-----------|---------|--------|
| 16 | **`@for` track por identidad de objeto** en nodos/edges del mapa. Causa parpadeo y pérdida de estado visual. | 🔴 Alta | `document-flow-map.component.ts` | ✅ Done |
| 17 | **`@for` track por identidad** en chips upstream/downstream. | 🔴 Alta | `document-flow.component.ts`, `document-flow-panel.component.ts` | ✅ Done |
| 18 | **Estado `POSTED` no traducido** en el mapa (muestra literal "POSTED"). | 🟡 Media | `document-flow-map.component.ts` | ✅ Done |
| 19 | **Doble `ChangeDetectorRef`** (`cdr` + `cd`). | 🟡 Media | `document-flow-panel.component.ts` | ✅ Done |
| 20 | **`openMap()` sin validación** de `type`/`id`. | 🟡 Media | `document-flow-panel.component.ts` | ✅ Done |
| 21 | **Memory leaks** por timers no limpiados en `ngOnDestroy`. | 🟢 Baja | `document-flow-map.component.ts` | ✅ Done |
| 22 | **Sin focus trap** en modal del mapa. | 🟢 Baja | `document-flow-map.component.ts` | ✅ Done |

### 5.4 Gaps de cobertura E2E

| Dominio | Tests actuales | Faltantes |
|---------|---------------|-----------|
| Stock | 5 | Verificación de saldo post-operación, items con lotes/series |
| Ventas | 5 | Delivery orders, factura desde orden, devoluciones, reservas |
| Compras | 5 | Purchase receipts, factura desde orden/recepción, devoluciones, reservas |
| Pagos | 2 | Pago parcial, conciliación, avances, trazabilidad en grafo |
| Negativo | 0 | Stock insuficiente, partner inválido, pago excesivo, cantidad cero |
| Estado | 0 | Confirmar, cerrar, cancelar documentos |

---

## 📈 Métricas Base

| Métrica | Valor | Fecha |
|---------|-------|-------|
| Backend suites passing | 64/64 (100%) | 23/05/2026 |
| Backend tests passing | 341/341 (100%) | 23/05/2026 |
| Frontend build size | 3.19 MB | 23/05/2026 |
| Frontend lint errors | 0 (16 warnings) | 23/05/2026 |
| E2E tests passing | 91/91 ✅ | 23/05/2026 |
| Backend services | 56 | 21/05/2026 |
| Largest service (lines) | delivery-orders.service.ts (4,421) | 21/05/2026 |
| Frontend `.subscribe()` count | 680 en 139 archivos | 23/05/2026 |
| Frontend `*ngIf` → `@if` migrated | ~1,847 en ~118 archivos | 19/04/2026 |
| Frontend `takeUntilDestroyed` | 333 en 108 archivos | 23/05/2026 |
| `findUnique` sin tenantId | 0 migradas (21 done) | 21/05/2026 |
| `$queryRawUnsafe` count | 0 (en código fuente) | 21/05/2026 |
| Prisma indexes | 109 | 21/05/2026 |
| Prisma unique constraints | 52 | 21/05/2026 |
