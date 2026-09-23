import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { CategoryCards } from '@/components/category-cards';
import { JsonLd } from '@/components/json-ld';
import { getCategories } from '@/lib/erp';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Categorias',
  description:
    'Todas las categorias publicadas en el ERP, con la cantidad de productos de cada una (incluye sus subcategorias).',
  alternates: { canonical: '/categorias' },
};

export default async function CategoriesPage(): Promise<JSX.Element> {
  const categories = await getCategories();
  const crumbs = [{ label: 'Inicio', href: '/' }, { label: 'Categorias' }];
  const total = categories.reduce((sum, category) => sum + category.productCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">Categorias</h1>
        <p className="text-sm text-fg-secondary">
          {categories.length} categorias raiz · {total} productos publicados.
        </p>
      </header>

      <CategoryCards categories={categories} />

      <section aria-labelledby="subcategorias-titulo" className="flex flex-col gap-4">
        <h2 id="subcategorias-titulo" className="text-lg font-semibold text-fg">
          Arbol publicado
        </h2>
        <ul className="flex flex-col gap-3">
          {categories.map((root) => (
            <li key={root.slug} className="rounded-lg border border-line bg-base p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/categorias/${root.slug}`}
                  className="text-sm font-semibold text-fg hover:text-fg-accent"
                >
                  {root.name}
                </Link>
                <span className="text-xs text-fg-tertiary">{root.productCount} productos</span>
              </div>
              {root.children.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {root.children.map((child) => (
                    <li key={child.slug}>
                      <Link href={`/categorias/${child.slug}`} className="sf-chip">
                        {child.name} ({child.productCount})
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-fg-tertiary">Sin subcategorias.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-categorias" />
    </div>
  );
}
