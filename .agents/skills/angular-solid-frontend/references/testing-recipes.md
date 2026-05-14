# Testing Recipes (Angular ERP Frontend)

Unit tests use Karma + Jasmine. Tests live next to source as `*.spec.ts`.

---

## 1. Service test template

Mock `HttpClient` with `HttpClientTestingModule` and `HttpTestingController`.

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { environment } from '../../../environments/environment';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PurchaseOrdersService],
    });
    service = TestBed.inject(PurchaseOrdersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get all with query params', () => {
    const mockResponse = {
      data: [{ id: 1, code: 'PO-000001', total: 100 }],
      total: 1, page: 1, limit: 20, totalPages: 1,
    };

    service.getAll({ page: 1, limit: 20, search: 'test' }).subscribe(res => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].code).toBe('PO-000001');
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/purchase-orders?page=1&limit=20&search=test`
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should create a document', () => {
    const payload = { partnerId: 1, items: [] };
    const mockResponse = { id: 1, code: 'PO-000001' };

    service.create(payload).subscribe(res => {
      expect(res.code).toBe('PO-000001');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/purchase-orders`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });
});
```

---

## 2. Component test template (list page)

For standalone components, import the component directly.

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PurchaseOrdersComponent } from './purchase-orders.component';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ConfirmDialogService } from '../../core/confirm-dialog/confirm-dialog.service';

class MockPurchaseOrdersService {
  getAll = jasmine.createSpy('getAll').and.returnValue(of({
    data: [{ id: 1, code: 'PO-000001', partner: { name: 'Proveedor A' }, total: 100, status: 'OPEN' }],
    total: 1, page: 1, limit: 20, totalPages: 1,
  }));
  close = jasmine.createSpy('close').and.returnValue(of({}));
  cancel = jasmine.createSpy('cancel').and.returnValue(of({}));
}

class MockConfirmDialogService {
  ask = jasmine.createSpy('ask').and.returnValue(Promise.resolve(true));
}

describe('PurchaseOrdersComponent', () => {
  let component: PurchaseOrdersComponent;
  let fixture: ComponentFixture<PurchaseOrdersComponent>;
  let service: MockPurchaseOrdersService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseOrdersComponent],
      providers: [
        provideRouter([]),
        { provide: PurchaseOrdersService, useClass: MockPurchaseOrdersService },
        { provide: ConfirmDialogService, useClass: MockConfirmDialogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PurchaseOrdersComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(PurchaseOrdersService) as unknown as MockPurchaseOrdersService;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load orders on init', () => {
    expect(service.getAll).toHaveBeenCalled();
    expect(component.orders.length).toBe(1);
  });

  it('should call close on closeOrder', async () => {
    await component.closeOrder(1);
    expect(service.close).toHaveBeenCalledWith(1);
  });
});
```

---

## 3. Component test template (form page)

```typescript
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PurchaseOrdersFormComponent } from './purchase-orders-form.component';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PartnersService } from '../partners/partners.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { ToastService } from '../../core/toast/toast.service';

const mockActivatedRoute = {
  paramMap: of({ get: () => 'new' }),
};

class MockPurchaseOrdersService {
  create = jasmine.createSpy('create').and.returnValue(of({ id: 1 }));
  update = jasmine.createSpy('update').and.returnValue(of({ id: 1 }));
  getOne = jasmine.createSpy('getOne').and.returnValue(of({
    id: 1, partnerId: 1, notes: '', items: [],
  }));
}

class MockPartnersService {
  getAll = jasmine.createSpy('getAll').and.returnValue(of([{ id: 1, name: 'Proveedor A' }]));
}

class MockWarehousesService {
  getAll = jasmine.createSpy('getAll').and.returnValue(of([{ id: 1, name: 'Almacen Central' }]));
}

class MockToastService {
  success = jasmine.createSpy('success');
}

describe('PurchaseOrdersFormComponent', () => {
  let component: PurchaseOrdersFormComponent;
  let fixture: ComponentFixture<PurchaseOrdersFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseOrdersFormComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: PurchaseOrdersService, useClass: MockPurchaseOrdersService },
        { provide: PartnersService, useClass: MockPartnersService },
        { provide: WarehousesService, useClass: MockWarehousesService },
        { provide: ToastService, useClass: MockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PurchaseOrdersFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add a line', () => {
    component.addLine({ id: 10, name: 'Producto', price: 50 });
    expect(component.items.length).toBe(1);
    expect(component.items.at(0).value.price).toBe(50);
  });

  it('should remove a line', () => {
    component.addLine();
    component.addLine();
    component.removeLine(0);
    expect(component.items.length).toBe(1);
  });

  it('should not save if form invalid', () => {
    component.form.patchValue({ partnerId: null });
    const toast = TestBed.inject(ToastService) as unknown as MockToastService;
    component.save();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
```

---

## 4. Running tests

```bash
# Run ALL tests (opens browser)
cd erp-frontend && npm test

# Run a SINGLE spec file headless
npx ng test --include="**/purchase-orders.service.spec.ts" --watch=false --browsers=ChromeHeadless

# Run tests for a specific component
npx ng test --include="**/purchase-orders.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

---

## 5. Testing tips

- **Always import the standalone component** directly in `TestBed.configureTestingModule({ imports: [MyComponent] })`.
- **Mock all services** that make HTTP calls or show UI (Toast, ConfirmDialog).
- **Use `provideRouter([])`** when the component uses `RouterModule` or `RouterLink`.
- **Use `fakeAsync` + `tick()`** when testing debounced search or setTimeout logic.
- **Assert form validity** with `expect(component.form.valid).toBe(false)` before calling save.
