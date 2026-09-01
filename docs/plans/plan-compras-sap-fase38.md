# Plan — Fase 3.8: Bases de integración bidireccional SAP B1 en COMPRAS

> **Estado:** EN VALIDACIÓN con el usuario (payload por payload).
> Payloads recibidos: **Purchase Quotation** (cotización, DocEntry 462),
> **Purchase Order** (pedido, DocEntry 414480), **Purchase Delivery Note**
> (recepción, DocEntry 97804), **Purchase Invoice — FRC** (DocEntry 165518),
> **Purchase Return** (devolución, DocEntry 3209), **Purchase Credit Note**
> (NC, DocEntry 2387) y **Payments** (pago, DocEntry 2111628926 — patrón
> idéntico para OutgoingPayment) — todos confirman el mismo estándar de cabecera
> (identity + Reference2 + DocTime + Series + ControlAccount).
> Pendiente: A/P Invoice normal.

---

## 1. Objetivo

Replicar en el flujo de compras el mismo patrón ya sólido en ventas (Fase 3.1–3.7):

- `sapDocEntry` / `sapDocNum` / `sapEtag` + ciclo `syncStatus` / `lastSyncedAt` / `lastSyncError`
- `@@unique([tenantId, sapDocEntry])` + idempotencia 409 (`assertSapDocEntryAvailable`)
- Preservación condicional en updates (editar desde UI no borra identidad)
- `sapLineNum` / `shipDate` en líneas (resolución `BaseLine`)
- Enriquecimiento nativo: `reference2` / `docTime` / `sapSeries` en headers;
  `sapControlAccount` en factura/NC; `isConsignment` en recepción;
  `paidAmount`/`balanceDue` en NC de compra
- UX/UI: `app-sap-integration-section` en los 8 formularios de compras

Modelos objetivo (8): `PurchaseQuotation`, `PurchaseOrder`, `PurchaseReceipt`,
`PurchaseInvoice`, `PurchaseReserveInvoice`, `OutgoingPayment`, `PurchaseReturn`,
`PurchaseCreditNote` (+ líneas).

## 2. Mapeo validado — Purchase Quotation (payload real DocEntry 462)

| SAP B1 (payload) | Valor ejemplo | ERP | Acción |
|------------------|---------------|-----|--------|
| `DocEntry` | 462 | `sapDocEntry` | identidad + idempotencia |
| `DocNum` | 240000001 | `sapDocNum` | identidad |
| `odata.etag` | `W/"356A..."` | `sapEtag` | optimistic locking |
| `DocumentStatus` / `Cancelled` | `bost_Open` / `tNO` | `status` | sync de estados (conector) |
| `DocDate` / `TaxDate` / `DocDueDate` | 2024-01-25 | `date` / `postingDate` / `dueDate` | ya existe |
| `CardCode` | PL001360 | `supplierId` | ⚠️ resolver por `sapCardCode` (ver §4) |
| `DocCurrency` / `DocRate` | BS / 1.0 | `currency` / `exchangeRate` | ya existe |
| `DocTotal` / `VatSum` | 344.83 / 44.83 | `total` / `tax` | ya existe |
| `Comments` | "PRUEBA FLUJO..." | `notes` | ya existe |
| `NumAtCard` | null | `referenceNo` | alias ya resuelto |
| `Reference2` | null | `reference2` | **nuevo (nativo)** |
| `DocTime` | 15:18:00 | `docTime` | **nuevo (nativo)** |
| `Series` | 533 | `sapSeries` | **nuevo (nativo)** |
| `ControlAccount` | 21105002 | `sapControlAccount` | **nuevo** — guardar en `PurchaseInvoice`/`PurchaseCreditNote` |
| `DiscountPercent` | 0.0 | `headerDiscountPct` | ya existe |
| `SalesPersonCode` / `ContactPersonCode` | 354 / 5795 | `salesPersonId` / `contactPerson` | ya existe |
| `PaymentGroupCode` | 12 | `paymentTermsId` | ya existe |
| `PartialSupply` | tYES | — (informativo) | recepción parcial ya soportada por `openQty` |
| `WareHouseUpdateType` | dwh_No | `isConsignment` (recepción) | **nuevo** en `PurchaseReceipt` |

