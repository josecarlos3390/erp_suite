# SAP B1 — Capa de integración bidireccional (referencia canónica)

> **Estado:** capa de datos completada (2026-08-31). El conector real contra el SAP
> Service Layer es la pieza pendiente (ROADMAP F5.3).
> **Versión:** 1.0 — flujo de ventas completo (11 modelos).

---

## 1. Objetivo

Preparar la capa de persistencia para la **integración bidireccional con SAP B1**
(Service Layer, REST/OData). Cada documento del flujo de ventas puede:
- **Importarse** desde SAP identificándolo por su `DocEntry` (`sapDocEntry`) sin duplicados.
- **Exportarse** a SAP y marcar su estado de sincronización (`syncStatus`).
- **Actualizarse** desde el conector (identidad/etag/estado) sin que las ediciones
  normales de la UI borren la identidad sincronizada.

## 2. Modelos integrados

| Modelo | Campos SAP header | Campos SAP línea | Unicidad |
|--------|-------------------|------------------|----------|
| `SalesQuotation` / `SalesQuotationItem` | `sapDocEntry` `sapDocNum` `sapEtag` `syncStatus` `lastSyncedAt` `lastSyncError` + **`reference2` `docTime` `sapSeries`** | `shipDate` `sapLineNum` | `@@unique([tenantId, sapDocEntry])` |
| `SalesOrder` / `SalesOrderItem` | ídem | `shipDate` `sapLineNum` | ídem |
| `DeliveryOrder` / `DeliveryOrderItem` | ídem (+ **`isConsignment`**) | `shipDate` `sapLineNum` | ídem |
| `SaleInvoice` / `SaleInvoiceItem` | ídem (+ `isReserve`, **`sapControlAccount`**) | `shipDate` `sapLineNum` | ídem |
| `SaleReserveInvoice` / `SaleReserveInvoiceItem` | ídem (modelo legacy solo-lectura, ver §6) | `shipDate` `sapLineNum` | ídem |
| `IncomingPayment` / `IncomingPaymentLine` | ídem | `sapLineNum` | ídem |
| `SalesReturn` / `SalesReturnItem` | ídem | `shipDate` `sapLineNum` + **`returnAction` `returnReason` `returnCost` `enableReturnCost`** | ídem |
| `SalesCreditNote` / `SalesCreditNoteItem` | ídem (+ `paidAmount`/`balanceDue`, **`sapControlAccount`**) | `shipDate` `sapLineNum` + **`returnAction` `returnReason`** | ídem |
| `PurchaseQuotation` / `PurchaseQuotationItem` | ídem (Fase 3.8) | `shipDate` `sapLineNum` | ídem |
| `PurchaseOrder` / `PurchaseOrderItem` | ídem (Fase 3.8) | `shipDate` `sapLineNum` | ídem |
| `PurchaseReceipt` / `PurchaseReceiptItem` | ídem (+ **`isConsignment`**, Fase 3.8) | `shipDate` `sapLineNum` | ídem |
| `PurchaseInvoice` / `PurchaseInvoiceItem` | ídem (+ `isReserve`, **`sapControlAccount`**, `paidAmount`, Fase 3.8) | `shipDate` `sapLineNum` | ídem |
| `PurchaseReserveInvoice` / `PurchaseReserveInvoiceItem` | ídem (modelo legacy read-only, Fase 3.8) | `shipDate` `sapLineNum` | ídem |
| `OutgoingPayment` / `OutgoingPaymentLine` | ídem (Fase 3.8) | `sapLineNum` | ídem |
| `PurchaseReturn` / `PurchaseReturnItem` | ídem (Fase 3.8) | `shipDate` `sapLineNum` + **`returnAction` `returnReason`** | ídem |
| `PurchaseCreditNote` / `PurchaseCreditNoteItem` | ídem (+ `paidAmount`/`balanceDue`, **`sapControlAccount`**, Fase 3.8) | `shipDate` `sapLineNum` + **`returnAction` `returnReason`** | ídem |

Campos comunes:

```prisma
sapDocEntry    Int?       // SAP B1: DocEntry (identidad del documento)
sapDocNum      String?    // SAP B1: DocNum (número visible)
sapEtag        String?    // SAP B1: odata.etag (optimistic locking del Service Layer)
syncStatus     SapSyncStatus @default(PENDING)  // PENDING | SYNCED | FAILED
lastSyncedAt   DateTime?
lastSyncError  String?
```

`SapSyncStatus`: `PENDING` = local sin exportar (o importado pendiente), `SYNCED` =
consistente con SAP, `FAILED` = último intento falló (ver `lastSyncError`).

## 3. Idempotencia — `assertSapDocEntryAvailable`

`src/common/sap-identity.util.ts` — verifica ANTES de crear/actualizar que el
`sapDocEntry` no colisione con otro documento del mismo tenant:

