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
| Entrega → Factura / F. Reserva | `POST /sale-invoices/from-delivery/:deliveryOrderId`, `/sale-reserve-invoices/from-delivery/:deliveryOrderId`, ambos `/from-multi-delivery` | `SaleInvoiceItem.deliveryOrderItemId` + `base*` (DELIVERY_ORDER) + `target*` en la línea de entrega + `SaleInvoice.deliveryOrderId` (**sólo origen único**); `DeliveryOrderItem.invoicedQty ↑` en confirm / ↓ en cancel | API entrega: `pendingInvoiceQty` **por línea**, `hasPendingToInvoice = items.some(pending > 0)`, `reservedQty` (FRV ligada), `hasLinkedReserveInvoice`; menú «Copiar a» | Σ **facturas activas** ligadas a la línea (T96/T97) | **R1** (relación), **R2** (vínculo inverso), **R3** (`invoicedQty` vs Σ facturas), **R4** (cabecera). **`isReserve` (decisión de contrato, 2026-09-18, T148)**: una factura nacida de una **entrega** es una **F. Reserva** (`'Y'`) — la mercancía ya salió con la entrega, así que la factura **no debe mover inventario**—, y el tipo se identifica **explícitamente** en las tres superficies: el **default del API** al copiar de una entrega es `'Y'` (igual que «desde cotización»; «desde pedido» es `'N'`), el **formulario manda `'Y'`** (antes `'N'`, que hacía que la misma operación diera F. Reserva por API y factura normal por pantalla) y la **serie** que numera el documento es la de facturas de reserva (`seriesDocType`). En **ambos** tipos el stock no se mueve: las líneas con `deliveryOrderItemId` saltan el par COGS ↔ Inventario en `sales.journal-builder` («guard anti doble COGS»). La línea de la factura guarda su **origen** en `baseDocType` (**`DELIVERY_ORDER`** en los dos casos, medido); el tipo de la factura vive en `isReserve` y, aguas abajo, en el `baseDocType` de la **NC** que nazca de ella. Fijado por `test/sale-invoice-from-delivery-default.e2e-spec.ts` (**2/2**), `e2e/sale-invoice-from-delivery-ui.spec.ts` (**2/2**) y Karma (`sale-invoices.service.spec.ts` + spec del formulario) |
| **F. Reserva → Entrega** (el defecto de COT-181) | `POST /delivery-orders/from-reserve-invoice/:reserveInvoiceId`, `/from-multi-reserve-invoice` | Escribe la **relación** (`SaleInvoiceItem.deliveryOrderItemId`) **y** el vínculo genérico, más `SaleInvoice.deliveryOrderId` si está en NULL (T96) | API entrega: `hasPendingToInvoice=false`, `hasLinkedReserveInvoice=true`; «Copiar a» ya no re-ofrece facturarla | El backend ya bloqueaba la segunda factura (`400 … Pendiente: 0`); el defecto era de lectura y trazabilidad | **R1–R4** + spec `sale-delivery-from-reserve-invoice-ui` |
| Pedido → Factura directa (sin entrega) | `POST /sale-invoices/from-order/:orderId`, `/from-multi-order` | `SaleInvoiceItem.orderItemId` + `base*`; `SalesOrderItem.invoicedQty ↑` (y `deliveredQty ↑` en el camino directo) | API pedido (`invoiceStatus`), API factura | Pendiente = `quantity − Σ facturas activas − Σ entregas` (T97) | **R6**, **R12b** (espejo compras) |
| **Devolución de venta** | `POST /sales-returns` (cabecera en el body), `/sales-returns/from-delivery/:deliveryOrderId` | `SalesReturnItem.base*` **siempre** (por línea o **resuelto por artículo** si el payload sólo trae la cabecera — T101) + `target*` en la línea de entrega **sin pisar** un vínculo existente; `DeliveryOrderItem.invoicedQty ↑` (capacidad consumida), `SalesOrderItem.deliveredQty ↓`, `openQty = quantity − deliveredQty`, pedido **reabierto** | API entrega: `returnStatus`, `returnedQty`; guard de facturación (resta devoluciones); listado de pedidos | Devuelto ≤ entregado **por línea resuelta** (el bucle ya no itera sólo las líneas vinculadas — T101) | **R14/R14b–e** (vínculo, tipo de origen, línea inexistente, devuelto > entregado, vínculo inverso) |
| **Nota de crédito de venta** | `POST /sales-credit-notes`, `/from-invoice/:invoiceId` | `SalesCreditNoteItem.base*` (línea de factura) + `target*`; en confirm `DeliveryOrderItem.invoicedQty ↓` y `SalesOrderItem.invoicedQty ↓` (espejo del incremento al facturar), restaurados al cancelar. El `base*` se **completa en el servicio** cuando el payload sólo manda `baseLineId` (tipo e id de la cabecera, `baseQty` = cantidad) — sin eso la traza quedaba a medias | API factura (saldo), API entrega (capacidad); **pendiente de devolución derivado** (`GET /sales-credit-notes/:id/return-pending`), badge del listado de entregas | **No acreditar más de lo facturado** en la línea (400 verificado en T101). La devolución **no** se bloquea por la NC: su límite es lo entregado − lo devuelto | **R15/R15b**, **R13** (reversa del asiento), **R14f** (aviso: NC con mercancía entregada sin devolver) |
| Cobro (CxC) | `POST /incoming-payments`, `/batch`, `/apply-balance`, `/:id/cancel` | Asiento del cobro (+ retención sufrida como activo, T91), saldos del partner y de la factura | Estado de cuenta, conciliación | Total de métodos = `total − retención`; retención exige tipo | **R13** |

