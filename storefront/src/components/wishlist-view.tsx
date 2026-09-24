'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/lib/erp';
import { MAX_WISHLIST_SLUGS, wishlistApiHref } from '@/lib/wishlist';
import { useWishlistEntries, useWishlistStore, wishlistSlugs } from '@/store/wishlist';

import { ProductCard } from './product-card';

interface WishlistViewProps {
  /** Ciudad elegida: la existencia que se publica es la de esa ciudad. */
  cityCode: string;
  cityName: string;
}

type WishlistPayload = { products: Product[]; missing?: string[] };

type State =
  | { status: 'loading' }
  | { status: 'ready'; products: Product[]; missing: string[] }
  | { status: 'error'; message: string };

/** Lista vacia **estable**: la usa el `useMemo` cuando aun no hay respuesta. */
const EMPTY_PRODUCTS: Product[] = [];

/**
 * Lista de **favoritos** (F6).
 *
 * Los datos se piden **al abrir la pagina** (`/api/favoritos`): la lista del navegador solo
 * guarda la identidad de cada producto, asi que el precio, la oferta y la existencia que se
 * muestran son los vigentes del ERP. La grilla reutiliza la **misma tarjeta** del catalogo, con
 * su compra rapida y su control de comparar: los favoritos son una vista del catalogo, no una
 * pantalla aparte con reglas propias.
 */
export function WishlistView({ cityCode, cityName }: WishlistViewProps): JSX.Element {
  const { entries, hydrated } = useWishlistEntries();
  const remove = useWishlistStore((state) => state.remove);
  const clear = useWishlistStore((state) => state.clear);
  const slugs = wishlistSlugs(entries);
  const key = slugs.join(',');

  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!hydrated) return;
    if (slugs.length === 0) {
      setState({ status: 'ready', products: [], missing: [] });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    const query = wishlistApiHref(slugs, cityCode);
    fetch(query, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as Partial<WishlistPayload> & {
          error?: string;
        };
        if (!response.ok) {
          setState({
            status: 'error',
            message: body.error ?? 'No se pudieron leer los productos guardados.',
          });
          return;
        }
        setState({
          status: 'ready',
          products: body.products ?? [],
          missing: body.missing ?? [],
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setState({
          status: 'error',
          message: 'No se pudo conectar con el catalogo del ERP.',
        });
      });
    return () => controller.abort();
    // `key` es la lista de slugs: comparar por valor evita repetir la peticion en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key, cityCode]);

  const products = useMemo(
    () => (state.status === 'ready' ? state.products : EMPTY_PRODUCTS),
    [state],
  );

  if (!hydrated) {
    return (
      <div data-testid="wishlist-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando tus favoritos</span>
        <Skeleton shape="block" className="h-64 w-full" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        testId="wishlist-empty"
        title="Todavia no guardaste nada"
        description="Con el boton «Guardar» de las tarjetas o de la ficha dejas un producto en esta lista para volver a el cuando quieras. La lista es de este dispositivo (todavia no hay cuenta de cliente)."
        actions={[
          { href: '/categorias', label: 'Ver categorias', primary: true },
          { href: '/buscar', label: 'Buscar productos' },
        ]}
      />
    );
  }

  if (state.status === 'loading') {
    return (
      <div data-testid="wishlist-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando tus favoritos</span>
        <Skeleton shape="block" className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p
        role="alert"
        className="rounded-md border border-line-error bg-danger-soft p-3 text-sm text-fg"
        data-testid="wishlist-error"
      >
        {state.message}
      </p>
    );
  }

  const missing = state.missing;
  const truncated = entries.length > MAX_WISHLIST_SLUGS;

  return (
    <div className="flex flex-col gap-4">
      {missing.length > 0 ? (
        <p className="text-sm text-fg-secondary" data-testid="wishlist-missing">
          Ya no se pueden mostrar {missing.length} de los productos guardados (
          {missing.join(', ')}): pueden haberse despublicado. Quitalos para dejar la lista al
          dia.
        </p>
      ) : null}

      {truncated ? (
        <p className="text-sm text-fg-secondary" data-testid="wishlist-truncated">
          Estas guardando mas de {MAX_WISHLIST_SLUGS} productos: aqui se muestran los{' '}
          {MAX_WISHLIST_SLUGS} primeros.
        </p>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          testId="wishlist-empty"
          title="No hay productos que mostrar"
          description="Los productos guardados ya no estan publicados en la tienda."
          actions={[{ href: '/categorias', label: 'Ver categorias', primary: true }]}
        />
      ) : (
        <>
          <ul
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            data-testid="wishlist-grid"
          >
            {products.map((product) => (
              <li key={product.slug} className="flex flex-col gap-1" data-testid="wishlist-item" data-slug={product.slug}>
                <ProductCard
                  product={product}
                  cityName={cityName}
                  cityCode={cityCode}
                />
                <button
                  type="button"
                  onClick={() => remove(product.itemId)}
                  className="sf-link w-fit text-xs font-medium"
                  data-testid="wishlist-remove"
                  data-slug={product.slug}
                >
                  Quitar de favoritos
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={clear}
              className="sf-btn sf-btn-secondary"
              data-testid="wishlist-clear"
            >
              Vaciar favoritos
            </button>
            {products.length >= 2 ? (
              <Link href="/comparar" className="sf-link text-sm font-medium" data-testid="wishlist-to-compare">
                Comparar los guardados
              </Link>
            ) : null}
            <Link href="/categorias" className="sf-link text-sm font-medium">
              Seguir mirando el catalogo
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
