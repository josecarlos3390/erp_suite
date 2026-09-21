# Plan — Centros de costo, dimensiones y normas de reparto

> **Estado:** propuesto el **2026-09-21** (petición del usuario: «hacer un plan después para adicionar o integrar los
> centros de costo para utilizar normas de reparto […] y así poder generar informes por centros de costo y normas de
> reparto»). **C0 RESUELTO (2026-09-21): opción C aprobada por el usuario** —ver §2.1—; **C1 RESUELTO (2026-09-21)** —ver
> §3.1—; **C2 RESUELTO (2026-09-21)** —ver §3.2, con C2-UI (§3.3) pendiente—; C3–C4 pendientes de ejecución.
> Relacionado: `plan-cuentas-contables-editables.md` (la cuenta de la línea viaja por el mismo camino que el centro de
> costo: `BaseLineItemDto` → documento → asiento → informe).

---

## 0. Decisión del usuario (C0, 2026-09-21)

| Pregunta | Decisión |
|---|---|
| **Opción de diseño** | **C** — reutilizar el **eje** (sin columna nueva), **validar** el valor contra el maestro de centros de costo y **extender el reparto a los asientos generados por documentos**. Se descarta la FK `costCenterId` en documentos y asiento (duplicaría el concepto y apartaría del modelo SAP B1 que el ERP sigue). |
| **Norma de reparto** | Se **captura por línea**, **opcional**: si no se captura, la línea se contabiliza entera como hoy con su dimensión; si se captura, se expande en N líneas (una por centro de costo) con el importe prorrateado. |
| **Qué eje es «Centro de costo»** | *Adoptado por recomendación (revisable en C1):* un ajuste **explícito** en la configuración de dimensiones («eje de centros de costo»), con el **nombre** del eje como valor por defecto para las instalaciones existentes. |
| **Qué muestran los informes** | *Adoptado por recomendación (revisable en C3):* las dos cosas — el **importe original** de la línea del documento y el **reparto efectivo** del asiento, con una columna «repartido en N centros». |


---

## 1. Qué existe hoy (auditoría medida, 2026-09-21)

| Pieza | Estado real |
|---|---|
| **Ejes analíticos** | `DimensionConfig` (`schema.prisma:2361`): **5 ejes** por tenant, con **nombre visible** y `enabled`. Se administran en «Configuración de Dimensiones» (`pages/settings/dimensions-config.component.ts`, sección «Renombrar y habilitar dimensiones»). Por defecto los cinco nacen **deshabilitados** (`getOrCreateDefaults`). |
| **Centros de costo** | `CostCenter` (`schema.prisma:2374`): maestro con `code`, `name`, `status` y **`dimensionNumber`** — es decir, **un centro de costo es un valor de uno de los 5 ejes**, exactamente como SAP B1 (donde los *Cost Centers* son valores de las *Dimensions*). |
| **Dónde se capturan** | En los formularios, un eje se captura con `app-cost-center-selector` alimentado por los centros de costo **de ese eje** (`purchase-orders-form.component.html:730-761`, y ahora también en la orden de producción tras **T160**). En el API, `dimension1..5` viajan en `BaseLineItemDto` (líneas comerciales y de stock) y en las cabeceras de los documentos. |
| **Normas de reparto** | `DistributionRule` + `DistributionRuleLine {costCenterId, percentage}` (`schema.prisma:2393-2419`), administradas en la **misma** pantalla de dimensiones. **Sí se aplican**: `journal-entries.service.ts` expande una línea con `distributionRuleId` en **una línea por centro de costo** con el importe prorrateado (`_expandDistributionRules`, el reparto se hace en `Decimal`, último tramo cuadrado contra el total) y escribe el **código del centro de costo** en la dimensión del eje de la regla (`dimension${rule.dimensionNumber}`). |
| **Límite medido** | Esa expansión vive **solo en el asiento contable manual** (y en el camino de plantillas). Los asientos que genera un **documento** (factura, salida de stock, emisión, etc.) **no** aplican normas de reparto: sus líneas llevan `dimension1..5` capturadas a mano, sin reparto. |
| **Informes** | El libro mayor guarda por línea `projectCode`, `dimension1..5` y `distributionRuleId`, así que **la información está**; lo que no hay es un informe que agrupe **por centro de costo** ni por **norma de reparto**. |

---

## 2. La decisión de diseño (3 opciones)

