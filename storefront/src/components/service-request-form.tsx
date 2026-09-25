'use client';

import { useState } from 'react';

import {
  SERVICE_REQUEST_LIMITS,
  SERVICE_REQUEST_NOTICE,
  serviceRequestErrorsAreClear,
  validateServiceRequest,
  type ServiceRequestErrors,
} from '@/lib/service-request';

interface ServiceRequestFormProps {
  /** Slug del producto publicado sobre el que se pide servicio técnico. */
  slug: string;
  /** Nombre del producto, solo para el texto del formulario. */
  productName: string;
  /** Vendedor que atiende (el de la publicación), si el canal lo publica. */
  seller: string | null;
}

interface SubmittedView {
  id: number;
  seller: string | null;
  message: string;
}

/**
 * **Solicitud de servicio técnico** desde la ficha (F6/T228).
 *
 * El comprador escribe su correo y el problema; el pedido es **opcional** (pedir servicio
 * técnico no exige haber comprado) y, si lo da, el canal lo verifica con ese mismo correo
 * —la identidad del seguimiento y las reseñas—. El formulario **dice lo que hace**: deja la
 * solicitud en el ERP para que la revise el vendedor; no promete fecha ni agenda técnico.
 *
 * Los `data-testid` (`service-request-form`, `service-request-email`,
 * `service-request-issue`, `service-request-submit`, `service-request-status`,
 * `service-request-error`) son contrato con el E2E.
 */
export function ServiceRequestForm({
  slug,
  productName,
  seller,
}: ServiceRequestFormProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState('');
  const [issue, setIssue] = useState('');
  const [errors, setErrors] = useState<ServiceRequestErrors>({});
  const [channelError, setChannelError] = useState<string | null>(null);
  const [sent, setSent] = useState<SubmittedView | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(): Promise<void> {
    const local = validateServiceRequest({ email, name, phone, issue, order });
    setErrors(local);
    setChannelError(null);
    if (!serviceRequestErrorsAreClear(local)) return;

    setSending(true);
    try {
      const response = await fetch('/api/servicio-tecnico', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, email, name, phone, issue, order }),
      });
      const body = (await response.json()) as {
        serviceRequest?: SubmittedView;
        error?: string;
      };
      if (!response.ok || body.serviceRequest === undefined) {
        setChannelError(body.error ?? 'No se pudo enviar la solicitud.');
        return;
      }
      setSent(body.serviceRequest);
    } catch {
      setChannelError('No se pudo enviar la solicitud (revisa tu conexion).');
    } finally {
      setSending(false);
    }
  }

  if (sent !== null) {
    return (
      <section
        className="sf-panel flex flex-col gap-2"
        aria-labelledby="servicio-tecnico-titulo"
        data-testid="service-request-form"
      >
        <h2 id="servicio-tecnico-titulo" className="sf-h3">
          Servicio tecnico
        </h2>
        <p
          role="status"
          className="text-sm font-medium text-price-free"
          data-testid="service-request-status"
        >
          {sent.message}
        </p>
        <p className="text-xs text-fg-tertiary">
          Tu solicitud es la #{sent.id}
          {sent.seller !== null ? ` y la atiende ${sent.seller}` : ''}. Guarda tu correo: es la
          llave para hacerle seguimiento.
        </p>
      </section>
    );
  }

  return (
    <section
      className="sf-panel flex flex-col gap-3"
      aria-labelledby="servicio-tecnico-titulo"
      data-testid="service-request-form"
    >
      <div className="flex flex-col gap-1">
        <h2 id="servicio-tecnico-titulo" className="sf-h3">
          Servicio tecnico
        </h2>
        <p className="text-xs text-fg-tertiary">
          {seller !== null
            ? `Cuentanos que le pasa a tu ${productName} y ${seller} lo revisa.`
            : `Cuentanos que le pasa a tu ${productName} y el equipo lo revisa.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sf-field">
          <span className="sf-field-label">Correo de contacto</span>
          <input
            type="email"
            className="sf-input"
            value={email}
            autoComplete="email"
            data-testid="service-request-email"
            aria-invalid={errors.email !== undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email !== undefined ? (
            <span className="text-2xs text-fg-error" data-testid="service-request-error">
              {errors.email}
            </span>
          ) : null}
        </label>

        <label className="sf-field">
          <span className="sf-field-label">Pedido (opcional)</span>
          <input
            type="text"
            className="sf-input"
            value={order}
            placeholder="WEB-123"
            data-testid="service-request-order"
            onChange={(event) => setOrder(event.target.value)}
          />
        </label>

        <label className="sf-field">
          <span className="sf-field-label">Nombre (opcional)</span>
          <input
            type="text"
            className="sf-input"
            value={name}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="sf-field">
          <span className="sf-field-label">Telefono (opcional)</span>
          <input
            type="tel"
            className="sf-input"
            value={phone}
            autoComplete="tel"
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
      </div>

      <label className="sf-field">
        <span className="sf-field-label">Que le pasa al producto</span>
        <textarea
          className="sf-input min-h-[96px]"
          value={issue}
          maxLength={SERVICE_REQUEST_LIMITS.issue}
          data-testid="service-request-issue"
          aria-invalid={errors.issue !== undefined}
          onChange={(event) => setIssue(event.target.value)}
        />
        {errors.issue !== undefined ? (
          <span className="text-2xs text-fg-error" data-testid="service-request-error">
            {errors.issue}
          </span>
        ) : null}
      </label>

      <p className="text-2xs text-fg-tertiary">{SERVICE_REQUEST_NOTICE}</p>

      {channelError !== null ? (
        <p className="text-xs text-fg-error" role="alert" data-testid="service-request-error">
          {channelError}
        </p>
      ) : null}

      <button
        type="button"
        className="sf-btn sf-btn-primary w-fit"
        data-testid="service-request-submit"
        disabled={sending}
        onClick={() => void submit()}
      >
        {sending ? 'Enviando…' : 'Pedir servicio tecnico'}
      </button>
    </section>
  );
}
