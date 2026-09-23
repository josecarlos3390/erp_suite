/** Utilidades de querystring compartidas por paginas (servidor) y enlaces. */

export type QueryParams = Record<string, string | number | undefined>;

export function buildHref(path: string, params: QueryParams = {}): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(name, String(value));
    }
  }
  const query = search.toString();
  return query === '' ? path : `${path}?${query}`;
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return first === undefined || first.trim() === '' ? undefined : first.trim();
  }
  if (value === undefined || value.trim() === '') return undefined;
  return value.trim();
}

export function readPage(value: string | string[] | undefined): number {
  const raw = readParam(value);
  if (raw === undefined) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
