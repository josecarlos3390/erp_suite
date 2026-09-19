# Plan G2 — Revalorización de artículos (Inventory Revaluation)

> **Estado:** CERRADO (2026-09-18) — **T150** (documento, asiento, kardex y anulación) y **T152** (los dos
> defectos de interfaz que el E2E de UI destapó: el alta no se podía guardar y el listado no tenía acciones de
> fila). Queda **T151** declarado y abierto (el eje de la guarda de período, decisión de producto; ver §7).
> **Origen:** `docs/plans/plan-gaps-deuda-2026-09.md` §G2 · ROADMAP G2 · AUDIT (G2).
> **Documento hermano:** `plan-g1-precio-entrega.md` (comparte el motor de costos).

## 1. Qué es

Un documento del **módulo de Inventario** que **asigna un nuevo costo** a los artículos
de un almacén. No mueve cantidades: **solo actualiza el costo** (`Stock.avgCost`) y el
valor del inventario, y la diferencia se contabiliza contra la cuenta de
**revalorización** (si el valor **aumenta**) o contra la de **contrapartida** (si
**disminuye**).

Referencia de mercado (contrastada): **SAP Business One → Inventory Revaluation**. Sus
tres rasgos definitorios, que adoptamos:

1. **Tipo de revalorización `Price` o `Total`**: se captura el **costo unitario nuevo** o
   el **importe total nuevo** de la existencia.
2. **La cantidad no mueve stock**: en SAP el campo cantidad "does not change the quantity
   in stock and is used only for the recalculations of the item cost".
3. **Dos cuentas del maestro** (Increase / Decrease), resueltas por la jerarquía del
   artículo.

En este ERP las dos cuentas **ya existen** en los cuatro niveles de la jerarquía
(`Item`, `ItemGroup`, `Warehouse`, `ItemWarehouseAccount`):
`stockRevaluationAccountId` («Revalorización») y `stockRevaluationOffsetAccountId`
(«Contrapartida revalorización»), y hoy **ningún código operativo las usa**: estaban
puestas para esta feature.

## 2. Decisiones aprobadas por el usuario (2026-09-18)

| # | Decisión | Elegido |
|---|---|---|
| D1 | Modo de captura | **Precio unitario nuevo Y importe total nuevo** (por línea) |
| D2 | Cantidad base del ajuste | **Toda la existencia del artículo en ese almacén** (sin cantidad parcial) |
| D3 | Cuentas | **Aumento → Cr «Revalorización»** (ingreso) · **Disminución → Dr «Contrapartida revalorización»** (gasto) |
| D4 | Granularidad | **Artículo + almacén**; lote/serie **declarados** como límite |
| D5 | Flujo | **Un paso: se aplica al crear**; se anula con motivo + fecha de contabilización (revierte asiento, restituye costo y deja traza de kardex) |
| D6 (implícita en el pedido) | Kardex | **Aparece siempre, con cantidad 0** (no mueve cantidades; solo el costo) |
| D7 (implícita en el pedido) | Semántica del dato | **El costo capturado es el costo que el artículo DEBE tener después de aplicar** la revalorización |

### Valores por defecto (declarados, no preguntados)

- **Moneda:** siempre la **base** del tenant (el costo promedio es un valor de
  inventario en moneda base). El documento no captura moneda ni tipo de cambio.
- **Sin reexpresión de COGS:** el ajuste va íntegro a inventario y a las cuentas de
  revalorización; **no** se reexpresan costos de ventas históricos (a diferencia del
  Precio de Entrega, que sí reparte a COGS lo ya vendido porque capitaliza un gasto del
  período). Límite declarado.
- **Período y anulación:** mismo estándar que T149 (fecha de contabilización elegible,
  409 si cae en período cerrado/bloqueado, anulación atómica con reversa del asiento).
- **Estado:** `APPLIED` desde la creación (no hay borrador); `CANCELLED` al anular.
- **Serie:** `DocumentType.STOCK_REVALUATION`, prefijo propuesto `REV`, añadida al
  catálogo canónico `DEFAULT_DOCUMENT_SERIES` y al seed.
- **Permisos:** módulo `stock-revaluations` (`view|create|cancel`).
- **Cuentas por defecto del seed** (para que la instalación quede operable, como T132):
  `stockRevaluationAccountId` = `4.2.1.01.008` *Ajuste p/Inflación y Tenencia de Bienes*
  (ingreso, naturaleza acreedora) · `stockRevaluationOffsetAccountId` = `5.1.2.01.001`
  *Compensación de Inventario* (costo, naturaleza deudora). Idempotente: **no pisa** una
  configuración existente.

