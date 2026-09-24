import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { WishlistView } from '@/components/wishlist-view';
import { getCityContext } from '@/lib/city';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { MAX_WISHLIST_SLUGS } from '@/lib/wishlist';

/**
 * **Favoritos** (F6).
 *
 * La lista vive en el navegador (`localStorage`), asi que la pagina es un cascaron de servidor
 * (migas, titulo y JSON-LD) mas el islote que pide los datos vigentes al canal. Sin cuenta de
 * cliente (F4 espera al proveedor de correo, D16) los favoritos son de **este dispositivo**;
 * migrarlos a la cuenta es trabajo de F4.
 *
 * `noindex`: cada visitante ve su lista, asi que la pagina no tiene contenido propio que
 * indexar y no compite con las fichas de producto.
 */
export const metadata: Metadata = {
  title: 'Favoritos',
  description: `Los productos que guardaste (hasta ${MAX_WISHLIST_SLUGS} a la vez), con el precio y la existencia vigentes del ERP. La lista es de este dispositivo.`,
  robots: { index: false, follow: true },
};

const crumbs = [
  { label: 'Inicio', href: '/' },
  { label: 'Favoritos' },
];

export default async function WishlistPage(): Promise<JSX.Element> {
  const { city } = await getCityContext();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-col gap-2">
        <p className="sf-eyebrow">Tu lista</p>
        <h1 className="sf-h1 text-fg">Favoritos</h1>
        <p className="text-sm text-fg-secondary">
          Lo que guardaste para volver a mirarlo, con el precio y la existencia{' '}
          <strong>vigentes</strong> del ERP en {city.name}. La lista es de este dispositivo: no
          se envia a ninguna cuenta.
        </p>
      </header>

      <WishlistView cityCode={city.code} cityName={city.name} />

      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-favoritos" />
    </div>
  );
}
