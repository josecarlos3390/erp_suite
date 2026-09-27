# T255 — Cancelación vs Anulación (BO): memoria de trabajo

> Estado: **ronda 1 cerrada** (cancelación con la fecha del documento original). Continúa: sello de emisión
> fiscal + plazo configurableD2, «anular con NC por el total» (D4), reglas de la NC (D5+D6+D7).
> Plan del tramo anterior (descuento de cabecera): `docs/plans/plan-descuento-cabecera-parte2.md`.

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

## Pendiente del tramo

- **D4** «anular con NC por el total, descuentos incluidos» en un clic (una línea por línea de factura con su
  descuento ya calculado) y `cancel` de un documento emitido con mensaje accionable.
- **D5** `creditNoteMaxDays` (default 180) validado contra la fecha de emisión, sólo si la NC referencia una factura.
  → **HECHO en la ronda 4** (queda el lado de **compra** y el interruptor en la pantalla).
- **D6** rechazar NC anterior a la factura o con fecha futura. → **HECHO en la ronda 4**.
- **D7** cabecera referencial en NC/devoluciones + medir la NC parcial con cabecera **por importe**.
- Frontend: quitar el campo de fecha de los diálogos de **cancelación** (dejarlo en la NC) y el interruptor del
  plazo de anulación en Configuración.

## Notas del arnés

- Base de desarrollo: `npm run db:recreate` exige parar el API; tras recrear hay que registrar la **tasa del día**
  (`POST /exchange-rates`, USD→BOB 6,96) o el guard bloquea las operaciones.
- Sondas (no se commitean): `backend-erp/scripts/_probe-t255-anulacion.ts` (cancelación + NC parcial + límites),
  `_probe-t255-espejo.ts` (par original/espejo y estados), `_probe-t255-ab.ts` (A/B de la fecha).
- El campo del espejo es `reversalJournalEntryId` **en el original** (apunta al espejo).
- Jest escribe el resumen en **stderr** y el arnés a veces reporta `exit code: 1` con la suite en verde.
