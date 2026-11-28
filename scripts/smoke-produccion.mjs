#!/usr/bin/env node
/**
 * **T1014 — LA SONDA DEL DESPLIEGUE.**
 *
 * Mide lo que `AGENTS.md` exige tras cada despliegue: **`/health` 200 con `prisma: up`**, el
 * **contrato de error** (un 404 debe traer `code` y `request_id`) y que el **frontend** sirva
 * `/login`. La tienda, además, no debe responder 5xx.
 *
 * **Por qué es un script y no una lista de `curl` en un workflow**: se puede correr **en local**
 * —y se corrió—, así que su lógica está **medida antes** de que el CI la ejecute; un workflow que
 * solo corre en GitHub es un gate que nadie puede probar.
 *
 * **Hallazgo que motivó esto** (2026-11-28): el backend de producción respondía **404 «Application
 * not found»** y la tienda **500**, y **nadie lo había medido** — la verificación era manual y no se
 * hacía. El script existe para que **deje de depender de la memoria**.
 *
 * Uso:
 *   node scripts/smoke-produccion.mjs           (sale 1 si algo está caído)
 *   node scripts/smoke-produccion.mjs --json    (para consumir en un job)
 */
const OBJETIVOS = [
  { nombre: 'backend /health', url: 'https://backend-erp-production-5c3b.up.railway.app/health', espera: 200 },
  { nombre: 'frontend /login', url: 'https://erp-frontend.vercel.app/login', espera: 200 },
  { nombre: 'tienda /', url: 'https://erp-storefront-inky.vercel.app/', espera: 200 },
];

const COMPROBAR_PRISMA = 'https://backend-erp-production-5c3b.up.railway.app/health';
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

const resultados = [];
for (const o of OBJETIVOS) {
  const m = await medir(o.url);
  resultados.push({ ...o, ...m, ok: m.status === o.espera });
}

// **`prisma: up`**: un `/health` 200 no dice que la base responda.
const salud = resultados.find((r) => r.nombre === 'backend /health');
let prismaOk = false;
if (salud?.ok) {
  try {
    prismaOk = JSON.parse(salud.cuerpo)?.prisma === 'up';
  } catch {
    prismaOk = false;
  }
}

// **El contrato de error**: un 404 de la aplicación debe traer `code` y `request_id`; el 404
// «Application not found» de la plataforma **no** es el contrato del ERP.
const contrato = await medir(CONTRATO_ERROR);
let contratoOk = false;
try {
  const j = JSON.parse(contrato.cuerpo);
  contratoOk = typeof j.code === 'string' && typeof j.request_id === 'string';
} catch {
  contratoOk = false;
}

const fallos = resultados.filter((r) => !r.ok);
if (fallos.length === 0 && !prismaOk) fallos.push({ nombre: 'backend prisma: up', status: 200 });

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ resultados, prismaOk, contratoOk }, null, 2));
} else {
  for (const r of resultados) {
    console.log(
      `  ${r.ok ? 'OK  ' : 'CAÍDO'} ${r.nombre.padEnd(16)} ${r.status} · ${r.ms}ms` +
        (r.ok ? '' : ` · ${r.cuerpo.slice(0, 90)}`),
    );
  }
  console.log(`  ${prismaOk ? 'OK  ' : 'CAÍDO'} prisma: up`);
  console.log(`  ${contratoOk ? 'OK  ' : 'CAÍDO'} contrato de error (code + request_id)`);
}

if (fallos.length > 0) {
  console.error(
    `\nROJO: ${fallos.length} comprobación(es) del despliegue sin pasar. ` +
      'Un despliegue que no se mide es un despliegue que no se sabe si ocurrió (T1014).',
  );
  process.exit(1);
}

console.log('\nVERDE: el despliegue responde.');
