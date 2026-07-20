# Plan de migración: `document-lines-table` en los 15 formularios de documentos

> **Fecha:** 2026-07-19 · **Estado:** Fase 2 completada en ventas (2026-07-20) · Compras e inventario pendientes
> **Sucesor:** `docs/ESTANDAR_LINEAS_DOCUMENTO.md` — patrón canónico final, checklist de migración y estado por formulario.
> **Origen:** saga de estandarización visual (trace-bar, clamp, anchos `LINE_COL`, readonly). Todos esos fixes tuvieron que aplicarse formulario por formulario porque cada uno duplica el markup de su tabla de líneas.

---

## 1. Problema

Los 15 formularios de documentos (cotización, pedido, entrega, factura, factura reserva, devolución, NC de venta y compra, + solicitud de compra) duplican cada uno:

- El shell de tabs Detalle/Descuentos/Costos/Impuestos/Campos personalizados.
- La `<luna-data-table>` de líneas con su template `#cell` y `@switch` por columna (~300–500 líneas de HTML por formulario; p. ej. `sale-invoices-form.component.html` tiene 1,227 líneas).
- Botones agregar/quitar línea, badges de estado, configuración de columnas.

Consecuencia real medida en esta saga: cada mejora (trace-bar, clamp del nombre, código del artículo, anchos, readonly) costó editar 8–15 archivos y generó inconsistencias entre formularios (algunos quedaban fuera y el usuario lo detectaba).

## 2. Lo que ya existe

`src/app/shared/luna/luna-document-lines/` (ya elevado a LUNA en Fase 0):

- `LunaDocumentLinesComponent` standalone con 5 tabs configurables (`LunaDocumentLinesConfig`, `LUNA_DOCUMENT_LINES_DEFAULT_TABS`).
- Sobrescritura de tabs por template: `<ng-template lunaDocumentLineTab="key">`.
- Implementaciones por defecto de tabs `taxes` y `udfs` (`DocumentLineTaxesTabComponent`, `DocumentLineUdfsTabComponent`).
- `LineStatusBadgeComponent`, botones add/remove con `ConfirmDialogService`.
- **Limitación actual:** la tab `detail` SIEMPRE requiere template propio → la tabla de columnas sigue duplicada en cada formulario. Esto se resuelve en Fase 2.

## 3. Fases propuestas

### Fase 0 — Elevar el componente al design system LUNA ✅

Antes de adoptarlo en los 15 formularios, el componente debe convertirse en ciudadano de primera clase de LUNA (regla del proyecto: toda la UI se construye con el design system):

- Mover `shared/document-lines-table/` → `shared/luna/luna-document-lines/` renombrando a `LunaDocumentLinesComponent` (selector `luna-document-lines`), exportado desde el barrel `@shared/luna`. ✅
- Auditoría visual contra `docs/monorepo/DESIGN.md`: tokens de color/espaciado/tipografía (nada de valores hardcodeados), dark mode, densidades, animaciones y foco igual que el resto de LUNA. ✅
- Las celdas canónicas de la Fase 2 (artículo código+nombre+trace-bar, almacén, lote/serie, número, moneda) nacen ya como sub-componentes LUNA, reutilizando `luna-trace-bar` e `ItemNameClampDirective`.
- Storybook: agregar stories si el proyecto las tiene para componentes LUNA (`.storybook/` existe en la raíz del frontend). ✅
- Criterio de salida: el componente pasa el mismo checklist de diseño que cualquier primitiva LUNA. ✅

### Fase 1 — Adoptar el shell de tabs (impacto medio, riesgo bajo) ✅

Migrar los 15 formularios a `<luna-document-lines>` (ya elevado a LUNA en Fase 0) reemplazando: shell de tabs, botones agregar/quitar línea y tabs de impuestos/UDFs por las implementaciones compartidas.

- Cada formulario conserva su `lunaDocumentLineTab="detail"` (su tabla actual se mueve dentro del template, sin tocar columnas). ✅
- Reducción estimada: ~150–250 líneas por formulario. ✅
- Riesgo: bajo — no cambian columnas ni cálculos. Verificación: build + Karma + E2E por documento. ✅

**Completado en los 15 formularios:**
- Ventas: `sales-quotations`, `sales-orders`, `delivery-orders`, `sale-invoices`, `sale-reserve-invoices`.
- Compras: `purchase-quotations`, `purchase-orders`, `purchase-receipts`, `purchase-invoices`, `purchase-reserve-invoices`.
- Devoluciones/NC: `purchase-returns`, `purchase-credit-notes`, `sales-returns`, `sales-credit-notes`.
- Solicitudes: `purchase-requests`.

### Fase 2 — Tabla Detalle configurable (impacto alto, riesgo medio)

Extraer la tabla de líneas a `LunaDocumentLinesDetailComponent` (dentro de `shared/luna/luna-document-lines/`) con columnas declarativas:

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
| 0 | Elevar el componente a LUNA (tokens, dark mode, barrel, stories) | 1 sesión |
| 1 | 15 formularios al shell compartido | 1–2 sesiones |
| 2 | celdas canónicas LUNA + 15 migraciones | 4–6 sesiones |
| 3 | limpieza | 1 sesión |

## 6. Criterio de éxito

- Un fix de celda (p. ej. cambiar el formato del código del artículo) toca **1 archivo** y se refleja en los 15 documentos.
- `*-form.component.html` de documentos < 600 líneas.
- Misma apariencia verificable con el set de screenshots E2E (`e2e/forms-reference-screenshots.spec.ts`).
