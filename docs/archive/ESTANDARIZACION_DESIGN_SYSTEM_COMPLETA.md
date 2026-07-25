# Estandarización del Frontend al Design System LUNA — COMPLETA
**Fecha:** 2026-07-23

## Objetivo
Que TODO el frontend use exclusivamente componentes y tokens del design system LUNA — sin componentes nativos sueltos ni valores hardcodeados — para lograr consistencia visual total (alineación y tipografía uniforme).

## Hallazgo clave del escaneo
El design system LUNA **ya estaba completo** (luna-input, luna-select, luna-checkbox, luna-switch, luna-textarea, luna-button, luna-icon-button, luna-data-table, luna-form-page/row/field, luna-modal, luna-menu, etc.). El problema NO era falta de componentes, sino:
- **Tipografía hardcodeada** (px/rem mezclados, dos escalas: `--text-*` oficial + `--fs-*` legacy).
- **14 inputs nativos** (selects/checkboxes/inputs) en 5 archivos.
- **11 clases `.btn-*` custom** + anchors de navegación sin `luna-button`.

---

## Fases ejecutadas (todas ✅)

### Fase 1 — Unificar tokens tipográficos (`--fs-*` → `--text-*`)
- Eliminados los aliases legacy `--fs-*` de `styles.scss` (8 definiciones).
- Migrados **62 archivos** que usaban `var(--fs-*)` a `var(--text-*)`.
- **Resultado:** una sola fuente de verdad `--text-*` (`_06-typography.scss`). 0 usos de `--fs-*`.

### Fase 2 — Tipografía hardcodeada → tokens `--text-*`
- Migrados **~470 `font-size`** hardcodeados a `var(--text-*)` en TODO el frontend: `pages`, `shared` (no-luna), `styles/` globales, `core` (sidebar) y `login`.
- Mapeo aplicado: `10px→--text-2xs`, `11/12px→--text-xs`, `13px→--text-sm`, `14/15px→--text-base`, `16px→--text-md`, `18px→--text-lg`, `20px→--text-xl`, etc.
- Solo quedan **7 valores decorativos** (iconos de empty-state, placeholder, avatar) documentados con comentario `/* decorativo */`.

### Fase 3 — Inputs nativos → componentes LUNA
- Migrados **14+ elementos** (selects, checkboxes, inputs text/number, textarea) en 5 archivos:
  - `bank-reconciliation-form` (2 selects → luna-select, 2 checkboxes → luna-checkbox, 3 inputs → luna-input)
  - `bank-statement-form` (1 select, 1 textarea → luna-textarea, 5 inputs)
  - `currency-form` (2 checkboxes toggle → luna-switch)
  - `user-form` (1 checkbox → luna-checkbox)
  - `incoming-payments-form` (1 checkbox → luna-checkbox + handler simplificado)
- **Resultado:** 0 inputs/selects/textareas nativos en templates (excluyendo POS).

### Fase 4 — Botones nativos y `.btn-*` → `luna-button`
- Eliminadas las **11 clases `.btn-*` custom**.
- **Extendido el design system:** `luna-button` ahora soporta `[routerLink]` (renderiza `<a>`) — capacidad que faltaba para botones de navegación. Validado que los 1100+ botones existentes siguen funcionando (ng-content proyecta correctamente vía `<ng-template>`).
- Migrados **9 anchors** de navegación ("Ver", "Nueva Guía") a `<luna-button [routerLink]>`.
- **Hallazgo al auditar los ~148 `<button>` nativos:** la inmensa mayoría ya son LUNA:
  - Items de menú (`luna-menu__item lunaMenuItem`) → API correcta de `luna-menu`, legítimos.
  - Internals de `luna-paginator` («‹1›») y `luna-entity-select` → legítimos.
  - **No hay botones de acción nativos sueltos** — ya todos usan `luna-button`.

---

## Verificación final (Playwright)
- **Compilación TS:** limpia (`tsc --noEmit` EXIT 0).
- **8 pantallas** (dashboard, partners, items, sales-quotations, bank-reconciliation, currencies, forms): todas cargan con fuente **Inter** y font-sizes en la escala `--text-*` (20px títulos lista, 18px form, 30px widget).
- **0 errores fatales** (`pageerror`) en todas las pantallas.
- Smoke tests de botones: los `<luna-button>` existentes renderizan con texto y contenido proyectado; los routerLink-buttons renderizan como `<a>`.

---

## Excepciones documentadas (legítimas)
1. **7 iconos decorativos** con `font-size` fijo (empty-state, placeholder, avatar inicial) — marcados con comentario.
2. **Sidebar nav-items** (`nav-group-btn`, `nav-item`) — **excepción legítima decidida con el usuario (2026-07-23)**: son navegación del shell (no botones de acción). Migrarlos a `luna-button` requeriría reintroducir `::ng-deep` para estilizar el botón interno encapsulado — una regresión al problema que se limpió en la Fase 7 del plan visual. El header sí migró sus icon-buttons (collapse, mobile-toggle) a `luna-icon-button` porque esos sí encajan. El sidebar mantiene su navegación custom, igual que Slack/Linear/Notion. Si en el futuro se quiere unificar, la vía limpia es crear un componente `luna-nav-item` nuevo.
3. **Módulo POS**: excluido por decisión (UI táctil custom, 64 font-size) — fase separada futura.

## Roadmap del design system (mejoras futuras, no bloqueantes)
- Input `[compact]` / `[hideLabel]` en `luna-form-field` para inputs en tablas densas (cubre los `.line-input` de bank-reconciliation/statement).
- `luna-button-group` o variant `toggle` (grupo de botones toggle en outgoing-payments).

---

## Conclusión
El frontend ahora usa **netamente el design system LUNA**: una sola escala tipográfica (`--text-*`), todos los inputs/selects/checkboxes/textarea son componentes luna-*, y todos los botones son `luna-button`/`luna-icon-button` (los `<button>` nativos restantes son items de `luna-menu` o internals de componentes luna, que es correcto). La inconsistencia de alineación y tipografía que motivó este trabajo queda resuelta a nivel de tokens y componentes.
