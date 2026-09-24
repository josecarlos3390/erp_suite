import { expect, test } from '@playwright/test';

import { getCatalog, getProduct, type ApiProduct } from './helpers/erp-api';

const ROOT_SLUG = 'celulares';
const CITY = 'SCZ';

/** Elige productos publicados de la categoria, con su slug estable para el gate. */
async function pickProducts(count: number): Promise<ApiProduct[]> {
  const page = await getCatalog({ category: ROOT_SLUG, limit: 48, city: CITY });
  const candidates = page.data.slice(0, count);
  expect(
    candidates.length,
    `El canal no publica ${count} productos en ${ROOT_SLUG}`,
  ).toBe(count);
  return candidates;
}

/** Agrega un producto al comparador desde la grilla de la categoria. */
async function toggleFromGrid(
  page: import('@playwright/test').Page,
  slug: string,
): Promise<void> {
  const card = page.locator(
    `[data-testid="product-card"][data-slug="${slug}"]`,
  );
  await expect(card).toBeVisible();
  await card.getByTestId('compare-toggle').click();
}

test.describe('Comparador', () => {
  /**
   * El comparator (F6) compara **datos vigentes**: la lista del navegador guarda solo la
   * identidad de cada producto y la tabla se pide al canal al abrir `/comparar`. Este caso mide
   * las dos cosas: que el control de las tarjetas agrega y quita, y que la tabla publica el
   * precio, la existencia y el vendedor que devuelve el canal **en ese momento**.
   */
  test('comparar dos productos publica los datos vigentes del canal y permite quitar y vaciar', async ({
    page,
  }) => {
    const [first, second] = (await pickProducts(2)) as [ApiProduct, ApiProduct];
    const firstDetail = await getProduct(first.slug, CITY);
    const secondDetail = await getProduct(second.slug, CITY);

    await page.goto(`/categorias/${ROOT_SLUG}`);
    // Sin nada elegido, el enlace del comparador no ocupa sitio en la cabecera.
    await expect(page.getByTestId('compare-link')).toHaveCount(0);

    await toggleFromGrid(page, first.slug);
    await expect(
      page.locator(
        `[data-testid="product-card"][data-slug="${first.slug}"] [data-testid="compare-toggle"]`,
      ),
    ).toHaveAttribute('data-selected', 'true');

    await toggleFromGrid(page, second.slug);
    // El contador de la cabecera aparece con lo elegido.
    await expect(page.getByTestId('compare-count')).toHaveText('2');

    await page.getByTestId('compare-link').click();
    await expect(page).toHaveURL(/\/comparar$/);

    const columns = page.getByTestId('compare-column');
    await expect(columns).toHaveCount(2);
    await expect(columns.nth(0)).toHaveAttribute('data-slug', first.slug);
    await expect(columns.nth(1)).toHaveAttribute('data-slug', second.slug);

    // El precio de cada columna es el del canal, no una copia guardada.
    const prices = page.getByTestId('compare-price');
    await expect(prices).toHaveCount(2);
    expect(await readMoney(prices.nth(0))).toBe(firstDetail.price);
    expect(await readMoney(prices.nth(1))).toBe(secondDetail.price);

    // Existencia de la ciudad elegida y vendedor de cada publicacion (F6 #1).
    await expect(page.getByTestId('compare-availability').nth(0)).toContainText(
      first.availability.inStock ? 'Disponible' : 'Sin existencia',
    );
    await expect(page.getByTestId('compare-seller').nth(0)).toHaveText(
      first.seller ?? '—',
    );

    // La tabla solo compara lo que comparten: cada fila de caracteristica trae dos celdas.
    const specRows = page.getByTestId('compare-spec-row');
    const shared = await sharedSpecNames(firstDetail, secondDetail);
    await expect(specRows).toHaveCount(shared.length);
    if (shared.length > 0) {
      const firstRow = specRows.first();
      await expect(firstRow).toHaveAttribute('data-spec', shared[0] ?? '');
      await expect(firstRow.locator('td')).toHaveCount(2);
    }

    // Quitar una columna deja la otra en pie y el contador de la cabecera en 1.
    await page.getByTestId('compare-remove').first().click();
    await expect(page.getByTestId('compare-column')).toHaveCount(1);
    await expect(page.getByTestId('compare-count')).toHaveText('1');

    // Y vaciar deja el estado vacio explicado (y el enlace de la cabecera desaparece).
    await page.getByTestId('compare-clear').click();
    await expect(page.getByTestId('compare-empty')).toBeVisible();
    await expect(page.getByTestId('compare-link')).toHaveCount(0);
  });

  test('el tope es 4 productos y el control lo dice en vez de fallar en silencio', async ({
    page,
  }) => {
    const products = await pickProducts(5);

    await page.goto(`/categorias/${ROOT_SLUG}`);
    for (const product of products.slice(0, 4)) {
      await toggleFromGrid(page, product.slug);
    }
    await expect(page.getByTestId('compare-count')).toHaveText('4');

    // El quinto no se puede agregar: el control esta deshabilitado y lo explica.
    const fifth = page.locator(
      `[data-testid="product-card"][data-slug="${products[4]?.slug ?? ''}"] [data-testid="compare-toggle"]`,
    );
    await expect(fifth).toBeDisabled();
    await expect(fifth).toHaveAttribute(
      'title',
      /Ya comparas 4 productos: quita uno para agregar otro\./,
    );

    // Un producto YA comparado se puede quitar aunque la lista este llena.
    await toggleFromGrid(page, products[0]?.slug ?? '');
    await expect(page.getByTestId('compare-count')).toHaveText('3');
    await expect(fifth).toBeEnabled();
  });

  /**
   * El puente `/api/comparar` es publico (lo llama el navegador) y **sanea** lo que recibe: sin
   * slugs validos responde 400 y lo que no tiene forma de slug publicado no se consulta al
   * canal. Es el mismo contrato que el checkout (D10): la clave del canal vive en el servidor.
   */
  test('el API del comparador rechaza una peticion sin slugs validos y sanea los que no lo son', async ({
    request,
  }) => {
    const empty = await request.get('/api/comparar?slugs=');
    expect(empty.status()).toBe(400);

    const junk = await request.get(
      '/api/comparar?slugs=%3Cscript%3E,CON%20ESPACIO,MAYUSCULAS!',
    );
    expect(junk.status()).toBe(400);

    const products = await pickProducts(1);
    const valid = products[0]?.slug ?? '';
    const mixed = await request.get(
      `/api/comparar?slugs=${valid},%3Cscript%3E&city=${CITY}`,
    );
    expect(mixed.status()).toBe(200);
    const body = (await mixed.json()) as { products: Array<{ slug: string }> };
    expect(body.products.map((product) => product.slug)).toEqual([valid]);
  });
});

/** Lee un importe en bolivianos que la tienda formateo (`Bs 129,00`). */
async function readMoney(
  locator: import('@playwright/test').Locator,
): Promise<number> {
  const text = (await locator.innerText()).trim();
  const digits = text
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number.parseFloat(digits);
  expect(Number.isFinite(value), `No se pudo leer el importe "${text}"`).toBe(
    true,
  );
  return value;
}

/**
 * Nombres de caracteristica que **comparten** los dos productos y que la tabla compara (la
 * misma regla que `src/lib/compare.ts`: se excluyen las que ya son fila fija de la tabla).
 */
async function sharedSpecNames(
  first: ApiProduct,
  second: ApiProduct,
): Promise<string[]> {
  const reserved = [
    'producto',
    'precio',
    'existencia',
    'marca',
    'vendido por',
    'garantia',
    'categoria',
    'sku',
  ];
  const normalize = (name: string): string =>
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const secondNames = new Set(second.specs.map((spec) => spec.name));
  return first.specs
    .map((spec) => spec.name)
    .filter((name) => !reserved.includes(normalize(name)))
    .filter((name) => secondNames.has(name));
}
