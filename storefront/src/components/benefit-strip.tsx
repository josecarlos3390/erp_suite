import { formatDeliveryDays, formatMoney } from '@/lib/format';
import type { City } from '@/lib/erp';

interface BenefitStripProps {
  city: City;
}

/**
 * Barra de beneficios de la home (F9.2).
 *
 * **Todo lo que dice es dato del ERP o del contrato del canal** (no hay promesas
 * de marketing inventadas):
 *   - el envio, con el costo y el umbral de envio gratis de la **ciudad elegida**;
 *   - el plazo, con los dias habiles que publica esa ciudad;
 *   - los medios de pago que acepta el checkout (transferencia, QR y contra
 *     entrega; el retiro en tienda esta declarado como fase 2 y no se anuncia aqui);
 *   - la garantia, que la publica el ERP **por articulo** (y se ve en la ficha);
 *   - la existencia, que es la del **almacen de esa ciudad**.
 */
export function BenefitStrip({ city }: BenefitStripProps): JSX.Element {
  const shipping =
    city.freeShippingFrom > 0
      ? `Gratis desde ${formatMoney(city.freeShippingFrom)} · si no, ${formatMoney(city.shippingCost)}`
      : `${formatMoney(city.shippingCost)} a ${city.name}`;

  const benefits = [
    {
      icon: <TruckIcon />,
      title: 'Envio',
      detail: shipping,
      extra: formatDeliveryDays(city.deliveryDays, city.name),
    },
    {
      icon: <CardIcon />,
      title: 'Pago',
      detail: 'Transferencia, QR o pago contra entrega',
      extra: 'El pedido queda con el pago pendiente hasta que la tienda lo concilie.',
    },
    {
      icon: <ShieldIcon />,
      title: 'Garantia',
      detail: 'La publica el ERP por articulo',
      extra: 'Los meses de garantia se ven en la ficha de cada producto.',
    },
    {
      icon: <BoxIcon />,
      title: 'Existencia real',
      detail: `Del almacen de ${city.name}`,
      extra: 'No se vende lo que no hay: el stock lo calcula el ERP por ciudad.',
    },
  ];

  return (
    <ul
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Beneficios de comprar en la tienda"
      data-testid="home-benefits"
    >
      {benefits.map((benefit) => (
        <li
          key={benefit.title}
          className="sf-card flex items-start gap-3 p-4"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-fg-accent"
          >
            {benefit.icon}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-fg">{benefit.title}</span>
            <span className="text-xs font-medium text-fg-secondary">{benefit.detail}</span>
            <span className="text-2xs text-fg-tertiary">{benefit.extra}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function TruckIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

function CardIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6 14.5h4" />
    </svg>
  );
}

function ShieldIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5.5c0 4 3 7.4 7 9 4-1.6 7-5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BoxIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z" />
      <path d="m4 7.2 8 4.3 8-4.3M12 21v-9.5" />
    </svg>
  );
}
