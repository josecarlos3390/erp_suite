/**
 * Identidad y URL publica de la tienda.
 *
 * `NEXT_PUBLIC_SITE_URL` es opcional: se usa para canonicos, Open Graph, sitemap
 * y JSON-LD. En produccion debe apuntar al dominio real de la tienda.
 */
export const SITE_NAME = 'Tienda ERP';

export const SITE_DESCRIPTION =
  'Catalogo publicado desde el ERP: tecnologia, electrodomesticos y hogar con entrega en Bolivia.';

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const base = configured !== undefined && configured.trim() !== '' ? configured.trim() : 'http://localhost:3000';
  return base.replace(/\/+$/, '');
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl()}${normalized}`;
}
