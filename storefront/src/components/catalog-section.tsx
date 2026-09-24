import type { Brand, CatalogPage, Seller, SortOption } from "@/lib/erp";
import type { QueryParams } from "@/lib/query";

import { Pager } from "./pager";
import { ProductFilters } from "./product-filters";
import { ProductGrid } from "./product-grid";

interface CatalogSectionProps {
  action: string;
  hidden: QueryParams;
  brands: readonly Brand[];
  /** Vendedores con catalogo publicado (F6): alimenta el filtro «Vendido por». */
  sellers: readonly Seller[];
  brand: string | undefined;
  seller: string | undefined;
  sort: SortOption;
  page: number;
  result: CatalogPage;
  cityName: string;
  /** Codigo de la ciudad elegida (quick-add de cada tarjeta). */
  cityCode: string;
  gridLabel: string;
  emptyMessage: string;
}

/**
 * Listado del catalogo (F9.3): panel de filtros, grilla y paginacion.
 * Lo comparten `/categorias/[slug]` y `/buscar`.
 *
 * En escritorio el panel queda **pegado** (`sticky`) mientras se recorre la
 * grilla; en movil va arriba, con la misma estructura.
 */
export function CatalogSection({
  action,
  hidden,
  brands,
  sellers,
  brand,
  seller,
  sort,
  page,
  result,
  cityName,
  cityCode,
  gridLabel,
  emptyMessage,
}: CatalogSectionProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="lg:sticky lg:top-32 lg:w-72 lg:shrink-0">
        <ProductFilters
          action={action}
          brands={brands}
          sellers={sellers}
          hidden={hidden}
          brand={brand}
          seller={seller}
          sort={sort}
          totalLabel={`${result.total} ${result.total === 1 ? "producto" : "productos"} · pagina ${result.page} de ${Math.max(result.totalPages, 1)}`}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <ProductGrid
          products={result.data}
          cityName={cityName}
          cityCode={cityCode}
          label={gridLabel}
          emptyMessage={emptyMessage}
          priorityCount={4}
        />
        <Pager
          basePath={action}
          params={{ ...hidden, brand, seller, sort }}
          page={page}
          totalPages={result.totalPages}
        />
      </div>
    </div>
  );
}
