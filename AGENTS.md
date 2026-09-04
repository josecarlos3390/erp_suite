# AGENTS.md — erp_suite

> **Última actualización:** 2026-08-08.  
> **Versión canónica de restricciones transversales.**  
> Para detalles específicos de frontend, backend, roadmap o auditoría, ver los archivos enlazados abajo.

---

## 🔒 Protocolo de inicio de trabajo (OBLIGATORIO)

Antes de realizar **cualquier acción** de código, diseño, planificación, refactorización, bugfix o auditoría en este monorepo, el agente **DEBE** leer el archivo de guía correspondiente según la naturaleza de la tarea. No se asumirá conocimiento previo de patrones, reglas de tipado, layouts ni estándares de UI.

| Tipo de tarea | Archivo obligatorio | Qué contiene |
|---------------|---------------------|--------------|
| **Frontend** (Angular, UI, componentes, formularios, listados, selectores, LUNA) | `FRONTEND_GUIDE.md` | Patrones canónicos, OnPush, LUNA, action bars, selectores, tipado, checklists |
| **Backend** (NestJS, API, Prisma, DTOs, servicios, queries, tests) | `BACKEND_GUIDE.md` | Arquitectura, seguridad de tipos (0 `as any`), deuda técnica, infraestructura, testing |
| **Planificación** (nuevas features, priorización, alcance, fases) | `ROADMAP.md` | Fases completadas, pendientes, criterios de aceptación, próximos pasos |
| **Bug / Auditoría** (investigar errores, fixes, regresiones, performance) | `AUDIT.md` | Hallazgos resueltos, base de bugs, métricas de referencia, issues activos |
| **General / Transversal** (tarea ambigua, onboarding, duda de arquitectura) | **Todos los anteriores** | — |

### Reglas de lectura

1. **Si la tarea toca `erp-frontend/src/`** (`.ts`, `.html`, `.scss`) → leer `FRONTEND_GUIDE.md` **completo** antes de escribir o modificar cualquier archivo.
2. **Si la tarea toca `backend-erp/src/`** (`.ts`, schema Prisma, DTOs, tests) → leer `BACKEND_GUIDE.md` **completo** antes de escribir o modificar cualquier archivo.
3. **Si la tarea es una nueva feature** → leer `ROADMAP.md` para verificar prioridades, fases y criterios de aceptación antes de proponer implementación.
4. **Si la tarea es un bug o fix** → leer `AUDIT.md` para verificar si el problema ya fue documentado, resuelto, o si hay un patrón de fix establecido.
5. **Nunca asumir conocimiento** de patrones que viven en estos archivos. Siempre leer primero.
6. **Después de leer**, seguir las **checklists** al final de cada guía antes de entregar el trabajo.

> ⚠️ **Incumplimiento:** Si un agente modifica código sin haber leído la guía correspondiente, está autorizado el usuario a rechazar el cambio y solicitar relectura.

---

## Índice de documentación canónica

| Archivo | Contenido | Ubicación |
|---------|-----------|-----------|
| **FRONTEND_GUIDE.md** | Patrones de diseño, OnPush, LUNA, action bars, selectores, tipado | `./FRONTEND_GUIDE.md` |
| **BACKEND_GUIDE.md** | Arquitectura, seguridad de tipos, deuda técnica, infraestructura | `./BACKEND_GUIDE.md` |
| **ROADMAP.md** | Roadmap de features por fases, deuda técnica, criterios de aceptación | `./ROADMAP.md` |
| **AUDIT.md** | Hallazgos de auditoría, tracking de acciones, métricas, bugs | `./AUDIT.md` |
| **README.md** | Onboarding, stack y comandos principales del monorepo | `./README.md` |

### Documentación por dominio

| Carpeta | Propósito | Archivos clave |
|---------|-----------|----------------|
| `docs/guides/` | Guías canónicas de dominio específico | `ESTANDAR_LINEAS_DOCUMENTO.md`, `ACCOUNTING_ENTRIES_GUIDE.md`, `guia-implementacion-configuracion.md` (orden de configuración/parametrización por perfil: contabilidad completa vs solo comercial/inventario; checklist + errores típicos) |
| `docs/plans/` | Planes de trabajo activos | `plan-consistencia-visual-v2.md`, `plan-mejoras-ux-ui-frontend.md` |
| `docs/reference/` | Análisis técnicos y referencias de arquitectura | `ACCOUNTS_DETERMINATION_FIX.md`, `SAP_B1_VS_ERP_COMPARATIVE_ANALYSIS.md`, `SAP_B1_INTEGRATION.md` (capa de integración bidireccional SAP B1: modelos, mapeos, idempotencia, migraciones) |
| `docs/archive/` | Informes históricos de migraciones completadas | Índice de frentes y cierres de fase |

