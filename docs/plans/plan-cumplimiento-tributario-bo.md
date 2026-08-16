# Plan de cumplimiento tributario Bolivia (G2–G8) — Ley N° 843, T.O. SIN al 31/07/2026

> **Versión:** 1.0 — 2026-08-16
> **Origen:** Análisis de cumplimiento de la localización `BO` contra la Ley N° 843 y Decretos Reglamentarios (PDF oficial SIN, copiado a `docs/reference/LEY-843.pdf`, texto en `LEY-843.txt`).
> **Alcance:** brechas G2 a G8 identificadas en el análisis. **G1 (Facturación Electrónica SIN / F5.1) queda explícitamente FUERA de este plan** y sigue como feature prioritario independiente del roadmap.
> **Cómo usar este documento:** es autocontenido. Cada fase tiene fundamento normativo, archivos exactos, pasos, comandos de verificación y criterios de aceptación. Las fases son independientes entre sí salvo dependencia explícita; se recomienda ejecutarlas en orden (de menor a mayor tamaño) para acumular infraestructura (parámetros UFV, cuentas, reportes) que las fases grandes reutilizan.

---

## Estado actual verificado (baseline 2026-08-16)

Lo que **ya cumple** y NO se toca (salvo integración):

| Componente | Estado |
|---|---|
| IVA 13% por dentro (Art. 5/15) — estrategia `BOLIVIA_SIN`, indicador `IVA13SIN` | ✅ |
| Débito fiscal neto en factura con descuento (Art. 7) | ✅ |
| NC compra adiciona al débito fiscal (Art. 7 últ. párr.) | ✅ |
| NC/ND/devolución venta resta del impuesto (Art. 8 inc. b) | ✅ |
| IT 3% automático en FV/FRV/ND y reversas (Arts. 74–75) | ✅ |
| ICE ad valorem y específico por artículo (DS 24053) | ✅ |
| Retenciones type-aware en factura de compra y pago saliente (RC-IVA/IUE/IT) | ✅ |
| Reporte `GET /reports/tax-declaration` (Form 200) y `GET /reports/iva-books` (solo `BO`) | ✅ |
| Gating por país en `src/common/localization.profiles.ts` | ✅ |
| Períodos fiscales con bloqueo (`FiscalYear`/`AccountingPeriod`, DT.36) | ✅ |

**Reglas transversales (aplican a TODAS las fases):**

1. **Gating BO obligatorio:** toda lógica nueva de este plan vive detrás del perfil de localización (`getLocalizationProfile(countryCode)`) o de settings del tenant. Un tenant no-BO no debe ver campos, reportes ni asientos nuevos.
2. **Workflow incremental:** una fase = un batch = verificación de build + tests:
   ```bash
   cd backend-erp && npm run build && npm test
   cd erp-frontend && npm run build && npm run lint
   ```
3. **Schema:** cada cambio de schema requiere `npx prisma db push` (con el workaround del generador `typescript-interfaces` si aplica) + `npm run generate-types` en el frontend. Todo modelo nuevo lleva `tenantId` + `@@index([tenantId])`.
4. **Zero `as any`** en código de producción. DTOs con `class-validator`.
5. **Commits por fase** en el repo correspondiente (`--no-verify` desde el entorno del agente).
6. **Norma de referencia:** citar el artículo exacto de la Ley 843 (T.O. 31/07/2026) en el comentario del código que lo implementa (mismo criterio que DT.32–DT.35).

---

## Fase T1 — G8: ITF (Impuesto a las Transacciones Financieras) en pagos bancarios

> **Tamaño:** pequeño · **Prioridad:** baja · **Fundamento:** Ley N° 3446 (incluida en el T.O., sección ITF): grava con alícuota sobre débitos/créditos en cuentas bancarias; lo **percibe la entidad financiera**, pero el contribuyente debe **contabilizar el gasto** para cuadrar sus extractos.

> ✅ **COMPLETADA — 2026-08-16** (ver `ROADMAP.md` DT.45 y `AUDIT.md` S32).
> **Desviaciones respecto al alcance original:** (1) el cambio de schema se aplicó con SQL manual (`prisma/manual/20260816_add_itf_bank_charge_type.sql` vía `prisma db execute`) porque la BD de desarrollo tiene drift preexistente respecto a `prisma/migrations` (columnas aplicadas históricamente con `db push`) y `migrate dev` exigía reset destructivo; (2) `itfRate` quedó como campo informativo **sin default** (ni seed ni lógica) — la tasa vigente la define el tenant; (3) el selector de cargo se implementó en la pantalla de extractos (`bank-statement-form`), que es donde se asignan las cuentas a las líneas importadas. Backfill a tenants existentes: `POST /account-mappings/ensure-defaults` (idempotente). Verificación: 3 tests unitarios nuevos (26/26 en `bank-statements.service.spec.ts`), backend 136 suites/1338 tests, frontend 1292/1292 Karma, builds y lints en verde.

