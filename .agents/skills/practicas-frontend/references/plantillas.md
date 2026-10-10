# Plantillas (frontend Angular)

Plantillas con **marcadores de posición**. `<app-data-table>`, `<app-form-page>`, `<app-form-section>`,
`<app-form-row>`, `<app-form-field>`, `<app-form-tabs>`, `<app-button>`, `<app-modal>`,
`<app-paginator>`, `<app-empty-state>`, `<app-card>`, `<app-action-icon>`, `<app-entity-selector` **no
existen en tu proyecto**: sustitúyelos por los componentes reales de tu sistema de diseño antes de
copiar. Si alguno no existe, **no lo nombres en el código**: usa lo que haya o construye el mínimo.

---

## Estructura de carpetas

```
src/app/pages/<feature>/
├── <feature>.component.ts          (listado)
├── <feature>.component.html
├── <feature>.component.scss
├── <feature>-form.component.ts     (formulario)
├── <feature>-form.component.html
├── <feature>-form.component.scss
├── <feature>.service.ts
└── <feature>.service.spec.ts
```

`kebab-case` en ficheros y rutas; `PascalCase` en clases. Las pruebas **al lado** del código.

---

## 1. Servicio y tipos

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type OrderStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface OrderQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatus;
}

export interface Order {
  id: number;
  code: string;
  status: OrderStatus;
  partnerId: number;
  partner: { id: number; name: string };
  notes?: string;
  date: string;
  total: number;
  items: OrderLine[];
}

export interface OrderLine {
  id: number;
  itemId: number;
  item: { id: number; name: string };
  quantity: number;
  price: number;
  discountPct: number;
  subtotal: number;
}

/** Cuerpo de creación: el tipo propio del borde con el servidor, no `any`. */
export interface CreateOrderPayload {
  partnerId: number;
  notes?: string;
  date?: string;
  items: Array<{
    itemId: number;
    quantity: number;
    price: number;
    discountPct?: number;
  }>;
}

export type UpdateOrderPayload = Partial<CreateOrderPayload>;

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/orders`;

  getAll(query: OrderQuery = {}) {
    let params = new HttpParams();
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.limit != null) params = params.set('limit', String(query.limit));
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<PaginatedResult<Order>>(this.api, { params });
  }

  getOne(id: number) {
    return this.http.get<Order>(`${this.api}/${id}`);
  }

  create(data: CreateOrderPayload) {
    return this.http.post<Order>(this.api, data);
  }

  update(id: number, data: UpdateOrderPayload) {
    return this.http.patch<Order>(`${this.api}/${id}`, data);
  }

  close(id: number) {
    return this.http.post<Order>(`${this.api}/${id}/close`, {});
  }

  cancel(id: number) {
    return this.http.post<Order>(`${this.api}/${id}/cancel`, {});
  }
}
```

---

## 2. Listado — componente

```typescript
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef,
  OnInit, inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { OrdersService, Order, OrderStatus } from './orders.service';
import { ConfirmDialogService } from '../../core/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [/* componentes reales que use la plantilla */],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent implements OnInit {
  private readonly service = inject(OrdersService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  orders: Order[] = [];
  loading = false;
  processingId: number | null = null;

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;
  search = '';
  statusFilter: OrderStatus | '' = '';

  columns = [
    { key: 'code', label: 'Código' },
    { key: 'partner.name', label: 'Tercero' },
    { key: 'date', label: 'Fecha', type: 'date' as const },
    { key: 'total', label: 'Total', type: 'number' as const, align: 'right' as const },
    { key: 'status', label: 'Estado', type: 'badge' as const },
    { key: 'actions', label: '', type: 'actions' as const },
  ];

  private readonly searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page = 1;
        this.load();
      });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.service
      .getAll({
        page: this.page,
        limit: this.limit,
        search: this.search || undefined,
        status: this.statusFilter || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.orders = result.data;
          this.total = result.total;
          this.totalPages = result.totalPages;
          this.page = result.page;
          this.loading = false;
          this.cdr.markForCheck();          // OnPush: obligatorio
        },
        error: (err: unknown) => {
          this.loading = false;             // también en el camino de error
          this.toast.error(this.messageOf(err));
          this.cdr.markForCheck();
        },
      });
  }

  onSearch(value: string): void {
    this.search = value;
    this.searchSubject.next(value);
  }

  onFilterChange(): void {
    this.page = 1;                          // cualquier filtro vuelve a la página 1
    this.load();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.load();
  }

  onLimitChange(limit: number): void {
    this.limit = limit;
    this.page = 1;
    this.load();
  }

  async closeOrder(id: number): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Cerrar documento',
      message: '¿Confirmas el cierre de este documento?',
    });
    if (!ok) return;

    this.processingId = id;
    this.service
      .close(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.processingId = null;
          this.load();
        },
        error: (err: unknown) => {
          this.processingId = null;
          this.toast.error(this.messageOf(err));
          this.cdr.markForCheck();
        },
      });
  }

  private messageOf(err: unknown): string {
    return (err as { error?: { message?: string } }).error?.message ?? 'Error desconocido';
  }
}
```

