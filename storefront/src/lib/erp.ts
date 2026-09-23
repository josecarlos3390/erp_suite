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
      next: { revalidate },
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
