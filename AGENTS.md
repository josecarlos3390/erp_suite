# AGENTS.md — erp_suite

> **Instrucciones VIVAS del monorepo.** Aquí está solo lo que un agente necesita para trabajar:
> protocolo de lectura, convenciones, **gates y cómo se corren**, reglas de proceso y despliegue.
> **El registro histórico no vive aquí**: está íntegro y navegable en
> [`docs/plans/historial-sesiones.md`](docs/plans/historial-sesiones.md) (132 entradas fechadas
> 2026-09-18 → 2026-10-05, los bloques retirados de este archivo y una sección de «pendiente de
> revisar»).
>
> **Motivo del corte.** Este archivo pesaba **579 985 B** (580 748 B con finales CRLF) y **440 336 B**
> (el 76 %) eran **una sola línea** (432 023 caracteres) con el registro; el arnés solo lee los
> **primeros 65 536 B** de las instrucciones de workspace, así que el registro **nunca llegaba al
> modelo**. Nada se borró: la verificación byte a byte está documentada en el encabezado del histórico.
>
> **Qué es.** `erp_suite`: ERP modular (Bolivia) con `backend-erp/` (NestJS + Prisma), `erp-frontend/`
> (Angular + LUNA, con SSR) y `storefront/` (Next.js); detalle en el **Anexo F** del histórico.

---
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


---

## Convenciones transversales (lo que ningún incremento puede saltarse)

- **Backend:** `0` `as any`; DTOs estrictos. **Multi-tenant: ninguna query sin `tenantId`** (regla
  propia `local/no-raw-without-tenant` en `error`). Contrato de error con `code` estable
  (`VALIDATION_ERROR`, …) y `requestId` (`X-Request-Id`).
- **Frontend:** `0` `!important` y `0` `::ng-deep` sin marca (`!important-ok` / `::ng-deep-ok`);
  overrides por **especificidad**; un `h1` por página y nombre accesible en todo control (WCAG 2.5.3);
  alturas y densidades por variables, nunca `px` crudos en `pages/`+`shared/`.
- **Un solo motor por dominio** — precios (`price-resolver.util.ts`), contabilidad (`AccountingEngine`,
  punto único `_persist`), reparto por centros de costo, impuestos (`resolveLineTaxIndicator` +
  `calcLineWithIndicator`). **Ninguna pantalla ni la tienda replican la regla: la consumen.**
- **Dinero al centavo** (`Decimal` / `Money` / `isZeroMoney`; `.toFixed()` solo para **serializar**) y
  **fechas con `tenantToday()`** en specs y seeds, nunca `toISOString()`.
- **Cuentas con `requiresPartner`:** la línea de asiento exige `partnerId` y el `partnerCode`
  (ShortName) se denormaliza (Anexo B).
- **E2E:** los maestros se resuelven **por código, nunca por posición**.
- **`0`** `@ts-ignore` / `eslint-disable` / `--force` / **`--no-verify`** (ver *Reglas de proceso*).

El detalle **obligatorio** vive en los 5 archivos canónicos del protocolo de arriba y en los planes de
`docs/plans/`.

---

## Gates: qué se corre y cómo

Ningún gate se sustituye por inspección visual. Salida y comandos uno a uno, con sus reglas medidas:
**Anexo D** del histórico; los gates nacidos después del 2026-09-12, fechados en el registro.

### Backend (`cd backend-erp`)

```bash
npm run build                # nest build — 0 errores
npm run typecheck            # tsc (app y specs) — 0 errores
npm run lint:ci              # eslint — 0 errores / 0 avisos (lint lleva --fix: NO en CI)
npm test                     # Jest unitario
npm run test:e2e             # Jest E2E (sincroniza erp_test antes)
npm run db:recreate          # BD dev reproducible (reset + db push + SQL + seed)
npm run audit:line-accounts  # la cuenta capturada se valida y el builder la prefiere
npm run audit:tracking       # lote/serie coherentes (necesita BD)
npm run audit:reconcile      # cuadre general (necesita BD) (+ :self-test)
npm run audit:money:check    # dinero al centavo (ratchet en 0)
npm run perf:k6              # k6 perfil small (el large, programado)
```

