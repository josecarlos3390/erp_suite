# AGENTS.md — erp_suite

ERP suite for the Bolivian market, inspired by SAP Business One. Monorepo with two independent sub-projects:

- **`backend-erp/`** — NestJS 11.0.1 REST API (TypeScript 5.7.3, Prisma 6.19.2, PostgreSQL)
- **`erp-frontend/`** — Angular 19.2.19 SPA (TypeScript ~5.7.2, Angular Material 19.2.19, standalone components, SSR enabled)

Both sub-projects use **npm** as the package manager.

---

## Arquitectura de despliegue multitenant

### Decisiones de infraestructura por perfil de cliente

Antes de onboarding de un nuevo tenant, analizar su volumen esperado:

| Perfil | Transacciones/día | Volumen de import | Despliegue recomendado | `BULK_IMPORT_SAFE_MODE` |
|--------|-------------------|-------------------|------------------------|-------------------------|
| **Micro** | < 100 | Ninguno | Instancia compartida | `false` |
| **Pequeño** | 100-1,000 | Ocasional (<1k/mes) | Instancia compartida | `false` |
| **Medio** | 1,000-10,000 | Frecuente (>10k/mes) | Instancia compartida | `false` |
| **Grande** | > 10,000 | Masivo (>50k/mes) | **Instancia DEDICADA** | **`true`** |
| **Enterprise** | > 50,000 | Masivo diario | **Instancia DEDICADA** + read replica | **`true`** |

### Modos de import masivo

La variable de entorno `BULK_IMPORT_SAFE_MODE` controla el comportamiento a nivel de **instancia**:

- **`BULK_IMPORT_SAFE_MODE=true` (default)**:
  - Nunca desactiva los triggers PostgreSQL.
  - Los imports masivos tardan ~40-50 segundos para 10k items.
  - 100% seguro para multitenant: no hay ventana de vulnerabilidad.
  - Recomendado para **instancias dedicadas** donde la consistencia es crítica.

- **`BULK_IMPORT_SAFE_MODE=false`**:
  - Desactiva triggers temporalmente para imports grandes.
  - Usa lock global (`_BulkImportLock`) para evitar imports paralelos.
  - Al finalizar hace `rebuild_all_custom_field_values()` para corregir documentos huérfanos.
  - Ventana de vulnerabilidad: ~10-20 segundos.
  - Recomendado para **instancias compartidas** con bajo/medio volumen.

### Estrategia de escalado cuando un tenant crece

```
Tenant en instancia COMPARTIDA
        ↓
   Supera 10k transacciones/día
   o requiere imports masivos frecuentes
        ↓
   Migrar a instancia DEDICADA
   (misma base de datos o DB separada)
        ↓
   Si supera 50k transacciones/día
        ↓
   Agregar read replica para reporting
```

### Variables de entorno críticas para despliegue

```bash
# Base de datos
DATABASE_URL=postgresql://...

# Seguridad
JWT_SECRET=...

# Import masivo
BULK_IMPORT_SAFE_MODE=true   # Instancia dedicada
# BULK_IMPORT_SAFE_MODE=false  # Instancia compartida
```

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
  - `npm test` (Jest, 815 tests)
  - ~30-60 seconds
- **Install:** already initialized via `npx husky init` after `npm install`

### Frontend (`erp-frontend/`)

- **Pre-commit** `.husky/pre-commit` + `.lintstagedrc.js`:
  - On commit of any `src/**/*.{ts,html,scss}`: `npm run lint` (ESLint v9 + Angular ESLint + Prettier)
  - ~20-60 seconds (varía según cantidad de archivos staged)
- **Pre-push** `.husky/pre-push`:
  1. `npx ng test --watch=false --browsers=ChromeHeadless` (Karma + Jasmine, 586 tests)
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
> **Update Apr 2026 (batch/serial phase 2+3):** Lint clean, build clean, 93 suites / 565 tests passing.  
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
- `npm test` → **103 suites, 815 tests** passing.
- `npm run test:e2e` → **7 suites, 35 tests** passing.
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

- **Frontend:** `ng lint` → `0 errors, 0 warnings`.
- **Backend:** `npm run lint` → `0 errors, 0 warnings`.

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

## Frontend LUNA Form Layout System (Jun 2026)

> **Context:** se creó un sistema declarativo de layout para formularios (`src/app/shared/luna-form/`) con el objetivo de unificar retícula, espaciado y jerarquía visual de los 51 formularios del frontend. Fase piloto completada con 31 formularios migrados.

### 1. Componentes de layout

Importar desde `@shared/luna-form`:

| Componente | Selector | Uso |
|------------|----------|-----|
| `LunaFormPageComponent` | `<luna-form-page>` | Contenedor raíz de página. Aplica padding compensado por header/action-bar sticky. Expone `density` para toda la página. |
| `LunaFormSectionComponent` | `<luna-form-section>` | Tarjeta de sección con `title`, `hint` y `status` semántico. |
| `LunaFormRowComponent` | `<luna-form-row>` | Fila grid configurable (`columns` 1-4, `gap` sm/md/lg), responsiva por defecto. |
| `LunaFormFieldComponent` | `<luna-form-field>` | Envoltorio `label + hint + error` para controles custom que no exponen label propio. |
| `LunaFormTabsComponent` | `<luna-form-tabs>` | Pestañas accesibles unificadas (reemplaza `.tab-bar` / `.tab-switcher` custom). |

### 2. Densidad

`density` en `<luna-form-page>` acepta `compact | comfortable | spacious` (default `compact`). Los tokens viven en `src/styles/_form-density.scss` y afectan padding, gaps y altura de controles.

### 3. Patrón de uso

```html
<luna-form-page>
  <app-document-form-header lunaFormHeader (back)="goBack()">...</app-document-form-header>

  <form [formGroup]="form" (ngSubmit)="save()" class="luna-form-page__body" novalidate>
    <luna-form-section title="Información general">
      <luna-form-row [columns]="3">
        <luna-input ...></luna-input>
        <luna-input ...></luna-input>
      </luna-form-row>
      <luna-form-row [columns]="3">
        <luna-form-field label="Cuenta" hint="..." [required]="true">
          <app-account-selector ...></app-account-selector>
        </luna-form-field>
      </luna-form-row>
    </luna-form-section>
  </form>

  <app-document-action-bar lunaFormActions (back)="goBack()">...</app-document-action-bar>
</luna-form-page>
```

### 4. Reglas

- Todo formulario nuevo o refactorizado debe usar `<luna-form-page>` como contenedor raíz.
- Agrupar campos relacionados en `<luna-form-section>`.
- Usar `<luna-form-row [columns]="N">` para alinear controles; no escribir grids custom en SCSS de página.
- Para tabs, usar `<luna-form-tabs>` en lugar de `.tab-bar` / `.tab-switcher`.
- No usar `::ng-deep` para perforar primitivos LUNA. Las variantes necesarias deben solicitarse al equipo de design system.
- Los slots `lunaFormHeader` y `lunaFormActions` deben aplicarse **directamente** sobre el componente proyectable (`app-document-form-header`, `app-document-action-bar`). No envolverlos en `<div>` ni `<ng-container>`, porque `<luna-form-page>` proyecta esos selectores exactos como `ng-content select="[lunaFormHeader]"`.
- **Accesibilidad de botones icon-only:** nunca dejar un `<luna-action-icon>` suelto como control interactivo. Usar `<luna-button action="moreHorizontal" (lunaClick)="..."></luna-button>`; `LunaButtonComponent` resuelve `title` y `aria-label` automáticamente desde `ACTION_TITLES`. Si el icono no tiene título registrado, agregarlo en `luna-button.component.ts`.
- Todo formulario refactorizado debe incluir un spec de Playwright que capture un screenshot (`e2e/screenshots/<nombre>-form-after.png`) y verifique renderizado real de la UI.

### 5. Estado de la migración

- **Formularios migrados (51):** `account-form`, `assembly-order-form`, `bank-account-form`, `bank-form`, `branch-form`, `currency-form`, `delivery-orders-form`, `discount-groups-form`, `employee-form`, `exchange-rate-form`, `incoming-payments-form`, `item-boms-form`, `item-form`, `item-barcode-form`, `item-group-form`, `journal-entries-form`, `outgoing-payments-form`, `partner-form`, `partner-group-form`, `payment-term-form`, `price-list-form`, `projects-form`, `purchase-credit-notes-form`, `purchase-debit-notes-form`, `purchase-invoices-form`, `purchase-orders-form`, `purchase-quotations-form`, `purchase-receipts-form`, `purchase-requests-form`, `purchase-reserve-invoices-form`, `purchase-returns-form`, `sales-credit-notes-form`, `sales-debit-notes-form`, `sales-orders-form`, `sales-quotations-form`, `sales-returns-form`, `sale-invoices-form`, `sale-reserve-invoices-form`, `special-price-form`, `stock-adjustments-form`, `stock-counts-form`, `stock-entries-form`, `stock-exits-form`, `stock-transfers-form`, `tax-indicator-form`, `transport-guides-form`, `udf-form`, `uom-conversion-form`, `uom-form`, `user-form`, `warehouse-form`.
- **Formularios restantes:** 0.
- **Páginas de detalle y configuración migradas (7):** `assembly-order-detail`, `item-detail`, `partner-detail`, `permissions`, `settings`, `dimensions-config`, `bulk-upload`.
- **Deuda de layout antiguo:** 0 archivos restantes con `form-page` / `form-header` / `form-section` / `form-row`.
- **Build:** ✅ éxito (warning de bundle budget: +59.56 kB vs 1.00 MB, no bloqueante).
- **Lint:** ✅ 0 errores, 0 warnings.
- **Tests:** ✅ 579/579 SUCCESS.
- **Cobertura general de componentes LUNA:** 182/185 templates HTML (98.4%) usan al menos un componente LUNA. Restantes: `app.component.html` (layout raíz), `pages/sap-integration/sap-integration.component.html` (contenedor de rutas) y `shared/document-flow/document-flow.component.html` (mantenido intacto por decisión de arquitectura).

### 6. Próximos pasos

1. ✅ Migrar documentos comerciales de compras (`purchase-quotations`, `purchase-orders`, `purchase-receipts`, `purchase-invoices`, `purchase-reserve-invoices`, `purchase-credit-notes`, `purchase-returns`).
2. ✅ Migrar documentos comerciales de ventas (`sales-quotations`, `sales-orders`, `delivery-orders`, `sale-invoices`, `sale-reserve-invoices`, `sales-credit-notes`, `sales-returns`).
3. Generar baseline visual consolidado con Playwright (`e2e/forms-reference-screenshots.spec.ts`).

---

## Frontend LUNA Modal Selector Trigger Standard (Jun 2026)

> **Context:** los selectores modales compartidos (`src/app/shared/*-selector`) tenían triggers vacíos inconsistentes: algunos usaban `<luna-button>`, otros `<button>` nativo, con bordes dashed, alturas distintas y sin modo `compact`. Se estandarizó un único patrón visual para que cualquier selector modal se vea idéntico en todos los formularios.

### 1. Ámbito

Aplica a **todos los selectores modales** (abren un `<luna-modal>` para elegir una entidad):

- `account-selector`, `bank-selector`, `branch-selector`, `cost-center-selector`, `currency-selector`, `employee-selector`, `invoice-selector`, `item-group-selector`, `item-selector`, `partner-group-selector`, `partner-selector`, `payment-term-selector`, `price-list-selector`, `project-selector`, `sales-person-selector`, `tax-indicator-selector`, `uom-selector`, `user-selector`, `warehouse-selector`.

**No aplica** a selectores nativos/dropdown (`advance-selector`, `batch-selector`, `enum-selector`, `serial-selector`) salvo que se migren a modal en el futuro.

### 2. Contrato del componente

