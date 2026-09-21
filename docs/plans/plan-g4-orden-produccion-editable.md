# Plan — G4: orden de producción editable (componentes, operaciones, recursos y fechas)

> **Estado:** aprobado por el usuario el **2026-09-21** e **implementado (F1–F4)** el 2026-09-21; la **orden de
> ensamblaje** queda declarada como documento **legacy de kits** (decisión de este frente); el **recurso se declara por
> operación** en la orden y los partes de horas solo usan los recursos declarados.
> Origen: al revisar el frente de cuentas editables el usuario preguntó por qué la orden de ensamblaje no tiene grilla de
> líneas editable y si tenemos la facilidad de SAP B1 en la **orden de fabricación**: rellenar la cabecera con las fechas
> del ciclo, **jalar la lista de materiales** preconfigurada y, **sobre esa receta en la orden**, quitar o añadir otros
> artículos, recursos o máquinas.

---

## 1. Qué hay hoy (auditoría medida, 2026-09-21)

| Documento | Estado real |
|---|---|
| **Orden de producción** (equivalente al *Production Order* de SAP B1) | Al crear hace **snapshot** de la receta (`ProductionOrderComponent`: `quantityPlanned` con merma, `quantityIssued`, `scrapPct`, `unitCostExpected`, `operationNum`, `bomLineId`) y de la ruta (`ProductionOrderOperation`: `workCenterId`, `resourceId`, `timeStandard`, `setupTime`, `cost`, `status`). La cabecera tiene `date`, `postingDate` y `dueDate` (**no** hay fecha de inicio de fabricación). La pestaña **Componentes** es un **análisis de solo lectura** (`production-orders-form.component.html:263-283`) y **Operaciones** también. El `PATCH` solo acepta cantidad, almacenes, proyecto, fecha de entrega, notas y UDF (`update-production-order.dto.ts:35-107`); si cambia la cantidad o el almacén de componentes **borra y rehace** el snapshot de la receta (`production-orders.service.ts:519-520`). Editar solo se permite en `DRAFT` (`_assertStatus(id, tenantId, ['DRAFT'], 'editar')`) y `plan()` congela el **costo previsto**. |
| **Recursos y máquinas** | El recurso entra por **parte de horas** (`ProductionOrderResource` + componentes de costo) contra una operación; la validación actual exige que la operación sea de la orden y que el recurso sea **del mismo centro de trabajo**, pero **no** que sea el recurso declarado en la operación (`production-resources.service.ts:137-163`). |
| **Orden de ensamblaje** | Documento **legacy de kits**: carga la receta del kit en una tabla de **solo lectura** (`assembly-order-form.component.html:105-138`, sin `FormArray`) y el servicio consume **exactamente** las líneas de `ItemBom` (`assembly-orders.service.ts:198`); lo único capturable por componente es lote/serie y la cuenta de inventario (P4). No acepta componentes propios ni recursos/máquinas. |

**Conclusión:** la facilidad de SAP B1 que el usuario describe (editar la receta **dentro de la orden**) **no existe** hoy;
la receta se edita en el maestro y la orden la copia congelada.

---

## 2. Alcance aprobado

### F1 — Componentes editables en la orden (en `DRAFT` y `PLANNED`)

