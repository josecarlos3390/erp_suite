import { expect, test } from '@playwright/test';

import { CATEGORY_PAGE_SIZE, getAllProducts, getCatalog } from './helpers/erp-api';

const CITY_NAME = 'Santa Cruz de la Sierra';

test.describe('Busqueda', () => {
  test('devuelve los resultados que da el canal para el termino buscado', async ({ page }) => {
    const products = await getAllProducts();
    const first = products[0];
    expect(first).toBeDefined();
    if (first === undefined) return;

    const term = first.name.split(' ')[0] ?? first.name;
    const expected = await getCatalog({ search: term, limit: CATEGORY_PAGE_SIZE, page: 1 });
    expect(expected.total).toBeGreaterThan(0);

    await page.goto(`/buscar?q=${encodeURIComponent(term)}`);

    const noun = expected.total === 1 ? 'producto' : 'productos';
    await expect(page.getByTestId('search-summary')).toHaveText(
      `${expected.total} ${noun} · existencia en ${CITY_NAME}`,
    );
    await expect(page.getByTestId('product-card')).toHaveCount(expected.data.length);
    await expect(page.getByTestId('product-card').first()).toBeVisible();

    // El producto de la primera posicion del canal aparece en la grilla.
    const firstResult = expected.data[0];
    if (firstResult !== undefined) {
      await expect(
        page.locator(`[data-testid="product-card"][data-slug="${firstResult.slug}"]`),
      ).toBeVisible();
    }
  });

  test('un termino sin resultados muestra el estado vacio accionable', async ({ page }) => {
    const expected = await getCatalog({ search: 'zzzz-termino-inexistente-zzzz', limit: 24, page: 1 });
    expect(expected.total).toBe(0);

    await page.goto('/buscar?q=zzzz-termino-inexistente-zzzz');

    const emptyState = page.getByTestId('search-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(
      emptyState.getByRole('heading', { name: 'No encontramos productos para esa busqueda' }),
    ).toBeVisible();
    await expect(emptyState.getByRole('link', { name: 'Ver categorias' })).toBeVisible();
    await expect(page.getByTestId('product-card')).toHaveCount(0);

    // El estado vacio lleva a algun lado: el enlace de categorias funciona.
    await emptyState.getByRole('link', { name: 'Ver categorias' }).click();
    await expect(page).toHaveURL(/\/categorias$/);
    await expect(page.getByTestId('category-card').first()).toBeVisible();
  });

  test('sin termino de busqueda la pagina pide uno y sugiere por donde empezar', async ({ page }) => {
    await page.goto('/buscar');
    await expect(page.getByRole('heading', { level: 1, name: 'Buscar productos' })).toBeVisible();
    await expect(page.getByTestId('search-empty-state')).toBeVisible();
    await expect(page.getByTestId('buscador')).toBeVisible();
  });

  test('la paginacion recorre las paginas que devuelve el canal', async ({ page }) => {
    // "de" aparece en las descripciones del seed: devuelve varias paginas.
    const term = 'de';
    const firstPage = await getCatalog({ search: term, limit: CATEGORY_PAGE_SIZE, page: 1 });
    const secondPage = await getCatalog({ search: term, limit: CATEGORY_PAGE_SIZE, page: 2 });
    expect(firstPage.totalPages).toBeGreaterThan(1);
    expect(secondPage.data.length).toBeGreaterThan(0);

    await page.goto(`/buscar?q=${term}`);
    const pager = page.getByRole('navigation', { name: 'Paginacion' });
    await expect(pager).toBeVisible();
    await expect(page.getByTestId('product-card')).toHaveCount(firstPage.data.length);

    const renderedFirst = await page
      .getByTestId('product-card')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-slug')));
    expect(renderedFirst).toStrictEqual(firstPage.data.map((product) => product.slug));

    await pager.getByTestId('pager-next').click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByTestId('product-card')).toHaveCount(secondPage.data.length);

    const renderedSecond = await page
      .getByTestId('product-card')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-slug')));
    expect(renderedSecond).toStrictEqual(secondPage.data.map((product) => product.slug));
  });
});
