# erp-storefront — tienda publica del ERP

Tienda en linea (storefront) del ERP `erp_suite`. Es una app **Next.js 14 (App Router)** que
consume el **canal publico** del ERP (`/storefront/...`) y **solo desde el servidor**.

```
storefront/                 Next.js 14 + TypeScript + Tailwind 3 + Zustand
  src/lib/erp.ts            cliente tipado del canal (server-only)
  src/lib/city.ts           ciudad elegida (cookie storefront_city, leida en el servidor)
  src/lib/format.ts         formato de dinero es-BO / BOB
  src/lib/theme.ts          tema claro/oscuro del comprador (localStorage, sin destello)
  src/lib/media.ts          reglas de imagen (hosts de marcador de posicion, D24)
  src/styles/tokens.css     GENERADO desde la capa de tokens del ERP (no editar)
  src/styles/fonts.css      @font-face de Inter self-hosted (los woff2 los copia sync:fonts)
  src/styles/brand.css      CAPA DE MARCA de la tienda (--sf-*: accion, promo, precio, formas)
  scripts/sync-tokens.mjs   compila los tokens del ERP a CSS variables
  scripts/sync-fonts.mjs    copia las tipografias del ERP a public/fonts
  e2e/                      gate Playwright contra la API del ERP en marcha
```

## Puesta en marcha

```bash
cd storefront
npm install
cp .env.example .env.local     # completar la clave del canal
npm run sync:tokens            # genera src/styles/tokens.css desde erp-frontend/
npm run dev                    # http://localhost:3000
```

La API del ERP debe estar escuchando (por defecto `http://localhost:3001`) con el seed de la
tienda cargado.

## Variables de entorno

| Variable | Obligatoria | Para que |
|---|---|---|
| `ERP_API_URL` | si (default `http://localhost:3001`) | URL base del ERP. El canal vive en `/storefront/...`, **sin** prefijo `/api`. |
| `STOREFRONT_API_KEY` | **si** | Clave del canal (`x-storefront-key`). **Solo servidor.** |
| `STOREFRONT_CITY` | si (default `SCZ`) | Ciudad por defecto cuando el cliente todavia no eligio. |
| `ERP_TIMEOUT_MS` | no (default `8000`) | Tope de cada peticion al ERP. |
| `NEXT_PUBLIC_SITE_URL` | no (default `http://localhost:3000`) | Canonicos, Open Graph, sitemap y JSON-LD. |

### Regla «server-only» (decision D10)

**El navegador nunca llama al ERP.** Todas las peticiones al canal salen de Server Components,
Server Actions o route handlers, con `x-storefront-key` tomada de `process.env.STOREFRONT_API_KEY`.
`src/lib/erp.ts` importa `server-only`: si un componente cliente lo importa, el build falla en vez
de filtrar la clave. Los unicos islotes cliente son: buscador, selector de ciudad, contador y
pagina del carrito, galeria, boton de compra, navegacion de categorias (para marcar la activa) y
**conmutador de tema** (F9.1); ninguno conoce la clave ni la URL del ERP.

## Comandos

