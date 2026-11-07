# Reglas de validación y relleno automático

> **Para quien administra el ERP.** Las dos funcionalidades se configuran desde
> **Configuración** y no necesitan desarrollo: el cliente decide qué se exige y qué se
> completa solo.
>
> Permiso: `settings:view` para verlas, `settings:edit` para crearlas y cambiarlas.
>
> **No son lo mismo**, y confundirlas es el primer error:

| | **Validar** | **Rellenar** |
|---|---|---|
| Qué hace | **Bloquea** (o avisa) si el documento no cumple | **Escribe** un campo con un valor traído de otra parte |
| Cuándo | Al **guardar** o al **confirmar** | Cuando el usuario hace algo con un campo (o al guardar, por API) |
| Si falla | El documento **no se guarda** y el usuario ve el mensaje | El campo queda vacío (o con el valor por defecto que se declare) |
| Ejemplo | «La referencia debe empezar por F-» | «Al elegir el proveedor, trae su condición de pago» |

---

## 1. Validaciones

**Dónde**: Configuración → **Reglas de validación**.

### 1.1 Anatomía de una regla

| Campo | Qué es |
|---|---|
| **Nombre** | Único por empresa. Es lo que se lee en el listado |
| **Documento** | Sobre qué documento actúa (factura de venta, pedido de compra, nota de crédito…) |
| **Aplica a** | **Cabecera** (el documento) o **Línea** (cada renglón) |
| **Cuándo se evalúa** | **Al guardar** o **Al confirmar** |
| **Qué hace** | **Bloquea** (400, no se guarda) · **Avisa** (se guarda y queda el aviso) |
| **Mensaje** | Lo que ve el usuario. Admite `{campo}` y `{linea}` |


> **Sobre «bloquea salvo permiso».** Existió como tercera opción y **se retiró de la
> pantalla** (T576): el motor la entiende, pero hoy **nadie le pasa los permisos del
> usuario**, así que **bloqueaba siempre** — prometía una cosa y hacía otra. Una regla
> creada por API con esa severidad **se aplica como bloquea**, y la pantalla lo avisa.
> Volverá cuando el cableado lleve los permisos.

### 1.2 La condición dice **cuándo SALTA**

Esto es lo que más se equivoca. La condición **no** describe lo que está bien: describe
**el caso que se rechaza**. Si la condición se cumple, la regla salta.

Para exigir «la referencia empieza por F-» se escribe **lo contrario**, en dos filas:

1. `referenceNo` · **no está vacío**
2. `referenceNo` · **no** · **empieza por** `F-`

y se combinan con **Y**. En JSON (lo que guarda la regla):

```json
{ "op": "and", "args": [
  { "op": "isNotEmpty", "field": "referenceNo" },
  { "op": "not", "args": [ { "op": "startsWith", "field": "referenceNo", "value": "F-" } ] } ] }
```

Lectura: «si hay referencia **y** no empieza por F-, salta». Si no hay referencia, la
primera fila no se cumple y **no salta** (para exigir que la haya, se usa otra regla con
solo `isEmpty`).

### 1.3 Operadores disponibles

| Grupo | Operadores | Ejemplo |
|---|---|---|
| Lógica | `and`, `or`, `not` | combinar filas |
| Comparación | `eq`, `neq`, `gt`, `gte`, `lt`, `lte` | `quantity` **es mayor que** `price` |
| Rangos y listas | `between`, `in` | `date` **está entre** dos fechas · `currency` **es uno de** `BOB, USD` |
| Texto | `startsWith`, `endsWith`, `contains`, `matches` | `code` **cumple el patrón** `^[A-Z]{2}-\d{4}$` |
| Vacíos | `isEmpty`, `isNotEmpty` | `notes` **no está vacío** |

Dos cosas que se preguntan siempre:

- **`0` y `false` no son «vacío».** Un importe de 0 o una casilla desmarcada son valores;
  solo `null`, `undefined` y el texto en blanco cuentan como falta.
