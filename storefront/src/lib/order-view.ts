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
  price: number;
  lineTotal: number;
  available: number;
}

/** `POST /storefront/quote`: `total` es subtotal + envio, **sin** impuestos. */
export interface QuoteView {
  city: {
    code: string;
    name: string;
    deliveryDays: number;
    freeShippingFrom: number | null;
  };
  currency: string;
  items: QuoteLine[];
  subtotal: number;
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
  lineTotal: number;
}

/** Pedido visto por la tienda: nunca costos ni cuentas del ERP. */
export interface OrderView {
  orderNumber: string;
  trackingCode: string | null;
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
  createdAt: string;
  items: OrderLine[];
}
