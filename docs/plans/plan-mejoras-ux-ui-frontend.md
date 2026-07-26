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
- [ ] (Opcional) Unificar copy a `"Más acciones"` en ambos componentes.

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

### Estado actual 🔄 CASI COMPLETADO

Auditoría 2026-07-26:

```bash
grep -rn "#[0-9a-fA-F]\{3,6\}" src/app --include="*.scss" | grep -v "/pos/"
```

Resultado: **solo 2 ocurrencias** en 2 archivos:

| Archivo | Línea | Valor | Nota |
|---|---|---|---|
| `src/app/pages/accounts/accounts.component.scss` | 103 | `#ba68c8` | Tono específico para cuentas tipo `INCOME`; ya documentado con comentario |
| `src/app/pages/udf/udf-list.component.scss` | 115 | `#c084fc` | Tono específico para UDFs; requiere decidir si se agrega un token o se justifica |

### Objetivo restante
1. Decidir si `#ba68c8` y `#c084fc` merecen un token semántico nuevo (ej. `--semantic-income`, `--semantic-udf`) o se dejan justificados con comentario.
2. Si se crean tokens, reemplazar los hex y verificar visualmente.

### Criterio de aceptación
- [ ] Quedan 0 hex hardcodeados fuera de POS, **o** cada uno restante tiene un comentario que justifica por qué no usa token.
- [ ] Cambiar `--accent-600` en `_01-primitives.scss` no requiere editar ninguno de estos archivos para reflejar el cambio.

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
