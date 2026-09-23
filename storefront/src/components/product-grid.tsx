import type { Product } from '@/lib/erp';

import { ProductCard } from './product-card';

interface ProductGridProps {
  products: readonly Product[];
  cityName: string;
  label: string;
  emptyMessage?: string;
  priorityCount?: number;
}

/** Grilla de productos (mobile-first: 2 columnas, luego 3 y 4). */
export function ProductGrid({
  products,
  cityName,
  label,
  emptyMessage = 'No hay productos para mostrar.',
  priorityCount = 0,
}: ProductGridProps): JSX.Element {
  if (products.length === 0) {
    return (
      <p
        className="rounded-lg border border-dashed border-line bg-elevated p-6 text-center text-sm text-fg-secondary"
        data-testid="empty-grid"
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      aria-label={label}
      data-testid="product-grid"
    >
      {products.map((product, index) => (
        <li key={product.itemId} className="flex">
          <div className="flex w-full">
            <ProductCard
              product={product}
              cityName={cityName}
              priority={index < priorityCount}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
