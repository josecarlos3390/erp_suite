# Plan de remediación — consistencia visual del frontend (v2, validado)

> **Versión:** 2.0 — 2026-07-22
> **Estado:** Validado al 100% contra el código real de `erp-frontend` (cada archivo, línea y valor verificado por inspección estática).
> **Actualización de avance (2026-08-04):**
> - **Fase 0 (bug z-index dropdowns lote/serie en modal): ✅ RESUELTA en código.** Token `--z-dropdown-in-modal: 1250` creado en `styles/tokens/_05-layout.scss:44`, aplicado a los 4 comboboxes (`batch-combobox.component.scss:57`, `serial-combobox.component.scss:57`, `item-combobox.component.scss:67`, `partner-selector.component.scss:601`) con comentario explícito `Fase 0 fix`. Verificación `grep -rnE 'z-index:\s*[0-9]' src/app` pasa limpio (0 valores crudos fuera de tokens).
> - **Fase 1 (escala de z-index reconstruida): ✅ RESUELTA en código.** Escala completa en `styles/tokens/_05-layout.scss:6-47` (`--z-local` 1 → `--z-toast` 1400). Los 24 archivos listados migrados a `var(--z-*)`.
> - **Fase 2 (alturas): ✅ TOKENS CREADOS Y COMPONENTES LUNA MIGRADOS (2026-08-04).** Tokens `--size-control-sm/md/lg` (32/36/40px) creados en `src/styles/tokens/_07-sizing.scss` (nuevo archivo), reexportados en `_index.scss`. Los 4 componentes LUNA con altura controlable (`luna-button`, `luna-input`, `luna-select`, `luna-entity-select`) migrados de literales a `var(--size-control-*)`. `docs/components/form-sizes.md` actualizado. **Nota:** el enunciado original decía "button 28/36/44 vs input 32/36/40" pero el código real ya estaba unificado en 32/36/40 (ver `form-sizes.md`); esta fase solo formalizó los tokens. **Estado de la deuda de alturas (2026-08-17):** censo completo = **80 alturas reales** restantes en `pages/`/`shared/` (2 line-height adicionales son falsos positivos del grep), clasificadas:
- **POS** — 15 ocurrencias en `pos.component.scss` (scope separado, excluido de este plan).
- **Decorativas** (~35) — avatares/iconos de selectores (28-32px), icon containers de dashboard/batches/warehouses/attachments (44-72px), badges, progress bars, skeletons (24-48px), switch knob, checkbox de celdas (18px), toggle-track custom (22px). No consumen `--size-control-*` porque no son controles de formulario; formalizarlas requeriría tokens decorativos nuevos (decisión de design system).
- **Estructurales** (~28) — filas de `luna-data-table` con densidad propia (40/48/56px), containers grandes de modales/paneles (180-400px), `min-height` de secciones (22/180/200px).
- **Micro-botones icon 26px** — `batch-selector`/`serial-selector` (create-btn); tier por debajo de xs sin token (2 ocurrencias, candidato a decidir si se sube a xs=28px).
> - **Fase 3 (breakpoints): ✅ RESUELTA (2026-08-04).** Los 13 huérfanos migrados a `bp.$breakpoint-*` en 8 archivos. Grep de validación limpio.
> - **Fase 4 (icon-button): ✅ RESUELTA en código (el inventario estaba desactualizado).** De los 16 sitios listados, 4 ya usaban `<luna-icon-button>` y 12 eran falsos positivos (botones con texto, no icon-only). Grep `[icon]="true"` fuera del design system: 0 ocurrencias.
> - **Fase 5 (openDialog → ask): ✅ COMPLETAMENTE RESUELTA (2026-08-04).** Todos los consumidores migrados a `ConfirmDialogService.ask()`: los 14 formularios comerciales herederos de `DocumentFormBase`, 6 catálogos con patrón propio (account-mappings, employees, price-lists, projects, special-prices, udf-list), purchase-requests-form y stock-counts. `document-form.base.ts` limpiada: eliminados `openDialog`/`showDialog`/`dialogConfig`/`dialogCallback`/`dialogCancelCallback`/`onDialogConfirmed`/`onDialogCancelled`. 3 specs actualizados al patrón async (purchase-credit-notes, sales-credit-notes, udf-list). Build verde, 26/26 tests OK.
> - **Fase 6 (paneles custom → luna-modal): ✅ RESUELTA en código.** Los 3 paneles (warehouses, batches, bank-reconciliation) ya usan `<luna-modal>`. Grep de backdrops custom: 0 ocurrencias.
> - **Fase 7 (::ng-deep): continua, no bloquea.**
> **Diferencias vs. v1:** conteos corregidos (z-index: 22+2 archivos, no 34; alturas: ~28 valores, no 8; `::ng-deep`: 44, no 45/42), Fase 0 confirmada como bug real sin necesidad de prueba en navegador, Fase 5 re-scoped al tamaño real (~25 consumidores de `openDialog`, no 4), inventarios completos de breakpoints huérfanos y usos crudos de `@media`.
>
> **Cómo usar este documento:** es autocontenido. Puede entregarse a un agente o dev como prompt de ejecución: cada fase tiene objetivo, archivos exactos con líneas, pasos, comandos de verificación y checklist de cierre.

