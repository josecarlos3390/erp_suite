# Plan — G1 «Precio de Entrega» (Landed Cost / costeo de importación)

> **Estado:** **F1 (backend) IMPLEMENTADA Y VERIFICADA (2026-09-17)** — F2 (frontend) en curso.
> **Origen:** `docs/plans/plan-gaps-deuda-2026-09.md` §G1 (prioridad ALTA) y petición del usuario:
> el documento se relaciona con la **Recepción de Mercadería** («Copiar a → Precio de Entrega»),
> **consolida los gastos adicionales de importación** (normalmente facturas de compra de gastos) y
> los **aplica al costo del producto**, agrupados por **Proyecto** (código de importación).
> **Referencia funcional:** SAP Business One (Landed Costs + Expense Codes), adaptado a este ERP.

---

## 1. Qué es (y qué no es)

**Es** el documento que **capitaliza** los gastos de una importación en el costo de las mercancías
recibidas. Convierte gastos que hoy quedan como gasto del período (flete, seguro, aduana, despacho,
agente) en **costo del inventario** (y en **costo de ventas** de lo que ya se vendió), que es lo que
exige el costeo de importación.

**No es**:

- un documento de stock (no mueve cantidades);
- una factura de compra (los gastos **ya** están registrados en sus facturas; este documento los
  **aplica** al inventario, no los vuelve a registrar);
- un documento contable suelto: nace de una **Recepción** y su encabezado se agrupa por
  **Proyecto** (el «código de importación»).

## 2. Flujo de usuario (extremo a extremo)

1. **Pedido de compra** de importación con `projectId` = código de importación.
2. **Recepción de mercadería** (mismo proyecto). Nace el inventario al costo de compra.
3. Se registran los **gastos** como **Facturas de Compra** con el **mismo proyecto** (flete,
   seguro, aduana, despacho…), con su línea de cuenta de gasto (`acctCode`) o su artículo de
   servicio.
4. Desde la recepción: **Copiar a → Precio de Entrega**. Se crea el documento en **BORRADOR** con
   las líneas del artículo de la recepción (cantidad, peso y volumen para repartir) y el encabezado
   heredado (proyecto, proveedor, almacén, sucursal, moneda, fecha).
5. En el documento: **«Cargar gastos del proyecto»** trae las líneas de gasto de las facturas de
   ese proyecto (importe de la línea y su **importe en moneda base**, que es el que se contabilizó),
   evitando las que ya están aplicadas en otro Precio de Entrega. También se pueden **agregar líneas
   manuales** (un gasto aún sin factura).
6. Cada **línea de gasto** lleva: **tipo de gasto** (maestro, con cuenta y criterio por defecto),
   **cuenta de gasto**, importe, y **criterio de reparto**: `IGUAL` / `CANTIDAD` / `PESO` /
   `VOLUMEN` / `VALOR` (SAP B1: *Equally / Quantity / Weight / Volume / Row Total*).
7. La pantalla muestra el **reparto por línea** (base, importe asignado, costo antes → después)
   antes de aplicar.
8. **Aplicar** (una sola transacción): actualiza el costo de las líneas de la recepción, el
   `avgCost` del artículo+almacén, deja el rastro en el kardex y **contabiliza** el asiento.
9. **Anular**: reversa el asiento y devuelve el costo, con motivo obligatorio.

## 3. Decisiones de diseño (y por qué)

