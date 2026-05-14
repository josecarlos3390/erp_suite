# Shared Component Patterns (Angular ERP)

The project already has a rich set of shared standalone components in `src/app/shared/`. Reuse them before building custom controls.

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
<app-partner-selector
  formControlName="partnerId"
  [partnerType]="'SUPPLIER'"
></app-partner-selector>
```

**Inputs:**
- `partnerType?: 'CLIENT' | 'SUPPLIER' | 'BOTH'` — filter by partner type

**Notes:**
- Implements `ControlValueAccessor`, so it works with `formControlName`.
- Displays partner name once selected.
- Opens modal with search + pagination.

---

## 2. ItemSearchModalComponent

**File:** `src/app/shared/item-search-modal/`

**Use case:** Search and select an item from the catalog. Used inside form pages to add lines.

```typescript
import { ItemSearchModalComponent } from '../../shared/item-search-modal/item-search-modal.component';

@Component({
  standalone: true,
  imports: [ItemSearchModalComponent, ...],
})
export class MyFormComponent {
  onItemSelected(item: any) {
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
<app-warehouse-selector formControlName="warehouseId"></app-warehouse-selector>
```

---

## 4. TaxIndicatorSelectorComponent

**File:** `src/app/shared/tax-indicator-selector/`

```html
<app-tax-indicator-selector formControlName="taxIndicatorId"></app-tax-indicator-selector>
```

---

## 5. PaginatorComponent

**File:** `src/app/shared/paginator/`

**Use case:** Pagination controls for list pages.

```typescript
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
```

```html
<app-paginator
  [page]="page"
  [totalPages]="totalPages"
  [total]="total"
  (pageChange)="onPageChange($event)"
></app-paginator>
```

**Inputs:**
- `page: number`
- `totalPages: number`
- `total: number`

**Outputs:**
- `pageChange: EventEmitter<number>`

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
  useSinTaxCalculation: false,
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