---

## 3. Matriz — COMPRAS (espejo)

| Flujo (origen → destino) | Endpoint | Qué escribe | Qué lee el consumidor | Qué guard bloquea | Reglas |
|---|---|---|---|---|---|
| Solicitud → Pedido | `POST /purchase-requests/:id/convert-to-order` | `base*` + `target*`, estado de la solicitud | API del pedido, listado de solicitudes | Solicitud aprobada y no cerrada | cobertura E2E |
| Cotización → Pedido | `POST /purchase-orders/from-multi-quotation` | `PurchaseOrderItem.purchaseQuotationItemId` + `base*` + `target*`; contadores de la cotización | API del pedido, listado | Pendiente derivado de la cotización | cobertura E2E |
| Pedido → Recepción | `POST /purchase-receipts/from-order/:orderId`, `/from-multi-order`, `/manual` | `PurchaseReceiptItem.orderItemId` + `base*` (PURCHASE_ORDER) + `target*`; `PurchaseOrderItem.receivedQty ↑ / openQty ↓` en confirm / revertido en cancel | API recepción (pendiente por recibir), API pedido (`receiptStatus`) | Pendiente = `quantity − Σ recepciones CLOSED − Σ recepciones OPEN − devoluciones` (T98, devoluciones en T100) | **R12** |
| Recepción → Factura | `POST /purchase-invoices/from-receipt/:receiptId`, `/from-multi-receipt` | `PurchaseInvoiceItem.purchaseReceiptItemId` + `orderItemId` + `base*` + `target*`; `PurchaseReceiptItem.invoicedQty ↑` (creación) y `PurchaseOrderItem.invoicedQty ↑` (creación, T100) | API recepción (`pendingInvoiceQty`, `returnStatus`, `hasPendingToInvoice`), API factura; **menú «Copiar a → Factura de Compra»** del formulario de recepción + modal simple/consolidada (**T129**; antes sólo por API) | Σ **facturas activas** ligadas a la línea de recepción, **netas de devoluciones** (T98) | **R10/R10b**, **R11**, **R12b** |
| **Recepción → Precio de Entrega** (G1) | `POST /landed-costs/from-receipt/:receiptId` (o `POST /landed-costs` con `purchaseReceiptId`); entrada **«Copiar a → Precio de Entrega»** del formulario de recepción | `LandedCost.purchaseReceiptId` (FK **Restrict**) y `LandedCostItem.purchaseReceiptItemId` por línea (FK **Restrict**), con el **valor** de la línea (`cantidad × costo de la recepción`) como base del reparto. Al **aplicar**: costo final en `PurchaseReceiptItem.unitCost/cost/totalCost`, kardex valorizado y `StockMovement` `LANDED_COST` (cantidad 0) con `landedCostId` | API del Precio de Entrega (líneas y gastos), kardex del artículo (`_resolveKardexSourceDoc` reconoce `landedCost`), listado de Precios de Entrega | La recepción **anulada** no se costea (`400`); una línea de factura de gasto ya aplicada no se puede repetir (traza `LandedCostExpense.purchaseInvoiceItemId`); ya aplicado, el documento sólo se puede **anular** | 7 E2E de backend (`test/landed-costs.e2e-spec.ts`) + E2E de UI |
| Pedido → F. Reserva de compra (avance) | `POST /purchase-reserve-invoices/from-order/:orderId`, `/manual`, `/from-receipt/:purchaseReceiptId` | `base*` + `target*`; `PurchaseOrderItem.invoicedQty ↑` en las líneas **sin recepción** (directa **y** reserva, T101); `receivedQty` sólo en la compra directa | API del pedido (`invoiceStatus`), API de la reserva | Pendiente = `quantity − Σ facturas activas` | **R12b** |
| Pedido → Factura directa | `POST /purchase-invoices/from-order/:orderId`, `/manual` | `PurchaseInvoiceItem.orderItemId` + `base*`; `PurchaseOrderItem.invoicedQty ↑` **y** `receivedQty ↑` (la factura directa es también la recepción) | API pedido, API factura | Pendiente = `quantity − Σ facturas activas` (sin doble conteo de OPEN — T98) | **R12/R12b** |
| **Devolución de compra** | `POST /purchase-returns`, `/purchase-returns/from-receipt/:purchaseReceiptId` | Igual que ventas: `PurchaseReturnItem.base*` **siempre** (resuelto por artículo si hace falta), `target*` en la línea de recepción; `PurchaseReceiptItem.invoicedQty ↑`, `PurchaseOrderItem.receivedQty ↓`, `openQty` recalculado, pedido reabierto | API recepción (`returnStatus`), guard de facturación, listado de pedidos | Devuelto ≤ recibido por línea | **R14/R14b–e** |
| **Nota de crédito de compra** | `POST /purchase-credit-notes`, `/from-invoice/:invoiceId`, `/:id/apply` | `PurchaseCreditNoteItem.base*` + `target*`; `invoicedQty ↓` y su restauración al cancelar; el saldo a favor se **aplica** a otra factura (`/apply`). El `base*` se **completa en el servicio** cuando el payload sólo manda `baseLineId` (igual que ventas) | Estado de cuenta del proveedor, anticipos; **pendiente de devolución derivado** (`GET /purchase-credit-notes/:id/return-pending`), badge del listado de recepciones | No acreditar más de lo facturado. La devolución **no** se bloquea por la NC: su límite es lo recibido − lo devuelto | **R15/R15b**, **R13**, **R14f** (aviso) |
| Pago (CxP) | `POST /outgoing-payments`, `/batch`, `/:id/cancel` | Asiento del pago (+ retención que **practicamos**), saldos | Estado de cuenta, conciliación | Total de métodos = `total − retención` | **R13** |

