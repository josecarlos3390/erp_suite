---
name: practicas-backend
description: Prácticas portables para construir y mantener el backend de una aplicación NestJS con Prisma y PostgreSQL, sin arrastrar el dominio de ningún proyecto concreto. Se invoca al crear o reorganizar un módulo, al escribir un DTO, un controlador o un servicio, al decidir dónde vive una regla de negocio, al envolver una escritura en una transacción, al modelar el aislamiento por inquilino, al tipar consultas de un ORM, al resolver un cambio de esquema con deriva, al importar datos en masa, al escribir pruebas unitarias con dobles de la base de datos y al revisar un backend antes de entregarlo. Cubre la arquitectura por capas, la validación en el borde, la transaccionalidad de la escritura, el contrato de errores, el tipado estricto sin supresiones, los flujos de documento con efectos derivados, la migración idempotente y la estrategia de prueba con dobles. Portable entre proyectos del mismo stack, no depende del dominio. Use when scaffolding or reviewing a NestJS + Prisma backend — modules, DTOs, controllers, services, transactions, multi-tenant scoping, migrations, bulk import or unit tests.
---

# Prácticas de backend — NestJS + Prisma + PostgreSQL

> **Esta skill es de prácticas, no de un proyecto.** Nada de lo que hay aquí depende de un modelo,
> una ruta, un impuesto ni un sistema de diseño concretos: se puede copiar a otro backend del **mismo
> stack** sin cambiar una palabra de las reglas. Si una práctica solo tiene sentido en un repositorio
> concreto, **no va aquí**: va a la receta de ese repositorio.
>
> **Los ejemplos usan nombres genéricos a propósito.** Un módulo `orders/` con entidades `order` y
> `orderLine` es el mínimo común denominador de cualquier backend con documentos. Antes de copiar
> código, **sustituye esos nombres por los tuyos**; si tu proyecto tiene una guía canónica, esa guía
> manda sobre esta skill.
>
> **Por qué cada práctica lleva su caso pegado.** Una práctica sin el caso que la originó es un
> consejo, y un consejo no sobrevive a la siguiente prisa. El caso —generalizado, sin nombres
> propios— es lo que la hace comprobable y lo que impide que alguien la «simplifique» dentro de un mes.
>
> **Frontera con las otras skills.** Aquí está el **cómo se construye**. Para lo que es **prueba**
> —escribir un gate que bloquee de verdad, ver el caso de borde en rojo antes del arreglo, medir el
> antes y el después, migrar un índice o una línea base— sigue la skill `verificacion-y-medicion`. Para
> las **clases de defecto** que no gritan —fechas, dinero, inquilinos, dobles de prueba— sigue
> `trampas-conocidas`.

## Cuándo se invoca

| Si vas a… | Ve a |
|---|---|
| crear un módulo, decidir dónde vive una regla o qué capa hace qué | **A**, y luego la checklist de **H** |
| escribir o revisar un DTO, un controlador o el contrato de errores | **B** |
| envolver una escritura, encadenar efectos o anular un documento | **C**, **E** |
| tocar consultas, tipado del ORM o aislamiento por inquilino | **D** |
| modelar un documento con cabecera y líneas, o encadenar documentos | **E** |
| cambiar el esquema, migrar, o importar datos en masa | **F** |
| escribir pruebas unitarias o decidir qué se prueba con dobles | **G** |
| revisar un backend antes de entregarlo | la checklist de **H** |

Y la puerta de entrada: **ninguna decisión de dominio se toma en la capa que solo transporta datos**.
El controlador traduce; el servicio decide; el ORM persiste.

---

## A. Arquitectura y capas

### P1 · El controlador traduce, el servicio decide, el ORM persiste.

**La práctica.** Tres responsabilidades, tres sitios, y ninguna se salta a la otra: el controlador
convierte HTTP en una llamada de dominio (y la respuesta en HTTP), el servicio concentra las reglas,
y el ORM es la capa de acceso a datos. El controlador **no** calcula, **no** consulta por su cuenta
para decidir y **no** conoce el orden de las escrituras.

**Por qué.** Cuando el controlador opina, la regla existe tantas veces como endpoints la invocan
—HTTP, un trabajo programado, una importación masiva, una prueba—, y cada copia deriva a su ritmo.

**→ Qué hacer.**
- El controlador recibe, delega y devuelve. Si tiene un `if` que no sea de traducción (parsear un
  query param, elegir la forma de la respuesta), esa regla está mal ubicada.
- Un método público del servicio por **caso de uso**, no por tabla. `create`, `findAll`, `findOne`,
  `update`, `close`, `cancel` es un contrato de caso de uso; `findManyByStatus` es una consulta.
- El servicio recibe el autor y el inquilino como **parámetros explícitos**; no los lee de un contexto
  global ni del cuerpo de la petición.

