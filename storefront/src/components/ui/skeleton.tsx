interface SkeletonProps {
  className?: string;
  /** Forma del bloque (la tarjeta de producto usa `media` + dos lineas). */
  shape?: 'line' | 'media' | 'block';
}

/** Bloque de carga de la tienda (F9.1): usa el barrido de los tokens. */
export function Skeleton({ className, shape = 'block' }: SkeletonProps): JSX.Element {
  const height = shape === 'line' ? 'h-3' : shape === 'media' ? 'aspect-square w-full' : 'h-24 w-full';
  return <span className={`sf-skeleton block ${height} ${className ?? ''}`} aria-hidden="true" />;
}

/** Tarjeta de producto en carga: misma caja que la real, sin salto de layout. */
export function SkeletonProductCard(): JSX.Element {
  return (
    <div className="sf-card flex flex-col overflow-hidden p-0">
      <Skeleton shape="media" className="rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton shape="line" className="w-1/3" />
        <Skeleton shape="line" className="w-4/5" />
        <Skeleton shape="line" className="w-1/2" />
      </div>
    </div>
  );
}

/** Grilla de tarjetas en carga (misma cantidad de columnas que la real). */
export function SkeletonProductGrid({ count = 8 }: { count?: number }): JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="flex">
          <div className="flex w-full">
            <div className="flex w-full flex-col">
              <SkeletonProductCard />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
