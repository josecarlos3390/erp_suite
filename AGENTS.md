# AGENTS.md — erp_suite

ERP suite for the Bolivian market, inspired by SAP Business One. Monorepo with two independent sub-projects:

- **`backend-erp/`** — NestJS 11.0.1 REST API (TypeScript 5.7.3, Prisma 6.19.2, PostgreSQL)
- **`erp-frontend/`** — Angular 19.2.19 SPA (TypeScript ~5.7.2, Angular Material 19.2.19, standalone components, SSR enabled)

Both sub-projects use **npm** as the package manager.

---

## Build / Lint / Test Commands

All commands must be run from the relevant sub-project directory.

### Backend (`backend-erp/`)

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Start dev server (watch mode)
npm run start:dev

# Start production server
npm run start:prod

# Format code (Prettier)
npm run format

# Lint (ESLint v9 flat config, auto-fix)
npm run lint
# Note: ~0 warnings remain (unused imports/variables cleaned in Apr 2026)

# Run ALL unit tests
npm test

# Run a SINGLE test file
npx jest src/auth/auth.service.spec.ts

# Run tests matching a name pattern
npx jest --testNamePattern="should login"

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e

# Prisma: generate client
npx prisma generate

# Prisma: create and apply migration
npx prisma migrate dev --name <migration-name>

# Prisma: seed database
npx prisma db seed
```

### Frontend (`erp-frontend/`)

```bash
# Install dependencies
npm install

# Start dev server
npm start

# Build for production
npm run build

# Build in watch mode
npm run watch

# Lint (ESLint v9 flat config + Angular ESLint + Prettier)
npm run lint
# Note: ~0 warnings remain (unused imports/variables cleaned in Apr 2026)

# Format code (Prettier)
npm run format

# Run ALL unit tests (Karma + Jasmine, headless)
npm test

# Run a single test file (headless, no watch)
npx ng test --include="**/auth.service.spec.ts" --watch=false --browsers=ChromeHeadless

# Serve SSR build locally (production output)
npm run serve:ssr:erp-frontend

# Run E2E tests (Playwright)
npm run e2e

# Open Playwright UI mode
npm run e2e:ui

# Open Playwright HTML report
npm run e2e:report
```

---

## Git Hooks (Husky + lint-staged)

Both sub-projects are **independent Git repositories** (each has its own `.git` directory). Therefore, pre-commit hooks are configured individually in each sub-project, not at the monorepo root.

### Backend (`backend-erp/`)

- **Pre-commit** `.husky/pre-commit` + `.lintstagedrc.js`:
  - On commit of any `src/**/*.{ts,tsx}`: `npm run lint` (ESLint v9 flat config, auto-fix)
  - ~10-30 seconds (varía según cantidad de archivos staged)
- **Pre-push** `.husky/pre-push`:
  - `npm test` (Jest, 321 tests)
  - ~30-60 seconds
- **Install:** already initialized via `npx husky init` after `npm install`

### Frontend (`erp-frontend/`)

- **Pre-commit** `.husky/pre-commit` + `.lintstagedrc.js`:
  - On commit of any `src/**/*.{ts,html,scss}`: `npm run lint` (ESLint v9 + Angular ESLint + Prettier)
  - ~20-60 seconds (varía según cantidad de archivos staged)
- **Pre-push** `.husky/pre-push`:
  1. `npx ng test --watch=false --browsers=ChromeHeadless` (Karma + Jasmine, 524 tests)
  2. `npm run build` (production build verification)
  - ~2-4 minutes
- **Install:** already initialized via `npx husky init` after `npm install`

### Notes

- The monorepo root also has Husky installed, but it only acts on the root repo (which contains config files only). It can be ignored or removed if desired.
- lint-staged uses **function syntax** for commands to prevent passing staged filenames as CLI arguments (which would break Jest/Angular CLI pattern matching).
- Pre-commit is intentionally **fast** (lint only); pre-push catches the slower validations (tests + build) before code reaches the remote.

---

## Backend Type Design Rules (Post-Refactor)

> **Context:** Apr 2025 — removed 1,629 `as any` casts, fixed implicit-`any` parameters, enforced strict typing across 78 test suites / 330 tests.  
> **Update Apr 2026:** `strictNullChecks: true` enabled. All `as any` eliminated from `src/` and `prisma/` scripts. Current count: **0 `as any` in production code**.  
> **Update Apr 2026 (batch/serial phase 2+3):** Lint clean, build clean, 58 suites / 191 tests passing.  
> **Goal:** keep the backend at `0 errors, 0 any-casts`.

### 1. Zero `as any` policy

- **Never** use `as any` to bypass the compiler. If a type mismatch exists, fix the type (DTO, interface, or Prisma payload) rather than casting.
- The only acceptable exception is test mocks where the shape is intentionally partial, and even then prefer `as unknown as MyType` or `satisfies Partial<MyType>`.

### 2. Prisma query payloads must be typed

- When selecting nested relations with `include`, assign the result to a typed variable or use `Prisma.*GetPayload<typeof include>`:
  ```typescript
  const include = {
    partner: true,
    items: { include: { item: true } },
  } as const;
  type OrderWithItems = Prisma.SalesOrderGetPayload<{
    include: typeof include;
  }>;
  ```
- Avoid `const order: any = await tx.salesOrder.findUnique(...)`.

### 3. DTOs are interfaces, not `any`

- All controller inputs use `class-validator` DTOs. Never accept `body: any`.
- If a DTO needs to be reused across modules, place it in `src/common/dto/` or colocate it with the domain DTOs.

### 4. Service return types are explicit

- Every public service method must declare its return type:
  ```typescript
  async findOne(id: number): Promise<SaleInvoiceDto> { ... }
  async confirm(id: number): Promise<void> { ... }
  ```
- This prevents accidental leakage of internal Prisma types to controllers.

### 5. Utility helpers must be generic, not `any`

- Traceability utilities (`traceability.util.ts`), code generators (`code-generator.util.ts`), and pricing helpers must use generics instead of `any` parameters:
  ```typescript
  // ✅ Correct
  function mapDocument<T extends { id: number }>(doc: T): T { ... }
  // ❌ Wrong
  function mapDocument(doc: any): any { ... }
  ```

#### Discriminated unions for dynamic Prisma delegates

When a utility must call different Prisma models dynamically (e.g. `tx.salesOrderItem.update` vs `tx.purchaseOrderItem.update`), **do not** use `unknown` args + `as any` inside a `switch`. Use a discriminated union:

```typescript
type LineModelUpdatePayload =
  | { model: 'salesQuotationItem'; args: Prisma.SalesQuotationItemUpdateArgs }
  | { model: 'salesOrderItem';      args: Prisma.SalesOrderItemUpdateArgs }
  | { model: 'purchaseOrderItem';   args: Prisma.PurchaseOrderItemUpdateArgs };

async function updateLineModel(tx: TX, payload: LineModelUpdatePayload): Promise<void> {
  switch (payload.model) {
    case 'salesQuotationItem': await tx.salesQuotationItem.update(payload.args); break;
    case 'salesOrderItem':      await tx.salesOrderItem.update(payload.args);      break;
    case 'purchaseOrderItem':   await tx.purchaseOrderItem.update(payload.args);   break;
  }
}
```

This pattern (used in `src/common/traceability.util.ts`) gives TypeScript exact narrowing inside each `case` branch with **zero casts**.

### 6. Test mocks

- Mocked providers in `*.spec.ts` should be fully typed objects:
  ```typescript
  { provide: ItemsService, useValue: {
    findOne: jest.fn().mockResolvedValue(mockItem),
  } as unknown as ItemsService }
  ```
- Avoid `useValue: {}` or `useValue: { findOne: jest.fn() }` without typing.

### 7. Current lint & test status

- `npm run lint` → `0 errors, ~0 warnings` (unused imports/variables cleaned).
- `npm run build` → `0 errors`.
- `npm test` → **60 suites, 321 tests** passing.
- `as any` count in `src/` → **0**.
- `as any` count in `prisma/` scripts → **0**.
- `as any` count in `*.spec.ts` → **0** (all mocks use `as unknown as` or `satisfies Partial<T>`).

---

## Backend strictNullChecks Migration (Apr 2026)

> **Context:** enabled `strictNullChecks: true` in `tsconfig.json` while keeping `strict: false` and `noImplicitAny: false`.  
> **Result:** 0 build errors, 0 test regressions, 175 tests passing.  
> **Goal:** document safe patterns so future agents don't break the build when touching nullable fields.

### 1. Safe patterns we used (copy-paste ready)

| Problem | Pattern | Example |
|---------|---------|---------|
| `tenantId?: number` param later passed to Prisma | Assert at call site with `tenantId!` or `tenantId as number` inside data objects (never add runtime throws in hot paths) | `data: { tenantId: tenantId!, ... }` |
| `.find()` after an existence check | Non-null assertion `)!` when preceded by `if (!x) throw` | `const parent = parents.find(p => p.id === id)!;` |
| `Map.get()` used in arithmetic | `(map.get(key!) ?? 0)` when the key may be nullable | `const qty = (whItemMap.get(orderItemId!) ?? 0) + line.quantity;` |
| Accumulator arrays (`lineCalcs`, `invoiceLines`) | Declare as `const arr: any[] = []` (temporary; see improvement §3) | `const lineCalcs: any[] = [];` |
| `let x = null` later used as object | `let x: any = null` to avoid `TS7006` | `let siTaxInd: any = null;` |
| Optional relation (`di.order?.items`) | `di.order!.items` after null-check or `di.order?.items ?? []` | `for (const oi of di.order!.items) { ... }` |

### 2. What NOT to do

- ❌ Do **not** add runtime `if (!tenantId) throw new BadRequestException(...)` inside every private helper — it bloats the code and can break existing tests that pass `undefined` to internal methods.
- ❌ Do **not** widen DTO base classes (`BaseDocumentDto`) unless all subclasses already agree on the type; prefer `string | null` only when the DB schema truly allows `NULL`.
- ❌ Do **not** use `// @ts-ignore` or `// @ts-expect-error` — the build now has zero suppression comments.

