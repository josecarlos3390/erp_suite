'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { CategoryNode } from '@/lib/erp';

import { ChevronDownIcon } from './ui/icons';

interface CategoryNavProps {
  categories: readonly CategoryNode[];
}

/**
 * Navegacion de categorias del encabezado (F9.1, reestructurada en T209).
 *
 * Se arma con el arbol publicado del canal (15 raices en el seed).
 *
 * **Por que el panel vive FUERA de la fila de enlaces.** La fila es un carril con
 * scroll horizontal (`overflow-x-auto`) porque las raices no caben a lo ancho; en
 * CSS, un `overflow-x: auto` obliga a `overflow-y: auto` (medido en el navegador),
 * asi que un panel `position: absolute` **dentro** de esa fila queda recortado por
 * su caja: con el `<details>` anterior se midio que **110 px** del panel (todo su
 * alto, 108 px) caian por debajo del borde del carril y el comprador no veia el
 * menu. Ahora el carril solo lleva los enlaces y el panel se pinta como hermano
 * suyo, anclado a la barra (`absolute inset-x-0 top-full`), de modo que ningun
 * contenedor con scroll lo recorta.
 *
 * El desplegable es un **islote cliente** (ya lo era la nav, para marcar la
 * categoria activa con `aria-current="page"`). **Declarado**: sin JavaScript el
 * enlace a la categoria y la pagina `/categorias` siguen funcionando (el arbol
 * completo esta ahi); lo que no se abre es el panel, que antes se abria pero
 * recortado.
 */
