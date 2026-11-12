# Anulación vs. nota de crédito — recomendación contable

> **Estado**: recomendación para decisión del usuario. **Nada de esto está implementado** salvo lo
> que se marca como hecho. Nace de la reconstrucción de `FVE-1` (ledger `T713`) y de la corrección del
> costo de la NC (`T714`).
>
> **Pregunta que responde**: ¿es correcto lo que vamos a hacer? ¿qué se acomoda mejor contablemente?
> **Respuesta corta**: la **dirección** es correcta (separar los dos instrumentos); el **plan anterior
> (A–E) estaba incompleto** y en un punto era peligroso. Abajo va lo medido, las invariantes que se
> rompen hoy y la recomendación revisada.

---

## 1 · Lo que YA está bien (no se toca)

1. **La anulación revierte el asiento**: `sale-invoices.service.cancel()` llama a
   `accountingEngine.reverseJournalEntry(...)` (línea 5253). El instrumento de anulación **existe y
   es el correcto** (asiento espejo marcado `REVERSAL`, el original `CANCELLED` apuntando a él).
2. **La NC acredita «Anticipo Clientes»** por la parte reembolsable: es la contrapartida correcta de
   un crédito a favor del cliente (un pasivo con el cliente, no un saldo negativo de la factura).
3. **El costo de la NC espeja el de la línea base** (`T714`): 40,00 revierte 40,00.
4. **El plazo legal de anulación ya está modelado** (`canAnnulInvoice`), que es media regla.

## 2 · Las invariantes que se rompen HOY (medidas)

| # | Invariante | Cómo se rompe hoy |
|---|---|---|
| **I1** | **Un hecho, un instrumento.** O se anula (reversa) o se acredita (nota de crédito). Nunca las dos. | La NC total **postea su asiento Y deja la factura `CANCELLED`**. `FVE-1` acabó con `paidAmount 100` + `creditedAmount 100` + **`balanceDue −100`**. |
| **I2** | **Todo documento POSTED tiene su asiento** (la inversa de R13). | `COB-2` y `COB-3`: `status POSTED`, `isAdvance true`, **0 líneas, 0 asientos**. Dicen «cobrado 100» y no están en el libro. |
| **I3** | **Los saldos publicados reconcilian con el libro.** | `PartnerBalance.balanceAR = 1100` y `totalCreditedAR = 0` **con dos NC de 100**: el derivado no se movió con las notas de crédito. El libro sí está bien («Anticipo Clientes» 200 = `incomingBalance` 200). |
| **I4** | **Un documento posteado es inmutable**: se corrige con otro documento, nunca editándolo. | La NC tiene `update()`. Un documento fiscal posteado editable no existe en SAP, Odoo ni BC. |

## 3 · Cómo lo resuelven los ERP de referencia

| | **Anulación** | **Nota de crédito** |
|---|---|---|
| **SAP B1** | `Cancel` de una factura **no cobrada** (y no conciliada): asiento de reversa + reversa de stock. Si está cobrada, **no se puede**. | `A/R Credit Memo`: documento nuevo; el saldo a favor queda como **crédito del socio** (aplicable o reembolsable). **No** crea un cobro. |
| **Odoo** | `Cancel` solo en **borrador**; una publicada se revierte **con nota de crédito**. El pago se **desconcilia** antes. | La NC se concilia; el remanente queda como **«crédito a favor»** del cliente. |
| **Dynamics 365 BC** | `Delete` solo en borrador; registrada se corrige con **credit memo**. | Credit memo; el crédito vive en la cuenta del cliente. |

**La regla que comparten los tres**: **el cobro nunca se borra** (se revierte), **la anulación no existe
si hay cobro**, y **el crédito a favor del cliente no es un saldo negativo de la factura**.

## 4 · La recomendación: una matriz, no una regla suelta

Mi plan anterior miraba solo «pagada / no pagada». Falta el **eje legal**, que en Bolivia pesa: dentro
del plazo de anulación (RND 10-0016-17) la factura puede anularse; fuera, **ya es un documento fiscal
y solo se acredita**.

| | **Sin cobro** | **Con cobro** |
|---|---|---|
| **Dentro del plazo** | **ANULAR** — reversa del asiento + stock; `CANCELLED`; saldo **0** | **NC** |
| **Fuera del plazo** | **NC** (no se anula un documento fiscal cerrado) | **NC** |

