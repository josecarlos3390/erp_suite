import Link from 'next/link';

import type { OrderLine, OrderView } from '@/lib/order-view';
import {
  deliveryTypeLabel,
  invoicingModeLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  statusLabel,
  TRACKING_NOTICE,
} from '@/lib/checkout';
import { describeLineSku, formatMoney } from '@/lib/format';
import { TotalsBreakdown } from './totals-breakdown';

interface OrderSummaryProps {
  order: OrderView;
  /** Nombre de la ciudad de entrega cuando la pagina lo conoce (opcional). */
  cityName?: string | undefined;
}

/**
 * Tasa del impuesto cuando **todas** las lineas con impuesto comparten la misma: es la
 * unica que se puede rotular sin mentir en un pedido con tasas mixtas (`null` entonces).
 */
function taxRateOf(items: OrderLine[]): number | null {
  const rates = items
    .filter((line) => line.taxRate > 0)
    .map((line) => line.taxRate);
  if (rates.length === 0) return null;
  const [first] = rates;
  return rates.every((rate) => rate === first) ? (first ?? null) : null;
}

/** Progreso de la entrega del documento del ERP, en palabras del comprador. */
function deliveryLabel(status: string): string {
  switch (status) {
    case 'FULL':
      return 'entrega completa';
    case 'PARTIAL':
      return 'entrega parcial';
    default:
      return 'sin entregar';
  }
}

/** Progreso de la facturacion del documento del ERP. */
function invoiceLabel(status: string): string {
  switch (status) {
    case 'FULL':
      return 'facturado';
    case 'PARTIAL':
      return 'factura parcial';
    default:
      return 'sin facturar';
  }
}

/**
 * Desglose de un pedido del canal, compartido por la confirmacion
 * (`/pedido/[orderNumber]`) y el seguimiento (`/seguimiento`).
 *
 * Se pintan **los numeros que devuelve el ERP**, sin recalcular nada en la tienda: el
 * canal publica la mercancia sin impuestos, el impuesto y el descuento de la empresa tal
 * como quedaron en el documento del pedido de venta, mas la oferta de catalogo que la
 * tienda aplico (`listPrice` por linea). El desglose lo pinta `TotalsBreakdown`, el
 * **mismo** componente que usa el checkout, asi que las dos pantallas no pueden contar
 * cosas distintas.
 */
