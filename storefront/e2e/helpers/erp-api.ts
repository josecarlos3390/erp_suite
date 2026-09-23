/**
 * Acceso a la API del canal del ERP desde las pruebas.
 *
 * Los casos NO codifican slugs ni articulos a mano: descubren el dato real con
 * estas funciones y despues comprueban que la tienda muestre lo mismo. Si la API
 * no responde, la prueba falla con un mensaje claro en vez de saltarse.
 */

const ERP_API_URL = (process.env.ERP_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const STOREFRONT_API_KEY = process.env.STOREFRONT_API_KEY ?? 'tienda-dev-key-cambiar';

export const MAX_PAGE_SIZE = 48;
export const CATEGORY_PAGE_SIZE = 24;

export interface ApiProduct {
  itemId: number;
  slug: string;
  name: string;
  sku: string;
  brand: string | null;
  brandCode: string | null;
  price: number;
  salePrice: number | null;
  discountPct: number | null;
  currency: string;
  image: string | null;
  images: string[];
  availability: { warehouseId: number | null; available: number; inStock: boolean };
  category: { id: number; slug: string; name: string } | null;
  specs: { name: string; value: string; groupName: string | null }[];
}

export interface ApiCategory {
  id: number;
  slug: string;
  name: string;
  productCount: number;
  children: ApiCategory[];
}

export interface ApiCatalogPage {
  data: ApiProduct[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiCity {
  code: string;
  name: string;
  deliveryDays: number;
  shippingCost: number;
  freeShippingFrom: number | null;
  warehouse: { id: number; code: string; name: string } | null;
  branch: { id: number; code: string; name: string } | null;
}

/** Cotizacion del canal (`POST /storefront/quote`), sin impuestos. */
export interface ApiQuote {
  city: { code: string; name: string; deliveryDays: number; freeShippingFrom: number | null };
  currency: string;
  items: Array<{
    itemId: number;
    sku: string;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
    available: number;
  }>;
  subtotal: number;
  shipping: number;
  shippingCharged: boolean;
  freeShippingApplied: boolean;
  total: number;
}

/** Pedido del canal (`POST /storefront/orders` y `GET /storefront/tracking`). */
export interface ApiOrder {
  orderNumber: string;
  trackingCode: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryType: string;
  currency: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  salesOrderId: number | null;
  salesOrderCode: string | null;
  createdAt: string;
  items: Array<{
    itemId: number;
    sku: string;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
  }>;
}

export interface ApiOrderCustomer {
  email?: string;
  name?: string;
  phone?: string;
  taxId?: string;
  street?: string;
  district?: string;
  reference?: string;
}

export interface ApiOrderInput {
  idempotencyKey: string;
  cityCode: string;
  deliveryType?: 'HOME' | 'STORE';
  paymentMethod?: 'TRANSFER' | 'QR' | 'CASH_ON_DELIVERY' | 'STORE_PICKUP';
  items: Array<{ itemId: number; quantity: number }>;
  customer?: ApiOrderCustomer;
  notes?: string;
}

async function apiGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${ERP_API_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'x-storefront-key': STOREFRONT_API_KEY },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(
      `El canal del ERP respondio ${response.status} en ${path}. ` +
        `Verificar que la API este en marcha en ${ERP_API_URL} y que STOREFRONT_API_KEY sea valida.`,
    );
  }
  return (await response.json()) as T;
}

/** POST directo al canal (las pruebas son un consumidor mas del contrato). */
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${ERP_API_URL}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-storefront-key': STOREFRONT_API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    // El canal publica su error en `message`: se conserva para poder compararlo
    // con el texto que muestra la tienda (es el unico oraculo del mensaje).
    const raw = await response.text();
    let message = `El canal del ERP respondio ${response.status} en ${path}.`;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const value = (parsed as Record<string, unknown>)['message'];
        if (typeof value === 'string' && value.trim() !== '') message = value;
        else if (Array.isArray(value) && value.length > 0) message = value.join('; ');
      }
    } catch {
      // Sin cuerpo JSON: se queda el mensaje por estado.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function getCatalog(
  params: Record<string, string | number> = {},
): Promise<ApiCatalogPage> {
  return apiGet<ApiCatalogPage>('/storefront/catalog', params);
}

export async function getCategories(): Promise<ApiCategory[]> {
  return apiGet<ApiCategory[]>('/storefront/categories');
}

export async function getCities(): Promise<ApiCity[]> {
  return apiGet<ApiCity[]>('/storefront/cities');
}

export async function getProduct(slug: string, city: string): Promise<ApiProduct> {
  return apiGet<ApiProduct>(`/storefront/products/${encodeURIComponent(slug)}`, { city });
}

/** Catalogo completo (el canal tope la pagina en 48). */
export async function getAllProducts(): Promise<ApiProduct[]> {
  const first = await getCatalog({ page: 1, limit: MAX_PAGE_SIZE });
  const all = [...first.data];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await getCatalog({ page, limit: MAX_PAGE_SIZE });
    all.push(...next.data);
  }
  return all;
}

export interface ZeroStockCase {
  slug: string;
  name: string;
  availableInDefaultCity: number;
  defaultCity: string;
  emptyCity: string;
  emptyCityName: string;
}

/**
 * Encuentra un articulo publicado con existencia en la ciudad por defecto y
 * **sin** existencia en otra ciudad. Se descubre recorriendo el catalogo real.
 */