### Líneas

| SAP B1 | Valor | ERP | Acción |
|--------|-------|-----|--------|
| `LineNum` | 0 | `sapLineNum` | **nuevo (nativo)** |
| `ItemCode` | LBLAUDI010007 | `itemId` | ⚠️ resolver por `sapItemCode` (ver §4) |
| `ShipDate` | 2024-01-25 | `shipDate` | **nuevo (nativo)** |
| `Quantity` / `Price` / `DiscountPercent` | 3 / 100 / 0 | `quantity` / `price` / `discountPct` | ya existe |
| `WarehouseCode` | 101-1001 | `warehouseId` | resolver whsCode |
| `AccountCode` | 11302001 | `acctCode` | ya existe |
| `VatGroup`/`TaxCode` + `TaxPercentagePerRow` + `TaxTotal` | IVA / 13 / 44.83 | `taxIndicatorId` / `taxRate` / `taxAmount` | ya existe |
| `LineTotal` / `GrossTotal` | 300 / 344.83 | `subtotal` / `lineTotal` | ya existe |
| `BaseType` / `BaseEntry` / `BaseLine` | -1 / null / null | `baseDoc*` | origen (aquí: documento libre) |
| `CostingCode2-5` / `ProjectCode` | null | `dimension2-5` / `projectCode` | ya existe |
| `UoMCode` / `MeasureUnit` | Manual / UND | `uomId` | ya existe |

### UDF (`U_*`) — NO fuente de verdad (política)

`U_TIPODOC`, `U_NIT`, `U_RAZSOC`, `U_CODCTRL`, `U_NROAUTOR`, `U_BAG_*`, `U_FE_*`,
`U_CXS_*`, `U_ORIGIN`, `U_TIPO_ESTADO_ERP`, `U_WOO_*`… → ignorados en la capa de
integración. Si alguno es útil (p. ej. `U_FE_*` para facturación electrónica SIN)
se evalúa aparte, nunca como fuente de verdad.

## 3. Mapeo pendiente (a validar con payloads del usuario)

### 3.1 Validado — Purchase Order (payload real DocEntry 414480)

Mismo estándar de cabecera que la cotización (identity + `Reference2` + `DocTime`
+ `Series` + `ControlAccount` 21105002). Particularidades:

| SAP B1 | Valor | ERP | Acción |
|--------|-------|-----|--------|
| `DocEntry` / `DocNum` / `odata.etag` | 414480 / 260010082 | `sapDocEntry` / `sapDocNum` / `sapEtag` | identidad |
| `WareHouseUpdateType` | `dwh_OrdersFromVendors` | — | confirma que en recepción puede venir `dwh_Consignment` → `isConsignment` |
| `BaseType` / `BaseEntry` / `BaseLine` | -1 / null / null | `baseDoc*` + `purchaseQuotationId` | pedido origen (libre); si SAP lo crea desde cotización → BaseType 540000006 → resolver cotización local por `sapDocEntry` |
| `CostingCode` / `CostingCode2` | 13101 / BLA | `dimension1` / `dimension2` | ⚠️ revisar: ventas mapea CostingCode2-5→dimension2-5; aquí `CostingCode`→dimension1 |
| `PaymentMethod` | BCP_TRANS-MN | — (informativo) | el ERP usa `paymentTermsId` |
| `ShipDate` líneas | 2026-09-03 (= DocDueDate) | `shipDate` | fecha de entrega planificada |
| `LineNum` 0-4 | — | `sapLineNum` | resolución BaseLine |
| `U_CONDPAGO` | "CREDITO 60 DIAS" | — (UDF) | no fuente de verdad |

**Regla de herencia confirmada:** el pedido importado guarda su PROPIO
`sapDocEntry`; el origen (cotización) se resuelve por `BaseEntry` → cotización
local por `sapDocEntry` → `purchaseQuotationId` (NUNCA hereda `sapDocEntry`).

