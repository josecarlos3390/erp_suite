---
name: verificacion-y-medicion
description: Reglas portables para verificar un cambio y para escribir gates que de verdad bloqueen. Se invoca al crear o modificar un gate, un ratchet, una línea base o un workflow de CI; al preparar o dejar correr una migración, un codemod o cualquier transformación automática de código; al cambiar el formato de un índice o de una línea base; al verificar un incremento antes de commitear; al declarar el resultado de una verificación con su antes y después y el comando que lo produjo; y al investigar por qué un defecto pasó entre los gates. Cubre la relación regla-gate, comprobar el VALOR y no la forma, que el script arranque de verdad, la prueba de borde vista en ROJO antes del arreglo, el alcance del instrumento que mide frente al que actúa, los filtros que no casan, las herramientas que callan en vez de gritar, el compilador por unidad de trabajo, las aserciones y los casts como cortina, la raíz resuelta por el repositorio, la prueba en rojo fuera del árbol, la migración de índices y el delta por unidad. Portable entre lenguajes y proyectos, no depende de stack ni de herramienta concreta. Use when writing CI gates, ratchets, baselines, migrations, codemods or verifying a change before commit.
---

# Verificación y medición — reglas portables

> **Esta skill no es de ningún proyecto.** No depende del lenguaje, del framework ni de la herramienta de
> turno: son reglas de **cómo se verifica un cambio** y de **cómo se escribe un gate que de verdad
> bloquea**. Se puede copiar tal cual a un repositorio nuevo, en otro lenguaje, sin cambiar una palabra.
> Si una regla solo tiene sentido en un repositorio concreto, **no va aquí**: va al manual de ese
> repositorio.
>
> **Por qué cada regla lleva su caso pegado.** Una regla sin el caso que la originó es un consejo, y un
> consejo no sobrevive a la siguiente prisa. El caso es lo que la hace comprobable y lo que impide que
> alguien la «simplifique» dentro de un mes.

## Cuándo se invoca

| Si vas a… | Ve a |
|---|---|
| escribir o modificar un gate (CI, ratchet, auditoría, hook, script de verificación) | **R1–R4**, **R14**, **R15** |
| adoptar un cambio y declarar el resultado | **R5–R7**, **R17** |
| escribir o dejar correr una transformación automática (codemod, migrador, sustitución masiva) | **R10–R12** |
| censar, contar o buscar algo para decidir con ese número | **R8**, **R9** |
| cambiar el formato de un índice o de una línea base | **R16** |
| arreglar un defecto y demostrar que está arreglado | **R5**, **R6**, **R17** |
| averiguar por qué un defecto pasó entre los gates | **R2–R4**, **R11**, **R12**, **R13** |

Y la puerta de entrada de todas: **ningún gate se sustituye por inspección visual**, y **ningún gate se
declara por un «debería pasar»**: se declara con su salida.

---

## A. Un gate que existe de verdad

### R1 · Una regla sin gate es un deseo.

**Caso.** Reglas de proceso escritas en el manual que **nadie ejecutaba**; se comprobó varias veces y en
todos los casos la regla existía como texto y no como comando. Un manual no bloquea un commit; un
comando que sale distinto de cero, sí.

**→ Qué hacer.**
- Toda regla que importe nace **con su gate**: un comando ejecutable, con su ruta, que devuelve código de
  salida.
- Escribe la regla y el gate en el **mismo incremento**. Si el gate todavía no existe, dilo en la propia
  regla («hoy esto es un deseo»), para que se lea como deuda y no como garantía.
- Un gate que no está enganchado en ninguna puerta (CI, hook, script agregado) sigue siendo un deseo:
  comprueba que **alguien lo llama**.

### R2 · Una comprobación cuyo resultado no se obedece no es una comprobación.

**Caso.** Un agente imprimió `git rev-parse --abbrev-ref HEAD` —devolvía `main`— **justo antes de
commitear, y commiteó igual** en `main`. La comprobación se hizo; el resultado se ignoró.

