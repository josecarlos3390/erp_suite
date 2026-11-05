# Plan: «Copiar a» y campos personalizados

> Estado al cerrar la sesión del 2026-11-05. **Nada está a medias**: cada incremento está
> commiteado con la suite completa en verde (3 977/3 977) y los gates de contenido 6/6.
> Lo que falta es **alcance**, no **estado**.

## Dónde estamos

| Pieza | Estado | Instrumento |
|---|---|---|
| Campos personalizados de **cabecera** en «Copiar a» | ✅ 6 rutas, filtradas por el destino | `audit:copiar-a:check` (gate, 0 rutas crudas) |
| **Contrato del alias** (mismo `fieldName` ⇒ mismo tipo) | ✅ 409 al definir | — (regla en `udf.service`) |
| Campos personalizados de **línea** | ⚠️ motor listo, **1 de 6** rutas | — |
| **Número de línea del origen** (`baseLineNum`) | ⚠️ resolutor listo, **1 de 5** sitios | — |
| **Índice de búsqueda** (`CustomFieldValue`) | ⚠️ **135 de déficit** en 24 ficheros | `census:udf-index` (congelado, en pre-push) |
| **Validaciones personalizadas** | ⬜ no empezado | — |

## Riesgo real de lo pendiente, medido

Ninguno corrompe dinero ni stock. Lo que falla es **degradación**, no cálculo:

| Frente | Qué pasa hoy | Quién lo nota |
|---|---|---|
| Índice (135) | El campo existe en el documento y **no se puede filtrar por él** | El usuario que busca, y **no encuentra** |
| `baseLineNum` (4) | Al copiar un **subconjunto**, la devolución apunta al número de línea del documento **inmediato**, no al original | El que lee una devolución y no cuadra la línea |
| Campos de línea (5) | El campo **no viaja**; hay que reescribirlo | El que copia y ve el campo vacío |
| Validaciones | No existen | Nadie (nunca se prometieron) |

**La relación técnica no se pierde en ningún caso**: la FK viaja (`quotationItemId`,
`orderItemId`) y los pendientes por línea se calculan bien. Lo que se pierde es la
**relación documental** que leen devoluciones y notas de crédito.

## Verificación de compatibilidad, hecha

`erp_db`, 2026-11-05:

```
UserDefinedField = 0 · CustomFieldValue = 0 · alias con tipos en conflicto = 0
```

El contrato del 409 **no rompe datos existentes**: no hay ninguno. Y el déficit del índice
es **teórico hoy** — aparecerá en cuanto un tenant defina campos.

## Los cuatro frentes, en orden de riesgo

### P1 — `baseLineNum` en los 4 sitios restantes

**Por qué primero**: es el único que produce un dato **visible y equivocado** (una devolución
que referencia la línea de su propio documento).

Los sitios: `purchase-invoices`, `purchase-receipts`, `sale-invoices`, `sale-reserve-invoices`.
**Dos de ellos resuelven la base desde DOS modelos** (`salesQuotationItemId` **o**
`salesOrderItemId`), así que necesitan **dos mapas** — no es el mismo cambio mecánico.

**Criterio de aceptación**: copiar 3 líneas **salteadas** (2, 5, 9) y verificar que el destino
guarda 2, 5 y 9. Con las líneas en orden, `index` y `lineNum` **coinciden** y el defecto es
invisible: el caso tiene que usar un subconjunto.

### P2 — Bajar el déficit del índice (135 → 0)

**Por qué segundo**: es **silencioso**. No hay error; hay un filtro que no devuelve.

Mecánico, con el patrón ya probado en `sales-orders` y `delivery-orders`:

```ts
await syncCustomFieldValues(tx, tenantId, '<Tabla>', doc.id, doc.customFields, lineas);
```

**Ojo con la forma de cada `create`**: algunos no devuelven las líneas (`include` ausente), y
entonces hay que leerlas por su id — una consulta acotada al documento, como en
`delivery-orders`.

**Criterio de aceptación**: `census:udf-index` baja con cada ruta y `--update-baseline` se
ejecuta **en el mismo commit**. Nunca al revés.

### P3 — Campos de línea en las 5 rutas restantes

Motor listo (`prepareCustomFieldsCopy`, definiciones leídas **una vez** por documento).
Filtro antes del bucle, `filtroCamposLinea(x).valores` dentro.

### P4 — Validaciones personalizadas

**Funcionalidad nueva**, no deuda. Merece su propio plan: campos personalizados por tenant,
reglas de obligatoriedad, y la decisión de **dónde engancha** (al guardar el documento o al
confirmarlo) — que cambia todo lo que el usuario puede hacer.

## Invariantes que no se pueden romper al tocar esto

1. **Ninguna ruta copia el saco crudo** (`customFields: quotation.customFields`) — lo impide
   `audit:copiar-a:check`.
2. **El alias tiene un solo tipo** por tenant — lo impide el 409 de `udf.service`.
3. **El déficit del índice no crece** — lo impide `census:udf-index:gate` en el pre-push.
4. **Los campos de la cabecera siguen siendo `Record<string, unknown>`** y se validan en la
   frontera; no se adopta un dominio cerrado sin añadir la validación que lo haga cumplir.
5. **La relación técnica (FK) y la documental (`baseLineNum`) son dos cosas**: la primera
   nunca se pierde; la segunda es la que hay que completar.

## Lo que NO se hace

- **Tabla de mapeo campo→campo.** Añade configuración para el 90 % de los casos que ya
  funcionan por alias. Si algún día hace falta **renombrar al copiar**, se añade **encima**.
- **Extensión de Prisma que sincronice el índice automáticamente.** Tienta (arreglaría los 24
  ficheros de una vez), pero un error ahí toca **todos los `create`** de la aplicación y no se
  ejercita en los tests unitarios (los mocks no pasan por el cliente real).

## Cómo empezar la próxima sesión

1. `cd backend-erp && npm run census:udf-index:check` — la cifra vigente.
2. `npm run audit:copiar-a:check` — confirma que sigue en verde.
3. Leer `docs/reference/CAMPOS_PERSONALIZADOS.md` (el comportamiento, ya escrito).
4. Atacar **P1**, que es el de mayor riesgo.
