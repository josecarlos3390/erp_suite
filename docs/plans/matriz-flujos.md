# Matriz de flujos — ventas y compras, simple y multi (consolidación)

> **Qué responde este documento.** «¿Soportamos todos los flujos?» — con la arista concreta que
> realiza cada paso (`endpoint`) y la opción de pantalla que la expone («Copiar a»), para **ventas y
> compras**, en su forma **simple** y en su forma **multi** (consolidando varios documentos).
>
> **Cómo se midió.** Los `endpoint` salen de los `*.controller.ts`; las opciones de «Copiar a» de los
> `*-form.component.html`. Es una lectura **exhaustiva del código**, no una impresión de pantalla. La
> columna **«Probado en UI»** dice qué se ejecutó de verdad, y solo eso se declara probado.

---

## 0. Los documentos y qué mueve cada uno

| Documento | Código | Mueve contabilidad | Mueve stock | Serie |
|---|---|---|---|---|
| Cotización de venta | `SALES_QUOTATION` | — | — | `COT-2026` |
| Pedido de venta | `SALES_ORDER` | — | — | `PED-2026` |
| **Factura de Venta** | `SALE_INVOICE` | **CxC + IVA + IT** | **sí (salida)** | `FVE-2026` |
| **Factura de Reserva de Venta** | `SALE_RESERVE_INVOICE` | **solo CxC** | **no** | `FVR-2026` |
| Orden de Entrega | `DELIVERY_ORDER` | costo de venta | **sí (salida)** | `ENT-2026` |
| Pago Recibido | `INCOMING_PAYMENT` | caja / banco | — | `REC-2026` |

**La regla que ordena todo el resto**: la **FVE hace dos movimientos en uno** (CxC e inventario); la
**FRV hace uno solo** (CxC) y **siempre va acompañada de una entrega**, que es la que saca el
inventario. Por eso **el pago cuelga siempre de una FACTURA** (FVE o FRV) y **nunca de la entrega**.

En compras el espejo es exacto: **FCP** (factura de compra) mueve CxP **y** stock; **FPR** (factura de
reserva de compra) mueve **solo CxP** y siempre va con su **recepción** (`RCP`).

---

## 1. Aristas de generación — verificadas en los controladores

Cada fila es una arista real: el documento destino **se genera desde** el origen.

### Ventas

| Desde | Hacia | Simple | Multi (consolidación) |
|---|---|---|---|
| Cotización | **Pedido** | `POST /sales-orders/from-multi-quotation` (con **un** origen) | igual, con **N** |
| Cotización | **Entrega** | `delivery-orders/from-quotation/:id` | `from-multi-quotation` |
| Cotización | **FRV** | `sale-reserve-invoices/from-quotation/:id` | `from-multi-quotation` |
| Cotización | **FVE** | `sale-invoices/from-quotation/:id` | `from-multi-quotation` |
| Pedido | **Entrega** | `delivery-orders/from-order/:id` | `from-multi-order` |
| Pedido | **FRV** | `sale-reserve-invoices/from-order/:id` | `from-multi-order` |
| Pedido | **FVE** | `sale-invoices/from-order/:id` | `from-multi-order` |
| **FRV** | **Entrega** | `delivery-orders/from-reserve-invoice/:id` | `from-multi-reserve-invoice` |
| **FRV** | **FVE** | `sale-invoices/from-reserve-invoice/:id` | — |
| **Entrega** | **FRV** | `sale-reserve-invoices/from-delivery/:id` | `from-multi-delivery` |
| **Entrega** | **FVE** | `sale-invoices/from-delivery/:id` | `from-multi-delivery` |
| FVE / FRV | **Pago** | `POST /incoming-payments` con la factura **asignada** en el cuerpo (sección «Facturas pendientes» del formulario) | — |
| FVE / FRV | **NC** | `POST /sales-credit-notes/from-invoice/:invoiceId` | — |
| FVE / FRV | **ND** | `POST /sales-debit-notes` con la factura referenciada en el cuerpo | — |

