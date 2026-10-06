# Plan — Backend: PostgreSQL 18, NestJS 12 y Prisma 7

> Estado a **2026-10-05**. Este documento existe porque el examen previo (medido, no supuesto)
> estimó el salto de NestJS en **1-2 días** y la ejecución encontró **un bloqueo que el examen no
> podía ver** (§3.2). Todo lo que sigue está medido en esta máquina, no deducido.

---

## 1. Lo que ya está HECHO y verificado

### E0 — Herramientas de PostgreSQL (el riesgo latente, ajeno a cualquier actualización)

`backend-erp/scripts/db-utils.js` resolvía `pg_dump`/`pg_restore`/`psql` listando
`C:\Program Files\PostgreSQL\*` con un `.sort()` **lexicográfico** y devolviendo **el primero que
existiera**: con el servidor en 17/18 habría elegido los binarios de la **16** y
`npm run backup:db` / `restore:db` —la **vía de rollback** del runbook— habrían fallado por
desajuste de versión justo cuando se necesitan. En esta máquina acertaba **por suerte** (hay 16 y 18).

**Arreglado** (commit `6cb1302a`): se pregunta al servidor su `server_version_num` con cualquier
`psql` y se usan las herramientas de **esa misma mayor**; si no están, la más nueva que sea ≥ (con
aviso); y si **todas** son más viejas, **falla nombrando el desajuste**. `--self-test` **7/7**
(incluye el caso que era el defecto y el fallo ruidoso) enganchado al `pre-push` como
`npm run audit:pg-tools:self-test`.

### E1 — Node declarado

El backend **no declaraba nada**. `engines: ^22.22.3 || >=24.15.0` + `.nvmrc 24.21.0` (commit
`d315155b`). Es el suelo de las **herramientas** del CLI de Nest: la app corre con menos, así que el
Dockerfile (`node:22-slim`) sigue siendo válido. **En local**: `nvm install 24.21.0` + `nvm use 24.21.0`.

### E4 — PostgreSQL 16.6 → 18.3 (HECHO y verificado por cuatro vías)

- **11 bases** movidas (no solo el ERP: `erp_db`, `erp_db_shadow`, `erp_test`, `erp_k6` y las **6** de
  otros proyectos que vivían en el mismo cluster ⇒ desinstalar la 16 no pierde nada).
- **Trampa medida**: el cluster del 18 venía con `Spanish_Mexico.1252` y el del 16 con
  `Spanish_Spain.1252` ⇒ cada base se creó con la **collation del origen** (`TEMPLATE template0`) o el
  orden de los textos habría cambiado. El `erp_db` que ya existía en el 18 se **renombró**
  (`erp_db_18_previo`), no se borró.
- **Verificación por contenido** con la misma huella que usa el arnés E2E del frontend:
  **199 tablas** y **todas** con el mismo número de filas (**3 072**), `_prisma_migrations` con
  **md5 idéntico**, y `prisma migrate status` → **«up to date»** (84 migraciones).
- **Y por la aplicación**: suite del backend **233 suites / 3038 casos** en verde, arnés E2E del
  frontend **15/15** con **huella idéntica** (`6186e925c79f`), y el ORM leyendo
  `PostgreSQL 18.3 · items=137 · partners=14 · users=3 · 236 tablas`.
- **Puerto**: `ALTER SYSTEM SET port = 5432` en el 18 + servicio de la 16 parado y en **manual** ⇒
  **el `.env` no se toca**. El `PATH` de usuario incluye ya el `bin` de la 18.
- **Producción (Railway) NO tocada**: el procedimiento está en el **§10 del runbook**, cuyo paso 0 es
  un **backup verificado** (hoy no consta ninguno: `railway run` no llega al host privado).

---

## 2. Riesgo asumido al desinstalar la 16

Los volcados de la migración quedan en `%USERPROFILE%\pg-backup-16-pre-migracion` (**10** ficheros,
8,5 MB) y las 11 bases viven en el 18. `adminpack` existía en el cluster de la 16 y **no** en el de la
18: el ERP **no lo usa** (0 referencias en `src`/`prisma`/`scripts`).

