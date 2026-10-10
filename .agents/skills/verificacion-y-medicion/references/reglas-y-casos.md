# Las reglas completas, con su caso y su medición

> Detalle de las 17 reglas de `SKILL.md`. Nada de aquí depende de un lenguaje, un framework ni una
> herramienta concreta: los casos vienen **generalizados**, con las cifras literales que se midieron.
>
> **Cómo leer cada regla.** Primero la frase (lo que hay que recordar), luego el **caso** que la originó
> (lo que la hace comprobable), luego **cómo se traduce en un gate** (lo que se escribe) y por último **cómo
> se ve cuando se incumple** (el síntoma, para reconocerlo en caliente).

---

## R1 · Una regla sin gate es un deseo

**Caso.** Reglas de proceso escritas en el manual del repositorio que **nadie ejecutaba**. Se comprobó
varias veces, en incrementos distintos, y el patrón era siempre el mismo: la regla existía como texto
—incluso como texto **medido**— y no existía como comando. La regla se citaba en las revisiones y se
incumplía en los commits.

**Medición.** En el caso de una familia de reglas de proceso, la comprobación fue directa: **ninguna** tenía
comando asociado en el pipeline, el hook ni el script agregado.

**Por qué es una regla y no un consejo.** Un manual no bloquea nada. Un comando que sale distinto de cero,
sí. La diferencia entre una regla y un deseo es **exactamente** la existencia de un código de salida.

**Cómo se traduce en un gate.**
- La regla se escribe **con** su comando, su ruta y su condición de rojo.
- El gate se engancha en **al menos una** puerta real: pipeline, hook, o un script agregado que sí se
  ejecuta.
- Si todavía no hay gate, la regla lo declara en su propio texto («hoy es un deseo»), para que nadie la lea
  como una garantía.

**Cómo se ve cuando se incumple.** La frase «ya está escrito en el manual» aparece en una revisión, y
nadie puede pegar la salida de un comando.

---

## R2 · Una comprobación cuyo resultado no se obedece no es una comprobación

**Caso.** Un agente ejecutó `git rev-parse --abbrev-ref HEAD` —que devolvió `main`— **inmediatamente antes
de commitear**, y **commiteó igual** en `main`. La comprobación se hizo. El resultado se imprimió. No se
obedeció.

**Medición.** La salida del comando (`main`) y el commit resultante sobre `main`: los dos hechos, del mismo
minuto.

**Por qué es una regla y no un consejo.** «Comprobar la rama antes de commitear» es una regla que **se
cumplió** en ese caso y aun así falló. Lo que falla no es la comprobación, es que la comprobación esté
**fuera del camino** de la acción.

**Cómo se traduce en un gate.**
- La comprobación vive **en el camino que impide la acción** (hook, guard, wrapper), no en un log.
- Si es manual, se convierte en una bifurcación explícita: se **lee** la salida, se **dice** lo que dice y
  se **actúa** en consecuencia.
- La regla operativa es: *comprobar y actuar son un solo paso*.

**Cómo se ve cuando se incumple.** La salida del comando está en la transcripción, es la que no debía ser,
y la acción se ejecutó de todos modos.

---

## R3 · Una puerta tiene que comprobar el VALOR, no solo que el texto sea válido

**Caso.** Al alinear dos ficheros de CI, una sustitución dejó `node-version:` **sin valor** en dos bloques.
El commit salió. El YAML **parseaba** perfectamente, así que todas las comprobaciones de forma dijeron OK, y
el pipeline **no fijaba versión alguna**.

**Medición.** Con un parser YAML 2.9.0: la clave **existe** y vale `null`. Es decir: el documento es válido
y el valor no está. El arreglo se hizo cuatro minutos después, y el commit roto quedó **solo como objeto
colgante** (nunca empujado).

**Por qué es una regla y no un consejo.** Todo el mundo acepta «valida tu configuración» como si validar
fuera parsear. El caso demuestra que un documento válido puede no fijar nada: la forma y el valor son dos
comprobaciones distintas.

**Cómo se traduce en un gate.**
- La puerta comprueba el **contenido semántico**: la clave tiene valor, el valor es del tipo esperado, y si
  apunta a un fichero, **ese fichero existe**.
- La autoprueba incluye el caso **clave presente con valor vacío** (y el caso **clave ausente**), que son los
  que el parseo deja pasar.
