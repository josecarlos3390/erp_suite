'use client';

import { useEffect } from 'react';

import { useCartStore } from '@/store/cart';

/**
 * Rehidrata el carrito despues del montaje.
 *
 * El store usa `skipHydration` a proposito: asi el HTML del servidor y el primer
 * render del cliente son identicos (carrito vacio) y no hay desajuste de
 * hidratacion. Despues del montaje se lee localStorage y el contador se corrige.
 */
export function CartHydration(): null {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return null;
}
