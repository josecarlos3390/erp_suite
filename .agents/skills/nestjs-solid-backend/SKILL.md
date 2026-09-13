---
name: nestjs-erp-backend
description: Scaffold and maintain NestJS backend modules for an ERP system using Prisma, PostgreSQL, multi-tenancy, document flows (header + lines), stock tracking, SAP B1 alias compatibility, and Bolivian tax rules. Use when creating new backend modules, DTOs, controllers, services, Prisma migrations, or tests in the backend-erp project. Covers transaction-safe document creation, code generation and series self-healing, the accounting engine by family (balanced entries, withholding taxes in both directions, account determination hierarchy), pricing/stock/tax utilities, SAP alias resolution (input/output), Swagger/OpenAPI, strict typing (zero `as any`, `strictNullChecks`), migrations under known schema drift, k6 load-test modes, and functional testing with mocked PrismaService.
---

# NestJS ERP Backend

> **Read this first when the task touches `backend-erp/src/`:** the project protocol (see
> `AGENTS.md`) requires reading `BACKEND_GUIDE.md` **in full** before writing code, and
> `docs/guides/ACCOUNTING_ENTRIES_GUIDE.md` before touching accounting. This skill is the
> implementation recipe; those are the canonical rules. When they disagree, the codebase
> wins — and the divergence belongs here.

## Quick start

Create a new domain module (e.g. `purchase-orders`):

```bash
# 1. Create folder structure
mkdir -p backend-erp/src/purchase-orders/dto

# 2. Create files (see references/module-template.md for exact boilerplate):
#    purchase-orders.module.ts
#    purchase-orders.controller.ts
#    purchase-orders.service.ts
#    dto/create-purchase-order.dto.ts
#    dto/update-purchase-order.dto.ts
#    purchase-orders.service.spec.ts
#    purchase-orders.controller.spec.ts
```

## Architecture rules

### 1. NestJS module pattern (Prisma direct — NO Repository Pattern)

Prisma is the data access layer. Services inject `PrismaService` directly.

```typescript
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}
}
```

**Never** add an extra repository abstraction layer. PrismaClient already provides type-safe queries.

### 2. Prisma patterns

- **Global module:** `PrismaModule` is `@Global()`; inject `PrismaService` anywhere without importing the module.
- **Transactions:** wrap all multi-step writes in `this.prisma.$transaction(async tx => { ... })`.
- **Use `tx`** (TransactionClient) for every query inside the transaction to ensure atomicity.
- **Soft deletes:** set `status: 'INACTIVE'` — never hard-delete business records.
- **Raw queries:** use `$queryRawUnsafe` / `$executeRawUnsafe` **only** for PostgreSQL sequence operations (code generation).

### 3. DTOs

- Use **classes** decorated with `class-validator` and `class-transformer`.
- All properties must have validation decorators (`@IsString()`, `@IsInt()`, `@IsOptional()`, `@IsNumber()`, `@Min()`, `@IsIn()`, etc.).
- Numeric conversion: use `@Transform(toNumber)` helper to prevent string-injection bugs:
  ```typescript
  const toNumber = ({ value }: { value: unknown }) =>
    value != null ? Number(value) : value;
  ```
- Nested arrays: use `@IsArray()`, `@ValidateNested({ each: true })`, `@Type(() => InnerDto)`.
- **Swagger:** add `@ApiProperty()` or `@ApiPropertyOptional()` to every DTO property so OpenAPI schema is complete.
- **SAP B1 alias fields** must be declared as **optional** on DTOs so the frontend can send them:
  ```typescript
  @ApiPropertyOptional({ description: 'Código SAP del socio (CardCode)' })
  @IsOptional()
  @IsString()
  cardCode?: string;

  @ApiPropertyOptional({ description: 'Código SAP del almacén (WhsCode)' })
  @IsOptional()
  @IsString()
  whsCode?: string;
  ```
- Inner line DTOs must also expose `itemCode` and `whsCode`:
  ```typescript
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whsCode?: string;
  ```

### 4. Controller rules

- `@Controller('resource-name')` — kebab-case matching the module folder.
- `@ApiTags('ResourceName')` and `@ApiBearerAuth()` on the class.
- Use `@Public()` to bypass JWT on specific routes.
- Use `@Roles('ADMIN' | 'USER')` for authorization.
- Extract user identity with `@CurrentUser() user: JwtPayload`.
- Delegate 100% of logic to the service.
- **SAP alias resolution** happens in the **controller** (not the service) using `resolveSapAliases` for input and `addSapAliasesToDocument` / `addSapAliasesToPaginated` for output.

