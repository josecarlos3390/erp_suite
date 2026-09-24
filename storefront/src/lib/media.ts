/**
 * Reglas de medios de la tienda (F9.1, decision D24).
 *
 * El seed del ERP publica **marcadores de posicion** de `picsum.photos` como
 * `imageUrl`: son fotos aleatorias que no representan el articulo y hacen que la
 * tienda parezca un banco de imagenes. Mientras no haya fotografia real, la
 * tienda **no** las pinta: las trata como «sin foto» y dibuja su propio
 * placeholder de marca. La regla es por **host**, asi que en cuanto el ERP
 * publique fotos reales se pintan solas, sin tocar la tienda.
 */

/** Hosts de marcador de posicion conocidos (dato de desarrollo). */
const PLACEHOLDER_HOSTS = new Set(['picsum.photos', 'fastly.picsum.photos', 'placehold.co']);

export function isPlaceholderImage(src: string | null | undefined): boolean {
  if (src === null || src === undefined || src.trim() === '') return true;
  try {
    const url = new URL(src);
    return PLACEHOLDER_HOSTS.has(url.hostname);
  } catch {
    // Una URL relativa o invalida no es un marcador: la decide el navegador.
    return false;
  }
}

/** Monograma de dos letras para el placeholder (`Aceite Sintetico` → `AS`). */
export function productMonogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
  const letters = words.slice(0, 2).map((word) => word[0] ?? '');
  const monogram = letters.join('').toUpperCase();
  return monogram === '' ? '·' : monogram;
}
