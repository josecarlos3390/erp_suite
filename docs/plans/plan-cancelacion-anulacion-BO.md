# T255 — Cancelación vs Anulación (BO): memoria de trabajo

> Estado: **CERRADO (rondas 1-22)**. D1-D7 y la **UI** cerrados en la ronda 8 (interruptores de
> Configuración, botón «Anular con nota de crédito» en facturas de venta y compra, y el campo de fecha fuera de los
> diálogos de cancelación); la ronda 9 cierra **D8** (la cancelación revierte IT y descuentos —espejo exacto— y el
> hecho **nuevo** va al **precio ya descontado**), la ronda 10 cierra **D9** (el preliminar materializa el descuento
> de cabecera y la grilla lo muestra prorrateado), la ronda 11 cierra **D10** (el descuento de **línea** no figura
> en los registros contables; el de **cabecera** sí, prorrateado, en el preliminar y en el contabilizado) y la ronda
> 12 cierra **D10-b** (las **cadenas heredadas de compra** aplican el descuento una sola vez, la **recepción**
> capitaliza el bruto —T239— y la factura lo desglosa); las rondas 13-18 cierran los declarados de D10-b y de T254
> (consolidación multi, edición de cotizaciones, `PATCH` del pedido, `addItem`, recepción multi) y la **ronda 19**
> cierra el reporte del usuario sobre la **FRC manual** (el cuerpo de guardado descartaba la cabecera capturada, la
> FRC manual era el único camino que no se contabilizaba y la grilla no mostraba «precio/total con descuento»), y la
> **ronda 20** cierra los **centavos**: la línea reparte al centavo (neto = residuo del importe cobrado) y la
> cabecera es exactamente Σ líneas, así que **asiento y preliminar son idénticos**. Plan
> del tramo anterior (descuento de cabecera):
> `docs/plans/plan-descuento-cabecera-parte2.md`.

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

## Ronda 12 — D10-b: las CADENAS HEREDADAS de compra (CERRADA)

### Medición antes (sondas `_probe-d10b-compra-heredada.ts` + `_probe-d10b-campos.ts`, base de desarrollo)

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
el ratio de la cabecera se vuelve a aplicar —el camino `from-receipt` sí tenía la guarda `sourceMaterialized`, los
otros no—; **(3)** el **costo** capitalizable queda neto (62,39) en la recepción desde pedido y 0 en la FCP desde
FRC, así que el kardex no coincide con el mayor.

### Decisión del usuario (con la medición delante)

**T239 llega también a la RECEPCIÓN**: la recepción **capitaliza el bruto** (el descuento no baja el costo) y sus
líneas llevan el neto + el descuento; así el mayor y el kardex valúan lo mismo en toda la cadena y la factura que
nace de una recepción puede **desglosar el descuento** (GRIR al bruto que la recepción acreditó, CxP por el total
facturado y `PURCHASE_DISCOUNT` por el descuento).

### Entregado

1. **Recepción** (`purchase-receipts.service.ts`): `cost`/`totalCost` = **bruto** en modo cabecera
   (`lineSubtotal + discountTotal`) y **neto** en modo línea, en el alta **desde pedido** y en la **manual**; y el
   **confirm** calcula el `subtotal` de cabecera desde el **neto de las líneas** (`subtotal`, el importe a pagar) en
   vez de desde el costo —antes eran el mismo número, con el costo bruto la recepción habría pasado a mostrar el
   precio de lista (94,00) en vez del importe a pagar (70,50)—, dejando `totalCost` como el costo capitalizable.
2. **Facturas heredadas** (`purchase-invoices.service.ts`): **(a)** guarda `_sourceMaterializedHeader` — si el origen
   ya materializó el descuento (T254) **no** se vuelve a aplicar el ratio (`effHeaderRatio = 1`); **(b)** la línea
   persiste **`lineSubtotal`** siempre (en `from-receipt`/`from-reserve-invoice` además se **replican** los importes
   del origen en vez de recalcularlos, que era lo que dejaba el neto en 0 y metía 16,32 en *Diferencia de precio*);
   **(c)** `_capitalizedUnitCost` — costo **bruto** en modo cabecera / **neto** en modo línea; **(d)** los **totales**
   del destino salen **de las líneas** con la cabecera **referencial** (`resolveSingleHeaderDiscount` volvía a
   aplicar el % sobre líneas ya descontadas). Caminos: `createFromQuotation`, `createFromOrder`,
   `createFromReceipt` y `createFromReserveInvoice`.
3. **Gate E2E nuevo** en `discount-propagation.e2e-spec.ts`: la cadena PQ(25 %)→PO→REC→FCP pincha que el descuento
   se aplique **una sola vez** (el dinero de la factura = el de la recepción), que la recepción **capitalice el
   bruto** (`Inventario D = neto + descuento`), que la línea de la factura tenga `lineSubtotal` + `discountTotal` y
   `cost` bruto, y que su asiento cuadre con el **GRIR por el bruto** + CxP por el total + `PURCHASE_DISCOUNT`.

### Medido después (A/B, misma sonda)

Los **seis** documentos de la cadena (recepción, FRC, FCP desde recepción, FCP desde pedido, FCP desde cotización y
FCP manual de control) quedan **idénticos**: `subtotal 62,39 + IVA 8,11 = total 70,50`, `desc 23,50`, línea
`neto 62,39 / desc 23,50 / costo 85,89`, y los asientos:

- **recepción** → `Inventario D 85,89 / GRIR H 85,89`;
- **FCP desde recepción** → `GRIR D 85,89 + IVA crédito D 8,11 / CxP H 70,50 + Descuento H 23,50` (D = H = 94,00);
- **FCP desde pedido / manual** → `Inventario D 85,89 + IVA D 8,11 / CxP H 70,50 + Descuento H 23,50`;
- **FCP desde FRC** → `Inventario D 85,89 / Tránsito H 85,89` (netea el tránsito que la FRC debitó al bruto; el
  descuento ya lo reconoció la FRC).

### Gates

- Unitarios **212 suites / 2667 tests**.
- E2E `discount-propagation` (con el caso nuevo) y `purchase-flow` en verde; `tsc` y `eslint` 0.
- Push verificado con `git ls-remote` en los dos espejos.

### Declarado

