import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { OrderSummary } from '@/components/order-summary';
import { PaymentReferenceForm } from '@/components/payment-reference-form';
import { CHECKOUT_LIMITS } from '@/lib/checkout';
import { ErpError, getTracking } from '@/lib/erp';
import type { OrderView } from '@/lib/order-view';
import { readParam, type SearchParams } from '@/lib/query';

export const metadata: Metadata = {
  title: 'Seguimiento de pedido',
  description:
    'Consulta publica del estado de un pedido de la tienda con el numero de pedido y, opcionalmente, el correo.',
  alternates: { canonical: '/seguimiento' },
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

interface TrackingPageProps {
  searchParams: SearchParams;
}

interface Lookup {
  order: OrderView | null;
  /** Mensaje del canal cuando el pedido no existe (404) o falla la consulta. */
  error: string | null;
}

/** Consulta el pedido en el canal; el 404 se devuelve como estado vacio honesto. */
async function lookup(orderNumber: string, email: string | undefined): Promise<Lookup> {
  try {
    const order = await getTracking(orderNumber, email);
    return { order, error: null };
  } catch (error) {
    if (error instanceof ErpError) {
      return { order: null, error: error.message };
    }
    return {
      order: null,
      error: 'No se pudo consultar el pedido en el ERP. Revisa la conexion e intentalo otra vez.',
    };
  }
}

/**
 * Seguimiento publico (`/seguimiento`).
 *
 * El formulario es un `GET` a esta misma pagina: el servidor lee `order` y `email`
 * de la query, consulta el canal (`GET /storefront/tracking`) y pinta el estado.
 * El navegador nunca habla con el ERP (D10). Reglas de honestidad:
 *  - sin numero de pedido, estado vacio que explica que hace falta;
 *  - pedido inexistente o correo que no corresponde -> el 404 del canal se muestra
 *    como «no encontramos ese pedido», **sin** confirmar si el numero existe.
 */
export default async function TrackingPage({ searchParams }: TrackingPageProps): Promise<JSX.Element> {
  const orderNumber = readParam(searchParams['order'])?.slice(0, CHECKOUT_LIMITS.idempotencyKey);
  const email = readParam(searchParams['email'])?.slice(0, CHECKOUT_LIMITS.email);
  const lookupResult =
    orderNumber === undefined ? null : await lookup(orderNumber, email);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Seguimiento' }]} />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">Seguimiento de pedido</h1>
        <p className="text-sm text-fg-secondary">
          Consulta el estado de tu pedido con el numero que te dio la tienda. Si registraste un
          correo al comprar, escribelo igual para ver el detalle.
        </p>
      </header>

      <form method="get" action="/seguimiento" className="sf-card flex flex-col gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="seguimiento-order" className="text-xs font-medium text-fg-secondary">
              Numero de pedido <span aria-hidden="true">*</span>
            </label>
            <input
              id="seguimiento-order"
              name="order"
              type="text"
              required
              defaultValue={orderNumber ?? ''}
              maxLength={CHECKOUT_LIMITS.idempotencyKey}
              placeholder="PED-000001"
              autoComplete="off"
              className="sf-field"
              data-testid="tracking-order-input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="seguimiento-email" className="text-xs font-medium text-fg-secondary">
              Correo (opcional)
            </label>
            <input
              id="seguimiento-email"
              name="email"
              type="email"
              defaultValue={email ?? ''}
              maxLength={CHECKOUT_LIMITS.email}
              placeholder="nombre@dominio.com"
              autoComplete="email"
              className="sf-field"
              data-testid="tracking-email-input"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="sf-btn-primary" data-testid="tracking-submit">
            Consultar pedido
          </button>
          {orderNumber !== undefined ? (
            <Link href="/seguimiento" className="sf-btn-secondary">
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {lookupResult === null ? (
        <section
          className="rounded-lg border border-dashed border-line bg-elevated p-6"
          data-testid="tracking-empty"
        >
          <h2 className="text-sm font-semibold text-fg">Todavia no consultaste ningun pedido</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Escribe el numero de pedido (por ejemplo `PED-000001`) para ver su estado y su desglose.
            Lo encuentras en la confirmacion de la compra y en el correo o WhatsApp de la tienda.
          </p>
        </section>
      ) : null}

      {lookupResult !== null && lookupResult.order === null ? (
        <section
          role="alert"
          className="rounded-lg border border-line-error bg-danger-soft p-6"
          data-testid="tracking-not-found"
        >
          <h2 className="text-sm font-semibold text-fg">
            No encontramos el pedido {orderNumber}
          </h2>
          <p className="mt-1 text-sm text-fg-secondary">
            {lookupResult.error ??
              'El pedido no existe en la tienda.'}{' '}
            Revisa el numero (no deben faltar ni sobrar caracteres) y, si escribiste un correo,
            comprueba que sea el mismo con el que hiciste la compra.
          </p>
          <p className="mt-2 text-xs text-fg-tertiary">
            Por seguridad no confirmamos si un numero de pedido existe cuando el correo no coincide.
          </p>
        </section>
      ) : null}

      {lookupResult?.order !== null && lookupResult?.order !== undefined ? (
        <OrderSummary order={lookupResult.order} />
      ) : null}

      {lookupResult?.order !== null &&
      lookupResult?.order !== undefined &&
      lookupResult.order.paymentReference === null &&
      lookupResult.order.status !== 'CANCELLED' ? (
        <PaymentReferenceForm orderNumber={lookupResult.order.orderNumber} />
      ) : null}
    </div>
  );
}
