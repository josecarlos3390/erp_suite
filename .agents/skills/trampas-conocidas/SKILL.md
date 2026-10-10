---
name: trampas-conocidas
description: Catálogo de clases de defecto que aparecen en cualquier sistema con datos, dinero y usuarios, y que comparten una propiedad — no gritan. Se invoca al triar un síntoma intermitente o «imposible» («en mi entorno funciona», «el contador bajó», «el validador lo aceptó», «da lo mismo, son céntimos»); al escribir validación de fechas, zonas horarias, dinero o aislamiento por inquilino; al diseñar pruebas, dobles de prueba y gates; y al revisar un cambio buscando qué clase de defecto puede quedar escondido. Cada clase lleva su trampa en una frase, el caso medido que la originó, el síntoma que la esconde y la prevención (regla, gate o tipo). Portable entre lenguajes y proyectos — no depende de stack, framework ni dominio. Use when triaging an intermittent defect, when writing validation of dates, time zones, money or tenant isolation, and when designing tests, mocks, gates or a code review.
---

# Trampas conocidas — clases de defecto que no gritan

> **Esta skill no es de ningún proyecto.** No depende del lenguaje, del framework ni del dominio: son
> **clases de defecto** que reaparecen en cualquier sistema que maneje **datos, dinero y usuarios**. Se
> puede copiar tal cual a otro repositorio, en otro lenguaje, sin cambiar una palabra. Si una trampa solo
> tiene sentido en un repositorio concreto, **no va aquí**: va al manual de ese repositorio.
>
> **Por qué cada trampa lleva su caso pegado.** Una advertencia sin el caso que la originó es un consejo, y
> un consejo no sobrevive a la siguiente prisa. El caso medido es lo que la hace comprobable y lo que
> impide que alguien la «simplifique» dentro de un mes.
>
> **La propiedad que las une, y por la que existen como catálogo:** no gritan. Un cero, un verde y un
> silencio **se leen igual**. Nadie investiga lo que parece correcto, así que estas trampas no se cazan
> prestando atención: se cazan **midiendo por pieza** y haciendo **ruidosa** la pieza que no se puede medir.
> Esa conclusión está desarrollada al final, y es la sección que hay que leer si solo se lee una.

## Cuándo se invoca

| Si estás… | Ve a |
|---|---|
| Triando un síntoma intermitente o «imposible» | **la tabla final**, y luego la clase que case |
| Escribiendo o revisando **fechas, horas y zonas** | **T1–T3** |
| Escribiendo o revisando **validación y contratos de tipo** | **T4–T7** |
| Escribiendo o revisando **acceso a datos con inquilino** | **T8** |
| Escribiendo o revisando **pruebas, dobles de prueba y credenciales** | **T11–T13** |
| Escribiendo o revisando **gates, contadores y censos** | **T9, T10, T15** |
| Tocando **dinero**: importes, redondeos, serialización | **T14** |
| Revisando un cambio antes de commitear | **la checklist de `references/`** |

Y la regla de uso: **no se busca «el bug» leyendo código; se pregunta qué clase de defecto puede estar
escondido aquí y qué medición lo haría visible.**

---

## A. El tiempo

### T1 · El día de calendario contra el instante.

**La trampa.** Una columna de **día** (una fecha sin hora) se compara contra un **instante** (una fecha con
hora), o al revés; el desplazamiento de una zona mueve la comparación un **día entero**.

**El caso medido.** Un filtro de ofertas daba mal en **3 de 20** combinaciones de datos y zonas, y las tres
**solo coincidían cuando el proceso corría en UTC**. Síntoma con el que llegó: «funciona en el entorno de
desarrollo y falla en otros».

**Por qué no se ve.** En el entorno del autor las dos zonas coinciden por casualidad, así que el resultado
es correcto **y lo será siempre mientras nadie cambie la zona del proceso**. No hay excepción, no hay log,
no hay valor raro: hay un día de más o de menos, que es un valor perfectamente plausible.

**→ La prevención.** Que el **tipo** distinga día de instante (`LocalDate` frente a `Instant`, un tipo
`Day` frente a `Date`), con **una sola frontera** de conversión entre los dos. Y un caso de prueba que corra
con **dos zonas de proceso distintas**: si el resultado cambia, la comparación está mal.

### T2 · La zona del proceso en vez de la del negocio.

**La trampa.** El «hoy» se calcula con el reloj o la zona del **servidor** o del test, no con la del
**inquilino** o empresa configurada.

**El caso medido.** Entre las **20:00 y las 24:00 locales**, el «hoy» del sistema era **el día siguiente**;
un caso que tomaba el «hoy» del reloj de la máquina rechazaba sus documentos como «futuros» en cuanto el
proceso corría en **UTC**.