- Lema operativo: **ejecuta el valor, no el documento.** Si puedes *ejecutar* la consecuencia del valor
  —lanzar el intérprete que el fichero fija—, eso vale más que leerlo.

**Cómo se ve cuando se incumple.** «El fichero es válido» se ofrece como prueba de que el fichero hace lo
que dice.

---

## R4 · Un script que no arranca es un gate que no existe

**Caso.** Siete scripts tenían el `import` en la **línea 1** y el **shebang en la línea 2**. El intérprete
solo acepta el shebang como **primeros bytes** del fichero, así que los siete lanzaban `SyntaxError`
**siempre**. De ellos, **tres** eran gates de auditoría que llevaban **meses** sin poder ejecutarse, y el
pipeline moría **antes** de llamarlos.

**Medición.** Los siete con `SyntaxError` reproducible; los tres gates, sin una sola ejecución correcta
desde que nacieron.

**Por qué es una regla y no un consejo.** Un script que existe en el repositorio **parece** un gate. Solo lo
es si arranca. Y un gate que el pipeline nunca llega a llamar porque el pipeline muere antes es,
literalmente, un gate que no existe.

**Cómo se traduce en un gate.**
- **Ejecuta el script, no lo parsees**: verde es «lo corrí y salió 0».
- Prueba cada gate en su **forma real de invocación** (mismo directorio, mismo intérprete, mismo cargador).
- Si un flag declarado no existe de verdad —hay scripts que **ignoran** los argumentos y ejecutan la
  auditoría completa—, **no inventes el alias**: un `--self-test` que en realidad corre todo es un gate que
  pasa por casualidad.
- Un script de verificación se prueba **al menos una vez** después de escribirlo, antes de anunciarlo.

**Cómo se ve cuando se incumple.** El gate aparece en la documentación del pipeline y **nunca** en su
salida.

---

## R5 · La prueba de borde se escribe ANTES y se ve en ROJO

**Caso.** Dos arreglos del mismo tipo de defecto (un desplazamiento de fecha por conversión de zona) llevan
el caso escrito y **fallando con el código viejo** antes de tocar el código de producción.

**Medición.** `2 failed / 50 passed` en el primero, con el entorno por defecto; `1 failed / 61 passed` en el
segundo. Y con el entorno en otra zona horaria, `6 failed / 46 passed` y `3 failed / 59 passed`. Los dos
signos del desplazamiento (antes y después) van puestos para que **algo** sea rojo en cualquier
configuración de entorno.

**Por qué es una regla y no un consejo.** Un test que nunca ha estado en rojo no ha demostrado que mida el
defecto: puede estar midiendo otra cosa, o nada. La prueba de que un test es un gate es **haberlo visto
fallar** por la razón correcta.

**Cómo se traduce en un gate.**
- Escribe el caso, córrelo, **guarda la salida en rojo** (`N failed / M passed`) y solo entonces arregla.
- Cubre los **dos signos**: el caso que falla con el código viejo y el que seguiría pasando (para que no
  puedas «arreglar» invirtiendo el defecto).
- El rojo se guarda **en el informe** del incremento, no solo en la memoria de quien lo hizo.

**Cómo se ve cuando se incumple.** El test se escribió después del arreglo, nadie lo vio fallar, y su
nombre promete más de lo que comprueba.

---

## R6 · Si no se mide, no se adopta

**Caso.** Una optimización se adoptó sin medición y hubo que **revertirla**; solo se re-adoptó cuando se
construyó la configuración que permitía medirla. Sin la medición, la decisión era una preferencia.

**Medición.** El antes y el después, con **el comando que produjo cada número**. El formato del informe es
parte de la regla: un número sin su comando al lado es una opinión.

**Por qué es una regla y no un consejo.** «Mejorar» no tiene significado sin una magnitud y un instrumento.
Y la asimetría importa: adoptar es fácil, revertir cuesta; por eso la carga de la prueba está en el que
adopta.

**Cómo se traduce en un gate.**
- Todo incremento entrega **antes y después** con el comando pegado.
- Si el beneficio no se puede demostrar, **se revierte** — y se escribe por qué.
- Los números que no se midieron se declaran como **no medidos** (ver R7), nunca se estiman en voz alta.

**Cómo se ve cuando se incumple.** Adjetivos comparativos («más rápido», «más limpio», «menos deuda») en
lugar de dos cifras y un comando.

