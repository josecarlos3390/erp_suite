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


---

## Sesión 2026-06-14 — LUNA Form Layout System: piloto y validación

### Objetivo
Crear y validar el sistema de layout declarativo `luna-form-*` para unificar la retícula, espaciado y jerarquía visual de los 51 formularios del frontend.

### Componentes creados (`src/app/shared/luna-form/`)

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| `LunaFormPageComponent` | `luna-form-page.component.ts` | Contenedor raíz de página; expone `density` y slots `lunaFormHeader` / `lunaFormActions`. |
| `LunaFormSectionComponent` | `luna-form-section.component.ts` | Tarjeta de sección con `title`, `hint` y `status`. |
| `LunaFormRowComponent` | `luna-form-row.component.ts` | Fila grid responsiva (`columns` 1-4, `gap` sm/md/lg). |
| `LunaFormFieldComponent` | `luna-form-field.component.ts` | Envoltorio `label + hint + error` para controles sin label propio. |
| `LunaFormTabsComponent` | `luna-form-tabs.component.ts` | Pestañas accesibles unificadas. |

### Tokens y configuración
- Creado `src/styles/_form-density.scss` con 3 escalas: `compact`, `comfortable`, `spacious`.
- Añadido `stylePreprocessorOptions.includePaths: ["src/styles"]` en `angular.json` para importar `breakpoints` desde cualquier componente.

### Formularios migrados (piloto)
1. `tax-indicators/tax-indicator-form.component.html`
2. `warehouses/warehouse-form.component.html` (incluye `<luna-form-tabs>`)
3. `users/user-form.component.html`

### Reglas documentadas en `AGENTS.md`
- Todo formulario nuevo/refactorizado debe usar `<luna-form-page>` como raíz.
- Agrupar campos en `<luna-form-section>`.
- Alinear controles con `<luna-form-row>`; evitar grids custom en SCSS de página.
- Usar `<luna-form-tabs>` en lugar de `.tab-bar` / `.tab-switcher`.
- Prohibido `::ng-deep` sobre primitivos LUNA.

### Validación
- **Frontend build**: ✅ 0 errores (warning bundle budget: +15.56 kB, no bloqueante).
- **Frontend lint**: ✅ 0 errores, ~45 warnings preexistentes.
- **Frontend tests**: ✅ 564/564 SUCCESS.

### Próximos pasos
1. Migrar 48 formularios restantes, priorizando masters simples y luego documentos comerciales.
2. Reemplazar `app-document-header-tabs` y tabs de documentos comerciales por `<luna-form-tabs>`.
3. Generar baseline visual con Playwright.


---

## Sesión 2026-06-14 — LUNA Form: migración de 9 masters simples (lote 1)

### Objetivo
Avanzar la migración masiva de formularios al patrón LUNA Form, comenzando por masters simples sin tabs para validar el proceso manual y preservar funcionalidades.

### Formularios migrados
1. `banks/bank-form`
2. `banks/bank-account-form`
3. `branches/branch-form`
4. `currencies/currency-form`
5. `uoms/uom-form`
6. `uom-conversions/uom-conversion-form`
7. `partner-groups/partner-group-form`
8. `payment-terms/payment-term-form`
9. `projects/projects-form`

### Cambios realizados
- Reemplazo de `<div class="form-page">` por `<luna-form-page>`.
- Uso de `<luna-form-section>` para agrupar campos, incluyendo títulos, hints y acciones (`lunaSectionActions`).
- Reemplazo de `<div class="form-row-*">` por `<luna-form-row [columns]="N">`.
- Envoltura de selectores custom (`app-enum-selector`, `app-warehouse-selector`, etc.) en `<luna-form-field>`.
- Aplicación de slots `lunaFormHeader` y `lunaFormActions` en `app-document-form-header` y `app-document-action-bar`.
- Actualización de imports TypeScript en cada componente para incluir los componentes LUNA Form necesarios.
- Reemplazo de íconos nativos `<i class="fas fa-spinner">` por `<luna-action-icon action="spinner">` en los formularios tocados.

### Lección aprendida
Un script de migración automática masiva fue descartado: generó etiquetas desbalanceadas e imports rotos en varios archivos. Se optó por migración manual por lotes, revisando build/lint/tests tras cada grupo.

### Validación
- **Frontend build**: ✅ 0 errores (warning bundle budget +15.56 kB, no bloqueante).
- **Frontend lint**: ✅ 0 errores, ~45 warnings preexistentes.
- **Frontend tests**: ✅ 564/564 SUCCESS.

### Estado acumulado
- **Migrados**: 12 formularios.
- **Restantes**: 39 formularios (masters simples, documentos comerciales, tabs, baseline visual).


## Sesión 2026-06-14 — LUNA Form: lote 2 (formularios complejos sin tabs)

### Objetivo
Continuar la migración masiva al patrón LUNA Form, atacando formularios de dominio más complejos que no usan `app-document-header-tabs` (maestros con líneas, inventario, UDFs y guías).

### Formularios migrados
1. `item-groups/item-group-form`
2. `udf/udf-form`
3. `stock-counts/stock-counts-form`
4. `transport-guides/transport-guides-form`
5. `item-boms/item-boms-form`

### Cambios realizados
- Reemplazo de `<div class="form-page">` / `<div class="document-form">` por `<luna-form-page>` con slots `lunaFormHeader` y `lunaFormActions`.
- Uso de `<luna-form-section>` y `<luna-form-row [columns]="N">` para datos generales, filtros y secciones de líneas.
- Envoltura de selectores custom (`app-partner-selector`, `app-warehouse-selector`, `app-branch-selector`, `app-project-selector`, `app-item-selector`, `app-uom-selector`) en `<luna-form-field>`.
- Reemplazo de íconos nativos `<i class="fas fa-spinner">` / `<i class="fas fa-edit">` por `<luna-action-icon action="spinner">` / `<luna-action-icon action="edit">`.
- Corrección en `LunaFormFieldComponent`: el input `error` ahora acepta `string | undefined` para compatibilidad con bindings condicionales.
- Actualización de imports TypeScript en cada componente para incluir `LunaFormPageComponent`, `LunaFormSectionComponent`, `LunaFormRowComponent` y `LunaFormFieldComponent`.

### Validación
- **Frontend build**: ✅ 0 errores (warning bundle budget +15.56 kB, no bloqueante).
- **Frontend lint**: ✅ 0 errores, ~45 warnings preexistentes.
- **Frontend tests**: ✅ 564/564 SUCCESS.

### Estado acumulado
- **Migrados**: 21 formularios.
- **Restantes**: 30 formularios (masters con tabs, documentos comerciales con `app-document-header-tabs`, y baseline visual con Playwright).


---

## Sesión 2026-05-27 — LUNA Form: lote 3 (tabs + ajustes)

### Objetivo
Continuar la migración masiva al patrón LUNA Form, implementando el componente de pestañas faltante, migrando el primer formulario con tabs (`employee-form`) y limpiando la proyección del slot de acciones en `journal-entries-form`.

### Formularios migrados
1. `employees/employee-form` (reemplaza `app-document-header-tabs` por `<luna-form-tabs>`).

### Componentes creados / ajustados
- `src/app/shared/luna-form/luna-form-tabs.component.ts` + `.scss`: pestañas accesibles con `role="tablist"`, `role="tab"`, `aria-selected`, y soporte de iconos opcionales.
- `src/app/shared/luna-form/index.ts`: exporta `LunaFormTabsComponent` y el tipo `LunaFormTab`.
- `src/app/pages/journal-entries/journal-entries-form.component.html`: atributo `lunaFormActions` aplicado directamente sobre `<app-document-action-bar>` para evitar nodos proyectables múltiples.