**Por qué no se ve.** Durante casi todo el día las dos fechas coinciden; el defecto vive en una **franja
horaria** que cae fuera del horario en que se prueba, y cuando aparece se atribuye a los datos («¿por qué
me rechaza esto como futuro?») y no al reloj.

**→ La prevención.** Un **único proveedor de «hoy»** que recibe la zona del inquilino; el reloj directo
(`now()`, `new Date()`, la hora del sistema) **prohibido fuera de ese proveedor**, con un gate que cuente
los usos. Los casos de prueba declaran su zona, y la franja de borde (23:xx local) tiene su caso.

### T3 · La conversión de zona a mano.

**La trampa.** Convertir a texto y cortar (`toISOString().slice(0,10)` y equivalentes): el **mismo valor**
se lee distinto en cada máquina, porque la conversión a texto pasa por la zona del proceso.

**El caso medido.** **23 sitios** en las pruebas, cada uno con la misma forma.

**Por qué no se ve.** Cada sitio es correcto **casi siempre**: solo falla en las horas de borde, y no hay
un punto único que pueda gritar. Se ve como intermitencia, no como una regla mal escrita 23 veces.

**→ La prevención.** **Una** función de frontera, y un gate que busque el patrón en **todo** el árbol
—incluidas las pruebas, que es donde más vive— con la cuenta congelada y que falle si **sube**.

---

## B. El tipo, el contrato y el valor por defecto

### T4 · La validación de FORMA en vez de VALOR.

**La trampa.** Un validador de **formato** acepta lo que el **valor** no admite: `'2026-02-30'` cumple el
patrón de fecha ISO, pasa la validación, y revienta —o se vuelve nulo— dos capas más abajo.

**El caso medido.** Un fallo de servidor o un **`null` silencioso**, según el camino: el conversor devolvía
`null` y la aserción que venía detrás no lo detenía.

**Por qué no se ve.** La validación **dice OK** y el error aparece lejos de la frontera, con otra forma:
una ausencia de valor no es una excepción, así que el sistema sigue con `null` por dentro.

**→ La prevención.** El tipo debe hacer **imposible** el valor inválido: parsear en la **frontera** y
devolver un fallo explícito o un valor por defecto **declarado**, nunca dejar pasar la cadena. Y el caso de
borde (`'2026-02-30'`, el 31 de un mes de 30, el 29 de febrero no bisiesto) va **en la autoprueba del
validador**, no en la imaginación de quien lo escribe.

### T5 · La cortina del cast.

**La trampa.** `!`, `as`, un `cast`, un `unwrap()`: **no cambian el valor, afirman**. El operador no
comprueba nada; solo deja de mirar.

**El caso medido.** Una aserción ocultaba que un argumento podía ser un **instante** donde el contrato dice
**día**; otra, que podía ser **`undefined`**. Los dos valores llegaban hasta la comparación.

**Por qué no se ve.** **Compila**, pasa el lint, y el valor incorrecto viaja hasta que alguien lo compara o
lo persiste. La aserción es la única línea del programa que dice «aquí no hay nada que ver», y se lee como
una garantía.

**→ La prevención.** Cada aserción es **deuda con nombre**: o se sustituye por una comprobación real (una
guarda, un valor por defecto, un tipo que ya excluya el caso), o queda **contada y congelada**, y el gate
falla si la cifra **sube**. *Congelar no es pagar.*

### T6 · El argumento con default silencioso.

**La trampa.** Una función con un valor por defecto (`cantidad = 1`) y llamadores que **no pasan** el
argumento: la rama que ese argumento activa (escalas por volumen, tramos, descuentos) **nunca se ejecuta**.

**El caso medido.** Se cobraba **de más** a quien compraba al por mayor: **−100** y **−150** de diferencia
según la escala que no llegaba a evaluarse.

**Por qué no se ve.** El resultado es un número **plausible** y el default hace que la rama sea
**inalcanzable**: ninguna prueba de la función falla, porque la función hace bien lo que le piden. El
defecto está en el **llamador**, y el llamador no se prueba.

**→ La prevención.** El parámetro que **activa una regla** no lleva default: se hace obligatorio, y el
default —si lo hay— es el que **falla ruidosamente** (o el más restrictivo, nunca el más barato de
ejecutar). Y se prueba el **llamador real**, no solo la función.

### T7 · La jerarquía inerte por un parámetro que falta.

**La trampa.** Una cascada de resolución (precios, permisos, descuentos) recibe **opcional** el dato que
activa sus niveles: todos los niveles quedan **muertos** y la cascada devuelve el valor por defecto **sin
que nada esté roto**.