**Caso (generalizado).** Una operación de escritura devolvía `201` con cuerpo `{}`: la transacción se
ejecutaba y **nadie capturaba ni devolvía** su resultado. El defecto vivió hasta que una prueba
afirmó la forma de la respuesta en lugar de solo el código de estado.

### P2 · No pongas una capa encima de un ORM que ya te da consultas tipadas.

**La práctica.** Con un ORM que genera un cliente tipado, **el cliente es la capa de acceso a datos**.
Se inyecta donde se necesita y se acabó. No se envuelve en un repositorio propio que solo reenvía
métodos.

**Por qué.** Un repositorio que reenvía no abstrae nada: cuesta un fichero por entidad, esconde la
capacidad real del ORM (incluidos, transacciones, agregados) y obliga a mantener tipos duplicados. El
valor de un repositorio —poder cambiar de motor sin tocar el dominio— no se cobra nunca si el motor
no va a cambiar.

**→ Qué hacer.**
- Inyecta el cliente del ORM directamente en el servicio.
- Si necesitas una abstracción de verdad, que sea **de consulta de negocio** (`PriceResolver`,
  `AccountingEngine`), no un `OrderRepository` que reexporta `create`/`findMany`.
- El cliente vive en un módulo **global**: se inyecta sin importar el módulo en cada sitio.
- Importa otros módulos solo cuando necesites **sus servicios**.

### P3 · Toda escritura multi-paso vive en una transacción, y dentro de ella todo usa el cliente transaccional.

**La práctica.** Si una operación escribe en dos sitios —cabecera y líneas, documento y stock,
documento y asiento—, va dentro de **una** transacción, y **todas** las consultas de dentro usan el
identificador transaccional (`tx`), no el cliente global.

**Por qué.** Un `prisma.create` fuera del `tx` se confirma aunque la transacción aborte: el efecto
parcial no da error, deja datos. Y **devuelve el resultado**: una transacción cuyo valor de retorno se
descarta convierte el defecto anterior en una respuesta vacía.

**→ Qué hacer.**
- `return this.db.$transaction(async (tx) => { … })` y `return` explícito de lo que se persiguió.
- Regla mecánica: dentro del bloque, si ves el cliente global otra vez, es un error — salvo lectura
  fuera de alcance deliberada y comentada.
- Los ayudantes que participan de la escritura **reciben `tx` como primer argumento**. Si un ayudante
  no lo recibe, no puede participar de una transacción y acabará abriendo la suya.
- Efectos derivados (stock, saldos, contadores, asientos) entran **en la misma** transacción que el
  documento.

---

## B. El borde: validación y contrato

### P4 · Valida en el borde, con tipos declarados, y con la lista blanca cerrada.

**La práctica.** La entrada se valida en el borde con clases decoradas (validación declarativa),
**toda** propiedad tiene su decorador, y la tubería de validación global corre en modo estricto:
lista blanca activa y rechazo de propiedades no declaradas.

**Por qué.** Un cuerpo sin validar es una entrada de datos sin esquema: el error se descubre tres
capas más abajo, en forma de `undefined` en una consulta. Y sin lista blanca cerrada, un cliente puede
enviar campos que no declaraste —incluidos los que deciden el inquilino o el estado— y el ORM los
persiste.

**→ Qué hacer.**
- Una clase por DTO de entrada; enums como unión de literales con `@IsIn`; anidados con `@IsArray` +
  `@ValidateNested({ each: true })` + `@Type(() => InnerDto)`.
- Convierte los números **explícitamente** en el DTO (`@Transform` a `Number`) en lugar de confiar en
  la coerción: llegan como texto desde un formulario y un `+x` silencioso esconde un `NaN`.
- El DTO de actualización deriva del de creación (`PartialType`) **salvo** que la actualización tenga
  que distinguir líneas existentes de nuevas: entonces se escribe a mano.
- Documenta **cada** propiedad para el esquema de la API: si el contrato se publica, la documentación
  incompleta es un contrato a medias.
- Declara los DTO con los campos **opcionales** que el cliente puede enviar por compatibilidad, en vez
  de aceptarlos sin declarar.

### P5 · La regla de negocio se rechaza con un 400 explícito; el error de unicidad se traduce, no se filtra.

**La práctica.** El servicio lanza excepciones HTTP con significado —no encontrado, entrada inválida,
conflicto, no autorizado— y **traduce** los errores del motor que tienen un equivalente de negocio: la
violación de una restricción única se convierte en conflicto, no en un 500 con la traza del motor.

**Por qué.** Un 500 por una violación de unicidad es mentira: la petición estaba bien formada y el
estado la rechazó. El cliente no puede distinguir «lo intentaste mal» de «el sistema se rompió», y el
equipo acaba endureciendo el cliente en lugar de arreglar el contrato.

**→ Qué hacer.**
- Identifica el error del motor por su **código**, no por el texto del mensaje (los textos cambian y se
  localizan).
