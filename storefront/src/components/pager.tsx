import Link from 'next/link';

import { buildHref, type QueryParams } from '@/lib/query';

interface PagerProps {
  basePath: string;
  params: QueryParams;
  page: number;
  totalPages: number;
}

const MAX_LINKS = 5;

/**
 * Paginacion server-rendered (F9.3): enlaces reales, sin JavaScript.
 *
 * El `nav` conserva el nombre accesible **`Paginacion`** y el enlace de avance su
 * `data-testid="pager-next"`: son contrato con el E2E de la tienda.
 */
export function Pager({ basePath, params, page, totalPages }: PagerProps): JSX.Element | null {
  if (totalPages <= 1) return null;

  const start = Math.max(1, Math.min(page - Math.floor(MAX_LINKS / 2), totalPages - MAX_LINKS + 1));
  const end = Math.min(totalPages, start + MAX_LINKS - 1);
  const pages: number[] = [];
  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  const linkClass =
    'inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-btn border border-line bg-base px-3 text-sm font-medium text-fg transition-colors duration-fast hover:border-primary hover:text-fg-accent';

  return (
    <nav aria-label="Paginacion" className="flex flex-wrap items-center justify-center gap-2 py-6">
      {page > 1 ? (
        <Link href={buildHref(basePath, { ...params, page: page - 1 })} className={linkClass} rel="prev">
          Anterior
        </Link>
      ) : null}

      {pages.map((current) =>
        current === page ? (
          <span
            key={current}
            aria-current="page"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-btn bg-primary px-3 text-sm font-semibold text-primary-fg"
          >
            {current}
          </span>
        ) : (
          <Link
            key={current}
            href={buildHref(basePath, { ...params, page: current })}
            className={linkClass}
          >
            {current}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={buildHref(basePath, { ...params, page: page + 1 })}
          className={linkClass}
          rel="next"
          data-testid="pager-next"
        >
          Siguiente
        </Link>
      ) : null}
    </nav>
  );
}
