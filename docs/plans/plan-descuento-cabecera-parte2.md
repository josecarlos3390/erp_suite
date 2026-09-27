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

## Ronda 11 (punto 6 cerrado)

- **Gate de convergencia** `src/common/discount-rules-consistency.spec.ts` (**7 casos**): compara **el dinero** entre la
  regla única (`resolveEffectiveLineDiscounts`) y la materialización histórica (`materializeDiscountToLines`) en tres
  canastas (150/50/200 al 25 %, 100 Bs, cantidades > 1 con IVA incluido) y **fija las diferencias declaradas**:
  - `materializeDiscountToLines` **agrupa por tasa de IVA y REORDENA** las líneas (medido con tasas mixtas:
    `taxIndicatorId` `[0,13 · 0,13 · 0]`, descuentos `[37,50 · 50,00 · 12,50]`) → consumirlo **por índice** compara
    líneas distintas;
  - el **ratio** coincide **hasta un centavo** (127,12 contra 127,13) por el **orden de redondeo** y **no puede**
    expresar la **acumulación** con el descuento propio (5 % + 25 % → el ratio daría 112,50 y perdería el 5 %; la regla
    da **106,87**).
- **Convergencia escrita en el código**: las cabeceras de `discount-propagation.util.ts` y `discount-cost.util.ts`
  declaran que son **codificaciones de la misma regla** y enumeran sus límites, nombrando los dos casos
  **deliberados**: el **neteo** de la FRV (Ley 843 Art. 8) y la **valoración al costo** de la recepción (T239: el
  descuento no baja el costo).
- Gates: los tres specs de descuentos **33/33**, la suite completa **211 suites / 2.652 tests** en el hook del push,
  `tsc` 0 y `eslint` 0. Backend **`f112cb3`** en los **dos espejos** (verificado con `git ls-remote`).

## Ronda 10 (punto 7b cerrado)

- **El centavo de la NC, cerrado**: en `sales-credit-notes.createFromInvoice`, si la suma de las líneas se pasa del
  saldo de la factura por **redondeo** (≤ 0,01) se **cuadra la última línea** con el saldo (regla de `money.util`)
  ajustando su impuesto y los totales de cabecera; un exceso real (≥ 0,01) sigue rechazándose. Medido: la NC de venta
  desde una FV con cabecera 25 % pasa de **400** («El crédito (339.01) supera el saldo restante (339.00)») a **201**
  con `subtotal 300` y `totalDiscount 100`.
- **Gate `T254 (7b)`** (dinero por línea en la cadena de compra y en las NC): recepción manual 25 % →
  `discountMode=header`, `totalDiscount=100`, líneas `descTotal` **[12,50 / 37,50 / 50,00]**; FRC → `subtotal 300` y
  `totalDiscount 100`; NC de venta y de compra → `subtotal 300`, `totalDiscount 100`, líneas 12,50/37,50/50,00.
- Gates: `discount-propagation` **16/16**, `returns-and-credit-notes` **11/11** (**27/27** juntas), suite completa
  **210 suites / 2.645 tests** en el hook del push, `tsc` 0 y `eslint` 0. Backend **`8951fa5`** en los **dos espejos**
  (verificado con `git ls-remote` **después** de una interrupción de red: los espejos seguían en `fef3c8c`, se
  reintentó el mismo push —idempotente— y quedaron alineados).

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

- **Ronda 9 (punto 7b — gate de compras)**: escribí el caso E2E del **dinero por línea** para la cadena de compra y
  **pasó** en sus dos primeras partes: recepción manual con cabecera 25 % → `discountMode=header`, `pct=25`,
  `totalDiscount=100` y líneas con `descTotal` **[12,50 / 37,50 / 50,00]**; FRC desde esa recepción → `subtotal 300` y
  `totalDiscount 100`. **No lo dejé en el repo** porque la tercera parte destapó un **defecto real** y el caso se
  revertiría a medias: **DEFECTO NUEVO medido** — la **NC de venta** desde una factura con cabecera 25 % responde
  **400** `«El crédito (339.01) supera el saldo restante de la factura (339.00)»`: un **descuadre de UN centavo** por
  redondeo (la suma de las partes redondeadas por línea no cuadra con el total de la factura) que hoy **impide emitir
  la NC** cuando la factura lleva descuento de cabecera. Hay que cerrarlo en la NC (cuadrar el total contra el saldo
  de la factura, como manda la regla de `money.util`: cuadrar la última línea) y **después** meter el caso E2E
  (recepción + FRC + las dos NC) en `discount-propagation.e2e-spec.ts`.
  - La suite queda verde tras revertir el caso: `discount-propagation` **15/15**.

