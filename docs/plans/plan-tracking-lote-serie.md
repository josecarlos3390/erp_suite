# Plan — Seguimiento por lote/serie: auditoría, costeo y gate preventivo

> Estado: **en ejecución** (2026-09-22). Decisiones del usuario tomadas: **D1** mantener el
> costeo por promedio del artículo+almacén y **arreglar el dato del lote**; **D2** sincronizar el
> costo de los lotes al revalorizar; **D3** la asignación es obligatoria siempre que el artículo
> tenga seguimiento; **D4** arrancar por **F1** (gate) + **F4** (evidencia).
> Nace de la pregunta del usuario: «¿el costo de los lotes en algún momento se desfasa o
> desincroniza?».

## 0. Lo que se midió (evidencia en código + sonda en vivo)

| Pieza | Estado medido |
|---|---|
| **Validación de asignación** | `validateDocumentLineTracking` (`src/common/document-stock.helper.ts:251`) exige lote/serie cuando el artículo es `LOT`/`SERIAL` **y** el tenant tiene el ajuste `enableBatchTracking`/`enableSerialTracking` encendido (`settings.service.ts:126-127`; ajuste por tenant, no default de schema), valida que cada asignación exista, cantidad > 0, que la **suma cuadre con la cantidad de la línea** y, en salidas, existencia del lote en ese almacén |
| **Cobertura** | **15 familias** llaman a esa validación (entregas ×7, POS, emisión y recibo de producción, NC y devoluciones de venta y compra, facturas, recepciones ×6, entradas, salidas, ajustes, traspasos). `stock-counts` maneja lote/serie por su propio camino |
| **Reversión** | `reverseIncomingStock` (`:830`), `reverseOutgoingStock` (`:959`) y `reverseStockTransfer` (`:1088`) restituyen **cantidad del lote** y **estado de la serie** y escriben el espejo con el mismo lote/serie |
| **Existencia y costo por lote** | `StockBatch` (`schema.prisma:2569`) único por `(tenant, lote, almacén)`, con `stockPhysical` y `avgCost` **por lote**; su promedio se recalcula en `upsertStockBatch` (`stock.util.ts:783-827`) |
| **Costo del artículo** | `Stock` (`:2457`) único por `(tenant, artículo, almacén)`, sin dimensión de lote: ahí vive el `avgCost` que **usa el COGS** (`getAvgCost`, `stock.util.ts:765`; **79 llamadas**, ninguna lee el lote) |
| **Costo por lote: quién lo escribe** | Solo con `Item.batchCostingEnabled = true` (default **false**): helper ×4, facturas y recepciones de compra, ajustes, entradas y traspasos pasan el costo; **revalorización, Precio de Entrega y diferencia de cambio no tocan `StockBatch`** (0 usos) |
| **Costo por serie** | `SerialNumber.purchaseCost` se edita por su CRUD (`serial-numbers.service.ts:81,95`) y **ningún camino contable lo lee** |
| **Gate preventivo** | **No existía** (0 reglas de tracking en `audit:flow-links.mjs`) → **F1 lo crea** |

## 0.b Medición en vivo del desfase (H1) — sonda E2E, 2026-09-22

Artículo `LOT` con `batchCostingEnabled = true`, almacén único; se lee el costo **del artículo**
(`Stock.avgCost`, el que usa la contabilidad) y **del lote** (`StockBatch.avgCost`) después de
cada operación:

| Paso | Costo del artículo | Costo del lote | Existencia del lote |
|---|---|---|---|
| 0. inicial (100 u @ 50, sin lote) | 50 | — (el stock inicial no está en un lote) | 0 |
| 1. **compra** 20 u @ 60 al lote L1 | 51,666667 | **60** | 20 |
| 2. **revalorización** del artículo a 70 (`POST /stock-revaluations`, `mode: PRICE`) | **70** | **60** ← **desfase** | 20 |
| 3. **segunda compra** 10 u @ 80 al mismo lote | 70,769231 | **66,666667** (exacto: (20·60+10·80)/30) | 30 |
| 4. **ajuste** de stock +5 u @ 100 al lote | 71,851852 | **71,428572** (exacto: (30·66,67+5·100)/35) | 35 |

