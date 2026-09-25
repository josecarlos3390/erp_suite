import { NextResponse } from 'next/server';

import { ErpError, submitReview } from '@/lib/erp';
import {
  REVIEW_LIMITS,
  reviewErrorsAreClear,
  validateReview,
} from '@/lib/reviews';

export const dynamic = 'force-dynamic';

/**
 * Puente para **escribir la resena de un producto** (F6).
 *
 * El navegador nunca ve `STOREFRONT_API_KEY` (D10): el formulario entra por aqui, se valida
 * campo a campo y se **reconstruye** el cuerpo —lo que no se valida no se reenvia— y sale hacia
 * `/storefront/reviews` con la clave puesta en el servidor. El `slug` no lo manda el navegador:
 * lo pone la ficha, que es la unica que sabe que producto se esta resenando.
 *
 * La respuesta conserva el codigo del canal (400 por pedido no entregado o articulo que no es
 * del pedido, 404 por pedido/correo que no cuadran, 409 por resena repetida) para que el
 * mensaje accionable llegue al comprador, y suma un 502 cuando el ERP no responde.
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
  if (slug === '' || slug.length > REVIEW_LIMITS.slug) {
    return NextResponse.json(
      { error: 'Falta el producto que se quiere resenar (o no es valido).' },
      { status: 400 },
    );
  }

  const input = {
    order: text('order'),
    email: text('email'),
    rating: Number(body['rating']),
    title: text('title'),
    comment: text('comment'),
    name: text('name'),
  };
  const errors = validateReview(input);
  if (!reviewErrorsAreClear(errors)) {
    const firstError =
      errors.order ??
      errors.email ??
      errors.rating ??
      errors.comment ??
      errors.title ??
      errors.name;
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  try {
    const review = await submitReview({
      order: input.order,
      email: input.email,
      slug,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
      name: input.name,
    });
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof ErpError) {
      const status =
        error.status >= 400 && error.status <= 599 ? error.status : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo enviar la resena al ERP (${detail}).` },
      { status: 502 },
    );
  }
}
