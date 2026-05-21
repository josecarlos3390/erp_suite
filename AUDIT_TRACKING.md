# 📋 AUDITORÍA ERP SUITE — Tracking de Acciones

> Documento vivo para trackear hallazgos de auditoría y su estado.  
> Actualizado: 21/05/2026

---

## 🔴 FASE 1 — Seguridad & Estabilidad (En Progreso)

### 1.1 Migrar `findUnique` sin `tenantId` → `findFirst({ id, tenantId })`
**Status:** `🔄 In Progress`  
**Nota:** Se arregló `confirm()` en `stock-entries` y `stock-exits` para pasar `tenantId` a `findOneInternal`. Quedan los demás casos por revisar.  
**Riesgo:** CRÍTICO — Cross-tenant data leak  
**Archivos afectados:** 34 ocurrencias en 15+ servicios  

| # | Archivo | Línea | Query | ¿Seguro? | Status |
|---|---------|-------|-------|----------|--------|
| 1 | `accounts.service.ts` | 29 | `account.findUnique({ id: parentId })` | ⚠️ Revisar | 🔲 |
| 2 | `delivery-orders.service.ts` | 2166 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 3 | `sale-reserve-invoices.service.ts` | 1587 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 4 | `sale-reserve-invoices.service.ts` | 3615 | `taxIndicator.findUnique({ id: taxIndId })` | ⚠️ Revisar | 🔲 |
| 5 | `outgoing-payments.service.ts` | 692 | `bank.findUnique({ id: dto.bankId })` | ⚠️ Revisar | 🔲 |
| 6 | `outgoing-payments.service.ts` | 1065 | `partner.findUnique({ id: partnerId })` | ⚠️ Revisar | 🔲 |
| 7 | `sales-orders.service.ts` | 1216 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 8 | `sales-orders.service.ts` | 1459 | `salesOrder.findUnique({ id: orderId })` | ⚠️ Revisar | 🔲 |
| 9 | `sales-orders.service.ts` | 2243 | `partner.findUnique({ id: partnerId })` | ⚠️ Revisar | 🔲 |
| 10 | `sale-invoices.service.ts` | 1406 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 11 | `sale-invoices.service.ts` | 2851 | `taxIndicator.findUnique({ id: taxIndId })` | ⚠️ Revisar | 🔲 |
| 12 | `purchase-returns.service.ts` | 134 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 13 | `sales-credit-notes.service.ts` | 102 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 14 | `sales-returns.service.ts` | 134 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 15 | `purchase-invoices.service.ts` | 353 | `taxIndicator.findUnique({ id: lineTaxIndId })` | ⚠️ Revisar | 🔲 |
| 16 | `purchase-invoices.service.ts` | 1235 | `taxIndicator.findUnique({ id: siTaxIndId })` | ⚠️ Revisar | 🔲 |
| 17 | `purchase-invoices.service.ts` | 1417 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 18 | `purchase-invoices.service.ts` | 2296 | `taxIndicator.findUnique({ id: existing.taxIndicatorId })` | ⚠️ Revisar | 🔲 |
| 19 | `purchase-invoices.service.ts` | 3278 | `taxIndicator.findUnique({ id: mqTaxIndId })` | ⚠️ Revisar | 🔲 |
| 20 | `purchase-credit-notes.service.ts` | 107 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 21 | `incoming-payments.service.ts` | 690 | `bank.findUnique({ id: dto.bankId })` | ⚠️ Revisar | 🔲 |
| 22 | `incoming-payments.service.ts` | 1138 | `partner.findUnique({ id: partnerId })` | ⚠️ Revisar | 🔲 |
| 23 | `stock-entries.service.ts` | 73 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 24 | `purchase-receipts.service.ts` | 582 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 25 | `stock-adjustments.service.ts` | 78 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 26 | `stock-transfers.service.ts` | 71 | `warehouse.findUnique({ id: sourceWarehouseId })` | ⚠️ Revisar | 🔲 |
| 27 | `stock-transfers.service.ts` | 72 | `warehouse.findUnique({ id: targetWarehouseId })` | ⚠️ Revisar | 🔲 |
| 28 | `stock-transfers.service.ts` | 85 | `item.findUnique({ id: line.itemId })` | ✅ Relación validada | 🔲 |
| 29 | `stock-transfers.service.ts` | 108 | `warehouse.findUnique({ id: lineSourceWh })` | ⚠️ Revisar | 🔲 |
| 30 | `stock-transfers.service.ts` | 109 | `warehouse.findUnique({ id: lineTargetWh })` | ⚠️ Revisar | 🔲 |
| 31-34 | *(ver grep completo)* | | | | 🔲 |

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
**Status:** `🔲 Pendiente`  
**Riesgo:** ALTO — Tests E2E fallan  
**Archivo:** `e2e/items.spec.ts:83`  
**Problema:** `input[formControlName="cost"]` no visible en viewport móvil.  
**Posible causa:** Campo oculto por scroll o breakpoint.

