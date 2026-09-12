# Plan — F6 contabilidad núcleo: reportes contables clásicos + blindaje cierre→apertura

> Estado: **2026-09-05 — propuesto (aprobado alcance (a) por el usuario)**.
> Objetivo: completar la contabilidad núcleo de Fase 6 (ya hay: plan de cuentas,
> asientos, engine con partida doble, dimensiones, estados financieros, cierre de
> período con asiento de cierre/apertura, activos fijos, multi-divisa).

## Estado de implementación (2026-09-05)

- ✅ **Fase 1 backend** — `GET /reports/journal`, `GET /reports/trial-balance`,
  `GET /reports/general-ledger` (specs 3/3 + regresión 13/13). Backend `a7be3e2` y
  `59320fa` (origin + Railway).
- ✅ **Fase 2 frontend** — páginas `/reports/journal|trial-balance|general-ledger` +
  menú + Karma 3/3. FE `1d2879ec`, `09984e2f`, `07168637`.
- ✅ **Fase 3 (completa)** — verificado en vivo local la **cuadratura**: journal
  Debe=Haber=trial=1830.41 y Deudor=Acreedor=1581; mayor cuadra con trial (11 cuentas
  con movimiento). **Ciclo contable ejecutado y validado:** cierre de 2026 (períodos
  12/12 + asiento `CIERRE-GEST-2026` + año CLOSED) → gestión 2027 con 12 períodos →
  apertura `APERTURA-GEST-2027` cuadrada (1.525,59 = 1.525,59) → trial Enero 2027 con
  saldos (7 cuentas). **Fix de borde:** asientos de apertura/cierre (00:00Z @db.Date)
  incluidos por el filtro `from` (medianoche UTC del día) — backend `acecac3` (origin +
  Railway). Pendiente menor: replicar el ciclo en Railway con datos de esa base.

## Alcance (a)

1. **Libro Diario** — asientos ordenados por fecha/código en un rango de fechas o
   período contable, con debe/haber por línea y totales.
2. **Mayor General** — por cuenta (o todas), con saldo inicial, movimientos y saldo
   final; reutiliza la lógica de ledger existente (`AccountsService.findLedger`).
3. **Balance de Comprobación** — por cuenta en el rango: movimiento Debe/Haber y
   saldo Deudor/Acreedor (cuadratura `Σ debe = Σ haber`).
