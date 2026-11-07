# Plan: línea de servicio (cuenta contable) en cotizaciones y pedidos

> **Estado: EN CURSO — etapa 0 (base) hecha.** La meta es la regla del usuario: **una línea
> puede ser de artículo o de servicio (cuenta contable)**, y una línea de servicio **no mueve
> inventario**, así que **no genera entrega ni recepción**.
>
> Nace de una revisión con capturas: la factura de compra ya tenía la línea de servicio, la UI
> estaba mal ajustada (el icono caía debajo del selector) y hacía falta en el resto de
> documentos. Lo de la UI se arregló en **T594**; la celda compartida, en **T595**.

## 1. Lo que ya está (medido, no supuesto)

| Documento | Línea de servicio | Cómo |
|---|---|---|
| Factura de venta | ✅ | `allowAccountLines` + columna `manualAccount` |
| Nota de crédito de venta | ✅ | igual |
| Factura de compra | ✅ | pestañas + botón de tipo (local) |
| Nota de crédito de compra | ✅ | igual |
| **Cotización de venta** | ❌ | `SalesQuotationItem.itemId` es **obligatorio** |
| **Pedido de venta** | ❌ | `SalesOrderItem.itemId` obligatorio |
| **Cotización / pedido de compra** | ❌ | idem |

**En el backend** los cuatro documentos que ya lo tienen **también lo resuelven**: exigen
`acctCode` en la línea de servicio («Las líneas de servicio requieren una cuenta contable») y
saltan el stock. Y las cuatro tablas de línea **ya tienen** `acctCode` y `description`: lo
único que falta es que `itemId` admita nulo.

## 2. El problema real, medido

Hacer `itemId` opcional **no es un `?` en el esquema**: en cuanto la relación `item` pasa a
opcional, cada sitio que hoy hace `linea.item.algo` deja de compilar.

| Alcance | Errores | Dónde |
|---|---|---|
| Las **cuatro** tablas | **642** | sales-orders 135 · delivery-orders 133 · sale-reserve-invoices 93 · sale-invoices 73 · purchase-orders 71 · purchase-receipts 67 · purchase-invoices 43 · sales-quotations 16 |
| Solo la **cotización de venta** | **318** | sales-orders 115 · sale-reserve-invoices 68 · delivery-orders 67 · sale-invoices 52 · sales-quotations 16 |

Se revirtió la migración **las dos veces**: 642 y 318 errores no se arreglan a la carrera, y el
árbol no se deja en rojo.

## 2b. MEDIDO: el servicio ya se vende hoy, como ARTÍCULO no inventariable

Antes de seguir con la línea de cuenta se probó la **otra** vía, la que el código ya tiene:
un artículo con **`canBeInventoried: false`**. Recorrido completo por API contra `erp_db`,
el 2026-11-07:

| Paso | Resultado |
|---|---|
| Artículo de servicio (`canBeInventoried: false`) con precio y lista | **201** |
| Cotización con ese artículo | **201** (COT-4) |
| Pedido desde la cotización | **201** (PED-6) |
| Entrega desde el pedido | **201** (DEL-1) · la línea viaja con **`warehouseId: null`** |
| Filas de `Stock` del servicio | **0** |
| `StockMovement` del servicio | **0** |

Es decir: **el producto ya vende y entrega servicios sin mover inventario**, con la cuenta
saliendo del **maestro del artículo** (`salesRevenueAccountId` y su matriz). Lo que la línea
de cuenta añade es una **cuenta por línea** sin crear un maestro por servicio.

**Consecuencia para el plan**: hay **dos representaciones** de «servicio»:

| | Artículo no inventariable | Línea de cuenta (`itemId` nulo) |
|---|---|---|
| Dónde funciona hoy | **todos** los documentos (cotización, pedido, entrega, factura) | factura y notas de crédito |
| La cuenta sale de | el **maestro** del artículo | la **línea** |
| Coste de extenderla | **cero** | ~300 sitios (medido: 642 / 318) |

**Decisión pendiente del usuario**: si el servicio se puede identificar en el maestro, la vía
del artículo no inventariable **no necesita código**. La línea de cuenta se justifica solo si
hace falta **una cuenta distinta por línea del mismo documento** sin crear un artículo por
cuenta.

## 2c. MEDIDO (2026-11-07): hacer `itemId` opcional en las cuatro tablas cuesta 644 sitios

Aplicada la migración de las **cuatro** tablas (cotización y pedido, venta y compra) y
regenerado el cliente, `tsc` devuelve **644 errores en 11 ficheros**:

