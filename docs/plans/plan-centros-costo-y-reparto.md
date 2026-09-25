# Plan — Centros de costo, dimensiones y normas de reparto

> **Estado:** propuesto el **2026-09-21** (petición del usuario: «hacer un plan después para adicionar o integrar los
> centros de costo para utilizar normas de reparto […] y así poder generar informes por centros de costo y normas de
> reparto»). **C0 RESUELTO (2026-09-21): opción C aprobada por el usuario** —ver §2.1—; **C1 RESUELTO (2026-09-21)** —ver
> §3.1—; **C2 RESUELTO (2026-09-21)** —ver §3.2, con **C2-UI RESUELTO** también (ver §3.3)—; **C3 RESUELTO (2026-09-21)** —ver §3.4—; **C4 RESUELTO (2026-09-21)** —ver §3.5—; **huecos declarados del cierre RESUELTOS (2026-09-21, T175–T177)** —ver §3.6—. El plan queda **cerrado** (C0–C4, C2-UI y el barrido de **T170**, cerrado en **T174**); el único frente que sobrevive fuera de él es la separación alta/confirmación de los documentos de stock (declarada en §3.6 y AUDIT **T177**, decisión de producto).
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
| **C2** | **Norma de reparto en documentos**: `distributionRuleId` opcional por línea + el expandidor compartido en los builders que hoy no reparten (ventas, compras, stock, producción) | ✅ **RESUELTO (2026-09-21)**: ver §3.2 — `distributionRuleId` por línea en los 15 modelos de línea que contabilizan (migración `20260921150000_line_distribution_rules`), expansión **en el punto único** (`_persist`) con el **mismo expandidor** que el asiento manual y medido en el mayor: `test/line-distribution-rules.e2e-spec.ts` **7/7** (60/40, tercios al céntimo, control sin norma, los dos rechazos atómicos y el espejo de la NC «desde factura»). La **captura en la grilla** quedó cerrada como **C2-UI** (§3.3) |
| **C3** | **Informes por centro de costo y por norma de reparto** (pantalla + CSV), con filtros por rango, eje, centro y norma | ✅ **RESUELTO (2026-09-21)**: ver §3.4 — `GET /reports/cost-centers` y `GET /reports/distribution-rules` con el mismo alcance que el resto de informes (los totales **cuadran con el balance de comprobación**, medido), el eje resuelto con la misma función que el motor, la pantalla con dos pestañas, filtros y CSV; medido en `test/cost-center-reports.e2e-spec.ts` **7/7** y **21** unitarios de frontend |
| **C4** | **Cierre**: matriz de flujos y guía de configuración actualizadas; `audit` que avise si un builder nuevo se olvida de aplicar el reparto | ✅ **RESUELTO (2026-09-21)**: ver §3.5 — **R17** en `npm run audit:flows` (recorre las **15 familias** y reporta **ERROR** cuando una norma capturada no llegó al asiento existente con patas de resultados; validado con **sonda**: 1 error con la sonda puesta y 0 al deshacerla), `docs/reference/matriz-flujos-documentos.md` **§5.b** y el **paso A.4b** de `docs/guides/guia-implementacion-configuracion.md` reescritos |

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

## 3.3 C2-UI — Captura en la grilla (RESUELTO, 2026-09-21)

