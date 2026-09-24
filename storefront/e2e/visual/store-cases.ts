import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Casos compartidos por el **gate visual**, la **auditoria de accesibilidad** y el
 * **presupuesto de rendimiento** de la tienda (F9.6): las mismas pantallas, el
 * mismo carrito fijo y el mismo comprador, para que las tres baterias midan lo
 * mismo y contra el mismo fixture del canal
 * (`e2e/visual/channel-fixture.mjs`).
 */

/** Carrito fijo (los `itemId` son los del catalogo grabado en el fixture). */
export const FIXED_CART = {
  state: {
    lines: [
      {
        itemId: 36,
        slug: 'iphone-15-128gb',
        name: 'iPhone 15 128GB',
        sku: 'WEB-0005',
        price: 7499,
        currency: 'BOB',
        image: null,
        quantity: 1,
        cityCode: 'SCZ',
      },
      {
        itemId: 35,
        slug: 'smartphone-poco-x6-pro-512gb',
        name: 'Smartphone Poco X6 Pro 512GB',
        sku: 'WEB-0004',
        price: 2699,
        currency: 'BOB',
        image: null,
        quantity: 1,
        cityCode: 'SCZ',
      },
    ],
  },
  version: 1,
};

/** Comprador fijo: la cotizacion de la pantalla 3 depende de estos datos. */
export const BUYER = {
  email: 'visual@example.com',
  name: 'Comprador Visual',
  phone: '70012345',
  street: 'Av. Los Sauces #120',
  district: 'Equipetrol',
};

/**
 * Comparador fijo (F6): la lista que el comprador guarda en **este dispositivo**. Los dos
 * articulos son los del catalogo grabado, asi que la tabla del comparador se pinta con las
 * fichas que el fixture ya tiene (si pidiera otras, el proxy respondería **599** y la captura
 * seria una pantalla de error).
 */
export const FIXED_COMPARE = {
  state: {
    entries: [
      { itemId: 36, slug: 'iphone-15-128gb', name: 'iPhone 15 128GB', image: null },
      {
        itemId: 35,
        slug: 'smartphone-poco-x6-pro-512gb',
        name: 'Smartphone Poco X6 Pro 512GB',
        image: null,
      },
    ],
  },
  version: 1,
};

export interface StorePageCase {
  name: string;
  route: string;
  theme: 'light' | 'dark';
  /** `true` inyecta el carrito fijo antes de cargar la pagina. */
  cart?: boolean;
  /** `true` inyecta la lista del comparador antes de cargar la pagina (F6). */
  compare?: boolean;
  /** Selector (testid) que confirma que la pantalla termino de pintarse. */
  waitForTestId?: string;
  /** Texto del `h1` que confirma la pantalla (la 404 no tiene testid). */
  waitForText?: string;
  /** Pasos previos a la captura (rellenar el checkout, cotizar). */
  prepare?: (page: Page) => Promise<void>;
}

export async function fillBuyer(page: Page): Promise<void> {
  await page.getByTestId('checkout-email').fill(BUYER.email);
  await page.getByTestId('checkout-name').fill(BUYER.name);
  await page.getByTestId('checkout-phone').fill(BUYER.phone);
  await page.getByTestId('checkout-street').fill(BUYER.street);
  await page.getByTestId('checkout-district').fill(BUYER.district);
  await page.getByTestId('checkout-next-1').click();
}

export async function chooseDeliveryAndPayment(page: Page): Promise<void> {
  await page.getByTestId('checkout-delivery-home').check();
  await page.getByTestId('checkout-payment-qr').check();
  await page.getByTestId('checkout-next-2').click();
  // La cotizacion de la pantalla 3 la responde el fixture: si falta, el spec falla
  // aqui (y no da por buena una pantalla de error).
  await expect(page.getByTestId('checkout-quote-total')).toBeVisible();
}

async function prepareCheckoutSummary(page: Page): Promise<void> {
  await fillBuyer(page);
  await chooseDeliveryAndPayment(page);
}

/** Pantallas del gate visual: la captura de referencia de cada una. */
export const VISUAL_CASES: readonly StorePageCase[] = [
  { name: 'inicio-claro', route: '/', theme: 'light', waitForTestId: 'home-hero' },
  { name: 'inicio-oscuro', route: '/', theme: 'dark', waitForTestId: 'home-hero' },
  { name: 'categoria-claro', route: '/categorias/celulares', theme: 'light', waitForTestId: 'product-grid' },
  { name: 'busqueda-claro', route: '/buscar?q=iphone', theme: 'light', waitForTestId: 'search-summary' },
  {
    name: 'busqueda-sin-resultados-claro',
    route: '/buscar?q=zzzsinresultados',
    theme: 'light',
    waitForTestId: 'search-empty-state',
  },
  { name: 'producto-claro', route: '/productos/iphone-15-128gb', theme: 'light', waitForTestId: 'detail-price' },
  { name: 'producto-oscuro', route: '/productos/iphone-15-128gb', theme: 'dark', waitForTestId: 'detail-price' },
  { name: 'carrito-lleno-claro', route: '/carrito', theme: 'light', cart: true, waitForTestId: 'cart-line' },
  { name: 'carrito-lleno-oscuro', route: '/carrito', theme: 'dark', cart: true, waitForTestId: 'cart-line' },
  { name: 'carrito-vacio-claro', route: '/carrito', theme: 'light', waitForTestId: 'cart-empty' },
  {
    name: 'checkout-paso-2-claro',
    route: '/checkout',
    theme: 'light',
    cart: true,
    waitForTestId: 'checkout-form',
    prepare: async (page) => {
      await fillBuyer(page);
      await expect(page.getByTestId('checkout-step-2')).toHaveAttribute('data-state', 'current');
    },
  },
  {
    name: 'checkout-resumen-claro',
    route: '/checkout',
    theme: 'light',
    cart: true,
    waitForTestId: 'checkout-form',
    prepare: prepareCheckoutSummary,
  },
  {
    name: 'checkout-resumen-oscuro',
    route: '/checkout',
    theme: 'dark',
    cart: true,
    waitForTestId: 'checkout-form',
    prepare: prepareCheckoutSummary,
  },
  {
    name: 'pedido-no-encontrado-claro',
    route: '/productos/slug-que-no-existe',
    theme: 'light',
    waitForText: 'No encontramos esta pagina',
  },
  { name: 'seguimiento-vacio-claro', route: '/seguimiento', theme: 'light', waitForTestId: 'tracking-empty' },
  {
    name: 'comparador-claro',
    route: '/comparar',
    theme: 'light',
    compare: true,
    waitForTestId: 'compare-table',
  },
];

