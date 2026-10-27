# Censo de permisos de ruta y de la sucursal del cuerpo (medido el 2026-10-26)

> **Qué es.** Los dos ítems que el 2026-10-26 vivían **solo en la conversación** y no tenían ancla
> en el repo: «F2 · **194 rutas heredan `view`**» y «el alta por sucursal del CUERPO
> (`user.defaultBranchId`) → **contrato de 13 endpoints**». Ninguno de los dos se pudo citar: el
> censo de abajo es lo que sí se midió hoy, con su instrumento y sus límites declarados.
>
> **Alcance.** Solo lectura: 11 ficheros `*.routes.ts` del frontend y 28 controllers del backend.
> **No** se ejecutó nada contra la API ni contra una base de datos.

---

## 1 · «194 rutas heredan `view`»

**El instrumento** (contó `path: '…'` y cada `permissionGuard([…])` en los 11 `*.routes.ts` de
`erp-frontend/src/app`; el script está abajo, en §3):

| Medida | Cifra |
|---|---|
| Ficheros `*.routes.ts` | **11** |
| Entradas `path: '…'` | **378** |
| Con `permissionGuard([…])` **propia** | **182** |
| **Sin guarda propia** (heredarían del padre) | **196** |
| De las guardas propias, **solo `:view`** | **109** |
| De las guardas propias, mixtas o de escritura | **73** |
| Permisos `:view` distintos | **79** |
| Permisos de escritura distintos | **66** |

**El «194» no reproduce con ninguna de estas definiciones.** Lo más cerca que queda es **196**
(entradas sin guarda propia), y **196 no es «heredan `view`»**: una ruta sin guarda propia hereda la
guarda del **padre**, que puede exigir escritura, y **eso no se midió** (hace falta el árbol de
rutas, no un recuento por texto). Las tres cifras candidatas —378 entradas, 196 sin guarda, 109
guardas que solo piden `:view`— son de cosas distintas y **no se comparan entre sí**.

**Contraste que descarta el «378 = pantallas».** El manifiesto del smoke de rutas, que sale del
router y está en el gate (`npm run smoke:routes:check`), publica **297 pantallas**. 378 es el número
de **entradas `path:`** (incluye hijos y redirects), no el de pantallas.

**Qué haría falta para cerrar el ítem** (y no se hizo): (a) fijar por escrito **qué** se cuenta
—pantalla del manifiesto, entrada `path:` o guarda—; (b) medir la guarda del **ancestro más
cercano** de cada entrada, que es lo que decide si «hereda `view`» o no.

## 2 · «El contrato de 13 endpoints de `defaultBranchId`»

**Lo medido, macizo:** `user.defaultBranchId` aparece **173 veces en 28 controllers**. De esas
menciones, **59** son la asignación del alta por defecto y **114** son otras (el `select` del token,
filtros, `if`). El reparto por fichero, de mayor a menor: `sale-invoices` 24, `sale-reserve-invoices`
21, `purchase-invoices` 18, `delivery-orders` 17, `purchase-receipts` 15, `purchase-reserve-invoices`
12, `sales-orders` 8, `incoming-payments` 4, `outgoing-payments` 4, `purchase-credit-notes` 4,
`purchase-returns` 4, `sales-credit-notes` 4, `stock-transfers` 4, … hasta 28 ficheros.

**El «13» no reproduce** como recuento de endpoints con este instrumento: 173 > 28 > 13. Si el 13
salía de un módulo o de una familia concreta, ese conjunto **no está escrito** y hoy no es citable.

**Lo que sí está medido, y es la decisión de fondo — la asimetría entre cuerpo y query:**

| Camino | Comportamiento medido | Sitio |
|---|---|---|
| **Cuerpo** (alta/edición) | `branchId` **ausente ⇒ se rellena con la sucursal del usuario** | `purchase-credit-notes.controller.ts:79-80`; `sales-credit-notes.controller.ts:80-81` |
| **Query** (listados) | `branchId` **ausente ⇒ NO filtra**: `branchId ? +branchId : undefined` ⇒ lista de todas las sucursales | `purchase-credit-notes.controller.ts:160`; `incoming-payments.controller.ts:182`; **31** listados con `@Query('branchId')` (censo de T329) |

Esa asimetría es defendible (un alta sin sucursal sería un documento huérfano; un listado sin filtro
debe enseñar todo), pero **no está escrita en ninguna guía**: `defaultBranchId` en `AGENTS.md`,
`BACKEND_GUIDE.md`, `FRONTEND_GUIDE.md` y `docs/guides/*.md` ⇒ **0 coincidencias**. Es un contrato
que hoy se deduce leyendo 28 controllers.

**La decisión que falta** (del usuario, no del código): si esa asimetría **es** el contrato y se
escribe en `BACKEND_GUIDE.md`, o si el listado debe heredar también la sucursal del usuario (cambio
de comportamiento: hoy los listados sin `?branchId` devuelven todas).

## 3 · Reproducción

```powershell
cd erp-frontend
node -e "const fs=require('fs'),p=require('path');let f=[];const w=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const q=p.join(d,e.name);e.isDirectory()?w(q):e.name.endsWith('.routes.ts')&&f.push(q)}};w('src/app');let en=0,g=0,v=0,m=0;for(const x of f){const s=fs.readFileSync(x,'utf8');en+=(s.match(/path:\s*'/g)||[]).length;const gs=[...s.matchAll(/permissionGuard\(\[([^\]]*)\]/g)];g+=gs.length;for(const y of gs){const ps=[...y[1].matchAll(/'([^']+)'/g)].map(z=>z[1]);ps.every(z=>z.endsWith(':view'))?v++:m++}}console.log({ficheros:f.length,entradas:en,guardaPropia:g,sinGuardaPropia:en-g,soloView:v,mixtas:m})"
```

```powershell
cd backend-erp
(Select-String -Path src/*/*.controller.ts -Pattern 'user\.defaultBranchId').Count   # 173
(Select-String -Path src/*/*.controller.ts -Pattern 'user\.defaultBranchId') | Group-Object Path | Measure-Object | % Count   # 28 ficheros
```

## 4 · Lo que NO se midió (declarado)

- **La herencia real de guardas**: qué ancestro guarda a cada una de las 196 entradas sin guarda
  propia. Exige el árbol de rutas, no un recuento por texto.
- **El comportamiento en ejecución**: si una cuenta **sin** permiso de escritura puede actuar en una
  pantalla que solo pide `:view`. Eso es API + una cuenta, y no se hizo.
- **El conjunto de los «13 endpoints»**: si existió, no está escrito; no se reconstruye por
  suposición.
- **El «194»**: no reproducido con tres definiciones distintas. Queda declarado, no adjudicado.