Cada selector modal debe exponer:

```typescript
/** Modo compacto: para celdas de tabla / líneas de documento. */
@Input() compact = false;
```

### 3. HTML del trigger vacío

```html
<button
  type="button"
  class="<prefix>-open-btn"
  [class.<prefix>-compact]="compact"
  [disabled]="isDisabled"
  (click)="openModal()"
>
  <span class="<prefix>-open-icon">
    <luna-action-icon action="<icon>"></luna-action-icon>
  </span>
  <span class="<prefix>-open-label">{{ placeholder }}</span>
  <span class="<prefix>-open-arrow">
    <luna-action-icon action="chevronDown"></luna-action-icon>
  </span>
</button>
```

Reglas:
- Usar siempre `<button type="button">` nativo. **No** `<luna-button>`.
- `<prefix>` debe ser único por selector (ej. `ws-` warehouse, `bs-` bank, `acc-` account).
- El icono identifica el dominio; la flecha siempre es `chevronDown`.
- La clase compacta se bindea como `[class.<prefix>-compact]="compact"`.

### 4. SCSS del trigger vacío

```scss
.<prefix>-open-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 14px;
  width: 100%;
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-base);
  font-weight: 500;
  line-height: 1;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.12s,
    color 0.12s,
    background 0.12s;

  &:hover:not(:disabled) {
    border-color: var(--border-strong);
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.<prefix>-compact {
    height: 28px;
    padding: 0 8px;
    gap: 6px;
    font-size: var(--fs-sm);
    border-radius: var(--radius-sm);
  }
}

.<prefix>-open-icon,
.<prefix>-open-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-base);
  flex-shrink: 0;
  color: var(--text-secondary);
}

.<prefix>-open-arrow {
  margin-left: auto;
  font-size: var(--fs-xs);
  color: var(--text-tertiary);
}

.<prefix>-open-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### 5. Pill de selección

La pill mostrada cuando ya hay valor debe mantener la misma altura y compacto:

```scss
.<prefix>-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 14px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  // ...

  &.<prefix>-selected-compact {
    height: 28px;
    padding: 0 8px;
    gap: 6px;
    font-size: var(--fs-sm);
    border-radius: var(--radius-sm);
  }
}
```

### 6. Prefijos por selector

| Selector | Prefijo | Icono |
|----------|---------|-------|
| account-selector | `acc-` | `book` |
| bank-selector | `bs-` | `bank` |
| branch-selector | `brs-` | `building` |
| cost-center-selector | `ccs-` | `crosshair` |
| currency-selector | `cur-` | `coins` |
| employee-selector | `emp-` | `user` |
| invoice-selector | `inv-` | `invoice` |
| item-group-selector | `igs-` | `folder` |
| item-selector | `its-` | `box` |
| partner-group-selector | `pgs-` | `users` |
| partner-selector | `ps-` | `user` |
| payment-term-selector | `ptm-` | `creditCard` |
| price-list-selector | `pls-` | `tags` |
| project-selector | `prj-` | `projectDiagram` |
| sales-person-selector | `spm-` | `user` |
| tax-indicator-selector | `tis-` | `receipt` |
| uom-selector | `usm-` | `scale` |
| user-selector | `usr-` | `user` |
| warehouse-selector | `ws-` | `warehouse` |

> **Nota:** `currency-selector` migró de `pls-` a `cur-` y `project-selector` de `ps-` a `prj-` para evitar colisiones con `price-list-selector` y `partner-selector`.

### 7. Checklist para nuevos selectores modales

- [ ] Crear carpeta bajo `src/app/shared/<name>-selector`.
- [ ] Componente standalone con `ControlValueAccessor`.
- [ ] `@Input() compact = false;`.
- [ ] Empty trigger con `<button>` nativo, icono + flecha, clase compacta.
- [ ] Altura 36px / compact 28px, borde sólido `var(--border-default)`.
- [ ] Pill de selección con misma altura y variante compacta.
- [ ] Usar un prefijo único que no colisione con selectores existentes.

---

## Frontend LUNA Field Alignment & Search Guidelines (Jun 2026)

> **Context:** ajustes en `price-list-form` revelaron problemas recurrentes de alineación visual entre `luna-input`, selectores modales, tablas con selectores y campos de búsqueda custom. Esta guía resume los patrones para evitar repetirlos.

### 1. Altura de controles en una misma fila

- `luna-input size="md"` tiene un contenedor de `height: 36px` + `border: 1px`, es decir **38 px totales** (content-box).
- Los triggers vacíos de selectores modales deben mantener la misma altura total:
  - `.xxx-open-btn { height: 36px; border: 1px solid ...; }` sin `box-sizing: border-box`.
  - Si se añade `box-sizing: border-box`, la altura real será 36 px y quedará más bajo que el input.
- La **pill de selección** de un selector modal debe tener **la misma altura total** que el input:
  - `height: 36px;` o contenido controlado.
  - `padding: 3px 6px;` cuando contenga botones `luna-button size="sm"` (30 px totales incl. borde).
  - Nunca dejar que la pill crezca con padding grande (antes causaba 42-44 px).

### 2. Alineación de ancho

- El `:host` de un selector modal debe ser `display: block; width: 100%;` para ocupar el mismo ancho que `luna-input` dentro de `luna-form-field` o grid.
- No envolver el selector en un `<div>` con padding extra; usa `luna-form-field` si necesitas label.

### 3. Selectores dentro de tablas

- Dar suficiente ancho a la columna. Ejemplo: moneda con pill que muestra `Código + Nombre + botones` necesita ~180 px en desktop.
- La descripción dentro de la pill debe poder encogerse: `min-width: 0` + `text-overflow: ellipsis`.
- No duplicar bordes: quitar clases locales con `border` cuando el componente LUNA ya los aporte.

### 4. Campos de búsqueda

- **Nunca** implementar un buscador con icono/botón clear posicionados de forma absoluta sobre un `<luna-input>`.
- Usar las capacidades nativas de `luna-input`:

  ```html
  <luna-input
    type="text"
    [value]="searchTerm"
    placeholder="Buscar..."
    leadingAction="search"
    [clearable]="true"
    (input)="onSearchInput($event)"
    (cleared)="searchTerm = ''; cdr.markForCheck()"
  ></luna-input>
  ```

- Ancho mínimo recomendado: `280px` en desktop; `flex: 1` en mobile.

### 5. Checklist visual rápido

- [ ] Todos los controles de una fila tienen la misma altura total (incluyendo borde).
- [ ] No hay doble borde (clases locales + componente LUNA).
- [ ] Iconos leading de `luna-input` no tocan el borde (`margin-left` / `padding-left` del design system).
- [ ] Los selectores en celdas no se cortan; la columna es lo suficientemente ancha.
- [ ] Los buscadores usan `leadingAction` + `clearable`, no overlays absolutos.

## CI/CD (GitHub Actions)

Both repositories have GitHub Actions workflows that run on every `push` to `main` and every `pull_request` targeting `main`.

### Backend (`backend-erp/.github/workflows/ci.yml`)

Runs on `ubuntu-latest` with Node 20:

1. `npm ci`
2. `npm run lint` (ESLint v9 flat config)
3. `npm test` (Jest, 815 tests)

### Frontend (`erp-frontend/.github/workflows/ci.yml`)

Runs on `ubuntu-latest` with Node 20:

1. `npm ci`
2. `npm run lint` (ESLint v9 + Angular ESLint + Prettier)
3. `npx ng test --watch=false --browsers=ChromeHeadless` (Karma + Jasmine, 586 tests)
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

**Backend modules (~75 domains):**

- **Commercial documents:** `sales-quotations`, `sales-orders`, `delivery-orders`, `sale-invoices`, `sale-reserve-invoices`, `sales-returns`, `sales-credit-notes`, `sales-debit-notes`, `purchase-quotations`, `purchase-orders`, `purchase-receipts`, `purchase-invoices`, `purchase-reserve-invoices`, `purchase-returns`, `purchase-credit-notes`, `purchase-debit-notes`, `purchase-requests`, `stock-transfers`, `stock-entries`, `stock-exits`, `stock-adjustments`, `stock-counts`, `assembly-orders`, `document-drafts`
- **POS:** `pos`, `pos-sessions`, `pos-terminals`
- **Masters:** `items`, `item-groups`, `item-boms`, `item-barcodes`, `item-price-histories`, `price-lists`, `special-prices`, `discount-groups`, `partners`, `partner-groups`, `partner-addresses`, `partner-bank-accounts`, `warehouses`, `branches`, `tax-indicators`, `payment-terms`, `uoms`, `uom-conversions`, `currencies`, `exchange-rates`, `banks`
- **Accounting:** `journal-entries`, `account-mappings`, `accounts`, `incoming-payments`, `outgoing-payments`
- **Auth & Security:** `auth`, `users`, `tenants`, `security`, `permissions`, `audit-logs`
- **Utilities:** `common`, `prisma`, `settings`, `search`, `reports`, `dashboard`, `bulk-upload`, `table-preferences`, `document-flow`, `document-line-tracking`, `sap-integration`, `udf`, `alerts`, `approvals`, `employees`, `transport-guides`, `batches`, `serial-numbers`

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

**Frontend pages (~65 domains):**

- **Commercial documents:** `sales-quotations`, `sales-orders`, `delivery-orders`, `sale-invoices`, `sale-reserve-invoices`, `sales-returns`, `sales-credit-notes`, `sales-debit-notes`, `purchase-quotations`, `purchase-orders`, `purchase-receipts`, `purchase-invoices`, `purchase-reserve-invoices`, `purchase-returns`, `purchase-credit-notes`, `purchase-debit-notes`, `purchase-requests`, `stock-transfers`, `stock-entries`, `stock-exits`, `stock-adjustments`, `stock-counts`, `assembly-orders`, `document-drafts`
- **POS:** `pos`, `pos-sessions`, `pos-terminals`
- **Masters:** `items`, `item-groups`, `item-boms`, `item-barcodes`, `item-price-histories`, `price-lists`, `special-prices`, `discount-groups`, `partners`, `partner-groups`, `partner-addresses`, `partner-bank-accounts`, `warehouses`, `branches`, `tax-indicators`, `payment-terms`, `uoms`, `uom-conversions`, `currencies`, `exchange-rates`, `banks`
- **Accounting:** `journal-entries`, `account-mappings`, `accounts`, `incoming-payments`, `outgoing-payments`
- **Auth & Admin:** `users`, `profile`, `permissions`, `settings`, `alerts`, `approvals`, `employees`
- **Utilities:** `dashboard`, `search`, `reports`, `kardex`, `low-stock`, `bulk-upload`, `sap-integration`, `udf`, `transport-guides`, `batches`, `serial-numbers`

**Models present (~30 files):** `item.model.ts`, `partner.model.ts`, `partner-summary.model.ts`, `item-summary.model.ts`, `pagination.model.ts`, `warehouse.model.ts`, `tax-indicator.model.ts`, `price-list.model.ts`, `document-flow.model.ts`, `document-line.model.ts`, `sales-quotation.model.ts`, `purchase-quotation.model.ts`, `sales-order.model.ts`, `purchase-order.model.ts`, `delivery-order.model.ts`, `purchase-receipt.model.ts`, `sale-invoice.model.ts`, `purchase-invoice.model.ts`, `sale-reserve-invoice.model.ts`, `purchase-reserve-invoice.model.ts`, `sales-return.model.ts`, `sales-credit-note.model.ts`, `purchase-return.model.ts`, `purchase-credit-note.model.ts`, `stock-transfer.model.ts`, `stock-entry.model.ts`, `stock-exit.model.ts`, `stock-adjustment.model.ts`, `batch.model.ts`, `serial-number.model.ts`, `payment-common.model.ts`.

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

#### SSR Hydration Mismatch Fix (Apr 2026)

> **Context:** Angular SSR with `withFetch()` + `OnPush` change detection causes lists to get stuck on skeleton loading when refreshing (F5) or navigating directly to a route. Client-side routing works fine. Root cause: `*ngIf` inside `<ng-template #actions>` projected into `luna-data-table` creates a DOM mismatch between server-rendered skeletons and client hydration.