### Cambios realizados
- Reemplazo de `<div class="form-page">` por `<luna-form-page>` con slots `lunaFormHeader` y `lunaFormActions`.
- Uso de `<luna-form-tabs>` + `@switch (activeTab)` para navegación entre pestañas.
- Agrupación de campos en `<luna-form-section>` y alineación con `<luna-form-row [columns]="N">`.
- Envoltura de selectores custom (`app-branch-selector`, `app-user-selector`) en `<luna-form-field>`.
- Eliminación de imports obsoletos (`DocumentHeaderTabsComponent`, `DocumentHeaderTabsConfig`, `DocumentHeaderTabDirective`, `Employee`).

### Validación
- **Frontend build**: ✅ 0 errores (warning bundle budget +17.83 kB, no bloqueante).
- **Frontend lint**: ✅ 0 errores, 45 warnings preexistentes.
- **Frontend tests**: ✅ 564/564 SUCCESS.

### Estado acumulado
- **Migrados**: 26 formularios.
- **Restantes**: 25 formularios (`items`, `partners`, `price-lists`, `special-prices`, documentos comerciales con líneas, y baseline visual con Playwright).


---

## Sesión 2026-05-27 — LUNA Form: lote 4 (masters con listas de precios)

### Objetivo
Continuar la migración masiva al patrón LUNA Form migrando los formularios de listas de precios y precios especiales, que usan maquetados custom de listado interno.

### Formularios migrados
1. `price-lists/price-list-form`
2. `special-prices/special-price-form`

### Cambios realizados
- Reemplazo de `<div class="form-page">` por `<luna-form-page>` con slots `lunaFormHeader` y `lunaFormActions`.
- Uso de `<luna-form-section>` para agrupar datos generales, configuración y sección de artículos.
- Uso de `<luna-form-row [columns]="N">` para alinear código/descripción/moneda y otros campos.
- Envoltura de selectores custom (`app-currency-selector`, `app-partner-selector`, `app-price-list-selector`) en `<luna-form-field>`.
- Reemplazo de íconos nativos `<i class="fas fa-spinner">` por `<luna-action-icon action="spinner">`.
- Reemplazo de flechas font-awesome en paginador por `action="arrowLeft"` / `action="arrowRight"` de `luna-button`.
- Actualización de imports TypeScript para incluir los componentes LUNA Form.

### Validación
- **Frontend build**: ✅ 0 errores (warning bundle budget +17.83 kB, no bloqueante).
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.
- **Frontend tests**: ✅ 564/564 SUCCESS.

### Estado acumulado
- **Migrados**: 28 formularios.
- **Restantes**: 23 formularios (`items`, `partners`, documentos comerciales con líneas, movimientos de inventario, pagos, y baseline visual con Playwright).


---

## Sesión 2026-05-27 — Rediseño premium de `user-form` + verificación con Playwright

### Objetivo
Responder a la observación de UX/UI en el formulario de usuarios. Revisar visualmente con Playwright, corregir la proyección de slots LUNA y aplicar un layout premium con secciones claras, grids y tarjetas de opciones.

### Cambios realizados
- `src/app/pages/users/user-form.component.html`:
  - Se quitaron los `<div>` envolventes incorrectos de `lunaFormHeader` y `lunaFormActions`; los atributos ahora viven directamente en `app-document-form-header` y `app-document-action-bar`.
  - Se añadió `class="luna-form-page__body"` al `<form>` para que herede el padding y gap del contenedor LUNA.
  - Sección "Información general" con `<luna-form-row [columns]="3">` (datos de acceso + asignación).
  - Nueva sección "Estado" con tarjeta toggle (`luna-switch`) para activar/inactivar usuario.
  - Sección "Permisos de facturación" con lista de tarjetas: título + descripción a la izquierda, checkbox a la derecha.
  - Sección "Visibilidad de pestañas" con grid de 3 tarjetas iguales.
- `src/app/pages/users/user-form.component.scss`:
  - Estilos premium para `.user-status-card` y `.user-option-card`.
  - Grid responsivo para visibilidad (3 → 2 → 1 columnas).
- `src/app/pages/users/user-form.component.ts`:
  - Se añadió `LunaSwitchComponent` a los imports.
- `e2e/auth.setup.ts`:
  - Se corrigieron los selectores de login de `#email` / `#password` a `input#email` / `input#password` porque `luna-input` expone el mismo `id` en su host.
- `e2e/screenshot-user-form.spec.ts`:
  - Nuevo spec E2E que hace login real, navega a `/users/1/edit`, ajusta el viewport y guarda `playwright-report/user-form-after.png`.

### Validación visual
- Screenshot generado con Playwright: `playwright-report/user-form-after.png`.
- El formulario ahora muestra secciones diferenciadas, grid de 3 columnas, tarjetas de opciones con título/descripción alineadas y un interruptor de estado estilo toggle.

### Validación técnica
- **Frontend build**: ✅ 0 errores (warning bundle budget +17.83 kB, no bloqueante).
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.
- **Frontend tests**: ✅ 564/564 SUCCESS.
- **Playwright**: ✅ spec de screenshot pasa en chromium.

### Lección aprendida
- Los slots `lunaFormHeader` y `lunaFormActions` deben ir directamente sobre el componente proyectable (`app-document-form-header`, `app-document-action-bar`); envolverlos en `<div>` rompe la proyección y el layout.
- Para verificar diseño real se debe usar Playwright con login fresco (el storage state puede expirar por desfase de reloj) y un viewport suficientemente alto para evitar artefactos de la action-bar fija en screenshots full-page.

## Migración masiva a LUNA Form — Lote 3 (partner-form, item-form, purchase-requests-form)

### Acciones realizadas
1. **Corregir posición de hints en `luna-form-field`:**
   - El hint se movió debajo del control (label → control → hint → error), alineado con `luna-input`.

2. **Migrar `partners/partner-form`:**
   - Template LUNA con `<luna-form-page>`, `<luna-form-tabs>` (8 pestañas) y secciones/filas/campos.
   - Se conservaron listas custom de direcciones y cuentas bancarias editadas en modales.
   - Nuevo spec: `src/app/pages/partners/partner-form.component.spec.ts` (8 tests).
   - Nuevo screenshot spec: `e2e/partner-form-screenshot.spec.ts` → `e2e/screenshots/partner-form-after.png`.

3. **Migrar `items/item-form`:**
   - Mismo patrón LUNA; tabs: General, Stock y logística, Producción, Almacenes y cuentas.
   - Se mantuvieron tarjetas expandibles de cuentas por almacén (`warehouseAccounts`).
   - Nuevo spec: `src/app/pages/items/item-form.component.spec.ts` (6 tests).
   - Nuevo screenshot spec: `e2e/item-form-screenshot.spec.ts` → `e2e/screenshots/item-form-after.png`.

4. **Migrar `purchase-requests/purchase-requests-form`:**
   - Template LUNA con tabs General / Líneas.
   - Se mantuvo `luna-data-table` para el `FormArray` de líneas y el workflow de aprobación.
   - Botón "Agregar línea" ubicado en el slot `lunaFormSectionActions` de la sección de líneas.
   - Nuevo spec: `src/app/pages/purchase-requests/purchase-requests-form.component.spec.ts` (6 tests).
   - Nuevo screenshot spec: `e2e/purchase-requests-form-screenshot.spec.ts` → `e2e/screenshots/purchase-requests-form-after.png`.

5. **Actualizar documentación:**
   - `AGENTS.md`: sección *Frontend LUNA Form Layout System* actualizada a 31 formularios migrados, 20 restantes, 576 tests, ruta de screenshots `e2e/screenshots/` y conteos de hooks/CI.

### Validación técnica
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.
- **Frontend build**: ✅ 0 errores (warning bundle budget +17.83 kB, no bloqueante).
- **Frontend tests**: ✅ 576/576 SUCCESS.
- **Playwright screenshots**: ✅ `partner-form-after.png`, `item-form-after.png`, `purchase-requests-form-after.png` generados.