```typescript
import { resolveSapAliases } from '../common/sap-alias.util';
import {
  addSapAliasesToDocument,
  addSapAliasesToPaginated,
} from '../common/sap-alias-response.util';

@Controller('purchase-orders')
@ApiTags('PurchaseOrders')
@ApiBearerAuth()
export class PurchaseOrdersController {
  constructor(
    private readonly service: PurchaseOrdersService,
    private readonly prisma: PrismaService, // needed for alias resolution
  ) {}

  @Post()
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await resolveSapAliases(dto, dto.items ?? [], this.prisma, user.tenantId);
    const doc = await this.service.create(dto, user.sub, user.tenantId);
    return addSapAliasesToDocument(doc);
  }

  @Get()
  async findAll(
    @Query('page')   page?: string,
    @Query('limit')  limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.service.findAll({
      page:   page   ? +page   : undefined,
      limit:  limit  ? +limit  : undefined,
      search: search || undefined,
      status: status || undefined,
    }, user.tenantId);
    return addSapAliasesToPaginated(result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const doc = await this.service.findOne(+id, user.tenantId);
    return addSapAliasesToDocument(doc);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await resolveSapAliases(dto, dto.items ?? [], this.prisma, user.tenantId);
    const doc = await this.service.update(+id, dto, user.sub, user.tenantId);
    return addSapAliasesToDocument(doc);
  }
}
```

**Special cases:**
- **Stock transfers** with `sourceWarehouseId` / `targetWarehouseId` must also call `resolveSourceWhsCode()` and `resolveTargetWhsCode()`.
- **Payment controllers** (incoming/outgoing) only need `resolveCardCode()` because they don't have item lines.

### 5. Code generation

Every document module generates a human-readable code (e.g. `PED-000001`).

```typescript
import { generateCode, CODE_SEQUENCES } from '../common/code-generator';

private async generateCode(tx: Prisma.TransactionClient, tenantId: number): Promise<string> {
  const { seq, prefix, pad } = CODE_SEQUENCES.purchaseOrders;
  return generateCode(tx, tenantId, seq, prefix, pad);
}
```

When adding a new document type, register its sequence in `CODE_SEQUENCES` **and** in `PrismaService.ensureSequences()` so PostgreSQL creates the sequence on startup.

### 6. Pricing / Stock / Tax utilities

Re-use utilities from `src/common/` — never reimplement business math:

| Utility | Import | Use case |
|---|---|---|
| `calcLine` | `pricing.util` | Calculate line subtotal from qty, price, discounts |
| `calcDocumentTotalsFromLines` | `pricing.util` | Roll up header totals from line array |
| `calcDocumentTotalsWithIndicators` | `pricing.util` | Totals with Bolivian IVA (13%) and tax indicators |
| `buildDocumentHeaderData` | `document-totals.util` | Build header data object with totals and currency conversion |
| `recalcTotalsFromPersistedLines` | `document-totals.util` | Recalculate totals from already-saved lines (update/confirm) |
| `applyIncomingStock` | `document-stock.helper` | Apply inbound stock (+delta) for receipts/entries |
| `applyOutgoingStock` | `document-stock.helper` | Apply outbound stock (-delta) for deliveries/exits |
| `applyStockTransfer` | `document-stock.helper` | Apply transfer stock (origin -, destination +) |
| `reverseIncomingStock` | `document-stock.helper` | Reverse inbound stock on cancel |
| `reverseOutgoingStock` | `document-stock.helper` | Reverse outbound stock on cancel |
| `reverseStockTransfer` | `document-stock.helper` | Reverse transfer stock on cancel |
| `validateDocumentLineTracking` | `document-stock.helper` | Validate batch/serial tracking assignments on lines |
| `syncDocumentLineTracking` | `document-stock.helper` | Sync DocumentLineTracking records for a document |
| `resolveTrackingFields` | `document-stock.helper` | Resolve batchId/serialNumberId from trackingAssignments JSON |
| `recalcQuoted` | `stock.util` | Update `stockQuoted` after document changes (legacy, prefer helpers above) |
| `resolveLineTaxIndicator` | `tax-indicator.util` | Resolve which tax indicator applies to a line |
| `upsertStock` | `stock.util` | Maintain denormalized `Stock` table |
| `calcProgress` | `progress.util` | Compute `deliveryStatus` / `invoiceStatus` |
| `resolvePaymentTerm` | `payment-term.util` | Resolve payment term, due date, and installment plan |
| `createInvoiceInstallments` | `payment-term.util` | Create InvoiceInstallment records from a plan |