**Lectura medida (y ya corregida en F2)**: el costo por lote **existe y es exacto** para las compras y los ajustes de
ese lote, pero (a) **no es el costo que usa el asiento** (el COGS sale del promedio del
artículo+almacén) y (b) **se desfasa cuando una operación mueve el costo del artículo sin tocar
los lotes**: medido con la revalorización (artículo 70, lote 60), y por lectura de código lo
mismo aplica al **Precio de Entrega** (`landed-costs` no usa `StockBatch`) y a la
**revalorización por diferencia de cambio**.

## 1. Respuestas a las tres preguntas del usuario

1. **¿La asignación es obligatoria?** Sí, con **dos condiciones**: artículo con `trackingType`
   y ajuste del tenant encendido (H3: con el ajuste apagado no se exige nada).
2. **¿Se puede revalorizar un lote o una serie específica?** **Hoy no**: la revalorización es
   por artículo + almacén (`StockRevaluationItem` sin dimensión) y no toca el costo del lote.
3. **¿El costo por lote es exacto y se desfasa?** Exacto **como dato propio del lote** (compras
   y ajustes) y **no** es el que usa la contabilidad; **sí se desfasa** con la revalorización
   (medido) y con las otras dos revalorizaciones del artículo (por código).

## 2. Huecos medidos

| # | Hueco | Estado |
|---|---|---|
| H1 | **La revalorización (y el Precio de Entrega y la diferencia de cambio) no sincronizan el costo del lote** → el lote queda con un costo viejo | **medido en vivo** (§0.b) — a cerrar en F2 |
| H2 | **No había gate preventivo de tracking** | **cerrado en F1** (este frente) |
| H3 | El ajuste del tenant puede **desactivar** la obligación sin señal | cerrado con **D3** (F5) |
| H4 | Evidencia E2E fina (1 suite de 4 tests para 15 familias) | F4 |
| H5 | `stock-counts` va por su propio camino (no usa el validador compartido) | a medir |
| H6 | **Anular una recepción de compra dejaba la serie en `SOLD`** (unidad inservible: la recepción exige `AVAILABLE`) | **cerrado en T183** con E2E que falla antes y pasa después |

## 3. Fases

