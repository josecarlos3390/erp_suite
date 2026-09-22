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
│                          │ ─────► │  /api/storefront/*   (canal público)      │
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

