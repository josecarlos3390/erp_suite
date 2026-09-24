#!/usr/bin/env node
/**
 * Gate de **contraste de la paleta** de la tienda (F9.6/D26).
 *
 * **Por que existe.** El gate de accesibilidad (`npm run e2e:a11y`) mide el DOM con
 * `axe`, y `axe` **no puede** calcular el contraste de un texto que esta sobre un
 * degradado o una imagen: lo devuelve como *incomplete* (medido: 67 nodos en la
 * home). Los pares que quedan en ese limbo —el boton principal (tinta sobre el
 * degradado de marca), el precio sobre la superficie de imagen, la banda de
 * campana, el texto sobre la foto del hero— los mide este script con la formula
 * WCAG, resolviendo las variables de `brand.css` y de `tokens.css` para **claro y
 * oscuro**.
 *
 * Reglas:
 *  - Texto pequeno: **4,5:1** (AA).
 *  - Texto grande (>= 18,66 px o >= 24 px) e interfaz (bordes, iconos): **3:1**.
 *  - En un degradado se comprueba **cada parada** y falla la peor: es el caso que
 *    el ojo puede encontrar al mover el raton por el boton.
 *
 * Uso: `npm run audit:contrast` (0 = sin hallazgos; 1 = hallazgos, con la tabla).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = join(process.cwd(), 'src', 'styles');

/** Valor de cada variable por tema, leyendo los bloques `:root` y `[data-theme='dark']`. */
function parseVariables(css) {
  const themes = { light: {}, dark: {} };
  // El selector del tema oscuro aparece con y sin comillas segun el archivo
  // (`[data-theme='dark']` en `brand.css`, `[data-theme=dark]` en `tokens.css`).
  const blockRe = /(:root|\[data-theme=['"]?dark['"]?\])\s*\{([^}]*)\}/g;
  let block;
  while ((block = blockRe.exec(css))) {
    const theme = block[1] === ':root' ? 'light' : 'dark';
    const declarationRe = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let declaration;
    while ((declaration = declarationRe.exec(block[2]))) {
      themes[theme][declaration[1]] = declaration[2].trim();
    }
  }
  return themes;
}

const brand = parseVariables(readFileSync(join(STYLES, 'brand.css'), 'utf8'));
const tokens = parseVariables(readFileSync(join(STYLES, 'tokens.css'), 'utf8'));

/**
 * Variables del tema, en el orden real de `globals.css` y de la cascada: los
 * tokens de `:root`, encima la marca de `:root` y, en oscuro, lo que pisan los
 * bloques `[data-theme=dark]` (que **no** repiten todo: lo que no declaran se
 * hereda del `:root`).
 */
function variablesFor(theme) {
  return {
    ...tokens.light,
    ...brand.light,
    ...(theme === 'dark' ? { ...tokens.dark, ...brand.dark } : {}),
  };
}

/** Resuelve `var(--x)` en cadena dentro del tema (sin ciclos). */
function resolve(value, vars, depth = 0) {
  if (depth > 10) return value;
  return value.replace(/var\((--[a-z0-9-]+)\)/gi, (_, name) => {
    const found = vars[name];
    return found === undefined ? '' : resolve(found, vars, depth + 1);
  });
}

/** Paradas de color de un valor (un color plano o los stops de un degradado). */
function stops(value, vars) {
  const resolved = resolve(value, vars);
  const hex = resolved.match(/#[0-9a-f]{3,8}/gi) ?? [];
  const rgb = resolved.match(/rgba?\([^)]+\)/gi) ?? [];
  return [...hex, ...rgb];
}

function toRgb(color) {
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const value = hex.slice(1);
    const full =
      value.length === 3
        ? value
            .split('')
            .map((char) => char + char)
            .join('')
        : value.slice(0, 6);
    return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16));
  }
  const parts = hex
    .replace(/rgba?\(|\)/g, '')
    .split(',')
    .map((part) => Number.parseFloat(part));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Luminancia relativa (WCAG 2.1). */
function luminance(color) {
  const [r, g, b] = toRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  const [lighter, darker] = first > second ? [first, second] : [second, first];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pares de la tienda. `on` es la superficie (una variable; si es un degradado se
 * comprueba contra todas sus paradas) y `size` decide el minimo.
 */
const PAIRS = [
  { label: 'texto principal sobre la base', fg: '--text-primary', on: '--bg-base', size: 'small' },
  { label: 'texto secundario sobre la base', fg: '--text-secondary', on: '--bg-base', size: 'small' },
  { label: 'texto terciario sobre la base', fg: '--text-tertiary', on: '--bg-base', size: 'small' },
  { label: 'texto secundario sobre elevado', fg: '--text-secondary', on: '--bg-elevated', size: 'small' },
  { label: 'texto terciario sobre elevado', fg: '--text-tertiary', on: '--bg-elevated', size: 'small' },
  { label: 'texto terciario sobre la superficie de marca suave', fg: '--text-tertiary', on: '--sf-brand-50', size: 'small' },
  { label: 'texto secundario sobre la superficie de marca suave', fg: '--text-secondary', on: '--sf-brand-50', size: 'small' },
  { label: 'precio sobre la base', fg: '--sf-price', on: '--bg-base', size: 'large' },
  { label: 'precio de oferta sobre la base', fg: '--sf-price-deal', on: '--bg-base', size: 'small' },
  { label: 'precio tachado sobre la base', fg: '--sf-price-compare', on: '--bg-base', size: 'small' },
  { label: 'existencia (verde) sobre la base', fg: '--sf-price-free', on: '--bg-base', size: 'small' },
  { label: 'existencia (verde) sobre elevado', fg: '--sf-price-free', on: '--bg-elevated', size: 'small' },
  { label: 'tinta del boton principal sobre el degradado', fg: '--sf-brand-contrast', on: '--sf-cta-surface', size: 'large' },
  { label: 'etiqueta de promocion', fg: '--sf-promo-contrast', on: '--sf-promo-badge', size: 'small' },
  { label: 'tinta de la banda de campana', fg: '--sf-promo-ink', on: '--sf-promo-surface', size: 'large' },
  { label: 'texto sobre la foto de campana', fg: '--sf-on-media', on: '--sf-hero-ink', size: 'large' },
  { label: 'tinta del monograma sobre la superficie de imagen', fg: '--sf-media-ink', on: '--sf-media-flat', size: 'large' },
];

/** Superficies planas equivalentes a los degradados donde el peor caso es el stop. */
const EXTRA = {
  light: { '--sf-cta-surface': 'linear-gradient(180deg, var(--sf-brand-500) 0%, var(--sf-brand-600) 100%)', '--sf-hero-ink': 'rgba(2, 6, 23, 0.72)', '--sf-media-flat': 'var(--neutral-100)' },
  dark: { '--sf-cta-surface': 'linear-gradient(180deg, var(--sf-brand-500) 0%, var(--sf-brand-600) 100%)', '--sf-hero-ink': 'rgba(2, 6, 23, 0.85)', '--sf-media-flat': 'var(--neutral-200)' },
};

const MINIMUM = { small: 4.5, large: 3 };

const findings = [];
const rows = [];

for (const theme of ['light', 'dark']) {
  const vars = { ...variablesFor(theme), ...EXTRA[theme] };
  for (const pair of PAIRS) {
    const fg = resolve(`var(${pair.fg})`, vars);
    const backgrounds = stops(`var(${pair.on})`, vars);
    if (fg === '' || backgrounds.length === 0) {
      findings.push(`${theme}: ${pair.label} — no se pudieron resolver los colores (${pair.fg} / ${pair.on})`);
      continue;
    }
    let worst = Number.POSITIVE_INFINITY;
    let worstBackground = '';
    for (const background of backgrounds) {
      const ratio = contrast(fg, background);
      if (ratio < worst) {
        worst = ratio;
        worstBackground = background;
      }
    }
    const minimum = MINIMUM[pair.size];
    const ok = worst >= minimum;
    rows.push(
      `${ok ? 'OK  ' : 'FALLA'} ${theme.padEnd(5)} ${worst.toFixed(2).padStart(6)}:1 (min ${minimum}) ` +
        `${pair.label} · ${fg} sobre ${worstBackground}`,
    );
    if (!ok) findings.push(`${theme}: ${pair.label} — ${worst.toFixed(2)}:1 (minimo ${minimum})`);
  }
}

console.log(rows.join('\n'));
console.log('');

if (findings.length > 0) {
  console.error(`audit:contrast — ${findings.length} hallazgo/s:`);
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(`audit:contrast OK: ${rows.length} pares de la paleta cumplen AA en claro y oscuro.`);
