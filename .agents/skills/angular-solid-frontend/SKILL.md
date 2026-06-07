---
name: angular-erp-frontend
description: Scaffold and maintain Angular frontend pages for an ERP system using the Luna design system. Use when building new pages, forms, services, models, or tests in the erp-frontend project. Covers standalone components, Luna list + form page patterns, reactive forms with FormArray for document lines, lazy loading, shared component reuse, RxJS patterns (debounce, forkJoin), Karma/Jasmine testing, and integration with NestJS REST API.
---

# Angular ERP Frontend — Luna Design System

> **Canonical design specification:** For the complete visual design system specification (color philosophy, typography scale, spacing rationale, component anatomy, motion principles, accessibility rules, and ERP-specific patterns), see `DESIGN.md` at the project root. This skill documents the **Angular implementation** of that specification — what is actually built, file locations, code patterns, and divergences from the canonical spec.
>
> **How to use both together:** When asked to "standardize design" or "make it look like Luna", apply this skill first for the Angular/SCSS implementation details, then cross-check against `DESIGN.md` for visual correctness. If `DESIGN.md` and the codebase disagree, the **codebase wins** (document the divergence here).

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

## Design System Tokens

The project uses a **unified token system** that converges legacy app tokens with Luna component tokens. Both are defined in `src/styles/_tokens.scss` (canonical) and aliased in `src/styles.scss` (legacy compatibility).

### Legacy tokens (use in `pages/` and non-Luna `shared/`)

```scss
// Colors
--color-primary: #2563eb; --color-primary-hover: #1d4ed8;
--color-primary-bg: #eff6ff; --color-primary-border: #bfdbfe;
--color-success: #10b981; --color-warning: #b45309;
--color-danger: #ef4444; --color-cost: #7c3aed;

// Surfaces
--bg-page: #f8fafc; --bg-surface: #ffffff;
--bg-subtle: #f1f5f9; --bg-faint: #f8fafc;

// Text
--text-heading: #1e293b; --text-body: #334155;
--text-muted: #64748b; --text-faint: #6b7280;

// Borders & radius
--border-color: #e2e8f0; --border-soft: #f1f5f9;
--radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 14px;

// Typography legacy aliases
--fs-xxs: var(--text-2xs); // 10px
--fs-xs: 11px;
--fs-sm: var(--text-xs);   // 12px
--fs-base: var(--text-sm); // 13px
--fs-md: var(--text-base); // 14px
--fs-lg: var(--text-md);   // 16px
--fs-xl: var(--text-lg);   // 18px
--fw-normal: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700;

// Shadows
--shadow-sm: 0 1px 4px rgba(0,0,0,0.07);
--shadow-md: 0 4px 14px rgba(0,0,0,0.08);
--shadow-modal: 0 20px 60px rgba(0,0,0,0.18);
--transition: var(--transition-fast); // 150ms ease-out
```

### Luna tokens (use in `shared/luna/` components)

```scss
// Primitives
--neutral-0 … --neutral-950   // Slate scale
--accent-50 … --accent-950    // Indigo scale
--success-50 … --success-950
--warning-50 … --warning-950
--error-50 … --error-950
--info-50 … --info-950

// Semantic backgrounds
--bg-base: var(--neutral-0);
--bg-elevated: var(--neutral-50);
--bg-surface: var(--neutral-100);
--bg-hover: var(--neutral-100);
--bg-active: var(--neutral-200);
--bg-selected: var(--accent-50);

// Semantic text
--text-primary: var(--neutral-900);
--text-secondary: var(--neutral-500);
--text-tertiary: var(--neutral-400);
--text-accent: var(--accent-600);
--text-inverse: var(--neutral-0);

// Semantic borders
--border-default: var(--neutral-200);
--border-subtle: var(--neutral-100);
--border-strong: var(--neutral-300);
--border-accent: var(--accent-300);
--border-focus: var(--accent-500);

// Spacing
--space-0: 0px; --space-1: 4px; --space-2: 8px; --space-3: 12px;
--space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px;

// Typography
--text-2xs: 10px; --text-xs: 12px; --text-sm: 13px; --text-base: 14px;
--text-md: 16px; --text-lg: 18px; --text-xl: 20px; --text-2xl: 24px;

// Transitions
--transition-fast: 150ms ease-out;
--transition-base: 200ms cubic-bezier(0.16, 1, 0.3, 1);
--transition-slow: 300ms cubic-bezier(0.16, 1, 0.3, 1);
```

