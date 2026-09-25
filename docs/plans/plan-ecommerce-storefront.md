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
   La reserva del pedido web necesita TTL y liberación explícita. **Resuelto con D14 + T196**: la
   existencia que retiene un pedido impago se libera por **antigüedad** (`webOrderTtlHours`, default
   48 h) con el `cancel` del flujo de ventas, disparado por el **barrido programado del backend**
   (03:30, por empresa con canal activo) o por el endpoint manual; el carrito sigue sin reservar.
6. **Marketplace/vendedores** no existe como tal (hay proveedores y `defaultVendorId`): «Vendido
   por X» es fase 2.
7. **SEO/rendimiento** son responsabilidad de la tienda (ISR/CDN): el ERP no debe servir tráfico público directo.
8. **Seguridad**: identidad pública separada, sin cookies del ERP, sin exponer la BD del ERP, y
   **PCI** fuera de alcance por diseño (PSP con hosted fields).
9. **Doble escritura**: el pedido web y el `SalesOrder` se crean en **una** transacción del ERP
   (idempotente por `idempotencyKey`); la tienda nunca corrige el pedido por su cuenta.

## §9 Decisiones tomadas (D1–D16)

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
| **D12** | Los precios de la tienda y los descuentos del ERP (**A**, aprobada el 2026-09-23) | **La tienda respeta el descuento automático del ERP y lo muestra**: la cotización corre el **mismo** motor (`resolveAutoDiscount`: grupo de artículos, acuerdo del tercero, precio especial de su lista) para el tercero del comprador y publica el descuento por línea; el alta manda el `%` **explícito**, así que lo cotizado y lo cobrado no pueden discrepar. Se descartó que la tienda fije su propio precio (`discountPct: 0`): el mismo artículo costaría distinto en la web que en el POS del ERP, que sí aplica el descuento. **Consecuencia declarada**: el descuento de empresa se **acumula** con la oferta de catálogo (`salePrice`), y el **flete** no participa (es un importe configurado por la ciudad) |
| **D13** | De dónde sale el estado del pedido (aprobada el 2026-09-23) | **Derivado en vivo del documento del ERP**: el canal lee el pedido de venta y sus cantidades entregadas/facturadas (`deliveredQty`/`invoicedQty`) y el estado del documento, y publica el estado del comprador **y** el estado crudo del ERP. Se descartó copiarlo a `WebOrder.status` (dos verdades que se desfasan) y una bandeja manual de pedidos web (más control comercial, pero puede contradecir al flujo). El **pago** se deriva de la factura del pedido |
| **D14** | Pedidos abandonados (**F3 #2**, aprobada el 2026-09-23) | **Cancelación por antigüedad**: una tarea (script invocable por cron, con el **plazo configurable por empresa**) anula los pedidos web **sin pago** más antiguos que el plazo usando el `cancel` del flujo de ventas, de modo que el stock comprometido se **libera** y el comprador ve `CANCELLED` (ya derivado del documento). Se descartó la reserva propia del canal con TTL (no comprometer stock hasta el pago): con pago **offline** el comprador puede tardar días y no se puede retener existencia tanto tiempo, y el stock agotado antes de pagar rompería la promesa de la cotización |
| **D15** | Comprobante del pago offline (**F3 #4**, aprobada el 2026-09-23) | **Referencia de pago escrita por el comprador**: el comprador anota el número de operación (y la fecha) de su transferencia/QR en la confirmación o el seguimiento, y el canal la guarda en la proyección (`WebOrder.paymentReference`) para que la conciliación del back office tenga el dato. Se descartó subir el **archivo** del comprobante: el ERP no tiene almacenamiento de archivos hoy, así que la decisión correcta es no inventar uno; la **conciliación** sigue en el ERP (`IncomingPayment`, D4) |
| **D16** | Correo transaccional (**F3 #5**, aprobada el 2026-09-23) | **Declarado, sin implementar ahora**: la confirmación en pantalla ya publica número y código de seguimiento y `/seguimiento` se consulta con el número (y el código de pedido). El backend **no tiene proveedor** de correo; se retoma cuando haya credenciales (SMTP por empresa o proveedor externo), y mientras tanto el hueco queda escrito |
| **D20** | La oferta de catálogo en los canales del ERP (**F8**, aprobada el 2026-09-23) | **Opción A: el ERP honra su oferta** (`Item.salePrice` dentro de su vigencia) en **sus** documentos y en el POS, resuelta en el punto único del precio de catálogo (`price-resolver.util.ts`) y **configurable desde el formulario de artículos** (hoy solo existe en el esquema). Así el mismo artículo cuesta lo mismo en un pedido manual, en el POS y en la web, y se cierra el hueco declarado en T188. Se descartó que la tienda deje de publicar la oferta: el mecanismo de oferta es del ERP, no de la web |
| **D21** | Descuento de catálogo **solo del canal** (**F8**, aprobada el 2026-09-23) | **Promo del canal configurable**: la publicación web del artículo (`ItemWeb`) gana `channelDiscountPct` + vigencia, que aplica **solo** el canal (ficha, cotización y pedido) como capa propia encima de la oferta de catálogo y antes del descuento de la empresa (D12); el POS y los pedidos del ERP **no** lo leen. Se configura en el back office (**Ventas → Tienda online → Promociones del canal**, permiso propio), así el negocio puede promocionar el ecommerce sin tocar el precio del resto de canales; **sin configurar, el precio es el mismo en todos los canales** |

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
| 3. Módulo y guardia | **Hecho** | `GET catalog/categories/cities/products/:slug/products/:slug/related/tracking` + `POST orders`, `@Public()` + `StorefrontApiKeyGuard` (SHA-256 de `x-storefront-key`, el tenant sale de la **clave**, no del `Host`) + `@Throttle` 300/min. **Cerrado en T216**: el **CORS por dominio** aplica `WebApiKey.allowedOrigins` (403 accionable a un `Origin` no declarado, unión de claves activas con caché de 60 s para el preflight y `X-Storefront-Key` en `allowedHeaders`), la **caché HTTP** declara `public, max-age=60, stale-while-revalidate=300` en las lecturas y `no-store` en el seguimiento y las escrituras (el `ETag`/`304` ya lo resolvía Express, medido) y el canal deja **rastro de auditoría** (`AuditLog`: `STOREFRONT_ORDER_CREATED` y `STOREFRONT_PAYMENT_REFERENCE`), que antes no escribía nadie |
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

### §11.b Estado de F2 (medido el 2026-09-22, T189)

| # | Pieza | Estado | Evidencia / desviación |
|---|---|---|---|
| 1 | Huecos del canal (banners, páginas, marcas, `onSale`, orden por precio, `listPrice`, faceta por categoría, índice de páginas) | **Hecho** | Tres tramos: F2.1 (CMS + marca), F2.2 (`onSale`) y F2.3 (**defecto real corregido**: el orden por precio usaba el de lista mientras publicaba el efectivo). Canal **55/55** unitarios y **29/29** E2E; sonda en vivo con orden monótono verificado |
| 2-5 | Bootstrap, tokens, cliente del canal, shell y tema | **Hecho** | `storefront/` con Next 14 + TS strict + Tailwind 3 + Zustand; `sync-tokens.mjs` (7 módulos del ERP → 621 líneas de CSS, `--check` en verde y probado en rojo); cliente **server-only** con tope de tiempo, `revalidate` por endpoint y errores tipados |
| 6-11 | Home, categorías, ficha, búsqueda, carrito, ciudad | **Hecho** | Home con banners vigentes y **ofertas por `onSale`**; categorías con filtros por URL y faceta de marcas **de la categoría**; ficha con galería, ficha técnica, disponibilidad por ciudad, relacionados y botón que no deja agregar sin existencia; `/carrito` (Zustand persistido, `skipHydration` + `CartHydration`) declara que el precio final lo fija el ERP (F3) |
| 12 | SEO | **Hecho** | `generateMetadata` + JSON-LD (`Product`/`Offer`/`BreadcrumbList`), `sitemap.ts` con **131** URLs (3 fijas + 20 categorías + 108 productos) y `robots.ts` |
| 13 | Gate de la tienda | **Hecho** | `storefront/e2e` (Playwright propio, `next start` en :3100, `actionTimeout` 30 s): **13/13** con **155** aserciones ejecutadas, contra la API del ERP en marcha |
| — | **Hallazgo de caché** | Declarado | La tienda cachea el canal **60 s** (`revalidate`): un cambio del canal se ve tras la ventana. Un E2E de la tienda falló por eso y pasó al reintentar (no era defecto). **T216** declaró esa **misma** ventana del lado del canal (`Cache-Control: public, max-age=60, stale-while-revalidate=300`) para que no haya dos relojes |
| — | **Huecos que quedan** | Declarado | Sin filtro por **rango de precio** (rompería la paginación si se hiciera en cliente); sin **datos de cuotas** (no se calcula `precio/6`; la insignia CUOTAS solo se muestra); las imágenes del seed siguen siendo `picsum.photos` (con **respaldo local** implementado); `NEXT_PUBLIC_SITE_URL` es de build (los canónicos de una build local apuntan a `localhost:3000`); checkout y seguimiento son F3 |

## §12 F3 — checkout, pedido y seguimiento · huecos medidos al cerrar F1/F2

F3 es «checkout multi-paso (guest), métodos offline, `POST` de pedido, confirmación,
seguimiento público y correo». La pieza de **alta de pedido del canal ya existe** desde
F1 (§10.b punto 4), así que F3 empieza por los huecos que el código de hoy **no** cubre,
medidos en `storefront.service.ts`:

| # | Hueco medido | Qué falta (decisión o trabajo) |
|---|---|---|
| 1 | **El canal no cobra el envío**: `createOrder` fija `shipping = 0` y `total = total del SalesOrder`, aunque `WebCity` ya publica `shippingCost` y `freeShippingFrom` | Calcular el envío por ciudad (y el envío gratis por umbral) y decidir **dónde entra** en el ERP: ¿gasto de cabecera / línea de servicio del pedido / solo en `WebOrder`? El `SalesOrder` tiene sus propios totales y el asiento de la venta no debe descuadrar → **decisión de producto** |
| 2 | **Reserva con TTL**: el `SalesOrder` abierto **compromete existencia sin vencimiento** (medido: `stockCommitted = 2`) | Cancelar automáticamente los pedidos abandonados (job por antigüedad + `salesOrders.cancel`) o reservar con TTL propio del canal; **decisión de producto** (plazo y si el carrito reserva) |
| 3 | **Quién mueve el estado del pedido**: `WebOrder.status` nace `PENDING` y **ninguna pantalla del ERP lo cambia** (el back office no tiene bandeja de pedidos web) | Decidir: (a) **derivar** el estado del flujo del ERP (sin entrega → `PENDING`; con entrega abierta → `SHIPPED`; con factura contabilizada → `DELIVERED`; `SalesOrder` anulado → `CANCELLED`) o (b) **bandeja de pedidos web** en el ERP que lo mueva a mano. La derivación no necesita pantalla nueva y es imposible de desincronizar; la bandeja permite estados comerciales que el ERP no tiene |
| 4 | **Pago offline sin comprobante**: no hay dónde guardar el comprobante de la transferencia/QR | Añadir a `WebOrder` (`paymentReference`, `paymentProofUrl`, `paidAt`) o dejar la conciliación **solo** en `IncomingPayment` del back office (D4); **decisión de producto** |
| 5 | **Correo transaccional**: el backend **no tiene proveedor** (no hay nodemailer) | Declarar el hueco o elegir proveedor (SMTP/SES/Resend) + plantillas; **decisión del usuario** |
| 6 | **`/checkout` no existe**: la tienda aún no tiene pasos, ni resumen, ni confirmación | Construir el checkout de invitado (datos, ciudad, entrega, método de pago, confirmación con número y código de seguimiento), con la clave del canal **solo** server-side (D10) |
| 7 | **Seguimiento**: el endpoint público existe (`GET /storefront/tracking?order=&email=`) | Página `/seguimiento` en la tienda con la línea de tiempo del estado y el detalle de líneas |

**Orden de ejecución de F3**: decidir 1–5 (con el usuario) → implementar el envío (#1) y la
cancelación por antigüedad (#2) con su E2E en el canal → estado del pedido (#3) → checkout
y confirmación en la tienda (#6) → seguimiento (#7) → **gate medido**: una compra de punta a
punta (tienda → `WebOrder` → `SalesOrder` del ERP) con el estado visible en el seguimiento y
el stock comprometido/liberado según el ciclo.

### §12.b Estado de F3.1 — el envío (medido el 2026-09-23, T190)

El hueco **#1** (el canal no cobraba el envío) se cerró **sin** tener que decidir el
tratamiento contable del flete: se convirtió en **configuración del ERP**.

- **`WebCity.shippingItemId`** (FK al maestro de artículos, migración idempotente
  `20260923013750_storefront_shipping_item`): la ciudad apunta al **artículo de servicio**
  con el que cobra el envío. Si no hay artículo, la ciudad **no** lo cobra.
- **`POST /storefront/quote`**: cotiza el carrito sin crear nada y con el **mismo**
  `resolveOrderDraft` que el alta, así que lo que ve el comprador y lo que se cobra no
  pueden discrepar. **No estima impuestos**: los aplica el ERP al documento.
- **El flete viaja como línea** del pedido del ERP (se factura y contabiliza con las reglas
  de la empresa, sin columnas nuevas en `SalesOrder`), y el desglose publicado es
  `subtotal` (mercancías) + `shipping` + `tax` = `total` (del documento).
- **Defecto real corregido de paso**: con `validateStockOnSalesOrder` encendido, una línea
  de **servicio** se rechazaba con «disponible 0» porque la guarda de stock no distinguía lo
  que no maneja inventario (A/B medido: 400 sin la guarda, 201 con ella).
- **Evidencia**: canal **57/57** unitarios, **31/31** E2E del canal, seed con `WEB-ENVIO` en
  las 2 ciudades y sonda en vivo (SCZ 1×129 → envío 20; LPZ 3×129 → envío 35; SCZ 2×2.699 →
  gratis por superar el umbral).
- **Sigue abierto en F3** (necesita decisión de producto): reserva con **TTL** (#2), **estado**
  del pedido (#3), **comprobante** offline (#4) y proveedor de **correo** (#5); y en la tienda,
  las pantallas de **checkout** (#6) y **seguimiento** (#7).

### §12.c Estado de F3.2 — el cobro y el estado del pedido (medido el 2026-09-23, T191/T192)

El checkout de la tienda (#6), la confirmación y el seguimiento (#7) están construidos y
medidos (T190 cerrado con el **commit raíz `08cf201`**: 15 archivos, 21/21 E2E de Playwright).
Al medirlos apareció un **defecto real del canal** que la cotización no podía tapar, y las dos
decisiones de producto que quedaban pendientes se tomaron con el usuario:

**Decisión A (T191) — la tienda respeta el descuento automático del ERP y lo muestra.**

- **Defecto medido**: el ERP **re-precifica** sus documentos con los descuentos automáticos del
  tercero (`ItemGroupDiscount`, `SpecialPrice`, lista de precios). En el seed real, el grupo
  `ELEC` tiene un **5 %** activo, así que `WEB-0026` (129 con IVA incluido) se cotizaba en la
  tienda a **129 + 20 = 149** y el ERP creaba el pedido a **122,55 + 20 = 142,55** —el POS del
  ERP cobra esos 122,55: es el mismo motor—, y el desglose publicaba un **impuesto negativo
  (−6,45)**. El comprador veía un precio y pagaba otro.
- **El canal corre el MISMO motor** (`resolveAutoDiscount`, el util compartido que ya usan
  ventas, entregas y POS) al cotizar, **publica el descuento** por línea y en el total, y manda
  el `%` **explícito** en el alta (`discountPct`), de modo que el documento **no puede**
  re-preciificar lo cotizado. El **flete no se descuenta** (`discountPct: 0`): es un importe
  configurado por la ciudad, no un precio de catálogo.
- **El correo del comprador entra en la cotización** (`StorefrontQuoteDto.customer.email`,
  opcional): un **cliente registrado** tiene su tercero, su lista de precios y sus acuerdos, y
  sin ese dato la cotización resolvería como invitado y volvería a discrepar. La tienda lo manda
  con un rebote corto (400 ms) y vuelve a cotizar cuando cambia.
- **El umbral de envío gratis** se compara contra el subtotal **ya con descuentos** (lo que el
  comprador paga), que es la lectura correcta de «envío gratis desde X de compra».
- **Evidencia**: canal **65/65** unitarios (5 nuevos: descuento global, `%` explícito en el
  alta, tercero del cliente registrado, sin descuento, y el flete sin descontar) y **33/33** E2E
  del canal (el caso nuevo descubre el descuento **cotizando de verdad** y comprueba en la base
  el `discountPct` de la línea de mercancía y el `0` del flete), con **A/B medido**: sin el
  arreglo el caso nuevo **falla** («Expected −4 / Received +5», la cotización no trae el 10 %).
  **Sonda en vivo** sobre el seed: pedido `PED-36` → `subtotal 122,55 + envío 35 + impuesto 0 =
  157,55` (antes: cotización 164 y cobro 157,55, con impuesto −6,45).

**Decisión B (T192) — el estado del pedido se deriva en vivo del documento del ERP.**

- `WebOrder.status` nace en `PENDING` y **nada** del ERP lo mueve: el seguimiento habría
  mostrado «Pendiente» para siempre. El canal ahora **deriva** el estado que ve el comprador
  del pedido de venta y de sus cantidades (`deliveredQty`/`invoicedQty` contra `quantity`, que
  es la verdad viva del flujo) y del estado del documento, y publica además el **estado crudo**
  del ERP (`erp.salesOrderStatus`, `deliveryStatus`, `invoiceStatus`) para que la tienda pueda
  explicarlo sin inventarlo:

  | Documento del ERP | Tienda |
  |---|---|
  | pedido `CANCELLED` | `CANCELLED` |
  | entrega completa o factura completa (D6: la factura sale con la entrega) | `DELIVERED` |
  | entrega parcial | `SHIPPED` |
  | pedido `CONFIRMED` | `CONFIRMED` |
  | pedido `CLOSED` sin entrega registrada | `PROCESSING` |
  | cualquier otro caso | `PENDING` |

- El **pago** sale de la factura del pedido (`balanceDue` a cero con algo cobrado ⇒ «pagado»):
  los cobros offline se concilian en el ERP, así que la tienda no puede darlos por hechos.
- **Evidencia**: **9 unitarios nuevos** (la tabla completa, incluido el pago y el caso sin
  documento) y un **E2E con el flujo real del ERP**: se crea el pedido por el canal, se entrega
  **parcial** con `POST /delivery-orders/from-order/:id` (la misma petición que hace la pantalla)
  → `SHIPPED`, se entrega el resto → `DELIVERED`, y la anulación de **otro** pedido (el ERP no
  deja anular uno con entregas: 400, regla correcta) → `CANCELLED`.

**Sigue abierto en F3**: reserva con **TTL** de pedidos abandonados (#2), **comprobante** del
pago offline (#4) y proveedor de **correo** transaccional (#5) —los tres, decisiones de
producto—; el E2E de la **conciliación del pago** (factura + pago entrante) queda declarado: la
derivación del pago está medida en unitarios, y el flujo de cobros tiene su propia suite.

### §12.d Estado de F3.3 — pedidos abandonados, referencia del pago y correo (medido el 2026-09-23, T193/T194)

Los tres huecos que quedaban necesitaban decisión de producto y se resolvieron con el usuario
(**D14**, **D15** y **D16**, §9). Dos se implementaron y se midieron; el tercero queda
**declarado**.

**D15 — la referencia del pago offline (T193).**

- `WebOrder` gana `paymentReference` + `paymentReferenceAt` (migración idempotente
  `20260923110644_storefront_payment_reference`, dos columnas) y el canal estrena
  **`POST /storefront/payment-reference`**: el comprador anota el número de operación de su
  transferencia/QR **después** de confirmar, y el canal la guarda para que el back office
  encuentre el pago al conciliarlo. **No cobra**: el pago lo registra el ERP
  (`IncomingPayment`, D4) y el estado del pago se sigue **derivando** de la factura (D13).
- Se **exige el correo del pedido** para escribir (conocer el número de pedido no basta) y se
  rechaza escribir en un pedido **anulado** (no admite pago) o ya **pagado**. El mismo mensaje
  que el seguimiento cuando el correo no corresponde: no se confirma si el pedido existe.
- En la tienda, el formulario vive en la confirmación y en el seguimiento (solo cuando el
  pedido no tiene referencia), el desglose muestra la referencia guardada y el texto dice
  **lo que la referencia no hace** (no marca el pedido como pagado).
- **DEFECTO REAL, hallado por el E2E de la tienda**: `getTracking` cacheaba el pedido **30 s**
  (`REVALIDATE.tracking`), así que al anotar la referencia y recargar, la confirmación servía
  el pedido **anterior** (sin la referencia) —el comprador habría visto que su dato «no se
  guardó»—. El estado del pedido es justo lo que el ERP mueve y lo que el comprador acaba de
  cambiar: ahora se lee **sin caché** (`no-store`, `REVALIDATE.tracking = 0`), con el porqué
  anotado en el código.
- **Evidencia**: **5 unitarios nuevos** del canal (guarda la referencia sin cobrar, exige el
  correo del pedido, rechaza el anulado y el pagado, 404 del ajeno) y un caso E2E del canal
  (correo ajeno → 404, correo del pedido → referencia publicada por el seguimiento y pago
  **sigue** pendiente, referencia corta → 400) más un caso E2E de la tienda que la anota con el
  formulario real, comprueba que el canal la publica y que al volver a la confirmación aparece
  en el desglose (y el formulario ya no se ofrece).

**D14 — los pedidos abandonados (T194).**

- Ajuste nuevo **`SystemSettings.webOrderTtlHours`** (default **48 h**; `0` = todos los
  impagos) expuesto en el `PUT /settings` del ERP, y tarea del canal
  **`POST /storefront/maintenance/cancel-abandoned`** (con la clave, para que la dispare un
  cron) que anula los pedidos web **sin pago** más antiguos que el plazo con el `cancel` del
  **flujo de ventas**: así la existencia comprometida **se libera** y el comprador ve
  «Anulado» (derivado del documento, D13).
- Es **conservadora e idempotente**: omite lo que el ERP ya dio por pagado, lo que **ya salió
  del almacén** (`SHIPPED`/`DELIVERED`: el flujo de ventas rechaza anular un pedido con
  entregas, medido **400**) y lo que ya estaba anulado, y devuelve el detalle de cada omisión
  con su motivo en vez de fallar la corrida.
- **Evidencia**: **6 unitarios nuevos** (anula con el `cancel` del flujo, no toca lo pagado, no
  anula lo entregado, es idempotente, una anulación rechazada no corta la corrida y usa el
  plazo configurado filtrando por ese corte) y un caso E2E que **configura el plazo por la vía
  real** (la pantalla de ajustes del ERP, `PUT /settings`) con `0`, crea un pedido por el
  canal, mide que el documento pasa de `OPEN` a **`CANCELLED`** con la existencia comprometida
  **liberada**, que el seguimiento lo publica como anulado y que una segunda barrida **no**
  vuelve a anularlo; el plazo se restaura al terminar.
- **Declarado**: el campo en la pantalla de Configuración del frontend (el API ya lo acepta) y
  la línea de cron concreta (el endpoint es el que la ejecuta); el caso «no toca lo pagado»
  está medido en unitarios, no en el E2E (crear la factura y el pago entrante es un flujo con
  su propia suite). **Los dos primeros quedaron cerrados después**: el campo en Configuración con
  T195 y el barrido programado con **T196** (§12.f).

**D16 — el correo transaccional.**

- **Declarado, sin implementar**: el backend no tiene proveedor de correo. La confirmación en
  pantalla publica número y código de seguimiento y `/seguimiento` se consulta con el número
  (y el código), así que el comprador no queda sin su pedido; cuando haya credenciales (SMTP
  por empresa o proveedor externo) se retoma.
- **Lo que tampoco existe todavía**: una **bandeja de pedidos web** en el back office (hueco
  declarado desde F1). Hoy el back office ve el **pedido de venta** del ERP y su detalle; la
  referencia del pago vive en la proyección del canal y la publica la tienda, así que la
  bandeja (con la referencia a la vista) es la pieza natural de F5.


### §12.e Estado de F5 — la bandeja de pedidos web del back office (medido el 2026-09-23, T195)

Cerrado el ciclo del comprador (F3), faltaba la **cara del negocio**: sin bandeja, nadie en el back
office veía los pedidos de la tienda ni la referencia del pago que anota el comprador (D15). Se
resolvió con tres decisiones del usuario (**D17**, **D18** y **D19**, §9):

- **D17 — ver, conciliar el pago y anular**: módulo `web-orders` **autenticado** (JWT del ERP) con
  `GET /web-orders` (filtros por estado —**derivado**, D13—, registro del pago, ciudad, fechas,
  «con referencia» y búsqueda por pedido/correo/nombre/seguimiento, con paginación) y
  `GET /web-orders/:id` (líneas, dirección de entrega, desglose, referencia del pago y enlace al
  pedido de venta del ERP), más las **dos acciones**: `POST :id/payment` y `POST :id/cancel`.
- **D18 — el pago se marca en el pedido web (registro comercial)**: `paymentStatus = paid` con
  **usuario y fecha** (`paidAt`, `paidById`; migración idempotente
  `20260923125219_storefront_paid_by`) y **sin contabilizar**: el asiento del cobro sigue siendo del
  `IncomingPayment` del ERP (D4). No pisa la referencia del comprador y rechaza el pedido anulado o
  ya conciliado. La vista publica además el pago **según la factura** del ERP, para que la bandeja no
  confunda «conciliado en la tienda» con «cobrado y asentado».
- **D19 — vive en Ventas → Pedidos Web**, con su **permiso propio** (`web-orders:view|reconcile|cancel`
  en el catálogo de permisos) y su tarjeta en el menú. La pantalla es de **solo lectura más las dos
  acciones**: no hay «Nuevo» porque el pedido lo crea la tienda.
- **Una sola tabla de traducción del estado**: la derivación se extrajo a
  `src/common/web-order-state.util.ts` y la usan **las dos** superficies (el seguimiento público y la
  bandeja), así que no pueden contar cosas distintas. El filtro por estado derivado no puede ir a SQL:
  se aplica sobre un **barrido acotado** y la respuesta publica `truncated` cuando se queda corto, en
  vez de mentir con un total corto.
- **Anular delega en el flujo de ventas** (`salesOrders.cancel`): la existencia comprometida se libera
  con las reglas del ERP y el comprador lo ve anulado en el seguimiento. Lo que **ya salió del
  almacén** no se anula desde la bandeja (400 accionable, regla del flujo).

**Evidencia**: backend **12 unitarios** del servicio (estado derivado, filtro por estado, referencia y
quién concilió, tope del barrido, detalle con líneas/dirección/desglose, 404, conciliar con sus dos
rechazos y anular con sus tres) y `test/web-orders.e2e-spec.ts` **7/7** con JWT real y datos reales
(lista con el estado derivado, detalle, conciliar + los filtros del registro comercial, segundo
conciliado **400**, anular con la **existencia verificada liberada** y el 400 del ya anulado, 404 y
**401** sin token); frontend **26 unitarios** de Karma (servicio, listado y detalle: permisos, acciones
ofrecidas solo cuando el pedido las admite, errores del backend tal cual y el desglose cuadrado) y
`ng build` en **0 errores**. **Cerrado después (misma fecha)**: la spec **E2E de UI**
(`erp-frontend/e2e/web-orders.spec.ts`, **3 casos**) recorre la pantalla con el pedido creado por
el **canal real** —lista con el estado derivado y la referencia, conciliar desde el detalle y
anular, contrastado contra el API del ERP— y el ajuste **`webOrderTtlHours`** (D14) entra en
**Configuración** con su unitario. **Hallazgo de arnés**: en `luna-input` el `placeholder` viaja
como atributo del host, así que `getByPlaceholder` matchea dos nodos (medido). **Declarado**: y la **conciliación contable** del cobro
(pago entrante contra la factura) sigue siendo del flujo de pagos del ERP, como decidió D18.

### §12.f Estado del barrido programado (medido el 2026-09-23, T196)

Cierra el hueco que §12.d dejó declarado: **la línea de cron concreta**. Sin ella, la decisión D14
existía como endpoint «para un cron» que nadie ejecutaba, así que en producción la existencia que
retiene un pedido que nadie paga se liberaba solo si alguien se acordaba de llamar al endpoint a
mano.

- **La tarea vive en el backend**, no en un cron externo: `StorefrontMaintenanceService`
  (`src/storefront/storefront-maintenance.service.ts`) declara **`@Cron('30 3 * * *')`** —03:30,
  fuera del horario comercial y sin cruzarse con las otras tareas del backend (`billing` 01:00,
  `tenant-metrics` 00:05, `alerts` 08:00)— con el mismo motor de tareas que el ERP ya usa.
- **Barre por empresa**: recorre las empresas **con clave de canal activa** (y activas) y llama al
  `cancelAbandonedOrders` del canal, así que cada pedido se anula con el `cancel` del **flujo de
  ventas** (existencia liberada y estado derivado del documento, D13). El servicio del canal pasó a
  recibir el **`tenantId`** —y no el contexto HTTP— para que el barrido no necesite una petición; el
  endpoint del canal sigue siendo el mismo camino, con la empresa sacada de la clave.
- **Resumen por empresa**: `swept` / `ttl-zero` / `error`, con lo anulado y lo omitido de cada una, y
  **una empresa que falla no corta el barrido de las demás** (queda registrada con su motivo).
- **El plazo `0` no se aplica en automático** (regla nueva, declarada): `0` significa «todos los
  impagos» y está pensado para una corrida **explícita** (probar el flujo, forzar una limpieza); una
  tarea nocturna con `0` anularía pedidos de hace minutos, con el comprador a punto de pagar. Esas
  empresas quedan fuera del barrido automático y se reportan como `ttl-zero`, mientras el
  **endpoint** sigue respetando el `0` aprobado en D14. Si el negocio quiere que el nocturno también
  barra todo, es cambiar una condición (y una decisión).
- **Evidencia**: **8 unitarios nuevos** (la tarea declarada a las 03:30 y de tipo cron, solo empresas
  con canal activo, sin canales no consulta nada, anula por empresa con su plazo y agrega el
  resumen, omite la empresa con plazo `0` y sigue con las demás, una empresa que falla no corta el
  barrido, y un fallo al leer la configuración también se reporta) y **3 casos E2E nuevos** en
  `test/storefront-channel.e2e-spec.ts` que invocan **el método que dispara el `@Cron`** sobre la
  base real: el barrido anula el pedido **envejecido 72 h** y libera **exactamente** su cantidad
  comprometida (2 unidades) **dejando vivo el pedido reciente** del mismo artículo (1 unidad), la
  segunda corrida no vuelve a anular nada, la empresa con el plazo en `0` queda **intacta**
  (documento `OPEN` y existencia igual que al crear) y una empresa **sin canal** no aparece en el
  resumen mientras las dos con clave sí. La suite del canal cierra **38/38**.

**Declarado**: el barrido automático no crea el cron del **sistema operativo** ni una cola de
reintentos —corre en el proceso del backend, como las otras cuatro tareas del ERP—, y la
cancelación sigue sin correo al comprador (D16: no hay proveedor).

### §12.g Estado del desglose fiscal del canal (medido el 2026-09-23, T197)

La pregunta del usuario al probar el checkout fue directa: **por qué el ERP y la tienda mostraban
cifras distintas del mismo artículo y qué lógica seguía el e-commerce**. Se midió con el artículo
del seed antes de tocar nada:

| Dato | Valor medido (WEB-0012, Laptop HP Victus) |
|---|---|
| Precio de lista del ERP | **9999** |
| Oferta de catálogo vigente (`Item.salePrice`) | **9499** (5 %) |
| Descuento del grupo `INFO` (`ItemGroupDiscount`) | **8 %** |
| Indicador fiscal del artículo | `IVA13SIN`: 13 %, `isInclusive: true`, método **`BOLIVIA_SIN`** |
| Pedido creado **a mano** en el ERP | 9999 − 799,92 = **9199,08** → `Subtotal 8003,20 + IVA 1195,88` |
| Cotización de la tienda (antes) | 9999 → oferta **9499** → −8 % **−759,92** → **8739,08**, **sin impuesto** |
| Seguimiento (antes) | `subtotal 8739,08`, **`tax 0`** (derivado de la copia del canal) |

**La lógica del e-commerce, explícita**: la tienda **respeta el precio de catálogo del ERP** —que
puede traer una **oferta vigente** (`salePrice`) y el **descuento automático** de la empresa (D12,
que se **acumulan**)— y **el impuesto lo calcula el motor del ERP** con el indicador del artículo y
del tercero; la tienda no inventa ninguna cifra. La diferencia con el pedido manual del ERP estaba
en **qué capas aplica el ERP en sus propios documentos**: el descuento de grupo **sí**, la oferta de
catálogo **no** (hueco declarado desde T188: «el POS todavía no la usa»).

Lo que se cerró en T197:

- **El desglose es el del documento**: la cotización publica precio de **lista**, **oferta de
  catálogo** con su %, **descuento de la empresa**, subtotal, **subtotal sin IVA**, **IVA** (con
  tasa y método), **envío** y **total a pagar** (`neto + impuesto`), y el pedido publica el desglose
  del **documento del ERP** (neto, IVA, descuento de la empresa y, por línea, neto, tasa e
  impuesto) más la **oferta** que aplicó la tienda (`WebOrderItem.listPrice`, migración
  `20260923174211_web_order_item_list_price`).
- **El mismo motor**: `resolveLineTaxIndicator` (línea → tercero → artículo → indicador global) y
  `calcLineWithIndicator`, los que usa el documento, así que el IVA publicado no puede discrepar del
  contabilizado. El **flete** es una línea más del documento y su impuesto entra en el desglose.
- **DEFECTO de paso, medido y cerrado**: con un indicador de IVA **sumado** (el del arnés E2E) la
  cotización publicaba el importe **sin** el impuesto (320 cotizado vs 361,60 cobrado); ahora el
  total cotizado es el del documento en los dos modos.
- **Evidencia**: **4 unitarios nuevos**, canal **39/39** E2E (el desglose publicado es
  **exactamente** el del documento, por línea y en los totales), tienda **24/24** Playwright (la
  oferta y el descuento se ven como capas distintas; la confirmación publica el neto y el IVA) y la
  sonda en vivo del pedido `PED-61` (`neto 7603 + IVA 1136,08 = 8739,08`).

**DECIDIDO por el usuario el 2026-09-23 (D20/D21, §13): opción A**, y además que el descuento de
catálogo **solo del ecommerce** sea **configurable** (hoy no existe dónde: `ItemWeb` no tiene campos
de descuento y el formulario de artículos no expone `Item.salePrice`). El desarrollo va en **F8**
(§13): primero la **paridad** —el ERP honra su oferta en sus documentos y en el POS, y el formulario
de artículos permite configurarla— y después la **promoción del canal** (campos en la publicación
web + pantalla en el back office), con la regla: **sin configuración, el mismo precio en pedidos,
POS y web**.

## §13 F8 — Paridad de precios entre canales y promociones del ecommerce (plan aprobado el 2026-09-23)

**El problema medido (T197)**: el mismo artículo (`WEB-0012`) cuesta **9199,08** en un pedido creado
a mano en el ERP (8 % de grupo sobre el precio de lista) y **8739,08** en la web (oferta de catálogo
5 % + 8 %). Las dos cifras salen de datos del ERP: la **oferta de catálogo** (`Item.salePrice` con
vigencia) solo la aplica la tienda, porque el ERP no la usa en sus documentos ni en el POS (hueco
declarado en T188). Además **no hay ninguna pantalla** para configurar la oferta ni un descuento
propio del canal: `ItemWeb` no tiene campos de descuento y el formulario de artículos no expone
`salePrice`.

### D20 — El ERP honra su oferta de catálogo (aprobada el 2026-09-23)

La **oferta de catálogo** (`Item.salePrice` dentro de su vigencia) pasa a ser un **precio vigente
del maestro** que aplican **todas** las superficies: pedidos de venta, POS, entregas, facturas y la
web. Es la opción A: el mismo artículo cuesta lo mismo en los tres canales y se cierra el hueco de
T188.

- **Un solo punto de resolución**: la oferta se resuelve donde el ERP ya resuelve el precio de
  catálogo (`price-resolver.util.ts`, que usan ventas, entregas y POS), no en cada servicio.
- **Configurable desde el back office**: el **formulario de artículos** expone la oferta (precio de
  oferta + desde/hasta), que hoy solo existe en el esquema. Sin oferta configurada, el precio es el
  de lista.
- **Aceptación medible**: con una oferta vigente, un pedido creado a mano, una venta del POS y un
  pedido de la web del mismo artículo y la misma cantidad cobran **la misma** mercancía; con la
  oferta **vencida** o **futura**, los tres cobran el precio de lista.

### D21 — Descuento de catálogo **solo del canal** (aprobada el 2026-09-23)

Para poder promocionar el ecommerce sin tocar el POS ni los pedidos de venta, la **publicación web**
del artículo (`ItemWeb`) gana su propio descuento con vigencia, que **solo** aplica el canal:

- **Modelo**: `ItemWeb.channelDiscountPct` + `channelDiscountFrom` / `channelDiscountTo`
  (migración idempotente). Sin configurar → `null`/`0` y **ningún** efecto.
- **Quién lo aplica**: el canal (`storefront.service`) lo publica en la ficha, la cotización y el
  pedido como **capa propia** («Promo online»), encima del precio vigente del ERP (oferta de
  catálogo) y **antes** del descuento automático de la empresa (D12), que se mantiene acumulativo.
  El POS y los pedidos del ERP **no** lo ven (no lo leen).
- **Configurable en el ERP**: pantalla nueva en el back office —**Ventas → Tienda online →
  Promociones del canal**— con el listado de artículos **publicados**, su precio vigente, el
  descuento del canal y su vigencia, con permiso propio (`web-promotions:view|edit`). Es el primer
  pedazo de la administración de la tienda que el plan pide en F5 (merchandising).
- **Aceptación medible**: con la promo configurada, la web cobra el precio con promo y **el POS y un
  pedido manual cobran el precio del ERP**; con la promo vencida o sin configurar, las tres
  superficies cobran **exactamente** lo mismo. El E2E mide las tres (API de ventas, POS y canal).

### Fases y evidencia

| Fase | Alcance | Evidencia exigida |
|---|---|---|
| **F8.1** | La oferta de catálogo aplica en documentos y POS + el formulario de artículos la expone + las pantallas **proponen** el precio vigente | Unitarios del resolver (oferta vigente, vencida, futura, sin oferta) y E2E que compara **el mismo artículo** por las tres superficies; `ng build`/Karma del formulario con los campos nuevos y del POS con el precio del motor |
| **F8.2** | `ItemWeb` con descuento del canal + la tienda lo publica y lo aplica como capa propia | Unitarios del canal (promo vigente/vencida/ausente, acumulación con la oferta y con el descuento de empresa) y E2E de la tienda con la promo visible en el desglose |
| **F8.3** | Pantalla **Ventas → Tienda online → Promociones del canal** (permiso propio) + paridad medida | Karma de la pantalla + spec E2E de UI de la bandeja de promociones, y el E2E de paridad de las tres superficies con y sin promo configurada |

### §13.b Estado de F8.1 — el motor de precios es uno y la paridad está medida (2026-09-23, T198)

**Implementado (backend)**:

- **La oferta de catálogo entra al motor del ERP**: `resolveCatalogPrice` (en
  `price-resolver.util.ts`) es la **única** regla de la oferta (`Item.salePrice` dentro de su
  vigencia, evaluada con el **día del tenant** y con la **fecha del documento**); la usa el
  canal de la tienda y el resolver de precios, así que no pueden divergir.
- **`resolveItemPriceForPartner` aplica la oferta como precio base** de toda la jerarquía
  (acuerdo fijo → acuerdo % → grupo → precio especial de lista → lista del tercero → **precio
  vigente**), y el descuento se calcula sobre ella. Ventas, entregas y POS pasan por ahí: un
  pedido manual, una venta del POS y un pedido web del mismo artículo cobran lo mismo. El
  resolver devuelve además `listPrice` y `offerPct` (las capas, para publicarlas).
- **El canal ya no replica la jerarquía**: la cotización y el alta usan el **mismo**
  `resolveItemPriceForPartner` (antes usaba `resolveAutoDiscount` por su cuenta), así que
  cualquier ganador (acuerdo, grupo, lista, oferta) es idéntico al del documento; el descuento
  ganador viaja **explícito** (`discountPct` o `discountAmt`) y publica su `source`.
- **El POS resuelve el impuesto como el resto del ERP** (defecto medido, ver abajo) y evalúa
  las vigencias con la **fecha del tenant**.
- **La oferta es configurable por API**: `salePrice` + `salePriceFrom`/`salePriceTo` en el
  alta y la edición de artículos, y `GET /items/:id/effective-price?partnerId=&quantity=`
  devuelve el precio vigente que el ERP aplicaría (lo que la pantalla debe **proponer**).

**DEFECTO MEDIDO Y CERRADO (el que la validación de paridad destapó)**: el POS resolvía el
impuesto con el indicador del **tercero** a secas (`partner.defaultTaxIndicator`) y, sin
indicador por defecto (el caso del consumidor final de la tienda), emitía la factura **sin
IVA**: `FVE-1` con `subtotal 810 / tax 0 / total 810` mientras el pedido de venta y la web del
mismo artículo cobraban `810 + 105,30 = 915,30`. Ahora cada línea usa
`resolveLineTaxIndicator` (línea → tercero → artículo → global), el mismo motor que los
documentos.

**Evidencia**: **E2E de paridad** en `test/storefront-channel.e2e-spec.ts` (caso «el mismo
artículo se cobra EXACTAMENTE igual en pedido de venta, POS y tienda»): artículo con **oferta
vigente** (1000 → 900) en un grupo con 10 % → el precio resuelto es `900 / 810` y las tres
superficies coinciden en `price`, `discountPct`, `priceNet`, `taxAmount` y **total** (POS con
sesión de caja real, creada por el caso); **unitarios**: 5 casos nuevos del resolver (oferta
vigente/vencida/futura, la oferta como base del descuento de grupo, el acuerdo fijo que sigue
ganando y `resolveCatalogPrice` con los extremos de vigencia), 1 del POS (impuesto del
artículo sin indicador del tercero) y el canal **40/40**.

**F8.1 — cerrado por partes**: el **formulario de artículos** ya expone la oferta (T198, UI; el
resto de F8.1 —que las pantallas propongan el precio vigente— se cierra en **§13.c/T199**):
fila de tres campos —**Precio de oferta**, **Oferta desde**, **Oferta hasta**— bajo el precio de
venta, con una nota que explica el alcance (mientras esté vigente ese es el precio de pedidos, POS y
tienda; fuera de la vigencia manda el precio de venta), hidratación del ISO al día del tenant y
`null` al vaciarla para quitarla; evidencia: **4 unitarios nuevos** de Karma (Karma completo
**2198**), `ng build` 0 y `lint` 0/0.

**Pendiente de F8.1 (declarado, trabajo de UI sin cambios de contrato)**: que las pantallas de
**ventas y POS propongan** el precio vigente al capturar la línea con
`GET /items/:id/effective-price?partnerId=&quantity=`. El plan exacto: `PriceResolutionService`
(`shared/document-form/price-resolution.service.ts`) es el punto único que hoy llama a
`POST /special-prices/resolve`; se cambia esa llamada por el endpoint nuevo y se mapea su respuesta
al shape de `ResolvedSpecialPrice` que ya consume el flujo (`basePrice` → precio base del
documento, `discountPct`/`discountAmt` → descuento ganador explícito, `price` → precio fijo cuando
no hay descuento), pasando `res.basePrice` a `applyResolvedSpecialPrice` para que el `%` se aplique
sobre el **precio vigente** (oferta) y no sobre la lista; las compras siguen usando
`resolvePriceList` (no llevan descuentos de venta) y hay que actualizar las ~7 expectativas del spec
que hoy afirman la URL `special-prices/resolve`. → **CERRADO en §13.c (T199)**.

### §13.c F8.1 cerrada — la pantalla propone el precio que el ERP cobra (2026-09-23, T199)

**Lo implementado (frontend, sin cambios de contrato en los documentos)**:

- **`PriceResolutionService` consulta el motor único**: `resolve()` (líneas de venta) llama a
  `GET /items/:id/effective-price` en vez de a `POST /special-prices/resolve` y traduce la
  respuesta al shape que ya consumen los formularios, pasando **`res.basePrice`** a
  `applyResolvedSpecialPrice`: sin ganador el precio vigente entra como precio de la línea, con
  ganador `%` la línea queda `base vigente + %` y con ganador en monto viaja `discountAmt` (por
  unidad). Si el motor no resuelve nada (o falla) se conserva el respaldo de siempre
  (`GET /price-lists/resolve`). Las **compras** siguen con `resolvePriceList`.
- **`POST /items/effective-prices`** (nuevo, en lote, `items:view`): el POS pinta el catálogo y
  recalcula el carrito entero, así que resolver artículo por artículo multiplicaría las consultas;
  lee los precios de lista en **una** consulta y cada artículo pasa por el **mismo**
  `resolveItemPriceForPartner`. Sin `partnerId` la base es la **lista por defecto** de la empresa
  (también en el endpoint de a uno): así el catálogo del POS sin cliente muestra el precio vigente
  —oferta incluida— y no el de lista. Un artículo de otra empresa se **omite** del resultado.
- **El POS dejó de replicar el precio**: `PosService.getDefaultPrices`/`resolvePriceBulk` se
  retiraron (proponían el precio de lista) y el componente usa el motor para el catálogo, el modal y
  el carrito; el descuento que aplica el motor se marca `autoDiscount` y un recálculo lo descarta y
  lo vuelve a resolver, mientras que un descuento capturado por el cajero se respeta (defecto
  colateral que se cierra: al cambiar de cliente el carrito conservaba el `%` del anterior).

**DEFECTO MEDIDO Y CERRADO (el que la UI dejó a la vista)**: el carrito del POS se armaba con el
**precio de lista** y le aplicaba el descuento ganador, mientras la factura cobra el **precio
vigente** con ese descuento. Sonda sobre el seed real (`WEB-0004`, lista **2899**, oferta vigente
**2699**, grupo con **5 %**): la pantalla proponía `2899 − 5 % = 2754,05` y el ERP cobra
`2699 − 5 % = 2564,05`; el cajero cobraba de más y el POS respondía **400 «El pago excede el total
de la venta»**. Ahora la pantalla propone `2699 + 5 %` → **2564,05 = la factura** (misma sonda,
«coincide con la factura: SI»). El E2E de paridad fija el contrato con una venta pagada con la
cuenta vieja (`1000 − 10 %`): **400 medido** con ese mensaje.

**Evidencia**: **6 unitarios nuevos** del servicio de items (una sola consulta de precios de lista
para el lote, el lote con el mismo motor, la lista por defecto sin tercero, la lista explícita, la
omisión de artículos ajenos y la cantidad mínima), **Karma 2205** (spec del servicio de resolución
reescrito al endpoint nuevo: URL, parámetros y la traducción de `basePrice`/`%`/monto; 6 casos
nuevos del POS: oferta como base + ganador, el descuento manual respetado, el descuento automático
anterior descartado, el precio vigente en el modal y en el quick-add), `test/storefront-channel.e2e-spec.ts`
**40/40** (el caso de paridad añade el **lote** con la misma resolución exacta que el endpoint de a
uno y la venta rechazada con la cuenta vieja), `ng build` 0, `lint` 0/0, gates estáticos en verde y
la **sonda en vivo** del seed arriba. `npm run format:check:touched` OK.

**Declarado**: la resolución de la UI usa el **día del tenant** (lo resuelve el backend), así que un
documento **retroactivo** (fecha anterior o posterior a hoy) se propone con la vigencia de hoy: el
motor del documento sí evalúa su propia fecha. Queda como hueco menor hasta que el endpoint acepte
la fecha del documento.

### §13.d El desglose del comprador explica cada capa con su tasa (2026-09-23, T200)

**Lo que preguntó el usuario, medido con `WEB-0012`** (lista **9.999**, oferta vigente **9.499**,
grupo `INFO` con **8 %** global 2025–2030): «¿por qué me muestra todos esos datos? ¿los −500 son el
descuento del grupo? ¿de dónde salen los −759,92?». Respuesta con la cuenta real:

| Capa | Importe | De dónde sale |
|---|---|---|
| Precio de lista | 9.999 | `Item.price` del maestro |
| Oferta de catálogo | −500 | **diferencia exacta** `9.999 − 9.499` (el precio de oferta del artículo). El 5 % que publica el motor es `500 ÷ 9.999 = 5,0005 %` **redondeado**; aplicar el 5 % daría 499,95 y dejaría el precio en 9.499,05 |
| Subtotal | 9.499 | precio vigente (oferta) |
| Descuento de la empresa | −759,92 | **8 % del grupo `INFO`** (`Catálogo Comercial → Grupos de Descuento`) calculado **sobre el precio de oferta**: `9.499 × 8 %` (sobre la lista serían 799,92). Las capas **se acumulan** (D12), y por eso la web y el pedido del ERP cuadran |
| Neto + IVA | 7.603 + 1.136,08 | el IVA 13 % `BOLIVIA_SIN` incluido se **extrae** del importe ya descontado |
| Total | 8.739,08 | neto + impuesto = el total del documento |

**Decisiones del usuario (2026-09-23)**: **(a)** dejar el desglose completo pero **mostrar la tasa de
cada capa**, y **(b)** **mantener la base** del descuento de la empresa sobre el precio de oferta (no
sobre la lista) —cambiarla obligaría a cambiar el motor único de pedidos, POS y tienda a la vez—.

**Lo implementado**:
- El **canal publica el % efectivo** de cada capa, calculado por el ERP con `Money`: `offerPct`
  (Σ oferta ÷ Σ precio de lista de las líneas que traen oferta) y `companyDiscountPct` (Σ descuento ÷
  Σ `price × cantidad` de las líneas que traen descuento), en la **cotización** y en el **pedido**; la
  tienda los pinta junto a la etiqueta (`checkout-quote-offer-rate`, `checkout-quote-discount-rate`,
  `order-offer-rate`, `order-discount-rate`) sin derivar ninguna cifra.
- **DEFECTOS MEDIDOS Y CERRADOS** (los destapó el E2E de la tienda al medir la tasa): la base del
  descuento se tomaba del `subtotal` del canal, que guarda el importe **ya descontado** → el 5 % se
  publicaba como **5,26 %**; y el **flete viaja como una línea más** del pedido → entraba en la base y
  el descuento real (12,45 sobre 249) salía **4,63 %**. Cada tasa se calcula ahora sobre la mercancía
  que **lleva** esa capa, así que el checkout y la confirmación publican la misma.
- **El flete queda especificado como envío** (petición del usuario: «está bien que el flete aparezca
  en una línea adicional pero que lo especifique al momento del cobro»): el canal publica
  `shippingItem` (cotización) y `shippingItemId` (pedido, resuelto con la ciudad de entrega) y la
  tienda pinta esa línea como **envío** —«Envio · <artículo de la ciudad> · Servicio de entrega de la
  ciudad (SKU …)» en el checkout y «Envio · <artículo>» en la confirmación y el seguimiento— en vez
  de como un producto (`checkout-quote-line-shipping`, `order-line-shipping`).

**Evidencia**: canal **81/81** unitarios (tasas del pedido del seed —5 % y 8 %— con las dos trampas
documentadas en el test), **tienda E2E 24/24** (las tasas en el checkout y la confirmación y la línea
de envío en las tres pantallas, con el pedido real del canal), `tsc`/`lint`/`build` de la tienda en 0
y **sonda en vivo** del canal (`offerPct 5`, `companyDiscountPct 8`, importes sin cambios).

**Declarado**: la oferta se guarda como **precio** (`Item.salePrice`), no como porcentaje; y con
varias líneas la tasa publicada es la **efectiva del carrito** (ponderada por importe), no la de un
artículo suelto.

**Declarado**: el descuento del canal se aplica **solo** a la mercancía (el flete sigue siendo el
importe de la ciudad) y no cambia el IVA —el impuesto lo sigue calculando el motor del ERP sobre el
precio ya promocionado, como en T197—; la oferta de catálogo y la promo del canal **se acumulan**
(D12) y el orden de las capas queda publicado en el desglose para que el comprador pueda
explicárselo.

### §13.e Estado de F8.2 — la promo exclusiva del canal (medido el 2026-09-24, T215)

**Entregado (backend + tienda)**: el descuento que **solo** cobra la tienda vive en la
**publicación web** —`ItemWeb.channelDiscountPct` + `channelDiscountFrom`/`channelDiscountTo`,
migración idempotente— y no en el maestro, porque el POS y los documentos del ERP **no leen
`ItemWeb`**: es la forma de promocionar el ecommerce sin tocar el precio de venta del ERP.
La regla es **una** (`src/common/channel-discount.util.ts`, compartida por el canal y la
pantalla): vigencia con el **día del tenant** y extremos inclusivos, `<= 0` y `>= 100 %`
ignorados, y precio con redondeo a la precisión del precio unitario (**6 decimales**). El
canal la publica como capa propia («Promo online») en catálogo, ficha, cotización y pedido,
**encima** del precio del ERP y **antes** del descuento de la empresa, y viaja **dentro del
precio** que se manda al documento del ERP (que recibe el ganador de la jerarquía explícito
y por eso cobra exactamente lo cotizado **sin conocer la promo**). La capa se **congela** en
`WebOrderItem` (`channelDiscountPct`, `channelDiscount`, `priceBeforeChannel`, migración
propia) para que la confirmación y el seguimiento expliquen el importe aunque la campaña se
retire después. La API del back office es `GET /web-promotions` + `PATCH /web-promotions/:itemId`
con permiso propio **`web-promotions:view|edit`**.

**Medido**: `channel-discount.util` **17/17**; `storefront.service` **122/122** —4 casos
nuevos de la capa en la cotización y el alta (precio con promo, `priceBeforeChannel` intacto,
`channelDiscount` por línea, congelado en la proyección) y 5 en el catálogo/ficha (promo
vigente, acumulada con la oferta, vencida, futura y 100 % ignorada)—; `web-promotions`
(servicio + DTO) **15/15**; **canal E2E 41/41** con el caso de paridad de D21 —promo al 10 %:
la web cobra **729** por unidad y el pedido de venta y el POS **810**; con la promo **vencida**
los tres cobran **810**—; **tienda funcional 30/30** con el spec nuevo, que configura la promo
por el **API real del back office**, comprueba el rótulo de la ficha y la fila del desglose del
checkout, y la quita al terminar.

**Tres defectos medidos y cerrados en el camino**: **(a)** el **gate de dinero del backend
estaba rojo desde T195/T198** (`TOTAL 4` con línea base 0, y la CI corre ese gate: la pipeline
llevaba roja sin que nadie lo viera) —el impuesto derivado del pedido se calculaba con
`Math.round` sobre `number` y el precio del catálogo se comparaba tras `Number(...)`—; los
cuatro sitios se migraron a `Decimal` y el gate queda en **TOTAL 0**; **(b)** el DTO del
`PATCH` rechazaba `0`, así que **quitar la promo era imposible por el API** (400) —lo destapó
el E2E de la tienda—; **(c)** la tienda **cachea el canal 60 s**, así que una promo tarda esa
ventana en verse en la ficha (el E2E lo **mide**: 18,3 s en la suite completa).

**Declarado**: la promo no se rotula todavía en la **bandeja** de pedidos del back office (el
pedido la lleva congelada por línea) y la ventana de 60 s de la caché de la tienda marca el
ritmo de publicación; **F8.3** (pantalla **Ventas → Tienda online → Promociones del canal**)
se entrega con la API ya cerrada.

### §16 F6 — fase 2 del prompt: decisiones del usuario, orden y estado (2026-09-24, T223)

**Decisiones del usuario (todas confirmadas el 2026-09-24)**, en el orden acordado:

| # | Pieza | Decisión | Estado |
|---|---|---|---|
| 1 | **Vendedores** («Vendido por …») | Mostrarlo en **ficha y catálogo** + **filtro por vendedor** + **`GET /sellers`** en el ERP (sin pantalla de administración: el marketplace del plan es ligero, sin comisiones ni liquidación) | **ENTREGADO (T223)** |
| 2 | **Comparador** | Productos lado a lado con lo que el canal ya publica (precio, existencia, marca, garantía y las características compartidas) | **ENTREGADO (T224)** |
| 3 | **Wishlist** | **Local del dispositivo** ahora (como el carrito) y se migra a la cuenta cuando exista F4 | **ENTREGADO (T225)** |
| 4 | **Reseñas** | Solo **compradores con un pedido ENTREGADO** (verificado por su correo) y **moderación** en el back office | **ENTREGADO (T226)** |
| 5 | **Garantía extendida e instalación** | Como **artículos de servicio publicados** en el canal, que el comprador agrega al carrito desde la ficha (reutiliza lo medido en T220/T221: los servicios se facturan y no se entregan) | **ENTREGADO (T227)**: el canal publica el arreglo `services` de la categoría (los servicios se publican **por categoría web**) y la ficha los ofrece con el bloque «Súmale un servicio» (cantidad fija **1**, sin existencia); viajan por la entrega, la reserva y la devolución **sin mover inventario ni costo**. *Medido en el gate visual de T230: la ficha del fixture pinta «Garantía extendida 12 meses» con su precio.* **Declarado**: no hay relación servicio↔artículo en el maestro (se publican por categoría) y un servicio no puede ser kit ni manejar lote/serie |
| 6 | **Servicio técnico** | Reutilizar **`Seller`** como partner de servicio (con ciudad y especialidad), sin maestro nuevo | **ENTREGADO (T228 backend/canal/tienda + T229 pantalla)**: `ServiceRequest` con el **vendedor y su partner congelados**, alta del comprador por el canal (`POST /storefront/service-requests`, correo obligatorio y pedido opcional) y cola de atención del back office (**Ventas → Servicio técnico**) con permiso propio. **Declarado**: la primera versión **no** lleva adjuntos ni agenda de técnico, no hay aviso al comprador por correo (**D16**) y la «especialidad» del vendedor no se modela (el plan la mencionaba; se resolvió con el vendedor de la publicación tal cual) |

**Tramo 1 entregado (T223)**: el `Seller` del ERP —que existía desde F1 con datos en la semilla y
**0 referencias** en `src`— viaja al catálogo y a la ficha (`seller`, `sellerCode`,
`sellerLogoUrl`), el catálogo filtra por su **código** y la faceta `GET /storefront/sellers`
publica solo los vendedores **con catálogo publicado** (misma regla que la faceta de marcas); el
back office estrena `GET /sellers` (`sellers:view`) con `publishedItems` contado **filtrado**.
Medido en vivo sobre el seed: **5 vendedores** (22/21/22/22/21 = 108 publicados) y
`?seller=CASAELECTRO` → 22. Gates: canal E2E **45/45**, suites tocadas **111/111**, tienda
**32/32** y **visual 15/15**, backend **199 suites / 2485 tests**.

**Dos defectos medidos y cerrados en el camino**: `getCatalog` de la tienda **no reenviaba** el
`seller` (el filtro se pintaba y no llegaba al canal) y la ficha **reventaba con 500** si la
respuesta del canal no traía la clave (caché de una versión anterior) — la comprobación pasó a
`typeof === 'string'`.

**Tramo 2 entregado (T224)**: el **comparador** compara **datos vigentes**, no una copia: la
lista del navegador guarda solo la **identidad** de cada producto (localStorage, como el carrito,
porque no hay cuenta hasta F4) y la tabla se pide al canal por el puente `GET /api/comparar`, que
**sanea** los slugs (patrón de slug publicado, únicos, tope 4) y deja la clave del canal en el
servidor (D10). La tabla publica precio (con «antes» y ahorro), existencia de la ciudad, marca,
**vendedor**, garantía, categoría y SKU, y **solo las características que comparten todos** los
productos (las que ya son fila fija se excluyen para no repetir información), con las propias de
cada uno aparte. El control «Comparar» está en cada tarjeta y en la ficha, el contador de la
cabecera aparece solo con algo que comparar y el tope de 4 se explica en vez de fallar en
silencio. Medido: tienda **35/35** (3 casos nuevos), **a11y 18/18** (la página entra en el
barrido de axe), **visual 16/16** con captura nueva revisada, y los gates estáticos en 0.
Declarado: sin URL compartible ni sincronización (llegan con F4) y el comparador no añade al
carrito desde la tabla.

**Tramo 3 entregado (T225)**: la **lista de deseos** vuelve a usar la misma regla que el comparador
—la lista vive en el navegador (`localStorage`) y guarda **solo la identidad** del producto; los
datos vigentes se piden por el puente `GET /api/favoritos`, con el saneo de slugs y el **tope de
24**— y la búsqueda por lote se extrajo a **una sola** pieza (`lib/product-lookup.ts`), que ahora
comparten las dos rutas (`/api/comparar` y `/api/favoritos`): no hay dos formas de leer una lista de
slugs. `/favoritos` **reutiliza la tarjeta del catálogo** (con su compra rápida y su control de
comparar) y añade «Quitar de favoritos» por producto, «Vaciar favoritos» y «Comparar los guardados»
(con dos o más); la lista que excede el tope lo **dice** (`wishlist-truncated`) en vez de recortar en
silencio, un producto que ya no se puede leer se **nombra** (`wishlist-missing`) y un producto que se
despublicó se puede quitar desde la propia página. El control «Guardar/En favoritos» está en cada
tarjeta y en la ficha (`aria-pressed`), y el enlace de la cabecera —con su contador— **solo aparece
cuando hay algo guardado**. Medido: tienda funcional **38/38** (3 casos nuevos: el ciclo
guardar/quitar/vaciar con el contador de la cabecera, la persistencia entre contextos con el salto al
comparador, y el saneo del API con el tope de 24 —`400` sin slugs o con basura, `200` con el válido
de una lista sucia—), **a11y 19/19** (la página entra en el barrido de axe) y **visual 17/17** con
captura nueva (`favoritos-claro`, revisada) y la de `categoria-claro` **regenerada desde el fixture**
—las seis capturas que cambian son las de tarjeta/ficha, y el cambio se revisó en imagen: la línea
«Guardar» nueva—, más `typecheck`/`lint`/`build`/`sync:tokens:check`/`sync:fonts:check`/
`audit:contrast` (34/34) en 0. Declarado: la lista es de **este dispositivo**
(sin cuenta ni sincronización: llegan con F4), el tope de 24 no se puede subir sin cambiar el API y
la cabecera no ofrece el enlace hasta que hay algo guardado (a propósito: sin ruido para quien no la
usa).

**Dos defectos medidos en el camino**: (a) el islote importaba su tope desde el módulo que carga
`server-only` (la regla D10) y el `build` lo rechazaba; la parte pura (`MAX_WISHLIST_SLUGS`,
`wishlistApiHref`) se separó a `lib/wishlist.ts`. (b) La corrida de grabación del gate visual
reescribió dos fixtures del catálogo con la existencia viva del día (el teclado `WEB-0027` de **3** a
**1**) y la captura de `categoria-claro` se quedó con el dígito nuevo: devueltos los fixtures a su
versión registrada, la comparación **seguía verde** porque un dígito cabe en la tolerancia de **220
px** —un falso verde del contrato «la captura representa al fixture»—; la captura se **regeneró desde
el fixture versionado** (borrada y reescrita: `--update-snapshots` no reescribe lo que ya considera
dentro de la tolerancia) y la imagen nueva dice el `Disponible: 3` del fixture. La lección queda
anotada: **regrabar el fixture y regenerar la captura son actos distintos**, y el segundo no siempre
reescribe.

**Tramo 4 entregado (T226)**: las **reseñas de producto**. El comprador no tiene cuenta (F4 llega con
el proveedor de correo, D16), así que prueba su compra con lo que ya usan el seguimiento y la
referencia de pago —**número de pedido y correo**— y el **canal** comprueba tres cosas contra su
documento: que el pedido existe y es de ese correo, que está **entregado** (el estado derivado de
T218/T221: la **reserva facturada no es una entrega**) y que **lleva el artículo**. La reseña nace
**pendiente** y el back office la aprueba o la rechaza: solo las **aprobadas** se publican en la ficha
y solo ellas cuentan para el promedio. La regla vive **una sola vez** (`ReviewsService`, que usan el
canal y la pantalla de moderación): una reseña por **producto y comprador**, y reenviar una rechazada
**reutiliza su fila** en vez de acumular. El comprador se publica con su **nombre** o su correo
**enmascarado**, y su correo completo no sale de la base. La ficha estrena la sección (promedio,
número, listado y `aggregateRating` **solo** con aprobadas) y el formulario; el back office, la
pantalla **Ventas → Reseñas del canal** con su cola por estado y el modal de moderación con nota
interna. Medido: `reviews.service` **14/14**, canal + reseñas **167/167**, **canal E2E 46/46** con el
caso de la cadena completa (compra → 400 por no entregado → entrega real → 201 PENDING → la ficha no
la publica → 409 al repetir → aprobación → 5,0 con 1 → segundo comprador enmascarado → 4,0 con 2 →
rechazo que no publica → reenvío → 400 por artículo ajeno → auditoría), `reviews.e2e-spec.ts` **7/7**,
tienda **E2E 41/41** y **a11y 19/19**, con la **ventana de caché medida** por el propio E2E (21,5 s y
56,4 s en dos corridas) y el fixture del gate visual regrabado (10 capturas regeneradas: la sección
nueva en la ficha y los dígitos de existencia que movió la regrabación, medidas una por una).
Declarado: el promedio se publica **solo en la ficha**, no hay edición del texto desde el back office
(la reseña es del comprador), no hay aviso por correo (D16) y la pantalla de moderación no entra
todavía en el barrido de axe ni en la densidad dinámica.

**Un defecto de arnés destapado por la corrida completa y cerrado (T226)**: el gate funcional de la
tienda daba **rojo intermitente** con `Expected "Disponible: 9" / Received "Disponible: 10"` —el ERP
ya había movido el stock (otras pruebas reservan y entregan) mientras la página servía su copia
cacheada de **60 s**—, así que la aserción instantánea era **falsa por diseño**; `ciudad.spec.ts` y
`producto.spec.ts` esperan ahora la **convergencia** (recarga acotada) y afirman después el texto
exacto, y los casos que miden esa ventana declaran un tope mayor que el reloj de la caché.

**Tramo 5 entregado (T227) — los servicios: la entrega los maneja sin que afecten inventario ni costo, y la reserva del canal los cobra con su cuenta**. Petición del usuario: la entrega debe copiar el **artículo y el servicio** del pedido web, pero su asiento contable **solo obtiene el costo del artículo** (el servicio se omite); la reserva que nace **de la entrega** debe jalar las dos líneas y **cobrar las dos**; y el servicio, al **no ser inventariable**, no mueve stock ni costo aunque entre y salga por documentos. Decisiones del usuario: la entrega **propone** la línea de servicio (se puede quitar), la entrega **marca cumplida** la línea del pedido, la entrega **manual** también acepta servicios, y lo mismo vale para **devoluciones, notas de crédito y cancelaciones**.

**Lo que la medición destapó (y no era el pedido, era un defecto del ERP)**: un artículo no inventariable se comportaba como inventario en **todos** los documentos por los que pasaba. Sonda sobre la base sembrada: `ART-00027` (Garantía Extendida) con fila en `Stock` (`stockPhysical 3`, `stockCommitted 28`, `stockAvailable −25`) y **3 movimientos `SALES_RETURN`**; `WEB-ENVIO` (el flete del canal) con `stockCommitted 75` (disponible −75); `ART-00024` disponible 6. Es decir: **cada línea de servicio de cada pedido comprometía stock inexistente**, y la entrega además **valorizaba** el servicio (`getAvgCost` cae al `cost` del maestro: **199,5** de `totalCost` vistos por el E2E).

**La regla quedó en un solo sitio** (`src/common/stock.util.ts` → `isNonInventoriableItem` / `getNonInventoriableItemIds`): `upsertStock` no toca `Stock`, los tres recálculos (`quoted`/`committed`/`ordered`) dejan sus contadores en 0 **sin crear fila**, y los **6 helpers compartidos** de documentos omiten la línea de servicio (una consulta por documento, no por línea). Los caminos que escriben el kardex por su cuenta (devolución, nota de crédito, cancelación de factura y los **seis** caminos de creación de entrega) llevan la misma guarda, y la entrega guarda el servicio con **almacén `null` y costo `null`** —el asiento de la entrega costea solo la mercancía—. `scripts/purge-service-stock.mjs` (en seco por defecto) repara las bases que arrastran esas filas: **4 filas y 3 movimientos** borrados en la base de desarrollo.

**Contabilidad (aclaración del usuario, medida en vivo A/B)**: el servicio es un **artículo no inventariable y solo para venta**, y la reserva mueve **la cuenta de su parametrización** (jerarquía del artículo: matriz artículo-almacén → maestro → grupo → `AccountMapping`): sin parametrizar cayó a la cuenta del grupo (`4.1.1.01.001`), con `Item.salesRevenueAccountId` movió esa cuenta, y con la **matriz por almacén** movió la de la **matriz** aunque el maestro apuntara a otra. Una línea de servicio **sin artículo** sigue usando su **cuenta directa** (`acctCode`). El asiento de la **entrega** no lleva el servicio y el de la **reserva** (`SALE_RESERVE_INVOICE`, `FRV-*`) cobra artículo + servicio.

**Medido**: `stock.util` **32/32** (5 casos nuevos), `document-stock.helper` **8/8** (3 nuevos), devoluciones **13/13**, **canal E2E 47/47** —el caso nuevo recorre la cadena completa y es **A/B**: sin el arreglo el `totalCost` de la entrega sale 199,5 en vez de 100— y **12 suites / 235 tests** de los documentos de venta. **Declarado**: los servicios se publican **por categoría web** (no hay relación servicio-artículo en el maestro), un servicio no puede ser **kit** ni manejar **lote/serie**, y la **UI de la tienda** que ofrece los servicios en la ficha (cantidad fija 1) y el manejo del carrito con `available: null` es el **tramo siguiente** —el canal ya publica `isService` y el arreglo `services` de la categoría—.

**Primer paso ENTREGADO (T228, backend)**: modelo **`ServiceRequest`** (+ enum y migración idempotente `20260925120000_service_requests`) con el **vendedor y su partner congelados**, el pedido del canal (`webOrderId` + `orderNumber`), el motivo, el estado y la **nota de atención**; módulo **`service-requests`** con la regla en un solo sitio (alta que resuelve quién atiende, cola con **resumen por estado**, detalle y atención que **no reabre una cerrada**) y su API tras el permiso propio **`service-requests:view|attend`**; y el canal estrena **`POST /storefront/service-requests`** (slug publicado, correo obligatorio, pedido opcional verificado con la identidad del seguimiento → **404** si es ajeno) con rastro `STOREFRONT_SERVICE_REQUESTED`. **Medido**: `service-requests.service` **7/7**, `storefront.service` **118/118** y `tsc` 0. **Pendiente declarado de este tramo**: la **pantalla** del back office (cola + modal de atención) y el `canRequestService` publicado por la ficha. **Segundo y tercer paso ENTREGADOS**: la ficha publica **`canRequestService`** (lo lee del vendedor de la publicación), el **caso E2E del canal** recorre el alta y la atención completas (**canal E2E 48/48**) y la tienda estrena el **formulario de servicio técnico** con su puente `POST /api/servicio-tecnico` (D10) y la validación compartida entre islote y puente; **tienda E2E 43/43**, a11y 19/19 y visual 17/17. Queda solo la **pantalla del back office** (cola + modal de atención) para cerrar el tramo.

### §16.c F6 tramo 6 — la **pantalla** de solicitudes de servicio técnico: plan listo para ejecutar (2026-09-25, T228)

Lo único que queda del tramo. El backend, el canal, la tienda y el **modelo + cliente HTTP** del back office ya están entregados y medidos; la pantalla se construye **copiando el patrón de la cola de reseñas** (`src/app/pages/reviews/`), que es el mismo caso —listado con filtros, resumen por estado y una acción por fila en overlay— y ya pasó los gates de densidad, `!important`, `::ng-deep` y accesibilidad.

**Archivos a crear** (espejo de `pages/reviews/`):
- `src/app/pages/service-requests/service-requests.component.ts` (el servicio HTTP **ya existe**: `ServiceRequestsService` con `getAll`, `getOne` y `attend`).
- `service-requests.component.html`, `service-requests.component.scss` y `service-requests.component.spec.ts`.

**Cableado** (los tres puntos, con el anclaje ya localizado):
- `src/app/routes/sales.routes.ts` L114-125: entrada `path: 'service-requests'` con `permissionGuard(['service-requests:view'])` y `loadComponent` perezoso (mismo bloque que `reviews`).
- `src/app/core/layout/sidebar/sidebar.config.ts` L120: `route: '/service-requests'` con `permission: 'service-requests'`, junto a Reseñas del Canal.
- `src/app/core/breadcrumb/breadcrumb.service.ts` L26: `'service-requests': 'Solicitudes de Servicio'`.

**Contenido de la pantalla** (lo que el contrato ya publica): cabecera con el **resumen por estado** (`summary`), filtros por **estado** y **texto** (`search`: correo, nombre, teléfono, motivo o número de pedido), tabla con **fecha, artículo (enlace a la ficha por `slug`), comprador (nombre + correo), vendedor, pedido vinculado, motivo y estado**, paginación, y la **atención** por fila: estado nuevo (`IN_REVIEW`/`SCHEDULED`/`RESOLVED`/`REJECTED`/`CANCELLED`) + **nota**, con la acción **oculta o deshabilitada y explicada** cuando la solicitud ya está cerrada (`SERVICE_REQUEST_CLOSED_STATUSES`) —el backend responde 400 si se reintenta, así que la pantalla no debe ofrecerlo—. Sin `create`: la solicitud la deja el comprador desde la ficha.

**Criterios de aceptación del tramo** (medir, no afirmar): `ng build` 0 · `lint` 0/0 · `format:check` OK · `audit:density:ci` sin hallazgos nuevos · `a11y:check` sin hallazgos · `Karma` del componente (listado con filtros y resumen, atención con estado + nota, la cerrada sin acción) sumado al **4/4 del servicio** ya entregado; y la limpieza de arnés que ya existe (`test/test-utils.ts` borra `ServiceRequest`).

**CERRADO (T229, 2026-09-25)**: la pantalla se entregó y se midió; **con ella F6 queda cerrado**. **Medido antes**: en `erp-frontend/src` la pantalla **no existía** —`pages/service-requests/` tenía **solo** el modelo y el cliente HTTP con su spec (4/4) de T228— y los **tres** anclajes del plan tenían **0 referencias** a `service-requests`; los gates estáticos arrancaban en verde (`a11y:check` sin hallazgos, `audit:density:ci` 0 hallazgos nuevos / 0 conocidos / 28 tablas), así que cualquier hallazgo es de este tramo. **Entregado**: los **cuatro** archivos del plan, espejo de `pages/reviews`, con la cola abriendo en `NEW`, el **resumen de los seis estados** en la cabecera, el filtro de estado **con su conteo** y la búsqueda con rebote; la tabla con artículo (nombre, código y **slug publicado**), comprador (nombre+correo+teléfono), **atiende** (el vendedor **congelado** y su partner), motivo, pedido, estado con quién/cuándo y fecha; y el **modal de atención** con el estado nuevo (`IN_REVIEW`/`SCHEDULED`/`RESOLVED`/`REJECTED`/`CANCELLED`, la cola **no vuelve** a `NEW`) y la nota que **solo viaja si se escribió**, **proponiendo el paso natural** (`NEW` → `IN_REVIEW`) y **sin ofrecer la acción** en una cerrada (la fila **dice** «Cerrada»: el backend responde **400**); sin `create`, como pedía el plan. Los **tres** anclajes quedaron cableados con el permiso del **módulo**: `sales.routes.ts` (`permissionGuard(['service-requests:view'])`), `sidebar.config.ts` y `breadcrumb.service.ts`. **Medido**: **Karma 2287/2287** (19 casos nuevos del componente + los 4 del cliente HTTP = **23/23** del módulo en la corrida enfocada), `lint` «All files pass linting», `format:check` OK, `a11y:check` sin hallazgos, `audit:density:ci` sin hallazgos nuevos, `audit:important` 7/7 justificados, `audit:ng-deep` 0, `audit:pos-scope` 0 filtraciones, `typecheck:e2e` 0 y `ng build` 0 (1,33 MB inicial / 285,15 kB). **Declarado**: (1) **el anclaje del sidebar cambia respecto de §16.b** —que decía «Servicio al cliente → Solicitudes»—: **medido** que el modelo de navegación tiene **un solo nivel de hijos** (la misma razón que dejó escrita F8.3 para «Tienda online»), la entrada va en **Ventas → Servicio técnico**, junto a «Reseñas del canal», que es lo que §16.c anclaba; (2) el **enlace a la ficha** por `slug` **no** se cablea: el back office **no tiene URL de tienda** (medido: **0 referencias** a `storefront` en `src/` y los `environment*.ts` solo declaran `apiUrl`), así que el slug se muestra como texto y el enlace espera una **decisión de configuración**; (3) la pantalla **no** entra todavía en el barrido de axe ni en la densidad dinámica (misma deuda que declaró la cola de reseñas), y no tiene spec E2E de UI (el plan no la pedía); (4) la fecha se muestra **tal como la publica el ERP** (mismo criterio que las reseñas) y la **nota es interna**: el comprador no recibe aviso (**D16**).

### §16.b F6 tramo 6 — **servicio técnico**: decisión del usuario y plan (2026-09-25, T228, pendiente de implementar)


**Decisión del usuario (2026-09-25)**: el tramo 6 es una **solicitud de servicio técnico desde la ficha, atendida por el vendedor**, con el vendedor entrando como **partner**. El modelo `Seller` ya tiene `partnerId` (opcional) desde F1, así que «el vendedor es el partner» no necesita estructura nueva: la solicitud apunta al `Seller` publicado y, si lo tiene, a su `Partner`.

**Alcance acordado (a implementar)**:

1. **Modelo `ServiceRequest`** (+ enum de estado y migración idempotente): `itemId` (el artículo publicado), `sellerId` (el vendedor de la publicación), `partnerId` (el del vendedor, si está), `webOrderId` (opcional: la compra que se está reclamando), `customerName`, `customerEmail`, `phone`, `issue` (el motivo escrito por el comprador), `status` (`NEW` → `IN_REVIEW` → `SCHEDULED` → `RESOLVED`, más `REJECTED`/`CANCELLED`), `resolutionNote`, quién y cuándo la atendió, y el rastro de auditoría del canal.
2. **Canal**: `POST /storefront/service-requests` con la clave del canal (D10) —exige que el artículo esté **publicado** y un **correo de contacto**; si viene **número de pedido + correo** se vincula la compra con la **misma identidad** que usan el seguimiento y las reseñas, y si no coincide responde 404— y la **ficha** publica `canRequestService` (con el vendedor) para que la tienda sepa que puede ofrecerlo.
3. **Back office**: módulo `service-requests` con permiso propio **`service-requests:view|attend`** y pantalla **Servicio al cliente → Solicitudes** (cola por estado, detalle con la compra vinculada y modal de atención con estado + nota).
4. **Tienda**: formulario en la ficha (islote) que manda por el puente `POST /api/servicio-tecnico` (la clave del canal no sale del servidor) y **dice lo que hace**: deja la solicitud en el ERP; no promete fecha ni técnico.
5. **Medición prevista**: unitarios del servicio (alta, validaciones, transiciones de estado, máscara del correo), canal E2E (alta con y sin pedido, 400 sin correo, 404 de artículo no publicado o de pedido ajeno), `Karma` del back office, E2E de la tienda (formulario + error del canal + éxito) y el rastro `STOREFRONT_SERVICE_REQUESTED` en `AuditLog`.

**Declarado de entrada**: la primera versión **no** lleva adjuntos ni agenda de técnico, y el aviso al comprador por correo sigue bloqueado por **D16**.

### §17 Cierre de la lista de pendientes: el fixture de la tienda, la huella del seed del ERP y los dos «pendientes» que no eran código (2026-09-25, T230/T231/T232)

**Lo que quedaba por hacer** tras T229 (la pantalla del servicio técnico) era: regrabar el fixture visual
de la tienda para que el gate cubriera el **bloque de servicios** (T227) y el **formulario de servicio
técnico** (T228), re-sellar la **huella del seed del ERP** (el conteo de artículos cambió) y decidir qué
pasa con F8.3 y F4.

**T230 — el fixture regrabado y un defecto del gate, medido**. **Medido antes**: los **33** JSON de
`storefront/e2e/visual/fixtures/` no tenían ni `canRequestService` ni el arreglo `services` (grep: **0**) y
la ficha del gate es `/productos/iphone-15-128gb`, así que sus dos capturas se generaron **antes** de
T227/T228; el canal vivo **sí** publica los dos datos (sonda contra la API: `canRequestService = true`,
`services = 1` → «Garantía extendida 12 meses», `itemId` 140, Bs 199). **Entregado**: fixture **regrabado**
(`STORE_VISUAL_RECORD=1`, **33** archivos, **14** modificados, **13** con `canRequestService`) y capturas
regeneradas. **DEFECTO DEL GATE MEDIDO Y CERRADO**: con el fixture ya nuevo, `producto-claro` seguía **sin**
los dos bloques mientras `producto-oscuro` —la **segunda** captura de la **misma** página— ya los pintaba;
la causa es la **caché de datos de Next** (`REVALIDATE.product = 60`; `.next/cache/fetch-cache` con **135**
entradas), que **vive en disco y sobrevive al `next start`** de cada corrida: la **primera** visita a una
ruta se pinta con los datos de la corrida **anterior** (`stale-while-revalidate`) mientras la revalidación
sí sale a la red —y por eso el fixture se grababa igual—. `storefront/e2e/visual/reset-data-cache.mjs` la
vacía antes de `next start`. **Medido (A/B)**: antes se regeneraron **2** capturas (las segundas de cada
página) y `producto-claro` no; después, **3** más (`inicio-claro`, `categoria-claro`, `producto-claro`), y
la ficha clara publica ya «Súmale un servicio» y el formulario; `e2e:visual` **17/17** (5 capturas revisadas
una por una), `e2e:a11y` **19/19**, `e2e:perf` **5/5**, `typecheck`/`lint`/`build`/`sync:*:check` en 0.
**Declarado**: el fixture queda grabado contra el seed vivo (la ficha pasa de `Disponible: 13` a `100` y
suma reseñas): es un fixture **inmutable**, no un seed congelado.

**T231 — la huella del seed del ERP, re-sellada, y su punto ciego**. **Medido antes (lo dijo el gate)**:
`npm run e2e:visual` del ERP falló con `Cambios: items 138→139 · Huella: 83ac2bf0-213 → f9c24e4f-213
(sellada el 2026-09-24T13:36:25.582Z)` y el conteo vivo se confirmó contra la API (`GET /items?limit=1` →
`total 139`). **Entregado**: `npm run e2e:visual:update` re-sella (`erp-frontend/e2e/screenshots/
.seed-fingerprint.json`, `f9c24e4f-213`, `items 139`). **Medido**: corrida de control **53/53** con
`updateSnapshots=missing → COMPARA` (la huella se **compara**: la rama de regeneración no se dispara sin
`--update-snapshots`) y **1** baseline regenerado. **Hallazgo declarado (no cosmético)**: ese baseline
(`sales-orders-form-after.png`) cambió porque el formulario dejó de pintar el **chip de serie** —la
resolución **automática** de `SALES_ORDER` para la fecha del gate es **ambigua** (medido: `GET
/document-series/next-preview?docType=SALES_ORDER&date=2026-09-15` → todo `null`, mientras `SALE_INVOICE`
resuelve `FVE-41`): conviven `PED-2026` y la **`WEB-` que crea el canal** (T222) cubriendo 2026, y la
`isDefault` (`PED-2027`, del arnés) no cubre esa fecha, así que `resolveSeries` corta por ambigüedad y
`peekNextDocumentCode` la **traga** por diseño (preview vacío; el guardado real sí valida con
`nextDocumentCode`)—. La huella **no cuenta `document-series`**, así que ese movimiento de datos es
**invisible** para ella: queda **declarado como punto ciego**, y **no** se añade a la huella porque el
arnés y el canal crean series en **tiempo de ejecución** y el gate se volvería intermitente. **Decisión
pendiente (para el próximo tramo, si se quiere cerrar)**: o la serie del canal deja de competir en la
resolución automática (marcarla/etiquetarla), o la resolución por fecha deja de ser ambigua cuando la
`isDefault` no cubre la fecha del documento.

**T232 — los dos «pendientes» que no eran código**. **Medido**: **F8.3 ya estaba entregada** —los **6**
archivos de `erp-frontend/src/app/pages/web-promotions/` desde `7220f7d6 (T215/F8.3)`, cableada en los
**tres** puntos (`sales.routes.ts`, `sidebar.config.ts`, `breadcrumb.service.ts`) y con su spec E2E de UI
`erp-frontend/e2e/web-promotions.spec.ts`; **Karma re-medido: 19/19**—, así que **no hay trabajo pendiente**
ahí (conserva la deuda que ya declaró T215: la pantalla no entra todavía en el barrido de axe ni en la
densidad dinámica). Y **F4 sigue bloqueada por D16**: **0** referencias a un proveedor de correo en
`backend-erp/src` y **0** pantallas de identidad entre los 13 `page.tsx` de la tienda, con **17** endpoints
en el canal y **ninguno de cliente**; sin correo transaccional no hay verificación, ni recuperación de
contraseña, ni aviso de pedido.

### §18 Fase 2 (retiro en tienda) y F4: la decisión de modelo, medida — y el orden de los tramos (2026-09-25, T233)

**La pregunta del usuario**: ¿el negocio debe poder elegir entre «1 sucursal con varios almacenes»
(donde los almacenes serían las tiendas físicas, para quien no quiere crear muchas sucursales) o
«varias sucursales, cada una con sus almacenes»? ¿O hay que soportar **las dos modalidades**?

**Lo que se midió antes de opinar** (nada de esto es supuesto):

| Hecho medido | Fuente |
|---|---|
| En **todo documento** el ERP exige `warehouse.branchId === document.branchId`, y un almacén **sin** sucursal se rechaza (`allowNullBranch=false` por defecto): «El almacén … no tiene una sucursal asignada. Asigne una sucursal al almacén antes de usarlo en un documento» | `src/common/warehouse-branch.util.ts` (+ spec: `stock-entries.service.spec.ts` «debería rechazar si el almacén no pertenece a la sucursal») |
| Los datos del punto de retiro viven en **`Branch`**: `phone`, `openingHours`, `latitude`, `longitude`, `mapUrl`, `pickupEnabled`. `Warehouse` solo tiene `address` | `prisma/schema.prisma` |
| Crear una sucursal cuesta **`code` + `name`**; `address`, `defaultWarehouseId` e `isActive` son opcionales. **No** exige serie propia: si la sucursal no tiene serie, `resolveSeries` cae al default global | `src/branches/dto/branch.dto.ts` y `document-series.service.ts` (`resolveSeries`, paso 2 y 3) |
| La sucursal es lo que arrastra **series**, usuarios, empleados, **terminales POS**, `JournalEntryLine.branchId`, todos los documentos y la ciudad del canal | `Branch` (relaciones del modelo) |
| La semilla ya modela **3 almacenes en una sucursal** (`SUC-01` ← `ALM-01/02/03`) y **1 en otra** (`SUC-LPZ` ← `ALM-LPZ`): 4 almacenes / 2 sucursales | `prisma/seed.ts`, `prisma/seed-storefront.ts` |
| El canal guarda por ciudad **1 sucursal de despacho** (`branchId`) + **1 almacén de existencia** (`warehouseId`) + costo/umbral de envío y plazo. **Una** sucursal, no varias | `WebCity` en el modelo y el `StorefrontCityView` |
| Granularidad fina aparte: existe **`CostCenter`** + reglas de reparto (para «resultado por tienda» sin tocar sucursales) | módulo `dimensions/cost-centers` |

**Decisión**: **no** se abre una «modalidad» con dos caminos de código. La regla única es
**`sucursal = punto con ubicación` (y por tanto el punto de retiro)** y **`almacén = depósito dentro de
esa sucursal`** (N por sucursal). Con eso:

- **«1 sucursal + N almacenes»** = un local con varios depósitos (bodega, exhibición, consignación) → ya
  soportado, sin tocar nada.
- **«N sucursales, cada una con sus almacenes»** = N locales físicos (tiendas/puntos de retiro) → ya
  soportado.
- **«La tienda física es un almacén»** queda **descartado con evidencia**: el documento revienta por la
  regla almacén⊂sucursal, el comprador no tendría horario/mapa/`pickupEnabled` que leer (viven en la
  sucursal), y el POS, la caja y el `branchId` contable de todas las tiendas caerían en la misma sucursal.
  Soportarlo exigiría **duplicar** la ubicación en `Warehouse` y **relajar** la regla: dos fuentes de
  verdad para el mismo dato.

Lo que **sí** hay que hacer configurable es lo que el negocio realmente necesita elegir: **cuántas
sucursales de retiro ofrece cada ciudad** → tabla del canal **`WebCityBranch`** (ciudad → sucursales de
retiro), que D8 ya anticipó («el vínculo ciudad → sucursales de retiro se agrega como tabla del canal
cuando entre el retiro, sin cambiar los enlaces actuales»). Con eso, los dos negocios se configuran **con
datos**, no con dos caminos de código.

**Buenas prácticas de ecommerce (BOPIS) que el modelo ya soporta y hay que respetar**:

1. **Solo ofrecer sucursales que puedan servir el pedido**: `pickupEnabled` **y** existencia del artículo
   en el almacén de esa sucursal (mostrar una tienda sin stock es la queja nº1 del retiro en tienda).
2. **Reservar la mercancía** del punto elegido hasta el retiro (la reserva con TTL del pedido abandonado
   ya existe).
3. **El pedido y su entrega deben decir la sucursal** (hoy `WebOrder` guarda `deliveryType`, `webCityId`,
   `warehouseId` y `addressJson`, y **ninguna** sucursal de retiro).
4. **Envío 0 en retiro**, dicho en el resumen.
5. **Horario, teléfono y «cómo llegar»** siempre visibles (es para lo que están los campos de `Branch`).
6. **Código de retiro** para el mostrador.

**Orden de los tramos** (y estado):

| # | Tramo | Estado |
|---|---|---|
| **A1** | **La cadena de publicación**: los datos de retiro de la sucursal son **editables por API** (`CreateBranchDto`/`UpdateBranchDto` + `BRANCH_SELECT`), el **canal los publica** en la ciudad (`GET /storefront/cities` → `branch.phone/openingHours/latitude/longitude/mapUrl/pickupEnabled`) y la tienda los **muestra** en `/sucursales` (horario, teléfono, «Ver el mapa» y «Retiro en tienda: disponible») | **ENTREGADO (T233)**: 3 suites / **141** unitarios (4 casos nuevos de `branches.service`, 9 del contrato del DTO, 1 de `storefront.service`), **canal E2E 49/49** (era 48), tienda `typecheck`/`lint`/`build`/`visual 17/17`/`a11y 19/19`/`perf 5/5` |
| **A2a** | **El formulario del ERP**: los 6 campos de ubicación y retiro en la pantalla de sucursales (hoy **0** referencias: el modelo los tenía y la semilla los cargaba, pero nadie podía editarlos desde la UI) | **ENTREGADO (T234)**: sección «Ubicación y retiro» con teléfono, horario, mapa, lat/lng y el interruptor de retiro; Karma **8/8**, `lint`/`format`/`a11y`/`densidad`/`build` en verde y **un** baseline regenerado y revisado (`branch-form-after.png`), con la corrida de control **53/53** |
| **A2b** | **La configuración del ecommerce** (lo que pidió el usuario): ajuste **`webStoreSource`** + tabla del canal **`WebStore`** (punto de venta que apunta a sucursal **o** almacén) + migración idempotente + módulo con permiso propio + pantalla **Configuración → Ecommerce → Puntos de venta** + el canal publicando los puntos de la ciudad + la tienda mostrándolos | **ENTREGADO (T235 + T236)**: **T235** — modelo `WebStore` + migración + módulo `web-stores` (`web-stores:view\|edit`) + ajuste `webStoreSource` con su control en **Ajustes → Sucursales** + canal publicando `stores[]` por ciudad + tienda pintándolos en `/sucursales` + **3 puntos** en la semilla (las dos modalidades en una misma ciudad); medido: `web-stores.service` 13/13, suites tocadas 4/155, canal E2E 50/50, sonda en vivo, tienda `visual 17/17`/`a11y 19/19`/`perf 5/5`, Karma de Configuración 14/14. **T236 (cierre)** — la **pantalla** de puntos (`/web-stores`, Configuración → Ecommerce) con su lista, filtros y modal, `GET /web-stores/cities` y **`GET /storefront/stores`**; medido: Karma 18/18, `web-stores.service` 14/14, suites tocadas 136/136, **canal E2E 51/51**, `tsc`/`lint`/`format`/`a11y`/`densidad`/`ng build` en verde y **`e2e:visual` 53/53** sin re-sellar la huella |
| **B** | **F4.1 «Mi cuenta» del dispositivo**: historial propio reusando `order+email`, direcciones locales y carrito/comparador/favoritos colgando de ahí. **Cero backend, sin D16** | pendiente |
| **C** | **Retiro elegible**: `WebCityBranch`, selector de sucursal en el paso 2, `pickupBranchId` en `WebOrder`, **envío 0** en retiro y el almacén del pedido derivado de la sucursal elegida (`defaultWarehouseId`), respetando la regla almacén⊂sucursal | pendiente |
| **D** | **Disponibilidad por sucursal de retiro** (ofrecer solo las que tienen el artículo) + **código de retiro** | pendiente |
| **E** | **F4.2/F4.3 identidad real**: `WebCustomer` con la contraseña que el modelo ya tiene + sesión con cookie del **canal** (D1/D2) + direcciones desde las `PartnerAddress` del tercero enlazado, **o** OAuth si se decide esquivar D16 | pendiente (bloqueado por D16 o por la decisión de OAuth) |

**Declarado de A1** (actualizado tras T234/T236): el formulario del ERP **ya existe** —A2a, sección
«Ubicación y retiro» en la pantalla de sucursales— y los puntos del canal se administran desde
**Configuración → Ecommerce** (A2b, T236), así que los datos de retiro y las tiendas ya no dependen de la
semilla; la semilla sigue trayéndolos para las dos sucursales demo. `/sucursales` **no** entra todavía en
el barrido de axe ni en el gate visual (ninguno de los dos la captura), y el fixture grabado del gate
sigue sirviendo un payload **viejo** sin los campos nuevos: la tienda los trata como opcionales a
propósito (la lección de T223) y por eso los tres gates siguen verdes sin regrabar el fixture.

### §19 A2b — la configuración del ecommerce y los puntos de venta del canal: diseño aprobado (2026-09-25, T234)

**Lo que pidió el usuario** (y lo que la medición destapó): poder **parametrizar cómo el ecommerce
obtiene sus tiendas**, porque hay clientes que crean **una sola sucursal** y ponen sus tiendas físicas
como **almacenes en ubicaciones distintas**, y otros que crean **una sucursal por tienda**; en ambos
casos el comprador debe elegir ciudad y ver la lista de tiendas que corresponda.

**Medido antes de decidir**:

| Hecho | Fuente |
|---|---|
| El ERP **ya declara la modalidad del tenant**: el ajuste **«Permitir múltiples sucursales»** (`enableBranches`, default `true`) oculta el selector de sucursal, el toggle «ver almacenes de todas las sucursales» y la etiqueta de sucursal en traspasos | `settings.service.ts`, `settings.component.html`, `branch-filter-select`, `commercial-document-form.base` |
| `assertWarehousesInBranch` **retorna temprano si el documento no tiene sucursal** | `src/common/warehouse-branch.util.ts` |
| **No existe superficie de configuración del canal**: `WebCity` y `WebApiKey` solo los escribe la **semilla** (sin módulo, sin controller, sin pantalla); lo único configurable desde la UI es `webOrderTtlHours` | grep de `webCity`/`webApiKey` en `backend-erp/src` y de `web-city` en `erp-frontend/src` |
| Los datos de ubicación/retiro viven **solo en `Branch`**; `Warehouse` tiene **solo `address`** | `prisma/schema.prisma` |

**Decisiones del usuario (2026-09-25)**: **(1)** se implementa con **tabla del canal** (recomendación
técnica aceptada); **(2)** la configuración vive en **Configuración → Ecommerce**; **(3)** **cada punto trae
su almacén** y la ciudad queda como valor por defecto para el envío a domicilio sin tienda elegida.

**Diseño**: el canal estrena **`WebStore`** (punto de venta/retiro), que apunta a **sucursal o almacén**
según `kind`, y guarda lo que el canal publica (con **herencia** del maestro cuando el campo viene `null`):

```
model WebStore {
  tenantId, webCityId            // a qué ciudad de la tienda pertenece
  code, name, sortOrder, isActive
  kind: BRANCH | WAREHOUSE       // ← la modalidad, POR PUNTO (no un booleano global)
  branchId?, warehouseId?        // vínculo al maestro (uno de los dos, según kind)
  address?, phone?, openingHours?, latitude?, longitude?, mapUrl?   // null = hereda del maestro
  pickupEnabled (default true)
}
```

**Invariantes** (en el servicio, con spec que las pinza — **ninguna regla del ERP se relaja**):
- `kind = BRANCH` → `branchId` obligatorio; el almacén del pedido = `warehouseId ?? branch.defaultWarehouseId`, y debe cumplir `warehouse.branchId == branchId` (la regla sigue siendo del ERP).
- `kind = WAREHOUSE` → `warehouseId` obligatorio y `branchId` **derivado** del almacén (o `null` si el tenant no usa sucursales, que es justo el caso de `enableBranches=false`).
- El punto resuelve **siempre** a `(branchId, warehouseId)`, así que el documento del pedido no cambia de forma entre modalidades.

**Ajuste**: **`webStoreSource: 'BRANCH' | 'WAREHOUSE'`** en `SystemSettings` (patrón de `webOrderTtlHours`,
con default coherente con `enableBranches`) = la modalidad con la que se **proponen** los puntos nuevos;
cada punto puede exceptuar con su `kind` (soporta el caso mixto sin código condicional).

**Superficie**: **Configuración → Ecommerce** (nueva): clave del canal y orígenes, ciudades, **puntos de
venta** y los ajustes del canal. Hoy **no existe nada de eso** (medido), así que este tramo es también el
primer sitio donde la empresa configura su tienda sin tocar la semilla.

**Lo que la tienda gana**: pide ciudad → pide `stores[]`, **siempre la misma forma de respuesta**; en
modalidad almacén cada punto es un almacén-tienda y en modalidad sucursal cada punto es una sucursal, y el
front **no ramifica**. Los mismos datos (horario, teléfono, mapa, «Retiro en tienda») en los dos casos.

**Lo que se descartó (y por qué)**: añadir los 6 campos de la sucursal a **`Warehouse`** con un booleano
global. Duplica el bloque de ubicación en dos maestros (dos fuentes de verdad: el admin tendría que saber
cuál lee el ecommerce según el modo), el formulario de almacenes tendría que ganarlos (con su baseline),
no expresa el caso mixto y obliga a la tienda a saber en qué modo está. Más barato hoy, más caro de
mantener.

**T236 — A2b cerrado: la pantalla de puntos de venta y el endpoint propio de puntos (2026-09-25)**.
**Medido antes**: en `erp-frontend/src` había **0 referencias** a `web-stores` (sin ruta, pantalla,
sidebar ni breadcrumb), **ningún** endpoint de back office listaba `WebCity` (las escribía la semilla) y
los puntos viajaban **solo** dentro de `GET /storefront/cities` — la tienda no tenía forma de pedir la
lista sin pedir la ciudad entera. **Entregado**: **(1)** **Configuración → Ecommerce → Puntos de venta**
(`/web-stores`, permiso propio `web-stores:view|edit`, espejo de `pages/web-promotions`): lista con
ciudad, nombre y código, tipo (*Sucursal* / *Almacén (hace de tienda)*), de qué cuelga (el maestro con su
código), la ubicación publicada con **«Heredado: …»** debajo, retiro y estado, más búsqueda con rebote,
filtros de ciudad y tipo, «Solo activos» por defecto y paginación; el **modal** pide ciudad, **código**
(solo en alta: es la identidad), nombre, de qué cuelga la tienda —selector de sucursal o de almacén según
el tipo, con la ayuda de qué se hereda—, la ubicación (**vacío = heredar del maestro**), retiro, orden y
activo; **cambiar de tipo limpia el maestro del otro** y exige el suyo, y el payload de un punto-almacén
**no manda `branchId`** (lo deriva el backend del almacén); **(2)** `GET /web-stores/cities` para el
selector; **(3)** el canal estrena **`GET /storefront/stores`** (`?city=`, o todas las ciudades activas)
con **una sola traducción** (`toStorefrontStore`, compartida con `listCities`) y **400** accionable para
una ciudad no habilitada. **Dos defectos medidos y cerrados**: **(a)** el filtro de ciudad se armaba en la
plantilla con `.concat(...)` sobre arrays de tipo distinto y el **build AOT** lo rechazó → las opciones se
construyen en el componente (`cityFilterOptions`); **(b)** `GET /storefront/stores` sin ciudad ordenaba
por `sortOrder` a secas y **mezclaba** tiendas de dos ciudades con el mismo orden (lo destapó el E2E) →
el listado va **agrupado por ciudad** (`webCity.sortOrder`, luego `sortOrder`, luego `id`). **Declarado**:
un punto se **desactiva** (no se borra: el histórico de los pedidos que lo eligieron se conserva) y la
pantalla **no** entra todavía en el barrido de axe ni en la densidad dinámica (el `a11y:check` estático
sí la cubre). **A2b cerrado**; el tramo siguiente es **C**.

**T237 — la pantalla no abría: el DTO del listado no aceptaba los filtros que la pantalla manda
(2026-09-25)**. **Lo que pasó**: al entrar en **Administración → Ecommerce** el ERP respondía **400**
`property page should not exist, property limit should not exist, onlyActive must be a boolean value`.
**Medido antes** (sonda en vivo contra la API en marcha, con la query exacta de la pantalla): de **8**
variantes **5 daban 400** —el mensaje literal con `page=1&limit=20&onlyActive=true`, `onlyActive must be
a boolean value` con `onlyActive=true` y **`cityId=1`** con `cityId must not be less than 1` / `cityId
must be an integer number`, un filtro que el usuario todavía no había tocado— frente a **3** en 200
(`kind=BRANCH`, `search=centro` y sin filtros: los únicos parámetros de **texto**). **Causa raíz**:
`WebStoreQueryDto` era el **único** DTO de consulta del módulo sin las conversiones de `class-transformer`
que sí tienen sus hermanos (`review-query.dto.ts` → `toNumber`; `web-order-query.dto.ts` →
`toNumber`/`toBoolean`) y **no declaraba `page`/`limit`** aunque `WebStoresService.findAll` **ya los leía**
con `parsePagination`: con el `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`) una propiedad
no declarada es **400** —no un filtro ignorado— y un query string llega **siempre como texto**. **Por qué
ningún gate lo vio**: el spec del servicio llamaba al servicio **directo** (sin DTO ni pipe), el spec de
Karma afirmaba **la URL que compone** el servicio HTTP y no que el backend la acepte, y el E2E del canal no
tocaba el endpoint de back office (creaba los `WebStore` por Prisma). **Cerrado** con
`@Transform(toNumber)` en `cityId`/`page`/`limit` (el tope de 100 sigue en `parsePagination`) y
`toBoolean` en `onlyActive`, más **dos gates nuevos**: `web-store.dto.spec.ts` (**9 casos**, valida con las
**mismas opciones del pipe** y los parámetros **tal como viajan**: `'1'`, `'20'`, `'true'`) y un caso E2E
que pide `GET /api/web-stores?page=1&limit=20&onlyActive=true&cityId=N` con el **JWT del ERP** y comprueba
que el filtro acota. **Medido después**: sonda en vivo **8/8 en 200**, `web-stores` **23/23**, **canal E2E
52/52** (era 51), `tsc`/`eslint`/`prettier` en 0. **Sin cambios en el frontend**: la pantalla ya mandaba lo
que el contrato dice.

## §15 F7 y F4 — estado medido y decisiones pendientes (2026-09-24, T217)

Los dos tramos que quedan del orden acordado **necesitan decisiones de producto**, así que
antes de tocar nada se midió el estado real (no se asumió nada del plan):

### F7 — decisión del usuario (2026-09-24): DOS modalidades de facturación

**Elegidas por el COMPRADOR en el checkout** (respuesta del usuario al cierre del tramo): la elección viaja como modalidad de pago — «pagar ahora» ⇒ `pedido web → factura → pago → entrega`; «pagar al recibir» ⇒ `pedido → entrega → factura → pago` — y **no** es un ajuste por empresa. El canal **reutiliza los flujos de Ventas** del ERP y asigna la serie **`WEB-`** a los pedidos del canal; con «facturar primero», el **barrido de abandonados** tiene que anular **reserva y luego pedido** (medido: el `cancel` del pedido falla con documentos posteriores).

El usuario eligió **sin PSP** (el checkout sigue offline) y **dos modalidades**, con la
**factura de reserva** como documento fiscal del canal y serie **`WEB-`** para los pedidos web
(que es configuración, no migración: el `DocumentType` `SALES_ORDER` existe y el modelo admite
varias series por tipo). Las dos cadenas **ya tienen sus endpoints** (medidos):

| Modalidad | Cadena | Endpoints medidos | Consecuencia medida |
|---|---|---|---|
| **A — facturar al pedir y pagar** | pedido → **reserva** → cobro | `sale-reserve-invoices/from-order/:orderId` ✓, `incoming-payments` con `lines[].saleReserveInvoiceId` ✓ | **Choca con el barrido de abandonados (D14)**: el `cancel` del pedido **falla con documentos posteriores** (medido en T192), así que un pedido impago con reserva emitida dejaría el barrido en `error`; hay que anular **también la reserva** (o emitir la reserva solo al cobrar) |
| **B — facturar al recibir** | pedido → **entrega** → **reserva desde la entrega** → cobro | `delivery-orders/from-order/:orderId` ✓, `sale-reserve-invoices/from-delivery/:deliveryOrderId` ✓, `incoming-payments` ✓ | La entrega **no** debe nacer de la reserva (la reserva no existe todavía): nace del pedido, y la reserva **de la entrega** |

**DEFECTO QUE LA MEDICIÓN DESTAPÓ (T218, corregido)**: con la modalidad A, el seguimiento del
comprador publicaba **`DELIVERED`** (con `deliveryStatus = PENDING` y **ninguna entrega**) porque
la tabla de traducción daba por entregado a un pedido **facturado** —y la reserva factura sin
entregar—. Ahora `DELIVERED` **exige entrega** y la facturación se publica aparte
(`invoiceStatus`), con el pago en `paymentStatus`: medido en vivo (`PED-235` / `FRV-48` /
`COB-1058`).

**Pregunta pendiente (una sola)**: ¿la modalidad la elige el **comprador en el checkout** (dos
opciones de pago: «pago ahora» vs «pago al recibir») o se **configura por empresa** (ajuste
`webInvoicingMode`, con el mismo patrón que `webOrderTtlHours`)? Y en cualquiera de los dos:
¿cuál es la **modalidad por defecto**?

### F7 — estado medido (2026-09-24, T217)

| Punto | Estado medido |
|---|---|
| **PSP de tarjeta** | **No existe nada**: 0 coincidencias de `stripe`/`paypal`/`mercado pago`/`pasarela`/`paymentGateway` en `backend-erp/src`; el checkout solo cobra **offline** (transferencia, QR, contra entrega) y el pago se concilia a mano. Es greenfield: hay que elegir proveedor (y su modo de integración: hosted fields/redirect) |
| **Serie propia del canal** | **La infraestructura ya lo permite**: `DocumentSeriesService.nextDocumentCode(..., requestedSeriesId)` acepta una serie **por documento** y `DocumentSeries` admite **varias series por `docType`** (con prefijos distintos); el `DocumentType` es un enum cerrado y **no hace falta un valor nuevo** — la serie del canal puede ser una `DocumentSeries` de `SALE_INVOICE` (o de `SALES_ORDER`) con prefijo propio. Hoy el pedido web usa la serie por defecto de `SALES_ORDER` (declarado desde T188) |
| **Factura del pedido** | **Existe el flujo**: `POST /sale-invoices/from-order/:orderId`. Lo que **no** está decidido es **cuándo** la emite el canal (al confirmar el pago, al despachar, o a mano desde el back office) ni quién la dispara |
| **Cuotas** | El canal **no las calcula** y lo dice en la propia fuente (`storefront/src/lib/format.ts`: «NO se calculan cuotas… el canal no publica un plan de cuotas»); la insignia `CUOTAS` viene del ERP como **dato del artículo**, no como plan. Ojo con la homonimia: `InvoiceInstallment` del ERP son **cuotas de la factura** (plan de pago del `PaymentTerm`), **no** cuotas de tarjeta |
| **Conciliación del cobro** | **Sin medir de punta a punta**: el canal verifica `paymentStatus: 'pending'` en varios E2E, pero **ningún** caso cierra el ciclo (factura del pedido → `IncomingPayment` del ERP → el seguimiento pasa a `paid`, que es lo que deriva D13). Es un hueco **de prueba**, no de producto, y se puede cerrar sin ninguna decisión |

### F4 — Cuenta del cliente

| Punto | Estado medido |
|---|---|
| Rutas y endpoints | **Ninguno**: 0 rutas de cuenta en la tienda (**re-medido 2026-09-25, T232: 13 `page.tsx` y ninguno de cuenta, login, registro o contraseña**) y **0 endpoints de cliente** en el canal (**re-medido: 17 endpoints** —catálogo, ficha, relacionados, categorías, marcas, vendedores, banners, páginas, ciudades, cotización, pedido, seguimiento, referencia de pago, barrido, reseñas y servicio técnico—, ninguno de cliente) |
| Identidad | D1/D2 fijan que la tienda **no usa cookies del ERP** y que el carrito es del comprador; `WebCustomer` existe (3 clientes en el seed) y la cotización ya resuelve el precio del **cliente registrado por correo** (D12), pero **no hay credenciales ni sesión** de comprador |
| Dependencia dura | El **correo transaccional (D16) sigue sin proveedor** —re-medido 2026-09-25 (T232): **0** referencias a `nodemailer`/`@nestjs-modules/mailer`/`sendgrid`/`resend`/`mailgun`/`aws-sdk`/`createTransport` en `backend-erp/src`—: sin él no hay verificación de correo, ni recuperación de contraseña, ni aviso de pedido. Cualquier F4 con registro real queda a medias, así que **F4 sigue bloqueada por una credencial externa** y no por código |

### Preguntas para decidir (antes de escribir código)

1. **PSP**: ¿se integra una pasarela ahora (**cuál** y con qué modo: hosted fields o redirect?) o F7 se queda en offline y se salta a F4?
2. **Factura del canal**: ¿**cuándo** se emite (`from-order`) y con **qué prefijo de serie** (p. ej. `WEB-`)? ¿La emite el canal al confirmarse el pago o el back office a mano?
3. **Correo (D16)**: ¿hay proveedor/credenciales (SMTP/SES/Resend) para desbloquear F4, o F4 espera?
4. **Orden**: mientras se decide, ¿cierro el hueco **de prueba** de la conciliación del cobro (sin decisiones) y sigo con F6, o prefieres otro orden?

### §15.b Tramo 1 CERRADO — la duplicación del progreso del canal (2026-09-24, T221)

**Lo que se buscaba**: antes de tocar F7 había que cerrar la deuda que T220 dejó declarada —la
regla del progreso vivía **tres veces** (el recálculo del ERP, la lectura del pedido y el canal)—
porque F7 mueve pedidos por cadenas nuevas y con tres copias cualquier cadena nueva se leería
distinto en cada superficie.

**Medido antes** (`PED-237`/`PED-238`, pedidos reales con el flete `WEB-ENVIO` como línea de
**servicio**): el documento ya publicaba `deliveryStatus: FULL` con `invoiceStatus: FULL` y la
línea de servicio en `delivered=0`; el **seguimiento del comprador** devolvía `"status":"SHIPPED"`
y la **bandeja** derivaba su estado sumando `deliveredQty` de **todas** las líneas.

**Entregado (T221)**: el canal **traduce** el progreso del ERP y no lo recalcula — el util
compartido recibe `{status, deliveryStatus, invoiceStatus, saleInvoices}`; las dos consultas que
lo alimentan piden las **columnas del documento** en vez de sus líneas; y la regla queda **una
sola** en `computeSalesOrderProgress` (T220).

**Medido después**: en vivo, `GET /storefront/tracking?order=PED-237` → `"status":"DELIVERED"`
(A/B: antes `"SHIPPED"`); unitarios del util **9/9**, las tres suites tocadas **114/114** y el
canal E2E **43/43** con el caso nuevo del flete —que con el código anterior falla con
`deliveryStatus: PARTIAL`—; backend **198 suites / 2467 tests**.

**Declarado**: `deliveryStatus`/`openQty` siguen siendo datos **denormalizados** (necesitan el
backfill `scripts/recalc-order-progress.mjs` cuando la regla cambia) y el canal publica el
progreso **tal como lo tiene el documento**.

### §15.c Tramo 2 — F7, plan de implementación (modalidad elegida por el comprador + serie `WEB-` + barrido)

Con la decisión del usuario (**el comprador elige**, sin PSP) y el tramo 1 cerrado, el trabajo de
F7 queda así, **sin ninguna decisión abierta**:

1. **La modalidad viaja con el pedido**: `WebOrder.webInvoicingMode` (`PAY_NOW` =
   «pagar ahora» / `PAY_ON_DELIVERY` = «pagar al recibir»), elegida en el checkout, con su
   migración idempotente, su validación en el DTO del canal y su publicación en la confirmación,
   el seguimiento y la bandeja (lo que el comprador eligió se ve, no se adivina).
2. **Cadena A (`PAY_NOW`)** — `pedido → reserva → cobro → entrega`: el canal emite la **factura
   de reserva** desde el pedido (`sale-reserve-invoices/from-order/:orderId`) al crear el pedido
   —es la reserva de la mercancía—, el cobro lo registra el ERP contra la reserva
   (`incoming-payments` con `lines[].saleReserveInvoiceId`) y la entrega sale **de la reserva**.
   La opción de pago del checkout se limita a los medios **offline** que ya existen (transferencia,
   QR, contra entrega) porque no hay PSP (decisión del usuario).
3. **Cadena B (`PAY_ON_DELIVERY`)** — `pedido → entrega → reserva desde la entrega → cobro`: la
   entrega nace del **pedido** (`delivery-orders/from-order/:orderId`), la reserva nace **de la
   entrega** (`sale-reserve-invoices/from-delivery/:deliveryOrderId`) y el cobro se registra
   contra esa reserva.
4. **Serie del canal**: se **asegura** una `DocumentSeries` con prefijo `WEB-` (por empresa) para
   el documento del pedido web y se asigna **explícitamente** al crear el pedido
   (`nextDocumentCode(..., requestedSeriesId)`), en vez de depender de la serie por defecto. Si la
   serie no existe se **crea** con los datos del tenant (y se verifica en vivo que el pedido sale
   con el correlativo `WEB-`).
5. **Barrido de abandonados (D14) endurecido**: con la cadena A el pedido tiene **reserva
   emitida**, así que el `cancel` del pedido **falla con documentos posteriores** (medido en
   T192); el barrido anula **primero la reserva y después el pedido**, y lo deja medido con un
   caso E2E (pedido impago con reserva → anulado, existencia liberada, sin `error` en el resumen).
6. **Evidencia**: unitarios del canal por modalidad (los dos caminos), el E2E del canal con **las
   dos cadenas** de punta a punta (estado derivado en cada paso), la tienda mostrando la elección,
   y la bandeja publicando la modalidad. Lo que **no** se hace: cobro con tarjeta, cuotas de
   tarjeta y correo al comprador (D16) — siguen declarados.

### §15.d Tramo 2 ENTREGADO — F7: modalidad elegida por el comprador, serie `WEB-` y barrido endurecido (2026-09-24, T222)

El plan de §15.c se implementó **completo y sin decisiones abiertas**:

| Punto | Entregado | Evidencia |
|---|---|---|
| La modalidad viaja con el pedido | `WebOrder.webInvoicingMode` (`PAY_NOW` / `PAY_ON_DELIVERY`, enum + migración idempotente) elegida en el checkout y publicada con la reserva emitida (`reserveInvoiceId`, `reserveInvoiceCode`) | unitarios del canal + canal E2E **44/44** |
| Cadena A — «pagar ahora» | El alta emite la **factura de reserva** (todas las líneas: mercancía y flete) antes de publicar la proyección; el cobro se registra **contra ella** y la entrega sale de la reserva | E2E: `WEB-1` → reserva de 2 líneas → cobro → entrega → `DELIVERED` |
| Cadena B — «pagar al recibir» | La entrega nace del pedido, la reserva nace **de la entrega** y el cobro se registra contra ella | E2E: sin documento al crear (`invoicedQty 0` en todas las líneas) → entrega → reserva (`invoiceStatus: PARTIAL`, el flete aún sin facturar) → cobro → `paid` |
| Serie del canal | `WEB-` se **resuelve por empresa y se crea si falta** (requiere gestión vigente; sin ella cae a la serie por defecto, declarado) y se asigna explícitamente al pedido | E2E: el pedido sale `WEB-1`; unitarios de los tres caminos |
| Barrido endurecido | Anula **primero la reserva y después el pedido** (el `cancel` del pedido falla con documentos posteriores, T192) y tolera una reserva ya anulada | unitarios de las dos formas |

**Lo que NO se hizo, y sigue declarado**: cobro con tarjeta (sin PSP, decisión del usuario),
cuotas de tarjeta y correo al comprador (**D16**, que es lo que bloquea F4). El retiro en tienda
sigue en fase 2. La entrega de la cadena A la **dispara el back office**: el canal emite el
documento, cobra contra él y el despacho se registra desde el ERP (es el mismo camino que ya
existía y no se automatiza un despacho físico).

## §14 F9 — Identidad visual y experiencia premium de la tienda (plan aprobado el 2026-09-23)


**La pregunta del usuario**: la tienda «se ve algo básica, no parece tener un estilo premium».
**Medido antes de proponer** (no es una impresión): la estructura funciona y la **capa de tokens es
buena**, pero la **capa visual no existe**. En concreto:

- **Tipografía**: los tokens del ERP **declaran Inter** (`_06-typography.scss` → `--font-sans`,
  `--font-display`), pero el storefront **no la carga** (no hay `next/font` ni `<link>`): cada equipo
  renderiza la fuente del sistema y los títulos no usan `--font-display`. El ERP **sí** la sirve
  **self-hosted** (`erp-frontend/public/assets/fonts/inter-{400,500,600,700}-{latin,latin-ext}.woff2`,
  generados por `scripts/fetch-webfonts.mjs`).
- **Identidad**: `SITE_NAME = 'Tienda ERP'` y el logo es un cuadro con «TE» pintado con el **índigo de
  LUNA** (`--accent-600`), es decir el color del back office. El §3 ya previó «tema por tenant» pero
  **no está implementado**: no hay capa de marca.
- **Home**: hero = 2 banners en grilla `aspect-[16/6]` con título/subtítulo planos, después **dos
  secciones idénticas** (ofertas y destacados) con la misma grilla de 4 columnas, categorías como
  tarjetas de texto y una franja de banners. Sin campaña a sangre, sin barra de beneficios, sin
  carrusel, sin categorías visuales, sin bloque de pagos/cuotas/envío.
- **Tarjeta**: borde 1px, sombra **solo al hover**, imagen cuadrada sobre gris, precio `text-lg`.
  Sin acciones rápidas, sin etiquetas de beneficio, sin zoom, sin skeleton.
- **Ficha**: dos columnas planas, precio en un bloque bordeado, entrega/garantía como **lista de
  texto**, ficha en tabla. El botón agrega **siempre 1 unidad**.
- **Filtros**: dos `<select>` nativos + botón + chips. Funcional (GET sin JS), visualmente básico.
- **Checkout**: 974 líneas de formulario sin pasos visuales ni barra de progreso.
- **Imágenes**: marcadores `picsum.photos` (dato de desarrollo) — **el mayor limitante** percibido.
- **Sin usar, ya disponible en los tokens**: sombras en capas, gradientes (`--gradient-*`), easings
  (`--ease-out-expo/spring`), duraciones y **`[data-theme=dark]` completo**: la tienda no usa nada
  de eso hoy.

### D22 — Dirección visual (aprobada el 2026-09-23)

**Retail tecnológico premium**: acento fuerte y propio, bloques de campaña, **precio protagonista**
y densidad media (ni la densidad operativa del back office ni el vacío editorial). Justificación: es
lo que mejor encaja con electrodomésticos/tecnología y con los datos que el ERP ya publica (oferta,
disponibilidad, entrega, cuotas).

### D23 — Identidad: tema de tienda propio, encima de los tokens (aprobada el 2026-09-23)

El storefront define su **propia capa de marca** (`src/styles/brand.css` + extensión de
`tailwind.config.ts`) con variables `--sf-*` de **marca** (acción, promo, precio, superficies de
imagen) **sin tocar** `src/styles/tokens.css` (artefacto con gate `sync:tokens:check`) y **sin
reemplazar** los neutros de LUNA, que se conservan como base. El tema es **configurable por tenant**
(§3): nombre, logo, paleta y tipografía entran por variables CSS inyectadas desde la configuración
de la tienda, con un tema por defecto «Retail tecnológico premium» en el código.

### D24 — Imágenes: placeholder propio, no fotos aleatorias (aprobada el 2026-09-23)

No hay fotos reales de producto todavía. La tienda **deja de pintar `picsum.photos`**: los hosts de
marcador (`picsum.photos`, `fastly.picsum.photos`) se tratan como **«sin foto»** y se renderiza un
**placeholder propio** (fondo neutro con degradado sutil, patrón de marca y monograma del artículo),
consistente en tarjeta, galería, carrito y checkout. Cuando el ERP publique fotos reales, se pintan
solas (la regla es por host, no por artículo).

### D25 — Tipografía self-hosted, sin red en el build (aprobada el 2026-09-23)

La tienda **sirve Inter desde su propio `public/fonts/`**, copiada de la capa del ERP por un script
con **gate propio** (`sync:fonts` / `sync:fonts:check`, mismo patrón que `sync:tokens`), y la carga
con `next/font/local`. **Nada de Google Fonts por red en el build**: el ERP ya migró a self-hosted
(T53) precisamente porque la red tardía falseaba la regresión visual. La jerarquía «display» se
consigue con **peso, tamaño y tracking** de la misma familia (400/500/600/700), no con una segunda
familia.

### D26 — Alcance (aprobado el 2026-09-23)

Las **seis fases** (F9.1 fundaciones → F9.2 home de campaña → F9.3 tarjeta y catálogo → F9.4 ficha →
F9.5 carrito y checkout → F9.6 cierre), **modo oscuro** y **gate visual propio** con baselines de la
tienda.

### Restricciones medidas que el rediseño NO puede romper

La tienda tiene **24 E2E funcionales** que hablan con la API real y dependen de `data-testid` y de
**controles nativos**; un rediseño tiene que conservarlos (inventario medido, no supuesto):

- **Controles nativos que los specs manejan como tales**: `selector-ciudad` (`<select>` →
  `selectOption`/`toHaveValue`), `filtro-marca` y `filtro-orden` (`<select>`), `checkout-delivery-home`
  (`.check()`), `cart-line-quantity` (`toHaveValue`). **No** se convierten en combos personalizados.
- **Testids de estructura**: `home-offers`, `home-featured`, `home-hero`, `product-grid`,
  `product-card`, `category-card(s)`, `category-title`, `search-summary`, `search-empty-state`,
  `buscador`, `pager-next`, `specs-table`, `gallery-thumb`.
- **Testids de dato**: `product-price`, `product-list-price`, `discount-badge`, `product-availability`,
  `detail-price`, `detail-discount-badge`, `price-kind`, `detail-availability`, `product-title`,
  `product-badge`, `product-city`, `add-to-cart`, `add-to-cart-blocked`, `add-to-cart-status`,
  `cart-count`, `cart-link`, `cart-items`, `cart-line`, `cart-line-remove`, `cart-checkout-note`,
  `cart-checkout-link`, `filtros-resumen`, y los ~60 de checkout/pedido/seguimiento
  (`checkout-step-1..3`, `checkout-quote-*`, `order-*`, `payment-reference-*`, `tracking-*`).
- **Reglas de arquitectura**: `server-only` en `src/lib/erp.ts` (D10: el navegador nunca llama al
  ERP), mobile-first, `sync:tokens:check` en verde, y los únicos islotes cliente siguen siendo
  buscador, selector de ciudad, carrito, galería, botón de compra (+ el nuevo conmutador de tema).

### Fases, entregables y evidencia

| Fase | Entregable | Evidencia de cierre |
|---|---|---|
| **F9.1 Fundaciones** | Tipografía self-hosted con gate; capa de marca `--sf-*` (claro y oscuro); escala tipográfica y de espaciado; componentes base (botón, badge, chip, precio, tarjeta, skeleton, encabezado de sección); **modo oscuro** con conmutador sin destello; **placeholder de imagen propio**; shell (header con buscador y navegación con estado activo, footer) y migración de la tarjeta de producto a los componentes nuevos | `build`/`lint`/`typecheck` en 0, `sync:tokens:check` y `sync:fonts:check` OK, **E2E 24/24**, capturas antes/después de home, ficha y listado en claro y oscuro |
| **F9.2 Home de campaña** | Hero a sangre con campaña, barra de beneficios, ofertas en carrusel horizontal, categorías visuales, bloque de confianza (envío/pagos/cuotas), secciones asimétricas | E2E `home.spec.ts` y `ciudad.spec.ts` verdes, capturas, LCP/CLS medidos |
| **F9.3 Tarjeta y catálogo** | Tarjeta con hover elevado, etiquetas de beneficio, skeletons, quick-add desde la grilla; panel de filtros y orden con chips, contador y limpiar; estados vacíos cuidados | E2E `categoria.spec.ts`, `buscar.spec.ts` y `carrito.spec.ts` verdes + capturas |
| **F9.4 Ficha** | Buy-box sticky, galería con miniaturas y zoom, tarjetas de entrega/garantía/cuotas, acordeones para la ficha técnica, relacionados mejorados | E2E `producto.spec.ts` verde + capturas |
| **F9.5 Carrito y checkout** | Carrito tipo panel con resumen, checkout por pasos con barra de progreso, resumen sticky, estados de error y carga cuidados | E2E `checkout.spec.ts` y `carrito.spec.ts` verdes + capturas |
| **F9.6 Cierre** | **Gate visual propio** con baselines de la tienda; revisión de accesibilidad y contraste (claro y oscuro); presupuesto de rendimiento; documentación (plan, AUDIT, CHANGELOG, AGENTS) | `npm run e2e:visual` propio en verde, auditoría a11y sin hallazgos, E2E funcional 24/24 |

### Huecos y riesgos declarados

1. **No hay fotos reales** (D24): el placeholder propio es una solución honesta, pero el salto
   «premium» completo exige fotografía de producto con fondo blanco y relación de aspecto constante.
2. **Los banners del hero vienen del CMS del ERP** (`home-hero`): una campaña a sangre necesita
   imágenes de campaña de calidad y, si se quieren más piezas, más banners en el slot (dato, no CSS).
3. **El número de slots de banner es fijo** (`home-hero`, `home-strip`): si F9.2 necesita un slot
   nuevo (p. ej. `home-mid`), es un cambio de datos del ERP, no de la tienda.
4. **Sin pasarela**: el pago sigue siendo offline (transferencia/QR), así que el checkout no puede
   prometer «pago en un clic»; el diseño lo dice explícitamente.
5. **Tema por tenant sin UI todavía**: D23 deja las variables listas y un tema por defecto; la
   pantalla del back office para editar la identidad de la tienda es trabajo del ERP (fase aparte).
6. **El conmutador de tema es un islote cliente nuevo**: se documenta como excepción declarada a la
   lista de islotes del README (no conoce la clave ni la URL del ERP).

### §14.b Estado de F9.1 — fundaciones (medido el 2026-09-23, T203)

**Lo entregado**: la tienda deja de depender de la fuente del sistema y del color del back office.

- **Tipografia self-hosted (D25)**: `scripts/sync-fonts.mjs` copia los **8 `.woff2`** de Inter
  (400/500/600/700 × latin/latin-ext, **521 KB**) desde `erp-frontend/public/assets/fonts` a
  `public/fonts`, con gate propio `sync:fonts:check` (compara hash). `src/styles/fonts.css` los
  declara con `@font-face` + **`unicode-range`** (mismo mecanismo que el ERP desde T53) y el
  `layout.tsx` precarga los pesos 400 y 700. **Desviacion declarada**: no se uso
  `next/font/local` porque no expresa `unicode-range` y con dos archivos del mismo peso en un `src`
  multiple solo usaria el primero; el resultado que pedia D25 —Inter self-hosted, sin red en el
  build, con subsets— es el mismo.
- **Capa de marca (D22/D23)**: `src/styles/brand.css` define `--sf-*` (accion, promocion,
  descuento, precio, superficies de imagen, formas y elevacion, escala de titulos) para claro y
  oscuro; `src/app/globals.css` estrena la capa de componentes de la tienda (`.sf-btn*`,
  `.sf-badge*`, `.sf-chip`, `.sf-card*`, `.sf-panel`, `.sf-field`, `.sf-media`, `.sf-h1/h2/h3`,
  `.sf-price*`, `.sf-skeleton`, `.sf-scroll-x`, `.sf-icon-btn`) y `tailwind.config.ts` mapea
  `primary`/`fg.accent`/`border.accent`/`border.focus` a la marca de la tienda y
  `font-sans`/`font-display` a `--sf-font-*`. **`tokens.css` no se toco**: `sync:tokens:check` sigue
  en verde.
- **Modo oscuro**: `src/lib/theme.ts` + script inline en el `<head>` que aplica `data-theme` antes
  del primer pintado (sin destello) y el islote `theme-toggle` (nuevo islote declarado). La
  preferencia es local del comprador (`localStorage`), no viaja al ERP; el icono arranca neutro para
  no provocar desajuste de hidratacion.
- **Imagenes (D24)**: medido en la base — **104** `Item.imageUrl` y **324** `ItemImage.url`, **todos**
  en `picsum.photos`. La tienda ya no pinta fotos aleatorias: `src/lib/media.ts` reconoce los hosts
  de marcador y `ProductPlaceholder` dibuja fondo neutro + halo de marca + monograma + marca; el
  arte de campana del CMS (`home-hero`/`home-strip`) **si** se pinta tal cual (`allowStockHost`),
  porque una foto de campana es intencional. La galeria de la ficha usa el mismo criterio.
- **Cascaron y piezas base**: cabecera translucida con marca, buscador integrado, selector de
  ciudad, conmutador de tema y carrito como accion principal; navegacion de categorias con
  `aria-current` y submenu `<details>` (sigue funcionando sin JavaScript); pie con cuatro columnas y
  la nota de que el ERP es la fuente de verdad; componentes `Price` (precio + «antes» + ahorro +
  leyenda), `Badge`, `SectionHeader` y `Skeleton`; la **tarjeta de producto** migrada a esos
  componentes (hover elevado, zoom de imagen, etiqueta de descuento, disponibilidad con punto de
  estado) y la home con la escala tipografica nueva.

**Evidencia medida**: `npm run typecheck` **0**, `npm run lint` **0/0**, `npm run build` **0** (First
Load JS compartido **87,1 kB**), `sync:tokens:check` **OK**, `sync:fonts:check` **OK** y **E2E de la
tienda 24/24** (41,3 s, contra la API real). Capturas de home (claro y oscuro), ficha y listado
revisadas: la identidad se ve en las cuatro y el modo oscuro no rompe contraste ni legibilidad.

**DEFECTO DE ARNES MEDIDO Y CERRADO (en esta fase)**: `npm run typecheck` de la tienda estaba **rojo
en HEAD** —`e2e/checkout.spec.ts` leia `ApiOrder.shippingItemId`, campo que **T200** publico en el
canal y que el tipo local del arnes (`e2e/helpers/erp-api.ts`) no declaraba—. Se anadio el campo
(documentado) y el `typecheck` queda en **0**. Queda **declarado** que el cierre de T200 anoto
`tsc` 0 para la tienda y no lo era: el E2E de Playwright transpila sin comprobar tipos, asi que el
error solo lo ve el gate de tipos.

**REGLA DE ENTORNO MEDIDA (y documentada en el README)**: `next build` (y el `npm run e2e`, que
construye) escriben `.next`, el **mismo** directorio que usa `next dev`: con el servidor de
desarrollo en marcha, el dev server queda con un bundle roto y responde **500** con
`MODULE_NOT_FOUND` al pedir una pagina. Antes de construir o correr el E2E hay que **parar el dev
server** y reiniciarlo despues.

**Declarado (pendiente para F9.2–F9.6)**: la home sigue siendo la estructura anterior (hero de dos
banners, dos grillas y categorias de texto) con la capa nueva encima; los filtros, la ficha, el
carrito y el checkout **no** se han rediseñado todavia; y el placeholder propio es una solucion
honesta mientras no haya fotografia real.

### §14.c Estado de F9.2 — home de campana (medido el 2026-09-23, T204)

**Lo entregado**: la home deja de ser dos grillas iguales y pasa a contar una campana.

- **Hero de campana** (`home-hero.tsx`): el primer banner del CMS ocupa el bloque dominante con la
  **imagen de fondo**, degradado de contraste (`--sf-hero-overlay`) y la tipografia **display**
  encima (antetitulo con la ciudad, titulo, subtitulo y CTA); los dos siguientes van como piezas
  secundarias. El arte de campana se pinta tal cual (`allowStockHost`), y sin banners el bloque lo
  **dice** en vez de dejar un hueco.
- **Barra de beneficios** (`benefit-strip.tsx`): cuatro piezas con icono y **dato real** —envio con
  el costo y el umbral de envio gratis de la ciudad + plazo en dias habiles, medios de pago que
  acepta el checkout (transferencia, QR o contra entrega; el retiro en tienda queda fuera porque
  esta declarado como fase 2), garantia que publica el ERP **por articulo**, y que la existencia es
  la del **almacen de esa ciudad**—. Nada de marketing inventado.
- **Ofertas en carril horizontal**: `ProductGrid` gana la variante `carousel` (mismo
  `data-testid="product-grid"` y las mismas tarjetas, con ajuste y sin barra de scroll visible).
- **Categorias visuales** (`category-cards.tsx`): pieza con la **imagen del ERP** si existe y, si no,
  el placeholder de la tienda (monograma + halo), nombre, conteo y chevron con microinteraccion.
- **Banda de envio** (`promo-band.tsx`): banda con el degradado de marca que usa **solo datos reales**
  de la ciudad (umbral de envio gratis y costo del envio) con dos CTA.
- **Orden de la home**: hero → beneficios → ofertas (carril) → categorias → destacados (grilla) →
  banda de envio → franja de servicios.

**Evidencia medida**: `npm run typecheck` **0**, `npm run lint` **0/0**, `npm run build` **0** y
**E2E de la tienda 24/24** (37,5 s contra la API real; `home.spec.ts` sigue midiendo el carril de
ofertas como grilla visible con el numero exacto de tarjetas y su etiqueta de descuento, y
`ciudad.spec.ts` que la home vuelve a pedir la existencia de la ciudad elegida). Capturas revisadas:
home de escritorio en claro y home movil (390 px) en **oscuro**, con la jerarquia display, el
carril, las categorias visuales y la banda de envio.

**DEFECTO DE TIPO MEDIDO Y CERRADO (en esta fase)**: el destructuring del array de banners dejaba
`primary` como `Banner | undefined` y `tsc` lo rechazaba (`TS2322`); se indexa con comprobacion
explicita. Lo detecto el gate de tipos, no el E2E (Playwright transpila sin comprobar tipos): es la
misma leccion de F9.1.

**Declarado**: los banners siguen saliendo del slot `home-hero` del CMS (una campana con mas piezas
necesita mas banners en el ERP, no codigo); el carril se navega con scroll nativo (sin flechas ni
autoplay) y la barra de beneficios repite los datos de la ciudad elegida, no promociones por
categoria.

### §14.d Estado de F9.3 — tarjeta y catalogo (medido el 2026-09-23, T205)

**Lo entregado**: la grilla deja de ser una lista de enlaces y el listado deja de ser un formulario.

- **Compra rapida desde la grilla** (`quick-add.tsx`): islote cliente nuevo (declarado) que escribe
  el **snapshot** del carrito (D2) sin hablar con el ERP; el boton vive **fuera** del enlace de la
  imagen, asi que un clic **no navega**, y queda **deshabilitado** sin existencia en la ciudad
  elegida. Usa `data-testid="quick-add"` **a proposito**: la ficha ya tiene `add-to-cart` y su grilla
  de relacionados tambien lleva quick-add, de modo que compartir testid volveria ambiguo el locator
  del E2E. Requiere `cityCode` en `ProductGrid`/`ProductCard` y en las cuatro pantallas que los usan.
- **Insignias con jerarquia**: las del ERP se pintan con variante (`ENVIO GRATIS` beneficio verde,
  `OFERTA` promocion naranja, `CUOTAS` suave, `NUEVO` marca; lo desconocido queda neutro) en vez de
  chips iguales.
- **Skeletons de carga**: `categorias/[slug]/loading.tsx` y `buscar/loading.tsx` con la **misma
  estructura** que la pagina real (migas, titulo, panel de filtros y grilla) para que no haya salto
  de layout.
- **Panel de filtros y orden** (`product-filters.tsx`): cabecera con icono, etiquetas de eyebrow,
  boton **Aplicar** de ancho completo, **Limpiar** solo cuando hay filtros, chips de marca con estado
  activo y el resumen (`filtros-resumen`). Sigue siendo un **formulario GET** con `select` **nativos**
  (sin JavaScript, y los que el E2E maneja). En escritorio el panel queda **pegado** (`lg:sticky`).
- **Estados vacios unificados** (`ui/empty-state.tsx`): catalogo, busqueda sin resultados y busqueda
  sin termino comparten pieza (icono, titulo, explicacion de que el catalogo lo publica el ERP y dos
  salidas), conservando los testids `empty-grid` y `search-empty-state`.
- **Paginacion y cabeceras**: paginador con el mismo lenguaje visual (conserva `aria-label`
  «Paginacion» y `pager-next`), y las cabeceras de categoria y busqueda pasan a la escala `sf-h1` con
  antetitulo.

**Evidencia medida**: `npm run typecheck` **0**, `npm run lint` **0/0**, `npm run build` **0** y el
**E2E de la tienda 25/25** (40,9 s). El caso nuevo —`Carrito › agregar desde la grilla (quick-add) no
navega y suma al carrito`— descubre el articulo y su categoria **por la API**, comprueba que el
`quick-add` esta habilitado, que al pulsarlo **la URL no cambia** y que el contador sube a 1, y que
la linea del carrito es la del articulo. Los casos previos siguen verdes sin cambios (la grilla del
carril de la home, los conteos exactos, `filtros-resumen`, `pager-next`, `search-empty-state` y el
`add-to-cart` de la ficha, que sigue siendo unico). Capturas revisadas: listado de categoria en claro
(panel, quick-add, insignias con variante) y busqueda sin resultados.

**Declarado**: el quick-add agrega **1 unidad** (la cantidad se ajusta en el carrito o en la ficha);
el panel de filtros no se colapsa en movil (no hay islote para eso: se prefirio no anadir JavaScript
y el canal **no** acepta rango de precios, hueco ya declarado); y el skeleton solo cubre las dos
pantallas de catalogo, porque la home se pinta de una pieza.

### §14.e Estado de F9.4 — ficha de producto (medido el 2026-09-23, T206)

**Lo entregado**: la ficha pasa de dos columnas planas a una pagina de compra.

- **Caja de compra pegajosa** (`lg:sticky`): marca, titulo en la escala `sf-h1`, SKU, insignias del
  ERP, **panel de precio** con el importe protagonista, la etiqueta de descuento, el «antes» y el
  **ahorro calculado** (de dos importes del ERP, no inventado), la leyenda de que el importe final lo
  confirma el ERP, la disponibilidad con punto de estado y el boton de compra.
- **Cantidad con tope real**: el stepper respeta `MAX_LINE_QUANTITY` **y la existencia publicada**
  («Puedes agregar hasta N unidades»), asi que la tienda nunca ofrece comprar mas de lo que hay. El
  boton sigue agregando con cantidad por defecto 1, de modo que el E2E no cambia de semantica.
- **Tarjetas de entrega, envio, garantia y pago** en lugar de la lista de texto: plazo en dias
  habiles de la ciudad, `describeShipping` con el umbral de envio gratis, los meses de garantia que
  publica el ERP y los medios de pago del checkout. La tarjeta de pago menciona las **cuotas solo si
  el ERP publica la insignia `CUOTAS`** («se eligen y confirman en el checkout»): la tienda **no
  inventa planes de cuota** (regla de honestidad de `src/lib/format.ts`).
- **Galeria con zoom** (`product-gallery.tsx`): la imagen principal se amplia al pasar el puntero con
  el **origen siguiendo al puntero** y un contador `n / total`; miniaturas con estado activo. El zoom
  solo se ofrece con **foto real** (con el placeholder del seed no aporta y no se insinua).
- **Ficha tecnica en acordeones** (`<details open>` por grupo, sin JavaScript) con el conteo de
  caracteristicas por grupo, conservando `specs-table` y el `rowheader` por caracteristica.

**Evidencia medida**: `typecheck` **0**, `lint` **0/0**, `build` **0** y **E2E de la tienda 25/25**
(42,3 s). Captura revisada de la ficha completa (galeria, caja de compra con las cuatro tarjetas y el
stepper, acordeones de ficha tecnica y relacionados con quick-add).

**MEJORA DE ARNES MEDIDA (en esta fase)**: la ficha pinta **una tabla por grupo** de caracteristicas,
asi que `getByTestId('specs-table').locator('tbody tr')` resolvia a **varios** elementos y Playwright
habria fallado en modo estricto en cuanto un articulo tuviera 2+ grupos; el E2E cuenta ahora las
filas de todas las tablas con un selector CSS (`[data-testid="specs-table"] tbody tr`). Es el mismo
patron que el testid `quick-add` de F9.3: **el contrato se conserva y se vuelve determinista**.

**Declarado**: el stepper topa con la existencia publicada, pero la reserva real ocurre al crear el
pedido (D14/`webOrderTtlHours`); el zoom es de escritorio (en tactil no hay puntero, asi que la
imagen se queda en su tamano); y la ficha de un articulo **sin** caracteristicas sigue diciendolo en
un panel, no en un acordeon vacio.

### §14.f Estado de F9.5 — carrito y checkout (medido el 2026-09-23, T207)

**Lo medido antes de rehacerlo** (todo sobre la tienda en marcha, no por lectura):

- **(a)** El HTML del servidor de `/carrito` ya traia **«Tu carrito esta vacio»**: el store rehidrata
  con `skipHydration` despues del montaje, asi que el primer pintado era el estado vacio y el
  comprador con carrito veia un parpadeo. El checkout **si** tenia guarda (`hydrated`), el carrito no.
- **(b)** El HTML del servidor de `/checkout` traia **una sola linea de texto**
  (`Cargando tu carrito…`): medido, **1** aparicion de `Cargando tu carrito` y **0** de «Datos del
  comprador» y de «Pasos del checkout». De la pantalla entera no habia nada.
- **(c)** Los pasos eran **pildoras** en un `<ol>` sin barra de avance: el comprador no veia cuanto
  le quedaba.
- **(d)** Ninguno de los dos resumenes laterales era **pegajoso**: medido, **0** apariciones de
  `lg:sticky` en las dos paginas (la ficha de compra si lo trae desde F9.4).
- **(e)** La clase base del boton se usaba a medias: **17** atributos de clase con
  `sf-btn-primary`/`sf-btn-secondary` **sin** `sf-btn` (7 primarios + 10 secundarios) en
  `cart-view`, `checkout-form`, `payment-reference-form`, `seguimiento`, `pedido` y `not-found`. La
  base es la que aporta `min-height: 44px`, el relleno, `inline-flex` y el radio, asi que esos
  botones salian con el relleno del navegador. Cerrado: medido despues, **0** atributos sin base.
- **(f)** Dos utilidades de Tailwind compitiendo en el mismo elemento: los skeletons de F9.3 pedian
  `h-9 w-72` / `h-11 w-32` sobre la forma `block`, que ya emite `h-24 w-full`. **Medido en la hoja
  compilada**: `.h-11` se emite antes que `.h-24` (52247 < 52351) y `.w-full` despues de
  `.w-24`/`.w-72`/`.w-80` (53329 > 53136), asi que la altura pedida se perdia en unos casos y **el
  ancho en todos**. Se cierra por construccion con la forma `custom` del `Skeleton`, que no emite
  ninguna de las dos.

**Lo entregado**:

- **Barra de progreso de la compra** (`checkout-progress.tsx`): cuatro nodos —carrito y los tres
  pasos del checkout— con nodo numerado, marca de completado, barra que los une y
  `aria-current="step"`. El **carrito es el nodo 0 y no lleva `data-testid`**: el numero visible de
  cada paso coincide con el del contrato del E2E (`checkout-step-1..3`) y el `data-state`
  (`done`/`current`/`pending`) se conserva tal cual. En pantalla estrecha el nombre del paso actual
  va en su propia linea (antes el `truncate` dejaba «Res…»).
- **Resumen pegajoso** en el carrito y en el checkout (`lg:sticky lg:top-32`). Medido: la `y` del
  resumen se queda en **128 px** tras desplazar 800 px, mientras la columna izquierda sigue subiendo.
- **Carga y errores cuidados**: el carrito estrena **guarda de rehidratacion** con un esqueleto de la
  forma real (`cart-loading`), el checkout cambia la linea de texto por el **esqueleto completo** del
  formulario (`SkeletonCheckout`), la cotizacion muestra esqueletos mientras el ERP responde
  (conservando `checkout-quote-loading`, `checkout-quote-error` y sus dos salidas) y los vacios pasan
  al `EmptyState` unico (`cart-empty`, `checkout-empty`). Las dos rutas estrenan `loading.tsx`.
- **El foco viaja al panel del paso nuevo** (`focus({ preventScroll })` + `scrollIntoView` sobre la
  barra, con `scroll-mt-32`): el lector de pantalla anuncia donde esta el comprador. Medido: la barra
  queda en **128 px** con el encabezado pegajoso terminando en **124 px**, asi que el paso no arranca
  escondido debajo.
- **Tarjetas de opcion** (`.sf-option`, nuevo en la capa de componentes) para entrega y pago: el
  estado elegido sale del radio real con `:has(input:checked)`, sin duplicarlo en JavaScript, y la
  opcion declarada de fase 2 (retiro en tienda) queda con borde discontinuo.
- **Iconos compartidos** (`ui/icons.tsx`): bolsa, marca de completado y busqueda dejan de estar
  repetidos en tres componentes.

**Evidencia medida**: `typecheck` **0**, `lint` **0/0**, `build` **0** (First Load JS compartido
**87,1 kB**), `sync:tokens:check` y `sync:fonts:check` OK y **E2E de la tienda 27/27**, con dos casos
nuevos: uno mide la barra en las dos paginas, el resumen pegajoso (`toHaveCSS('position','sticky')`),
el `data-state` al cambiar de paso y que el foco quede en el panel nuevo; el otro mide **sin
JavaScript** que la primera pintada es el esqueleto (`cart-loading`, `checkout-loading`) y **no** el
estado vacio. Capturas revisadas: carrito lleno y vacio (claro y oscuro), carrito movil, checkout
paso 2, paso 3 y paso 3 movil en oscuro.

**Medido despues, en el HTML del servidor** (la misma sonda del punto (a)/(b)): `/carrito` trae
`cart-loading` con **38** bloques de esqueleto y **ya no** trae «Tu carrito esta vacio»; `/checkout`
trae `checkout-loading` con **35** bloques, frente a la unica linea de texto anterior.

**Declarado**: el carrito sigue siendo del comprador (snapshot en `localStorage`, D2) y el pago lo
registra el ERP (D18); el `loading.tsx` del checkout tapa la resolucion de la ciudad en el servidor,
no la hidratacion (que la cubren las guardas); y la barra de pasos no se colapsa ni se convierte en
menu en pantallas muy estrechas: se queda en la linea de nodos con el nombre encima.

### §14.g Estado de F9.6 — cierre: gate visual propio, accesibilidad, contraste y presupuesto (medido el 2026-09-23, T208)

La ultima fase de D26 abre **cuatro gates nuevos** para la tienda, cada uno con su propio alcance, y
cierra con ellos los hallazgos de accesibilidad que la capa visual venia arrastrando.

**1. Gate visual propio (`npm run e2e:visual`) con datos grabados.** Un gate visual no puede medir
contra el seed de desarrollo: una captura de referencia que cambia con el dato no distingue «se rompio
el diseno» de «cambio el precio». La tienda estrena `playwright.visual.config.ts` (puerto 3200,
capturas propias) y un **fixture del canal** (`e2e/visual/channel-fixture.mjs`): un proxy de
`GET/POST /storefront/...` que **graba una vez** las respuestas reales (`e2e/visual/fixtures/`, **30
respuestas**) y las **repite** en cada corrida. En los POST descarta `idempotencyKey` antes de
calcular la clave —la tienda genera una por intento y su valor no cambia la respuesta—, y un endpoint
sin grabacion responde **599 y lo grita**: el spec visual falla visiblemente en vez de capturar una
pantalla de error como si fuera buena. La tienda sigue apuntando a `ERP_API_URL` y no sabe que hay un
fixture detras; el E2E funcional (`npm run e2e`) sigue midiendo contra el ERP real y el seed.
**15 capturas de referencia** (inicio, categoria, busqueda con y sin resultados, ficha, carrito lleno
y vacio, checkout paso 2 y resumen, 404 y seguimiento; claro y oscuro donde el tema cambia), captura
**completa y sin mascaras** porque no hay datos variables que tapar.

**2. DEFECTO MEDIDO Y CERRADO — el paso 3 cotizaba dos veces.** El fixture destapo una peticion que
el E2E funcional no ve: al entrar al resumen, el checkout pedia **dos** cotizaciones, la primera
**sin comprador** (`{"cityCode":"SCZ","items":[...]}`) porque el correo todavia estaba dentro del
rebote de 400 ms y el valor con rebote seguia siendo el vacio, y la segunda ya con el correo. Ademas
de la llamada de mas, la respuesta de la primera podia pintar un **error transitorio** antes de la
buena. Se cierra con una guarda en `checkout-form.tsx`: la cotizacion espera a que el correo deje de
cambiar (`quoteEmail === buyer.email.trim()`). Medido despues: **0 peticiones sin grabacion** en la
corrida visual (antes 2) y el E2E funcional sigue en 27/27.

**3. Auditoria de accesibilidad (`npm run e2e:a11y`).** `axe-core` sobre el DOM **pintado** de **17
pantallas** (las del gate visual en claro y oscuro) con las reglas `wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa` y `best-practice`; falla por cualquier violacion `serious`/`critical` y lista las suaves.
**Medido en la primera corrida: 12 de 17 pantallas con una violacion grave de contraste** —los
detalles los imprime el gate con el color de texto, el de fondo y la relacion:

| par medido | relacion | donde |
|---|---|---|
| `#ffffff` sobre `#ea580c` (etiqueta de promocion, claro) | 3,55:1 | tarjetas y home |
| `#ffffff` sobre `#fdba74` (etiqueta de promocion, oscuro) | **1,68:1** | home y listado en oscuro |
| `#15803d` sobre `#0a0a0f` (existencia, oscuro) | 3,93:1 | ficha y tarjetas |
| `#15803d` sobre `#052e16` (etiqueta verde, oscuro) | **2,97:1** | tarjetas y ficha |
| `#6e7089` sobre `#0a0a0f` (texto terciario, oscuro) | 4,08:1 | home, listado, ficha (75 nodos) |
| `#6e7089` sobre `#12121a` (texto terciario sobre elevado) | 3,85:1 | idem |
| `#16a34a` sobre `#ffffff` (texto verde, claro) | 3,29:1 | lineas de oferta y descuento |
| `#8a8ca8` sobre `#172554` (texto secundario sobre marca suave) | 4,47:1 | paneles suaves |

**Cerrado en la capa de marca** (`src/styles/brand.css`, sin tocar `tokens.css`: su gate sigue verde):
la **etiqueta de promocion** pasa a un par propio por tema (`--sf-promo-badge` / `--sf-promo-contrast`:
`#c2410c` con blanco en claro **5,18:1**, `#fdba74` con tinta oscura en oscuro **11,71:1**); el
**verde de precio** usa `--success-700` en los dos temas —la escala semantica de LUNA **se invierte**
en oscuro, asi que el mismo token da `#15803d` en claro **(5,02:1)** y `#6ee7b7` en oscuro
**(12,96:1)**—; el verde de las lineas de oferta (`ok` en Tailwind) apunta al mismo token; y el tema
oscuro **sube sus dos grises de texto** (`--text-secondary` `#a1a3b8`, `--text-tertiary` `#9ca3af`)
con el comentario de que el back office conserva los suyos (fuera del alcance de la tienda).
**Medido despues: 17/17 pantallas, 0 violaciones graves y 0 suaves.**

**4. Contraste de la paleta (`npm run audit:contrast`).** `axe` **no puede** medir el contraste de un
texto sobre un degradado o una imagen y lo deja en *incomplete* (**67 nodos en la home**, medidos, con
la tinta del boton principal y la banda de campana entre ellos). El script resuelve las variables de
`tokens.css` y `brand.css` con la cascada real (`:root` → marca → bloques del tema oscuro) y comprueba
**34 pares** con la formula WCAG, degradado por degradado (**cada parada**, falla la peor), con los
minimos de AA (4,5:1 texto, 3:1 texto grande e interfaz). **Medido: 34/34 en claro y oscuro**, con los
pares de mas riesgo en el log (tinta del boton `#ffffff` sobre el stop `#3b82f6` = 3,68:1 para texto
grande; tinta de campana `#0a0a0f` sobre `#60a5fa` = 7,77:1).

**5. Presupuesto de rendimiento (`npm run e2e:perf`).** LCP y CLS con `PerformanceObserver` y el peso
real del arranque (JS, CSS y tipografias por `encodedBodySize`) en las cinco primeras pantallas del
camino de compra. **Medido** (build de produccion, `localhost`, fixture):

| pantalla | LCP | CLS | JS | CSS | fuentes |
|---|---|---|---|---|---|
| `/` | 528 ms | 0,001 | 107 kB | 10,3 kB | 188,5 kB |
| `/categorias/celulares` | 184 ms | 0,001 | 107 kB | 10,3 kB | 188,5 kB |
| `/productos/iphone-15-128gb` | 224 ms | 0,001 | 108,4 kB | 10,3 kB | 188,5 kB |
| `/carrito` | 288 ms | **0,02** | 109,5 kB | 10,3 kB | 188,5 kB |
| `/checkout` | 316 ms | 0,003 | 115,8 kB | 10,3 kB | 188,5 kB |

El presupuesto queda como **ratchet** (LCP 800 ms, CLS 0,05, JS 150 kB, CSS 20 kB, fuentes 210 kB) con
los numeros medidos escritos al lado. **Evidencia de las fuentes**: el gate imprime que el navegador
solo baja los **cuatro `.woff2` de `latin`** (47 kB cada uno; los 8 del ERP suman 521 kB) — el
`unicode-range` de `fonts.css` (F9.1) hace que `latin-ext` no se pida con texto espanol—. El CLS del
carrito (0,02) es el cambio de esqueleto por las lineas rehidratadas: queda muy por debajo del 0,1
«bueno» de Web Vitals y es el precio de no pintar un carrito vacio falso (punto (a) de §14.f).

**Evidencia de la fase**: `typecheck` **0**, `lint` **0/0**, `build` **0**, `sync:tokens:check` y
`sync:fonts:check` OK, `audit:contrast` **34/34**, `e2e:a11y` **17/17 sin hallazgos**, `e2e:perf`
**5/5**, `e2e:visual` **15/15** (con **0** endpoints sin grabacion) y E2E funcional **27/27**. Las 15
capturas de referencia (`e2e/visual/store-visual.spec.ts-snapshots/`, ~7 MB) se revisaron una por una
tras el cambio de paleta, incluida la ficha en oscuro.

**Declarado**: las capturas de referencia son **por plataforma** (Playwright les pone el sufijo
`win32`) y se generan y comparan en la misma (Windows + Chromium, `deviceScaleFactor: 1`), igual que
el gate visual del back office; el modo grabacion del fixture necesita la **API del ERP en marcha** y
se dispara a proposito (`$env:STORE_VISUAL_RECORD='1'`); el presupuesto de rendimiento es un
**ratchet** medido en `localhost`, no una medida de campo; y la correccion de contraste se aplica a la
**tienda** (el back office conserva los tokens oscuros de LUNA, con el mismo defecto medido, fuera del
alcance de D22–D26).

### §14.h Correccion del menu de categorias (medido el 2026-09-23, T209)

**Lo que reporto el usuario**: al pulsar una categoria con subcategorias, el menu «no se despliega
fuera»: se abre dentro de su contenedor y no se puede visualizar.

**Lo medido con una sonda** (`Celulares`, la primera de las **3** raices con hijas que publica el
canal):

- La fila de categorias es un **carril con scroll horizontal** (`overflow-x-auto`) porque las raices
  no caben a lo ancho: `scrollWidth 1688` contra `clientWidth 1280`, medido.
- En CSS, **`overflow-x: auto` obliga a `overflow-y: auto`** (el valor calculado medido es `auto`),
  asi que el panel del `<details>` —`position: absolute`, `z-index 200`— quedaba **recortado por la
  caja del carril**: el panel medía 108 px de alto y **110 px** caian por debajo de su borde
  inferior, es decir **0 px visibles** (el `z-index` no compite contra el recorte de un ancestro con
  scroll). El carril mide 48 px (de `y 75` a `y 123`) y el panel empezaba en `y 125`.

**Lo entregado**:

- **El panel deja de vivir dentro del carril**: pasa a ser **hermano** suyo, anclado a la barra
  (`absolute inset-x-0 top-full`, `z-panel`), de modo que ningun ancestro con scroll lo recorta.
  Medido despues: `clippers: []`, alto visible **121 px de 121 px** y `elementFromPoint` en su centro
  devuelve el propio panel (antes devolvia el hero de la home).
- **El disparador** deja de ser un `<summary>` y pasa a ser **enlace a la categoria + boton de
  despliegue** con `aria-expanded` y `aria-controls` (el IDREF **solo mientras el panel existe**: uno
  colgado lo marcaria el gate de accesibilidad). Asi, **sin JavaScript el enlace a la categoria y la
  pagina `/categorias` siguen funcionando** (el arbol completo esta ahi); lo que no se abre es el
  panel, que antes se abria pero recortado.
- **El `▾` tipografico pasa a icono SVG** (`ChevronDownIcon`): era ilegible a 0,6875 rem y contaba
  como nodo de contraste no medible (los nodos *incomplete* de la home bajan de 67 a **65**).
- **Menu ancho con el arbol del ERP**: «Todo en X» mas cada hija con su conteo, en rejilla de 2 a 4
  columnas; **Escape** cierra y devuelve el foco al boton, el clic fuera y la navegacion lo cierran
  (la ruta esta en las dependencias del efecto), y **`ArrowDown` entra al panel** —necesario porque
  el panel esta fuera del carril: sin eso el teclado tendria que atravesar el resto de categorias—.

**Evidencia**: **2 casos E2E nuevos** (`e2e/navegacion.spec.ts`; la suite funcional pasa de 27 a
**29/29**). El primer caso no mira el pixel: recorre los ancestros, **intersecta sus cajas de
recorte** y exige que el area visible del panel sea su area completa —con el marcado anterior esa
cuenta da 0 px de alto y el caso falla—, comprueba que el centro del panel es lo que se pinta, que el
panel trae «Todo en X» mas una entrada por hija y que al pulsar una navega y el panel se cierra. El
segundo mide el recorrido de teclado (Enter abre, `ArrowDown` entra, Escape cierra y devuelve el
foco). Ademas: `typecheck` **0**, `lint` **0/0**, `build` **0**, `audit:contrast` **34/34**,
`e2e:a11y` **17/17** sin hallazgos, `e2e:perf` **5/5** y `e2e:visual` **15/15** con las capturas
**regeneradas** por el cambio de encabezado (revisada la del listado).

**Declarado**: el desplegable es un **islote cliente** (la nav ya lo era, para el `aria-current`); sin
JavaScript el panel no se abre. El carril sigue teniendo scroll horizontal en pantallas estrechas, que
es lo que permite que el panel viva fuera de el.
