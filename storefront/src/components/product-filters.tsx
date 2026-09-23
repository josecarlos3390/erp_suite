import Link from 'next/link';

import { SORT_LABELS, SORT_OPTIONS, type Brand, type SortOption } from '@/lib/erp';
import { buildHref, type QueryParams } from '@/lib/query';

interface ProductFiltersProps {
  action: string;
  brands: readonly Brand[];
  hidden: QueryParams;
  brand: string | undefined;
  sort: SortOption;
  totalLabel: string;
}

const QUICK_BRANDS = 8;

/**
 * Filtros del listado: formulario GET (funciona sin JavaScript) + atajos de
 * marca como enlaces reales. Todo el estado vive en la URL y la lista la vuelve
 * a renderizar el servidor.
 *
 * Hueco declarado: el canal no acepta rango de precios, asi que la tienda no
 * ofrece ese filtro (no se filtra en el cliente porque romperia la paginacion).
 */
export function ProductFilters({
  action,
  brands,
  hidden,
  brand,
  sort,
  totalLabel,
}: ProductFiltersProps): JSX.Element {
  const quickBrands = brands.slice(0, QUICK_BRANDS);
  const clearHref = buildHref(action, { ...hidden, brand: undefined, sort: undefined, page: undefined });

  return (
    <section aria-labelledby="filtros-titulo" className="rounded-lg border border-line bg-base p-4">
      <h2 id="filtros-titulo" className="text-sm font-semibold text-fg">
        Filtros
      </h2>

      <form method="get" action={action} className="mt-3 flex flex-col gap-3">
        {Object.entries(hidden).map(([name, value]) =>
          value === undefined || value === '' ? null : (
            <input key={name} type="hidden" name={name} value={String(value)} />
          ),
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-marca" className="text-xs font-medium text-fg-secondary">
            Marca
          </label>
          <select
            id="filtro-marca"
            name="brand"
            defaultValue={brand ?? ''}
            className="sf-field"
            data-testid="filtro-marca"
          >
            <option value="">Todas las marcas</option>
            {brands.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} ({item.productCount})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-orden" className="text-xs font-medium text-fg-secondary">
            Orden
          </label>
          <select
            id="filtro-orden"
            name="sort"
            defaultValue={sort}
            className="sf-field"
            data-testid="filtro-orden"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="sf-btn bg-primary text-primary-fg hover:bg-primary-hover">
            Aplicar filtros
          </button>
          <Link href={clearHref} className="sf-link text-sm">
            Limpiar filtros
          </Link>
        </div>
      </form>

      {quickBrands.length > 0 ? (
        <div className="mt-4 border-t border-line-subtle pt-3">
          <p className="text-xs font-medium text-fg-secondary">Marcas frecuentes</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {quickBrands.map((item) => (
              <li key={item.code}>
                <Link
                  href={buildHref(action, {
                    ...hidden,
                    brand: brand === item.code ? undefined : item.code,
                    sort,
                  })}
                  className={`sf-chip ${brand === item.code ? 'border-primary border bg-primary-soft text-fg-accent' : ''}`}
                  aria-current={brand === item.code ? 'true' : undefined}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-fg-secondary" data-testid="filtros-resumen">
        {totalLabel}
      </p>
    </section>
  );
}
