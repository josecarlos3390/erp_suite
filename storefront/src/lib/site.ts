/**
 * **Valores por defecto del despliegue** (identidad y URL publica de la tienda).
 *
 * Ojo: la identidad y la URL **efectivas** las resuelve `@/lib/channels` **por host**
 * (`STOREFRONT_CHANNELS`), porque un solo despliegue puede servir varios dominios: cada tienda
 * publica su nombre, su descripcion y su canonica. Este modulo es el respaldo que se usa cuando no
 * hay mapa de canales (una empresa por despliegue, el modo de siempre) y el valor base de
 * `NEXT_PUBLIC_SITE_URL` para `robots`/`sitemap` cuando no hay host en la peticion.
 *
 *  - `NEXT_PUBLIC_SITE_NAME` / `NEXT_PUBLIC_SITE_DESCRIPTION`: nombre y descripcion por defecto.
 *  - `NEXT_PUBLIC_SITE_URL` es obligatorio en produccion en el modo de una empresa por despliegue
 *    (canonicos, Open Graph, sitemap y JSON-LD); con `STOREFRONT_CHANNELS` cada host deriva la suya.
 *
 * Lo que **no** es configurable todavia esta declarado en el README: el color de marca (`--sf-*` de
 * `brand.css`) y el logo por empresa siguen siendo del codigo (D23 dejo las variables preparadas;
 * la pantalla del back office es trabajo aparte del ERP).
 */

/** Texto de una variable de entorno, o el respaldo si viene vacia. */
function envText(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value.trim() !== '' ? value.trim() : fallback;
}

export const SITE_NAME = envText('NEXT_PUBLIC_SITE_NAME', 'Tienda ERP');

export const SITE_DESCRIPTION = envText(
  'NEXT_PUBLIC_SITE_DESCRIPTION',
  'Catalogo publicado desde el ERP: tecnologia, electrodomesticos y hogar con entrega en Bolivia.',
);

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const base =
    configured !== undefined && configured.trim() !== ''
      ? configured.trim()
      : 'http://localhost:3000';
  return base.replace(/\/+$/, '');
}
