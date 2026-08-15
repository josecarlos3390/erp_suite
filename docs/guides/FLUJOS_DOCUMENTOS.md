# FLUJOS DE DOCUMENTOS — Ventas y Compras (mejores prácticas)

> **Última actualización:** 2026-08-15.
> Guía canónica de los flujos de documentos comerciales del ERP. Define cuándo
> usar entrega/recepción vs. factura directa, el movimiento de stock, la
> contabilidad y los documentos de ajuste (NC/ND/devolución).

---

## 1. Principio central: ¿quién mueve el stock?

El ERP distingue dos familias de facturas por el flag `isReserve`:

| Factura | `isReserve` | ¿Mueve stock? | Cuándo se usa |
|---------|-------------|---------------|---------------|
| **Factura de Reserva** (FRV venta / FRC compra) | `Y` | **NO** | Ya hubo (o habrá) una **Entrega/Recepción** que movió el stock. Solo registra contabilidad. |
| **Factura directa** (FV venta / FCP compra) | `N` | **SÍ** | No hay entrega/recepción: la factura es el documento de despacho y mueve el stock en un solo paso. |

Regla de oro:

> **El stock lo mueve un solo documento por mercancía:** o la entrega/recepción
> (flujo logístico), o la factura directa (flujo inmediato). Nunca ambos.

---

## 2. VENTAS

### V1 — Flujo con entrega (despacho físico)

```
COT → PED → DEL (mueve stock ↓) → FRV (no mueve stock) → [NC / ND] + [Devolución]
```

- **Cuándo:** hay un despacho físico separado de la facturación (B2B, logística,
  transporte, envíos parciales, facturar después de despachar).
- **Stock:** la **Entrega (DEL)** descarga inventario (Dr COGS / Cr Inventario).
- **Factura:** la **FRV** solo registra contabilidad (Dr CxC / Cr Ventas, IVA
  débito 13% por dentro, IT 3%, descuento 87/13). No toca stock.
- **Parciales:** DEL parciales → FRV parciales. Cada FRV se limita a lo
  **pendiente de facturar** (`pendingInvoiceQty`) de la entrega.
- **Cierre:** la DEL queda con `returnStatus` (NONE/PARTIAL/FULL) e
  `invoiceStatus`; el PED se cierra cuando `deliveredQty = quantity`.

### V2 — Flujo directo (la factura es el despacho)

```
COT → PED → FV (mueve stock ↓) → [NC / ND] + [Devolución]
```

- **Cuándo:** venta inmediata (mostrador, retail, contado) donde el cliente se
  lleva la mercadería al facturar.
- **Stock:** la **FV directa** descarga inventario en un solo paso y **valida la
  disponibilidad** (no permite facturar más del stock disponible).
- **Servicios:** ítems no inventariables en la FV no descargan stock.

### V3 — Pre-factura (reserva antes de entregar)

```
COT → FRV (no mueve stock) → DEL (mueve stock ↓) → [NC / ND] + [Devolución]
```

- **Cuándo:** facturar por adelantado y despachar después (pedidos anticipados,
  crédito aprobado, "factura de reserva" estilo SAP B1).
- La FRV se crea desde la cotización (`isReserve=Y`) y la DEL posterior mueve el
  stock.

### Devolución y NC de venta (documentos independientes)

| Documento | Naturaleza | Qué revierte | Requisito |
|-----------|-----------|--------------|-----------|
| **Devolución** | Física / logística | La **Entrega**: el stock vuelve al almacén (Dr Inventario / Cr COGS) | Que exista entrega |
| **NC** | Financiera | La **factura**: CxC, ingreso, IVA débito, IT, descuento 87/13 | Que exista factura |
| **ND** | Financiera | Incrementa lo facturado (IT adicional) | Que exista factura |

- **Una NC NO requiere devolución** (ajuste financiero: descuento posterior,
  rebaja, anulación sin devolver mercadería). **Una devolución NO requiere NC**
  (entrega no facturada).
