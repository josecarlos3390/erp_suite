import Link from 'next/link';

import type { Banner } from '@/lib/erp';

import { ProductImage } from './product-image';

interface HomeHeroProps {
  banners: readonly Banner[];
  cityName: string;
}

/**
 * Hero de campana de la home (F9.2).
 *
 * El primer banner del CMS ocupa el bloque principal a sangre (dentro del ancho
 * del contenedor) con la **imagen de fondo**, un degradado de contraste y la
 * tipografia display encima; los siguientes van como piezas secundarias. Si el
 * ERP no publica banners, el bloque lo dice en vez de dejar un hueco.
 *
 * Los datos (titulo, subtitulo y enlace) son del CMS del ERP: la tienda no
 * inventa campanas. El arte de campana se pinta tal cual aunque venga de un host
 * de marcador (`allowStockHost`), porque aqui una foto es intencional.
 */
export function HomeHero({ banners, cityName }: HomeHeroProps): JSX.Element {
  if (banners.length === 0) {
    return (
      <p className="sf-panel text-sm text-fg-secondary" data-testid="home-hero">
        El ERP no tiene banners vigentes para el slot <code>home-hero</code>.
      </p>
    );
  }

  const primary = banners[0];
  const secondary = banners.slice(1, 3);
  if (primary === undefined) {
    // `banners.length > 0` ya se comprobo arriba: esto solo satisface al tipo.
    return <div data-testid="home-hero" />;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]" data-testid="home-hero">
      <HeroCard banner={primary} cityName={cityName} featured priority />
      {secondary.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {secondary.map((banner, index) => (
            <HeroCard key={`${banner.slot}-${banner.sortOrder}-${index}`} banner={banner} cityName={cityName} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface HeroCardProps {
  banner: Banner;
  cityName: string;
  featured?: boolean;
  priority?: boolean;
}

function HeroCard({ banner, cityName, featured = false, priority = false }: HeroCardProps): JSX.Element {
  const body = (
    <>
      <ProductImage
        src={banner.imageUrl}
        alt={banner.title}
        name={banner.title}
        priority={priority}
        allowStockHost
        sizes={featured ? '(min-width: 1024px) 60vw, 100vw' : '(min-width: 1024px) 35vw, 50vw'}
        className={featured ? 'aspect-[16/10] w-full sm:aspect-[16/8]' : 'aspect-[16/9] w-full'}
        imageClassName="object-cover"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--sf-hero-overlay)' }}
      />

      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 sm:p-5">
        <span className="sf-eyebrow" style={{ color: 'var(--sf-on-media-soft)' }}>
          {cityName}
        </span>
        <span
          className={`${featured ? 'sf-display' : 'sf-h3'} block`}
          style={{ color: 'var(--sf-on-media)', textWrap: 'balance' }}
        >
          {banner.title}
        </span>
        {banner.subtitle !== null && banner.subtitle.trim() !== '' ? (
          <span className="max-w-prose text-xs sm:text-sm" style={{ color: 'var(--sf-on-media-soft)' }}>
            {banner.subtitle}
          </span>
        ) : null}
        {banner.href !== null && banner.href.trim() !== '' ? (
          <span className="mt-1 inline-flex">
            <span className="sf-btn sf-btn-primary min-h-[40px] px-4 text-xs">
              {featured ? 'Ver la campana' : 'Ver mas'}
            </span>
          </span>
        ) : null}
      </span>
    </>
  );

  const shell = `relative block overflow-hidden rounded-card bg-elevated ${
    featured ? 'shadow-card' : 'shadow-sm'
  } ${banner.href !== null && banner.href.trim() !== '' ? 'sf-card-hover' : ''}`;

  if (banner.href === null || banner.href.trim() === '') {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link href={banner.href} className={shell} data-testid="banner-link">
      {body}
    </Link>
  );
}
