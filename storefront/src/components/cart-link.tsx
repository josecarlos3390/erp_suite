'use client';

import Link from 'next/link';

import { cartItemCount, useCartStore } from '@/store/cart';

/**
 * Enlace al carrito con el contador de unidades (leido tras el montaje).
 *
 * Es la accion principal de la cabecera, asi que usa el boton de marca; el
 * contador va en una burbuja con contraste para que se lea de un vistazo.
 */
export function CartLink(): JSX.Element {
  const lines = useCartStore((state) => state.lines);
  const count = cartItemCount(lines);

  return (
    <Link
      href="/carrito"
      className="sf-btn sf-btn-primary gap-2 px-3 sm:px-4"
      aria-label={`Carrito de compras, ${count} unidades`}
      data-testid="cart-link"
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
          <path d="M3 4h2l2.4 11.2a1 1 0 001 .8h8.4a1 1 0 001-.8L20 7H6" />
          <circle cx="9.5" cy="19" r="1.4" />
          <circle cx="17.5" cy="19" r="1.4" />
        </svg>
      </span>
      <span className="hidden sm:inline">Carrito</span>
      <span
        className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-base px-1.5 text-2xs font-bold text-fg-accent"
        data-testid="cart-count"
      >
        {count}
      </span>
    </Link>
  );
}
