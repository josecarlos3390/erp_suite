import { NextResponse } from 'next/server';

import { validateCheckoutBody } from '@/lib/checkout';
import { ErpError, createOrder, quoteOrder } from '@/lib/erp';

export const dynamic = 'force-dynamic';

/**
 * Unico puente entre el navegador y el canal del ERP (decision D10).
 *
 * El navegador **nunca** ve `STOREFRONT_API_KEY`: los dos POST del checkout
 * (cotizar y crear el pedido) entran por aqui, se validan y se sanean campo a
 * campo (`validateCheckoutBody` reconstruye el cuerpo: lo que no se valida no se
 * reenvia) y salen hacia `/storefront/...` con la clave puesta en el servidor.
 *
 * La respuesta conserva el codigo de estado del canal (400/404/409/...) para que
 * los errores accionables de la tienda —sin existencia, articulo despublicado,
 * ciudad sin envio— lleguen al comprador con su texto original, y suma un 502
 * cuando el ERP no responde (fallo de red, no culpa de los datos).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const validation = validateCheckoutBody(payload);
  if (!validation.ok || validation.value === undefined) {
    return NextResponse.json(
      { error: validation.error ?? 'Peticion de checkout invalida.' },
      { status: 400 },
    );
  }

  const body = validation.value;

  try {
    if (body.intent === 'quote') {
      const quote = await quoteOrder({ cityCode: body.cityCode, items: body.items });
      return NextResponse.json({ quote });
    }

    const order = await createOrder({
      idempotencyKey: body.idempotencyKey,
      cityCode: body.cityCode,
      deliveryType: body.deliveryType,
      paymentMethod: body.paymentMethod,
      items: body.items,
      customer: body.customer,
      ...(body.notes === undefined ? {} : { notes: body.notes }),
    });
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof ErpError) {
      // El canal no respondio (status 0) o respondio un error: se propaga tal cual.
      const status = error.status >= 400 && error.status <= 599 ? error.status : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo completar la operacion con el ERP (${detail}).` },
      { status: 502 },
    );
  }
}