---

## R7 · Un entorno que nadie prueba es un gate que no existe

**Caso.** Un caso de prueba pasaba por el **estado acumulado de la máquina de desarrollo** —datos que un
script auxiliar había dejado en la base— y fallaba en un entorno limpio; otro dependía de credenciales que
solo existían en un fichero **no versionado** y daba error de autenticación solo en el entorno de
integración.

**Medición.** En el primero: en la máquina de desarrollo, verde; en el entorno limpio, «elemento no
encontrado». En el segundo: en local, verde; en integración, **401** y **264** casos que **no llegaron a
ejecutarse**.

**Por qué es una regla y no un consejo.** El verde de un entorno que no es el del gate no dice nada sobre el
gate. Y hay una segunda mitad, igual de importante: **declarar lo que no se midió** (flakes, datos ausentes,
diferencias de zona horaria o de sistema operativo, decisiones de otros) es parte de la verificación, no una
disculpa.

**Cómo se traduce en un gate.**
- Pregunta: ¿este gate ha corrido alguna vez en el entorno donde tiene que proteger (limpio, contenedor,
  CI, otra zona horaria, otro sistema operativo)?
- Un caso **crea lo que mide**; no depende de lo que otro dejó.
- El informe lleva una sección de **límites**: qué no se midió, por qué, y qué haría falta para medirlo.

**Cómo se ve cuando se incumple.** El entorno real descubre el defecto el día del despliegue, y el informe
no lo había declarado como no medido.

---

## R8 · El instrumento que mide y el instrumento que actúa tienen que tener el mismo alcance

**Caso.** Un censo se hizo con una herramienta **orientada a líneas** (búsqueda de texto) y el ejecutor que
actuaba sobre ese censo **cruzaba líneas** (analizaba expresiones repartidas en varias líneas). El censo
**no veía** los casos multilínea.

**Medición.** El censo daba **17** donde había **18**. Y lo grave no es el uno: es que **todas** las cifras
publicadas antes con ese detector eran **cotas inferiores**, no medidas. El mismo patrón se repitió: un
cero con el que se declaró cerrada una familia de defectos resultó ser un artefacto de medición, y el valor
real era **54**.

**Por qué es una regla y no un consejo.** La gente compara números producidos por instrumentos distintos
como si midieran lo mismo. Si el que mide y el que actúa tienen alcances distintos, el número no es
«ligeramente bajo»: es de **otro conjunto**.

**Cómo se traduce en un gate.**
- Que el **mismo motor** haga el censo y la transformación.
- Si no puede ser, valida el censo contra el motor que actúa **antes** de decidir con él, y **declara el
  censo como cota inferior** mientras no esté validado.
- **Una métrica en 0 solo vale si el detector está probado contra los casos difíciles**: multilínea,
  anidado, forma irregular, valor por defecto.

**Cómo se ve cuando se incumple.** El informe dice «0 hallazgos» y el defecto aparece a la semana siguiente
en un sitio que el detector no sabía leer.

---

## R9 · Un filtro que no casa no dice «no hay nada», dice «no sé»

**Caso.** Un filtro —con las comillas escapadas de forma que no casaban con nada— devolvió **0** procesos y
estuvo a punto de dar por terminado un envío que **seguía corriendo**. El cero no era un dato sobre el
sistema: era un dato sobre el filtro.

**Medición.** El mismo filtro, con las comillas correctas, sí encontraba procesos. El cero era del filtro.

**Por qué es una regla y no un consejo.** Un cero es **la** respuesta que más se obedece y la que menos
evidencia trae: cero y «no supe buscar» se imprimen igual. La regla es tratar el cero como **hipótesis**, no
como conclusión.

**Cómo se traduce en un gate.**
- Antes de creerte un cero, **demuestra que el filtro puede encontrar algo**: pásale un caso positivo
  conocido, o quita el filtro y comprueba que el conjunto no está vacío por otra razón.
- El gate incluye una **fijación** (un caso positivo que el filtro debe encontrar) para que no vuelva a
  pasar.
- Si el filtro es la única evidencia, dilo: «no encontré nada **con este filtro**».

**Cómo se ve cuando se incumple.** Alguien declara «no queda nada pendiente» y el proceso sigue vivo.

---

## R10 · Una herramienta que no encuentra lo que busca debe gritar, no callar

