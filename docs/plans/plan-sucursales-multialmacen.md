# Dos circuitos para una empresa con 3 sucursales — reconocimiento y plan

> **Estado**: reconocimiento medido el **2026-11-08** sobre `erp_suite` (backend `9e3a2c04`,
> frontend `9d874df6`). Nada de este documento es suposición: cada fila se midió en el esquema
> Prisma y en los DTO/controladores de informes, y se cita el fichero.
>
> **Objetivo del ejercicio**: una empresa con **3 sucursales** quiere (a) **informes de ventas**
> separados por punto de venta y (b) **informes contables** separados por punto de venta. Se
> prueban dos formas de modelarlo y se compara.

---

## 1. Los dos circuitos

| | **Circuito A — una sucursal, tres almacenes** | **Circuito B — tres sucursales** |
|---|---|---|
| Sucursal (`Branch`) | **1** | **3** |
| Almacén (`Warehouse`) | **3**, uno por punto de venta (`Warehouse.branchId` → la única sucursal) | **3**, uno por sucursal (`Warehouse.branchId` → su sucursal) |
| Separación de **ventas** | por **almacén** | por **sucursal** (y por almacén, que es 1:1) |
| Separación **contable** | por **centro de costo** (eje analítico `DimensionConfig` + `CostCenter`) | por **sucursal** (`JournalEntryLine.branchId`) |
| Series de numeración | **una** (`DocumentSeries.branchId` de la única sucursal) | **una por sucursal** |
| Usuarios | todos con la misma sucursal por defecto | cada uno con la suya (`User.defaultBranchId`) |

## 2. Lo que el modelo YA soporta (medido)

| Pieza | Dónde | Veredicto |
|---|---|---|
| Sucursal en el documento | `SaleInvoice.branchId` (`schema.prisma:4377`), obligatorio por `resolveDocumentBranchId` | ✅ |
| Almacén por sucursal | `Warehouse.branchId` (`schema.prisma:405`) | ✅ |
| Almacén en la cabecera y en la **línea** | `SaleInvoice.warehouseId` (4371) y `SaleInvoiceItem.warehouseId` (4522) | ✅ |
| Centros de costo | `DimensionConfig.isCostCenterAxis` (2419) + `CostCenter` (2427) | ✅ |
| Reparto por centro de costo **en la línea** | `SaleInvoiceItem.dimension1..5` (4534-4552) | ✅ |
| Reparto por centro de costo **en el asiento** | `JournalEntryLine.dimension1..5` (8663-8667) | ✅ |
| Sucursal en el asiento | `JournalEntryLine.branchId` (8645) | ✅ |
| Informe contable **por centro de costo** | `GET /reports/cost-centers` (`dimensionNumber`, `costCenter`) | ✅ **existe** |

## 3. Lo que **NO** existe (y es lo que bloquea el ejercicio tal como se planteó)

| Necesidad | Endpoint actual | Estado |
|---|---|---|
| **Ventas por almacén** | `GET /reports/sales` (`reports.controller.ts:91`): `from`, `to`, `partnerId`, `itemId`, `groupBy ∈ {month, partner, item}`, página | ❌ sin `warehouseId`, sin `groupBy=warehouse` |
| **Ventas por sucursal** | idem | ❌ sin `branchId`, sin `groupBy=branch` |
| **Contabilidad por sucursal** | `GET /reports/journal`, `/trial-balance`, `/general-ledger`, `/income-statement`: `from`, `to`, `accountId` | ❌ sin `branchId` |
| **Costos por centro de costo, acotado a una sucursal** | `GET /reports/cost-centers`: `from`, `to`, `dimensionNumber`, `costCenter`, `accountId` | ⚠️ funciona, pero **no** se puede acotar por sucursal |
| Listado de facturas por **almacén** | `GET /sale-invoices`: sí `branchId` (`controller:392`), **no** `warehouseId` | ⚠️ parcial |

> **Consecuencia medida**: hoy el Circuito **B** no se puede informar por los endpoints de
> informes (solo filtrando el listado de facturas por `branchId` y sumando en el cliente), y el
> Circuito **A** no se puede informar de ventas por almacén de ninguna forma (el listado tampoco
> filtra por almacén). Sin tocar los informes, el ejercicio se reduce a leer tablas a mano.

## 4. Plan propuesto (en este orden)

### Fase 1 — Cerrar el hueco de informes (producto)
1. `GET /reports/sales`: añadir `branchId`, `warehouseId` y `groupBy ∈ {branch, warehouse}`
   (además de los tres actuales).
2. `GET /reports/trial-balance`, `/journal`, `/income-statement`: añadir `branchId`.
3. `GET /reports/cost-centers`: añadir `branchId` (para el Circuito A acotado).
4. `GET /sale-invoices`: añadir `warehouseId` (coherencia con el informe).
5. Tests: unitarios de los filtros + un caso de integración que compare el informe contra la
   suma de las líneas (invariante), y sus marcas `fixture-medido`.

### Fase 2 — Los dos circuitos, automatizados
Un guion reproducible (`backend-erp/scripts/` o `test/`) que, sobre la base de **test**:
- **A**: crea 1 sucursal, 3 almacenes, 3 centros de costo; emite 2 facturas por almacén con su
  centro de costo; comprueba (i) ventas por almacén, (ii) costos/ingresos por centro de costo,
  (iii) que **no** se mezclan entre almacenes.
- **B**: crea 3 sucursales con su almacén y su serie; emite 2 facturas por sucursal; comprueba
  (i) ventas por sucursal, (ii) balance y resultado por sucursal, (iii) que el asiento lleva
  `branchId` correcto y que **no** se mezcla.
- Ambos con **importes asertados** (no "no falló").

### Fase 3 — Informe comparativo (documento)
`docs/reference/sucursales-vs-almacenes-comparativa.md` con: ventajas, desventajas, coste
operativo (series, usuarios, cierres, traslados entre almacenes), riesgos (contabilidad
mezclada, informes que no existen, numeración), límites medidos y **recomendación**.

## 5. Decisiones que hay que tomar antes de la Fase 1

- **¿Se añaden los filtros a los informes** (recomendado: sin ellos el ejercicio se reduce a
  sumar listados a mano y la comparación no sería la del ERP real)?
- ¿O se hace el ejercicio **sólo con lo que existe**, aceptando que "ventas por almacén" se
  obtiene sumando el listado de facturas y que la contabilidad por sucursal se lee del mayor
  sin filtro?