### Problema

Hoy un pago saliente/incoming con cargo bancario por ITF solo se refleja si el usuario lo asienta a mano. La conciliación bancaria (F5.5, ya implementada) importa extractos donde el ITF viene como cargo separado y no tiene cuenta ni asiento tipo.

### Alcance

1. **Schema (`backend-erp/prisma/schema.prisma`):**
   - `BankAccount`: agregar `itfRate Decimal? @db.Decimal(6,4)` (tasa configurable por cuenta; default `0.0030`… el valor vigente se deja al tenant — NO hardcodear en lógica, solo como default de seed).
2. **Backend:**
   - `src/bank-reconciliation/` (posting de movimientos del extracto): si el movimiento del extracto es tipo cargo ITF (clasificación manual del usuario), generar línea `Dr ITF Gasto (mapping-only, nuevo EntryType 'FINANCIAL_TRANSACTION_TAX' → cuenta sugerida 6.2.1.01.0xx) / Cr Banco`.
   - `src/common/accounting-entry-types.ts`: registrar el nuevo entry type.
   - `src/common/chart-of-accounts.data.ts`: cuenta `6.2.1.01.013` "ITF — Impuesto a las Transacciones Financieras" (gasto) + backfill a tenants existentes (patrón usado en DT.31).
3. **Frontend:** selector de tipo de cargo en la asignación de movimientos del extracto (pantalla bank-reconciliation existente).

### Verificación

- Test unitario: posting de extracto con cargo ITF genera el par Dr gasto / Cr banco y el mayor cuadra.
- E2E de conciliación existente sigue en verde.

### Criterio de aceptación

Un cargo ITF importado del extracto queda contabilizado con su cuenta propia y el saldo bancario cuadra contra el extracto sin asientos manuales.

---

## Fase T2 — G7: Actualización de valores por UFV (saldos a favor)

> **Tamaño:** pequeño · **Prioridad:** baja-media · **Fundamento:** Ley 843 Art. 9 (el saldo a favor del contribuyente en IVA se compensa **"con actualización de valor"**); CTB Arts. 45–47 (mantenimiento de valor por variación UFV).

> ✅ **COMPLETADA — 2026-08-16** (ver `ROADMAP.md` DT.46 y `AUDIT.md` S33).
> **Cambio de diseño respecto al alcance original (decisión del usuario): la UFV se modela como una moneda más.** No se creó la tabla `UfvRate`: `Currency.isIndexUnit` (nuevo flag) marca la UFV como unidad de índice no transaccional y sus cotizaciones diarias viven en `ExchangeRate` (par UFV→BOB), reutilizando CRUD, carga masiva, `getRateForDate` y la pantalla de tipos de cambio existente. En vez de una pantalla `/ufv` dedicada se agregó el modal **"Importar serie"** (pegar filas `fecha, valor`) en el listado de tasas de cambio, con `POST /exchange-rates/import` (upsert por fila, genérico para cualquier par). El Form 200 muestra las casillas "Saldo a favor mes anterior", "Saldo anterior actualizado UFV" (con cotizaciones usadas) y "Ajuste por actualización de valores (Art. 9)", con banner de warning cuando falta la UFV y nota de que el asiento de ajuste es manual del contador. `CurrencySelectorComponent` excluye unidades de índice por defecto (`includeIndexUnits`) para que la UFV no aparezca en selectores transaccionales. Backfill: SQL manual `prisma/manual/20260816_add_currency_is_index_unit_ufv.sql` (columna + moneda UFV en tenants BO); seed actualizado para tenants nuevos. Verificación: 5 tests unitarios nuevos del reporte (mes distinto, mismo valor, sin UFV, sin saldo, sin período), backend 137 suites/1343 tests, frontend 1292/1292 Karma, builds y lints en verde.

### Problema

El reporte `tax-declaration` arrastra el saldo a favor del contribuyente del mes anterior **sin actualizar** por UFV. En una economía con UFV móvil esto subvalora el crédito arrastrado.

### Alcance

1. **Schema:** modelo `UfvRate { tenantId, date, value Decimal(12,4), @@unique([tenantId, date]) }` — carga manual o import CSV (la BCB no expone API pública estable; no automatizar fetch en esta fase).
2. **Backend:**
   - `src/ufv/` (módulo nuevo pequeño): CRUD + `GET /ufv?from&to` + endpoint de import CSV.
   - `reports.service.ts` → `getTaxDeclarationReport`: cuando hay saldo a favor arrastrado de un período anterior, exponer `saldoFavorAnteriorActualizado = saldoAnterior × (ufvCierre / ufvAnterior)` y el `ajusteUfv` resultante. El ajuste se **expone en el reporte** (el asiento de ajuste es manual del contador — documentar esto en la pantalla).
