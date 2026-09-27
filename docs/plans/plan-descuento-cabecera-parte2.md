# Plan — descuento de CABECERA, parte 2 (T254)

> Estado: **parte 1 empujada** (`676afff` backend / `8f60a14` root). Punto 8 de la parte 2 **hecho y medido**
> (pendiente de commit). El resto, en curso. Este archivo es memoria de trabajo del tramo: no es doc de producto.

## Regla única (ya implementada, parte 1)

`resolveEffectiveLineDiscounts(lines, header)` en `src/common/discount-propagation.util.ts`:

- **%** de cabecera → a **cada** línea, acumulado con el descuento propio (efectivo compuesto).
- **Importe** → prorrateado **en proporción al valor** de la línea, un redondeo por línea, residuo cuadrado en la
  última y tope en el valor de la línea.
- **Base** = el importe de la línea tal como se cobra (con IVA incluido baja lo cobrado; con IVA sumado baja el neto y
  el impuesto se recalcula en `calcLineWithIndicator`).
- El documento guarda la cabecera **referencial** (`discountMode`/`headerDiscountPct`/`headerDiscountAmt`) y **cada
  línea** su descuento efectivo (`discountPct` o `discountAmt`) + `discountTotal` + `lineSubtotal` + `lineTotal`.

Ya la usan: `sale-invoices.createManual` y `purchase-invoices.createManual`.

## Punto 8 — hecho

`POST /sales-quotations` y `/purchase-quotations` con una línea sin `itemId` respondían **500**
(`PrismaClientValidationError: Can not use 'undefined' value within array`); ahora **400** accionable nombrando la
línea, en los 4 sitios (`create` y `update` de cada una). Medido con `curl` y el JSON en fichero (ojo: armar el JSON
con comillas de PowerShell da 400 por parseo y **falsea** la medición). Fuera de alcance a propósito:
`storefront.service` (sus líneas nacen de la publicación, siempre con `itemId`).

## Hallazgo clave para los puntos 2/3/4 (la cadena)

`SaleReserveInvoice` **netea a propósito** el descuento de cabecera dentro de los montos de línea
(`applyHeaderDiscountNetting`, `sale-reserve-invoices.service.ts:325-383`): prorratea con el ratio y **limpia
`discountTotal` a 0** en esas líneas, para que (a) el asiento de la FRV no desglose `SALES_DISCOUNT` y (b) la **NC de
venta** herede líneas netas que balancean (Ley 843, Art. 8 inc. a/b). **No es un olvido: cambiarlo toca la
contabilidad de ventas** (T239 decidió el desglose en compras, no en ventas).

La **cadena pierde el descuento en la COPIA**, no en la FRV: `sale-invoices.createFromReserveInvoice` recalcula cada
línea desde `ri.price` (150) y `ri.discountPct` (que la FRV deja `null` porque ya lo neteó) → la factura sale por el
**bruto (400)** aunque la FRV valga **300**; además toma `headerDiscountPct` **solo del payload**
(`payload.headerDiscountPct ?? null`), así que si el cliente no lo reenvía la factura queda `modo=header pct=null`.

Por eso el arreglo correcto de la cadena y de «Copiar a» es **en el destino**:

1. Heredar la cabecera del origen cuando el payload no la trae:
   `payload.discountMode ?? srv.discountMode`, `payload.headerDiscountPct ?? srv.headerDiscountPct`,
   `payload.headerDiscountAmt ?? srv.headerDiscountAmt` (patrón que ya usan `createFromOrder`/`createFromDelivery`).
2. Tomar de la línea origen **lo que el origen ya decidió**: si la línea origen **no** trae descuento propio y su
   `priceNet` ≠ `price` (el origen lo neteó), el destino debe partir de ese **neto** (no de `price`) y **no** volver a
   aplicar el descuento. Si la línea origen **sí** trae `discountPct`/`discountAmt`, el destino lo copia y aplica la
   regla una sola vez.
3. La cabecera del destino queda referencial con el pct/amt heredado y sus totales salen de las líneas (no de un
   recálculo paralelo).

Regla de oro para todo el tramo: **cada documento aplica el descuento UNA vez sobre sus propias líneas y lo deja
escrito en la línea**; copiar = replicar la decisión del origen, nunca recalcularla desde el precio de lista.

## Orden de trabajo

1. **Punto 2** — `delivery-orders`: hereda `modo/pct` y no lo aplica (medido `DEL-1`: total 400, `totalDiscount=0` con
   `pct=25`). Aplicar la regla a sus líneas (es documento logístico: decidir si lleva valor; si lo lleva, coherente).
   `purchase-reserve-invoices` (FRC): no lee la cabecera (2 refs) → aplicar igual que la FRV.
