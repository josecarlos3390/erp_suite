# Densidad de interfaz y su auditoría

> Estado: **2026-09-05** — frente cerrado. Herramientas operativas en `erp-frontend`.

## Qué es la densidad

Preferencia visual **Compacta / Normal / Espaciosa** (persistida por navegador).
`DensityService` aplica `.density-compact` / `.density-spacious` en `<body>` y
notifica en caliente a `luna-form-page` y `luna-data-table`.

- Componentes canónicos LUNA: obedecen por diseño (variables de densidad).
- Tokens base (`--space-*`, `--text-*`): **constantes**; no escalan con la densidad.
  Único token que escala: `--text-base` (14→13px en Compacta).
- Contenido custom → variables propias con tres valores + `:host-context(body.density-*)`
  (patrón usado en años fiscales, Centro, permisos, dashboard, reportes, selectores,
  detalles de maestros y POS).

## Regla de oro para contenido custom

```scss
:host { --mi-pad: 16px 20px; }                      // Normal
:host-context(body.density-compact)  { --mi-pad: 12px 14px; }
:host-context(body.density-spacious) { --mi-pad: 20px 26px; }
```

- Chips micro y espaciados ≤ ~3px pueden quedar constantes (decisión de diseño).
- POS: UI densa por diseño — base = valores actuales; solo Espaciosa relaja
  (tipografía `--pos-fs-*` y espaciado `--pos-gap-*/--pos-pad-*`).
- **Nunca** usar alias legacy inexistentes (`--fs-*`, `--font-size-*`): la propiedad
  queda inválida y el texto hereda ~16px.

## Herramientas de auditoría (en `erp-frontend`)

| Comando | Qué hace |
|---|---|
| `npm run audit:density` | Estático: px fuera de bloques de densidad, tablas crudas en HTML, **variables CSS indefinidas**. Flags: `--min N`, `--json`, `--write-baseline <f>`, `--baseline <f>` (exit 1 solo con hallazgos nuevos). |
| `npm run audit:density:routes` | Genera `e2e/density-audit.routes.json` (URLs de listas + formularios `/new`). |
| `npm run audit:density:e2e` | Dinámico (Playwright): barrido de pantallas midiendo Compacta vs Espaciosa (`luna-form-section`, `luna-data-table`, tablas crudas). Flags del wrapper: `--write-baseline`, `--url-fragment=…`. Reporte JSON en `test-results/density-audit-report.json`. |

Marcadores manuales: `density-ok` (línea/archivo, escapa al estático) y comentarios
`density-audit: off` / `on`. Nota: login local con rate-limit (~5/min) — esperar ~1 min
entre corridas E2E consecutivas.

## Resultado del frente (2026-09-05)

- Pantallas custom corregidas y verificadas: años fiscales, Centro de configuración,
  permisos, dashboard, 4 reportes, selectores compartidos, detalles de maestros, POS.
- Alias rotos (`--fs-*`, `--font-size-*`) y variables CSS indefinidas: **0** en el árbol
  (el detector encontró y se corrigieron 3 bugs reales en `profile` y
  `purchase-invoices-form`).
- Baselines (`.audit-density.baseline.json`, `e2e/density-audit.baseline.json`): deuda
  conocida **274 hallazgos estáticos + 25 tablas crudas**; CI falla solo con hallazgos
  NUEVOS. Re-auditar con una base sembrada para medir tablas con datos.
