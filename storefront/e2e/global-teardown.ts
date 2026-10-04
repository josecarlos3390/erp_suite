import { execFileSync } from 'node:child_process';

/**
 * **`globalTeardown` del gate E2E de la tienda**: restaura el volcado que tomó `global-setup.ts`
 * y **verifica** con la huella de contenido que la base de desarrollo quedó **como estaba**.
 *
 * Un arnés que ensucia la base es un arnés roto: si la huella no coincide, aquí se **lanza** un
 * error con las tablas que cambiaron, así que la corrida se marca como fallida en vez de dejar la
 * base sucia en silencio. Si el volcado no se pudo tomar (máquina sin `pg_dump`) solo se avisa.
 *
 * `restore` del helper es idempotente: sin volcado pendiente no hace nada y sale con 0.
 */
/** Respuesta del helper (`e2e/harness/db-snapshot.mjs`): una línea JSON por `stdout`. */
interface HarnessPayload {
  ok?: boolean;
  reason?: string;
  database?: string;
  tables?: number;
  sha256?: string;
  changed?: string[];
  /** El helper **no pudo trabajar** por entorno (sin `pg_dump`/`psql`, `DATABASE_URL` inesperada). */
  unavailable?: boolean;
  /** No había volcado pendiente: nada que restaurar ni que verificar. */
  skipped?: boolean;
}

export default async function globalTeardown(): Promise<void> {
  const script = 'e2e/harness/db-snapshot.mjs';

  const result = run(script, 'restore');
  if (result === null) {
    console.warn(
      '[arnes] no se pudo restaurar la base de desarrollo (el helper no respondio). ' +
        'Comprueba con "npm run e2e:restore-db" o parte de cero con "cd backend-erp && npm run db:recreate".',
    );
    return;
  }
  if (result.ok === true) {
    console.log(
      `[arnes] base ${result.database} restaurada y verificada: huella identica ` +
        `(${String(result.sha256).slice(0, 12)}) en ${result.tables} tablas: la base de desarrollo ` +
        'quedo como estaba.',
    );
    return;
  }

  // «No pude trabajar» **no** es «la base quedó sucia»: se avisa y **no** se tumba el gate. Sin
  // esta rama, la frase de arriba («si el volcado no se pudo tomar solo se avisa») se cumplía en el
  // `globalSetup` pero **no** aquí: el helper respondía `ok:false` por entorno (por ejemplo una
  // `DATABASE_URL` inesperada o una máquina sin `pg_dump`) y el teardown **lanzaba**, dejando el
  // gate en rojo por un problema del entorno en vez de por la base (medido el 2026-10-04).
  if (result.unavailable === true) {
    console.warn(
      `[arnes] no se pudo verificar la base de desarrollo (${String(result.reason)}). ` +
        'La corrida fue sin arnes: si escribio en la base, restáurala con ' +
        '"cd backend-erp && npm run db:recreate".',
    );
    return;
  }

  // Sin volcado pendiente no hay nada que restaurar **ni que verificar**: no es un fallo. (Antes
  // esto caía en «no existe el volcado» y lanzaba, tumbando corridas que no ensuciaron nada.)
  if (result.skipped === true) {
    console.log(
      `[arnes] no habia volcado pendiente: nada que verificar (huella actual de ` +
        `${result.tables} tablas: ${String(result.sha256).slice(0, 12)}).`,
    );
    return;
  }

  const changed = Array.isArray(result.changed) ? (result.changed as string[]) : [];
  throw new Error(
    `[arnes] la base de desarrollo NO quedo como estaba (${String(result.reason)}).` +
      (changed.length === 0
        ? ''
        : ` Tablas distintas: ${changed.slice(0, 10).join('; ')}${changed.length > 10 ? ' …' : ''}.`) +
      ' El volcado de antes esta en test-results/db-snapshot.sql: restauralo con "npm run e2e:restore-db".',
  );
}

/** Ejecuta el helper y devuelve su JSON; `null` si no respondio. */
function run(script: string, command: string): HarnessPayload | null {
  try {
    const stdout = execFileSync(process.execPath, [script, command], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    return parseLastLine(stdout);
  } catch (error) {
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