2. **Punto 3+4** — `sale-invoices.createFromReserveInvoice` con la herencia del punto anterior; y revisar los
   `getDraft*`/`from-multi*` (borradores de «Copiar a») para que la cabecera y el descuento por línea viajen.
3. **Punto 1** — `sales-orders.createManual`/`createFromDraft`: hoy `discountPct: discountMode === 'line' ? … : null`
   (líneas a precio lleno con la cabecera descontada) → materializar con la regla. Simétrico en `purchase-orders`.
4. **Punto 5** — `purchase-credit-notes` (3 refs, 0 aplica), `sales-returns` y `sales-credit-notes` (0 refs).
5. **Punto 6** — converger `materializeDiscountToLines` y `computeHeaderDiscountRatio`/`netAmountWithHeaderDiscount`
   a la regla única (dejando el neteo declarado de la FRV como caso explícito, no como tercera regla).
6. **Punto 7** — caso E2E que pinche el **dinero por línea** (150/50/200 al 25 % y a 100 Bs) en cada documento y en la
   cadena pedido→entrega→FRV→factura; hoy `discount-propagation.e2e-spec.ts` solo pincha `discountMode`/`pct`.
7. Cierre: unit + E2E completos, CHANGELOG/AUDIT/AGENTS y push verificado con `git ls-remote` en los dos espejos.

## Estado por rondas (goal activo)

- **Ronda 1**: punto 8 ✔ (cotizaciones sin `itemId`: 500 → 400) + análisis de la FRV.
- **Rondas 2-3**: puntos **1, 3, 4** ✔ y **entrega** ✔ (el pedido materializa la cabecera en sus líneas; la copia
  desde la FRV hereda la cabecera y **no** vuelve a descontar) + **gate E2E del dinero por línea**
  (`discount-propagation` **15/15**).
- **Ronda 4**: docs + **push verificado** (backend `6dcf4e9` en los dos espejos, root `d6b5cec`).
- **Ronda 5 (medición, sonda `_probe-desc-frc-nc.ts`)**:
  - **DEFECTO NUEVO medido**: `purchase-receipts.createManual` **ignora** el descuento de cabecera
    (`REC-1`: `modo=line pct=null`, total 400, `desc=0` con `headerDiscountPct: 25`) → y la **FRC** que nace de
    esa recepción tampoco lo tiene (`FRC-1`: `modo=line`, total 400). Es el mismo patrón de la factura de compra
    manual que cerró la parte 1: **el arreglo va en la recepción** (la FRC sí hereda, porque
    `purchase-invoices.createFromReceipt` usa `resolveSingleHeaderDiscount`). Ojo: `createManual` de la recepción
    **no usa** `calcLineWithIndicator`; hay que ver cómo calcula sus montos (~líneas 866-1429).
  - **Confirmado que las facturas manuales ya están bien**: `FVE-16/17` y `FCP-7/8` → `modo=header pct=25`,
    subtotal **300**, `desc=100`, líneas `descPct=25` con 37,50/12,50/50,00.
  - **Pendiente de medir con el payload correcto** (mi sonda usó campos equivocados y dio 400): NC de venta y de
    compra desde la factura (`POST /sales-credit-notes/from-invoice/:id`, `/purchase-credit-notes/from-invoice/:id`
    — el campo de línea **no** es `saleInvoiceItemId`/`purchaseInvoiceItemId`, hay que leer el DTO) y el **pedido de
    compra** (su alta manual **no** es `POST /purchase-orders`: pide `quotationId`/`quotationItemId`, como el de
    venta).
  - **Recordatorio de entorno**: tras recrear la base hay que registrar la **tasa del día**
    (`POST /exchange-rates`, USD→BOB) o el guard bloquea toda operación con 400.

## Medición (sondas sin commitear)

- `backend-erp/scripts/_probe-desc.ts` — crea la canasta 150/50/200 (IVA incluido y sumado), las dos facturas
  manuales (25 % y 100 Bs) y la cadena pedido→entrega→FRV→factura, más las compras; imprime cabecera y líneas.
- `backend-erp/scripts/_probe-desc-bd.ts` / `_probe-desc-bd2.ts` — volcado **de la base** (la respuesta del API omite
  `lineSubtotal`/`lineTotal`).
- `backend-erp/scripts/_probe-desc-estado.ts` — indicadores de impuesto y grupos con descuento del tenant demo.
- **Antes de `npm run db:recreate` hay que parar el API**: con el servidor conectado la semilla falla (Prisma contra
  una base que se está recreando).
