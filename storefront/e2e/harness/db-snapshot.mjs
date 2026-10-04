/**
 * `db-snapshot.mjs` — **deja la base de desarrollo como estaba** alrededor del gate E2E de la
 * tienda.
 *
 * El problema medido (declarado en el §24 del plan y en el README): el E2E funcional **escribe
 * de verdad** —pedidos web, pedidos de venta, entregas, asientos, reseñas, solicitudes— contra la
 * **base de desarrollo**, así que después de cada corrida la base local queda sucia y hay que
 * restaurarla a mano con `npm run db:recreate`.
 *
 * Lo que hace este módulo:
 *  1. **Antes** de la suite: volcado completo (`pg_dump`) + **huella de contenido** del esquema
 *     `public` (nº de filas y `md5` del contenido de **cada** tabla).
 *  2. **Después**: restaura el volcado (`psql`) y vuelve a calcular la huella. Si no coincide,
 *     lo dice con el detalle y **falla la corrida**: un arnés que ensucia la base es un arnés roto.
 *
 * Decisiones deliberadas:
 *  - **Sin dependencias nuevas**: `child_process`/`node:fs`/`node:crypto` y las herramientas de
 *    PostgreSQL que ya están instaladas (no entra un cliente de Postgres en JS).
 *  - **Si no se encuentran `pg_dump`/`psql`** (máquina sin PostgreSQL en el PATH ni instalado), el
 *    arnés **no rompe**: avisa con el motivo y deja el comando manual (`npm run db:recreate`).
 *     Medido en esta máquina: PostgreSQL 16.6 con `pg_dump`/`psql` en
 *    `C:\Program Files\PostgreSQL\<v>\bin`, volcado de **1,49 MB**.
 *  - La URL de la base se lee de `DATABASE_URL` o, si no está, del `.env` del backend (el mismo
 *    fichero que usa la API local). **La contraseña no se imprime nunca** ni viaja en la línea de
 *    comandos: va por `PGPASSWORD`.
 *  - **`e2e-harness` no toca nada más**: ni migraciones, ni semilla, ni `db:recreate`.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** `storefront/` (este fichero vive en `storefront/e2e/harness/`). */
export const STOREFRONT_DIR = join(HERE, '..', '..');
export const BACKEND_DIR = join(STOREFRONT_DIR, '..', 'backend-erp');
const STATE_FILE = join(STOREFRONT_DIR, 'test-results', 'db-snapshot.json');
const DUMP_FILE = join(STOREFRONT_DIR, 'test-results', 'db-snapshot.sql');
const FINGERPRINT_SQL = join(HERE, 'fingerprint.sql');

/**
 * Directorios candidatos con binarios de PostgreSQL, del **más nuevo al más viejo**.
 *
 * Hace falta la lista entera —y no solo «el primero que aparezca»— porque **la versión importa**:
 * medido en esta máquina, `pg_dump` de PostgreSQL **18** volca bien un servidor **16** pero su
 * salida incluye `SET transaction_timeout = 0`, que el 16 **rechaza** al restaurar. La regla que
 * se aplica es: usar las herramientas de la **misma versión mayor** que el servidor.
 */
function pgBinCandidates() {
  const candidates = [];
  const push = (dir) => {
    if (dir && existsSync(join(dir, process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump'))) {
      if (!candidates.includes(dir)) candidates.push(dir);
    }
  };

  push(process.env.PG_BIN?.trim());

  const onPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['pg_dump'], {
    encoding: 'utf8',
    shell: false,
  });
  if (onPath.status === 0 && onPath.stdout.trim() !== '') {
    push(dirname(onPath.stdout.split(/\r?\n/)[0].trim()));
  }

  // Windows: instalaciones estándar (se listan de la más nueva a la más vieja).
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL';
    if (existsSync(base)) {
      const versions = readdirSync(base)
        .filter((name) => /^\d+$/.test(name))
        .sort((a, b) => Number(b) - Number(a));
      for (const version of versions) push(join(base, version, 'bin'));
    }
  }
  return candidates;
}

