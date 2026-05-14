# Boilerplate Page Template (Angular ERP Frontend)

Use this as the starting point for every new feature page.

---

## Folder structure

```
src/app/pages/purchase-orders/
├── purchase-orders.component.ts
├── purchase-orders.component.html
├── purchase-orders.component.scss
├── purchase-orders-form.component.ts
├── purchase-orders-form.component.html
├── purchase-orders-form.component.scss
├── purchase-orders.service.ts
└── purchase-orders.service.spec.ts
```

Replace `purchase-orders` with your feature name in `kebab-case`. Class names use `PascalCase` (`PurchaseOrders`).

---

## 1. Service

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

export interface PurchaseOrderQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface PurchaseOrder {
  id: number;
  code: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  partnerId: number;
  partner: { id: number; name: string };
  notes?: string;
  date: string;
  total: number;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: number;
  itemId: number;
  item: { id: number; name: string };
  quantity: number;
  price: number;
  subtotal: number;
}

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

  create(data: any) {
    return this.http.post<PurchaseOrder>(this.api, data);
  }

  update(id: number, data: any) {
    return this.http.patch<PurchaseOrder>(`${this.api}/${id}`, data);
  }

  close(id: number) {
    return this.http.post<PurchaseOrder>(`${this.api}/${id}/close`, {});
  }

  cancel(id: number) {
    return this.http.post<PurchaseOrder>(`${this.api}/${id}/cancel`, {});
  }
}
```

---

## 2. List component

```typescript
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PurchaseOrdersService, PurchaseOrder } from './purchase-orders.service';
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
import { ConfirmDialogService } from '../../core/confirm-dialog/confirm-dialog.service';

@Component({
  standalone: true,
  selector: 'app-purchase-orders',
  imports: [CommonModule, RouterModule, FormsModule, PaginatorComponent],
  templateUrl: './purchase-orders.component.html',
  styleUrls: ['./purchase-orders.component.scss'],
})
export class PurchaseOrdersComponent implements OnInit {
  private service = inject(PurchaseOrdersService);
  private confirmSvc = inject(ConfirmDialogService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  loading = false;
  orders: PurchaseOrder[] = [];
  processingId: number | null = null;
  rowMenuId: number | null = null;

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  search = '';
  statusFilter = '';

  private searchSubject = new Subject<string>();

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

  load(): void {
    this.loading = true;
    this.service.getAll({
      page: this.page,
      limit: this.limit,
      search: this.search || undefined,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: result => {
        this.orders = result.data;
        this.total = result.total;
        this.totalPages = result.totalPages;
        this.page = result.page;
        this.loading = false;
        this.rowMenuId = null;
      },
      error: () => { this.loading = false; }
    });
  }

  onSearch(value: string) {
    this.search = value;
    this.searchSubject.next(value);
  }

  onPageChange(page: number) {
    this.page = page;
    this.load();
  }

  toggleRowMenu(id: number) {
    this.rowMenuId = this.rowMenuId === id ? null : id;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.row-menu')) {
      this.rowMenuId = null;
    }
  }

  async closeOrder(id: number) {
    const ok = await this.confirmSvc.ask({
      title: 'Cerrar orden',
      message: 'Esta seguro de cerrar esta orden de compra?',
    });
    if (!ok) return;
    this.processingId = id;
    this.service.close(id).subscribe({
      next: () => this.load(),
      error: () => { this.processingId = null; },
    });
  }

  async cancelOrder(id: number) {
    const ok = await this.confirmSvc.ask({
      title: 'Cancelar orden',
      message: 'Esta seguro de cancelar esta orden de compra?',
    });
    if (!ok) return;
    this.processingId = id;
    this.service.cancel(id).subscribe({
      next: () => this.load(),
      error: () => { this.processingId = null; },
    });
  }
}
```

### List template (HTML skeleton)

```html
<div class="page-header">
  <h1>Ordenes de Compra</h1>
  <button mat-raised-button color="primary" [routerLink]="['new']">
    <mat-icon>add</mat-icon> Nueva
  </button>
</div>

<div class="filters">
  <input [(ngModel)]="search" (ngModelChange)="onSearch($event)" placeholder="Buscar..." />
  <select [(ngModel)]="statusFilter" (change)="load()">
    <option value="">Todos</option>
    <option value="OPEN">Abierto</option>
    <option value="CLOSED">Cerrado</option>
    <option value="CANCELLED">Cancelado</option>
  </select>
</div>

<table>
  <thead>
    <tr>
      <th>Codigo</th>
      <th>Proveedor</th>
      <th>Fecha</th>
      <th>Total</th>
      <th>Estado</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let o of orders">
      <td>{{ o.code }}</td>
      <td>{{ o.partner.name }}</td>
      <td>{{ o.date | date:'shortDate' }}</td>
      <td>{{ o.total | currency }}</td>
      <td><span class="badge" [class]="o.status">{{ o.status }}</span></td>
      <td>
        <button (click)="toggleRowMenu(o.id)">...</button>
        <div class="row-menu" *ngIf="rowMenuId === o.id">
          <a [routerLink]="[o.id]">Editar</a>
          <button (click)="closeOrder(o.id)">Cerrar</button>
          <button (click)="cancelOrder(o.id)">Cancelar</button>
        </div>
      </td>
    </tr>
  </tbody>
</table>

<app-paginator
  [page]="page"
  [totalPages]="totalPages"
  [total]="total"
  (pageChange)="onPageChange($event)"