| Pieza | Qué se hizo |
|---|---|
| **Columna por línea** | Columna **«Norma reparto»** (`key: 'distributionRule'`, `minWidth: 220px`) en la grilla de líneas de **los 15 formularios que contabilizan**: factura de venta, F. Reserva de venta, entrega, NC y devolución de venta, factura de compra, F. Reserva de compra, recepción, NC y devolución de compra, entrada, salida y ajuste de stock, emisión y recibo de producción. La celda es un `luna-select` en **modo celda** (`size="sm" [cell]="true"`), deshabilitado cuando el documento es de solo lectura, y se pinta con el **mismo mecanismo** que la celda de cuenta contable de cada familia (`ng-template lunaDocumentLineDetailCell="manualAccount"` en las comerciales y de stock, `@case ('manualAccount')` en producción). |
| **Carga de las normas** | `document-form.base.ts` (`loadDimensionData`) carga las normas **activas** del tenant una sola vez y expone `distributionRuleOptions` (con `NO_DISTRIBUTION_RULE = -1` como «sin reparto») y `noDistributionRule` para el `[emptyValue]`; los formularios de **producción**, que no heredan de esa base, cargan las suyas en su `ngOnInit` con la misma forma. |
| **Valor tipado (T170)** | Los selectores usan el input **`[options]`** y **no** `<option [ngValue]>` proyectadas: con opciones proyectadas el control emite el **texto** de la opción (defecto medido T170) y el API respondía 400. En el modelo «sin reparto» es `null`; el centinela `-1` vive solo dentro del selector y se normaliza al armar el payload (`v && v > 0 ? Number(v) : undefined`). |
| **Transporte** | La norma viaja en el payload de **alta** (y de edición donde la familia manda líneas) por el mismo camino que `acctCode`, y se **hidrata** desde el API y desde los borradores (`commercial-document-form.base.buildLineFromDraft` es el punto único para las familias comerciales: se le agregó el control). |
| **Cuenta y norma en la NC «desde factura»** | El camino `POST /sales-credit-notes/from-invoice/:id` y su espejo de compras armaban las líneas **en el servidor** y **descartaban** la cuenta capturada y la norma de la línea de la factura. Ahora las **heredan** (`customItem?.x ?? origLine.x ?? null`), así que el espejo analítico de la nota de crédito cae en los **mismos centros de costo** que el asiento original. |
| **Medición** | Frontend: `ng build` 0 errores, `lint` 0/0, ratchet de prettier OK, **Karma 2079/2079** con **62 unitarios nuevos** medidos spec por spec (15 de ventas + 4 de los mappers de venta + 22 de compras + 9 de inventario + 6 de producción + 3 del selector del asiento manual y de la norma en Dimensiones [T170] + 1 del mapper de la F. Reserva desde recepción + 2 del camino C2), `e2e:visual` **53/53 con 0 PNG modificados** (las capturas del alta no tienen filas: la columna no mueve ningún baseline). **El gate `e2e:functional` no cerró verde** en esta ronda: dos corridas con fallos distintos (`qa-multitienda` y `sales-multi-delivery-credit-note`, ambos verdes en aislamiento, y después `traceability-flow`, que se cuelga al crear la F. Reserva con la captura mostrando el documento ya creado); el A/B con los cambios revertidos queda confundido por el estado de la BD, así que queda **declarado y sin atribuir** en AUDIT **T172** como el frente a aislar antes de dar el gate por cerrado. Backend: **2 unitarios** nuevos en las dos NC y **1 E2E** nuevo (`line-distribution-rules` **7/7**) que mide en el mayor el espejo repartido de la NC «desde factura». |
| **Límites declarados** | (a) El **traspaso de stock** queda fuera (excepción ya declarada). (b) Los `PATCH` de los tres documentos de **stock** mandan solo cabecera (diseño preexistente de la familia, idéntico para la cuenta capturada): la norma viaja en el alta. (c) En **producción** el detalle del documento existente es de solo lectura y su grilla de detalle no muestra la norma (tampoco la cuenta). (d) `previewDraftPayload` no manda la norma: el DTO de preview no la declara y el `ValidationPipe` global usa `forbidNonWhitelisted` (daría 400). (e) Las normas capturadas en pedidos/cotizaciones siguen sin heredarse (límite (c) de C2). |

---

## 3.4 C3 — Informes por centro de costo y por norma de reparto (RESUELTO, 2026-09-21)

