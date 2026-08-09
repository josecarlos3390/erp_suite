# Plan de implementación — Recomendaciones UX/UI del frontend

**Alcance:** todo el proyecto Angular excepto `src/app/pages/pos/**` (POS queda explícitamente fuera de este plan).
**Ubicación:** documento consolidado en `docs/plans/` del monorepo. Las rutas de archivos dentro de este plan son relativas a `erp-frontend/`.
**Contexto:** el proyecto ya cuenta con un sistema de diseño maduro ("Luna": tokens en capas, librería de componentes, linters custom). Este plan **no propone rediseñar nada** — propone cerrar brechas de cobertura entre lo que el sistema ya permite hacer bien y lo que efectivamente se está usando en cada pantalla.

Cada sección es independiente y se puede asignar como una tarea separada (a una persona o a un agente de código). Incluye: contexto, objetivo, archivos afectados (verificados contra el código, no estimados) y criterio de aceptación.

---

## Cómo usar este documento

Si vas a pegar esto como prompt para un agente de código (Claude Code, Cursor, etc.), trabaja **una sección a la vez**, en el orden dado, y pide una revisión (`git diff` o PR) antes de pasar a la siguiente. No mezclar secciones en un mismo commit — son cambios de naturaleza distinta (accesibilidad vs. copy vs. limpieza de estilos) y conviene poder revertir cada uno de forma aislada.

---

## Prioridad 1 — Accesibilidad: menús de acciones sin `ariaLabel`

### Contexto
El botón de "más acciones" (`⋯`) que abre el menú contextual de cada fila (editar / ver / eliminar / etc.) es el control más usado de toda la aplicación — aparece en prácticamente cada listado. El componente `luna-icon-button` ya soporta la propiedad `ariaLabel`, pero **56 de 57 instancias** de `action="moreHorizontal"` fuera del POS no la están pasando. Hoy, un usuario de lector de pantalla que llega a ese botón en cualquier listado del sistema no escucha nada que le diga qué hace.

### Estado actual ✅ RESUELTO

El default ya está implementado en el design system:

- **`luna-icon-button.component.ts`**: `effectiveAriaLabel` devuelve `"Más acciones"` cuando `action === 'moreHorizontal'` y no se pasó `ariaLabel`.
- **`luna-button.component.ts`**: `[attr.aria-label]="ariaLabel || resolvedTitle || text"`, y `ACTION_TITLES['moreHorizontal'] = 'Más opciones'`.

Por lo tanto, **todas las 57 instancias** de `action="moreHorizontal"` fuera de POS ya son anunciadas por lectores de pantalla, sin necesidad de editar cada listado.

### Nota de mejora menor (no bloqueante)
Hay una inconsistencia de copy: `luna-icon-button` dice `"Más acciones"` y `luna-button` dice `"Más opciones"`. Para unificar, se puede:
- Cambiar `ACTION_TITLES['moreHorizontal']` a `"Más acciones"` en `luna-button.component.ts`, o
- Forzar siempre el uso de `luna-icon-button` para triggers de menú de fila.

### Criterio de aceptación
- [x] Un lector de pantalla (VoiceOver/NVDA) anuncia un texto significativo al enfocar cualquier botón `⋯` de fila.
- [x] Unificar copy a `"Más acciones"` en ambos componentes (`luna-icon-button` y `luna-button`).

---

## Prioridad 2 — Accesibilidad: auditoría general de `aria-label`

### Contexto
Fuera del caso anterior, solo 9 archivos `.html` en todo el proyecto usan `aria-label` de forma explícita. No hay evidencia de gestión de foco en `luna-modal` (foco atrapado / devuelto al cerrar), ni de `role`/landmarks en el layout principal.

### Estado actual ✅ RESUELTO / PARCIALMENTE MEJORADO

Auditoría 2026-07-26 contra el código: la mayoría de los componentes LUNA ya cumplen con los patrones de accesibilidad requeridos.

