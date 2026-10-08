# Runbook de Go-Live — ERP Suite

> **Última actualización:** 2026-09-05.
> Procedimiento operativo de despliegue, verificación, alineación de datos y
> rollback para producción. Complementa `AGENTS.md` (estado del proyecto) y
> `AUDIT.md` (QA de go-live: baterías 18-28, seguridad, SSR).
>
> **Hosts actuales (2026-09-29):** backend en **Railway**, cuenta **`josekilla3390`**,
> proyecto `determined-recreation`, servicio `backend-erp` (repo `josekilla3390/backend-erp`,
> Dockerfile + entrypoint que migra solo; Postgres de Railway con red privada):
> **`https://backend-erp-production-5c3b.up.railway.app`** (dominio generado con
> `railway domain`; `GET /health` → **200**). Frontend en **Vercel**:
> **`https://erp-frontend-gules.vercel.app`** (es el valor de `FRONTEND_URL` del backend, o
> sea el CORS ya coincide). El frontend apunta al backend por la constante
> `erp-frontend/src/environments/environment.prod.ts` → `apiUrl` (Vercel **no** lee variables
> de entorno para esto: `npm run build` hornea esa constante), así que **cambiar de backend
> es cambiar esa línea y empujar**; verificado en el bundle desplegado
> (`chunk-IIIKBBAT.js` contiene el host nuevo). *(Histórico: hasta el 2026-09-29 el backend
> era `https://erp-backend-production-ae06.up.railway.app` en la cuenta
> `joseka3390-design`; quedó sirviendo **404** porque su servicio apuntaba al repo borrado
> `joseka3390-design/erp-backend` y estaba sin deployments. Y hasta la ronda 38 el deploy
> usaba ese repo como «copia»; ahora el espejo del backend es `josekilla3390/backend-erp`,
> remoto local `deploy`, y `origin` se quedó con un solo `pushurl`.)* El pipeline de SQL
> manuales incluye `20260825_sync_schema_drift.sql` (drift de schema idempotente) y, desde
> el 2026-09-29, el entrypoint los aplica con **`--best-effort`**: en una base ya sincronizada
> con `prisma db push` el primer archivo choca (`column "isIndexUnit" already exists`) y sin
> esa tolerancia el contenedor **moría antes de arrancar la API** (crash loop y 502).

---

## 1. Arquitectura desplegada

```
cliente HTTPS
   │
   ├─ erp-frontend (Angular 19 + SSR, puerto 4000)
   │    node dist/erp-frontend/server/server.mjs   (CommonEngine SSR)
   │    · sirve /browser (estático) + render server-side
   │    · headers: CSP, nosniff, X-Frame-Options DENY, Referrer-Policy, HSTS (prod)
   │
   └─ backend-erp (NestJS 11, puerto 3000)
        node dist/main.js   (start:prod)
        · API REST + Swagger /api
        · PostgreSQL (DATABASE_URL)
```

- **CORS:** en producción solo el origen de `FRONTEND_URL` (obligatorio si
  `NODE_ENV=production`).
- **Auth:** JWT en cookie HttpOnly + XSRF; `PermissionsGuard` (RBAC) +
  `TenantGuard` (multitenancy) globales.
- **SSR:** `ALLOWED_HOST` lista de hosts permitidos para el render
  (si falta, CommonEngine cae a CSR — no rompe pero pierde SSR).

---

## 2. Pre-requisitos

| Item | Detalle |
|------|---------|
| Node | v22+ (el repo se probó con Node 24) |
| PostgreSQL | 15+; DB dedicada (`erp_db`) + shadow (`erp_db_shadow`) en dev |
| TLS | HSTS se envía solo con `NODE_ENV=production` (HTTPS obligatorio) |
| DNS | dominio API + dominio app, apuntando al balanceador/reverse proxy |
| Env backend | `DATABASE_URL`, `SHADOW_DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `PORT`, `NODE_ENV=production`, `THROTTLE_*`, `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD_HASH`, `BULK_IMPORT_SAFE_MODE` |
| Env frontend | `PORT` (4000), `ALLOWED_HOST`, `NODE_ENV=production`; `connect-src` de la CSP apunta al API (en prod: el host real del API; en dev, `http://localhost:3000`) |

