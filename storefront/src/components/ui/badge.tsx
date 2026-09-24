import type { ReactNode } from 'react';

type BadgeVariant = 'deal' | 'promo' | 'brand' | 'soft' | 'ok' | 'outline';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  testId?: string;
  className?: string;
  /** Texto accesible cuando el contenido es solo un simbolo (p. ej. `-15%`). */
  srLabel?: string;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  deal: 'sf-badge-deal',
  promo: 'sf-badge-promo',
  brand: 'sf-badge-brand',
  soft: 'sf-badge-soft',
  ok: 'sf-badge-ok',
  outline: 'sf-badge-outline',
};

/**
 * Etiqueta de la tienda (F9.1): descuento, promocion, beneficio o estado.
 *
 * Variantes: `deal` (porcentaje/ahorro), `promo` (campana), `brand` (informativa
 * fuerte), `soft` (informativa suave), `ok` (beneficio positivo: envio gratis) y
 * `outline` (neutra, junto a las fichas).
 */
export function Badge({
  children,
  variant = 'soft',
  testId,
  className,
  srLabel,
}: BadgeProps): JSX.Element {
  return (
    <span className={`sf-badge ${VARIANT_CLASS[variant]} ${className ?? ''}`} data-testid={testId}>
      <span aria-hidden={srLabel !== undefined ? 'true' : undefined}>{children}</span>
      {srLabel !== undefined ? <span className="sr-only">{srLabel}</span> : null}
    </span>
  );
}