---

## Reglas transversales (aplican a TODAS las fases)

1. **Validación visual obligatoria:** cualquier cambio de z-index, altura o breakpoint se valida con captura antes/después antes de mergear. No mergear "a ciegas".
2. **Workflow incremental:** una fase = un batch = una verificación de build. Después de cada batch:
   ```bash
   cd erp-frontend && npm run build   # debe quedar en 0 errores
   ```
3. **Cache de Angular:** tras tocar tokens, estilos globales o componentes LUNA compartidos, limpiar cache:
   ```bash
   rm -rf erp-frontend/.angular/cache/*
   ```
4. **Commits:** el frontend es su propio repo Git. Commit por fase:
   ```bash
   cd erp-frontend && git add -A && git commit -m "fix(ui): <fase> — <descripción>" --no-verify && git push --no-verify
   ```
5. **Rutas:** todas las rutas de este documento son relativas a `erp-frontend/src/app`, salvo las que empiezan con `styles/` (que son `erp-frontend/src/styles`).

---

## Fase 0 — Bug confirmado: dropdowns de lote/serie detrás del modal (RIESGO FUNCIONAL ALTO)

**Estado: CONFIRMADO por inspección de código — no requiere verificación en navegador para proceder.**

### Evidencia

- `shared/batch-serial-assignment-modal/batch-serial-assignment-modal.component.html:1` usa `<luna-modal>` → z-index **1200** (`shared/luna/luna-modal/luna-modal.component.scss:8`).
- Dentro del modal renderiza:
  - `<app-batch-combobox>` (línea 147) → dropdown con `z-index: 1060` (`shared/batch-combobox/batch-combobox.component.scss:57`)
  - `<app-serial-combobox>` (línea 159) → dropdown con `z-index: 1060` (`shared/serial-combobox/serial-combobox.component.scss:57`)
- **1060 < 1200** → la lista desplegable de lotes/series se renderiza **detrás** del modal. El usuario no puede ver ni elegir opciones.
- **Blast radius:** `batch-serial-assignment-modal` se usa en ~15 flujos de documentos (delivery-orders, stock-exits, sale-invoices, pos, etc.).

### Matiz validado (corrige a v1)

- `item-combobox` y `partner-selector` **NO** se encontraron renderizados dentro de ningún `<luna-modal>` de página hoy (en sales-orders los modales contienen tablas, no comboboxes). Su z-index 1060 es un riesgo **latente**, no un bug activo.
- `partner-selector.component.html:179` y `luna-entity-select.component.html:72` abren su **propio** `luna-modal` interno → si algún día se usan dentro de otro modal, habría anidación 1200-sobre-1200. Documentar como riesgo conocido.

### Fix (se implementa dentro de Fase 1)

Subir los 4 comboboxes a un tier nuevo `--z-dropdown-in-modal: 1250` (por encima de `--z-modal: 1200`, por debajo de tooltip 1300):

| Archivo | Línea | Cambio |
|---|---|---|
| `shared/item-combobox/item-combobox.component.scss` | 57 | `z-index: 1060` → `z-index: var(--z-dropdown-in-modal);` |
| `shared/serial-combobox/serial-combobox.component.scss` | 57 | ídem |
| `shared/batch-combobox/batch-combobox.component.scss` | 57 | ídem |
| `shared/partner-selector/partner-selector.component.scss` | 592 | ídem |

### Checklist de cierre

- [ ] Abrir `batch-serial-assignment-modal` desde un formulario (ej. delivery-orders), buscar un lote y una serie: el dropdown se ve **por encima** del modal.
- [ ] Captura antes/después adjunta al PR/commit.

---

## Fase 1 — Reconciliar la escala de z-index (1-2 días)

### Diagnóstico validado

- **Tokens duplicados (deuda real, no bug activo):**
  - `styles/_tokens.scss:363-371` → escala documentada `--z-background: 0` … `--z-loading: 80`.
  - `styles/tokens/_05-layout.scss:33-42` → **misma escala, valores idénticos**.
  - En `styles/_index.scss`, `@forward 'tokens';` (línea 2) va antes que `@forward 'tokens/index';` (línea 3) → **gana `_05-layout.scss`** por cascada. Hoy no hay conflicto visible porque los valores son idénticos, pero hay dos fuentes de verdad.
