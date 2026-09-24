import Link from "next/link";

import type { Product } from "@/lib/erp";
import { formatDiscount } from "@/lib/format";

import { ProductImage } from "./product-image";
import { QuickAdd } from "./quick-add";
import { CompareToggle } from "./compare-toggle";
import { WishlistButton } from "./wishlist-button";
import { Badge } from "./ui/badge";
import { Price } from "./ui/price";

interface ProductCardProps {
  product: Product;
  cityName: string;
  /** Codigo de la ciudad elegida: lo necesita el quick-add para el snapshot del carrito. */
  cityCode: string;
  priority?: boolean;
}

const MAX_VISIBLE_BADGES = 3;

/** Insignias del ERP → variante visual (lo que no este aqui se pinta neutro). */
const BADGE_VARIANTS: Record<string, "ok" | "promo" | "soft" | "brand"> = {
  "ENVIO GRATIS": "ok",
  OFERTA: "promo",
  CUOTAS: "soft",
  NUEVO: "brand",
};

/**
 * Tarjeta de producto de la tienda (F9.1/F9.3).
 *
 * Es la pieza que mas se repite, asi que concentra la jerarquia: **imagen** (o el
 * placeholder propio, D24) con **acciones rapidas** (F9.3), **descuento** como
 * etiqueta, **marca** como antetitulo, **nombre** a dos lineas, **insignias del
 * ERP** con su variante y **precio protagonista** con el «antes» y el ahorro. Se
 * eleva al pasar el puntero (`sf-card-hover`) y la imagen hace un zoom sutil.
 *
 * Los `data-testid` son contrato con el E2E de la tienda (`product-card`,
 * `product-price`, `product-list-price`, `discount-badge`, `product-availability`);
 * el quick-add usa `quick-add` **a proposito** para no volver ambiguo el
 * `add-to-cart` de la ficha.
 */
export function ProductCard({
  product,
  cityName,
  cityCode,
  priority = false,
}: ProductCardProps): JSX.Element {
  const href = `/productos/${product.slug}`;
  const discount = formatDiscount(product.discountPct);
  const hasOffer = product.salePrice !== null;
  const badges = product.badges.slice(0, MAX_VISIBLE_BADGES);

  return (
    <article
      className="sf-card sf-card-hover group flex w-full flex-col overflow-hidden"
      data-testid="product-card"
      data-slug={product.slug}
    >
      <div className="relative">
        <Link href={href} className="block" aria-hidden="true" tabIndex={-1}>
          <ProductImage
            src={product.image}
            alt={product.name}
            name={product.name}
            brand={product.brand}
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="aspect-square w-full"
          />
        </Link>

        <span className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <span className="flex flex-col items-start gap-1">
            {discount !== null ? (
              <Badge
                variant="deal"
                testId="discount-badge"
                srLabel={`Descuento de ${discount}`}
              >
                {discount}
              </Badge>
            ) : null}
            {/*
              Promo **del canal** (D21): un descuento que solo cobra la tienda online. Se
              rotula aparte de la oferta del ERP porque son dos capas distintas y el
              comprador tiene derecho a saber de donde sale el precio. La comprobacion es
              por **numero** y no `!== null`: un fixture grabado con el contrato anterior no
              trae el campo y `undefined` no puede pintar un badge.
            */}
            {typeof product.channelDiscountPct === "number" &&
            product.channelDiscountPct > 0 ? (
              <Badge
                variant="promo"
                testId="channel-promo-badge"
                srLabel={`Promo online de ${product.channelDiscountPct}%`}
              >
                Promo online −{product.channelDiscountPct}%
              </Badge>
            ) : null}
          </span>
          {!product.availability.inStock ? (
            <Badge variant="outline">Agotado</Badge>
          ) : null}
        </span>

        {/* Acciones rapidas: fuera del enlace de la imagen para que no naveguen. */}
        <span className="absolute bottom-2 right-2 flex translate-y-1 gap-2 opacity-100 transition-all duration-base group-hover:translate-y-0">
          <QuickAdd
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
            cityCode={cityCode}
            cityName={cityName}
          />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.brand !== null ? (
          <p className="sf-eyebrow">{product.brand}</p>
        ) : null}

        {/* F6: quien vende el articulo. La tarjeta lo dice sin abrir la ficha. La
            comprobacion es `typeof` para que una respuesta cacheada sin la clave (canal
            anterior) no rompa la grilla. */}
        {typeof product.seller === "string" && product.seller.length > 0 ? (
          <p className="text-xs text-fg-tertiary" data-testid="seller-line">
            Vendido por {product.seller}
          </p>
        ) : null}

        <h3 className="text-sm font-semibold leading-snug text-fg">
          <Link
            href={href}
            className="rounded line-clamp-2 hover:text-fg-accent"
          >
            {product.name}
          </Link>
        </h3>

        {badges.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {badges.map((badge) => (
              <li key={badge}>
                <Badge
                  variant={
                    BADGE_VARIANTS[badge.trim().toUpperCase()] ?? "outline"
                  }
                  className="px-2 py-0.5"
                >
                  {badge}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <Price
            price={product.price}
            currency={product.currency}
            listPrice={product.listPrice}
            caption={hasOffer ? "Oferta vigente" : null}
          />

          <p
            className={`flex items-center gap-1.5 text-xs font-medium ${
              product.availability.inStock ? "text-price-free" : "text-fg-error"
            }`}
            data-testid="product-availability"
          >
            <span
              aria-hidden="true"
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                product.availability.inStock ? "bg-price-free" : "bg-fg-error"
              }`}
            />
            {product.availability.inStock
              ? `Disponible: ${product.availability.available}`
              : `Sin existencia en ${cityName}`}
          </p>

          {/* F6: agregar/quitar del comparador sin salir del listado. Se guarda solo la
              identidad del producto: el comparador pide los datos vigentes al abrir /comparar. */}
          <CompareToggle
            item={{
              itemId: product.itemId,
              slug: product.slug,
              name: product.name,
              image: product.image,
            }}
            className="mt-0.5 w-fit"
          />

          {/* F6: favoritos (lista del dispositivo, igual que el carrito). */}
          <WishlistButton
            item={{
              itemId: product.itemId,
              slug: product.slug,
              name: product.name,
              image: product.image,
            }}
            className="mt-0.5 w-fit"
          />
        </div>
      </div>
    </article>
  );
}
