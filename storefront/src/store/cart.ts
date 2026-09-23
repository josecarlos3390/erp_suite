'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Carrito de la tienda (decision D2: el carrito vive en la tienda; el pedido lo
 * crea el ERP en el checkout de F3).
 *
 * Lo que se guarda es un SNAPSHOT para mostrar: `itemId`, `slug`, `name`, `sku`,
 * `price` (precio efectivo del canal al agregar), `currency`, `image`,
 * `quantity` y `cityCode`. El precio que manda es el que el ERP recalcule al
 * crear el pedido: esta tienda nunca cobra por su cuenta.
 */

export interface CartLine {
  itemId: number;
  slug: string;
  name: string;
  sku: string;
  price: number;
  currency: string;
  image: string | null;
  quantity: number;
  cityCode: string;
}

export interface CartLineInput {
  itemId: number;
  slug: string;
  name: string;
  sku: string;
  price: number;
  currency: string;
  image: string | null;
  cityCode: string;
}

export const MAX_LINE_QUANTITY = 20;

interface CartState {
  lines: CartLine[];
  addLine: (line: CartLineInput, quantity?: number) => void;
  setQuantity: (itemId: number, quantity: number) => void;
  removeLine: (itemId: number) => void;
  clear: () => void;
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(1, Math.trunc(quantity)), MAX_LINE_QUANTITY);
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      addLine: (line, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((item) => item.itemId === line.itemId);
          if (existing === undefined) {
            return { lines: [...state.lines, { ...line, quantity: clampQuantity(quantity) }] };
          }
          return {
            lines: state.lines.map((item) =>
              item.itemId === line.itemId
                ? { ...item, ...line, quantity: clampQuantity(item.quantity + quantity) }
                : item,
            ),
          };
        }),
      setQuantity: (itemId, quantity) =>
        set((state) => ({
          lines: state.lines.map((item) =>
            item.itemId === itemId ? { ...item, quantity: clampQuantity(quantity) } : item,
          ),
        })),
      removeLine: (itemId) =>
        set((state) => ({ lines: state.lines.filter((item) => item.itemId !== itemId) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'storefront_cart_v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // La rehidratacion se dispara a proposito despues del montaje
      // (ver CartHydration): asi el HTML del servidor y el primer render del
      // cliente coinciden y no hay desajuste de hidratacion en el contador.
      skipHydration: true,
    },
  ),
);

/** Cantidad total de unidades (0 antes de rehidratar). */
export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/** Subtotal de referencia de la tienda. */
export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.price * line.quantity, 0);
}
