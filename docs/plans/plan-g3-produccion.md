# Plan G3 — Módulo de Producción (Órdenes de Producción, emisión/recibo y WIP)

> **Estado:** APROBADO por el usuario el 2026-09-19 (D1–D4) y **Fases 1, 2, 3, 4 y 5 implementadas y verificadas**
> (maestros, BOM multinivel con explosión y faltantes, orden de producción con snapshot y estados reversibles,
> emisión para producción que carga los componentes al WIP, recibo para producción que ingresa el PT, los
> subproductos y la merma absorbiendo ese WIP y consumo de recursos que carga horas y servicios a ese mismo WIP;
> backend y UI); las Fases 6–7 siguen pendientes.
> **Origen:** `docs/plans/plan-gaps-deuda-2026-09.md` §G3 · ROADMAP G3 · referencia
> `docs/reference/PRODUCCION_ERP_COMPARATIVA.md` (SAP B1 / Odoo 19 / Dynamics 365, verificado contra
> documentación pública).
> **Documentos hermanos:** `plan-g1-precio-entrega.md` (capitaliza gastos en el costo), `plan-g2-revalorizacion.md`
> (documento que ajusta costo sin mover cantidades). Este plan reutiliza **lo mismo**: motor contable por
> jerarquía, motor de kardex, series, permisos, proyecto/dimensiones y el detector de flujos.

## 1. Qué es

Un módulo de **producción discreta** para el mercado boliviano, con el flujo de **SAP Business One**: una **Orden de
Producción** que se aprueba y libera, **Emisiones para producción** que consumen componentes (parciales), **consumo
de recursos** (horas hombre / máquina / servicios) y **Recibos para producción** que ingresan el producto terminado
(más subproductos y merma), con el valor **acumulándose en WIP** (`1.1.3.03.001`) y **liquidándose al cerrar**:
**el WIP de la orden queda en cero** y el residuo va a la cuenta de **desviación de WIP**.

**No** reemplaza al módulo de ensamblaje: `AssemblyOrder` (kit → componentes en un paso, `Dr Inventario kit /
Cr Inventario componentes`) **se queda como está** —está probado y con E2E— y producción es un ciclo aparte con
estados, parciales, recursos y WIP. El maestro de **BOM y ruta es compartido** y se amplía.

## 2. Decisiones aprobadas por el usuario (2026-09-19)

| # | Decisión | Elegido |
|---|---|---|
| D1 | Alcance de planificación | **Explosión de BOM + aviso de faltantes** contra stock. **Sin MRP** (necesidades por fecha y propuestas de compra/orden) y **sin capacidad finita (APS)** |
| D2 | Costeo | **Costo real por orden con liquidación al cierre** (sin costo estándar ni desviaciones sistemáticas) |
| D3 | Recursos y máquinas | **Maestro de recursos con componentes de costo** (concepto + cuenta + tarifa) y **máquinas como recurso `MACHINE` enlazado al Activo Fijo** existente |
| D4 | Orden de trabajo | **Primero la referencia y el plan** (esto), implementación después de la aprobación — *cumplido: el plan se aprobó el 2026-09-19 y la Fase 1 ya está implementada* |

## 3. Contrato funcional

### 3.1 Estados de la orden (reversibles)

```
DRAFT ──► PLANNED ──► RELEASED ──► IN_PROGRESS ──► CLOSED
  │          │           │             │
  └──────────┴───────────┴─────────────┴──► CANCELLED
```

- `DRAFT`: se arma la orden (artículo, cantidad, almacenes, componentes y operaciones sugeridas desde BOM/ruta).
- `PLANNED`: explosión de BOM calculada; **aviso de faltantes** por componente (previsto vs stock disponible) y
  costo **previsto** congelado (snapshot).
- `RELEASED`: la orden se libera (permiso `release`); queda habilitada para emitir/recibir.
- `IN_PROGRESS`: hay al menos una emisión o un consumo de recurso.
- `CLOSED`: se liquidó el WIP (asiento de cierre), con `closedAt`/`closedById`.
- `CANCELLED`: solo si **no hay** emisiones ni recibos (si los hay, hay que anularlos primero).

**Reversibilidad (tomada de Dynamics 365):** cada transición tiene su vuelta (`CLOSED → …` no se permite: se anula
el cierre con un asiento inverso declarado; `RELEASED → PLANNED`, `PLANNED → DRAFT`) y revertir **limpia los
efectos** de esa transición (reservas, costos previstos), nunca deja restos silenciosos.

### 3.2 Emisión para producción (documento propio, con parciales)

`ProductionIssue`: consume componentes reales a costo promedio del momento.
Líneas: artículo, almacén de origen, cantidad, lote/serie (obligatorio si el artículo los maneja), `unitCost`,
`totalCost`, dimensiones/proyecto. Una orden puede tener **N emisiones**; la suma no puede superar lo previsto
salvo **tolerancia declarada** (por defecto 0 % y aviso si excede).

### 3.3 Consumo de recursos

Dentro de la orden (no es un documento con serie): líneas de **recurso × cantidad real** (horas, unidades) que
copian los **componentes de costo** del recurso (snapshot: concepto, cuenta, tarifa) y generan el asiento
`Dr WIP / Cr cuenta del componente`. Se captura por operación (parte de horas) o a nivel de orden.

