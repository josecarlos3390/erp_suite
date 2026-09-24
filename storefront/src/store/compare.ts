'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { MAX_COMPARE_SLUGS } from '@/lib/compare';

/**
 * **Comparador** de la tienda (F6).
 *
 * Lo que se guarda es la **identidad** del producto —`itemId`, `slug`, nombre e imagen, para
 * poder pintar la columna antes de pedir el detalle—, **no** una copia del precio: la
 * comparacion pide al canal el dato **vigente** (precio, existencia, garantia, ficha tecnica)
 * al abrir `/comparar`. Es la diferencia con el carrito, que si guarda un snapshot porque su
 * importe es solo una referencia y el pedido lo vuelve a calcular el ERP.
 *
 * Vive en el navegador (`localStorage`) porque **no hay cuenta de cliente** hasta F4 (D16): la
 * lista es de **este dispositivo**, igual que el carrito (D2). El tope es 4 para que la tabla
 * se lea en pantalla sin scroll horizontal.
 */
export interface CompareEntry {
  itemId: number;
  slug: string;
  name: string;
  image: string | null;
}

/** Tope de productos comparados a la vez (la tabla se lee sin scroll horizontal). */
export const MAX_COMPARE_ITEMS = MAX_COMPARE_SLUGS;

interface CompareState {
  entries: CompareEntry[];
  /** Agrega o quita: el mismo control sirve para las dos cosas. */
  toggle: (entry: CompareEntry) => void;
  remove: (itemId: number) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      entries: [],
      toggle: (entry) =>
        set((state) => {
          const already = state.entries.some(
            (item) => item.itemId === entry.itemId,
          );
          if (already) {
            return {
              entries: state.entries.filter(
                (item) => item.itemId !== entry.itemId,
              ),
            };
          }
          // El tope se respeta **en el store** y no solo en la interfaz: si la lista ya esta
          // llena, se ignora el alta en vez de recortar la primera (quitar y agregar en el
          // mismo gesto sorprenderia al comprador).
          if (state.entries.length >= MAX_COMPARE_ITEMS) return state;
          return { entries: [...state.entries, entry] };
        }),
      remove: (itemId) =>
        set((state) => ({
          entries: state.entries.filter((item) => item.itemId !== itemId),
        })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: 'storefront_compare_v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Igual que el carrito: la rehidratacion se dispara despues del montaje
      // (`CompareHydration`), para que el HTML del servidor y el primer render del
      // cliente coincidan y no haya desajuste de hidratacion en el contador.
      skipHydration: true,
    },
  ),
);

/** `true` si el producto ya esta en la lista. */
export function isCompared(
  entries: readonly CompareEntry[],
  itemId: number,
): boolean {
  return entries.some((entry) => entry.itemId === itemId);
}

/** `true` si la lista esta llena (y el producto no esta dentro: si esta, se puede quitar). */
export function isCompareFull(
  entries: readonly CompareEntry[],
  itemId?: number,
): boolean {
  if (entries.length < MAX_COMPARE_ITEMS) return false;
  return itemId === undefined ? true : !isCompared(entries, itemId);
}

/** Slugs de la lista, en orden: es lo que se le pide al canal. */
export function compareSlugs(entries: readonly CompareEntry[]): string[] {
  return entries.map((entry) => entry.slug);
}

/**
 * Lista comparada **y si ya se rehidrato**.
 *
 * El store usa `skipHydration` (igual que el carrito) para que el HTML del servidor y el
 * primer render del cliente coincidan: hasta que no termina la rehidratacion, `entries` esta
 * vacio y **no se puede afirmar** que un producto no este en la lista. Cada islote que pinta
 * el estado del comparador usa este hook, asi ninguno depende de otro para hidratarse.
 */
export function useCompareEntries(): {
  entries: CompareEntry[];
  hydrated: boolean;
} {
  const entries = useCompareStore((state) => state.entries);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    if (useCompareStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsubscribe = useCompareStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    void useCompareStore.persist.rehydrate();
    return unsubscribe;
  }, []);

  return { entries, hydrated };
}
