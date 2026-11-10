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

1. **P2-bis** — sin la matriz del almacén, la sucursal se crea y no opera. **Cerrado (T622).**
2. **P2** — un 500 en un alta es un defecto de contrato. **No reproducible (T634)**, contrato fijado con e2e.
3. **P3** y **P4** — baratos y de alto valor percibido. **Cerrados** (T624/T626 y T623/T637/T640).
4. **P5** — el asistente. **Cerrado (T633).**
5. **P6** — el remate de UX. **Cerrado (T625).**

## 4. Estado consolidado: qué está cerrado, qué queda abierto y qué está declarado

### 4.1 · Cerrado, con su medición en el ledger

| Punto | LEDGER | Qué se cerró |
|---|---|---|
| P1 (documento en otra sucursal) | T621 | **no era defecto**: el contexto de prueba heredaba la sesión del administrador |
| P2 (`batch-upsert` 500) | T634 | **no reproducible**; contrato de idempotencia fijado con e2e (doble envío ⇒ mismo `id`, una fila) |
| P2-bis (almacén sin sembrar) | T622 | un solo motor (`provisionWarehouseForItems`); la sucursal nueva opera (stock 201) |
| P3 (cupo invisible) | T624 | «Almacenes activos: N / M» en la pantalla |
| P3-bis (sucursal se saltaba el cupo) | T626 | el alta de sucursal cuenta y valida el cupo |
| P4 / P4-bis (contabilidad por sucursal) | T623, T637, T640 | selector en las **seis** pantallas; balance general en API **y en pantalla** |
| P5/P12 (asistente) | T633 | sucursal + su almacén + su usuario en un flujo |
| P6 (403 sin salida) | T625 | el formulario vuelve a la sucursal del usuario y lo dice |
| P9 (caso «sin seed») | T629, T630, T631 | cliente, artículo y **lista de precios** creados por pantalla |
| P13 (lista de precios) | T631 | cerrado con el caso 0-a |
| Cupo parametrizable | T626, T636 | pacto por empresa, origen `PLAN`/`OVERRIDE`, aviso al 80 % (T635) |
| Facturar a precio 0 | T632, T638, T639, T641 | guard con `code`, precio resuelto en el servidor, control en la pantalla y contrato e2e |

### 4.2 · Abierto (con propuesta y criterio)

**P14 · T642 — un artículo creado por pantalla no opera en el almacén del administrador.** Medido: la
entrada de stock del artículo nuevo en «Almacén Principal» respondió **400** «no está habilitado para
operar en el almacén…», aunque `_autoEnrollItemWarehouses` escribe la fila en todos los almacenes
ACTIVE al crear el artículo. **La causa no está confirmada** (el arnés restaura `erp_test` y la sonda
posterior no pudo inspeccionar la matriz). Hipótesis: (a) el almacén no estaba ACTIVE en el instante
del alta; (b) el movimiento no mira la misma fila que siembra el alta. **Propuesta**: un e2e del
backend que cree el artículo y compruebe (matriz en **cada** almacén + entrada de stock **201** en
cada uno); si falla, sembrar desde el mismo motor de T622. **Prioridad: alta** — significa que un
artículo nuevo podría no venderse desde otra tienda.

**P15 · T641 — el diálogo «Facturar sin precio» no es alcanzable desde la UI.** `POST /items` y
`PATCH /items` rechazan el precio 0 de un artículo de venta con inventario, y T638 resuelve el precio:
el 400 solo llega con datos **importados** (lista de precios a 0). **Propuesta (decisión de
producto)**: o se permite el 0 en la ficha con una marca «sin precio autorizado», o el diálogo queda
como red para integraciones y se explica en la ayuda. Mientras tanto la pantalla ofrece el control
explícito (T639) y el contrato está cubierto por e2e (T641). **Prioridad: media** (es decisión, no
defecto).

