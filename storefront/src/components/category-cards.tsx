import Link from 'next/link';

import type { CategoryNode } from '@/lib/erp';
import { productMonogram } from '@/lib/media';

import { ProductImage } from './product-image';

interface CategoryCardsProps {
  categories: readonly CategoryNode[];
}

/**
 * Tarjetas de categoria raiz (F9.2): pieza visual con la imagen del ERP si la
 * publica y, si no, el placeholder de la tienda (monograma + halo), el nombre y
 * el conteo (incluye descendientes, lo calcula el ERP).
 */
export function CategoryCards({ categories }: CategoryCardsProps): JSX.Element {
  if (categories.length === 0) {
    return (
      <p className="sf-panel text-sm text-fg-secondary">
        El ERP no devolvio categorias publicadas.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="category-cards">
      {categories.map((category) => (
        <li key={category.slug}>
          <Link
            href={`/categorias/${category.slug}`}
            className="sf-card sf-card-hover group flex h-full flex-col overflow-hidden"
            data-testid="category-card"
            data-slug={category.slug}
          >
            {category.imageUrl !== null && category.imageUrl.trim() !== '' ? (
              <ProductImage
                src={category.imageUrl}
                alt={category.name}
                name={category.name}
                placeholderSize="lg"
                sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
                className="aspect-[4/3] w-full"
              />
            ) : (
              <span
                aria-hidden="true"
                className="relative flex aspect-[4/3] w-full items-center justify-center"
                style={{ background: 'var(--sf-media-bg)' }}
                data-placeholder="true"
              >
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 50% 0%, var(--sf-brand-100) 0%, transparent 62%)',
                    opacity: 0.7,
                  }}
                />
                <span
                  className="relative text-3xl font-bold leading-none tracking-tight"
                  style={{ color: 'var(--sf-media-ink)', opacity: 0.62 }}
                >
                  {productMonogram(category.name)}
                </span>
              </span>
            )}

            <span className="flex flex-1 items-center justify-between gap-2 p-3">
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-fg transition-colors duration-fast group-hover:text-fg-accent">
                  {category.name}
                </span>
                <span className="text-2xs text-fg-tertiary">
                  {category.productCount} {category.productCount === 1 ? 'producto' : 'productos'}
                </span>
              </span>
              <span aria-hidden="true" className="text-fg-tertiary transition-transform duration-fast group-hover:translate-x-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
