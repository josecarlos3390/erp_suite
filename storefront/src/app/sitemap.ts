import type { MetadataRoute } from 'next';

import { currentChannelOrDefault } from '@/lib/channels';
import { getCategories, getPublishedSlugs } from '@/lib/erp';

/**
 * Sitemap construido desde el catalogo publicado del ERP, **por host**: cada dominio sirve las
 * URLs de su propia tienda (con `NEXT_PUBLIC_SITE_URL` unico, el sitemap de la empresa B habria
 * publicado las URLs de la A).
 *
 * Si el canal no responde, el sitemap se sirve con las rutas fijas: preferimos un
 * sitemap incompleto antes que romper la ruta.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const channel = await currentChannelOrDefault();
  const base = channel.url;
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/categorias`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/sucursales`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  try {
    const [productSlugs, categories] = await Promise.all([getPublishedSlugs(), getCategories()]);

    for (const category of categories) {
      entries.push({
        url: `${base}/categorias/${category.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
      for (const child of category.children) {
        entries.push({
          url: `${base}/categorias/${child.slug}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }

    for (const slug of productSlugs) {
      entries.push({
        url: `${base}/productos/${slug}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.9,
      });
    }
  } catch {
    // El canal no respondio: se publican solo las rutas fijas.
  }

  return entries;
}
