import { currentChannelOrDefault } from './channels';
import type { Product } from './erp';

export interface Crumb {
  label: string;
  href?: string;
}

/** URL absoluta **del host que sirve la tienda** (con N dominios, la del dominio de la peticion). */
async function absoluteUrl(path: string): Promise<string> {
  const channel = await currentChannelOrDefault();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${channel.url}${normalized}`;
}

/**
 * JSON-LD de la ficha de producto.
 *
 * `Product.price` del canal YA es el precio efectivo (oferta aplicada cuando
 * esta vigente), asi que es el que se publica en el `Offer`. La disponibilidad
 * se toma de la ciudad elegida.
 */
export async function productJsonLd(
  product: Product,
  cityName: string,
): Promise<Record<string, unknown>> {
  const channel = await currentChannelOrDefault();
  const url = await absoluteUrl(`/productos/${product.slug}`);
  const images = product.images.length > 0 ? product.images : product.image !== null ? [product.image] : [];

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    url,
    ...(product.shortDescription !== null ? { description: product.shortDescription } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.brand !== null ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.category !== null ? { category: product.category.name } : {}),
    offers: {
      '@type': 'Offer',
      url,
      price: product.price,
      priceCurrency: product.currency,
      availability: product.availability.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: channel.name },
      areaServed: cityName,
      ...(product.deliveryDays !== null
        ? {
            shippingDetails: {
              '@type': 'OfferShippingDetails',
              shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BO' },
              deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                transitTime: {
                  '@type': 'QuantitativeValue',
                  minValue: product.deliveryDays,
                  maxValue: product.deliveryDays,
                  unitCode: 'DAY',
                },
              },
            },
          }
        : {}),
    },
    // F6: el promedio solo se declara con resenas **aprobadas** y con su numero. Sin resenas
    // no se publica `aggregateRating` (Google lo rechaza y no seria cierto).
    ...(product.rating !== undefined && product.rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/** JSON-LD de migas de pan. */
export async function breadcrumbJsonLd(
  items: readonly Crumb[],
): Promise<Record<string, unknown>> {
  const resolved = await Promise.all(
    items.map(async (item) => ({
      '@type': 'ListItem',
      name: item.label,
      ...(item.href !== undefined ? { item: await absoluteUrl(item.href) } : {}),
    })),
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: resolved.map((item, index) => ({
      ...item,
      position: index + 1,
    })),
  };
}

/** JSON-LD de listado (categorias, busqueda, home). */
export async function itemListJsonLd(
  name: string,
  products: readonly Product[],
): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    products.map(async (product) => ({
      '@type': 'ListItem',
      url: await absoluteUrl(`/productos/${product.slug}`),
      name: product.name,
    })),
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: products.length,
    itemListElement: entries.map((item, index) => ({
      ...item,
      position: index + 1,
    })),
  };
}
