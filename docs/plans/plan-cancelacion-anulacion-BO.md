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

## Pendiente del tramo

- **D2** sello de emisión fiscal (fecha/estado) en facturas de venta y compra (+ reserva) y plazo del día 9
  **configurable por empresa**, colgado del sello y no de `status=CLOSED`.
- **D4** «anular con NC por el total, descuentos incluidos» en un clic (una línea por línea de factura con su
  descuento ya calculado) y `cancel` de un documento emitido con mensaje accionable.
- **D5** `creditNoteMaxDays` (default 180) validado contra la fecha de emisión, sólo si la NC referencia una factura.
- **D6** rechazar NC anterior a la factura o con fecha futura.
- **D7** cabecera referencial en NC/devoluciones + medir la NC parcial con cabecera **por importe**.
- Frontend: quitar el campo de fecha de los diálogos de **cancelación** (dejarlo en la NC).

## Notas del arnés

- Base de desarrollo: `npm run db:recreate` exige parar el API; tras recrear hay que registrar la **tasa del día**
  (`POST /exchange-rates`, USD→BOB 6,96) o el guard bloquea las operaciones.
- Sondas (no se commitean): `backend-erp/scripts/_probe-t255-anulacion.ts` (cancelación + NC parcial + límites),
  `_probe-t255-espejo.ts` (par original/espejo y estados), `_probe-t255-ab.ts` (A/B de la fecha).
- El campo del espejo es `reversalJournalEntryId` **en el original** (apunta al espejo).
- Jest escribe el resumen en **stderr** y el arnés a veces reporta `exit code: 1` con la suite en verde.
