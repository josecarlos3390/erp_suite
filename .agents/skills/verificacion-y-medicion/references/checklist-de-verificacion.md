# Checklist operativa y plantilla de gate

> Todo lo de aquí es **neutral de lenguaje y de herramienta**. El pseudocódigo es pseudocódigo: se traduce a
> lo que sea que uses para devolver un código de salida.
>
> Uso: copia la sección que necesites en el momento. Las reglas (`R1`…`R17`) están en `SKILL.md` y su
> detalle en `reglas-y-casos.md`.

---

## 1. Antes de escribir un gate — 9 preguntas

1. **¿Qué prohíbe exactamente?** Una frase. Si necesitas dos, son dos gates.
2. **¿Qué comando lo comprueba** y qué devuelve cuando el repositorio está bien y cuando está mal?
3. **¿Comprueba el VALOR o la forma?** (R3) Si comprueba que «parsea», «existe» o «tiene la clave», no está
   comprobando el valor.
4. **¿En qué puerta se engancha?** (R1) Pipeline, hook, script agregado. Un gate sin puerta es un deseo.
5. **¿Cómo se ve su rojo?** (R5) Si no lo has visto rojo, no sabes si funciona.
6. **¿Puede alguien apuntarlo a otro sitio?** (R14) Raíz y línea base por la ubicación del **script**.
7. **¿Su línea base vive junto al script?** (R15) Si vive en la raíz del proyecto, no se puede probar en rojo
   fuera del árbol.
8. **¿Qué pasa cuando no encuentra lo que busca?** (R10) ¿Grita o calla?
9. **¿Sobre qué conjunto decide?** (R8, R11) ¿Coincide con el conjunto sobre el que va a actuar?

---

## 2. Plantilla de gate (pseudocódigo)

```
# 1. La raíz y la línea base salen del SCRIPT, nunca de fuera.            (R14, R15)
scriptDir  = dirname(esteScript)
repoRoot   = resolve(scriptDir, '..')          # o donde esté la raíz
BASELINE   = join(scriptDir, 'baseline.json')  # junto al script
# PROHIBIDO: cwd, $ENTORNO_RAIZ, --root <ruta>

# 2. Un modo de informe NO evalúa y lo dice.                              (R14)
si (modo == 'informe'):
    imprimir('INFORME de <fichero>. NO evalúa nada, no emite veredicto.')
    salir(0)      # sin veredicto, sin "mejoró"

# 3. El censo lo hace EL MISMO MOTOR que actuará.                          (R8)
hallazgos = motor.analizar(repoRoot)           # no regex si actúas con AST
si (hallazgos.vacio y no sabePorQue):
    imprimir('⚠️ NINGÚN SITIO ANALIZADO: ¿forma distinta? REVISAR')      (R10)
    salir(3)      # no es verde: es "no sé"

# 4. Se compara contra la línea base POR CONTENIDO y se informa de los DOS lados.  (R16)
nuevos      = hallazgos - baseline.claves       # por contenido normalizado
desaparecidos = baseline.claves - hallazgos     # también se listan
imprimir('nuevos=%d desaparecidos=%d total=%d', nuevos, desaparecidos, hallazgos.total)
listar(nuevos, max: 40); listar(desaparecidos, max: 40)

# 5. Un flag decide el modo, y `--check` NO escribe.                        (R16)
si (--check):            # paso 1: comprobar
    salir(hallazgos.total > baseline.total ? 1 : 0)
si (--update-baseline):  # paso 2: congelar (¡hacen falta LOS DOS!)
    escribir(BASELINE, hallazgos); salir(0)

# 6. Todo parámetro que permita mirar a otro sitio, no existe.              (R14)
```

**Autoprueba obligatoria del gate** (y se engancha como un paso más de la puerta):

- [ ] Caso **clave/valor presente** ⇒ verde.
- [ ] Caso **clave presente con valor vacío** ⇒ rojo. (R3)
- [ ] Caso **clave ausente** ⇒ rojo.
- [ ] Caso **la forma esperada no aparece** ⇒ rojo ruidoso, no verde. (R10)
- [ ] Caso **el patrón difícil** (multilínea, anidado, forma irregular) ⇒ detectado. (R8)
- [ ] Caso **positivo conocido del filtro** ⇒ encontrado (el filtro puede encontrar algo). (R9)
- [ ] Los rojos se calculan con **la misma función** que decide el código de salida, no con una copia.

