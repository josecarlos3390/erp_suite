/**
 * **Mapa de canales por host: la regla, en un solo sitio** (T216-ter).
 *
 * Vive en un modulo **puro** (sin `next/headers`, sin `server-only`, sin React) porque lo usan dos
 * runtimes distintos:
 *
 *  - el **middleware** (runtime Edge) para decidir el enrutado — un dominio no declarado responde
 *    **404** antes de renderizar—, y
 *  - la **capa de datos** (`@/lib/channels`, runtime Node) para elegir la clave del canal, la
 *    ciudad por defecto y la identidad de la petición.
 *
 * Si cada uno tuviera su copia de la regla, un dominio podría pasar el middleware y quedarse sin
 * canal (o al revés). El modulo **no** es apto para componentes cliente: contiene la clave del canal
 * (`STOREFRONT_CHANNELS`); Next no inlinea variables sin prefijo `NEXT_PUBLIC_`, así que un import
 * accidental desde el cliente no filtraría la clave, pero el consumidor correcto es el servidor.
 *
 * Formato de `STOREFRONT_CHANNELS` (JSON):
 *
 * ```json
 * {
 *   "tienda-a.com": { "key": "sf_…", "name": "Tienda A", "description": "…", "city": "SCZ" },
 *   "tienda-b.com": { "key": "sf_…", "name": "Tienda B", "url": "https://tienda-b.com" },
 *   "*":            { "key": "sf_…", "name": "Previews" }
 * }
 * ```
 */

/** Entrada del mapa tal como la escribe el operador (todo opcional menos `key`). */
export interface ChannelEntry {
  key: string;
  name?: string;
  description?: string;
  city?: string;
  url?: string;
}

/** Entrada encontrada para un host, con el patrón que casó (`*` cuando es el comodín). */
export interface MatchedChannel {
  pattern: string;
  entry: ChannelEntry;
}

/**
 * Host normalizado para comparar: minúsculas, sin puerto, sin punto final y sin espacios. Toma el
 * **primer** valor de una cabecera con lista (`a.com, b.com`) y `null` cuando no queda nada.
 */
export function normalizeHost(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const first = value.split(',')[0]?.trim() ?? '';
  const withoutPort = first.replace(/:\d+$/, '');
  const normalized = withoutPort.replace(/\.+$/, '').toLowerCase();
  return normalized === '' ? null : normalized;
}

/**
 * Lee `STOREFRONT_CHANNELS`. Una entrada sin `key` se **ignora** (no se inventa una clave) y un
 * JSON inválido **corta** con un mensaje que dice qué mirar, en vez de dejar la tienda sin canales
 * en silencio.
 */
export function readChannelMap(
  raw: string | undefined | null,
): Map<string, ChannelEntry> {
  const map = new Map<string, ChannelEntry>();
  if (raw === null || raw === undefined || raw.trim() === '') return map;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'STOREFRONT_CHANNELS no es JSON valido. Revisa la variable (comillas dobles y comas).',
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('STOREFRONT_CHANNELS debe ser un objeto { "host": { "key": "…" } }.');
  }

  const text = (entry: Record<string, unknown>, name: string): string | undefined => {
    const value = entry[name];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
  };

  for (const [host, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue;
    const entry = value as Record<string, unknown>;
    const key = text(entry, 'key');
    if (key === undefined) continue;
    const pattern = host === '*' ? '*' : normalizeHost(host);
    if (pattern === null) continue;
    map.set(pattern, {
      key,
      name: text(entry, 'name'),
      description: text(entry, 'description'),
      city: text(entry, 'city'),
      url: text(entry, 'url'),
    });
  }
  return map;
}

/**
 * Canal de un host: coincidencia **exacta** → variante `www.` → comodín `"*"`. `null` cuando el
 * dominio no está declarado (y no hay comodín): quien decide qué hacer con eso es el middleware
 * (404) o la capa de datos (error accionable), nunca esta función.
 */
export function findChannelEntry(
  map: ReadonlyMap<string, ChannelEntry>,
  host: string | null | undefined,
): MatchedChannel | null {
  if (map.size === 0) return null;
  const normalized = normalizeHost(host);
  if (normalized !== null) {
    const exact = map.get(normalized);
    if (exact !== undefined) return { pattern: normalized, entry: exact };
    const alternate = normalized.startsWith('www.')
      ? normalized.slice(4)
      : `www.${normalized}`;
    const variant = map.get(alternate);
    if (variant !== undefined) return { pattern: alternate, entry: variant };
  }
  const wildcard = map.get('*');
  return wildcard === undefined ? null : { pattern: '*', entry: wildcard };
}