### Compras

| Desde | Hacia | Simple | Multi |
|---|---|---|---|
| Solicitud | **Orden de compra** | `purchase-orders/from-request…` | — |
| Cotización | **Orden de compra** | `purchase-orders/from-quotation…` | `from-multi-quotation` |
| Cotización | **Recepción** | `purchase-receipts/from-quotation…` | `from-multi-quotation` |
| Cotización | **FPR** | `purchase-reserve-invoices/from-quotation/:id` | — |
| Cotización | **FCP** | `purchase-invoices/from-quotation/:id` | `from-multi-quotation` |
| Orden | **Recepción** | `purchase-receipts/from-order/:id` | `from-multi-order` |
| Orden | **FPR** | `purchase-reserve-invoices/from-order/:id` | — |
| Orden | **FCP** | `purchase-invoices/from-order/:id` | `from-multi-order` |
| **FPR** | **Recepción** | `purchase-receipts/from-reserve-invoice/:id` | `from-multi-reserve-invoice` |
| **Recepción** | **FPR** | `purchase-reserve-invoices/from-receipt/:id` | — |
| **Recepción** | **FCP** | `purchase-invoices/from-receipt/:id` | `from-multi-receipt` |
| **FCP** | **Pago** | `POST /outgoing-payments` con la factura **asignada** en el cuerpo | — |
| **FCP** | **NC** | `POST /purchase-credit-notes/from-invoice/:invoiceId` | — |
| **FCP** | **ND** | `POST /purchase-debit-notes` con la factura referenciada | — |

**Sobre el método de cada arista** (medido, para que no se confunda con un hueco): unas tienen
endpoint propio de origen (`from-order/:id`, `from-delivery/:id`, `from-receipt/:id`,
`from-invoice/:invoiceId`); otras son **solo multi** (`from-multi-quotation` para el pedido) y la
pantalla las llama **con un solo origen** cuando el usuario copia **un** documento; y el **pago** y la
**nota de débito** no llevan `from-*`: se crean con `POST` y **la factura va dentro del cuerpo**
(en el cobro, marcándola en «Facturas pendientes»). **Las tres formas realizan la misma arista**; lo
que cambia es el mecanismo, no la capacidad.

**Las aristas multi ya existían para los tres orígenes que el negocio consolida** (varias
cotizaciones, varios pedidos, varias entregas/recepciones) **y hasta para la reserva**. No hay que
inventar ninguna: están en el controlador.

---

## 2. La pantalla: qué ofrece «Copiar a» en cada documento

### Ventas

| Documento | «Copiar a» |
|---|---|
| **COT** | Pedido · Entrega · Fact. Reserva Cliente · Factura de Cliente |
| **PED** | Entrega · Fact. Reserva Cliente · Factura Cliente |
| **FVE** | Pago · Nota de Crédito · Nota de Débito |
| **FRV** | **Entrega** · Pago · Nota de Crédito |
| **ENT** | Fact. Reserva Cliente · Devolución · Cancelar entrega |

### Compras

| Documento | «Copiar a» |
|---|---|
| **SOL** (solicitud) | Orden de compra · Cerrar · Cancelar |
| **CCP** (cotización) | Orden de compra · Recepción de compra · Fact. Reserva Compra · Factura de compra |
| **OCP** (orden) | Recepción de compra · Fact. Reserva Compra · Factura de compra · Cerrar orden |
| **RCP** (recepción) | Factura de Compra · **Precio de Entrega** · Fact. Reserva Compra · Devolución de Compra |
| **FCP** (factura) | Pago · Nota de Crédito · Nota de Débito · Cancelar factura |
| **FPR** (reserva) | **Recepción de Mercadería** · Pago · Nota de Crédito · Cancelar factura |

