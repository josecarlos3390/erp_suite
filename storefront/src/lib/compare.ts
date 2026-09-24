/**
 * Reglas del **comparador** (F6): que slugs se aceptan, como se piden al canal y **que
 * caracteristicas se comparan**.
 *
 * Es un modulo **puro** (sin `server-only` ni navegador) porque lo usan los dos lados: el
 * route handler `/api/comparar` valida con el lo que le llega del navegador y el islote de la
 * pagina lo usa para armar la tabla.
 */

/** Tope de productos comparados (el mismo que el store del navegador). */
export const MAX_COMPARE_SLUGS = 4;

/** Un slug publicado: minusculas, numeros y guiones (el que genera el canal). */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

/**
 * Sanea la lista de slugs que llega por la querystring: **unica**, con forma de slug y
 * recortada al tope. Lo que no pasa el patron se descarta en vez de reenviarse al canal: el
 * navegador no dicta que se consulta.
 */
export function parseCompareSlugs(value: unknown): string[] {
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
    if (valid.length >= MAX_COMPARE_SLUGS) break;
  }
  return valid;
}

/** Lo minimo de un `spec` para comparar (lo publica el canal en cada producto). */
export interface CompareSpec {
  name: string;
  value: string;
  unit: string | null;
}

/** Producto con lo que la tabla necesita (el `Product` del canal encaja tal cual). */
export interface CompareProduct {
  slug: string;
  name: string;
  specs: readonly CompareSpec[];
}

/** Valor de una caracteristica tal como se pinta (`valor unidad`). */
export function specValue(spec: CompareSpec | undefined): string | null {
  if (spec === undefined) return null;
  const unit =
    typeof spec.unit === 'string' && spec.unit !== '' ? ` ${spec.unit}` : '';
  return `${spec.value}${unit}`;
}

/** Normaliza el nombre de una caracteristica para compararlo (sin tildes ni mayusculas). */
function normalizeSpecName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Caracteristicas que la tabla ya publica como **fila fija** (marca, categoria, garantia...) o
 * que no son una caracteristica comparable (precio, existencia, SKU). Se excluyen de la
 * comparacion de ficha tecnica para no repetir la misma informacion dos veces en la misma
 * pantalla: el canal las publica como `ItemSpec` **y** como campo del maestro.
 */
const RESERVED_SPEC_NAMES = [
  'producto',
  'precio',
  'existencia',
  'marca',
  'vendido por',
  'garantia',
  'categoria',
  'sku',
];

/** `true` si el nombre de la caracteristica ya se publica como fila fija de la tabla. */
export function isReservedSpecName(name: string): boolean {
  return RESERVED_SPEC_NAMES.includes(normalizeSpecName(name));
}

/**
 * **Que caracteristicas se comparan**: solo las que tienen **todos** los productos elegidos.
 *
 * Es la regla honesta: una fila con huecos en la mitad de las columnas no compara nada, y el
 * canal no garantiza que dos articulos distintos compartan el nombre de una caracteristica. El
 * orden es el del primer producto (que es el que publica el canal: `ItemSpec.sortOrder`), para
 * que la tabla no cambie de orden al agregar o quitar columnas cuando no hace falta.
 */
export function sharedSpecNames(products: readonly CompareProduct[]): string[] {
  if (products.length === 0) return [];
  const [first, ...rest] = products;
  if (first === undefined) return [];
  return first.specs
    .map((spec) => spec.name)
    .filter((name) => !isReservedSpecName(name))
    .filter((name) =>
      rest.every((product) => product.specs.some((spec) => spec.name === name)),
    );
}

/** Matriz de la tabla: una fila por caracteristica compartida y una celda por producto. */
export function specMatrix(
  products: readonly CompareProduct[],
): Array<{ name: string; values: Array<string | null> }> {
  return sharedSpecNames(products).map((name) => ({
    name,
    values: products.map((product) =>
      specValue(product.specs.find((spec) => spec.name === name)),
    ),
  }));
}

/** Caracteristicas **propias** de un producto (las que no estan en la tabla comun). */
export function ownSpecs(
  product: CompareProduct,
  shared: readonly string[],
): CompareSpec[] {
  return product.specs.filter(
    (spec) => !shared.includes(spec.name) && !isReservedSpecName(spec.name),
  );
}

/** Ruta del canal para pedir el detalle vigente de los productos elegidos. */
export function compareApiHref(slugs: readonly string[]): string {
  const params = new URLSearchParams({ slugs: slugs.join(',') });
  return `/api/comparar?${params.toString()}`;
}
