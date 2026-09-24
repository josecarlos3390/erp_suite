import { Skeleton, SkeletonProductGrid } from '@/components/ui/skeleton';

/**
 * Carga del listado de una categoria (F9.3).
 *
 * Misma estructura que la pagina real (migas, titulo, panel de filtros y grilla)
 * para que al llegar el contenido no haya salto de layout.
 */
export default function CategoryLoading(): JSX.Element {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando la categoria</span>

      <Skeleton shape="line" className="w-40" />

      <div className="flex flex-col gap-2">
        <Skeleton shape="line" className="w-24" />
        <Skeleton shape="custom" className="h-9 w-72" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="sf-card flex flex-col gap-4 p-4 lg:w-72 lg:shrink-0">
          <Skeleton shape="line" className="w-20" />
          <Skeleton shape="custom" className="h-11 w-full" />
          <Skeleton shape="custom" className="h-11 w-full" />
          <Skeleton shape="custom" className="h-11 w-32" />
        </div>
        <div className="flex-1">
          <SkeletonProductGrid />
        </div>
      </div>
    </div>
  );
}
