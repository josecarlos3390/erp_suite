# Plan: reglas de validación declarativas (P5A)

> **Estado: propuesta, pendiente de aprobación.** No se escribe código del motor hasta que
> se elija lo de §7. Lo que sigue es el diseño completo, con lo que **no** entra y por qué.
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
| **P5A1 — motor + API + previsualización** | modelo, registro, compilador, evaluador, `RulesService.assert` cableado en SAVE/CONFIRM de los documentos comerciales, `CRUD /validation-rules`, `POST /validation-rules/preview`, auditoría | (a) una regla creada por API **bloquea** un documento real con el mensaje; (b) desactivada, pasa; (c) el preview evalúa **sin** guardar; (d) 0 consultas por línea (un caso lo pinza); (e) un campo fuera del registro **no compila** |
| **P5A2 — pantalla** | listado + formulario constructor de condiciones + preview contra un documento real | crear/editar/desactivar desde la UI; el preview muestra el mismo resultado que el guardado |

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
