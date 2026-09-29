import type { MetadataRoute } from 'next';

import { currentChannelOrDefault } from '@/lib/channels';

/**
 * `robots.txt` **por host**: con un despliegue sirviendo varios dominios, cada tienda publica su
 * propio sitemap y su propio `host` (antes salia de `NEXT_PUBLIC_SITE_URL`, un unico dominio).
 * La ruta deja de ser estatica: se renderiza por peticion, que es lo que exige ser por host.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const channel = await currentChannelOrDefault();
  const base = channel.url;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // El carrito y los resultados de busqueda no aportan al indice.
        disallow: ['/carrito', '/buscar', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