**The rule:**

| Location | Use | Do NOT use |
|----------|-----|------------|
| Inside `<ng-template #actions>` of `luna-data-table` | `[style.display]="condition ? '' : 'none'"` | `*ngIf` |
| Outside `luna-data-table` (panels, modals, dialogs) | `@if (condition) { ... }` | `*ngIf` (prefer `@if` for new code) |

**Why `[style.display]` works inside projected templates:**
- It keeps the DOM element stable between SSR and client hydration.
- The element is always in the DOM; only its CSS visibility changes.
- No hydration mismatch because the server and client produce identical DOM trees.

**Example — correct action buttons inside `luna-data-table`:**

```html
<ng-template #actions let-row>
  <luna-button
    action="stock"
    variant="secondary"
    (lunaClick)="openStock(row)"
    [style.display]="row._count && row._count.stock > 0 ? '' : 'none'"
  ></luna-button>
  <luna-button
    action="delete"
    variant="destructive"
    (lunaClick)="remove(row)"
    [style.display]="row.status === 'ACTIVE' && !row.isDefault ? '' : 'none'"
  ></luna-button>
</ng-template>
```

**Example — correct panel/modal outside `luna-data-table`:**

```html
@if (selectedWarehouse) {
  <div class="stock-panel-backdrop" (click)="closeStock()"></div>
```

---

#### LunaDataTable Race Condition Fix (Jun 2026)

> **Context:** `LunaDataTableComponent` con `tableKey` (persistencia de columnas) carga preferencias del backend en `ngOnInit()` vía `_loadPreferences()`. El padre (ej. `AccountsComponent`) también carga datos en su `ngOnInit()`. Ambas peticiones corren en paralelo. Cuando los datos del padre llegan primero, el padre pone `loading = false` y llama `markForCheck()`. Si la petición de preferencias llega *después*, el `markForCheck()` interno de la tabla no fuerza un re-render inmediato — el skeleton ya desapareció pero `_effectiveColumns` aún no estaba listo, quedando la tabla en blanco hasta la siguiente interacción.

**La regla:**

| Problema | Fix |
|----------|-----|
| `_loadPreferences()` usa `markForCheck()` | Usar **`detectChanges()`** para forzar ciclo inmediato |
| Skeleton desaparece antes de que prefs lleguen | Agregar flag `_prefsLoaded` y bloquear render hasta que prefs estén resueltas |
| Tabla sin `tableKey` no necesita esperar | `_prefsLoaded = true` por defecto; solo se bloquea cuando hay `tableKey` |

**Implementación:**

```typescript
// luna-data-table.component.ts
_prefsLoaded = true;

ngOnInit(): void {
  if (this.tableKey) {
    this._prefsLoaded = false;
    this._loadPreferences();
  }
}

private _loadPreferences(): void {
  if (!this.tableKey || !this.tablePrefService) {
    this._prefsLoaded = true;
    return;
  }
  this.tablePrefService
    .getOne(this.tableKey)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (pref) => {
        if (pref) {
          this._prefs = { columnOrder: pref.columnOrder, hiddenColumns: pref.hiddenColumns };
          this._clearCaches();
        }
        this._prefsLoaded = true;
        this.cdr.detectChanges(); // ← fuerza render inmediato, no marca para "próximo ciclo"
      },
      error: () => {
        this._prefsLoaded = true;
        this.cdr.detectChanges();
      },
    });
}
```

```html
<!-- luna-data-table.component.html — condición del skeleton -->
@if (loading || !_prefsLoaded) {
  <!-- skeleton rows -->
}
```

**Por qué `detectChanges()` y no `markForCheck()`:**
- `markForCheck()` marca el componente como "dirty" pero espera al próximo ciclo de detección de Angular (disparado por Zone.js).
- En SSR hydration, si el ciclo ya ocurrió antes de que las preferencias lleguen, el flag "dirty" se procesa vacío.
- `detectChanges()` ejecuta la detección **ahora**, sincrónicamente, garantizando que el template se re-renderiza con `_prefsLoaded = true`.
  <div class="stock-panel">
    <h3>{{ selectedWarehouse.name }}</h3>
  </div>
}
```

**Files fixed (9 components):**
- `warehouses`, `batches` (actions + panels/modals)
- `stock-transfers`, `stock-exits`, `stock-entries`, `stock-adjustments`
- `sales-quotations`, `sales-orders`
- `purchase-quotations`, `purchase-orders`
- `account-mappings`

**Files already compliant (do not use `*ngIf` inside `#actions`):**
- `items`, `users`, `uoms`, `tax-indicators`, `partners`, `partner-groups`, `banks`, `accounts`, `price-lists`, `payment-terms`, `exchange-rates`, `item-groups`, `serial-numbers`, `journal-entries`, `udf-list`, `low-stock`, and all document list pages that only use static action buttons.

---

#### OnPush + manual subscriptions (Jun 2026)

> **Context:** `JournalEntryPreviewButtonComponent` usa `ChangeDetectionStrategy.OnPush`. Al hacer `.subscribe()` manualmente y mutar propiedades dentro del callback (`next` / `error`), Angular no re-renderiza porque el cambio ocurre fuera de la zona de detección activa del componente. El modal y el estado de carga quedan "congelados" hasta que otra interacción dispare change detection.

**La regla:**

| Situación | Fix obligatorio |
|-----------|-----------------|
| Componente con `OnPush` + `.subscribe()` manual | Llamar `this.cdr.markForCheck()` **al final** de cada callback que mute estado visual |
| Uso de `async` pipe en el template | No aplica — el pipe ya dispara detección |
| `@Input()` setters o event handlers de la vista | No aplica — Angular ya dispara detección |

**Ejemplo — correcto:**

```typescript
import { ChangeDetectorRef, inject } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
export class MyComponent {
  private cdr = inject(ChangeDetectorRef);

  loadData() {
    this.loading = true;
    this.svc.getData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data = data;
          this.loading = false;
          this.cdr.markForCheck(); // ← obligatorio
        },
        error: (err) => {
          this.loading = false;
          this.error = err;
          this.cdr.markForCheck(); // ← obligatorio
        },
      });
  }
}
```

**Por qué `markForCheck()` y no `detectChanges()`:**
- `markForCheck()` marca el componente y sus ancestros como "dirty" para el **próximo** ciclo de detección, que Angular ejecutará de forma sincrónica cuando la microtask queue se vacíe (justo después del callback).
- `detectChanges()` forzaría la detección **inmediatamente** dentro del callback, lo cual puede causar `ExpressionChangedAfterItHasBeenCheckedError` si el padre también está en medio de un ciclo.
- Para suscripciones HTTP/RxJS normales, `markForCheck()` es suficiente y más seguro.

**Files fixed:**
- `journal-entry-preview-button.component.ts`

---

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
- Default warehouse resolution: `defaultWarehouseId` (branch-aware)
  - Hierarchy: `auth.defaultWarehouseId` → `warehouse.isDefault` → single warehouse → `null`.
  - When `form.branchId` is set, the pool is filtered to warehouses belonging to that branch (or global warehouses with `branchId == null`) before applying the hierarchy.
  - `WarehouseSelectorComponent` receives `[branchId]` and filters its list accordingly.
  - Auto-sync: changing `branchId` clears `warehouseId` if the selected warehouse no longer belongs to the new branch, and resets it to the new default.

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

**E2E test suites (7 files, 35 scenarios):**

| Suite | Scenarios |
|-------|-----------|
| `sales-flow.e2e-spec.ts` | 7 (SQ → SO → DO → SI, reservas, parciales, cancelaciones) |
| `purchase-flow.e2e-spec.ts` | 7 (PC → PO → PR → PI, reservas, cancelaciones) |
| `incoming-payments.e2e-spec.ts` | 5 (anticipos, pagos a factura, reconciliación, cancelación, filtros) |
| `stock-flow.e2e-spec.ts` | 7 (entradas, salidas, transferencias, ajustes, cancelaciones) |
| `returns-and-credit-notes.e2e-spec.ts` | 4 (devoluciones venta/compra, notas de crédito, cancelación) |
| `batch-serial-flow.e2e-spec.ts` | 4 (batchCostingEnabled false/true, recálculo de costo por lote, venta con lote) |
| `app.e2e-spec.ts` | 1 (health check) |

**E2E helpers (`test/test-utils.ts`):**
- `cleanupDocuments(prisma, tenantId?)` — borra documentos transaccionales y resetea stock. Si se pasa `tenantId`, filtra todas las operaciones por tenant.
- `createTestData(prisma)` — crea tenant, warehouse, user, item, partner, supplier, price list, stock inicial (100 unidades).
- `createBatchItem()`, `createBatch()`, `assertStock()`, `getStock()` — helpers para tests de lotes/series.
- **Nota:** `cleanupDocuments` resetea stock a 100. Si un test usa almacenes secundarios con stock diferente, debe recrear el stock en `beforeEach`.

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

## Date & Timezone Handling (Backend)

> **Context:** Jun 2026 — bug detectado en login donde `exchangeRateRequired` era `true` aunque el usuario tuviera tasas cargadas hasta fin de mes.

### El problema

PostgreSQL almacena `DateTime` en UTC. Cuando el backend compara fechas usando `new Date().toISOString().split('T')[0]`, el resultado depende de la zona horaria del servidor:

| Servidor | Hora local | `toISOString()` | Fecha extraída |
|----------|-----------|-----------------|----------------|
| UTC | 23:00 | `T+00:00` | Hoy |
| UTC-4 | 23:00 | `T+04:00` → día siguiente | **Mañana** ❌ |

Además, `getLatest()` ordena por `date: 'desc'` y devuelve la tasa *más reciente cargada* (puede ser futura si se hizo bulk), no la tasa de *hoy*.

### La solución

Siempre buscar la fecha exacta usando componentes locales (año, mes, día) y el índice único de Prisma:

```typescript
const now = new Date();
const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const todayRate = await this.prisma.exchangeRate.findUnique({
  where: {
    tenantId_date_fromCurrency_toCurrency: {
      tenantId: user.tenantId,
      date: new Date(todayYMD), // Prisma lo convierte a UTC 00:00:00
      fromCurrency: settings.foreignCurrency,
      toCurrency: settings.baseCurrency,
    },
  },
});
```

**Regla:** nunca comparar fechas de negocio con `toISOString().split('T')[0]` cuando el servidor puede estar en una zona horaria diferente a la del usuario.

---

## Domain Notes

- Business logic is implemented in **Spanish** (variable names, comments, UI labels).
- Document flow: Quotation → Order → Delivery/Receipt → Invoice → Reserve Invoice.
- **Auto-confirmación de facturas manuales:** `sale-invoices` y `purchase-invoices` auto-confirman al crear (`createManual`, `createFromOrder`, `createFromDelivery`). El status inicial es `CLOSED` y no requiere llamada a `confirm()` posterior.
- **Devoluciones (`SalesReturn`, `PurchaseReturn`)** siguen el flujo estándar: `create()` → `OPEN` → `confirm()` → `CLOSED` → `cancel()`. El asiento contable y los movimientos de stock se generan en `confirm()`, no en `create()`.
- Tax: Bolivian IVA rules; `TAX_RATE_NOMINAL` constant lives in `src/common/pricing.util.ts` and is re-exported from `src/constants.ts`.
- **BankAccount balance:** `IncomingPayment` y `OutgoingPayment` actualizan automáticamente `bankAccount.balance` vía `applyPaymentEffects()` / `revertPaymentEffects()` dentro de la misma transacción Prisma.
- **Entregas sin costo:** `DeliveryOrder.confirm()` lanza `BadRequestException` si ningún artículo tiene costo registrado (`totalCost <= 0`). Esto previene agujeros negros en el reconocimiento de COGS.
- Stock movements are tracked in `StockMovement` records; never mutate stock directly — use traceability utilities in `src/common/`.
- **batchCostingEnabled:** campo `Item.batchCostingEnabled` (default `false`). Cuando es `true`, los servicios de stock (`purchase-invoices`, `purchase-receipts`, `stock-entries`, `stock-transfers`, `stock-adjustments`) pasan `incomingUnitCost` a `upsertStockBatch`, permitiendo valoración individual por lote. Cuando es `false`, el costo se mantiene solo a nivel artículo (`Stock.avgCost`).
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

