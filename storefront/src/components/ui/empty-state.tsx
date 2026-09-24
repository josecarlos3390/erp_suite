import Link from 'next/link';
import type { ReactNode } from 'react';

import { SearchIcon } from './icons';

interface EmptyStateProps {
  title: string;
  description: string;
  /** Nombre del testid (los E2E de la tienda lo usan: `empty-grid`, `search-empty-state`). */
  testId?: string;
  icon?: ReactNode;
  actions?: readonly { href: string; label: string; primary?: boolean }[];
}

/**
 * Estado vacio de la tienda (F9.3): mismo lenguaje visual en el catalogo, la
 * busqueda y las categorias sin productos. Explica **por que** puede estar vacio
 * (el catalogo lo publica el ERP) y ofrece una salida, en vez de dejar un texto
 * suelto.
 */
export function EmptyState({
  title,
  description,
  testId,
  icon,
  actions = [],
}: EmptyStateProps): JSX.Element {
  return (
    <section className="sf-panel flex flex-col items-center gap-3 py-10 text-center" data-testid={testId}>
      <span
        aria-hidden="true"
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-fg-accent"
      >
        {icon ?? <SearchIcon />}
      </span>
      <h2 className="sf-h3 text-fg">{title}</h2>
      <p className="max-w-xl text-sm text-fg-secondary">{description}</p>
      {actions.length > 0 ? (
        <ul className="mt-1 flex flex-wrap justify-center gap-2">
          {actions.map((action) => (
            <li key={action.href}>
              <Link
                href={action.href}
                className={
                  action.primary === true ? 'sf-btn sf-btn-primary' : 'sf-btn sf-btn-secondary'
                }
              >
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