/** `D:\...\PostgreSQL\16\bin` → `16` (versión mayor de las herramientas), o `null`. */
function majorOfBinDir(dir) {
  const match = /[\\/](\d+)[\\/]bin[\\/]?$/.exec(dir);
  return match === null ? null : Number(match[1]);
}

/** Versión mayor del **servidor** (`show server_version_num` → `160006` → `16`), o `null`. */
function serverMajor(psql, connection) {
  const result = run(psql, ['-h', connection.host, '-p', connection.port, '-U', connection.user, '-d', connection.database, '-t', '-A', '-c', 'show server_version_num'], connection);
  if (result.status !== 0) return null;
  const digits = result.stdout.trim();
  if (!/^\d+$/.test(digits)) return null;
  return Math.floor(Number(digits) / 10000);
}

/** `DATABASE_URL` del entorno o del `.env` del backend (sin imprimir la credencial). */
export function readDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const envFile = join(BACKEND_DIR, '.env');
  if (!existsSync(envFile)) return null;
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^\s*DATABASE_URL\s*=\s*(.+)\s*$/.exec(line);
    if (match) return match[1].replace(/^["']|["']$/g, '').trim();
  }
  return null;
}

/** Trocea la URL de conexión (se descarta el query string de Prisma). */
function parseDatabaseUrl(url) {
  const match = /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/.exec(url);
  if (!match) return null;
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

/** Entorno de las herramientas: la contraseña va por variable, **nunca** por argumento. */
function withCredentials(connection) {
  return { ...process.env, PGPASSWORD: connection.password };
}

function run(bin, args, connection) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    env: withCredentials(connection),
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** Contexto listo para usar, o el motivo por el que **no** se puede (sin romper la corrida). */
export function resolveContext() {
  const candidates = pgBinCandidates();
  if (candidates.length === 0) {
    return {
      ok: false,
      // `unavailable` distingue «no puedo trabajar aquí» (entorno) de «la base quedó distinta»
      // (fallo del gate): el teardown avisa en el primer caso y **lanza** solo en el segundo.
      unavailable: true,
      reason:
        'no se encontro pg_dump/psql (instala PostgreSQL o define PG_BIN con su carpeta bin)',
    };
  }
  const url = readDatabaseUrl();
  if (url === null) {
    return {
      ok: false,
      unavailable: true,
      reason: 'no se encontro DATABASE_URL ni el .env del backend',
    };
  }
  const connection = parseDatabaseUrl(url);
  if (connection === null) {
    return {
      ok: false,
      unavailable: true,
      reason: 'DATABASE_URL no tiene el formato esperado',
    };
  }

  // 1) Se pregunta la version del servidor con el primer candidato que conecte.
  // 2) Se usan las herramientas de **esa** version mayor (medido: las del 18 no restauran en un
  //    16 por `SET transaction_timeout`), y si no estan, el candidato mas nuevo.
  const exe = (dir, name) => join(dir, process.platform === 'win32' ? `${name}.exe` : name);
  let bin = candidates[0];
  for (const candidate of candidates) {
    const major = serverMajor(exe(candidate, 'psql'), connection);
    if (major !== null) {
      const exact = candidates.find((dir) => majorOfBinDir(dir) === major);
      bin = exact ?? candidate;
      break;
    }
  }

  return {
    ok: true,
    bin,
    connection,
    pgDump: exe(bin, 'pg_dump'),
    psql: exe(bin, 'psql'),
    database: `${connection.host}:${connection.port}/${connection.database}`,
  };
}

/** Volcado completo del esquema `public` (con `DROP` para poder restaurarlo encima). */
export function dumpDatabase(context, file = DUMP_FILE) {
  mkdirSync(dirname(file), { recursive: true });
  const result = run(
    context.pgDump,
    [
      '-h',
      context.connection.host,
      '-p',
      context.connection.port,
      '-U',
      context.connection.user,
      '-d',
      context.connection.database,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--no-comments',
      '-f',
      file,
    ],
    context.connection,
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr.trim().split(/\r?\n/).slice(-3).join(' ') };
  }
  if (!existsSync(file)) return { ok: false, error: 'pg_dump no escribio el fichero' };
  return { ok: true, file, bytes: readFileSync(file).length };
}