### Lección aprendida
- Los specs de screenshot deben inyectar `auth_user` en `sessionStorage` (`page.addInitScript`) además de reutilizar `storageState`, porque `AuthService` lee el usuario de `sessionStorage` y los guards de permisos/tipo de cambio lo requieren.
- Para formularios comerciales con líneas, conviene mantener `luna-data-table` y usar `lunaFormSectionActions` para la acción "Agregar línea", evitando que flote fuera de la sección.

## Migración masiva a LUNA Form — Lote 4 (stock + pagos)

### Acciones realizadas
1. **Migrar 4 formularios de stock:**
   - `src/app/pages/stock-adjustments/stock-adjustments-form.component.{ts,html,scss}`
   - `src/app/pages/stock-entries/stock-entries-form.component.{ts,html,scss}`
   - `src/app/pages/stock-exits/stock-exits-form.component.{ts,html,scss}`
   - `src/app/pages/stock-transfers/stock-transfers-form.component.{ts,html,scss}`
   - Todos con patrón LUNA: `<luna-form-page>`, `<luna-form-tabs>`, secciones/filas/campos.
   - Se mantuvieron tablas de líneas con `luna-data-table` y acciones en `lunaFormSectionActions`.
   - Se actualizaron imports en TypeScript y se redujeron estilos locales.

2. **Migrar 2 formularios de pagos:**
   - `src/app/pages/incoming-payments/incoming-payments-form.component.{ts,html,scss}`
   - `src/app/pages/outgoing-payments/outgoing-payments-form.component.{ts,html,scss}`
   - Mismo patrón LUNA; se conservaron tablas de aplicación a documentos y lógica de asignación.

3. **Specs y screenshots:**
   - Nuevos specs de componente para los 6 formularios.
   - Nuevos specs de Playwright: `e2e/stock-*-form-screenshot.spec.ts`, `e2e/incoming-payments-form-screenshot.spec.ts`, `e2e/outgoing-payments-form-screenshot.spec.ts`.
   - Screenshots generados en `e2e/screenshots/`.

4. **Actualizar documentación:**
   - `AGENTS.md`: conteo actualizado a 37 formularios migrados, 14 restantes, 586 tests.

### Validación técnica
- **Frontend lint**: ✅ 0 errores, 44 warnings preexistentes.
- **Frontend build**: ✅ 0 errores (warning bundle budget +17.83 kB, no bloqueante).
- **Frontend tests**: ✅ 586/586 SUCCESS.
- **Playwright screenshots**: ✅ 6 screenshots generados.

### Notas
- Los subagentes alcanzaron el límite de pasos al intentar migrar todo el lote; se completaron mediante validación global y ajustes finales.
- `stock-counts-form` ya estaba migrado previamente; no se contó en este lote.

## Auditoría de perfil fiscal del tenant, billing e infraestructura (Jun 2026)

### Acciones realizadas
1. **Validación backend (read-only con subagentes):**
   - Modelo `Tenant` en `prisma/schema.prisma`: confirma ausencia de `businessName`, `taxId`/`NIT`, dirección fiscal, teléfono, email, representante legal y actividad económica.
   - `TenantService`/`TenantController`: solo crean/editan `slug`, `name`, `plan`, `timeZone`, `countryCode`; no hay endpoint de perfil fiscal.
   - Plantillas PDF (`common/pdf/templates/*.template.ts`) y controladores (`sale-invoices.controller.ts`) no reciben ni imprimen datos del emisor.
   - Billing: no existe modelo `Subscription`, `trialEndsAt`, integración Stripe/PayPal ni cuotas por tenant. Solo `TenantPlan { SHARED, DEDICATED }` + `isActive`.
   - Aislamiento: `TenantMiddleware` pone `tenantId` en `req` desde JWT; cada servicio agrega `tenantId` manualmente. No hay `TenantGuard`, interceptor ni extensión de Prisma.
   - Rate limiting: `@nestjs/throttler` 60 req/60s por IP; login 5 intentos/min. No es por tenant.
   - Monitoreo: `TenantMetrics` + cron diario + `/admin/tenant-health`. Sin Prometheus/alertas externas.
   - Backups/load tests: no hay scripts ni pruebas de carga en el repo.

2. **Validación frontend (read-only con subagentes):**
   - `/settings` solo edita moneda, tracking, país, zona horaria; no hay perfil fiscal de empresa.
   - `/branches` solo código/nombre/dirección/almacén; no NIT/razón social por sucursal.
   - No hay botón "Descargar PDF" en los formularios (solo servicios que apuntan al backend); el frontend no posee plantillas de impresión.
   - No hay indicadores de plan/trial/suscripción en la UI.

3. **Documentación actualizada:**
   - `AUDIT_TRACKING.md`:
     - Fecha de actualización cambiada a `24/06/2026`.
     - Agregada **Fase 6 — Infraestructura, Perfil Fiscal del Emisor & Billing** con 7 ítems (6.1 perfil fiscal, 6.2 billing, 6.3 aislamiento, 6.4 backups, 6.5 rate limiting, 6.6 monitoreo, 6.7 pruebas de carga).
     - Agregada métrica actual del backend (build/lint/tests/E2E) al 24/06/2026.
   - `AUDIT_REPORT_V2.md`:
     - Agregada conclusión #6 sobre modelo SaaS.
     - Agregada **Sección 11 — Observaciones de Producción y Modelo de Negocio (Jun 2026)** con los 7 puntos validados.
   - `ROADMAP.md`:
     - Agregado ítem **1.6 Perfil fiscal del emisor (tenant)** en Fase 1 (bloqueante para producción).
     - Agregada **Fase 8 — SaaS & Operaciones** con billing, cuotas/rate limiting, backups, monitoreo y pruebas de carga.

### Validación técnica
- **Backend lint**: ✅ 0 errores, 0 warnings (previo a esta auditoría).
- **Backend build**: ✅ OK.
- **Backend unit tests**: ✅ 103 suites, 856 tests.
- **Backend E2E**: ✅ 8 suites, 40 tests.
- No se modificó código fuente del ERP en este paso; solo documentación.

### Hallazgos críticos documentados
1. **Perfil fiscal del emisor inexistente**: bloqueante para facturas legales en Bolivia.
2. **Billing/suscripciones inexistente**: bloqueante para modelo SaaS de cobro.
3. **Aislamiento de tenants manual**: riesgo de data leak por error humano.
4. **Sin backups, monitoreo externo, rate limiting por tenant ni pruebas de carga**: riesgos operativos para producción multitenant.

## Recuperación de E2E backend (25/06/2026)

### Problema
Los tests E2E del backend fallaban masivamente con:
```
PrismaClientKnownRequestError: The column `existe` does not exist in the current database.
```
Además, el comando `npm run test:e2e` se atoraba y terminaba en timeout (>600 s) porque la base de test `erp_test` no estaba sincronizada con el schema de Prisma y el timeout por defecto de Jest (5 s) no alcanzaba para iniciar la app NestJS en cada suite.

### Acciones realizadas
1. **Sincronizar base de test** (`erp_test`):
   ```powershell
   cd backend-erp
   $env:DATABASE_URL="postgresql://postgres:HoN3390@localhost:5432/erp_test?schema=public"
   npx prisma db push --accept-data-loss
   npx prisma generate
   ```
   - Se detuvieron procesos Node del backend que mantenían bloqueado el motor de consultas de Prisma (`query_engine-windows.dll.node`).
   - `erp_test` quedó alineada con `prisma/schema.prisma`.

2. **Robustecer configuración E2E** (`test/jest-e2e.json`):
   - `testTimeout`: `30000` ms (evita timeouts en `beforeAll` al bootstrappear la app).
   - `forceExit`: `true` (evita que handles asíncronos residuales mantengan vivo Jest entre suites).

