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
# Note: 90 warnings remain (unused imports/variables) — safe to ignore or clean gradually

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
# Note: 84 warnings remain (unused imports/variables) — non-blocking

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
  - ~5-10 seconds
- **Pre-push** `.husky/pre-push`:
  - `npm test` (Jest, 44 tests)
  - ~30-60 seconds
- **Install:** already initialized via `npx husky init` after `npm install`

### Frontend (`erp-frontend/`)

- **Pre-commit** `.husky/pre-commit` + `.lintstagedrc.js`:
  - On commit of any `src/**/*.{ts,html,scss}`: `npm run lint` (ESLint v9 + Angular ESLint + Prettier)
  - ~10-20 seconds
- **Pre-push** `.husky/pre-push`:
  1. `npx ng test --watch=false --browsers=ChromeHeadless` (Karma + Jasmine, 268 tests)
  2. `npm run build` (production build verification)
  - ~2-4 minutes
- **Install:** already initialized via `npx husky init` after `npm install`

### Notes

- The monorepo root also has Husky installed, but it only acts on the root repo (which contains config files only). It can be ignored or removed if desired.
- lint-staged uses **function syntax** for commands to prevent passing staged filenames as CLI arguments (which would break Jest/Angular CLI pattern matching).
- Pre-commit is intentionally **fast** (lint only); pre-push catches the slower validations (tests + build) before code reaches the remote.

---

## Project Architecture

### Backend

- `src/<module>/` — one NestJS module per business domain. Each module contains: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, and colocated `*.spec.ts`.
- `src/common/` — shared utilities: pagination, code generation, pricing, stock, traceability, tax indicators, payment utils, progress utils.
- `src/prisma/` — global `PrismaService` extending `PrismaClient`.
- `src/auth/` — JWT auth: guards (`JwtAuthGuard`, `RolesGuard`), strategies (`JwtStrategy`), decorators (`@Public()`, `@Roles()`, `@CurrentUser()`), DTOs.
- `prisma/schema.prisma` — single source of truth for DB schema.
- `test/` — E2E specs (`*.e2e-spec.ts`) with `jest-e2e.json` config.

**Backend modules (25 domains):**
`auth`, `common`, `delivery-orders`, `document-flow`, `item-groups`, `items`, `partner-groups`, `partners`, `pos`, `price-lists`, `prisma`, `purchase-invoices`, `purchase-orders`, `purchase-quotations`, `purchase-receipts`, `purchase-reserve-invoices`, `sale-invoices`, `sale-reserve-invoices`, `sales-orders`, `sales-quotations`, `settings`, `tax-indicators`, `tenants`, `users`, `warehouses`.

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

- **TypeScript strictness:** `strict: false`, `strictNullChecks: false`, `noImplicitAny: false` — types are annotated by convention but not enforced by the compiler.
- **Return types:** annotate async method return types explicitly (`Promise<string>`, `Promise<void>`, etc.).
- **Interfaces over classes** for DTOs inputs/outputs, JWT payloads, utility types.
- **`as const`** for constant objects (e.g., `SAFE_SELECT`, `CODE_SEQUENCES`).
- **Enum values:** string union types or Prisma-generated enums in `SCREAMING_SNAKE_CASE` (`'ACTIVE' | 'INACTIVE'`).
- **Vertical alignment** of properties in object literals for readability.
- **NestJS module pattern:**
  ```typescript
  @Controller('resource')
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

| Alias | Points to |
|---|---|
| `@env/*` | `src/environments/*` |
| `@models/*` | `src/app/models/*` |
| `@shared/*` | `src/app/shared/*` |
| `@core/*` | `src/app/core/*` |
| `@auth/*` | `src/app/auth/*` |
| `@pages/*` | `src/app/pages/*` |

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
- ⚠️ **`priceNet` semantic inconsistency (architectural debt):**
  - `sale-reserve-invoices`: `priceNet` stores **unit net** (`lc.priceNet`)
  - `sale-invoices`, `purchase-invoices`, `purchase-reserve-invoices`: `priceNet` stores **line-level net** (`lc.lineNet`)
  - `delivery-orders`, `purchase-receipts`: custom tax logic, no `calcLineWithIndicator`
  - **Recommended future fix:** rename fields to `priceNetUnit` vs `priceNetLine` to avoid margin-report bugs.

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
    { provide: PrismaService, useValue: { item: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() }, stock: { findMany: jest.fn(), findUnique: jest.fn() }, $transaction: jest.fn((cb: any) => cb({ item: { create: jest.fn() } })) } },
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
- Tax: Bolivian IVA rules; `TAX_RATE_NOMINAL` constant lives in `src/common/pricing.util.ts` and is re-exported from `src/constants.ts`.
- Stock movements are tracked in `StockMovement` records; never mutate stock directly — use traceability utilities in `src/common/`.
- Code generation (e.g., `SOQ-000001`) uses PostgreSQL sequences via `src/common/code-generator.util.ts` (internally `code-generator.util.ts`).
- **Multi-tenancy:** `Tenant` model with `tenantId` on nearly every table; `@@unique([tenantId, code])` and `@@index([tenantId])` are standard patterns.
- **Soft deletes:** all business records use `status: 'ACTIVE' | 'INACTIVE'` instead of hard deletion.
- **Document linking:** `DocumentLink` table enables cross-referencing between any document types for traceability.
- **Price list hierarchy:** partners can have special price lists; if a partner has a special price list active, it takes priority over the partner group's price list. This logic is implemented in `src/common/price-resolver.util.ts`.
