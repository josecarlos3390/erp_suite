# Matriz de flujos de documentos — ventas y compras

> **Última actualización:** 2026-09-14 (cierre de la auditoría de flujos: T96–T101).
> **Para qué sirve:** el mismo hecho de negocio («esta línea ya se entregó / se
> facturó / se devolvió») se guarda en **tres sitios** del ERP y cada consumidor lee
> uno distinto. Cuando un flujo escribe uno y el consumidor lee otro, el guard y la
> interfaz **se contradicen** sobre el mismo documento: es la clase de defecto de
> T96 (una entrega nacida de una F. Reserva reportada como pendiente de facturar),
> T97/T98 (se podía facturar o entregar dos veces) y T100/T101. Esta matriz dice,
> por flujo, qué escribe cada camino, qué lee cada consumidor, qué guard lo bloquea
> y qué regla de `npm run audit:flows` lo vigila sobre datos reales.

---

## 1. Las tres capas del vínculo

| Capa | Dónde vive | Quién la **escribe** | Quién la **lee** |
|------|-----------|----------------------|------------------|
| **1. Columnas desnormalizadas** | `invoicedQty`, `deliveredQty`, `receivedQty`, `openQty`, `lineStatus`, `*Status` de cabecera | `confirm()` / `cancel()` de cada flujo | Reportes, listados y **algunos** guards; el progreso de cabecera (`recalc*Progress`) |
| **2. Vínculo genérico** | `baseDocType`/`baseDocId`/`baseLineId` (hacia atrás) y `targetDocType`/`targetDocId`/`targetLineId` (hacia adelante) | `buildBaseFields()` y `setTargetOnSourceLine()` en todo flujo de copia | Trazabilidad («de dónde salió esto»), `DocumentLink`, pantallas de origen |
| **3. Columnas de relación** | `SaleInvoiceItem.deliveryOrderItemId`, `DeliveryOrderItem.orderItemId`, `SalesOrderItem.quotationItemId`, `PurchaseInvoiceItem.purchaseReceiptItemId`, `SalesReturnItem.baseLineId`… | El flujo de origen al crear el documento destino | **La API** (enriquecimientos de `pendingInvoiceQty`, `hasPendingToInvoice`, `returnStatus`) y los guards derivados |

**Regla durable (T96):** todo flujo de copia escribe **(2) y (3)**, y el vínculo
inverso en la línea de origen. `target*` es de **un solo valor**: si la línea ya
apunta a una factura, ese vínculo manda y el detalle completo vive en el `base*`
del documento posterior (así lo resuelve T101 para las devoluciones).

**Regla durable (T97/T98/T100):** los guards **derivan de los documentos**, nunca de
la capa 1. Y al derivar hay que **restar las devoluciones**: una devolución revierte
la entrega/recepción (`deliveredQty`/`receivedQty` ↓, `openQty` ↑, el pedido se
reabre) — es lo que rompieron, cada uno por su lado, los guards de T97/T98.

---

## 2. Matriz — VENTAS