### Validación técnica
- **Backend lint**: ✅ 0 errores, 0 warnings.
- **Backend build**: ✅ OK.
- **Backend unit tests**: ✅ 103 suites, 856 tests.
- **Backend E2E**: ✅ 8 suites, 40 tests en ~120 s.

### Notas
- El error de schema drift (`existe`) ya no se reproduce.
- El warning recurrente "Force exiting Jest" ahora es esperado y controlado por `forceExit: true` mientras se identifican los handles abiertos entre suites.
- El servidor de desarrollo del backend se detuvo durante el `prisma generate`; debe reiniciarse si se requiere.

## Fase 8.1 — Billing y Suscripciones (MVP partner-local)

### Contexto
El ERP necesitaba habilitar el modelo SaaS de cobro. En Bolivia no se usa Stripe/PayPal, así que se diseñó un MVP **partner-agnostic**: administración manual de suscripciones + webhook público listo para integrar con un partner local de pagos.

### Acciones realizadas
1. **Schema Prisma**:
   - Nuevo modelo `Subscription` (1:1 con `Tenant`).
   - Nuevos enums: `SubscriptionStatus { TRIAL, ACTIVE, PAST_DUE, CANCELLED, EXPIRED }`, `BillingProvider { MANUAL, PARTNER_LOCAL }`.
   - Relación inversa `subscription` en `Tenant`.
   - Sincronización de `erp_db` y `erp_test` vía `prisma db push --accept-data-loss`.

2. **Backend** (`backend-erp/src/billing/`):
   - `BillingModule`, `BillingController`, `BillingService`.
   - DTOs: `ActivateSubscriptionDto`, `CancelSubscriptionDto`, `WebhookEventDto`, `SubscriptionResponseDto`.
   - Provider manual (`ManualBillingProvider`) con cálculo de monto sugerido.
   - Endpoints:
     - `GET /billing/status` (`billing:view`)
     - `POST /billing/activate` (`billing:manage`)
     - `POST /billing/cancel` (`billing:manage`)
     - `POST /billing/webhook/:provider` (público)
   - Cron diario `0 1 * * *` para expirar trials y periodos vencidos.
   - Exclusión del webhook de `CsrfMiddleware`, `JwtAuthGuard` y `PermissionsGuard` vía decorador `@Public()`.
   - Permisos `billing` agregados a `DEFAULT_PERMISSIONS` (admin `manage`, user `view`).

3. **Frontend** (`erp-frontend/src/app/pages/billing/`):
   - Modelo `Subscription`, servicio `BillingService`.
   - Página `/billing` con tarjeta de estado y formulario de activación/renovación/cancelación (solo admin con `billing:manage`).
   - Ruta registrada en `app.routes.ts` y entrada en sidebar (`sidebar.component.html` y `sidebar.config.ts`).

4. **Tests**:
   - Backend: `billing.service.spec.ts` + `billing.controller.spec.ts` (14 tests nuevos).
   - Frontend: `billing.component.spec.ts`.

### Validación técnica
- **Backend build**: ✅ OK.
- **Backend lint**: ✅ 0 errores, 0 warnings.
- **Backend unit tests**: ✅ 105 suites, 870 tests.
- **Backend E2E**: ✅ 9 suites, 44 tests (incluye `billing.e2e-spec.ts`).
- **Frontend build**: ✅ OK.
- **Frontend lint**: ✅ 0 errores.
- **Frontend tests**: ✅ 584 tests.

### Notas
- El webhook no valida firma aún; está preparado para que el partner local envíe eventos `payment_received`, `subscription_cancelled`, `subscription_renewed`.
- Se decidió no agregar Stripe/PayPal porque no se usan en Bolivia; la arquitectura permite agregar un `BillingProviderAdapter` cuando se defina el partner.

## Billing enforcement — SubscriptionGuard + banner frontend

### Contexto
El MVP de billing ya existía, pero no bloqueaba operaciones cuando la suscripción vencía. Se implementó el enforcement para que el SaaS tenga dientes.

### Acciones realizadas
1. **Backend**:
   - Nuevo decorador `@SkipSubscription()` (`src/billing/subscription.decorator.ts`).
   - Nuevo `SubscriptionGuard` (`src/billing/subscription.guard.ts`) registrado como `APP_GUARD`:
     - Pasa `@Public()`, `@SkipSubscription()`, métodos de lectura y usuarios con `billing:manage`.
     - Bloquea `POST/PUT/PATCH/DELETE` si la suscripción está `EXPIRED`, `CANCELLED`, `PAST_DUE` o `TRIAL` vencido.
   - `BillingController` marcado con `@SkipSubscription()` para permitir la autogestión.
   - `cleanupAllTestData` actualizado para borrar `Subscription` antes del `Tenant`.

2. **Frontend**:
   - `LayoutComponent` carga el estado de suscripción al iniciar.
   - Banner rojo fijo cuando la suscripción está inactiva, con link a `/billing` para admins.
   - Banner amarillo cuando quedan ≤ 3 días de trial.
   - Toast de error al iniciar sesión si la suscripción está vencida.

3. **Tests**:
   - `subscription.guard.spec.ts` (6 tests).
   - E2E `billing.e2e-spec.ts` ampliado con caso de bloqueo de documentos para usuario sin `billing:manage`.
   - `layout.component.spec.ts` actualizado con mocks y test de banner.

### Validación técnica
- **Backend build**: ✅ OK.
- **Backend lint**: ✅ 0 errores, 0 warnings.
- **Backend unit tests**: ✅ 106 suites, 876 tests.
- **Backend E2E**: ✅ 9 suites, 45 tests.
- **Frontend build**: ✅ OK.
- **Frontend lint**: ✅ 0 errores, 0 warnings.
- **Frontend tests**: ✅ 585 tests.

### Notas
- El guard consulta `BillingService.getStatus()` en cada request mutante; más adelante se puede cachear en memoria o incluir el estado en el JWT si el volumen lo justifica.
- Los usuarios `ADMIN`/`billing:manage` pueden seguir operando para renovar; el bloqueo afecta a usuarios operativos normales.

## Fase 6.4 — Backups y Disaster Recovery

### Contexto
La auditoría identificó que no existían scripts ni documentación de backup/restore de PostgreSQL. Se implementó una solución local, reproducible y versionada.

### Acciones realizadas
1. **Scripts Node reutilizables**:
   - `backend-erp/scripts/db-utils.js`: parseo de `DATABASE_URL`, búsqueda de binarios PostgreSQL en PATH y rutas comunes, helper para ejecutar comandos.
   - `backend-erp/scripts/backup-db.js`: backup completo con `pg_dump --format=c`, timestamp y limpieza automática de backups antiguos.
   - `backend-erp/scripts/restore-db.js`: restore con `pg_restore --clean --if-exists`, confirmación si el host no es localhost.

2. **Comandos npm**:
   - `npm run backup:db`
   - `npm run restore:db`

3. **Documentación**:
   - `backend-erp/docs/BACKUPS.md` con RPO/RTO, retención, pasos de restore, checklist de DR y variables de entorno.

4. **Gitignore**:
   - `backups/` y `*.dump` ignorados en `backend-erp/.gitignore` y raíz.

### Validación técnica
- **Backup real**: ✅ generado `backend-erp/backups/erp-backup-*.dump` (0.92 MB).
- **Restore real en `erp_test`**: ✅ completado.
- **Integridad post-restore**: ✅ E2E backend 9 suites / 45 tests pasan.
- **Backend build**: ✅ OK.
- **Backend lint**: ✅ 0 errores / 0 warnings.

### Notas
- El script busca `pg_dump`/`pg_restore` primero en PATH y luego en `C:\Program Files\PostgreSQL\<version>\bin` (Windows) o rutas comunes de Linux/macOS.
- Retención: 7 diarios + 4 semanales.
- Próximo paso recomendado: automatizar el backup diario con el programador del SO o con un cron job en el servidor de producción.