- Cuando la causa es «no existe», «no es tuyo» o «está en un estado equivocado», el mensaje debe decir
  **cuál** de las tres.
- No devuelvas el error crudo del motor al cliente.

### P6 · El contrato de respuesta es parte de la API: devuelve el agregado, no un acuse.

**La práctica.** El endpoint de escritura devuelve el agregado con sus relaciones, en la misma forma
en que lo devuelve la lectura. La lista devuelve un sobre de paginación con `data`, `total`, `page`,
`limit`, `totalPages` —siempre los mismos nombres—.

**Por qué.** Un `201 {}` obliga al cliente a una segunda petición para pintar lo que acaba de crear, y
un sobre de paginación que cambia de nombres entre módulos obliga al cliente a un mapeo por módulo.

**→ Qué hacer.**
- `include` de las relaciones en la lectura de retorno, y el mismo `include` en la creación.
- Un tipo de sobre paginado **único** para todo el backend, con el conteo y la página efectiva.
- La búsqueda de una lista debe cubrir **código y nombre** (y el código del catálogo referenciado),
  insensible a mayúsculas: quien busca en un listado escribe lo que tiene a mano, y casi siempre es un
  código.

---

## C. La escritura: transacción y efectos

### P7 · El orden de una escritura con líneas es fijo, y se lee de arriba abajo.

**La práctica.** Crear un agregado con líneas sigue siempre el mismo orden:

1. Abrir la **transacción**.
2. **Validar** lo que se referencia (que las entidades del catálogo existen y son del inquilino) —antes
   de escribir nada—.
3. **Resolver los valores por defecto** que dependen de configuración.
4. **Construir las líneas** aplicando las reglas (precio, impuesto, descuento, coste).
5. **Calcular los totales de cabecera** a partir de las líneas ya construidas (nunca al revés).
6. **Crear la cabecera** con los totales.
7. **Crear las líneas** en bloque, numeradas por posición.
8. **Aplicar los efectos derivados** (existencias, saldos, comprometido).
9. **Devolver** el agregado con sus relaciones.

**Por qué.** El orden no es estético: si calculas los totales antes de construir las líneas, tienes dos
fuentes de la misma verdad y una de ellas se queda atrás en la primera regla nueva. Si escribes la
cabecera antes de validar los catálogos, dejas una cabecera huérfana cuando la validación falla —y si
estás fuera de transacción, la dejas de verdad—.

**→ Qué hacer.**
- Reutiliza **la misma** función de construcción de líneas en crear y en actualizar: es el punto donde
  una regla nueva se olvida en una de las dos ramas.
- La numeración de líneas es **posicional** (`1..n`) y se regenera al reconstruir.
- Los ayudantes de cálculo no consultan la base: reciben los datos resueltos.

### P8 · Un campo que mueve dinero y no se consume es un defecto, no un campo ignorado.

**La práctica.** Si un campo numérico de la entrada puede mover el total, tiene **dos** salidas: o el
cálculo lo consume, o el servicio rechaza la petición con un 400. Nunca se acepta y se ignora.

**Por qué.** Un campo aceptado y no consumido es el peor de los tres estados posibles: el usuario cree
que aplicó un descuento, la interfaz lo confirma y el importe persistido no lo refleja. Cuando el
sistema tiene partida doble, además, el descuadre aparece lejos, en el cierre.

**Caso (generalizado).** Un importe de retención se aceptaba en el formulario, en el DTO y en la
validación, pero el constructor del asiento **nunca lo leía**: cualquier operación con retención moría
con un descuadre cuyo importe era exactamente la retención. Dos lecciones que generalizan: **(1)** un
campo que mueve dinero tiene que aparecer en el cálculo o ser rechazado; **(2)** hay que revisar **todas
las ramas** del constructor —la rama heredada seguía debitando el importe bruto, así que solo una de
las ramas cuadraba—.

**→ Qué hacer.**
- Al añadir un campo numérico nuevo, busca **quién lo consume**; si la respuesta es «nadie», el
  incremento está a medias.
- Cuando la lógica tenga ramas alternativas (varios modos de pago, líneas manuales, una ruta
  heredada), revisa **cada rama por separado** con la misma aritmética.
- Si el dominio tiene partida doble: construye el asiento y **verifica que cuadra antes de
  persistir**, con un error que diga debe, haber y diferencia. Ese error es un 500 y significa que al
  constructor le falta un lado.

### P9 · Los efectos derivados se aplican y se revierten con el mismo cuidado que la escritura.

**La práctica.** Un agregado que produce efectos sobre otro estado (existencias, saldos, comprometido,
contadores) tiene **una** función por dirección: aplicar y revertir. Actualizar y anular pasan por
ellas; no hay aritmética de existencias suelta en un servicio.

