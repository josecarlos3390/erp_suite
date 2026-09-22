# Plan — E-commerce (storefront público) sobre el ERP

> **Estado: APROBADO en sus decisiones (D1–D6, 2026-09-22) — listo para ejecutar F1.**
> El usuario eligió las seis recomendaciones (Next.js headless, carrito en la tienda con el
> pedido en el ERP, identidad `WebCustomer`, pagos offline primero, MVP de catálogo a
> seguimiento, y factura en la entrega). No hay código ni migraciones todavía: este documento
> mide lo que ya existe, fija la arquitectura y desglosa F1. Base: el prompt de referencia
> (e-commerce de electrodomésticos tipo Dismac.com.bo) y lo que el repo **ya tiene**.

## §0 Lo que ya tenemos (medido en el repo, no supuesto)

| Activo | Evidencia |
|---|---|
| **Multi-tenant con slug de subdominio** | `Tenant.slug` (`schema.prisma:26`) — «usado en subdominio y JWT» |
| **Backend modular** | **111** módulos en `backend-erp/src` (items, price-lists, special-prices, stock, POS, partners, branches, warehouses, sales-orders, delivery-orders, sale-invoices, payments, reports, settings, billing…) |
| **Catálogo** | `Item` (`:1387`) con `code`, `name`, `description`, `price`, `cost`, `currency`, `weight`, `canBeSold`, `status`, `taxable`, ICE, `groupId` (grupos), `manufacturer`, **`imageUrl` (una sola imagen)**, `customFields` (UDF) |
| **Precios** | `PriceList` (`:779`), `PriceListItem` (`:807`), `PriceListItemScale` (`:827`), `SpecialPrice` (`:875`), `ItemPriceHistory` |
| **Stock y trazabilidad** | `Stock` por (artículo, almacén) (`:2457`), `StockBatch` (lote), `SerialNumber` |
| **Clientes y direcciones** | `Partner`, `PartnerGroup`, `PartnerAddress` (`:1119`) |
| **Flujo comercial** | `SalesOrder` (`:3675`, **`partnerId` obligatorio**, `status`, `deliveryStatus`, `invoiceStatus`, `currency`, `exchangeRate`, `customFields`) → `DeliveryOrder` (`:3856`) → `SaleInvoice`/`SaleReserveInvoice`; devoluciones y NC/ND |
| **Cobranza y cuotas** | `PaymentTerm` (`:3376`), `Installment` (`:3431`), `IncomingPayment`, conciliación bancaria |
| **POS** | `PosTerminal` (`:8119`), `PosSession` (`:8138`) y módulos `pos`, `pos-sessions`, `pos-terminals` |
| **Series por sucursal** | `DocumentSeries.branchId` (T50) → una serie nueva para el canal web es trivial |
| **API pública (patrón)** | decorador `@Public()` (`src/auth/public.decorator.ts`) y `ThrottlerGuard` (login **5/min**, `auth.controller.ts:34`) |
| **Planes por tenant** | módulo `billing` + `SubscriptionGuard` → la tienda puede depender del plan |
| **Auditoría y alertas** | `audit-logs`, `alerts`, `settings` (clave/valor por tenant) |
| **Frontend** | Angular 19 **con SSR**, **100** páginas, **29** componentes LUNA, y una capa de **tokens en capas** (`src/styles/tokens/_01-primitives.scss` … `_05-layout.scss`) con densidad y temas |

**Lo que NO existe (huecos medidos)**: campos web en el artículo (`webSlug`, `images[]`,
`webDescription`, `isOnline`, badges, specs), **categorías web**, **cliente web**
(identidad pública), **carrito**, **pedido web con seguimiento y clave idempotente**,
**CMS de banners/páginas**, **envío de correo** (no hay `nodemailer` ni `MailerService`
en el backend), pipeline de imágenes y **SEO/structured data**.

## §1 Arquitectura propuesta (recomendación)

**Tienda headless como app propia + «API de canal tienda» pública en el ERP.**

