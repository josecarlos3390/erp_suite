import Link from 'next/link';

import type { Crumb } from '@/lib/jsonld';

interface BreadcrumbsProps {
  items: readonly Crumb[];
}

/** Migas de pan accesibles (el JSON-LD se emite aparte con breadcrumbJsonLd). */
export function Breadcrumbs({ items }: BreadcrumbsProps): JSX.Element {
  return (
    <nav aria-label="Miga de pan" className="text-xs text-fg-secondary">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-fg-tertiary">
                  /
                </span>
              ) : null}
              {item.href !== undefined && !isLast ? (
                <Link href={item.href} className="sf-link">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-fg">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
