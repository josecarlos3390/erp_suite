'use client';

import { useState } from 'react';

import { useCartStore } from '@/store/cart';

export interface QuickAddProduct {
  itemId: number;
  slug: string;
  name: string;
  sku: string;
  price: number;
  currency: string;
  image: string | null;
}

interface QuickAddProps {
  product: QuickAddProduct;
  inStock: boolean;
  cityCode: string;
  cityName: string;
}

/**
 * Agregar al carrito desde la grilla (F9.3).
 *
 * Islote cliente declarado: escribe el **snapshot** del carrito (D2) y no habla
 * con el ERP. El boton vive **fuera** del enlace de la imagen, asi que un clic no
 * navega; si no hay existencia en la ciudad elegida queda deshabilitado y lo
 * explica con `title` + `aria-label` (la ficha ya da el mensaje completo).
 *
 * El `data-testid` es `quick-add` y **no** `add-to-cart` a proposito: la ficha usa
 * `add-to-cart` y su grilla de relacionados tambien lleva quick-add; si
 * compartieran testid, `page.getByTestId('add-to-cart')` del E2E seria ambiguo.
 */
export function QuickAdd({ product, inStock, cityCode, cityName }: QuickAddProps): JSX.Element {
  const addLine = useCartStore((state) => state.addLine);
  const [added, setAdded] = useState(false);

  const label = inStock
    ? `Agregar ${product.name} al carrito`
    : `${product.name} no tiene existencia en ${cityName}`;

  return (
    <button
      type="button"
      className="group/qa inline-flex h-11 w-11 items-center justify-center rounded-btn border border-line bg-base/95 text-fg shadow-sm backdrop-blur transition-all duration-fast hover:border-primary hover:text-fg-accent disabled:cursor-not-allowed disabled:text-fg-disabled disabled:shadow-none"
      style={{ backgroundColor: 'var(--bg-base)' }}
      title={label}
      aria-label={label}
      data-testid="quick-add"
      data-slug={product.slug}
      disabled={!inStock}
      onClick={() => {
        addLine({ ...product, cityCode }, 1);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1800);
      }}
    >
      <span aria-hidden="true">
        {added ? <CheckIcon /> : <CartPlusIcon />}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {added ? `${product.name} agregado al carrito` : ''}
      </span>
    </button>
  );
}

function CartPlusIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L20 7H6" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17.5" cy="19" r="1.4" />
      <path d="M12 8.5v3M10.5 10h3" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4 10-10" />
    </svg>
  );
}