3. **Frontend:** pantalla `/ufv` (listado + carga + import) en el grupo de configuración contable; columna "Saldo actualizado UFV" en la pantalla del Form 200.

### Verificación

- Tests unitarios del cálculo de actualización (3 casos: mismo mes, mes distinto, sin UFV cargada → warning explícito "UFV no cargada para el período").
- Si falta UFV de alguna fecha, el reporte **degrada con warning** y muestra el saldo sin actualizar (nunca calcula con tasa inventada).

### Criterio de aceptación

El Form 200 del mes N muestra el saldo a favor del mes N−1 actualizado por UFV y la diferencia identificada como "Ajuste por actualización de valores (Art. 9 Ley 843)".

---

## Fase T3 — G6: Ventas menores del POS (Art. 16 Ley 843) ✅ COMPLETADA (2026-08-16)

> **Tamaño:** mediano · **Prioridad:** media · **Fundamento:** Art. 16: ventas < Bs 5 (monto actualizable por el Poder Ejecutivo → **parametrizable**) no exigen nota fiscal individual, pero exigen **registro diario** y **una nota fiscal consolidada al final del día** por el total.
>
> **✅ Resultado (ver ROADMAP DT.47 / AUDIT S34):** settings `posConsolidateMinorSales` / `posMinorSalesThreshold` / `posGenericPartnerId`; schema `SaleInvoice.isMinorSale` / `isMinorSalesConsolidation` / `minorSalesCount` / `consolidatedInvoiceId` (SQL manual, sin `migrate dev` por drift preexistente); checkout marca la venta menor; endpoint `POST /pos-sessions/:id/consolidate-minor-sales` (+ `GET /:id/minor-sales-summary`); consolidada **documental** (sin ítems/stock/pagos/asientos — Form 200 inalterado); swap fiscal en Libro de Compras y Ventas (fila `CONSOLIDADA`); arqueo de caja y declaración jurada sin doble conteo; guardas de anulación. Frontend: sección en Configuración, bloque de cierre con botón Consolidar, badges en listado. Tests: 9 backend + 4 Karma nuevos; 138 suites/1357 backend y 1296 Karma en verde.
>
> **Decisiones respecto al alcance original:** (1) el cliente genérico es un **setting del tenant** (`posGenericPartnerId`), no un partner de sistema sembrado — el tenant elige/crea su "consumidor final"; (2) la consolidación es **endpoint manual desde el cierre de caja** (no automática) — el cajero decide cuándo consolidar y puede hacerlo más de una vez por sesión (cada corrida toma solo las pendientes); (3) la factura consolidada es **header-only** (sin ítems) para no distorsionar reportes por artículo ni duplicar stock.
>
> **⚠️ Hallazgo colateral crítico (AUDIT S35, gap nuevo G9):** el checkout del POS no genera asientos contables (ni factura ni cobros) — las ventas POS están fuera del libro mayor y del débito fiscal del Form 200. Requiere fase dedicada con decisión de diseño (bloqueo vs cola ante falta de determinación de cuentas) y backfill histórico.

### Problema

El POS (`src/pos/pos.service.ts`) crea una factura individual por cada venta, sea del monto que sea. Cumple de sobra para montos altos, pero no implementa el régimen de ventas menores (que el retail boliviano usa masivamente).

### Alcance

1. **Settings del tenant:** `salesMinorThreshold Decimal` (default 5.00, editable — la norma permite actualización por DS) + flag `posConsolidateMinorSales boolean`.
2. **Backend POS:**
   - En el checkout: si `total < threshold` y el flag está activo y el cliente es el genérico "consumidor final", la venta se marca `isMinorSale = true` y **no emite número de factura fiscal individual** (queda como registro interno de venta menor, con su asiento de ingreso normal — el IVA se devenga igual).
   - Nuevo endpoint `POST /pos-sessions/:id/consolidate-minor-sales` (o automático al cierre de sesión `PosSession`): genera **una factura consolidada** del día por la suma de ventas menores de la sesión, a nombre del cliente genérico "VENTAS MENORES DEL DÍA" (partner del sistema, NIT 0/sin NIT según parametrización), con el IVA 13% por dentro correspondiente.
   - Schema: `SaleInvoice.isMinorSalesConsolidation boolean @default(false)` y `SaleInvoice.minorSalesCount Int?` (trazabilidad: cuántas ventas menores consolidó). Marca inversa en la venta POS origen (`consolidatedInvoiceId Int?`).
