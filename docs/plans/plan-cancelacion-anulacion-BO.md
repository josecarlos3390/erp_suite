# T255 — Cancelación vs Anulación (BO): memoria de trabajo

> Estado: **CERRADO (rondas 1-11)**. D1-D7 y la **UI** cerrados en la ronda 8 (interruptores de
> Configuración, botón «Anular con nota de crédito» en facturas de venta y compra, y el campo de fecha fuera de los
> diálogos de cancelación); la ronda 9 cierra **D8** (la cancelación revierte IT y descuentos —espejo exacto— y el
> hecho **nuevo** va al **precio ya descontado**), la ronda 10 cierra **D9** (el preliminar materializa el descuento
> de cabecera y la grilla lo muestra prorrateado) y la ronda 11 cierra **D10** (el descuento de **línea** no figura
> en los registros contables; el de **cabecera** sí, prorrateado, en el preliminar y en el contabilizado). Plan del
> tramo anterior (descuento de cabecera): `docs/plans/plan-descuento-cabecera-parte2.md`.

## Lo que pidió el usuario (2026-09-27)

1. El descuento de cabecera se guarda en la **cabecera** y los cálculos se hacen en las **líneas**, en todos los
   documentos y caminos, manuales incluidos. → **T254, cerrado** (declarado: la *edición* de cotizaciones).
2. La **cancelación** debe ser copia fiel del documento origen: mismo asiento, **misma fecha de documento y de
   contabilización**, revirtiendo por completo.
3. **Anulación de factura (BO)**: hasta qué fecha se puede anular; si se puede modificar la fecha de
   contabilización/documento.
4. La anulación se hace **por el total de la factura, descuentos incluidos**.
5. **NC hasta 180 días**, parciales.
6. NC de una factura con descuento de cabecera: tomar **la línea** que se devuelve con **el cálculo que esa línea
   ya tenía** en la factura (su descuento proveniente de la cabecera).

## Decisiones del usuario (2026-09-27)

- **D1 — fecha de la cancelación**: **opción 1**, diferenciando:
  - **Cancelación** → automática, con la **fecha del documento/transacción original** (no editable).
  - **Anulación** → se hace con el **documento de nota de crédito**, y **ahí sí se edita la fecha**.
- **D2 — plazo legal**: **sello de emisión fiscal + plazo configurable por empresa** (hoy cuelga de
  `status=CLOSED` y no se dispara nunca en facturas normales).
- **D5 — límite de la NC**: **configurable, default 180 días**, sólo si la NC **referencia** una factura.
- **Alcance**: primero **anulación/cancelación** (D1+D2+D3+D4), después **NC** (D5+D6+D7).
- **D3**: el espejo contable es la copia fiel (no se emite un documento nuevo de cancelación).
- **D4**: camino de un clic «anular con NC por el total (descuentos incluidos)».

## Medición del comportamiento anterior (sondas `_probe-t255-*.ts`, base de desarrollo)

### Cancelación / anulación

| Hecho medido | Valor |
|---|---|
| Asiento espejo = copia fiel | `FVE-27` (2026-06-19): `ASI-000089` 14 líneas → `ASI-000090` **mismas cuentas e importes cruzados, mismo orden** (`espejo exacto = true`), incluida la pata del descuento (`D100,00 · D9,00 · H9,00`) |
| Fecha del espejo (ANTES) | **2026-09-27** (período 9) para un documento del **2026-06-19** (período 6): el par quedaba **partido en dos períodos** |
| Documento origen | conserva `date`/`postingDate`; sólo pasa a `CANCELLED` (+ motivo y `cancelledAt`); **no** se emite documento de cancelación |
| Plazo legal RND 10-0016-17 | `canAnnulInvoice` = hasta el **día 9 del mes siguiente**, pero cuelga de `status=CLOSED`; una factura de venta normal **nace OPEN** (medido: 23 OPEN / 3 CLOSED, y las CLOSED son las acreditadas al 100% por una NC, que ya están bloqueadas) ⇒ **código muerto**: una factura de hace **100 días se anuló con 201**; una FRV manual de hace 40 días también (el alta manual la deja OPEN) |
| Bloqueos | con pagos/abonos → 400 «Utilice una nota de crédito»; con NC vinculada → 400 |
| Motivo | obligatorio sólo cuando la factura está CLOSED |

### Nota de crédito

| Hecho medido | Valor |
|---|---|
| **Parcial** con cabecera 25 % | `NCR-4` = 1 de 3 líneas de `FVE-28`: total **112,50** (99,56 + IVA 12,94), línea `descPct=25` / `descTotal=37,50` ⇒ **el descuento que ya tenía la línea** ✔ (lo pedido en el punto 6) |
| Factura tras la parcial | acreditado 112,50 / saldo 187,50 |
| Sobre-acreditación | 400 «El crédito (300.00) supera el saldo restante de la factura (187.50)» |
| **Límite de 180 días** | **no existe**: `NCR-5` emitida hoy contra una factura de **200 días** → **201** |
| NC **anterior** a la factura | **no se valida**: `NCR-6` con fecha 20 días antes de su factura → **201** (`días=-20`) |
| Cabecera referencial | las NC quedan `modo=line`, `pct=null` (el dinero bien; sin cabecera referencial) — declarado en T254 |

## Ronda 1 — cancelación con la fecha del documento original (CERRADA)

- `AccountingEngineService.reverseJournalEntry`: la reversa copia `date`/`postingDate` **del asiento original**;
  el parámetro de fecha queda como `_postingDate` (compatibilidad de firmas, **no decide**). El comentario del
  método documenta que T255 **revisa** la decisión T149 (la fecha era elegible, con el «hoy» del tenant).
- Gate `test/annulment-posting-date.e2e-spec.ts` reescrito como **T255** (**11/11**): la fecha elegida se ignora;
  con el período del documento cerrado → 409; una fecha elegida de un período cerrado se ignora (manda la del
  documento); sin período que cubra la fecha del documento → 409 con el rango (se reemplaza la gestión por una de
  otro año: con gestión existente y sin período es cuando la guarda dispara); COBRO y SALIDA de stock con la fecha
  de su documento; original y reversa en el **mismo** período con la CxC en cero.
- Unitario del motor (`accounting-engine.service.spec.ts`, **123/123**) con el caso reescrito: el período y las
  fechas de la reversa salen del original.
- **A/B medido en la base de desarrollo** (`_probe-t255-ab.ts`): `FVE-30`/`FVE-31` del **2026-06-19** →
  original `ASI-000100` (período 6) y espejo `ASI-000101` **2026-06-19, período 6**, espejo exacto = **true**;
  antes (`FVE-27`, misma fecha) el espejo quedaba en **2026-09-27 / período 9**.
