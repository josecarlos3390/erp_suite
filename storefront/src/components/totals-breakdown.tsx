import { formatMoney } from '@/lib/format';

/**
 * Desglose de importes compartido por el **checkout** (cotizacion) y la **confirmacion**
 * y el **seguimiento** (pedido).
 *
 * Los dos lados publican lo mismo porque el ERP cotiza y cobra con el mismo motor: el
 * precio puede traer una **oferta de catalogo** (`Item.salePrice`), el **descuento de la
 * empresa** se aplica encima y el **impuesto** lo separa el motor fiscal del ERP con el
 * indicador del articulo (IVA incluido: se extrae del precio; IVA sumado: se agrega).
 * Antes el checkout no mostraba el impuesto y la confirmacion lo mostraba en cero
 * (defecto medido en T197): aqui se pinta el desglose completo, en el mismo orden en las
 * dos pantallas, con los importes que devuelve el canal **sin recalcular nada**.
 *
 * `prefix` es el prefijo de los `data-testid` (`checkout-quote` en el checkout y `order`
 * en la confirmacion y el seguimiento), de modo que las pruebas localizan cada fila.
 */
export interface TotalsBreakdownProps {
  currency: string;
  /** Precio de **lista** del catalogo (Σ lineas). `null` cuando no hay oferta publicada. */
  listSubtotal: number | null;
  /** Oferta de catalogo ya incluida en el precio (0 si no hay). */
  offerDiscount: number;
  /** Mercancia antes del descuento de la empresa (Σ precio efectivo × cantidad). */
  subtotal: number;
  /** Descuento de la empresa aplicado por el canal (0 si no hay). */
  companyDiscount: number;
  /** Mercancia **sin impuestos**. */
  netSubtotal: number;
  /** Impuesto total (mercancia + envio). */
  taxAmount: number;
  /** Tasa del impuesto cuando es unica e informativa (0.13 = 13%). */
  taxRate: number | null;
  /** `true` cuando el precio ya incluye el impuesto (se extrae, no se suma). */
  taxInclusive: boolean;
  shipping: number;
  /** Nota del envio: gratis por umbral, no se cobra en la ciudad, etc. */
  shippingNote?: string;
  /** **Total a pagar**: `neto + impuesto` (el total del documento del ERP). */
  total: number;
  /** Prefijo de los `data-testid` de cada fila. */
  prefix: string;
}

/** Etiqueta de la tasa: `13%` (la tasa viaja como 0.13). */
function formatTaxRate(taxRate: number | null): string {
  if (taxRate === null || !Number.isFinite(taxRate) || taxRate <= 0) return '';
  return `${Math.round(taxRate * 100)}%`;
}

export function TotalsBreakdown({
  currency,
  listSubtotal,
  offerDiscount,
  subtotal,
  companyDiscount,
  netSubtotal,
  taxAmount,
  taxRate,
  taxInclusive,
  shipping,
  shippingNote,
  total,
  prefix,
}: TotalsBreakdownProps): JSX.Element {
  const hasOffer = offerDiscount > 0 && listSubtotal !== null;
  const rate = formatTaxRate(taxRate);
  const taxLabel = taxInclusive
    ? `IVA${rate ? ` ${rate}` : ''} (incluido en el precio)`
    : `IVA${rate ? ` ${rate}` : ''}`;

  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col gap-2 rounded-md border border-line bg-elevated p-4 text-sm">
        {hasOffer ? (
          <>
            <div className="flex items-center justify-between">
              <dt className="text-fg-secondary">Precio de lista (catalogo)</dt>
              <dd className="font-medium text-fg-tertiary" data-testid={`${prefix}-list-subtotal`}>
                {formatMoney(listSubtotal ?? 0, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-fg-secondary">Oferta de catalogo</dt>
              <dd className="font-medium text-ok" data-testid={`${prefix}-offer-discount`}>
                −{formatMoney(offerDiscount, currency)}
              </dd>
            </div>
          </>
        ) : null}
        <div className="flex items-center justify-between">
          <dt className="text-fg-secondary">Subtotal</dt>
          <dd className="font-medium text-fg" data-testid={`${prefix}-subtotal`}>
            {formatMoney(subtotal, currency)}
          </dd>
        </div>
        {companyDiscount > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-fg-secondary">Descuento de la empresa</dt>
            <dd className="font-medium text-ok" data-testid={`${prefix}-discount`}>
              −{formatMoney(companyDiscount, currency)}
            </dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-line pt-2">
          <dt className="text-fg-secondary">Subtotal (sin IVA)</dt>
          <dd className="font-medium text-fg" data-testid={`${prefix}-net-subtotal`}>
            {formatMoney(netSubtotal, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-fg-secondary">{taxLabel}</dt>
          <dd className="font-medium text-fg" data-testid={`${prefix}-tax`}>
            {formatMoney(taxAmount, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-fg-secondary">
            Envio
            {shippingNote ? ` (${shippingNote})` : ''}
          </dt>
          <dd className="font-medium text-fg" data-testid={`${prefix}-shipping`}>
            {formatMoney(shipping, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-2">
          <dt className="font-semibold text-fg">Total a pagar</dt>
          <dd className="text-lg font-bold text-fg" data-testid={`${prefix}-total`}>
            {formatMoney(total, currency)}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-fg-tertiary" data-testid={`${prefix}-breakdown-note`}>
        El desglose lo calcula el ERP con la configuracion fiscal de la empresa: el subtotal sin IVA
        y el impuesto son la separacion del mismo importe que se cobra
        {taxInclusive
          ? ' (el precio del articulo ya trae el IVA incluido, asi que no se suma por encima).'
          : ' (al precio del articulo se le suma el IVA).'}
      </p>
    </div>
  );
}