3. **Frontend POS:** toggle en la configuración de la terminal/sesión; en el cierre de sesión, bloque "Ventas menores" con total, cantidad y botón/estado de la factura consolidada generada; la factura consolidada es visible en el listado con badge "Consolidada".

### Verificación

- Test unitario: N ventas menores → 1 factura consolidada con Σ exacta, IVA = Σ×13%, CxC contra el partner genérico; las ventas originales quedan vinculadas.
- Test E2E POS: checkout bajo el umbral no pide NIT; el cierre consolida.
- Regla de oro: **la suma de ingresos del período (Form 200) no cambia** — la consolidación es documental, no contable.

### Criterio de aceptación

Un día de retail con 40 ventas < Bs 5 genera 40 registros internos + **1** factura fiscal consolidada al cierre, con el IVA exacto y trazabilidad completa.

---

## Fase T3b — G9: Asientos contables del POS ✅ COMPLETADA (2026-08-16)

> **Tamaño:** mediano · **Prioridad:** alta · **Fundamento:** hallazgo colateral de T3 (AUDIT S35): el checkout del POS creaba factura CLOSED + pagos entrantes **sin invocar el motor contable** — toda venta retail quedaba fuera del libro mayor y del débito fiscal del Form 200 (basado en líneas de asientos POSTED), mientras el Libro de Compras y Ventas (basado en documentos) sí las incluía: discrepancia estructural entre ambos reportes fiscales.
>
> **✅ Resultado (ver ROADMAP DT.48 / AUDIT S35):** el checkout postea en la MISMA transacción el asiento de venta (`createSaleInvoiceJournalEntry` — idéntico al de una FV directa: Dr CxC / Cr Ventas netas / Cr IVA débito / Cr IT + Dr COGS / Cr Inventario, con netting uniforme `discountTotal=0` en las líneas) y un asiento por cada cobro (`createIncomingPaymentJournalEntry` — Dr Caja/Banco / Cr CxC), además de actualizar el saldo del partner (`totalInvoicedAR` + `totalPaidAR`). Backfill histórico idempotente `POST /pos/admin/backfill-accounting`. Tests: 3 backend nuevos; 138 suites/1360 tests en verde. Verificación en vivo completa (checkout + backfill con asientos balanceados y IVA completo).
>
> **Decisión de diseño (bloqueo vs cola): BLOQUEO** — si la determinación de cuentas falla, la transacción se revierte y el checkout se rechaza con el error del motor. Razones: (1) consistencia con el resto del ERP (una FV normal también se rechaza sin cuentas); (2) una cola reintroduciría el hueco G9 silenciosamente; (3) no existe infraestructura de jobs en el proyecto. La configuración de cuentas es un prerrequisito del setup, no una excepción del retail.

---

## Fase T4 — G4: Exportaciones — tasa cero IVA y exención IT (Arts. 11 y 76 inc. c) ✅ COMPLETADA (2026-08-16)

> **✅ Resultado (ver ROADMAP DT.49 / AUDIT S36):** schema `TaxIndicator.isZeroRated` (tasa cero CON crédito vs exento SIN crédito) + `SaleInvoice.isExport` (marca documental) con SQL manual `prisma/manual/20260816_add_export_tasa_cero.sql` y seed del indicador `TASA_CERO`; journal builder: documento `isExport` → sin TAX_OUTPUT (Art. 11) ni IT (Art. 76 inc. c), **ingreso íntegro** (el impuesto embebido se devuelve al neto de la línea) y `discountDebit` corregido para no generar SALES_DISCOUNT fantasma; la NC de una factura de exportación no revierte IT; `isExport` persistido en los 7 paths de FV (DTO común) y en el POS (false); Form 200: exportaciones **fuera de la base gravada interna** + sección `exportaciones` con total/base/cantidad, `creditoFiscalAtribuible` (crédito del período × `exportCreditAttributionPct`, setting del tenant) y `excedenteEstimadoReintegro` (el trámite CEDEIM es externo — asiento manual documentado); frontend: toggle "Exportación" en la factura de venta y sección en la pantalla del Form 200. Tests: 2 unitarios del reporte + 1 E2E; backend 138 suites/1362 tests, E2E 81/81, frontend build/lint + Karma en verde. Verificación en vivo: FV de exportación → asiento CxC = Ventas = total, sin IVA/IT/SALES_DISCOUNT, balanceado; reporte con la sección completa.
>
> **Decisión de diseño (documental vs por línea):** gate **documental** (`isExport`) para IVA/IT + indicador `TASA_CERO` para marcar las líneas (una factura mixta usa líneas TASA_CERO en la porción de exportación; el gate documental garantiza que el asiento nunca emita débito/IT aunque la línea use un indicador estándar).