---

## 1. Visión general del proyecto

`erp_suite` es un ERP modular para el mercado boliviano, inspirado en SAP Business One. Monorepo físico con dos subproyectos independientes:

- **`backend-erp/`** — API REST en **NestJS 11.0.1** + **TypeScript 5.7.3** + **Prisma 6.19.2** sobre **PostgreSQL**.
- **`erp-frontend/`** — SPA en **Angular 19.2.19** + **TypeScript ~5.7.2** + **Angular Material 19.2.19**, componentes standalone y **SSR habilitado**.

Ambos subproyectos usan **npm** como gestor de paquetes. Cada uno es un repositorio Git anidado con sus propios hooks de Husky. La raíz del monorepo solo orquesta Husky + lint-staged.

### Alcance funcional (módulos principales)

- **Catálogos maestros:** terceros (clientes/proveedores), artículos, almacenes, sucursales, empleados, proyectos, impuestos, listas de precios, cuentas contables, dimensiones, UDFs.
- **Ventas:** cotizaciones, pedidos, entregas, facturas, facturas de reserva, notas de crédito/débito, devoluciones.
- **Compras:** solicitudes, cotizaciones, pedidos, recepciones, facturas, facturas de reserva, notas de crédito/débito, devoluciones.
- **Inventario:** entradas, salidas, transferencias, ajustes, tomas de inventario, ensamblajes, lotes, seriados.
- **Finanzas / Contabilidad:** pagos entrantes/salientes, asientos contables, condiciones de pago.
- **POS:** terminales y sesiones de punto de venta.
- **Soporte:** flujo de documentos, borradores, aprobaciones, alertas, auditoría, monitoreo, integración SAP.

### Organización del monorepo

```
erp_suite/
├── backend-erp/          # API NestJS (repo Git propio)
│   ├── src/              # ~90 módulos de dominio
│   ├── prisma/           # schema, migraciones, seed
│   ├── test/             # tests E2E con Jest
│   └── dist/             # salida de build
├── erp-frontend/         # SPA Angular (repo Git propio)
│   ├── src/app/          # páginas, modelos, shared, core, auth
│   ├── e2e/              # tests E2E con Playwright
│   └── dist/             # salida de build
├── luna/                 # componentes standalone del design system (copia de referencia)
├── .agents/skills/       # skills de Kimi para backend/frontend
├── docs/                 # documentación del proyecto
│   ├── guides/           # guías canónicas de dominio
│   ├── plans/            # planes de trabajo activos
│   ├── reference/        # análisis y referencias técnicas
│   └── archive/          # informes históricos completados
├── AGENTS.md             # este archivo (índice)
├── FRONTEND_GUIDE.md     # guía frontend canónica
├── BACKEND_GUIDE.md      # guía backend canónica
├── ROADMAP.md            # hoja de ruta consolidada
├── AUDIT.md              # auditoría y tracking
├── README.md             # onboarding del monorepo
└── package.json          # solo husky + lint-staged en raíz
```

---

## 2. Stack tecnológico

### Backend (`backend-erp/`)

| Capa | Tecnología | Versión / Detalle |
|------|------------|-------------------|
| Framework | NestJS | 11.0.1 |
| Lenguaje | TypeScript | 5.7.3 |
| ORM | Prisma | 6.19.2 (client + generator) |
| Base de datos | PostgreSQL | vía `DATABASE_URL` |
| Auth | Passport + JWT | cookies HttpOnly + XSRF |
| Validación | class-validator / class-transformer | DTOs estrictos |
| Documentación | Swagger/OpenAPI | `/api` en dev/prod |
| PDF/Excel | pdfmake / xlsx | reportes e imports |
| Métricas | prom-client + @nestjs/terminus | health checks |
| Tests | Jest + ts-jest | unitarios en `src/`, E2E en `test/` |