> ⚠️ **Drift de BD conocido:** desde 2026-08-16 los cambios de schema se
> aplicaron con SQL manuales en `backend-erp/prisma/manual/` (`prisma db execute`)
> porque la BD tiene drift preexistente vs `prisma/migrations` (impide
> `migrate dev`/`db push` sin reset — ver ROADMAP DT.45). **El procedimiento de
> migración en prod DEBE incluir los SQL manuales** (§4.2).

---

## 3. Despliegue del backend

```bash
cd backend-erp

# 1. Dependencias + generación de Prisma (postinstall hace prisma generate)
npm ci            # o npm install

# 2. Compilar
npm run build     # → dist/  (0 errores)

# 3. Migraciones de schema
npx prisma migrate deploy        # aplica las 16 migraciones de prisma/migrations

# 4. ⚠️ SQL manuales (drift) — aplicar en orden cronológico
#    (idempotentes en su mayoría; verificar cada uno antes de correr)
for f in prisma/manual/*.sql; do
  echo "Aplicando $f"
  npx prisma db execute --file "$f"
done

# 5. Alineación de datos post-migración (idempotentes)
npx ts-node --transpile-only scripts/ensure-accounts-existing-tenants.ts
npx ts-node --transpile-only scripts/ensure-mappings-existing-tenants.ts
npm run migrate:sales-credit-bo   # convención NC venta BO (solo tenants countryCode=BO)

# 6. Arrancar
NODE_ENV=production PORT=3000 FRONTEND_URL=https://app.tudominio.com \
  npm run start:prod

# 7. Verificar
curl -s https://api.tudominio.com/health   # {"status":"ok", prisma:up, memory:up, disk:up}
curl -s https://api.tudominio.com/metrics | head -5   # Prometheus
# Swagger: https://api.tudominio.com/api
```

**Verificación de seguridad (headers API):** `curl -I` debe devolver
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`
(solo prod).

### 3.1 Recuperación de migración fallida (P3009) — BD driftada (2026-09-05)

**Síntoma:** `prisma migrate deploy` aborta con `P3009` ("migrate found failed
migrations") y el entrypoint `start-prod.sh` (`set -euo pipefail`) deja la API
caída en **cada** push. Causa: la BD de prod es la "BD driftada" que se mantuvo
con SQL manuales (`prisma/manual/`); la migración `20260905000000_baseline_full_sync`
(T1) codificó ese drift con DDL **no idempotente** (`CREATE TYPE`/`TABLE`/`INDEX`,
`ADD COLUMN` sin guardas — se generó contra una BD limpia), choca con objetos que
el drift ya creó en prod y queda registrada `failed` en `_prisma_migrations` →
bloquea todas las migraciones posteriores.

**Fix definitivo (BD de pruebas — reset total):** el replay desde cero de las 41
migraciones es reproducible (validado localmente en BD descartable: deploy 41/41 +
seed OK). Se replantea la BD y se marca el pipeline manual como superado — su
contenido de schema ya lo aplican las migraciones y el `prisma db seed` (que
también crea los roles RBAC; el archivo manual de roles es redundante en BD fresca).

> **Entorno LOCAL de desarrollo (2026-09-10, T53):** el mismo procedimiento está
> empaquetado en un solo comando reproducible:
>
> ```bash
> cd backend-erp
> npm run db:recreate   # migrate reset --skip-seed + db push + SQL manuales (best-effort) + seed
> ```
>
> `prisma db push` sincroniza el schema declarado (incluye lo que solo vivía en
> SQL manual: `DocumentSeries.branchId`, `Item.uomGroupId`, `UomGroup*`,
> `SavedQuery.visibility/sharedRoleIds`), `scripts/apply-manual-migrations.mjs
> --best-effort` aplica los SQL históricos que aún no estén y registra todos en
> `_manual_migrations` (los "ya existe" se registran sin abortar), y el seed deja
> los maestros. Verificación: `npx prisma migrate diff --from-url "$DATABASE_URL"
> --to-schema-datamodel prisma/schema.prisma --script` → *"This is an empty
> migration"*. Los specs E2E se autoabastecen del contexto fiscal (ver
> `e2e/auth.setup.ts` + `e2e/helpers/ensure-fiscal-year.ts`).

```bash
cd backend-erp
railway link          # proyecto/servicio backend correcto
# 1) Verificar que apunta a la BD de Railway (host postgres.railway.internal)
railway run -- node -e "console.log(process.env.DATABASE_URL)"
# 2) Reset: dropea el schema y replantea las 41 migraciones (sin seed)
railway run -- npx prisma migrate reset --force --skip-seed
# 3) Marcar los SQL manuales como ya aplicados (superados por migraciones + seed).
#    Sin este paso, apply-manual-migrations.mjs re-aplica DDL duplicado en el
#    primer boot post-reset (p. ej. ADD COLUMN "isIndexUnit" ya existe) y cae.
railway run -- npx prisma db execute --stdin <<'SQL'
CREATE TABLE IF NOT EXISTS "_manual_migrations" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO "_manual_migrations" (name) VALUES
 ('20260816_add_itf_bank_charge_type.sql'),
 ('20260816_add_currency_is_index_unit_ufv.sql'),
 ('20260816_add_pos_minor_sales_consolidation.sql'),
 ('20260816_add_export_tasa_cero.sql'),
 ('20260816_add_purchase_credit_use.sql'),
 ('20260816_add_rc_iva_declarativo.sql'),
 ('20260816_add_iue_compensacion.sql'),
 ('20260816_add_employee_monthly_salary.sql'),
 ('20260817_add_partner_custom_fields.sql'),
 ('20260818_add_debit_note_payments.sql'),
 ('20260822_add_withholding_gross_up.sql'),
 ('20260823_add_jel_tenant_account_index.sql'),
 ('20260824_add_return_line_dimensions.sql'),
 ('20260825_sync_schema_drift.sql'),
 ('20260826_rbac_system_roles.sql')
