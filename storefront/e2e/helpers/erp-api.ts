/**
 * Acceso a la API del canal del ERP desde las pruebas.
 *
 * Los casos NO codifican slugs ni articulos a mano: descubren el dato real con
 * estas funciones y despues comprueban que la tienda muestre lo mismo. Si la API
 * no responde, la prueba falla con un mensaje claro en vez de saltarse.
 */

const ERP_API_URL = (
  process.env.ERP_API_URL ?? "http://localhost:3001"
).replace(/\/+$/, "");
const STOREFRONT_API_KEY =
  process.env.STOREFRONT_API_KEY ?? "tienda-dev-key-cambiar";

export const MAX_PAGE_SIZE = 48;
export const CATEGORY_PAGE_SIZE = 24;

export interface ApiProduct {
  itemId: number;
  slug: string;
  name: string;
  sku: string;
  brand: string | null;
  brandCode: string | null;
  /** Vendedor de la publicacion (F6): «Vendido por …» y el codigo con el que se filtra. */
  seller: string | null;
  sellerCode: string | null;
  sellerLogoUrl: string | null;
  /** Precio efectivo de la tienda: el del ERP con la **promo del canal** ya aplicada. */
  price: number;
  /** Precio del ERP (oferta incluida) **antes** de la promo del canal (F8.2). */
  priceBeforeChannel: number;
  /** Precio de lista del maestro (el «antes» de la tarjeta). */
  listPrice: number;
  salePrice: number | null;
  discountPct: number | null;
  /** % de la promo del canal ya incluida en `price` (`null` si no hay). */
  channelDiscountPct: number | null;
  currency: string;
  image: string | null;
  images: string[];
  availability: {
    warehouseId: number | null;
    available: number;
    inStock: boolean;
  };
  category: { id: number; slug: string; name: string } | null;
  specs: { name: string; value: string; groupName: string | null }[];
  /**
   * Resenas **aprobadas** (F6). Solo las publica la **ficha**: el catalogo no las trae, asi
   * que en las filas del listado llegan `undefined`.
   */
  rating?: { average: number; count: number };
  reviews?: Array<{
    id: number;
    rating: number;
    title: string | null;
    comment: string;
    buyer: string;
    createdAt: string;
  }>;
  /** `true` cuando la publicacion **es** un servicio (articulo no inventariable, F6/T227). */
  isService?: boolean;
  /**
   * **Servicio tecnico** (F6/T228): `true` cuando la publicacion tiene **vendedor**, que es
   * quien atiende la solicitud; la ficha ofrece el formulario solo si el canal lo dice.
   */
  canRequestService?: boolean;
  /**
   * **Servicios publicados en la categoria** del articulo (F6/T227): lo que la ficha ofrece
   * como extra. Solo la ficha los trae; la ficha de un servicio no se ofrece a si misma.
   */
  services?: Array<{
    itemId: number;
    slug: string;
    name: string;
    shortDescription: string | null;
    price: number;
    currency: string;
    category: { id: number; slug: string; name: string } | null;
  }>;
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

/**
 * Tienda publicada por la ciudad para **retiro** (F5). El canal la identifica por su
 * `code`: la vista del canal no expone ids internos, igual que pasa con `city.code`.
 */
export interface ApiCityStore {
  code: string;
  name: string;
  kind: "BRANCH" | "WAREHOUSE";
  address: string | null;
  phone: string | null;
  openingHours: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
  pickupEnabled: boolean;
  branchId: number | null;
  warehouseId: number | null;
}

/** Tienda de retiro tal como la publica **el pedido** ya creado. */
export interface ApiPickupStore {
  code: string;
  name: string;
  address: string | null;
  openingHours: string | null;
  phone: string | null;
  mapUrl: string | null;
}

export interface ApiCity {
  code: string;
  name: string;
  deliveryDays: number;
  shippingCost: number;
  freeShippingFrom: number | null;
  warehouse: { id: number; code: string; name: string } | null;
  /**
   * Sucursal de despacho de la ciudad. Ademas de su identidad publica la **ubicacion** (T233):
   * direccion, telefono, horario, coordenadas, enlace del mapa y si ofrece retiro en tienda.
   */
  branch: {
    id: number;
    code: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    openingHours?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    mapUrl?: string | null;
    pickupEnabled?: boolean;
  } | null;
  /** Tiendas de la ciudad, con la herencia del maestro ya resuelta por el canal. */
  stores?: ApiCityStore[];
}

/** Cotizacion del canal (`POST /storefront/quote`), con su desglose fiscal (T197). */
export interface ApiQuote {
  city: {
    code: string;
    name: string;
    deliveryDays: number;
    freeShippingFrom: number | null;
  };
  currency: string;
  items: Array<{
    itemId: number;
    sku: string;
    name: string;
    quantity: number;
    price: number;
    /** Precio de lista del catalogo (mayor que `price` si hay oferta vigente). */
    listPrice: number;
    /** Precio del ERP antes de la promo del canal (F8.2). */
    priceBeforeChannel: number;
    /** Importe de la promo del canal en la linea (0 si no hay). */
    channelDiscount: number;
    /** % de la promo del canal aplicado a la linea (0 si no hay). */
    channelDiscountPct: number;
    offerPct: number;
    offerDiscount: number;
    /** Descuento automatico del ERP sobre `price`, en porcentaje (0 si no hay). */
    discountPct: number;
    /** Importe del descuento de la linea (0 si no hay). */
    discount: number;
    lineTotal: number;
    /** Mercancia de la linea sin impuestos y su impuesto (motor del ERP). */
    netTotal: number;
    taxRate: number;
    taxInclusive: boolean;
    taxMethod: string;
    taxAmount: number;
    available: number;
  }>;
  /** Mercancia antes de descuentos. */
  subtotal: number;
  /** Descuentos automaticos del ERP ya aplicados por el canal. */
  discount: number;
  /** % efectivo del descuento de la empresa, calculado por el ERP (T200). */
  companyDiscountPct: number;
  /** % efectivo de la oferta de catalogo sobre el precio de lista (T200). */
  offerPct: number;
  /** Promo del canal incluida en el precio (0 si no hay; F8.2). */
  channelDiscount: number;
  /** % efectivo de esa promo sobre el precio del ERP (lo calcula el ERP). */
  channelDiscountPct: number;
  /** Mercancia + envio **sin impuestos**. */
  netSubtotal: number;
  /** Impuesto total (mercancia + envio), calculado por el motor del ERP. */
  taxAmount: number;
  shipping: number;
  shippingCharged: boolean;
  freeShippingApplied: boolean;
  /** Total a pagar: `netSubtotal + taxAmount` (el total del documento). */
  total: number;
  /** Tienda de retiro elegida (F5); `null` en entrega a domicilio. */
  pickupStore?: ApiPickupStore | null;
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
  /** Impuesto del documento del ERP. */
  tax: number;
  /** Mercancia sin impuestos, descuento de la empresa y oferta de catalogo (T197). */
  netSubtotal: number;
  companyDiscount: number;
  /** % efectivo del descuento de la empresa, calculado por el ERP (T200). */
  companyDiscountPct: number;
  offerDiscount: number;
  /** % efectivo de la oferta de catalogo sobre el precio de lista (T200). */
  offerPct: number;
  listSubtotal: number;
  taxInclusive: boolean;
  total: number;
  /**
   * Articulo con el que el pedido cobro el envio (T200): el flete viaja como una
   * linea mas del documento y el canal publica cual es para que la tienda la
   * rotule como «envio» y no como un producto.
   */
  shippingItemId: number | null;
  salesOrderId: number | null;
  salesOrderCode: string | null;
  /** F7: modalidad elegida por el comprador y la reserva de su cadena (null hasta el cobro, §35). */
  webInvoicingMode: string;
  reserveInvoiceCode: string | null;
  /** Referencia del pago offline que anoto el comprador (null mientras no la anote). */
  paymentReference: string | null;
  paymentReferenceAt: string | null;
  /** Tienda de retiro del pedido (F5); `null` cuando la entrega es a domicilio. */
  pickupStore?: ApiPickupStore | null;
  /** Estado crudo del documento del ERP del que se deriva el del comprador. */
  erp: {
    status: string;
    paymentStatus: string;
    salesOrderStatus: string;
    deliveryStatus: string;
    invoiceStatus: string;
  } | null;
  createdAt: string;
  items: Array<{
    itemId: number;
    sku: string;
    name: string;
    quantity: number;
    price: number;
    listPrice: number | null;
    offerDiscount: number;
    discount: number;
    lineTotal: number;
    /** Neto e impuesto de la linea segun el documento del ERP. */
    netTotal: number;
    taxRate: number;
    taxAmount: number;
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
  deliveryType?: "HOME" | "STORE";
  /** Tienda de retiro (obligatoria con `deliveryType: "STORE"`); es su `code`. */
  pickupStoreCode?: string;
  paymentMethod?: "TRANSFER" | "QR" | "CASH_ON_DELIVERY" | "STORE_PICKUP";
  /** F7: modalidad de facturacion que elige el comprador (el canal por defecto: al recibir). */
  webInvoicingMode?: "PAY_NOW" | "PAY_ON_DELIVERY";
  items: Array<{ itemId: number; quantity: number }>;
  customer?: ApiOrderCustomer;
  notes?: string;
}

async function apiGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${ERP_API_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-storefront-key": STOREFRONT_API_KEY,
    },
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
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-storefront-key": STOREFRONT_API_KEY,
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
      if (typeof parsed === "object" && parsed !== null) {
        const value = (parsed as Record<string, unknown>)["message"];
        if (typeof value === "string" && value.trim() !== "") message = value;
        else if (Array.isArray(value) && value.length > 0)
          message = value.join("; ");
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
  return apiGet<ApiCatalogPage>("/storefront/catalog", params);
}

export async function getCategories(): Promise<ApiCategory[]> {
  return apiGet<ApiCategory[]>("/storefront/categories");
}

export async function getCities(): Promise<ApiCity[]> {
  return apiGet<ApiCity[]>("/storefront/cities");
}

export async function getProduct(
  slug: string,
  city: string,
): Promise<ApiProduct> {
  return apiGet<ApiProduct>(
    `/storefront/products/${encodeURIComponent(slug)}`,
    { city },
  );
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
  const emptyCityName =
    cities.find((city) => city.code === emptyCity)?.name ?? emptyCity;

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
  pickup?: { deliveryType?: "HOME" | "STORE"; pickupStoreCode?: string },
): Promise<ApiQuote> {
  return apiPost<ApiQuote>("/storefront/quote", {
    cityCode,
    items,
    ...(pickup?.deliveryType !== undefined
      ? { deliveryType: pickup.deliveryType }
      : {}),
    ...(pickup?.pickupStoreCode !== undefined
      ? { pickupStoreCode: pickup.pickupStoreCode }
      : {}),
  });
}

/**
 * Una tienda de **retiro** de la ciudad, descubierta con el canal (nunca codificada a
 * mano): el caso mide contra el mismo dato con el que el checkout ofrece elegir.
 *
 * El pedido sale del **almacen de esa tienda** (F5), asi que una tienda sin existencia no
 * puede cotizar el carrito (medido: «Sin existencia suficiente … disponible 0»). Se
 * devuelve la **primera que el canal acepta** con ese carrito, que es lo que un comprador
 * haria al ver el error; las que fallaron se reportan si ninguna sirve.
 */
export async function findPickupStore(
  cityCode: string,
  items: Array<{ itemId: number; quantity: number }>,
): Promise<{ code: string; name: string; cityName: string; cityCode: string }> {
  const cities = await getCities();
  const city = cities.find((candidate) => candidate.code === cityCode);
  if (city === undefined) {
    throw new Error(`El canal no publica la ciudad ${cityCode}.`);
  }
  const candidates = (city.stores ?? []).filter(
    (candidate) => candidate.pickupEnabled,
  );
  if (candidates.length === 0) {
    throw new Error(
      `La ciudad ${cityCode} no publica ninguna tienda con retiro (pickupEnabled): el caso necesita una para medir.`,
    );
  }

  const rejected: string[] = [];
  for (const store of candidates) {
    try {
      await quote(cityCode, items, {
        deliveryType: "STORE",
        pickupStoreCode: store.code,
      });
      return {
        code: store.code,
        name: store.name,
        cityName: city.name,
        cityCode: city.code,
      };
    } catch (error) {
      rejected.push(
        `${store.code}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  throw new Error(
    `Ninguna tienda con retiro de ${cityCode} puede cotizar el carrito del caso:\n${rejected.join("\n")}`,
  );
}

/** `POST /storefront/orders` — crea el pedido (idempotente por clave). */
export async function placeOrder(input: ApiOrderInput): Promise<ApiOrder> {
  return apiPost<ApiOrder>("/storefront/orders", {
    idempotencyKey: input.idempotencyKey,
    cityCode: input.cityCode,
    deliveryType: input.deliveryType ?? "HOME",
    paymentMethod: input.paymentMethod ?? "TRANSFER",
    items: input.items,
    customer: input.customer ?? {},
    ...(input.pickupStoreCode !== undefined
      ? { pickupStoreCode: input.pickupStoreCode }
      : {}),
    ...(input.webInvoicingMode !== undefined
      ? { webInvoicingMode: input.webInvoicingMode }
      : {}),
  });
}

/**
 * `GET /storefront/tracking` — `null` cuando el canal responde 404.
 *
 * El numero de pedido **solo no basta** (decision del usuario, 2026-09-29): hay que enviar
 * el correo del pedido o su **codigo de seguimiento**. Antes, `?order=WEB-1` sin credencial
 * devolvia 200 con las lineas y los importes, y los numeros son secuenciales, asi que las
 * ventas web eran enumerables.
 */
export async function trackOrder(
  order: string,
  proof: { email?: string; code?: string } = {},
): Promise<ApiOrder | null> {
  const url = new URL(`${ERP_API_URL}/storefront/tracking`);
  url.searchParams.set("order", order);
  if (proof.email !== undefined) url.searchParams.set("email", proof.email);
  if (proof.code !== undefined) url.searchParams.set("code", proof.code);
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-storefront-key": STOREFRONT_API_KEY,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `El canal del ERP respondio ${response.status} en /storefront/tracking.`,
    );
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
export async function findShippableProduct(
  cityCode: string,
): Promise<ShippableCase> {
  const [cities, page] = await Promise.all([
    getCities(),
    getCatalog({ city: cityCode, sort: "price_asc", limit: MAX_PAGE_SIZE }),
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

export interface DiscountedCase {
  slug: string;
  name: string;
  itemId: number;
  /** Precio de catalogo de la tienda, **antes** del descuento del ERP. */
  price: number;
  /** Descuento automatico del ERP que publica la cotizacion. */
  discountPct: number;
  discount: number;
  /** Mercancia a cobrar (`price − discount`). */
  lineTotal: number;
  cityCode: string;
  cityName: string;
  shipping: number;
  quoteTotal: number;
}

/**
 * Descubre un articulo publicado al que el ERP le aplique un **descuento automatico**
 * (grupo de articulos, acuerdo del tercero o lista) cotizandolo de verdad.
 *
 * Es la unica forma honesta de montar el caso: el descuento es configuracion del ERP
 * —no de la tienda—, asi que no se puede deducir del catalogo; se pregunta al canal,
 * que es el mismo endpoint que usa el checkout. Si el ERP no tiene ningun descuento
 * configurado, la prueba falla con un mensaje claro en vez de saltarse.
 */
export async function findDiscountedProduct(
  cityCode: string,
): Promise<DiscountedCase> {
  const [pages, cities] = await Promise.all([
    Promise.all(
      [1, 2, 3].map((page) =>
        getCatalog({
          city: cityCode,
          limit: MAX_PAGE_SIZE,
          page,
          sort: "price_asc",
        }),
      ),
    ),
    getCities(),
  ]);
  const cityName =
    cities.find((city) => city.code === cityCode)?.name ?? cityCode;

  for (const page of pages) {
    for (const product of page.data) {
      if (!product.availability.inStock) continue;
      const result = await quote(cityCode, [
        { itemId: product.itemId, quantity: 1 },
      ]).catch(() => null);
      const line = result?.items[0];
      if (result === null || line === undefined || line.discount <= 0) continue;
      return {
        slug: product.slug,
        name: product.name,
        itemId: product.itemId,
        price: line.price,
        discountPct: line.discountPct,
        discount: line.discount,
        lineTotal: line.lineTotal,
        cityCode,
        cityName,
        shipping: result.shipping,
        quoteTotal: result.total,
      };
    }
  }

  throw new Error(
    `El ERP no tiene ningun descuento automatico configurado para el catalogo de ${cityCode}: ` +
      "la prueba necesita uno para medir que la tienda cotiza y cobra lo mismo.",
  );
}

export interface OfferCase {
  slug: string;
  name: string;
  itemId: number;
  /** Precio de lista del catalogo (antes de la oferta). */
  listPrice: number;
  /** Precio efectivo con la oferta vigente. */
  price: number;
  offerPct: number;
  offerDiscount: number;
  /** Descuento de la empresa que se aplique **ademas** de la oferta (0 si no hay). */
  discountPct: number;
  discount: number;
  lineTotal: number;
  cityCode: string;
  cityName: string;
  shipping: number;
  netSubtotal: number;
  taxAmount: number;
  quoteTotal: number;
}

/**
 * Descubre un articulo publicado con **oferta de catalogo vigente** (`Item.salePrice`)
 * cotizandolo de verdad: el precio de lista y la oferta son datos del ERP, asi que se
 * preguntan al canal en vez de deducirlos del catalogo. Si ningun articulo tiene oferta
 * vigente, la prueba falla con un mensaje claro en vez de saltarse.
 */
export async function findOfferProduct(cityCode: string): Promise<OfferCase> {
  const [pages, cities] = await Promise.all([
    Promise.all(
      [1, 2, 3].map((page) =>
        getCatalog({
          city: cityCode,
          limit: MAX_PAGE_SIZE,
          page,
          sort: "price_asc",
        }),
      ),
    ),
    getCities(),
  ]);
  const cityName =
    cities.find((city) => city.code === cityCode)?.name ?? cityCode;

  for (const page of pages) {
    for (const product of page.data) {
      if (!product.availability.inStock) continue;
      const result = await quote(cityCode, [
        { itemId: product.itemId, quantity: 1 },
      ]).catch(() => null);
      const line = result?.items[0];
      if (result === null || line === undefined || line.offerDiscount <= 0)
        continue;
      return {
        slug: product.slug,
        name: product.name,
        itemId: product.itemId,
        listPrice: line.listPrice,
        price: line.price,
        offerPct: line.offerPct,
        offerDiscount: line.offerDiscount,
        discountPct: line.discountPct,
        discount: line.discount,
        lineTotal: line.lineTotal,
        cityCode,
        cityName,
        shipping: result.shipping,
        netSubtotal: result.netSubtotal,
        taxAmount: result.taxAmount,
        quoteTotal: result.total,
      };
    }
  }

  throw new Error(
    `El ERP no tiene ningun articulo con oferta de catalogo vigente en ${cityCode}: ` +
      "la prueba necesita uno para medir como la tienda explica la oferta.",
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
        getCatalog({
          city: emptyCity,
          limit: MAX_PAGE_SIZE,
          page,
          sort: "price_asc",
        }),
      ),
    ),
    getCities(),
  ]);
  const emptyCityName =
    cities.find((city) => city.code === emptyCity)?.name ?? emptyCity;
  const sellableCityName =
    cities.find((city) => city.code === sellableCity)?.name ?? sellableCity;

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
      const sellable = await quote(sellableCity, [
        { itemId: product.itemId, quantity: 1 },
      ]).catch(() => null);
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

// ─────────────────────────────────────────────────────────────────────────────
// Cara **administrativa** del ERP (back office) — para PREPARAR datos en las pruebas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La **promo del canal** (`ItemWeb.channelDiscountPct`, D21/F8.2) se configura desde el
 * back office, no desde la tienda: aqui se hace por el API real del ERP (login de admin +
 * `PATCH /web-promotions/:itemId`) porque la prueba tiene que medir el efecto de una
 * configuracion **de verdad**, no un mock.
 *
 * Con `Authorization: Bearer` el ERP no exige el doble envio de la cookie CSRF (su
 * middleware lo exime, igual que al canal con `x-storefront-key`), asi que la prueba no
 * necesita navegador para administrar.
 */
export interface ApiWebPromotion {
  itemId: number;
  sku: string;
  name: string;
  slug: string;
  listPrice: number;
  price: number;
  offerPct: number;
  channelDiscountPct: number | null;
  channelDiscountFrom: string | null;
  channelDiscountTo: string | null;
  channelDiscountActive: boolean;
  channelPrice: number;
}

const ERP_ADMIN_USER = process.env.ERP_ADMIN_USER ?? "admin";
const ERP_ADMIN_PASSWORD = process.env.ERP_ADMIN_PASSWORD ?? "admin123";
/** El login del ERP identifica la **empresa** por su slug (el JWT acuña el `tenantId`). */
const ERP_ADMIN_TENANT = process.env.ERP_ADMIN_TENANT ?? "default";

/** Login del back office: devuelve el JWT para llamar a los endpoints autenticados. */
export async function erpAdminLogin(): Promise<string> {
  const response = await fetch(`${ERP_API_URL}/auth/login`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      tenantSlug: ERP_ADMIN_TENANT,
      username: ERP_ADMIN_USER,
      password: ERP_ADMIN_PASSWORD,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `El login del ERP respondio ${response.status}. Verificar la API en ${ERP_API_URL} ` +
        `y las credenciales ERP_ADMIN_USER/ERP_ADMIN_PASSWORD/ERP_ADMIN_TENANT. ${raw}`,
    );
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("El login del ERP no devolvio access_token.");
  }
  return body.access_token;
}

async function adminPatch<T>(
  token: string,
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${ERP_API_URL}${path}`, {
    method: "PATCH",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`El ERP respondio ${response.status} en ${path}: ${raw}`);
  }
  return (await response.json()) as T;
}

/**
 * Fija el descuento del canal de un articulo publicado. `pct` en `0` **quita** la promo
 * (y su vigencia), que es como las pruebas dejan el dato limpio al terminar.
 */
export async function setChannelPromotion(
  token: string,
  itemId: number,
  pct: number,
): Promise<ApiWebPromotion> {
  return adminPatch<ApiWebPromotion>(token, `/web-promotions/${itemId}`, {
    channelDiscountPct: pct,
  });
}

/** Un tipo de cambio tal como lo publica el ERP. */
interface ApiExchangeRate {
  id: number;
  date: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
}

/**
 * **Provisiona el tipo de cambio de HOY si falta** (gate funcional, §36).
 *
 * El ERP lo **exige** para entregar y contabilizar, y la empresa lo **teclea a mano cada día**
 * (decisión del usuario, 2026-10-01): sin él, el gate funcional se caía por un requisito del
 * **entorno** —«No existe el tipo de cambio del día entre BOB y USD»— y no por el código. Aquí se
 * crea con el valor del **último tipo de cambio de ese par** (lo que haría una persona) y el
 * `teardown` del arnés lo revierte, porque restaura la base entera: la suite no deja configuración
 * de más.
 *
 * **El día es el del TENANT, no el de UTC** (medido el 2026-10-01 a las 20:28 de Bolivia, con UTC ya
 * en el 2026-10-02): el ERP resuelve el día con `Tenant.timeZone` (`America/La_Paz`) y el helper
 * usaba `new Date().toISOString()`, así que provisionaba el tipo de cambio del **día siguiente** y
 * el caso de las reseñas volvía a caer con el mismo 400 por la noche. La zona se pregunta al ERP
 * (`GET /settings`), no se codifica.
 */
export async function ensureTodayExchangeRate(
  pair: { from: string; to: string } = { from: "USD", to: "BOB" },
): Promise<{ created: boolean; rate: number | null; date: string }> {
  const token = await erpAdminLogin();
  const tenantDay = await tenantToday(token);
  const existing = await adminGet<{ data: ApiExchangeRate[]; total: number }>(
    token,
    `/exchange-rates?fromCurrency=${pair.from}&toCurrency=${pair.to}` +
      `&dateFrom=${tenantDay}&dateTo=${tenantDay}&limit=1`,
  );
  if (Number(existing.total) > 0) {
    return { created: false, rate: Number(existing.data[0]?.rate ?? 0), date: tenantDay };
  }
  const latest = await adminGet<ApiExchangeRate | null>(
    token,
    `/exchange-rates/latest?from=${pair.from}&to=${pair.to}`,
  );
  if (latest === null || !Number.isFinite(Number(latest.rate))) {
    return { created: false, rate: null, date: tenantDay };
  }
  await adminPost(token, "/exchange-rates", {
    date: tenantDay,
    fromCurrency: pair.from,
    toCurrency: pair.to,
    rate: Number(latest.rate),
  });
  return { created: true, rate: Number(latest.rate), date: tenantDay };
}

/** Zona horaria del tenant tal como la publica el ERP (default declarado del backend). */
const DEFAULT_TENANT_TIME_ZONE = "America/La_Paz";

/**
 * **El día del tenant** (`YYYY-MM-DD`): el mismo criterio con el que el ERP resuelve la fecha del
 * documento (`Tenant.timeZone`), porque el tipo de cambio y los correlativos se evalúan contra él.
 * Si el ERP no publica la zona se usa la del default del backend y se avisa, en vez de caer a UTC.
 */
async function tenantToday(token: string): Promise<string> {
  let timeZone = DEFAULT_TENANT_TIME_ZONE;
  try {
    const settings = await adminGet<{ timeZone?: string }>(token, "/settings");
    if (typeof settings.timeZone === "string" && settings.timeZone.trim() !== "") {
      timeZone = settings.timeZone.trim();
    }
  } catch {
    // Sin `/settings` el gate no se rompe: se usa la zona por defecto del backend.
  }
  // `en-CA` formatea como `YYYY-MM-DD`, que es el formato que espera `dateFrom`/`date`.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** `POST` autenticado contra el ERP (mismo contrato de errores que `adminPatch`). */
async function adminPost<T>(
  token: string,
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${ERP_API_URL}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`El ERP respondio ${response.status} en ${path}: ${raw}`);
  }
  return (await response.json()) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resenas (F6): el canal las acepta con un pedido **entregado**, asi que la prueba
// tiene que **entregar** el pedido de verdad antes de escribirlas
// ─────────────────────────────────────────────────────────────────────────────

/** Resena tal como la devuelve el canal al aceptarla (nace **pendiente**). */
export interface ApiReviewSubmission {
  itemId: number;
  slug: string;
  rating: number;
  title: string | null;
  comment: string;
  buyer: string;
  status: string;
  resubmitted: boolean;
  message: string;
}

/** Escribe una resena **por el canal** (el mismo endpoint que usa el puente de la tienda). */
export async function submitReview(input: {
  order: string;
  email: string;
  slug: string;
  rating: number;
  title?: string;
  comment: string;
  name?: string;
}): Promise<ApiReviewSubmission> {
  return apiPost<ApiReviewSubmission>("/storefront/reviews", input);
}

/** Resena en la cola de moderacion del back office (`GET /reviews`). */
export interface ApiReviewRow {
  id: number;
  itemId: number;
  itemSku: string;
  status: string;
  rating: number;
  buyerEmail: string;
  buyerLabel: string;
  title: string | null;
  comment: string;
}

async function adminGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${ERP_API_URL}${path}`, {
    headers: { accept: "application/json", authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`El ERP respondio ${response.status} en ${path}`);
  }
  return (await response.json()) as T;
}

/** Busca la resena de un comprador en la cola (para poder moderarla en la prueba). */
export async function findReviewByBuyer(
  token: string,
  email: string,
): Promise<ApiReviewRow> {
  const page = await adminGet<{ data: ApiReviewRow[] }>(
    token,
    `/reviews?search=${encodeURIComponent(email)}`,
  );
  const found = page.data.find((row) => row.buyerEmail === email);
  if (!found) {
    throw new Error(
      `La resena de ${email} no aparece en la cola de moderacion del ERP.`,
    );
  }
  return found;
}

/**
 * Aprueba o rechaza una resena con el `PATCH` real de la pantalla de moderacion. Solo las
 * **aprobadas** se publican en la ficha: es lo que mide el caso de las resenas.
 */
export async function moderateReview(
  token: string,
  id: number,
  status: "APPROVED" | "REJECTED",
): Promise<ApiReviewRow> {
  return adminPatch<ApiReviewRow>(token, `/reviews/${id}/status`, { status });
}

/**
 * **Entrega completa** del pedido con el flujo real de Ventas: la resena exige un pedido
 * `DELIVERED` (el estado derivado del documento, T218/T221), asi que la prueba no puede
 * inventarse el estado — tiene que sacar la mercancia.
 *
 * La linea de **envio** se salta a proposito: es un servicio que se factura y no se entrega
 * (la misma regla que el progreso del pedido).
 */
export async function deliverOrderFully(
  token: string,
  order: ApiOrder,
  city: ApiCity,
  today: string,
): Promise<void> {
  if (order.salesOrderId === null) {
    throw new Error(`El pedido ${order.orderNumber} no tiene pedido de venta.`);
  }
  if (city.branch === null || city.warehouse === null) {
    throw new Error(
      `La ciudad ${city.code} no tiene sucursal/almacen de despacho: no se puede entregar.`,
    );
  }
  const salesOrder = await adminGet<{
    id: number;
    items: Array<{ id: number; itemId: number; quantity: number }>;
  }>(token, `/sales-orders/${order.salesOrderId}`);
  const goods = salesOrder.items.filter(
    (line) => line.itemId !== order.shippingItemId,
  );
  if (goods.length === 0) {
    throw new Error(
      `El pedido ${order.orderNumber} no tiene mercancia que entregar.`,
    );
  }

  const response = await fetch(
    `${ERP_API_URL}/delivery-orders/from-order/${order.salesOrderId}`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: today,
        postingDate: today,
        branchId: city.branch.id,
        warehouseId: city.warehouse.id,
        items: goods.map((line) => ({
          orderItemId: line.id,
          quantity: Number(line.quantity),
        })),
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `El ERP no pudo entregar el pedido ${order.orderNumber}: ${response.status} ${raw}`,
    );
  }
}