- **Declarado**: el diálogo del frontend sigue **pidiendo** la fecha de contabilización de la cancelación (T149,
  ~25 pantallas); el backend ya la ignora, así que el campo es cosmético y su retirada es el paso siguiente
  (junto con D2/D4). Y `_resolveAccountingPeriod` devuelve periodo nulo **si no hay ninguna gestión** (ahí no hay
  409): el 409 es «hay gestión pero ningún período cubre la fecha».

## Ronda 2 — sello de emisión fiscal + plazo configurable (D2) (CERRADA)

- **Regla ampliada** (`src/common/invoice-annulment.util.ts`): `canAnnulInvoice(fechaEmisión, ahora, ventana)` con
  `InvoiceAnnulmentWindow { enabled, deadlineDay }` (default `true` / `9`, la RND). El día se acota a **1..28**
  (un día que no existe en el mes siguiente rodaría al mes posterior); `enabled: false` = sin plazo.
- **Sello de emisión**: columnas `SaleInvoice.fiscalIssuedAt` / `PurchaseInvoice.fiscalIssuedAt`
  (migración idempotente `20260927190000_fiscal_issued_at`, con **backfill** = `date`). El motor usa
  `fiscalIssuedAt ?? date`: el sello es **opcional** y hoy queda `null` en los documentos nuevos, así que la
  emisión es la **fecha del documento** (medido: `FVE-32` con `emisión=null` y `date=2026-06-19`).
- **Configurable por empresa**: `annulmentDeadlineEnabled` (default `true`) y `annulmentDeadlineDay`
  (default `9`) en `AppSettings` + `getAll` + `saveAll` + el DTO de `PUT /settings`; el interruptor del
  frontend queda declarado para el tramo de UI.
- **Guardas** (`sale-invoices.findForAnnulment`, `sale-reserve-invoices.cancel`, `purchase-invoices.findForAnnulment`):
  el plazo corre desde la **emisión** (no desde `status=CLOSED`, que significa «acreditada por completo») y el
  **motivo** es obligatorio en la anulación de cualquier documento emitido; el 400 nombra el día configurado y
  pide la NC.
- **A/B medido en la base de desarrollo** (`_probe-t255-plazo.ts`, factura con fecha de hace 100 días):
  | | Antes (ronda 1) | Después |
  |---|---|---|
  | plazo activo (default) | **201** (se anulaba) | **400** «fuera del plazo … Emita una nota de crédito por el total» |
  | `annulmentDeadlineEnabled=false` | — | **201** y el espejo en el período del documento (`2026-06-19`/6) |
  | restaurado | — | **400** otra vez |
- **Gates**: `invoice-annulment.util.spec` **6/6** (ventana desactivada, día configurable, día imposible acotado),
  `annulment-posting-date` **14/14** (3 casos nuevos: fuera del plazo → 400 + NC; ventana desactivada → 201;
  sin motivo → 400) y las suites E2E de cancelaciones/settings de la ronda.
- **Declarado**: el interruptor no está todavía en la pantalla de Configuración (se maneja por `PUT /settings`);
  el backfill deja el sello puesto en los documentos **existentes**; la anulación de una **factura de compra**
  aplica la misma ventana (el documento es del proveedor: si el criterio debe ser otro, es una decisión del
  usuario); y el camino de un clic «anular con NC por el total» (D4) es la ronda siguiente.

## Ronda 3 — «anular con NC por el total» (D4) (CERRADA)

- **El camino de un clic ya existía y no estaba declarado**: `POST /sales-credit-notes/from-invoice/:id` **sin
  `items`** acredita **todas** las líneas de la factura (`createFromInvoice`: `items.length > 0` decide entre líneas
  propias y las de la factura) y respeta el descuento que cada línea ya tenía (T254: `origLine.discountPct`).
- **Lo que faltaba era el estado**: una NC por el total dejaba la factura en `CLOSED` («acreditada por completo»),
  no **ANULADA**. Ahora `_executeConfirmLogic` marca `CANCELLED` + `cancellationReason` («Anulada por la nota de
  crédito NCR-x») + `cancelledAt` + `cancelledById` cuando lo acreditado alcanza el total, y la cancelación de la
  NC **restaura** la factura (acepta `CANCELLED` además de `CLOSED` y limpia la traza).
- **Mensajes accionables**: los tres 400 de anulación fuera del plazo nombran el camino de un clic y el endpoint
  (`POST /sales-credit-notes/from-invoice/:id` en venta y FRV, `/purchase-credit-notes/from-invoice/:id` en compra).
- **A/B medido en la base de desarrollo** (`_probe-t255-nc-total.ts`): factura `FVE-35` con cabecera 25 % →
  `NCR-7` por el total → **total 300,00 = total de la factura**, **descuento 100,00** y las 3 líneas `descPct=25`;
  la factura queda **`CANCELLED`** con `acreditado=300`, `saldo=0` y motivo «Anulada por la nota de crédito NCR-7»
  (antes: `CLOSED`, medido en `FVE-22/23/24`); y la anulación por espejo después responde **400 «La factura ya está
  anulada»**.
- **Gates**: `annulment-posting-date` **16/16** (2 casos nuevos: la NC por el total anula con los descuentos ya
  calculados y bloquea la vía del espejo; una NC **parcial** NO anula) y **7 suites E2E** de NC/cobros/canal
  **106/106** (`returns-and-credit-notes`, `credit-note-partial-money`, `credit-note-return-pending`,
  `discount-propagation` 16/16, `sales-flow`, `incoming-payments`, `storefront-channel`).
- **Un caso de unidad fijaba la decisión vieja**: `sales-credit-notes.service.spec` tenía «*factura totalmente
  acreditada pasa a CLOSED (no CANCELLED)*» y se **reescribe** con el motivo del cambio (estado `CANCELLED`, motivo
  con el código de la NC y ningún `CLOSED`). Lo destapó el **hook del push**: la suite quedó en rojo, el push **no**
  se selló, los espejos seguían en el commit anterior (verificado con `git ls-remote`) y el commit se corrigió con
  `--amend` **antes** de publicarse — la lección: un cambio de regla puede tener su decisión vieja **escrita en un
  test**, así que el gate de unidad hay que correrlo antes de empujar.
- **Declarado**: el camino es un endpoint (la pantalla con su botón «Anular con nota de crédito» es el paso de UI);
  la NC se emite **hoy** por defecto y su fecha es editable (el usuario la elige en el payload); el lado de
  **compra** tiene el mismo camino por `/purchase-credit-notes/from-invoice/:id` y su estado se revisa en la ronda
  de compras si hace falta.