```
┌──────────────────────────┐        ┌───────────────────────────────────────────┐
│  storefront/ (Next.js)   │        │  ERP (NestJS + Postgres)                  │
│  público, SEO, ISR/CDN   │  HTTPS │                                           │
│                          │ ─────► │  /storefront/*   (canal público)          │
│  catálogo · carrito      │  API   │   · catálogo publicado, categorías,       │
│  checkout · cuenta       │  key   │     precios de la lista web, stock por    │
│  seguimiento             │  por   │     ciudad/almacén, sucursales            │
│                          │ tenant │   · POST pedido (idempotente)             │
│  BD propia (carrito,     │ ◄───── │   · estado del pedido (proyección)        │
│  sesiones, CMS cache,    │        │                                           │
│  analítica)              │        │  Back office: el ERP tal como está hoy    │
└──────────────────────────┘        │  (pedidos, stock, factura, cobros, POS)   │
                                    └───────────────────────────────────────────┘
```

> **Ruta real de la API (medido el 2026-09-22, F1)**: el ERP **no** monta un prefijo
> `/api` —`src/main.ts` no llama a `setGlobalPrefix` y el frontend apunta a
> `http://host:3001` (`environment.ts`); en producción, a la URL de Railway sin
> sufijo—, así que la tienda llama **`/storefront/…`**. El arnés E2E
> (`test/test-utils.ts`) sí monta la app bajo `/api`, y por eso los specs escriben
> `/api/storefront/…`: es una diferencia **del arnés**, no del despliegue.

- **La tienda no toca la BD del ERP**: solo el canal. El ERP sigue siendo la **fuente de
  verdad** de catálogo, precios, stock, pedidos, factura y cobranza.
- **El ERP es el panel de administración** (artículos, precios, stock, pedidos,
  publicaciones web, banners). No se construye un segundo back office.
- **Aislamiento**: el tráfico público (bots, picos) nunca entra al ERP autenticado ni a su
  pool de conexiones; el canal es de solo lectura + un POST de pedido, con caché y límites.

### Alternativas evaluadas

| Opción | Veredicto |
|---|---|
| **A. Next.js headless + API de canal** (recomendada) | Mejor SEO/CWV, despliegue y caché independientes, un solo código para N tenants por host, sin acoplar el back office |
| B. Reutilizar el frontend Angular del ERP (SSR) para la tienda | Se descarta como **tienda**: el shell es autenticado y de back office, ~1,3 MB inicial, componentes densos (tablas/formularios) y el despliegue quedaría acoplado; **sí se reutiliza su capa de tokens** |
| C. SaaS tipo Shopify + sincronización | Se descarta como **sistema de verdad**: duplica catálogo/stock, y **no** cubre lo que sí es nuestro valor (factura boliviana con ICE/NIT, QR/transferencia, pago en sucursal, cobranza y cuotas del ERP). Un PSP se usa **solo** para tarjeta |
| D. Todo dentro del ERP (carrito y pedido en la misma app/BD) | Se descarta: mete tráfico anónimo y de alta escritura en la BD contable y ata el despliegue público al del ERP |

## §2 Qué se reutiliza, qué es nuevo y qué no se toca

**Se reutiliza (contratos del ERP, sin reimplementar reglas)**: `Item` + `PriceList`/`SpecialPrice`
(precio de la lista web y ofertas), `Stock` por almacén (stock por ciudad), `Branch`/`Warehouse`
(sucursales y retiro en tienda), `Partner`/`PartnerAddress` (cliente web ↔ tercero),
`SalesOrder` → `DeliveryOrder` → `SaleInvoice` (el pedido web entra al flujo normal),
`IncomingPayment` + conciliación (pagos offline), `PaymentTerm`/`Installment` (cuotas),
`TaxIndicator`/ICE (fiscalidad), `DocumentSeries` (serie del canal), `settings` (config de la
tienda), `audit-logs`, `billing` (planes), `@Public()` + throttling (patrón del canal).

**Es nuevo (backend)**: campos/tabla web del artículo, **categorías web**, **cliente web**
(identidad pública), **carrito** (si se sirve desde el ERP), **pedido web** (`WebOrder` con
número público, `trackingCode`, `paymentStatus`, `deliveryType`, `guestEmail`, idempotencia),
**CMS ligero** (banners/landings/servicios), **correo transaccional**, **reserva de stock con
TTL** al confirmar y **API de canal** (endpoints + API key por tenant + CORS por dominio + caché).

