'use client';

import {
  MAX_COMPARE_ITEMS,
  isCompared,
  isCompareFull,
  useCompareEntries,
  useCompareStore,
  type CompareEntry,
} from '@/store/compare';

interface CompareToggleProps {
  item: CompareEntry;
  /** `sm` en la tarjeta, `md` en la ficha (mismo alto minimo de 44 px del sistema). */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Control de **comparar** (F6): agrega o quita el producto de la lista del comparador.
 *
 * Es un islote cliente porque la lista vive en el navegador (`localStorage`) y el tope es 4:
 * cuando esta llena y el producto **no** esta dentro, el control se **deshabilita** con el
 * motivo escrito (un boton que no hace nada sin explicar por que es un defecto de UX). El
 * `data-selected` permite al E2E leer el estado sin depender del texto.
 */
export function CompareToggle({
  item,
  size = 'sm',
  className,
}: CompareToggleProps): JSX.Element {
  const { entries, hydrated } = useCompareEntries();
  const toggle = useCompareStore((state) => state.toggle);

  const selected = hydrated && isCompared(entries, item.itemId);
  const full = hydrated && isCompareFull(entries, item.itemId);
  const classes = [
    'sf-toggle-pill',
    selected ? 'sf-toggle-pill--on' : '',
    size === 'sm' ? 'text-2xs' : 'text-sm',
    className ?? '',
  ]
    .filter((value) => value !== '')
    .join(' ');

  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      disabled={full}
      aria-pressed={selected}
      title={
        full
          ? `Ya comparas ${MAX_COMPARE_ITEMS} productos: quita uno para agregar otro.`
          : undefined
      }
      className={classes}
      data-testid="compare-toggle"
      data-slug={item.slug}
      data-selected={selected ? 'true' : 'false'}
    >
      <span aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <path d="M4 7h10M4 17h10M17 4v6M14 7h6M17 14v6M14 17h6" />
        </svg>
      </span>
      {selected ? 'En comparacion' : 'Comparar'}
    </button>
  );
}
