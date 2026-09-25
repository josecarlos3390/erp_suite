# Changelog — tienda pública (`storefront/`)

Todos los cambios relevantes de la tienda del ERP. El detalle de cada fase (decisiones, mediciones y
declaraciones) vive en `docs/plans/plan-ecommerce-storefront.md` y en `AUDIT.md`; este archivo es el
resumen por entrega, en el mismo formato que los de `backend-erp/` y `erp-frontend/`.

## [Unreleased]

### Added

- **Cierre de la fase visual: gate visual propio, accesibilidad, contraste y presupuesto de
  rendimiento (2026-09-23, T208 / F9.6)**. **(1) Gate visual propio** (`playwright.visual.config.ts`,
  puerto 3200, `npm run e2e:visual`): **15 capturas de referencia** completas y **sin máscaras** de
  las pantallas de compra en claro y oscuro, medidas contra un **fixture grabado del canal**
  (`e2e/visual/channel-fixture.mjs`: un proxy de `GET/POST /storefront/...` que graba **30**
  respuestas reales una vez y las repite; descarta `idempotencyKey` al calcular la clave del POST y,
  ante un endpoint sin grabación, responde **599 y lo registra** para que el spec falle en vez de dar
  por buena una pantalla de error). Un gate visual no puede medir contra el seed de desarrollo: la
  captura de referencia cambiaría con el dato. **(2) Auditoría de accesibilidad**
  (`npm run e2e:a11y`): `axe-core` sobre el DOM **pintado** de 17 pantallas con las reglas `wcag2a`,
  `wcag2aa`, `wcag21a`, `wcag21aa` y `best-practice`; falla por cualquier violación `serious` o
  `critical` e imprime **color de texto, color de fondo y relación** de cada nodo. **(3) Contraste de
  la paleta** (`npm run audit:contrast`): resuelve `tokens.css` + `brand.css` con la cascada real
  (`:root` → marca → bloques del tema oscuro) y comprueba **34 pares** con la fórmula WCAG,
  **parada por parada** de cada degradado —lo que `axe` no puede medir: los deja como *incomplete*,
  **67 nodos en la home**, medidos—. **(4) Presupuesto de rendimiento** (`npm run e2e:perf`): LCP y
  CLS con `PerformanceObserver` y el peso real del arranque por `encodedBodySize`, como **ratchet**
  con los números medidos al lado. **Medido**: `audit:contrast` **34/34**, `e2e:a11y` **17/17 sin
  hallazgos**, `e2e:perf` **5/5** (LCP 184–528 ms, CLS 0,001–0,02, JS 107–115,8 kB, CSS 10,3 kB y
  fuentes **188,5 kB**: con texto español el navegador solo baja los cuatro `.woff2` de `latin`, de
  los 521 kB que suman los ocho del ERP), `e2e:visual` **15/15 con 0 endpoints sin grabación** y E2E
  funcional **27/27**. **Declarado**: las capturas son **por plataforma** (Playwright les añade el
  sufijo `win32`) y se generan y comparan en la misma; el modo grabación
  (`STORE_VISUAL_RECORD=1`) exige la API del ERP en marcha; el presupuesto es un ratchet medido en
  `localhost` y no una medida de campo.