### 3. Tech-debt opportunities — STATUS UPDATE (Apr 2026)

| # | Opportunity | Status | Notes |
|---|-------------|--------|-------|
| 1 | **`tenantId` should be mandatory in public methods** | 🔄 Partial | Controllers fixed to pass `tenantId` where missing (`sales-orders.updateItem`, `purchase-orders.close`, `purchase-orders.updateItem`). Private helpers already use `tenantId: number`. ~70 `tenantId!` remain in public methods across 7 services; requires mass controller + test refactor to eliminate safely. |
| 2 | **Accumulator arrays need real interfaces** | ✅ Done | `purchase-orders`: `LineWithIndicatorResult[]`; `sales-orders`: `SalesOrderLineCalc[]`; `sales-quotations`: `SalesQuotationLineResult[]`; `purchase-quotations`: `PurchaseQuotationLineResult[]`; `sale-reserve-invoices`: `SaleReserveInvoiceLine[]`. |
| 3 | **Tax-indicator temporaries** | ✅ Done | `purchase-invoices.service.ts`: `let riTaxInd: TaxIndicator | null = null` and `let siTaxInd: TaxIndicator | null = null`. |
| 4 | **`BaseDocumentDto.dueDate`** | ✅ Done | Subclasses with `dueDate?: string` tightened to `dueDate?: string | null` to match the DB schema (`DateTime?`) and the base DTO. |
| 5 | **Test mocks still use `as any`** | ✅ Done | All spec files use `as unknown as PrismaService` or `satisfies Partial<PrismaService>` for mocks. No `as any` remains in tests. |

---

## Frontend Type Design Rules (Post-Refactor)

> **Context:** Apr 2025 — massive type-cleanup (`as any` removal, TS2339/TS2551 fixes, model deduplication).
> **Goal:** prevent the ~110 TypeScript errors from recurring.

### 1. Single source of truth for domain models

- `src/app/models/*.model.ts` (barreled via `index.ts`) **must** be the only place where domain interfaces like `PurchaseOrder`, `SalesOrder`, `DeliveryOrder`, `PurchaseReceipt`, etc. are defined.
- **Do NOT redefine** these interfaces inside services (`*.service.ts`) or inside page-local `*.interface.ts` files.
- If a service needs a narrower shape (e.g. a draft without `id`), **extend** the global model:
  ```typescript
  import { PurchaseOrder } from "@models/purchase-order.model";
  export interface PurchaseOrderDraft extends Omit<
    PurchaseOrder,
    "id" | "code"
  > {
    quotationId: number;
  }
  ```

### 2. No inline stubs for `PartnerSummary` / `ItemSummary`

- Never write `partner: { id: number; name: string }` inside a service or component.
- Import `PartnerSummary` from `@models/partner-summary.model` or `ItemSummary` from `@models/item-summary.model`.
- If you need extra fields (e.g. `defaultTaxIndicatorId`), extend inline:
  ```typescript
  partner: PartnerSummary & { defaultTaxIndicatorId?: number | null };
  ```

### 3. Draft interfaces belong in `models/`, not in pages

- `DeliveryOrderDraft`, `SalesOrderDraft`, `PurchaseOrderDraft`, etc. should live in `src/app/models/delivery-order.model.ts` (or a dedicated `*-draft.model.ts`).
- Removing local `*-draft.interface.ts` files inside `pages/*/` prevents drift between the backend response and the frontend type.

### 4. Shared payment types

- `PaymentStatus`, `PaymentMethod`, and `AvailableAdvance` live in **`src/app/models/payment-common.model.ts`**.
- Do NOT redefine them in `incoming-payment.model.ts` or `outgoing-payment.model.ts`.

### 5. If the backend sends it, the model must expose it

- When a form accesses a field (e.g. `draft.isExpired`, `line.pendingInvoiceQty`, `order.warehouseId`) and TypeScript complains with `TS2339`, **add the optional field to the model** rather than casting:
  ```typescript
  // ✅ Correct
  export interface DeliveryOrderDraft {
    /* ... */
    isExpired?: boolean;
    validUntil?: string | Date | null;
  }
  // ❌ Wrong
  (draft as any).isExpired;
  ```

### 6. POS and polymorphic endpoints

- Endpoints that return either an array or a wrapper object (`{ data: T[] }`) must be typed explicitly:
  ```typescript
  getRecentInvoices(limit = 10) {
    return this.http.get<any[] | { data: any[] }>(`${environment.apiUrl}/sale-invoices`, {
      params: new HttpParams().set('limit', limit).set('isIns', 'N'),
    });
  }
  ```
- This avoids `Array.isArray(r)` narrowing `r` to `never` in the `else` branch.

### 7. Form `getRawValue()`

- Prefer giving the raw value an explicit interface over casting individual properties:
  ```typescript
  const raw = this.form.getRawValue() as PriceListFormRaw;
  ```

### 8. Current lint warning count (post-cleanup)

- **Frontend:** `ng lint` → `0 errors, ~0 warnings` (`: any` cleanup reduced most noise; remaining are unused imports/variables — safe to ignore or clean gradually).
- **Backend:** `npm run lint` → `0 errors, ~80 warnings` (same category).

---

## Frontend Zero `: any` Migration (Apr 2026)

> **Context:** `strict: true` en Angular 19. Se eliminaron ~318 ocurrencias de `: any` en el frontend, quedando solo 2 intencionales en `luna-data-table.types.ts`. `ng build` y `ng lint` limpios.  
> **Goal:** mantener `ng build` en verde sin usar `: any` como atajo.

### 1. Política de `any`

| Situación | Qué hacer |
|-----------|-----------|
| Modelo de dominio le falta un campo que el backend envía | **Agregar el campo opcional al interface** (`baseDocType?: string \| null`) en vez de `(line as any).baseDocType` |
| Builder de líneas recibe objetos heterogéneos (modelo + campos extra del draft) | Usar `unknown` + `Record<string, unknown>` + bracket access (ver §2) |
| Callback genérico de tabla (`format`, `badgeVariant`) | **Excepción aceptada:** `any` está permitido solo en `LunaColumn.format` y `LunaColumn.badgeVariant` porque `value` puede ser cualquier celda de cualquier modelo |
| Errores HTTP (`err?.error?.message`) | Tipar `error` como `unknown`, castear a `{ error?: { message?: string } }` antes de acceder |
| Catálogo de items (`Item[]`) vs resultados de búsqueda (`ItemSearchResult[]`) | Tipar el array del componente como `ItemSearchResult[]` en vez de `Item[]`; si necesitas `createdAt`, extiende `ItemSearchResult` o usa `Item` directamente en el servicio |
| Campos dinámicos JSON (`customFields`) | Usar `Record<string, any>` en el interface del modelo (es la única excepción de modelo) porque el formulario construye un `FormGroup` dinámico |

### 2. Patrón `buildLineGroup` — objetos heterogéneos sin `any`

Cuando un builder de líneas debe aceptar tanto un modelo canónico (ej. `PurchaseInvoiceItem`) como un objeto enriquecido por el backend (ej. `PurchaseInvoiceDraftItem` con `description`, `quotationCode`, etc.), **nunca** uses `l: any`.

```typescript
// ✅ Correcto
private buildLineGroup(l: unknown) {
  const li = l as Record<string, unknown>;
  const price = Number(li['price']);
  const qty   = Number(li['quantity']);

  return this.fb.group({
    itemId:   [li['itemId'], Validators.required],
    quantity: [qty, [Validators.required, Validators.min(0.001)]],
    price:    [price],
    // ...
    baseDocType: [(li['baseDocType'] as string | null | undefined) ?? null],
    baseDocId:   [(li['baseDocId']   as number | null | undefined) ?? null],
    customFields: this.fb.group((li['customFields'] as Record<string, unknown> | undefined) ?? {}),
  });
}

// ❌ Prohibido
private buildLineGroup(l: any) { ... }
```

**Ventajas:**
- Evita `TS4111` (index signature access) porque `Record<string, unknown>` sí tiene índice string.
- Evita `TS2339` (missing property) porque no declaras que `l` sea `PurchaseInvoiceItem`.
- El cast es explícito y localizado; no contamina el resto del método.

### 3. Extender modelos canónicos en vez de `any`

Si un formulario o servicio necesita un campo que no existe en el interface, **agrégalo como opcional**:

```typescript
// ✅ Correcto
export interface PurchaseInvoiceItem {
  // ... campos existentes ...
  lineNum?:     number | null;
  baseDocType?: string | null;
  baseDocId?:   number | null;
  baseLineId?:  number | null;
  baseLineNum?: number | null;
  lineStatus?:  string;
}

// ❌ Prohibido
(draft as any).baseDocType = 'PURCHASE_ORDER';
```

### 4. Draft interfaces explícitas

Los servicios que generan borradores multi-fuente deben declarar su propia interfaz de draft:

```typescript
export interface PurchaseInvoiceDraft {
  warehouseId?: number | null;
  supplierId?:  number;
  hasExpired?:  boolean;
  expiredCodes?: string[];
  partner?:     { id: number; name: string };
  items?:       PurchaseInvoiceDraftItem[];
}

export interface PurchaseInvoiceDraftItem {
  itemId:          number;
  itemName?:       string;
  description?:    string;
  itemCode?:       string;
  price?:          number | null;
  // ... campos de traceabilidad opcionales ...
  quotationItemId?: number;
  quotationId?:     number;
  orderItemId?:     number;
  orderId?:         number;
  receiptItemId?:   number;
  receiptId?:       number;
}
```

