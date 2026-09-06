# Plan — F6 contabilidad núcleo: reportes contables clásicos + blindaje cierre→apertura

> Estado: **2026-09-05 — propuesto (aprobado alcance (a) por el usuario)**.
> Objetivo: completar la contabilidad núcleo de Fase 6 (ya hay: plan de cuentas,
> asientos, engine con partida doble, dimensiones, estados financieros, cierre de
> período con asiento de cierre/apertura, activos fijos, multi-divisa).

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

## Entregables / commits

- Backend: `backend-erp` (reportes + specs) → origin + deploy (Railway).
- Frontend: `erp-frontend` (páginas + export + Karma) → origin.
- Docs/plan: root `erp_suite` (este plan + ROADMAP/AUDIT al cierre).