**Opción A — Reutilizar el eje (sin cambios de esquema).** El centro de costo **es** el valor de la dimensión que el
tenant haya configurado como «Centro de costo». Se captura en la línea con el selector del eje, se guarda en
`dimensionN` (texto, igual que hoy) y los informes **agrupan por ese texto**. La norma de reparto se aplica al
contabilizar y materializa **varias líneas** (ya funciona así en el asiento manual).
*Coste:* 0 migraciones, coherente con SAP B1 y con lo que ya existe. *Límite:* el informe por centro de costo depende de
que el eje esté bien nombrado y de que el valor capturado sea un código válido del maestro (hoy es texto libre).

**Opción B — Columna nueva `costCenterId` en documentos y asiento.** FK explícita al maestro en las líneas de documento
y en `JournalEntryLine`.
*Coste:* migración en ~20 tablas + backfill + cambios en 8 builders + todas las grillas. *Beneficio:* integridad
referencial y un informe trivial; *contra:* duplica el concepto (el mismo centro de costo quedaría en `dimensionN` **y**
en `costCenterId`) y se aparta del modelo SAP B1 que el ERP sigue en todo lo demás.

**Opción C (APROBADA por el usuario el 2026-09-21) — A + validación y reparto también en documentos.**
1. **Captura** en la línea con el eje configurado como centro de costo (opción A), **validando** que el valor sea un
   centro de costo **activo** del eje (si el eje tiene maestro, no se acepta texto libre).
2. **Norma de reparto por línea** (`distributionRuleId`, opcional) **también en los documentos**: el builder que arma el
   asiento llama al **mismo expandidor** que ya usa el asiento manual, de modo que una línea con reparto se contabiliza
   como N líneas (una por centro de costo), con el importe prorrateado y el código del centro en la dimensión del eje.
3. **Informes nuevos**: «Costos por centro de costo» y «Asientos con norma de reparto», agrupando por `dimensionN` /
   `distributionRuleId` (ya persistidos), con el mismo patrón de los reportes de producción (pantalla + CSV).
4. **Sin duplicar el concepto**: no se añade `costCenterId` a las líneas del asiento; el centro de costo sigue siendo un
   **valor del eje**, y si algún día se quiere la FK se puede materializar **como columna derivada** en una fase aparte.

---

## 3. Fases propuestas (opción C)

| Fase | Alcance | Criterio de aceptación |
|---|---|---|
| **C0** | **Decisión del usuario**: eje vs columna nueva (opciones A/B/C), el eje de centros de costo y si el reparto se captura | ✅ **RESUELTO (2026-09-21)**: opción **C**, reparto **capturado por línea (opcional)** y las dos recomendaciones (ajuste explícito del eje + informes que muestran el importe original y el reparto efectivo) adoptadas y anotadas en §0 |
| **C1** | **Validación del valor del eje**: si el eje tiene centros de costo activos, la línea solo acepta códigos del maestro (400 accionable con la línea); el formulario ya usa el selector | ✅ **RESUELTO (2026-09-21)**: ver §3.1 — `DimensionConfig.isCostCenterAxis` (ajuste explícito, único por empresa, con el nombre del eje como respaldo), `assertCostCentersInDimensions` en el **punto único** de todo documento que contabiliza (`AccountingEngineService._persist`) y la marca en la pantalla de Configuración de Dimensiones; medido en `test/cost-centers.e2e-spec.ts` **8/8** |
| **C2** | **Norma de reparto en documentos**: `distributionRuleId` opcional por línea + el expandidor compartido en los builders que hoy no reparten (ventas, compras, stock, producción) | ✅ **RESUELTO (2026-09-21)**: ver §3.2 — `distributionRuleId` por línea en los 15 modelos de línea que contabilizan (migración `20260921150000_line_distribution_rules`), expansión **en el punto único** (`_persist`) con el **mismo expandidor** que el asiento manual y medido en el mayor: `test/line-distribution-rules.e2e-spec.ts` **6/6** (60/40, tercios al céntimo, control sin norma y los dos rechazos atómicos). La **captura en la grilla** (columna «Norma de reparto» en los formularios) queda como **C2-UI** (§3.3) |
| **C3** | **Informes por centro de costo y por norma de reparto** (pantalla + CSV), con filtros por rango, eje, centro y norma | Los importes del informe cuadran con el mayor del mismo rango (test que compara ambos) |
| **C4** | **Cierre**: matriz de flujos y guía de configuración actualizadas; `audit` que avise si un builder nuevo se olvida de aplicar el reparto | Los gates en verde y el detector de reparto añadido al `audit:flows` |

---

## 3.1 C1 — Validación del valor del eje (RESUELTO, 2026-09-21)