- Los caminos **`from-multi-*`** (selección múltiple de pedidos/recepciones/cotizaciones) conservan la lógica
  anterior: sus líneas no persistían `lineSubtotal` y aplican el ratio sin la guarda. Mismo arreglo, sitios propios
  (los tres `createFromMulti*`).
- Los tres caminos de recepción **desde factura** (`from-invoice`, ~3429/4077/4680) toman el costo del artículo de
  factura (`ii.cost`), que en modo cabecera ya es **bruto** ✅, pero el que lo toma de la línea del payload
  (3378/4655) sigue neteando: se cierra con el mismo helper.
- **T254** sigue abierto (edición de cotizaciones con materialización, `addItem`/`updateItem` con cabecera por
  importe y el `PATCH` que devuelve las líneas de antes).

## Ronda 13 — D10-b, cierre: la CONSOLIDACIÓN MULTI (CERRADA)

### Medición (sonda `_probe-d10b-multi.ts`, base de desarrollo: dos pedidos/cotizaciones/recepciones con cabecera 25 % facturados juntos)

| Camino | Modo del destino | Línea antes (`lineSubtotal` / `desc` / `cost`) | Línea después |
| --- | --- | --- | --- |
| `from-multi-order` | **line** (R2) | 0,00 / 23,50 / **85,89** (bruto) | 62,39 / 23,50 / **62,39** (neto) |
| `from-multi-quotation` | **line** | 0,00 / 23,50 / **85,89** (bruto) | 62,39 / 23,50 / **62,39** (neto) |
| `from-multi-receipt` | **line** | 0,00 / 23,50 / **1.650,00** (costo del maestro) | 62,39 / 23,50 / **85,89** (el bruto que la recepción capitalizó y que la factura limpia del GRIR) |

El dinero era correcto en los tres (`subtotal 124,78 + IVA 16,22 = 141,00`, `desc 47,00`): el descuento viaja **materializado a línea** (R2), así que no se aplicaba dos veces. Lo que estaba mal era el **`lineSubtotal`** (null/0, y el builder lee `lineSubtotal ?? subtotal`) y el **costo**, desalineado del asiento en los tres.

### Entregado

- `lineSubtotal` persistido en los tres caminos.
- Costo capitalizable con `_capitalizedUnitCost` y el modo del **destino**: **neto** en multi-pedido y multi-cotización (modo línea: el descuento no figura en el asiento) y, en multi-recepción, el costo de la **línea de la recepción** (`ri.cost`, el bruto que el asiento limpia del GRIR) en vez del costo del maestro del artículo; `totalCost` = costo × cantidad.
- **Defecto que destapó el gate nuevo**: la confirmación de la factura multi fallaba con **500** «Asiento desbalanceado … D=159,34 C=159,33». Causa: los totales se calculaban **en agregado** y el impuesto de la línea se **persiste redondeado** a centavos (`Decimal(14,2)`: 9,17) mientras el agregado sumaba el valor sin redondear (9,165 × 2 = 18,33) —el asiento, que sí suma las líneas, daba 18,34—. Cerrado: los totales se acumulan con el importe **redondeado** en multi-pedido y multi-cotización y salen **de las líneas persistidas** en multi-recepción (la invariante de `recalcHeader`).

### Gates

- Unitarios **212 suites / 2667 tests**; E2E `discount-propagation` **con caso nuevo** (la consolidación multi: destino en modo línea, `lineSubtotal` persistido, costo = neto en multi-pedido y = neto + descuento en multi-recepción) y `purchase-flow` en verde; `tsc` (app y e2e) y `eslint` 0.

### Declarado

- Los dos caminos de recepción **desde factura** que toman el costo de la línea del payload (3378/4655) siguen neteando: mismo arreglo, con el modo del documento como discriminante.

## Ronda 14 — T254: la EDICIÓN de cotizaciones (CERRADA)

### Medición (sonda `_probe-t254-cot-edit.ts`, base de desarrollo: canasta 150/50/200 con cabecera 25 %)

| Operación | Documento | Líneas |
| --- | --- | --- |
| **Alta** (venta y compra) | `265,49 + IVA 34,51 = 300,00`, `desc 100,00` ✔ | `pct=25`, `desc` **37,50 / 12,50 / 50,00** ✔ (materializa) |
| **PATCH venta** cabecera 10 % | `318,58 + 41,42 = 360,00`, `desc 40,00` ✔ (el dinero del documento está bien) | `pct=-`, `desc=0,00` ✗ y `subtotal` **neto** (135/45/180): el descuento se fue de las líneas |
| **PATCH venta** cabecera **importe 100** | `265,49 + 34,51 = 300,00`, `desc 100,00` ✔ | `pct=-`, `desc=0,00` ✗ |
| **PATCH compra** cabecera 10 % | `318,58 + 41,42 = 360,00`, `desc 40,00` ✔ | `subtotal` **a precio lleno** (150/50/200) y `desc=0,00` ✗ ⇒ **Σ líneas (400) ≠ documento (360)** |

En todas las líneas `lineSubtotal` queda **0/null** (y `lineTotal` también): la cotización solo publica `subtotal` (el neto).

### Causa

`sales-quotations.update` y `purchase-quotations.update` siguen en el encoding viejo «cabecera al documento»: netean los montos de la línea con el **ratio** (`netAmountWithHeaderDiscount(lineCalc.X, headerRatio)`), **borran** el descuento efectivo por línea y calculan los totales con `calcDocumentTotalsWithIndicators` (agregado). En compra además no se netean las líneas, así que el documento y sus líneas se contradicen.

### Diseño del arreglo (mismo patrón que `sales-orders.update` / `purchase-orders.update`, ya migrados en T254)

1. **Pre-pase** con la regla única (`resolveEffectiveLineDiscounts`) sobre `dto.items` con `{pct, amt}` de la cabecera cuando `discountMode === 'header'`; el descuento efectivo se aplica por índice en `calcLineWithIndicator` (sin ratio).
2. Persistir por línea: `discountPct`/`discountAmt` (efectivos), `discountTotal`, **`lineSubtotal`** (el neto), `lineTotal`, `taxAmount`.
3. **Totales del documento desde las líneas** (`calcDocumentTotalsFromLines`) y la cabecera **referencial** (modo + pct/amt), de modo que `Σ líneas = documento`.
4. El mismo tratamiento en el **alta** para publicar `lineSubtotal` (hoy queda en 0).
5. Gate: caso E2E que edite una cotización con cabecera **porcentual** y **por importe** y pinche el dinero por línea (12,50/37,50/50,00), `Σ líneas = totalDiscount` y `lineSubtotal` poblado, en venta y compra.