/**
 * Pantallas auditadas (accesibilidad y rendimiento): las mismas rutas del gate
 * visual **en los dos temas**, que es donde el contraste cambia.
 */
export const AUDIT_CASES: readonly StorePageCase[] = [
  { name: 'inicio', route: '/', theme: 'light', waitForTestId: 'home-hero' },
  { name: 'inicio', route: '/', theme: 'dark', waitForTestId: 'home-hero' },
  { name: 'categoria', route: '/categorias/celulares', theme: 'light', waitForTestId: 'product-grid' },
  { name: 'categoria', route: '/categorias/celulares', theme: 'dark', waitForTestId: 'product-grid' },
  { name: 'busqueda', route: '/buscar?q=iphone', theme: 'light', waitForTestId: 'search-summary' },
  { name: 'busqueda', route: '/buscar?q=iphone', theme: 'dark', waitForTestId: 'search-summary' },
  { name: 'producto', route: '/productos/iphone-15-128gb', theme: 'light', waitForTestId: 'detail-price' },
  { name: 'producto', route: '/productos/iphone-15-128gb', theme: 'dark', waitForTestId: 'detail-price' },
  { name: 'carrito', route: '/carrito', theme: 'light', cart: true, waitForTestId: 'cart-line' },
  { name: 'carrito', route: '/carrito', theme: 'dark', cart: true, waitForTestId: 'cart-line' },
  {
    name: 'checkout-entrega-y-pago',
    route: '/checkout',
    theme: 'light',
    cart: true,
    waitForTestId: 'checkout-form',
    prepare: async (page) => {
      await fillBuyer(page);
      await expect(page.getByTestId('checkout-step-2')).toHaveAttribute('data-state', 'current');
    },
  },
  {
    name: 'checkout-entrega-y-pago',
    route: '/checkout',
    theme: 'dark',
    cart: true,
    waitForTestId: 'checkout-form',
    prepare: async (page) => {
      await fillBuyer(page);
      await expect(page.getByTestId('checkout-step-2')).toHaveAttribute('data-state', 'current');
    },
  },
  {
    name: 'checkout-resumen',
    route: '/checkout',
    theme: 'light',
    cart: true,
    waitForTestId: 'checkout-form',
    prepare: prepareCheckoutSummary,
  },
  {
    name: 'checkout-resumen',
    route: '/checkout',
    theme: 'dark',
    cart: true,
    waitForTestId: 'checkout-form',
    prepare: prepareCheckoutSummary,
  },
  {
    name: 'pedido-no-encontrado',
    route: '/productos/slug-que-no-existe',
    theme: 'light',
    waitForText: 'No encontramos esta pagina',
  },
  { name: 'seguimiento-vacio', route: '/seguimiento', theme: 'light', waitForTestId: 'tracking-empty' },
  { name: 'carrito-vacio', route: '/carrito', theme: 'light', waitForTestId: 'cart-empty' },
  {
    name: 'comparador',
    route: '/comparar',
    theme: 'light',
    compare: true,
    waitForTestId: 'compare-table',
  },
];

/**
 * Abre un caso con su tema y su carrito inyectados, espera a que la pantalla este
 * pintada y (si el caso lo pide) recorre sus pasos previos.
 */
export async function openStorePage(
  context: BrowserContext,
  item: StorePageCase,
): Promise<Page> {
  await context.addInitScript(
    ({ theme, cart, compare }) => {
      window.localStorage.setItem('sf-theme', theme);
      if (cart) {
        window.localStorage.setItem('storefront_cart_v1', JSON.stringify(cart));
      }
      if (compare) {
        window.localStorage.setItem('storefront_compare_v1', JSON.stringify(compare));
      }
    },
    {
      theme: item.theme,
      cart: item.cart === true ? FIXED_CART : null,
      compare: item.compare === true ? FIXED_COMPARE : null,
    },
  );
  const page = await context.newPage();
  await page.goto(item.route);
  if (item.waitForTestId !== undefined) {
    // `.first()`: el mismo testid puede repetirse (una linea por articulo del
    // carrito) y la espera es una senal de «ya pinto», no una asercion de cantidad.
    await expect(page.getByTestId(item.waitForTestId).first()).toBeVisible();
  }
  if (item.waitForText !== undefined) {
    await expect(page.getByRole('heading', { name: item.waitForText })).toBeVisible();
  }
  if (item.prepare !== undefined) {
    await item.prepare(page);
  }
  // Tipografias propias cargadas: sin esto la captura puede salir con la fuente de
  // respaldo y cada corrida seria distinta de la anterior.
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15_000 });
  return page;
}