```ts
await assertSapDocEntryAvailable(tx, tenantId, 'salesOrder', dto.sapDocEntry, excludeId?);
```

- Soporta: `salesQuotation | salesOrder | deliveryOrder | saleInvoice | saleReserveInvoice | incomingPayment | salesReturn | salesCreditNote` **+ compras (Fase 3.8):** `purchaseQuotation | purchaseOrder | purchaseReceipt | purchaseInvoice | purchaseReserveInvoice | outgoingPayment | purchaseReturn | purchaseCreditNote` (16 documentos).
- Duplicado → `ConflictException` (HTTP 409) con mensaje claro:
  `Ya existe un pedido (PED-000035) con sapDocEntry 9100`.
- El índice único `@@unique([tenantId, sapDocEntry])` queda como red contra carreras
  (Postgres permite múltiples NULLs, por eso los documentos locales sin identidad conviven).

## 4. Mapeo de documentos SAP B1 → ERP

### Códigos de relación (campo `BaseType` en líneas)

| BaseType | Objeto SAP | Nuestro ERP |
|----------|------------|-------------|
| 23 | Sales Quotation | `quotationId` / `quotationItemId` |
| 17 | Sales Order | `orderId` / `orderItemId` |
| 15 | Delivery Note | `deliveryOrderId` / `deliveryOrderItemId` (o `baseDoc*`) |
| 13 | A/R Invoice | `saleInvoiceId` / `saleInvoiceItemId` |
| 14 | A/R Credit Memo | `salesCreditNoteId` |
| -1 | Sin base (documento origen) | `null` (libre) |

Resolución del conector: `BaseEntry` → documento local por `sapDocEntry`;
`BaseLine` → línea local por `sapLineNum`.

### Cabecera (campos nativos mapeados)

| SAP B1 | ERP | Notas |
|--------|-----|-------|
| `DocEntry` / `DocNum` / `odata.etag` | `sapDocEntry` / `sapDocNum` / `sapEtag` | identidad |
| `DocDate` / `TaxDate` / `DocDueDate` | `date` / `postingDate` / `dueDate` | |
| `CardCode` | `partnerId` | vía `Partner.sapCardCode` (`resolveSapAliases`) |
| `DocCurrency` / `DocRate` | `currency` / `exchangeRate` | |
| `Comments` / `Reference1` / `NumAtCard` | `notes` / `referenceNo` | `NumAtCard` = `referenceNo` (alias) |
| `SalesPersonCode` | `salesPersonId` | |
| `DocTotal` / `VatSum` / `DiscountPercent` | `total` / `tax` / `headerDiscountPct` | |
| `ShipToCode` | `shipToAddress` | |
| `ItemCode` / `WarehouseCode` | `itemId` / `warehouseId` | vía `sapItemCode` / `whsCode` |
| `AccountCode` / `CostingCode2-5` / `ProjectCode` | `acctCode` / `dimension2-5` / `projectCode` | |
| `TaxCode` / `TaxPercentagePerRow` | `taxIndicator` / `taxRate` | IVA Bolivia 13% |
| `U_*` | `customFields` | UDF crudos, sin estructura |
| `DocumentStatus` / `Cancelled` | `status` (OPEN/CLOSED/CANCELLED) | sync de estados (pendiente en el conector) |

### Factura reserva vs normal

| SAP B1 | ERP |
|--------|-----|
| `ReserveInvoice: "tYES"` + `InventoryStatus: "bost_Open"` | `SaleInvoice.isReserve = 'Y'` (no mueve inventario) |
| `ReserveInvoice: "tNO"` + `InventoryStatus: "bost_Close"` | `SaleInvoice.isReserve = 'N'` (factura normal) |

### Pagos recibidos

| SAP B1 | ERP |
|--------|-----|
| `PaymentInvoices[].DocEntry` + `SumApplied` | `IncomingPaymentLine.saleInvoiceId` (o reserva) + `amount` |
| `PaymentInvoices[].LineNum` | `IncomingPaymentLine.sapLineNum` |
| `PaymentChecks[]` / `PaymentCreditCards[]` / `CashSum` / `TransferSum` | `IncomingPaymentMethod` (CHECK / CARD / CASH / BANK_TRANSFER) |
| `PaymentAccounts[]` | `IncomingPaymentAccountLine` |
| `WTAmount` | `withholdingAmount` |
| `Remarks` / `Reference1` | `notes` / `referenceNo` |

### Nota de crédito ↔ abono (relación NATIVA)

- La NC **no** tiene campo que apunte al pago; la relación vive en el **pago**:
  `PaymentInvoices[].InvoiceType: "it_CreditMemo"` + `DocEntry` = DocEntry de la NC.
