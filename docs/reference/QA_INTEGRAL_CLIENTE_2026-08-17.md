# QA Integral en Rol Cliente — 2026-08-17

Batería completa (`scripts/qa-battery/run.js`): limpieza total de BD → 10 scripts de flujos → validación integral. Se ejecutó como el cliente que adquiere el ERP probando todas las combinaciones de compras, ventas, inventario, pagos, precios y trazabilidad.

## Resultado global

- **Flujos base (01-08): TODO EN VERDE** — compras, ventas, inventario, POS, reversas.
- **Nuevo 09 (precios/jerarquías): 13/13 EN VERDE**.
- **Nuevo 10 (trazabilidad): 3 hallazgos documentados (H1×3, H2×2) — sin bugs de stock/contabilidad**.
- **Validación integral (04): TODO EN VERDE** con todos los flujos nuevos incluidos.

## Lo validado y en VERDE

### Flujos de compras
PREQ → PCOT → PO → REC → FRC (con descuento header 10%), compra directa (FCP), multi-cotización → PO multi → REC multi → FRC multi, NC de compra (Art. 7 último párr. adiciona al débito), devolución de compra sin NC (cierra GRIR), retenciones múltiples (RC-IVA + IUE + IT), pago saliente con retención.

### Flujos de ventas
COT → PED → DEL → FRV (10% + NC/DEV pareadas), FV directa desde pedido, FRV pre-factura, multi-cotización → PED multi → DEL multi → FRV multi, exportación tasa cero (Art. 11, sin IVA/IT), pago entrante parcial, anticipo + aplicación, pago mixto cash/card, anulación de factura CLOSED (devuelve stock), cancelación de DEL, ND (monto bruto → IVA 13 + IT 3%), NC manual con montos automáticos, factura mixta gravado+exento, línea de servicio (sin stock), USD con tipo de cambio, facturación parcial (DEL 2/5 → FRV 2), negativos (stock, NC>facturado, pago>saldo, FV sin almacén).

### POS
Checkout mixto con vuelto explícito (Σ pagos = total, excedente = cashReceived), negativos (pago excede/insuficiente, sin sesión), ventas menores (Art. 16) con asiento individual + consolidación diaria documental, cierre de caja exacto (1166/1166), reapertura con continuidad.

### Reversas y cancelaciones
ND (saldo + IVA débito/IT por neto), NC manual, NC sobre FRV (reabre por el total de la NC), NC de FV directa (stock vuelve a salir + reversa), NC con abono + rechazo si el abono fue usado, cancelar pago entrante (FV reabre), NC parcial multi-descuento con prorrateo exacto.

### Stock y costos (kardex)
Físico = Σ movimientos en TODOS los artículos (9 artículos × almacén, incl. ALM-02), valor de stock = cuenta Inventario 132 (27560.67 vs 27560.70), costo promedio coherente, LOTE-001/002 stockBatch = Σ movimientos, costo de entrada 33.06 (38×0.87), deltas de stock correctos en toda la cadena de lote (REC +6 → DEL −3 → NC +1 → cancel −1 → DEV +1), series AVAILABLE→SOLD en DEL.

### Jerarquía de precios (nueva cobertura 09)
En cotizaciones sin precio (el backend resuelve):
1. Acuerdo partner precio FIJO (PROMO-VIP 5200) gana a todo ✓
2. Acuerdo partner % vigente (10%) gana al descuento de grupo (5%) ✓
3. Qty-breaks por tramos ascendentes: ≤4 → 5% (1995), >4 → 12% (1848) ✓
4. Acuerdo VENCIDO ignorado → cae a la lista ✓
5. Acuerdo FUTURO ignorado → cae a la lista ✓
6. Escalas de lista por cantidad: qty1 → 35, qty3 → 29.9155 (5% sobre precio de lista 31.49), qty8 → 30 (priceResult) ✓
7. Descuento de GRUPO (ELEC 5%) cuando no hay acuerdo ✓
8. Lista del partner (PL-MAYOR 225.01) ✓
9. Multi-descuentos MIXTOS: COT header 10% + COT línea 5% consolidados → FRV conserva pct por línea (5/10) → NC parcial hereda el 10% con prorrateo exacto (1644.30/245.70 = ×0.5) ✓
10. Jerarquía almacén→sucursal: ALM-03 (sin sucursal) e inexistente rechazados; ALM-02 aceptado ✓