### Entregado

- **Los dos `update`** (venta y compra) con el pre-pase de la regla única, el descuento efectivo por línea (sin el ratio), `lineSubtotal` persistido y los totales desde las líneas; **el alta** también publica `lineSubtotal`.
- **El defecto que destapó el gate nuevo**: `PATCH /sales-quotations/:id` y `PATCH /purchase-quotations/:id` respondían **404 «Cotización no encontrada»** en cualquier empresa donde el **id del usuario ≠ id del tenant**, porque los dos controladores llamaban `service.update(+id, dto, user.sub, user.tenantId)` contra la firma `update(id, dto, tenantId, updatedById?)` —argumentos **cambiados**—; en la base de desarrollo usuario y tenant son **1** y el defecto quedaba oculto. Los otros tres controladores con esa forma (devoluciones de venta y compra, solicitudes de compra) tienen la firma en el orden contrario y **no** estaban afectados.
- Gate E2E nuevo en `discount-propagation.e2e-spec.ts` (venta y compra; cabecera porcentual y por importe).

### Medido después (A/B, misma sonda)

**Venta** PATCH cabecera 10 % → `318,58 + 41,42 = 360,00`, `desc 40,00`, líneas `pct=10` con `desc` **15,00 / 5,00 / 20,00** (Σ = 40 = el documento) y `neto` 119,47 / 39,82 / 159,29; PATCH cabecera **importe 100** → **37,50 / 12,50 / 50,00** (prorrateo **por valor**) y Σ = 100 con el documento en 300,00; **compra** PATCH 10 % → `pct=10` con **15,00 / 5,00 / 20,00**; el alta publica `lineSubtotal` (99,56 / 33,19 / 132,74 al 25 %).

### Gates

- Unitarios **212 suites / 2667 tests**; E2E `discount-propagation` con el caso nuevo (y **21/22** en la corrida nocturna: el único fallo es un *flake* del arnés —`today` en UTC contra el día del tenant, ver abajo—); `tsc` (app y e2e) y `eslint` 0.

### Declarado

- **Flake del arnés E2E (no del flujo)**: `today` se calcula con `toISOString()` (UTC), así que a partir de las **20:00 de La Paz (UTC−4)** el día del tenant va **uno por detrás** y la NC «de hoy» cae en el futuro: `assertCreditNoteDate` responde 400 y el caso T254 (7b) falla por la hora a la que se corra. Se deja anotado en el propio caso.
- Siguen abiertos: `addItem`/`updateItem` con cabecera **por importe** (re-prorrateo entre líneas) y el `PATCH` que devuelve las líneas de antes de la edición.

## Ronda 15 — T254: el `PATCH` del pedido devolvía las líneas de ANTES (CERRADA)

### Medición (sonda `_probe-t254-ped-edit.ts`, base de desarrollo)

Pedido manual con cabecera **por importe** de 100 sobre la canasta 150/50/200 —el alta reparte bien (`desc` **37,50 / 12,50 / 50,00**, Σ = 100 = la cabecera)— y después un `PATCH` que sube la cantidad de todas las líneas a 2: la **respuesta** traía las cantidades **[1, 1, 1]** mientras la base ya tenía **[2, 2, 2]**.

La misma sonda midió dos cosas más: `addItem` y `updateItem` **exigen una línea vinculada a una cotización** (`quotationItemId`): `addItem` responde **400 «quotationItemId must be an integer number»** y `updateItem` sobre una línea manual **400 «No se puede editar una línea desvinculada»** —así que el caso declarado de la cabecera **por importe** con esas dos operaciones necesita un pedido nacido de una cotización—; y las líneas del pedido no publican `lineSubtotal` (el `subtotal` del pedido es el **importe cobrado**, no el neto, así que publicarlo cambiaría lo que leen los documentos de la cadena: se deja como está, medido).

### Causa y arreglo

`sales-orders.update` terminaba su `$transaction` con `return this.findOne(id, tenantId)` y `findOne` lee con `this.prisma` —**otra** conexión—, así que dentro de la transacción (todavía sin confirmar) devolvía el estado **anterior**. Ahora la transacción se espera con `await` y el documento se lee **después del commit**.

### Medido después (A/B)

La respuesta y la base **coinciden** (`[2, 2, 2]` en las dos) ✓. Y se cerró, de paso, el ***flake* del arnés** que aparecía de noche: el caso T254 (7b) calculaba `today` con `toISOString()` (UTC) y a partir de las 20:00 de La Paz el día del tenant va uno por detrás, así que la NC «de hoy» caía en el futuro (`assertCreditNoteDate` → 400); ahora el «hoy» del caso se toma del **día del tenant** (`Intl.DateTimeFormat` con `America/La_Paz`) y el caso pasa a cualquier hora ✅.

### Gates

- Unitarios **212 suites / 2667 tests**; E2E `sales-flow` en verde y `discount-propagation` **33/33** (el caso de la fecha ya no depende de la hora); `tsc` y `eslint` 0.

### Declarado

- `addItem`/`updateItem` con cabecera **por importe** (re-prorrateo entre líneas) sigue pendiente: hay que medirlo con un pedido **nacido de una cotización** (la sonda ya está escrita) y decidir el reparto del importe entre las líneas existentes y la nueva.
- Los dos caminos de **recepción desde factura** que toman el costo de la línea del payload.

## Ronda 16 — T254: `addItem` con cabecera por IMPORTE (MEDIDO: no hay defecto; la decisión ya estaba tomada)

### Medición (sonda `_probe-t254-ped-add.ts`, base de desarrollo)

Cotización 150/50/200 con cabecera **por importe** de 100 → pedido con **dos** líneas → `addItem` de la tercera (200):

| Momento | Documento | Líneas | Σ descuentos vs cabecera |
| --- | --- | --- | --- |
| Pedido desde la cotización (2 líneas) | `total 100,00`, `desc 100,00` | `amt` **25** (50) y **75** (150) — prorrateo **por valor** ✓ | 100 = 100 ✔ |
| Tras `addItem` (3.ª línea de 200) | `total 300,00`, `desc 100,00` | la nueva `amt=-`, `desc 0,00`; las otras conservan 25 y 75 | 100 = 100 ✔ |