### Critical rules
- Files in `shared/luna/` → **ONLY Luna tokens** (`--accent-*`, `--neutral-*`, `--space-*`, etc.).
- Files in `pages/` or non-Luna `shared/` → **Legacy tokens** (`--color-primary`, `--fs-sm`, etc.).
- Never mix both token systems in the same SCSS block.
- If you add a new token, always add its `[data-theme='dark']` override.
- Never use `@media (prefers-color-scheme: dark)`. Use `[data-theme='dark']` to respect the user's saved preference.

### Compatibility aliases (backward-compatible)
```scss
--luna-bg-base: var(--bg-base);
--luna-bg-surface: var(--bg-surface);
--luna-text-primary: var(--text-primary);
--luna-border-default: var(--border-default);
--luna-shadow-sm: var(--shadow-sm);
--surface: var(--bg-surface);
--border: var(--border-color);
--primary: var(--color-primary);
```

---

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

**Key rules for header action buttons:**
- Every primary CTA button inside `.page-header` (e.g. "+ Nuevo", "Restaurar Defaults") MUST use `size="sm"`.
- Secondary/auxiliary buttons in the same header MAY use `size="sm"` for consistency but it is not strictly required.
- The `size="sm"` attribute yields a 28px-tall button that visually pairs correctly with the 32px search inputs and filter bars.

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

Master-data forms share the same shell. They use stacked `.form-section` cards for complex entities (see §6.7 for the rare cases that need tabs). They do NOT use `DocumentFormBase` (that is only for commercial documents with header+lines+accounting).

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
| `.field-value` | Read-only value in detail views: semibold, bordered-bottom, prominent |
| `.detail-grid` | Auto-fill grid for summary cards (260px min, responsive) |
| `.detail-grid-2` | 2-column detail grid (1 col on mobile) |
| `.summary-block` | Highlighted card for key totals/quantities in detail views |
| `.info-chip` | Inline badge for status/metadata in detail views |
| `.action-bar` | Fixed bottom bar (provided by `DocumentActionBarComponent`) |

---

## 6.5 Settings / Configuration Form

Configuration pages (e.g. **Parametrización del sistema**) do **NOT** use `DocumentFormHeaderComponent` or `DocumentActionBarComponent`. They follow a lighter card-based layout because they edit key-value settings, not business documents.

**HTML structure:**

```html
<div class="form-page">
  <!-- Custom header (no DocumentFormHeaderComponent) -->
  <div class="form-header">
    <div class="form-title-group">
      <luna-button variant="ghost" size="sm" (lunaClick)="close()">
        <i class="fas fa-arrow-left"></i> Volver
      </luna-button>
      <h2>Parametrización del sistema</h2>
    </div>
  </div>

  @if (isLoading) {
    <div class="info-banner info-neutral">Cargando configuración…</div>
  }

  @if (!isLoading) {
    <form [formGroup]="form" class="form-body">
      <!-- Group related settings in luna-card sections -->
      <luna-card title="Moneda" shadow="sm">
        <p class="settings-desc">Descripción de la sección.</p>
        <div class="form-row">
          <div class="form-field">
            <label>Moneda base</label>
            <app-currency-selector
              formControlName="baseCurrency"
              [currencies]="availableCurrencies"
              placeholder="— Seleccionar moneda —"
            ></app-currency-selector>
            <span class="field-hint">Moneda principal para reportes.</span>
          </div>
        </div>
      </luna-card>

      <!-- Boolean toggles use .toggle-row (styled in _forms.scss) -->
      <luna-card title="Política de stock" shadow="sm">
        <label
          class="toggle-row"
          [class.toggle-row--active]="form.get('enableBatchTracking')?.value"
        >
          <div class="toggle-content">
            <span class="toggle-label">Trazabilidad por lotes</span>
            <span class="toggle-hint">Descripción del efecto.</span>
          </div>
          <div class="toggle-wrap">
            <input
              type="checkbox"
              id="batchToggle"
              class="toggle-input"
              formControlName="enableBatchTracking"
            />
            <label class="toggle-switch" for="batchToggle"></label>
          </div>
        </label>
      </luna-card>

      <!-- Conditional action bar -->
      <div class="action-bar">
        @if (isDirty) {
          <luna-button
            variant="primary"
            size="md"
            [text]="isSaving ? 'Guardando…' : 'Guardar cambios'"
            [loading]="isSaving"
            (lunaClick)="save()"
          ></luna-button>
        }
        @if (!isDirty) {
          <luna-button variant="ghost" size="md" text="OK" (lunaClick)="close()"></luna-button>
        }
      </div>
    </form>
  }
</div>
```

**TS pattern:**

