'use client';

import { useState } from 'react';

import {
  REVIEW_DELIVERED_NOTICE,
  REVIEW_LIMITS,
  REVIEW_MODERATION_NOTICE,
  REVIEW_ORDER_HINT,
  reviewErrorsAreClear,
  reviewStars,
  validateReview,
  type ReviewErrors,
} from '@/lib/reviews';

interface ReviewFormProps {
  /** Slug del producto publicado: lo pone la ficha, no el comprador. */
  slug: string;
  productName: string;
}

/**
 * Formulario con el que el **comprador con un pedido entregado** escribe su resena (F6).
 *
 * No hay cuenta de cliente (llega con F4), asi que prueba su compra como el seguimiento y la
 * referencia de pago: **numero de pedido y correo**. Quien decide si vale es el **canal** (que
 * tiene el pedido y su estado: tiene que estar entregado y llevar el articulo); aqui solo se
 * valida el formato y se avisa de la regla antes de enviar. La resena queda **en revision**: no
 * se publica hasta que el back office la apruebe.
 */
export function ReviewForm({ slug, productName }: ReviewFormProps): JSX.Element {
  const [order, setOrder] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const found = validateReview({ order, email, rating, title, comment, name });
    setErrors(found);
    setFailure(null);
    if (!reviewErrorsAreClear(found)) return;

    setSending(true);
    try {
      const response = await fetch('/api/resenas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, order, email, name, rating, title, comment }),
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
            : `No se pudo enviar la resena (HTTP ${response.status}).`,
        );
        return;
      }
      const saved =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)['review']
          : null;
      const text =
        typeof saved === 'object' && saved !== null
          ? (saved as Record<string, unknown>)['message']
          : null;
      setSent(
        typeof text === 'string' && text !== '' ? text : REVIEW_MODERATION_NOTICE,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setFailure(`No se pudo contactar con la tienda (${detail}).`);
    } finally {
      setSending(false);
    }
  }

  if (sent !== null) {
    return (
      <section
        aria-label="Tu resena"
        className="rounded-lg border border-ok bg-ok-soft p-4"
        data-testid="review-sent"
      >
        <h3 className="text-sm font-semibold text-fg">Gracias por tu resena</h3>
        <p className="mt-1 text-sm text-fg-secondary" data-testid="review-sent-message">
          {sent}
        </p>
        <p className="mt-2 text-xs text-fg-tertiary">{REVIEW_MODERATION_NOTICE}</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Escribir una resena"
      className="rounded-lg border border-line bg-base p-4"
      data-testid="review-form"
    >
      <h3 className="text-sm font-semibold text-fg">
        Escribe tu resena de {productName}
      </h3>
      <p className="mt-1 text-xs text-fg-secondary">{REVIEW_ORDER_HINT}</p>
      <p className="mt-1 text-xs text-fg-tertiary" data-testid="review-form-rule">
        {REVIEW_DELIVERED_NOTICE}
      </p>

      <form className="mt-3 flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
        <div className="flex flex-col gap-1">
          <label htmlFor="review-order" className="text-xs font-medium text-fg-secondary">
            Numero de pedido <span aria-hidden="true">*</span>
          </label>
          <input
            id="review-order"
            type="text"
            value={order}
            required
            maxLength={REVIEW_LIMITS.order}
            placeholder="Ej.: PV-000123"
            aria-invalid={errors.order !== undefined}
            className={`sf-field ${errors.order !== undefined ? 'border-line-error' : ''}`}
            data-testid="review-order"
            onChange={(event) => setOrder(event.target.value)}
          />
          {errors.order !== undefined ? (
            <p role="alert" className="text-xs text-fg-error">
              {errors.order}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="review-email" className="text-xs font-medium text-fg-secondary">
            Correo del pedido <span aria-hidden="true">*</span>
          </label>
          <input
            id="review-email"
            type="email"
            value={email}
            required
            maxLength={REVIEW_LIMITS.email}
            autoComplete="email"
            aria-invalid={errors.email !== undefined}
            className={`sf-field ${errors.email !== undefined ? 'border-line-error' : ''}`}
            data-testid="review-email"
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email !== undefined ? (
            <p role="alert" className="text-xs text-fg-error">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="review-rating" className="text-xs font-medium text-fg-secondary">
            Estrellas <span aria-hidden="true">*</span>
          </label>
          <select
            id="review-rating"
            value={rating}
            className="sf-field"
            data-testid="review-rating"
            onChange={(event) => setRating(Number(event.target.value))}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {reviewStars(value)} ({value} de 5)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="review-name" className="text-xs font-medium text-fg-secondary">
            Tu nombre (opcional)
          </label>
          <input
            id="review-name"
            type="text"
            value={name}
            maxLength={REVIEW_LIMITS.name}
            placeholder="Como quieres firmar"
            aria-invalid={errors.name !== undefined}
            className={`sf-field ${errors.name !== undefined ? 'border-line-error' : ''}`}
            data-testid="review-name"
            onChange={(event) => setName(event.target.value)}
          />
          <p className="text-2xs text-fg-tertiary">
            Si no lo escribes, publicamos tu correo enmascarado (por ejemplo j***@correo.com).
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="review-title" className="text-xs font-medium text-fg-secondary">
            Titulo (opcional)
          </label>
          <input
            id="review-title"
            type="text"
            value={title}
            maxLength={REVIEW_LIMITS.title}
            aria-invalid={errors.title !== undefined}
            className={`sf-field ${errors.title !== undefined ? 'border-line-error' : ''}`}
            data-testid="review-title"
            onChange={(event) => setTitle(event.target.value)}
          />
          {errors.title !== undefined ? (
            <p role="alert" className="text-xs text-fg-error">
              {errors.title}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="review-comment" className="text-xs font-medium text-fg-secondary">
            Tu opinion <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="review-comment"
            value={comment}
            required
            rows={4}
            maxLength={REVIEW_LIMITS.comment}
            aria-invalid={errors.comment !== undefined}
            className={`sf-field ${errors.comment !== undefined ? 'border-line-error' : ''}`}
            data-testid="review-comment"
            onChange={(event) => setComment(event.target.value)}
          />
          {errors.comment !== undefined ? (
            <p role="alert" className="text-xs text-fg-error">
              {errors.comment}
            </p>
          ) : null}
        </div>

        {failure !== null ? (
          <p
            role="alert"
            className="text-sm font-medium text-fg-error"
            data-testid="review-error"
          >
            {failure}
          </p>
        ) : null}

        <button
          type="submit"
          className="sf-btn sf-btn-secondary w-fit"
          disabled={sending}
          data-testid="review-submit"
        >
          {sending ? 'Enviando...' : 'Enviar resena'}
        </button>
      </form>

      <p className="mt-3 text-xs text-fg-tertiary">{REVIEW_MODERATION_NOTICE}</p>
    </section>
  );
}