**Es nuevo (tienda)**: la app Next.js completa (home, categorías, ficha, búsqueda, carrito,
checkout multi-paso, cuenta, seguimiento, sucursales), su kit de componentes y su BD de
carrito/sesión/CMS cache.

**No se toca**: el motor contable, el kardex, la facturación, el POS presencial ni las reglas
de determinación de cuentas. La tienda **no** escribe asientos ni stock: **crea pedidos**.

## §3 Diseño: LUNA para el back office, tokens compartidos para la tienda

- **LUNA sigue siendo el design system del ERP** (densidad, tablas, formularios).
- **La tienda reutiliza la capa de tokens** (`_01-primitives` → `_05-layout`) exportada como
  **CSS variables** y define su **propia capa de componentes** (tarjeta de producto, galería,
  filtros, pasos de checkout, drawer del carrito). Los componentes de back office
  (`luna-data-table`, `luna-document-lines`, `luna-entity-select`, `luna-form-field-row`) **no**
  se usan en la tienda: son de operación densa, no de compra móvil.
- **Tema por tenant**: la paleta del prompt (rojo/amarillo) es un **tema configurable**, no
  código: `settings` del tenant → variables CSS de la tienda.
- **Presupuesto propio de tienda**: mobile-first, Core Web Vitals, imágenes responsivas,
  accesibilidad y `structured data` (Product/Offer/BreadcrumbList) — nada de eso se hereda del ERP.

## §4 Datos: mínimos para que la tienda sea real

1. **Publicación del artículo** (tabla satélite 1:1 `ItemWeb` o campos en `Item`, a decidir):
   `isPublished`, `slug` (único por tenant), `title`, `shortDescription`, `longDescription`,
   `images[]`, `badges[]`, `specs` (Json), `seoTitle`, `seoDescription`, `isOnlineOnly`,
   `deliveryDays`, `webSortOrder`, `sellerId?`.
2. **Categorías web** propias (`WebCategory`, árbol) + mapeo artículo → categoría web
   (`ItemWeb.webCategoryId`), **independiente** de los grupos contables (`ItemGroup`).
3. **Ciudades de tienda** (`WebCity`): ciudad → sucursal/almacén, costo y plazo de entrega,
   umbral de envío gratis, stock visible. Es lo que hace que «stock y precios por ciudad» sean reales.
4. **Cliente web** (`WebCustomer`): email único por tenant, hash/OTP, nombre, teléfono,
   `partnerId?` (enlace al tercero cuando exista). Direcciones: `WebAddress` (o `PartnerAddress`
   si hay partner).
5. **Pedido web** (`WebOrder` + `WebOrderItem`): `orderNumber` público, `salesOrderId?`,
   `status`, `paymentStatus`, `paymentMethod`, `deliveryType` (home|store), `webCityId`,
   `guestEmail`, totales **congelados**, `trackingCode`, `idempotencyKey`, y las fechas.
   El pedido confirmado **crea el `SalesOrder`** del ERP (así el stock, la entrega, la factura
   y la cobranza siguen el camino auditado) y la tienda lee su estado del ERP.
6. **CMS ligero**: `WebBanner`/slots, `WebPage` (servicios, legales), y la configuración de la
   tienda por tenant (dominio, ciudades activas, métodos de pago, WhatsApp, envío).
7. **Carrito**: si se sirve desde la tienda, `Cart`/`CartItem` viven **fuera** del ERP
   (decisión D2). El carrito **no reserva stock**; la reserva ocurre al confirmar el pedido, con TTL.

## §5 API del canal tienda (pública, por tenant)

- **Resolución de tenant por host** (`tienda.<slug>` o dominio propio) + **API key** de la
  tienda (una por tenant, rotable) y **CORS restringido** a los dominios del tenant.
- **Solo lectura** salvo el pedido: `GET catálogo`, `GET categoría`, `GET ficha` (por slug),
  `GET búsqueda`, `GET ciudades`, `GET sucursales`, `GET cuotas`, `POST pedido` (idempotente),
  `GET pedido?order=&email=` (seguimiento público), `POST contacto/WhatsApp`.
- **Caché y límites**: ETag/`Cache-Control` + caché en la tienda (ISR) y límite por IP/tenant
  (el throttler del ERP existe; el canal tendrá su propia política, **distinta** del login 5/min).
