import { defineConfig, devices } from '@playwright/test';

/**
 * Gate **visual**, de **accesibilidad** y de **rendimiento** de la tienda (F9.6/D26).
 *
 * Es un gate distinto del funcional (`playwright.config.ts`) y por eso tiene su
 * propia configuracion:
 *
 *  - **Datos fijos**: el canal del ERP se sustituye por el fixture grabado
 *    (`e2e/visual/channel-fixture.mjs`), asi que las capturas de referencia y las
 *    medidas no cambian cuando el seed o la base de desarrollo cambian. El gate
 *    funcional sigue midiendo contra el ERP real.
 *  - **Puerto propio** (3200) y **capturas de referencia** propias
 *    (`e2e/visual/store-visual.spec.ts-snapshots/`), separadas de las 53 del back
 *    office.
 *  - En **modo grabacion** (`STORE_VISUAL_RECORD=1`) el fixture reenvia al ERP real
 *    y guarda las respuestas; es lo que se usa al actualizar las capturas:
 *    `$env:STORE_VISUAL_RECORD='1'; npm run e2e:visual:update`.
 *
 * Requiere `npm run build` previo (sirve el BUILD de produccion con `next start`).
 */

const PORT = Number.parseInt(process.env.E2E_VISUAL_PORT ?? '3200', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const FIXTURE_PORT = Number.parseInt(process.env.FIXTURE_PORT ?? '3299', 10);
const FIXTURE_URL = `http://127.0.0.1:${FIXTURE_PORT}`;

const ERP_API_URL = process.env.ERP_API_URL ?? 'http://localhost:3001';
const RECORD = process.env.STORE_VISUAL_RECORD === '1';

export default defineConfig({
  testDir: './e2e/visual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Las capturas y las medidas se comparan una por una: un fallo dice exactamente
  // que pantalla o que regla cambio.
  reporter: [['list']],
  outputDir: 'test-results/visual',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      // Un pixel de antialiasing no es una regresion; una caja movida si.
      maxDiffPixels: 220,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL: BASE_URL,
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    colorScheme: 'light',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: `node e2e/visual/channel-fixture.mjs${RECORD ? ' --record' : ''}`,
      url: `${FIXTURE_URL}/__fixture/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { FIXTURE_PORT: String(FIXTURE_PORT), ERP_UPSTREAM: ERP_API_URL },
    },
    {
      command: `npx next start -p ${PORT}`,
      url: `${BASE_URL}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ERP_API_URL: FIXTURE_URL,
        // La clave solo la comprueba el ERP real: con el fixture es un valor cualquiera.
        STOREFRONT_API_KEY: 'fixture-visual',
        STOREFRONT_CITY: 'SCZ',
        NEXT_PUBLIC_SITE_URL: BASE_URL,
      },
    },
  ],
});
