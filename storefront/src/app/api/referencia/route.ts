import { NextResponse } from 'next/server';

import { ErpError, registerPaymentReference } from '@/lib/erp';
import {
  PAYMENT_REFERENCE_LIMITS,
  validatePaymentReference,
} from '@/lib/payment-reference';

export const dynamic = 'force-dynamic';

/**
 * Puente para **anotar la referencia del pago offline** (decision D15).
 *
 * El navegador nunca ve `STOREFRONT_API_KEY` (D10): el formulario entra por aqui, se
 * valida campo a campo y se **reconstruye** el cuerpo —lo que no se valida no se
 * reenvia— y sale hacia `/storefront/payment-reference` con la clave puesta en el
 * servidor. La respuesta conserva el codigo del canal (400/404) para que el mensaje
 * accionable llegue al comprador, y suma un 502 cuando el ERP no responde.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return NextResponse.json(
      { error: 'El cuerpo de la peticion no es un objeto JSON.' },
      { status: 400 },
    );
  }
  const body = payload as Record<string, unknown>;
  const order = typeof body['order'] === 'string' ? body['order'].trim() : '';
  const email = typeof body['email'] === 'string' ? body['email'].trim() : '';
  const reference =
    typeof body['reference'] === 'string' ? body['reference'].trim() : '';

  if (order === '' || order.length > PAYMENT_REFERENCE_LIMITS.order) {
    return NextResponse.json(
      { error: 'Falta el numero de pedido (o no es valido).' },
      { status: 400 },
    );
  }

  const errors = validatePaymentReference({ order, email, reference });
  const firstError = errors.email ?? errors.reference;
  if (firstError !== undefined) {
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  try {
    const orderView = await registerPaymentReference({ order, email, reference });
    return NextResponse.json({ order: orderView });
  } catch (error) {
    if (error instanceof ErpError) {
      const status = error.status >= 400 && error.status <= 599 ? error.status : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo registrar la referencia con el ERP (${detail}).` },
      { status: 502 },
    );
  }
}
