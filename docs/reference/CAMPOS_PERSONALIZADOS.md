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

**Gate**: `npm run audit:copiar-a:check` falla si una ruta vuelve a copiar el saco crudo
(`customFields: quotation.customFields`). Sin gate, el motor nuevo convive con el viejo y el
comportamiento queda a suertes.

## 6. Límites, declarados

- **Las líneas no se filtran todavía** con el motor: el paso de línea dentro del mismo
  documento (`oi.customFields`, `incoming.customFields`) es legítimo y no pasa por él. La
  copia **entre documentos a nivel de línea** sí debería, y es el siguiente lote.
- **No hay renombrado al copiar**. Si `TIPO_VENTA` tiene que llegar como `TIPO_DOC`, hoy no
  se puede. La tabla de mapeo explícita se añadiría **encima** del alias, no en su lugar.
- **El valor viaja como foto**: el destino guarda lo que el origen tenía al copiar. Si el
  origen cambia después, el destino **no**.
- **El índice** (`CustomFieldValue`) se reescribe en las rutas cableadas; en las demás sigue
  pendiente. Un campo puede existir en el documento y **no aparecer en los filtros**.
- **La auditoría de campos estándar** (`scripts/audit-copiar-a.mjs`) marca **candidatos**,
  no pérdidas: el «Copiar a» real es el frontend precargando el formulario, y
  `buildBaseDocumentData` toma `date`/`notes`/`referenceNo` del payload.