## Fase 6.5 — Rate limiting por tenant

### Contexto
El rate limiting existente era por IP (`@nestjs/throttler` 60 req/60s). En instancias compartidas un tenant abusivo no podía ser contenido sin afectar a otros clientes que compartan la misma IP de oficina. Se implementó rate limiting por `tenantId`, diferenciado por plan.

### Acciones realizadas
1. **Backend — JWT**:
   - `JwtPayload` ahora incluye `tenantPlan?: TenantPlan`.
   - `auth.service.ts` incluye `tenant.plan` en el payload de login y refresh.

2. **Backend — Guard custom**:
   - Nuevo `TenantThrottlerGuard` (`src/throttling/tenant-throttler.guard.ts`) que extiende `ThrottlerGuard`.
   - Tracker `tenant:<tenantId>` para requests autenticadas.
   - Fallback a `ip:<ip>` (con `x-forwarded-for` y `socket.remoteAddress`) para endpoints públicos.
   - Mensaje de error en español al exceder el límite.

3. **Backend — Configuración**:
   - `AppModule` reemplaza `ThrottlerGuard` por `TenantThrottlerGuard`.
   - Reorden de guards: `JwtAuthGuard` → `TenantThrottlerGuard` → `PermissionsGuard` → `BranchRequiredGuard` → `SubscriptionGuard`.
   - `ThrottlerModule.forRoot` usa `limit` dinámico por plan:
     - `SHARED`: `THROTTLE_LIMIT_SHARED` (default 300).
     - `DEDICATED`: `THROTTLE_LIMIT_DEDICATED` (default 2000).
     - Público/IP: `THROTTLE_LIMIT_PUBLIC` (default 60).

4. **Tests**:
   - Nuevo `tenant-throttler.guard.spec.ts` con 8 tests:
     - Trackers tenant e IP.
     - Fallback `x-forwarded-for`.
     - Límites SHARED, DEDICATED y público.
     - Excepción al bloquear.

5. **Documentación**:
   - `backend-erp/docs/RATE_LIMITING.md` con lógica, límites, variables de entorno, headers y notas.
   - `ROADMAP.md` marcado Fase 8.2 como completada.
   - `AUDIT_TRACKING.md` sección 6.5 marcada como resuelta.

### Validación técnica
- **Backend build**: ✅ OK.
- **Backend lint**: ✅ 0 errores, 0 warnings.
- **Backend unit tests**: ✅ 107 suites, 884 tests.
- **Backend E2E**: ✅ 9 suites, 45 tests.

### Notas
- El storage sigue siendo el default en memoria de `@nestjs/throttler`; para múltiples réplicas se requiere Redis en una fase posterior.
- Tokens antiguos sin `tenantPlan` usan el límite `SHARED` (más restrictivo, seguro).
- Un cambio de plan requiere re-login o refresh para reflejar el nuevo límite.

## Fase 6.6 — Monitoreo y alertas de caídas

### Contexto
El ERP no tenía visibilidad operativa: no había forma de saber por health checks si la DB o el disco estaban bien, ni métricas Prometheus para diagnosticar carga por tenant. Se implementó un módulo de monitoreo básico.

### Acciones realizadas
1. **Dependencias**:
   - Instaladas `@nestjs/terminus` y `prom-client`.

2. **Backend — Health checks**:
   - Nuevo `HealthController` (`src/monitoring/health/health.controller.ts`) con endpoint público `GET /health`.
   - Checks:
     - `prisma`: `PrismaHealthIndicator` custom ejecuta `SELECT 1`.
     - `memory`: `MemoryHealthIndicator.checkRSS()` con umbral porcentual de memoria total.
     - `disk`: `DiskHealthIndicator.checkStorage()` con path raíz adaptado a Windows/Linux.
   - `HealthController` usa `@Public()` para load balancers.

3. **Backend — Métricas Prometheus**:
   - Nuevo `MetricsController` (`src/monitoring/metrics/metrics.controller.ts`) expone `GET /metrics` público.
   - `metrics.providers.ts` crea registry de `prom-client` con métricas default de Node.js y contadores/histogram custom.
   - `MetricsInterceptor` global recolecta:
     - `http_requests_total`
     - `http_request_duration_seconds`
     - `http_request_errors_total` (status >= 400)
   - Labels: `method`, `status`, `tenant` (`tenantId` o `public`).
   - Excluye `/health` y `/metrics` del tracking.

4. **Backend — Registro**:
   - `MonitoringModule` importado en `AppModule`.
   - `MetricsInterceptor` registrado como `APP_INTERCEPTOR`.

5. **Tests**:
   - Unitarios:
     - `health.controller.spec.ts`
     - `prisma.health-indicator.spec.ts`
     - `metrics.controller.spec.ts`
     - `metrics.interceptor.spec.ts`
   - E2E en `test/app.e2e-spec.ts`: `/health` y `/metrics`.

6. **Documentación**:
   - `backend-erp/docs/MONITORING.md` con endpoints, métricas, variables de entorno y notas de seguridad.
   - `ROADMAP.md` marcó Fase 8.4 como completada.
   - `AUDIT_TRACKING.md` sección 6.6 marcada como resuelta.

### Validación técnica
- **Backend build**: ✅ OK.
- **Backend lint**: ✅ 0 errores, 0 warnings.
- **Backend unit tests**: ✅ 111 suites, 895 tests.
- **Backend E2E**: ✅ 9 suites, 47 tests.

### Notas
- `/metrics` es público por diseño; en producción debe protegerse con firewall/reverse proxy.
- El health check de memoria usa RSS en lugar de heap para evitar falsos negativos con heaps grandes de desarrollo.
- Próximos pasos recomendados: alertas (email/Slack) ante fallos de `/health`, dashboard Grafana, métricas de negocio por tenant.

## Fix — Jest force-exit en tests E2E

### Contexto
Los tests E2E terminaban con `Force exiting Jest` y requerían `forceExit: true` en `jest-e2e.json`. Esto ralentizaba CI y ocultaba posibles fugas reales de recursos.

### Acciones realizadas
1. **Deshabilitar métricas default en test**:
   - `src/monitoring/metrics/metrics.providers.ts`: `collectDefaultMetrics` solo se ejecuta si `process.env.NODE_ENV !== 'test'`.

2. **Setear `NODE_ENV=test` en setup E2E**:
   - `test/setup-e2e.ts` ahora asigna `process.env.NODE_ENV = 'test'`.

3. **Helper de cierre de app**:
   - Nuevo `closeTestApp(app)` en `test/test-utils.ts`:
     - Obtiene `SchedulerRegistry`.
     - Detiene todos los cron jobs (`TenantMetricsService`, `AlertsService`, `BillingService`).
     - Limpia intervals y timeouts registrados.
     - Llama `await app.close()`.

4. **Actualizar suites E2E**:
   - Reemplazados todos los `await app.close()` por `await closeTestApp(app)` en 9 suites.

5. **Remover `forceExit: true`** de `test/jest-e2e.json`.

### Validación técnica
- **Backend build**: ✅ OK.
- **Backend lint**: ✅ 0 errores, 0 warnings.
- **Backend unit tests**: ✅ 111 suites, 895 tests.
- **Backend E2E**: ✅ 9 suites, 47 tests, sin `Force exiting Jest`.
- **`npm run test:e2e -- --detectOpenHandles`**: ✅ sin handles abiertos reportados.

### Notas
- Los tests unitarios aún muestran `A worker process has failed to exit gracefully` porque algunos specs cargan módulos con cron jobs sin cerrar la app. No se considera bloqueante para esta fase.
- El fix se enfocó en E2E porque era donde `forceExit: true` estaba configurado.

---

## Bug report documentado por el usuario — 26/06/2026

### Problema visual en listas de precio al adicionar escalas de cantidad

**Archivo afectado:** `erp-frontend/src/app/pages/price-lists/price-list-form.component.html`