## Ronda 4 — fechas de la NC: plazo configurable y nada de fechas imposibles (D5+D6) (CERRADA)

- **Regla nueva en un solo sitio** (`src/common/credit-note-date.util.ts`,
  `assertCreditNoteDate(noteDate, invoice, today, { maxDays }, timeZone)`):
  - **D6** — la NC que referencia una factura no puede fecharse **antes** de la factura ni en el **futuro**.
  - **D5** — su antigüedad no puede pasar **`creditNoteMaxDays`** (default **180**, `0` = sin límite), medido
    desde la **emisión fiscal** de la factura (`fiscalIssuedAt ?? date`) y comparando **días del tenant**.
  - Sólo aplica cuando la NC **referencia** una factura: la NC manual no tiene contra qué medirse.
- **Configurable por empresa**: `creditNoteMaxDays` en `AppSettings`, `getAll`, `saveAll` y el DTO de
  `PUT /settings`.
- **Cableado**: `sales-credit-notes.createFromInvoice` (el camino de un clic de D4) y el `create` manual cuando
  trae `saleInvoiceId` (se amplió el `select` del bloqueo para leer `date` y `fiscalIssuedAt`).
- **A/B medido en la base de desarrollo** (`_probe-t255-nc-fechas.ts`): NC hoy de una factura de **200 días** →
  **400** «La factura se emitió hace 200 días y el plazo para acreditarla es de 180 días…» (antes **201**, `NCR-5`);
  NC con fecha **20 días anterior** a la factura → **400** «anterior a la factura» (antes **201**, `NCR-6` con
  `días=-20`); NC con fecha **futura** → **400**; y con `creditNoteMaxDays = 0` la misma NC de 200 días se emite
  (**201**, `NCR-9`), restaurado el parámetro.
- **Gates**: `credit-note-date.util.spec` **7/7**, `annulment-posting-date` **18/18** (2 casos nuevos) y las suites
  de NC/cobros en verde.
- **Nota de arnés medida**: la primera corrida de la sonda dio **500** en dos casos porque la factura «de hoy» no se
  creó (existencia agotada por las sondas anteriores) y el `id` quedaba `undefined` en la URL — el 500 era del
  **probe**, no del producto; se recargó la existencia y se añadió la comprobación del alta.
- **Declarado**: el límite se aplica a la NC de **venta** (la de **compra** tiene su propio servicio: ronda de
  compras); el interruptor no está en la pantalla; y el default 180 es el número que fijó el usuario.

## Ronda 5 — cabecera referencial en la NC (D7) y la parcial con cabecera por importe (CERRADA)

- **Lo que faltaba**: la NC guardaba el descuento **sólo en las líneas** (`NCR-10` por el total y `NCR-11/13`
  parciales salían `modo=line`, `pct=null`, `amt=null`) y la parcial con cabecera **por importe** no estaba medida.
- **Entregado**: `sales-credit-notes.createFromInvoice` copia la cabecera **referencial** de la factura
  (`discountMode`/`headerDiscountPct`/`headerDiscountAmt`) **sin recalcular el dinero** —`totalDiscount` sigue
  siendo la suma de las líneas—, con el comentario del porqué y el gate que lo pincha (el total no cambia).
- **A/B medido en la base de desarrollo** (`_probe-t255-d7.ts`):
  | Documento | Antes | Después |
  |---|---|---|
  | `NCR-15` NC por el total de una FV con 25 % | `modo=line pct=null` | **`modo=header pct=25`**, total **300,00** y desc **100,00** (iguales) |
  | `NCR-16` NC parcial | `modo=line pct=null` | **`modo=header pct=25`**, 112,50 con 37,50 de la línea |
  | `NCR-17` parcial de una FV con cabecera **100 Bs** | `modo=line`, `amt=null` | **`modo=header amt=100`** y línea con **`descAmt=37,50`** (el de la línea) |
- **D7(b) respondido**: la parcial de una factura con cabecera por **importe** toma el descuento **que la línea ya
  tenía** (37,50), prorrateado por la cantidad acreditada cuando la línea tiene más unidades (en el gate: la mitad).
- **Gates**: `annulment-posting-date` **19/19** (2 casos nuevos) y las suites de NC/cobros en verde.
- **Declarado**: la copia referencial se hace en la NC que nace de una **factura**; el `create` manual con
  `saleInvoiceId` y las **devoluciones** (venta y compra) siguen con `modo=line` —mismo criterio, paso siguiente—.

## Ronda 6 — la cabecera referencial llega a las DEVOLUCIONES (cierre de D7) (CERRADA)

- **Medido antes**: la devolución de **venta** (`DEV-1`) y la de **compra** (`DCP-1/2`) nacían `modo=line`,
  `pct=null`, `amt=null` aunque su origen llevara cabecera (`DEL-5` y `REC-10` eran `modo=header pct=25`). En
  compras el dato **se perdía al persistir**: `createFromReceipt` ya lo pasaba al `create`, pero el `create` no lo
  escribía y valía el default `line` (medido con la sonda `_probe-t255-d7-devoluciones.ts`).
- **Entregado**: (1) `sales-returns.create` copia la cabecera referencial de la **entrega** de origen (el dinero
  sale de las líneas persistidas, así que no se recalcula); (2) `purchase-returns.create` **persiste** la cabecera
  que ya recibía (`dto.discountMode ?? receipt.discountMode`), coherente con el prorrateo a líneas que ya hacía;
  (3) la **NC manual** con `saleInvoiceId` también copia la cabecera referencial de la factura (mismo criterio que
  `createFromInvoice`).
- **A/B medido**: `DEV-3` → `modo=header pct=25`, total **300,00** y desc **100,00** (los de la entrega, sin doble
  aplicación); `DCP-3` → `modo=header pct=25`, total **300,00** y desc **100,00**.
- **Gates**: `discount-propagation` **16/16** (dos aserciones nuevas de cabecera referencial en las devoluciones),
  `returns-and-credit-notes` **11/11** (**27/27** en la corrida conjunta) y unitarios de las tres familias
  **48/48**.
- **D7 CERRADO** (NC desde factura, NC manual con factura y las dos devoluciones). Queda del tramo: el **lado de
  compra** de las fechas de la NC y la **UI** (interruptores y botones).

## Ronda 7 — la NC de COMPRA estrena las mismas reglas (CERRADA)

- **Medido antes**: `/purchase-credit-notes/from-invoice/:id` **no validaba fechas** (la de 200 días se emitía) y
  guardaba la cabecera **hardcodeada** (`discountMode: 'line'`, `headerDiscountPct: null`).
