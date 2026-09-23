import Link from 'next/link';

import { getPageLinks } from '@/lib/erp';
import { SITE_NAME } from '@/lib/site';

/**
 * Pie de pagina.
 *
 * Los enlaces a las paginas de servicio salen del **indice del canal**
 * (`GET /storefront/pages`), asi que una pagina nueva publicada en el ERP aparece sin
 * desplegar codigo y una que vuelve a borrador desaparece sola.
 */
export async function SiteFooter(): Promise<JSX.Element> {
  const pages = await getPageLinks();

  return (
    <footer className="mt-12 border-t border-line bg-elevated">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <section>
          <h2 className="text-sm font-semibold text-fg">{SITE_NAME}</h2>
          <p className="mt-2 text-xs text-fg-secondary">
            Catalogo publicado desde el ERP. Los precios y la existencia los calcula el ERP por
            ciudad; la tienda solo los muestra.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-fg">Comprar</h2>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            <li>
              <Link href="/categorias" className="sf-link">
                Todas las categorias
              </Link>
            </li>
            <li>
              <Link href="/buscar" className="sf-link">
                Buscar productos
              </Link>
            </li>
            <li>
              <Link href="/carrito" className="sf-link">
                Mi carrito
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-fg">Servicios</h2>
          {pages.length === 0 ? (
            <p className="mt-2 text-xs text-fg-tertiary">
              El ERP no tiene paginas de servicio publicadas.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/paginas/${page.slug}`}
                    className="sf-link"
                    data-testid="footer-page"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-fg">Entrega</h2>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            <li>
              <Link href="/sucursales" className="sf-link">
                Ciudades y sucursales
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="border-t border-line-subtle px-4 py-4">
        <p className="mx-auto max-w-7xl text-2xs text-fg-tertiary">
          Precios y existencia provistos por el ERP. El pedido se confirma en el checkout (fase F3):
          el importe final lo calcula el ERP, no la tienda.
        </p>
      </div>
    </footer>
  );
}