```typescript
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(SettingsService);
  protected cdr = inject(ChangeDetectorRef);

  isLoading = true;
  isSaving = false;
  isDirty = false;

  form = this.fb.group({
    baseCurrency: this.fb.nonNullable.control('BOB'),
    enableBatchTracking: this.fb.nonNullable.control(false),
    // … more controls
  });

  private _original: AppSettings = {
    baseCurrency: 'BOB',
    enableBatchTracking: false,
  };

  ngOnInit() {
    this.svc.load().subscribe({
      next: (s) => {
        this._original = { ...s };
        this.form.patchValue(s, { emitEvent: false });
        this.isLoading = false;
        this.cdr.markForCheck();

        this.form.valueChanges
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.checkDirty());
      },
    });

    this.loadAlertRules();
    this.loadApprovalRules();
  }

  private loadAlertRules() {
    this.alertRulesLoading = true;
    this.alertsSvc.getRules().subscribe({
      next: (rules) => {
        this.alertRules = rules;
        this.alertRulesLoading = false;
        this.cdr.markForCheck(); // ✅ required with OnPush
      },
      error: () => {
        this.alertRulesLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private checkDirty() {
    const raw = this.form.getRawValue();
    this.isDirty =
      raw.baseCurrency !== this._original.baseCurrency ||
      raw.enableBatchTracking !== this._original.enableBatchTracking;
    this.cdr.markForCheck();
  }

  save() {
    if (!this.isDirty) return;
    this.isSaving = true;
    this.svc.save(this.form.getRawValue()).subscribe({
      next: (s) => {
        this._original = { ...s };
        this.isDirty = false;
        this.isSaving = false;
        this.cdr.markForCheck();
      },
      error: () => { this.isSaving = false; },
    });
  }
}
```

**Key differences from Document Form:**
- Uses `luna-card` (not `.form-section`) to group related settings visually.
- Action bar is conditional: **Save** only appears when dirty; **OK** appears when clean.
- Dirty tracking compares scalar fields individually against `_original` (not `JSON.stringify`), because settings objects are flat.
- Toggles MUST use the `.toggle-row` / `.toggle-input` / `.toggle-switch` CSS pattern for consistent switch styling.
- NEVER add `useSinTaxCalculation` or other tax-calculation globals here; tax behavior is driven by **Tax Indicators** per line.

---

## 6.6 Permissions Matrix Form

Used for the **Permisos por Rol** page. It is a special case of the Settings Form that edits a nested permission matrix (`role → module → actions[]`).

**TS pattern:**

```typescript
export class PermissionsComponent implements OnInit {
  private svc = inject(PermissionsService);
  protected cdr = inject(ChangeDetectorRef);

  modules = PERMISSION_MODULES; // canonical module list
  actions = PERMISSION_ACTIONS; // view, create, edit, delete, confirm, cancel, export
  groups = [...new Set(PERMISSION_MODULES.map((m) => m.group))];

  config: PermissionConfig = {};
  private _original: PermissionConfig = {};
  loading = false;
  saving = false;
  isDirty = false;
  activeRole = 'USER';

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.getConfig().subscribe({
      next: (cfg) => {
        this.config = cfg;
        this._original = JSON.parse(JSON.stringify(cfg));
        this.isDirty = false;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggle(role: string, module: string, action: string) {
    if (!this.config[role]) this.config[role] = {};
    if (!this.config[role][module]) this.config[role][module] = [];
    const perms = this.config[role][module];
    const idx = perms.indexOf(action);
    idx >= 0 ? perms.splice(idx, 1) : perms.push(action);
    this.checkDirty();
  }

  private checkDirty() {
    this.isDirty = JSON.stringify(this.config) !== JSON.stringify(this._original);
    this.cdr.markForCheck();
  }

  save() {
    if (!this.isDirty) return;
    this.saving = true;
    this.svc.saveConfig(this.config).subscribe({
      next: () => {
        this._original = JSON.parse(JSON.stringify(this.config));
        this.isDirty = false;
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }
}
```

**HTML structure:**