- **Nunca** expone costos, márgenes, stock exacto de otros almacenes, datos de terceros ni el
  API del ERP autenticado.

## §6 Pagos y fiscalidad (Bolivia)

| Método | Cómo | Fase |
|---|---|---|
| Transferencia / QR con comprobante | Pago **offline**: el pedido queda `PENDING` y el cobro se registra en el ERP (ya existen `IncomingPayment` + conciliación) | MVP |
| Pago en sucursal / contra-entrega | Retiro o entrega con cobro en caja (**POS ya existe**) | MVP |
| Tarjeta crédito/débito | **PSP** (MercadoPago / PagosNet / Libélula u otro local) con *hosted fields* o redirección: **nunca** se tocan datos de tarjeta (PCI SAQ-A) | Fase 2 |
| Cuotas («MiniCuotas») | Mostrar `total / N` (informativo) al inicio; si es financiamiento de terceros es un producto con contrato propio; «cuotas sin interés» del comercio se modela con `PaymentTerm` del ERP | Fase 2 |
| Factura | El pedido web **no** factura solo: entra al flujo del ERP (`SalesOrder` → entrega → factura), con serie propia del canal | MVP para pedido; factura en F3/F4 según D6 |

## §7 Fases (propuesta)

| Fase | Alcance | Criterio de aceptación (medible) |
|---|---|---|
| **F0** | Este plan + decisiones D1–D6 | Plan aprobado por el usuario |
| **F1 — Modelo y canal** | Migraciones (`ItemWeb`, `WebCategory`, `WebCity`, `WebCustomer`, `WebOrder`, CMS), serie web, `@Public()` del canal, API key + CORS + throttling + caché, y el **seed de tienda** (15 categorías, sub-categorías, 100+ productos, 10 marcas, 2 ciudades) | `npm test` verde, gates del repo (lint/money/line-accounts) en 0, suite E2E nueva del canal **verde**, y una sonda medida: `GET` catálogo devuelve N productos publicados con precio web y stock por ciudad |
| **F2 — Tienda MVP (catálogo)** | Home, mega menú, listado con filtros/orden, ficha, búsqueda, selector de ciudad, drawer y página de carrito | `e2e:functional` de la tienda verde + **Lighthouse/CWV** dentro del presupuesto en móvil |
| **F3 — Checkout y pedido** | Checkout multi-paso (guest y con cuenta), entrega/retiro, métodos offline, `POST pedido` idempotente, confirmación, **seguimiento público**, correo | Pedido medido de punta a punta: tienda → `WebOrder` → `SalesOrder` del ERP → estado visible en el seguimiento; **stock reservado y liberado con TTL** |
| **F4 — Cuenta del cliente** | Registro/login, perfil, direcciones, historial y detalle de pedidos | Historial del cliente cuadra con los pedidos del ERP |
| **F5 — Merchandising y servicios** | Banners con contador, «Elige Bien», carruseles, garantías/servicios, sucursales con mapa, WhatsApp | Admin en el ERP publica un banner y la tienda lo muestra sin desplegar código |
| **F6 — Fase 2 del prompt** | Wishlist, comparador, reviews, garantía extendida e instalación como productos, buscador de servicio técnico, vendedores/marketplace | Cada uno con su suite y su gate |
| **F7 — Pagos y fiscal** | PSP de tarjeta, cuotas, factura electrónica del canal, conciliación y reportes de tienda | Cobro con PSP conciliado en el ERP; factura del pedido emitida con la serie del canal |

## §8 Huecos y riesgos declarados

1. **`SalesOrder.partnerId` es obligatorio** → el checkout *guest* necesita un tercero
   «Consumidor Final Web» por tenant (o el pedido vive en `WebOrder` hasta que se confirma el pago).
2. **No hay correo transaccional** en el backend: hace falta proveedor (SMTP/SES/Resend) y plantillas.
3. **Una sola imagen por artículo** y sin `slug`: el catálogo web necesita campos nuevos y un
   pipeline de imágenes (Cloudinary/S3) con `next/image`.
