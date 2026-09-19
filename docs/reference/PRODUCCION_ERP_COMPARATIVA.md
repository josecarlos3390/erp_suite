# Producción en otros ERP — referencia comparativa para G3 «Módulo de Producción»

> **Propósito.** Fijar **contra documentación pública** (no de memoria) cómo resuelven SAP Business One,
> Odoo 19 y Dynamics 365 Supply Chain los cuatro ejes que nuestro módulo de producción necesita:
> **receta (BOM)**, **orden con estados**, **consumo real vs previsto**, **WIP y desviaciones**.
> Es la base de `docs/plans/plan-g3-produccion.md`; cada afirmación lleva su fuente.
>
> **Estado:** referencia escrita el 2026-09-19, antes de tocar código (decisión del usuario: primero
> documentación y plan, después implementación).

---

## 1. SAP Business One

### 1.1 La receta: tipos de BOM y componentes de recurso

El **Item Master Data → pestaña Production Data** define, por artículo
([SAP Help](https://help.sap.com/doc/f19b844f41b74a8c8ca26f4d501e032b/10.0/en-US/092ba7288d584f9291baed5f4486c72f.html?forSiteMap=true)):

| Campo | Qué es (texto de SAP) |
|---|---|
| **BOM Type** | `Assembly` (BOM de ensamblaje), `Sales` (BOM de venta) o **`Production`** (BOM asociada a una orden de producción) |
| **Phantom Item** | artículo **solo de ingeniería/estructura**, sin componente físico ni subensamble; se define como **no inventariable** |
| **Issue Method** | **`Backflush`** = los componentes se emiten **automáticamente al reportar la terminación del artículo padre**; **`Manual`** = los componentes se emiten **a mano, con independencia de la emisión del producto**. *No se admite `Backflush` en artículos manejados por lote o serie* |
| **No. of Item Components** / **No. of Resource Components** | la BOM lleva **componentes de artículo Y componentes de recurso** |

Dos consecuencias de diseño para nosotros:

1. **La BOM no es solo mercadería**: SAP B1 cuelga **recursos** de la BOM del padre (horas hombre, máquina),
   además de los ítems. Es exactamente el hueco que nuestro `ItemBom` tiene hoy (solo padre→hijo con cantidad).
2. **La merma no es un campo de la BOM** en la fuente consultada; el consumo real se desvía del previsto y
   la diferencia se resuelve en el cierre (§1.3).

### 1.2 La orden: tipos y documentos

Del mismo cuerpo de ayuda y de la página de **WIP Inventory Account**
([SAP Help](https://help.sap.com/saphelp_sbo901/helpdata/en/db/f342a78bf548a08f2739529a46868d/content.htm)):

- **Tipos de orden**: *standard*, *special* y **disassembly** (desensamble). Los tres comparten el mecanismo de WIP.
- **Dos documentos de ejecución**, no uno:
  - **Issue for Production** (emisión para producción) → consume componentes.
  - **Receipt from Production** (recibo para producción) → ingresa el producto terminado.
- **Varias rondas**: «the postings to the WIP inventory account are automatically fully reconciled only after
  the corresponding production order is closed, **no matter if the production order is completed with several
  rounds of issue and receipt**, or if an issue or a receipt is related to more than one production order»
  → **emisiones y recibos parciales son la norma**, no la excepción.

### 1.3 Contabilidad: el modelo de WIP (verbatim de SAP)

**Con emisión `Manual`:**

> - «When you create the **Issue for Production** document, the WIP inventory account is **debited with the total
>   cost of issued components**.»
> - «When you create the **Receipt from Production** document, the WIP inventory account is **credited with the
>   cost of the finished product**.»
> - «If there is a **variance** in the WIP inventory account postings between the component cost and the product
>   cost, the variance is posted **when the production order is closed**. As a result, **the overall WIP inventory
>   account balance in respect of the production order postings is brought to zero**, and these WIP inventory
>   account postings are fully reconciled.»

**Con emisión `Backflush`:** los componentes se emiten solos y **el propio recibo** debita el WIP por el costo de
los componentes emitidos **y** lo acredita por el costo del producto; al cerrar se postea la desviación y, **si no
hay desviación, se postea igual un asiento de valor cero**, para que el WIP quede en cero.

**Desensamble:** igual pero invertido — el WIP se **debita por el costo del producto** y se **acredita por el costo
de los componentes desensamblados**.

**Ejemplo textual de SAP** (orden estándar: 1 martillo a 20 y 2 destornilladores a 10, producto «Tool Kit» a 50):

| Documento | Asiento |
|---|---|
| Recibo (backflush) | `WIP Inventory Account` Cr 50 · `Inventory Account` Dr 50 · `Inventory Account` Cr 40 · `WIP Inventory Account` Dr 40 |
| **Cierre** | `WIP Inventory Account` **Dr 10** · `WIP Inventory Variance Account` **Cr 10** |
| Conciliación final | WIP: Cr 50 · Dr 40 · Dr 10 → **saldo 0** |

> Nota: SAP valoriza el recibo al **costo del artículo** (estándar), y por eso la diferencia con el costo real de
> los componentes aparece como desviación. Nuestro ERP usa **costo promedio móvil**, así que el recibo se valorará
> por el **costo real acumulado** de la orden y la desviación aparecerá solo por merma/ajustes (ver el plan §4).

### 1.4 Recursos

`Resource Cost` aparece como documento propio en la ayuda de SAP B1
([SAP B1 To Go 9.2](https://help.sap.com/doc/45e5277ba6584a59aa2f2b86969b5535/9.2/en-US/SAP_Business_One_To_Go_release92.pdf))
y el maestro de artículos declara **componentes de recurso** en la BOM (§1.1). Nuestro propio análisis previo ya
lo había medido: `docs/reference/SAP_B1_VS_ERP_COMPARATIVA_ANALYSIS.md` §4 documenta que SAP B1 tiene *gasto de
costo estándar por recurso*, *cuenta WIP de recursos* y *cuenta P&G de compensación de WIP*, y que **nuestro ERP
tiene las cuentas WIP pero no el sistema de recursos**.

---

## 2. Odoo 19 (Manufacturing / MRP)

Fuente: guía funcional de Odoo 19, tema 6.2 *Manufacturing orders & work orders*
([OpenExamPrep](https://open-exam-prep.com/study-guides/odoo-functional-consultant/manufacturing-mrp/manufacturing-orders-and-work-orders)).

### 2.1 Ciclo de vida de la orden

`Draft` → `Confirmed` → `In Progress` → `To Close` → `Done` (y `Cancelled`). En `Confirmed` Odoo **intenta reservar**
los componentes y **genera las órdenes de trabajo** (una por operación de la ruta).

### 2.2 Consumo real vs previsto

- Al confirmar se **reservan** componentes según el *reservation method* (At Confirmation / Manually / Before
  scheduled date); el botón *Check Availability* fuerza el intento.
- El campo **Consumption** (en la BOM o en el producto) gobierna la desviación: **Strict** (exacto al BOM),
  **Allowed** (más o menos) y **Allowed with Warning** (permite pero avisa).
- Producir **menos** de lo previsto genera un **backorder** por el resto.
- Con lote/serie hay que **asignar el lote consumido** y el producido (trazabilidad obligatoria).

### 2.3 Órdenes de trabajo, centros de trabajo y scrap

- **Work orders**: una por operación, con estado `Waiting` / `Ready` / `In Progress` / `Done`; se ejecutan en el
  **Shop Floor** (interfaz táctil) registrando **tiempo real**, cantidades y **controles de calidad**. La orden de
  fabricación no se puede cerrar hasta que sus órdenes de trabajo estén terminadas.
- **Work Center**: **costo por hora**, **capacidad** (unidades en paralelo), **eficiencia** (escala los tiempos),
  **setup/cleanup time** y métricas de **OEE** (real vs esperado).
- **Scrap**: saca lo defectuoso a una **ubicación virtual de descarte** (destruye valor). **Unbuild order**:
  desensambla un terminado y **recupera** sus componentes.

---

## 3. Dynamics 365 Supply Chain (fabricación discreta)

Fuente: *Revertir el estado de un pedido de producción*
([Microsoft Learn](https://learn.microsoft.com/gl-es/dynamics365/supply-chain/production-control/reverse-production-order-status)).

- **Ciclo de vida**: `Creado` → `Estimado` → `Programado` → `Liberado` → `Iniciado` → **`Reportado como finalizado`**
  → (liquidación de costos). Revertir un estado **deshace los efectos**: al volver de *Iniciado* a *Liberado*
  «el sistema revierte todos los ítems que se reportaron como terminados», las entregas entrantes/salientes a
  producción, los tiempos registrados y «**revierte la configuración de todos los elementos que has publicado como
  en proceso o trabajo en proceso**».
- **Consumo** separado en **consumo de materiales** (líneas de L.MAT.) y **consumo de ruta** (operaciones), cada uno
  con su **estado de permanencia** (`Consumo de materiales` / `Consumo de ruta` / `Finalizado`).
- **Estimación de costos** previa a la ejecución y, si hay **compras derivadas** o **producción derivada**, el
  sistema crea (y revierte) las órdenes subyacentes.

Lo que aporta al diseño: **la reversibilidad de estados es un requisito de primera clase** (cada transición debe
poder deshacerse limpiando sus efectos), y el consumo se modela **por materiales y por ruta** con estados.

---

## 4. Síntesis: lo común, lo distinto y lo que adoptamos

| Eje | SAP B1 | Odoo 19 | Dynamics 365 | Qué adoptamos |
|---|---|---|---|---|
| Receta | BOM `Production` con componentes de **artículo y recurso**; ítems *phantom* | BoM con operaciones, subproductos, variantes y política de consumo | BOM + ruta, con estimación | **BOM multinivel** con merma, **operaciones** y **componentes de recurso** |
| Emisión de componentes | `Manual` o `Backflush` | reserva + consumo `Strict/Allowed/Allowed+Warning` | consumo de materiales con estado | **Manual por defecto**; `Backflush` como opción declarada (fase posterior) |
| Documentos | **Issue for Production** + **Receipt from Production** | una orden que consume y produce (con backorders) | reporte de terminado + consumo | **Emisión y recibo como documentos propios**, con **parciales** |
| Estados | orden liberada → cerrada | Draft→Confirmed→In Progress→To Close→Done | 7 estados reversibles | `DRAFT → PLANNED → RELEASED → IN_PROGRESS → CLOSED/CANCELLED` **reversibles** |
| Recursos | componentes de recurso en la BOM, con costo | work centers con costo/hora, capacidad, eficiencia, OEE | rutas con consumo | **recurso con componentes de costo** + centro de trabajo con costo/hora |
| WIP | **cuenta WIP** (Dr emisión / Cr recibo) y **desviación al cierre** hasta dejar **WIP = 0** | valorización por producto terminado | publicaciones de **trabajo en proceso** | **el modelo de SAP**, con costo **real** de la orden |
| Merma / subproducto | implícito en el cierre | Scrap (ubicación virtual) y subproductos en la BoM | — | **merma y subproductos explícitos** en el recibo, contra `Mermas y Desperdicios` |
| Trazabilidad | no admite backflush con lote/serie | lote/serie obligatorio en consumo y producción | — | **asignación de lote/serie** en emisión y recibo |
| Planificación | MRP + órdenes sugeridas | MRP/MPS | órdenes derivadas | **explosión de BOM y aviso de faltantes** (sin MRP; decisión del usuario) |

**Limitaciones de nuestra contabilidad que condicionan el diseño** (medidas en el repo, no supuestas):

1. El asiento del **ensamblaje actual** (`buildAssemblyJournalEntryLines`) usa **solo `INVENTORY`**: `Dr Inventario
   kit / Cr Inventario componentes`. **No pasa por WIP**, así que producción necesita su propio builder.
2. Las cuentas WIP **ya existen** en el maestro de artículos (`Item.wipAccountId`, `wipVarianceAccountId`,
   `scrapAccountId`, `goodsIssuedAccountId`, `goodsReceivedAccountId`, `inTransitAccountId`, `allocationAccountId`)
   y los `EntryType` `WIP`, `WIP_VARIANCE`, `SCRAP`, `ALLOCATION` — se resuelven por la misma jerarquía que
   Revalorización y Precio de Entrega.
3. El plan de cuentas ya trae `1.1.3.03 Inventario de Productos en Proceso`, `1.1.3.03.001 Productos en Proceso
   (WIP)`, `1.1.3.04 Inventario de Productos Terminados` y `5.1.2.01.004 Mermas y Desperdicios`.
4. `JournalEntryLine` tiene `projectId`, `projectCode`, `dimension1..5` y `distributionRuleId`, pero **no
   `costCenterId`**: imputar recursos por centro de costo exige añadir el campo o resolverlo por
   distribución/dimensiones (decisión registrada en el plan).
5. El costo del PT se valoriza con **costo promedio móvil** (`Stock.avgCost`), no con costo estándar: el recibo
   entrará al **costo real acumulado** de la orden y la desviación aparecerá por merma/ajuste, no por estándar.

## 5. Fuentes

- SAP B1 · *WIP Inventory Account* — https://help.sap.com/saphelp_sbo901/helpdata/en/db/f342a78bf548a08f2739529a46868d/content.htm
- SAP B1 · *Defining Production Data in Item Master Data* — https://help.sap.com/doc/f19b844f41b74a8c8ca26f4d501e032b/10.0/en-US/092ba7288d584f9291baed5f4486c72f.html
- SAP B1 · *Working with Production Orders* — https://help.sap.com/docs/SAP_BUSINESS_ONE_WEB_CLIENT/2554bf7e9aa347729b0547a737e123ac/0def567f6dab4c33890b5d0e681ebd3f.html
- SAP B1 · *Resource Cost* (To Go 9.2) — https://help.sap.com/doc/45e5277ba6584a59aa2f2b86969b5535/9.2/en-US/SAP_Business_One_To_Go_release92.pdf
- SAP B1 · *How to Set Up and Manage a Perpetual Inventory System* — https://help.sap.com/doc/b23e727e45434829a926e6ab06d4b69e/10.0/en-US/How_to_Set_Up_and_Manage_a_Perpetual_Inventory_System.pdf
- Odoo 19 · *Manufacturing orders & work orders* — https://open-exam-prep.com/study-guides/odoo-functional-consultant/manufacturing-mrp/manufacturing-orders-and-work-orders
- Dynamics 365 · *Revertir el estado de un pedido de producción* — https://learn.microsoft.com/gl-es/dynamics365/supply-chain/production-control/reverse-production-order-status
- Análisis propio previo — `docs/reference/SAP_B1_VS_ERP_COMPARATIVA_ANALYSIS.md` §4 (recursos/WIP)
