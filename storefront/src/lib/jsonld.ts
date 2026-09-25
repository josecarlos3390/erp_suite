import { SITE_NAME, absoluteUrl } from './site';
import type { Product } from './erp';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * JSON-LD de la ficha de producto.
 *
 * `Product.price` del canal YA es el precio efectivo (oferta aplicada cuando
 * esta vigente), asi que es el que se publica en el `Offer`. La disponibilidad
 * se toma de la ciudad elegida.
 */
export function productJsonLd(product: Product, cityName: string): Record<string, unknown> {
  const url = absoluteUrl(`/productos/${product.slug}`);
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
      seller: { '@type': 'Organization', name: SITE_NAME },
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
export function breadcrumbJsonLd(items: readonly Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href !== undefined ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

/** JSON-LD de listado (categorias, busqueda, home). */
export function itemListJsonLd(
  name: string,
  products: readonly Product[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(`/productos/${product.slug}`),
      name: product.name,
    })),
  };
}
