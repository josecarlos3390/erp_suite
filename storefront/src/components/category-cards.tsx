import Link from 'next/link';

import type { CategoryNode } from '@/lib/erp';

interface CategoryCardsProps {
  categories: readonly CategoryNode[];
}

/** Tarjetas de categoria raiz con su conteo (incluye descendientes, lo calcula el ERP). */
export function CategoryCards({ categories }: CategoryCardsProps): JSX.Element {
  if (categories.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-elevated p-4 text-sm text-fg-secondary">
        El ERP no devolvio categorias publicadas.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="category-cards">
      {categories.map((category) => (
        <li key={category.slug}>
          <Link
            href={`/categorias/${category.slug}`}
            className="sf-card flex h-full flex-col items-center gap-2 p-4 text-center"
            data-testid="category-card"
            data-slug={category.slug}
          >
            <span className="text-sm font-semibold text-fg">{category.name}</span>
            <span className="text-xs text-fg-tertiary">
              {category.productCount} {category.productCount === 1 ? 'producto' : 'productos'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