### Vista previa del asiento contable (sin persistir)

El motor contable expone una **vista previa** del asiento que se generaría al confirmar un documento, sin crear registros en la base de datos.

- **Backend:**
  - `POST /journal-entries/preview` — recibe `{ documentType, documentId }` y devuelve `JournalEntryPreview` con líneas enriquecidas (cuenta, socio, artículo, almacén) y flag `isBalanced`.
  - Implementado en `src/journal-entries/journal-entries.controller.ts` → `JournalEntriesService.preview()` → `AccountingEngineService.previewJournalEntry()`.
  - `AccountingEngineService` separa construcción (`_build*JournalEntryLines`) de persistencia (`_persist`). Los métodos `_build*` son puros y reutilizables para preview.
  - Documentos soportados: `SALE_INVOICE`, `PURCHASE_INVOICE`, `DELIVERY_ORDER`, `PURCHASE_RECEIPT`, `STOCK_ENTRY`, `STOCK_EXIT`, `STOCK_TRANSFER`, `STOCK_ADJUSTMENT`, `SALES_CREDIT_NOTE`, `PURCHASE_CREDIT_NOTE`, `SALES_RETURN`, `PURCHASE_RETURN`, `INCOMING_PAYMENT`, `OUTGOING_PAYMENT`.

- **Frontend:**
  - `JournalEntryPreviewButtonComponent` + `JournalEntryPreviewModalComponent` + `JournalEntryPreviewService` en `src/app/shared/journal-entry-preview/`.
  - `DocumentActionBarComponent` acepta `[documentType]` y `[documentId]`; cuando ambos están presentes muestra automáticamente el botón **"Vista previa asiento"**.
  - Integrado en los 14 formularios de documentos comerciales que generan asientos contables.

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
- ✅ Servicios: propagación de `customFields` completa en todos los documentos comerciales, stock (transfers, entries, exits, adjustments) e items
- ✅ Frontend: `UdfFormSection` y `UdfValuesCell` implementados y activos en 16+ formularios y listados

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
- Tests de frontend → ✅ 526 tests pasando (Karma + Jasmine).

---

## Frontend Performance & Navigation Diagnosis (May 2026)

Diagnóstico completo de navegación y rendimiento del frontend Angular. Se identificaron 5 categorías de problemas y se aplicaron fixes en 3 de ellas.

### Problemas identificados

| Categoría | Cantidad | Severidad |
|-----------|----------|-----------|
| Memory leaks (`subscribe` sin protección) | **113 archivos** | 🔴 Crítico |
| Componentes sin `OnPush` | **~142** | 🔴 Crítico |
| `*ngFor` sin `trackBy` | **~170 usos** | 🟡 Alto |
| Métodos en templates | **~250+ llamadas** | 🔴 Crítico |
| Sin loading states en catálogos | **10+ formularios** | 🟡 Medio |

### Fixes aplicados

#### ✅ Fase 1: Memory Leaks — `takeUntilDestroyed()` (82 archivos)
- Todas las suscripciones `.subscribe()` en componentes ahora usan `.pipe(takeUntilDestroyed(this.destroyRef))`.
- `DocumentListBase` ahora provee `protected destroyRef` para todas las clases hijas (~20 listados).
- `DocumentFormBase` ahora obtiene `DestroyRef` vía `this._injector.get(DestroyRef)` en sus métodos.

#### ✅ Fase 4: `trackBy` en `*ngFor` (31 archivos)
- `document-lines-table`: `trackByIndex` en líneas de documentos comerciales.
- `pos`: `trackByProductId`, `trackByCartId`, `trackByInvoiceId` en productos, carrito e invoices.
- `sidebar`: `trackByGroupKey`, `trackByItemLabel` en resultados de búsqueda.
- Todos los formularios comerciales: `trackByIndex` en arrays de líneas.

#### ✅ Fase 5: UX/UI — Loading states (4 formularios)
- `partner-form`, `price-list-form`, `account-form`, `user-form`: ahora muestran `catalogsLoading` y toast de error si falla la carga de catálogos.
- Las cargas de catálogos ahora usan `forkJoin` para loading state unificado.

### Tech debt pendiente (no bloqueante)

| Fase | Descripción | Razón para posponer |
|------|-------------|---------------------|
| **Fase 2** | `ChangeDetectionStrategy.OnPush` en ~140 componentes | ✅ Done — Todos los componentes `.component.ts` ahora usan `OnPush`. Build limpio. Recomendado testing manual de flujos críticos (creación/edición de documentos comerciales) para detectar posibles mutaciones de estado sin nueva referencia. |

---

## OnPush Change Detection Rules

> **Contexto:** Abr 2026 — migración completa a `OnPush` en 155 componentes. Se detectó que asignaciones de estado dentro de callbacks `subscribe()` no disparan change detection automáticamente, causando pantallas congeladas en "Cargando..." o botones de guardado bloqueados.
> **Regla de oro:** siempre que modifiques una propiedad enlazada al template dentro de un `subscribe()`, llama `this.cdr.markForCheck()` inmediatamente después.

### 1. Patrón obligatorio en todos los componentes

```typescript
this.service.getOne(id).subscribe({
  next: (data) => {
    this.form.patchValue(data);
    this.isLoading = false;
    this.cdr.markForCheck(); // ✅ REQUERIDO
  },
  error: () => {
    this.isLoading = false;
    this.cdr.markForCheck(); // ✅ REQUERIDO
  },
});
```

### 2. Propiedades que requieren `markForCheck()`

| Propiedad | Contexto típico |
|-----------|-----------------|
| `isLoading` / `loading` | Final de `load()`, `loadIntoForm()`, carga de catálogos |
| `isSaving` / `saving` | Final de `save()`, `create()`, `update()` |
| `hasChanges` | Solo si se modifica dentro de un `subscribe()` (no en eventos DOM) |
| Arrays/objetos reasignados | `this.items = result` dentro de HTTP callbacks |

### 3. Dónde obtener `cdr`

- **Clases base:** `DocumentFormBase` y `DocumentListBase` ya proveen `protected cdr = inject(ChangeDetectorRef)`.
- **Componentes hijos:** NO redeclares `cdr`. Usa `this.cdr.markForCheck()` directamente.
- **Otros componentes:** inyecta `protected cdr = inject(ChangeDetectorRef);` e importa `ChangeDetectorRef` desde `@angular/core`.

### 4. Qué NO requiere `markForCheck()`

- Eventos DOM nativos (`(click)`, `(input)`, `(change)`) — Angular detecta automáticamente.
- `@Input()` cambios desde el padre — OnPush los detecta.
- `async` pipe en templates — el pipe maneja la detección internamente.

### 5. Patrones críticos frecuentemente olvidados

#### 5.1 Modo manual con `forkJoin` en `ngOnInit`

Cuando un formulario entra en modo manual (`?manual=1`) y carga catálogos vía `forkJoin`, el callback `.subscribe()` **no** dispara change detection. Si no se llama `markForCheck()`, el selector de partner/cliente/proveedor permanece invisible hasta que el usuario interactúa con la página.

```typescript
} else if (manualParam === '1') {
  this.isManualMode = true;
  this.isDraft = true;
  forkJoin({
    partners: this.partnersService.getAllClients().pipe(catchError(() => of([]))),
    items: this.itemsService.getAll({ canBeSold: true }).pipe(catchError(() => of([]))),
  }).subscribe(({ partners, items }) => {
    this.partners = partners as Partner[];
    this.catalogItems = items as Item[];
    this._addEmptyManualRow();
    this.cdr.markForCheck(); // ✅ REQUERIDO — sin esto el selector no aparece
  });
}
```

**Regla:** todo `forkJoin` dentro de `ngOnInit` que alimente propiedades del template debe terminar con `this.cdr.markForCheck()`.

#### 5.2 Apertura de modales desde métodos del componente

Si un componente `OnPush` abre un modal asignando `boolean = true` (ej. `showAssignmentModal = true`) y el modal es proyectado via `<ng-content>` o vive dentro de un `@if` anidado, puede no renderizarse sin `markForCheck()`:

```typescript
openAssignmentModal() {
  this.assignmentLines = this.itemsArray.controls.map(...);
  this.showAssignmentModal = true;
  this.cdr.markForCheck(); // ✅ REQUERIDO — fuerza render del modal hijo
}
```

#### 5.3 `ControlValueAccessor` con `OnPush` (`writeValue` / `setDisabledState`)

> **Bug detectado:** `WarehouseSelectorComponent` usaba `OnPush` pero no inyectaba `ChangeDetectorRef`. Cuando el formulario reactivo asignaba `warehouseId` vía `writeValue()`, el template no se re-renderizaba porque Angular llama estos métodos fuera del ciclo normal de detección de cambios.
>
> **Escenario problemático:** el `warehouseId` se asigna *antes* de que `warehouses[]` llegue del backend (`forkJoin`). El componente recibe `selectedId`, pero `get selectedWarehouse()` retorna `undefined` porque el array aún está vacío. Cuando `warehouses` finalmente se llena, `OnPush` no detecta la recomputación del getter.

**Solución:** todo componente que implemente `ControlValueAccessor` y use `OnPush` **debe** inyectar `ChangeDetectorRef` y llamar `markForCheck()` en `writeValue()` y `setDisabledState()`:

```typescript
export class WarehouseSelectorComponent implements ControlValueAccessor, OnChanges {
  private cdr = inject(ChangeDetectorRef); // ✅ REQUERIDO

  @Input() warehouses: Warehouse[] = [];
  selectedId: number | null = null;
  isDisabled = false;

  writeValue(id: number | null): void {
    this.selectedId = id ?? null;
    this.cdr.markForCheck(); // ✅ REQUERIDO
  }

  setDisabledState(d: boolean): void {
    this.isDisabled = d;
    this.cdr.markForCheck(); // ✅ REQUERIDO
  }

  // registerOnChange / registerOnTouched — no requieren markForCheck
}
```

**Regla:** si un selector custom (`partner-selector`, `warehouse-selector`, `item-combobox`, etc.) implementa `ControlValueAccessor` y usa `OnPush`, verificar que tenga `cdr.markForCheck()` en `writeValue()` y `setDisabledState()`.

### 6. Validación automatizada

Antes de considerar completo cualquier fix de OnPush, ejecutar:

```bash
npx ng build --configuration production
```

Si un componente con `OnPush` se queda en "Cargando..." o no refresca tras guardar, la causa más probable es un `subscribe()` sin `markForCheck()`.

---

## Standard Selector Component Pattern (Modal-Based)

> **Contexto:** Jun 2026 — se identificó falta de estandarización entre los ~20 selectores del sistema. Algunos usaban `<select>` nativo, otros modal con `luna-modal`, cada uno con estilos propios. Se estandarizó el patrón modal basado en `warehouse-selector`.

### Cuándo usar el patrón modal

