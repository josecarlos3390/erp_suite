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

| Variable               | Obligatoria                          | Para que                                                                      |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `ERP_API_URL`          | si (default `http://localhost:3001`) | URL base del ERP. El canal vive en `/storefront/...`, **sin** prefijo `/api`. |
| `STOREFRONT_API_KEY`   | si (o `STOREFRONT_CHANNELS`)         | Clave del canal (`x-storefront-key`). **Solo servidor.** Una clave = una empresa. Respaldo del modo de una empresa por despliegue. |
| `STOREFRONT_CHANNELS`  | no                                   | **Varios dominios en un despliegue**: JSON `host → { key, name, description, city, url }`. La clave de cada empresa, su identidad y su ciudad por defecto. **Solo servidor.** |
| `STOREFRONT_CITY`      | si (default `SCZ`)                   | Ciudad por defecto cuando el cliente todavia no eligio. Cada canal puede pisarla con su `city`. |
| `ERP_TIMEOUT_MS`       | no (default `8000`)                  | Tope de cada peticion al ERP.                                                 |
| `NEXT_PUBLIC_SITE_URL` | no (default `http://localhost:3000`) | Canonicos, Open Graph, sitemap y JSON-LD **del modo de una empresa por despliegue**; con `STOREFRONT_CHANNELS` cada host deriva la suya. |
| `NEXT_PUBLIC_SITE_NAME` | no (default `Tienda ERP`)           | Nombre por defecto (el de cada host sale de `STOREFRONT_CHANNELS`).           |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | no (default del codigo)      | Descripcion por defecto para buscadores y redes.                              |
| `IMAGE_REMOTE_HOSTS`   | no (default: solo marcadores)        | Hosts **ajenos** de las fotos reales, separados por comas. Con varios dominios en un despliegue es la **union** de los hosts de todas las empresas. |

### Regla «server-only» (decision D10)

**El navegador nunca llama al ERP.** Todas las peticiones al canal salen de Server Components,
Server Actions o route handlers, con `x-storefront-key` tomada de `process.env.STOREFRONT_API_KEY`.
`src/lib/erp.ts` importa `server-only`: si un componente cliente lo importa, el build falla en vez
de filtrar la clave. Los unicos islotes cliente son: buscador, selector de ciudad, contador y
pagina del carrito, galeria, boton de compra, navegacion de categorias (para marcar la activa) y
**conmutador de tema** (F9.1); ninguno conoce la clave ni la URL del ERP.

## Despliegue: una o varias tiendas

**El modelo, medido en el codigo**: el tenant **no** sale del dominio, sale de la **clave del canal**
(`StorefrontApiKeyGuard` → `WebApiKey.keyHash` → `tenantId`). Lo que se elige por dominio es **cual es
esa clave**, su identidad y su ciudad por defecto. Hay dos modos, y los dos funcionan hoy:

| Modo | Como | Cuando conviene |
| ---- | ---- | --------------- |
| **A. Un despliegue por empresa** | `STOREFRONT_API_KEY` + `NEXT_PUBLIC_SITE_*` en cada proyecto de Vercel | Aislamiento total (logs, rollback y variables por tienda); una empresa con **codigo o tema propio** |
| **B. Un despliegue, N dominios** | `STOREFRONT_CHANNELS` (JSON `host → canal`) en **un** proyecto, con los dominios apuntando a el | 2-10 tiendas con el **mismo** codigo: se da de alta un dominio y su clave **sin crear otro proyecto** |

```
     Modo A (un proyecto por empresa)                 Modo B (un proyecto, N dominios)
  ┌──────────────┐  ┌──────────────┐            ┌───────────────────────────────┐
  │ tienda-a     │  │ tienda-b     │            │ storefront (un despliegue)     │
  │ KEY A        │  │ KEY B        │            │ STOREFRONT_CHANNELS = {        │
  └──────┬───────┘  └──────┬───────┘            │   "tienda-a.com": KEY A,       │
         └────────┬────────┘                     │   "tienda-b.com": KEY B }      │
                  ▼                              └───────────────┬───────────────┘
          ERP (un backend, /storefront/...)              dominios → mismo proyecto
```

### Modo B: qué hace la tienda con el host (medido)