| Tema | Decisión | Por qué |
|---|---|---|
| Origen del documento | **Recepción** (`PURCHASE_RECEIPT`) | El usuario lo pidió así y es lo correcto: el inventario ya existe a un costo conocido. (P1: permitir también Factura de Compra como origen, como SAP B1.) |
| Agrupación | **Proyecto** (`projectId`) en cabecera y en la búsqueda de gastos | Es el «código de importación» del usuario; el ERP ya tiene `Project` y las recepciones/facturas ya lo llevan. |
| Gastos | **Líneas propias** del documento, con **traza opcional** a `PurchaseInvoiceItem` | Permite consolidar varias facturas **y** gastos manuales; la traza evita aplicar dos veces la misma línea de factura (`@@unique(tenantId, purchaseInvoiceItemId)`), igual que la idempotencia de la integración SAP. |
| Criterios de reparto | Los **5 de SAP B1**, por **línea de gasto** (no por línea de costo) | Es como funciona B1 (cada gasto se reparte con su criterio sobre todas las líneas). `PESO`/`VOLUMEN` usan `Item.purchaseWeight`/`purchaseVolume` (con `weight`/`volume` como respaldo), que ya existen en el maestro. |
| Reparto exacto | El residuo del redondeo va a la línea de **mayor base** y la suma de asignaciones **igualará al céntimo** el importe del gasto | Regla del dinero del proyecto (§8.4 `BACKEND_GUIDE`): nada de céntimos perdidos; se prueba con números. |
| Tipo de cambio | Se usa el **importe en moneda base de la línea de factura** (el que se contabilizó) para los gastos con traza; el **TC del documento** para las líneas manuales | Capitalizar exactamente lo que se contabilizó como gasto; evita diferencias artificiales. |
| Contabilización | `Dr INVENTORY (por línea de costo) / Cr cuenta de gasto (por línea de gasto)` | Mueve el gasto ya registrado al inventario. `INVENTORY` se determina con la **misma jerarquía** que la recepción (`AccountDeterminationService`). |
| Mercadería ya vendida | El importe asignado se parte entre **INVENTORY** (lo que queda en stock) y **COGS** (lo ya consumido) según la existencia al aplicar | Es el tratamiento correcto: el flete de las unidades vendidas es costo de ventas. Alternativa más simple: **bloquear** la aplicación si no está todo en stock (§11.2). |
| Estado | `DRAFT` → `APPLIED` → `CANCELLED` | El reparto se revisa antes de capitalizar; aplicar es irreversible salvo anulación. |
| Código | `PDE-000001` (`DocumentSeries` con `docType = LANDED_COST`) | Coherente con el resto de documentos; el usuario puede renombrar la serie. |
| Costo actualizado | `Stock.avgCost` (promedio ponderado sobre la existencia actual) + `PurchaseReceiptItem.unitCost/cost/totalCost` + `StockMovement` del movimiento origen | El documento de recepción pasa a mostrar su **costo final** (como B1) y el kardex queda consistente. |

## 4. Modelo de datos (Prisma)

**Nuevas tablas**

- `LandedCost` (cabecera): `tenantId`, `code`, `status`, `date`, `postingDate`, `projectId?`,
  `purchaseReceiptId` (origen), `supplierId?`, `warehouseId`, `branchId?`, `currency`,
  `exchangeRate`, `expenseTotal`, `expenseTotalBase`, `capitalizedTotal`, `cogsTotal`, `notes`,
  `transactionId?` (asiento), `documentSeriesId?`, `customFields`, auditoría
  (`createdById/At`, `updatedById/At`, `appliedById/At`, `cancelledById/At/Reason`).
  `@@unique([tenantId, code])`, `@@unique([tenantId, id])`, índices por `projectId`, `status`, `date`.
- `LandedCostExpense` (líneas de gasto): `lineNum`, `expenseTypeId?`, `accountId`,
  `description`, `amount`, `amountBase`, `currency`, `allocationMethod`,
  `purchaseInvoiceId?`, `purchaseInvoiceItemId?`, `projectCode?`, `dimension1..5?`,
  `taxIndicatorId?`, `taxAmount?`. `@@unique([tenantId, purchaseInvoiceItemId])`.