| Pieza | Qué se hizo |
|---|---|
| **Dos lecturas del mayor** | `GET /reports/cost-centers` — el mayor del rango agrupado por **(centro de costo × cuenta)** con debe, haber, saldo, el número de líneas de la celda y, separado, cuántas de ellas **nacieron de una norma** (`splitLines`) y cuáles (`rules`); más el resumen **por norma**, los **tramos de documento** repartidos y los totales. `GET /reports/distribution-rules` — el **reparto efectivo** agrupado por **(norma × centro de costo)** con el catálogo de normas del tenant (para el selector) y los mismos tramos. Los dos endpoints cuelgan del controlador de informes (`reports:view`). |
| **Alcance = el de los demás informes** | La consulta usa la **misma** regla de alcance (`reportableJournalEntryWhere`, T149: contabilizado y no revertido, con el `OR` explícito del `NULL` de Prisma) y el **mismo** filtro de fechas, así que los totales **cuadran con el balance de comprobación** del mismo rango (medido en el E2E). |
| **El eje, resuelto como lo resuelve el motor** | `_loadAnalyticLedger` usa `resolveCostCenterAxis` —la **misma** función con la que el motor valida el valor capturado (C1)—, así que el informe agrupa por el eje en el que el ERP **escribió** el centro de costo; el filtro `dimensionNumber` permite leer cualquier otro eje (y un eje sin centros de costo devuelve todo en la fila «sin centro»). |
| **Importe original y reparto efectivo** | Decisión C0 §0: el informe muestra **las dos cosas** — la celda del mayor (el **reparto efectivo**, ya expandido al contabilizar) con la marca de cuántas líneas vinieron de una norma, y el detalle de la **línea de documento** repartida con «**repartido en N centros**», su asiento, su fecha y sus centros. |
| **Pantalla** | `/reports/cost-centers` (ruta bajo el `reports:view` del padre, tarjeta en el menú de informes y etiqueta de migas «Centros de Costo»): dos pestañas —**Costos por centro** y **Asientos con norma de reparto**—, filtros de rango, **eje**, centro de costo y norma, barra de totales siempre a la vista, las tres tablas (celdas, tramos, reparto por norma) y **exportación CSV** de cada lectura con su fila de `TOTAL`. Los selectores usan el input `[options]` de `luna-select` (no `<option>` proyectados) para que el id numérico viaje tipado. |
| **Medición** | `test/cost-center-reports.e2e-spec.ts` **7/7**: el informe cuadra **contra el balance de comprobación** del mismo rango; los centros del reparto 60/40 aparecen con su importe y su marca; el filtro por centro acota y sigue cuadrando; el filtro por eje cambia el agrupamiento (eje sin centros → todo «sin centro»); el informe de normas publica los tramos por centro y el catálogo; los filtros por norma y por centro acotan; y un rango sin movimientos devuelve el informe vacío y en cero. Frontend: **21** unitarios nuevos (15 de la pantalla —pestañas, rango del tenant, eje declarado y por nombre, filtros que viajan, filas y totales pintados, CSV de las dos lecturas, fecha del tramo, los dos errores— y 6 del servicio —URL y query string de los dos endpoints, con los filtros vacíos **omitidos**). |
| **Límites declarados** | (a) El informe lee el **mayor**, no las líneas del documento: un documento **no contabilizado** no aparece (es el alcance de todos los informes contables). (b) El filtro por cuenta existía en el API (`accountId`) sin pantalla que lo expusiera: **cerrado en T175** con el filtro «Cuenta» de la pestaña de costos (catálogo de cuentas activas y de detalle). (c) El informe **no** reexpande las normas: muestra el reparto ya escrito en el asiento. |

---

## 3.5 C4 — Cierre (RESUELTO, 2026-09-21)

| Pieza | Qué se hizo |
|---|---|
| **Detector R17** | `scripts/audit-flow-links.mjs` (`npm run audit:flows`) suma el bloque **R17** —**10 bloques** de reglas—: recorre las **15 familias** que contabilizan y, si una línea de documento tiene `distributionRuleId` capturado y el documento **tiene asiento con al menos una pata de resultados**, exige el rastro (`sourceDistributionRuleId`) en alguna línea del asiento; si no lo lleva, reporta **ERROR** con el documento y la norma (delata al builder que deja de transportarla). **No** marca el borrador (sin asiento) ni el asiento con **solo** patas de activo/pasivo/IVA (el saneador del motor limpia las analíticas: regla declarada de C2). |
| **Sonda medida** | Con una norma capturada a mano en una línea de factura cuyo asiento no la reparte, `audit:flows` cerró en **1 error exactamente por R17** (exit 1); deshecha la sonda volvió a **0 errores / 4 avisos declarados**. |
| **Matriz de flujos** | `docs/reference/matriz-flujos-documentos.md` estrena **§5.b Centros de costo y normas de reparto**: eje declarado, validación en el punto único, captura por línea (15 tablas y 15 formularios), expansión, rastro, informes y **R17** con sus límites. |
| **Guía de configuración** | `docs/guides/guia-implementacion-configuracion.md` reescribe el **paso A.4b** con la secuencia completa (declarar el eje → cargar el maestro → normas al 100 % → captura por línea en la grilla → leer el informe `/reports/cost-centers`) y los **límites declarados**. |
| **Cierre del gate** | El gate funcional de la ronda cerró **238 passed · 0 fallos · 3 skips** sobre **BD recreada** (30,7 min, 241 programados), incluida `traceability-flow`; los fallos previos quedaron atribuidos al **estado acumulado del arnés** (AUDIT **T172**). |

