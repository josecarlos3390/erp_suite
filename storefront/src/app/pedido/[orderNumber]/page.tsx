import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { OrderSummary } from '@/components/order-summary';
import { PaymentReferenceForm } from '@/components/payment-reference-form';
import { CHECKOUT_LIMITS } from '@/lib/checkout';
import { getTracking } from '@/lib/erp';
import { readParam, type SearchParams } from '@/lib/query';

export const metadata: Metadata = {
  title: 'Confirmacion del pedido',
  description: 'Numero de pedido, codigo de seguimiento y desglose de tu compra.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface OrderPageProps {
  params: { orderNumber: string };
  searchParams: SearchParams;
}

/**
 * Confirmacion del pedido (`/pedido/[orderNumber]?c=<codigoDeSeguimiento>`).
 *
 * Se lee del canal **desde el servidor** (`GET /storefront/tracking`) con el numero **y el
 * codigo de seguimiento** que el checkout acaba de recibir y que la propia pantalla le
 * ensena al comprador: el canal **no** entrega un pedido solo por su numero (medido: antes
 * si, y los numeros son secuenciales ⇒ las ventas web eran enumerables). El codigo viaja en
 * la URL en vez del correo a proposito: no es un dato personal y no acaba en el historial ni
 * en los logs.
 *
 * Si el pedido no existe, el numero esta mal **o falta el codigo**, la pagina responde 404 en
 * vez de inventar un estado (para consultar despues esta `/seguimiento`).
 */
export default async function OrderPage({
  params,
  searchParams,
}: OrderPageProps): Promise<JSX.Element> {
  const orderNumber = decodeURIComponent(params.orderNumber).trim();
  const code = readParam(searchParams['c'])?.slice(0, CHECKOUT_LIMITS.trackingCode);
  const order =
    orderNumber === '' ? null : await getTracking(orderNumber, undefined, code);

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
        <Link href="/seguimiento" className="sf-btn sf-btn-primary">
          Consultar el seguimiento
        </Link>
        <Link href="/categorias" className="sf-btn sf-btn-secondary">
          Seguir comprando
        </Link>
      </nav>
    </div>
  );
}