## 3. Semántica y matemática (contrato)

Para cada línea `(artículo, almacén)`:

```
existencia  = Stock.stockPhysical(item, warehouse)        > 0   (si es 0 → 400)
costoActual = Stock.avgCost(item, warehouse)  ó Item.cost si es null
valorActual = costoActual × existencia

Modo PRICE : costoNuevo = newPrice            ; valorNuevo = costoNuevo × existencia
Modo TOTAL : valorNuevo = newTotal            ; costoNuevo = valorNuevo ÷ existencia
delta       = valorNuevo − valorActual        (con signo; ≠ 0 obligatorio)
```

- `costoNuevo` se guarda con **6 decimales** (como `Stock.avgCost`); `valorNuevo` y
  `delta` con **2**. El redondeo del valor se resuelve con el canon de dinero
  (`Money`), nunca con épsilons inventados.
- En modo `PRICE` el promedio resultante es **exactamente** el capturado (se recalcula
  con `revalueAverageCost(actual, existencia, delta)`, que da `costoActual + delta/existencia`).
- **Cota del promedio (medida en el gate del 2026-09-18)**: el ajuste es **dinero**
  (2 decimales) y el costo un promedio (6), así que el costo resultante coincide con el
  capturado **hasta un céntimo repartido entre la existencia** (`0,01 / existencia`).
  Medición real con 301 unidades: el costo volvió a `1605,237279` frente al original
  `1605,237273` (desvío **6e-6**, dentro de la cota 3,3e-5). La misma cota aplica a la
  restitución al anular; el E2E la afirma con ese margen y registra el desvío medido en
  el log, en vez de exigir una igualdad exacta que solo se da con existencias y costos
  redondos.
- Guardas: `newPrice > 0`, `newTotal ≥ 0`, `delta ≠ 0`, sin líneas duplicadas
  `(item, almacén)`, artículo inventariable y habilitado en el almacén
  (`validateItemWarehouseAssignment`).

### Asiento (por documento, agrupado por cuenta)

| Caso | Asiento |
|---|---|
| `delta > 0` (una o varias líneas) | **Dr Inventario** `Σdelta` · **Cr Revalorización** `Σdelta` |
| `delta < 0` | **Dr Contrapartida revalorización** `Σ|delta|` · **Cr Inventario** `Σ|delta|` |
| Documento con líneas de ambos signos | Un asiento con las cuatro patas (o las que apliquen), **cuadrado** y validado con `_assertBalanced` |

Las cuentas se resuelven por **la misma jerarquía que el resto de los asientos**
(matriz artículo-almacén → artículo → grupo → almacén) mediante los nuevos
`EntryType`:

- `STOCK_REVALUATION_INCREASE` → `stockRevaluationAccountId`
- `STOCK_REVALUATION_DECREASE` → `stockRevaluationOffsetAccountId`

Si el signo requiere una cuenta que **no** está configurada ni en la jerarquía ni en el
`AccountMapping`, el documento **falla con 400 accionable** (nombrando el maestro donde
se configura), nunca contabiliza a una cuenta inventada.

### Ejemplo numérico (caso de aceptación)

Existencia 100 · costo actual 50.00 → valor actual 5,000.00

- **Aumento (PRICE 55.00):** valor nuevo 5,500.00, delta **+500.00** →
  `Dr Inventario 500 / Cr Revalorización 500`; `avgCost` queda **55.000000**.
- **Disminución (TOTAL 4,500.00):** valor nuevo 4,500.00, delta **−500.00** →
  `Dr Contrapartida 500 / Cr Inventario 500`; `avgCost` queda **45.000000**.

### Kardex

Un `StockMovement` por línea (y el inverso al anular):

```
type: STOCK_REVALUATION
quantity: 0                    ← no mueve cantidades (D6)
unitCost: costoNuevo           ← el costo con el que queda el artículo
valueDelta: delta              ← NUEVO: delta de valor del ajuste (con signo)
stockRevaluationId: <doc>
documentDate: <fecha del documento>
reason: 'Revalorización REV-000001 — costo 50.000000 → 55.000000'
```

Al **anular**, un movimiento inverso con `quantity: 0`, `valueDelta = −delta` y
`unitCost` = costo restituido, con `reason` que nombra la anulación: el kardex cuenta la
historia completa de la revalorización y contra-revalorización.