| Caso | ¿Modal? | Ejemplo |
|------|---------|---------|
| Catálogo maestro con >5 elementos | ✅ Sí | `warehouse-selector`, `partner-selector`, `item-group-selector` |
| Lista dinámica del backend con búsqueda | ✅ Sí | `account-selector`, `price-list-selector` |
| Enum fijo con ≤5 opciones | ⚠️ Opcional | `enum-selector` puede seguir modal para consistencia |
| Creación inline + selección (lote/serie) | ❌ No | `batch-selector`, `serial-selector` usan `<select>` + input de creación |
| Relación dependiente (item → lote → serie) | ❌ No | `batch-selector` carga por `itemId`/`warehouseId`; no aplica patrón puro |

### Estructura del componente

Todo selector modal **debe** seguir esta estructura exacta (adaptando solo el dominio):

#### 1. TypeScript

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-{domain}-selector',
  imports: [FormsModule, LunaButtonComponent, LunaModalComponent],
  templateUrl: './{domain}-selector.component.html',
  styleUrls: ['./{domain}-selector.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DomainSelectorComponent),
      multi: true,
    },
  ],
})
export class DomainSelectorComponent
  implements ControlValueAccessor, OnChanges
{
  private cdr = inject(ChangeDetectorRef);

  @Input() items: DomainItem[] = [];           // lista del catálogo
  @Input() placeholder = 'Seleccionar…';       // placeholder del trigger
  @Input() title = 'Seleccionar';              // título del modal
  @Input() compact = false;                    // modo reducido (tablas)
  @Input() readonly = false;                   // solo lectura
  @Output() itemSelected = new EventEmitter<DomainItem | null>();

  @ViewChild('modalSearchInput')
  modalSearchInputRef?: ElementRef<HTMLInputElement>;

  modalOpen = false;
  searchTerm = '';
  selectedId: number | null = null;

  // ControlValueAccessor con markForCheck() obligatorio
  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};
  isDisabled = false;

  writeValue(id: number | null): void {
    this.selectedId = id ?? null;
    this.cdr.markForCheck();
  }
  setDisabledState(d: boolean): void {
    this.isDisabled = d;
    this.cdr.markForCheck();
  }

  get selectedItem(): DomainItem | null { … }
  get filtered(): DomainItem[] { … }     // filtra por ACTIVE + searchTerm

  openModal() { … }
  closeModal() { … }
  select(item: DomainItem) { … }
  clearSelection(emit = true) { … }
  onSearchChange(term: string) { … }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.modalOpen) this.closeModal(); }
}
```

#### 2. HTML — tres regiones obligatorias

1. **Trigger con selección** (`.{prefix}-selected`): pill con código, nombre, botón ×, botón chevron.
2. **Trigger vacío** (`.{prefix}-open-btn`): botón `<button>` nativo con borde sutil, icono `luna-action-icon`, placeholder y flecha. **No** usar `<luna-button>` para evitar la caja anidada.
3. **Readonly** (`.{prefix}-readonly`): código + nombre plano, o `"—"`.
4. **Modal** (`luna-modal`):
   - Header con icono FontAwesome + título (`lunaModalHeader`).
   - Barra de búsqueda con icono lupa, input, botón clear.
   - Contador de resultados (`{n} resultado(s)` / `{n} X disponible(s)`).
   - Lista `<ul>` con items clickables. Cada item: icono tipo, código (badge mono), nombre, badge "✔ seleccionado", flecha derecha.
   - Empty state con icono lupa.
   - Footer (`lunaModalFooter`): hint `<kbd>Esc</kbd> para cerrar` + `luna-button variant="ghost" text="Cancelar"`.

#### 3. SCSS — prefijos y variables CSS

- **Trigger**: prefijo corto del dominio (ej. `ws-` para warehouse, `igs-` para item-group).
- **Modal**: prefijo largo del dominio + `m-` (ej. `wsm-` para warehouse modal, `igsm-` para item-group modal).
- **Colores**: usar únicamente variables CSS del design system (`var(--bg-subtle)`, `var(--color-primary-text)`, etc.).
- **Nunca** usar `@use 'styles/variables'` ni colores hex hardcodeados.

### Trigger vacío: usar `<button>` nativo, no `<luna-button>`

El trigger vacío debe ser un `<button type="button" class="{prefix}-open-btn">` nativo, estilado directamente por el SCSS del selector.

**No uses `<luna-button>` para el trigger vacío.** `<luna-button>` es un componente host que envuelve su propio `<button>` interno; aplicarle borde/fondo al host genera una caja dentro de otra caja y produce el efecto de “dentro de un input”.

```html
<!-- ✅ Correcto -->
<button type="button" class="ws-open-btn" (click)="openModal()">
  <span class="ws-open-icon"><luna-action-icon action="warehouse"></luna-action-icon></span>
  <span class="ws-open-label">{{ placeholder }}</span>
  <span class="ws-open-arrow"><luna-action-icon action="chevronDown"></luna-action-icon></span>
</button>

<!-- ❌ Incorrecto -->
<luna-button class="ws-open-btn" variant="secondary" (lunaClick)="openModal()">…</luna-button>
```

**Espaciado estándar:**
- Estado normal: `padding: 10px 14px; gap: 10px;`
- Modo compacto: `padding: 4px 8px; gap: 6px;`

Los botones `<luna-button>` siguen permitidos **dentro de la píldora seleccionada** (limpiar/cambiar) porque ahí se necesita la variante ghost/secondary compacta.

### Trigger con selección (pill)

La píldora de selección debe tener la **misma altura** que un input `luna-input` estándar (36 px) para no desfasarse visualmente con el resto del formulario.

```scss
.{prefix}-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;        // ✅ altura fija, igual a inputs
  padding: 0 14px;     // ✅ solo padding horizontal
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  // ...
}
```

**Compacto (tablas / líneas):**

```scss
.{prefix}-selected-compact {
  height: 28px;
  padding: 0 8px;
  gap: 6px;
  font-size: var(--fs-sm);
  border-radius: var(--radius-sm);
}
```

> **Por qué `height` en vez de padding vertical:** los botones de acción dentro de la pill pueden ser `<luna-button size="sm">` (28 px) o botones custom más pequeños. Forzar la altura del contenedor asegura que todos los selectores se alineen con los inputs sin depender del alto interno de cada botón.

### ⚠️ Regla crítica: `ChangeDetectorRef` en selectores que extienden `ModalSelectorBase`

> **Contexto:** Jun 2026 — `BranchSelectorComponent` (y otros 7 selectores) extendían `ModalSelectorBase`, una `@Directive()` abstracta que inyectaba `ChangeDetectorRef` vía `inject()`. Con `OnPush`, el CDR heredado de una directiva abstracta no se vincula correctamente a la vista del componente hijo standalone, causando que `detectChanges()` / `markForCheck()` fallen silenciosamente y el template nunca se re-renderice tras carga HTTP.
>
> **Síntoma:** El selector no aparece en el DOM o se queda en estado "Cargando…" para siempre. Comparado con `WarehouseSelectorComponent` (que NO extiende `ModalSelectorBase` e inyecta su propio `cdr`), el selector que extiende la base falla.

**Solución:** `ModalSelectorBase` declara `cdr` como `protected abstract`, forzando a cada componente hijo a inyectar su propio `ChangeDetectorRef`:

```typescript
// modal-selector.base.ts
@Directive()
export abstract class ModalSelectorBase<T> implements ControlValueAccessor {
  protected abstract cdr: ChangeDetectorRef; // ✅ Cada hijo inyecta el suyo
  // ... resto de la lógica compartida
}

// branch-selector.component.ts
export class BranchSelectorComponent extends ModalSelectorBase<Branch> {
  protected cdr = inject(ChangeDetectorRef); // ✅ Propio, vinculado a esta vista
  private svc = inject(BranchesService);
  // ...
}
```

**Regla:** Nunca uses `inject(ChangeDetectorRef)` en una `@Directive()` abstracta que será extendida por componentes standalone con `OnPush`. Cada componente concreto debe inyectar su propio `cdr`.

### Selectores que ya siguen el patrón (✅)

`warehouse-selector`, `branch-selector`, `partner-selector`, `partner-group-selector`, `item-group-selector`, `account-selector`, `bank-selector`, `currency-selector`, `employee-selector`, `invoice-selector`, `item-selector`, `payment-term-selector`, `price-list-selector`, `sales-person-selector`, `tax-indicator-selector`, `uom-selector`, `user-selector`.

### Selectores que usan `<select>` nativo por diseño (⚠️)

- `advance-selector` — anticipos; podría migrarse al patrón modal.
- `enum-selector` — opciones fijas; puede mantenerse como `<select>` o migrarse por consistencia.
- `batch-selector` — requiere creación inline (`allowCreate`) + carga dependiente de `itemId`/`warehouseId`.
- `serial-selector` — idem `batch-selector`.

### Checklist para crear un selector nuevo

- [ ] ¿El catálogo viene del backend y tiene >5 elementos? → Usar patrón modal.
- [ ] ¿Necesita búsqueda por nombre/código? → Usar patrón modal.
- [ ] ¿Implementa `ControlValueAccessor` con `OnPush`? → `cdr.markForCheck()` en `writeValue` y `setDisabledState`.
- [ ] ¿Usa `luna-modal` con `[open]` / `(closed)` y slots `lunaModalHeader/Body/Footer`?
- [ ] ¿El SCSS usa variables CSS (`var(--*)`) y prefijos consistentes?
- [ ] ¿El trigger tiene estado vacío (`<button>` nativo, no `<luna-button>`), estado seleccionado (pill), y estado readonly?
- [ ] ¿El modal tiene empty state, contador de resultados, y hint `Esc` en el footer?

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

## Tenant Metrics & Migration Detection (May 2026)

> Sistema automático para detectar cuando un tenant en instancia compartida ha crecido lo suficiente como para justificar una migración a instancia dedicada.

### Modelo `TenantMetrics`

```prisma
model TenantMetrics {
  id                    Int      @id @default(autoincrement())
  tenantId              Int
  date                  DateTime @default(now()) @db.Date
  salesDocCount         Int      @default(0)
  purchaseDocCount      Int      @default(0)
  inventoryDocCount     Int      @default(0)
  totalDocCount         Int      @default(0)      // docs creados HOY
  bulkImportCount       Int      @default(0)
  bulkImportTotalItems  Int      @default(0)      // últimos 30 días
  customFieldValueCount Int      @default(0)
  totalDocumentCount    Int      @default(0)      // docs totales del tenant
  recommendation        String   @default("HEALTHY") // HEALTHY | WARNING | MIGRATE
  @@unique([tenantId, date])
  @@index([tenantId, date])
}
```

### Umbrales de recomendación

| Nivel | Transacciones/día | Items importados/mes | Documentos totales |
|-------|-------------------|----------------------|-------------------|
| **HEALTHY** | ≤ 5,000 | ≤ 10,000 | ≤ 500,000 |
| **WARNING** | 5,000 – 10,000 | 10,000 – 50,000 | 500,000 – 1,000,000 |
| **MIGRATE** | > 10,000 | > 50,000 | > 1,000,000 |

### Servicios y endpoints

- **`TenantMetricsService`** (`src/admin/tenant-metrics.service.ts`):
  - `collectMetrics(tenantId)` — calcula y persiste métricas de un tenant para el día actual.
  - `getHealthReport()` — devuelve reporte de salud de TODOS los tenants activos, ordenado por prioridad (MIGRATE primero).
  - `recordBulkImport(tenantId, itemCount)` — incrementa contadores de import masivo (llamado desde `ItemsService.bulkImport`).
  - `@Cron('5 0 * * *')` — recolecta métricas diariamente a las 00:05 para todos los tenants.

- **`AdminController`** (`src/admin/admin.controller.ts`):
  - `GET /admin/tenant-health` — requiere permiso `admin:view`. Devuelve array de `TenantHealthReport`.

### Integración con imports masivos

`ItemsService.bulkImport()` llama `tenantMetricsService.recordBulkImport()` tras completar la inserción, garantizando que la métrica de volumen de import refleje la actividad real del tenant.

### Módulo

- **`AdminModule`** (`src/admin/admin.module.ts`) — importado en `AppModule` y `ItemsModule`.
- Tests: `tenant-metrics.service.spec.ts` (4 tests) + `admin.controller.spec.ts` (1 test).

---

## Multi-Tenant & Branch Isolation Design Rules (MANDATORY)

> **Context:** Jun 2026 — completed full audit of `tenantId` isolation and `branchId` propagation across all 27+ backend domains and 21+ frontend pages. All transactional services now enforce branch validation. Future modules MUST follow these rules.

### Backend Rules

#### 1. Every Prisma `.create()` in a transactional service MUST include `tenantId`

```typescript
// ✅ Correct
await tx.salesQuotation.create({
  data: {
    tenantId,
    branchId: branchId ?? null,
    partnerId: dto.partnerId,
    // ...
  },
});

