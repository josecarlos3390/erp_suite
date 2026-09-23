'use client';

import Link from 'next/link';

import { cartItemCount, useCartStore } from '@/store/cart';

/** Enlace al carrito con el contador de unidades (leido tras el montaje). */
export function CartLink(): JSX.Element {
  const lines = useCartStore((state) => state.lines);
  const count = cartItemCount(lines);

  return (
    <Link
      href="/carrito"
      className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-line bg-base px-3 text-sm font-medium text-fg hover:bg-hover"
      aria-label={`Carrito de compras, ${count} unidades`}
      data-testid="cart-link"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M3 4h2l2.4 11.2a1 1 0 001 .8h8.4a1 1 0 001-.8L20 7H6" />
        <circle cx="9.5" cy="19" r="1.4" />
        <circle cx="17.5" cy="19" r="1.4" />
      </svg>
      <span className="hidden sm:inline">Carrito</span>
      <span
        className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-bold text-primary-fg"
        data-testid="cart-count"
      >
        {count}
      </span>
    </Link>
  );
}
