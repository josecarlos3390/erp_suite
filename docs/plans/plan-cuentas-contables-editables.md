# Plan — Cuentas contables visibles y editables en las líneas

> **Estado:** propuesto el **2026-09-21** (petición del usuario). **P1 implementada** (Revalorización, AUDIT **T163**);
> **P2–P5 pendientes de aprobación**.
> Origen: al revisar la **Revalorización de artículos** el usuario observó que el formulario **no muestra** las cuentas del
> ajuste (positivo/negativo) y pidió que, en **todos los formularios que generan asientos contables**, la cuenta se
> **vea** en la línea, se **proponga** desde la parametrización contable y se pueda **cambiar a mano**.

---

## 1. Qué existe hoy (auditoría medida, 2026-09-21)

| Capa | Estado real |
|---|---|
| **Determinación de cuentas** | `AccountDeterminationService.resolveAccount(tx, tenantId, entryType, {documentType, itemId, warehouseId, …})` resuelve por jerarquía: **matriz artículo-almacén → artículo → grupo → almacén → `AccountMapping`**. Es lo que usan los 8 builders del motor (`src/common/accounting/*.journal-builder.ts`). |
| **Preview desde el cliente** | **Ya existe** el endpoint genérico `GET /account-mappings/resolve?documentType&entryType&itemId&warehouseId` (`account-mappings.controller.ts:67`), que llama a la **misma** determinación y devuelve `{ accountId }` (o `null` si no resuelve). No hay que crear un endpoint por familia. |
| **Modelo Prisma** | **16 columnas `acctCode`** repartidas en las líneas de documentos (ventas, compras, stock, entrega, etc.). Es el «código de cuenta de la línea» que el motor usa como **override**. |
| **DTOs del backend** | `BaseLineItemDto` (`src/common/dto/base-line-item.dto.ts:36`) ya declara `acctCode?: number \| null`, y lo heredan: `commercial-line-item` (ventas/compras), `create-stock-entry`, `create-stock-exit`, `create-stock-transfer`, `create-stock-adjustment`. Las líneas de **producción**, **revalorización**, **precio de entrega**, **ensamblaje** y **activos fijos** **no** lo declaran. |
| **Builders** | `inventory.journal-builder.ts` ya respeta el override: `line.acctCode ?? (await this.det.resolveAccount(…))` (líneas 80-86). Los demás builders (ventas, compras, producción, revalorización, precio de entrega, pagos) **resuelven siempre** y **descartan** cualquier cuenta capturada. |
| **Frontend** | **Cero usos de `acctCode`** en `src/app` (solo aparece en el `prisma-types.ts` generado): **ninguna pantalla muestra ni envía** la cuenta de la línea. La Revalorización **sí** pinta las cuentas resueltas, pero **en solo lectura** y fuera de la grilla (`increaseAccountLabel`/`decreaseAccountLabel`). |
| **Formularios que hoy SÍ capturan cuentas** | Asiento contable manual (líneas con `accountId`), Cobros y Pagos (líneas de cuenta con `accountId` + `costCenterId`), Revalorización (solo lectura) y Precio de Entrega (gastos con cuenta propuesta). |

**Conclusión de la auditoría:** la capacidad de *override* **ya está en el motor y en los DTOs** para las familias de
inventario y comerciales; lo que falta es (a) **exponerla en la interfaz** y (b) **añadirla** a las familias cuyas líneas
no declaran `acctCode` y cuyos builders la ignoran. La Revalorización es el caso más visible porque su modelo ya tiene
columnas por línea (`increaseAccountId`/`decreaseAccountId`) que la pantalla no deja tocar.

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
| **P1 (esta ronda)** | **Revalorización**: cuenta de **aumento** y de **disminución** visibles y editables por línea, precargadas desde la determinación | DTO + servicio (preferir capturada, validar) | Dos columnas con `app-account-selector` + precarga + panel de resumen || **P2** | **Inventario**: entradas, salidas, traspasos y ajustes (el motor **ya** respeta `acctCode`; falta la interfaz) | ninguno (ya está) | Columna «Cuenta» en las 4 grillas + precarga |
| **P3** | **Comerciales**: facturas de venta/compra, sus F. Reserva, NC/ND, entregas y recepciones (DTO y motor ya lo soportan) | validar que el `acctCode` de la línea llega al builder en cada familia | Columna «Cuenta» en las grillas + precarga |
| **P4** | **Familias sin override**: producción (emisión, recibo, partes), precio de entrega y ensamblaje | campo en el DTO + preferencia en el builder + validación | Columna «Cuenta» donde el documento resuelve cuentas por línea |
| **P5** | **Cierre del frente**: auditoría de que **todo** builder prefiere lo capturado, guardarraíl de CI y documentación | test que recorre los builders | `audit` de plantillas: toda grilla de documento con asiento expone la columna |

**Criterios de aceptación por fase**
- La cuenta se **ve** en la línea (no solo en un resumen), con su propuesta precargada.
- Cambiarla **manda** en el asiento (evidencia: el asiento del documento lleva la cuenta capturada, no la de la configuración).
- Dejarla vacía mantiene el comportamiento actual (determinación por jerarquía) y el documento contabiliza igual.
- Una cuenta inválida (agrupadora, de otro tenant, inactiva) se **rechaza con 400 accionable** y no contabiliza nada.
- Gates: build/lint/tsc, jest (unit + E2E de la familia), Karma, `e2e:functional` y `e2e:visual` (la grilla cambia: se
  regeneran los baselines afectados **con atribución medida**).

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
