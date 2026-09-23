import type { Brand, CatalogPage, SortOption } from '@/lib/erp';
import type { QueryParams } from '@/lib/query';

import { Pager } from './pager';
import { ProductFilters } from './product-filters';
import { ProductGrid } from './product-grid';

interface CatalogSectionProps {
  action: string;
  hidden: QueryParams;
  brands: readonly Brand[];
  brand: string | undefined;
  sort: SortOption;
  page: number;
  result: CatalogPage;
  cityName: string;
  gridLabel: string;
  emptyMessage: string;
}

/**
 * Listado del catalogo: filtros (formulario GET), grilla y paginacion.
 * Lo comparten `/categorias/[slug]` y `/buscar`.
 */
export function CatalogSection({
  action,
  hidden,
  brands,
  brand,
  sort,
  page,
  result,
  cityName,
  gridLabel,
  emptyMessage,
}: CatalogSectionProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="lg:w-72 lg:shrink-0">
        <ProductFilters
          action={action}
          brands={brands}
          hidden={hidden}
          brand={brand}
          sort={sort}
          totalLabel={`${result.total} ${result.total === 1 ? 'producto' : 'productos'} · pagina ${result.page} de ${Math.max(result.totalPages, 1)}`}
        />
      </div>

      <div className="flex-1">
        <ProductGrid
          products={result.data}
          cityName={cityName}
          label={gridLabel}
          emptyMessage={emptyMessage}
          priorityCount={4}
        />
        <Pager
          basePath={action}
          params={{ ...hidden, brand, sort }}
          page={page}
          totalPages={result.totalPages}
        />
      </div>
    </div>
  );
}
