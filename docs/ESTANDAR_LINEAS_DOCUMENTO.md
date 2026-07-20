# Estándar de líneas de documento — `luna-document-lines` (Fase 2)

> **Fecha:** 2026-07-20 · **Estado:** ✅ Ventas 100% · ⏳ Compras e Inventario pendientes
> **Predecesor:** `docs/PLAN_MIGRACION_DOCUMENT_LINES_TABLE.md` (Fases 0 y 1).
> **Audiencia:** cualquier agente/persona que migre un formulario de documento (compras, inventario) o cree uno nuevo.

---

## 1. Qué es el estándar

Todos los formularios de documentos comerciales usan la misma arquitectura de líneas, en tres capas:

```
<luna-document-lines>                    ← shell de tabs (Fase 1)
  <ng-template lunaDocumentLineTab="detail">
    <luna-document-lines-detail>         ← tabla Detalle declarativa (Fase 2)
      [columns]="lineDetailColumns"      ← columnas declarativas en el TS
      <ng-template lunaDocumentLineDetailCell="key"> ← celdas custom (opcional)
  <ng-template lunaDocumentLineTab="discounts">
    <luna-data-table> ...                ← tabla de descuentos (patrón fijo, ver §5)
  <ng-template lunaDocumentLineTab="costs">
    <luna-data-table> ...                ← tabla de costos (patrón fijo, ver §5)
```

Las tabs `taxes` y `udfs` NO se proyectan: el shell las resuelve por defecto.

### Archivos del shared (no modificar sin coordinar)

| Archivo | Rol |
|---------|-----|
| `src/app/shared/luna/luna-document-lines/luna-document-lines.component.ts` | Shell de tabs. Inputs: `itemsArray`, `taxIndicators`, `lineUdfFields`, `canEdit`, `documentId`, `activeTab` (two-way), `showAddButton`, `udfTableName`, `getItemNameFn`. Output: `itemSelected`. |
| `luna-document-lines-detail.component.ts/.html` | Tabla Detalle. Resuelve celdas por `column.key` en un `@switch`. |
| `luna-document-line-cell.types.ts` | `LunaDocumentLineDetailColumn` (key, label, cell, minWidth, align, mobileFullWidth). |
| `luna-document-line-detail-cell.directive.ts` | `lunaDocumentLineDetailCell` — proyección de celdas custom (ver §4). |
| Barrel `@shared/luna` (`index.ts`) | Exporta todo lo anterior. |

---

## 2. Celdas canónicas del Detalle (por `column.key`)

El `@switch` del detail reconoce estas keys (declarar con `cell` según tipo):

| Key | Render | Notas |
|-----|--------|-------|
| `item` | `app-item-combobox` + badge + trace-bar | Requiere `[getItemName]`; readonly vía `[getItemReadonly]` o default `!canEdit && !!documentId`. Trace-bar si `ordersCount > 0` (fills/chips vía `[getTraceFillsFn]`/`[getTraceChipsFn]`). |
| `warehouse` | `app-warehouse-selector` | `[warehouses]`, `[branchId]`, emite `(warehouseSelect)`. |
| `batch` | `app-batch-combobox` | Emite `(batchSelect)`. |
| `serial` | `app-serial-combobox` | Emite `(serialSelect)`. |
| `quantity` | `luna-input` number si `canEdit`, span si no | min/step 0.01; emite `(lineChange)`. Sin `[max]` nativo: el tope lo imponen `Validators.max` + clamp en el cálculo de línea. |
| `uom` | badge texto | Requiere `[getUom]`. |
| `stockAvailable` | span stock-low/stock-ok | Requiere `[getStockAvailable]`. |
| `orderedQty`, `quotationQty`, `quotationPendingQty`, `deliveredQty`, `pendingQty` | span number | Leen controles del mismo nombre en la línea. |
| `price`, `lineTotal` | span currency | `lineTotal` = price × quantity (bruto). |
| `weight`, `totalWeight` | span number 1.3-3 | |
| `projectCode` | `luna-input` texto | |
| `dimension1`–`dimension5` | `app-cost-center-selector` | `[costCentersByDimension]`, `[dimensionLabels]`. |
| `lineStatus` | `app-line-status-badge` | Solo si el documento tiene estado por línea. |
| `actions` | botón eliminar | Emite `(removeLine)`; solo si `canEdit`. |

