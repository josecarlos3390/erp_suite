# Plan — Cuentas contables visibles y editables en las líneas

> **Estado:** propuesto el **2026-09-21** (petición del usuario). **P1–P5 implementadas** (P1 Revalorización T163; P2 inventario, P3 comerciales y P5 gates en T164; P4 producción/ensamblaje/precio de entrega en T165).
> Origen: al revisar la **Revalorización de artículos** el usuario observó que el formulario **no muestra** las cuentas del
> ajuste (positivo/negativo) y pidió que, en **todos los formularios que generan asientos contables**, la cuenta se
> **vea** en la línea, se **proponga** desde la parametrización contable y se pueda **cambiar a mano**.
>
> **Corrección medida (2026-09-21, al abrir P2):** la tabla §1 de este plan decía «cero usos de `acctCode` en `src/app`»
> y era **falso**: la celda de cuenta **ya existía** en **12 formularios** (inventario ×4, facturas de venta y compra,
> NC/ND de venta y compra, entregas, recepciones, devoluciones de venta y compra) con `app-account-selector` editable y
> el payload ya enviaba `acctCode`, y el motor ya la prefería en los builders de inventario, ventas y compras. Lo que
> **de verdad** faltaba era: (a) la **precarga** de la propuesta (solo la tenían 3 de las 4 grillas de inventario),
> (b) la **visibilidad por defecto** (los 8 formularios comerciales declaran la columna `hidden: true`, que es
> exactamente el «no veo el campo» que el usuario reportó), (c) la **validación** de la cuenta capturada (el motor la
> escribe sin comprobar que sea imputable, activa y del tenant) y (d) **evidencia**: cero tests medían que la cuenta
> capturada llegara al asiento.


---

## 1. Qué existe hoy (auditoría medida, 2026-09-21)

| Capa | Estado real |
|---|---|
| **Determinación de cuentas** | `AccountDeterminationService.resolveAccount(tx, tenantId, entryType, {documentType, itemId, warehouseId, …})` resuelve por jerarquía: **matriz artículo-almacén → artículo → grupo → almacén → `AccountMapping`**. Es lo que usan los 8 builders del motor (`src/common/accounting/*.journal-builder.ts`). |
| **Preview desde el cliente** | **Ya existe** el endpoint genérico `GET /account-mappings/resolve?documentType&entryType&itemId&warehouseId` (`account-mappings.controller.ts:67`), que llama a la **misma** determinación y devuelve `{ accountId }` (o `null` si no resuelve). No hay que crear un endpoint por familia. |
| **Modelo Prisma** | **16 columnas `acctCode`** repartidas en las líneas de documentos (ventas, compras, stock, entrega, etc.). Es el «código de cuenta de la línea» que el motor usa como **override**. |
| **DTOs del backend** | `BaseLineItemDto` (`src/common/dto/base-line-item.dto.ts:36`) ya declara `acctCode?: number \| null`, y lo heredan: `commercial-line-item` (ventas/compras), `create-stock-entry`, `create-stock-exit`, `create-stock-transfer`, `create-stock-adjustment`. Las líneas de **producción**, **revalorización**, **precio de entrega**, **ensamblaje** y **activos fijos** **no** lo declaran. |
| **Builders** | `inventory.journal-builder.ts` ya respeta el override: `line.acctCode ?? (await this.det.resolveAccount(…))` (líneas 80-86). Los demás builders (ventas, compras, producción, revalorización, precio de entrega, pagos) **resuelven siempre** y **descartan** cualquier cuenta capturada. |
| **Frontend** | **La celda ya existe en 12 formularios** (2026-09-21): inventario ×4 (`stock-entries`, `stock-exits`, `stock-adjustments`, `stock-transfers`), ventas (`sale-invoices`, `sales-credit-notes`, `sales-returns`, `delivery-orders`) y compras (`purchase-invoices`, `purchase-credit-notes`, `purchase-returns`, `purchase-receipts`): cada uno declara la columna `manualAccount` y una celda con `app-account-selector` + `[formControl]="row.get('acctCode')"`, y el payload envía `acctCode`. **Lo que falta**: los 8 comerciales la declaran `hidden: true` (no se ve sin abrir el selector de columnas) y **ninguno** de los 8 comerciales **precarga** la propuesta; en inventario precargaban 3 de 4 (faltaba `stock-transfers`, que además era un **no-op**: su motor ignora `acctCode`). |
| **Formularios que hoy SÍ capturan cuentas** | Asiento contable manual (líneas con `accountId`), Cobros y Pagos (líneas de cuenta con `accountId` + `costCenterId`), Precio de Entrega (los gastos son las patas del haber: `accountId` obligatorio por línea) y la Revalorización (cuentas del ajuste, P1). |
| **Sin captura por línea (medido)** | **Producción** (emisión, recibo, partes: el DTO no declara `acctCode` y el builder siempre resuelve), **ensamblaje** (kit y componentes), **activos fijos** y **tomas de inventario** (no generan asiento por línea: la toma produce ajustes). |