// ✅ Also correct (variable passed)
const data: Prisma.SalesQuotationUncheckedCreateInput = {
  tenantId,
  branchId: branchId ?? null,
  // ...
};
await tx.salesQuotation.create({ data });

// ❌ Wrong
await tx.salesQuotation.create({
  data: { partnerId: dto.partnerId }, // missing tenantId!
});
```

#### 2. Every transactional document service MUST call `assertBranchRequired` and persist `branchId`

```typescript
async create(dto: CreateXDto, tenantId: number, branchId?: number | null) {
  const settings = await this.settings.getAll(tenantId);
  assertBranchRequired(settings, branchId); // ✅ validate

  return this.prisma.$transaction(async (tx) => {
    const doc = await tx.someDocument.create({
      data: {
        tenantId,
        branchId: branchId ?? null, // ✅ persist
        // ...
      },
    });
    // ...
  });
}
```

**Transactional domains** (must follow this rule): `sales-quotations`, `sales-orders`, `delivery-orders`, `sale-invoices`, `sale-reserve-invoices`, `sales-returns`, `sales-credit-notes`, `sales-debit-notes`, `purchase-quotations`, `purchase-orders`, `purchase-receipts`, `purchase-invoices`, `purchase-reserve-invoices`, `purchase-returns`, `purchase-credit-notes`, `purchase-debit-notes`, `incoming-payments`, `outgoing-payments`, `journal-entries`, `pos`, `assembly-orders`, `stock-transfers`, `stock-counts`, `stock-entries`, `stock-exits`, `stock-adjustments`, `transport-guides`, `purchase-requests`, `document-drafts`.

#### 3. `findUnique` / `findFirst` MUST scope by `tenantId`

```typescript
// ✅ Correct (composite key)
const doc = await tx.salesQuotation.findUnique({
  where: { tenantId_id: { tenantId, id } },
});

// ✅ Correct (findFirst with tenantId)
const doc = await tx.salesQuotation.findFirst({
  where: { tenantId, id },
});

// ❌ Wrong (missing tenant scope)
const doc = await tx.salesQuotation.findUnique({ where: { id } });
```

#### 4. Controllers MUST pass `user.tenantId` to services

```typescript
@Post()
create(@Body() dto: CreateXDto, @CurrentUser() user: JwtPayload) {
  return this.service.create(dto, user.tenantId, user.defaultBranchId);
}
```

#### 5. BranchRequiredGuard blocks mutations for branch-less users

When `enableBranches=true`, any user without `defaultBranchId` is blocked from POST/PUT/PATCH/DELETE by the global `BranchRequiredGuard`. Read operations (GET) are always allowed.

#### 6. Document draft converters MUST propagate `branchId`

When adding a new converter in `document-drafts/converters/index.ts`, always pass `draft.branchId` to the target service:

```typescript
// ✅ Correct
return service.createManual(payload, ctx.userId ?? 0, draft.branchId ?? null);

// ❌ Wrong (loses branch)
return service.createManual(payload, ctx.userId ?? 0);
```

### Frontend Rules

#### 1. List components MUST filter by `branchId`

- **If extending `DocumentListBase`**: inherit `branchId` automatically. Just pass `branchId` in `getAll()` / `findAll()` and add `<app-branch-filter-select>` to the template.
- **If NOT extending `DocumentListBase`** (rare): manually add `branchId` state, `onBranchChange()`, and pass it to the service.

```typescript
// In load()
this.service.getAll({ ...this.filters, branchId: this.branchId })
```

```html
<!-- In template -->
<app-branch-filter-select
  [value]="branchId"
  (branchIdChange)="onBranchChange($event)"
></app-branch-filter-select>
```

#### 2. Transactional forms MUST include `<app-branch-selector>`

Every form that creates or updates a transactional document must:
- Have a `branchId` FormControl.
- Render `<app-branch-selector formControlName="branchId">`.
- Send `branchId` in the payload to the backend.

```typescript
this.form = this.fb.group({
  partnerId: [null, Validators.required],
  branchId: [this.auth.defaultBranchId], // ✅
  // ...
});
```

**Hybrid branch model (Option C):** The branch selector is kept in forms for flexibility (managers/admins may override), but rendered in **compact mode** to reduce visual prominence. Pass `[compact]="true"` for all commercial documents. Configuration forms (warehouses, users, employees) leave it expanded because branch assignment is the primary purpose of the form.

```html
<!-- Commercial document — compact ✅ -->
<app-branch-selector
  formControlName="branchId"
  [compact]="true"
></app-branch-selector>

<!-- Configuration form — expanded (default) ✅ -->
<app-branch-selector
  formControlName="branchId"
  placeholder="— Sin sucursal asignada —"
></app-branch-selector>
```

#### 3. Branch context indicator (sidebar)

The sidebar (`SidebarComponent`) displays the user's current active branch below the ERP Suite logo. This provides constant visual context without requiring the user to open a form. The indicator:
- Shows branch code (pill) + name when expanded.
- Shows only the building icon when collapsed.
- Is driven by `auth.defaultBranchId` + `BranchesService.getAll()`.
- Is hidden if the user has no default branch assigned.

This complements (not replaces) the form-level branch selector.

### Automated Enforcement

Run the audit script locally or in CI:

```bash
# Backend
npm run audit:tenant-branch

# It checks:
# - assertBranchRequired → branchId in .create()
# - tenantId present in .create()
# - findUnique/findFirst include tenantId
# - controllers pass user.tenantId
# - no hardcoded tenantId
```

The script runs automatically in GitHub Actions (`.github/workflows/ci.yml`) after lint and before tests.

### Checklist for New Modules

When scaffolding a new transactional domain, verify:

- [ ] Prisma model has `tenantId Int` and `@@unique([tenantId, id])`
- [ ] Prisma model has `branchId Int?` if it represents a business document
- [ ] DTO extends `BaseDocumentDto` (inherits `branchId`)
- [ ] Service calls `assertBranchRequired(settings, branchId)` before mutation
- [ ] Service persists `tenantId` and `branchId` in Prisma `.create()`
- [ ] Service uses `tenantId_id` or `{ tenantId, id }` in `findOne`/`findUnique`
- [ ] Controller passes `user.tenantId` and `user.defaultBranchId` to service
- [ ] Frontend list passes `branchId` in queries
- [ ] Frontend form includes `branchId` FormControl and `<app-branch-selector>`
- [ ] `DraftQueryDto` (if applicable) includes `branchId` for draft listing
- [ ] Converter (if applicable) passes `draft.branchId` to target service

---

## Document Stock & Tracking Pattern (Unified)

> **Context:** Apr 2026 — standardized `trackingAssignments[]` as the single input for batch/serial tracking across all commercial documents. Legacy `batchId`/`serialNumberId` fields are still stored for backward compatibility but are now derived fields.

### Backend Pattern

All commercial document services must use the helper:

```typescript
import { resolveTrackingFields } from '../common/document-stock.helper';

const { batchId, serialNumberId, batchCode, serialNumberCode } =
  await resolveTrackingFields(tx, tenantId, line);
```

This derives all 4 fields from `line.trackingAssignments[0]` with automatic DB lookups if codes are missing.

### Prisma Schema Fields (per line-item table)

Every commercial document line table must have:

```prisma
model ExampleItem {
  // ... existing fields ...
  batchId             Int?
  batchCode           String?
  serialNumberId      Int?
  serialNumberCode    String?
  trackingAssignments Json?
  @@index([batchCode])
  @@index([serialNumberCode])
}
```

### DTO Pattern

Use `TrackingAssignmentDto` instead of anonymous types:

```typescript
import { TrackingAssignmentDto } from '../../common/dto/tracking-assignment.dto';

export class CreateExampleItemDto {
  // ... other fields ...
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackingAssignmentDto)
  trackingAssignments?: TrackingAssignmentDto[];
}
```

### Lookup Endpoints

For auto-populating tracking from typed codes:

```
GET /batches/lookup?code=LOT-2025-A&itemId=101
GET /serial-numbers/lookup?code=SER-A001
```

Both return the full record (including `id`, `code`, `itemId`, `warehouseId`, `status`).

---

## Commercial Form Patterns (Frontend)

### Inline Batch/Serial Comboboxes

Forms with inline `batch-combobox` / `serial-combobox` must write into `trackingAssignments[0]` instead of direct `batchId`/`serialNumberId` controls.

```typescript
onInlineBatchSelected(index: number, batch: Batch) {
  const row = this.itemsArray.at(index) as FormGroup;
  const qty = Number(row.get('quantity')?.value) || 1;
  row.get('batchId')?.setValue(batch.id, { emitEvent: false });
  row.get('trackingAssignments')?.setValue(
    [{ batchId: batch.id, batchCode: batch.code, serialNumberId: null, serialNumberCode: null, quantity: qty }],
    { emitEvent: false },
  );
}

