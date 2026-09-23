import { expect, test, type Page } from '@playwright/test';

import {
  findShippableProduct,
  findUnquotableProduct,
  placeOrder,
  quote,
  trackOrder,
  type ApiOrder,
} from './helpers/erp-api';

/**
 * Gate E2E de F3: **checkout de invitado, confirmacion y seguimiento publico**.
 *
 * Todo se mide contra la API del ERP **en marcha** y con el seed real: los
 * articulos y la ciudad se descubren con el canal (nunca se codifican a mano) y
 * los importes que muestra la tienda se comparan con los que devuelve la
 * cotizacion del ERP.
 *
 * La tienda **crea pedidos de verdad** (no hay modo simulado): cada caso usa su
 * propia clave de idempotencia y asume que el seed de desarrollo deja existencia
 * de sobra para las unidades que compra (1 unidad).
 */

const CITY = 'SCZ';
const OTHER_CITY = 'LPZ';

/** Clave unica por caso: el canal solo deduplica dentro de la misma clave. */
function uniqueKey(prefix: string): string {
  return `e2e-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface Buyer {
  email: string;
  name: string;
  phone: string;
  street: string;
  district: string;
}

function defaultBuyer(prefix: string): Buyer {
  return {
    email: `e2e-${prefix}-${Date.now().toString(36)}@example.com`,
    name: 'Comprador E2E',
    phone: '70012345',
    street: 'Av. Los Sauces #120',
    district: 'Equipetrol',
  };
}

/** Agrega un articulo al carrito desde su ficha y espera a que el contador sume. */
async function addToCart(page: Page, slug: string, expectedCount: string): Promise<void> {
  await page.goto(`/productos/${slug}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-count')).toHaveText(expectedCount);
}

/** Rellena el paso 1 y avanza al paso 2. */
async function fillBuyer(page: Page, buyer: Buyer): Promise<void> {
  await page.getByTestId('checkout-email').fill(buyer.email);
  await page.getByTestId('checkout-name').fill(buyer.name);
  await page.getByTestId('checkout-phone').fill(buyer.phone);
  await page.getByTestId('checkout-street').fill(buyer.street);
  await page.getByTestId('checkout-district').fill(buyer.district);
  await page.getByTestId('checkout-next-1').click();
  await expect(page.getByTestId('checkout-step-2')).toHaveAttribute('data-state', 'current');
}

/** Paso 2: elige la forma de entrega y el metodo de pago, y va al resumen. */
async function chooseDeliveryAndPayment(page: Page, paymentCode: string): Promise<void> {
  await page.getByTestId('checkout-delivery-home').check();
  await page.getByTestId(`checkout-payment-${paymentCode.toLowerCase()}`).check();
  await page.getByTestId('checkout-next-2').click();
  await expect(page.getByTestId('checkout-step-3')).toHaveAttribute('data-state', 'current');
}

/** Espera a que el resumen muestre la cotizacion del ERP. */
async function waitForQuote(page: Page): Promise<void> {
  await expect(page.getByTestId('checkout-quote-subtotal')).toBeVisible();
  await expect(page.getByTestId('checkout-quote-loading')).toHaveCount(0);
}

/** Lee un importe en bolivianos que la tienda formateo (`Bs 129,00`). */
async function readMoney(locator: ReturnType<Page['getByTestId']>): Promise<number> {
  const text = (await locator.innerText()).trim();
  const digits = text.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(digits);
  expect(Number.isFinite(value), `No se pudo leer el importe "${text}"`).toBe(true);
  return value;
}

/** Un pedido creado por el ERP para consultas puras (seguimiento). */
async function createRealOrder(prefix: string): Promise<{ order: ApiOrder; buyer: Buyer }> {
  const product = await findShippableProduct(CITY);
  const buyer = defaultBuyer(prefix);
  const order = await placeOrder({
    idempotencyKey: uniqueKey(prefix),
    cityCode: CITY,
    items: [{ itemId: product.itemId, quantity: 1 }],
    customer: buyer,
  });
  return { order, buyer };
}

