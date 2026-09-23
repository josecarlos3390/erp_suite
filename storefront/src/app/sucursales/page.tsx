import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { getCities } from '@/lib/erp';
import { describeShipping } from '@/lib/format';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Ciudades y sucursales',
  description:
    'Ciudades habilitadas por el canal, con su sucursal de despacho, almacen, plazo y costo de envio.',
  alternates: { canonical: '/sucursales' },
};

/** Ciudades y sucursales publicadas por el canal (`GET /storefront/cities`). */
export default async function BranchesPage(): Promise<JSX.Element> {
  const cities = await getCities();
  const crumbs = [{ label: 'Inicio', href: '/' }, { label: 'Ciudades y sucursales' }];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">Ciudades y sucursales</h1>
        <p className="text-sm text-fg-secondary">
          La ciudad elegida define el almacen del que sale la existencia que ves en el catalogo.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {cities.map((city) => (
          <li key={city.code} className="sf-card flex flex-col gap-2 p-4" data-testid="city-card">
            <h2 className="text-lg font-semibold text-fg">
              {city.name} <span className="text-xs font-normal text-fg-tertiary">({city.code})</span>
            </h2>
            <dl className="flex flex-col gap-1 text-xs text-fg-secondary">
              <div className="flex justify-between gap-3">
                <dt>Sucursal de despacho</dt>
                <dd className="text-right text-fg">
                  {city.branch !== null ? `${city.branch.name} (${city.branch.code})` : 'Sin sucursal asignada'}
                </dd>
              </div>
              {city.branch !== null && city.branch.address !== null && city.branch.address !== '' ? (
                <div className="flex justify-between gap-3">
                  <dt>Direccion</dt>
                  <dd className="text-right text-fg">{city.branch.address}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt>Almacen de existencia</dt>
                <dd className="text-right text-fg">
                  {city.warehouse !== null ? `${city.warehouse.name} (${city.warehouse.code})` : 'Sin almacen asignado'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Plazo de entrega</dt>
                <dd className="text-right text-fg">
                  {city.deliveryDays} {city.deliveryDays === 1 ? 'dia habil' : 'dias habiles'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Envio</dt>
                <dd className="text-right text-fg">
                  {describeShipping(city.shippingCost, city.freeShippingFrom)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-sucursales" />
    </div>
  );
}
