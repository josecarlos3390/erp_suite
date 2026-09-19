# Plan G3 — Módulo de Producción (Órdenes de Producción, emisión/recibo y WIP)

> **Estado:** APROBADO por el usuario el 2026-09-19 (D1–D4) y **Fases 1 y 2 implementadas y verificadas**
> (maestros, BOM multinivel con explosión y faltantes, y la orden de producción con snapshot, estados reversibles y
> costo previsto congelado; backend y UI); las Fases 3–7 siguen pendientes.
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
- `MAIN`: al **costo real acumulado de la orden** hasta ese momento, por unidad recibida (el kardex entra a ese
  costo y actualiza `Stock.avgCost`).
- `BYPRODUCT`: por el costo capturado (o 0 si no se valoriza) y **reduce** el costo a absorber por el principal.
- `SCRAP`: a la cuenta `Mermas y Desperdicios` (`Item.scrapAccountId`), sin valorizar existencia.

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
costoUnitarioPT    = costoRealAcumulado ÷ cantidad recibida MAIN
costoPrevisto      = snapshot del BOM (cantidad × costo del maestro) + recursos estándar (ruta)
```

- **El recibo valoriza el PT al costo real**: el inventario del terminado queda con ese costo promedio.
- **El WIP queda en cero al cerrar**: si tras recibir todo el WIP no es cero (merma no valorizada, ajustes,
  emisiones de más), el residuo se contabiliza contra `WIP_VARIANCE` (`Item.wipVarianceAccountId`) — es el
  comportamiento **verbatim de SAP B1** (ver la referencia §1.3), adaptado a costo real.
- **Desviaciones informativas** (reporte, no asiento): cantidad (emitido vs previsto), consumo (real vs BOM con
  merma), tiempo (real vs ruta), costo (real vs previsto) y merma. *Con costo real, la desviación de consumo no
  tiene asiento propio: se ve en el mayor costo unitario del PT*; queda declarado.

### 3.7 Contabilidad (cuentas y `EntryType` que YA existen)

| Momento | Asiento | Cuenta / EntryType |
|---|---|---|
| Emisión de componentes | `Dr WIP` · `Cr Inventario` (componentes a promedio) | `WIP` → `Item.wipAccountId`; `INVENTORY` |
| Consumo de recursos | `Dr WIP` · `Cr cuenta del componente del recurso` | `WIP` + cuentas del maestro de recursos |
| Recibo de producto terminado | `Dr Inventario PT` · `Cr WIP` | `INVENTORY` (PT) / `WIP` |
| Subproducto | `Dr Inventario subproducto` · `Cr WIP` | `INVENTORY` |
| Merma | `Dr Mermas y Desperdicios` · `Cr WIP` | `SCRAP` → `Item.scrapAccountId` (`5.1.2.01.004`) |
| **Cierre con residuo** | `Dr/Cr WIP_VARIANCE` hasta dejar **WIP = 0** | `WIP_VARIANCE` → `Item.wipVarianceAccountId` |
| Anulación de emisión/recibo | reversa del asiento (T149: con fecha de contabilización elegible y 409 si el período está cerrado) | — |

Todas las cuentas se resuelven por **la misma jerarquía** del ERP (matriz artículo-almacén → artículo → grupo →
almacén → `AccountMapping`), y las líneas del asiento llevan `itemId`, `warehouseId`, `projectId` y
`dimension1..5`, como el resto de los documentos.

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

### Fase 3 — Emisión para producción
- [ ] Documento con serie, parciales, lote/serie obligatorio cuando el artículo lo maneja, y costo promedio real.
- [ ] Asiento `Dr WIP / Cr Inventario` con proyecto y dimensiones; kardex `PRODUCTION_ISSUE` navegable.
- [ ] Reglas: no emitir más que lo previsto (tolerancia declarada), no emitir en orden no liberada, no emitir
      artículos que no son componentes de la orden.
- [ ] Anulación con reversa (T149: fecha de contabilización elegible y 409 atómico con el período cerrado).

### Fase 4 — Recibo para producción (PT, subproductos y merma)
- [ ] Documento con parciales; el PT entra al **costo real acumulado** (kardex + `Stock.avgCost`).
- [ ] Subproducto valorizado y merma contra `Mermas y Desperdicios`.
- [ ] Asiento `Dr Inventario PT / Cr WIP` (+ subproducto + merma) cuadrado y validado.
- [ ] Regla: no recibir más que la cantidad prevista (tolerancia declarada); anulación con reversa.

### Fase 5 — Recursos
- [ ] Parte de horas/consumo por operación con **snapshot de los componentes de costo** del recurso.
- [ ] Asiento `Dr WIP / Cr cada cuenta del componente`; costo real acumulado de la orden actualizado.
- [ ] Reglas: recurso activo, centro de trabajo coherente con la operación, tiempo > 0.

### Fase 6 — Cierre, desviaciones y reportes
- [ ] Cierre: liquida el WIP (**invariante WIP = 0** medido en el mayor), con `closedAt/ById` y asiento de cierre.
- [ ] Reporte de costo de la orden: previsto vs real por componente, recurso, tiempo y merma.
- [ ] Reporte de WIP por orden y de desviaciones por tipo.
- [ ] Detector **R16** en 0 errores y sus avisos declarados según los datos.

### Fase 7 — Frontend completo y cierre
- [ ] Pantallas de emisión y recibo con líneas, valorización en vivo y totales del documento.
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
