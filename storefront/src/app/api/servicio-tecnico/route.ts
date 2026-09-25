import { NextResponse } from 'next/server';

import { ErpError, submitServiceRequest } from '@/lib/erp';
import {
  SERVICE_REQUEST_LIMITS,
  serviceRequestErrorsAreClear,
  validateServiceRequest,
} from '@/lib/service-request';

export const dynamic = 'force-dynamic';

/**
 * Puente para **dejar una solicitud de servicio técnico** (F6/T228).
 *
 * El navegador nunca ve `STOREFRONT_API_KEY` (D10): el formulario de la ficha entra por aquí,
 * se valida campo a campo y se **reconstruye** el cuerpo —lo que no se valida no se reenvía— y
 * sale hacia `/storefront/service-requests` con la clave puesta en el servidor. El `slug` no
 * lo elige el navegador: lo pone la ficha, que es la única que sabe de qué producto se habla.
 *
 * La respuesta conserva el código del canal (404 de producto no publicado o de pedido que no
 * es de ese correo, 400 del cuerpo) para que el mensaje accionable llegue al comprador, y suma
 * un 502 cuando el ERP no responde.
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
  const text = (key: string): string =>
    typeof body[key] === 'string' ? (body[key] as string) : '';

  const slug = text('slug').trim();
  if (slug === '' || slug.length > 200) {
    return NextResponse.json(
      { error: 'Falta el producto del que se pide servicio tecnico.' },
      { status: 400 },
    );
  }

  const input = {
    email: text('email'),
    name: text('name').slice(0, SERVICE_REQUEST_LIMITS.name),
    phone: text('phone').slice(0, SERVICE_REQUEST_LIMITS.phone),
    issue: text('issue'),
    order: text('order').slice(0, SERVICE_REQUEST_LIMITS.order),
  };
  const errors = validateServiceRequest(input);
  if (!serviceRequestErrorsAreClear(errors)) {
    return NextResponse.json(
      { error: errors.email ?? errors.issue },
      { status: 400 },
    );
  }

  try {
    const serviceRequest = await submitServiceRequest({ slug, ...input });
    return NextResponse.json({ serviceRequest });
  } catch (error) {
    if (error instanceof ErpError) {
      const status =
        error.status >= 400 && error.status <= 599 ? error.status : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo enviar la solicitud al ERP (${detail}).` },
      { status: 502 },
    );
  }
}
