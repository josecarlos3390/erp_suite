---
name: angular-erp-frontend
description: Scaffold and maintain Angular frontend pages for an ERP system using the Luna design system. Use when building new pages, forms, services, models, or tests in the erp-frontend project. Covers standalone components, Luna list + form page patterns, reactive forms with FormArray for document lines, lazy loading, shared component reuse, RxJS patterns (debounce, forkJoin), Karma/Jasmine testing, and integration with NestJS REST API.
---

# Angular ERP Frontend — Luna Design System

## Quick start

Create a new page feature (e.g. `purchase-orders`):

```bash
# 1. Create folder structure
mkdir -p erp-frontend/src/app/pages/purchase-orders

# 2. Create files (see references/module-template.md for exact boilerplate):
#    purchase-orders.component.ts          (list page)
#    purchase-orders.component.html
#    purchase-orders.component.scss
#    purchase-orders-form.component.ts     (form page)
#    purchase-orders-form.component.html
#    purchase-orders-form.component.scss
#    purchase-orders.service.ts
#    purchase-orders.service.spec.ts
```

## Architecture rules

### 1. Standalone Components

- `standalone: true` in every `@Component`.
- Declare all dependencies explicitly in `imports: [...]`.
- No `AppModule` or feature NgModules.
- Bootstrap via `bootstrapApplication(AppComponent, appConfig)` in `main.ts`.

### 2. Page pattern: List + Form

Every document-type page follows this structure:

- **`{feature}.component.ts`** — List page (smart/container).
  - Paginated table, search with debounce, filters, row action menus.
  - Uses `PaginatorComponent` from `shared/`.
  - Follows **Luna list pattern** (see §5 below).

- **`{feature}-form.component.ts`** — Form page (smart/container).
  - Reactive form (`FormBuilder`, `FormArray` for lines).
  - Load catalogs with `forkJoin` in `ngOnInit`.
  - Read-only state when document is `CLOSED` / `CANCELLED`.
  - Follows **Luna form pattern** (see §6 below).

- **`{feature}.service.ts`** — Service with `HttpClient` calls.

Register both in `app.routes.ts` with `children`:

```typescript
{
  path: 'purchase-orders',
  canActivate: [roleGuard(['ADMIN'])],
  children: [
    { path: '', loadComponent: () => import('./pages/purchase-orders/purchase-orders.component').then(m => m.PurchaseOrdersComponent) },
    { path: 'new', loadComponent: () => import('./pages/purchase-orders/purchase-orders-form.component').then(m => m.PurchaseOrdersFormComponent) },
    { path: ':id', loadComponent: () => import('./pages/purchase-orders/purchase-orders-form.component').then(m => m.PurchaseOrdersFormComponent) },
  ]
}
```

### 3. Services

```typescript
@Injectable({ providedIn: 'root' })
export class PurchaseOrdersService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/purchase-orders`;

  getAll(query: PurchaseOrderQuery = {}) {
    let params = new HttpParams();
    if (query.page   != null) params = params.set('page',   query.page);
    if (query.limit  != null) params = params.set('limit',  query.limit);
    if (query.search)         params = params.set('search', query.search);
    if (query.status)         params = params.set('status', query.status);
    return this.http.get<PaginatedResult<PurchaseOrder>>(this.api, { params });
  }

  getOne(id: number) {
    return this.http.get<PurchaseOrder>(`${this.api}/${id}`);
  }

  create(data: any)  { return this.http.post<PurchaseOrder>(this.api, data); }
  update(id: number, data: any) { return this.http.patch<PurchaseOrder>(`${this.api}/${id}`, data); }
  close(id: number)  { return this.http.post<PurchaseOrder>(`${this.api}/${id}/close`, {}); }
  cancel(id: number) { return this.http.post<PurchaseOrder>(`${this.api}/${id}/cancel`, {}); }
}
```

### 4. Models

Pure TypeScript `interface` in `src/app/models/`:

```typescript
export type PurchaseOrderStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface PurchaseOrder {
  id: number;
  code: string;
  status: PurchaseOrderStatus;
  partner: { id: number; name: string };
  items: PurchaseOrderItem[];
  total: number;
}

