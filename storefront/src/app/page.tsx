import type { Metadata } from 'next';

import { CategoryCards } from '@/components/category-cards';
import { HomeBanners } from '@/components/home-banners';
import { JsonLd } from '@/components/json-ld';
import { ProductGrid } from '@/components/product-grid';
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
        <HomeBanners banners={heroBanners} variant="hero" />
      </section>

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
            label="Ofertas vigentes"
            priorityCount={2}
          />
        )}
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
        <ProductGrid products={featured.data} cityName={city.name} label="Productos destacados" />
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