Reglas que la plantilla no puede relajar:

- Marcas de verificación en **ambas** ramas del subscribe.
- `takeUntilDestroyed` en toda suscripción que escribe estado.
- Los filtros y la búsqueda vuelven a la página 1.
- El error se tipa `unknown` y se estrecha antes de leerlo.

---

## 3. Listado — plantilla

```html
<div class="page-container">
  <div class="page-header">
    <h1>Órdenes</h1>
    <div class="header-actions">
      <app-button variant="primary" size="sm" (click)="goNew()">
        <app-action-icon action="plus"></app-action-icon>
        + Nueva Orden
      </app-button>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-search">
      <input
        type="search"
        [ngModel]="search"
        (ngModelChange)="onSearch($event)"
        placeholder="Buscar por código o tercero…"
        aria-label="Buscar órdenes"
      />
    </div>
  </div>

  <app-data-table
    [data]="orders"
    [columns]="columns"
    [loading]="loading"
    tableKey="orders-list"
    [columnReorderable]="true"
    [columnVisibilityToggle]="true"
    emptyTitle="Sin órdenes"
    emptyDescription="Aún no hay documentos para mostrar."
    [emptyActionLabel]="search ? '' : 'Crear la primera'"
    (emptyAction)="goNew()"
    (rowClick)="openDetail($event)"
  >
    <ng-template #actions let-item>
      <div class="actions">
        <app-button action="view" variant="secondary"
                    (click)="openDetail(item); $event.stopPropagation()"></app-button>
        <app-button action="edit" variant="secondary"
                    (click)="openEdit(item); $event.stopPropagation()"></app-button>
        <app-button action="delete" variant="destructive"
                    (click)="remove(item); $event.stopPropagation()"></app-button>
      </div>
    </ng-template>
  </app-data-table>

  <app-paginator
    [page]="page"
    [limit]="limit"
    [total]="total"
    [totalPages]="totalPages"
    (pageChange)="onPageChange($event)"
    (limitChange)="onLimitChange($event)"
  ></app-paginator>
</div>
```

---

## 4. Formulario — componente

```typescript
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef,
  OnInit, inject,
} from '@angular/core';
import {
  FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-orders-form',
  standalone: true,
  imports: [ReactiveFormsModule /* + los controles reales */],
  templateUrl: './orders-form.component.html',
  styleUrls: ['./orders-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(OrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  form = this.fb.group({
    partnerId: this.fb.control<number | null>(null, Validators.required),
    notes: this.fb.nonNullable.control(''),
    items: this.fb.array<FormGroup>([]),
  });

  isEditing = false;
  docId: number | null = null;
  status: OrderStatus = 'DRAFT';

  isLoading = false;
  isSaving = false;
  hasChanges = false;
  private initialValues: unknown = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEditing = !!id && id !== 'new';
    this.docId = this.isEditing ? Number(id) : null;

    forkJoin({
      doc: this.isEditing
        ? this.service.getOne(this.docId as number)
        : of(null),
    }).subscribe({
      next: ({ doc }) => {
        if (doc) {
          this.status = doc.status;
          this.form.patchValue(
            { partnerId: doc.partnerId, notes: doc.notes ?? '' },
            { emitEvent: false },                 // no dispara el ciclo sucio
          );
          doc.items.forEach((line) => this.lines.push(this.buildLineGroup(line), { emitEvent: false }));
        }
        this.isLoading = false;
        this.takeSnapshot();
        this.cdr.markForCheck();
      },
      error: () => { this.isLoading = false; this.cdr.markForCheck(); },
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasChanges = this.checkDirty();
        this.cdr.markForCheck();
      });
  }

  get lines(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get isReadOnly(): boolean {
    return this.status === 'CLOSED' || this.status === 'CANCELLED';
  }

  /** El MISMO constructor sirve para hidratar y para añadir a mano. */
  private buildLineGroup(line?: Partial<OrderLine>): FormGroup {
    return this.fb.group({
      itemId: [line?.itemId ?? null, Validators.required],
      quantity: [line?.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
      price: [line?.price ?? 0, [Validators.required, Validators.min(0)]],
      discountPct: [line?.discountPct ?? 0],
    });
  }

  addLine(line?: Partial<OrderLine>): void {
    if (this.isReadOnly) return;
    this.lines.push(this.buildLineGroup(line));
    this.hasChanges = this.checkDirty();
  }

  removeLine(index: number): void {
    if (this.isReadOnly) return;
    this.lines.removeAt(index);
    this.hasChanges = this.checkDirty();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving = true;
    const payload = this.toPayload();
    const request$ =
      this.isEditing && this.docId
        ? this.service.update(this.docId, payload)
        : this.service.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigate(['/orders']);
      },
      error: () => { this.isSaving = false; this.cdr.markForCheck(); },
    });
  }

  canDeactivate(): boolean {
    return !this.hasChanges;
  }

  private takeSnapshot(): void {
    this.initialValues = this.form.getRawValue();
    this.hasChanges = false;
  }

  private checkDirty(): boolean {
    if (!this.isEditing) return true;
    return JSON.stringify(this.form.getRawValue()) !== JSON.stringify(this.initialValues);
  }

  private toPayload(): CreateOrderPayload {
    const raw = this.form.getRawValue();
    return {
      partnerId: raw.partnerId as number,
      notes: raw.notes ?? undefined,
      items: this.lines.controls.map((group) => {
        const value = group.getRawValue();
        return {
          itemId: value.itemId as number,
          quantity: Number(value.quantity),
          price: Number(value.price),
          discountPct: Number(value.discountPct ?? 0),
        };
      }),
    };
  }
}
```

