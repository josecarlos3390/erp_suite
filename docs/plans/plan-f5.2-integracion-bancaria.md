# Plan — F5.2 Integración Bancaria: import CSV/Excel + matching avanzado

> Fecha: 2026-09-05 · Backend `src/bank-statements` + `src/bank-reconciliation` · Frontend `pages/bank-reconciliation`
> Base: módulo de extractos/reconciliaciones operativo (T12 incluye el modo comercial
> sin posteo) — esta fase agrega el **import real por archivo** y el **matching mejorado**.
> Regla del usuario: lo automático es **parametrizable** y siempre convive con la opción
> manual; nunca se enmascaran errores.

---

## 1. Objetivo

Hoy el import de extractos es pegar texto tabulado en un textarea y el auto-match es una
ventana fija de ±3 días. F5.2 eleva el módulo al nivel de integración bancaria:

1. **Import real por archivo** (CSV / XLSX) con parseo robusto (fechas, montos es-ES y
   en-US, encabezado opcional), **previsualización** y confirmación — sin líneas a medias.
2. **Matching avanzado parametrizable**: ventana de fechas configurable, tolerancia de
   monto, prioridad por referencia y **sugerencias** asistidas por línea.
3. Cierre documentado: fases, tests y criterios de aceptación.

## 2. Fases

### Fase 1 — Import por archivo (✅ entregada 2026-09-05)
- Backend: `src/bank-statements/statement-import.util.ts` (parseo puro de CSV/XLSX vía
  `@e965/xlsx`): encabezado opcional con alias en español/inglés, fechas ISO y
  dd/mm/aaaa, montos `1.234,56` / `1,234.56` / `1234.56` (`parseAmount` exportado),
  errores por fila sin abortar.
  - Endpoints: `POST /bank-statements/:id/import-file/preview` (parsea y valida sin
    persistir → `{ rowCount, errorCount, errors, sample }`) y
    `POST /bank-statements/:id/import-file` (persiste vía `importLines` solo si no hay
    errores — 400 con el primer error en caso contrario).
  - Tests: `statement-import.util.spec.ts` (7 casos: CSV con/sin encabezado, formatos de
    monto, fechas inválidas, filas sin monto, formato no soportado, XLSX).
- Frontend: bloque "Importar desde archivo CSV/Excel" en el form de extracto (selector de
  archivo → preview con tabla y errores → botón "Importar líneas del archivo"; refresca
  el extracto). `BankStatementsService.previewFileImport/importFile`.

### Fase 2 — Matching avanzado (✅ entregada 2026-09-05)
- ✅ **Settings parametrizables (2026-09-05):** `bankReconciliationMatchWindowDays`
  (default 3) + `bankReconciliationMatchTolerance` (default 0.01) en Parametrización
  (sección "Conciliación bancaria", visible en modo contable y comercial). El backend los
  aplica en `autoMatch`/`_autoMatch` al fetch de candidatos (asientos + pagos) y a las
  comparaciones de monto (tolerancia inclusiva; 0 = montos idénticos). Defaults preservan
  el comportamiento previo. Tests: `bank-reconciliation` 25 OK (+4), `settings` 13 OK,
  FE Karma en verde.
- ✅ **Endpoint de sugerencias (2026-09-05):** `GET /bank-reconciliations/:id/suggest` —
  por cada línea sin conciliar devuelve los candidatos (pagos/asientos) aún no usados,
  ordenados por score (referencia exacta > monto+ventana > descripción similar), máximo 5
  por línea. Anti-duplicados: una línea de extracto y un pago/asiento solo se sugieren una
  vez (sets compartidos con el auto-match vía `_loadMatchScope`). Respeta ventana/
  tolerancia parametrizables y el modo comercial (T12). Frontend: botón "Sugerencias" →
  modal con candidatos y botón "Conciliar" por candidato (match manual asistido vía
  `manualMatch`); el Match Manual y el Auto-Match siguen disponibles. Tests:
  `bank-reconciliation` 41 OK (+5), Karma 1447/1447.

### Fase 3 — Cierre (✅ entregada 2026-09-05)
- ✅ **E2E Playwright del flujo completo** — `erp-frontend/e2e/banking-reconciliation-flow.spec.ts`
  (proyecto chromium): **crear extracto (UI)** → **importar CSV real (UI: preview +
  importar)** → **conciliar (sugerencia manual asistida + auto-match)** → **finalizar**,
  en modo **contable** y **comercial** (T12). Verificado en verde ambos modos (comercial en
  tenant sin asientos; si el tenant ya tiene asientos el toggle da 409 T12 y el escenario se
  salta con motivo — en CI la BD fresca lo ejecuta completo). Scaffolding (pagos
  candidatos, gestión/serie, tasa del día, reconciliación) por API; la UI cubre import de
  archivo y el matching.
- ✅ **Bugs reales encontrados por el E2E y resueltos**: (1) ruta `GET /banks/accounts`
  sombreada por `:id`; (2) DTOs bancarios sin `@Type(() => Number)` (selects nativos envían
  string → 400 al crear extracto/reconciliación); (3) la ruta `new` de conciliación no
  renderizaba (no hay param `:id`; ahora se detecta por segmento de URL).
- ⚠️ **Hallazgos UX pendientes (documentados)**: la UI del detalle de una reconciliación
  **sin extracto vinculado** no lista líneas (el backend sí matchea por banco+período); el
  selector "Extracto" del form nuevo filtra `RECONCILING`, estado que ningún flujo produce
  (el extracto nace DRAFT y el registro lo pasa a POSTED) → definir el ciclo
  (p. ej. registrar → RECONCILING) o listar DRAFT/POSTED.
- ✅ **Docs**: `docs/guides/guia-implementacion-configuracion.md` (Anexo B/C + 4ª iteración:
  tasa del día bloqueante, cuentas bancarias → cuenta contable, fix ruta) y CHANGELOGs.

## 3. Criterios de aceptación
- Import: el preview coincide con las líneas que se persisten; con errores → 400 sin
  persistir nada; fechas y montos correctos en ambos formatos locales.
- Matching: la ventana/tolerancia configuradas se respetan; las sugerencias nunca repiten
  un elemento ya usado; la opción manual sigue disponible.
- Regresión: suite backend y Karma en verde; modo comercial (T12) intacto.

## 4. Archivos
Backend: `bank-statements/statement-import.util(.spec)`, `bank-statements.service(.spec)`,
`bank-statements.controller`, `dto/import-statement-file.dto`, `package.json`
(`@e965/xlsx` a dependencies). Frontend: `pages/bank-reconciliation/bank-statements.service.ts`,
`bank-statement-form.component.{ts,html,scss}`.