**Tres ausencias que son correctas, no huecos:**
1. **La FVE no ofrece «Entrega»** — ya movió el stock.
2. **La ENT no ofrece «Factura de Cliente», solo «Fact. Reserva Cliente»** — el stock ya salió con la
   entrega; facturarla como FVE lo movería dos veces.
3. **La ENT no ofrece «Pago»** — el pago va contra la factura.

---

## 3. Los flujos de venta, uno a uno

| # | Flujo | ¿Soportado? | Cómo |
|---|---|---|---|
| 1 | COT → PED → FVE → PAGO | **sí** | COT→PED · PED→FVE · FVE→Pago |
| 2 | COT → FVE → PAGO | **sí** | COT→Factura de Cliente · FVE→Pago |
| 3 | PED → FVE → PAGO | **sí** | PED→Factura Cliente · FVE→Pago |
| 4 | FVE → PAGO | **sí** | FVE manual → Pago |
| 5 | COT → PED → FRV → ENT → PAGO | **sí** | … FRV→Entrega; **el pago se hace en la FRV** |
| 6 | COT → PED → ENT → FRV → PAGO | **sí** | ENT→Fact. Reserva · FRV→Pago |
| 7 | COT → FRV → ENT → PAGO | **sí** | COT→Fact. Reserva · FRV→Entrega · FRV→Pago |
| 8 | COT → ENT → FRV → PAGO | **sí** | COT→Entrega · ENT→Fact. Reserva · FRV→Pago |
| 9 | PED → FRV → ENT → PAGO | **sí** | PED→Fact. Reserva · FRV→Entrega · FRV→Pago |
| 10 | PED → ENT → FRV → PAGO | **sí** | PED→Entrega · ENT→Fact. Reserva · FRV→Pago |
| 11 | **FRV → ENT → PAGO** | **sí** (desde T767) | el selector de entrega **se llena**; el vacío era consecuencia de la FRV que nacía `CLOSED` |
| 12 | ENT → FRV → PAGO | **sí** | ENT manual → Fact. Reserva · FRV→Pago |

## 4. Los flujos de compra (espejo)

| # | Flujo | ¿Soportado? |
|---|---|---|
| 1 | CCP → OCP → FCP → PAGO | **sí** |
| 2 | CCP → FCP → PAGO | **sí** |
| 3 | OCP → FCP → PAGO | **sí** |
| 4 | SOL → OCP → FCP → PAGO | **sí** |
| 5 | CCP → OCP → FPR → RCP → PAGO | **sí** |
| 6 | CCP → OCP → RCP → FPR → PAGO | **sí** (RCP→Fact. Reserva Compra) |
| 7 | CCP → FPR → RCP → PAGO | **sí** |
| 8 | CCP → RCP → FPR → PAGO | **sí** |
| 9 | OCP → FPR → RCP → PAGO | **sí** |
| 10 | OCP → RCP → FPR → PAGO | **sí** |
| 11 | FPR → RCP → PAGO | **sí** (FPR→Recepción de Mercadería) |
| 12 | RCP → FPR → PAGO | **sí** (RCP→Fact. Reserva Compra) |

---

## 5. Multi: la consolidación

**Cómo se usa en pantalla**: el listado del documento origen tiene un **modo «Consolidar»**
(`consolidarMode` en cotizaciones y compras; «Consolidar»/«Cancelar selección» en pedidos) que
**habilita la selección de filas** (`[selectable]="consolidarMode"`); con varias marcadas se elige el
destino, y el destino recibe **N orígenes** en una sola operación.

**Qué significa**: la consolidación **no es un flujo distinto** — es la **misma arista con varios
orígenes**. El destino es un documento único que agrupa las líneas de todos.

**Aristas multi disponibles** (verificadas): ventas — `multi-quotation`, `multi-order`,
`multi-delivery`, `multi-reserve-invoice`; compras — `multi-quotation`, `multi-order`, `multi-receipt`,
`multi-reserve-invoice`.