Esto permite que `buildLineGroup` reciba `PurchaseInvoiceDraftItem | PurchaseInvoiceItem` sin caer en `any`.

### 5. Type guards para fechas

Cuando `date` puede ser `string`, `Date` o `unknown`:

```typescript
// ✅ Correcto
const d = typeof value === 'string' || value instanceof Date
  ? new Date(value)
  : null;

// ❌ Prohibido
const d = new Date(value as any);
```

### 6. Errores HTTP tipados

```typescript
// ✅ Correcto
.subscribe({
  next: () => { ... },
  error: (err: unknown) => {
    const msg = (err as { error?: { message?: string } }).error?.message ?? 'Error desconocido';
    this.toast.error(msg);
  },
})

// ❌ Prohibido
error: (err: any) => { this.toast.error(err?.error?.message); }
```

### 7. Excepción arquitectónica: `LunaDataTable`

`LunaColumn.format` y `LunaColumn.badgeVariant` retienen `any` porque la tabla es genérica y forzar `unknown` obligaría a castear en ~40 listas de documentos. Esta excepción está **documentada y aceptada**; no requiere acción.

### 8. `as any` en tests (`.spec.ts`)

Se permiten `as any` **únicamente** en archivos de prueba cuando se mockean respuestas de `HttpClient` o servicios con objetos parciales:
```typescript
svc.getById.and.returnValue(of(doc) as any);
```
Esta excepción es práctica porque los mocks raramente cumplen el tipo completo del `Observable`. En código fuente (`.ts` sin `.spec`) está **prohibido**.

```typescript
export interface LunaColumn<T = unknown> {
  // ...
  format?:      (value: any, row: T) => string;
  badgeVariant?: (value: any, row: T) => LunaBadgeVariant;
}
```

---

## CI/CD (GitHub Actions)

Both repositories have GitHub Actions workflows that run on every `push` to `main` and every `pull_request` targeting `main`.

### Backend (`backend-erp/.github/workflows/ci.yml`)

Runs on `ubuntu-latest` with Node 20:

1. `npm ci`
2. `npm run lint` (ESLint v9 flat config)
3. `npm test` (Jest, 321 tests)

### Frontend (`erp-frontend/.github/workflows/ci.yml`)

Runs on `ubuntu-latest` with Node 20:

1. `npm ci`
2. `npm run lint` (ESLint v9 + Angular ESLint + Prettier)
3. `npx ng test --watch=false --browsers=ChromeHeadless` (Karma + Jasmine, 268 tests)
4. `npm run build` (production build verification)
5. `npx playwright install --with-deps` + `npm run e2e` (Playwright, 14 tests en Chromium + Firefox)

### Notes

- CI acts as a **safety net** when developers bypass local hooks (`git commit --no-verify`).
- If CI fails, the PR cannot be merged safely.
- Cache is enabled for `npm` to speed up workflow runs.

---

## Project Architecture

### Backend

- `src/<module>/` — one NestJS module per business domain. Each module contains: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, and colocated `*.spec.ts`.
- `src/common/` — shared utilities: pagination, code generation, pricing, stock, traceability, tax indicators, payment utils, progress utils, **accounting engine**.
- `src/prisma/` — global `PrismaService` extending `PrismaClient`.
- `src/auth/` — JWT auth: guards (`JwtAuthGuard`, `RolesGuard`), strategies (`JwtStrategy`), decorators (`@Public()`, `@Roles()`, `@CurrentUser()`), DTOs.
- `prisma/schema.prisma` — single source of truth for DB schema.
- `test/` — E2E specs (`*.e2e-spec.ts`) with `jest-e2e.json` config.

**Backend modules (27 domains):**
`account-mappings`, `auth`, `common`, `delivery-orders`, `document-flow`, `item-groups`, `items`, `journal-entries`, `partner-groups`, `partners`, `pos`, `price-lists`, `prisma`, `purchase-invoices`, `purchase-orders`, `purchase-quotations`, `purchase-receipts`, `purchase-reserve-invoices`, `sale-invoices`, `sale-reserve-invoices`, `sales-orders`, `sales-quotations`, `settings`, `tax-indicators`, `tenants`, `users`, `warehouses`.

### Frontend

- `src/app/pages/` — one folder per business module, mirroring backend domains.
- `src/app/models/` — TypeScript interfaces only (no classes). Barrel export in `index.ts`.
- `src/app/api-types/` — **auto-generated types from Prisma schema** (`prisma-types.ts`). Zero runtime dependencies. Coexists with hand-written models.
- `src/app/auth/` — `AuthService`, functional interceptors (`authInterceptor`), functional guards (`authGuard`, `roleGuard`).
- `src/app/core/` — layout (`LayoutComponent`, `HeaderComponent`, `SidebarComponent`), toast (`ToastService`), confirm dialog, theme, global `httpErrorInterceptor`.
- `src/app/shared/` — reusable standalone components and shared infrastructure:
  - `document-flow/` — traceability panel, line status badges, document flow service
  - `document-form/` — `DocumentFormBase` (abstract class), `DocumentLineArrayService`, `DocumentFormUtils`
  - `partner-selector/`, `item-search-modal/`, `tax-indicator-selector/`, `warehouse-selector/`, `paginator/`, `section-lock-overlay/`
- `src/environments/` — `environment.ts` (dev, dynamic host detection) and `environment.prod.ts` (production/Render API URL).
- `src/login/` — standalone `LoginComponent` outside the main layout.

**Frontend pages (21 domains):**
`dashboard`, `delivery-orders`, `item-groups`, `items`, `partner-groups`, `partners`, `pos`, `price-lists`, `profile`, `purchase-invoices`, `purchase-orders`, `purchase-quotations`, `purchase-receipts`, `purchase-reserve-invoices`, `sale-invoices`, `sale-reserve-invoices`, `sales-orders`, `sales-quotations`, `settings`, `tax-indicators`, `users`, `warehouses`.

**Models present (17 files):** `item.model.ts`, `partner.model.ts`, `pagination.model.ts`, `warehouse.model.ts`, `tax-indicator.model.ts`, `price-list.model.ts`, `document-flow.model.ts`, `document-line.model.ts`, `sales-quotation.model.ts`, `purchase-quotation.model.ts`, `sales-order.model.ts`, `purchase-order.model.ts`, `delivery-order.model.ts`, `purchase-receipt.model.ts`, `sale-invoice.model.ts`, `purchase-invoice.model.ts`, `sale-reserve-invoice.model.ts`, `purchase-reserve-invoice.model.ts`.

---

## Code Style Guidelines

### TypeScript (Both Projects)

- **Formatter:** Prettier with `singleQuote: true`, `trailingComma: 'all'`.
- **Naming:**
  - Classes, decorators, interfaces: `PascalCase`
  - Methods, properties, variables: `camelCase`
  - Constants: `SCREAMING_SNAKE_CASE`
  - File names: `kebab-case.type.ts` (e.g., `auth.service.ts`, `create-user.dto.ts`)
  - Module directories: `kebab-case` (e.g., `sales-quotations/`)
- **Imports:** named imports grouped per source; prefer path aliases over deep relative paths (`../../../`).
- **Comments:** written in **Spanish** (project language).
- **Section separators:** `// ────────────────`
- **Annotation conventions:**
  - Bug fixes: `// ✅ BUG-XX FIX: <description>`
  - Security fixes: `// ✅ SEC-XX FIX: <description>`
  - Improvements: `// ✅ MEJORA: <description>`

### Backend (NestJS)

- **TypeScript strictness:** `strict: false`, **`strictNullChecks: true`**, `noImplicitAny: false` — `null`/`undefined` are now enforced by the compiler; `any` and implicit-any remain relaxed.
- **Return types:** annotate async method return types explicitly (`Promise<string>`, `Promise<void>`, etc.).
- **Interfaces over classes** for DTOs inputs/outputs, JWT payloads, utility types.
- **`as const`** for constant objects (e.g., `SAFE_SELECT`, `CODE_SEQUENCES`).
- **Enum values:** string union types or Prisma-generated enums in `SCREAMING_SNAKE_CASE` (`'ACTIVE' | 'INACTIVE'`).
- **Vertical alignment** of properties in object literals for readability.
- **NestJS module pattern:**
  ```typescript
  @Controller("resource")
  export class ResourceController {
    constructor(private readonly resourceService: ResourceService) {}
  }
  ```
- **DTOs:** use `class-validator` decorators (`@IsString()`, `@IsEmail()`, `@IsOptional()`, etc.).
- **Global `ValidationPipe`:** configured with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- **Prisma:**
  - Use `PrismaService` (global module) via constructor injection.
  - Wrap multi-step writes in `this.prisma.$transaction(async tx => { ... })`.
  - Soft deletes: set `status: 'INACTIVE'` — never hard-delete business records.
  - Use `$queryRawUnsafe` only for PostgreSQL sequences (code generation).
- **Error handling:** throw NestJS HTTP exceptions from services:
  - `NotFoundException` — resource not found
  - `BadRequestException` — invalid input / business rule violation
  - `ConflictException` — unique constraint violation (catch `PrismaClientKnownRequestError` code `P2002`)
  - `UnauthorizedException` — auth failures
  - `InternalServerErrorException` — unexpected errors
- **`@Public()` decorator** marks endpoints that bypass JWT guard.
- **Rate limiting:** global `@nestjs/throttler` guard (60 requests per 60 seconds by default).

### Frontend (Angular 19)

