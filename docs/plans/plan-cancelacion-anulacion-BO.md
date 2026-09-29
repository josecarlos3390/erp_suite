# T255 — Cancelación vs Anulación (BO): memoria de trabajo

> Estado: **CERRADO (rondas 1-31)**. D1-D7 y la **UI** cerrados en la ronda 8 (interruptores de
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
> cabecera es exactamente Σ líneas, así que **asiento y preliminar son idénticos**; la **ronda 21** agrupa en el
> asiento la misma cuenta con los mismos ejes y lleva el centavo de la divisa a la línea de ajuste; la **ronda 22**
> abre la **recepción** de una FRC (total o parcial, sumando exactamente el tránsito); y la **ronda 23** cierra la
> **coherencia visual** de la grilla de un documento guardado (la línea muestra el descuento que **ya trae**, sin
> volver a prorratear la cabecera). La **ronda 24** cierra las observaciones de pantalla de la **recepción desde una
> FRC** (origen real, sin IVA visual, con el descuento de la reserva) **y** el defecto de dinero que destapó su
> medición —la misma FRC se podía **recibir dos veces**—, y deja **auditados con medición** los valores guardados de
> 215 documentos de compras y ventas. La **ronda 25** cierra los **tres defectos vivos de ventas** que esa auditoría
> destapó (los `sale-invoices/from-*` re-aplicaban el descuento ya materializado, la entrega desde una FRV restaba el
> IVA dos veces y el neteo de la FRV derivaba centavos): **con esto los arreglos de compras quedan replicados en
> ventas**. La **ronda 26** cierra el reporte del usuario sobre la **FRC-43**: la recepción **parcial** también conoce
> su FRC de origen, la **regresión de layout** de los totales (la nota ensanchaba la caja) queda reparada y los
> totales de **todos** los documentos se leen como una cuenta (`bruto − descuento = neto`, `neto + IVA = total`). La
> **ronda 27** cierra el rótulo de origen que sobrevivía en esa misma pantalla: el borrador de la recepción desde una
> F. Reserva de Compra (medido con la `FRC-51`) ya **no** se anuncia «Recepción manual» —lo decide el **origen**, no el
> modo de captura— y el rótulo de captura manual queda para el documento **suelto**. La **ronda 28** cierra la pregunta
> de fondo que dejó esa prueba: el flujo **se completa desde el documento donde se inició** (recepciones y F. Reserva
> parciales sucesivas en compras **y** ventas), se corrigen el payload de la reserva desde recepción y la mezcla de las
> dos direcciones del vínculo (`reserveInvoices`), y queda escrita la **matriz de flujos** con las cuatro reglas que
> sostienen la flexibilidad del ERP. Plan
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

## Ronda 23 — coherencia VISUAL de la grilla en un documento guardado (CERRADA)

### Lo que reportó el usuario (2026-09-28)

Mirando la **FRC-44** (la FRC manual con cabecera 25 % que creó tras la ronda 22):

> «los cálculos visualmente que muestran las columnas […] descuento dice 43.75 % […] el costo no sé cómo lo calcula
> […] la idea es que los valores que se muestren sean coherentes […] PERO EN GENERAL TODO ESTÁ BIEN, EL ASIENTO
> GENERA CON LOS IMPORTES CORRECTOS Y EL DOCUMENTO TAMBIÉN, solo son los detalles visuales de los cálculos».

Es un reporte **de pantalla**, no de dinero: el documento y su asiento están bien (lo confirma la propia sonda de
esta ronda). El alcance es, por tanto, **solo visualización**.

### Medición antes (sonda de navegador `e2e/zz-r23-live-medicion.spec.ts` —temporal— + sonda de backend `_probe-r23-columnas.ts`)

`FRC-44` (id **80** en la base de desarrollo) = `modo=header pct=25`, líneas **150 / 50 / 200**; documento
`neto 260,99 + IVA 39,01 = 300,00` con `descuento 100,00` y `costo 360,99`. El **backend está bien**: cada línea
guarda el descuento materializado (`pctLínea=25`, `discTotal 37,50 / 12,50 / 50,00`, **Σ 100,00 = el del documento**)
y la cabecera queda **referencial**.

**Lo que la pantalla pintaba** (Playwright contra `ng serve` con el código anterior, pestaña «💸 Descuentos»):

```
FRC-44 (guardada, cabecera 25 %)
   línea 1: DTO. %=43,75  DTO. MONTO=−  DTO. UNIT.=−37,50  PRECIO UNIT. C/DTO.=112,50  PRECIO TOTAL C/DTO.=112,50
   línea 2: DTO. %=43,75  DTO. MONTO=−  DTO. UNIT.=−12,50  PRECIO UNIT. C/DTO.= 37,50  PRECIO TOTAL C/DTO.= 37,50
   línea 3: DTO. %=43,75  DTO. MONTO=−  DTO. UNIT.=−50,00  PRECIO UNIT. C/DTO.=150,00  PRECIO TOTAL C/DTO.=150,00
   resumen «Total descuentos aplicados» = −100,00 (= el del documento)

PO-1 (pedido de compra guardado, cabecera 25 %, línea de 94)
   línea 1: DTO. %=43,75  DTO. UNIT.=−23,50  PRECIO UNIT. C/DTO.=70,50  PRECIO TOTAL C/DTO.=52,87  ← se contradicen
   resumen = −23,50 (= el del documento)
```

El defecto del usuario es el **43,75 %** (= el 25 % de la cabecera **acumulado otra vez** con el 25 % que la línea ya
traía). Las columnas de dinero que calculan los *helpers* de fila (`unitDiscountForRow`, `unitNetForRow`,
`displayDiscountForRow`) ya priorizaban la línea desde la ronda 19, pero las que salen del **pipe** no: en `PO-1` la
misma fila decía `DTO. UNIT.` **−23,50** y `PRECIO UNIT. C/DTO.` **70,50** frente a `PRECIO TOTAL C/DTO.` **52,87**
(94 − 41,13, el descuento acumulado), con el documento valiendo 70,50.

En el **espejo** (`_probe-r23-columnas.ts`, `rowDiscountDisplay(…, stored = false)`) el mismo defecto da
`discTotal 65,63 / 21,88 / 87,50` (**Σ 175,01**, que no es el descuento de ningún documento) y «total con
descuento» Σ 224,99 contra un documento de 300,00.

La misma sonda de navegador midió la pestaña «💰 Costos» de la `FRC-44` (**antes y después**, sin cambios):
`COSTO UNIT.`/`COSTO TOTAL` = **135,37 / 45,12 / 180,50** (Σ **360,99** = el tránsito que el asiento capitaliza) y
`MARGEN VS. COSTO` = 0,00: el costo que se ve es el **guardado** (neto + descuento, T239) y es derivable de la
propia grilla (`97,87 + 37,50 = 135,37`).

### Causa

La **ronda 19** quitó la guarda `isStoredDocument` del prorrateo visual (D9) para que el **borrador** también lo
mostrara —que era lo que el usuario pidió entonces—, y la ronda 20 dejó a la vista el segundo filo de aquella
decisión: en un documento **guardado** el backend **ya materializó** la cabecera en las líneas y la cabecera queda
**referencial**, así que prorratearla otra vez acumulaba **25 % + 25 % = 43,75 %** y el importe se contaba dos veces.

La distinción **no se puede inferir** del estado del formulario sin el flag: en un **borrador** una línea con
descuento propio **sí** acumula la cabecera (T254: los descuentos son acumulativos, y ahí 43,75 % es correcto),
mientras que en un documento guardado esa misma línea ya la trae.

### Entregado (solo visualización)

- **El espejo** (`shared/utils/line-discount-display.util.ts`): `rowDiscountDisplay(rows, index, header, stored =
  false)` y el guard `carriesOwnDiscount()` —`%`, importe o `discountTotal` > 0—; con `stored` manda **la línea**
  (su `%`, su importe y su `discountTotal`) y `headerShare: 0`. Sin el flag el comportamiento es **idéntico** al de
  antes (el default conserva el borrador).
- **El pipe** (`line-discount.pipe.ts`): 6.º argumento `stored` —`items | lineDiscount : index : field : discountMode
  : headerPct : headerAmt : stored`— y **las 57 llamadas de las 9 plantillas** lo pasan con `: isStoredDocument`
  (cotizaciones de venta y compra, pedidos de venta y compra, FVE, FRV, FRC, FCP y NC de compra).
- **El getter**: `isStoredDocument` en la base compartida (`!!this.documentId`); FRC, FRV y FCP lo tenían **privado**
  y pasa a **público**, y la **FVE** estrena el equivalente (`!!id && !isDraft`, porque en `/new` los formularios
  hacen `Number(idParam)` = `NaN`). En la base el valor por defecto se respalda con un campo
  `protected readonly storedDocument = false` y **no** con un `return false` literal: la regla
  `class-literal-property-style` de ESLint rechaza un `get` que devuelve un literal, y el **hook del primer
  `git commit`** no selló hasta cambiarlo (el `get` sigue siendo lo que las familias sobrescriben).
- **Los helpers de fila** (`headerDiscountShareForRow`, `unitDiscountForRow`, `unitNetForRow`,
  `displayDiscountForRow` de FRC/FRV/FCP) usan la misma regla: **no reparten** nada cuando la línea de un documento
  guardado trae su descuento.
- **Nada de backend, ningún payload de escritura y ninguna regla de dinero**: el asiento y el documento ya estaban
  bien.

### Medido después (A/B, la misma sonda y los mismos documentos)

```
FRC-44: DTO. %=25,00  DTO. MONTO=−  DTO. UNIT.=−37,50 / −12,50 / −50,00
        PRECIO UNIT. C/DTO. = PRECIO TOTAL C/DTO. = 112,50 / 37,50 / 150,00   (Σ 300,00 = el total del documento)
        resumen = −100,00
PO-1:   DTO. %=25,00  DTO. UNIT.=−23,50  PRECIO UNIT. C/DTO.=70,50  PRECIO TOTAL C/DTO.=70,50  (era 52,87)
        resumen = −23,50
```

En el espejo, con `stored` la Σ de `discTotal` es **100,00** (era 175,01) y la Σ de «total con descuento»
**300,00** = el total del documento (era 224,99).

El «precio con descuento» unitario coincide ahora con el **`lineTotal` contabilizado** de cada línea
(`97,87 + 14,63 = 112,50`) y el **costo** que muestra la grilla es el **guardado** (`135,37 / 45,12 / 180,50` = neto
+ descuento, T239): en un documento guardado los *watchers* de la cabecera están desactivados y la línea no se
recalcula al cargar, así que lo que se pinta **es** lo que se contabilizó.

### Gates

`tsc` de app y specs **0**; `ng build` AOT **0** (es el gate que compila las plantillas y certifica el argumento
nuevo del pipe); **Karma 2361/2361** (11 casos nuevos: 6 del util/pipe, 4 de la FRC y 1 de la FCP); prettier
(ratchet de archivos tocados) limpio. Ningún caso existente hubo que reescribirlo: el default `stored = false`
conserva el comportamiento. **Los dos casos nuevos que el primer Karma tumbó se corrigieron con la medición
delante** (no el código): el fixture ponía `discountPct` **y** `discountAmt` en la misma línea, cuando el backend
escribe **uno solo** según la cabecera sea porcentual o por importe (medido: `pctLínea=25 amtLínea=-`), y la Σ del
borrador se esperaba en 175,00 cuando el prorrateo al centavo de cada línea da **175,01**.

### Declarado

- La celda de **importe** con cabecera **porcentual** sigue devolviendo **vacío** (convención D9, igual que el
  borrador y confirmado en la pantalla: `DTO. MONTO` = «−»); el importe lo muestra la celda de descuento unitario.
- El `cost` de **ventas** (FVE/FRV) es el del **kardex**, no T239; el de **cotizaciones y pedidos de compra** es el
  simulado `priceNet` de esas familias: **no** son derivables del precio y no deben serlo.
- Los **borradores de «Copiar a» acumulan** (43,75 %): es la regla de borrador de T254, no un documento guardado.
- La **FRV** y los documentos **viejos con costeo neto** (línea sin `%` y `discTotal 0`) siguen prorrateando,
  porque la línea no trae descuento que mostrar.
- La sonda de navegador es **temporal** (no se commitea): la regresión queda pinzada en Karma, que ejercita el
  mismo util y el mismo pipe que consumen las plantillas.

## Ronda 24 — la recepción desde una FRC: origen, IVA, descuento y la doble recepción (CERRADA)

### Lo que reportó el usuario (2026-09-28)

Cuatro observaciones de pantalla más dos preguntas:

> «cuando genero la recepción desde la factura de reserva de compra, la recepción muestra como "Recepción Manual" ¿por qué
> muestra eso, si la recepción viene desde el flujo de la factura de reserva de compra?; también veo que en recepción, en los
> totales muestra IVA, en este caso no debería mostrar ese valor de IVA (está bien que lo maneje internamente, pero no hace
> falta que se visualice); y en la pestaña de costos de la recepción tampoco jala u obtiene los descuentos que tiene la
> factura reserva: el campo dto. total está vacío, asumo que debería mostrar el descuento que tenía […] creo que no estás
> validando o verificando el contenido de los documentos de compras y ventas y si los valores guardados tienen relación o
> si tienen sentido. Estas correcciones que hicimos en compras ¿también se replican en ventas, verdad?»

Y la pregunta aparte: «¿por qué no veo el cálculo del margen o no existe en este caso?».

### Medición antes (sonda de navegador + `_probe-r24-recepcion.ts`, `_probe-r24-doble-recepcion.ts`)

Flujo real de la pantalla: «Copiar a → Recepción de Mercadería → Solo esta F. Reserva» = `POST /purchase-receipts/manual`
con `purchaseReserveInvoiceId`. Medido sobre `FRC-44` (`modo=header pct=25`, líneas 150/50/200, `neto 260,99 + IVA 39,01 =
300,00`, `descuento 100,00`, `totalCost 360,99`):

```
FORMULARIO (borrador)   título «Nueva Recepción desde F. Reserva» ✔
                        líneas: PRECIO BRUTO 150/50/200 · DESCUENTO «—» · PRECIO NETO UNIT. 135,37/45,12/180,50
                        descuentos: DTO. % «—»  DTO. TOTAL «—»  PRECIO TOTAL C/DTO. 150/50/200
                        costos: DTO. TOTAL «—»  COSTO UNIT. 135,37/45,12/180,50  MARGEN «—»
DIÁLOGO                 «¿Crear recepción manual? Se registrará la recepción sin relación a una orden de compra»
RECEPCIÓN CREADA        cabecera subtotal 360,99 + IVA 52,00 = total 412,99 · descuento 0,00
(REC-22)                líneas: subtotal 135,37/45,12/180,50 · IVA 19,50/6,50/26,00 · dtoTotal 0,00
                        totales: «IVA 52,00» visible
```

**Cuatro lecturas de la misma medición**:

1. **«Manual»** es el **diálogo** (y la columna MARGEN en «—»): `isManualMode` es el modo de **captura** de ese camino
   (cantidades libres, sin pedido detrás) y se usaba también como **origen**.
2. **El IVA** que se veía era **13 % del precio de LISTA** (`19,50` sobre 150) mientras la base de la línea era el costo
   (`135,37`): ni la lista (400), ni el cobrado (300) ni el costo (360,99) explican el `412,99` del documento. La FRC que
   lo origina declara **39,01**.
3. **El descuento** de la FRC (100,00) **no viajaba**: `totalDiscount 0,00` y `Dto. Total` vacío en las tres pestañas.
4. **Y el hallazgo grave (dinero, no pantalla)**: ese camino **no consumía la reserva** (`openQty` intacto,
   `purchaseReceiptId` nulo, ninguna línea cerrada) ⇒ **la misma FRC se podía recibir dos veces**. Medido: `REC-22` y
   `REC-23` sobre la misma `FRC-44`, **cada una capitalizando 360,99** (el tránsito `1.1.3.02.001` se acreditaba dos
   veces y el inventario se capitalizaba dos veces). El camino **multi** sí consumía la reserva, pero dejaba la cabecera
   **vacía por dentro** (`subtotal/IVA/total = 0`, solo el costo: `REC-18`…`REC-21`, con asiento).

**MARGEN (la pregunta)**: existe y se calcula —`precio de venta del catálogo del artículo` neteado por su indicador
fiscal contra el `costo` de la línea—, pero (a) en la recepción **se apagaba** por `isManualMode`, y (b) los artículos de
estos documentos tienen `salePrice` nulo y `price` 45/18/55 con costos de compra de 135,37/45,12/180,50 (datos de
sonda): el margen sale **negativo**. Medido en la FRC-44: `−4,87 / −1,62 / −6,50` (`−3,6 %`) y `Margen bruto −12,99 Bs`
en el bloque de totales.

### Auditoría pedida por el usuario (¿los valores guardados tienen relación y sentido?)

Sonda de solo lectura sobre **215 documentos / 385 líneas** (16 familias, compras y ventas) con 13 invariantes por
familia (Σ líneas = cabecera, `neto + IVA = total`, Σ descuentos, Σ costos, línea a línea, materialización del descuento,
documentos «vacíos por dentro», IVA por indicador). Resultado:

- **Familias limpias**: `saleInvoice` directa (21/21 en todos los invariantes), FRV (`saleInvoice isReserve=Y`, 4/4),
  `purchaseOrder` (29/29 salvo la semántica del importe cobrado), `purchaseCreditNote` y `purchaseReturn`.
- **Lo que NO es defecto** (convenciones ya documentadas, medidas): `taxAmount = importe cobrado × tasa` con el neto como
  residuo en los documentos con **IVA por dentro** (`BOLIVIA_SIN`: 66/66 líneas; el perfil `STANDARD` da `base × tasa` en
  178/178); la cotización no publica `lineTotal` y el pedido no publica `lineSubtotal` (su `subtotal` de línea es el
  **cobrado**, de ahí que Σ líneas ≠ cabecera neta); la cabecera del descuento queda **referencial** con el descuento
  materializado en la línea.
- **Incoherencias medidas → todas HISTÓRICAS** (documentos creados antes del arreglo de su ronda, con su `createdAt`
  verificado): `REC-1`/`REC-5..9`/`REC-16` (vacíos por dentro o cabecera = bruto, 09-27), `FRC-1..8`/`FRC-27`/`FRC-28`
  (confirmadas **sin asiento**, 09-27, antes de la ronda 19), `FRC-11`/`FRC-13`/`FCP-12`/`FCP-13`/`FCP-16` (cabecera
  re-descontada, 09-27, antes de las rondas 12-13), `FRC-31`/`FRC-32..34`/`FCP-27`/`FCP-28` (centavos, antes de la ronda
  20 — `FRC-35`/`FCP-29` ya cuadran), `PCOT-26..28`/`COT-1` (descuento de cabecera sin materializar, antes de T254),
  `PED-1..3` (09-27; **no se reproducen**: un pedido nuevo publica las tres líneas con su IVA, Σ `taxAmount` = cabecera y
  el reparto por valor), `REC-18..21` (09-28 11:21, camino multi que **hoy publica todo**: `REC-25`), `REC-22/23` (las
  sondas de esta ronda, ya **canceladas**) y `FRC-41` (09-28 11:15: `discountPct 43,50` con `discountTotal 37,00` y
  `lineTotal 84,75` = descuento de **línea** por importe 37,00 acumulado con la cabecera 25 %; **no reproducible**: hoy la
  misma alta guarda la parte de cabecera —`FRC-46`: `discountTotal 65,25`, `cost 138,98`, tránsito `364,60`—, así que es
  un artefacto de un estado de código anterior).
- **Defectos VIVOS que la auditoría destapó, todos en VENTAS** (ver «Pendiente del tramo»): los caminos
  `sale-invoices/from-*` re-aplican el descuento de cabecera que el origen ya materializó y
  `delivery-orders/from-reserve-invoice` resta el IVA dos veces del neto.

### Entregado (backend — el dinero)

- **Un helper único `frcReceiptLineAmounts`** (`purchase-receipts.service.ts`): replica los montos de la línea de la FRC
  **prorrateados** por la cantidad recibida con el canon de dinero (`prorateInvoiceLineAmounts`: el bruto se prorratea una
  sola vez, el IVA aparte y el neto por diferencia ⇒ `neto + IVA === lineTotal`), y devuelve el **costo bruto de la FRC**
  (T239) con su `totalCost`.
- **Los dos caminos** (la pantalla `createManual` con `purchaseReserveInvoiceId` y el multi `from-multi-reserve-invoice`)
  publican `subtotal`/`lineSubtotal`/`lineTotal`/`taxAmount`/`discountPct`/`discountAmt`/`discountTotal`/`priceNet`; el
  `cost`/`totalCost` siguen siendo el bruto de la FRC (lo que el asiento netea del tránsito).
- **La reserva se consume** en el camino de la pantalla: se **valida la cantidad contra el `openQty`** (400 si se excede),
  se descuenta el pendiente, se escribe `purchaseReceiptItemId` en la línea de la FRC, se cierra esa línea y se deja
  `purchaseReceiptId` en la reserva (antes solo lo hacía el camino multi, y sin los dos vínculos).
- Caso E2E nuevo (`purchase-flow`): «la recepción desde una FRC replica sus importes, consume la reserva y rechaza la
  segunda recepción».

### Entregado (frontend — la pantalla)

- **Origen explícito**: `esRecepcionDeFrc` (`purchaseReserveInvoiceId` del borrador · la FRC vinculada que el API ya
  devuelve en `purchaseInvoices` · el `baseDocType = PURCHASE_RESERVE_INVOICE` de las líneas para los documentos
  guardados antes de que la FRC recordara su recepción) + `reserveInvoiceCode`. `isManualMode` se queda como **modo de
  captura** (es lo que permite editar cantidades) y deja de usarse como origen.
- **El diálogo** dice «¿Crear recepción desde la F. Reserva FRC-44?» con el mensaje del tránsito y el costo capitalizado;
  el alta manual de verdad conserva el suyo.
- **La columna MARGEN** ya no se apaga en una recepción de FRC (se calcula igual que en la FRC).
- **El bloque de totales oculta el renglón de IVA** cuando la recepción viene de una FRC (`[showTax]="!esRecepcionDeFrc"`)
  y añade el aviso con el código de la reserva: «El IVA de esta operación está contabilizado en la F. Reserva de Compra
  FRC-44. El costo capitalizado es el que la FRC debitó a Mercaderías en Tránsito».
- **El borrador** publica los importes de la FRC (descuento, neto, IVA y total de línea) manteniendo el costo de la
  reserva, así que el descuento se ve **antes** de guardar.
- Modelos: `purchaseInvoices` en `PurchaseReceipt` y `lineSubtotal`/`lineTotal` en las líneas de la FRC (declarados a
  mano; el schema del backend ya los tenía).

### Medido después (A/B, las mismas sondas y los mismos payloads)

```
REC-24 (camino de la pantalla)   subtotal 260,99 + IVA 39,01 = total 300,00 · descuento 100,00 · totalCost 360,99
   líneas: neto 97,87/32,62/130,50 · IVA 14,63/4,88/19,50 · Dto. Total 37,50/12,50/50,00 · costo 135,37/45,12/180,50
   asiento: Inventario D 360,99 / Tránsito H 360,99   (Σ D = Σ H)
FRC-44 después: openQty 0 · CLOSED · purchaseReceiptItemId 40/41/42 · purchaseReceiptId 24
2.ª recepción de la misma FRC → 400 «Cantidad excede lo pendiente por recibir … Pendiente: 0»
REC-25 (camino multi, medido en paralelo) → mismos importes (260,99 / 39,01 / 300,00, desc 100,00, tránsito 360,99)
PANTALLA (después): totales «Costo total 360,99 · Descuento −100,00 · Subtotal 260,99 · Total 300,00» SIN el renglón de
   IVA y con el aviso de la FRC; costos «Dto. Total −37,50 / −12,50 / −50,00», «Costo unit. 135,37 / 45,12 / 180,50»
```

### Gates

Unitarios **212 suites / 2673 tests**, E2E completo **41 suites / 384 tests** (con el caso `R24` nuevo en
`purchase-flow`), `tsc`/`eslint` 0 en el backend; en el frontend `tsc` de app y specs **0**, `ng build` AOT **0**,
**Karma** con 6 casos nuevos y prettier (ratchet) limpio.

### Declarado

- La **entrega desde una FRV** (`delivery-orders/from-reserve-invoice`) y los caminos **`sale-invoices/from-*`** tienen
  defectos **vivos** medidos en esta ronda (ventas): son la **ronda siguiente** y están en «Pendiente del tramo» con sus
  números.
- Los documentos guardados **antes** de esta ronda no traen la FRC en la relación `purchaseInvoices`: la pantalla los
  reconoce por el `baseDocType` de sus líneas (el **código** de la FRC no se puede mostrar en ese caso).
- Las incoherencias **históricas** de la auditoría (lista con fechas arriba) **no se reparan**: son documentos de prueba
  creados por un estado anterior del código y su reparación sería una migración de datos, no un arreglo de código.

## Ronda 25 — los arreglos de compras, replicados en VENTAS (CERRADA)

### Lo que preguntó el usuario (2026-09-28)

> «Estas correcciones que hicimos en compras ¿también se replican en ventas, verdad?»

**La respuesta medida era NO**: la auditoría de la ronda 24 dejó tres defectos **vivos** de ventas y esta ronda los cierra.

### Medición antes (sondas `_probe-r24-medicion-b.ts` y `-b-bis.ts`, canasta 150/50/200 con cabecera 25 %, origen `300,00`)

```
(1) POST /sale-invoices/from-order|from-quotation|from-delivery  (+ isReserve N/Y)
    destino 225,00  vs  origen 300,00   (Δ −75,00) · totalDiscount 75,00 ≠ Σ líneas 100,00
    asiento: CxC 225,00 · Ventas 295,75 · Descuentos 87,01     [FVE-22/23/24, FRV-6/8/10]
    COMPRAS ya tenía la guarda `_sourceMaterializedHeader`; VENTAS no.
(2) POST /delivery-orders/from-reserve-invoice/:id   (FRV-7 300,02 → DEL-3)
    entrega 261,01 (su subtotal) con líneas lineSubtotal 83,25/27,75/111,00
    el neto de la FRV se tomaba como «importe cobrado» y se le restaba el IVA otra vez.
(3) neteo de la FRV: round(130,50 × 0,75) = 97,88 y round(19,50 × 0,75) = 14,63
    ⇒ neto + IVA = 112,51 donde el cobrado es 112,50  ⇒  FRV = 261,01 / 99,98 / 300,02
    (la misma canasta vale 260,99 / 100,00 / 300,00 en cotización, pedido, entrega y factura)
```

### Causa

- (1) y (3): los caminos de venta aplicaban el descuento de cabecera como un **ratio** sobre montos que el origen **ya había neteado** (T254 materializa la cabecera en las líneas). En compras eso se cerró en D10-b con la guarda `_sourceMaterializedHeader`; en ventas no existía y el ratio se aplicaba **dos veces** (y en el neteo de la FRV, **por columnas**: neto e IVA por separado, en vez del canon «cobrado redondeado una vez, IVA aparte, neto por diferencia» de la ronda 20).
- (2): la entrega desde una FRV usaba `prorateLineAmounts`, documentado para documentos cuyo `subtotal` es el **importe cobrado** (cotizaciones y pedidos), sobre una **factura** —donde `subtotal` es la **base neta**—: la traducción la hace `prorateInvoiceLineAmounts`, que ya existía y no se usaba ahí.

### Entregado (backend, sin cambios de frontend)

- `SaleInvoicesService._sourceMaterializedHeader` (misma guarda que compras) en `createFromQuotation`, `createFromOrder` y `createFromDelivery`: con el origen materializado, `docTotals` sale **de las líneas** (cabecera referencial) y el ratio es **1**.
- `delivery-orders`: `createFromReserveInvoice` usa `prorateInvoiceLineAmounts`; `createFromMultiReserveInvoice` publica además `subtotal`/`lineSubtotal`/`lineTotal`/`taxAmount`/`discountTotal` (antes los dejaba vacíos).
- `sale-reserve-invoices.applyHeaderDiscountNetting`: **canon del dinero** (el importe cobrado se prorratea y redondea una sola vez; el IVA es su cifra; el neto es el residuo; el descuento es la caída exacta del bruto). Aplica a **todas** las altas de FRV (el helper es compartido).
- Caso E2E nuevo en `discount-propagation`: la cadena cotización → FVE desde cotización, cotización → pedido → entrega → FVE desde entrega, la FRV manual y la entrega desde la FRV, con el **dinero del destino contra el del origen** y el canon de la FRV.

### Medido después (A/B, mismas sondas)

```
A FVE desde pedido      300,00  Δ 0,00     E FRV desde entrega (dedicado) 300,00  Δ 0,00
B FRV desde pedido      300,00  Δ 0,00     F FRV desde entrega (alias)    300,00  Δ 0,00
C FVE desde cotización  300,00  Δ 0,00     G control modo LÍNEA           400,00  Δ 0,00
D FVE desde entrega     300,00  Δ 0,00
  (antes: A-D y F = 225,00 con Δ −75,00)
DEL-9/DEL-14/DEL-15 (entrega desde la FRV): 260,99 + 39,01 = 300,00 · desc 100,00 · 3/3 líneas cuadran
  (antes: DEL-3 = subtotal 222,00 + IVA 39,01 = total 261,01)
FRV-13 (antes) 261,01 / 39,01 / 300,02 / 99,98   →   FRV-18/19 (después) 260,99 / 39,01 / 300,00 / 100,00
```

### Gates

Unitarios **212 suites / 2673 tests**, E2E completo **41 suites** (con el caso `R25` nuevo), `tsc` (app y e2e) y `eslint` 0.

### Declarado

- El `subtotal` de **línea** mantiene sus **dos significados** por familia (importe **cobrado** en cotizaciones y pedidos; **base neta** en facturas, NC y devoluciones) —es el P10 de la auditoría de la ronda 24—: por eso el caso E2E pincha el **dinero del destino contra el del origen** y no `Σ líneas == cabecera` en todas las familias.
- La **respuesta del alta** `POST /delivery-orders/from-reserve-invoice` no publica `totalDiscount` (el `GET` y la base **sí**: medido `DEL-15` → `100,00` en ambos); el caso E2E lee el documento **persistido**. Queda como observación menor de contrato de API.
- El canon del neteo cambia los centavos de la FRV en los casos de medio centavo (es el arreglo): los importes de la FRV ahora coinciden con los del resto de familias.

## Ronda 26 — el origen de la recepción PARCIAL, la regresión de los totales y totales más explicativos (CERRADA)

### Lo que reportó el usuario (2026-09-28, probando con la FRC-43)

> «acabo de crear la factura de reserva FRC-43, y cuando genero la recepción me muestra "Recepción Manual" ¿por qué muestra eso,
> si no es manual, esa recepción viene de un flujo, o sea se está generando desde la FRC?; la visualización de los totales se
> modificó: ahora usa todo el ancho y en los documentos la visualización es más ajustada, en todos los documentos; además los
> totales que muestra la recepción no se entienden, porque dice Descuento −100, subtotal (sin IVA) 260.99 y Total 300, ¿puede ser
> más explicativo? ¿qué sugieres, qué propones?»

### Medición antes (sonda de navegador `zz-r26-totales-origen.spec.ts` + `_probe-r26-frc43.ts`)

```
(1) ORIGEN
    REC-19/20/21 (recepciones de la FRC-43, camino «varias FRC» de la r22):
      líneas con baseDocType = PURCHASE_INVOICE · baseDocId = 79 (FRC-43)
      FRC-43.purchaseReceiptId = null  ⇒  hasLinkedReserveInvoice = false
      pantalla: origen no reconocido (margen «—», caja sin el origen)
    (el DIÁLOGO de una recepción NUEVA ya decía «¿Crear recepción desde la F. Reserva FRC-43?»: eso lo cerró la r24)
(2) LAYOUT — la regresión de la r24
    la nota dentro de `.totals-box` (flex column) ensanchaba la caja:
      recepción: caja de totales 260 px → 920 px (todo el ancho) y las cajas apiladas en DOS filas
      otros documentos: 260 px lado a lado (correcto)
(3) TOTALES ILEGIBLES
    recepción (borrador): «Descuento −100,00 · Subtotal (sin IVA) 260,99 · Total 300,00»
      el subtotal YA es el neto (las filas no suman) y el renglón de IVA estaba OCULTO (r24) ⇒ el salto de 39,01 era invisible
```

### Entregado

**(backend)** `findOneInternal` resuelve las FRC **desde las líneas** (`baseDocId` de las líneas con `baseDocType` de factura
de compra → facturas con `isReserve = 'Y'`) y devuelve `reserveInvoices` + `isFromReserveInvoice`: toda recepción de una
reserva publica su origen y su código, incluidas las **parciales** y las del camino **multi** (sin tocar el `baseDocType` de
la línea, que el builder del asiento usa para Tránsito vs GRIR).

**(frontend)** el formulario usa esos campos (origen, código de la FRC, margen y etiquetas); la nota salió de la caja a un slot
propio de la sección (`[totalsSectionNote]` + `.totals-section-note` con `flex-basis: 100%`); y el bloque de totales
**compartido por todos los documentos** pinta ahora **`Precio de lista (sin IVA)`** (`neto + descuento`) antes del descuento y
titula el neto **`Neto (sin IVA)`** cuando hay descuento ⇒ `bruto − descuento = neto`; en la recepción el IVA **vuelve a
mostrarse** etiquetado `IVA de la F. Reserva (ya contabilizado)` y el total como `Total de la F. Reserva`.

### Medido después (misma sonda)

```
recepción (borrador): Precio de lista (sin IVA) 360,99 · Descuento −100,00 · Neto (sin IVA) 260,99 ·
                      IVA de la F. Reserva (ya contabilizado) 39,01 · Total de la F. Reserva 300,00
                      + nota al pie de la sección (fueraDeLaCaja = true)
layout: cajas 260 px + 360 px en la MISMA fila (antes 920 px apiladas)
REC-19/20/21: reconocidas como de la FRC-43 (Total de la F. Reserva + aviso + margen calculado)
FRC/FVE/PO:   Precio de lista 360,99 · Descuento −100,00 · Neto 260,99 · IVA (13 %) 39,01 · Total (con IVA) 300,00
```

### Gates

`tsc` de app y specs **0**, **Karma** (2 casos nuevos: el bruto+neto de la caja y la nota proyectada **fuera** de la caja),
`ng build` AOT **0**, prettier limpio; backend unitarios **212 suites / 2673 tests** y E2E completo **41 suites**.

### Declarado

- **La redacción es una propuesta**: `grossLabel`, `netSubtotalLabel`, `taxLabel` y `totalLabel` son *inputs* del componente
  compartido; cambiar el texto (o volver a ocultar el IVA en la recepción) es una línea.
- Los importes de **referencia** de las recepciones parciales suman **±0,01** frente a su FRC (cada parcial prorratea por su
  cuenta); el **costo capitalizado** (lo que contabiliza el asiento) suma exacto.
- Las recepciones anteriores a la r24 de la base de desarrollo se **repararon** (sonda
  `_probe-r26-reparar-recepciones.ts --aplicar`): es una **migración de datos de prueba**, no un cambio de código, y no toca
  `cost`/`totalCost`.
- El renglón de IVA **vuelve** a mostrarse en la recepción (la r24 lo ocultaba): con las filas sumando y la etiqueta «ya
  contabilizado» el usuario entiende el 300,00; si prefiere ocultarlo otra vez, se cambia `[showTax]` en una línea.

## Ronda 27 — el rótulo de origen de la recepción (CERRADA, solo frontend)

### Lo que reportó el usuario (2026-09-28, probando con la FRC-51)

> «cuando creo la recepción desde la factura de reserva FRC-51 en la recepción me muestra "Recepción vinculada a Factura
> de Reserva. Ajusta las cantidades según lo realmente recibido." Pero aparece otro label arriba de Proveedor que dice
> "Recepción Manual" ¿por qué sigue apareciendo? eso debería aparecer cuando genero un documento suelto, pero esta
> recepción no está suelta, proviene de la factura de reserva.»

### Medición antes (sonda de navegador `e2e/zz-r27-rotulos-origen.spec.ts`)

```
A — «Copiar a → Recepción de Mercadería → Solo esta F. Reserva» desde la FRC-51 (id 88, CLOSED, cabecera 25 %,
    tres líneas en OPEN con openQty 1 · sin ninguna recepción todavía)
    URL: http://localhost:4200/purchase-receipts/new?reserveInvoiceId=88
    TÍTULO (h1): "Nueva Recepción desde F. Reserva"
    manual-badge: ["Recepción manual"]          ← EL DEFECTO (arriba de Proveedor)
    avisos: ["Recepción vinculada a Factura de Reserva. Ajusta las cantidades según lo realmente recibido."]
    veces «manual» en el formulario: 1
B — recepción nueva sin documento origen (control por URL pelada /purchase-receipts/new)
    TÍTULO: "" · manual-badge: [] · avisos: [] · veces «manual»: 0   ← la pantalla quedaba muda
C — recepción guardada REC-24 (origen FRC-44)
    TÍTULO: "Recepción" · manual-badge: [] · veces «manual»: 0
```

Causa: el rótulo (y el banner) colgaban de `isManualMode && !receiptId`, y la recepción desde una FRC **sí** es una
captura libre (`loadFromReserveInvoice` pone `isManualMode = true` a propósito: cantidades editables, sin pedido
detrás) —es la misma confusión que la r24 arregló en el **diálogo** y que la r26 arregló en las **recepciones
guardadas**—. `isManualMode` dice **cómo se captura**, no **de dónde viene** el documento.

### Entregado (frontend; backend sin cambios)

- `esRecepcionIndependiente` (`isManualMode && !receiptId && sin orden, sin cotización y sin FRC`) es ahora la **única**
  condición del rótulo «Recepción manual» y del banner de captura manual.
- `tituloBorrador` reúne en **un solo sitio** el título del borrador (antes cuatro bloques `@if` en la plantilla) con la
  precedencia F. Reserva › orden › cotización › manual, y el de la FRC **nombra el código** (`Nueva Recepción desde F.
  Reserva FRC-51`) —también en el camino «varias FRC», que antes no ponía título—.
- La ruta `.../new` **sin parámetros** cae en la captura manual (es el destino del botón «Nueva recepción» del listado):
  antes la pantalla quedaba sin título, sin rótulo y **sin botón de guardar**.

### Medido después (misma sonda, mismos documentos)

```
A (FRC-51): TÍTULO "Nueva Recepción desde F. Reserva FRC-51" · manual-badge [] · veces «manual» 0
            + aviso «vinculada a Factura de Reserva» y la caja «Valor de referencia (documento origen)» intacta
B (/new):   TÍTULO "Nueva Recepción Manual" · manual-badge ["Recepción manual"] · aviso de captura manual
C (REC-24): TÍTULO "Recepción" · manual-badge [] · veces «manual» 0
```

### Gates

`tsc` app/spec/e2e **0**, **Karma 2374/2374** (5 casos nuevos en `purchase-receipts-form.component.spec.ts`: FRC simple,
varias FRC, `?manual=1`, URL pelada y recepción guardada), **`ng build` AOT 0** y prettier (ratchet) limpio. El backend
**no se toca** en esta ronda (los rótulos son de pantalla) y sus sondas no cambian.

### Declarado

- El **modo de captura** de una recepción de FRC sigue siendo libre (cantidades editables y «Agregar línea» siguen
  disponibles): es lo que pide el aviso «ajusta las cantidades según lo realmente recibido». Una línea añadida a mano en
  una recepción de FRC **no** tiene origen (el backend la trata como independiente, sin prorrateo de la reserva): es el
  comportamiento que ya tenía y queda declarado, no cambiado.
- La sonda de navegador es **temporal** (no se commitea): la regresión queda pinzada en Karma sobre el estado que la
  plantilla consume (`esRecepcionIndependiente`, `esRecepcionDeFrc`, `tituloBorrador`), que es el nivel que el arnés de
  Karma puede comprobar (reemplaza la plantilla por `<div></div>`); el contrato de DOM lo mide la sonda en el navegador.

## Ronda 28 — el flujo se completa desde el documento donde se inició (CERRADA)

### Lo que reportó y preguntó el usuario (2026-09-28, con la FRC-51)

> «tengo la factura de reserva de compra FRC-51 y generé una recepción parcial REC-26, pero no puedo generar más entregas
> parciales; se supone que deberían generar todas las entregas parciales hasta cubrir toda la factura reserva, ¿es un bug?
> ¿o no tenemos este control? ¿nos ocurre en otros documentos? Debería también poder hacer una Recepción manual y luego
> generar facturas de reserva parciales hasta cubrir toda la recepción, ese funcionamiento en ventas como compras debe
> funcionar. […] un flujo puede iniciar desde cualquier documento, puede empezar desde una cotización, desde un pedido,
> desde una entrega o recepción, o desde una factura reserva o normal, y debe tener la capacidad de siempre completar el
> flujo desde el documento que se inicie […] ¿es posible manejarlo así? ¿qué sugieres? ¿qué propones? creo que es la
> particularidad de este ERP, la flexibilidad en los flujos, ¿es correcto que sea así? ¿o debe ser más estricto?»

### Medición (sondas `_probe-r28-parciales.ts`, `-b.ts`, `-fixtures.ts`, `-frc51-parcial.ts` + navegador `zz-r28-parciales.spec.ts`)

**El motor ya soporta los cuatro caminos** (documentos nuevos, cantidades 10 con parcial de 4):

```
A) FRC-52 (2×10) → REC-27 (4) + REC-28 (6+10): Σ costo capitalizado = 1.305,00 = tránsito EXACTO de la FRC · 3.ª → 400 «Pendiente: 0»
B) REC-30 (2×10) → FRC-53 (4) + FRC-54 (6+10): Σ totales = 1.500,00 = total de la recepción      · 3.ª → 400 «Pendiente: 0»
C) FRV-20 (2×10) → DEL-16 (4) + DEL-17 (6+10)                                                    · 3.ª → 400 «Pendiente: 0»
D) DEL-18 (2×10) → FRV-21 (4) + FRV-22 (6+10)                                                    · 3.ª → 400 «Pendiente: 0»
```

**Lo que fallaba era la PUERTA de la pantalla** (medido en el navegador):

```
FRC-51  (2 de 3 líneas pendientes, REC-26 parcial emitida)  «Copiar a → Recepción de Mercadería»  🔒 BLOQUEADA
REC-31  (FRC-55 parcial de 4 emitida, 16 pendientes)        menú «Copiar a»  ✗ NO APARECÍA
DEL-19  (FRV-23 parcial de 4 emitida, 16 pendientes)        «Fact. Reserva Cliente»  🔒 «ya está cubierta por una F. Reserva»
FRV-24  (entrega parcial emitida, 16 pendientes)            «Entrega»  ✅ (control: ventas ya lo hacía bien)
borrador desde la FRC-51                                    cargaba TODAS las líneas con la cantidad ORIGINAL
```

**Y dos defectos de fondo**, uno de contrato y otro de semántica:

```
· PurchaseReserveInvoicesService.createFromReceipt mandaba `receiptItemId` (campo del endpoint de FACTURAS)
  y el DTO de la reserva (`PrvFromReceiptItemDto`) exige `purchaseReceiptItemId`
  → «Fact. Reserva Compra» desde una recepción respondía 400 SIEMPRE (medido con el payload de la pantalla)
· GET /purchase-receipts/:id sumaba a `reserveInvoices` las facturas GENERADAS DESDE la recepción
  (`purchaseInvoices`, la dirección contraria) ⇒ REC-31 (que emitió su propia FRC-55) decía
  `isFromReserveInvoice: true` y la pantalla la leía como «venida de una reserva»   [corrección de la r26]
```

### Entregado

- **F. Reserva (compras)**: `canCopyTo` ya no exige `isManualMode` (el modo de captura no dice el origen) y
  `canCopyToReceipt` vive mientras quede alguna línea sin cerrar —misma regla que la entrega desde una FRV en ventas—.
- **Recepción (compras)**: `canCopyTo` se gatea por **origen** (`!esRecepcionDeFrc`, que se resuelve por las LÍNEAS desde la
  r26) y no por `hasLinkedReserveInvoice` (que significa «tiene reservas ligadas», la dirección contraria).
- **Entrega (ventas)**: `canCopyToReserveInvoice` usa solo el **pendiente**; la entrega que **nace** de una FRV ya marca sus
  líneas facturadas al 100 %, así que se bloquea sola con el motivo correcto.
- **Borrador de la recepción desde una FRC**: propone el **pendiente** de cada línea (`openQty`, declarado en el modelo) y
  **omite** las ya recibidas.
- **Payload**: la reserva desde recepción manda `purchaseReceiptItemId`.
- **Semántica del origen**: `reserveInvoices`/`isFromReserveInvoice` (backend) y `esRecepcionDeFrc` (frontend) dejan de
  mezclar las dos direcciones del vínculo de cabecera.

### Medido después (misma sonda, mismos documentos)

```
FRC-51 → «Recepción de Mercadería» ✅ · borrador con 2 filas (los 2 pendientes; la línea ya recibida no se ofrece)
REC-31 → menú visible: Factura de Compra ✅ · Precio de Entrega ✅ · Fact. Reserva Compra ✅ · Devolución ✅
DEL-19 → «Fact. Reserva Cliente» ✅        FRV-24 → «Entrega» ✅ (control)
API: REC-31 isFromReserveInvoice=false · REC-24/26 true con FRC-44/FRC-51 · REC-30 false
```

### La matriz de flujos medida (endpoints declarados, `@Post` de los controladores)

| Documento DESTINO | Orígenes que puede tomar hoy |
|---|---|
| **Entrega** (ventas) | manual · cotización · pedido · **F. Reserva Venta** · multi-cotización · multi-pedido · multi-FRV |
| **F. Reserva Venta** (FRV) | manual · cotización · pedido · **entrega** · multi-* |
| **Factura de Venta** (FVE) | manual · cotización · pedido · entrega · FRV · multi-* |
| **Devolución venta** / **NC venta** | entrega / factura |
| **Recepción** (compras) | manual · pedido · **cotización** (manual + `purchaseQuotationId` + línea) · **F. Reserva Compra** · multi-pedido · multi-cotización · multi-FRC |
| **F. Reserva Compra** (FRC) | manual · cotización · pedido · **recepción** |
| **Factura de Compra** (FCP) | manual · cotización · pedido · recepción · FRC · multi-* |
| **Devolución compra** / **NC compra** / **Precio de entrega** | recepción / factura / recepción |
| **Factura normal** (FVE/FCP) | **terminal en logística**: mueve inventario ⇒ no genera entregas ni recepciones |

**Conclusión de diseño** (lo que se propone como canon, ya aplicado en esta ronda): la flexibilidad **es correcta** y es la
particularidad del ERP, pero se sostiene sobre **cuatro reglas**, y todos los defectos de esta ronda y de las anteriores
(r24, r26, r27) fueron violaciones de la regla 2 y 4:

1. **Cualquier documento puede iniciar el flujo** y debe poder **completarse desde donde se inició**: el origen puede
   generar **N** documentos destino (parciales) hasta agotar el pendiente.
2. **El pendiente se DERIVA de las líneas de los documentos activos** (facturas/recepciones/entregas no canceladas), nunca
   de un flag ni de una columna denormalizada (`invoicedQty`/`reservedQty`/`openQty` de cabecera se desvían — T96/T97/T98).
3. **La trazabilidad real es POR LÍNEA** (`baseDocType`/`baseDocId`/`baseLineId`): el vínculo de cabecera es **un solo
   campo** y lo escriben las **dos** direcciones, así que solo sirve de pista, nunca de criterio.
4. **Cada transición se gatea por OPCIÓN y por PENDIENTE** (nunca apagando todo el menú del documento), y el modo de
   **captura** (`isManualMode`) no es el **origen**.

**Declarado**:

- La recepción de compra **no** tiene un `POST /purchase-receipts/from-quotation/:id` de primera clase: la cotización →
  recepción se arma con el alta manual + `purchaseQuotationId` + `purchaseQuotationItemId` por línea (consume el `openQty`
  de la cotización y deja la traza), mientras ventas sí tiene `delivery-orders/from-quotation`. Es una **asimetría de
  nombre**, no un hueco de flujo: si se quiere simetría, es un endpoint de una línea sobre el camino que ya funciona.
- La **factura normal** (FVE/FCP) es terminal en logística por diseño (mueve inventario); su reversa es la NC/devolución.
- Las sondas de navegador y de API de esta ronda son **temporales** (no se commitean): la regresión queda pinzada en Karma
  (6 casos nuevos) y en los dos casos E2E `R28-A`/`R28-B`.
- **Medido en la base de desarrollo** (`_probe-r28-legacy.ts`): de las **10** recepciones con una reserva ligada, las que
  **nacen** de una FRC (`REC-24/26/27`) traen la **traza por línea** (`baseDocType = PURCHASE_RESERVE_INVOICE`) y las **7
  sin traza** son **todas** de la dirección contraria (la recepción **emitió** la reserva: `REC-2/4/7/9/11/30/31`). O sea:
  la regla «el origen se decide por la LÍNEA» no deja ninguna recepción histórica sin reconocer —el único caso ambiguo sería
  una recepción nacida de una FRC por el camino **anterior a la r24**, que no escribía traza, y ese camino tampoco consumía
  la reserva—.

## Ronda 30 — la grilla muestra el descuento que el documento va a guardar (CERRADA, solo visualización)

### Lo que pidió el usuario

> «si hazlo por favor, ¿es lo correcto verdad? guíame también con las buenas prácticas, no siempre es lo que yo diga a veces
> puedo estar equivocado, pero tú estás más al tanto de las buenas prácticas en un ERP.»

Era el cierre de la ronda 29: en la **FCP** y en las **dos cotizaciones** la celda `DTO. %` de la línea mostraba **43,75**
al aplicar 25 % de cabecera, mientras la caja y el documento descontaban **25 %**.

### Medición

```
ANTES (navegador, 25 % de línea → 25 % de cabecera, línea de 150)
   FRC: línea limpia (r29) · celda 25,00 · caja Total 112,50           ✅ coherente
   FCP: línea con el % de la cabecera · celda 43,75 · caja 112,50      ✗ dos lecturas del mismo hecho
API (payload del alta en modo cabecera)
   FCP-38  línea limpia + cabecera 25 %  → desc 37,50 · total 112,50   ← lo que la pantalla manda
   FCP-39  línea 25 % + cabecera 25 %    → desc 65,63 · total 84,37   ← payload que la pantalla NO produce
DISCRIMINADOR (navegador, e2e/zz-r30-discounttotal.spec.ts)
   descuento de línea TECLEADO por el usuario → discountPct 25 · discountTotal 37,50  (FCP y FRC)
   cabecera MATERIALIZADA por el borrador     → discountPct 25 · discountTotal  0,00
```

### Entregado (visualización: ningún payload, ninguna regla de dinero, nada de backend)

`isMaterializedHeaderShare(row)` en `shared/utils/line-discount-display.util.ts`: `%` o importe con `discountTotal` en
**0** en un **borrador** ⇒ ese descuento es la **cabecera** que el propio formulario escribió, así que no se suma (la base
del prorrateo vuelve al bruto, como cuando la línea viaja limpia, y el `%` compuesto no la acumula). La acumulación
**legítima** (línea con descuento propio **persistido**, `discountTotal > 0`) sigue igual y el documento **guardado** sigue
mandando por `stored` (ronda 23).

### Medido después (misma sonda)

```
FRC y FCP → celda DTO. % = 25,00 (antes 43,75 en la FCP) · caja Total 112,50 (un solo 25 %)
```

### Gates

`tsc` app/spec/e2e **0**, **Karma** (3 casos nuevos del util: materialización porcentual, materialización por importe y el
control de un descuento propio persistido; + 1 caso reescrito **con la medición delante** —el fixture ponía `%` sin importe,
forma que la UI no produce—), **`ng build` AOT 0** y prettier limpio.

### Declarado

- El discriminador es `discountTotal == 0` **en un borrador**: es la forma exacta que deja la materialización del patrón
  SAP/Odoo. Si algún día un formulario escribiera la cabecera en la línea **con** su importe, la celda volvería a sumar (y
  sería correcto, porque el payload también lo llevaría).
- La regla del **motor** sigue siendo acumulativa (T254) para un documento que **legítimamente** traiga las dos capas, y el
  documento **guardado** se lee siempre de la línea (ronda 23).

## Ronda 41 — las fechas de CALENDARIO (`@db.Date`) dejan de correrse un día: la vigencia de las series se lee 01/01→31/12 y el ÚLTIMO día de la vigencia ya numera documentos (CERRADA)

**Lo que reportó el usuario** (2026-09-29): «las series empiezan el 30 de diciembre del 2025 y finalizan el 30 de
diciembre del 2026 […] debería empezar desde el día 1 hasta el 31 […] creo que hay un problema con el casteo de la
fecha o algo así».

### Lo que se midió ANTES

- **Los datos están bien**: las **31** series y la `Gestión 2026` son `2026-01-01T00:00:00.000Z → 2026-12-31T00:00:00.000Z`
  (sonda `_probe-r41-fechas.ts`, Prisma + API), y **Prisma entrega _todos_ los `@db.Date` como medianoche UTC** —
  serie, gestión, período y tasa de cambio (sonda `_probe-r41-raw.ts`)—. Los `@db.Date` del esquema son **14**, en
  `DocumentSeries`, `FiscalYear`, `AccountingPeriod`, `ExchangeRate`, `BankStatement`, `BankStatementLine`,
  `BankReconciliation` y `TenantMetrics`.
- **El defecto visible era del frontend** (navegador, Playwright, zona `America/La_Paz` = UTC−4): la lista de series
  mostraba **`31/12/2025 → 30/12/2026`** en las 31 filas, mientras la lista de gestiones (`01/01/2026 31/12/2026`), el
  detalle de la gestión y sus 12 períodos se veían **bien**. La columna «Vigencia» usaba
  `new Date(v).toLocaleDateString('es-ES')` (zona del **navegador**); `tenantDate.formatDateOnly` (zona del **tenant**)
  habría hecho lo mismo. Las gestiones y los períodos se veían bien porque usan el helper UTC `formatCalendarDate` y el
  pipe `calendarDate` —la tabla de períodos la pinta la **plantilla**, y el getter `periodColumns`, que declaraba
  `type: 'date'` sobre esas fechas, era **código muerto**—. El mismo patrón defectuoso estaba en **tres** pantallas más
  (`Fecha Extracto` y `Período` de extractos bancarios, `Período` de conciliaciones) y en la columna `date` de tasas de
  cambio, que tenía su **propio `slice`** a mano (una quinta copia).
- **Y un defecto de fondo del backend**: `POST /sales-quotations` con fecha **2026-12-31** → **400** «No existe una
  serie activa de SALES_QUOTATION que cubra la fecha del documento (2026-12-31)» mientras la del **30/12** → **201**.
  Réplica de las consultas del servicio (sondas `_probe-r41-limites.ts` y `_probe-r41-periodos.ts`): la cobertura pedía
  `startDate <= 00:00 local` **y** `endDate >= 23:59:59.999 local` del día del documento —o sea, ya **el día
  siguiente**— y en Postgres `'2026-12-31'::date >= '2026-12-31T23:59:59.999Z'` es **false** (medido en crudo, en sesión
  `America/La_Paz` **y** en `UTC` con `SET LOCAL TimeZone`), así que **el último día de toda vigencia era inusable**;
  además los límites se calculaban con `setHours` (zona del **proceso**, no la del tenant).
- **La misma clase se midió en otros tres sitios y se descartó** (con la medición delante, sin tocar código): el guarda
  de **período contable** (`journal-entry-core._resolveAccountingPeriod` y `accounting-periods.validatePostingDate`), el
  solapamiento de gestiones y el cronograma de activos fijos dan **el mismo resultado en las dos sesiones** de Postgres
  (Prisma liga el parámetro de una columna `date` truncándolo al día, así que `endDate >= <medianoche del tenant>`
  acierta en ambas). También se comprobó que el `OR` del solapamiento de gestiones es un **único objeto** con las dos
  condiciones (semántica `AND`, correcta): una hipótesis inicial de defecto que la sonda desmintió.

### Entregado

- **Frontend** — una sola implementación, el helper `formatCalendarDate` (`@core/tenant-date/calendar-date.pipe`), que
  ya usaba la lista de gestiones: columna «Vigencia» de series, `Fecha Extracto` y `Período` de extractos bancarios,
  `Período` de conciliaciones y la columna `date` de tasas de cambio. Y se **eliminó** el getter muerto `periodColumns`
  del detalle de gestión, que era una trampa (`type: 'date'` sobre fechas de calendario).
- **Backend** — `tenantCalendarDay()` en `src/common/timezone.util.ts` (el **día calendario del tenant anclado a
  medianoche UTC**, el mismo ancla que ya usaba `storefront.service.ts` para localizar la gestión) y un punto único
  `_dayAnchor()` en `src/document-series/document-series.service.ts` —con la zona de la configuración del tenant, que
  `SettingsService` ya cachea por tenant— que usan los **tres** caminos: resolución automática, override explícito
  (`requestedSeriesId`) y preview. Los dos helpers (`_seriesCoversDate`, `_seriesCoversDateRange`) comparan ahora
  `startDate <= día && endDate >= día`. Y el `?date=` del **preview** del correlativo se resuelve con `resolveDocumentDate`
  (medianoche del tenant, igual que el alta) en vez de `new Date(date)`: la pantalla manda un **día** (`YYYY-MM-DD`) y como
  instante UTC se anclaba en el día anterior (el chip podía anunciar una serie distinta de la que el guardado usaría).

### Medido DESPUÉS

- **Navegador (misma sonda)**: las 31 series muestran **`01/01/2026 → 31/12/2026`**; gestiones y períodos siguen igual.
- **API en vivo (sonda `_probe-r41-vivo.ts`)**: **2026-12-31 → 201** (antes 400, cotización creada y borrada al
  terminar), 2026-01-01 y 2026-12-30 → 201 (sin cambio) y **2027-01-01 → 400** «No existe una serie activa…» (el rango
  **no** se afloja).
- **Réplica de la consulta (misma sonda)**: el 31/12 pasa de `NINGUNA` a `COT-2026` en las **dos** sesiones de Postgres.
- **Base local restaurada**: se borraron **4** cotizaciones residuales de la medición anterior (`COT-1..4`, sin
  pedidos, sin enlaces y sin asientos) y el correlativo de `COT-2026` volvió al valor del seed (**1**).
- **PRODUCCIÓN (Railway `backend-erp-production-5c3b`, deployment `43a96494` del commit `91422fd`; Vercel
  `erp-frontend-gules`)**: el push a `josekilla3390/backend-erp` dispara el despliegue; `/health` → **200** y
  `/settings` → `timeZone=America/La_Paz`. Con el endpoint de **solo lectura**
  `GET /document-series/next-preview?docType=SALES_QUOTATION&date=…` (no consume correlativo) el par que
  **discrimina** es **`2026-01-01` → `COT-2026 / COT-2`** (**dentro**: con el `new Date(date)` anterior la medianoche
  UTC habría caído en el 31/12/2025 y no habría serie) frente a **`2025-12-31` → `null`** (**fuera**), más
  **`2026-12-31` → `COT-2026 / COT-2`** (el **último** día de la vigencia, que antes respondía sin serie) y
  **`2027-01-01` → `null`**. En el navegador de producción las series se leen **`01/01/2026 → 31/12/2026`** (cero filas
  con `31/12/2025` o `30/12/2026`). Las sondas contra producción son **solo GET** (no escribieron nada): el correlativo
  avanzó porque la base de producción tiene documentos del **usuario** probando (**`COT-1`**, **`PED-1`**, **`DEL-1`**,
  **`DEL-2`**, medidos por API), señal de que el flujo de ventas funciona de punta a punta con el backend nuevo. Los
  cuatro espejos se verificaron con `git ls-remote` tras cada push, con el mismo SHA que el local.

### Gates

- Frontend: `tsc` app/spec/e2e **0**, **Karma 2443/2443** (4 casos nuevos), **`ng build` AOT 0** y prettier (ratchet)
  limpio en 8 archivos.
- Backend: `eslint`/`tsc` **0**, **215 suites / 2769 tests** (12 casos nuevos: 4 en `document-series.service.spec.ts`, 5
  en `timezone.util.spec.ts` para `tenantCalendarDay` y 3 en `document-series.controller.spec.ts` para el `?date=` del
  preview) y **E2E completo 41 suites / 394 tests** (caso `R41` en `sales-flow`, que incluye las dos aserciones del
  preview del correlativo).

### Declarado

- `type: 'date'` sigue siendo lo correcto para los **instantes** (`createdAt`, `postingDate`), por eso no se cambió el
  comportamiento de `luna-data-table`: la fecha de **calendario** se formatea con el helper explícito.
- El guarda de **período contable** se midió y **no** requería cambio (ver arriba); tampoco el solapamiento de
  gestiones ni el cronograma de activos fijos.
- El **correlativo no retrocede**: una serie cuyo último día se usó sigue avanzando (por diseño).
- Los formularios de extracto y conciliación ya usaban `.slice(0, 10)` y no cambian.

## Ronda 40 — el Centro de configuración ya muestra los pendientes que cuenta (CERRADA)

**Lo que reportó el usuario**: «me muestra "Falta 4" con rojo y "23 OK" pero no veo cuáles son esas 4 que
faltan, ¿no está actualizado nuestro centro de configuración?».

### Lo que se midió ANTES

`GET /setup/checklist` (tenant recién sembrado, perfil contable BO):

```
resumen: { total: 27, ok: 23, warn: 0, missing: 4, notRequired: 0, requiredPending: 0 }

grupos que emite el BACKEND (7): Empresa(4) · Contabilidad(4) · Parametrización(1) ·
                                 Gestión y series(3) · Maestros(11) · Validación operativa(4)
grupos en SETUP_GROUP_ORDER (5): Empresa · Contabilidad · Gestión y series · Maestros ·
                                 Usuarios y acceso          ← faltan dos

los 4 MISSING (todos `severity: recommended`):
  flowSales      Flujo de ventas        (order 30)
  flowPurchases  Flujo de compras       (order 31)
  flowInventory  Flujo de inventario    (order 32)
  flowTreasury   Flujo de tesorería     (order 33)
```

**Causa**: `groups` devolvía `SETUP_GROUP_ORDER.filter((g) => presentes.has(g))`, así que los ítems de un grupo
**no listado** —`Parametrización` (1, en estado OK) y `Validación operativa` (4, los «Falta»)— se contaban en el
resumen y **no se pintaban**: 22 filas renderizadas de 27. El test con un grupo desconocido fallaba con
`Expected 6 to be 7` (una fila de siete, invisible), que es el invariante del defecto.

### Entregado

- `SETUP_GROUP_ORDER` incorpora **`Parametrización`** (tras Contabilidad, `order` 5.5) y **`Validación operativa`**
  (al final, `order` 30-33).
- `groups` es **a prueba de fallos**: primero el orden curado y **después cualquier grupo presente que no esté en la
  lista**, ordenado por el `order` de su primer ítem (`primerOrden`). Un grupo nuevo ya no puede desaparecer.
- Dos casos nuevos en `setup.component.spec.ts`: el grupo desconocido se pinta al final **y todo ítem visible se
  renderiza** (`filas.length === visibles`), y los canónicos van antes que un desconocido con `order` menor.

### Medido DESPUÉS (navegador, Playwright contra el `ng serve` con el tenant sembrado)

```
RESUMEN : OK 23 | Revisar 0 | Falta 4 | No aplica 0
GRUPOS  : Empresa · Contabilidad · Parametrización · Gestión y series · Maestros · Validación operativa
ÍTEMS pintados: 27 · etiquetas «Falta»: 4        (antes 22)
QUÉ FALTA: Flujo de ventas · Flujo de compras · Flujo de inventario · Flujo de tesorería
```

### Gates

Frontend `tsc` app/spec/e2e **0**, **Karma 2439/2439** (2 casos nuevos), **`ng build` AOT 0** y prettier (ratchet)
limpio.

### Declarado

1. Los 4 «Falta» son **recomendaciones, no bloqueantes** (`requiredPending: 0`): el banner dice «Casi listo».
2. Son el estado **esperado tras sembrar de cero** (0 transacciones): se resuelven al registrar la primera factura
   de venta, la primera de compra, un movimiento de inventario y un cobro.
3. `Usuarios y acceso` está en el orden curado pero el backend **no emite ítems** de ese grupo en este tenant: no se
   pinta ninguna sección vacía.

## Ronda 39 — el motivo se ve en los listados, la paginación de entregas deja de mentir y se limpia el residuo de sondas (CERRADA)

Cierra los cuatro pendientes declarados al terminar el tramo de descuentos.

### (1) El motivo del descuento, visible en los listados

**Medido antes**: `headerDiscountReason` aparecía en modelos, formularios, servicios y payloads y **0 veces** en
plantillas de listado ⇒ el motivo solo se descubría abriendo la ficha.

**Entregado**: `headerDiscountDetail()` + el pipe `headerDiscountTitle` (en
`shared/utils/header-discount.pipe.ts`, reutilizando `headerDiscountLabel`) y, en los **14** listados con el chip «Dto.
cabecera», `[title]="row | headerDiscountTitle"`: `Descuento de cabecera 25.00 % · Motivo: «acuerdo comercial con el
proveedor»`. Sin motivo (por debajo del umbral) devuelve **solo el valor**: no se inventa un «sin motivo» que el motor
no exige.

### (2) Los scripts de sonda, fuera

**Medido antes**: **86** archivos `_probe-*` sin versionar en `backend-erp/scripts` (83 `.ts` + 4 `.js` menos los de
esta ronda), declarados desde la ronda 35. Comprobado antes de borrar que **ningún** archivo versionado los invoca
(`git grep _probe` sobre `package.json`, `.github`, `scripts`, `Dockerfile*`, `*.mjs`, `*.js` → sin resultados).
**Medido después**: **0** archivos `_probe-*` y **0** entradas sin versionar en el repo.

### (3) Los documentos de sonda de la BD de desarrollo

**Medido antes** (sonda de solo lectura): **14** documentos con «sonda/prueba» en las notas, **todos** en las tablas de
facturas de compra y **sin ninguna referencia** desde otros documentos (`baseDocId` en las nueve tablas de líneas → 0):

```
FRC-27/29/30/37/38/39/40  CLOSED  asiento=1  stock=0
FRC-28                    CLOSED  asiento=0  stock=0   ← el único sin rastro contable
FCP-30/31/32/33/34/35     OPEN    asiento=1  stock=2   ← NO eran borradores: nacen contabilizadas
```

**Entregado**: **13 anulados por la APP** (`POST /purchase-invoices/:id/cancel` y
`POST /purchase-reserve-invoices/:id/cancel` con motivo, que revierten stock y contabilizan la reversa — nada a mano)
y **FRC-28 borrada** (no tenía asiento ni stock ni referencias). **Medido después**: **13** documentos de sonda y
**0 sin anular**; el tipo de cambio del día que la anulación exige se creó para la limpieza y se **borró** al terminar.

**Declarado**: los 13 quedan `CANCELLED` (con su reversa contabilizada), igual que las facturas de sonda que dejó la
ronda 35: borrar un documento contabilizado dejaría asientos huérfanos. Y los 6 `FCP` **no** eran borradores —mi
previsión era borrarlos— porque medido tenían **1 asiento y 2 movimientos de stock** cada uno: se anularon como el
resto.

### (4) La paginación del listado de entregas

**Medido antes** (API real, 22 entregas en la empresa): `GET /delivery-orders?limit=1` → **`total=1`**, `totalPages=1`:
el servicio descartaba el `count` (`const [_total, data]`) y respondía `filtered.length`, es decir el tamaño de la
**página**. Y el filtro por `invoiceStatus` —estado **derivado** de las líneas (facturado vs devuelto), que no cabe en
el `where`— se aplicaba sobre la página ya cortada, así que `limit=1&invoiceStatus=PENDING` también daba `total=1`.

**Entregado**: sin filtro en memoria, `total = count` y la página la corta la base (`skip`/`take`); con
`invoiceStatus`, se trae el conjunto completo, se filtra y **después** se pagina, con `total = filtrado.length`.

**Medido después** (misma API):

```
?limit=1                      total=22  filas=1  totalPages=22     (antes total=1)
?limit=5                      total=22  filas=5  totalPages=5
?limit=100                    total=22  filas=22 totalPages=1
?limit=1&invoiceStatus=PENDING total=2  filas=1  totalPages=2      (antes total=1)
?limit=1&discountMode=header   total=12 filas=1  totalPages=12
```

**Declarado**: con `invoiceStatus` el servicio carga **todas** las filas que cumplen el `where` (con sus líneas) para
poder filtrar y paginar bien; el listado de la pantalla **no** usa ese filtro (filtra en cliente), así que el coste
extra solo lo paga un consumidor de API que lo pida explícitamente.

### Gates

Backend `eslint` y `tsc` **0**, unitarios **215 suites / 2757 tests** (4 casos nuevos de paginación en
`delivery-orders.service.spec.ts`) y **E2E completo 41 suites / 393 tests** (caso `R39` en `sales-flow`); frontend
`tsc` app/spec/e2e **0**, **Karma 2437/2437** (4 casos nuevos del pipe), **`ng build` AOT 0** y prettier (ratchet)
limpio en 30 archivos.

### Declarado (de la ronda)

1. El motivo se muestra en el **`title` del chip** (no en una columna): 200 caracteres de texto libre por fila no caben
   en catorce tablas; una columna «Motivo» con truncado reutilizaría el mismo dato.
2. `sales-returns` sigue **sin filas** y `purchase-returns` con **una**: su congelado se pinza en tests, no en vivo.

## Ronda 38 — el indicador y el filtro del descuento llegan a las SEIS familias que lo heredan, y el motivo deja de perderse (CERRADA)

Cierra el punto **(2)** declarado tras el tramo: las rondas 31/32 dejaron el indicador «Dto. cabecera» y el filtro por
modo de descuento en las **ocho** familias donde el descuento se **captura** (cotización, pedido, factura y F. Reserva,
de venta y de compra), y faltaban las **seis** que lo **heredan** de su origen: entrega, recepción, devolución de
venta/compra y NC de venta/compra.

### Lo que se midió ANTES (sondas `_probe-r38-seis.ts`, `-ab.ts`, `-escritura.ts`)

```
columnas: las seis tablas YA tienen discountMode / headerDiscountPct / headerDiscountAmt
          y NINGUNA tiene headerDiscountReason (information_schema)

filas en modo cabecera: entrega 12/22 · recepción 21/39 · NC venta 10/11 · NC compra 6/6
                        devolución venta 0/0 · devolución compra 0/1   ← hay datos reales

GET del listado: publica discountMode/headerDiscountPct/headerDiscountAmt/totalDiscount
                 y NO publica headerDiscountReason (AUSENTE)

filtro ?discountMode: IGNORADO en las seis
  entrega 22/22/22 · recepción 39/39/39 · NC venta 11/11/11 · NC compra 6/6/6
  devolución compra 1/1/1 · devolución venta 0/0/0        (sin filtro / header / line)

asientos por sourceDocumentType (groupBy real): PURCHASE_RECEIPT 39 · DELIVERY_ORDER 22
  SALES_CREDIT_NOTE 11 · PURCHASE_CREDIT_NOTE 6 · PURCHASE_RETURN 1 · SALES_RETURN 0

PATCH con la cabecera cambiada (con el tipo de cambio del día creado; sin él el guard
global de FX responde 400 ANTES que el del descuento):
  FVE-29 (mapeada, control)  → 409 GUARD congelado   (documento intacto)
  FRC-59 (mapeada, control)  → 409 GUARD congelado   (documento intacto)
  DEL-22  (4 asientos)       → 400 del SERVICIO «items must be an array»   ← el guard dejó pasar
  REC-39  (3 asientos)       → 400 del SERVICIO «items must be an array»
  NCR-11  (6 asientos)       → 400 del SERVICIO «Solo se puede editar una nota de crédito abierta»
  NCP-6   (6 asientos)       → 400 del SERVICIO «Solo se puede editar una nota de crédito abierta»
  PATCH sin motivo (20 %)    → 400 GUARD motivo en las cuatro  ← la política SÍ las cubría
```

Dos defectos medidos, no una simple falta de columna: en las seis familias el guard **ya exigía** el motivo (la política
es *route-agnostic*) pero el motivo **se perdía** —sin columna y sin entrada en el mapa ruta→modelo— y el **congelado no
las cubría** (la petición llegaba al servicio en vez de responder 409).

### Entregado

- **Migración** `20260930120000_header_discount_reason_seis_familias`: `headerDiscountReason` en `DeliveryOrder`,
  `PurchaseReceipt`, `SalesReturn`, `SalesCreditNote`, `PurchaseReturn` y `PurchaseCreditNote` (+ los campos en
  `schema.prisma`).
- **Mapa** `src/common/discount-document.util.ts`: las seis rutas → sus modelos y sus tipos de asiento
  (`DELIVERY_ORDER`, `PURCHASE_RECEIPT`, `SALES_RETURN`, `PURCHASE_RETURN`, `SALES_CREDIT_NOTE`,
  `PURCHASE_CREDIT_NOTE`), medidos con el `groupBy` de arriba. Con eso el **motivo** y el **congelado** llegan a las seis.
- **Interceptors** (`DiscountReasonInterceptor`): manda el **modo del documento** que publica la respuesta (no el de la
  petición) —una familia que hereda la cabecera puede ignorar la del DTO y entonces el motivo se **limpia** en vez de
  quedar colgado de un documento en modo línea— y **no actúa** en los endpoints de simulación (`preview`, `draft/*`).
- **Filtro** (backend): `where.discountMode` en los seis `findAll` + `@Query('discountMode')` en los seis controladores.
- **Listados** (frontend): columna **«Dto. cabecera»** (pipe `headerDiscount` de la r31) y control **«Descuento»**
  (`Todos / Con cabecera / Solo línea`) sobre `discountFilter` + `setDiscountFilter(mode)` en los seis listados.

### Medido DESPUÉS (mismas sondas + caso E2E)

```
columna headerDiscountReason en las seis tablas: SÍ
GET del listado: publica headerDiscountReason (null si no hay)

filtro ?discountMode: DISCRIMINA y no pierde ni inventa documentos
  recepción 39 = 21 header + 18 line · NC venta 11 = 10 + 1 · NC compra 6 = 6 + 0
  entrega 22 = 12 + 10 · devolución compra 1 = 0 + 1

PATCH con la cabecera cambiada en un documento contabilizado:
  DEL-6 / REC-1 / NCR-1 / NCP-1 → 409 «ya está contabilizado… nota de crédito» y documento intacto

E2E `R38` (base de tests): cotización 25 % → pedido → ENTREGA (hereda la cabecera) con el motivo
  en el cuerpo → la entrega guarda motivo, el listado lo publica, `?discountMode=header` la trae y
  `?line` no, y su PATCH responde 409 con el documento intacto.
E2E `R38` (segundo caso): alta manual de devolución de venta con cabecera en el cuerpo que el
  servicio IGNORA (T255-D7: la copia del origen) → el documento queda `line` y el motivo **null**
  (no se guarda un motivo que contradice al documento).
```

### Gates

Backend `eslint` y `tsc` **0**, unitarios **215 suites / 2753 tests** (34 casos nuevos: 13 del guard y 21 del
interceptor) y **E2E completo 41 suites / 392 tests** (dos casos `R38` en `discount-propagation`); frontend `tsc`
app/spec/e2e **0**, **Karma 2433/2433** (16 casos nuevos), **`ng build` AOT 0** y prettier (ratchet) limpio en 24
archivos.

### Declarado

1. Tres de los seis listados no tenían columna «Total»: «Dto. cabecera» se colocó junto a la **última columna
   monetaria** (`totalCost` en las devoluciones, `currency` en la recepción). Es mover un bloque si se quiere otra
   posición.
2. El listado de **entregas** informa `total` como el tamaño de la **página** (devuelve `filtered.length`, no el `count`):
   defecto de **paginación** preexistente y ajeno al descuento; medido (`limit=1` → `total=1` con 22 filas) y **no**
   tocado en esta ronda.
3. La **devolución de venta manual** no captura la cabecera del DTO: la copia del documento de origen (T255-D7). El
   alta manual con `discountMode: 'header'` en el cuerpo nace `line` y, con la regla nueva, **sin** motivo.
4. `sales-returns` **no tiene filas** en la base de desarrollo (0): su filtro y su motivo se pinzan en tests (unitarios +
   E2E), no con datos reales; y `purchase-returns` solo tiene **1** fila, en modo línea, así que el congelado no se pudo
   medir en vivo por esa familia (sí en entrega, recepción y las dos NC).
5. El **tipo de cambio del día** que la ronda 35 había borrado se creó para medir la política (el guard global de FX
   responde 400 antes que el del descuento) y se **borró** al terminar.

## Ronda 37 — el descuento de un documento contabilizado queda bloqueado en pantalla (CERRADA)

Cierra el punto **(3)** declarado tras el tramo: el backend ya respondía 409 (ronda 34-c), pero el usuario lo descubría
**al guardar**.

### Lo que se midió ANTES

```
GET /purchase-invoices/105 (FCP-44)  -> transactionId=229   ← el GET ya lo publica
GET /sale-invoices/54      (FVE-29)  -> transactionId=217
GET /purchase-reserve-invoices/107 (FRC-59) -> transactionId=235
GET /sale-reserve-invoices/53      (FRV-25) -> transactionId=214

asientos por tipo de documento origen: QUOTATION 0 · SALES_ORDER 0 · PURCHASE_ORDER 0
```

Es decir: el candado se puede saber **sin backend nuevo** en las cuatro familias de factura/reserva, y cotizaciones y
pedidos **nunca** se contabilizan (no necesitan candado).

### Entregado

- `@Input() locked` en el componente compartido `document-discount-mode`: deshabilita el **toggle** y el **motivo** y
  añade el aviso «Documento contabilizado: el descuento de cabecera no se puede modificar. Se corrige con una **nota de
  crédito** o anulando el documento.» (con `data-testid="discount-locked"`).
- Los **cuatro** formularios de factura/reserva mapean `transactionId` al cargar el documento y pasan
  `[locked]="!!form.get('transactionId')?.value"`; los tipos (`transactionId?: number | null`) en modelos, servicios y
  formularios.

### Medido DESPUÉS

Con `transactionId`: los dos botones del toggle y el campo del motivo quedan **deshabilitados**, el aviso aparece y
pulsar el toggle **no** cambia de modo. Sin él (borrador): todo operativo.

### Gates

Frontend `tsc` app/spec **0**, **Karma 2417/2417** (3 casos nuevos), **`ng build` AOT 0** y prettier (ratchet) limpio
en **19 archivos**. El backend **no** cambia (sus gates siguen en 215 suites / 2719 tests y E2E 41 / 390 de la ronda 36).

### Declarado

1. El candado se calcula en el frontend desde `transactionId`; una factura **anulada** lo conserva y se muestra
   bloqueada (razonable: su descuento ya no se toca).
2. El **409** del backend sigue siendo la red de seguridad para quien llame al API directamente.
3. El arnés de Karma **stubea la plantilla** en los formularios, así que la regresión se pinza en el **estado** que la
   plantilla consume y en el spec del componente compartido (DOM real).

## Ronda 36 — el motivo y el congelado también cubren las F. Reserva (CERRADA)

Cierra un **defecto de las rondas 33-b2 y 34**: el mapa ruta→modelo del descuento apuntaba a las tablas
`SaleReserveInvoice`/`PurchaseReserveInvoice`, que están **vacías**.

### Lo que se midió ANTES (sonda `_probe-r36-frc-congelada.ts`)

```
filas: PurchaseInvoice isReserve='Y' 57 · PurchaseReserveInvoice 0
       SaleInvoice    isReserve='Y' 25 · SaleReserveInvoice    0

FRC manual (FRC-58) -> PurchaseInvoice isReserve=Y status=CLOSED pct=25 motivo=null  asiento=1
                        (el motivo tecleado NO se guardó: updateMany sobre una tabla sin filas)
```

El congelado, además, **no encontraba el documento** por la ruta de la reserva (el `findFirst` del modelo «Reserve»
devolvía `null` y el guard salía sin decidir).

### Entregado

`src/common/discount-document.util.ts`: las rutas `/sale-reserve-invoices` y `/purchase-reserve-invoices` resuelven a
los modelos de **factura** (`saleInvoice`/`purchaseInvoice`), con la medición documentada en el propio archivo. El
id de la ruta es el de la fila de factura.

### Medido DESPUÉS (misma sonda)

```
FRC manual (FRC-59) -> PurchaseInvoice isReserve=Y status=CLOSED pct=25
                       motivo="sonda r36: motivo de la FRC"   ← persistido
                       PATCH cabecera 30 % por /purchase-invoices/:id   -> 409 · pct sigue 25
```

### Gates

Backend `eslint`/`tsc` **0**, unitarios **215 suites / 2719 tests** (2 casos nuevos) y **E2E completo 41 suites /
390 tests** (caso `R36` en `discount-propagation`). El frontend no se toca.

### Declarado

1. Las tablas `SaleReserveInvoice`/`PurchaseReserveInvoice` quedan **vestigiales** (0 filas); la migración de b2 les
   añadió la columna por simetría.
2. El caso E2E `R36` pincha las dos cosas: el motivo persistido y el 409 por la ruta de la reserva.

## Ronda 35 — el permiso del tope se concede desde la pantalla, y limpieza de sondas (CERRADA)

Cierra los dos huecos declarados tras el tramo: **(1)** el permiso `discounts:authorize` no se podía conceder desde la
UI (el hueco real del incremento del tope) y **(4)** las sondas y sus datos de prueba seguían en el árbol y en la BD de
desarrollo.

### (1) El permiso, concedible desde la pantalla

- **Medido antes**: `pages/permissions/permissions.service.ts` tenía **94 módulos y 17 acciones** y **ni** el módulo
  `discounts` **ni** la acción `authorize`: la pantalla no ofrecía la casilla, así que el permiso del tope solo se
  concedía con `PUT /permissions` a mano.
- **Entregado**: el módulo **«Descuentos»** (grupo *Documentos*) y la acción **«Autorizar»**, con un caso de Karma que
  pincha que concederla escribe `discounts: ['authorize']` en la configuración del rol (y que el JWT lo lleva al
  guard, que es quien lo lee).
- **Gates**: `tsc` app/spec **0**, **Karma 2414/2414**, **`ng build` AOT 0** y prettier (ratchet) limpio.
- **Declarado**: la columna «Autorizar» se muestra en **todos** los módulos (el catálogo de acciones es global); hoy solo
  `discounts` la consume.

### (4) Limpieza de sondas y de los datos de prueba

| qué | cómo se limpió |
| --- | --- |
| usuario de prueba `r33-user` (rol USER, 0 documentos) | borrado |
| tipo de cambio USD→BOB copiado a hoy por la sonda | borrado (la BD queda como estaba) |
| `COT-48..52` y `PED-35` (sin asiento) | borrados con sus líneas |
| `FCP-40/41/42/44` (con asiento y stock) | **anuladas por la APP** (`POST /purchase-invoices/:id/cancel`): revierte stock y contabiliza la reversa — nada se borró a mano |
| 24 scripts `_r3*.js`, 91 logs `_r3*.log`, 9 sondas `_probe-r3*.ts`, 6 specs Playwright `zz-*.spec.ts` | borrados (temporales por diseño, nunca se commitearon) |

- **Medido después**: `facturas de sonda sin anular: 0`; los cuatro contadores en **0** y `git status` de los tres
  repos **sin ruido**.
- **Declarado**: quedan **85** `_probe-*.ts` de rondas anteriores sin commitear (temporales por diseño: la regresión
  vive en las suites) y los documentos de sondeo de rondas previas siguen en la BD de desarrollo; se pueden borrar si se
  quiere, pero **no** son de esta ronda.

## Ronda 34 (c) — la cabecera referencial se CONGELA al contabilizar (CERRADA)

Cierra el último declarado del tramo de descuentos: «una factura emitida no debería mover su descuento; eso se corrige
con NC».

### Lo que se midió ANTES (sonda `_probe-r34-congelar.ts`)

```
COT (borrador)  PATCH cabecera 25 % → 30 %  -> 200 · pct=30          (el borrador SÍ es editable)
FCP manual      asiento=true · status=OPEN
                PATCH cabecera 25 % → 30 %  -> 200 · pct=30 desc=45 total=105   ← el asiento seguía en 25 %
                PATCH solo el motivo        -> 200 · motivo reescrito
```

Es decir: **un documento contabilizado podía mover su cabecera y su motivo**, dejando el mayor y el documento en
desacuerdo.

### Entregado

- **`src/common/discount-document.util.ts`** (nuevo): el mapa **ruta → modelo** y los tipos de asiento por familia,
  compartido por el interceptor del motivo y el guard (antes el mapa vivía dentro del interceptor).
- **Congelado en `DiscountPolicyGuard`**: en `PATCH`/`PUT` de un documento concreto cuyos campos de cabecera
  **cambian** respecto de lo guardado, si el documento **ya tiene asiento** → **409** con la salida correcta. El candado
  mira **tener asiento**, no el `status` (medido: la factura manual está `OPEN` y contabilizada a la vez), y reenviar el
  mismo descuento (lo que hacen los formularios al guardar) **no** se bloquea.

### Medido DESPUÉS (misma sonda)

```
COT (borrador)  PATCH cabecera 25 % → 30 %  -> 200 · pct=30
FCP contabilizada  PATCH 25 % → 30 %        -> 409 «… ya está contabilizado … nota de crédito …»
                   documento                 -> intacto (pct=25 · desc=37,50 · total=112,50)
                   PATCH solo el motivo      -> 409
```

### Gates

Backend `eslint`/`tsc` **0**, unitarios **215 suites / 2717 tests** (5 casos nuevos del congelado) y **E2E completo
41 suites / 389 tests** (caso nuevo en `discount-propagation`). El frontend **no** se toca en esta ronda, así que sus
gates no se re-ejecutan (Karma 2413/2413 y `ng build` AOT 0 siguen siendo los de b2).

### Declarado

1. El congelado cubre las **ocho** familias que capturan el descuento (las demás lo heredan de su origen).
2. Un documento **histórico** con cabecera y **sin motivo** exige teclear el motivo al re-guardarlo: es la regla de b2.
3. El **frontend** no deshabilita los campos (la pantalla no sabe si el documento tiene asiento): el usuario recibe el
   409 con el porqué. Deshabilitarlos es un paso siguiente declarado.
4. La corrección es **NC o anulación**: no hay edición «con reversa automática» del asiento.

## Ronda 33 (b2) — el MOTIVO del descuento de cabecera: obligatorio sobre el umbral y guardado en el documento (CERRADA)

Cierra el declarado «**motivo**» del tramo (el tope y la autorización entraron en b1).

### Lo que se midió ANTES (sonda `_probe-r33-tope.ts`)

```
POST /sales-orders con headerDiscountReason  -> 400 «property headerDiscountReason should not exist»
POST /sales-orders cabecera 90 % SIN motivo  -> 201 · persistido PED-30 (pct=90 desc=135 total=15)
```

### Entregado

- **Migración `20260930000000_header_discount_reason`**: `headerDiscountReason String?` en los **ocho modelos que
  capturan** el descuento (cotización, pedido, factura y F. Reserva, de venta y de compra).
- **Ajustes**: `headerDiscountReasonMinPct` (**default 10**; `0` = siempre, `100` = nunca) + `UpdateSettingsDto` +
  `GET/PUT /settings`, y la perilla en la sección «Descuentos» de Configuración.
- **DTO**: `headerDiscountReason` (opcional, `@MaxLength(200)`) en `CommercialDocumentHeaderDto` (la base de todas
  las cabeceras comerciales).
- **Punto único de la decisión**: `discount-policy.ts` incorpora `reasonRequired`/`reason`/`reasonMissing` y el
  mensaje accionable; `DiscountPolicyGuard` responde **400** si falta el motivo — **después** del 403 del tope.
- **Punto único de la persistencia**: `DiscountReasonInterceptor` (APP_INTERCEPTOR) escribe el motivo en el documento
  con el `id` de la respuesta, lo limpia al volver a modo línea y no tumba la operación si el guardado falla.
  Se eligió frente a tocar **23 payloads × 8 formularios** y **~78 puntos de escritura** de los servicios.
- **Frontend**: el campo «Motivo del descuento» en el componente compartido `document-discount-mode` (una vez para los
  ocho formularios) + el binding y el campo en los payloads/cargas de los ocho + los tipos.

### Medido DESPUÉS (misma sonda)

```
GET /settings                 -> 35 claves (headerDiscountMaxPct, headerDiscountReasonMinPct)
ADMIN 90 % SIN motivo         -> 400 «… 90,00 % supera el umbral de 10,00 % … Motivo del descuento …»
ADMIN 20 % SIN motivo         -> 400
ADMIN  5 % SIN motivo         -> 201   (bajo el umbral)
ADMIN 25 % CON motivo         -> 201
ADMIN 90 % CON motivo         -> 201 · persistido PED-35 modo=header motivo="acuerdo comercial con el proveedor"
USER  90 % SIN motivo         -> 403 del tope (se comprueba antes que el motivo)
```

### Gates

Backend `eslint`/`tsc` **0**, unitarios **215 suites / 2712 tests** (**39 casos**: 17 de la
política, 13 del guard y 9 del interceptor) y **E2E completo 41 suites / 388 tests**; frontend `tsc` app/spec/e2e
**0**, **Karma 2413/2413** (3 casos nuevos), **`ng build` AOT 0** y prettier (ratchet) limpio en **39 archivos**.

### Declarado

1. El motivo se guarda **en la cabecera del documento** (no en una tabla aparte): viaja con él, se precarga al
   reabrirlo y sirve para informes/impresión; **quién lo aplicó** queda por `createdById`/`updatedById` del documento.
2. La persistencia es un **UPDATE posterior** a la escritura (un statement extra por alta con motivo): es el precio de
   no tocar 23 payloads × 8 formularios.
3. El umbral se mide sobre el **porcentaje efectivo** (como el tope): con cabecera por **importe** y sin líneas en el
   cuerpo (caminos `from-*`) no aplica.
4. El **frontend no replica** el umbral: el usuario lo descubre por el 400, que dice el `%`, el umbral y el campo.

## Ronda 33 — el TOPE del descuento de cabecera: configurable por empresa y con autorización por permiso (CERRADA, incremento b1)

Cierra el declarado «**tope + autorización**» del tramo de descuentos. El **motivo** (con su umbral) queda como
incremento **b2**, con su medición delante.

### Lo que se midió ANTES (sonda `_probe-r33-tope.ts`, API real, con un usuario de rol USER creado por la sonda)

```
GET /settings  -> 33 claves, NINGUNA de descuento
rol USER       -> ningún módulo de descuento en su configuración de permisos
POST /sales-orders  cabecera 90 % SIN motivo  -> 201 · persistido PED-30
                     modo=header pct=90 desc=135 total=15   (una línea de 150)
POST con headerDiscountReason                 -> 400 «property headerDiscountReason should not exist»
```

Es decir: **no había tope, ni motivo obligatorio, ni autorización** — cualquiera que pudiera crear el documento podía
descontar el 90 %.

### Entregado

- **`src/common/discount-policy.ts`** — el **punto único** de la decisión (puro, sin Nest ni Prisma):
  `effectiveHeaderDiscountPct` (el `%` capturado o, si la cabecera es por **importe**, `importe ÷ bruto de las líneas
  × 100`), `evaluateHeaderDiscountPolicy` (tope + permisos) y `headerDiscountPolicyMessage` (mensaje accionable).
- **`src/common/discount-policy.guard.ts`** — **guard global de escritura**, registrado al final de la cadena de guards
  de `app.module` (donde ya hay sesión y tenant). Cubre **todas** las familias y **todos** los caminos (altas, ediciones,
  `from-*`, `multi-*`, POS) **sin tocar 14 servicios ni ~78 puntos de escritura**; solo mira POST/PATCH/PUT cuyo
  cuerpo traiga descuento de cabecera.
- **Ajustes**: `SettingsService.headerDiscountMaxPct` (**default 25**, acotado 0..100; `100` = sin tope práctico) +
  el campo en `UpdateSettingsDto` y en `GET/PUT /settings`.
- **Permiso `discounts:authorize`**: el admin lo tiene por el wildcard `*:*`; se concede **por rol** editando la
  configuración de permisos (no viene por defecto en USER, que es lo que le da sentido).
- **Frontend**: sección **«Descuentos»** en Configuración con el campo del tope (default 25).

### Medido DESPUÉS (misma sonda)

```
GET /settings              -> 34 claves, con headerDiscountMaxPct
USER   cabecera 90 %       -> 403 «El descuento de cabecera 90,00 % supera el tope de 25,00 % configurado para la
                               empresa. Solicítalo a un usuario con el permiso «descuentos: autorizar»
                               (discounts:authorize) o baja el descuento.»
ADMIN  cabecera 90 %       -> 201   (tiene *:*: puede autorizar)
ADMIN  cabecera 25 %       -> 201   (dentro del tope)
headerDiscountReason       -> 400   (el motivo es b2, declarado)
```

### Gates

Backend `eslint` y `tsc` **0**, unitarios **214 suites / 2693 tests** (dos suites nuevas, **20 casos**: 11 de la
política y 9 del guard) y **E2E completo 41 suites / 387 tests** (corrido con `--max-old-space-size=12288`: con el tope
de 6144 el runner agotó el heap a los ~15 min en esta sesión larga — **headroom del arnés**, no del cambio); frontend
`tsc` app/spec/e2e **0**, **Karma 2410/2410** (1 caso nuevo), **`ng build` AOT 0** y prettier (ratchet) limpio.

### Declarado

1. El **motivo obligatorio** (umbral configurable, p. ej. 10 %) es el incremento **b2**: el campo
   `headerDiscountReason` **no existe todavía** (medido: 400 «property … should not exist») y su persistencia toca
   **14 modelos** y ~78 puntos de escritura, así que va con su propia migración.
2. El tope se mide sobre el **porcentaje efectivo**. Con cabecera por **importe** y **sin líneas** en el cuerpo (los
   caminos `from-*`, donde el descuento viene del origen y ya se validó al capturarse) la decisión **no aplica**.
3. La autorización es **por permiso/rol** (`discounts:authorize`), no por usuario ni por documento: granularizarla por
   familia es declarar el permiso en cada módulo (`sales-orders:authorize`, …).
4. `100` en el tope equivale a **no tener tope** en la práctica.
5. El guard es **global** y barato: descarta por método y por cuerpo antes de leer los ajustes (que además tienen caché
   por tenant de 5 minutos).

## Ronda 32 — el indicador y el filtro «Dto. cabecera» llegan a PEDIDOS y COTIZACIONES (CERRADA, incremento a)

Cierra el **declarado (2) de la ronda 31**: el indicador y el filtro existían solo en las familias donde el descuento
**aterriza**, y faltaban en las dos donde se **captura** (pedidos y cotizaciones, de venta y de compra).

### Medición (sonda `_probe-r32-filtro.ts`, API real, empresa 1)

```
ANTES (el parámetro se ignoraba en las CUATRO familias)
PO     sin filtro 31  (31 cabecera / 0 línea)   ?header 31   ?line 31   ← ?line = el total sin filtrar
PED    sin filtro 29  (27 / 2)                  ?header 29   ?line 29
PCOT   sin filtro 33  (33 / 0)                  ?header 33   ?line 33
COT    sin filtro 36  (34 / 2)                  ?header 36   ?line 36
       y las cuatro respuestas YA traían discountMode / headerDiscountPct / headerDiscountAmt
       (el findMany no recorta campos) ⇒ el INDICADOR no necesitaba backend

DESPUÉS (misma sonda, mismos documentos)
PO     ?header 31 = base 31   ?line  0 = base 0    ← la cara que discrimina: 31 → 0
PED    ?header 27 = base 27   ?line  2 = base 2    ← 29 → 27 y 29 → 2
PCOT   ?header 33 = base 33   ?line  0 = base 0    ← 33 → 0
COT    ?header 34 = base 34   ?line  2 = base 2    ← 36 → 34 y 36 → 2
```

### Entregado

- **Backend**: `where.discountMode` en los `findAll` de `purchase-orders`, `sales-orders`, `purchase-quotations` y
  `sales-quotations` (dato **referencial**, mismo contrato y comentario que la ronda 31) y `@Query('discountMode')` en los
  cuatro controladores.
- **Frontend**: la columna **«Dto. cabecera»** con el chip `.header-discount-chip` en los cuatro listados —reutilizando el
  pipe `headerDiscount` de la ronda 31, sin tocarlo—, el control **«Descuento»** en las cuatro barras de filtros
  (`discountFilter` + `setDiscountFilter(mode)`: fija el filtro, vuelve a la página 1 y recarga) y el parámetro en los
  cuatro `getAll`. **Spec nuevo** para el listado de **cotizaciones de compra**, que no tenía ninguno.
- **Diff neto**: 16 archivos de frontend + 8 de backend.

### Gates

Frontend `tsc` app/spec/e2e **0**, **Karma 2409/2409** (9 casos nuevos: 2 por listado —el del filtro y el de la
columna— más el `should create` del spec nuevo), **`ng build` AOT 0** y prettier (ratchet) limpio; backend `eslint` y
`tsc` **0**, unitarios **212 suites / 2673 tests** y **E2E completo 41 suites / 387 tests** (corrido con
`HEALTH_DISK_THRESHOLD_PERCENT=0.98`: el caso `/health` es **ambiental** —`D:` al **90,4 %** de uso contra el umbral del
**90 %** del endpoint— y con el umbral alto pasa).

### Declarado

1. El **ratchet de prettier** obligó a **formatear los cuatro listados legacy** tocados (arrastraban formato previo): el
   churn queda **dentro** de esos archivos y se **revirtió** lo que un glob formateó de más (los `*-form`, los pickers y
   los specs de formularios), para no ensanchar el diff.
2. El filtro es **referencial**: filtra la **intención** con la que se pactó el documento, no el importe descontado
   (para dinero, `totalDiscount` o la cuenta de descuentos del asiento).
3. Siguen abiertos el **tope + motivo + autorización** del descuento de cabecera y **congelar la cabecera referencial**
   al contabilizar.

## Ronda 31 — el descuento de cabecera VIAJA y los listados lo identifican y lo filtran (CERRADA, dos incrementos)

### Lo que preguntó el usuario

> «¿el descuento sirve para que viaje en los flujos? Por ejemplo si coloco un descuento de cabecera en una cotización,
> ¿viaja en el flujo hasta la factura? […] yo creo que debe ser referencial, al final los cálculos se hacen con el descuento
> en línea que se replica o se prorratea en las líneas que se generan por el descuento en cabecera.»

### Medición (sondas `_probe-r31-viaje.ts`, `-multi.ts` y `-asiento-fve.ts`; cadenas NUEVAS, cabecera 25 %, canasta 150/50)

```
VENTAS    COT-36 → PED-29 → DEL-22 → FVE-29
COMPRAS   PCOT-33 → PO-31 → REC-35 → FRC-56          (las CUATRO de cada cadena)
   modo=header · cabPct=25,00 · cabAmt=0,00 · totalDiscount=50,00 · total=150,00
   líneas: pct 25 · desc 37,50 / 12,50                ← el EFECTO, materializado en la línea
ASIENTO FVE-29 (cabecera)              ASIENTO FVE-20 (modo línea, desc 3,00)
   Descuentos sobre Ventas      D 43,50   (SIN pata de descuento — D10)
   Crédito Fiscal Desc. Ventas  D  6,50   Ventas H 80,53 · CxC D 91,00
   Ventas de Mercaderías        H 180,49
   IVA — Débito Fiscal          H  19,51
   CxC Clientes                 D 150,00
MULTI     FRC-57 (consolidación de dos recepciones con cabecera)
   modo=line · cabPct=null · totalDiscount=100,00 · 4 líneas `pct 25`   ← nace en modo LÍNEA (R2)
```

**Conclusión**: la intuición del usuario es la correcta y es el canon. La cabecera guarda la **intención** (modo + valor) y
es lo que (a) **viaja** por el flujo, (b) permite que el **asiento** desglose el descuento solo cuando es de cabecera (D10)
y (c) permite **distinguirlo** en un listado o reporte. El **hecho** vive en la línea (`discountPct`/`discountAmt` +
`discountTotal`). Y una regla para los reportes: **el `%` de cabecera no se suma ni se multiplica** — el dinero es
`totalDiscount` o la cuenta de descuentos del asiento.

### Entregado (primer incremento: el indicador; solo frontend)

`shared/utils/header-discount.pipe.ts` (pipe `headerDiscount` + `headerDiscountLabel`: solo en modo cabecera, un valor y no
dos —`%` o importe, como el motor—, y el modo anunciado si la cabecera está vacía) y la columna **«Dto. cabecera»** con el
chip `.header-discount-chip` en los listados de las cuatro familias donde el descuento **aterriza**: **FCP, FVE, FRC, FRV**.
Medido antes de escribirlo: las respuestas de listado de las seis familias **ya traen** `discountMode`,
`headerDiscountPct`, `headerDiscountAmt` y `totalDiscount` ⇒ **sin cambios de backend**.

### Entregado (segundo incremento: el filtro; backend + frontend)

`PaginationParams.discountMode` (documentado como **referencial** en `src/common/paginated-result.ts`) + `where.discountMode`
en los `findAll` de las **cuatro** familias (`purchase-invoices` sirve a la FCP **y** a la FRC —la reserva delega con
`isReserve: 'Y'`—, `sale-invoices`, `sale-reserve-invoices` y `purchase-reserve-invoices`), el `@Query('discountMode')` en los
cuatro controladores, el parámetro en los cuatro `getAll` del frontend y el control **«Descuento»**
(`Todos / Con descuento de cabecera / Solo descuento de línea`) en las cuatro barras de filtros, sobre `discountFilter` +
`setDiscountFilter(mode)` —fija el filtro, vuelve a la **página 1** y recarga—.

El gate encontró un **defecto real antes de commitear**: `LunaSelectComponent` estaba **importado** en los cuatro listados
pero **no declarado** en su `imports:` ⇒ `NG0304 'luna-select' is not a known element` y `NG01203` tumbaban el spec de la FCP
(7 de 7 `ERROR` y el navegador colgado 5 minutos); corregido, el foco de los cuatro listados da **18/18**. El filtro se
midió **antes** de escribirlo, por API (`_r31-svc.js`): facturas de compra sin filtro **39**, `discountMode=header` **31** y
`discountMode=line` **8** (31 + 8 = 39: no pierde ni inventa documentos).

### Gates

Frontend `tsc` app/spec/e2e **0**, **Karma 2400/2400** (2 casos nuevos del filtro: FCP y FVE), **`ng build` AOT 0** y
prettier limpio; backend unitarios **212 suites / 2673 tests** y **E2E completo 41 suites / 387 tests** (corrido con
`HEALTH_DISK_THRESHOLD_PERCENT=0.98`: el caso `/health` del arnés es **ambiental** —con `D:` al **90,4 %** de uso contra el
umbral por defecto del endpoint (**90 %**) el indicador `disk` responde *down* y devuelve **503**
(`{"prisma":"up","memory":"up","disk":"down"}`); con el umbral alto el mismo caso pasa **3/3**: no es regresión de la ronda).

### Declarado (siguientes incrementos, en el orden propuesto)

1. **Tope + motivo + autorización** del descuento de cabecera (umbral configurable por empresa, p. ej. 10 %).
2. Extender el indicador **y el filtro** a **pedidos y cotizaciones** (donde el descuento se **captura**): las respuestas
   de listado ya traen los campos; falta el parámetro en sus `findAll`.
3. **Congelar la cabecera referencial** al contabilizar (una factura emitida no debería mover su descuento; eso se corrige
   con NC).

## Pendiente del tramo

- **Ronda 25 — CERRADA** (los tres defectos vivos de ventas que destapó la auditoría de la ronda 24): los caminos
  `sale-invoices/from-*` (single y multi) **replican** su origen, la **entrega desde una FRV** la espeja y el **neteo de
  la FRV** deja de derivar centavos. Medición A/B, entregado, gates y declarados en la sección «Ronda 25» de arriba.
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
- Sondas: **borradas en la ronda 39** (86 archivos `_probe-*` de todas las rondas del tramo; el conocimiento que
  destilaron vive en los tests unitarios y E2E y en las mediciones anotadas en cada ronda). Lo que sigue es el
  **registro** de qué medía cada una, por si hay que rehacer una medición:
  - **T255**: `_probe-t255-anulacion.ts` (cancelación + NC parcial + límites), `_probe-t255-espejo.ts` (par
    original/espejo y estados), `_probe-t255-ab.ts` (A/B de la fecha) y `_probe-t255-ui-*.ts` (validación sobre base
    limpia con los payloads de la pantalla).
  - **Ronda 25**: `_probe-r24-medicion-b.ts` (la cadena de venta y la entrega desde la FRV) y
    `_probe-r24-medicion-b-bis.ts` (los **siete** caminos que heredan cabecera, A-G) —escritas en la ronda 24 y
    reutilizadas como A/B—, `_probe-r25-frv-deriva.ts` (las líneas de la FRV contra la regla única) y
    `_probe-r25-respuesta.ts` (¿la **respuesta** del alta publica `totalDiscount`? base y `GET` sí).
  - **Ronda 24**: `_probe-r24-recepcion.ts` (la recepción creada desde la FRC frente a la FRC: importes, IVA y
    descuento), `_probe-r24-doble-recepcion.ts` (¿se puede recibir dos veces la misma FRC?), `_probe-r24-vinculo.ts`
    (los dos vínculos FRC ↔ recepción), `_probe-r24-verificacion.ts` (limpieza + A/B del arreglo),
    `_probe-r24-margen*.js` (los precios del artículo para explicar el margen) y la **auditoría**
    `_probe-r24-auditoria*.ts` (13 invariantes por familia sobre 215 documentos).
  - **Ronda 38/39**: `_probe-r38-seis.ts` (columnas, filas en cabecera y filtro ignorado en las seis familias),
    `_probe-r38-ab.ts` (la política y el congelado, con el tipo de cambio del día), `_probe-r38-escritura.ts` (el
    `groupBy` de `sourceDocumentType`) y `_probe-r39-*.ts` (estado y referencias de los documentos de sonda).
- Las sondas **de navegador** (`erp-frontend/e2e/zz-r24-*.spec.ts`, `zz-r27-*`, `zz-r28-*`, `zz-r29-*`, `zz-r30-*`) se
  **retiran tras medir** (las de las rondas 24-30 ya no están en el árbol); para el A/B en pantalla se hace
  `git stash` en `erp-frontend` y se espera al `Application bundle generation complete` del `ng serve` antes de volver
  a correrlas.
- **Ronda 23** (registro; la sonda se borró en la r39): `_probe-r23-columnas.ts` (lo guardado por el backend frente a lo
  que pinta la grilla, con el espejo nuevo y el viejo), `_probe-r23-candidatos.js` y `_probe-r23-id.js` (documentos
  guardados con la cabecera materializada y el **id** del código `FRC-44` = **80**: el formulario de la FRC se abre por
  **id**, no por código). La sonda **de navegador** temporal (`erp-frontend/e2e/zz-r23-live-medicion.spec.ts`, ya
  retirada) se corría con `npx playwright test e2e/<archivo>.spec.ts --project=chromium --no-deps` contra el `ng serve`
  vivo —`localhost:4200`, que escucha en **`[::1]`**: `Test-NetConnection 127.0.0.1` da falso aunque esté arriba— y leía
  las pestañas «💸 Descuentos» y «💰 Costos» de `FRC-44` y la de descuentos de `PO-1`.
- En una **base limpia** los artículos de las sondas ya no existen: se toman tres artículos de la semilla con
  `trackingType: 'NONE'` (los serializados exigen número de serie) y el precio se manda en el documento.
- El campo del espejo es `reversalJournalEntryId` **en el original** (apunta al espejo); el espejo **no** lleva
  `sourceDocumentId`, así que se localiza por el original.
- Los asientos de una factura incluyen las patas de **inventario/COGS**, así que su D total no es el total del
  documento: el importe de venta es la pata de `CxC`.
- Jest escribe el resumen en **stderr** y el arnés a veces reporta `exit code: 1` con la suite en verde.