All these functions accept `tx: Prisma.TransactionClient` as the first argument (where applicable).

### 7. Document flow (header + lines)

Documents in this ERP have a **header** (cabecera) and **lines** (líneas):

1. Validate header data and related catalog entities (partner, warehouse, items).
2. For each line: resolve price, tax indicator, calculate subtotal.
3. Create header record with `tx.document.create({ data: { ... } })`.
4. Create lines with `tx.documentLine.createMany({ data: lines })`.
5. Update stock via `recalcQuoted(tx, ...)` or equivalent.
6. Return the created document with lines included (`include: { items: true }`).

For cross-document traceability (e.g. Quotation → Order), use `baseDocType`, `baseDocId`, `baseLineId` fields and the `traceability.util` helpers.

See `references/document-flow.md` for a complete step-by-step example.

### 8. Multi-tenancy

- Nearly every table has `tenantId: number`.
- The JWT payload contains `sub` (userId), `tenantId`, and `role`.
- Always filter by `tenantId` in queries:
  ```typescript
  where: { id, tenantId }
  ```
- Use `@@unique([tenantId, code])` in Prisma schema for business codes.

### 9. Path aliases (optional improvement)

The project currently uses relative imports. If you add path aliases to `tsconfig.json`, prefer:

```json
"paths": {
  "@common/*": ["src/common/*"],
  "@prisma/*": ["src/prisma/*"],
  "@auth/*":   ["src/auth/*"]
}
```

Until aliases are added, use **relative paths** following existing conventions (`../common/...`, `../prisma/...`).

### 10. Error handling

Throw NestJS HTTP exceptions from services:

- `NotFoundException` — resource not found
- `BadRequestException` — invalid input / business rule violation
- `ConflictException` — unique constraint violation (catch `PrismaClientKnownRequestError` code `P2002`)
- `UnauthorizedException` — auth failures
- `InternalServerErrorException` — unexpected errors

---

## Zero `as any` policy

> **Context:** Apr 2026 — `0 as any` in production code. `strictNullChecks: true` enabled.

### Rules

1. **Never** use `as any` to bypass the compiler. Fix the type (DTO, interface, or Prisma payload) instead.
2. Prisma query payloads with `include` must be typed using `Prisma.*GetPayload` or `as const` + `typeof include`.
3. Test mocks should use `as unknown as MyType` or `satisfies Partial<MyType>`.
4. Utility helpers must use **generics**, not `any` parameters.
5. Discriminated unions for dynamic Prisma delegates (e.g. `tx.salesOrderItem.update` vs `tx.purchaseOrderItem.update`) instead of `unknown` args + `as any`.

### Examples

```typescript
// ✅ Correct — discriminated union for dynamic Prisma models
type LineModelUpdatePayload =
  | { model: 'salesQuotationItem'; args: Prisma.SalesQuotationItemUpdateArgs }
  | { model: 'salesOrderItem';      args: Prisma.SalesOrderItemUpdateArgs };

// ❌ Wrong — never do this
const order: any = await tx.salesOrder.findUnique(...);

// ✅ Correct — test mock
type MockPrisma = { partner: { findUnique: jest.Mock }; item: { findMany: jest.Mock } };
const mockTx = {
  partner: { findUnique: jest.fn() },
  item: { findMany: jest.fn() },
} satisfies MockPrisma;
```

---

## `strictNullChecks` safe patterns

`strictNullChecks: true` is enabled (with `strict: false` and `noImplicitAny: false`).

| Problem | Safe pattern | Example |
|---------|-------------|---------|
| `tenantId?: number` param later passed to Prisma | Assert at call site with `tenantId!` inside data objects (never add runtime throws in hot paths) | `data: { tenantId: tenantId!, ... }` |
| `.find()` after an existence check | Non-null assertion `)!` when preceded by `if (!x) throw` | `const parent = parents.find(p => p.id === id)!;` |
| `Map.get()` used in arithmetic | `(map.get(key!) ?? 0)` when the key may be nullable | `const qty = (whItemMap.get(orderItemId!) ?? 0) + line.quantity;` |
| Accumulator arrays (`lineCalcs`, `invoiceLines`) | Declare with real interfaces (not `any[]`) | `const lineCalcs: SalesOrderLineCalc[] = [];` |
| `let x = null` later used as object | Use explicit union type or cast | `let riTaxInd: TaxIndicator \| null = null;` |
| Optional relation (`di.order?.items`) | `di.order!.items` after null-check or `di.order?.items ?? []` | `for (const oi of di.order!.items) { ... }` |