1. **`src/middleware.ts` — enrutado**: si el dominio no está en el mapa (y no hay comodín `"*"`),
   responde **404** con una página que dice qué variable tocar. El middleware **no** toca la clave ni
   pide datos al ERP: es solo enrutado (y corre en Edge, así que no puede filtrar la clave al
   navegador).
2. **`src/lib/channels.ts` — datos**: resuelve el canal del `Host` (coincidencia exacta → variante
   `www.` → comodín `"*"`) y de ahí salen la **clave** (server-only), la **ciudad por defecto** y la
   **identidad**.
3. **Por host**: nombre y descripción en cabecera, pie, `<title>`, Open Graph y JSON-LD; canónica,
   `robots.txt` y `sitemap.xml` con **las URLs de ese dominio** (antes salían de un
   `NEXT_PUBLIC_SITE_URL` fijo, que con N dominios publicaba las de otra empresa).
4. **La clave nunca viaja al navegador** (D10): todo pasa por el servidor de Next. Un caso del gate
   lo pincha.

**Por qué así y no todo dentro del middleware** (decisión medida): la clave es server-only y elegir el
tenant es una decisión de **datos**, no de enrutado; y todas las rutas de la tienda **ya** se renderizan
por petición (`ƒ` en el build), así que leer el `Host` en el servidor no cuesta optimización estática.
El middleware se queda con lo que **solo** él puede hacer: cortar una petición con 404 antes de
renderizar. Medido al no tenerlo: lanzar `notFound()` desde el cliente del canal entraba en **bucle**,
porque el pie de página vuelve a leer el canal al pintar la propia página de 404.

### Alta de una empresa nueva (ERP)

```bash
cd backend-erp
npm run crear:tenant2                     # o POST /tenants/:id/seed para maestros
npm run storefront:seed -- --tenant <slug|id> --check   # resuelve el contexto, sin escribir
npm run storefront:seed -- --tenant <slug|id>           # catalogo web de esa empresa
npm run storefront:key -- --tenant <slug|id> --label "Tienda A" \
  --origins https://tienda-a.com,https://www.tienda-a.com
```

`storefront:key` imprime **una sola vez** la clave en claro (en la base solo queda su SHA-256) y
deja el bloque de variables listo para copiar. `--list` muestra las claves de todas las empresas y
`--deactivate <prefijoDelHash>` apaga una (rotacion).

**En produccion** los dos scripts corren **dentro** del contenedor (el `DATABASE_URL` de Railway no
resuelve desde el portatil) y con `--transpile-only`:

```bash
railway ssh -s backend-erp 'cd /app && NODE_OPTIONS=--max-old-space-size=768 \
  npx ts-node --transpile-only scripts/create-storefront-key.ts --tenant empresa-a \
  --label "Tienda A" --origins https://tienda-a.com'
```

### Alta de la tienda (Vercel)

> **El `Root Directory` no es opcional.** El repositorio es el **monorepo raíz** (`erp_suite`), así
> que si el proyecto lo deja **vacío** Vercel busca Next en la raíz, no lo encuentra y **el
> despliegue automático de Git falla en 6 s** con «Error: No Next.js version detected … check your
> Root Directory setting». Medido: con `''` → ● Error 6 s; con `storefront` → ● Ready 42 s. El ajuste
> solo se cambia en **Settings → Root Directory** del panel (o por API): el CLI no tiene comando.

**Modo A** — un proyecto por empresa:

1. **New Project** → el repositorio **raíz** (`erp_suite`) → **Root Directory: `storefront`**.
2. **Environment Variables**: `ERP_API_URL`, `STOREFRONT_API_KEY` (la de esa empresa),
   `STOREFRONT_CITY`, `NEXT_PUBLIC_SITE_URL=https://tienda-a.com`, `NEXT_PUBLIC_SITE_NAME`, y
   `IMAGE_REMOTE_HOSTS` si tiene fotos propias.
3. **Dominio**: el de esa empresa.

**Modo B** — un proyecto, N dominios:

1. Igual: **New Project** → repo raíz → **Root Directory: `storefront`**.
2. **Environment Variables**:

   ```
   ERP_API_URL=https://backend-erp-production-5c3b.up.railway.app
   STOREFRONT_CHANNELS={"tienda-a.com":{"key":"sf_...","name":"Tienda A","city":"SCZ"},"tienda-b.com":{"key":"sf_...","name":"Tienda B","city":"LPZ"},"*":{"key":"sf_...","name":"Previews"}}
   IMAGE_REMOTE_HOSTS=cdn.tienda-a.com,cdn.tienda-b.com
   ```