El importe **no** se redistribuye al agregar una línea —la nueva no recibe parte—, pero el documento queda **coherente**: su descuento sigue siendo el importe fijo (100), la suma de los descuentos de línea **igual** a la cabecera y el total del documento **igual** a la suma de sus líneas. Es la decisión que T254 dejó escrita en el propio código («con cabecera por IMPORTE no se toca aquí: el importe se prorratea sobre el documento y repartirlo línea a línea lo contaría dos veces»), y la alternativa (redistribuir el importe por valor entre las tres líneas: 12,50 / 37,50 / 50,00) **reescribiría retroactivamente** el descuento de líneas que el usuario no tocó. **Conclusión: no hay defecto que corregir; el declarado se cierra con la medición.** El caso **porcentual** sí recibía su parte desde T254 ✓.

`updateItem` sobre una línea vinculada sigue su guarda de cantidad (`400 «Cantidad excede lo cotizado»` si se sube por encima de lo cotizado) — comportamiento correcto, medido.

### Gates

- Sonda en vivo (A/B arriba) + los gates ya verdes del tramo: unitarios **212 suites / 2667 tests**, E2E `discount-propagation` **33/33** y `sales-flow`; `tsc` y `eslint` 0. **Sin cambios de código** en esta ronda.

### Declarado

- Queda **un** punto del objetivo: los dos caminos de **recepción desde factura** que toman el costo de la línea del payload y siguen neteando (el resto de la cadena de compra ya usa el costo bruto/neto según el modo).

## Ronda 17 — D10-b: el costo de la recepción en los caminos `multi-*` (ALCANCE CORREGIDO, pendiente de medición y arreglo)

### Lo que dice el código (inspección, `purchase-receipts.service.ts`)

Los cinco caminos que crean una recepción y su costo:

| Camino | Método | Costo que persiste | Estado |
| --- | --- | --- | --- |
| Desde **pedido** | `createFromOrder` (~712) | ya arreglado en la ronda 12 | ✔ bruto en cabecera |
| **Manual** | `createManual` (~1208) | ídem | ✔ bruto en cabecera |
| Desde **varias FRC** (`from-multi-reserve-invoice`) | `createFromMultiReserveInvoice` (~4022) | `ii.cost` — el costo que la **FRC** capitalizó | ✔ (la FRC ya aplica el modo; en cabecera es bruto) |
| Desde **varios pedidos** (`from-multi-order`) | `createFromMultiOrder` (~3378) | `line.priceNet ?? line.price ?? oi.priceNet ?? oi.price ?? catálogo` | ✗ **neto** |
| Desde **varias cotizaciones** (`from-multi-quotation`) | `createFromMultiQuotation` (~4625) | ídem (con la rama de cotización vencida) | ✗ **neto** |

**Corrección del declarado**: el camino «recepción desde factura» **no** estaba afectado (toma el costo de la FRC, que ya lo descuenta según su modo); los dos que quedan son los de **multi-pedido** y **multi-cotización**.

### Arreglo (mismo patrón que la ronda 12 en `createFromOrder`)

En los dos sitios: calcular el costo desde el **modo del documento** (`payload.discountMode ?? order.discountMode ?? 'line'`): **bruto** = neto de la línea + `discountTotal` prorrateado por la cantidad facturada; **neto** = el que ya usa. Después, verificar con la sonda que la recepción y su asiento (`Inventario D = bruto`) valúan lo mismo, y que `totalCost` = costo × cantidad.

### Medición pendiente

Sonda: dos pedidos manuales con cabecera 25 % → `POST /purchase-receipts/from-multi-order` con los dos → comparar `cost`/`totalCost` de la línea con el débito de inventario del asiento y con el costo que el alta manual (`from-order`) ya deja bruto. Ídem para `from-multi-quotation`.

## Ronda 18 — D10-b: la recepción `from-multi-order` (MEDIDO: el costo está bien; los IMPORTES no se persisten)

### Medición (sonda `_probe-d10b-rec-multi.ts`, base de desarrollo)

Dos pedidos manuales con cabecera 25 % (94 con IVA incluido) → `POST /purchase-receipts/from-multi-order`:

| Qué | Medido | Veredicto |
| --- | --- | --- |
| Modo del documento | `modo=line` (el destino de la consolidación multi materializa la cabecera a línea, R2) | ✔ coherente |
| **Costo** de la línea | `costo 62,39` (el neto de la línea del pedido) | ✔ **correcto**: el asiento debita `Inventario D 62,39 / GRIR H 62,39` por línea, así que el kardex valúa lo mismo que el mayor (la regla T239/D10-b se cumple en modo línea con el **neto**) |
| **Importes** de la línea | `lineSubtotal`, `subtotal`, `discountTotal` y `taxAmount` = **0,00** | ✗ **no se persisten** |
| Totales del documento | `subtotal 0,00`, `IVA 0,00`, `total 0,00`, `desc 0,00` | ✗ (el confirm los recalcula de las líneas: también 0) |

**Conclusión**: el punto declarado del **costo** queda **cerrado con la medición** (el neto de esos caminos es el correcto porque su documento es modo línea, no un descuido) — y de paso la sonda destapó un defecto **distinto y nuevo**: en `createFromMultiOrder` las líneas de la recepción publican **solo el costo**, así que la recepción multi-pedido muestra importes en **cero** y su `discountTotal` no conserva el prorrateo (lo que el objetivo pedía para las cadenas). El mismo patrón hay que comprobarlo en `createFromMultiQuotation` (~4678).

### Entregado (misma ronda)

En **los dos** caminos (`createFromMultiOrder` y `createFromMultiQuotation`) la línea de la recepción **publica sus importes** con el mismo prorrateo del alta desde pedido (`prorateLineAmounts(oi|qi, cantidad, cantidadDelOrigen)`): `lineSubtotal`/`subtotal` (el neto), `lineTotal`, `taxAmount`, `discountPct`/`discountAmt` del origen y `discountTotal`; los **totales del documento** salen de las líneas (el `confirm` los recompone con la invariante de siempre). El **costo** se queda en el **neto** porque el destino es modo **línea** —y coincide con el débito de inventario del asiento—.

### Medido después (A/B, misma sonda)

