# Plan — Seguimiento por lote/serie: auditoría, costeo y gate preventivo

> Estado: **propuesta para aprobación** (2026-09-22). Nace de la pregunta del usuario:
> «¿todas las transacciones con artículos de seguimiento por lote/serie asignan bien en alta,
> reversión, producción, ajustes y revalorizaciones? ¿se puede revalorizar un lote o serie
> específica? ¿es obligatorio asignar lote/serie para que el costo sea correcto?».
> **No se escribe código hasta que el usuario decida los puntos de §4.**

## 0. Lo que se midió (evidencia en código, no en doc)

| Pieza | Estado medido |
|---|---|
| **Validación de asignación** | `validateDocumentLineTracking` (`src/common/document-stock.helper.ts:251`) exige lote/serie cuando el artículo es `LOT`/`SERIAL` **y** el tenant tiene el ajuste `enableBatchTracking`/`enableSerialTracking` encendido (`settings.service.ts:126-127`; es un ajuste por tenant, no un default de schema), valida que cada asignación exista, que la cantidad sea > 0, que la **suma de asignaciones cuadre con la cantidad de la línea** y, en salidas, que el lote tenga existencia en ese almacén (`validateBatchStock`) |
| **Cobertura de esa validación** | **15 familias** la llaman: entregas (7 puntos), POS, emisión y recibo de producción, NC y devoluciones de venta y compra, facturas de venta y compra, recepciones (6 puntos), entradas, salidas, ajustes y traspasos. `stock-counts` maneja lote/serie por su propio camino (11 menciones de `batchId`/`serialNumberId` en su servicio) |
| **Reversión** | El helper tiene `reverseIncomingStock` (`:830`), `reverseOutgoingStock` (`:959`) y `reverseStockTransfer` (`:1088`): las tres **restituyen la cantidad del lote** (`upsertStockBatch` con el signo inverso) y el **estado del número de serie** (`updateSerialNumberStatus`), y escriben el movimiento espejo con el mismo lote/serie |
| **Existencia por lote** | `StockBatch` (`schema.prisma:2569`) es único por `(tenant, lote, almacén)` y guarda `stockPhysical` y `avgCost` **por lote** |
| **Existencia y costo del artículo** | `Stock` (`:2457`) es único por `(tenant, artículo, almacén)`: **no tiene dimensión de lote/serie** y ahí vive `avgCost`, el promedio ponderado |
| **Costeo de salidas** | `getAvgCost` (`src/common/stock.util.ts:765`) documenta y aplica «para movimientos de SALIDA **siempre** el `avgCost` del almacén, fallback a `item.cost`»; hay **79 llamadas** y **ninguna** lee `StockBatch.avgCost` (verificado: los únicos matches de `stockBatch` + `avgCost` son importaciones de `upsertStockBatch`) |
| **Costo por lote** | Se **escribe** solo si `Item.batchCostingEnabled = true` (default **`false`**, `schema.prisma:1471`): el promedio ponderado del lote lo calcula `upsertStockBatch` (`stock.util.ts:783-827`) y lo pasan 8 servicios (helper ×4, facturas y recepciones de compra, ajustes, entradas, traspasos). **Nadie lo lee para costear** |
| **Costo por serie** | `SerialNumber.purchaseCost` existe y se edita por su CRUD (`serial-numbers.service.ts:81,95`); **ningún camino contable lo lee** |
| **Revalorización** | `StockRevaluationItem` (`schema.prisma:9113`) es **artículo + almacén**: no tiene `batchId` ni `serialNumberId`. El servicio **no toca `StockBatch`** (0 usos) y **no valida tracking** (no llama al validador) |
| **Cobertura de pruebas** | **1 suite E2E** de 4 tests (`test/batch-serial-flow.e2e-spec.ts`): costo a nivel artículo con `batchCostingEnabled=false`, costo por lote con `true`, recálculo del promedio del lote en la segunda compra del mismo lote y baja de existencia del lote al vender. La barrida operativa tiene un escenario «LOTES Y SERIADOS» (entrada, salida y existencias) en `scripts/flow-sweep.mjs:2120-2236` |
| **Gate preventivo** | **No existe**: `scripts/audit-flow-links.mjs` no tiene ninguna regla de lote/serie (0 coincidencias) |

## 1. Respuestas a las tres preguntas

1. **¿La asignación es obligatoria?** Sí, **con dos condiciones**: el artículo debe tener
   `trackingType = LOT/SERIAL` **y** el tenant debe tener encendido el ajuste de trazabilidad
   correspondiente. Con el ajuste apagado, un artículo con seguimiento **no exige** lote/serie
   y el guard no corre. Además, la obligación **no está verificada por ninguna suite amplia**:
   hay 1 E2E de 4 tests y no hay detector de datos.
2. **¿Se puede revalorizar un lote o una serie específica?** **Hoy no.** La revalorización es
   por **artículo + almacén** (no tiene la dimensión) y actualiza el `avgCost` del artículo;
   el `avgCost` de cada `StockBatch` **queda como estaba**. Lo mismo aplica a la serie
   (`purchaseCost` nunca entra al costo).