3. **Dominios**: `tienda-a.com` y `tienda-b.com` en **ese mismo** proyecto.
4. **CORS del canal**: cada clave declara sus dominios en `allowedOrigins` (paso del ERP). No es
   imprescindible mientras la tienda hable **solo desde el servidor** (D10), pero deja el canal
   cerrado si algun dia el navegador llama directo.
5. **Alta de otra empresa**: `storefront:seed` + `storefront:key` en el ERP y **añadir su host al
   JSON** + su dominio en Vercel. Sin proyecto nuevo.

### Verificacion (sin navegador)

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'x-storefront-key: sf_...' \
  https://backend-erp-production-5c3b.up.railway.app/storefront/cities
```

**200** = la clave y el canal de esa empresa responden; **401** = clave inactiva o inexistente;
**403** = el `Origin` del navegador no esta declarado en esa clave. Para comprobar el aislamiento,
la **misma** ruta con la clave de otra empresa debe devolver **su** catalogo.

Con varios dominios, ademas:

```bash
# Cada host sirve su identidad y su canonica (y un host no declarado responde 404)
curl -s -H 'Host: tienda-a.com' https://<despliegue>/ | grep -o '<title>[^<]*'
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: no-declarado.com' https://<despliegue>/
```

El gate E2E **pincha los dos modos**: arranca el servidor con un mapa de dos dominios de prueba
(`tienda-a.local`, `tienda-b.local`), resuelve los hosts a `127.0.0.1` con `--host-resolver-rules` y
comprueba identidad, canónica, `robots.txt`, `sitemap.xml` y el 404 de `tienda-c.local`
(`e2e/multidominio.spec.ts`).

### Comprobar que el `push` publica (despliegue automatico)

El proyecto queda enlazado al repositorio raiz y a la rama de produccion (`master`): cada `push`
compila solo. Para comprobarlo sin navegador, tras un `push`:

```bash
vercel ls erp-storefront                     # el despliegue nuevo debe quedar ● Ready
curl -s https://<alias>/ | grep -o '<title>[^<]*'   # y el alias sirve ESE despliegue
```

Medido en el despliegue de produccion (proyecto `erp-storefront`,
**https://erp-storefront-inky.vercel.app**): ● Ready en **42 s**, `robots.txt` y las **131** URLs del
`sitemap.xml` con el dominio publico y la home con **16** tarjetas de producto.

### Rotacion de la clave (sin cortar la tienda)

1. `npm run storefront:key -- --tenant <slug> --label "Tienda A (2026-10)" --origins ...` → crea la
   clave **nueva** (la vieja sigue viva).
2. Cambia la clave en el despliegue (variable del proyecto en el modo A; entrada del host en
   `STOREFRONT_CHANNELS` en el modo B) y **redespliega**.
3. `npm run storefront:key -- --deactivate <prefijoDelHashViejo>` → apaga la vieja.

### Limites declarados de este modelo

1. **No hay pantalla de claves ni de dominios**: el alta y la rotacion son estos scripts (el modelo
   por host vive en `STOREFRONT_CHANNELS`, que es configuración de despliegue).
2. **Identidad visual por empresa**: el nombre y la descripción ya son por host, pero el **color de
   marca** (`--sf-*` de `src/styles/brand.css`) y el **logo** siguen en el código: en el modo A se
   cambian en la hoja de marca de ese despliegue, en el modo B son comunes (D23 pendiente).
3. **Las fotos reales** necesitan su host en `IMAGE_REMOTE_HOSTS` (y dejar de ser un marcador de
   posición para que la tienda no dibuje su placeholder, D24).
4. **Un cambio de `STOREFRONT_CHANNELS` exige redesplegar** (Vercel congela la configuración del
   despliegue). El middleware lee la variable en runtime —medido con `next start`—, pero un
   despliegue nuevo la toma en su build.

## Comandos

| Comando                     | Que hace                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run dev`               | servidor de desarrollo en `:3000`                                                                         |
| `npm run build`             | build de produccion                                                                                       |
| `npm start`                 | sirve el build en `:3000`                                                                                 |
| `npm run lint`              | ESLint (`next/core-web-vitals`, `--max-warnings=0`)                                                       |
| `npm run typecheck`         | `tsc --noEmit` (strict)                                                                                   |
| `npm run sync:tokens`       | compila los tokens del ERP a `src/styles/tokens.css`                                                      |
| `npm run sync:tokens:check` | gate: falla si `tokens.css` esta desincronizado                                                           |
| `npm run sync:fonts`        | copia los `.woff2` de Inter del ERP a `public/fonts`                                                      |
| `npm run sync:fonts:check`  | gate: falla si falta una fuente o difiere de la del ERP                                                   |
| `npm run e2e`               | Playwright sobre `next start` en `:3100` contra la API real (43 casos)                                    |
| `npm run e2e:visual`        | gate visual (F9.6): 15 capturas contra el **fixture grabado** del canal, `next start` en `:3200`          |
| `npm run e2e:visual:update` | regenera las capturas; con `STORE_VISUAL_RECORD=1` **vuelve a grabar** el fixture (API del ERP en marcha) |
| `npm run e2e:a11y`          | `axe-core` (WCAG 2.0/2.1 A y AA + best-practice) sobre 17 pantallas, claro y oscuro                       |
| `npm run e2e:perf`          | presupuesto de LCP, CLS y peso del arranque (ratchet con los numeros medidos)                             |
| `npm run audit:contrast`    | contraste WCAG de los 34 pares de la paleta, **incluidos los degradados** que `axe` no mide               |

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

