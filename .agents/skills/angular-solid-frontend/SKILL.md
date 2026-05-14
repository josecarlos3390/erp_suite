---
name: angular-erp-frontend
description: Scaffold and maintain Angular frontend pages for an ERP system. Use when building new pages, forms, services, models, or tests in the erp-frontend project. Covers standalone components, list + form page pattern, reactive forms with FormArray for document lines, lazy loading, shared component reuse (partner-selector, item-search-modal, paginator, tax-indicator-selector), RxJS patterns (debounce, forkJoin), Karma/Jasmine testing, and integration with NestJS REST API.
---

# Angular ERP Frontend

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
  - Paginated table, search with debounce, status filters, row action menus.
  - Uses `PaginatorComponent` from `shared/`.

- **`{feature}-form.component.ts`** — Form page (smart/container).
  - Reactive form (`FormBuilder`, `FormArray` for lines).
  - Load catalogs with `forkJoin` in `ngOnInit`.
  - Read-only state when document is `CLOSED` / `CANCELLED`.

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

### 5. Shared components (reuse before building)

Before creating a new UI control, check if one of these already exists in `src/app/shared/`:

| Component | Purpose | How to use |
|---|---|---|
| `PartnerSelectorComponent` | Select partner with search modal | `<app-partner-selector formControlName="partnerId" [partnerType]="'SUPPLIER'" />` |
| `ItemSearchModalComponent` | Search items with filters | Modal trigger + `@Output() itemSelected` |
| `WarehouseSelectorComponent` | Select warehouse | `<app-warehouse-selector formControlName="warehouseId" />` |
| `TaxIndicatorSelectorComponent` | Select tax indicator | `<app-tax-indicator-selector formControlName="taxIndicatorId" />` |
| `PaginatorComponent` | Pagination controls | `<app-paginator [page]="page" ... (pageChange)="onPageChange($event)" />` |
| `DocumentFlowMapComponent` | Show document traceability | `<app-document-flow-map [docId]="id" [docType]="'SALES_QUOTATION'" />` |

All shared components are `standalone: true` and implement `ControlValueAccessor` where they act as form controls.

### 6. Reactive forms with FormArray (document lines)

```typescript
export class PurchaseOrdersFormComponent implements OnInit {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    partnerId: [null as number | null, Validators.required],
    notes: [''],
    warehouseId: [null as number | null],
    items: this.fb.array<FormGroup>([]),
  });

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  addLine(item?: any) {
    const line = this.fb.group({
      itemId: [item?.id ?? null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      price: [item?.price ?? 0, Validators.required],
      discountPct: [0],
      discountAmt: [0],
      warehouseId: [null as number | null],
    });
    this.items.push(line);
  }

  removeLine(index: number) {
    this.items.removeAt(index);
  }
}
```

Recalculate line totals on `valueChanges` or explicit events. Use `calcLineWithIndicator()` from `shared/pricing.util` (mirror of backend logic).

### 7. RxJS patterns

**Search debounce** (list pages):

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

**Parallel catalog loading** (form pages):

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

### 8. Signals (local state only)

Use Angular Signals for simple local UI state when RxJS is overkill:

```typescript
readonly loading = signal(false);
readonly rowMenuId = signal<number | null>(null);
```

The project does **not** use a global store (no NgRx). Keep state in services with `BehaviorSubject` only when truly shared across components.

### 9. Path aliases (optional improvement)

The project currently uses relative imports. If you add path aliases to `tsconfig.json`, prefer:

```json
"paths": {
  "@models/*": ["src/app/models/*"],
  "@core/*":   ["src/app/core/*"],
  "@shared/*": ["src/app/shared/*"],
  "@auth/*":   ["src/app/auth/*"]
}
```

Until aliases are added, use **relative paths** following existing conventions (`../../models/...`, `../../shared/...`).

### 10. Testing pattern (Karma + Jasmine)

Mock `HttpClient` with `HttpClientTestingModule` or manual mocks. See `references/testing-recipes.md` for complete templates.

### 11. Sidebar navigation

New pages must be registered in the sidebar. The current sidebar is hardcoded in `src/app/core/layout/sidebar/`. Consider extracting route config to a `sidebar.config.ts` array as an improvement.

## References

- **Boilerplate page template**: See `references/module-template.md` for copy-paste list component, form component, service, and route registration.
- **Testing recipes**: See `references/testing-recipes.md` for component and service test patterns with Karma/Jasmine.
- **Shared component patterns**: See `references/shared-patterns.md` for reusable patterns using existing shared components.
