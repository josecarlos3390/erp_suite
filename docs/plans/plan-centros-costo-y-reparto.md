# Plan — Centros de costo, dimensiones y normas de reparto

> **Estado:** propuesto el **2026-09-21** (petición del usuario: «hacer un plan después para adicionar o integrar los
> centros de costo para utilizar normas de reparto […] y así poder generar informes por centros de costo y normas de
> reparto»). **C0 RESUELTO (2026-09-21): opción C aprobada por el usuario** —ver §2.1—; C1–C4 pendientes de ejecución.
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
| **C1** | **Validación del valor del eje**: si el eje tiene centros de costo activos, la línea solo acepta códigos del maestro (400 accionable con la línea); el formulario ya usa el selector | Una línea con un código inventado se rechaza; con un centro de costo real, se guarda |
| **C2** | **Norma de reparto en documentos**: `distributionRuleId` opcional por línea + el expandidor compartido en los builders que hoy no reparten (ventas, compras, stock, producción) | Un documento con una línea repartida contabiliza **N líneas** con el importe prorrateado al céntimo y el centro de costo en la dimensión del eje (medido en el mayor) |
| **C3** | **Informes por centro de costo y por norma de reparto** (pantalla + CSV), con filtros por rango, eje, centro y norma | Los importes del informe cuadran con el mayor del mismo rango (test que compara ambos) |
| **C4** | **Cierre**: matriz de flujos y guía de configuración actualizadas; `audit` que avise si un builder nuevo se olvida de aplicar el reparto | Los gates en verde y el detector de reparto añadido al `audit:flows` |

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