**Por qué.** Actualizar un documento es, por dentro, **revertir el impacto viejo y aplicar el nuevo**.
Si esa simetría no está escrita en un solo sitio, el impacto viejo se resta mal (o no se resta) y el
error no se manifiesta hasta que el estado acumulado deja de cuadrar.

**→ Qué hacer.**
- `apply*` y `reverse*` por cada familia de efecto, y siempre con `tx`.
- Actualizar = leer lo existente → revertir su impacto → reconstruir líneas → aplicar el nuevo.
- Anular = **borrado lógico** (un estado, no un `DELETE`) + revertir efectos + revertir el asiento si
  lo había. Los registros de negocio no se borran: se marca su estado.
- El estado del documento y su efecto son **la misma transacción**; nunca «primero anulo y luego
  revierto».

---

## D. Datos: tipado y aislamiento

### P10 · Cero supresiones de tipo. El tipo se arregla, no se silencia.

**La práctica.** Sin `as any`, sin `@ts-ignore`, sin `@ts-expect-error`, sin desactivaciones de la
regla sin nombrarla. Cuando el tipo no encaja, se arregla **el tipo**: el DTO, la interfaz o el
`GetPayload` de la consulta.

**Por qué.** Cada supresión es una promesa que el compilador deja de verificar, y el error se muda al
runtime, que es donde cuesta. Un proyecto con supresiones no tiene tipado estricto: tiene tipado
estricto **en los ficheros que nadie tocó con prisa**.

**→ Qué hacer.**
- Consultas con `include`: tipa el resultado con `GetPayload`/`typeof include` en lugar de describirlo a
  mano o forzarlo.
- Para delegados dinámicos (actualizar «la línea de este tipo de documento»), usa una **unión
  discriminada** con un caso por modelo, no un `unknown` con un cast.
- Acumuladores y arrays intermedios se declaran con su interfaz real, no con `any[]`.
- Los dobles de prueba se tipan: `as unknown as T`, `satisfies Partial<T>`, `jest.Mocked<T>`. La regla
  del `any` vale **también** para las pruebas.
- Cuando un campo opcional se pasa a una escritura, resuélvelo antes (un valor por defecto explícito)
  en lugar de sembrar aserciones de no-nulo por todo el fichero: un fichero con veinte `!` es un
  fichero donde nadie sabe cuál de los veinte está justificado.
- Un fichero que **ningún** `tsconfig` incluye no está tipado en ninguna parte: comprueba la
  configuración de tipos de los scripts de datos y de la configuración de rendimiento, no solo la del
  código de la aplicación.

**Caso (generalizado).** Un fichero de datos (semilla) quedaba fuera de la configuración de tipos de
la aplicación y solo lo cubría otra configuración: una edición suya podía romper el arranque sin que
ningún `tsc` se quejara.

### P11 · El inquilino se resuelve en el borde, viaja explícito y se filtra en todas las consultas.

**La práctica.** El inquilino (o el espacio de trabajo, o la organización) viene **del token**, nunca
del cuerpo. Viaja como parámetro explícito hasta el servicio, y toda consulta lo filtra. Las claves de
negocio son únicas **por inquilino**, no globales.

**Por qué.** Es la única frontera que no admite un olvido: una consulta sin el filtro no falla, no
avisa y no se nota en desarrollo —donde hay un solo inquilino—. Devuelve datos de otro.

**→ Qué hacer.**
- Filtra en `where` de forma **explícita**. Comprueba qué operaciones de tu ORM admiten un filtro
  automático y cuáles no: la extensión que inyecta el inquilino en `findMany`/`count`/`updateMany`
  suele **no** cubrir `findUnique`/`delete`/`upsert`, y esas son justo las que se escriben a mano.
- Unicidad por inquilino en las claves de negocio (`@@unique([tenantId, code])`), y la búsqueda por
  código incluye el inquilino.
- El inquilino no se acepta del cuerpo ni del query: si el cliente puede elegirlo, el aislamiento es
  decorativo.
- Si el proyecto tiene una regla de lint propia para esto, **es el gate que la hace cumplir**: una
  convención sin gate es un deseo (ver `verificacion-y-medicion`).

### P12 · Convenciones de nombres y estructura: predecibles antes de escribir la primera línea.

**La práctica.** Un módulo por dominio, en una carpeta con el nombre del recurso en `kebab-case`, con
el mismo esqueleto siempre:

```
src/<recurso>/
├── dto/
│   ├── create-<recurso-singular>.dto.ts
│   └── update-<recurso-singular>.dto.ts
├── <recurso>.module.ts
├── <recurso>.controller.ts
├── <recurso>.service.ts
├── <recurso>.service.spec.ts
└── <recurso>.controller.spec.ts
```

**Por qué.** La estructura repetida es lo que permite que alguien encuentre algo en un módulo que no
escribió. Y las pruebas **al lado** del código, no en un árbol paralelo: cuando la prueba está lejos,
deja de actualizarse.