> **Tamaño:** mediano · **Prioridad:** media · **Fundamento:** Art. 11 (exportaciones liberadas del débito fiscal; crédito fiscal de insumos computable contra operaciones internas; el excedente se **reintegra** vía notas de crédito negociables); Art. 76 inc. c (IT: exportaciones **exentas**); DS 21530 Arts. 42–46 (procedimiento tasa cero).

### Problema

No existe indicador de tasa cero distinto del `EXENTO` genérico (seed solo crea `IVA13`, `EXENTO`, `IVA13SIN`); una venta de exportación hoy se trataría como exenta **sin** derecho a crédito fiscal de insumos — exactamente al revés de la norma (tasa cero **con** crédito). Además el IT se calcula sobre toda venta, incluida una eventual exportación.

### Alcance

1. **Seed (`prisma/seed.ts` + `tenant-seed.util.ts`):** indicador `TASA_CERO` (`rate: 0`, `calculationMethod: 'STANDARD'`, flag nuevo `isZeroRated: true` en `TaxIndicator` para distinguir tasa cero **con** crédito de exento **sin** crédito — la distinción es sustantiva, no cosmética).
2. **Backend:**
   - Marcar líneas/documentos de exportación: `SaleInvoice.isExport boolean @default(false)` (o por línea si se requiere mixto — decidir en diseño; SAP B1 lo maneja por línea con indicador).
   - `sales.journal-builder.ts`: documento/línea de exportación → **no genera** línea de débito fiscal ni de IT (exención Art. 76 c); registra el ingreso contra CxC M/E con su moneda.
   - `tax-declaration`: nueva sección "Operaciones de exportación" — ventas tasa cero del período, crédito fiscal atribuible a insumos de exportación (configurable por % o por marca en la compra), excedente estimado sujeto a reintegro (Art. 11). El reintegro en sí (CEDEIM/notas negociables) es un trámite externo: el ERP expone la cifra y deja el asiento de reintegro como asiento manual documentado.
3. **Frontend:** toggle "Exportación" en la factura de venta (solo visible si tenant BO y partner extranjero o país ≠ BO), columnas en el reporte Form 200.

### Verificación

- Test unitario: FV exportación → sin TAX_OUTPUT, sin IT, ingreso íntegro; el Form 200 la muestra en la sección tasa cero y no en ingresos gravados.
- Test de no-regresión: venta interna con indicador `EXENTO` sigue sin débito y **sin** arrastre de crédito.

### Criterio de aceptación

Una factura de exportación se contabiliza a tasa cero con IT exento, y el reporte de declaración separa correctamente base gravada interna vs. exportaciones con su crédito fiscal atribuible.

---

## Fase T5 — G5: Prorrateo del crédito fiscal (operaciones mixtas) ✅ COMPLETADA (2026-08-16)

> **✅ Resultado (ver ROADMAP DT.50 / AUDIT S37):** schema `PurchaseInvoice.creditUse` (TAXABLE/EXEMPT/MIXED, default TAXABLE) con SQL manual `prisma/manual/20260816_add_purchase_credit_use.sql` y persistencia en los 8 paths de compra; util `fiscal-credit-proration.util.ts` con la fórmula `gravadas / (gravadas + exentas + tasa cero)` del año en curso (provisional; en diciembre la definitiva); Form 200 con la sección `prorrataCreditoFiscal` (porcentaje, composición YTD, desglose directo/prorrateado/no computable/computable y **asiento de reclasificación propuesto** que el contador confirma); frontend: selector "Uso del crédito fiscal" en la factura de compra y sección en la pantalla del Form 200. Tests: 6 unitarios de la util + 2 del reporte; backend 139 suites/1370 tests, E2E 81/81, frontend en verde. Verificación en vivo: reporte con prorrata 100% (circuito todo gravado) y desglose coherente.
>
> **Decisiones de diseño:** (1) campo a nivel de **documento** (no por línea) — la clasificación del uso es una decisión de la compra; (2) la prorrata usa los **totales del año en curso** (YTD) — provisional mensual y definitiva en diciembre; (3) el crédito no computable NO se reclasifica automáticamente: el reporte **propone el asiento** (`Dr Gasto / Cr IVA Crédito Fiscal`) y el contador lo confirma (la cuenta del mayor se mantiene como fuente de verdad hasta la reclasificación).

> **Tamaño:** mediano · **Prioridad:** media · **Fundamento:** Ley 843 Art. 8 inc. a (crédito solo de compras **vinculadas a operaciones gravadas**) y DS 21530 Arts. 8–9 / sección Crédito Fiscal (cuando las adquisiciones sirven indistintamente a operaciones gravadas y no gravadas/tasa cero, el crédito se apropia **en proporción** — determinación mensual provisional y definitiva anual).

