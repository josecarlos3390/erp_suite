/**
 * **preflight — prepara el árbol ANTES de los gates.**
 *
 * **No es un gate y no sustituye a ninguno**: `ci:local` (raíz) y el `pre-push` de cada repo siguen
 * siendo la puerta. Esto adelanta los **reparadores** que, si no se corren, hacen fallar el gate por
 * algo que el gate **no puede arreglar solo**:
 *
 *  1. `lint --fix` (backend): `gate:rapido` corre eslint **sin** `--fix`, así que un formato
 *     pendiente lo pone en rojo. Medido: cuatro ciclos perdidos en la campaña de comisiones.
 *  2. `audit:fixtures:update-baseline` (backend): una spec nueva con `fixture-medido:` es un
 *     **par nuevo** y el ratchet falla hasta que se congela.
 *  3. `smoke:routes:gen` (frontend): `audit:routes` valida los literales contra un manifiesto
 *     **generado**; una ruta nueva sin regenerarlo sale como **ROTA**.
 *  4. `audit:agents-figures` (raíz): si un instrumento se movió, el manual deja de decir la cifra.
 *     **Esto solo lo DIAGNOSTICA**: alinear `AGENTS.md` + las declaraciones es un cambio de
 *     documento y va en su commit (el gate lo exige en el mismo que el código).
 *
 * Uso: `npm run preflight`. Sale 0 si el árbol quedó listo; 1 si algo no se pudo preparar.
 */
import { spawnSync } from 'node:child_process';

/** Pasos que **escriben** (dejan el árbol listo) y el diagnóstico que solo informa. */
const REPARADORES = [
  {
    nombre: 'lint --fix (backend)',
    cwd: 'backend-erp',
    script: 'lint',
  },
  {
    nombre: 'baseline de fixtures (backend)',
    cwd: 'backend-erp',
    script: 'audit:fixtures:update-baseline',
  },
  {
    nombre: 'manifiesto de rutas (frontend)',
    cwd: 'erp-frontend',
    script: 'smoke:routes:gen',
  },
];

const DIAGNOSTICO = {
  nombre: 'cifras del manual (raíz)',
  cwd: '.',
  script: 'audit:agents-figures',
};

function correr(paso) {
  const r = spawnSync('npm', ['run', paso.script], {
    cwd: paso.cwd,
    stdio: 'inherit',
    shell: true,
  });
  return r.status === 0;
}

console.log('');
console.log('preflight — deja el árbol listo para los gates (no es un gate)');
console.log('');

let fallos = 0;
for (const paso of REPARADORES) {
  console.log(`[preflight] ${paso.nombre} …`);
  if (!correr(paso)) {
    fallos++;
    console.error(`[preflight] ✗ ${paso.nombre}`);
  }
}

console.log(`[preflight] ${DIAGNOSTICO.nombre} …`);
const figurasOk = correr(DIAGNOSTICO);
if (!figurasOk) {
  console.error(
    '[preflight] ✗ las cifras del manual no cuadran con sus instrumentos: alinea\n' +
      '           `AGENTS.md` y `scripts/audit-agents-figures.declarations.json` en el MISMO\n' +
      '           commit que el cambio que movió el instrumento (el gate lo exige así).',
  );
  fallos++;
}

console.log('');
if (fallos === 0) {
  console.log('preflight: árbol listo · ahora sí, `npm run ci:local` y el `pre-push` de cada repo');
} else {
  console.log(`preflight: ${fallos} paso(s) sin preparar — corrige y repite`);
}
process.exit(fallos === 0 ? 0 : 1);