| Pieza | Qué se hizo |
|---|---|
| **Eje declarado** | `DimensionConfig.isCostCenterAxis` (migración `20260921140000_dimension_cost_center_axis`, `ADD COLUMN IF NOT EXISTS`). Es **único por empresa**: `DimensionsService.batchUpdateConfigs` rechaza **400** si el lote trae dos ejes marcados y, al marcar uno, **apaga los demás** en la misma transacción (`_applyCostCenterAxisFlag`). La pantalla de Configuración de Dimensiones estrena el interruptor «Eje de centros de costo» con la misma exclusividad en el formulario. |
| **Resolución del eje** | `resolveCostCenterAxis` (`src/common/cost-center.util.ts`): **(1)** el eje declarado; **(2)** si ninguno lo declara, el eje **habilitado** cuyo nombre contenga «centro de costo» (normaliza acentos y mayúsculas) — el valor por defecto para las instalaciones existentes; **(3)** si no hay ninguno, el tenant **no usa** centros de costo por ejes y no se valida nada. |
| **Validación** | `assertCostCentersInDimensions` corre **dentro de `_persist`** del motor (`src/common/accounting/journal-entry-core.ts`), es decir en el **punto único** por el que pasa cada línea del mayor: los ~43 altas de documentos, el asiento manual, las plantillas y las reversas quedan cubiertos sin repetir la guarda. Un código que no sea **centro de costo activo del eje** corta con **400** que nombra el código, la **línea** y el eje. |
| **Cuándo NO valida** (declarado) | (a) el tenant no tiene eje de centros de costo; (b) el **maestro del eje está vacío** — una instalación que usa el eje para otra cosa sigue capturando texto libre, y la validación **entra sola** en cuanto carga su primer centro de costo. |
| **Comparación exacta** | El código viaja como **texto** a `dimensionN` (así lo agrupan los informes), así que la comparación es exacta: `cc-adm` no vale por `CC-ADM`. El mensaje dirige al maestro. |
| **Medición** | `test/cost-centers.e2e-spec.ts` **8/8** (maestro vacío → texto libre; código real → 201 con el código en el asiento; inventado → 400 con stock, kardex y asiento intactos; caja distinta → 400; inactivo → 400; el eje declarado manda sobre el nombre y desmarca el anterior; dos ejes en un lote → 400 sin tocar la configuración; desmarcar devuelve la validación al eje por nombre) + `src/common/cost-center.util.spec.ts` **13/13** y `dimensions.service.spec.ts` **+5**. |

---

## 3.2 C2 — Norma de reparto en los documentos (RESUELTO, 2026-09-21)

| Pieza | Qué se hizo |
|---|---|
| **Captura por línea** | `distributionRuleId` (opcional) en `BaseLineItemDto` —lo heredan las líneas comerciales y de stock—, en los DTO de **emisión** y **recibo** de producción y en los `From*`/drafts de las familias. La columna se **persiste en la línea del documento** (`distributionRuleId Int?`, migración idempotente `20260921150000_line_distribution_rules`) en **15 tablas**: factura de venta, F. Reserva (unificada y legacy), entrega, NC y devolución de venta, factura de compra, F. Reserva de compra (unificada y legacy), recepción, NC y devolución de compra, entrada, salida y ajuste de stock, emisión y recibo de producción. El **traspaso de stock** queda fuera (misma excepción declarada que su cuenta capturada: sus dos patas son el inventario de cada almacén). |
| **Transporte** | El campo viaja por el **mismo camino que `acctCode`/`dimension1..5`**: DTO → línea persistida → `jeLines` del servicio → `JournalEntryLineData` del builder (`InvoiceLineLike`, las líneas de stock, `ProductionIssueJournalLine`/`ProductionReceiptJournalLine` y sus agrupados). |
| **Expansión (un solo expandidor)** | `src/common/accounting/distribution-rule.util.ts` (`resolveDistributionRules` + `expandDistributionRules`) corre **dentro de `_persist`**, el punto único por el que pasa cada línea del mayor, así que **todos** los documentos (y el asiento manual) reparten con la misma matemática. El asiento manual **dejó su expandidor privado** (305 líneas) y ahora delega en el compartido: la expansión existe una sola vez. |
| **Matemática del reparto** | Prorrateo en `Decimal` con **un redondeo por tramo** y el **último tramo cuadrado contra el total** (33,33 + 33,33 + 33,34 = 100,00 exacto); se reparten también las expresiones convertidas (`InBaseCurrency`, `Local`, `System`); cada tramo escribe el **código del centro de costo** en el `dimensionN` del eje de la norma, limpia `distributionRuleId` y guarda el rastro en `sourceDistributionRuleId`; las líneas se **renumeran** solo cuando hubo expansión (sin reparto, las líneas y sus `lineNum` quedan exactamente como venían). |
| **Regla contable respetada** | `_sanitizeAnalyticsByAccountType` ya limpiaba las dimensiones en las cuentas que **no son de resultados**; ahora limpia también la norma capturada, así que el reparto se aplica a las patas de **resultados** (ingreso, costo, gasto) y las de activo/pasivo (inventario, CxC, IVA) quedan enteras. El asiento manual mantiene su comportamiento histórico (no pasa por el sanitizador). |
| **Rechazos atómicos** | Una norma **inexistente** o **inactiva** (o sin tramos) corta con **400** que nombra la línea del documento, dentro de la transacción: no queda stock, kardex ni asiento. |
| **Medición** | `test/line-distribution-rules.e2e-spec.ts` **6/6** — entrada de stock con 60/40 (dos líneas de resultados 60/40 con sus centros, la pata de inventario entera, el asiento cuadrado y el rastro en los dos tramos); control **sin norma** (una sola línea); **tercios** con el último tramo absorbiendo el céntimo (mapa centro → importe exacto); **factura de venta** con el ingreso 120/80 y el costo de ventas repartido también; **norma inactiva → 400** con stock, kardex y asiento intactos; **norma inexistente → 400** sin asiento. Unitarios: `distribution-rule.util.spec.ts` **12/12**. |
| **Límites declarados** | (a) la captura por línea en la **grilla** de los formularios es **C2-UI** (§3.3); (b) la **vista previa** del asiento de un documento (`previewJournalEntry`) no expande: la expansión ocurre al contabilizar; (c) las normas capturadas en **pedidos/cotizaciones** (documentos que no contabilizan) no se heredan al documento que los copia: la captura es del documento que postea. |

