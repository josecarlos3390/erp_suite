# Plan: personalización declarativa por el usuario — validaciones y relleno automático (P5)

> **Estado: P5A1 IMPLEMENTADO el 2026-11-05 (T552).** El motor de **validar** está en
> `backend-erp/src/common/validation/` (registro cerrado de campos, DSL, motor) y en
> `src/validation-rules/` (CRUD + **previsualización**), con la tabla `ValidationRule`
> migrada. Las reglas se exigen **al confirmar** en facturas de venta y compra, entregas y
> recepciones, y **al guardar** en las dos altas manuales de factura. Pendiente: **P5A2**
> (pantalla), el resto de tablas y el motor de **rellenar** (**P5B**). Lo de §1–§11 es el
> diseño; lo implementado y sus límites están en §12.8.
>
> **Son DOS motores, no uno**: **validar** (bloquear o avisar; §1–§11) y **rellenar** (auto-
> completar un campo a partir de una acción del usuario; §12). Comparten el registro de campos,
> el catálogo y la previsualización, pero **no la regla**: una bloquea, la otra escribe.
>
> Nace de la pregunta del usuario: *«cuando se entregue el ERP, el cliente va a querer poner
> una validación en un campo nativo, o impedir un guardado si un campo tiene cierto prefijo…
> SAP B1 lo hace con el Transaction Notification; y las búsquedas formateadas»*. Esto es lo
> primero; las búsquedas son P5C.

## 1. Qué resuelve, y qué NO

**Resuelve**: que el **cliente** (o el implementador, sin desplegar) declare reglas sobre
campos **nativos y personalizados**, que se evalúan **antes del commit** y pueden **bloquear**
con un mensaje, **avisar**, o bloquear **salvo permiso**.

**No resuelve** (y es deliberado):

| Fuera de alcance | Por qué |
|---|---|
| **SQL libre** (lo que hace B1 con su procedimiento) | multi-tenant (el filtro lo pone el servidor, no la consulta), inyección, coste imprevisible, no testeable ni versionable |
| **Búsquedas formateadas / valores derivados** | es **leer y rellenar**, no bloquear: motor distinto, y va en **P5C** |
| **Fórmulas, campos calculados, dependencias entre campos** | exige un evaluador y un catálogo de funciones; es otro plan |
| **Reglas que consultan otros documentos** (p. ej. «el socio debe estar activo») | en v1 la evaluación es **pura sobre el documento**; las consultas por regla son el coste que hay que acotar (ver §6) |

## 2. Las tres decisiones de producto (y mi recomendación)

| Decisión | Opciones | Recomendación |
|---|---|---|
| **¿Quién escribe las reglas?** | (a) el implementador en un JSON versionado; (b) el administrador del tenant en pantalla; (c) **catálogo base + reglas del tenant** | **(c)**: el caso aparece *después* de entregar, así que hace falta pantalla; pero un catálogo base evita que cada cliente reinvente las reglas obvias |
| **¿Cuándo se evalúan?** | GUARDAR / CONFIRMAR / ambas | **las dos fases, declaradas por regla** (P4 dejó el motor `assertCustomFieldsCompletos` en confirmar; esto lo generaliza y **no** lo sustituye) |
| **¿Puede haber avisos?** | solo bloquear / bloquear + avisar + bloquear salvo permiso | **las tres severidades**: un `WARN` permite medir una regla en producción antes de volverla `BLOCK` |

## 3. Modelo de datos (`ValidationRule`)

```
ValidationRule
  id, tenantId
  name            String   (único por tenant)
  description     String?
  tableName       String   (lista CERRADA: el registro de §4)
  appliesTo       HEADER | LINE
  phase           SAVE | CONFIRM
  event           INSERT | UPDATE | ANY
  condition       Json     (el AST del §5)
  message         String   (con `{campo}` y `{linea}`)
  severity        BLOCK | WARN | BLOCK_UNLESS_PERMISSION
  permissionCode  String?  (solo BLOCK_UNLESS_PERMISSION)
  priority        Int      (orden de evaluación; el mensaje los lista todos)
  isActive        Boolean
  createdById, updatedById, createdAt, updatedAt, version
  @@unique([tenantId, name])
  @@index([tenantId, tableName, phase, isActive])
```

**Catálogo base**: las reglas de sistema viven en un fichero versionado (`validation-catalog.ts`)
y se **siembran** por tenant con `isSystem: true` (no editables: se **clonan** para ajustar).
Así, `npm test` compila el catálogo y una regla mala rompe el build, no la producción.

## 4. El registro de campos (`field-registry.ts`) — la pieza que faltaba