| Comando | Que hace |
|---|---|
| `npm run dev` | servidor de desarrollo en `:3000` |
| `npm run build` | build de produccion |
| `npm start` | sirve el build en `:3000` |
| `npm run lint` | ESLint (`next/core-web-vitals`, `--max-warnings=0`) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run sync:tokens` | compila los tokens del ERP a `src/styles/tokens.css` |
| `npm run sync:tokens:check` | gate: falla si `tokens.css` esta desincronizado |
| `npm run sync:fonts` | copia los `.woff2` de Inter del ERP a `public/fonts` |
| `npm run sync:fonts:check` | gate: falla si falta una fuente o difiere de la del ERP |
| `npm run e2e` | Playwright sobre `next start` en `:3100` contra la API real |

> **Antes de `npm run build` o `npm run e2e`, parar el servidor de desarrollo**:
> los dos escriben `.next` y el `next dev` en marcha se queda con un bundle roto
> (`MODULE_NOT_FOUND` al pedir una pagina). Despues, reiniciar `npm run dev`.

## Tokens del ERP (compilados, no copiados)

`scripts/sync-tokens.mjs` lee `erp-frontend/src/styles/tokens/_01-primitives.scss` …
`_07-sizing.scss` con el paquete `sass` y emite `src/styles/tokens.css` con las CSS variables.
`src/styles/tokens.css` es un **artefacto**: se regenera, no se edita. El gate
`npm run sync:tokens:check` (exit 1 si el archivo cambiaria) evita que la tienda y el ERP se
separen. Los componentes no usan colores hexadecimales: usan las variables
(`var(--accent-600)`, `var(--text-primary)`, …) mapeadas en `tailwind.config.ts`.

## Identidad visual (F9, decisiones D22–D26)

La tienda tiene **su propia capa de marca** encima de los tokens del ERP:

| Capa | Archivo | Que aporta |
|---|---|---|
| Tokens del ERP (artefacto) | `src/styles/tokens.css` | neutros, espaciado, sombras base, `[data-theme=dark]`, duraciones y easings |
| Tipografia self-hosted | `src/styles/fonts.css` + `public/fonts/*.woff2` | Inter 400/500/600/700 (latin y latin-ext) copiada del ERP por `sync:fonts` |
| Marca de la tienda | `src/styles/brand.css` | `--sf-*`: color de accion, promocion, descuento, precio, superficies de imagen, formas y elevacion; escala de titulos |
| Componentes | `src/app/globals.css` (`@layer components`) | `.sf-btn*`, `.sf-badge*`, `.sf-chip`, `.sf-card*`, `.sf-panel`, `.sf-field`, `.sf-media`, `.sf-h1/h2/h3`, `.sf-price*`, `.sf-skeleton`, `.sf-scroll-x` |
| Mapa a utilidades | `tailwind.config.ts` | `primary`/`fg.accent` apuntan a `--sf-brand-*`; `font-sans`/`font-display` a `--sf-font-*`; sombras `card`/`cta`/`header` |

Reglas de la capa visual:

1. **Ningun color hexadecimal en un componente**: todo sale de `--*` (ERP) o `--sf-*` (marca).
2. **No se toca** `tokens.css` (artefacto con gate) ni se reutilizan los componentes del back
   office (son de operacion densa).
3. **Tema por tenant (D23)**: un tenant puede pisar cualquier `--sf-*` con su hoja de marca; los
   valores del codigo son el tema por defecto «retail tecnologico premium».
4. **Modo oscuro**: `[data-theme=dark]` en `<html>`, aplicado antes del primer pintado
   (`src/lib/theme.ts`) y conmutado por el islote `theme-toggle`. La preferencia es local del
   comprador y no viaja al ERP.
5. **Imagenes (D24)**: sin foto real, la tienda **no** pinta marcadores de posicion: dibuja su
   placeholder (fondo neutro + monograma + marca). El arte de campana del CMS si se pinta tal cual
   (`allowStockHost`).

## Gate E2E

`e2e/` corre con Playwright sobre `next start` en el puerto `3100` y **contra la API del ERP en
marcha** (el seed real). Requiere que `npm run build` se haya corrido antes:

```bash
npm run build
npm run e2e
```

El puerto y el entorno se pueden ajustar con `E2E_PORT`, `ERP_API_URL`, `STOREFRONT_API_KEY` y
`STOREFRONT_CITY`. Los casos cubren: home con productos y ofertas vigentes, categoria padre con
productos de sus subcategorias, ficha con precio/disponibilidad/JSON-LD, busqueda, carrito
(contador + linea + cantidades) y cambio de ciudad (SCZ vs LPZ). El articulo sin existencia en La
Paz y el producto de la subcategoria **se descubren por la API en la propia prueba**, nunca se
codifican a mano.

## Alcance

Esta entrega es la fase **F2 (catalogo)** del plan `docs/plans/plan-ecommerce-storefront.md`:
home, categorias, ficha, busqueda, carrito y selector de ciudad, con SEO (metadata, JSON-LD,
sitemap, robots). El **checkout es F3**: la tienda no crea pedidos todavia y el carrito es un
snapshot de referencia; `/carrito` lo dice explicitamente.