| Capa                       | Archivo                                         | Que aporta                                                                                                                                             |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokens del ERP (artefacto) | `src/styles/tokens.css`                         | neutros, espaciado, sombras base, `[data-theme=dark]`, duraciones y easings                                                                            |
| Tipografia self-hosted     | `src/styles/fonts.css` + `public/fonts/*.woff2` | Inter 400/500/600/700 (latin y latin-ext) copiada del ERP por `sync:fonts`                                                                             |
| Marca de la tienda         | `src/styles/brand.css`                          | `--sf-*`: color de accion, promocion, descuento, precio, superficies de imagen, formas y elevacion; escala de titulos                                  |
| Componentes                | `src/app/globals.css` (`@layer components`)     | `.sf-btn*`, `.sf-badge*`, `.sf-chip`, `.sf-card*`, `.sf-panel`, `.sf-field`, `.sf-media`, `.sf-h1/h2/h3`, `.sf-price*`, `.sf-skeleton`, `.sf-scroll-x` |
| Mapa a utilidades          | `tailwind.config.ts`                            | `primary`/`fg.accent` apuntan a `--sf-brand-*`; `font-sans`/`font-display` a `--sf-font-*`; sombras `card`/`cta`/`header`                              |

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

> **El gate E2E ESCRIBE en la base de desarrollo** (medido el 2026-09-29): una corrida completa
> (43 casos) deja **9 pedidos web (WEB-1..9), 1 entrega (DEL-1) y 1 factura de reserva (FRV-1)
> contabilizadas** (2 asientos), ademas de 1 resena, 1 solicitud de servicio y sus clientes web.
> No es un fallo de los casos —alta real del pedido es justo lo que miden— pero **no hay limpieza
> automatica** (`afterAll`): la base queda sucia y deja de ser comparable con el seed. Para volver
> al estado del seed: `cd backend-erp && npm run db:recreate` (con la API parada, porque una
> conexion viva bloquea el reset). Pendiente declarado: que el arnés limpie lo que crea.

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
   como _incomplete_ (67 nodos en la home), asi que esos pares los cubre el gate siguiente.
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
seguimiento publico), **F5** (bandeja de pedidos web en el back office), **F7** (la **modalidad de
facturacion la elige el comprador** en el checkout), **F8.1/F8.2** (un solo
motor de precios, paridad entre pedidos, POS y tienda, y la **promo exclusiva del canal**) y **F9**
(identidad visual de la tienda, fases F9.1–F9.6) y **F6** en sus tres primeros tramos (vendedores,
comparador y favoritos). La promo se administra desde el back office
(`GET/PATCH /web-promotions`, permiso `web-promotions:view|edit`) y la tienda la pinta como capa
propia en la ficha, el carrito y el desglose del checkout.

### Seguimiento del pedido (F3): el numero solo no basta