---

## 3. E3 — NestJS 11.1.23 → 12.1.2 (**HECHO y verificado**, 2026-10-06)

> **Resultado**: los **seis** criterios de aceptación en verde, y la app **sigue en CJS**: solo el
> pipeline de **test** pasa a ESM. Rama local `feat/nestjs-12` (nunca empujada), por delante de `main`.
>
> | Criterio | Medición |
> |---|---|
> | `npm run typecheck` | **0 errores** (63,3 s) — eran **401** `TS2349` |
> | `npm run lint:ci` | **0 errores / 7 avisos** (el baseline de `main`, sin avisos nuevos) |
> | `npm test` | **234 suites / 3048 casos, 0 fallos** (8,2 min, pipeline **ESM**) — antes 233/3038 |
> | `npm run build` | **0 errores**, `dist/main.js` 4,3 KB |
> | Integración | `/health` **200**, **contrato de error vivo** (`code: UNAUTHORIZED` + `requestId`) y humo del frontend **15/15** (2,1 min) con la huella de la base **idéntica** |
> | OpenAPI | **IDÉNTICO** a la línea base: **645 rutas / 869 operaciones / 402 esquemas / 8 610 propiedades** ⇒ el plugin de Swagger del CLI sobrevive al salto |
> | **E2E del backend** | **41 suites / 398 casos, 0 fallos** (29,5 min) |
>
> **Cómo se resolvió cada bloqueo** (los dos que el examen no podía ver):
> 1. **Jest + paquetes ESM-only** ⇒ el pipeline de test pasa a ESM: `tsconfig.spec.json` con
>    `module: esnext` + `moduleResolution: bundler`, los scripts `test`/`test:watch`/`test:cov` con
>    `node --experimental-vm-modules --max-old-space-size=6144`, más una **infraestructura de test nueva**
>    (`src/testing/esm-globals.setup.ts`, `esm-paths.ts`, `jest-globals.ts`, `jest.d.ts`) que aporta los
>    globals de Jest y la resolución de rutas que en ESM ya no vienen puestos.
> 2. **Los 401 `TS2349`** (llamar a un `import * as`) ⇒ migración mecánica de los imports de supertest a
>    forma por defecto en **226 ficheros de specs** (+1 481 / −2 032 líneas).
>
> **Declarado:**
> - `--experimental-vm-modules` es una bandera **experimental** de Node y ahora viaja en **cada**
>   ejecución de tests: hay que vigilar que siga viva en las próximas versiones.
> - La suite unitaria tarda **8,2 min** (antes ~3,4): es el precio medido del pipeline ESM.
> - **Corte de luz a mitad de faena**: el trabajo quedó **sin commitear** (226 ficheros) y con
>   `node_modules` a medias (`@nestjs/core` sin instalar). Se recuperó **commiteando el checkpoint antes
>   de tocar nada**, borrando su carpeta temporal `.tmp-spike/`, añadiendo su infraestructura ESM y
>   reinstalando; después se midieron los seis criterios **otra vez y por mí**.
> - **Falso negativo de medición** (mío): `require('@nestjs/core/package.json')` falla con los paquetes
>   ESM porque su mapa de `exports` no publica `./package.json`; leído del disco, las versiones 12
>   estaban correctas.
> - **E2E del backend**: **41 suites / 398 casos, 0 fallos** (29,5 min) ⇒ el séptimo criterio también en
>   verde. **No salió a la primera**, y los dos motivos merecen quedar escritos: **(1)** el pipeline E2E
>   (`test/jest-e2e.json`) se había quedado sin el tratamiento ESM (40 de 41 suites **no arrancaban**) ⇒ se
>   trasladó lo mismo del unitario (`extensionsToTreatAsEsm`, `useESM: true`, `tsconfig.e2e.json` en
>   `esnext`, `--experimental-vm-modules`); **(2)** un bloqueo **de terceros** que el plan no podía prever:
>   `@nestjs/throttler` **no tiene versión 12** —6.7.1 es la última y sus *peers* ya aceptan `^12`— y su
>   `dist` es **CommonJS** (`"use strict"` + `require("@nestjs/common")`) mientras el resto de la familia es
>   ESM ⇒ `Cannot require() ES Module … being loaded by a concurrent import()`. Se cierra con un
>   `setupFiles` que **precarga** `@nestjs/common` y `@nestjs/core`
>   (`test/setup-e2e-preload.ts`, con el porqué y la nota de que sobra el día que el throttler publique ESM).

