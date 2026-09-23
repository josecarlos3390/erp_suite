import 'server-only';

/**
 * Cliente tipado del canal publico del storefront del ERP.
 *
 * Reglas (decisiones D10 del plan de e-commerce):
 *  - La clave del canal (`x-storefront-key`) vive SOLO en el servidor: este
 *    modulo importa `server-only`, asi que un componente cliente que lo importe
 *    rompe en build en vez de filtrar la clave al navegador.
 *  - La ruta real de la API NO lleva prefijo `/api`: es `/storefront/...`.
 *  - Toda peticion tiene tope de tiempo (`AbortSignal.timeout`) y `revalidate`
 *    por endpoint.
 *
 * Los tipos de abajo ESPEJAN el contrato del canal (ver
 * docs/plans/plan-ecommerce-storefront.md §5 y el controlador del ERP). No se
 * inventan campos: si el ERP no lo devuelve, no existe aqui.
 */

const RAW_BASE_URL = process.env.ERP_API_URL ?? 'http://localhost:3001';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
const TIMEOUT_MS = Number.parseInt(process.env.ERP_TIMEOUT_MS ?? '8000', 10);

/** Tope de pagina que impone el canal. */
export const MAX_PAGE_SIZE = 48;

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

export const SORT_OPTIONS: readonly SortOption[] = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
];

export const SORT_LABELS: Readonly<Record<SortOption, string>> = {
  relevance: 'Relevancia',
  price_asc: 'Menor precio',
  price_desc: 'Mayor precio',
  newest: 'Mas recientes',
};

export interface ProductAvailability {
  warehouseId: number | null;
  available: number;
  inStock: boolean;
}

export interface ProductSpec {
  name: string;
  value: string;
  unit: string | null;
  groupName: string | null;
  isFilterable: boolean;
}

export interface ProductCategoryRef {
  id: number;
  slug: string;
  name: string;
}

export interface Product {
  itemId: number;
  slug: string;
  name: string;
  sku: string;
  brand: string | null;
  brandCode: string | null;
  shortDescription: string | null;
  price: number;
  /** Precio de lista del maestro: con oferta vigente es el «antes» de la tarjeta. */
  listPrice: number;
  salePrice: number | null;
  discountPct: number | null;
  currency: string;
  image: string | null;
  images: string[];
  badges: string[];
  warrantyMonths: number | null;
  specs: ProductSpec[];
  isOnlineOnly: boolean;
  deliveryDays: number | null;
  category: ProductCategoryRef | null;
  availability: ProductAvailability;
}

export interface CategoryNode {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  productCount: number;
  children: CategoryNode[];
}

export interface Brand {
  code: string;
  name: string;
  logoUrl: string | null;
  productCount: number;
}

export interface Banner {
  slot: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  href: string | null;
  sortOrder: number;
}

/** Entrada del indice de paginas publicadas (pie de la tienda). */
export interface PageLink {
  slug: string;
  title: string;
}

export interface StorePage {
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface CityBranch {
  id: number;
  code: string;
  name: string;
  address: string | null;
}

export interface CityWarehouse {
  id: number;
  code: string;
  name: string;
}

export interface City {
  code: string;
  name: string;
  deliveryDays: number;
  shippingCost: number;
  freeShippingFrom: number;
  warehouse: CityWarehouse | null;
  branch: CityBranch | null;
}

/** Formas de entrega que acepta el canal (D4: domicilio; el retiro es fase 2). */
export type DeliveryType = 'HOME' | 'STORE';

/** Metodos de pago offline del MVP. El canal **no** conoce datos de tarjeta. */
export type PaymentMethod = 'TRANSFER' | 'QR' | 'CASH_ON_DELIVERY' | 'STORE_PICKUP';

export const DELIVERY_TYPES: readonly DeliveryType[] = ['HOME', 'STORE'];

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'TRANSFER',
  'QR',
  'CASH_ON_DELIVERY',
  'STORE_PICKUP',
];

/** Linea que envia la tienda al canal: solo articulo y cantidad. */
export interface QuoteRequestLine {
  itemId: number;
  quantity: number;
}

/** Datos del comprador invitado tal como los acepta el canal. */
export interface OrderCustomer {
  email?: string;
  name?: string;
  phone?: string;
  taxId?: string;
  street?: string;
  district?: string;
  reference?: string;
}