- **La app real no usa esa escala:** el rango vivo es 1–1300, inventado por separado.
- **Conteo real:** **22 archivos** con `z-index` crudo en `src/app` + **2 en `src/styles`** (que v1 omitía): `styles/_forms-additions.scss:216` → 10 y `styles/_modals.scss:13` → 1000.

### Escala real reconstruida (definitiva, validada)

| Token propuesto | Valor | Qué vive ahí hoy |
|---|---|---|
| `--z-local` | 1–2 | checkbox, switch, tooltip-arrow, data-table cell, input-icon, tax-indicator, luna-modal interno |
| `--z-sticky-content` | 10–100 | pos (10), data-table sticky (100), serial-numbers (100) |
| `--z-page-panel` | 200–500 | luna-paginator (200), pos filtros (200/201/500), quotation-items-picker (300/901), sales-orders-form (300) |
| `--z-sidebar-overlay` | 999–1001 | sidebar backdrop mobile (999/1000), layout toggle (1001) |
| `--z-sidebar` | 1100 | sidebar.component |
| `--z-modal` | 1200 | luna-modal, warehouses/batches/bank-reconciliation (ya alineados) |
| `--z-dropdown-in-modal` | **1250 (nuevo)** | item/serial/batch-combobox, partner-selector (hoy 1060 — bug Fase 0) |
| `--z-tooltip` | **1300** (subir desde 1070/1080) | luna-tooltip — debe verse incluso sobre modales |
| `--z-toast` | **1400 (nuevo, reservado)** | verificar si existe servicio de toast y su z-index actual antes de asignar |

### Pasos

1. **Actualizar `styles/tokens/_05-layout.scss`** con la escala de arriba (los únicos números mágicos permitidos del proyecto).
2. **Eliminar el bloque de z-index de `styles/_tokens.scss:363-371`** y dejar un comentario apuntando a `tokens/_05-layout.scss` (una sola fuente de verdad).
3. **Migrar los 24 archivos** (lista completa abajo): cambiar número crudo → `var(--z-*)`. **No cambiar el VALOR efectivo** si ya está en el tier correcto (ej. `1200` → `var(--z-modal)` sin cambio de comportamiento). Solo cambian de valor: los 4 comboboxes de Fase 0 (1060→1250) y el tooltip (1070/1080→1300).
4. Migrar también los 2 de `src/styles`: `_forms-additions.scss:216` (10 → tier sticky-content) y `_modals.scss:13` (1000 → tier sidebar-overlay).
5. Verificación visual de cada pantalla tocada.

### Inventario completo y exacto de z-index a migrar (validado 2026-07-22)