**Caso.** Un transformador automático tocaba la declaración de importación solo cuando **no** quedaban
llamadas a la función antigua. En tres ficheros sí quedaba una (protegida por una guarda), así que la
herramienta decidía «no hacía falta»… **y no hacía nada**, en silencio. Resultado: tres ficheros llamando a
una función **sin importarla**.

**Medición.** Lo cazó el **compilador** (`typecheck`), no la herramienta: la herramienta salió en verde. El
agujero se arregló **en la herramienta**: ahora amplía el import o dice `NO SE PUDO AÑADIR (revisar a
mano)`, y cuando no sustituye nada avisa `⚠️ NINGÚN SITIO SUSTITUIDO: ¿forma distinta? REVISAR`.

**Por qué es una regla y no un consejo.** «No encontré el patrón» y «no había nada que hacer» son
conclusiones **distintas**, y una herramienta que las imprime igual convierte su ignorancia en una decisión
de diseño.

**Cómo se traduce en un gate.**
- Toda rama «no encontrado» / «forma inesperada» **avisa y cuenta** cuántos sitios no pudo procesar.
- Distingue explícitamente los dos casos en la salida, y haz **ruidosa** la segunda.
- Un transformador que no sustituye nada y sale 0 es un **falso verde**: que su salida lo diga.

**Cómo se ve cuando se incumple.** La herramienta no dice nada, el diff es más pequeño de lo esperado, y el
defecto lo encuentra otro gate (o el usuario).

---

## R11 · Una herramienta puede hacer bien su tarea sobre el conjunto equivocado, y ningún gate lo verá

**Caso.** Un migrador automático **no distinguía lotes** y habría cambiado la semántica de sitios que
estaban **excluidos a propósito** — **con el typecheck en verde**. Hizo bien su trabajo; su trabajo no era
ese.

**Medición.** El `typecheck` estaba verde y el ratchet de conteo **bajaba correctamente**: ninguno de los
dos podía ver el problema, porque los dos miraban el conjunto **declarado**, no el conjunto **correcto**.

**Por qué es una regla y no un consejo.** Un gate comprueba **dentro** de su alcance. Si el alcance es el
equivocado, el verde es indistinguible del verde correcto: la diferencia solo se ve **antes**, mirando lo que
la herramienta va a tocar.

**Cómo se traduce en un gate.**
- Antes de dejarla correr: **qué conjunto toca, qué conjunto debería tocar, qué queda fuera a propósito**.
- La lista de exclusiones se comprueba **contra la herramienta** (que no las toque), no contra la intención
  de quien la escribió.
- Los registros de «columnas vigiladas» / «ficheros cubiertos» crecen con el conjunto: si el registro está
  incompleto, el gate publica un cero **sobre lo declarado**, no sobre la realidad.

**Cómo se ve cuando se incumple.** El diff es verde y toca sitios que no debía; o el gate publica 0 sobre un
registro que no incluye lo que había que vigilar.

---

## R12 · El compilador (typecheck) por unidad de trabajo, no solo al final

**Caso.** El linter daba **0** y el ratchet de conteo **bajaba correctamente** mientras **tres ficheros no
compilaban**. El linter no lo veía porque una regla de «identificador no definido» **no cubre** un error de
tipos; el ratchet no lo veía porque un `import` que falta no cambia el número que cuenta.

**Medición.** linter **0** · ratchet **bajando** · **tres** ficheros sin compilar. Solo lo vio el
`typecheck`. Corrección adoptada: `typecheck` **por fichero / por commit**, con un coste medido de **~40 s
más por commit** a cambio de que ningún commit quede con un nombre que no existe.

**Por qué es una regla y no un consejo.** El compilador es el **único** instrumento que ve un nombre que no
existe o un valor de otra clase. Ejecutarlo solo al final de la tanda deja commits intermedios que no
compilan — y esos commits son los que luego se bisecan.

**Cómo se traduce en un gate.**
- `typecheck` **por unidad de trabajo**, además del gate global de la tanda.
- No aceptes «el linter está verde» como sustituto, ni un ratchet de conteo como prueba de corrección.
- Aplica a **cualquier** cambio, no solo a migraciones: un `import` que falta es un cambio como otro
  cualquiera.

**Cómo se ve cuando se incumple.** El commit intermedio no compila y el verde del final lo tapa.

