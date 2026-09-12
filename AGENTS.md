# AGENTS.md — erp_suite

> **Última actualización:** 2026-09-11.  
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
npm test                 # jest — 162 suites / 1747 tests
npm run test:watch       # jest --watch
npm run test:cov         # jest --coverage
npm run test:e2e         # jest E2E — 14 suites / 93 tests (sincroniza antes la BD de tests)
npm run test:e2e:prepare # solo sincroniza el esquema de erp_test (prisma db push)
npx prisma generate
npx prisma migrate dev --name <migration-name>
npx prisma db seed
npm run db:recreate      # BD dev reproducible: migrate reset + db push + marcar SQL manuales + seed
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
npm run lint             # ng lint — 0 errores, 0 warnings
npm test                 # Karma + Jasmine — 1534 tests
npm run e2e              # playwright test — suite completa (incluye capturas y diagnósticos)
npm run e2e:functional   # gate funcional (187 tests de regresión) en una sola pasada — config propia
npm run e2e:captures     # capturas de formularios mobile/desktop (herramienta, no gate)
npm run e2e:visual       # regresión visual de los 52 formularios (baselines propios)
npm run e2e:baseline     # regenera los 52 baselines de referencia
npm run e2e:ssr          # smoke del build SSR (config smoke, server :4000 + spec; job de CI)
npm run migrate:heights  # migra alturas px de pages/shared a variables de densidad (--apply/--check)
npm run migrate:heights:check  # gate: falla si quedan alturas px crudas
npm run e2e:ui           # playwright test --ui
npm run e2e:report       # playwright show-report
npm run typecheck:e2e    # tsc del suite E2E (tsconfig.e2e.json) — 0 errores
npm run format:scss      # prettier --write de todo el SCSS de src/
npm run format:e2e       # prettier --write e2e (55 archivos)
npm run format:check     # gate: prettier --check e2e + src/**/*.scss (CI)
npm run format:check:touched  # ratchet: exige formato solo en archivos tocados vs origin/main
npm run generate-types   # copia prisma-types.ts desde backend
npm run audit:density:ci # gate de densidad: estático (px crudos + tablas) + calidad de bloques
npm run audit:density:e2e# auditoría dinámica Compacta vs Espaciosa (bajo demanda)
npm run audit:important  # gate de `!important`: falla ante usos sin justificar (!important-ok)
npm run audit:ng-deep    # gate de `::ng-deep`: falla ante usos sin justificar (::ng-deep-ok)
```

> **Regla de estilo (T58):** todo override de un primitivo LUNA se resuelve por
> **especificidad** (repetir la clase propia: `.form-field.form-field …`), no con
> `!important`. La política completa, los 3 casos en que `!important` sí es
> legítimo y el método de verificación están en
> `erp-frontend/src/styles/CSS-ARCHITECTURE.md`.
>
> **`::ng-deep` (T65):** solo se acepta para contenido que no se puede alcanzar
> de otra forma (contenido de `[innerHTML]`, contenido proyectado, mixin
> compartido) y cada uso lleva `// ::ng-deep-ok: <razón>`; antes de escribir uno,
> usar las **recetas de customización** de `CSS-ARCHITECTURE.md` §5 (variantes de
> input, CSS vars como `--luna-btn-height`/`--col-min-width`).

### Git hooks

- **Raíz:** `.husky/pre-commit` → `npx lint-staged`. Staged files: backend `.ts` → ESLint fix; frontend `.{ts,html,scss}` → `ng build --aot`.
- **Backend:** pre-commit lint, pre-push `npm test`.
- **Frontend:** pre-commit lint, pre-push tests Karma + build producción.

> **Regla de proceso (2026-09-12):** nunca hacer *round-trip* de archivos de código
> por PowerShell (`Get-Content -Raw` + `Set-Content -Encoding utf8`): en PS 5.1 el
> archivo se lee como Windows-1252 y se reescribe como UTF-8, lo que **mojibakea los
> acentos** de todo el archivo (`importación` → `importaciÃ³n`). Usar las
> herramientas de edición del agente (o Node) para escribir código; si hay que
> tocarlo por script, escribir con `fs.writeFileSync(..., 'utf8')` y verificar con
> `git diff --numstat` que solo aparezcan las inserciones esperadas.

---

## 4. Estado real del proyecto (2026-09-11)

### Backend (`backend-erp/`)

