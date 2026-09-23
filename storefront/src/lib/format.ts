/**
 * Formato de dinero y textos cortos de la tienda.
 *
 * Nota de honestidad (pedido explicito): NO se calculan cuotas. El canal no
 * publica un plan de cuotas (`Installment` del ERP existe, pero el canal de la
 * tienda no lo expone todavia), asi que inventar `precio / 6` seria un dato
 * falso. La tienda muestra el precio de contado; si el articulo trae la insignia
 * CUOTAS del ERP se informa que se consultan en el checkout.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat | null {
  const cached = formatters.get(currency);
  if (cached !== undefined) return cached;
  try {
    const created = new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(currency, created);
    return created;
  } catch {
    return null;
  }
}

/** Monto en bolivianos: `1.499,00 Bs` (o el codigo de la moneda del ERP). */
export function formatMoney(value: number, currency = 'BOB'): string {
  if (!Number.isFinite(value)) return '—';
  const formatter = moneyFormatter(currency);
  if (formatter === null) {
    return `${currency} ${value.toFixed(2)}`;
  }
  return formatter.format(value);
}

/** Insignia de descuento: `-7%`. */
export function formatDiscount(pct: number | null): string | null {
  if (pct === null || !Number.isFinite(pct) || pct === 0) return null;
  const rounded = Math.round(Math.abs(pct));
  return `-${rounded}%`;
}

/** `12 meses` / `1 mes`. */
export function formatMonths(months: number): string {
  return months === 1 ? '1 mes' : `${months} meses`;
}

/** Plazo de entrega de la ciudad elegida. */
export function formatDeliveryDays(days: number, cityName?: string): string {
  const unit = days === 1 ? 'dia habil' : 'dias habiles';
  const where = cityName !== undefined && cityName !== '' ? ` a ${cityName}` : '';
  return `${days} ${unit}${where}`;
}

/** Disponibilidad en la ciudad elegida. */
export function describeAvailability(available: number, cityName: string): string {
  if (available <= 0) return `Sin existencia en ${cityName}`;
  return `Disponible: ${available}`;
}

/** Texto de envio a partir de los datos de la ciudad (nunca inventado). */
export function describeShipping(
  shippingCost: number,
  freeShippingFrom: number,
  currency = 'BOB',
): string {
  if (freeShippingFrom > 0) {
    return `Envio ${formatMoney(shippingCost, currency)} · gratis desde ${formatMoney(freeShippingFrom, currency)}`;
  }
  return `Envio ${formatMoney(shippingCost, currency)}`;
}

/** Porcentaje entero sin decimales: `7%`. */
export function formatPct(pct: number): string {
  return `${Math.round(pct)}%`;
}