**→ Qué hacer.**
- El nombre del recurso en `kebab-case` en rutas, carpetas y decoradores; `PascalCase` en las clases.
  La ruta del controlador coincide con el nombre de la carpeta.
- Los ficheros de prueba llevan el sufijo del framework (`*.spec.ts`) y el mismo nombre que lo que
  prueban.
- Los imports relativos siguen una convención clara hasta que existan alias de ruta; si los añades,
  que sean pocos y por área (`@common/*`, `@db/*`), y no mezcles ambas formas en el mismo fichero.
- Un ayudante compartido vive en un sitio compartido **con nombre de lo que resuelve** (`<dominio>.util`,
  `<dominio>.helper`), no en `utils.ts`.

---

## E. Documentos con cabecera, líneas y vida propia

### P13 · Un contrato de caso de uso igual para todos los documentos.

**La práctica.** Todo agregado documental expone el mismo conjunto de operaciones con las mismas
firmas y el mismo comportamiento:

| Operación | Firma | Qué debe hacer |
|---|---|---|
| `create` | `(dto, createdById, tenantId) => AgregadoConLíneas` | numerar, validar catálogos, calcular líneas, crear cabecera + líneas, aplicar efectos |
| `findAll` | `(params, tenantId) => Paginado` | buscar por código y por nombre, filtrar por estado, paginar, incluir relaciones |
| `findOne` | `(id, tenantId) => AgregadoConLíneas` | incluir relaciones y lanzar «no encontrado» |
| `update` | `(id, dto, updatedById, tenantId) => AgregadoConLíneas` | validar estado, revertir el impacto viejo, reconstruir líneas, aplicar el nuevo, recalcular totales |
| `close` | `(id, updatedById, tenantId) => AgregadoConLíneas` | validar el estado, crear el documento destino con trazabilidad, marcar el origen |
| `cancel` | `(id, updatedById, tenantId) => AgregadoConLíneas` | validar que no está anulado, revertir efectos, marcar el estado |

**Por qué.** Es lo que permite escribir la interfaz de una vez: la lista, el formulario y las acciones
de fila funcionan igual en treinta pantallas porque las firmas son las mismas. Cuando un documento
rompe el contrato «porque es especial», deja de heredar todo lo que ya estaba resuelto.

**→ Qué hacer.**
- El estado del documento es un **vocabulario cerrado** y compartido (borrador/abierto/cerrado/
  anulado, o el que sea), y se declara una vez.
- El «no encontrado» de `findOne` es del **inquilino**: se busca por `(id, tenantId)`.
- Registrar una operación nueva es una fila más en esta tabla: si no encaja, es que el dominio tiene
  dos contratos y hay que decirlo.

### P14 · Numeración: legible, por secuencia, y que se cure sola.

**La práctica.** Los documentos llevan un código legible (prefijo + contador con relleno) consumido de
una **secuencia** por inquilino y tipo. El registro de secuencias es un mapa único que también crea
las secuencias en la base al arrancar. Y el consumo **se cura**: comprueba el máximo ya usado para ese
prefijo y, si el número asignado está tomado, consume el siguiente.

**Por qué.** La numeración es lo primero que colisiona y lo último que se diagnostica. Dos series
activas con el mismo prefijo chocan contra el índice único, y el síntoma es un 500 de restricción
única en un documento que el usuario acaba de teclear. La autocuración convierte un incidente de datos
en una operación que sale sola. Y la secuencia se crea al arrancar porque una secuencia que no existe
no da error de negocio: da error de base.

**→ Qué hacer.**
- Registra la secuencia en **un solo** mapa y crea las que falten al arrancar (idempotente).
- No incluyas el año fiscal en el código salvo que el negocio lo exija: es lo que hace que dos series
  del mismo tipo compartan prefijo.
- En datos de prueba y de QA, empieza los contadores **altos** (por ejemplo 1000): así una serie nueva
  no pisa documentos ya creados y no peleas con la autocuración.
- No «arregles» una colisión editando el contador a mano en los datos: la curación es del servicio, y
  un contador bajo volverá a colisionar.

### P15 · Trazabilidad entre documentos: los identificadores del origen se declaran y sobreviven.

**La práctica.** Un documento creado a partir de otro guarda **de dónde vino**: el tipo de origen, el
identificador del documento y el identificador de **su línea**. Los tres campos existen en cabecera y
en línea, y se copian al encadenar (presupuesto → pedido → albarán → factura).

**Por qué.** La trazabilidad es lo que permite responder «¿de dónde salió esta línea?» y lo que valida
que no se factura dos veces lo mismo. Cuando el identificador de línea se pierde por el camino, el
sistema sigue funcionando pero deja de poder comprobar la cantidad pendiente: acepta duplicados en
silencio.

**→ Qué hacer.**
- Guarda el id de la **línea** de origen, no solo el del documento: sin él no hay forma de saber qué
  queda pendiente.