**What NOT to do:**
- ❌ Do not add runtime `if (!tenantId) throw new BadRequestException(...)` inside every private helper — it bloats the code and can break existing tests.
- ❌ Do not use `// @ts-ignore` or `// @ts-expect-error` — the build has zero suppression comments.

---

## SAP B1 Alias integration

### Input aliases (controller responsibility)

Use `resolveSapAliases` to convert frontend-sent codes (`cardCode`, `whsCode`, `itemCode`) into Prisma IDs **before** calling the service:

```typescript
import { resolveSapAliases } from '../common/sap-alias.util';

@Post()
async create(@Body() dto: CreateDto, @CurrentUser() user: JwtPayload) {
  await resolveSapAliases(dto, dto.items ?? [], this.prisma, user.tenantId);
  return this.service.create(dto, user.sub, user.tenantId);
}
```

`resolveSapAliases` does the following in one pass:
- `resolveCardCode` — looks up `partner` by `code` and sets `partnerId`
- `resolveItemCode` — looks up `item` by `code` and sets `itemId` on each line
- `resolveWhsCode` — looks up `warehouse` by `code` and sets `warehouseId` on header and/or lines

**Stock transfers** use the specialized helpers:
```typescript
import { resolveSourceWhsCode, resolveTargetWhsCode } from '../common/sap-alias.util';

@Post()
async create(@Body() dto: CreateStockTransferDto, @CurrentUser() user: JwtPayload) {
  await resolveSourceWhsCode(dto, this.prisma, user.tenantId);
  await resolveTargetWhsCode(dto, this.prisma, user.tenantId);
  await resolveSapAliases(dto, dto.items ?? [], this.prisma, user.tenantId);
  for (const line of dto.items ?? []) {
    await resolveSourceWhsCode(line, this.prisma, user.tenantId);
    await resolveTargetWhsCode(line, this.prisma, user.tenantId);
  }
  return this.service.create(dto, user.sub, user.tenantId);
}
```

**Payment controllers** only need `resolveCardCode`:
```typescript
import { resolveCardCode } from '../common/sap-alias.util';

@Post()
async create(@Body() dto: CreateIncomingPaymentDto, @CurrentUser() user: JwtPayload) {
  await resolveCardCode(dto, this.prisma, user.tenantId);
  return this.service.create(dto, user.sub, user.tenantId);
}
```

### Output aliases (controller responsibility)

Enrich responses before returning:

```typescript
import {
  addSapAliasesToDocument,
  addSapAliasesToPaginated,
} from '../common/sap-alias-response.util';

@Get()
async findAll(...) {
  const result = await this.service.findAll(...);
  return addSapAliasesToPaginated(result);
}

@Get(':id')
async findOne(@Param('id') id: string) {
  const doc = await this.service.findOne(+id);
  return addSapAliasesToDocument(doc);
}
```

`addSapAliasesToDocument` adds:
- Header: `cardCode`, `docDate`, `taxDate`, `comments`, `numAtCard`, `slpCode`, `project`, `docRate`, `discPrcnt`
- Lines: `itemCode`, `whsCode`, `discPrcnt`, `dscription`

---

## Document Service Standardization checklist

Every commercial document service should implement these methods with consistent signatures and behaviors:

| Method | Signature | Must do |
|--------|-----------|---------|
| `create` | `(dto, createdById, tenantId) => Promise<DocWithItems>` | Generate code, validate catalog, calc lines, create header + lines, update stock |
| `findAll` | `(params, tenantId) => Promise<PaginatedResult<Doc>>` | Support `search` by `code` AND `partner.name` (or `supplier.name`), filter by `status`, paginate, include `partner` + `items` count |
| `findOne` | `(id, tenantId) => Promise<DocWithItems>` | Include `partner`, `items` (with `item`, `warehouse`), throw `NotFoundException` if missing |
| `update` | `(id, dto, updatedById, tenantId) => Promise<DocWithItems>` | Validate existing doc, reverse old stock, rebuild lines, apply new stock, recalc totals |
| `close` | `(id, updatedById, tenantId) => Promise<DocWithItems>` | Validate OPEN status, create target document with `baseDocType`/`baseDocId` traceability, mark source CLOSED |
| `cancel` | `(id, updatedById, tenantId) => Promise<DocWithItems>` | Validate not already CANCELLED, reverse stock, soft delete (`status: 'CANCELLED'`) |
| `confirm` / `deliver` / `invoice` | *(if applicable)* | Update line statuses, create downstream document, update progress fields |

