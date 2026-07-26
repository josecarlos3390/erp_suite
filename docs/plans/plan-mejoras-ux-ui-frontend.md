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

### Objetivo
Agregar `[ariaLabel]="'Más acciones'"` (o un texto contextual, ej. `'Más acciones para {{ row.name }}'` si el patrón del componente lo permite) a cada trigger de menú de fila.

### Archivos a corregir (verificado: `grep 'action="moreHorizontal"'` sin `ariaLabel`, excluyendo `/pos/`)
```
src/app/pages/admin/admin.component.html
src/app/pages/asset-categories/asset-categories.component.html
src/app/pages/bank-reconciliation/bank-statements.component.html
src/app/pages/banks/bank-accounts.component.html
src/app/pages/banks/banks.component.html
src/app/pages/batches/batches.component.html
src/app/pages/branches/branches.component.html
src/app/pages/currencies/currencies.component.html
src/app/pages/delivery-orders/delivery-orders.component.html
src/app/pages/discount-groups/discount-groups.component.html
src/app/pages/document-drafts/document-drafts.component.html
src/app/pages/employees/employees.component.html
src/app/pages/exchange-rates/exchange-rates.component.html
src/app/pages/fiscal-years/fiscal-years.component.html
src/app/pages/fixed-assets/fixed-assets.component.html
src/app/pages/incoming-payments/incoming-payments.component.html
src/app/pages/item-barcodes/item-barcodes.component.html
src/app/pages/item-boms/item-boms-list.component.html
src/app/pages/item-groups/item-groups.component.html
src/app/pages/items/items.component.html
src/app/pages/journal-entries/journal-entries.component.html
src/app/pages/outgoing-payments/outgoing-payments.component.html
src/app/pages/partner-groups/partner-groups.component.html
src/app/pages/partners/partners.component.html
src/app/pages/payment-terms/payment-terms.component.html
src/app/pages/price-lists/price-lists.component.html
src/app/pages/projects/projects.component.html
src/app/pages/purchase-credit-notes/purchase-credit-notes.component.html
src/app/pages/purchase-debit-notes/purchase-debit-notes.component.html
src/app/pages/purchase-invoices/purchase-invoices.component.html
src/app/pages/purchase-orders/purchase-orders.component.html
src/app/pages/purchase-quotations/purchase-quotations.component.html
src/app/pages/purchase-receipts/purchase-receipts.component.html
src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices.component.html
src/app/pages/purchase-returns/purchase-returns.component.html
src/app/pages/sale-invoices/sale-invoices.component.html
src/app/pages/sale-reserve-invoices/sale-reserve-invoices.component.html
src/app/pages/sales-credit-notes/sales-credit-notes.component.html
src/app/pages/sales-debit-notes/sales-debit-notes.component.html
src/app/pages/sales-orders/sales-orders.component.html
src/app/pages/sales-quotations/sales-quotations.component.html
src/app/pages/sales-returns/sales-returns.component.html
src/app/pages/serial-numbers/serial-numbers.component.html
src/app/pages/special-prices/special-prices.component.html
src/app/pages/stock-adjustments/stock-adjustments.component.html
src/app/pages/stock-counts/stock-counts.component.html
src/app/pages/stock-entries/stock-entries.component.html
src/app/pages/stock-exits/stock-exits.component.html
src/app/pages/stock-transfers/stock-transfers.component.html
src/app/pages/tax-indicators/tax-indicators.component.html
src/app/pages/udf/udf-list.component.html
src/app/pages/uom-conversions/uom-conversions.component.html
src/app/pages/uoms/uoms.component.html
src/app/pages/users/users.component.html
src/app/pages/warehouses/warehouses.component.html
src/app/shared/document-more-actions-menu/document-more-actions-menu.component.html
```

### Nota de eficiencia
Dado el volumen (57 archivos, mismo patrón), lo más limpio es **no tocar cada archivo a mano**: si `luna-icon-button` con `action="moreHorizontal"` no trae `ariaLabel` propio, que el componente aplique un valor por defecto (`'Más acciones'`) cuando el input llega vacío. Eso resuelve el 98% de los casos con **un cambio en `luna-icon-button.component.ts`**, y deja los archivos individuales solo para los casos que quieran un label más específico. Evalúa esta opción antes de editar los 57 archivos uno por uno.

### Criterio de aceptación
- Un lector de pantalla (VoiceOver/NVDA) anuncia un texto significativo al enfocar cualquier botón `⋯` de fila.
- `axe-core` o Lighthouse Accessibility no reporta "Buttons must have discernible text" en ninguna página de listado (fuera de POS).

---