- **«Igual a otro campo»** existe: en vez de un valor fijo se elige otro campo del mismo
  documento (`quantity` **es mayor que** `price`).

### 1.4 Campos personalizados

Los campos personalizados (UDF) se nombran por su **alias**, el mismo que se ve en
**Campos Personalizados**. Un campo **inactivo no puede ser obligatorio** y una regla que
lo nombre deja de compilar: desactivar el campo es la salida.

### 1.5 Probar antes de activar

El formulario tiene **Probar**: se escribe un documento en JSON y el sistema dice, con el
**mismo compilador** que el guardado, si la regla salta o no. Lo que dice ahí es lo que va
a pasar de verdad.

Consejo: crear la regla como **Avisa**, dejarla unos días y mirar a quién molesta; cuando
esté claro, cambiarla a **Bloquea**. Una regla que bloquea de más cuesta más que no
tenerla.

### 1.5b Bloquea **salvo permiso**

El motor soporta una tercera severidad: **bloquea salvo que el usuario tenga un permiso**
(`BLOCK_UNLESS_PERMISSION` con su código). La pantalla **no la ofrece** —solo Bloquea y
Avisa—, pero una regla creada por API con esa severidad **sí se respeta**: el guardado
compara el permiso con los del usuario de la petición y, si lo tiene, **no bloquea**; si
no lo tiene, bloquea como cualquier otro bloqueo.

### 1.6 Criterios que necesitan otra tabla

Hay criterios que no están en el documento: «no despachar más de lo que hay». Se
escriben con una **función de contexto**, que es una lista blanca cerrada:

| Función | Devuelve | Argumentos (campos del documento) |
|---|---|---|
| `stock.available` | disponible en almacén (físico + pedido − comprometido) | `itemId`, `warehouseId` |
| `partner.balance` | saldo neto del socio en esa moneda (lo mantiene el motor de saldos) | `partnerId`, `currency` |

Ejemplo, en una regla de **línea** del documento:

```json
{ "op": "gt", "field": "quantity",
  "referencia": { "fn": "stock.available", "args": ["itemId", "warehouseId"] } }
```

En la **pantalla** no se escribe JSON: en la fila de la condición se elige
**«Contra» → la función** y sus argumentos se escogen de los campos del documento (vienen
prefijados con el campo que suele corresponder).

Se lee: «si la cantidad pedida es mayor que el disponible, salta». El servidor lo lee
**una vez por documento**, no una vez por línea. Si el artículo no tiene fila de stock, el
disponible es **0**.

Para el saldo del socio, el mismo mecanismo: `{ "op": "gt", "field": "exchangeRate",
"referencia": { "fn": "partner.balance", "args": ["partnerId", "currency"] } }` compara un
campo numérico del documento con **el saldo neto** del socio en esa moneda. Sale del
registro que mantiene el motor de saldos (no de una columna que pueda estar desviada) y,
si el socio no tiene fila en esa moneda, el saldo es **0**.

### 1.7 Dónde se exige hoy

| Documento | Al guardar | Al confirmar |
|---|---|---|
| Factura de venta, factura de compra | ✅ | ✅ |
| Entrega, recepción de compra | ✅ | ✅ |
| Cotización de venta, cotización de compra | ✅ | — |
| Pedido de venta (alta manual **y** copiado de una cotización), pedido de compra | ✅ | — |
| Factura de reserva de venta | ✅ | — |
| Nota de crédito de venta y de compra | ✅ | ✅ |
| Factura de reserva de compra | — (su alta viene de otro documento) | — |

Son **trece** puertas de guardado: las once de alta manual (T561) más las dos de copia
(pedido desde una cotización y desde varias) que se sumaron al probar «Copiar a» (T568).

En los documentos que no tienen confirmación (cotizaciones, pedidos) no hay fase de
confirmar: la regla de esa fase no se evalúa nunca.

### 1.8 Límites, dichos sin adornos

