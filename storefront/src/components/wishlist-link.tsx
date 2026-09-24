'use client';

import Link from 'next/link';

import { useWishlistEntries } from '@/store/wishlist';

/**
 * Enlace a **favoritos** con su contador (F6).
 *
 * Como el del comparador, aparece **solo cuando hay algo guardado**: la cabecera ya lleva
 * buscador, ciudad, tema, comparador y carrito, y una accion que lleva a una lista vacia no
 * ayuda. Los favoritos se agregan desde el control «Guardar» de cada tarjeta y de la ficha.
 */
export function WishlistLink(): JSX.Element | null {
  const { entries, hydrated } = useWishlistEntries();
  if (!hydrated || entries.length === 0) return null;

  return (
    <Link
      href="/favoritos"
      className="sf-btn sf-btn-secondary gap-2 px-3"
      aria-label={`Favoritos, ${entries.length} productos guardados`}
      data-testid="wishlist-link"
    >
      <span aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <path d="M12 20s-7-4.3-7-9.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7 3.1c0 5-7 9.3-7 9.3z" />
        </svg>
      </span>
      <span className="hidden sm:inline">Favoritos</span>
      <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary-soft px-1.5 text-2xs font-bold text-fg-accent">
        <span data-testid="wishlist-count">{entries.length}</span>
      </span>
    </Link>
  );
}
