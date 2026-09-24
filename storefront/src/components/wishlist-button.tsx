'use client';

import {
  isWishlisted,
  useWishlistEntries,
  useWishlistStore,
  type WishlistEntry,
} from '@/store/wishlist';

interface WishlistButtonProps {
  item: WishlistEntry;
  /** `sm` en la tarjeta, `md` en la ficha. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Boton de **favoritos** (F6): guarda o quita el producto de la lista del comprador.
 *
 * El estado se anuncia con `aria-pressed` y con el texto del boton, no solo con el color: el
 * corazon relleno y el `data-selected` acompanan, pero quien lee la pantalla oye «Guardar en
 * favoritos» / «Quitar de favoritos».
 */
export function WishlistButton({
  item,
  size = 'sm',
  className,
}: WishlistButtonProps): JSX.Element {
  const { entries, hydrated } = useWishlistEntries();
  const toggle = useWishlistStore((state) => state.toggle);

  const selected = hydrated && isWishlisted(entries, item.itemId);
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
      aria-pressed={selected}
      className={classes}
      data-testid="wishlist-toggle"
      data-slug={item.slug}
      data-selected={selected ? 'true' : 'false'}
    >
      <span aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={selected ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <path d="M12 20s-7-4.3-7-9.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7 3.1c0 5-7 9.3-7 9.3z" />
        </svg>
      </span>
      {selected ? 'En favoritos' : 'Guardar'}
    </button>
  );
}
