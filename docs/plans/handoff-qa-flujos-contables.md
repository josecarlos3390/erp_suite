# Handoff — QA flujos contables (ventas/compras/pagos/inventario) + posteo de compras

> Estado: **2026-09-06 — pendiente de continuar en la próxima sesión**.
> Creado como traspaso: al llegar al límite de contexto de la sesión anterior quedaron
> pasos a medio ejecutar. Este documento permite retomar sin pérdida.

## Objetivo
Generar flujos reales de ventas, compras, inventario y pagos (ejercicio 2027) y
verificar que cada **asiento contable** generado sea correcto (balanceado y con el
mapeo de cuentas esperado), cerrar con aserciones por cuenta y trial balance cuadrando.

## Contexto / normativa (verificado)
- IVA Bolivia **13%** (Ley 843). El motor tiene dos modos: **por fuera** (suma) y
  **por dentro/boliviano** (`isInclusive`, estrategias `standard` vs
  `bolivia-sin.tax-calculation.strategy.ts`). **El cálculo actual es correcto y NO se
  debe cambiar** (fijado por specs intencionales: `pricing.util.spec.ts`,
  `document-totals.util.spec.ts` caso DEL-000081).

## Estado ejecutado (base local `http://localhost:3001`, tenant `default`)
Credenciales: `admin/admin123` · login `POST /auth/login` body
`{username,password,tenantSlug:'default'}`; token `access_token ?? accessToken`.

- **Ejercicio 2026 cerrado** (períodos 12/12 + `CIERRE-GEST-2026` + CLOSED) y
  **2027 abierto** con apertura `APERTURA-GEST-2027` (1.525,59 cuadrada).
- **Series 2027 creadas** (FY id 2): `SI-2027` (id 6), `PI-2027` (id 7),
  `IP-2027` (id 8), `OP-2027` (id 9), `SE-2027` (id 10) — POST /document-series.
- **Venta `SI-1` (id 2, 10 × 100)** creada vía `POST /sale-invoices/manual` →
  asiento automático **`ASI-000005`** verificado: CxC (CLI-0001) D 1.000 · Ventas
  C 870 · IVA Débito C 130 · IT 3% D/C 30 · COGS D 247,05 vs Inventario C 247,05
  → **balanceado y mapeo correcto**.
- **Compra `PI-1` (id 2, 5 × 80 = 400)** creada vía `POST /purchase-invoices/manual`
  (body con `supplierId`, NO `partnerId` → 400 si se usa `partnerId`): quedó **OPEN y
  SIN asiento**.

## 🚩 Hallazgo pendiente — posteo de compras manuales
- `purchase-invoices.controller.ts` **no expone** `@Post(':id/confirm')` ni `:id/post`;
  `PATCH /purchase-invoices/:id` rechaza `status` (whitelist DTO).
- El asiento de compra lo genera la ruta de **confirmación interna** del servicio
  (`purchase-invoices.service.ts` ~L3281 `createPurchaseInvoiceJournalEntry`, con
  manejo de GRIR/recepción y tasas), pero la vía `/manual` crea OPEN sin invocarla
  (la venta `/manual` sí postea automáticamente).
- **Sospecha:** gap en la vía manual de compras (o la UI usa otro mecanismo para
  "Confirmar" que la API pública no replica).
- **Dato:** el trial global subió exactamente 400 tras `PI-1` (el importe), lo que
  sugiere que algo (costo/stock) sí se movió sin generar asiento `PURCHASE_INVOICE`.

## Próximos pasos (orden sugerido)
1. **Posteo de compras manuales**: rastrear en la UI de compras la acción "Confirmar"
   (método del service FE → endpoint real; revisar `from-receipt` vs `manual`).
   Decidir fix: crear manual CONFIRMED con asiento, o exponer la confirmación con su
   asiento; + test backend.
2. **Completar flujos 2027**: cobro (IP, INCOMING_PAYMENT contra SI-1), pago (OP,
   OUTGOING_PAYMENT contra PI-1), inventario (STOCK_ENTRY/EXIT/TRANSFER) con serie
   `SE-2027`; verificar asiento de cada uno (balance + cuentas).
3. **Cierre con aserciones**: trial balance global cuadra; diario/mayor/comprobación
   consistentes (endpoints `/reports/journal|trial-balance|general-ledger`).
4. Commits por repo (backend/frontend/root) + verificación Railway si aplica.

## Puntos de verificación rápidos (probes reutilizables en %TEMP%\erp-checklist-task)
- `audit-journals.mjs` / `audit-lines.mjs` — asientos balanceados y líneas por tipo.
- `flujos.mjs`, `venta2027.mjs`, `compra2027.mjs`, `pi-post.mjs`, `series2027.mjs`,
  `f6-cycle.mjs` — flujos y ciclo.
- `f6-check.mjs` / `f6-verify.mjs` — cuadratura reportes.