export interface QuoteRequest {
  cityCode: string;
  items: QuoteRequestLine[];
  /** Correo del comprador: con el, la cotizacion usa el precio del cliente registrado. */
  customerEmail?: string;
}

export interface CreateOrderRequest extends QuoteRequest {
  idempotencyKey: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  customer: OrderCustomer;
  notes?: string;
}

/**
 * Cotizacion del carrito (`POST /storefront/quote`) y pedido (`POST /storefront/orders`).
 *
 * Las dos vistas viven en `./order-view` (modulo puro) porque tambien las consume
 * el navegador en el checkout y el seguimiento; aqui se importan para tipar las
 * funciones del canal y se re-exportan para el resto del servidor.
 */
import type { OrderView, QuoteView } from './order-view';

export type { OrderLine, OrderView, QuoteLine, QuoteView } from './order-view';

export interface CatalogQuery {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  search?: string;
  sort?: SortOption;
  city?: string;
  onSale?: boolean;
}

export interface CatalogPage {
  data: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Error tipado del canal: conserva el mensaje que responde el ERP. */
export class ErpError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ErpError';
    this.status = status;
    this.endpoint = endpoint;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** Segundos de cache por endpoint (ISR de datos). */
const REVALIDATE = {
  catalog: 60,
  offers: 60,
  categories: 300,
  brands: 600,
  banners: 120,
  page: 600,
  cities: 3600,
  product: 60,
  related: 120,
  /**
   * El **pedido** no se cachea (`0`): su estado es lo que el ERP acaba de mover (entrega,
   * factura) y lo que el comprador acaba de cambiar (la referencia de su pago). Una
   * respuesta vieja aqui no es rapidez, es mentira: medido, tras anotar la referencia la
   * confirmacion servia el pedido anterior.
   */
  tracking: 0,
} as const;

type QueryValue = string | number | undefined;

/** Devuelve la clave del canal o corta con un mensaje accionable. */
function apiKey(): string {
  const key = process.env.STOREFRONT_API_KEY;
  if (key === undefined || key.trim() === '') {
    throw new ErpError(
      'Falta STOREFRONT_API_KEY: copiar .env.example a .env.local con la clave del canal.',
      0,
      '/storefront',
    );
  }
  return key;
}

/** Extrae el mensaje que devuelve el ERP (string o lista de validacion). */
function readErpMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    const message = record['message'];
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
    if (Array.isArray(message)) {
      const parts = message.filter((item): item is string => typeof item === 'string');
      if (parts.length > 0) {
        return parts.join('; ');
      }
    }
    const error = record['error'];
    if (typeof error === 'string' && error.trim() !== '') {
      return error;
    }
  }
  return fallback;
}

/** GET tipado al canal: URL con querystring, cabecera de clave, tope y cache. */
async function erpGet<T>(
  endpoint: string,
  params: Record<string, QueryValue>,
  revalidate: number,
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(name, String(value));
    }
  }

  const timeout = Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0 ? TIMEOUT_MS : 8000;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-storefront-key': apiKey(),
      },
      signal: AbortSignal.timeout(timeout),
      // `revalidate: 0` = **sin cache**: el estado del pedido es lo que el comprador
      // acaba de cambiar (su referencia de pago) y lo que el ERP mueve al entregar; una
      // respuesta vieja aqui no es rapidez, es mentira (defecto medido: tras anotar la
      // referencia, la confirmacion servia el pedido anterior).
      ...(revalidate > 0 ? { next: { revalidate } } : { cache: 'no-store' as const }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ErpError(
      `No se pudo consultar el ERP en ${endpoint} (${detail}).`,
      0,
      endpoint,
    );
  }

  const raw = await response.text();
  let body: unknown = null;
  if (raw !== '') {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new ErpError(
      readErpMessage(body, `El ERP respondio ${response.status} en ${endpoint}.`),
      response.status,
      endpoint,
    );
  }

  // El contrato del canal esta tipado arriba; el cuerpo ya viene validado por el DTO del ERP.
  return body as T;
}

/** GET que devuelve null ante 404 (recurso inexistente o en borrador). */
async function erpGetOrNull<T>(
  endpoint: string,
  params: Record<string, QueryValue>,
  revalidate: number,
): Promise<T | null> {
  try {
    return await erpGet<T>(endpoint, params, revalidate);
  } catch (error) {
    if (error instanceof ErpError && error.isNotFound) {
      return null;
    }
    throw error;
  }
}