### 3.4 Recibo para producción (documento propio, con parciales)

`ProductionReceipt`: ingresa al almacén de destino el **producto terminado**, los **subproductos** y la **merma**.
Tipo de línea: `MAIN` | `BYPRODUCT` | `SCRAP`. Valorización:
- `MAIN`: al **costo real acumulado de la orden ÷ cantidad prevista** (ver §3.6), por unidad recibida (el kardex
  entra a ese costo y actualiza `Stock.avgCost`).
- `BYPRODUCT`: por el costo capturado (o 0 si no se valoriza) y **reduce** el costo a absorber por el principal.
- `SCRAP`: a la cuenta `Mermas y Desperdicios` (`Item.scrapAccountId`), sin valorizar existencia (no mueve kardex).

### 3.5 Receta y ruta (maestro compartido, ampliado)

- `ItemBom` se amplía con `lineNum`, `scrapPct` (merma prevista) y `operationNum?` (a qué operación se consume;
  opcional en fase 1, declarado).
- `ProductionOperation` (ruta del artículo padre): secuencia, nombre, **centro de trabajo**, **recurso**,
  `standardTimePerUnit` (min/unidad) y `setupTime` (min) → es la fuente del consumo previsto de recursos.
- **Explosión multinivel**: subensambles (un componente que a su vez tiene BOM) se explotan hasta artículos
  comprables o con existencia propia; los ciclos se detectan y fallan en voz alta.

### 3.6 Costeo real y desviaciones (D2)

```
costoRealAcumulado = Σ emisiones (cantidad × costo promedio)  +  Σ recursos (cantidad × tarifa del componente)
costoUnitarioPT    = costoRealAcumulado ÷ cantidad prevista de la orden
costoPrevisto      = snapshot del BOM (cantidad × costo del maestro) + recursos estándar (ruta)

# con parciales (implementado en la fase 4):
costoRealAcumulado = WIP vivo (ProductionOrder.actualCost) + Σ valor ya absorbido por los recibos vivos
valorDelRecibo     = cantidad MAIN recibida × costoUnitarioPT
```

- **El recibo valoriza el PT al costo real**: el inventario del terminado queda con ese costo promedio. La tasa se
  calcula sobre la **cantidad prevista** de la orden (no sobre lo ya recibido), así que **todos los parciales
  absorben la misma tasa**, el WIP nunca queda negativo y al recibir el lote completo lo absorbido iguala lo
  acumulado.
- **El WIP queda en cero al cerrar**: si tras recibir todo el WIP no es cero (merma no valorizada, ajustes,
  emisiones de más), el residuo se contabiliza contra `WIP_VARIANCE` (`Item.wipVarianceAccountId`) — es el
  comportamiento **verbatim de SAP B1** (ver la referencia §1.3), adaptado a costo real.
- **Desviaciones informativas** (reporte, no asiento): cantidad (emitido vs previsto), consumo (real vs BOM con
  merma), tiempo (real vs ruta), costo (real vs previsto) y merma. *Con costo real, la desviación de consumo no
  tiene asiento propio: se ve en el mayor costo unitario del PT*; queda declarado.

### 3.7 Contabilidad (cuentas y `EntryType` que YA existen)

| Momento | Asiento | Cuenta / EntryType |
|---|---|---|
| Emisión de componentes | `Dr WIP` · `Cr Inventario` (componentes a promedio) | `WIP` → `Item.wipAccountId` **del artículo fabricado**; `INVENTORY` (del componente) |
| Consumo de recursos | `Dr WIP` · `Cr cuenta del componente del recurso` | `WIP` + cuentas del maestro de recursos |
| Recibo de producto terminado | `Dr Inventario PT` · `Cr WIP` | `INVENTORY` (PT) / `WIP` (del artículo fabricado) |
| Subproducto | `Dr Inventario subproducto` · `Cr WIP` | `INVENTORY` |
| Merma | `Dr Mermas y Desperdicios` · `Cr WIP` | `SCRAP` → `Item.scrapAccountId` (`5.1.2.01.004`) |
| **Cierre con residuo** | `Dr/Cr WIP_VARIANCE` hasta dejar **WIP = 0** | `WIP_VARIANCE` → `Item.wipVarianceAccountId` |
| Anulación de emisión/recibo | reversa del asiento (T149: con fecha de contabilización elegible y 409 si el período está cerrado) | — |

Todas las cuentas se resuelven por **la misma jerarquía** del ERP (matriz artículo-almacén → artículo → grupo →
almacén → `AccountMapping`), y las líneas del asiento llevan `itemId`, `warehouseId`, `projectId` y
`dimension1..5`, como el resto de los documentos. La cuenta **WIP es una sola por orden** y es la del **artículo
fabricado** (SAP B1: *WIP Inventory Account* del artículo que se produce): lo que carga la emisión es exactamente lo
que acredita el recibo y lo que el cierre deja en cero (corrección de la fase 3, AUDIT **T154**).

**Invariante con test (backend y E2E):** al cerrar una orden, `Σ (Dr − Cr)` de las cuentas WIP de esa orden es
**exactamente 0** y la suma de las patas de cada asiento cuadra (`_assertBalanced`).

### 3.8 Kardex

