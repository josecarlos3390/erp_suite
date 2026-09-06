# Handoff — QA E2E flujos UI (ventas/compras/inventario/POS/kardex/trazabilidad)

> Estado: **2026-09-06 — QA COMPLETADO EN VERDE** (ver §Resultado).
> Este documento es la trazabilidad del QA por UI (Playwright) de los flujos críticos
> del ERP sobre la base local (`http://localhost:3001`, tenant `default`,
> `admin/admin123`) con el entorno E2E preparado (FY `GEST-2026` abierto + 26 series
> `E2E-*` con prefijos clásicos, tasa USD/BOB 6,96 al 2026-09-06).

## Objetivo
Recorrer por la INTERFAZ los flujos de ventas, compras, inventario, pagos y POS para
verificar que: los documentos se crean, toda la información se visualiza, los
movimientos de stock y el costo se replican, los asientos contables se generan y la
trazabilidad (serie/lote/UoM) funciona — sin huecos entre formularios.

## Metodología
- Cada spec de flujo se corrió **aislado** sobre entorno limpio (reset de BD →
  backend fresco → prep E2E → 1 spec). Los specs comparten tenant y NO son
  independientes entre sí: correr varios en una misma invocación contamina el estado
  (400/500 cruzados) — verificado empíricamente; por eso la ejecución es 1-a-1.

## Specs en verde (aislados, proyecto chromium)

| Spec | Resultado | Cobertura |
|------|-----------|-----------|
| `qa-purchase-receipt-invoice-payment.spec.ts` | 7/7 | Recepción → factura de compra → pago (UI) |
| `qa-sales-flow.spec.ts` | 8/8 | Cotización → pedido → entrega → factura (UI) |
| `qa-purchase-flow.spec.ts` | 6/6 | Solicitud → cotización → pedido compra (UI) |
| `qa-stock-flow.spec.ts` | 5/5 | Entrada/salida/ajuste de inventario (UI) |
| `traceability-flow.spec.ts` | 3/3 | Trazabilidad serie/lote y mapa de documento |
| `sales-full-journey-ui.spec.ts` | 6/6 | Journey completo de venta (UI) |
| `purchase-full-journey-ui.spec.ts` | 6/6 | Journey completo de compra (UI) |
| `kardex.spec.ts` | 6/6 | Kardex por artículo (con movimientos sembrados) |
| `pos-ui.spec.ts` | 2/2 | **POS**: abrir caja → vender por interfaz → factura creada |

## Hallazgos reales destapados por el QA (ambos RESUELTOS)

### T16 — Backend: asiento POS desbalanceado por montos sin redondear (500)
- El checkout POS de factura NORMAL fallaba con 500 «Asiento desbalanceado en
  SALE_INVOICE … D=15.707193 C=15.709193 (diff=-0.002)» cuando las líneas llevaban
  montos con >2 decimales (IVA 13 % inclusivo → `taxAmount` 1.872; COGS 0.877193 del
  avgCost).
- Causa raíz: `JournalEntryBuilder.addLine` (choke point de todos los builders)
  persistía montos sin redondear; `_assertBalanced` validaba el balance ANTES de
  persistir contra columnas `Decimal(14,2)` — la BD habría redondeado y cuadrado.
- Fix: `addLine` redondea debit/credit (y expresiones en moneda base) a 2 decimales.
  Spec nuevo `journal-entry-builder.spec.ts` (+5). Suites: engine 106/106,
  pos.service 26/26, backend completo 154 suites/1635 tests. Ver `AUDIT.md` T16.

### T17 — Frontend: el POS no replicaba la lista de precios del cliente (400)
- El backend POS SIEMPRE re-resuelve el precio con la lista del socio al facturar:
  para CLI-00008 (Lista VIP) ART-00016 se cobra a **14.40** aunque su precio base es
  18.00. La UI del POS (cards → modal → carrito) mostraba/cobraba el precio base:
  el binding del modal usaba `selectedProduct?.price` (18) en vez del
  `resolvedPrice` (14.4), y el modal se abría antes de que llegara la resolución
  asíncrona → el pago (Bs 18) excedía el total del backend (Bs 14.4) → 400.
- Fix (diseño acordado): el catálogo sigue mostrando el precio de la lista por
  defecto del sistema; al **seleccionar** el artículo (modal o quick-add) la UI
  aplica la jerarquía del cliente (`resolvePriceBulk`) ANTES de abrir/agregar;
  binding del modal a `resolvedPrice ?? price`. Cambiar de cliente ya recalcula el
  carrito con líneas. Karma POS +4 → 46/46; build AOT OK.
- Verificación live tras el fix: factura **FVE-1 por 14.40** con asiento
  `ASI-000001` POSTED balanceado. Ver `AUDIT.md` T17.

## Otros ajustes de la sesión
- `pos-ui.spec.ts`: locator de búsqueda por `aria-label` real («Buscar producto o
  código», con acento) y manejo de los diálogos «¿Registrar con factura normal?» y
  «¡Venta Exitosa!» (el host `luna-modal`/`app-confirm-dialog` no tiene caja →
  apuntar al contenido visible, patrón exchange-revaluation-ui.spec.ts).
- `qa-sales-flow.spec.ts`: aserción del título del formulario por
  `getByRole('heading', …)` (evita strict-mode con el breadcrumb duplicado).
- Baselines PNG de QA visual regenerados (`qa-sales-quotation-form.png`,
  `qa-purchase-request-copy-menu.png`).

## Notas de ejecución / ambiente
- Backend local reiniciado con dist reconstruido; prep E2E reutilizable en
  `%TEMP%\erp-checklist-task\prep-e2e-env.mjs` (FY 2026 OPEN + 26 series).
- **Baterías finales en verde:** backend completo 154 suites / 1635 tests; Karma
  global frontend **1459/1459**; Karma POS 46/46; builds AOT backend y frontend OK.
- La BD quedó en estado E2E (FY2026 abierto) y se RESTAURÓ al final al backup
  original `backend-erp/backups/erp-backup-2026-09-06_08-11-43.dump` (FY2026 cerrado
  con CIERRE-GEST-2026, FY2027 abierto con APERTURA-GEST-2027 y documentos 2027).
- Commits: backend-erp (T16) + erp-frontend (T17 y specs) — ver `AUDIT.md` T16/T17 y
  CHANGELOGs.