| Comando | Estado | Evidencia |
|---------|--------|-----------|
| `npm run build` | ✅ **OK** | 0 errores |
| `npm run lint` | ✅ **OK** | 0 errores, 0 warnings |
| `npm test` | ✅ **OK** | **162 suites / 1747 tests passed** (incluye `plan-limits.service.spec.ts`, `permissions-coverage.spec.ts`, `warehouse-branch.util.spec.ts`) |
| `npx tsc --noEmit` (proyecto y specs) | ✅ **OK** | 0 errores |
| `npm run test:e2e` | ✅ **OK** | **14 suites / 93 tests passed** (2026-09-10; el script sincroniza antes el esquema de `erp_test` con `prisma db push` — ver nota de entorno) |
| `npm run perf:k6` | ✅ **OK** | 5/5 escenarios passed (perfil `small`) |
| `npm run perf:k6:check` | ✅ **OK** | diagnóstico de entorno + aviso de que el suite resetea el tenant `default` + receta con BD desechable (T60) |
| `npm run db:recreate` | ✅ **OK** | BD dev reproducible: `migrate reset` + `db push` + SQL manuales + seed; `prisma migrate diff` sin diferencias |

### Frontend (`erp-frontend/`)

| Comando | Estado | Evidencia |
|---------|--------|-----------|
| `npm run build` | ✅ **OK** | 0 errores (bundle inicial ~1.27 MB) |
| `npm run lint` | ✅ **OK** | 0 errores, 0 warnings |
| `npx ng test --watch=false --browsers=ChromeHeadlessCI` | ✅ **OK** | **1534 / 1534 tests** (1527 + 7 tests de T65 que fijan los puntos de customización por estilo computado) |
| `npm run e2e:functional` | ✅ **OK** | **187 tests en una sola pasada: 177 passed / 0 failed / 10 skipped** (~25 min; chromium, con el proyecto fijado desde T60) — mismo escenario que CI (BD recién sembrada). Los 10 skips son condicionales con motivo (inventario en AUDIT T61) |
| `npm run e2e:visual` | ✅ **OK** | **52/52** baselines de formularios (deterministas desde T59: fecha fija `VISUAL_REFERENCE_TIME` + correlativos normalizados en `e2e/forms-screenshot.helper.ts`) |
| `npm run typecheck:e2e` | ✅ **OK** | 0 errores (`tsconfig.e2e.json`, 55 archivos de `e2e/`) tras T60 |
| `npm run format:check` | ✅ **OK** | prettier limpio en **todo `e2e/` y todo el SCSS de `src/`** (T62 cerró los 67 SCSS que faltaban); el TS/HTML legacy se gestiona con `format:check:touched` |
| `npm run migrate:heights:check` | ✅ **OK** | **0 alturas en px crudas** en `pages/`+`shared/` (65 migradas a variables de densidad en T62; el audit estático ya las vigila) |
| `npm run e2e:ssr` | ✅ **OK** | **3 passed** con la configuración `smoke` (backend local) y **job `ssr-smoke` en CI** — antes el spec se **skipeaba siempre** por falta de un server SSR levantado (T61/T63) |
| `npm run audit:density:ci` | ✅ **OK** | 0 hallazgos estáticos + 0 de calidad de bloques |
| `npm run audit:important` | ✅ **OK** | **7 usos de `!important` en 3 archivos**, todos compitiendo con algo fuera del control propio (librería, autofill, `prefers-reduced-motion`) o gates funcionales — desde T58 (antes 105) y T64 (los 2 de `luna-data-table` pasaron a custom property) |
| `npm run audit:ng-deep` | ✅ **OK** | **4 usos de `::ng-deep` en 3 archivos, los 4 justificados** con `::ng-deep-ok` (contenido de `[innerHTML]` ×3 y el mixin de líneas de inventario) — desde T65 (antes 9 sin métrica reproducible) |
| `npx playwright test density-raw-tables.spec.ts` | ✅ **OK** | tablas crudas medidas con datos reales (1px → 4px) |