export function OrderSummary({ order, cityName }: OrderSummaryProps): JSX.Element {
  const paid = order.paymentStatus.toLowerCase() === 'paid';

  return (
    <div className="flex flex-col gap-4" data-testid="order-summary">
      <section
        aria-label="Datos del pedido"
        className="grid gap-3 rounded-lg border border-line bg-base p-4 sm:grid-cols-2"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            Numero de pedido
          </h2>
          <p className="text-lg font-bold text-fg" data-testid="order-number">
            {order.orderNumber}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            Codigo de seguimiento
          </h2>
          <p className="font-mono text-lg font-bold text-fg" data-testid="order-tracking-code">
            {order.trackingCode ?? '—'}
          </p>
        </div>
        <dl className="flex flex-col gap-1 text-sm">
          <dt className="text-fg-secondary">Estado</dt>
          <dd className="font-medium text-fg" data-testid="order-status">
            {statusLabel(order.status)}
          </dd>
          <dt className="mt-2 text-fg-secondary">Pago</dt>
          <dd className="font-medium text-fg" data-testid="order-payment-status">
            {paymentStatusLabel(order.paymentStatus)} ·{' '}
            {paymentMethodLabel(order.paymentMethod)}
          </dd>
          {/*
            F7: lo que el comprador eligio en el checkout, y con ello el documento que su
            cadena ya emitio («pagar ahora» factura el pedido al confirmarlo). Se publica tal
            cual: la tienda no deduce la modalidad del estado.
          */}
          <dt className="mt-2 text-fg-secondary">Facturacion</dt>
          <dd className="font-medium text-fg" data-testid="order-invoicing-mode">
            {invoicingModeLabel(order.webInvoicingMode)}
            {order.reserveInvoiceCode !== null
              ? ` · factura ${order.reserveInvoiceCode}`
              : ''}
          </dd>
          {order.paymentReference !== null ? (
            <>
              <dt className="mt-2 text-fg-secondary">Referencia del pago</dt>
              <dd className="font-medium text-fg" data-testid="order-payment-reference">
                {order.paymentReference}
              </dd>
            </>
          ) : null}
          {order.erp !== null ? (
            <>
              <dt className="mt-2 text-fg-secondary">Estado en el ERP</dt>
              <dd className="font-medium text-fg" data-testid="order-erp-state">
                {deliveryLabel(order.erp.deliveryStatus)} ·{' '}
                {invoiceLabel(order.erp.invoiceStatus)}
              </dd>
            </>
          ) : null}
        </dl>
        <dl className="flex flex-col gap-1 text-sm">
          <dt className="text-fg-secondary">Entrega</dt>
          <dd className="font-medium text-fg" data-testid="order-delivery-type">
            {deliveryTypeLabel(order.deliveryType)}
            {cityName !== undefined && cityName !== '' ? ` · ${cityName}` : ''}
          </dd>
          <dt className="mt-2 text-fg-secondary">Fecha</dt>
          <dd className="font-medium text-fg" data-testid="order-created-at">
            {new Date(order.createdAt).toLocaleDateString('es-BO', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </dd>
          {order.salesOrderCode !== null ? (
            <>
              <dt className="mt-2 text-fg-secondary">Pedido en el ERP</dt>
              <dd className="font-medium text-fg" data-testid="order-erp-code">
                {order.salesOrderCode}
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section aria-label="Productos del pedido" className="rounded-lg border border-line bg-base">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-fg">
          Productos y envio
        </h2>
        <ul className="divide-y divide-line">
          {order.items.map((line: OrderLine) => {
            // El flete viaja como una linea mas del documento: se especifica como envio (con
            // el articulo de servicio del ERP) para no pintarlo como un producto del pedido.
            const isShipping = line.itemId === order.shippingItemId;
            return (
            <li
              key={`${line.itemId}-${line.sku}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              data-testid={isShipping ? 'order-line-shipping' : 'order-line'}
              data-sku={line.sku}
            >
              <div className="flex flex-col">
                <span className="font-medium text-fg">
                  {isShipping ? `Envio · ${line.name}` : line.name}
                </span>
                <span className="text-xs text-fg-tertiary">
                  {describeLineSku(line.sku)} · {line.quantity} × {formatMoney(line.price, order.currency)}
                  {line.discount > 0
                    ? ` · descuento −${formatMoney(line.discount, order.currency)}`
                    : ''}
                </span>
              </div>
              <span className="font-semibold text-fg" data-testid="order-line-total">
                {formatMoney(line.lineTotal, order.currency)}
              </span>
            </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Desglose" className="rounded-lg border border-line bg-elevated p-4">
        <h2 className="text-sm font-semibold text-fg">Desglose</h2>
        <div className="mt-3">
          <TotalsBreakdown
            currency={order.currency}
            listSubtotal={order.offerDiscount > 0 ? order.listSubtotal : null}
            offerDiscount={order.offerDiscount}
            offerPct={order.offerPct}
            channelDiscount={order.channelDiscount}
            channelDiscountPct={order.channelDiscountPct}
            subtotal={order.subtotal}
            companyDiscount={order.companyDiscount}
            companyDiscountPct={order.companyDiscountPct}
            netSubtotal={order.netSubtotal}
            taxAmount={order.tax}
            taxRate={taxRateOf(order.items)}
            taxInclusive={order.taxInclusive}
            shipping={order.shipping}
            shippingNote={order.shipping === 0 ? 'no se cobra' : undefined}
            total={order.total}
            prefix="order"
          />
        </div>

        <p
          className={`mt-3 rounded-md border p-3 text-xs ${
            paid ? 'border-ok bg-ok-soft text-fg' : 'border-warn bg-warn-soft text-fg'
          }`}
          data-testid="order-payment-note"
        >
          {paid
            ? 'El ERP registro el pago de este pedido.'
            : 'El pago aun no figura conciliado en el ERP. La tienda confirma los datos de pago (transferencia, QR o contra entrega) por correo o WhatsApp con el numero de pedido.'}
        </p>
      </section>

      <p className="text-xs text-fg-secondary" data-testid="order-tracking-notice">
        {TRACKING_NOTICE}{' '}
        <Link href="/seguimiento" className="sf-link">
          Ir al seguimiento
        </Link>
        .
      </p>
    </div>
  );
}
