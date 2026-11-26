# Política de lotes y costos: dónde vive cada regla

> **Qué es este documento y por qué existe.** Nació de una **lista equivocada**: en la sesión del
> 2026-11-26 se presentaron cinco «decisiones pendientes» (T972, T973, T976, T982 y la liquidación de
> comisiones) que en realidad **no estaban abiertas**: las cuatro primeras se habían **cerrado** con
> su defecto resuelto y su medición. El error vino de leer una **búsqueda de texto** en el ledger y
> confundir la **narrativa** de una fila cerrada («estaba pendiente de decisión… se decidió X») con
> su **estado**.
>
> **La corrección se escribe** (regla de la casa). Y lo que sigue es lo que **de verdad** hay, con
> dónde vive cada regla, para que la pregunta «¿qué hace el sistema con un lote vencido?» se
> responda **leyendo el código en un sitio** en vez de creyendo una lista.

---

## 1. El vencimiento **avisa**, y es el criterio de selección — **T972 (cerrado)**

**La decisión del usuario, que es la del mercado**: el vencimiento **NO es obligatorio** al registrar
el lote —un artículo sin caducidad no lo es— pero, cuando existe, **manda**: la alerta de
vencimientos avisa con **30 días** y el orden de selección es por vencimiento.

**Dónde vive**: `src/alerts/alerts.service.ts` (la alerta con su ventana) y el criterio del motor de
selección de §2. Referencia de mercado: **Odoo** (el uso de fechas de caducidad es opcional por
artículo; si está, gobierna) y **SAP B1** (el lote caduca y se ve en el informe).

## 2. **FEFO es un motor**, no la copia de un documento — **T973 (cerrado)**

**Lo que estaba mal**: el orden FEFO (`expiryDate asc`, `createdAt asc`, 5 candidatos) vivía
**dentro de `assembly-orders`** y cada documento hacía su versión. Ahora es **un motor** que todos
consumen.

**Dónde vive**: **`src/common/batch-selection.util.ts`** — el comparador `comparadorFefo` y el
sugeridor `sugerirLotesFefo` (que **no ofrece el vencido**: ése lo filtra la política de §3)—, con
su spec `batch-selection.util.spec.ts` marcada `fixture-medido: T973`. Es la misma regla de la casa
que el resto de los motores: **ninguna pantalla ni servicio replican la fórmula**.

## 3. Un lote **VENCIDO no sale**, salvo autorización explícita — **T974 (cerrado)**

**El hueco, medido**: T972 avisaba y T973 ordenaba la selección, pero **nadie impedía vender** un
lote vencido: `validateDocumentLineTracking` validaba existencia y pertenencia y **no miraba
`expiryDate`**.

**La regla, implementada** en `src/common/document-stock.helper.ts` (**una vez**, para todos los
documentos):
1. **Solo en salida** (`options.mode === 'outgoing'`): una **entrada** o una **devolución** de un
   lote vencido es legítima y **no** se bloquea.
2. **Solo si el lote tiene `expiryDate`**: sin caducidad no es perecedero y no se bloquea nunca.
3. La comparación es contra el **«hoy» del TENANT** (`startOfTenantDay` con `settings.timeZone`),
   no el del proceso —la trampa que ya mordió en esta casa—.
4. El bloqueo es un **400 que dice el lote, la fecha y cómo proceder** (elegir otro lote, mirar el
   informe «Lotes por vencer», o activar la autorización).
5. La autorización es el ajuste **`allowExpiredBatchIssue`** (Configuración > Inventario), y cuando
   se usa **queda rastro en el log** del servidor (`logger.warn`): la excepción es deliberada y
   auditable, no silenciosa.

Referencia de mercado: el **estado de lote** de **SAP B1** (`Released` / `Not accessible`) y la
validación de lote vencido de **Odoo**.

**La salida legítima de un lote vencido** —devolverlo al proveedor o darlo de baja— **no** se
bloquea: son entradas y bajas, no ventas. Si alguna vez se bloqueara, el stock muerto se quedaría
en el sistema, que es peor que el problema que se quería evitar.

## 4. **Coste teórico** del artículo — **T976 (cerrado)**

**Lo que se cerró** no fue «congelar el costo estándar» sino algo más útil: **el «cuánto debería
costar hoy»** del artículo, con **explosión multinivel**, merma y tarifas. Es el coste **teórico**
(el que sale de la receta y los costos de sus componentes), separado del **real** que mueven los
documentos.

**Por qué importa la distinción**: el coste real (promedio/FIFO) **se mueve con los documentos**; el
teórico es la **referencia** contra la que se compara. Mezclarlos haría que una compra cara
«cambiara la receta».

## 5. El almacén nuevo **hereda o bloquea**, no nace vacío — **T982 (cerrado)**

**El defecto**: un almacén creado por pantalla nacía con la fila **vacía** de configuración y, desde
T959, **una fila vacía no hereda: bloquea**. El traspaso `ALM-01` → `ALM-SUC-02` respondía **400**.
Se arregló la **siembra**.

*(Era la fila que yo había rotulado «nivel de determinación de cuentas»: **no era eso**.)*

---

## Lo único que **sí** está abierto: liquidar las comisiones (F3.2 de T980)

El devengo está hecho (asiento `COM-AAAA-MM`: `Dr Comisiones sobre Ventas` / `Cr Comisiones por
Pagar`, una línea por vendedor, cuentas **del mapeo**). Lo que falta es **pagar**.

**La decisión, con la práctica del mercado**: **nómina por defecto**, y **socio solo si el vendedor
es externo**.
- **SAP B1** paga la comisión del **empleado** por **nómina** (no toca el subledger de socios).
- **Odoo** genera una **factura de proveedor al agente**, porque allí el agente **es** un `Partner`.
- **NetSuite** tiene un **pago de comisión** propio.

En este ERP el vendedor es un **`User`**, no un `Partner`: meterlo en el subledger de CxP exigiría
**duplicar su identidad** y arrastraría conciliación de socios, antigüedad de saldos y retenciones
de un tercero que **no lo es**. Cuando haga falta pagar a un **agente externo**, la pieza correcta
es un vendedor socio (`User.linkedPartnerId`) y **entonces** el pago es un egreso normal.

**Implica hoy**: el pasivo ya queda acumulado por vendedor. **Nada que implementar** hasta que se
decida pagar; cuando se decida, la forma es **nómina** y el caso externo **exige el campo**.
