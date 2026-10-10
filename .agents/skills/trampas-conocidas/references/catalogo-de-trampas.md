# Catálogo de trampas — detalle, reproducción y prevención

> Todo lo de aquí es **neutral de lenguaje y de dominio**. El pseudocódigo es pseudocódigo. Las trampas
> (`T1`…`T15`) están resumidas en `SKILL.md`; esto es el detalle que se consulta cuando ya se sabe **cuál**
> se está mirando.
>
> **Cómo se lee cada ficha.** *La trampa* (una frase) · *Reproducción mínima* (el caso más pequeño que la
> enseña) · *El caso medido* (lo que pasó de verdad) · *Por qué no se ve* · *La prevención, en concreto*
> (tipo, regla o gate) · *Cómo se habría medido antes* (la comprobación que la caza temprano).

---

## Índice

| # | Trampa | Familia | Se manifiesta como |
|---|---|---|---|
| T1 | Día de calendario contra instante | tiempo | funciona en un entorno y falla en otro |
| T2 | La zona del proceso en vez de la del negocio | tiempo | el «hoy» se adelanta o se atrasa en una franja |
| T3 | La conversión de zona a mano | tiempo | intermitencia por horas de borde |
| T4 | La validación de forma en vez de valor | contrato | fallo lejano o nulo silencioso |
| T5 | La cortina del cast | contrato | el valor malo viaja hasta que se compara |
| T6 | El argumento con default silencioso | contrato | una rama de negocio nunca se ejecuta |
| T7 | La jerarquía inerte por un parámetro que falta | contrato | se aplica el valor por defecto sin error |
| T8 | La consulta sin el discriminante de inquilino | aislamiento | fuga que solo aparece con un id ajeno |
| T9 | El total que baja mientras una unidad se queda sin hacer | medición | el agregado mejora y el trabajo no está |
| T10 | La medición que no puede encontrar nada | medición | un cero que se lee como dato |
| T11 | El test que pasa por el estado de la máquina | prueba | verde local, rojo en entorno limpio |
| T12 | El doble de prueba infiel | prueba | el instrumento débil da verde |
| T13 | La credencial en el código o en las pruebas | prueba | caída en masa solo fuera de local |
| T14 | La precisión del dinero | dinero | céntimos que no cuadran semanas después |
| T15 | El gate que se puede burlar o redirigir | medición | verde en un gate degradado |

---

## T1 · Día de calendario contra instante

- **La trampa.** Comparar un **día** con un **instante** (en cualquier dirección): la zona del proceso
  decide si el resultado cae un día antes o un día después.
- **Reproducción mínima.**
  ```
  columna: dia            (2026-03-01, sin hora)
  filtro : dia >= instante(2026-03-01T00:00 en zona Z)
  con Z = la del proceso, el límite puede ser 2026-02-28T23:00 o 2026-03-01T04:00
  ```
- **El caso medido.** Un filtro de ofertas acertaba en **17 de 20** combinaciones de datos y zonas; las tres
  que fallaban **solo coincidían cuando el proceso corría en UTC**.
- **Por qué no se ve.** En el entorno del autor las dos zonas coinciden **siempre**, así que el resultado es
  correcto y lo seguirá siendo hasta que alguien cambie la zona del proceso. No hay excepción ni valor
  raro: hay un día de más.
- **La prevención, en concreto.**
  - Tipo de **día** distinto del tipo de **instante**, en la frontera del sistema y hasta la base de datos.
  - **Una sola** función convierte entre los dos; en ningún otro sitio se comparan.
  - Caso de prueba ejecutado con **dos zonas de proceso** distintas: si el resultado cambia, la comparación
    está mal.
- **Cómo se habría medido antes.** Correr la suite dos veces, con la zona del proceso cambiada. Es un
  comando, no una revisión.

---

## T2 · La zona del proceso en vez de la del negocio

- **La trampa.** «Hoy» se calcula con el reloj o la zona del **servidor** o del test en vez de con la del
  **inquilino** (o empresa, sucursal, país) configurada.
