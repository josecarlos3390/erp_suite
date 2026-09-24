import { Skeleton, SkeletonCheckout } from '@/components/ui/skeleton';

/**
 * Carga del checkout (F9.5).
 *
 * El checkout resuelve la ciudad contra el canal en el servidor; mientras tanto se
 * pinta la misma estructura que la pagina real (migas, titulo, barra de pasos,
 * formulario y resumen pegajoso) en vez de una pantalla en blanco.
 */
export default function CheckoutLoading(): JSX.Element {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el checkout</span>

      <Skeleton shape="line" className="w-48" />

      <div className="flex flex-col gap-2">
        <Skeleton shape="line" className="w-24" />
        <Skeleton shape="custom" className="h-9 w-40" />
      </div>

      <SkeletonCheckout />
    </div>
  );
}
