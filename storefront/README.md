# erp-storefront — tienda publica del ERP

Tienda en linea (storefront) del ERP `erp_suite`. Es una app **Next.js 14 (App Router)** que
consume el **canal publico** del ERP (`/storefront/...`) y **solo desde el servidor**.

```
storefront/                 Next.js 14 + TypeScript + Tailwind 3 + Zustand
  src/lib/erp.ts            cliente tipado del canal (server-only)
  src/lib/city.ts           ciudad elegida (cookie storefront_city, leida en el servidor)
  src/lib/format.ts         formato de dinero es-BO / BOB
  src/styles/tokens.css     GENERADO desde la capa de tokens del ERP (no editar)
  scripts/sync-tokens.mjs   compila los tokens del ERP a CSS variables
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
pagina del carrito, galeria y boton de compra; ninguno conoce la clave ni la URL del ERP.

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
| `npm run e2e` | Playwright sobre `next start` en `:3100` contra la API real |

## Tokens del ERP (compilados, no copiados)

`scripts/sync-tokens.mjs` lee `erp-frontend/src/styles/tokens/_01-primitives.scss` …
`_07-sizing.scss` con el paquete `sass` y emite `src/styles/tokens.css` con las CSS variables.
`src/styles/tokens.css` es un **artefacto**: se regenera, no se edita. El gate
`npm run sync:tokens:check` (exit 1 si el archivo cambiaria) evita que la tienda y el ERP se
separen. Los componentes no usan colores hexadecimales: usan las variables
(`var(--accent-600)`, `var(--text-primary)`, …) mapeadas en `tailwind.config.ts`.

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