ON CONFLICT DO NOTHING;
SQL
# 4) Sembrar el tenant por defecto (admin/admin123 + roles + plan de cuentas)
railway run -- npx prisma db seed
# 5) Redesplegar (botón Redeploy o push a josekilla3390/backend-erp) → boot verde
```

> En PowerShell (Windows) el paso 3 usa archivo: crear `reset-mark-manual.sql`
> con el `CREATE TABLE` + `INSERT` de arriba y correr
> `railway run -- npx prisma db execute --file reset-mark-manual.sql`.

> **Ojo con `railway run` (medido 2026-09-29).** El CLI ejecuta el comando **en tu
> máquina**, con las variables del servicio: `DATABASE_URL` apunta a
> `postgres.railway.internal:5432`, que **solo resuelve dentro de la red del proyecto**, así
> que desde el portátil esos `railway run` fallan al conectar. Para tocar la base hay dos
> vías: `railway ssh` (ejecuta **dentro** del contenedor, donde el host privado sí resuelve)
> o **habilitar un TCP Proxy** al Postgres en *Settings → Networking* y usar esa URL con
> `DATABASE_URL=... npx prisma ...` en local. Y el paso 3 ya **no** es obligatorio para
> arrancar: desde el 2026-09-29 el entrypoint aplica los SQL manuales con `--best-effort`
> (tolera el «ya existe» en vez de morir), aunque marcarlos sigue siendo lo correcto.

> **Si la BD SÍ tiene datos que conservar — NO resetear.** Verificar paridad y
> resolver: `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel
> prisma/schema.prisma` (debe dar "no difference" — el drift ya está aplicado vía
> SQL manuales) y luego `prisma migrate resolve --applied
> 20260905000000_baseline_full_sync`; `prisma migrate deploy` aplicará las 2
> pendientes (`20260905010000_bulk_import_lock_managed`,
> `20260905020000_journal_source_type_enum`).

### Reset + seed **dentro** del contenedor (medido 2026-09-29)

Con `railway ssh` se ejecuta en el contenedor, donde el host privado **sí** resuelve. La
secuencia completa, ya probada de punta a punta (`determined-recreation` / `backend-erp`):

```bash
railway ssh -s backend-erp 'npx prisma migrate reset --force --skip-seed'
railway ssh -s backend-erp 'npx prisma db push --skip-generate --accept-data-loss'
railway ssh -s backend-erp 'node scripts/apply-manual-migrations.mjs --best-effort'
railway ssh -s backend-erp 'NODE_OPTIONS=--max-old-space-size=768 npx ts-node --transpile-only prisma/seed.ts'
```

Por qué así:

- `prisma migrate reset` **corta la cadena** en su paso de `generate` (el `&&` del
  `npm run db:recreate` no sigue) ⇒ los tres pasos siguientes van **a mano**.
- `db push` pide **`--accept-data-loss`** (la BD recién reseteada está vacía: no hay nada
  que perder).
- El seed **no** puede ser `npx prisma db seed` en un contenedor de **1 GB**
  (`/sys/fs/cgroup/memory.max` = 999.997.440 B): el type-checking de `ts-node` **muere con
  `FATAL ERROR: Reached heap limit`**. Con **`--transpile-only`** y el heap acotado
  (`--max-old-space-size=768`) termina bien (el chequeo de tipos ya lo hizo el build). Se
  puede llamar también por `prisma db seed` una vez que la imagen incluye `src/`,
  `tsconfig*.json` y `prisma.config.ts` (**Dockerfile desde `0d89e16`**).
- **Sin deploy disponible** (p. ej. durante el incidente de Railway del 2026-09-29, que
  dejó el webhook sin disparar y respondía *Deploys have been paused temporarily*), los
  fuentes se pueden **subir al contenedor vivo** por SSH:
  `tar -czf - src tsconfig.json tsconfig.build.json prisma.config.ts | railway ssh -s backend-erp 'cd /app && tar -xzf -'`
  (por `cmd`/`bash`, para no romper el binario con la tubería de PowerShell). Es efímero:
  se pierde al redesplegar.

Verificación de paridad local↔Railway (misma huella por API, con el token del tenant):
`/items` **137** · `/partners` **14** · `/warehouses` **4** · `/exchange-rates` **1** ·
`/settings` **35 claves**, y `/health` **200** en ambos.

---

## 4. Despliegue del frontend (SSR)

```bash
cd erp-frontend

