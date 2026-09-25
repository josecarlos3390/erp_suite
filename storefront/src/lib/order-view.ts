/**
 * Vistas del pedido y de la cotizacion tal como las publica el canal del ERP.
 *
 * Viven en un modulo **puro** (sin `server-only`) porque las necesitan los dos
 * lados: el cliente del canal en el servidor (`src/lib/erp.ts`) y los componentes
 * cliente del checkout y del seguimiento. Asi el navegador puede recibir y tipar
 * estas vistas **sin** importar el modulo que guarda la clave del canal (D10).
 *
 * Los tipos espejan el contrato del canal (`storefront.service.ts` del ERP). No se
 * inventan campos: si el ERP no lo devuelve, no existe aqui.
 */

export interface QuoteLine {
  itemId: number;
  sku: string;
  name: string;
  quantity: number;
  /**
   * Precio unitario efectivo de la tienda: el del ERP (oferta vigente o lista) con la
   * **promo del canal** ya aplicada, y antes del descuento de empresa.
   */
  price: number;
  /** Precio unitario del ERP (oferta incluida) **antes** de la promo del canal. */
  priceBeforeChannel: number;
  /** % de la promo del canal ya incluida en `price` (0 si no hay). */
  channelDiscountPct: number;
  /** Importe de la promo del canal en la linea (0 si no hay). */
  channelDiscount: number;
  /** Precio de **lista** del catalogo: mayor que `priceBeforeChannel` cuando hay oferta vigente. */
  listPrice: number;
  /** % de la oferta de catalogo ya incluida en `price` (0 si no hay). */
  offerPct: number;
  /** Importe de la oferta de catalogo en la linea (0 si no hay). */
  offerDiscount: number;
  /** Descuento automatico de la empresa sobre `price`, en porcentaje (0 si no hay). */
  discountPct: number;
  /** Importe del descuento de la linea (0 si no hay). */
  discount: number;
  /** `price × quantity − discount`: lo que se cobra por la mercancia. */
  lineTotal: number;
  /** Mercancia de la linea **sin impuestos**. */
  netTotal: number;
  /** Tasa del impuesto de la linea (0 si exento). */
  taxRate: number;
  /** `true` cuando el precio ya incluye el impuesto. */
  taxInclusive: boolean;
  /** Metodo de calculo del indicador del ERP (`BOLIVIA_SIN`, `STANDARD`, ...). */
  taxMethod: string;
  /** Impuesto de la linea. */
  taxAmount: number;
  /**
   * Existencia publicada por el ERP para la linea, o **`null` en una linea de
   * SERVICIO** (articulo no inventariable, F6/T227): un servicio se compra y se
   * cobra, pero no maneja existencia, asi que la tienda no puede toparlo por stock.
   */
  available: number | null;
}

/**
 * `POST /storefront/quote`: el desglose completo —oferta de catalogo, descuento de la
 * empresa, mercancia sin impuestos, impuesto, envio y **total a pagar**— calculado con el
 * mismo motor fiscal que el documento del ERP, asi que el importe cotizado es el cobrado.
 */
export interface QuoteView {
  city: {
    code: string;
    name: string;
    deliveryDays: number;
    freeShippingFrom: number | null;
  };
  currency: string;
  items: QuoteLine[];
  /** Mercancia a **precio de lista** (Σ `listPrice × quantity`). */
  listSubtotal: number;
  /** Oferta de catalogo ya incluida en `subtotal` (0 si no hay). */
  offerDiscount: number;
  /**
   * **% efectivo** de la oferta de catalogo sobre el precio de lista (0 si no hay). Lo
   * calcula el ERP: con varias lineas es la tasa del carrito, no la de un articulo suelto.
   */
  offerPct: number;
  /**
   * Promo del canal ya incluida (0 si no hay): es la capa que **solo** cobra la tienda
   * online —el POS y los documentos del ERP no la conocen—, encima del precio del ERP y
   * antes del descuento de la empresa.
   */
  channelDiscount: number;
  /** **% efectivo** de esa promo sobre el precio del ERP (lo calcula el ERP). */
  channelDiscountPct: number;
  /** Mercancia antes del descuento de la empresa (Σ `price × quantity`). */
  subtotal: number;
  /** Descuento de la empresa ya aplicado por el canal (0 si no hay). */
  discount: number;
  /** **% efectivo** de ese descuento sobre la mercancia (lo calcula el ERP). */
  companyDiscountPct: number;
  /** Mercancia **sin impuestos**. */
  netSubtotal: number;
  /** Impuesto total (mercancia + envio). */
  taxAmount: number;
  shipping: number;
  /**
   * Articulo de servicio con el que la ciudad cobra el envio (null si no lo cobra). El flete
   * viaja como una **linea mas** del documento: con esto el checkout lo especifica como envio
   * en vez de pintarlo como un producto.
   */
  shippingItem: { id: number; code: string; name: string } | null;
  shippingCharged: boolean;
  freeShippingApplied: boolean;
  /** **Total a pagar** (neto + impuesto): el total del documento del ERP. */
  total: number;
}

