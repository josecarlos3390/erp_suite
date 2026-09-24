import { Skeleton, SkeletonProductGrid } from '@/components/ui/skeleton';

/** Carga de los resultados de busqueda (F9.3): misma estructura que la pagina. */
export default function SearchLoading(): JSX.Element {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Buscando productos</span>

      <Skeleton shape="line" className="w-32" />

      <div className="flex flex-col gap-2">
        <Skeleton shape="line" className="w-24" />
        <Skeleton className="h-9 w-80" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="sf-card flex flex-col gap-4 p-4 lg:w-72 lg:shrink-0">
          <Skeleton shape="line" className="w-20" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-32" />
        </div>
        <div className="flex-1">
          <SkeletonProductGrid />
        </div>
      </div>
    </div>
  );
}
