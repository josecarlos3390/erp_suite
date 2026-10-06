# Evaluación — `github.com/amirtaherkhani/nestjs-skills` contra `backend-erp`

> Evaluado el **2026-10-05**, con el repositorio remoto **leído de verdad** (clon superficial,
> 140 ficheros) y nuestro código medido con `git grep … main` / `git show main:<fichero>`.
> Estado de referencia: `backend-erp` `main` = **`0a065579`** (la rama `spike/nestjs-12` solo añade
> 13 líneas y 4 ficheros, así que ninguna cifra cambia).
> **Nada modificado, nada commiteado, ninguna base tocada.**

---

## 1. Qué es el repositorio (medido)

| Dato | Valor |
|---|---|
| Skills / referencias | **7** / **42** ficheros, **193,2 KB**, **26 465 palabras**; los `SKILL.md` suman **72,2 KB** |
| Autores / estrellas / forks | **1** (en los últimos 30 commits) / **8** / **2** |
| Licencia · CI | **MIT** · `validate.yml` (`npm ci` + `npm test` en Node 22) + guardas de conflicto en las 7 skills |
| Creado / último push | 2026-07-20 / **2026-10-05** (activo); releases v2.0.0 → **v2.2.0 (2026-10-04)** |
| Versión de NestJS que asume | **Ninguna** (0 menciones de `NestJS <n>`); su propia verificación corre sobre **NestJS 11.2.7 + TS 5.9.3** |
| ORM | TypeORM ×3, **Prisma ×1** (un enlace), PostgreSQL ×0, multi-tenant ×0 |
| Señales débiles | **0 de 6** corridas de su piloto de evaluación completadas (lo declara él mismo); *mojibake* en el CHANGELOG; URLs de release con el nombre viejo del repo |

**Su honestidad, citada**: *«Completed agent runs: 0 of 6. … No agent behavior grade, speed/cost
comparison, or token-savings claim is justified.»*

---

## 2. La diferencia con las skills de Angular: no es «otra versión», es **version-agnostic**

Las de Angular estaban clavadas en v21/v22 y casi todo **no aplicaba**. Estas **no declaran versión**
y remiten a la documentación de la instalada ⇒ **casi todo aplica**, lo que las hace **más peligrosas
de adoptar en bloque**. Lo que **no** dicen, medido sobre 265 KB de guía:

| Patrón | Menciones |
|---|---|
| `import.meta` · `nodenext` · `experimental-vm-modules` · `CommonJS` · `require(esm)` | **0 · 0 · 0 · 0 · 0** |
| `ESM` | **1** |

⇒ **No nos habría advertido del bloqueo real de la migración a NestJS 12** (los paquetes son ESM puro
y Jest no los carga: `Unexpected token 'export'` → `Cannot use 'import.meta' outside a module`; ver
`plan-backend-nestjs-12-prisma-7.md` §3.2). Donde sí acierta es en el **método** (escalera de
evidencia: convención del repo → tipos instalados → docs de la versión → experimento mínimo).

---

## 3. Lo que **sí** hay que llevarse, con lo que midió de nuestro código

### 3.1 ⭐ El contrato de error — el hallazgo más caro

| Medición en `main` | Cifra |
|---|---|
| Filtros de excepción propios (`@Catch`/`ExceptionFilter`/`@UseFilters`/`APP_FILTER`) | **0** |
| Providers globales que sí existen | **9 `APP_GUARD` + 3 `APP_INTERCEPTOR`**, 0 filtros (`src/app.module.ts:294-309`) |
| `HttpException` lanzadas desde servicios | **1 855** en 168 ficheros (`BadRequest` 1 233, `NotFound` 460, `Conflict` 116…) |
| `throw new Error(` crudo | **42** en 19 ficheros (15 en el motor contable) |
| El **frontend lee el texto** (`err?.error?.message`) | **40 sitios en 24 ficheros** |
| Identificador de correlación en logs | **0** (las 3 coincidencias son una variable local que no es un id de petición) |

**Lectura honesta**: no hay fuga de información y para una API solo-HTTP la propia skill llama
*«pragmatic»* a usar `HttpException` ⇒ **no hay que reescribir 1 855 throws**. Falta **una pieza**: un
filtro global que asigne **código estable**, añada un **id de ocurrencia** y registre **una vez** lo
desconocido. Hoy **la cadena de mensajes es el contrato**: cualquiera de esos **40** sitios se rompe si
cambia una frase, y **ningún gate lo vería**.

