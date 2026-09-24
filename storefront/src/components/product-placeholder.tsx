import { productMonogram } from '@/lib/media';

interface ProductPlaceholderProps {
  /** Nombre del articulo: de aqui sale el monograma. */
  name: string;
  /** Marca publicada por el ERP (se pinta pequena, si existe). */
  brand?: string | null;
  /** Tamano del monograma (`sm` en miniaturas y carrito, `md` en tarjeta, `lg` en ficha). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MONOGRAM_SIZE: Record<NonNullable<ProductPlaceholderProps['size']>, string> = {
  sm: 'text-lg',
  md: 'text-3xl',
  lg: 'text-5xl',
};

/**
 * Placeholder de imagen propio de la tienda (F9.1, decision D24).
 *
 * Mientras el ERP no publique fotografia real, este es el «no hay foto» de la
 * tienda: fondo neutro, un halo suave en el color de marca y el monograma del
 * articulo (con la marca debajo, si existe). Es deliberadamente sobrio y
 * **consistente** —misma caja y mismo encuadre que una foto— para que la grilla
 * se vea intencional y no rota.
 */
export function ProductPlaceholder({
  name,
  brand = null,
  size = 'md',
  className,
}: ProductPlaceholderProps): JSX.Element {
  return (
    <span
      className={`relative flex h-full w-full items-center justify-center ${className ?? ''}`}
      data-placeholder="true"
      aria-hidden="true"
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, var(--sf-brand-100) 0%, transparent 62%)',
          opacity: 0.7,
        }}
      />
      <span className="relative flex flex-col items-center gap-1">
        <span
          className={`font-bold leading-none tracking-tight ${MONOGRAM_SIZE[size]}`}
          style={{ color: 'var(--sf-media-ink)', opacity: 0.62 }}
        >
          {productMonogram(name)}
        </span>
        {brand !== null && brand.trim() !== '' ? (
          <span
            className="text-2xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'var(--sf-media-ink)', opacity: 0.5 }}
          >
            {brand}
          </span>
        ) : null}
      </span>
    </span>
  );
}
