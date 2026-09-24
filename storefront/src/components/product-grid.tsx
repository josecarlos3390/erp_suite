import type { Product } from '@/lib/erp';

import { ProductCard } from './product-card';
import { EmptyState } from './ui/empty-state';

interface ProductGridProps {
  products: readonly Product[];
  cityName: string;
  /** Codigo de la ciudad elegida (lo necesita el quick-add de cada tarjeta). */
  cityCode: string;
  label: string;
  emptyMessage?: string;
  priorityCount?: number;
  /**
   * `grid` (default): grilla responsive de 2/3/4 columnas.
   * `carousel`: carril horizontal con ajuste (para las ofertas de la home), con
   * la misma cantidad de tarjetas y el mismo `data-testid` que la grilla.
   */
  variant?: 'grid' | 'carousel';
}

/** Grilla de productos de la tienda (mobile-first: 2 columnas, luego 3 y 4). */
export function ProductGrid({
  products,
  cityName,
  cityCode,
  label,
  emptyMessage = 'No hay productos para mostrar.',
  priorityCount = 0,
  variant = 'grid',
}: ProductGridProps): JSX.Element {
  if (products.length === 0) {
    return (
      <EmptyState
        testId="empty-grid"
        title="No hay productos para mostrar"
        description={emptyMessage}
        actions={[
          { href: '/categorias', label: 'Ver todas las categorias', primary: true },
          { href: '/', label: 'Volver al inicio' },
        ]}
      />
    );
  }

  const listClass =
    variant === 'carousel'
      ? 'sf-scroll-x sf-scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0'
      : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';

  const itemClass =
    variant === 'carousel'
      ? 'flex w-[220px] sm:w-[248px]'
      : 'flex';

  return (
    <ul className={listClass} aria-label={label} data-testid="product-grid">
      {products.map((product, index) => (
        <li key={product.itemId} className={itemClass}>
          <div className="flex w-full">
            <ProductCard
              product={product}
              cityName={cityName}
              cityCode={cityCode}
              priority={index < priorityCount}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
