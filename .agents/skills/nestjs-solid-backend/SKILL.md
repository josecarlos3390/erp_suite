---
name: nestjs-erp-backend
description: Scaffold and maintain NestJS backend modules for an ERP system using Prisma, PostgreSQL, multi-tenancy, document flows (header + lines), stock tracking, and Bolivian tax rules. Use when creating new backend modules, DTOs, controllers, services, Prisma migrations, or tests in the backend-erp project. Covers transaction-safe document creation, code generation, pricing/stock/tax utilities, Swagger/OpenAPI, and functional testing with mocked PrismaService.
---

# NestJS ERP Backend

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
  const toNumber = ({ value }: { value: any }) => (value != null ? Number(value) : value);
  ```
- Nested arrays: use `@IsArray()`, `@ValidateNested({ each: true })`, `@Type(() => InnerDto)`.
- **Swagger:** add `@ApiProperty()` or `@ApiPropertyOptional()` to every DTO property so OpenAPI schema is complete.

### 4. Controller rules

- `@Controller('resource-name')` — kebab-case matching the module folder.
- `@ApiTags('ResourceName')` and `@ApiBearerAuth()` on the class.
- Use `@Public()` to bypass JWT on specific routes.
- Use `@Roles('ADMIN' | 'USER')` for authorization.
- Extract user identity with `@CurrentUser() user: JwtPayload`.
- Delegate 100% of logic to the service.

```typescript
@Controller('purchase-orders')
@ApiTags('PurchaseOrders')
@ApiBearerAuth()
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Post()
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub, user.tenantId);
  }
}
```

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
| `recalcQuoted` | `stock.util` | Update `stockQuoted` after document changes |
| `resolveLineTaxIndicator` | `tax-indicator.util` | Resolve which tax indicator applies to a line |
| `upsertStock` | `stock.util` | Maintain denormalized `Stock` table |
| `calcProgress` | `progress.util` | Compute `deliveryStatus` / `invoiceStatus` |

All these functions accept `tx: Prisma.TransactionClient` as the first argument.

### 7. Document flow (header + lines)

Documents in this ERP have a **header** and **lines** (líneas):

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

### 10. Testing pattern

Mock `PrismaService` with `jest.fn()` — never hit a real database in unit tests.

```typescript
const mockPrisma = {
  $transaction: jest.fn(async (fn) => fn(mockTx)),
  document: { findMany: jest.fn(), create: jest.fn() },
};

beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      PurchaseOrdersService,
      { provide: PrismaService, useValue: mockPrisma },
    ],
  }).compile();
});
```

See `references/testing-recipes.md` for full service and controller test templates.

### 11. Error handling

Throw NestJS HTTP exceptions from services:

- `NotFoundException` — resource not found
- `BadRequestException` — invalid input / business rule violation
- `ConflictException` — unique constraint violation (catch `PrismaClientKnownRequestError` code `P2002`)
- `UnauthorizedException` — auth failures
- `InternalServerErrorException` — unexpected errors

## References

- **Boilerplate module template**: See `references/module-template.md` for copy-paste controller, service, module, and DTO boilerplate adapted to this ERP.
- **Testing recipes**: See `references/testing-recipes.md` for mocking PrismaService and writing service/controller specs.
- **Document flow guide**: See `references/document-flow.md` for creating documents with lines, stock updates, and traceability.