**Y todas respetan la regla contable**: consolidar no cambia **qué mueve** el destino. Una FVE
consolidada sigue moviendo **CxC + stock una vez**; una FRV consolidada sigue moviendo **solo CxC**, y
su consolidación **descuenta de las entregas** lo ya facturado.

---

## 6. Estado de verificación (lo que se probó y lo que no)

**Probado en la UI, de punta a punta** (con datos reales):

| Verificado | Evidencia |
|---|---|
| **FVE manual → pago aplicado → factura `CLOSED`** | `FVE-2`, pago `REC-1` por 1.695,00, saldo 0 |
| **Anulación de una factura con pago**: la acción se mantiene y **explica** (T766) | diálogo «No se puede anular… anulá el cobro o corregí con una nota de crédito» |
| **La UI ofrece la NC como camino** | menú «Anular con nota de crédito» |
| **Cadena canónica `PED → FRV → ENT`** | `PED-2` → `FVR-3` (OPEN) → `ENT-1` (CLOSED, `orderId 2`, `FVR-3.deliveryOrderId = 1`) |
| **Anular una reserva SIN pago CON entrega (caso 2)** | **400** «tiene 1 entrega(s) viva(s) (ENT-1)… Devuelva la entrega o corrija con una nota de crédito» — y el aviso se ve en pantalla |
| **Anular una reserva SIN pago y SIN entrega** | `FVR-1` → **CANCELLED** (201): se anula, como debe |
| **COMPRAS · anular una factura sin efectos** | `FCP-1` (factura de compra, sin pago ni recepción) → «Anular factura» → **201 → CANCELLED** |
| **COMPRAS · un pago aplicado bloquea** | cubierto por la suite compartida (`annulment-guard.util.spec.ts`, caso «en COMPRAS el PAGO bloquea y lo dice con su palabra») — la guarda es el **mismo motor** para venta y compra |
| **El bloqueo por entrega OFRECE la devolución (T770)** | `PED-3 → FVR-5 → ENT-3`: el 400 del bloqueo abre «La mercadería ya salió … Entrega: ENT-3. ¿Registramos la devolución?» con **[Cancelar] [Devolver la entrega]**, y el botón deja `/sales-returns/new?deliveryOrderId=3` |
| **Anular una reserva CON pago (caso 3)** | **400** «El documento FVR-4 tiene 1 cobro(s) aplicado(s) por 1695 Bs (REC-2): no se anula un documento con dinero aplicado. Anule primero el cobro… o corrija con una nota de crédito» — y **el aviso se ve** (toast a los 500 ms, medido) |
| **Devolución por ENTREGA, reserva SIN pago** | `ENT-1` → «Copiar a → Devolución» → **`DEV-1`**: `returnAnchor: DELIVERY`, `deliveryOrderId: 1`, 1.695,00, `CLOSED` |
| **Devolución por ENTREGA, reserva CON pago** | `ENT-2` (de `FVR-4`, pagada con `REC-2`) → **`DEV-2`**: `returnAnchor: DELIVERY`, `deliveryOrderId: 2`, 1.695,00, `CLOSED` |

**Verificado en el CÓDIGO (no ejecutado en pantalla)**: la tabla de aristas de §1 y los «Copiar a» de
§2 — es lectura exhaustiva de controladores y plantillas.

**Los tres casos de anulación de la matriz están MEDIDOS** (factura con pago, reserva con entrega,
reserva con pago) y los tres **bloquean explicando el motivo**, con el aviso **visible en pantalla**.

**Corregido el 2026-11-14 (T768)**: **la devolución se aplica únicamente a las ENTREGAS.** La
mercadería sale con una `ENT` y vuelve con la devolución; la factura **no** es el documento logístico.
El backend tenga una rama `returnAnchor: 'INVOICE'` **no** convierte ese flujo en válido, y por eso
**no falta una entrada en la pantalla**: la única entrada correcta es la entrega, y es la que existe.
⇒ los «casos 4 y 5» de esta matriz (devolución a una factura de venta) **no son flujos del producto**:
se plantearon mal y se retiran.