- **TypeScript strictness:** `strict: true`, `noImplicitOverride: true`, `noImplicitReturns: true`, `noPropertyAccessFromIndexSignature: true`, and all Angular strict template flags enabled.
- **All components are standalone** — `standalone: true` in `@Component`, import dependencies explicitly in the `imports: []` array.
- **Routing:** lazy-loaded via `loadComponent` in `app.routes.ts`.
- **Services:** `@Injectable({ providedIn: 'root' })` using `inject()` function or constructor injection.
- **Interceptors and guards:** functional style (`HttpInterceptorFn`, `CanActivateFn`) — no class-based equivalents.
- **No `AppModule`:** bootstrapped via `app.config.ts` using `provideRouter`, `provideHttpClient(withFetch(), withInterceptors([...]))`, `provideAnimations`.
- **HTTP calls:** all API calls go through Angular `HttpClient` in dedicated services; base URL from `environment.apiUrl`.
- **Models:** pure TypeScript `interface` declarations in `src/app/models/`; use union types for enums (`'ACTIVE' | 'INACTIVE'`).
- **Error handling:**
  - Global `httpErrorInterceptor` handles: `0` (offline), `401` (→ logout + redirect), `403`, `409`, `422`, `5xx`.
  - To bypass the global handler for a specific request, set header `X-Skip-Error-Handler: true`.
  - User-facing messages via `ToastService`.
- **Component styles:** SCSS, colocated with component files; default Angular Material `azure-blue` theme.
- **Shared SCSS partials:** in `src/styles/`. Key files:
  - `_forms.scss` — form layouts, inputs, tab switchers, popups
  - `_tables.scss` — data tables, line tables, responsive card-flip
  - `_document-form.scss` — shared styles for all commercial document forms (margin columns, progress badges)
  - `_totals.scss` — totals bar, discount display
  - `_traceability.scss` — document flow breadcrumb, trace bars
  - `_index.scss` — forwards all partials; imported in `styles.scss` via `@use 'styles/index' as *;`
- **Observable subscriptions:** use `.subscribe({ next: ..., error: ... })` pattern.
- **SSR:** `@angular/platform-server` and `@angular/ssr` are installed. `angular.json` uses `@angular-devkit/build-angular:application` builder with `"ssr": { "entry": "src/server.ts" }`. Production builds generate server bundles (`server.mjs`). The `serve:ssr:erp-frontend` script points to `dist/erp-frontend/server/server.mjs`.
- **SSR safety rule:** never access `window`, `document`, or `localStorage` at module top-level (e.g., `const x = window.location.hostname`). Always guard with `typeof window !== 'undefined'` or inject `PLATFORM_ID` / `isPlatformBrowser()`. `environment.ts` is already guarded.

#### Path aliases (tsconfig.json)

Prefer path aliases over deep relative imports (`../../shared/...` → `@shared/...`):

| Alias       | Points to            |
| ----------- | -------------------- |
| `@env/*`    | `src/environments/*` |
| `@models/*` | `src/app/models/*`   |
| `@shared/*` | `src/app/shared/*`   |
| `@core/*`   | `src/app/core/*`     |
| `@auth/*`   | `src/app/auth/*`     |
| `@pages/*`  | `src/app/pages/*`    |

All 10 commercial document forms have been migrated to use aliases.

#### Document form architecture

All commercial document forms (`sales-quotations`, `purchase-quotations`, `sales-orders`, `purchase-orders`, `delivery-orders`, `purchase-receipts`, `sale-invoices`, `purchase-invoices`, `sale-reserve-invoices`, `purchase-reserve-invoices`) extend `DocumentFormBase`.

**`DocumentFormBase`** (`src/app/shared/document-form/document-form.base.ts`) provides:

- UI state: `isLoading`, `isSaving`, `hasChanges`, `moreMenuOpen`, `copyMenuOpen`, `activeTab`
- Dialogs / popups: `openDialog()`, `openSuccessPopup()`, `goToDocument()`, `goToList()`
- Totals with caching: `calcTotals()`, `invalidateTotals()`, getters `getSubtotal()`, `getTax()`, `getTotal()`, `getTotalDiscount()`
- Permissions: `canViewCosts`, `canViewDiscounts`, `canViewTaxes`
- Utilities: `toDateInput`, `warehouseName`, `getTaxRateLabel`, `getTaxCodeLabel`
- Default warehouse resolution: `defaultWarehouseId`

**`DocumentLineArrayService`** (`src/app/shared/document-form/document-line-array.service.ts`) provides:

- `buildLineGroup()`, `buildManualLine()` — FormGroup builders for document lines
- `calculateLine()`, `applyLineTax()` — line-level tax and total calculations
- `recalculateAllLines()`, `resolveLineTaxId()` — batch operations and tax indicator resolution

**`DocumentFormUtils`** (`src/app/shared/document-form/document-form.utils.ts`) provides pure functions:

- `toDateInput()`, `stockChipClass()`, `stockLabel()`, `docStatusLabel()`, `lineStatusLabel()`, `formatTaxRate()`

#### Document list architecture

All **transactional list components** (`sales-quotations`, `purchase-quotations`, `sales-orders`, `purchase-orders`, `delivery-orders`, `purchase-receipts`, `sale-invoices`, `purchase-invoices`, `sale-reserve-invoices`, `purchase-reserve-invoices`) extend `DocumentListBase`.

**`DocumentListBase`** (`src/app/shared/document-form/document-list.base.ts`) provides:

- Pagination state: `page`, `limit`, `total`, `totalPages`
- Search with debounce: `search`, `onSearch()`
- UI state: `loading`, `processingId`, `rowMenuId`
- Row menu handling: `closeRowMenu()`
- Traceability: `flowMap` (`ViewChild`) for `DocumentFlowMapComponent`
- Router access: `protected router` for navigation in child consolidation methods

Components override `load()` to call their specific service. Filter-specific methods (`clearFilters`, `hasActiveFilters`, `onStatusChange`) remain in the child.

#### Migration patterns

**List components → `DocumentListBase`:**

- Remove: `loading`, `processingId`, `rowMenuId`, `page`, `limit`, `total`, `totalPages`, `search`, `destroyRef`, `searchSubject`
- Remove: `ngOnInit`, `onSearch`, `onPageChange`, `onLimitChange`
- Remove: `@ViewChild('flowMap')` and `closeRowMenu()` (unless it has extra logic; then `override` it)
- Keep: `load()` (add `override`), filters, domain action methods (`close`, `cancel`, `confirm`), selection/consolidation logic, `openFlowMap(id)`

**Form line logic → `DocumentLineArrayService`:**

- Delegate: `buildManualLine()`, `calculateLine()`, `onLineTaxChange()`, `removeItem()`, `recalculateAllLines()`
- Preserve: custom `buildLine()` (domain-specific validators and computed fields), manual item HTTP handlers (`selectManualItem`, `onManualItemChange`), `addFreeItem()`
- Purchase forms pass `forceInclusive: true` to `applyLineTax()` because Bolivian purchase tax is always inclusive.

**Current migration status:**

- ✅ **Lists:** all 10 transactional lists migrated to `DocumentListBase`
- ✅ **Forms:** 4 of 10 forms use `DocumentLineArrayService` fully (`sales-quotations`, `purchase-quotations`, `sales-orders`, `purchase-orders`)
- ✅ **Forms (partial):** 6 forms use `DocumentLineArrayService` for `removeItem` (`delivery-orders`, `sale-invoices`, `purchase-receipts`, `purchase-invoices`, `sale-reserve-invoices`, `purchase-reserve-invoices`)
  - These retain custom `calculateLine` / `onLineTaxChange` due to domain-specific clamping, simple tax logic, or divergent `priceNet` semantics.
- ✅ **SSR runtime verified:** `serve:ssr:erp-frontend` works; `localStorage` / `window` / `document` accesses guarded with `typeof window !== 'undefined'`
- ✅ **`priceNet` semantics unified:** The backend universally stores `priceNet` as **unit net** (`lc.priceNet`). The frontend `DocumentLineArrayService` no longer supports the dead `priceNetSemantics: 'line'` option. All commercial documents consistently treat `priceNet` as unit net price.

#### Responsive table selectors

SCSS attribute selectors with non-ASCII characters (e.g., `td[data-label="Artículo"]`) are **not supported** by the production CSS optimizer and cause build warnings. Use `Articulo` (without accent) for `data-label` attributes in HTML and SCSS selectors.

---

## Testing Guidelines

### Backend (Jest 30.0.0)

- Unit test files: colocated with source as `*.spec.ts`.
- E2E test files: in `test/` as `*.e2e-spec.ts`.
- Use `@nestjs/testing` `Test.createTestingModule` to build isolated module contexts.
- **Mock `PrismaService`** with `jest.fn()` stubs — do not connect to a real database in unit tests.
- `ts-jest` uses `tsconfig.spec.json` (extends `tsconfig.json` with `"types": ["node", "jest"]`).
- Run a single spec file: `npx jest src/path/to/file.spec.ts`
- Run tests matching a name: `npx jest --testNamePattern="<description text>"`

**Controller test pattern:**

```typescript
const module: TestingModule = await Test.createTestingModule({
  controllers: [ItemsController],
  providers: [{ provide: ItemsService, useValue: {} }],
}).compile();
```