- `LandedCostItem` (líneas de costo): `lineNum`, `purchaseReceiptItemId`, `itemId`, `itemCode`,
  `warehouseId`, `quantity`, `baseValue` (la base del criterio), `allocatedAmount`,
  `allocatedToInventory`, `allocatedToCogs`, `unitCostBefore`, `unitCostIncrease`,
  `unitCostAfter`, `avgCostBefore`, `avgCostAfter`, `batchId?`.
- `LandedCostType` (maestro estilo *Expense Code*): `code`, `name`, `accountId`,
  `defaultAllocationMethod`, `status`, `isSystem`.

**Enums nuevos**: `LandedCostStatus` (`DRAFT|APPLIED|CANCELLED`), `AllocationMethod`
(`EQUAL|QUANTITY|WEIGHT|VOLUME|ROW_TOTAL`), `DocumentType.LANDED_COST`,
`JournalSourceType.LANDED_COST`, `StockMovementType.LANDED_COST`.

**Migración**: procedimiento de drift de `BACKEND_GUIDE` §4 (idempotente, `migrate diff` desde la BD
viva + `migrate resolve --applied` + `prisma generate` con el backend parado), porque la BD de
desarrollo arrastra drift.

## 5. Backend

Módulo `src/landed-costs/` (+ `src/landed-cost-types/` para el maestro):

| Endpoint | Qué hace |
|---|---|
| `GET /landed-costs` | listado paginado (búsqueda por código, proyecto, proveedor; filtro por estado) |
| `GET /landed-costs/:id` | documento con gastos, costos y trazas |
| `POST /landed-costs` | alta manual (cabecera + líneas) |
| `PATCH /landed-costs/:id` | edición (solo `DRAFT`) |
| `POST /landed-costs/from-receipt/:receiptId` | **Copiar a** desde la recepción |
| `GET /landed-costs/project-expenses?projectId=` | líneas de gasto candidatas del proyecto (facturas no anuladas, sin aplicar) |
| `POST /landed-costs/:id/apply` | aplica (costo + kardex + asiento); idempotente por estado |
| `POST /landed-costs/:id/cancel` | anula con motivo (reversa del asiento y del costo) |
| `GET/POST/PATCH/DELETE /landed-cost-types` | maestro de tipos de gasto |

**Contabilidad**: builder nuevo `inventory.journal-builder.ts#buildLandedCostJournalEntry` (o
`purchases`) + método en la fachada `AccountingEngineService` + `case` en el preview. Asiento:
`Dr INVENTORY` (por línea de costo, cuenta por jerarquía ítem/almacén) y `Dr COGS` (la parte ya
vendida, si se aprueba §11.2-a) contra `Cr` la cuenta de gasto de cada línea; doble expresión
monetaria (`debitLocal/…/creditSystem`) y validación de partida doble como el resto.

**Costos**: utilidad nueva `src/common/landed-cost.util.ts` (pura y testeable) con el reparto por
criterio + el redondeo exacto y el cálculo del nuevo `avgCost`; la persistencia usa `upsertStock`.

**Integración**: el flujo Recepción → Precio de Entrega se registra en
`docs/reference/matriz-flujos-documentos.md` y, si su detector lo requiere, en
`scripts/audit-flows.mjs`; `scripts/flow-sweep.mjs` gana un escenario
(`--only=importacion`) que opera contra la API real y comprueba costo, kardex y asiento.

## 6. Frontend

- **Listado** `/landed-costs` (patrón Luna List): código, fecha, proyecto, recepción, proveedor,
  total gastos, capitalizado, estado, acciones (ver/editar/aplicar/anular).
- **Formulario** `/landed-costs/new` y `/:id` (patrón Luna Form + `app-document-form-header` +
  `app-document-action-bar`) con dos pestañas de líneas:
  - **Gastos**: tipo de gasto, cuenta, descripción, importe, moneda, criterio, origen
    (factura nº / manual), botón **«Cargar gastos del proyecto»** y **«Agregar gasto»**.
  - **Costos**: artículo, cantidad, base del criterio, **importe asignado** (calculado, solo
    lectura en edición), costo unitario antes/después. Totalizadores: total gastos, total
    asignado, diferencia (debe ser 0).
