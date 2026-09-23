/**
 * Contrato de la **referencia del pago offline** (decision D15): el comprador anota el
 * numero de operacion (o los ultimos digitos) de su transferencia o su QR despues de
 * confirmar el pedido, y el canal la guarda para que el back office encuentre el pago al
 * conciliarlo en el ERP.
 *
 * Modulo **puro** (sin `server-only` ni navegador): las mismas reglas corren en el
 * formulario cliente y en el route handler, que es el que decide de verdad. Los limites
 * son los del DTO del canal (`StorefrontPaymentReferenceDto`): si cambian alli, cambian
 * aqui, y la validacion del servidor del canal sigue siendo la ultima palabra.
 *
 * La referencia **no cobra**: el estado del pago lo publica el ERP desde su factura.
 */

export const PAYMENT_REFERENCE_LIMITS = {
  order: 40,
  email: 160,
  reference: 80,
  referenceMin: 4,
} as const;

export interface PaymentReferenceInput {
  order: string;
  email: string;
  reference: string;
}

export interface PaymentReferenceErrors {
  email?: string;
  reference?: string;
}

/** Ayuda del campo: que se espera que escriba el comprador. */
export const PAYMENT_REFERENCE_HINT =
  'El numero de operacion de tu transferencia o de tu QR (o los ultimos digitos). Si pagas contra entrega, dejalo para cuando el repartidor te cobre.';

/** Aviso de lo que la referencia **no** hace (honestidad del flujo offline). */
export const PAYMENT_REFERENCE_NOTICE =
  'Anotar la referencia no marca el pedido como pagado: la tienda lo concilia con el banco y el ERP lo registra. El estado del pago se ve arriba.';

function isDeliverableEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > PAYMENT_REFERENCE_LIMITS.email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

/** Reglas de la tienda para el formulario (el canal valida lo mismo en el servidor). */
export function validatePaymentReference(
  input: PaymentReferenceInput,
): PaymentReferenceErrors {
  const errors: PaymentReferenceErrors = {};
  const email = input.email.trim();
  if (email === '') {
    errors.email = 'Escribe el correo con el que hiciste el pedido.';
  } else if (!isDeliverableEmail(email)) {
    errors.email = 'El correo no parece valido (ejemplo: nombre@dominio.com).';
  }
  const reference = input.reference.trim();
  if (reference.length < PAYMENT_REFERENCE_LIMITS.referenceMin) {
    errors.reference = `La referencia necesita al menos ${PAYMENT_REFERENCE_LIMITS.referenceMin} caracteres.`;
  } else if (reference.length > PAYMENT_REFERENCE_LIMITS.reference) {
    errors.reference = `La referencia no puede pasar de ${PAYMENT_REFERENCE_LIMITS.reference} caracteres.`;
  }
  return errors;
}

/** `true` si no hay ningun error de campo. */
export function referenceErrorsAreClear(errors: PaymentReferenceErrors): boolean {
  return Object.values(errors).every((value) => value === undefined);
}
