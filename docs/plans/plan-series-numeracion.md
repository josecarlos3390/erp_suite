# Plan — Series de Numeración de Documentos (patrón SAP B1)

> **Fecha:** 2026-09-02 · **Estado:** Backend Fase 1 (VENTAS) implementado y verificado en vivo.
> **Objetivo:** poder gestionar varias series de correlativo por tipo de documento, cada una
> acotada a un rango de fechas (período/gestión). Ej.: gestión 2025 → serie COT-2025 con
> COT-250000001…; gestión 2026 → serie COT-2026 con COT-260000001…; asignar una serie por
> defecto a cada usuario; heredar el correlativo de una gestión anterior al crear la siguiente.

---

## 1. Decisión de diseño (validada con el usuario)

1. **Alcance Fase 1:** flujo completo de VENTAS — cotizaciones, pedidos, entregas, facturas,
   facturas de reserva, devoluciones, NC, ND y pagos recibidos.
2. **Enlace al período:** cada serie define su **rango de fechas propio**
   (`startDate`/`endDate`) y opcionalmente referencia el `FiscalYear`/`AccountingPeriod`
   existente (para reportes y bloqueo al cerrar).
3. **Asignación:** serie por defecto **por usuario** (UserDocumentSeries) + serie default del
   tenant por tipo; el formulario de documento muestra la serie aplicable con opción de cambiarla.
4. **Compatibilidad / exigencia:** si un tipo de documento **no tiene series configuradas**,
   se usa el generador clásico actual (secuencia por tenant) — cero regresión. Si el tipo
   **sí tiene series activas**, TODO documento debe caer en una serie que cubra la fecha del
   documento; si ninguna cubre → error claro (exigir serie siempre).

## 2. Modelo de datos (Prisma)

| Modelo | Campos clave | Notas |
|---|---|---|
| `DocumentSeries` | tenantId, docType (enum DocumentType), code (ej. COT-2025), name, prefix (COT), startNumber (250000001), nextNumber (correlativo vivo), endNumber?, startDate, endDate, isDefault, isActive, fiscalYearId?, accountingPeriodId? | `@@unique([tenantId, docType, code])`; `nextNumber` inicia en `startNumber` y se incrementa atómicamente por documento. |
| `UserDocumentSeries` | tenantId, userId, docType, documentSeriesId | `@@unique([tenantId, userId, docType])` — un usuario tiene UNA serie por tipo. |

Migraciones: `20260903000000_document_series` (tablas) y `20260903010000_document_series_doc_links`
(columna `documentSeriesId Int?` en los 8 headers de venta: SalesQuotation, SalesOrder,
DeliveryOrder, SaleInvoice, SalesReturn, SalesCreditNote, SalesDebitNote, IncomingPayment).

> **Nota operativa:** `prisma migrate dev`/`deploy` necesita la migración histórica
> `20260826200731_rbac_roles` marcada como aplicada (`prisma migrate resolve --applied`),
> porque referencia índices que el historial no crea (drift preexistente). Ver sección 6.

## 3. Backend (`src/document-series/`)

| Pieza | Detalle |
|---|---|
| `document-series.constants.ts` | `SALES_DOC_TYPES` (9 tipos), `DOC_TYPE_LABELS` (español), `DOC_TYPE_SEQUENCE_MAP` (docType → secuencia clásica de fallback). |
| `document-series.service.ts` | CRUD (create con `continueFromSeriesId` para heredar correlativo; update; remove inactiva si está en uso o es default); asignación usuario (`assignToUser`/`unassignFromUser`/`listAssignments`); núcleo `resolveSeries(tenantId, docType, date, userId)` y `nextDocumentCode(tx, tenantId, docType, date, userId)`. |
| `nextDocumentCode` | Prioridad: serie asignada al usuario que cubra la fecha → serie default que cubra → única serie que cubre → si el tipo tiene series pero ninguna cubre → **BadRequest**; si el tipo no tiene series → fallback `generateCode` clásico. Consumo **atómico** con `UPDATE … SET nextNumber = nextNumber + 1 … RETURNING nextNumber - 1` dentro de la tx del documento. |
| Controller `/document-series` | CRUD + `doc-types` + `assignments`/`assign`/`unassign` con `@RequirePermission('document-series', …)` y `TenantGuard`. |
| Permisos | `document-series: view/create/edit/delete` registrado en `DEFAULT_PERMISSIONS` (USER) y en el catálogo frontend (`permissions.service.ts`). |

