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
| **Cancelación** | Legal | La **factura emitida** dentro del plazo de anulación (asiento de reversa + stock si lo movió + motivo) | Dentro del plazo RND 10-0016-17 |

- **Una NC NO requiere devolución** (ajuste financiero: descuento posterior,
  rebaja, anulación sin devolver mercadería). **Una devolución NO requiere NC**
  (entrega no facturada).
- **Van juntas** cuando el cliente devuelve físicamente mercadería que ya estaba
  facturada: Devolución (stock) + NC (financiero).
- En el flujo directo (V2), la devolución revierte el stock que movió la FV.

### Anulación de facturas (vs. nota de crédito)

| Situación | Documento |
|-----------|-----------|
| Factura **OPEN** (no emitida / sin asiento) | **Cancelación** directa, motivo opcional |
| Factura **CLOSED** dentro del plazo legal | **Cancelación** con **motivo obligatorio** (RND 10-0016-17 Art. 38) |
| Factura **CLOSED** fuera del plazo | **Nota de crédito** (la cancelación se rechaza con 400 y referencia a la norma) |
| Factura con NC vinculada | **Solo NC** (la cancelación se rechaza: "ya tiene una nota de crédito vinculada") |

- **Plazo legal (RND 10-0016-17 Art. 38, mod. RND 102100000021):** la factura
  emitida puede anularse hasta el **día 9 del mes siguiente** a su emisión
  (fin del día, según la zona horaria del tenant). Fuera de ese plazo corresponde
  nota de crédito.
- **Motivo obligatorio** para facturas emitidas (emitido por error, duplicada,
  etc.); se persiste en `cancellationReason` y se muestra en el mapa de relaciones.
- **Efectos de la cancelación:** asiento de reversa (la factura queda CANCELLED con
  `reversalJournalEntryId`), devolución del stock si la factura lo movió, y reapertura
  del pedido origen. En el grafo de trazabilidad aparece el nodo **Cancelación**
  (fecha, motivo y usuario). Implementado (2026-08-15).

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

- [x] **Anulación de facturas emitidas (2026-08-15)**: dentro del plazo legal (día 9 del mes siguiente a la emisión, RND 10-0016-17 Art. 38) la factura CLOSED se puede **cancelar** con motivo obligatorio; fuera del plazo corresponde **nota de crédito**. La cancelación crea asiento de reversa, devuelve el stock y agrega el nodo **Cancelación** al mapa de relaciones. Validado contra la normativa SIN. Implementado en backend + frontend.
- [x] **FRV desde entrega**: la devolución **libera** lo facturable — al crear la FRV desde la entrega (y la FRC desde la recepción) se resta lo ya devuelto: `pendiente = entregado − devuelto − facturado` (helper `sumReturnedQtyByBaseLine`). Implementado (2026-08-15).
- [x] **Devolución sobre mercadería facturada**: permitida — el límite es `entregado − ya devuelto` (antes se bloqueaba al exceder lo no facturado). El crédito financiero lo da la NC (documentos independientes). Implementado (2026-08-15).
- [x] **MODELO A (decisión 2026-08-15)**: la **devolución es SIEMPRE logística** (Dr Inventario / Cr COGS) y la **NC revierte lo financiero** (CxC, ingresos, IVA, IT). Se eliminó la reversa financiera condicional de la devolución de venta (`financialReversal` siempre false) — sin riesgo de doble reversa. **Vínculo NC↔DEV**: la devolución expone `creditNoteRequired` cuando la mercadería devuelta ya estaba facturada y el formulario avisa "emite una nota de crédito". Implementado.
- [ ] **Regla de negocio para elegir V1 vs V2 / C1 vs C2**: ¿configurable por tipo de venta (mostrador → directa, crédito/logística → con entrega) o decisión del usuario al facturar? Recomendado: decisión del usuario con defaults inteligentes.
- [ ] **Estado de trazabilidad**: unificar el mapa visual por flujo (qué documentos quedan OPEN/PARTIAL/CLOSED en cada eslabón).
- [ ] **Verificar cuenta de IVA en NC de venta**: el builder revierte contra "IVA — Crédito Fiscal" (decisión documentada en `sales.journal-builder`); validar si debe ser "IVA — Débito Fiscal" para el balance de la deuda tributaria.
