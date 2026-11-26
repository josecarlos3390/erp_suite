# Decisiones de política — la práctica del mercado como regla

> **Qué es este documento.** Cinco decisiones que estaban **abiertas** en `AUDIT.md` (T972, T973,
> T976, T982 y la liquidación de comisiones) y que **no se resolvían con más análisis**: se
> resolvían **eligiendo**. Aquí queda cada una con **la referencia del ERP consolidado que la
> sostiene**, la **decisión** y **lo que implica** (un ajuste, una validación, o nada).
>
> **Regla de la casa que se respeta en todas**: la decisión **no se implementa a medias**; lo que
> falta queda escrito con su dueño y su forma, no como «pendiente de decidir».

---

## 1. T982 — nivel de determinación de cuentas (`accountDeterminationLevel`)

**La pregunta**: ¿la cuenta de un artículo se busca por **artículo**, por **grupo** o por
**almacén**?

**La referencia**: **SAP B1** guarda las cuentas en el **grupo de artículos** (`OITB`) y las
sobrescribe **por artículo** (`OITM`); el almacén es una tabla aparte. Es decir, B1 **no elige un
nivel**: recorre una **jerarquía** de lo más específico a lo más general.

**La decisión**: **se queda en `ITEM`** (el valor por defecto) y **no se toca**. Nuestro motor
**ya implementa la jerarquía** —matriz artículo-almacén → maestro del artículo → grupo → almacén—
y este ajuste solo decide **por dónde entra**. Entrar por `ITEM` es lo más específico y lo que la
propia guía de parametrización recomienda; cambiarlo a `ITEM_GROUP` *bajaría* la precisión sin
ganar nada, porque la caída al grupo **ya ocurre** cuando el artículo no tiene cuenta.

**Implica**: **ningún cambio de código**. La fila T982 se cierra como decisión, no como deuda.

---

## 2. T976 — ¿se congela `Item.standardCost`?

**La pregunta**: ¿se persiste un **costo estándar** por artículo, y se sobrescribe solo?

**La referencia**: **SAP B1** tiene `AvgPrice` (lo mueven los documentos) y `StdPrice` (lo fija el
usuario) y el artículo declara con **qué método** valora; **Odoo** tiene `standard_price` que
actualizan los métodos `average`/`fifo`, y `standard` **no** se mueve solo.

**La decisión**: **se persiste, y NUNCA se sobrescribe automáticamente**. El costo estándar es un
**dato de política** que el usuario fija (congela) cuando el artículo valora a estándar; el
promedio y el FIFO siguen calculándose **de los movimientos**, como hoy. Sobrescribirlo con el
último costo de compra convertiría una decisión de gestión en un efecto colateral.

**Implica**: un campo `Item.standardCost` (migración) + su captura en el maestro + el motor de
valoración **leyéndolo** cuando el método es estándar. **Es un incremento, no un ajuste**, y queda
con nombre: *«costo estándar: persistir y no sobrescribir»*.

---

## 3. T973 — política de **lotes vencidos**

**La pregunta**: ¿qué pasa cuando alguien intenta **vender o consumir** un lote vencido?

**La referencia**: **SAP B1** tiene **estado de lote** (`Released` / `Not accessible`) y **bloquea**
la salida de un lote no accesible; **Odoo** bloquea la entrega de lotes vencidos cuando se activa
el uso de fechas de caducidad («remove expired lots»); **Dynamics** lo hace con el grupo de modelo
de inventario y la vida útil.

**La decisión**: **bloquear por defecto**, con **excepción autorizada por rol** — el patrón que
esta casa ya usa para lo sensible (facturar sin precio, sobrescribir crédito) —. Y con **tres
matices** que la práctica impone:
1. **Solo si el lote TIENE `expiryDate`**: sin fecha no es perecedero y no se bloquea nunca.
2. **La fecha se compara con el «hoy» del TENANT**, no del proceso (`tenantToday()`), que es la
   trampa que ya mordió en esta casa.
3. **La devolución al proveedor y la baja por vencimiento NO se bloquean** — son justamente las
   salidas legítimas de un lote vencido; bloquearlas dejaría el stock muerto en el sistema.

**Implica**: **un motor único** (`assertLoteNoVencido`) y sus llamadores en las salidas de
venta/consumo (hoy repartidos en **siete módulos**, medido: `delivery-orders` 70 menciones de
`batchId`, `sale-invoices` 47, `purchase-receipts` 70…). **Es un incremento transversal** y va con
su permiso de excepción, su spec y su A/B; **no se hace a medias**.

---

## 4. T972 — **FEFO** como criterio de consumo

**La pregunta**: ¿qué lote se propone consumir?

**La referencia**: **SAP B1** propone el lote por **fecha de caducidad** y **permite cambiarlo**;
**Odoo** tiene *removal strategy* **FEFO** por ubicación y **sugiere**, no impone; **Dynamics**
ordena por fecha de vencimiento en la reserva.

**La decisión**: **FEFO como SUGERENCIA, nunca como bloqueo**, y **solo para artículos con lote y
con `expiryDate`**; para el resto, **FIFO por fecha de recepción**. Que sea sugerencia es la parte
que importa: los tres ERP permiten elegir otro lote — hay razones legítimas (un cliente pide una
partida concreta, un lote está reservado)—, y **imponerlo** obligaría a inventar un override que
nadie pidió.

**Implica**: el mismo trabajo que T973 (los caminos con lote), así que **los dos van juntos** en
un incremento *«política de lotes: FEFO sugiere, el vencido bloquea»*.

---

## 5. Liquidación de las comisiones (F3.2 de T980)

**La pregunta**: una vez devengado el pasivo «Comisiones por Pagar», **¿cómo se paga al vendedor?**

**La referencia**: **SAP B1** paga la comisión del **empleado** por **nómina** (no toca el
subledger de socios); **Odoo** genera una **factura de proveedor al agente**, porque el agente es
un **`Partner`**; **NetSuite** tiene un **pago de comisión** propio.

**La decisión**: **nómina por defecto**, y **socio solo si el vendedor es externo**. La razón es de
modelo, no de gusto: en este ERP el vendedor es un **`User`**, no un `Partner`; meterlo en el
subledger de CxP exigiría **duplicar su identidad** como socio y arrastraría conciliación de
socios, antigüedad de saldos y retenciones de un tercero que **no lo es**. Cuando haga falta pagar
a un agente **externo**, la pieza correcta es un **vendedor socio** (un `User` con
`linkedPartnerId`) y **entonces** el pago es un egreso normal.

**Implica**: **hoy no hay nada que implementar** — el devengo ya está hecho y el pasivo queda
acumulado por vendedor (una línea por vendedor en el asiento). La **liquidación** es la pieza
siguiente y su forma ya está decidida: **pago por nómina**; el caso «agente externo» **exige el
campo `linkedPartnerId`** y se declara como incremento aparte, no como deuda oculta.

---

## Resumen ejecutivo

| Fila | Decisión | ¿Código? |
|---|---|---|
| **T982** | `ITEM` (jerarquía ya existente) | **No** |
| **T976** | Persistir `standardCost` y **no** sobrescribirlo | Incremento |
| **T973** | **Bloquear** lote vencido (con excepción por rol y tres matices) | Incremento transversal |
| **T972** | **FEFO sugiere**; FIFO de respaldo | Mismo incremento que T973 |
| **F3.2** | **Nómina**; socio solo si el vendedor es externo | Incremento (con `linkedPartnerId`) |
