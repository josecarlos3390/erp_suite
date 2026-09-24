#!/usr/bin/env node
/**
 * sync-fonts.mjs — copia las tipografias web del ERP a la tienda.
 *
 * Fuente unica de verdad: `erp-frontend/public/assets/fonts` (Inter self-hosted
 * que genera `erp-frontend/scripts/fetch-webfonts.mjs`). La tienda **no** baja
 * fuentes de Google en el build (T53 del ERP: una descarga tardia cambia las
 * metricas de texto y falsea la regresion visual), asi que sirve los mismos
 * `.woff2` desde su propio `public/fonts` y los declara con `next/font/local`.
 *
 * Uso:
 *   node scripts/sync-fonts.mjs           copia los .woff2 a public/fonts
 *   node scripts/sync-fonts.mjs --check   no escribe: falla (exit 1) si falta
 *                                        algun archivo o si difiere del ERP
 *
 * El conjunto es cerrado y explicito (no se copia el directorio entero): asi el
 * peso que sirve la tienda es una decision revisable y el gate lo verifica.
 */

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const storefrontDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(storefrontDir, '..');

const SOURCE_DIR = path.join(repoRoot, 'erp-frontend', 'public', 'assets', 'fonts');
const OUT_DIR = path.join(storefrontDir, 'public', 'fonts');

/** Pesos que usa la tienda: 400 texto, 500 medio, 600 semibold, 700 titulos. */
const WEIGHTS = ['400', '500', '600', '700'];
/** Subsets: latin cubre `es-BO`; latin-ext queda para acentos/nombres raros. */
const SUBSETS = ['latin', 'latin-ext'];

/** Nombres finales que se sirven y se versionan. */
const FILES = WEIGHTS.flatMap((weight) =>
  SUBSETS.map((subset) => `inter-${weight}-${subset}.woff2`),
);

/** Aborta con un mensaje accionable. */
function fail(message) {
  process.stderr.write(`sync-fonts: ${message}\n`);
  process.exit(1);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

if (!existsSync(SOURCE_DIR)) {
  fail(
    `no existe el directorio de fuentes del ERP: ${path.relative(repoRoot, SOURCE_DIR)}\n` +
      'Correr primero "npm run fetch:webfonts" en erp-frontend (o un build) para generarlas.',
  );
}

const missingAtSource = FILES.filter((name) => !existsSync(path.join(SOURCE_DIR, name)));
if (missingAtSource.length > 0) {
  fail(
    `faltan fuentes en el ERP: ${missingAtSource.join(', ')}\n` +
      'Correr "npm run fetch:webfonts" en erp-frontend y versionar el resultado.',
  );
}

const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const missing = FILES.filter((name) => !existsSync(path.join(OUT_DIR, name)));
  if (missing.length > 0) {
    fail(
      `faltan fuentes en la tienda (${path.relative(repoRoot, OUT_DIR)}): ${missing.join(', ')}\n` +
        'Correr "npm run sync:fonts" y versionar el resultado.',
    );
  }

  const drifted = FILES.filter(
    (name) => sha256(path.join(SOURCE_DIR, name)) !== sha256(path.join(OUT_DIR, name)),
  );
  if (drifted.length > 0) {
    fail(
      `las fuentes de la tienda no coinciden con las del ERP: ${drifted.join(', ')}\n` +
        'Correr "npm run sync:fonts" y versionar el resultado.',
    );
  }

  process.stdout.write(
    `sync-fonts --check OK: ${FILES.length} woff2 de Inter coinciden con erp-frontend/public/assets/fonts.\n`,
  );
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
let copied = 0;
for (const name of FILES) {
  const target = path.join(OUT_DIR, name);
  const identical =
    existsSync(target) && sha256(target) === sha256(path.join(SOURCE_DIR, name));
  if (identical) continue;
  copyFileSync(path.join(SOURCE_DIR, name), target);
  copied += 1;
}

const totalKb = Math.round(
  FILES.reduce((acc, name) => acc + readFileSync(path.join(OUT_DIR, name)).length, 0) / 1024,
);
process.stdout.write(
  copied === 0
    ? `sync-fonts OK (sin cambios): ${FILES.length} woff2 en public/fonts (${totalKb} KB).\n`
    : `sync-fonts OK: ${copied} de ${FILES.length} woff2 copiados a public/fonts (${totalKb} KB en total).\n`,
);