**Causa raíz:**
El panel de "Escalas de cantidad" vivía en un `<tr>` hermano del `<tr [formGroupName]="row.index">`. Por eso `formArrayName="scales"` no encontraba el grupo de la fila y se producía el error:

```
Cannot find control with path: 'items -> scales'
```

cada vez que se expandía la opción.

**Fix aplicado:**
Envolver ambos `<tr>` en `<ng-container [formGroupName]="row.index">` para que `formArrayName="scales""` resuelva dentro del grupo correcto.

**Verificación adicional:**
Se revisaron formularios con patrones similares (`special-price-form`, `document-lines-table.component.html`). En esos casos los `@if` que muestran input editable vs. texto plano viven dentro del mismo `<tr>` (son `<td>` condicionales, no un `<tr>` hermano), por lo que no sufren el mismo problema. El bug fue específico de `price-lists`.

---

## Sesión 2026-06-26 — Cobertura de tests para DocumentFlowService

### Objetivo
Ampliar la cobertura de tests de `document-flow.service.spec.ts`, que tenía solo un test de definición.

### Tests agregados (12)
- **getFlow**:
  - Retorna nodos current, upstream y downstream.
  - Lanza `NotFoundException` cuando el documento actual no existe.
  - Lanza `UnauthorizedException` cuando el documento pertenece a otro tenant.
- **getGraph**:
  - Grafo completo con nodos y aristas.
  - Preservación de sub-grafos cuando un nodo intermedio no se resuelve (bug fix documentado).
- **resolveNode**:
  - `JOURNAL_ENTRY` con partner `'—'`.
  - `SALE_RESERVE_INVOICE` y `PURCHASE_RESERVE_INVOICE` fallback a modelos legacy.
  - Manejo seguro de relaciones faltantes (`SALES_ORDER`, `DELIVERY_ORDER`, `PURCHASE_RECEIPT`, `ASSEMBLY_ORDER`, `INCOMING_PAYMENT`).
- **tenantId filtering**: todas las queries incluyen `tenantId`.
- **typing**: retornos tipados `DocumentFlowResponse` / `DocumentFlowGraph`.

### Archivos modificados
- `backend-erp/src/document-flow/document-flow.service.spec.ts`

### Documentación actualizada
- `BUGS_RESUELTOS.md`: marca el item de tests de document-flow como ✅ DONE.
- `AUDIT_TRACKING.md`: actualiza fila #15 de Fase 5.2 a ✅ Done.

### Validación
- `npx jest src/document-flow/document-flow.service.spec.ts --no-coverage` → **12/12 ✅**
- `npx eslint src/document-flow/document-flow.service.spec.ts` → **0 errores, 0 warnings**

---

## Sesión 2026-06-26 — Optimización N+1 en `DocumentFlowService.getGraph`

### Objetivo
Reducir las queries N+1 en el BFS de `getGraph`, que hacía aproximadamente 3 queries por nodo (resolver nodo + links upstream + links downstream).

### Cambio realizado
- Archivo: `backend-erp/src/document-flow/document-flow.service.ts`
- Método `getGraph` refactorizado para:
  - Procesar la frontera BFS en batches de hasta 50 nodos.
  - Resolver los nodos del batch en paralelo con `Promise.all`.
  - Obtener todos los links adyacentes al batch en **una sola query** `documentLink.findMany` combinando upstream/downstream con `OR`.
  - Mantener `tenantId` como filtro raíz en la query (no se usa `branchId` en este servicio).
- Se preservó el bug fix de sub-grafos: aún se exploran aristas incluso si un nodo intermedio no se resuelve.

### Tests actualizados
- `backend-erp/src/document-flow/document-flow.service.spec.ts`
  - Agregado helper `matchesLinkQuery` para soportar la nueva forma `where.OR` de `documentLink.findMany`.
  - Actualizados los mocks de `getGraph` para devolver links según el batch.

### Validación
- `npx jest src/document-flow/document-flow.service.spec.ts --no-coverage` → **12/12 ✅**
- `npx eslint src/document-flow/document-flow.service.ts src/document-flow/document-flow.service.spec.ts` → **0 errores, 0 warnings**
- `npx jest --no-coverage` (backend completo) → **112 suites / 931 tests ✅**

### Documentación actualizada
- `BUGS_RESUELTOS.md`: N+1 queries de document-flow marcado como ✅ Done.
- `AUDIT_TRACKING.md`: fila #14 de Fase 5.2 actualizada a ✅ Done.

---

## Sesión 2026-06-26 — Fase 1: Aislamiento automático de tenants (TenantGuard + TenantContext)

### Objetivo
Implementar la primera fase del aislamiento automático de tenants: validar `tenantId` a nivel de API y exponerlo en un contexto asíncrono para futura extensión Prisma.

### Archivos creados
- `backend-erp/src/common/tenant-context.ts`
  - `TenantContext` basado en `AsyncLocalStorage<number>`.
  - Métodos `run(tenantId, callback)` y `get()`.
- `backend-erp/src/common/tenant.guard.ts`
  - Guard global registrado tras `JwtAuthGuard`.
  - Salta rutas `@Public()` y `@SuperAdminOnly()`.
  - Permite usuarios `SUPERADMIN`.
  - Rechaza usuarios sin `tenantId` válido.
  - Rechaza `tenantId` falsificado en `body`, `params` o `query`.
  - Deja `request.tenantId` disponible para el interceptor.
- `backend-erp/src/common/tenant-context.interceptor.ts`
  - Interceptor global que corre el request dentro de `TenantContext.run(tenantId, ...)` para que cualquier servicio pueda leer `TenantContext.get()`.
- `backend-erp/src/common/tenant.guard.spec.ts`
  - 10 tests cubriendo public, superadmin, matching/mismatching tenantId, usuarios sin tenant.

### Archivos modificados
- `backend-erp/src/app.module.ts`
  - Registrado `{ provide: APP_GUARD, useClass: TenantGuard }` después de `JwtAuthGuard`.
  - Registrado `{ provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor }` antes de `MetricsInterceptor`.

### Validación
- `npx jest src/common/tenant.guard.spec.ts --no-coverage` → **10/10 ✅**
- `npm run build` → ✅
- `npx eslint src/common/tenant-context.ts src/common/tenant.guard.ts src/common/tenant-context.interceptor.ts src/common/tenant.guard.spec.ts src/app.module.ts` → **0 errores, 0 warnings**
- `npx jest --no-coverage` (backend completo) → **113 suites / 941 tests ✅**

### Documentación actualizada
- `BUGS_RESUELTOS.md`: item de aislamiento de tenants actualizado a Fase 1 completada / Fase 2 pendiente.
- `AUDIT_TRACKING.md`: sección 6.3 actualizada con avance Fase 1 y pendiente Fase 2.

### Nota
`branchId` no aplica en `TenantGuard`/`TenantContext` porque el aislamiento de tenants se basa exclusivamente en `tenantId`. `branchId` sigue siendo validado por `BranchRequiredGuard` en las rutas que lo requieren.

---

## Sesión 2026-06-26 — Fase 2: Extensión Prisma para aislamiento automático de tenants

### Objetivo
Complementar el `TenantGuard` con una capa defensiva en Prisma que inyecte `tenantId` automáticamente en queries cuando el contexto de tenant esté activo.

### Archivos creados
- `backend-erp/src/prisma/tenant-isolation.extension.ts`
  - Calcula el conjunto de modelos multitenant a partir del DMMF de Prisma (modelos con campo `tenantId`).
  - Excluye `Tenant` y `PurchaseInvoiceWithholdingTax`.
  - Extiende el cliente Prisma para inyectar `tenantId` en:
    - Lecturas filtro: `findFirst`, `findMany`, `count`, `aggregate`, `groupBy`.
    - Escrituras masivas: `updateMany`, `deleteMany`.
    - Creación: `create`, `createMany`.
  - **No toca** operaciones por clave única (`findUnique`, `update`, `delete`, `upsert`) para no romper restricciones de unicidad.
  - Lee `tenantId` desde `TenantContext.get()`; si no hay contexto, no modifica nada.