`REC-17`: **`subtotal 124,78 + IVA 16,22 = total 141,00`, `desc 47,00`**, líneas `neto 62,39 / desc 23,50 / IVA 8,11 / costo 62,39` y asiento `Inventario D 62,39 / GRIR H 62,39` por línea (antes: documento y líneas en **0,00** salvo el costo).

## Ronda 19 — el descuento de cabecera de la FRC MANUAL: el cuerpo de guardado lo descartaba y la FRC no se contabilizaba (CERRADA)

### Lo que reportó el usuario (2026-09-27)

> «acabo de crear la factura de reserva FRC-26, y cuando visualizo la factura de reserva, veo que no aplicó el
> descuento de cabecera del 25 % que inicialmente puse, antes de crearlo sí aplicaba, y también veo el contabilizado
> está mal, porque debería ser el mismo que genera el asiento preliminar, ¿por qué está así? si hiciste tantas
> pruebas?»

Y después: «y antes de crearla tampoco me calcula el precio con descuento y el total con descuento».

### Medición antes (sonda `_probe-frc26.ts`, base de desarrollo, `FRC-26` = id 53)

```
== FRC-26 (id=53 isReserve=Y CLOSED) 2026-09-27
   modo=line pct=- amt=- descTotal=0.00 | subtotal=348.00 IVA=52.00 total=400.00
   · item=15 cant=1 price=150.00 … neto=130.50 desc=0.00
   · item=16 cant=1 price=50.00  … neto=43.50  desc=0.00
   · item=20 cant=1 price=200.00 … neto=174.00 desc=0.00
   (sin asiento guardado)
```

Las columnas de origen (`orderId`, `purchaseReceiptId`, `purchaseQuotationId`) están **todas nulas** ⇒ el documento
nació del alta **manual**. `FRC-25`, creada desde recepción, sí tenía su `ASI-000105` POSTED.

### Las tres causas (las tres medidas)

1. **El payload del alta manual descartaba la cabecera** (frontend): los flujos «desde cotización» y «desde orden»
   tampoco la enviaban; solo «desde recepción» lo hacía. El **preliminar** sí la aplicaba porque su payload sí lleva
   `discountMode`/`headerDiscountPct`/`headerDiscountAmt` — de ahí la divergencia que el usuario vio.
2. **La FRC manual no se contabilizaba** (backend): `createManual` confirmaba **solo** las facturas directas
   (`if (isReserve === IS_DIRECT)`), y era el **único** de los seis caminos que crean una FRC con esa guarda
   (`from-receipt`, `from-quotation`, `from-order`, `from-reserve-invoice` y los tres `from-multi-*` confirmaban
   también la reserva). La FRC nacía `CLOSED` **sin asiento**: el «contabilizado» no existía.
3. **La grilla no calculaba «precio con descuento» ni «total con descuento»** (frontend): `unitDiscountForRow` /
   `unitNetForRow` (base compartida) leían solo el descuento **propio** de la línea —vacío en modo cabecera— y el
   `displayDiscountForRow` de la FRC devolvía **0** en los borradores por su guarda `!isStoredDocument`. Los
   totalizadores y el preliminar sí aplicaban el 25 %: la grilla era la única que no.

### Entregado

- **Backend**: `createManual` confirma también la reserva (mismo patrón y misma transacción que los otros cinco
  caminos).
- **Frontend (FRC)**: helper `headerDiscountPayload()` difundido en los **cuatro** caminos de alta y
  `applyHeaderDiscountFromSource()` para los dos «Copiar a» (cotización y pedido); `displayDiscountForRow` usa el
  prorrateo compartido (`rowDiscountDisplay`) **también en borradores**.
- **Frontend (familia, mismo defecto medido con un barrido de los 58 sitios de escritura)**: `unitDiscountForRow`/
  `unitNetForRow` de la base compartida muestran el prorrateo en modo cabecera (los 14 formularios); alta manual de
  **FCP**, **FVE** (manual y desde cotización) y **FRV**; `createFromMultiQuotation` de los dos pedidos (mandaban el
  modo y omitían el valor); los dos `PATCH` que **borraban** un descuento guardado (pedido de compra
  `_saveHeaderAndThen` —«Crear recepción»— y `update` de la NC de compra, cuyo DTO estrena los campos).

### Medido después (A/B, sonda `_probe-frc-manual-descuento.ts`, payloads exactos de la pantalla)

| paso | payload | documento | asiento |
| --- | --- | --- | --- |
| A | sin los tres campos (lo que mandaba la pantalla) | `modo=line desc 0,00 total 400,00` | **ninguno** |
| B | preliminar con cabecera 25 % | — | `Asignación D 137,06 + 45,69 + 182,74 · IVA D 34,51 · Descuento H 100,00 · CxP H 300,00` |
| C | con los tres campos (arreglado) | `modo=header pct=25 desc 100,00 · neto 265,49 + IVA 34,51 = 300,00` | `ASI-000109` POSTED **idéntico al preliminar** |

Líneas del documento arreglado: `neto 99,56 / 33,19 / 132,74` con `desc 37,50 / 12,50 / 50,00`.

### Gates

- **E2E nuevo** en `discount-propagation.e2e-spec.ts`: «la FRC manual con cabecera 25 % se contabiliza al crearse y
  su asiento = el preliminar» (dinero del documento + existencia del asiento + CxP por lo que se paga + igualdad
  **cuenta a cuenta** entre el asiento guardado y el preliminar).
- `discount-propagation` **23/23**, `purchase-flow` **14/14**, unitarios backend **212 suites / 2667 tests**,
  `tsc`/`eslint` 0; frontend `tsc` app y specs 0, **`ng build` AOT 0**, **Karma 2338/2338** (9 casos nuevos),
  prettier (ratchet) limpio.

### Declarado

- El **alta manual de la FRC** era la punta del defecto de familia «el cuerpo de escritura descarta la cabecera
  capturada». Quedan **fuera** de esta ronda los caminos de **copia** cuya **carga** no repuebla la cabecera en el
  formulario (los tres `multi-*` de compras, los tres de la FRV, FVE desde reserva, FCP desde
  cotización/recepción/reserva, NCP `loadNote`): el documento guardado **hereda bien** del origen (backend), pero su
  **preliminar** no muestra el descuento. Se cierran con el mismo patrón (`applyHeaderDiscountFromSource`) y su
  medición por camino.

## Ronda 20 — los CENTAVOS: cabecera = Σ líneas = asiento = preliminar (CERRADA)

### Lo que se midió al verificar el reemplazo de la FRC del usuario