> **Pre-push del backend:** `npm test` + `npm run typecheck` + `npm run lint:ci`. Los dos últimos
> llevan el **heap dentro del script** porque sin él mueren por OOM. Nada se empuja sin los tres verdes.

### Frontend (`cd erp-frontend`)

```bash
npm run build                # ng build (AOT) — 0 errores
npm run lint                 # ng lint — 0 errores, 0 warnings
npm test                     # Karma + Jasmine (ChromeHeadless)
npm run typecheck:e2e        # tsc del suite E2E
npm run e2e:functional       # gate funcional de escritorio
npm run e2e:mobile           # gate móvil/tablet (lista curada)
npm run e2e:visual           # regresión visual (baselines propios)
npm run e2e:baseline         # regenera baselines (con atribución medida)
npm run e2e:ssr              # smoke del build SSR
npm run audit:ci             # las auditorías del frontend (pre-push)
npm run format:check:touched # prettier: solo lo tocado vs origin/main
npm run migrate:heights:check# 0 px crudos en pages/+shared/
```

Auditorías individuales del `audit:ci`: `audit:density:ci`, `audit:important`, `audit:ng-deep`,
`audit:pos-scope`, `audit:tokens`, `audit:e2e-conditional`, `audit:list-actions`,
`audit:line-accounts`, `audit:select-options`, `audit:ui-fields`, `a11y:check`, `format:check`.

> **Pre-push del frontend:** `audit:ci` **antes** de Karma + build de producción, para que una regla
> nueva no bloquee todos los pushes durante ~10 min. Lección escrita: **una regla sin gate es un deseo.**

### Tienda (`cd storefront`)

```bash
npm run typecheck            # tsc --noEmit — 0 errores
npm run lint                 # next lint --max-warnings=0 — 0/0
npm run build                # next build — 0 errores (OBLIGATORIO antes del E2E)
npm run sync:tokens:check    # tokens de la tienda = los del ERP
npm run sync:fonts:check     # fuentes = las del ERP
npm run e2e                  # Playwright (sirve el build, :3100)
npm run e2e:visual           # gate visual (fixture del canal)
npm run e2e:a11y             # axe-core, claro y oscuro
npm run e2e:perf             # presupuesto LCP/CLS y peso (ratchet)
npm run audit:contrast       # contraste WCAG de la paleta
```

### Reglas de entorno medidas (E2E): no diagnosticar producto desde ellas

1. **Nunca dos suites E2E completas del backend a la vez**: comparten `erp_test`, que `test:e2e`
   reescribe (medido: 18 fallos en suites que en aislamiento pasan).
2. **El login del ERP admite 5 intentos/min por IP** y cada corrida de Playwright hace **2**: varias
   corridas seguidas fallan con «Límite de solicitudes excedido» y el síntoma engañoso «la tarjeta de
   empresa no aparece». Esperar ~1 min entre corridas.
3. **Tienda:** el dev server (:3000) y el E2E/build comparten `.next`; con el dev server levantado, el
   E2E lo pisa y la tienda responde **500**. Parar :3000 antes.
4. **Los E2E del ERP y de la tienda no comparten estado**: los dos arneses vuelcan y restauran `erp_db`
   con huella de contenido, así que una corrida a mitad de la otra mueve los datos (medido: el visual
   del ERP falló con `partners 23→17`).
5. **Playwright sin esperas sin tope:** `actionTimeout: 30000` y `{ timeout }` en los helpers que
   actúan sobre un popup que la app puede cerrar. Un `click()` sin tope reintenta para siempre: la
   prueba muere por su tope, **sin traza** y con la página viva.

---

