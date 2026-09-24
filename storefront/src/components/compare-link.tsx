'use client';

import Link from 'next/link';

import { MAX_COMPARE_ITEMS, useCompareEntries } from '@/store/compare';

/**
 * Enlace al **comparador** con su contador (F6).
 *
 * Aparece **solo cuando hay algo que comparar**: la cabecera ya lleva buscador, ciudad, tema y
 * carrito, asi que no se ocupa sitio con una accion que llevaria a un estado vacio. El
 * comparador se alcanza desde el control «Comparar» de cada tarjeta y de la ficha.
 */
export function CompareLink(): JSX.Element | null {
  const { entries, hydrated } = useCompareEntries();
  if (!hydrated || entries.length === 0) return null;

  return (
    <Link
      href="/comparar"
      className="sf-btn sf-btn-secondary gap-2 px-3"
      aria-label={`Comparar ${entries.length} productos`}
      data-testid="compare-link"
    >
      <span aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <path d="M4 7h10M4 17h10M17 4v6M14 7h6M17 14v6M14 17h6" />
        </svg>
      </span>
      <span className="hidden sm:inline">Comparar</span>
      <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary-soft px-1.5 text-2xs font-bold text-fg-accent">
        {/* El `data-testid` lleva **solo** el numero: el texto para lectores de pantalla va
            aparte, asi el E2E lee el dato y no una frase. */}
        <span data-testid="compare-count">{entries.length}</span>
        <span className="sr-only"> de {MAX_COMPARE_ITEMS}</span>
      </span>
    </Link>
  );
}