---

## 4. Contabilidad de las anulaciones (transversal)

No existe un documento comercial de anulación: `AccountingEngineService.reverseJournalEntry`
crea un **asiento espejo** (`sourceDocumentType='REVERSAL'`, `sourceDocumentId` = asiento
original, debe/haber intercambiados con importes base/local/sistema, partner, ítem,
proyecto y dimensiones), deja el original en `CANCELLED` y lo enlaza por
`reversalJournalEntryId`. Si el asiento original **ya estaba reversado**, la anulación
**falla con 409** (T149: antes devolvía `null` en silencio, la clase de no-op que dejó
pasar T99 con 5 F. Reserva de compra anuladas y el asiento vivo). El espejo se **valida
con `_assertBalanced`** antes de persistir. Documentos fiscales fuera del plazo legal se
anulan con **nota de crédito** (RND 10-0016-17, motivo obligatorio), y una factura con
pagos, abonos o NC aplicadas **no se puede cancelar**: el propio mensaje pide la nota de
crédito.

`R13/R13b/R13c` del detector recorren **21 tipos de documento** buscando documentos
anulados con asiento POSTED sin reversa, reversas huérfanas y tipos sin comprobación
(`EXCHANGE_RATE_REVALUATION`, `ADVANCE_APPLICATION`).

