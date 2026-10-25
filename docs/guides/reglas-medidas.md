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
| Cantidad derivada publicada y leída en pantalla | `npm run audit:derived-invariants:check` | [`#cantidad-derivada`](#cantidad-derivada) |
| Un solo motor por dominio | `npm run audit:single-engine:check` | [`#un-solo-motor`](#un-solo-motor) |
| El mismo ALCANCE para el instrumento que MIDE y el que ACTÚA | `npm run audit:detectors:check` | [`#mismo-alcance`](#mismo-alcance) |

---

<a id="cero-no-nulos"></a>

## Cero `!` nuevos

> Bloque literal de `AGENTS.md` (commit base `2f3cc7f`), sin reescribir.

- **Cero `!` nuevos**, que desde el **2026-10-09** **tiene gate**: `npm run audit:non-null:check` en las
  **tres** puertas (CI, `pre-push`, `ci-local.mjs`), con la cifra **congelada en 1146** (medido el **2026-10-22** en `backend-erp`; `expresión!` 493
  + `x!: T` 653; 793 en producción, 353 en specs) — **la deuda está CONGELADA en su suelo MEDIDO**: el ratchet
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
  **El lote 2, el mismo día, pagó los dos ficheros más grandes del censo de dinero: 1454 → 1350**
  (`incoming-payments.service` **53** y `outgoing-payments.service` **51**), con **10** guardas nuevas
  por fichero para factura/anticipo/socio/cuenta bancaria y su caso con `null` **rojo antes** (el `!`
  escondía un `TypeError`, no un `null` de Prisma), un commit por fichero y la base congelada en el
  mismo commit (ver `CHANGELOG.md`).
  **El lote 3, el mismo día, pagó los dos documentos de venta: 1350 → 1265** (`sale-invoices.service`
  **47** y `sale-reserve-invoices.service` **38**), con la forma (a) para los ids de origen que no
  pertenecen al documento (`requireSourceLine`, **400** en vez del `TypeError` ⇒ 500) y para el socio
  de la entrega y el almacén de la FRV manual, y la forma (b) para los cinco sitios donde el valor ya
  era no nulo por la guarda (`headerSpec`, `item`, `ri`, los dos `Map.get` y el `baseDocId` de la
  lectura); **NUNCA `?? 0`** sobre un importe. Los dos A/B medidos con el servicio del commit padre:
  `Cannot read properties of undefined (reading 'items')` en las dos rutas `from-multi-*` de la FV y
  `Received promise resolved instead of rejected` en el alta manual de la FRV sin almacén.
  **El lote 4, el mismo día, cerró el camino de dinero: 1265 → 1157** — `delivery-orders` **19**
  (primero, el que más escribe stock), `purchase-receipts` **37**, `purchase-invoices` **32** y
  `purchase-credit-notes` **20**: **108** sitios, uno por commit y la base congelada en cada uno. Las
  formas del lote 3, sin inventar ninguna: `requireSourceLine` (**400**) para los ids de línea que no
  pertenecen al documento de origen, el estrechamiento equivalente (`Map.get` tras `has` ⇒ const
  capturada, `find(...)!` tras el bucle de validación ⇒ const/`requireSourceLine`, `customItem!` ⇒ la
  unión discriminada) y el `?.` ⇒ `?? null` **solo donde el null es semánticamente correcto**; los
  **`x!: T` de DTO no se tocaron**. **NUNCA `?? 0`** sobre un importe. Cuatro crashes que el `!`
  escondía, con su literal y su A/B: el **update de una línea de servicio sin almacén**
  (`PrismaClientValidationError: Argument 'warehouseId' must not be null` ⇒ 500) y el **alta manual de
  la FPI sin almacén** (columna `Int` obligatoria ⇒ 500), los dos con caso **rojo con el servicio del
  commit padre y verde con la guarda**; y el **`taxIndicatorId!` del alta desde pedido** (`id: null` a
  Prisma ⇒ 500) y el **`ri` de la factura desde recepción leído antes de su guarda**
  (`Cannot read properties of undefined (reading 'itemId')` ⇒ 500), corregidos sin caso propio
  (declarado: exigen los dobles completos de `from-order` y de `from-receipt`). Lo que queda del camino
  de dinero son **0** sitios de esta familia (ver
  `CHANGELOG.md`).
  **T307 pagó los 11 de RIESGO que ese censo dejó medidos y el ratchet llegó a su SUELO: 1157 → 1146**
  el 2026-10-22. Los **siete de fecha** son el mismo patrón —el día llega como string de query/DTO y el
  ayudante devuelve `null`—, y el `!` convertía ese `null` en un valor que llegaba a Prisma
  (`where.date: { gte: null }`, o `null` en una columna NO nulable ⇒ `PrismaClientValidationError` ⇒
  **500**): `exchange-rates`
  (`dateFrom`), `reports` (**2**: `from` y `to`), `stock-revaluations` (**2**: `dateFrom` y `dateTo`),
  `purchase-requests` (`postingDate`, columna NO nulable) y `timezone.util` (`resolveDocumentDate`, el
  ayudante canónico: la guarda es **única** y los llamadores no la repiten). Todos con **400** y el
  valor en el mensaje, ninguno con un valor por defecto: el 0 y el «hoy» **no** son correctos para un
  día que el cliente no mandó bien. El **8** (`sales-orders`) era un `quotations.find(...)!` con un
  `quotationId` de **LÍNEA ajeno a la ruta** ⇒ `requireSourceLine` (**400** `Cotización 99 no
  encontrada`), el patrón del lote 4. Los **3** del `prisma/seed` (categoría `MOB-EQUIPO`) estaban
  dentro de un `if` que ya comprobaba las tres cuentas: equivalencia evidente, pero ahora el seed
  **falla con el mensaje** que dice **qué cuenta falta** en vez de omitir la categoría en silencio. El
  **A/B**: los seis casos del día y el de `sales-orders` se vieron **rojos con el servicio del padre y
  verdes con la guarda**; el único con un `TypeError` real es `sales-orders`
  (`Cannot read properties of undefined (reading 'items')`), y los demás dicen lo que de verdad hacían
  —`Received promise resolved instead of rejected`, o `did not throw`—: el `null` cruzaba la frontera
  en vez de reventar en el doble. Lo que queda (**1 146**) es **legítimo por construcción**: **656**
  DTOs y controladores, **353** specs, **1** `currency!` declarado de dinero y **136** del resto (con
  guarda previa o tipo no nulo), así que **el censo no se equivocó en ninguno de los 11**.

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

<a id="cantidad-derivada"></a>

## La cantidad derivada que se publica y se lee en pantalla se entrega con su invariante citada y un caso que la compare.

> Regla del manual (T265). Gate desde el **2026-10-24**: `npm run audit:derived-invariants:check` en
> `backend-erp` (`scripts/audit-derived-invariants.mjs`), en el `ci:local` (paso 15) y en el `pre-push`.
> El texto de la convención sigue en `AGENTS.md` (Convenciones transversales) con la cifra vigente.

- **La regla.** Toda cantidad derivada que se **publique** en una respuesta del API y se **lea en
  pantalla** —pendiente, saldo, progreso, total, disponible, facturado, entregado, recibido,
  consumido…— se entrega con su **invariante canónica citada (`fichero:línea`) en su declaración** y
  con **un caso que la compare**; y se deriva de los documentos **ACTIVOS**, nunca de una columna
  denormalizada: puede estar desviada y nadie la mira, pero en cuanto alguien la lee publica un número
  falso.
- **El censo, y por qué la diana no es 65.** `npm run census:derived` (medido el **2026-10-24** en
  `backend-erp`) da **229** nombres censados y **72** diana (derivado + publicado + leído por el
  frontend); el manual decía **207 / 65** de una medición anterior, y la cifra se movió con el código.
  La diana es por **NOMBRE**: `totalPages` (paginación) y `pendingInvoice` (venta y compra, dos
  derivaciones) entran en el mismo conjunto; el registro lo declara y el `nota` avisa del homónimo.
- **Qué comprueba el gate.** El conjunto diana sale del **mismo motor** que el censo
  (`collectDerivedCensus()`, importado: no es una copia). Por cada nombre declarado en
  `scripts/derived-invariants.declarations.json`: (1) `invariante` resuelve como `fichero:línea`;
  (2) el texto citado **contiene la `evidencia`** declarada (el trozo de la fórmula); (3) la línea
  `declaracion` —la del registro del dueño, p. ej. `FLOW_QUANTITY_SOURCES`— **lleva esa cita**; (4) el
  `caso` es una spec y tiene un `expect(...)` que **nombra la cantidad** (paréntesis balanceados,
  multilínea incluida). `compara: true` declara además que ese caso compara la derivada con su
  invariante; se cuenta aparte (`conCompara`).
- **La medición, y el defecto que encontró.** De las **72** diana, **4** tienen hoy cita que resuelve y
  caso (**2** comparan de verdad: `delivered` y `pendingInvoice`, en
  `test/document-flow-chain.e2e-spec.ts`), y **68** quedan sin declarar (la línea base). Las **cuatro**
  citas que había en `FLOW_QUANTITY_SOURCES` estaban **CADUCADAS**: `delivered` y `pendingInvoice`
  citaban `delivery-orders.service.ts:4949-4952`, que hoy es la **paginación** del listado; `received`
  citaba `purchase-receipts.service.ts:1760-1800`, que es el **alta de cabecera**; y
  `pendingDelivery` citaba el **comentario** de los ayudantes de devoluciones. El gate las cazó con la
  evidencia y se corrigieron a la derivación real (`document-flow-chain.util.ts:441`, `:536`, `:549`,
  `:563`). `pendingReceipt` **no se declara**: su invariante (`document-flow-chain.util.ts:321`) no cita
  ningún `fichero:línea`, igual que `purchase.ordered` (`:263`); declararla sería una cita inventada.
- **El A/B.** Con el código del **padre** (las citas caducadas) y este registro,
  `node scripts/audit-derived-invariants.mjs --check` sale **ROJO**, literal: `✗ RATCHET EN ROJO: · cita
  ROTA en declaradas (4): delivered, pendingDelivery, pendingInvoice, received — el fichero/línea citado
  ya no resuelve; la declaración miente` y `EXIT=1`. Con las citas corregidas, **VERDE** (`diana=72
  sinDeclarar=68`). La autoprueba (`--self-test`) son **11 casos del evaluador (1 VERDE, 10 ROJOS) + 3
  del ratchet + 1 CONTROL real**, con el ROJO de «la línea citada NO contiene la evidencia».
- **Lo que NO cubre, declarado.** Que el `expect` compare **semánticamente** la derivada con su
  invariante no se puede automatizar (se declara con `compara` y su `nota`); el cruce «se lee en
  pantalla» es el del censo por texto sobre `erp-frontend/src` (si el frontend no está al lado, la diana
  sale 0 y el gate lo imprime como «no-disponible», no como un cero medido); y el gate **congela** la
  deuda, no la paga.

---

<a id="un-solo-motor"></a>

## Un solo motor por dominio: ninguna pantalla ni servicio replica la fórmula, la consumen.

> Regla del manual. Gate desde el **2026-10-24**: `npm run audit:single-engine:check` en `backend-erp`
> (`scripts/audit-single-engine.mjs`), en el `ci:local` (paso 17) y en el `pre-push`.

- **La regla.** Cada concepto derivado tiene **un** motor canónico; los ficheros ajenos lo **consumen**.
  El caso medido es el **progreso del pedido de venta** (`sales-orders`): la celda del listado y el
  recálculo tenían **dos** fórmulas del mismo concepto y se desviaban —medido en `PED-237`, la columna
  guardaba `FULL` y `GET /sales-orders/:id` respondía `PARTIAL`—. T220 dejó `computeSalesOrderProgress`
  como motor y **T316** quitó la segunda fórmula de `findAll`; el gate vigila que no vuelva.
- **Qué comprueba.** El registro `scripts/single-engine.declarations.json` declara, por concepto, su
  `motor` (`fichero:línea` + `evidencia` que tiene que estar en esa línea), los ficheros donde **no**
  puede aparecer una segunda fórmula (`prohibidoEn`, o `"*"` con `excepto`) y el `patron` de la fórmula,
  con el **AST** (no una regex sobre líneas): `asignacion` (un `deliveryStatus:`/`const invoiceStatus =`
  cuyo inicializador es un condicional o una binaria, salvo llamada al motor) o
  `expresion-binaria-con` (una expresión que recompone los operandos del motor). Un motor que se mueve o
  se renombra es rojo; una fórmula nueva es roja.
- **La medición: 4 conceptos, 1 con más de una implementación.** Medido el **2026-10-24** en
  `backend-erp`: **4** motores que resuelven con su evidencia; **0** segundas fórmulas en el **progreso
  del pedido** (el caso T316, verde); **2** en el **progreso de facturación de la ENTREGA** (el listado
  deriva su `invoiceStatus` en `delivery-orders.service.ts:4889` y `:4907`, mientras
  `recalcDeliveryOrderProgress` calcula el mismo campo desde el denormalizado `invoicedQty`: pueden
  desviarse); **3** copias del **stock disponible** (`Number(stock.stockPhysical) +
  Number(stock.stockOrdered) - Number(stock.stockCommitted)` en `assembly-orders.service.ts:330`,
  `kit-expansion.util.ts:97` e `items.service.ts:3582`, con el motor en `stock.util.ts:470`); **0** en el
  **saldo del socio** (los demás leen la columna). Total: **5 hallazgos** declarados como deuda.
- **El A/B.** Con una segunda fórmula de vuelta en `sales-orders.service.ts` (la sonda
  `const deliveryStatus = delivered >= ordered ? 'FULL' : …`), el informe publica `✗ SEGUNDA FÓRMULA en
  src/sales-orders/sales-orders.service.ts:4792: deliveryStatus = delivered >= ordered ? 'FULL' …` y
  `--check` sale **ROJO** —primero por el CONTROL de la autoprueba: `[FALLO] CONTROL · el motor real
  resuelve y sales-orders.service.ts sigue sin segunda fórmula — motoresRotos=0 hallazgos=1`, `EXIT=1`—;
  con la sonda fuera, **VERDE** (`conceptos=4 hallazgos=5`). La autoprueba son **9 casos del evaluador
  (3 VERDES, 6 ROJOS) + 3 del ratchet + 1 CONTROL real**, y el ROJO principal es el **código del PADRE
  de T316**: `deliveryStatus: deliverable === 0 ? 'FULL' : …` e `invoiceStatus: …` ⇒ 2 hallazgos.
- **Lo que NO cubre, declarado.** Una segunda derivación con **otra forma** (un helper local, un
  `reduce` que suma lo mismo) no la ve: el patrón es una **cota inferior** y por eso va escrito y
  revisado por concepto; las **escrituras denormalizadas** de `openQty` (`increment`/`decrement` en
  `delivery-orders.service.ts`) son otro camino y no se comparan; y el **precio**
  (`price-resolver.util.ts`) no se declara todavía: su fórmula multi-paso exige un patrón con casos, y
  una cota inferior con falsos positivos sería peor que ninguna.

---

<a id="mismo-alcance"></a>

## El instrumento que MIDE y el instrumento que ACTÚA tienen que tener el mismo ALCANCE.

> Regla del manual. Gate desde el **2026-10-24**: `npm run audit:detectors:check` en `backend-erp`
> (`scripts/audit-detectors-self-test.mjs`), en el `ci:local` (paso 16) y en el `pre-push`.

- **La regla.** Un censo orientado a líneas y un ejecutor con AST no ven lo mismo, así que el censo es
  una **cota inferior**; y **una métrica en 0 solo vale si el detector está probado contra los casos
  difíciles**. Caso medido, `AUDIT.md` **T126** (2026-09-14): el escáner del gate de dinero no veía los
  redondeos **multilínea** y el **0** con el que se cerró R2b era un artefacto; el valor real era
  **54**. Y los otros dos que se escaparon: la variable con **nombre distinto** (`timeZone` vs
  `settings.timeZone`, que dejó 4 sitios sin migrar mientras el contador global bajaba) y el fichero
  cuyo **sufijo no casa** con el filtro (`*.e2e-spec.ts` vs `*.spec.ts`, el primer rojo de
  `audit:spec-clock` dijo 6 en vez de 25).
- **Qué comprueba.** Deriva los `scripts/audit-*.mjs` del directorio (no los declara: un detector nuevo
  aparece solo) y **ejecuta** el `--self-test` de cada uno (un script que no arranca no es un gate). Para
  los declarados en `scripts/detectors-self-test.declarations.json` exige, por cada patrón que
  `aplica`—`multilinea`, `nombreDistinto`, `sufijo`—, un caso con **dos valores**: su `nombre` aparece
  en la salida **REAL** de la autoprueba (el caso se ejecutó) y su `fixture` (el literal del código
  difícil) está **DENTRO de la función de autoprueba**, comprobado con el **AST** (una fixture en un
  comentario no cuenta). Los detectores **sin** `--self-test` salen como hallazgo, con su motivo.
- **El censo (medido el 2026-10-24 en `backend-erp`).** **19** detectores; **17** con `--self-test` que
  arranca; **2** sin él —`audit-account-matrix.mjs` y `audit-independent-reconcile.mjs`: no declaran
  `--self-test` en el fuente y el flag correría la auditoría completa, así que no se ejecutan y se
  listan—; **5** declarados (2 con caso de sufijo: `audit-spec-clock` y `audit-derived-invariants`;
  `audit-day-helpers` con multilínea **y** nombre distinto; y 2 gates nuevos sin patrón aplicable); **12**
  con `--self-test` pero **sin** caso difícil declarado (deuda). Por patrón: **1** multilínea, **1**
  nombre distinto, **2** sufijo.
- **El A/B.** Se renombró una etiqueta del caso multilínea en `audit-day-helpers.mjs` (el caso se sigue
  ejecutando, pero ya no es el que el registro declara) ⇒ `npm run audit:detectors:check` sale **ROJO**,
  literal: `✗ RATCHET EN ROJO: · declaración ROTA en audit-day-helpers.mjs: multilinea: el nombre del
  caso NO aparece en la salida real — el caso que se cree cubierto no está en la autoprueba` y
  `EXIT=1`; restaurada, **VERDE** (`detectores=19 sinSelfTest=2 sinCasoDificil=12`). La autoprueba son
  **9 casos del evaluador (3 VERDES, 6 ROJOS) + 3 del ratchet + 1 CONTROL real** sobre
  `audit-day-helpers`, e incluye el rojo de la fixture **fuera** de la autoprueba.
- **Lo que NO cubre, declarado.** No prueba que el caso se ponga rojo al **estrechar el alcance** (eso
  exigiría mutar 16 detectores heterogéneos): comprueba que el caso **existe y se ejecuta**, y su
  `porQue` declara el rojo; la calidad del caso se revisa al declararlo. Los detectores que no son
  `audit-*.mjs` (`audit-tracking.ts`, `audit-invariants.ts`, `declare-return-anchors.ts`) quedan fuera
  de este censo y los corre el `pre-push` por otra vía.

---
