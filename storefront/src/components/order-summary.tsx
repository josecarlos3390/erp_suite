import Link from 'next/link';

import type { OrderLine, OrderView } from '@/lib/order-view';
import {
  deliveryTypeLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  statusLabel,
  TRACKING_NOTICE,
} from '@/lib/checkout';
import { formatMoney } from '@/lib/format';

interface OrderSummaryProps {
  order: OrderView;
  /** Nombre de la ciudad de entrega cuando la pagina lo conoce (opcional). */
  cityName?: string | undefined;
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
 * Se pintan **los numeros que devuelve el ERP**, sin recalcular nada en la
 * tienda: `subtotal` son las mercancias (con el descuento automatico de la empresa
 * ya aplicado, que es el que el canal cotizo), `shipping` el flete (que viaja como
 * una linea mas, `WEB-ENVIO`) y `tax` el impuesto que el motor del ERP sumo al
 * documento por encima de mercancias y envio. Las tres cifras suman el total por
 * construccion (`tax = total − subtotal − envio`): con el precio ya incluyendo el
 * impuesto, `tax` es cero porque va dentro del precio, cosa que decide la
 * configuracion fiscal de la empresa en el ERP, no la tienda.
 */
export function OrderSummary({ order, cityName }: OrderSummaryProps): JSX.Element {
  const paid = order.paymentStatus.toLowerCase() === 'paid';
  // El ERP publica `tax` como lo que el documento suma por encima de mercancias y
  // envio. Con la configuracion fiscal boliviana habitual (precio con el IVA incluido)
  // el impuesto va **dentro** del precio, asi que aparece en cero: el desglose no lo
  // inventa la tienda, sale del documento del ERP.
  const taxLabel = 'Impuesto aplicado por el ERP';

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
          {order.items.map((line: OrderLine) => (
            <li
              key={`${line.itemId}-${line.sku}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              data-testid="order-line"
              data-sku={line.sku}
            >
              <div className="flex flex-col">
                <span className="font-medium text-fg">{line.name}</span>
                <span className="text-xs text-fg-tertiary">
                  SKU {line.sku} · {line.quantity} × {formatMoney(line.price, order.currency)}
                  {line.discount > 0
                    ? ` · descuento −${formatMoney(line.discount, order.currency)}`
                    : ''}
                </span>
              </div>
              <span className="font-semibold text-fg" data-testid="order-line-total">
                {formatMoney(line.lineTotal, order.currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Desglose" className="rounded-lg border border-line bg-elevated p-4">
        <h2 className="text-sm font-semibold text-fg">Desglose</h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-fg-secondary">Subtotal (mercancias)</dt>
            <dd className="font-medium text-fg" data-testid="order-subtotal">
              {formatMoney(order.subtotal, order.currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-fg-secondary">Envio</dt>
            <dd className="font-medium text-fg" data-testid="order-shipping">
              {formatMoney(order.shipping, order.currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-fg-secondary">{taxLabel}</dt>
            <dd className="font-medium text-fg" data-testid="order-tax">
              {formatMoney(order.tax, order.currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2">
            <dt className="font-semibold text-fg">Total</dt>
            <dd className="text-lg font-bold text-fg" data-testid="order-total">
              {formatMoney(order.total, order.currency)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-fg-tertiary">
          El subtotal son las mercancias ya con los descuentos de la empresa (los aplica el canal
          del ERP al cotizar, asi que son los mismos que se cobraron). El impuesto lo calcula el
          motor del ERP con la configuracion fiscal de la empresa: cuando el precio del articulo ya
          lo trae incluido, el importe del impuesto aparece en cero porque va dentro del precio.
        </p>

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
