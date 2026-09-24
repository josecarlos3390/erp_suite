'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { MAX_WISHLIST_SLUGS } from '@/lib/wishlist';

/**
 * **Favoritos** de la tienda (F6).
 *
 * Igual que el comparador: se guarda la **identidad** del producto (`itemId`, `slug`, nombre e
 * imagen) y **no** una copia del precio, porque la lista de deseos se revisa dias despues y un
 * precio viejo no sirve para decidir: `/favoritos` pide los datos vigentes al canal.
 *
 * Vive en el navegador (`localStorage`) porque **no hay cuenta de cliente** hasta F4 (D16): los
 * favoritos son de **este dispositivo**, y migrarlos a la cuenta es trabajo de F4 (declarado).
 */
export interface WishlistEntry {
  itemId: number;
  slug: string;
  name: string;
  image: string | null;
}

interface WishlistState {
  entries: WishlistEntry[];
  /** Agrega o quita: el mismo control sirve para las dos cosas. */
  toggle: (entry: WishlistEntry) => void;
  remove: (itemId: number) => void;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
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
          return { entries: [...state.entries, entry] };
        }),
      remove: (itemId) =>
        set((state) => ({
          entries: state.entries.filter((item) => item.itemId !== itemId),
        })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: 'storefront_wishlist_v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Igual que el carrito y el comparador: la rehidratacion se dispara tras el montaje, para
      // que el HTML del servidor y el primer render del cliente coincidan.
      skipHydration: true,
    },
  ),
);

/** `true` si el producto esta en favoritos. */
export function isWishlisted(
  entries: readonly WishlistEntry[],
  itemId: number,
): boolean {
  return entries.some((entry) => entry.itemId === itemId);
}

/** Slugs de la lista, en orden y **recortados al tope** que acepta el API. */
export function wishlistSlugs(entries: readonly WishlistEntry[]): string[] {
  return entries.slice(0, MAX_WISHLIST_SLUGS).map((entry) => entry.slug);
}

/**
 * Favoritos **y si ya se rehidrataron**. Cada islote que pinta su estado usa este hook, asi
 * ninguno depende de otro para hidratarse (mismo patron que el comparador).
 */
export function useWishlistEntries(): {
  entries: WishlistEntry[];
  hydrated: boolean;
} {
  const entries = useWishlistStore((state) => state.entries);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    if (useWishlistStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsubscribe = useWishlistStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    void useWishlistStore.persist.rehydrate();
    return unsubscribe;
  }, []);

  return { entries, hydrated };
}