| Fase | Alcance | Estado / verificación |
|---|---|---|
| **F1 — Gate `audit:tracking`** | `scripts/audit-tracking.mjs` (`npm run audit:tracking` + `:self-test`): **T1** movimiento de artículo `LOT` sin `batchId`, **T2** ídem `SERIAL`, **T3** existencia por lote ≠ saldo del kardex (con la clasificación canónica de entradas/salidas del kardex), **T4** existencia por lote negativa, **T5** estado de serie incoherente con su saldo, **T6 INFO** tenant con el ajuste apagado y artículos con seguimiento | ✅ **HECHO**: autoprueba **14/14**; corrida sobre la BD de desarrollo **0 errores / 0 avisos**; **sonda medida**: un movimiento de `ART-00025` (LOT) sin lote produjo **1 error T1** exacto (exit 1) y al retirarlo volvió a 0; autoprueba agregada al job `lint-and-test` de CI (el gate completo necesita BD, como `audit:flows`) |
| **F2 — Sincronizar el costo del lote** | `src/common/stock-batch-cost.util.ts` (`syncBatchCostsOnRevaluation`) aplicado en la revalorización de artículos: cada lote **con existencia** del artículo+almacén revalorizado pasa a `loteViejo × costoNuevo / costoViejo` (regla **proporcional**, así dos lotes comprados a distinto precio siguen costando distinto); sin proporción posible —artículo en costo 0 o lote sin costo— se fija el costo nuevo. Aritmética en `Prisma.Decimal` (6 decimales) y **sin tocar** el valor del inventario ni el asiento | ✅ **HECHO**: **6 unitarios** del util + **5** del contrato de obligatoriedad; `test/batch-cost-revaluation.e2e-spec.ts` **3/3** (un lote queda en el costo nuevo; dos lotes conservan la proporción 50/80 → 75/120 con el artículo en 90; y sin `batchCostingEnabled` el lote **no** se inventa costo). **Cerrado también en el Precio de Entrega** (aplicar el flete y anularlo: `landed-costs.service.ts`), con E2E que mide artículo 50 → 60 y lote 50 → 60 al aplicar y la vuelta a 50 al anular (`batch-cost-revaluation` caso 4). **La diferencia de cambio no aplica**: `exchange-rate-adjustments.service.ts` no toca `avgCost` ni `StockBatch` (medido: 0 menciones), así que no puede desfasar el lote |
| **F3 — Costeo por lote** | Fuera de alcance por **D1** (se mantiene el promedio del artículo+almacén) | — |
| **F4 — Evidencia por familia** | E2E de reversa, producción, ajuste y toma con lote/serie + barrida `--only=lotes` | **Parcial (2026-09-22)**: `test/tracking-reversal.e2e-spec.ts` **4/4** cubre **alta** con lote y con serie, **reversa** (recepción → lote a 0 y serie a `AVAILABLE`; venta → serie `SOLD` y al anular `AVAILABLE`) y **ajuste** con lote (sube/baja y **400** si sale más que la existencia del lote); el E2E de costo por lote por revalorización (`batch-cost-revaluation`) **3/3** y el de lote/serie existente **4/4**. **Producción y tomas cubiertas (2026-09-22)**: `test/production-tracking.e2e-spec.ts` **5/5** (emisión sin lote → **400**; con lote → baja el lote y el kardex lo lleva, y **anular** lo devuelve; **recibo del PT con lote** → su lote queda con existencia; y **emisión con número de serie** → la unidad sale del inventario y al **anular** vuelve a `AVAILABLE`) y la **toma con lote** en `tracking-reversal` caso 5 (contar 8 de 10 deja el lote en 8). **Barrida operativa `--only=lotes`: 31/31 OK (2026-09-22)** — lote creado, entrada y salida con existencias por lote, la guarda «un artículo con lote exige lote», seriados con entrada y salida y una serie consumida por una venta documental que al devolverse vuelve a `AVAILABLE`; después de la barrida, `audit:tracking` cerró en **0 hallazgos** y el detector de flujos en **0 errores** |
| **F5 — Obligatoriedad** | `validateDocumentLineTracking`: la obligación la decide el **artículo** (`trackingType`); el ajuste del tenant queda solo en la firma (renombrado `_settings`, los ~26 llamadores no cambian) y **ya no desactiva la guarda** | ✅ **HECHO**: `src/common/document-stock.helper.spec.ts` **5/5** — con el ajuste **apagado** un artículo `LOT` sin lote y uno `SERIAL` sin serie dan **400**, con lote/serie pasan, y un artículo `SIN` seguimiento no exige nada aunque el ajuste esté encendido |

## 4. Decisiones tomadas

- **D1**: se mantiene el costeo por **promedio del artículo+almacén**; el lote queda para
  trazabilidad y existencias, y su costo se mantiene **confiable como dato** (F2).
- **D2**: **sincronizar** el costo de los lotes al revalorizar (regla a confirmar en F2).
- **D3**: obligatorio **siempre** que el artículo tenga seguimiento (F5).
- **D4**: arrancar por F1 + F4.

## 4.b Ajustes de cierre (2026-09-22)

| Ajuste | Qué se hizo | Evidencia |
|---|---|---|
| **Interruptores inertes** | `enableBatchTracking`/`enableSerialTracking` **fuera de la pantalla de Configuración** (formulario, hidratación y payload); la sección «Política de stock» explica que la trazabilidad **se define por artículo** y que, teniéndola, la asignación es obligatoria en todas las transacciones. Las claves del API/DB se conservan por compatibilidad | Medido antes: el único lector restante era el propio API/UI (el validador ya no los usa); `ng build` 0 y Karma en verde |
| **Serie consumida por producción** | `production-issues.service.ts` pasa `serialStatus: ASSEMBLED` (antes `SOLD`), el mismo criterio que la orden de ensamblaje; `ApplyOutgoingConfig.serialStatus` ampliado | `test/production-tracking.e2e-spec.ts` **5/5**: la emisión deja la serie en **ASSEMBLED** y al anular vuelve a **AVAILABLE** |

## 5. Lo que **no** se midió todavía (declarado)

- No corrí la barrida operativa `--only=lotes` (el E2E de lote/serie sí: **4/4**).
- No medí en vivo el desfase por **Precio de Entrega** ni por **diferencia de cambio** (está
  deducido de que ningún camino toca `StockBatch`; el de revalorización sí está medido).
- No leí en profundidad `stock-counts` (H5) ni el camino de ensamblaje con lote.
- No medí si algún informe muestra el costo por lote (solo que el motor no lo usa).
