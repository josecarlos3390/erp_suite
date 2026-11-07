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
