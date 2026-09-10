# Densidad de interfaz y su auditoría

> Estado: **2026-09-09** — Fase 2 (T48) cerrada: 51 páginas migradas, auditoría
> estática y dinámica en 0, calidad de bloques en 0. Herramientas operativas en
> `erp-frontend`.

## Qué es la densidad

Preferencia visual **Compacta / Normal (Comfortable) / Espaciosa** (persistida por
navegador en `localStorage['erp.uiDensity']`; default `compact`).
`DensityService` aplica `.density-compact` / `.density-spacious` en `<body>` y
notifica en caliente a `luna-form-page` y `luna-data-table`. Sin clase = **Normal**.

- Componentes canónicos LUNA: obedecen por diseño (variables de densidad).
- Tokens base (`--space-*`, `--text-*`): **constantes**; no escalan con la densidad.
  Único token que escala: `--text-base` (14→13px en Compacta).

## Regla de oro (convención T48, vigente)

Para componentes/reskin **existentes**, el valor ACTUAL es el look de **Comfortable
y Compacta**; solo **Espaciosa** relaja, con Δ ≥ 2px por eje en espaciado
(en tipografía Δ ≥ 1px):

```scss
:host { --x-cell-py: 6px; --x-cell-px: 8px; }   // = look actual
:host-context(body.density-spacious) {          // solo relaja
  --x-cell-py: 10px; --x-cell-px: 12px;
}
```

Casos especiales:

- `ViewEncapsulation.None` (p. ej. POS): `:host`/`:host-context` **no matchean** →
  declarar sobre el selector real del host (`app-pos { … }` y
  `body.density-spacious app-pos { … }`).
- Estilos globales (`_modals.scss`, `_lists.scss`): base `:root, body.density-compact`
  y relajación `body.density-spacious`.
- Chips micro y espaciados ≤ ~3px pueden quedar constantes (decisión de diseño);
  en POS los gaps de 3–5px sí relajan (Δ ≥ 2px) desde el cierre de T48.
- **Nunca** usar alias legacy inexistentes (`--fs-*`, `--font-size-*`): la propiedad
  queda inválida y el texto hereda ~16px.
- **Nunca** `--x: var(--x)` (referencia cíclica): la var queda inválida en ese modo.

## Método del codemod de Fase 2 (51 páginas)

1. **Swaps exactos** (incremento 1 y 2): cada `padding/gap/font-size` en px de una
   página pasa a `var(--<prefijo>-sp-<base>px)` / `var(--<prefijo>-fs-<base>px)`,
   donde el prefijo son las iniciales del archivo (`accounts` → `--acc-`,
   `pos` → `--pos-`) y el sufijo es el **valor base** (así el nombre autodocumenta
   el look actual: `--pos-padding-3: 3px`).
2. **Bloques de densidad** (incremento 3, codemod determinista): al inicio del SCSS
   (después del último `@use`/`@forward`) se inserta
   `:host { …vars base… }` + `:host-context(body.density-spacious) { …Δ ≥ 2px… }`.
   En `ViewEncapsulation.None` el bloque base se emite sobre el selector real del host.
3. **Verificación**: `npm run audit:density` (estático) → 0 hallazgos;
   `npm run build`; `npm run e2e:visual` (52 baselines) para probar cero regresión
   del look por defecto.

Artefacto de la migración: `.audit-density.baseline.json` (0 hallazgos + 28 tablas
crudas conocidas) — CI falla solo con hallazgos **nuevos**.

## Herramientas de auditoría (en `erp-frontend`)