Tipos nuevos de `StockMovementType`: `PRODUCTION_ISSUE`, `PRODUCTION_RECEIPT`, `PRODUCTION_SCRAP`,
`PRODUCTION_BYPRODUCT`, con FK al documento (`stockMovement.productionIssueId` / `productionReceiptId`) y el
`documentDate`/`reason` como el resto. La emisión **saca** cantidad (y valor) y el recibo **entra**; la merma sale
a la cuenta de mermas sin valorizar stock propio.

## 4. Modelo de datos (nuevo)

| Modelo | Campos clave |
|---|---|
| `WorkCenter` | tenant, code, name, branch?, `costPerHour`, `capacityPerHour?`, `absorptionAccountId?`, isActive |
| `Resource` | tenant, code, name, `type` (`LABOR`/`MACHINE`/`SERVICE`), `uomId` (hora/unidad), `fixedAssetId?` (solo MACHINE), isActive |
| `ResourceCostComponent` | resource, `lineNum`, `name`, `accountId`, `rate` (importe por unidad de recurso), `isActive` |
| `ProductionOperation` | `parentItemId` (ruta), `lineNum/sequence`, `name`, `workCenterId`, `resourceId`, `standardTimePerUnit`, `setupTime`, isActive |
| `ProductionOrder` | code+serie, status, `itemId`, `quantity`, `warehouseId` (destino), `componentsWarehouseId?`, branch, project, dimension1..5, date/postingDate, `expectedCost`, `actualCost`, `closedAt/ById`, `cancelled*/cancellationReason`, `transactionId` (asiento de cierre), `customFields`, `reason` |
| `ProductionOrderComponent` | orden, item, almacén, `quantityPlanned`, `quantityIssued`, `scrapPct`, `unitCostExpected`, `bomLineRef?` (snapshot) |
| `ProductionOrderOperation` | orden, secuencia, name, workCenter, resource, `timeStandard`, `timeReal`, `status`, `cost` |
| `ProductionOrderResource` (+ `…ResourceCost`) | orden, operación?, resource, `quantity`, y los componentes de costo copiados (cuenta + importe) |
| `ProductionIssue` + `ProductionIssueItem` | documento de emisión (serie, estado, anulación) y sus líneas |
| `ProductionReceipt` + `ProductionReceiptItem` | documento de recibo (serie, estado, anulación) con `lineType` `MAIN/BYPRODUCT/SCRAP` |
| `ItemBom` (ampliado) | `+ lineNum`, `+ scrapPct`, `+ operationNum?` |
| `Item` | `+ procurementMethod` (`MAKE`/`BUY`, SAP B1: *Procurement Method*): un artículo fabricado puede tener receta y ruta aunque **no** sea kit. Ya tenía `wipAccountId`, `wipVarianceAccountId`, `scrapAccountId`, `cost`, `costingMethod` |

**Series nuevas** (`DocumentType`): `PRODUCTION_ORDER` (prefijo propuesto `OP`), `PRODUCTION_ISSUE` (`EP`),
`PRODUCTION_RECEIPT` (`RP`), añadidas al catálogo canónico y al seed (28 → 31 tipos).
**Permisos nuevos**: `production-orders:view|create|release|close|cancel`, `production-issues:view|create|cancel`,
`production-receipts:view|create|cancel`, `work-centers:*`, `resources:*`.

## 5. Superficie a tocar

**Backend**
- `prisma/schema.prisma`: los 11 modelos/enums nuevos + ampliación de `ItemBom` + series/permisos; migración
  idempotente y `prisma migrate diff` sin diferencias.
- `src/common/accounting-entry-types.ts`: sin `EntryType` nuevos (ya están `WIP`, `WIP_VARIANCE`, `SCRAP`), pero sí
  el mapeo de los nuevos orígenes en `JournalSourceType` y `DocumentType`.
- `src/common/accounting/production.journal-builder.ts` + `AccountingEngineService.createProduction*JournalEntry`
  (emisión, recibo, recursos, cierre/anulación) con `_assertBalanced` y guarda de período por fecha de
  **contabilización** (T151).
- `src/production-orders/`, `src/production-issues/`, `src/production-receipts/`, `src/work-centers/`,
  `src/resources/` (module/controller/service/dto + specs) — **Fase 1**: `src/work-centers/`, `src/resources/` y
  `src/production-routes/` ya existen con sus specs (module/controller/service/dto).
- `src/items/items.service.ts`: kardex con los tipos nuevos y `sourceDoc` navegable; explosión multinivel de BOM.
- `src/common/bom-explosion.util.ts` (pura, testeada): explosión multinivel, merma, detección de ciclos y faltantes.
- `scripts/audit-flow-links.mjs`: **R16** (orden cerrada con WIP ≠ 0, emisión sin componentes previstos, recibo sin
  emisión, orden `IN_PROGRESS` sin movimientos).
- `prisma/seed.ts`: series nuevas, centros de trabajo/recursos de ejemplo y cuentas de los recursos idempotentes.

**Frontend**
- `pages/production-orders/` (listado con acciones de fila —columna `type: 'actions'`, T152— y formulario con
  pestañas: Componentes / Operaciones / Emisiones / Recibos / Costos y desviaciones).
- `pages/production-issues/` y `pages/production-receipts/` (listado + formulario con líneas, lote/serie y
  valorización).