- **Contrato del `PATCH /production-orders/:id`** (nuevo campo opcional; si no viene, el comportamiento actual no cambia):
  ```ts
  components?: Array<{
    id?: number | null;        // línea existente del snapshot (conserva bomLineId y quantityIssued)
    itemId: number;            // artículo componente
    quantityPlanned: number;   // > 0 (cantidad para el lote completo, ya con la merma que el usuario fije)
    scrapPct?: number | null;  // 0..100
    warehouseId?: number | null;
    operationNum?: number | null; // debe existir entre las operaciones de la orden
    notes?: string | null;
  }>;
  ```
  - **Semántica:** el conjunto enviado **reemplaza** el snapshot de componentes (las líneas ausentes se borran, las
    presentes con `id` se actualizan conservando su `bomLineId`, y las nuevas entran con `bomLineId = null` =
    **añadida a mano** y `lineNum` correlativo 10/20/30…).
  - **Validaciones (400 accionable):** artículo existe, maneja inventario y **no** es el artículo fabricado; cantidad > 0;
    merma 0–100; almacén de la sucursal; `operationNum` existente; **y ninguna línea con `quantityIssued > 0`** (si la
    orden ya emitió, no se editan componentes).
  - **Estados:** `DRAFT` (como hoy) **y `PLANNED`**; al editar en `PLANNED` se **recalcula y vuelve a congelar** el costo
    previsto (`expectedCost`) porque la receta cambió. `RELEASED`/`IN_PROGRESS`/`CLOSED` → 400 con el motivo.
  - **Trazabilidad:** cada línea recuerda si vino de la receta (`bomLineId`) o es manual; el detalle publica ese dato.
- **Reponer la receta:** botón **«Traer receta»** en la pestaña Componentes, que llama al endpoint existente de
  explosión (`POST /item-boms/explode`, que ya aplica merma multinivel y devuelve faltantes) y reemplaza las líneas; y
  **quitar/añadir** línea a mano.

### F2 — Operaciones editables en la orden (`DRAFT` y `PLANNED`)

- **Contrato:** `operations?: Array<{ id?: number | null; name: string; workCenterId?: number | null; resourceId?: number | null;
  setupTime?: number; timeStandard?: number; notes?: string | null }>` con la misma semántica de reemplazo.
- **Validaciones:** centro de trabajo y recurso activos y del tenant; el recurso pertenece al centro de trabajo; tiempos
  ≥ 0; **no se puede quitar una operación referenciada por un componente** ni con partes de horas.
- El **costo de la operación** (`Σ tarifa × tiempo` de los componentes de costo del recurso) se recalcula al editarla, y
  con él el costo previsto cuando la orden está en `PLANNED`.

### F3 — Recurso declarado por operación

- La operación declara su `resourceId` (F2 lo hace editable en la orden) y **los partes de horas solo aceptan ese
  recurso** cuando está declarado (400 accionable); si la operación no declara recurso, sigue valiendo la regla actual
  (recurso del mismo centro de trabajo). La **máquina** es un recurso `MACHINE` (ya existe, ligado al Activo Fijo).

### F4 — Fecha de inicio de fabricación

- Nueva columna `ProductionOrder.startDate` (migración idempotente), en el alta y en el `PATCH`, con la validación
  `startDate <= dueDate`; la fecha del documento (`date`) y la de contabilización siguen como están. Se publica en el
  detalle, el listado y el formulario.

### Ensamblaje (declaración, sin cambios de código)

- La **orden de ensamblaje** se declara **documento legacy de kits** (armar/desarmar): sus componentes son la receta del
  kit y no se editan en el documento. Queda escrito en el plan, el ROADMAP y la razón de la excepción del gate
  `audit:line-accounts`.

---

## 3. Fases y criterios de aceptación

| Fase | Alcance | Criterio de aceptación (medido) |
|---|---|---|
| **F1** | Componentes editables + «Traer receta» + rechazos | Una orden en borrador **quita** un componente, **añade** uno manual (`bomLineId = null`) y **cambia** cantidades; el guardado persiste; `plan()` congela el costo con el conjunto nuevo; una orden `RELEASED` o con emisiones **rechaza** el cambio con 400; la emisión posterior solo ofrece los componentes de la orden |
| **F2** | Operaciones editables | Se agrega/quita/cambia una operación en borrador con su centro de trabajo, recurso y tiempos; el costo de la operación y el previsto se recalculan; quitar una operación **usada por un componente** o con partes → 400 |
| **F3** | Recurso por operación | Un parte de horas con un recurso **distinto del declarado** → 400 accionable; con el declarado → asiento normal |
| **F4** | Fecha de inicio | `startDate` viaja en alta/edición/detalle/listado; `startDate > dueDate` → 400 |
| **Cierre** | Gates y documentación | tsc, jest (unit + E2E de la familia), Karma, `e2e:functional` y `e2e:visual` (con atribución medida), AUDIT/CHANGELOG/ROADMAP/AGENTS/plan y commits con push |

