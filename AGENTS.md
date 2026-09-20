# AGENTS.md — erp_suite

> **Última actualización:** 2026-09-21 (**Cuentas contables editables en las líneas**: las cinco fases del plan —Revalorización (P1), inventario (P2), comerciales (P3), producción y ensamblaje (P4) y los dos gates de cierre (P5)— implementadas y verificadas: la cuenta se **ve** en la línea, se **propone** con la misma determinación que usa el motor y se puede **cambiar a mano**; un **validador compartido** la controla antes de la transacción en **43 altas** comerciales y en producción (antes una cuenta agrupadora se contabilizaba: defecto medido y cerrado), y la suite nueva `test/line-account-override.e2e-spec.ts` mide **13/13** que la capturada manda en el asiento; backend **183 suites/2171 tests** y E2E **31/248**, frontend **Karma 1979**, `e2e:visual` **53/53 sin regenerar nada** y `e2e:functional` **238 passed · 3 skips**; además queda decidido el plan de centros de costo (opción C, reparto capturado por línea)) y 2026-09-19 (**G3 — Producción, las siete fases**: además de los maestros, la receta multinivel y la explosión con faltantes, la **orden de producción** con snapshot de receta y ruta, estados reversibles y costo previsto congelado, y la **emisión para producción**, que consume los componentes al **costo promedio** y los carga al **WIP** de la orden (`Dr WIP / Cr Inventario`, kardex `PRODUCTION_ISSUE`, parciales y anulación con reversa) y el **recibo para producción**, que ingresa el PT, los subproductos y la merma absorbiendo ese WIP (`Dr Inventario PT/Subproducto/Mermas · Cr WIP`, kardex `PRODUCTION_RECEIPT`, parciales y anulación con reversa), y el **consumo de recursos** (partes de horas por operación con el snapshot de los componentes de costo del recurso y `Dr WIP / Cr cuenta del componente`, que además acumula el tiempo real de la operación, y el **cierre** de la orden, que liquida el WIP a cero contra la cuenta de variación (conciliando el mayor con los documentos), con su **reapertura**, los reportes de costo/WIP/desviaciones en pantalla con exportación CSV y el detector **R16**; backend **182 suites/2143 tests** y E2E **30/224**, frontend **Karma 1906** y `e2e:visual` **53/53 sin regenerar nada**) y 2026-09-19 (**G3 — Producción, Fase 1**: los maestros del ciclo productivo (centro de trabajo, recurso con componentes de costo y ruta por artículo), la receta con **merma** y **operación** por componente y la **explosión con aviso de faltantes**, con el `AssemblyOrder` intacto; backend **178 suites/2087 tests** y E2E **25/182**, frontend **Karma 1789** y `e2e:visual` **53/53** con un solo baseline regenerado) y 2026-09-18 (T145 cerrado —la NC parcial de importes impares cuadra al céntimo—, T146 cerrado por su causa real —el arnés E2E fechaba con el día UTC—, **T147** cerrado con la opción elegida por el usuario (el par revertido se netea en el cuadre del informe), **T148** cerrado con la unificación coherente del `isReserve` (la pantalla también pide F. Reserva al facturar desde una entrega) y **T149 RESUELTO** —la anulación respeta la protección de período (antes no: medido 201 con el período cerrado), la fecha de contabilización es **elegible** por el usuario y el **par revertido se excluye de saldos e informes con una regla única** (medido: el saldo de CxC quedaba en −226 tras anular una factura de 226)— y **G2/T150 RESUELTO** —la **Revalorización de artículos** (documento de Inventario que asigna el costo resultante de la existencia, por precio unitario o por importe total, con el ajuste a la cuenta de Revalorización si sube o a la de Contrapartida si baja, kardex con cantidad 0 y anulación que restituye el costo)— y **T152 RESUELTO** —los dos defectos de **interfaz** que el E2E de UI de G2 destapó: el alta **no se podía guardar** (el botón `type="submit"` de la barra de acciones vive fuera del `<form>`) y el listado **no pintaba sus acciones** (faltaba la columna `type: 'actions'`; el mismo defecto existía en el Precio de Entrega desde G1), corregidos y ya ejercitados por el botón y el menú de fila reales— y **T151 RESUELTO** —la **guarda de período valida la fecha de contabilización** en todos los documentos (el motor resuelve el período con `source.postingDate ?? source.date` y los 24 llamadores que armaban el objeto del documento a mano ya la pasan; 4 excepciones declaradas)— y **T153 RESUELTO** —el **motivo de la anulación** que el `CancelDocumentDto` validaba y **14 familias descartaban** ahora se **persiste** (controlador → servicio) y se **muestra en el detalle** de los 12 formularios con aviso de anulado (más las dos notas de débito)—; matriz de flujos en `docs/reference/matriz-flujos-documentos.md`).
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
| `docs/plans/` | Planes de trabajo activos | `plan-consistencia-visual-v2.md`, `plan-mejoras-ux-ui-frontend.md`, `plan-g3-produccion.md` (plan del módulo de Producción: **aprobado el 2026-09-19**, con las **siete fases implementadas**) |
| `docs/reference/` | Análisis técnicos y referencias de arquitectura | `ACCOUNTS_DETERMINATION_FIX.md`, `SAP_B1_VS_ERP_COMPARATIVE_ANALYSIS.md`, `SAP_B1_INTEGRATION.md` (capa de integración bidireccional SAP B1: modelos, mapeos, idempotencia, migraciones), `PRODUCCION_ERP_COMPARATIVA.md` (cómo resuelven producción SAP B1 / Odoo 19 / Dynamics 365, verificado contra documentación pública) |
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
- **Compras:** solicitudes, cotizaciones, pedidos, recepciones, facturas, facturas de reserva, notas de crédito/débito, devoluciones, **precios de entrega** (costeo de importación).
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
├── mcp-erp/              # MCP del ERP (paquete propio: servidor stdio de solo lectura)
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
npm run lint             # eslint — 0 errores (1 aviso preexistente declarado: code-generator.ts)
npm test                 # jest — 183 suites / 2171 tests
npm run test:watch       # jest --watch
npm run test:cov         # jest --coverage
npm run test:e2e         # jest E2E — 31 suites / 248 tests (sincroniza antes la BD de tests)
npm run test:e2e:prepare # solo sincroniza el esquema de erp_test (prisma db push)
npx prisma generate
npx prisma migrate dev --name <migration-name>
npx prisma db seed
npm run db:recreate      # BD dev reproducible: migrate reset + db push + marcar SQL manuales + seed
npm run audit:line-accounts  # gate P5: la cuenta capturada se valida y el builder la prefiere
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
npm test                 # Karma + Jasmine — 1979 tests
npm run e2e              # playwright test — suite completa (incluye capturas y diagnósticos)
npm run e2e:functional   # gate funcional de escritorio (242 tests) en una sola pasada — config propia
npm run e2e:mobile       # gate móvil/tablet: lista curada de 12 specs en mobile-chrome + tablet-safari
npm run e2e:captures     # capturas de formularios mobile/desktop (herramienta, no gate)
npm run e2e:visual       # regresión visual de los 53 formularios (baselines propios)
npm run e2e:baseline     # regenera los 53 baselines de referencia
npm run e2e:ssr          # smoke del build SSR (config smoke, server :4000 + spec; job de CI)
npm run migrate:heights  # migra alturas px de pages/shared a variables de densidad (--apply/--check)
npm run migrate:heights:check  # gate: falla si quedan alturas px crudas
npm run e2e:ui           # playwright test --ui
npm run e2e:report       # playwright show-report
npm run typecheck:e2e    # tsc del suite E2E (tsconfig.e2e.json) — 0 errores
npm run format:scss      # prettier --write de todo el SCSS de src/
npm run format:e2e       # prettier --write e2e (114 archivos)
npm run format:check     # gate: prettier --check e2e + src/**/*.scss (CI)
npm run format:check:touched  # ratchet: exige formato solo en archivos tocados vs origin/main
npm run generate-types   # copia prisma-types.ts desde backend
npm run audit:density:ci # gate de densidad: estático (px crudos + tablas) + calidad de bloques
npm run audit:density:e2e# auditoría dinámica Compacta vs Espaciosa (bajo demanda)
npm run audit:important  # gate de `!important`: falla ante usos sin justificar (!important-ok)
npm run audit:ng-deep    # gate de `::ng-deep`: falla ante usos sin justificar (::ng-deep-ok)
npm run audit:pos-scope  # gate: ninguna clase propia del POS estiliza otras páginas
npm run audit:tokens     # gate: sin hex fuera de la capa de tokens ni @media con px (DT.4/DT.6)
npm run audit:e2e-conditional  # gate: sin test.skip por datos ni `if` que esconda aserciones (T141)
npm run audit:list-actions  # gate: una plantilla con `#actions` exige la columna `type: 'actions'` (T152)
npm run audit:line-accounts # gate P5: la columna de cuenta se ve, tiene celda y cablea la propuesta
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

## 4. Estado real del proyecto (2026-09-12)

### Backend (`backend-erp/`)

| Comando | Estado | Evidencia |
|---------|--------|-----------|
| `npm run build` | ✅ **OK** | 0 errores |
| `npm run lint` | ✅ **OK** | 0 errores (**1 aviso preexistente declarado**: `local/no-raw-without-tenant` sobre el `$executeRawUnsafe` de `src/common/code-generator.ts:87`, que crea las secuencias por tenant —el nombre de la secuencia lleva el `tenantId`—) |
| `npm test` | ✅ **OK** | **183 suites / 2171 tests** (2026-09-21, con los **11 unitarios de P4** —rechazo de la cuenta agrupadora sin abrir la transacción y la capturada persistida y transportada al motor en emisión, recibo, ensamblaje y Precio de Entrega—, los **3 de rechazo comerciales** (facturas de venta y compra y recepciones), los **4 de P1** (Revalorización), los **4 de P2** (`assertCapturedAccounts` en entradas, salidas y ajustes y el validador compartido) y el unitario de **T157** (el kardex clasifica el recibo y el subproducto de producción como entradas y la reversa de la emisión también, con el saldo corrido cuadrando), sobre los **6 de G3/Fase 6** (cierre y reapertura de la orden en `production-orders.service.spec.ts`: cierre con el residuo conciliado y la columna a cero, guarda de operación en proceso, guarda de consumo sin recibo, doble cierre y estado no cierreable, reapertura con motivo y WIP documental restituido, y reapertura rechazada fuera de `CLOSED`), sobre los **10 de G3/Fase 5** (`production-resources.service.spec.ts`: orden no liberada, recurso inactivo, recurso sin componentes de costo activos, operación ajena, recurso de otro centro de trabajo, tarifas en cero, el parte con el snapshot de costos y el tiempo real, la anulación con reversa/tiempo/WIP y la doble anulación), sobre los **13 de G3/Fase 4** (`production-receipts.service.spec.ts`: orden no liberada, recibo sin línea MAIN, PT que no es el de la orden, subproducto no inventariable, sobre-recibo con el pendiente en el mensaje, recibo sin costo acumulado en el WIP, tasa del PT estable entre parciales —acumulado = WIP vivo + ya absorbido—, PT al costo real con kardex y asiento contra el WIP, subproducto y merma que reducen lo que absorbe el principal, valorización excesiva rechazada, anulación con reversa/stock/WIP y doble anulación), sobre los **10 de G3/Fase 3** (`production-issues.service.spec.ts`: orden no liberada rechazada, artículo que no es componente, sobre-consumo con el pendiente en el mensaje, emisión con costo promedio y asiento contra el WIP, parcial, anulación con reversa/motivo/devolución del pendiente, doble anulación y lote/serie exigido), sobre los **16 de G3/Fase 2** (`production-orders.service.spec.ts`: snapshot de receta y ruta con merma y costo, artículo comprado rechazado, artículo sin receta rechazado, costo previsto congelado al planificar, liberación, las dos reversiones —y la que avanza rechazada—, anulación con y sin motivo, baja solo de borradores y el cálculo de faltantes), sobre los **56 de G3/Fase 1** —**17** de la explosión de la lista de materiales (`src/common/bom-explosion.util.spec.ts`: multinivel, merma por salto, agregación por caminos, ciclo/auto-referencia/profundidad, faltantes y el redondeo a 6 decimales) y los specs de los tres maestros nuevos (`work-centers` 13, `resources` 14, `production-routes` 11) más los **5 del formulario de recetas** (columna de acciones T152, merma y operación al guardar, explosión y faltantes)— sobre los **2 unitarios de T151** —contabilización en un período cerrado con el documento abierto → 409 sin asiento, y documento cerrado con contabilización abierta → asiento vinculado al período de la contabilización, que **fallan sin el arreglo**—, sobre los **43 de G2/T150** —18 de la matemática del ajuste (`src/common/stock-revaluation.util.spec.ts`), 5 del motor (`createStockRevaluationJournalEntry`), 2 del kardex (`valueDelta` y promedio corrido) y 18 del servicio—, sobre los **8 de `journal-entry-scope`** —la regla única del par revertido, T149, incluido el unitario de regresión del `NULL` de Prisma—, los **3 unitarios nuevos del motor** (la reversa vinculada a su período, el 409 con el período cerrado y el mensaje que pide reabrir, y la fecha de contabilización elegida que resuelve el período) y los **2 del motor reescritos** (409 en vez de `null` silencioso y el fixture del espejo ya cuadrado), sobre el unitario de **T147** —«el par anulado no cuenta aunque su reversa caiga en OTRO período», que **falla sin el arreglo**— y los **9 de T145/T146** —6 del prorrateo de la línea de factura de la NC, con el invariante `neto + IVA === total` y el empate de medio centavo, y 3 de `tenantToday` con el borde 20:00–24:00 locales—, más los **13 del pendiente de devolución** —T144, `src/common/pending-return.util.ts`— sobre los 170/1951 de G1, que sumó los 24 del reparto del Precio de Entrega sobre los 169/1927 de T136, que sumó 8 sobre los 168/1919 de T132; el hook de pre-push lo corre completo en verde contra `origin` y `deploy`. **Nota de entorno**: una corrida lanzada **en paralelo con el gate de UI de Playwright** cerró `1 failed / 1972 passed` sin que se capturara el nombre del test; las corridas siguientes en solitario (y las dos del pre-push) dieron **1974/1974**, y ninguna suite unitaria abre la BD real (todas mockean Prisma), así que se atribuye a la contención de CPU de esa corrida concurrente) |
| `npx tsc --noEmit` (proyecto y specs) | ✅ **OK** | 0 errores |
| `npm run test:e2e` | ✅ **OK** | **31 suites / 248 tests passed** (2026-09-21, con la suite nueva **P2/P3/P4** `test/line-account-override.e2e-spec.ts` **13/13** —la cuenta capturada manda en entrada, salida, ajuste, factura de venta, factura de compra, recepción y entrega, y la de la configuración **no** aparece en el asiento; sin captura el asiento usa la determinación; agrupadora, inexistente/ajena e inactiva → **400** con stock, kardex y asiento intactos— y las **6 pruebas nuevas de P4** en `production-issues` **9/9**, `production-receipts` **10/10** (la capturada en el mayor y la agrupadora rechazada sin documento) y `landed-costs` **9/9** (la agrupadora no capitaliza costo), con las **2 pruebas nuevas de T163** en `test/stock-revaluations.e2e-spec.ts` —la cuenta capturada manda sobre la determinación y el asiento la usa, y una cuenta agrupadora se rechaza con 400 sin documento ni kardex—, sobre la suite nueva de **G3/Fase 6** `test/production-close.e2e-spec.ts` **6/6** —ciclo preparado hasta 170 de WIP con la operación abierta; cierre rechazado por la operación en proceso; **cierre que deja el WIP en cero medido en el mayor** con el asiento `Dr Variación 170 / Cr WIP 170` y el detalle publicando el importe liquidado; doble cierre y consumo sin recibo rechazados; los tres reportes con sus cifras medidas; y la reapertura con el par `CANCELLED`/`REVERSAL`, el motivo persistido, el WIP de vuelta en 170 y de nuevo a cero al recerrar—, sobre la suite de **G3/Fase 5** `test/production-resources.e2e-spec.ts` **7/7** —orden preparada con ruta y un recurso de dos componentes de costo; parte de 4 h con el snapshot (asiento `Dr WIP 100 · Cr 5.1.3.01.001 80 + Cr 5.1.3.01.002 20`), 240 minutos y WIP 100; segundo parte que cierra la operación (300 ≥ 260) y WIP 125; los cuatro rechazos 400 —recurso inactivo, sin componentes de costo, operación ajena y centro de trabajo distinto—; anulación con reversa, tiempo y WIP devueltos; anulación del último parte con la orden de vuelta a `RELEASED` y el **WIP en cero medido en el mayor**; y aislamiento por tenant—, sobre la suite de **G3/Fase 4** `test/production-receipts.e2e-spec.ts` **8/8** —emisión previa de 200 de WIP; parcial de 4 al costo real de 20 la unidad con kardex `PRODUCTION_RECEIPT` y asiento 80/80; sobre-recibo rechazado con el pendiente 6; recibo sin `MAIN` y con un PT que no es de la orden; recibo sin costo acumulado; PT + subproducto + merma con las dos patas deudoras (38 de inventario y 2 de mermas) y la merma **sin** existencia; anulación con el par `CANCELLED`/`REVERSAL`, stock y `avgCost` restituidos (104 → 100 y 50 exacto), WIP devuelto y orden liberada al anularlo todo; y aislamiento medido contra un recibo de otro tenant—, sobre la suite de **G3/Fase 3** `test/production-issues.e2e-spec.ts` **7/7** —emisión parcial de 6 de 22 con costo promedio 3 (18), kardex `PRODUCTION_ISSUE`, asiento cuadrado contra `1.1.3.03.001`/`1.1.3.01.001`, pendiente y estado `IN_PROGRESS` de la orden, kardex con la emisión como documento origen, sobre-emisión rechazada con el pendiente, artículo que no es componente, orden no liberada, anulación con el par `CANCELLED`/`REVERSAL` y stock devuelto, y aislamiento por tenant—, sobre la suite de **G3/Fase 2** `test/production-orders.e2e-spec.ts` **14/14** —alta con el snapshot de receta (merma 10 %) y ruta (315 min y costo 105), artículo comprado rechazado, **aviso de faltantes sin bloquear** (22 requeridas / 5 disponibles / 17 faltantes), edición que rehace el snapshot, planificación con costo congelado, liberación, reversión de la liberación y a borrador (descongelando el costo), reversión inválida rechazada, anulación con motivo persistido y aislamiento por tenant—, sobre la suite de **G3/Fase 1** `test/production-masters.e2e-spec.ts` **11/11** —centro de trabajo creado/listado/editado con 409 en el código duplicado, cuenta de absorción agrupadora rechazada, recurso de hora hombre con **tres componentes de costo** y suma 37,5, tarifas activas que suman cero rechazadas, `MACHINE` sin Activo Fijo rechazado y con el activo del tenant enlazado, ruta de un artículo que se compra rechazada, ruta + receta de un artículo fabricado (dos operaciones, BOM con merma y operación), línea de BOM con operación inexistente rechazada, **explosión con merma y faltantes** (22 requerido, 5 disponible, 17 faltante, costo 66) y aislamiento por tenant—, sobre la suite de **T153** `test/cancellation-reason.e2e-spec.ts` **6/6** —salida, entrada y traspaso de stock, cobro y pago: el detalle del API devuelve el `cancellationReason` persistido, más el caso «sin motivo anula igual y la columna queda en null»—, sobre la suite de **T151** `test/posting-date-period-guard.e2e-spec.ts` **9/9** —control, 409 sin dejar nada por contabilización en período cerrado, el inverso vinculado al período correcto, fecha fuera de la gestión y la misma regla en salida de stock, cobro, factura de compra y asiento manual—, sobre la suite de **G2/T150** `test/stock-revaluations.e2e-spec.ts` **17/17** —aumento `PRICE` con asiento `Dr 1.1.3.01.001 500 / Cr 4.2.1.01.008 500` y `avgCost 55.000000`; disminución `TOTAL` con `Dr 5.1.2.01.001 499.45 / Cr 1.1.3.01.001 499.45`; mixto con **4 patas**; anulación con el par `CANCELLED`+`REVERSAL` y **costo restituido exacto**; período cerrado → **409 atómico** y reapertura → 201; 11 validaciones 400 con el invariante «no se crea documento ni movimiento»; 404 de otro tenant y aislamiento del listado; y el **límite medido** del kardex sin historia de movimientos—, más la suite de **T149** `test/annulment-posting-date.e2e-spec.ts` **11/11** —control 409 al crear con el período cerrado; anular con el período cerrado → **409 + atomicidad medida** (documento no anulado, sin kardex de cancelación, asiento original vivo y sin reversa); reabrir → **201 con la reversa vinculada a su período**; la fecha elegida manda y se vincula a *ese* período; período cerrado o fecha sin gestión → 409 atómico; la misma regla en un **cobro** y en una **salida de stock**; y las dos mediciones de saldo (**226 → 0** en el mismo período y el par repartido entre dos períodos)—, más las suites de **T145** `test/credit-note-partial-money.e2e-spec.ts` **3/3** —dinero de la NC parcial con importes impares, ventas y compras, con el asiento cuadrado— y del **default `isReserve`** `test/sale-invoice-from-delivery-default.e2e-spec.ts` **2/2** —decisión de contrato del punto 3, con el stock intacto en los dos casos—, más la de **T144** `test/credit-note-return-pending.e2e-spec.ts` **4/4** —pendiente derivado en la NC y en el listado, vínculo completo de la línea, FRV acreditada antes de entregar → pendiente 0, espejo de compras y aislamiento—, la de **T147** en `test/withholding-reports.e2e-spec.ts` («la reversa fechada en otro día del tenant no rompe el cuadre», que antes medía `difference = −33.9` y ahora 0) y la de **G1** `test/landed-costs.e2e-spec.ts` **7/7**; el script sincroniza antes el esquema de `erp_test` con `prisma db push` — ver nota de entorno). **Aviso de entorno medido el 2026-09-17**: `test/app.e2e-spec.ts` falló una vez con `disk: down` porque el disco estaba al **90,3 %** (la caché `.angular` del frontend había crecido a **44,4 GB**, ver T142); ese chequeo depende de `HEALTH_DISK_THRESHOLD_PERCENT`, es decir del **estado del disco de la máquina**, no del código — liberada la caché la suite pasa **118/118**. **Franja horaria (T146, CERRADO)**: en la ronda de T144 la suite cerró **1 failed / 121 passed** en `withholding-reports.e2e-spec.ts` (`ledgerTotal` esperado 0, recibido 33.9) solo entre las 20:00 y las 24:00 locales; la causa medida fue el **arnés** —fechaba con el día **UTC** (`toISOString()`) y pedía documentos del **futuro** del tenant (UTC−4), así que el asiento original caía en el día siguiente y su reversa, fechada con el «hoy» del tenant, quedaba fuera de la ventana del informe— y el arreglo es `tenantToday()` (113 usos en 13 specs) — ver AUDIT T146 y el límite real en T147 |
| `npm run perf:k6` | ✅ **OK** | **5/5 escenarios con 100 % de checks y 0 % de fallos** en perfil `small` (~4,5 min). El perfil **`large`** (25 VUs) corre **programado** —job `load-tests-large`, semanal + a demanda— en **modo medición** (`K6_LATENCY_MODE=report`: exige los umbrales de fallos y **reporta sin bloquear** los de latencia, porque el techo de escritura del entorno los cruza sin ningún fallo funcional: p(95) 6,7 s / 5,6 s frente a 1,5 s / 2 s); el resumen queda como artefacto `k6-large-summary` (T89) |
| `npm run perf:k6:check` | ✅ **OK** | diagnóstico de entorno + aviso de que el suite resetea el tenant `default` + receta con BD desechable (T60) |
| `npm run db:recreate` | ✅ **OK** | BD dev reproducible: `migrate reset` + `db push` + SQL manuales + seed; `prisma migrate diff` sin diferencias. Desde **T132** el seed deja además la instalación **operable**: crea la **gestión del año en curso** con 12 períodos mensuales abiertos y **las 26 series de numeración** (idempotente), de modo que el primer documento se emite sin pasos manuales de estructura; el único paso manual del arranque es la **tasa de cambio del día** (a propósito, ver `prisma/seed.ts` §15). Desde **T136** el seed **valora todo el almacén** (paso 23: las 26 existencias al costo del maestro, cualquier almacén, sin pisar una valoración propia y declarando el artículo sin costo) y es idempotente en el número de filas (los kits no reciben existencia: se ensamblan). Desde **T152** el seed **limpia también los documentos de Revalorización** (`StockMovement.stockRevaluationId` primero y después la cabecera, cuyas líneas caen por `onDelete: Cascade`) y el resumen lo verifica con su propia línea (`- Revalorizaciones : 0`). Desde **G3/Fase 1** (2026-09-19) el seed siembra además los **maestros de producción** de forma idempotente —la unidad `HORA`, dos centros de trabajo (`WC-ENSAMBLE`, `WC-EMPAQUE`), tres recursos (hora hombre con **3 componentes de costo**, hora máquina `MAQ-EMPAQUE` sobre el activo fijo `AF-EMPAQ-01` y servicio) y el artículo fabricable `PT-PC01` con receta (3 componentes, uno con 2 % de merma) y ruta (2 operaciones)— y lo publica en su propia línea del resumen (`Producción (G3) : 2 centros de trabajo, 3 recursos, 5 componentes de costo, 2 operaciones`). Desde **G3/Fase 2** el catálogo canónico de series pasa a **29 tipos** (se suma la **orden de producción**, prefijo `OP`) y el arranque operativo crea las 29. Desde **G3/Fase 3** el catálogo suma la **emisión para producción** (prefijo `EP`) y desde **G3/Fase 4** el **recibo para producción** (prefijo `RP`): **31 tipos** (`Series de numeración: 31 creadas / 31 tipos`). Desde **G3/Fase 5** el esquema suma el **consumo de recursos** (las tablas `ProductionOrderResource`/`ProductionOrderResourceCost` y el origen de asiento `PRODUCTION_RESOURCE`), sin serie nueva. Desde **G3/Fase 6** el esquema suma el **cierre** (el origen de asiento `PRODUCTION_CLOSE` y las columnas `reopenReason`/`reopenedAt`/`reopenedById` de la reapertura), también sin serie nueva. El detector de flujos pasa a **9 bloques de reglas** con el bloque **R16** (R16a/b/c ERROR y R16d/e/f WARN): sobre la BD recreada cierra en **0 errores** y **1 aviso**, y una sonda con datos incoherentes creados a propósito lo llevó a **3 errores** exactamente por R16a/R16b/R16c más el aviso R16f. Desde **G3/Fase 7** el `cleanTransactions` del seed limpia además el **ciclo de producción** (kardex, emisiones, recibos, partes y órdenes) y lo publica en su resumen (`- Órdenes Producción : 0`): antes dejaba órdenes con su WIP **documental** y sin mayor, que es justo lo que R16b marca (medido: **7 órdenes** descuadradas que el detector cazó y el seed ya no produce) |
| `npm run audit:line-accounts` | ✅ **OK** | **18 familias con cuenta capturada · 0 hallazgos** — gate nuevo (P5, 2026-09-21, `scripts/audit-line-accounts.mjs`): para cada familia registrada exige que el **servicio valide** la cuenta capturada (`assertCapturedAccounts`: existe en la empresa, activa, no bloqueada y **de detalle**) y que su **builder la prefiera** sobre la determinación, con dos comprobaciones de cobertura (un builder que prefiera `line.acctCode` o un servicio que mencione `acctCode` **sin estar registrado** es un hallazgo) y las excepciones declaradas con su razón (traspaso de stock, documentos que no generan asiento, POS, el motor de asientos y el asiento manual). Nació de un defecto **medido**: una factura de compra con una cuenta agrupadora capturada respondía 201 y el asiento quedaba con esa cuenta en el debe. Autoprueba **6/6** (`npm run audit:line-accounts:self-test`) y paso en `ci.yml` |

### Frontend (`erp-frontend/`)

| Comando | Estado | Evidencia |
|---------|--------|-----------|
| `npm run build` | ✅ **OK** | 0 errores (bundle inicial **1.32 MB** medido el 2026-09-12, sobre un `maximumWarning` de 1.40 MB) |
| `npm run lint` | ✅ **OK** | 0 errores, 0 warnings |
| `npx ng test --watch=false --browsers=ChromeHeadlessCI` | ✅ **OK** | **1979 / 1979 tests** (los **48 de la ronda de cuentas editables** —16 de inventario (P2: columna visible, propuesta por almacén y por signo, y la cuenta manual que no se pisa), 15 de ventas y 15 de compras (P3: la columna sin `hidden`, la propuesta del `entryType` de cada familia —con el caso de servicio en las dos facturas— y la marca «manual») y 6 de producción (P4: emisión y recibo, este último re-proponiendo al pasar la línea a `SCRAP`)—, sobre los **21 de la ronda de límites de G3** —9 del selector de órdenes con búsqueda en servidor, 6 del formulario de la orden —pestaña Documentos, contadores, dimensiones, quién cerró—, 2 de cada listado de emisiones y recibos con el filtro por orden, 2 del listado de órdenes y 1 del umbral del medio centavo—, sobre los **38 de G3/Fase 7** —31 de la pantalla de reportes de producción (las tres pestañas, filtros, exportación CSV y el round-trip de pestañas) y 7 del servicio—, más el unitario de regresión de **T156** (el alta de la orden deja el formulario limpio: **falla sin el arreglo**), sobre los **27 de G3/Fase 6** —el cierre y la reapertura de la orden: el diálogo de confirmación del cierre y su resultado (importe liquidado, WIP ya en cero), el diálogo de reapertura con motivo obligatorio y fecha de contabilización, las guardas de permiso y estado en el formulario y en el menú de fila, el rastro de la orden cerrada —incluido el importe que publica el detalle al recargar— y el de la reapertura—, sobre los **23 de G3/Fase 5** —19 del formulario de la orden (pestaña Recursos: tabla de partes, alta con valorización en vivo de los componentes de costo, minutos propuestos, anulación con motivo y fecha y el costo real del ciclo) y 4 del servicio—, sobre los **10 de G3/Fase 4** —el listado de recibos: carga, fila con los datos del API, totales y badge de estado, la variante de cada estado, el menú de fila con Anular y la guarda T152 de la columna de acciones—, sobre los **10 de G3/Fase 3** —el listado de emisiones: carga, fila con los datos del API, etiqueta y badge de estado y la guarda T152 de la columna de acciones—, sobre los **8 de G3/Fase 2** —el listado de órdenes: carga con la paginación del servidor, fila pintada con los datos del API, etiqueta y badge de estado, la variante de cada estado y la guarda T152 de la columna de acciones—, sobre los **25 de G3/Fase 1** —18 de los tres listados nuevos (`work-centers`, `resources`, `production-routes`: carga, datos de fila en el DOM, formatos, filtros y la guarda T152 de la columna de acciones), 2 del **método de aprovisionamiento** en el maestro de artículos y 5 del **formulario de recetas** (columnas de merma y operación, guardado con merma/operación, explosión con faltantes y formateo)— sobre los 1764 del cierre de G2/T152 + **1 de T153**: el motivo de la anulación guardado por el backend se pinta en el aviso de «documento anulado» de la salida de stock; los 1699 del cierre de T149 + los **60 de G2/T150** —18 de la matemática, 14 del servicio con el **mapper del API real**, 16 del formulario y 12 del listado— + los **6 del formateador de dinero nuevo** (`moneyToAmountString`, que además devolvió el gate `audit:money` a 0)—; sobre los 1687 del cierre de T147/T148 + los **11 del diálogo de anulación (T149)** —contrato de ConfirmResult con postingDate, la fecha propuesta con el día del tenant, postingDateDefault, la cancelación sin datos, la fecha vacía que viaja como `null` y las etiquetas accesibles de motivo y fecha— + **1 en sale-invoices.component.spec.ts** —el diálogo se pide con postingDateLabel y la fecha viaja al servicio—; los 1670 de G1 + los **10 de T144** —aviso de la fila en los dos listados, carga del pendiente al abrir la NC, caso sin pendiente y que el enlace lleva a la devolución de la **entrega**/**recepción**— + los **6 de T148** —`sale-invoices.service.spec.ts`: el tipo que pide cada flujo de copia (entrega → `'Y'`, pedido → `'N'`, F. Reserva → `'N'`), y el spec del formulario: la regla de identificación `createsReserveInvoice`/`seriesDocType` por documento de origen—; los 1650 previos eran los del cierre de T126–T129/F5.6/F5.7/T133 + los 2 de **T135**, que fijan la etiqueta de la ronda de cada sugerencia de conciliación y el aviso de la ventana amplia; los 1647 previos incluían el test de **T133** que fija que el constructor de consultas usa `luna-select` con las opciones no operables deshabilitadas) |
| `npm run e2e:functional` | ✅ **OK** | **238 passed · 0 fallos · 3 skips** en la corrida de cierre de la **ronda de cuentas editables (P2–P5, T164–T165)** (2026-09-21, 41,2 min, **241** tests programados, **sobre BD recreada**: la cuenta visible y editable en las 20 grillas —inventario, comerciales y producción— no regresó ningún flujo, el E2E de UI de la Revalorización sigue **5/5** y los 3 skips son de diseño). Historia inmediata: **238 passed · 0 fallos · 3 skips** en la corrida de cierre de la **ronda de cuentas editables (T163, P1)** (2026-09-21, 40,3 min, **241** tests programados, **sobre BD recreada**: la revalorización por pantalla —con las dos columnas nuevas de cuenta del ajuste— sigue **5/5** y los 3 skips son de diseño). Historia inmediata: **238 passed · 0 fallos · 3 skips** en la corrida de cierre de la **ronda de límites de G3 (T158–T162)** (2026-09-21, 40,4 min, **241** tests programados, **sobre BD recreada**: las **7 pruebas del ciclo completo de producción** por pantalla —ahora con las **dos** operaciones terminadas, **subproducto y merma** en el recibo, la pestaña Documentos, el filtro por orden y la orden **cerrada** al final—; los 3 skips siguen siendo de diseño). Historia inmediata: **238 passed · 0 fallos · 3 skips** en la corrida de cierre de **G3/Fase 7** (2026-09-20, 31,1 min, **241** tests programados —los 234 previos más las **7 pruebas del ciclo completo de producción** por pantalla—, **sobre BD recreada**; la cifra de flujos ajenos sigue siendo 231 y el módulo de Producción queda **completo**; los 3 skips siguen siendo de diseño). Historia inmediata: **231 passed · 0 fallos · 3 skips** en la corrida de cierre de **G3/Fase 6** (2026-09-20, 32,5 min, **234** tests programados, **sobre BD recién recreada**; la séptima corrida consecutiva con la misma cifra, así que las seis fases del módulo de Producción —recetas, artículos, órdenes, emisiones, recibos, partes de horas y cierre/reapertura— no regresaron ningún flujo; los 3 skips siguen siendo de diseño). Historia inmediata: **231 passed · 0 fallos · 3 skips** en la corrida de cierre de **G3/Fase 5** (2026-09-20, 31,9 min, **234** tests programados, **sobre BD recién recreada**; la sexta corrida consecutiva con la misma cifra, así que las cinco fases del módulo de Producción —recetas, artículos, órdenes, emisiones, recibos y partes de horas con sus entradas de menú— no regresaron ningún flujo; los 3 skips siguen siendo de diseño). Historia inmediata: **231 passed · 0 fallos · 3 skips** en la corrida de cierre de **G3/Fase 4** (2026-09-19, 38,5 min, **234** tests programados, **sobre BD recién recreada**; la quinta corrida consecutiva con la misma cifra, así que las cuatro fases del módulo de Producción —recetas, artículos, órdenes, emisiones y recibos con sus entradas de menú— no regresaron ningún flujo; los 3 skips siguen siendo de diseño). Historia inmediata: **231 passed · 0 fallos · 3 skips** en la corrida de cierre de **G3/Fase 3** (2026-09-19, 29,9 min, **234** tests programados, **sobre BD recién recreada**; la cuarta corrida consecutiva con la misma cifra, así que las tres fases del módulo de Producción —recetas, artículos, órdenes y emisiones con sus entradas de menú— no regresaron ningún flujo; los 3 skips siguen siendo de diseño). Historia inmediata: **231 passed · 0 fallos · 3 skips** en la corrida de cierre de **G3/Fase 2** (2026-09-19, 30,0 min, **234** tests programados, **sobre BD recién recreada**; la tercera corrida consecutiva con la misma cifra, así que las Fases 1 y 2 del módulo de Producción —que tocan recetas, artículos y añaden las órdenes con su entrada de menú— no regresaron ningún flujo; los 3 skips siguen siendo de diseño). Historia inmediata: **231 passed · 0 fallos · 3 skips** en la corrida de cierre de **G3/Fase 1** (2026-09-19, 32,3 min, **234** tests programados, **sobre BD recién recreada**; la misma cifra que la corrida de T151+T153, así que la Fase 1 —que toca el formulario de recetas y el maestro de artículos— no regresó ningún flujo). Historia inmediata: **231 passed · 0 fallos · 3 skips** en la corrida de cierre de **T151 + T153** (2026-09-19, 35,7 min, **234** tests programados, **sobre BD recién recreada**; incluye los avisos de «documento anulado» con el motivo que estrena T153 y la guarda de período por fecha de contabilización de T151). Historia inmediata: **231 passed · 0 fallos · 3 skips** en la corrida de cierre de **G2/T150 + T152** (2026-09-18, 29,8 min, **234** tests programados: los 230 de T149 + el spec de UI de la Revalorización con sus **4 casos**, en la posición 220-223/234), **sobre BD recién recreada**. La ronda necesitó **cuatro** corridas: la primera (228 passed · 1 fallo · 2 sin correr) y la segunda (229 · 1 · 1) fallaron por **cotas del propio spec, no del producto** — (a) la celda de costo unitario del kardex se formatea en **centavos** mientras el costo del artículo lleva **6 decimales** (medido: `newPrice` 1765,761 frente a 1765,76) y (b) la **restitución del costo** al anular vuelve al original **salvo un céntimo repartido entre la existencia** (medido con 301 unidades: 1605,237279 frente a 1605,237273, desvío **6e-6** dentro de la cota 3,3e-5 = `0,01/301`) — y la tercera (228 · 2 · 1) sumó el caso de guardas comparando contra el **costo capturado al arrancar la suite** en vez del **costo vivo**, más el **timeout de 240 s de `traceability-flow`** en la posición 226/234 (la fragilidad ya declarada de encadenar 234 specs en una pasada: en aislamiento pasa **4/4**, 78-84 s por test, y en la corrida de cierre pasó dentro del gate). Las tres cotas del spec quedaron corregidas y re-verificadas en aislamiento (spec de G2 **4/4** y `traceability-flow` **4/4**, 7 passed en 6,7 min) antes de la corrida verde. Historia: **227 passed · 0 fallos · 3 skips** en la corrida de cierre de **T149** (2026-09-18, 29,9 min, **230** programados). La corrida **previa de esta misma ronda** cerró **4 failed · 5 did not run · 218 passed** y fue la que **destapó el defecto del `NULL` de Prisma** de T149 (`account-ledger`, `exchange-revaluation-ui` y `month-close-visual`) más un choque de clases del diálogo (`landed-cost-ui`: `input.dialog-prompt` pasó a resolver 2 elementos al añadir el campo de fecha); los cuatro, corregidos y re-verificados en aislamiento (**10 passed**) antes de repetir el gate completo. Nota de proceso: la corrida de cierre de **T147/T148** había dado **226 passed · 0 fallos · 3 skips** (28,7 min, **229** programados) y, antes, la corrida sobre la **BD acumulada**, falló **3 specs por dependencia de orden/datos** (`traceability-flow` por timeout de 240 s, `line-fields-propagation` con `400 Ítem … no pertenece a la cotización` y `qa-visual-checks`), y los tres **pasan 31/31 en aislamiento** —es la fragilidad de arnés que T54/T130 atacaron y que se manifiesta al encadenar 229 tests sobre una BD con documentos de rondas anteriores; queda declarada como escenario de CI (BD recién sembrada)—. Historia: **225 passed · 0 fallos · 3 skips** en la corrida de cierre de **T144** (2026-09-18, 29,2 min, **228** tests programados: los 225 de T142 + los **3 del recordatorio NC → Devolución**), sobre BD con el seed delante. Historia: **222 passed · 0 fallos · 3 skips** en la de cierre de **T142** (34,4 min, 225 programados), con el **seed re-ejecutado delante** (el defecto de limpieza global que eso destapó, T143, ya corregido). Historia: **220 passed · 0 fallos · 3 skips** en la de cierre de **T141** sobre **BD recién recreada** (27,5 min, **223** tests programados), con las **6 verificaciones antes latentes ejecutándose de verdad** (libro mayor, columna «Documento» del kardex, los 4 cálculos de impuestos y el avance de página del listado) y el gate nuevo `audit:e2e-conditional` en **0 sin justificar**. Historia: **220 passed · 0 fallos · 3 skips** en la de cierre de **T140** (2026-09-17, 27,2 min): el **modo comercial** de la conciliación bancaria se recorre **por pantalla** en su propio tenant del arnés (`e2e-comercial`, creado por el `setup` vía panel de super-admin y con `accountingEnabled=false`) y la guarda T12 se afirma en el spec contable, que registra en el log la rama medida. **219 passed · 0 fallos · 3 skips** en la de cierre de **T138/T139** (2026-09-17) sobre **BD recién recreada** (24,9 min): el escenario comercial ya **no se saltaba** (afirmaba la guarda de T12) y los 3 skips que quedan son de diseño (2 de SSR y el de densidad con `DENSITY_AUDIT=1`). **Nota T139**: el fallo intermitente de `qa-document-drafts` que apareció en la primera corrida se diagnosticó y cerró el mismo día —el spec guardaba el borrador **antes** de que llegara la resolución de precio de la línea (`POST /special-prices/resolve`), así que almacenaba `price: 0` y el `price-check` lo marcaba como desactualizado—; ahora espera la respuesta y el guard exige `total > 0`. Historia: **218 passed · 0 fallos** en la corrida de cierre de **T137** (25,7 min), con el reporte de Stock Bajo ya **ejercitado de verdad** (columnas MRP afirmadas de forma incondicional gracias a `ensureLowStockItem`); **218 passed · 0 fallos** en la de **T133/T134** (24,4 min) —que incluye el spec nuevo `tenant-date` y salió verde **después** de que la misma corrida sobre la BD acumulada fallara 2/217 con dos causas ya cerradas (T134)—; **217 passed · 0 fallos** en las dos corridas del cierre de T130/T131 (24,8 min sobre BD recién recreada y 26,6 min repitiendo sobre la acumulada) y **24,5 min** en la de T132 con las series ya sembradas; **215 passed · 1 fallo** antes, con el spec (preexistente y dependiente de datos) `partner-account-statement`, **corregido en T130**; la corrida de cierre de **T128** sobre BD recién recreada dio **208 passed · 0 fallos · exit 0 (25,7 min)** y la que cerró T79 fue **197 passed / 0 failed / 4 skipped** (26,1 min) — el escenario de CI es el de BD recién sembrada, donde la primera corrida había dado **165 passed / 9 failed / 23 did not run** por la colisión de correlativos entre series del mismo prefijo (T81, sanado + reintento, **reforzado en T131**). T73 sustituyó 6 skips por datos garantizados de forma idempotente (`e2e/helpers/ensure-accounting-data.ts`) |
| `npm run e2e:visual` | ✅ **OK** | **53/53 sin regenerar ningún baseline** en la ronda de cuentas editables (2026-09-21, medido con `git status e2e/screenshots` en **0 PNG modificados**: la columna de cuenta nueva vive dentro de la grilla de líneas y las capturas del alta no tienen filas, así que no mueve ninguna); baselines de formularios (deterministas desde T59: fecha fija `VISUAL_REFERENCE_TIME` + correlativos normalizados en `e2e/forms-screenshot.helper.ts`). **Tres hitos el 2026-09-16**: (1) al añadir las dos entradas nuevas del menú lateral (F5.7/F5.6), con la atribución medida (52/52 en el commit previo y con solo el sidebar revertido; 50 fallos con las entradas); (2) por **T132**, que cambia el **nombre de la serie que muestran los formularios** (antes la creaba el helper de QA como `Facturas de venta 2026 (QA E2E)`, ahora la siembra el seed): falló **25/52** —exactamente los formularios con selector de serie— y se cerró con atribución medida (diff localizado **en la fila de la serie** y el renombrado de la serie sembrada haciendo **pasar** el spec de facturas de venta), regenerando los 26 con serie y revirtiendo los 4 sin serie; y (3) por **T133**, que estrena el **53.er baseline**: el **constructor de consultas** (`readySelector` propio, porque no usa `app-document-form-header`), la pantalla que se migró de `<select>` nativos a `luna-select` y que **no tenía ninguna red**. Los cambios de color de T133 pasaron **sin regenerar nada** (diferencias sub-tolerancia: la regeneración las arrastraba en 19 archivos y se **revirtieron** — el gate tolera 500 px y esas diferencias de ~33 px en el breadcrumb no son una regresión). **Cuarto hito (G3/Fase 1, 2026-09-19)**: la grilla de **recetas (BOM)** gana las columnas de **merma** y **operación** y la sección de **explosión y faltantes**, así que el gate falló **solo ese** baseline (**52/53**) y se cerró con **atribución medida** —`git status` mostró **un único** PNG modificado, `e2e/screenshots/item-boms-form-after.png`— regenerándolo con `--grep "screenshot item-boms new form"` y re-verificando el gate completo **53/53**. **Y un quinto hito sin coste (G3/Fase 2, 2026-09-19)**: la entrada nueva del menú lateral (Órdenes de Producción) **no movió ningún baseline** —el gate pasó **53/53 sin regenerar nada**—, a diferencia del primer hito de T133, porque la entrada cae fuera del recorte de las capturas. **Sexto hito (G3/Fase 3, 2026-09-19)**: la entrada de **Emisiones de Producción** tampoco movió ningún baseline (**53/53 sin regenerar nada**), así que de las tres entradas nuevas del módulo solo la grilla de recetas (Fase 1) exigió regenerar su captura. **Séptimo hito (G3/Fase 4, 2026-09-19)**: la entrada de **Recibos de Producción** tampoco movió ningún baseline —el gate pasó **53/53 sin regenerar nada**—, medido además con `git status e2e/screenshots` en **0 archivos modificados**. **Octavo hito (G3/Fase 5 + T155, 2026-09-20)**: la corrección del slot de acciones de sección (6 formularios) movió **exactamente 3 baselines** —`item-boms`, `payment-term` y `journal-entries`, los tres formularios con esa sección visible en el alta—, regenerados con esa atribución medida (`git status e2e/screenshots` con **3 PNG**) y re-verificados con el gate completo en **53/53**. **Noveno hito (G3/Fase 7, 2026-09-20)**: la pantalla de reportes (ruta nueva, tarjeta en el índice de Reportes y entrada del grupo Producción) **tampoco movió ningún baseline** —**53/53 sin regenerar nada**— |
| `npm run typecheck:e2e` | ✅ **OK** | 0 errores (`tsconfig.e2e.json`, **114 archivos** de `e2e/` —el conteo de 55 era de T60—) |
| `npm run format:check` | ✅ **OK** | prettier limpio en **todo `e2e/` y todo el SCSS de `src/`** (T62 cerró los 67 SCSS que faltaban); el TS/HTML legacy se gestiona con `format:check:touched` |
| `npm run migrate:heights:check` | ✅ **OK** | **0 alturas en px crudas** en `pages/`+`shared/` (65 migradas a variables de densidad en T62; el audit estático ya las vigila) |
| `npm run e2e:ssr` | ✅ **OK** | **3 passed** con la configuración `smoke` (backend local) y **job `ssr-smoke` en CI** — antes el spec se **skipeaba siempre** por falta de un server SSR levantado (T61/T63) |
| `npm run audit:density:ci` | ✅ **OK** | 0 hallazgos estáticos + 0 de calidad de bloques |
| `npm run audit:important` | ✅ **OK** | **7 usos de `!important` en 3 archivos**, todos compitiendo con algo fuera del control propio (librería, autofill, `prefers-reduced-motion`) o gates funcionales — desde T58 (antes 105) y T64 (los 2 de `luna-data-table` pasaron a custom property) |
| `npm run audit:ng-deep` | ✅ **OK** | **4 usos de `::ng-deep` en 3 archivos, los 4 justificados** con `::ng-deep-ok` (contenido de `[innerHTML]` ×3 y el mixin de líneas de inventario) — desde T65 (antes 9 sin métrica reproducible) |
| `npm run audit:pos-scope` | ✅ **OK** | **0 filtraciones** — gate nuevo (T86, `scripts/audit-pos-scope.mjs`, en CI): de los 147 selectores de nivel raíz del POS sin acotar, **147 están ancorados** en clases propias y **0 son globales puros**; falla si una clase propia del POS se usa fuera de `pages/pos` sin `:where(app-pos)`. Sustituye al barrido de las 176 clases, que costaba **+4,11 kB (+11,2 %)** de CSS y no arreglaba ninguna filtración real |
| `npm run audit:tokens` | ✅ **OK** | **0 literales sin justificar** — gate nuevo (**T133/DT.4-DT.6**, 2026-09-16): **R1** un `#hex` en `src/**/*.scss` fuera de la capa de tokens (`styles.scss` + `styles/tokens/**`) deja el color fuera del tema claro/oscuro —el caso peor es el fallback `var(--token, #hex)` cuyo token **no existe**— y **R2** un `@media` con `px` duplica los breakpoints canónicos (`bp.$breakpoint-*`). Estado: **18 literales, los 18 declarados** con `// color-ok:` (acentos y constantes de tema sin token) y **0 breakpoints en px**; el detector se autoprueba (`npm run audit:tokens:self-test`, **12/12**). En el cierre se retiraron 69 fallbacks muertos, se corrigieron 9 fallbacks **vivos** (bugs de modo oscuro), se migraron los 84 `@media` a los tokens y los 5 `<select>` nativos del constructor de consultas a `luna-select` |
| `npm run audit:e2e-conditional` | ✅ **OK** | **0 hallazgos sin justificar** — gate nuevo (**T141**, 2026-09-17, `scripts/audit-e2e-conditional.mjs`): **R1** un `test.skip` condicionado por **datos** (no por entorno/proyecto) y **R2** un `if (…) { … expect(…) }` **sin `else`** son verificaciones que pueden no ejecutarse nunca y dejar el suite verde (la clase de falso verde de T90/T127/T137/T139/T140, que se había cerrado caso por caso). Estado: **15 hallazgos, los 15 declarados** —**5** R1 (4 de entorno/proyecto: proyecto mobile/tablet ×2, server SSR ×2; 1 marcado: la auditoría de densidad bajo demanda) y **10** R2 marcadas (`conditional-ok: <razón>`, todas de preparación de datos o de afirmación complementaria)— y **6 verificaciones latentes arregladas**: `kardex`, `account-ledger` (nuevo helper `resolveLedgerAccountWithMovements`, que usa las cuentas de un asiento POSTED real en vez de sondear 60 cuentas) y los 4 `test.skip(true, …)` de `qa-tax-calculations` (ahora el fixture falla en voz alta); además `pos-density` (`.brand-title` existe siempre, la guarda sólo podía esconder la comprobación) y `qa-buttons-interaction` (el avance de página se ejercita fijando tamaño 10 y **exigiendo** segunda página). El detector se autoprueba (`npm run audit:e2e-conditional:self-test`, **14/14**) y corre en CI. Evidencia: gate en **0 sin justificar**, los 5 specs tocados **23 passed · 0 skips** (2,8 min) y el **gate funcional sobre BD recreada 220 passed · 0 fallos · 3 skips** (27,5 min, 223 programados), con las 6 verificaciones antes latentes ejecutándose de verdad |
| `npm run audit:list-actions` | ✅ **OK** | **106 tablas con `#actions` · 0 sin columna de acciones** — gate nuevo (**T152**, 2026-09-18, `scripts/audit-list-actions.mjs`): `luna-data-table` solo pinta la plantilla `#actions` **dentro de una celda de una columna `type: 'actions'`**, así que un componente que declara el `ng-template` y olvida la columna deja **código muerto** y la fila **sin ninguna acción**, sin ningún error (la tabla se ve igual). Ese olvido tenía **5 instancias reales** —dos de ellas dejaban **inalcanzable por la interfaz** algo que el backend ya hacía: anular una Revalorización (G2/T150), **eliminar** un Tipo de gasto de importación y **quitar una línea de gasto** del Precio de Entrega—; las 5 corregidas añadiendo `{ key: 'actions', label: '', type: 'actions', align: 'center' }`. El único caso legítimo (`luna-document-lines-detail`, que traduce la columna que le pasa el llamador) está declarado con `list-actions-ok: <razón>`. El detector se autoprueba (`npm run audit:list-actions:self-test`, **10/10**) y corre en CI |
| `npm run audit:line-accounts` | ✅ **OK** | **18 familias auditadas (16 con cuenta en la línea) · 0 hallazgos** — gate nuevo (P5, 2026-09-21, `scripts/audit-line-accounts.mjs`): para cada familia del registro exige **columna sin `hidden`** (el defecto original era justamente una columna oculta), **celda con `app-account-selector`** y **cableado de la propuesta** (`proposeAccount(`/`resolveAccount(`/`capturedAccountContext(`); falla si un formulario declara la columna de cuenta **sin entrar al registro** y si una familia declarada como **excepción** sí declara la celda (registro mentiroso). Las dos excepciones razonadas son el **traspaso de stock** (sus dos patas son la cuenta de inventario de cada almacén y el motor ignora el valor) y la **orden de ensamblaje** (no tiene grilla de líneas editable: sólo la tabla de sólo lectura de los componentes de la receta). Autoprueba **9/9** (`npm run audit:line-accounts:self-test`) y paso en `ci.yml` |
| `npx playwright test density-raw-tables.spec.ts` | ✅ **OK** | tablas crudas medidas con datos reales (1px → 4px) |
| `npm run a11y:check` | ✅ **OK** | **0 hallazgos** — gate estático nuevo (`scripts/audit-a11y.mjs`, T74): R1 botones sin nombre accesible, R2 `img` sin `alt`, R3 controles dentro de `app-filter-field` sin `ariaLabel`/`label`. Reemplaza a `scripts/check-icon-button-a11y.js`, un archivo **que nunca existió** y hacía fallar siempre el paso "Accessibility Check" de CI con `MODULE_NOT_FOUND` |
| Auditoría axe de accesibilidad (Playwright + axe-core) | ✅ **OK** | **0 violaciones en 16/16 páginas** autenticadas (6 listados, 3 formularios, dashboard, plan de cuentas, usuarios, Carga Masiva, reporte y POS) — línea base 9 violaciones en los 6 listados; metodo y hallazgos en AUDIT T74 y `FRONTEND_GUIDE.md` §1.6 |

> **Notas de deuda técnica activa (2026-09-10):**
> - **Integridad branch↔warehouse completada (2026-08-08):** `assertWarehousesInBranch` en 22 servicios + POS (create/update), herencia de branchId en flujos de copia del frontend (`applyBranchFromSource`), matriz artículo-almacén optimizada a 3 `findMany` en paralelo, stock-transfers con destino libre de sucursal. Ver `AUDIT.md` §7 y `ROADMAP.md` DT.11-14.
> - **Densidad visual (T48) y `::ng-deep` (T49) cerrados:** auditoría estática y de calidad de bloques en 0. Los **`!important` bajaron de 105 a 7 en 3 archivos** (T58 + T64, 2026-09-11): los que quedan compiten con algo que el CSS del proyecto no controla (autofill del motor, `prefers-reduced-motion`) o son gates funcionales — política completa en `erp-frontend/src/styles/CSS-ARCHITECTURE.md`. Las **65 alturas px crudas** de `pages/`+`shared/` quedaron como variables de densidad (T62) y el audit estático ya las vigila; los **`::ng-deep`** activos son **4** (T65), todos con marca `::ng-deep-ok` (contenido de `[innerHTML]` y el mixin de líneas de inventario) y vigilados por el gate `npm run audit:ng-deep`; las recetas para no volver a necesitarlos están en `CSS-ARCHITECTURE.md` §5.
> - **Patrón `openDialog` eliminado completamente.** Todos los formularios y catálogos usan `ConfirmDialogService.ask()`. `document-form.base.ts` limpiada.
> - **Plan visual v2**: Fases 0, 1, 3, 4, 5, 6 resueltas; Fase 2 cerrada en su parte de densidad (T48) y Fase 7 auditada (T49, 9 reglas justificadas). Sigue como tracking continuo (`docs/plans/plan-consistencia-visual-v2.md`).
> - **Entorno E2E determinista (T53, 2026-09-10):** tipografías self-hosted (sin CDNs externos) y `e2e/auth.setup.ts` garantiza gestión fiscal abierta + series antes de cada corrida (**desde T132 el seed también las crea** —gestión del año, 12 períodos y las 26 series—, así que el `setup` pasa a ser red de seguridad para el núcleo vacío y las series de QA con correlativo alto). BD dev reproducible con `npm run db:recreate` y BD de tests E2E con `npm run test:e2e:prepare` (sincroniza `erp_test` con `prisma db push`; sin ese paso **13 de 14 suites fallaban** por esquema desactualizado). **Reiniciar el backend después de recrear la BD** (T137): la **caché en memoria de secuencias** de `code-generator.ts` queda obsoleta respecto de la base nueva, así que el primer documento de cada tipo puede fallar **una vez** con `500` (`42P01 no existe la relación «journal_entries_code_seq_t1»`); el propio código invalida la caché y el siguiente intento la recrea, pero un spec que crea **ese** primer documento falla igual — el `webServer` del gate no lo sufre porque se levanta después del seed. El mismo `setup` garantiza la terminal POS de E2E (`ensurePosTerminal`) porque el formulario de usuarios cambia de alto según existan terminales (T56: era la causa de un baseline visual que dependía del orden de los specs). **Segundo tenant del arnés (T140, 2026-09-17):** el setup asegura además el tenant **`e2e-comercial`** («E2E Comercial», perfil comercial/inventario, `accountingEnabled=false`) con el **panel de super-admin** —`e2e/helpers/ensure-commercial-tenant.ts`, idempotente: `GET /tenants` por slug y `POST /tenants` si falta— y guarda su sesión en `e2e/.auth/e2e-comercial.json`; lo consumen `e2e/banking-reconciliation-commercial.spec.ts` y el fixture `e2e/fixtures/commercial-test.ts` (`setupAuth(page, '<archivo>')` está parametrizado: las cookies del helper se añaden **después** del `storageState`, así que archivo y estado deben coincidir). Existe para poder recorrer el **modo comercial** por pantalla sin depender de si el tenant contable tiene asientos (con asientos el toggle responde 409, regla T12). El tenant comercial **persiste** en la BD de desarrollo (se reutiliza) y suma una segunda tarjeta al selector de empresa del login; sus credenciales (`e2ecomercial` / `e2ecomercial123`) y las del super-admin (`superadmin` / `superadmin123`, sobreescribibles por `SUPERADMIN_USERNAME`/`SUPERADMIN_PASSWORD`) las define el propio arnés.
> - **Karma estable (T62):** la config ya endurecida (`browserNoActivityTimeout: 300000`, `browserDisconnectTolerance: 5`, `timeoutInterval: 20000`, `--no-sandbox --disable-dev-shm-usage`) da **1534/1534 en ~3,5-4 min** de forma repetida (corridas verdes el 2026-09-11, incluidas las del hook de pre-push); el "hang" histórico **no se reproduce** y cualquier fallo nuevo debe tratarse como regresión, no como flakiness de infraestructura. **Nota (T65):** en specs de componentes `OnPush`, cambiar un `@Input` mutando la instancia **no** re-renderiza la vista (el `[class]`/`@if` no se reevalúa): usar `fixture.componentRef.setInput(...)` + `fixture.detectChanges()` (o `markForCheck()`), como hacen los 7 tests nuevos.
> - **Accesibilidad (T74, 2026-09-12):** axe-core en **0 violaciones sobre 16 páginas** y **gate estático `npm run a11y:check` en CI** (antes apuntaba a un archivo inexistente: el paso de accesibilidad nunca se ejecutó). Reglas obligatorias en `FRONTEND_GUIDE.md` §1.6: un `h1` por página (título del listado/formulario), secciones en `h2`, nombre accesible en todo control (`luna-form-field` lo hereda; `app-filter-field` exige `ariaLabel`), botones de solo icono con `action`, y «el texto visible es el nombre accesible» (WCAG 2.5.3).
> - **CSS del POS (T76 + T84 + T86 + T87, 2026-09-12):** `pos.component.scss` bajó de 2.399 a ~1.940 líneas: se eliminaron 22 clases sin uso (T84, pixel a pixel en 5 estados), **sus 16 clases con nombre genérico quedaron acotadas con `:where(app-pos)`** (22 reglas) y en T87 se quitó el CSS muerto restante (el buscador propio del POS, `.chip`, `.payment-methods`, la regla `.fas` de Font Awesome y 4 variables de densidad huérfanas) → **36,67 → 34,84 kB**, con el presupuesto `anyComponentStyle` bajado de **37 a 35 kB**. Al quitar la filtración se corrigieron dos defectos que ocultaba (el sidebar heredaba el color del icono de marca y el `flex-direction: column` del POS) y en T87 se reparó un **bug del propio acotado de T84**: el prefijo `:where(app-pos)` había caído en reglas **anidadas**, que compilaban a `.search-bar-mobile :where(app-pos) .filter-search` (un `app-pos` *dentro* del contenedor: nunca matchea), así que 4 reglas del buscador del POS no aplicaban; **al acotar, comprobar siempre que la regla sea de nivel raíz y volcar los estilos computados en el `@media` que corresponda**. Las ~140 clases propias que siguen siendo globales **no filtran** (escaneo de T85: 0 coincidencias en las 234 plantillas/TS fuera de `pages/pos`) y **no se envuelven** (costaría +4,1 kB, +11 %). En su lugar hay un **gate**: `npm run audit:pos-scope` falla si una clase propia del POS se usa fuera de `pages/pos` sin acotar (detalle en `CSS-ARCHITECTURE.md` §6.b).
> - **Layout móvil de una barra de acciones fija (T85, 2026-09-12):** un componente que es **flex-item** no se encoge por debajo de su `max-content` ni con `min-width: 0` cuando el contenedor tiene `flex-wrap: wrap`; su desbordamiento escala hasta `<html>` (412 → 484 px en un Pixel 7), el navegador aplica *shrink-to-fit* y **todo `position: fixed` se ancla al layout expandido**, dejando el botón fuera de pantalla (así se rompió el paso «Pago Saliente» de `purchase-full-journey-ui`). La cura es **`max-width: 100%; min-width: 0`** en el `:host` del componente — `width: 100%` también quita el desbordamiento pero fuerza al host a ocupar la línea entera y **apila a su hermano** (+32 px de alto en desktop, cazado por `e2e:visual`). Método de diagnóstico y verificación en `CSS-ARCHITECTURE.md` §6.c.
> - **Gate móvil (T77 + T85, 2026-09-12):** `npm run e2e:mobile`
>   (`playwright.mobile.config.ts`) corre una **lista curada** de specs en `mobile-chrome` y
>   `tablet-safari` (la suite completa en móvil tarda horas y varios specs son de escritorio por
>   diseño). Estado actual: **79 passed / 2 skipped / 0 failed** con **12 specs** (T85 sumó
>   `purchase-full-journey-ui`, que antes quedaba fuera por el bug de layout del paso «Pago
>   Saliente»). Fallos cross-browser ya llevados a causa raíz: ambigüedad de locators (usar
>   `{ exact: true }` cuando dos controles comparten prefijo de etiqueta), rate limit del entorno
>   local (429 tras muchas corridas seguidas: reiniciar el backend de dev) y specs de escritorio por
>   diseño (el POS se salta solo en móvil).
> - **Correlativos por serie (T81, 2026-09-12):** el código es `prefijo + contador de la serie`
>   **sin la gestión**, así que dos series activas del mismo `docType` con el mismo prefijo pueden
>   chocar contra el índice único `(tenantId, code)`; `DocumentSeriesService` **auto-sana el contador**
>   contra el mayor código emitido con ese prefijo (cacheado por serie y proceso) y, si aun así el
>   número asignado ya está usado por otra serie, **consume el siguiente** (hasta 10 intentos) en vez
>   de devolver un código duplicado. Al crear series de prueba/QA conviene arrancar el contador muy
>   alto (el helper de E2E usa 1000). **Reforzado en T131 (2026-09-16):** el saneado se **cachea por
>   proceso**, así que su foto del mayor código emitido puede quedar vieja; si la serie hermana del
>   mismo prefijo consume un bloque contiguo de ≥10 números *después* de la foto, los 10 intentos
>   caían todos en códigos ocupados y el documento fallaba con un 400 engañoso
>   (`… los siguientes números ya están usados por otra serie …`). Ahora, al agotar una ronda, se
>   **invalida el cache de esa serie**, se **vuelve a sanar** (salta a `max + 1`) y se reintenta,
>   hasta **3 rondas** acotadas; el error accionable se conserva si de verdad no hay hueco.
> - **CSS global de componentes `ViewEncapsulation.None` (T84, 2026-09-12):** acotar con
>   **`:where(<host>)`**, nunca con un prefijo de host a secas (sube la especificidad y cambia el
>   aspecto dentro del propio componente). Receta y procedimiento en
>   `erp-frontend/src/styles/CSS-ARCHITECTURE.md` §6.b.
> - **Baselines visuales: nunca capturar un estado transitorio (T91, 2026-09-13).** Un cambio de
>   tiempos de carga puede mover un elemento que aún no está asentado y dejar el baseline con un
>   ancho que ya no se reproduce: el baseline del formulario de cobros había guardado el chip
>   «Nº <serie>» en su estado **sin resolver** (texto de 58 px frente a 73 px resuelto, misma altura
>   de glifo) y el gate falló con **747 px localizados en la caja del chip** al añadir una petición
>   más al `ngOnInit`. Cómo diagnosticarlo sin ver la imagen: perfil de **bandas por filas** (para
>   separar un desplazamiento de un cambio real) + **búsqueda del desplazamiento vertical** que
>   mejor empareja cada región (el resto del formulario cuadraba con **dy=+100 px** exactos, la fila
>   nueva). Prevención: `forms-screenshot.helper.ts` desactiva transiciones/animaciones, espera a
>   que el chip esté **resuelto**, normaliza los dígitos recorriendo **nodos de texto** (asignar
>   `textContent` aplasta los hijos) y aplica el último parche justo antes de capturar.
> - **NC → Devolución (T144) y los tres puntos que cerró su revisión (T145, T146, T147/T148, 2026-09-18).** La devolución **nace de la entrega/recepción** (su menú «Copiar a»), no de la nota de crédito, así que una NC puede dejar mercancía **acreditada sin devolver**: el ERP lo **deriva** (`src/common/pending-return.util.ts`: `min(acreditado, entregado/recibido) − devuelto`, anclado a la línea de entrega y nunca desde `invoicedQty`) y lo publica en el listado de entregas/recepciones (badge «NC sin devolver»), en la NC (`GET /<nc>/:id/return-pending` con **un enlace por documento pendiente** al flujo de devolución que ya existe) y en la regla **R14f** del detector, **como aviso**. Al construirlo apareció que la NC creada **por API** guardaba el vínculo a medias (`baseLineId` sin `baseDocType`/`baseDocId`): el servicio **deriva** ahora el vínculo de la cabecera (ventas y compras). **T145 CERRADO**: la NC **parcial** de importes impares ya no descuadra el asiento —helper `prorateInvoiceLineAmounts` (bruto prorrateado + IVA prorrateado + **neto por diferencia**, `neto + IVA === total`), reparto con `prorateMoneyBy` (fin de los empates invertidos) y totales del documento acumulados en `Decimal`—, con 3 E2E + 6 unitarios de dinero. **T146 CERRADO** por su causa real, medida con una sonda de tres escenarios: el **arnés** fechaba con el día **UTC** y entre las 20:00 y las 24:00 locales pedía documentos del **futuro** del tenant, así que el asiento original caía en el día siguiente y su reversa (fechada con el «hoy» del tenant) quedaba fuera de la ventana del informe; ahora usa `tenantToday()` (**113 usos en 13 specs**, + 3 unitarios del borde horario). **T147 CERRADO** (hallazgo real, sin depender de la hora) con la opción que eligió el usuario: el **par revertido** (asiento `CANCELLED` con espejo `REVERSAL`) **se netea en el cuadre** del informe, así que anular un documento de **otro** período ya no descuadra —antes medía `difference = −33.9` y ahora 0—, y las fechas quedan como están (la del documento se mantiene; la de contabilización es la del período en el que se anula, que es lo que permite anular con el período del original cerrado). **T148 CERRADO** con la unificación coherente: la factura desde una entrega es **F. Reserva en las tres superficies** (`'Y'` en el default del API, **`'Y'` explícito desde el formulario** —antes mandaba `'N'`—, y la **serie** de reserva la numera), identificada en pantalla (título, banner «no mueve stock», botón, `[documentType]`), en el payload y en el vínculo (el `baseDocType` de la línea apunta al **origen** —`DELIVERY_ORDER`— en los dos tipos; el tipo vive en `isReserve` y en el `baseDocType` de la NC que nazca de ella), con los DTO de copia múltiple validando `isReserve` como `@IsIn(['Y','N'])`. **T149 CERRADO**: la **anulación** respeta la fecha de contabilización —por defecto el **hoy del tenant**, elegible por el usuario— y **la protección de período** (antes **no** la respetaba: la reversa se creaba con `tx.journalEntry.create` directo, sin pasar por `_persist`, así que anular con el período **cerrado** devolvía **201** y dejaba el espejo con `periodId` nulo —medido—); la resolución de período se extrajo a `_resolveAccountingPeriod` y la usa también la reversa, que queda **vinculada** a su período; si la fecha cae en un período cerrado/bloqueado o fuera de la gestión, responde **409** pidiendo **reabrir el período**, dentro de la transacción (anulación **atómica**); el espejo se valida con `_assertBalanced` y un asiento ya reversado **falla** en vez de devolver `null` en silencio. Con una **regla única** (`common/journal-entry-scope.ts`: cuenta si está `POSTED` y no es `REVERSAL`) el **par revertido se excluye de saldos e informes** —antes los saldos filtraban `status = 'POSTED'`, que incluye la reversa y excluye el original: medido, tras anular una factura de 226 el saldo de CxC quedaba en **−226** y ahora mide **226 → 0**—; quedan fuera de la regla, declarados, el listado de Asientos (auditoría) y los `*-movement-checker`.
> - **Deuda estructural y de proceso: sin pendientes abiertos (2026-09-12).** `AUDIT.md` §7 (S1–S18, S32–S39) está **liquidada** —incluido el último «pendiente menor» de S1 (`previewJournalEntryFromDraft`, cerrado el 2026-08-09)— y §5 (issues activos) no tiene ninguna fila abierta. Los frentes de proceso/QA y de carga también quedaron cerrados: **T88** (el gate funcional ya no ensucia el árbol con 4 PNG) y **T89** (el perfil `large` de k6 corre programado en modo medición, con el techo de latencia a 25 VUs descrito como limitación del entorno). El pendiente menor de UX de `docs/plans/plan-mejoras-ux-ui-frontend.md` quedó cerrado en **T90** (7 botones de listado + 18 estados vacíos, y de paso 6 comprobaciones del suite de E2E que no verificaban nada: guardas `if ((await locator.count()) > 0)` que nunca se ejecutaban) y las **retenciones en ventas** se resolvieron en **T91** (el cobro con retención ya contabiliza: antes rompía el guardado con un 500 de «Asiento desbalanceado»). Lo único que sigue abierto es **producto** (F5.1, **G2–G4** —G1 se cerró en T142—, F6.6, F5.3/F5.4, F7.3) y las dos features que se **reclasificaron el 2026-09-16** desde la lista de riesgos de QA —porque son **features** y no defectos de prueba— y que ese mismo día quedaron **cerradas**: **F5.6** «reporte y certificado de retenciones sufridas» (informe + certificado PDF/Excel con **cuadre contra el mayor** a centavo; backend 22 unitarios + 6 E2E, frontend Karma 1647/1647 y E2E de UI 3 passed) y **F5.7** «administración de tipos de retención» (pantalla LUNA en `/withholding-taxes` con alta/edición/modo ver/borrado, ruta con permisos y entrada de menú) y los **riesgos declarados de QA**, **cerrados todos el 2026-09-16 (T127)**: el desglose multimoneda de `sap-b1-ui-verification` ya no es un falso verde (los datos se preparan de forma idempotente y las aserciones son incondicionales), la convención de copy tiene **gate propio** (`npm run audit:copy:check`, en CI) y el camino **Factura de Proveedor creada desde un documento de origen por la interfaz** tiene spec propio (`e2e/purchase-invoice-from-origin-ui.spec.ts`); ese spec **destapó un defecto real** —el pedido sin almacén de cabecera daba 500 al copiarlo—, cerrado en **T128** en las dos capas (heredan el almacén y sin ninguno determinable responden 400 explicativo); y en **T129** se abrió la **entrada por UI que faltaba** (`RECEPCIÓN → FACTURA DE COMPRA`, que sólo era alcanzable por API) y, al recorrerla el E2E nuevo, se corrigió el defecto que escondía (el guardado enviaba `receiptItemId: null` → 400, mismo patrón de hidratación que T93). El mismo frente dejó `COTIZACIÓN → PEDIDO → F. RESERVA COMPRA` funcionando por la interfaz, con spec propio.

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
   ✅ **G1 «Precio de Entrega» (costeo de importación) cerrado el 2026-09-17 (T142)** — ver
   `docs/plans/plan-g1-precio-entrega.md` y AUDIT T142/T143— y ✅ **G2 «Revalorización de
   artículos» cerrado el 2026-09-18 (T150 + T152)** — ver `docs/plans/plan-g2-revalorizacion.md`—;
   quedan **G3 producción** (potenciar ensamblaje) y **G4 servicios** (OT/contratos).
   Módulos contables que AGENTS listaba como pendientes (cierre de período,
   revaluación por TC, conciliación bancaria, activos fijos) **ya están implementados** — ver
   §5.7 filas 8–11.
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
| `docs/reference/matriz-flujos-documentos.md` | **Matriz origen→destino de ventas y compras**: las tres capas del vínculo (columnas desnormalizadas / `base*`-`target*` / columnas de relación), qué escribe cada flujo, qué lee cada consumidor, qué guard bloquea, qué regla de `npm run audit:flows` lo vigila, y los límites declarados. | Al tocar cualquier flujo de copia entre documentos, sus guards o la lectura de la API (T96–T101). |
| `docs/archive/` | Informes históricos de frentes completados y cierres de fase. | Solo si se necesita trazabilidad histórica de una migración ya cerrada. |
| `backend-erp/CHANGELOG.md` / `erp-frontend/CHANGELOG.md` | Historial de cambios por versión. | Para entender evolución reciente del proyecto. |
| `backend-erp/load-tests/k6/README.md` | Documentación de la suite de carga k6. | Antes de ejecutar o modificar tests de carga. |
| `backend-erp/perf/README.md` | Documentación del módulo de performance. | Antes de trabajar en optimización de performance. |
| `mcp-erp/README.md` | **MCP del ERP** (servidor stdio de solo lectura, 13 herramientas): instalación, variables, tabla de herramientas, cómo conectarlo a DSH (`dsh-mcp-erp.cordis.yml`) y a otros clientes MCP, garantías de seguridad y alcance. | Cuando un agente necesite **consultar** el ERP (documentos, asientos, stock, series, retenciones, reportes) o leer la documentación canónica a través de MCP. |

> **Nota:** Los archivos listados arriba son **referencia**. Las reglas obligatorias de diseño, tipado, arquitectura y testing viven en los 5 archivos canónicos de la sección "Protocolo de inicio de trabajo".

---

*Este archivo es el índice maestro y carga automáticamente como standing instructions en cada sesión de Kimi Work. Para detalles de implementación, patrones de código y decisiones de arquitectura, consultar los 5 archivos canónicos enlazados en la sección "Protocolo de inicio de trabajo".*