## Reglas de proceso (obligatorias)

### Trabajo y commits

- **Nunca `--no-verify`** (ni `--force`, `@ts-ignore`, `eslint-disable`, `xit`). El hook se arregla,
  no se salta. El proyecto lo mide: **0 usos** declarados en la revisión de ortodoxia.
- **Nunca reescribir un commit ya empujado**: sin `push --force`/`--force-with-lease` sobre ramas
  compartidas y sin `amend`/`rebase` de historia publicada. Si algo salió mal, se **añade** un commit
  que lo corrige y, si aplica, se despliega la reversión.
- **Antes de commitear, comprobar la rama** (`git rev-parse --abbrev-ref HEAD`); los cambios no
  triviales van en una rama. Los tres repos anidados tienen su propio Husky: **un commit por repo
  tocado**.
- **El costo está en el `pre-push`** (suite completa, **una vez por cada `pushurl`**). Un commit nuevo
  o un `amend` lo invalidan; si el sello por contenido (`.git/pre-push-verified`) no puede calcular la
  clave, la suite **corre igual** —degrada al comportamiento de siempre, nunca salta la verificación
  por accidente.
- **No hacer *round-trip* de código por PowerShell** (`Get-Content -Raw` + `Set-Content` mojibakea los
  acentos en PS 5.1): usar las herramientas del agente o Node, y comprobar con `git diff --numstat` que
  solo aparezcan las inserciones esperadas.

### Despliegue

- **Empujar `main` despliega:** `erp-frontend` y `storefront` en **Vercel**, `backend-erp` en
  **Railway**. A `main` de producción solo con el **hook completo en verde** y con el **visto bueno
  del usuario** cuando el cambio es de producto.
- **Backend, dos remotos:** `git push origin main` y `git push deploy main` (`origin` =
  `josecarlos3390/backend-erp`; `deploy` → `josekilla3390/backend-erp`). El frontend y la raíz tienen
  uno solo. **No** hay que empujar `deploy` aparte «para asegurar»: lo cubre el sello.
- **Verificar el despliegue por medición, nunca por suposición:** `/health` **200** con `prisma: up`,
  contrato de error vivo (`code` + `requestId`), **OpenAPI idéntico** a la línea base, **huella del
  bundle** servido igual a la del build local del mismo commit y sonda de navegador con **0 errores de
  consola** y `/` → `/login`. Un `/health/live` que responde **404 y luego 200** es la prueba del
  **relevo del contenedor**.
- **Nunca el reset/seed destructivo contra una base con datos del usuario** sin su decisión explícita
  (`db:recreate` borra). Procedimiento completo —backup, orden de migraciones, **SQL manuales por
  drift**, rollback y go/no-go—: **`docs/plans/runbook-go-live.md`**.

### Disciplina de medición y declaración

- **Si no se mide, no se adopta.** Todo incremento entrega el **antes y el después** con el comando que
  lo produjo; una mejora sin beneficio demostrable **se revierte** (caso medido: la hidratación de
  Angular, revertida y re-adoptada solo al construir la configuración que permite medirla).
- **Los gates se declaran con su salida**, no con un «debería pasar». Un rojo por **entorno o arnés**
  se declara como tal con su evidencia, y se repite en aislamiento antes de atribuirlo al producto.
- **Si un diagnóstico se corrige, se escribe**: la corrección va al CHANGELOG o al plan; el diagnóstico
  anterior **no se borra**.
- **Una verificación de despliegue empieza esperando una HUELLA DE VERSIÓN**, nunca asumiendo que el
  despliegue ya ocurrió. `curl /health` devolviendo 200 **no** distingue builds: el 2026-10-06 el
  contenedor nuevo tardó ~11 min en estar servido y una verificación «200 y sano» dos minutos después
  del push midió el **build viejo** (medido: el 200 sin `X-Request-Id` seis veces y con él en el
  séptimo). La huella es algo que **solo** existe en el build nuevo (un endpoint, una cabecera, un
  hash de bundle); si no lo hay, **declare** que la identidad del build se confirma en el panel.