- **Ronda 8 (punto 5 — notas de crédito): CERRADO por medición, sin cambios de código**.
  Con el payload correcto (el DTO del `from-invoice` identifica la línea por **`itemId`**, no por el id de la línea
  de la factura), las dos NC **replican el descuento de la factura de origen**:
  - `NCR-1` (NC de venta desde una FV con cabecera 25 %): subtotal 265,49 + IVA 34,51 = **total 300**,
    `totalDiscount` **100**, líneas `descPct=25` con `descTotal` **50,00 / 12,50 / 37,50**.
  - `NCP-1` (NC de compra desde una FC con cabecera 25 %): idéntico (300 / 100 y `descPct=25` por línea).
  **Declarado (menor, cosmético)**: las NC guardan `modo=line pct=null` —copian el descuento **por línea**, que es lo
  que hace que el dinero cuadre, pero **no** heredan el `discountMode`/`headerDiscountPct` referencial de la factura—.
  Cerrarlo es un cambio de dos líneas en cada NC si se quiere el encabezado referencial también ahí.
- **Valores medidos listos para pinchar en el gate (punto 7b)**: recepción manual 25 % → `modo=header pct=25`,
  líneas `descPct=25` con 37,50/12,50/50,00, neto 112,50/37,50/150,00, `totalDiscount=100`, cabecera al **costo**
  (400, `status=CLOSED`); FRC desde esa recepción → total **300** y `totalDiscount` 100; NC de venta y de compra desde
  factura con cabecera 25 % → total **300**, `totalDiscount` 100, líneas `descPct=25` (50/12,50/37,50).

- **Ronda 6 (recepción de compra + FRC)**:
  - **Arreglado**: `purchase-receipts.createManual` aplica la regla única a sus líneas y guarda la cabecera referencial.
    Medido en BD (`REC-4`): `modo=header pct=25`, líneas `descPct=25` con `descTotal` **37,50 / 12,50 / 50,00**, neto
    unitario **112,50 / 37,50 / 150,00** y `totalDiscount` **100** (antes: `modo=line`, total 400, desc 0).
  - **Arreglado**: la **FRC** ahora cobra **300** (antes 400). En `purchase-invoices.createFromReceipt`, cuando la
    recepción **materializó** el descuento, la FRC **copia el neto del origen** (`ri.priceNet`) en vez de recalcular
    desde el precio de lista, y **replica** el importe descontado en su `totalDiscount` (si no, las dos casos E2E que
    exigen `totalDiscount > 0` en la FRC se caían).
  - **CORRECCIÓN de la ronda 6 (no era una incoherencia)**: la cabecera de la recepción muestra `subtotal=400 /
    total=400` **porque es la valoración al COSTO** (la recepción nace y se confirma en el alta: `status=CLOSED`,
    `totalCost=400`), no el precio. Medido con log temporal en `createManual`: `hasPrice=true`, subtotales de línea
    `[112.5, 37.5, 150]` → Σ **300**; el `400` del encabezado lo escribe `confirm()` (`subtotal: confirmedTotalCost`).
    Es la convención declarada en T239 —el descuento **no** baja el costo del artículo— así que el documento es
    coherente: coste 400, `totalDiscount` 100 y líneas al neto del precio (300). **Nada que arreglar.**
  - Gates de la ronda: unitarios de los 3 archivos **26/26**, E2E `discount-propagation` **15/15**, `purchase-flow`
    **14/14**, `tsc` 0 y `eslint` 0.

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
