import { expect, test } from '@playwright/test';

import { CATEGORY_PAGE_SIZE, getCatalog, getCategories, type ApiCategory } from './helpers/erp-api';

const ROOT_SLUG = 'celulares';

function findChildWithProducts(root: ApiCategory): ApiCategory | undefined {
  return root.children.find((child) => child.productCount > 0);
}

test.describe('Listado por categoria', () => {
  test('/categorias/celulares devuelve tambien los productos de sus subcategorias', async ({
    page,
  }) => {
    const categories = await getCategories();
    const root = categories.find((category) => category.slug === ROOT_SLUG);
    expect(root, `El canal no publica la categoria raiz ${ROOT_SLUG}`).toBeDefined();
    if (root === undefined) return;

    const child = findChildWithProducts(root);
    expect(child, `${ROOT_SLUG} no tiene subcategorias con productos`).toBeDefined();
    if (child === undefined) return;

    const childCatalog = await getCatalog({ category: child.slug, limit: 48 });
    const childProduct = childCatalog.data[0];
    expect(childProduct).toBeDefined();
    if (childProduct === undefined) return;

    const rootCatalog = await getCatalog({ category: ROOT_SLUG, limit: CATEGORY_PAGE_SIZE, page: 1 });
    expect(rootCatalog.total).toBeGreaterThan(childCatalog.total);

    await page.goto(`/categorias/${ROOT_SLUG}`);

    await expect(page.getByTestId('category-title')).toHaveText(root.name);

    // La grilla de la categoria padre trae lo de sus hijas (regla del canal).
    await expect(
      page.locator(`[data-testid="product-card"][data-slug="${childProduct.slug}"]`),
    ).toBeVisible();
    await expect(page.getByTestId('product-card')).toHaveCount(rootCatalog.data.length);

    // Las subcategorias se anuncian con su conteo.
    const subcategories = page.getByRole('navigation', { name: 'Subcategorias' });
    await expect(subcategories).toBeVisible();
    await expect(
      subcategories.getByRole('link', { name: new RegExp(child.name) }),
    ).toBeVisible();

    // Los enlaces de hija navegan a su propio listado.
    await page.goto(`/categorias/${child.slug}`);
    await expect(page.getByTestId('category-title')).toHaveText(child.name);
    await expect(page.getByTestId('product-card')).toHaveCount(childCatalog.data.length);
  });

  test('los filtros y el orden viajan por la URL y respetan lo que devuelve el canal', async ({
    page,
  }) => {
    const brands = await getCatalog({ category: ROOT_SLUG, limit: CATEGORY_PAGE_SIZE });
    const ascending = await getCatalog({
      category: ROOT_SLUG,
      sort: 'price_asc',
      limit: CATEGORY_PAGE_SIZE,
      page: 1,
    });
    const brandCode = ascending.data.find((product) => product.brandCode !== null)?.brandCode;
    expect(brandCode, 'Ningun producto de la categoria publica marca').toBeDefined();
    if (brandCode === undefined || brandCode === null) return;

    const byBrand = await getCatalog({
      category: ROOT_SLUG,
      brand: brandCode,
      limit: CATEGORY_PAGE_SIZE,
      page: 1,
    });
    expect(byBrand.total).toBeGreaterThan(0);

    // Orden por precio: la tienda no reordena nada, pasa `sort` al canal y pinta lo que
    // el canal devuelve. El canal ordena por el precio **efectivo** (la oferta vigente
    // aplicada) desde el arreglo del defecto medido en F2.3, asi que la secuencia
    // publicada tiene que ser monotona en `price`.
    await page.goto(`/categorias/${ROOT_SLUG}?sort=price_asc`);
    await expect(page.getByTestId('filtro-orden')).toHaveValue('price_asc');
    await expect(page.getByTestId('product-card')).toHaveCount(ascending.data.length);

    const renderedAscending = await page
      .getByTestId('product-card')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-slug')));
    expect(renderedAscending).toStrictEqual(ascending.data.map((product) => product.slug));

    const renderedPrices = await page
      .getByTestId('product-price')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number((node.textContent ?? '').replace(/[^\d.]/g, ''))),
      );
    expect(renderedPrices.length).toBeGreaterThan(1);
    expect(renderedPrices).toStrictEqual([...renderedPrices].sort((a, b) => a - b));

    // Filtro de marca por la URL.
    await page.goto(`/categorias/${ROOT_SLUG}?brand=${encodeURIComponent(brandCode)}`);
    await expect(page.getByTestId('filtro-marca')).toHaveValue(brandCode);
    await expect(page.getByTestId('product-card')).toHaveCount(byBrand.data.length);
    await expect(page.getByTestId('filtros-resumen')).toContainText(`${byBrand.total} producto`);

    // Con una sola pagina, el canal no publica paginador y la tienda no lo pinta.
    expect(brands.totalPages).toBe(1);
    await expect(page.getByRole('navigation', { name: 'Paginacion' })).toHaveCount(0);
  });
});
