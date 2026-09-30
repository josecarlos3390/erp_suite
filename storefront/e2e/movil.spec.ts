import { devices, expect, test } from '@playwright/test';

/**
 * Gate **móvil** de la tienda (2026-09-30).
 *
 * **Lo que reportó el usuario**: «cuando ingreso a ver un producto en el ecommerce, cuando doy
 * un click en el card, ya no se ajusta el contenido al móvil».
 *
 * **Medido antes** (iPhone 14, 390 px, contra la tienda desplegada): **1 de 12** rutas
 * desbordaba el ancho —la **ficha de producto**— con `document.scrollWidth = 661` y
 * `window.innerWidth` expandido a **661** (el navegador encogía la página entera): se cortaban
 * el buscador, los *chips* de categorías y la foto. La causa era la **pista del grid** de la
 * ficha: en móvil (donde la plantilla `lg:` no aplica) la columna única se dimensiona por el
 * `min-content` de sus ítems y el `min-width: auto` de un ítem de grid no lo deja encogerse;
 * las dos columnas medían **645** dentro de una `main` de 390. Con `min-width: 0` en las
 * columnas el documento vuelve a **390** y cada columna mide **358** (verificado en el
 * navegador antes de tocar el código).
 *
 * El caso que importa es el **flujo del usuario**: entrar a la home y **pulsar una tarjeta**.
 * Además se recorren las rutas fijas, porque el mismo defecto puede aparecer en cualquier
 * plantilla de una sola columna.
 */
test.use({ ...devices['iPhone 14'] });

/** Rutas sin parámetros: la ficha se prueba pulsando una tarjeta (el flujo real). */
const ROUTES = [
  '/',
  '/categorias',
  '/buscar?q=iphone',
  '/carrito',
  '/checkout',
  '/comparar',
  '/favoritos',
  '/sucursales',
  '/seguimiento',
];

/** Lo que se mide: el ancho del documento y si el viewport se expandió (el síntoma real). */
async function widthReport(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    // El elemento más ancho que **no** vive en un contenedor con scroll propio: si lo hay, el
    // desbordamiento es del documento y no de un carrusel legítimo.
    const innerW = window.innerWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= innerW + 1 || r.height <= 0) return false;
        let parent: Element | null = el.parentElement;
        while (parent && parent !== document.body) {
          const overflowX = getComputedStyle(parent).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      })
      .slice(0, 4)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 60),
        w: Math.round(el.getBoundingClientRect().width),
      }));
    return {
      viewportW: innerW,
      docScrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      offenders,
    };
  });
}

test.describe('Tienda en móvil (390 px)', () => {
  for (const route of ROUTES) {
    test(`"${route}" no desborda el ancho`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(800);

      const report = await widthReport(page);
      expect(
        report.docScrollW,
        `"${route}" desborda: scrollWidth=${report.docScrollW} clientWidth=${report.clientW}; ` +
          `elementos fuera: ${JSON.stringify(report.offenders)}`,
      ).toBeLessThanOrEqual(report.clientW + 1);
      // El síntoma del usuario: el navegador **encoge** la página cuando el contenido no cabe.
      expect(report.viewportW).toBeLessThanOrEqual(390 + 1);
    });
  }

  test('pulsar una tarjeta de producto abre la ficha sin desbordar (el flujo reportado)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const card = page.getByTestId('product-card').first();
    await expect(card).toBeVisible();
    const slug = await card.getAttribute('data-slug');

    /**
     * Se pulsa el enlace **accesible** de la tarjeta (el del título): el clic en el centro de
     * la tarjeta cae en el botón de **compra rápida**, que añade al carrito y **no** navega
     * (medido en la primera corrida de este caso: la URL se quedaba en `/`). El enlace de la
     * imagen va con `aria-hidden`, así que `getByRole('link')` devuelve solo el del título.
     */
    await card.getByRole('link').first().click();

    await expect(page).toHaveURL(new RegExp(`/productos/${slug}`));
    await expect(page.getByTestId('product-title')).toBeVisible();
    await page.waitForTimeout(800);

    const report = await widthReport(page);
    expect(
      report.docScrollW,
      `la ficha desborda: scrollWidth=${report.docScrollW} clientWidth=${report.clientW}; ` +
        `elementos fuera: ${JSON.stringify(report.offenders)}`,
    ).toBeLessThanOrEqual(report.clientW + 1);
    expect(report.viewportW).toBeLessThanOrEqual(390 + 1);
  });
});