**P16 · La migración T626 solo se ha ejercido en `erp_db`.** Se aplicó con `prisma migrate deploy`
(registrada en `_prisma_migrations`, `migrate status` al día), pero **`erp_test` se sincroniza con
`db push`** en el arnés, así que la migración no se ha ejecutado en la base de test. **Propuesta**:
que el arnés aplique `migrate deploy` (o un caso que verifique `_prisma_migrations`) y que el CI lo
haga en un entorno limpio. **Prioridad: media** (riesgo de despliegue, no de producto).

**P17 · El caso por pantalla usa un artículo del seed con existencia para el control de precio 0**
(consecuencia de P14: el artículo creado por pantalla no llega a facturarse en el almacén del
administrador). Se cierra solo cuando se cierre P14; entonces el paso 7 podrá usar el artículo creado
en 0-b.

**P18 · La regla de precio 0 vive en UNA ruta, no en el motor** — **declarado por inspección,
por medir**. `assertSinPrecioCero` y `resolverPreciosFaltantes` se llaman **solo** en
`createManual`; las seis rutas «desde cotización/pedido/entrega» (y las tres múltiples) **no** las
ejecutan, y la **factura de reserva** (`sale-reserve-invoices`) tampoco (0 coincidencias medidas con
el grep del repo). Consecuencia: una factura creada **desde** un documento de origen con una línea a
0 se emitiría en cero **sin decirlo**, que es el defecto que T632 cerró solo para el camino manual.
**Propuesta**: extraer las dos llamadas a un ayudante compartido por **todas** las rutas de venta
(un solo motor, como el resto del repo) y añadir un caso por familia —al menos «desde cotización»
con la línea a 0— antes de cerrarlo. **Prioridad: alta** (es el mismo defecto con otra puerta).

### 4.3 · Declarado (límites del arnés o de la medición, no defectos)

- **El arnés restaura `erp_test` al terminar**: una sonda posterior no puede inspeccionar el estado;
  la verificación tiene que ser **durante** la corrida (fue lo que impidió confirmar P14).
- **Login 5/min por IP**: el caso gasta **dos** logins (auth.setup + el usuario de la sucursal); un
  tercero dio **429** al medir, por eso el paso 7 reutiliza la sesión del administrador.
- **El `batch-upsert` no dio 500 en ninguna corrida de esta campaña** (T634): el defecto del ledger
  viejo no se reprodujo; la causa original no se conoce.
- **La pantalla de Plan deduce el pacto comparando números** (si coincide con el del plan, el campo
  queda vacío). Con `source` (T636) ya se puede hacer bien: **mejora anotada, no defecto**.
- **`PATCH /billing/limits` no valida el nuevo cupo contra el consumo actual** (se puede pactar un cupo
  menor que lo ya usado; la doctrina «no se degrada» lo permite, pero conviene avisar). Mejora anotada.

### 4.4 · Cobertura: qué camino tiene prueba y cuál no

| Camino | Cobertura |
|---|---|
| Alta por pantalla (sucursal, almacén, usuario, asistente) | **e2e** (pasos 1–3 y 0-c) + Karma |
| Cupo: ver, subir, aviso 80 %, origen | e2e (pasos 0) + Karma + unitarios backend |
| Facturación con el usuario nuevo y su sucursal | **e2e** (paso 4) |
| Informe por sucursal y balance general por sucursal | **e2e** (pasos 5 y 6) |
| Facturar sin precio: contrato 400/201 | **e2e backend** (T641) + unitarios |
| Control «facturar sin precio» | **e2e** (paso 7) |
| Diálogo tras el 400 | **no alcanzable por la UI** (P15) |
| `PATCH /billing/limits` | Karma + e2e del paso 0 (no hay Karma del componente con el PATCH) |
| Asistente con el cupo lleno | solo Karma (no hay e2e del error) |
| `source` del cupo | Karma + unitarios (no hay aserción por pantalla) |

Los tres últimos son huecos de **cobertura**, no de producto: se cierran añadiendo sus pasos cuando se
toque esa pantalla.