### Search standard

`findAll` must support searching by business codes, not just names:

```typescript
const where: Prisma.PurchaseOrderWhereInput = {
  status: { not: 'INACTIVE' },
  tenantId,
  ...(params.search ? {
    OR: [
      { code: { contains: params.search, mode: 'insensitive' } },
      { partner: { name: { contains: params.search, mode: 'insensitive' } } },
      { partner: { code: { contains: params.search, mode: 'insensitive' } } }, // ✅ SAP alias search
    ],
  } : {}),
};
```

---

## Testing pattern

Mock `PrismaService` with `jest.fn()` — never hit a real database in unit tests.

```typescript
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
  $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
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
  const module = await Test.createTestingModule({
    providers: [
      PurchaseOrdersService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: SettingsService, useValue: mockSettings },
    ],
  }).compile();

  service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  jest.clearAllMocks();
});
```

### Controller specs with PrismaService for aliases

When a controller uses `resolveSapAliases`, the testing module must provide `PrismaService`:

```typescript
const mockPrismaForController = {
  partner: { findUnique: jest.fn() },
  item: { findUnique: jest.fn() },
  warehouse: { findUnique: jest.fn() },
};

beforeEach(async () => {
  const module = await Test.createTestingModule({
    controllers: [PurchaseOrdersController],
    providers: [
      { provide: PurchaseOrdersService, useValue: mockService },
      { provide: PrismaService, useValue: mockPrismaForController },
    ],
  }).compile();
});
```

### Mocks without `as any`

```typescript
// ✅ Correct
const dto = { partnerId: 1, items: [] } satisfies Partial<CreatePurchaseOrderDto>;
await service.create(dto as unknown as CreatePurchaseOrderDto, 99, 1);

// ❌ Wrong — do not use as any
await service.create(dto as any, 99, 1);
```

See `references/testing-recipes.md` for full service and controller test templates.

---

## Advanced patterns

### Document with UDFs (User Defined Fields)

UDFs are stored as JSON in the document header (`customFields: Json?`) and are **automatically denormalized** into `CustomFieldValue` rows via Prisma middleware/triggers for SQL reporting.

**What the service must do:**

1. Accept `customFields?: Record<string, unknown>` in the DTO.
2. Pass it directly to the document creation/update:

```typescript
// In the service create/update transaction
const doc = await tx.salesQuotation.create({
  data: {
    // ... other fields ...
    customFields: dto.customFields ?? {},
  },
});
```

**What the service must NOT do:**
- Do NOT manually create `CustomFieldValue` records — the middleware handles denormalization automatically.
- Do NOT validate UDF schemas in the service — validation happens at the form level or via a dedicated UDF validator.

The `buildBaseDocumentData()` helper from `document-utils.ts` already handles `customFields` assignment for standard document fields.

---

### Document with accounting impact (JournalEntry)

Documents that affect accounting (invoices, deliveries, payments, credit notes) must generate a `JournalEntry` automatically at the end of the confirming transaction.

**Pattern:**

```typescript
import { AccountingEngineService } from '../common/accounting-engine.service';

@Injectable()
export class SaleInvoicesService {
  constructor(
    private prisma: PrismaService,
    private accountingEngine: AccountingEngineService,
  ) {}

  async confirm(id: number, confirmedById: number, tenantId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate and load document with lines
      const invoice = await tx.saleInvoice.findUnique({
        where: { id, tenantId },
        include: { items: true },
      });
      if (!invoice) throw new NotFoundException('Factura no encontrada');

      // 2. Apply business logic (stock, progress, etc.)
      // ...

      // 3. Mark as confirmed
      await tx.saleInvoice.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedById, confirmedAt: new Date() },
      });

      // 4. Generate accounting entry
      await this.accountingEngine.createSaleInvoiceJournalEntry(tx, {
        id: invoice.id,
        code: invoice.code,
        tenantId,
        partnerId: invoice.partnerId,
        warehouseId: invoice.warehouseId!,
        branchId: invoice.branchId,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        totalCost: invoice.totalCost,
        items: invoice.items.map((i) => ({
          itemId: i.itemId,
          itemGroupId: i.itemGroupId,
          warehouseId: i.warehouseId,
          subtotal: i.subtotal,
          taxAmount: i.tax,
          totalCost: i.totalCost,
          quantity: i.quantity,
          description: i.description,
          manualAccountId: i.manualAccountId,
        })),
      });

      return invoice;
    });
  }
}
```