3. **¿Se necesita el lote para que el costo sea correcto?** **Con el diseño actual, no**: el
   COGS de cualquier salida es el **promedio ponderado del artículo en el almacén**
   (`getAvgCost`, 79 llamadas, sin lectura del costo del lote). El lote sirve hoy para
   **trazabilidad y existencia por lote**, y el costo por lote existe como **dato**
   (`StockBatch.avgCost`, solo con `batchCostingEnabled = true`) pero no participa del asiento.
   Costear por lote es una **decisión de producto** con impacto en el motor, la revalorización,
   los informes y la producción (qué lote consume una emisión).

## 2. Huecos medidos (a cerrar según §4)

| # | Hueco | Severidad |
|---|---|---|
| H1 | **La revalorización ignora los lotes**: revalorizar un artículo con lotes mueve el `avgCost` del artículo pero deja `StockBatch.avgCost` de cada lote desactualizado (hoy sin efecto en el asiento, porque nadie lo lee; sería un dato mentiroso en cuanto se active el costeo por lote) | Media |
| H2 | **No hay gate preventivo de tracking**: nada detecta en datos reales un movimiento de artículo `LOT`/`SERIAL` sin lote/serie, un `StockBatch` que no cuadra con la existencia del artículo, un serie vendida sin movimiento de salida o un lote con existencia negativa | Alta (es la respuesta a «podemos validar») |
| H3 | **`enableBatchTracking`/`enableSerialTracking` apagados desactivan la obligación** sin ninguna señal: un tenant puede operar artículos con seguimiento sin asignar nada (y el kardex queda sin trazabilidad) | Media (decisión) |
| H4 | **Evidencia E2E fina**: 1 suite / 4 tests para 15 familias. No hay E2E de **reversa de un documento con lote/serie**, ni de **producción con lote/serie**, ni de **ajuste/toma con lote** | Media |
| H5 | **`stock-counts` va por su propio camino** (no usa el validador compartido): hay que medir si exige lote/serie y si cuadra la suma de asignaciones como el resto | A medir |

## 3. Fases propuestas

| Fase | Alcance | Verificación |
|---|---|---|
| **F1 — Gate preventivo `audit:tracking`** (respuesta directa a «podemos validar») | Reglas nuevas sobre **datos reales**: (a) movimiento de artículo `LOT` sin `batchId` o `SERIAL` sin `serialNumberId` (excluyendo los tipos que no mueven mercancía), (b) `StockBatch.stockPhysical` ≠ suma de movimientos del lote en ese almacén, (c) serie `SOLD` sin movimiento de salida (o `AVAILABLE` con salida), (d) lote/serie con existencia negativa, (e) aviso cuando el tenant tiene tracking apagado y hay artículos con `trackingType ≠ NONE` | Autoprueba del detector + **sonda** con datos incoherentes creados a propósito (como R16/R17) + paso en CI; corrida sobre la BD recreada |
| **F2 — Revalorización y lotes** | Según decisión D2: (a) mínimo, **mantener sincronizado** `StockBatch.avgCost` al revalorizar (el mismo delta por lote); (b) completo, permitir revalorizar **un lote/serie** (schema + DTO + valorización + pantalla) | E2E nuevo de revalorización con lotes (antes/después de cada lote y del artículo) |
| **F3 — Costeo por lote/serie** (solo si se decide D1 = sí) | El costo de una salida sale del **lote asignado** (o de la serie), con su propia política de promedio; impacto en `getAvgCost`/llamadores, revalorización, informes y emisión de producción | E2E de dos lotes con costos distintos vendidos por separado, con el asiento usando el costo del lote asignado |
| **F4 — Evidencia E2E por familia** | Suite nueva de tracking: alta, **reversa**, producción (emisión y recibo), ajuste y toma con lote/serie, más la barrida `--only=lotes` | Suites E2E en verde + barrida medida |
| **F5 — Guardas de obligatoriedad** | Según decisión D3: exigir lote/serie **siempre** que el artículo tenga seguimiento (independiente del ajuste del tenant) o dejar el ajuste pero **avisar** en el gate | E2E del caso «ajuste apagado con artículo LOT» |

## 4. Decisiones que necesito de ti

- **D1 — Costeo**: ¿quieres **costeo por lote/serie** (que el COGS de la venta salga del costo
  del lote/serie asignado) o mantenemos el **promedio ponderado del artículo+almacén** y el
  lote queda para trazabilidad y existencias? (Hoy es lo segundo; con `batchCostingEnabled=true`
  el costo por lote se guarda pero **no se usa**.)
- **D2 — Revalorización**: ¿basta con **sincronizar** el costo de los lotes al revalorizar el
  artículo, o quieres poder **revalorizar un lote o una serie específica** (documento nuevo con
  la dimensión)?
- **D3 — Obligatoriedad**: ¿el lote/serie debe ser obligatorio **siempre** que el artículo tenga
  seguimiento, o se mantiene la dependencia del ajuste por tenant (`enableBatchTracking`)?
- **D4 — Alcance de la evidencia**: ¿arranco por **F1 (gate)** —lo que responde «podemos
  validar»— y luego F4, dejando F2/F3 para cuando decidas D1/D2?

## 5. Lo que **no** se midió todavía (declarado)

- No corrí la barrida operativa (`--only=lotes`) ni el E2E `batch-serial-flow` en esta ronda:
  el estado de arriba es lectura de código y schema, no una corrida en vivo.
- No leí en profundidad el camino de `stock-counts` (H5) ni el de ensamblaje con lote.
- No medí si algún informe de kardex **muestra** el costo por lote (solo que el motor no lo usa).