Y en la NC, siempre:

- la factura queda **`CLOSED`** (nunca `CANCELLED`): el estado `CANCELLED` significa «sin efecto
  fiscal, asiento revertido», que no es lo que pasó;
- `creditedAmount` acumula lo acreditado; **`balanceDue = max(total − paid − credited, 0)`**, nunca
  negativo;
- el dinero del cliente vive en **`advanceAR` / «Anticipo Clientes»**, y si se le devuelve, sale por un
  **pago saliente** con su asiento — no por un `IncomingPayment`.

### Qué hago con cada punto del plan anterior

| Punto | Veredicto | Ajuste |
|---|---|---|
| **A** — la NC deja de cancelar | ✅ **Sí**, es lo correcto | La factura queda `CLOSED` con `creditedAmount`; si cubre todo, un estado **derivado** «acreditada totalmente» (no `CANCELLED`). |
| **B** — anular exige sin pago | ✅ **Sí**, y **también dentro del plazo** | Mensajes que digan el siguiente paso: «cancele el cobro primero» / «use nota de crédito». |
| **C** — `balanceDue` 0 | ✅ **Sí** | `max(total − paid − credited, 0)`; el crédito se publica en `advanceAR`. |
| **D** — borrar `COB-2` | ⚠️ **Mal planteado** | **No borrar**: primero **por qué existe**. Es el **abono** del crédito (mismo importe que el haber de «Anticipo Clientes»). Recomendación **SAP**: **no crear el cobro** — el crédito ya vive en el asiento de la NC — y **quitar la creación**; si se decidiera mantenerlo, **tiene que postear** (Caja/Banco D · Anticipo H) o **duplicaría**. |
| **E** — anular con reversa | ✅ **Ya está hecho** | Lo que falta es que **la NC no dispare la anulación**. |
| **F (nuevo)** — inmutabilidad | ✅ **Añadir** | Una NC posteada no se edita; se corrige con otra NC o su anulación. |

## 5 · Las puertas que hay que añadir (para que no vuelva a pasar)

Ninguna de estas existe hoy; las cuatro son **medibles**:

1. **`POSTED` sin asiento** → error. Es la simétrica de R13 y **habría cazado `COB-2`/`COB-3`**.
2. **`balanceDue < 0`** en cualquier factura → error.
3. **`CANCELLED` con `creditedAmount > 0`** → error (dos instrumentos para un hecho).
4. **`PartnerBalance` contra el libro** (AR + anticipos) → error si divergen; y **`totalCreditedAR`**
   debe moverse con cada NC, hoy no lo hace.

## 6 · Orden de trabajo recomendado (del más seguro al más visible)

| # | Incremento | Por qué primero | Medición |
|---|---|---|---|
| **1** | **Puerta «POSTED sin asiento»** | Es el defecto **más grave y silencioso**; y la puerta lo hace **imposible de repetir** | Hoy: 2 hallazgos (`COB-2`, `COB-3`) ⇒ 0 |
| **2** | **Quitar la creación del cobro-abono** en la NC (o postearlo, si se prefiere) | Cierra I2 en el origen; el crédito ya está en el asiento de la NC | Cobros POSTED sin asiento ⇒ 0 |
| **3** | **Matriz pagada × plazo** (guardas de anulación) | Corta el caso incoherente **antes** de tocar saldos | Anular una factura cobrada ⇒ 400 con el mensaje; fuera de plazo ⇒ 400 |
| **4** | **La NC no cancela + `balanceDue` + crédito publicado** | Cambia el comportamiento visible; va **después** de las guardas | `FVE-1` ⇒ `balanceDue 0`; NC total ⇒ factura `CLOSED` |
| **5** | **Inmutabilidad + reconciliación de `PartnerBalance`** | Lo más profundo (toca datos derivados) | `balanceAR` = libro; editar una NC posteada ⇒ 400 |

## 7 · Lo que NO recomiendo

- **Borrar o editar asientos** para cuadrar: se corrige con documentos (reversa / NC).
- **Anular fuera del plazo**: es un documento fiscal; la vía es la NC.
- **Dejar `balanceDue` negativo** «porque el asiento cuadra»: el documento **miente** aunque el libro
  esté bien.
- **Aflojar R13** otra vez: la afinación de `T712` ya distingue el caso correcto; lo que falta es la
  **puerta simétrica**, no más excepciones.