- **Reproducción mínima.**
  ```
  hoy = fechaDelSistema()                     # mal
  hoy = fechaEnZona(reloj, zonaDelInquilino)  # bien
  # a las 21:00 local con el proceso en UTC, las dos dan días distintos
  ```
- **El caso medido.** Entre las **20:00 y las 24:00 locales**, el «hoy» del sistema era **el día
  siguiente**; con el proceso en **UTC**, documentos del día se rechazaban como «futuros».
- **Por qué no se ve.** Durante casi todo el día las dos fechas coinciden; el defecto vive en una **franja
  horaria** que cae fuera del horario de pruebas y, cuando aparece, se atribuye a los datos («¿por qué me
  rechaza esto como futuro?») y no al reloj.
- **La prevención, en concreto.**
  - Un **único proveedor de «hoy»** que recibe la zona del inquilino; el reloj directo **prohibido** fuera
    de él, con un gate que cuente los usos y falle si suben.
  - Los casos declaran su zona; la **franja de borde** (23:xx local) tiene su propio caso.
- **Cómo se habría medido antes.** Un caso a las 23:30 locales con el proceso en otra zona: el «hoy» tiene
  que seguir siendo el local.

---

## T3 · La conversión de zona a mano

- **La trampa.** Convertir a texto y cortar (`toISOString().slice(0,10)` y equivalentes): el mismo valor se
  lee distinto en cada máquina porque la conversión a texto pasa por la zona del proceso.
- **Reproducción mínima.**
  ```
  clave = texto(valor).recorte(0, 10)     # mal: la zona del proceso entra en el texto
  clave = diaLocal(valor, zona)           # bien: una función de frontera
  ```
- **El caso medido.** **23 sitios** en las pruebas, todos con la misma forma.
- **Por qué no se ve.** Cada sitio es correcto **casi siempre**: solo falla en las horas de borde, y no hay
  un punto único que pueda gritar. Se lee como intermitencia, no como una regla mal escrita 23 veces.
- **La prevención, en concreto.**
  - **Una** función de frontera, y un gate que busque el patrón en **todo** el árbol —pruebas incluidas,
    que es donde más vive— con la cuenta **congelada** y que falle si **sube**.
- **Cómo se habría medido antes.** Buscar el patrón por texto en todo el árbol, no solo en el código de
  producción: los sitios que rompen pruebas también cuentan.

---

## T4 · La validación de forma en vez de valor

- **La trampa.** El validador comprueba que el texto **tiene la forma** (fecha ISO, número, código), no que
  el **valor exista**: `'2026-02-30'` cumple el patrón y no es una fecha.
- **Reproducción mínima.**
  ```
  validaForma('2026-02-30')  -> OK
  convierte('2026-02-30')    -> nulo
  usa(nulo!)                 -> la aserción no lo detiene
  ```
- **El caso medido.** Fallo de servidor o **`null` silencioso** según el camino: el conversor devolvía nulo
  y la aserción que venía detrás lo dejaba pasar.
- **Por qué no se ve.** La validación **dice OK** y el error aparece lejos de la frontera con otra forma:
  una ausencia de valor no es una excepción, así que el sistema sigue con nulo por dentro.
- **La prevención, en concreto.**
  - Parsear en la **frontera** y devolver un **fallo explícito** o un valor por defecto **declarado**; nunca
    dejar pasar la cadena.
  - La **autoprueba del validador** incluye los casos imposibles: `'2026-02-30'`, el 31 de un mes de 30, el
    29 de febrero no bisiesto, la cadena vacía, el texto con espacios.
- **Cómo se habría medido antes.** Al validador se le pasa un valor con la forma correcta y el contenido
  imposible: tiene que **fallar**.

---

## T5 · La cortina del cast

- **La trampa.** `!`, `as`, `cast`, `unwrap()`: **no cambian el valor, afirman**. El operador no comprueba
  nada; solo deja de mirar.
- **Reproducción mínima.**
  ```
  funcion(dia)                       # el contrato dice: un día
  funcion(instante!)                 # compila; el valor sigue siendo un instante
  funcion(quizáNulo!)                # compila; el valor puede ser nulo
  ```