export interface OrderLine {
  itemId: number;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  /** Precio de **lista** de la linea cuando se vendio con oferta (`null` si no hubo). */
  listPrice: number | null;
  /** Importe de la oferta de catalogo de la linea (0 si no hubo). */
  offerDiscount: number;
  /** % de la promo del canal con la que se vendio la linea (`null` si no hubo). */
  channelDiscountPct: number | null;
  /** Importe de esa promo en la linea (0 si no hubo). */
  channelDiscount: number;
  /** Descuento de la empresa aplicado a la linea (0 si no hubo). */
  discount: number;
  lineTotal: number;
  /** Mercancia de la linea **sin impuestos**, del documento del ERP. */
  netTotal: number;
  /** Tasa del impuesto de la linea, del documento del ERP (0 si exento). */
  taxRate: number;
  /** Impuesto de la linea, del documento del ERP. */
  taxAmount: number;
}

/** Pedido visto por la tienda: nunca costos ni cuentas del ERP. */
export interface OrderView {
  orderNumber: string;
  trackingCode: string | null;
  /** Estado derivado del documento del ERP (no de la copia de la tienda). */
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryType: string;
  currency: string;
  /** Mercancia del canal tal como se cobro (con el impuesto incluido si lo es). */
  subtotal: number;
  shipping: number;
  /**
   * Articulo con el que se cobro el envio (null si no se cobro): identifica **cual** de las
   * lineas del pedido es el flete, para especificarla como envio en la confirmacion.
   */
  shippingItemId: number | null;
  /** Impuesto del **documento del ERP** (el mismo que ve el back office). */
  tax: number;
  /** Mercancia **sin impuestos** segun el documento del ERP. */
  netSubtotal: number;
  /** Descuento de la empresa aplicado por el documento del ERP. */
  companyDiscount: number;
  /** **% efectivo** de ese descuento sobre la mercancia (lo calcula el ERP). */
  companyDiscountPct: number;
  /** Oferta de catalogo que aplico la tienda (0 si no hubo). */
  offerDiscount: number;
  /** **% efectivo** de esa oferta sobre el precio de lista (lo calcula el ERP). */
  offerPct: number;
  /** Promo del canal congelada en el pedido (0 si no hubo). */
  channelDiscount: number;
  /** **% efectivo** de esa promo sobre el precio del ERP (lo calcula el ERP). */
  channelDiscountPct: number;
  /** Mercancia a **precio de lista** del catalogo (Σ lineas). */
  listSubtotal: number;
  /** `true` cuando el precio ya incluia el impuesto (el documento lo extrae del precio). */
  taxInclusive: boolean;
  total: number;
  salesOrderId: number | null;
  salesOrderCode: string | null;
  /**
   * F7: **modalidad de facturacion que eligio el comprador** y la factura de **reserva** que
   * su cadena emitio (null en «pagar al recibir», donde el documento nace de la entrega).
   */
  webInvoicingMode: string;
  reserveInvoiceCode: string | null;
  /** Referencia del pago offline que anoto el comprador (null mientras no la anote). */
  paymentReference: string | null;
  paymentReferenceAt: string | null;
  /** Estado crudo del documento del ERP (null si el pedido no tiene documento). */
  erp: {
    status: string;
    paymentStatus: string;
    salesOrderStatus: string;
    deliveryStatus: string;
    invoiceStatus: string;
  } | null;
  createdAt: string;
  items: OrderLine[];
}
