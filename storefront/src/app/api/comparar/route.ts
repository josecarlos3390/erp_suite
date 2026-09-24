import { NextResponse } from 'next/server';

import { parseCompareSlugs } from '@/lib/compare';
import { ErpError, getProduct } from '@/lib/erp';

export const dynamic = 'force-dynamic';

/**
 * Datos **vigentes** de los productos que el comprador esta comparando (F6).
 *
 * El comparador vive en el navegador (`localStorage`) y solo guarda la **identidad** de cada
 * producto, asi que el detalle (precio, existencia, garantia, ficha tecnica) se pide aqui al
 * abrir `/comparar`: comparar precios de una copia vieja no sirve de nada. Es el mismo puente
 * que el checkout (decision D10): el navegador **nunca** ve `STOREFRONT_API_KEY`, y los slugs
 * se **sanean** antes de consultar el canal —lo que no tiene forma de slug publicado no viaja—.
 *
 * Un producto que ya no se puede leer (despublicado, borrado) se devuelve en `missing` en vez
 * de tumbar la comparacion: las otras columnas siguen siendo utiles.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const slugs = parseCompareSlugs(url.searchParams.get('slugs'));
  if (slugs.length === 0) {
    return NextResponse.json(
      { error: 'Indica al menos un producto valido para comparar.' },
      { status: 400 },
    );
  }
  const city = (url.searchParams.get('city') ?? '').trim().slice(0, 20);

  const settled = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return { slug, product: await getProduct(slug, city) };
      } catch (error) {
        return { slug, error };
      }
    }),
  );

  const products = settled.flatMap((row) =>
    'product' in row ? [row.product] : [],
  );
  const missing = settled.flatMap((row) =>
    'product' in row ? [] : [row.slug],
  );
  if (products.length === 0) {
    // Ninguno se pudo leer: se conserva el motivo del canal (404 accionable) si es un error
    // del ERP, y si no se responde 502 (fallo de red, no culpa de los datos).
    const firstError = settled.find((row) => 'error' in row)?.error;
    const status =
      firstError instanceof ErpError &&
      firstError.status >= 400 &&
      firstError.status <= 599
        ? firstError.status
        : 502;
    return NextResponse.json(
      {
        error:
          firstError instanceof Error
            ? firstError.message
            : 'No se pudo leer el catalogo del ERP.',
        missing,
      },
      { status },
    );
  }

  return NextResponse.json({ products, missing });
}
