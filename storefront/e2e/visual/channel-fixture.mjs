#!/usr/bin/env node
/**
 * Fixture del canal del ERP para el **gate visual de la tienda** (F9.6).
 *
 * **Por que existe.** El E2E funcional de la tienda corre contra el ERP real y el
 * seed de desarrollo (es su virtud: mide el producto). Un *gate visual* necesita
 * lo contrario: las mismas cifras, los mismos nombres y la misma existencia en
 * cada corrida, porque una captura de referencia que cambia con el seed no
 * distingue «se rompio el diseno» de «cambio el dato». Este proceso es un proxy
 * del canal `GET/POST /storefront/...` que **grabo** las respuestas reales una vez
 * (modo `--record`, commit `e2e/visual/fixtures/`) y las **repite** en cada
 * corrida. La tienda no sabe que esta detras: sigue llamando a `ERP_API_URL`.
 *
 * Modos:
 *   node e2e/visual/channel-fixture.mjs            → repetir (por defecto). Un
 *     endpoint sin fixture responde **599** y lo registra: el spec visual falla
 *     visiblemente en vez de capturar una pantalla de error como si fuera buena.
 *   node e2e/visual/channel-fixture.mjs --record   → reenviar al ERP real y
 *     guardar cada respuesta (requiere la API en marcha).
 *
 * La clave de cada entrada es `METODO ruta?query#hash(cuerpo)`. En los POST se
 * **descarta `idempotencyKey`** antes de calcular el hash: la tienda genera una
 * clave nueva por intento (D-nonce) y su valor no cambia la respuesta, pero si
 * cambiaria el hash y el fixture no se encontraria nunca.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const PORT = Number.parseInt(process.env.FIXTURE_PORT ?? '3299', 10);
const UPSTREAM = process.env.ERP_UPSTREAM ?? 'http://localhost:3001';
const RECORD = process.argv.includes('--record');
const DIR = join(process.cwd(), 'e2e', 'visual', 'fixtures');
/**
 * Clave del canal con la que se **graba**. La tienda que corre contra el fixture
 * manda una clave cualquiera (`fixture-visual`) porque el fixture no la comprueba;
 * al reenviar al ERP real hay que usar la de desarrollo, y la pone el proxy: asi el
 * modo grabacion no depende de lo que tenga configurado la tienda.
 */
const UPSTREAM_KEY = process.env.ERP_UPSTREAM_KEY ?? 'tienda-dev-key-cambiar';

/** Campos que se ignoran al calcular el hash del cuerpo (no cambian la respuesta). */
const IGNORED_BODY_FIELDS = ['idempotencyKey'];

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const misses = [];
let hits = 0;

function normalizeBody(raw) {
  if (raw === '') return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const field of IGNORED_BODY_FIELDS) delete parsed[field];
    }
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

function keyOf(method, url, body) {
  const normalized = normalizeBody(body);
  const hash = normalized === '' ? '' : `#${createHash('sha1').update(normalized).digest('hex').slice(0, 12)}`;
  return `${method} ${url}${hash}`;
}

function fileOf(key) {
  return join(DIR, `${createHash('sha1').update(key).digest('hex')}.json`);
}

function readFixture(key) {
  const file = fileOf(key);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeFixture(key, status, contentType, body) {
  writeFileSync(fileOf(key), JSON.stringify({ key, status, contentType, body }, null, 2), 'utf8');
}

/** Lee el cuerpo de la peticion (la tienda manda JSON). */
function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

async function forwardToUpstream(method, url, body, headers) {
  const response = await fetch(`${UPSTREAM}${url}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': headers['content-type'] ?? 'application/json',
      'x-storefront-key': UPSTREAM_KEY,
    },
    ...(method === 'GET' ? {} : { body }),
  });
  return { status: response.status, contentType: response.headers.get('content-type') ?? 'application/json', body: await response.text() };
}

const server = createServer((request, response) => {
  void (async () => {
    const url = request.url ?? '/';
    const method = request.method ?? 'GET';

    if (url.startsWith('/__fixture/health')) {
      const fixtures = readdirSync(DIR).filter((name) => name.endsWith('.json')).length;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ mode: RECORD ? 'record' : 'replay', fixtures, hits, misses: misses.length }));
      return;
    }

    const body = method === 'GET' ? '' : await readBody(request);
    const key = keyOf(method, url, body);

    if (process.env.FIXTURE_DEBUG === '1') {
      console.log(
        `[fixture] ${method} ${url} · content-length=${request.headers['content-length'] ?? '-'} · ` +
          `cuerpo=${body.length} B · clave=${key}`,
      );
    }

    if (!RECORD) {
      const fixture = readFixture(key);
      if (fixture === null) {
        misses.push(key);
        const normalized = normalizeBody(body);
        console.error(
          `[fixture] SIN GRABACION: ${key} :: cuerpo=${normalized === '' ? '(vacio)' : normalized}`,
        );
        response.writeHead(599, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            message:
              `El fixture del canal no tiene "${key}". Vuelve a grabar con ` +
              '`$env:STORE_VISUAL_RECORD=1; npm run e2e:visual:update` (con la API del ERP en marcha).',
          }),
        );
        return;
      }
      hits += 1;
      response.writeHead(fixture.status, { 'content-type': fixture.contentType });
      response.end(fixture.body);
      return;
    }

    const result = await forwardToUpstream(method, url, body, request.headers);
    writeFixture(key, result.status, result.contentType, result.body);
    console.log(`[fixture] grabado ${key} → ${result.status}`);
    response.writeHead(result.status, { 'content-type': result.contentType });
    response.end(result.body);
  })().catch((error) => {
    console.error('[fixture] error', error);
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: String(error) }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[fixture] ${RECORD ? 'GRABANDO desde' : 'repitiendo'} ${UPSTREAM} en http://127.0.0.1:${PORT}`);
});
