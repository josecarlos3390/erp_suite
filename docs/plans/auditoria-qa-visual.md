# Auditoría QA visual — operar cada módulo por sus formularios

> **Qué es.** El plan para probar el ERP **como lo usa el usuario**: entrar a cada módulo, abrir cada
> formulario, registrar documentos reales, y comprobar que lo que la pantalla dice es lo que queda en
> la base y en la contabilidad. Nace de lo medido en esta etapa: **los defectos aparecen operando**,
> no leyendo código.
>
> **La pregunta era «¿es posible?»** Sí, y esta etapa lo demostró con el circuito completo de venta,
> compra, recepción, cobro y comprobante. Lo que hace falta no es más tiempo del previsto, es
> **método**: el mismo que ya está probado, aplicado módulo a módulo.

---

## 1 · Por qué esto encuentra cosas que los gates no encuentran

En esta etapa, operando por pantalla, aparecieron **cuatro clases de defecto** que ninguna suite vio:

| Clase | Ejemplo medido |
|---|---|
| **Un supuesto de una familia aplicado a otra** | la rejilla de líneas listaba **vendibles** en compra (T675) y el precio era de solo lectura (T678) |
| **Una clasificación contable equivocada** | la entrada de inventario acreditaba un **costo**: el resultado salía 488 donde era 88 (T686) |
| **Un dato que no se hereda** | la factura desde la recepción perdía el **proveedor** (T683) |
| **Una serie que no existe** | el cobro no tenía serie de «Pago recibido» (T684) |

Los cuatro son **invisibles para un test unitario** y evidentes para un usuario operando. Y los cuatro
se encontraron **una sola vez recorrido el flujo entero**.

---

## 2 · El método (probado en esta etapa: no se negocia)

**Por cada formulario, el ciclo es siempre el mismo:**

1. **Abrir** la pantalla como el usuario (menú o el botón que la app ofrece, no la URL adivinada).
2. **Enumerar el DOM real antes de actuar** — la lección más caras de esta etapa: *buscar el control
   por su forma supuesta* (`input` por placeholder, panel por `role=listbox`) produjo **tres falsos
   negativos** (T681, T687, T688). Un sondeo de 10 líneas (`document.querySelectorAll('*')` antes y
   después de abrir el selector) dio la estructura en segundos.
3. **Leer el aviso tal cual, sin filtro de palabras** — T687 se habría evitado: el toast decía «Hay
   líneas con monto pero sin cuenta contable asignada» y mi filtro no lo incluía.
4. **Comprobar que los datos están en el modelo**, no solo en la pantalla (que el total diga
   «Cuadrado» no prueba que las líneas tengan cuenta).
5. **Registrar el documento de verdad** y **capturar la respuesta del API** (código y total).
6. **Verificar en la base y en la contabilidad**: documento, líneas, asiento y cuadre.
7. **Captura de pantalla** del estado final, con nombre que diga qué se probó.
8. **Un hallazgo, una fila del ledger** (`AUDIT.md`): síntoma, qué se descartó midiendo, causa, arreglo
   y verificación. **Y si un diagnóstico se corrige, se escribe al lado** (T669, T677, T688, T689 lo
   hicieron; ninguno se borró).

**Regla de oro**: si no se puede enseñar la evidencia, no está probado. Un verde sin captura ni cifra
es un deseo.

---

## 3 · El alcance: módulos y formularios a recorrer

Cada módulo se cierra **entero** antes de pasar al siguiente (operar por etapas, como pediste). La
columna «estado» es lo que esta etapa ya cubrió.

### E1 · Maestros y configuración — *base de todo lo demás*

| Formulario | Qué se prueba | Estado |
|---|---|---|
| Monedas · Tipo de cambio | alta, y que **bloquee** sin la tasa del día | ✅ |
| Perfil de empresa · sucursales · almacenes | NIT en la factura, sucursal por defecto | ✅ |
| Plan de cuentas · mapeos · gestión y períodos | 316 / 77 / 12 · «Restaurar Defaults» | ✅ |
| Series de numeración | una por tipo de documento | ✅ |
| Terceros (cliente / proveedor) | alta con sus datos fiscales | ✅ |
| Artículos (venta / compra / inventario) | los tres tipos, UoM, impuesto, precio | ✅ |
| Unidades y grupos · impuestos · listas de precio | se usan en los documentos | 🟡 parcial |
| **Mapeo «ajuste de inventario»** | **no tiene tarjeta en pantalla** (hallazgo T690) | ⛔ |

### E2 · Ventas

| Formulario | Qué se prueba | Estado |
|---|---|---|
| Factura de venta | alta manual, precio de lista, **asiento** | ✅ |
| Pedido de venta → entrega → factura | el circuito natural | 🟡 pendiente |
| Nota de crédito / devolución | contra factura, con su asiento | ⛔ |
| Notas de entrega · reservas | inventario en tránsito | ⛔ |
| Factura de servicios (línea de cuenta) | precio tecleado, sin artículo | ⛔ |

### E3 · Compras

| Formulario | Qué se prueba | Estado |
|---|---|---|
| Factura de compra (manual) | **precio del proveedor** y asiento | ✅ (T678) |
| Pedido de compra | precio, confirmación «Sí, registrar» | ✅ (T679) |
| Recepción desde el pedido | preload de lo pendiente, **contabiliza GRIR** | ✅ (T682) |
| Factura desde la recepción | hereda proveedor y montos | ✅ (T683) |
| Cotización de compra → pedido | la cadena desde el inicio | ⛔ |
| Nota de crédito de compra · devolución | contra factura | ⛔ |

