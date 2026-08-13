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

**Factura con descuento de cabecera (BOLIVIA_SIN, IVA por dentro):** el descuento se
desglosa 87/13 — 87% a Descuentos y Bonificaciones sobre Compras (Cr) y **13% a IVA —
Crédito Fiscal (Cr)**, reducción directa del crédito fiscal (Ley 843, Art. 8, inciso b).
Ejemplo real (FRC-000107, bruto 1,500, descuento 10% = 150):

```
Dr  GRIR — Mercancías Recibidas             1,305.00   (87% del bruto)
Dr  IVA — Crédito Fiscal                      195.00   (13% del bruto)
Cr  Descuentos y Bonif. sobre Compras         130.50   (87% del descuento)
Cr  IVA — Crédito Fiscal (por descuento)       19.50   (13% del descuento)
Cr  CxP Proveedores M/N                     1,350.00   (bruto − descuento)
    Totales: 1,500 / 1,500 ✅   →  crédito fiscal neto: 175.50
```

---

### **7. PURCHASE CREDIT NOTE (Nota de Crédito de Compra)**

**Momento:** Al confirmar la nota de crédito

> **⛳ Criterio normativo (IVA Bolivia):** la NC de compra es emitida por el **proveedor**
> y recibida por el **comprador** (nuestro ERP). El comprador **reduce su crédito fiscal**
> (el IVA que computó en la factura original). El **débito fiscal** se reduce solo del lado
> del **vendedor que emite la NC** (o en NC de **ventas**, ver §2). Base normativa:
> **Ley 843, Art. 8, inciso b)** — el crédito fiscal se deduce por *descuentos,
> bonificaciones, rebajas, devoluciones o rescisiones* del período; reglamentación NCD
> **RA 05-0043-99** (procede por devolución total/parcial de bienes o rescisión de
> servicios; el comprador sujeto pasivo admite devoluciones parciales sin devolver la
> factura original).

La NC es el **inverso exacto** del asiento de la factura origen. Aplica **total o parcial**:
los montos se prorratean por la cantidad devuelta (ratio = qty / qty_facturada); el
tratamiento de cuentas es idéntico.

```
┌──────────────────────────────────────────────────────────────────────┐
│  NOTA DE CRÉDITO COMPRA — Caso A: factura de RESERVA (FRC)          │
│  Factura origen: FRC-001 (reserva, descuento 10%) | Total NC: $1,350 │
├──────────────────────────────────────────────────────────────────────┤
│  La FRC NUNCA movió inventario (solo ALLOCATION), por lo que su NC   │
│  tampoco: NO toca inventario. Reabre el GRIR que la FRC cerró para   │
│  que la Devolución de Compra posterior cuadre (Dr GRIR).             │
│                                                                      │
│  Línea 1:                                                           │
│    Débito:  CxP (ACCOUNTS_PAYABLE)                   $1,350         │
│    Descripción: "Nota de Crédito Compra NCC-001 — CxP"             │
│    Partner: proveedor                                              │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-001                        │
│                                                                      │
│  Línea 2:                                                           │
│    Crédito:  GRIR (reabre la recepción)              $1,305         │
│    Descripción: "Reversa Compras — NCC-001"                         │
│    Item + Almacén (matriz GRIR)                                     │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-001, línea 1              │
│                                                                      │
│  Línea 3:                                                           │
│    Crédito:  IVA — Crédito Fiscal (TAX_INPUT)          $195         │
│    Descripción: "Reversa IVA Crédito — NCC-001"                     │
│    Tax Indicator: IVA 13% SIN                                       │
│    Referencia: PURCHASE_CREDIT_NOTE #NCC-001                        │
│                                                                      │
│  Línea 4 (factura con descuento de cabecera → desglose 87/13):      │
│    Débito:  Descuentos y Bonif. sobre Compras (PURCHASE_DISCOUNT) $130.50│
│    Descripción: "Reversa descuento compras — NCC-001"               │
│                                                                      │
│  Línea 5:                                                           │
│    Débito:  IVA — Crédito Fiscal (13% del descuento)    $19.50      │
│    Descripción: "Reversa IVA Crédito por descuento — NCC-001"       │
│                                                                      │
│  TOTALES: Débitos: $1,500 = Créditos: $1,500 ✅                      │
└──────────────────────────────────────────────────────────────────────┘
```

> ℹ️ **Aclaración (crédito fiscal vs débito fiscal):** en una NC de **compra**, tanto el IVA
> principal (Línea 3, Cr $195) como el IVA del descuento (Línea 5, Dr $19.50) van contra
> **IVA — Crédito Fiscal**: la NC reduce el crédito fiscal neto (195 − 19.5 = **175.50**).
> **No** hay débito fiscal en una NC de compra — el débito fiscal solo corresponde al
> **vendedor que emite la NC** (o a NC de **ventas**, §2). Base normativa: **Ley 843,
> Art. 8, inciso b)** (los descuentos/devoluciones del período se deducen del crédito
> fiscal).

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
- La NC revierte el **descuento de cabecera** heredado de la factura origen (desglose
  87/13: 87% a Descuentos y Bonificaciones sobre Compras, 13% a IVA Crédito Fiscal —
  reducción directa del crédito fiscal).

---

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
Mal: NC de compra revierte el IVA (principal y del descuento) contra
     IVA — Débito Fiscal (eso corresponde al VENDEDOR que emite la NC,
     o a NC de ventas)
Bien: El COMPRADOR reduce su CRÉDITO fiscal → todo el IVA de la NC va
     contra IVA — Crédito Fiscal (principal Cr y descuento Dr, desglose
     87/13). Ley 843, Art. 8, inciso b. En ventas es el espejo: el
     descuento reduce IVA — Débito Fiscal.
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
- **Ley N° 843 (Texto Ordenado Vigente), Art. 8, inciso b):** reducción del crédito fiscal
  por descuentos, bonificaciones, rebajas, devoluciones o rescisiones del período
  (Servicio de Impuestos Nacionales de Bolivia).
- **RA 05-0043-99 (y reglamentación NCD):** emisión de Notas de Crédito–Débito por
  devolución total/parcial de bienes o rescisión de servicios; tratamiento por lado de la
  operación (vendedor → débito fiscal; comprador → crédito fiscal).
- **D.S. N° 21530:** Reglamento del Impuesto al Valor Agregado.

---

**Última actualización:** 2026-08-13  
**Mantenedor:** Equipo de Contabilidad