- **«Copiar a → Precio de Entrega»** en el formulario de **Recepción de Compra** (entrada nueva del
  `app-document-copy-to-menu`, habilitada cuando la recepción está guardada y no anulada), que
  navega a `/landed-costs/new?receiptId=<id>`.
- **Maestro** de tipos de gasto en `/landed-cost-types` (Administración → Tipos de Gasto de
  Importación), con su CRUD y su entrada de menú.
- Ruta con `permissionGuard` (`landed-costs:view|create|edit|delete`) + `dirtyCheckGuard`, modelos
  y servicio tipados (sin `any`), Karma de los componentes y E2E de UI del flujo completo.

## 7. Fases

- **F1 — Backend núcleo**: schema + migración, maestro de tipos, módulo (CRUD, from-receipt,
  project-expenses, allocate, apply, cancel), motor contable, utilidad de reparto, kardex/costos,
  permisos, tests unitarios + E2E de backend, matriz de flujos y barrida operativa.
- **F2 — Frontend**: listado, formulario, menú «Copiar a» en la recepción, maestro de tipos,
  rutas/menú/permisos, Karma y E2E de UI (alta → cargar gastos → aplicar → verificar costo y
  asiento → anular).
- **F3 (P1)**: origen **Factura de Compra** (además de recepción), costeo por **lote/serie**,
  dimensiones contables por línea de gasto, import/export del maestro de tipos.
- **F4 (P2)**: informe **«Importación por proyecto»** (gastos vs capitalizado vs COGS vs existencia
  valorizada) y enganche con **G2 (revalorización)** reutilizando el mismo motor de costos.

## 8. Criterios de aceptación (medibles)

1. **Reparto exacto**: con 2 líneas y 3 gastos, para **cada** criterio, la suma de asignaciones
   iguala el importe del gasto al céntimo (el residuo cae en la línea de mayor base); un caso con
   bases 0 en todas las líneas responde `400` accionable (no `500`).
2. **Contabilidad**: el asiento cuadra (`Σ debe = Σ haber`) y `Dr INVENTORY + Dr COGS = Cr gasto`;
   con el flag de contabilidad apagado (tenant comercial) el documento se aplica **sin** asiento,
   como el resto de documentos.
3. **Costo**: `avgCost` nuevo = `(avgCost × existencia + capitalizado) / existencia` (probado con
   números); la recepción muestra el costo final en sus líneas; el kardex expone el movimiento
   `LANDED_COST`.
4. **Reversa**: anular deja el asiento original `CANCELLED` + espejo `REVERSAL`, devuelve el
   `avgCost` anterior y es idempotente (segunda anulación → `400`).
5. **Idempotencia/traza**: la misma línea de factura no se puede aplicar dos veces; re-aplicar un
   documento aplicado responde `400`.
6. **Aislamiento**: todo filtrado por `tenantId` (probado con dos tenants).
7. **UI**: E2E que recorre recepción → Copiar a → cargar gastos → aplicar → verifica costo y
   asiento → anula, con aserciones incondicionales (patrón T141).

## 9. Riesgos y límites declarados (a priori)

- **`costingMethod` distinto de `AVERAGE`**: el cálculo del §3 asume costo promedio. Para FIFO/otro
  método se bloquea con mensaje accionable (P1: capas).
- **Lotes/series**: el reparto por lote queda para F3; en P0 el costo se aplica al artículo+almacén.
- **Documento ya facturado**: el costo de la recepción puede diferir del de la factura; el
  Precio de Entrega no reajusta la factura (eso es una nota de ajuste, fuera de alcance).
- **Dimensiones contables** en las líneas de gasto: P0 copia el proyecto; las 5 dimensiones por
  línea son F3.

