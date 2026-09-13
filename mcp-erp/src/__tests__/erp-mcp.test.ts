/**
 * Tests del MCP del ERP con `node:test` y un `fetch` falso: no tocan la red ni la BD.
 * Cubren lo que puede romperse en silencio: la lista blanca de rutas, el recorte de
 * filas, la proyección de columnas, el cuadre del asiento y la lectura de docs.
 */

import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import test from 'node:test';

import { loadConfig, hasApiCredentials } from '../config.js';
import { assertAllowedPath, ErpClient, ErpApiError } from '../erp-client.js';
import {
  buildTools,
  projectRow,
  unwrapList,
  type ToolDefinition,
} from '../tools.js';
import { readDoc } from '../docs.js';

// ── Utilidades ────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface RecordedCall {
  url: string;
  method: string;
}

/** `fetch` falso: responde por ruta y registra las llamadas. */
function fakeFetch(
  routes: Record<string, unknown>,
  calls: RecordedCall[] = [],
): typeof fetch {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('/auth/login')) {
      return new Response(JSON.stringify({ access_token: 'token-de-prueba' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'set-cookie': 'XSRF-TOKEN=xsrf-test' },
      });
    }
    const pathname = new URL(url).pathname;
    for (const [route, body] of Object.entries(routes)) {
      if (pathname === route) return jsonResponse(body);
    }
    return jsonResponse({ message: 'not found' }, 404);
  }) as unknown as typeof fetch;
}

function toolsWith(
  routes: Record<string, unknown>,
  calls: RecordedCall[] = [],
): Map<string, ToolDefinition> {
  const config = loadConfig({
    ERP_API_URL: 'http://api.test',
    ERP_USERNAME: 'admin',
    ERP_PASSWORD: 'admin123',
    ERP_MAX_ROWS: '10',
  });
  const client = new ErpClient({ config, fetchImpl: fakeFetch(routes, calls) });
  const list = buildTools(client, config.maxRows);
  return new Map(list.map((t) => [t.name, t]));
}

async function callTool(
  tools: Map<string, ToolDefinition>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const tool = tools.get(name);
  assert.ok(tool, `falta la herramienta ${name}`);
  const res = await tool.handler(args);
  return {
    text: res.content.map((c) => c.text).join('\n'),
    isError: res.isError === true,
  };
}

// ── config ────────────────────────────────────────────────────────────────────

test('loadConfig aplica defaults y limita los valores numéricos', () => {
  const cfg = loadConfig({});
  assert.equal(cfg.baseUrl, 'http://localhost:3001');
  assert.equal(cfg.tenantSlug, 'default');
  assert.equal(cfg.timeoutMs, 20_000);
  assert.equal(cfg.maxRows, 25);
  assert.equal(hasApiCredentials(cfg), false);

  const capped = loadConfig({
    ERP_API_URL: 'http://x:1/',
    ERP_MAX_ROWS: '9999',
    ERP_TIMEOUT_MS: '50',
    ERP_USERNAME: 'u',
    ERP_PASSWORD: 'p',
  });
  assert.equal(capped.baseUrl, 'http://x:1');
  assert.equal(capped.maxRows, 200, 'se recorta al máximo permitido');
  assert.equal(capped.timeoutMs, 50);
  assert.equal(hasApiCredentials(capped), true);
});

// ── lista blanca de rutas (seguridad) ────────────────────────────────────────

test('assertAllowedPath acepta lecturas y rechaza escrituras', () => {
  for (const ok of [
    '/health',
    '/items/12/stock',
    '/items/low-stock',
    '/partners/3/transactions',
    '/reports/trial-balance',
    '/journal-entries/9',
    '/incoming-payments',
    '/incoming-payments/4',
    '/settings',
    '/withholding-taxes',
  ]) {
    assert.doesNotThrow(() => assertAllowedPath(ok), `debería permitir ${ok}`);
  }

  for (const bad of [
    '/incoming-payments/4/cancel',
    '/users/1/permissions',
    '/migrations',
    '/settings/anything',
    '/items/12/assemble',
    '/journal-entries/9/post',
  ]) {
    assert.throws(() => assertAllowedPath(bad), /Ruta no permitida/, bad);
  }
});

test('el cliente no emite ninguna petición de escritura y reintenta tras 401', async () => {
  const calls: RecordedCall[] = [];
  let firstItemCall = true;
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('/auth/login')) {
      return new Response(JSON.stringify({ access_token: 't' }), {
        status: 200,
        headers: { 'set-cookie': 'XSRF-TOKEN=x' },
      });
    }
    if (firstItemCall) {
      firstItemCall = false;
      return jsonResponse({ message: 'unauthorized' }, 401);
    }
    return jsonResponse({ id: 7, code: 'ART-1' });
  }) as unknown as typeof fetch;

  const config = loadConfig({
    ERP_API_URL: 'http://api.test',
    ERP_USERNAME: 'admin',
    ERP_PASSWORD: 'admin123',
  });
  const client = new ErpClient({ config, fetchImpl });
  const item = await client.get<{ id: number }>('/items/7');
  assert.equal(item.id, 7);

  const methods = calls.map((c) => c.method);
  assert.equal(methods.filter((m) => m === 'POST').length, 2, 'solo el login es POST (2 veces: inicial + retry)');
  assert.equal(methods.filter((m) => m === 'GET').length, 2, 'el GET se repite igual');
});