---

## 🟡 FASE 2 — Estandarización Backend (Pendiente)

### 2.1 Extraer `DocumentTotalsHelper`
**Status:** `🔲 Pendiente`  
**Impacto:** Reduce God Services (delivery-orders 4,421 líneas, etc.)

### 2.2 Extraer `DocumentStockHelper` y `DocumentAccountingHelper`
**Status:** `🔲 Pendiente`

### 2.3 Auditoría `$queryRawUnsafe` en `reports.service.ts`
**Status:** `🔲 Pendiente`  
**Archivo:** `src/reports/reports.service.ts` (7 queries raw)

### 2.4 Paginación obligatoria en endpoints de reporte
**Status:** `🔲 Pendiente`

---

## 🟡 FASE 3 — Rendimiento Frontend (Pendiente)

### 3.1 Identificar librería en chunk de 207 KB
**Status:** `🔲 Pendiente`  
**Chunk:** `chunk-BLV6C4TC.js` (207 KB)

### 3.2 Buscar suscripciones sin `takeUntilDestroyed`
**Status:** `🔲 Pendiente`  
**Datos:** 680 `.subscribe()` en 139 archivos, 333 `takeUntilDestroyed` en 108 archivos.

### 3.3 Reducir CSS global (110 KB)
**Status:** `🔲 Pendiente`  
**Archivo:** `styles-VGXYYBKV.css`

---

## 🟢 FASE 4 — Estandarización Frontend (Pendiente)

### 4.1 Migrar `*ngIf` → `@if`
**Status:** `🔲 Pendiente`

### 4.2 Unificar `calculateLine` en 10 formularios comerciales
**Status:** `🔲 Pendiente`  
**Deuda documentada en AGENTS.md**

### 4.3 Estandarizar carga de catálogos (`forkJoin` + loading state)
**Status:** `🔲 Pendiente`

---

## 📈 Métricas Base

| Métrica | Valor | Fecha |
|---------|-------|-------|
| Backend suites passing | 57/62 (91.9%) | 21/05/2026 |
| Backend tests passing | 294/326 (90.2%) | 21/05/2026 |
| Frontend build size | 3.19 MB | 21/05/2026 |
| Frontend lint errors | 848 | 21/05/2026 |
| E2E tests passing | Timeout | 21/05/2026 |
| Backend services | 56 | 21/05/2026 |
| Largest service (lines) | delivery-orders.service.ts (4,421) | 21/05/2026 |
| Frontend `.subscribe()` count | 680 en 139 archivos | 21/05/2026 |
| Frontend `takeUntilDestroyed` | 333 en 108 archivos | 21/05/2026 |
| `findUnique` sin tenantId | 34 ocurrencias | 21/05/2026 |
| `$queryRawUnsafe` count | 56 | 21/05/2026 |
| Prisma indexes | 109 | 21/05/2026 |
| Prisma unique constraints | 52 | 21/05/2026 |
