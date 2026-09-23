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
  warehouse: { id: number; code: string; name: string } | null;
  branch: { id: number; code: string; name: string } | null;
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