test.describe('Checkout de invitado', () => {
  test('el checkout muestra los totales que cotiza el ERP para un articulo y una ciudad reales', async ({
    page,
  }) => {
    const target = await findShippableProduct(CITY);
    // La cotizacion del canal es el oraculo: los mismos articulos y la misma ciudad.
    const expected = await quote(CITY, [{ itemId: target.itemId, quantity: 1 }]);

    await addToCart(page, target.slug, '1');
    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-city-name')).toContainText(target.cityName);

    await fillBuyer(page, defaultBuyer('totales'));
    await chooseDeliveryAndPayment(page, 'TRANSFER');
    await waitForQuote(page);

    // La existencia y el precio de la linea son los del canal.
    const line = page.getByTestId('checkout-quote-line').first();
    await expect(line).toHaveAttribute('data-item-id', String(target.itemId));
    await expect(line).toContainText(`disponible ${expected.items[0]?.available ?? 0}`);

    // Subtotal, envio y total: los del ERP, no los que calcula la tienda.
    expect(await readMoney(page.getByTestId('checkout-quote-subtotal'))).toBe(expected.subtotal);
    expect(await readMoney(page.getByTestId('checkout-quote-shipping'))).toBe(expected.shipping);
    expect(await readMoney(page.getByTestId('checkout-quote-total'))).toBe(expected.total);
    expect(expected.shippingCharged).toBe(true);
    expect(expected.subtotal).toBe(target.price);

    // Y el aviso obligatorio: la cotizacion no incluye impuestos.
    await expect(page.getByTestId('checkout-tax-notice')).toContainText('no incluye impuestos');
  });

  test('confirmar crea un pedido real y la confirmacion publica numero y codigo de seguimiento', async ({
    page,
  }) => {
    const target = await findShippableProduct(CITY);
    const buyer = defaultBuyer('confirmar');

    await addToCart(page, target.slug, '1');
    await page.goto('/checkout');
    await fillBuyer(page, buyer);
    await chooseDeliveryAndPayment(page, 'QR');
    await waitForQuote(page);

    await page.getByTestId('checkout-confirm').click();

    // El pedido es real: el canal lo puede leer por el numero que aparece en pantalla.
    await expect(page.getByTestId('order-number')).toBeVisible();
    const orderNumber = (await page.getByTestId('order-number').innerText()).trim();
    const trackingCode = (await page.getByTestId('order-tracking-code').innerText()).trim();

    // El numero sigue la serie del ERP (prefijo + consecutivo), no un id de la tienda.
    expect(orderNumber).toMatch(/^[A-Z]{2,6}-\d+$/);
    expect(orderNumber.startsWith('PED-')).toBe(true);
    expect(trackingCode).not.toBe('—');
    expect(trackingCode.length).toBeGreaterThan(0);
    await expect(page).toHaveURL(new RegExp(`/pedido/${orderNumber}$`));
    await expect(page.getByTestId('order-confirmed-number')).toHaveText(orderNumber);

    // El pedido del canal coincide con lo que muestra la confirmacion.
    const stored = await trackOrder(orderNumber);
    expect(stored).not.toBeNull();
    if (stored === null) return;
    expect(stored.orderNumber).toBe(orderNumber);
    expect(stored.trackingCode).toBe(trackingCode);
    expect(await readMoney(page.getByTestId('order-subtotal'))).toBe(stored.subtotal);
    expect(await readMoney(page.getByTestId('order-shipping'))).toBe(stored.shipping);
    expect(await readMoney(page.getByTestId('order-tax'))).toBe(stored.tax);
    expect(await readMoney(page.getByTestId('order-total'))).toBe(stored.total);

    // El envio viaja como una linea mas del pedido (`WEB-ENVIO`) cuando la ciudad lo cobra.
    expect(stored.items.some((item) => item.sku === 'WEB-ENVIO')).toBe(true);

    // La confirmacion dice donde se consulta el estado despues.
    await expect(page.getByTestId('order-tracking-notice')).toContainText('/seguimiento');

    // El carrito quedo vacio tras confirmar (y el contador del encabezado tambien).
    await expect(page.getByTestId('cart-count')).toHaveText('0');
    await page.goto('/carrito');
    await expect(page.getByRole('heading', { name: 'Tu carrito esta vacio' })).toBeVisible();
  });

  test('dos envios con la misma clave de idempotencia devuelven el mismo pedido', async ({
    page,
  }) => {
    const target = await findShippableProduct(CITY);
    const buyer = defaultBuyer('idempotencia');
    const idempotencyKey = uniqueKey('idem');

    await addToCart(page, target.slug, '1');
    await page.goto('/checkout');
    await fillBuyer(page, buyer);
    await chooseDeliveryAndPayment(page, 'TRANSFER');
    await waitForQuote(page);

    const first = await page.request.post('/api/pedido', {
      data: {
        intent: 'order',
        idempotencyKey,
        cityCode: CITY,
        deliveryType: 'HOME',
        paymentMethod: 'TRANSFER',
        items: [{ itemId: target.itemId, quantity: 1 }],
        customer: {
          email: buyer.email,
          name: buyer.name,
          phone: buyer.phone,
          street: buyer.street,
          district: buyer.district,
        },
      },
    });
    expect(first.status(), await first.text()).toBe(200);
    const firstOrder = (await first.json()) as { order: { orderNumber: string } };

    // El mismo cuerpo otra vez: el pedido no se duplica.
    const second = await page.request.post('/api/pedido', {
      data: {
        intent: 'order',
        idempotencyKey,
        cityCode: CITY,
        deliveryType: 'HOME',
        paymentMethod: 'TRANSFER',
        items: [{ itemId: target.itemId, quantity: 1 }],
        customer: {
          email: buyer.email,
          name: buyer.name,
          phone: buyer.phone,
          street: buyer.street,
          district: buyer.district,
        },
      },
    });
    expect(second.status(), await second.text()).toBe(200);
    const secondOrder = (await second.json()) as { order: { orderNumber: string } };

    expect(secondOrder.order.orderNumber).toBe(firstOrder.order.orderNumber);
  });

  test('un articulo sin existencia en la ciudad de entrega muestra el error del ERP y no crea pedido', async ({
    page,
  }) => {
    // El caso se **descubre cotizando**: un articulo que el canal vende en SCZ y no
    // puede vender en LPZ (sin existencia alli), con el mensaje exacto del ERP.
    const target = await findUnquotableProduct(OTHER_CITY, CITY);
    expect(target.errorMessage).toContain(target.emptyCityName);

    // Se agrega al carrito desde la ciudad con existencia (es lo que puede hacer un
    // comprador real) y **despues** se cambia la ciudad de entrega a LPZ: el checkout
    // es el que debe descubrir que ese articulo no se puede vender alli.
    await addToCart(page, target.slug, '1');
    await page.context().addCookies([
      { name: 'storefront_city', value: OTHER_CITY, domain: '127.0.0.1', path: '/' },
    ]);

    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-city-name')).toContainText(target.emptyCityName);

    await fillBuyer(page, defaultBuyer('sin-existencia'));
    await chooseDeliveryAndPayment(page, 'TRANSFER');

    // El mensaje del ERP se muestra **tal cual** (mismo texto que la cotizacion
    // directa al canal), con el nombre del articulo y la ciudad.
    const error = page.getByTestId('checkout-quote-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(target.errorMessage);
    await expect(error).toContainText(target.name);

    // El boton de confirmar queda deshabilitado: no hay estado ambiguo posible.
    await expect(page.getByTestId('checkout-confirm')).toBeDisabled();

    // Y no se creo ningun pedido: el canal no tiene nada con ese articulo en LPZ.
    await expect(page.getByTestId('checkout-order-error')).toHaveCount(0);

    // Restituye la cookie por defecto para el resto del archivo.
    await page.context().addCookies([
      { name: 'storefront_city', value: CITY, domain: '127.0.0.1', path: '/' },
    ]);
  });
});

test.describe('Seguimiento publico', () => {
  test('/seguimiento encuentra un pedido real y muestra su estado y su desglose', async ({
    page,
  }) => {
    const { order, buyer } = await createRealOrder('seguimiento');

    await page.goto('/seguimiento');
    await expect(page.getByTestId('tracking-empty')).toBeVisible();

    await page.getByTestId('tracking-order-input').fill(order.orderNumber);
    await page.getByTestId('tracking-email-input').fill(buyer.email);
    await page.getByTestId('tracking-submit').click();

    await expect(page.getByTestId('order-summary')).toBeVisible();
    await expect(page.getByTestId('order-number')).toHaveText(order.orderNumber);
    await expect(page.getByTestId('order-tracking-code')).toHaveText(order.trackingCode ?? '—');
    await expect(page.getByTestId('order-status')).toContainText('Pendiente');
    await expect(page.getByTestId('order-payment-status')).toContainText('Pago pendiente');
    await expect(page.getByTestId('order-summary').getByTestId('order-line')).toHaveCount(
      order.items.length,
    );
    expect(await readMoney(page.getByTestId('order-subtotal'))).toBe(order.subtotal);
    expect(await readMoney(page.getByTestId('order-shipping'))).toBe(order.shipping);
    expect(await readMoney(page.getByTestId('order-tax'))).toBe(order.tax);
    expect(await readMoney(page.getByTestId('order-total'))).toBe(order.total);
  });

  test('un numero de pedido inexistente da el estado honesto de no encontrado', async ({
    page,
  }) => {
    const missing = 'PED-999999';

    await page.goto(`/seguimiento?order=${missing}`);
    const notFound = page.getByTestId('tracking-not-found');
    await expect(notFound).toBeVisible();
    await expect(notFound).toContainText(missing);
    await expect(page.getByTestId('order-summary')).toHaveCount(0);

    // La misma consulta por el canal: la tienda no invento el resultado.
    await expect(trackOrder(missing)).resolves.toBeNull();
  });

  test('un pedido real con un correo que no corresponde tampoco se revela', async ({ page }) => {
    const { order, buyer } = await createRealOrder('correo');

    // El canal responde 404 cuando el correo no coincide con el de la compra.
    await expect(trackOrder(order.orderNumber, 'ajeno@example.com')).resolves.toBeNull();

    await page.goto(
      `/seguimiento?order=${encodeURIComponent(order.orderNumber)}&email=ajeno%40example.com`,
    );
    await expect(page.getByTestId('tracking-not-found')).toBeVisible();
    await expect(page.getByTestId('order-summary')).toHaveCount(0);

    // Y con el correo de la compra el mismo pedido aparece.
    await page.goto(
      `/seguimiento?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(
        buyer.email,
      )}`,
    );
    await expect(page.getByTestId('order-number')).toHaveText(order.orderNumber);
  });
});