onInlineSerialSelected(index: number, serial: SerialNumber) {
  const row = this.itemsArray.at(index) as FormGroup;
  row.get('serialNumberId')?.setValue(serial.id, { emitEvent: false });
  row.get('trackingAssignments')?.setValue(
    [{ batchId: null, batchCode: null, serialNumberId: serial.id, serialNumberCode: serial.code, quantity: 1 }],
    { emitEvent: false },
  );
}
```

### `allowCreate` Restriction by Document Type

| Document Type | `allowCreate` on Batch/Serial | Reason |
|---------------|-------------------------------|--------|
| `purchase-receipts`, `stock-entries`, `stock-adjustments` (INCREASE) | `true` | Entry documents create stock |
| `delivery-orders`, `sale-invoices`, `stock-exits`, `stock-transfers`, returns, credit notes | `false` | Exit/transfer documents only select existing |

### Modal Assignment Pattern

`onBatchSerialAssigned()` must:
1. Set `batchId`/`serialNumberId` on the FormGroup (backward compatibility)
2. Set `trackingAssignments` with the full array from the modal
3. Call `this.closeAssignmentModal()`
4. Call `this.cdr.markForCheck()` (OnPush detection)

```typescript
onBatchSerialAssigned(results: AssignmentResult[]) {
  for (const r of results) {
    const line = this.itemsArray.at(r.lineIndex) as FormGroup;
    if (!line) continue;
    const first = r.assignments[0];
    line.get('batchId')?.setValue(first?.batchId ?? null, { emitEvent: false });
    line.get('serialNumberId')?.setValue(first?.serialNumberId ?? null, { emitEvent: false });
    line.get('trackingAssignments')?.setValue(r.assignments, { emitEvent: false });
  }
  this.closeAssignmentModal();
  this.cdr.markForCheck();
}
```

### FormGroup Initialization

Every line FormGroup builder must include `trackingAssignments`:

```typescript
return this.fb.group({
  // ... other controls ...
  batchId: [line.batchId ?? null],
  serialNumberId: [line.serialNumberId ?? null],
  trackingAssignments: [line.trackingAssignments ?? []],
});
```

And `_addEmptyRow()` must initialize it:

```typescript
return this.fb.group({
  // ... other controls ...
  batchId: [null],
  serialNumberId: [null],
  trackingAssignments: [[]],
});
```

---

## SAP Business One Compatibility Guidelines

> **Context:** The ERP is inspired by SAP B1 and must remain structurally compatible for a future bidirectional integration (SAP Service Layer ↔ our backend). All future design decisions affecting document structure, field naming, or master data should be evaluated against these guidelines.

### Design Principle

> **Prefer SAP-aligned patterns even when our internal IDs are numeric.** Integration will be handled by an adapter layer (`sap-connector`) that maps our numeric IDs to SAP alphanumeric codes (`CardCode`, `ItemCode`, `WarehouseCode`). The closer our document shapes are to SAP, the thinner that adapter layer remains.

### Document Mapping (Our Domain → SAP Entity)

| Our Document | SAP Service Layer Entity | Notes |
|--------------|--------------------------|-------|
| `SalesQuotation` | `Quotations` | Base document for orders |
| `SalesOrder` | `Orders` | `DocumentLines[].BaseType` / `BaseEntry` for traceability |
| `DeliveryOrder` | `Deliveries` | `DocumentLines[].BaseType = 17` (Order) |
| `SaleInvoice` | `Invoices` | `DocumentLines[].BaseType` tracks origin |
| `SaleReserveInvoice` | `Invoices` with reserve logic | SAP uses DownPaymentInvoices for reserves |
| `PurchaseQuotation` | `PurchaseQuotations` | |
| `PurchaseOrder` | `PurchaseOrders` | |
| `PurchaseReceipt` | `PurchaseDeliveryNotes` | |
| `PurchaseInvoice` | `PurchaseInvoices` | |
| `StockTransfer` | `StockTransfers` | Direct mapping |
| `StockEntry` / `StockExit` | `InventoryGenEntries` / `InventoryGenExits` | |
| `JournalEntry` | `JournalEntries` | Direct mapping |
| `BusinessPartner` | `BusinessPartners` | `CardType: 'cCustomer'`, `'cSupplier'`, `'cLid'` |

### ✅ DO — SAP-Compatible Patterns

1. **Keep header + lines structure**
   - Every commercial document must have `items: DocumentLine[]` (or `DocumentLines` in SAP terms).
   - Line-level fields: `itemId`, `quantity`, `price`, `priceNet`, `discountPct`, `discountAmt`, `taxIndicatorId`, `warehouseId`, `projectCode`, `dimension1`, `dimension2`.

2. **Preserve traceability fields (`baseDocType` / `baseDocId` / `baseLineId`)**
   - These map directly to SAP's `BaseType`, `BaseEntry`, `BaseLine`.
   - Never remove these fields from line-item tables.

3. **Use `projectCode`, `dimension1`, `dimension2` on lines**
   - SAP equivalent: `ProjectCode`, `CostingCode`, `CostingCode2`.
   - Keep them as optional strings on line items, not just headers.

4. **Track batch/serial via `trackingAssignments` array**
   - SAP expects `BatchNumbers` or `SerialNumbers` collections per line.
   - Our `trackingAssignments` array is the compatible abstraction:
     ```typescript
     // LOT → maps to SAP BatchNumbers
     { batchId, batchCode, serialNumberId: null, serialNumberCode: null, quantity }
     // SERIAL → maps to SAP SerialNumbers
     { batchId: null, batchCode: null, serialNumberId, serialNumberCode, quantity: 1 }
     ```

5. **Maintain `DocumentType` enum aligned with SAP `ObjType` values**
   - `SALES_ORDER` → SAP `17`
   - `DELIVERY_ORDER` → SAP `15`
   - `SALE_INVOICE` → SAP `13`
   - `PURCHASE_ORDER` → SAP `22`
   - etc.
   - The `objectType` field on headers should follow this mapping.

6. **Support `customFields` / UDFs**
   - SAP B1 uses `U_` prefixed fields. Our `customFields: Record<string, any>` on headers and lines is the compatible pattern.

### ❌ DON'T — Anti-Patterns That Break SAP Integration

1. **Don't replace `baseDocType` / `baseDocId` with custom relation names**
   - Avoid names like `parentOrderId`, `sourceInvoiceId` at the line level. Use `baseDocType` + `baseDocId` + `baseLineId` consistently.

2. **Don't put batch/serial IDs directly on the line without `trackingAssignments`**
   - Legacy `batchId` / `serialNumberId` fields are kept for backward compatibility, but the canonical input must be `trackingAssignments[]`.

3. **Don't invent new tax structures per document**
   - Use `taxIndicatorId` → `TaxIndicator` table → `code` field. This `code` will map to SAP `TaxCode`.

4. **Don't omit `warehouseId` at the line level**
   - SAP supports line-level warehouses (`WarehouseCode`). Always include `warehouseId` on lines, even if it duplicates the header warehouse.

5. **Don't use internal numeric IDs in external-facing DTOs without a code field**
   - When creating public API payloads (for future SAP adapter consumption), always expose a human-readable code alongside the numeric ID:
     ```typescript
     // ✅ Good
     { partnerId: 42, partnerCode: 'C0001', partnerName: 'Cliente Ejemplo' }
     // ❌ Bad
     { partnerId: 42 }
     ```

### Master Data Compatibility Checklist

When adding new fields to master data entities, prefer fields that exist in SAP B1:

| Our Entity | Preferred Fields (SAP-aligned) |
|------------|-------------------------------|
| **Partner** | `code` (CardCode), `name` (CardName), `cardType` (`'CUSTOMER'` / `'SUPPLIER'` / `'LEAD'`), `federalTaxId` (LicTradNum), `phone`, `email`, `address`, `defaultWarehouseId`, `priceListId`, `paymentTermsId`, `defaultTaxIndicatorId`, `salesPersonId` |
| **Item** | `code` (ItemCode), `name` (ItemName), `description`, `groupId` (ItemsGroupCode), `trackingType` (`'NONE'` / `'LOT'` / `'SERIAL'`), `inventoryUomId`, `salesUomId`, `purchaseUomId`, `weight`, `manageStockByWarehouse`, `defaultWarehouseId`, `defaultTaxIndicatorId` |
| **Warehouse** | `code` (WarehouseCode), `name` (WarehouseName), `location`, `branchId` |
| **TaxIndicator** | `code` (TaxCode), `name`, `rate` |

## Timezone Handling Rules (Fase 7.1)

> **Context:** tenant-configurable `timeZone` (default `America/La_Paz`). All business-date logic must use the tenant's timezone, never server/browser local time.

### Backend (NestJS)

| Situation | Pattern | Example |
|-----------|---------|---------|
| Receive a date-only string from the frontend | `fromTenantDate(value, timeZone)` | `const date = fromTenantDate(dto.date, settings.timeZone)!;` |
| Default document date to "today" | `resolveDocumentDate(undefined, timeZone)` | `date: resolveDocumentDate(dto.date, settings.timeZone)` |
| Start/end of a tenant day for DB filters | `startOfTenantDay` / `endOfTenantDay` | `startOfTenantDay(new Date(), settings.timeZone)` |
| "Now" for business logic (expirations, alerts) | `nowInTenantTimeZone` | `const now = nowInTenantTimeZone(settings.timeZone);` |
| Format a UTC Date for display | `formatTenantDate` / `formatTenantDateOnly` | `formatTenantDateOnly(invoice.date, settings.timeZone)` |
| Date range from frontend filters | `tenantDateRange(dateFrom, dateTo, timeZone)` | `tenantDateRange(query.from, query.to, settings.timeZone)` |

### Frontend (Angular)

| Situation | Pattern | Example |
|-----------|---------|---------|
| Convert UTC → `<input type="date">` | `tenantDate.toDateInput(value)` | `date: [this.tenantDate.toDateInput(doc.date) ?? this.tenantDate.todayInput()]` |
| Today as `YYYY-MM-DD` | `tenantDate.todayInput()` | `date: [this.tenantDate.todayInput()]` |
| Convert `YYYY-MM-DD` to UTC start-of-day | `tenantDate.toStartOfDayISO(value)` | `const d = this.tenantDate.toStartOfDayISO(this.form.value.date);` |
| Add days to a date-only string | `tenantDate.addDays(dateOnly, days)` | `const due = this.tenantDate.addDays(baseDate, term.days);` |
| Format for display | `tenantDate.formatDateOnly(value)` | `<td>{{ row.date | tenantDate }}</td>` |

### ❌ Forbidden patterns

- `new Date()` + `setHours(0,0,0,0)` for business dates.
- `date.getFullYear()` / `getMonth()` / `getDate()` from browser `Date` for input values.
- `setDate(date.getDate() + n)` for due-date/installment calculations.
- SQL `TO_CHAR(date, 'YYYY-MM')` without timezone conversion.

### Testing timezone-aware logic

Use the shared helper `src/testing/test-timezones.util.ts` to run date-sensitive specs against the canonical set of timezones:

```typescript
import { forEachTimeZone } from '../testing/test-timezones.util';