### 3.1 Historia: lo que se hizo antes del cierre

- Familia a 12 en un solo movimiento (equivalente a `nest upgrade`, con las versiones a la vista):
  `@nestjs/core|common|platform-express|testing@^12.1.2`, `config@^12.0.1`, `jwt@^12.0.2`,
  `mapped-types|passport@^12.0.0`, `schedule|swagger@^12.0.2`, `terminus@^12.1.0`,
  `throttler@^6.7.1` (no hay 12), `cli@^12.0.8`, `schematics@^12.0.6`.
- **TS 6.0.3** y **typescript-eslint 8.71.1** — el mismo obstáculo que hizo fracasar el `ng update` de
  Angular: el `typescript-eslint` instalado era **8.59.4** y TS 6 necesita **8.71.x**.
- **El único fichero de producto** que el salto obliga a tocar: `src/monitoring/health/prisma.health-indicator.ts`
  (v12 retiró `HealthIndicator` y `HealthCheckError` ⇒ se inyecta `HealthIndicatorService` y el
  resultado se **devuelve** con `check(key).up()` / `.down(data)` en vez de **lanzarse**), más su spec
  (que afirmaba el `throw`). El `health.controller.ts` **no** cambia: `pingCheck` sigue devolviendo el
  resultado.
- `tsconfig.json` **no tiene `baseUrl` ni `paths`** (la rotura que TS 6 causó en el frontend no aplica).

### 3.2 El bloqueo que el examen no podía ver: **NestJS 12 es ESM puro y Jest no lo carga**

Medido, con la traza exacta:

```
Details: node_modules/@nestjs/terminus/dist/index.js:1
  export { TerminusModule } from './terminus.module.js';
  SyntaxError: Unexpected token 'export'
```

`@nestjs/terminus` (y el resto de la familia 12) es `"type": "module"` **sin build CJS**. Node 22+
lo salva en runtime con `require(esm)`, pero **el registro de módulos de Jest no es el de Node**.

**La vía barata NO existe** — probada y descartada: añadir
`transformIgnorePatterns: ["node_modules/(?!(@nestjs)/)"]` + `allowJs` hace que Jest **sí** transforme
`@nestjs/*`, y el fallo se mueve un nivel más adentro:

```
Details: node_modules/@nestjs/common/utils/load-package.util.js:84
  SyntaxError: Cannot use 'import.meta' outside a module
```

`import.meta` **no tiene equivalente en CommonJS**: transformar a CJS no puede funcionar. (El
experimento se revirtió; el árbol no lo conserva.)

**Lo que hace falta** (estimación honesta: **1-2 días**, ahora con la superficie medida):

1. **Pipeline de test a ESM**: `NODE_OPTIONS=--experimental-vm-modules` en el script `test`,
   `extensionsToTreatAsEsm: ['.ts']`, `ts-jest` con `useESM: true` y el `tsconfig.spec.json` a
   `module: nodenext`/`esnext` (el **build de la app puede seguir en CJS**: `nest build` usa
   `tsconfig.build.json`, así que el cambio se puede acotar a los tests).
2. **`jest.mock` → `jest.unstable_mockModule`**: **25 apariciones en 10 ficheros** (medido) — es
   *módulo* mocking, y en ESM exige el API inestable más `await import()`. `jest.spyOn`
   (37 en 15 ficheros) **no** se ve afectado.
