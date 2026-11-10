# Operar los dos modelos desde la UI: qué falta y en qué orden

> **De dónde sale esto.** Del ejercicio de las tres tiendas (A: una sucursal con un almacén por
> tienda + centros de costo; B: tres sucursales, cada una una tienda) y de llevarlo a **Playwright
> como lo haría el usuario**: lo que se pudo hacer por pantalla, lo que no, y **por qué**. Cada
> punto de abajo está **medido** en esta sesión; donde digo «medido» hay un caso o una respuesta
> HTTP detrás, y el resto se declara como pendiente de medir.

## 1. Lo que ya se puede hacer por pantalla

| Acción | Estado |
|---|---|
| Informe de ventas **por sucursal** y **por almacén (tienda)**, con sus importes | ✅ T617 |
| Facturar **con centro de costo** en la línea (factura directa, `?manual=1`) | ✅ T618 |
| **Crear la sucursal** por pantalla | ✅ T619 (caso de UI 1/5) |
| **Crear su almacén** eligiendo esa sucursal | ✅ T619 (era **403**; ahora 201) |
| **Crear su usuario** con sucursal y almacén por defecto | ✅ T619 (leído después por API: quedó guardado) |
| Renombrar/desactivar un almacén (`status: INACTIVE`) | ✅ la lista ya lo tiene (y el backend lo impide sobre el predeterminado) |
| **Facturar con ese usuario en su sucursal** (almacén ya sembrado) y **leer el informe por sucursal** | ✅ T622 — el caso por pantalla va **6/6** |

## 2. Lo que **no** se pudo, y es lo que hay que arreglar

### P1 · El documento de un usuario de una sucursal nueva nace en la sucursal 1 — **CORREGIDO: no era del producto**

**Diagnóstico inicial (T620, conservado por regla)**: el usuario se crea con `defaultBranchId = 41`
y, al facturar, la factura salía con `branchId = 1`; se atribuyó al formulario.

**Corrección medida (T621)**: el `sessionStorage` del navegador tenía el usuario **admin** aunque
el `POST /auth/login` devolvía el usuario nuevo: el `newContext()` del arnés **hereda las cookies**
de la sesión de administración que deja `test.use({ storageState })`, y el refresco del arranque
volvía a autenticar como admin. Con un contexto **limpio** (`storageState: { cookies: [], origins: [] }`)
el formulario muestra la sucursal del usuario. El parche que se había escrito en la factura se
**revirtió**: el A/B sin él da el mismo resultado.

**Lo que sí queda (P2-bis, nuevo)**: ver P2-bis.

### P2-bis · El alta de un almacén **no habilitaba los artículos** en su matriz — **CERRADO (T622)**

**Medido**: al facturar en el almacén de la sucursal nueva, `POST /stock-entries/manual` respondía
**400** «El artículo "Aceite Sintético 5W-30 4L" no está habilitado para operar en el almacén …».
Dos sondas lo fijaron: `POST /warehouses` **sí** sembraba (existencia + matriz), pero
`POST /branches` —que crea el almacén de la sucursal nueva (T501)— **no**: el artículo tenía filas
para 4 de 5 almacenes y la del almacén nuevo **no**.

**Arreglo**: un solo motor, `provisionWarehouseForItems` (`src/common/warehouse-provisioning.util.ts`),
usado por los **dos** caminos; las cuentas de la matriz nacen vacías (T245).

**Verificado**: `test/branch-default-warehouse.e2e-spec.ts` **3/3** — fila **ACTIVA** en la matriz y
**entrada de stock 201** con un usuario de esa sucursal; y el caso por pantalla **6/6**, con la
factura creada en `branchId: 13` / `warehouseId: 16` (la sucursal y el almacén del usuario) y el
informe por sucursal mostrando su importe.

### P3-bis · Crear una sucursal **se salta el cupo del plan** — **CERRADO (T626)**

**Medido**: con la cuota en **5/5**, `POST /branches` creó su almacén y la dejó en **6/5**: el
chequeo del plan vive en `warehouses.service.create` y el alta de la sucursal crea el suyo por otra
vía. **Qué propongo**: decidir si la sucursal **cuenta** para el cupo (y entonces validarlo antes de
crearla, con un mensaje que diga qué hacer) o si no cuenta (y entonces documentarlo). Criterio: no
se puede quedar por encima del cupo sin una decisión explícita.



### P2 · `batch-upsert` de la matriz de almacenes **no es idempotente** — **CERRADO (T634, no reproducible)**

**Medido**: `POST /item-warehouse-accounts/batch-upsert/:itemId` responde **500**
(`itemWarehouseAccount.create()` con la fila ya existente) cuando el almacén ya trae la matriz
—y el alta de un almacén **siembra** esa matriz—. **Qué propongo**: que un `upsert` de verdad
actualice la fila existente (o que el endpoint se llame `batch-create` y no prometa lo que no
hace). Criterio: dos llamadas seguidas con el mismo payload ⇒ 200/201 la segunda, sin 500.

### P3 · El cupo del plan no se ve hasta que falla — **CERRADO (T624)**