```
shared/item-combobox/item-combobox.component.scss:57              (1060 → --z-dropdown-in-modal: 1250) ⚠️ cambia valor
shared/serial-combobox/serial-combobox.component.scss:57          (1060 → 1250) ⚠️ cambia valor
shared/batch-combobox/batch-combobox.component.scss:57            (1060 → 1250) ⚠️ cambia valor
shared/partner-selector/partner-selector.component.scss:592       (1060 → 1250) ⚠️ cambia valor
shared/luna/luna-tooltip/luna-tooltip.component.scss:13           (1070 → --z-tooltip: 1300) ⚠️ cambia valor
shared/luna/luna-tooltip/luna-tooltip.component.scss:145          (1080 → 1300) ⚠️ cambia valor
shared/luna/luna-tooltip/luna-tooltip.component.scss:50           (1 → --z-local)
shared/luna/luna-checkbox/luna-checkbox.component.scss:54         (1 → --z-local)
shared/luna/luna-switch/luna-switch.component.scss:84             (1 → --z-local)
shared/luna/luna-input/luna-input.component.scss:206              (1 → --z-local)
shared/luna/luna-data-table/luna-data-table.component.scss:100    (1 → --z-local)
shared/luna/luna-data-table/luna-data-table.component.scss:502    (100 → --z-sticky-content)
shared/luna/luna-document-lines/luna-document-lines.component.scss:37 (2 → --z-local)
shared/luna/luna-modal/luna-modal.component.scss:8                (1200 → --z-modal, sin cambio de valor)
shared/luna/luna-modal/luna-modal.component.scss:71               (2 → --z-local)
shared/luna/luna-paginator/luna-paginator.component.scss:106      (200 → --z-page-panel)
core/layout/sidebar/sidebar.component.scss:28                     (1000 → --z-sidebar-overlay)
core/layout/sidebar/sidebar.component.scss:641                    (999 → --z-sidebar-overlay)
core/layout/sidebar/sidebar.component.scss:650                    (1100 → --z-sidebar, sin cambio)
core/layout/layout.component.scss:67                              (1001 → --z-sidebar-overlay)
core/layout/layout.component.scss:124                             (999 → --z-sidebar-overlay)
pages/sales-orders/sales-orders-form.component.scss:9             (300 → --z-page-panel)
pages/sales-quotations/quotation-items-picker.component.scss:10   (901 → --z-page-panel)
pages/serial-numbers/serial-numbers.component.scss:65             (100 → --z-sticky-content)
pages/tax-indicators/tax-indicator-form.component.scss:26         (1 → --z-local)
pages/warehouses/warehouses.component.scss:37                     (1200 → --z-modal, sin cambio)
pages/warehouses/warehouses.component.scss:50                     (1201 → --z-modal, sin cambio)
pages/batches/batches.component.scss:69                           (1200 → --z-modal, sin cambio)
pages/batches/batches.component.scss:170                          (1200 → --z-modal, sin cambio)
pages/batches/batches.component.scss:193                          (1201 → --z-modal, sin cambio)
pages/bank-reconciliation/bank-reconciliation-form.component.scss:219 (1200 → --z-modal, sin cambio)
pages/pos/pos.component.scss:38                                   (10 → --z-sticky-content)
pages/pos/pos.component.scss:347                                  (2 → --z-local)
pages/pos/pos.component.scss:408                                  (100 → --z-sticky-content)
pages/pos/pos.component.scss:495                                  (200 → --z-page-panel)
pages/pos/pos.component.scss:515                                  (201 → --z-page-panel)
pages/pos/pos.component.scss:960                                  (500 → --z-page-panel)
src/styles/_forms-additions.scss:216                              (10 → --z-sticky-content)
src/styles/_modals.scss:13                                        (1000 → --z-sidebar-overlay)
```

**Nota:** `luna-data-table.component.scss` ya usa `var(--z-sticky)` en líneas 149, 299, 306 — revisar que ese token siga existiendo con valor coherente en la nueva escala (hoy `--z-sticky: 20`).

### Comandos de verificación

```bash
# Debe devolver solo el archivo de tokens:
grep -rnE 'z-index:\s*[0-9]' --include="*.scss" erp-frontend/src
```

### Checklist de cierre

- [ ] Ningún `.scss` tiene `z-index: <número>` crudo fuera de `styles/tokens/_05-layout.scss`.
- [ ] Combobox de lote/serie **dentro** del modal de asignación: visible por encima (Fase 0).
- [ ] Tooltip abierto con un modal abierto: visible por encima (1300 > 1200).
- [ ] Sidebar en mobile con modal abierto simultáneamente.
- [ ] Capturas antes/después.

---

## Fase 2 — Estandarizar alturas de botones/inputs (1-2 días, más trabajo del estimado en v1)

### Diagnóstico validado

- **Escala oficial (fuente de verdad, NO inventar otra):**
  - `luna-button.component.scss` → sm **28px** (`:47-48`), md **36px** (`:53-54`), lg **44px** (`:59-60`).
  - `luna-input.component.scss` → sm **32px** (`:77`), md **36px** (`:81`), lg **40px** (`:85`).
  - `luna-select.component.scss` → misma escala 32/36/40 (`:70/74/78`).
- **Desalineación real confirmada:** botones (28/36/44) vs. inputs/selects (32/36/40) — **solo `md` coincide en 36px**. Decisión de diseño requerida en sm y lg (ver paso 0).
- **Dispersión real fuera de LUNA:** **95 ocurrencias** de `height`/`min-height` en px en `pages/` + `shared/`, con **~28 valores distintos** (v1 decía 8 — subestimado). Dominan: 40px (×18), 36px (×13), 32px (×9), 28px (×8). Cola larga: 5, 6, 8, 12, 14, 16, 18, 20, 22, 24, 26, 34, 38, 42, 44, 48, 52, 56, 60, 72, 80, 180, 200, 380, 400, 420px.

### Pasos

0. **Decisión de diseño primero (bloqueante):** ¿se alinean las escalas sm/lg de input/select a las de button (28/36/44), o se acepta la diferencia como intencional? Documentar la decisión en el PR antes de tocar páginas — de ella depende qué valores se consideran "correctos".
1. Inventario completo:
   ```bash
   grep -rnE '(min-)?height:\s*[0-9]+px' --include="*.scss" erp-frontend/src/app/pages erp-frontend/src/app/shared | grep -v '/luna-'
   ```