3. **TS 6: no se puede llamar a un `import * as`** ⇒ **401 `TS2349`**, **todos** del mismo patrón:
   `request(app.getHttpServer())` en los specs E2E (**41** ficheros con `import * as request`) y
   `cookieParser()` en `src/main.ts:36`. `esModuleInterop: true` **ya está puesto y no los arregla**:
   hay que cambiar los imports a forma por defecto (`import request from 'supertest'`).
   Ojo: el proyecto de `src/` (la suite unitaria) tiene **1** solo error; los **400** están en
   `test/**` (los E2E).
4. Después: los gates completos (`tsc` de los dos proyectos con **6 GB** de heap —sin ellos muere por
   OOM—, `eslint`, `npm test` 233 suites, `nest build`, `test:e2e`) más el humo del frontend y la
   comparación del documento **OpenAPI** (línea base capturada: **645 rutas, 869 operaciones, 402
   esquemas, 8 610 propiedades**, 926,4 KB ⇒ el plugin de Swagger del CLI es un transformador de
   build y hay que comprobar que no cambia la salida).

---

## 4. E5 — Prisma 6.19.3 → 7.10.0 (**spike HECHO**: mecánico y acotado, 2,5–4 días)

> **Spike medido el 2026-10-06** en una carpeta aparte (`C:\Users\jdiaz\prisma7-spike`, con su
> `INFORME.md` y `evidence/`, y una baseline v6 en `C:\Users\jdiaz\prisma6-baseline`). El repo **no** se
> tocó y a la base solo se le hicieron `SELECT`.

### 4.1 La pregunta que decidía todo: **SÍ funciona desde CommonJS**

**No hay que migrar la app a ESM.** `@prisma/client@7.10.0` y `@prisma/adapter-pg@7.10.0` son **dobles**
(`require` → CJS, `import` → `.mjs`) y el cliente **generado no contiene `import.meta` ni `__dirname`**
(0 coincidencias). Medido: un `probe.cjs` con `require` y el cliente compilado con **nuestro**
`tsconfig.json` (commonjs) lee la base real — `SELECT 1`, `item.count() = 137`, `partner.count() = 14`,
PostgreSQL 18.3, `Prisma.Decimal` OK — con `tsc` **0 errores**. La premisa «v7 obliga a ESM» es
**configuración, no runtime**.

### 4.2 La trampa que no hay que pisar

La pareja «prudente» `moduleFormat="cjs"` + `importFileExtension="js"` compila a CJS y el `probe.cjs`
funciona… **pero rompe la suite ESM** (`Cannot find module './internal/class.js'`: `jest-resolve` no mapea
`.js` → `.ts`). **La única configuración que pasa las dos tuberías es dejar el `generator` con SOLO
`provider` + `output`** (la inferencia lee `tsconfig.json` y emite imports sin extensión): build CJS
**0 errores** y `jest` ESM **3/3** con el mismo directorio generado. Sin `tsconfig.json`, la inferencia
cae a ESM y **no compila** en CJS.

### 4.3 El pool: una regresión silenciosa que hay que compensar

El adapter **no añade defaults** (delega en `pg.Pool`). Medido con `pg_stat_activity` como observador
externo sobre la misma URL: v6 con `connection_limit=50` → **50** · v6 sin él → **21** · **v7 con
`connection_limit=50` → 10** · v7 `max:50` → **50** · v7 `max:5` → 5. O sea: **el `connection_limit`
deja de aplicar y el pool cae a 10 sin avisar**; además `idleTimeoutMillis` pasa de 300 s a **10 s** y
`connectionTimeoutMillis` se queda **sin timeout** (v6: 5 s). Equivalente exacto:
`new PrismaPg({ connectionString, max: 50, connectionTimeoutMillis: 5000, idleTimeoutMillis: 300000 })`.

### 4.4 Lo demás, medido