### Problema

Hoy **todo** el crédito fiscal del mes se computa íntegro (cuenta `1.1.6.01.001`). Un contribuyente con ventas mixtas (gravadas + exentas) sobreestima su crédito — contingencia fiscal directa en una fiscalización.

### Alcance

1. **Clasificación de uso de la compra:** campo `creditUse` en `PurchaseInvoice` (o por línea, según diseño): `TAXABLE` (100% crédito) / `EXEMPT` (0%) / `MIXED` (prorrateo). Default `TAXABLE` (comportamiento actual).
2. **Backend (`reports.service.ts` + nuevo helper `src/common/fiscal-credit-proration.util.ts`):**
   - Cómputo mensual del **porcentaje de prorrata**: `prorrata = ventasGravadas / (ventasGravadas + ventasExentas + tasaCero)` del año en curso (provisional) con cierre definitivo en diciembre (DS 21530).
   - En `tax-declaration`: crédito fiscal mostrado desglosado en `directo (TAXABLE) + prorrateado (MIXED × prorrata)`, con la parte **no computable** identificada como mayor gasto/costo (reclasificación contable manual asistida: el reporte propone el asiento de ajuste `Dr Gasto / Cr IVA Crédito Fiscal` por la porción no computable, que el contador confirma).
3. **Frontend:** selector de uso del crédito en el form de factura de compra (visible solo BO); sección de prorrata en la pantalla del Form 200 con el % aplicado y su composición.

### Verificación

- Tests unitarios del cálculo de prorrata (casos: 100% gravado, mixto 70/30, con tasa cero, ajuste anual definitivo).
- Test: compra `EXEMPT` no aporta a `creditoFiscal` del reporte aunque tenga IVA en el asiento (queda como gasto).
- Redondeo a 2 decimales, tolerancia 0.01.

### Criterio de aceptación

Un tenant con 30% de ventas exentas ve en su Form 200 el crédito fiscal de compras MIXED reducido al 70%, con el asiento de reclasificación propuesto y trazable.

---

## Fase T6 — G3: RC-IVA declarativo (Form 110, dependientes y terceros) ✅ COMPLETADA (2026-08-16)

> **✅ Resultado (ver ROADMAP DT.51 / AUDIT S38):** schema `WageParam` (SMN por gestión historizado), `PayrollRcIva` (cálculo por empleado/período con arrastre de saldos a favor) y `EmployeeTaxCreditInvoice` (facturas presentadas por el dependiente, crédito = 13%) — SQL manual `prisma/manual/20260816_add_rc_iva_declarativo.sql`; módulo `src/rc-iva/` con el motor (sueldo − aportes 12.71% → neto − 2×SMN → 13% − crédito por facturas ± saldo anterior; Ley 843 Arts. 26-31, DS 21529) y endpoints (SMN upsert, CRUD de facturas del dependiente, `calculate`, listado por período, reporte de terceros consolidado por beneficiario desde las retenciones de compras, Art. 19 inc. g); frontend: `/reports/rc-iva-dependientes` (parámetros SMN, cálculo por empleado, máscara del Form 110, CRUD de facturas) y `/reports/rc-iva-terceros` (consolidado de agente de retención) en el menú de reportes. Tests: 5 unitarios del motor (ejemplo canónico SIN, crédito con arrastre, validaciones, terceros); backend 140 suites/1375 tests, E2E 81/81, frontend en verde. Verificación en vivo: SMN 2500 + factura 500 (crédito 65) + sueldo 8000 → impuesto 192.82 (257.82 − 65).
>
> **Decisiones de diseño:** (1) el sueldo bruto es **input por período** (F6.6 Nómina aún no existe — el motor es un paso explícito del contador); (2) el crédito por facturas se arrastra como **saldo a favor hasta agotarse**; (3) el asiento de retención de planilla queda como **asiento manual con la cifra del reporte** (documentado en pantalla) hasta que exista nómina; (4) la declaración es externa (portal SIN) — el ERP produce la máscara y la trazabilidad.

> **Tamaño:** grande · **Prioridad:** alta · **Fundamento:** Ley 843 Título II: alícuota 13% (Art. 30), imputación **por lo percibido** (Art. 28), mínimo no imponible de **2 SMN** para dependientes (Art. 26), deducción de aportes a la seguridad social (Art. 25), compensación con el 13% de facturas de compras del dependiente (Art. 31 + DS 21529), Formulario 110 para el fisco y Form 110 de terceros (agentes de retención a profesionales/consultores independientes, Art. 19 inc. g).
> **Dependencia parcial:** la parte de **dependientes** (planillas de sueldos) solapa con F6.6 Nómina (pendiente). Esta fase implementa el **motor RC-IVA + terceros** completo y deja la integración con planillas acotada a lo que ya existe en `Employee`.

