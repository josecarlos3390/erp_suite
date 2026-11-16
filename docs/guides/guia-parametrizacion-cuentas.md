# Guía de parametrización de cuentas contables

> **Para quién es esta guía.** Para quien **decide y carga las cuentas**: el implementador y el
> contador del cliente. Responde una sola pregunta, la que más asientos torcidos produce:
> **«¿esta cuenta se configura aquí o allá?»**
>
> **No es** la guía de asientos (esa es [`ACCOUNTING_ENTRIES_GUIDE.md`](ACCOUNTING_ENTRIES_GUIDE.md),
> que dice **cómo** se arma el asiento de cada documento) ni la del orden de alta del tenant (esa es
> [`guia-implementacion-configuracion.md`](guia-implementacion-configuracion.md), que dice **en qué
> orden** se enciende cada cosa). Esta dice **qué cuenta va en cada campo y por qué**.

---

## 1. La regla que resuelve el 90 % de las dudas

Antes de cargar una cuenta, pregúntese **qué la haría cambiar**:

| Pregunta | Si la respuesta es «sí»… | Dónde se configura |
|---|---|---|
| ¿Cambiaría si cambio **el producto**? | la cuenta depende del bien | **Artículo** (o su grupo / su almacén) |
| ¿Cambiaría si cambio **el cliente o el proveedor**? | la cuenta depende del socio | **Ficha del socio** |
| ¿No cambia con **ninguno** de los dos? | es una cuenta del **documento** | **Mapeos contables** |

Ejemplos que no dejan duda:

- **Inventario**, **costo de ventas**, **ingreso por ventas**, **compras**, **contrapartida de un
  ajuste de inventario** → cambian con el producto ⇒ **artículo**.
- **Cuentas por cobrar / por pagar**, **anticipos** → cambian con el socio ⇒ **socio**.
- **Banco**, **caja**, **IVA débito**, **IVA crédito**, **redondeos**, **descuento global** ⇒
  **mapeos contables**.

---

## 2. Los tres orígenes, medidos en el motor

El motor decide el origen por el **rol contable** (`entryType`), no por la pantalla. Estas son las
tres tablas, tal como están declaradas en
`backend-erp/src/common/accounting-entry-types.ts`:

### 2.1 Cuentas de **artículo** (`ENTRY_TYPE_TO_ITEM_FIELD`)

| Rol | Campo del maestro | Dónde aparece en el asiento |
|---|---|---|
| `INVENTORY` | `inventoryAccountId` | Debe al entrar mercadería, haber al salir |
| `COGS` | `cogsAccountId` | Debe del costo en factura/entrega; haber al devolverse |
| `SALES_REVENUE` | `salesRevenueAccountId` | Haber del ingreso en la factura (¡también en la reserva!) |
| `PURCHASES` | `purchaseAccountId` | Debe de la compra |
| `PRICE_VARIANCE` | `priceVarianceAccountId` | Diferencia entre costo de compra y costo real |
| `SALES_RETURN` | `returnAccountId` | Debe de la devolución de venta |
| `PURCHASE_RETURN` | `returnAccountId` | Haber de la devolución de compra |
| `SALES_CREDIT` | `salesCreditAccountId` | Debe que revierte el ingreso en la NC |
| `PURCHASE_CREDIT` | `purchaseCreditAccountId` | Haber que revierte la compra en la NC |
| `GRIR` | `grirAccountId` | Haber de la recepción; debe de la factura que la cierra |
| **`INVENTORY_OFFSET`** | **`inventoryOffsetAccountId`** | Haber del **sobrante**: «Compensación de Inventario» |
| **`INVENTORY_OFFSET_EXIT`** | **`inventoryOffsetExitAccountId`** | Debe de la **merma**: «Mermas y Desperdicios» |
| `WIP` / `WIP_VARIANCE` | `wipAccountId` / `wipVarianceAccountId` | Producción en proceso y su variación |
| `SCRAP` | `scrapAccountId` | Desperdicio de una orden de producción |
| `ALLOCATION` | `allocationAccountId` | Cuenta de reparto |
| `EXCHANGE_DIFFERENCE` | `exchangeDiffAccountId` | Diferencia de cambio |
| `STOCK_REVALUATION_INCREASE` / `_DECREASE` | `stockRevaluationAccountId` / `stockRevaluationOffsetAccountId` | Revalorización de inventario |
| `SALES_DISCOUNT` / `PURCHASE_DISCOUNT` | `salesDiscountAccountId` / `purchaseDiscountAccountId` | Descuentos de línea |