**El caso medido.** Se cobraba la **lista** donde el acuerdo decía **750**.

**Por qué no se ve.** La función «funciona» y devuelve algo; los niveles existen en el código y se leen en
la revisión, pero **nunca se recorren**. Un sistema que devuelve el valor por defecto es
**indistinguible** de un sistema que no tiene nada mejor que ofrecer.

**→ La prevención.** El dato que activa la cascada es **obligatorio** en la firma, y la resolución
**devuelve por qué nivel decidió** (o lo registra). Con eso, «decidió el nivel por defecto» deja de ser
silencioso, y hay una prueba por **cada** nivel.

---

## C. El aislamiento

### T8 · La consulta sin el discriminante de inquilino.

**La trampa.** El acceso por **clave única** se hace sin el inquilino: el aislamiento queda dependiendo de
que el identificador **venga bien**.

**El caso medido.** **25 sitios** con esa forma. Y el aislamiento automático **excluye a propósito** las
claves únicas (no puede inyectar el filtro donde la clave ya es única), así que la red de seguridad
**existe y no cubre este caso**.

**Por qué no se ve.** Con un identificador correcto el resultado es correcto: el defecto es una **fuga**, y
una fuga solo se manifiesta con un identificador **ajeno**, que ninguna prueba usa. La cobertura automática
da la falsa sensación de que el aislamiento está resuelto en otra capa.

**→ La prevención.** El inquilino entra **en la clave de acceso** y **en el tipo** (`{ id, inquilino }`,
nunca `id` solo); una regla automática sobre el patrón; y un caso de prueba con un identificador **de otro
inquilino** que debe devolver «no encontrado». El aislamiento automático **se declara con su alcance**: qué
cubre y qué excluye a propósito.

---

## D. La prueba y su entorno

### T11 · El test que pasa por el estado de la máquina.

**La trampa.** Un caso que depende de **datos acumulados**, de una **credencial no versionada** o del
**reloj local**: verde en la máquina donde se escribió, rojo en un entorno limpio.

**El caso medido.** **Tres** casos verdes en desarrollo y rojos en un runner limpio: uno pasaba por datos
que un script auxiliar había dejado en la base de desarrollo (el entorno limpio tenía **0** filas y el
selector no encontraba nada), otro por credenciales que solo existían en un fichero **no versionado**, y
otro por el reloj local.

**Por qué no se ve.** En la máquina del autor **siempre pasa**, y ahí es donde se prueba. El verde es de la
máquina, no del código; cuando cae en otro sitio se atribuye a «flakiness» o al entorno.

**→ La prevención.** Un caso debe **crear lo que mide**: los datos que necesita los crea él, y si no puede,
lo dice. Las credenciales salen del entorno. El reloj y la zona se declaran en el **propio caso**. Y la
única prueba de que un gate sirve es haberlo corrido en el **entorno donde tiene que proteger**.

### T12 · El doble de prueba infiel.

**La trampa.** Un doble (mock, stub, linter, simulador) que **no replica la semántica** de lo que
sustituye: devuelve filas ignorando el filtro, aprueba sin compilar, responde siempre lo que el caso
espera.

**El caso medido.** **Tres** ficheros quedaron llamando a una función **sin importarla**, y el lint dio
**0** —un identificador indefinido no es un error de tipos— mientras el contador de deuda bajaba
correctamente: el **único** instrumento que lo vio fue el compilador.

**Por qué no se ve.** El doble lo diseña quien quiere que la prueba pase, y su verde **se lee como el verde
del sistema**. Un instrumento más débil que el defecto no lo ve, y su silencio se interpreta como
aprobación.

**→ La prevención.** El doble debe reproducir la **semántica** que sustituye (filtros, errores, límites,
nulos), y si no puede, se declara como aproximación. El instrumento **más estricto** (el compilador, el
tipo) corre **por unidad de trabajo** —por fichero, por commit—, no al final de la tanda.

### T13 · La credencial en el código o en las pruebas.

**La trampa.** La contraseña del entorno local **dentro** del código o de la prueba: funciona en la máquina
de quien la escribió y falla donde la credencial es otra.

**El caso medido.** **39 de 42** pruebas construían su cliente con la contraseña del entorno local, que no
está versionada; el entorno de integración usaba otra ⇒ **392** casos caídos por fallo de autenticación.

**Por qué no se ve.** Localmente **conecta**. El rojo aparece solo en el entorno limpio, en masa, y se lee
como problema de infraestructura. Y la credencial queda en la **historia** del repositorio: limpiar el
código **no** la saca de ahí.

