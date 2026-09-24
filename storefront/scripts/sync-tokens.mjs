#!/usr/bin/env node
/**
 * sync-tokens.mjs — compila la capa de tokens del ERP a CSS variables.
 *
 * Fuente unica de verdad: erp-frontend/src/styles/tokens/_0*.scss (LUNA).
 * Salida: src/styles/tokens.css (artefacto generado, NO se edita a mano).
 *
 * Uso:
 *   node scripts/sync-tokens.mjs           escribe src/styles/tokens.css
 *   node scripts/sync-tokens.mjs --check   no escribe: falla (exit 1) si el
 *                                          archivo emitido cambiaria
 *
 * Los comentarios del SCSS de origen se retiran del artefacto para que el CSS
 * sea ASCII puro y estable (el diff del gate no depende de la redaccion).
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sass = require('sass');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const storefrontDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(storefrontDir, '..');

const TOKENS_DIR = path.join(repoRoot, 'erp-frontend', 'src', 'styles', 'tokens');
const OUT_FILE = path.join(storefrontDir, 'src', 'styles', 'tokens.css');

/** Modulos de la capa de tokens, en orden de capas (primitivas -> layout). */
const TOKEN_MODULES = [
  '01-primitives',
  '02-semantic',
  '03-effects',
  '04-motion',
  '05-layout',
  '06-typography',
  '07-sizing',
];

const HEADER = `/* ============================================================================
   GENERADO AUTOMATICAMENTE por storefront/scripts/sync-tokens.mjs
   NO EDITAR A MANO: los cambios se pisan en la proxima sincronizacion.

   Fuente : erp-frontend/src/styles/tokens/_01-primitives.scss ...
            _07-sizing.scss  (capa de tokens LUNA del ERP)
   Regenerar : npm run sync:tokens
   Verificar : npm run sync:tokens:check
   ============================================================================ */
`;

/** Aborta con un mensaje accionable. */
function fail(message) {
  process.stderr.write(`sync-tokens: ${message}\n`);
  process.exit(1);
}

/** Quita los comentarios /* ... *\/ del CSS compilado. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Normaliza espacios en blanco y saltos de linea para que el diff sea estable. */
function normalize(css) {
  return (
    css
      .replace(/\r\n/g, '\n')
      // El artefacto es ASCII puro: la marca @charset que agrega Sass sobra y,
      // ademas, quedaria despues del encabezado (donde ya no es valida).
      .replace(/^@charset\s+"[^"]*";\s*$/m, '')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .replace(/\n{2,}/g, '\n')
      .trim() + '\n'
  );
}

/** Compila la capa de tokens del ERP y devuelve el CSS final. */
function buildTokensCss() {
  if (!existsSync(TOKENS_DIR)) {
    fail(`no existe el directorio de tokens del ERP: ${TOKENS_DIR}`);
  }

  const missing = TOKEN_MODULES.filter(
    (name) => !existsSync(path.join(TOKENS_DIR, `_${name}.scss`)),
  );
  if (missing.length > 0) {
    fail(`faltan archivos de tokens en ${TOKENS_DIR}: ${missing.join(', ')}`);
  }

  // El namespace por defecto seria el propio nombre del archivo ("01-primitives"),
  // que Sass rechaza por empezar con un digito: hace falta el "as" explicito.
  const entry = TOKEN_MODULES.map((name, index) => `@use '${name}' as m${index};`).join('\n');
  let compiled;
  try {
    compiled = sass.compileString(entry, {
      loadPaths: [TOKENS_DIR],
      style: 'expanded',
      quietDeps: true,
      logger: { warn() {}, debug() {} },
    });
  } catch (error) {
    fail(`fallo la compilacion SCSS: ${error instanceof Error ? error.message : String(error)}`);
  }

  const body = normalize(stripComments(compiled.css));
  if (!body.includes('--accent-600')) {
    fail('el CSS compilado no contiene las variables esperadas (--accent-600): revisar la fuente');
  }
  return `${HEADER}\n${body}`;
}

const checkOnly = process.argv.includes('--check');
const next = buildTokensCss();

if (checkOnly) {
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8').replace(/\r\n/g, '\n') : null;
  if (current === null) {
    fail(`falta ${path.relative(repoRoot, OUT_FILE)}: correr "npm run sync:tokens"`);
  }
  if (current !== next) {
    const currentLines = current.split('\n');
    const nextLines = next.split('\n');
    const max = Math.max(currentLines.length, nextLines.length);
    const diffLines = [];
    for (let i = 0; i < max && diffLines.length < 10; i += 1) {
      if (currentLines[i] !== nextLines[i]) {
        diffLines.push(
          `  linea ${i + 1}\n    actual : ${JSON.stringify(currentLines[i] ?? null)}\n    emitido: ${JSON.stringify(nextLines[i] ?? null)}`,
        );
      }
    }
    fail(
      `${path.relative(repoRoot, OUT_FILE)} esta desincronizado con la capa de tokens del ERP.\n` +
        `Correr "npm run sync:tokens" y versionar el resultado.\nPrimeras diferencias:\n${diffLines.join('\n')}`,
    );
  }
  process.stdout.write(
    `sync-tokens --check OK: ${path.relative(repoRoot, OUT_FILE)} coincide con los ${TOKEN_MODULES.length} modulos del ERP.\n`,
  );
  process.exit(0);
}

mkdirSync(path.dirname(OUT_FILE), { recursive: true });
const previous = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8').replace(/\r\n/g, '\n') : null;
writeFileSync(OUT_FILE, next, 'utf8');
const lines = next.split('\n').length;
if (previous === next) {
  process.stdout.write(
    `sync-tokens OK (sin cambios): ${path.relative(repoRoot, OUT_FILE)} (${lines} lineas).\n`,
  );
} else {
  process.stdout.write(
    `sync-tokens OK: ${path.relative(repoRoot, OUT_FILE)} escrito desde ${TOKEN_MODULES.length} modulos (${lines} lineas).\n`,
  );
}
