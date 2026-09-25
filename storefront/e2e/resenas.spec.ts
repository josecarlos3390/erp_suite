import { expect, test, type Page } from '@playwright/test';

import {
  deliverOrderFully,
  erpAdminLogin,
  findReviewByBuyer,
  getCities,
  getProduct,
  moderateReview,
  placeOrder,
  submitReview,
  type ApiCity,
  type ApiOrder,
} from './helpers/erp-api';

const CITY = 'SCZ';
/** Sufijo unico por corrida: el pedido, el correo y la resena no chocan entre intentos. */
const RUN = Date.now().toString(36);

/** Producto publicado y con existencia: el que se compra para poder resenarlo. */
async function pickReviewableProduct(): Promise<{
  slug: string;
  name: string;
  itemId: number;
}> {
  const product = await getProduct('iphone-15-128gb', CITY);
  expect(
    product.availability.inStock,
    'El articulo del arnes no tiene existencia en la ciudad de la prueba',
  ).toBe(true);
  return { slug: product.slug, name: product.name, itemId: product.itemId };
}

async function cityOf(code: string): Promise<ApiCity> {
  const cities = await getCities();
  const city = cities.find((item) => item.code === code);
  if (!city) throw new Error(`El canal no publica la ciudad ${code}`);
  return city;
}

/** Hoy como dia del tenant (`YYYY-MM-DD`), que es lo que exige el flujo de Ventas. */
function tenantToday(): string {
  const now = new Date();
  const laPaz = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return laPaz.toISOString().slice(0, 10);
}

/** Compra el articulo por el **canal real** y devuelve el pedido y el correo del comprador. */
async function buy(
  slug: string,
  itemId: number,
  email: string,
): Promise<{ order: ApiOrder; email: string }> {
  const order = await placeOrder({
    idempotencyKey: `e2e-resenas-${RUN}-${email}`,
    cityCode: CITY,
    items: [{ itemId, quantity: 1 }],
    customer: { email, name: 'Comprador de la prueba' },
  });
  return { order, email };
}

/**
 * La ficha se sirve con la **cache del canal** (`revalidate: 60`, la misma ventana que la
 * promo): aprobar una resena no invalida la copia que la tienda ya tiene, asi que la
 * publicacion tarda esa ventana. La prueba la **mide** en vez de taparla con una espera fija:
 * devuelve los segundos que tardo y falla si no aparece.
 */
async function waitForPublishedReviews(
  page: Page,
  marker: string,
  expected: number,
): Promise<number> {
  const started = Date.now();
  const mine = page.getByTestId('review-item').filter({ hasText: marker });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.reload();
    if ((await mine.count()) >= expected) {
      const seconds = (Date.now() - started) / 1000;
      console.log(
        `[resenas] la ficha publico la resena aprobada ${seconds.toFixed(1)} s despues`,
      );
      return seconds;
    }
    await page.waitForTimeout(3_000);
  }
  throw new Error(
    'La resena aprobada no aparecio en la ficha dentro de la ventana de cache (3 minutos).',
  );
}

