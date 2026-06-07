# Testing Recipes (NestJS ERP Backend)

Unit tests use Jest. Mock `PrismaService` with `jest.fn()` — never connect to a real database.

All mocks must be typed. **Never** use `as any` in production code or tests.

---

## 1. Service test template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from '../purchase-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;

  const mockTx = {
    purchaseOrder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    item: { findMany: jest.fn() },
    partner: { findUnique: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    ),
    purchaseOrder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockSettings = {
    getAll: jest.fn().mockResolvedValue({ useSinTaxCalculation: false }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a purchase order with lines', async () => {
      const dto = {
        partnerId: 1,
        items: [{ itemId: 10, quantity: 2 }],
      } satisfies Partial<CreatePurchaseOrderDto>;

      mockTx.partner.findUnique.mockResolvedValue({ id: 1, name: 'Proveedor A' });
      mockTx.item.findMany.mockResolvedValue([
        { id: 10, name: 'Producto', price: 100 },
      ]);
      mockTx.purchaseOrder.create.mockResolvedValue({
        id: 1,
        code: 'PO-000001',
        partnerId: 1,
        items: [{ id: 1, itemId: 10, quantity: 2 }],
      });

      const result = await service.create(
        dto as unknown as CreatePurchaseOrderDto,
        99,
        1,
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.purchaseOrder.create).toHaveBeenCalled();
      expect(result.code).toBe('PO-000001');
    });

    it('should throw BadRequestException if partner not found', async () => {
      const dto = { partnerId: 1, items: [] } satisfies Partial<CreatePurchaseOrderDto>;
      mockTx.partner.findUnique.mockResolvedValue(null);

      await expect(
        service.create(dto as unknown as CreatePurchaseOrderDto, 99, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a document', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 1,
        code: 'PO-000001',
      });
      const result = await service.findOne(1, 1);
      expect(result.code).toBe('PO-000001');
    });

    it('should throw NotFoundException if missing', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## 2. Controller test template (with SAP aliases)

When a controller uses `resolveSapAliases` or `addSapAliasesToDocument`, the testing module **must** provide `PrismaService` and the controller's service.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersController } from '../purchase-orders.controller';
import { PurchaseOrdersService } from '../purchase-orders.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PurchaseOrdersController', () => {
  let controller: PurchaseOrdersController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    close: jest.fn(),
    cancel: jest.fn(),
  };

  const mockPrisma = {
    partner: { findUnique: jest.fn() },
    item: { findUnique: jest.fn() },
    warehouse: { findUnique: jest.fn() },
  };

  const mockUser = {
    sub: 99,
    tenantId: 1,
    email: 'test@test.com',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [
        { provide: PurchaseOrdersService, useValue: mockService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<PurchaseOrdersController>(PurchaseOrdersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.create', async () => {
    const dto = { partnerId: 1, items: [] } satisfies Partial<CreatePurchaseOrderDto>;
    mockService.create.mockResolvedValue({ id: 1, code: 'PO-000001' });

    await controller.create(
      dto as unknown as CreatePurchaseOrderDto,
      mockUser,
    );

    expect(mockService.create).toHaveBeenCalledWith(dto, 99, 1);
  });

  it('should call service.findAll with parsed query', async () => {
    mockService.findAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await controller.findAll('2', '50', 'search-term', 'OPEN', mockUser);

    expect(mockService.findAll).toHaveBeenCalledWith(
      {
        page: 2,
        limit: 50,
        search: 'search-term',
        status: 'OPEN',
      },
      1,
    );
  });
});
```

---

## 3. Testing utilities

### Reset mocks between tests

Always call `jest.clearAllMocks()` in `beforeEach` to avoid state leaking between tests.

### Testing Prisma transactions

Mock `$transaction` so it invokes the callback with your `mockTx`:

```typescript
const mockTx = {
  /* ... */
};
const mockPrisma = {
  $transaction: jest.fn(async (fn) => fn(mockTx)),
};
```

This lets you assert both that the transaction wrapper was called **and** that individual `tx.*` methods were invoked.

### Testing pagination

Assert the shape returned by `findAll`:

```typescript
expect(result).toEqual({
  data: expect.any(Array),
  total: 10,
  page: 1,
  limit: 20,
  totalPages: 1,
});
```

### Typed mocks (zero `as any`)

```typescript
// ✅ Correct — satisfies Partial<T>
const dto = { partnerId: 1, items: [] } satisfies Partial<CreatePurchaseOrderDto>;
await service.create(dto as unknown as CreatePurchaseOrderDto, 99, 1);

// ✅ Correct — fully typed mock provider
{ provide: SettingsService, useValue: mockSettings as unknown as SettingsService }

// ❌ Wrong — never use as any
await service.create(dto as any, 99, 1);
```