### Contabilidad (validación integral con todos los flujos)
- 88 asientos balanceados, 0 desbalanceados, 0 vacíos ✓
- GRIR = 0 (cerrado) ✓
- CxC mayor = Σ ventas − NC − pagos (34846.24) = saldo CLI-00001 ✓
- CxP mayor = Σ compras − NC − pagos (65410.47) = saldo PROV-00001 ✓
- Form 200: base neta 42444.24, IVA débito 13% = 5632.41, IT 3% = 1273.33, exportaciones 3990 fuera de base ✓
- Libro IVA = mayor (5632.41) ✓
- Ecuación contable global: A 80900.92 = P+E 72870.98 + Resultado 8029.94 ✓

## Hallazgos — estado actualizado (2026-08-17, tras fixes)

**H1, H2 y H3 RESUELTOS** (commit backend `6282125`): FV directa y FRC heredan el tracking de lote/serie del documento base; las series vendidas se re-ingresan por NC y DEV (check de almacén solo para AVAILABLE); el auto-descuento manual solo aplica sobre el precio base. La batería 01-10 + validación integral quedó **TODO EN VERDE** tras los fixes. **H4 queda como decisión de negocio pendiente** (ver abajo).

## Hallazgos (originales)

### H1 (P1) — La factura no hereda la trazabilidad de lote/serie del documento base
La FV directa desde DEL y la FRC desde REC tienen **0 registros** de `documentLineTracking` con el lote/serie, mientras que REC, DEL, NC y DEV sí lo registran. La trazabilidad documental se corta en la **factura fiscal** (no se puede demostrar con la FV/FRC qué lote/serie se facturó). El stock del lote sí se mueve correctamente — es un gap de trazabilidad documental, no de inventario.
- Evidencia: `tracking_lote_FRC = 0`, `tracking_lote_FV = 0`, `tracking_serie_FV = 0`.
- Fix sugerido: propagar los `trackingAssignments` del documento base (deliveryOrderItem/receiptItem) a las líneas de la FV/FRC en `from-delivery`/`from-receipt`.

### H2 (P1) — No existe camino para devolver una serie vendida
Tanto la **NC de venta** como la **DEV de venta** rechazan una serie en estado SOLD: `"El número de serie SN-100 no se encuentra en el almacén seleccionado"`. El ciclo AVAILABLE → SOLD no tiene retorno: un cliente que devuelve un artículo seriado no puede ser documentado (ni con NC ni con devolución). El flujo de cancelación de NC con serie existe en código (pone SOLD), pero el confirm de la NC exige la serie en almacén.
- Fix sugerido: permitir el re-ingreso de series SOLD por NC/DEV de venta (validar que la serie pertenece al documento que se devuelve, no que esté disponible en almacén).

### H3 (P2, observación) — Auto-descuento sobre el precio del payload en documentos manuales
`resolveAutoDiscount` se aplica sobre el **precio enviado** en documentos manuales: FV manual con price 350 → 322 (8% grupo INFO); FRV manual con price 322 → 296.24 (otro 8%). Correcto si el frontend siempre envía el precio bruto, pero si algún día envía un precio ya descontado (p.ej. desde una cotización con descuento), el descuento se aplicaría **dos veces**. Requiere convención explícita: el frontend envía siempre el precio bruto; el backend descuenta.

### H4 (P3, nota de diseño) — El descuento de grupo gana al acuerdo de lista con qty-breaks
En la jerarquía winner-takes-all, el nivel 3 (descuento de grupo) se evalúa antes que el nivel 4 (acuerdo de lista): un artículo del grupo INFO (8%) nunca recibe el qty-break de PROMO-MAYOR (5/10/15%) aunque el partner sea mayorista. Es el comportamiento documentado del resolver, pero comercialmente la promoción por volumen de lista es inalcanzable para grupos con descuento. Decidir si se quiere composición (grupo + break) o se mantiene winner-takes-all.

## Cobertura nueva aportada
- `09-precios.js` (13 checks): jerarquía de precios completa, escalas por cantidad, vigencia por periodo, multi-descuentos mixtos, almacén→sucursal.
- `10-trazabilidad.js` (20 checks): cadena completa de lote y serie con stockBatch, stock físico, costos y estados en cada documento.

*Ejecutado contra backend 3001 y limpieza previa completa. Informe generado tras la corrida íntegra.*
