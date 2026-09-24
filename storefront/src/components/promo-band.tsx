import Link from 'next/link';

import type { City } from '@/lib/erp';
import { formatMoney } from '@/lib/format';

interface PromoBandProps {
  city: City;
}

/**
 * Banda de promocion de la home (F9.2).
 *
 * La usa **solo con datos reales de la ciudad elegida**: el umbral de envio gratis
 * y el costo del envio los publica el canal por ciudad, asi que la banda no puede
 * prometer algo que el checkout no vaya a cobrar.
 */
export function PromoBand({ city }: PromoBandProps): JSX.Element {
  const hasFreeShipping = city.freeShippingFrom > 0;

  return (
    <section
      className="overflow-hidden rounded-card shadow-card"
      style={{ backgroundImage: 'var(--sf-promo-surface)', color: 'var(--sf-promo-ink)' }}
      aria-labelledby="promo-titulo"
      data-testid="home-promo"
    >
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex flex-col gap-1.5">
          <p className="sf-eyebrow" style={{ color: 'inherit', opacity: 0.85 }}>
            Envio en {city.name}
          </p>
          <h2 id="promo-titulo" className="sf-h2" style={{ color: 'inherit' }}>
            {hasFreeShipping
              ? `Envio gratis desde ${formatMoney(city.freeShippingFrom)}`
              : `Enviamos a ${city.name} desde ${formatMoney(city.shippingCost)}`}
          </h2>
          <p className="max-w-2xl text-sm" style={{ color: 'inherit', opacity: 0.9 }}>
            {hasFreeShipping
              ? `Por debajo de ese monto el envio cuesta ${formatMoney(city.shippingCost)}. El importe final lo confirma el ERP al crear el pedido.`
              : 'El importe final del envio y los impuestos los confirma el ERP al crear el pedido.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/categorias"
            className="sf-btn sf-btn-lg"
            style={{ backgroundColor: 'var(--sf-promo-ink)', color: 'var(--sf-brand-700)' }}
          >
            Ver catalogo
          </Link>
          <Link
            href="/sucursales"
            className="sf-btn sf-btn-lg border"
            style={{ borderColor: 'currentColor', color: 'inherit' }}
          >
            Ciudades y sucursales
          </Link>
        </div>
      </div>
    </section>
  );
}
