import { expect, test } from '@playwright/test';

import { findZeroStockProduct, getCatalog } from './helpers/erp-api';

const DEFAULT_CITY = 'SCZ';
const OTHER_CITY = 'LPZ';
const OTHER_CITY_NAME = 'La Paz';
const HOME_FEATURED = 8;

test.describe('Selector de ciudad', () => {
  test('cambiar a LPZ cambia la disponibilidad mostrada en la ficha', async ({ page }) => {
    // El articulo se descubre con la API: existencia en SCZ y cero en LPZ.
    const target = await findZeroStockProduct(OTHER_CITY, DEFAULT_CITY);

    await page.goto(`/productos/${target.slug}`);

    await expect(page.getByTestId('selector-ciudad')).toHaveValue(DEFAULT_CITY);
    await expect(page.getByTestId('detail-availability')).toHaveText(
      `Disponible: ${target.availableInDefaultCity}`,
    );
    await expect(page.getByTestId('add-to-cart')).toBeEnabled();

    await page.getByTestId('selector-ciudad').selectOption(OTHER_CITY);

    await expect(page.getByTestId('detail-availability')).toHaveText(
      `Sin existencia en ${target.emptyCityName}`,
    );
    await expect(page.getByTestId('product-city')).toContainText(target.emptyCityName);
    await expect(page.getByTestId('add-to-cart')).toBeDisabled();
    await expect(page.getByTestId('add-to-cart-blocked')).toBeVisible();

    // La eleccion queda guardada en la cookie: se mantiene al navegar.
    await page.goto('/');
    await expect(page.getByTestId('selector-ciudad')).toHaveValue(OTHER_CITY);

    // Y volver a SCZ restituye la existencia.
    await page.getByTestId('selector-ciudad').selectOption(DEFAULT_CITY);
    await expect(page.getByTestId('selector-ciudad')).toHaveValue(DEFAULT_CITY);

    await page.goto(`/productos/${target.slug}`);
    await expect(page.getByTestId('detail-availability')).toHaveText(
      `Disponible: ${target.availableInDefaultCity}`,
    );
  });

  test('la home vuelve a pedir la existencia de la ciudad elegida', async ({ page }) => {
    const sczPage = await getCatalog({ limit: HOME_FEATURED, page: 1, city: DEFAULT_CITY });
    const lpzPage = await getCatalog({ limit: HOME_FEATURED, page: 1, city: OTHER_CITY });

    // Precondicion medida del seed: la ciudad cambia la existencia de la home.
    const outOfStockInLpz = lpzPage.data.filter((product) => !product.availability.inStock);
    expect(
      outOfStockInLpz.length,
      'La home de LPZ no muestra ningun articulo agotado: el caso no probaria el cambio de ciudad',
    ).toBeGreaterThan(0);

    await page.goto('/');
    await expect(page.getByTestId('selector-ciudad')).toHaveValue(DEFAULT_CITY);

    await page.getByTestId('selector-ciudad').selectOption(OTHER_CITY);

    await expect(page.getByTestId('selector-ciudad')).toHaveValue(OTHER_CITY);
    await expect(page.getByTestId('home-offers')).toContainText(`existencia en ${OTHER_CITY_NAME}`);

    const featured = page.getByTestId('home-featured');
    await expect(featured.getByTestId('product-card')).toHaveCount(lpzPage.data.length);

    // Cada tarjeta de la home refleja la existencia del almacen de LPZ.
    for (const product of lpzPage.data) {
      const card = featured.locator(
        `[data-testid="product-card"][data-slug="${product.slug}"] [data-testid="product-availability"]`,
      );
      await expect(card).toHaveText(
        product.availability.inStock
          ? `Disponible: ${product.availability.available}`
          : `Sin existencia en ${OTHER_CITY_NAME}`,
      );
    }

    // Y el mismo articulo que en SCZ tenia existencia aparece agotado.
    const changed = outOfStockInLpz[0];
    if (changed !== undefined) {
      const inSantaCruz = sczPage.data.find((product) => product.slug === changed.slug);
      expect(inSantaCruz?.availability.inStock).toBe(true);
    }
  });
});
