'use client';

import { useState } from 'react';

import {
  PAYMENT_REFERENCE_HINT,
  PAYMENT_REFERENCE_LIMITS,
  PAYMENT_REFERENCE_NOTICE,
  referenceErrorsAreClear,
  validatePaymentReference,
  type PaymentReferenceErrors,
} from '@/lib/payment-reference';

interface PaymentReferenceFormProps {
  orderNumber: string;
}

/**
 * Formulario con el que el comprador **anota la referencia de su pago offline** (D15).
 *
 * Vive en la confirmacion y en el seguimiento, y solo se pinta cuando el pedido no tiene
 * referencia todavia. Pide el correo porque el canal **exige** el del pedido para
 * escribir en el (conocer el numero de pedido no basta), y avisa de lo que la referencia
 * no hace: no marca el pedido como pagado —eso lo concilia la tienda y lo registra el
 * ERP—, de modo que nadie crea que anotarla cierra la compra.
 */
export function PaymentReferenceForm({
  orderNumber,
}: PaymentReferenceFormProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<PaymentReferenceErrors>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const found = validatePaymentReference({ order: orderNumber, email, reference });
    setErrors(found);
    setFailure(null);
    if (!referenceErrorsAreClear(found)) return;

    setSending(true);
    try {
      const response = await fetch('/api/referencia', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order: orderNumber, email, reference }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null
            ? (payload as Record<string, unknown>)['error']
            : null;
        setFailure(
          typeof message === 'string' && message !== ''
            ? message
            : `No se pudo registrar la referencia (HTTP ${response.status}).`,
        );
        return;
      }
      setSaved(reference.trim());
      setReference('');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setFailure(`No se pudo contactar con la tienda (${detail}).`);
    } finally {
      setSending(false);
    }
  }

  if (saved !== null) {
    return (
      <section
        aria-label="Referencia del pago"
        className="rounded-lg border border-ok bg-ok-soft p-4"
        data-testid="payment-reference-saved"
      >
        <h2 className="text-sm font-semibold text-fg">Referencia de pago anotada</h2>
        <p className="mt-1 text-sm text-fg-secondary">
          Guardamos <strong data-testid="payment-reference-value">{saved}</strong> con tu pedido{' '}
          {orderNumber}. La tienda la usa para conciliar el pago.
        </p>
        <p className="mt-2 text-xs text-fg-tertiary">{PAYMENT_REFERENCE_NOTICE}</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Referencia del pago"
      className="rounded-lg border border-line bg-base p-4"
      data-testid="payment-reference-form"
    >
      <h2 className="text-sm font-semibold text-fg">¿Ya pagaste? Anota tu referencia</h2>
      <p className="mt-1 text-xs text-fg-secondary">{PAYMENT_REFERENCE_HINT}</p>

      <form className="mt-3 flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
        <div className="flex flex-col gap-1">
          <label htmlFor="reference-email" className="text-xs font-medium text-fg-secondary">
            Correo del pedido <span aria-hidden="true">*</span>
          </label>
          <input
            id="reference-email"
            type="email"
            value={email}
            required
            maxLength={PAYMENT_REFERENCE_LIMITS.email}
            autoComplete="email"
            aria-invalid={errors.email !== undefined}
            className={`sf-field ${errors.email !== undefined ? 'border-line-error' : ''}`}
            data-testid="payment-reference-email"
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email !== undefined ? (
            <p role="alert" className="text-xs text-fg-error">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="reference-value" className="text-xs font-medium text-fg-secondary">
            Referencia del pago <span aria-hidden="true">*</span>
          </label>
          <input
            id="reference-value"
            type="text"
            value={reference}
            required
            maxLength={PAYMENT_REFERENCE_LIMITS.reference}
            placeholder="Ej.: TRANSF-884422"
            aria-invalid={errors.reference !== undefined}
            className={`sf-field ${errors.reference !== undefined ? 'border-line-error' : ''}`}
            data-testid="payment-reference-input"
            onChange={(event) => setReference(event.target.value)}
          />
          {errors.reference !== undefined ? (
            <p role="alert" className="text-xs text-fg-error">
              {errors.reference}
            </p>
          ) : null}
        </div>

        {failure !== null ? (
          <p role="alert" className="text-sm font-medium text-fg-error" data-testid="payment-reference-error">
            {failure}
          </p>
        ) : null}

        <button
          type="submit"
          className="sf-btn sf-btn-secondary w-fit"
          disabled={sending}
          data-testid="payment-reference-submit"
        >
          {sending ? 'Guardando...' : 'Guardar referencia'}
        </button>
      </form>

      <p className="mt-3 text-xs text-fg-tertiary">{PAYMENT_REFERENCE_NOTICE}</p>
    </section>
  );
}