- **El carrito y el checkout se comportan como un solo camino de pago (2026-09-23, T207 / F9.5)**.
  **Barra de progreso de la compra** (`checkout-progress.tsx`) con los cuatro nodos —carrito y los
  tres pasos—, marca de completado, barra que los une y `aria-current="step"`; el carrito es el nodo
  0 **sin `data-testid`**, así que el número visible de cada paso coincide con el del contrato del
  E2E (`checkout-step-1..3`) y su `data-state` (`done`/`current`/`pending`) se conserva. **Resumen
  pegajoso** en el carrito y en el checkout (`lg:top-32`; medido: la `y` del resumen se queda en
  128 px tras desplazar 800 px). **Estados de carga y error cuidados**: guarda de rehidratación con
  esqueleto en el carrito (antes pintaba un carrito vacío que el comprador no tenía), esqueleto
  completo en el checkout y en la cotización, y los vacíos unificados en `EmptyState`
  (`cart-empty`, `checkout-empty`). La **clase base `sf-btn` repuesta en 17 atributos de clase** de
  seis componentes (sin ella el botón salía con el relleno del navegador) y la forma `custom` del
  `Skeleton`, que no emite altura ni ancho (dos utilidades de Tailwind competían y el ancho pedido se
  perdía: medido en la hoja compilada). **El foco viaja al panel del paso nuevo** con salto
  instantáneo (`scroll-mt-32`; medido: la barra queda en 128 px con el encabezado pegajoso
  terminando en 124 px). **Tarjetas de opción** (`.sf-option`, con `:has(input:checked)`) para
  entrega y pago, e **iconos compartidos** (`ui/icons.tsx`). **Medido**: `typecheck` 0, `lint` 0/0,
  `build` 0 y **E2E 27/27**, con dos casos nuevos: la barra en las dos páginas con el resumen
  pegajoso y el foco en el panel nuevo, y —**sin JavaScript**— que la primera pintada es el esqueleto
  y no el estado vacío.

- **La ficha de producto pasa a ser una página de compra (2026-09-23, T206 / F9.4)**. **Caja de
  compra pegajosa** (`lg:sticky`) con marca, título `sf-h1`, insignias y **panel de precio** con el
  importe protagonista, la etiqueta de descuento, el «antes» y el **ahorro calculado** de dos
  importes del ERP. **Cantidad con tope real**: el stepper respeta `MAX_LINE_QUANTITY` **y la
  existencia publicada**. **Tarjetas** de entrega (días hábiles de la ciudad), envío (umbral de envío
  gratis), garantía (meses del ERP) y pago (medios del checkout), con la mención de **cuotas solo si
  el ERP publica la insignia `CUOTAS`** —la tienda no inventa planes de cuota—. **Galería con zoom**
  al pasar el puntero (origen siguiendo al puntero, contador `n / total`), ofrecido solo con foto
  real. **Ficha técnica en acordeones** (`<details open>` por grupo, sin JavaScript), conservando
  `specs-table`. **Medido**: `typecheck` 0, `lint` 0/0, `build` 0 y **E2E 25/25** (42,3 s).

- **La tarjeta y el catálogo dejan de ser un formulario (2026-09-23, T205 / F9.3)**. **Compra rápida
  desde la grilla** (`quick-add.tsx`, islote cliente declarado) que escribe el snapshot del carrito
  sin hablar con el ERP, vive **fuera** del enlace de la imagen (no navega) y queda deshabilitada sin
  existencia —usa `data-testid="quick-add"` **a propósito** para no volver ambiguo el `add-to-cart`
  de la ficha—. **Insignias con jerarquía** por variante (`ENVIO GRATIS` verde, `OFERTA` naranja,
  `CUOTAS` suave, `NUEVO` marca). **Skeletons** en las dos pantallas de catálogo con la misma
  estructura que la página. **Panel de filtros y orden** con cabecera, «Aplicar» de ancho completo,
  «Limpiar» solo con filtros activos, chips con estado, `filtros-resumen` y pegado en escritorio
  (sigue sin JavaScript: formulario GET con `select` nativos). **Estados vacíos unificados**
  (`ui/empty-state.tsx`). **Medido**: `typecheck` 0, `lint` 0/0, `build` 0 y **E2E 25/25** con caso
  nuevo (el quick-add no navega y suma al carrito, con artículo y categoría descubiertos por la API).