### 3.2 Validado — Purchase Delivery Note / Recepción (payload real DocEntry 97804)

| SAP B1 | Valor | ERP | Acción |
|--------|-------|-----|--------|
| `DocEntry` / `DocNum` / `odata.etag` | 97804 / 260008418 | `sapDocEntry` / `sapDocNum` / `sapEtag` | identidad |
| `WareHouseUpdateType` | `dwh_Stock` | `isConsignment` | **confirmado**: `dwh_Consignment` → true |
| `BaseType` / `BaseEntry` / `BaseLine` | 22 / 414128 / 0 | `purchaseOrderId` + `orderItemId`/`baseLineId` | origen pedido por `sapDocEntry` |
| `ShipDate` (línea) | 2026-08-31 | `shipDate` | fecha planificada |
| `ActualDeliveryDate` (línea) | 2026-08-29 | `deliveryDate` (recepción) | fecha real |
| `DocumentStatus` + `InventoryStatus` | `bost_Close` | `status` CLOSED | sync de cierre (pedido completo) |
| `LineStatus` / `RemainingOpenInventoryQuantity` | `bost_Close` / 0 | `lineStatus` CLOSED / `openQty` | cierre de línea |
| `Reference2` / `DocTime` / `Series` / `ControlAccount` | null / 09:06:00 / 631 / 21105002 | `reference2` / `docTime` / `sapSeries` / `sapControlAccount` | estándar |

**Verificación del modelo real (schema):** `PurchaseReceipt` ya tiene
`purchaseOrderId` (origen pedido) ✅, `status`, `contactPerson`/`shipToAddress`/
`paymentTermsId`/`dueDate` ✅. `PurchaseReceiptItem` ya tiene `orderItemId`,
`baseDoc*`, `dimension1` ✅. **Faltan por agregar:** identity block +
`reference2`/`docTime`/`sapSeries`/`isConsignment` en header; `shipDate`/
`sapLineNum` en línea. `deliveryDate` (ActualDeliveryDate) NO existe en la
recepción → decisión de implementación: agregar el campo (simetría con
`DeliveryOrder.deliveryDate`) o usar `date`.

### 3.3 Validado — Purchase Invoice / FRC (factura de reserva de compra, DocEntry 165518)

**Figura confirmada por el usuario (misma que ventas):** FRC ↔ recepción
(`BaseType 20` + `BaseEntry` 97804 = recepción); **factura normal SIN vínculo a
recepción/entrega** (origen libre o pedido).

| SAP B1 | Valor | ERP | Acción |
|--------|-------|-----|--------|
| `BaseType` / `BaseEntry` / `BaseLine` | 20 / 97804 / 0 | `purchaseReceiptId` + línea por `sapLineNum` | origen recepción |
| `PaidToDate` | 0.0 | `paidAmount` / `balanceDue` | **nuevo** en `PurchaseInvoice` (saldo, como NC) |
| `DocumentInstallments[]` | DueDate/Percentage/Total | `InvoiceInstallment` | cuotas (verificar soporte en compras) |
| `ControlAccount` | 21105002 | `sapControlAccount` | en `PurchaseInvoice` ✅ |
| `NumAtCard` | "694" | `referenceNo` | referencia del proveedor (alias existente) |
| `ReserveInvoice` | "tNO" | — | ⚠️ NO distingue FRC aquí; usar BaseType 20 / InventoryStatus bost_Open |
| `AttachmentEntry` | 128504 | `DocumentAttachment` | anexo |
| `Reference2` / `DocTime` / `Series` | null / 21:28:00 / 607 | `reference2` / `docTime` / `sapSeries` | estándar |
| líneas: `ShipDate` / `LineNum` / `AccountCode` 11304004 | — | `shipDate` / `sapLineNum` / `acctCode` | estándar |

