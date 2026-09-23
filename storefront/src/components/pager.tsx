import Link from 'next/link';

import { buildHref, type QueryParams } from '@/lib/query';

interface PagerProps {
  basePath: string;
  params: QueryParams;
  page: number;
  totalPages: number;
}

const MAX_LINKS = 5;

/** Paginacion server-rendered: enlaces reales, sin JavaScript. */
export function Pager({ basePath, params, page, totalPages }: PagerProps): JSX.Element | null {
  if (totalPages <= 1) return null;

  const start = Math.max(1, Math.min(page - Math.floor(MAX_LINKS / 2), totalPages - MAX_LINKS + 1));
  const end = Math.min(totalPages, start + MAX_LINKS - 1);
  const pages: number[] = [];
  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  const linkClass = 'inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md border border-line px-2 text-sm';

  return (
    <nav aria-label="Paginacion" className="flex flex-wrap items-center justify-center gap-2 py-6">
      {page > 1 ? (
        <Link
          href={buildHref(basePath, { ...params, page: page - 1 })}
          className={`${linkClass} text-fg hover:bg-hover`}
          rel="prev"
        >
          Anterior
        </Link>
      ) : null}

      {pages.map((current) =>
        current === page ? (
          <span
            key={current}
            aria-current="page"
            className={`${linkClass} bg-primary font-semibold text-primary-fg`}
          >
            {current}
          </span>
        ) : (
          <Link
            key={current}
            href={buildHref(basePath, { ...params, page: current })}
            className={`${linkClass} text-fg hover:bg-hover`}
          >
            {current}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={buildHref(basePath, { ...params, page: page + 1 })}
          className={`${linkClass} text-fg hover:bg-hover`}
          rel="next"
          data-testid="pager-next"
        >
          Siguiente
        </Link>
      ) : null}
    </nav>
  );
}