**Conclusión de la auditoría (corregida al abrir P2):** el *override* **ya está** en el motor, en los DTOs y en la
interfaz de 12 formularios; lo que falta es (a) **precargar** la propuesta donde no la hay y **hacerla visible por
defecto**, (b) **validar** la cuenta capturada —hoy el motor la escribe sin comprobarla— y (c) **evidenciar** con tests
que la cuenta capturada manda en el asiento. La Revalorización fue el caso más visible porque su modelo tiene dos
columnas por línea (`increaseAccountId`/`decreaseAccountId`) que la pantalla no dejaba tocar.

---

## 2. Diseño propuesto

### 2.1 Backend

1. **Campo de override por línea** con el mismo nombre que ya usa el repo (`acctCode`) en las familias que faltan
   (producción, revalorización, precio de entrega, ensamblaje), o el nombre específico cuando el modelo ya tiene dos
   columnas por línea (revalorización: `increaseAccountId` / `decreaseAccountId`, una por signo).
2. **Preferencia del capturado sobre la determinación** en cada builder: `line.acctCode ?? resolveAccount(...)`
   (el patrón que ya usa inventario), sin tocar la jerarquía cuando la línea **no** trae cuenta.
3. **Validación de la cuenta capturada** (una sola vez, compartida): existe, es del tenant, es **de detalle**
   (no agrupadora), está **activa** y no bloqueada; mensaje accionable con la línea en el texto.
4. **Sin cambio de contrato**: el campo es **opcional**; omitirlo deja el comportamiento actual (determinación).
5. La cuenta capturada se **persiste** en la línea del documento (columna que ya existe en 16 tablas; en las familias
   que no la tengan, se evalúa migración idempotente).

### 2.2 Frontend

1. **Componente compartido de celda**: `app-account-selector` (ya existe en `shared/account-selector`) dentro de una
   celda de grilla, con `[compact]="true"`, `readonly` en modo ver y **ariaLabel** «Cuenta contable».
2. **Propuesta por defecto**: al completar lo que la determinación necesita (artículo + almacén, o el tipo de línea),
   la celda pide `GET /account-mappings/resolve` con el `entryType` de esa familia y **precarga** la cuenta; un
   *placeholder* explica que, si se deja vacío, se usará la cuenta de la configuración.
3. **Editable y visible**: la cuenta se pinta en la grilla (columna nueva u oculta por el selector de columnas), se
   puede cambiar y la pantalla avisa cuando **difiere** de la propuesta («cuenta manual»).
4. **Un solo helper** (`accountProposal`) reutilizado por todas las pantallas, para que el `entryType` y el contexto de
   cada familia vivan en un sitio.

---

## 3. Fases propuestas

