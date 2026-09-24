import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CompareToggle } from "@/components/compare-toggle";
import { JsonLd } from "@/components/json-ld";
import { ProductGallery } from "@/components/product-gallery";
import { ProductGrid } from "@/components/product-grid";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { getCityContext } from "@/lib/city";
import { getProduct, getRelated, type ProductSpec } from "@/lib/erp";
import {
  describeShipping,
  formatDiscount,
  formatMoney,
  formatMonths,
} from "@/lib/format";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/jsonld";

interface ProductPageProps {
  params: { slug: string };
}

const RELATED_LIMIT = 4;

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (product === null) {
    return {
      title: "Producto no encontrado",
      robots: { index: false, follow: false },
    };
  }
  const title = `${product.name}${product.brand !== null ? ` · ${product.brand}` : ""}`;
  const description =
    product.shortDescription ??
    `${product.name} disponible en la tienda en linea, con precio publicado por el ERP.`;
  const images =
    product.images.length > 0
      ? product.images
      : product.image !== null
        ? [product.image]
        : [];
  return {
    title,
    description,
    alternates: { canonical: `/productos/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      ...(images.length > 0 ? { images } : {}),
    },
  };
}

function groupSpecs(
  specs: readonly ProductSpec[],
): { group: string; rows: ProductSpec[] }[] {
  const groups = new Map<string, ProductSpec[]>();
  for (const spec of specs) {
    const key = spec.groupName ?? "General";
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [spec]);
    } else {
      bucket.push(spec);
    }
  }
  return [...groups.entries()].map(([group, rows]) => ({ group, rows }));
}

/**
 * Ficha de producto (F9.1/F9.4).
 *
 * Composicion: galeria con zoom a la izquierda y **caja de compra pegajosa** a la
 * derecha (marca, titulo, insignias, precio con su «antes», disponibilidad,
 * tarjetas de entrega/envio/garantia/cuotas y la cantidad con el boton de compra),
 * y debajo la ficha tecnica en **acordeones** (abiertos por defecto) y los
 * relacionados.
 *
 * Honestidad del dato: la garantia, el plazo y el envio salen del ERP y de la
 * ciudad elegida; **no se inventan cuotas** —si el ERP publica la insignia
 * `CUOTAS`, la tarjeta dice que se eligen y confirman en el checkout—.
 */
export default async function ProductPage({
  params,
}: ProductPageProps): Promise<JSX.Element> {
  const { city } = await getCityContext();
  const product = await getProduct(params.slug, city.code);
  if (product === null) {
    notFound();
  }

  const related = await getRelated(product.slug, city.code);
  const images =
    product.images.length > 0
      ? product.images
      : product.image !== null
        ? [product.image]
        : [];
  const discount = formatDiscount(product.discountPct);
  const hasOffer = product.salePrice !== null;
  // Promo del canal (D21): descuento **solo de la tienda**. Se rotula aparte de la oferta
  // del ERP porque son dos capas distintas y el comprador tiene que poder ver cual aplica.
  // Se comprueba por **numero**: un fixture grabado con el contrato anterior no trae el
  // campo y `undefined` no puede pintar un badge.
  const promoPct =
    typeof product.channelDiscountPct === "number" &&
    product.channelDiscountPct > 0
      ? product.channelDiscountPct
      : null;
  const specGroups = groupSpecs(product.specs);
  const hasInstallments = product.badges.some(
    (badge) => badge.trim().toUpperCase() === "CUOTAS",
  );
  const compareAt =
    product.listPrice > product.price ? product.listPrice : null;

  const crumbs = [
    { label: "Inicio", href: "/" },
    ...(product.category !== null
      ? [
          { label: "Categorias", href: "/categorias" },
          {
            label: product.category.name,
            href: `/categorias/${product.category.slug}`,
          },
        ]
      : []),
    { label: product.name },
  ];

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <ProductGallery images={images} name={product.name} />

        <div className="flex flex-col gap-4 lg:sticky lg:top-32">
          <div className="flex flex-col gap-1.5">
            {product.brand !== null ? (
              <p className="sf-eyebrow">{product.brand}</p>
            ) : null}
            <h1 className="sf-h1 text-fg" data-testid="product-title">
              {product.name}
            </h1>
            <p className="text-xs text-fg-tertiary">SKU {product.sku}</p>
            {/*
              F6: el vendedor de la publicacion, con su monograma. El canal publica tambien
              su logo (`sellerLogoUrl`) pero la semilla no trae ninguno, asi que la tienda no
              pinta una imagen que no existe: usa la inicial del nombre.
              La comprobacion es `typeof`, no `!== null`: una respuesta cacheada de una version
              anterior del canal puede **no traer la clave**, y eso no puede tumbar la ficha.
            */}
            {typeof product.seller === "string" && product.seller.length > 0 ? (
              <p
                className="flex items-center gap-2 text-sm text-fg-secondary"
                data-testid="product-seller"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-fg-accent"
                >
                  {product.seller.charAt(0).toUpperCase()}
                </span>
                Vendido por{" "}
                <span className="font-semibold text-fg">{product.seller}</span>
              </p>
            ) : null}
          </div>

          {product.badges.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {product.badges.map((badge) => (
                <li key={badge}>
                  <Badge
                    variant={
                      badge.trim().toUpperCase() === "OFERTA" ? "promo" : "soft"
                    }
                    testId="product-badge"
                  >
                    {badge}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <section className="sf-panel flex flex-col gap-2" aria-label="Precio">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="sf-price text-3xl" data-testid="detail-price">
                {formatMoney(product.price, product.currency)}
              </p>
              {discount !== null ? (
                <Badge
                  variant="deal"
                  testId="detail-discount-badge"
                  srLabel={`Descuento de ${discount}`}
                >
                  {discount}
                </Badge>
              ) : null}
              {promoPct !== null ? (
                <Badge
                  variant="promo"
                  testId="detail-channel-promo-badge"
                  srLabel={`Promo online de ${promoPct}%`}
                >
                  Promo online −{promoPct}%
                </Badge>
              ) : null}
            </div>
            {compareAt !== null ? (
              <p className="text-xs text-fg-secondary">
                Antes{" "}
                <span className="sf-price-compare">
                  {formatMoney(compareAt, product.currency)}
                </span>{" "}
                · ahorras{" "}
                {formatMoney(compareAt - product.price, product.currency)}
              </p>
            ) : null}
            <p className="text-xs text-fg-secondary" data-testid="price-kind">
              {promoPct !== null
                ? "Promo online: descuento exclusivo de la tienda, encima del precio del ERP."
                : hasOffer
                  ? "Oferta vigente: el ERP ya aplica el descuento sobre el precio publicado."
                  : "Precio de lista publicado por el ERP."}
            </p>
            <p className="text-2xs text-fg-tertiary">
              El importe final (impuestos, envio y descuentos) lo confirma el
              ERP al crear el pedido.
            </p>
          </section>

          <p
            className={`flex items-center gap-2 text-sm font-semibold ${product.availability.inStock ? "text-price-free" : "text-fg-error"}`}
            data-testid="detail-availability"
          >
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full ${product.availability.inStock ? "bg-price-free" : "bg-fg-error"}`}
            />
            {product.availability.inStock
              ? `Disponible: ${product.availability.available}`
              : `Sin existencia en ${city.name}`}
          </p>

          <ul className="grid gap-2 sm:grid-cols-2">
            <li className="sf-panel flex items-start gap-2 p-3">
              <span aria-hidden="true" className="text-fg-accent">
                <TruckIcon />
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold text-fg">Entrega</span>
                <span className="text-2xs text-fg-secondary">
                  {product.deliveryDays !== null
                    ? `${product.deliveryDays} ${product.deliveryDays === 1 ? "dia habil" : "dias habiles"} a ${city.name}`
                    : "El plazo lo confirma el ERP al crear el pedido."}
                </span>
                <span
                  className="text-2xs text-fg-tertiary"
                  data-testid="product-city"
                >
                  Ciudad de entrega: {city.name}
                  {product.availability.warehouseId !== null
                    ? ` (almacen ${product.availability.warehouseId})`
                    : ""}
                </span>
              </span>
            </li>

            <li className="sf-panel flex items-start gap-2 p-3">
              <span aria-hidden="true" className="text-fg-accent">
                <BoxIcon />
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold text-fg">Envio</span>
                <span className="text-2xs text-fg-secondary">
                  {describeShipping(
                    city.shippingCost,
                    city.freeShippingFrom,
                    product.currency,
                  )}
                </span>
                <span className="text-2xs text-fg-tertiary">
                  Se cobra una sola vez por pedido.
                </span>
              </span>
            </li>

            <li className="sf-panel flex items-start gap-2 p-3">
              <span aria-hidden="true" className="text-fg-accent">
                <ShieldIcon />
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold text-fg">Garantia</span>
                <span className="text-2xs text-fg-secondary">
                  {product.warrantyMonths !== null
                    ? formatMonths(product.warrantyMonths)
                    : "La publica el ERP por articulo."}
                </span>
                <span className="text-2xs text-fg-tertiary">
                  <Link
                    href="/paginas/envios-y-devoluciones"
                    className="sf-link"
                  >
                    Envios y devoluciones
                  </Link>
                </span>
              </span>
            </li>

            <li className="sf-panel flex items-start gap-2 p-3">
              <span aria-hidden="true" className="text-fg-accent">
                <CardIcon />
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold text-fg">Pago</span>
                <span className="text-2xs text-fg-secondary">
                  Transferencia, QR o pago contra entrega.
                </span>
                <span className="text-2xs text-fg-tertiary">
                  {hasInstallments
                    ? "Este articulo admite cuotas: se eligen y confirman en el checkout."
                    : "El pedido queda con el pago pendiente hasta que la tienda lo concilie."}
                </span>
              </span>
            </li>
          </ul>

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
            available={product.availability.available}
            cityCode={city.code}
            cityName={city.name}
          />

          {/* F6: comparar desde la ficha. La lista vive en el navegador y guarda solo la
              identidad del producto; los datos se piden vigentes al abrir /comparar. */}
          <CompareToggle
            item={{
              itemId: product.itemId,
              slug: product.slug,
              name: product.name,
              image: product.image,
            }}
            size="md"
            className="w-fit"
          />

          {product.shortDescription !== null ? (
            <p className="text-sm leading-relaxed text-fg-secondary">
              {product.shortDescription}
            </p>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="ficha-titulo" className="sf-section">
        <SectionHeader
          id="ficha-titulo"
          eyebrow="Detalle"
          title="Ficha tecnica"
        />
        {specGroups.length === 0 ? (
          <p className="sf-panel text-sm text-fg-secondary">
            El ERP no publico caracteristicas para este articulo.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {specGroups.map((group) => (
              <details
                key={group.group}
                className="sf-card overflow-hidden"
                open
              >
                <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-sm font-semibold text-fg">
                  {group.group}
                  <span className="text-2xs font-normal text-fg-tertiary">
                    {group.rows.length}{" "}
                    {group.rows.length === 1
                      ? "caracteristica"
                      : "caracteristicas"}
                  </span>
                </summary>
                <table
                  className="w-full border-collapse text-sm"
                  data-testid="specs-table"
                >
                  <caption className="sr-only">{`Caracteristicas de ${product.name} (${group.group})`}</caption>
                  <tbody>
                    {group.rows.map((spec) => (
                      <tr
                        key={`${group.group}-${spec.name}`}
                        className="border-t border-line-subtle"
                      >
                        <th
                          scope="row"
                          className="w-1/2 px-4 py-2 text-left font-medium text-fg-secondary"
                        >
                          {spec.name}
                        </th>
                        <td className="px-4 py-2 text-fg">
                          {spec.value}
                          {spec.unit !== null && spec.unit !== ""
                            ? ` ${spec.unit}`
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="relacionados-titulo" className="sf-section">
        <SectionHeader
          id="relacionados-titulo"
          eyebrow="Tambien te puede interesar"
          title="Productos relacionados"
        />
        {related.length === 0 ? (
          <p className="sf-panel text-sm text-fg-secondary">
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

      <JsonLd data={productJsonLd(product, city.name)} id="jsonld-producto" />
      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-migas-producto" />
    </div>
  );
}

function TruckIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

function BoxIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z" />
      <path d="m4 7.2 8 4.3 8-4.3M12 21v-9.5" />
    </svg>
  );
}

function ShieldIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 5 6v5.5c0 4 3 7.4 7 9 4-1.6 7-5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CardIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6 14.5h4" />
    </svg>
  );
}
