'use client';

import Link from 'next/link';
import { useState } from 'react';

import { formatMoney } from '@/lib/format';
import type { StorefrontService } from '@/lib/erp';
import { useCartStore } from '@/store/cart';

interface ServiceOfferProps {
  /** Servicios **publicados** en la categoria del articulo (los trae la ficha). */
  services: StorefrontService[];
  cityCode: string;
}

/**
 * Servicios que la ficha ofrece como extra (F6/T227): garantia extendida,
 * instalacion, mantenimiento.
 *
 * Un servicio es un articulo **no inventariable** del ERP: se compra y se cobra
 * como una linea mas —viaja en el pedido, en la entrega y en la reserva— pero no
 * mueve existencia, asi que aqui **no hay tope por stock** y la cantidad es fija
 * **1** (un servicio no se acumula por unidades como la mercancia). El precio es
 * el que el canal publica: el definitivo lo confirma el ERP al crear el pedido.
 *
 * Los `data-testid` (`service-offer`, `service-offer-item`, `service-add`,
 * `service-add-status`) son contrato con el E2E.
 */
export function ServiceOffer({ services, cityCode }: ServiceOfferProps): JSX.Element | null {
  const addLine = useCartStore((state) => state.addLine);
  const [addedItemId, setAddedItemId] = useState<number | null>(null);

  if (services.length === 0) return null;

  return (
    <section className="sf-panel flex flex-col gap-3" aria-labelledby="servicios-titulo" data-testid="service-offer">
      <div className="flex flex-col gap-1">
        <h2 id="servicios-titulo" className="sf-h3">
          Sumale un servicio
        </h2>
        <p className="text-xs text-fg-tertiary">
          Servicios publicados por el ERP para esta categoria. Se cobran con el pedido y no
          dependen de la existencia del articulo.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {services.map((service) => (
          <li
            key={service.itemId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-btn border border-line bg-base p-3"
            data-testid="service-offer-item"
            data-item-id={service.itemId}
          >
            <div className="flex min-w-0 flex-col">
              <Link
                href={`/productos/${service.slug}`}
                className="truncate text-sm font-semibold text-fg hover:text-primary"
              >
                {service.name}
              </Link>
              {service.shortDescription !== null ? (
                <span className="truncate text-xs text-fg-tertiary">
                  {service.shortDescription}
                </span>
              ) : null}
              <span className="text-sm font-semibold text-price">
                {formatMoney(service.price, service.currency)}
              </span>
            </div>

            <button
              type="button"
              className="sf-btn sf-btn-secondary"
              data-testid="service-add"
              data-item-id={service.itemId}
              onClick={() => {
                // Cantidad **fija 1**: no es mercancia, no se acumula por stock.
                addLine(
                  {
                    itemId: service.itemId,
                    slug: service.slug,
                    name: service.name,
                    // El canal no publica SKU del servicio: la linea lo dice como «Servicio».
                    sku: '',
                    price: service.price,
                    currency: service.currency,
                    image: null,
                    cityCode,
                  },
                  1,
                );
                setAddedItemId(service.itemId);
              }}
            >
              Agregar al carrito
            </button>
            <span
              role="status"
              aria-live="polite"
              className={`text-xs font-medium text-price-free ${
                addedItemId === service.itemId ? '' : 'invisible'
              }`}
              data-testid="service-add-status"
            >
              Servicio agregado al carrito.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