> Nota: `cell: 'custom'` en la columna es solo declarativo — el render real lo decide la KEY en el `@switch`. Una key no listada cae al `@default` (ver §4).

## 3. Estructura canónica del formulario

### Shell (HTML)

```html
<luna-document-lines
  [itemsArray]="itemsArray"
  [taxIndicators]="taxIndicators"
  [lineUdfFields]="lineUdfFields"
  [canEdit]="canEdit"
  [documentId]="orderId"
  [(activeTab)]="lineActiveTab"
  [showAddButton]="false"
  udfTableName="SalesOrderItem"          <!-- tabla UDF de la entidad de línea -->
  [getItemNameFn]="itemNameForRow.bind(this)"
  (itemSelected)="selectManualItem($event.index, $event.item)"
>
  <ng-template lunaDocumentLineTab="detail"> ... </ng-template>
  <ng-template lunaDocumentLineTab="discounts"> ... </ng-template>
  <ng-template lunaDocumentLineTab="costs"> ... </ng-template>
</luna-document-lines>
```

`getItemNameFn` + `itemSelected` solo si el formulario tiene **modo manual** de ítems (el shell los reenvía a las tabs taxes/udfs).

### Detalle (HTML)

```html
<luna-document-lines-detail
  [itemsArray]="itemsArray"
  [columns]="lineDetailColumns"
  [canEdit]="canEdit"
  [documentId]="orderId"
  tableKey="sales-orders-form-detail"
  [warehouses]="warehouses"
  [getItemName]="itemNameForRow.bind(this)"
  [getUom]="uomCodeForRow.bind(this)"
  [getItemReadonly]="isItemReadonly.bind(this)"
  [getTraceFillsFn]="getTraceFills.bind(this)"
  [getTraceChipsFn]="getTraceChips.bind(this)"
  [costCentersByDimension]="costCentersByDimension"
  [dimensionLabels]="dimensionLabels"
  [branchId]="form.get('branchId')?.value"
  [ordersCount]="deliveriesCount"
  (itemSelect)="selectManualItem($event.index, $event.item)"
  (warehouseSelect)="onLineWarehouseSelected($event.index, $event.warehouse)"
  (batchSelect)="onInlineBatchSelected($event.index, $event.batch)"
  (serialSelect)="onInlineSerialSelected($event.index, $event.serial)"
  (lineChange)="onQuantityChange($event.index)"
  (removeLine)="removeItem($event)"
>
  <app-item-search-mode-toggle lunaToolbarExtras />
  <!-- celdas custom (opcional), ver §4 -->
</luna-document-lines-detail>
```

### Columnas (TS)

```typescript
get lineDetailColumns(): LunaDocumentLineDetailColumn[] {
  const cols: LunaDocumentLineDetailColumn[] = [
    { key: 'item', label: 'Artículo', cell: 'item', mobileFullWidth: true },
    { key: 'warehouse', label: 'Almacén', cell: 'custom', minWidth: '240px' },
    { key: 'quantity', label: 'Cant.', cell: 'number' },
    { key: 'uom', label: 'UOM', cell: 'text' },
    // ... cantidades trazadas condicionales, price, lineTotal, pesos ...
    { key: 'projectCode', label: 'Proy.', cell: 'text' },
    { key: 'dimension1', label: this.dimensionLabel(1), cell: 'custom' },
    // ... dimension2-5 ...
  ];
  if (this.orderId) cols.push({ key: 'lineStatus', label: 'Estado', cell: 'status' });
  if (this.canEdit) cols.push({ key: 'actions', label: '', cell: 'actions' });
  return cols;
}
```

---

## 4. Celdas custom — regla "ninguna columna queda fuera"