forEachTimeZone((timeZone) => {
  describe(`zona horaria: ${timeZone}`, () => {
    it('calcula dueDate en la zona del tenant', async () => {
      // ...
    });
  });
});
```

Default test zones: `America/La_Paz`, `UTC`, `America/New_York`, `Pacific/Auckland`.

> **Build note:** `src/testing` is excluded from the production build via `tsconfig.build.json` because the helper uses Jest globals (`describe`).

---

### Reminder for Future Agents

> Before modifying any commercial document DTO, service, or Prisma schema related to orders, deliveries, invoices, stock movements, or partners, ask yourself: *"Will this change make the SAP adapter harder to write?"*
>
> If the answer is yes, prefer the SAP-aligned alternative or document the divergence explicitly in the code with a comment like:
> ```typescript
> // ✅ SAP-NOTE: This field diverges from SAP B1 because <reason>.
> //    The adapter will handle mapping via <strategy>.
> ```

---


---

### Frontend OnPush + markForCheck() in async HTTP callbacks

> **Context:** All commercial document forms use `ChangeDetectionStrategy.OnPush`. When `provideHttpClient(withFetch())` is enabled (default in Angular 19+), HTTP responses do **not** trigger Zone.js ticks. Therefore, any `FormGroup.setValue()` or `itemsArray.push()` inside a `.subscribe()` callback will update the model but **not** repaint the view until the user interacts with the page (click, blur, etc.).
>
> **Symptom:** The value "is there" (console shows correct data) but the UI looks frozen or blank until a click elsewhere.

#### ✅ Correct pattern — always call `markForCheck()` after mutating form state in async callbacks

```typescript
// Inside onManualItemChange, _resolveAutoDiscount, _resolvePriceFromList, etc.
this.http.get<...>(...).subscribe({
  next: (res) => {
    this.itemsArray.at(index).get('price')?.setValue(res.price, { emitEvent: false });
    this.calculateLine(index);
    this.cdr.markForCheck();  // ← REQUIRED
  },
  error: () => {
    this.itemsArray.at(index).get('price')?.setValue(basePrice, { emitEvent: false });
    this.calculateLine(index);
    this.cdr.markForCheck();  // ← REQUIRED
  },
});
```

#### ❌ Forbidden pattern — `setValue` without `markForCheck()` in OnPush + async

```typescript
// ❌ Wrong — view stays frozen until next user interaction
this.http.get<...>(...).subscribe((res) => {
  this.itemsArray.at(index).get('price')?.setValue(res.price);
  // missing markForCheck()
});
```

#### Where this applies

All commercial document forms (sales quotations, sales orders, delivery orders, sale invoices, sale reserve invoices, purchase orders, purchase receipts, etc.) that resolve prices via HTTP inside `OnPush` components.

#### Special case: `PartnerSelectorComponent.writeValue()`

When the selector loads a pre-selected partner via `getOne(id)`, it also runs outside a Zone.js tick:

```typescript
this.svc.getOne(id).subscribe((p) => {
  this.selectedPartner = p;
  this.cdr.detectChanges();  // ← use detectChanges() here, not markForCheck()
});
```

Use `detectChanges()` (not `markForCheck()`) when the update is **synchronous** inside the callback and no other child components need to be checked in the same tick.

### ⚠️ Checklist for new commercial document forms

When adding a new form component that uses `OnPush` + `HttpClient`, verify each HTTP callback that mutates form state:

- [ ] `onManualItemChange` / `selectManualItem` — after `setValue('price')` or `setValue('cost')` in both `next` and `error` branches
- [ ] `_resolveAutoDiscount` — after `applyResolvedSpecialPrice` or fallback to `_resolvePriceFromList` in both `next` and `error` branches
- [ ] `_resolvePriceFromList` — after `setValue('price')` in both `next` and `error` branches
- [ ] `writeValue` in `PartnerSelectorComponent` — use `detectChanges()` after `selectedPartner = p`
- [ ] `forkJoin` batch price resolution — call `markForCheck()` inside the final `forEach` or at the end of the `subscribe` block
- [ ] `loadOne` / `loadOrder` / `loadInvoice` — after all `itemsArray.push()` and `form.patchValue()` calls complete

#### Files that MUST follow this pattern (verified)

| Component | File |
|-----------|------|
| Sales Quotation | `src/app/pages/sales-quotations/sales-quotations-form.component.ts` |
| Sales Order | `src/app/pages/sales-orders/sales-orders-form.component.ts` |
| Delivery Order | `src/app/pages/delivery-orders/delivery-orders-form.component.ts` |
| Sale Invoice | `src/app/pages/sale-invoices/sale-invoices-form.component.ts` |
| Sale Reserve Invoice | `src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.ts` |
| Purchase Quotation | `src/app/pages/purchase-quotations/purchase-quotations-form.component.ts` |
| Purchase Order | `src/app/pages/purchase-orders/purchase-orders-form.component.ts` |
| Purchase Receipt | `src/app/pages/purchase-receipts/purchase-receipts-form.component.ts` |
| Purchase Invoice | `src/app/pages/purchase-invoices/purchase-invoices-form.component.ts` |
| Purchase Reserve Invoice | `src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts` |
| Partner Selector | `src/app/shared/partner-selector/partner-selector.component.ts` |

#### Smell — how to detect missing `markForCheck()`

Search for `.subscribe({` followed by `setValue` or `patchValue` without `markForCheck()`:

```bash
cd erp-frontend/src/app/pages
grep -B2 -A5 "\.setValue\|\.patchValue" *.ts | grep -B5 -A5 "subscribe"
```

Or use this regex in your IDE:
```regex
\.subscribe\(\{[\s\S]*?(setValue|patchValue)[\s\S]*?\}\);(?![\s\S]*?markForCheck|detectChanges)
```

Any match inside an `OnPush` component is a bug.

#### Template for new price-resolution methods

Copy-paste this template when adding a new `_resolvePriceFromList` or similar method:

```typescript
private _resolvePriceFromList(index: number, itemId: number, basePrice: number) {
  this.http
    .get<{ price: number }>(
      `${environment.apiUrl}/price-lists/resolve?itemId=${itemId}&partnerId=${this.partnerId}&basePrice=${basePrice}`,
    )
    .subscribe({
      next: (res) => {
        this.itemsArray.at(index).get('price')?.setValue(res.price, { emitEvent: false });
        this.calculateLine(index);
        this.cdr.markForCheck();  // ← REQUIRED: OnPush + withFetch()
      },
      error: () => {
        this.itemsArray.at(index).get('price')?.setValue(basePrice, { emitEvent: false });
        this.calculateLine(index);
        this.cdr.markForCheck();  // ← REQUIRED: OnPush + withFetch()
      },
    });
}
```

#### `forkJoin` vs individual `subscribe`

When resolving prices in batch (e.g., `loadOrder` + `price-lists/resolve` for multiple lines), use `forkJoin` to fire all requests in parallel, then call `markForCheck()` **once** at the end of the `subscribe` block, not inside each inner callback:

```typescript
forkJoin(requests).subscribe((results) => {
  results.forEach((res, index) => {
    if (!res) return;
    const line = this.itemsArray.at(index);
    line.get('price')?.setValue(res.price, { emitEvent: false });
    line.get('priceNet')?.setValue(res.price, { emitEvent: false });
    this.calculateLine(index);
  });
  this.cdr.markForCheck();  // ← single call after all mutations
});
```

---

## LUNA-first Design System Policy (new code and migrations)

All UI in `erp-frontend` **must** be built with LUNA v2 primitives. Native HTML/CSS substitutes are not allowed for any new feature.

### Currently available LUNA v2 components

- `luna-button` — primary/secondary/ghost/destructive/link/icon-only actions
- `luna-card` — surface, stat, list, glass variants
- `luna-badge` — status and label indicators
- `luna-empty-state` — empty/initial/error content blocks
- `luna-modal` — centered dialog with header/body/footer slots
- `luna-data-table` — sortable, selectable, paginated, configurable table
- `luna-action-icon` — SVG action icons used inside buttons

### Primitives planned / missing (build before using custom replacements)

High priority (forms dominate the UI surface):
- `luna-input` (text, number, date, password)
- `luna-select` / `luna-combobox`
- `luna-textarea`
- `luna-checkbox` / `luna-radio` / `luna-switch`
- `luna-label` / `luna-form-field` / `luna-error-message`

Medium priority (navigation & feedback):
- `luna-tabs` (default, pill, vertical)
- `luna-breadcrumb`
- `luna-toast` / `luna-alert`
- `luna-spinner` / `luna-skeleton`
- `luna-pagination` (standalone)
- `luna-drawer` / `luna-slide-over`
- `luna-confirm-dialog`

Lower priority / specialized:
- `luna-command-palette`, `luna-date-picker`, `luna-file-upload`, `luna-wizard`, etc.

### Migration rule

- If a LUNA component exists for a pattern, **use it**. Do not introduce new native `<button>`, `<span class="badge">`, `<table>`, modal backdrops, empty-state blocks, or card wrappers.
- When modifying a file that still contains native equivalents, migrate them to LUNA as part of the same change.
- If a needed primitive does not exist yet, extend LUNA (`src/app/shared/luna/`) instead of creating a one-off local component.
- Keep the public API minimal and additive; do not break existing inputs/outputs/events.

### Tokens

All LUNA components and consuming pages must use tokens from `src/styles/tokens/`. No hardcoded colors, shadows, spacing, or animations outside tokens, except for one-off layout math (e.g. `calc()`).

---

## Backend Price Resolution Hierarchy (Jul 2026)

> **Context:** unified price resolution across all sales documents to prevent
> inconsistent pricing when a quotation expires and a downstream document is
> generated.

### The 6-level hierarchy (from highest to lowest priority)

| Level | Source | Resolves | Note |
|-------|--------|----------|------|
| **1** | **SpecialPrice with `partnerId`** (acuerdo directo) | `priceBruto` (fixed) or `discountPct` / `discountAmt` | Quantity breaks apply inside this level |
| **2** | **Partner special discount** applied on `item.price` | discounted price | Only if level 1 has no fixed price; applies on original base price |
| **3** | **ItemGroupDiscount** (discount by item group) | discounted price | Applies on original `item.price`, not on an already discounted price |
| **4** | **SpecialPrice with `priceListId` and `partnerId = null`** | `priceBruto` (fixed) or `discountPct` / `discountAmt` | Quantity breaks apply inside this level; applies on original base price |
| **5** | **Partner price list** (`partner.priceListId` or `partner.specialPriceListId` if `useSpecialPrice = true`) | `priceBruto` from `priceListItem` | Uses `_resolvePartnerListPrice` which respects `useSpecialPrice` |
| **6** | **Item base price** (`item.price`) | fallback price | Last resort |

### How quantity breaks work inside SpecialPrice

Quantity breaks are **not a separate level**. They are evaluated **inside**
SpecialPrice resolution (levels 1 and 4) via `_extractSpecialPriceResult`:

1. Find the applicable `quantityBreak` for the ordered quantity
2. If a break exists → use **only** the break's discount (`discountPct` or `discountAmt`)
3. If no break matches → use the base `discountPct` / `discountAmt` of the `specialPriceItem`
4. If the `specialPriceItem` has a fixed `priceBruto` → use that price **and ignore all discounts** (including breaks)

### Implementation functions

All sales documents must use **one of these** functions when resolving prices
without a document base (i.e. expired quotation, manual entry, draft check):

```typescript
// Single item — used in create/update line-by-line
resolveItemPriceForPartner(
  tx, tenantId, partnerId, itemId, basePrice, quantity, today, priceListId?
)

// Batch — used when pre-resolving many items (e.g. from expired quotation)
resolveItemPriceBulkForPartner(
  tx, tenantId, partnerId, items: { itemId, basePrice, quantity }[], today, priceListId?
)
```

**Both functions live in** `backend-erp/src/common/price-resolver.util.ts`.

### What NOT to use

❌ `PriceListsService.resolvePrice()` — only resolves the partner's assigned price list (level 5), ignoring SpecialPrice and ItemGroupDiscount.

❌ `PriceListsService.resolvePriceBulk()` — same limitation as above.

### When a document base exists (quotation, order)

Documents with a base document (delivery, invoice) use `resolveDeliveryItemPrice`
instead. Its hierarchy is:

```
1. Valid quotation price (if baseDocType = SALES_QUOTATION and not expired)
2. Order price (if baseDocType = SALES_ORDER)
3. Expired quotation → linked order price (if any)
4. Then same 6 levels as above (3-8 in that function)
```

### Discount accumulation (now "winner takes all")

**As of Jul 2026 refactor, discounts are NO LONGER accumulated.**
Each level resolves a price based on the **original** `item.price` (or base price),
and the first level that produces a non-zero price wins. Subsequent levels are
ignored.

**Example with $1,000 base price:**
- Level 1: SpecialPrice partner fixed → **$920** (winner, stop here)
- Level 2: SpecialPrice partner 10% discount → $900 (ignored, level 1 won)
- Level 3: ItemGroupDiscount 5% → $950 (ignored)
- Level 4: List special 3% → $970 (ignored)
- Level 5: Partner list $980 (ignored)
- Level 6: Base price $1,000 (ignored)

**Before the refactor (accumulation):** 10% partner + 5% group = $855 (multiplicative)
**After the refactor (winner takes all):** 10% partner = $900 (first winner)

This matches SAP-style pricing: the most specific agreement wins, and discounts
are not stacked across different types of agreements.

**If you need stacked discounts, configure them inside a single SpecialPrice**
(e.g. a single agreement with a quantity break that includes the combined discount).

### Files that must be updated when adding new price levels

If a new price source is added (e.g. "promotional campaign", "loyalty discount"):

1. `price-resolver.util.ts` — add the new level to both:
   - `resolveDeliveryItemPrice` (levels 3-8)
   - `resolveItemPriceForPartner` (levels 1-6)
2. `sales-quotations.service.ts` — already uses `resolveItemPriceForPartner` (bulk in vencida)
3. `sales-orders.service.ts` — uses `resolveItemPriceForPartner` (bulk in expired quotation)
4. `sale-invoices.service.ts` — uses `resolveItemPriceForPartner` / `resolveItemPriceBulkForPartner`
5. `sale-reserve-invoices.service.ts` — same as above
6. `document-drafts.service.ts` — uses `resolveItemPriceBulkForPartner` for price checks
