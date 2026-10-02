/**
 * Reglas de medios de la tienda (F9.1, decision D24).
 *
 * El seed del ERP publica **marcadores de posicion** de `picsum.photos` como
 * `imageUrl`: son fotos aleatorias que no representan el articulo y hacen que la
 * tienda parezca un banco de imagenes. Mientras no haya fotografia real, la
 * tienda **no** las pinta: las trata como «sin foto» y dibuja su propio
 * placeholder de marca. La regla es por **host**, asi que en cuanto el ERP
 * publique fotos reales se pintan solas, sin tocar la tienda.
 *
 * **Modo demostracion** (`STOREFRONT_SHOW_PLACEHOLDERS`, ver `.env.example`): mientras la tienda
 * es de prueba, quien la enseña puede pedir que esas fotos de relleno se pinten **como fotos
 * reales** para hacerse una idea de como queda el catalogo. El defecto —sin la variable o con
 * cualquier otro valor— es el de siempre: el marcador no es una foto del producto (D24).
 */

/** Hosts de marcador de posicion conocidos (dato de desarrollo). */
const PLACEHOLDER_HOSTS = new Set(['picsum.photos', 'fastly.picsum.photos', 'placehold.co']);

/**
 * Variable que enciende el modo demostracion. **Sin** prefijo `NEXT_PUBLIC_` a proposito: la lee
 * el servidor en cada peticion (`./show-placeholders`) y viaja a los componentes de cliente por
 * contexto, no por el bundle. Medido en `next@14.2.32`
 * (`build/webpack/plugins/define-env-plugin.js`): `process.env.NEXT_PUBLIC_*` se **incrusta en el
 * build** —servidor y cliente—, asi que con el prefijo el interruptor quedaria cocido en `.next`,
 * habria que reconstruir para apagarlo y la bandera de `.env.local` entraria en el build que
 * sirven los gates.
 */
export const SHOW_PLACEHOLDERS_ENV = 'STOREFRONT_SHOW_PLACEHOLDERS';

/** Valor de la variable: solo `true` (sin distinguir mayusculas ni espacios) enciende la demo. */
export function showPlaceholdersFrom(value: string | null | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === 'true';
}

/**
 * ¿Esta URL es un marcador de posicion (y por tanto hay que pintar el monograma)?
 *
 * `showPlaceholders` (modo demostracion) **no** cambia lo que no es foto: una URL ausente o vacia
 * sigue siendo «sin foto» y la decide el respaldo del monograma —tambien cuando la imagen falla en
 * el navegador—. Solo deja de tratar como marcador a los hosts de relleno.
 */
export function isPlaceholderImage(
  src: string | null | undefined,
  showPlaceholders = false,
): boolean {
  if (src === null || src === undefined || src.trim() === '') return true;
  // Modo demostracion: cualquier URL publicada se pinta como foto (host de relleno incluido).
  if (showPlaceholders) return false;
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

/**
 * Orden de la **galeria** de la ficha: la **principal primero**.
 *
 * Por que existe (medido el 2026-10-01, biblioteca de medios): el canal publica `images` por
 * `sortOrder` y la principal aparte (`image`). Con la foto que sube el usuario, la principal es la
 * **ultima** (`sortOrder` = maximo), asi que al armar la ficha con `product.images` la foto real
 * quedaba de cuarta miniatura y la **foto principal de la ficha seguia siendo el marcador**: el
 * mecanismo de «principal» del ERP no llegaba a la pantalla. Esta funcion pone delante la principal
 * —que es lo que `ItemImage.isPrimary` significa y lo que el back office promete— y **conserva** el
 * orden publicado para el resto, sin inventar ni reordenar lo que el canal no dijo.
 *
 * `primary` se reconoce por **URL** (`product.image` es exactamente la url principal), que es el
 * unico identificador que la tienda recibe: el canal no publica `id`s ni la bandera.
 */
export function productGallery(
  images: readonly string[],
  primary: string | null | undefined,
): string[] {
  const gallery = images.filter((url) => typeof url === 'string' && url.trim() !== '');
  if (primary === null || primary === undefined || primary.trim() === '') return gallery;
  const index = gallery.indexOf(primary);
  const [head] = gallery.slice(index);
  if (index <= 0 || head === undefined) return gallery;
  return [head, ...gallery.slice(0, index), ...gallery.slice(index + 1)];
}
