interface SkeletonProps {
  className?: string;
  /**
   * Forma del bloque. `custom` no aplica **ningun** tamaño: lo pone `className`
   * (barras de formulario, botones y cajas a medida), de modo que no haya dos
   * utilidades de altura compitiendo por el mismo elemento.
   */
  shape?: 'line' | 'media' | 'block' | 'custom';
}

/** Alto/ancho por forma (la `custom` los recibe del llamador). */
const SHAPES: Record<'line' | 'media' | 'block' | 'custom', string> = {
  line: 'h-3',
  media: 'aspect-square w-full',
  block: 'h-24 w-full',
  custom: '',
};

/** Bloque de carga de la tienda (F9.1): usa el barrido de los tokens. */
export function Skeleton({ className, shape = 'block' }: SkeletonProps): JSX.Element {
  return <span className={`sf-skeleton block ${SHAPES[shape]} ${className ?? ''}`} aria-hidden="true" />;
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

/** Fila de carrito en carga: misma caja que la real (imagen, datos, cantidad, total). */
export function SkeletonCartLine(): JSX.Element {
  return (
    <li className="sf-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <span className="block h-24 w-24 shrink-0">
        <Skeleton shape="media" className="h-full w-full" />
      </span>
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton shape="line" className="w-3/4" />
        <Skeleton shape="line" className="w-1/3" />
        <Skeleton shape="line" className="w-24" />
      </div>
      <Skeleton shape="custom" className="h-11 w-40 rounded-btn" />
      <Skeleton shape="custom" className="h-5 w-20 self-end sm:self-auto" />
    </li>
  );
}

/** Resumen lateral en carga (pegajoso, igual que el real). */
export function SkeletonSummary(): JSX.Element {
  return (
    <div className="sf-card flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-32 lg:w-80">
      <Skeleton shape="line" className="w-1/3" />
      <Skeleton shape="line" className="w-full" />
      <Skeleton shape="line" className="w-2/3" />
      <Skeleton shape="custom" className="h-16 w-full rounded-card" />
      <Skeleton shape="custom" className="h-11 w-full rounded-btn" />
    </div>
  );
}

/** Carrito completo en carga: la misma estructura que `/carrito`. */
export function SkeletonCart({ lines = 2 }: { lines?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <ul className="flex flex-1 flex-col gap-3">
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonCartLine key={index} />
        ))}
      </ul>
      <SkeletonSummary />
    </div>
  );
}

/** Checkout en carga: barra de pasos, formulario del paso 1 y resumen. */
export function SkeletonCheckout(): JSX.Element {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <Skeleton shape="custom" className="h-16 w-full rounded-card" />
        <div className="sf-card flex flex-col gap-4 p-4 sm:p-5">
          <Skeleton shape="line" className="w-1/4" />
          <Skeleton shape="line" className="w-2/3" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} shape="custom" className="h-11 w-full rounded-btn" />
            ))}
          </div>
          <Skeleton shape="custom" className="h-20 w-full rounded-card" />
          <Skeleton shape="custom" className="h-11 w-56 rounded-btn" />
        </div>
      </div>
      <SkeletonSummary />
    </div>
  );
}