## Prioridad 2 — Accesibilidad: auditoría general de `aria-label`

### Contexto
Fuera del caso anterior, solo 9 archivos `.html` en todo el proyecto usan `aria-label` de forma explícita. No hay evidencia de gestión de foco en `luna-modal` (foco atrapado / devuelto al cerrar), ni de `role`/landmarks en el layout principal.

### Objetivo
1. Revisar `luna-modal`, `luna-select`, `luna-menu` y `luna-tabs`: confirmar que son operables 100% por teclado (Tab, Escape, flechas donde aplique) y que el foco se atrapa dentro del modal mientras está abierto y regresa al disparador al cerrarlo.
2. Revisar todos los `luna-icon-button` / `luna-action-icon` que no llevan texto visible (no solo `moreHorizontal`) y asegurar `ariaLabel`.
3. Agregar un skip-link ("Saltar al contenido principal") en `src/app/core/layout/layout.component.html`.

### Criterio de aceptación
- Se puede completar el flujo "abrir modal → llenar formulario → guardar → modal se cierra → foco vuelve al botón que lo abrió" sin usar el mouse, en al menos 3 formularios distintos (ej. `purchase-orders-form`, `partners`, `warehouses`).
- Lighthouse Accessibility score sube de forma medible (correr antes/después y adjuntar el delta en el PR).

---

## Prioridad 3 — Copy de "sin resultados" en listados restantes

### Contexto
Corrección respecto al análisis inicial: `luna-data-table` **ya trae un empty state por defecto** (`emptyTitle`, `emptyDescription`, `emptyActionLabel`), y **76 de 82 listados** ya lo personalizan con copy contextual. La cobertura es mucho mejor de lo que parecía a primera vista. Solo quedan 6 pantallas con tabla que se quedaron con el texto genérico ("Sin registros" / "No hay datos para mostrar").

### Objetivo
Definir un título + descripción (+ acción cuando aplique, ej. "Crear primero") contextual para cada una de estas pantallas, siguiendo el mismo patrón que ya usan las otras 76.

### Archivos a corregir
```
src/app/pages/assembly-orders/assembly-order-detail.component.html
src/app/pages/dashboard/dashboard.component.html
src/app/pages/items/item-detail.component.html
src/app/pages/partners/partner-detail.component.html
src/app/pages/purchase-requests/purchase-requests.component.html
src/app/pages/settings/dimensions-config.component.html
```
> Nota: `item-detail`, `partner-detail` y `dashboard` son vistas de detalle/resumen con tablas embebidas (no listados principales) — confirma con el equipo de producto si ahí el texto genérico es aceptable antes de invertir tiempo redactando copy específico. `purchase-requests` y `dimensions-config` sí son listados principales y deberían alinearse con el resto.

### Criterio de aceptación
- Las 6 pantallas quedan con `emptyTitle`/`emptyDescription` explícitos en el template, consistentes en tono con el resto de la app (mismo patrón de "Sin flanqueras aún: crea la primera" que ya usan, por ejemplo, `sales-orders.component.html` o `warehouses.component.html`).

---

## Prioridad 4 — Colores hardcodeados fuera de los tokens

### Contexto
El sistema de tokens (`src/styles/tokens/*`) es la fuente única de verdad de color, pero 30 archivos SCSS fuera de `/pos/` tienen valores hex sueltos. Esto rompe la garantía de que un cambio de tema (oscuro, white-label por tenant) se propague sin tocar código, que es justamente el problema que `TenantBrandingService` y `color-contrast.util.ts` ya resuelven en el resto del sistema.

### Objetivo
Reemplazar cada hex por la variable de token semántico equivalente más cercana (`var(--neutral-0)`, `var(--accent-600)`, etc.). Donde el color no tenga un token equivalente evidente, discutirlo antes de inventar uno nuevo — puede ser una señal de que falta un token, no de que el archivo está "mal".