- **El caso medido.** Una aserción ocultaba que un argumento podía ser un **instante** donde el contrato
  dice **día**; otra, que podía ser **`undefined`**. Los dos valores llegaban hasta la comparación.
- **Por qué no se ve.** **Compila**, pasa el lint, y el valor incorrecto viaja hasta que alguien lo compara
  o lo persiste. La aserción es la única línea que dice «aquí no hay nada que ver», y se lee como garantía.
- **La prevención, en concreto.**
  - Cada aserción es **deuda con nombre**: o se sustituye por una comprobación real (guarda, valor por
    defecto, un tipo que ya excluya el caso), o queda **contada y congelada** con un gate que falla si
    **sube**.
  - Nombre del operador por lenguaje, misma cortina: `!` / `as`, `unwrap()` / `expect()`, `cast()` /
    `# type: ignore`, la aserción de tipo, `as` / `!!`.
- **Cómo se habría medido antes.** Contar las aserciones y **congelar** la cifra: sin cifra no hay deuda,
  hay costumbre.

---

## T6 · El argumento con default silencioso

- **La trampa.** Un valor por defecto en el parámetro que **activa una regla** (`cantidad = 1`, `nivel =
  'base'`) y llamadores que no lo pasan: la rama nunca se ejecuta.
- **Reproducción mínima.**
  ```
  precio(cantidad = 1)            # la escala por volumen vive detrás de este parámetro
  precio(unidades)                # llamador que omite la cantidad -> siempre la escala 1
  ```
- **El caso medido.** Se cobraba **de más** a quien compraba al por mayor: **−100** y **−150** de diferencia
  según la escala que no llegaba a evaluarse.
- **Por qué no se ve.** El resultado es un número **plausible** y el default hace la rama **inalcanzable**:
  ninguna prueba **de la función** falla, porque la función hace bien lo que le piden. El defecto está en el
  **llamador**, y el llamador no se prueba.
- **La prevención, en concreto.**
  - El parámetro que **activa una regla** no lleva default: **obligatorio** en la firma.
  - Si hay default, es el que **falla ruidosamente** o el **más restrictivo** —nunca el más barato de
    ejecutar—.
  - Se prueba el **llamador real** (el camino de la aplicación), no solo la unidad.
- **Cómo se habría medido antes.** Una prueba del **camino completo** con una cantidad mayor que 1: el
  importe tiene que cambiar.

---

## T7 · La jerarquía inerte por un parámetro que falta

- **La trampa.** Una cascada de resolución (precios, permisos, descuentos) recibe **opcional** el dato que
  activa sus niveles: todos los niveles quedan **muertos** y devuelve el valor por defecto **sin que nada
  esté roto**.
- **Reproducción mínima.**
  ```
  resolver(clave, acuerdo?)          # sin 'acuerdo', los niveles 2..n son inalcanzables
    si acuerdo: niveles...
    sino: valorDeLista               # siempre por aquí
  ```
- **El caso medido.** Se cobraba la **lista** donde el acuerdo decía **750**.
- **Por qué no se ve.** La función «funciona» y devuelve algo; los niveles existen en el código y se leen
  en la revisión, pero **nunca se recorren**. Devolver el valor por defecto es **indistinguible** de no
  tener nada mejor que ofrecer.
- **La prevención, en concreto.**
  - El dato que activa la cascada, **obligatorio** en la firma.
  - La resolución **devuelve (o registra) por qué nivel decidió**: «decidió el nivel por defecto» deja de
    ser silencioso.
  - Una prueba por **cada** nivel, con la evidencia de cuál se eligió.
- **Cómo se habría medido antes.** Trazar el nivel elegido en un caso real: si siempre es el mismo, la
  cascada es decorativa.

---

## T8 · La consulta sin el discriminante de inquilino

- **La trampa.** El acceso por **clave única** se hace sin el inquilino: el aislamiento depende de que el
  identificador **venga bien**.
- **Reproducción mínima.**
  ```
  buscarPorId(id)                    # mal: sin inquilino
  buscarPorId({ id, inquilino })     # bien: el inquilino entra en la clave
  # el aislamiento automático NO puede inyectar el filtro donde la clave ya es única
  ```