**→ Qué hacer.**
- Comprobar y actuar son **un solo paso**: la comprobación tiene que vivir en el camino que **impide** la
  acción, no en un registro que se lee después.
- Si la comprobación la haces a mano, el paso siguiente es **leer la salida y ramificar sobre ella**
  («dice `main` ⇒ creo la rama antes de commitear»), y decirlo.
- Prefiere que la puerta lo haga **imposible** (hook, guard) a que dependa de tu disciplina.

### R3 · Una puerta tiene que comprobar el VALOR, no solo que el texto sea válido.

**Caso.** Una clave de un fichero de CI (`node-version:`) **sin valor** parseaba perfectamente: la clave
existía y valía `null` (medido con un parser YAML 2.x). El commit salió y el pipeline **no fijaba versión
alguna**. El parseo dijo OK; el valor no existía.

**→ Qué hacer.**
- «Parsea» no es «es correcto»: valida el **contenido semántico** —el valor está, es del tipo esperado,
  apunta a algo que existe—.
- La autoprueba del gate debe incluir el caso **clave presente y valor vacío**, que es exactamente el que
  el parseo deja pasar.
- **Ejecuta el valor, no el documento.**

### R4 · Un script que no arranca es un gate que no existe.

**Caso.** Siete scripts tenían el `import` en la línea 1 y el **shebang en la 2** (solo vale como primeros
bytes) ⇒ `SyntaxError` siempre. Tres gates llevaban **meses** sin poder ejecutarse, y el pipeline moría
antes de llamarlos.

**→ Qué hacer.**
- **Ejecuta el script, no lo parsees.** Un gate se declara verde cuando lo has **corrido** y ha salido 0.
- Prueba cada gate al menos una vez en su **forma real de invocación** (mismo directorio, mismo intérprete,
  mismo cargador de configuración).
- Si un flag no existe de verdad —hay scripts que **ignoran** los argumentos y corren la auditoría
  completa—, **no inventes el alias**: sería un gate que pasa por casualidad.

---

## B. La medición

### R5 · La prueba de borde se escribe ANTES y se ve en ROJO.

**Caso.** Dos arreglos del mismo defecto llevan el caso escrito y **fallando con el código viejo** antes de
tocar el código: `2 failed / 50 passed` y `1 failed / 61 passed`. Un test que nunca ha estado en rojo no es
un gate.

**→ Qué hacer.**
- Escribe el caso, córrelo, **guarda la salida en rojo** (`N failed / M passed`) y solo entonces arregla.
- Cubre **los dos signos** del desplazamiento (antes y después), para que algo sea rojo **en cualquier**
  configuración de entorno.
- Un test escrito después del arreglo, que nunca viste fallar, no demuestra nada: no sabes si mide el
  defecto.

### R6 · Si no se mide, no se adopta.

**Caso.** Una optimización adoptada sin medición hubo que **revertirla**, y solo se re-adoptó al construir
la configuración que permitía medirla. Una cifra sin el comando al lado es una opinión.

**→ Qué hacer.**
- Todo incremento entrega **antes y después**, con el comando que produjo cada número.
- El número va **con su comando pegado**, no como adjetivo («más rápido», «menos deuda», «más seguro»).
- Si el beneficio no se puede demostrar, **se revierte**.

### R7 · Un entorno que nadie prueba es un gate que no existe.

**Caso.** Un caso de prueba pasaba por el **estado acumulado de la máquina de desarrollo** (datos que un
script había dejado) y caía en un entorno limpio; otro dependía de credenciales que solo existían en un
fichero **no versionado**. El verde no era del entorno real.

**→ Qué hacer.**
- Pregunta siempre: ¿este gate ha corrido **alguna vez** en el entorno donde tiene que proteger (limpio,
  contenedor, CI, otra zona horaria, otro sistema operativo)?