**Fecha de contabilización de la anulación (T147 + T149, resuelto el 2026-09-18)**: la
reversa se fecha con el **«hoy» del tenant** (`resolveDocumentDate`, `accounting-engine.service`)
por defecto —nunca con la fecha del documento original— y desde **T149 el usuario puede
elegirla**: las **27 rutas `POST /<doc>/:id/cancel`** aceptan `{ reason?, postingDate }`
(`YYYY-MM-DD`) y la interfaz la pide en el diálogo de anulación de todo documento que
genere asiento (`ConfirmDialogService.askWithDetails`, propuesta con el **día del
tenant**). La fecha elegida decide el **período contable** de la reversa:
`_resolveAccountingPeriod` (`journal-entry-core.ts`, compartido con `_persist`) lanza
**409** si cae en un período **cerrado o bloqueado** o fuera de la gestión, con el mensaje
que pide **reabrir el período o elegir otra fecha**; el 409 ocurre **dentro de la
transacción**, así que la anulación es **atómica** (ni el documento, ni el stock, ni el
asiento original cambian). Antes de T149 la reversa **se saltaba la guarda** (creaba el
asiento con `tx.journalEntry.create` directo, sin `_persist`): medido — anular con el
período cerrado devolvía **201** y dejaba la reversa con `fiscalYearId`/`periodId` nulos.

**El par revertido en saldos e informes (convención única, T149)**: un asiento **cuenta**
si está `POSTED` y **no** es `REVERSAL` (`common/journal-entry-scope.ts`), de modo que el
original `CANCELLED` y su espejo se excluyen **juntos** —para el reporte, el documento
anulado nunca existió—. Aplica a saldos de cuenta y mayor, saldos por lote, bancos,
ajuste por diferencia de cambio, cierre de período/ejercicio (arrastre incluido), IUE/IT/ICE
y los informes fiscales, candidatos de conciliación bancaria y el cuadre «informe ↔ mayor»
de retenciones (el caso especial de T147 pasa a usar el mismo helper). Antes de T149 cada
informe aplicaba su criterio: los saldos filtraban `status = 'POSTED'`, que **incluye la
reversa y excluye el original** — medido: tras anular una factura de 226 en el mismo
período, el saldo de CxC quedaba en **−226** en vez de 0—. **Excepciones declaradas**: el
listado de Asientos contables muestra el par (es donde se audita) y los
`*-movement-checker` (guardas de borrado de maestros) siguen contando cualquier asiento.

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
   **Corolario (T144)**: como R3 neta la NC **mapeándola por la línea de factura**, la
   NC debe traer su `base*` **completo**; con `baseDocType = null` el detector no la
   encontraba y reportaba un **falso ERROR** de `invoicedQty` (el servicio lo deriva
   ahora de la cabecera). Además `invoicedQty` **no** es lo que habilita la devolución:
   el guard de `sales-returns`/`purchase-returns` limita contra lo entregado/recibido
   menos lo ya devuelto, así que una devolución es válida **con o sin** NC.