## 10. Estado del arte en el ERP (lo que ya existe y se reutiliza)

`Project` y `projectId` en recepciones/facturas/asientos · `Item.purchaseWeight`/`purchaseVolume` ·
`Stock.avgCost` + `StockMovement.unitCost` · `AccountDeterminationService` (jerarquía ítem/almacén) ·
`AccountingEngineService` con doble expresión y validación de partida doble · `DocumentSeries` por
`docType` + `CODE_SEQUENCES` · `app-document-copy-to-menu` (menú «Copiar a» estandarizado) ·
`luna-document-lines` (estándar de líneas) · gates de dinero (`audit:money`), flujos
(`audit:flows`) y barrida operativa (`flow-sweep.mjs`).

## 11. Decisiones que necesito antes de codificar

**Aprobadas por el usuario el 2026-09-17** (todas las recomendaciones):

1. **Gastos**: «Cargar gastos del proyecto» desde las facturas **+** líneas manuales.
2. **Mercadería ya vendida**: partir el importe entre **INVENTORY y COGS**.
3. **Maestro de tipos de gasto**: **sí** (3 tipos en el seed: FLETE, SEGURO, ADUANA).
4. **Alcance P0**: solo Recepción como origen + costo promedio.
5. **Nombre**: «Precio de Entrega», ruta `/landed-costs`, serie `PDE-000001`.

## 12. Estado de implementación (2026-09-17)

**F1 — Backend: COMPLETADA y verificada.**

| Pieza | Evidencia |
|---|---|
| Esquema + migraciones | 4 tablas (`LandedCost`, `LandedCostExpense`, `LandedCostItem`, `LandedCostType`), `LANDED_COST` en `DocumentType`/`JournalSourceType`/`StockMovementType`, enlace del kardex en `StockMovement`; migraciones idempotentes aplicadas y `migrate diff` sin diferencias (salvo el drift conocido de `_manual_migrations`) |
| Matemática del reparto | `src/common/landed-cost.util.ts` + **24 unitarios** (incluye barrido de 200 importes aleatorios: Σ asignado == importe exacto) |
| Motor contable | `landed-cost.journal-builder.ts` + `AccountingEngineService.createLandedCostJournalEntry` (+ reversa por `reverseJournalEntry`) |
| Módulo | `src/landed-costs/` (documento + maestro de tipos), 9 endpoints, permisos `landed-costs:*`, numeración por serie `PDE` |
| Semilla | 3 tipos de gasto (FLETE/SEGURO/ADUANA) + la serie `PDE` en el catálogo canónico (`DEFAULT_DOCUMENT_SERIES`, ahora 27 tipos) |
| E2E | `test/landed-costs.e2e-spec.ts`: **7 passed** (copia desde recepción, gastos del proyecto con traza anti-duplicado, reparto exacto + costo promedio + kardex + asiento cuadrado, partición inventario/COGS, anulación con reversa, guardas de estado, aislamiento por tenant) |
| Gates backend | `build` 0, `lint` 0, `tsc` proyecto y specs 0, `jest` **170 suites / 1951 tests** |

**Bug real cazado por el E2E**: el criterio «por valor» (`ROW_TOTAL`) multiplicaba la base por la cantidad **dos veces** (se le pasaba el valor de línea como si fuera unitario), así que repartía 160/40 en lugar de 133,33/66,67 — el asiento seguía cuadrando, y solo una aserción numérica lo detecta. Corregido en la utilidad (ahora recibe `lineValue` ya multiplicado) y cubierto por los 24 unitarios + el E2E.

**Límite declarado**: el documento exige una **cuenta de gasto** por línea, así que requiere contabilidad habilitada en el tenant (un tenant solo comercial no puede usar el módulo; su perfil no contabiliza la capitalización).

**F2 — Frontend: COMPLETADA y verificada (2026-09-17).**