4. **Exportación** Excel/PDF de los tres (mismo mecanismo de otros reportes).
5. **Blindaje del ciclo contable** cierre → apertura → nuevo ejercicio, verificado
   end-to-end contra el criterio de aceptación de F6 ("asientos cuadran, estados
   financieros correctos").

## Qué se reutiliza (no reinventar)

- `ReportsService` (`src/reports/reports.service.ts`) — patrón de balance general /
  estado de resultados / flujo: agregaciones por `JournalEntryLine` POSTED + cuenta.
- `AccountsService.findLedger` (ledger por cuenta, ya usado por FE `/accounts/:id/ledger`).
- Utilidades de export: `xlsx` (imports bancarios) y `pdfmake` (PDFs de documentos).
- `fiscal-years` + períodos: filtrar por `periodId`/rango con `startOfTenantDay`/
  `endOfTenantDay` (timezone tenant).
- FE: patrón de páginas de reportes `/reports/*` (filtros + tabla + export) ya existente
  para balance/resultados/flujo/revaluación.

## Fases

### Fase 1 — Backend (reportes)
- `GET /reports/journal?from&to|periodId&accountId?&page?` → ítems: fecha, código,
  concepto/glosa, cuenta (código+nombre), debe, haber; totales; filtros por cuenta.
- `GET /reports/trial-balance?from&to|periodId&accountId?` → por cuenta: mov Debe/Haber,
  saldo Deudor/Acreedor (según `balanceType`) + totales cuadrados.
- `GET /reports/general-ledger?accountId&from&to|periodId` → saldo inicial, líneas de
  movimiento, saldo final (delega/refuerza ledger existente, ahora con rango explícito).
- Validaciones (rango de fechas, período existente y abierto o cerrado según filtro),
  orden estable y paginación donde aplique.
- Tests unitarios por endpoint (saldo inicial/final, cuadratura, filtro por período).

### Fase 2 — Frontend (páginas + export)
- Páginas `/reports/journal`, `/reports/trial-balance`, `/reports/general-ledger` con el
  patrón de reportes: selector de período/fechas + cuenta opcional, tabla y botón
  **Exportar Excel** (y PDF si aplica).
- Karma por página (patrón de las otras páginas de reportes).

### Fase 3 — Blindaje del ciclo contable
- Verificación end-to-end (script/local + Railway): ejercicio 2026 con asientos →
  estados financieros → cierre de ejercicio (asiento de cierre) → apertura 2027
  (saldos) → período activo que cubre 2027 → primer asiento del 2027 cuadra.
- Checklist contable en el Centro (si procede) o prueba automatizada de la secuencia.
- Docs: actualizar ROADMAP (F6.3/6.4 “cerradas”, criterio de aceptación verificado) y
  AUDIT; Anexo en guía de contabilidad (`docs/guides/ACCOUNTING_ENTRIES_GUIDE.md`).

## Criterios de aceptación

- Los 3 reportes cuadran contra la misma data (Σ diario = Σ comprobación por cuenta;
  mayor por cuenta coincide con el ledger).
- Filtros por período/fechas usan la zona del tenant (sin corrimiento, patrón
  `@db.Date`/instantes ya establecido).
- Export Excel abre con columnas correctas; PDF legible.
- Ciclo cierre→apertura→nuevo ejercicio ejecutado y verificado en local y Railway.
- Suites backend (nuevos specs) y FE (Karma de páginas) en verde; build AOT 0 errores.

---

## Replicación del ciclo en Railway — evaluación (2026-09-12, T72)

**Estado:** ✅ **EVALUADO Y DOCUMENTADO.** El ciclo está verificado **en local**
(Fase 1-3: journal/trial/ledger cuadran, cierre de GEST-2026, apertura 2027 y trial
de enero 2027 con saldos). Lo que queda es ejecutarlo **con los datos del entorno de
Railway**, y eso no se hizo desde aquí por una razón concreta: **es una operación
destructiva sobre producción** (postea el asiento de cierre y bloquea el ejercicio),
y el plan la dejaba como "pendiente menor". Esta evaluación deja el terreno listo
para decidirla.

### Qué se verificó (read-only, sin escribir nada)

Acceso: el CLI de Railway está instalado y **autenticado** (`joseka3390@gmail.com`),
vinculado al proyecto `incredible-expression` / entorno `production` (servicios
`Postgres` y `erp-backend`). La BD **no tiene endpoint público** (solo
`postgres.railway.internal`), así que no se puede dumpear desde el equipo de
desarrollo; la auditoría se corrió **dentro del contenedor** con
`railway ssh --service erp-backend` (script Node por base64, solo `findMany/count/aggregate`).

| Dato del entorno de producción | Valor |
|---|---|
| Tenants | 1 (`default` — "Empresa Principal", país BO) |
| Plan de cuentas | 303 cuentas |
| Períodos | 12 |
| Asientos | **4** (todos POSTED, 0 borradores) |
| Gestión | `GEST-2026` (2026-01-01 → 2026-12-31), estado **OPEN** |
| Cuadratura | 14 líneas, **Dr = Cr = 1.830,41** ✓ |
| Asientos de cierre/apertura | **ninguno** → el ciclo anual **no se ejecutó** allí |
| Datos de operación | 2 socios · 1 artículo · 1 FV · 1 FC |
| Backend desplegado | `GET /health` → 200 `{prisma: up, memory: up, disk: up}` |

Conclusión: el entorno de Railway es de **validación** (4 asientos de una factura de
venta y una de compra), su contabilidad **cuadra**, y el ejercicio 2026 sigue abierto
con el ciclo anual sin ejecutar — exactamente el escenario del criterio pendiente.

### Por qué no se ejecutó aquí

1. **Es escritura en producción**: `POST /fiscal-years/:id/generate-closing-entry`
   postea el asiento de cierre y `close()` deja el ejercicio LOCKED. Revertirlo
   requiere reapertura/asientos manuales; no se hace sin autorización explícita del
   usuario, aunque el impacto sea bajo (4 asientos).
2. **No hay credenciales de la API de producción** en el repo (ni se adivinan): el
   login del entorno desplegado no es el del seed de desarrollo.

### Receta lista para ejecutar (cuando el usuario lo autorice)

```powershell
# 0. Respaldo ANTES de tocar nada (dentro del contenedor, sin exponer la BD):
railway ssh --service erp-backend "pg_dump -Fc $env:PGDATABASE > /tmp/backup-$(date +%F).dump"

# 1. Ciclo, por API (token de un usuario admin del entorno):
#    a) POST /auth/login                     → access_token (+ XSRF)
#    b) GET  /fiscal-years                   → id de GEST-2026
#    c) GET  /reports/trial-balance          → cuadratura previa (Deudor = Acreedor)
#    d) POST /fiscal-years/<id>/generate-closing-entry
#    e) POST /fiscal-years/<id>/close        → debe quedar LOCKED y rechazar asientos del mes (409)
#    f) POST /fiscal-years  (2027) + períodos → POST /fiscal-years/<nuevo>/generate-opening-entry
#    g) GET  /reports/trial-balance?from=2027-01-01 → enero 2027 con saldos y cuadrando
```

Alternativa **sin tocar producción** (recomendada para validar el ciclo con datos
reales): habilitar temporalmente un *TCP proxy* público en el servicio Postgres,
`pg_dump` a un archivo, restaurarlo en una BD local desechable (`erp_prod_copy`) y
ejecutar allí el ciclo completo con un usuario admin temporal de esa copia. La copia
se borra al terminar.

## Entregables / commits

- Backend: `backend-erp` (reportes + specs) → origin + deploy (Railway).
- Frontend: `erp-frontend` (páginas + export + Karma) → origin.
- Docs/plan: root `erp_suite` (este plan + ROADMAP/AUDIT al cierre).