**Cancellation / reversal:**

```typescript
// On cancel, reverse the journal entry
await this.accountingEngine.reverseJournalEntry(
  tx,
  'SALE_INVOICE',
  invoiceId,
  tenantId,
  cancelledById,
);
```

**Available engine methods:**
- `createSaleInvoiceJournalEntry`
- `createPurchaseInvoiceJournalEntry`
- `createDeliveryOrderJournalEntry`
- `createPurchaseReceiptJournalEntry`
- `createIncomingPaymentJournalEntry`
- `createOutgoingPaymentJournalEntry`
- `createSalesCreditNoteJournalEntry`
- `createPurchaseCreditNoteJournalEntry`
- `reverseJournalEntry(tx, documentType, documentId, tenantId, userId)`

All methods take `tx: Prisma.TransactionClient` as the first argument.

---

### Document with payment terms (InvoiceInstallment)

Invoices that support `PaymentTerm` must resolve the term and optionally generate installment records.

**Pattern:**

```typescript
import {
  resolvePaymentTerm,
  createInvoiceInstallments,
} from '../common/payment-term.util';

// Inside the service create/confirm transaction
const resolvedPaymentTerms = await resolvePaymentTerm(tx, tenantId, {
  paymentTermsId: dto.paymentTermsId ?? sourceDocument.paymentTermsId,
  partnerId: dto.partnerId,
  baseDate: dto.date ? new Date(dto.date) : new Date(),
  totalAmount: totals.total,
});

// Create the invoice with resolved payment data
const invoice = await tx.saleInvoice.create({
  data: {
    // ... other fields ...
    paymentTermsId: resolvedPaymentTerms.paymentTermsId,
    dueDate: resolvedPaymentTerms.dueDate,
    earlyPaymentDiscountPct: resolvedPaymentTerms.discountPct,
  },
});

// If the payment term defines installments, create them
if (resolvedPaymentTerms.installments) {
  await createInvoiceInstallments(
    tx,
    tenantId,
    invoice.id,        // saleInvoiceId
    undefined,         // purchaseInvoiceId (null for sales)
    resolvedPaymentTerms.installments,
  );
}
```

`resolvePaymentTerm` logic:
1. If `paymentTermsId` is provided, use it.
2. Else, fallback to `partner.defaultPaymentTermId`.
3. Else, fallback to `partnerGroup.defaultPaymentTermId`.
4. Calculate `dueDate = baseDate + PaymentTerm.days`.
5. If the payment term has `PaymentTermLine` rows, build an installment plan.

`createInvoiceInstallments` creates `InvoiceInstallment` records linked to the invoice.

---

## Production canon: accounting, documents, migrations and gates (T1–T91)

> Everything above is how to build a module. This section is what the module **must
> respect** in this codebase once it touches money, documents, schema or tests. The
> canonical Spanish guides are `BACKEND_GUIDE.md`, `docs/guides/ACCOUNTING_ENTRIES_GUIDE.md`
> and `AUDIT.md` (last `T*` rows). Read `BACKEND_GUIDE.md` in full before editing
> `backend-erp/src/`.

### 1. Accounting engine: every amount needs a balanced counterpart

The engine was split by family (`src/common/accounting/{sales,purchases,inventory,payments}.journal-builder.ts`
+ `journal-entry-core.ts` + the `AccountingEngineService` facade). Adding a document type
= **builder + facade method + preview `case`**, per `BACKEND_GUIDE.md` §1.

`createIncomingPaymentJournalEntry` (and every other `create*JournalEntry`) asserts the
entry is balanced **after** building and **before** persisting:

```
Asiento desbalanceado en <DOC> <code> (id=…): D=… C=… (diff=…) lines=[…]
```

That error is a **500** and it means the builder forgot a side. Real case (T91): the
incoming payment accepted `withholdingAmount` in the form, the DTO and the validation,
but the builder never read it, so any payment with a withholding died with
`diff = retención`. Two lessons that generalize:

1. **A field that changes the money must appear in the builder.** If a numeric header
   field can move the total, either the builder consumes it or the service rejects the
   request with a 400 — never leave it silently ignored.
2. **Check *all* branches of the builder.** The legacy single-method path debited the
   **gross** total in bank; once the retention joined the debit side, only the net
   balanced. When you add an amount, review each branch (`methods[]`, legacy
   `paymentMethod`, `accountLines[]`, `accountId`) for the same arithmetic.