| Pieza | Evidencia |
|---|---|
| Listado | `pages/landed-costs/landed-costs.component.*`: patrón Luna List (`h1`, info-banner, buscador + filtro por estado, `luna-data-table` con moneda/badge, paginación server-side, menú de fila con Editar/Aplicar/Anular y ojo de ver) |
| Formulario | `landed-costs-form.component.*`: nace de la recepción, **proyecto (código de importación)** heredado y editable, carga de **gastos del proyecto** en modal (preselecciona lo aplicable, marca lo ya aplicado y lo que no tiene cuenta), gastos manuales, **criterio por gasto**, previsualización **calculada por el backend** (`POST /landed-costs/preview`), resumen gastos/asignado/diferencia, guardar borrador / aplicar (con confirmación) / anular (con motivo) |
| Maestro de tipos | `pages/landed-cost-types/*`: listado + formulario (código, nombre, cuenta de gasto, criterio por defecto, descripción), con `canDelete` e inactivación por el backend |
| Entrada en la recepción | «Copiar a → **Precio de Entrega**» en `purchase-receipts-form` (acción `coins`, bloqueada con motivo si la recepción está anulada) |
| Rutas / menú / permisos | `/landed-costs` y `/landed-cost-types` (+ `new`, `:id`) con `permissionGuard(['landed-costs:view'])` y `dirtyCheckGuard`; entrada **Compras → Precios de Entrega**; `landed-costs` en el catálogo `PERMISSION_MODULES` |
| Karma | **1670 / 1670** (20 tests nuevos: contrato del servicio, listado y formulario —incluye la preselección de gastos, el volcado del reparto del backend y la guarda de «sin gastos no se guarda»—) |
| Gates estáticos | `lint`, `build`, `typecheck:e2e`, `format`, `a11y`, `copy`, `important`, `ng-deep`, `pos-scope`, `density:ci` (incluida la calidad de bloques de densidad) y `audit:e2e-conditional` en **0** |
| E2E de UI | `e2e/landed-cost-ui.spec.ts`: **3 passed** (recepción → «Copiar a» → cargar gastos del proyecto → reparto → guardar → aplicar → costo y asiento verificados → listado → anular con motivo, y el maestro de tipos por pantalla), con aserciones **incondicionales** |

**Dos defectos reales que cazó el E2E de UI** (ninguno visible para las pruebas de backend, que crean sus documentos por API y limpian los suyos):

1. **El seed (y la limpieza global) no borraba los Precios de Entrega**: `LandedCost.purchaseReceipt` y `LandedCostItem.purchaseReceiptItem` son FK **Restrict**, así que en cuanto existía un documento el borrado de recepciones reventaba con `P2003` y **el seed entero fallaba** — es decir, la instalación y el gate quedaban rotos para cualquiera que hubiera usado el módulo. Corregido en los **tres** sitios que hacen el borrado global (`prisma/seed.ts`, `scripts/clean-documents.js`, `cleanupDocuments` de `test/test-utils.ts`). Ver `AUDIT.md` T143.
2. **El reparto guardado es una foto**: al abrir un borrador, la pantalla muestra el reparto persistido (que en un borrador es «todo sin asignar») hasta que llega la respuesta del `preview`, así que el botón «Aplicar» está deshabilitado unos cientos de milisegundos. El E2E ahora **espera al reparto calculado** (diferencia `0,00`) antes de pulsar, que es la precondición real del botón.

**Declarado (no tocado)**: el listado pinta la moneda con `Intl` y el boliviano no trae decimales por defecto en CLDR, así que el mismo importe se ve `261` en el listado y `261,00` en el formulario — es del formateador compartido de `luna-data-table` (afecta a todos los listados) y no de G1.

**F3 (P1) y F4 (P2)**: pendientes, sin empezar (origen Factura de Compra, costeo por lote/serie, dimensiones por línea de gasto, informe «Importación por proyecto»).