- **Entregado**: `assertCreditNoteDate` en `createFromInvoice` y en el `create` manual con `purchaseInvoiceId`
  (fecha anterior/futura/plazo `creditNoteMaxDays`, desde la emisión fiscal) y la cabecera **referencial** copiada
  de la factura **sin recalcular el dinero**.
- **A/B medido** (`_probe-t255-nc-compra.ts`): NC de una FC de 200 días → **400** con el mensaje del plazo (antes se
  emitía); NC con −20 días → **400** «anterior a la factura»; NC dentro del plazo → **201** con
  **`modo=header pct=25`**, total 300,00 y desc 100,00; con `creditNoteMaxDays=0` → **201** (`NCP-5`).
- **Gates**: `annulment-posting-date` **20/20** (caso nuevo de las tres cosas) y el unitario de la NC de compra
  **23/23**.
- **Con esto las reglas de la NC son SIMÉTRICAS en venta y compra.** Queda del tramo solo la **UI**.

## Ronda 8 — la UI del tramo y el cierre de la simetría en COMPRAS (CERRADA)

### Lo que quedaba y por qué

El backend ya estaba cerrado (r1-r7) pero **la pantalla contaba otra cosa**: los ~50 diálogos de cancelación
seguían **pidiendo** la fecha de contabilización (el backend la ignora desde r1) y no existía el camino de un clic
para la NC —fuera del plazo, el 400 nombraba un endpoint que el usuario tenía que llamar a mano—. Además, al
exigir **motivo** (r2/r4) tres listados que no lo pedían pasaron a fallar con 400 sin explicación en pantalla.

### Entregado (frontend)

1. **Configuración General → «Anulación y notas de crédito»** (`pages/settings`): los tres campos del backend en el
   formulario —`annulmentDeadlineEnabled` (switch, default **aplicado**), `annulmentDeadlineDay` (1..28, default 9)
   y `creditNoteMaxDays` (default 180, `0` = sin límite)— en el modelo, los defaults, `_original`, el `patchValue` y
   el payload de guardado, con su sección y ayudas. Dos casos Karma nuevos.
2. **Botón «Anular con nota de crédito»** en los cuatro sitios donde se anula una factura: los listados de
   **Facturas de cliente** y de **Facturas de proveedor** (menú de fila, visible también en las `CLOSED` —es
   justamente el camino para las que están fuera del plazo—) y las pantallas de detalle de las dos. Llama a
   `/sales-credit-notes/from-invoice/:id` (o `/purchase-credit-notes/from-invoice/:id`) **sin `items`** con
   `{date, postingDate}` y la **fecha editable** en el diálogo, y refresca.
3. **La fecha de contabilización sale de TODOS los diálogos de cancelación**: 43 archivos tocados (los ~25 listados
   y sus formularios + revaluaciones, producción, stock, pagos…). El servicio del diálogo deja de hablar de «fecha
   de contabilización» y pasa a un campo de **fecha** neutro (`dateLabel`/`date`), que es el que usa el hecho nuevo
   que **sí** tiene fecha propia: la **nota de crédito**.
4. **El motivo se pide donde el backend lo exige**: los tres listados (facturas de cliente, facturas de reserva de
   cliente y facturas de proveedor) ahora piden «Motivo de la anulación» y lo envían, con **toast de error** que
   muestra el mensaje del backend (el 400 que nombra la NC se lee en pantalla).

### Entregado (backend, cierre de la simetría)

- **La NC por el total ANULA también la factura de COMPRA** (`purchase-credit-notes._executeConfirmLogic`), como en
  ventas desde r3: antes quedaba `CLOSED` («acreditada por completo») y el botón de la pantalla habría mentido. Al
  cancelar la NC la factura se **restaura** (acepta `CANCELLED`) y se limpia la traza. El **caso de unidad que
  fijaba la regla vieja** se reescribió con el motivo del cambio (`T255 (D4): … pasa a CANCELLED`).
- Con esto **el estado de la factura tras una NC total es el mismo en venta y en compra**, y la anulación por
  espejo posterior responde «La factura ya está anulada» en las dos.

### Validación sobre BASE LIMPIA (autorizada por el usuario)

`npm run db:recreate` (0 transacciones de arranque) + `POST /settings` + documentos reales por el API con **los
payloads exactos de la pantalla** (`_probe-t255-ui-final.ts`, base `default`, 2026-09-27):

| Paso | Medición |
|---|---|
| `PUT /settings` con los tres campos del formulario | **200** · leído `plazo=true día=9 NC=180` |
| Factura de venta de hoy con cabecera 25 % (`FVE-3`) | total **300,00**, 3 líneas |
| «Anular con nota de crédito» (`from-invoice` con `{date,postingDate}`, **sin `items`**) | **201** `NCR-3` total **300,00** y desc **100,00**; factura **`CANCELLED`**, acreditado 300,00, saldo **0,00**, motivo «Anulada por la nota de crédito NCR-3» |
| Cancelar **sin** motivo (lo que mandaba el listado) | **400** «requiere registrar el motivo (RND 10-0016-17 Art. 38)» |
| Cancelar **con** motivo (lo que manda el diálogo) | **201**; original `ASI-000007` y espejo `ASI-000008` **los dos del 2026-09-27**, par neto **0,00** |
| Factura de hace **200 días** (`FVE-5`): cancelar | **400** que nombra el camino de la NC (`from-invoice/5` sin `items`) |
| …la NC del botón sobre esa factura | **400** «se emitió hace 200 días y el plazo para acreditarla es de 180 días» |
| …con el interruptor `creditNoteMaxDays=0` | **201** (`NCR-4`) |
| Otra factura de 200 días con `annulmentDeadlineEnabled=false` | **201**; original `ASI-000011` y espejo `ASI-000012` **los dos del 2026-03-11** (el período del documento, no el de hoy) |
| Factura de compra de hoy con cabecera 25 % (`FCP-2`) + botón | **201** `NCP-2` **`modo=header pct=25`** total 300,00 desc 100,00 y factura **`CANCELLED`** «Anulada por la nota de crédito NCP-2» |
| NC **20 días anterior** a su factura | **400** «no puede tener una fecha anterior a la factura (2026-09-27)» |
| NC con fecha **futura** (+5 días) | **400** «no puede tener una fecha futura (2026-10-02; hoy es 2026-09-27)» |
| NC de hoy (control) sobre esa factura | **201** (`NCR-7`) y la factura queda **`CANCELLED`** con lo acreditado |

### Gates

- Frontend: `tsc` (**app y spec**) 0, `ng lint` «All files pass linting», **Karma 2324 casos** (2322 verdes en la
  corrida completa y los **2 que fijaban la firma vieja** del `cancel(id, razón, fecha)` corregidos y verdes),
  `ng build` 0 (127,9 s).