---

## 7. Hallazgos de esta campaña

| # | Hallazgo | Estado |
|---|---|---|
| A | **La base mínima no trae NINGUNA serie de numeración**: 33 tipos de documento, **0 series**. Sin ellas **no se emite nada**, y los mensajes aparecen uno por uno conforme se intenta. Se crearon **las 33** por la UI (`FVE-2026`, `FVR-2026`, `ENT-2026`, `REC-2026`, `COT-2026`, `PED-2026`, `FCP-2026`, `RCP-2026`, …). | **medido y resuelto en esta sesión**; **pendiente**: que la instalación las traiga, o un asistente que las cree |
| B | **La serie `FVE-2026` se puede crear con rango 1** y nace agotada; el error aparece al emitir la **segunda** factura. | **medido**; ampliada. **Pendiente**: validar el rango al crear |
| C | **El pago va siempre contra la factura** (FVE o FRV), nunca contra la entrega. | **diseño correcto**, confirmado |
| D | **Tras generar la entrega desde la FRV, hay que volver a la FRV para cobrar**; la pantalla deja al usuario en la entrega. | **fricción medida**, sin arreglar |
| E | **El selector de entrega llegaba vacío** `copyToDelivery` → `deliveryPickerModal`) | **RESUELTO (T767)**: la FRV desde pedido nacía `CLOSED` y no aparecía en su propia lista |
| F | **FRV creada desde un pedido nace `CLOSED`** con saldo entero pendiente y líneas `OPEN` | **RESUELTO (T767)** |
| G | **El menú de fila de los listados es UNO compartido** (`aria-controls` genérico; `row-item` en el DOM = 2, no 4×n) y se re-vincula **al abrirlo** | **NO es defecto del producto**: el fallo era de la automatización, que pulsaba el ítem **viejo** que quedaba en el DOM tras un menú no abierto. **Regla para los recorridos**: abrir el menú, **comprobar que hay ítems visibles** y **verificar el documento que nombra el diálogo** antes de confirmar |
| I | **La devolución se aplica únicamente a las ENTREGAS** (el formulario solo lee `deliveryOrderId`; la factura no ofrece «Devolución») | **NO es un hueco: es diseño** (corregido en T768 el 2026-11-14). La rama `INVOICE` del backend existe pero **no es un flujo del producto** |
| K | **El formulario de devolución no dice QUÉ entrega está devolviendo**: llega con `?deliveryOrderId=3` pero no nombra `ENT-3` en pantalla | **medido** (T770); el usuario aterriza en el sitio correcto sin confirmación visual del origen |
| J-1 | **El selector de artículos de COMPRAS no distingue «no hay artículos comprables» de «no encontré nada»**: con `canBePurchased=false` en el único artículo, el panel queda **vacío sin decir por qué** | **medido**; es configuración del dato, pero la pantalla debería decirlo |
| J-2 | **La línea de una factura de compra nace a 0 si el artículo no tiene `cost`**, y el formulario **no avisa**: `FCP-1` se guardó con `total: 0` | **medido**; el dato manda, pero una factura de compra por 0 debería advertirse |
| J | **El formulario manual de devolución no guarda y no explica** (diálogo «¿Registrar devolución?» → confirmar → **sin POST, sin toast, sin error de campo**) | **medido**; callejón sin salida mudo, misma clase que T766 |
| H | **El diálogo de anulación del DETALLE no nombra el documento** («¿Cancelar Factura de Reserva?»), mientras el de la **lista** sí («¿Cancelar factura FVR-1?») | **medido**; mejora pendiente: una acción destructiva debe nombrar su objeto |