**Retention semantics in this ERP (both directions):**

| Direction | Entry type | Account | Where |
|---|---|---|---|
| We withhold (purchases, outgoing payments) | `WITHHOLDING_TAX_PAYABLE` | `WithholdingTaxType.accountId` (liability) | purchase-invoice retention lines (gross-down/gross-up), outgoing payment |
| They withhold from us (sales, incoming payments) | `WITHHOLDING_TAX_RECEIVABLE` | `WithholdingTaxType.receivableAccountId`, else mapping (`1.1.2.08.003`) | incoming payment (T91) |

Receivable entry: `Dr Bank (net) + Dr retention receivable = Cr AR (gross invoiced)`, so
the invoice closes completely. A retention is an **asset**, not a liability: never reuse
the IT/IUE payable account for it. Config lives in `prisma/seed.ts` (IT → `1.1.2.08.001`,
IUE → `1.1.2.08.002`; RC-IVA has none because we are the agent) and is backfilled for
existing tenants by `scripts/ensure-accounts-existing-tenants.ts` (**idempotent, null-only
— never overwrite what the tenant configured**).

### 2. Account determination hierarchy (T67 + T68)

- Level **ITEM**: item-warehouse matrix → item master → `AccountMapping` **only** for the
  entry types in `ITEM_ENTRY_TYPES_WITH_MAPPING_FALLBACK`; anything else throws with the
  level and the sources to configure (strict by design).
- Partner accounts: `AccountDeterminationService._resolvePartnerVariantAccount` picks the
  **M/N vs M/E variant** (`receivableAccountIdLocal/Foreign`, …) using, in order: document
  currency ≠ base currency, partner default currency ≠ base, partner country ≠ tenant
  country (country is free text: name↔ISO aliases; unreadable → **local**, so a typo never
  moves an account). Empty variant → generic partner account → mapping.
- A new account must be added to `src/common/chart-of-accounts.data.ts` **and** its seed
  mapping in `src/common/account-mappings.util.ts`; then run
  `ensure-accounts-existing-tenants.ts` + `ensure-mappings-existing-tenants.ts`.

### 3. Document numbering: series emit `prefix + counter`, no fiscal year (T81)

`DocumentSeriesService._consumeSeries` assigns `prefix + nextNumber`, and the code does
**not** include the fiscal year, so two active series of the same `docType` with the same
prefix collide against the unique index `(tenantId, code)` (a hard 500). The service now
**self-heals** the counter against `MAX(code)` for that prefix (cached per series and
process) and, if the assigned number is already taken, consumes the next one (up to 10
attempts). Practical rules:

- QA data should start series counters **very high**: the frontend Playwright helper
  `e2e/helpers/ensure-document-series.ts` uses `startNumber: 1000` for exactly this reason.
  The backend E2E fixture (`test/test-utils.ts`) still creates its series at `1`, which is
  safe only because each suite runs on a wiped `erp_test` with its own documents; do not
  copy that pattern for shared/long-lived data.
- Never "fix" a collision by editing `nextNumber` alone in CI data: the healing is in the
  service, and a new low counter will collide again.

### 4. Schema changes under known drift (DT.45) — the real procedure

The dev/prod database carries drift vs `prisma/migrations`, so `prisma migrate dev` and
`prisma db push` abort asking for a **reset** (which would drop data). The procedure used
by the last fronts:

```bash
# 1. Write the model change in prisma/schema.prisma and validate it
npx prisma validate

# 2. Generate the SQL delta between the LIVE database and the new schema
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script

# 3. Save it as a migration folder AND make the DDL idempotent
#    (ADD COLUMN IF NOT EXISTS, FK guarded by a pg_constraint DO block):
#    prisma/migrations/<timestamp>_<name>/migration.sql

# 4. Apply it to the dev database and register it as applied
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/<ts>_<name>/migration.sql
npx prisma migrate resolve --applied <timestamp>_<name>

# 5. Regenerate the client (it holds a DLL: stop the running backend first)
npx prisma generate
```

Why idempotent: the runbook's production pipeline applies `prisma migrate deploy` **and**
the manual SQLs in `prisma/manual/` (drift), so a non-idempotent script can run twice
(see the `P3009` incident in `docs/plans/runbook-go-live.md` §3.1). After the schema
change, re-run the seed/mapping alignment for existing tenants.

### 5. Bulk import: one shared workbook format (T69 + T70)

