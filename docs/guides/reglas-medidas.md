# Reglas medidas: texto íntegro de las reglas que `AGENTS.md` comprime

> **Qué es.** El texto **completo** de las reglas de proceso de `AGENTS.md` que se comprimieron a una
> línea porque **ya tienen un gate** —y, desde el **2026-10-20**, una regla que nació **aquí** porque su
> caso se midió en el ledger antes de tener gate: [`#guard-falsificado`](#guard-falsificado), `AUDIT.md`
> T293—. Cada entrada conserva el bloque original **palabra por palabra**,
> con su título, su comando y su caso medido; `AGENTS.md` deja el título, el gate, una línea de por qué
> existe y el enlace a esta ancla.
>
> **Por qué.** El arnés inyecta solo los **primeros 65 536 B** de `AGENTS.md`; el manual estaba a
> **277 B** del corte. Una regla con gate se puede comprimir sin perder cumplimiento —el gate la
> vigila—; una regla **sin** gate no se movió: su prosa es su único cumplimiento. Las que siguen
> enteras en `AGENTS.md` lo están **a propósito**, no por olvido.
>
> **Cómo se verifica.** Un script en `%TEMP%` (no versionado) extrae cada bloque de `AGENTS.md` en el
> commit base y comprueba que aparece **byte a byte** en este archivo, con el mismo número de líneas y
> con cada comando, cifra y fecha. El informe del incremento declara el resultado y los bytes.
>
> **Procedencia.** Bloques movidos desde `AGENTS.md`: los cinco primeros desde el commit base
> `2f3cc7f`, el de la raíz desde `cf00645`, el de supresiones desde `6c28770` y el de fixtures desde `d8bbc24`. No se reescribió ni se
> borró una línea: son los mismos bytes, con el mismo CRLF.

## Índice

| Regla | Gate que la vigila | Ancla |
|---|---|---|
| Cero `!` nuevos | `npm run audit:non-null:check` | [`#cero-no-nulos`](#cero-no-nulos) |
| Un script que no arranca es un gate que no existe | `.husky/pre-push` + CI (self-test de tracking/reconcile) | [`#script-que-no-arranca`](#script-que-no-arranca) |
| Una puerta tiene que comprobar el VALOR | `npm run audit:workflow-inputs` | [`#puerta-comprueba-el-valor`](#puerta-comprueba-el-valor) |
| Un workflow que nunca se ejecuta | `npm run audit:workflow-inputs` | [`#workflow-que-nunca-se-ejecuta`](#workflow-que-nunca-se-ejecuta) |
| `typecheck:all` POR FICHERO | `npm run typecheck:all` | [`#typecheck-all-por-fichero`](#typecheck-all-por-fichero) |
| `/` → `/login` (router, no HTTP) | `e2e/auth-guard.spec.ts` (raíz sin sesión) | [`#raiz-a-login`](#raiz-a-login) |
| Nunca `--no-verify` | `npm run audit:suppressions:check` | [`#nunca-no-verify`](#nunca-no-verify) |
| Los fixtures que reproducen un defecto medido | `npm run audit:fixtures:check` | [`#fixtures-medidos`](#fixtures-medidos) |
| Un guard ya implementado se prueba falsificándolo | — (sin gate; su caso se declara en `AUDIT.md` T293) | [`#guard-falsificado`](#guard-falsificado) |

---

<a id="cero-no-nulos"></a>

## Cero `!` nuevos

> Bloque literal de `AGENTS.md` (commit base `2f3cc7f`), sin reescribir.

- **Cero `!` nuevos**, que desde el **2026-10-09** **tiene gate**: `npm run audit:non-null:check` en las
  **tres** puertas (CI, `pre-push`, `ci-local.mjs`), con la cifra **congelada en 1454** (medido el **2026-10-22** en `backend-erp`; `expresión!` 801
  + `x!: T` 653; 1101 en producción, 353 en specs) — **la deuda está CONGELADA, no pagada**: el ratchet
  falla si **sube** (visto en rojo: 1601 → 1602, `exit 1`). Hasta ese gate la regla era un deseo, y el
  manual no la traía escrita en ningún sitio (medido); el detalle, en el `CHANGELOG.md` de la raíz.
  **La cifra BAJÓ de 1500 a 1498 el 2026-10-16** (T279): no subiendo la base, sino **quitando** las dos
  aserciones de `createBatchItem` (`test/test-utils.ts`), que pasan a una local con guarda.
  **Y de 1498 a 1497 el 2026-10-19** (T291), quitando `dto.deliveryOrderId!` en `sales-returns`.
  **La deuda se empezó a PAGAR por riesgo el 2026-10-22 (T303, lote 1)**: **1497 → 1454** en las
  **12** utilidades y servicios del camino de dinero y stock (motor contable, notas de crédito,
  entradas/salidas/ajustes/traspasos de stock, devoluciones de compra, POS, ensamblaje y extractos),
  con el censo por riesgo (dinero y stock **341** · DTOs y controladores **656** · specs **353** ·
  resto de producción **147**), un commit por fichero y el `--update-baseline` en el mismo commit;
  el caso con `null` del POS quedó **rojo antes y verde después** (ver `CHANGELOG.md`).

---

<a id="script-que-no-arranca"></a>

## Un script que no arranca es un gate que no existe.

> Bloque literal de `AGENTS.md` (commit base `2f3cc7f`), sin reescribir.

- **Un script que no arranca es un gate que no existe.** Siete `scripts/*.mjs` tenían el `import` en la
  línea 1 y el **shebang en la 2** (Node solo lo acepta como primeros bytes) ⇒ `SyntaxError` siempre:
  `audit-tracking`, `audit-reconcile` y `audit-flow-links` eran **tres gates** que llevaban meses sin
  poder ejecutarse, y el CI moría antes de llamarlos. Regla: **ejecute el script, no lo parsee** — y
  si un `--self-test` no existe de verdad (hay scripts que **ignoran** los flags y corren la
  auditoría completa), **no invente el alias**: sería un gate que pasa por casualidad.

---

<a id="puerta-comprueba-el-valor"></a>

## Una puerta tiene que comprobar el VALOR, no solo que el texto sea válido.

> Bloque literal de `AGENTS.md` (commit base `2f3cc7f`), sin reescribir.

- **Una puerta tiene que comprobar el VALOR, no solo que el texto sea válido.** El 2026-10-08, al
  alinear `update-baselines.yml` con `ci.yml`, una sustitución dejó `node-version:` **sin valor** en los
  dos `setup-node` y el commit salió (`029f8447`, 08:52): el YAML **parsea** —medido con `yaml` 2.9.0:
  la clave existe y vale `null`—, así que el parseo dijo OK y el workflow **no fijaba Node alguno**.
  Corregido a `node-version-file: '.nvmrc'` cuatro minutos después (`424d7746`, aún sin empujar).
  **Ejecute el valor, no el documento.**

---

<a id="workflow-que-nunca-se-ejecuta"></a>

## Un workflow que nunca se ejecuta es un workflow que nadie sabe si funciona.

> Bloque literal de `AGENTS.md` (commit base `2f3cc7f`), sin reescribir.

- **Un workflow que nunca se ejecuta es un workflow que nadie sabe si funciona.**
  `update-baselines.yml` es solo `workflow_dispatch` y **no había corrido nunca**: su primer run murió
  en `Install dependencies` con `npm ci`/`EUSAGE` (`Missing: chokidar@4.0.3`) porque fijaba **Node 22**
  y el lock se regeneró con node:24 ⇒ `node-version-file: '.nvmrc'` (`424d7746`, el run verde; el
  commit roto es `029f8447`). Es hermana de «un script que no arranca es un gate que no existe». Ese
  mismo día, `ci.yml` tampoco tenía `workflow_dispatch` (`1d7b0e03`): «hacer el CI» exigía empujar y
  pagar el pre-push entero para ver un run.

---

<a id="typecheck-all-por-fichero"></a>

## `typecheck:all` POR FICHERO: el delta del ratchet y el `eslint` por fichero NO bastan.

> Bloque literal de `AGENTS.md` (commit base `2f3cc7f`), sin reescribir.

- **`typecheck:all` POR FICHERO: el delta del ratchet y el `eslint` por fichero NO bastan.** En el
  caso anterior, los tres ficheros con el import roto daban `eslint --max-warnings=0` **0** —es un
  error de **TIPO**, y `no-undef` no cubre un identificador de TypeScript— y el ratchet del `!` **bajó
  correctamente** (una importación no cambia el número de aserciones): **solo lo vio `typecheck:all`**.
  Desde ese hallazgo va **por fichero y no por tanda**: ~40 s más por commit a cambio de que ningún
  commit quede con un nombre que no existe (`backend-erp`, `d7fe712d`). Aplica a **cualquier** cambio,
  no solo a una migración.

---

<a id="raiz-a-login"></a>

## `/` → `/login` es del ROUTER DE ANGULAR, y por HTTP no se puede ver.

> Bloque literal de `AGENTS.md` (commit base `cf00645`), sin reescribir.

- **`/` → `/login` es del ROUTER DE ANGULAR, y por HTTP no se puede ver (medido el 2026-10-12).**
  El manual pedía «`/` → `/login`» y quien lo intentaba con `curl` **no podía pasarlo nunca** y
  podía declarar un fallo donde no lo hay: `GET /` devuelve **200**, `redirects=0` y **sin cabecera
  `location`**, y `GET /login` devuelve **el mismo shell** (mismo `sha256`, `E78FBD96…`). Se mide en
  **dos piezas**, porque son dos cosas distintas:
  - **Por HTTP: que `/` y `/login` sirven EL MISMO SHELL** (es lo que el servidor promete).
    `curl -s -o /tmp/r https://<front>/ && curl -s -o /tmp/l https://<front>/login &&
    sha256sum /tmp/r /tmp/l` ⇒ **el mismo hash**, **200** y **`redirects=0`** en los dos.
  - **Que la app NAVEGA a `/login`: sonda de navegador**, que es la única que ejecuta el router.
    Con Playwright, y **desde fuera de los repos** (el repo es de solo lectura):
    `page.goto('<front>/')` ⇒ `page.url()` termina en **`/login`**, con **0 errores de consola** y
    `app-root` con contenido (**4975** caracteres medidos: el shell del servidor trae el `<app-root>`
    vacío, así que 0 caracteres sería un fallo mudo). Se lanza con
    `npx playwright@<la versión del repo>` desde `%TEMP%`, o con el `playwright` de
    `erp-frontend/node_modules` resuelto por ruta absoluta (`NODE_PATH` **no** lo ve: ESM lo ignora).
  **La intención no cambia** —la app tiene que llevar al login—; lo que cambia es que ahora se
  **puede medir**, y que un `curl` a `/` que devuelva **200** es el resultado **esperado**, no un
  fallo.

---

<a id="nunca-no-verify"></a>

## Nunca `--no-verify`

> Bloque literal de `AGENTS.md` (commit base `6c28770`), sin reescribir.

- **Nunca `--no-verify`** (ni `--force`, `@ts-ignore`, `eslint-disable`, `xit`). El hook se arregla,
  no se salta. El proyecto lo mide, y no todo es cero: **0 usos** de `--no-verify`, `xit`, `@ts-ignore`
  y `as any`; `eslint-disable` **sólo con la regla nombrada**, y ese calificativo son **12** directivas
  **escritas a mano en `src/`** (8 `local/no-raw-without-tenant` + 4 `@typescript-eslint/no-require-imports`) —
  las **206** de `src/generated/` **no** nombran ninguna regla: son `/* eslint-disable */` **en bloque**,
  una por fichero de Prisma, y `eslint.config.mjs:19` las deja **fuera del lint**, así que la condición
  no las alcanza—; y `--force` **sólo** en `prisma migrate reset --force`,
  que es lo que ejecuta `db:recreate`. Las aserciones no nulas (`!`) van aparte, en la viñeta siguiente
  (medido el **2026-10-10** en `backend-erp`; el detalle, en el `CHANGELOG.md` de la raíz).

---

<a id="fixtures-medidos"></a>

## Los fixtures que reproducen un defecto medido NO se tocan.

> Bloque literal de `AGENTS.md` (commit base `d8bbc24`), sin reescribir, con su CRLF.

- **Los fixtures que reproducen un defecto medido NO se tocan.** Caso medido: **cuatro** casos de
  `preview-journal-entry-draft.dto.spec.ts` llevaban `date: '2026-09-25T00:00:00.000Z'` —un
  **instante**, no un día— y eran **el payload real de cuatro pantallas** (factura de venta, factura de
  compra, reserva de venta y reserva de compra). El cambio «obvio» —que el `date` del borrador tenga
  que ser un **día**— habría puesto **cuatro casos en verde** (el instante a medias, el 30 de febrero,
  la basura y el día válido) y habría **roto la función en producción**: el **400** que el propio spec
  existe para prevenir (T238). **Ningún gate lo habría cazado: solo los fixtures** —`eslint`,
  `typecheck:all` y el ratchet del `!` pasan igual con el validador equivocado—. Los fixtures que
  documentan un defecto medido son la **única prueba** de que el defecto existe tal como se describió;
  por eso la frontera acepta **las dos** formas y hay un caso que exige que el instante real **siga
  entrando** (`backend-erp`, `src/journal-entries/dto/preview-journal-entry-draft.dto.spec.ts`).
  **Antes de «arreglar» un fixture, compruebe qué payload real reproduce**: si el payload real es el
  que el caso rechaza, el que está mal es el validador, no el fixture.

---

<a id="guard-falsificado"></a>

## Un guard ya implementado se prueba FALSIFICÁNDOLO: se mutila, el caso se pone rojo y se revierte.

> Regla nueva (2026-10-20), con su caso medido en `AUDIT.md` **T293**. No se comprime de `AGENTS.md`
> porque **no tiene gate**: su prosa es su único cumplimiento. Es la hermana de «Toda invariante NUEVA
> entra con su A/B», que cubre la invariante nueva; ésta cubre el guard que **ya está** cerrado.

- **El problema.** Un guard ya implementado **no se puede ver en rojo**: el rojo de la FUNCIÓN está
  medido y no se puede volver a ejecutar sin deshacer el cierre. En T292/E2 el rojo de la función son
  dos `POST` ⇒ **201 + 201** y **452,00 Bs** por una venta de **226,00 Bs**; ese rojo ya vive en la
  suite E2E y en el ledger, y no se rehace.
- **El método.** Se **falsifica cada guarda**: se mutila el guard —se quita el `throw`, la comparación
  de ruta, la caducidad o se cambia el ancla—, se corre **su** caso y se exige el **rojo literal**;
  después se **revierte**. Si el caso no se pone rojo, el caso **no prueba esa guarda**. Al final:
  `git status` limpio y el fichero del guard **sin tocar**.
- **El caso medido (T293).** `backend-erp/src/common/idempotency.interceptor.spec.ts` (**8** casos):
  cinco mutaciones, cinco rojos y cinco reversiones; los literales están en la fila **T293**. El que
  más importa es el **ancla**: con la caducidad contada desde `completedAt`, el caso **ANCLA** —un
  `completedAt` de **25 h** con `createdAt` de **1 h**— deja de reproducir `FVE-1`/41 y crea un
  documento nuevo (id 999) ⇒ rojo. Ese caso es el que impide cambiar el ancla sin que un rojo lo diga.
- **Cómo se declara.** Cada mutación con su **rojo literal** y el caso que lo produce, más la
  **reversión comprobada**. Un A/B que solo dice «se puso rojo» no es un A/B: el literal es lo que
  distingue el rojo de la mutación del rojo de un caso mal escrito. Y esto **no sustituye** al rojo de
  la función: la suite que la mide de punta a punta sigue siendo la prueba de que el defecto existía.

---
