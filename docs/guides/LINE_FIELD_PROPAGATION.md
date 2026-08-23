# Propagación de campos de línea entre documentos (flujos de copia)

> **Última actualización:** 2026-08-22.
> **Ámbito:** flujos de conversión/copia de documentos comerciales (ventas, compras, inventario).
> **Regla canónica:** *todo campo estándar de línea debe viajar por un flujo de la misma forma que lote/serie*: si un dato existe en la línea origen, debe llegar a la línea destino.

---

## 1. El patrón de los 5 pasos

Para que un campo de línea (nuevo o existente) viaje por un flujo de conversión
(cotización→pedido→entrega→factura, directos, multi, FRV/FRC, NC, devoluciones),
debe estar presente en **los 5 puntos** de la cadena:

```
┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌────────────┐   ┌─────────────────┐
│ 1. Schema    │ → │ 2. Draft backend │ → │ 3. Mapper/build  │ → │ 4. Payload │ → │ 5. Create       │
│ (columna en  │   │ (el getDraft/get │   │ frontend (copia  │   │ (el form   │   │ backend (persist│
│ el modelo    │   │  One/getDraftMulti│   │  el campo a la   │   │  lo envía) │   │  la columna en  │
│ Prisma       │   │  devuelve el     │   │  línea del form) │   │            │   │  el doc destino)│
│ destino)     │   │  campo por ítem) │   │                  │   │            │   │                 │
└─────────────┘   └──────────────────┘   └──────────────────┘   └────────────┘   └─────────────────┘
```

**Checklist al agregar un campo de línea nuevo (ej. `miCampo`):**

- [ ] **1. Schema:** la columna existe en el modelo Prisma del documento **destino**
      (si el destino no la tiene, agregarla + migración). Ej.: `DeliveryOrderItem` no
      tiene `projectCode`/`dimension1`/`dimension2` — ver §4.
- [ ] **2. Draft backend:** el método de draft de conversión (`getDraft`, `getDraftFrom*`,
      `getDraftMulti*`) del origen devuelve el campo en los ítems de respuesta.
      Patrón: agregar el campo al objeto del ítem y, si hace falta alineación por
      índice, al array `trackingLines`/array paralelo.
- [ ] **3. Mapper/builder frontend:** el mapper (o builder inline del form) copia el campo
      del ítem origen a la línea del formulario (`campo: origen.campo ?? null`).
      NO hardcodear `null`/`[]`/`0` salvo que el flujo lo justifique explícitamente.
- [ ] **4. Payload:** el payload builder del form (`_linePayload*`) envía el campo.
      Regla: si el campo puede venir vacío (`{}`, `[]`, `null`), NO enviar un valor
      vacío cuando el origen lo tiene — ver el caso `customFields` en §3.
- [ ] **5. Create backend:** el método `createFrom*` persiste el campo en la línea creada.
      Si el payload puede traer vacío, usar fallback al valor del ítem origen:
      `campo: payload.campo ?? origen.campo ?? null`.

**Verificación:** `npm run build` + `npm run lint` + `npm test` (backend),
`npm run build` + `npm run lint` (frontend), y el E2E de trazabilidad
(`erp-frontend/e2e/traceability-flow.spec.ts`) que recorre los flujos con un artículo LOT.

---

## 2. Mapa de archivos por punto de la cadena