### 2.2 Cuentas de **socio** (`ENTRY_TYPE_TO_PARTNER_FIELD`)

| Rol | Campo del socio | Dónde aparece |
|---|---|---|
| `ACCOUNTS_RECEIVABLE` | `receivableAccountId` | Debe de la factura de venta; se acredita al cobrar |
| `ACCOUNTS_PAYABLE` | `payableAccountId` | Haber de la compra; se debita al pagar |
| `ADVANCE_RECEIVABLE` | `advanceReceivableAccountId` | Anticipo que el cliente nos da |
| `ADVANCE_PAYABLE` | `advancePayableAccountId` | Anticipo que damos al proveedor |

### 2.3 Cuentas de **mapeo** (todo lo demás)

`BANK`, `CASH`, `CREDIT_CARD`, `TAX_OUTPUT`, `TAX_INPUT`, cuentas de redondeo, retenciones, y las
cuentas **de cabecera** de documento (un descuento global no tiene artículo al que pertenecer).

> **Cómo saber qué rol es cuál, sin leer el código**: en **Configuración → Mapeos contables**, cada
> fila muestra **«Cuándo se usa · Dónde aparece»** y, cuando el rol es de artículo, la insignia
> **«Se toma del artículo · respaldo»** — ese mapeo **no** es la fuente principal.

---

## 3. «Fijar Cuenta de Mayor según» — el campo que decide **dónde** dentro del artículo

En la ficha del artículo (sección **Contabilidad**), el selector **«Fijar Cuenta de Mayor según»**
elige **de dónde** se leen las cuentas de artículo. **Siempre manda esta configuración**; el mapeo
contable no interviene en esta decisión.

| Valor | Qué lee el motor | Qué debe cargar usted |
|---|---|---|
| **Artículo (cuentas por almacén)** | la **matriz artículo-almacén** (las tarjetas de abajo) y, si la matriz no tiene la fila, el **maestro del artículo** | las cuentas en cada tarjeta de almacén del artículo |
| **Grupo de artículos** | las cuentas del **grupo** al que pertenece el artículo | las cuentas en la ficha del **grupo** |
| **Almacén** | las cuentas del **almacén de la línea del documento** | las cuentas en la ficha del **almacén** |

**Consecuencias que conviene tener claras:**

1. **Un solo lugar manda.** Si el artículo dice «Grupo», las cuentas cargadas en su maestro **no se
   leen** para esos roles. Si dice «Almacén», manda el almacén de la línea.
2. **La matriz gana al maestro** en el nivel «Artículo»: si la matriz del par artículo-almacén tiene
   la cuenta, se usa esa; si no tiene fila, se usa el maestro.
3. **No hay respaldo silencioso.** Si el nivel elegido no tiene la cuenta, el motor **falla y dice
   qué campo configurar** (política de «sin cuentas de respaldo»). Es a propósito: un asiento con una
   cuenta de relleno **cuadra y miente**.

---

## 4. Orden de parametrización (con verificación en cada paso)

El orden importa: cada paso supone que el anterior está bien. **No avance sin cerrar el anterior.**

### Paso 1 — Plan de cuentas

Debe existir y tener las cuentas con su **naturaleza correcta** (`ASSET`, `LIABILITY`, `EQUITY`,
`INCOME`, `COST`, `EXPENSE`). La naturaleza no es decorativa: el sistema la usa para **avisar**
cuando un mapeo apunta a una cuenta que no corresponde al rol.

> **Verificar**: la cuenta que usará como ingreso debe ser `INCOME`; la de costo, `COST` o
> `EXPENSE`; la de inventario, `ASSET`; la de proveedores, `LIABILITY`.