- El conector, al importar el pago/abono, detecta `it_CreditMemo`, resuelve la NC por
  `sapDocEntry` y la vincula (`SalesCreditNote.incomingPaymentId`) + suma a
  `paidAmount`/`balanceDue`.
- En el ERP el abono ya se genera al confirmar la NC (ver §5). Los UDF personalizados
  (p. ej. `U_CXS_BREF`) **no** son fuente de verdad.

## 4b. Enriquecimiento de datos nativos (Fase 3.7)

Campos **nativos de SAP B1** que se extrajeron de los payloads (no UDF) y se
persistieron para potenciar el ERP:

| Campo ERP | SAP B1 | Modelos | Uso |
|-----------|--------|---------|-----|
| `reference2` | `Reference2` | los 8 headers | Segunda referencia del documento (reportes/conciliaciones) |
| `docTime` | `DocTime` ("HH:MM:SS") | los 8 headers | Hora del documento (matcheo del conector, auditoría) |
| `sapSeries` | `Series` | los 8 headers | Serie de numeración SAP (referencia outbound) |
| `sapControlAccount` | `ControlAccount` | `SaleInvoice`, `SalesCreditNote` | Cuenta de control (CxC) asignada por SAP |
| `isConsignment` | `WareHouseUpdateType: dwh_Consignment` | `DeliveryOrder` | Venta en consignación (sin movimiento del almacén propio) |
| `returnAction` / `returnReason` | `ReturnAction` / `ReturnReason` | `SalesReturnItem`, `SalesCreditNoteItem` | Motivo de la devolución/NC (Reason Codes de SAP) |
| `returnReasonId` | — (maestro propio) | `SalesReturnItem`, `SalesCreditNoteItem` | FK al dato maestro `ReturnReason` (reportes de motivos) |
| `returnCost` / `enableReturnCost` | `ReturnCost` / `EnableReturnCost` | `SalesReturnItem` | Costo del retorno |

> `ReturnReason`/`ReturnAction` son datos maestros de SAP (Reason Codes). En el
> ERP existe la **tabla maestra `ReturnReason`** (`kind` ACTION|REASON, `sapCode`
> referencial, `isActive`, `sortOrder`) con CRUD en `GET/POST/PATCH/DELETE
> /return-reasons`, UI en `/return-reasons` y seed del catálogo inicial.
> `SalesReturnItem.returnReasonId` / `SalesCreditNoteItem.returnReasonId` (FK)
> vinculan las líneas al maestro para **reportes de motivos**; el código SAP
> crudo se conserva en `returnAction`/`returnReason` para el conector.

### UX/UI en el frontend (Fase 3.7b)

Cada campo nativo agregado tiene su contraparte visual en los formularios:

| Campo | Componente UI | Formularios |
|-------|---------------|-------------|
| `reference2` / `docTime` / `sapSeries` | `app-sap-integration-section` (campos editables con su FormGroup propio, emiten `sapFieldsChange`) | los 8 documentos de ventas |
| Identidad SAP (`sapDocEntry`/`sapDocNum`/`sapEtag`) + badge `syncStatus` + `lastSyncedAt`/`lastSyncError` | `app-sap-integration-section` (solo lectura) | los 8 documentos de ventas |
| `sapControlAccount` | `app-sap-integration-section` (solo lectura, fila condicional) | `SaleInvoice`, `SalesCreditNote` |
| `isConsignment` | `luna-checkbox` en la cabecera | `DeliveryOrder` |
| `returnAction` / `returnReason` | celdas custom del detalle (`luna-input` numérico) | `SalesReturn`, `SalesCreditNote` |
| `returnCost` / `enableReturnCost` | celdas custom del detalle (`luna-input` + `luna-checkbox`) | `SalesReturn` |

El componente vive en `erp-frontend/src/app/shared/sap-integration/` y se reutiliza
con los inputs `sapDocEntry/sapDocNum/sapEtag/syncStatus/lastSyncedAt/lastSyncError/
values/readonly` y el output `sapFieldsChange`. El payload de update incluye
`...this.sapFields` para persistir Reference2/DocTime/Series junto al documento.

## 5. Abono de la nota de crédito (flujo del ERP)

`SalesCreditNote` ya genera el abono a favor del cliente:

```ts
// sales-credit-notes.service.ts (_executeConfirmLogic)
const refundable = note.saleInvoiceId ? noteTotal - debtCovered : 0;
if (refundable > 0) {
  // crea IncomingPayment: paymentMethod='CREDIT_NOTE', isAdvance=true,
  //   advanceBalance=refundable  → vincula incomingPaymentId + DocumentLink
  //   + updatePartnerBalance(advanceAR)
}
// y actualiza la NC: status=CLOSED, paidAmount=refundable, balanceDue=max(total-refundable,0)
```