> **Notas de deuda técnica activa (2026-09-10):**
> - **Integridad branch↔warehouse completada (2026-08-08):** `assertWarehousesInBranch` en 22 servicios + POS (create/update), herencia de branchId en flujos de copia del frontend (`applyBranchFromSource`), matriz artículo-almacén optimizada a 3 `findMany` en paralelo, stock-transfers con destino libre de sucursal. Ver `AUDIT.md` §7 y `ROADMAP.md` DT.11-14.
> - **Densidad visual (T48) y `::ng-deep` (T49) cerrados:** auditoría estática y de calidad de bloques en 0. Los **`!important` bajaron de 105 a 7 en 3 archivos** (T58 + T64, 2026-09-11): los que quedan compiten con algo que el CSS del proyecto no controla (autofill del motor, `prefers-reduced-motion`) o son gates funcionales — política completa en `erp-frontend/src/styles/CSS-ARCHITECTURE.md`. Las **65 alturas px crudas** de `pages/`+`shared/` quedaron como variables de densidad (T62) y el audit estático ya las vigila; los **`::ng-deep`** activos son **4** (T65), todos con marca `::ng-deep-ok` (contenido de `[innerHTML]` y el mixin de líneas de inventario) y vigilados por el gate `npm run audit:ng-deep`; las recetas para no volver a necesitarlos están en `CSS-ARCHITECTURE.md` §5.
> - **Patrón `openDialog` eliminado completamente.** Todos los formularios y catálogos usan `ConfirmDialogService.ask()`. `document-form.base.ts` limpiada.
> - **Plan visual v2**: Fases 0, 1, 3, 4, 5, 6 resueltas; Fase 2 cerrada en su parte de densidad (T48) y Fase 7 auditada (T49, 9 reglas justificadas). Sigue como tracking continuo (`docs/plans/plan-consistencia-visual-v2.md`).
> - **Entorno E2E determinista (T53, 2026-09-10):** tipografías self-hosted (sin CDNs externos) y `e2e/auth.setup.ts` garantiza gestión fiscal abierta + series antes de cada corrida (el seed NO las crea). BD dev reproducible con `npm run db:recreate` y BD de tests E2E con `npm run test:e2e:prepare` (sincroniza `erp_test` con `prisma db push`; sin ese paso **13 de 14 suites fallaban** por esquema desactualizado). El mismo `setup` garantiza la terminal POS de E2E (`ensurePosTerminal`) porque el formulario de usuarios cambia de alto según existan terminales (T56: era la causa de un baseline visual que dependía del orden de los specs).
> - **Karma estable (T62):** la config ya endurecida (`browserNoActivityTimeout: 300000`, `browserDisconnectTolerance: 5`, `timeoutInterval: 20000`, `--no-sandbox --disable-dev-shm-usage`) da **1534/1534 en ~3,5-4 min** de forma repetida (corridas verdes el 2026-09-11, incluidas las del hook de pre-push); el "hang" histórico **no se reproduce** y cualquier fallo nuevo debe tratarse como regresión, no como flakiness de infraestructura. **Nota (T65):** en specs de componentes `OnPush`, cambiar un `@Input` mutando la instancia **no** re-renderiza la vista (el `[class]`/`@if` no se reevalúa): usar `fixture.componentRef.setInput(...)` + `fixture.detectChanges()` (o `markForCheck()`), como hacen los 7 tests nuevos.
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
| ~~7~~ | ~~Convertir `sourceDocumentType` a enum~~ | ✅ **Resuelto (2026-09-05, T9)** — nuevo enum `JournalSourceType` (tipos de documento + especiales + `REVERSAL`); las reversas usan el miembro genérico `REVERSAL` (antes prefijo dinámico `REVERSAL_<tipo>`); migración `20260905020000_journal_source_type_enum`. Ver `AUDIT.md` §8 T9 |
| ~~8~~ | ~~Cierre de período contable (`AccountingPeriod`)~~ | ✅ **Resuelto (2026-09-05)** — `FiscalYear`/`AccountingPeriod` con estados OPEN/LOCKED, protección en el motor (`JournalEntryCore._persist` bloquea asientos en períodos cerrados, DT.36), reportes de cierre, asientos de cierre/apertura de ejercicio (`generate-closing-entry`/`generate-opening-entry`). Ver `ROADMAP.md` Fase 6.4 y `AUDIT.md` |
| ~~9~~ | ~~Asientos de ajuste por diferencia de cambio~~ | ✅ **Resuelto** — módulo `exchange-rate-adjustments`: revaluación de saldos en moneda extranjera con preview sin persistir y generación automática del asiento de ajuste (cuentas gain/loss configurables, neteo en moneda base). Ver `AUDIT.md` |
| ~~10~~ | ~~Reconciliación bancaria~~ | ✅ **Resuelto** — módulo `bank-reconciliation`: import de extractos (CSV/Excel), matching de pagos, asignación cuenta/partner/proyecto, posteo a asientos y conciliación. Ver `ROADMAP.md` Fase 5.5 y `AUDIT.md` |
| ~~11~~ | ~~Fixed Assets / depreciación~~ | ✅ **Resuelto (2026-09-05, T6)** — módulo `fixed-assets`: master de activos, depreciación lineal + acelerada (saldo decreciente con conmutación a línea recta, `depreciation-math.ts`), depreciación mensual automática parametrizable (`fixedAssetsAutoDepreciation`, cron) y opción manual. Ver `ROADMAP.md` Fase 6.5 y `AUDIT.md` |

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