**Toda columna que el formulario tenía antes de migrar debe sobrevivir.** Si la key no tiene celda canónica, se proyecta con la directiva `LunaDocumentLineDetailCellDirective` (importarla en el form component desde `@shared/luna`):

```html
<luna-document-lines-detail [columns]="lineDetailColumns" ...>
  <ng-template lunaDocumentLineDetailCell="manualAccount" let-row let-index="index">
    <app-account-selector
      [accounts]="accounts"
      [readonly]="!canEdit"
      placeholder="Cuenta contable"
      [formControl]="row.get('acctCode')"
      [compact]="true"
    ></app-account-selector>
  </ng-template>
</luna-document-lines-detail>
```

- Contexto del template: `{ $implicit: row, column, index }` (igual que el slot `#cell` de `luna-data-table`).
- La columna se declara con `cell: 'custom'` y su `key` debe coincidir con el valor de la directiva.
- El `@default` del `@switch` renderiza el template proyectado; sin template, muestra "—".
- Recuperar el markup original con `git show HEAD:<ruta-del-form>.html` antes de migrar.

Casos de uso reales ya aplicados: `manualAccount` (delivery-orders, sale-invoices, sales-returns, sales-credit-notes), `invoicedQty`/`pendingInvoiceQty` (delivery-orders), `sourceQty`/`invoicedQty` (sale-reserve-invoices), `batch`/`serial` con readonly distinto al canónico (sales-credit-notes).

---

## 5. Pestañas Descuentos y Costos — patrón fijo

Estas tabs siguen usando `<luna-data-table>` propia (no el detail component), con reglas estrictas:

1. **`[formArray]="itemsArray"`** — nunca `[data]="itemsArray.controls"`.
2. **Slots `#cell` y `#actions`** — `luna-data-table` solo reconoce esos nombres. Usar `#cell2`/`#cell3`/`#actions2` hace que la celda caiga al fallback y la columna ARTÍCULO renderice **vacía** (bug real resuelto en sales-orders, 2026-07-20).
3. **Celda `item` = `<app-item-combobox>`**, no spans de texto:
   ```html
   <app-item-combobox
     [displayValue]="itemNameForRow(index)"
     [itemCode]="row.get('itemCode')?.value"
     [canBeSold]="true"                    <!-- compras: [canBePurchased] -->
     [warehouseId]="row.get('warehouseId')?.value"
     [readonly]="!canEdit || !isManualMode" <!-- respetar semántica del form -->
     (selected)="selectManualItem(index, $event)"
     [compact]="true"
   ></app-item-combobox>
   ```
4. **Nunca `[formControl]` + `[disabled]` juntos** (warning de Angular "changed after checked"). Patrón:
   ```html
   @if (canEdit) {
     <luna-input type="number" [formControl]="row.get('discountPct')" ... />
   }
   @if (!canEdit) {
     <span class="number-cell">{{ row.get('discountPct')?.value ?? 0 | number: '1.2-2' }}</span>
   }
   ```
5. **Account selector por línea**: siempre `[formControl]="row.get('acctCode')"`. El `formControlName="acctCode"` heredado estaba roto (resolvía contra el form raíz) — corregido en todos los forms migrados.

---

## 6. Checklist de migración por formulario

1. Leer `FRONTEND_GUIDE.md` completo (regla AGENTS.md).
2. Inventariar las tablas actuales: detail, discounts, costs + TODAS sus columnas (salida esperada: ninguna se pierde).
3. Guardar referencia del markup original: `git show HEAD:<form>.html`.
4. DETAIL → `<luna-document-lines-detail>` con `lineDetailColumns` declarativo; cablear handlers existentes (`itemNameForRow`, `isItemReadonly`, trazas, dimensions, branchId, ordersCount).
5. Columnas sin key canónica → `cell: 'custom'` + `<ng-template lunaDocumentLineDetailCell>`.
6. DISCOUNTS/COSTS → reglas de §5.
7. Shell → `getItemNameFn` + `itemSelected` si hay modo manual.
8. Imports: agregar `LunaDocumentLinesDetailComponent`, `LunaDocumentLineDetailCellDirective`, `ItemComboboxComponent`; eliminar los que queden muertos (`ItemNameClampDirective`, `withLineColWidths`, comboboxes sueltos, etc.).
9. Verificar: `npx eslint src/app/pages/<form> --ext .ts,.html` (0 errores) + `npx ngc --noEmit -p tsconfig.app.json` (0 errores del form) + spec del formulario si existe.
10. Reportar cambios de comportamiento (readonly, formatos, min/step) — no esconderlos.