| Componente | Estado | Detalle |
|---|---|---|
| `luna-modal` | ✅ | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, foco inicial en el panel, trampa de foco (Tab/Shift+Tab), Escape para cerrar, devolución de foco al disparador al cerrar. |
| `luna-select` | ✅ | Usa `<select>` nativo; navegación por teclado y lectores de pantalla delegados al navegador. |
| `luna-menu` | ✅ Navegación / ⚠️ ARIA mejorado | Flechas ↑↓/Home/End entre ítems, Escape cierra, foco vuelve al trigger. Se agregaron `id` únicos, `aria-controls` en el wrapper y `aria-labelledby` en el dropdown. `luna-button` ahora expone `[ariaControls]`, por lo que triggers proyectados (ej. `document-more-actions-menu`, `document-copy-to-menu`) pueden enlazar directamente al menú. |
| `luna-tabs` | ✅ | `role="tablist"`, `role="tab"`, `aria-selected`, tabindex dinámico, navegación con flechas/Home/End. |
| `luna-icon-button` / `luna-action-icon` | ✅ | `luna-button` usa `aria-label="ariaLabel \|\| resolvedTitle \|\| text"`; para icon-only con `action` cae en `ACTION_TITLES`. `luna-icon-button` aplica default `"Más acciones"` para `moreHorizontal`. |
| Skip-link | ✅ | Ya existe `<a class="skip-link" href="#main-content">` y `<main id="main-content" tabindex="-1">` con estilos que lo muestran al recibir foco. |

### Mejoras aplicadas
- `luna-button.component.ts`: nuevo input `ariaControls` para triggers de menús/dropdowns.
- `luna-menu.component.ts`: IDs únicos para trigger y dropdown; `aria-controls` y `aria-labelledby`; comentario actualizado sobre el patrón recomendado.
- `document-more-actions-menu.component.html` y `document-copy-to-menu.component.html`: usan `[ariaControls]="menu.dropdownId"` junto con `ariaHasPopup="menu"` y `[ariaExpanded]="open"`.

### Pendiente (fuera del scope inmediato)
- Los ~60 listados que usan `<luna-menu>` con trigger inline todavía dependen del wrapper ARIA de `luna-menu`; migrarlos uno a uno a `[ariaHasPopup]/[ariaExpanded]/[ariaControls]` en el `<luna-button>` trigger es un refactor mecánico grande que no se hace en este paso.

### Criterio de aceptación
- [x] `luna-modal`, `luna-select`, `luna-menu` y `luna-tabs` son operables por teclado y anuncian roles/estados correctamente.
- [x] Skip-link implementado en el layout.
- [x] Botones de solo ícono tienen `aria-label` efectivo (via `action` title o `ariaLabel` explícito).
- [ ] Verificación manual del flujo "abrir modal → llenar formulario → guardar → cerrar → foco vuelve al disparador" en 3 formularios (recomendado hacerlo en entorno local antes de cerrar la fase).
- [ ] Medición Lighthouse Accessibility antes/después (delta en PR).

---

## Prioridad 3 — Copy de "sin resultados" en listados restantes

### Contexto
Corrección respecto al análisis inicial: `luna-data-table` **ya trae un empty state por defecto** (`emptyTitle`, `emptyDescription`, `emptyActionLabel`), y **76 de 82 listados** ya lo personalizan con copy contextual. La cobertura es mucho mejor de lo que parecía a primera vista. Solo quedan 6 pantallas con tabla que se quedaron con el texto genérico ("Sin registros" / "No hay datos para mostrar").

### Estado actual ✅ RESUELTO / NO APLICA

Revisión contra el código (2026-07-26): los 6 archivos ya tienen empty state contextual o no son listados principales:

| Archivo | Estado |
|---|---|
| `purchase-requests.component.html` | ✅ `emptyTitle="Sin solicitudes de compra"`, `emptyDescription`, `emptyActionLabel="Crear la primera"` |
| `dimensions-config.component.html` | ✅ Tablas de centros de costo y normas de reparto ya tienen `emptyTitle`/`emptyDescription` |
| `assembly-order-detail.component.html` | ✅ Página de detalle; tabs vacíos usan `<luna-empty-state>` con copy específico |
| `item-detail.component.html` | ✅ Página de detalle; usa `<luna-empty-state>` en stock, ensamblajes y kardex |
| `partner-detail.component.html` | ✅ Página de detalle; usa `<luna-empty-state>` en transacciones y documentos abiertos |
| `dashboard.component.html` | ✅ Widget de top artículos tiene `emptyTitle`/`emptyDescription` y fallback `widget-empty` |