test('un error HTTP se reporta con ruta, estado y cuerpo', async () => {
  const config = loadConfig({
    ERP_API_URL: 'http://api.test',
    ERP_USERNAME: 'u',
    ERP_PASSWORD: 'p',
  });
  const client = new ErpClient({
    config,
    fetchImpl: fakeFetch({ '/items/1/stock': { message: 'no existe' } }).bind(null) as never,
  });
  // Forzamos 404 con un fetch que siempre responde 404 salvo login
  const client404 = new ErpClient({
    config,
    fetchImpl: (async (input: string | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/login')) {
        return new Response(JSON.stringify({ access_token: 't' }), {
          status: 200,
          headers: { 'set-cookie': 'XSRF-TOKEN=x' },
        });
      }
      return jsonResponse({ message: 'Artículo no encontrado' }, 404);
    }) as unknown as typeof fetch,
  });
  await assert.rejects(
    () => client404.get('/items/1/stock'),
    (err: unknown) => {
      assert.ok(err instanceof ErpApiError);
      assert.equal(err.status, 404);
      assert.match(err.message, /Artículo no encontrado/);
      return true;
    },
  );
  void client;
});

// ── proyección y paginación ─────────────────────────────────────────────────

test('projectRow deja solo las columnas útiles y recorta textos largos', () => {
  const projected = projectRow({
    id: 1,
    code: 'FC-001',
    total: 113,
    status: 'OPEN',
    internalSecret: 'no debería salir',
    notes: 'x'.repeat(500),
  });
  assert.deepEqual(Object.keys(projected).sort(), [
    'code',
    'id',
    'notes',
    'status',
    'total',
  ]);
  assert.equal((projected['notes'] as string).endsWith('...'), true);
  assert.equal(projected['internalSecret'], undefined);
});

test('unwrapList entiende las tres formas de paginación del backend', () => {
  assert.deepEqual(unwrapList({ data: [1], total: 5 }), { rows: [1], total: 5 });
  const fromItems = unwrapList({ items: [2] });
  assert.deepEqual(fromItems.rows, [2]);
  assert.equal(fromItems.total, undefined);
  const bare = unwrapList([3]);
  assert.deepEqual(bare.rows, [3]);
  assert.equal(bare.total, undefined);
  assert.deepEqual(unwrapList(null), { rows: [], total: undefined });
});

// ── herramientas ────────────────────────────────────────────────────────────

test('erp_list_documents proyecta filas y respeta el tope de filas', async () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    code: `FC-${i + 1}`,
    total: 100 + i,
    internalSecret: 'x',
  }));
  const tools = toolsWith({ '/sale-invoices': { data: rows, total: 40 } });
  const res = await callTool(tools, 'erp_list_documents', {
    resource: 'sale-invoices',
  });
  const body = JSON.parse(res.text) as {
    returned: number;
    total: number;
    rows: Array<Record<string, unknown>>;
  };
  assert.equal(body.returned, 10, 'aplica ERP_MAX_ROWS');
  assert.equal(body.total, 40);
  assert.equal(body.rows[0]?.['internalSecret'], undefined);
});

test('erp_get_document incluye el asiento enlazado y su cuadre', async () => {
  const tools = toolsWith({
    '/sale-invoices/5': { id: 5, code: 'FV-5', transactionId: 99, total: 113 },
    '/journal-entries/99': {
      id: 99,
      code: 'ASI-000099',
      status: 'POSTED',
      lines: [
        { accountId: 1, debit: 113, credit: 0, description: 'CxC' },
        { accountId: 2, debit: 0, credit: 100, description: 'Ingreso' },
        { accountId: 3, debit: 0, credit: 13, description: 'IVA' },
      ],
    },
  });
  const res = await callTool(tools, 'erp_get_document', {
    resource: 'sale-invoices',
    id: 5,
  });
  const body = JSON.parse(res.text) as {
    journalEntry: {
      isBalanced: boolean;
      totalDebit: number;
      totalCredit: number;
      lines: unknown[];
    };
  };
  assert.equal(body.journalEntry.isBalanced, true);
  assert.equal(body.journalEntry.totalDebit, 113);
  assert.equal(body.journalEntry.totalCredit, 113);
  assert.equal(body.journalEntry.lines.length, 3);
});