New importers use `src/common/import-workbook.util.ts` (3 sheets: **Datos** with friendly
headers and `EJEMPLO:` rows the importer skips, **Instrucciones**, **Catálogos** with the
tenant's codes) and `src/common/bulk-import-http.util.ts` (download + parse the uploaded
xlsx, 10 000 row cap). Contracts: **upsert by code** (re-import updates, never duplicates),
`BulkImportSummary` with `created/updated/errors/total`, endpoints
`GET/POST /<entity>/bulk-import[/template]`, and one transaction per aggregate (e.g. one
per price list) so a bad row does not roll back the whole file.

### 6. Load tests need a real fiscal context (T78 + T89)

`npm run perf:k6` runs 5 k6 scenarios. Two traps found in practice:

- The **seed does not create** today's exchange rate, an open fiscal year or a document
  series, so scenarios failed with 400 until `perf/ensure-context.ts` (`ensureLoadTestContext`)
  started creating them through the API, exactly like the E2E helpers.
- **k6's JS engine (goja) has no object spread** in object literals (ES2018): building
  thresholds with `{ ...fn() }` makes all scenarios fail to load, and a Node pre-check
  reports "fine" because Node supports it. **Validate any change under `load-tests/k6/`
  by running k6.**
- Latency thresholds are per **scenario**, not per profile. `K6_LATENCY_MODE=report`
  (scheduled `large` job) enforces only the failure thresholds and reports latency;
  `enforce` is the default for the PR gate.

### 7. Tests: what to run and what to assert

```bash
npm run build && npm run lint         # 0 errors, 0 warnings
npm test                              # 164 suites / 1823 tests (unit)
npm run test:e2e                      # 14 suites / 93 tests — chains prisma db push on erp_test
npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.spec.json
npx tsc -p tsconfig.perf.json --noEmit   # this one INCLUDES prisma/** (seed scripts)
```

- **`tsconfig.json` excludes `prisma/`**: `prisma/seed.ts` is only type-checked by
  `tsconfig.perf.json`. A seed edit that type-checks nowhere will break `db seed` in CI.
- New `create*` flow → assert the **API responds with the document** (not `{}` with 201):
  the `await this.prisma.$transaction(...)` without capturing/returning was a real silent
  bug (`BACKEND_GUIDE.md` §4).
- New accounting behaviour → cover it with a **unit test on the engine** (mock
  `AccountDeterminationService.resolveAccount` and assert the persisted lines and that
  debits equal credits) **and** an E2E in `test/` that creates the real documents and
  asserts the journal lines with Prisma (see the T91 tests in
  `test/incoming-payments.e2e-spec.ts`: type WITH its receivable account, type WITHOUT it
  falling back to the mapping, and the rejection path).
- No `any` anywhere, specs included (`@typescript-eslint/no-explicit-any` is an **error**
  for `src/**/*.spec.ts`); mocks use `as unknown as T` / `jest.Mocked<T>`.

### 8. Backend checklist before delivering

- [ ] `npm run build`, `npm run lint`, `npm test` green; both `tsc --noEmit` (project +
      specs) and `tsc -p tsconfig.perf.json` clean when you touched `prisma/`.
- [ ] Multi-tenancy: every query filtered by `tenantId` (the Prisma extension injects it in
      `findMany/count/updateMany/create`, **not** in `findUnique/delete/upsert` — pass it
      explicitly there).
- [ ] `@RequirePermission(...)` on new endpoints; DTOs validated (`whitelist`,
      `forbidNonWhitelisted`, `transform`).
- [ ] Money/stock side effects inside **one** transaction, and the endpoint returns the
      created document.
- [ ] Schema change: idempotent migration + `migrate resolve --applied` + seed/alignment
      scripts updated + `prisma generate` (with the dev backend stopped).
- [ ] Accounting change: balanced entry proven by test (unit + E2E), and the
      `ACCOUNTING_ENTRIES_GUIDE.md` section for that document type updated.
- [ ] Document the outcome in `backend-erp/CHANGELOG.md` (and `AUDIT.md` for defects).

---

## References

- **Boilerplate module template**: See `references/module-template.md` for copy-paste controller, service, module, and DTO boilerplate adapted to this ERP (including SAP aliases).
- **Testing recipes**: See `references/testing-recipes.md` for mocking PrismaService and writing service/controller specs (strictNullChecks-compliant).
- **Document flow guide**: See `references/document-flow.md` for creating documents with lines, stock updates, traceability, and SAP alias resolution.