La consulta publica del pedido exige **una prueba de propiedad** ademas del numero: el **correo** con
el que se compro **o** el **codigo de seguimiento** (`WEB-XXXXXXXX`, que la confirmacion le ensena al
comprador). Sin ninguna de las dos el canal responde **404** —no 403: no confirma si el pedido
existe—. Medido antes (2026-09-29): `?order=WEB-1` **sin credencial** devolvia **200** con las lineas,
los importes y el `salesOrderId`, y los numeros son **secuenciales**, asi que las ventas web de la
empresa eran enumerables; ademas el correo se comparaba **con mayusculas** (el mismo correo con otra
caja respondia 404 «No existe el pedido»). Las dos pruebas se comparan ahora **sin distinguir
mayusculas** y la regla vive en un solo sitio del backend (`provesOrderOwnership`).

- `/seguimiento?order=&proof=`: el campo **«Correo o codigo de seguimiento» es obligatorio**; el
  servidor lo envia al canal como `email` o `code` segun su forma (un correo lleva `@`).
- `/pedido/[orderNumber]?c=<codigo>`: la confirmacion lleva el **codigo** en la URL (no el correo: no
  es un dato personal y no acaba en el historial ni en los logs). Sin el codigo, esa direccion responde
  **404**.
- **Declarado**: el numero de pedido sigue siendo secuencial (es el del documento del ERP) — lo que se
  cierra es que **por si solo** abra el pedido; y un pedido **sin** correo y **sin** codigo no se puede
  consultar en publico (el alta escribe el codigo siempre, asi que solo puede venir de filas antiguas).
  Esto **no** es una cuenta de cliente (F4 sigue pendiente): sigue sin haber sesion.

### Contenido de la tienda (F5): banners y paginas desde el ERP

Los **banners** de la portada y las **paginas** de contenido **no** se tocan en el codigo: se
publican desde el back office (**Configuracion → Contenido de la tienda**, permiso
`web-content:view|edit`). La tienda los lee de la misma base (`WebBanner`/`WebPage`).

- **Banners**: por **slot** —la portada pide `home-hero` y `home-strip`—, con imagen, titulo,
  subtitulo, enlace, orden, estado y **vigencia** (`desde`/`hasta`). Un banner solo se pinta si
  esta **activo** y dentro de su vigencia: una campana se apaga sola.
- **Paginas**: cada una vive en su URL (`/paginas/<slug>`), con titulo y contenido de texto, y se
  puede **despublicar** sin borrarla.
- La imagen tiene que estar en un host permitido: si es de un CDN propio, anadelo a
  `IMAGE_REMOTE_HOSTS`.

**Ventana de refresco** (declarada): la tienda cachea el contenido (`banners` 120 s, `pagina`
600 s), asi que un cambio publicado se ve en ese plazo; un borrado tambien.

### Modalidad de facturacion (F7)

En el **paso 2** del checkout el comprador elige **cuando** quiere su factura, y esa eleccion viaja
con el pedido (`webInvoicingMode`):

- **«Pagar al recibir»** (por defecto): el canal **no** emite ningun documento fiscal al confirmar;
  el pedido se entrega y la factura nace de la entrega.
- **«Pagar ahora»**: el canal emite la **factura de reserva** al confirmar el pedido, el cobro se
  registra contra ella y la entrega sale de esa reserva.

La confirmacion y el seguimiento publican la modalidad elegida y, si existe, el numero de la
factura de reserva (`order-invoicing-mode`). El cobro sigue siendo **offline** (transferencia, QR o
contra entrega): no hay PSP, por decision del usuario.

### Vendedores (F6)

Cada publicacion tiene un **vendedor** (`Seller` del ERP) y la tienda lo dice: la ficha muestra
«Vendido por …» con su monograma (`product-seller`), cada tarjeta lleva su linea (`seller-line`) y
el panel de filtros ofrece **Vendido por** (`filtro-vendedor`), alimentado por la faceta del canal
`GET /storefront/sellers` —solo los vendedores **con catalogo publicado**, acotada a la categoria
cuando se esta dentro de una—. El filtro del listado es `?seller=<codigo>`: se filtra por el
**codigo** del maestro, no por el nombre. El `Seller.logoUrl` se publica pero no se pinta: la
semilla no trae logos.

### Comparador (F6)

