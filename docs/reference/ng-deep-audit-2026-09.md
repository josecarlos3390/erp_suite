# Auditoría `::ng-deep` — 2026-09-09 (T49, plan visual v2 Fase 7)

> Método: conteo por archivo de TODAS las líneas que contienen el token
> `::ng-deep` (incluye menciones en comentarios) y separación de las **reglas
> CSS activas** (línea de código, no comentario). Criterio del plan-cierre
> T49: mantener solo usos **justificados** (contenido proyectado en tablas
> LUNA / overlays / selectores custom sin customization point) documentados
> con marcador `// ::ng-deep justificado:`; migrar los evitables.

## Resultado: N=60 menciones (31 archivos) → M=9 reglas activas (9 archivos)

- **60 líneas** contienen el token en `src/` (31 archivos).
- **51 son comentarios** — en su mayoría documentación de los refactors
  "T10 Ondas 2/3/4" (2026) que ya eliminaron los `::ng-deep` evitables de
  páginas/listas (movidos a CSS global `_layout.scss`/`_lists.scss`,
  parametrización por CSS var en `luna-input`/`luna-form-field`/`luna-select`
  (`--luna-label-margin-bottom`, `cell` host flags, `--luna-action-icon-size`)
  o a selectores directos de componentes con `ViewEncapsulation.None`).
- **9 reglas activas**, todas con contenido proyectado/encapsulado de un child
  sin vía alternativa — cada una documentada con su marcador junto al uso.

## Reglas activas (M=9) y justificación

| # | Archivo | Regla | Justificación (marcador en el código) |
|---|---------|-------|----------------------------------------|
| 1 | `src/app/pages/assembly-orders/assembly-orders.component.scss:12` | `:host ::ng-deep .filter-group luna-select` | Contenido proyectado vía `<ng-content>` en `app-filter-field` (luna-select); sin alternativa limpia. |
| 2 | `src/app/pages/audit-logs/audit-logs.component.scss:11` | `:host { ::ng-deep { .filter-bar/… } }` | Filtros luna-select proyectados dentro del wrapper de `app-filter-bar`. |
| 3 | `src/app/pages/batches/batches.component.scss:409` | `::ng-deep app-item-combobox` | Selector custom proyectado en el wrapper readonly (código + nombre). |
| 4 | `src/app/pages/price-lists/price-list-form.component.scss:264` | `::ng-deep td luna-input input[type='number']` | `<input>` interno de `luna-input` dentro de celda de tabla (sin customization point). |
| 5 | `src/app/pages/reports/stock-valuation/stock-valuation.component.scss:92` | `:host ::ng-deep .filters-bar luna-button` | Override responsive móvil (flex/width) de `luna-button`, varía por página. |
| 6 | `src/app/pages/sales-credit-notes/sales-credit-notes-form.component.scss:44` | `:host ::ng-deep { trigger de selectores ps-/ws-/prj-… }` | Trigger de selectores custom propios (wrapping de texto) sin customization point LUNA. |
| 7 | `src/app/shared/luna/luna-empty-state/luna-empty-state.component.scss:61` | `::ng-deep svg` | `<svg>` crudo proyectado (ng-content del propio componente); icono LUNA ya consume `--luna-action-icon-size` sin pierce. |
| 8 | `src/app/shared/partner-selector/partner-selector.component.scss:156` | `::ng-deep { botón clear sobre .luna-btn }` | Botón clear del trigger sobre `.luna-btn` (tamaño compacto) sin customization point. |
| 9 | `src/styles/_inventory-form-lines.scss:8` (mixin) | `:host ::ng-deep .inventory-form-lines` | Mixin incluido desde páginas con encapsulación emulada que envuelven `luna-document-lines`; estiliza celdas y selectores custom proyectados en tablas LUNA. |

## Sin regresiones visuales

- No se modificó **ninguna regla CSS** en T49: solo se añadió el marcador de
  justificación faltante en `_inventory-form-lines.scss` (mixin). El resto de
  reglas ya estaban documentadas por las olas T10.
- Las suites visuales existentes (`forms-visual-regression.spec.ts`,
  `qa-visual-checks`, `density-audit` dinámico Compacta/Espaciosa) no se ven
  afectadas (cero cambios de estilo); no se requirieron nuevos screenshots.

## Cierre

El token `::ng-deep` sigue siendo **deprecado** (Angular). Los 9 usos
remanentes quedan marcados y justificados como deuda aceptada hasta que los
componentes LUNA expongan customization points (CSS vars/atributos) para cada
caso — tracking en plan visual v2 Fase 7. Cualquier `::ng-deep` NUEVO debe
traer su marcador `// ::ng-deep justificado:` con la razón.

---

## Actualización (T62 y T65, 2026-09-11): de 9 a 4 usos, con gate propio

El informe anterior es el **snapshot histórico de T49** (por eso conserva la
tabla M=9); el estado final de ese trabajo es:

| Ola | Usos | Qué pasó |
|-----|------|----------|
| T49 (este informe) | **9** | Se documentaron y marcaron todos los usos activos. |
| T62 | **6** | Se eliminaron 3 sin cambio visual: `audit-logs` y `assembly-orders` perforaban elementos de **su propia plantilla** o del template del hijo (regla global/`_layout.scss`) y `sales-credit-notes` ya tenía el input `[wrapDescription]`. |
| T65 | **4** | Se resolvieron 5 más: `batches` → variante **`[presentation]="'field'"`** de `item-combobox`; `partner-selector` → punto de customización **`--luna-btn-height`** de `luna-button`; `stock-valuation` y `luna-empty-state` → elementos de su propia plantilla (regla normal); `price-list-form` → el pierce era **código muerto** (`:not(.luna-input)`). |

Los **4 usos que quedan** son de contenido que no lleva atributo de
encapsulamiento y no tiene vía alternativa:

| # | Archivo | Caso |
|---|---------|------|
| 1-2 | `shared/luna/luna-action-icon/luna-action-icon.component.ts` | El `<svg>` entra por `[innerHTML]` (`ACTION_ICONS`): dimensionarlo/anímarlo es imposible desde la plantilla del componente. |
| 3 | `shared/section-lock-overlay/section-lock-overlay.component.ts` | El `<strong>` del mensaje entra por `[innerHTML]` (soporta `**negrita**`). |
| 4 | `styles/_inventory-form-lines.scss` (mixin) | Mixin incluido por 8 formularios de inventario; estiliza celdas y selectores proyectados dentro de `luna-document-lines`. |

**Métrica reproducible:** `npm run audit:ng-deep` (`scripts/audit-ng-deep.mjs`,
job `lint-test-build` de CI) cuenta los usos fuera de comentarios en
`src/**/*.{scss,ts}` y falla si alguno no lleva `// ::ng-deep-ok: <razón>`.
Resultado actual: **4 usos en 3 archivos, 4 justificados, 0 sin justificar**.
Política y recetas de customización: `erp-frontend/src/styles/CSS-ARCHITECTURE.md`
§5; detalle del cierre en `AUDIT.md` T65.