| Fase | Alcance | Backend | Frontend |
|---|---|---|---|
| **P1 (hecha)** | **Revalorización**: cuenta de **aumento** y de **disminución** visibles y editables por línea, precargadas desde la determinación | DTO + servicio (preferir capturada, validar) | Dos columnas con `app-account-selector` + precarga + panel de resumen |
| **P2 (hecha)** | **Inventario**: entradas, salidas y ajustes con la cuenta visible, precargada y validada; **traspasos** sin celda (excepción declarada) | validador **compartido** (`assertCapturedAccounts`) en las 3 familias | precarga con re-propuesta al cambiar almacén/signo + marca «manual» |
| **P3** | **Comerciales**: facturas de venta/compra, sus F. Reserva, NC/ND, entregas y recepciones (DTO y motor ya lo soportan) | validar el `acctCode` de la línea en cada familia | **hacer visible** la columna (hoy `hidden: true`) + precarga por familia + marca «manual» |
| **P4** | **Familias sin override**: producción (emisión y recibo) y ensamblaje (kit y componentes) | campo en el DTO + preferencia en el builder + validación | Columna «Cuenta» en las grillas de líneas |
| **P5** | **Cierre del frente**: auditoría de que **todo** builder prefiere lo capturado, guardarraíl de CI y documentación | test que recorre los builders | `audit` de plantillas: toda grilla de documento con asiento expone la columna |

**Criterios de aceptación por fase**
- La cuenta se **ve** en la línea (no solo en un resumen), con su propuesta precargada.
- Cambiarla **manda** en el asiento (evidencia: el asiento del documento lleva la cuenta capturada, no la de la configuración).
- Dejarla vacía mantiene el comportamiento actual (determinación por jerarquía) y el documento contabiliza igual.
- Una cuenta inválida (agrupadora, de otro tenant, inactiva) se **rechaza con 400 accionable** y no contabiliza nada.
- Gates: build/lint/tsc, jest (unit + E2E de la familia), Karma, `e2e:functional` y `e2e:visual` (la grilla cambia: se
  regeneran los baselines afectados **con atribución medida**).

### Estado de P3 (Comerciales, 2026-09-21) — **implementada**

- **Hallazgo de la auditoría**: la celda **ya existía** en las 8 grillas comerciales, pero todas declaraban la columna
  `hidden: true` (**la cuenta existía y no se veía**: el defecto que reportó el usuario) y **ninguna precargaba**.
- **Cableado compartido**: `CommercialDocumentFormBase` gana el hook `capturedAccountContext(item?)` —que cada familia
  overridea con el par `documentType`/`entryType` que su builder usa— y propone desde `applyDefaultUom` (el hook que
  todos los formularios ya invocan al elegir el artículo), vuelve a proponer al cambiar el almacén de cabecera y siembra
  la propuesta al hidratar un borrador. Pares por familia (medidos en `sales.journal-builder.ts` /
  `purchases.journal-builder.ts`): `SALE_INVOICE`/`SALES_REVENUE` (factura de venta y su F. Reserva),
  `DELIVERY_ORDER`/`COGS`, `SALES_CREDIT_NOTE`/`SALES_CREDIT`, `SALES_RETURN`/`SALES_RETURN`,
  `PURCHASE_INVOICE`/`INVENTORY` o `PURCHASES` **según si el artículo maneja inventario** (el motor elige la cuenta por
  el flujo), `PURCHASE_INVOICE`/`ALLOCATION` o `PURCHASES` en su F. Reserva, `PURCHASE_RECEIPT`/`INVENTORY`,
  `PURCHASE_CREDIT_NOTE`/`PURCHASE_CREDIT` y `PURCHASE_RETURN`/`PURCHASE_RETURN`.
- **F. Reserva**: además de la celda, se cableó el control `acctCode` en los builders de línea de los dos formularios, en
  sus payloads de guardado y en el mapeo de `createFromReceipt` (que lo descartaba): sin eso la celda se ataba a `null`.
- **Backend**: el validador compartido entró en **43 altas** de 9 servicios comerciales (facturas de venta y compra,
  entregas, recepciones, NC y devoluciones de venta y compra y las dos F. Reserva, que delegan en los servicios
  unificados). `sales-debit-notes` y `purchase-debit-notes` **no aplican**: son documentos de cabecera, sin líneas ni
  `acctCode`. El POS queda fuera (no expone la celda) y está declarado en el gate.
