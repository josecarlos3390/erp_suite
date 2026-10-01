import { execFileSync } from 'node:child_process';

import { ensureTodayExchangeRate } from './helpers/erp-api';

/**
 * **`globalSetup` del gate E2E de la tienda**: antes de la primera prueba se **volca la base de
 * desarrollo** y se calcula su **huella de contenido**, para poder dejarla exactamente como estaba
 * cuando la suite termine (`global-teardown.ts`).
 *
 * Por qué existe (medido y declarado en el §24 del plan y en el README): el E2E funcional
 * **escribe de verdad** contra la base de desarrollo —pedidos web, pedidos de venta, entregas,
 * asientos, reseñas y solicitudes—, así que cada corrida la ensuciaba y había que restaurarla a
 * mano con `npm run db:recreate`. Ahora la restauración es parte del arnés y **se verifica** con
 * una huella de **198** tablas.
 *
 * La lógica vive en `e2e/harness/db-snapshot.mjs` (un solo sitio, también usable a mano con
 * `npm run e2e:restore-db`); aquí solo se invoca: Playwright transpila estos `globalSetup` a
 * CommonJS y compartir módulos ESM con el helper rompía (`import.meta`), así que el contrato es
 * **una línea JSON por `stdout`**.
 *
 * Si no hay `pg_dump`/`psql` el gate **no** se rompe: se avisa con el motivo y se recuerda el
 * comando manual. Un volcado de una corrida anterior sin restaurar también se avisa.
 */
/** Respuesta del helper (`e2e/harness/db-snapshot.mjs`): una línea JSON por `stdout`. */
interface HarnessPayload {
  ok?: boolean;
  reason?: string;
  database?: string;
  bytes?: number;
  tables?: number;
  sha256?: string;
  changed?: string[];
  pending?: { startedAt: string; dump: string } | null;
}

export default async function globalSetup(): Promise<void> {
  const script = 'e2e/harness/db-snapshot.mjs';

  const status = run(script, 'status');
  if (status?.pending != null) {
    console.warn(
      `[arnes] ATENCION: quedaba un volcado sin restaurar de ${status.pending.startedAt}; se ` +
        'sobrescribe con el de esta corrida (si querias aquel estado, ya no hay vuelta atras).',
    );
  }

  const snapshot = run(script, 'snapshot');
  if (snapshot === null || snapshot.ok !== true) {
    console.warn(
      `[arnes] sin volcado automatico (${snapshot?.reason ?? 'el helper no respondio'}). ` +
        'La suite escribira en la base de desarrollo; al terminar, restáurala con ' +
        '"cd backend-erp && npm run db:recreate".',
    );
    // Sin volcado **no** se provisiona nada: lo que se creara aqui se quedaria en la base.
    return;
  }

  console.log(
    `[arnes] base ${snapshot.database} volcada (${Math.round(Number(snapshot.bytes) / 1024)} kB) y ` +
      `huella de ${snapshot.tables} tablas: ${String(snapshot.sha256).slice(0, 12)}. ` +
      'Se restaurara y verificara al terminar.',
  );

  // §36 — el ERP **exige el tipo de cambio del día** para entregar y contabilizar, y la empresa lo
  // **teclea a mano cada día** (decision del usuario, 2026-10-01): sin el, un caso del gate se caia
  // por un requisito del **entorno** y no por el codigo. Se provisiona **despues** del volcado, asi
  // que el `teardown` lo revierte al restaurar la base.
  await provisionTodayExchangeRate();
}

/** Provisiona el tipo de cambio del día; **no** rompe el gate si el ERP no responde. */
async function provisionTodayExchangeRate(): Promise<void> {
  try {
    const result = await ensureTodayExchangeRate();
    if (result.created) {
      console.log(
        `[arnes] tipo de cambio de ${result.date} provisionado (USD/BOB ${result.rate}); ` +
          'se revertira con la base.',
      );
    } else if (result.rate === null) {
      console.warn(
        '[arnes] no hay ningun tipo de cambio previo del par USD/BOB: no se provisiona nada.',
      );
    } else {
      console.log(`[arnes] el tipo de cambio de hoy ya existe (USD/BOB ${result.rate}).`);
    }
  } catch (error) {
    console.warn(
      `[arnes] no se pudo provisionar el tipo de cambio: ${(error as Error).message}`,
    );
  }
}

/** Ejecuta el helper y devuelve su JSON; `null` si no se pudo (se avisa, no se rompe el gate). */
function run(script: string, command: string): HarnessPayload | null {
  try {
    const stdout = execFileSync(process.execPath, [script, command], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    return parseLastLine(stdout);
  } catch (error) {
    // El helper sale con codigo != 0 y su motivo va en el JSON de stdout (o en stderr).
    return parseLastLine((error as { stdout?: string }).stdout ?? '');
  }
}

function parseLastLine(stdout: string): HarnessPayload | null {
  const line = stdout
    .trim()
    .split(/\r?\n/)
    .filter((value) => value !== '')
    .pop();
  if (line === undefined) return null;
  try {
    return JSON.parse(line) as HarnessPayload;
  } catch {
    return null;
  }
}