### Frontend (`erp-frontend/`)

| Capa | Tecnología | Versión / Detalle |
|------|------------|-------------------|
| Framework | Angular | 19.2.19 |
| Lenguaje | TypeScript | ~5.7.2 |
| Componentes | Standalone | sin `NgModule`s de dominio |
| UI | Angular Material + Design System LUNA | componentes propios en `shared/luna/` |
| SSR | @angular/ssr | habilitado en producción, deshabilitado en desarrollo |
| Estado HTTP | RxJS | ~7.8.0 |
| Formularios | Reactive Forms | `FormBuilder`, `FormGroup`, `FormArray` |
| Tests unitarios | Karma + Jasmine | ChromeHeadless |
| Tests E2E | Playwright | multi-navegador + setup de autenticación |

---

## 3. Comandos de build, test y lint

> **Importante:** todos los comandos deben ejecutarse desde el subproyecto correspondiente.

### Backend

```bash
cd backend-erp
npm install              # también ejecuta prisma generate por postinstall
npm run build            # nest build — 0 errores
npm run start:dev        # watch mode
npm run start:prod       # node dist/main.js
npm run format           # prettier --write
npm run lint             # eslint — 0 errores, 0 warnings
npm test                 # jest — 129 suites / 1249 tests
npm run test:watch       # jest --watch
npm run test:cov         # jest --coverage
npm run test:e2e         # jest --config ./test/jest-e2e.json — 11 suites / 57 tests
npx prisma generate
npx prisma migrate dev --name <migration-name>
npx prisma db seed
```

### Frontend

```bash
cd erp-frontend
npm install
npm start                # ng serve
npm run build            # ng build — 0 errores
npm run watch            # ng build --watch --configuration development
npm run serve:ssr:erp-frontend   # SSR local
npm run format           # prettier --write
npm run lint             # ng lint — 0 errores, ~44 warnings preexistentes
npm test                 # Karma + Jasmine — 1172 tests
npm run e2e              # playwright test — 184 passed
npm run e2e:ui           # playwright test --ui
npm run e2e:report       # playwright show-report
npm run generate-types   # copia prisma-types.ts desde backend
```

### Git hooks

- **Raíz:** `.husky/pre-commit` → `npx lint-staged`. Staged files: backend `.ts` → ESLint fix; frontend `.{ts,html,scss}` → `ng build --aot`.
- **Backend:** pre-commit lint, pre-push `npm test`.
- **Frontend:** pre-commit lint, pre-push tests Karma + build producción.

---

## 4. Estado real del proyecto (2026-08-08)

### Backend (`backend-erp/`)

| Comando | Estado | Evidencia |
|---------|--------|-----------|
| `npm run build` | ✅ **OK** | 0 errores |
| `npm run lint` | ✅ **OK** | 0 errores, 0 warnings |
| `npm test` | ✅ **OK** | **130 suites / 1258 tests passed** (incluye `permissions-coverage.spec.ts`, helper `warehouse-branch.util.spec.ts` con 8 tests) |
| `npm run test:e2e` | ✅ **OK** | 11 suites / 57 tests passed |
| `npm run perf:k6` | ✅ **OK** | 5/5 escenarios passed (perfil `small`)|

### Frontend (`erp-frontend/`)

| Comando | Estado | Evidencia |
|---------|--------|-----------|
| `npm run build` | ✅ **OK** | 0 errores (bundle inicial 1.27 MB, +70 kB sobre budget warning — preexistente) |
| `npm run lint` | ✅ **OK** | 0 errores, 0 warnings |
| `npx ng test --watch=false --browsers=ChromeHeadless` | ✅ **OK** | Suites de formularios comerciales y catálogos en verde (55/55 tras migración Fase 5 + limpieza base); total histórico ~1054 tests |
| `npm run e2e` | ✅ **OK** | 184/184 passed (Chromium) |