- Toda creación derivada mantiene los tres campos, también en `createMany` de líneas.
- Un campo de trazabilidad que la capa de hidratación no conoce **se cae en silencio** (el
  serializador omite la clave `undefined`). Al añadir un campo de estos, añádelo también a la ruta de
  hidratación y léelo al construir la petición.
- Cierra el ciclo con una prueba que afirme que **el vínculo sobrevivió**, no solo que la respuesta
  fue 201.

### P16 · Un documento que toca dinero deja su asiento, cuadrado, en la misma transacción.

**La práctica.** Si el dominio tiene partida doble, todo documento con efecto contable genera su
asiento al confirmarse —**dentro de la misma transacción**— y lo revierte al anularse. El asiento se
verifica equilibrado antes de persistirlo.

**Por qué.** Un asiento generado fuera de la transacción es un documento sin contabilidad cuando algo
falla después. Y un asiento generado por un camino distinto por cada tipo de documento es la forma más
segura de tener dos contabilidades.

**→ Qué hacer.**
- Un motor de asientos con **una** fachada y un constructor por familia; añadir un tipo de documento
  nuevo = constructor + método de fachada + caso en la vista previa.
- La verificación de cuadre va **dentro** del motor, antes de escribir, con un mensaje que incluya
  debe, haber y diferencia.
- El reverso es una operación del motor, no un borrado del asiento.
- `totalCost`/coste y los importes de línea se calculan con **la misma** función que los del
  documento: dos cálculos del mismo número divergen.

### P17 · Los valores por defecto se resuelven en cadena, y la cadena se declara.

**La práctica.** Cuando un valor puede venir de varios sitios (lo que envió el cliente → el valor del
maestro → el valor del grupo del maestro → el valor del sistema), la resolución se escribe **en ese
orden explícito**, en un único sitio, y el resultado se materializa en el documento.

**Por qué.** Una cadena de valores por defecto sin orden escrito se implementa distinto en cada
servicio, y la diferencia se descubre cuando dos documentos del mismo tipo salen con condiciones
comerciales distintas. Materializar el resultado (guardar lo resuelto, no el puntero) evita que un
cambio posterior en el maestro reescriba la historia.

**Caso (generalizado).** Un plazo de pago se resolvía con la cadena «lo pedido → el maestro → el grupo
del maestro», calculaba el vencimiento a partir de la fecha base y, si el plazo traía líneas,
construía el plan de cuotas. Al materializar plazo, vencimiento y descuento por pronto pago **en la
factura**, cambiar después el maestro no movió las facturas ya emitidas.

**→ Qué hacer.**
- Una función por resolución, que reciba los candidatos ya cargados y devuelva el valor resuelto con
  su procedencia.
- Guarda el resultado resuelto (fecha de vencimiento, porcentaje aplicado), no solo el identificador.
- Los importes derivados se redondean **al aplicarse**, con la política de redondeo declarada una vez.

---

## F. Esquema y datos

### P18 · Cambiar el esquema con deriva: diff contra la base viva, migración idempotente, y registrar.

**La práctica.** Cuando la base de datos real tiene deriva respecto a las migraciones versionadas, el
procedimiento no es «resetear»:

1. Escribe el cambio en el esquema y **valídalo**.
2. **Genera el SQL delta** entre la base viva y el esquema nuevo, en lugar de escribir la migración a
   mano.
3. Guárdalo como migración y haz el DDL **idempotente** (`ADD COLUMN IF NOT EXISTS`, claves ajenas
   dentro de un bloque condicional).
4. **Ejecútalo** contra la base y regístralo como aplicado.
5. **Regenera el cliente** del ORM (con el servidor parado: el cliente puede tener el binario abierto).

**Por qué.** Un `migrate dev` sobre una base con deriva pide un reset, y el reset borra datos. La
idempotencia no es un lujo: un despliegue que aplica migraciones **y** SQL manual puede ejecutar el
mismo script dos veces, y un `CREATE` no idempotente deja el despliegue a medias con la migración sin
registrar.

**Caso (generalizado).** Un script no idempotente ejecutado dos veces dejó el pipeline en un estado
`P3009` —migración fallida y bloqueada—, con la migración aplicada a medias y sin registrar.

**→ Qué hacer.**
- Valida el esquema antes de generar el delta y **lee** el SQL generado: es el único sitio donde ves
  qué se va a borrar.
- Registra la migración como aplicada en el mismo paso en que la ejecutas, y verifica el estado.
- Tras un cambio de esquema, vuelve a alinear los datos derivados (cuentas, mappings, catálogos) con
  un script **idempotente y de solo-relleno**: nunca sobreescribe lo que el inquilino configuró.
- Documenta el procedimiento en el propio repositorio: es el que se olvida entre dos personas.

### P19 · Importación masiva: un formato de libro, upsert por clave y una transacción por agregado.