- **El caso medido.** **25 sitios** con esa forma, y el aislamiento automático **excluye a propósito** las
  claves únicas: la red de seguridad existe y **no cubre este caso**.
- **Por qué no se ve.** Con un identificador correcto el resultado es correcto. El defecto es una **fuga**,
  y solo aparece con un identificador **ajeno**, que ninguna prueba usa. La cobertura automática da la falsa
  sensación de que el aislamiento está resuelto en otra capa.
- **La prevención, en concreto.**
  - El inquilino entra **en la clave de acceso** y **en el tipo**; la firma que solo acepta un id no existe.
  - Regla automática sobre el patrón, con la cuenta congelada.
  - Un caso con un identificador **de otro inquilino** que debe dar «no encontrado».
  - El aislamiento automático **declara su alcance**: qué cubre y qué excluye a propósito.
- **Cómo se habría medido antes.** Una prueba de fuga: pedir con el id de otro inquilino y exigir «no
  encontrado».

---

## T9 · El total que baja mientras una unidad se queda sin hacer

- **La trampa.** Una cifra **agregada** puede mejorar aunque una unidad (fichero, módulo, conjunto de datos)
  **no se haya tocado**: la mueven las demás.
- **Reproducción mínima.**
  ```
  antes: total = 100 (fichero A 50, B 50)
  tocas A -> 40; B sigue en 50 pero con 4 sitios sin migrar
  después: total 90  "mejoró"     # y B quedó a medias
  ```
- **El caso medido.** El contador bajó **8** y un fichero tenía **4** sitios sin migrar. En otro salto, la
  cifra congelada quedó en **1524** cuando la cuenta real era **1521**: el gate **no falló** (bajar da
  verde) y la deuda dejó de estar congelada en su cifra.
- **Por qué no se ve.** El total **mejora**, y mejorar es lo que se espera: nadie audita una mejora. La
  unidad olvidada no aparece en ningún informe porque los informes hablan del total.
- **La prevención, en concreto.**
  - Delta **por unidad** (fichero, módulo, commit), no por total.
  - Aislar la medición de cada commit (apartar lo demás) para que el commit lleve **su** delta.
  - El informe lista también lo que **desaparece**, no solo lo nuevo: un informe que solo habla cuando
    empeora obliga a creerse la resta.
- **Cómo se habría medido antes.** Informe por unidad, y comparar la unidad **una por una** tras la tanda.

---

## T10 · La medición que no puede encontrar nada

- **La trampa.** Un filtro con comillas escapadas, un patrón **orientado a líneas** contra datos
  **multilínea**, una búsqueda que **no incluye los ficheros ocultos**: devuelven **0**, y el 0 se lee como
  un dato.
- **Reproducción mínima.**
  ```
  buscar "a\"b"            -> 0      # las comillas escapadas no casan: el filtro no encuentra
  buscarLinea("Math.round(") -> 0    # el patrón real ocupa tres líneas
  listar *.txt             -> 0      # había ficheros ocultos
  ```
- **El caso medido.** Un censo daba **17** donde había **18** (todas las cifras anteriores eran **cotas
  inferiores**). Un auditor declaró **0** y el valor real era **54**: su detector no veía los redondeos
  escritos en **tres líneas**. Y un filtro mal escapado devolvió **0 procesos** mientras el proceso seguía
  corriendo: un envío creído terminado.
- **Por qué no se ve.** Un cero y un «no hay nada» son **la misma salida**. Nadie audita un cero, y el cero
  además es lo que se quiere oír.
- **La prevención, en concreto.**
  - Antes de creerte un cero, **demuestra que el filtro puede encontrar algo**: pásale un caso positivo
    conocido.
  - Trata el cero como **«no sé»**, no como «no hay».
  - Prueba el detector contra los casos **difíciles** (multilínea, anidado, forma irregular, fichero
    oculto, comillas): *una métrica en 0 solo vale si el detector está probado contra los casos difíciles.*
- **Cómo se habría medido antes.** Autoprueba del detector con un caso positivo **y** un caso difícil
  conocidos, antes de usarlo para decidir.