export function CategoryNav({ categories }: CategoryNavProps): JSX.Element {
  const pathname = usePathname();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const openCategory =
    categories.find((root) => root.slug === openSlug && root.children.length > 0) ?? null;

  // Al navegar (misma pestana o clic en un enlace del panel) el panel se cierra.
  useEffect(() => {
    setOpenSlug(null);
  }, [pathname]);

  useEffect(() => {
    if (openCategory === null) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      const slug = openCategory.slug;
      setOpenSlug(null);
      // El foco vuelve al boton que abrio el panel (no se pierde por la pagina).
      document.getElementById(triggerId(slug))?.focus();
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (navRef.current?.contains(event.target as Node) !== true) setOpenSlug(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openCategory]);

  if (categories.length === 0) {
    return (
      <div className="border-t border-line-subtle bg-elevated">
        <p className="sf-container py-2 text-xs text-fg-tertiary">
          El ERP no devolvio categorias publicadas.
        </p>
      </div>
    );
  }

  const allActive = pathname === '/categorias';

  return (
    <nav
      ref={navRef}
      aria-label="Categorias"
      className="relative border-t border-line-subtle bg-elevated"
    >
      {/* Carril de enlaces: es el unico contenedor con scroll (y el panel no vive aqui). */}
      <div className="sf-container sf-scrollbar-none overflow-x-auto">
        <ul className="flex items-center gap-1 py-1.5 text-sm">
          <li className="shrink-0">
            <Link
              href="/categorias"
              aria-current={allActive ? 'page' : undefined}
              className={`inline-flex min-h-[36px] items-center rounded-full px-3 font-semibold transition-colors duration-fast ${
                allActive
                  ? 'bg-primary-soft text-fg-accent'
                  : 'text-fg hover:bg-hover hover:text-fg-accent'
              }`}
            >
              Todas las categorias
            </Link>
          </li>
          {categories.map((root) => {
            const active = pathname === `/categorias/${root.slug}`;

            if (root.children.length === 0) {
              return (
                <li key={root.slug} className="shrink-0">
                  <Link
                    href={`/categorias/${root.slug}`}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-[36px] items-center rounded-full px-3 transition-colors duration-fast ${
                      active
                        ? 'bg-primary-soft font-semibold text-fg-accent'
                        : 'text-fg-secondary hover:bg-hover hover:text-fg'
                    }`}
                    data-testid="nav-category"
                  >
                    {root.name}
                  </Link>
                </li>
              );
            }

            const isOpen = openCategory?.slug === root.slug;
            return (
              <li
                key={root.slug}
                className={`flex shrink-0 items-center rounded-full transition-colors duration-fast ${
                  active || isOpen
                    ? 'bg-primary-soft text-fg-accent'
                    : 'text-fg-secondary hover:bg-hover hover:text-fg'
                }`}
              >
                <Link
                  href={`/categorias/${root.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className="inline-flex min-h-[36px] items-center rounded-l-full py-0 pl-3 pr-1 transition-colors duration-fast"
                  data-testid="nav-category"
                >
                  {root.name}
                </Link>
                <button
                  id={triggerId(root.slug)}
                  type="button"
                  aria-expanded={isOpen}
                  // `aria-controls` solo mientras el panel existe: cuando el menu esta
                  // cerrado el panel no se pinta y un IDREF colgado es invalido (lo
                  // marcaria el gate de accesibilidad).
                  aria-controls={isOpen ? panelId(root.slug) : undefined}
                  aria-label={`Ver las subcategorias de ${root.name}`}
                  data-testid="nav-category-toggle"
                  onClick={() => setOpenSlug(isOpen ? null : root.slug)}
                  // `ArrowDown` entra al panel: el panel vive fuera del carril (es la
                  // unica forma de que no lo recorte el scroll), asi que sin esto el
                  // teclado tendria que atravesar el resto de categorias para llegar.
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowDown' || !isOpen) return;
                    event.preventDefault();
                    firstPanelLink(root.slug)?.focus();
                  }}
                  className="inline-flex min-h-[36px] cursor-pointer items-center rounded-r-full py-0 pl-1 pr-2.5 transition-colors duration-fast"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex transition-transform duration-fast ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <ChevronDownIcon size={14} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Panel de subcategorias: hermano del carril, anclado a la barra. */}
      {openCategory !== null ? (
        <div
          id={panelId(openCategory.slug)}
          data-testid="nav-panel"
          className="absolute inset-x-0 top-full z-panel border-b border-line bg-base shadow-layered"
        >
          <div className="sf-container flex flex-col gap-3 py-4">
            <div className="flex items-center justify-between gap-4">
              <p className="sf-eyebrow">{openCategory.name}</p>
              <button
                type="button"
                className="sf-btn sf-btn-ghost min-h-[36px] px-3"
                onClick={() => setOpenSlug(null)}
                data-testid="nav-panel-close"
              >
                Cerrar
              </button>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <li>
                <Link
                  href={`/categorias/${openCategory.slug}`}
                  className="flex min-h-[40px] items-center justify-between gap-3 rounded-btn px-3 text-sm font-semibold text-fg transition-colors duration-fast hover:bg-hover"
                  data-testid="nav-panel-link"
                >
                  <span className="truncate">Todo en {openCategory.name}</span>
                  <span className="text-2xs text-fg-tertiary">{openCategory.productCount}</span>
                </Link>
              </li>
              {openCategory.children.map((child) => (
                <li key={child.slug}>
                  <Link
                    href={`/categorias/${child.slug}`}
                    className="flex min-h-[40px] items-center justify-between gap-3 rounded-btn px-3 text-sm text-fg-secondary transition-colors duration-fast hover:bg-hover hover:text-fg"
                    data-testid="nav-panel-link"
                  >
                    <span className="truncate">{child.name}</span>
                    <span className="text-2xs text-fg-tertiary">{child.productCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function triggerId(slug: string): string {
  return `nav-categoria-${slug}`;
}

function panelId(slug: string): string {
  return `nav-panel-${slug}`;
}

/** Primer enlace del panel de una categoria (para entrar con el teclado). */
function firstPanelLink(slug: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `#${panelId(slug)} [data-testid="nav-panel-link"]`,
  );
}
