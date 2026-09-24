import { ErpError, getProduct, type Product } from '@/lib/erp';

/**
 * Lectura de productos por **lista de slugs** (F6).
 *
 * La usan los dos puentes que piden datos vigentes para una lista que vive en el navegador: el
 * **comparador** (`/api/comparar`, tope 4) y los **favoritos** (`/api/favoritos`, tope 24). La
 * regla es una sola para los dos: el navegador **nunca** dicta qué se consulta —los slugs se
 * sanean antes de viajar al canal— y la clave del canal se queda en el servidor (D10).
 */

/** Un slug publicado: minusculas, numeros y guiones (el que genera el canal). */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

/**
 * Sanea la lista de slugs que llega por la querystring: **unica**, con forma de slug y
 * recortada al tope. Lo que no pasa el patron se descarta en vez de reenviarse al canal.
 */
export function parseSlugs(value: unknown, max: number): string[] {
  const raw = Array.isArray(value)
    ? value.flatMap((item) => String(item).split(','))
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const item of raw) {
    const slug = item.trim().toLowerCase();
    if (slug === '' || !SLUG_PATTERN.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    valid.push(slug);
    if (valid.length >= max) break;
  }
  return valid;
}

export interface LookupResult {
  /** Productos que se pudieron leer, en el orden pedido. */
  products: Product[];
  /** Slugs que ya no se pueden leer (despublicados, borrados). */
  missing: string[];
  /** Primer error del canal, si **ninguno** se pudo leer (para el estado HTTP). */
  firstError: unknown;
}

/** Resultado por slug: o el producto, o por que no se pudo leer. */
interface LookupRow {
  slug: string;
  product?: Product;
  error?: unknown;
}

/**
 * Pide cada slug al canal (`GET /storefront/products/:slug`) y **no tumba la lista** porque uno
 * falle: lo que ya no existe se devuelve en `missing` y las demas columnas siguen sirviendo.
 * Las peticiones van en paralelo porque cada una es independiente.
 */
export async function loadProductsBySlugs(
  slugs: readonly string[],
  city: string,
): Promise<LookupResult> {
  const settled: LookupRow[] = await Promise.all(
    slugs.map(async (slug): Promise<LookupRow> => {
      try {
        const product = await getProduct(slug, city);
        // `getProduct` devuelve `null` cuando la publicacion ya no existe (404): es una
        // ausencia esperada, no un fallo del canal, y va a `missing` como las demas.
        if (product === null) return { slug, error: new Error('ya no esta publicado') };
        return { slug, product };
      } catch (error) {
        return { slug, error };
      }
    }),
  );

  return {
    products: settled.flatMap((row) =>
      row.product === undefined ? [] : [row.product],
    ),
    missing: settled.flatMap((row) => (row.product === undefined ? [row.slug] : [])),
    firstError: settled.find((row) => row.product === undefined)?.error,
  };
}

/**
 * Estado HTTP de una lectura sin resultados: el del canal si respondio un error accionable
 * (404 de un articulo despublicado) y 502 si fue un fallo de red.
 */
export function lookupErrorStatus(error: unknown): number {
  return error instanceof ErpError && error.status >= 400 && error.status <= 599
    ? error.status
    : 502;
}
