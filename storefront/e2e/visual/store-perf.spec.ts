import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { openStorePage, type StorePageCase } from './store-cases';

/**
 * **Presupuesto de rendimiento** de la tienda (F9.6/D26): lo que el comprador
 * paga en la primera pantalla —JS, CSS, tipografias— y lo que tarda en verla
 * (LCP) y en dejar de moverse (CLS).
 *
 * **Limite declarado**: se mide en `localhost` y con el fixture del canal, asi que
 * no es una medida de campo (no hay red movil ni CDN). Es un **presupuesto de
 * regresion**: si un cambio engorda el arranque o vuelve a mover el layout, el
 * gate lo dice con el numero delante. Los presupuestos estan puestos justo por
 * encima de lo medido (ver §14.g del plan) y se suben solo a proposito.
 */

/**
 * Presupuesto por pagina. Los valores salen de la **medicion del 2026-09-23**
 * (abajo, en el log del gate) con un margen corto: es un ratchet de regresion, no
 * un objetivo de campo. La tienda sirve el build de produccion en `localhost` y
 * con el fixture del canal, asi que la red no es representativa; lo que si mide es
 * el peso del arranque y el movimiento del layout.
 */
const BUDGET = {
  /** LCP (ms): el elemento mas grande pintado (medido: 256-440 ms). */
  lcpMs: 800,
  /** CLS (adimensional): medido 0,001-0,02 (el carrito, al cambiar esqueleto por
   *  las lineas rehidratadas). El limite «bueno» de Web Vitals es 0,1. */
  cls: 0.05,
  /** JS descargado en el arranque (KB): medido 107-115,8 kB. */
  jsKb: 150,
  /** CSS (KB): medido 10,3 kB. */
  cssKb: 20,
  /** Tipografias propias (KB): medido 188,5 kB (los subconjuntos de Inter que el
   *  texto usa; los 8 `.woff2` del ERP suman 521 kB y el navegador no baja los que
   *  su `unicode-range` no alcanza). */
  fontsKb: 210,
} as const;

/** Rutas del presupuesto: la primera pantalla de cada paso de la compra. */
const PERF_CASES: readonly StorePageCase[] = [
  { name: 'inicio', route: '/', theme: 'light', waitForTestId: 'home-hero' },
  { name: 'categoria', route: '/categorias/celulares', theme: 'light', waitForTestId: 'product-grid' },
  { name: 'producto', route: '/productos/iphone-15-128gb', theme: 'light', waitForTestId: 'detail-price' },
  { name: 'carrito', route: '/carrito', theme: 'light', cart: true, waitForTestId: 'cart-line' },
  { name: 'checkout', route: '/checkout', theme: 'light', cart: true, waitForTestId: 'checkout-form' },
];

/**
 * Registra LCP y CLS **antes** de que cargue la pagina y los deja en
 * `window.__storePerf` (un observador no ve lo que ya paso si se registra tarde).
 */
async function registerObservers(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    window.__storePerf = { lcp: 0, cls: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__storePerf = { lcp: entry.startTime, cls: window.__storePerf?.cls ?? 0 };
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (shift.hadRecentInput) continue;
          window.__storePerf = {
            lcp: window.__storePerf?.lcp ?? 0,
            cls: (window.__storePerf?.cls ?? 0) + shift.value,
          };
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Navegador sin alguno de los dos observadores: la medida queda en 0 y el
      // presupuesto lo denuncia (no se inventa una cifra).
    }
  });
}

interface PageMeasurement {
  route: string;
  theme: string;
  lcpMs: number;
  cls: number;
  jsKb: number;
  cssKb: number;
  fontsKb: number;
  requests: number;
  /** Archivos de tipografia que el navegador bajo de verdad (evidencia del peso). */
  fontFiles: string[];
}

async function measure(page: Page, item: StorePageCase): Promise<PageMeasurement> {
  await page.waitForLoadState('load');
  // Ventana de asentamiento: los observadores necesitan el ultimo pintado (LCP) y
  // el ultimo desplazamiento (CLS) para cerrar la medida.
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const kb = (bytes: number): number => Math.round((bytes / 1024) * 10) / 10;
    const sum = (match: (entry: PerformanceResourceTiming) => boolean): number =>
      entries.filter(match).reduce((total, entry) => total + (entry.encodedBodySize || 0), 0);
    const byExtension = (extension: string) => (entry: PerformanceResourceTiming) =>
      entry.name.split('?')[0]?.endsWith(extension) === true;
    return {
      lcpMs: Math.round(window.__storePerf?.lcp ?? 0),
      cls: Math.round((window.__storePerf?.cls ?? 0) * 1000) / 1000,
      jsKb: kb(sum((entry) => entry.initiatorType === 'script' || byExtension('.js')(entry))),
      cssKb: kb(sum(byExtension('.css'))),
      fontsKb: kb(sum(byExtension('.woff2'))),
      requests: entries.length,
      fontFiles: entries
        .filter(byExtension('.woff2'))
        .map((entry) => `${entry.name.split('/').pop() ?? entry.name} ${Math.round((entry.encodedBodySize || 0) / 1024)} kB`),
    };
  });

  return { route: item.route, theme: item.theme, ...metrics };
}

declare global {
  interface Window {
    __storePerf?: { lcp: number; cls: number };
  }
}

test.describe('Presupuesto de rendimiento de la tienda', () => {
  for (const item of PERF_CASES) {
    test(`${item.name}: LCP, CLS y peso del arranque`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: item.theme,
        reducedMotion: 'reduce',
      });
      await registerObservers(context);
      try {
        const page = await openStorePage(context, item);
        const result = await measure(page, item);
        console.log(
          `[perf] ${result.route} (${result.theme}): LCP ${result.lcpMs} ms · CLS ${result.cls} · ` +
            `JS ${result.jsKb} kB · CSS ${result.cssKb} kB · fuentes ${result.fontsKb} kB · ` +
            `${result.requests} peticiones`,
        );
        console.log(`[perf] ${result.route} tipografias: ${result.fontFiles.join(' | ') || '(ninguna)'}`);

        expect(result.lcpMs, `LCP de ${result.route}: sin medir`).toBeGreaterThan(0);
        expect(result.lcpMs, `LCP de ${result.route}`).toBeLessThanOrEqual(BUDGET.lcpMs);
        expect(result.cls, `CLS de ${result.route}`).toBeLessThanOrEqual(BUDGET.cls);
        expect(result.jsKb, `JS de ${result.route}`).toBeLessThanOrEqual(BUDGET.jsKb);
        expect(result.cssKb, `CSS de ${result.route}`).toBeLessThanOrEqual(BUDGET.cssKb);
        expect(result.fontsKb, `Fuentes de ${result.route}`).toBeLessThanOrEqual(BUDGET.fontsKb);
      } finally {
        await context.close();
      }
    });
  }
});