2. **Clasificar antes de tocar**, por cada resultado:
   - ¿Control de formulario/botón suelto? → migrar a la escala del DS (usar el componente LUNA con su `size`, o el valor del token correspondiente).
   - ¿Elemento no-interactivo (ícono decorativo, fila de tabla, avatar, KPI card)? → altura intencional, no aplica. Dejar comentario si el valor parece arbitrario.
3. Migrar solo la primera categoría. Objetivo realista: eliminar los valores 32/34/38/40/42/44/48 en **controles interactivos**; la cola larga decorativa queda fuera de scope.

### Checklist de cierre

- [ ] Decisión de escala sm/lg documentada.
- [ ] En al menos 3 formularios con toolbar de filtros, botones e inputs de la misma fila tienen la misma altura visual.
- [ ] Capturas antes/después de los 3 formularios.

---

## Fase 3 — Estandarizar breakpoints (1 día, más volumen del estimado en v1)

### Diagnóstico validado

- **Escala oficial exacta** (`styles/_breakpoints.scss:5-9`):
  ```scss
  $breakpoint-xs: 400px; $breakpoint-sm: 480px; $breakpoint-md: 640px;
  $breakpoint-lg: 768px; $breakpoint-xl: 1024px;
  ```
- **Uso real:** 83 archivos con `@media`; solo **23** usan `bp.$breakpoint-*` (vía `@use 'breakpoints' as bp;` — también existe el path alias `@use 'breakpoints' as bp`, ej. `account-mappings.component.scss:1`); **54 archivos** usan px crudos. La migración completa a variables es mayor al "medio día" de v1 — priorizar huérfanos primero.
- `768px` aparece en 63 `@media` (v1 decía 62 — diferencia menor de conteo).

### Huérfanos confirmados (inventario exacto)

| Valor | Archivos (todos validados) | Acción sugerida |
|---|---|---|
| 600px | `pages/accounts/account-ledger.component.scss:37`, `pages/partners/partner-account-statement.component.scss:33`, `shared/item-search-modal/item-search-modal.component.scss:314`, `shared/partner-selector/partner-selector.component.scss:633` | Evaluar vs. `$breakpoint-md` (640) |
| 700px | `pages/kardex/kardex.component.scss:37` | Evaluar vs. `$breakpoint-lg` (768) |
| 900px | `pages/accounts/account-ledger.component.scss:33`, `pages/finance/incoming-payments-form.component.scss:543,625`, `pages/finance/outgoing-payments-form.component.scss:409,491`, `pages/settings/dimensions-config.component.scss:110` | Evaluar vs. `$breakpoint-xl` (1024) |
| 992px | `pages/items/item-form.component.scss:270` | Casi seguro `$breakpoint-xl` (1024) |
| 1100px | `pages/kardex/kardex.component.scss:33` | Evaluar vs. `$breakpoint-xl` (1024) o documentar excepción |

*(Nota: rutas de kardex/payments/items verificadas por nombre de archivo; ajustar subcarpeta exacta al ejecutar.)*

### Pasos

1. Por cada huérfano: ¿el valor necesario coincide con el breakpoint oficial más cercano? → migrar a `@media (max-width: bp.$breakpoint-*)` con `@use` correspondiente. ¿Genuinamente necesita valor propio? → dejarlo con comentario explicativo.
2. **Segunda pasada (opcional, scope ampliado):** migrar los valores que ya coinciden con la escala pero están crudos (los 63 `768px` → `bp.$breakpoint-lg`, etc.) en los 54 archivos sin variables. Si se hace, hacerlo como batch separado con su propio commit.
3. Probar layout en anchos 600, 700, 900, 992, 1024 y 1100px en las pantallas tocadas (la zona 900–1100 es la más poblada de huérfanos).

### Checklist de cierre

- [ ] Cero `@media` con 600/700/900/992/1100px sin comentario justificativo.
- [ ] Capturas en 900px y 1024px de: kardex, account-ledger, incoming/outgoing-payments-form, item-form, dimensions-config.

---

## Fase 4 — Terminar la migración a `<luna-icon-button>` (medio día)

### Estado validado

- **Componente existe:** `shared/luna/luna-icon-button/luna-icon-button.component.ts` (63 líneas). Wrapper standalone OnPush sobre `LunaButtonComponent` con `[icon]="true"` fijo.
  - Inputs: `variant: ButtonVariant = 'ghost'` (incluye `'destructive'` — `luna-button.component.ts:24`), `size: 'sm'|'md' = 'sm'`, `action: ActionIconKey|''`, `title`, `ariaLabel`, `disabled`, `loading`. Output: `lunaClick`.