---

## R13 · El `!` (o el `as`/el cast) no es una promesa, es una cortina

**Caso.** Una aserción ocultaba que un argumento podía ser un **instante** donde el contrato dice **día**, y
que otro podía ser **`undefined`**. El operador no comprueba nada: **deja de mirar**.

**Medición.** Los dos casos eran reales y estaban **detrás** de la aserción: el tipo declarado no
correspondía al valor que llegaba en ejecución. Y un inventario de esas aserciones en un proyecto mediano
daba **1601** (`expresión!` 956 + `x!: T` 645), lo que da la escala del problema: no es un detalle de
estilo.

**Por qué es una regla y no un consejo.** «El tipo lo garantiza» es cierto **salvo** donde hay una
aserción, y la aserción es precisamente el sitio donde el compilador ya no mira. La deuda no se ve en el
tipo; se ve en el inventario.

**Cómo se traduce en un gate.**
- Cada `!`, `as`, cast o `unwrap()` es **deuda con nombre**: o se sustituye por una comprobación real
  (guarda, valor por defecto, un tipo que ya excluya el caso), o queda **congelada y contada**.
- **Congelar no es pagar**: el gate falla si la cifra **sube** (visto en rojo: 1601 → 1602, salida distinta
  de cero).
- La regla viaja entre lenguajes sin cambiar: `!` / `as` (TypeScript), `unwrap()` / `expect()` (Rust),
  `cast()` / `# type: ignore` (Python), la aserción de tipo (Go), `as` / `!!` (Kotlin). Cambia el nombre; la
  cortina es la misma.

**Cómo se ve cuando se incumple.** Un valor `undefined` o de otra clase llega al runtime por un camino que
el tipo declaraba imposible.

---

## R14 · Un gate que se puede apuntar a otro sitio es un gate que se puede burlar

**Caso.** Un modo «solo este fichero» salía **0 en silencio** y llegaba a anunciar una **mejora** («687 →
32») mientras **no evaluaba nada**: el ratchet quedaba **degradado a decoración**. Peor: el mensaje
tranquilizaba.

**Medición.** El mismo comando sin el modo de fichero volvía a evaluar; con el modo, salida 0 y un mensaje
de mejora falso. El arreglo: ese modo declara que es un **informe de fichero** y **no evalúa**.

**Por qué es una regla y no un consejo.** Un gate cuya raíz o cuya línea base se puede redirigir desde
fuera no está verificando el repositorio: está verificando lo que le digan. Y como la salida es verde, nadie
lo nota.

**Cómo se traduce en un gate.**
- La **raíz** y la **línea base** se resuelven por la **ubicación del propio script**
  (`repoRoot = dirname(script)/..`; `BASELINE = join(dirname(script), …)`).
- Nunca por el directorio actual, ni por una variable de entorno, ni por un argumento.
- Un modo que no evalúa **lo dice** y **no imprime veredicto**.

**Cómo se ve cuando se incumple.** El pipeline está verde y el gate lleva semanas mirando a otro sitio.

---

## R15 · Un gate cuyo baseline vive junto al script se puede probar en rojo fuera del árbol

**Caso.** Un gate y su fichero de declaraciones se copiaron a un directorio temporal en **tres** copias del
árbol, cada una con **una** rotura distinta: un valor vacío, un ajuste movido de un sitio a otro, un
disparador quitado. **Las tres** salieron con código distinto de cero, y el árbol real **no se tocó**.

**Medición.** 3 copias · 3 roturas · 3 rojos, sin modificar el repositorio que se estaba verificando.

**Por qué es una regla y no un consejo.** Un gate que solo se puede probar rompiendo el repositorio de
verdad **no se prueba**: y si nunca se prueba, no se sabe si falla cuando debe (es hermana de R5: la prueba
en rojo).

**Cómo se traduce en un gate.**
- Línea base **junto al script**, para que script + baseline sean una **unidad copiable**.
- Prueba del rojo en una **copia fuera del árbol real**.
- Cuando se pueda, el árbol de pruebas forma parte de la autoprueba del gate.

**Cómo se ve cuando se incumple.** El gate solo se ha visto verde, nunca rojo, y nadie sabe si su rojo
funciona.

---

## R16 · Al cambiar el formato de un índice: quitar la sonda → congelar el formato → sondear → quitar la sonda. Y `--check` y actualizar la línea base son DOS pasos