- **Declara lo que no mediste**: flakes, datos ausentes, diferencias de entorno, y decisiones de otros que
  no controlas. Taparlo convierte el verde en una mentira útil.
- Un caso debe **crear lo que mide**, no depender de lo que otro dejó en la máquina.

---

## C. El instrumento y su alcance

### R8 · El instrumento que mide y el instrumento que actúa tienen que tener el mismo alcance.

**Caso.** Un censo hecho con una herramienta **orientada a líneas** contra un ejecutor que **cruza
líneas** ⇒ el censo daba **17** donde había **18**, y **todas** las cifras anteriores eran **cotas
inferiores**. La métrica no era baja: medía otro conjunto.

**→ Qué hacer.**
- Si mides con búsqueda de texto/regex y actúas con un AST (o al revés), **el censo es una cota inferior**,
  no la verdad.
- Que el **mismo motor** haga el censo y la transformación; si no, valida el censo contra el motor que
  actúa **antes** de decidir con él.
- **Una métrica en 0 solo vale si el detector está probado contra los casos difíciles** (multilínea,
  anidado, forma irregular).

### R9 · Un filtro que no casa no dice «no hay nada», dice «no sé».

**Caso.** Un filtro con las comillas escapadas devolvió **0** procesos y estuvo a punto de dar por
terminado un push que **seguía corriendo**. El cero no era un dato: era el filtro.

**→ Qué hacer.**
- Antes de creerte un cero, **demuestra que el filtro puede encontrar algo**: pásale un caso positivo
  conocido, o quita el filtro y comprueba que el conjunto no está vacío por otra razón.
- Trata el cero como **«no sé»** y confírmalo por una vía independiente.
- Hermana de R8: un cero sin detector probado es un artefacto de medición.

### R10 · Una herramienta que no encuentra lo que busca debe gritar, no callar.

**Caso.** Un transformador que no encontraba la forma esperada decidía «no hacía falta» **y no hacía
nada**, en silencio ⇒ dejó **tres ficheros** llamando a una función **sin importarla**. Lo cazó el
compilador, no la herramienta.

**→ Qué hacer.**
- Toda rama «no encontrado» / «forma inesperada» **avisa y cuenta**: `⚠️ NINGÚN SITIO SUSTITUIDO: ¿forma
  distinta? REVISAR`.
- Distingue «no había nada que hacer» de «no supe hacerlo»: son salidas **distintas**, y la segunda tiene
  que ser **ruidosa**.
- Un transformador que no sustituye nada y sale 0 es un gate en **falso verde**.

### R11 · Una herramienta puede hacer bien su tarea sobre el conjunto equivocado, y ningún gate lo verá.

**Caso.** Un migrador automático no distinguía lotes y habría cambiado la semántica de sitios que estaban
**excluidos a propósito** — **con el typecheck en verde**. Hizo bien su trabajo; su trabajo no era ese.

**→ Qué hacer.**
- Antes de dejarla correr, **verifica el alcance**: qué conjunto toca, qué conjunto debería tocar, y qué
  queda fuera a propósito.
- Escribe la lista de exclusiones y compruébala **contra la herramienta** (que no las toque), no contra tu
  intención.
- Un gate verde sobre el conjunto equivocado es **indistinguible** de uno verde sobre el correcto: la
  diferencia solo se ve mirando el alcance **antes**.

---

## D. Verificación por unidad de trabajo

### R12 · El compilador (typecheck) por unidad de trabajo, no solo al final.

**Caso.** El linter daba **0** y el ratchet bajaba correctamente mientras **tres ficheros no compilaban**.
Un nombre que no existe y un valor de otra clase **solo** los ve el compilador.

**→ Qué hacer.**
- Corre el `typecheck` **por unidad de trabajo** (por fichero tocado o por commit), no solo al final de la
  tanda. Medido: ~40 s más por commit a cambio de que ningún commit quede con un nombre que no existe.
