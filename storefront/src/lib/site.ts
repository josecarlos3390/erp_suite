/**
 * Identidad y URL publica de la tienda.
 *
 * **Una instancia = una empresa** (decision de despliegue, T216-bis): el tenant del canal
 * sale de la clave (`STOREFRONT_API_KEY`), asi que cada tienda publicada es su propio
 * despliegue y su identidad se configura por variables de entorno en ese despliegue. Lo que
 * hoy es configurable:
 *
 *  - `NEXT_PUBLIC_SITE_NAME` / `NEXT_PUBLIC_SITE_DESCRIPTION`: el nombre y la descripcion
 *    que ven el comprador y los buscadores (cabecera, pie, `<title>`, Open Graph y
 *    JSON-LD). Antes estaban **fijos** en el codigo (`Tienda ERP`), asi que dos empresas
 *    publicadas se llamaban igual.
 *  - `NEXT_PUBLIC_SITE_URL` es obligatorio en produccion: canonicos, Open Graph, sitemap y
 *    JSON-LD salen de aqui (por defecto `http://localhost:3000`, que en un despliegue real
 *    seria un canonico roto).
 *
 * Lo que **no** es configurable todavia esta declarado en el README: el color de marca
 * (`--sf-*` de `brand.css`) y el logo por empresa siguen siendo del codigo (D23 dejo las
 * variables preparadas; la pantalla del back office es trabajo aparte del ERP).
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

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl()}${normalized}`;
}