```html
<div class="form-page">
  <div class="form-header">
    <div class="form-title-group">
      <luna-button variant="ghost" size="sm" (lunaClick)="goBack()">
        <i class="fas fa-arrow-left"></i> Volver
      </luna-button>
      <h2>Permisos por Rol</h2>
    </div>
  </div>

  @if (loading) {
    <div class="info-banner info-neutral">Cargando…</div>
  }

  @if (!loading) {
    <!-- Role tabs -->
    <div class="filter-bar">
      <div class="tab-switcher">
        <luna-button
          [variant]="activeRole === 'ADMIN' ? 'primary' : 'tertiary'"
          size="sm"
          text="Administrador (ADMIN)"
          (lunaClick)="activeRole = 'ADMIN'"
        ></luna-button>
        <luna-button
          [variant]="activeRole === 'USER' ? 'primary' : 'tertiary'"
          size="sm"
          text="Usuario (USER)"
          (lunaClick)="activeRole = 'USER'"
        ></luna-button>
      </div>
    </div>

    <!-- One card per module group -->
    @for (group of groups; track group) {
      <luna-card [title]="group" shadow="sm">
        <div class="table-scroll-wrap">
          <table class="lines-table permission-table">
            <thead>
              <tr>
                <th class="col-module">Módulo</th>
                @for (a of actions; track a) {
                  <th class="col-action">{{ a.label }}</th>
                }
                <th class="col-all">Todo</th>
              </tr>
            </thead>
            <tbody>
              @for (mod of modulesByGroup(group); track mod) {
                <tr>
                  <td class="col-module">{{ mod.label }}</td>
                  @for (a of actions; track a) {
                    <td class="col-action">
                      <label class="checkbox-cell">
                        <input
                          type="checkbox"
                          [checked]="isAllowed(activeRole, mod.key, a.key)"
                          (change)="toggle(activeRole, mod.key, a.key)"
                        />
                      </label>
                    </td>
                  }
                  <td class="col-all">
                    <label class="checkbox-cell">
                      <input
                        type="checkbox"
                        [checked]="allOn(activeRole, mod.key)"
                        [indeterminate]="someOn(activeRole, mod.key)"
                        (change)="toggleAll(activeRole, mod.key)"
                      />
                    </label>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </luna-card>
    }

    <!-- Conditional action bar -->
    <div class="action-bar">
      @if (isDirty) {
        <luna-button
          variant="primary"
          size="md"
          [text]="saving ? 'Guardando…' : 'Guardar cambios'"
          [loading]="saving"
          (lunaClick)="save()"
        ></luna-button>
      }
      @if (!isDirty) {
        <luna-button variant="ghost" size="md" text="OK" (lunaClick)="goBack()"></luna-button>
      }
    </div>
  }
</div>
```

**Key rules:**
- Uses a **native `<table>`** inside `.table-scroll-wrap` (exception to the "no raw tables" rule because a permission matrix is not a data list).
- Each module group is wrapped in `<luna-card>`.
- The **"Select all"** column uses `[indeterminate]` for the tri-state checkbox.
- Dirty tracking uses `JSON.stringify` because the config object is a nested dictionary.
- Action bar is conditional (same pattern as Settings Form).

**Permission Guard synonym:**
The frontend `permissionGuard` treats `edit` and `update` as synonyms. If a route requires `items:update`, a user with `items:edit` is allowed:

```typescript
// In permission.guard.ts
const [mod, action] = perm.split(':');
if (action === 'edit') return userPerms.includes(`${mod}:update`);
if (action === 'update') return userPerms.includes(`${mod}:edit`);
```

---

## 6.7 Tabs Pattern (Native)

**Use this pattern for ALL tabbed pages except commercial document forms** (those use `DocumentHeaderTabsComponent`).

> **NEVER** use `<mat-tab-group>` from Angular Material. It breaks with SSR hydration, requires `::ng-deep` hacks, and drifts from the Luna design system.

### HTML structure

```html
<!-- Tab bar -->
<div class="tab-bar">
  <div class="tab-switcher">
    <button
      class="tab-btn"
      [class.active]="activeTab === 'general'"
      (click)="setTab('general')"
    >
      <i class="fas fa-clipboard"></i> General
    </button>
    <button
      class="tab-btn"
      [class.active]="activeTab === 'transactions'"
      (click)="setTab('transactions')"
    >
      <i class="fas fa-chart-line"></i> Transacciones
    </button>
    <button
      class="tab-btn"
      [class.active]="activeTab === 'documents'"
      (click)="setTab('documents')"
    >
      <i class="fas fa-file-invoice"></i> Documentos
    </button>
  </div>
</div>

<!-- Tab content -->
@if (activeTab === 'general') {
  <div class="form-body">
    <div class="form-section">…</div>
  </div>
}
@if (activeTab === 'transactions') {
  <div class="form-body">
    <div class="form-section">…</div>
  </div>
}
```

### TypeScript pattern

```typescript
export class MyTabbedComponent {
  activeTab = 'general'; // string key, NOT number index

  setTab(key: string) {
    this.activeTab = key;
  }
}
```

### Dynamic tabs (array-driven)

```html
<div class="tab-bar">
  <div class="tab-switcher">
    @for (cat of categories; track cat.key) {
      <button
        class="tab-btn"
        [class.active]="activeTab === cat.key"
        (click)="setTab(cat.key)"
      >
        {{ cat.label }}
      </button>
    }
  </div>
</div>

@for (cat of categories; track cat.key) {
  @if (activeTab === cat.key) {
    <div class="tab-content">
      <!-- content per tab -->
    </div>
  }
}
```