- `pages/work-centers/`, `pages/resources/` (maestros, este último con la grilla de **componentes de costo**) y
  `pages/production-routes/` (ruta por artículo) — **Fase 1: hechas**, con los selectores reutilizables
  `app-work-center-selector` y `app-resource-selector`; el formulario de **Recetas (BOM)** gana merma, operación por
  componente y la sección de **explosión y faltantes**; el maestro de artículos expone el **método de
  aprovisionamiento** en la pestaña Producción.
- Ruta y entradas de menú en Inventario/Producción; etiquetas y rutas del kardex; selector de recurso/centro de
  trabajo; reportes de WIP y desviaciones.

**Documentación**: AUDIT (fila G3 al cerrar), AGENTS, CHANGELOGs, `matriz-flujos-documentos.md`,
`ACCOUNTING_ENTRIES_GUIDE.md` (asientos de producción), este plan y la referencia comparativa.

## 6. Fases y criterios de aceptación

### Fase 1 — Maestros (`WorkCenter`, `Resource`, `ResourceCostComponent`, ruta y BOM ampliado) — ✅ **IMPLEMENTADA (2026-09-19)**
- [x] CRUD completo con permisos, listados con acciones de fila y formularios LUNA. **Evidencia**: `/work-centers`,
      `/resources` y `/production-routes` (backend + pantallas), permisos `work-centers:*`, `resources:*` y
      `production-routes:*`; `audit:list-actions` en 100 tablas · 0 sin columna de acciones.
- [x] `Resource` de tipo `LABOR` con **tres componentes de costo** (sueldo, alimentación, ropa de trabajo) cada uno con
      su cuenta; validación: los componentes no pueden quedar sin cuenta; suma ≠ 0 para poder absorber. **Evidencia**:
      seed `MO-ENSAMBLE` con 3 componentes y el E2E `production-masters.e2e-spec.ts` (crea el recurso con 3 componentes,
      rechaza tarifa total 0, rechaza cuenta agrupadora).
- [x] Máquina como recurso `MACHINE` **enlazado a un Activo Fijo** (validación de existencia y tenant). **Evidencia**:
      E2E (400 sin `fixedAssetId`, 201 con el activo del tenant enlazado) + seed `MAQ-EMPAQUE` sobre `AF-EMPAQ-01`.
- [x] Ruta por artículo con operaciones, centro de trabajo, recurso y tiempos. **Evidencia**: `production-routes`
      (secuencia automática cada 10, recurso de otro centro rechazado, operación usada por una línea de BOM no se
      elimina) y su pantalla.
- [x] BOM ampliado con merma y `lineNum`; **explosión multinivel** con test unitario (ciclos, subensambles) y aviso de
      faltantes contra stock. **Evidencia**: 17 unitarios de `src/common/bom-explosion.util.ts`, `POST /item-boms/explode`
      y la sección «Explosión y faltantes» del formulario de recetas.
- [x] Gates: backend build/lint/`tsc`/jest; frontend lint/build/Karma/gates estáticos. **Evidencia**: backend
      **178 suites / 2087 tests** y **E2E 25 suites / 182 tests** (incluye la suite nueva `production-masters` 11/11),
      `build`/`lint`/los tres `tsc`/`audit:flows` (0 errores) y `db:recreate` con el seed nuevo; frontend **Karma
      1789/1789**, `build`/`lint`, `e2e:visual` **53/53** (baseline de `item-boms` regenerada y el resto intacto) y los
      gates estáticos (tokens, `!important`, `::ng-deep`, a11y, copy, dinero, densidad, `typecheck:e2e`, `format:check`).

**Decisiones tomadas al implementar la Fase 1** (declaradas, no silenciosas):
1. **`Item.procurementMethod`** (`MAKE`/`BUY`, SAP B1: *Procurement Method*) — el plan decía «`Item` sin campos nuevos»,
   pero la elegibilidad de receta/ruta necesita un flag propio: reutilizar `isKit` habría convertido en «kit» a un
   artículo fabricado. Un kit `ASSEMBLE_THEN_SELL` sigue pudiendo tener receta, así que **nada existente cambia**.
2. **La ruta vive en su propio módulo** (`production-routes`, permiso propio) en vez de colgar de `item-boms`: la ruta se
   administra por artículo y tiene sus propias operaciones.
3. **Subensamble con existencia se consume tal cual**: si la explosión encuentra un artículo intermedio del que ya hay
   existencia suficiente para el lote, **no** lo explota (si no, el aviso de faltantes pediría los componentes de algo que
   está en stock). Los que se consumieron así se devuelven en `consumedAsIsItemIds`.
4. **Cuentas nuevas `5.1.3 Costos de Producción`** (`5.1.3.01.001` Mano de Obra Directa, `.002` Beneficios al Personal,
   `.003` Carga Fabril, `.004` Variación de Productos en Proceso): el plan de cuentas no tenía ninguna cuenta de
   absorción productiva y los componentes de costo del recurso necesitan una cuenta de detalle real.

### Fase 2 — Orden de producción (sin ejecución) — ✅ **IMPLEMENTADA (2026-09-19)**
- [x] Alta con cabecera + componentes (snapshot del BOM con merma) + operaciones (snapshot de la ruta). **Evidencia**:
      `POST /production-orders` toma el snapshot del maestro del artículo (cantidad por unidad × cantidad de la orden
      con la merma de la receta, costo del maestro) y de la ruta (tiempo estándar del lote = minutos/unidad × cantidad
      + preparación, y costo previsto con la tarifa del recurso).