- **363 líneas de import en 362 ficheros** son **obligatorias** (`require('@prisma/client')` →
  `MODULE_NOT_FOUND`: v7 no genera en `node_modules`). `new PrismaClient(` **71** — **0** en `src/`: el
  producto solo tiene `src/prisma/prisma.service.ts:13 extends PrismaClient`—, **40** `datasources:`,
  `Prisma.Decimal` **2 170**, `$queryRaw` 201, `$executeRaw` 80, `$transaction` 284, `Prisma.sql` 128.
- **Dónde va el generado no es cosmético**: son **205 ficheros / 79,2 MB de TypeScript** que compila la
  app. En `src/generated/prisma` compila con el tsconfig **sin tocarlo** (+22-24 s de build, +17 s de
  typecheck); en la colocación que hoy insinúa el repo (`/generated/prisma` en `.gitignore` y
  `tsconfig.build.json` excluyendo `generated`) **el cliente no se compila nunca** y `dist` sale sin él.
- **Tres flags eliminados** (no uno): `db push --skip-generate` (`scripts/prepare-test-db.mjs:32`) **y**
  `migrate reset --skip-seed` ⇒ **`db:recreate` y `reset:core` rompen tal cual** ⇒ hay que quitarlos.
- `prisma.config.ts` **necesita** el bloque `datasource` (sin él, `db push` falla directamente); **no**
  hace falta `"type": "module"` para que el CLI lo cargue y `process.env` **gana** sobre el `.env`.
- **`npx prisma migrate status` con el CLI 7 contra `erp_db`**: `84 migrations found` /
  `Database schema is up to date!` ✓.
- **Pin confirmado**: `latest = 8.0.0-rc.20` (un RC) y `prev = 7.10.0` ⇒ instalar **`prisma@7.10.0`
  exacto**.

### 4.5 Veredicto, esfuerzo y lo que queda sin medir

**Mecánico y acotado: 2,5–4 días** (0,5 andamiaje/scripts · 0,5–1 imports · 0,5–1 adapter · 0,5 tuberías
· 1 gates y despliegue). Lo que se paga es **volumen repetido**, más las tuberías que ahora ven 205
ficheros nuevos (cobertura —medido: el generado entra en la tabla y la corrida pasa de 13 s a 62-68 s—,
`eslint`, `prettier`, `lint-staged`, `.gitignore`, Docker +78 MB).

**No medible sin el OK del usuario** (declarado, no inventado): el **SSL contra Railway** (v7 delega el
TLS en `node-pg`, que valida el certificado ⇒ riesgo `P1010`/self-signed; se prueba **en producción**), la
`DATABASE_URL` de producción, y el coste de `tsc` sobre las 1 141 fuentes con el generado dentro.

---

## 4bis. Lo que decía el plan antes del spike (histórico)

Lo medido por el examen, que sigue vigente: es un **salto de plataforma** con **363 imports** que
cambian de ruta, `provider`/`output` obligatorios, *driver adapter* (`@prisma/adapter-pg` + `pg`)
obligatorio, el pool cambia de dueño (`connection_limit` deja de aplicar), **379** llamadas de SQL
crudo y **2 166** `Prisma.Decimal`. **Spike obligatorio antes de comprometerse**: (a) ¿funciona desde
CJS con `require(esm)` o hay que migrar el backend a ESM?; (b) adapter + pool equivalente a
`connection_limit=50`; (c) **SSL contra Railway** (`node-pg` valida el certificado; puede dar `P1010`).
Y el pin **exacto**: `prisma@7.10.0`, **nunca `@latest`** (el dist-tag `latest` del CLI apunta a un
**release candidate 8.0.0-rc**).

---

## 5. E6 — Producción

`start-prod.sh` aplica `prisma migrate deploy` + los SQL manuales **en cada arranque del contenedor**
⇒ cualquier cambio de esquema se aplica solo al desplegar: **ventana de mantenimiento** y **backup
verificado antes**. No hay *down-migrations*.