---

## 5. Formulario — plantilla

```html
<app-form-page>
  <app-document-form-header (back)="goBack()">
    <h1 formTitle>{{ isEditing ? 'Orden ' + code : 'Nueva Orden' }}</h1>
    <span formStatus class="status-badge" [class]="'status-' + status.toLowerCase()">
      {{ status }}
    </span>
  </app-document-form-header>

  <form [formGroup]="form" (ngSubmit)="save()" novalidate>
    <app-form-section title="Información general">
      <app-form-row [columns]="4">
        <app-form-field label="Tercero" [required]="true" inputId="order-partner">
          <app-partner-selector
            [id]="'order-partner'"
            formControlName="partnerId"
            [readonly]="isReadOnly"
          ></app-partner-selector>
        </app-form-field>

        <app-form-field label="Fecha" inputId="order-date">
          <input id="order-date" type="date" formControlName="date" />
        </app-form-field>
      </app-form-row>
    </app-form-section>

    <app-form-section title="Líneas">
      <div class="section-header">
        <h2>Líneas</h2>
        <app-button variant="secondary" size="sm" text="+ Agregar línea"
                    [disabled]="isReadOnly" (click)="addLine()"></app-button>
      </div>

      @if (lines.length === 0) {
        <app-empty-state
          icon="box"
          title="Sin líneas"
          description="Añade al menos una línea para poder guardar."
        ></app-empty-state>
      }

      <app-data-table [formArray]="lines" [columns]="lineColumns" [showPaginator]="false">
        <ng-template #cell let-row let-column="column">
          @switch (column.key) {
            @case ('itemId') {
              <app-item-selector [formControl]="$any(row.get('itemId'))" [compact]="true"></app-item-selector>
            }
            @case ('quantity') {
              <input type="number" step="0.001" min="0.001" [formControl]="$any(row.get('quantity'))" />
            }
            @case ('price') {
              <input type="number" step="0.01" min="0" [formControl]="$any(row.get('price'))" />
            }
          }
        </ng-template>
        <ng-template #actions let-index="index">
          <app-button action="delete" variant="destructive" size="sm"
                      [disabled]="isReadOnly" (click)="removeLine(index)"></app-button>
        </ng-template>
      </app-data-table>
    </app-form-section>
  </form>

  <app-document-action-bar (back)="goBack()">
    <app-button
      variant="primary"
      [text]="isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear'"
      [disabled]="form.invalid || isSaving || !hasChanges || isReadOnly"
      [loading]="isSaving"
      (click)="save()"
    ></app-button>
  </app-document-action-bar>
</app-form-page>
```

---

## 6. Registro de rutas

```typescript
{
  path: 'orders',
  canActivate: [roleGuard(['ADMIN'])],
  children: [
    {
      path: '',
      loadComponent: () =>
        import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
    },
    {
      path: 'new',
      loadComponent: () =>
        import('./pages/orders/orders-form.component').then((m) => m.OrdersFormComponent),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./pages/orders/orders-form.component').then((m) => m.OrdersFormComponent),
      canDeactivate: [(c: OrdersFormComponent) => c.canDeactivate()],
    },
  ],
},
```

Y la página nueva se **registra también en la navegación**: una página a la que solo se llega escribiendo
la URL no existe para el usuario. Si el menú lateral está escrito a mano, añádela ahí; si es
configuración, añádela a la configuración —y considera extraerla a un fichero de datos cuando haya dos
sitios que la necesiten—.