4. **No hay CMS**: banners, landings y páginas de servicio son trabajo nuevo.
5. **Reserva de stock**: el ERP tiene `stockCommitted/quoted`; el carrito **no** debe reservar.
   La reserva del pedido web necesita TTL y liberación explícita.
6. **Marketplace/vendedores** no existe como tal (hay proveedores y `defaultVendorId`): «Vendido
   por X» es fase 2.
7. **SEO/rendimiento** son responsabilidad de la tienda (ISR/CDN): el ERP no debe servir tráfico público directo.
8. **Seguridad**: identidad pública separada, sin cookies del ERP, sin exponer la BD del ERP, y
   **PCI** fuera de alcance por diseño (PSP con hosted fields).
9. **Doble escritura**: el pedido web y el `SalesOrder` se crean en **una** transacción del ERP
   (idempotente por `idempotencyKey`); la tienda nunca corrige el pedido por su cuenta.

## §9 Decisiones tomadas (D1–D6, aprobadas el 2026-09-22)

| # | Decisión | Elegido |
|---|---|---|
| **D1** | Stack de la tienda | **Next.js 14 App Router + TypeScript + Tailwind + Zustand** en `storefront/`, app separada en el monorepo; reutiliza los **tokens** del ERP (CSS variables) y deja LUNA para el back office |
| **D2** | Dónde viven carrito y pedido | **Carrito en la tienda** (su BD/Redis) y **pedido en el ERP**: `WebOrder` + `SalesOrder` en una transacción idempotente |
| **D3** | Identidad del cliente | **`WebCustomer` propio** (email + password/OTP, JWT de tienda) **enlazado a `Partner`** cuando exista; *guest checkout* soportado |
| **D4** | Pagos del MVP | **Offline primero**: transferencia/QR con comprobante, pago en sucursal/retiro y contra-entrega, conciliados con `IncomingPayment`; **tarjeta con PSP en F7** |
| **D5** | Alcance de la primera entrega | **Catálogo + ficha + carrito + checkout guest + pedido + seguimiento + selector de ciudad**; cuenta completa en F4, wishlist/comparador/reviews/marketplace en F6 |
| **D6** | Facturación | El pedido web **factura en la entrega** con el flujo normal del ERP (entrega → factura), con **serie propia del canal** |
| **D7** | Ciudades de la tienda (**A1**, aprobada el 2026-09-22) | **La ciudad es configuración del canal, no un maestro del ERP**: el ERP no tiene maestro de ciudades (`Partner.city` y `PartnerAddress.city` son texto libre, con `<luna-input>` en el formulario de terceros), así que `WebCity` es la **zona comercial de entrega** y guarda lo que el ERP resuelve por sucursal/almacén — **qué almacén** manda la existencia (`warehouseId`), **cuánto cuesta y tarda** el envío (`shippingCost`, `freeShippingFrom`, `deliveryDays`) y **desde dónde** se despacha (`branchId`, FK a los dos maestros). Una ciudad puede tener **varias** sucursales y compartir almacén; `branchId` es el **origen por defecto**. Alternativas descartadas: usar la sucursal como ciudad (una ciudad con 5 tiendas se volvería 5 «ciudades» y duplicaría el costo de envío) y crear un maestro `City` en el ERP (obliga a migrar el texto libre existente y a tocar el formulario de terceros para un maestro que hoy usarían 2 pantallas) |
| **D8** | Retiro en tienda en el MVP | **Fase 2**: el MVP aprobado (D5) envía a domicilio y el checkout no elige sucursal. El modelo **ya está listo** (los campos de retiro de `Branch`: `phone`, `openingHours`, `latitude`/`longitude`, `mapUrl`, `pickupEnabled`) y el vínculo **ciudad → sucursales de retiro** se agrega como tabla del canal cuando entre el retiro, sin cambiar los enlaces actuales |
| **D9** | Dónde vive el código de la tienda (arranque de F2) | **Dentro del repo raíz**, en `storefront/`, versionado junto a la documentación; cuando la tienda tenga su propio remoto se separa. Evita un repo anidado **sin remoto** al que no se pueda empujar (la regla del proyecto es empujar a todos los remotos) |
| **D10** | Cómo habla la tienda con el ERP | **Solo desde el servidor de Next** (Server Components y route handlers): la clave del canal **nunca llega al navegador** y no hace falta abrir CORS por dominio en el MVP (queda como estaba: declarado). El precio de la decisión: el navegador no llama al canal directamente, todo pasa por Next |
| **D11** | Bootstrap de la tienda | **npm** (como los otros dos proyectos) con **Next.js 14 App Router + TypeScript + Tailwind 3 + Zustand** (D1) y los **tokens del ERP compilados** por script (`storefront/scripts/sync-tokens.mjs`: `erp-frontend/src/styles/tokens/_0*.scss` → `storefront/src/styles/tokens.css`) con modo **`--check`** para que no se desincronicen: una sola fuente de verdad y un gate que lo comprueba |