- No aceptes «el linter está verde» como sustituto: una regla de identificadores indefinidos no cubre un
  error de **tipos**, y una cuenta (un ratchet) no cambia porque falte un `import`.
- Aplica a **cualquier** cambio, no solo a migraciones.

### R13 · El `!` (o el `as`/el cast) no es una promesa, es una cortina.

**Caso.** Una aserción ocultaba que un argumento podía ser un **instante** donde el contrato dice **día**, y
que otro podía ser **`undefined`**. El operador no comprueba nada: solo deja de mirar.

**→ Qué hacer.**
- Cada `!`, `as`, cast o `unwrap()` es **deuda con nombre**: o lo sustituyes por una comprobación real
  (guard, valor por defecto, un tipo que ya excluya el caso), o queda como deuda **congelada y contada**.
- **Congelar no es pagar**: si la cifra queda congelada, el gate tiene que fallar cuando **suba**.
- La regla viaja entre lenguajes sin cambiar: `!` / `as` (TypeScript), `unwrap()` / `expect()` (Rust),
  `cast()` / `# type: ignore` (Python), la aserción de tipo (Go), `as` / `!!` (Kotlin). Cambia el nombre;
  la cortina es la misma.

### R17 · El delta por unidad, no por total.

**Caso.** Un total puede **bajar** mientras una unidad se queda **sin hacer**: una sustitución por texto
habría dejado cuatro sitios sin migrar **y el contador habría bajado igual**, porque la cifra global la
mueven los demás.

**→ Qué hacer.**
- **Aísla la medición de cada commit**: aparta lo demás (por ejemplo `git stash push -- <fichero>`) para
  que el commit lleve **su** delta y no el de la tanda.
- El delta por commit lo da **el instrumento**, no la aritmética de quien migra.
- Que el informe sea **por fichero o por unidad**: un total agregado tapa la unidad que se quedó atrás.

---

## E. Gates que no se pueden burlar

### R14 · Un gate que se puede apuntar a otro sitio es un gate que se puede burlar.

**Caso.** Un modo «solo este fichero» salía **0 en silencio** anunciando incluso una mejora, con lo que el
ratchet quedaba **degradado a decoración**.

**→ Qué hacer.**
- El gate resuelve su **raíz** y su **línea base** por la ubicación del **propio script**
  (`repoRoot = dirname(script)/..`), nunca por el directorio actual, por una variable de entorno ni por un
  argumento.
- Si un modo de informe **no evalúa nada**, que lo diga y **no imprima un veredicto**.
- Todo parámetro que permita mirar a otro sitio es una puerta trasera: o no existe, o el gate declara en su
  salida que no está evaluando.

### R15 · Un gate cuyo baseline vive junto al script se puede probar en rojo fuera del árbol.

**Caso.** Un gate y sus declaraciones se copiaron a un directorio temporal en **tres** copias del árbol,
cada una con **una** rotura distinta ⇒ las tres con salida distinta de cero. Se probó el rojo **sin tocar
el repositorio** que se estaba verificando.

**→ Qué hacer.**
- Guarda la línea base **al lado del script**, no en la raíz del proyecto: así el gate es una **unidad**
  que se puede copiar a un árbol de pruebas.
- Prueba el rojo en una **copia fuera del árbol real**: un gate que solo se puede probar rompiendo el
  repositorio **no se prueba**.
- Incluye el árbol de pruebas en la autoprueba del gate cuando puedas.

---

## F. Líneas base e índices

### R16 · Al cambiar el formato de un índice: quitar la sonda → congelar el formato → sondear → quitar la sonda. Y `--check` y actualizar la línea base son DOS pasos.

**Caso.** Regenerar la línea base **con la sonda dentro del árbol** hizo que el índice viejo no casara con
las claves nuevas y **TODO** apareciera como nuevo: un rojo intermedio de **1586** cuando la aserción de
verdad era **una** (el mismo error dio **230** en otro gate). Y un commit que corrió `--check` y **se
olvidó** actualizar la base dejó la cifra congelada donde ya no era la real (**1524** con la cuenta en
**1521**): el gate **no falló**, y la deuda dejó de estar congelada.