export async function findZeroStockProduct(
  emptyCity: string,
  defaultCity: string,
): Promise<ZeroStockCase> {
  const [products, cities] = await Promise.all([getAllProducts(), getCities()]);
  const emptyCityName = cities.find((city) => city.code === emptyCity)?.name ?? emptyCity;

  for (const product of products) {
    const detail = await getProduct(product.slug, emptyCity);
    if (detail.availability.inStock) continue;
    const inDefault = await getProduct(product.slug, defaultCity);
    if (!inDefault.availability.inStock) continue;
    return {
      slug: product.slug,
      name: product.name,
      availableInDefaultCity: inDefault.availability.available,
      defaultCity,
      emptyCity,
      emptyCityName,
    };
  }

  throw new Error(
    `El catalogo publicado no tiene ningun articulo con existencia en ${defaultCity} y sin existencia en ${emptyCity}.`,
  );
}

/** `POST /storefront/quote` — cotiza sin crear nada. */
export async function quote(
  cityCode: string,
  items: Array<{ itemId: number; quantity: number }>,
): Promise<ApiQuote> {
  return apiPost<ApiQuote>('/storefront/quote', { cityCode, items });
}

/** `POST /storefront/orders` — crea el pedido (idempotente por clave). */
export async function placeOrder(input: ApiOrderInput): Promise<ApiOrder> {
  return apiPost<ApiOrder>('/storefront/orders', {
    idempotencyKey: input.idempotencyKey,
    cityCode: input.cityCode,
    deliveryType: input.deliveryType ?? 'HOME',
    paymentMethod: input.paymentMethod ?? 'TRANSFER',
    items: input.items,
    customer: input.customer ?? {},
  });
}

/** `GET /storefront/tracking` — `null` cuando el canal responde 404. */
export async function trackOrder(order: string, email?: string): Promise<ApiOrder | null> {
  const url = new URL(`${ERP_API_URL}/storefront/tracking`);
  url.searchParams.set('order', order);
  if (email !== undefined) url.searchParams.set('email', email);
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'x-storefront-key': STOREFRONT_API_KEY },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`El canal del ERP respondio ${response.status} en /storefront/tracking.`);
  }
  return (await response.json()) as ApiOrder;
}

export interface ShippableCase {
  slug: string;
  name: string;
  itemId: number;
  price: number;
  cityCode: string;
  cityName: string;
}

/**
 * Descubre un articulo **barato** y con existencia en la ciudad pedida: por
 * debajo del umbral de envio gratis, de modo que la cotizacion cobre el flete y
 * la prueba pueda comparar subtotal **y** envio contra el ERP.
 */
export async function findShippableProduct(cityCode: string): Promise<ShippableCase> {
  const [cities, page] = await Promise.all([
    getCities(),
    getCatalog({ city: cityCode, sort: 'price_asc', limit: MAX_PAGE_SIZE }),
  ]);
  const city = cities.find((item) => item.code === cityCode);
  if (city === undefined) {
    throw new Error(`El canal no tiene habilitada la ciudad ${cityCode}.`);
  }
  const threshold = city.freeShippingFrom ?? 0;

  for (const product of page.data) {
    if (!product.availability.inStock) continue;
    if (threshold > 0 && product.price >= threshold) continue;
    const detail = await getProduct(product.slug, cityCode);
    if (!detail.availability.inStock) continue;
    return {
      slug: product.slug,
      name: product.name,
      itemId: product.itemId,
      price: product.price,
      cityCode,
      cityName: city.name,
    };
  }

  throw new Error(
    `No hay ningun articulo con existencia y precio por debajo de ${threshold} en ${cityCode}.`,
  );
}

export interface UnquotableCase {
  slug: string;
  name: string;
  itemId: number;
  /** Ciudades donde el canal **si** cotiza ese articulo (el carrito se arma alli). */
  sellableCity: string;
  sellableCityName: string;
  emptyCity: string;
  emptyCityName: string;
  /** Mensaje exacto del canal al cotizarlo en la ciudad sin venta. */
  errorMessage: string;
}

/**
 * Descubre un articulo publicado que el canal **no** puede cotizar en una ciudad
 * (sin existencia o sin matriz articulo-almacen) y **si** cotiza en otra.
 *
 * Es la unica forma honesta de montar el caso «sin existencia en LPZ»: la
 * condicion se descubre llamando a la cotizacion real —el mismo endpoint que usa
 * el checkout— en vez de deducirla de la disponibilidad del catalogo, y se
 * devuelve el mensaje del ERP para poder compararlo con el que muestra la tienda.
 */
export async function findUnquotableProduct(
  emptyCity: string,
  sellableCity: string,
): Promise<UnquotableCase> {
  const [pages, cities] = await Promise.all([
    Promise.all(
      [1, 2, 3].map((page) =>
        getCatalog({ city: emptyCity, limit: MAX_PAGE_SIZE, page, sort: 'price_asc' }),
      ),
    ),
    getCities(),
  ]);
  const emptyCityName = cities.find((city) => city.code === emptyCity)?.name ?? emptyCity;
  const sellableCityName = cities.find((city) => city.code === sellableCity)?.name ?? sellableCity;

  for (const page of pages) {
    for (const product of page.data) {
      if (product.availability.inStock) continue;
      let errorMessage: string;
      try {
        await quote(emptyCity, [{ itemId: product.itemId, quantity: 1 }]);
        // El canal si lo cotiza: no sirve para el caso.
        continue;
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
      const sellable = await quote(sellableCity, [{ itemId: product.itemId, quantity: 1 }]).catch(
        () => null,
      );
      if (sellable === null) continue;
      return {
        slug: product.slug,
        name: product.name,
        itemId: product.itemId,
        sellableCity,
        sellableCityName,
        emptyCity,
        emptyCityName,
        errorMessage,
      };
    }
  }

  throw new Error(
    `El canal no tiene ningun articulo publicado que cotice en ${sellableCity} y falle en ${emptyCity}.`,
  );
}