- **La home pasa a ser una campaña (2026-09-23, T204 / F9.2)**. **Hero de campaña** con el primer
  banner dominante (imagen de fondo, degradado de contraste y tipografía display encima), **barra de
  beneficios** con dato real (envío con costo y umbral de envío gratis de la ciudad + días hábiles,
  medios de pago del checkout, garantía que publica el ERP por artículo), **ofertas en carril
  horizontal**, **categorías visuales** (imagen del ERP si existe y, si no, el placeholder de la
  tienda + conteo), **banda de envío** con el degradado de marca y orden nuevo (hero → beneficios →
  ofertas → categorías → destacados → banda → franja). **Medido**: `typecheck` 0, `lint` 0/0,
  `build` 0 y **E2E 24/24** con capturas de home en claro y móvil 390 px en oscuro. **Declarado**: el
  canal **no publica imágenes de categoría** (medido: 0 de 15) y más piezas de campaña exigen más
  banners en el ERP (slot `home-hero`).

- **La tienda estrena capa visual propia (2026-09-23, T203 / F9.1)**. Decisiones **D22–D26**
  aprobadas por el usuario (retail tecnológico premium · tema de tienda propio encima de los tokens
  · placeholder de imagen propio · tipografía self-hosted · seis fases + modo oscuro + gate visual
  propio). **(1)** Inter **self-hosted** con gate propio (`scripts/sync-fonts.mjs` copia los ocho
  `.woff2` del ERP, 521 KB, y `sync:fonts:check` compara hash; `fonts.css` usa `@font-face` +
  `unicode-range`). **(2)** **Capa de marca** `src/styles/brand.css` con `--sf-*` (acción, promoción,
  descuento, precio, superficies de imagen, formas, elevación y escala de títulos) para claro y
  oscuro, más la capa de componentes de la tienda en `globals.css` y el mapeo en `tailwind.config.ts`
  (`primary`/`fg.accent` → marca de la tienda), **sin tocar `tokens.css`**. **(3)** **Modo oscuro**
  con script sin destello e islote `theme-toggle` (preferencia local del comprador). **(4)**
  **Placeholder de imagen propio (D24)**: medido que los 104 `Item.imageUrl` y 324 `ItemImage.url`
  son `picsum.photos`, la tienda ya no pinta fotos aleatorias (fondo neutro + halo + monograma +
  marca) y el arte de campaña del CMS sí se pinta. **(5)** Cascarón nuevo (cabecera translúcida con
  marca, buscador integrado, ciudad, tema y carrito protagonista; navegación con `aria-current`; pie
  de cuatro columnas), componentes base y tarjeta de producto migrada. **Medido**: `typecheck` 0,
  `lint` 0/0, `build` 0 (First Load JS compartido 87,1 kB), `sync:tokens:check` y `sync:fonts:check`
  OK y **E2E 24/24**.

- **Histórico (F1–F8, 2026-09-22/23)**: la tienda nace con el **canal público del ERP** (T188/F1:
  maestros de marca, galería, ficha técnica, oferta de catálogo con vigencia, ciudad como config del
  canal, CSRF del canal y matriz artículo-almacén), el **checkout de invitado, la confirmación y el
  seguimiento público** (T191/T192: la tienda respeta y muestra el descuento del ERP y el estado del
  pedido se deriva en vivo de su documento), la **referencia del pago offline** y el **barrido de
  pedidos abandonados** (T193/T194), la **bandeja de pedidos web** del back office (T195/F5), el
  **desglose fiscal** por capas con su tasa (T197, T200), el **motor único de precios** con paridad
  entre pedidos, POS y tienda (T198/T199/F8.1) y la **oferta visible** en el listado y el detalle del
  back office (T201). El detalle medido de cada entrega está en `AUDIT.md`.

### Added

