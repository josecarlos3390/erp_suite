/**
 * Constantes de los **favoritos** (F6).
 *
 * Modulo **puro** a proposito: lo importan el islote de la pagina y el store del navegador, que
 * son componentes de cliente, y `lib/product-lookup.ts` —que si es de servidor porque habla con
 * el canal— no puede viajar al navegador. La regla de saneo vive alli, compartida con el
 * comparador.
 */

/** Tope de favoritos que se piden y se muestran de una vez. */
export const MAX_WISHLIST_SLUGS = 24;

/** Ruta del puente que devuelve los datos **vigentes** de los favoritos. */
export function wishlistApiHref(slugs: readonly string[], cityCode: string): string {
  const params = new URLSearchParams({ slugs: slugs.join(',') });
  if (cityCode !== '') params.set('city', cityCode);
  return `/api/favoritos?${params.toString()}`;
}