- **Evidencia**: `test/line-account-override.e2e-spec.ts` **13/13** (7 familias miden que la capturada manda en el mayor
  y la determinada no aparece; agrupadora/inexistente/inactiva → 400 atómico) y los unitarios de los servicios tocados
  **16 suites / 95 tests**, con 3 tests nuevos por formulario en Karma.

### Estado de P4 (Producción, ensamblaje y Precio de Entrega, 2026-09-21) — **implementada**

- **Esquema**: `acctCode` por línea en `ProductionIssueItem`, `ProductionReceiptItem`, `AssemblyOrderItem` (y en
  `AssemblyOrder` para la pata del kit del asiento de ensamblaje), con su relación a `Account`, en la migración
  `20260921120000_line_account_overrides` (idempotente, generada con `migrate diff` porque `migrate dev` aborta por el
  drift conocido).
- **Motor**: la emisión prefiere la cuenta capturada para el **haber** de inventario (el **debe sigue siendo el WIP** del
  artículo de la orden); el recibo la prefiere para la cuenta de destino —inventario del PT/subproducto o **mermas** según
  `lineType`— y el ensamblaje para el inventario del kit y de cada componente. El **Precio de Entrega** entra al validador
  compartido con la etiqueta «cuenta del gasto».
- **Límites declarados**: (1) los **partes de horas** no capturan cuenta (la de cada componente de costo viene del maestro
  del recurso); (2) la **orden de ensamblaje no tiene grilla de líneas editable** (sólo la tabla de solo lectura de los
  componentes de la receta y el modal de lote/serie), así que capturar la cuenta por componente exige una superficie
  nueva: el backend acepta el `acctCode` por línea y la interfaz queda como excepción razonada en el gate del frontend.
- **Evidencia**: unitarios nuevos en emisión, recibo, ensamblaje y Precio de Entrega (rechazo de la agrupadora sin abrir
  transacción + la capturada viajando al motor) y E2E de las tres suites (**+6 pruebas**: la capturada manda en el mayor
  y la agrupadora se rechaza sin documento).

### Estado de P5 (Cierre: gates, 2026-09-21) — **implementada**

- **Dos gates nuevos** `npm run audit:line-accounts`, con autoprueba y paso en los dos `ci.yml`:
  - **frontend**: para cada familia del registro exige **columna sin `hidden`**, **celda con `app-account-selector`** y
    **cableado de la propuesta**; falla si un formulario declara la columna sin entrar al registro (**18 familias: 16 con
    cuenta en la línea y 2 excepciones razonadas** —traspaso de stock y orden de ensamblaje—, autoprueba **9/9**);
  - **backend**: para cada familia exige que el **servicio valide** (`assertCapturedAccounts`) y que el **builder
    prefiera** lo capturado, más dos coberturas (un builder o un servicio que capture la cuenta sin estar registrado es un
    hallazgo, salvo excepción declarada: **18 familias**, autoprueba **6/6**).
- **Comportamiento**: la prueba de que la cuenta capturada manda en el asiento vive en
  `test/line-account-override.e2e-spec.ts` (**13/13**), que corre en el job E2E del backend.

### Estado de P2 (Inventario, 2026-09-21) — **implementada**

**Decisiones del usuario (2026-09-21):** (1) **Traspasos**: quitar la columna y **declarar la excepción** —sus dos patas
son la cuenta de INVENTARIO del almacén origen y destino, resueltas por la jerarquía artículo-almacén, y no hay cuenta
de contrapartida que capturar, así que la celda era un no-op—; (2) **Producción (P4)**: se podrá cambiar la **cuenta
propia de cada línea** (el inventario que se acredita en la emisión, el inventario del PT/subproducto o la cuenta de
mermas en el recibo) y el **WIP sigue resolviéndose por el artículo de la orden**; (3) **Ensamblaje (P4)**: sí, con la
cuenta de inventario editable por línea (kit y componentes).