> **Notas de deuda técnica activa (2026-08-08):**
> - **Integridad branch↔warehouse completada (2026-08-08):** `assertWarehousesInBranch` en 22 servicios + POS (create/update), herencia de branchId en flujos de copia del frontend (`applyBranchFromSource`), matriz artículo-almacén optimizada a 3 `findMany` en paralelo, stock-transfers con destino libre de sucursal. Ver `AUDIT.md` §7 y `ROADMAP.md` DT.11-14.
> - **Tokens de altura creados** (`--size-control-sm/md/lg` en `_07-sizing.scss`); los componentes LUNA ya los consumen. Quedan ~93 alturas crudas en `pages/`/`shared/`, la mayoría decorativas (deuda de design system posterior).
> - **Patrón `openDialog` eliminado completamente.** Todos los formularios y catálogos usan `ConfirmDialogService.ask()`. `document-form.base.ts` limpiada.
> - **Plan visual v2**: Fases 0, 1, 3, 4, 5, 6 resueltas. Fase 2 (tokens) parcialmente resuelta. Fase 7 (`::ng-deep`) es backlog continuo.
> - **Deuda estructural priorizada:** ver `AUDIT.md` §7 (S1 refactor del accounting engine es la única recomendada antes de F6; S2-S6 mantenimiento normal).

---

## 5. Sistema ShortName — Cuentas Asociadas y Trazabilidad en Asientos Contables

> **Contexto:** Jun 2026 — implementación del patrón SAP B1 `JDT1.ShortName` en el ERP. Permite que una cuenta de mayor (ej. CxC, CxP) se desagregue por código de partner en el libro mayor, manteniendo trazabilidad desde el documento origen.

### 5.1 Conceptos clave

| Concepto SAP B1 | Equivalente en nuestro ERP | Campo DB |
|-----------------|---------------------------|----------|
| `JDT1.Account` | Cuenta contable real del grupo | `JournalEntryLine.accountId` |
| `JDT1.ShortName` | Código del partner (CxC/CxP) | `JournalEntryLine.partnerCode` |
| `JDT1.ContraAct` | Cuenta contraaria | `JournalEntryLine.contraAccountId` |
| `JDT1.TransId` | ID único del asiento | `JournalEntry.id` |
| `JDT1.SourceID` / `SourceLine` | Trazabilidad al documento origen | `JournalEntry.sourceDocumentType` + `sourceDocumentId` |

### 5.2 Cuentas que requieren partner obligatorio (`requiresPartner = true`)

Las siguientes cuentas del plan de cuentas boliviano tienen `requiresPartner: true` en el seed:

| Código | Nombre | Tipo | Naturaleza |
|--------|--------|------|------------|
| `1.1.2.01.001` | CxC Clientes M/N | Activo | Deudor |
| `1.1.2.01.002` | CxC Clientes M/E | Activo | Deudor |
| `1.1.2.03.001` | Documentos por Cobrar M/N | Activo | Deudor |
| `1.1.2.03.002` | Documentos por Cobrar M/E | Activo | Deudor |
| `1.1.2.05.001` | Anticipos Proveedores Nacionales | Activo | Deudor |
| `1.1.2.05.002` | Anticipos Proveedores Extranjeros | Activo | Deudor |
| `2.1.1.01.001` | CxP Proveedores M/N | Pasivo | Acreedor |
| `2.1.1.01.002` | CxP Proveedores M/E | Pasivo | Acreedor |
| `2.1.1.02.001` | Documentos por Pagar M/N | Pasivo | Acreedor |
| `2.1.1.02.002` | Documentos por Pagar M/E | Pasivo | Acreedor |
| `2.1.5.01.001` | Anticipo Clientes M/N | Pasivo | Acreedor |
| `2.1.5.01.002` | Anticipo Clientes M/E | Pasivo | Acreedor |

**Regla:** Si una línea de asiento usa una cuenta con `requiresPartner = true`, el backend exige `partnerId` en la línea (`JournalEntriesService.validatePartnerRequirements`).

### 5.3 Configuración de cuentas asociadas en el maestro de partners

Cada partner debe tener configuradas sus cuentas contables en la pestaña **"Contabilidad"** del formulario de socio de negocio:

| Campo | Tipo de partner | Cuenta recomendada (seed) |
|-------|----------------|---------------------------|
| `receivableAccountId` | Cliente / Ambos | `1.1.2.01.001` (CxC Clientes M/N) |
| `advanceReceivableAccountId` | Cliente / Ambos | `2.1.5.01.001` (Anticipo Clientes M/N) |
| `payableAccountId` | Proveedor / Ambos | `2.1.1.01.001` (CxP Proveedores M/N) |
| `advancePayableAccountId` | Proveedor / Ambos | `1.1.2.05.001` (Anticipos Proveedores Nacionales) |