| Punto | Ventas | Compras |
|-------|--------|---------|
| Drafts backend | `src/sales-quotations/sales-quotations.service.ts` (`convertToOrderDraft`, `getDraft`), `src/sales-orders/sales-orders.service.ts` (`getDraftMultiQuotation`), `src/delivery-orders/delivery-orders.service.ts` (`getDraft`, `getDraftFromQuotation`, `getDraftMultiOrder`, `getDraftMultiQuotation`, `getDraftFromReserveInvoice`, `getDraftMultiReserveInvoice`), `src/sale-invoices/sale-invoices.service.ts` (drafts multi), `src/sale-reserve-invoices/sale-reserve-invoices.service.ts` (drafts) | `src/purchase-quotations/purchase-quotations.service.ts` (`getDraft`), `src/purchase-orders/purchase-orders.service.ts` (`getDraft`, `getDraftMultiQuotation`), `src/purchase-receipts/purchase-receipts.service.ts` (`getDraftMultiOrder`, `getDraftMultiQuotation`, `getDraftMultiReserveInvoice`), `src/purchase-invoices/purchase-invoices.service.ts` (drafts multi) |
| Mappers frontend | `src/app/pages/sale-invoices/mappers/*.ts`, `src/app/pages/sale-reserve-invoices/mappers/*.ts`, `src/app/pages/sales-orders/sales-orders-form.component.ts`, `src/app/pages/delivery-orders/delivery-orders-form.component.ts`, `src/app/pages/sales-credit-notes/sales-credit-notes-form.component.ts`, `src/app/pages/sales-returns/sales-returns-form.component.ts` | `src/app/pages/purchase-invoices/mappers/*.ts`, `src/app/pages/purchase-reserve-invoices/mappers/*.ts`, `src/app/pages/purchase-orders/purchase-orders-form.component.ts`, `src/app/pages/purchase-receipts/purchase-receipts-form.component.ts`, `src/app/pages/purchase-credit-notes/purchase-credit-notes-form.component.ts`, `src/app/pages/purchase-returns/purchase-returns-form.component.ts` |
| Creates backend | `src/sale-invoices/sale-invoices.service.ts`, `src/sale-reserve-invoices/sale-reserve-invoices.service.ts`, `src/sales-orders/sales-orders.service.ts`, `src/delivery-orders/delivery-orders.service.ts`, `src/sales-credit-notes/sales-credit-notes.service.ts`, `src/sales-returns/sales-returns.service.ts` | `src/purchase-invoices/purchase-invoices.service.ts`, `src/purchase-reserve-invoices/purchase-reserve-invoices.service.ts`, `src/purchase-orders/purchase-orders.service.ts`, `src/purchase-receipts/purchase-receipts.service.ts`, `src/purchase-credit-notes/purchase-credit-notes.service.ts`, `src/purchase-returns/purchase-returns.service.ts` |

---

## 3. Patrones y trampas conocidas

### 3.1 `customFields` — el `{}` vacío neutraliza el fallback del backend

Los payload builders del frontend envían `customFields: rv.customFields ?? {}`. Si la línea
origen tiene UDFs, el backend hace `line.customFields ?? origen.customFields` y el `{}`
del payload **siempre** gana → se pierden los UDFs.

**Regla (aplicada 2026-08-22 en `sale-invoices.service.ts` y `purchase-invoices.service.ts`):**
el backend debe tratar `{}` como "no provisto":

```ts
customFields:
  line.customFields && Object.keys(line.customFields).length
    ? line.customFields
    : (origen.customFields ?? {}),
```

Alternativa equivalente en el frontend: enviar `undefined` cuando el objeto está vacío.

### 3.2 `acctCode`, `uomId`, `weight` — no hardcodear null

Históricamente varios mappers hardcodeaban `acctCode: null` y los creates de FRV no
persistían `uomId`. Regla: `acctCode: origen.acctCode ?? null`, `uomId: origen.uomId ?? item.salesUomId ?? item.inventoryUomId ?? null`,
`weight: origen.weight ?? null`.

### 3.3 `cost` — excepción legítima

Los mappers order→invoice/FRV ponen `cost: null` a propósito; el draft-builder lo
resuelve después vía `resolveAvgCost` (`document-draft-builder.service.ts`). No "arreglar".

### 3.4 `baseDocType/baseDocId/baseLineId` en drafts

Los drafts de pedido/entrega/recepción no devuelven los campos `baseDoc*`; los creates
de factura los reconstruyen con `buildBaseFields`. El impacto es solo de preview en los
drafts; en devoluciones hay que completar `baseLineId`/`baseLineNum`/`baseQty` en el form.

---

## 4. Gaps pendientes (2026-08-22)