La comprobación de la ronda 19 («el asiento del reemplazo debe ser el mismo que el preliminar») dejó
**1–2 centavos de diferencia**. La sonda `_probe-r20-centavos.ts` (canasta 150/50/200 con cabecera 25 % e
indicador **IVA por dentro** `BOLIVIA_SIN`, el del documento del usuario: `FRC-33` / `FCP-27`) midió la
invariante completa y encontró la causa **dentro de la propia línea**:

```
cabecera: neto 261,00 + IVA 39,00 = 300,00 · desc 100,00
Σ líneas: neto 261,01 + IVA 39,01 = 300,00 · desc 100,00
línea:    neto 97,88  + IVA 14,63  = 112,51  ← su lineTotal es 112,50
asiento:  IVA crédito D 39,01 · descuento H 87,02 + 13,00 = 100,02 (documento: 100,00)
preliminar vs contabilizado: DIFIEREN (39,00 contra 39,01)
```

### Causa

El calculador devolvía **precisión completa** (`gross × (1 − tasa)`) y cada columna se redondeaba **por
separado** al persistir en `Decimal(14,2)`: en el medio centavo **las dos subían** (97,875 → 97,88 y
14,625 → 14,63). La cabecera, además, acumulaba los montos **sin redondear**, así que no era la suma de lo
que quedaba guardado en las líneas; y el asiento —que se arma **por línea**— salía un centavo por encima
del preliminar, que se arma con los totales de la cabecera.

### Entregado (la regla en el sitio único)

`src/common/tax-calculation/*.strategy.ts` (los dos métodos): el importe cobrado y el IVA se redondean a
centavos y el **neto es el residuo** (`total − IVA`); en IVA sumado, el neto y el impuesto se redondean y el
total es su suma; `discountTotal` también sale redondeado. Espejo en el frontend (`shared/pricing.util.ts`)
para que el preliminar que arma la pantalla mande los mismos centavos.

### Medido después (A/B, misma sonda: `FRC-35` y `FCP-29`)

```
cabecera: neto 260,99 + IVA 39,01 = 300,00 · desc 100,00
Σ líneas: neto 260,99 + IVA 39,01 = 300,00 · desc 100,00   ⇒ cabecera == Σ líneas
líneas:   neto 97,87 + IVA 14,63 = 112,50 · neto 32,62 + 4,88 = 37,50
asiento:  Σ D 400,00 = Σ H 400,00 · descuento 87,00 + 13,00 = 100,00 (exacto, sin plug)
preliminar vs contabilizado: IDÉNTICOS (cuenta a cuenta)
```

### Gates

- **Caso E2E nuevo** en `discount-propagation.e2e-spec.ts`: «Ronda 20 — los centavos cuadran: cabecera =
  Σ líneas = asiento = preliminar (3 líneas, IVA por dentro)» → `discount-propagation` **24/24**.
- Regresión de dinero: `purchase-flow` + `sales-flow` + `returns-and-credit-notes` **36/36**.
- Unitarios **212 suites / 2667 tests** con los **dos casos reescritos** en `pricing.util.spec.ts` (fijaban
  la precisión completa: `88,49557522`/`11,50442478` y `159,2920354`/`20,7079646`), ahora con la aserción
  `neto + IVA = total`; `tsc`/`eslint` 0.
- Frontend: `tsc` app y specs 0, **`ng build` AOT 0**, **Karma 2339/2339** y prettier (ratchet) limpio.

### Declarado

- El cambio es **transversal al dinero**: en los casos de medio centavo el neto puede moverse **un centavo**
  respecto de lo que se guardaba antes. Es el arreglo (ahora cuadra con el IVA y con el total), no una
  regresión; queda anotado porque afecta a cualquier documento con IVA por dentro.
- Sigue abierto el declarado de la ronda 19: los caminos de **copia** cuya **carga** no repuebla la cabecera
  en el formulario (los tres `multi-*` de compras, los tres de la FRV, FVE desde reserva, FCP desde
  cotización/recepción/reserva, NCP `loadNote`).

## Ronda 21 — el asiento AGRUPA la misma cuenta y cuadra la divisa en la línea de ajuste (CERRADA)

### Lo que reportó el usuario (al crear la FRC-36)

> «me ha generado por cada artículo una cuenta de inventario, pero como es la misma cuenta debería agruparlo y
> totalizar; se debe disgregar cuando la cuenta es diferente» y «se observa en los dólares que el asiento tiene 0.01
> de diferencia, ¿no debería ir a la cuenta de diferencia de cambio? ¿o el prorrateo quedó mal para los dólares?»

### Medido antes (sonda `_probe-frc36.ts` sobre `FRC-36` / `ASI-000118`; BOB TC 1, cabecera 25 %)

```
2.1.1.01.001 CxP            H 300,00   (USD 24,89 → lo correcto es 300 ÷ 12,05 = 24,90)
5.1.2.01.005 Descuento      H  87,00   (7,22)
1.1.2.06.005 IVA del desc.  H  13,00   (1,08)
1.1.6.01.001 IVA crédito    D  39,01   (3,24)
1.1.3.02.001 Tránsito       D 180,50   (14,98)  ← misma cuenta
1.1.3.02.001 Tránsito       D  45,12   ( 3,74)  ← misma cuenta
1.1.3.02.001 Tránsito       D 135,37   (11,23)  ← misma cuenta (exacto: 11,24)
Σ D = Σ H = 400,00 · 7 líneas
```

En **bolivianos cuadra** (`neto 260,99 + IVA 39,01 = 300,00`, `desc 100,00`); los dos defectos son **(1)** la
cuenta repetida en tres patas y **(2)** el reparto del centavo de la **columna de moneda secundaria**, que se
cuadraba por diferencia en la **primera línea de crédito** —el CxP— en vez de en la línea de ajuste. **No es
diferencia de cambio**: esa nace al pagar a otra tasa; un centavo así es redondeo.

### Decisiones del usuario

1. Agrupar **solo** cuando coincidan la cuenta **y** los ejes analíticos (proyecto, dimensiones, norma de reparto,
   tercero) y el mismo lado (débito/crédito) —como SAP B1, para no romper los informes por centro de costo—.
2. Cada línea con **su propia** conversión y el centavo del residuo en la **línea de ajuste/redondeo** (nunca en el
   pagable).