**→ Qué hacer.**
- Orden estricto: **quitar la sonda → congelar el formato → sondear → quitar la sonda**.
- **`--check` y actualizar la línea base son DOS pasos**, y el segundo es el que deja el commit
  reproducible. Sin él, el delta **se pierde aunque el commit lo anuncie**.
- Que el informe liste también lo que **desaparece**, no solo lo nuevo: un informe que solo habla cuando
  empeora obliga a creerse la resta.
- Índice por **contenido normalizado**, no por `fichero:línea`: las líneas se mueven y todo parece nuevo.

---

## Checklist mínimo antes de dar una verificación por buena

- [ ] ¿La regla tiene **comando**, y ese comando se ha **ejecutado**? (R1, R4)
- [ ] ¿La puerta comprueba el **valor**, no solo la forma? (R3)
- [ ] ¿He **obedecido** lo que devolvió la comprobación —rama, entorno, alcance—? (R2)
- [ ] ¿Existe el caso de borde y lo he visto **en rojo** antes del arreglo? (R5)
- [ ] ¿Hay **antes y después**, cada número con el comando que lo produjo? (R6)
- [ ] ¿El gate ha corrido en el **entorno real**, y he **declarado** lo que no medí? (R7)
- [ ] ¿El instrumento que mide y el que actúa tienen el **mismo alcance**? (R8, R11)
- [ ] ¿He comprobado que mis **filtros pueden** encontrar algo? (R9)
- [ ] ¿La herramienta **grita** cuando no encuentra lo que busca? (R10)
- [ ] ¿El **compilador** está verde **por unidad de trabajo**? (R12)
- [ ] ¿Las aserciones y casts nuevos están contados, o sustituidos por comprobaciones reales? (R13)
- [ ] ¿El gate resuelve su raíz por el **repositorio** y su línea base vive **junto al script**? (R14, R15)
- [ ] Si cambió el formato del índice, ¿he hecho los **cuatro pasos** y los **dos** de la línea base? (R16)
- [ ] ¿El delta declarado es **por unidad**, medido **por el instrumento**? (R17)

## La verdad cómoda y lo que dice la regla

| La frase que se dice | Lo que hay detrás | Regla |
|---|---|---|
| «La regla está escrita en el manual» | nadie la ejecuta | R1 |
| «Ya lo comprobé» | y no se obedeció | R2 |
| «El fichero parsea» | el valor no existe | R3 |
| «El script está en el repo» | nunca ha arrancado | R4 |
| «El test pasa» | nunca estuvo en rojo | R5 |
| «Debería mejorar» | no hay medición | R6 |
| «En mi máquina pasa» | ese no es el entorno del gate | R7 |
| «El censo da 17» | el instrumento no ve como el ejecutor | R8 |
| «El filtro devuelve 0» | el filtro no casa | R9 |
| «No había nada que cambiar» | la herramienta no supo y calló | R10 |
| «El gate está verde» | sobre el conjunto equivocado | R11 |
| «El linter está verde» | tres ficheros no compilan | R12 |
| «El tipo lo garantiza» | hay una cortina encima | R13 |
| «Puedes apuntarlo al fichero que quieras» | el gate se puede burlar | R14 |
| «Lo probaré con cuidado» | no se puede probar en rojo | R15 |
| «Regeneré la línea base» | faltó el segundo paso | R16 |
| «El total bajó» | una unidad se quedó sin hacer | R17 |

---

## References

- **Las 17 reglas completas, con su caso, su medición y su traducción a un gate**:
  `references/reglas-y-casos.md`.
- **Checklist operativa y plantilla de gate nuevo**: `references/checklist-de-verificacion.md`.