| Flujo (origen → destino) | Endpoint | Qué escribe | Qué lee el consumidor | Qué guard bloquea | Reglas |
|---|---|---|---|---|---|
| Cotización → Pedido | `POST /sales-orders/from-multi-quotation` (N=1 para una sola) | `SalesOrderItem.quotationItemId` + `base*` (SALES_QUOTATION) + `target*` en la línea de cotización; `SalesQuotationItem.orderedQty ↑ / openQty ↓` | API del pedido (origen), listado de cotizaciones | Pendiente desde cotización **derivado** (Σ pedidos que consumen la línea) — T97 ronda 3 | cobertura E2E |
| Pedido → Entrega | `POST /delivery-orders/from-order/:orderId`, `/from-multi-order` | `DeliveryOrderItem.orderItemId` + `base*` (SALES_ORDER) + `target*` en la línea del pedido; `SalesOrderItem.deliveredQty ↑ / openQty ↓` en `confirm()` **sólo si la línea trae `orderItemId`** | API entrega (pendiente por entregar), API pedido (`deliveryStatus`) | Pendiente = `quantity − Σ entregas CLOSED − Σ entregas OPEN − devoluciones` (T98/T100) | **R5** (relación ↔ `baseLineId`), **R6** (`deliveredQty` bruto **o** neto de devoluciones), **R7** (`openQty`) |
| Entrega → Factura / F. Reserva | `POST /sale-invoices/from-delivery/:deliveryOrderId`, `/sale-reserve-invoices/from-delivery/:deliveryOrderId`, ambos `/from-multi-delivery` | `SaleInvoiceItem.deliveryOrderItemId` + `base*` (DELIVERY_ORDER) + `target*` en la línea de entrega + `SaleInvoice.deliveryOrderId` (**sólo origen único**); `DeliveryOrderItem.invoicedQty ↑` en confirm / ↓ en cancel | API entrega: `pendingInvoiceQty` **por línea**, `hasPendingToInvoice = items.some(pending > 0)`, `reservedQty` (FRV ligada), `hasLinkedReserveInvoice`; menú «Copiar a» | Σ **facturas activas** ligadas a la línea (T96/T97) | **R1** (relación), **R2** (vínculo inverso), **R3** (`invoicedQty` vs Σ facturas), **R4** (cabecera) |
| **F. Reserva → Entrega** (el defecto de COT-181) | `POST /delivery-orders/from-reserve-invoice/:reserveInvoiceId`, `/from-multi-reserve-invoice` | Escribe la **relación** (`SaleInvoiceItem.deliveryOrderItemId`) **y** el vínculo genérico, más `SaleInvoice.deliveryOrderId` si está en NULL (T96) | API entrega: `hasPendingToInvoice=false`, `hasLinkedReserveInvoice=true`; «Copiar a» ya no re-ofrece facturarla | El backend ya bloqueaba la segunda factura (`400 … Pendiente: 0`); el defecto era de lectura y trazabilidad | **R1–R4** + spec `sale-delivery-from-reserve-invoice-ui` |
| Pedido → Factura directa (sin entrega) | `POST /sale-invoices/from-order/:orderId`, `/from-multi-order` | `SaleInvoiceItem.orderItemId` + `base*`; `SalesOrderItem.invoicedQty ↑` (y `deliveredQty ↑` en el camino directo) | API pedido (`invoiceStatus`), API factura | Pendiente = `quantity − Σ facturas activas − Σ entregas` (T97) | **R6**, **R12b** (espejo compras) |
| **Devolución de venta** | `POST /sales-returns` (cabecera en el body), `/sales-returns/from-delivery/:deliveryOrderId` | `SalesReturnItem.base*` **siempre** (por línea o **resuelto por artículo** si el payload sólo trae la cabecera — T101) + `target*` en la línea de entrega **sin pisar** un vínculo existente; `DeliveryOrderItem.invoicedQty ↑` (capacidad consumida), `SalesOrderItem.deliveredQty ↓`, `openQty = quantity − deliveredQty`, pedido **reabierto** | API entrega: `returnStatus`, `returnedQty`; guard de facturación (resta devoluciones); listado de pedidos | Devuelto ≤ entregado **por línea resuelta** (el bucle ya no itera sólo las líneas vinculadas — T101) | **R14/R14b–e** (vínculo, tipo de origen, línea inexistente, devuelto > entregado, vínculo inverso) |
| **Nota de crédito de venta** | `POST /sales-credit-notes`, `/from-invoice/:invoiceId` | `SalesCreditNoteItem.base*` (línea de factura) + `target*`; en confirm `DeliveryOrderItem.invoicedQty ↓` y `SalesOrderItem.invoicedQty ↓` (espejo del incremento al facturar), restaurados al cancelar | API factura (saldo), API entrega (capacidad) | **No acreditar más de lo facturado** en la línea (400 verificado en T101) | **R15/R15b**, **R13** (reversa del asiento) |
| Cobro (CxC) | `POST /incoming-payments`, `/batch`, `/apply-balance`, `/:id/cancel` | Asiento del cobro (+ retención sufrida como activo, T91), saldos del partner y de la factura | Estado de cuenta, conciliación | Total de métodos = `total − retención`; retención exige tipo | **R13** |

