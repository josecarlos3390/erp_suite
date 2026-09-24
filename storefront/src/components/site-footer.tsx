import Link from 'next/link';

import { getPageLinks } from '@/lib/erp';
import { SITE_NAME } from '@/lib/site';

import { BrandMark } from './brand-mark';

/**
 * Pie de pagina (F9.1).
 *
 * Los enlaces a las paginas de servicio salen del **indice del canal**
 * (`GET /storefront/pages`), asi que una pagina nueva publicada en el ERP aparece sin
 * desplegar codigo y una que vuelve a borrador desaparece sola.
 *
 * Nada de lo que dice el pie es una promesa inventada: la entrega, el envio y los
 * medios de pago los publica el ERP por ciudad (y se ven en la ficha y en el
 * checkout), y aqui solo se repite que el ERP es la fuente de verdad.
 */
export async function SiteFooter(): Promise<JSX.Element> {
  const pages = await getPageLinks();

  return (
    <footer className="mt-12 border-t border-line bg-elevated">
      <div className="sf-container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <section className="flex flex-col gap-3">
          <BrandMark plain />
          <p className="text-xs leading-relaxed text-fg-secondary">
            Catalogo publicado desde el ERP. Los precios y la existencia los calcula el ERP por
            ciudad; la tienda solo los muestra.
          </p>
        </section>

        <section>
          <h2 className="sf-eyebrow">Comprar</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
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
          <h2 className="sf-eyebrow">Servicios</h2>
          {pages.length === 0 ? (
            <p className="mt-3 text-xs text-fg-tertiary">
              El ERP no tiene paginas de servicio publicadas.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
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
          <h2 className="sf-eyebrow">Entrega y pago</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link href="/sucursales" className="sf-link">
                Ciudades y sucursales
              </Link>
            </li>
            <li>
              <Link href="/seguimiento" className="sf-link">
                Seguir mi pedido
              </Link>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-fg-tertiary">
            El envio depende de la ciudad elegida y el pago se coordina al confirmar el pedido: el
            importe final lo calcula el ERP, no la tienda.
          </p>
        </section>
      </div>

      <div className="border-t border-line-subtle">
        <div className="sf-container flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-2xs text-fg-tertiary">
            {SITE_NAME} · precios, existencia y pedidos provistos por el ERP.
          </p>
          <p className="text-2xs text-fg-tertiary">
            Los precios pueden cambiar sin aviso; el importe final se confirma en el checkout.
          </p>
        </div>
      </div>
    </footer>
  );
}
