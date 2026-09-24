import Link from 'next/link';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  /** Id del `h2` para el `aria-labelledby` de la seccion. */
  id?: string;
  /** Antetitulo corto en mayusculas (`Ofertas`, `Catalogo`). */
  eyebrow?: string;
  title: ReactNode;
  /** Texto de apoyo a la derecha o debajo del titulo. */
  hint?: ReactNode;
  /** Enlace de accion a la derecha (`Ver todo`). */
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

/**
 * Cabecera de seccion de la tienda (F9.1): antetitulo, titulo con la escala
 * display y accion a la derecha. Reemplaza los encabezados planos que cada
 * pantalla armaba a mano.
 */
export function SectionHeader({
  id,
  eyebrow,
  title,
  hint,
  actionHref,
  actionLabel = 'Ver todo',
  className,
}: SectionHeaderProps): JSX.Element {
  return (
    <div className={`sf-section-head ${className ?? ''}`}>
      <div className="flex flex-col gap-1">
        {eyebrow !== undefined ? <p className="sf-eyebrow">{eyebrow}</p> : null}
        <h2 id={id} className="sf-h2 text-fg">
          {title}
        </h2>
        {hint !== undefined ? <p className="text-xs text-fg-secondary">{hint}</p> : null}
      </div>
      {actionHref !== undefined ? (
        <Link href={actionHref} className="sf-link text-sm font-semibold">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
