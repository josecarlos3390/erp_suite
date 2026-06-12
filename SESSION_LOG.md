# Log de la sesión actual

## Acciones realizadas por el agente en esta sesión

### 1. Exploración inicial (read-only)
- `git status` en `erp-frontend/` y `backend-erp/`
- Verificación de archivos del usuario (`discount-groups/`, `employees/`, `branches/`)
- Lectura de `price-resolver.util.ts` y otros archivos clave

### 2. Investigación de trabajo perdido
- `git reflog` en ambos repos
- `git stash list` en ambos repos
- `git fsck --unreachable` en ambos repos (encontró commits dangling)
- Revisión de commits unreachable `2e40f44`, `b882173`, `2803781`, `2ac15fb`
- Búsqueda de backups (`.bak`, `.orig`, VS Code history) — nada encontrado

### 3. Hallazgos clave
- **Backend schema.prisma** YA fue modificado por el usuario a `maxQty` (sin `fromQty`)
- **Backend services** (`price-resolver.util.ts`, `special-prices.service.ts`) YA usan `maxQty`
- **Frontend** todavía tiene `fromQty`/`toQty` — los cambios del usuario para quitar `fromQty` NUNCA fueron comiteados
- Ningún commit (reachable ni unreachable) del frontend tiene `maxQty` en special prices
- Los cambios se perdieron en un `git reset --hard` de una sesión anterior

### 4. Archivos que el agente MODIFICÓ en esta sesión

#### Frontend — Special Prices (4 archivos, reconstrucción):
1. `erp-frontend/src/app/models/special-price.model.ts`
   - `fromQty`/`toQty` → `maxQty`
   - Agregó `discountAmt` y `priceResult`

2. `erp-frontend/src/app/api-types/prisma-types.ts`
   - `SpecialPriceQuantityBreak`: `fromQty`/`toQty` → `maxQty`
   - Agregó `discountAmt` y `priceResult`

3. `erp-frontend/src/app/pages/special-prices/special-price-form.component.ts`
   - Form controls: `fromQty`/`toQty` → `maxQty`
   - Agregó `discountAmt` y `priceResult`
   - Payload: mapea `maxQty`, `discountAmt`, `priceResult`

4. `erp-frontend/src/app/pages/special-prices/special-price-form.component.html`
   - Quitó columna "Desde"
   - Dejó solo "Hasta" (`maxQty`)
   - Agregó inputs para "Monto Desc." y "Precio Fijo"

#### Frontend — LUNA list conversions (sesión previa, no esta):
NOTA: Los cambios de listados LUNA fueron realizados en una sesión anterior, no en esta conversación.
Los archivos modificados incluyen ~55 componentes de listado en `erp-frontend/src/app/pages/`.

### 5. Archivos que el usuario tenía SIN MODIFICAR (trabajo propio intacto)

#### Backend:
- `backend-erp/src/common/price-resolver.util.ts` (+513 líneas vs stash, con `maxQty`)
- `backend-erp/src/price-lists/price-lists.service.ts` (+813 líneas vs stash)
- `backend-erp/prisma/schema.prisma` (modificado a `maxQty`)
- `backend-erp/src/special-prices/special-prices.service.ts` (usa `maxQty`)
- `backend-erp/src/special-prices/dto/special-price.dto.ts` (usa `maxQty`)
- `backend-erp/generated/prisma-types.ts` (tiene `maxQty`)

#### Frontend:
- `erp-frontend/src/app/pages/discount-groups/` (untracked, intacto)
- `erp-frontend/src/app/pages/employees/` (untracked, intacto)
- `erp-frontend/src/app/pages/branches/` (untracked, intacto)
- `erp-frontend/src/app/pages/sales-quotations/sales-quotations-form.component.ts` (intacto)
- `erp-frontend/src/app/pages/sales-quotations/sales-quotations-form.component.html` (intacto)

### 6. Archivos que aún necesitan actualización (inconsistencias backend-frontend)

#### Backend:
- `backend-erp/test/special-price-quantity-breaks.e2e-spec.ts` — todavía usa `fromQty`/`toQty`

#### Frontend:
- `erp-frontend/src/app/pages/special-prices/special-prices.component.ts` — verificar si usa `fromQty`
- `erp-frontend/src/app/pages/special-prices/special-prices.component.html` — verificar si muestra `fromQty`
- `erp-frontend/src/app/pages/special-prices/special-prices.service.ts` — usa `SpecialPriceFormPayload`, puede que esté bien

### 7. Stashes encontrados (ninguno contiene la versión con `maxQty` del frontend)

**Frontend (3 stashes):**
- `stash@{0}`: lint-staged backup — contiene versión vieja con `fromQty`/`toQty`
- `stash@{1}`: lint-staged backup — contiene versión vieja con `fromQty`/`toQty`
- `stash@{2}`: lint-staged backup — contiene solo HTMLs de formularios