### Entregado — la regla en el punto único (`src/common/accounting/journal-entry-core.ts`, las 7 familias)

- `_groupJournalLines` / `_journalLineGroupKey` / `_mergeJournalLines`, aplicados en `_persist` **después** de
  expandir las normas de reparto y **antes** de la doble expresión; `_buildPreviewResponse` usa el **mismo**
  agrupado (preliminar == asiento).
- Clave: `accountId | lado | partnerId | branchId | contraAccountId | projectId | projectCode | dimension1..5 |
  distributionRuleId | sourceDistributionRuleId | currency | exchangeRate | taxRate | dueDate | ref1 | ref2`. No se
  agrupan importes cero ni líneas con doble expresión preestablecida; con una línea no cambia nada.
- `_balanceConvertedExpressions` + `_resolveConvertedResidualIndex`: el residuo va por prioridad a la **línea de
  ajuste de redondeo** → a la de **descuento** → a la **mayor línea que no sea de tercero** (CxC/CxP se identifican
  por `requiresPartner`), así que el pagable nunca absorbe el centavo.

### Medido después (A/B, sonda `_probe-r21-agrupado.ts`, ANTES = build limpio de HEAD en un puerto aparte)

| caso | antes | después |
| --- | --- | --- |
| FRC, 3 artículos con la **misma** cuenta | 7 líneas · Tránsito en 3 patas · CxP USD **24,89** · Σsys 33,19 | **5 líneas** · Tránsito **360,99** (USD 29,96) · CxP USD **24,90** · Σsys **33,20 = 33,20** |
| FCP, **dos cuentas distintas** (`acctCode` 140/143) | 4 líneas | 4 líneas (**no agrupa**) |
| FCP, **misma** cuenta (130,50 + 43,50) | 4 líneas | **3 líneas** (174,00) |

Preliminar **idéntico** al contabilizado en los tres.

### Gates

`tsc` de app y specs **0**; **unitarios 212 suites / 2667 tests** (dos expectativas de conteo reescritas con el
motivo: dos patas de GRIR de la misma cuenta se totalizan y `COGS/Inventario` pasa de 4 a 2 líneas; el mock marca
CxC/CxP con `requiresPartner` real, verificado en la base); **suite E2E completa 41 suites / 383 tests** en verde
(el cambio toca el punto único de todas las familias); `eslint` 0 y prettier limpio.

### Declarado

- En un **agregado**, `sourceTransactionLineId` queda en `null` (siempre) y `itemId`/`warehouseId`/`itemGroupId` y
  `sourceTransactionType`/`sourceTransactionId` **solo si difieren**: el total no se atribuye a una línea de
  documento concreta. El **informe por norma de reparto** ve una fila donde antes veía N del mismo documento, con el
  mismo total; los **tramos de una misma norma no se agrupan entre sí** (difieren en `dimension`).
- El saldo por cuenta de la **columna de moneda secundaria** puede moverse **±1 centavo** (la línea agrupada lleva su
  propia conversión).
- El **informe ICE por artículo** lee `itemId` de la pata `ICE_PAGAR`, que **hoy ningún builder puebla** (declarado
  por si algún día se puebla).

## Ronda 22 — la FRC se puede RECIBIR (total o parcial) y las parciales suman el tránsito exacto (CERRADA)

### Lo que reportó el usuario

> «acabo de generar la factura de reserva de compra FRC-40, pero no puedo generar la recepción; tengo que poder generar
> la recepción de mercadería para este flujo, y puedo recibir la mercadería total o parcial; en caso de que lo reciba
> parcial las 3 recepciones deben sumar el total de la cuenta `1.1.3.02.001 Mercaderías en Tránsito General` para
> volcar el asiento, tomando en cuenta si la FRC tiene descuento o no para asignar a cada recepción el costo que
> calculó la FRC».

### Medido antes (sonda `_probe-frc-recepcion.ts` sobre `FRC-42`, canasta 150/50/200 al 25 %, tránsito 360,99)

- `POST /purchase-receipts/draft/multi-reserve-invoice` → **400 «Las FRC seleccionadas no tienen artículos pendientes
  de recepción»**: el borrador filtra `openQty <= 0` y las tres líneas de la FRC estaban en **`openQty 0`** y
  `lineStatus CLOSED`.
- **Causa raíz**: el **confirm** de la FRC (introducido en la **ronda 19** para que la reserva manual naciera con su
  asiento) cerraba **todas** las líneas (`_executeConfirmLogic`: `data: { openQty: 0 }` + `refreshLineStatus(..., 0)`),
  cuando la mercadería de una reserva está **en tránsito**: quien la cierra es la **recepción**. El flujo estaba
  **roto por pantalla** desde entonces (el alta directa por API sí funcionaba y tomaba bien el costo).
- El costo que la recepción debe capitalizar ya salía de la FRC (bruto con el descuento de cabecera, T239), así que
  ese punto no necesitaba cambio.

### Entregado

En el confirm, una línea de **FRC sin recepción previa** (`invoice.isReserve === IS_RESERVE &&
!line.purchaseReceiptItemId`) queda **pendiente de recibir** (`openQty = quantity`, estado `OPEN`); las líneas que
**sí** vienen de una recepción (ya recibidas) se cierran como hasta ahora. Es la misma distinción que ya usaba el
camino de creación, y por eso la regla es una: `purchaseReceiptItemId`.

### Medido después (A/B, sonda `_probe-r22-recepcion-parcial.ts` con una FRC nueva)

```
FRC-43 (150/50/200, 25 %): totalCost 360,99 · tránsito del asiento 360,99 · líneas openQty 1 / OPEN
Borrador: 201 · 3 líneas
Recepción parcial 1: cant 0,33/0,33/0,33 · costos 45,08/15,02/60,11 · tránsito 120,21
Recepción parcial 2: cant 0,33/0,33/0,33 · costos 45,08/15,02/60,11 · tránsito 120,21
Recepción parcial 3: cant 0,34/0,34/0,34 · costos 45,21/15,07/60,29 · tránsito 120,57
Σ tránsito de las recepciones = 360,99 = tránsito de la FRC (diferencia 0,00)
FRC al final: openQty 0 / CLOSED
```

La **última** parcial absorbe el residuo del redondeo (45,21 frente a 45,08), que es lo que hace que las tres sumen
**exactamente** el tránsito de la reserva.

### Gates