`paidAmount`/`balanceDue` (agregados en Fase 3.6) reflejan el abono parcial estilo
SAP `PaidToDate` vs `DocTotal`.

## 6. Decisiones de diseño relevantes

1. **Preservación condicional:** los campos SAP solo se persisten en update si el
   payload los trae (`dto.sapDocEntry !== undefined`). Una edición normal desde la
   UI no borra la identidad sincronizada.
2. **Backorder:** es un documento NUEVO → no hereda la identidad del original
   (chocaría con el índice único); inicia `PENDING` y el conector le asigna DocEntry propio.
3. **Dualidad factura reserva:** `SaleReserveInvoice` (modelo separado) es
   solo-lectura (movement checkers, métricas, document-flow); el flujo de escritura
   (`sale-reserve-invoices`) persiste en `SaleInvoice.isReserve='Y'`. El conector usa
   `SaleInvoice` con `isReserve`.
4. **`referenceNo` es el `NumAtCard`** — no se agregó una columna `numAtCard` duplicada.
5. **UDF personalizados de SAP** (`U_CXS_*`, `U_FE_*`, `U_WOO_*`, `U_BAG_*`, `U_OCIMP*`):
   viajan a `customFields` como datos crudos; no son estructura del ERP.

## 7. Migraciones

Aplicadas local + Railway (`prisma migrate deploy` en `scripts/start-prod.sh`):

| Migración | Contenido |
|-----------|-----------|
| `20260901010000_partner_currencies` | Monedas permitidas de socios (BPCurrenciesCollection) |
| `20260902010000_sap_integration_fields` | `sapItemCode`/`sapCardCode` + sync en Item/Partner |
| `20260902020000_sap_quotation_fields` | Cotizaciones: identidad SAP + `shipDate`/`sapLineNum` |
| `20260902030000_sap_order_fields` | Pedidos: identidad SAP + `shipDate`/`sapLineNum` |
| `20260902040000_sap_doc_sync_fields` | Ciclo sync en cotizaciones/pedidos + índice único |
| `20260902050000_sap_delivery_fields` | Entregas: identidad SAP + `shipDate`/`sapLineNum` |
| `20260902060000_sap_invoice_fields` | Facturas: identidad SAP + `shipDate`/`sapLineNum` |
| `20260902070000_sap_reserve_invoice_fields` | Factura reserva (modelo legacy): identidad SAP |
| `20260902080000_sap_payment_fields` | Pagos recibidos: identidad SAP + `sapLineNum` |
| `20260902090000_sap_return_fields` | Devoluciones: identidad SAP + `shipDate`/`sapLineNum` |
| `20260902100000_sap_credit_note_fields` | NC: identidad SAP + `paidAmount`/`balanceDue` |

> Nota de proceso: la shadow DB local tiene drift; las migraciones se generan con
> `prisma migrate diff --from-url <local> --to-schema-datamodel ...`, se depuran las
> `DROP TABLE` de tablas de infraestructura (`_BulkImportLock`, `_manual_migrations`),
> se aplican con `prisma db execute` y se marcan con `prisma migrate resolve --applied`.

## 8. Patrón de uso del conector (pendiente F5.3)

```ts
// Inbound (SAP → ERP): importar con identidad completa
await assertSapDocEntryAvailable(tx, tenantId, 'salesOrder', sap.DocEntry);
// → create con { sapDocEntry: sap.DocEntry, sapDocNum: sap.DocNum,
//                sapEtag: sap['odata.etag'], syncStatus: 'SYNCED', ... }

// Outbound (ERP → SAP): exportar y marcar
// → PATCH { syncStatus: 'SYNCED'|'FAILED', lastSyncedAt, lastSyncError, sapEtag }
//   (preservación condicional: solo estos campos, sin tocar el resto)

// Vínculo con factura/NC desde el pago
// PaymentInvoices[].InvoiceType === 'it_CreditMemo' → resolver NC por sapDocEntry
// PaymentInvoices[].InvoiceType === 'it_Invoice'    → resolver factura por sapDocEntry
```

## 9. Pendientes

- [ ] **Conector real** al SAP Service Layer (auth, push/pull, cola de reintentos) — ROADMAP F5.3.
- [ ] **Sync de estados**: `DocumentStatus` (`bost_Close`/`bost_Paid`) y `Cancelled` → `status`.
- [ ] **Flujo de compras**: replicar el patrón en `PurchaseRequest` → `PurchaseQuotation` →
      `PurchaseOrder` → `PurchaseReceipt` → `PurchaseInvoice` → `OutgoingPayment` → `PurchaseReturn`/`PurchaseCreditNote`.
- [ ] **Maestros**: sincronizar primero `Item.sapItemCode` + `Partner.sapCardCode` (prerequisito del conector).
