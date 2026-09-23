import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { OrderSummary } from '@/components/order-summary';
import { PaymentReferenceForm } from '@/components/payment-reference-form';
import { getTracking } from '@/lib/erp';

export const metadata: Metadata = {
  title: 'Confirmacion del pedido',
  description: 'Numero de pedido, codigo de seguimiento y desglose de tu compra.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface OrderPageProps {
  params: { orderNumber: string };
}

/**
 * Confirmacion del pedido (`/pedido/[orderNumber]`).
 *
 * Se lee del canal **desde el servidor** (`GET /storefront/tracking?order=`), con
 * el numero de pedido y sin correo: es la pantalla inmediatamente posterior a la
 * compra, no una consulta publica —para consultar despues esta `/seguimiento`, que
 * si puede pedir el correo—. Si el pedido no existe (o el numero esta mal), la
 * pagina responde 404 en vez de inventar un estado.
 */
export default async function OrderPage({ params }: OrderPageProps): Promise<JSX.Element> {
  const orderNumber = decodeURIComponent(params.orderNumber).trim();
  const order = orderNumber === '' ? null : await getTracking(orderNumber);

  if (order === null) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Carrito', href: '/carrito' },
          { label: 'Pedido', href: '/checkout' },
          { label: order.orderNumber },
        ]}
      />
      <header className="flex flex-col gap-2 rounded-lg border border-ok bg-ok-soft p-4">
        <h1 className="text-2xl font-bold text-fg">Pedido confirmado</h1>
        <p className="text-sm text-fg-secondary">
          El ERP creo el pedido <strong data-testid="order-confirmed-number">{order.orderNumber}</strong>{' '}
          y te contactara para cerrar el pago. Guarda el numero de pedido y el codigo de seguimiento.
        </p>
      </header>

      <OrderSummary order={order} />

      {order.paymentReference === null && order.status !== 'CANCELLED' ? (
        <PaymentReferenceForm orderNumber={order.orderNumber} />
      ) : null}

      <nav aria-label="Siguientes pasos" className="flex flex-wrap gap-2">
        <Link href="/seguimiento" className="sf-btn-primary">
          Consultar el seguimiento
        </Link>
        <Link href="/categorias" className="sf-btn-secondary">
          Seguir comprando
        </Link>
      </nav>
    </div>
  );
}
