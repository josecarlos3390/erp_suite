import { expect, test } from '@playwright/test';

import {
  erpAdminLogin,
  getCatalog,
  getProduct,
  quote,
  setChannelPromotion,
} from './helpers/erp-api';

/**
 * Gate E2E de **F8.2 / D21: la promo del canal**.
 *
 * El descuento vive en la **publicacion web** (`ItemWeb.channelDiscountPct`) y solo lo cobra
 * la tienda: se configura por el **API real del back office** (login de admin + `PATCH
 * /web-promotions/:itemId`, que es la pantalla de F8.3) y se mide el efecto en la tienda.
 *
 * La prueba es un **A/B sobre el mismo articulo**: primero se lee el precio sin promo, se
 * configura, y se exige que el precio publicado caiga **exactamente** el `%` de la promo
 * mientras el precio del ERP (`priceBeforeChannel`) **no se mueve** —esa es la prueba de que
 * la capa es solo del canal—, y que el desglose del checkout la explique con su importe. Al
 * terminar **quita la promo** para no dejar el dato sucio (el seed no trae promos).
 */

const CITY = 'SCZ';
const PROMO_PCT = 10;

test.describe('promo del canal', () => {
  test('la tienda cobra la promo como capa propia y el desglose la explica', async ({
    page,
  }) => {
    // El caso **mide** la ventana de la cache del canal (60 s): su tope tiene que ser mayor
    // que esa ventana, o el gate falla por el reloj de la prueba y no por el dato.
    test.setTimeout(180_000);
    const token = await erpAdminLogin();

    // Un articulo publicado **con existencia** en la ciudad: sin stock no se puede cotizar.
    const catalog = await getCatalog({ city: CITY, limit: 48 });
    const candidate = catalog.data.find(
      (product) => product.availability.inStock && product.price > 0,
    );
    expect(
      candidate,
      'el catalogo del seed debe tener algun articulo con existencia',
    ).toBeTruthy();

    // La prueba es **idempotente**: si el seed (o una corrida anterior que fallo) dejo una
    // promo puesta, se quita **antes** de medir para que la linea base sea el precio del ERP.
    await setChannelPromotion(token, candidate!.itemId, 0);
    const before = await getProduct(candidate!.slug, CITY);
    expect(
      before.channelDiscountPct,
      'la linea base de la medicion tiene que ser sin promo',
    ).toBeNull();

    try {
      const configured = await setChannelPromotion(
        token,
        before.itemId,
        PROMO_PCT,
      );
      expect(configured.channelDiscountActive).toBe(true);
      expect(configured.channelDiscountPct).toBe(PROMO_PCT);

      // ── El canal publica el precio CON promo y la capa por separado ──
      const after = await getProduct(before.slug, CITY);
      expect(after.channelDiscountPct).toBe(PROMO_PCT);
      // El precio del ERP no se movio: la capa es de la tienda.
      expect(after.priceBeforeChannel).toBe(before.price);
      expect(after.price).toBeCloseTo(before.price * (1 - PROMO_PCT / 100), 2);

      // ── La ficha lo rotula ──
      //
      // **La tienda cachea el canal 60 s** (`src/lib/erp.ts`: `catalog: 60`, `product: 60`),
      // asi que un cambio del back office puede tardar esa ventana en verse. En vez de
      // esconderlo con un `sleep`, se **mide**: se recarga la ficha hasta que aparece y el
      // spec imprime cuanto tardo; el tope es la ventana declarada mas margen. (En una
      // corrida aislada la ficha no estaba en cache y aparece en el primer render; dentro
      // de la suite completa, otro spec ya la habia calentado.)
      const startedAt = Date.now();
      let badgeVisible = false;
      while (!badgeVisible && Date.now() - startedAt < 75_000) {
        await page.goto(`/productos/${before.slug}`);
        badgeVisible = await page
          .getByTestId('detail-channel-promo-badge')
          .isVisible()
          .catch(() => false);
        if (!badgeVisible) await page.waitForTimeout(2_000);
      }
      expect(
        badgeVisible,
        'la ficha debe rotular la promo dentro de la ventana de cache de 60 s',
      ).toBe(true);
      console.log(
        `[promo] la ficha mostro la promo tras ${((Date.now() - startedAt) / 1000).toFixed(1)} s`,
      );
      await expect(page.getByTestId('detail-channel-promo-badge')).toContainText(
        `Promo online −${PROMO_PCT}%`,
      );
      await expect(page.getByTestId('price-kind')).toContainText('Promo online');

      // ── La cotizacion publica la capa con su importe y su tasa ──
      // La cotizacion NO se cachea (`cache: 'no-store'`), asi que aqui no hay ventana.
      const priced = await quote(CITY, [{ itemId: before.itemId, quantity: 1 }]);
      const pricedLine = priced.items[0];
      expect(pricedLine, 'la cotizacion debe devolver la linea').toBeTruthy();
      expect(priced.channelDiscountPct).toBe(PROMO_PCT);
      expect(priced.channelDiscount).toBeGreaterThan(0);
      expect(pricedLine!.priceBeforeChannel).toBe(before.price);
      expect(pricedLine!.channelDiscount).toBeGreaterThan(0);

      // ── El checkout la explica en el desglose (misma capa, mismo importe) ──
      await page.getByTestId('add-to-cart').click();
      await expect(page.getByTestId('cart-count')).toHaveText('1');
      await page.goto('/checkout');
      await page.getByTestId('checkout-email').fill('promo-e2e@example.com');
      await page.getByTestId('checkout-name').fill('Comprador Promo');
      await page.getByTestId('checkout-phone').fill('70012345');
      await page.getByTestId('checkout-street').fill('Av. Los Sauces #120');
      await page.getByTestId('checkout-district').fill('Equipetrol');
      await page.getByTestId('checkout-next-1').click();
      await page.getByTestId('checkout-delivery-home').check();
      await page.getByTestId('checkout-next-2').click();
      await expect(page.getByTestId('checkout-step-3')).toHaveAttribute(
        'data-state',
        'current',
      );
      await expect(page.getByTestId('checkout-quote-channel-discount')).toBeVisible();
      await expect(page.getByTestId('checkout-quote-channel-rate')).toHaveText(
        `${PROMO_PCT}%`,
      );
    } finally {
      // La promo se quita **siempre**: el seed no la trae y la proxima corrida mide lo mismo.
      await setChannelPromotion(token, before.itemId, 0);
    }

    // Con la promo quitada, el canal vuelve a publicar el precio del ERP.
    const cleaned = await getProduct(before.slug, CITY);
    expect(cleaned.channelDiscountPct).toBeNull();
    expect(cleaned.price).toBe(before.price);
  });
});
