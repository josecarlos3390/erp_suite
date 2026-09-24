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
  scripts/audit-contrast.mjs gate de contraste WCAG de la paleta (F9.6)
  e2e/                      gate funcional Playwright contra la API del ERP en marcha
  e2e/visual/               gate visual + accesibilidad + rendimiento (F9.6)
    channel-fixture.mjs     proxy del canal: graba una vez y repite (datos fijos)
    fixtures/               las 30 respuestas grabadas del canal
    store-cases.ts          casos compartidos (carrito fijo, comprador fijo, rutas)
    store-visual.spec.ts    15 capturas de referencia (claro y oscuro)
    store-a11y.spec.ts      axe-core sobre 17 pantallas pintadas
    store-perf.spec.ts      LCP/CLS y peso del arranque
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
| `npm run e2e` | Playwright sobre `next start` en `:3100` contra la API real (27 casos) |
| `npm run e2e:visual` | gate visual (F9.6): 15 capturas contra el **fixture grabado** del canal, `next start` en `:3200` |
| `npm run e2e:visual:update` | regenera las capturas; con `STORE_VISUAL_RECORD=1` **vuelve a grabar** el fixture (API del ERP en marcha) |
| `npm run e2e:a11y` | `axe-core` (WCAG 2.0/2.1 A y AA + best-practice) sobre 17 pantallas, claro y oscuro |
| `npm run e2e:perf` | presupuesto de LCP, CLS y peso del arranque (ratchet con los numeros medidos) |
| `npm run audit:contrast` | contraste WCAG de los 34 pares de la paleta, **incluidos los degradados** que `axe` no mide |

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
(contador + linea + cantidades), checkout de invitado (cotizacion, alta real del pedido,
idempotencia, error de existencia), referencia del pago offline, seguimiento publico y cambio de
ciudad (SCZ vs LPZ). El articulo sin existencia en La Paz y el producto de la subcategoria **se
descubren por la API en la propia prueba**, nunca se codifican a mano.

## Gates de cierre (F9.6): visual, accesibilidad, contraste y rendimiento

Los cuatro gates nuevos **no** miden contra el seed: el gate funcional es el unico que lo hace.

1. **Visual** (`e2e:visual` + `playwright.visual.config.ts`). Un gate visual necesita datos fijos:
   una captura de referencia que cambia con el precio no distingue «se rompio el diseno» de «cambio
   el dato». `e2e/visual/channel-fixture.mjs` es un **proxy del canal** que graba las respuestas
   reales una vez (`e2e/visual/fixtures/`, 30 respuestas) y las repite; la tienda sigue apuntando a
   `ERP_API_URL` y no sabe que hay un fixture detras. Un endpoint sin grabacion responde **599 y lo
   registra** (el spec falla en vez de capturar una pantalla de error como si fuera buena).
   Para volver a grabar: `$env:STORE_VISUAL_RECORD='1'; npm run e2e:visual:update` con la API del ERP
   en marcha. Las capturas son **por plataforma** (Playwright les pone el sufijo `win32`).
2. **Accesibilidad** (`e2e:a11y`). `axe-core` sobre el DOM pintado; falla por cualquier violacion
   `serious`/`critical` e imprime color de texto, color de fondo y relacion de cada nodo.
   **Limite medido**: `axe` no puede calcular el contraste de un texto sobre un degradado y lo deja
   como *incomplete* (67 nodos en la home), asi que esos pares los cubre el gate siguiente.
3. **Contraste de la paleta** (`audit:contrast`). Resuelve `tokens.css` + `brand.css` con la cascada
   real (`:root` → marca → bloques del tema oscuro) y comprueba 34 pares con la formula WCAG,
   **parada por parada** de cada degradado, con los minimos de AA (4,5:1 texto, 3:1 texto grande e
   interfaz). Lo que falle aqui se corrige en `brand.css`, nunca en `tokens.css` (artefacto).
4. **Rendimiento** (`e2e:perf`). LCP y CLS con `PerformanceObserver` y el peso real del arranque por
   `encodedBodySize`. Los presupuestos son un **ratchet** medido en `localhost`: no son una medida de
   campo. El gate imprime tambien **que** archivos de tipografia se descargaron (con texto espanol
   solo bajan los cuatro `latin`, 188,5 kB de los 521 kB de `.woff2`).

## Alcance

Las fases del plan `docs/plans/plan-ecommerce-storefront.md` estan entregadas: **F1/F2** (catalogo,
ficha, busqueda, carrito y ciudad, con SEO), **F3** (checkout de invitado, confirmacion y
seguimiento publico), **F5** (bandeja de pedidos web en el back office), **F8.1/F8.2** (un solo
motor de precios, paridad entre pedidos, POS y tienda, y la **promo exclusiva del canal**) y **F9**
(identidad visual de la tienda, fases F9.1–F9.6). La promo se administra desde el back office
(`GET/PATCH /web-promotions`, permiso `web-promotions:view|edit`) y la tienda la pinta como capa
propia en la ficha, el carrito y el desglose del checkout.

**Declarado (cache)**: el catalogo y la ficha del canal se cachean **60 s** (`src/lib/erp.ts`:
`catalog: 60`, `product: 60`), asi que **una promo recien configurada tarda esa ventana en verse**
en la tienda (el E2E de la promo lo mide: 18,3 s en una corrida con la cache caliente). La
cotizacion y el alta de pedido **no** se cachean (`cache: 'no-store'`), de modo que el importe que
se cobra siempre es el vigente.

Siguen **declarados**: el correo transaccional (D16, el backend no tiene proveedor), el
retiro en tienda (fase 2), el CORS por dominio y la cache HTTP del canal, la serie propia del canal
(F7, con la factura), la rotulacion de la promo en la bandeja de pedidos del back office y la
pantalla de promociones del canal (F8.3).

