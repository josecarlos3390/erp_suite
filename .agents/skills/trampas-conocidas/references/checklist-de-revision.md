# Checklist de revisión — las quince clases, en cinco minutos

> Uso: se recorre **antes de commitear** un cambio que toca tiempo, dinero, contratos, aislamiento o
> pruebas; y al **triar un síntoma** que no se explica. Cada casilla lleva su comprobación, no su opinión:
> si una casilla no se puede comprobar, **se declara como no comprobada**.
>
> Las trampas (`T1`…`T15`) están en `SKILL.md`; el detalle y la reproducción mínima, en
> `catalogo-de-trampas.md`.

---

## 1. Antes de commitear — la ronda corta

Marca **solo** lo que has comprobado **ejecutando algo**. Lo demás va a «no comprobado», con el motivo.

- [ ] **T1 · Día contra instante.** ¿Comparo un día con un instante en algún sitio? ¿El caso corre con
      **dos zonas de proceso**?
- [ ] **T2 · Zona del negocio.** ¿El «hoy» sale del **proveedor único** con la zona del inquilino, y no del
      reloj del proceso? ¿Hay caso en la **franja de borde** (23:xx local)?
- [ ] **T3 · Conversión a mano.** ¿He buscado el patrón de conversión por texto **en todo el árbol**,
      pruebas incluidas? ¿La cuenta no subió?
- [ ] **T4 · Valor, no forma.** ¿La validación nueva **falla** con el contenido imposible
      (`2026-02-30`, el 31 de un mes de 30, la cadena vacía), no solo con la forma mala?
- [ ] **T5 · Casts.** ¿Las aserciones nuevas están **contadas** (y la cifra no subió), o sustituidas por
      una comprobación real?
- [ ] **T6 · Default silencioso.** ¿El parámetro que activa una regla **no tiene default**? ¿Se probó el
      **llamador real** con un valor que cambia la rama?
- [ ] **T7 · Cascada inerte.** ¿El dato que activa los niveles es **obligatorio**, y puedo decir **por qué
      nivel** decidió la resolución?
- [ ] **T8 · Inquilino.** ¿Toda consulta por clave única lleva el inquilino **en la clave y en el tipo**?
      ¿Hay un caso con un identificador **ajeno**?
- [ ] **T9 · Delta por unidad.** ¿El número que declaro es **por unidad**, con el comando al lado, y no un
      total agregado?
- [ ] **T10 · Detector probado.** ¿El detector/censo que uso ha encontrado **alguna vez** el caso que
      busca? ¿Puede encontrar el caso **difícil** (multilínea, oculto, anidado)?
- [ ] **T11 · Entorno real.** ¿El caso **crea lo que mide**? ¿Ha corrido en un entorno **limpio** (base
      vacía, credenciales del entorno, otra zona)?
- [ ] **T12 · Doble fiel.** ¿El doble reproduce filtros, errores y límites? ¿El **compilador** está verde
      **por unidad de trabajo**, no solo el lint?
- [ ] **T13 · Credenciales.** ¿He buscado literales de credenciales en todo el árbol, **pruebas
      incluidas**? ¿Si alguna estuvo versionada, se ha **rotado**?
- [ ] **T14 · Dinero.** ¿El redondeo ocurre **solo** al serializar? ¿Las operaciones intermedias no
      redondean? ¿Hay caso con empate (`.005`)?
- [ ] **T15 · Gate burlable.** ¿La raíz y la línea base salen del **propio script**? ¿El modo informe
      declara que **no evalúa**? ¿La puerta comprueba el **valor**?

**Y la pregunta que caza la mitad de las quince, si solo hay tiempo para una:**

> **¿Qué salida de este cambio es indistinguible de la salida correcta — un cero, un verde, un silencio o
> un valor plausible — y cómo la hago ruidosa?**

---

## 2. Triaje de un síntoma

El síntoma que llega casi nunca es el defecto. Traduce primero:

| El síntoma que llega | Sospecha primero | Cómo se confirma |
|---|---|---|
| «Funciona en desarrollo y falla en otros entornos» | T1, T2, T3, T11, T13 | cambiar **una** cosa del entorno (zona, base limpia, credencial) y repetir |
| «Falla solo a ciertas horas» | T2, T3 | caso en la franja de borde (23:xx local) con otra zona de proceso |
| «Devuelve nulo / da error de servidor con unos datos y con otros no» | T4 | pasar al validador el contenido imposible con la forma correcta |
| «El número es plausible pero está mal» | T6, T7, T14 | trazar **qué rama/nivel** decidió; comprobar el redondeo |
| «Sale un dato que no es de esta cuenta / de este cliente» | T8 | pedir con un identificador **ajeno** |
| «Ya está arreglado: el contador bajó» | T9, T10 | delta **por unidad**; probar el detector con un caso positivo |
| «Pasa en mi máquina y en el servidor no» | T11, T12, T13 | entorno limpio; compilador por unidad; credenciales del entorno |
| «Un céntimo de diferencia, no cuadra» | T14 | buscar redondeos intermedios y `.toFixed` sobre dinero |
| «El gate dijo OK» | T15, T10 | romper el gate **fuera** del árbol, a propósito: ¿se ve rojo? |

**Regla de triaje:** no se investiga el síntoma, se investiga **qué medición lo habría cazado antes**. Si no
existe esa medición, esa es la mitad del arreglo.

---

## 3. Las cinco preguntas del cambio silencioso

Se hacen al **artefacto**, no a la persona. Cualquier «sí» es una trampa del catálogo.

1. **¿Esta salida puede ser 0 sin que sea verdad?** (T10, T9) → probar el detector con un caso positivo.
2. **¿Este verde se ha visto alguna vez en rojo?** (T10, T11, T15) → si no, no es un gate.
3. **¿Este valor por defecto se alcanza alguna vez por el camino bueno?** (T6, T7) → trazar el nivel.
4. **¿Este tipo garantiza el valor, o hay una afirmación encima?** (T4, T5) → buscar `!`, `as`, `cast`.
5. **¿Este entorno es el que tiene que proteger?** (T11, T13) → entorno limpio, credenciales del entorno.

---

## 4. Cómo se añade una trampa nueva a este catálogo

El catálogo crece **con casos medidos**, no con opiniones. Una trampa entra si:

- [ ] Tiene **una frase** que la define (si necesitas dos, son dos trampas).
- [ ] Tiene un **caso medido**: qué pasó exactamente, con sus cifras y el comando o la prueba que lo
      produjo. **Sin caso no entra**: sería un consejo.
- [ ] Tiene **por qué no se ve**: el síntoma que la esconde. Si grita, no es una trampa del catálogo.
- [ ] Tiene **prevención comprobable**: un tipo, una regla con gate, o una prueba. «Tener cuidado» no es
      prevención.
- [ ] **No depende de un stack ni de un dominio.** Si solo existe en un framework concreto, va al manual de
      ese repositorio, no aquí.
- [ ] Es **distinta** de las quince: si es una forma de la misma, se añade como **variante** dentro de su
      ficha (con su caso), no como trampa nueva.

Y al añadirla, se actualizan los tres sitios: la tabla de `SKILL.md`, su ficha en
`catalogo-de-trampas.md` y la ronda corta de esta checklist.

---

## 5. Lo que esta checklist NO cubre

- **El diseño del gate** (cómo se escribe, dónde vive su línea base, cómo se prueba en rojo): eso es de la
  skill de **verificación y medición**, que es la que se invoca al escribir un gate. Aquí solo se pregunta
  **qué defecto** puede estar escondido.
- **Las reglas del proyecto** (convenciones, capas, nombres): viven en el manual del repositorio.
- **Los defectos que sí gritan** (una excepción, un rojo, un fallo de compilación): no hacen falta aquí,
  porque ya avisan solos.