---

## T11 · El test que pasa por el estado de la máquina

- **La trampa.** Un caso que depende de **datos acumulados**, de una **credencial no versionada** o del
  **reloj local**: verde donde se escribió, rojo en un entorno limpio.
- **Reproducción mínima.**
  ```
  el caso lee la tabla X y espera 3 filas    # en la máquina hay 3 (las dejó un script)
  entorno limpio: 0 filas                    # "element(s) not found"
  ```
- **El caso medido.** **Tres** casos verdes en desarrollo y rojos en un runner limpio: uno por datos que un
  script auxiliar había dejado (el entorno limpio tenía **0** filas), otro por credenciales que solo
  existían en un fichero **no versionado**, y otro por el reloj local.
- **Por qué no se ve.** En la máquina del autor **siempre pasa**, y ahí es donde se prueba. El verde es de
  la máquina, no del código; cuando cae en otro sitio se atribuye a «flakiness» o al entorno.
- **La prevención, en concreto.**
  - El caso **crea lo que mide**; si no puede, lo declara.
  - Las credenciales salen del **entorno** (ver T13).
  - Reloj y zona se declaran **en el propio caso**.
  - La única prueba de que un gate sirve es haberlo corrido en el **entorno donde tiene que proteger**.
- **Cómo se habría medido antes.** Correr el caso en un entorno **limpio** (base vacía, credenciales del
  entorno, otra zona): si el verde depende de la máquina, cae.

---

## T12 · El doble de prueba infiel

- **La trampa.** Un doble (mock, stub, linter, simulador) que **no replica la semántica** de lo que
  sustituye: devuelve filas **ignorando el filtro**, aprueba **sin compilar**, responde siempre lo que el
  caso espera.
- **Reproducción mínima.**
  ```
  doble.buscar(filtro) -> devuelve TODAS las filas   # ignora el filtro
  la prueba pasa                                     # la consulta real devolvería de más
  ```
- **El caso medido.** **Tres** ficheros quedaron llamando a una función **sin importarla** y el lint dio
  **0** —un identificador indefinido no es un error de tipos— mientras el contador de deuda bajaba
  correctamente: el **único** instrumento que lo vio fue el compilador.
- **Por qué no se ve.** El doble lo diseña quien quiere que la prueba pase, y su verde **se lee como el
  verde del sistema**. Un instrumento más débil que el defecto no lo ve, y su silencio se interpreta como
  aprobación.
- **La prevención, en concreto.**
  - El doble reproduce la **semántica** que sustituye: filtros, errores, límites, nulos. Si no puede, se
    **declara** como aproximación.
  - El instrumento **más estricto** (compilador, tipos) corre **por unidad de trabajo** —fichero, commit—,
    no al final de la tanda.
  - No se acepta «el lint está verde» como sustituto del compilador.
- **Cómo se habría medido antes.** El compilador por fichero tocado, y una prueba del doble **contra** la
  implementación real (mismo caso, mismo resultado).

---

## T13 · La credencial en el código o en las pruebas

- **La trampa.** La contraseña del entorno local **dentro** del código o de la prueba: funciona en la
  máquina de quien la escribió y falla donde la credencial es otra.
- **Reproducción mínima.**
  ```
  cliente("...://usuario:CLAVE-LOCAL@host/base")   # literal en la prueba
  entorno de integración: otra clave               # autenticación fallida, en masa
  ```
- **El caso medido.** **39 de 42** pruebas construían su cliente con la contraseña del entorno local, que
  **no está versionada**; el entorno de integración usaba otra ⇒ **392** casos caídos por fallo de
  autenticación.
- **Por qué no se ve.** Localmente **conecta**; el rojo aparece solo en el entorno limpio, **en masa**, y se
  lee como problema de infraestructura. Y la credencial queda en la **historia** del repositorio: limpiar el
  código **no** la saca de ahí.
- **La prevención, en concreto.**
  - Toda credencial sale del **entorno**; nunca un literal, ni siquiera en pruebas.
  - Un gate busca literales de conexión y secretos en **todo** el árbol, pruebas incluidas.
  - Si la credencial estuvo versionada alguna vez, se **rota**: el código limpio no limpia la historia.