## §10 F1 — desglose de trabajo (modelo y API de canal)

1. **Modelo (Prisma + migración idempotente)**: `ItemWeb` (1:1 con `Item`: `isPublished`,
   `slug` único por tenant, `title`, `shortDescription`, `longDescription`, `images` Json,
   `badges` Json, `specs` Json, `seoTitle`, `seoDescription`, `isOnlineOnly`, `deliveryDays`,
   `webSortOrder`, `sellerId?`), `WebCategory` (árbol + `parentId`), `WebCity`
   (ciudad → `branchId`/`warehouseId`, `shippingCost`, `freeShippingFrom`, `deliveryDays`),
   `WebCustomer` (+ `WebAddress`), `WebOrder` + `WebOrderItem` (número público, totales
   congelados, `idempotencyKey`, `trackingCode`, `guestEmail`, `deliveryType`, `paymentMethod`,
   `paymentStatus`, `webCityId`, `salesOrderId?`), `WebBanner`, `WebPage`.
2. **Serie del canal**: tipo nuevo en el catálogo canónico de series (prefijo tipo `WEB`) y en el
   arranque operativo del seed.
3. **Módulo `storefront` del backend**: controladores `@Public()` (catálogo, categorías, ficha
   por slug, búsqueda, ciudades, sucursales, cuotas, `POST` pedido, seguimiento), guardia de
   **API key por tenant** + resolución por host, **CORS por dominio del tenant**, política de
   **throttling propia** (distinta del login 5/min), caché (`ETag`/`Cache-Control`) y
   `audit-logs` del canal. Nunca expone `cost` ni datos de otros almacenes.
4. **Pedido**: `POST` idempotente por `idempotencyKey` que crea `WebOrder` + `SalesOrder`
   (partner «Consumidor Final Web» para *guest*, o el `Partner` del cliente) y **reserva stock
   con TTL**; liberación explícita y anulación.
5. **Seguridad de datos**: proyección pública sin costos/márgenes, sin cookies del ERP, y el
   canal como único puente (la tienda no abre conexión a la BD del ERP).
6. **Seed de tienda**: 15 categorías + sub-categorías, 100+ productos con precios en Bs., 10
   marcas, 5 vendedores, 2 ciudades con stock diferenciado, 3 clientes web, banners de ejemplo.
7. **Pruebas y gates**: unitarios de servicios/guardias + `test/storefront-channel.e2e-spec.ts`
   (catálogo, ficha, búsqueda, stock por ciudad, pedido idempotente y doble POST sin duplicar,
   seguimiento público, 401 sin API key, 404 de otro tenant) y los gates del repo en verde
   (`npm test`, `lint`, `tsc`, `audit:money:check`, `audit:line-accounts`).
8. **Criterio de cierre de F1 (medible)**: con la API levantada, el canal devuelve el catálogo
   publicado con precio de lista web y stock por ciudad; `POST` de pedido crea `WebOrder` +
   `SalesOrder` y **un segundo POST con la misma clave no duplica**; el seguimiento público
   devuelve el estado sin autenticación; y la suite E2E del canal cierra en verde.

### §10.b Estado de F1 (medido el 2026-09-22, T188)

