import type { Metadata } from 'next';

import { BenefitStrip } from '@/components/benefit-strip';
import { CategoryCards } from '@/components/category-cards';
import { HomeBanners } from '@/components/home-banners';
import { HomeHero } from '@/components/home-hero';
import { JsonLd } from '@/components/json-ld';
import { ProductGrid } from '@/components/product-grid';
import { PromoBand } from '@/components/promo-band';
import { SectionHeader } from '@/components/ui/section-header';
import { getCityContext } from '@/lib/city';
import { getBanners, getCatalog, getCategories, getOffers } from '@/lib/erp';
import { itemListJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Catalogo en linea',
  description:
    'Ofertas vigentes, productos destacados y todas las categorias publicadas desde el ERP, con la existencia de tu ciudad.',
  alternates: { canonical: '/' },
};

const OFFER_COUNT = 8;
const FEATURED_COUNT = 8;

/**
 * Home de campana (F9.2).
 *
 * Composicion: **hero de campana** (banners del CMS) → **barra de beneficios**
 * (envio, pago, garantia y existencia, todo dato real de la ciudad) → **ofertas**
 * en carril horizontal → **categorias visuales** → **destacados** en grilla →
 * **banda de envio** → franja de servicios. Nada de lo que se pinta aqui lo
 * inventa la tienda: banner, oferta, categoria, existencia y envio salen del ERP.
 */
export default async function HomePage(): Promise<JSX.Element> {
  const { city } = await getCityContext();

  const [heroBanners, stripBanners, offers, featured, categories] = await Promise.all([
    getBanners('home-hero'),
    getBanners('home-strip'),
    getOffers(OFFER_COUNT, city.code),
    getCatalog({ limit: FEATURED_COUNT, city: city.code }),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="hero-titulo">
        <h1 id="hero-titulo" className="sr-only">
          {`Tienda en linea · ${city.name}`}
        </h1>
        <HomeHero banners={heroBanners} cityName={city.name} />
      </section>

      <BenefitStrip city={city} />

      <section aria-labelledby="ofertas-titulo" data-testid="home-offers" className="sf-section">
        <SectionHeader
          id="ofertas-titulo"
          eyebrow="Ofertas"
          title="Ofertas vigentes"
          hint={`Precio de oferta publicado por el ERP · existencia en ${city.name}`}
        />
        {offers.length === 0 ? (
          <p className="sf-panel text-sm text-fg-secondary">
            Hoy no hay ofertas vigentes en el catalogo publicado (el canal no ofrece un filtro de
            ofertas: se derivan del precio de lista y la vigencia).
          </p>
        ) : (
          <ProductGrid
            products={offers}
            cityName={city.name}
            cityCode={city.code}
            label="Ofertas vigentes"
            priorityCount={2}
            variant="carousel"
          />
        )}
      </section>

      <section aria-labelledby="categorias-titulo" className="sf-section">
        <SectionHeader
          id="categorias-titulo"
          eyebrow="Explorar"
          title="Categorias"
          hint="Todas las categorias publicadas en el ERP, con su catalogo por ciudad."
          actionHref="/categorias"
        />
        <CategoryCards categories={categories} />
      </section>

      <section aria-labelledby="destacados-titulo" data-testid="home-featured" className="sf-section">
        <SectionHeader
          id="destacados-titulo"
          eyebrow="Catalogo"
          title="Productos destacados"
          hint={`${featured.total} publicados en total`}
          actionHref="/categorias"
          actionLabel="Ver catalogo"
        />
        <ProductGrid
          products={featured.data}
          cityName={city.name}
          cityCode={city.code}
          label="Productos destacados"
        />
      </section>

      <PromoBand city={city} />

      <section aria-labelledby="strip-titulo">
        <h2 id="strip-titulo" className="sr-only">
          Servicios de la tienda
        </h2>
        <HomeBanners banners={stripBanners} variant="strip" />
      </section>

      <JsonLd data={itemListJsonLd('Productos destacados', featured.data)} id="jsonld-home" />
    </div>
  );
}