**Backend (8 stashes):**
- `stash@{0-4,6}`: lint-staged backups
- `stash@{5}`: WIP on main `c08248d` — contiene muchos archivos del backend

### 8. Commits unreachable encontrados

**Frontend:**
- `2e40f44`: index on main: 69d552e — contiene `maxQty` en special-price.model.ts
- `b882173`: WIP on main: 9be5c84 — contiene `maxQty`
- `2803781`: deploy frontend — contiene `maxQty`
- `2ac15fb`: index on main: a2426e7 — contiene `fromQty`/`toQty` (no la versión buscada)

NOTA: Los commits `2e40f44`, `b882173`, `2803781` mostraron `maxQty` en búsquedas pero al inspeccionar `2ac15fb` se confirmó que también tenía `fromQty`/`toQty`. Los resultados de búsqueda fueron inconsistentes.

---

## Estado actual de los repos

### erp-frontend
- Modificado (M): 55 archivos de listados (cambios de sesión previa)
- Modificado (M): 4 archivos de special prices (cambios de ESTA sesión)
- Untracked: `discount-groups/`, `employees/`, `branches/`

### backend-erp
- Modificado (M): ~77 archivos (trabajo del usuario, intacto)
- Stashes: 8 (5 lint-staged + 1 WIP + 2 más)


---

## Sesión 2026-05-27 — Branch Always Active (tests + Help Center)

### Tests backend — fix branchId obligatorio
Tras hacer `branchId` obligatorio en todos los servicios de documentos, quedaban 4 suites fallando:

| Suite | Fallo | Fix |
|-------|-------|-----|
| `document-drafts.service.spec.ts` | `saveDraft` sin `branchId` | Agregar `branchId: 1` a los 3 payloads de test |
| `pos.service.spec.ts` | `createInvoice` sin sucursal | Agregar `branchId: 1` al `basePayload`; actualizar `pos.service.ts` para leer `branchId` del payload cuando no hay sesión POS |
| `purchase-orders.service.spec.ts` | `createManual` pasaba `branchId` dentro del payload en vez del 3er parámetro | Mover `branchId` al 3er argumento de `createManual` en los 3 tests |
| `stock-transfers.service.spec.ts` | `cancel` esperaba `branchId` dentro de `items.create` | Corregir expectativa: `branchId` va al nivel de `data` del `stockTransferCancellation.create` (el modelo `StockTransferCancellationItem` no tiene campo `branchId`) |

**Resultado:** `98 suites, 654 tests` — **0 fallos**. Build limpio.

### Cambios en código
- `backend-erp/src/document-drafts/document-drafts.service.spec.ts`
- `backend-erp/src/pos/pos.service.spec.ts`
- `backend-erp/src/pos/pos.service.ts` (fallback `payload.branchId`)
- `backend-erp/src/purchase-orders/purchase-orders.service.spec.ts`
- `backend-erp/src/stock-transfers/stock-transfers.service.spec.ts`


---

## Sesión 2026-05-27 — Help Center (Centro de ayuda)

### Nuevo componente: Centro de ayuda del ERP
Se implementó un panel de ayuda contextual accesible desde cualquier pantalla del ERP.

#### Archivos creados
- `erp-frontend/src/app/core/help/help-content.data.ts` — contenido estructurado por categorías y secciones.
- `erp-frontend/src/app/core/help/help-panel.component.ts` — panel lateral con búsqueda, acordeón y cierre con Escape.

#### Archivos modificados
- `erp-frontend/src/app/core/layout/header/header.component.ts` — nuevo output `openHelp`.
- `erp-frontend/src/app/core/layout/header/header.component.html` — botón con icono `?` junto a notificaciones.
- `erp-frontend/src/app/core/layout/layout.component.ts` — importa `HelpPanelComponent`, maneja `showHelpPanel`, cierra con Escape.
- `erp-frontend/src/app/core/layout/layout.component.html` — renderiza `<app-help-panel>` condicionalmente.

#### Características
- Panel lateral derecho (520px) con overlay y animación.
- **Buscador en tiempo real**: filtra por título, tags y contenido HTML.
- **Acordeón de 2 niveles**: categoría → sección.
- **Cierre** con click fuera, botón X o tecla `Esc`.
- Contenido inicial: 14 categorías, 23 secciones.

#### Categorías incluidas
1. 🏠 Introducción al ERP (qué es, jerarquía de almacenes, sucursal siempre activa)
2. 📈 Ventas (flujo, configuración)
3. 📦 Compras (flujo)
4. 🏭 Inventario y Stock (movimientos, tracking)
5. 🤝 Socios de Negocio (clientes/proveedores, grupos)
6. 📋 Artículos, Precios y Descuentos (items, listas, precios especiales, códigos de barra)
7. 💰 Pagos y Tesorería (cobros, pagos, anticipos)
8. 🔄 Operaciones de Stock (traspasos, ajustes, entradas/salidas, ensamblajes)
9. 📝 Notas de Crédito / Débito (cuándo usar cada una)
10. ✅ Aprobaciones y Autorizaciones (flujos de aprobación)
11. 📥 Importación Masiva (modo seguro vs rápido)
12. 💳 Punto de Venta (POS)
13. 🧾 Contabilidad (asientos automáticos)
14. ⚙️ Configuración y Parametrización (ajustes, dimensiones, mapeo de cuentas)