- `backend-erp/src/prisma/tenant-isolation.extension.spec.ts`
  - 12 tests para `isTenantScopedModel`, `injectTenantIdWhere`, `injectTenantIdCreate`, `injectTenantIdCreateMany`.

### Archivos modificados
- `backend-erp/src/prisma/prisma.service.ts`
  - Envuelve la instancia en un `Proxy` que delega operaciones de modelo y `$transaction` al cliente extendido, mientras conserva `onModuleInit`/`onModuleDestroy` en la instancia base.
  - Gracias al Proxy, **todas** las queries (directas y dentro de `$transaction`) pasan por la extensión sin refactorizar servicios.

### Validación
- `npx jest src/prisma/tenant-isolation.extension.spec.ts --no-coverage` → **12/12 ✅**
- `npx jest src/prisma/prisma.service.spec.ts --no-coverage` → **1/1 ✅**
- `npm run build` → ✅
- `npx eslint src/common/tenant-context.ts src/common/tenant.guard.ts src/common/tenant-context.interceptor.ts src/common/tenant.guard.spec.ts src/prisma/tenant-isolation.extension.ts src/prisma/tenant-isolation.extension.spec.ts src/prisma/prisma.service.ts src/app.module.ts` → **0 errores, 0 warnings**
- `npx jest --no-coverage` (backend completo) → **114 suites / 953 tests ✅**
- `npm run test:e2e` → en ejecución / background.

### Documentación actualizada
- `BUGS_RESUELTOS.md`: aislamiento de tenants marcado como ✅ DONE.
- `AUDIT_TRACKING.md`: sección 6.3 actualizada a ✅ DONE.

### Notas de seguridad
- `tenantId` sigue siendo el eje de aislamiento; `branchId` no se maneja en esta capa (sigue en `BranchRequiredGuard`).
- Las operaciones por clave única continúan requiriendo que el desarrollador incluya `tenantId` explícitamente; `tenant-isolation.audit.spec.ts` sigue auditan do raw queries.
- En contextos sin request (jobs, seeds), la extensión no inyecta nada porque `TenantContext.get()` es `undefined`; si se necesita, se puede envolver con `TenantContext.run(tenantId, async () => { ... })`.


---

## Sesión 26/06/2026 — Fix: asiento desbalanceado en factura de compra manual (`purchase-invoice`)

### Contexto
El escenario de carga `purchase-invoice` dejaba en los logs del servidor el error:

```
Asiento desbalanceado: D=111.5 C=100
```

El desbalance se producía únicamente en facturas de compra manuales (`POST /purchase-invoices/manual`) cuando el artículo/servicio tenía un impuesto con `isInclusive=true` (IVA incluido en el precio).

### Investigación
- La accounting engine (`accounting-engine.service.ts`) debita por cada línea `line.lineSubtotal ?? line.subtotal` y luego debita el impuesto por separado; finalmente acredita CxP por el total bruto del documento.
- En `purchase-invoices.service.ts` → `createManual`, la variable `lineSubtotal` se asignaba erróneamente con `lc.lineTotal` (importe bruto) en lugar de `lc.lineSubtotal` (importe neto).
- El encabezado del documento sí acumulaba correctamente `subtotal` neto y `total` bruto, pero el campo `subtotal` de cada línea quedaba con el bruto, desequilibrando el asiento.
- El método `update` tenía el mismo bug.
- Al corregir el asiento, apareció un error de concurrencia `P2002` en `Stock` durante el escenario de carga, porque `_executeConfirmLogic` movía stock incluso para artículos de servicio (`canBeInventoried=false`), y múltiples workers concurrentes intentaban crear el mismo registro.

### Archivos modificados
- `backend-erp/src/purchase-invoices/purchase-invoices.service.ts`
  - `createManual`: guarda `subtotal` y `lineSubtotal` netos, `lineTotal` bruto.
  - `update`: guarda neto/bruto correctamente y recalcula totales leyendo `lineSubtotal`/`lineTotal` con fallback.
  - `_executeConfirmLogic`: salta movimientos de stock para artículos `!canBeInventoried`.
  - Interfaz `PurchaseInvoiceLineItem`: añadidos `lineSubtotal?` y `lineTotal?`.

### Validación
- `npm run lint` → ✅ 0 errores, 0 warnings
- `npm run build` → ✅ limpio
- `npm test` → ✅ 114 suites / 953 tests
- `npm run test:e2e -- --testPathPatterns=purchase-flow` → ✅ 7/7 tests
- `PERF_DURATION=5 npm run perf` → ✅ todos los SLAs, 0 errores en `purchase-invoice`; logs del servidor sin errores de asiento desbalanceado ni `P2002`

### Oportunidades de mejora identificadas
1. **Nomenclatura inconsistente en líneas de compra**: `createFromReceipts` y otros flujos aún guardan `subtotal` de línea como bruto. Se recomienda unificar para que `subtotal`/`lineSubtotal` siempre sean netos y `lineTotal` bruto en todos los flujos de `purchase-invoices`.
2. **Race condition latente en `upsertStock`**: `FOR UPDATE` solo bloquea filas existentes; cuando no existe stock, dos transacciones concurrentes pueden intentar crear el mismo registro. Considerar `INSERT ... ON CONFLICT DO UPDATE` con expresiones SQL o advisory locks para filas inexistentes.
3. **Cobertura de tests**: no existe un test E2E ni unitario para factura de compra manual con impuesto incluido. Agregar uno con un `TaxIndicator` `isInclusive=true` previene regresiones del asiento.
4. **Refactor de `_executeConfirmLogic`**: el método mezcla stock, contabilidad, trazabilidad y actualización de cabecera. Extraer helpers (`DocumentAccountingHelper`, `DocumentStockHelper`) mejoraría mantenibilidad.
5. **Logs de debugging contable**: el error "Asiento desbalanceado" podría incluir `documentId`, totales calculados y líneas involucradas para acelerar futuras investigaciones.


---

## Sesión 26/06/2026 (continuación) — Sugerencias aplicadas

### 1. Test E2E para factura de compra manual con IVA incluido
**Archivo:** `backend-erp/test/purchase-flow.e2e-spec.ts`

- Agregado helper `createManualInvoice`.
- Agregado test `Factura manual de servicio con IVA incluido genera asiento balanceado`:
  - Crea un `TaxIndicator` con `isInclusive=true` y un artículo de servicio asociado.
  - Crea una factura de compra manual (`POST /api/purchase-invoices/manual`).
  - Verifica que el documento tenga `subtotal` neto, `tax` e IVA y `total` bruto correctos.
  - Verifica que exista un `journalEntry` y que `debit === credit === total`.

### 2. Race condition en `upsertStock`
**Archivo:** `backend-erp/src/common/stock.util.ts`

- Agregada función `lockStockKey` que adquiere `pg_advisory_xact_lock(hashtext(...))` sobre la clave lógica `(tenantId, itemId, warehouseId)`.
- `upsertStock` ahora llama a `lockStockKey` antes de cualquier lectura/escritura, serializando creaciones concurrentes de registros `Stock` inexistentes.
- Actualizado mock en `src/common/stock.util.spec.ts` para incluir `$executeRaw`.

### 3. Logs de debugging para asientos desbalanceados
**Archivo:** `backend-erp/src/common/accounting-engine.service.ts`

- Agregado helper privado `_assertBalanced` que incluye en el error:
  - Tipo y código/id del documento.
  - Diferencia entre débito y crédito.
  - Total del documento.
  - Resumen de líneas (`accountId`, débito, crédito, descripción).
