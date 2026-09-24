'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { CategoryNode } from '@/lib/erp';

interface CategoryNavProps {
  categories: readonly CategoryNode[];
}

/**
 * Navegacion de categorias del encabezado (F9.1).
 *
 * Se arma con el arbol publicado del canal (15 raices en el seed). Las raices con
 * hijas usan `<details>`: despliegan sin JavaScript y son accesibles por teclado.
 *
 * Es un **islote cliente** (declarado) unicamente para marcar la categoria activa
 * con `aria-current="page"` a partir de la ruta; no habla con el ERP.
 */
export function CategoryNav({ categories }: CategoryNavProps): JSX.Element {
  const pathname = usePathname();

  if (categories.length === 0) {
    return (
      <div className="border-t border-line-subtle bg-elevated">
        <p className="sf-container py-2 text-xs text-fg-tertiary">
          El ERP no devolvio categorias publicadas.
        </p>
      </div>
    );
  }

  const allActive = pathname === '/categorias';

  return (
    <nav aria-label="Categorias" className="border-t border-line-subtle bg-elevated">
      <ul className="sf-container sf-scrollbar-none flex items-center gap-1 overflow-x-auto py-1.5 text-sm">
        <li className="shrink-0">
          <Link
            href="/categorias"
            aria-current={allActive ? 'page' : undefined}
            className={`inline-flex min-h-[36px] items-center rounded-full px-3 font-semibold transition-colors duration-fast ${
              allActive
                ? 'bg-primary-soft text-fg-accent'
                : 'text-fg hover:bg-hover hover:text-fg-accent'
            }`}
          >
            Todas las categorias
          </Link>
        </li>
        {categories.map((root) => {
          const active = pathname === `/categorias/${root.slug}`;

          if (root.children.length === 0) {
            return (
              <li key={root.slug} className="shrink-0">
                <Link
                  href={`/categorias/${root.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-[36px] items-center rounded-full px-3 transition-colors duration-fast ${
                    active
                      ? 'bg-primary-soft font-semibold text-fg-accent'
                      : 'text-fg-secondary hover:bg-hover hover:text-fg'
                  }`}
                  data-testid="nav-category"
                >
                  {root.name}
                </Link>
              </li>
            );
          }

          return (
            <li key={root.slug} className="relative shrink-0">
              <details className="group">
                <summary
                  className={`inline-flex min-h-[36px] cursor-pointer list-none items-center gap-1 rounded-full px-3 transition-colors duration-fast ${
                    active
                      ? 'bg-primary-soft font-semibold text-fg-accent'
                      : 'text-fg-secondary hover:bg-hover hover:text-fg'
                  }`}
                  data-testid="nav-category"
                >
                  {root.name}
                  <span
                    aria-hidden="true"
                    className="text-2xs text-fg-tertiary transition-transform duration-fast group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>
                <ul className="absolute left-0 z-panel mt-2 min-w-[240px] rounded-card border border-line bg-base p-2 shadow-layered">
                  <li>
                    <Link
                      href={`/categorias/${root.slug}`}
                      className="block rounded px-2 py-1.5 text-sm font-semibold text-fg hover:bg-hover"
                    >
                      Todo en {root.name}
                    </Link>
                  </li>
                  {root.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/categorias/${child.slug}`}
                        className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm text-fg-secondary hover:bg-hover hover:text-fg"
                      >
                        <span>{child.name}</span>
                        <span className="text-2xs text-fg-tertiary">{child.productCount}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