test.describe('Resenas', () => {
  /**
   * El camino completo de F6, de la compra a la ficha: el comprador compra, el ERP **entrega**
   * el pedido (la resena exige un pedido entregado de verdad, no un estado inventado), el
   * comprador escribe su resena desde la ficha, el back office la aprueba y la ficha publica el
   * promedio y la resena. Antes de aprobarla, la ficha **no** la muestra: la moderacion es lo
   * que publica.
   */
  test('la resena de un comprador con pedido entregado se publica al aprobarla', async ({
    page,
  }) => {
    // La ficha se sirve con la cache del canal (60 s): aprobar la resena puede tardar esa
    // ventana, y en la corrida completa otra prueba puede haber calentado la copia justo
    // antes. El caso **mide** la espera, asi que necesita un tope mayor que el del gate.
    test.setTimeout(240_000);
    const product = await pickReviewableProduct();
    const email = `resena-${RUN}@example.com`;
    const city = await cityOf(CITY);
    // El comentario lleva la marca de **esta** corrida: la base de desarrollo acumula las
    // resenas de las corridas anteriores y el caso mide la suya, no «alguna».
    const comment = `Llego en el plazo prometido y funciona perfecto. (${RUN})`;

    // 1) La compra y la **entrega real** en el ERP (flujo de Ventas, con su sesion).
    const { order } = await buy(product.slug, product.itemId, email);
    const token = await erpAdminLogin();
    await deliverOrderFully(token, order, city, tenantToday());

    // 2) La ficha ofrece el formulario y explica a quien le corresponde resenar.
    await page.goto(`/productos/${product.slug}`);
    await expect(page.getByTestId('review-form')).toBeVisible();
    await expect(page.getByTestId('review-form-rule')).toContainText('entregado');

    await page.getByTestId('review-order').fill(order.orderNumber);
    await page.getByTestId('review-email').fill(email);
    await page.getByTestId('review-rating').selectOption('5');
    await page.getByTestId('review-name').fill('Ana Quispe');
    await page.getByTestId('review-title').fill('Excelente compra');
    await page.getByTestId('review-comment').fill(comment);
    await page.getByTestId('review-submit').click();

    // 3) La resena queda **en revision**: la ficha todavia no la publica.
    await expect(page.getByTestId('review-sent')).toBeVisible();
    await expect(page.getByTestId('review-sent-message')).toContainText(
      'revisión',
    );

    await page.reload();
    await expect(page.getByTestId('review-form')).toBeVisible();
    const reviewRow = await findReviewByBuyer(token, email);
    expect(reviewRow.status).toBe('PENDING');
    expect(reviewRow.buyerLabel).toBe('Ana Quispe');
    const beforeModeration = await getProduct(product.slug, CITY);
    expect(
      (beforeModeration.reviews ?? []).some((row) => row.comment.includes(RUN)),
    ).toBe(false);

    // 4) El back office la aprueba: ahora si esta en la ficha, con su promedio. La copia
    // cacheada de la ficha tarda su ventana en verlo, asi que la prueba la **mide**.
    await moderateReview(token, reviewRow.id, 'APPROVED');

    const seconds = await waitForPublishedReviews(page, RUN, 1);
    expect(seconds).toBeLessThan(120);

    const mine = page.getByTestId('review-item').filter({ hasText: RUN });
    await expect(mine).toHaveCount(1);
    await expect(mine.first()).toContainText('Excelente compra');
    await expect(mine.first()).toContainText('Ana Quispe');
    // La ficha pinta el promedio y el numero que publica el canal (la base de desarrollo
    // acumula resenas de otras corridas, asi que el caso comprueba la **forma** del dato y no
    // un total que depende del historico).
    await expect(page.getByTestId('reviews-average')).toContainText(/[0-9],[0-9] de 5/);
    await expect(page.getByTestId('reviews-count')).toContainText(/\(\d+ resenas?\)/);
  });

  /**
   * La puerta de la resena: **sin pedido entregado no se escribe**. El caso compra de verdad
   * (el pedido existe y es de ese correo) pero **no** lo entrega, asi que el canal contesta con
   * su motivo y la tienda lo ensena tal cual. Un correo ajeno tampoco vale: la respuesta es la
   * misma que si el pedido no existiera, para no confirmar pedidos de otros.
   */
  test('sin pedido entregado la tienda ensena el motivo del canal', async ({
    page,
  }) => {
    const product = await pickReviewableProduct();
    const email = `sin-entregar-${RUN}@example.com`;
    const { order } = await buy(product.slug, product.itemId, email);

    await page.goto(`/productos/${product.slug}`);
    await page.getByTestId('review-order').fill(order.orderNumber);
    await page.getByTestId('review-email').fill(email);
    await page
      .getByTestId('review-comment')
      .fill('Quiero resenar antes de recibirlo.');
    await page.getByTestId('review-submit').click();

    const failure = page.getByTestId('review-error');
    await expect(failure).toBeVisible();
    await expect(failure).toContainText('no está entregado');

    // Otro correo no resena la compra de este pedido.
    await page.getByTestId('review-email').fill(`ajeno-${RUN}@example.com`);
    await page.getByTestId('review-submit').click();
    await expect(failure).toContainText('No existe el pedido');

    // Y el canal rechaza lo mismo por su API (la tienda no inventa la regla).
    const foreign = await submitReview({
      order: order.orderNumber,
      email: `ajeno-${RUN}@example.com`,
      slug: product.slug,
      rating: 1,
      comment: 'No soy el comprador de este pedido.',
    }).catch((error: unknown) => error as Error);
    expect(foreign).toBeInstanceOf(Error);
    expect((foreign as Error).message).toContain('No existe el pedido');
  });

  /**
   * Dos barreras antes de molestar al canal: el formulario valida lo que el navegador **no**
   * puede expresar (el minimo del comentario) y el puente `/api/resenas` valida **siempre**,
   * aunque la peticion no venga del formulario. Los dos motivos son los que ve el comprador.
   */
  test('el formulario y el puente validan antes de llamar al canal', async ({
    page,
    request,
  }) => {
    const product = await pickReviewableProduct();

    await page.goto(`/productos/${product.slug}`);
    await page.getByTestId('review-order').fill('PV-000000');
    await page.getByTestId('review-email').fill('comprador@example.com');
    // El comentario llega al formulario pero no dice nada (menos del minimo de la tienda).
    await page.getByTestId('review-comment').fill('Bien');
    await page.getByTestId('review-submit').click();

    await expect(page.getByText(/Cuenta algo mas/)).toBeVisible();
    await expect(page.getByTestId('review-sent')).toHaveCount(0);
    await expect(page.getByTestId('review-error')).toHaveCount(0);

    // El puente, por su parte, no se fia del formulario: sin producto responde 400.
    const noSlug = await request.post('/api/resenas', {
      data: { order: 'PV-1', email: 'a@b.com', rating: 5, comment: 'Comentario largo.' },
    });
    expect(noSlug.status()).toBe(400);
    expect(((await noSlug.json()) as { error: string }).error).toContain(
      'producto',
    );

    // Y con campos vacios tampoco sale hacia el canal.
    const empty = await request.post('/api/resenas', {
      data: { slug: product.slug, order: '', email: '', rating: 9, comment: '' },
    });
    expect(empty.status()).toBe(400);
    expect(((await empty.json()) as { error: string }).error).toContain(
      'numero de tu pedido',
    );
  });
});