Una regla **no puede nombrar cualquier columna**: se declara una lista **cerrada** por tabla.

```ts
export const REGISTRO = {
  PurchaseInvoice: {
    header: {
      code: 'text', referenceNo: 'text', notes: 'text', currency: 'text',
      date: 'date', dueDate: 'date', partnerId: 'number', warehouseId: 'number',
      discountMode: 'text', headerDiscountPct: 'number', headerDiscountAmt: 'number',
      // los personalizados entran por el alias, resueltos contra UserDefinedField
      custom: 'udf',
    },
    line: { itemId: 'number', quantity: 'number', price: 'number', discountPct: 'number', custom: 'udf', },
  },
  …
}
```

- **Un campo fuera del registro no compila la regla** (error al guardarla, no en el alta del
  documento): el compilador de reglas es el gate.
- El registro es la respuesta a «validar un campo **nativo**»: `code`, `referenceNo`,
  `currency`, `discountMode`, fechas… sin abrir la puerta a `tenantId`, costes ni columnas
  internas.
- Los **UDF** se resuelven por `fieldName` declarado y **activo** en el tenant; un campo
  inactivo no puede ser obligatorio (la desactivación sigue siendo la salida).

## 5. El DSL: un AST, sin SQL

```json
{ "op": "and", "args": [
  { "op": "notEmpty", "field": "referenceNo" },
  { "op": "not", "args": [
    { "op": "startsWith", "field": "referenceNo", "value": "F-" } ] } ] }
```

| Grupo | Operadores |
|---|---|
| Lógica | `and`, `or`, `not` |
| Comparación | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `between` |
| Texto | `startsWith`, `endsWith`, `contains`, `matches` (regex acotada: longitud y sin retro-referencias) |
| Nulos/vacíos | `isEmpty`, `isNotEmpty` (un `0` y un `false` **no** son vacío: la regla de T550) |
| Funciones (v1) | `len`, `upper`, `lower`, `abs`, `round`, `today()`/`tenantToday()` (con la zona del **tenant**, no la del proceso) |

**Compilación** (`compilarRegla(ast, registro, definiciones)`): devuelve `{ ok, ast, errores }`.
Rechaza operador desconocido, campo fuera del registro, tipo incompatible (comparar un número
con un texto), regex demasiado larga y AST demasiado profundo (tope de nodos).

**Evaluación** (`evaluarRegla(ast, contexto)`): **pura**, sin base de datos, sobre
`{ header, lines[] }`. Sin `eval`, sin `Function`, sin SQL.

## 6. Dónde vive y cuánto cuesta

- **Una lectura de reglas por documento y fase** (no por línea): `RulesService.assert(tx,
  tenantId, tabla, fase, doc)` carga las reglas activas y las evalúa en memoria. Coste:
  `O(reglas × nodos)`, sin consultas por línea.
- **Enganche**: `create`/`update` (fase SAVE) y `confirm` (fase CONFIRM), **antes de cualquier
  efecto** — el mismo sitio que ya ocupa `assertCustomFieldsCompletos` (que pasa a ser una
  regla del catálogo base, no un motor aparte).
- **Avisos**: un `WARN` no bloquea; se devuelve en `warnings[]` de la respuesta y se registra.
- **Permiso**: `BLOCK_UNLESS_PERMISSION` reutiliza el patrón de `credit.service`
  (`CREDIT_OVERRIDE`); un usuario con el permiso guarda, y queda la huella.
- **Auditoría**: cada bloqueo escribe en `AuditLog` (`action: 'VALIDATION_BLOCKED'`, la regla,
  los campos y el usuario). En un alta el documento no existe todavía: se registra la operación
  con el `entityType` y el payload **sin** los valores (solo los nombres de campo).

## 7. Lo que hay que decidir antes de escribir el motor

1. **¿Catálogo base + tenant, o solo tenant?** Recomiendo catálogo + clonado.
2. **¿`WARN` en v1?** Recomiendo sí: permite medir una regla antes de volverla `BLOCK`.
3. **¿La regla de «bloquear salvo permiso» en v1?** Recomiendo sí: es la salida cuando una
   regla molesta a un rol y no al resto.
4. **¿Alcance del registro de campos en v1?** Recomiendo empezar por los **documentos
   comerciales** (cotización, pedido, entrega, FRV, FV, recepción, FV de compra, NC) y sus
   líneas; maestros en v2.

## 8. Entrega en dos incrementos (P5A)

