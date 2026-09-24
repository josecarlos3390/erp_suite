import Link from "next/link";

import {
  SORT_LABELS,
  SORT_OPTIONS,
  type Brand,
  type Seller,
  type SortOption,
} from "@/lib/erp";
import { buildHref, type QueryParams } from "@/lib/query";

interface ProductFiltersProps {
  action: string;
  brands: readonly Brand[];
  /** Vendedores con catalogo publicado (F6): el filtro «Vendido por». */
  sellers: readonly Seller[];
  hidden: QueryParams;
  brand: string | undefined;
  seller: string | undefined;
  sort: SortOption;
  totalLabel: string;
}

const QUICK_BRANDS = 8;

/**
 * Filtros del listado (F9.1/F9.3): formulario GET (funciona sin JavaScript) con
 * los `select` **nativos** que el E2E maneja (`filtro-marca`, `filtro-orden`) mas
 * atajos de marca como enlaces reales. Todo el estado vive en la URL y la lista la
 * vuelve a renderizar el servidor.
 *
 * Hueco declarado: el canal no acepta rango de precios, asi que la tienda no
 * ofrece ese filtro (no se filtra en el cliente porque romperia la paginacion).
 */
export function ProductFilters({
  action,
  brands,
  sellers,
  hidden,
  brand,
  seller,
  sort,
  totalLabel,
}: ProductFiltersProps): JSX.Element {
  const quickBrands = brands.slice(0, QUICK_BRANDS);
  const clearHref = buildHref(action, {
    ...hidden,
    brand: undefined,
    seller: undefined,
    sort: undefined,
    page: undefined,
  });
  const hasFilters =
    brand !== undefined || seller !== undefined || sort !== "relevance";

  return (
    <section
      className="sf-card flex flex-col gap-4 p-4"
      aria-labelledby="filtros-titulo"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 id="filtros-titulo" className="sf-h3 text-fg">
          Filtros
        </h2>
        <span aria-hidden="true" className="text-fg-tertiary">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </span>
      </header>

      <form method="get" action={action} className="flex flex-col gap-4">
        {Object.entries(hidden).map(([name, value]) =>
          value === undefined || value === "" ? null : (
            <input key={name} type="hidden" name={name} value={String(value)} />
          ),
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtro-marca" className="sf-eyebrow">
            Marca
          </label>
          <select
            id="filtro-marca"
            name="brand"
            defaultValue={brand ?? ""}
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtro-vendedor" className="sf-eyebrow">
            Vendido por
          </label>
          <select
            id="filtro-vendedor"
            name="seller"
            defaultValue={seller ?? ""}
            className="sf-field"
            data-testid="filtro-vendedor"
          >
            <option value="">Todos los vendedores</option>
            {sellers.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} ({item.productCount})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtro-orden" className="sf-eyebrow">
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
          <button type="submit" className="sf-btn sf-btn-primary flex-1">
            Aplicar
          </button>
          {hasFilters ? (
            <Link href={clearHref} className="sf-link text-sm font-medium">
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {quickBrands.length > 0 ? (
        <div className="border-t border-line-subtle pt-3">
          <p className="sf-eyebrow">Marcas frecuentes</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {quickBrands.map((item) => {
              const active = brand === item.code;
              return (
                <li key={item.code}>
                  <Link
                    href={buildHref(action, {
                      ...hidden,
                      brand: active ? undefined : item.code,
                      sort,
                    })}
                    className={`sf-chip ${active ? "border-primary bg-primary-soft font-semibold text-fg-accent" : ""}`}
                    aria-current={active ? "true" : undefined}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p
        className="border-t border-line-subtle pt-3 text-xs font-medium text-fg-secondary"
        data-testid="filtros-resumen"
      >
        {totalLabel}
      </p>
    </section>
  );
}
