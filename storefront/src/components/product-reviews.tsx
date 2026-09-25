import type { ProductRating, ProductReview } from '@/lib/erp';
import { formatRating, reviewStars } from '@/lib/reviews';

import { ReviewForm } from './review-form';

interface ProductReviewsProps {
  slug: string;
  productName: string;
  /** Promedio publicado por el ERP (solo resenas aprobadas). Puede faltar. */
  rating?: ProductRating;
  /** Resenas aprobadas mas recientes. Puede faltar. */
  reviews?: ProductReview[];
}

/**
 * **Resenas del producto** (F6) en la ficha.
 *
 * Lo que se pinta es lo que el ERP publica: el promedio y el listado de resenas **aprobadas**
 * (la moderacion del back office es la que decide que se ve). La tienda no calcula el promedio
 * ni completa huecos: si el canal no trae resenas, lo dice.
 *
 * Debajo va el formulario para escribir una: solo lo acepta el canal si el comprador tiene un
 * pedido **entregado** de este articulo, y la resena entra **pendiente**.
 */
export function ProductReviews({
  slug,
  productName,
  rating,
  reviews,
}: ProductReviewsProps): JSX.Element {
  const published = reviews ?? [];
  const count = rating?.count ?? 0;
  const average = rating?.average ?? 0;

  return (
    <section aria-labelledby="resenas-titulo" className="sf-section">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="sf-eyebrow">Lo que dicen los compradores</p>
          <h2 id="resenas-titulo" className="sf-h2 text-fg">
            Resenas del producto
          </h2>
        </div>
        {count > 0 ? (
          <p className="flex items-center gap-2 text-sm text-fg-secondary">
            <span
              className="text-lg text-fg-warning"
              aria-hidden="true"
              data-testid="reviews-average-stars"
            >
              {reviewStars(average)}
            </span>
            <span data-testid="reviews-average">
              {formatRating(average)} de 5
            </span>
            <span className="text-fg-tertiary" data-testid="reviews-count">
              ({count} {count === 1 ? 'resena' : 'resenas'})
            </span>
          </p>
        ) : null}
      </div>

      {published.length === 0 ? (
        <p className="sf-panel text-sm text-fg-secondary" data-testid="reviews-empty">
          {count > 0
            ? 'El ERP publico el promedio pero no devolvio el detalle de las resenas.'
            : 'Este producto todavia no tiene resenas publicadas. Las que se envian pasan por moderacion antes de aparecer aqui.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="reviews-list">
          {published.map((review) => (
            <li
              key={review.id}
              className="sf-panel flex flex-col gap-1"
              data-testid="review-item"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-sm text-fg-warning"
                  aria-label={`${review.rating} de 5`}
                  data-testid="review-stars"
                >
                  {reviewStars(review.rating)}
                </span>
                {review.title !== null && review.title !== '' ? (
                  <span className="text-sm font-semibold text-fg">
                    {review.title}
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-line text-sm text-fg-secondary">
                {review.comment}
              </p>
              <p className="text-2xs text-fg-tertiary">
                {review.buyer} · {review.createdAt.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <ReviewForm slug={slug} productName={productName} />
    </section>
  );
}