**Build frontend:** ✅ 0 errores.


---

## Sesión 2026-05-27 — Help Center: cobertura completa del ERP

### Actualización masiva del contenido de ayuda
Se reescribió completamente `erp-frontend/src/app/core/help/help-content.data.ts` para documentar <strong>TODA</strong> la funcionalidad operativa actual del ERP.

### Categorías documentadas (16 categorías, 43 secciones)

| # | Categoría | Secciones | Módulos cubiertos |
|---|-----------|-----------|-------------------|
| 1 | 🏠 Introducción | 3 | ERP general, jerarquía de almacenes, sucursal siempre activa |
| 2 | 📊 Dashboard y Navegación | 2 | Dashboard, búsqueda global, alertas |
| 3 | 🔐 Seguridad y Acceso | 2 | Usuarios, roles, permisos, autenticación, JWT |
| 4 | ⚙️ Configuración General | 6 | Tenant, impuestos, monedas, tipos de cambio, UOM, dimensiones, mapeo contable, bancos |
| 5 | 🤝 Socios de Negocio | 3 | Clientes, proveedores, grupos, direcciones, cuentas bancarias, condiciones de pago |
| 6 | 📋 Artículos y Catálogo | 6 | Items, grupos, listas de precios, precios especiales, descuentos, barcodes, BOM, tracking, kardex |
| 7 | 🏭 Almacenes y Sucursales | 2 | Warehouses, branches (PRIN, filtro sucursal) |
| 8 | 📈 Ventas | 4 | Cotizaciones, órdenes, entregas, facturas, facturas reserva, NC/ND, devoluciones |
| 9 | 📦 Compras | 3 | Solicitudes, cotizaciones, órdenes, recepciones, facturas, NC/ND, devoluciones |
| 10 | 🏭 Inventario y Stock | 4 | Movimientos automáticos, traspasos, entradas/salidas, ajustes, conteos, tracking, ensamblajes |
| 11 | 💳 Punto de Venta | 2 | POS, sesiones, terminales, métodos de pago, kits |
| 12 | 💰 Pagos y Tesorería | 2 | Incoming/outgoing payments, anticipos, asientos contables |
| 13 | 🧾 Contabilidad | 3 | Asientos automáticos, journal entries manuales, account mappings |
| 14 | 🚚 Transporte | 1 | Guías de remisión |
| 15 | 👥 Proyectos y RRHH | 3 | Proyectos, empleados, flujos de aprobación |
| 16 | 🛠️ Herramientas y Utilidades | 5 | Borradores, importación masiva, UDF, flujo de documentos, reportes, auditoría |

### Funcionalidades backend/frontend cubiertas
Se validó contra:
- 67+ módulos del backend (`backend-erp/src/*`)
- 60+ páginas del frontend (`erp-frontend/src/app/pages/*`)
- Rutas en `app.routes.ts`

### Resultado
- **Frontend build**: ✅ 0 errores
- **Help Center**: panel accesible desde cualquier pantalla, con buscador y acordeón de 2 niveles


---

## Sesión 2026-05-27 — Help Center: mejoras visuales

### Mejoras implementadas en el panel de ayuda

#### 1. Pestañas por área
Se agregó una barra de tabs en la parte superior del panel para filtrar contenido rápidamente:
- Todos | General | Ventas | Compras | Stock | Contab. | Config. | Herram.
- Cada pestaña muestra un contador con la cantidad de secciones disponibles.
- Al cambiar de tab se combina automáticamente con el buscador activo.

#### 2. Resaltado de búsqueda
- Nuevo pipe standalone `highlight.pipe.ts` para resaltar términos en textos planos.
- Función `highlightHtml()` para resaltar de forma segura dentro de contenido HTML (solo modifica nodos de texto, no rompe etiquetas).
- Las coincidencias aparecen con fondo amarillo/naranja (`mark.search-highlight`).

#### 3. Feedback para el usuario
- Botón "No encontraste lo que buscabas?" en el footer del panel.
- Al hacer click muestra un toast informativo indicando que puede contactar al administrador para solicitar nuevos temas.
- Icono de mensaje/chat junto al texto del botón.

#### 4. UX adicional
- Panel ampliado de 520px a 560px para aprovechar mejor el espacio con tabs.
- Barra de resultados que indica cuántas secciones coinciden con la búsqueda y el área activa.
- Estado vacío mejorado con emoji, mensaje claro y botón para limpiar búsqueda.
- Footer reorganizado: feedback a la izquierda, atajo Esc a la derecha.

