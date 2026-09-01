# Plan — Carga de datos masiva (plantillas Excel oficiales)

> **Fecha:** 2026-09-01 · **Estado:** Fases 1–3 (ARTÍCULOS, PARTNERS, STOCK INICIAL)
> implementadas y verificadas.
> **Objetivo:** que el usuario pueda descargar una plantilla Excel oficial por entidad,
> rellenarla con los datos necesarios e importantes, y cargarla con drag & drop
> (ya existente) para crear registros en el ERP.

---

## 1. Filosofía del módulo

El módulo de carga masiva existente (`/settings/bulk-upload/{items,partners,stock-initial}`)
ya soportaba upload Excel con drag & drop y reporte de errores por fila. La mejora
introduce **plantillas oficiales generadas por el backend** con:

1. **Hoja de datos** con TODAS las columnas necesarias e importantes de la entidad,
   una **fila de ejemplo** y 1000 filas en blanco listas para rellenar.
2. **Hoja "Instrucciones"**: por columna — obligatoria/opcional, tipo, ejemplo y
   explicación.
3. **Hoja "Catálogos"**: los códigos válidos del tenant (grupos, UoMs, indicadores
   de impuesto, proveedores, almacenes, cuentas contables) para que el usuario sepa
   exactamente qué valores usar.

El importador acepta **códigos** (no IDs numéricos que el usuario no conoce) y los
resuelve a IDs del tenant. Los encabezados de la plantilla son **amigables en español**
("Nombre", "Código de grupo", "¿Se vende?") y se normalizan a las claves técnicas.

---

## 2. Fase 1 — ARTÍCULOS ✅ (implementada y verificada 2026-09-01)

### Backend

| Pieza | Archivo | Detalle |
|-------|---------|---------|
| Definición de columnas | `backend-erp/src/items/item-import-template.ts` | `ITEM_IMPORT_COLUMNS` (~58 columnas), `ITEM_ACCOUNT_COLUMNS` (15 cuentas), `buildItemImportWorkbook()`, `normalizeItemImportRow()` (labels→keys), valores de enums (SÍ/NO, NONE/LOT/SERIAL, AVERAGE, PERCENTAGE/SPECIFIC). |
| Endpoint plantilla | `GET /items/bulk-import/template` (items.controller.ts) | Genera el .xlsx (buffer) con las 3 hojas y los catálogos del tenant; `Content-Disposition: attachment`. |
| Servicio plantilla | `items.service.ts → getBulkImportTemplate()` | Consulta grupos/UoMs/indicadores/proveedores/almacenes/cuentas activos y construye el workbook. |
| Importador | `items.service.ts → bulkImport()` | Resuelve códigos→IDs (groupCode, taxIndicatorCode, salesUomCode, purchaseUomCode, inventoryUomCode, defaultVendorCode, defaultWarehouseCode, 15 cuentas por código) con fallback a IDs numéricos; soporta los campos adicionales (SAP, ICE, vigencia, dimensiones por operación, currency); errores por fila con mensajes claros ("El código de X 'Y' no existe en el catálogo del tenant"). |

### Columnas de la plantilla (hoja "Artículos")

- **Identificación:** Nombre*, Código de barras, Descripción, Nombre comercial alternativo
  (ForeignName), Código en catálogo del proveedor, Fabricante, País de origen (ISO-2),
  Ubicación física, Código arancelario (HS), ItemCode SAP B1.
- **Operación:** ¿Se vende?, ¿Se compra?, ¿Maneja inventario?, ¿Es kit?, Trazabilidad
  (NONE/LOT/SERIAL), Método de costeo (AVERAGE), ¿Costeo por lote?, ¿Sujeto a impuestos?,
  Código de indicador de impuesto.
- **Precios/costos:** Precio de venta, Costo, Moneda, Peso, Volumen, Largo, Ancho, Alto.
- **Catálogos (por código):** Código de grupo, Unidad de venta, Unidad de compra,
  Unidad de inventario, Proveedor por defecto, Almacén por defecto.
- **Inventario/reposición:** Días de reposición, Stock mínimo, Punto de pedido,
  Stock máximo, Cantidad mínima de pedido, Múltiplo de pedido.
- **ICE (Bolivia):** Base ICE (PERCENTAGE/SPECIFIC), Tasa ICE (%), ICE por unidad (Bs).
- **Vigencia:** Vigencia desde, Vigencia hasta.
- **Cuentas contables (por código):** Cuenta Inventario, Cuenta Costo de Venta, Cuenta
  Diferencia de Precio, Cuenta Devoluciones, Cuenta Asignación, Cuenta Diferencia de
  Cambio, Cuenta Crédito Ventas, Cuenta Crédito Compras, Cuenta GRIR, Cuenta Descuento
  Ventas, Cuenta Descuento Compras, Cuenta Contrapartida Inventario, Cuenta
  Contrapartida Salidas, Cuenta Ingresos Ventas, Cuenta Compras/Servicios.

