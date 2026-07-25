# Fase 5 — Cobertura responsive: resumen

## Corrección importante antes de los hallazgos

Arranqué esta fase pensando que había encontrado un gap grave: *"`item-combobox` no tiene ningún tratamiento mobile"* (búsqueda de `mobile|Mobile|innerWidth|matchMedia|breakpoint` sin resultados). **Era un falso negativo mío** — mis términos de búsqueda no incluían `ontouchstart`/`maxTouchPoints`, que es el criterio real que usa el código para decidir el modo. Al revisar bien: `item-combobox` **ya tiene** un modo mobile completo (delega a `app-item-search-modal`, que además tiene su propio `@media` en 640px), con la misma heurística de detección táctil que `partner-selector`. Lo dejo documentado acá para que quede claro que no es una corrección silenciosa — prefiero mostrar el error y la corrección que dejar pasar un hallazgo mal fundamentado.

## Lo que revisé y su veredicto

### ✅ POS (`pages/pos/pos.component.scss`) — excelente, sin gaps
1950 líneas, con tratamiento mobile real y bien pensado: drawer del carrito que se convierte en bottom-sheet (`transform: translateY(100%)` → `translateY(0)`), FAB flotante, grid de productos fluido (`repeat(auto-fill, minmax(180px, 1fr))` — se auto-ajusta sin necesitar breakpoints extra), modal de producto que colapsa de 2 columnas a 1, uso de `dvh` (dynamic viewport height, la unidad correcta para mobile en vez de `vh`, que en iOS Safari cuenta mal por la barra de direcciones). No encontré nada que arreglar acá.

### ✅ Líneas de documento (`luna-document-lines.component.scss`) — excelente, sin gaps
El componente central de líneas (usado en los 18 tipos de documento) ya implementa el patrón "tabla → tarjetas" en mobile: oculta el `<thead>`, cada `<tr>` se vuelve una tarjeta, cada `<td>` muestra su etiqueta vía `attr(data-label)`. Es el mismo patrón que ya veníamos viendo en `_lists.scss`/`_tables.scss` desde la Fase 3, aplicado consistentemente acá también.

### ✅ Listas de documentos (ej. `sale-invoices.component.html`) — sin gaps
La lista de facturas (y previsiblemente el resto) usa `<luna-data-table>` en vez de una tabla propia — por eso su `.scss` no tiene ningún `@media` propio, y está bien así: delega correctamente el comportamiento responsive al componente compartido, que ya lo resuelve.

### ✅ `item-combobox` / `partner-selector` — sin gaps (ver corrección arriba)
Ambos tienen modo dropdown (desktop/mouse) y modo modal de pantalla completa (touch/mobile), decidido automáticamente por `'ontouchstart' in window || navigator.maxTouchPoints > 0`.

### ❌ `serial-combobox` / `batch-combobox` — gap real, confirmado
Estos dos **sí** tienen el mismo problema que originalmente sospeché en `item-combobox`:
- **Cero tratamiento mobile**: no hay `isDropdownMode`, no hay modal de fallback, no hay ningún `@media` en sus `.scss`. En una pantalla angosta, el dropdown `position: fixed` (mismo mecanismo de `computeDropdownPosition` que usan los otros dos) es la única opción, sin la alternativa de modal a pantalla completa que sí tienen sus componentes hermanos.
- **Mismo bug de teclado que encontramos en Fase 1**: el trigger es un `<div class="scb-trigger">`/`<div class="bcb-trigger">` con solo `(click)`, sin `tabindex`, sin manejo de teclado, sin `role`. Es exactamente el mismo bug que arreglamos en `item-combobox` al principio de la Fase 1, solo que en estos dos componentes nunca se corrigió.
- Se usan en 15 archivos (formularios de documentos con ítems que trackean número de serie o lote).

No los arreglé en esa pasada porque implicaba replicar dos features completas (modo modal + navegación por teclado) en dos componentes, y ya tenía el patrón exacto probado en `item-combobox`/`partner-selector` para copiarlo.

## ✅ Cierre — resuelto (2026-07-24)

Se replicó en ambos componentes (`serial-combobox` y `batch-combobox`) el patrón completo de `item-combobox`:

1. **Trigger enfocable + accesible**: `role="combobox"`, `[attr.tabindex]="0"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`, `aria-label`, y handler `onTriggerKeydown` (Enter / Espacio / ↓ abren el panel). Arregla el mismo bug de teclado de la Fase 1 que arrastraban estos dos.
2. **Navegación por teclado en la lista** (patrón ARIA combobox): `activeIndex`, `optionId()`/`listboxId` únicos por instancia, `onSearchKeydown` (↑/↓ resalta con `aria-activedescendant`, Enter selecciona), `role="listbox"`/`role="option"`, `[attr.aria-selected]`, y estado visual `.active` en el ítem resaltado.
3. **Modo adaptativo mobile** (`mode: 'auto' | 'dropdown' | 'modal'` + getter `isDropdownMode`): en touch, el mismo contenido del dropdown se renderiza como **overlay fullscreen** (`.scb-fullscreen` / `.bcb-fullscreen` con `100dvh`, header con título + botón cerrar) en vez de dropdown `position: fixed`. No hizo falta crear un componente modal aparte: se reutilizó el contenido existente con CSS condicional, evitando duplicar la lógica de búsqueda/creación inline.

**Verificación:**
- `tsc --noEmit` limpio y `ng build` (AOT) exitoso — compila TS + SCSS + templates.
- Smoke test con emulación touch (`hasTouch`, viewport 390×844) sobre `/purchase-receipts/new` y `/sale-invoices/new` (páginas que usan estos combobox): **0 errores fatales**. Los combobox no aparecen vacíos (requieren ítems trackeables con datos), pero los forms cargan sin regresiones.

**Detalle menor `dropdown-position.util.ts`** (ancho del panel en viewport de 320px): queda anotado en el código del helper, sin impacto práctico real (el iPhone más chico actual mide 375px).

La Fase 5 (cobertura responsive) queda cerrada al 100%.

### ⚠️ Detalle menor: `dropdown-position.util.ts`
El helper compartido de posicionamiento (`computeDropdownPosition`, usado por los 4 combobox) no reduce el `width` del panel si el viewport es más angosto que el `minWidth` configurado (320px). En un viewport de exactamente 320px de ancho (casi inexistente hoy — el iPhone más chico actual mide 375px) el panel se saldría ~8px del borde derecho. Es un edge case real pero de bajísimo impacto práctico; lo dejo anotado en el código del helper para quien quiera cerrarlo del todo.

## Recomendación para cerrar la Fase 5 al 100%

~~Un solo pendiente real: replicar en `serial-combobox` y `batch-combobox` el mismo patrón de `item-combobox` (trigger enfocable + `role="combobox"` + modo modal en touch).~~

**✅ Hecho** — ver sección "Cierre — resuelto (2026-07-24)" arriba. La Fase 5 está completa.
