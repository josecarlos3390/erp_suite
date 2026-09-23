import Link from 'next/link';

import type { CategoryNode } from '@/lib/erp';

interface CategoryNavProps {
  categories: readonly CategoryNode[];
}

/**
 * Navegacion de categorias del encabezado.
 *
 * Se arma con el arbol publicado del canal (15 raices en el seed). Las raices con
 * hijas usan `<details>`: despliegan sin JavaScript y son accesibles por teclado.
 */
export function CategoryNav({ categories }: CategoryNavProps): JSX.Element {
  if (categories.length === 0) {
    return <p className="text-xs text-fg-tertiary">El ERP no devolvio categorias publicadas.</p>;
  }

  return (
    <nav aria-label="Categorias" className="border-t border-line-subtle bg-elevated">
      <ul className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
        <li className="shrink-0">
          <Link
            href="/categorias"
            className="inline-flex min-h-[36px] items-center rounded-md px-3 font-semibold text-fg hover:bg-hover"
          >
            Todas las categorias
          </Link>
        </li>
        {categories.map((root) =>
          root.children.length === 0 ? (
            <li key={root.slug} className="shrink-0">
              <Link
                href={`/categorias/${root.slug}`}
                className="inline-flex min-h-[36px] items-center rounded-md px-3 text-fg hover:bg-hover"
                data-testid="nav-category"
              >
                {root.name}
              </Link>
            </li>
          ) : (
            <li key={root.slug} className="relative shrink-0">
              <details className="group">
                <summary
                  className="inline-flex min-h-[36px] cursor-pointer list-none items-center gap-1 rounded-md px-3 text-fg hover:bg-hover"
                  data-testid="nav-category"
                >
                  {root.name}
                  <span aria-hidden="true" className="text-2xs text-fg-tertiary">
                    ▾
                  </span>
                </summary>
                <ul className="absolute left-0 z-panel mt-1 min-w-[220px] rounded-md border border-line bg-base p-2 shadow-lg">
                  <li>
                    <Link
                      href={`/categorias/${root.slug}`}
                      className="block rounded px-2 py-1 text-sm font-semibold text-fg hover:bg-hover"
                    >
                      Todo en {root.name}
                    </Link>
                  </li>
                  {root.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/categorias/${child.slug}`}
                        className="block rounded px-2 py-1 text-sm text-fg-secondary hover:bg-hover"
                      >
                        {child.name} ({child.productCount})
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