---

## 3. Checklist antes de commitear un cambio

- [ ] **`git rev-parse --abbrev-ref HEAD`** … y **actúa sobre lo que devuelva**. (R2)
- [ ] El `typecheck` (compilador) está verde **por unidad de trabajo**, no solo al final. (R12)
- [ ] Los tests nuevos se vieron **en rojo** antes del arreglo, y el rojo está en el informe. (R5)
- [ ] El linter está verde **y** no se usó como sustituto del compilador. (R12)
- [ ] El conteo de aserciones/casts: o no subió, o está declarado como deuda nueva. (R13)
- [ ] Si tocaste un índice o una línea base: `--check` **y** actualización, los **dos** pasos. (R16)
- [ ] Si tocaste un índice: el orden fue quitar la sonda → congelar → sondear → quitar la sonda. (R16)
- [ ] Si la tanda son varios ficheros: cada commit se midió con los demás apartados. (R17)
- [ ] El informe declara **lo que no se midió** y por qué. (R7)
- [ ] No hay `--no-verify`, ni saltos de hook, ni aserciones nuevas sin contar.

---

## 4. Plantilla para declarar una verificación

Se escribe **siempre**, aunque salga mal. Un rojo declarado con evidencia vale; un verde sin comando, no.

```markdown
### Verificación de <cambio>

**Qué se ejecutó** (comando literal, uno por línea, con el directorio):
    <comando>                          -> <salida resumida>, exit <N>

**Antes / después**
    <magnitud>      antes: <N>   después: <M>   comando: <el que produjo los dos>

**Rojo visto antes del arreglo**
    <comando>  ->  <N failed / M passed>   (antes de tocar <fichero>)

**Alcance del instrumento**
    mide con <X>, actúa con <Y>; alcance declarado: <igual / distinto ⇒ cota inferior>

**Verde probado en rojo fuera del árbol** (si aplica)
    copia en <ruta temporal>, rotura: <la que sea>  ->  exit <N>

**Lo que NO se midió**
    - <entorno que no se probó, dato ausente, flake, decisión de otro>

**Veredicto**  verde / rojo / NO MEDIDO  (sin adjetivos)
```

---

## 5. Checklist antes de dejar correr una transformación automática

- [ ] **Conjunto que toca** y **conjunto que debería tocar**, escritos, y comparados. (R11)
- [ ] **Exclusiones a propósito** identificadas, y comprobadas **contra la herramienta**. (R11)
- [ ] El **censo** y la **transformación** usan el mismo motor (o el censo se declara cota inferior). (R8)
- [ ] La herramienta **grita** si no encuentra la forma esperada, y lo **cuenta**. (R10)
- [ ] Se corrió primero sobre una **copia** o en seco, y el diff se revisó **entero**. (R11)
- [ ] Existe una marcha atrás: el cambio va en un commit propio y aislado. (R17)
- [ ] Después: `typecheck` **por fichero** sobre todo lo tocado. (R12)

---

## 6. Checklist de migración de un índice o de una línea base

- [ ] Sonda **fuera** antes de congelar. (R16)
- [ ] Congelar el **formato** nuevo (índice por contenido normalizado). (R16)
- [ ] Sondear **con** el formato nuevo. (R16)
- [ ] Quitar la sonda. (R16)
- [ ] `--check` → luego `--update-baseline`, **los dos pasos**, y el segundo en el mismo commit. (R16)
- [ ] La **cuenta** no se movió por el cambio de formato (comparar el número con el de antes). (R16)
- [ ] El informe lista lo nuevo **y** lo desaparecido. (R16)
- [ ] El delta de cada commit lo midió **el instrumento**, con los demás ficheros apartados. (R17)
- [ ] Límite del índice por contenido, declarado (claves repetidas dentro del mismo fichero). (R16)

---

## 7. Las cinco frases que hay que saber reconocer

| Se dice | Suele significar | Regla |
|---|---|---|
| «ya está escrito» | no hay comando | R1 |
| «ya lo comprobé» | no se obedeció | R2 |
| «es válido» | el valor no existe | R3 |
| «está verde» | sobre el conjunto equivocado, o sin compilar, o sin arrancar | R4, R11, R12 |
| «debería mejorar» | no hay medición | R6 |