---

## 3. Matriz — COMPRAS (espejo)

| Flujo (origen → destino) | Endpoint | Qué escribe | Qué lee el consumidor | Qué guard bloquea | Reglas |
|---|---|---|---|---|---|
| Solicitud → Pedido | `POST /purchase-requests/:id/convert-to-order` | `base*` + `target*`, estado de la solicitud | API del pedido, listado de solicitudes | Solicitud aprobada y no cerrada | cobertura E2E |
| Cotización → Pedido | `POST /purchase-orders/from-multi-quotation` | `PurchaseOrderItem.purchaseQuotationItemId` + `base*` + `target*`; contadores de la cotización | API del pedido, listado | Pendiente derivado de la cotización | cobertura E2E |
| Pedido → Recepción | `POST /purchase-receipts/from-order/:orderId`, `/from-multi-order`, `/manual` | `PurchaseReceiptItem.orderItemId` + `base*` (PURCHASE_ORDER) + `target*`; `PurchaseOrderItem.receivedQty ↑ / openQty ↓` en confirm / revertido en cancel | API recepción (pendiente por recibir), API pedido (`receiptStatus`) | Pendiente = `quantity − Σ recepciones CLOSED − Σ recepciones OPEN − devoluciones` (T98, devoluciones en T100) | **R12** |
| Recepción → Factura | `POST /purchase-invoices/from-receipt/:receiptId`, `/from-multi-receipt` | `PurchaseInvoiceItem.purchaseReceiptItemId` + `orderItemId` + `base*` + `target*`; `PurchaseReceiptItem.invoicedQty ↑` (creación) y `PurchaseOrderItem.invoicedQty ↑` (creación, T100) | API recepción (`pendingInvoiceQty`, `returnStatus`, `hasPendingToInvoice`), API factura; **menú «Copiar a → Factura de Compra»** del formulario de recepción + modal simple/consolidada (**T129**; antes sólo por API) | Σ **facturas activas** ligadas a la línea de recepción, **netas de devoluciones** (T98) | **R10/R10b**, **R11**, **R12b** |
| Pedido → F. Reserva de compra (avance) | `POST /purchase-reserve-invoices/from-order/:orderId`, `/manual`, `/from-receipt/:purchaseReceiptId` | `base*` + `target*`; `PurchaseOrderItem.invoicedQty ↑` en las líneas **sin recepción** (directa **y** reserva, T101); `receivedQty` sólo en la compra directa | API del pedido (`invoiceStatus`), API de la reserva | Pendiente = `quantity − Σ facturas activas` | **R12b** |
| Pedido → Factura directa | `POST /purchase-invoices/from-order/:orderId`, `/manual` | `PurchaseInvoiceItem.orderItemId` + `base*`; `PurchaseOrderItem.invoicedQty ↑` **y** `receivedQty ↑` (la factura directa es también la recepción) | API pedido, API factura | Pendiente = `quantity − Σ facturas activas` (sin doble conteo de OPEN — T98) | **R12/R12b** |
| **Devolución de compra** | `POST /purchase-returns`, `/purchase-returns/from-receipt/:purchaseReceiptId` | Igual que ventas: `PurchaseReturnItem.base*` **siempre** (resuelto por artículo si hace falta), `target*` en la línea de recepción; `PurchaseReceiptItem.invoicedQty ↑`, `PurchaseOrderItem.receivedQty ↓`, `openQty` recalculado, pedido reabierto | API recepción (`returnStatus`), guard de facturación, listado de pedidos | Devuelto ≤ recibido por línea | **R14/R14b–e** |
| **Nota de crédito de compra** | `POST /purchase-credit-notes`, `/from-invoice/:invoiceId`, `/:id/apply` | `PurchaseCreditNoteItem.base*` + `target*`; `invoicedQty ↓` y su restauración al cancelar; el saldo a favor se **aplica** a otra factura (`/apply`) | Estado de cuenta del proveedor, anticipos | No acreditar más de lo facturado | **R15/R15b**, **R13** |
| Pago (CxP) | `POST /outgoing-payments`, `/batch`, `/:id/cancel` | Asiento del pago (+ retención que **practicamos**), saldos | Estado de cuenta, conciliación | Total de métodos = `total − retención` | **R13** |

