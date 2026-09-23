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
  /** Precio unitario del catalogo (oferta vigente o lista), antes del descuento. */
  price: number;
  /** Descuento automatico del ERP sobre `price`, en porcentaje (0 si no hay). */
  discountPct: number;
  /** Importe del descuento de la linea (0 si no hay). */
  discount: number;
  /** `price × quantity − discount`: lo que se cobra por la mercancia. */
  lineTotal: number;
  available: number;
}

/** `POST /storefront/quote`: `total` es subtotal − descuentos + envio, **sin** impuestos. */
export interface QuoteView {
  city: {
    code: string;
    name: string;
    deliveryDays: number;
    freeShippingFrom: number | null;
  };
  currency: string;
  items: QuoteLine[];
  /** Mercancia antes de descuentos (Σ `price × quantity`). */
  subtotal: number;
  /** Descuentos automaticos del ERP ya aplicados por el canal (0 si no hay). */
  discount: number;
  shipping: number;
  shippingCharged: boolean;
  freeShippingApplied: boolean;
  total: number;
}

export interface OrderLine {
  itemId: number;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  /** Descuento automatico del ERP aplicado a la linea (0 si no hubo). */
  discount: number;
  lineTotal: number;
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
  subtotal: number;
  shipping: number;
  /** Impuesto del documento (`total − subtotal − envio`), calculado por el ERP. */
  tax: number;
  total: number;
  salesOrderId: number | null;
  salesOrderCode: string | null;
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
