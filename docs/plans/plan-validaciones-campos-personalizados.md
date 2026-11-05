# Plan: validaciones personalizadas de campos (P4)

> **Estado: propuesta. NO implementado.** Este documento existe porque P4 es
> **funcionalidad nueva**, no deuda, y la decisión de **dónde engancha** cambia lo que el
> usuario puede hacer. No se escribe código hasta que el usuario elija la modalidad.

## 1. Qué se pide, y qué NO

Hoy un campo personalizado (`UserDefinedField`) declara `isRequired`, pero **nadie lo
hace cumplir**: el borde acepta cualquier objeto JSON (`@IsOptional() @IsObject()`) y el
servicio lo persiste tal cual. Medido el 2026-11-05 en `backend-erp`:

- `UserDefinedField` tiene `isRequired` en el esquema y **0** lectores en `src/` fuera
  del CRUD de definiciones.
- En `erp_db` hay **0** definiciones y **0** valores: el contrato del alias y la
  obligatoriedad **no rompen datos existentes** (verificado en
  `docs/reference/CAMPOS_PERSONALIZADOS.md`).

Lo que P4 agrega: **reglas por tenant** que deciden si un documento puede guardarse o
confirmarse con sus campos personalizados incompletos. Lo que **no** agrega: un motor de
reglas genérico (fórmulas, dependencias entre campos, expresiones) — eso es otro plan.

## 2. Las dos piezas, separadas

| Pieza | Qué es | Dónde vive |
|---|---|---|
| **Obligatoriedad** | un campo declarado `isRequired` tiene que venir **no vacío** | la definición (`UserDefinedField`) |
| **Validación de valor** | el valor tiene que ser del `fieldType` declarado y, en `SELECT`, una de sus opciones | una función pura nueva |

El motor de copia (`custom-fields-copy.util.ts`) ya **convierte y omite** valores
incompatibles al copiar entre documentos, pero **no valida al guardar**: son dos
responsabilidades distintas y no deben mezclarse.

## 3. La decisión que hay que tomar: ¿al guardar o al confirmar?

Es una decisión de **producto**, con consecuencias medibles en lo que el usuario puede
hacer. Las tres modalidades, con su efecto:

| Modalidad | Cuándo se exige | Qué gana el usuario | Qué pierde |
|---|---|---|---|
| **A — al GUARDAR (borrador incluido)** | todo `create`/`update` | el dato nunca falta | no puede dejar un documento a medias, y el formulario bloquea el guardado parcial |
| **B — al CONFIRMAR** | solo las transiciones a `CONFIRMED`/`CLOSED` | puede guardar un borrador incompleto y completarlo después | el dato puede faltar en un documento que ya mueve stock si el flujo no pasa por `confirm` |
| **C — mixto: obligatorios al guardar, condicionales al confirmar** | `isRequired` al guardar; el resto al confirmar | lo mejor de A y B | **dos reglas** que hay que mantener de acuerdo (el antídoto del repo: un solo motor) |

**Recomendación, con su razón medida**: **B**, y solo para los campos `isRequired`
declarados **activos** del tenant. El motivo es el que ya rige la sucursal del documento
(`AGENTS.md`): un documento que **nace** no debe quedar bloqueado por un campo que el
usuario todavía no conoce —la captura de un UDF de línea es progresiva—, mientras que
**confirmar** es el acto que hace que el documento exista para el resto del sistema. La
modalidad A choca con el flujo real de los borradores (`DocumentDraft`), que hoy guardan
`customFields` sin validar; la C duplica la regla.

**Lo que el usuario tiene que decidir**: si el borrador puede guardarse incompleto. Si la
respuesta es «no», la modalidad es A y el formulario necesita el bloqueo desde la primera
pantalla.

## 4. El motor, y por qué uno solo

```
validarCamposPersonalizados(tabla, sitio, valores, definiciones) → { faltantes, invalidos }
```

- **Puro**: recibe las definiciones ya leídas (el mismo patrón que
  `filtrarConDefiniciones`), así que el mismo núcleo sirve al guardado, a la confirmación
  y —mañana— a la tienda.
- **Una lectura por documento**: `prepareCustomFieldsValidation(tx, tenantId, tabla,
  sitio)` devuelve un validador síncrono, igual que `prepareCustomFieldsCopy`. Sin esto,
  200 líneas cuestan 200 lecturas.
- **Devuelve el motivo**, no un booleano: el borde responde **400** con
  `{ code: 'VALIDATION_ERROR', campos: [...] }` y el mensaje nombra el campo y la regla
  (`"TIPO_VENTA" es obligatorio (HEADER, SaleInvoice)`), que es lo que el usuario necesita
  para corregirlo sin adivinar.

## 5. Dónde engancha (mapa de sitios)

Con la modalidad B:

1. **Al confirmar**: en el `confirm()` de cada familia (ventas, compras, inventario) —
   **un** sitio por familia, no por documento. Si el flujo confirma dentro de la misma
   transacción del alta (p. ej. `delivery-orders` confirma al salir), la validación corre
   **antes** del primer efecto (stock, asiento).
2. **Al guardar**, solo si el usuario elige A: en `buildBaseDocumentData`/los `create` de
   cada servicio. **No** en el DTO: la obligatoriedad la declara el tenant en la base, no
   el código, así que un decorador no puede saberla.

**Regla de alcance**: `appliesTo` decide el sitio. Un campo `LINE` se valida por **línea**
(no por documento) y su falta nombra el número de línea.

## 6. Criterios de aceptación (cuando se implemente)

- [ ] Un campo `isRequired` activo **ausente** en la confirmación ⇒ **400** con el campo
      nombrado, y **ningún** efecto lateral (stock, asiento, progreso).
- [ ] Un campo `isRequired` **inactivo** **no** bloquea (la desactivación es la salida).
- [ ] Un valor de `SELECT` fuera de las opciones ⇒ **400** (hoy se guarda).
- [ ] Un `fieldType` incompatible ⇒ **400** (hoy se guarda).
- [ ] El borrador guarda sin validar (modalidad B) — con su caso.
- [ ] **Una** lectura de definiciones por documento (el caso de las tres líneas del motor
      de copia, replicado).
- [ ] `audit:copiar-a` sigue verde y `census:udf-index` no crece.

## 7. Lo que este plan NO hace

- **Fórmulas ni campos calculados**: es otro plan (necesita un evaluador y un catálogo de
  funciones).
- **Dependencias entre campos** (`si TIPO=MAYORISTA entonces …`): exige orden de
  evaluación y detección de ciclos.
- **Validación en la tienda**: la tienda escribe por el canal (`web-orders`), y su
  contrato de error es otro; se engancharía al mismo motor cuando el canal pase por la
  confirmación.
- **Migrar los valores existentes**: no hay ninguno (`erp_db`: 0 filas), así que el plan
  no incluye backfill. Si un tenant carga datos antes de la implementación, la
  obligatoriedad se evalúa **solo** sobre documentos nuevos o confirmados después del
  despliegue — y eso hay que declararlo en la pantalla.

## 8. Riesgo medido de NO hacerlo

Ninguno de dinero ni de stock: el campo falta y la pantalla lo muestra vacío. El riesgo es
**de proceso** (un dato que la empresa cree obligatorio y el sistema acepta vacío) y se
mitiga con lo de arriba, no con un `required` en el DTO.
