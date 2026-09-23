import { expect, test } from '@playwright/test';

import { getAllProducts, getCategories } from './helpers/erp-api';

const HOME_OFFERS = 8;
const HOME_FEATURED = 8;

test.describe('Home de la tienda', () => {
  test('lista los productos publicados y solo las ofertas vigentes del ERP', async ({ page }) => {
    const products = await getAllProducts();
    const categories = await getCategories();
    expect(products.length).toBeGreaterThan(0);

    const offerSlugs = products
      .filter((product) => product.salePrice !== null)
      .map((product) => product.slug);
    const plainProduct = products.find((product) => product.salePrice === null);
    expect(offerSlugs.length).toBeGreaterThan(0);
    expect(plainProduct).toBeDefined();

    await page.goto('/');

    // Productos destacados: la home muestra la primera pagina del catalogo.
    const featured = page.getByTestId('home-featured');
    await expect(featured.getByTestId('product-grid')).toBeVisible();
    const expectedFeatured = Math.min(HOME_FEATURED, products.length);
    await expect(featured.getByTestId('product-card')).toHaveCount(expectedFeatured);

    // Ofertas: exactamente las que el canal publica con `salePrice` no nulo.
    const offersSection = page.getByTestId('home-offers');
    await expect(offersSection.getByTestId('product-grid')).toBeVisible();
    const expectedOffers = Math.min(HOME_OFFERS, offerSlugs.length);
    await expect(offersSection.getByTestId('product-card')).toHaveCount(expectedOffers);

    const shownOfferSlugs = await offersSection
      .getByTestId('product-card')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-slug')));

    for (const slug of shownOfferSlugs) {
      expect(offerSlugs).toContain(slug);
      await expect(
        offersSection.locator(`[data-testid="product-card"][data-slug="${slug}"] [data-testid="discount-badge"]`),
      ).toBeVisible();
    }

    // Un producto sin oferta vigente NO puede aparecer en la seccion de ofertas.
    if (plainProduct !== undefined) {
      await expect(
        offersSection.locator(`[data-testid="product-card"][data-slug="${plainProduct.slug}"]`),
      ).toHaveCount(0);
    }

    // Categorias raiz con su conteo, tal como las publica el canal.
    await expect(page.getByTestId('category-card')).toHaveCount(categories.length);
    for (const category of categories) {
      await expect(
        page.locator(`[data-testid="category-card"][data-slug="${category.slug}"]`),
      ).toBeVisible();
    }

    // Los banners del slot home-hero se publican (el canal los sirve vigentes).
    await expect(page.getByTestId('home-hero').first()).toBeVisible();
  });
});