---

## 3.3 C2-UI — Captura en la grilla (pendiente)

Columna **«Norma de reparto»** por línea en los formularios que contabilizan (ventas, compras, stock, producción) con un selector de las normas del eje de centros de costo, cableada al `distributionRuleId` del payload; la carga de normas entra en `document-form.base.ts` (hoy carga ejes y centros de costo). Cierre con Karma y `e2e:functional`.

---

## 4. Preguntas abiertas para el usuario

1. **¿Opción A, B o C?** (recomendación: **C**, sin columna nueva; B solo si se quiere FK explícita en el asiento).
2. **¿Qué eje es «Centro de costo»?** El tenant nombra sus 5 ejes; el informe debe saber cuál usar (por nombre
   configurado, o un ajuste explícito «eje de centros de costo»). *Recomendación:* un ajuste explícito en la
   configuración de dimensiones, con el nombre como valor por defecto.
3. **¿El reparto se captura en la línea del documento o se deriva?** *Recomendación:* capturarlo (opcional) y, si no se
   captura, contabilizar como hoy (una sola línea con la dimensión capturada).
4. **¿Los informes deben mostrar también el reparto efectivo del asiento** (N líneas) **o el importe original** de la
   línea del documento? *Recomendación:* los dos, con una columna «repartido en N centros».

---

## 5. Límites declarados

- No se introduce contabilidad analítica «por naturaleza + centro» con cierres internos: el centro de costo sigue siendo
  un atributo de la línea, no un libro paralelo.
- Sin presupuestos por centro de costo ni desviaciones presupuestarias (fuera de alcance; se puede plantear como frente
  posterior con los datos que este plan deja).
- **C1**: la validación se activa con el **maestro** del eje (no con la mera existencia de un eje): un tenant que nombra
  «Centro de costo» un eje y nunca carga centros de costo sigue capturando texto libre. Los ejes **no habilitados**
  quedan fuera de la resolución por nombre (el ajuste explícito sí los admite, porque es una decisión del usuario).
- **C1**: el valor sigue siendo **texto** en `dimensionN` (opción C, sin FK): la validación es del motor, no del esquema,
  así que una carga masiva por SQL directo no pasa por ella.
- **C2**: el reparto se aplica a las patas de **resultados** (la regla contable del motor: dimensiones y reparto solo
  aplican a INCOME/COST/EXPENSE); una línea de inventario/CxC/IVA con norma capturada se contabiliza **entera**.
- **C2**: el asiento **manual** mantiene su comportamiento histórico (no pasa por el sanitizador de analíticas), así que
  en él una norma capturada expande cualquier línea, sea de resultados o no.
- **C2**: `distributionRuleId` de la línea del documento es un **entero sin FK** (el asiento sí la tiene): la norma se
  resuelve y valida al contabilizar, no al guardar el documento.
