'use client';

import { useState } from 'react';

import { useCartStore } from '@/store/cart';

export interface AddToCartProduct {
  itemId: number;
  slug: string;
  name: string;
  sku: string;
  price: number;
  currency: string;
  image: string | null;
}

interface AddToCartButtonProps {
  product: AddToCartProduct;
  inStock: boolean;
  cityCode: string;
  cityName: string;
}

/**
 * Boton de compra de la ficha.
 *
 * Solo guarda un snapshot de referencia: el precio definitivo lo calcula el ERP
 * cuando la tienda crea el pedido (F3). Se deshabilita si no hay existencia en
 * la ciudad elegida.
 */
export function AddToCartButton({
  product,
  inStock,
  cityCode,
  cityName,
}: AddToCartButtonProps): JSX.Element {
  const addLine = useCartStore((state) => state.addLine);
  const [added, setAdded] = useState(false);

  if (!inStock) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className="sf-btn w-full sm:w-auto" disabled data-testid="add-to-cart">
          Agregar al carrito
        </button>
        <p className="text-xs text-fg-error" data-testid="add-to-cart-blocked">
          Sin existencia en {cityName}: no se puede agregar desde esta ciudad.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="sf-btn w-full bg-primary text-primary-fg hover:bg-primary-hover sm:w-auto"
        data-testid="add-to-cart"
        aria-describedby="carrito-nota"
        onClick={() => {
          addLine({ ...product, cityCode }, 1);
          setAdded(true);
        }}
      >
        Agregar al carrito
      </button>
      <p id="carrito-nota" className="text-xs text-fg-tertiary">
        Precio de referencia: el ERP confirma el precio final al crear el pedido.
      </p>
      <p
        role="status"
        aria-live="polite"
        className={`text-xs font-medium text-fg-success ${added ? '' : 'invisible'}`}
        data-testid="add-to-cart-status"
      >
        Producto agregado al carrito.
      </p>
    </div>
  );
}
