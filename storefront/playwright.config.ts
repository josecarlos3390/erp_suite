import { defineConfig, devices } from '@playwright/test';

/**
 * Gate E2E de la tienda.
 *
 * - Arranca la app con `next start` en un puerto libre (3100 por defecto) usando
 *   las variables de entorno del canal. Requiere `npm run build` previo.
 * - Corre contra la API del ERP **en marcha** (el seed real), nunca contra mocks.
 * - `actionTimeout` con tope: ninguna accion puede esperar para siempre.
 */

const PORT = Number.parseInt(process.env.E2E_PORT ?? '3100', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const ERP_API_URL = process.env.ERP_API_URL ?? 'http://localhost:3001';
const STOREFRONT_API_KEY = process.env.STOREFRONT_API_KEY ?? 'tienda-dev-key-cambiar';
const STOREFRONT_CITY = process.env.STOREFRONT_CITY ?? 'SCZ';

export default defineConfig({
  testDir: './e2e',
  // El gate visual, la auditoria de accesibilidad y el presupuesto de rendimiento
  // viven en `e2e/visual/` con su propia configuracion (`playwright.visual.config.ts`)
  // porque miden contra un fixture grabado del canal, no contra el ERP real.
  testIgnore: ['visual/**'],
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    // Ninguna accion puede esperar para siempre (Playwright lo deja en 0).
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ERP_API_URL,
      STOREFRONT_API_KEY,
      STOREFRONT_CITY,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  },
});
