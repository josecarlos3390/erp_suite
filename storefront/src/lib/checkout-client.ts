'use client';

import type { CheckoutRequestBody } from '@/lib/checkout';
import type { OrderView, QuoteView } from '@/lib/order-view';

/**
 * Cliente del route handler `/api/pedido` (el unico puente con el ERP, D10).
 *
 * Vive separado del componente de checkout para que el estado de envio y el
 * manejo de errores se lean en un solo sitio: la respuesta trae el mensaje que
 * respondio el ERP y aqui se convierte en un `Error` con ese texto, para que el
 * comprador lo vea tal cual.
 */

export class CheckoutRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CheckoutRequestError';
    this.status = status;
  }
}

/** Lee el mensaje de error que devuelve la ruta (o el estado HTTP). */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      const error = record['error'];
      if (typeof error === 'string' && error.trim() !== '') return error;
    }
  } catch {
    // Sin cuerpo JSON: se cae al mensaje por estado.
  }
  return `La tienda no pudo completar la operacion (HTTP ${response.status}).`;
}

async function postCheckout(body: CheckoutRequestBody): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch('/api/pedido', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CheckoutRequestError(
      `No se pudo contactar con la tienda (${detail}). Revisa tu conexion e intentalo otra vez.`,
      0,
    );
  }

  if (!response.ok) {
    throw new CheckoutRequestError(await readErrorMessage(response), response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new CheckoutRequestError('La tienda devolvio una respuesta ilegible.', 502);
  }
}

function readQuote(payload: unknown): QuoteView {
  if (typeof payload === 'object' && payload !== null) {
    const quote = (payload as Record<string, unknown>)['quote'];
    if (typeof quote === 'object' && quote !== null) return quote as QuoteView;
  }
  throw new CheckoutRequestError('La tienda no devolvio la cotizacion.', 502);
}

function readOrder(payload: unknown): OrderView {
  if (typeof payload === 'object' && payload !== null) {
    const order = (payload as Record<string, unknown>)['order'];
    if (typeof order === 'object' && order !== null) return order as OrderView;
  }
  throw new CheckoutRequestError('La tienda no devolvio el pedido creado.', 502);
}

/** Cotiza el carrito sin crear nada. El correo (si se conoce) cotiza como cliente. */
export async function requestQuote(
  cityCode: string,
  items: CheckoutRequestBody['items'],
  customerEmail?: string,
): Promise<QuoteView> {
  const email = customerEmail?.trim();
  return readQuote(
    await postCheckout({
      intent: 'quote',
      cityCode,
      items,
      ...(email === undefined || email === '' ? {} : { customerEmail: email }),
    }),
  );
}

/** Crea el pedido. Repetir con la misma clave devuelve el mismo pedido. */
export async function requestOrder(
  body: Omit<CheckoutRequestBody, 'intent'> & { idempotencyKey: string },
): Promise<OrderView> {
  return readOrder(await postCheckout({ ...body, intent: 'order' }));
}