export interface PurchaseOrderItem {
  item: { id: number; name: string };
  quantity: number;
  price: number;
  subtotal: number;
}
```

Keep models minimal. Use union types for enums. Add helper constants in the same file if needed.

---

## 5. Luna List Pattern (catalogs, documents, settings)

All list pages MUST follow this exact HTML structure and CSS classes. Global styles live in `src/styles/_lists.scss`.

**HTML structure:**

```html
<div class="page-container">
  <!-- Header -->
  <div class="page-header">
    <h2>Título de página</h2>
    <div class="header-actions">
      <luna-button variant="primary" size="sm" text="+ Nuevo" (lunaClick)="goNew()"></luna-button>
    </div>
  </div>

  <!-- Info banner (optional but recommended) -->
  <div class="info-banner">
    <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
    <span><strong>Contexto:</strong> Descripción breve de qué se gestiona aquí.</span>
  </div>

  <!-- Filter bar -->
  <div class="filter-bar">
    <div class="filter-search">
      <i class="fas fa-search search-icon"></i>
      <input type="text" class="search-input" placeholder="Buscar…"
             [(ngModel)]="search" (input)="onSearchInput()" />
      @if (search) {
        <button class="search-clear" (click)="clearSearch()">✕</button>
      }
    </div>

    <!-- Additional filters (optional) -->
    <div class="filter-group">
      <div class="filter-field">
        <label>Kit / Partner / Estado</label>
        <app-item-selector
          [(ngModel)]="filterKitId"
          [items]="kits"
          placeholder="Todos los kits"
          (itemSelected)="onFilterChange()"
        ></app-item-selector>
      </div>
    </div>
  </div>

  <!-- Data table -->
  <luna-data-table
    [data]="items"
    [columns]="columns"
    tableKey="feature-list"
    [columnReorderable]="true"
    [columnVisibilityToggle]="true"
    [loading]="loading"
    density="compact"
    emptyTitle="Sin registros"
    emptyDescription="No hay registros para mostrar."
    emptyActionLabel="Crear la primera"
    (emptyAction)="goNew()"
    (rowClick)="edit($event)"
  >
    <ng-template #actions let-row>
      <div class="actions">
        <luna-button
          action="edit"
          variant="secondary"
          (lunaClick)="edit(row); $event.stopPropagation()"
        ></luna-button>
        <luna-button
          action="delete"
          variant="destructive"
          (lunaClick)="remove(row); $event.stopPropagation()"
        ></luna-button>
      </div>
    </ng-template>
  </luna-data-table>

  <!-- Paginator -->
  @if (totalPages > 1) {
    <app-paginator
      [page]="page"
      [limit]="limit"
      [total]="total"
      [totalPages]="totalPages"
      (pageChange)="onPageChange($event)"
      (limitChange)="onLimitChange($event)"
    ></app-paginator>
  }
</div>
```

**Key rules for list actions:**
- Action buttons MUST be wrapped in `<div class="actions">`.
- Use `luna-button` with `action="edit"` + `variant="secondary"` for edit.
- Use `luna-button` with `action="delete"` + `variant="destructive"` for delete.
- Always add `$event.stopPropagation()` so `rowClick` does not fire when clicking actions.
- Do NOT use raw text/symbols (e.g. `✎`) inside action buttons.

**Component TS pattern:**

```typescript
export class MyListComponent implements OnInit {
  protected cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private svc = inject(MyService);