**Seed automático:** `prisma/seed.ts` asigna estas cuentas por defecto a todos los partners creados en el seed (`updateMany` por tipo).

### 5.4 Flujo de asiento automático con ShortName

```
Factura de Venta (SaleInvoice) a Cliente CLI-00001
        ↓
AccountingEngine._buildSaleInvoiceJournalEntryLines()
  ↓ accountId = 1.1.2.01.001 (CxC)  ← determinada por AccountDeterminationService
  ↓ partnerId = 123
  ↓ partnerCode = 'CLI-00001'       ← denormalizado desde Partner.code
        ↓
JournalEntryLine (POSTED)
  accountId: 1.1.2.01.001
  partnerId: 123
  partnerCode: 'CLI-00001'          ← ShortName
  debit: 100.00
  sourceDocumentType: 'SALE_INVOICE'
  sourceDocumentId: 157644
        ↓
Ledger (Libro Mayor de la cuenta 1.1.2.01.001)
  Muestra: CLI-00001 | Débito 100.00 | Saldo acum.
```

### 5.5 Asientos manuales con partner

En el formulario de **Asientos Contables** (`journal-entries-form`):
- Si se selecciona una cuenta con `requiresPartner`, aparece el selector `<app-partner-selector>` automáticamente.
- El backend valida que la línea tenga `partnerId` antes de persistir.
- Al guardar, el backend resuelve `partnerCode` desde `Partner.code` y lo denormaliza en la línea.

### 5.6 Archivos clave

| Propósito | Archivo |
|-----------|---------|
| Schema `partnerCode` | `backend-erp/prisma/schema.prisma` (`JournalEntryLine.partnerCode`) |
| DTO línea con `partnerId` | `backend-erp/src/journal-entries/dto/create-journal-entry.dto.ts` |
| Validación `requiresPartner` | `backend-erp/src/journal-entries/journal-entries.service.ts` (`validatePartnerRequirements`) |
| Denormalización en asientos automáticos | `backend-erp/src/common/accounting-engine.service.ts` (`_persist`) |
| Ledger con partner | `backend-erp/src/accounts/accounts.service.ts` (`findLedger`) |
| Frontend: línea de asiento con partner | `erp-frontend/src/app/pages/journal-entries/journal-entries-form.component.ts` |
| Frontend: ledger con partner | `erp-frontend/src/app/pages/accounts/account-ledger.component.ts` |
| Seed: cuentas con `requiresPartner` | `backend-erp/src/common/chart-of-accounts.data.ts` |
| Seed: asignación a partners | `backend-erp/prisma/seed.ts` (bloque 14a) |

### 5.7 Fixes y mejoras contables aplicados (Jul 2026)

#### Bugs críticos arreglados

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 1 | `reverseJournalEntry` no copiaba `debitLocal/creditLocal/debitSystem/creditSystem` | `accounting-engine.service.ts` | Ahora copia todos los campos de doble expresión en la reversa, además de `currency`, `projectCode`, `dimension1-5`, `sourceTransactionLineId`, `taxRate`, `taxAmount` |
| 2 | `post()` no revalidaba balance del asiento | `journal-entries.service.ts` | Agregada validación `totalDebit === totalCredit` (tolerancia 0.001) antes de cambiar status a POSTED |

#### Gaps arquitectónicos resueltos

| # | Gap | Archivo | Estado |
|---|-----|---------|--------|
| 3 | `JournalEntryLine` sin `projectId` relación | `prisma/schema.prisma` | Agregado `projectId Int?` + FK + relación inversa en `Project` |
| 4 | Campos `ref1`, `ref2`, `dueDate` faltantes en `JournalEntryLine` | `prisma/schema.prisma` | Agregados; persistidos en `_persist()` y `reverseJournalEntry()` |
| 5 | Navegación inversa desde asiento a documento origen | `journal-entries-form.component.ts/html` | Botón "Ver documento origen" en header cuando `sourceDocumentType` + `sourceDocumentId` existen. Mapeo de 15 tipos de documento a rutas Angular |

#### Pendientes (requieren diseño dedicado)