**Arquitectura verificada en código (2026-09-02):** la FRC ya está **unificada** en
`PurchaseInvoice.isReserve` (`'Y'` = FRC, no mueve stock; `'N'` = FPI directa) —
`purchase-reserve-invoices.service` es un **wrapper** que delega en
`purchase-invoices.service` (`createFromReceipt/createFromQuotation/createFromOrder`).
`PurchaseReserveInvoice` = modelo **legacy read-only** (como `SaleReserveInvoice` en
ventas). La capa SAP de la Fase 3.8 se agrega a **`PurchaseInvoice`** (+ líneas
`PurchaseInvoiceItem`), que **ya tiene** `isReserve`, `purchaseReceiptId`,
`paidAmount`/`balanceDue` ✅. `PurchaseReserveInvoice` se documenta como legacy.

### 3.4 Validado — Purchase Return / Devolución (payload real DocEntry 3209)

| SAP B1 | Valor | ERP | Acción |
|--------|-------|-----|--------|
| `BaseType` / `BaseEntry` / `BaseLine` | 20 / 97585 / 0 | `purchaseReceiptId` + línea por `sapLineNum` | origen recepción (campo ya existe ✅) |
| `ReturnAction` / `ReturnReason` (línea) | **-1** / **-1** | `returnAction` / `returnReason` | ⚠️ **normalizar -1 → null** (sin motivo) |
| `Reference2` / `DocTime` / `Series` | null / 15:26:00 / 617 | `reference2` / `docTime` / `sapSeries` | estándar |
| líneas: `ShipDate` / `LineNum` / `CostingCode` | — | `shipDate` / `sapLineNum` / `dimension1` | estándar |

> `ControlAccount` 21105002 presente también aquí, pero se guarda solo en
> factura/NC (decisión de ventas). `WareHouseUpdateType` dwh_Stock (isConsignment
> aplica solo a recepción).

### 3.5 Validado — Purchase Credit Note / NC de compra (payload real DocEntry 2387)

**Figura confirmada por el usuario:** NC ↔ **factura de proveedor NORMAL**
(`BaseType 18` + `BaseEntry` 156170). DocType `dDocument_Service` + `ItemCode:
null` + `AccountCode` directo (11901001) → **línea de SERVICIO con cuenta
contable directa, sin artículo**.

| SAP B1 | Valor | ERP | Acción |
|--------|-------|-----|--------|
| `BaseType` / `BaseEntry` / `BaseLine` | 18 / 156170 / 0 | `purchaseInvoiceId` + línea por `sapLineNum` | origen factura normal (campo ya existe ✅) |
| **`PaidToDate`** | **6054.3** (= DocTotal) | `paidAmount` / `balanceDue` | NC **totalmente abonada**: paidAmount=6054.3, balanceDue=0 — `balanceDue` ya existe; **falta `paidAmount`** en `PurchaseCreditNote` |
| **`ItemCode: null` + `AccountCode` directo** | — | ⚠️ **DECISIÓN PENDIENTE** | el ERP exige `itemId` (obligatorio en DTO y modelo) — ver §4.2 |
| `ReturnAction` / `ReturnReason` | -1 / -1 | `returnAction` / `returnReason` | normalizar -1 → null |
| `NumAtCard` | "42506" | `referenceNo` | referencia del proveedor |
| `ControlAccount` | 21105002 | `sapControlAccount` | en `PurchaseCreditNote` ✅ |
| `Reference2` / `DocTime` / `Series` | null / 14:53:00 / 615 | `reference2` / `docTime` / `sapSeries` | estándar |
| líneas: `CostingCode` 14300 + `CostingCode2` OPE + `CostingCode3` 1000 | — | `dimension1-3` | estándar |

### 3.6 Validado — Payments / pago saliente (payload real DocEntry 2111628926)

> El payload recibido es un cobro (`rCustomer`, incoming) pero SAP B1 usa el
> **mismo objeto `Payments`** para el pago saliente (cambia `DocTypte: rSupplier`);
> el patrón de aplicación es idéntico. Aplica a `OutgoingPayment`.