- **No hay SQL.** Las funciones de contexto son la vía, y son una lista cerrada: si el
  criterio que se necesita no está, hay que pedir la función.
- **No hay fórmulas ni campos calculados**, ni dependencias entre campos.
- Una regla **no lee otros documentos** salvo por las funciones de contexto.
- Si un campo se retira del sistema, la regla deja de compilar y **no se aplica** (queda
  el aviso en el registro del servidor): no bloquea a nadie en silencio.
- Apagar una regla **no cambia** los documentos ya guardados.

---

## 2. Relleno automático

**Dónde**: Configuración → **Relleno automático**.

### 2.1 Anatomía de una regla

| Campo | Qué es |
|---|---|
| **Documento** y **Aplica a** | Dónde ocurre (cabecera o línea) |
| **Cuándo** | La acción del usuario que lo dispara |
| **Campo que dispara** | El campo que el usuario toca (proveedor, artículo, moneda…) |
| **Campo que se rellena** | El que se completa (nativo o personalizado) |
| **Fuente** y **dato a leer** | De dónde sale el valor (lista blanca de maestros) |
| **Filtros** | Qué fila de la fuente: una columna de la fuente **igual a** un campo del documento |
| **Si no encuentra la fila** | Dejar vacío · avisar con error · usar un valor por defecto |
| **Política** | Si el destino ya tiene valor: no lo pisa · lo sobrescribe · se limpia al borrar el disparador |

### 2.2 Cuándo (los disparadores)

| Disparador | Cuándo ocurre | Caso típico |
|---|---|---|
| `Al seleccionar` | al elegir en un selector | proveedor → condición de pago |
| `Al cambiar` | al cambiar el valor | moneda → tipo de cambio por defecto |
| `Al borrar` | al vaciar el campo | quitar el proveedor → limpiar lo que trajo |
| `Al salir del campo` | al dejar el campo | código postal → ciudad |
| `Al añadir una línea` | al agregar un renglón | artículo → indicador de impuesto |
| `Al abrir el documento` | al abrirlo | un valor por defecto |

### 2.3 Políticas (qué pasa con lo que ya hay)

| Política | Comportamiento | Cuándo usarla |
|---|---|---|
| **Solo si está vacío** (por defecto) | No pisa lo que el usuario escribió | Casi siempre: el usuario manda |
| **Sobrescribe** | Pisa el valor anterior | Cuando el dato viejo deja de tener sentido (el usuario cambió el proveedor) |
| **Se limpia al borrar** | Al vaciar el disparador, el destino se vacía | Quitar el proveedor no debe dejar su condición de pago |

Cuando el sistema rellena un campo, la pantalla lo **avisa con el nombre del campo**: el
usuario puede corregirlo y su valor se respeta.

### 2.4 De dónde se puede leer (la lista blanca)

| Fuente | Ejemplos de datos |
|---|---|
| **Socio de negocio** | condición de pago, vendedor, límite de crédito, moneda, dirección, NIT, contacto |
| **Artículo** | indicador de impuesto, unidades, grupo, marca, precio de lista, garantía |
| **Almacén** | código, nombre, dirección, sucursal |
| **Condición de pago** | nombre |

Además, **los campos personalizados del maestro** se leen como `custom:ALIAS`: si en el
socio se creó `NRO_LICITACION`, una regla puede traerlo a la factura.

**No se puede leer cualquier columna**: quedan fuera el identificador de la empresa, los
costos y las columnas internas. Si una columna no está en la lista, la regla no se puede
guardar.

### 2.5 Dónde se ejecuta

- **En la pantalla**, en el momento: el usuario ve el campo llenarse. Once pantallas de
  documento tienen el disparador de **línea**, y las de cabecera lo tienen todas.
- **Al guardar**, por API: el servidor vuelve a resolverlo, así que una integración
  obtiene **el mismo documento** que la pantalla. Vale para **todas** las puertas de
  guardado: las **doce altas manuales** y las **dos de copia** (pedido desde una
  cotización y desde varias), en **cabecera y línea**.
