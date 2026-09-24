import { expect, test, type Page } from '@playwright/test';

import {
  findDiscountedProduct,
  findOfferProduct,
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

    // El flete se **especifica** en la lista como envio, con el articulo de servicio de la
    // ciudad (T200): es una linea mas del documento del ERP, no un producto del carrito.
    const shippingLine = page.getByTestId('checkout-quote-line-shipping');
    await expect(shippingLine).toHaveCount(1);
    await expect(shippingLine).toContainText('Envio ·');
    await expect(shippingLine).toContainText('Servicio de entrega de la ciudad');
    expect(await readMoney(shippingLine.locator('span').last())).toBe(expected.shipping);

    // El desglose fiscal **completo** (T197): mercancia sin IVA e IVA, con el mismo motor
    // que el documento del ERP, y las cifras suman el total a pagar.
    expect(await readMoney(page.getByTestId('checkout-quote-net-subtotal'))).toBe(
      expected.netSubtotal,
    );
    expect(await readMoney(page.getByTestId('checkout-quote-tax'))).toBe(expected.taxAmount);
    expect(Math.round((expected.netSubtotal + expected.taxAmount) * 100) / 100).toBe(
      expected.total,
    );

    // Y el aviso: el desglose lo calcula el ERP y es el importe que se cobra.
    await expect(page.getByTestId('checkout-tax-notice')).toContainText(
      'lo calcula el ERP',
    );
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

    // El numero sigue la serie del ERP (prefijo + consecutivo), no un id de la tienda. Desde
    // F7 el canal numera **sus** pedidos con la serie `WEB-` (antes usaba la serie por defecto
    // de pedidos de venta), asi que el prefijo es el del canal.
    expect(orderNumber).toMatch(/^[A-Z]{2,6}-\d+$/);
    expect(orderNumber.startsWith('WEB-')).toBe(true);
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
    // La confirmacion publica el desglose del **documento del ERP** (T197): la mercancia
    // sin impuestos y el impuesto ya no salen en cero, y las dos cifras suman el total.
    expect(await readMoney(page.getByTestId('order-net-subtotal'))).toBe(stored.netSubtotal);
    expect(stored.tax).toBeGreaterThan(0);
    expect(Math.round((stored.netSubtotal + stored.tax) * 100) / 100).toBe(stored.total);

    // F7: la modalidad por defecto es «pagar al recibir», asi que el canal **no** emite ningun
    // documento fiscal al confirmar (la factura nace de la entrega).
    expect(stored.webInvoicingMode).toBe('PAY_ON_DELIVERY');
    expect(stored.reserveInvoiceCode).toBeNull();

    // El envio viaja como una linea mas del pedido (`WEB-ENVIO`) cuando la ciudad lo cobra…
    expect(stored.items.some((item) => item.sku === 'WEB-ENVIO')).toBe(true);
    // …y la confirmacion la **especifica como envio** (T200): el canal publica con que
    // articulo de servicio se cobro, y esa linea no se pinta como si fuera un producto.
    expect(stored.shippingItemId).not.toBeNull();
    const shippingLine = page.getByTestId('order-line-shipping');
    await expect(shippingLine).toHaveCount(1);
    await expect(shippingLine).toContainText('Envio ·');
    await expect(shippingLine).toHaveAttribute('data-sku', 'WEB-ENVIO');

    // La confirmacion dice donde se consulta el estado despues.
    await expect(page.getByTestId('order-tracking-notice')).toContainText('/seguimiento');

    // El carrito quedo vacio tras confirmar (y el contador del encabezado tambien).
    await expect(page.getByTestId('cart-count')).toHaveText('0');
    await page.goto('/carrito');
    await expect(page.getByRole('heading', { name: 'Tu carrito esta vacio' })).toBeVisible();
  });

  /**
   * F7: la **modalidad de facturacion la elige el comprador** y decide la cadena del pedido.
   * Con «pagar ahora» el canal emite la **factura de reserva** al confirmar —es el documento
   * contra el que el ERP registra el cobro— y la confirmacion publica su numero.
   */
  test('el comprador elige «pagar ahora» y el canal emite su factura de reserva', async ({
    page,
  }) => {
    const target = await findShippableProduct(CITY);
    const buyer = defaultBuyer('pagarnacion');

    await addToCart(page, target.slug, '1');
    await page.goto('/checkout');
    await fillBuyer(page, buyer);
    // Paso 2, a mano: el campo de la modalidad vive aqui y el helper ya avanzaria al resumen.
    await page.getByTestId('checkout-delivery-home').check();
    await page.getByTestId('checkout-payment-transfer').check();
    // El defecto de la tienda es «pagar al recibir»: aqui el comprador elige lo contrario.
    await expect(page.getByTestId('checkout-invoicing-pay_on_delivery')).toBeChecked();
    await page.getByTestId('checkout-invoicing-pay_now').check();
    await page.getByTestId('checkout-next-2').click();
    await expect(page.getByTestId('checkout-step-3')).toHaveAttribute('data-state', 'current');
    await waitForQuote(page);

    await page.getByTestId('checkout-confirm').click();
    await expect(page.getByTestId('order-number')).toBeVisible();
    const orderNumber = (await page.getByTestId('order-number').innerText()).trim();

    const stored = await trackOrder(orderNumber);
    expect(stored).not.toBeNull();
    if (stored === null) return;
    expect(stored.webInvoicingMode).toBe('PAY_NOW');
    // La reserva existe **de verdad** en el ERP y el comprador ve su numero.
    expect(stored.reserveInvoiceCode).not.toBeNull();
    await expect(page.getByTestId('order-invoicing-mode')).toContainText('Pagar ahora');
    await expect(page.getByTestId('order-invoicing-mode')).toContainText(
      stored.reserveInvoiceCode ?? '',
    );
  });

  test('la oferta de catalogo del ERP se muestra como oferta y el descuento de la empresa aparte', async ({
    page,
  }) => {
    // Las dos capas del precio (T197): la **oferta de catalogo** del ERP (`Item.salePrice`
    // vigente) y el **descuento de la empresa** se publican por separado, y el desglose
    // muestra la mercancia sin IVA y el IVA del mismo motor que el documento. Antes el
    // checkout mostraba un subtotal ya con la oferta y el descuento encima, sin impuestos:
    // el comprador no podia explicarse de donde salia cada cifra.
    const target = await findOfferProduct(CITY);
    const buyer = defaultBuyer('oferta');

    await addToCart(page, target.slug, '1');
    await page.goto('/checkout');
    await fillBuyer(page, buyer);
    await chooseDeliveryAndPayment(page, 'TRANSFER');
    await waitForQuote(page);

    const line = page.getByTestId('checkout-quote-line').first();
    await expect(line.getByTestId('checkout-quote-line-offer')).toContainText(
      `Oferta de catalogo ${target.offerPct}%`,
    );
    expect(await readMoney(page.getByTestId('checkout-quote-list-subtotal'))).toBe(
      target.listPrice,
    );
    expect(await readMoney(page.getByTestId('checkout-quote-offer-discount'))).toBe(
      target.offerDiscount,
    );
    // El desglose **explica** cada capa con su tasa: la de la oferta la publica el ERP y es
    // el % efectivo sobre el precio de lista (no un % reconstruido por la tienda).
    await expect(page.getByTestId('checkout-quote-offer-rate')).toHaveText(
      `${String(target.offerPct).replace('.', ',')}%`,
    );
    expect(await readMoney(page.getByTestId('checkout-quote-subtotal'))).toBe(target.price);
    expect(await readMoney(page.getByTestId('checkout-quote-net-subtotal'))).toBe(
      target.netSubtotal,
    );
    expect(await readMoney(page.getByTestId('checkout-quote-tax'))).toBe(target.taxAmount);
    expect(await readMoney(page.getByTestId('checkout-quote-total'))).toBe(target.quoteTotal);
    // El desglose **suma**: lista − oferta = subtotal, y neto + IVA (más envío) = total.
    expect(Math.round((target.listPrice - target.offerDiscount) * 100) / 100).toBe(target.price);
    expect(
      Math.round((target.netSubtotal + target.taxAmount) * 100) / 100,
    ).toBe(target.quoteTotal);
  });

  test('el descuento de la empresa que cotiza el ERP se ve en el checkout y se cobra igual', async ({
    page,
  }) => {
    // El descuento automatico es configuracion del ERP (grupo de articulos, acuerdo del
    // tercero): se descubre cotizando de verdad. Antes del arreglo la tienda cotizaba el
    // precio de lista y el ERP cobraba el descontado (el comprador veia un importe y
    // pagaba otro, y el desglose publicaba un impuesto negativo).
    const target = await findDiscountedProduct(CITY);
    const buyer = defaultBuyer('descuento');

    await addToCart(page, target.slug, '1');
    await page.goto('/checkout');
    await fillBuyer(page, buyer);
    await chooseDeliveryAndPayment(page, 'TRANSFER');
    await waitForQuote(page);

    // La pantalla publica el descuento del ERP, linea a linea y en el total.
    const line = page.getByTestId('checkout-quote-line').first();
    await expect(line.getByTestId('checkout-quote-line-discount')).toContainText(
      `Descuento de la empresa ${target.discountPct}%`,
    );
    expect(await readMoney(page.getByTestId('checkout-quote-subtotal'))).toBe(target.price);
    expect(await readMoney(page.getByTestId('checkout-quote-discount'))).toBe(target.discount);
    // …y con la tasa efectiva que el ERP publica junto a la etiqueta (T200).
    await expect(page.getByTestId('checkout-quote-discount-rate')).toHaveText(
      `${String(target.discountPct).replace('.', ',')}%`,
    );
    expect(await readMoney(page.getByTestId('checkout-quote-total'))).toBe(target.quoteTotal);

    await page.getByTestId('checkout-confirm').click();
    await expect(page.getByTestId('order-number')).toBeVisible();
    const orderNumber = (await page.getByTestId('order-number').innerText()).trim();

    // Y el pedido real cobra esa misma mercancia descontada.
    const stored = await trackOrder(orderNumber);
    expect(stored).not.toBeNull();
    if (stored === null) return;
    const goods = stored.items.find((item) => item.itemId === target.itemId);
    expect(goods).toMatchObject({
      price: target.price,
      discount: target.discount,
      lineTotal: target.lineTotal,
    });
    expect(stored.subtotal).toBe(target.lineTotal);
    // El desglose del documento **suma** (neto + impuesto = total) y el impuesto **nunca**
    // sale negativo (era el sintoma medido del defecto del ERP re-preciando el pedido).
    expect(stored.tax).toBeGreaterThanOrEqual(0);
    expect(Math.round((stored.netSubtotal + stored.tax) * 100) / 100).toBe(
      Math.round(stored.total * 100) / 100,
    );
    // Lo cotizado es lo que el ERP cobra: el total de la cotizacion es el del documento.
    expect(Math.round(stored.total * 100) / 100).toBe(
      Math.round(target.quoteTotal * 100) / 100,
    );
    // La confirmacion muestra los mismos numeros que el canal.
    expect(await readMoney(page.getByTestId('order-subtotal'))).toBe(stored.subtotal);
    expect(await readMoney(page.getByTestId('order-tax'))).toBe(stored.tax);
    expect(await readMoney(page.getByTestId('order-net-subtotal'))).toBe(stored.netSubtotal);
    expect(await readMoney(page.getByTestId('order-total'))).toBe(stored.total);
    // La tasa efectiva viaja con el pedido y la confirmacion la pinta igual (T200).
    expect(stored.companyDiscountPct).toBe(target.discountPct);
    await expect(page.getByTestId('order-discount-rate')).toHaveText(
      `${String(target.discountPct).replace('.', ',')}%`,
    );
  });

  test('el comprador anota la referencia de su pago offline y queda guardada en el pedido', async ({
    page,
  }) => {
    // El pago offline ocurre **despues** de confirmar (D15): el pedido existe y la
    // referencia se anota aparte, sin que eso marque el pedido como pagado.
    const { order, buyer } = await createRealOrder('referencia');

    await page.goto(`/pedido/${order.orderNumber}`);
    await expect(page.getByTestId('order-number')).toHaveText(order.orderNumber);
    await expect(page.getByTestId('order-payment-reference')).toHaveCount(0);
    await expect(page.getByTestId('payment-reference-form')).toBeVisible();

    // Con un correo que no es el del pedido, el canal corta con 404 (no se confirma si el
    // numero existe) y la tienda muestra ese mensaje tal cual.
    await page.getByTestId('payment-reference-email').fill('ajeno@example.com');
    await page.getByTestId('payment-reference-input').fill('TRANSF-000001');
    await page.getByTestId('payment-reference-submit').click();
    await expect(page.getByTestId('payment-reference-error')).toContainText(order.orderNumber);

    // Con el correo del pedido, la referencia se guarda.
    await page.getByTestId('payment-reference-email').fill(buyer.email);
    await page.getByTestId('payment-reference-input').fill('TRANSF-884422');
    await page.getByTestId('payment-reference-submit').click();
    await expect(page.getByTestId('payment-reference-saved')).toBeVisible();
    await expect(page.getByTestId('payment-reference-value')).toHaveText('TRANSF-884422');

    // El pedido del canal la publica (no es solo pantalla) y sigue **sin pagar**: la
    // conciliacion es del ERP y el estado del pago se deriva de su factura.
    const stored = await trackOrder(order.orderNumber);
    expect(stored?.paymentReference).toBe('TRANSF-884422');
    expect(stored?.paymentReferenceAt).not.toBeNull();
    expect(stored?.paymentStatus).toBe('pending');

    // Al volver a la confirmacion, la referencia aparece en el desglose y el formulario
    // ya no se ofrece (no hay nada que anotar dos veces).
    await page.goto(`/pedido/${order.orderNumber}`);
    await expect(page.getByTestId('order-payment-reference')).toHaveText('TRANSF-884422');
    await expect(page.getByTestId('payment-reference-form')).toHaveCount(0);
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
    // El estado del documento del ERP viaja con el pedido: la tienda no lo inventa.
    await expect(page.getByTestId('order-erp-state')).toContainText('sin entregar');
    // La mercancia se lista como producto y el flete como **envio** (T200), asi que las
    // lineas de producto son las del pedido **menos** el articulo de servicio del envio.
    const shippingLines = order.items.filter(
      (item) => item.itemId === order.shippingItemId,
    ).length;
    await expect(page.getByTestId('order-summary').getByTestId('order-line')).toHaveCount(
      order.items.length - shippingLines,
    );
    await expect(
      page.getByTestId('order-summary').getByTestId('order-line-shipping'),
    ).toHaveCount(shippingLines);
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
