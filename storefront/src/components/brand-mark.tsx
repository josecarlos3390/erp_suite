import Link from 'next/link';

import { SITE_NAME } from '@/lib/site';

interface BrandMarkProps {
  /** `true` para el pie (monocromo, sin enlace). */
  plain?: boolean;
  className?: string;
}

/**
 * Marca de la tienda (F9.1).
 *
 * Identidad por defecto del tema «retail tecnologico premium» (D22/D23): un
 * monograma en el color de marca con la silueta de una bolsa de compra y el
 * nombre de la tienda. Un tenant puede sustituirlo por su logo real
 * (`SITE_NAME` + hoja de marca), que es lo que pide D23.
 */
export function BrandMark({ plain = false, className }: BrandMarkProps): JSX.Element {
  const content = (
    <>
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-primary-fg shadow-cta"
        style={{ backgroundImage: 'linear-gradient(150deg, var(--sf-brand-500), var(--sf-brand-700))' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4L5.5 8Z" />
          <path d="M9 8V6.2a3 3 0 0 1 6 0V8" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-md font-extrabold tracking-tight text-fg">{SITE_NAME}</span>
        <span className="sf-eyebrow mt-0.5 hidden sm:block">Catalogo en linea</span>
      </span>
    </>
  );

  if (plain) {
    return <span className={`flex items-center gap-2 ${className ?? ''}`}>{content}</span>;
  }

  return (
    <Link href="/" className={`flex items-center gap-2 rounded ${className ?? ''}`}>
      {content}
    </Link>
  );
}