No quedan listados principales con empty state genérico fuera de POS. La cobertura es efectivamente 100%.

### Criterio de aceptación
- [x] Todas las tablas de listados principales fuera de POS tienen `emptyTitle`/`emptyDescription` contextual.
- [x] Las páginas de detalle usan `<luna-empty-state>` o `emptyTitle`/`emptyDescription` en sus tablas embebidas.

---

## Prioridad 4 — Colores hardcodeados fuera de los tokens

### Contexto
El sistema de tokens (`src/styles/tokens/*`) es la fuente única de verdad de color. En el análisis inicial quedaban 30 archivos SCSS fuera de `/pos/` con valores hex sueltos, pero el trabajo previo de migración a tokens los redujo drásticamente.

### Estado actual ✅ RESUELTO

Auditoría 2026-07-26: solo quedaban 2 hex hardcodeados fuera de POS.

**Solución aplicada:**
1. Se agregó la escala completa `--purple-*` a `src/styles/tokens/_01-primitives.scss` (modo claro y oscuro).
2. Se agregaron tokens semánticos `--text-purple` y `--bg-purple-subtle` a `src/styles/tokens/_02-semantic.scss`.
3. Se reemplazaron los hex en:
   - `src/app/pages/accounts/accounts.component.scss` (`#ba68c8` → `var(--text-purple)`)
   - `src/app/pages/udf/udf-list.component.scss` (`#c084fc` → `var(--text-purple)`)

```bash
grep -rn "#[0-9a-fA-F]\{3,6\}" src/app --include="*.scss" | grep -v "/pos/"
```

Resultado: **0 coincidencias**.

### Criterio de aceptación
- [x] 0 hex hardcodeados fuera de POS.
- [x] Cambiar `--accent-600` en `_01-primitives.scss` no requiere editar estos archivos.
- [x] `npm run build` y `npm run lint` pasan sin errores.

---

## Prioridad 5 — Reducción de `!important`

### Contexto
139 usos de `!important` en 36 archivos (excluyendo POS) generalmente indican que un estilo de componente está peleando por especificidad contra Luna en lugar de extenderlo correctamente (por ejemplo, sobreescribiendo un estilo de `luna-input` desde el componente contenedor en lugar de exponer una variante o input en el propio componente Luna).

### Objetivo
Por cada archivo, identificar si el `!important`:
- (a) se puede eliminar subiendo la especificidad del selector correctamente, o
- (b) revela que falta una variante/prop en el componente Luna correspondiente (mejor arreglo: agregar esa variante al componente compartido), o
- (c) es un caso legítimo (ej. sobreescribir un estilo inyectado por una librería externa) — en ese caso, dejarlo pero con un comentario explicando por qué.

### Archivos a auditar (orden sugerido: primero los componentes `luna-*` compartidos, porque un fix ahí resuelve el problema en todos sus consumidores; luego los formularios)
```
src/app/shared/luna/luna-document-lines/luna-document-lines.component.scss
src/app/shared/luna/luna-entity-select/luna-entity-select.component.scss
src/app/shared/luna/luna-input/luna-input.component.scss
src/app/shared/batch-combobox/batch-combobox.component.scss
src/app/shared/serial-combobox/serial-combobox.component.scss
src/app/core/layout/sidebar/sidebar.component.scss
src/app/pages/delivery-orders/delivery-orders-form.component.scss
src/app/pages/employees/employee-form.component.scss
src/app/pages/incoming-payments/incoming-payments-form.component.scss
src/app/pages/items/item-detail.component.scss
src/app/pages/kardex/kardex.component.scss
src/app/pages/outgoing-payments/outgoing-payments-form.component.scss
src/app/pages/partners/partner-account-statement.component.scss
src/app/pages/partners/partner-detail.component.scss
src/app/pages/permissions/permissions.component.scss
src/app/pages/profile/profile.component.scss
src/app/pages/purchase-credit-notes/purchase-credit-notes-form.component.scss
src/app/pages/purchase-invoices/purchase-invoices-form.component.scss
src/app/pages/purchase-orders/purchase-orders-form.component.scss
src/app/pages/purchase-quotations/purchase-quotations-form.component.scss
src/app/pages/purchase-receipts/purchase-receipts-form.component.scss
src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.scss
src/app/pages/purchase-returns/purchase-returns-form.component.scss
src/app/pages/sale-invoices/sale-invoices-form.component.scss
src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.scss
src/app/pages/sales-credit-notes/sales-credit-notes-form.component.scss
src/app/pages/sales-orders/sales-orders-form.component.scss
src/app/pages/sales-quotations/sales-quotations-form.component.scss
src/app/pages/sales-returns/sales-returns-form.component.scss
src/app/pages/stock-adjustments/stock-adjustments-form.component.scss
src/app/pages/stock-entries/stock-entries-form.component.scss
src/app/pages/stock-exits/stock-exits-form.component.scss
src/app/pages/stock-transfers/stock-transfers-form.component.scss
src/app/pages/tax-indicators/tax-indicator-form.component.scss
src/app/pages/warehouses/warehouses.component.scss
```

