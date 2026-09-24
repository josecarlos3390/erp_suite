'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { Price } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import {
  compareApiHref,
  ownSpecs,
  specMatrix,
  sharedSpecNames,
  type CompareProduct,
} from '@/lib/compare';
import type { Product } from '@/lib/erp';
import {
  compareSlugs,
  useCompareEntries,
  useCompareStore,
} from '@/store/compare';

interface CompareViewProps {
  /** Ciudad elegida: la comparacion publica la existencia **de esa** ciudad. */
  cityCode: string;
  cityName: string;
}

type ComparePayload = { products: Product[]; missing?: string[] };

/** Lista vacia **estable**: la usa el `useMemo` de productos cuando aun no hay respuesta. */
const EMPTY_PRODUCTS: Product[] = [];

type State =
  | { status: 'loading' }
  | { status: 'ready'; products: Product[]; missing: string[] }
  | { status: 'error'; message: string };

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <tr className="border-t border-line-subtle">
      <th
        scope="row"
        className="w-40 p-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-fg-tertiary"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children }: { children: ReactNode }): JSX.Element {
  return <td className="p-3 align-top text-sm text-fg">{children}</td>;
}

/**
 * Tabla del **comparador** (F6).
 *
 * Dos decisiones que se ven en el codigo:
 *
 * - los datos se piden **al abrir la pagina** (`/api/comparar`), no de una copia guardada: la
 *   lista del navegador solo tiene la identidad de cada producto, asi que el precio, la
 *   existencia y la garantia que se comparan son los **vigentes** del ERP;
 * - solo se comparan las caracteristicas que tienen **todos** los productos elegidos
 *   (`sharedSpecNames`): una fila con huecos no compara nada. Las que son propias de un
 *   producto se listan aparte, para no perder informacion.
 */