2b. **NC acreditada sin devolver: es un pendiente, no una incoherencia.** La NC es el
   hecho financiero y la devolución el físico; pueden separarse en el tiempo (o no
   devolverse nunca, si el negocio lo decide). El ERP lo **mide** —`pendiente =
   min(acreditado, entregado/recibido) − devuelto`, derivado en
   `src/common/pending-return.util.ts`— y lo publica en tres sitios: el listado de
   entregas/recepciones (`pendingReturnQty`, badge «NC sin devolver»), el panel de la
   nota de crédito (`GET /<nc>/:id/return-pending`, agrupado por documento) y la regla
   **R14f** del detector, **como aviso** (no tumba el gate). El enlace que ofrece la NC
   lleva a la devolución **de la entrega/recepción**, que es el único flujo que existe
   para devolver: la devolución **no nace de la nota de crédito**.
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
8. **El Precio de Entrega (G1) no usa las capas `base*`/`target*`.** Su vínculo con la
   recepción es `LandedCost.purchaseReceiptId` + `LandedCostItem.purchaseReceiptItemId`
   y, con el gasto, la traza `LandedCostExpense.purchaseInvoiceItemId`; no reescribe
   ninguna columna del documento origen salvo el **costo** de la recepción al aplicar
   (que es su razón de ser: la recepción queda con su costo final, como en SAP B1).
   Las dos FK a la recepción son **Restrict**, así que una recepción costeada no se
   puede borrar — y la limpieza global (seed, `clean-documents.js`, `test-utils`)
   borra los Precios de Entrega **antes** de las recepciones desde T143.
   El detector R1–R15 no cubre este documento: su coherencia la verifican los 7 E2E
   de backend y el E2E de UI.
9. **Revalorización de inventario (G2): no reexpresa costos de ventas ni mueve
   cantidades.** El documento asigna el costo **resultante** de la existencia de un
   artículo en un almacén (por precio unitario nuevo o por importe total nuevo) y el
   ajuste va **íntegro** a Inventario contra la cuenta de **Revalorización** (si sube) o
   la de **Contrapartida** (si baja); el kardex lo registra con **cantidad 0**, así que
   ninguna cantidad ni ningún saldo de unidades cambia. Límites declarados: (a) no
   reexpresa el COGS de lo ya vendido —a diferencia del Precio de Entrega, que sí reparte
   a costo de ventas porque capitaliza un gasto del período—; (b) la granularidad es
   **artículo + almacén** (el costo promedio vive ahí), no lote/serie; (c) no admite
   cantidad parcial (se revalúa toda la existencia, que es lo que hace inequívoco el
   «costo resultante»); (d) moneda base del tenant, sin tipo de cambio.
10. **El eje de la guarda de período es la fecha de CONTABILIZACIÓN (T151, 2026-09-18).**
   El motor resuelve el período con `source.postingDate ?? source.date`, así que un
   documento con la fecha documental en un período abierto y la contabilización en uno
   **cerrado** falla **409** (y al revés: documento en un período cerrado y
   contabilización en uno abierto se registra, vinculado al período de la
   contabilización). Excepciones declaradas: los dos tipos de **nota de débito** (su
   modelo no tiene columna `postingDate`: su fecha documental es la única) y las dos
   **aplicaciones de anticipo** (asientos técnicos de conciliación sin fecha de
   contabilización propia). **Propiedad declarada de la familia de stock**: el alta de
   una salida/entrada/ajuste/transferencia crea el documento **abierto** en una
   transacción y lo confirma (asiento + kardex) en otra, de modo que un 409 de la guarda
   deja el documento en `OPEN` **sin asiento ni kardex** —recuperable confirmándolo tras
   reabrir el período— en vez de no dejar nada.