### E4 · Tesorería y cobros

| Formulario | Qué se prueba | Estado |
|---|---|---|
| Pago recibido (cobro) | tercero + documentos a cancelar, serie | ✅ (T684) |
| Pago realizado (pago a proveedor) | el espejo | ⛔ |
| Transferencias · cajas · conciliación | asientos de tesorería | ⛔ |
| Retenciones sufridas | asiento y reporte | ⛔ |

### E5 · Inventario

| Formulario | Qué se prueba | Estado |
|---|---|---|
| Entrada / salida de inventario | contra la cuenta de compensación correcta | ✅ (T686) |
| Ajuste de inventario | merma / sobrante, su cuenta | ⛔ |
| Transferencia entre almacenes | sin asiento (mismo activo) | ⛔ |
| Lotes y series | trazabilidad en recepción y venta | ⛔ |
| Revaluación · costeo | el costo promedio se mueve con las recepciones | ⛔ |

### E6 · Finanzas y contabilidad

| Formulario | Qué se prueba | Estado |
|---|---|---|
| Comprobante manual | **alta + posteo** por pantalla | ✅ (T689) |
| Estados financieros | resultado y balance **cuadran y dicen la verdad** | ✅ (T687) |
| Balance de comprobación · mayor · auxiliares | coinciden con el libro | 🟡 parcial |
| Período cerrado | rechazo con mensaje claro | ⛔ |
| Presupuestos · centros de costo | reparto por dimensión | ⛔ |

### E7 · Producción · E8 · Reportes · E9 · Administración

| Módulo | Qué se prueba | Estado |
|---|---|---|
| Órdenes de producción, consumos, costos | el flujo completo | ⛔ |
| Reportes de ventas, compras, inventario, cartera | cada uno con datos reales | 🟡 parcial |
| Usuarios, roles, permisos, aprobaciones, borradores | lo que un admin hace | ⛔ |
| Carga masiva · catálogo comercial (tienda) | alta por plantilla y sincronización | ⛔ |
| Salud del tenant · consultas personalizadas | diagnóstico y consultas guardadas | ⛔ |

**Total estimado**: unos **60 formularios**. A una etapa por módulo, son **9 etapas**.

---

## 4 · Cómo se trabaja cada etapa (el contrato)

1. **Un módulo por etapa** y, dentro, **un formulario por ciclo**: abrir → operar → registrar →
   verificar en base y contabilidad → captura.
2. **Un commit por arreglo**, con su fila en el ledger y su verificación. Los hallazgos que no se
   arreglan en el momento se **declaran** (no se tapan).
3. **Al cerrar la etapa**: los gates de la casa en verde (`audit:ci`, `gate:rapido`, Karma, `build`,
   `lint`, `format`, `audit:encoding`, `ci:local`) y **`audit:reconcile` en 0** si se movió dinero.
4. **Al cerrar el módulo**: una tabla como las de arriba, con **estado por formulario** y la
   evidencia de cada uno.

---

## 5 · Los instrumentos que ya existen (y que hay que ampliar)

- **`erp-frontend/scripts/configurar-erp-por-ui.mjs`** — 10 pasos idempotentes para dejar el entorno
  listo desde cero. Es la base de cada etapa: **cada etapa arranca con el entorno puesto**.
- **Playwright** con la receta de esta etapa (enumerar DOM, leer toasts, verificar modelo).
- **`audit:reconcile`** y el balance de comprobación: el árbitro de que el dinero cuadra.
- **Lo que falta construir**: un **`recorridos/`** con un script por módulo (como los que se usaron
  aquí), y un **inventario de formularios** que se pueda correr y diga **qué quedó cubierto** — el
  equivalente del gate de la rejilla, pero para la operación.

---

## 6 · Los tres riesgos, dichos por delante

1. **El arnés puede mentir** (pasó **tres veces** en esta etapa). Mitigación: las cuatro
   comprobaciones del §2, y **nunca** declarar «defecto de producto» sin leer el aviso crudo y sin
   verificar el modelo.
2. **Los datos de la demo contaminan**: una etapa que crea 20 documentos deja el entorno irreconocible.
   Mitigación: `db:backup` antes de cada etapa y `db:empty` + repoblado por UI cuando haga falta (ya
   está montado).
3. **Cada etapa cuesta horas, no minutos**: el circuito de venta + compra + cobro de esta sesión llevó
   la mayor parte del tiempo, y eso que el entorno ya estaba. Presupuestar **una etapa por sesión**.

---

## 7 · Qué queda de esta etapa

- **E1, E4 (cobro), E6** cerrados; **E2 y E3** con su circuito manual y natural probados.
- **Un hallazgo abierto**: el mapeo de **ajuste de inventario** no se puede editar por pantalla (no
  tiene tarjeta en «Determinación de Cuentas de Mayor» → pestaña Inventario), aunque la fila existe en
  la base. Se declara para que la etapa de Maestros lo cierre.
- **La conclusión que importa**: el objetivo «todo desde la interfaz» **es alcanzable y está
  demostrado en los flujos principales**; lo que falta es **recorrer el resto con este método**, no
  rediseñar nada.