### Key rules

| Rule | Rationale |
|---|---|
| **Use `string` keys**, not `number` indices | Numbers are fragile when reordering tabs; strings are semantic |
| **Native `<button>` elements**, not Angular Material | No SSR issues, no `::ng-deep`, consistent with Luna |
| **`.tab-bar` + `.tab-switcher` + `.tab-btn`** | Global styles in `src/styles/_tables.scss` and `src/styles/_forms.scss` |
| **No `mat-tab-group` in master-data forms** | Use stacked `.form-section` cards instead (see §6.2) |
| **Conditional content with `@if`**, not `*ngIf` inside `<ng-template>` | Cleaner syntax, no projection overhead |
| **Every tab MUST have an icon** (FontAwesome `<i class="fas fa-…">` or emoji) before the label | Visual alignment across all tabbed pages; icons improve scannability and differentiate tabs from plain buttons |

### Global CSS classes (already styled)

| Class | Location | Purpose |
|---|---|---|
| `.tab-bar` | `_forms.scss` | Wrapper with `margin-bottom: 20px` |
| `.tab-switcher` | `_tables.scss` | Flex container with pill background, `gap: 4px`, `border-radius: 10px` |
| `.tab-btn` | `_tables.scss` | Pill button with hover/active states, responsive padding |
| `.tab-btn.active` | `_tables.scss` | White background, shadow, primary text color |

### When to use what

| Scenario | Use |
|---|---|
| Commercial document form (sales-orders, purchase-invoices, etc.) | `DocumentHeaderTabsComponent` |
| Master-data detail page (partner-detail, account-mappings) | **Native tabs** (this pattern) |
| Master-data edit form (warehouse-form, item-group-form) | **Stacked `.form-section` cards** (no tabs) |
| Settings / configuration page | **Stacked `luna-card` sections** (no tabs) |

### Tab responsive rules

Native tabs (`.tab-bar > .tab-switcher > .tab-btn`) **MUST NOT overflow horizontally** on mobile. Use one of these strategies:

| Strategy | When to use | SCSS pattern |
|---|---|---|
| **`flex-wrap: wrap`** | Many short tabs (≥4) that can stack in 2–3 rows | `.tab-switcher { flex-wrap: wrap; } .tab-btn { flex: 1 1 auto; min-width: 80px; white-space: nowrap; }` |
| **`overflow-x: auto`** | Few tabs (2–3) with long labels, or detail-line tabs | `.tab-switcher { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }` |

**Always** reduce `.tab-btn` padding on mobile (`padding: 8px 10px` or smaller).

**Example — `account-mappings.component.scss`:**
```scss
@media (max-width: bp.$breakpoint-md) {
  .tab-switcher {
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .tab-btn {
    padding: var(--space-1-5) var(--space-3);
    font-size: var(--text-xs);
    white-space: nowrap;
    flex: 1 1 auto;
    min-width: 80px;
    text-align: center;
  }
}
```

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
  variant="primary | secondary | warning | tertiary | ghost | destructive | link"
  size="sm | md | lg"
  text="Label"
  [loading]="false"
  [disabled]="false"
  [icon]="true"
  [action]="'edit' | 'delete' | 'view' | 'statement' | ..."
  (lunaClick)="handler($event)"