11. **El ciclo de producción (G3) no usa cantidades desnormalizadas entre
   documentos: el vínculo es por id y por estado.** La **orden de producción** guarda
   su **snapshot** (componentes con la merma prevista y el costo previsto congelado al
   planificar) y la **emisión para producción** apunta a la **línea de componente**
   (`ProductionIssueItem.productionOrderComponentId`), así que el pendiente se lee de la
   propia línea (`quantityPlanned − quantityIssued`) —no se deriva de otros
   documentos— y la emisión lo **incrementa** en la misma transacción (tolerancia de
   sobre-consumo **0 %**: el exceso se rechaza con el pendiente en el mensaje). El
   estado de la orden (`DRAFT → PLANNED → RELEASED → IN_PROGRESS → CLOSED`/`CANCELLED`)
   es **reversible** en su tramo no ejecutado y revertir **limpia el efecto**
   (descongela el costo previsto, retira la liberación y, al anular una emisión,
   **devuelve la orden a `RELEASED`** si no queda nada consumido). El **recibo para
   producción** (fase 4) sigue la misma regla: el pendiente de recepción del PT se
   **deriva por agregación** de los recibos vivos (`lineType = 'MAIN'`, estado
   `APPLIED`) contra `ProductionOrder.quantity` —no hay columna desnormalizada que
   pueda desincronizarse—, la tolerancia de sobre-recibo es **0 %** con el pendiente en
   el mensaje y la anulación devuelve la orden a `RELEASED` cuando no queda **ni
   emisión ni recibo vivo** (las dos se consultan antes de revertir el estado).
   Contablemente la emisión **acumula** en el WIP de la orden (`Dr WIP / Cr Inventario`
   con la cuenta del **artículo fabricado**: un solo WIP por orden), el **consumo de
   recursos** (fase 5) acumula también —`Dr WIP / Cr cuenta del componente de costo`
   del recurso, con el snapshot de la tarifa copiado en el parte, que no es un
   documento con serie sino que vive dentro de la orden—, el recibo lo acredita
   (`Dr Inventario PT / Inventario subproducto / Mermas y Desperdicios · Cr WIP`,
   por `cantidad MAIN × tasa` —costo acumulado ÷ cantidad prevista— y con la merma **sin**
   valorizar existencia) y el **cierre** (fase 6) liquida el residuo contra la cuenta de
   variación (`WIP_VARIANCE`) hasta dejar el WIP de la orden en **cero**, medido en el
   mayor: el cierre **exige que el mayor y los documentos cuadren al céntimo** (si no,
   responde 409 en vez de contabilizar un ajuste inventado), deja `closedAt`/`closedById`
   y el asiento en `transactionId`, y su **reapertura** revierte ese asiento (con motivo
   persistido y fecha de contabilización, T149) devolviendo el WIP documental; el
   detector **R16** vigila las incoherencias de esta familia (mayor ≠ columna, columna ≠
   documentos en una orden viva, orden cerrada con WIP ≠ 0, emisión sin componentes
   previstos, recibo sin emisión y orden en proceso sin movimientos).
   La **reversibilidad del estado** es una sola regla (`restoreProductionOrderStatus`):
   al anular, la orden vuelve a `RELEASED` solo cuando **no queda ninguna emisión ni
   recibo ni parte de horas vivo**, y el parte devuelve además sus minutos a la
   operación (`timeReal`, que vuelve a `PENDING` cuando queda en cero).
   Límites declarados: la emisión es **manual** (sin `Backflush`), la emisión y el recibo
   no tienen asiento preliminar (preview) y la merma no genera movimiento de kardex
   (por eso el tipo `PRODUCTION_SCRAP` del plan no se añadió).

---

## 5.b Centros de costo y normas de reparto (transversal, C1–C3)