- **Un defecto propio lo destapó el gate del push (no `tsc` ni Karma)**: las plantillas de los **dos layouts**
  (`core/layout` y `super-admin/layout`) seguían enlazando `[postingDateValue]`/`(postingDateValueChange)` del
  diálogo. `tsc` no compila plantillas y Karma (JIT) no rompe el test por un enlace desconocido; el **build** del
  hook sí (`NG8002`/`NG9`) y **cortó el push** hasta renombrarlos a `dateValue`/`dateValueChange`. Es la misma
  lección que el caso de unidad del push en la ronda 3: **el gate que compila la plantilla es el build**.
- Backend: unitario de la NC de compra **23/23** (con el caso de D4 reescrito), `annulment-posting-date`
  **22/22** (dos aserciones nuevas de la factura de compra anulada y de la vía del espejo), `tsc` y `eslint` 0; y
  el hook del push corrió la suite completa **212 suites / 2662 tests** en verde.
- E2E del gate: `annulment-posting-date` + `purchase-flow` + `returns-and-credit-notes` + `discount-propagation`
  = **4 suites / 61 tests**.
- Commits: backend **`31c5050`** (los dos espejos, `git ls-remote`), frontend **`f0a964f2`**, raíz (este
  documento).

## Ronda 9 — D8: el hecho NUEVO va al precio ya descontado (CERRADA)

### Lo que precisó el usuario (2026-09-27)

> «La anulación de la factura sí debe revertir IT y los descuentos, pero la nota de crédito no revierte IT ni
> tampoco revierte descuentos en su asiento, pero sí obtiene el descuento de cabecera y su línea prorrateada
> correspondiente […]; esa línea debe extraer el precio con descuento para hacer la NC.»

Es la frontera entre los dos hechos del tramo: la **cancelación** es el espejo exacto (revierte **todo**, IT y
descuentos); la **NC y la devolución** son hechos **nuevos** y se emiten por el **precio con descuento** de la
línea, con el descuento (cabecera y línea) **referencial** en el documento.

### Medición del ejemplo del usuario (400 Bs = 150 + 50 + 200 con 25 % de cabecera)

Cabecera prorrateada **por valor**: 37,50 / 12,50 / 50,00. En esta base el indicador es de **IVA incluido**, así que
el importe cobrado es 300,00:

| Línea | Bruto | Desc. 25 % | Neto | IVA | Total |
|---|---|---|---|---|---|
| 150 | 150,00 | 37,50 | 99,56 | 12,94 | 112,50 |
| 50 | 50,00 | 12,50 | 33,19 | 4,31 | 37,50 |
| 200 | 200,00 | 50,00 | 132,74 | 17,26 | 150,00 |
| **Σ** | **400,00** | **100,00** | **265,49** | **34,51** | **300,00** |

| Hecho | Antes (medido) | Después (medido) |
|---|---|---|
| **NC de venta** de la línea de 150 | `Devolución sobre Ventas D 137,06` + `Descuentos sobre Ventas H 37,50` + `IVA crédito D 12,94` + `CxC H 112,50` (el neto ya era 99,56, con una pata de más) | **`Devolución sobre Ventas D 99,56`** + `IVA crédito D 12,94` + `CxC H 112,50` — sin descuentos y sin IT |
| **NC de compra** por el total | `CxP D 300` + **`Devoluciones sobre Compras D 100`** + `IVA crédito H 34,51` + `Inventario H 365,49` (el «descuento» metido en Devoluciones) | `CxP D 300` + **`Descuentos y Bonificaciones sobre Compras D 100`** (37,50+12,50+50) + `IVA crédito H 34,51` + `Inventario H 365,49` — el inventario al **costo capitalizado** (T239) y el descuento en **su** cuenta |
| **Cancelación** de la factura | `ASI-000007` → espejo `ASI-000008` con `IT D/H 9,00` y `Descuentos sobre Ventas D/H 100,00` cruzados, par neto 0,00 | **igual** (no cambia: es el espejo exacto) |
| Línea de la NC / devolución de compra | `lineSubtotal`/`lineTotal` en **`null`** | publican la base y el total **descontados** (99,56 / 112,50) con el descuento referencial |

### Decisiones del usuario en la ronda

- **Alcance**: las **cuatro familias** (NC de venta y de compra + devoluciones de venta y de compra).
- **Presentación**: la línea mantiene el **precio bruto + descuento referencial** (150,00 · 25 % · 37,50 →
  total 112,50) y el asiento usa el **neto**.
- **Compra** (con la medición delante): el inventario sale al **costo capitalizado** y la diferencia —que **es** el
  descuento— se revierte en **`PURCHASE_DISCOUNT`** (la cuenta donde la factura lo acreditó), **no** en
  Devoluciones sobre Compras.

### Entregado

- `sales.journal-builder`: la NC y la devolución de venta revierten el ingreso/devolución por el **neto**; se
  eliminan las patas `SALES_DISCOUNT`/`SALES_DISCOUNT_TAX` por línea y el plug del descuento de cabecera pasa a
  medirse sobre el neto (sigue cubriendo los documentos **heredados** con la línea a precio lleno).
- `purchases.journal-builder`: la NC de compra revierte el descuento en `PURCHASE_DISCOUNT` y deja en Devoluciones
  solo una diferencia de precio **real**; la devolución de compra postea el par al costo en **una** pata neta (antes
  eran dos que se cancelaban) y su rama financiera queda coherente con la regla.
- `sales-credit-notes`, `purchase-credit-notes`, `purchase-returns`: la línea publica `lineSubtotal`/`lineTotal`
  (descontados) y el **descuento viaja al motor** (`discountTotal`) porque ahora decide la cuenta de la reversa.

### Gates

- `accounting-engine.service.spec.ts`: los **dos casos que fijaban la regla vieja** («SALES_CREDIT_NOTE con
  descuento debita el bruto y acredita SALES_DISCOUNT» y su gemelo de `SALES_RETURN`) reescritos con el motivo del
  cambio, y **dos casos nuevos** de T255 (D8) para la NC y la devolución de compra.
- Unitarios: las **cinco suites tocadas 196/196** (`accounting-engine.service.spec.ts` y las cuatro familias de
  NC/devolución) y el **hook del push** corrió la suite completa **212 suites / 2664 tests** en verde.
- E2E: **7 suites / 86 tests** en la corrida final (`annulment-posting-date`, `returns-and-credit-notes`,
  `discount-propagation`, `purchase-flow`, `sales-flow`, `credit-note-partial-money`, `usage-marathon`), más las
  focalizadas de ventas (**6/65**, con `credit-note-return-pending`) y compras (**4/51**, con `landed-costs`).
