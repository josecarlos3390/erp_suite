/**
 * Reglas del formulario de **servicio técnico** de la ficha (F6/T228), en un módulo **puro**
 * (sin `server-only`) para que el islote cliente y el puente del API compartan la misma
 * validación: lo que el navegador no valida no se reenvía.
 */

export const SERVICE_REQUEST_LIMITS = {
  email: 200,
  name: 200,
  phone: 50,
  issue: 2000,
  issueMin: 10,
  order: 50,
} as const;

export interface ServiceRequestInput {
  email: string;
  name: string;
  phone: string;
  issue: string;
  order: string;
}

export interface ServiceRequestErrors {
  email?: string;
  issue?: string;
}

/** Aviso fijo del formulario: qué hace y qué **no** promete. */
export const SERVICE_REQUEST_NOTICE =
  'La solicitud queda registrada en el ERP y la revisa el vendedor del producto, que se pondrá en contacto contigo. No se agenda una fecha desde aquí.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida el formulario con las mismas reglas que el DTO del canal. */
export function validateServiceRequest(
  input: ServiceRequestInput,
): ServiceRequestErrors {
  const errors: ServiceRequestErrors = {};
  const email = input.email.trim();
  if (email === '') errors.email = 'Necesitamos un correo para contactarte.';
  else if (email.length > SERVICE_REQUEST_LIMITS.email || !EMAIL.test(email)) {
    errors.email = 'Ese correo no parece válido.';
  }

  const issue = input.issue.trim();
  if (issue.length < SERVICE_REQUEST_LIMITS.issueMin) {
    errors.issue = `Cuéntanos el problema (mínimo ${SERVICE_REQUEST_LIMITS.issueMin} caracteres).`;
  } else if (issue.length > SERVICE_REQUEST_LIMITS.issue) {
    errors.issue = `El motivo no puede pasar de ${SERVICE_REQUEST_LIMITS.issue} caracteres.`;
  }

  return errors;
}

export function serviceRequestErrorsAreClear(
  errors: ServiceRequestErrors,
): boolean {
  return errors.email === undefined && errors.issue === undefined;
}