### Paso 2 — Gestión contable

Año fiscal **abierto** y **períodos** que cubran las fechas de los documentos. Un período cerrado
detiene la contabilización con un error explícito.

### Paso 3 — Mapeos contables (**cuentas de documento**)

Cargue aquí **solo** las cuentas de documento: banco, caja, tarjeta, IVA débito, IVA crédito,
redondeos, retenciones, y las cuentas de cabecera. **No** cargue aquí cuentas de artículo: el motor
no las consulta y la pantalla se lo advierte.

> **Verificar**: cada fila del grupo de documento tiene una cuenta y la insignia **«Se toma del
> artículo»** aparece solo donde corresponde.

### Paso 4 — Socios

Cuentas por cobrar / por pagar y anticipos, en la ficha del socio (o en su grupo de socios, si el
sistema usa esa herencia).

### Paso 5 — Grupos y almacenes

Si va a parametrizar por **grupo** o por **almacén**, cargue ahí las cuentas de artículo. Si va a
parametrizar por **artículo**, estos pasos son opcionales (pero útiles como red de seguridad si
cambia el nivel después).

### Paso 6 — Artículos y matriz artículo-almacén

1. Elija **«Fijar Cuenta de Mayor según»** en cada artículo (o en el grupo, si el artículo hereda).
2. Cargue las cuentas en el nivel elegido.
3. Para el nivel **Artículo**, cargue la **matriz por almacén** en las tarjetas del formulario: es
   la fuente principal; el maestro es el respaldo.

> **Verificar**: por cada artículo y almacén que vaya a operar, que las cuentas de `INVENTORY`,
> `COGS`, `SALES_REVENUE`, `INVENTORY_OFFSET` e `INVENTORY_OFFSET_EXIT` estén cargadas **en el nivel
> que el artículo declara**.

### Paso 7 — Prueba de humo (obligatoria)

Emita, en un ambiente de prueba, **un documento por familia** y **lea el asiento**:

1. **Factura de venta** — debe acreditar **ingreso** y **IVA débito**, debitar **costo** y
   acreditar **inventario**.
2. **Factura de reserva** (si usa reservas) — **mismas cuentas de ingreso e IVA** que la factura;
   **sin** movimiento de costo/inventario.
3. **Nota de crédito** — debe revertir **ingreso**, **IVA**, **costo** e **inventario**.
4. **Ajuste de inventario positivo** — debe acreditar la **contrapartida de sobrante**, no una
   cuenta de ventas ni de proveedores.
5. **Ajuste de inventario negativo** — debe debitar **mermas**.
6. **Cobro y pago** — caja/banco contra clientes/proveedores.
7. **Compra y su factura** — GRIR, IVA crédito y proveedores.

**Cómo se lee un asiento** (y qué se busca): que **cuadre** es lo mínimo; lo que se revisa es
**la naturaleza de cada cuenta** y que **ninguna sea de relleno**. Un asiento puede cuadrar y estar
mal.

---

## 5. Qué valida el sistema, y qué solo avisa

| Mecanismo | Qué hace | Dónde se ve |
|---|---|---|
| **Sin respaldo (T248)** | si la cuenta no está en el nivel que el artículo declara, **falla** y nombra el campo a configurar | al contabilizar |
| **Aviso de naturaleza (T803)** | si el mapeo apunta a una cuenta de naturaleza equivocada para el rol, **avisa con el tipo esperado** y **permite guardar** | al crear/editar un mapeo |
| **Cuenta sugerida (T815)** | sugiere la cuenta de buena práctica para el rol, con su razón | al crear/editar un mapeo |
| **Origen del rol (T816/T817)** | dice si la cuenta es **de documento** o **de artículo**, y en este caso que el mapeo es **respaldo** | fila del mapeo |
| **Ayuda por rol (T817)** | «Cuándo se usa · Dónde aparece» | fila del mapeo |

**Ninguno de estos avisos bloquea salvo el primero.** La razón: la decisión de plan de cuentas es del
negocio; el sistema informa, no sustituye al contador.