`/comparar` pone hasta **4** productos lado a lado. La lista vive en el **navegador**
(`localStorage`, como el carrito: no hay cuenta de cliente hasta F4) y guarda **solo la
identidad** de cada producto; los datos que se comparan —precio con su «antes» y su ahorro,
existencia de la ciudad elegida, marca, vendedor, garantia, categoria, SKU y la ficha tecnica— se
piden al abrir la pagina por el puente **`GET /api/comparar`** (sanea los slugs, tope 4, y
mantiene la clave del canal en el servidor, D10). Solo se comparan las caracteristicas que
**comparten todos** los productos elegidos; las que son propias de uno se listan aparte. El
control «Comparar» esta en cada tarjeta (`compare-toggle`) y en la ficha, el contador aparece en
la cabecera cuando hay algo que comparar (`compare-link`) y con la lista llena el control se
deshabilita diciendo por que.

### Favoritos (wishlist, F6)

`/favoritos` es la **lista de deseos** del comprador: hasta **24** productos a la vez. Igual que el
comparador, la lista vive en el **navegador** (`localStorage`) y guarda **solo la identidad** de
cada producto (no una copia del precio); los datos que se ven —precio con su oferta y su «antes»,
existencia de la ciudad elegida— se piden al abrir la pagina por el puente **`GET /api/favoritos`**,
con el mismo saneo de slugs y el mismo tope que el comparador (la clave del canal no sale del
servidor, D10). El boton «Guardar» / «En favoritos» esta en cada tarjeta (`wishlist-button`) y en la
ficha; el enlace de la cabecera (`wishlist-link`, con su contador) aparece **solo cuando hay algo
guardado**, y la grilla **reutiliza la tarjeta del catalogo**, asi que la compra rapida y el control
de comparar siguen ahi. Cada tarjeta tiene su «Quitar de favoritos», la pagina ofrece «Vaciar
favoritos» y, con dos o mas guardados, «Comparar los guardados» (que lleva al comparador, donde
manda su tope de 4). Si la lista pasa de 24 se dice (`wishlist-truncated`) y se muestran los 24
primeros; si un producto guardado ya no se puede leer, se nombra en vez de desaparecer en silencio
(`wishlist-missing`). La pagina es `noindex`: cada visitante ve su propia lista.

### Resenas (F6)

La ficha lleva una seccion de **resenas** (`ProductReviews`) con el **promedio** y el numero que
publica el ERP y el listado de las **aprobadas** (`review-item`); si no hay, lo dice
(`reviews-empty`) en vez de inventar un promedio. Debajo esta el formulario para escribir una
(`review-form`): como no hay cuenta de cliente (F4 espera al proveedor de correo), el comprador
prueba su compra con el **numero de pedido** y su **correo**, y el canal comprueba que el pedido
exista, sea de ese correo, este **entregado** y **lleve el articulo**; el `slug` lo pone la ficha,
no el formulario. La resena **nace pendiente**: se publica cuando el back office la aprueba (solo
las aprobadas cuentan para el promedio y solo ellas van al `aggregateRating` del JSON-LD). El
comprador se publica con su **nombre** o, si no lo dio, con su correo **enmascarado**
(`j***@correo.com`); su correo completo nunca sale de la ficha. El envio va por el puente
`POST /api/resenas` (D10) y las reglas de formato viven en `src/lib/reviews.ts`, compartidas por el
formulario y el puente.

**Declarado**: el canal solo publica el promedio y el listado en la **ficha** (el catalogo y los
relacionados no los llevan: no se paga la consulta en cada tarjeta), la copia de la ficha se
cachea **60 s** —asi que una resena recien aprobada tarda esa ventana en verse: el E2E lo **mide**
(21,5 s y 56,4 s en dos corridas)— y no hay aviso por correo al comprador (D16).

**Declarado (cache)**: el catalogo y la ficha del canal se cachean **60 s** (`src/lib/erp.ts`:
`catalog: 60`, `product: 60`), asi que **una promo recien configurada tarda esa ventana en verse**
en la tienda (el E2E de la promo lo mide: 18,3 s en una corrida con la cache caliente). La
cotizacion y el alta de pedido **no** se cachean (`cache: 'no-store'`), de modo que el importe que
se cobra siempre es el vigente.

Siguen **declarados**: el correo transaccional (**D16**, el backend no tiene proveedor, y es lo que
bloquea **F4**), el retiro en tienda (fase 2), los favoritos y la comparacion como datos de **este
dispositivo** (se migran a la cuenta con F4), la rotulacion de la promo en la bandeja de pedidos del
back office, y los tramos de F6 que faltan (**garantia extendida e instalacion** y **servicio
tecnico**).
