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

### P3-bis · Crear una sucursal **se salta el cupo del plan** (nuevo, medido)

**Medido**: con la cuota en **5/5**, `POST /branches` creó su almacén y la dejó en **6/5**: el
chequeo del plan vive en `warehouses.service.create` y el alta de la sucursal crea el suyo por otra
vía. **Qué propongo**: decidir si la sucursal **cuenta** para el cupo (y entonces validarlo antes de
crearla, con un mensaje que diga qué hacer) o si no cuenta (y entonces documentarlo). Criterio: no
se puede quedar por encima del cupo sin una decisión explícita.



### P2 · `batch-upsert` de la matriz de almacenes **no es idempotente** (defecto)

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

### P4 · Los informes contables por sucursal no se ofrecen en la pantalla — **CERRADO (T623)**

**Medido**: el API filtra `trial-balance`, `income-statement`, `journal`, `general-ledger` y
`cost-centers` por `branchId` (T614), pero sus pantallas **no tenían el selector**.

**Hecho (T623)**: el selector **Sucursal** (con «Todas las sucursales» por defecto) está en las
**cinco** pantallas, y un caso de Karma comprueba que el `branchId` elegido llega al API.
**Pendiente P4-bis**: el **balance general** (`/reports/balance-sheet`) no filtra en el API —su DTO
no tiene `branchId`—, así que su pantalla tampoco lo ofrece.

### P5 · No hay un «asistente de sucursal»

Hoy son **cuatro altas** en cuatro pantallas (sucursal, almacén, matriz del artículo, usuario) y
el usuario puede dejar la mitad hecha. **Qué propongo**: un flujo en el Centro de configuración
(el `setup-overview` ya existe) que las haga en orden, con la matriz del artículo y la serie
resueltas, y que al final ofrezca «entrar como este usuario» para probar. Criterio: una sucursal
operativa (puede facturar) en un solo recorrido.

### P6 · El 403 de «otra sucursal» en documentos necesita una salida en la UI

**Medido**: el mensaje ya es claro («pide la operación a un usuario de esa sucursal») y el
interceptor lo muestra tal cual. Pero no ofrece **cambiar de sucursal**. **Qué propongo**: en el
403, un botón que cambie la sucursal activa (el chip) cuando el usuario tenga más de una. Criterio:
el aviso lleva a la acción, no solo la explica.

## 3. Orden propuesto

1. **P2-bis** — sin la matriz del almacén, la sucursal se crea y no opera: es lo que deja el caso
   de Playwright en rojo.
2. **P2** — un 500 en un alta es un defecto de contrato.
3. **P3** y **P4** — baratos y de alto valor percibido (el cupo y la lectura contable por sucursal).
4. **P5** — el asistente, cuando 1–4 estén en verde: es el que convierte cuatro pantallas en un
   producto.
5. **P6** — el remate de UX.

## 4. Lo que queda en rojo hoy

**Nada del alta por pantalla.** `erp-frontend/e2e/alta-sucursal-ui.spec.ts` va **6/6 en 5,5 min**:
sucursal, almacén y usuario creados por pantalla; el usuario nuevo entra, factura **en su** sucursal
y almacén (`branchId`/`warehouseId` verificados contra la factura creada) y el informe agrupado por
sucursal muestra su importe.

![Alta de sucursal por pantalla: informe por sucursal con la sucursal nueva](img/alta-sucursal-informe-por-sucursal.png)

Lo que sigue son los puntos **P3-bis a P6** de arriba (cupo del plan, informes contables por
sucursal en pantalla, asistente de sucursal y la salida del 403), ninguno bloqueante para operar.