---

## 3.6 Cierre de los huecos declarados (T175–T177, RESUELTO, 2026-09-21)

Recorrido de cierre pedido por el usuario («no dejemos huecos»): los tres huecos que el frente había **declarado** al
cerrarse (AUDIT T174, T171 y el límite `landed-costs.accountId`) más el barrido completo del defecto **T170**.

| Pieza | Qué se hizo |
|---|---|
| **T175 — el defecto T170 no puede volver** | Gate preventivo `scripts/audit-select-options.mjs` (`npm run audit:select-options` + `--self-test` **12/12**, en `ci.yml` junto a `audit:list-actions`): recorre `src/app/**/*.html`, borra los comentarios, ignora el `<select>` nativo y **falla con exit 1** ante cualquier `[ngValue]` **dentro de un bloque `<luna-select>`**, que es el patrón que emitía el **texto** de la opción (el `<select>` interno no lleva `SelectControlValueAccessor`). Escape declarado `select-options-ok: <razón>`. Medido: **0 hallazgos en 178 bloques de 86 plantillas** y **sonda** plantada que falla con el `archivo:línea` exacto. |
| **T175 — filtro por cuenta** | El límite (b) de §3.4 queda cerrado: la pestaña **Costos por centro** estrena el filtro **Cuenta** (el API ya aceptaba `accountId`), con el catálogo de cuentas **activas y de detalle** por el input `[options]` de `luna-select`, «Todas las cuentas» que **no manda centinela** y el filtro **ausente** en la pestaña de normas (donde el API no lo acepta). **5 unitarios nuevos** (la corrida acotada cierra **26/26**). |
| **T176 — detalle de producción** | Las dos pantallas de producción pintan en el **detalle de solo lectura** las columnas **Cuenta** y **Norma reparto** (solo con líneas, sin `[formControl]`, con el `#id` de respaldo y «—» sin captura): lo que la grilla captura se puede **volver a leer**. **6 unitarios nuevos**. |
| **T176 — cuenta del gasto opcional** | El desvío declarado en T174 (`landed-costs.accountId` con placeholder deshabilitado porque el contrato era `number` requerido) se corrige **de raíz**: el DTO lo hace `@IsOptional()` y el servicio resuelve la cuenta **antes** de la transacción (**capturada → tipo de gasto → determinación → 400** que nombra la línea), sin migración; el frontend pasa al centinela elegible y **omite la clave** en el payload. Backend `src/landed-costs` **9/9** y `test/landed-costs.e2e-spec.ts` **10/10**. |
| **T177 — PATCH de los tres documentos de stock** | Entrada, salida y ajuste aceptan `items?` con el DTO de línea del alta y comparten un **builder alta/update**; el `PATCH` con líneas es **reemplazo** (valida cuenta capturada y almacenes antes de la transacción, recalcula `totalCost`/`totalWeight`, resincroniza `DocumentLineTracking`) **sin tocar stock, kardex ni asiento** (el documento sigue `OPEN`). Frontend: un `buildItemsPayload()` **único** para alta y edición. Backend **185 suites/2234 tests** (+15) y suite nueva `test/stock-document-lines-patch.e2e-spec.ts` **6/6**. |
| **T178 — el preliminar expande la norma** | `_buildPreviewResponse` (punto único de los previews de documento **y** de borrador) corría **sin** el expandidor: el modal prometía una pata de resultados donde el asiento escribe N. Ahora resuelve las reglas (`resolveDistributionRules`, con el 400 accionable) y expande con el **mismo** `expandDistributionRules`; sin norma el preview no cambia. **1 unitario nuevo** y **medición E2E**: el preliminar del borrador de stock, antes de confirmar, ya trae las dos patas 18/12 con sus dos centros. |
| **Límite declarado (medido)** | La norma se captura donde el documento **contabiliza**, igual que la cuenta: **cotizaciones y pedidos** (ventas y compras) y la **orden de ensamblaje** no aceptan `distributionRuleId` (medido en schema, DTO y formularios), así que no hay nada que heredar hacia la factura; en la orden de ensamblaje el reparto sería además **inerte** porque su asiento mueve activo contra activo y el motor no reparte cuentas que no son de resultados. |
| **Hallazgo declarado (abierto)** | Hoy **ningún endpoint crea un documento de stock `OPEN`**: los tres `POST` (`/stock-entries/manual`, `/stock-exits/manual`, `/stock-adjustments`) llaman a `confirm()` en la misma request, así que el `PATCH` de borrador solo es alcanzable reseteando el estado por BD (o vía `stock-counts`, que no usa este camino). Cerrarlo exige **separar el alta de la confirmación** (documento en borrador + confirmación explícita), que es **decisión de producto** y no se tomó en esta ronda: queda declarado en AUDIT **T177**. |
| **Cierre del gate** | El barrido de **T174** (26 bloques) y esta ronda de cierre corrieron el gate funcional **sobre BD recreada** (regla de proceso de AUDIT **T172**). |