| # | Item | Razón |
|---|------|-------|
| ~~6~~ | ~~Refactor `AssemblyOrder` para usar `AccountingEngine`~~ | ✅ **Resuelto (2026-08-24)** — `assembly-orders.service.ts` delega el asiento a `AccountingEngineService.createAssemblyJournalEntry` (builder `buildAssemblyJournalEntryLines`); batería de ensamblaje en verde. Ver `AUDIT.md` §8 T8 |
| 7 | Convertir `sourceDocumentType` a enum | Requiere migración de datos de `String` a `enum` en PostgreSQL con conversión de valores existentes. **Diferido post-go-live (2026-08-24):** ~17 tipos + patrón dinámico `REVERSAL_${tipo}` + drift de BD — riesgo de datos sin ganancia funcional. Revisar al escalar. |
| 8 | Cierre de período contable (`AccountingPeriod`) | Feature completo: tabla, protección, reportes de cierre, apertura de nuevo período. |
| 9 | Asientos de ajuste por diferencia de cambio | Requiere módulo de revaluación de saldos en moneda extranjera y generación automática de asientos de ajuste. |
| 10 | Reconciliación bancaria | Módulo completo: import de extractos, matching de pagos, conciliación. |
| 11 | Fixed Assets / depreciación | Módulo completo: master de activos, métodos de depreciación, asientos automáticos mensuales. |

---

## 6. Variables de entorno críticas

Archivo de referencia: `backend-erp/.env` (no existe `.env.example`).

```bash
# Base de datos
DATABASE_URL=postgresql://...
SHADOW_DATABASE_URL=postgresql://...

# Seguridad
JWT_SECRET=...

# CORS
FRONTEND_URL=...            # requerido en producción

# Puertos / entorno
PORT=3000
NODE_ENV=development|production|test

# Rate limiting
THROTTLE_TTL_MS=...
THROTTLE_LIMIT_DEDICATED=...
THROTTLE_LIMIT_SHARED=...
THROTTLE_LIMIT_PUBLIC=...

# Superadmin
SUPERADMIN_USERNAME=...
SUPERADMIN_PASSWORD_HASH=...

# Import masivo
BULK_IMPORT_SAFE_MODE=true   # instancia dedicada (default)
# BULK_IMPORT_SAFE_MODE=false  # instancia compartida

# Health checks
HEALTH_MEMORY_THRESHOLD_PERCENT=...
HEALTH_DISK_THRESHOLD_PERCENT=...
```

Frontend: la URL de la API se configura en `src/environments/environment.ts` (desarrollo apunta a `window.location.hostname:3000`) y `environment.prod.ts`.

---

## 7. Consideraciones de seguridad

- **JWT en cookie HttpOnly** + header XSRF. El token también puede venir por header Bearer o query param `token`.
- **CORS dinámico:** en producción solo se permiten orígenes configurados en `FRONTEND_URL`.
- **CSRF middleware** (`CsrfMiddleware`) y `SanitizeInterceptor` globales.
- **RBAC:** `@RequirePermission(...)` en endpoints; `PermissionsGuard` global.
- **Multitenancy:** `TenantGuard` + aislamiento automático en Prisma. Nunca ejecutar queries sin `tenantId`.
- **Superadmin:** credenciales separadas (`SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD_HASH`).
- **Login por username:** desde la migración `20260624212300_username_login`, el login usa `username` (no email).
- **Import masivo seguro:** `BULK_IMPORT_SAFE_MODE=true` nunca desactiva triggers; `false` desactiva triggers temporalmente y usa lock global.
- **Validación de entrada:** `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted`, `transform`.

---

## 8. Próximos pasos recomendados

### Features de negocio (alta prioridad)

1. **Módulo contable completo (F6)** — estados financieros, cierre de período, activos fijos, nómina.
2. **Facturación electrónica SIN Bolivia (F5.1)** — firma digital, envío masivo, consulta de estado. *(siguiente feature prioritario)*
3. **Integración bancaria (F5.2)** — conciliación automática de extractos, import CSV/Excel, matching de pagos.
4. **Multi-divisa (F7.2)** y localización de reportes fiscales para otros países (F7.3).
5. **CRM básico (F5.4)** — oportunidades, actividades, pipeline.

### QA / E2E

6. **Generar baseline visual consolidado** con Playwright (`e2e/forms-reference-screenshots.spec.ts`).
7. **Completar flujos críticos en E2E** — ventas, compras, stock, pagos parciales, devoluciones y conciliación.

