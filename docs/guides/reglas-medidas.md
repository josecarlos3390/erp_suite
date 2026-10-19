# Reglas medidas: texto íntegro de las reglas que `AGENTS.md` comprime

> **Qué es.** El texto **completo** de las reglas de proceso de `AGENTS.md` que se comprimieron a una
> línea porque **ya tienen un gate**. Cada entrada conserva el bloque original **palabra por palabra**,
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
> **Procedencia.** Bloques movidos desde `AGENTS.md` (commit base `2f3cc7f`). No se reescribió ni se
> borró una línea: son los mismos bytes, con el mismo CRLF.

## Índice

| Regla | Gate que la vigila | Ancla |
|---|---|---|
| Cero `!` nuevos | `npm run audit:non-null:check` | [`#cero-no-nulos`](#cero-no-nulos) |
| Un script que no arranca es un gate que no existe | `.husky/pre-push` + CI (self-test de tracking/reconcile) | [`#script-que-no-arranca`](#script-que-no-arranca) |
| Una puerta tiene que comprobar el VALOR | `npm run audit:workflow-inputs` | [`#puerta-comprueba-el-valor`](#puerta-comprueba-el-valor) |
| Un workflow que nunca se ejecuta | `npm run audit:workflow-inputs` | [`#workflow-que-nunca-se-ejecuta`](#workflow-que-nunca-se-ejecuta) |
| `typecheck:all` POR FICHERO | `npm run typecheck:all` | [`#typecheck-all-por-fichero`](#typecheck-all-por-fichero) |

---

<a id="cero-no-nulos"></a>

## Cero `!` nuevos

> Bloque literal de `AGENTS.md` (commit base `2f3cc7f`), sin reescribir.

- **Cero `!` nuevos**, que desde el **2026-10-09** **tiene gate**: `npm run audit:non-null:check` en las
  **tres** puertas (CI, `pre-push`, `ci-local.mjs`), con la cifra **congelada en 1498** (medido el **2026-10-16** en `backend-erp`; `expresión!` 845
  + `x!: T` 653; 1145 en producción, 353 en specs) — **la deuda está CONGELADA, no pagada**: el ratchet
  falla si **sube** (visto en rojo: 1601 → 1602, `exit 1`). Hasta ese gate la regla era un deseo, y el
  manual no la traía escrita en ningún sitio (medido); el detalle, en el `CHANGELOG.md` de la raíz.
  **La cifra BAJÓ de 1500 a 1498 el 2026-10-16** (T279): no subiendo la base, sino **quitando** las dos
  aserciones de `createBatchItem` (`test/test-utils.ts`), que pasan a una local con guarda.

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

