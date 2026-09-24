import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AddToCartButton } from '@/components/add-to-cart-button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { ProductGallery } from '@/components/product-gallery';
import { ProductGrid } from '@/components/product-grid';
import { getCityContext } from '@/lib/city';
import { getProduct, getRelated, type ProductSpec } from '@/lib/erp';
import { describeShipping, formatDiscount, formatMoney, formatMonths } from '@/lib/format';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';

interface ProductPageProps {
  params: { slug: string };
}

const RELATED_LIMIT = 4;

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (product === null) {
    return { title: 'Producto no encontrado', robots: { index: false, follow: false } };
  }
  const title = `${product.name}${product.brand !== null ? ` · ${product.brand}` : ''}`;
  const description =
    product.shortDescription ??
    `${product.name} disponible en la tienda en linea, con precio publicado por el ERP.`;
  const images = product.images.length > 0 ? product.images : product.image !== null ? [product.image] : [];
  return {
    title,
    description,
    alternates: { canonical: `/productos/${product.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      ...(images.length > 0 ? { images } : {}),
    },
  };
}

function groupSpecs(specs: readonly ProductSpec[]): { group: string; rows: ProductSpec[] }[] {
  const groups = new Map<string, ProductSpec[]>();
  for (const spec of specs) {
    const key = spec.groupName ?? 'General';
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [spec]);
    } else {
      bucket.push(spec);
    }
  }
  return [...groups.entries()].map(([group, rows]) => ({ group, rows }));
}

export default async function ProductPage({ params }: ProductPageProps): Promise<JSX.Element> {
  const { city } = await getCityContext();
  const product = await getProduct(params.slug, city.code);
  if (product === null) {
    notFound();
  }

  const related = await getRelated(product.slug, city.code);
  const images = product.images.length > 0 ? product.images : product.image !== null ? [product.image] : [];
  const discount = formatDiscount(product.discountPct);
  const hasOffer = product.salePrice !== null;
  const specGroups = groupSpecs(product.specs);

  const crumbs = [
    { label: 'Inicio', href: '/' },
    ...(product.category !== null
      ? [
          { label: 'Categorias', href: '/categorias' },
          { label: product.category.name, href: `/categorias/${product.category.slug}` },
        ]
      : []),
    { label: product.name },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ProductGallery images={images} name={product.name} />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            {product.brand !== null ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                {product.brand}
              </p>
            ) : null}
            <h1 className="text-2xl font-bold text-fg" data-testid="product-title">
              {product.name}
            </h1>
            <p className="text-xs text-fg-tertiary">SKU {product.sku}</p>
          </div>

          {product.badges.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {product.badges.map((badge) => (
                <li key={badge} className="sf-chip" data-testid="product-badge">
                  {badge}
                </li>
              ))}
            </ul>
          ) : null}

          <section aria-label="Precio" className="rounded-lg border border-line bg-elevated p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-3xl font-bold text-fg" data-testid="detail-price">
                {formatMoney(product.price, product.currency)}
              </p>
              {discount !== null ? (
                <span
                  className="rounded-full bg-danger px-2 py-1 text-xs font-bold text-fg-inverse"
                  data-testid="detail-discount-badge"
                >
                  {discount}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-fg-secondary" data-testid="price-kind">
              {hasOffer
                ? 'Oferta vigente: el ERP ya aplica el descuento sobre el precio publicado.'
                : 'Precio de lista publicado por el ERP.'}
            </p>
            <p className="mt-2 text-2xs text-fg-tertiary">
              El importe final (impuestos, envio y descuentos) lo confirma el ERP al crear el pedido.
            </p>
          </section>

          <section aria-label="Disponibilidad" className="flex flex-col gap-2">
            <p
              className={`text-sm font-semibold ${product.availability.inStock ? 'text-fg-success' : 'text-fg-error'}`}
              data-testid="detail-availability"
            >
              {product.availability.inStock
                ? `Disponible: ${product.availability.available}`
                : `Sin existencia en ${city.name}`}
            </p>
            <ul className="flex flex-col gap-1 text-xs text-fg-secondary">
              <li data-testid="product-city">
                Ciudad de entrega: <strong className="text-fg">{city.name}</strong> (almacen{' '}
                {product.availability.warehouseId ?? 'sin asignar'})
              </li>
              {product.deliveryDays !== null ? (
                <li>
                  Entrega estimada: {product.deliveryDays}{' '}
                  {product.deliveryDays === 1 ? 'dia habil' : 'dias habiles'}
                </li>
              ) : null}
              {product.warrantyMonths !== null ? (
                <li>Garantia: {formatMonths(product.warrantyMonths)}</li>
              ) : null}
              <li>{describeShipping(city.shippingCost, city.freeShippingFrom, product.currency)}</li>
              {product.isOnlineOnly ? <li>Solo venta en linea.</li> : null}
            </ul>
          </section>

          <AddToCartButton
            product={{
              itemId: product.itemId,
              slug: product.slug,
              name: product.name,
              sku: product.sku,
              price: product.price,
              currency: product.currency,
              image: product.image,
            }}
            inStock={product.availability.inStock}
            cityCode={city.code}
            cityName={city.name}
          />

          {product.shortDescription !== null ? (
            <p className="text-sm text-fg-secondary">{product.shortDescription}</p>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="ficha-titulo">
        <h2 id="ficha-titulo" className="mb-3 text-lg font-semibold text-fg">
          Ficha tecnica
        </h2>
        {specGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-elevated p-4 text-sm text-fg-secondary">
            El ERP no publico caracteristicas para este articulo.
          </p>
        ) : (
          specGroups.map((group) => (
            <div key={group.group} className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-fg-secondary">{group.group}</h3>
              <table className="w-full border-collapse text-sm" data-testid="specs-table">
                <caption className="sr-only">{`Caracteristicas de ${product.name}`}</caption>
                <tbody>
                  {group.rows.map((spec) => (
                    <tr key={`${group.group}-${spec.name}`} className="border-b border-line-subtle">
                      <th scope="row" className="w-1/2 py-2 pr-4 text-left font-medium text-fg-secondary">
                        {spec.name}
                      </th>
                      <td className="py-2 text-fg">
                        {spec.value}
                        {spec.unit !== null && spec.unit !== '' ? ` ${spec.unit}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="relacionados-titulo">
        <h2 id="relacionados-titulo" className="mb-3 text-lg font-semibold text-fg">
          Productos relacionados
        </h2>
        {related.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-elevated p-4 text-sm text-fg-secondary">
            El canal no devolvio relacionados para este articulo.
          </p>
        ) : (
          <ProductGrid
            products={related.slice(0, RELATED_LIMIT)}
            cityName={city.name}
            cityCode={city.code}
            label="Productos relacionados"
          />
        )}
      </section>

      <p className="text-xs text-fg-tertiary">
        <Link href={product.category !== null ? `/categorias/${product.category.slug}` : '/categorias'} className="sf-link">
          Volver al listado
        </Link>
      </p>

      <JsonLd data={productJsonLd(product, city.name)} id="jsonld-producto" />
      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-migas-producto" />
    </div>
  );
}