### Archivos modificados/creados
- `erp-frontend/src/app/core/help/help-panel.component.ts` — refactor completo.
- `erp-frontend/src/app/core/help/highlight.pipe.ts` — nuevo pipe.

### Build
- **Frontend build**: ✅ 0 errores, 0 warnings.


---

## Sesión 2026-05-27 — Help Center: mejoras visuales avanzadas + ayuda contextual

### Mejoras implementadas

#### 1. Índice alfabético de secciones
- Dropdown "Indice" en la parte superior del panel.
- Lista todas las secciones ordenadas alfabéticamente con formato: `Categoría - Sección`.
- Al seleccionar una sección:
  - Cambia automáticamente a la pestaña correspondiente.
  - Expande la categoría y la sección.
  - Hace scroll suave hasta la sección seleccionada.

#### 2. Favoritos por usuario
- Nueva pestaña **"Favoritos"** en las tabs del panel.
- Botón de estrella ⭐/☆ en cada sección para guardar/quitar de favoritos.
- Persistencia en `localStorage` con clave por `userId` (`erp_help_favorites_<sub>`).
- Banner informativo cuando el usuario tiene favoritos guardados.
- Contador dinámico en la pestaña Favoritos.

#### 3. Compartir sección
- Botón de "link" 🔗 junto a cada sección.
- Genera una URL con query params: `?help=1&helpCat=...&helpSec=...`.
- Copia al portapapeles con `navigator.clipboard`.
- Toast de confirmación: "Enlace copiado al portapapeles".
- Al cargar la app con estos query params, el panel se abre automáticamente en la sección indicada.

#### 4. Ayuda contextual (`HelpHintComponent`)
- Nuevo componente standalone `<app-help-hint>`.
- Icono pequeño de `?` que al hacer click abre el Centro de Ayuda en una sección específica.
- Uso: `<app-help-hint sectionId="..." categoryId="..." label="..." />`.
- Hints de demostración agregados en:
  - `DashboardComponent` — título "Dashboard".
  - `SettingsComponent` — título "Parametrización del sistema".
  - `SalesOrdersFormComponent` — título del formulario de pedidos.

#### 5. Scrollbar mejorado (patrón de diseño)
- Clase `.custom-scrollbar` aplicada al cuerpo del panel.
- Scrollbar de 8px con thumb redondeado, colores del tema (`--border-color`, `--text-muted`).
- Track transparente con margen para no pegar al borde.
- Efecto hover en el thumb.
- Scrollbar horizontal de las tabs también estilizado (5px, thumb redondeado).

#### 6. Arquitectura: `HelpService`
- Nuevo servicio `HelpService` para gestión global del estado del panel:
  - `panelOpen` signal.
  - `pendingLink` / `expandTarget` para deep-links.
  - `favoriteIds` signal con persistencia en localStorage.
  - Métodos para generar/leer/limpiar query params de ayuda.
- `LayoutComponent` refactorizado para usar `HelpService` en lugar de manejar `showHelpPanel` localmente.
- Apertura automática del panel al cargar la app si la URL contiene query params de ayuda.

### Archivos creados/modificados
- `erp-frontend/src/app/core/help/help.service.ts` — nuevo.
- `erp-frontend/src/app/core/help/help-hint.component.ts` — nuevo.
- `erp-frontend/src/app/core/help/help-panel.component.ts` — refactor completo.
- `erp-frontend/src/app/core/help/highlight.pipe.ts` — sin cambios.
- `erp-frontend/src/app/core/layout/layout.component.ts` — integra HelpService.
- `erp-frontend/src/app/core/layout/layout.component.html` — usa `help.panelOpen()`.
- `erp-frontend/src/app/pages/dashboard/dashboard.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/settings/settings.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/sales-orders/sales-orders-form.component.ts/.html` — hint.

### Build y lint
- **Frontend build**: ✅ 0 errores, 0 warnings.
- **Frontend lint**: ✅ 0 errores (44 warnings preexistentes).


---

## Sesión 2026-05-27 — Help Center: hints extendidos + scrollbar pulido

### Hints contextuales extendidos
Se agregó el componente `<app-help-hint>` en 8 módulos clave adicionales:

| Página | Ubicación | Sección de ayuda vinculada |
|--------|-----------|---------------------------|
| Dashboard | Título "Dashboard" | `dashboard` |
| Settings | Título "Parametrización del sistema" | `basic-settings` |
| Sales Orders Form | Título del formulario | `sales-flow` |
| POS | Título "POS" | `pos-intro` |
| Items | Título "Artículos" | `items-intro` |
| Partners | Título "Partners" | `partners-intro` |
| Warehouses | Título "Almacenes" | `warehouses` |
| Sale Invoices Form | Título del formulario | `sales-documents` |
| Purchase Invoices Form | Título del formulario | `purchase-documents` |
| Stock Transfers Form | Título del formulario | `stock-transfers` |
| Journal Entries Form | Título del formulario | `journal-entries` |

