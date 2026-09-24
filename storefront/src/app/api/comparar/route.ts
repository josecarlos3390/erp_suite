import { NextResponse } from 'next/server';

import { MAX_COMPARE_SLUGS } from '@/lib/compare';
import {
  loadProductsBySlugs,
  lookupErrorStatus,
  parseSlugs,
} from '@/lib/product-lookup';

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
  const slugs = parseSlugs(url.searchParams.get('slugs'), MAX_COMPARE_SLUGS);
  if (slugs.length === 0) {
    return NextResponse.json(
      { error: 'Indica al menos un producto valido para comparar.' },
      { status: 400 },
    );
  }
  const city = (url.searchParams.get('city') ?? '').trim().slice(0, 20);

  const { products, missing, firstError } = await loadProductsBySlugs(slugs, city);
  if (products.length === 0) {
    return NextResponse.json(
      {
        error:
          firstError instanceof Error
            ? firstError.message
            : 'No se pudo leer el catalogo del ERP.',
        missing,
      },
      { status: lookupErrorStatus(firstError) },
    );
  }

  return NextResponse.json({ products, missing });
}
