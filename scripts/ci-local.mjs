#!/usr/bin/env node
/**
 * ci-local.mjs — **gate agregado local de la raíz (la tienda)**.
 *
 * POR QUÉ EXISTE. El CI de la raíz (`.github/workflows/ci.yml`, «Storefront CI») es la red de la
 * tienda y durante un tiempo **no se pudo ejecutar**: los jobs morían en ~2 s con **0 pasos** y sin
 * runner («The job was not started because recent account payments have failed or your spending limit
 * needs to be increased»).
 *
 * **ESO YA NO ES VERDAD, Y AQUÍ ESTABA ESCRITO COMO SI LO FUERA** (corregido el 2026-10-12). El repo
 * raíz es **público**, así que sus runs se leen **sin credenciales** por la API de GitHub. Medido:
 * **13 runs** — **9 verdes**, **4 rojos** — y los jobs corren de verdad: el run **10** (`a493c304`)
 * salió **verde con 13 pasos en 66 s**, con `Checkout`, `Setup Node.js`, `Install dependencies`,
 * `typecheck`, `lint` y `build` ejecutados. Los runs **11, 12 y 13** (`a61a8ff7`, `50a0f384`,
 * `322f701`) están rojos por un **defecto de CÓDIGO** del gate de las cifras, no por facturación: su
 * autoprueba leía un fichero ancla de `backend-erp/` —repo que este CI no clona— y abortaba con
 * `anclas-reales-ilegibles` (código 2) **antes** de llegar a la tienda, así que `typecheck`, `lint` y
 * `build` salían **`skipped`**. Corregido en `scripts/audit-agents-figures.mjs` el 2026-10-12; el
 * run del commit que trae esa corrección es la medida. Un banner que dice «el CI no se ejecuta»
 * cuando sí se ejecuta es un **diagnóstico falso**, y encima hace parecer inocuo lo que no lo es.
 *
 * Y aun así esto sigue siendo necesario —tiene que ser **honesto sobre lo que NO cubre** (banner en
 * la salida, no un README)— porque el CI de la raíz **no corre ninguna suite de la tienda** más allá
 * de `typecheck`/`lint`/`build`, y porque clona **solo la raíz**.
 *
 * QUÉ CORRE, Y EN QUÉ ORDEN. Los **6** pasos del job `typecheck-lint-build` del CI, **en su orden
 * exacto**, y **después cuatro más que el CI no tiene** (declarados como tales, ver abajo):
 *
 *   1. autoprueba del gate de workflows  (`npm run audit:workflow-inputs:self-test`)
 *   2. gate de workflows                 (`npm run audit:workflow-inputs`)
 *   3. cifras de `AGENTS.md`             (`npm run audit:agents-figures` — autoprueba + ratchet en
 *      un solo paso, porque su `--check` corre la autoprueba PRIMERO y no sigue al ratchet si está
 *      roja; el gate hermano sí necesita dos pasos porque su modo de auditoría no la incluye)
 *   4. `storefront/`: typecheck
 *   5. `storefront/`: lint   (`next lint --max-warnings=0`)
 *   6. `storefront/`: build  (`next build`)
 *   7. `storefront/`: `sync:tokens:check`  — **LOCAL, no está en el CI** (ver el párrafo siguiente)
 *   8. `backend-erp/`: `audit:invariants:coverage` — **LOCAL, no está en el CI** (ver abajo)
 *   9. `backend-erp/`: `audit:suppressions:check` — **LOCAL, no está en el CI** (ver abajo)
 *  10. `backend-erp/`: `audit:fixtures:check` — **LOCAL, no está en el CI** (ver abajo: el vínculo
 *      entre el fixture que reproduce un defecto medido y su `T` en `AUDIT.md`; noveno ratchet)
 *
 * Los pasos 1 a 3 corren **con `working-directory: .`** (la raíz) y **después** de `npm ci` de la
 * tienda, porque el lector YAML (`js-yaml`) se resuelve de `storefront/node_modules`; sin lector el
 * gate sale con **2** (ruidoso) y nunca en falso verde. Aquí se respeta ese orden.
 *
 * EL PASO 7 ES UNA VENTAJA LOCAL DECLARADA, NO UN PASO DEL CI. **Por qué no estaba**: el CI de la
 * raíz **no corre** las suites de la tienda —su job tiene esos 6 pasos— y este script se definió como
 * «el job del CI, en su orden», así que no las inventariaba. **Por qué entra** (medido, 2026-10-11):
 * sin él, `storefront/src/styles/tokens.css` se quedó **17 días** desincronizado de la capa de tokens
 * del ERP (`cfb6160`, 2026-09-24 → hoy) porque el ERP ganó `--z-mobile-overlay`/`--z-mobile-drawer`
 * (`erp-frontend` `6fdd8fd9`) y **ninguna puerta lo decía**: el `--check` existía, se podía correr y
 * nadie lo corría. Un gate que no está en ninguna puerta es un gate que no existe. Su `provenance` lo
 * marca como `LOCAL (no en el CI)` para que la salida no lo haga pasar por un paso del workflow: si
 * algún día entra a `ci.yml`, se cambia esa etiqueta **en el mismo commit**.
 *
 * DECISIÓN: EL PASO 7 **NO** ENTRA AL CI, Y ESTA ES SU MEDICIÓN (2026-10-12, encargo explícito de
 * decidirlo entre «añadirlo al workflow» y «dejarlo aquí y declarar por qué»). El criterio que lo
 * pedía es **correcto** —un gate que solo vive aquí no protege de un push que no lo corra, y eso es
 * exactamente lo que costó los 17 días— pero **el gate no puede correr en el árbol del CI**:
 *
 *   · Su fuente de verdad NO está en la raíz. `storefront/scripts/sync-tokens.mjs` lo dice en su
 *     cabecera y en sus rutas: `:29` `TOKENS_DIR = <raíz>/erp-frontend/src/styles/tokens`, `:30` la
 *     salida es `storefront/src/styles/tokens.css`. Un solo sentido: ERP → tienda.
 *   · Ese directorio **no existe en el árbol del CI**: `.gitignore` de la raíz ignora `/erp-frontend/`
 *     y `/backend-erp/` (repos anidados con `.git` propio), y `git ls-files erp-frontend` en la raíz
 *     devuelve **0** ficheros. Medido en un clon del repo raíz —que es literalmente lo que ve el CI—:
 *     `sync-tokens: no existe el directorio de tokens del ERP: .../erp-frontend/src/styles/tokens`
 *     ⇒ **exit 1, siempre**. Añadirlo tal cual dejaría el workflow rojo para siempre, y encima sin
 *     decir nada de la tienda.
 *   · La forma que SÍ funcionaría —un `actions/checkout` de `josecarlos3390/erp-frontend` con
 *     `path: erp-frontend`— exige una **credencial**, porque `erp-frontend` es **privado**. Medido con
 *     el ayudante de credenciales desactivado (`git -c credential.helper= ls-remote`, que es lo único
 *     que mide de verdad: con el `credential.helper=manager` de esta máquina el mismo comando sale
 *     **0** y MIENTE, porque usa una credencial guardada): `erp-frontend` y `backend-erp` salen **128**
 *     («could not read Password»), y `erp_suite` —el control— sale **0**. Lo mismo dice la API: `404`
 *     para los dos primeros, `200` con `"private": false` para la raíz.
 *   · Y ese secreto **no consta**: el historial completo de `.github/` de la raíz no contiene **ni una**
 *     aparición de `secrets.` (`git log --all -p -- .github`), y el propio histórico lo declara no
 *     medible desde aquí (`docs/plans/historial-sesiones.md:281`: «el estado de ese secreto no se mide
 *     desde este árbol»). Un checkout que depende de un secreto que **no se puede medir** es un gate
 *     que nadie sabe si funciona; y si falta, mata el job **entero** —incluidos el `typecheck`, el
 *     `lint` y el `build` de la tienda—, que es precisamente el modo de fallo que se acaba de medir y
 *     de corregir en `scripts/audit-agents-figures.mjs` (runs 11-13: los tres pasos de la tienda
 *     `skipped` por un gate que abortaba antes de llegar a ellos).
 *
 * DÓNDE VA ENTONCES: en el CI del **ERP**, que es donde cambia la fuente y donde **no hace falta
 * ningún secreto**, porque `erp_suite` es público (medido: `ls-remote` anónimo ⇒ 0) y ese CI puede
 * clonarlo con el token por defecto. Escribirlo allí exige editar `erp-frontend/`, que es de **SOLO
 * LECTURA** en esta sesión: queda declarado aquí, con su medición, para el incremento que sí pueda
 * tocarlo. Consecuencia declarada: **el desfase de tokens sigue sin puerta automática en un push que
 * no corra este script**, y ése es el agujero que esta decisión NO cierra.
 *
 * La etiqueta `LOCAL (no en el CI)` del paso 7 sigue siendo **verdad** (no entra al workflow), así que
 * NO se toca: cambiarla sería escribir lo contrario de lo que pasa.
 *
 * NO HAY `ci:local:full`, y no es un olvido: el CI de la raíz tiene **un solo job**, así que no hay
 * ningún job de CI que añadir. Las suites que la tienda tiene (`e2e`, `e2e:visual`, `e2e:a11y`,
 * `e2e:perf`, `sync:fonts:check`) **no las corre su CI** ni las corre este script; inventariarlas
 * sería inventar un gate que el CI no tiene y presentarlo como "lo del CI". Si algún día entran al
 * workflow, entran a este script en el mismo commit. (`sync:tokens:check` y
 * `audit:invariants:coverage` son las **dos excepciones**, declaradas arriba con su motivo medido.)
 *
 * VENTAJAS LOCALES DECLARADAS (**cinco**). (a) El CI de la raíz clona **solo el repo raíz**, así que
 * `erp-frontend/` y `backend-erp/` **no existen** en su árbol y el gate de workflows informa sus
 * cuatro workflows como «no presente en este árbol: se audita en su propio CI» (informativo). Aquí
 * los tres árboles existen: el gate audita **los cinco workflows del monorepo** y comprueba además
 * que las dos copias del gate en los repos anidados son **byte a byte** la canónica y que su CI las
 * **ejecuta**. Lo mismo vale para el gate de las cifras de `AGENTS.md`: aquí **corre los
 * instrumentos de los tres proyectos** y allí solo los de la raíz (el resto salen «NO MEDIDAS», con
 * su motivo y contadas). Es decir: en esos dos pasos concretos, **un verde local es más estricto**
 * que el del CI. (b) El **paso 7**, `sync:tokens:check`, que el CI **no corre en absoluto** (ver
 * arriba): es uno de los cuatro pasos de este script que **no existe** en el workflow, y va etiquetado
 * como tal. (c) El **paso 8**, `audit:invariants:coverage` del backend: comprueba que **toda
 * invariante que publica el instrumento tiene al menos un caso** en su `--self-test` (y corre los
 * casos). Vive en `backend-erp`, que el CI de la raíz no clona; su puerta obligatoria es el
 * `pre-push` del backend, y aquí se corre además para que un push local no lo deje atrás. (d) El
 * **paso 9**, `audit:suppressions:check` del backend: la primera regla de proceso del manual
 * («Nunca `--no-verify`») estrena gate —0 `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, 0
 * `eslint-disable` sin regla y 0 `xit`, con las directivas CON regla congeladas y su mapa—; vive en
 * `backend-erp`, que el CI de la raíz no clona, y su puerta obligatoria es el `pre-push` del backend.
 * (e) El **paso 10**, `audit:fixtures:check` del backend: el noveno ratchet, el **vínculo** entre el
 * fixture que reproduce un defecto medido y su `T` en `AUDIT.md` —toda marca `fixture-medido: T<nnn>`
 * con su `T` en el ledger, y toda spec que CITA un `T` en un comentario con su marca, con el mapa
 * congelado—. Vive en `backend-erp`, que el CI de la raíz no clona; su puerta obligatoria es el
 * `pre-push` del backend.
 *
 * LO QUE **NO** CUBRE (y por eso un verde aquí NO es un verde del CI):
 *
 *   1. **ENTORNO LIMPIO.** El CI es un runner Ubuntu recién creado con `npm ci` desde
 *      `storefront/package-lock.json` (sin `node_modules`, sin `.next`, sin cachés). Aquí se corre
 *      sobre tu árbol de trabajo: un paso que "pasa porque ya estaba construido" es el falso verde
 *      que este banner existe para no dejar leer mal.
 *   2. **PROCESO EN UTC.** El runner del CI arranca en **UTC**; esta máquina está en
 *      America/La_Paz. El job de la tienda **no declara `TZ`** (y no debe: nada del render depende de
 *      la zona en el build), así que aquí no se fija ninguna — pero el reloj del proceso **no es el
 *      mismo** y `next build` es sensible a fechas en páginas dinámicas.
 *   3. **VARIABLES DE RELLENO.** El CI no tiene `.env.local`, así que su `env:` pasa valores de
 *      relleno (`NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `STOREFRONT_API_KEY=ci-placeholder-no-se-usa`,
 *      `STOREFRONT_CITY=La Paz`, `ERP_API_URL=http://localhost:3000`, `ERP_TIMEOUT_MS=8000`) y **no
 *      se conecta a la API** (las páginas de la tienda son dinámicas). Aquí se lee
 *      `storefront/.env.local` (**no versionado**): el build de local inyecta **tus** valores. Un
 *      build que aquí pasa puede fallar allí por una variable, y al contrario. El script **no**
 *      sobrescribe el entorno.
 *   4. **SIN BASE DE DATOS NI API.** El CI no levanta ni `erp_db` ni el backend; el `build` no los
 *      llama. Aquí tampoco: si tu build empieza a necesitar la API, el CI lo va a decir antes que esto.
 *   5. **NODE DEL RUNNER.** El CI fija `node-version: '24'` **explícito** (la tienda no tiene
 *      `.nvmrc` a propósito: Vercel lee el del directorio raíz del proyecto y añadirlo cambiaría la
 *      versión de producción). Aquí manda el `node` del PATH, que el script imprime.
 *   6. **SISTEMA OPERATIVO.** El CI es Linux; esta máquina es Windows (rutas y finales de línea).
 *   7. **ARTEFACTO.** El `build` del CI **no se despliega** (Vercel construye el suyo). El verde de
 *      este paso **no** dice nada sobre el despliegue.
 *
 * Y ADEMÁS: el CI real HOY NO SE EJECUTA (facturación: jobs de ~2 s con 0 pasos). Un verde local no
 * lo sustituye.
 *
 * Uso:
 *   npm run ci:local
 *
 * Código de salida: 0 = todo verde · el del paso que falló = se detiene en el primer fallo, igual que
 * el hook de pre-push de los otros dos repos, y lo nombra.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const STOREFRONT = path.join(REPO, 'storefront');
const BACKEND = path.join(REPO, 'backend-erp');

const STEPS = [
  {
    provenance: 'CI typecheck-lint-build',
    label: 'autoprueba del gate de workflows',
    cmd: 'npm run audit:workflow-inputs:self-test',
    why: 'el CI lo corre desde la raíz, después del `npm ci` de la tienda (necesita el lector YAML)',
  },
  {
    provenance: 'CI typecheck-lint-build',
    label: 'gate de workflows',
    cmd: 'npm run audit:workflow-inputs',
    why: 'aquí audita los CINCO workflows del monorepo; el CI de la raíz solo ve los suyos (árbol sin los repos anidados)',
  },
  {
    provenance: 'CI typecheck-lint-build',
    label: 'cifras de AGENTS.md',
    cmd: 'npm run audit:agents-figures',
    why: 'autoprueba + ratchet en un paso: las cifras del manual contra sus instrumentos. Aquí mide los TRES árboles; el CI de la raíz solo tiene la raíz y declara el resto NO MEDIDAS (con su motivo)',
  },
  {
    provenance: 'CI typecheck-lint-build',
    label: 'typecheck (storefront)',
    cmd: 'npm run typecheck',
    cwd: STOREFRONT,
  },
  { provenance: 'CI typecheck-lint-build', label: 'lint (storefront)', cmd: 'npm run lint', cwd: STOREFRONT },
  { provenance: 'CI typecheck-lint-build', label: 'build (storefront)', cmd: 'npm run build', cwd: STOREFRONT },
  {
    provenance: 'LOCAL (no en el CI)',
    label: 'sync:tokens:check (storefront)',
    cmd: 'npm run sync:tokens:check',
    cwd: STOREFRONT,
    why: 'la tienda no lo corre su CI, y por eso NO estaba aquí: el artefacto tokens.css se quedo 17 dias desincronizado del ERP (2026-09-24 a 2026-10-11) sin que ninguna puerta lo dijera. Entra como ventaja LOCAL declarada; si entra a ci.yml, cambia esta etiqueta',
  },
  {
    provenance: 'LOCAL (no en el CI)',
    label: 'cobertura de invariantes (backend)',
    cmd: 'npm run audit:invariants:coverage',
    cwd: BACKEND,
    why: 'el gate vive en backend-erp (el CI de la raiz no clona ese arbol): corre los 61 casos del A/B —puros, sin BD— y falla si alguna invariante que PUBLICA measure() no tiene ninguno. Su puerta obligatoria es el pre-push del backend; aqui se corre ademas para no dejarlo atras en un push local',
  },
  {
    provenance: 'LOCAL (no en el CI)',
    label: 'supresiones (backend)',
    cmd: 'npm run audit:suppressions:check',
    cwd: BACKEND,
    why: 'la primera regla de proceso del manual («Nunca --no-verify») estrena gate: 0 @ts-ignore/@ts-expect-error/@ts-nocheck, 0 eslint-disable sin regla y 0 xit/.only, con las 32 directivas CON regla congeladas y su mapa por sitio. `--no-verify`/`--force` son COMANDOS y NO se gatean (prosa). Vive en backend-erp, que el CI de la raiz no clona; su puerta obligatoria es el pre-push del backend',
  },
  {
    provenance: 'LOCAL (no en el CI)',
    label: 'fixtures medidos (backend)',
    cmd: 'npm run audit:fixtures:check',
    cwd: BACKEND,
    why: 'el noveno ratchet: toda marca `fixture-medido: T<nnn>` tiene su T en AUDIT.md y toda spec que CITA un T en un comentario lleva la marca (mapa congelado: 112 ficheros / 199 pares). Es la mitad automatizable de «los fixtures que reproducen un defecto medido NO se tocan»; la otra mitad —comprobar qué payload real reproduce antes de arreglarlo— no la ve ningún gate y sigue en prosa. Vive en backend-erp; su puerta obligatoria es el pre-push del backend',
  },
];

// ---------------------------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------------------------

const line = (n = 100) => '─'.repeat(n);

function banner() {
  console.log(line());
  console.log(' ci:local — gate agregado LOCAL de la raíz / tienda (no es el CI)');
  console.log(line());
  console.log(` node ${process.version} · plataforma ${process.platform}/${process.arch} · TZ del proceso ${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(' CI de referencia: .github/workflows/ci.yml (job typecheck-lint-build, 6 pasos)');
  console.log(` pasos aqui: ${STEPS.length} (los 6 del CI + 4 LOCAL: sync:tokens:check, cobertura de invariantes, supresiones y fixtures medidos del backend)`);
  console.log(` cwd de los pasos de la tienda: ${STOREFRONT}`);
  console.log('');
  console.log(' LO QUE ESTE COMANDO **NO** CUBRE — un VERDE AQUÍ NO ES UN VERDE DEL CI:');
  console.log('   1. ENTORNO LIMPIO: el CI es un runner Linux recién creado con `npm ci` (sin node_modules,');
  console.log('      .next ni cachés). Aquí se corre sobre TU árbol de trabajo.');
  console.log('   2. PROCESO EN UTC: el runner arranca en UTC; esta máquina está en');
  console.log(`      ${Intl.DateTimeFormat().resolvedOptions().timeZone}. El job de la tienda no declara TZ, así que aquí tampoco se fija.`);
  console.log('   3. VARIABLES DE RELLENO: el CI no tiene `.env.local` y pasa valores de relleno que NO se usan');
  console.log('      (páginas dinámicas); aquí se lee storefront/.env.local (no versionado) y el build inyecta');
  console.log('      TUS valores. El script NO sobrescribe el entorno.');
  console.log('   4. SIN BD NI API: ni el CI ni esto levantan erp_db o el backend.');
  console.log('   5. NODE: el CI fija node-version 24 explícito (la tienda no tiene .nvmrc a propósito, por');
  console.log('      Vercel); aquí manda el `node` del PATH (arriba, impreso).');
  console.log('   6. SISTEMA OPERATIVO: el CI es Linux; aquí es Windows.');
  console.log('   7. ARTEFACTO: el build del CI no se despliega (Vercel construye el suyo). Este verde no dice');
  console.log('      nada del despliegue.');
  console.log('');
  console.log(' VENTAJAS LOCALES DECLARADAS (cinco): (a) el gate de workflows aquí audita los CINCO');
  console.log(' workflows del monorepo (el CI de la raíz clona solo la raíz y ve uno), y el de las cifras de');
  console.log(' AGENTS.md corre los instrumentos de los TRES proyectos (allí solo los de la raíz): en esos dos');
  console.log(' pasos, verde local es MÁS estricto; (b) el paso 7, que el CI no corre en absoluto; (c) el');
  console.log(' paso 8, el gate de cobertura de invariantes del backend, que el CI de la raíz tampoco corre; y');
  console.log(' (d) el paso 9, el gate de supresiones del backend (la regla «Nunca --no-verify»); y');
  console.log(' (e) el paso 10, el gate de fixtures medidos del backend (el vínculo marca ↔ AUDIT.md).');
  console.log('');
  console.log(' Y CUATRO PASOS QUE EL CI NO TIENE: [7] sync:tokens:check (storefront), [8] cobertura de');
  console.log(' invariantes (backend), [9] supresiones (backend) y [10] fixtures medidos (backend), con');
  console.log(' provenance «LOCAL (no en el CI)». El [7]');
  console.log(' entra porque tokens.css se quedó 17 días desincronizado del ERP sin que ninguna puerta lo');
  console.log(' dijera; el [8], el [9] y el [10] porque el CI de la raíz no clona `backend-erp` y su puerta');
  console.log(' obligatoria es el `pre-push` del backend: aquí se corren además para que un push local no deje');
  console.log(' una invariante sin caso, una supresión sin gate ni un fixture medido sin su diagnóstico.');
  console.log(' Ninguno de los cuatro es un paso del CI: no los lea como "lo del CI".');
  console.log('');
  console.log(' Y POR QUÉ **NO** ENTRA AL CI, medido: su fuente de verdad vive en `erp-frontend/src/styles/');
  console.log(' tokens/`, y el CI de la raíz clona SOLO la raíz (los repos anidados están gitignored), así');
  console.log(' que ahí el paso sale exit 1 siempre ("no existe el directorio de tokens del ERP"). La forma');
  console.log(' que sí funcionaría exige un secreto para clonar `erp-frontend`, que es PRIVADO — y ese');
  console.log(' secreto no consta en este repo (el historial de `.github/` no usa `secrets.` ni una vez). El');
  console.log(' detalle y las tres mediciones, en la cabecera de este script. El agujero NO queda cerrado:');
  console.log(' un push que no corra esto sigue sin puerta para los tokens.');
  console.log('');
  console.log(' Y ADEMÁS: el CI real SÍ SE EJECUTA (medido el 2026-10-12 contra la API pública de GitHub:');
  console.log(' 13 runs, 9 verdes y 4 rojos; el run 10, verde con 13 pasos en 66 s). La facturación lo tuvo');
  console.log(' parado y eso se quedó escrito aquí como si siguiera pasando: ya no. Los tres rojos más');
  console.log(' recientes eran un defecto de código del gate de las cifras, corregido el 2026-10-12.');
  console.log(line());
}

function summary(results, startedAt) {
  const total = Math.round((Date.now() - startedAt) / 1000);
  console.log('');
  console.log(line());
  console.log(` RESUMEN: ${results.length} pasos en verde en ${Math.floor(total / 60)}m${String(total % 60).padStart(2, '0')}s`);
  for (const r of results) {
    console.log(
      `   · ${r.provenance.padEnd(24)} ${r.label.padEnd(34)} ${String(Math.floor(r.secs / 60)).padStart(3)}m${String(r.secs % 60).padStart(2, '0')}s`,
    );
  }
  console.log('');
  console.log(' NO HAY `ci:local:full`: el CI de la raíz tiene un solo job. Las suites de la tienda (e2e,');
  console.log(' e2e:visual, e2e:a11y, e2e:perf, sync:fonts:check) NO las corre su CI y por eso NO están aquí:');
  console.log(' inventariarlas sería inventar un gate que el CI no tiene. Las excepciones son CUATRO, las cuatro');
  console.log(' con provenance «LOCAL (no en el CI)»: sync:tokens:check (paso 7), añadido tras medir que el');
  console.log(' artefacto tokens.css se quedó 17 días desincronizado del ERP sin que ninguna puerta lo dijera,');
  console.log(' audit:invariants:coverage (paso 8), el gate que exige caso para toda invariante publicada,');
  console.log(' audit:suppressions:check (paso 9), el de la regla «Nunca --no-verify», y');
  console.log(' audit:fixtures:check (paso 10), el vínculo entre el fixture medido y su T en AUDIT.md; de los');
  console.log(' tres últimos, la puerta obligatoria es el `pre-push` del backend (el CI de la raíz no clona');
  console.log(' ese árbol).');
  console.log(' Y la promoción del paso 7 al CI está DECIDIDA y medida el 2026-10-12: no puede entrar tal cual');
  console.log(' (su fuente, `erp-frontend/src/styles/tokens/`, no está en el árbol que el CI clona) y la forma');
  console.log(' que sí podría exige un secreto que no consta en este repo. El motivo completo, con las tres');
  console.log(' mediciones, está en la cabecera de este script; su sitio natural es el CI del ERP.');
  console.log('');
  console.log(' RECORDATORIO: verde LOCAL ≠ verde del CI (entorno limpio, UTC, npm ci, Linux y los valores de');
  console.log(' relleno del runner NO se reproducen aquí). El CI real SÍ corre (13 runs, 9 verdes), pero su');
  console.log(' árbol clona solo la raíz: por eso este script no es "el CI", y por eso los pasos 7 y 8 no');
  console.log(' pueden entrar a él tal cual (ver la cabecera).');
  console.log(line());
}

function fail(step, index, total, status, results, startedAt) {
  const pending = STEPS.slice(index + 1);
  console.log('');
  console.log(line());
  console.log(` ✗ PASO FALLIDO (${index + 1}/${total}): [${step.provenance}] ${step.label}`);
  console.log(`   comando : ${step.cmd}`);
  console.log(`   cwd     : ${step.cwd ?? REPO}`);
  console.log(`   codigo  : ${status === null ? 'desconocido (proceso no arrancó o murió por señal)' : status}`);
  if (step.why) console.log(`   nota    : ${step.why}`);
  if (pending.length) console.log(`   NO ejecutados (${pending.length}): ${pending.map((s) => s.label).join(' · ')}`);
  console.log('   Se detiene en el primer fallo, igual que el pre-push de los otros dos repos. Este rojo es');
  console.log('   LOCAL: el CI real no ha corrido (y hoy no puede: facturación).');
  console.log(line());
  summary(results, startedAt);
}

// ---------------------------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------------------------

function main() {
  if (process.argv.includes('--full')) {
    console.log(' aviso: la raíz no tiene `ci:local:full` (su CI tiene un solo job); se corre el gate normal.');
  }
  banner();
  const startedAt = Date.now();
  const results = [];

  // Se detiene en el PRIMER fallo, igual que el pre-push. `exitCode` y `return` en vez de
  // `process.exit()`: con la salida por tubería, un `exit()` puede truncar el informe (y el informe
  // ES parte del gate: tiene que verse entero).
  for (let index = 0; index < STEPS.length; index += 1) {
    const step = STEPS[index];
    console.log('');
    console.log(`[${index + 1}/${STEPS.length}] ${step.provenance} :: ${step.label}`);
    console.log(`  $ ${step.cmd}`);
    if (step.cwd) console.log(`  cwd ${step.cwd}`);
    if (step.why) console.log(`  (${step.why})`);

    const t0 = Date.now();
    const res = spawnSync(step.cmd, { cwd: step.cwd ?? REPO, shell: true, stdio: 'inherit' });
    const secs = Math.round((Date.now() - t0) / 1000);

    if (res.status !== 0) {
      fail(step, index, STEPS.length, res.status, results, startedAt);
      process.exitCode = typeof res.status === 'number' && res.status > 0 ? res.status : 1;
      return;
    }
    console.log(`  ✓ ${step.label} en ${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, '0')}s`);
    results.push({ ...step, secs });
  }

  summary(results, startedAt);
}

main();