### Problema

La retención RC-IVA se **contabiliza** bien (cuenta 2.1.2.01.006/007, type-aware desde DT.34), pero no existe: cálculo del impuesto del dependiente (neto de aportes, menos 2 SMN, menos 13% de sus facturas del Form 110), ni el reporte declarativo (Form 110 / RC-IVA terceros), ni el control del SMN vigente.

### Alcance

1. **Settings/params:** `minimumWage Decimal` (SMN vigente, editable por gestión — historizar: `WageParam { tenantId, year, smn }`).
2. **RC-IVA terceros (independientes/consultores):**
   - Flujo ya casi cubierto: factura de compra con retención RC-IVA 13% (DT.34). Completar con **reporte** `GET /reports/rc-iva-terceros?from&to`: detalle por beneficiario (NIT/CI, nombre, monto pagado, retención 13%, formulario correspondiente) — respaldo de la declaración como agente de retención.
3. **RC-IVA dependientes (motor):**
   - Nuevo modelo `PayrollRcIva { tenantId, employeeId, period(yyyy-mm), grossSalary, socialContributions, netTaxable, minNonTaxable(2×SMN), invoicesCredit(13% de facturas presentadas), taxDue, balancePrevMonth, balanceNextMonth }`.
   - Endpoint `POST /payroll/rc-iva/calculate` por período + `GET /reports/rc-iva-dependientes` (máscara del Form 110 por empleado: sueldo neto, 2 SMN, facturas, saldo anterior, impuesto retenido, saldo a favor).
   - Registro de las **facturas presentadas por el dependiente** (mini-CRUD `EmployeeTaxCreditInvoice { employeeId, period, nit, invoiceNumber, amount }` → crédito = 13% del monto, tope normativo según DS 21529).
   - La retención calculada alimenta el asiento de planilla (si nómina F6.6 aún no existe al ejecutar esta fase, el asiento es manual con la cifra del reporte; documentarlo).
4. **Frontend:** pantallas `/rc-iva/dependientes` (grilla por empleado y período, con detalle del cálculo) y `/rc-iva/terceros`; CRUD de facturas del dependiente dentro del detalle del empleado.

### Verificación

- Tests unitarios del motor con el ejemplo canónico SIN: sueldo 8,000 → aportes 12.71% → neto, −2 SMN, −13% facturas → impuesto y arrastre de saldo a favor del mes siguiente.
- Test: tercero consultor con factura 10,000 → retención 1,300 en el reporte y en el mayor (cuenta 2.1.2.01.007).
- Caso borde: saldo a favor que se arrastra N meses y se agota.

### Criterio de aceptación

El sistema produce el detalle del Form 110 por empleado y período, con arrastre de saldos a favor, y el reporte de terceros como agente de retención, ambos cuadrando contra las cuentas del mayor.

---

## Fase T7 — G2: IUE anual (25%) y compensación mensual contra el IT

> **Tamaño:** grande · **Prioridad:** alta · **Fundamento:** Ley 843 Título III: 25% sobre la **utilidad neta imponible** (Art. 50), pérdidas arrastrables (Art. 48), ajuste por inflación y mantenimiento de valor (DS 24051), y **Art. 77**: el IUE pagado se computa como **pago a cuenta del IT** mensual hasta su agotamiento; el saldo no compensado al nuevo vencimiento se consolida a favor del fisco (no hay devolución).
> **Dependencia:** conviene ejecutarla **después de T2 (UFV)** — el IUE exige ajuste por inflación sobre partidas no monetarias (DS 24051), que usa la misma infraestructura de tasas. Reutiliza `FiscalYear`/`AccountingPeriod` (DT.36).

### Problema

No existe determinación del IUE: el IT se provisiona mensual (3%) pero la compensación IUE↔IT se hace fuera del sistema, y no hay Form 500 (declaración anual IUE) ni control del saldo de pago a cuenta.

### Alcance

1. **Determinación de la base (versión contable-primero):**
   - Nuevo reporte/motor `GET /reports/iue?fiscalYear=YYYY`: parte del **resultado contable del año** (cuentas de resultado del plan, POSTED) y aplica **ajustes fiscales configurables** (`IueAdjustment { tenantId, fiscalYear, concept, amount, sign }`: no deducibles +, ingresos exentos −, actualización por inflación, depreciación fiscal vs. contable de activos fijos — enlazar con `fixed-assets` para la depreciación a tasas DS 24051: ya existe depreciación lineal; esta fase agrega la **tasa fiscal por categoría** si difiere).
   - Resultado: `utilidadNetaImponible`, `IUE = 25%`, menos pagos anticipados/compensaciones → saldo a pagar o a favor (pérdida arrastrable, Art. 48).