- [x] Estados `DRAFT/PLANNED/RELEASED` con sus permisos y **reversibilidad**; `expectedCost` congelado al planificar.
      **Evidencia**: `plan` (congela `expectedCost` y `plannedAt`), `release`, `revert` (solo hacia atrás:
      `RELEASED → PLANNED` retira la liberación y `PLANNED → DRAFT` **descongela** el costo previsto), `cancel` con
      motivo persistido (T153) y `DELETE` solo de borradores; permisos `production-orders:view|create|edit|release|cancel|delete`
      y serie **`OP`** (catálogo de 29 tipos).
- [x] Aviso de faltantes por componente (previsto vs disponible) sin bloquear el guardado. **Evidencia**: el detalle
      devuelve `analysis.components[]` con `available`/`missing`/`hasOwnRecipe` y `totals` (materiales, recursos,
      costo previsto y líneas con faltante); el E2E crea la orden **con** faltante (22 requeridas, 5 disponibles,
      17 faltantes) y el alta responde 201.
- [x] Listado con filtros, chip de estado y detalle; aislamiento por tenant y sucursal. **Evidencia**: listado con
      búsqueda + filtro de estado + artículo, badge de estado, y E2E de aislamiento por tenant (404); la pantalla de
      la orden tiene pestañas de datos, componentes, operaciones y costos/faltantes.
- Gates de la fase: backend **179 suites / 2103 tests** (**+16** de la orden) y **E2E 26 suites / 196 tests**
  (`test/production-orders.e2e-spec.ts` **14/14**), `build`/`lint`/los tres `tsc`/`audit:flows` (0 errores) y
  `db:recreate` con la serie **`OP`** (el catálogo canónico de series pasa a **29 tipos**: `Series de numeración:
  29 creadas / 29 tipos`); frontend **Karma 1797** (**+8** del listado de órdenes), `build` AOT con las dos pantallas,
  **`e2e:functional` 231 passed · 0 fallos · 3 skips** (30,0 min, 234 programados, sobre BD recreada) y
  **`e2e:visual` 53/53 sin regenerar nada** (la entrada nueva del menú lateral no movió ningún baseline), más los
  gates estáticos (tokens, `!important`, `::ng-deep`, a11y, copy, dinero, densidad, `typecheck:e2e`, `format:check`).

**Decisiones tomadas al implementar la Fase 2**:
1. **El snapshot es de nivel 1** (los componentes directos de la receta): el subensamble es otra orden —el aviso de
   faltantes marca con `hasOwnRecipe` los componentes que se fabrican—; la explosión multinivel del plan se usa en la
   pantalla de recetas y en el aviso, no para emitir.
2. **`objectType` sin `DEFAULT`** en la tabla (como G1/G2): PostgreSQL no permite usar un valor de enum recién añadido
   en el mismo script (`unsafe use of new value of enum type`).
3. **`revert` no es lo mismo que avanzar**: valida explícitamente las dos vueltas (`RELEASED→PLANNED`,
   `PLANNED→DRAFT`); `plan`/`release` son las que avanzan.
4. **El aviso de faltantes no bloquea** (decisión D1 del plan): es información para comprar o lanzar la orden del
   subensamble, y el alta responde 201 aunque falte existencia.

### Fase 3 — Emisión para producción — ✅ **IMPLEMENTADA (2026-09-19)**
- [x] Documento con serie, parciales, lote/serie obligatorio cuando el artículo lo maneja, y costo promedio real.
      **Evidencia**: `ProductionIssue` + líneas (serie **`EP`**, catálogo de 30 tipos) con **parciales** (el E2E emite 6
      de 22 previstas), costo promedio del momento (`Stock.avgCost` → 3 × 6 = 18), lote/serie validado con el helper
      compartido (`validateDocumentLineTracking`) y la línea ligada a la línea de componente de la orden.
- [x] Asiento `Dr WIP / Cr Inventario` con proyecto y dimensiones; kardex `PRODUCTION_ISSUE` navegable. **Evidencia**:
      builder propio (`production.journal-builder.ts`) con las cuentas resueltas por jerarquía (la WIP del maestro del
      artículo), asiento cuadrado comprobado en el E2E contra `1.1.3.03.001` / `1.1.3.01.001`, y el kardex del artículo
      muestra la emisión como **documento origen** (tipo `PRODUCTION_ISSUE`, con `PRODUCTION_ISSUE_CANCEL` en la
      reversa).
- [x] Reglas: no emitir más que lo previsto (tolerancia declarada), no emitir en orden no liberada, no emitir
      artículos que no son componentes de la orden. **Evidencia**: los tres rechazos con mensaje accionable (el del
      pendiente incluye previsto/emitido/pendiente) y la tolerancia de sobre-consumo declarada en **0 %**.
- [x] Anulación con reversa (T149: fecha de contabilización elegible y 409 atómico con el período cerrado).
      **Evidencia**: `POST /production-issues/:id/cancel` con motivo persistido (T153), par `CANCELLED`/`REVERSAL`
      medido en el E2E, stock y pendiente devueltos y orden de vuelta a `RELEASED`; la fecha de contabilización viaja
      por el `CancelDocumentDto` (la guarda de período es la del motor, T151).