# 1. Dependencias + build (incluye SSR: dist/erp-frontend/server + browser)
npm ci
npm run build     # 0 errores (el warning de budget inicial 1.29 MB es preexistente)

# 2. Arrancar el server SSR
NODE_ENV=production PORT=4000 ALLOWED_HOST=app.tudominio.com \
  node dist/erp-frontend/server/server.mjs

# 3. Verificar render + headers + no-fuga
npx playwright test e2e/ssr-smoke.spec.ts          # 11/11 (necesita el SSR arriba)
npx playwright test e2e/go-live-smoke.spec.ts      # ciclo completo con cuadre contable
```

**Verificación manual rápida:**

```bash
curl -s -D - https://app.tudominio.com/ | head -20
# · HTTP 200 con <app-root ng-server-context="ssr"> (HTML real, no shell vacío)
# · Content-Security-Policy: default-src 'self'; ...
# · X-Frame-Options: DENY, nosniff, HSTS
# · el HTML NO debe contener access_token, CLI-*, FVE-*, ASI-* ni passwords
```

> La CSP SSR usa `script-src 'unsafe-inline'`/`style-src 'unsafe-inline'` por el
> transfer-state y estilos inline de Angular (trade-off documentado en
> `erp-frontend/src/server.ts`). Migrar a nonce queda como mejora futura.

---

## 5. Post-deploy — alineación de tenants existentes

Los tenants creados **antes** de cada convención necesitan scripts de alineación
(idempotentes; correr con la API levantada o directo a BD según el script):

| Cambio | Fecha | Script | Aplica a |
|--------|-------|--------|----------|
| Cuentas/mappings nuevos del plan BO | Jul 2026 | `ensure-accounts-existing-tenants.ts` + `ensure-mappings-existing-tenants.ts` | Todos |
| Convención NC venta BO (TAX_INPUT, Devolución sobre Ventas) | 2026-08-23 | `npm run migrate:sales-credit-bo` | Tenants `countryCode=BO` (otros países NO se tocan) |
| Tenant2 QA | 2026-08-23 | `npm run crear:tenant2` | Solo entornos de QA |

> Los tenants nuevos ya nacen con la configuración correcta (seed + `seedTenantData`).

---

## 6. QA previo al corte (go/no-go)

| Chequeo | Comando | Criterio |
|---------|---------|----------|
| Tests backend | `cd backend-erp && npm test` | 142 suites / 1415 tests verdes |
| Tests frontend | `cd erp-frontend && npx ng test --watch=false --browsers=ChromeHeadless` | verdes |
| E2E frontend | `npx playwright test` | 184+ tests (incluye journeys UI, go-live-smoke, ssr-smoke) |
| Baterías QA | `node scripts/qa-battery/run.js` (BD de prueba limpia) | 01-28 + validación integral en verde |
| Pentest ligero | `cd backend-erp && npm run pentest:ligero` | 0 fallos críticos (auth, CSRF, DTOs, IDOR, SQLi, RBAC, rate) |
| k6 (gate de PR) | `npm run perf:k6` | 5/5 escenarios con 100 % de checks y 0 % de fallos (perfil `small`) |
| k6 (volumen) | job programado `load-tests-large` (`.github/workflows/load-tests-large.yml`, domingos + a demanda) | perfil `large` (25 VUs) en **modo medición** (`K6_LATENCY_MODE=report`): verde si no hay errores funcionales; la latencia queda en el artefacto `k6-large-summary` (T89) |
| Backups | `npm run backup:db` | OK + validación de restore en `erp_test` |
| **Gate de configuración por tenant** | Login en cada tenant → Administración → **Centro de configuración** (`GET /setup/checklist`) | `requiredPending = 0` y prueba E2E por familia aprobada (guía de implementación, Anexo D) |

---

## 7. Rollback

### Código

```bash
# Revertir el commit problemático y redesplegar
git -C backend-erp revert <commit> && git push
git -C erp-frontend revert <commit> && git push
# → rehacer §3 pasos 2-7 y §4 pasos 1-3 en cada repo
```

### Base de datos

```bash
# Restore desde el último backup (SIEMPRE backup antes de migrar/alinear)
cd backend-erp
BACKUP_FILE=backups/erp_YYYYMMDD_HHmmss.sql npm run restore:db
# RPO: 24h (backup diario) · RTO: 1-4h
```

**Regla de oro:** antes de correr migraciones, SQL manuales o scripts de
alineación en producción → `npm run backup:db` y guardar el archivo.

### Migraciones ya aplicadas

- `prisma migrate deploy` **no** se revierte con `migrate dev --create-only`
  invertido en prod: si una migración de schema rompe, restaurar desde backup
  y re-desplegar el código anterior (no se soporta down-migration en prod).

---

## 8. Monitoreo operativo

| Superficie | Endpoint / mecanismo | Qué vigilar |
|------------|----------------------|-------------|
| Health | `GET /health` | prisma up, memoria < 90%, disco < 90% |
| Métricas | `GET /metrics` (Prometheus) | latencia p95, errores 5xx por tenant, `http_requests_total` |
| Rate limit | headers `X-RateLimit-*` | tenant abusivos (SHARED 300/min, DEDICADO 2000/min) |

> ⚠️ **Tuning de rate limit (hallazgo k6 `large` 2026-08-23):** a 25 usuarios
> concurrentes escribiendo, el límite SHARED (300 req/min/tenant) se satura en
> segundos y los clientes reciben 429 (~98% de fallos en k6). Valores sugeridos
> por tier de concurrencia (env `THROTTLE_LIMIT_SHARED` / `THROTTLE_LIMIT_DEDICATED`):

| Tier | Usuarios concurrentes esperados | SHARED (req/min) | DEDICADO (req/min) |
|------|-------------------------------|-------------------|---------------------|
| Startup | 1-5 | 600 | 2000 (default) |
| PyME | 5-25 | 2000 | 5000 |
| Empresa | 25-100 | 6000 | 15000 |

> Los **entornos de perf/CI** deben correr con límites muy elevados (ej.
> 20000) para que k6 mida la API y no el throttler (`THROTTLE_LIMIT_SHARED=20000`
> en el `.env` del entorno de perf — no commitear). Re-validar con
> `K6_PROFILE=large npm run perf:k6` tras cada ajuste (ver AUDIT item 48).
>
> **Estado del techo de escritura a 25 VUs (T89, 2026-09-12).** Corregido el rate
> limit y repartidos los VUs entre partners e ítems distintos, el techo que queda no
> es funcional sino de **latencia**: medido sobre BD descartable, los 5 escenarios
> dan **100 % de checks con 0 % de fallos** y `sale-invoice-load` / `multitenant-isolation`
> cruzan su umbral de p(95) (6,7 s y 5,6 s frente a 1,5 s y 2 s). Es el
> comportamiento esperado de una instancia de desarrollo sirviendo 25 escrituras
> concurrentes, **no un defecto de producto**, y por eso la validación de volumen ya
> no va en el ciclo de PR: corre **programada** y en **modo medición**, con las
> latencias archivadas como artefacto para compararlas en el tiempo. Para go-live la
> acción sigue siendo la misma: dimensionar el tier (`THROTTLE_*` de la tabla de
> arriba) y **validar `large` contra el hardware/instancia reales** antes del corte.
| Backups | `npm run backup:db` (retención 7 diarios + 4 semanales) | éxito diario + restore de prueba mensual |
| Logs | stdout del proceso (JSON-ish) | errores del engine contable, `ConflictException` de períodos |

---

## 9. Checklist go/no-go

- [ ] Backend: build 0 errores, `npm test` 142/1415, lint 0/0
- [ ] Frontend: build 0 errores, Karma verdes, E2E 184+ (chromium/firefox/mobile)
- [ ] SSR de producción: render server-side + headers + sin fuga (ssr-smoke 11/11)
- [ ] Baterías QA 01-28 + validación integral en verde (BD limpia)
- [ ] Pentest ligero sin fallos
- [ ] `migrate deploy` + SQL manuales aplicados + tenants alineados
  (`ensure-accounts`, `ensure-mappings`, `migrate:sales-credit-bo`)
- [ ] Backup previo al corte + verificación de restore
- [ ] `FRONTEND_URL` + TLS + HSTS verificados con `curl -I`
- [ ] Monitoreo conectado (/health + /metrics) y alertas configuradas
- [ ] Tenant 2 de prueba operativo (aislamiento multitenant — batería 26)
- [ ] Concurrencia validada (batería 28: anulación y NCs no duplican datos)

---

## 10. Subir PostgreSQL de versión mayor (medido 2026-10-05: 16.6 → 18.3)

**No hay actualización «en el sitio».** Los binarios nuevos contra el directorio de datos
viejo no arrancan (`PG_VERSION` no coincide: *database files are incompatible with server*),
así que el camino es **crear el cluster nuevo y mover los datos**: volcado con las
herramientas de la versión nueva y restauración en la nueva. Este es el orden que se
ejecutó y verificó en local; en Railway es el mismo con dos piezas propias de la plataforma
(§10.3).

### 10.1 Las trampas, medidas

| Trampa | Medición |
|---|---|
| **La collation no viaja con el volcado** | El cluster del 18 de esta máquina se creó con `Spanish_Mexico.1252` y el del 16 con `Spanish_Spain.1252`. Hay que **crear cada base con la collation del origen** (`CREATE DATABASE … LC_COLLATE 'Spanish_Spain.1252' LC_CTYPE '…' TEMPLATE template0`) o cambia el orden de los textos. Verificado que el 18 la acepta. |
| **Las herramientas deben ser ≥ la versión del servidor** | `pg_dump` **se niega** a volcar un servidor más nuevo que él. `backend-erp/scripts/db-utils.js` ya pregunta `server_version_num` y elige las herramientas de esa misma mayor (antes ordenaba las carpetas por nombre y **acertaba por suerte**); si todas son más viejas, **falla nombrando el desajuste** en vez de intentarlo. Gate: `npm run audit:pg-tools:self-test`, en el `pre-push`. |
| **Volcar y restaurar con las herramientas nuevas** | `pg_dump`/`pg_restore` 18 leyendo el 16 y escribiendo en el 18. La dirección que rompe es la contraria (herramientas viejas contra servidor nuevo). |
| **Extensiones y roles** | En este proyecto: un solo rol (`postgres`) y `plpgsql` (más `adminpack` en el cluster). Nada que migrar aparte. |
| **No basta contar tablas** | La verificación fue la **huella de contenido** del arnés (`erp-frontend/e2e/harness/fingerprint.sql`): **199 tablas** con **el mismo número de filas** (3 072 en total) y `_prisma_migrations` con **md5 idéntico**. |
| **Ojo con el «OK» falso** | Comparar dos **errores** también da «iguales»: una primera comparación por tabla marcó OK porque la consulta fallaba en los dos lados. La huella se calcula con SQL que no puede fallar en silencio. |

### 10.2 Procedimiento en local (el que se ejecutó)

```powershell
$pg18 = 'C:\Program Files\PostgreSQL\18\bin'
# 1) La base que ya exista en el destino NO se borra: se renombra
& "$pg18\psql.exe" -p 5433 -U postgres -d postgres -c "ALTER DATABASE erp_db RENAME TO erp_db_18_previo"
# 2) Crear la base con la collation del ORIGEN (no con la del cluster nuevo)
& "$pg18\psql.exe" -p 5433 -U postgres -d postgres -c "CREATE DATABASE erp_db LC_COLLATE 'Spanish_Spain.1252' LC_CTYPE 'Spanish_Spain.1252' TEMPLATE template0 OWNER postgres"
# 3) Volcar del viejo (5432) con las herramientas del NUEVO y restaurar en el nuevo (5433)
& "$pg18\pg_dump.exe"    --format=custom --file=erp_db.dump -h localhost -p 5432 -U postgres -d erp_db
& "$pg18\pg_restore.exe" --no-owner --no-privileges -h localhost -p 5433 -U postgres -d erp_db erp_db.dump
# 4) Verificar la huella de contenido (tabla por tabla) antes de apuntar la app al nuevo
# 5) Pasar el nuevo al 5432 y apartar el viejo (necesita Administrador):
#    ALTER SYSTEM SET port = 5432  ·  Stop-Service postgresql-x64-16  ·  Restart-Service postgresql-x64-18
#    Los volcados de la migración quedan en %USERPROFILE%\pg-backup-16-pre-migracion
```

`npm run backup:db` / `restore:db` (**la vía de rollback**) quedan intactos: siguen eligiendo
las herramientas correctas solos.

### 10.3 En Railway (pendiente: lo decide el usuario)

**Estado medido (2026-10-05)**: la **versión de PostgreSQL de producción no está medida**
(el host privado `postgres.railway.internal` solo resuelve dentro del proyecto) y **no hay
evidencia de un backup de producción verificado** —el runbook lo declara como criterio
(retención 7 diarios + 4 semanales y restore de prueba mensual), pero `npm run backup:db`
dumpea lo que haya en `DATABASE_URL`, y `railway run` **no** conecta al host privado—.
Por eso el paso 0 no es opcional.

0. **Medir y asegurar (antes de tocar nada)**
   1. Habilitar el **TCP Proxy** del servicio Postgres (Railway → servicio → *Settings* → *Networking*).
   2. `psql "postgresql://postgres:<PASS>@<proxy-host>:<proxy-port>/railway" -c "select version()"` → apuntar la versión.
   3. `pg_dump` de producción y **restaurarlo en una base local**, verificando la huella
      (§10.1). Un volcado que nunca se ha restaurado **no** es un backup verificado.
1. **Crear el servicio nuevo en la 18** (no se puede actualizar en el sitio): *+ New* → servicio
   con la imagen `ghcr.io/railwayapp-templates/postgres-ssl:18` (el tag que corresponda) **y su
   volumen**. **No** cambiar el tag de imagen del servicio viejo: los binarios nuevos contra el
   directorio de datos viejo no arrancan (falla segura, pero es una caída).
2. **Ventana**: escalar el backend a **0 réplicas**. Si algo escribe entre el volcado y la
   restauración, se pierde.
3. **Mover los datos**: volcar del viejo y restaurar en el nuevo con las herramientas de la 18
   (por la red privada o con `railway ssh` dentro del proyecto).
4. **Verificar en el destino** con la huella de contenido (las **199** tablas del ERP y las
   **84** migraciones de `_prisma_migrations`).
5. **Repuntar** la variable del backend (`DATABASE_URL`; si es una referencia tipo
   `${{Postgres.DATABASE_URL}}`, hay que actualizarla al nombre del servicio nuevo) y
   **escalar de nuevo**. El arranque corre `prisma migrate deploy` más los SQL manuales **en
   cada boot**: con el esquema ya restaurado es un no-op, y si algo faltara, lo aplica.
6. **Verificar** `/health` (`prisma: up`), el login y una operación real. El servicio viejo se
   deja **parado** unos días antes de borrarlo (y su volumen con él).

**Irreversible**: la subida de major del **servidor** (solo se vuelve restaurando el backup) y
cualquier cambio de esquema aplicado en producción (no hay *down-migrations*).

---

*Este runbook se actualiza con cada cambio de despliegue. La versión canónica de
restricciones vive en `AGENTS.md`; el estado de QA en `AUDIT.md`; las features en
`ROADMAP.md`.*