| SAP B1 | Valor | ERP | Acción |
|--------|-------|-----|--------|
| `DocEntry` / `DocNum` / `odata.etag` | 2111628926 / 261232016 | `sapDocEntry` / `sapDocNum` / `sapEtag` | identidad |
| `PaymentInvoices[].DocEntry` + `SumApplied` | 2284363 / 27856.3 | `OutgoingPaymentLine.purchaseInvoiceId` (o `purchaseReserveInvoiceId`) + `amount` | resolver factura local por `sapDocEntry` |
| `PaymentInvoices[].InvoiceType` | `it_Invoice` | factura / **`it_CreditMemo`** → NC (vía header `outgoingPaymentId`) | vínculo NC |
| `PaymentInvoices[].LineNum` | 0 | `OutgoingPaymentLine.sapLineNum` | **nuevo** |
| `PaymentCreditCards[]` | CreditSum 27856.3, CreditAcct 11105019 | `OutgoingPaymentMethod` method=CARD + cuenta | método de pago |
| `PaymentChecks[]` / `CashSum` / `TransferSum` | — | CHECK / CASH / BANK_TRANSFER | métodos |
| `PaymentAccounts[]` | — | `OutgoingPaymentAccountLine` | cuentas |
| `PaymentInvoices[].DistributionRule3` | "1000" | `dimension3` (si se soporta) | opcional |
| `Reference2` / `DocTime` / `Series` | null / — / 620 | `reference2` / `docTime` / `sapSeries` | estándar (sin sapControlAccount, igual que IncomingPayment) |
| `WTCode` / `WTAmount` | null / 0 | `withholdingTaxTypeId` / `withholdingAmount` | retención (ya existe) |

**Modelo verificado:** `OutgoingPaymentLine` ya tiene `purchaseInvoiceId`/
`purchaseReserveInvoiceId`/`amount` ✅ (falta `sapLineNum`); `OutgoingPaymentMethod`
tiene `method`/`amount`/`cashAccountId`/`bankAccountId` ✅; `OutgoingPaymentAccountLine`
tiene `accountId`/`amount` ✅. La NC se vincula por `PurchaseCreditNote.outgoingPaymentId`
(como en ventas `SalesCreditNote.incomingPaymentId`).

### 3.7 Pendientes (a validar)

| Documento | Puntos a validar |
|-----------|------------------|
| A/P Invoice normal | confirmar SIN vínculo a recepción; retenciones; `ControlAccount` |

## 4. Hallazgos técnicos (pre-implementación)

1. **⚠️ Resolvers de alias no usan códigos SAP.** `resolveCardCode`/`resolveItemCode`
   (`src/common/sap-alias.util.ts`) buscan solo en `Partner.code` / `Item.code`, y los
   alias de salida (`sap-alias-response.util.ts`) emiten `code`. Pero el ERP ya persiste
   `Partner.sapCardCode` y `Item.sapItemCode` (únicos por tenant). Para el conector con
   `CardCode`/`ItemCode` reales de SAP (PL001360 / LBLAUDI010007), los resolvers deben
   buscar **primero** `sapCardCode`/`sapItemCode` y **fallback** a `code`. Afecta también
   a ventas (mismo helper) — se corrige en la Fase 3.8 (beneficio cruzado).