- **Un script que no arranca es un gate que no existe.** Siete `scripts/*.mjs` tenían el `import` en la
  línea 1 y el **shebang en la 2** (Node solo lo acepta como primeros bytes) ⇒ `SyntaxError` siempre:
  `audit-tracking`, `audit-reconcile` y `audit-flow-links` eran **tres gates** que llevaban meses sin
  poder ejecutarse, y el CI moría antes de llamarlos. Regla: **ejecute el script, no lo parsee** — y
  si un `--self-test` no existe de verdad (hay scripts que **ignoran** los flags y corren la
  auditoría completa), **no invente el alias**: sería un gate que pasa por casualidad.
- **Declarar lo que no se midió** y los límites (flakes, datos ausentes, decisiones pendientes del
  usuario) en vez de taparlos. **Un entorno que nadie prueba es un gate que no existe.**
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


---

## Documentación de referencia

Tabla completa en el **Anexo E** del histórico. Las entradas que más se usan:

- `.agents/skills/angular-solid-frontend/` y `.agents/skills/nestjs-solid-backend/` — recetas de
  generación al **crear** páginas, formularios, listados, servicios o módulos nuevos.
- `erp-frontend/src/styles/CSS-ARCHITECTURE.md` — **antes de escribir o modificar SCSS global**:
  capas, receta de especificidad sin `!important`, política de `::ng-deep`.
- `docs/guides/ESTANDAR_LINEAS_DOCUMENTO.md`, `docs/guides/ACCOUNTING_ENTRIES_GUIDE.md` y
  `docs/guides/guia-implementacion-configuracion.md` — líneas de documento, asientos por tipo de
  documento y orden de configuración por perfil.
- `docs/reference/matriz-flujos-documentos.md` — **antes de tocar cualquier flujo de copia entre
  documentos**, sus guards o la lectura del API (lo vigila `npm run audit:flows`).
- `docs/plans/runbook-go-live.md` — **al desplegar a producción** o preparar el corte.
- `mcp-erp/README.md` — **MCP del ERP**: servidor stdio de solo lectura (13 herramientas de consulta).

> Las reglas **obligatorias** de diseño, tipado, arquitectura y testing viven en los 5 archivos
> canónicos del protocolo de inicio de trabajo, no aquí.

---

## Histórico: qué hay y dónde

El registro de sesiones se separó el **2026-10-06** a
[`docs/plans/historial-sesiones.md`](docs/plans/historial-sesiones.md), **íntegro y reformateado** (la
reforma solo inserta saltos de línea y encabezados: **no** se reescribió ni se borró texto).

| Parte del histórico | Qué contiene |
|---|---|
| **Parte 1 — Registro** | **132 entradas** fechadas, la más reciente primero (2026-10-05 → 2026-09-18), con índice |
| **Anexo A** | Estado real del proyecto (2026-09-12): la evidencia medida de cada comando |
| **Anexo B** | Sistema ShortName: cuentas asociadas y trazabilidad en asientos |
| **Anexo C** | Próximos pasos recomendados (2026-09-08), lista fechada |
| **Anexo D** | Comandos detallados de los tres proyectos, git hooks y **reglas medidas de entorno** |
| **Anexo E** | Índice de documentación adicional completo (25 filas) |
| **Anexo F** | Visión general del proyecto y stack tecnológico (íntegros) |
| **Verificación y pendiente** | La prueba de que no se perdió nada y lo que queda **por decidir** |

**Cuándo consultarlo:** para saber **por qué** algo está como está, qué se midió y con qué comando, qué
decisiones tomó el usuario y qué quedó declarado. Es la memoria del proyecto; este archivo es el manual
de trabajo. **`§2 Stack` del Anexo F tiene versiones desactualizadas**: ver «Pendiente de revisar».