- Gates de la fase: backend **180 suites / 2113 tests** (**+10** de la emisión) y **E2E 27 suites / 203 tests**
  (`test/production-issues.e2e-spec.ts` **7/7**), `build`/`lint`/los tres `tsc`/`audit:flows` en 0 errores y
  `db:recreate` con la serie **`EP`** (`Series de numeración: 30 creadas / 30 tipos`); frontend **Karma 1807**
  (**+10** del listado de emisiones), `build` AOT con las dos pantallas, **`e2e:visual` 53/53 sin regenerar nada** y
  **`e2e:functional` 231 passed · 0 fallos · 3 skips** sobre BD recreada.

**Decisiones tomadas al implementar la Fase 3**:
1. **La emisión se aplica al crearse** (`APPLIED`), como el Precio de Entrega y la Revalorización: la emisión es el
   acto físico; solo se puede **anular** con su reversa (no hay borrador ni edición).
2. **Tolerancia de sobre-consumo 0 %** (el plan la dejaba «declarada»): emitir más que el pendiente de la orden se
   rechaza con el pendiente en el mensaje; el exceso legitimo se resuelve modificando la orden o emitiendo una segunda.
3. **Al anular la última emisión la orden vuelve a `RELEASED`**: los estados son reversibles y revertir limpia el
   efecto (`IN_PROGRESS` lo puso la emisión), tal como Dynamics 365 describe para sus estados.
4. **El artículo componente necesita su cuenta WIP configurada** (maestro o matriz artículo-almacén): la resolución es
   estricta a nivel ITEM, así que un artículo sin `wipAccountId` responde **400 accionable** en vez de contabilizar a
   una cuenta inventada.

### Fase 4 — Recibo para producción (PT, subproductos y merma) — ✅ **IMPLEMENTADA (2026-09-19)**
- [x] Documento con parciales; el PT entra al **costo real acumulado** (kardex + `Stock.avgCost`).
      **Evidencia**: `ProductionReceipt` + líneas (serie **`RP`**, catálogo de 31 tipos) con **parciales** (el E2E
      recibe 4 de 10 y después 2 más), valorización a **costo real acumulado ÷ cantidad prevista** (200 de WIP ÷ 10 →
      20 la unidad; el kardex entra con ese costo y `Stock.avgCost` se recalcula por promedio ponderado).
- [x] Subproducto valorizado y merma contra `Mermas y Desperdicios`.
      **Evidencia**: línea `BYPRODUCT` valorizada al costo capturado (2 × 3 = 6, kardex `PRODUCTION_BYPRODUCT`) que
      **reduce** lo que absorbe el principal (40 − 6 − 2 = 32, 16 la unidad) y línea `SCRAP` contra
      `5.1.2.01.004` **sin** movimiento de kardex (medido: la existencia del artículo de la merma no cambia y no hay
      ningún `StockMovement` de esa línea).
- [x] Asiento `Dr Inventario PT / Cr WIP` (+ subproducto + merma) cuadrado y validado.
      **Evidencia**: builder propio (`production.journal-builder.ts`) con las cuentas resueltas por jerarquía y las
      patas deudoras **agrupadas por cuenta de destino** (PT + subproducto = 38 en inventario, merma = 2 en mermas) y
      un **único Haber al WIP del artículo fabricado** por el total (40), cuadrado y comprobado en el E2E.
- [x] Regla: no recibir más que la cantidad prevista (tolerancia declarada); anulación con reversa.
      **Evidencia**: sobre-recibo rechazado con el pendiente en el mensaje (previsto 10, recibido 4 → pendiente 6) y
      tolerancia declarada en **0 %**; sin línea `MAIN`, sin artículo del PT, con subproducto no inventariable, sin
      costo acumulado en el WIP y contra una orden no liberada también rechazados; anulación con el par
      `CANCELLED`/`REVERSAL`, stock y `avgCost` restituidos (104 → 100 y 50 exacto) y valor devuelto al WIP.
- Gates de la fase: backend **181 suites / 2126 tests** (**+13** del recibo) y **E2E 28 suites / 211 tests**
  (`test/production-receipts.e2e-spec.ts` **8/8**), `build`/`lint`/los tres `tsc`/`audit:flows` en 0 errores y
  `db:recreate` con la serie **`RP`** (`Series de numeración: 31 creadas / 31 tipos`); frontend **Karma 1817**
  (**+10** del listado del recibo), `build` AOT con las dos pantallas, **`e2e:visual` 53/53 sin
  regenerar nada** (séptimo hito: la entrada nueva del menú no movió ningún baseline) y
  **`e2e:functional` 231 passed · 0 fallos · 3 skips** sobre BD recreada. El kardex del PT devuelve el recibo como
  **documento origen navegable** (`sourceDoc.type = PRODUCTION_RECEIPT`, comprobado por API en el E2E y con la ruta
  del frontend en `SOURCE_DOCUMENT_ROUTE_MAP`).

**Decisiones tomadas al implementar la Fase 4**:
1. **El recibo se aplica al crearse** (`APPLIED`), como la emisión y el Precio de Entrega: es el acto físico del
   ingreso; solo se puede **anular** con su reversa (no hay borrador ni edición).
