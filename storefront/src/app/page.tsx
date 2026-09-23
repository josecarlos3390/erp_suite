import type { Metadata } from 'next';

import { CategoryCards } from '@/components/category-cards';
import { HomeBanners } from '@/components/home-banners';
import { JsonLd } from '@/components/json-ld';
import { ProductGrid } from '@/components/product-grid';
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
    <div className="flex flex-col gap-10">
      <section aria-labelledby="hero-titulo">
        <h1 id="hero-titulo" className="sr-only">
          {`Tienda en linea · ${city.name}`}
        </h1>
        <HomeBanners banners={heroBanners} variant="hero" />
      </section>

      <section aria-labelledby="ofertas-titulo" data-testid="home-offers">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ofertas-titulo" className="text-xl font-bold text-fg">
            Ofertas vigentes
          </h2>
          <p className="text-xs text-fg-secondary">
            Precio de oferta publicado por el ERP · existencia en {city.name}
          </p>
        </div>
        {offers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-elevated p-4 text-sm text-fg-secondary">
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

      <section aria-labelledby="destacados-titulo" data-testid="home-featured">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="destacados-titulo" className="text-xl font-bold text-fg">
            Productos destacados
          </h2>
          <p className="text-xs text-fg-secondary">{featured.total} publicados en total</p>
        </div>
        <ProductGrid
          products={featured.data}
          cityName={city.name}
          label="Productos destacados"
        />
      </section>

      <section aria-labelledby="categorias-titulo">
        <h2 id="categorias-titulo" className="mb-3 text-xl font-bold text-fg">
          Categorias
        </h2>
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
