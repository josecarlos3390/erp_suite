import { expect, test } from '@playwright/test';

import { getAllProducts, getProduct, type ApiProduct } from './helpers/erp-api';

const DEFAULT_CITY = 'SCZ';
const DEFAULT_CITY_NAME = 'Santa Cruz de la Sierra';

/** Producto con existencia, ficha tecnica y categoria: el caso mas completo. */
function pickProduct(products: ApiProduct[]): ApiProduct {
  const withEverything = products.find(
    (product) => product.availability.inStock && product.specs.length > 0 && product.category !== null,
  );
  const target = withEverything ?? products[0];
  if (target === undefined) {
    throw new Error('El canal no publico ningun producto.');
  }
  return target;
}

function normalize(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function expectedMoney(price: number, currency: string): string {
  return normalize(
    new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price),
  );
}

test.describe('Ficha de producto', () => {
  test('muestra precio, disponibilidad de la ciudad y el JSON-LD de Product/Offer', async ({
    page,
  }) => {
    const products = await getAllProducts();
    const target = pickProduct(products);
    const detail = await getProduct(target.slug, DEFAULT_CITY);

    await page.goto(`/productos/${target.slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(detail.name);

    // Disponibilidad de la ciudad elegida, tal como la calcula el ERP.
    const availability = page.getByTestId('detail-availability');
    if (detail.availability.inStock) {
      await expect(availability).toHaveText(`Disponible: ${detail.availability.available}`);
    } else {
      await expect(availability).toHaveText(`Sin existencia en ${DEFAULT_CITY_NAME}`);
    }

    // El precio pintado es el precio efectivo del canal.
    const priceText = await page.getByTestId('detail-price').textContent();
    expect(normalize(priceText ?? '')).toBe(expectedMoney(detail.price, detail.currency));

    // JSON-LD de producto y oferta.
    const jsonLd = await page.locator('#jsonld-producto').textContent();
    expect(jsonLd).not.toBeNull();
    const parsed = JSON.parse(jsonLd ?? '{}') as {
      '@type'?: string;
      name?: string;
      sku?: string;
      offers?: { '@type'?: string; price?: number; priceCurrency?: string; availability?: string };
    };
    expect(parsed['@type']).toBe('Product');
    expect(parsed.name).toBe(detail.name);
    expect(parsed.sku).toBe(detail.sku);
    expect(parsed.offers?.['@type']).toBe('Offer');
    expect(parsed.offers?.price).toBe(detail.price);
    expect(parsed.offers?.priceCurrency).toBe(detail.currency);
    expect(parsed.offers?.availability).toContain(
      detail.availability.inStock ? 'InStock' : 'OutOfStock',
    );

    // Migas de pan estructuradas.
    const breadcrumb = await page.locator('#jsonld-migas-producto').textContent();
    const crumbData = JSON.parse(breadcrumb ?? '{}') as {
      '@type'?: string;
      itemListElement?: unknown[];
    };
    expect(crumbData['@type']).toBe('BreadcrumbList');
    expect((crumbData.itemListElement ?? []).length).toBeGreaterThanOrEqual(2);

    // Ficha tecnica: todas las caracteristicas publicadas.
    if (detail.specs.length > 0) {
      // La ficha (F9.4) pinta un acordeon por GRUPO de caracteristicas, asi que hay
      // una tabla por grupo: se cuentan las filas de todas con un selector CSS —con
      // `getByTestId(...).locator(...)` el padre resolveria a varios elementos y
      // Playwright fallaria en modo estricto cuando el articulo tiene 2+ grupos—.
      await expect(page.locator('[data-testid="specs-table"] tbody tr')).toHaveCount(
        detail.specs.length,
      );
      for (const spec of detail.specs) {
        await expect(
          page.getByRole('rowheader', { name: spec.name, exact: true }).first(),
        ).toBeVisible();
      }
    }

    // Galeria: una miniatura por imagen publicada (solo si hay mas de una).
    const thumbs = page.getByTestId('gallery-thumb');
    if (detail.images.length > 1) {
      await expect(thumbs).toHaveCount(detail.images.length);
    } else {
      await expect(thumbs).toHaveCount(0);
    }

    // El boton de compra respeta la existencia de la ciudad.
    const addToCart = page.getByTestId('add-to-cart');
    if (detail.availability.inStock) {
      await expect(addToCart).toBeEnabled();
    } else {
      await expect(addToCart).toBeDisabled();
      await expect(page.getByTestId('add-to-cart-blocked')).toBeVisible();
    }
  });

  test('un slug inexistente responde 404 con la pagina de la tienda', async ({ page }) => {
    const response = await page.goto('/productos/slug-que-no-existe-zzz');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'No encontramos esta pagina' })).toBeVisible();
  });
});