### 3.2 ⭐ Configuración: `@nestjs/config` cargado y **85 `process.env`** a pelo

`ConfigModule.forRoot({ isGlobal: true })` está puesto (`src/app.module.ts:145`), pero
`process.env` aparece **85 veces en 19 ficheros** (13 de producto) frente a **10 `ConfigService` en 4**.
El *fail-fast* de arranque exige **solo `JWT_SECRET`** (`src/main.ts:22-30`).
Ejemplos: `src/mail/mail.service.ts:49,65`, `src/monitoring/health/health.controller.ts:24,28`,
`src/common/r2-config.util.ts`, `src/auth/super-admin-auth.controller.ts`.
**Es mecánico** (el mecanismo ya está cableado en 2 módulos) ⇒ buena relación valor/esfuerzo.

### 3.3 Cotas: **698 `findMany` sin `take`/`skip`/`cursor` a la vista** (de 779, el 89,6 %)

⚠️ Es un **heurístico por ventana de texto**: no distingue un maestro pequeño de una tabla de
documentos grande ⇒ **es una cota superior del riesgo, no 698 defectos**. Lo bueno medido: existe
pieza única `src/common/paginated-result.ts` y `parsePagination` **acota `limit ≤ 100`**. El hueco no
es «no sabemos paginar», es que **no es obligatorio**.

### 3.4 Transacciones: la skill **nos da la razón** (y hay dos cosas que declarar)

`$transaction` **346** en 115 ficheros · `Prisma.TransactionClient` **554** en 103 ⇒ cumplimos
literalmente la regla del *cliente transaccional explícito*. Outbox/UoW: **0** (correcto: no hay colas
ni eventos durables; la consistencia se resuelve **por compensación**, ya declarado).
**A declarar, no a rediseñar**: (a) `start-prod.sh` aplica `migrate deploy` **y** los SQL manuales en
**cada arranque** ⇒ conviene **comprobar** que el runner manual toma lock frente a réplicas
concurrentes (chequeo de minutos); (b) `_manual_migrations` **no contradice** a la skill: es una
migración versionada y revisada, solo escrita a mano.

### 3.5 Multitenencia: ya la tenemos por dos vías

`tenantId` **11 952** en **473** ficheros · extensión defensiva `src/prisma/tenant-isolation.extension.ts`
(**416** líneas) · contexto por `AsyncLocalStorage` (4 referencias) · auditoría propia
(`src/security/tenant-isolation.audit.spec.ts`) · carga k6 de multitenencia.
**Deuda real: la cobertura cross-tenant es ancha pero fina** (37 ficheros, en su mayoría **1 caso por
servicio**), y la skill pide explícitamente probar *«not only anonymous access»*.

### 3.6 Tests: el único punto que ya cumplimos **con su misma letra** (233 specs)

148 con `Test.createTestingModule` · 6 con construcción directa · **79** de utilidad pura · **0**
`new XService(` en código de producción (las 11 ocurrencias están en specs) · 41 `.e2e-spec.ts`.
⇒ **Cero acción.**

### 3.7 Observabilidad y operación

A favor: Prometheus + Terminus + `enableShutdownHooks()` + `console.*` **= 0** en `src`.
Huecos medidos: **0 identificadores de correlación**; **un solo** `/health` (sin liveness/readiness);
`onModuleDestroy` en **1** fichero; **5 `@Cron`** (`alerts`, `billing`, `fixed-assets`,
`tenant-metrics`, `storefront-maintenance`) **sin lock distribuido** (0 `advisory_lock`);
`ThrottlerModule` con límite **por plan de tenant** ✅ pero con el storage **en memoria** por defecto.

### 3.8 El propio flujo: el `pre-push` del backend **no corre `tsc` ni `eslint`**

Hoy ejecuta `audit:pg-tools:self-test` + `npm test` (`.husky/pre-push`). El frontend ya demostró el
principio con sus **12 auditorías** en `audit:ci`. La skill no aporta la idea, sí el **formato** del
informe (severidad, evidencia, impacto, remedio, validación, `Needs verification`, `Healthy patterns`)
y el colector **read-only** que se niega a correr `npm run`.
**Aviso medido**: su colector haría `tsc --noEmit` pelado y con **timeout de 120 s** ⇒ aquí **moriría
por OOM** (nuestro `tsc` necesita **6 GB** de heap) y el timeout es corto para 1036 ficheros.