- **Van juntas** cuando el cliente devuelve físicamente mercadería que ya estaba
  facturada: Devolución (stock) + NC (financiero).
- En el flujo directo (V2), la devolución revierte el stock que movió la FV.

---

## 3. COMPRAS

### C1 — Flujo con recepción (GRIR)

```
PREQ → PCOT → PO → REC (mueve stock ↑ + GRIR) → FRC (no mueve stock, liquida GRIR) → [NC] + [Devolución]
```

- **Cuándo:** la mercadería llega al almacén antes de recibir la factura del
  proveedor (compras a crédito estándar).
- **Stock:** la **Recepción (REC)** capitaliza inventario y genera el asiento
  **Inventario ↔ GRIR** (cuenta por liquidar).
- **Factura:** la **FRC** (reserva, `isReserve=Y`) no mueve stock y **liquida el
  GRIR** ↔ CxP (IVA crédito, retenciones RC-IVA/IUE/IT, descuento 87/13).
- **Devolución de compra** sobre una REC aún no facturada **cierra el GRIR**
  (devuelve mercadería antes de que llegue la factura).

### C2 — Flujo directo (sin recepción)

```
PREQ → PCOT → PO → FCP (mueve stock ↑) → [NC] + [Devolución]
```

- **Cuándo:** la factura del proveedor llega junto con la mercadería (compra de
  contado / mostrador) — no hay GRIR, la FCP capitaliza inventario directo.

### NC y Devolución de compra

- **NC compra** = financiera: revierte la FRC/FCP. Según **Ley 843 Art. 7** la NC
  de compra **ADICIONA al débito fiscal** del comprador.
- **Devolución compra** = física: la mercadería vuelve al proveedor (revierte
  stock / GRIR).

---

## 4. Reglas transversales (mejores prácticas)

1. **Un solo documento mueve el stock por mercancía** (entrega/recepción o
   factura directa, nunca ambos).
2. **Factura ≤ entregado/recepcionado** en flujo logístico (limitada por
   `pendingInvoiceQty`).
3. **Factura directa valida stock disponible** (no facturar sin inventario,
   salvo configuración `allowSellWithoutInvoice`).
4. **NC ≤ saldo facturado**; **devolución ≤ entregado − ya devuelto**
   (`returnStatus`).
5. **La devolución libera cantidades del pedido** (PO/SO se reabren — DT.43).
6. **GRIR = 0 al cierre del flujo C1** (la FRC liquida lo recibido; la
   devolución cierra lo pendiente).
7. **Formulario 200 / Libros**: el IVA se calcula sobre la base neta (Ley 843
   Art. 8 inc. a: descuento de la misma factura en la base).

---

## 5. Decisiones pendientes de validación (afinar)

- [x] **FRV desde entrega**: la devolución **libera** lo facturable — al crear la FRV desde la entrega (y la FRC desde la recepción) se resta lo ya devuelto: `pendiente = entregado − devuelto − facturado` (helper `sumReturnedQtyByBaseLine`). Implementado (2026-08-15).
- [x] **Devolución sobre mercadería facturada**: permitida — el límite es `entregado − ya devuelto` (antes se bloqueaba al exceder lo no facturado). El crédito financiero lo da la NC (documentos independientes). Implementado (2026-08-15).
- [ ] **Regla de negocio para elegir V1 vs V2 / C1 vs C2**: ¿configurable por tipo de venta (mostrador → directa, crédito/logística → con entrega) o decisión del usuario al facturar? Recomendado: decisión del usuario con defaults inteligentes.
- [ ] **Sugerir NC al devolver mercadería facturada** (aviso UX, frontend).
- [ ] **Estado de trazabilidad**: unificar el mapa visual por flujo (qué documentos quedan OPEN/PARTIAL/CLOSED en cada eslabón).