- **Cómo se habría medido antes.** Buscar el patrón de conexión con credenciales en todo el árbol; y correr
  las pruebas con **otra** credencial.

---

## T14 · La precisión del dinero

- **La trampa.** Coma flotante para importes, redondeos **intermedios**, y redondear **fuera** de la
  serialización (`.toFixed()` sobre dinero). El redondeo binario no es el decimal y **rompe los empates**.
- **Reproducción mínima.**
  ```
  redondear2(2.675) -> '2.67'      # binario, no decimal; la regla contable manda 2.68
  (a + b).redondear2()             # redondeo INTERMEDIO: el error se acumula
  ```
- **El caso medido.** El redondeo a texto trabaja sobre el valor **binario**: `(2.675).toFixed(2)` da
  `'2.67'` donde la regla contable manda **2.68**. Y el auditor de dinero declaró **0** mientras el valor
  real era **54**, porque no veía los redondeos escritos en **tres líneas**.
- **Por qué no se ve.** Un céntimo no rompe nada visible: se acumula en el cuadre y aparece semanas después,
  cuando ya nadie lo conecta con el redondeo que lo causó. Y el **0** del auditor se lee como «está
  limpio».
- **La prevención, en concreto.**
  - Un **tipo de dinero**: entero en la unidad mínima, o decimal con **escala declarada**.
  - Redondeo **solo** en la frontera de serialización; las operaciones intermedias **sin redondear**.
  - Un gate que cuente redondeos y `.toFixed` sobre dinero, con el **detector probado** contra las formas
    difíciles, y con marca explícita cuando el valor **no** es dinero (una tasa, un porcentaje).
- **Cómo se habría medido antes.** Autoprueba del detector de dinero con los casos difíciles
  (multilínea, anidado, envuelto), y un caso de cuadre con empates (`.005`).

---

## T15 · El gate que se puede burlar o redirigir

- **La trampa.** Un chequeo que **acepta que le digan dónde mirar** (argumento, variable de entorno,
  directorio actual), o que comprueba que el **texto es válido** en vez de comprobar el **valor**.
- **Reproducción mínima.**
  ```
  gate --file otro-sitio        -> 0 en silencio, anunciando incluso una mejora
  clave:                        # en un fichero de configuración
  parsea OK (la clave existe y vale nulo)   # y no fija nada
  ```
- **El caso medido.** Un modo «solo este fichero» salía **0 en silencio**, anunciando incluso una
  **mejora** («687 → 32»): el contador degradado a **decoración**. Y una clave **sin valor** parseaba
  perfectamente —la clave existía y valía `null`— así que el pipeline **no fijaba nada** y el parseo dijo
  OK.
- **Por qué no se ve.** El gate **da verde**, y verde es lo que se espera. Un gate degradado es
  **indistinguible** de un gate que funciona hasta el día en que algo pasa.
- **La prevención, en concreto.**
  - La raíz y la línea base se resuelven por la ubicación del **propio script**: nunca por el directorio
    actual, una variable de entorno ni un argumento.
  - Un modo de **informe** declara que **no evalúa** y **no emite veredicto**.
  - La puerta comprueba el **valor**: *ejecuta el valor, no el documento.*
- **Cómo se habría medido antes.** Copiar el gate **fuera** del árbol, con su línea base, y romperlo a
  propósito: si no se ve rojo, el gate no protege.

---

## Cómo se elige la trampa que toca

1. **¿Hay dinero?** → T14, y T6/T7 si hay escalas o cascadas de precio.
2. **¿Hay fechas, horas o «hoy»?** → T1, T2, T3.
3. **¿Hay validación de entrada?** → T4, y T5 si hay aserciones de tipo cerca.
4. **¿Hay datos de varios inquilinos o propietarios?** → T8.
5. **¿Vas a declarar que «ya está»?** → T9, T10, T15 (la medición).
6. **¿Vas a escribir o tocar pruebas?** → T11, T12, T13.

Si dudas entre dos, elige la que **no deja señal**: es la que se te va a escapar.
