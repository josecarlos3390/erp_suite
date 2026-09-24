import { formatMoney } from '@/lib/format';

interface PriceProps {
  /** Precio que cobra el ERP (ya con la oferta aplicada, si la hay). */
  price: number;
  currency: string;
  /** Precio de lista publicado por el ERP (el «antes»): solo se pinta si es mayor. */
  listPrice?: number | null;
  /** Tamanos: `sm` en carrito/resumen, `md` en tarjeta, `lg` en ficha. */
  size?: 'sm' | 'md' | 'lg';
  /** Etiqueta corta debajo del precio (`Oferta vigente`, `Precio de lista`). */
  caption?: string | null;
  /** `data-testid` del precio final (los E2E lo leen con `readMoney`). */
  testId?: string;
  /** `data-testid` del precio de lista. */
  listTestId?: string;
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<PriceProps['size']>, string> = {
  sm: 'text-md',
  md: '',
  lg: 'text-3xl',
};

/**
 * Precio de la tienda (F9.1): el protagonista de la tarjeta.
 *
 * Honestidad del dato: el «antes» es el **precio de lista** que publica el ERP y
 * el descuento es la **diferencia real** entre lista y precio vigente; la tienda
 * no inventa porcentajes ni cuotas (ver `src/lib/format.ts`).
 */
export function Price({
  price,
  currency,
  listPrice = null,
  size = 'md',
  caption = null,
  testId = 'product-price',
  listTestId = 'product-list-price',
  className,
}: PriceProps): JSX.Element {
  const compareAt = listPrice !== null && listPrice > price ? listPrice : null;
  const savings = compareAt === null ? 0 : compareAt - price;

  return (
    <span className={`flex flex-col gap-0.5 ${className ?? ''}`}>
      <span className="flex flex-wrap items-baseline gap-2">
        <span
          className={`sf-price ${compareAt !== null ? 'sf-price--deal' : ''} ${SIZE_CLASS[size]}`}
          data-testid={testId}
        >
          {formatMoney(price, currency)}
        </span>
        {compareAt !== null ? (
          <span className="sf-price-compare" data-testid={listTestId}>
            {formatMoney(compareAt, currency)}
          </span>
        ) : null}
      </span>
      {compareAt !== null && savings > 0 ? (
        <span className="text-2xs font-semibold text-price-free">
          Ahorras {formatMoney(savings, currency)}
        </span>
      ) : null}
      {caption !== null && caption.trim() !== '' ? (
        <span className="text-2xs font-medium text-fg-secondary">{caption}</span>
      ) : null}
    </span>
  );
}