---

## 4. Contabilidad de las anulaciones (transversal)

No existe un documento comercial de anulación: `AccountingEngineService.reverseJournalEntry`
crea un **asiento espejo** (`sourceDocumentType='REVERSAL'`, `sourceDocumentId` = asiento
original, debe/haber intercambiados con importes base/local/sistema, partner, ítem,
proyecto y dimensiones), deja el original en `CANCELLED` y lo enlaza por
`reversalJournalEntryId`. Es idempotente y **silenciosamente nulo** si el tipo de
documento no coincide con el del asiento — de ahí el defecto de T99 (5 F. Reserva de
compra anuladas con el asiento vivo). Documentos fiscales fuera del plazo legal se
anulan con **nota de crédito** (RND 10-0016-17, motivo obligatorio).

`R13/R13b/R13c` del detector recorren **21 tipos de documento** buscando documentos
anulados con asiento POSTED sin reversa, reversas huérfanas y tipos sin comprobación
(`EXCHANGE_RATE_REVALUATION`, `ADVANCE_APPLICATION`).

### 4.b Tesorería: el vínculo asiento ↔ extracto es la LÍNEA (T116)

El extracto bancario no tiene documento comercial de anulación, pero **sí** tiene una
unidad de vínculo propio, y es la **línea**:

| Capa | Qué la escribe | Qué la lee |
|---|---|---|
| `JournalEntry.sourceDocumentType='BANK_STATEMENT'` + **`sourceDocumentId = BankStatementLine.id`** | `bank-statements.service.post` (un asiento por línea contabilizable) | `reverseJournalEntry('BANK_STATEMENT', line.id, …)` en el `unpost`; el botón «Ver documento origen»; la regla **R13d** |
| `BankStatementLine.journalEntryLineId` | el mismo `post` (línea lado banco del asiento) | `unpost` (para saber qué reversar), pantalla del extracto |
| `BankStatementLine.status` (`UNRECONCILED` → `MATCHED_AUTO` al contabilizar → `RECONCILED` al cerrar la conciliación) | `post`, `autoMatch`/`manualMatch`, `finalize`, `unpost`, `unmatch` | el matcher (solo carga `UNRECONCILED`), `finalize` (cuenta lo resuelto) |
| `BankReconciliationLine.matchCriteria` (`REFERENCE`/`AMOUNT_DATE`/`AMOUNT_WIDE_DATE`/`MANUAL`) | `autoMatch` (rondas) y `manualMatch` | auditoría de la conciliación (por qué se eligió ese candidato) |

**Por qué la línea y no el encabezado:** el id debe ser único por asiento, porque
`reverseJournalEntry` resuelve el original con `findFirst` por `(tipo, id)`. Con el id
del extracto, dos asientos compartirían clave y la reversión habría reversado **uno
solo, en silencio** (la clase de fallo de T106). Con la línea, `unpost` revierte
exactamente lo que corresponde a cada una.

**Invariantes que se vigilan:** R13d (asiento de extracto cuya línea no existe =
**ERROR**; sin documento ligado = WARN histórico de los anteriores a T116) y el guard
de `unpost` (una reversa que no se puede hacer **falla**, no se ignora). El ciclo
completo —contabilizar → des-contabilizar con motivo → volver a contabilizar— está en
la barrida (`--only=bancos`).

---

## 5. Límites conocidos (declarados, no silenciosos)

1. **`target*` es de un solo valor.** Una línea facturada **y** devuelta sólo puede
   apuntar a uno de los dos: manda el de la factura y el detalle vive en el `base*`
   de la devolución. La regla **R14e** sólo avisa cuando la línea **no tiene ningún**
   vínculo hacia adelante (apuntar a una factura activa es legítimo); las líneas de
   entrega que quedaron sin vínculo hacia su factura se sanaron con
   `20260914050000_heal_missing_target_links` (sólo rellena `NULL`, nunca pisa).