**Por qué el movimiento necesita `valueDelta` (hallazgo del diseño, medido en el código
del kardex):** el saldo valorizado que ve el usuario se calcula en dos rutas —
`_advanceKardexState` (replay fila a fila) y el agregado SQL
`_buildKardexAggregatesSql` (`SUM(quantity × unitCost)` con signo)—. Un movimiento con
`quantity = 0` aporta **0** a las dos, así que el «costo promedio / valorizado» de la
columna corrida **seguiría mostrando el costo viejo** aunque `Stock.avgCost` ya fuese el
nuevo: una incoherencia visible al abrir el kardex después de revaluar. Con
`valueDelta`:

- el replay aplica `val += valueDelta` y recalcula `avg = val ÷ qty` (la cantidad no
  cambia), de modo que **desde esa fila el promedio corrido es el nuevo costo**;
- el agregado SQL suma `COALESCE(SUM("valueDelta"), 0)` a `signedVal`, así que la ruta
  rápida (estado de apertura de la página) **también** lo incluye.

Resultado comprobable en el E2E: la fila de la revalorización aparece con **cantidad 0**,
`unitCost` y `avgCost` = costo nuevo, y `balanceValue` = existencia × costo nuevo.

**Límite declarado (medido por el E2E):** el kardex reconstruye la cantidad y el
valorizado **desde los movimientos**, así que en una instalación **sin historia de
movimientos** (existencia valorada por importación/migración, `Stock` con 100 @ 55 y cero
`StockMovement`) la fila de la revalorización muestra su `unitCost` (= costo nuevo) y su
`valueDelta`, pero `avgCost`/`balanceValue` quedan **nulos** y el resumen da saldo 0 —
porque el kardex nunca vio una entrada. Es una propiedad **previa del kardex** (no del
documento) y el E2E lo fija en su propio caso, en vez de prometer que siempre hay
valorizado.

### Anulación (D5)

1. Motivo **obligatorio** + `postingDate` opcional (T149).
2. `reverseJournalEntry(tx, 'STOCK_REVALUATION', id, tenantId, code, userId, postingDate)`.
3. Restitución del costo: por cada línea, con la fila de stock bloqueada
   (`lockStockRow`), el delta **inverso** se aplica contra la **existencia actual**
   (mismo criterio que la anulación del Precio de Entrega: exacto si el stock no cambió,
   proporcional si cambió).
4. Estado `CANCELLED`, `cancelledById/At`, `cancellationReason`.

## 4. Contrato de API

| Método | Ruta | Cuerpo / respuesta |
|---|---|---|
| `GET` | `/stock-revaluations?page&limit&search&status&dateFrom&dateTo` | `{ data, total, page, limit, totalPages }`; fila: `id, code, status, date, postingDate, deltaTotal, increaseTotal, decreaseTotal, itemsCount, createdBy` |
| `GET` | `/stock-revaluations/:id` | Cabecera + `items[]` (artículo, almacén, existencia, costos, valores, delta, modo, cuentas resueltas con código y nombre) |
| `POST` | `/stock-revaluations` | `{ date, postingDate, branchId?, notes?, reason, items: [{ itemId, warehouseId, mode: 'PRICE'\|'TOTAL', newPrice?, newTotal? }] }` → documento creado (201) |
| `POST` | `/stock-revaluations/:id/cancel` | `CancelDocumentDto` `{ reason, postingDate? }` → documento anulado; **409** si el período está cerrado |

`reason` del documento es **obligatorio** (auditoría del ajuste de costo).

## 5. Superficie a tocar

**Backend**
- `prisma/schema.prisma`: enums `StockRevaluationStatus`, `StockRevaluationMode`,
  `DocumentType.STOCK_REVALUATION`, `StockMovementType.STOCK_REVALUATION`, modelos
  `StockRevaluation` + `StockRevaluationItem`, FK `StockMovement.stockRevaluationId` y
  relaciones inversas en `Item`, `Warehouse`, `Branch`, `User`, `JournalEntry`,
  `DocumentSeries`. Migración idempotente + `prisma migrate diff` sin diferencias.
- `src/common/accounting-entry-types.ts`: los dos `EntryType` nuevos y su campo.
- `src/document-series/document-series.constants.ts`: la serie canónica nueva (y el test
  que vigila el catálogo).
- `prisma/seed.ts`: serie `REV` + las dos cuentas por defecto en los artículos
  (idempotente).
- `src/common/accounting-engine.service.ts` + builder: `createStockRevaluationJournalEntry`.
- Módulo `src/stock-revaluations/` (`module`, `controller`, `service`, `dto/`).
- `src/stock-movements`/kardex: el tipo nuevo aparece con su etiqueta y su documento
  origen navegable.
- `scripts/audit-flow-links.mjs` (regla R13, la que corre `npm run audit:flows`): añadir
  el tipo a la lista de documentos con asiento y anulación.
- Permisos: catálogo del módulo.