  items: MyItem[] = [];
  loading = false;
  search = '';
  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  private searchSubject = new Subject<string>();

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => { this.page = 1; this.load(); });
    this.load();
  }

  private load() {
    this.loading = true;
    this.svc.getAll({ page: this.page, limit: this.limit, search: this.search || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.items = res.data;
          this.total = res.total;
          this.totalPages = res.totalPages;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => { this.loading = false; this.cdr.markForCheck(); }
      });
  }

  onSearchInput() { this.searchSubject.next(this.search); }
  clearSearch() { this.search = ''; this.page = 1; this.load(); }
  onFilterChange() { this.page = 1; this.load(); }
  onPageChange(p: number) { this.page = p; this.load(); }
  onLimitChange(l: number) { this.limit = l; this.page = 1; this.load(); }
}
```

---

## 6. Luna Form Pattern

All form pages MUST follow this exact HTML structure. Global styles live in `src/styles/_forms.scss`.

### 6.1 Document Form (purchase-orders, sale-invoices, etc.)

Uses `DocumentFormHeaderComponent` + `DocumentActionBarComponent`:

```html
<div class="form-page">
  <app-document-form-header (back)="goBack()">
    <h2 formTitle>
      @if (isEditing) { Editar documento } @else { Nuevo documento }
    </h2>
    @if (hasChanges) {
      <span formStatus class="dirty-badge">Sin guardar</span>
    }
  </app-document-form-header>

  @if (isLoading) {
    <div class="info-banner"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>
  }

  <form [formGroup]="form" (ngSubmit)="save()" class="form-body" novalidate>
    <div class="form-section">
      <h3 class="section-title">Información general</h3>

      <div class="form-row-3">
        <div class="form-field">
          <label>Partner <span class="required">*</span></label>
          <app-partner-selector
            formControlName="partnerId"
            filterType="SUPPLIER"
            placeholder="Buscar partner…"
          ></app-partner-selector>
        </div>

        <div class="form-field">
          <label for="f-date">Fecha</label>
          <input id="f-date" type="date" formControlName="date" />
        </div>

        <div class="form-field">
          <label>Almacén</label>
          <app-warehouse-selector
            formControlName="warehouseId"
            [warehouses]="warehouses"
            placeholder="— Sin almacén —"
          ></app-warehouse-selector>
        </div>
      </div>
    </div>
  </form>

  <app-document-action-bar (back)="goBack()">
    <luna-button
      variant="primary"
      [text]="isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear'"
      [disabled]="form.invalid || isSaving || !hasChanges"
      [loading]="isSaving"
      (lunaClick)="save()"
    ></luna-button>
  </app-document-action-bar>