**Medido**: `SHARED` permite **5 almacenes activos**; al quinto ocupado, `POST /warehouses`
responde **403** con el texto del cupo. La pantalla de almacenes **no muestra** «5/5» ni sugiere
desactivar uno.

**Hecho (T624)**: la lista publica «**Almacenes activos: 5 / 5**» desde `GET /billing/limits` y,
con el cupo completo, dice qué hacer («Desactiva uno de la lista para poder crear otro»); sin
límite no inventa una cifra. Tres casos de Karma y una aserción del caso por pantalla lo fijan.

### P4 · Los informes contables por sucursal no se ofrecen en la pantalla — **CERRADO (T623 y T637)**

**Medido**: el API filtra `trial-balance`, `income-statement`, `journal`, `general-ledger` y
`cost-centers` por `branchId` (T614), pero sus pantallas **no tenían el selector**.

**Hecho (T623)**: el selector **Sucursal** (con «Todas las sucursales» por defecto) está en las
**cinco** pantallas, y un caso de Karma comprueba que el `branchId` elegido llega al API.
**Pendiente P4-bis**: el **balance general** (`/reports/balance-sheet`) no filtra en el API —su DTO
no tiene `branchId`—, así que su pantalla tampoco lo ofrece.

### P5/P12 · No hay un «asistente de sucursal» — **CERRADO (T633)**

Hoy son **cuatro altas** en cuatro pantallas (sucursal, almacén, matriz del artículo, usuario) y
el usuario puede dejar la mitad hecha. **Qué propongo**: un flujo en el Centro de configuración
(el `setup-overview` ya existe) que las haga en orden, con la matriz del artículo y la serie
resueltas, y que al final ofrezca «entrar como este usuario» para probar. Criterio: una sucursal
operativa (puede facturar) en un solo recorrido.

### P6 · El 403 de «otra sucursal» en documentos necesita una salida en la UI — **CERRADO (T625)**

**Medido**: el mensaje ya era claro («pide la operación a un usuario de esa sucursal») y el
interceptor lo mostraba tal cual, pero no ofrecía salida.

**Hecho (T625)**: ante **ese** 403, el formulario devuelve la sucursal a la del usuario (y el
almacén dentro de ella) con un aviso que dice lo que pasó; cualquier otro error sigue igual y sin
sucursal (SUPERADMIN) no se inventa nada. La regla no se relajó: el documento sigue siendo de la
sucursal del usuario. Tres casos de Karma lo fijan.

### P9 · Caso «sin seed»: crear cliente y artículo con su precio por pantalla — **CERRADO (T629/T630/T631)**

**Medido**: el caso por pantalla tomaba `CLI-00001` y `ART-00002` de los datos sembrados, así que
probaba el circuito con datos que el usuario no creó; y al intentar crearlos desde la pantalla
aparecieron **dos** defectos: el formulario **no preselecciona** las tres unidades de medida, y el
alta de artículo respondía **400** porque el formulario manda `iceBasis`/`iceRate`/
`iceAmountPerUnit` y **ni `CreateItemDto` ni `UpdateItemDto` los declaraban** (las columnas sí
existen en el modelo) — con `forbidNonWhitelisted`, crear un artículo por pantalla era imposible.

**Hecho**: las tres columnas del ICE entraron en los dos DTO con su validación (T630) y el caso 0-b
da de alta **cliente** y **artículo** por pantalla (nombre, Venta + Inventario, las tres UoM, lista
de precios y precio 100) y factura con ellos. **Medido**: `alta-sucursal-ui.spec.ts` **8/8 en
5,3 min**; backend **4157/4157**, `gate:rapido` **7/7**.

**Pendiente P13**: la **lista de precios** sigue viniendo del tenant (es prerrequisito del artículo
y el formulario la exige); crearla por pantalla cerraría el «sin seed» del todo.

## 3. Orden propuesto

1. **P2-bis** — sin la matriz del almacén, la sucursal se crea y no opera: es lo que deja el caso
   de Playwright en rojo.
2. **P2** — un 500 en un alta es un defecto de contrato.
3. **P3** y **P4** — baratos y de alto valor percibido (el cupo y la lectura contable por sucursal).
4. **P5** — el asistente, cuando 1–4 estén en verde: es el que convierte cuatro pantallas en un
   producto.
5. **P6** — el remate de UX.

## 4. Lo que queda en rojo hoy

**Nada del plan.** Los quince puntos están cerrados: P1 (no era defecto), P2 (no reproducible, contrato fijado), P2-bis, P3, P3-bis, P4/T637, P5/P12, P6, P9/T631, más los que nacieron del ejercicio (T623, T624, T626-T628, T633-T638). El caso por pantalla va **10/10** y no lee **nada** del seed: crea la lista de precios, el cliente, el artículo, la sucursal con su almacén y su usuario, factura y lee el informe.

Lo que **no** está cerrado son las propuestas que aparecieron **después** del cierre y están anotadas arriba con su medición: el precio a 0 ya no es silencioso (T632) y el servidor lo resuelve (T638), pero el **balance general** sigue sin una prueba por pantalla propia (solo API + Karma). Es el siguiente borde natural, no una deuda del plan.

