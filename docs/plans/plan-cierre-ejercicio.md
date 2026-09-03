# Plan — Cierre de ejercicio automático (asiento de cierre del año fiscal)

> Fecha: 2026-09-05 · Estado: **IMPLEMENTADO** (decisiones D1/D2/D3 validadas con el usuario)
> Feature: T5 de `AUDIT.md §8` (deuda consolidada) · Perfil: contabilidad completa (`accountingEnabled`)
> Referencias: `docs/guides/guia-implementacion-configuracion.md` (Anexo D), `ROADMAP.md` F6

---

## 1. Objetivo

Al terminar una gestión contable, los libros deben quedar listos para el cierre formal:

- **Cerrar (poner en cero) las cuentas de resultado** (4.x ingresos, 5.x costos, 6.x gastos)
  trasladando el **resultado del ejercicio** al patrimonio.
- Dejar la gestión en estado coherente para que la **apertura del año siguiente**
  (`generateOpeningEntry`, ya existente) arrastre saldos sin duplicar el resultado.

Hoy el sistema permite: generar períodos, **cerrar/reabrir períodos** (`POST
/accounting-periods/:id/close|reopen`), un **reporte de cierre de período** (`GET
/accounting-periods/:id/closing-report`) y **cerrar la gestión** (`POST
/fiscal-years/:id/close-year`, exige `closingEntryId` — el asiento de cierre se ingresa hoy
**a mano**). Falta el **asiento de cierre automático** que liquide las cuentas de resultado.

## 2. Piezas existentes que se reutilizan (sin cambios de motor)

- **Política de períodos**: `journal-entry-core._persist` exige período ACTIVO que cubra la
  fecha del asiento (cuando hay gestión). El asiento de cierre usará esa misma validación.
- **`_persist` / motor contable**: el asiento de cierre se persiste como asiento (POSTED)
  vía el core compartido (generación de código, doble expresión, período).
- **Cuentas de resultado del plan BO**:
  | Código | Nombre | Tipo | Naturaleza |
  |--------|--------|------|-----------|
  | 3.1.3.01.001 | Utilidad de la Gestión | EQUITY | CREDIT |
  | 3.1.3.01.002 | Pérdida de la Gestión | EQUITY | DEBIT |
  | 3.1.3.02.001 | Utilidad Acumulada | EQUITY | CREDIT |
  | 3.1.3.02.002 | Pérdida Acumulada | EQUITY | DEBIT |
- **Apertura** (`generateOpeningEntry`): arrastra activos/pasivos/patrimonio y envía el
  resultado del año anterior a `3.1.3.02.001`. Si el cierre ya movió el resultado al
  patrimonio dentro del ejercicio, la apertura NO duplica (las cuentas 4.x/5.x/6.x quedan en
  cero y el patrimonio ya lo incluye).

## 3. Flujo propuesto (secuencia de fin de gestión)

1. Se cierran los períodos del ejercicio salvo el **último** (normalmente diciembre) o se
   crea/deja un **período de ajuste** abierto que cubra el fin de año.
2. **Generar asiento de cierre** (`POST /fiscal-years/:id/generate-closing-entry`):
   - Calcula el saldo neto de cada cuenta de resultado (4.x/5.x/6.x) desde los **asientos
     POSTED** de la gestión (excluye DRAFT; excluye el propio asiento de cierre en re-ejecución).
   - Emite líneas que **ponen en cero** cada cuenta de resultado y una línea de contrapartida
     por el resultado neto a la cuenta patrimonial definida (decisión D1).
   - Postea en el período ACTIVO que cubre la fecha de cierre (normalmente el 31/12 de la
     gestión). Idempotente: si ya existe asiento `YEAR_CLOSING` para la gestión, lo devuelve
     (o 409 para regenerar si se reabrió un período).
   - Guardas: gestión sin cerrar; contabilidad habilitada; hay ≥1 período ACTIVO que cubra la
     fecha de cierre; resultado ≠ 0 (si es 0, igual se crea el asiento de comprobación? →
     decisión D2).
3. **Cerrar períodos restantes** y **cerrar la gestión** (`close-year` con el id del asiento
   de cierre) — la UI sugiere el flujo completo.
4. (Opcional, fuera de alcance) Apertura del siguiente ejercicio: ya existe y funciona con o
   sin asiento de cierre previo.

## 4. Decisiones validadas (2026-09-05)

- **D1 — Destino del resultado**: directo a **Resultados Acumulados** — ganancia → `3.1.3.02.001`
  (Utilidad Acumulada, Cr); pérdida → `3.1.3.02.002` (Pérdida Acumulada, Dr). Sinergia con la
  apertura existente (no se duplica el resultado al abrir el año siguiente).
- **D2 — Resultado cero / re-ejecución**: idempotente (si existe asiento `YEAR_CLOSING` POSTED
  lo devuelve); con resultado 0 crea asiento de **comprobación** (línea 0/0 en Utilidad
  Acumulada). Si se reabre un período y cambian saldos, el contador cancela el asiento y lo
  regenera.
- **D3 — Alcance**: backend (`POST /fiscal-years/:id/generate-closing-entry` con guards) +
  botón **"Generar asiento de cierre"** en el detalle de la gestión (toolbar, navega al asiento).

## 5. Implementación (2026-09-05)

- `FiscalYearsService.generateClosingEntry(id, tenantId, userId)` — guardas: contabilidad
  habilitada (400 si `accountingEnabled=false`), gestión sin cerrar (400 si `isClosed`),
  **período ACTIVO que cubra la fecha de cierre** (400 claro si no — cierre los demás
  períodos), idempotencia (`YEAR_CLOSING` POSTED existente → lo devuelve). Cálculo: saldo
  neto por cuenta de resultado (INCOME/COST/EXPENSE) desde asientos POSTED de la gestión
  (excluye `YEAR_CLOSING`); líneas que ponen en cero esas cuentas + contrapartida del
  resultado a Utilidad/Pérdida Acumulada; asiento POSTED `CIERRE-<gestion>` con
  `fiscalYearId`/`periodId` (verificación de balance). Resultado 0 → asiento de comprobación.
- `POST /fiscal-years/:id/generate-closing-entry` (permiso `fiscal-years:edit`).
- Frontend: `generateClosingEntry(id)` en el service y botón en `fiscal-year-detail`
  (confirmación con la advertencia del período abierto; al éxito navega al asiento;
  mensajes 400 claros).
- Tests: 3 unitarios (cierre con ganancia balanceado + código/período, idempotencia,
  rechazo sin período abierto). Suite backend **1568/1568**; karma en verde; build/lint OK.

## 6. Archivos tocados

- `src/fiscal-years/fiscal-years.service.ts|controller.ts|spec`
- `erp-frontend/src/app/pages/fiscal-years/fiscal-years.service.ts`, `fiscal-year-detail.component.ts|html`
- Plan + guía (Anexo D) + AUDIT §8 (T5 ✅) + ROADMAP + CHANGELOGs

## 7. Pendientes relacionados (no bloquean)

- Cierre del período como "ajuste" y asientos de distribución de utilidades (SAP B1) —
  evoluciones futuras del cierre.
- Revaluación M/E y diferencia de cambio automática (T7) se integran antes del cierre.