---

## 9. Documentación adicional (referencia, no obligatoria)

Archivos complementarios que no requieren lectura obligatoria para tareas rutinarias, pero pueden ser útiles para contexto adicional:

| Archivo | Contenido | Cuándo leer |
|---------|-----------|-------------|
| `erp-frontend/docs/monorepo/DESIGN.md` | Design System LUNA completo: tokens, componentes, layouts, dark mode, animaciones. | Cuando se diseñe un componente nuevo o se modifique el design system. |
| `erp-frontend/docs/components/form-sizes.md` | Estándar de alturas unificado (`sm`/`md`/`lg`) para componentes de formulario LUNA. | Al agregar o estandarizar inputs, selectores o botones. |
| `erp-frontend/docs/components/luna-entity-select.md` | Guía del selector genérico: modos memory/server-side, API y plantillas. | Al crear o modificar selectores de entidades. |
| `docs/guides/ESTANDAR_LINEAS_DOCUMENTO.md` | Estándar de líneas de documento (`luna-document-lines` Fase 2): celdas canónicas/custom, checklist, estado por formulario. | Antes de migrar o crear formularios de documentos (compras, inventario). Referenciado desde FRONTEND_GUIDE.md §10. |
| `docs/guides/ACCOUNTING_ENTRIES_GUIDE.md` | Guía de asientos contables por tipo de documento. | Al trabajar contabilidad, asientos automáticos o determinación de cuentas. |
| `backend-erp/docs/fixed-assets.md` | Documentación del módulo de Activos Fijos y depreciación. | Al trabajar en `backend-erp/src/fixed-assets/`. |
| `docs/plans/plan-consistencia-visual-v2.md` | Plan validado de remediación visual frontend (7 fases). | Al planificar mejoras visuales o migraciones de tokens/spacing. |
| `docs/plans/plan-mejoras-ux-ui-frontend.md` | Plan activo de mejoras UX/UI: accesibilidad, copy, colores, `!important`, tests. | Antes de trabajar mejoras de UX/UI fuera de POS. |
| `docs/plans/runbook-go-live.md` | Runbook de go-live: despliegue backend + frontend SSR, migraciones (incluye SQL manuales por drift), alineación de tenants, QA previo al corte, rollback y checklist go/no-go. | Al desplegar a producción o preparar el corte. |
| `docs/reference/ACCOUNTS_DETERMINATION_FIX.md` | Análisis y corrección de paridad de cuentas contables por nivel. | Como referencia del fix de paridad de cuentas. |
| `docs/reference/SAP_B1_VS_ERP_COMPARATIVE_ANALYSIS.md` | Análisis comparativo de determinación de cuentas: SAP B1 vs ERP. | Como referencia de arquitectura contable. |
| `docs/reference/SAP_B1_INTEGRATION.md` | Capa de integración bidireccional SAP B1: 11 modelos con identidad SAP, mapeos por documento (BaseType 13/15/17/20/23, ReserveInvoice, PaymentInvoices it_CreditMemo), idempotencia 409, migraciones, abono de NC. | Antes de implementar el conector SAP (F5.3) o extender la integración al flujo de compras. |
| `docs/archive/` | Informes históricos de frentes completados y cierres de fase. | Solo si se necesita trazabilidad histórica de una migración ya cerrada. |
| `backend-erp/CHANGELOG.md` / `erp-frontend/CHANGELOG.md` | Historial de cambios por versión. | Para entender evolución reciente del proyecto. |
| `backend-erp/load-tests/k6/README.md` | Documentación de la suite de carga k6. | Antes de ejecutar o modificar tests de carga. |
| `backend-erp/perf/README.md` | Documentación del módulo de performance. | Antes de trabajar en optimización de performance. |

> **Nota:** Los archivos listados arriba son **referencia**. Las reglas obligatorias de diseño, tipado, arquitectura y testing viven en los 5 archivos canónicos de la sección "Protocolo de inicio de trabajo".

---

*Este archivo es el índice maestro y carga automáticamente como standing instructions en cada sesión de Kimi Work. Para detalles de implementación, patrones de código y decisiones de arquitectura, consultar los 5 archivos canónicos enlazados en la sección "Protocolo de inicio de trabajo".*
