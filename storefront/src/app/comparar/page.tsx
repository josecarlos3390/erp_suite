import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { CompareView } from '@/components/compare-view';
import { JsonLd } from '@/components/json-ld';
import { getCityContext } from '@/lib/city';
import { MAX_COMPARE_SLUGS } from '@/lib/compare';
import { breadcrumbJsonLd } from '@/lib/jsonld';

/**
 * **Comparador** (F6).
 *
 * La lista de productos comparados vive en el navegador (`localStorage`), asi que la pagina es
 * un cascaron de servidor (migas, titulo y JSON-LD) mas el islote que pide los datos vigentes al
 * canal. Sin cuenta de cliente (F4 espera al proveedor de correo, D16) no hay una comparacion
 * "de la cuenta": es de **este dispositivo**.
 *
 * `noindex`: la pagina no tiene contenido propio que indexar —cada visitante ve su lista—, asi
 * que no se anuncia a los buscadores y no compite con las fichas de producto.
 */
export const metadata: Metadata = {
  title: 'Comparar productos',
  description: `Compara hasta ${MAX_COMPARE_SLUGS} productos de la tienda lado a lado: precio, existencia, garantia y las caracteristicas que comparten, con los datos vigentes del ERP.`,
  robots: { index: false, follow: true },
};

const crumbs = [{ label: 'Inicio', href: '/' }, { label: 'Comparar' }];

export default async function ComparePage(): Promise<JSX.Element> {
  const { city } = await getCityContext();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-col gap-2">
        <p className="sf-eyebrow">Comparador</p>
        <h1 className="sf-h1 text-fg">Comparar productos</h1>
        <p className="text-sm text-fg-secondary">
          Hasta {MAX_COMPARE_SLUGS} productos, lado a lado, con los datos{' '}
          <strong>vigentes</strong> del ERP (precio, existencia en {city.name},
          garantia y ficha tecnica). La lista es de este dispositivo: no se
          envia a ninguna cuenta.
        </p>
      </header>

      <CompareView cityCode={city.code} cityName={city.name} />

      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-comparar" />
    </div>
  );
}