El **centro de costo no es una columna del asiento**: es el **valor de uno de los
cinco ejes** (`CostCenter.dimensionNumber`, como SAP B1), y la **norma de reparto**
(`DistributionRule` + líneas por porcentaje) es la que decide cómo se reparte un
importe entre varios centros.

| Pieza | Dónde vive | Cómo se vigila |
|---|---|---|
| **Eje declarado** | `DimensionConfig.isCostCenterAxis` (único por empresa; el nombre «Centro de costo» es el respaldo) | `resolveCostCenterAxis` en el motor y en los informes; se declara en Configuración de Dimensiones |
| **Validación del valor** | `_persist` del motor contable (punto único de toda línea del mayor) | `assertCostCentersInDimensions`: un código que no sea centro **activo del eje** → 400 con la línea y el eje; **no valida** si el maestro del eje está vacío |
| **Captura por línea** | `distributionRuleId` en **15 tablas** de línea (ventas, compras, stock y producción; el traspaso queda fuera) y su columna «Norma reparto» en la grilla de los 15 formularios | unitarios por formulario + `test/line-distribution-rules.e2e-spec.ts` |
| **Expansión** | `_persist` (`distribution-rule.util.ts`): prorrateo en `Decimal`, un redondeo por tramo y el **último cuadrado contra el total** | el mismo expandidor que el asiento manual |
| **Rastro** | `JournalEntryLine.sourceDistributionRuleId` (y el código del centro en `dimensionN`) | **R17** de `audit:flows` |
| **Lectura** | `GET /reports/cost-centers` y `GET /reports/distribution-rules` (pantalla `/reports/cost-centers`) | cuadran con el balance de comprobación del mismo rango |

**R17 — el reparto aplicado**: para cada familia, si hay líneas de documento con
`distributionRuleId` capturado y el documento **tiene asiento con al menos una pata de
resultados**, el asiento debe llevar el rastro (`sourceDistributionRuleId`) en alguna
de sus líneas; si no lo lleva, el builder de esa familia se olvidó de transportarla y
la regla lo reporta como **ERROR** con el documento y la norma. No marca el borrador
(sin asiento) ni el asiento con **solo** patas de activo/pasivo/IVA, donde el
saneador del motor limpia las analíticas y el reparto **no aplica** (límite declarado
de C2).

---

## 6. Cómo verificarlo

```bash
cd backend-erp
npm run audit:flows            # detector: sale 1 si hay ERROR (0 errores hoy, 4 avisos declarados)
npm run audit:flows -- --all   # sin límite de escaneo por bloque
npm run repair:reversals       # dry-run: recrea asientos espejo que falten (--apply para escribir)
npm run test:e2e               # 34 suites / 273 tests (incluye los flujos y guards por API)
```

Specs de regresión por flujo (frontend, Playwright):

| Spec | Cubre |
|---|---|
| `e2e/sale-delivery-from-reserve-invoice-ui.spec.ts` | **T96**: F. Reserva → Entrega (indicadores de la API y menú «Copiar a») |
| `e2e/sale-reserve-invoice-from-order-ui.spec.ts` | T93/T95: Pedido → F. Reserva |
| `e2e/sales-billing-guards.spec.ts` / `purchases-billing-guards.spec.ts` | T97/T98: no facturar dos veces, no entregar/recibir de más |
| `backend-erp/test/returns-and-credit-notes.e2e-spec.ts` | T101: asiento + vínculos + no facturar lo devuelto + reversa al anular |
| `e2e/landed-cost-ui.spec.ts` | **G1/T142**: Recepción → «Copiar a» → Precio de Entrega (gastos del proyecto, reparto, guardado, aplicación con asiento y anulación con motivo) + el maestro de tipos de gasto |

Referencias: `AUDIT.md` (filas **T93, T95, T96, T97, T98, T99, T100, T101**),
`BACKEND_GUIDE.md` §2 (checklist: vínculo en ambos sentidos; indicadores por línea;
derivar de los documentos; devoluciones descontadas; `cancel` espejo de `confirm`).
