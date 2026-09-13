/**
 * Valida el overlay de DSH del MCP: YAML parseable y con el esquema que espera
 * `@deepseek-ai/dsh-mcp-client`. Se ejecuta a mano (no es parte del gate):
 *   node scripts/validate-overlay.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const overlay = path.join(here, '..', 'dsh-mcp-erp.cordis.yml');
const yamlMod = await import('js-yaml').catch(() => null);
// js-yaml v5 expone el API como named exports (no hay `default`).
const yaml = yamlMod?.default ?? yamlMod;
if (!yaml?.DEFAULT_SCHEMA) {
  console.error(
    'js-yaml no está disponible: instálalo con `npm install` (es devDependency del paquete).',
  );
  process.exit(1);
}

const text = readFileSync(overlay, 'utf8');
// `!!js` es un tag propio de DSH (evalúa JS en el proceso host): lo mapeamos a string.
const schema = yaml.DEFAULT_SCHEMA.extend([
  new yaml.Type('tag:yaml.org,2002:js', {
    kind: 'scalar',
    construct: (data) => ({ __js: data }),
  }),
]);

const doc = yaml.load(text, { schema });
const entry = doc?.[0]?.insert?.[0];
const problems = [];
if (entry?.name !== '@deepseek-ai/dsh-mcp-client') problems.push('name incorrecto');
if (!/^[A-Za-z0-9_-]{1,32}$/.test(entry?.config?.serverName ?? '')) {
  problems.push('serverName inválido (debe cumplir [A-Za-z0-9_-]{1,32})');
}
if (entry?.config?.transport !== 'stdio') problems.push('transport debe ser stdio');
if (entry?.config?.command !== 'node') problems.push('command debe ser node');
if (!Array.isArray(entry?.config?.args) || entry.config.args.length !== 1) {
  problems.push('args debe tener exactamente la ruta del bundle');
}
if (entry?.config?.env?.ERP_API_URL == null) problems.push('falta ERP_API_URL');

if (problems.length > 0) {
  console.error(`Overlay inválido:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `Overlay OK — id=${entry.id} serverName=${entry.config.serverName} command=${entry.config.command} ` +
    `args=${entry.config.args.length} env=${Object.keys(entry.config.env).length} claves`,
);
