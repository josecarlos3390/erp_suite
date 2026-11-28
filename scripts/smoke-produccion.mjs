#!/usr/bin/env node
/**
 * **T1014 — LA SONDA DEL DESPLIEGUE.**
 *
 * Mide lo que `AGENTS.md` exige tras cada despliegue: **`/health` 200 con `prisma: up`**, el
 * **contrato de error** (un 404 debe traer `code` y `request_id`) y que el **frontend** sirva
 * `/login`. La tienda, además, no debe responder 5xx.
 *
 * **Cada objetivo declara su ESTADO**:
 *   · `activo` → se mide y **falla** si no responde.
 *   · `pendiente-migracion` → **no se mide**: se dice por qué y **no** bloquea.
 *
 * **Por qué el estado y no borrar el script**: el 2026-11-28 la cuenta de Railway
 * **`josekilla3390` terminó su suscripción** y el servicio se fue con ella — **no es un defecto del
 * ERP**— y el backend **se migrará**. Mientras no haya destino:
 *   · dejarlo **rojo** todos los días es ruido que se aprende a ignorar;
 *   · decir **verde** sería mentir (no hay despliegue que medir).
 * Así que la sonda **declara** que no mide, y el día de la migración basta **cambiar el estado** y
 * la URL en este fichero para que vuelva a ser una puerta. **Una sonda que calla cuando no mide es
 * peor que ninguna**, por eso imprime el aviso y sale con **0** solo si **todo** está pendiente.
 *
 * Uso:
 *   node scripts/smoke-produccion.mjs           (sale 1 si algo ACTIVO está caído)
 *   node scripts/smoke-produccion.mjs --json
 */
const OBJETIVOS = [
  {
    nombre: 'backend /health',
    url: 'https://backend-erp-production-5c3b.up.railway.app/health',
    espera: 200,
    // **La suscripción de `josekilla3390` finalizó el 2026-11-28**: el dominio responde 404
    // «Application not found» porque el servicio ya no existe, no porque el ERP falle.
    estado: 'pendiente-migracion',
    motivo: 'la suscripción de la cuenta josekilla3390 (Railway) finalizó; el backend se migrará',
  },
  {
    nombre: 'frontend /login',
    url: 'https://erp-frontend.vercel.app/login',
    espera: 200,
    // El frontend **sirve**, pero su `apiUrl` apunta al backend que ya no existe: medirlo daría
    // un verde que no significa «la aplicación funciona».
    estado: 'pendiente-migracion',
    motivo: 'depende del backend pendiente de migración (su apiUrl apunta al servicio retirado)',
  },
  {
    nombre: 'tienda /',
    url: 'https://erp-storefront-inky.vercel.app/',
    espera: 200,
    estado: 'pendiente-migracion',
    motivo: 'responde 500 y depende del backend pendiente de migración',
  },
];

const CONTRATO_ERROR = 'https://backend-erp-production-5c3b.up.railway.app/health/no-existe';

async function medir(url) {
  const inicio = Date.now();
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const cuerpo = await r.text();
    return { status: r.status, ms: Date.now() - inicio, cuerpo };
  } catch (e) {
    return { status: 0, ms: Date.now() - inicio, cuerpo: String(e?.message ?? e) };
  }
}

const activos = OBJETIVOS.filter((o) => o.estado === 'activo');
const pendientes = OBJETIVOS.filter((o) => o.estado !== 'activo');

const resultados = [];
for (const o of activos) {
  const m = await medir(o.url);
  resultados.push({ ...o, ...m, ok: m.status === o.espera });
}

// **`prisma: up`**: un `/health` 200 no dice que la base responda.
const salud = resultados.find((r) => r.nombre === 'backend /health');
let prismaOk = null;
if (salud?.ok) {
  try {
    prismaOk = JSON.parse(salud.cuerpo)?.prisma === 'up';
  } catch {
    prismaOk = false;
  }
}

// **El contrato de error**: solo se comprueba si hay backend activo.
let contratoOk = null;
if (activos.some((o) => o.nombre === 'backend /health')) {
  const contrato = await medir(CONTRATO_ERROR);
  try {
    const j = JSON.parse(contrato.cuerpo);
    contratoOk = typeof j.code === 'string' && typeof j.request_id === 'string';
  } catch {
    contratoOk = false;
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ activos, pendientes, resultados, prismaOk, contratoOk }, null, 2));
} else {
  for (const r of resultados) {
    console.log(
      `  ${r.ok ? 'OK   ' : 'CAÍDO'} ${r.nombre.padEnd(16)} ${r.status} · ${r.ms}ms` +
        (r.ok ? '' : ` · ${r.cuerpo.slice(0, 90)}`),
    );
  }
  for (const p of pendientes) {
    console.log(`  ⏸ PENDIENTE  ${p.nombre.padEnd(16)} — ${p.motivo}`);
  }
  if (prismaOk != null) console.log(`  ${prismaOk ? 'OK   ' : 'CAÍDO'} prisma: up`);
  if (contratoOk != null)
    console.log(`  ${contratoOk ? 'OK   ' : 'CAÍDO'} contrato de error (code + request_id)`);
}

const fallos = resultados.filter((r) => !r.ok);
if (fallos.length > 0) {
  console.error(
    `\nROJO: ${fallos.length} comprobación(es) del despliegue ACTIVO sin pasar. ` +
      'Un despliegue que no se mide es un despliegue que no se sabe si ocurrió (T1014).',
  );
  process.exit(1);
}

if (resultados.length === 0) {
  console.log(
    '\n⏸ SIN DESPLIEGUE QUE MEDIR: todos los objetivos están pendientes de migración ' +
      '(la cuenta de Railway terminó su suscripción el 2026-11-28). La sonda queda lista: ' +
      'al migrar, cambia el `estado` a `activo` y la URL en este fichero.',
  );
  process.exit(0);
}

console.log('\nVERDE: el despliegue ACTIVO responde.');