></luna-button>
```

- **Variant semantics:**
  - `primary` — Main CTA (indigo).
  - `secondary` — Neutral alternate action (gray). Use for "Edit", "Cancel", or non-destructive secondary actions.
  - `warning` — Explicit warning action (amber). Reserved for cautionary actions (e.g., "Revert", "Flag").
  - `tertiary` / `ghost` — Low-emphasis actions.
  - `destructive` — Danger action (red).
  - `link` — Inline text link.
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
| `LunaCardComponent` | Card container for settings/permissions sections | `<luna-card title="Moneda" shadow="sm">…</luna-card>` |

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

## 16. Responsive & Mobile

The project has **built-in responsive behavior** via SCSS media queries. When auditing or building pages, verify mobile compliance using the breakpoints below.

### Breakpoints (defined in `src/styles/_breakpoints.scss`)

| Token | Value | Usage |
|-------|-------|-------|
| `$breakpoint-xs` | 480px | Ultra-narrow phones |
| `$breakpoint-sm` | 640px | Phones |
| `$breakpoint-md` | 768px | Tablets |
| `$breakpoint-lg` | 1024px | Small laptops |
| `$breakpoint-xl` | 1280px | Desktops |

### Global responsive behavior (already implemented)

| Element | Desktop | Tablet (≤768px) | Mobile (≤640px) |
|---------|---------|-----------------|-----------------|
| `.page-container` | `padding: 24px` | `padding: 16px 12px` | same |
| `.page-header` | `flex-direction: row` | `flex-direction: column` | same |
| `.form-row` | 2 columns | 1 column | 1 column |
| `.form-row-3` | 3 columns | 2 columns | 1 column |
| `.form-row-4` | 4 columns | 2 columns | 1 column |
| `.form-body` | `padding: 24px` | `padding: 80px 12px 120px` | `padding: 80px 8px 140px` |
| `.action-bar` | sticky bottom | full width, reduced padding | same |
| `luna-data-table` | full table | **card-flip layout** | card-flip |
| `.form-header .back-btn` | visible | **hidden** (action-bar provides back) | hidden |
| `.tab-bar .tab-switcher` | single row | `flex-wrap: wrap` or scroll | `flex-wrap: wrap` or scroll |

### Rules for custom page SCSS

- **Always use the breakpoint tokens** (`bp.$breakpoint-sm`, etc.) — never hardcode pixel values like `@media (max-width: 768px)`.
- **Form pages do NOT need custom mobile styles** — `.form-row-N` grids collapse automatically.
- **List pages do NOT need custom mobile styles** — `luna-data-table` handles card-flip automatically via `_lists.scss`.
- **Custom tables (e.g. price-list lines)** MUST provide their own `@media` rules if they use raw grids instead of `luna-data-table`. Follow the pattern in `price-list-form.component.scss`.
- **Never hide critical actions on mobile** — if a button doesn't fit, use `flex-wrap: wrap` or move it to the action bar.

### Preventing horizontal overflow from long text

The #1 cause of broken mobile layouts is **long text inside flex containers** (selectors, account names, partner names, item descriptions). By default, flex items have `min-width: auto`, which prevents them from shrinking below their content width — causing the entire page to scroll horizontally.

**The fix is always the same chain:**

```scss
// 1. The flex container's child must allow shrinking
.mapping-control {
  flex: 1 1 0%;   // or simply remove flex-shrink: 0
  min-width: 0;
  overflow: hidden;
}

// 2. The text element must truncate
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**Global protections already in place:**
- `.form-field { min-width: 0; }` — every form field can shrink
- `.page-container { min-width: 0; }` — page wrapper prevents blowout
- `.form-page { min-width: 0; }` — form wrapper prevents blowout

**Rule of thumb:** If you add `flex-shrink: 0` to a flex item that contains variable text (selectors, labels, badges), you are creating a mobile overflow bug. Either:
- Remove `flex-shrink: 0` and let the item shrink with `min-width: 0`, or
- Add `max-width: …` or `overflow: hidden` to constrain it.

### Component host display — every Luna component MUST be block-level

Angular standalone components default to the browser's default `display` for custom elements, which is **inline** in many cases. An inline component ignores `width: 100%` and expands to fit its content, breaking grid/flex parents and causing overflow on mobile.

**Every Luna component and shared selector MUST declare:**

```scss
:host {
  display: block;
  width: 100%;
}
```

**Components already fixed:**
- `luna-data-table` — was inline, caused tables to shrink on mobile
- `luna-card` — was inline, caused cards to overflow their grid column
- `app-account-selector` — was inline, caused cards to expand with long account names

**Rule of thumb:** When auditing or creating a new reusable component (especially one that sits inside `.form-field`, grid cells, or flex rows), always add `:host { display: block; width: 100%; }` to its root SCSS file.

### Testing mobile locally

```bash
# Dev server is running on localhost:4200
# Open Chrome DevTools → Toggle Device Toolbar → iPhone SE / Pixel 5
# Or use ng serve with host binding for LAN testing:
npm start -- --host 0.0.0.0
```

---

## 17. SCSS Conventions & Dark Mode

### Naming conventions

**Luna components (`shared/luna/`):**
- Root: `.luna-{name}` (e.g., `.luna-btn`, `.luna-card`)
- Modifiers: `.luna-{name}--{modifier}` (e.g., `.luna-btn--primary`)
- Elements: `.luna-{name}__{element}` (e.g., `.luna-btn__icon`)
- Use BEM strictly. Use **only Luna tokens**.

**Page / non-Luna components:**
- Root: descriptive context class (e.g., `.partner-form`, `.invoice-header`)
- Use **legacy tokens** (`--color-primary`, `--fs-sm`, etc.)

### Dark mode rules

```scss
// ✅ Correct
[data-theme='dark'] .my-component {
  --my-local-var: #dark-value;
}

// ❌ Incorrect — ignores user's saved preference
@media (prefers-color-scheme: dark) { … }
```

