import Link from 'next/link';

import type { Product } from '@/lib/erp';
import { formatDiscount, formatMoney } from '@/lib/format';

import { ProductImage } from './product-image';

interface ProductCardProps {
  product: Product;
  cityName: string;
  priority?: boolean;
}

const MAX_VISIBLE_BADGES = 3;

/** Tarjeta de producto del listado (renderizada en el servidor). */
export function ProductCard({ product, cityName, priority = false }: ProductCardProps): JSX.Element {
  const href = `/productos/${product.slug}`;
  const discount = formatDiscount(product.discountPct);
  const hasOffer = product.salePrice !== null;
  const badges = product.badges.slice(0, MAX_VISIBLE_BADGES);

  return (
    <article className="sf-card flex flex-col" data-testid="product-card" data-slug={product.slug}>
      <div className="relative">
        <Link href={href} className="block rounded-t-lg" aria-hidden="true" tabIndex={-1}>
          <ProductImage
            src={product.image}
            alt={product.name}
            priority={priority}
            className="aspect-square w-full bg-elevated"
          />
        </Link>
        {discount !== null ? (
          <span
            className="absolute left-2 top-2 rounded-full bg-danger px-2 py-1 text-2xs font-bold text-fg-inverse"
            data-testid="discount-badge"
          >
            {discount}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.brand !== null ? (
          <p className="text-2xs font-medium uppercase tracking-wide text-fg-tertiary">
            {product.brand}
          </p>
        ) : null}

        <h3 className="text-sm font-semibold leading-snug">
          <Link href={href} className="rounded hover:text-fg-accent">
            {product.name}
          </Link>
        </h3>

        {badges.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {badges.map((badge) => (
              <li key={badge} className="sf-chip px-2 py-0.5 text-2xs">
                {badge}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-col gap-1 pt-1">
          <p className="flex items-baseline gap-2 text-lg font-bold leading-tight">
            <span data-testid="product-price">
              {formatMoney(product.price, product.currency)}
            </span>
            {hasOffer && product.listPrice > product.price ? (
              // El «antes» es el precio de LISTA del maestro (el canal lo publica
              // aparte): no se inventa ningun descuento.
              <span
                className="text-xs font-medium text-fg-tertiary line-through"
                data-testid="product-list-price"
              >
                {formatMoney(product.listPrice, product.currency)}
              </span>
            ) : null}
          </p>
          {hasOffer ? (
            <p className="text-2xs font-semibold text-fg-success">Precio de oferta vigente</p>
          ) : null}
          <p
            className={`text-xs ${product.availability.inStock ? 'text-fg-success' : 'text-fg-error'}`}
            data-testid="product-availability"
          >
            {product.availability.inStock
              ? `Disponible: ${product.availability.available}`
              : `Sin existencia en ${cityName}`}
          </p>
        </div>
      </div>
    </article>
  );
}