**Service test pattern:**

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    ItemsService,
    {
      provide: PrismaService,
      useValue: {
        item: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
        stock: { findMany: jest.fn(), findUnique: jest.fn() },
        $transaction: jest.fn((cb: any) => cb({ item: { create: jest.fn() } })),
      },
    },
  ],
}).compile();
```

### Frontend (Karma + Jasmine)

- Unit test files: colocated with source as `*.spec.ts`.
- No custom `karma.conf.js`; configuration is managed by Angular CLI defaults in `angular.json`.
- Standalone components: import the component directly into `TestBed.configureTestingModule({ imports: [MyComponent] })`.
- Services: obtain via `TestBed.inject(MyService)`.
- Run a single spec file: `npx ng test --include="**/path/to/file.spec.ts" --watch=false --browsers=ChromeHeadless`
- **Fixing boilerplate tests:** most `NullInjectorError` failures are resolved by adding `providers: [provideRouter([]), provideHttpClient()]` to `TestBed.configureTestingModule`.
- **Testing complex forms:** for document forms with many child components, use `TestBed.overrideComponent(FormComponent, { set: { template: '<form [formGroup]=\"form\"></form>', imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule] } })` to isolate the component under test.

### Frontend (Playwright)

- E2E tests live in `e2e/` (configured in `playwright.config.ts`).
- Run: `npm run e2e` (starts dev server automatically, runs tests headless in Chromium + Firefox).
- **Current test count:** 14 E2E tests passing (7 per browser).
- Mock backend responses with `page.route('**/auth/login', ...)` to avoid requiring a live backend.
- JWT mock helper available in `e2e/helpers/jwt-mock.ts`.

---

## Environment & Configuration

### Backend (`backend-erp/.env` — not committed)

Required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret for signing JWT tokens (validated at bootstrap; app crashes if missing)
- `PORT` — server port (defaults to `3000` if omitted)

Optional / production variables:

- `NODE_ENV` — set to `production` to enable production CORS mode
- `FRONTEND_URL` — required when `NODE_ENV=production`; used as the single allowed CORS origin
- `SHADOW_DATABASE_URL` — optional, used by Prisma for migrations

### Frontend (`erp-frontend/src/environments/`)

- `environment.ts` (dev): dynamically detects backend host (`window.location.hostname:3000`) to work on localhost and LAN devices.
- `environment.prod.ts`: points to `https://backend-erp-x4l1.onrender.com`.
- **Generated API types:** `erp-frontend/src/app/api-types/prisma-types.ts` is generated from `backend-erp/prisma/schema.prisma` using `prisma-generator-typescript-interfaces`. To regenerate: `cd backend-erp && npx prisma generate`, then copy `generated/prisma-types.ts` to the frontend. The file is committed for convenience but should be regenerated when the schema changes.

### Deployment

- **Backend:** currently deployed on Render.com.
- **Frontend:** includes `vercel.json` with SPA fallback routing (`src: "/.*", dest: "/index.html"`), intended for Vercel deployment.
- **Never commit secrets or `.env` files.**

---

## Security Considerations