2. **✅ DECISIÓN (2026-09-02, usuario) — líneas de servicio sin artículo (cuenta directa).**
   La NC (y factura) de compra de SERVICIOS llega con `ItemCode: null` + `AccountCode`
   (cuenta contable directa, p. ej. 11901001 póliza de seguro). **Decisión: soporte
   nativo** — extender el ERP para manejar líneas sin artículo con `acctCode` directo,
   **tanto para ventas como para compras**. **Diseño propuesto (en validación): toggle
   por LÍNEA "Artículo / Cuenta (servicio)"** en `luna-document-lines` (SAP permite
   documentos mixtos).
   Alcance técnico (sub-fase 3.8.5):
   - Schema: `itemId` **nullable** en `SaleInvoiceItem` / `SalesCreditNoteItem` /
     `PurchaseInvoiceItem` / `PurchaseCreditNoteItem` (+ relación opcional). Los 4
     modelos verificados: hoy `itemId Int` obligatorio.
   - DTOs: `itemId` opcional + `acctCode` (obligatorio si no hay ítem) + `description`.
   - **Motor contable (verificado):** los builders ya usan `line.acctCode ??
     resolveAccount(...)` (sales.journal-builder L126, purchases L174) — con guard
     `itemId == null → acctCode obligatorio`; saltar ICE/COGS/inventario en líneas sin
     ítem (`iceByItem.get(line.itemId)` L139 requiere guard).
   - Servicios/validaciones: sin movimiento de stock, almacén, batch/serial ni tracking;
     `Quantity` puede ser 0 (monto puro); subtotal = monto directo.
   - Frontend: toggle por línea en `luna-document-lines` — modo cuenta intercambia la
     celda ítem por descripción + `app-account-selector` (reutiliza `manualAccount`).
   - Tests: creación factura/NC de servicio sin ítem + asiento con cuenta directa.
3. `sapControlAccount` en compras → `PurchaseInvoice` + `PurchaseCreditNote` (cuenta de
   control CxP), no en cotización/pedido (aunque el payload de cotización lo traiga).
4. `isConsignment` → `PurchaseReceipt` (WareHouseUpdateType dwh_Consignment).
5. Herencia de identidad: el documento hijo (pedido desde cotización, recepción desde
   pedido, factura desde recepción, NC desde factura) **no hereda** `sapDocEntry` del
   origen; guarda el origen en `baseDoc*`/FK (`purchaseOrderId`/`purchaseReceiptId`/
   `purchaseInvoiceId`).
6. **`ReturnAction`/`ReturnReason: -1`** en SAP = sin motivo → el conector normaliza
   `-1 → null`.
7. Migración: patrón shadow-db (`prisma migrate diff`), strip de DROP de
   `_BulkImportLock`/`_manual_migrations`, aplicar + `migrate resolve` + `prisma generate`
   (backend detenido).

## 5. Sub-fases de implementación (una vez validado el mapeo)

- **3.8.1** Cotización + pedido de compra (schema + migración + helper + DTOs + services + frontend + tests).
- **3.8.2** Recepción + factura + factura reserva (+ `sapControlAccount`, `isConsignment`, `paidAmount`/`balanceDue`).
- **3.8.3** Pago saliente (OutgoingPayment).
- **3.8.4** Devolución + NC de compra (+ `paidAmount`/`balanceDue`, `returnAction`/`returnReason` -1→null).
- **3.8.5** **Líneas de servicio sin artículo (ItemCode null + AccountCode)** en ventas y compras — decisión del usuario (schema itemId nullable + motor contable con cuenta directa + frontend).
- **3.8.6** Fix de resolvers (sapCardCode/sapItemCode) + docs + ROADMAP + push origin/deploy.

## 6. Entry points para inyectar idempotencia + preservación (mapeo read-only)

| Módulo | Método | Línea | Acción |
|--------|--------|-------|--------|
| purchase-quotations | `create` | 84 | `assertSapDocEntryAvailable` + persistir identidad |
| purchase-quotations | `update` | 402 | preservación condicional (solo si `!== undefined`) |
| purchase-quotations | `convertToOrderDraft` | 802 | NO heredar identidad al pedido (regla backorder) |
| purchase-orders | `createFromDraft` | 267 | idempotencia + identidad |
| purchase-orders | `createFromMultiQuotation` | 815 | idempotencia + identidad |
| purchase-orders | `createManual` | 1251 | idempotencia + identidad |
| purchase-orders | `update` | 2324 | preservación condicional |

> Estado 2026-09-02 (ronda 4): **BLOQUEADO por insumos del usuario** — pendientes:
> payloads de compras (orden de compra, recepción, factura, NC, devolución, pago)
> y decisión A/B del resolver (`sapCardCode`/`sapItemCode` vs `code` interno).
> El mapeo de la cotización ya está validado; la implementación es inmediata al desbloquear.