### Progreso
- **Conteo inicial:** 139 `!important` en 36 archivos (excluyendo `/pos/`).
- **Lote 1 (commit `34fed38`):** 5 archivos (`luna-document-lines`, `luna-entity-select`, `luna-input` comentarios, `batch-combobox`, `serial-combobox`). Conteo: 139 → 114.
- **Lote 2a (commit `9b35977`):** 17 formularios de documentos — eliminados 66 `!important` de patrones `dt-text-*` y `action-bar-buttons`. Conteo: 114 → 48.
- **Lote 2b (commit `0bed496`):** 5 archivos (`profile`, `kardex`, `permissions`, `incoming-payments-form`, `outgoing-payments-form`) — eliminados 9 `!important` de media queries simples. Conteo: 48 → 39.
- **Lote 3 (commit `bcef9f7`):** `warehouses`, `item-detail`, `partner-account-statement`, `partner-detail`, `employee-form` — eliminados 13 `!important` usando mayor especificidad. Conteo: 39 → 26.
- **Auditoría 2026-07-26:** el conteo se mantiene en **26 `!important` en 10 archivos** fuera de POS, todos con justificación documentada abajo.
- **Auditoría 2026-07-26 (post-fix):** se eliminaron **5 `!important` adicionales** usando la API de Luna. Conteo: **20 `!important` en 7 archivos** fuera de POS.
  - `tax-indicator-form.component.scss` (4): el archivo era código muerto (selectores no usados en el template). Se eliminó el SCSS y su `styleUrls`.
  - `incoming-payments-form.component.scss` (1): se reemplazó `::ng-deep input { text-align: right !important; }` por la propiedad `textAlign="right"` de `<luna-input>`.

### `!important` restantes (20, justificados)
- `sidebar.component.scss` (5): reset de estilos nativos del input de búsqueda (`border`, `background`, `border-radius`, `box-shadow`).
- `purchase-quotations-form.component.scss` (6): overrides `::ng-deep` de `.action-bar` y botones en mobile.
- `sales-credit-notes-form.component.scss` (3): overrides `::ng-deep` de textos en triggers de selectores.
- `sales-quotations-form.component.scss` (2): overrides `::ng-deep` de botones en mobile.
- `stock-transfers-form.component.scss` (1): utilidad `.hidden`.
- `warehouses.component.scss` (1): utilidad `.hidden`.
- `shared/luna/luna-input/luna-input.component.scss` (2): autofill de WebKit (`-webkit-box-shadow`, `-webkit-text-fill-color`) — caso legítimo documentado.

### Criterio de aceptación
- [x] El conteo de `!important` fuera de `/pos/` baja de 139 a un número documentado y justificado.
- [x] Cada `!important` eliminado usa una alternativa de mayor especificidad o una variante/prop de Luna.
- [ ] Los `!important` restantes que requieran variantes nuevas en Luna (mobile wrap, triggers de selectores, sufijos de input) se abordan en refactor posteriores o quedan documentados como legítimos.
- [x] `npm run build` y `npm run lint` pasan sin errores.