1. **Gaps de producto priorizados (2026-09-08)** — ver `docs/plans/plan-gaps-deuda-2026-09.md`:
   costeo de importación / "Precios de Entrega" (landed cost), revalorización de artículos,
   producción (potenciar ensamblaje), servicios (OT/contratos). Módulos contables que AGENTS
   listaba como pendientes (cierre de período, revaluación por TC, conciliación bancaria,
   activos fijos) **ya están implementados** — ver §5.7 filas 8–11.
2. **Facturación electrónica SIN Bolivia (F5.1)** — firma digital, envío masivo, consulta de estado. *(siguiente feature prioritario)*
3. **Conector SAP Service Layer (F5.3)** — la capa de datos bidireccional está lista (Fase 3.x);
   falta el conector real + sincronización de estados (cerrar/cancelar).
4. **Multi-divisa (F7.2)** y localización de reportes fiscales para otros países (F7.3).
5. **CRM básico (F5.4)** — oportunidades, actividades, pipeline.

### QA / E2E

6. ✅ **Baseline visual consolidado** con Playwright (`e2e/forms-reference-screenshots.spec.ts`) — cerrado 2026-09-09 (T51): 52 baselines regenerados + `npm run e2e:visual` 52/52; de paso se corrigió el seed que rompía el `webServer` (P2003 en `StockTransfer`). Ver AUDIT T51.
7. ✅ **Flujos críticos en E2E** — ventas, compras, stock, pagos parciales, devoluciones y conciliación — cerrado 2026-09-09 (T52): QA crítica 31/31 + resto de la ola QA en verde, más el caso E2E de serie por sucursal (T50). Ver AUDIT T52.
8. ✅ **Densidad visual (T48) cerrada del todo** — estático en 0, **calidad de bloques en 0** (`npm run audit:density:vars` dentro de `audit:density:ci`), 28 tablas crudas clasificadas con regla propia donde faltaba (1px → 4px en Espaciosa) y cobertura dinámica con datos (`e2e/density-raw-tables.spec.ts` + manifiesto 163 URLs). Convención, método del codemod y matriz de tablas en `FRONTEND_GUIDE.md` §12 y `docs/reference/densidad-interfaz-auditoria.md`. Ver AUDIT T48.
9. ✅ **Suite funcional de Playwright en una sola pasada (T54, 2026-09-11)** — de 17 fallos a **177 passed / 0 failed** en una corrida completa: se eliminaron las dependencias de orden/datos entre specs (helpers de matriz artículo-almacén con merge preservador, resolución de maestros por código, mayor/anticipos paginados, snapshot/restore de settings, specs autocontenidos) y se definió el **gate funcional explícito** (`playwright.functional.config.ts` + `npm run e2e:captures`). Detalle en AUDIT T54 y `erp-frontend/CHANGELOG.md`.
10. ✅ **Prioridad 5 UX cerrada — `!important` de 105 a 9 (T58, 2026-09-11)** — overrides por especificidad (repetir la clase propia) + eliminación de CSS muerto (bloque de Angular Material/CDK, overrides móviles del POS, utilidades responsive y selectores obsoletos de LUNA) + métrica del gate corregida (`stripComments`). Política en `erp-frontend/src/styles/CSS-ARCHITECTURE.md`. Evidencia: Karma 1527/1527, `e2e:visual` 52/52 pixel-idéntico, sonda de 9 capturas antes/después con 0 píxeles distintos. Ver AUDIT T58.
11. ✅ **Gate visual determinista (T59, 2026-09-11)** — el gate fallaba en 18 formularios por datos volátiles (fecha del día y correlativo del chip `Nº <serie>`), no por CSS; se fijó el reloj (`page.clock.setFixedTime`) y se normalizan los correlativos en `e2e/forms-screenshot.helper.ts` → 52/52 repetible. Ver AUDIT T59.
12. ✅ **Higiene del suite E2E y de los tests de carga (T60, 2026-09-11)** — `tsconfig.e2e.json` + `npm run typecheck:e2e` (de 130 errores a 0) y prettier con ratchet (`format:check` en CI + `format:check:touched`), más `npm run perf:k6:check` con el aviso de que el suite de carga resetea el tenant `default`. Ver AUDIT T60.
13. ✅ **Dos verificaciones que nunca se ejecutaban (T61, 2026-09-11)** — `npm run e2e:ssr` levanta el build SSR de producción y corre el smoke (3 passed: render server-side, headers de hardening y rutas protegidas sin fuga de datos; antes el spec se skipeaba siempre) y `qa-tax-calculations` resuelve los indicadores con paginación completa + creación idempotente de `E2E-IVAINC`/`E2E-IVAEXC` (6 passed / 0 skipped; los 4 tests de cálculo inclusivo/exclusivo se skipeaban siempre por la ventana `?limit=20`). Inventario de los skips que quedan, con motivo: en AUDIT T61.
14. ✅ **Frente C cerrado: `!important` 105 → 7 y `::ng-deep` 9 → 4 (T64 + T65, 2026-09-11)** — los 2 `!important` que quedaban en `luna-data-table` se resolvieron publicando el ancho mínimo por columna como **custom property** (`--col-min-width`) en vez de como estilo inline, y los 5 `::ng-deep` evitables se convirtieron en puntos de customización reales de LUNA: variante **`[presentation]="'field'"`** de `item-combobox` (en lugar de reestilar sus celdas desde `batches`), **`--luna-btn-height`** en `luna-button` (botón "quitar" de `partner-selector`), reglas normales donde el elemento es de la propia plantilla (`stock-valuation`, `luna-empty-state`) y eliminación del pierce muerto de `price-list-form`. Los 4 que quedan (contenido de `[innerHTML]` ×3 y el mixin de líneas de inventario) llevan marca `::ng-deep-ok` y hay **gate propio** (`npm run audit:ng-deep`, en CI). Evidencia: sonda de estilos computados antes/después con 0 diferencias, 7 tests Karma nuevos por estilo computado, Karma 1534/1534, `e2e:visual` 52/52. Ver AUDIT T64/T65.

