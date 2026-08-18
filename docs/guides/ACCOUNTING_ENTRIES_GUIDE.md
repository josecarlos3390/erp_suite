# Guía de Asientos Contables por Documento

> **Referencia:** Estructura de asientos basada en SAP Business One  
> **Versión:** 1.0  
> **Fecha:** 2026-07-17

---

## 📋 Índice

1. [Principios Fundamentales](#principios-fundamentales)
2. [Documentos de Venta](#documentos-de-venta)
3. [Documentos de Compra](#documentos-de-compra)
4. [Documentos de Stock](#documentos-de-stock)
5. [Documentos de Pago/Cobro](#documentos-de-pagocobro)
6. [Validaciones y Reglas](#validaciones-y-reglas)

---

## 🎯 Principios Fundamentales

### **Regla de Oro:**
```
Todo documento que afecta el inventario, las cuentas de mayor
o los terceros (partners) DEBE generar un asiento contable.
```

### **Momento de Generación:**
- **Al confirmar** el documento (no al guardar como borrador)
- El asiento debe ser **reversible** si se cancela el documento

### **Estructura de un Asiento:**
```
Asiento balanceado: Suma(Débitos) = Suma(Créditos)

Cada línea incluye:
- Número de línea
- Cuenta contable (accountId)
- Débito o Crédito (nunca ambos)
- Descripción
- Referencia al documento origen
- Dimensiones (proyecto, sucursal, etc.)
```

---

## 📦 Documentos de Venta

### **1. SALE INVOICE (Factura de Venta)**

**Momento:** Al confirmar la factura

```
┌─────────────────────────────────────────────────────────────────┐
│  FACTURA DE VENTA: FV-001 | Cliente: ABC Corp | Total: $1,150    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Líneas del documento:                                           │
│  - Item 001: Laptops x 10 @ $100 = $1,000                       │
│  - IVA 13%: $130                                                  │
│                                                                   │
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  CxC (ACCOUNTS_RECEIVABLE)           $1,150           │
│    Descripción: "Factura Venta FV-001 — Cliente: ABC Corp"       │
│    Partner: ABC Corp                                             │
│    Referencia: SALE_INVOICE #FV-001                              │
│                                                                   │
│  Línea 2:                                                        │
│    Crédito:  Ingresos por Venta (SALES_REVENUE)    $1,000         │
│    Descripción: "Ingreso — FV-001"                               │
│    Partner: ABC Corp                                             │
│    Item: Laptops                                                  │
│    Referencia: SALE_INVOICE #FV-001, línea 1                    │
│                                                                   │
│  Línea 3:                                                        │
│    Crédito:  IVA Débito Fiscal (TAX_OUTPUT)          $130           │
│    Descripción: "IVA Débito Fiscal — FV-001"                     │
│    Referencia: SALE_INVOICE #FV-001                              │
│    Tax Indicator: IVA 13%                                        │
│                                                                   │
│  TOTALES: Débitos: $1,150 = Créditos: $1,150 ✅                   │
└─────────────────────────────────────────────────────────────────┘
```

**Lógica de Determinación de Cuentas:**
- `CxC`: `partner.receivableAccountId` → AccountMapping fallback
- `Ingresos`: `accountMapping` con `entryType = 'SALES_REVENUE'`
- `IVA`: `taxIndicator.salesAccountId` → AccountMapping fallback

**Costo de Ventas (si se afecta inventario):**
```
Si el artículo es INVENTARIED y no es RESERVA:

Línea 4:
  Débito:  COGS (Costo de Ventas)             $600
  Descripción: "Costo de Ventas — FV-001"
  Item: Laptops
  Warehouse: Almacén Central
  Referencia: SALE_INVOICE #FV-001, línea 1

Línea 5:
  Crédito: Inventario                        $600
  Descripción: "Salida Inventario — FV-001"
  Item: Laptops
  Warehouse: Almacén Central
  Referencia: SALE_INVOICE #FV-001, línea 1
```

---

### **2. SALES CREDIT NOTE (Nota de Crédito de Venta)**

**Momento:** Al confirmar la nota de crédito

```
┌─────────────────────────────────────────────────────────────────┐
│  NOTA DE CRÉDITO: NC-001 | Cliente: ABC Corp | Total: $230     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Referencia: Factura FV-001 (devolución parcial 20%)            │
│                                                                   │
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  Cuenta de Ingreso por Venta (SALES_CREDIT) $200      │
│    Descripción: "Reversa Ingreso — NC-001"                       │
│    Partner: ABC Corp                                             │
│    Referencia: SALES_CREDIT_NOTE #NC-001, ref: FV-001           │
│                                                                   │
│  Línea 2:                                                        │
│    Débito:  IVA Débito Fiscal (TAX_OUTPUT)           $26           │
│    Descripción: "Reversa IVA Débito — NC-001"                    │
│    Referencia: SALES_CREDIT_NOTE #NC-001, ref: FV-001           │
│                                                                   │
│  Línea 3:                                                        │
│    Crédito:  CxC (ACCOUNTS_RECEIVABLE)             $226           │
│    Descripción: "Nota de Crédito Venta NC-001 — CxC"            │
│    Partner: ABC Corp                                             │
│    Referencia: SALES_CREDIT_NOTE #NC-001                         │
│                                                                   │
│  TOTALES: Débitos: $226 = Créditos: $226 ✅                      │
└─────────────────────────────────────────────────────────────────┘
```

**Si incluye reversa de costo (artículo inventariable):**
```
Línea 4:
  Débito:  Inventario                        $120
  Descripción: "Re-ingreso Inventario — NC-001"

Línea 5:
  Crédito:  COGS                               $120
  Descripción: "Reversa COGS — NC-001"
```

> ⚠️ **Factura de RESERVA (FRV) vs factura NORMAL (FV) — quién mueve inventario**
> (espejo del caso de compras, verificado 2026-08-13):
>
> | Documento | Mueve inventario | Acompaña a | NC / reversa |
> |---|---|---|---|
> | **FRV** (Factura de Reserva de Venta, `isReserve='Y'`) | ❌ **NO** — la mercadería ya salió por la entrega (la FRV es solo financiera: `Dr CxC / Cr Ingresos / Cr IVA Débito`) | **SIEMPRE una entrega** | La NC/Devolución no revierte stock por la factura; el COGS lo revierte la **Devolución de Venta** (documento logístico) |
> | **FV** (Factura de Venta normal, `isReserve='N'`) | ✅ **SÍ** — descarga inventario (COGS / INVENTORY) en la propia factura | Venta **sin entrega** (factura directa) | La **NC de venta** revierte el stock si `returnsStock` (Dr INVENTORY / Cr COGS) |
>
> **Regla operativa:** la factura de **reserva** acompaña SIEMPRE al documento logístico
> (recepción en compras, entrega en ventas) y **no mueve inventario por sí sola** — el
> movimiento de stock lo hace el documento logístico. La factura **normal** mueve
> inventario directamente (descarga/ingresa stock). Por eso el circuito de ventas con
> entrega debe usar la **FRV**, y el circuito de compras con recepción debe usar la
> **FRC** — mezclar factura normal con documento logístico rompe el balance de inventario
> (doble descarga) y deja GRIR con residual.

> ⚠️ **NC sobre factura YA COBRADA (abono / saldo a favor) — split CxC + Anticipo (2026-08-18):**
> cuando la NC de venta supera la deuda pendiente de la factura (`debtCovered =
> min(total NC, balanceDue)`), la parte reembolsable NO sobre-acredita la CxC: el
> asiento acredita **CxC por la deuda cubierta** y **Anticipo Clientes**
> (`ADVANCE_RECEIVABLE`, 2.1.5.01.001) por el reembolsable. La NC genera un **abono**
> (pago entrante `isAdvance`) por ese reembolsable; al **aplicarlo** a otra factura
> (`/incoming-payments/reconcile`) se postea el asiento `ADVANCE_APPLICATION`:
> **Dr Anticipo Clientes / Cr CxC** (el favor del cliente extingue su deuda). El saldo
> del socio: `totalCreditedAR = debtCovered` (la NC manual sin factura acredita el
> total) y `advanceAR = +refundable` al crear el abono, `−amount` al aplicarlo. El
> Form 200/libros no cambian: la NC total sigue contando completa (Art. 8 inc. b).

---

### **3. DELIVERY ORDER (Remito de Entrega)**

**Momento:** Al confirmar el remito

**Se usa SOLO si NO hay factura generada (entrega sin facturar)**

```
┌─────────────────────────────────────────────────────────────────┐
│  REMITO DE ENTREGA: REM-001 | Cliente: ABC Corp               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ASIENTO CONTABLE (solo si no hay factura):                     │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Por cada línea de item (costo):                                 │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  COGS                                $600            │
│    Descripción: "Costo de Ventas — REM-001"                     │
│    Item: Laptops                                                  │
│    Quantity: 10                                                  │
│    Warehouse: Almacén Central                                    │
│    Referencia: DELIVERY_ORDER #REM-001, línea 1                  │
│                                                                   │
│  Línea 2:                                                        │
│    Crédito:  Inventario                          $600            │
│    Descripción: "Salida Inventario — REM-001"                   │
│    Item: Laptops                                                  │
│    Quantity: 10                                                  │
│    Warehouse: Almacén Central                                    │
│    Referencia: DELIVERY_ORDER #REM-001, línea 1                  │
│                                                                   │
│  TOTALES: Débitos: $600 = Créditos: $600 ✅                      │
└─────────────────────────────────────────────────────────────────┘
```

**NOTA:** Si luego se factura la misma entrega, la factura NO genera asiento de inventario (solo CxC e Ingresos).

---

### **4. SALES RETURN (Devolución de Venta)**

**Momento:** Al confirmar la devolución

```
┌─────────────────────────────────────────────────────────────────┐
│  DEVOLUCIÓN DE VENTA: DEV-001 | Cliente: ABC Corp             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  Ingreso por Venta (SALES_RETURN)     $500           │
│    Descripción: "Reversa Ingreso — DEV-001"                      │
│    Partner: ABC Corp                                             │
│    Item: Laptops (5 unidades devueltas)                           │
│    Referencia: SALES_RETURN #DEV-001                            │
│                                                                   │
│  Línea 2:                                                        │
│    Débito:  IVA Débito Fiscal (TAX_OUTPUT)           $65           │
│    Descripción: "Reversa IVA — DEV-001"                           │
│    Referencia: SALES_RETURN #DEV-001                            │
│                                                                   │
│  Línea 3:                                                        │
│    Débito:  Inventario (re-ingreso)                $300           │
│    Descripción: "Re-ingreso Inventario — DEV-001"                │
│    Item: Laptops                                                  │
│    Quantity: 5                                                   │
│    Referencia: SALES_RETURN #DEV-001                            │
│                                                                   │
│  Línea 4:                                                        │
│    Crédito:  CxC (ACCOUNTS_RECEIVABLE)             $865           │
│    Descripción: "Devolución Venta DEV-001 — CxC"                │
│    Partner: ABC Corp                                             │
│    Referencia: SALES_RETURN #DEV-001                            │
│                                                                   │
│  Línea 5:                                                        │
│    Crédito:  COGS (reversa)                      $300           │
│    Descripción: "Reversa COGS — DEV-001"                         │
│    Item: Laptops                                                  │
│    Referencia: SALES_RETURN #DEV-001                            │
│                                                                   │
│  TOTALES: Débitos: $1,230 = Créditos: $1,230 ✅                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📥 Documentos de Compra

### **5. PURCHASE RECEIPT (Entrada de Mercadería)** ⭐ **CRÍTICO**

**Momento:** Al confirmar la recepción

```
┌─────────────────────────────────────────────────────────────────┐
│  ENTRADA DE MERCADERÍA: EM-001 | Proveedor: XYZ Ltda          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Ítems recibidos: 10 Laptops @ $100 costo c/u                    │
│                                                                   │
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  Inventario (INVENTORY)               $1,000           │
│    Descripción: "Entrada Inventario — EM-001"                   │
│    Item: Laptops                                                  │
│    Quantity: 10                                                  │
│    Warehouse: Almacén Central                                    │
│    Referencia: PURCHASE_RECEIPT #EM-001, línea 1                │
│                                                                   │
│  Línea 2:                                                        │
│    Crédito:  GRIR / Dotación (GRIR)                 $1,000           │
│    Descripción: "GRIR — EM-001"                                  │
│    Item: Laptops                                                  │
│    Warehouse: Almacén Central                                    │
│    Referencia: PURCHASE_RECEIPT #EM-001, línea 1                │
│                                                                   │
│  TOTALES: Débitos: $1,000 = Créditos: $1,000 ✅                   │
└─────────────────────────────────────────────────────────────────┘
```

**Lógica:** Separar recepción física de la factura fiscal

> **Display del documento (2026-08-13):** la recepción es un documento **logístico**
> (solo maneja costo): el asiento capitaliza inventario al costo (`line.totalCost`) y
> **no genera deuda ni IVA** — el IVA/CxP viven en la factura (FRC/FPI). Por eso el
> bloque de totales muestra solo **"Costo total"** (+ peso si > 0) y NO Subtotal/IVA/Total
> financiero (mismo criterio que SAP B1 GRPO / Odoo / NetSuite). Se aplica igual a las
> **Devoluciones** (compra/venta) y la **Entrega de venta** (COGS al costo): `showPrimaryTotals=false`
> en `document-totals-section`. Fix visual puro — el asiento no cambia.

**Cuando llega la factura de compra, el GRIR se revierte:**
```
Línea 1:
  Débito:  GRIR / Dotación (GRIR)           $1,000
  Descripción: "Reversa GRIR — Factura FC-001"
  Referencia: PURCHASE_INVOICE #FC-001, ref: EM-001

Línea 2:
  Crédito:  CxP (ACCOUNTS_PAYABLE)          $1,000
  Descripción: "Factura Compra FC-001 — CxP"
  Partner: XYZ Ltda
  Referencia: PURCHASE_INVOICE #FC-001
```

---

### **6. PURCHASE INVOICE (Factura de Compra)**

**Momento:** Al confirmar la factura

```
┌─────────────────────────────────────────────────────────────────┐
│  FACTURA DE COMPRA: FC-001 | Proveedor: XYZ Ltda | $1,130     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Ítems facturados: 10 Laptops @ $100 = $1,000                   │
│  IVA 13%: $130                                                    │
│                                                                   │
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Caso 1: Artículo INVENTARIED                                    │
│  ──────────────────────────────────────────────────────────────   │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  GRIR (reversa recepción)             $1,000           │
│    Descripción: "GRIR — FC-001"                                   │
│    Referencia: PURCHASE_INVOICE #FC-001, ref: EM-001             │
│                                                                   │
│  Línea 2:                                                        │
│    Débito:  IVA Crédito Fiscal (TAX_INPUT)           $130           │
│    Descripción: "IVA Crédito Fiscal — FC-001"                    │
│    Tax Indicator: IVA 13%                                        │
│    Referencia: PURCHASE_INVOICE #FC-001                         │
│                                                                   │
│  Línea 3:                                                        │
│    Crédito:  CxP (ACCOUNTS_PAYABLE)                $1,130         │
│    Descripción: "Factura Compra FC-001 — CxP"                   │
│    Partner: XYZ Ltda                                             │
│    Referencia: PURCHASE_INVOICE #FC-001                         │
│                                                                   │
│  TOTALES: Débitos: $1,130 = Créditos: $1,130 ✅                   │
│                                                                   │
│  Caso 2: Artículo NO INVENTARIED (servicio/gasto)               │
│  ──────────────────────────────────────────────────────────────   │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  Cuenta de Gasto (PURCHASES)             $1,000       │
│    Descripción: "Compra — FC-001"                                │
│    Item: Servicios                                                │
│    Referencia: PURCHASE_INVOICE #FC-001, línea 1                │
│                                                                   │
│  Línea 2:                                                        │
│    Débito:  IVA Crédito Fiscal (TAX_INPUT)            $130       │
│    Descripción: "IVA Crédito Fiscal — FC-001"                    │
│    Referencia: PURCHASE_INVOICE #FC-001                         │
│                                                                   │
│  Línea 3:                                                        │
│    Crédito:  CxP (ACCOUNTS_PAYABLE)                $1,130       │
│    Descripción: "Factura Compra FC-001 — CxP"                   │
│    Partner: XYZ Ltda                                             │
│    Referencia: PURCHASE_INVOICE #FC-001                         │
│                                                                   │
│  TOTALES: Débitos: $1,130 = Créditos: $1,130 ✅                   │
└─────────────────────────────────────────────────────────────────┘
```

**Factura con descuento de cabecera (BOLIVIA_SIN, IVA por dentro):** cuando el descuento
está en la **misma factura**, el crédito fiscal se calcula sobre el **neto facturado**
(Ley 843, Art. 8, inc. a: "sobre el monto de las compras... que se los hubiesen
facturado"). El 13% del IVA del descuento queda **absorbido en el crédito fiscal neto**
(no hay línea separada). **Costeo NETO (NIC 2):** el descuento de cabecera se **prorratea
al costo de las líneas** (costo = priceNet × ratio) — el inventario se valora neto del
descuento (234.90/ud en el ejemplo) y el asiento NO registra "Descuentos" como ingreso
(el descuento queda embebido en el costo). El mecanismo del Art. 7 último párr.
(adicionar al débito) aplica SOLO a ajustes posteriores (NC de compra). Ejemplo real
(FRC-000107, bruto 1,500, descuento 10% = 150):

```
Dr  GRIR — Mercancías Recibidas             1,174.50   (costo neto: 5 × 234.90)
Dr  IVA — Crédito Fiscal                      175.50   (13% del neto facturado 1,350)
Cr  CxP Proveedores M/N                     1,350.00   (bruto − descuento)
    Totales: 1,350 / 1,350 ✅   →  crédito fiscal neto: 175.50, costo unitario: 234.90
```

> 🌎 **Alcance — Solo Bolivia (countryCode `BO`):** el tratamiento del IVA del descuento
> (desglose 87/13, crédito/débito fiscal neto sobre el facturado, mecanismos del Art. 7
> último párr. y Art. 8 de la **Ley 843**) aplica **únicamente** para la localización
> Bolivia, alineado al SIN. Está **gated por perfil de localización**:
> `splitPurchaseDiscountBaseTax`/`splitSaleDiscountBaseTax` son `true` solo para `BO`
> (`localization.profiles.ts`) e `isBoliviaSIN` exige el perfil BO — un tenant PE/XX con
> indicador BOLIVIA_SIN **no** desglosa 87/13 ni adiciona al débito. El **costeo neto**
> del descuento al costo (**NIC 2**, costo de adquisición neto de descuentos comerciales)
> es norma internacional y aplica en todos los países.

> ⚠️ **Factura de RESERVA (FRC) vs factura NORMAL (FCP) — quién mueve inventario**
> (verificado en circuito 2026-08-13, item 24 de `AUDIT.md`):
>
> | Documento | Mueve inventario | Acompaña a | NC / reversa |
> |---|---|---|---|
> | **FRC** (Factura de Reserva de Compra, `isReserve='Y'`) | ❌ **NO** — la mercadería ya entró por la recepción (solo cierra GRIR con `Dr GRIR / Dr IVA / Cr CxP`) | **SIEMPRE una recepción** (`from-receipt`) | La NC **NO** revierte stock (`returnsStock=false`): **reabre GRIR** (`Cr GRIR`) para que la **Devolución de Compra** posterior lo cierre (`Dr GRIR / Cr INVENTORY`) |
> | **FCP** (Factura de Compra normal, `isReserve='N'`) | ✅ **SÍ** — capitaliza/descarga inventario directamente | Compra **sin recepción** (factura directa) | La NC **SÍ** revierte stock (`returnsStock=true`): **descarga inventario** (`Cr INVENTORY`) |
>
> **Regla operativa:** en el circuito con recepción (`cotización → PO → recepción → FRC → NC → devolución`)
> la factura **debe ser la FRC de reserva**. Si se usa una FCP normal cuando hay recepción, la NC
> descarga inventario Y la devolución lo vuelve a descargar → **inventario doblemente descargado y
> GRIR con residual**. El circuito verificado cuadra solo con la FRC de reserva:
> GRIR = 0, INVENTORY = 704.70 (3 uds × 234.90), CxP = 810, stock físico = 3, avgCost = 234.90.

---

### **7. PURCHASE CREDIT NOTE (Nota de Crédito de Compra)**

**Momento:** Al confirmar la nota de crédito

> **⛳ Criterio normativo (IVA Bolivia):** la NC de compra es una **devolución/descuento
> obtenido** en un período **posterior** a la factura: el comprador **ADICIONA al débito
> fiscal** la alícuota sobre el importe de la NC — **Ley 843, Art. 7, último párrafo**:
> "Al impuesto así obtenido se le adicionará el que resulte de aplicar la alícuota
> establecida a las devoluciones efectuadas, rescisiones, descuentos, bonificaciones o
> rebajas **obtenidas** que, respecto del precio neto de las compras efectuadas, hubiese
> logrado el responsable en dicho período". NO reduce el crédito ya computado en la factura.
> Reglamento: **D.S. 21530, Art. 7** (aplica a operaciones que dieron lugar al cómputo del
> crédito fiscal, Art. 8 de la Ley). Reglamentación NCD: **RA 05-0043-99** (devolución
> total/parcial; el comprador sujeto pasivo admite devoluciones parciales sin devolver la
> factura original).

La NC de compra es el **ajuste posterior** del asiento de la factura: reabre el GRIR por el
costo **neto** (el descuento de cabecera ya está embebido en el costo — costeo neto NIC 2)
y **adiciona al débito fiscal** el 13% del importe de la NC (Art. 7 último párr.). NO
revierte la cuenta de Descuentos (no existe línea de descuento en la factura neta). Aplica
**total o parcial** (los montos se prorratean por la cantidad devuelta); el tratamiento de
cuentas es idéntico.

> 🌎 **Alcance — Solo Bolivia (countryCode `BO`):** el mecanismo del **Art. 7 último párr.**
> (la NC de compra **adiciona al débito fiscal** la alícuota sobre el importe de la NC)
> aplica **únicamente** para la localización Bolivia. En países **NO Bolivia** (PE/XX), la
> NC de compra revierte el IVA contra **TAX_INPUT (crédito fiscal)** — el tratamiento
> estándar —, sin adicionar al débito. El gating vive en `isBoliviaSIN` (perfil BO) en
> `purchases.journal-builder.ts` y `localization.profiles.ts`.

```
┌──────────────────────────────────────────────────────────────────────┐
│  NOTA DE CRÉDITO COMPRA — Caso A: factura de RESERVA (FRC)          │
│  Factura origen: FRC-001 (reserva, descuento 10%) | Total NC: $1,350 │
├──────────────────────────────────────────────────────────────────────┤
│  La FRC NUNCA movió inventario (solo ALLOCATION), por lo que su NC   │
│  tampoco: NO toca inventario. Reabre el GRIR que la FRC cerró (por   │
│  el costo NETO, sin línea de Descuentos) para que la Devolución de   │
│  Compra posterior cuadre (Dr GRIR).                                  │
│                                                                      │
│  Línea 1:                                                           │
│    Débito:  CxP (ACCOUNTS_PAYABLE)                   $1,350         │
│    Descripción: "Nota de Crédito Compra NCC-001 — CxP"             │
│    Partner: proveedor                                              │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-001                        │
│                                                                      │
│  Línea 2:                                                           │
│    Crédito:  GRIR (reabre la recepción)              $1,174.50      │
│    Descripción: "Reversa Compras — NCC-001"                         │
│    Item + Almacén (matriz GRIR)                                     │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-001, línea 1              │
│                                                                      │
│  Línea 3:                                                           │
│    Crédito:  IVA — Débito Fiscal (Art. 7)             $175.50      │
│    Descripción: "Reversa IVA Débito (Art. 7) — NCC-001"            │
│    Tax Indicator: IVA 13% SIN                                       │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-001                        │
│                                                                      │
│  TOTALES: Débitos: $1,350 = Créditos: $1,350 ✅                      │
└──────────────────────────────────────────────────────────────────────┘
```

> ℹ️ **Aclaración (crédito vs débito fiscal):** la NC de **compra** NO reduce el crédito
> fiscal de la factura (ese crédito ya quedó computado en el período de la FRC): per la
> Ley 843, **Art. 7 último párr.**, el comprador **ADICIONA al débito fiscal** la alícuota
> (13%) sobre el importe de la NC ($175.50 en el Caso A = 13% × 1,350). La factura con
> descuento en la misma hoja usa el **crédito neto directo** (Art. 8, inc. a). En
> **ventas** es el espejo: la NC/devolución de venta **resta del impuesto**
> (Dr IVA — Crédito Fiscal) por **Art. 8, inc. b**.

```
┌──────────────────────────────────────────────────────────────────────┐
│  NOTA DE CRÉDITO COMPRA — Caso B: factura normal (no reserva)       │
│  con retorno de stock (returnsStock)                                │
├──────────────────────────────────────────────────────────────────────┤
│  La mercadería SÍ sale del inventario (vuelve al proveedor). La NC   │
│  revierte la cuenta de compra por el monto y el inventario por el    │
│  costo; la diferencia (monto − costo) va a Devoluciones sobre        │
│  Compras.                                                           │
│                                                                      │
│  Línea 1:                                                           │
│    Débito:  CxP (ACCOUNTS_PAYABLE)                   $200           │
│    Descripción: "Nota de Crédito Compra NCC-002 — CxP"             │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-002                        │
│                                                                      │
│  Línea 2:                                                           │
│    Crédito:  Inventario (por el COSTO)                $180           │
│    Descripción: "Salida Inventario — NCC-002"                       │
│    Item + Almacén (matriz inventario)                               │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-002, línea 1              │
│                                                                      │
│  Línea 3 (si monto ≠ costo):                                        │
│    Crédito:  Devoluciones sobre Compras (PURCHASE_CREDIT)   $0      │
│    (diff > 0 → Crédito; diff < 0 → Débito)                         │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-002, línea 1              │
│                                                                      │
│  Línea 4:                                                           │
│    Crédito:  IVA — Crédito Fiscal (TAX_INPUT, reversa)     $20      │
│    Descripción: "Reversa IVA Crédito — NCC-002"                     │
│    Tax Indicator: IVA 13% SIN                                       │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-002                        │
│                                                                      │
│  TOTALES: Débitos: $200 = Créditos: $200 ✅                          │
└──────────────────────────────────────────────────────────────────────┘
```

**Reglas de negocio de la NC de compra:**

- `returnsStock` solo aplica a facturas **NO reserva** (`isReserve === 'N'`); la FRC nunca
  devuelve stock (su reversión logística es la **Devolución de Compra**, no la NC).
- La NC **libera el `invoicedQty`** de la recepción y del pedido al confirmarse (restaura
  al cancelarse), para que la Devolución de Compra posterior no falle por "cantidad no
  facturada".
- La NC revierte el costo **neto** de la factura origen (el descuento de cabecera ya está
  embebido en el costo — costeo neto NIC 2), por lo que NO revierte la cuenta de
  Descuentos; el IVA se adiciona al débito fiscal (Art. 7 último párr.).

---

> ⚠️ **NC de compra sobre factura YA PAGADA (abono proveedor) — split CxP + Anticipo Proveedores (2026-08-18):**
> simetría con ventas: la parte reembolsable NO sobre-debita la CxP — el asiento debita
> **CxP por la deuda cubierta** y **Anticipo Proveedores** (`ADVANCE_PAYABLE`, 1.1.2.05.001)
> por el reembolsable (activo: el proveedor nos debe). El **abono saliente** (`isAdvance`)
> al aplicarse (`/outgoing-payments/reconcile`) postea `ADVANCE_APPLICATION`:
> **Dr CxP / Cr Anticipo Proveedores** (la deuda del proveedor a nuestro favor extingue
> la nuestra). Saldo del socio: `totalCreditedAP = debtCovered`; `advanceAP = +refundable`
> al crear el abono, `−amount` al aplicarlo. **Stock:** la devolución de mercadería sale al
> **costo de la compra original** (la NC pasa `incomingUnitCost` al `upsertStock` con delta
> negativo) para que el avgCost cuadre con el asiento (Cr INVENTORY por `lineCost`).

## 📦 Documentos de Stock

### **8. STOCK TRANSFER (Traspaso de Stock)**

**Momento:** Al confirmar el traspaso

```
┌─────────────────────────────────────────────────────────────────┐
│  TRASPASO: TR-001 | Origen: Almacén Central → Destino: Tienda   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Por cada línea de item transferido:                            │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  Inventario Destino                   $500            │
│    Descripción: "Traspaso Inventario Dest — TR-001"             │
│    Item: Laptops                                                  │
│    Quantity: 5                                                   │
│    Warehouse: Tienda (destino)                                   │
│    Contra-cuenta: Inventario Origen                               │
│    Referencia: STOCK_TRANSFER #TR-001, línea 1                  │
│                                                                   │
│  Línea 2:                                                        │
│    Crédito:  Inventario Origen                    $500            │
│    Descripción: "Traspaso Inventario Orig — TR-001"             │
│    Item: Laptops                                                  │
│    Quantity: 5                                                   │
│    Warehouse: Almacén Central (origen)                           │
│    Contra-cuenta: Inventario Destino                              │
│    Referencia: STOCK_TRANSFER #TR-001, línea 1                  │
│                                                                   │
│  TOTALES: Débitos: $500 = Créditos: $500 ✅                       │
└─────────────────────────────────────────────────────────────────┘
```

**NOTA:** El asiento se genera AUNQUE ambas cuentas sean la misma (SAP B1 lo hace así).

---

### **9. STOCK ADJUSTMENT (Ajuste de Inventario)**

**Momento:** Al confirmar el ajuste

```
┌─────────────────────────────────────────────────────────────────┐
│  AJUSTE DE INVENTARIO: AJ-001 | Tipo: INCREMENTO               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Caso INCREMENTO (aumento de stock):                            │
│  ────────────────────────────────────────────────────────────── │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  Inventario                           $200           │
│    Descripción: "Ajuste Incremento Inventario — AJ-001"         │
│    Item: Laptops                                                  │
│    Quantity: +2                                                 │
│    Warehouse: Almacén Central                                    │
│    Contra-cuenta: Compensación Inventario                        │
│    Referencia: STOCK_ADJUSTMENT #AJ-001, línea 1                │
│                                                                   │
│  Línea 2:                                                        │
│    Crédito:  Compensación Inventario               $200           │
│    Descripción: "Compensación Ajuste Inventario — AJ-001"        │
│    Item: Laptops                                                  │
│    Contra-cuenta: Inventario                                     │
│    Referencia: STOCK_ADJUSTMENT #AJ-001, línea 1                │
│                                                                   │
│  TOTALES: Débitos: $200 = Créditos: $200 ✅                       │
│                                                                   │
│  Caso DECREMENTO (pérdida de stock):                            │
│  ────────────────────────────────────────────────────────────── │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  Compensación Inventario                $150           │
│    Descripción: "Compensación Ajuste Inventario — AJ-001"        │
│    Contra-cuenta: Inventario                                     │
│    Referencia: STOCK_ADJUSTMENT #AJ-001, línea 1                │
│                                                                   │
│  Línea 2:                                                        │
│    Crédito:  Inventario                           $150           │
│    Descripción: "Ajuste Decremento Inventario — AJ-001"         │
│    Contra-cuenta: Compensación Inventario                        │
│    Referencia: STOCK_ADJUSTMENT #AJ-001, línea 1                │
│                                                                   │
│  TOTALES: Débitos: $150 = Créditos: $150 ✅                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💰 Documentos de Pago/Cobro

### **10. INCOMING PAYMENT (Cobro)**

**Momento:** Al confirmar el cobro

```
┌─────────────────────────────────────────────────────────────────┐
│  COBRO: COB-001 | Cliente: ABC Corp | Total: $1,000             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Método de pago: Transferencia Bancaria                          │
│  Aplicado a: Facturas FV-001 ($700) + FV-002 ($300)              │
│                                                                   │
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Línea 1:                                                        │
│    Débito:  Banco (BANK)                         $1,000           │
│    Descripción: "Cobro COB-001 — Banco"                          │
│    Partner: ABC Corp                                             │
│    Referencia: INCOMING_PAYMENT #COB-001                         │
│                                                                   │
│  Línea 2:                                                        │
│    Crédito:  CxC (ACCOUNTS_RECEIVABLE)               $1,000         │
│    Descripción: "Cobro COB-001 — CxC"                            │
│    Partner: ABC Corp                                             │
│    Referencia: INCOMING_PAYMENT #COB-001                         │
│                                                                   │
│  TOTALES: Débitos: $1,000 = Créditos: $1,000 ✅                   │
└─────────────────────────────────────────────────────────────────┘
```

**Si hay diferencia de cambio (pagos en moneda extranjera):**
```
Línea adicional:
  Débito/Crédito:  Diferencia de Cambio (EXCHANGE_DIFFERENCE)  $5
  Descripción: "Diferencia de cambio — COB-001"
```

### **11. BANK STATEMENT (Extracto Bancario) — cargos tipificados ITF**

**Momento:** Al postear el extracto bancario (`POST /bank-statements/:id/post`)

Cada línea del extracto con cuenta asignada genera un asiento de 2 líneas
(lado banco + contrapartida). Desde 2026-08-16 (Fase T1 del plan tributario BO),
una línea puede marcarse con `chargeType = 'ITF'` **sin cuenta contable**: la
contrapartida se resuelve automáticamente desde el mapeo
`BANK_STATEMENT / FINANCIAL_TRANSACTION_TAX` (cuenta por defecto BO:
`6.2.1.01.013` "ITF — Impuesto a las Transacciones Financieras").

```
┌─────────────────────────────────────────────────────────────────┐
│  EXTRACTO: EXT-000001 | Cargo ITF (crédito en extracto): Bs 3.50 │
├─────────────────────────────────────────────────────────────────┤
│  ASIENTO CONTABLE:                                               │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Línea 1 (lado banco):                                           │
│    Crédito:  Banco (cuenta GL de la cuenta bancaria)    Bs 3.50  │
│    Descripción: "ITF débitos/créditos — Banco"                   │
│                                                                   │
│  Línea 2 (contrapartida, resuelta por mapping):                  │
│    Débito:   6.2.1.01.013 ITF (FINANCIAL_TRANSACTION_TAX) Bs 3.50│
│    Descripción: "ITF débitos/créditos — Contrapartida"           │
│                                                                   │
│  TOTALES: Débitos: 3.50 = Créditos: 3.50 ✅                       │
└─────────────────────────────────────────────────────────────────┘
```

**Marco normativo:** Ley 3446 (08/08/2006) — el ITF grava los débitos y
créditos en cuentas bancarias; el banco lo debita automáticamente del extracto.
Es gasto deducible del IUE. El ITF pagado también es **compensable contra el IT**
(Art. 77 Ley 843 — ver Fase T4 del plan tributario).

**Reglas:**
```
1. Si la línea tiene chargeType='ITF' y accountId explícito, gana el accountId
2. Si tiene chargeType='ITF' sin accountId y NO existe el mapping →
   BadRequestException (configure el mapeo en Contabilidad → Mapeo de cuentas)
3. El mapping por defecto se crea con POST /account-mappings/ensure-defaults
   (idempotente; solo tenants con plan de cuentas BO tienen la cuenta 6.2.1.01.013)
4. La tasa vigente se registra de forma informativa en BankAccount.itfRate
```

---

## ✅ Validaciones y Reglas

### **Reglas de Balance:**
```
1. Todo asiento debe estar balanceado:
   Suma(Débitos) = Suma(Créditos) ± 0.001 (tolerancia redondeo)

2. Si no está balanceado, NO se permite guardar el documento

3. El error debe mostrar:
   - Tipo de documento
   - ID y código del documento
   - Total del documento
   - Diferencia encontrada
   - Resumen de líneas del asiento
```

### **Reglas de Determinación de Cuentas:**
```
1. Cuentas de ITEMS (inventario, COGS, etc.):
   Jerarquía: ItemWarehouseAccount → Item → ItemGroup → Warehouse
   NUNCA usan AccountMapping (según nivel configurado)

2. Cuentas de PARTNER (CxC, CxP):
   Jerarquía: Partner → AccountMapping (fallback)

3. Cuentas de IMPUESTOS (IVA):
   Jerarquía: TaxIndicator → AccountMapping (fallback)

4. Cuentas BANCARIAS:
   Jerarquía: BankAccount.accountId → AccountMapping (fallback)
```

### **Reglas de Referencia:**
```
Cada línea de asiento DEBE incluir:
- sourceTransactionType: Tipo de documento
- sourceTransactionId: ID del documento
- sourceTransactionLineId: ID de línea (si aplica)
```

---

## 📊 Resumen de Documentos y sus Asientos

| Documento | ¿Genera Asiento? | Asiento Principal | Cuentas Involucradas |
|-----------|-----------------|------------------|---------------------|
| **Sale Invoice** | ✅ Sí | CxC ↔ Ingresos + IVA | CxC, Ingresos, IVA, COGS, Inventario |
| **Sales Credit Note** | ✅ Sí | Ingreso reversa ↔ CxC | Ingreso crédito, IVA, CxC |
| **Delivery Order** | ✅ Sí* | COGS ↔ Inventario | COGS, Inventario |
| **Sales Return** | ✅ Sí | Ingreso/Inv reversa ↔ CxC | Ingreso retorno, IVA, Inventario, COGS, CxC |
| **Purchase Receipt** | ✅ Sí | Inventario ↔ GRIR | Inventario, GRIR |
| **Purchase Invoice** | ✅ Sí | GRIR/Gastos ↔ CxP + IVA | GRIR/Gastos, IVA, CxP |
| **Purchase Credit Note** | ✅ Sí | CxP ↔ Inventario reversa + IVA | CxP, Inventario, IVA |
| **Stock Transfer** | ✅ Sí | Inv. destino ↔ Inv. origen | Inventario (x2) |
| **Stock Adjustment** | ✅ Sí | Inventario ↔ Compensación | Inventario, Compensación |
| **Incoming Payment** | ✅ Sí | Banco ↔ CxC | Banco, CxC |
| **Outgoing Payment** | ✅ Sí | CxP ↔ Banco | CxP, Banco |

\* *Delivery Order solo si no está facturado*

---

## 🚨 Errores Comunes a Evitar

### **❌ ERROR 1: No separar recepción de factura**
```
Mal: Purchase Invoice afecta directamente inventario
Bien: Purchase Receipt → Inventario, Purchase Invoice → GRIR
```

### **❌ ERROR 2: No incluir dimensiones**
```
Mal: Asiento sin proyecto/sucursal
Bien: Cada línea hereda dimensiones del documento
```

### **❌ ERROR 3: No validar balance**
```
Mal: Permitir guardar asiento desbalanceado
Bien: Lanzar error con contexto completo antes de guardar
```

### **❌ ERROR 4: No incluir referencias**
```
Mal: Asiento sin sourceTransactionType/sourceTransactionId
Bien: Cada línea referencia al documento origen
```

### **❌ ERROR 5: Confundir crédito fiscal con débito fiscal en NC de compra**
```
Mal: NC de compra revierte el IVA contra IVA — Crédito Fiscal (como si
     redujera el crédito ya computado en la factura)
Bien: La NC de compra (ajuste POSTERIOR) ADICIONA al DÉBITO fiscal el 13%
     del importe de la NC (Ley 843, Art. 7 último párr.). La factura con
     descuento en la misma hoja usa el crédito NETO directo (Art. 8, inc.
     a). En ventas es el espejo: la NC/devolución de venta RESTA del
     impuesto (Dr IVA — Crédito Fiscal) por Art. 8, inc. b.
```

---

## 🎯 Checklist de Implementación

Para cada documento, verificar:

- [ ] Asiento se genera AL CONFIRMAR (no al guardar)
- [ ] Asiento está balanceado (Débitos = Créditos)
- [ ] Cada línea tiene descripción significativa
- [ ] Cada línea referencia al documento origen
- [ ] Cuentas se resuelven según jerarquía correcta
- [ ] Si hay error, mensaje es claro y accionable
- [ ] Asiento es reversible si se cancela el documento

---

## 📚 Referencias

- **SAP Business One:** Documentación de "Account Determination"
- **NIIF:** Normas Internacionales de Información Financiera
- **PCGA:** Principios de Contabilidad Generalmente Aceptados
- **Ley N° 843 (Texto Ordenado, actualizado al 31/07/2026 — SIN), Art. 7:** débito fiscal =
  alícuota sobre los **precios netos de las ventas**; último párrafo: **se adiciona al
  débito** la alícuota sobre devoluciones, rescisiones, descuentos, bonificaciones o
  rebajas **obtenidas** respecto del precio neto de las **compras**.
- **Ley N° 843, Art. 8:** crédito fiscal = alícuota sobre el monto de las **compras
  facturadas** (inc. a) **menos** la alícuota sobre los descuentos **otorgados** respecto
  de los precios netos de **venta** (inc. b).
- **D.S. N° 21530 (Reglamento del IVA), Art. 7 y sección Crédito Fiscal:** aplica el
  mecanismo del Art. 7 (adicionar al débito) a los descuentos/devoluciones **logrados**
  sobre compras; el inciso b) del Art. 8 (restar del impuesto) a los descuentos
  **otorgados** sobre ventas.
- **RA 05-0043-99 (y reglamentación NCD):** emisión de Notas de Crédito–Débito por
  devolución total/parcial de bienes o rescisión de servicios; tratamiento por lado de la
  operación (vendedor → resta del impuesto; comprador → adiciona al débito).

---

**Última actualización:** 2026-08-13  
**Mantenedor:** Equipo de Contabilidad