| Fichero | Errores |
|---|---|
| sales-orders | 135 |
| delivery-orders | 133 |
| sale-reserve-invoices | 93 |
| sale-invoices | 73 |
| purchase-orders | 71 |
| purchase-receipts | 67 |
| purchase-invoices | 43 |
| sales-quotations | 12 |
| purchase-quotations | 8 |
| document-flow | 2 |
| storefront | 1 |

Son dos decisiones (saltar la línea o exigir artículo) repetidas en once servicios, no 644
problemas distintos: los ayudantes de §3 las escriben una vez. Aun así, es un **proyecto de
varios commits**, no un incremento de una tarde, y por eso la migración se revirtió (el árbol
queda en **0** errores).

### Las dos vías para tener el documento de servicio en cotizaciones y pedidos

| | **(A) Modelo correcto** | **(B) Artículo centinela** |
|---|---|---|
| Qué se guarda | `itemId` nulo + `acctCode` | un artículo centinela (no inventariable) + `acctCode` |
| Coste | **644 sitios** en 11 ficheros, varios commits | **~10 sitios**: validadores, guardas de flujo y UI |
| Verdad del dato | el documento dice «no hay artículo» | el dato dice que hay un artículo que **no** es el del usuario |
| Riesgo | alto mientras dura el refactor | bajo, pero hay un maestro oculto que mantener |
| Migración futura | — | se puede pasar a (A) cuando se haga el refactor |

**Decisión pendiente del usuario.** (A) si el modelo de datos tiene que decir la verdad; (B)
si hace falta el documento de servicio esta semana sin tocar once servicios.

## 3. Las dos decisiones (y por eso hay ayudantes)

Los 318 errores **no son 318 decisiones**: son dos, y viven en
`src/common/document-lines.util.ts`:

| Situación | Ayudante | Qué hace |
|---|---|---|
| La línea **no debe pasar** (entrega, recepción, reserva, stock) | `lineasDeArticulo(...)` | la deja fuera |
| La línea **debe pasar, pero con artículo** (copiar a un documento que aún no la admite) | `exigirItemDeLinea(...)` | devuelve el artículo o **400** nombrando la línea |

Con eso el reemplazo es mecánico (`linea.item.x` → `exigirItemDeLinea(linea).x`) y **el mensaje
es el mismo en todos los documentos**. Prohibido: `!`, `as any` y saltarse la línea donde debía
dar error.

## 4. Etapas

### Etapa 0 — la base ✅ (este incremento)

| # | Hecho | Criterio |
|---|---|---|
| 0.1 | `esLineaDeServicio`, `lineasDeArticulo`, `exigirItemDeLinea` | 4 casos verdes |
| 0.2 | Este plan con la medición | escrito |

### Etapa 1 — cotización de venta (el documento donde nace la venta)

- Migración: **solo** `SalesQuotationItem.itemId` → `DROP NOT NULL`.
- Los **16** sitios de `sales-quotations.service.ts` con los ayudantes.
- Los servicios que **leen** cotizaciones: copiar a pedido **rechaza** la línea de servicio
  con su mensaje (hasta que el pedido la admita), y la entrega/reserva/factura **la saltan**.
- **UI**: `allowAccountLines` en el formulario de cotización (el componente compartido ya lo
  soporta), con su columna de cuenta y la carga de cuentas.
- **Prueba**: cotización con una línea de artículo y una de servicio → se guarda con
  `itemId: null` + `acctCode`; copiarla a pedido responde **400** nombrando la línea.

**Aceptación**: `typecheck` **0**, suite verde, y la prueba de arriba pasando por API.

### Etapa 2 — pedido de venta + entrega (aquí vive la regla del usuario)

- Migración: `SalesOrderItem.itemId` → nulo.
- El pedido acepta la línea de servicio; **la entrega la salta** (`lineasDeArticulo`).
- La **cantidad pendiente** de una línea de servicio **no bloquea** el cierre del pedido.
- Prueba: pedido con artículo + servicio → entrega que solo trae el artículo → el pedido
  puede cerrarse.

### Etapa 3 — compras (cotización, pedido y recepción)

El mismo patrón, en el lado de compras (71 + 67 sitios). La recepción salta las líneas de
servicio, igual que la entrega.

### Etapa 4 — unificar el patrón de UI

Hoy hay **dos** formas de lo mismo (columna de cuenta en venta, botón de tipo en compra).
Llevar compra a `luna-document-lines` quita la duplicación; la celda compartida
(`app-line-type-cell`) ya existe.

## 5. Lo que este plan NO hace

- No admite la línea de servicio en **documentos de stock** (entrega, recepción, traspaso,
  ajuste): ahí **no tiene sentido** y se salta.
- No convierte un documento ya guardado de artículo a servicio.
- No toca la **factura de compra** ni las notas de crédito: ya funcionan.