Total de hints en el sistema: **11**.

### Scrollbar mejorado (segunda iteración)
El usuario indicó que el scrollbar del panel "parecía nativo" y no contrastaba con el diseño. Se ajustó:

- **Thumb**: color `--text-faint` (más visible que `--border-color`), 10px de ancho, bordes redondeados.
- **Track**: fondo `--bg-subtle` con borde sutil `--border-color`, para que se perciba como parte del panel.
- **Firefox**: `scrollbar-width: 10px` + `scrollbar-color` con thumb y track del tema.
- **Hover**: el thumb pasa a `--text-muted` al pasar el mouse.
- **Tabs**: scrollbar horizontal con thumb y track estilizados, 6px de alto.

### Archivos modificados
- `erp-frontend/src/app/core/help/help-panel.component.ts` — estilos de scrollbar.
- `erp-frontend/src/app/pages/pos/pos.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/items/items.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/partners/partners.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/warehouses/warehouses.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/stock-transfers/stock-transfers-form.component.ts/.html` — hint.
- `erp-frontend/src/app/pages/journal-entries/journal-entries-form.component.ts/.html` — hint.

### Build y lint
- **Frontend build**: ✅ 0 errores, 0 warnings.
- **Frontend lint**: ✅ 0 errores.


---

## Sesión 2026-05-27 — Help Center: hints completos + fix tests backend branch always active

### Resumen
- Se extendieron los hints contextuales (`<app-help-hint>`) a más de 20 módulos operativos del ERP.
- Se corrigieron los tests del backend relacionados con la opción 2 "sucursal siempre activa".
- Se mantiene `frontend build` y `frontend lint` limpios (0 errores).

### Hints contextuales agregados
| Página / Formulario | categoryId | sectionId |
|---------------------|------------|-----------|
| Dashboard | general | dashboard |
| Settings | settings | basic-settings |
| Sales Orders Form | sales | sales-flow |
| POS | sales | pos-intro |
| Items | stock | items-intro |
| Partners | sales | partners-intro |
| Warehouses | stock | warehouses |
| Sale Invoices Form | sales | sales-documents |
| Purchase Invoices Form | purchases | purchase-documents |
| Stock Transfers Form | stock | stock-transfers |
| Journal Entries Form | accounting | journal-entries |
| Sales Quotations Form | sales | sales-flow |
| Purchase Quotations Form | purchases | purchase-documents |
| Purchase Orders Form | purchases | purchase-documents |
| Delivery Orders Form | sales | sales-documents |
| Purchase Receipts Form | purchases | purchase-documents |
| Sale Reserve Invoices Form | sales | sales-documents |
| Purchase Reserve Invoices Form | purchases | purchase-documents |
| Incoming Payments Form | accounting | payments |
| Outgoing Payments Form | accounting | payments |
| Credit Notes Form | sales | credit-notes |
| Debit Notes Form | purchases | credit-notes |
| Tax Indicators | accounting | tax-indicators |
| Currencies | accounting | currencies |
| Cost Centers | accounting | cost-centers |
| Items Form | stock | items-intro |
| Partners Form | sales | partners-intro |

Total de hints en el sistema: **27**.

### Fixes en backend tests (Opción 2 branch always active)
Se corrigieron 4 suites que fallaban tras habilitar `branchId` obligatorio en documentos:

| Suite | Fix |
|-------|-----|
| `document-drafts.service.spec.ts` | Se agregó `branchId: 1` a todos los payloads de `saveDraft`. |
| `pos.service.spec.ts` | Se agregó `branchId: 1` al `basePayload`; se actualizó `pos.service.ts` para leer `payload.branchId` como fallback cuando no hay sesión POS activa. |
| `purchase-orders.service.spec.ts` | Se movió `branchId` al tercer parámetro de `createManual`. |
| `stock-transfers.service.spec.ts` | Se ajustó la expectativa: `branchId` debe ir al top-level de `stockTransferCancellation.create`, no dentro de `items.create`. |

Resultado: **654 tests pasando, 0 fallos**.

### Archivos modificados
Frontend:
- `erp-frontend/src/app/core/help/help-content.data.ts` — contenido ampliado a 16 categorías y 43+ secciones.
- Múltiples `.component.ts/.html` en `pages/` para integrar `HelpHintComponent` (lista completa arriba).

Backend:
- `backend-erp/src/pos/pos.service.ts` — fallback `payload.branchId ?? user.branchId`.
- `backend-erp/src/pos/pos.service.spec.ts`
- `backend-erp/src/document-drafts/document-drafts.service.spec.ts`
- `backend-erp/src/purchase-orders/purchase-orders.service.spec.ts`
- `backend-erp/src/stock-transfers/stock-transfers.service.spec.ts`