**Caso (a), el orden.** Regenerar la línea base **con la sonda dentro del árbol** hizo que el índice viejo
(`fichero:línea`) no casara con las claves nuevas y **TODO** apareciera como nuevo.

**Medición (a).** Un rojo intermedio de **1586** cuando la aserción de verdad era **una**; el mismo error
dio **230** en otro gate. El arreglo lleva **dos** mitades: índice por **contenido** (`fichero::fragmento
normalizado`) **y** listar también lo que **desaparece** al bajar (hasta 40), porque un informe que solo
habla cuando empeora obliga a creerse la resta. La cuenta **no se movió**: 1585 = 1585 y 229 = 229.

**Caso (b), los dos pasos.** Un commit corrió `--check` y **se olvidó** actualizar la base: la base quedó en
**1524** con la cuenta real en **1521**. El gate **no falló** (bajar da verde) y la deuda dejó de estar
congelada en su cifra; hubo que congelarla en un commit aparte, **1524 → 1521, sin tocar una línea de
código**.

**Por qué es una regla y no un consejo.** Migrar el **formato** de un índice y mover su **cifra** son dos
operaciones que se estorban: si la sonda está dentro mientras congelas, el ruido del cambio de formato se
cuenta como hallazgos nuevos, y si solo corres `--check`, el delta se pierde **aunque el commit lo anuncie**.

**Cómo se traduce en un gate.**
- Orden estricto: **quitar la sonda → congelar el formato → sondear → quitar la sonda**.
- `--check` **y** actualizar la línea base: **dos pasos**, y el segundo deja el commit reproducible.
- Índice por **contenido normalizado**, no por posición.
- El informe lista lo nuevo **y** lo desaparecido.
- Límite declarado del índice por contenido: dos hallazgos idénticos en el mismo fichero comparten clave
  (inocuo para la **cuenta**, que es lo que bloquea; afecta solo a la lista de sitios).

**Cómo se ve cuando se incumple.** Todo aparece como nuevo, o la cifra congelada ya no es la real y el gate
lo tolera porque bajar da verde.

---

## R17 · El delta por unidad, no por total

**Caso.** Un total puede **bajar** mientras una unidad se queda **sin hacer**. Una sustitución por texto
—guiada por el nombre de una variable— habría dejado **cuatro** sitios sin migrar **y el contador habría
bajado igual**, porque la cifra global la mueven los demás ficheros. En ese mismo trabajo, el patrón se
repitió: un fichero con **7** apariciones en el censo tenía **15** llamadas reales; otros, **7** frente a
**24** y **5** frente a **6**.

**Medición.** El contador global bajaba correctamente y la unidad quedaba intacta. Y el censo **por
aparición** no era el **mapa del fichero**.

**Por qué es una regla y no un consejo.** Los totales agregados esconden exactamente lo que hay que
vigilar: la unidad que se quedó atrás. Un total que baja se lee como éxito, y la unidad sin hacer no
aparece en ningún sitio.

**Cómo se traduce en un gate.**
- **Aísla la medición de cada commit**: aparta lo demás (por ejemplo `git stash push -- <fichero>`) para
  que el commit lleve **su** delta y no el de la tanda.
- El delta **por commit lo da el instrumento**, no la aritmética de quien migra.
- El informe es **por fichero / por unidad**; el total va como resumen, nunca como prueba.
- Y cuando la migración toca varios ficheros con **un commit por fichero**, cada commit se mide con los
  demás apartados.

**Cómo se ve cuando se incumple.** El resumen dice «bajó» y hay un fichero que sigue con el patrón viejo.

---

## Cómo se escribe una regla que sobrevive

1. **Frase corta y memorable**, en imperativo o en aforismo. Si no se puede repetir de memoria, no se
   recordará en la prisa.
2. **El caso medido, pegado debajo**: qué pasó, con las cifras y el comando. El caso es la prueba de que la
   regla no es una opinión de estilo.
3. **La traducción a gate**: qué se escribe, dónde se engancha, y cómo se ve el rojo.
4. **El síntoma de incumplimiento**: cómo se reconoce en caliente, para no depender de recordar la regla.
5. **Nada de stack.** Si la regla necesita el nombre de un framework para entenderse, probablemente es una
   convención de ese repositorio, no una regla de verificación.
