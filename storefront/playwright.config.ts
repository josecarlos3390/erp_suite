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

const ERP_API_URL = process.env.ERP_API_URL ?? 'http://localhost:3000';
const STOREFRONT_API_KEY = process.env.STOREFRONT_API_KEY ?? 'tienda-dev-key-cambiar';
const STOREFRONT_CITY = process.env.STOREFRONT_CITY ?? 'SCZ';

/**
 * **Host de la biblioteca de medios (Cloudflare R2)** con el que corre el gate, para que
 * `next/image` pueda optimizar las fotos reales: el servidor de la suite es `next start` en modo
 * produccion y **no** lee `.env.local` (que es donde vive la variable en desarrollo), asi que la
 * variable se pasa explicita al `webServer`. El valor es el host publico del bucket de desarrollo
 * (el mismo `R2_PUBLIC_BASE` de `backend-erp/.env`, sin esquema); un despliegue pone el suyo por
 * variable de entorno, igual que en produccion. Con `IMAGE_REMOTE_HOSTS` definida en el entorno,
 * esa manda.
 */
const IMAGE_REMOTE_HOSTS =
  process.env.IMAGE_REMOTE_HOSTS ?? 'pub-43d22e70fe3e40b88de89bac6537eaa9.r2.dev';

/**
 * **Modo demostracion de imagenes apagado a proposito en el gate** (`STOREFRONT_SHOW_PLACEHOLDERS`).
 *
 * El gate mide el comportamiento **por defecto** de la tienda (D24: un marcador de posicion no es
 * una foto del producto). Medido al implementar el modo: `next start` **si** carga `.env.local`
 * (`@next/env` lo incluye para `production` y `NextServer` llama `loadEnvConfig({ dev: false })`),
 * asi que sin este pin la bandera de la demo local encenderia la tienda para toda la suite y los
 * casos que pinchan el monograma (`e2e/producto.spec.ts`, `data-placeholder`) medirian otra cosa.
 * El valor explicito gana a `.env.local` porque `@next/env` **no** pisa lo que ya viene en el
 * entorno del proceso (medido con el mismo cargador). Con el entorno limpio —como corre el gate—
 * el pin deja `false`; para medir la demo por la suite: `STOREFRONT_SHOW_PLACEHOLDERS=true`.
 */
const SHOW_PLACEHOLDERS = process.env.STOREFRONT_SHOW_PLACEHOLDERS ?? 'false';

/**
 * **Canales por host (T216-ter)**: el gate arranca la tienda con un mapa de **dos** dominios de
 * prueba (más el comodín `"*"` para los casos que navegan a `127.0.0.1`) para pinchar que la
 * resolución es por host: identidad, `robots.txt`, `sitemap.xml` y el **404** de un dominio no
 * declarado. Los hosts se resuelven a `127.0.0.1` en el navegador con `--host-resolver-rules`
 * (sin tocar el DNS ni el fichero `hosts`, que exigiría privilegios).
 */
export const E2E_DOMAINS = {
  a: 'tienda-a.local',
  b: 'tienda-b.local',
  unknown: 'tienda-c.local',
} as const;

const STOREFRONT_CHANNELS =
  process.env.STOREFRONT_CHANNELS ??
  JSON.stringify({
    [E2E_DOMAINS.a]: {
      key: STOREFRONT_API_KEY,
      name: 'Tienda A (e2e)',
      city: STOREFRONT_CITY,
    },
    [E2E_DOMAINS.b]: {
      key: STOREFRONT_API_KEY,
      name: 'Tienda B (e2e)',
      city: STOREFRONT_CITY,
    },
    // Los 43 casos que ya existian navegan a `127.0.0.1`: se declaran **explicitos** (con el nombre
    // de siempre para no cambiar su identidad) en vez de usar el comodin `"*"`, porque con comodin
    // no habria forma de medir el **404** de un dominio no declarado.
    '127.0.0.1': { key: STOREFRONT_API_KEY },
    localhost: { key: STOREFRONT_API_KEY },
  });

const HOST_RESOLVER_RULES = [
  `MAP ${E2E_DOMAINS.a} 127.0.0.1`,
  `MAP ${E2E_DOMAINS.b} 127.0.0.1`,
  `MAP ${E2E_DOMAINS.unknown} 127.0.0.1`,
].join(', ');

export const E2E_BASE_URL = BASE_URL;

export default defineConfig({
  testDir: './e2e',
  // El gate visual, la auditoria de accesibilidad y el presupuesto de rendimiento
  // viven en `e2e/visual/` con su propia configuracion (`playwright.visual.config.ts`)
  // porque miden contra un fixture grabado del canal, no contra el ERP real.
  testIgnore: ['visual/**'],
  /**
   * **La base de desarrollo queda como estaba** (2026-09-30): el gate funcional escribe de
   * verdad —pedidos web, pedidos de venta, entregas, asientos, resenas y solicitudes—, asi que
   * alrededor de la corrida se toma un **volcado** de la base y se **restaura** al terminar, con
   * una **huella de contenido** que se compara para poder afirmarlo. El porque y las mediciones
   * estan en `e2e/harness/db-snapshot.mjs` y en el README; sin `pg_dump`/`psql` el gate sigue
   * funcionando y solo avisa de que la base no se restaurara sola.
   */
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
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
    // Los dominios de prueba (T216-ter) se resuelven a 127.0.0.1 en el navegador.
    launchOptions: {
      args: [`--host-resolver-rules=${HOST_RESOLVER_RULES}`],
    },
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
      STOREFRONT_CHANNELS,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      IMAGE_REMOTE_HOSTS,
      STOREFRONT_SHOW_PLACEHOLDERS: SHOW_PLACEHOLDERS,
    },
  },
});