| Punto | Estado | Evidencia / desviación |
|---|---|---|
| 1. Modelo + migraciones | **Hecho** | 10 tablas + enum (`20260922180000_storefront_channel`), maestros que ganó el ERP (`Brand`, `ItemImage`, `ItemSpec`, `Seller`, oferta con vigencia, garantía, campos de retiro de `Branch`, dirección de entrega de `PartnerAddress`) en `20260922212644_storefront_masters` y FKs de la ciudad en `20260922213535_storefront_city_links`; `prisma validate` + `migrate status` en verde. `ItemWeb.images`/`specs` (Json) y `WebAddress` **retirados**: la galería y la ficha son maestro y las direcciones del cliente registrado son las del ERP |
| 2. Serie del canal | **Desviado a F7** | El pedido usa la serie de `SALES_ORDER`. Un `DocumentType` nuevo + arranque operativo pertenece al tramo que emite la **factura del canal** (D6); declarado en CHANGELOG |
| 3. Módulo y guardia | **Hecho** (salvo CORS/caché) | `GET catalog/categories/cities/products/:slug/products/:slug/related/tracking` + `POST orders`, `@Public()` + `StorefrontApiKeyGuard` (SHA-256 de `x-storefront-key`, el tenant sale de la **clave**, no del `Host`) + `@Throttle` 300/min. **Pendiente declarado**: `WebApiKey.allowedOrigins` existe pero el **CORS por dominio** y la **caché HTTP** (`ETag`/`Cache-Control`) todavía no se cablean; `audit-logs` del canal tampoco |
| 4. Pedido | **Hecho** (sin TTL) | `POST` idempotente que crea `SalesOrder` (sucursal y almacén de la ciudad, precio efectivo, IVA del motor de ventas) + `WebOrder`, con compensación (anular el pedido de venta) si la proyección falla. **Medido**: el pedido **compromete** existencia (`stockCommitted = 2`) y la libera al anularlo. **Desviado a F3**: la reserva con **TTL** para pedidos abandonados —el `SalesOrder` abierto compromete stock sin vencimiento— |
| 5. Seguridad de datos | **Hecho** | Proyección pública sin `cost` ni márgenes; sin cookies del ERP; el canal es el único puente. **Defecto medido y corregido**: el CSRF pedía el doble envío de cookie al `POST` público (403) — ahora el canal con clave por cabecera queda excluido como `Bearer` |
| 6. Seed de tienda | **Hecho** | `prisma/seed-storefront.ts`: 10 marcas, 5 vendedores, 4 grupos nuevos, 15 categorías raíz + 5 hijas, **2 ciudades** (SCZ y LPZ, con sucursal y almacén propios y stock distinto), **108 publicados** (104 de tienda + 4 del catálogo del ERP), 324 imágenes, 540 características, 3 banners, 2 páginas, 3 clientes web, clave del canal; `ensureMasterAccountsForTenant` corrido otra vez (443 matrices artículo-almacén) |
| 7. Pruebas y gates | **Hecho** | Unitarios **43/43** del canal (`189 suites / 2292 tests` en el backend) y `test/storefront-channel.e2e-spec.ts` **22/22**; `tsc`, `lint`, `build` en 0 |
| 8. Criterio de cierre | **Medido** | Sonda en vivo sobre la API de desarrollo con el seed real: `GET /storefront/catalog` → **108 publicados** (3 páginas con `limit=48`), **11 con oferta vigente** (precio = oferta, `discountPct` con signo), oferta **vencida** y **futura** con precio de lista y `salePrice = null`; por ciudad **SCZ 9/12/15 vs LPZ 5/7/9** y **20 sin existencia en La Paz**; 15 categorías raíz que suman 108; 2 ciudades con almacén y sucursal; ficha con 3 imágenes, 5 características y marca del maestro; `404` de producto inexistente y `401` sin clave o con clave inválida |

**Riesgos/huecos que abre F1** (a cerrar en F2/F3): CORS por dominio y caché del canal;
reserva con TTL y cancelación de pedidos abandonados; correo transaccional (no existe
proveedor en el backend); la tienda debe caer a un **placeholder local** cuando
`picsum.photos` no cargue (las imágenes del seed son un dato de desarrollo declarado);
y el checkout solo puede vender artículos que el ERP tenga **habilitados en la matriz
artículo-almacén** de la ciudad (medido: sin matriz, 400 accionable).

## §11 F2 — tienda MVP (catálogo) · desglose

Alcance de la fase (D5): **home, menú de categorías, listado con filtros y orden, ficha,
búsqueda, selector de ciudad y carrito**. Todo se consume **desde el servidor** (D10) y
la tienda escribe en el ERP **solo** por el canal público.