**La práctica.** Las importaciones comparten **un** formato de libro (una hoja de datos con cabeceras
amigables y filas de ejemplo que el importador salta, una hoja de instrucciones y una de catálogos con
los códigos del inquilino), hacen **upsert por clave de negocio**, y devuelven un resumen con
creados/actualizados/errores/total. La transacción es **por agregado**, no por fichero.

**Por qué.** Upsert por clave porque reimportar el mismo fichero corregido es lo normal, y duplicar no
es una opción. Transacción por agregado porque en un fichero de mil filas, una mala no puede tirar las
otras 999 —pero tampoco puede dejar media entidad—. Un formato único porque cada importador nuevo con
su propio formato es un manual nuevo para el usuario.

**→ Qué hacer.**
- Tapa el tamaño (un límite explícito de filas) y dilo en el error; un fichero de un millón de filas
  no es un caso de éxito.
- Sumidero de errores **por fila** con número de fila y motivo, y el resumen al final.
- La plantilla vacía se sirve desde el propio backend, generada de la misma definición: así no puede
  desincronizarse del importador.
- Un importador que crea entidades con efectos (existencias, precios) aplica los efectos por la misma
  función que el alta individual.

### P20 · Las pruebas de carga necesitan un contexto real, y se validan ejecutándolas.

**La práctica.** Un escenario de carga no arranca contra datos que no existen: el arnés **crea su
propio contexto** (tasas del día, periodo abierto, series, terminales) a través de la API, igual que lo
hace cualquier cliente. Y una herramienta de carga se valida **corriéndola**, no revisándola.

**Por qué.** La semilla de datos de desarrollo no crea el contexto operativo completo, y el fallo se
manifiesta como un 400 en el escenario, que se atribuye al rendimiento cuando es de datos. Y un motor
de scripts distinto del de Node no soporta lo mismo: una comprobación previa en Node dice «está bien»
y el motor real no arranca.

**Caso (generalizado).** El motor de scripts de la herramienta de carga no soportaba la expansión de
objetos en literales: los escenarios no cargaban, y la comprobación previa en Node los daba por
buenos. **Valida cualquier cambio de los escenarios ejecutando la herramienta.**

**→ Qué hacer.**
- Un ayudante idempotente de contexto (`ensureX`) por cada dato requerido, invocado desde el escenario.
- Los umbrales de latencia, por **escenario**: un perfil largo que solo reporta y un gate corto que
  bloquea son dos configuraciones distintas, no una.
- Documenta el modo de cada job de carga (reporta vs bloquea) al lado del job.

---

## G. Pruebas

### P21 · Pruebas unitarias con dobles de la base de datos; nunca una base real.

**La práctica.** El servicio se prueba con un **doble del cliente del ORM** —funciones espía por
método— y un doble de la transacción que **invoca el callback con tu cliente simulado**. Las pruebas de
integración, con base real, viven aparte y son las que crean documentos de verdad.

**Por qué.** Una prueba unitaria que necesita una base deja de ser unitaria: se vuelve lenta, frágil y
dependiente del orden. Y el doble de la transacción es la pieza que casi nadie escribe bien: si
`$transaction` no invoca el callback con tu doble, las aserciones sobre las escrituras pasan **en
vacío** —no se ejecuta nada y la prueba es verde—.

**→ Qué hacer.**
- El doble de la transacción se escribe una vez y se reutiliza:
  `$transaction: jest.fn(async (fn) => fn(mockTx))`. Así puedes afirmar **ambas** cosas: que se abrió
  una transacción y qué se hizo dentro.
- Limpia los espías en el `beforeEach` (`jest.clearAllMocks()`): sin eso, una aserción de «no se llamó»
  mide las llamadas de otra prueba.
- Afirma el **fracaso** además del éxito: que un catálogo inexistente lanza la excepción esperada es
  la mitad del contrato.
- Los catálogos que el servicio consume se doblan también; si un doble devuelve `undefined` para una
  lectura que el servicio espera, la prueba falla por el doble y no por el código.
- Afirma la **forma** de lo devuelto, no solo que no lanzó: es lo que caza el «devuelve `{}` con 201».

### P22 · Qué se prueba con dobles, con base real y con la interfaz.

**La práctica.** Tres niveles con fronteras claras:

| Nivel | Qué prueba | Qué NO prueba |
|---|---|---|
| Unitario con dobles | reglas, decisiones, ramas, cálculos, errores lanzados | que la consulta sea correcta |
| Integración con base real | que el documento se crea, que los efectos se aplican, que el asiento cuadra | el detalle de cada rama |
| Extremo a extremo | el flujo completo a través de la API | la aritmética fina |

**Por qué.** Un comportamiento contable o de efectos encadenados **no** está probado por una prueba
unitaria de un servicio: los dobles devuelven justo lo que la prueba necesita. Y una prueba de
integración de una rama rara es carísima de escribir. Se cubre el comportamiento con las dos mitades:
unitaria para las ramas, de integración para el efecto real.

