'use client';

import { useState } from 'react';

import { MAX_LINE_QUANTITY, useCartStore } from '@/store/cart';

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
  /** Existencia publicada por el ERP en la ciudad elegida (tope de la cantidad). */
  available: number;
  cityCode: string;
  cityName: string;
}

/**
 * Compra de la ficha (F9.1/F9.4).
 *
 * Solo guarda un snapshot de referencia: el precio definitivo lo calcula el ERP
 * cuando la tienda crea el pedido (F3). Se deshabilita si no hay existencia en la
 * ciudad elegida y la **cantidad** esta topada por lo que el ERP publica como
 * disponible (nunca se ofrece comprar mas de lo que hay).
 *
 * Los `data-testid` (`add-to-cart`, `add-to-cart-status`, `add-to-cart-blocked`)
 * son contrato con el E2E.
 */
export function AddToCartButton({
  product,
  inStock,
  available,
  cityCode,
  cityName,
}: AddToCartButtonProps): JSX.Element {
  const addLine = useCartStore((state) => state.addLine);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const max = Math.max(1, Math.min(MAX_LINE_QUANTITY, available));
  const current = Math.min(quantity, max);

  function change(next: number): void {
    setQuantity(Math.max(1, Math.min(max, next)));
  }

  if (!inStock) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className="sf-btn sf-btn-block" disabled data-testid="add-to-cart">
          Sin existencia
        </button>
        <p className="text-xs text-fg-error" data-testid="add-to-cart-blocked">
          Sin existencia en {cityName}: no se puede agregar desde esta ciudad.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-btn border border-line bg-base p-1" role="group" aria-label="Cantidad">
          <button
            type="button"
            className="sf-icon-btn h-9 w-9"
            aria-label={`Quitar una unidad de ${product.name}`}
            disabled={current <= 1}
            onClick={() => change(current - 1)}
          >
            <span aria-hidden="true">−</span>
          </button>
          <label htmlFor="cantidad" className="sr-only">
            Cantidad de {product.name}
          </label>
          <input
            id="cantidad"
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={current}
            data-testid="detail-quantity"
            onChange={(event) => change(Number(event.target.value))}
            className="h-9 w-12 border-0 bg-transparent text-center text-sm font-semibold text-fg outline-none"
          />
          <button
            type="button"
            className="sf-icon-btn h-9 w-9"
            aria-label={`Agregar una unidad de ${product.name}`}
            disabled={current >= max}
            onClick={() => change(current + 1)}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>

        <button
          type="button"
          className="sf-btn sf-btn-primary sf-btn-lg min-w-[200px] flex-1"
          data-testid="add-to-cart"
          aria-describedby="carrito-nota"
          onClick={() => {
            addLine({ ...product, cityCode }, current);
            setAdded(true);
          }}
        >
          Agregar al carrito
        </button>
      </div>

      <p className="text-2xs text-fg-tertiary">
        {max === 1
          ? 'Hay 1 unidad disponible en tu ciudad.'
          : `Puedes agregar hasta ${max} unidades (existencia en ${cityName}).`}
      </p>

      <p id="carrito-nota" className="text-xs text-fg-tertiary">
        Precio de referencia: el ERP confirma el precio final, el envio y los impuestos al crear el
        pedido.
      </p>
      <p
        role="status"
        aria-live="polite"
        className={`text-xs font-medium text-price-free ${added ? '' : 'invisible'}`}
        data-testid="add-to-cart-status"
      >
        Producto agregado al carrito.
      </p>
    </div>
  );
}