2. **Las columnas de la capa 1 mezclan hechos.** `DeliveryOrderItem.invoicedQty` y
   `PurchaseReceiptItem.invoicedQty` cuentan «facturado» **y** «devuelto» (la
   devolución las incrementa para consumir la línea), y las **notas de crédito**
   liberan lo facturado (`PurchaseOrderItem`/`SalesOrderItem.invoicedQty` bajan al
   crear la NC y se restauran al anularla). Por eso las reglas de cantidades
   (**R3**, **R11**, **R12b**) aceptan el valor **bruto o el neto** de devoluciones y
   notas de crédito: lo que no cuadra con ninguno de los dos es deriva real.
   (T102 se cerró así: no era una columna desviada, era una regla sin netar.)
3. **Modelos legacy vacíos.** `SaleReserveInvoice`/`SaleReserveInvoiceItem` y
   `PurchaseReserveInvoice` tienen **0 filas**: los datos viven en
   `SaleInvoice`/`PurchaseInvoice` con `isReserve='Y'`. R9 vigila las lecturas desde
   el código y quedan **13 funcionales** (los `*-movement-checker` de maestros se
   excluyen: cuentan también el modelo unificado). Revisarlas encontró **dos
   defectos reales** (T103): pagar una F. Reserva de compra por su campo legacy
   `purchaseReserveInvoiceId` devolvía **404**, y el asiento de una FRC se quedaba
   **sin «documento origen»**; los dos ya usan el modelo unificado.
4. **Notas de débito sin datos.** `SalesDebitNote`/`PurchaseDebitNote` = 0 filas: su
   simetría está cubierta por R13 (anulaciones) y por análisis de código.
5. **`assembly-orders.cancel`** contabiliza su asiento espejo pero no lo enlaza como
   reversa del original.
6. **Drift de migraciones en la BD de desarrollo (DT.45).** `prisma migrate status`
   lista migraciones antiguas como no aplicadas porque esa BD se creó con
   `db push`/SQL manual: en una BD limpia (CI y despliegue) `prisma migrate deploy`
   aplica las **49**. El gate de CI usa ese camino limpio.
7. **Residuo de E2E en desarrollo.** Los specs corren contra `erp_db` y dejan
   documentos reales (~190 en una tarde de corridas: pedidos abiertos, entregas y
   facturas CLOSED/CANCELLED). No es un problema de integridad —los guards derivan de
   los documentos y `npm run audit:flows` lo verifica—; para decidir qué hacer hay
   `node scripts/e2e-residue-report.mjs [--hours=N]` (sólo lectura), que lista el
   residuo por tipo/estado y los pedidos abiertos **sin documento posterior**
   (los únicos anulables sin arrastrar contabilidad).

---

## 6. Cómo verificarlo

```bash
cd backend-erp
npm run audit:flows            # detector: sale 1 si hay ERROR (0 errores hoy, 4 avisos declarados)
npm run audit:flows -- --all   # sin límite de escaneo por bloque
npm run repair:reversals       # dry-run: recrea asientos espejo que falten (--apply para escribir)
npm run test:e2e               # 15 suites / 104 tests (incluye los flujos y guards por API)
```

Specs de regresión por flujo (frontend, Playwright):

| Spec | Cubre |
|---|---|
| `e2e/sale-delivery-from-reserve-invoice-ui.spec.ts` | **T96**: F. Reserva → Entrega (indicadores de la API y menú «Copiar a») |
| `e2e/sale-reserve-invoice-from-order-ui.spec.ts` | T93/T95: Pedido → F. Reserva |
| `e2e/sales-billing-guards.spec.ts` / `purchases-billing-guards.spec.ts` | T97/T98: no facturar dos veces, no entregar/recibir de más |
| `backend-erp/test/returns-and-credit-notes.e2e-spec.ts` | T101: asiento + vínculos + no facturar lo devuelto + reversa al anular |

Referencias: `AUDIT.md` (filas **T93, T95, T96, T97, T98, T99, T100, T101**),
`BACKEND_GUIDE.md` §2 (checklist: vínculo en ambos sentidos; indicadores por línea;
derivar de los documentos; devoluciones descontadas; `cancel` espejo de `confirm`).
