# Shared Component Patterns (Angular ERP)

The project already has a rich set of shared standalone components in `src/app/shared/`. Reuse them before building custom controls.

---

## 0. LUNA Modal Selector Trigger Standard

All modal entity selectors (`src/app/shared/*-selector`) share a single visual contract so they look identical in every form. The full specification lives in `SKILL.md` §9.1; the rules below are the practical checklist.

**Inputs every modal selector must expose:**
- `[id]` — forwarded to the trigger element via `[attr.id]="id"` so `<luna-form-field inputId="...">` works.
- `[compact]` — `true` for table cells / document lines; `false` (default) for form fields.
- `[disabled]` / `[readonly]` — standard `ControlValueAccessor` states.

**Empty trigger rules:**
- Use a native `<button type="button">`, **not** `<luna-button>`.
- Use a unique prefix per selector (e.g. `ws-` for warehouse, `ps-` for partner).
- Trigger height is `36px` (`28px` compact); border is `1px solid var(--border-default)`; radius `var(--radius-md)`.
- Left icon = domain icon; right icon = `chevronDown`.
- Label truncates with ellipsis.

**Selected pill rules:**
- Keep the same `36px` / `28px` heights.
- Show the selected entity name and a clear/remove action.

See the prefix/icon table in `SKILL.md` §9.1.

---

## 1. PartnerSelectorComponent

**File:** `src/app/shared/partner-selector/`

**Use case:** Select a business partner (client, supplier, or both) with a searchable modal.

```typescript
import { PartnerSelectorComponent } from '../../shared/partner-selector/partner-selector.component';

@Component({
  standalone: true,
  imports: [PartnerSelectorComponent, ReactiveFormsModule, ...],
  // ...
})
export class MyFormComponent {
  form = this.fb.group({
    partnerId: [null as number | null, Validators.required],
  });
}
```

```html
<luna-form-field label="Proveedor" inputId="partner-field" [required]="true">
  <app-partner-selector
    [id]="'partner-field'"
    formControlName="partnerId"
    [partnerType]="'SUPPLIER'"
  ></app-partner-selector>
</luna-form-field>
```

**Inputs:**
- `partnerType?: 'CLIENT' | 'SUPPLIER' | 'BOTH'` — filter by partner type
- `compact?: boolean` — use `[compact]="true"` inside line tables

**Notes:**
- Implements `ControlValueAccessor`, so it works with `formControlName`.
- Displays partner name once selected.
- Opens modal with search + pagination.
- Always wrap in `<luna-form-field>` with matching `inputId` / `[id]` for accessibility.

---

## 2. ItemSearchModalComponent

**File:** `src/app/shared/item-search-modal/`

**Use case:** Search and select an item from the catalog. Used inside form pages to add lines.

```typescript
import { ItemSearchModalComponent } from '../../shared/item-search-modal/item-search-modal.component';
import { ItemSearchResult } from '../../models/item.model';

@Component({
  standalone: true,
  imports: [ItemSearchModalComponent, ...],
})
export class MyFormComponent {
  onItemSelected(item: ItemSearchResult) {
    this.addLine(item);
  }
}
```

```html
<app-item-search-modal
  [canBeSold]="true"
  [canBePurchased]="true"
  (itemSelected)="onItemSelected($event)"
></app-item-search-modal>
```

**Outputs:**
- `itemSelected` — emits the selected item object `{ id, name, price, cost, ... }`

**Inputs:**
- `canBeSold?: boolean`
- `canBePurchased?: boolean`

---

## 3. WarehouseSelectorComponent

**File:** `src/app/shared/warehouse-selector/`

```html
<luna-form-field label="Almacen" inputId="warehouse-field">
  <app-warehouse-selector
    [id]="'warehouse-field'"
    formControlName="warehouseId"
    placeholder="— Sin almacen —"
  ></app-warehouse-selector>
</luna-form-field>
```

---

## 4. TaxIndicatorSelectorComponent

**File:** `src/app/shared/tax-indicator-selector/`

```html
<luna-form-field label="Impuesto" inputId="tax-field">
  <app-tax-indicator-selector
    [id]="'tax-field'"
    formControlName="taxIndicatorId"
    placeholder="— Sin impuesto —"
  ></app-tax-indicator-selector>
</luna-form-field>
```

---

## 5. LunaPaginatorComponent

**File:** `src/app/shared/luna/luna-paginator/`

**Use case:** Pagination controls for list pages. Use the Luna paginator, not the legacy `app-paginator`.

```html
<luna-paginator
  [page]="page"
  [limit]="limit"
  [total]="total"
  [totalPages]="totalPages"
  (pageChange)="onPageChange($event)"
  (limitChange)="onLimitChange($event)"
></luna-paginator>
```

**Inputs:**
- `page: number`
- `limit: number`
- `total: number`
- `totalPages: number`

**Outputs:**
- `pageChange: EventEmitter<number>`
- `limitChange: EventEmitter<number>`

---

## 6. DocumentFlowMapComponent & DocumentFlowPanelComponent

**Files:** `src/app/shared/document-flow/`

**Use case:** Show traceability of a document through the ERP flow (e.g. Quotation → Order → Delivery → Invoice).

```html
<!-- In list page: mini map -->
<app-document-flow-map
  [docId]="quotation.id"
  [docType]="'SALES_QUOTATION'"
></app-document-flow-map>

<!-- In form page: full panel -->
<app-document-flow-panel
  [docId]="doc.id"
  [docType]="'SALES_QUOTATION'"
></app-document-flow-panel>
```

**Available docType values:**
- `'SALES_QUOTATION'`
- `'SALES_ORDER'`
- `'DELIVERY_ORDER'`
- `'SALE_INVOICE'`
- `'PURCHASE_QUOTATION'`
- `'PURCHASE_ORDER'`
- `'PURCHASE_RECEIPT'`
- `'PURCHASE_INVOICE'`

---

## 7. SectionLockOverlayComponent

**File:** `src/app/shared/section-lock-overlay/`

**Use case:** Visually lock a section of the form when the document is read-only (`CLOSED`, `CANCELLED`).

```html
<app-section-lock-overlay [locked]="doc.status === 'CLOSED'"></app-section-lock-overlay>
```

---

## 8. NumericInputmodeDirective

**File:** `src/app/shared/numeric-inputmode.directive.ts`

**Use case:** Shows numeric keyboard on mobile devices for quantity/price inputs.

```html
<input type="number" appNumericInputmode formControlName="quantity" />
```

---

## 9. Pricing utility (pure function)

**File:** `src/app/shared/pricing.util.ts`

Mirror of backend pricing logic. Use to calculate line totals in the form before sending to server.

```typescript
import { calcLineWithIndicator } from '../../shared/pricing.util';

const result = calcLineWithIndicator({
  quantity: 2,
  price: 100,
  discountPct: 10,
  discountAmt: 0,
  taxRate: 0.13,
  isInclusive: false,
});
// result.subtotal, result.tax, result.total
```

---

## 10. When to create a new shared component

Create a new shared component **only** when:

1. The same UI pattern appears in **3+ pages**.
2. It encapsulates complex interaction logic (modal, search, pagination inside).
3. It needs to be a `ControlValueAccessor` to integrate with Reactive Forms.

**Don't create shared components for:**
- Simple one-off tables or lists.
- Styling wrappers (use CSS classes).
- Business logic that belongs in services.