**→ La prevención.** Toda credencial sale del **entorno**; un gate busca literales de conexión y secretos en
todo el árbol, **pruebas incluidas**; y si la credencial estuvo versionada alguna vez, se **rota** —no basta
con borrarla.

---

## E. La medición que no mide

### T9 · El total que baja mientras una unidad se queda sin hacer.

**La trampa.** Una cifra **agregada** puede mejorar aunque una unidad (fichero, módulo, fichero de datos)
**no se haya tocado**: la mueven las demás.

**El caso medido.** El contador bajó **8** y un fichero tenía **4** sitios sin migrar. En otro salto, la
cifra congelada quedó en **1524** cuando la cuenta real era **1521**: el gate **no falló** —bajar da verde—
y la deuda dejó de estar congelada en su cifra.

**Por qué no se ve.** El total **mejora**, y mejorar es lo que se espera: nadie audita una mejora. La unidad
olvidada no aparece en ningún informe porque los informes hablan del total.

**→ La prevención.** El delta **por unidad**, no por total: el informe va por fichero o por módulo, y la
medición de cada commit se **aísla** (apartando lo demás) para que el commit lleve **su** delta. Y el informe
lista también lo que **desaparece**, no solo lo nuevo: un informe que solo habla cuando empeora obliga a
creerse la resta.

### T10 · La medición que no puede encontrar nada.

**La trampa.** Un filtro con comillas escapadas, un patrón **orientado a líneas** contra datos
**multilínea**, una búsqueda que no incluye los ficheros ocultos: devuelven **0**, y el 0 **se lee como un
dato**.

**El caso medido.** Un censo daba **17** donde había **18** (el instrumento que medía y el que actuaba no
veían lo mismo, así que todas las cifras anteriores eran cotas inferiores). Un auditor declaró **0** y el
valor real era **54**: su detector no veía los redondeos escritos en **tres líneas**. Y un filtro con las
comillas mal escapadas devolvió **0 procesos** mientras el proceso **seguía corriendo**: un envío creído
terminado.

**Por qué no se ve.** Un cero y un «no hay nada» son **la misma salida**. Nadie audita un cero, y el cero
además es lo que se quiere oír.

**→ La prevención.** Antes de creerte un cero, **demuestra que el filtro puede encontrar algo**: pásale un
caso positivo conocido. Trata el cero como **«no sé»**. Y prueba el detector contra los casos **difíciles**
(multilínea, anidado, forma irregular, fichero oculto): *una métrica en 0 solo vale si el detector está
probado contra los casos difíciles.*

### T15 · El gate que se puede burlar o redirigir.

**La trampa.** Un chequeo que **acepta que le digan dónde mirar** (un argumento, una variable de entorno, el
directorio actual), o que solo comprueba que el **texto es válido** en vez de comprobar el **valor**.

**El caso medido.** Un modo «solo este fichero» salía **0 en silencio**, anunciando incluso una **mejora**
(«687 → 32»): el contador degradado a **decoración**. Y una clave de un fichero de configuración **sin
valor** parseaba perfectamente —la clave existía y valía `null`— así que el pipeline **no fijaba nada** y el
parseo dijo OK.

**Por qué no se ve.** El gate **da verde**, y verde es lo que se espera. Un gate degradado es
**indistinguible** de un gate que funciona hasta el día en que algo pasa y nadie entiende por qué.

**→ La prevención.** La raíz y la línea base se resuelven por la ubicación del **propio script**, nunca por
el directorio actual, una variable de entorno ni un argumento. Un modo de **informe** declara que **no
evalúa** y no emite veredicto. Y la puerta comprueba el **valor**: *ejecuta el valor, no el documento.*

---

## F. El dinero

### T14 · La precisión del dinero.

**La trampa.** Coma flotante para importes, redondeos **intermedios**, y redondear **fuera** de la
serialización (`.toFixed()` sobre dinero). El redondeo binario no es el decimal y **rompe los empates**.

**El caso medido.** El redondeo a texto trabaja sobre el valor **binario**: `(2.675).toFixed(2)` da
`'2.67'` donde la regla contable manda **2.68**. Y el auditor de dinero declaró **0** mientras el valor real
era **54**, porque no veía los redondeos escritos en **tres líneas**.

**Por qué no se ve.** Un céntimo no rompe nada visible: se acumula en el cuadre y aparece semanas después,
cuando ya nadie lo conecta con el redondeo que lo causó. Y el **0** del auditor se lee como «está limpio».

