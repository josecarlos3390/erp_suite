'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { BagIcon } from '@/components/ui/icons';
import { SkeletonCart } from '@/components/ui/skeleton';
import { describeLineSku, formatMoney } from '@/lib/format';
import { MAX_LINE_QUANTITY, cartItemCount, cartSubtotal, useCartStore } from '@/store/cart';

import { ProductImage } from './product-image';

/**
 * Carrito servido como pagina (`/carrito`, F9.5).
 *
 * Todo lo que se ve sale del snapshot guardado en localStorage: sirve para
 * revisar el pedido, no para cobrar. La nota del checkout lo dice explicitamente.
 *
 * **Carga**: el store usa `skipHydration`, asi que el primer render del cliente
 * —igual que el HTML del servidor— **no** tiene lineas. Sin guarda, el comprador
 * con carrito veia un parpadeo del estado vacio; mientras no rehidrata se pinta el
 * esqueleto con la forma real (el checkout ya tenia esa guarda: ahora es la misma).
 */
export function CartView(): JSX.Element {
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const clear = useCartStore((state) => state.clear);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useCartStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);
  const currency = lines[0]?.currency ?? 'BOB';

  if (!hydrated) {
    return (
      <div data-testid="cart-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando tu carrito</span>
        <SkeletonCart />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        testId="cart-empty"
        title="Tu carrito esta vacio"
        description="Agrega productos del catalogo para verlos aqui. El precio, el envio y la existencia se confirman contra el ERP al crear el pedido."
        icon={<BagIcon />}
        actions={[
          { href: '/categorias', label: 'Ver categorias', primary: true },
          { href: '/buscar', label: 'Buscar productos' },
        ]}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start" data-testid="cart-view">
      <section aria-label="Productos del carrito" className="flex flex-1 flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li
              key={line.itemId}
              className="sf-card flex flex-col gap-4 p-3 sm:flex-row sm:items-center"
              data-testid="cart-line"
              data-slug={line.slug}
            >
              <Link
                href={`/productos/${line.slug}`}
                className="block w-fit shrink-0"
                tabIndex={-1}
                aria-hidden="true"
              >
                <ProductImage
                  src={line.image}
                  alt={line.name}
                  sizes="96px"
                  className="h-24 w-24 rounded-media"
                />
              </Link>

              <div className="flex flex-1 flex-col gap-1">
                <Link
                  href={`/productos/${line.slug}`}
                  className="text-sm font-semibold text-fg transition-colors hover:text-fg-accent"
                >
                  {line.name}
                </Link>
                <p className="text-xs text-fg-tertiary">
                  {describeLineSku(line.sku)} · Ciudad {line.cityCode}
                </p>
                <p className="text-sm font-semibold text-fg" data-testid="cart-line-price">
                  {formatMoney(line.price, line.currency)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-secondary" id={`cantidad-etiqueta-${line.itemId}`}>
                  Cantidad
                </span>
                <div
                  className="flex items-center gap-1 rounded-btn border border-line bg-base p-1"
                  role="group"
                  aria-labelledby={`cantidad-etiqueta-${line.itemId}`}
                >
                  <button
                    type="button"
                    className="sf-icon-btn h-9 w-9"
                    aria-label={`Quitar una unidad de ${line.name}`}
                    disabled={line.quantity <= 1}
                    onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                  >
                    <span aria-hidden="true">−</span>
                  </button>
                  <label htmlFor={`cantidad-${line.itemId}`} className="sr-only">
                    Cantidad de {line.name}
                  </label>
                  <input
                    id={`cantidad-${line.itemId}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_LINE_QUANTITY}
                    value={line.quantity}
                    onChange={(event) =>
                      setQuantity(line.itemId, Number.parseInt(event.target.value, 10))
                    }
                    className="h-9 w-12 border-0 bg-transparent text-center text-sm font-semibold text-fg outline-none"
                    data-testid="cart-line-quantity"
                  />
                  <button
                    type="button"
                    className="sf-icon-btn h-9 w-9"
                    aria-label={`Agregar una unidad de ${line.name}`}
                    disabled={line.quantity >= MAX_LINE_QUANTITY}
                    onClick={() => setQuantity(line.itemId, line.quantity + 1)}
                  >
                    <span aria-hidden="true">+</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                <p className="text-base font-bold text-fg" data-testid="cart-line-total">
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

        <p className="text-xs text-fg-tertiary">
          Maximo {MAX_LINE_QUANTITY} unidades por articulo. La existencia disponible se vuelve a
          comprobar contra el ERP al crear el pedido.
        </p>
      </section>

      <aside
        aria-label="Resumen del carrito"
        className="sf-card flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-32 lg:w-80"
      >
        <h2 className="sf-h3 text-fg">Resumen</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-fg-secondary">Unidades</dt>
            <dd className="font-medium text-fg" data-testid="cart-items">
              {itemCount}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-fg-secondary">Subtotal de referencia</dt>
            <dd className="sf-price text-lg" data-testid="cart-subtotal">
              {formatMoney(subtotal, currency)}
            </dd>
          </div>
        </dl>

        <p
          className="rounded-md border border-warn bg-warn-soft p-3 text-xs text-fg"
          data-testid="cart-checkout-note"
        >
          El precio final, los descuentos de la empresa, la existencia y el costo de envio los
          confirma el ERP en el checkout. El subtotal de arriba es solo una referencia de la tienda.
        </p>

        <Link
          href="/checkout"
          className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block"
          data-testid="cart-checkout-link"
        >
          Ir al checkout
        </Link>

        <Link href="/categorias" className="sf-link text-sm">
          Seguir comprando
        </Link>

        <button type="button" className="sf-btn sf-btn-ghost" onClick={clear}>
          Vaciar carrito
        </button>
      </aside>
    </div>
  );
}