/** Restaura el volcado. `ON_ERROR_STOP` para que un fallo se vea en vez de pasar a medias. */
export function restoreDatabase(context, file = DUMP_FILE) {
  if (!existsSync(file)) return { ok: false, error: `no existe el volcado ${file}` };
  const result = run(
    context.psql,
    [
      '-h',
      context.connection.host,
      '-p',
      context.connection.port,
      '-U',
      context.connection.user,
      '-d',
      context.connection.database,
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-f',
      file,
    ],
    context.connection,
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr.trim().split(/\r?\n/).slice(-5).join(' ') };
  }
  return { ok: true };
}

/**
 * **Huella de contenido** del esquema `public`: por tabla, su número de filas y el `md5` de su
 * contenido. Es lo que permite afirmar «quedó como estaba» con una medición y no con una promesa.
 */
export function fingerprint(context) {
  const result = run(
    context.psql,
    [
      '-h',
      context.connection.host,
      '-p',
      context.connection.port,
      '-U',
      context.connection.user,
      '-d',
      context.connection.database,
      '-t',
      '-A',
      '-q',
      '-f',
      FINGERPRINT_SQL,
    ],
    context.connection,
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr.trim().split(/\r?\n/).slice(-3).join(' ') };
  }
  const body = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n');
  return {
    ok: true,
    body,
    sha256: createHash('sha256').update(body).digest('hex'),
    tables: body.split('\n').length,
  };
}

export function statePath() {
  return STATE_FILE;
}

export function dumpPath() {
  return DUMP_FILE;
}

export function readState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function writeState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function clearState() {
  rmSync(STATE_FILE, { force: true });
  rmSync(DUMP_FILE, { force: true });
}

/**
 * **Compara** dos huellas y devuelve las tablas que cambiaron (vacío = idénticas). Se compara por
 * tabla para que el mensaje diga **qué** quedó distinto, no solo que algo cambió.
 */
export function diffFingerprints(before, after) {
  const parse = (body) =>
    new Map(
      body.split('\n').map((line) => {
        const [name, rows, hash] = line.split(':');
        return [name, { rows, hash }];
      }),
    );
  const a = parse(before);
  const b = parse(after);
  const changed = [];
  for (const [name, left] of a) {
    const right = b.get(name);
    if (right === undefined) changed.push(`${name}: desaparecio`);
    else if (right.rows !== left.rows || right.hash !== left.hash) {
      changed.push(`${name}: ${left.rows}→${right.rows} filas`);
    }
  }
  for (const name of b.keys()) if (!a.has(name)) changed.push(`${name}: aparecio`);
  return changed;
}

/**
 * CLI (lo usan `e2e/global-setup.ts`, `e2e/global-teardown.ts` y `npm run e2e:restore-db`).
 *
 * **Contrato**: por `stdout` sale **una sola línea JSON** (para que el arnés de Playwright la
 * parsee) y todo lo humano va por `stderr`. El código de salida es 0 solo si la operación salió
 * bien, así que un fallo no puede pasar desapercibido.
 *
 * Comandos: `snapshot` (volcado + huella), `restore` (restaura y **verifica**), `fingerprint`
 * (solo la huella) y `status` (si quedó un volcado pendiente).
 */