- **JWT required by default:** all routes are protected by `JwtAuthGuard` globally; use `@Public()` to exempt specific endpoints.
- **Role-based access:** `RolesGuard` enforces `@Roles('ADMIN' | 'USER')` after authentication.
- **Rate limiting:** `@nestjs/throttler` applies 60 requests per 60 seconds globally.
- **CORS:** in development, allows localhost and private IP ranges (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`); in production, `FRONTEND_URL` is mandatory and strictly enforced.
- **Env validation:** `main.ts` validates `JWT_SECRET` at startup and aborts if missing.
- **Password hashing:** `bcryptjs` is used for user passwords.
- **Input sanitization:** global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` strips unexpected properties.

---

## Domain Notes

- Business logic is implemented in **Spanish** (variable names, comments, UI labels).
- Document flow: Quotation → Order → Delivery/Receipt → Invoice → Reserve Invoice.
- **Devoluciones (`SalesReturn`, `PurchaseReturn`)** siguen el flujo estándar: `create()` → `OPEN` → `confirm()` → `CLOSED` → `cancel()`. El asiento contable y los movimientos de stock se generan en `confirm()`, no en `create()`.
- Tax: Bolivian IVA rules; `TAX_RATE_NOMINAL` constant lives in `src/common/pricing.util.ts` and is re-exported from `src/constants.ts`.
- **BankAccount balance:** `IncomingPayment` y `OutgoingPayment` actualizan automáticamente `bankAccount.balance` vía `applyPaymentEffects()` / `revertPaymentEffects()` dentro de la misma transacción Prisma.
- **Entregas sin costo:** `DeliveryOrder.confirm()` lanza `BadRequestException` si ningún artículo tiene costo registrado (`totalCost <= 0`). Esto previene agujeros negros en el reconocimiento de COGS.
- Stock movements are tracked in `StockMovement` records; never mutate stock directly — use traceability utilities in `src/common/`.
- Code generation (e.g., `SOQ-000001`) uses PostgreSQL sequences via `src/common/code-generator.util.ts` (internally `code-generator.util.ts`).
- **Multi-tenancy:** `Tenant` model with `tenantId` on nearly every table; `@@unique([tenantId, code])` and `@@index([tenantId])` are standard patterns.
- **Soft deletes:** all business records use `status: 'ACTIVE' | 'INACTIVE'` instead of hard deletion.
- **Document linking:** `DocumentLink` table enables cross-referencing between any document types for traceability.
- **Price list hierarchy:** partners can have special price lists; if a partner has a special price list active, it takes priority over the partner group's price list. This logic is implemented in `src/common/price-resolver.util.ts`.

---

## Motor Contable Automático (Accounting Engine)

El backend incluye un motor contable centralizado que genera asientos de diario automáticamente al confirmar/cancelar documentos comerciales.

### Arquitectura

- **`src/common/accounting-engine.service.ts`** — servicio central (`AccountingEngineService`) que:
  - Asegura un **plan de cuentas universal IFRS-based** por tenant (23 cuentas en 6 clases: 1xxx Activo, 2xxx Pasivo, 3xxx Patrimonio, 4xxx Ingreso, 5xxx Costo, 6xxx Gasto).
  - Crea y mantiene **`AccountMapping`** (mapeos de cuenta por tipo de documento + tipo de asiento).
  - Genera **`JournalEntry`** + **`JournalEntryLine`** con estado `POSTED`. Al stornar, el asiento original pasa a `REVERSED`.
  - Soporta **storno** automático (`createStornoEntry`) para cancelaciones.
  - Valida partida doble (débito = crédito) antes de crear el asiento.

- **`src/account-mappings/`** — módulo REST CRUD para configurar los mapeos contables:
  - Endpoints: `GET /account-mappings`, `POST /account-mappings`, `PUT /account-mappings/:id`, `DELETE /account-mappings/:id`
  - `POST /account-mappings/ensure-defaults` — regenera defaults del plan universal.
  - `GET /account-mappings/lookup/by-type` — resuelve cuentas por tipo de documento.

### Documentos conectados al motor contable

| Documento                  | Evento      | Asiento contable                                          |
| -------------------------- | ----------- | --------------------------------------------------------- |
| **SaleInvoice**            | `confirm()` | AR (D) / REVENUE (C) + TAX (C)                            |
| **SaleInvoice**            | `cancel()`  | Storno del asiento original                               |
| **PurchaseInvoice**        | `confirm()` | INVENTORY (D) + TAX (D) / AP (C)                          |
| **PurchaseInvoice**        | `cancel()`  | Storno del asiento original                               |
| **IncomingPayment**        | `create()`  | BANK (D) / AR (C) o CUSTOMER_ADVANCE (C)                  |
| **IncomingPayment**        | `cancel()`  | Storno del asiento original                               |
| **OutgoingPayment**        | `create()`  | AP (D) o SUPPLIER_ADVANCE (D) / BANK (C)                  |
| **OutgoingPayment**        | `cancel()`  | Storno del asiento original                               |
| **SalesCreditNote**        | `confirm()` | REVENUE (D) + TAX (D) / AR (C)                            |
| **SalesCreditNote**        | `cancel()`  | Storno del asiento original                               |
| **PurchaseCreditNote**     | `confirm()` | AP (D) / INVENTORY (C) + TAX (C)                          |
| **PurchaseCreditNote**     | `cancel()`  | Storno del asiento original                               |
| **DeliveryOrder**          | `confirm()` | COGS (D) / INVENTORY (C) = totalCost                      |
| **DeliveryOrder**          | `cancel()`  | Storno del asiento original                               |
| **PurchaseReceipt**        | `confirm()` | INVENTORY (D) / GRIR (C) = totalCost                      |
| **PurchaseReceipt**        | `cancel()`  | Storno del asiento original                               |
| **SaleReserveInvoice**     | `confirm()` | AR (D) / REVENUE (C) + TAX (C)                            |
| **SaleReserveInvoice**     | `cancel()`  | Storno del asiento original                               |
| **PurchaseReserveInvoice** | `confirm()` | INVENTORY (D) + TAX (D) / AP (C)                          |
| **PurchaseReserveInvoice** | `cancel()`  | Storno del asiento original                               |
| **SalesReturn**            | `confirm()` | REVENUE (D) + TAX (D) + INVENTORY (D) / AR (C) + COGS (C) |
| **SalesReturn**            | `cancel()`  | Storno del asiento original                               |
| **PurchaseReturn**         | `confirm()` | AP (D) / INVENTORY (C) + TAX (C)                          |
| **PurchaseReturn**         | `cancel()`  | Storno del asiento original                               |

### Patrón de implementación en servicios

Cada servicio conectado:

1. **Inyecta** `AccountingEngineService` en el constructor.
2. **Importa** `CommonModule` en su módulo NestJS para tener acceso al servicio.
3. En `confirm()` / `create()` / `_confirmInTx()`:
   - Llama `await this.accounting.ensureDefaults(tenantId, tx)`.
   - Resuelve IDs de cuenta con **`await this.accounting.requireAccountId(tenantId, 'DOC_TYPE', 'ENTRY_TYPE', tx)`** para campos críticos (AR, REVENUE, AP, INVENTORY, BANK, COGS, GRIR). Lanza `BadRequestException` si falta el mapeo.
   - Usa `await this.accounting.getAccountId(...)` solo para campos opcionales (TAX cuando `tax <= 0`).
   - Construye líneas del asiento y llama `await this.accounting.createJournalEntry(tx, tenantId, { ... })`.
4. En `cancel()`:
   - Busca asiento original con `await this.accounting.findEntryBySource(tenantId, 'DOC_TYPE', docId, tx)`.
   - Si existe, crea storno con `await this.accounting.createStornoEntry(tx, tenantId, originalEntry.id, { ... })`.

### Plan de cuentas universal (22 cuentas)

```
1xxx — ACTIVOS
  1100 Efectivo y equivalentes
  1110 Bancos
  1120 Cuentas por cobrar (Clientes)
  1130 Anticipos a proveedores
  1140 Inventarios
  1150 Impuestos recuperables (IVA crédito)
  1160 Propiedad, planta y equipo

2xxx — PASIVOS
  2100 Cuentas por pagar (Proveedores)
  2110 Impuestos por pagar (IVA débito)
  2120 Anticipos de clientes
  2130 Obligaciones laborales
  2140 Préstamos bancarios
  2150 Mercancías recibidas no facturadas

3xxx — PATRIMONIO
  3100 Capital social
  3110 Reservas
  3120 Resultados acumulados

4xxx — INGRESOS
  4100 Ingresos por ventas
  4200 Otros ingresos operacionales

5xxx — COSTOS
  5100 Costo de ventas
  5200 Costos de producción

6xxx — GASTOS
  6100 Gastos de ventas
  6200 Gastos administrativos
  6300 Gastos financieros
```

### Configuración frontend

- **Ruta:** `/account-mappings` (bajo Administración en el sidebar).
- **Página:** `pages/account-mappings/` — tabla con selector inline de cuentas contables por tipo de documento.
- **Labels amigables:** `SALE_INVOICE` → "Factura de Venta", etc.
- **Botón "Restaurar Defaults"**: regenera el plan de cuentas y mapeos por defecto.
- **Guard:** requiere permiso `account-mappings:view`.

### Tests

Todos los `.spec.ts` de servicios conectados incluyen un mock de `AccountingEngineService`:

```typescript
{ provide: AccountingEngineService, useValue: {
  ensureDefaults: jest.fn().mockResolvedValue(undefined),
  getAccountId: jest.fn().mockResolvedValue(99),
  createJournalEntry: jest.fn().mockResolvedValue({ id: 1, code: 'AST-000001' }),
  createStornoEntry: jest.fn().mockResolvedValue({ id: 2, code: 'AST-000002' }),
  findEntryBySource: jest.fn().mockResolvedValue(null),
}}
```

---

## Campos Definidos por el Usuario (UDF) — SAP B1 Style

### Arquitectura

El ERP replica el patrón SAP Business One para documentos de marketing:

- Cada tabla de documento conserva su identidad física (no se unificó en una sola tabla).
- Todas las cabeceras comerciales tienen `objectType DocumentType` (equivalente a `ObjType` de SAP B1).
- Todas las cabeceras y líneas comerciales tienen `customFields Json? @default("{}")` (PostgreSQL JSONB nativo).
- Los valores UDF se almacenan directamente en JSONB de cada tabla (rápido, indexable con GIN).
- Los metadatos de UDFs (qué campos existen, su tipo, validaciones) viven en la tabla `UserDefinedField`.

### Tablas con UDFs habilitados

**Cabeceras comerciales (14):**
`SalesQuotation`, `SalesOrder`, `DeliveryOrder`, `SaleReserveInvoice`, `SaleInvoice`, `PurchaseQuotation`, `PurchaseOrder`, `PurchaseReceipt`, `PurchaseInvoice`, `PurchaseReserveInvoice`, `SalesReturn`, `SalesCreditNote`, `PurchaseReturn`, `PurchaseCreditNote`

**Líneas comerciales (14):**
Todos los modelos `*Item` correspondientes a las cabeceras anteriores.

### Modelo `UserDefinedField`

```prisma
model UserDefinedField {
  id          Int
  tenantId    Int
  tableName   String   // "SaleInvoice", "Item", "Partner"...
  fieldName   String   // "nroContrato"
  fieldLabel  String   // "Número de Contrato"
  fieldType   String   // "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT"
  fieldConfig Json?    // { maxLength: 50, options: [...] }
  isRequired  Boolean
  isActive    Boolean
  appliesTo   String   // "HEADER" | "LINE"
  order       Int
}
```

### API REST

- `GET /udf?tableName=SaleInvoice` — lista UDFs activos
- `POST /udf` — crea un UDF
- `PUT /udf/:id` — actualiza un UDF
- `DELETE /udf/:id` — soft delete (desactiva)

### Cómo propagar customFields en un servicio nuevo

Cuando crees o actualices un documento comercial, incluye `customFields` en el payload Prisma:

```typescript
await tx.saleInvoice.create({
  data: {
    tenantId,
    customFields: dto.customFields ?? {},
    // ... resto de campos
  },
});
```

### Índices GIN recomendados (post-migración)

```sql
CREATE INDEX idx_sale_invoice_custom ON "SaleInvoice" USING GIN (customFields);
-- repetir para cada tabla comercial según necesidad de búsqueda por UDF
```

### Estado de implementación

- ✅ Schema Prisma: `objectType`, `customFields`, `UserDefinedField`, `PurchaseReserveInvoice`
- ✅ Migración aplicada a PostgreSQL
- ✅ DTOs actualizados para aceptar `customFields`
- ✅ Módulo UDF creado (`src/udf/`)
- ✅ Tests del módulo UDF pasando
- ⚠️ Servicios: propagación de `customFields` parcial (demostrada en sales-quotations, sales-orders, sale-invoices; pendiente en los demás)
- ⏳ Frontend: componente `UdfFormSection` y modelos pendientes

---

## Frontend Tech-Debt & Improvement Opportunities (Apr 2026)

> Oportunidades descubiertas durante la eliminación de `: any` en el frontend. No son bloqueantes (build limpio), pero mejorarían la mantenibilidad.

| # | Oportunidad | Status | Notas |
|---|-------------|--------|-------|
| 1 | **Tipar servicios de draft incompletos** | ✅ Done | 11 métodos en 4 servicios tipados |
| 2 | **Unificar `ItemSearchResult` vs `Item`** | ✅ Done | `ItemSearchResult` movido a `models/item.model.ts`; `getAll()` retorna `ItemSearchResult[]`; `uomCodeForItem` es genérico |
| 3 | **Completar migración a `DocumentLineArrayService`** | 🔄 Deuda técnica | Requiere reconciliar `priceNet` line-net vs unit-net en 5 formularios — cambio arquitectónico grande |
| 4 | **Tipar `LunaColumn` sin `any`** | ⚠️ Excepción permanente | Intentado: cambiar a `unknown` rompe ~28 listas con errores mecánicos. Revertido; documentado como excepción arquitectónica aceptada |
| 5 | **`Record<string, any>` → `Record<string, unknown>` en modelos** | ✅ Done | 22 modelos actualizados; build limpio |
| 6 | **Limpiar warnings de lint** | ✅ Done | `ng lint` pasa con 0 errores, 0 warnings |

### 1. Tipar servicios de draft incompletos ✅

**Servicios afectados y cambios:**
- `purchase-quotations.service.ts`: `getDraft()` → `Observable<PurchaseOrderDraft>`
- `sales-quotations.service.ts`: `getDraftMultiQuotation()` → `Observable<SalesOrderDraft>`
- `delivery-orders.service.ts`: 5 métodos tipados (`SaleInvoiceDraft`, `SaleReserveInvoiceDraft`, `DeliveryOrderDraft`)
- `purchase-receipts.service.ts`: 4 métodos tipados (`PurchaseReceiptDraft`, `PurchaseInvoiceDraft`)

**Campos agregados a drafts existentes:**
- `DeliveryOrderDraft`: `hasExpired`, `expiredCodes`, `partner`

### 2. Unificar `ItemSearchResult` vs `Item` ✅

- `ItemSearchResult` ahora vive en `src/app/models/item.model.ts` y se exporta desde allí.
- `ItemsService.getAll()` retorna honestamente `ItemSearchResult[]` en vez de `Item[]` con cast falso.
- `item-search-modal.component.ts` importa `ItemSearchResult` desde `@models/item.model`.
- `uomCodeForItem()` en `document-form.utils.ts` ahora acepta un tipo genérico que no requiere `createdAt` ni campos completos de `Item`.
- Todos los formularios que usan `catalogItems` ya estaban migrados a `ItemSearchResult[]` del trabajo previo.

### 3. Completar migración a `DocumentLineArrayService` 🔄

**Por qué no se ejecutó:**
- 5 de 6 formularios usan `priceNet` como *line net* (deuda `ARCH-DEBT-001`), mientras que `sale-reserve-invoices` usa *unit net* (el estándar unificado).
- Migrar requiere cambiar la semántica de `priceNet` en `sale-invoices`, `purchase-invoices`, `purchase-receipts`, `delivery-orders` y `purchase-reserve-invoices`.
- Eso es una refactorización arquitectónica con alto riesgo de regresión en cálculos de totales, impuestos y descuentos.

**Recomendación:** atacar solo cuando se decida unificar `priceNet` a unit-net en todo el frontend.

### 4. Tipar `LunaColumn` sin `any` ⚠️ Excepción permanente

**Intento realizado (Apr 2026):**
- Se cambió `any` → `unknown` en `format` y `badgeVariant`.
- La build generó ~40 errores en 28 listas.
- Los errores son mecánicos (`v ?? '—'`, `v?.name`, `new Date(v)`, `this.label(v)`) pero requieren tocar casi todas las listas del sistema.
- **Decisión:** revertir a `any` y documentar como la **única excepción intencional** en el frontend. El valor de `unknown` aquí es nulo porque `getCellValue()` resuelve paths dinámicos (`partner.name`) y TypeScript no puede inferir el tipo leaf.

### 5. `Record<string, any>` → `Record<string, unknown>` en modelos ✅

- 22 ocurrencias cambiadas en `src/app/models/*.model.ts`.
- Build pasa limpio porque los consumidores (formularios con `fb.group()`) aceptan `unknown` sin problemas.

### 6. Estado actual post-refactor

- `ng build` → ✅ 0 errores.
- `ng lint` → ✅ 0 errores, 0 warnings.
- `: any` en `src/app/` → **2 intencionales** en `luna-data-table.types.ts` (excepción documentada).
- Tests de frontend → ✅ 268 tests pasando (Karma + Jasmine).

---

## Flujo de Documentos y Lógica de Stock (Document Flow & Stock Logic)

> **Contexto:** Abr 2026 — tras enriquecer `prisma/seed.ts` con datos transaccionales y corregir inconsistencias en servicios.  
> Esta sección documenta el comportamiento exacto de cada documento comercial al confirmarse/cerrarse, crítico para mantener consistencia entre seed, tests y lógica de negocio.

### Estados de documentos comerciales

| Documento | Estados posibles | Estado final tras confirmar |
|-----------|------------------|----------------------------|
| `SalesQuotation` | `DRAFT`, `SENT`, `PARTIAL`, `ORDERED`, `OPEN`, `CLOSED`, `CANCELLED` | `CLOSED` (cuando se convierte en pedido) |
| `SalesOrder` | `OPEN`, `CONFIRMED`, `CLOSED`, `CANCELLED` | `CLOSED` (cuando se entrega completamente) |
| `DeliveryOrder` | `OPEN`, `CLOSED`, `CANCELLED` | `CLOSED` |
| `SaleInvoice` | `OPEN`, `CLOSED`, `CANCELLED` | `CLOSED` |
| `PurchaseQuotation` | `OPEN`, `CLOSED`, `CANCELLED` | `CLOSED` |
| `PurchaseOrder` | `OPEN`, `CONFIRMED`, `CLOSED`, `CANCELLED` | `CLOSED` |
| `PurchaseReceipt` | `OPEN`, `CLOSED`, `CANCELLED` | `CLOSED` |
| `PurchaseInvoice` | `OPEN`, `CLOSED`, `CANCELLED` | `CLOSED` |
| `IncomingPayment` | `DRAFT`, `POSTED`, `CANCELLED` | `POSTED` |
| `OutgoingPayment` | `DRAFT`, `POSTED`, `CANCELLED` | `POSTED` |

**Regla de oro:** un documento en estado `CLOSED` o `POSTED` ya no admite modificaciones estructurales; solo se puede cancelar (`cancel()`).

### Flujo completo de ventas

```
SalesQuotation (SOQ) → SalesOrder (SO) → DeliveryOrder (DO) → SaleInvoice (SI)
```

1. **Crear SOQ** → status `OPEN`. Las líneas tienen `openQty = qty`, `orderedQty = 0`.
2. **Crear SO desde SOQ** → SOQ pasa a `CLOSED` (si se ordena todo). Líneas de SOQ: `orderedQty = qty`, `openQty = 0`. Líneas de SO: `openQty = qty`, `deliveredQty = 0`.
3. **Crear DO desde SO** → SO: `deliveredQty` incrementa, `openQty` decrementa. DO: `openQty = qty`. Se crea `StockMovement` tipo `SALE_DELIVERY` y se reduce `Stock.stockPhysical`.
4. **Confirmar DO** → DO pasa a `CLOSED`. Si todas las líneas del SO tienen `openQty <= 0`, el SO también pasa a `CLOSED`.
5. **Crear SI desde DO** → SI: `paidAmount = 0`, `balanceDue = total`, status `OPEN`. Líneas de DO: `invoicedQty = qty`. Líneas de SI: `openQty = qty`.
6. **Confirmar SI** → SI pasa a `CLOSED`.
   - ✅ **Si SI tiene `deliveryOrderItemId` (viene de entrega previa): NO reduce stock físico de nuevo.** El stock ya salió en el DO.
   - ✅ **Si SI NO tiene entrega previa (venta directa): SÍ reduce stock físico** (`StockMovement` tipo `SALE_INVOICE` + `upsertStock` con `deltaPhysical`).
   - En ambos casos, si la línea viene de un pedido (`orderItemId`), libera `deltaCommitted`.
7. **Crear IncomingPayment contra SI** → status `POSTED`. Actualiza `SaleInvoice.paidAmount` y `balanceDue`. Actualiza `Partner.incomingBalance`. Actualiza `BankAccount.balance`.

### Flujo completo de compras

```
PurchaseQuotation (POQ) → PurchaseOrder (PO) → PurchaseReceipt (PR) → PurchaseInvoice (PI)
```

1. **Crear POQ** → status `OPEN`.
2. **Crear PO desde POQ** → POQ pasa a `CLOSED`.
3. **Crear PR desde PO** → PO: `receivedQty` incrementa, `openQty` decrementa. PR: `openQty = qty`.
4. **Confirmar PR** → PR pasa a `CLOSED`. Se crea `StockMovement` tipo `PURCHASE_RECEIPT` y se incrementa `Stock.stockPhysical`. Si el artículo requiere lote/serie y no se especificó, se crea un `Batch` automáticamente.
5. **Crear PI desde PR** → PI: `paidAmount = 0`, `balanceDue = total`. Líneas de PR: `invoicedQty = qty`.
6. **Confirmar PI** → PI pasa a `CLOSED`.
   - ✅ **Si PI tiene `purchaseReceiptItemId` (viene de recepción previa): NO mueve stock de nuevo.** El stock ya entró en el PR.
   - ✅ **Si PI NO tiene recepción previa: SÍ incrementa stock físico** y decrementa `stockOrdered`.
7. **Crear OutgoingPayment contra PI** → status `POSTED`. Actualiza `PurchaseInvoice.paidAmount` y `balanceDue`. Actualiza `Partner.outgoingBalance`. Actualiza `BankAccount.balance`.

### Movimientos de stock por tipo de documento

| Documento | Evento | `StockMovement.type` | Efecto en `Stock` |
|-----------|--------|----------------------|-------------------|
| `DeliveryOrder` | `confirm()` | `SALE_DELIVERY` | `deltaPhysical` −qty |
| `SaleInvoice` | `confirm()` (sin DO previa) | `SALE_INVOICE` | `deltaPhysical` −qty |
| `SaleInvoice` | `cancel()` | `SALE_INVOICE_CANCEL` | `deltaPhysical` +qty |
| `PurchaseReceipt` | `confirm()` | `PURCHASE_RECEIPT` | `deltaPhysical` +qty |
| `PurchaseInvoice` | `confirm()` (sin PR previa) | `PURCHASE_INVOICE` | `deltaPhysical` +qty, `deltaOrdered` −qty |
| `StockTransfer` | `confirm()` | `STOCK_TRANSFER_OUT` + `STOCK_TRANSFER_IN` | Origen −qty, Destino +qty |
| `StockAdjustment` | `confirm()` (INCREASE) | `MANUAL_IN` | `deltaPhysical` +qty |
| `StockAdjustment` | `confirm()` (DECREASE) | `MANUAL_OUT` | `deltaPhysical` −qty |
| `StockEntry` | `confirm()` | `MANUAL_IN` | `deltaPhysical` +qty |
| `StockExit` | `confirm()` | `MANUAL_OUT` | `deltaPhysical` −qty |
| `SalesReturn` | `confirm()` | `SALES_RETURN` | `deltaPhysical` +qty |
| `PurchaseReturn` | `confirm()` | `PURCHASE_RETURN` | `deltaPhysical` −qty |
| `SalesCreditNote` | `confirm()` | `SALES_CREDIT_NOTE` | `deltaPhysical` +qty |
| `PurchaseCreditNote` | `confirm()` | `PURCHASE_CREDIT_NOTE` | `deltaPhysical` −qty |

### Trazabilidad por lote (LOT) y serie (SERIAL)

- **`Batch`** — lote físico vinculado a un `itemId`. Tiene `manufactureDate` y `expiryDate`.
- **`StockBatch`** — stock por lote y almacén. Unique: `[tenantId, batchId, warehouseId]`.
- **`SerialNumber`** — número de serie único por `itemId`. Tiene `status` (`AVAILABLE`, `SOLD`) y `warehouseId` directo.

**Comportamiento por documento:**

| Documento | LOT tracking | SERIAL tracking |
|-----------|-------------|-----------------|
| `PurchaseReceipt` | Si no existe `batchId` en la línea, crea un `Batch` nuevo automáticamente. Luego `upsertStockBatch`. | Requiere `serialNumberId` en la línea. Falla si falta. Marca serie como `AVAILABLE`. |
| `DeliveryOrder` | Propaga `batchId` al `StockMovement` y a `upsertStockBatch` (−qty). | Propaga `serialNumberId` al `StockMovement`. Marca serie como `SOLD`. |
| `SaleInvoice` (sin DO previa) | Igual que DO. | Igual que DO. |
| `StockTransfer` | Propaga `batchId`. Ajusta `StockBatch` en origen y destino. | Propaga `serialNumberId`. Actualiza `warehouseId` de la serie. |

---

## Seed Transaccional (`prisma/seed.ts`)

El seed genera un dataset completo de desarrollo con datos maestros **y** transaccionales, garantizando consistencia entre stock, lotes, series, saldos contables y bancarios.

### Datos maestros creados

- 1 tenant, 3 usuarios (admin + 2 vendedores), 3 tax indicators, 3 warehouses
- 5 item groups, 6 UoMs, 26 items (incluyendo 4 con tracking LOT/SERIAL)
- 3 price lists, 3 payment terms, 4 partner groups, 14 partners (8 clientes + 5 proveedores + 1 both)
- 1 banco + 1 cuenta bancaria (balance inicial 50,000 BOB)
- 12 cuentas contables (plan básico), 1 tipo de cambio, 9 system settings

### Documentos transaccionales creados

**Flujo de ventas:**
- `SOQ-00001` → `SO-00001` → `DO-00001` → `SI-00001` (total 17,317.25 BOB, saldo 12,317.25)
- `IP-00001` pago parcial de 5,000 BOB contra SI-00001

**Flujo de compras:**
- `POQ-00001` → `PO-00001` → `PR-00001` → `PI-00001` (total 27,120 BOB, saldo 17,120)
- `OP-00001` pago parcial de 10,000 BOB contra PI-00001

**Asientos contables (balanceados):**
- `JE-00001` — Venta: Clientes (D) 17,317.25 / Ventas (C) 15,325 + IVA Débito (C) 1,992.25
- `JE-00002` — Pago recibido: Bancos (D) 5,000 / Clientes (C) 5,000
- `JE-00003` — Compra: Inventarios (D) 24,000 + IVA Crédito (D) 3,120 / Proveedores (C) 27,120
- `JE-00004` — Pago efectuado: Proveedores (D) 10,000 / Bancos (C) 10,000

**Movimientos de stock adicionales:**
- `ST-00001` — Transferencia 5 laptops Principal → Secundario
- `SA-00001` — Ajuste +10 detergente Principal
- `SE-00001` — Entrada +20 laptops Principal (producción)
- `SX-00001` — Salida −3 laptops Principal (muestra)

### Reconciliación post-documentos

El seed incluye una sección de reconciliación que:
1. Ajusta `Stock` y `StockBatch` para reflejar DO, PR, ST, SA, SE, SX.
2. Crea los `StockMovement` faltantes (`SALE_DELIVERY`, `PURCHASE_RECEIPT`, `STOCK_TRANSFER_OUT/IN`, `MANUAL_IN/OUT`).
3. Actualiza `Partner.incomingBalance` (+5,000) y `Partner.outgoingBalance` (+10,000).
4. Actualiza `BankAccount.balance` (50,000 + 5,000 − 10,000 = 45,000).

**Stock final esperado tras seed:**

| Artículo | Almacén Principal | Almacén Secundario |
|----------|-------------------|--------------------|
| Laptop (ART-00006) | 27 | 5 |
| Detergente (ART-00019) | 45 | 0 |
| TV (ART-00001) | 15 | 0 |

---

## Mejoras y Correcciones Recientes (Abr 2026)

### 1. Fix: doble descuento de stock en `SaleInvoice.confirm()`

**Archivo:** `src/sale-invoices/sale-invoices.service.ts`  
**Problema:** `_executeConfirmLogic()` siempre reducía `stockPhysical` al confirmar una factura, incluso cuando la factura venía de una entrega previa (`deliveryOrderItemId`). Esto causaba un doble descuento de stock (uno en DO, otro en SI).  
**Solución:** envolver la lógica de stock físico, `StockMovement` de tipo `SALE_INVOICE`, `upsertStockBatch` y `updateSerialNumberStatus` dentro de `if (!line.deliveryOrderItemId)`. Si hay entrega previa, la factura solo libera `deltaCommitted` (si viene de pedido) pero no toca stock físico.  
**Impacto:** consistente con `PurchaseInvoice`, que ya tenía la misma protección (`if (!line.purchaseReceiptItemId)`).

### 2. Fix: `BankAccount.balance` no se actualizaba en pagos

**Archivos:** `src/incoming-payments/incoming-payments.service.ts`, `src/outgoing-payments/outgoing-payments.service.ts`  
**Problema:** `applyPaymentEffects()` y `revertPaymentEffects()` actualizaban `Partner.incomingBalance` / `outgoingBalance` y los saldos de facturas, pero ignoraban `BankAccount.balance`.  
**Solución:** agregar bloques explícitos dentro de ambos métodos:
- `applyPaymentEffects`: `BankAccount.balance += payment.total`
- `revertPaymentEffects`: `BankAccount.balance -= payment.total` (con `Math.max(0, ...)` como salvaguarda)

### 3. Fix: `findOrFail*` privados sin tenant scoping

**Archivos afectados:** 8 módulos (`sales-orders`, `sales-quotations`, `purchase-orders`, `purchase-quotations`, `delivery-orders`, `purchase-receipts`, `sale-invoices`, `purchase-invoices`)  
**Problema:** los helpers privados `findOrFailOpen()`, `findOneInternal()`, etc. usaban `findUnique({ where: { id } })` sin filtrar por `tenantId`, permitiendo lectura cruzada entre tenants.  
**Solución:** migrar a `findFirst({ where: { id, tenantId } })`.  
**Tests:** se agregaron 11 tests de aislamiento de tenant en módulos transaccionales (`stock-transfers`, `stock-entries`, `stock-exits`, `stock-adjustments`, `incoming-payments`, `outgoing-payments`, `purchase-credit-notes`, `sales-credit-notes`, `purchase-orders`, `purchase-returns`, `sales-returns`).

### 4. Enriquecimiento del seed

**Archivo:** `prisma/seed.ts`  
**Cambios:**
- Items con `trackingType` (`LOT` / `SERIAL` / `NONE`).
- Stock inicial con lotes (`Batch` + `StockBatch`) y números de serie (`SerialNumber`).
- Documentos transaccionales completos (flujo ventas, flujo compras, pagos, asientos, movimientos de stock).
- Sección de reconciliación para mantener consistencia de stock y saldos.
- Fix de compilación: `trackingType` casteado a `TrackingType` para satisfacer Prisma Client en `ts-node`.

### 5. Fix: relaciones faltantes en seed transaccional

**Archivo:** `prisma/seed.ts`  
**Problema:** el seed usa inserciones directas de Prisma Client en lugar de llamar a las APIs de NestJS. Esto significa que los side-effects automáticos (creación de `DocumentLink`, `PaymentReconciliation`, `StockMovement` completo) no ocurrían. El mapa de trazabilidad de documentos (`document-flow`) mostraba nodos aislados sin aristas entre ellos.  
**Solución:** agregar explícitamente después de cada documento transaccional:
- `DocumentLink` para cada paso del flujo: SOQ→SO, SO→DO, DO→SI, POQ→PO, PO→PR, PR→PI.
- `DocumentLink` entre factura y pago: SI→IP, PI→OP.
- `PaymentReconciliation` para vincular pagos con facturas: IP→SI (5,000 BOB), OP→PI (10,000 BOB).
**Verificación:** ejecutado `prisma migrate reset --force` → seed completo sin errores. Consulta post-seed confirma 8 `DocumentLink` y 2 `PaymentReconciliation`. Todos los `StockMovement` y `SerialNumber` tienen `warehouseId` asignado.

### 6. Fix: DeliveryOrders no calculaban ni mostraban total/subtotal/tax

**Backend:** `src/delivery-orders/delivery-orders.service.ts`  
**Problema:** 4 de 7 rutas de creación (`createFromReserveInvoice`, `createFromMultiReserveInvoice`, `createFromMultiOrder`, `createFromMultiQuotation`) y el `confirm()` solo actualizaban `totalCost`/`totalWeight`, dejando `subtotal`, `tax`, `total` y `totalDiscount` en `0`/`null`. El método `update()` tampoco recalculaba `totalDiscount`.

**Solución backend:**
- Nuevo helper privado `recalculateDeliveryOrderTotals(tx, deliveryOrderId)` que lee las líneas de la BD y recalcula todos los totales de cabecera (`subtotal`, `tax`, `total`, `totalDiscount`, `totalCost`, `totalWeight`).
- Reemplazados todos los bloques manuales incompletos con una llamada a este helper.
- `createManual`: agregado `totalDiscount: 0`.
- `confirm`: separado el cambio de `status` del recálculo de totales.

**Frontend:** `src/app/pages/delivery-orders/*`  
**Cambios:**
- Interface `DeliveryOrder`: agregados `total`, `subtotal`, `tax`, `totalDiscount`.
- Lista (`delivery-orders.component`): nueva columna **Total** con formato numérico.
- Formulario (`delivery-orders-form.component`): nuevos getters `subtotal`, `tax`, `total`; sección de totales reestructurada para mostrar siempre el desglose (descuento, subtotal, IVA, total) al estilo de SalesOrders.

**Tests:** backend 60 suites / 321 tests pasando. Frontend `ng build` sin errores; specs de lista y form de delivery orders pasan.

### 7. Fix: PurchaseReceipts y PurchaseInvoices con totales incompletos

**Archivos:** `src/purchase-receipts/purchase-receipts.service.ts`, `src/purchase-invoices/purchase-invoices.service.ts`  
**Problema:** las rutas multi-origen y desde factura reserva solo actualizaban `totalCost`/`totalWeight`, dejando `subtotal`, `tax`, `total` y `totalDiscount` en `0`/`null`.

**PurchaseReceipts — 3 rutas afectadas:**
- `createFromMultiOrder`: update solo con `totalCost` + `totalWeight`.
- `createFromReserveInvoice`: update solo con `totalCost` + `totalWeight`.
- `createFromMultiQuotation`: update solo con `totalCost` + `totalWeight`.

**PurchaseInvoices — 3 rutas afectadas:**
- `createFromReceipt`: faltaba `totalDiscount` en el `create`.
- `createFromReserveInvoice`: faltaba `totalDiscount` en el `create`.
- `createFromMultiReceipt`: faltaban `totalDiscount`, `totalCost`, `totalWeight` en el `create`.

**Solución:**
- Nuevo helper `recalculatePurchaseReceiptTotals(tx, receiptId)` que lee líneas de BD, recalcula todos los totales de cabecera (incluyendo `subtotalInBaseCurrency`, etc.) y actualiza el header.
- Reemplazados los 3 bloques manuales incompletos de PurchaseReceipts con el helper.
- Agregados los campos faltantes directamente en los `create` de PurchaseInvoices.

**Tests:** backend 60 suites / 321 tests pasando.

---
