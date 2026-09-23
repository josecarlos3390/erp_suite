import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { CatalogSection } from '@/components/catalog-section';
import { JsonLd } from '@/components/json-ld';
import { getCityContext } from '@/lib/city';
import {
  SORT_OPTIONS,
  getBrands,
  getCatalog,
  type SortOption,
} from '@/lib/erp';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { readPage, readParam, type SearchParams } from '@/lib/query';

const PAGE_SIZE = 24;

interface SearchPageProps {
  searchParams: SearchParams;
}

function parseSort(value: string | undefined): SortOption {
  const match = SORT_OPTIONS.find((option) => option === value);
  return match ?? 'relevance';
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const query = readParam(searchParams['q']);
  const title = query === undefined ? 'Buscar productos' : `Resultados para "${query}"`;
  return {
    title,
    description:
      query === undefined
        ? 'Busca en el catalogo publicado desde el ERP por nombre, marca o SKU.'
        : `Productos que el ERP devuelve para "${query}", con la existencia de tu ciudad.`,
    alternates: { canonical: '/buscar' },
    // Los resultados de busqueda no aportan al indice.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<JSX.Element> {
  const query = readParam(searchParams['q']);
  const crumbs = [{ label: 'Inicio', href: '/' }, { label: 'Buscar' }];

  if (query === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={crumbs} />
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-fg">Buscar productos</h1>
          <p className="text-sm text-fg-secondary">
            Escribe lo que buscas en el buscador de arriba (nombre, marca o SKU).
          </p>
        </header>

        <section
          className="rounded-lg border border-dashed border-line bg-elevated p-6"
          data-testid="search-empty-state"
        >
          <h2 className="text-sm font-semibold text-fg">Sugerencias</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            <li>
              <Link href="/categorias" className="sf-link">
                Recorrer todas las categorias
              </Link>
            </li>
            <li>
              <Link href="/" className="sf-link">
                Ver las ofertas vigentes de la home
              </Link>
            </li>
          </ul>
        </section>

        <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-buscar" />
      </div>
    );
  }

  const brand = readParam(searchParams['brand']);
  const sort = parseSort(readParam(searchParams['sort']));
  const page = readPage(searchParams['page']);
  const { city } = await getCityContext();

  const [result, brands] = await Promise.all([
    getCatalog({ search: query, brand, sort, page, limit: PAGE_SIZE, city: city.code }),
    getBrands(),
  ]);

  const action = '/buscar';

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">
          Resultados para <span className="text-fg-accent">{query}</span>
        </h1>
        <p className="text-sm text-fg-secondary" data-testid="search-summary">
          {result.total} {result.total === 1 ? 'producto' : 'productos'} · existencia en {city.name}
        </p>
      </header>

      {result.total === 0 ? (
        <section
          className="flex flex-col gap-3 rounded-lg border border-dashed border-line bg-elevated p-6"
          data-testid="search-empty-state"
        >
          <h2 className="text-lg font-semibold text-fg">No encontramos productos para esa busqueda</h2>
          <p className="max-w-xl text-sm text-fg-secondary">
            Revisa la ortografia, prueba con menos palabras o recorre las categorias publicadas. La
            busqueda la resuelve el ERP sobre el catalogo publicado.
          </p>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link href="/categorias" className="sf-btn-secondary">
                Ver categorias
              </Link>
            </li>
            <li>
              <Link href="/" className="sf-btn-secondary">
                Volver al inicio
              </Link>
            </li>
          </ul>
        </section>
      ) : (
        <CatalogSection
          action={action}
          hidden={{ q: query }}
          brands={brands}
          brand={brand}
          sort={sort}
          page={page}
          result={result}
          cityName={city.name}
          gridLabel={`Resultados de ${query}`}
          emptyMessage="No hay resultados en esta pagina con los filtros elegidos."
        />
      )}

      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-buscar" />
    </div>
  );
}