---

## 4. Lo que **no** hay que adoptar (motivo medido)

| No adoptar | Motivo |
|---|---|
| Kubernetes (probes/drain/HPA) | **No hay Kubernetes**: Railway (contenedor) + Vercel |
| Microservicios | Un backend, un despliegue |
| Repository/puertos para todo | La skill lo declara **opcional** (`architecture-rules.md:45`) y ya usamos `PrismaService` directo (731 refs/304 ficheros) con la extensión de tenant encima |
| Unit of Work / outbox / colas / Saga | **0 usos**; consistencia por compensación |
| `Result` wrappers en todo | La skill **lo prohíbe** si el repo no tiene esa convención (`error-taxonomy-contracts.md:31`) |
| Reescribir los 1 855 throws | La skill lo llama *«pragmatic»* para API solo-HTTP |
| El cambio de rama automático de `feature-audit` | 3 remotos y árbol sucio habitual; la matriz de trazabilidad se puede tener sin `git switch` |
| El flujo de PRs de `git-commit-pr-message` | No abrimos PRs (push a 2 espejos + hooks + despliegue); sus reglas de seguridad ya están en nuestra práctica |
| `performance-diagnosis` como trabajo | **No hay problema de rendimiento medido** |
| El ejemplo de `@Global()` | Tenemos **6**; `users`, `exchange-rates` y `warehouse-restriction` son **capacidades de negocio**, no infraestructura ⇒ 3 candidatos a dejar de serlo (sin urgencia) |

---

## 5. Deuda NUESTRA priorizada

**Cambios pequeños (días):**
1. **Contrato de error mínimo viable** — un `APP_FILTER` único con `code` + `requestId` y **una** traza
   para lo desconocido, **sin** tocar los 1 855 throws; y los **40** sitios del frontend pasan a leer
   `code` con respaldo al texto. *Por qué primero*: es lo único donde **el contrato público puede
   romperse mañana sin que ningún gate lo vea**.
2. **`validateEnv()` completo + centralizar `process.env`** (13 ficheros de producto; `mail.service.ts`
   y `health.controller.ts` son los más rentables).
3. **`tsc --noEmit` y `eslint` en el `pre-push` del backend**, con el heap documentado (hay que crear el
   script: hoy no existe un `typecheck`).
4. **Lock de `apply-manual-migrations.mjs`** frente a réplicas concurrentes.
5. **`/health/live` y `/health/ready`** separados.

**Proyectos (semanas, decidir antes):**
6. **Cota obligatoria** en colecciones y auditoría de los 698 `findMany` (clasificar maestro vs documento).
7. **Correlación de petición** de punta a punta (logs + `X-Request-Id` + respuesta + métricas) y
   **cobertura cross-tenant sistemática**.
8. `@Global()` de negocio y configuración tipada por módulo (radio amplio, sin urgencia).
9. **Crons multi-réplica** (hoy 1 réplica en Railway ⇒ **decisión del usuario**, no deuda ciega).

---

## 6. Veredicto

Material **real, honesto y bien hecho** (MIT, CI propio, guardas, informe que **declara que no probó
nada**) pero **joven y de un solo autor** (8 estrellas, 1 mantenedor, 0/6 evaluaciones). Al ser
**version-agnostic casi todo aplica**, y eso obliga a filtrar por **medición propia**, no por
entusiasmo. **Lo que nos llevamos**: el contrato de error, la configuración centralizada, el checklist
de *production-readiness*, el formato de informe read-only y la regla de **no exigir repositorios donde
el ORM directo es más claro** (que además **nos absuelve** de una corrección equivocada).
**Lo que no**: Kubernetes, microservicios, outbox/UoW, `Result` wrappers, PRs y cualquier reescritura
de nuestras 1 855 excepciones, 346 transacciones o 152 `TestingModule`, que ya están alineados.

Y lo más importante: **el valor del ejercicio es lo que midió de nosotros** — **0 filtros frente a
1 855 excepciones**, **85 `process.env` frente a 4 `ConfigService`**, **698 `findMany` sin cota
visible**, **0 identificadores de correlación**, **5 `@Cron` sin lock**, **3 de 6 `@Global()` que son
negocio** y **un `pre-push` sin `tsc` ni `eslint`** mientras el frontend corre 12 auditorías.