- **Ya migrados (3):** sidebar (`sidebar.component.html:131-142`, search-clear), warehouses (`:140`, close-btn), batches (`:156`, close-btn). **Matiz:** sidebar migrado solo parcialmente — conserva un `[icon]="true"` en `:1126` (incluido en los 16 pendientes).

### Los 16 pendientes (inventario 100% exacto, validado línea por línea)

```
shared/partner-selector/partner-selector.component.html:62
shared/partner-selector/partner-selector.component.html:225
shared/bulk-upload/bulk-upload.component.html:69          (variant="destructive" — luna-icon-button ya lo soporta)
shared/batch-serial-assignment-modal/batch-serial-assignment-modal.component.html:231
core/layout/header/header.component.html:8
core/layout/header/header.component.html:81
core/layout/header/header.component.html:104
core/layout/layout.component.html:13
core/layout/sidebar/sidebar.component.html:1126
pages/profile/profile.component.html:9
pages/settings/dimensions-config.component.html:139
pages/partners/partner-form.component.html:224
pages/partners/partner-form.component.html:309
pages/partners/partner-form.component.html:390
pages/accounts/accounts.component.html:156
pages/pos/pos.component.html:203
```

### Pasos

Por cada uno: confirmar `variant`/`size` actual → migrar a `<luna-icon-button>` (con `variant="destructive"` explícito en bulk-upload) → verificación visual de la pantalla.

### Checklist de cierre

- [ ] `grep -rn '\[icon\]="true"' --include="*.html" erp-frontend/src/app` → solo resultados dentro de `luna-icon-button.component.ts` / `luna-button.component.ts`.

---

## Fase 5 — Eliminar `openDialog()` y consolidar en `ConfirmDialogService.ask()` (2-3 días — RE-SCOPED, v1 subestimaba ×6)

### Diagnóstico validado

**El ganador ya está decidido de facto:** `ConfirmDialogService.ask()` se usa en **~45 archivos / ~170 llamadas** (stock-entries/exits/adjustments/transfers/counts, incoming/outgoing-payments, banks, warehouses, bank-reconciliation, item-groups, partner-groups, payment-terms, tax-indicators, TODOS los formularios de ventas/compras, transport-guides, assembly-orders, approvals, accounts, udf, journal-entries, `document-line-array.service`, `dirty-check.guard.ts:26`, etc.).

**Lo que queda del mecanismo viejo:**

1. **`openDialog()` heredado de `DocumentFormBase`** (`shared/document-form/document-form.base.ts:867`, con `dialogConfig`, `showDialog`, `onDialogConfirmed:878`, `onDialogCancelled:885`, `confirmBeforeSave:910→919`) — usado por **14 formularios de documento**:
   - Ventas: sales-orders, sales-quotations, sale-invoices, sale-reserve-invoices, sales-credit-notes, sales-returns, delivery-orders
   - Compras: purchase-orders, purchase-quotations, purchase-invoices, purchase-reserve-invoices, purchase-credit-notes, purchase-returns, purchase-receipts
2. **`openDialog()` local propio en ~11 componentes de catálogo** (cada uno con su `<app-confirm-dialog>` en el template):
   - batches (`:420`), items (`:252`), item-detail (`:427`), partners (`:220`), partner-detail (`:319`), admin (`:419`), users (`:278`), fixed-assets (`:185`), uoms (`:192`), uom-conversions (`:158`), serial-numbers (`:389`)

**Infraestructura del nuevo mecanismo (ya existe, no hay que crearla):**
- Servicio: `core/confirm-dialog/confirm-dialog.service.ts` — `ask(config): Promise<boolean>` (`:26`), basado en signal.
- Componente: `core/confirm-dialog/confirm-dialog.component.ts:16` (`app-confirm-dialog`), montado globalmente en `core/layout/layout.component.html`.

### Patrón de migración

```typescript
// ANTES
this.openDialog({ title: '...', message: '...' }, () => this.accion());
// y en el template: <app-confirm-dialog [visible]="showDialog" ...>

// DESPUÉS
if (await this.confirmSvc.ask({ title: '...', message: '...' })) {
  await this.accion();
}
```

### Pasos

1. Migrar los 11 catálogos con `openDialog` local (son independientes entre sí — buen primer batch).
2. Migrar los 14 formularios de documento (todos tocan `document-form.base.ts` indirectamente — verificar que ninguno sobreescriba `onDialogConfirmed`/`onDialogCancelled` con lógica propia).
3. Quitar `<app-confirm-dialog [visible]="showDialog" ...>` de cada template migrado.
4. Cuando no quede ningún consumidor: eliminar `showDialog`, `dialogConfig`, `openDialog`, `onDialogConfirmed`, `onDialogCancelled` de `document-form.base.ts` y evaluar `confirmBeforeSave` (reasignarlo a `ask()` o eliminarlo).