2. **El PT se valoriza a `costo acumulado ÷ cantidad prevista de la orden`**, donde el costo acumulado es el **WIP
   vivo** (`ProductionOrder.actualCost`, que los recibos van absorbiendo) **más lo ya absorbido** por los recibos
   vivos. Con parciales la tasa es **estable** (cada unidad recibida absorbe lo mismo), el WIP nunca queda negativo y
   al recibir el lote completo lo absorbido iguala lo acumulado; el residuo (merma no valorizada, ajustes) lo
   liquidará el cierre de la fase 6 contra la cuenta de variación.
3. **El subproducto y la merma valorizados reducen el Haber al WIP del principal**: el total que sale del WIP es
   `cantidad MAIN × tasa` y se reparte entre el inventario del PT, el del subproducto y la cuenta de mermas. Si la
   valorización capturada del subproducto y la merma supera el costo a absorber, el alta responde **400** en vez de
   dejar el PT en negativo.
4. **La merma no mueve existencia** (no genera kardex): su único efecto contable es el cargo a `Mermas y
   Desperdicios`; por eso el tipo `StockMovementType.PRODUCTION_SCRAP` del plan **no se añadió** (no habría uso) y
   queda declarado como decisión, no como olvido.
5. **Recibir exige costo acumulado**: si la orden no tiene WIP (ni emisiones ni consumos de recursos) el alta
   responde **400 accionable** —salvo que el ajuste «Permitir operaciones sin costo» esté activo—, en vez de ingresar
   el PT a costo cero en silencio.
6. **El WIP es el del artículo fabricado** (corrección de la Fase 3, AUDIT **T154**): el builder de la emisión
   resuelve la cuenta `WIP` con el artículo de la **orden**, no con el del componente, así que la instalación
   sembrada (WIP configurado en `PT-PC01`) puede emitir y el Dr de la emisión es exactamente el Cr del recibo.

### Fase 5 — Consumo de recursos — ✅ **IMPLEMENTADA (2026-09-20)**
- [x] Parte de horas/consumo por operación con **snapshot de los componentes de costo** del recurso.
      **Evidencia**: `ProductionOrderResource` + `ProductionOrderResourceCost` (no es un documento con serie: vive dentro
      de la orden) con endpoints `GET|POST /production-orders/:orderId/resources` y
      `POST …/:partId/cancel`; el alta **copia** concepto, cuenta y tarifa de los componentes activos del recurso
      (E2E: dos componentes → 80 + 20) y valora **tarifa × cantidad** (4 h × 25 = 100); el parte se imputa a una
      operación —o a la orden— y suma sus **minutos reales** (`cantidad × 60` por defecto, editable), con lo que la
      operación se cierra sola al alcanzar su tiempo estándar (240 → `IN_PROGRESS`, 300 ≥ 260 → `DONE`).
- [x] Asiento `Dr WIP / Cr cada cuenta del componente`; costo real acumulado actualizado.
      **Evidencia**: builder propio que agrupa las patas **por cuenta** y carga al WIP del **artículo fabricado** (una
      sola cuenta por orden); asiento medido en el E2E (`Dr WIP 100 · Cr 5.1.3.01.001 80 + Cr 5.1.3.01.002 20`) y el
      invariante del mayor (`Σ Debe − Haber` de la cuenta WIP con la regla del par revertido, T149) siguiendo a
      `actualCost` en todo el ciclo (100 → 125 → 25 → 0). El detalle de la orden publica además
      `analysis.actual` = materiales emitidos, recursos consumidos, absorbido por los recibos y **WIP vivo**.
- [x] Reglas: recurso activo, centro de trabajo coherente con la operación, tiempo > 0.
      **Evidencia**: cuatro rechazos 400 accionables medidos (recurso **inactivo**, recurso **sin componentes de costo
      activos**, operación que **no es de la orden** y recurso de **otro centro de trabajo** que el de la operación) más
      el rechazo de componentes con **tarifa cero** (no habría nada que valorizar).
- Gates de la fase: backend **182 suites / 2136 tests** (**+10** del consumo de recursos) y **E2E 29 suites / 218**
  (`test/production-resources.e2e-spec.ts` **7/7**), `build`/`lint`/los tres `tsc`/`audit:flows` en 0 errores y
  `db:recreate` aplicando la migración nueva **desde cero** (31 series, `migrate diff` sin residuo propio);
  frontend **Karma 1840** (**+23**), `build` AOT, `lint` 0/0, `audit:list-actions` **106/0**, **`e2e:visual` 53/53**
  (con **4 baselines regenerados con atribución medida** por la corrección **T155**) y
  **`e2e:functional` 231 passed · 0 fallos · 3 skips** sobre BD recreada.

**Decisiones tomadas al implementar la Fase 5**:
1. **El parte vive dentro de la orden** (el plan lo dice expresamente: no es un documento con serie): endpoints
   anidados bajo `/production-orders/:orderId/resources` y permisos `production-orders:view` (listar) y
   `production-orders:edit` (registrar y anular), sin estrenar acciones de permiso nuevas.
2. **La cantidad se interpreta en horas** salvo que el parte envíe `minutes` explícitos: los tiempos de la ruta están
   en minutos y la unidad que siembra el maestro es `HORA`. Límite declarado: con un recurso medido en otra unidad hay
   que enviar los minutos reales.
3. **El recurso debe ser del mismo centro de trabajo que la operación** cuando los dos lo tienen; sin operación no hay
   guarda (consumo a nivel de orden, previsto en el plan).
