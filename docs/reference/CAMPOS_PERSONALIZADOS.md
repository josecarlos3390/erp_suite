# Campos personalizados: cómo funcionan

> Documento de comportamiento, no de intención. Cada regla tiene detrás el error que evita,
> y lo que no está implementado se dice en **Límites**.

## 1. Las tres piezas

| Pieza | Dónde vive | Qué es |
|---|---|---|
| **Definición** | `UserDefinedField` · único por `(tenantId, tableName, fieldName)` | El campo: nombre, etiqueta, tipo (`TEXT`/`NUMBER`/`DATE`/`BOOLEAN`/`SELECT`), si es obligatorio, si aplica a `HEADER` o `LINE`, y su orden |
| **Valor** | `customFields` (JSON) en el documento y en cada línea | El dato, como `{ "TIPO_VENTA": "MAYORISTA" }` |
| **Índice** | `CustomFieldValue` | El mismo valor desnormalizado, para **buscar y filtrar** |

Un campo se define **una vez por tabla**. El mismo `fieldName` en dos tablas son **dos
definiciones** — y esa duplicación es la que hace que el campo pueda viajar.

## 2. El alias es un contrato

`fieldName` es el **alias**, y es lo que identifica al campo entre documentos.

**Regla**: si el mismo alias se define en otra tabla, tiene que tener **el mismo
`fieldType`** y el **mismo `appliesTo`**. Si no, el alta responde **409**:

```
El campo "TIPO_VENTA" ya existe en SalesQuotation como SELECT (HEADER)
y aquí se intenta crear como TEXT (HEADER). Un alias debe tener el mismo
tipo en todo el sistema: use "SELECT" o cambie el nombre del campo.
```

**Por qué**: sin esa regla, un valor `TEXT` puede aterrizar en un destino que espera
`SELECT`, y la pantalla destino **no puede mostrarlo ni corregirlo**. El error se ve tres
semanas después, cuando alguien abre el documento.

## 3. Cómo viaja en «Copiar a»

El motor es **uno**: `copyCustomFields(tx, tenantId, tablaDestino, valoresOrigen, sitio)`.

```
para cada campo del origen:
   ¿el destino lo declara, activo y en el mismo sitio (cabecera/línea)?
       sí → se copia, CONVERTIDO al tipo del destino
       no → NO se copia, y se reporta el motivo
```

**Los cuatro motivos de omisión**:

| Motivo | Cuándo |
|---|---|
| `no-definido-en-destino` | El destino no tiene ese campo (el caso que motiva todo esto) |
| `inactivo-en-destino` | Lo tiene, pero desactivado |
| `tipo-incompatible` | No se puede convertir sin inventar (`"cinco"` a `NUMBER`, opción que no existe en el `SELECT`) |
| `sitio-distinto` | Es de **línea** en el origen y de **cabecera** en el destino |

**Conversiones que sí hace**: `"5"` → `5` (NUMBER), `"SI"`/`"NO"` → `true`/`false`
(BOOLEAN), fecha en cualquier formato → `YYYY-MM-DD` (DATE), número → texto (TEXT).

## 4. Lo que ve el usuario

La respuesta trae el resumen, para que **no tenga que adivinar**:

```
Copiado. Campos personalizados: 1 copiado (TIPO_VENTA),
1 omitido (NRO_LICITACION no existe en Factura).
```

Sin eso, el usuario vuelve a escribir el dato «por si acaso» — que es justo lo que la
funcionalidad pretende evitar.

## 5. Las rutas cableadas

| Origen | Destino | Estado |
|---|---|---|
| Cotización de venta | Pedido de venta | ✅ |
| Pedido de venta | Entrega | ✅ |
| Entrega | Factura de reserva | ✅ |
| Cotización de compra | Pedido de compra | ✅ |
| Pedido de compra | Recepción | ✅ |
| Recepción | Factura de compra | ✅ |

Las seis rutas copian **cabecera y línea** por el mismo motor: el filtro de cabecera
(`copyCustomFields`) y el de línea (`prepareCustomFieldsCopy(tx, tenantId, '<TablaItem>', 'LINE')`,
preparado **una vez por documento** y aplicado por línea). En la línea manda lo que el usuario
escribió en el destino: `line.customFields ?? filtro(origen.customFields).valores`.

**Gate**: `npm run audit:copiar-a:check` falla si una ruta vuelve a copiar el saco crudo
(`customFields: quotation.customFields`). Sin gate, el motor nuevo convive con el viejo y el
comportamiento queda a suertes.

## 6. Límites, declarados

- **El paso de línea DENTRO del mismo documento** (`oi.customFields`, `incoming.customFields`)
  es legítimo y **no** pasa por el motor: no hay cambio de tabla, así que no hay nada que
  filtrar. El motor se aplica a la copia **entre documentos**, y eso está en las seis rutas.
  **Gate**: `audit:copiar-a:check` cubre **cabecera y línea** —una copia de línea que llega a
  una escritura sin `prepareCustomFieldsCopy` es ROJO— y lee el valor **hasta la coma a
  profundidad 0**, así que también ve la forma multilínea. **Límite declarado**: reconoce las
  convenciones de nombre del repo (el payload es `line`/`l`/`incoming`/`dto`/`payload`; la fila
  persistida, `existing`/`current`); una copia cruda con otro nombre no la ve, y los borradores
  y mapeos de respuesta quedan fuera a propósito porque **no escriben**.
- **No hay renombrado al copiar**. Si `TIPO_VENTA` tiene que llegar como `TIPO_DOC`, hoy no
  se puede. La tabla de mapeo explícita se añadiría **encima** del alias, no en su lugar.
- **El valor viaja como foto**: el destino guarda lo que el origen tenía al copiar. Si el
  origen cambia después, el destino **no**.
- **El índice** (`CustomFieldValue`) se mantiene en **todas** las escrituras de documento:
  `census:udf-index` está en **0** y su línea base congelada en 0 (un `create`/`update` que
  escriba `customFields` sin sincronizar rompe el gate del pre-push). Se sincroniza **después**
  de las líneas —antes indexaba una cabecera con cero líneas— y en los `update` parciales la
  cabecera se **relee**, porque indexar con el payload borraría el índice de los campos que ese
  PATCH no toca. **Límite declarado del instrumento**: compara cuentas, no empareja escritura
  con llamada.
- **La auditoría de campos estándar** (`scripts/audit-copiar-a.mjs`) marca **candidatos**,
  no pérdidas: el «Copiar a» real es el frontend precargando el formulario, y
  `buildBaseDocumentData` toma `date`/`notes`/`referenceNo` del payload.

## 7. Validaciones de los campos (T550)

El `isRequired` de la definición **se hace cumplir al CONFIRMAR** (modalidad B del plan de P4),
con dos reglas y un solo motor (`assertCustomFieldsCompletos`):

1. **Obligatorio = no vacío.** `null`, `undefined` y la cadena vacía son «falta»; **`0` y
   `false` no lo son** (son valores).
2. **Tipo = la MISMA conversión del motor de copia** (`convertir`, exportada): un `SELECT` fuera
   de sus opciones o un `NUMBER` que no es número son **400**.

Un campo **inactivo no bloquea** (desactivar es la salida) y el 400 **nombra el campo y la
línea**. Se evalúa **antes de cualquier efecto**: si falta un campo, no hay kardex ni asiento.

**Límites declarados**: los documentos **sin `confirm`** (cotizaciones y pedidos) no validan;
no hay fórmulas, campos calculados, dependencias entre campos ni **búsquedas formateadas**
(eso es la fase P5, en `docs/plans/plan-validaciones-campos-personalizados.md`).