**Frontend**
- `pages/stock-revaluations/`: listado (filtros, chip de estado, totales con signo) y
  formulario (cabecera fecha/fecha contab./motivo/observaciones; líneas con selector de
  artículo y almacén, **existencia y costo actual de solo lectura**, modo
  Precio/Total, valor capturado, **valor nuevo y ajuste calculados en vivo** con color por
  signo y totales del documento).
- `services`, `models`, ruta con permisos y **entrada de menú en Inventario**.
- Renombrar en los 4 formularios de maestros (artículo, grupo, almacén y matriz
  artículo-almacén) las etiquetas a **«Revalorización (aumento)»** y
  **«Contrapartida (disminución)»** para que la semántica quede explícita.

**Documentación**: AUDIT (G2), CHANGELOGs, AGENTS, `matriz-flujos-documentos.md`,
`ACCOUNTING_ENTRIES_GUIDE.md` (asiento del documento), este plan.

## 6. Fases y criterios de aceptación

### Fase 1 — Modelo + migración + catálogos
- [x] Migración aplicada y `prisma migrate diff` sin diferencias.
- [x] Serie `REV` en el catálogo y en el seed; el test del catálogo actualizado.
- [x] `tsc` del proyecto y de los specs en 0.

### Fase 2 — Servicio + contabilidad + kardex
- [x] Alta aplica el ajuste en una transacción: `avgCost` = valor capturado,
      kardex cantidad 0 y asiento cuadrado (validado con `_assertBalanced`).
- [x] Aumento → Cr Revalorización; disminución → Dr Contrapartida (casos del §3).
- [x] Sin cuenta configurada → 400 accionable; sin existencia → 400;
      delta 0 → 400; línea duplicada → 400.
- [x] Anulación: reversa del asiento + restitución del costo + kardex inverso, con
      motivo obligatorio y fecha de contabilización; período cerrado → 409 sin efectos.

### Fase 3 — Tests de backend
- [x] Unitarios de la matemática (PRICE/TOTAL, aumento/disminución, redondeo de dinero,
      línea con existencia 0, delta 0) y del asiento (balance, agrupación, signos).
- [x] E2E `test/stock-revaluations.e2e-spec.ts`: alta aumento, alta disminución (con
      asiento y kardex cantidad 0 verificados en la BD), anulación con restitución
      exacta del costo, período cerrado → 409 + atomicidad, aislamiento por tenant,
      y validaciones de entrada.

### Fase 4 — Frontend
- [x] Listado + formulario funcionales contra el API real (Karma + E2E de UI).
- [x] El formulario muestra existencia y costo actual, calcula el ajuste en vivo y avisa
      cuando el valor capturado no produce ajuste.
- [x] Entrada de menú, ruta con permisos y etiquetas de cuentas renombradas.

### Fase 5 — Cierre
- [x] Gates: backend build/lint/jest/E2E/`audit:flows`; frontend lint/build/Karma/gates
      estáticos/`e2e:functional` sobre BD recreada.
- [x] Docs al día (AUDIT con G2/T150 y T152, CHANGELOGs, AGENTS, matriz, guía de asientos).
- [x] Commits ASCII + push a los tres repos.

## 7. Hallazgos y residuos del cierre

- **T151 (declarado, ABIERTO — decisión de producto):** la guarda de período valida la
  fecha que cada servicio pasa como `date` al motor. **18 llamadores** pasan la **fecha
  del documento**; **G1** y **G2** pasan `doc.postingDate ?? doc.date` (lo que promete la
  interfaz). Unificar el eje mueve el comportamiento de **todos** los documentos, así que
  se declara con sus tres opciones en AUDIT T151 en vez de decidirlo aquí.
- **T152 (cerrado):** el alta no se podía guardar (el botón `type="submit"` de la barra
  de acciones vive **fuera del `<form>`** → `HTMLButtonElement.form === null`) y el
  listado no pintaba sus acciones (faltaba la columna `type: 'actions'`); el **mismo**
  defecto de listado existía desde G1 en el Precio de Entrega. Ambos corregidos —los
  botones de la barra usan `(lunaClick)`, como el resto de la casa— y el E2E de UI
  dispara ya el botón real y el menú de la fila. Detalle y mediciones en AUDIT T152.
- **Límite del kardex sin historia de movimientos:** medido en el E2E de backend y
  vuelto a medir en el de UI (el seed reconstruye 26 existencias sin `StockMovement`):
  la fila de la revalorización muestra su `unitCost`/`valueDelta`, pero `avgCost` y
  `balanceValue` quedan nulos. Propiedad **previa** del kardex, no del documento.