- `tsc` (app y e2e) 0 y `eslint` 0.
- **Un gate destapó el cambio y se actualizó con el motivo**: `account-entry-types-coverage.spec.ts` (T243) escanea
  el código y fija el inventario de cuentas de documento; al desaparecer la pata `SALES_DISCOUNT_TAX` de la NC de
  venta y de la devolución, el inventario pasa de **53 a 51 pares** —el hook del push **rechazó** el primer intento
  con ese único caso en rojo—. Se revisó que la desaparición es la esperada (la **factura** sigue usando
  `SALES_DISCOUNT` y `SALES_DISCOUNT_TAX`, que es donde vive la presentación bruta) y se actualizó el inventario
  con el motivo escrito en el spec.
- Commits: backend **`e958fe6`** en los **dos espejos** (verificado con `git ls-remote`; el hook corrió la suite
  completa) y raíz (este documento).

### Declarado

- La **devolución de compra** es **siempre logística** (`Dr GRIR / Cr Inventario` al costo: el servicio fija
  `financialReversal = false` porque la reversa financiera es de la NC de compra), así que hoy no toca el
  descuento; su rama financiera queda coherente y **gateada por unitario**, y el descuento de compra lo revierte la
  **NC** (medido).
- El **IT** no se revierte en la NC ni en la devolución desde la decisión 2026-08-24 (medido: su asiento no tiene
  línea de IT) y la cancelación **sí** lo revierte.
- El descuento de cabecera y el de línea se conservan **referenciales** en el documento (`pct`/`amt`/`total`) para
  explicar el importe y mantener la traza con la factura.

## Ronda 10 — D9: el preliminar con descuento de cabecera y su visualización (CERRADA)

### Lo que reportó el usuario

> «Estoy haciendo pruebas en la factura de reserva de compra, con un artículo donde el total del documento es
> 94 Bs y puse descuento de línea con un importe de 3, quedando el total en 91, y el asiento que genera es
> correcto… pero cuando coloco el descuento en cabecera pareciera que el descuento no se prorratea en las
> líneas, porque el asiento que genera el documento que tiene descuento en cabecera es diferente… el asiento en
> el preliminar.»

### Medición (FRC de 94 con 3 Bs de descuento)

| | Tránsito | IVA | Descuento | CxP |
|---|---|---|---|---|
| **Documento guardado** (los dos modos) | 83,53 | 10,47 | 3,00 | 91,00 |
| **Preliminar, descuento de línea** | 83,53 | 10,47 | 3,00 | 91,00 ✅ |
| **Preliminar, descuento de cabecera** (antes) | **83,19** | **10,81** | 3,00 | 91,00 ❌ |

El documento **ya prorrateaba** (T254); el formulario manda las líneas **a precio lleno** y el descuento solo en
el documento, así que el motor del preliminar compensaba con el plug de descuento y dejaba el IVA sobre el **bruto**.

### Entregado

- **Backend**: el builder de borradores materializa el descuento de cabecera **en las líneas** con la **misma
  regla** del alta (`resolveEffectiveLineDiscounts`) y **el mismo calculador** (`calcLineWithIndicator`, con la
  tasa y el `isInclusive` del indicador de cada línea), en el preview de **venta y de compra** (FVE/FRV y FCP/FRC
  comparten el helper). El DTO `preview-draft` acepta `discountMode`/`headerDiscountPct`/`headerDiscountAmt` (el
  importe `discountTotal` sigue como respaldo) y las líneas que ya traen descuento no se tocan.
- **UI (decisión del usuario: todos los documentos con descuento de cabecera)**: en modo cabecera las celdas de
  descuento de la línea quedan **de solo lectura y muestran el prorrateo** que el motor aplica; en modo línea
  siguen editables. La regla de visualización vive en **un solo sitio**
  (`shared/utils/line-discount-display.util.ts` + el pipe `lineDiscount`, espejo del backend: misma base, reparto
  por valor y residuo cuadrado en la última línea) y se aplica a **9 formularios**: FRC, FCP, FVE, FRV,
  cotizaciones de venta y de compra, NC de compra y los dos pedidos (que capturan la cabecera por `ngModel`). El
  `discountTotal` de la grilla también muestra el prorrateo y `displayDiscountForRow` dejó de devolver 0 en los
  **borradores**.

### Medido después (A/B)

- Preliminar de la FRC de 94 con 3 Bs: `Tránsito D 83,53 + IVA crédito D 10,47 + Descuento H 3,00 + CxP H 91,00`
  — **idéntico** al del descuento de línea y al del documento.
- Preliminar de venta con cabecera: `CxC D 91,00 + Ventas H 83,53 + IVA débito H 10,47 + Descuento D 3,00 +
  IT 2,73`, igual que con el descuento de línea.

### Gates

- Backend: caso nuevo en `accounting-engine.service.spec.ts` que compara **los dos asientos** (cabecera vs línea),
  las suites del motor, ventas y compras **130/130** y el hook del push con la suite completa
  **212 suites / 2665 tests**; `tsc`/`eslint` 0. Backend **`1ea1cd5`** en los **dos espejos**.
- Frontend: spec nuevo del util/pipe **5/5** (porcentaje, importe con residuo, acumulación 5 % + 25 % = 28,75 % y
  el pipe en los dos modos), `tsc` app 0, **`ng build` (AOT) 0** —el build es el gate que compila las
  plantillas: destapó el acceso a `headerDiscountAmt` en la NC de compra y dos comparaciones con `number | null`
  en la FRC— y la suite Karma completa.

### Declarado

- El prorrateo de la grilla es **solo visual**: el descuento propio de la línea sigue **vacío** en modo cabecera.
  Si se escribiera ahí, el motor **acumularía** cabecera + línea y lo duplicaría (por eso las celdas son de solo
  lectura).
- En modo **ver** (`!canEdit`) la celda de `%`/monto sigue mostrando el valor del control (0 en cabecera); el
  desglose y el total descontado sí muestran el prorrateo.

## Ronda 11 — D10: el descuento de LÍNEA no figura en los registros contables; el de CABECERA sí (CERRADA)

### Lo que pidió el usuario (2026-09-27)

> «en la factura de compra o de venta, o en la factura de reserva de venta o compra, cuando el documento tiene
> descuento en línea, en el asiento preliminar y el asiento contable que luego registra **no debe figurar el
> descuento**, solo debe figurar cuando el documento tiene descuento de cabecera […] nosotros en la cabecera del
> documento definimos qué tipo de descuento se va a aplicar, por línea o por cabecera, en el caso de que el
> documento aplica descuento por línea entonces el descuento **no figura en los registros contables**, pero si el
> documento aplica descuento de cabecera, entonces los cálculos de los **prorrateos** que se hacen en las líneas
> **sí** deben figurar como descuento en el asiento contable tanto en el preliminar como el contabilizado».