2. **Compensación IT (Art. 77):**
   - Modelo `ItCompensation { tenantId, period, itDeterminado, iuePagoACuentaAplicado, itAPagar, iueSaldoRestante }`.
   - `tax-declaration` (Form 200): nueva casilla "Pago a cuenta IUE" que descuenta el IT determinado hasta agotar el saldo del IUE pagado; persistir el arrastre mes a mes. Regla de cierre: al nuevo vencimiento anual del IUE, el saldo no compensado se consolida a favor del fisco (se expone para asiento manual de baja).
3. **Asientos:** al determinar el IUE del año → asiento propuesto `Dr Gasto IUE (6.x) / Cr IUE por Pagar (2.1.2.01.005)`; al pagarlo, `Dr IUE por Pagar / Cr Banco` + registro del saldo disponible para compensación. La aplicación mensual contra IT **no** re-asienta (el gasto IT ya está devengado por documento); la compensación es declarativa y se refleja en el reporte y en un asiento de reclasificación opcional `Dr IUE por Pagar-compensación / Cr IT por Pagar` (decisión de diseño: documentar la elegida).
4. **Frontend:** pantalla `/reports/iue` (determinación anual con ajustes editables) y sección de compensación en la pantalla del Form 200 (IT determinado, pago a cuenta aplicado, IT a pagar, saldo IUE restante).

### Verificación

- Tests unitarios: determinación (utilidad contable ± ajustes → 25%), compensación mensual con agotamiento del saldo a mitad de año, consolidación del remanente al nuevo vencimiento, pérdida arrastrable aplicada al año siguiente (tope normativo).
- Test de integración con el Form 200: IT del período − pago a cuenta = importe a pagar, cuadrando con `ItCompensation`.
- E2E ligero del endpoint con año fiscal cerrado.

### Criterio de aceptación

Cerrado el año fiscal, el ERP calcula el IUE (25%) con sus ajustes, genera el asiento propuesto, y durante el año siguiente cada Form 200 descuenta el IT con el pago a cuenta hasta agotarlo — con trazabilidad completa del saldo.

---

## Resumen de fases y esfuerzo

| Fase | Brecha | Tamaño | Prioridad | Dependencias |
|------|--------|--------|-----------|--------------|
| T1 | G8 — ITF en conciliación/pagos | Pequeño | Baja | ✅ Completada (2026-08-16, DT.45/S32) |
| T2 | G7 — UFV y actualización de saldos | Pequeño | Baja-media | ✅ Completada (2026-08-16, DT.46/S33) |
| T3 | G6 — Ventas menores POS (Art. 16) | Mediano | Media | ✅ Completada (2026-08-16, DT.47/S34) |
| T3b | **G9 — Asientos contables del POS** (hallazgo S35: el checkout no postea al mayor) | Mediano | **Alta** | ✅ Completada (2026-08-16, DT.48/S35) — bloqueo + backfill |
| T4 | G4 — Exportaciones tasa cero (Arts. 11, 76-c) | Mediano | Media | ✅ Completada (2026-08-16, DT.49/S36) |
| T5 | G5 — Prorrateo crédito fiscal (DS 21530 Art. 8-9) | Mediano | Media | ✅ Completada (2026-08-16, DT.50/S37) |
| T6 | G3 — RC-IVA declarativo (Form 110) | Grande | Alta | ✅ Completada (2026-08-16, DT.51/S38) — integración con nómina F6.6 pendiente |
| T7 | G2 — IUE 25% + compensación IT (Arts. 50, 77) | Grande | Alta | T2 (UFV), F6.4 (períodos, ya hecho) |

**Orden sugerido de ejecución:** T1 → T2 → T3 → **T3b (recomendada por materialidad fiscal)** → T4 → T5 → T6 → T7 (de menor a mayor riesgo; T2 antes que T7 es funcional, no solo cosmético).

## Criterios de aceptación globales del plan

1. Cada fase deja `npm run build` + `npm test` (backend) y `npm run build` + `npm run lint` (frontend) en verde, con tests nuevos por feature.
2. Toda cifra declarativa (Forms 110/200/500/605) es trazable hasta asientos POSTED o documentos con estado válido — nunca a datos editables sin respaldo.
3. Un tenant no-BO no ve ninguna de estas pantallas, campos ni asientos (gating verificado con test o inspección de perfil).
4. `docs/guides/ACCOUNTING_ENTRIES_GUIDE.md` se actualiza con cada asiento nuevo introducido (ITF, IUE, consolidación POS), y `AUDIT.md` registra el cierre de cada fase.

---

*Última actualización: 2026-08-16*