| Comando | Qué hace |
|---|---|
| `npm run audit:density` | Estático: px fuera de bloques de densidad, tablas crudas en HTML, **variables CSS indefinidas**. Flags: `--min N`, `--json`, `--write-baseline <f>`, `--baseline <f>` (exit 1 solo con hallazgos nuevos). |
| `npm run audit:density:vars` | **Calidad de los bloques**: vars huérfanas, var usada sin base, Δ < 2px en espaciado, `--x: var(--x)` (referencia cíclica), bloque de densidad duplicado, nombre vs valor, bloques desbalanceados. Exit 1 con cualquier hallazgo. |
| `npm run audit:density:ci` | Ambas anteriores (gate de CI). |
| `npm run audit:density:fix` | Aplicador mecánico de la pasada de calidad: elimina vars huérfanas, fusiona bloques de densidad duplicados (solo vars, ganando la última declaración = comportamiento CSS actual) y borra los que quedan vacíos. `--dry-run` / `--debug` / `--only=<substr>`; aborta si desbalancea llaves. |
| `npm run audit:density:routes` | Genera `e2e/density-audit.routes.json` (URLs de listas + formularios `/new` + `EXTRA_SAMPLE`: detalle de año fiscal y los 10 reportes con tablas crudas). |
| `npm run audit:density:e2e` | Dinámico (Playwright): barrido midiendo Compacta vs Espaciosa (`luna-form-section`, `luna-data-table`, tablas crudas). Flags: `--write-baseline`, `--url-fragment=…`. Reporte JSON en `test-results/density-audit-report.json`. |
| `npx playwright test density-raw-tables.spec.ts --project=chromium` | Dinámico **con datos reales**: tabla cruda del BOM del artículo kit (`KIT-PC01` del seed) — verifica 1px en Compacta/Comfortable y 4px en Espaciosa. |

Marcadores manuales: `density-ok` (línea/archivo, escapa al estático) y comentarios
`density-audit: off` / `on`. Nota: login local con rate-limit (~5/min) — esperar ~1 min
entre corridas E2E consecutivas. El `webServer` de Playwright re-siembra la BD en cada
corrida, así que los datos que un spec necesita medir deben crearse en la **misma**
invocación.

## Tablas crudas (28 en plantillas de página)

La auditoría dinámica mide el padding de `tbody td` de toda `<table>` que no esté
dentro de `luna-data-table`. Cobertura por familia:

| Familia | Tablas | Cómo obedecen a la densidad |
|---|---|---|
| `.modal-table` (10 archivos: órdenes/entregas/cotizaciones/facturas reserva) | 15 | Estilo global `src/styles/_modals.scss` (`--modal-table-cell-*`: 14/20 → 18/24). Solo son medibles con el modal abierto, por eso el barrido dinámico las reporta como “no medible”. |
| `.group-table` (7 reportes: balance, resultados, flujo de caja, diario, mayor, balance de comprobación, revaluación) | 13 | `src/app/pages/reports/report-tables.scss` (compartido; `--rt-cell-*`: 6/8 → 10/12). Rutas `/reports/*` agregadas al manifiesto dinámico en el cierre de T48. |
| Tablas propias con vars locales (`inst-table`, `picker-table`, `line-table`, `lines-table`, `statement-lines-table`, `pl-prices-table`, `import-preview-table`, `adjustment-table`, `suggest-table`; 7 archivos) | 11 | Vars `--<prefijo>-*` con bloque Espaciosa en el SCSS del componente. |
| `table.luna-table` crudas de `item-detail` (BOM y órdenes de ensamblaje) | 2 | Regla propia `.luna-table thead th, tbody td { padding: var(--id-sp-1) }`: 1px en Compacta/Comfortable (idéntico al default del navegador → cero cambio visual) y 4px en Espaciosa. Verificado con datos por `e2e/density-raw-tables.spec.ts`. |
| Tabla del pie de `luna-data-table` (reportes de ventas/compras/valorización) | 3 | Excluidas de la medición dinámica por vivir dentro de `luna-data-table`; su padding en línea usa tokens `--space-*` (no escalan) — el cuerpo de la misma tabla sí obedece. |

## Resultado del frente

- **2026-09-05** (apertura): pantallas custom corregidas (años fiscales, Centro,
  permisos, dashboard, reportes, selectores, detalles de maestros, POS), 3 bugs reales
  de alias rotos (`--fs-*`) corregidos.
- **2026-09-09** (cierre T48 Fase 2): 51 páginas migradas por codemod
  (307 px crudos → 0), auditoría estática en **0 hallazgos**, calidad de bloques en
  **0 hallazgos** y auditoría dinámica sin problemas nuevos. La pasada de calidad
  encontró y corrigió: 66 declaraciones huérfanas, 17 bloques de densidad duplicados
  (el par base/Espaciosa quedaba partido en dos por el codemod) y **3 referencias
  cíclicas** (`--det-gap` en `item-detail`/`partner-detail` y `--rep-opt-gap` en el
  reporte de revaluación, que dejaban el espaciado en 0 en densidad Normal).
- Baselines vigentes: `.audit-density.baseline.json` = 0 hallazgos / 28 tablas crudas;
  `e2e/density-audit.baseline.json` = `{}` (sin problemas conocidos).