></app-paginator>
```

---

## 3. Form component

```typescript
import { Component, OnInit, inject, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PurchaseOrdersService, PurchaseOrder } from './purchase-orders.service';
import { PartnersService } from '../partners/partners.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { ItemsService } from '../items/items.service';
import { ToastService } from '../../core/toast/toast.service';
import { ConfirmDialogService } from '../../core/confirm-dialog/confirm-dialog.service';

import { PartnerSelectorComponent } from '../../shared/partner-selector/partner-selector.component';
import { WarehouseSelectorComponent } from '../../shared/warehouse-selector/warehouse-selector.component';
import { ItemSearchModalComponent } from '../../shared/item-search-modal/item-search-modal.component';

@Component({
  standalone: true,
  selector: 'app-purchase-orders-form',
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    PartnerSelectorComponent, WarehouseSelectorComponent, ItemSearchModalComponent,
  ],
  templateUrl: './purchase-orders-form.component.html',
  styleUrls: ['./purchase-orders-form.component.scss'],
})
export class PurchaseOrdersFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PurchaseOrdersService);
  private partnersService = inject(PartnersService);
  private warehousesService = inject(WarehousesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirmSvc = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  isEdit = false;
  docId: number | null = null;
  loading = false;
  saving = false;
  partners: any[] = [];
  warehouses: any[] = [];

  ngOnInit(): void {
    this.buildForm();

    forkJoin({
      partners: this.partnersService.getAll(),
      warehouses: this.warehousesService.getAll(),
      doc: this.route.paramMap.pipe(
        switchMap(p => {
          const id = p.get('id');
          if (!id || id === 'new') return of(null);
          this.isEdit = true;
          this.docId = +id;
          return this.service.getOne(+id).pipe(catchError(() => of(null)));
        }),
      ),
    }).subscribe({
      next: ({ partners, warehouses, doc }) => {
        this.partners = partners;
        this.warehouses = warehouses;
        if (doc) this.patchForm(doc);
      },
    });
  }

  private buildForm() {
    this.form = this.fb.group({
      partnerId: [null as number | null, Validators.required],
      notes: [''],
      warehouseId: [null as number | null],
      items: this.fb.array<FormGroup>([]),
    });
  }

  private patchForm(doc: PurchaseOrder) {
    this.form.patchValue({
      partnerId: doc.partnerId,
      notes: doc.notes,
    });
    doc.items.forEach(i => this.addLine(i));
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  addLine(item?: any) {
    const line = this.fb.group({
      itemId: [item?.itemId ?? item?.item?.id ?? null, Validators.required],
      quantity: [item?.quantity ?? 1, [Validators.required, Validators.min(0.01)]],
      price: [item?.price ?? 0, Validators.required],
      discountPct: [item?.discountPct ?? 0],
      discountAmt: [item?.discountAmt ?? 0],
      warehouseId: [item?.warehouseId ?? null],
    });
    this.items.push(line);
  }

  removeLine(index: number) {
    this.items.removeAt(index);
  }

  onItemSelected(item: any) {
    this.addLine(item);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    const data = this.form.value;
    const obs = this.isEdit && this.docId
      ? this.service.update(this.docId, data)
      : this.service.create(data);

    obs.subscribe({
      next: () => {
        this.toast.success('Guardado correctamente');
        this.router.navigate(['/purchase-orders']);
      },
      error: () => { this.saving = false; },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.router.navigate(['/purchase-orders']);
  }
}
```

### Form template (HTML skeleton)

```html
<form [formGroup]="form" (ngSubmit)="save()">
  <div class="form-row">
    <app-partner-selector
      formControlName="partnerId"
      [partnerType]="'SUPPLIER'"
    ></app-partner-selector>

    <app-warehouse-selector
      formControlName="warehouseId"
    ></app-warehouse-selector>
  </div>

  <textarea formControlName="notes" placeholder="Notas..."></textarea>

  <h3>Lineas</h3>
  <app-item-search-modal (itemSelected)="onItemSelected($event)"></app-item-search-modal>

  <table formArrayName="items">
    <thead>
      <tr>
        <th>Articulo</th>
        <th>Cantidad</th>
        <th>Precio</th>
        <th>Desc. %</th>
        <th>Desc. Bs</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let line of items.controls; let i = index" [formGroupName]="i">
        <td>{{ line.value.itemId }}</td>
        <td><input type="number" formControlName="quantity" /></td>
        <td><input type="number" formControlName="price" /></td>
        <td><input type="number" formControlName="discountPct" /></td>
        <td><input type="number" formControlName="discountAmt" /></td>
        <td><button type="button" (click)="removeLine(i)">X</button></td>
      </tr>
    </tbody>
  </table>

  <div class="actions">
    <button type="button" [routerLink]="['/purchase-orders']">Cancelar</button>
    <button type="submit" [disabled]="saving">Guardar</button>
  </div>
</form>
```

---

## 4. Route registration

Add to `src/app/app.routes.ts` inside the `LayoutComponent` children:

```typescript
{
  path: 'purchase-orders',
  canActivate: [roleGuard(['ADMIN'])],
  children: [
    {
      path: '',
      loadComponent: () =>
        import('./pages/purchase-orders/purchase-orders.component')
          .then(m => m.PurchaseOrdersComponent),
    },
    {
      path: 'new',
      loadComponent: () =>
        import('./pages/purchase-orders/purchase-orders-form.component')
          .then(m => m.PurchaseOrdersFormComponent),
    },
    {
      path: ':id',
      loadComponent: () =>
        import('./pages/purchase-orders/purchase-orders-form.component')
          .then(m => m.PurchaseOrdersFormComponent),
    },
  ],
},
```