| Incremento | Contenido | Criterio de aceptación |
|---|---|---|
| **P5A1 — motor de VALIDAR + API + previsualización** | modelo, registro, compilador, evaluador, `RulesService.assert` cableado en SAVE/CONFIRM de los documentos comerciales, `CRUD /validation-rules`, `POST /validation-rules/preview`, auditoría | (a) una regla creada por API **bloquea** un documento real con el mensaje; (b) desactivada, pasa; (c) el preview evalúa **sin** guardar; (d) 0 consultas por línea (un caso lo pinza); (e) un campo fuera del registro **no compila** |
| **P5A2 — pantalla de validaciones** | listado + formulario constructor de condiciones + preview contra un documento real | crear/editar/desactivar desde la UI; el preview muestra el mismo resultado que el guardado |
| **P5B1 — motor de RELLENAR** | modelo `FieldAutomation`, resolutor declarativo, disparadores, `GET /automation-rules` (metadatos compilados), reproducción en el servidor al guardar, lote por documento | los criterios de §12.5, con el caso «componente sin pantalla» (API) |
| **P5B2 — pantalla de relleno** | pestaña «Relleno automático»: disparador + condición + destino + política, con preview | mismo veredicto en pantalla y en el guardado; el usuario edita un campo derivado y deja de pisarse |
| **P5C — búsquedas de nivel 2 (escape SQL)** | solo si un cliente lo exige: vista de solo lectura, `tenantId` inyectado, `statement_timeout`, tope de filas, auditoría | se enciende por tenant y admin; sin él, P5A/P5B siguen completos |

## 9. Criterios de aceptación del frente (cuando esté)

- [ ] Una regla sobre un **campo nativo** (p. ej. `referenceNo` con prefijo) bloquea o avisa.
- [ ] Una regla sobre un **UDF** funciona igual (el alias, no la columna).
- [ ] `WARN` no bloquea y se ve en la respuesta.
- [ ] `BLOCK_UNLESS_PERMISSION` deja pasar al rol con el permiso y lo audita.
- [ ] El documento bloqueado **no deja rastro**: ni kardex, ni asiento, ni folio consumido.
- [ ] La regla **no** puede nombrar una columna fuera del registro (ni `tenantId`, ni costes).
- [ ] El **preview** da el mismo veredicto que el guardado.
- [ ] Reglas del catálogo **compilan** en el build (`npm test`).
- [ ] El censo del índice y `audit:copiar-a` siguen verdes; las reglas se evalúan **antes**
      de las sincronizaciones.

## 10. Riesgos y cómo se pagan

| Riesgo | Mitigación |
|---|---|
| Una regla bloquea un flujo legítimo | empezar en `WARN`, preview, auditoría y desactivación sin despliegue |
| Dos reglas se contradicen | se evalúan **todas** y el 400 lista todas; la `priority` solo ordena el mensaje |
| Coste por guardado | una lectura por documento y fase; evaluación en memoria; un caso mide que no hay consultas por línea |
| Reglas invisibles al usuario | el mensaje nombra campo (y línea) y el formulario las muestra (P5B) |
| Multi-tenant | el registro, las reglas y la evaluación llevan `tenantId`; ninguna regla ve otra empresa |

## 11. Relación con lo ya construido

- **T550** (`assertCustomFieldsCompletos`) no se tira: se convierte en la regla del catálogo
  «obligatorios y tipo de los UDF», con el mismo motor.
- **T547/T549** (índice) y **T548/T551** (copia filtrada) siguen siendo el suelo: una regla
  **no** duplica esas reglas, las consume.
- **P5C** (búsquedas formateadas) se diseña después, con el mismo registro de campos y la
  misma filosofía: **nivel declarativo primero**, SQL solo como escape auditado.

## 12. Segundo motor: relleno automático de campos (P5B) — nuestra «búsqueda formateada»

**Qué es.** Cuando el usuario hace algo con un campo —selecciona un proveedor, cambia un
importe, borra el valor, sale del campo—, **otro** campo (nativo o personalizado, de cabecera
o de línea) se **rellena** con un valor resuelto por una regla. No bloquea: **escribe**. Es la
otra mitad de la personalización sin código, y comparte con las validaciones el **registro de
campos** y la **previsualización**, pero no la regla.

### 12.1 Modelo (`FieldAutomation`)

```
FieldAutomation
  id, tenantId, name, description
  tableName       String    (el mismo registro cerrado que las validaciones)
  appliesTo       HEADER | LINE
  trigger         ON_SELECT | ON_CHANGE | ON_CLEAR | ON_BLUR | ON_LINE_ADD | ON_OPEN
  sourceField     String    (el campo que dispara; ej. partnerId, itemId, currency)
  targetField     String    (nativo o UDF; ej. NRO_LICITACION, paymentTermsId, LOTE)
  resolver        Json      (el «de dónde sale el valor»; §12.2)
  policy          ONLY_IF_EMPTY | OVERWRITE | CLEAR
  priority        Int       (si dos reglas escriben el mismo destino, gana una y se declara)
  isActive, createdById, updatedById, createdAt, updatedAt
  @@index([tenantId, tableName, appliesTo, isActive])
```

