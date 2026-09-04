# Plan — F7.2 contable: diferencia de cambio automática en asientos manuales (T7)

> Fecha: 2026-09-05 · Estado: **IMPLEMENTADO** (2 decisiones validadas con el usuario)
> Feature: T7 de `AUDIT.md §8` (deuda consolidada) · Perfil: contabilidad completa (`accountingEnabled`)
> Referencias: `AUDIT.md §7` veredicto F7.2, `ROADMAP.md` F7.2, `ACCOUNTING_ENTRIES_GUIDE.md`

---

## 1. Objetivo

Cerrar los dos pendientes contables de F7.2 heredados del veredicto de auditoría:

1. **Diferencia de cambio automática en asientos manuales** — al guardar un asiento
   manual **multi-moneda** (líneas en monedas distintas o tasas por línea distintas a la
   del asiento), un desbalance en **moneda base** originado por tipos de cambio debe
   poder postearse automáticamente contra las cuentas gain/loss del settings (fallback al
   mapping `EXCHANGE_DIFFERENCE`), en lugar de exigir que el contador calcule y agregue
   la línea a mano. Un asiento **uniforme** (una sola moneda a una sola tasa)
   desbalanceado sigue siendo un **error de captura** (nunca se enmascara como diferencia
   de cambio).
2. **Ganancia/pérdida del settings consumidas por todos los builders** — auditado: los 3
   productores reales de líneas FX del motor (cobros, pagos, compras GRIR vs factura) ya
   consumen `settings.exchangeRateGainAccountId`/`LossAccountId` vía
   `resolveExchangeDifferenceAccount` con fallback al mapping (F7.2b, 2026-08-24). El
   hueco restante era el módulo de **revaluación** (`exchange-rate-adjustments`), que
   exigía AMBAS cuentas también para el preview (que no las usa) y no tenía fallback.

## 2. Decisiones validadas (2026-09-05)

- **D1 — Asientos manuales: toggle en Parametrización, default OFF.** Nueva opción
  `journalEntryAutoExchangeDifference`. **ON:** al guardar, el sistema agrega SOLO la
  línea de diferencia contra las cuentas gain/loss (settings o mapping `EXCHANGE_DIFFERENCE`).
  **OFF (default):** comportamiento actual estricto — el contador agrega la línea
  manualmente (regla del usuario: todo automático parametrizable + opción manual).
  Un asiento uniforme desbalanceado se rechaza SIEMPRE (no es diferencia de cambio, es
  error de captura).
- **D2 — Revaluación: preview sin cuentas + fallback al confirmar.** El preview solo
  calcula (no necesita las cuentas) → no se bloquea si faltan. Al CONFIRMAR se resuelven
  desde settings con fallback al mapping; error claro solo si el lado realmente usado
  (ganancia neta → cuenta de ganancia; pérdida neta → cuenta de pérdida) no existe.

## 3. Implementación (2026-09-05)

- **Settings**: `AppSettings.journalEntryAutoExchangeDifference` (SystemSettings, default
  OFF; toggle en Parametrización → Contabilidad junto a las cuentas gain/loss).
- **Asientos manuales** (`JournalEntriesService.create/update`): con flag ON y exposición
  FX real (asiento NO uniforme: moneda por línea distinta o tasa por línea ≠ tasa del
  asiento), el desbalance en base se resuelve con una línea automática
  `_buildAutoExchangeDifferenceLine` — débito a pérdida / crédito a ganancia según el
  signo del residual, cuenta del settings o mapping `EXCHANGE_DIFFERENCE`, en moneda
  base. Sin cuentas ni mapping → error claro que orienta a Parametrización o a agregar la
  línea manualmente.
- **`post()` cuadra en MONEDA BASE** (`debitLocal`/`creditLocal` con fallback a importes
  crudos solo en asientos legados): habilita asientos multi-moneda balanceados en base
  que antes fallaban con 409 por sumar importes crudos de monedas distintas
  (verificado en vivo: Dr USD 100 @6.9 / Cr BOB 690 → antes "débitos 100 ≠ créditos 690").
- **Revaluación** (`ExchangeRateAdjustmentsService`): se quita la validación de cuentas de
  `_computeDetails` (compartido por preview y revaluate); el preview queda libre de la
  exigencia; `revaluate` resuelve cada lado con `_resolveExchangeAccount` (settings →
  mapping) y `buildRevaluationLines` valida solo el lado necesario.
- **Frontend**: toggle en Parametrización; en el form de asientos el guardar acepta el
  desbalance FX-originado (hint del monto que se cerrará) y un asiento uniforme
  desbalanceado sigue bloqueado; página de revaluación permite previsualizar sin cuentas
  (banner informativo).
- **Tests**: +5 backend (asiento manual: línea automática con flag ON, error estricto con
  OFF, uniforme desbalanceado NO se enmascara, error claro sin cuentas ni mapping;
  revaluación: preview sin cuentas + fallback al mapping al confirmar) + Karma del form y
  del toggle de settings. Suite backend **1577/1577** (150 suites), Karma y build AOT en verde.

## 4. Archivos tocados

- `backend-erp/src/settings/settings.service.ts|controller.ts`
- `backend-erp/src/journal-entries/journal-entries.service.ts|spec`
- `backend-erp/src/exchange-rate-adjustments/exchange-rate-adjustments.service.ts|spec`
- `erp-frontend/src/app/pages/settings/*` (modelo, form + toggle)
- `erp-frontend/src/app/pages/journal-entries/journal-entries-form.*`
- `erp-frontend/src/app/pages/reports/exchange-rate-revaluation/exchange-rate-revaluation.component.html`
- Docs: plan, AUDIT §8 (T7 ✅), ROADMAP, CHANGELOGs, guía (Anexo D si aplica)