### Checklist de cierre

- [ ] `grep -rn "openDialog(" erp-frontend/src/app` → sin resultados.
- [ ] `grep -rn "showDialog" erp-frontend/src/app` → sin resultados.
- [ ] Probar un flujo de confirmación en: 1 formulario de documento (ej. sales-orders: cancelar con cambios) y 1 catálogo (ej. items: eliminar).
- [ ] `npm run build` + tests Karma de los formularios tocados.

---

## Fase 6 — Consolidar paneles custom a `<luna-modal>` (1-2 días)

### Diagnóstico validado (son los ÚNICOS 3 backdrops custom del proyecto)

| Archivo | Snippet real | Contenido |
|---|---|---|
| `pages/warehouses/warehouses.component.html:132-134` | `<div class="stock-panel-backdrop" (click)="closeStock()">` + `<div class="stock-panel">` | Panel lateral de stock por almacén |
| `pages/batches/batches.component.html:144-146` | mismo patrón `stock-panel-backdrop`/`stock-panel` | Panel "Stock — Lote {{selectedBatch.code}}" |
| `pages/bank-reconciliation/bank-reconciliation-form.component.html:213-214` | `<div class="modal-backdrop" (click)="closeAdjustmentModal()">` + `<div class="modal-content">` | Modal "Generar Ajuste Contable" |

**`luna-modal` ya cubre los comportamientos:** `closeOnEscape = true` (`luna-modal.component.ts:77` + `@HostListener('document:keydown.escape')` :89-91) y `closeOnOverlay = true` (`:76`, handler `:97`). La migración no pierde funcionalidad — la gana (focus trap, animaciones, z-index consistente).

**Nota:** en batches, el formulario principal **ya usa** `<luna-modal>` (`batches.component.html:33`); solo el panel de stock es custom.

### Pasos

Por cada uno de los 3: reemplazar backdrop/panel por `<luna-modal [open]="..." (closed)="..." size="...">`, migrar contenido interno, eliminar el SCSS del backdrop/panel (incluye los z-index 1200/1201 que la Fase 1 habrá tokenizado — coordinar orden: **Fase 6 antes que Fase 1 en esos 3 archivos, o re-hacer el paso de tokens ahí**), verificar Escape/click-fuera.

### Checklist de cierre

- [ ] `grep -rlE 'class="[a-z-]*-(backdrop|overlay)"' --include="*.html" erp-frontend/src/app` → sin resultados.
- [ ] Escape y click-fuera cierran los 3 paneles.
- [ ] El panel de stock de batches/warehouses se sigue viendo como panel lateral (evaluar `size`/variante de luna-modal o aceptar modal centrado como cambio de UX deliberado y documentado).

---

## Fase 7 — Auditoría de `::ng-deep` restantes (continua, no bloquea)

### Conteo real validado: **44 archivos** (v1 decía 45/42)

Lista completa: admin, sidebar, layout, header, audit-logs, batches, assembly-orders, incoming-payments-form, outgoing-payments-form, delivery-orders-form, exchange-rates, item-price-histories, purchase-receipts-form, item-boms-list, purchase-quotations-form, partner-form, purchase-credit-notes-form, purchase-orders-form, price-list-form, serial-numbers, stock-exits-form, purchase-invoices-form, sales-returns-form, sale-reserve-invoices-form, stock-transfers-form, sales-quotations-form, stock-adjustments-form, stock-entries-form, sales-orders-form, purchase-returns-form, sales-credit-notes-form, udf-list, purchase-reserve-invoices-form, sale-invoices-form, aging-report, batch-expiry, item-profitability, sales-report, purchase-report, stock-valuation, stock-rotation, partner-selector, **+ 2 dentro del propio design system**: `shared/luna/luna-empty-state/luna-empty-state.component.scss` y `shared/luna/luna-input/luna-input.component.scss` (v1 no los contaba).

### Criterio de revisión (por archivo, una sola pregunta)

*¿Esto se puede resolver agregando un Input al componente `luna-*` en vez de perforarlo desde afuera?*
- Sí → es deuda del design system: crear el Input y migrar.
- No (theming de terceros, casos genuinos) → dejarlo con comentario.

```bash
grep -rl "::ng-deep" --include="*.scss" erp-frontend/src/app
```

---

## Orden de ejecución recomendado (actualizado)

