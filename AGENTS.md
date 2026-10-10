# AGENTS.md — erp_suite

> **Instrucciones VIVAS del monorepo.** Aquí está solo lo que un agente necesita para trabajar:
> protocolo de lectura, convenciones, **gates y cómo se corren**, reglas de proceso y despliegue.
> **El registro histórico no vive aquí**: está íntegro y navegable en
> [`docs/plans/historial-sesiones.md`](docs/plans/historial-sesiones.md) (134 entradas fechadas
> 2026-09-18 → 2026-10-07, los bloques retirados de este archivo y una sección de «pendiente de
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
- **`0`** `@ts-ignore` / **`--no-verify`**; `eslint-disable` **sólo con la regla nombrada** —y ese
  calificativo alcanza a las **12** escritas a mano, **no** a las **206** de `src/generated/`, que son
  `/* eslint-disable */` en bloque, sin regla nombrada, y viven **fuera del lint**— y `--force`
  **sólo** en `prisma migrate reset --force` (ver *Reglas de proceso*).

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
npm run audit:non-null:check # aserciones no nulas (`!`): ratchet congelado en 1601
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
6. **Un caso E2E debe crear lo que mide.** El 2026-10-08, **tres** casos del job `e2e` pasaban por el
   **estado acumulado de la máquina de desarrollo** y caían en un entorno limpio: el login de
   super-admin (credenciales solo en el `.env` **no versionado** ⇒ 401 y **264** `did not run`;
   `39fbba2c`), la Nota de Crédito (el «hoy» del tenant salía del reloj de la máquina —La Paz— y no del
   caso: con el runner en **UTC** los **5** casos se rechazan como futuros; `9eabacab` + la regla **7**)
   y el selector de medios (`erp_db` con **23** filas de `MediaAsset` que dejó
   `backend-erp/scripts/generate-store-cards.ts`, mientras el seed crea **0** ⇒ `picker-grid`
   «element(s) not found»; `1724af21` con `e2e/helpers/ensure-media-library.ts`). Los **4** casos
   resultantes pasan en el entorno limpio **sin relajar una aserción**.
7. **La zona horaria del PROCESO se declara a propósito.** `TZ: America/La_Paz` va **solo** donde la
   zona entra en el render —`visual-regression` (`ci.yml:376`) y `ssr-smoke` (`ci.yml:514`)— y en el job
   `baseline` de `update-baselines.yml`; el job `e2e` se queda en **UTC a propósito**: es el único
   entorno donde el defecto de la doble conversión de zona se manifiesta, y alinearlo lo taparía
   (`4a7e5b5e`). El defecto y su medición van escritos al lado, en el `env` de los tres jobs, para que
   nadie lo «arregle» dentro de un mes.

---

## Reglas de proceso (obligatorias)

### Trabajo y commits

- **Nunca `--no-verify`** (ni `--force`, `@ts-ignore`, `eslint-disable`, `xit`). El hook se arregla,
  no se salta. El proyecto lo mide, y no todo es cero: **0 usos** de `--no-verify`, `xit`, `@ts-ignore`
  y `as any`; `eslint-disable` **sólo con la regla nombrada**, y ese calificativo son **12** directivas
  **escritas a mano** (8 `local/no-raw-without-tenant` + 4 `@typescript-eslint/no-require-imports`) —
  las **206** de `src/generated/` **no** nombran ninguna regla: son `/* eslint-disable */` **en bloque**,
  una por fichero de Prisma, y `eslint.config.mjs:19` las deja **fuera del lint**, así que la condición
  no las alcanza—; y `--force` **sólo** en `prisma migrate reset --force`,
  que es lo que ejecuta `db:recreate`. Las aserciones no nulas (`!`) van aparte, en la viñeta siguiente
  (medido el **2026-10-10** en `backend-erp`; el detalle, en el `CHANGELOG.md` de la raíz).
- **Cero `!` nuevos**, que desde el **2026-10-09** **tiene gate**: `npm run audit:non-null:check` en las
  **tres** puertas (CI, `pre-push`, `ci-local.mjs`), con la cifra **congelada en 1601** (`expresión!` 956
  + `x!: T` 645; 1249 en producción, 352 en specs) — **la deuda está CONGELADA, no pagada**: el ratchet
  falla si **sube** (visto en rojo: 1601 → 1602, `exit 1`). Hasta ese gate la regla era un deseo, y el
  manual no la traía escrita en ningún sitio (medido); el detalle, en el `CHANGELOG.md` de la raíz.
- **Nunca reescribir un commit ya empujado**: sin `push --force`/`--force-with-lease` sobre ramas
  compartidas y sin `amend`/`rebase` de historia publicada. Si algo salió mal, se **añade** un commit
  que lo corrige y, si aplica, se despliega la reversión.
- **Antes de commitear, comprobar la rama** (`git rev-parse --abbrev-ref HEAD`); los cambios no
  triviales van en una rama. Solo **dos** repos están anidados (`backend-erp`, `erp-frontend`) y cada uno tiene su Husky:**un
  commit por repo tocado**. `storefront/` **vive en el repo raíz** (no tiene `.git` propio: sus 218
  ficheros los trackea la raíz, y con ellos su CHANGELOG y su CI).
- **El costo está en el `pre-push`** (suite completa, **una vez por cada `pushurl`**). Un commit nuevo
  o un `amend` lo invalidan; si el sello por contenido (`.git/pre-push-verified`) no puede calcular la
  clave, la suite **corre igual** —degrada al comportamiento de siempre, nunca salta la verificación
  por accidente.
- **No hacer *round-trip* de código por PowerShell** (`Get-Content -Raw` + `Set-Content` mojibakea los
  acentos en PS 5.1): usar las herramientas del agente o Node, y comprobar con `git diff --numstat` que
  solo aparezcan las inserciones esperadas.
- **Un commit por sitio al arreglar una familia de bugs.** Si uno sale mal, se revierte **uno** sin
  deshacer los demás. El barrido de la doble conversión de zona (los **7** sitios que declaró
  `e33b0b4c`) va así aunque cuatro vivan en el mismo fichero: `76688c98` (los cuatro avisos de
  vencimiento) y `95fa7edf` (los tramos del aging) son **dos commits, no uno**.

### Despliegue

- **Empujar `main` despliega:** `erp-frontend` y `storefront` en **Vercel**, `backend-erp` en
  **Railway**. A `main` de producción solo con el **hook completo en verde** y con el **visto bueno
  del usuario** cuando el cambio es de producto.
- **Backend, dos remotos:** `git push origin main` y `git push deploy main` (`origin` =
  `josecarlos3390/backend-erp`; `deploy` → `josekilla3390/backend-erp`). El frontend y la raíz tienen
  uno solo. **Los dos espejos se empujan y se verifican siempre** (ver *Disciplina de medición y
  declaración*): el sello cubre la **verificación**, no el envío. El 2026-10-07 `deploy` se quedó
  **2 commits atrás** (`origin` en `0417acd`) porque su hook falló y el resultado global no lo dijo.
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
- **Después de empujar, compruebe LOS DOS espejos** (`git ls-remote origin refs/heads/main` y
  `git ls-remote deploy refs/heads/main`). El 2026-10-07 el push «salió bien» y el espejo `deploy` se
  quedó **2 commits atrás** (`origin` en `0417acd`, `deploy` en `4948689`) sin que el resultado global
  lo gritara: el hook corre la suite **una vez por `pushurl`** y el segundo falló. Un desfase de espejo
  es un despliegue que no ocurrió.
- **No empuje con otro proceso trabajando en el mismo árbol** (un agente, otra sesión, un E2E). Medido
  el 2026-10-07: tres pushes seguidos con un agente con el árbol sucio (41 ficheros) y corriendo
  suites ⇒ `husky - pre-push script failed` y espejo atrasado. El hook corre la suite entera por cada
  remoto y dos suites compitiendo por las mismas bases fallan (ver *Reglas de entorno medidas*).
- **Ninguna credencial en el código, tampoco en las specs.** Medido el 2026-10-07: **39 de 42** specs
  E2E construían su propio `PrismaClient` con el literal
  `postgresql://postgres:<password-local>@localhost:5432/erp_test` — la contraseña del `.env` local, que
  **no está versionado**. El CI usa `postgres`, así que `prepare-test-db.mjs` (que sí lee
  `E2E_DATABASE_URL`) conectaba y **las specs no**: 392 casos caídos por `Authentication failed`. Regla:
  las specs leen `process.env.DATABASE_URL` y **nunca** un literal con credenciales. Y como esa
  contraseña **sigue en la historia de git**, hay que **rotarla** (no basta con limpiar el código).
- **Declarar lo que no se midió** y los límites (flakes, datos ausentes, decisiones pendientes del
  usuario) en vez de taparlos. **Un entorno que nadie prueba es un gate que no existe.**
- **Una puerta tiene que comprobar el VALOR, no solo que el texto sea válido.** El 2026-10-08, al
  alinear `update-baselines.yml` con `ci.yml`, una sustitución dejó `node-version:` **sin valor** en los
  dos `setup-node` y el commit salió (`029f8447`, 08:52): el YAML **parsea** —medido con `yaml` 2.9.0:
  la clave existe y vale `null`—, así que el parseo dijo OK y el workflow **no fijaba Node alguno**.
  Corregido a `node-version-file: '.nvmrc'` cuatro minutos después (`424d7746`, aún sin empujar).
  **Ejecute el valor, no el documento.**
- **La prueba de borde se escribe ANTES y se ve en ROJO.** Los dos arreglos de la doble conversión de
  zona del 2026-10-08 llevan el caso escrito y **fallando con el código viejo** antes de tocar el
  código: Notas de Crédito (`9eabacab`) **2 failed / 50 passed** con la zona del proceso por defecto y
  **6 failed / 46 passed** con `TZ=UTC`; `pricing.util` (`e33b0b4c`) **1 failed / 61 passed** con la
  zona por defecto y **3 failed / 59 passed** con `TZ=UTC`. Un test que nunca ha estado en rojo no es
  un gate. Y los **dos signos** del desplazamiento van puestos (tenant detrás y tenant delante) para
  que algo sea rojo en **cualquier** zona de proceso.
- **Al arreglar algo compartido, barra TODOS los sitios de la misma expresión.**
  `startOfTenantDay(nowInTenantTimeZone(tz), tz)` estaba en los **4** llamadores de Notas de Crédito
  (`9eabacab`), luego en `pricing.util.ts:362` (`e33b0b4c`) — y ese commit **declaró 7 sitios más** con
  la misma expresión: `alerts.service.ts` ×4 (341-344, 373-376, 401-404, 448-451),
  `reports.service.ts:694-697` y el precio de línea en `sale-invoices.service.ts:4952-4955` y
  `sale-reserve-invoices.service.ts:5215-5218`. El barrido va **un commit por sitio** (T258:
  `76688c98` avisos ×4, `95fa7edf` aging). Arreglar el útil **no** cierra la familia.
- **Un workflow que nunca se ejecuta es un workflow que nadie sabe si funciona.**
  `update-baselines.yml` es solo `workflow_dispatch` y **no había corrido nunca**: su primer run murió
  en `Install dependencies` con `npm ci`/`EUSAGE` (`Missing: chokidar@4.0.3`) porque fijaba **Node 22**
  y el lock se regeneró con node:24 ⇒ `node-version-file: '.nvmrc'` (`424d7746`, el run verde; el
  commit roto es `029f8447`). Es hermana de «un script que no arranca es un gate que no existe». Ese
  mismo día, `ci.yml` tampoco tenía `workflow_dispatch` (`1d7b0e03`): «hacer el CI» exigía empujar y
  pagar el pre-push entero para ver un run.

- **Al migrar el ÍNDICE de un ratchet, el orden es: quitar la sonda → congelar el formato → sondear →
  quitar la sonda.** Regenerar la línea base **con la sonda dentro del árbol** hace que el índice
  viejo (`file:line`) no case con las claves nuevas y **TODO** aparezca como `NUEVA`: medido en el
  gate del `!` con un rojo intermedio de **1586** cuando la aserción de verdad era **una**, y en
  `audit:explicit-any` con **230**. El arreglo lleva las **dos** mitades: índice por **CONTENIDO**
  (`fichero::fragmento normalizado`) **y** lo que **DESAPARECE también se lista** al bajar (hasta 40),
  porque un informe que solo habla cuando empeora obliga a creerse la resta. Límite declarado: dos
  hallazgos idénticos en el mismo fichero comparten clave (inocuo para la **CUENTA**, que es lo que
  bloquea; afecta solo a la lista de sitios). La cuenta **no se movió**: `1585 = 1585` y `229 = 229`
  (`backend-erp`: `112a04c7`; su hermano `dca02341` aplica el mismo arreglo al segundo gate y
  comprueba el tercero —`audit-spec-clock` **no** lo tiene, porque su base no guarda `findings`—).
- **El delta por commit lo da el INSTRUMENTO, no la aritmética de quien migra.** Cuando la migración
  toca varios ficheros y va **un commit por fichero**, los otros se apartan para que el commit lleve
  **su** delta y no el de la tanda: `git stash push -- <fichero>` → `--check` → `--update-baseline` →
  commit → `git stash pop` (`backend-erp`, lote 1 de los ayudantes de fecha: `7418d513`, `82e67568`,
  `e1bd8bab`, `acf265e0`).
- **`--check` y `--update-baseline` son DOS pasos, y el segundo es el que deja el commit
  reproducible.** `8f944748` (`sales-orders`) corrió `--check` y **se olvidó** `--update-baseline`: la
  base quedó en **1524** con la cuenta real en **1521**, el gate **no falló** (bajar da verde) y la
  deuda dejó de estar congelada en su cifra. Hubo que congelarla en un commit aparte —`56770484`,
  `1524 → 1521`, **sin tocar una línea de código**—. Sin el segundo paso el delta **se pierde aunque
  el commit lo anuncie**.
- **La cifra global puede BAJAR mientras un fichero se queda sin migrar: la defensa es el delta por
  fichero, no el total.** Medido en `document-utils.ts`, donde la variable de zona se llama
  `timeZone` y no `settings.timeZone`: un `sed` por texto habría dejado sus **4** sitios sin migrar
  **y el contador habría bajado igual**, porque la cifra global la mueven los demás (`backend-erp`,
  `17897c18`; el mismo patrón en `2ef7d1b9`). Y el **censo por `!` nunca es el mapa del fichero**:
  `sale-reserve-invoices` **7** en el censo frente a **15** llamadas, `delivery-orders` **7** frente a
  **24**, `purchase-receipts` **5** frente a **6** (`7418d513`, `36b33ad7`, `e1bd8bab`).
- **Una herramienta que no encuentra lo que busca debe GRITAR, no callar.** El transformador de la
  migración tocaba el `import` solo cuando **no** quedaban llamadas al ayudante viejo; en tres
  ficheros sí quedaba una (con guarda), así que decidía «no hacía falta»… **y no hacía nada**, dejando
  `fromTenantDay` sin importar en **12** líneas. Lo cazó `typecheck:all`, y el agujero se arregló **en
  la herramienta**: amplía el import o dice `NO SE PUDO AÑADIR (revisar a mano)`, y cuando no
  sustituye nada avisa `⚠️ NINGUN SITIO SUSTITUIDO: ¿forma distinta? REVISAR` (`backend-erp`,
  `4cfd1c11`).
- **`typecheck:all` POR FICHERO: el delta del ratchet y el `eslint` por fichero NO bastan.** En el
  caso anterior, los tres ficheros con el import roto daban `eslint --max-warnings=0` **0** —es un
  error de **TIPO**, y `no-undef` no cubre un identificador de TypeScript— y el ratchet del `!` **bajó
  correctamente** (una importación no cambia el número de aserciones): **solo lo vio `typecheck:all`**.
  Desde ese hallazgo va **por fichero y no por tanda**: ~40 s más por commit a cambio de que ningún
  commit quede con un nombre que no existe (`backend-erp`, `d7fe712d`). Aplica a **cualquier** cambio,
  no solo a una migración.
- **Una herramienta puede hacer BIEN su tarea sobre el CONJUNTO EQUIVOCADO, y ningún gate lo verá:
  compruebe el ALCANCE antes de dejarla correr.** `audit:date-class` daba **0 hallazgos** mientras tres
  sitios leían mal `Batch.expiryDate`/`manufactureDate`, porque **no estaban en el registro
  `COLUMNS`**; declararlas subió las apariciones vigiladas **1345 → 1366** y el «0» pasó a ser cierto
  sobre el esquema y no sobre lo declarado (`backend-erp`, `017e46f9`, sobre el gate de `819cc493`).
  Desde el otro lado, la misma lección: en la migración de fechas el ratchet del `!` «hacía bien su
  trabajo; su trabajo no era este» (`4cfd1c11`). Aplica a **cualquier** cambio.
- **El instrumento que MIDE y el instrumento que ACTÚA tienen que tener el mismo ALCANCE.** Un censo
  orientado a líneas (`rg`) y un ejecutor con AST/JS no ven lo mismo, así que **el censo será una cota
  inferior**. Caso medido, en `AUDIT.md` **T126** (2026-09-14): el escáner del gate de dinero no veía
  los redondeos **multilínea** —`Math.round(` en una línea, la expresión con `* 100,` en la siguiente,
  `) / 100` en la tercera— y el **0** con el que se declaró cerrada R2b era un **artefacto de
  medición**: el valor real era **54**. Ese mismo gate siguió publicando cotas inferiores —**R1 = 22**;
  **R2c = 14** frente a ~**19** reales— hasta que se arregló el detector (`10a298c0`, `30db7d37`). La
  lección de T126, literal: **una métrica en 0 solo vale si el detector está probado contra los casos
  difíciles.** Aplica a **cualquier** cambio.
- **Un gate que se puede APUNTAR a otro sitio (variable de entorno, argumento) es un gate que se puede
  burlar; la raíz se resuelve por el propio repositorio.** Caso medido: `--check --file` de
  `audit:collection-caps` salía **0 en silencio** diciendo «mejoró: produccionSinCota 687 → 32» —**el
  ratchet degradado a decoración**— y ahora declara que es un informe de fichero y no evalúa nada
  (`backend-erp`, `fe929d9f`). Por eso los **siete** ratchets de `backend-erp/scripts/audit-*.mjs`
  resuelven su raíz y su línea base por la ubicación del **propio script**
  (`repoRoot = path.resolve(__dirname, '..')`; `BASELINE = path.join(__dirname, …)`), nunca por `cwd`,
  por una variable de entorno ni por un argumento.
- **Un gate cuyo baseline vive junto al script se puede probar en ROJO fuera del repositorio, sin
  tocar el árbol.** `audit-workflow-inputs.mjs` y su `.declarations.json` se copiaron a **%TEMP%** en
  **tres** copias del árbol, cada una con **una** rotura —`node-version:` vacío, la `TZ` movida de
  `ssr-smoke` a `e2e`, `workflow_dispatch` quitado— ⇒ las tres con `exit 1`; y el árbol real de solo
  la raíz se reprodujo igual en `%TEMP%` para medir el antes/después de su modo informativo
  (`958cd66`; `aecda16`). Un gate que solo se puede probar rompiendo el repositorio no se prueba.
- **Un filtro que no casa no dice «no hay nada»: dice «no sé».** Compruebe que el filtro **puede**
  encontrar algo antes de creerse su cero. Caso medido: el `walk()` del gate `audit:spec-clock`
  filtraba `/\.spec\.ts$/`, que **no casa con `*.e2e-spec.ts`**, así que **reproducía exactamente el
  agujero de ámbito que venía a arreglar** y su primer rojo dijo **6** en vez de **25**; el gate nace
  con una fijación en su autoprueba para que no vuelva (`backend-erp`, `5169e9df`). Hermana de «una
  métrica en 0 solo vale si el detector está probado contra los casos difíciles».

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
PORT=3000                  # el API escucha en 3000: el .env no define PORT y main.ts cae a 3000
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
| **Parte 1 — Registro** | **134 entradas** fechadas, la más reciente primero (2026-10-07 → 2026-09-18), con índice |
| **Anexo A** | Estado real del proyecto (2026-09-12): la evidencia medida de cada comando |
| **Anexo B** | Sistema ShortName: cuentas asociadas y trazabilidad en asientos |
| **Anexo C** | Próximos pasos recomendados (2026-09-08), lista fechada |
| **Anexo D** | Comandos detallados de los tres proyectos, git hooks y **reglas medidas de entorno** |
| **Anexo E** | Índice de documentación adicional completo (22 filas) |
| **Anexo F** | Visión general del proyecto y stack tecnológico (íntegros) |
| **Verificación y pendiente** | La prueba de que no se perdió nada y lo que queda **por decidir** |

**Cuándo consultarlo:** para saber **por qué** algo está como está, qué se midió y con qué comando, qué
decisiones tomó el usuario y qué quedó declarado. Es la memoria del proyecto; este archivo es el manual
de trabajo. **`§2 Stack` del Anexo F tiene versiones desactualizadas**: ver «Pendiente de revisar».