- **Las ciudades publican la ubicación y el retiro de su sucursal (2026-09-25, T233 — Fase 2 #1)**. El canal ya tenía en la sucursal el teléfono, el horario, las coordenadas, el mapa y `pickupEnabled` (campos de T188 que la semilla cargaba), pero **no los publicaba**: `/sucursales` solo podía mostrar el nombre, el código y la dirección — de ahí que no hubiera mapa ni horario. **Medido antes**: el canal devolvía `branch: {id, code, name, address}` y la tienda no leía ningún campo más. Ahora `GET /storefront/cities` publica la **ubicación completa** de la sucursal y `/sucursales` la pinta: **horario de atención**, **teléfono** (enlace `tel:`), **«Ver el mapa»** (`branch-map`, con el enlace que arma el ERP, sin construirlo aquí) y **«Retiro en tienda: disponible en esta sucursal»** (`branch-pickup`) cuando la empresa lo tiene habilitado. **Medido**: `e2e:visual` **17/17**, `e2e:a11y` **19/19**, `e2e:perf` **5/5**, `typecheck` 0, `lint` 0 avisos y `next build` 0 (14/14 páginas; `/sucursales` 181 B). **Declarado**: los campos son **opcionales** en el tipo a propósito — el fixture grabado del gate visual sirve un payload anterior a este cambio y la página no debe romperse por una clave que falta (la lección de T223) —; `/sucursales` todavía **no** entra en el barrido de axe ni en las capturas del gate visual (ninguna de las dos la lista), y el **selector de sucursal de retiro en el checkout** es el tramo siguiente (`WebCityBranch` en el canal + `pickupBranchId` en el pedido).

### Fixed

- **El gate visual medía con los datos de la corrida ANTERIOR: la caché de datos de Next sobrevive al arranque (2026-09-25, T230 — cierre de F6)**. Al regrabar el fixture del canal (`STORE_VISUAL_RECORD=1`) para que la ficha cubriera el **bloque de servicios** (T227) y el **formulario de servicio técnico** (T228), se midió que el fixture quedaba bien grabado (`canRequestService: true` y `services` con 1 servicio, comprobado en los 13 JSON que lo llevan) y que, aun así, **`producto-claro` seguía saliendo sin los dos bloques** mientras `producto-oscuro` —la segunda captura de la **misma** página— sí los pintaba. **Causa medida**: la tienda pide el canal con **ISR de datos** (`src/lib/erp.ts`: `REVALIDATE.product = 60`, catálogo 60 s, categorías 300 s…) y esa caché **vive en disco** (`.next/cache/fetch-cache`, **135** entradas medidas), así que **sobrevive** al `next start` de cada corrida; con una entrada caducada Next sirve la copia vieja mientras revalida en segundo plano (`stale-while-revalidate`), de modo que la **primera** visita a una ruta de cada corrida se pinta con los datos de la **anterior** y la **segunda** con los de ésta — y el fixture se grababa igual, porque la revalidación sí sale a la red. El gate daba por buena, pues, una pantalla con los datos de la corrida anterior: justo lo que el fixture existe para evitar. **Arreglo**: `e2e/visual/reset-data-cache.mjs` vacía esa caché antes de `next start` (lo llama el `webServer` de `playwright.visual.config.ts`); dentro de la corrida la caché sigue funcionando y no molesta, porque el fixture es inmutable mientras dura. **Medido (A/B)**: antes del arreglo, tras regrabar el fixture se regeneraron **2** capturas (`inicio-oscuro` y `producto-oscuro`, las **segundas** de cada página) y `producto-claro` no; después, **3 más** (`inicio-claro`, `categoria-claro` y **`producto-claro`**), y la ficha clara ya publica **«Súmale un servicio»** (Garantía extendida 12 meses, Bs 199,00) y el **formulario de servicio técnico**. **Medido**: `e2e:visual` **17/17** en comparación (con **5** capturas regeneradas y revisadas una por una), `e2e:a11y` **19/19** (el barrido de la ficha ya incluye los dos bloques, sin hallazgos de axe), `e2e:perf` **5/5** (el presupuesto se cumple también con la caché fría), `typecheck` 0, `lint` 0 avisos, `sync:tokens:check` y `sync:fonts:check` OK y `next build` 0. **Declarado**: el fixture queda regrabado contra el seed vivo, así que las capturas llevan los datos de hoy (la ficha pasa de `Disponible: 13` a `Disponible: 100` y suma reseñas) — es lo que el gate espera: un fixture **inmutable**, no un seed congelado—; el presupuesto de rendimiento mide ahora con la caché de datos fría (mismo presupuesto, medido) y las capturas siguen siendo de `win32`.

- **El menú de categorías del encabezado se abría recortado y no se veía (2026-09-23, T209)**. Lo
  reportó el usuario: al pulsar una categoría con subcategorías el menú «se despliega dentro de su
  contenedor y no se puede visualizar». **Medido con una sonda** (`Celulares`, la primera de las
  **3** raíces con hijas): la fila de categorías es un carril con scroll horizontal
  (`overflow-x-auto`, porque las raíces no caben: `scrollWidth 1688` contra `clientWidth 1280`) y en
  CSS **`overflow-x: auto` obliga a `overflow-y: auto`**, así que el panel del `<details>`
  (`position: absolute`, `z-index 200`) quedaba recortado por la caja del carril: **110 px de sus
  108 px de alto** caían fuera — **0 px visibles**. El panel deja de vivir dentro del carril y pasa a
  ser **hermano** suyo, anclado a la barra (`absolute inset-x-0 top-full`), así que **ningún ancestro
  con scroll lo recorta** (medido después: alto visible **121 px de 121 px** y `elementFromPoint` en
  su centro devuelve el panel, antes devolvía el hero). El disparador pasa de `<summary>` a
  **enlace + botón** con `aria-expanded` y `aria-controls` (el IDREF solo mientras el panel existe,
  porque uno colgado lo marcaría el gate de accesibilidad), de modo que sin JavaScript el enlace a la
  categoría y `/categorias` siguen funcionando. El `▾` tipográfico pasa a **icono SVG** (era
  ilegible y contaba como nodo de contraste no medible), el panel es un **menú ancho** con el árbol
  del ERP («Todo en X» + cada hija con su conteo), **Escape** cierra y devuelve el foco, el clic
  fuera y la navegación lo cierran, y **`ArrowDown` entra al panel**. **Evidencia**: **2 casos E2E
  nuevos** (`e2e/navegacion.spec.ts`; la suite funcional pasa de 27 a **29/29**) —uno mide que nada
  recorta el panel intersectando las cajas de recorte de sus ancestros (con el marcado anterior da
  0 px y falla) y otro el recorrido de teclado—, `typecheck` 0, `lint` 0/0, `build` 0,
  `e2e:a11y` **17/17** (los nodos de contraste no medible bajan de 67 a 65), `e2e:perf` 5/5 y
  `e2e:visual` **15/15** con las capturas regeneradas por el cambio de encabezado.

- **El paso 3 cotizaba dos veces y podía pintar un error transitorio (2026-09-23, T208)**. Defecto
  **real** que destapó el fixture del gate visual (el E2E funcional no lo veía): al entrar al resumen,
  el checkout pedía **dos** cotizaciones al canal, la primera **sin comprador**
  (`{"cityCode":"SCZ","items":[...]}`) porque el correo seguía dentro del rebote de 400 ms y el valor
  con rebote era el vacío, y la respuesta de esa primera podía pintar un error antes de la buena. La
  cotización espera ahora a que el correo deje de cambiar (`quoteEmail === buyer.email.trim()`).
  **Medido**: de 2 peticiones sin grabación en el fixture a **0**, y el E2E funcional sigue 27/27.

- **Doce de diecisiete pantallas incumplían el contraste AA (2026-09-23, T208)**. La primera corrida
  de la auditoría de accesibilidad midió ocho pares por debajo del mínimo: `#ffffff` sobre `#ea580c`
  **3,55:1**, `#ffffff` sobre `#fdba74` **1,68:1**, `#15803d` sobre `#0a0a0f` **3,93:1** y sobre
  `#052e16` **2,97:1**, `#6e7089` sobre `#0a0a0f` **4,08:1** (75 nodos) y sobre `#12121a` **3,85:1**,
  `#16a34a` sobre `#ffffff` **3,29:1** y `#8a8ca8` sobre `#172554` **4,47:1**. Se corrige **en la capa
  de marca**, sin tocar `tokens.css` (su gate sigue verde): la etiqueta de promoción estrena un par
  propio por tema (`--sf-promo-badge` / `--sf-promo-contrast`: `#c2410c` con blanco **5,18:1** y
  `#fdba74` con tinta oscura **11,71:1**), el verde de precio usa `--success-700` —la escala semántica
  de LUNA **se invierte** en oscuro, así que el mismo token da `#15803d` **5,02:1** en claro y
  `#6ee7b7` **12,96:1** en oscuro—, el `ok` de Tailwind apunta a ese token y el tema oscuro **sube sus
  dos grises de texto** (`--text-secondary` `#a1a3b8`, `--text-tertiary` `#9ca3af`). **Medido después:
  17/17 pantallas sin hallazgos** y `audit:contrast` 34/34. **Declarado**: el back office conserva los
  tokens oscuros de LUNA con el mismo defecto medido (fuera del alcance de D22–D26).

- **Los artefactos del gate visual no se versionaban (y tampoco los scripts de la tienda)
  (2026-09-23, T208)**. Defecto de **repositorio** medido con `git ls-tree` y `git check-ignore`: los
  comodines globales del `.gitignore` de la raíz (`*.png`, `*.json` y `scripts/`) se tragaban en
  silencio las **15 capturas de referencia** (Playwright las habría reescrito en cada corrida: el gate
  no vigilaba nada), las **30 respuestas grabadas** del fixture (sin ellas, en un clon limpio el
  fixture responde 599 y el spec visual falla) y `scripts/audit-contrast.mjs` —y de paso se descubrió
  que `sync-tokens.mjs` y `sync-fonts.mjs` **nunca** habían entrado al repositorio—. Se añaden las
  excepciones con el mismo criterio con el que ya se versiona el smoke del MCP: la tienda no es un
  repo anidado (`/backend-erp` y `/erp-frontend` sí lo son), así que sus artefactos hay que
  exceptuarlos a mano.

- **El carrito mostraba un estado vacío que el comprador no tenía (2026-09-23, T207)**. El HTML del
  servidor de `/carrito` traía «Tu carrito esta vacio» (el store rehidrata después del montaje) y el
  comprador con carrito veía un parpadeo; ahora hay guarda de rehidratación con el esqueleto de la
  forma real. La carga se comprueba **sin JavaScript** en el E2E: la primera pintada es el esqueleto.

- **El arnés del E2E estaba rojo en HEAD desde T200 (2026-09-23, T203)**. `npm run typecheck` fallaba
  por `ApiOrder.shippingItemId`, un campo que T200 publicó y el tipo del arnés no declaraba; Playwright
  transpila sin comprobar tipos, así que el cierre de T200 lo anotó en 0 sin serlo.

- **Histórico (T191–T206)**: el ERP **re-preciaba** los pedidos de la tienda (el comprador veía un
  precio y pagaba otro, con impuesto negativo en el desglose; T191/T192), la confirmación servía el
  pedido **anterior** por una caché de 30 s al anotar la referencia del pago (T193), la base del
  porcentaje se tomaba del subtotal ya descontado y el flete entraba en ella (T197/T200), la ficha
  técnica pasó a **una tabla por grupo** y el E2E dejó de resolver a varios elementos en modo estricto
  (T206) y `getByTestId('specs-table')` se contaba con un selector CSS. El detalle está en `AUDIT.md`.
