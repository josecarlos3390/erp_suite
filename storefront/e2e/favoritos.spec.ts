import { expect, test } from '@playwright/test';

import { getCatalog, getProduct, type ApiProduct } from './helpers/erp-api';

const ROOT_SLUG = 'celulares';
const CITY = 'SCZ';

/** Elige productos publicados de la categoria, con sus slugs estables para el gate. */
async function pickProducts(count: number): Promise<ApiProduct[]> {
  const page = await getCatalog({ category: ROOT_SLUG, limit: 48, city: CITY });
  const candidates = page.data.slice(0, count);
  expect(
    candidates.length,
    `El canal no publica ${count} productos en ${ROOT_SLUG}`,
  ).toBe(count);
  return candidates;
}

/** Guarda un producto en favoritos desde la grilla de la categoria. */
async function toggleFromGrid(
  page: import('@playwright/test').Page,
  slug: string,
): Promise<void> {
  const card = page.locator(`[data-testid="product-card"][data-slug="${slug}"]`);
  await expect(card).toBeVisible();
  await card.getByTestId('wishlist-toggle').click();
}

test.describe('Favoritos', () => {
  /**
   * Los favoritos (F6) son una lista **del dispositivo** que se revisa dias despues, asi que la
   * pagina pide el dato **vigente** al canal: lo que se guarda es la identidad del producto, no
   * una copia del precio. Este caso mide el ciclo completo desde la grilla.
   */
  test('guardar dos productos, verlos con el precio del canal y vaciar la lista', async ({
    page,
  }) => {
    const [first, second] = (await pickProducts(2)) as [ApiProduct, ApiProduct];
    const firstDetail = await getProduct(first.slug, CITY);

    await page.goto(`/categorias/${ROOT_SLUG}`);
    // Sin nada guardado, el enlace de favoritos no ocupa sitio en la cabecera.
    await expect(page.getByTestId('wishlist-link')).toHaveCount(0);

    await toggleFromGrid(page, first.slug);
    await expect(
      page.locator(
        `[data-testid="product-card"][data-slug="${first.slug}"] [data-testid="wishlist-toggle"]`,
      ),
    ).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('wishlist-count')).toHaveText('1');

    await toggleFromGrid(page, second.slug);
    await expect(page.getByTestId('wishlist-count')).toHaveText('2');

    await page.getByTestId('wishlist-link').click();
    await expect(page).toHaveURL(/\/favoritos$/);

    const items = page.getByTestId('wishlist-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute('data-slug', first.slug);
    await expect(items.nth(1)).toHaveAttribute('data-slug', second.slug);

    // El precio de la tarjeta es el **vigente** del canal (la lista no guarda precios).
    const priceText = await items.nth(0).getByTestId('product-price').innerText();
    expect(readMoney(priceText)).toBe(firstDetail.price);
    // Y la segunda tarjeta sigue trayendo su compra rapida y su control de comparar: los
    // favoritos son una vista del catalogo, no una pantalla con reglas propias.
    await expect(items.nth(1).getByTestId('quick-add')).toBeVisible();
    await expect(items.nth(1).getByTestId('compare-toggle')).toBeVisible();

    // Quitar uno deja el otro y baja el contador.
    await page.getByTestId('wishlist-remove').first().click();
    await expect(page.getByTestId('wishlist-item')).toHaveCount(1);
    await expect(page.getByTestId('wishlist-count')).toHaveText('1');

    // Vaciar deja el estado vacio explicado (y el enlace de la cabecera desaparece).
    await page.getByTestId('wishlist-clear').click();
    await expect(page.getByTestId('wishlist-empty')).toBeVisible();
    await expect(page.getByTestId('wishlist-link')).toHaveCount(0);
  });

  /**
   * La lista vive en el navegador, asi que sobrevive a la navegacion; y desde dos favoritos se
   * puede saltar al comparador, que es la union natural de las dos piezas de F6.
   */
  test('la lista sobrevive a la navegacion y lleva al comparador', async ({ page }) => {
    const products = await pickProducts(2);

    await page.goto(`/categorias/${ROOT_SLUG}`);
    for (const product of products) {
      await toggleFromGrid(page, product.slug);
    }

    // Otra pantalla del catalogo: la cabecera sigue contando lo guardado.
    await page.goto('/');
    await expect(page.getByTestId('wishlist-count')).toHaveText('2');

    await page.getByTestId('wishlist-link').click();
    await expect(page.getByTestId('wishlist-to-compare')).toBeVisible();
    await page.getByTestId('wishlist-to-compare').click();
    await expect(page).toHaveURL(/\/comparar$/);
    // El comparador lee SU lista (vacía): son dos listas distintas y no se mezclan.
    await expect(page.getByTestId('compare-empty')).toBeVisible();
  });

  /**
   * El puente `/api/favoritos` es publico (lo llama el navegador) y **sanea** lo que recibe:
   * sin slugs validos responde 400, lo que no tiene forma de slug publicado no se consulta y la
   * lista se recorta al tope (24), que es el mismo que usa la pagina.
   */
  test('el API de favoritos sanea la lista y la recorta al tope', async ({ request }) => {
    const empty = await request.get('/api/favoritos?slugs=');
    expect(empty.status()).toBe(400);

    const junk = await request.get(
      '/api/favoritos?slugs=%3Cscript%3E,CON%20ESPACIO,MAYUSCULAS!',
    );
    expect(junk.status()).toBe(400);

    const products = await pickProducts(1);
    const valid = products[0]?.slug ?? '';
    const mixed = await request.get(
      `/api/favoritos?slugs=${valid},%3Cscript%3E&city=${CITY}`,
    );
    expect(mixed.status()).toBe(200);
    const mixedBody = (await mixed.json()) as { products: Array<{ slug: string }> };
    expect(mixedBody.products.map((product) => product.slug)).toEqual([valid]);

    // 25 slugs publicados: el canal solo recibe (y devuelve) los primeros 24. Se toman del
    // catalogo **completo** porque la categoria del arnes tiene 10 productos.
    const all = await getCatalog({ limit: 48, city: CITY });
    const many = all.data.slice(0, 25).map((product) => product.slug);
    expect(many.length).toBe(25);
    const capped = await request.get(
      `/api/favoritos?slugs=${many.join(',')}&city=${CITY}`,
    );
    expect(capped.status()).toBe(200);
    const cappedBody = (await capped.json()) as { products: Array<{ slug: string }> };
    expect(cappedBody.products).toHaveLength(24);
  });
});

/** Lee un importe en bolivianos que la tienda formateo (`Bs 129,00`). */
function readMoney(text: string): number {
  const digits = text.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(digits);
  expect(Number.isFinite(value), `No se pudo leer el importe "${text}"`).toBe(true);
  return value;
}