const invokedDirectly = process.argv[1] !== undefined && process.argv[1].endsWith('db-snapshot.mjs');
if (invokedDirectly) {
  const command = process.argv[2] ?? 'status';
  const emit = (payload, code) => {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    process.exit(code);
  };
  const context = resolveContext();
  if (!context.ok) {
    console.error(`[arnes] no se puede trabajar con la base: ${context.reason}`);
    emit({ ok: false, unavailable: true, reason: context.reason }, 1);
  }

  if (command === 'snapshot') {
    const before = fingerprint(context);
    if (!before.ok) {
      console.error(`[arnes] no se pudo calcular la huella: ${before.error}`);
      emit({ ok: false, reason: before.error }, 1);
    }
    const dump = dumpDatabase(context);
    if (!dump.ok) {
      console.error(`[arnes] el volcado fallo: ${dump.error}`);
      emit({ ok: false, reason: dump.error }, 1);
    }
    writeState({
      startedAt: new Date().toISOString(),
      database: context.database,
      bytes: dump.bytes,
      dump: dumpPath(),
      fingerprint: before.body,
      sha256: before.sha256,
      tables: before.tables,
    });
    console.error(
      `[arnes] base ${context.database} volcada (${Math.round(dump.bytes / 1024)} kB); huella de ` +
        `${before.tables} tablas: ${before.sha256.slice(0, 12)}`,
    );
    emit(
      {
        ok: true,
        database: context.database,
        bytes: dump.bytes,
        tables: before.tables,
        sha256: before.sha256,
      },
      0,
    );
  }

  if (command === 'restore') {
    const state = readState();
    // Sin volcado pendiente no hay nada que restaurar **ni que verificar**: es «no aplica», no un
    // fallo. Antes esto caía en `restoreDatabase` → «no existe el volcado» → el teardown LANZABA y
    // tumbaba el gate de una corrida que no había ensuciado nada (medido el 2026-10-04).
    if (state === null || !existsSync(state.dump)) {
      const current = fingerprint(context);
      if (!current.ok) {
        console.error(`[arnes] no se pudo calcular la huella: ${current.error}`);
        emit({ ok: false, unavailable: true, reason: current.error }, 1);
      }
      console.error(
        '[arnes] no habia volcado pendiente: nada que restaurar ni que verificar ' +
          `(huella actual de ${current.tables} tablas: ${current.sha256.slice(0, 12)})`,
      );
      emit(
        {
          ok: true,
          skipped: true,
          database: context.database,
          tables: current.tables,
          sha256: current.sha256,
        },
        0,
      );
    }
    const restored = restoreDatabase(context);
    if (!restored.ok) {
      console.error(`[arnes] la restauracion fallo: ${restored.error}`);
      emit({ ok: false, reason: restored.error }, 1);
    }
    const after = fingerprint(context);
    if (!after.ok) {
      console.error(`[arnes] base restaurada, pero no se pudo recalcular la huella: ${after.error}`);
      emit({ ok: false, reason: after.error, restored: true }, 1);
    }
    const changed =
      state === null ? [] : diffFingerprints(state.fingerprint, after.body);
    if (changed.length > 0) {
      console.error(
        `[arnes] la base quedo DISTINTA en ${changed.length} tablas: ${changed.slice(0, 10).join('; ')}`,
      );
      emit({ ok: false, reason: 'la huella no coincide', changed, sha256: after.sha256 }, 1);
    }
    clearState();
    console.error(
      `[arnes] base ${context.database} restaurada y verificada: huella identica ` +
        `(${after.sha256.slice(0, 12)}) en ${after.tables} tablas`,
    );
    emit({ ok: true, database: context.database, tables: after.tables, sha256: after.sha256, changed: [] }, 0);
  }

  if (command === 'fingerprint') {
    const current = fingerprint(context);
    if (!current.ok) {
      console.error(`[arnes] no se pudo calcular la huella: ${current.error}`);
      emit({ ok: false, reason: current.error }, 1);
    }
    emit(
      { ok: true, database: context.database, tables: current.tables, sha256: current.sha256 },
      0,
    );
  }

  const state = readState();
  emit(
    {
      ok: true,
      database: context.database,
      pending: state === null ? null : { startedAt: state.startedAt, dump: state.dump },
    },
    0,
  );
}

