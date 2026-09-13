#!/usr/bin/env node
/**
 * Smoke del MCP del ERP: habla el protocolo MCP por stdio con `dist/index.js`
 * (el mismo binario que arranca un cliente MCP) y ejecuta lecturas reales contra la
 * API de desarrollo. Es una verificación de extremo a extremo del servidor, no de
 * las herramientas aisladas (eso lo cubre `npm test`).
 *
 * Uso:
 *   ERP_USERNAME=admin ERP_PASSWORD=… node scripts/smoke.mjs [--api http://localhost:3001]
 *
 * Salida: una línea por comprobación. Sale con código 1 si alguna falla.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(here, '..', 'dist', 'index.js');

const apiArgIndex = process.argv.indexOf('--api');
const apiUrl =
  apiArgIndex >= 0 ? process.argv[apiArgIndex + 1] : process.env.ERP_API_URL;

const env = {
  ...process.env,
  ...(apiUrl ? { ERP_API_URL: apiUrl } : {}),
  ERP_TENANT_SLUG: process.env.ERP_TENANT_SLUG ?? 'default',
  ERP_USERNAME: process.env.ERP_USERNAME ?? 'admin',
  ERP_PASSWORD: process.env.ERP_PASSWORD ?? 'admin123',
};

const child = spawn(process.execPath, [serverEntry], {
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const pending = new Map();
let nextId = 1;
let stderr = '';
const failures = [];

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (message.id != null && pending.has(message.id)) {
      const resolve = pending.get(message.id);
      pending.delete(message.id);
      resolve(message);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  const payload = { jsonrpc: '2.0', id, method, params };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout esperando ${method}`)),
      30_000,
    );
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  });
}

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  OK   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures.push(label);
    console.log(`  FALLA ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function textOf(response) {
  const content = response?.result?.content ?? [];
  return content.map((c) => c.text ?? '').join('\n');
}

async function callTool(name, args = {}) {
  const response = await send('tools/call', { name, arguments: args });
  if (response.error) throw new Error(`${name}: ${response.error.message}`);
  return { text: textOf(response), isError: response.result?.isError === true };
}

async function main() {
  console.log(`erp-mcp smoke — API ${env.ERP_API_URL ?? 'http://localhost:3001'}`);

  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'erp-mcp-smoke', version: '0.1.0' },
  });
  check('initialize', init.result?.serverInfo?.name === 'erp-mcp', init.result?.serverInfo?.version);
  notify('notifications/initialized', {});

  const toolsList = await send('tools/list', {});
  const tools = (toolsList.result?.tools ?? []).map((t) => t.name);
  check('tools/list', tools.length >= 12, `${tools.length} herramientas: ${tools.join(', ')}`);
  check(
    'todos los nombres llevan el prefijo erp_',
    tools.every((t) => t.startsWith('erp_')),
  );

  const health = await callTool('erp_health');
  check('erp_health', !health.isError && child.exitCode === null, health.text.slice(0, 80).replace(/\s+/g, ' '));

  const series = await callTool('erp_document_series', { docType: 'SALE_INVOICE' });
  check('erp_document_series', !series.isError && series.text.includes('prefix'), '');

  const wht = await callTool('erp_withholding_taxes');
  check(
    'erp_withholding_taxes',
    !wht.isError && wht.text.includes('IT'),
    wht.text.replace(/\s+/g, ' ').slice(0, 90),
  );

  const invoices = await callTool('erp_list_documents', {
    resource: 'sale-invoices',
    limit: 3,
  });
  let firstInvoiceId = null;
  if (!invoices.isError) {
    const parsed = JSON.parse(invoices.text);
    firstInvoiceId = parsed.rows?.[0]?.id ?? null;
    check('erp_list_documents', Array.isArray(parsed.rows), `${parsed.returned}/${parsed.total} filas`);
  } else {
    check('erp_list_documents', false, invoices.text.slice(0, 120));
  }

  if (firstInvoiceId != null) {
    const doc = await callTool('erp_get_document', {
      resource: 'sale-invoices',
      id: firstInvoiceId,
    });
    check(
      'erp_get_document (+ asiento)',
      !doc.isError && doc.text.includes('"document"'),
      doc.text.includes('"isBalanced"') ? 'con asiento y cuadre' : 'sin asiento enlazado',
    );
  }

  const tb = await callTool('erp_trial_balance', {
    from: '2020-01-01',
    to: new Date().toISOString().slice(0, 10),
  });
  check('erp_trial_balance', !tb.isError, tb.text.replace(/\s+/g, ' ').slice(0, 70));

  const docs = await callTool('erp_project_docs', {
    doc: 'agents',
    search: 'retenciones',
  });
  check(
    'erp_project_docs (sin credenciales)',
    !docs.isError && docs.text.length > 0,
    docs.text.split('\n')[0]?.slice(0, 70),
  );

  const blocked = await callTool('erp_get_document', {
    resource: 'sale-invoices',
    id: -1,
  });
  check('un id inválido devuelve error controlado', blocked.isError, blocked.text.slice(0, 60));

  child.kill();
  console.log('');
  if (stderr.trim()) console.log(`stderr del servidor:\n${stderr.trim()}`);
  if (failures.length > 0) {
    console.log(`\n${failures.length} comprobación(es) fallaron.`);
    process.exit(1);
  }
  console.log('Smoke del MCP: todo en verde.');
}

main().catch((err) => {
  console.error(`Smoke falló: ${err.message}`);
  console.error(stderr);
  child.kill();
  process.exit(1);
});