(*) obligatoria.

### Frontend

| Pieza | Archivo | Detalle |
|-------|---------|---------|
| Servicio | `erp-frontend/src/app/pages/items/items.service.ts` | `downloadBulkImportTemplate()` → blob del endpoint. |
| Página | `erp-frontend/src/app/pages/bulk-upload/items-bulk-upload.component.ts` | Columnas por código + `downloadTemplateFn` apuntando al endpoint real. |
| Componente compartido | `erp-frontend/src/app/shared/bulk-upload/bulk-upload.component.ts` | Inputs `downloadTemplateFn`/`templateFileName`; botón "Descargar plantilla" usa el servidor cuando está disponible (fallback CSV local); spinner "Generando..."; drag & drop existente. |

### Verificación live (2026-09-01)

- `GET /items/bulk-import/template` → 200, .xlsx de 42 KB, hojas Artículos/Instrucciones/Catálogos,
  fila de ejemplo preservada, rango A1:BG1001, catálogos poblados (IVA13SIN, PROV-00001,
  ALM-01, 6.1.2.01.007, etc.).
- Import con headers amigables (español) → `created:1, errors:[]`; el error de una fila
  con grupo inexistente reporta: `El código de grupo de artículos "GRUPO-01" no existe...`.
- Import completo con códigos reales (grupo INFO, IVA13SIN, UoM UN/CAJA/UN, PROV-00001,
  ALM-01, cuentas 1.1.3.01.001/4.1.1.01.001, sapItemCode, fabricante, país, HS) →
  **ART-00039** con todos los IDs resueltos (groupId=2, taxIndicatorId=3, salesUomId=1,
  purchaseUomId=1, inventoryUomId=1, defaultVendorId=9, defaultWarehouseId=1,
  inventoryAccountId=134, salesRevenueAccountId=227).

### Tests

- Backend: `items.service.spec.ts` — 4 tests nuevos de `bulkImport` (resolución de
  códigos, error de código inexistente, compatibilidad IDs numéricos, name obligatorio)
  + 1 de `getBulkImportTemplate` (buffer .xlsx, 3 hojas, catálogos). **47/47 en verde.**
- Frontend: `bulk-upload.component.spec.ts` — 6 tests nuevos (CSV fallback, descarga del
  servidor, error de descarga, validación de archivo en drop, aceptación de .xlsx).
  **6/6 en verde.**

---

## 3. Fase 3 — STOCK INICIAL ✅ (implementada y verificada 2026-09-01)

**Decisión de diseño (consultada con el usuario):** la carga de stock inicial crea
**Entradas de Mercadería (StockEntry) reales** — por almacén — que al confirmarse
generan **movimientos de kardex (MANUAL_IN)**, actualizan stock y costo promedio
ponderado, y producen el **asiento contable automático**
(Dr Inventario / Cr Contrapartida de Inventario). Es decir: **stock físico + asiento
contable automático** (opción recomendada), no una simple carga de saldos.

### Backend

| Pieza | Archivo | Detalle |
|-------|---------|---------|
| Definición de columnas | `backend-erp/src/items/item-import-template.ts` | `STOCK_INITIAL_IMPORT_COLUMNS` (4 columnas: Código de artículo*, Código de almacén*, Cantidad*, Costo unitario), `STOCK_INITIAL_LABEL_TO_KEY`, `normalizeStockInitialImportRow()`, `buildStockInitialImportWorkbook()` (hoja "Stock inicial" con 2 filas de ejemplo `EJEMPLO:` + Instrucciones + Catálogos con artículos inventariables y almacenes del tenant). |
| Endpoint plantilla | `GET /items/bulk-import-stock/template` (items.controller.ts) | Genera el .xlsx con las 3 hojas y catálogos; `plantilla-stock-inicial-<fecha>.xlsx`. |
| Servicio plantilla | `items.service.ts → getBulkImportStockTemplate()` | Consulta artículos con `canBeInventoried=true` activos + almacenes activos. |
| Importador | `items.service.ts → bulkImportStock()` | Normaliza filas (labels→keys) ANTES de resolver catálogos; resuelve `itemCode→itemId` (con fallback a ID numérico y validación `canBeInventoried`) y `warehouseCode→warehouseId`; omite filas `EJEMPLO:` y filas vacías; agrupa movimientos POR ALMACÉN y por cada almacén llama `StockEntriesService.createManual()` (que internamente confirma → kardex + asiento). |
| Wiring | `items.module.ts` importa `StockEntriesModule`; `stock-entries.module.ts` exporta `StockEntriesService` | Dependencia inyectada en `ItemsService`. |