### Medición antes (sonda `_probe-d10-descuento-modo.ts`, 94 Bs con 3 de descuento e IVA 13 % incluido)

Los **cuatro** documentos desglosaban el descuento en **los dos** modos: el modo del documento no decidía nada.

| Documento | Modo línea (antes) | Modo cabecera (antes) |
| --- | --- | --- |
| FVE/FRV | `Ventas H 83,53` + `Descuentos D 3,00` + IVA + CxC 91 | igual |
| FCP | `Inventario D 83,53` + `Descuentos H 3,00` + IVA + CxP 91 (costo 83,53) | igual |
| FRC | `Tránsito D 83,53` + `Descuento H 3,00` + IVA + CxP 91 (costo 83,53) | igual |

La sonda destapó **dos defectos** vivos que el usuario ya había reportado: **(a)** la **FRV manual ignoraba la
cabecera** (`FRV-2`: total **94,00** y `desc 0,00`) porque el tipo inline de `createManual` no declaraba los tres
campos —el DTO **sí** los acepta, los hereda de `CommercialDocumentHeaderDto`— y el `create` fijaba
`discountMode: 'line'`; y **(b)** el **neteo de la FRV** borraba el descuento prorrateado de las líneas
(`discountTotal = 0`), así que el asiento guardado de una FRV con cabecera salía **neto** mientras su preliminar lo
desglosaba (documento ≠ preliminar, el mismo tipo de defecto de D9).

### Decisión del usuario en la ronda

Con la medición delante, y **solo** para compras: en modo **línea** el costo del artículo (kardex) **también** baja
al **neto pagado**, para que el mayor de inventario y el kardex sigan coincidiendo (opción recomendada); en modo
**cabecera** se mantiene T239 (costo bruto + la pata de descuento en el asiento).

### Entregado

1. **Los dos builders de factura** deciden con **el modo del documento** (`bookDiscount = discountMode === 'header'`):
   en **línea** el ingreso (ventas) y la mercadería/GRIR/asignación (compras) van al **neto pagado** y **no hay pata
   de descuento** (lo que sobre cae por el plug de redondeo, nunca por la cuenta de descuentos); en **cabecera** se
   mantiene la presentación **bruta** de T239 con `SALES_DISCOUNT`/`PURCHASE_DISCOUNT` (y el desglose 87/13 del
   perfil boliviano).
2. **El builder de borradores** usa el modo **real** (`_draftDiscountMode`, con la inferencia de D9 como respaldo de
   clientes viejos) y **solo materializa** la cabecera en las líneas en modo cabecera —antes lo infería del
   importe—, en los dos previews (venta y compra).
3. El `discountMode` viaja al motor de ventas (`createSaleInvoiceJournalEntry`, `sale-invoices`,
   `sale-reserve-invoices`) y el **POS** lo manda explícito (`'line'`: no tiene descuento de cabecera).
4. **FRV**: la cabecera **se captura y se guarda** (`headerSpec` en `createManual` + los tres campos en el
   documento) y el **neteo conserva el prorrateo** en `discountTotal` (sigue neteando los importes, que es lo que la
   FRV necesita; lo que ya no hace es esconder el descuento) ⇒ el asiento guardado **coincide con su preliminar**.
5. **Compras**: el **costo capitalizable** sigue el modo (cabecera bruto / línea neto), en `createManual`.

### Medido después (A/B, misma sonda)

| Documento | Modo línea | Modo cabecera |
| --- | --- | --- |
| FVE | `CxC D 91 · Ventas H 80,53 · IVA H 10,47 · IT` (**sin** descuento) | `CxC D 91 · Ventas H 83,53 · Descuentos D 3,00 · IVA · IT` |
| FRV | ídem neto (**total 91,00**; antes 94,00 con desc 0) | `Ventas H 83,53 · Descuento D 3,00 · IVA · CxC 91` |
| FCP | `CxP H 91 · IVA D 10,47 · Inventario D 80,53` · **COSTO 80,53** | `Inventario D 83,53 · Descuento H 3,00 · IVA · CxP 91` · **COSTO 83,53** |
| FRC | `Tránsito D 80,53 · IVA D 10,47 · CxP H 91` · COSTO 80,53 | `Tránsito D 83,53 · Descuento H 3,00 · IVA · CxP 91` · COSTO 83,53 |

En **los cuatro** documentos y en **los dos** modos el **preliminar es idéntico al asiento guardado** (mismos
totales D = H).

### Gates

- Unitarios **212 suites / 2667 tests** (`npm test`): los **cuatro** casos que fijaban la regla vieja reescritos con
  el motivo del cambio, **dos casos nuevos** de D10 (venta en modo línea y FRV con cabecera) y el `T239` de compras
  movido al modo cabecera con su caso hermano de línea (inventario y **costo** al neto).
- **E2E `discount-propagation` 19/19**: los cuatro casos de asiento/preview con descuento de línea reescritos, el
  caso del preliminar en modo línea nuevo y el payload del preview de la FRC puesto al día.
- `tsc` (app y e2e) y `eslint` 0. En el frontend **no hubo cambios** (los formularios ya mandaban el modo desde D9).

### Declarado

- Las **cadenas heredadas de compra** (`from-quotation`/`from-order`/`from-receipt`/`from-multi-*`) siguen
  **neteando** el descuento de cabecera dentro de los montos y dejando `discountTotal` en 0 ⇒ su asiento en modo
  cabecera sale **neto** (el dinero del documento **no** cambia). El arreglo es el mismo que se hizo en la FRV
  —conservar el prorrateo en `discountTotal` y el costo bruto— repartido en **7 sitios** donde el servicio aplica el
  ratio `netAmountWithHeaderDiscount` en línea.
- El **preliminar** recalcula el impuesto con el indicador de la línea: un payload sin `taxIndicatorId` pierde el
  IVA en el preliminar (medido: descuadre de 8,50 en el caso E2E; el formulario siempre lo manda).

## Ronda 12 — D10-b: las CADENAS HEREDADAS de compra (EN CURSO — medición y diseño cerrados)

### Medición (sonda `_probe-d10b-compra-heredada.ts` + `_probe-d10b-campos.ts`, base de desarrollo)

Cadena **cotización con cabecera 25 % → pedido → recepción → FRC → FCP** con precio 94 (IVA 13 % incluido;
el descuento correcto es 23,50 y el total 70,50):