**→ La prevención.** Un **tipo de dinero** (entero en la unidad mínima, o decimal con escala declarada),
redondeo **solo** en la frontera de serialización, y las operaciones intermedias **sin redondear**. Un gate
que cuente redondeos y `.toFixed` sobre dinero —con el detector probado contra las formas difíciles— y que
exija marca explícita cuando el valor **no** es dinero (una tasa, un porcentaje).

---

## Lo que las une: no gritan

Diez de estas quince trampas comparten una propiedad que las hace peligrosas por separado y **una familia**
juntas: **su salida es indistinguible de la salida correcta.**

| Lo que se ve | Por qué es correcto |
|---|---|
| **0** en un censo | «no hay nada» |
| **verde** en un gate | «está bien» |
| **silencio** en una herramienta | «no hacía falta» |
| **un valor plausible** | «salió el número» |
| **una mejora** | «vamos mejor» |

Un cero, un verde y un silencio **se leen igual**, y ninguno de los tres pide explicación. Por eso la
defensa **no es tener cuidado**: el cuidado es exactamente lo que estas trampas consumen sin dar señal. La
defensa tiene dos mitades:

1. **Medir por pieza.** Nunca un total cuando puedes tener el delta por unidad (T9). Nunca un resultado
   agregado cuando puedes tener el nivel que decidió (T7). Nunca un censo cuando puedes probar el detector
   (T10). Lo que se mide por pieza puede fallar **en su pieza**, y eso sí se ve.
2. **Hacer ruidosa la pieza que no se puede medir.** Si no puedes comprobar un valor, **dilo en la salida**
   («INFORME: no evalúa nada», «⚠️ NINGÚN SITIO SUSTITUIDO: REVISAR», «⚠️ NINGÚN SITIO ANALIZADO»), y que
   esa salida **no sea verde**. Si no puedes cubrir un caso, declara el alcance de lo que sí cubres
   (T8: el aislamiento automático **excluye** las claves únicas; decirlo es parte del gate). Un límite
   declarado es una pieza más; un límite callado es la siguiente trampa.

De ahí las tres frases que resumen el catálogo:

- **Un cero sin detector probado es un artefacto de medición** (T10, T9).
- **Un verde sin caso que lo haya visto en rojo no es un gate** (T10, T11, T15).
- **Un silencio no es una respuesta: es una pregunta sin hacer** (T10, T12).

### El síntoma que se lee como bueno

| Lo que se dice | Lo que esconde | Trampa |
|---|---|---|
| «En mi entorno funciona» | dos zonas coinciden por casualidad | T1, T2, T3 |
| «El validador lo aceptó» | se validó la forma, no el valor | T4 |
| «El tipo lo garantiza» | hay una afirmación encima | T5 |
| «El precio salió solo» | la escala por volumen nunca se evaluó | T6, T7 |
| «El identificador venía bien» | el aislamiento no lo comprobaba | T8 |
| «El total bajó» | una unidad se quedó sin hacer | T9 |
| «El censo da 0» | el detector no encuentra | T10 |
| «La prueba pasa» | pasa por el estado de la máquina | T11 |
| «El lint está verde» | el doble no compila | T12 |
| «Aquí lo probé» | la credencial solo existe aquí | T13 |
| «Son céntimos» | el redondeo binario decide el cuadre | T14 |
| «Puedes apuntarlo donde quieras» | el gate se puede burlar | T15 |

---

## Cómo se usa, y qué NO es esta skill

- **Es un catálogo de clases, no una lista de bugs.** No se busca una trampa por su nombre: se pregunta
  **qué clase** puede estar escondida en lo que se está tocando, y qué medición la haría visible.
- **Los casos son de dónde salieron, no de dónde viven.** El caso medido viaja con la trampa porque es lo
  que la hace comprobable; el **sitio concreto** del defecto se queda en el manual del proyecto que lo
  sufrió.
- **Nada de aquí depende del stack.** Si una trampa solo existe en tu framework, tu lenguaje o tu dominio,
  no la metas aquí: escríbela en el manual de tu repositorio, con su caso y su gate.
- **Hermana de la skill de verificación.** Esta dice **qué defectos buscar**; las reglas de cómo se
  verifica un cambio y cómo se escribe un gate que de verdad bloquea van en la skill de verificación y
  medición, que es la que se invoca al escribir el gate. Las dos se referencian y no se repiten.

## References

- **Las quince trampas en detalle**, con la reproducción mínima, la medición y la traducción a un gate o a
  un tipo por cada una: `references/catalogo-de-trampas.md`.
- **Checklist operativa**: cómo revisar un cambio o triar un síntoma contra las quince clases, en cinco
  minutos: `references/checklist-de-revision.md`.