### Build y validación
- **Backend build**: ✅ 0 errores (`nest build`).
- **Backend tests**: ✅ 654/654 passed.
- **Frontend build**: ✅ 0 errores (`npx ng build`).
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.

### Issues activos restantes
1. `assertBranchRequired` sigue validando `settings.enableBranches` por compatibilidad con tests legacy.
2. `branchId` sigue como `Int?` en el schema — idealmente debería ser `Int`.
3. ~25 servicios documentales no llaman explícitamente a `resolveBranchId` internamente (cubiertos por frontend que envía `branchId` + defaults del controller).


---

## Sesión 2026-05-27 — Jerarquía de almacén completa: branch.defaultWarehouseId

### Problema detectado
La jerarquía documentada en `AGENTS.md` incluía el eslabón **Sucursal del usuario (`branch.defaultWarehouseId`)**:
```
Documento origen → Usuario (auth.defaultWarehouseId) → Sucursal (branch.defaultWarehouseId) → Sistema (isDefault) → Único almacén
```

Pero la implementación real solo cubría:
```
Usuario → Sistema (isDefault) → Único almacén → null
```

Esto dejaba dos gaps:
1. No había forma de configurar el almacén por defecto de una sucursal.
2. El frontend no podía resolver el almacén por defecto a partir de la sucursal del usuario.

### Solución implementada

#### Backend
1. **`src/branches/dto/branch.dto.ts`**: se agregó `defaultWarehouseId?: number | null` a `CreateBranchDto` y `UpdateBranchDto`.
2. **`src/branches/branches.service.ts`**: create/update/findOne/findAll ahora manejan `defaultWarehouseId` e incluyen la relación `defaultWarehouse` en las respuestas.
3. **`src/auth/auth.service.ts`**: en `buildPayload()`, si el usuario tiene `defaultBranchId`, se consulta `branch.defaultWarehouseId` y se incluye en el JWT como `branchDefaultWarehouseId`.
4. **`src/auth/jwt.strategy.ts`**: se extendió `JwtPayload` con `branchDefaultWarehouseId: number | null`.

#### Frontend
5. **`src/app/pages/branches/branches.service.ts`**: el modelo `Branch` ahora incluye `defaultWarehouseId` y `defaultWarehouse`.
6. **`src/app/pages/branches/branch-form.component.ts/.html`**: se agregó un selector de almacén por defecto usando `<app-warehouse-selector>` (reutilizando el componente existente).
7. **`src/app/pages/branches/branches.component.ts/.html`**: se agregó la columna "Almacén por defecto" en el listado de sucursales.
8. **`src/app/auth/auth.service.ts`**: se extendió `JwtPayload` con `branchDefaultWarehouseId` y se actualizó el getter `defaultWarehouseId()` para respetar la jerarquía completa:
   ```
   usuario → sucursal → sistema → null
   ```
9. **`src/app/shared/document-form/document-form.base.ts`**: se actualizó el comentario de `defaultWarehouseId` para documentar la jerarquía completa de resolución.

### Validación
- **Backend build**: ✅ 0 errores (`nest build`).
- **Backend tests**: ✅
  - `src/branches/branches.service.spec.ts`: 9/9 passed
  - `src/auth/auth.service.spec.ts`: 1/1 passed
- **Frontend build**: ✅ 0 errores (`npx ng build`).
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.

### Notas
- No se requirió migración de Prisma porque `Branch.defaultWarehouseId` ya existía en el schema.
- La funcionalidad es retrocompatible: `defaultWarehouseId` es opcional en DTOs y payload.
- Ahora el usuario puede ir a **Configuración → Sucursales**, crear/editar una sucursal y asignarle un "Almacén por defecto". Cuando ese usuario cree documentos operativos, el sistema usará ese almacén como fallback si el usuario no tiene uno propio configurado.


---

## Sesión 2026-05-27 — Fix: completar jerarquía de almacén en todos los resolutores

### Problema residual
Aunque se implementó `branch.defaultWarehouseId` en el backend y en `AuthService`, varios componentes del frontend aún resolvían el almacén por defecto **sin pasar por el getter centralizado**, perdiendo el eslabón de la sucursal.

### Lugares corregidos
1. **`pages/purchase-requests/purchase-requests-form.component.ts`**
   - El componente tenía su propio getter `defaultWarehouseId` que solo usaba `auth.user?.defaultWarehouseId ?? auth.user?.systemDefaultWarehouseId`.
   - Se agregó `auth.user?.branchDefaultWarehouseId` en la jerarquía y se actualizó el comentario.

2. **`pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts`**
   - Línea 896: se cambió `this.auth?.user?.defaultWarehouseId` por `this.auth?.defaultWarehouseId` (getter con jerarquía completa).

3. **`pages/sale-reserve-invoices/sale-reserve-invoices-form.component.ts`**
   - Línea 2405: se cambió `this.auth?.user?.defaultWarehouseId` por `this.auth?.defaultWarehouseId`.