---

## 4. Límites declarados

1. **No hay MRP/APS** (sigue el límite de G3): editar la receta en la orden no planifica compras; el aviso de faltantes
   se recalcula y se muestra.
2. La edición de componentes/operaciones vive en `DRAFT` y `PLANNED`; una orden `RELEASED` debe **volver a planificada**
   o a borrador (transición que ya existe y es reversible) para cambiarla.
3. El **ensamblaje** no se migra: es el documento de kits.
4. Las líneas manuales de la orden **no** se escriben en el maestro del artículo (la orden es un snapshot propio, como en
   SAP B1).

---

## 5. Estado de la implementación (2026-09-21)

**Decisiones de implementación (documentadas; ninguna cambia el contrato de §2):**

1. **El `PATCH` completo se permite en `PLANNED`**, no solo `components`/`operations`: si se edita la cantidad de la orden
   en planificada, el **costo previsto se recalcula y se vuelve a congelar** (es el mismo criterio del plan para la
   receta). Consecuencia: la aserción E2E preexistente «no edita una orden planificada» se reescribió —el rechazo se mide
   ahora contra `RELEASED` y `CLOSED`— y el E2E nuevo afirma el recongelado.
2. **`quantityPlanned` se guarda tal cual la manda el usuario** (no se le vuelve a aplicar el `scrapPct` de la receta:
   el porcentaje viaja en la línea y la UI lo muestra); `unitCostExpected` se refresca del costo del maestro en cada
   reemplazo.
3. **Precedencia de las guardas de F3**: primero la regla del **mismo centro de trabajo** (comportamiento de G3 intacto)
   y después la del **recurso declarado**; el mensaje «la operación N declara el recurso X» aparece cuando el recurso es
   del centro de la operación pero distinto del declarado.
4. **Referencias componente → operación**: se validan **al cerrar el conjunto** de operaciones, así que quitar una
   operación referenciada por un componente da 400 nombrando componente y operación, y también se rechaza asignar a mano
   una operación inexistente.
5. **`startDate` también viaja en el listado** (columna «Inicio fab.» en el listado de órdenes, además de la cabecera y el
   detalle).
6. La **orden de ensamblaje** se declara documento legacy de kits: su razón quedó escrita en la excepción del gate
   `audit:line-accounts` (frontend) y en el ROADMAP.

**Evidencia de la implementación (medida):** `npx tsc --noEmit` (proyecto y E2E) sin salida; **jest 183 suites / 2187
tests** (14 unitarios nuevos en la orden y 2 en los partes); **E2E 31 suites / 251 tests** (2 nuevos y 1 reescrito en
`production-orders`, 1 nuevo en `production-resources`); **Karma 1991/1991** (12 unitarios nuevos del formulario);
`audit:line-accounts` en 0 en las dos apps, `audit:money:check` del backend en **0** (ver nota) y el resto de los gates
estáticos en verde. **Nota de deuda cerrada en esta ronda:** el gate de dinero del backend estaba **rojo en HEAD**
(R1: 0→1 y R2c: 0→4, deuda de G1/G3 en `landed-costs` y `production-reports`, archivos ajenos a G4): se cerró
sustituyendo el épsilon `Math.abs(x) > 0.005` por `isZeroMoney` (medida a centavo) y declarando con `toFixed-ok` los
cuatro `.toFixed(2)` que son **serialización** de un `Prisma.Decimal` en la respuesta del API (redondeo decimal, no
aritmética).
