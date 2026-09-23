import Link from 'next/link';

import type { Banner } from '@/lib/erp';

import { ProductImage } from './product-image';

interface HomeBannersProps {
  banners: readonly Banner[];
  variant: 'hero' | 'strip';
}

/** Banners del CMS del ERP (`home-hero` y `home-strip`). */
export function HomeBanners({ banners, variant }: HomeBannersProps): JSX.Element {
  if (banners.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-elevated p-4 text-sm text-fg-secondary">
        El ERP no tiene banners vigentes para el slot <code>{variant === 'hero' ? 'home-hero' : 'home-strip'}</code>.
      </p>
    );
  }

  if (variant === 'strip') {
    return (
      <ul className="flex flex-col gap-3 sm:flex-row">
        {banners.map((banner) => (
          <li key={`${banner.slot}-${banner.sortOrder}`} className="flex-1">
            <BannerCard banner={banner} compact />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="home-hero">
      {banners.map((banner, index) => (
        <li key={`${banner.slot}-${banner.sortOrder}`}>
          <BannerCard banner={banner} priority={index === 0} />
        </li>
      ))}
    </ul>
  );
}

interface BannerCardProps {
  banner: Banner;
  compact?: boolean;
  priority?: boolean;
}

function BannerCard({ banner, compact = false, priority = false }: BannerCardProps): JSX.Element {
  const body = (
    <>
      <ProductImage
        src={banner.imageUrl}
        alt={banner.title}
        priority={priority}
        sizes={compact ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 50vw, 100vw'}
        className={compact ? 'aspect-[4/1] w-full bg-elevated' : 'aspect-[16/6] w-full bg-elevated'}
        imageClassName="object-cover"
      />
      <div className="flex flex-col gap-1 p-4">
        <h2 className="text-lg font-bold text-fg">{banner.title}</h2>
        {banner.subtitle !== null ? (
          <p className="text-sm text-fg-secondary">{banner.subtitle}</p>
        ) : null}
      </div>
    </>
  );

  const shell =
    'sf-card flex h-full flex-col overflow-hidden focus-within:shadow-layered';

  if (banner.href === null || banner.href.trim() === '') {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link href={banner.href} className={shell} data-testid="banner-link">
      {body}
    </Link>
  );
}