export function CompareView({
  cityCode,
  cityName,
}: CompareViewProps): JSX.Element {
  const { entries, hydrated } = useCompareEntries();
  const remove = useCompareStore((state) => state.remove);
  const clear = useCompareStore((state) => state.clear);
  const slugs = compareSlugs(entries);
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
    const query = `${compareApiHref(slugs)}${cityCode === '' ? '' : `&city=${encodeURIComponent(cityCode)}`}`;
    fetch(query, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as Partial<ComparePayload> & {
          error?: string;
        };
        if (!response.ok) {
          setState({
            status: 'error',
            message: body.error ?? 'No se pudieron leer los productos.',
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
  const specRows = useMemo(() => specMatrix(products), [products]);
  const shared = useMemo(() => sharedSpecNames(products), [products]);

  if (!hydrated) {
    return (
      <div data-testid="compare-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando la comparacion</span>
        <Skeleton shape="block" className="h-64 w-full" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        testId="compare-empty"
        title="Todavia no comparas nada"
        description="Agrega productos con el boton «Comparar» de las tarjetas o de la ficha (hasta 4) y aqui los veras lado a lado con su precio, su existencia, su garantia y las caracteristicas que comparten."
        actions={[
          { href: '/categorias', label: 'Ver categorias', primary: true },
          { href: '/buscar', label: 'Buscar productos' },
        ]}
      />
    );
  }

  if (state.status === 'loading') {
    return (
      <div data-testid="compare-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando la comparacion</span>
        <Skeleton shape="block" className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p
        role="alert"
        className="rounded-md border border-line-error bg-danger-soft p-3 text-sm text-fg"
        data-testid="compare-error"
      >
        {state.message}
      </p>
    );
  }

  const missing = state.missing;

  return (
    <div className="flex flex-col gap-4">
      {missing.length > 0 ? (
        <p className="text-sm text-fg-secondary" data-testid="compare-missing">
          Ya no se pueden mostrar {missing.length} de los productos elegidos (
          {missing.join(', ')}): pueden haberse despublicado. Quitalos para
          seguir comparando.
        </p>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          testId="compare-empty"
          title="No hay productos que comparar"
          description="Los productos elegidos ya no estan publicados en la tienda."
          actions={[
            { href: '/categorias', label: 'Ver categorias', primary: true },
          ]}
        />
      ) : (
        <>
          <div className="sf-card overflow-x-auto">
            <table
              className="w-full min-w-[640px] border-collapse"
              data-testid="compare-table"
            >
              <caption className="sr-only">
                Comparacion de {products.length} productos con los datos
                vigentes del ERP
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="w-40 p-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-tertiary"
                  >
                    Producto
                  </th>
                  {products.map((product) => (
                    <th
                      key={product.slug}
                      scope="col"
                      className="p-3 text-left align-top"
                      data-testid="compare-column"
                      data-slug={product.slug}
                    >
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/productos/${product.slug}`}
                          className="text-sm font-semibold leading-snug text-fg hover:text-fg-accent"
                        >
                          {product.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(product.itemId)}
                          className="sf-link w-fit text-xs font-medium"
                          data-testid="compare-remove"
                          data-slug={product.slug}
                        >
                          Quitar
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="Precio">
                  {products.map((product) => (
                    <Cell key={product.slug}>
                      <Price
                        price={product.price}
                        listPrice={product.listPrice}
                        currency={product.currency}
                        testId="compare-price"
                        listTestId="compare-list-price"
                      />
                    </Cell>
                  ))}
                </Row>
                <Row label="Existencia">
                  {products.map((product) => (
                    <Cell key={product.slug}>
                      <span data-testid="compare-availability">
                        {product.availability.inStock
                          ? `Disponible: ${product.availability.available}`
                          : `Sin existencia en ${cityName}`}
                      </span>
                    </Cell>
                  ))}
                </Row>
                <Row label="Marca">
                  {products.map((product) => (
                    <Cell key={product.slug}>
                      <span data-testid="compare-brand">
                        {product.brand ?? '—'}
                      </span>
                    </Cell>
                  ))}
                </Row>
                <Row label="Vendido por">
                  {products.map((product) => (
                    <Cell key={product.slug}>
                      <span data-testid="compare-seller">
                        {typeof product.seller === 'string' &&
                        product.seller !== ''
                          ? product.seller
                          : '—'}
                      </span>
                    </Cell>
                  ))}
                </Row>
                <Row label="Garantia">
                  {products.map((product) => (
                    <Cell key={product.slug}>
                      <span data-testid="compare-warranty">
                        {typeof product.warrantyMonths === 'number'
                          ? `${product.warrantyMonths} meses`
                          : '—'}
                      </span>
                    </Cell>
                  ))}
                </Row>
                <Row label="Categoria">
                  {products.map((product) => (
                    <Cell key={product.slug}>
                      {product.category?.name ?? '—'}
                    </Cell>
                  ))}
                </Row>
                <Row label="SKU">
                  {products.map((product) => (
                    <Cell key={product.slug}>
                      <span className="font-mono text-xs">{product.sku}</span>
                    </Cell>
                  ))}
                </Row>
                {specRows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-t border-line-subtle"
                    data-testid="compare-spec-row"
                    data-spec={row.name}
                  >
                    <th
                      scope="row"
                      className="p-3 text-left align-top text-xs font-semibold text-fg-secondary"
                    >
                      {row.name}
                    </th>
                    {row.values.map((value, index) => (
                      <td
                        key={`${row.name}-${products[index]?.slug ?? index}`}
                        className="p-3 align-top text-sm text-fg"
                      >
                        {value ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section
            className="flex flex-col gap-2"
            data-testid="compare-own-specs"
          >
            <h2 className="sf-h3 text-fg">
              Caracteristicas propias de cada producto
            </h2>
            <p className="text-xs text-fg-tertiary">
              Las de arriba son las que comparten los {products.length}{' '}
              productos; estas solo las tiene uno, asi que no se pueden comparar
              fila a fila.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => {
                const own = ownSpecs(product as CompareProduct, shared);
                return (
                  <article
                    key={product.slug}
                    className="sf-card flex flex-col gap-2 p-3"
                  >
                    <h3 className="text-sm font-semibold text-fg">
                      {product.name}
                    </h3>
                    {own.length === 0 ? (
                      <p className="text-xs text-fg-tertiary">
                        No publica caracteristicas propias.
                      </p>
                    ) : (
                      <dl className="flex flex-col gap-1 text-xs">
                        {own.map((spec) => (
                          <div
                            key={spec.name}
                            className="flex justify-between gap-2"
                          >
                            <dt className="text-fg-secondary">{spec.name}</dt>
                            <dd className="text-right font-medium text-fg">
                              {spec.value}
                              {typeof spec.unit === 'string' && spec.unit !== ''
                                ? ` ${spec.unit}`
                                : ''}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={clear}
              className="sf-btn sf-btn-secondary"
              data-testid="compare-clear"
            >
              Vaciar comparacion
            </button>
            <Link href="/categorias" className="sf-link text-sm font-medium">
              Seguir mirando el catalogo
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