---

## 4. Preguntas abiertas para el usuario (todas decididas en C0)

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

---

## 6. T238 — el contrato del asiento preliminar del borrador (2026-09-25)

Ronda de corrección sobre el **punto único** que este plan ya había tocado (T178): el **asiento preliminar** del
**borrador** (`POST /journal-entries/preview-draft`) es la única superficie del ERP donde el **payload lo arma la
pantalla** y el backend corre con `ValidationPipe` en `whitelist` + `forbidNonWhitelisted`, así que **una sola clave de
más es un 400** que deja al usuario sin preliminar.

**Medido antes (app en marcha)**: la pantalla de **factura de venta** manda **siempre** `isExport` y el DTO no lo
declaraba → `400 property isExport should not exist` en **cualquier** factura; y una línea sin artículo viajaba como
`null` (`Number(undefined)` → `NaN` → `null` en JSON) → `lines.0.itemId must be a number conforming to the specified
constraints`. **El mismo escaneo** (comparar las claves que devuelven los cuatro `previewDraftPayload` con el DTO)
destapó el segundo: la **factura de compra** manda `creditUse` → `400 property creditUse should not exist` (verificado
en vivo).

**Dos clases de defecto, dos arreglos**:
1. **Contrato**: `isExport` y `creditUse` se declaran en el DTO. `isExport` **no** es cosmético —el builder de ventas
   decide con él si el precio lleva IVA, si emite débito fiscal y si aplica IT (Art. 11 y Art. 76 inc. c)—, así que se
   **hila** hasta el asiento: `DraftPreviewDocument` → `JournalEntriesService.previewFromDraft` →
   `_previewSaleInvoice`. `creditUse` es un atributo del libro de compras que el motor no lee: se acepta y se declara
   que no cambia el asiento.
2. **UX de la pantalla**: el botón se podía pulsar con el documento incompleto. Las **cuatro** pantallas
   (`sale-invoices`, `sale-reserve-invoices`, `purchase-invoices`, `purchase-reserve-invoices`) devuelven ahora
   `undefined` cuando el helper **compartido** (`JournalEntryPreviewDraftHelper.isReady`) dice que no hay borrador
   previsualizable (cliente/proveedor + al menos una línea con artículo) —el botón se **deshabilita**— y **filtran** las
   líneas sin artículo, que es la misma regla que ya aplicaba el helper.

**Medido (después)**: sonda en vivo del payload de la pantalla → **201** (era 400); A/B del asiento de exportación →
sin `2.1.2.01.001` (IVA débito) ni `2.1.2.01.003` (IT) y CxC por el importe íntegro, contra el interno que **sí** los
lleva; `preview-journal-entry-draft.dto.spec` **8/8** (valida con las mismas opciones del pipe y aplana los hijos como
el pipe); E2E `discount-propagation` con el caso de exportación del **borrador** (el mismo supuesto que ya existía para
la factura **guardada**, que es justo por lo que el camino del borrador se había quedado sin medir); Karma de la
pantalla de venta **21/21** (4 casos nuevos).

**Declarado**: las cuatro pantallas **duplican** el mapeo de línea (cada una con su neto `priceNet × cantidad`, que no
es lo que hace el helper) —deuda real, no se unifica en esta ronda porque el helper manda el `subtotal` **con IVA** del
formulario y el asiento quedaría descuadrado—; `lines: []` sigue siendo **válido** en el contrato (un cobro/pago
previsualiza sin líneas de mercancía) y por eso el vacío se resuelve en la UI y no en el DTO.

