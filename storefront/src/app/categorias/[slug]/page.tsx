import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { CatalogSection } from '@/components/catalog-section';
import { JsonLd } from '@/components/json-ld';
import { getCityContext } from '@/lib/city';
import {
  SORT_LABELS,
  SORT_OPTIONS,
  findCategory,
  findCategoryPath,
  getBrands,
  getCatalog,
  getCategories,
  type SortOption,
} from '@/lib/erp';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { readPage, readParam, type SearchParams } from '@/lib/query';

const PAGE_SIZE = 24;

interface CategoryPageProps {
  params: { slug: string };
  searchParams: SearchParams;
}

function parseSort(value: string | undefined): SortOption {
  const match = SORT_OPTIONS.find((option) => option === value);
  return match ?? 'relevance';
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const categories = await getCategories();
  const node = findCategory(categories, params.slug);
  if (node === null) {
    return { title: 'Categoria no encontrada', robots: { index: false, follow: false } };
  }
  const title = node.name;
  const description = `${node.productCount} productos en ${node.name}, con la existencia de tu ciudad y el precio publicado por el ERP.`;
  return {
    title,
    description,
    alternates: { canonical: `/categorias/${node.slug}` },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps): Promise<JSX.Element> {
  const categories = await getCategories();
  const node = findCategory(categories, params.slug);
  if (node === null) {
    notFound();
  }

  const brand = readParam(searchParams['brand']);
  const sort = parseSort(readParam(searchParams['sort']));
  const page = readPage(searchParams['page']);
  const { city } = await getCityContext();

  // El canal devuelve tambien los productos de las subcategorias cuando se pide
  // la categoria padre: la tienda solo pasa `category=slug`.
  const [result, brands] = await Promise.all([
    getCatalog({
      category: node.slug,
      brand,
      sort,
      page,
      limit: PAGE_SIZE,
      city: city.code,
    }),
    // La faceta de marcas se acota a la categoria (y sus subcategorias): ofrecer una
    // marca que en esta categoria da 0 resultados es un filtro que solo lleva al vacio.
    getBrands(node.slug),
  ]);

  const path = findCategoryPath(categories, node.slug);
  const crumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Categorias', href: '/categorias' },
    ...path.map((item, index) => ({
      label: item.name,
      href: index === path.length - 1 ? undefined : `/categorias/${item.slug}`,
    })),
  ];

  const activeFilters: string[] = [];
  if (brand !== undefined) activeFilters.push(`marca ${brand}`);
  if (sort !== 'relevance') activeFilters.push(`orden ${SORT_LABELS[sort]}`);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-fg" data-testid="category-title">
          {node.name}
        </h1>
        <p className="text-sm text-fg-secondary">
          {result.total} productos{node.children.length > 0 ? ' (incluye subcategorias)' : ''} ·
          existencia en {city.name}
          {activeFilters.length > 0 ? ` · filtros: ${activeFilters.join(', ')}` : ''}
        </p>
      </header>

      {node.children.length > 0 ? (
        <nav aria-label="Subcategorias" className="flex flex-wrap gap-2">
          {node.children.map((child) => (
            <Link key={child.slug} href={`/categorias/${child.slug}`} className="sf-chip">
              {child.name} ({child.productCount})
            </Link>
          ))}
        </nav>
      ) : null}

      <CatalogSection
        action={`/categorias/${node.slug}`}
        hidden={{}}
        brands={brands}
        brand={brand}
        sort={sort}
        page={page}
        result={result}
        cityName={city.name}
        gridLabel={`Productos de ${node.name}`}
        emptyMessage={`No hay productos publicados en ${node.name} con los filtros elegidos.`}
      />

      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-categoria" />
    </div>
  );
}