---

## 9. Documentación adicional (referencia, no obligatoria)

Archivos complementarios que no requieren lectura obligatoria para tareas rutinarias, pero pueden ser útiles para contexto adicional:

| Archivo | Contenido | Cuándo leer |
|---------|-----------|-------------|
| `.agents/skills/angular-solid-frontend/` | **Receta de generación de pantallas Angular + LUNA**: `SKILL.md` (tokens, patrones de listado y formulario, formularios con líneas, tabs, selectores modales), `references/module-template.md` (boilerplate copiable de servicio/listado/formulario + registro de ruta), `references/shared-patterns.md` y `references/testing-recipes.md`. | Al **crear** una página, formulario, listado o servicio nuevo en `erp-frontend` (o al mantener los existentes). |
| `.agents/skills/nestjs-solid-backend/` | Receta equivalente para el backend (módulo NestJS + Prisma, flujo de documentos, testing). | Al crear un módulo/servicio/DTO nuevo en `backend-erp`. |
| `erp-frontend/docs/monorepo/DESIGN.md` | Design System LUNA completo: tokens, componentes, layouts, dark mode, animaciones. | Cuando se diseñe un componente nuevo o se modifique el design system. |
| `erp-frontend/docs/components/form-sizes.md` | Estándar de alturas unificado (`sm`/`md`/`lg`) para componentes de formulario LUNA. | Al agregar o estandarizar inputs, selectores o botones. |
| `erp-frontend/src/styles/CSS-ARCHITECTURE.md` | Arquitectura CSS del frontend: capas, orden de emisión de los parciales, receta de especificidad para ganar sin `!important`, casos legítimos de `!important`, política de `::ng-deep`, gates de densidad y método de verificación visual. | **Antes de escribir o modificar SCSS global** (`src/styles/**`, `styles.scss`) o al pelear una especificidad con un componente LUNA. |
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
