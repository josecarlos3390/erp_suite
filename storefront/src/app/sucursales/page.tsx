import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { getCities } from '@/lib/erp';
import { describeShipping } from '@/lib/format';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { buildMapLink, type MapPoint } from '@/lib/map-link';

export const metadata: Metadata = {
  title: 'Ciudades y sucursales',
  description:
    'Ciudades habilitadas por el canal, con su sucursal de despacho, almacen, plazo y costo de envio.',
  alternates: { canonical: '/sucursales' },
};

/**
 * Fila «Como llegar» de un punto de la empresa (sucursal de despacho o tienda).
 *
 * El enlace lo arma **`buildMapLink`** (la regla vive en un solo sitio, `@/lib/map-link`): usa el
 * `mapUrl` del maestro y, si no viene, las coordenadas. **Si la tienda no trae ni enlace ni
 * coordenadas, esta fila no se pinta**: un enlace a `#` o vacio anunciaria un mapa que no existe.
 */
function MapRow({ point, testId }: { point: MapPoint; testId: string }): JSX.Element | null {
  const href = buildMapLink(point);
  if (href === null) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt>Como llegar</dt>
      <dd className="text-right">
        <a
          className="sf-link"
          href={href}
          data-testid={testId}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver en el mapa
        </a>
      </dd>
    </div>
  );
}

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
          // `data-city` lleva el codigo de la ciudad del canal: los E2E localizan la tarjeta por
          // el mismo dato con el que la publica el ERP, no por su texto.
          <li
            key={city.code}
            className="sf-card flex flex-col gap-2 p-4"
            data-testid="city-card"
            data-city={city.code}
          >
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
              {city.branch?.openingHours ? (
                <div className="flex justify-between gap-3">
                  <dt>Horario de atencion</dt>
                  <dd className="text-right text-fg">{city.branch.openingHours}</dd>
                </div>
              ) : null}
              {city.branch?.phone ? (
                <div className="flex justify-between gap-3">
                  <dt>Telefono</dt>
                  <dd className="text-right text-fg">
                    <a className="sf-link" href={`tel:${city.branch.phone.replace(/\s+/g, '')}`}>
                      {city.branch.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {city.branch !== null ? <MapRow point={city.branch} testId="branch-map" /> : null}
              {city.branch?.pickupEnabled === true ? (
                <div className="flex justify-between gap-3" data-testid="branch-pickup">
                  <dt>Retiro en tienda</dt>
                  <dd className="text-right text-fg">Disponible en esta sucursal</dd>
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

            {/* T235 — las tiendas de la ciudad. La forma es la misma en las dos modalidades
                que configura el ERP (una sucursal por tienda, o almacenes que hacen de
                tienda): el comprador ve una lista, no dos. */}
            {city.stores && city.stores.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2" data-testid="city-stores">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                  Tiendas en {city.name}
                </h3>
                <ul className="flex flex-col gap-2">
                  {city.stores.map((store) => (
                    // `data-code` lleva el codigo de la tienda del canal: los E2E localizan la
                    // tarjeta por el mismo dato con el que la publica el ERP, no por su texto.
                    <li
                      key={store.code}
                      className="rounded-md border border-border-subtle bg-bg-subtle p-3 text-xs text-fg-secondary"
                      data-testid="city-store"
                      data-code={store.code}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-fg">{store.name}</span>
                        <span
                          className={
                            store.pickupEnabled
                              ? 'sf-badge sf-badge--success'
                              : 'sf-badge'
                          }
                          data-testid="store-pickup"
                        >
                          {store.pickupEnabled ? 'Retiro disponible' : 'Solo venta'}
                        </span>
                      </div>
                      <dl className="mt-1 flex flex-col gap-1">
                        {store.address ? (
                          <div className="flex justify-between gap-3">
                            <dt>Direccion</dt>
                            <dd className="text-right text-fg">{store.address}</dd>
                          </div>
                        ) : null}
                        {store.openingHours ? (
                          <div className="flex justify-between gap-3">
                            <dt>Horario</dt>
                            <dd className="text-right text-fg">{store.openingHours}</dd>
                          </div>
                        ) : null}
                        {store.phone ? (
                          <div className="flex justify-between gap-3">
                            <dt>Telefono</dt>
                            <dd className="text-right text-fg">
                              <a className="sf-link" href={`tel:${store.phone.replace(/\s+/g, '')}`}>
                                {store.phone}
                              </a>
                            </dd>
                          </div>
                        ) : null}
                        {/* T236-bis — el mapa de la tienda, con el `mapUrl` del maestro o con
                            sus coordenadas. Sin ninguno de los dos no se pinta (ver `MapRow`). */}
                        <MapRow point={store} testId="store-map" />
                      </dl>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-sucursales" />
    </div>
  );
}