**→ Qué hacer.**
- Un comportamiento nuevo con efecto (dinero, existencias) se cubre con una prueba unitaria del motor
  —con la determinación de cuentas doblada, afirmando las líneas y que debe == haber— **y** con una
  de integración que crea los documentos reales y lee el resultado con el cliente del ORM.
- Las pruebas de integración que necesitan datos usan ayudantes **idempotentes** (`ensureX`), no
  condiciones que se saltan la prueba si el dato falta: una prueba que se salta sola es una prueba que
  ya no existe.
- Cada prueba crea lo que mide. Un verde que depende del estado acumulado de la máquina de desarrollo
  no es un verde (ver `trampas-conocidas`).
- Los datos de prueba se leen de la configuración del entorno, nunca de un literal con credenciales en
  el fichero de prueba.
- La zona horaria del proceso se declara: si el dominio tiene fechas de negocio, una prueba que no fija
  la zona solo pasa en la zona de quien la escribió.

---

## H. Lineamiento: el orden de trabajo al construir un módulo

Este es el **lineamiento** que hace que las prácticas anteriores se apliquen en el momento en que
importan, en lugar de en una revisión posterior.

1. **Antes de escribir código**: localiza la guía canónica del repositorio y léela. Si esta skill y esa
   guía discrepan, **gana la guía** (y la discrepancia se anota en la skill del repositorio).
2. **Declara el caso de uso** en la tabla de contrato (P13): qué operaciones expone el agregado y qué
   hace cada una. Si una no encaja, es que hay dos contratos.
3. **Escribe el DTO primero** (P4): es la frontera de validación y el contrato de entrada.
4. **Escribe el servicio**: la transacción y el orden de la escritura (P3, P7), los efectos (P9) y los
   errores (P5).
5. **Escribe el controlador al final**, cuando solo le queda traducir (P1) y dar forma a la respuesta
   (P6).
6. **Escribe la prueba unitaria con dobles** en el mismo incremento (P21), incluida la rama de fallo.
7. **Añade la prueba de integración** si hay efecto real (P22) —dinero, existencias, contadores—.
8. **Toca el esquema** con el procedimiento de deriva (P18), nunca con un reset.
9. **Pasa la lista de entrega** de abajo, y no declares nada verde sin la salida del comando que lo
   produjo (skill `verificacion-y-medicion`).

### Lista de entrega del backend

- [ ] Compila y pasa la comprobación de tipos **de todas** las configuraciones que cubren el árbol
      (aplicación, pruebas y los scripts de datos), con 0 errores.
- [ ] Lint en 0 errores **y 0 avisos**; sin supresiones nuevas (`as any`, `@ts-ignore`, reglas
      desactivadas sin nombrar).
- [ ] Pruebas unitarias verdes, incluida la suite completa —no solo el fichero que tocaste—.
- [ ] Aislamiento: toda consulta filtra el inquilino, incluidas las operaciones que **no** lo reciben
      automáticamente.
- [ ] Autorización declarada en los endpoints nuevos y DTO validado en modo estricto.
- [ ] Efectos de dinero y de existencias **dentro de una** transacción, y el endpoint devuelve el
      agregado (no `{}`).
- [ ] Si el esquema cambió: migración idempotente, registrada como aplicada, cliente regenerado y
      scripts de alineación de datos actualizados.
- [ ] Si hay efecto contable: asiento cuadrado probado (unitario + integración) y la guía de dominio
      del tipo de documento actualizada.
- [ ] El resultado se documenta donde el proyecto lo busca (bitácora de cambios, y el registro de
      auditoría si fue un defecto).

---

## Lo que NO entra aquí

Estas prácticas conviven con una **receta de proyecto concreto** (modelos, rutas, impuestos, alias de
integración con un sistema externo, nombres de utilidades, estados y series propios). Esa receta **no** se
copia a un proyecto nuevo: se queda en su repositorio. La frontera, en una frase:

> Si la frase deja de ser verdad al quitar los nombres propios del proyecto, no es una práctica: es
> dominio. La práctica se generaliza; el dominio se queda.

Los detalles operativos de esta skill están en `references/`:

- **Plantillas**: `references/plantillas.md` — módulo, controlador, servicio, DTOs, sobre paginado.
- **Documentos y efectos**: `references/documentos-y-efectos.md` — el orden de escritura, actualización
  con reverso, cierre con trazabilidad, anulación, asientos y valores por defecto en cadena.
- **Pruebas y esquema**: `references/pruebas-y-esquema.md` — recetas de pruebas con dobles, el
  procedimiento de migración con deriva, importación masiva y la lista de entrega ampliada.

**Skills hermanas.** `verificacion-y-medicion` (para lo que es *prueba*: gates, ratchets, migraciones de
índices, medir antes/después) y `trampas-conocidas` (para las clases de defecto que no gritan).
