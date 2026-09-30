import { expect, test, type Page } from '@playwright/test';

import { buildMapLink } from '../src/lib/map-link';
import { getCities, findShippableProduct, quote, type ApiCityStore } from './helpers/erp-api';

/**
 * T236-bis — **el comprador puede ir al mapa de la tienda de retiro**.
 *
 * Tres casos, todos contra el canal real (nunca contra un mock):
 *
 *  1. la **regla** del enlace (`buildMapLink`), que es pura y vive en un solo sitio;
 *  2. la pagina publica `/sucursales`, tienda por tienda, incluida la que **no** publica mapa
 *     (el enlace no puede pintarse vacio);
 *  3. el **checkout con retiro**, en el paso 2 y en el resumen del paso 3, con el `href` de
 *     **esa** tienda.
 *
 * El `href` esperado **no** se pregunta al helper de la app: el caso lo calcula por su cuenta
 * (`expectedMapHref`, el oraculo) a partir de lo que publica el canal. Si se comparara el `href`
 * contra `buildMapLink`, la prueba solo mediria el cableado y no la regla.
 */

const CITY = 'SCZ';

/** Lo que el canal publica de un punto (sucursal o tienda), con sus campos opcionales. */
interface MapPointLike {
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Oracolo del caso: la misma regla, escrita **independientemente** del helper de la app.
 *
 * `mapUrl` del maestro si viene; si no, coordenadas; si no hay ninguno, `null` = sin enlace.
 * (No se valida el rango geografico: en el seed todas las coordenadas que llegan son validas y el
 * caso mide el dato publicado, no la robustez del helper — eso lo pincha el caso 1.)
 */
function expectedMapHref(point: MapPointLike): string | null {
  const mapUrl = (point.mapUrl ?? '').trim();
  if (mapUrl !== '') return mapUrl;
  if (point.latitude === null || point.latitude === undefined) return null;
  if (point.longitude === null || point.longitude === undefined) return null;
  return `https://www.google.com/maps?q=${point.latitude},${point.longitude}`;
}

/** La URL que se armaria **solo** con las coordenadas (para medir la precedencia del `mapUrl`). */
function coordsHref(point: MapPointLike): string | null {
  if (point.latitude === null || point.latitude === undefined) return null;
  if (point.longitude === null || point.longitude === undefined) return null;
  return `https://www.google.com/maps?q=${point.latitude},${point.longitude}`;
}

/**
 * Una tienda de retiro de la ciudad que publica **`mapUrl`** y que ademas puede cotizar el
 * carrito (el pedido sale del almacen de esa tienda: el canal rechaza una tienda sin existencia).
 * Se exige `mapUrl` a proposito, para que el caso discrimine su **precedencia** sobre las
 * coordenadas (medido: en el seed las tiendas con coordenadas tambien traen `mapUrl`).
 */
async function findPickupStoreWithMap(
  cityCode: string,
  items: Array<{ itemId: number; quantity: number }>,
): Promise<{ store: ApiCityStore; cityName: string }> {
  const cities = await getCities();
  const city = cities.find((candidate) => candidate.code === cityCode);
  if (city === undefined) {
    throw new Error(`El canal no publica la ciudad ${cityCode}.`);
  }
  const candidates = (city.stores ?? []).filter(
    (store) => store.pickupEnabled && (store.mapUrl ?? '').trim() !== '',
  );
  if (candidates.length === 0) {
    throw new Error(
      `La ciudad ${cityCode} no publica ninguna tienda con retiro y mapUrl: el caso necesita una para medir.`,
    );
  }

  const rejected: string[] = [];
  for (const store of candidates) {
    try {
      await quote(cityCode, items, { deliveryType: 'STORE', pickupStoreCode: store.code });
      return { store, cityName: city.name };
    } catch (error) {
      rejected.push(`${store.code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(
    `Ninguna tienda con retiro y mapa de ${cityCode} puede cotizar el carrito del caso:\n${rejected.join('\n')}`,
  );
}

/** Agrega un articulo al carrito desde su ficha y espera a que el contador sume. */
async function addToCart(page: Page, slug: string, expectedCount: string): Promise<void> {
  await page.goto(`/productos/${slug}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-count')).toHaveText(expectedCount);
}

/** Rellena el paso 1 del checkout y avanza al paso 2 (mismo camino que un comprador real). */
async function fillBuyerAndGoToStep2(page: Page, email: string): Promise<void> {
  await page.getByTestId('checkout-email').fill(email);
  await page.getByTestId('checkout-name').fill('Comprador E2E Mapa');
  await page.getByTestId('checkout-phone').fill('70012345');
  await page.getByTestId('checkout-street').fill('Av. Los Sauces #120');
  await page.getByTestId('checkout-district').fill('Equipetrol');
  await page.getByTestId('checkout-next-1').click();
  await expect(page.getByTestId('checkout-step-2')).toHaveAttribute('data-state', 'current');
}

test.describe('Mapa de las tiendas de retiro', () => {
  test('la regla del enlace es unica y pura: mapUrl, coordenadas o nada', () => {
    // 1) El enlace del maestro manda (y se respeta tal cual, sin rearmarlo).
    const fromMaster = 'https://maps.google.com/?q=-17.783327,-63.18214';
    expect(buildMapLink({ mapUrl: fromMaster, latitude: -17.783327, longitude: -63.18214 })).toBe(
      fromMaster,
    );
    // Un `mapUrl` con espacios alrededor es el mismo enlace, no otro.
    expect(buildMapLink({ mapUrl: `  ${fromMaster}  ` })).toBe(fromMaster);

    // 2) Sin enlace del maestro, se arma con las **dos** coordenadas.
    expect(buildMapLink({ mapUrl: null, latitude: -17.783327, longitude: -63.18214 })).toBe(
      'https://www.google.com/maps?q=-17.783327,-63.18214',
    );
    // Un `mapUrl` en blanco no es un enlace: se cae a las coordenadas.
    expect(buildMapLink({ mapUrl: '   ', latitude: 1, longitude: 2 })).toBe(
      'https://www.google.com/maps?q=1,2',
    );
    // `0,0` es una coordenada de verdad (no un valor «vacio» al que saltarse la regla).
    expect(buildMapLink({ mapUrl: null, latitude: 0, longitude: 0 })).toBe(
      'https://www.google.com/maps?q=0,0',
    );

    // 3) Sin enlace y sin coordenadas **no hay enlace** (esto es lo que evita el `href="#"`).
    expect(buildMapLink({ mapUrl: null, latitude: null, longitude: null })).toBeNull();
    expect(buildMapLink({})).toBeNull();
    expect(buildMapLink({ mapUrl: '  ', latitude: null, longitude: null })).toBeNull();
    // Media coordenada no es una ubicacion.
    expect(buildMapLink({ latitude: -17.783327 })).toBeNull();
    expect(buildMapLink({ longitude: -63.18214 })).toBeNull();

    // 4) Y una coordenada imposible (basura del maestro) tampoco inventa un mapa.
    expect(buildMapLink({ latitude: Number.NaN, longitude: -63.18214 })).toBeNull();
    expect(buildMapLink({ latitude: 91, longitude: -63.18214 })).toBeNull();
    expect(buildMapLink({ latitude: -17.783327, longitude: 181 })).toBeNull();
  });

  test('la pagina de sucursales enlaza al mapa de cada tienda y no pinta el enlace si no hay mapa', async ({
    page,
  }) => {
    // El dato se descubre con el canal: ni los codigos ni los enlaces se codifican a mano.
    const cities = await getCities();
    const stores = cities.flatMap((city) => city.stores ?? []);
    expect(stores.length, 'El canal no publica ninguna tienda: el caso no mediria nada').toBeGreaterThan(
      0,
    );

    await page.goto('/sucursales');
    await expect(page.getByTestId('city-card').first()).toBeVisible();

    let withMap = 0;
    let withoutMap = 0;
    for (const store of stores) {
      // La tarjeta se localiza por el `data-code` que publica el canal (no por su texto).
      const card = page.locator(`[data-testid="city-store"][data-code="${store.code}"]`);
      await expect(card, `La pagina no pinta la tienda ${store.code}`).toHaveCount(1);
      const link = card.getByTestId('store-map');
      const expected = expectedMapHref(store);

      if (expected === null) {
        withoutMap += 1;
        // Sin `mapUrl` ni coordenadas no hay enlace: ni vacio ni a `#`.
        await expect(link, `${store.code} no publica mapa y no puede ofrecer un enlace`).toHaveCount(
          0,
        );
        continue;
      }

      withMap += 1;
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', expected);
      // Enlace accesible y que no se lleva la pestana de la tienda por delante.
      await expect(link).toHaveText('Ver en el mapa');
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('rel', /noreferrer/);
    }

    // Las dos caras medidas en el seed: hay tiendas con mapa y una sin ninguno.
    expect(withMap, 'Ninguna tienda publica mapa: el caso pasaria sin medir el enlace').toBeGreaterThan(
      0,
    );
    expect(
      withoutMap,
      'Ninguna tienda del seed carece de mapa: el caso no mediria que NO se pinte el enlace',
    ).toBeGreaterThan(0);

    // La sucursal de despacho usa **el mismo** enlace (mismo helper, misma regla).
    for (const city of cities) {
      if (city.branch === null) continue;
      const card = page.locator(`[data-testid="city-card"][data-city="${city.code}"]`);
      const link = card.getByTestId('branch-map');
      const expected = expectedMapHref(city.branch);
      if (expected === null) {
        await expect(link).toHaveCount(0);
        continue;
      }
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', expected);
    }
  });

  test('con retiro elegido, el checkout ofrece «Como llegar» a la tienda seleccionada', async ({
    page,
  }) => {
    const product = await findShippableProduct(CITY);
    const items = [{ itemId: product.itemId, quantity: 1 }];
    const { store, cityName } = await findPickupStoreWithMap(CITY, items);
    const expectedHref = expectedMapHref(store);
    if (expectedHref === null) {
      throw new Error(`La tienda ${store.code} deberia publicar mapUrl: el caso no mediria el enlace.`);
    }

    // El caso **discrimina** la precedencia: el enlace del maestro no es el que se armaria con
    // las coordenadas (distinto host), asi que si la tienda ignorara `mapUrl` el `href` fallaria.
    const fromCoords = coordsHref(store);
    if (fromCoords === null) {
      throw new Error(
        `La tienda ${store.code} no publica coordenadas: el caso no mediria la precedencia.`,
      );
    }
    expect(fromCoords).not.toBe(expectedHref);

    // Tiendas de la misma ciudad que **no** publican mapa: su opcion no puede traer enlace.
    const cities = await getCities();
    const city = cities.find((candidate) => candidate.code === CITY);
    const withoutMap = (city?.stores ?? []).filter(
      (candidate) => candidate.pickupEnabled && expectedMapHref(candidate) === null,
    );
    expect(
      withoutMap.length,
      `Ninguna tienda de ${CITY} carece de mapa: el caso no mediria que el enlace no se inventa`,
    ).toBeGreaterThan(0);

    await addToCart(page, product.slug, '1');
    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-city-name')).toContainText(cityName);
    await fillBuyerAndGoToStep2(page, `e2e-mapa-${Date.now().toString(36)}@example.com`);

    // Paso 2 — retiro en tienda: cada tienda con mapa ofrece su «Como llegar»...
    await page.getByTestId('checkout-delivery-store').check();
    await expect(page.getByTestId('checkout-pickup-stores')).toBeVisible();
    const stepTwoLink = page.getByTestId(`checkout-pickup-map-${store.code}`);
    await expect(stepTwoLink).toHaveCount(1);
    await expect(stepTwoLink).toHaveAttribute('href', expectedHref);
    await expect(stepTwoLink).toHaveText('Como llegar');
    await expect(stepTwoLink).toHaveAccessibleName(`Como llegar a ${store.name}`);
    await expect(stepTwoLink).toHaveAttribute('target', '_blank');
    await expect(stepTwoLink).toHaveAttribute('rel', /noopener/);
    await expect(stepTwoLink).toHaveAttribute('rel', /noreferrer/);

    // ...y la que no publica mapa **no** ofrece ninguno (nada de enlaces vacios).
    for (const candidate of withoutMap) {
      await expect(
        page.getByTestId(`checkout-pickup-map-${candidate.code}`),
        `${candidate.code} no publica mapa y no puede ofrecer un enlace en el paso 2`,
      ).toHaveCount(0);
    }

    // Paso 3 — elegida ESA tienda, el resumen lleva a su mapa (no al de otra).
    await page.getByTestId(`checkout-pickup-${store.code}`).check();
    await page.getByTestId('checkout-next-2').click();
    await expect(page.getByTestId('checkout-step-3')).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('checkout-quote-subtotal')).toBeVisible();
    await expect(page.getByTestId('checkout-summary-delivery')).toContainText(store.name);

    const summaryLink = page.getByTestId('checkout-summary-map');
    await expect(summaryLink).toHaveCount(1);
    await expect(summaryLink).toHaveAttribute('href', expectedHref);
    await expect(summaryLink).toHaveText('Como llegar');
    await expect(summaryLink).toHaveAccessibleName(`Como llegar a ${store.name}`);
    // La direccion que se confirma sigue siendo la de la tienda (y ahora con su mapa al lado).
    await expect(page.getByTestId('checkout-summary-address')).toContainText(store.address ?? '');
  });
});
