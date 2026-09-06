# Handoff — QA flujos contables (ventas/compras/pagos/inventario) + posteo de compras

> Estado: **2026-09-06 — QA COMPLETADO EN VERDE** (ver §Resultado final).
> Este documento queda como trazabilidad del cierre; el hallazgo de posteo de compras
> manuales resultó ser un **falso positivo del probe** y se cerró con un fix de
> trazabilidad en `GET /journal-entries`.

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
  ➕ **Series faltantes creadas en esta sesión** (los flujos de inventario las exigen
  desde el rediseño 2026-09-04): `SX-2027` (STOCK_EXIT, id 11), `ST-2027`
  (STOCK_TRANSFER, id 12), `SA-2027` (STOCK_ADJUSTMENT, id 13).
- **Venta `SI-1` (id 2, 10 × 100)** creada vía `POST /sale-invoices/manual` →
  asiento automático **`ASI-000005`** verificado: CxC (CLI-0001) D 1.000 · Ventas
  C 870 · IVA Débito C 130 · IT 3% D/C 30 · COGS D 247,05 vs Inventario C 247,05
  → **balanceado y mapeo correcto**.
- **Compra `PI-1` (id 2, 5 × 80 = 400)** creada vía `POST /purchase-invoices/manual`
  (body con `supplierId`, NO `partnerId` → 400 si se usa `partnerId`): **SÍ generó
  asiento** `ASI-000006` (Inventario D 348 / IVA Crédito D 52 / CxP C 400) en la
  MISMA transacción de creación (221 ms después del create, mismo `$transaction`).

## 🚩 Hallazgo — posteo de compras manuales: RESUELTO (falso positivo)

- El handoff anterior afirmaba que `POST /purchase-invoices/manual` dejaba la compra
  **OPEN y SIN asiento**. La verificación empírica de esta sesión lo **descarta**:
  - `ASI-000006` existe (POSTED, `sourceDocumentType=PURCHASE_INVOICE`,
    `sourceDocumentId=2`), creado **automáticamente** dentro del `createManual`
    (`purchase-invoices.service.ts` → `_executeConfirmLogic` en la misma tx, que
    llama `createPurchaseInvoiceJournalEntry` ~L3281). La venta y la compra manual
    se comportan igual: ambas postean solas.
  - Causa raíz del falso positivo: **`GET /journal-entries` ignoraba los query params
    `sourceDocumentType`/`sourceDocumentId`** (el DTO solo soportaba
    page/limit/search/status/branchId). El probe del handoff anterior consultó con
    esos filtros, el endpoint devolvió el listado completo sin filtrar y el audit
    concluyó "SIN asiento" erróneamente. Incluso el dato reportado ("el trial global
    subió exactamente 400") era consistente con el asiento EXISTENTE (D 348 + D 52 =
    C 400).
- **Fix aplicado (backend):** soporte de filtros `sourceDocumentType` (validado contra
  el enum `JournalSourceType`, 400 con mensaje accionable si es inválido) y
  `sourceDocumentId` en `GET /journal-entries`:
  - `backend-erp/src/journal-entries/journal-entries.service.ts` (`findAll`)
  - `backend-erp/src/journal-entries/journal-entries.controller.ts` (query params)
  - Tests: `journal-entries.service.spec.ts` (+3: filtra por fuente, rechaza tipo
    fuera del enum, listado completo sin filtros) y `journal-entries.controller.spec.ts`
    (+1: forwarding de los filtros). Suite 20/20 en verde; build y lint OK.
  - Verificación live: `GET /journal-entries?sourceDocumentType=PURCHASE_INVOICE&sourceDocumentId=2`
    → `total: 1` (ASI-000006/PI-1); `SALE_INVOICE/2` → ASI-000005/SI-1; tipo inválido → 400.
- E2E de posteo de compras ya existente: `test/purchase-flow.e2e-spec.ts`
  ("Factura manual de servicio con IVA incluido genera asiento balanceado").

## Flujos 2027 completados en esta sesión (cada asiento verificado: balance + mapeo)

| Documento | Fecha | Asiento | Verificación |
|-----------|-------|---------|--------------|
| SI-1 (venta 1.000) | 2027-01-15 | ASI-000005 | CxC 1.000 / Ventas 870 / IVA Déb 130 / IT 30/30 / COGS 247,05 / Inv 247,05 ✅ |
| PI-1 (compra 400) | 2027-01-16 | ASI-000006 | Inv 348 / IVA Créd 52 / CxP 400 ✅ |
| IP-1 (cobro vs SI-1) | 2027-01-20 | ASI-000007 | Caja 1.000 / CxC 1.000 (CLI-0001); SI-1 → CLOSED, balanceDue 0 ✅ |
| OP-1 (pago vs PI-1) | 2027-01-21 | ASI-000008 | CxP 400 (SUP-0001) / Caja 400; PI-1 → CLOSED, balanceDue 0 ✅ |
| SE-1 (entrada 2×150) | 2027-01-22 | ASI-000009 | Inv 300 / Compensación 300 ✅ |
| SX-1 (salida 1 ud) | 2027-01-23 | ASI-000010 | Compensación 34,21 / Inv 34,21 ✅ |
| ST-1 (traspaso ALM-01→ALM-02) | 2027-01-24 | ASI-000011 | Inv destino 34,21 / Inv origen 34,21 ✅ |

Maestro usado: item `ART-00001`, cliente `CLI-0001` (id 1), proveedor `SUP-0001`
(id 2), almacén `ALM-01` (id 1) + `ALM-02` (id 2, creado para el traspaso, branch 1).

## Cierre con aserciones (todo en verde)

- **Trial balance 2027** (`/reports/trial-balance?from=2027-01-01&to=2027-12-31`):
  Dr = Cr = **4.971,06** · ΣSD = ΣSA = 2.821,38 → **cuadra**.
- **Diario** (`/reports/journal`) Dr = Cr = 4.971,06 → idéntico al trial.
- **Mayor general**: movimiento del mayor == movimiento del trial **por cuenta** (12/12
  cuentas OK) y `apertura + movimiento == cierre` en todas.
- **Aserciones por cuenta** (todas OK):
  - Caja M/N: 800 (apertura 200 + cobro 1.000 − pago 400)
  - CxC Clientes M/N: 0 (SI-1 cobrada)
  - CxP Proveedores M/N: −125 acreedor (apertura 125 + PI-1 400 pagada)
  - Ventas: −870 · IVA Débito: −156 · IVA Crédito: 68,25 · COGS: 247,05
  - Compensación de Inventario: −265,79 · IT: 30 · IT por Pagar: −36
- **Documentos:** SI-1 y PI-1 CLOSED con balanceDue 0; saldo socio CLI-0001 AR=0,
  SUP-0001 AP=125.

## Notas de ejecución / ambiente
- El backend local se reinició con el dist reconstruido (los probes verifican la
  versión nueva; el proceso se auto-gestiona en el puerto 3001).
- Probes reutilizables quedaron en `%TEMP%\erp-checklist-task` (api.mjs, estado.mjs,
  diario.mjs, cobro-pago.mjs, inventario.mjs, cierre2.mjs, filter-live.mjs, …).
- Commits: backend-erp (fix journal filters + tests) — ver `AUDIT.md` y CHANGELOG.