test('erp_get_document detecta un asiento descuadrado (caso T91)', async () => {
  const tools = toolsWith({
    '/incoming-payments/100': {
      id: 100,
      code: 'COB-70',
      transactionId: 564,
      withholdingAmount: '119.7',
    },
    '/journal-entries/564': {
      id: 564,
      code: 'ASI-000564',
      status: 'POSTED',
      lines: [
        { accountId: 115, debit: 3870.3, credit: 0, description: 'Caja' },
        { accountId: 121, debit: 0, credit: 3990, description: 'CxC' },
      ],
    },
  });
  const res = await callTool(tools, 'erp_get_document', {
    resource: 'incoming-payments',
    id: 100,
  });
  const body = JSON.parse(res.text) as {
    journalEntry: { isBalanced: boolean; totalDebit: number; totalCredit: number };
  };
  assert.equal(body.journalEntry.isBalanced, false, 'debe delatar el descuadre');
  assert.equal(body.journalEntry.totalDebit, 3870.3);
  assert.equal(body.journalEntry.totalCredit, 3990);
});

test('erp_item_stock resuelve el artículo por código y añade el kardex', async () => {
  const tools = toolsWith({
    '/items': { data: [{ id: 12, code: 'ART-1', name: 'Artículo 1' }] },
    '/items/12/stock': { itemId: 12, total: 5, warehouses: [] },
    '/items/12/kardex': { data: [{ id: 1, quantity: 5 }] },
  });
  const res = await callTool(tools, 'erp_item_stock', {
    code: 'ART-1',
    includeKardex: true,
  });
  const body = JSON.parse(res.text) as {
    itemId: number;
    stock: { total: number };
    kardex: unknown;
  };
  assert.equal(body.itemId, 12);
  assert.equal(body.stock.total, 5);
  assert.ok(body.kardex);
});

test('erp_item_stock avisa cuando no encuentra el artículo', async () => {
  const tools = toolsWith({ '/items': { data: [] } });
  const res = await callTool(tools, 'erp_item_stock', { code: 'NO-EXISTE' });
  assert.equal(res.isError, true);
  assert.match(res.text, /No se encontró el artículo/);
});

test('erp_account_ledger acepta el código de cuenta y pagina', async () => {
  const tools = toolsWith({
    '/accounts': { data: [{ id: 121, code: '1.1.2.01.001', name: 'CxC' }] },
    '/accounts/121/ledger': { data: [{ id: 1, debit: 100 }] },
  });
  const res = await callTool(tools, 'erp_account_ledger', {
    code: '1.1.2.01.001',
  });
  const body = JSON.parse(res.text) as { accountId: number; ledger: unknown };
  assert.equal(body.accountId, 121);
  assert.ok(body.ledger);
});

test('erp_journal_entry marca el cuadre y proyecta las líneas', async () => {
  const tools = toolsWith({
    '/journal-entries/1': {
      id: 1,
      code: 'ASI-1',
      status: 'POSTED',
      sourceDocumentType: 'SALE_INVOICE',
      lines: [
        { accountId: 1, debit: 10, credit: 0, internalSecret: 'x' },
        { accountId: 2, debit: 0, credit: 10 },
      ],
    },
  });
  const res = await callTool(tools, 'erp_journal_entry', { id: 1 });
  const body = JSON.parse(res.text) as {
    isBalanced: boolean;
    lines: Array<Record<string, unknown>>;
  };
  assert.equal(body.isBalanced, true);
  assert.equal(body.lines[0]?.['internalSecret'], undefined);
});

test('erp_report rechaza nombres de reporte inválidos', async () => {
  const tools = toolsWith({});
  const res = await callTool(tools, 'erp_report', { report: '../users' });
  assert.equal(res.isError, true);
  assert.match(res.text, /inválido/);
});

test('erp_withholding_taxes devuelve las cuentas de cada tipo', async () => {
  const tools = toolsWith({
    '/withholding-taxes': [
      { id: 1, code: 'IT', rate: '0.03', accountId: 177, receivableAccountId: 305 },
    ],
  });
  const res = await callTool(tools, 'erp_withholding_taxes', {});
  assert.match(res.text, /receivableAccountId/);
});

// ── documentación ───────────────────────────────────────────────────────────

test('readDoc pagina, busca y no sale de la raíz del proyecto', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'erp-mcp-docs-'));
  try {
    await writeFile(
      path.join(dir, 'AGENTS.md'),
      ['linea 1', 'linea 2 con RETENCION', 'linea 3'].join('\n'),
      'utf8',
    );
    const slice = await readDoc(dir, 'agents', { fromLine: 2, lines: 1 });
    assert.equal(slice.content, 'linea 2 con RETENCION');
    assert.equal(slice.totalLines, 3);

    const found = await readDoc(dir, 'agents', { search: 'retencion' });
    assert.match(found.content, /2: linea 2 con RETENCION/);

    const none = await readDoc(dir, 'agents', { search: 'inexistente' });
    assert.match(none.content, /Sin coincidencias/);

    await assert.rejects(
      () => readDoc(dir, 'frontend_guide'),
      /No se encontró/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