## 7. Estado por formulario

### Ventas — ✅ completos (2026-07-20)

| Formulario | Notas |
|------------|-------|
| sales-quotations | Referencia piloto. |
| sales-orders | Referencia principal. |
| delivery-orders | Custom: `invoicedQty`, `pendingInvoiceQty`, `manualAccount`. `[canEdit]="canEdit && !deliveryId"` (cantidad bloqueada en entregas posteadas → proyecto/dimensiones readonly en guardadas, trade-off documentado). |
| sale-invoices | Custom: `manualAccount`. Fix: `rowState` se puebla en `loadIntoForm` (nombres de ítem en discounts/costs). |
| sale-reserve-invoices | Custom: `sourceQty` ("Entregado"), `invoicedQty` ("Facturado") con markup condicional cotización/entrega. |
| sales-returns | Custom: `manualAccount` (binding corregido). batch/serial editables en OPEN guardada (default canónico; antes siempre readonly). |
| sales-credit-notes | Custom: `manualAccount`, `batch`, `serial` (readonly `!canEdit \|\| !!noteId` difiere del canónico a propósito). |
| sales-debit-notes | ⏸️ **Bloqueado por backend**: no existe `SalesDebitNoteItem` en el schema (documento solo-cabecera). Ver `docs/CORRECCIONES_INTEGRALES_PROGRESO.md` C4. |

### Compras — ⏳ pendientes (tienen shell Fase 1)

purchase-requests, purchase-quotations, purchase-orders, purchase-receipts, purchase-invoices, purchase-reserve-invoices, purchase-credit-notes, purchase-returns.
En celda item usar `[canBePurchased]` en vez de `[canBeSold]`.

### Fase 0 (sin shell) — ⏳ por evaluar

- purchase-debit-notes: verificar si tiene líneas (su par de ventas no las tiene).
- stock-transfers, assembly-orders: documentos de inventario con estructura distinta; evaluar adopción parcial (tabs que apliquen).

## 8. Desviaciones aceptadas (convergencia al patrón)

| Desviación | Forms | Motivo |
|-----------|-------|--------|
| `quantity` canónica min/step 0.01, sin `[max]` nativo | todos | El tope lo imponen `Validators.max` + clamp en el cálculo. |
| batch/serial/warehouse readonly en líneas trazadas guardadas | sale-invoices, sale-reserve-invoices | Criterio de sales-orders; la asignación de lotes sigue por modal. |
| `lineTotal` = bruto (price × qty) | todos | El neto con descuento vive en la tab Descuentos. |
| Formatos number homologados (1.2-2 / 1.0-2) | varios | Convergencia visual. |

## 9. Features derivadas (trabajo aparte)

1. **Líneas en notas de débito** (`SalesDebitNoteItem` en schema + DTOs + contabilidad por líneas) — desbloquea sales-debit-notes y probablemente purchase-debit-notes.
2. **Documento de servicio (SAP B1)**: toggle Artículo/Servicio en cabecera; líneas de servicio = descripción + cuenta contable + monto, sin stock; asiento por cuenta de línea. Decisión del usuario 2026-07-20: se planea aparte, NO improvisar con columnas sueltas.
3. Posibles extensiones del shared reportadas por los agentes: input `max` en celda quantity, filtro `canBeInventoried` en celda item, readonly por celda (no solo por índice).

---

*Última actualización: 2026-07-20 — cierre de la estandarización de ventas.*
