# Plan de migración: `document-lines-table` en los 15 formularios de documentos

> **Fecha:** 2026-07-19 · **Estado:** propuesta pendiente de aprobación
> **Origen:** saga de estandarización visual (trace-bar, clamp, anchos `LINE_COL`, readonly). Todos esos fixes tuvieron que aplicarse formulario por formulario porque cada uno duplica el markup de su tabla de líneas.

---

## 1. Problema

Los 15 formularios de documentos (cotización, pedido, entrega, factura, factura reserva, devolución, NC de venta y compra, + solicitud de compra) duplican cada uno:

- El shell de tabs Detalle/Descuentos/Costos/Impuestos/Campos personalizados.
- La `<luna-data-table>` de líneas con su template `#cell` y `@switch` por columna (~300–500 líneas de HTML por formulario; p. ej. `sale-invoices-form.component.html` tiene 1,227 líneas).
- Botones agregar/quitar línea, badges de estado, configuración de columnas.

Consecuencia real medida en esta saga: cada mejora (trace-bar, clamp del nombre, código del artículo, anchos, readonly) costó editar 8–15 archivos y generó inconsistencias entre formularios (algunos quedaban fuera y el usuario lo detectaba).

## 2. Lo que ya existe

`src/app/shared/document-lines-table/` (hoy **sin uso**):

- `DocumentLinesTableComponent` standalone con 5 tabs configurables (`DocumentLinesTableConfig`, `DEFAULT_TABS`).
- Sobrescritura de tabs por template: `<ng-template appDocumentLineTab="key">`.
- Implementaciones por defecto de tabs `taxes` y `udfs` (`DocumentLineTaxesTabComponent`, `DocumentLineUdfsTabComponent`).
- `LineStatusBadgeComponent`, botones add/remove con `ConfirmDialogService`.
- **Limitación actual:** la tab `detail` SIEMPRE requiere template propio → la tabla de columnas sigue duplicada en cada formulario.

## 3. Fases propuestas

### Fase 1 — Adoptar el shell de tabs (impacto medio, riesgo bajo)

Migrar los 15 formularios a `<app-document-lines-table>` reemplazando: shell de tabs, botones agregar/quitar línea y tabs de impuestos/UDFs por las implementaciones compartidas.

- Cada formulario conserva su `appDocumentLineTab="detail"` (su tabla actual se mueve dentro del template, sin tocar columnas).
- Reducción estimada: ~150–250 líneas por formulario.
- Riesgo: bajo — no cambian columnas ni cálculos. Verificación: build + Karma + E2E por documento.

### Fase 2 — Tabla Detalle configurable (impacto alto, riesgo medio)

Extraer la tabla de líneas a `DocumentLinesDetailTableComponent` con columnas declarativas:

```ts
detailColumns: [
  { key: 'item',    cell: 'item' },      // celda canónica código+nombre+trace-bar
  { key: 'warehouse', cell: 'warehouse' },
  { key: 'quantity', cell: 'number' },
  ...
]
```

- Celdas canónicas compartidas (artículo con código+clamp+trace-bar, almacén, lote/serie, número, moneda) — cada mejora futura se hace UNA vez.
- Slots de escape para columnas específicas de un documento (p. ej. "Entregado/Facturado" de FRV).
- Orden de migración sugerido (de menor a mayor complejidad): sales-quotations → sales-orders → delivery-orders → sale-invoices → sale-reserve-invoices → espejo en compras → devoluciones/NC → purchase-requests (este último requiere primero la alineación a la clase base, ver §4).

### Fase 3 — Limpieza

- Eliminar markup muerto de cada formulario y el CSS local duplicado.
- Unificar `LINE_COL` dentro del componente (deja de aplicarse por formulario).
- Revisar `document-flow/line-status-badge` y helpers duplicados.

## 4. Prerequisitos y riesgos

- **purchase-requests** no extiende `PurchaseDocumentFormBase` (quedó alineación parcial 2026-07-19). Antes de Fase 2 para ese formulario: resolver choques (`status`/`hasChanges` accessors vs propiedades, servicios duplicados, modelo de líneas sin impuestos, `documentType` para borradores). Bug pendiente: `loadRequest` no parchea `priority` ni `requesterId`.
- **Cálculos por línea difieren** entre documentos (impuestos incluidos/excluidos, descuentos por línea vs globales, costos). Las celdas canónicas deben recibir valores ya calculados, no recalcular.
- **E2E como red de seguridad:** existe cobertura Playwright del flujo cotización→pedido→entrega→factura y de purchase-requests; ampliar a compras antes de Fase 2.
- No migrar todo de golpe: un documento por PR/commit, ventas antes que compras.

## 5. Esfuerzo estimado

| Fase | Alcance | Estimado |
|------|---------|----------|
| 1 | 15 formularios al shell compartido | 1–2 sesiones |
| 2 | celda canónica + 15 migraciones | 4–6 sesiones |
| 3 | limpieza | 1 sesión |

## 6. Criterio de éxito

- Un fix de celda (p. ej. cambiar el formato del código del artículo) toca **1 archivo** y se refleja en los 15 documentos.
- `*-form.component.html` de documentos < 600 líneas.
- Misma apariencia verificable con el set de screenshots E2E (`e2e/forms-reference-screenshots.spec.ts`).