All tokens (legacy and Luna) have `[data-theme='dark']` overrides in `src/styles.scss` and `src/styles/_tokens.scss`. If you introduce a new hardcoded color, always add a dark variant.

### OnPush change detection

Components using `ChangeDetectionStrategy.OnPush` **must** call `cdr.markForCheck()` after every async data load in `.subscribe({ next: … })`. Omitting it causes the UI to stay stale until the next DOM event.

```typescript
this.svc.getAll().subscribe({
  next: (res) => {
    this.items = res.data;
    this.cdr.markForCheck(); // ✅ required
  },
  error: () => { this.cdr.markForCheck(); },
});
```

### Checklist before making style changes

- [ ] File is in `shared/luna/`? → Use **Luna tokens**.
 [ ] File is in `pages/` or non-Luna `shared/`? → Use **legacy tokens**.
- [ ] Added a new token? → Add override in `[data-theme='dark']`.
- [ ] Used a hardcoded value (`#2563eb`, `16px`, `0.15s`)? → Replace with token.
- [ ] Component is `OnPush`? → Verify `markForCheck()` in every `next:` handler.
- [ ] Used `@media (prefers-color-scheme: dark)`? → Change to `[data-theme='dark']`.
- [ ] Does the new selector affect colors/shadows? → Add dark-mode variant.

---

## 18. Known Divergences from `DESIGN.md`

The canonical spec lives in `DESIGN.md` at the project root. The following divergences are **intentional** — the codebase has evolved since the spec was written. When auditing a form or page, verify it matches the patterns below, not the raw spec.

### Token values that diverged (codebase wins)

| Token | DESIGN.md value | Actual codebase value | Rationale |
|---|---|---|---|
| `--radius-sm` | `4px` | `6px` | Aligned with legacy app usage |
| `--radius-md` | `6px` | `8px` | Aligned with legacy app usage |
| `--radius-lg` | `8px` | `12px` | Aligned with legacy app usage |
| `--radius-xl` | `12px` | `14px` | Aligned with legacy app usage |
| `--shadow-sm` (light) | `0 1px 2px rgba(16,24,40,0.05)` | `0 1px 4px rgba(0,0,0,0.07)` | More visible, proven in app |
| `--shadow-md` (light) | `0 4px 12px rgba(16,24,40,0.08)` | `0 4px 14px rgba(0,0,0,0.08)` | More visible, proven in app |
| `--shadow-sm` (dark) | `0 1px 2px rgba(0,0,0,0.25)` | `0 1px 4px rgba(0,0,0,0.30)` | Stronger for `#1a1a25` cards |
| `--shadow-md` (dark) | `0 4px 12px rgba(0,0,0,0.35)` | `0 4px 14px rgba(0,0,0,0.40)` | Stronger for dark surfaces |
| `--border-default` (dark) | `neutral-50` | `neutral-200` (`#242433`) | Consistent with semantic mapping |
| `--z-dropdown` | `40` | `200` | Prevents dropdown clipping in complex UIs |

### Button variants

- **DESIGN.md** specifies `secondary` as `bg-surface` + `text-primary` (neutral gray).
- **Actual implementation**: `secondary` uses `--neutral-*` scale (gray). A new `warning` variant was added for explicit amber/warning actions. The old amber `secondary` behavior was moved to `warning`.

### Component inventory gap

`DESIGN.md` specifies ~50 components. Only the following are **implemented** in `src/app/shared/luna/`:

| Implemented | Missing (aspirational) |
|---|---|
| `luna-button` | Kanban, Calendar, Chat, Command Palette, Wizard, Stepper, Slider, Color Picker, Tree, FAB, Rich Text Editor, Number Stepper, File Upload, Split Pane, Accordion, Breadcrumb (standalone), Toast (standalone), Notification Center, Comment Thread, Task Monitor, Document Viewer, Duplicate Detection Dialog, Master-Detail Layout (generic), Reorderable List, Data Grid Cell Types, Context Menu, Entity Lookup, Multi-Select, Phone Input, Currency Input |
| `luna-card` | |
| `luna-badge` | |
| `luna-data-table` | |
| `luna-modal` | |
| `luna-empty-state` | |
| `luna-action-icon` | |

**Rule:** Do not build a missing component from `DESIGN.md` unless explicitly requested. Reuse existing shared components or native HTML patterns instead.

### Dark mode implementation

- **DESIGN.md** suggests `dark` class on `<html>` (Tailwind-style).
- **Actual implementation**: `[data-theme='dark']` attribute on `<html>`, managed by `ThemeService`. Always use `[data-theme='dark']` in SCSS, never `.dark` or `@media (prefers-color-scheme: dark)`.