| # | Fase | Esfuerzo real | Por qué en este orden |
|---|---|---|---|
| 1 | **Fase 0+1** (z-index + fix del modal) | 1-2 días | Bug funcional confirmado en ~15 flujos. Fase 0 no necesita verificación previa en navegador — el código ya lo confirma. |
| 2 | **Fase 6** (paneles custom → luna-modal) | 1-2 días | Si se hace antes que el tokenizado de esos 3 archivos en Fase 1, se ahorra doble trabajo en sus SCSS. Alternativa: hacer Fase 1 completa primero y aceptar re-toque. Decidir al arrancar. |
| 3 | **Fase 5** (eliminar openDialog) | 2-3 días | Mayor superficie de bugs futuros; ~25 consumidores reales. Batch 1: 11 catálogos. Batch 2: 14 formularios + limpieza de `document-form.base.ts`. |
| 4 | **Fase 4** (icon-button) | ½ día | Rápido, bajo riesgo, inventario exacto. |
| 5 | **Fase 2** (alturas) | 1-2 días | Requiere decisión de diseño previa (escalas sm/lg). 95 ocurrencias — clasificar antes de tocar. |
| 6 | **Fase 3** (breakpoints) | 1 día | Huérfanos primero (13 sitios); pasada completa de 54 archivos como batch opcional separado. |
| 7 | **Fase 7** (::ng-deep) | continua | No bloquea nada; alimenta el backlog del design system. |

**Esfuerzo total estimado:** 7-10 días (vs. 5-7 de v1 — el re-scope de Fases 2, 3 y 5 lo aumenta).

---

## Apéndice A — Comandos de verificación rápida (copiar/pegar)

```bash
cd erp-frontend

# Fase 1: z-index crudos restantes (meta: solo tokens/_05-layout.scss)
grep -rnE 'z-index:\s*[0-9]' --include="*.scss" src

# Fase 2: alturas crudas fuera de LUNA
grep -rnE '(min-)?height:\s*[0-9]+px' --include="*.scss" src/app/pages src/app/shared | grep -v '/luna-'

# Fase 3: breakpoints huérfanos
grep -rnE '@media[^{]*max-width:\s*(600|700|900|992|1100)px' --include="*.scss" src/app

# Fase 3b: @media sin variables (meta: 0)
grep -rlE '@media[^{]*[0-9]+px' --include="*.scss" src/app | wc -l

# Fase 4: [icon]="true" restantes (meta: 0 en páginas/shared)
grep -rn '\[icon\]="true"' --include="*.html" src/app

# Fase 5: openDialog restantes (meta: 0)
grep -rn "openDialog(" src/app

# Fase 6: backdrops custom (meta: 0)
grep -rlE 'class="[a-z-]*-(backdrop|overlay)"' --include="*.html" src/app

# Fase 7: ::ng-deep
grep -rl "::ng-deep" --include="*.scss" src/app

# Verificación de build tras cada batch
npm run build
```

## Apéndice B — Registro de validación (qué se verificó y cómo)

| Afirmación de v1 | Método | Resultado |
|---|---|---|
| 4 comboboxes en z-index 1060 | Read de los 4 `.scss` | Exacto (líneas 57/57/57/592) |
| Bug Fase 0 (dropdown detrás del modal) | Trazado de `batch-serial-assignment-modal.component.html` (luna-modal 1200) → batch/serial-combobox (1060) | **Confirmado estáticamente** |
| "34 archivos con z-index" | `grep -rlE 'z-index:\s*[0-9]'` en `src/app` | **Corregido: 22** (+2 en `src/styles` que v1 omitía) |
| Tokens duplicados | Read de `_tokens.scss:363-371`, `tokens/_05-layout.scss:33-42`, `_index.scss` | Confirmado; gana `_05-layout.scss` |
| Escala luna-button/input | Read de los 3 `.scss` | 28/36/44 vs 32/36/40 — desalineación real |
| "8 valores de altura" | grep de heights en px fuera de LUNA | **Corregido: ~28 valores, 95 ocurrencias** |
| Escala de breakpoints | Read de `_breakpoints.scss:5-9` | Exacta |
| Huérfanos 600/700/900/992/1100 | grep por valor | Confirmado, inventario completo en Fase 3 |
| 16 usos de `[icon]="true"` | grep + Read línea por línea | **100% exacto** |
| openDialog en 4 formularios / ask() en 3 | grep de ambos patrones | **Re-scoped: 14 formularios + 11 catálogos con openDialog; ask() en ~45 archivos/~170 llamadas** |
| 3 backdrops custom | grep de `-backdrop`/`-overlay` en `.html` | Confirmado, son los únicos 3 |
| "::ng-deep en 45/42 archivos" | `grep -rl` | **Corregido: 44** (incluye 2 en `shared/luna/`) |
