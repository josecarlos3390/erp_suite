import { getCityContext } from '@/lib/city';
import { getCategories } from '@/lib/erp';

import { BrandMark } from './brand-mark';
import { CartLink } from './cart-link';
import { CategoryNav } from './category-nav';
import { CitySelector } from './city-selector';
import { SearchBox } from './search-box';
import { ThemeToggle } from './theme-toggle';

/**
 * Encabezado de la tienda (F9.1), renderizado en el servidor.
 *
 * La ciudad y las categorias se piden al canal en el servidor (D10); el navegador
 * solo recibe el HTML. Los islotes cliente son el buscador, el selector de ciudad,
 * el contador del carrito y el conmutador de tema (ninguno conoce la clave ni la
 * URL del ERP).
 *
 * Estructura: barra superior translucida con `backdrop-blur` (marca · buscador ·
 * acciones) y, debajo, la navegacion de categorias. En movil el buscador baja a
 * una segunda linea y ocupa todo el ancho.
 */
export async function SiteHeader(): Promise<JSX.Element> {
  const [categories, cityContext] = await Promise.all([getCategories(), getCityContext()]);

  return (
    <header
      className="sticky top-0 z-panel border-b bg-[var(--sf-header-bg)] backdrop-blur"
      style={{ borderColor: 'var(--sf-header-border)', boxShadow: 'var(--sf-shadow-header)' }}
    >
      <div className="sf-container">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
          <BrandMark />

          <div className="order-3 w-full md:order-none md:w-auto md:flex-1">
            <SearchBox />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <CitySelector cities={cityContext.cities} selectedCode={cityContext.selectedCode} />
            <ThemeToggle />
            <CartLink />
          </div>
        </div>
      </div>

      <CategoryNav categories={categories} />
    </header>
  );
}
