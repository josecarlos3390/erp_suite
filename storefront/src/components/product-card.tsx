import Link from 'next/link';

import type { Product } from '@/lib/erp';
import { formatDiscount } from '@/lib/format';

import { ProductImage } from './product-image';
import { Badge } from './ui/badge';
import { Price } from './ui/price';

interface ProductCardProps {
  product: Product;
  cityName: string;
  priority?: boolean;
}

const MAX_VISIBLE_BADGES = 3;

/**
 * Tarjeta de producto de la tienda (F9.1/F9.3).
 *
 * Es la pieza que mas se repite en la tienda, asi que concentra la jerarquia:
 * **imagen** (o el placeholder propio, D24), **descuento** como etiqueta,
 * **marca** como antetitulo, **nombre** a dos lineas y **precio protagonista**
 * con el «antes» y el ahorro. Se eleva al pasar el puntero (`sf-card-hover`) y la
 * imagen hace un zoom sutil.
 *
 * Los `data-testid` son contrato con el E2E de la tienda (`product-card`,
 * `product-price`, `product-list-price`, `discount-badge`, `product-availability`).
 */
export function ProductCard({ product, cityName, priority = false }: ProductCardProps): JSX.Element {
  const href = `/productos/${product.slug}`;
  const discount = formatDiscount(product.discountPct);
  const hasOffer = product.salePrice !== null;
  const badges = product.badges.slice(0, MAX_VISIBLE_BADGES);

  return (
    <article
      className="sf-card sf-card-hover group flex w-full flex-col overflow-hidden"
      data-testid="product-card"
      data-slug={product.slug}
    >
      <div className="relative">
        <Link href={href} className="block" aria-hidden="true" tabIndex={-1}>
          <ProductImage
            src={product.image}
            alt={product.name}
            name={product.name}
            brand={product.brand}
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="aspect-square w-full"
          />
        </Link>

        {discount !== null ? (
          <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
            <Badge variant="deal" testId="discount-badge" srLabel={`Descuento de ${discount}`}>
              {discount}
            </Badge>
          </span>
        ) : null}

        {!product.availability.inStock ? (
          <span className="absolute right-2 top-2">
            <Badge variant="outline">Agotado</Badge>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.brand !== null ? <p className="sf-eyebrow">{product.brand}</p> : null}

        <h3 className="text-sm font-semibold leading-snug text-fg">
          <Link href={href} className="rounded line-clamp-2 hover:text-fg-accent">
            {product.name}
          </Link>
        </h3>

        {badges.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {badges.map((badge) => (
              <li key={badge}>
                <span className="sf-chip px-2 py-0.5 text-2xs">{badge}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <Price
            price={product.price}
            currency={product.currency}
            listPrice={product.listPrice}
            caption={hasOffer ? 'Oferta vigente' : null}
          />

          <p
            className={`flex items-center gap-1.5 text-xs font-medium ${
              product.availability.inStock ? 'text-price-free' : 'text-fg-error'
            }`}
            data-testid="product-availability"
          >
            <span
              aria-hidden="true"
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                product.availability.inStock ? 'bg-price-free' : 'bg-fg-error'
              }`}
            />
            {product.availability.inStock
              ? `Disponible: ${product.availability.available}`
              : `Sin existencia en ${cityName}`}
          </p>
        </div>
      </div>
    </article>
  );
}