</div>
```

### 6.2 Master-Data Form (items, partners, warehouses, tax-indicators)

Master-data forms share the same shell but often use tabs (`app-document-header-tabs`) for complex entities. They do NOT use `DocumentFormBase` (that is only for commercial documents with header+lines+accounting).

```html
<div class="form-page">
  <app-document-form-header (back)="goBack()">
    <h2 formTitle>{{ isEditing ? 'Editar Artículo' : 'Nuevo Artículo' }}</h2>
    @if (hasChanges) {
      <span formStatus class="dirty-badge">Sin guardar</span>
    }
  </app-document-form-header>

  @if (catalogsLoading || isLoading) {
    <div class="info-banner info-neutral">
      <i class="fas fa-spinner fa-spin"></i> Cargando…
    </div>
  }

  <form [formGroup]="form" (ngSubmit)="save()" class="form-body" novalidate>
    <!-- Sections with form-row / form-row-2 / form-row-3 / form-row-4 -->
    <div class="form-section">
      <h3 class="section-title">Identificación</h3>
      <div class="form-row-3">
        <div class="form-field">
          <label class="required">Nombre</label>
          <input type="text" formControlName="name" />
        </div>
        <!-- more fields… -->
      </div>
    </div>
  </form>

  <app-document-action-bar (back)="goBack()">
    <luna-button
      variant="primary"
      [loading]="isSaving"
      [disabled]="form.invalid || isSaving || !hasChanges"
      (lunaClick)="save()"
    >
      {{ isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear' }}
    </luna-button>
  </app-document-action-bar>
</div>
```

### 6.3 Dirty tracking (required for all forms)

```typescript
export class MyFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private svc = inject(MyService);
  protected cdr = inject(ChangeDetectorRef);

  form = this.fb.group({ /* … */ });
  isEditing = false;
  isLoading = false;
  isSaving = false;
  hasChanges = false;
  private initialValues: any = null;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEditing = !!id && id !== 'new';

    forkJoin({
      warehouses: this.whSvc.getAll(),
      // … other catalogs
    }).subscribe(({ warehouses }) => {
      this.warehouses = warehouses;
      if (!this.isEditing) {
        this.isLoading = false;
        this.initialValues = this.form.getRawValue();
        this.hasChanges = false;
      } else {
        this.svc.getOne(+id!).subscribe((doc) => {
          this.form.patchValue(doc);
          this.initialValues = this.form.getRawValue();
          this.hasChanges = false;
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      }
      this.cdr.markForCheck();
    });

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasChanges = this.checkDirty();
        this.cdr.markForCheck();
      });
  }

  private checkDirty(): boolean {
    if (!this.isEditing) return true;
    return JSON.stringify(this.form.getRawValue()) !== JSON.stringify(this.initialValues);
  }
}
```

### 6.4 Key CSS classes for forms

| Class | Purpose |
|---|---|
| `.form-page` | Wrapper with padding for fixed header + action-bar |
| `.form-section` | White card with border, padding, shadow |
| `.section-title` | Uppercase muted label with bottom border |
| `.form-row` | 2-column grid (1 col on mobile) |
| `.form-row-2` | 2-column grid |
| `.form-row-3` | 3-column grid (2 on tablet, 1 on mobile) |
| `.form-row-4` | 4-column grid (2 on tablet, 1 on mobile) |
| `.form-field` | Flex column with label + input + error/hint |
| `.field-error` | Red error text below input |
| `.field-error-input` | Red border on invalid input |
| `.field-hint` | Muted helper text below input |
| `.field-dirty` | Optional: highlights modified fields (used in item-form) |
| `.readonly-value` | **Deprecated** — use `<app-item-selector [readonly]="true">` or equivalent instead |
| `.action-bar` | Fixed bottom bar (provided by `DocumentActionBarComponent`) |

---

## 7. Form with Lines (FormArray + luna-data-table)

Used for BOMs, document lines, price-list items, payment-term lines, etc.

> **NEVER** use raw HTML `<table>` for editable form lines. Always use `<luna-data-table [formArray]="linesArray">`. Raw tables bypass the design system, break responsive behaviour, and require manual styling that drifts from the canonical look.

**TS pattern:**

```typescript
form = this.fb.group({
  kitId: [null as number | null, Validators.required],
  lines: this.fb.array<FormGroup>([]),
});

get linesArray(): FormArray {
  return this.form.get('lines') as FormArray;
}