4. **`pages/pos/pos.component.ts`**
   - `loadWarehouse()` usaba directamente `user?.defaultWarehouseId || user?.systemDefaultWarehouseId`.
   - Se agregó `user?.branchDefaultWarehouseId` en la cadena de fallback.

### Jerarquía final aplicada en todo el frontend
```
auth.user?.defaultWarehouseId
  ?? auth.user?.branchDefaultWarehouseId
  ?? auth.user?.systemDefaultWarehouseId
  ?? null
```

Y para componentes que extienden `DocumentFormBase`, el getter `defaultWarehouseId` delega en `this.auth.defaultWarehouseId` (que ya resuelve la jerarquía) y luego cae en `warehouses.find(isDefault)` o único almacén.

### Validación
- **Frontend build**: ✅ 0 errores.
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.

### Conclusión
La jerarquía de almacén ahora está implementada **al 100%** en todos los puntos de resolución identificados.


---

## Sesión 2026-05-27 — Estandarización: propagación de almacén de cabecera a líneas

### Contexto
El usuario definió la arquitectura:
- **Cabecera**: `warehouseId` referencial (reportes, fallback del backend).
- **Líneas**: `warehouseId` real. Determina el movimiento de stock.
- **Regla**: si el usuario cambia manualmente el almacén en cabecera, debe replicarse automáticamente a **todas las líneas**.

### Implementación

#### 1. Base comercial (`CommercialDocumentFormBase`)
Se agregaron dos métodos estandarizados:

```typescript
protected propagateWarehouseToLines(warehouseId: number | null): void
onHeaderWarehouseChanged(warehouseId: number | null): void
```

- `propagateWarehouseToLines`: itera `itemsArray` y asigna el `warehouseId` a cada línea sin disparar recálculos de precio/impuesto.
- `onHeaderWarehouseChanged`: actualiza el control de cabecera y replica a todas las líneas.

#### 2. Formularios estandarizados

| Formulario | Acción |
|-----------|--------|
| `delivery-orders` | Reemplazado `onHeaderWarehouseSelected` (solo vacías) por `onHeaderWarehouseChanged` (todas). |
| `purchase-receipts` | Idem. |
| `sale-reserve-invoices` | `override onHeaderWarehouseChanged` que actualiza `headerWarehouseId` y llama a `super`. |
| `sale-invoices` | Agregado `(warehouseSelected)` en selector de cabecera. |
| `purchase-invoices` | Agregado `(warehouseSelected)` en selector de cabecera. |
| `sales-returns` | Agregado `(warehouseSelected)` en selector de cabecera. |
| `purchase-returns` | Agregado `(warehouseSelected)` en selector de cabecera. |
| `purchase-orders` | Agregado `(warehouseSelected)` en selector de cabecera + `override onHeaderWarehouseChanged` para sincronizar `headerWarehouseId`. |

**Nota:** `sales-quotations`, `purchase-quotations`, `sales-orders` y `purchase-reserve-invoices` **no tienen selector editable de almacén en cabecera**, por lo que no requieren propagación manual. Sus líneas ya reciben el almacén vía `defaultWarehouseId` (jerarquía completa) al crearse.

### Validación
- **Frontend build**: ✅ 0 errores.
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.

### Comportamiento final
1. Formulario nuevo → cabecera toma `defaultWarehouseId` (jerarquía: usuario → sucursal → sistema → único).
2. Usuario cambia almacén en cabecera → **todas las líneas** se actualizan con ese almacén.
3. Documento existente cargado → cada línea conserva su `warehouseId` original.
4. Backend recibe `warehouseId` en cabecera y en cada línea; usa `line.warehouseId` para stock y cabecera para reportes/fallback.


---

## Sesión 2026-05-27 — Fix: agregar defaultWarehouseId al formulario de usuarios

### Problema detectado
El usuario identificó que la jerarquía de almacén incluye el eslabón **"Usuario"** (`auth.defaultWarehouseId`), pero no había forma de configurar ese campo desde el frontend. El formulario de usuarios solo tenía:
- Sucursal por defecto (`defaultBranchId`)
- Permisos de pestañas
- Pero **no** almacén por defecto.

### Gaps encontrados
1. **Backend `UpdateUserDto`**: no incluía `defaultWarehouseId` (solo `CreateUserDto` lo tenía).
2. **Backend `users.service.ts`**: el método `updateUser` no propagaba `defaultWarehouseId` a Prisma.
3. **Frontend `User` model**: no tenía `defaultWarehouseId`.
4. **Frontend `users.service.ts`**: `CreateUserPayload` y `UpdateUserPayload` no incluían `defaultWarehouseId`.
5. **Frontend `user-form.component.ts/.html`**: no tenía campo de almacén por defecto.

### Fixes aplicados

