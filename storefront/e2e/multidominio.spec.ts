import { expect, test } from '@playwright/test';

/**
 * **Multi-dominio: la tienda resuelve el canal por host** (T216-ter).
 *
 * El arnes arranca el servidor con `STOREFRONT_CHANNELS` (ver `playwright.config.ts`) y el navegador
 * resuelve `tienda-a.local` / `tienda-b.local` / `tienda-c.local` a `127.0.0.1`, asi que estos casos
 * miden el camino real de un despliegue que sirve **varios dominios**:
 *
 *  - cada host sirve **su** identidad (nombre y `<title>`) y **su** catalogo;
 *  - `robots.txt` y `sitemap.xml` publican las URLs de **ese** host, no las de un `NEXT_PUBLIC_SITE_URL`
 *    fijo (que con N dominios seria el de otra empresa);
 *  - un dominio **no declarado** responde **404** y no ensena el catalogo de ninguna empresa.
 *
 * Los casos navegan con `page.goto` (no `page.request`): quien aplica `--host-resolver-rules` es el
 * navegador, no el cliente HTTP de Playwright.
 */

const PORT = process.env.E2E_PORT ?? '3100';
const DOMAIN_A = 'tienda-a.local';
const DOMAIN_B = 'tienda-b.local';
const DOMAIN_UNKNOWN = 'tienda-c.local';

const at = (host: string, path = '/'): string => `http://${host}:${PORT}${path}`;

test.describe('Multi-dominio por host', () => {
  test('cada dominio sirve su identidad y su catalogo', async ({ page }) => {
    await page.goto(at(DOMAIN_A));
    await expect(page).toHaveTitle(/Tienda A \(e2e\)/);
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
    await expect(page.locator('header')).toContainText('Tienda A (e2e)');

    await page.goto(at(DOMAIN_B));
    await expect(page).toHaveTitle(/Tienda B \(e2e\)/);
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
    await expect(page.locator('header')).toContainText('Tienda B (e2e)');
    await expect(page.locator('header')).not.toContainText('Tienda A (e2e)');
  });

  test('robots.txt y la canonica salen del host de la peticion, no de una variable fija', async ({
    page,
  }) => {
    await page.goto(at(DOMAIN_A, '/robots.txt'));
    const robotsA = (await page.textContent('body')) ?? '';
    expect(robotsA).toContain(`http://${DOMAIN_A}:${PORT}`);
    expect(robotsA).not.toContain(DOMAIN_B);

    await page.goto(at(DOMAIN_B, '/robots.txt'));
    const robotsB = (await page.textContent('body')) ?? '';
    expect(robotsB).toContain(`http://${DOMAIN_B}:${PORT}`);
    expect(robotsB).not.toContain(DOMAIN_A);

    // La canonica/OG del documento tambien es la del host que atiende.
    await page.goto(at(DOMAIN_B));
    const html = await page.content();
    expect(html).toContain(`http://${DOMAIN_B}:${PORT}`);
  });

  test('sitemap.xml publica las URLs del host que lo pide', async ({ page }) => {
    await page.goto(at(DOMAIN_B, '/sitemap.xml'));
    const sitemap = (await page.textContent('body')) ?? '';
    expect(sitemap).toContain(`http://${DOMAIN_B}:${PORT}`);
    expect(sitemap).not.toContain(DOMAIN_A);
  });

  test('un dominio no declarado responde 404 y NO sirve el catalogo de otra empresa', async ({
    page,
  }) => {
    const response = await page.goto(at(DOMAIN_UNKNOWN));
    expect(response?.status()).toBe(404);

    const body = (await page.textContent('body')) ?? '';
    expect(body).toContain('Este dominio no tiene tienda configurada');
    expect(body).toContain(DOMAIN_UNKNOWN);
    // Ni catalogo ni identidad de las tiendas declaradas.
    await expect(page.locator('[data-testid="product-card"]')).toHaveCount(0);
    expect(body).not.toContain('Tienda A (e2e)');
    expect(body).not.toContain('Tienda B (e2e)');
  });

  test('el canal sigue siendo el mismo backend: la clave sale del host, no del navegador', async ({
    page,
  }) => {
    // La clave del canal **nunca** viaja al navegador (D10): ni en el HTML ni en el bundle.
    await page.goto(at(DOMAIN_A));
    const html = await page.content();
    expect(html).not.toContain('x-storefront-key');
    expect(html).not.toContain(process.env.STOREFRONT_API_KEY ?? 'tienda-dev-key-cambiar');
  });
});