---

## Prioridad 6 (opcional, más largo plazo) — Cobertura de tests de componentes

### Contexto
132 de 280 componentes (~47%) tienen `.spec.ts`. No es un problema de UX en sí, pero cualquier limpieza de estilos/accesibilidad de las prioridades 1–5 es más segura si el componente tocado tiene un test que la respalde.

### Objetivo
No proponemos llegar a 100% de cobertura como bloqueante. Sí: **cualquier componente que se modifique en las Prioridades 1–5 y no tenga `.spec.ts`, debe salir del PR con uno mínimo** (render sin errores + verificación del `ariaLabel` o `emptyTitle` agregado, según el caso).

### Criterio de aceptación
- Cada PR de las secciones anteriores incluye o actualiza el `.spec.ts` del componente tocado.

---

## Prioridad 7 — Confusiones críticas de UX (Bloque A, S17) ✅ RESUELTO (2026-08-09)

### Contexto
Auditoría de explicabilidad (2026-08-09) detectó 4 hallazgos 🔴 que pueden causar errores de datos o desorientar al usuario final. Todos resueltos:

| # | Hallazgo | Fix |
|---|----------|-----|
| 1 | **"Vendedor" pedía el ID numérico interno** (`luna-input type="number"` con placeholder "ID del vendedor...") en 7 formularios de ventas — el usuario no conoce su ID de BD y puede tipear cualquier número | Reemplazado por el selector canónico `app-sales-person-selector` (búsqueda por nombre) en `sale-invoices`, `sales-orders`, `delivery-orders`, `sale-reserve-invoices`, `sales-credit-notes`, `sales-returns`, `sales-quotations`. Control `salesPersonId` del FormGroup intacto (CVA compatible) — sin cambios de payload |
| 2 | **"Fecha" vs "F. Contab." sin explicación** en 21 formularios — el usuario no sabe que la fecha contable define el período del asiento | `helperText` (INLINE) o `hint` (wrapper `luna-form-field`) en los 21 forms: "Fecha del documento. La fecha contable define el período en que se registra el asiento." |
| 3 | **Búsqueda global mostraba estados en inglés crudo** ("OPEN"/"CLOSED") sin color semántico | `statusLabel()` (Abierta/Cerrada/Cancelada) + `typeLabel()` (Cliente/Proveedor) en `search.component`; badges con color por estado en `search.component.scss` |
| 4 | **Listado de facturas se contradice**: empty state decía "Se crean desde un pedido" pero el botón crea manual | `emptyDesc` ahora explica ambos flujos: "Puedes crearla manualmente con '+ Nueva Factura', o generarla desde un pedido de venta con 'Copiar a'." |

### Pendientes documentados (Bloques B y C, futuras pasadas)
- **B — Unificación visual**: color de estado OPEN contradictorio (verde en stock vs azul en ventas), labels/placeholders de `referenceNo`/`customerRef` en 3 variantes, botón "Crear" genérico en 5 maestros, toasts "creado correctamente" vs "creado", densidad de tabla en facturas/recepciones, capitalización y prefijo "+" en botones "Nuevo X", iconos residuales (emojis ✅/❌ en purchase-requests, "½" para PARTIAL, `fas fa-link`, ⚠), tildes ("Nuevo Articulo", "Sin articulos").
- **C — Explicabilidad**: "GRIR" sin traducir en 3 forms, "DPP" en tablas de cuotas, help-hints desiguales en listados de documentos, banners de campos readonly (Cliente en pago desde factura, Costo en tab Costos), placeholder "- Sin almacén -".

### Verificación
- `npm run build` + `npm run lint` 0/0 + suite completa 1,257 tests en verde.

---

## Explícitamente fuera de este plan
- Todo lo relacionado a `src/app/pages/pos/**`, incluyendo su archivo `pos.component.scss` (1,951 líneas) — se aborda por separado.
- Migración responsive en curso (ver `docs/archive/FRENTE-3-PLAN-VALIDACION-VISUAL.md`) — ya tiene su propio plan activo, no se duplica aquí.