/**
 * POST tipado al canal.
 *
 * Nunca se cachea (`cache: 'no-store'`): una cotizacion o un alta de pedido no
 * pueden servirse de una respuesta vieja. El cuerpo ya viene **saneado** por el
 * route handler; este modulo solo transporta.
 */
async function erpPost<T>(endpoint: string, body: unknown): Promise<T> {
  const timeout = Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0 ? TIMEOUT_MS : 8000;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-storefront-key': apiKey(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
      cache: 'no-store',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ErpError(
      `No se pudo consultar el ERP en ${endpoint} (${detail}).`,
      0,
      endpoint,
    );
  }

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw !== '') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new ErpError(
      readErpMessage(parsed, `El ERP respondio ${response.status} en ${endpoint}.`),
      response.status,
      endpoint,
    );
  }

  return parsed as T;
}

/** Normaliza la ciudad: el canal solo acepta codigos cargados por el tenant. */
function cityParam(city: string | undefined): string | undefined {
  if (city === undefined) return undefined;
  const trimmed = city.trim().toUpperCase();
  return trimmed === '' ? undefined : trimmed;
}

export interface CatalogOptions extends Omit<CatalogQuery, 'city'> {
  city?: string | undefined;
}

/** GET /storefront/catalog */
export async function getCatalog(query: CatalogOptions = {}): Promise<CatalogPage> {
  const requestedLimit = query.limit ?? 24;
  const limit = Math.min(Math.max(1, Math.trunc(requestedLimit)), MAX_PAGE_SIZE);
  const page = Math.max(1, Math.trunc(query.page ?? 1));

  return erpGet<CatalogPage>(
    '/storefront/catalog',
    {
      page,
      limit,
      category: query.category,
      brand: query.brand,
      search: query.search,
      sort: query.sort,
      city: cityParam(query.city),
      onSale: query.onSale === true ? 'true' : undefined,
    },
    REVALIDATE.catalog,
  );
}

/**
 * Ofertas vigentes de la home: el canal las filtra en SQL con `onSale` (ventana de la
 * promocion evaluada en el servidor), asi que basta una peticion.
 *
 * Antes se recorria el catalogo de a 48 (tope 4 paginas) filtrando `salePrice`, porque
 * el filtro no existia; se cambio al filtro del canal cuando se agrego.
 */
export async function getOffers(limit = 8, city?: string): Promise<Product[]> {
  const page = await getCatalog({ limit: MAX_PAGE_SIZE, onSale: true, city });
  return page.data.slice(0, Math.max(1, Math.trunc(limit)));
}

/** Todos los slugs publicados (para el sitemap). */
export async function getPublishedSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await getCatalog({ page, limit: MAX_PAGE_SIZE });
    totalPages = result.totalPages;
    for (const product of result.data) {
      slugs.push(product.slug);
    }
    page += 1;
  } while (page <= totalPages && page <= 20);

  return slugs;
}

/** GET /storefront/categories */
export async function getCategories(): Promise<CategoryNode[]> {
  return erpGet<CategoryNode[]>('/storefront/categories', {}, REVALIDATE.categories);
}

/** GET /storefront/brands — con `category` la faceta se acota a esa categoria. */
export async function getBrands(category?: string): Promise<Brand[]> {
  return erpGet<Brand[]>('/storefront/brands', { category }, REVALIDATE.brands);
}

/** GET /storefront/pages — indice de paginas publicadas (pie de la tienda). */
export async function getPageLinks(): Promise<PageLink[]> {
  return erpGet<PageLink[]>('/storefront/pages', {}, REVALIDATE.page);
}

/** GET /storefront/banners?slot= */
export async function getBanners(slot?: string): Promise<Banner[]> {
  return erpGet<Banner[]>('/storefront/banners', { slot }, REVALIDATE.banners);
}

/** GET /storefront/pages/:slug — null si la pagina no esta publicada (404). */
export async function getPage(slug: string): Promise<StorePage | null> {
  return erpGetOrNull<StorePage>(
    `/storefront/pages/${encodeURIComponent(slug)}`,
    {},
    REVALIDATE.page,
  );
}

/** GET /storefront/cities */
export async function getCities(): Promise<City[]> {
  return erpGet<City[]>('/storefront/cities', {}, REVALIDATE.cities);
}