Unitarios **212 suites / 2673 tests** y **suite E2E completa 41 suites / 383 tests** en verde; `tsc`/`eslint` 0.

### Declarado

- La regla distingue los dos orígenes de una FRC: la que nace **desde una recepción** cierra sus líneas al confirmarse
  (ya están recibidas) y la que nace **en tránsito** (manual, desde cotización o desde pedido) las deja pendientes.
- Las recepciones parciales de una misma línea **no** parten el costo en tercios exactos: cada una capitaliza
  `round(cantidad × costo unitario)` y la **última** toma el resto (por eso el reparto 45,08 + 45,08 + 45,21).

## Pendiente del tramo

- **T255: CERRADO** (D1-D7 + UI). Declarado del tramo:
  - el **IT** (3 % del neto) no se revierte en la NC —el asiento de la NC es un hecho nuevo, no el espejo—; el
    espejo de la **cancelación** sí cuadra a cero.
  - `creditNoteMaxDays` sólo aplica cuando la NC **referencia** una factura (una NC manual sin factura no tiene
    contra qué medirse).
  - la fecha del diálogo de la NC se propone con el **día del tenant**; las reglas del backend (no anterior, no
    futura, plazo) la validan al confirmar.
- **Del tramo T254 ya NO queda nada abierto**: se corrige aquí lo que esta sección declaraba abierto y las rondas
  siguientes **cerraron con medición** —
  - la **edición de cotizaciones** (venta y compra): cerrada en la **ronda 14** (el `update` materializa la cabecera
    en las líneas con la regla única, publica `lineSubtotal` y los totales salen de las líneas; medido después:
    `desc` 15,00 / 5,00 / 20,00 al 10 % y 37,50 / 12,50 / 50,00 al importe 100; de paso se cerró el **404** de los
    dos `PATCH` fuera de la base de desarrollo);
  - **`addItem`/`updateItem` con cabecera por importe**: **medido en la ronda 16** y **sin defecto** —el importe
    fijo **no** se redistribuye al agregar una línea (la nueva queda sin parte) y el documento sigue coherente
    (Σ descuentos de línea = cabecera y total = Σ líneas)—, que es la decisión que T254 dejó escrita en el código;
  - el **`PATCH` que devolvía las líneas de antes de la edición**: cerrado en la **ronda 15** (la transacción se
    espera con `await` y el documento se lee **después del commit**; medido después: respuesta y base coinciden).
- **Observación medida (ronda 20), declarada**: el `PATCH /purchase-credit-notes/:id` es **inalcanzable** en la
  práctica —el servicio exige una nota **abierta** («Solo se puede editar una nota de crédito abierta») y las notas
  nacen confirmadas: en la base de desarrollo hay **6 con cabecera y 0 abiertas**, así que la edición de una NC de
  compra no es un camino vivo. No es un defecto (no hay pérdida de datos), pero se declara para no dejar el endpoint
  como si se usara; si algún día se permite editar una NC, la carga del formulario **ya repuebla** la cabecera
  (ronda 20, punto 2).
- **Ronda 20, punto 2 — CERRADO**: los «Copiar a» repueblan la cabecera. **Medido antes** (sonda
  `_probe-r20-copiar-a.ts` sobre `FCP-23`, factura de compra nacida de una recepción): el documento y su asiento
  están bien (`modo=header pct=25 · desc 23,50 · neto 62,39 + IVA 8,11 = 70,50`; `ASI-000087` → `GRIR D 85,89 ·
  IVA D 8,11 · Descuento H 23,50 · CxP H 70,50`) pero el **preliminar que pedía la pantalla** salía
  `Inventario D 83,19 · IVA D 10,81 · CxP H 70,50` → **D 94,00 contra H 70,50 (descuadrado por 23,50)** y con el IVA
  del bruto; con la cabecera cargada el preliminar es **idéntico al contabilizado**. **Entregado**: helper
  `applyHeaderDiscountFromSource` en la NC de compra (`loadNote`, y reutilizado en `preloadFromInvoice`) y en la
  factura de compra (`loadFromQuotation`, `loadFromReceipt`, `loadFromReserveInvoice`); el mapper
  `reserve-invoice-to-invoice` mapea la cabecera (factura de venta «desde F. Reserva»); y los tres campos en los
  modelos que no los declaraban. **Dos defectos de segundo orden** cerrados en la misma ronda: los drafts de
  cotización no publican `discountTotal`, así que al repoblar la cabecera `calcTotals` habría **doble-descontado**
  (`sourceLineDiscountTotal` lo reconstruye con la regla única en la FCP y en la FRC), y la **FRV desde cotización**
  publicaba `discountTotal: 0` (mismo doble descuento: ahora publica el que el mapper ya aplica, sin copiar el del
  origen). **Multi-* (decisión medida)**: no se repuebla la cabecera —el backend materializa la de **cada** origen en
  **sus** líneas y crea el documento en modo **línea**, así que no hay cabecera única—; el formulario queda en el
  modo real del documento y su preliminar queda cuadrado. **Gates**: `tsc` app/specs 0, **Karma 2350/2350**,
  `ng build` AOT 0, prettier limpio, y el backend con la **suite E2E completa 41 suites / 383 tests** en verde.

- **Ronda 21 — declarado (decisiones/observaciones medidas, no trabajo pendiente)**:
  - en un **agregado** el asiento **no atribuye** el total a una línea de documento concreta: `sourceTransactionLineId`
    queda en `null` (siempre) y `itemId`/`warehouseId`/`itemGroupId` y `sourceTransactionType`/`sourceTransactionId`
    **solo si difieren** entre las agrupadas. El **informe por norma de reparto** ve **una** fila donde antes veía N
    del mismo documento, **con el mismo total**; los tramos de una misma norma **no** se agrupan entre sí (difieren en
    `dimension`), así que los informes por centro de costo siguen cuadrando.
  - el saldo por cuenta de la **columna de moneda secundaria** (USD) puede moverse **±1 centavo**: la línea agrupada
    lleva su **propia** conversión en vez de la del grupo.
  - el **informe ICE por artículo** lee `itemId` de la pata `ICE_PAGAR`, que **hoy ningún builder puebla** (declarado
    por si algún día se puebla).
  - Si se prefiere otra política en cualquiera de los tres (p. ej. conservar el `itemId` de la primera línea o
    agrupar también con ejes distintos), se cambia con la medición delante.

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