| Archivo | Cambio |
|---------|--------|
| `backend-erp/src/users/dto/update-user.dto.ts` | Agregado `defaultWarehouseId?: number \| null`. |
| `backend-erp/src/users/users.service.ts` | En `updateUser`, ahora propaga `dto.defaultWarehouseId` a Prisma. |
| `erp-frontend/src/app/models/user.model.ts` | Agregado `defaultWarehouseId?: number \| null`. |
| `erp-frontend/src/app/pages/users/users.service.ts` | Agregado `defaultWarehouseId` a `CreateUserPayload` y `UpdateUserPayload`. |
| `erp-frontend/src/app/pages/users/user-form.component.ts` | Agregado campo `defaultWarehouseId` al `FormGroup`, carga de almacenes (`WarehousesService`), y propagación al payload de create/update. |
| `erp-frontend/src/app/pages/users/user-form.component.html` | Agregado `<app-warehouse-selector>` junto al selector de sucursal. |

### Jerarquía de almacén ahora completa (configurable en UI)

```
1. Usuario       → Configuración → Usuarios → Almacén por defecto
2. Sucursal      → Configuración → Sucursales → Almacén por defecto
3. Sistema       → Configuración → Almacenes → Marcado como "Por defecto"
4. Único almacén → Si solo existe uno activo
5. null
```

### Validación
- **Backend build**: ✅ 0 errores.
- **Backend tests**: ✅ `users.service.spec.ts` + `users.controller.spec.ts` pasan.
- **Frontend build**: ✅ 0 errores.
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.


---

## Sesión 2026-05-27 — Fix: modal "Cambios sin guardar" al guardar sucursal

### Problema
Al presionar **Guardar cambios** en el formulario de sucursales (`branch-form`), aparecía el modal "Cambios sin guardar" justo después de guardar exitosamente, cuando el componente intentaba navegar de vuelta al listado.

### Causa
El `dirtyCheckGuard` se ejecuta durante la navegación. En `branch-form.component.ts`, el método `save()` no reseteaba el estado de cambios antes de llamar a `router.navigate()`. Por tanto:
1. El formulario seguía siendo "dirty" respecto al snapshot original del `FormDirtyTrackerService`.
2. `hasChanges` seguía siendo `true`.
3. El guard detectó cambios pendientes y mostró el modal.

### Fix
En `branch-form.component.ts`, dentro del callback `next` de `save()`:
```typescript
this.dirtyTracker.reset(this.form);
this.hasChanges = false;
this.router.navigate(['/branches']);
```

Esto actualiza el snapshot del formulario y marca `hasChanges = false` **antes** de que el guard `canDeactivate` evalúe la navegación.

### Validación
- **Frontend build**: ✅ 0 errores.
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.


---

## Sesión 2026-05-27 — Fix masivo: modal "Cambios sin guardar" en 23 formularios

### Problema
El usuario preguntó si el bug del modal "Cambios sin guardar" al guardar también afectaba a otros formularios. Se hizo una auditoría y se encontró que **23 formularios** tenían el mismo problema: después de guardar exitosamente, navegaban sin resetear el `dirtyTracker`, por lo que el guard `canDeactivate` mostraba el modal.

### Formularios corregidos

| # | Formulario | Fix |
|---|-----------|-----|
| 1 | `users/user-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` en edit y create. |
| 2 | `partners/partner-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 3 | `items/item-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 4 | `warehouses/warehouse-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 5 | `item-boms/item-boms-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` (create y edit) |
| 6 | `item-groups/item-group-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 7 | `partner-groups/partner-group-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 8 | `tax-indicators/tax-indicator-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 9 | `uoms/uom-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 10 | `uom-conversions/uom-conversion-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 11 | `price-lists/price-list-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 12 | `payment-terms/payment-term-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 13 | `projects/projects-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 14 | `pos-terminals/pos-terminal-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 15 | `exchange-rates/exchange-rate-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 16 | `employees/employee-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 17 | `discount-groups/discount-groups-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` (edit y create) |
| 18 | `banks/bank-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 19 | `banks/bank-account-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 20 | `accounts/account-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 21 | `udf/udf-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` |
| 22 | `special-prices/special-price-form.component.ts` | `dirtyTracker.reset(this.form)` + `hasChanges = false` antes de `goBack()` |
| 23 | `purchase-requests/purchase-requests-form.component.ts` | `dirtyTracker.reset(this.form)` en `save()` (create) y `convertToOrder()` |

### Nota técnica
En `purchase-requests-form.component.ts`, `hasChanges` es un getter (`get hasChanges(): boolean`), por lo que no se puede asignar directamente. En ese formulario solo se aplicó `dirtyTracker.reset(this.form)`, que es suficiente para que el getter devuelva `false`.

### Patrón aplicado
En todos los casos, antes de `router.navigate()` o `goBack()` en el callback `next` del guardado:
```typescript
this.dirtyTracker.reset(this.form);
this.hasChanges = false; // cuando es propiedad, no getter
this.router.navigate([...]);
```

### Validación
- **Frontend build**: ✅ 0 errores.
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.
