import Link from 'next/link';

import { getCityContext } from '@/lib/city';
import { getCategories } from '@/lib/erp';
import { SITE_NAME } from '@/lib/site';

import { CartLink } from './cart-link';
import { CategoryNav } from './category-nav';
import { CitySelector } from './city-selector';
import { SearchBox } from './search-box';

/**
 * Encabezado de la tienda, renderizado en el servidor.
 *
 * La ciudad y las categorias se piden al canal en el servidor (D10); el
 * navegador solo recibe el HTML. El contador del carrito y el selector de ciudad
 * son los dos unicos islotes cliente.
 */
export async function SiteHeader(): Promise<JSX.Element> {
  const [categories, cityContext] = await Promise.all([getCategories(), getCityContext()]);

  return (
    <header className="sticky top-0 z-panel border-b border-line bg-base">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 rounded">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-fg"
            >
              TE
            </span>
            <span className="text-md font-bold text-fg">{SITE_NAME}</span>
          </Link>

          <div className="flex items-center gap-3">
            <CitySelector cities={cityContext.cities} selectedCode={cityContext.selectedCode} />
            <CartLink />
          </div>
        </div>

        <SearchBox />
      </div>

      <CategoryNav categories={categories} />
    </header>
  );
}