**Disparadores** (son **datos**; el formulario los traduce a sus eventos):

| Disparador | Cuándo | Caso típico |
|---|---|---|
| `ON_SELECT` | al elegir en un selector | proveedor → su condición de pago / límite de crédito |
| `ON_CHANGE` | al cambiar el valor | moneda → tipo de cambio por defecto |
| `ON_CLEAR` | al borrar el valor | quitar el proveedor → limpiar sus campos derivados |
| `ON_BLUR` | al salir del campo | código postal → ciudad (o validar al salir) |
| `ON_LINE_ADD` | al añadir una línea | artículo → UDF de línea desde el maestro |
| `ON_OPEN` | al abrir el formulario | un valor por defecto del tenant |

### 12.2 El resolutor, en dos niveles

**Nivel 1 — declarativo (el 80 % de los casos reales, sin SQL):**

```json
{ "from": "Partner", "column": "creditLimit",
  "match": [ { "source": "id", "equals": { "field": "partnerId" } } ],
  "orderBy": [ { "column": "validFrom", "dir": "desc" } ],
  "first": true,
  "onMissing": "LEAVE_EMPTY" }
```

- `from`/`column`: una **lista blanca** de tablas y columnas de **solo lectura** (socios,
  artículos, almacenes, listas de precios, configuración del tenant, líneas de un documento
  origen). No es «cualquier tabla»: es la misma idea que el registro de campos.
- `match`: filtra por **campos del formulario** (o por constantes del tenant).
- `orderBy` + `first`: elige una fila cuando hay varias (precio vigente, tarifa aplicable).
- `onMissing`: qué hacer si no hay fila (`LEAVE_EMPTY` por defecto, `ERROR` o `DEFAULT`
  con un valor fijo).

**Nivel 2 — escape SQL (P5C, opcional):** una **vista de solo lectura**, con el `tenantId`
inyectado por el servidor, `statement_timeout` y tope de filas, habilitada por tenant y solo
para administradores. Se declara como excepción: si en seis meses nadie la enciende, sobraba.

### 12.3 Dónde se ejecuta, y por qué en los DOS lados

- **Frontend**: al dispararse el evento, para que el valor aparezca **al instante**. El
  formulario pide los metadatos compilados de su tabla y los traduce a eventos de Angular
  (`selectionChange`, `valueChanges`, `blur`). **No reimplementa la regla**: consume el
  compilado.
- **Backend**: al guardar, **reproduce** la derivación aunque el cliente no la haya hecho
  (una integración por API, el POS, la tienda). Si el cliente ya la calculó, el servidor
  recalcula y compara: **no se confía** en el cliente.
- **Líneas**: se resuelven **en lote** — una consulta por documento para todas las líneas,
  el mismo patrón que el motor de copia (T540). Nunca una consulta por línea.

### 12.4 Precedencia y procedencia (la decisión que evita el defecto clásico)

- **`ONLY_IF_EMPTY`** (por defecto): no pisa lo que el usuario escribió.
- **`OVERWRITE`** (explícito): pisa, y el campo queda **marcado como derivado**.
- **Procedencia por campo**: si el usuario edita un campo derivado, se marca como **manual** y
  la regla **deja de pisarlo** en ese documento. El servidor recibe qué campos tocó el usuario.
- **`CLEAR`**: al borrar el disparador, el destino se **vacía** (o vuelve a su valor por
  defecto) — es lo que el usuario espera al quitar el proveedor.
- **Un salto**: un destino **no** dispara otra regla (sin cadenas ni ciclos). Se declara; si
  algún día hace falta encadenar, se diseña con grafo y tope de profundidad.

### 12.5 Criterios de aceptación (P5B)

- [ ] Al **seleccionar un proveedor** se rellena un **UDF de cabecera** (y otro nativo), y se
      ve **sin guardar**.
- [ ] Guardado **por API** sin pasar por la pantalla: el servidor produce **el mismo** valor.
- [ ] El valor **manual no se pisa** (`ONLY_IF_EMPTY`); con `OVERWRITE` queda marcado.
- [ ] Al **borrar** el proveedor el destino se **limpia** (`CLEAR`).
- [ ] En **líneas**: cambiar el artículo rellena el UDF de línea con **UNA** consulta para todo
      el documento (un caso lo pinza).
