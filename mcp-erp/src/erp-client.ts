/**
 * Cliente HTTP del ERP para el MCP.
 *
 * **Solo lectura por construcción**: la única petición que no es `GET` es el login,
 * y toda ruta pasa por `assertAllowedPath` antes de salir. Un camino que no esté en
 * la lista blanca lanza, así que ninguna herramienta puede tocar un endpoint de
 * escritura ni por error.
 */

import { ErpConfig } from './config.js';

export interface ErpClientOptions {
  config: ErpConfig;
  /** Inyectable para tests: por defecto `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

export class ErpApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ErpApiError';
  }
}

/**
 * Rutas de solo lectura permitidas. Se ancla al inicio (`^`) para que no se pueda
 * colar un `../` ni un endpoint de escritura del mismo módulo.
 */
const ALLOWED_PATTERNS: RegExp[] = [
  /^\/health$/,
  /^\/auth\/me$/,
  /^\/settings$/,
  /^\/accounts(?:\/\d+)?(?:\/(?:ledger|balance))?$/,
  /^\/items(?:$|\/low-stock|\/\d+(?:\/(?:stock|kardex|prices|avg-cost|batches))?$|\/by-barcode\/[^/]+$)/,
  /^\/partners(?:\/\d+(?:\/(?:balance|transactions))?)?$/,
  /^\/document-series(?:\/(?:doc-types|assignments|next-preview|\d+))?$/,
  /^\/withholding-taxes$/,
  /^\/tax-indicators$/,
  /^\/reports\/[a-z-]+$/,
  /^\/journal-entries(?:\/\d+)?$/,
  /^\/sale-invoices(?:\/\d+)?$/,
  /^\/purchase-invoices(?:\/\d+)?$/,
  /^\/sales-orders(?:\/\d+)?$/,
  /^\/purchase-orders(?:\/\d+)?$/,
  /^\/delivery-orders(?:\/\d+)?$/,
  /^\/purchase-receipts(?:\/\d+)?$/,
  /^\/incoming-payments(?:\/\d+)?$/,
  /^\/outgoing-payments(?:\/\d+)?$/,
  /^\/sales-credit-notes(?:\/\d+)?$/,
  /^\/purchase-credit-notes(?:\/\d+)?$/,
  /^\/stock-entries(?:\/\d+)?$/,
  /^\/stock-exits(?:\/\d+)?$/,
  /^\/stock-transfers(?:\/\d+)?$/,
  /^\/stock-adjustments(?:\/\d+)?$/,
  /^\/batches(?:\/\d+)?$/,
  /^\/serial-numbers(?:\/\d+)?$/,
];

export function assertAllowedPath(path: string): void {
  const normalized = path.split('?')[0] ?? '';
  if (!ALLOWED_PATTERNS.some((re) => re.test(normalized))) {
    throw new Error(
      `Ruta no permitida por el MCP (solo lectura, lista blanca): ${normalized}`,
    );
  }
}

interface Session {
  token: string;
  xsrf: string;
}

export class ErpClient {
  private session: Session | null = null;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ErpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  get config(): ErpConfig {
    return this.options.config;
  }

  /** Login por usuario/contraseña (mismo flujo que el suite E2E). */
  async login(): Promise<Session> {
    const { config } = this.options;
    if (!config.username || !config.password) {
      throw new Error(
        'Faltan ERP_USERNAME / ERP_PASSWORD: las herramientas de negocio necesitan credenciales de la API.',
      );
    }
    const res = await this.request(
      '/auth/login',
      { method: 'POST' },
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: config.tenantSlug,
          username: config.username,
          password: config.password,
        }),
      },
      true,
    );
    const body = (await res.json()) as {
      access_token?: string;
      accessToken?: string;
    };
    const token = body.access_token ?? body.accessToken;
    if (!token) throw new Error('El login no devolvió token');
    const cookies = res.headers.getSetCookie
      ? res.headers.getSetCookie().join('; ')
      : (res.headers.get('set-cookie') ?? '');
    const match = cookies.match(/XSRF-TOKEN=([^;]+)/);
    this.session = {
      token,
      xsrf: match?.[1] ? decodeURIComponent(match[1]) : '',
    };
    return this.session;
  }

  private async ensureSession(): Promise<Session> {
    return this.session ?? (await this.login());
  }

  /**
   * GET autenticado con reintento único ante 401 (token caducado) y timeout.
   * `unknown` es la cuenta de búsqueda/ids ya resueltos.
   */
  async get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    assertAllowedPath(path);
    const session = await this.ensureSession();
    const res = await this.request(
      path,
      { method: 'GET', query },
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.token}`,
          'X-XSRF-TOKEN': session.xsrf,
          Cookie: `XSRF-TOKEN=${encodeURIComponent(session.xsrf)}`,
          Accept: 'application/json',
        },
      },
    );
    return (await res.json()) as T;
  }

  private async request(
    path: string,
    meta: { method: string; query?: Record<string, unknown> },
    init: RequestInit,
    isLogin = false,
  ): Promise<Response> {
    const url = new URL(`${this.options.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(meta.query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.options.config.timeoutMs,
    );
    let res: Response;
    try {
      res = await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `No se pudo contactar la API del ERP en ${url.origin} (${meta.method} ${path}): ${reason}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 && !isLogin && this.session) {
      // Token caducado: una reintentona con login nuevo.
      this.session = null;
      await this.login();
      const retry = await this.ensureSession();
      const retryInit: RequestInit = {
        ...init,
        headers: {
          ...(init.headers as Record<string, string>),
          Authorization: `Bearer ${retry.token}`,
          'X-XSRF-TOKEN': retry.xsrf,
          Cookie: `XSRF-TOKEN=${encodeURIComponent(retry.xsrf)}`,
        },
      };
      res = await this.fetchImpl(url, {
        ...retryInit,
        signal: controller.signal,
      });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ErpApiError(
        `${meta.method} ${path} → ${res.status} ${body.slice(0, 300)}`,
        res.status,
        path,
        body,
      );
    }
    return res;
  }
}