---

## 6. Errores típicos, con su síntoma

Los cinco salieron de medir asientos reales en este repositorio; sirven de catálogo de síntomas.

| Síntoma | Causa | Cómo se corrige |
|---|---|---|
| La **reserva** acredita **Costo de Ventas** en vez de Ingresos | la entrega arrastra su cuenta de **costo** en el dato de la línea y el motor la usaba como ingreso | el motor ya ignora una cuenta capturada cuya naturaleza no corresponde (T803); la causa de fondo es la cuenta del artículo en el nivel equivocado |
| La **reserva** no lleva **IVA** | el indicador fiscal del documento base se perdía porque otra rama lo reemplazaba | corregido (T804); si vuelve a verse, revisar el **indicador fiscal del artículo** y del socio |
| Un **sobrante de ajuste** va contra **Proveedores** | la contrapartida se leyó de un nivel del artículo que tiene una cuenta de proveedores | corregir `inventoryOffsetAccountId` **en el nivel que el artículo declara** |
| Los **ajustes** caen en **Costo de Ventas** | contrapartidas de inventario apuntando a la cuenta de costo de ventas | usar las cuentas propias: «Compensación de Inventario» y «Mermas y Desperdicios» |
| Un **mapeo** no cambia nada | el rol es **de artículo**: el mapeo es solo respaldo | configurar en el artículo/grupo/almacén |

**Y una falsa alarma que conviene conocer**: en una **NC de venta** el IVA se revierte contra una
cuenta de **IVA — Crédito Fiscal** y no contra el débito. **No es un error**: es la convención
boliviana (la NC **resta** del impuesto del período, y se separa en su propia cuenta). La posición
neta de IVA es la diferencia entre ambas. **Antes de acusar a una cuenta de estar mal, lea por qué
está ahí.**

---

## 7. Checklist de cierre

- [ ] Todas las cuentas del plan tienen su **naturaleza** correcta.
- [ ] Año fiscal abierto y períodos que cubren las fechas de operación.
- [ ] Mapeos de **documento** completos (banco, caja, IVA débito, IVA crédito, redondeos).
- [ ] Socios con sus cuentas por cobrar / pagar.
- [ ] Cada artículo tiene **«Fijar Cuenta de Mayor según»** decidido a conciencia.
- [ ] En el nivel declarado, **están** las cuentas de `INVENTORY`, `COGS`, `SALES_REVENUE`,
      `INVENTORY_OFFSET` e `INVENTORY_OFFSET_EXIT`.
- [ ] La **matriz artículo-almacén** está cargada para los pares que se van a operar (o se acepta
      conscientemente el respaldo del maestro).
- [ ] Los siete documentos de la **prueba de humo** se emitieron y **se leyó su asiento**.
- [ ] Ningún asiento de la prueba tiene cuentas de «relleno» ni de naturaleza inesperada **sin
      explicación documentada**.

---

## Anexo — Cuentas usadas en los flujos verificados de este tenant

Sirve como referencia de un plan real (códigos de `erp_db`), no como obligación:

| Uso | Cuenta |
|---|---|
| Clientes | `1.1.2.01.001` Clientes Nacionales |
| Proveedores | `2.1.1.01.001` Proveedores Nacionales |
| Inventario | `1.1.3.01.001` Mercaderías para la Venta |
| Costo de ventas | `5.1.1.01.001` Costo de Ventas |
| Ingreso por ventas | `4.1.1.01.001` Ventas de Mercadería |
| IVA débito | `2.1.2.01.001` IVA Débito Fiscal |
| IVA crédito | `1.1.6.01.001` IVA — Crédito Fiscal |
| Ajustes de inventario | `5.1.2.01.001` Compensación de Inventario |
| Mermas | `5.1.2.01.004` Mermas y Desperdicios |
| Caja | `1.1.1.01.001` Caja Moneda Nacional |
| GRIR | `2.1.4.02.001` Mercancías Recibidas no Facturadas |
| IT (impuesto a las transacciones) | `6.1.4.01.001` / `2.1.2.01.003` IT por Pagar |