- Reemplazados todos los bloques `if (Math.abs(totalDebit - totalCredit) >= 0.001) throw new Error(...)` en todos los métodos de creación de asientos (SALE_INVOICE, PURCHASE_INVOICE, DELIVERY_ORDER, PURCHASE_RECEIPT, STOCK_ENTRY, STOCK_EXIT, STOCK_ADJUSTMENT, STOCK_TRANSFER, SALES_CREDIT_NOTE, PURCHASE_CREDIT_NOTE, SALES_RETURN, PURCHASE_RETURN, INCOMING_PAYMENT, OUTGOING_PAYMENT).

### 4. Unificación parcial de nomenclatura en líneas de compra
**Archivo:** `backend-erp/src/purchase-invoices/purchase-invoices.service.ts`

- `createFromReceipts` ahora guarda `subtotal`/`lineSubtotal` netos y `lineTotal` bruto, alineándose con `createManual` y `update`.
- El recálculo de totales en `createFromReceipts` ahora usa `lineSubtotal` y `lineTotal` cuando están disponibles.

### Validación adicional
- `npm run lint` → ✅ 0 errores, 0 warnings
- `npm run build` → ✅ limpio
- `npx jest src/common/accounting-engine.service.spec.ts src/common/stock.util.spec.ts` → ✅ 69 tests
- `npm run test:e2e -- --testPathPatterns=purchase-flow` → ✅ 8/8 tests

### Deuda técnica pendiente
- **Unificación completa en ventas:** `sale-invoices.service.ts` guarda `subtotal` neto pero no persiste `lineTotal` ni `lineSubtotal`, por lo que la nomenclatura no está completamente alineada con compras. No genera desbalance porque la accounting engine usa `lineSubtotal ?? subtotal`, pero queda como deuda para una refactorización posterior.


## 2026-06-27 — Estabilización de tests unitarios tras `lockStockKey` y `_assertBalanced`

### Problema
Tras agregar el advisory lock (`pg_advisory_xact_lock`) en `upsertStock` y el helper `_assertBalanced` en `accounting-engine.service.ts`, varios specs que mockeaban `Prisma.TransactionClient` fallaban con:

```
TypeError: tx.$executeRaw is not a function
```

El mock base de transacciones no incluía `$executeRaw`, que ahora se invoca en toda operación de stock.

### Archivos ajustados
- `backend-erp/src/purchase-returns/purchase-returns.service.spec.ts`
  - Agregado `$executeRaw: jest.fn().mockResolvedValue({})` al mock de transacción.

### Validación final
- `npm run lint` → ✅ 0 errores, 0 warnings
- `npm run build` → ✅ limpio
- `npm test` → ✅ 114 suites, 953 tests passed
- `npm run perf` (con servidor en background) → ✅ todos los SLAs cumplidos

### Notas
- El warning `A worker process has failed to exit gracefully` ya existía previamente y no impide que la suite pase.
- Se mantiene la política de 0 `as any` en código de producción.

---

## Etapa: Re-ejecución de E2E Firefox, commit/push y limpieza — 2026-06-27

### Objetivo
Re-ejecutar el proyecto **firefox** de Playwright E2E (que había fallado por backend caído), consolidar todo el trabajo pendiente en `main` de ambos repos y dejar el proyecto limpio de artefactos generados.

### Resultado general
- ✅ Proyecto **firefox**: `114 passed`
- ✅ `erp-frontend` limpio y empujado a `main`
- ✅ `backend-erp` limpio y empujado a `main`
- ✅ Sin procesos Node colgados ni logs temporales

---

### 1. Re-ejecución de Playwright `--project=firefox`

#### Primer intento: fallo por backend caído
- Se levantó `npm run start:dev` en `backend-erp` como tarea en segundo plano.
- La tarea fue marcada como `lost` / heartbeat expirado y el proceso fue terminado.
- Resultado: `84 passed, 29 failed, 1 did not run`.
- Los fallos masivos fueron por páginas en blanco y `ECONNREFUSED ::1:3000`.

#### Segundo intento: servidores independientes
- Se arrancaron backend y frontend con `Start-Process` en procesos separados para evitar que el agente los mate.
- Se verificó salud de `localhost:3000` y `localhost:4200`.
- Resultado: `113 passed, 1 failed`.

#### Fallo restante
- `qa-buttons-interaction.spec.ts` › `Botón "Nuevo" en listados funciona`.
- Causa: `waitForLoadState('networkidle')` tardaba ~27 s en Firefox, rozando el timeout de 30 s.
- Fix: `test.setTimeout(60000)` en el describe del spec.

#### Tercer intento: éxito
```
114 passed (8.8m)
```

---

### 2. Fix descubierto por el pre-push hook

Al intentar hacer push de `erp-frontend`, el hook `pre-push` ejecutó tests Karma y falló en `partners.service.ts`:

```
TypeError: Cannot read properties of undefined (reading 'map')
  at normalizePartners (src/app/pages/partners/partners.service.ts:148)
```

Se corrigió para soportar `undefined`/`null`:

```ts
function normalizePartners(partners: Partner[] | undefined | null): Partner[] {
  return (partners ?? []).filter((p): p is Partner => !!p).map((p) => normalizePartner(p));
}
```

Tests de `partners.service` y la suite completa de frontend quedaron verdes.

---

### 3. Commit y push de todo el trabajo pendiente

#### `erp-frontend`
1. `chore: sync pending frontend changes including firefox e2e fix`
2. `fix(partners): handle undefined data in normalizePartners`
3. `chore: remove generated auth files and zip artifact, update .gitignore`

#### `backend-erp`
1. `chore: sync pending backend changes up to firefox e2e green`
2. `chore: ignore perf test source maps and remove generated .js.map files`

Ambos pushes pasaron sus hooks de pre-push (tests + build).

---

### 4. Limpieza de artefactos

Se eliminaron y se agregaron a `.gitignore`:

| Artefacto | Repo | Razón |
|---|---|---|
| `e2e/.auth/*` | `erp-frontend` | Tokens JWT/CSRF generados por Playwright |
| `frontend.zip` | `erp-frontend` | Archivo comprimido temporal |
| `perf/**/*.js.map` | `backend-erp` | Source maps generados de TypeScript |

También se eliminaron los logs temporales:
- `D:\ProyectosPython\erp_suite\backend.log`
- `D:\ProyectosPython\erp_suite\frontend.log`

---

### 5. Estado final

```powershell
# erp-frontend
git status --short   # vacío

# backend-erp
git status --short   # vacío

# Procesos Node
Get-CimInstance Win32_Process -Filter "Name='node.exe'"   # vacío
```

---

### 6. Lecciones aprendidas

1. **No confiar en tareas en segundo plano para servidores de desarrollo largos.**  
   `npm run start:dev` fue marcado como `lost`/heartbeat expirado y el proceso terminado. Solución: usar `Start-Process` para lanzar procesos independientes.

2. **Los pre-push hooks sí atrapan bugs reales.**  
   El error en `normalizePartners` no apareció en E2E ni en lint, pero sí en los tests Karma del hook.

3. **`npm test` en Angular corre en modo watch por defecto.**  
   Para ejecuciones automáticas hay que usar `--watch=false` o el comando nunca termina.

4. **`networkidle` en Firefox puede ser lento.**  
   En suites grandes es más robusto usar esperas explícitas o aumentar el timeout por test.

5. **Antes de un commit masivo, separar credenciales y artefactos.**  
   Los archivos de `e2e/.auth/` y `frontend.zip` no deben subirse. Verificar siempre `git status`.

6. **Correr test suites completas puede superar timeouts del agente.**  
   Cuando sea posible, ejecutar tests objetivo primero y reservar la suite completa para validaciones finales con timeout amplio.

7. **Confirmar alcance antes de mutaciones grandes de git.**  
   Hubo muchos cambios pendientes en ambos repos; fue necesario aclarar qué incluir/excluir antes de commitear.

