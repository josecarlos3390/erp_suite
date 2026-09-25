/**
 * Contrato de la **resena de producto** (F6) del lado de la tienda.
 *
 * Modulo **puro** (sin `server-only` ni navegador): las mismas reglas corren en el formulario
 * cliente y en el route handler, que es el que decide de verdad. Los limites son los del DTO
 * del canal (`StorefrontCreateReviewDto`): si cambian alli, cambian aqui, y la validacion del
 * servidor del canal sigue siendo la ultima palabra.
 *
 * Lo que la tienda **no** decide: si el comprador compro de verdad. Eso lo comprueba el canal
 * contra el pedido entregado (`POST /storefront/reviews`), y por eso la resena nace
 * **pendiente** hasta que el back office la aprueba.
 */

export const REVIEW_LIMITS = {
  order: 40,
  email: 160,
  slug: 120,
  title: 120,
  comment: 2000,
  name: 120,
  /** El comentario tiene que decir algo: es la unica regla de contenido de la tienda. */
  commentMin: 10,
  ratingMin: 1,
  ratingMax: 5,
} as const;

export interface ReviewInput {
  order: string;
  email: string;
  rating: number;
  title: string;
  comment: string;
  name: string;
}

export interface ReviewErrors {
  order?: string;
  email?: string;
  rating?: string;
  title?: string;
  comment?: string;
  name?: string;
}

/** Ayuda del campo del pedido: donde lo encuentra el comprador. */
export const REVIEW_ORDER_HINT =
  'El numero que te dio la tienda al confirmar (por ejemplo PV-000123). Esta en tu correo de confirmacion y en el seguimiento.';

/** Aviso de lo que pasa despues de enviar: la moderacion es lo que publica. */
export const REVIEW_MODERATION_NOTICE =
  'Tu resena queda en revision: se publica cuando el equipo la apruebe, y solo entonces cuenta para el promedio del producto.';

/** Motivo por el que la puerta esta cerrada a quien no compro. */
export const REVIEW_DELIVERED_NOTICE =
  'Solo pueden resenar quienes compraron el producto: pedimos el numero de pedido y el correo con el que lo hiciste. El pedido tiene que estar entregado.';

function isDeliverableEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > REVIEW_LIMITS.email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

/** Reglas de la tienda para el formulario (el canal valida lo mismo en el servidor). */
export function validateReview(input: ReviewInput): ReviewErrors {
  const errors: ReviewErrors = {};

  const order = input.order.trim();
  if (order === '') {
    errors.order = 'Escribe el numero de tu pedido.';
  } else if (order.length > REVIEW_LIMITS.order) {
    errors.order = `El numero de pedido no puede pasar de ${REVIEW_LIMITS.order} caracteres.`;
  }

  const email = input.email.trim();
  if (email === '') {
    errors.email = 'Escribe el correo con el que hiciste el pedido.';
  } else if (!isDeliverableEmail(email)) {
    errors.email = 'El correo no parece valido (ejemplo: nombre@dominio.com).';
  }

  const rating = Number(input.rating);
  if (
    !Number.isInteger(rating) ||
    rating < REVIEW_LIMITS.ratingMin ||
    rating > REVIEW_LIMITS.ratingMax
  ) {
    errors.rating = 'Elige de 1 a 5 estrellas.';
  }

  const title = input.title.trim();
  if (title.length > REVIEW_LIMITS.title) {
    errors.title = `El titulo no puede pasar de ${REVIEW_LIMITS.title} caracteres.`;
  }

  const comment = input.comment.trim();
  if (comment.length < REVIEW_LIMITS.commentMin) {
    errors.comment = `Cuenta algo mas: al menos ${REVIEW_LIMITS.commentMin} caracteres.`;
  } else if (comment.length > REVIEW_LIMITS.comment) {
    errors.comment = `El comentario no puede pasar de ${REVIEW_LIMITS.comment} caracteres.`;
  }

  if (input.name.trim().length > REVIEW_LIMITS.name) {
    errors.name = `El nombre no puede pasar de ${REVIEW_LIMITS.name} caracteres.`;
  }

  return errors;
}

/** `true` si no hay ningun error de campo. */
export function reviewErrorsAreClear(errors: ReviewErrors): boolean {
  return Object.values(errors).every((value) => value === undefined);
}

/** Estrellas de una resena (`★★★★☆`), con el relleno justo. */
export function reviewStars(rating: number): string {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`;
}

/**
 * Promedio publicado, listo para pintar (`4,5`).
 *
 * Se redondea **en el ERP**, no aqui: la tienda solo cambia el separador decimal para que el
 * numero se lea en espanol. Re-redondear daria dos numeros del mismo dato.
 */
export function formatRating(average: number): string {
  if (!Number.isFinite(average) || average <= 0) return '—';
  return average.toFixed(1).replace('.', ',');
}