**Nota de integración:** `StockEntriesService.createManual()` ya confirma la entrada
internamente (movimientos MANUAL_IN + `createStockEntryJournalEntry`). El importador NO
vuelve a llamar a `confirm()` (evita "Solo se puede confirmar una entrada abierta").
`StockEntryReason` no tiene valor INITIAL → se usa `'OTHER'` con notas
"Stock inicial por import masivo" (el motivo del movimiento queda "Entrada manual").

### Frontend

| Pieza | Archivo | Detalle |
|-------|---------|---------|
| Servicio | `erp-frontend/src/app/pages/items/items.service.ts` | `bulkImportStock()` (existente) + `downloadBulkImportStockTemplate()` → blob del endpoint. |
| Página | `erp-frontend/src/app/pages/bulk-upload/stock-initial-bulk-upload.component.ts` | Columnas por código (itemCode/warehouseCode/quantity/unitCost) con hints + `downloadTemplateFn` + `templateFileName`. |

### Verificación live (2026-09-01)

- `GET /items/bulk-import-stock/template` → 200, .xlsx con hojas
  **Stock inicial / Instrucciones / Catálogos**; filas 2 y 3 con prefijo `EJEMPLO:`
  (el importador las omite); catálogos con artículos inventariables y almacenes.
- Import con 2 filas `EJEMPLO:` + 1 fila real (ART-00016 / ALM-01 / 5 / 3.25) →
  **`created:1, errors:[]`** (las filas de ejemplo NO crean registros).
- Efectos verificados en BD:
  - `StockEntry` **ENT-000051** (CONFIRMED, reason OTHER, totalCost 16.25).
  - `StockMovement` **MANUAL_IN** qty 5 @ 3.25, motivo "Entrada manual ENT-000051".
  - `JournalEntry` **ASI-000202** (POSTED, 16.25/16.25):
    Dr **1.1.3.01.001 Inventario General** / Cr **5.1.2.01.001 Compensación de Inventario**.
  - Stock físico del artículo 16/ALM-01 actualizado (216 uds, avgCost 5.575715 incluye
    los dos imports de prueba).

### Tests

- Backend: `items.service.spec.ts` — describe `bulkImportStock` reescrito (StockEntry
  consolidada por almacén vía `StockEntriesService.createManual` con mock, omisión de
  filas `EJEMPLO:`, validación de campos requeridos) + `getBulkImportStockTemplate`.
  **49/49 en verde.**
- Frontend: `items.service.spec.ts` — test de `downloadBulkImportStockTemplate`
  (GET blob). **18/18 en las suites de items + bulk-upload.**

---

## 4. Siguientes fases (backlog)

- **Fase 2 — PARTNERS ✅ (implementada y verificada 2026-09-01):** plantilla oficial
  `GET /partners/bulk-import/template` con 46 columnas (identificación, contacto,
  operación comercial, fiscal Bolivia, catálogos por código, vigencia, 10 cuentas
  contables por código) y hojas Instrucciones/Catálogos (grupos de socio, impuestos,
  listas de precio, condiciones de pago, vendedores, almacenes, cuentas, monedas).
  El importador resuelve códigos→IDs (`groupCode`, `defaultTaxIndicatorCode`,
  `priceListCode`, `specialPriceListCode`, `defaultPaymentTermName`,
  `defaultSalesPersonUsername`, `defaultWarehouseCode`, `*AccountCode`) + monedas
  permitidas (BPCurrenciesCollection) + campos fiscal/SAP/vigencia. Verificado live:
  import con headers amigables creó SUP-0004 (grupo GRP-PROV, IVA13SIN, SAP PL000212,
  NIT, persona legal) y CLI-0016 (grupo GRP-RETAIL, backorder NO, monedas BOB,USD).
- **Fase 3 — STOCK INICIAL ✅ (implementada y verificada 2026-09-01):** ver sección 3
  arriba. Plantilla con artículo (código), almacén (código), cantidad y costo unitario;
  reutiliza `items.bulkImportStock` con resolución de códigos y crea Entradas de
  Mercadería consolidadas por almacén (kardex + asiento contable automático).
- **Fase 4 — Datos maestros adicionales:** cuentas contables, grupos, UoMs, impuestos
  (mismos patrones: plantilla + catálogos + resolución por código).
- **Fase 5 — Importación documental (opcional):** precios de lista, terceros con
  dimensiones.

### Criterios de aceptación (transversal)

- [ ] El botón "Descargar plantilla" baja un .xlsx real con las 3 hojas.
- [ ] El usuario rellena SOLO con códigos de la hoja Catálogos (sin IDs internos).
- [ ] Errores por fila con mensaje en español y número de fila del Excel.
- [ ] Los registros creados son válidos para el flujo normal del ERP (combinaciones
      canBeSold/CanBePurchased/CanBeInventoried, impuestos, cuentas).
