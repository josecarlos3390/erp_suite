#!/usr/bin/env node
/**
 * ci-local.mjs — **gate agregado local de la raíz (la tienda)**.
 *
 * POR QUÉ EXISTE. El CI de la raíz (`.github/workflows/ci.yml`, «Storefront CI») es la red de la
 * tienda y durante un tiempo **no se puede ejecutar**: los jobs mueren en ~2 s con **0 pasos** y sin
 * runner («The job was not started because recent account payments have failed or your spending limit
 * needs to be increased»). Mientras eso siga así, esto es la única red — y por eso tiene que ser
 * **honesto sobre lo que NO cubre** (banner en la salida, no un README).
 *
 * QUÉ CORRE, Y EN QUÉ ORDEN. El job `typecheck-lint-build` del CI **en su orden exacto**:
 *
 *   1. autoprueba del gate de workflows  (`npm run audit:workflow-inputs:self-test`)
 *   2. gate de workflows                 (`npm run audit:workflow-inputs`)
 *   3. `storefront/`: typecheck
 *   4. `storefront/`: lint   (`next lint --max-warnings=0`)
 *   5. `storefront/`: build  (`next build`)
 *
 * Los pasos 1 y 2 corren **con `working-directory: .`** (la raíz) y **después** de `npm ci` de la
 * tienda, porque el lector YAML (`js-yaml`) se resuelve de `storefront/node_modules`; sin lector el
 * gate sale con **2** (ruidoso) y nunca en falso verde. Aquí se respeta ese orden.
 *
 * NO HAY `ci:local:full`, y no es un olvido: el CI de la raíz tiene **un solo job**, así que no hay
 * ningún job de CI que añadir. Las suites que la tienda tiene (`e2e`, `e2e:visual`, `e2e:a11y`,
 * `e2e:perf`, `sync:tokens:check`, `sync:fonts:check`) **no las corre su CI**; inventariarlas aquí
 * sería inventar un gate que el CI no tiene y presentarlo como "lo del CI". Si algún día entran al
 * workflow, entran a este script en el mismo commit.
 *
 * ÚNICA VENTAJA LOCAL DECLARADA: el CI de la raíz clona **solo el repo raíz**, así que
 * `erp-frontend/` y `backend-erp/` **no existen** en su árbol y el gate de workflows informa sus
 * cuatro workflows como «no presente en este árbol: se audita en su propio CI» (informativo). Aquí
 * los tres árboles existen: el gate audita **los cinco workflows del monorepo** y comprueba además
 * que las dos copias del gate en los repos anidados son **byte a byte** la canónica y que su CI las
 * **ejecuta**. Es decir: en ese paso concreto, **un verde local es más estricto** que el del CI.
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
    label: 'typecheck (storefront)',
    cmd: 'npm run typecheck',
    cwd: STOREFRONT,
  },
  { provenance: 'CI typecheck-lint-build', label: 'lint (storefront)', cmd: 'npm run lint', cwd: STOREFRONT },
  { provenance: 'CI typecheck-lint-build', label: 'build (storefront)', cmd: 'npm run build', cwd: STOREFRONT },
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
  console.log(' CI de referencia: .github/workflows/ci.yml (job typecheck-lint-build, 5 pasos)');
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
  console.log(' ÚNICA VENTAJA LOCAL: el gate de workflows aquí audita los CINCO workflows del monorepo (el CI');
  console.log(' de la raíz clona solo la raíz y ve uno). En ese paso, verde local es MÁS estricto que el CI.');
  console.log('');
  console.log(' Y ADEMÁS: el CI real HOY NO SE EJECUTA (facturación: jobs de ~2 s con 0 pasos).');
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
  console.log(' e2e:visual, e2e:a11y, e2e:perf, sync:tokens:check, sync:fonts:check) NO las corre su CI y por');
  console.log(' eso NO están aquí: inventariarlas sería inventar un gate que el CI no tiene.');
  console.log('');
  console.log(' RECORDATORIO: verde LOCAL ≠ verde del CI (entorno limpio, UTC, npm ci, Linux y los valores de');
  console.log(' relleno del runner NO se reproducen aquí). El CI real está bloqueado por facturación.');
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
