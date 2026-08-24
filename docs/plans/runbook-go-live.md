# Runbook de Go-Live — ERP Suite

> **Última actualización:** 2026-08-23.
> Procedimiento operativo de despliegue, verificación, alineación de datos y
> rollback para producción. Complementa `AGENTS.md` (estado del proyecto) y
> `AUDIT.md` (QA de go-live: baterías 18-28, seguridad, SSR).

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
   └─ backend-erp (NestJS 11, puerto 3000/3001)
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
| Env frontend | `PORT` (4000), `ALLOWED_HOST`, `NODE_ENV=production`; `connect-src` de la CSP apunta al API (en prod: `http://localhost:3001` en dev, ajustar al host real) |

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
NODE_ENV=production PORT=3001 FRONTEND_URL=https://app.tudominio.com \
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
| k6 | `npm run perf:k6` | 5/5 escenarios (perfil `small`); `large` para validación de volumen |
| Backups | `npm run backup:db` | OK + validación de restore en `erp_test` |

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

*Este runbook se actualiza con cada cambio de despliegue. La versión canónica de
restricciones vive en `AGENTS.md`; el estado de QA en `AUDIT.md`; las features en
`ROADMAP.md`.*