- **Backend**: validador **compartido** `assertCapturedAccounts` (`src/common/captured-account.util.ts`) —existe en el
  tenant, activa, no bloqueada y **de detalle**— invocado **antes** de la transacción en `stock-entries`, `stock-exits` y
  `stock-adjustments` (la Revalorización pasó a usarlo también: una sola regla y un solo mensaje). El motor ya prefería
  `line.acctCode` en las tres familias; ahora el 400 nombra la línea y la cuenta.
- **Frontend**: `AccountMappingResolutionService` gana el modo **propuesta** (`proposeAccount`): escribe la cuenta del
  motor **solo si la línea no trae una puesta a mano**, devuelve `manual: true` cuando la conserva y la celda lo pinta con
  el badge **«manual»**; `seedProposal` marca la cuenta que vino del documento para que un documento guardado no se
  marque como manual. Las tres grillas vuelven a proponer cuando cambia el **almacén** (y el ajuste también cuando cambia
  el **signo**, que elige entre `INVENTORY_OFFSET` y `INVENTORY_OFFSET_EXIT`). En `stock-transfers` se retiró la columna,
  la celda, los controles y el `acctCode` del payload (y con ellos la carga de cuentas que ya no se usaba).
- **Evidencia**: `test/line-account-override.e2e-spec.ts` **8/8** (la capturada manda en entrada, salida y ajuste y la de
  la configuración **no aparece** en el asiento; sin captura el asiento usa la determinación —control—; agrupadora,
  inexistente/ajena e inactiva → **400** con el stock, el kardex y el asiento intactos; y la cuenta queda **persistida**
  en la línea y publicada por el detalle).
- **Límite declarado**: la propuesta se pide al elegir el artículo y al cambiar el almacén/signo, **no** en cada tecla ni
  al cambiar el artículo de una línea que ya tenía cuenta manual (ahí manda la manual, que es lo que el usuario pidió).

### Estado de P1 (Revalorización, 2026-09-21) — **implementada**

- **Backend**: `increaseAccountId` / `decreaseAccountId` por línea en el DTO de alta; validación compartida
  (`assertCapturedAccounts`: existe en el tenant, activa, no bloqueada y **de detalle**) **antes** de la transacción;
  el builder del asiento prefiere la capturada (`StockRevaluationJournalLine` la transporta) y solo resuelve por
  jerarquía cuando no viene.
- **Frontend**: dos columnas en la grilla (**Cuenta ajuste (+)** y **Cuenta ajuste (−)**) con `app-account-selector`
  editable, **precargadas** desde la determinación real (`GET /account-mappings/resolve`, vía
  `AccountMappingResolutionService`, que ahora acepta el control de destino) y con la marca **«aplica»** según el signo
  del ajuste calculado en vivo; el payload envía las cuentas y el pie sigue publicándolas.
- **Evidencia**: 4 unitarios del servicio + 2 E2E nuevos (`test/stock-revaluations.e2e-spec.ts` **19/19**, con la
  atomicidad del rechazo medida) + 4 unitarios del formulario; **Karma 1931/1931**, `e2e:visual` **53/53 sin PNG
  modificados** y el E2E de UI de la Revalorización **5/5**.

---

## 4. Límites y riesgos declarados

1. **La propuesta es informativa**: la precarga es la cuenta que el motor usaría en ese momento; si el usuario cambia el
   artículo/almacén después, la celda vuelve a proponer (y avisa si había una cuenta manual).
2. **Override ≠ reclasificación**: la cuenta capturada no «mapea» el documento a otra cuenta de contrapartida; cambia
   **esa** pata. El resto del asiento sigue resolviéndose por jerarquía.
3. **Familias con asiento derivado** (p. ej. el cierre de producción, que liquida contra la cuenta de variación del
   artículo): ahí la cuenta no es «de la línea» sino del documento; se decide por familia y se documenta.
4. **Rendimiento**: la precarga se pide **por línea** cuando cambia su contexto, con *debounce* y caché por
   `(documentType, entryType, itemId, warehouseId)`; no bloquea el guardado.