### Integración en los 9 servicios de venta

Cada servicio de venta ahora inyecta `DocumentSeriesService`; su generador privado
(`generateCode` o dispatcher FVE/FRV) delega en `nextDocumentCode` con el docType correcto,
la **fecha contable del documento** (la misma que se persiste en `date`) y el usuario creador;
el `data` del create usa `code` + persiste `documentSeriesId`. Call-sites convertidos:

| Servicio | docType | Call-sites |
|---|---|---|
| sales-quotations | SALES_QUOTATION | 1 |
| sales-orders | SALES_ORDER | 4 |
| delivery-orders | DELIVERY_ORDER | 7 |
| sale-invoices (dispatcher FVE/FRV) | SALE_INVOICE / SALE_RESERVE_INVOICE | 8 |
| sale-reserve-invoices | SALE_RESERVE_INVOICE | 7 |
| sales-returns | SALES_RETURN | 1 (+delega createFromDelivery) |
| sales-credit-notes | SALES_CREDIT_NOTE | 2 (+1 REC en confirm, NO tocado) |
| sales-debit-notes | SALES_DEBIT_NOTE | 1 |
| incoming-payments | INCOMING_PAYMENT | 1 (createOne; RCN NO tocado) |

Los módulos importan `DocumentSeriesModule`. Specs de servicio actualizados con el mock
`DocumentSeriesService.nextDocumentCode` (code de ejemplo + seriesId null).

## 4. Verificación en vivo (2026-09-02)

- Creación de series por API: **COT-2025** (rango 2025, default, start 250000001) y **COT-2026**
  (rango 2026, start 260000001). `continueFromSeriesId` hereda correctamente el `nextNumber`.
- Cotizaciones creadas con fecha 2025 → **COT-250000001**, luego **COT-250000002** (incremento
  sin saltos, tras fix del `RETURNING nextNumber - 1`).
- Cotización con fecha 2026 → **COT-260000001** (serie independiente).
- Asignación usuario→serie: `POST /document-series/assign` OK; `GET /document-series/assignments`
  devuelve la asignación con serie y usuario.
- Prioridad de resolución: serie asignada al usuario gana si cubre la fecha; si no cubre → default.
- Exigencia: fecha **2024** (fuera de todo rango) → 400
  «No existe una serie activa de SALES_QUOTATION que cubra la fecha del documento (2024-05-05)…».

## 5. Tests

- `document-series.service.spec.ts`: 20 tests (create/duplicado/herencia, resolve por
  usuario/default/única/ambiguas/sin-series, nextDocumentCode atómico/agotada/exigir/fallback,
  assignToUser/remove).
- `document-series.controller.spec.ts`: 5 tests.
- Suite backend: 1515/1516 (1 fallo flaky preexistente de auth que pasa en aislamiento).
- Build OK, lint 0 errores (solo 2 warnings preexistentes).

## 6. Pendiente / notas

- **Frontend (en curso):** página `/document-series` (listado + form + asignación usuario),
  selector de serie opcional en los formularios de venta.
- **Doc:** actualizar `ROADMAP.md` (nueva fila de fase) y este plan al cerrar frontend.
- `prisma migrate dev` requiere `resolve --applied` de `20260826200731_rbac_roles` (drift
  histórico preexistente; la BD real ya está al día con el schema).