| Documento | Totales | Línea (`lineSubtotal` / `discountTotal` / `cost`) | Asiento |
| --- | --- | --- | --- |
| Cotización / pedido | 70,50 / desc 23,50 ✔ | **0,00** / 23,50 / — (`subtotal` 70,50) | no contabilizan |
| **Recepción** (desde pedido) | 70,50 / desc 23,50 ✔ | 62,39 / 23,50 / **62,39** | `Inventario D 62,39 / GRIR H 62,39` (capitaliza **neto**) |
| **FCP desde recepción** | 62,39 ✔ | **0,00** / 23,50 / 55,21 | `GRIR D 62,39 + IVA D 7,18 + Diferencia de precio D 16,32 / CxP H 62,39 + Descuento H 23,50` |
| **FCP desde FRC** | **52,88 ✘** | **0,00** / 23,50 / **0,00** | solo reclasifica tránsito→inventario |
| **FCP desde pedido** | **52,88 ✘** | **0,00** / 23,50 / 62,39 | `… Inventario D 70,29 + Descuento H 23,49` |
| **FCP manual** (control) | 70,50 / desc 23,50 ✔ | 62,39 / 23,50 / 85,89 | `Inventario D 85,89 + IVA D 8,11 / CxP H 70,50 + Descuento H 23,50` ✔ |

**Los tres defectos medidos**: **(1)** ningún camino `from-*` persiste `lineSubtotal` (queda **0**, y el builder
arma el importe con `lineSubtotal ?? subtotal` → 0 + descuento, de ahí los 16,32 espurios en *Diferencia de
precio*); **(2)** el descuento de cabecera se aplica **dos veces** en `createFromOrder`, `createFromQuotation` y
`createFromReserveInvoice` (52,88 en vez de 70,50) porque el origen **ya lo materializó** en sus líneas (T254) y
el ratio de la cabecera se vuelve a aplicar —el camino `from-receipt` sí tiene la guarda `sourceMaterialized`, los
otros no—; **(3)** el **costo** capitalizable queda neto (62,39) en la recepción desde pedido y 0 en la FCP desde
FRC, así que el kardex no coincide con el mayor.

### Decisión del usuario (con la medición delante)

**T239 llega también a la RECEPCIÓN**: la recepción **capitaliza el bruto** (el descuento no baja el costo) y sus
líneas llevan el neto + el descuento; así el mayor y el kardex valúan lo mismo en toda la cadena y la factura que
nace de una recepción puede **desglosar el descuento** (GRIR al bruto que la recepción acreditó, CxP por el total
facturado y `PURCHASE_DISCOUNT` por el descuento). Cambia la valuación del stock de las recepciones con cabecera
(85,89 en vez de 62,39) y con ella el COGS de esas unidades.

### Diseño de la entrega (siguiente ronda)

1. **Recepción** (`purchase-receipts.service.ts`): `cost`/`totalCost` = **bruto** en modo cabecera
   (`lineSubtotal + discountTotal`) y **neto** en modo línea; sitios: `createFromOrder` (~712), manual (~1208) y
   los tres caminos `from-invoice` (3429/4077/4680), con las mismas guardas.
2. **Facturas `from-*`** (`purchase-invoices.service.ts`): persistir **`lineSubtotal`** (= el neto que ya se
   escribe en `subtotal`), **no re-aplicar** el ratio cuando el origen materializó
   (`_sourceMaterializedHeader`, como ya hace `createFromReceipt` con `effHeaderRatio`) y **costo bruto** en modo
   cabecera (`_capitalizedUnitCost`). Sitios: `createFromQuotation` (~625), `createFromOrder` (~1085/1174/1306),
   `createFromReceipt` (~1617/1797), `createFromReserveInvoice` (~2335) y los tres `from-multi-*`.
3. **Totales del destino**: `resolveSingleHeaderDiscount` vuelve a aplicar el % de la cabecera sobre `lineCalcs`
   que ya vienen descontados (de ahí el 52,88); el destino debe heredar la cabecera **referencial** y tomar los
   totales **de las líneas**. Se resuelve en el llamador (sin tocar el util compartido) o con un parámetro
   `sourceMaterialized` en el util, y el gate E2E del dinero (`T254`) dice si los caminos de venta se mueven.
4. **Gate nuevo**: caso E2E que pinche, en la cadena PQ→PO→REC→FRC→FCP con cabecera 25 %, el dinero (70,50 /
   desc 23,50), el **asiento** de la recepción (`Inventario` bruto) y el de la factura (`GRIR` bruto + CxP total +
   `PURCHASE_DISCOUNT`), el **costo** bruto de la línea y que el asiento cuadre.

## Pendiente del tramo

- **T255: CERRADO** (D1-D7 + UI). Declarado del tramo:
  - el **IT** (3 % del neto) no se revierte en la NC —el asiento de la NC es un hecho nuevo, no el espejo—; el
    espejo de la **cancelación** sí cuadra a cero.
  - `creditNoteMaxDays` sólo aplica cuando la NC **referencia** una factura (una NC manual sin factura no tiene
    contra qué medirse).
  - la fecha del diálogo de la NC se propone con el **día del tenant**; las reglas del backend (no anterior, no
    futura, plazo) la validan al confirmar.
- Del tramo T254 sigue abierto lo declarado entonces: la **edición de cotizaciones** (el dinero del documento queda
  bien y las líneas sin descuento), `addItem`/`updateItem` con cabecera **por importe** y el `PATCH` que devuelve
  las líneas de antes.

## Notas del arnés

- Base de desarrollo: `npm run db:recreate` exige parar el API; tras recrear hay que registrar la **tasa del día**
  (`POST /exchange-rates`, USD→BOB 6,96) o el guard bloquea las operaciones.
- Sondas (no se commitean): `backend-erp/scripts/_probe-t255-anulacion.ts` (cancelación + NC parcial + límites),
  `_probe-t255-espejo.ts` (par original/espejo y estados), `_probe-t255-ab.ts` (A/B de la fecha),
  `_probe-t255-ui-final.ts` + `_probe-t255-ui-espejo.ts` + `_probe-t255-ui-asientos.ts` + `_probe-t255-ui-fechas.ts`
  (validación sobre base limpia con los payloads de la pantalla).
- En una **base limpia** los artículos de las sondas ya no existen: se toman tres artículos de la semilla con
  `trackingType: 'NONE'` (los serializados exigen número de serie) y el precio se manda en el documento.
- El campo del espejo es `reversalJournalEntryId` **en el original** (apunta al espejo); el espejo **no** lleva
  `sourceDocumentId`, así que se localiza por el original.
- Los asientos de una factura incluyen las patas de **inventario/COGS**, así que su D total no es el total del
  documento: el importe de venta es la pata de `CxC`.
- Jest escribe el resumen en **stderr** y el arnés a veces reporta `exit code: 1` con la suite en verde.