- [ ] Sin fila de origen: se aplica la **política** declarada y el usuario ve el motivo.
- [ ] **Sin cadenas**: una derivación no dispara otra; y dos reglas sobre el mismo destino
      resuelven por `priority`, declarado.

### 12.6 Riesgos y cómo se pagan

| Riesgo | Mitigación |
|---|---|
| Pisar el dato que escribió el usuario | `ONLY_IF_EMPTY` por defecto + procedencia por campo |
| Coste por línea | resolución en lote (una consulta por documento) |
| Dos reglas sobre el mismo destino | `priority` y una sola gana, declarado en la regla |
| Cliente y servidor divergen | **un** compilador; el frontend consume el compilado, no reimplementa |
| El usuario no entiende por qué cambió un valor | el campo derivado se marca y el preview muestra el «de dónde salió» |

### 12.7 Relación con lo ya construido

- El **motor de copia** (T538–T541, T548, T551) resuelve *documento → documento* al crear.
  Esto resuelve *campo → campo* **mientras se captura**: no lo sustituye, lo complementa (la
  copia llena el documento nuevo; el relleno llena un campo que el usuario acaba de tocar).
- El **registro de campos** es el mismo: si un campo no está en el registro, no se puede ni
  validar ni rellenar.
- La **previsualización** es la misma idea: probar la regla contra un documento real antes de
  activarla.

### 12.8 Estado real de P5A1 (T552)

| Pieza | Estado |
|---|---|
| Registro cerrado de campos | ✅ **12 documentos** (T560: los 4 de la v1 + cotización y pedido de venta y compra, factura de reserva de venta y compra, y nota de crédito de venta y compra) con cabecera y línea; los UDF por alias. **Un `*Id` fuera de la lista blanca no entra** |
| DSL (compilación + evaluación pura) | ✅ 20 casos; tope de nodos/profundidad y regex acotada |
| Motor `assertReglas` | ✅ 10 casos; una lectura de reglas y una de definiciones por documento y fase |
| Tabla `ValidationRule` | ✅ migración `20261105120000_p5_validation_rules` (a mano, por el drift de `WebStore`) |
| API + `preview` | ✅ CRUD + baja lógica + `POST /validation-rules/preview` (mismo compilador) |
| Cableado CONFIRM | ✅ FV, FC, entrega, recepción (A/B: sin el motor, la confirmación pasa) |
| Cableado SAVE | ✅ **once puertas manuales** (T560/T561): FV venta y compra, entrega, recepción, cotización de venta y compra, pedido de venta y compra, reserva de venta y las dos NC. Queda fuera la **reserva de compra** (su alta delega) |
| Permisos de `BLOCK_UNLESS_PERMISSION` | ⚠️ el motor lo soporta; el cableado **no** pasa todavía los permisos del usuario (bloquea) |
| Funciones de contexto (saldo/stok) | ⬜ P5C |
| **Motor de RELLENAR** (P5B1) | ✅ **T554**: lista blanca de fuentes (`Partner`, `Item`, `Warehouse`, `PaymentTerm`, con `custom:<ALIAS>`), lista blanca del destino (el registro de T552), compilador, motor con `ONLY_IF_EMPTY`/`OVERWRITE`/`CLEAR`, `onMissing`, tabla `FieldAutomation` y `POST /field-automations/resolve` |
| Relleno en el **guardado** (P5B1b) | ⬜ el servidor reproduce la derivación al guardar; hoy `resolve` está probado y el alta no lo aplica (una integración por API aún no recibe el relleno) |
| Relleno por **LÍNEA** (T558) |
| Pantalla de **relleno** (P5B3) | ✅ **T559**: listado + formulario (destino, acción, disparador, destino, fuente de la lista blanca, filtros, política y `onMissing`), campos desde `GET /field-automations/registry`. Sin previsualización | ✅ directiva con `linesArray` + `lineTriggerFields`: firma por línea (solo el disparador) y aplicación al grupo de la línea. Guardado por API: ⬜ pide resolutor por lote |
| Relleno en el **formulario** (P5B2) | ✅ **T555**: directiva `appAutoFill` (un atributo sobre el `<form>`), cliente que pide el valor al servidor, `aplicarValoresRellenados` (sin `emitEvent`, sin tocar deshabilitados) y aviso con los campos rellenados. Cableada en la **factura de compra**, cabecera |
| Pantalla | ✅ **P5A2 (T553)**: listado + constructor de condición (fila a fila, «no» por fila, Y/O) + **Probar** contra un documento en JSON; los campos salen de `GET /validation-rules/registry` |