// Prefer a typed helper that returns FormGroup
private buildLineGroup(bom?: ItemBom): FormGroup {
  return this.fb.group({
    childItemId: [bom?.childItemId ?? null, Validators.required],
    quantity: [bom?.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
    uomId: [bom?.uomId ?? null],
  });
}

addLine() {
  this.linesArray.push(this.buildLineGroup());
  this.hasChanges = this.checkDirty();
}

removeLine(index: number) {
  this.linesArray.removeAt(index);
  this.hasChanges = this.checkDirty();
}
```

**Column definition:**

```typescript
detailColumns: LunaColumn[] = [
  { key: 'childItemId', label: 'Componente', width: '40%', type: 'custom' },
  { key: 'quantity',    label: 'Cantidad',   width: '20%', align: 'right', type: 'custom' },
  { key: 'uomId',       label: 'UOM',        width: '25%', type: 'custom' },
  { key: 'actions',     label: '',           width: '15%', type: 'actions', align: 'center' },
];
```

**HTML pattern:**

```html
<div class="form-section">
  <!-- Header: title + add-line button on the same row -->
  <div class="section-header">
    <h3 class="section-title">Líneas</h3>
    <luna-button
      variant="secondary"
      size="sm"
      text="+ Agregar línea"
      (lunaClick)="addLine()"
    ></luna-button>
  </div>

  @if (linesArray.length === 0) {
    <div class="empty-state">
      <p>No hay líneas. Haz clic en "Agregar línea" para comenzar.</p>
    </div>
  }

  <luna-data-table
    [formArray]="linesArray"
    [columns]="detailColumns"
    tableKey="my-form-lines"
    [showPaginator]="false"
    [trackByIndex]="true"
    [sortable]="false"
  >
    <ng-template #cell let-row let-column="column" let-index="index">
      @switch (column.key) {
        @case ('itemId') {
          <app-item-selector
            [formControl]="$any(row.get('itemId'))"
            [items]="items"
            placeholder="Seleccionar artículo…"
            [compact]="true"
            (itemSelected)="onItemSelectedForLine(index, $event)"
          ></app-item-selector>
        }
        @case ('quantity') {
          <input
            type="number"
            step="0.001"
            min="0.001"
            [formControl]="$any(row.get('quantity'))"
          />
        }
        @case ('uomId') {
          <app-uom-selector
            [formControl]="$any(row.get('uomId'))"
            placeholder="— UOM —"
            [compact]="true"
          ></app-uom-selector>
        }
      }
    </ng-template>

    <ng-template #actions let-row let-index="index">
      <luna-button
        variant="destructive"
        text="×"
        size="sm"
        (lunaClick)="removeLine(index)"
      ></luna-button>
    </ng-template>
  </luna-data-table>
</div>
```

**Critical rules for line tables:**
- **Never use raw `<table>`** for editable lines. Always use `luna-data-table` with `[formArray]`.
- The **"Add line" button** MUST be a `luna-button` with `variant="secondary" size="sm"`, placed inside `.section-header` next to the title. It MUST use the `[text]` input (projected content works but `[text]` guarantees correct `.luna-btn__text` styling).
- Every column that renders custom controls MUST have `type: 'custom'` in the column definition.
- `type: 'actions'` MUST use a separate `#actions` template (do NOT mix actions inside `#cell`).
- Column `label` values MUST be human-readable (e.g. "Nº cuota", "Plazo (días)", "Porcentaje", "Descuento (%)"). Avoid abbreviations like `#`, `%`, `Días` — they confuse users and look unprofessional.
- When you rename columns, change `tableKey` to a new value so the old localStorage column config does not override your new labels.
- Selectors inside line tables MUST use `[compact]="true"`.
- Use `$any(row.get('field'))` when binding `formControl` inside templates to satisfy strict TypeScript.
- Inputs inside `#cell` do **not** need manual CSS classes; `luna-data-table` already styles `input[type='number']`, `input[type='text']` and `select` inside cells when the table lives inside `.form-section`.

---

## 8. Luna Components API

### `luna-button`

```html
<luna-button
  variant="primary | secondary | tertiary | ghost | destructive | link"
  size="sm | md | lg"
  text="Label"
  [loading]="false"
  [disabled]="false"
  [icon]="true"
  [action]="'edit' | 'delete' | 'view' | 'statement' | ..."
  (lunaClick)="handler($event)"
></luna-button>
```

- For **icon-only** buttons: set `[icon]="true"` and `text=""`, then project `<i class="fas fa-star"></i>` inside.
- For **action shortcuts**: use `action="edit"` which renders a predefined icon + title.
- **Standard list actions**: `action="edit"` + `variant="secondary"`, `action="delete"` + `variant="destructive"`.

### `luna-data-table`

```html
<luna-data-table
  [data]="rows"
  [columns]="columns"
  tableKey="unique-key"
  [columnReorderable]="true"
  [columnVisibilityToggle]="true"
  [loading]="false"
  density="compact | comfortable"
  emptyTitle="Sin datos"
  emptyDescription="No hay registros."
  emptyActionLabel="Crear la primera"
  (emptyAction)="goNew()"
  (rowClick)="edit($event)"
>
  <ng-template #actions let-row>
    <!-- Row action buttons inside <div class="actions"> -->
  </ng-template>
</luna-data-table>
```

**Column types:**

| Type | Behavior |
|---|---|
| `text` (default) | Plain text rendering |
| `number` | Right-aligned, formatted via `format` fn |
| `date` | Formatted date via `format` fn |
| `badge` | Renders a colored badge via `badgeVariant` fn |
| `custom` | Delegates to `#cell` template |
| `actions` | Delegates to `#actions` template |

### `luna-modal`

```html
<luna-modal [open]="modalOpen" (closed)="closeModal()" size="sm | md | lg | xl">
  <div lunaModalHeader><h3 class="modal-title">Título</h3></div>
  <div lunaModalBody>Contenido…</div>
  <div lunaModalFooter>
    <luna-button variant="ghost" text="Cancelar" (lunaClick)="closeModal()"></luna-button>
    <luna-button variant="primary" text="Guardar" (lunaClick)="save()"></luna-button>
  </div>
</luna-modal>
```

Use modals for **bulk actions**, **confirmations**, or **sub-forms** that don't need their own route.

### `app-paginator`

```html
<app-paginator
  [page]="page"
  [limit]="limit"
  [total]="total"
  [totalPages]="totalPages"
  (pageChange)="onPageChange($event)"
  (limitChange)="onLimitChange($event)"
></app-paginator>
```

---

## 9. Standard Selectors API

All selectors are `standalone: true`, implement `ControlValueAccessor`, and emit the full selected object via `@Output`.

### `app-item-selector`

```html
<app-item-selector
  formControlName="itemId"
  [items]="items"
  placeholder="Seleccionar artículo…"
  title="Seleccionar artículo"
  [compact]="false"
  [readonly]="false"
  (itemSelected)="onItemSelected($event)"
></app-item-selector>
```

- Use `[readonly]="true"` for displaying a selected item without allowing changes.
- In line tables: `[compact]="true"`.

### `app-uom-selector`

```html
<app-uom-selector
  formControlName="uomId"
  placeholder="— Sin unidad —"
  [compact]="false"
  (uomSelected)="onUomSelected($event)"
></app-uom-selector>
```

### `app-warehouse-selector`

```html
<app-warehouse-selector
  formControlName="warehouseId"
  [warehouses]="warehouses"
  placeholder="— Sin almacén —"
  title="Seleccionar almacén"
  [compact]="false"
  [readonly]="false"
  (warehouseSelected)="onWarehouseSelected($event)"
></app-warehouse-selector>
```

### `app-partner-selector`

```html
<app-partner-selector
  formControlName="partnerId"
  filterType="SUPPLIER"
  placeholder="Buscar partner…"
  title="Seleccionar partner"
  [readonly]="false"
  [showViewButton]="false"
  mode="auto"
  (partnerSelected)="onPartnerSelected($event)"
  (viewPartner)="goToPartnerDetail($event)"
></app-partner-selector>
```

### `app-tax-indicator-selector`

```html
<app-tax-indicator-selector
  formControlName="taxIndicatorId"
  [indicators]="taxIndicators"
  placeholder="— Sin impuesto —"
  [allowNone]="true"
  [compact]="false"
  (indicatorSelected)="onIndicatorSelected($event)"
></app-tax-indicator-selector>
```

### `app-enum-selector`

```html
<app-enum-selector
  formControlName="role"
  [options]="[{ value: 'ADMIN', label: 'Administrador' }, …]"
  placeholder="— Seleccionar —"
  [allowNull]="false"
  (optionSelected)="onOptionSelected($event)"
></app-enum-selector>
```

### Other selectors

| Component | Key inputs |
|---|---|
| `app-item-group-selector` | `[itemGroups]`, `placeholder`, `(itemGroupSelected)` |
| `app-price-list-selector` | `[priceLists]`, `placeholder`, `title`, `[compact]`, `(priceListSelected)` |
| `app-payment-term-selector` | `(termSelected)` |
| `app-sales-person-selector` | `(personSelected)` |
| `app-bank-selector` | `[banks]`, `placeholder`, `title`, `[compact]`, `(bankSelected)` |
| `app-currency-selector` | `[currencies]` |

---

## 10. Shared components (reuse before building)

Before creating a new UI control, check if one of these already exists in `src/app/shared/`:

| Component | Purpose | How to use |
|---|---|---|
| `PartnerSelectorComponent` | Select partner with search modal | `<app-partner-selector formControlName="partnerId" [partnerType]="'SUPPLIER'" />` |
| `ItemSelectorComponent` | Select item with search modal | `<app-item-selector formControlName="itemId" [items]="items" />` |
| `UomSelectorComponent` | Select unit of measure | `<app-uom-selector formControlName="uomId" />` |
| `WarehouseSelectorComponent` | Select warehouse | `<app-warehouse-selector formControlName="warehouseId" />` |
| `TaxIndicatorSelectorComponent` | Select tax indicator | `<app-tax-indicator-selector formControlName="taxIndicatorId" />` |
| `CurrencySelectorComponent` | Select currency ISO code | `<app-currency-selector formControlName="currency" [currencies]="list" />` |
| `PaginatorComponent` | Pagination controls | `<app-paginator [page]="page" ... (pageChange)="onPageChange($event)" />` |
| `DocumentFlowMapComponent` | Show document traceability | `<app-document-flow-map [docId]="id" [docType]="'SALES_QUOTATION'" />` |
| `DocumentFormHeaderComponent` | Fixed form header with back button | `<app-document-form-header (back)="goBack()"><h2 formTitle>Título</h2></app-document-form-header>` |
| `DocumentActionBarComponent` | Fixed bottom action bar | `<app-document-action-bar (back)="goBack()"><luna-button …/></app-document-action-bar>` |
| `DocumentHeaderTabsComponent` | Tabbed form sections (master data) | `<app-document-header-tabs [(activeTab)]="tab" [config]="tabsConfig">…</app-document-header-tabs>` |
| `EnumSelectorComponent` | Select from static options | `<app-enum-selector formControlName="role" [options]="[{value, label}]" />` |

All shared components are `standalone: true` and implement `ControlValueAccessor` where they act as form controls.

---

## 11. RxJS patterns

### Search debounce (list pages)

```typescript
private searchSubject = new Subject<string>();
private destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.searchSubject.pipe(
    debounceTime(350),
    distinctUntilChanged(),
    takeUntilDestroyed(this.destroyRef),
  ).subscribe(() => {
    this.page = 1;
    this.load();
  });
  this.load();
}

onSearch(value: string) {
  this.search = value;
  this.searchSubject.next(value);
}
```

### Parallel catalog loading (form pages)

```typescript
ngOnInit(): void {
  forkJoin({
    partners: this.partnersService.getAll(),
    warehouses: this.warehousesService.getAll(),
    taxIndicators: this.taxIndicatorsService.getAll(),
    doc: this.route.paramMap.pipe(
      switchMap(p => {
        const id = p.get('id');
        return id && id !== 'new' ? this.service.getOne(+id) : of(null);
      }),
    ),
  }).subscribe({
    next: ({ partners, warehouses, taxIndicators, doc }) => {
      this.partners = partners;
      this.warehouses = warehouses;
      this.taxIndicators = taxIndicators;
      if (doc) this.patchForm(doc);
    },
    error: (err) => { /* handled by httpErrorInterceptor */ },
  });
}
```

---

## 12. Signals (local state only)

Use Angular Signals for simple local UI state when RxJS is overkill:

```typescript
readonly loading = signal(false);
readonly rowMenuId = signal<number | null>(null);
```

The project does **not** use a global store (no NgRx). Keep state in services with `BehaviorSubject` only when truly shared across components.

---

## 13. Path aliases (optional improvement)

The project currently uses relative imports. If you add path aliases to `tsconfig.json`, prefer:

```json
"paths": {
  "@models/*": ["src/app/models/*"],
  "@core/*":   ["src/app/core/*"],
  "@shared/*": ["src/app/shared/*"],
  "@auth/*":   ["src/app/auth/*"],
  "@pages/*":  ["src/app/pages/*"]
}
```

Until aliases are added, use **relative paths** following existing conventions (`../../models/...`, `../../shared/...`).

---

## 14. Testing pattern (Karma + Jasmine)

Mock `HttpClient` with `HttpClientTestingModule` or manual mocks. See `references/testing-recipes.md` for complete templates.

---

## 15. Sidebar navigation

New pages must be registered in the sidebar. The current sidebar is hardcoded in `src/app/core/layout/sidebar/`. Consider extracting route config to a `sidebar.config.ts` array as an improvement.

---

## References

- **Boilerplate page template**: See `references/module-template.md` for copy-paste list component, form component, service, and route registration.
- **Testing recipes**: See `references/testing-recipes.md` for component and service test patterns with Karma/Jasmine.
- **Shared component patterns**: See `references/shared-patterns.md` for reusable patterns using existing shared components.