4. **La operación se cierra sola** (`DONE`) al alcanzar su tiempo estándar y vuelve a `PENDING` si la anulación deja el
   tiempo real en cero: el estado refleja el tiempo real, no una decisión aparte.
5. **Una sola regla de reversibilidad del estado de la orden** (`src/common/production-order-status.util.ts`): la orden
   vuelve a `RELEASED` solo cuando **no queda ninguna emisión, recibo ni parte vivo**. Antes la regla estaba duplicada
   en la emisión y el recibo; ahora las tres fases comparten la misma función (no puede divergir).
6. **El parte se aplica al crearse y solo se anula** (con motivo persistido y fecha de contabilización, T149), como la
   emisión y el recibo.
7. **Corrección de interfaz (AUDIT T155)**: al construir la pestaña se midió que **6 formularios** usaban
   `lunaSectionActions` en vez del slot real `[lunaFormSectionActions]`, así que su botón de «agregar línea» caía en el
   **cuerpo** de la sección en vez de su encabezado; los 6 quedaron corregidos con la atribución visual medida.

### Fase 6 — Cierre, desviaciones y reportes
- [ ] Cierre: liquida el WIP (**invariante WIP = 0** medido en el mayor), con `closedAt/ById` y asiento de cierre.
- [ ] Reporte de costo de la orden: previsto vs real por componente, recurso, tiempo y merma.
- [ ] Reporte de WIP por orden y de desviaciones por tipo.
- [ ] Detector **R16** en 0 errores y sus avisos declarados según los datos.

### Fase 7 — Reportes, E2E de UI y cierre
- [x] Pantallas de emisión y recibo con líneas, valorización en vivo y totales del documento.
      **Evidencia**: la pantalla de **emisión** se entregó con la Fase 3 y la de **recibo** con la Fase 4 (listado con
      filtros y acciones de fila —ver y anular— más el formulario con la grilla de líneas `MAIN`/`BYPRODUCT`/`SCRAP`,
      subtotales por tipo y total del documento). Desviación declarada del reparto original del plan: las pantallas se
      construyeron con su fase en vez de acumularlas aquí (misma decisión que en las fases 1–3), así que esta fase se
      queda con los reportes y el E2E de UI.
- [ ] Reportes en pantalla (WIP, desviaciones, costo de la orden) con exportación.
- [ ] E2E de UI de la orden (alta → liberar → emitir → recibir → cerrar) y de la emisión/recibo parcial.
- [ ] Gates completos: Karma, gates estáticos, `e2e:functional` sobre BD recreada, y backend E2E.
- [ ] Docs al día y commits sin acentos empujados a los tres repos.

## 7. Límites declarados (no se implementan en G3)

1. **Sin MRP ni APS** (D1): no hay necesidades por fecha, ni propuestas de compra/orden, ni nivelado de capacidad.
   Lo que sí hay: explosión de BOM y **aviso de faltantes** contra stock.
2. **Sin costo estándar ni desviaciones sistemáticas** (D2): el PT se valoriza al **costo real** de la orden; la
   desviación de consumo/tiempo se **reporta**, y a la contabilidad solo va el **residuo del WIP** al cerrar.
3. **Sin `Backflush` en fase 1**: la emisión es **manual** (con el consumo real). El backflush automático —y su
   restricción de lote/serie, que SAP documenta— queda como fase posterior.
4. **Subcontratación, capacidad finita, multi-planta y simulación de escenarios**: fuera de alcance.
5. **Mano de obra por tarifa del recurso**, no por liquidación de nómina: el ERP no tiene módulo de sueldos; el
   costo entra por los **componentes de costo del recurso** (tu ejemplo: alimentación, ropa de trabajo, sueldo).
6. **`JournalEntryLine` no tiene `costCenterId`**: los recursos se imputan por `projectId` y `dimension1..5` /
   `distributionRuleId`. Si se quiere el centro de costo en la línea del asiento, hay que **añadir la columna**
   (sub-tarea declarada, no incluida en fase 1).
7. **`AssemblyOrder` no se migra**: el ensamblaje de un paso sigue siendo su documento; producción es el ciclo
   completo. La convergencia (ensamblaje como caso simplificado de la orden) queda para una fase posterior.
8. **Sin `phantom item`** en fase 1: los subensambles se explotan por BOM; el artículo fantasma (no inventariable,
   solo estructura) se declara como mejora posterior.

## 8. Preguntas menores con valor por defecto (se implementan así salvo indicación)

| Tema | Valor por defecto propuesto |
|---|---|
| Prefijos de serie | `OP` (orden), `EP` (emisión), `RP` (recibo) |
| Tolerancia de sobre-consumo / sobre-recibo | 0 % con **aviso**; el exceso requiere confirmación explícita |
| Merma | Capturada en el recibo por línea (`SCRAP`); la merma **prevista** vive en `ItemBom.scrapPct` |
| Subproductos | Artículos del maestro (`canBeInventoried`), valorizados al costo capturado |
| Costo del PT | Costo real acumulado ÷ cantidad recibida `MAIN` (redondeo con el canon de dinero) |
| Cierre | Bloqueado si hay operaciones abiertas o emisiones sin recibo; el residuo va a `WIP_VARIANCE` |
| Fecha por defecto | Día del tenant (`tenantToday()`), como todo el ERP |