| # | Gap | Tipo | Dónde | Estado |
|---|-----|------|-------|--------|
| 1 | `projectCode`/`dimension1`/`dimension2` en `DeliveryOrderItem`, `PurchaseReceiptItem`, `SalesQuotationItem`, `PurchaseQuotationItem` | Schema (requiere migración) | `backend-erp/prisma/schema.prisma` | ✅ **RESUELTO (2026-08-22)**: columnas agregadas + `db push` + drafts y creates propagan pc/d1/d2. Pendiente: `SaleReserveInvoiceItem`, `PurchaseReserveInvoiceItem`, `SalesCreditNoteItem`, `PurchaseCreditNoteItem` aún no tienen las columnas |
| 2 | Ruta **FRV→factura rota**: el frontend posteaba a `/sale-invoices/from-reserve-invoice/:id` sin ruta (404) | Bug (404) | `backend-erp/src/sale-invoices/` | ✅ **RESUELTO (2026-08-22)**: `createFromReserveInvoice` implementado (DTO + service + controller). La FRV vive en la tabla `SaleInvoice` con `isReserve='Y'`; el método copia cabecera/líneas, enlaza (`baseDocType=SALE_RESERVE_INVOICE`), sincroniza tracking y ejecuta el confirm (el stock se mueve solo si la línea no vino de una entrega) |
| 3 | Drafts multi de `sale-invoices` (`getDraftMultiOrder`/`getDraftMultiQuotation`/`getDraftMultiDelivery`) no devuelven `uomId`/`discountTotal`/`projectCode`/dimensiones/`customFields`/`acctCode` por ítem | Draft | `backend-erp/src/sale-invoices/sale-invoices.service.ts` | ✅ **RESUELTO (2026-08-22)**: los 3 drafts devuelven uomId, taxAmount, pc/d1-d5, customFields, acctCode y lote/serie por ítem |
| 4 | Draft `purchase-orders.getDraft` (pedido→recepción) hardcodea `discountPct:null, discountAmt:null, discountTotal:0` | Draft | `backend-erp/src/purchase-orders/purchase-orders.service.ts` | ✅ **RESUELTO (2026-08-22)**: copia descuentos de la línea del pedido |
| 4b | `acctCode` no existía en `SalesOrderItem`/`SalesQuotationItem`/`PurchaseOrderItem`/`PurchaseQuotationItem` | Schema | `backend-erp/prisma/schema.prisma` | ✅ **RESUELTO (2026-08-22)**: columna + relación agregadas, db push, y los creates de pedidos la persisten |
| 5 | `weight`/`totalWeight` en NC venta/compra | Parcial | `src/sales-credit-notes.service.ts`, `src/purchase-credit-notes.service.ts` | ✅ **RESUELTO (2026-08-22)** |
| 6 | `baseDoc*` en devoluciones: `sales-returns-form` no completa `baseLineId`/`baseLineNum`/`baseQty` | Mapper | `erp-frontend/src/app/pages/sales-returns/sales-returns-form.component.ts:561-665` | ✅ **RESUELTO (2026-08-23)**: venta y compra completan `baseLineId`/`baseLineNum`/`baseQty` |
| 7 | `projectCode`/`dimension1`/`dimension2` en `SalesCreditNoteItem` y `PurchaseCreditNoteItem` | Schema | `backend-erp/prisma/schema.prisma` | ✅ **RESUELTO (2026-08-23)**: columnas + db push + creates de NC las persisten. Nota: `SaleReserveInvoiceItem`/`PurchaseReserveInvoiceItem` son modelos legacy (FRV/FRC viven en las tablas `SaleInvoice`/`PurchaseInvoice` con `isReserve='Y'`, que ya tienen los campos) |

---

## 5. Cómo verificar un flujo completo

1. Crear un artículo con tracking LOT (`ART-00019`) y un lote con stock.
2. Ejecutar `erp-frontend/e2e/traceability-flow.spec.ts` (flujo principal +
   directos + multi con verificación por API del `batchId` en cada documento).
3. Para un campo nuevo: repetir el patrón de los 5 pasos y verificar con un
   `GET /<documento>/<id>` que la línea destino tenga el valor.
