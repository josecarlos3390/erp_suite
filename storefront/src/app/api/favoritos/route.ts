import { NextResponse } from 'next/server';

import {
  loadProductsBySlugs,
  lookupErrorStatus,
  parseSlugs,
} from '@/lib/product-lookup';
import { MAX_WISHLIST_SLUGS } from '@/lib/wishlist';

export const dynamic = 'force-dynamic';

/**
 * Datos **vigentes** de la lista de favoritos del comprador (F6).
 *
 * Los favoritos viven en el navegador (`localStorage`) y guardan **solo la identidad** de cada
 * producto, asi que el precio, la existencia y la oferta se piden aqui al abrir `/favoritos`:
 * una lista de deseos con precios viejos no sirve para decidir. Es el mismo puente que el
 * comparador y el checkout (D10): el navegador nunca ve la clave del canal y los slugs se
 * sanean antes de consultar.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const slugs = parseSlugs(url.searchParams.get('slugs'), MAX_WISHLIST_SLUGS);
  if (slugs.length === 0) {
    return NextResponse.json(
      { error: 'Indica al menos un producto valido.' },
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
