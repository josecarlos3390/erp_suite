import { Skeleton, SkeletonCart } from '@/components/ui/skeleton';

/**
 * Carga del carrito (F9.5).
 *
 * Misma estructura que la pagina real (migas, titulo, barra de pasos, lineas y
 * resumen pegajoso) para que al llegar el contenido no haya salto de layout. Es
 * tambien el esqueleto que se ve mientras el store rehidrata el carrito.
 */
export default function CartLoading(): JSX.Element {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando tu carrito</span>

      <Skeleton shape="line" className="w-40" />

      <div className="flex flex-col gap-2">
        <Skeleton shape="line" className="w-24" />
        <Skeleton shape="custom" className="h-9 w-64" />
      </div>

      <Skeleton shape="custom" className="h-16 w-full rounded-card" />

      <SkeletonCart />
    </div>
  );
}
