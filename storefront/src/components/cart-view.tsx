'use client';

import Link from 'next/link';

import { formatMoney } from '@/lib/format';
import { MAX_LINE_QUANTITY, cartItemCount, cartSubtotal, useCartStore } from '@/store/cart';

import { ProductImage } from './product-image';

/**
 * Carrito servido como pagina (`/carrito`).
 *
 * Todo lo que se ve sale del snapshot guardado en localStorage: sirve para
 * revisar el pedido, no para cobrar. La nota del checkout lo dice explicitamente.
 */
export function CartView(): JSX.Element {
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const clear = useCartStore((state) => state.clear);

  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);
  const currency = lines[0]?.currency ?? 'BOB';

  if (lines.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line bg-elevated p-8 text-center">
        <h2 className="text-lg font-semibold text-fg">Tu carrito esta vacio</h2>
        <p className="max-w-md text-sm text-fg-secondary">
          Agrega productos del catalogo para verlos aqui. El precio y la existencia se confirman
          contra el ERP al crear el pedido.
        </p>
        <Link href="/categorias" className="sf-btn bg-primary text-primary-fg hover:bg-primary-hover">
          Ver categorias
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row" data-testid="cart-view">
      <section aria-label="Productos del carrito" className="flex-1">
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li
              key={line.itemId}
              className="flex flex-col gap-3 rounded-lg border border-line bg-base p-3 sm:flex-row sm:items-center"
              data-testid="cart-line"
              data-slug={line.slug}
            >
              <ProductImage
                src={line.image}
                alt={line.name}
                sizes="96px"
                className="h-24 w-24 shrink-0 rounded-md bg-elevated"
              />

              <div className="flex flex-1 flex-col gap-1">
                <Link href={`/productos/${line.slug}`} className="text-sm font-semibold text-fg hover:text-fg-accent">
                  {line.name}
                </Link>
                <p className="text-xs text-fg-tertiary">
                  SKU {line.sku} · Ciudad {line.cityCode}
                </p>
                <p className="text-sm font-semibold text-fg" data-testid="cart-line-price">
                  {formatMoney(line.price, line.currency)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor={`cantidad-${line.itemId}`} className="text-xs text-fg-secondary">
                  Cantidad
                </label>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-lg leading-none text-fg hover:bg-hover"
                  aria-label={`Quitar una unidad de ${line.name}`}
                  onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                >
                  −
                </button>
                <input
                  id={`cantidad-${line.itemId}`}
                  type="number"
                  min={1}
                  max={MAX_LINE_QUANTITY}
                  value={line.quantity}
                  onChange={(event) => setQuantity(line.itemId, Number.parseInt(event.target.value, 10))}
                  className="sf-field w-16 text-center"
                  data-testid="cart-line-quantity"
                />
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-lg leading-none text-fg hover:bg-hover"
                  aria-label={`Agregar una unidad de ${line.name}`}
                  onClick={() => setQuantity(line.itemId, line.quantity + 1)}
                >
                  +
                </button>
              </div>

              <div className="flex flex-col items-end gap-2">
                <p className="text-sm font-bold text-fg" data-testid="cart-line-total">
                  {formatMoney(line.price * line.quantity, line.currency)}
                </p>
                <button
                  type="button"
                  className="text-xs font-medium text-fg-error underline-offset-2 hover:underline"
                  onClick={() => removeLine(line.itemId)}
                  data-testid="cart-line-remove"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="mt-4 text-xs font-medium text-fg-secondary underline-offset-2 hover:underline"
          onClick={clear}
        >
          Vaciar carrito
        </button>
      </section>

      <aside
        aria-label="Resumen del carrito"
        className="h-fit rounded-lg border border-line bg-elevated p-4 lg:w-80"
      >
        <h2 className="text-sm font-semibold text-fg">Resumen</h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-fg-secondary">Unidades</dt>
            <dd className="font-medium text-fg" data-testid="cart-items">
              {itemCount}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-fg-secondary">Subtotal de referencia</dt>
            <dd className="text-lg font-bold text-fg" data-testid="cart-subtotal">
              {formatMoney(subtotal, currency)}
            </dd>
          </div>
        </dl>

        <p
          className="mt-4 rounded-md border border-warn bg-warn-soft p-3 text-xs text-fg"
          data-testid="cart-checkout-note"
        >
          El precio final, los descuentos de la empresa, la existencia y el costo de envio los
          confirma el ERP en el checkout. El subtotal de arriba es solo una referencia de la tienda.
        </p>

        <Link
          href="/checkout"
          className="sf-btn-primary mt-4 w-full"
          data-testid="cart-checkout-link"
        >
          Ir al checkout
        </Link>

        <Link href="/categorias" className="sf-link mt-3 inline-block text-sm">
          Seguir comprando
        </Link>
      </aside>
    </div>
  );
}