- **Con «Probar»**: en el formulario de la regla se pega un documento de muestra y se ve
  qué campos se rellenarían, con qué valor y por qué regla. Prueba las reglas **activas y
  guardadas** —no el borrador— y **no escribe nada**.

### 2.6 Límites, dichos sin adornos

- **Un salto**: un campo rellenado **no** dispara otra regla (no hay cadenas ni ciclos).
- **No reescribe documentos ya guardados**: una regla nueva actúa en los próximos.
- Las reglas con **varios filtros** se resuelven también en el guardado por API: se leen
  con **una** consulta por regla (un `OR` de las combinaciones distintas del documento),
  no una por línea.
- El relleno acepta **campos personalizados** como destino y como disparador: el valor
  entra en el campo con **su tipo** (texto, número, fecha o sí/no), no como texto suelto.
- Los documentos que **no** tengan el disparador de línea cableado —hoy ninguno de los
  once— pueden tener la regla creada sin que la línea se llene; un gate del repositorio
  impide que vuelva a pasar.

---

## 3. Recetas para copiar

**1. La referencia debe empezar por F-** (validación, al guardar, en la cabecera)
Condición: `referenceNo` *no está vacío* **Y** *no* *empieza por* `F-`.
Mensaje: `La referencia {referenceNo} debe empezar por F-.`

**2. No vender más de lo que hay** (validación, al guardar, en la línea)
Condición: `quantity` *es mayor que* la función `stock.available` con `itemId` y
`warehouseId`. Mensaje: `La línea {linea} pide {quantity} y no hay suficiente disponible.`

**3. Un importe mínimo de compra** (validación, al confirmar, cabecera)
Condición: `total` *es menor que* `1000`. Mensaje: `La factura no puede confirmarse por
menos de 1.000.`

**4. El proveedor trae su condición de pago** (relleno, al seleccionar, cabecera)
Campo que dispara: `supplierId` → campo que se rellena: `paymentTermsId`. Fuente:
**Socio de negocio**, dato: `defaultPaymentTermId`, filtro: `id` *igual a* `supplierId`.
Política: **solo si está vacío**.

**5. El artículo trae su indicador de impuesto** (relleno, al añadir línea, línea)
Campo que dispara: `itemId` → `taxIndicatorId`. Fuente: **Artículo**, dato:
`taxIndicatorId`, filtro: `id` *igual a* `itemId`.

**6. Quitar el proveedor limpia lo que trajo** (relleno, al borrar, cabecera)
Mismo par que la receta 4, con política **se limpia al borrar** y `onMissing` en *dejar
vacío*.

---

## 4. Glosario

| Palabra | Qué significa aquí |
|---|---|
| **Cabecera / Línea** | El documento en sí / cada renglón de artículos |
| **Alias** | El nombre corto de un campo personalizado (`NRO_LICITACION`) |
| **Registro** | La lista cerrada de campos y de fuentes que se pueden nombrar |
| **Puerta** | Un punto del sistema donde se guarda o se confirma un documento |
| **Salta** | La condición se cumple: la regla bloquea o avisa |
| **Política** | Qué hace el relleno con el valor que ya estaba |
| **Referencia** | Un dato que no está en el documento y se pide a una función de contexto |

---

## 5. Si algo no funciona

| Síntoma | Causa más probable |
|---|---|
| «El campo no se puede usar en una regla» | Está fuera del registro (o es un identificador de origen) |
| «La regla no se puede compilar» | Mezcla `valor` con `referencia`, firma de función equivocada, o un tipo incompatible |
| La regla está activa y **no bloquea** | El documento no tiene esa puerta cableada, o el campo está vacío y la condición no se cumple |
| El relleno no ocurre al guardar por API | El documento no está cableado para el guardado, o la regla tiene varios filtros |
| Un campo no se ofrece en el selector | No está en el registro del documento, o el campo personalizado está inactivo |