### Archivos a auditar
```
src/app/core/layout/layout.component.scss
src/app/core/layout/sidebar/sidebar.component.scss
src/app/login/login.component.scss
src/app/pages/accounts/accounts.component.scss
src/app/pages/approvals/approvals.component.scss
src/app/pages/fiscal-years/fiscal-year-detail.component.scss
src/app/pages/item-price-histories/item-price-histories.component.scss
src/app/pages/journal-entries/journal-entries-form.component.scss
src/app/pages/profile/profile.component.scss
src/app/pages/purchase-invoices/purchase-invoices-form.component.scss
src/app/pages/sale-invoices/sale-invoices-form.component.scss
src/app/pages/sales-orders/sales-orders-form.component.scss
src/app/pages/stock-counts/stock-counts-form.component.scss
src/app/pages/transport-guides/transport-guides-form.component.scss
src/app/pages/udf/udf-list.component.scss
src/app/shared/advance-selector/advance-selector.component.scss
src/app/shared/batch-combobox/batch-combobox.component.scss
src/app/shared/batch-selector/batch-selector.component.scss
src/app/shared/batch-serial-assignment-modal/batch-serial-assignment-modal.component.scss
src/app/shared/branch-filter-select/branch-filter-select.component.scss
src/app/shared/document-action-bar/document-action-bar.component.scss
src/app/shared/document-line-tabs/document-line-tabs.component.scss
src/app/shared/item-combobox/item-combobox.component.scss
src/app/shared/item-search-mode-toggle/item-search-mode-toggle.component.scss
src/app/shared/luna/luna-dark-mode-switch/luna-dark-mode-switch.component.scss
src/app/shared/luna/luna-tooltip/luna-tooltip.component.scss
src/app/shared/partner-selector/partner-selector.component.scss
src/app/shared/payment-term-installments-preview/payment-term-installments-preview.component.scss
src/app/shared/sales-person-selector/sales-person-selector.component.scss
src/app/shared/serial-combobox/serial-combobox.component.scss
src/app/shared/serial-selector/serial-selector.component.scss
```
Prioriza dentro de esta lista los que se repiten en varios selectores similares (`batch-selector`, `batch-combobox`, `serial-selector`, `serial-combobox`, `advance-selector`) — probablemente comparten el mismo origen (copy-paste de un componente selector a otro) y se pueden corregir con el mismo patrón de reemplazo.

### Criterio de aceptación
- `grep -rn "#[0-9a-fA-F]\{3,6\}" src/app --include="*.scss" | grep -v "/pos/"` no devuelve resultados (o solo los que quedaron explícitamente justificados y documentados con un comentario).
- Cambiar `--accent-600` en `_01-primitives.scss` y verificar visualmente que estos componentes reflejan el cambio sin editar su SCSS.

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

### `!important` restantes (26, justificados)
- `sidebar.component.scss` (5): reset de estilos nativos del input de búsqueda (`border`, `background`, `border-radius`, `box-shadow`).
- `purchase-quotations-form.component.scss` (5): overrides `::ng-deep` de `.action-bar` en mobile.
- `sales-credit-notes-form.component.scss` (3): overrides `::ng-deep` de textos en triggers de selectores.
- `sales-quotations-form.component.scss` (2): overrides `::ng-deep` de botones en mobile.
- `tax-indicator-form.component.scss` (4): input con sufijo y estado de error (posibles de refactorizar a variantes Luna en el futuro).
- `incoming-payments-form.component.scss` (1): `text-align: right` en input vía `::ng-deep`.
- `stock-transfers-form.component.scss` (1): utilidad `.hidden`.
- `warehouses.component.scss` (1): utilidad `.hidden`.
- `shared/luna/luna-input/luna-input.component.scss` (2): autofill de WebKit (`-webkit-box-shadow`, `-webkit-text-fill-color`) — caso legítimo documentado.

### Criterio de aceptación
- El conteo de `!important` fuera de `/pos/` baja de 139 a un número documentado y justificado (idealmente cerca de 0).
- No hay regresión visual: correr el checklist ya existente en `docs/archive/FRENTE-3-PLAN-VALIDACION-VISUAL.md` como referencia de método, extendiéndolo a estos archivos.

---

## Prioridad 6 (opcional, más largo plazo) — Cobertura de tests de componentes

### Contexto
132 de 280 componentes (~47%) tienen `.spec.ts`. No es un problema de UX en sí, pero cualquier limpieza de estilos/accesibilidad de las prioridades 1–5 es más segura si el componente tocado tiene un test que la respalde.

### Objetivo
No proponemos llegar a 100% de cobertura como bloqueante. Sí: **cualquier componente que se modifique en las Prioridades 1–5 y no tenga `.spec.ts`, debe salir del PR con uno mínimo** (render sin errores + verificación del `ariaLabel` o `emptyTitle` agregado, según el caso).

### Criterio de aceptación
- Cada PR de las secciones anteriores incluye o actualiza el `.spec.ts` del componente tocado.

---

## Explícitamente fuera de este plan
- Todo lo relacionado a `src/app/pages/pos/**`, incluyendo su archivo `pos.component.scss` (1,951 líneas) — se aborda por separado.
- Migración responsive en curso (ver `docs/archive/FRENTE-3-PLAN-VALIDACION-VISUAL.md`) — ya tiene su propio plan activo, no se duplica aquí.