### Typography

- **DESIGN.md** uses Tailwind-style token names (`text-sm`, `text-base`) with a specific mapping.
- **Actual implementation**: Dual system converged. Legacy `--fs-sm` (12px) aliases to `--text-xs` (12px). Legacy `--fs-base` (13px) aliases to `--text-sm` (13px). See §Design System Tokens above for the full mapping.

### Technology stack

- **DESIGN.md** recommends Tailwind CSS + Radix UI + Framer Motion + Lucide icons.
- **Actual implementation**: Angular 19 standalone + SCSS (no Tailwind), FontAwesome (`fas`) icons, native CSS animations. Do not introduce Tailwind or Radix.

### Form field heights

- **DESIGN.md** specifies input height `36px` with padding `8px 12px`.
- **Actual implementation**: Inputs in `.form-field` use `min-height: 40px` with padding `9px 12px` for better touch targets and visual weight. This is the established app standard.

---

## 19. Auditing and Updating Existing Pages

> **Critical rule:** When asked to audit, fix, or update an **existing** page (not create a new one), do NOT apply superficial patches. Verify whether the component already follows the Luna patterns defined in this skill. If it does NOT, rewrite it completely.

### 19.1 How to detect a legacy / non-Luna component

A list page is **legacy** if ANY of the following is true:
- Missing `<div class="page-container">` as the single root wrapper.
- Uses `<h1>` instead of `<h2>` in the page header.
- Header buttons are raw `<button class="btn-primary">` instead of `<luna-button size="sm">`.
- Missing search input with debounce (`searchSubject`, `debounceTime(350)`, `distinctUntilChanged`).
- Missing `info-banner` or filter bar structure.
- `luna-data-table` lacks `tableKey`, `columnReorderable`, `columnVisibilityToggle`, `density`, `emptyTitle`, `emptyDescription`.
- Paginator uses `prev`/`next` outputs instead of `(pageChange)` / `(limitChange)`.
- Action buttons in `#actions` are raw `<button>` or symbols (e.g. `✕`, `✎`) instead of `<luna-button>` inside `<div class="actions">`.
- Uses raw `<table>` for data lists (exception: BOM preview inside forms, document line tables inside form pages, and detail view tabular data are allowed).

A form page is **legacy** if ANY of the following is true:
- Missing `<div class="form-page">` root wrapper.
- Missing `<app-document-form-header>` and `<app-document-action-bar>`.
- Native inputs lack `class="form-input"`.
- Uses raw `<button>` with projected text instead of `<luna-button [text]="...">`.
- Missing `takeUntilDestroyed(this.destroyRef)` on subscriptions.
- Missing `cdr.markForCheck()` in async handlers or `form.valueChanges`.
- Uses inline `style="..."` attributes instead of SCSS classes.

### 19.2 What to do when you find a legacy component

1. **Stop.** Do not change just one button or one input.
2. **Rewrite the template** to match the Luna List Pattern (§5) or Luna Form Pattern (§6) exactly.
3. **Preserve business logic**: columns, service calls, navigation, form fields, validators.
4. **Add missing imports**: `LunaButtonComponent`, `FormsModule`, `Subject`, `debounceTime`, `distinctUntilChanged`, `DestroyRef`, etc.
5. **Update the service** if needed to support search (`search` param in `getAll`).
6. **Verify the build** passes with zero errors before finishing.

### 19.3 Superficial patch anti-pattern (DO NOT DO THIS)

```html
<!-- ❌ WRONG: only replacing one button -->
<div class="page-header">
  <h1>Old Title</h1>
  <luna-button variant="primary" (lunaClick)="goNew()">+ Nuevo</luna-button>
</div>
<button class="btn-icon" (click)="delete($event)">✕</button>

<!-- ✅ CORRECT: full rewrite to Luna List Pattern -->
<div class="page-container">
  <div class="page-header">
    <h2>Title</h2>
    <div class="header-actions">
      <luna-button variant="primary" size="sm" text="+ Nuevo" (lunaClick)="goNew()"></luna-button>
    </div>
  </div>
  <div class="filter-bar">...</div>
  <luna-data-table ...>...</luna-data-table>
</div>
```

---

## References

- **Canonical design spec**: `DESIGN.md` at project root — visual philosophy, complete color system, typography, spacing, motion, accessibility, and ERP patterns.
- **Boilerplate page template**: See `references/module-template.md` for copy-paste list component, form component, service, and route registration.
- **Testing recipes**: See `references/testing-recipes.md` for component and service test patterns with Karma/Jasmine.
- **Shared component patterns**: See `references/shared-patterns.md` for reusable patterns using existing shared components.
