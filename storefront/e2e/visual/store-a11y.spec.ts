import axe from 'axe-core';
import { expect, test, type Page } from '@playwright/test';

import { AUDIT_CASES, openStorePage } from './store-cases';

/**
 * **Auditoria de accesibilidad** de la tienda (F9.6/D26) con `axe-core` sobre el
 * DOM **pintado**, en claro y en oscuro (el contraste cambia con el tema).
 *
 * Reglas que se exigen: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y
 * `best-practice`. Se falla por **cualquier** violacion de impacto `serious` o
 * `critical`; las `moderate`/`minor` se listan en el log para que no pasen
 * inadvertidas pero no rompen el gate (una regla de estilo no es una barrera de
 * accesibilidad).
 *
 * **Limite declarado**: `axe` no puede calcular el contraste de un texto que esta
 * **sobre un degradado o una imagen** y lo devuelve como *incomplete* —medido en
 * los botones con degradado de marca y el hero de campana—, asi que el gate
 * imprime cuantos nodos quedan en ese limbo. Esos pares los cubre
 * `npm run audit:contrast`, que mide los **tokens** de la capa de marca (claro y
 * oscuro) con la formula WCAG, no el pixel.
 */

interface AxeNode {
  target: string[];
  html: string;
  /** En `color-contrast`, `axe` deja aqui los colores medidos y la relacion. */
  any?: { data?: Record<string, unknown> | null }[];
}

interface AxeRuleResult {
  id: string;
  impact: string | null;
  help: string;
  nodes: AxeNode[];
}

interface AxeRunResult {
  violations: AxeRuleResult[];
  incomplete: AxeRuleResult[];
}

/** Detalle del nodo: en contraste, el color de texto, el de fondo y la relacion. */
function nodeDetail(node: AxeNode): string {
  const data = node.any?.[0]?.data;
  if (data === undefined || data === null) return '';
  const fg = data['fgColor'];
  const bg = data['bgColor'];
  const ratio = data['contrastRatio'];
  const expected = data['expectedContrastRatio'];
  if (fg === undefined && bg === undefined) return '';
  return ` [texto ${String(fg)} sobre ${String(bg)}: ${String(ratio)}:1, minimo ${String(expected)}]`;
}

function summarize(results: readonly AxeRuleResult[]): string {
  return results
    .map(
      (rule) =>
        `  - [${rule.impact ?? 'sin impacto'}] ${rule.id}: ${rule.help} (${rule.nodes.length} nodo/s)\n` +
        rule.nodes
          .map((node) => `      ${node.target.join(' ')}${nodeDetail(node)}`)
          .join('\n'),
    )
    .join('\n');
}

async function runAxe(page: Page): Promise<AxeRunResult> {
  await page.addScriptTag({ content: axe.source });
  return (await page.evaluate(async () => {
    const runner = (window as unknown as { axe: { run: (context: Document, options: unknown) => Promise<AxeRunResult> } }).axe;
    return await runner.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
    });
  })) as AxeRunResult;
}

test.describe('Accesibilidad de la tienda (axe-core)', () => {
  for (const item of AUDIT_CASES) {
    test(`${item.name} (${item.theme})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: item.theme,
        reducedMotion: 'reduce',
      });
      try {
        const page = await openStorePage(context, item);
        const results = await runAxe(page);

        const blocking = results.violations.filter(
          (rule) => rule.impact === 'serious' || rule.impact === 'critical',
        );
        const soft = results.violations.filter(
          (rule) => rule.impact !== 'serious' && rule.impact !== 'critical',
        );
        const contrastIncomplete = results.incomplete.filter((rule) => rule.id === 'color-contrast');

        console.log(
          `[a11y] ${item.name} (${item.theme}): ${blocking.length} graves, ${soft.length} suaves, ` +
            `${contrastIncomplete.reduce((total, rule) => total + rule.nodes.length, 0)} nodos con contraste no medible (degradado o imagen)`,
        );
        if (soft.length > 0) console.log(`[a11y] ${item.name} (${item.theme}) suaves:\n${summarize(soft)}`);

        expect(
          blocking,
          `Violaciones graves de accesibilidad en ${item.route} (${item.theme}):\n${summarize(blocking)}`,
        ).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
});
