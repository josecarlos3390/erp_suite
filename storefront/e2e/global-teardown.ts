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
