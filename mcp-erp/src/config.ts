/**
 * Configuración del MCP del ERP.
 *
 * Todo se toma de variables de entorno para que el servidor no guarde secretos:
 *
 *  - `ERP_API_URL`       URL base de la API (default `http://localhost:3001`)
 *  - `ERP_TENANT_SLUG`   slug del tenant (default `default`)
 *  - `ERP_USERNAME`      usuario (obligatorio para las herramientas de negocio)
 *  - `ERP_PASSWORD`      contraseña (obligatorio para las herramientas de negocio)
 *  - `ERP_TIMEOUT_MS`    timeout por petición (default 20000)
 *  - `ERP_MAX_ROWS`      tope de filas que devuelve cualquier listado (default 25, máx 200)
 *  - `ERP_PROJECT_ROOT`  raíz del monorepo para la herramienta de documentación
 *                        (default: el directorio padre de este paquete)
 */

export interface ErpConfig {
  baseUrl: string;
  tenantSlug: string;
  username: string | undefined;
  password: string | undefined;
  timeoutMs: number;
  maxRows: number;
  projectRoot: string;
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  max: number,
): number {
  if (raw == null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ErpConfig {
  const baseUrl = (env.ERP_API_URL ?? 'http://localhost:3001').replace(
    /\/+$/,
    '',
  );
  return {
    baseUrl,
    tenantSlug: env.ERP_TENANT_SLUG ?? 'default',
    username: env.ERP_USERNAME?.trim() || undefined,
    password: env.ERP_PASSWORD || undefined,
    timeoutMs: parsePositiveInt(env.ERP_TIMEOUT_MS, 20_000, 120_000),
    maxRows: parsePositiveInt(env.ERP_MAX_ROWS, 25, 200),
    projectRoot: env.ERP_PROJECT_ROOT?.trim() || defaultProjectRoot(),
  };
}

/** El paquete vive en `<raíz del monorepo>/mcp-erp`, así que la raíz es `..`. */
function defaultProjectRoot(): string {
  return new URL('../../', import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    '$1',
  );
}

/** ¿Hay credenciales para llamar a la API? (la herramienta de docs no las necesita) */
export function hasApiCredentials(config: ErpConfig): boolean {
  return Boolean(config.username && config.password);
}