| # | Pieza | Contenido | Criterio medible |
|---|---|---|---|
| 1 | **Cierre de huecos del canal** (backend) | `GET /storefront/banners` (CMS de la home) y `GET /storefront/pages/:slug` (páginas de servicio) —el modelo y el seed ya existen pero **no se exponían**— y filtro **`brand`** en el catálogo (la ficha del producto ya publica la marca del maestro) | suite del canal **en verde** con los casos nuevos (banners ordenados por `slot`/`sortOrder`, página publicada y 404 de la no publicada, filtro por marca) |
| 2 | **Bootstrap de la tienda** | `storefront/` con npm, Next 14 App Router + TS + Tailwind 3 + Zustand, ESLint/Prettier alineados con el repo, `.env.example` (`ERP_API_URL`, `STOREFRONT_API_KEY`, `STOREFRONT_CITY`) y `next.config` con los dominios de imagen del seed | `npm run build` en 0 y `npm run lint` en 0 |
| 3 | **Tokens** | `scripts/sync-tokens.mjs` compila `_01-primitives` → `_05-layout` del ERP a `src/styles/tokens.css`; `--check` falla si están desincronizados; la tienda define su capa de componentes encima (LUNA **no** se usa en la tienda) | `sync-tokens --check` en verde y el CSS de la tienda servido desde la build |
| 4 | **Cliente del canal** | `src/lib/erp.ts`: fetch tipado al canal (`/storefront/...`, **sin** prefijo `/api`), con la clave **solo en el servidor**, `revalidate` por endpoint, errores tipados y `AbortSignal` con tope | un test unitario del cliente (URL, cabecera, timeout, error) en verde |
| 5 | **Shell + tema** | Header (logo, buscador, selector de ciudad, carrito), footer, navegación de categorías, y **tema por variables CSS** del tenant encima de los tokens | el shell renderiza en servidor y el tema sale de variables (sin hex en componentes) |
| 6 | **Home** | Hero con banners del canal, categorías destacadas, carrusel de ofertas (`salePrice` ≠ nulo), «lo más vendido» por categoría con stock de la ciudad | la home lista **las ofertas vigentes** que devuelve el canal y **no** las vencidas |
| 7 | **Categorías** | `/categorias` y `/categorias/[slug]` con filtros (marca, rango de precio, orden, paginación) y contadores del árbol | la categoría padre trae también lo de sus **subcategorías** (lo que ya mide el canal) |
| 8 | **Ficha** | `/productos/[slug]`: galería, ficha técnica, insignias, garantía, disponibilidad **de la ciudad**, relacionados, agregar al carrito | la ficha de la ciudad sin stock muestra «sin existencia» y **no** permite agregar |
| 9 | **Búsqueda** | `/buscar?q=` con el mismo listado y estado vacío accionable | la búsqueda por texto devuelve lo que devuelve el canal (medido en su suite) |
| 10 | **Carrito** | Estado **Zustand** persistido (localStorage) con precios de referencia de la tienda, drawer + `/carrito`; el precio que manda es el del **checkout** (el canal lo recalcula) | agregar/quitar/cambiar cantidad y que el total de la tienda **coincida** con el del canal al pedir |
| 11 | **Ciudad** | Selector de ciudad (cookie) que cambia la disponibilidad de todo el catálogo | cambiar de ciudad cambia la existencia mostrada (SCZ vs LPZ del seed) |
| 12 | **SEO** | `generateMetadata` por ruta + **JSON-LD** (`Product`/`Offer`/`BreadcrumbList`) y `sitemap.ts` desde el catálogo publicado | el HTML servido trae el JSON-LD del producto con precio y disponibilidad |
| 13 | **Gate de la tienda** | `storefront/e2e` con Playwright propio (`npm run e2e`) sobre `next start` + la API del ERP, arrancando de la BD sembrada | suite verde: home con productos, categoría con subcategorías, ficha, búsqueda, carrito y cambio de ciudad |

**Orden de ejecución**: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13, con los
gates del repo (backend `npm test`, `lint`, `tsc` y la suite del canal) y de la tienda
(`build`, `lint`, `e2e`) en verde en cada tramo que los toque.