/** GET /storefront/products/:slug?city= — null si no esta publicado (404). */
export async function getProduct(slug: string, city?: string): Promise<Product | null> {
  return erpGetOrNull<Product>(
    `/storefront/products/${encodeURIComponent(slug)}`,
    { city: cityParam(city) },
    REVALIDATE.product,
  );
}

/** GET /storefront/products/:slug/related?city= */
export async function getRelated(slug: string, city?: string): Promise<Product[]> {
  try {
    return await erpGet<Product[]>(
      `/storefront/products/${encodeURIComponent(slug)}/related`,
      { city: cityParam(city) },
      REVALIDATE.related,
    );
  } catch (error) {
    // Un producto sin relacionados no debe tumbar la ficha.
    if (error instanceof ErpError && error.isNotFound) {
      return [];
    }
    throw error;
  }
}

/**
 * POST /storefront/quote — cotiza el carrito **sin crear nada**.
 *
 * Es la fuente unica de los importes que el checkout muestra: usa el mismo
 * `resolveOrderDraft` que el alta, asi que lo que ve el comprador y lo que se
 * cobra no pueden discrepar. El correo (opcional) es lo que permite cotizar con el
 * precio del **cliente registrado** —su tercero, su lista de precios y sus acuerdos
 * automaticos— en vez de con el de invitado.
 */
export async function quoteOrder(request: QuoteRequest): Promise<QuoteView> {
  const email = request.customerEmail?.trim();
  return erpPost<QuoteView>('/storefront/quote', {
    cityCode: request.cityCode.trim().toUpperCase(),
    items: request.items.map((line) => ({
      itemId: Math.trunc(line.itemId),
      quantity: line.quantity,
    })),
    ...(email === undefined || email === '' ? {} : { customer: { email } }),
  });
}

/**
 * POST /storefront/orders — crea el pedido (idempotente por `idempotencyKey`).
 *
 * La clave la genera la tienda **una vez por intento de compra**: repetir el
 * POST con la misma clave devuelve el mismo pedido en vez de crear otro.
 */
export async function createOrder(request: CreateOrderRequest): Promise<OrderView> {
  return erpPost<OrderView>('/storefront/orders', {
    idempotencyKey: request.idempotencyKey,
    cityCode: request.cityCode.trim().toUpperCase(),
    deliveryType: request.deliveryType,
    paymentMethod: request.paymentMethod,
    items: request.items.map((line) => ({
      itemId: Math.trunc(line.itemId),
      quantity: line.quantity,
    })),
    customer: request.customer,
    ...(request.notes === undefined ? {} : { notes: request.notes }),
  });
}

/** GET /storefront/tracking?order=&email= — null si el pedido no existe (404). */
export async function getTracking(order: string, email?: string): Promise<OrderView | null> {
  return erpGetOrNull<OrderView>(
    '/storefront/tracking',
    { order: order.trim(), email: email?.trim() },
    REVALIDATE.tracking,
  );
}

/**
 * POST /storefront/payment-reference — anota la referencia del pago offline (D15).
 *
 * El comprador paga **despues** de confirmar, asi que no cabe en el alta: este POST
 * escribe solo esa referencia. **No cobra** (el pago lo registra el ERP y el estado se
 * deriva de su factura) y el canal exige el correo del pedido para escribir en el.
 */
export async function registerPaymentReference(request: {
  order: string;
  email: string;
  reference: string;
}): Promise<OrderView> {
  return erpPost<OrderView>('/storefront/payment-reference', {
    order: request.order.trim(),
    email: request.email.trim(),
    reference: request.reference.trim(),
  });
}

/** Busca un nodo de categoria por slug en el arbol (raices y descendientes). */
export function findCategory(
  nodes: readonly CategoryNode[],
  slug: string,
): CategoryNode | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const inChildren = findCategory(node.children, slug);
    if (inChildren !== null) return inChildren;
  }
  return null;
}

/** Cadena de ancestros + el nodo (para migas de pan). */
export function findCategoryPath(
  nodes: readonly CategoryNode[],
  slug: string,
): CategoryNode[] {
  for (const node of nodes) {
    if (node.slug === slug) return [node];
    const inside = findCategoryPath(node.children, slug);
    if (inside.length > 0) return [node, ...inside];
  }
  return [];
}
