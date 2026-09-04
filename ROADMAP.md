# ROADMAP.md — ERP Suite

> Hoja de ruta única y consolidada. Estado actualizado al 2026-09-05.

---

## Leyenda

| Símbolo | Estado |
|:-------:|--------|
| ✅ | Completado |
| ☐ | Pendiente |
| 🔄 | En progreso / Parcial |

---

## Fase 0 — Fixes Críticos (Prioridad Máxima) ✅

> **Objetivo:** Prevenir corrupción de datos y bugs de diseño.  
> **Tiempo estimado:** 1-2 días

| # | Item | Descripción | Estado |
|---|------|-------------|--------|
| ✅ F0.1 | Eliminar `code @unique` global en documentos de stock | `StockTransfer`, `StockEntry`, `StockExit`, `StockAdjustment` ya tienen `@@unique([tenantId, code])` | ✅ |
| ✅ F0.2 | Arreglar `PaymentReconciliation.invoiceId` huérfano | Campos específicos (`saleInvoiceId`, `purchaseInvoiceId`, etc.) | ✅ |
| ✅ F0.3 | Eliminar `StockMovement.adjustmentId` huérfano | Usa `stockAdjustmentId` con relación correcta | ✅ |
| ✅ F0.4 | Crear modelo `Project` | Modelo `Project` con campos y relaciones a documentos comerciales | ✅ |
| ✅ F0.5 | Corregir `invoiced` default `true` → `false` | `SalesQuotation`, `SalesOrder`, `PurchaseQuotation`, `PurchaseOrder` con `@default(false)` | ✅ |

---

## Fase 1 — Operación esencial (Bloqueante para producción) ✅

> **Tiempo estimado:** 2-3 semanas

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 1.1 | **PDF de documentos** | Generar PDF para facturas, pedidos, cotizaciones y recibos de pago con membrete institucional. Backend con `pdfmake`. | ✅ Funcionando: Factura de Venta, Factura de Compra, Pedido de Venta, Cotización. |
| ✅ 1.2 | **Estado de cuenta por partner** | Pantalla que muestre todas las transacciones (facturas, pagos, NC/ND) de un partner con saldo corriente. | ✅ Implementado en `partner-detail` (tabs: Estado de Cuenta + Documentos Abiertos). |
| ✅ 1.3 | **Aging report / Vencimientos** | Reporte de deudas por cobrar/pagar agrupado por 0-30, 31-60, 61-90, 90+ días. | ✅ Endpoint `GET /reports/aging` con filtros CLIENTE/SUPPLIER. Frontend en `/reports/aging`. |
| ✅ 1.4 | **Alertas de vencimiento** | Toast/alerta automática al iniciar sesión si hay facturas por vencer o vencidas. | ✅ Backend: reglas `INVOICE_OVERDUE` e `INVOICE_DUE_SOON`. Frontend: toasts automáticos en `LayoutComponent`. |
| ✅ 1.5 | **Solicitudes de Compra** | Flujo completo: creación → envío a aprobación → aprobación/rechazo → conversión a Orden de Compra. Estados: DRAFT/PENDING/APPROVED/REJECTED/CLOSED. | ✅ Backend: 16 endpoints, 9 tests. Frontend: listado, formulario, modal de conversión. |
| ✅ 1.6 | **Perfil fiscal del emisor (tenant)** | Razón social, NIT, dirección fiscal, teléfono, correo, representante legal y logo del emisor. Requerido para PDFs/reportes fiscales. | ✅ Backend: endpoints `/tenants/me/company-profile`. Frontend: `/company-profile`. |
| ✅ 1.7 | **Campos definidos por usuario (UDF)** | Configuración dinámica de campos personalizados por entidad y almacenamiento de valores (`UserDefinedField`, `CustomFieldValue`). | ✅ Backend (`src/udf/`) + frontend (`src/app/pages/udf/`). Soporta entidades maestros y documentos. |
| ✅ 1.8 | **Guías de transporte** | Documento de transporte para entregas (`TransportGuide`) con estados y tracking. | ✅ Backend (`src/transport-guides/`) + frontend (`src/app/pages/transport-guides/`). |

---

## Fase 2 — Control de acceso y permisos ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 2.1 | **Tabla de permisos granulares** | Backend: `@RequirePermission` en todos los endpoints, `PermissionsGuard` global, permisos en JWT. | ✅ 24+ controllers migrados. `PermissionsGuard` lee permisos del JWT payload. |
| ✅ 2.2 | **Gestor de roles** | Frontend: CRUD de roles con matriz de permisos (checklist por módulo). | ✅ Pantalla `/permissions` con editor de matriz por rol. |
| ✅ 2.3 | **Restricción por almacén** | Matriz de permisos usuario-almacén; documentos y selectores filtran por almacenes asignados. | ✅ Implementada. |

---

## Fase 3 — Inventario avanzado ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 3.1 | **Lotes** | Campo `batchId` + `expiryDate` en `StockMovement` y líneas de documento; tracking en kardex. | ✅ Modelo `Batch` con `expiryDate`. `batchId` en todas las líneas y `StockMovement`. |
| ✅ 3.2 | **Números de serie** | Campo `serialNumberId` (1 unidad = 1 serie); validación de unicidad por almacén. | ✅ Modelo `SerialNumber` con `warehouseId` y `status`. |
| ✅ 3.3 | **Kardex formal** | Reporte independiente: movimientos de un artículo con saldo acumulado por fecha. | ✅ Endpoint `GET /items/:id/kardex`. Frontend `/kardex/:itemId`. |
| ✅ 3.4 | **Importación masiva** | Upload Excel (.xlsx/.xls) para artículos, partners y stock inicial; validación de errores. **Mejora (2026-09-01):** plantillas Excel oficiales descargables — `GET /items/bulk-import/template` (ARTÍCULOS: hoja "Artículos" con ~58 columnas + filas de ejemplo `EJEMPLO:` + 1000 filas editables, hojas "Instrucciones" y "Catálogos" del tenant), `GET /partners/bulk-import/template` (PARTNERS: 46 columnas con identificación/contacto/fiscal Bolivia/operación/catálogos por código/vigencia/cuentas) y `GET /items/bulk-import-stock/template` (STOCK INICIAL: 4 columnas artículo/almacén/cantidad/costo unitario + 2 filas de ejemplo). Los importadores resuelven **códigos → IDs** (grupos, UoMs, indicadores de impuesto, listas de precio, condiciones de pago, vendedores, almacenes, proveedores, cuentas contables) manteniendo compatibilidad con IDs numéricos; headers amigables en español normalizados a claves técnicas; filas `EJEMPLO:` y vacías omitidas; campos adicionales (SAP, ICE, vigencia, dimensiones por operación, moneda, monedas permitidas BPCurrenciesCollection); errores por fila claros. **Stock inicial (decisión validada con el usuario):** crea Entradas de Mercadería consolidadas POR ALMACÉN vía `StockEntriesService.createManual` (que confirma internamente) → kardex MANUAL_IN + actualización de stock/costo promedio + asiento contable automático (Dr Inventario / Cr Contrapartida). Frontend: botón "Descargar plantilla" baja el .xlsx real del servidor (drag & drop existente). Verificado live: ART-00039 (artículo con grupo/impuesto/UoMs/almacén/proveedor/cuentas resueltos), SUP-0004/CLI-0016 (partners) y ENT-000051 → ASI-000202 (stock inicial ART-00016/ALM-01: kardex MANUAL_IN 5×3.25 + asiento 16.25 Dr Inventario / Cr Contrapartida). | ✅ Implementado para artículos, partners y stock inicial (los tres con plantilla oficial + códigos). |
| ✅ 3.5 | **Unidades de medida (núcleo)** | UoM por artículo (venta/compra/inventario), conversiones por factor, selector UOM editable en líneas de documento con recálculo de cantidad/precio, propagación de `uomId` en todos los flujos y códigos de barra múltiples en el dato maestro. | ✅ Completado (2026-08-18, AUDIT item 42 + batería 17). **POS — Fase 1 (2026-08-26):** UoM visible (chip en carrito + línea en modal). **POS — Fase 2 (2026-08-26):** selector de UoM editable en el modal con conversión de precio por factor (misma matemática que `resolveItemPriceForPartner`), `uomId` en el payload de la factura (DTO formal `CreatePosOrderDto`) y stock validado/convertido por UoM en el backend. **POS — Fase 3 (2026-08-26):** campos personalizados (UDF) diferenciados por nivel — cabecera (`SaleInvoice`, en el checkout modal) y línea (`SaleInvoiceItem`, en el modal del producto + chips en el carrito); reutiliza `UdfFormSectionComponent` (opt-in) y el payload envía `customFields` de cabecera y por línea. **Pendiente:** entidad `UoMGroup` (patrón SAP B1 de grupos con unidad base) y escaneo de barcode en el POS. |
| ✅ 3.6 | **Roles de acceso (RBAC)** | Roles asignables a usuarios con permisos por módulo (estilo licencia ERP — SAP B1: Profesional, Financiera, Logística, CRM); el JWT une el rol legacy con los roles asignados. | ✅ Completado (2026-08-26). Modelo `AccessRole` + `UserRole`, módulo `/roles` (CRUD + catálogo de permisos + protección `isSystem`), `users` acepta `accessRoleIds`, UI de administración en Configuración → Roles + selector multi-rol en el formulario de usuario. Perfiles sembrados: ADMIN, USER, PROFESIONAL, FINANCIERA, LOGISTICA, CRM, POS_SUPERVISOR. **Autorización de supervisor en el POS (2026-08-26):** endpoints `/pos/supervisor-validate`, `/pos/invoices/:id/cancel` y `/pos/invoices/:id/credit-note` con validación del rol POS_SUPERVISOR y registro del autorizador; acciones Cancelar/NC en la tab de documentos del POS con modal de credenciales. **Pendiente a futuro:** lógica de licencias sobre los mismos roles. |

---

## Fase 4 — UX, notificaciones y reporting ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 4.1 | **Dashboard con KPIs** | Cards: ventas del mes, compras, top 5 artículos, stock bajo, cobranza pendiente. | ✅ Endpoint `GET /dashboard` con 10 métricas. Frontend con 6 cards. |
| ✅ 4.2 | **Centro de notificaciones** | Badge en header con lista de: aprobaciones pendientes, stock bajo, vencimientos. | ✅ `AlertPanelComponent` con badge en sidebar y panel deslizable. |
| ✅ 4.3 | **Búsqueda global** | Input en header que busque partners, artículos y documentos por código. | ✅ Endpoint `GET /search`. Frontend `/search` con resultados agrupados. |
| ✅ 4.4 | **Logs de auditoría** | Tabla `AuditLog` (quién, qué, cuándo, valor anterior/nuevo) en documentos clave. | ✅ Modelo Prisma `AuditLog`, endpoint `GET /audit-logs` con filtros. Frontend `/audit-logs`. |
| ✅ 4.5 | **Libro mayor** | Reporte de movimientos por cuenta contable con saldo acumulado. | ✅ Endpoint `GET /accounts/:id/ledger`. Frontend `/reports/ledger`. |
| ✅ 4.6 | **Reportes de compras y ventas** | Resúmenes de compras/ventas por período, artículo y partner. | ✅ Endpoints `/reports/purchase` y `/reports/sales`. Frontend `/reports/purchase`, `/reports/sales`. |
| ✅ 4.7 | **Reportes de stock** | Valoración, rotación y vencimiento de lotes. | ✅ Endpoints `/reports/stock-valuation`, `/reports/stock-rotation`, `/reports/batch-expiry`. |
| ✅ 4.8 | **Rentabilidad por artículo** | Margen y rentabilidad por artículo en ventas. | ✅ Frontend `/reports/item-profitability`. |
| ✅ 4.9 | **Balance por partner** | Resumen de saldos por partner (cliente/proveedor). | ✅ Frontend `/reports/partner-balance`. |

---

## Fase 5 — Avanzado (diferenciadores) ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 5.1 | **Precios por escala** | Tabla `PriceListItemScale` con `maxQty`, descuentos/precios por cantidad. | ✅ Implementado y testeado. |
| ✅ 5.2 | **Bancos y cuentas bancarias** | CRUD de cuentas; asociar pagos a cuenta bancaria; saldo bancario. | ✅ Modelos `Bank` y `BankAccount`. Endpoints CRUD. Frontend `/banks`. |
| ✅ 5.3 | **BOM / Ensamblaje** | Receta de fabricación (`ItemBom`) + ensamblaje de kits (`POST /items/:id/assemble`). | ✅ Backend + frontend. Falta `ProductionOrder` como entidad separada (Fase 6). |
| ✅ 5.4 | **POS / Punto de venta** | Terminales (`PosTerminal`), sesiones (`PosSession`), carrito, checkout y listado de facturas POS. | ✅ Backend (`src/pos/`, `src/pos-terminals/`, `src/pos-sessions/`) + frontend (`src/app/pages/pos/`). |
| ✅ 5.5 | **Conciliación bancaria** | Extractos bancarios (`BankStatement`), importación CSV/Excel, asignación de cuentas/partner/proyecto, posting a asientos y reconciliación. | ✅ Backend (`src/bank-reconciliation/`, `src/banks/`) + frontend (`src/app/pages/bank-reconciliation/`). |
| ☐ 5.6 | **CRM básico** | Oportunidades de venta, actividades/calendario por partner, pipeline. | Pendiente |

---

## Fase 6 — Contabilidad 🔄

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 6.1 | **Plan de cuentas** | CRUD de cuentas contables (activo, pasivo, patrimonio, ingreso, egreso). | ✅ Backend + frontend. Ruta `/accounts`. |
| ✅ 6.2 | **Asientos contables** | Modelos `JournalEntry`/`JournalEntryLine`, CRUD + post/cancel. Doble expresión monetaria (`debitLocal`/`creditLocal`/`debitSystem`/`creditSystem`) + validación de moneda por cuenta. | ✅ Backend completo. Frontend pendiente (Fase 9). |
| ✅ 6.3 | **Libro de compras/ventas** | Reportes fiscales bolivianos formateados. | ✅ Endpoints `GET /reports/sales-ledger` y `GET /reports/purchase-ledger`. |
| ✅ 6.4 | **Estado de resultados y balance** | Reportes financieros estándar. | ✅ Completado (2026-08-24): `GET /reports/balance-sheet` (ecuación A = P + E + R) + `GET /reports/income-statement` + páginas en /reports |

### Fase 6.1 — Accounting Engine Integrado (En progreso)

- ✅ Servicio `AccountingEngine` creado (`src/common/accounting-engine.service.ts`) con generación de asientos para ventas, compras, pagos y stock.
- ✅ Validación de partida doble al postear asientos (`totalDebit === totalCredit`).
- ✅ Saldos por cuenta en tiempo real vía `JournalEntryLine` POSTED.
- ✅ `AssemblyOrder` refactorizado para usar `AccountingEngine` (2026-08-24) — la lógica contable propia fue reemplazada por `buildAssemblyJournalEntryLines` + facade `createAssemblyJournalEntry` (batería 13 TODO EN VERDE).

### Fase 6.2 — Dimensiones Contables (En progreso)

- ✅ Modelos `CostCenter` y `Project` creados; usados en documentos comerciales y asientos.
- ✅ `projectId` y `costCenterId` disponibles en `JournalEntryLine`.
- ✅ **`Dimension1` / `Dimension2` personalizables (2026-08-24):** el formulario de asientos (`journal-entries-form`) ahora consume `DimensionConfig` del tenant — columnas solo para las dimensiones habilitadas en `/settings/dimensions`, labels configurables y selector de centro de costo (valor = `code`, consistente con la persistencia string) cuando la dimensión tiene centros cargados; texto libre como fallback. Mismo patrón canónico de pagos/documentos. | ✅ Completado |

### Fase 6.3 — Estados Financieros

- ✅ Balance General (`/reports/balance-sheet`, 2026-08-24).
- ✅ Estado de Resultados (`/reports/income-statement`, 2026-08-24).
- ✅ Estado de Flujo de Efectivo (`/reports/cash-flow`, 2026-08-24, método indirecto con verificación contra el mayor).

### Fase 6.4 — Cierre de Período (En progreso)

- ✅ Modelos `FiscalYear` y `AccountingPeriod` creados en Prisma.
- ✅ CRUD backend (`src/fiscal-years/`) + frontend (`src/app/pages/fiscal-years/`).
- ✅ Estados `OPEN` / `LOCKED` para bloquear modificaciones en períodos cerrados.
- ✅ **Asientos de cierre de ejercicio automáticos (2026-09-05)** — `POST
  /fiscal-years/:id/generate-closing-entry`: liquida las cuentas de resultado y traslada el
  neto a Resultados Acumulados (Utilidad/Pérdida), idempotente y con asiento de comprobación
  si el resultado es 0; botón en el detalle de la gestión. Plan:
  `docs/plans/plan-cierre-ejercicio.md`.
- ✅ Asiento de apertura del ejercicio (arrastre de saldos) — `generate-opening-entry`.

### Fase 6.5 — Activos Fijos (En progreso)

- ✅ Módulo `FixedAsset` creado en backend (`src/fixed-assets/`) y frontend (`src/app/pages/fixed-assets/`).
- ✅ Depreciación lineal implementada.
- ✅ **Depreciación mensual automática parametrizable (2026-09-05, T6)** — cron 1° de cada mes
  con flag `fixedAssetsAutoDepreciation` (default OFF) + opción manual coexistente.
- ✅ **Depreciación acelerada (saldo decreciente) completa (2026-09-05, T6)** — conmutación a
  línea recta sobre el saldo restante: el activo se agota hasta el residual dentro de la vida
  útil (antes convergía sin agotar); tasa anual en fracción (UI en %, default doble saldo
  decreciente); cálculo puro en `depreciation-math.ts` con tests. Fila **T6 cerrada**.

### Fase 6.6 — Nómina (Pendiente)

- `Employee`, `Payroll`, `Salary`.
- Cálculo de haberes/descuentos según ley boliviana.

---

## Fase 7 — Internacionalización y zona horaria ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 7.1 | **Zona horaria parametrizable por tenant** | Campo `timeZone` en `Tenant`; helpers `toTenantDate`/`fromTenantDate`; formularios, reporting y PDFs migrados. | ✅ Completado |
| ✅ 7.2 | **Moneda multi-divisa** | Soporte para USD, EUR además de BOB. Campo `currency` en documentos y tasa de cambio diaria. **Backend contable implementado:** `Account.currencyMode` (LOCAL/SYSTEM/MULTI/SPECIFIC), `Tenant.localCurrency`/`systemCurrency`, doble expresión en `JournalEntryLine`. **Frontend completo (2026-08-09):** account-form con `currencyMode`/`currency` + hint con monedas del tenant, columna Moneda legible en el listado de cuentas, journal-entries-form con moneda por línea y M/E editable/calculado, listado de asientos con totales M/N + M/E, ledger con las 4 expresiones. **Revaluación por diferencia de cambio (2026-08-24):** pantalla `/reports/exchange-rate-revaluation` que previsualiza los saldos M/E a la tasa de la fecha y genera el asiento automático (`POST /exchange-rate-adjustments/preview` + `revaluate`) contra las cuentas de ganancia/pérdida del settings; y las cuentas gain/loss del settings ahora SON consumidas por los builders (cobros/pagos/compras postean la ganancia a la cuenta de ganancia y la pérdida a la de pérdida, con fallback al mapping `EXCHANGE_DIFFERENCE`). **F7.2 contable completo (2026-09-05, T7):** diferencia de cambio AUTOMÁTICA en asientos manuales multi-moneda (flag `journalEntryAutoExchangeDifference`, default OFF) + `post()` que cuadra en moneda base (habilita asientos multi-moneda balanceados) + preview de revaluación sin cuentas con fallback al confirmar. Plan: `docs/plans/plan-f7.2-contable.md`. | ✅ Completado |
| ☐ 7.3 | **Localización de reportes fiscales** | Plantillas de libro de compras/ventas adaptables a otros países (Chile, Perú, Argentina). | ☐ Pendiente |

---

## Fase 8 — SaaS & Operaciones ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 8.1 | **Billing y suscripciones** | Modelo `Subscription` 1:1 con `Tenant`, estados `TRIAL/ACTIVE/PAST_DUE/CANCELLED/EXPIRED`, activación/cancelación manual, cron diario. | ✅ MVP implementado: backend + frontend `/billing`. |
| ✅ 8.2 | **Rate limiting por tenant** | `TenantThrottlerGuard` diferencia límites por plan (`SHARED` 300 req/min, `DEDICATED` 2000 req/min). | ✅ Backend: tests unitarios, ver `BACKEND_GUIDE.md` §6.3. |
| ✅ 8.3 | **Backups y disaster recovery** | Scripts de backup/restore de PostgreSQL, documentación de RPO/RTO y validación periódica. | ✅ Scripts `backup-db.js`/`restore-db.js`, ver `BACKEND_GUIDE.md` §6.1. |
| ✅ 8.4 | **Monitoreo y alertas** | Health checks (`@nestjs/terminus`) y métricas Prometheus (`prom-client`). | ✅ Backend: `/health`, `/metrics`, ver `BACKEND_GUIDE.md` §6.2. |
| ✅ 8.5 | **Pruebas de carga multitenant** | Suite k6 en `load-tests/k6/` (smoke, load, bulk-import, kardex, aislamiento multitenant); job CI. | ✅ 5/5 escenarios passed local y en GitHub Actions (perfil `small`). |

---

## Deuda técnica activa ✅

| # | Item | Descripción | Estado |
|---|------|-------------|--------|
| ✅ DT.1 | **Route guards** | Migrados de `roleGuard` a `permissionGuard` basado en permisos del JWT. | ✅ |
| ✅ DT.2 | **E2E tests** | `test-utils.ts` verificado: no contiene referencia a columna `existe`. | ✅ |
| ✅ DT.3 | **Refactor formularios** | Todos los formularios de documentos extienden `DocumentFormBase` y usan `DocumentLineArrayService`. | ✅ |
| ✅ DT.4 | **Colores hardcodeados** | ~20 colores `#hex` más obvios en `styles.scss` migrados a tokens CSS. | ✅ Parcial |
| ✅ DT.5 | **Selectores nativos** | Formularios clave migrados a `app-enum-selector`. | ✅ Parcial |
| ✅ DT.6 | **Responsive / touch targets** | Breakpoints unificados en `_breakpoints.scss`. | ✅ Parcial |
| ✅ DT.7 | **Tests faltantes** | Creados `.spec.ts` para `accounts`, `incoming-payments-form`, `outgoing-payments-form`. | ✅ |
| ✅ DT.8 | **Permisos audit-logs** | Módulo `audit-logs` agregado a `DEFAULT_PERMISSIONS`. | ✅ |
| ✅ DT.9 | **Unificación cálculo de impuestos (compras)** | Eliminado `forceInclusive: true` hardcodeado en todos los documentos de compra. | ✅ |
| ✅ DT.10 | **Validación obligatoria de `date` y `postingDate`** | `date` obligatoria en todos los documentos; `postingDate` obligatoria en documentos comerciales, stock/logística, pagos y contabilidad. | ✅ |
| ✅ DT.11 | **Consistencia branch↔warehouse backend** | `assertWarehousesInBranch` en los 22 servicios de ventas/compras/inventario + POS (create + update). `warehouse.branchId === document.branchId` garantizado en backend, no solo en frontend. | ✅ |
| ✅ DT.12 | **Herencia de branchId en flujos de copia (frontend)** | `DocumentFormBase.applyBranchFromSource` + 9 gaps corregidos (delivery-orders, sale-invoices, sale-reserve-invoices, purchase-invoices, purchase-reserve-invoices, sales-returns, credit-notes, multi-quotation de orders, interfaces de drafts). El documento hijo nace en la sucursal del origen. | ✅ |
| ✅ DT.13 | **stock-transfers: destino libre de sucursal** | Alineado frontend↔backend: el destino puede ser de cualquier sucursal (asiento usa cuentas del destino según su sucursal); solo el origen pertenece a la sucursal del documento. | ✅ |
| ✅ DT.14 | **Matriz artículo-almacén optimizada** | `validateDocumentLinesWarehouseAssignment` pasa de N `findFirst` por línea a 3 `findMany` en paralelo (matriz, items, warehouses) con deduplicación. Misma API y semántica. | ✅ |
| ✅ DT.15 | **Refactor `accounting-engine.service.ts` por dominio** | Split por familia completado (2026-08-08): 6,436 → 2,884 líneas en la fachada + 4 builders por dominio en `src/common/accounting/` (`sales`, `purchases`, `inventory`, `payments`) + `journal-entry-builder.ts` + `journal-entry-core.ts` (clase base con helpers compartidos). Superficie pública estable — 22 servicios y 19 specs no requieren cambios. **Completado 2026-08-09:** `previewJournalEntryFromDraft` (~1010 líneas) extraído a `src/common/accounting/drafts.journal-builder.ts` (`DraftsJournalBuilder` + interfaz `DraftPreviewDocument`); los helpers compartidos `_enrichPreviewLines`/`_buildPreviewResponse`/`_formatPreviewDate`/`_groupPreviewLines` se movieron a `JournalEntryCore` (elimina el enrich duplicado de `previewJournalEntry`). Fachada final: 2,884 → 1,718 líneas. 4 tests nuevos de preview de borrador (SALE_INVOICE, INCOMING_PAYMENT, STOCK_ADJUSTMENT, default). Backend 132 suites/1287 tests en verde. | ✅ Completado (fachada + builders + draft preview) |
| ✅ DT.16 | **POS delegando en `sale-invoices.service`** | `pos.service.ts` crea la factura con lógica propia; migrar a delegación para no replicar fixes contables. **DECIDIDO (2026-08-24): NO homogeneizar.** El análisis S2 concluyó que la delegación pura rompería el comportamiento del POS (venta atómica con pago); se resolvió con helpers compartidos (`applyOutgoingStock`) y el checkout ya postea asientos contables propios (DT.48). Cierre documental — no hay código pendiente. | ✅ Decidido (no homogeneizar) |
| ✅ DT.17 | **`purchase-requests-form` al patrón canónico** | Migrado a `PurchaseDocumentFormBase` (2026-08-08): 5 abstracts implementados, `defaultWarehouseId`/`skipBranchValidation`/auto-sync branch→warehouse heredados, `status` como campo sync, `'PURCHASE_REQUEST'` en el union `DocumentType`. Build + lint + 1,251 tests unitarios en verde. Último formulario en unirse al patrón — todos los formularios de documentos ya lo usan. | ✅ Completado |
| ✅ DT.18 | **Helper de testing alineado con APIs reales (S4)** | Auditoría de los 17 mocks de `document-form-testing/configure-testing-module.ts` contra los servicios reales (2026-08-08). Eliminado `toast.warn` muerto; `calculateLine`/`recalculateAllLines` del mock ahora delegan al servicio real (antes eran no-ops y los specs de montos pasaban falsy); `AuthService` con `isAdmin`/fallback de `defaultWarehouseId`/`defaultPosTerminalId` reales; `TenantDateService` con formatos e ISO implementados (zona UTC determinista); `SettingsService.save` muta el snapshot; `DocumentFlowService.getFlow` con `current` no-null; spies CRUD con retorno Observable. Build + lint + 1,251 tests en verde. | ✅ Completado |
| ✅ DT.19 | **Alturas de control a tokens LUNA (S5)** | Auditoría de las 79 alturas crudas en `pages/`/`shared/` (2026-08-08): 34 controles/botones con token equivalente, 45 decorativas. Migradas 31 líneas en 20 archivos a `var(--size-control-sm/md/lg)` (valor idéntico, cero cambio visual). Excepciones documentadas: alturas de 28px (compactos) y 38px (wrapper POS) intencionales; decorativas fuera del token de control. `min-height` crudo de controles: 0 restantes. Con esto **la deuda estructural priorizada (S1-S5) está liquidada**. | ✅ Completado |
| ✅ DT.20 | **Plan de Cuentas consolidado (S7)** | Fix de paridad lista↔árbol + totalización por nivel (2026-08-08): (1) **Backend** — `computeBalances` consolida el subárbol (nivel 5→1 sumando hijas al padre, balance según `balanceType` del padre) y filtra `POSTED` por defecto; `GET /accounts?includeDrafts=true` suma DRAFT (proyección). (2) **Frontend** — lista sin paginar (universo filtrado completo), `matchesFilters` compartido lista↔árbol (mismo conjunto en ambos modos), árbol expande niveles 1-4 y auto-expande ancestros al buscar, toggle "Incluir borradores". Antes: lista 100/295, árbol 55/295 visibles y cuentas resumidoras sin totalizar. Backend 131 suites/1267 tests y frontend 1257 tests en verde. | ✅ Completado |
| ✅ DT.21 | **Preview de devolución de compra siempre logístico (S8)** | Fix de regresión (2026-08-08): el preview del **draft** de `PURCHASE_RETURN` (`previewJournalEntryFromDraft`) usaba la heurística D5 de venta — sin `baseDocType` en las líneas del draft, generaba reversa financiera (CxP + compras + IVA) en vez del espejo de la recepción (Dr GRIR / Cr INVENTORY). El asiento real al confirmar ya era correcto; solo el preview del borrador mentía. Fix: `financialReversal = false` forzado en el draft (consistente con `previewJournalEntry` y `_confirmInTx`); el frontend propaga `baseDocType`/`baseDocId`/`baseLineId` en las líneas del formulario y `getPayload` los usa. Test de regresión del preview del draft. | ✅ Completado |
| ✅ DT.22 | **Pestaña kardex del detalle con valorización completa (S9)** | La pestaña Kardex de `item-detail` solo mostraba 7 columnas (sin costo total de la transacción ni saldo valorizado), aunque el backend ya devolvía `entryValue`/`exitValue`/`balanceValue` y la página kardex completa los mostraba. Fix (2026-08-08): agregadas las columnas "Entrada Bs", "Salida Bs" y "Saldo valorizado" a `kardexColumns` y sus celdas en `#cell2`. Sin cambios de backend. Build + lint + 1,257 tests en verde. | ✅ Completado |
| ✅ DT.23 | **Bugs funcionales de formularios comerciales (S10)** | Auditoría UX (2026-08-08) detectó y corrigió: (1) `purchase-returns` — selector de proveedor filtraba `CLIENT` en vez de `SUPPLIER`, trazabilidad mostraba `SALES_RETURN` en devolución de compra, buscador usaba `canBeSold` en vez de `canBePurchased`; (2) `delivery-orders` — Almacén de cabecera era readonly, ahora `app-warehouse-selector` editable con `skipBranchValidation`; (3) `journal-entries` — `getAccountRequiresPartner` (muerta) ahora muestra warning "requiere socio" en la celda de cuenta y `save()` bloquea con toast si una cuenta CxC/CxP no tiene partner. Build + lint + 1,257 tests en verde. | ✅ Completado |
| ✅ DT.24 | **Coherencia contable y moneda (S11)** | Fix de divergencias contables (2026-08-08): (1) **estado de cuenta del partner en moneda base** — el UNION SQL emite `debit_base`/`credit_base` (con `totalInBaseCurrency` cuando existe) y los aggregates + saldo corrido usan esos → summary/running balance consistentes con el ledger; (2) **listado de asientos** — `findAll` expone `totalDebitBase`/`totalCreditBase` y se muestran columnas "Débito M/N"/"Crédito M/N"; (3) **períodos cerrados** — `save()` bloquea con toast y `ngOnInit` valida al crear; (4) **preview cuadrado en base** (`previewIsBalanced` usa M/N); (5) **"Bs" hardcodeado eliminado** — etiquetas dinámicas con `baseCurrency` en kardex, item-detail, returns, dashboard y settings. Backend 131 suites/1268 tests y frontend 1257 tests en verde. | ✅ Completado |
| ✅ DT.25 | **Kardex unificado pestaña↔página (S12)** | Paridad visual y de datos del kardex (2026-08-08): (1) la pestaña del detalle del artículo suma columnas **Lote** y **Costo prom.** y el **badge de tipo de movimiento** (como la página); (2) **tarjetas de resumen** del kardex en la pestaña (Entradas/Salidas/Saldo/Costo prom./Valor inventario); (3) `fmtAmount` distingue `null` de `0` en kardex e item-detail; (4) **hint ⓘ** en "Costo prom." cuando el promedio es del subconjunto filtrado (almacén/lote/serie), no del global. Build + lint + 1,257 tests en verde. | ✅ Completado |
| ✅ DT.26 | **Copy y labels unificados en formularios (S13)** | Limpieza de copy/labels/iconos (2026-08-08): tildes corregidas; todos los `fas fa-*` de formularios comerciales → `luna-action-icon` (close/edit/sync/boxes/spinner/download); emojis del menú "Copiar a" y banners → `luna-action-icon`; botones de crear dicen "Creando..." (los de guardar conservan "Guardando..."); labels de referencia unificados a "Referencia del cliente/proveedor" y "Notas"; títulos paritarios ("Nuevo Pedido Manual", "Cotización de Venta"); toasts "… creada correctamente"; menú ⋮ de purchase-quotations al patrón canónico. Con esto **la auditoría UX completa (bloques A-D) queda liquidada**. Build + lint + 1,257 tests en verde. | ✅ Completado |
| ✅ DT.27 | **Bugs funcionales P0 de la auditoría UX v2 (S14)** | Correcciones (2026-08-09): (1) **borradores** — "Ver" navega al borrador y "Convertir a documento" quedó explícito en el menú (antes "Ver" convertía); (2) **guías de remisión** — badge mapea `DRAFT/SENT/DELIVERED/CANCELLED` (antes las enviadas/entregadas se veían "Cancelada") y el título usa el código; (3) **pagos** — pestaña "Métodos de pago" redundante eliminada de outgoing (el contenido vive en General); (4) **multi-moneda de pagos** — la moneda usa `app-document-currency-field` (selector + auto-TC) y el payload envía `exchangeRate` (el backend ya lo soportaba: DTO `BaseDocumentDto`, `validateExchangeRate`, motor contable con doble expresión y diferencia de cambio); (5) **tomas de inventario** — líneas guardan `trackingType` y muestran `app-batch-combobox` para LOT (el backend ya aceptaba `batchId`); SERIAL pendiente de migración de schema. Build + lint + 1,257 tests en verde. | ✅ Completado |
| ✅ DT.28 | **Información faltante P1 (S15)** | Mejoras (2026-08-09): (1) **costo promedio informativo en artículos** — bloque de solo lectura en la tab Stock del `item-form` con hint "Calculado por movimientos, no editable" (decisión del usuario: el costo no se edita, se calcula por operaciones o revalorización futura); (2) **reactivación de partners/items** — backend: `status` en `UpdateItemDto`/`UpdatePartnerDto` y `?status=` en `GET /partners`; frontend: menú ⋮ "Reactivar" para inactivos + toggle "Ver inactivos" en items y partners; (3) **partner-detail** — tabs **Direcciones** y **Cuentas Bancarias** consumiendo los endpoints separados existentes, con badge de tipo/principal. Backend 131 suites/1270 tests y frontend 1,257 tests en verde. | ✅ Completado |
| ✅ DT.29 | **Bloque P1 restante completado + F7.2 UI (S16)** | Implementación completa del P1 restante (2026-08-09): (1) **saldo en listado de partners** — `GET /partners` expone `balanceAR/balanceAP/netBalance` (query batch `PartnerBalance` por página) y columna "Saldo" según tipo (CLIENT→AR, SUPPLIER→AP, BOTH→neto) con color; (2) **stock/costo en listado de items** — `GET /items` expone `stockPhysical`/`stockAvailable` (Σ) y `avgCost` ponderado por cantidad, columnas "Stock"/"Disponible"/"Costo prom."; (3) **disponibilidad de lotes** — `batches` expone `committed` (pedidos de venta abiertos + reservas con `batchId`) y `available = físico − comprometido`; (4) **cuentas de ingreso/gasto por jerarquía** — schema `salesRevenueAccountId`/`purchaseAccountId` en Item/ItemGroup/Warehouse/ItemWarehouseAccount, engine `SALES_REVENUE`/`PURCHASES` resuelven por jerarquía con fallback al AccountMapping, selectores en forms de item/grupo/almacén; (5) **trazabilidad SERIAL en tomas** — `StockCountLine.trackingAssignments`, DTOs con `serialNumbers`, `adjust()` resuelve códigos→IDs y propaga al ajuste, form con botón "Asignar series". **F7.2 UI:** columna Moneda de cuentas con badge/label, hint con monedas del tenant, listado de asientos con totales M/E + columna Moneda, warning SPECIFIC por línea. Pendientes documentados: diferencia de cambio automática en asientos manuales y gain/loss accounts sin consumo. Backend 132 suites/1283 tests y frontend en verde. | ✅ Completado |
| ✅ DT.30 | **Propagación unificada de descuentos (S17)** | Mejores prácticas de propagación de descuentos en TODOS los flujos de documento (2026-08-10). **R1** — flujos single propagan el descuento donde vive en el origen: `header→header` (mode + pct/amt) o `línea→línea`. **R2** — toda consolidación multi materializa SIEMPRE el header del origen a línea (`discountMode='line'`). **R3** — materialización: pct directo a cada ítem; amt prorrateado proporcional al subtotal con ajuste de redondeo en la última línea (Σ = monto exacto). **R4** — el backend es la fuente de verdad (re-deriva y persiste denormalizado; el frontend solo muestra y permite ajuste fino). Helper central `backend-erp/src/common/discount-propagation.util.ts` (`materializeDiscountToLines`, `resolveHeaderDiscount`, `resolveSingleHeaderDiscount`) con 10 tests. Cobertura: pedidos multi (venta/compra), drafts multi de pedidos (descuento efectivo por ítem), facturas venta/compra/reserva desde cotización/pedido/entrega/recepción/FRC (single header→header), consolidaciones multi de facturas (quotation/order/delivery/receipt) con materialización, y entrega/recepción heredan el header del pedido/cotización al crearse. Mappers frontend de facturas propagan el header (order/delivery/quotation→invoice, incl. FRV); drafts multi ya traen el descuento materializado por línea. Sin migraciones de schema (los 6 modelos ya tenían los campos). Backend 133 suites/1299 tests y frontend en verde. | ✅ Completado |
| ✅ DT.31 | **Asiento de descuento por pronto pago (S18)** | (2026-08-10) El sistema ya calculaba y persistía el descuento por pronto pago (`earlyPaymentDiscountPct/Amount` desde condiciones de pago, `getPayableBalanceDue`, `paymentReconciliation.discountAmount`), pero el **asiento de pago no lo contabilizaba**: el cobro debitaba Banco y acreditaba CxC por el neto, dejando la CxC abierta por el descuento (mismo gap en CxP de pagos). Fix: nuevo EntryType `EARLY_PAYMENT_DISCOUNT` (mapping-only) y cuentas `6.1.3.01.005` "Descuentos Concedidos por Pronto Pago" (gasto financiero, cobros) y `4.2.1.01.011` "Descuentos Obtenidos por Pronto Pago" (ingreso, pagos). Los builders de pagos reciben `earlyPaymentDiscountAmount` y añaden la línea de cierre: **cobro** → Dr descuento concedido / Cr CxC (cierra la cuenta); **pago** → Dr CxP / Cr descuento obtenido. `applyPaymentEffects` de ambos servicios acumula el descuento total por pago (ramas cuotas y normal). Preview de borrador expone el campo. Backfill aplicado a tenants existentes (cuentas + mappings). 3 tests unitarios A7 + 1 E2E en verde. | ✅ Completado |
| ✅ DT.32 | **Mismo tratamiento contable FRV/FRC + IT + reporte Form 200 (S19)** | (2026-08-10) **Corrección de negocio validada con el ejemplo oficial del SIN (Formulario 200):** la factura de reserva (FRV) y la normal (FV) tienen el **mismo tratamiento contable** — CxC, ingreso, IVA débito (13% por dentro), descuento 87/13, IT 3% e ICE — y solo difieren en que la **reserva no mueve inventario** (el stock se mueve por la entrega/recepción). Igual en compras: FRC = FPI financieramente (CxP, IVA crédito, retenciones, descuento), con `ALLOCATION` en vez de `INVENTORY`. Cambios: (1) el **IT ahora aplica también a la FRV** (antes se excluía con `isReserve !== 'Y'`); (2) **IT adicional** en ND de venta; (3) NC/ND/devolución desglosan el descuento **87/13** y revierten el **descuento de cabecera** (plug espejo de la factura, con ajuste de redondeo). **Corregido (2026-08-24, AUDIT item 62): la NC y la devolución con reversa financiera NO revierten el IT** (regla normativa BO — el IT de la venta original se declaró en su mes y se pierde; se retiraron las líneas de reversa del builder). Nuevo **reporte de declaración tributaria** `GET /reports/tax-declaration` (Formulario 200: ingresos brutos, débito/crédito fiscal, descuentos otorgados/obtenidos, IT, ICE, retenciones RC-IVA/IUE/IT, saldo a favor) + pantalla en Reports. Validación normativa completa de las 4 familias (ventas, compras, pagos, inventario) contra Ley 843 TO 30/09/2023, DS 21530, DS 21532 y el ejemplo oficial del Form 200 del SIN (débito = ingresos × 13%, crédito = compras × 13%). 5 tests unitarios A8 + 1 E2E. Backend 133 suites/1311 tests y frontend en verde. | ✅ Completado |
| ✅ DT.33 | **Split 87/13 indicator-aware + Form 200 completo (S20)** | (2026-08-12) **1)** El desglose del descuento 87/13 en **ventas** ahora respeta el **método del indicador fiscal de la línea** (helper `resolveDiscountSplit` en `journal-entry-core.ts`), igual que compras: una línea STANDARD o tasa cero en un tenant BO ya no se desglosa 87/13; sin indicador, usa el método por defecto del país. Aplicado a FV, NC, ND y devolución. **2)** El reporte de declaración se completa con la **base de compras** (casilla 26: FPI/FRC − NC de compra) y el **detalle de documentos de compra** (facturas y NC) en la pantalla del Form 200. Frontend actualizado. 1 test unitario nuevo. | ✅ Completado |
| ✅ DT.34 | **Retención type-aware en el pago + ICE por artículo (S21)** | (2026-08-12) **1) Retención type-aware en el pago saliente:** nuevo campo `OutgoingPayment.withholdingTaxTypeId` (migración + db push erp_db/erp_test). Al registrar una retención con su tipo (IT/IUE/RC-IVA), el asiento del pago acredita la **cuenta específica del tipo** (`WithholdingTaxType.accountId`: RC-IVA→2.1.2.01.006/007, IUE→2.1.2.01.008, IT→2.1.2.01.009) en lugar de la genérica de IT (2.1.2.01.009). Sin tipo, se conserva el fallback legacy (mapping `WITHHOLDING_TAX_PAYABLE`). DTOs create/update + validación + preview de borrador + selector de tipo en el form de pagos (consume `WithholdingTaxesService`). **2) ICE por artículo (Form 605/608):** el reporte de declaración ahora desglosa el ICE por artículo (base, tasa y monto por ítem) además del total del pasivo. 1 test unitario nuevo. | ✅ Completado |
| ✅ DT.35 | **ICE específico por unidad (DS 24053) + Libro de Compras y Ventas (S22)** | (2026-08-12) **1) ICE específico por unidad:** el ICE boliviano (DS 24053) se liquida en su mayoría por **monto fijo por unidad** (Bs/litro, Bs/paquete) y no solo por porcentaje. Nuevos campos `Item.iceBasis` (`PERCENTAGE` | `SPECIFIC`) + `Item.iceAmountPerUnit` (migración + db push). El builder de venta calcula la línea de ICE según la base: `SPECIFIC` → cantidad × monto por unidad; `PERCENTAGE` → neto × tasa. Form de artículo con selector de base ICE y campo de monto por unidad (condicional). **2) Libro de Compras y Ventas (IVA):** nuevo reporte `GET /reports/iva-books?from&to` (solo countryCode BO) con el detalle mensual por factura — ventas (FV+FRV), compras (FPI+FRC) y NC como filas — con código, fecha, NIT, razón social, total, base e IVA, más débito/crédito fiscal netos (respaldo del Form 200). Pantalla en Reports con tabs Ventas/Compras. 1 test unitario nuevo (ICE específico). | ✅ Completado |
| ✅ DT.36 | **Cierre de período contable — protección en el motor (S23)** | (2026-08-12) La infraestructura de períodos contables ya existía (`FiscalYear`/`AccountingPeriod`, `AccountingPeriodsService.close/reopen/validatePostingDate`, controller y UI de fiscal-years), y protegía los **asientos manuales** y activos fijos — pero **no los asientos automáticos** (confirmación de documentos). Fix en `JournalEntryCore._persist` (punto único por el que pasan TODOS los asientos): (1) si existe un período para la fecha del asiento y está **cerrado/bloqueado** (o su año fiscal cerrado), se bloquea la creación del asiento con `ConflictException` — cubre facturas de venta/compra, pagos, stock, etc.; (2) cuando existe período, el asiento queda **vinculado** a `fiscalYearId`/`periodId` (trazabilidad + control de borradores al cerrar); (3) si no existe período configurado, se permite (compatibilidad con tenants sin años fiscales). 2 tests unitarios nuevos (bloqueo en período cerrado + vínculo del asiento). | ✅ Completado |
| ✅ DT.37 | **Fix: descuento no figura en FRV desde entrega (S24)** | (2026-08-12) Caso reportado: FRV de venta con descuento desde la entrega (DEL-000057) — el asiento preliminar no mostraba el descuento. Tres bugs encadenados corregidos: **(1)** `delivery-orders.createManual` ignoraba `line.discountPct` del payload (solo usaba el descuento automático de grupo/periodo) → la entrega nacía sin descuento; **(2)** el módulo `sale-reserve-invoices.createFromDelivery` usaba solo el `discountPct` del payload sin heredar el del ítem de la entrega (viola R1 — el descuento se propaga del origen) en las ramas "entrega suelta" y "resolver genérico"; **(3)** el módulo FRV persistía `item.subtotal = lineTotal` (con IVA) en lugar del neto y no persistía `lineSubtotal`, corrompiendo el preview del documento confirmado (doble conteo del descuento). Fix: subtotal neto + `lineSubtotal` persistidos (con fallback para registros viejos en `_generateJournalEntry`). 1 test unitario (descuento de línea 350×5/8% → 87/13) + 1 E2E (entrega manual con descuento → FRV → asiento con SALES_DISCOUNT y preview con descuento). | ✅ Completado |
| ✅ DT.38 | **Fix: previewFromDraft descartaba discountTotal (S25)** | (2026-08-12) Caso reportado: al generar la FRV con "copiar a" desde la entrega (DEL-000059, del flujo COT-000071→PED-000048) el **asiento preliminar del formulario** no mostraba el descuento (aunque la factura sí lo tenía). Causa raíz: `JournalEntriesService.previewFromDraft` mapeaba las líneas del DTO al draft del preview **omitiendo `discountTotal`** (y también `taxIndicatorId`, `purchaseReceiptItemId`, `receiptExchangeRate`, `baseDocType`). El backend recibía el descuento en el payload pero lo descartaba → el builder contabilizaba el ingreso por el neto sin la línea de SALES_DISCOUNT. Fix: el mapeo ahora incluye **todos** los campos de `DraftPreviewDocument.lines`. Verificado en vivo contra la API (preview muestra 87% → 73.08 SALES_DISCOUNT + 13% → 10.92 IVA crédito) y con test E2E de regresión `preview-draft`. | ✅ Completado |
| ✅ DT.39 | **Fix: botón "Ver documento origen" no aparecía en asientos de FRV (S26)** | (2026-08-12) El asiento ASI-000412 (FRV guardada) tenía `sourceDocumentType='SALE_RESERVE_INVOICE'` correcto, pero `SOURCE_DOCUMENT_ROUTE_MAP` del frontend **no incluía `SALE_RESERVE_INVOICE`** (solo tenía `PURCHASE_RESERVE_INVOICE`) → el botón no se mostraba. Se agregaron los tipos faltantes con sus rutas y etiquetas: `SALE_RESERVE_INVOICE`, `SALES_DEBIT_NOTE`, `PURCHASE_DEBIT_NOTE`, `STOCK_COUNT`. | ✅ Completado |
| ✅ DT.40 | **Fix: preview de devolución desde entrega era de NC en vez de logística (S27)** | (2026-08-12) Al hacer "copiar a → devolución" desde la entrega DEL-000058, el asiento preliminar mostraba la **reversa financiera** (CxC, ingreso, IVA, IT — como una NC) en vez del **par logístico** (Dr Inventario / Cr COGS). El flujo confirmado ya era correcto (`resolveSalesReturnFinancialReversal`: devolución contra entrega no facturada → solo inventario); el bug era solo del **preview del formulario**: la heurística de `_previewSalesReturn` usa `baseDocType` por línea (null → reversa financiera), y el form `sales-returns` **no cargaba `baseDocType` en las líneas** al cargar desde una entrega. Fix: se agregó el control `baseDocType='DELIVERY_ORDER'` (+`baseDocId`) al cargar desde entrega y `baseDocType`/`baseDocId` desde el origen en `buildLineGroup`. Verificado en vivo (preview con DELIVERY_ORDER → Dr Inventario 783 / Cr COGS 783) + E2E de regresión. | ✅ Completado |
| ✅ DT.41 | **Estado "Devuelto" en entregas + fix invoicedQty fantasma (S28)** | (2026-08-12) Reportado: al aplicar una devolución a una entrega, ésta figuraba como **"Facturado"** aunque no se facturó. Dos causas: (1) la entrega solo tenía `invoiceStatus` (PENDING/PARTIAL/FULL = qué tan facturada) sin concepto de devolución; (2) el display usaba el denormalizado `invoicedQty`, que puede quedar **fantasma** cuando se cancela una factura sin decremento → la entrega aparecía FULL. Fix: (1) el backend expone `returnStatus` (`NONE`/`PARTIAL`/`FULL`) calculado de las **devoluciones no canceladas** (listado y detalle); (2) `invoicedQty` para el display se calcula de las **facturas activas** (no canceladas) en lugar del denormalizado. Frontend: la columna Facturación muestra **"● Devuelto"** / **"● Parcial devuelto"** cuando la entrega tiene devoluciones. Verificado en vivo (DEL-000058: returnStatus FULL + invoiceStatus PENDING) + E2E 1b. | ✅ Completado |
| ✅ DT.42 | **Mismo tratamiento en recepciones de compra (S29)** | (2026-08-12) Aplicado el mismo fix de DT.41 al lado de compras: las **recepciones** ahora exponen `returnStatus` (`NONE`/`PARTIAL`/`FULL`) calculado de las **devoluciones de compra no canceladas** (listado y detalle), y el `invoicedQty` del display se deriva de las **facturas de compra activas** (no canceladas) en vez del denormalizado. Frontend: la columna Facturación de recepciones muestra **"● Devuelto"** / **"● Parcial devuelto"**. El detalle de recepción ahora también devuelve `invoiceStatus` calculado de las líneas. Verificado en vivo + E2E 2b. | ✅ Completado |
| ✅ DT.43 | **La devolución libera las cantidades del pedido (PO/SO se reabren) (S30)** | (2026-08-12) Reportado: tras cotización→pedido→recepción→**devolución**, el pedido de compra quedaba **CLOSED** y no permitía generar una nueva recepción. Causa: la recepción/entrega incrementaban `receivedQty`/`deliveredQty` del pedido y lo cerraban, pero la **devolución no liberaba esas cantidades ni recalculaba la orden**. Fix simétrico en devoluciones (crear y cancelar): **compras** → decrementa `receivedQty` del PO, ajusta `openQty`/`lineStatus` y llama `recalcPurchaseOrderProgress` + `refreshHeaderStatus` (reabre a OPEN si quedó pendiente); **ventas** → decrementa `deliveredQty` del SO + `recalcSalesOrderProgress` + `refreshHeaderStatus`. La cancelación de la devolución revierte (incrementa + recalcula). Verificado con E2E: PO/SO vuelven a OPEN, `receivedQty`/`deliveredQty` = 0, `openQty` = 10, y se puede generar una **nueva** recepción/entrega (la orden vuelve a CLOSED al completarse). | ✅ Completado |
| ✅ DT.44 | **Fix guard PO→PRI→Receipt: solo bloquea PRI avance (S31)** | (2026-08-12) Reportado: tras PO→recepción→devolución→recepción→**PRI**→recepción de las pendientes, la validación bloqueaba con "Esta orden ya tiene una Factura de Reserva activa. En el flujo PO→PRI→Receipt...". Causa: el guard bloqueaba **cualquier** recepción directa desde el PO si existía una PRI activa, incluso cuando la PRI nació de una recepción (ya cumplida). Fix: el guard solo bloquea cuando la PRI es un **avance** (`purchaseReceiptItemId = null`) con cantidades pendientes (`openQty > 0`); si la PRI viene de una recepción (ya cumplida) se permite recibir las unidades pendientes del PO. Mismo fix en ventas (`deliveryOrderItemId = null`). E2E: el caso del usuario (PRI desde recepción → recepción de pendientes ✓) y el avance (bloqueado ✓). | ✅ Completado |
| ✅ DT.45 | **ITF en extractos bancarios — Fase T1 del plan tributario BO (S32)** | (2026-08-16) Primera fase del plan `docs/plans/plan-cumplimiento-tributario-bo.md` (gap G8): el cargo bancario por **ITF (Impuesto a las Transacciones Financieras, Ley 3446)** no era contabilizable desde la conciliación bancaria — la línea del extracto exigía `accountId` manual. Implementación: (1) `BankStatementLine.chargeType` (schema + SQL manual `prisma/manual/20260816_add_itf_bank_charge_type.sql` aplicado con `prisma db execute` — la BD tiene drift preexistente vs `prisma/migrations` que impide `migrate dev`/`db push` sin reset); (2) cuenta `6.2.1.01.013` "ITF — Impuesto a las Transacciones Financieras" en el plan BO + EntryType `FINANCIAL_TRANSACTION_TAX` + mapping por defecto `BANK_STATEMENT/FINANCIAL_TRANSACTION_TAX` (backfill a tenants vía `POST /account-mappings/ensure-defaults`, idempotente); (3) `BankStatementsService.post()` acepta líneas con `chargeType='ITF'` sin cuenta: resuelve la contrapartida desde el mapping (Dr ITF gasto / Cr Banco en créditos de extracto) y lanza `BadRequestException` accionable si falta el mapeo; (4) frontend: columna "Tipo Cargo" (Ninguno/ITF) por línea del extracto, validación de posteo actualizada, y campo informativo `BankAccount.itfRate` (tasa % Ley 3446) en el form de cuentas bancarias. 3 tests unitarios nuevos (posteo ITF vía mapping, mapping faltante, preferencia de cuenta explícita). Backend 136 suites/1338 tests, frontend build/lint + 1292 tests Karma en verde. | ✅ Completado |
| ✅ DT.46 | **UFV como moneda (isIndexUnit) + actualización del saldo a favor en Form 200 — Fase T2 del plan tributario BO (S33)** | (2026-08-16) Gap G7 (Art. 9 Ley 843): el Form 200 no exponía el saldo a favor del período anterior ni su **actualización por UFV**. **Decisión de diseño (validada con el usuario): la UFV se modela como una moneda más** — no hay tabla `UfvRate` nueva: `Currency.isIndexUnit` (default false) marca la UFV como unidad de índice no transaccional y sus cotizaciones diarias viven en `ExchangeRate` (par UFV→BOB), reutilizando CRUD, carga masiva y `getRateForDate`. Cambios: (1) schema `Currency.isIndexUnit` + SQL manual `prisma/manual/20260816_add_currency_is_index_unit_ufv.sql` (columna + backfill de la moneda UFV a tenants BO; el seed la crea en tenants nuevos BO); (2) DTOs/servicio de currencies aceptan `isIndexUnit`; (3) nuevo endpoint genérico `POST /exchange-rates/import` (upsert por fila, series diarias con valor distinto — la serie UFV del BCB); (4) `getTaxDeclarationReport` expone `saldoFavorAnterior` (mes previo, de las cuentas IVA débito/crédito), `saldoFavorAnteriorActualizado` (× UFV cierre / UFV mes anterior), `ajusteUfv`, metadatos `ufv` y `ufvWarning` (degrada con aviso explícito si falta la UFV — nunca inventa la tasa; sin `from` pide el inicio del período); (5) frontend: `CurrencySelectorComponent.includeIndexUnits` (default false → UFV oculta en selectores transaccionales), habilitado en las 3 pantallas de tipos de cambio; modal "Importar serie" (pegar filas fecha,valor) en el listado de tasas; Form 200 con casillas "Saldo a favor mes anterior", "Actualizado UFV" y "Ajuste por actualización de valores (Art. 9)" + banner de warning + nota de que el asiento de ajuste es manual del contador. 5 tests unitarios nuevos del reporte. Backend 137 suites/1343 tests, frontend build/lint + 1292 tests Karma en verde. | ✅ Completado |
| ✅ DT.47 | **Ventas menores POS con consolidación diaria — Fase T3 del plan tributario BO (S34)** | (2026-08-16) Gap G6 (Art. 16 Ley 843): el POS emitía una factura individual por cada venta sin implementar el régimen de ventas menores (registro interno + **una nota fiscal consolidada al cierre del día**). Implementación: (1) settings del tenant (key-value `SystemSettings`): `posConsolidateMinorSales` (default off), `posMinorSalesThreshold` (default 5.00, parametrizable — la norma permite actualización por DS) y `posGenericPartnerId` (cliente genérico "consumidor final"); (2) schema `SaleInvoice`: `isMinorSale`, `isMinorSalesConsolidation`, `minorSalesCount`, `consolidatedInvoiceId` (auto-relación) + SQL manual `prisma/manual/20260816_add_pos_minor_sales_consolidation.sql`; (3) checkout POS marca `isMinorSale` cuando flag activo + cliente genérico + total < umbral; (4) `POST /pos-sessions/:id/consolidate-minor-sales` genera **una** factura consolidada CLOSED a nombre del genérico con Σ exacta de subtotal/IVA/total (el IVA es la suma de los IVA de línea, no se recalcula) y vincula las menores — **documental: sin ítems, sin stock, sin pagos ni asiento contable propios** (regla de oro: el Form 200 no cambia); `GET /:id/minor-sales-summary` alimenta el bloque de cierre; (5) anti doble conteo: arqueo de caja excluye consolidadas, Libro de Compras y Ventas y libro de ventas hacen *swap* (`consolidatedInvoiceId: null` → la consolidada reemplaza a las menores, tipo de fila `CONSOLIDADA`), la declaración jurada (ingresos brutos + detalle) excluye consolidadas; (6) guardas de anulación: ni la consolidada ni una menor ya consolidada se anulan por el flujo normal; (7) frontend: sección "POS — Ventas menores (Bolivia)" en Configuración (toggle + umbral + selector de cliente genérico), bloque "Ventas menores del día" en el modal de cierre de caja con total/cantidad/pendientes + botón Consolidar + estado de facturas generadas, badges en el listado de facturas ("Consolidada (N)", "Menor", "Menor · consolidada"). Tests: 9 backend nuevos (4 marcado checkout + 5 consolidación/resumen/arqueo + 2 Libro IVA swap y gating BO) y 4 Karma nuevos del bloque de cierre. Backend 138 suites/1357 tests, frontend build/lint + 1296 tests Karma en verde. **Hallazgo colateral crítico documentado como S35: el POS no genera asientos contables** (ni factura ni pagos) — las ventas POS llegan al Libro de Ventas pero no al débito fiscal del Form 200 (basado en líneas de asientos POSTED). | ✅ Completado |

| ✅ DT.48 | **Asientos contables del POS (venta + cobros) con backfill — Fase T3b del plan tributario BO (S35/G9)** | (2026-08-16) Hallazgo crítico de T3: el checkout del POS creaba factura CLOSED + pagos entrantes sin invocar el motor contable — las ventas retail quedaban fuera del libro mayor y del débito fiscal del Form 200 (basado en líneas POSTED). Implementación: (1) el checkout postea en la MISMA transacción el asiento de venta (`createSaleInvoiceJournalEntry` — idéntico al de una FV directa: Dr CxC / Cr Ventas netas / Cr IVA débito / Cr IT + Dr COGS / Cr Inventario, con netting uniforme `discountTotal=0`) y un asiento por cada cobro (`createIncomingPaymentJournalEntry` — Dr Caja/Banco / Cr CxC), además de actualizar el saldo del partner (`totalInvoicedAR` + `totalPaidAR` — la venta POS factura y cobra en el mismo acto); (2) **decisión de diseño: BLOQUEO** — si la determinación de cuentas falla, la transacción se revierte y el checkout se rechaza con el error del motor (misma regla que las facturas normales; nunca una venta sin contabilizar; no se encola); (3) backfill histórico idempotente `POST /pos/admin/backfill-accounting` (procesa solo facturas POS sin asiento, con re-verificación dentro de la tx para corridas concurrentes). 3 tests unitarios nuevos; backend 138 suites/1360 tests en verde. Verificación en vivo: checkout POS → asiento de venta (IVA 259.35 completo, sin SALES_DISCOUNT) + asiento de cobro (Caja/CxC) balanceados; backfill regeneró ambos asientos de una factura histórica simulada. Ver `AUDIT.md` S35. | ✅ Completado |
---
| ✅ DT.49 | **Exportaciones tasa cero (Art. 11 y 76 inc. c) — Fase T4 del plan tributario BO (S36/G4)** | (2026-08-16) Gap G4: sin régimen de exportación, una venta al exterior se trataba como exenta sin derecho a crédito fiscal y pagaba IT. Implementación: (1) schema `TaxIndicator.isZeroRated` + `SaleInvoice.isExport` (SQL manual `20260816_add_export_tasa_cero.sql` + seed `TASA_CERO`); (2) journal builder: sin TAX_OUTPUT ni IT en documentos `isExport`, ingreso íntegro (devuelve el impuesto embebido) y `discountDebit` corregido (sin SALES_DISCOUNT fantasma); NC de exportación sin reversa de IT; (3) `isExport` en los 7 paths de FV (DTO común); (4) Form 200: exportaciones fuera de la base gravada + sección `exportaciones` (total/base/cantidad, `creditoFiscalAtribuible` vía setting `exportCreditAttributionPct`, `excedenteEstimadoReintegro` — trámite CEDEIM externo, asiento manual documentado); (5) frontend: toggle "Exportación" en FV + sección en la pantalla del Form 200. Tests: 2 unitarios del reporte + 1 E2E; backend 138 suites/1362 tests, E2E 81/81, frontend build/lint + Karma en verde. | ✅ Completado |

| ✅ DT.50 | **Prorrateo del crédito fiscal (operaciones mixtas) — Fase T5 del plan tributario BO (S37/G5)** | (2026-08-16) Gap G5: el crédito fiscal se computaba íntegro sin distinguir el uso de la compra. Implementación: (1) schema `PurchaseInvoice.creditUse` (TAXABLE/EXEMPT/MIXED, default TAXABLE) + SQL manual `prisma/manual/20260816_add_purchase_credit_use.sql` + persistencia en los 8 paths de compra; (2) util `fiscal-credit-proration.util.ts`: prorrata `gravadas / (gravadas + exentas + tasa cero)` del año en curso (DS 21530 Arts. 8-9; en diciembre la definitiva); (3) Form 200: sección `prorrataCreditoFiscal` (porcentaje, composición YTD, desglose directo/prorrateado/no computable/computable y asiento de reclasificación propuesto `Dr Gasto / Cr IVA Crédito Fiscal`); (4) frontend: selector "Uso del crédito fiscal" en la factura de compra + sección en la pantalla del Form 200. Tests: 6 unitarios de la util + 2 del reporte (mixto 70/30 → prorrata 76.92 con reclasificación; EXEMPT → computable 0); backend 139 suites/1370 tests, E2E 81/81, frontend build/lint + Karma en verde. Ver `AUDIT.md` S37. | ✅ Completado |
## Features de negocio pendientes (roadmap)
| ✅ DT.51 | **RC-IVA declarativo (Form 110) — Fase T6 del plan tributario BO (S38/G3)** | (2026-08-16) Gap G3: la retención se contabilizaba pero no existía el cálculo del dependiente ni el reporte declarativo. Implementación: (1) schema `WageParam` (SMN por gestión), `PayrollRcIva` (cálculo por empleado/período con arrastre de saldos) y `EmployeeTaxCreditInvoice` (facturas del dependiente) — SQL manual `20260816_add_rc_iva_declarativo.sql`; (2) módulo `src/rc-iva/` con el motor (sueldo − aportes 12.71% → neto − 2×SMN → 13% − crédito por facturas ± saldo anterior, Arts. 26-31/DS 21529) y endpoints (SMN upsert, CRUD facturas, calculate, listado dependientes, reporte de terceros consolidado por beneficiario); (3) frontend: `/reports/rc-iva-dependientes` (parámetros SMN, cálculo, máscara del Form 110, CRUD de facturas) y `/reports/rc-iva-terceros` (consolidado agente de retención) en el menú de reportes. Tests: 5 unitarios del motor; backend 140 suites/1375 tests, E2E 81/81, frontend build/lint + Karma en verde. Ver `AUDIT.md` S38. | ✅ Completado |

| ✅ DT.52 | **IUE anual (25%) + compensación contra el IT — Fase T7 del plan tributario BO (S39/G2)** | (2026-08-16) Última fase del plan: no existía determinación del IUE ni la compensación mensual contra el IT. Implementación: (1) schema `IueAdjustment`/`IueDetermination`/`ItCompensation` + SQL manual `20260816_add_iue_compensacion.sql`; (2) módulo `src/iue/`: determinación contable-primero (Σ 4.x − Σ 5.x/6.x POSTED ± ajustes − pérdida arrastrable → 25%) con asiento propuesto; compensación mensual del IT con el pago a cuenta del IUE hasta agotarse (Art. 77) y saldo no compensado expuesto para baja manual; (3) Form 200 con casillas de compensación; (4) frontend `/reports/iue` + sección en el Form 200. Tests: 6 unitarios; backend 141 suites/1381 tests, E2E 81/81, frontend en verde. Ver `AUDIT.md` S39. | ✅ Completado |

## Fase 3.x — Preparación integración bidireccional SAP B1 ✅ (2026-08-31)

Capa de datos lista para el **conector bidireccional** con SAP B1. Los 11 modelos del flujo de ventas tienen identidad SAP (`sapDocEntry`/`sapDocNum`/`sapEtag`), ciclo de sincronización (`syncStatus`/`lastSyncedAt`/`lastSyncError`) e índice único `@@unique([tenantId, sapDocEntry])` para idempotencia (duplicado de DocEntry responde **409** vía `assertSapDocEntryAvailable`). Detalle técnico completo: `docs/reference/SAP_B1_INTEGRATION.md`.

| Fase | Alcance | Estado |
|------|---------|--------|
| 3.1 | Cotizaciones + pedidos: campos SAP, ciclo sync, índice único, preservación condicional (editar desde UI no borra identidad), backorder sin herencia de identidad | ✅ |
| 3.2 | Entregas: campos SAP + `shipDate`/`sapLineNum` en líneas; los 7 flujos de creación | ✅ |
| 3.3 | Facturas (normal + reserva): campos SAP, `isReserve` (SAP `ReserveInvoice`), `sapLineNum`/`shipDate`; dualidad `SaleReserveInvoice` (legacy solo-lectura) documentada | ✅ |
| 3.4 | Pagos recibidos: campos SAP + `sapLineNum` en la aplicación (`PaymentInvoices`); línea → factura por `sapDocEntry` | ✅ |
| 3.5 | Devoluciones de venta: campos SAP, origen `BaseType 15` (entrega) → `deliveryOrderId` | ✅ |
| 3.6 | Notas de crédito: campos SAP + `paidAmount`/`balanceDue` (abono parcial `PaidToDate`); abono existente (`IncomingPayment` CREDIT_NOTE) actualiza el saldo | ✅ |
| 3.7 | **Enriquecimiento de datos nativos + UX/UI**: `reference2`/`docTime`/`sapSeries` (8 headers), `sapControlAccount` (factura/NC), `isConsignment` (entrega), `returnAction`/`returnReason`/`returnCost`/`enableReturnCost` (líneas NC/devolución); componente frontend `app-sap-integration-section` (identidad + badge sync + campos) en los formularios de documentos. **3.7c:** tabla maestra `ReturnReason` (Reason Codes SAP, kind ACTION/REASON, `sapCode`) con CRUD + UI en `/return-reasons`, FK `returnReasonId` en líneas de NC/devolución y selector del catálogo en las líneas | ✅ |
| 3.8 | **Bases de integración bidireccional en COMPRAS**: mismo patrón de ventas en los 8 documentos de compra (cotización, pedido, recepción, factura, factura reserva, pago saliente, devolución, NC) — `sapDocEntry`/`sapDocNum`/`sapEtag` + ciclo sync + `@@unique([tenantId, sapDocEntry])` con idempotencia 409 + preservación condicional + `shipDate`/`sapLineNum` en líneas + `sapControlAccount`/`paidAmount`/`isConsignment`/`returnAction`/`returnReason` (−1→null). Helper ampliado a 16 modelos; resolvers buscan `sapCardCode`/`sapItemCode` con fallback a `code`; sección `app-sap-integration-section` en los 8 formularios de compras. Mapeo validado con 8 payloads reales (ver `docs/plans/plan-compras-sap-fase38.md`). **3.8.5 ✅ líneas de servicio sin artículo** (ItemCode null + AccountCode directo) en ventas y compras: `itemId` nullable en los 4 modelos de línea (migración `20260902160000_service_lines_no_item`), DTOs `itemId` opcional + `acctCode` obligatorio, motor contable usa la cuenta directa (verificado live: FVE-000032 → ASI-000199 Cr a cuenta 265, balanceado), servicios sin stock/tracking, frontend toggle por línea Artículo ⇄ Cuenta en facturas y NC (4 formularios) | ✅ backend + frontend |

**Mapeos SAP clave resueltos:** `BaseType 23`=cotización, `17`=pedido, `15`=entrega, `13`=factura; `ReserveInvoice: "tYES"`=factura reserva; `PaymentInvoices[].InvoiceType: "it_CreditMemo"`=NC (relación NC↔abono nativa, vive en el pago); UDF personalizados (`U_CXS_BREF` etc.) **no** se usan como fuente de verdad.

**Pendiente:** el conector real a SAP Service Layer (F5.3), sincronización de estados (cerrar/cancelar).

## Series de numeración de documentos (patrón SAP B1) — Fase 1 VENTAS ✅ (2026-09-02)

Módulo para gestionar **series de correlativo por tipo de documento acotadas a un período**
(gestión): cada serie define prefijo + número inicial + rango de fechas propio
(+ referencia opcional a FiscalYear/AccountingPeriod). Ej.: serie COT-2025 (rango 2025) →
`COT-250000001…`; serie COT-2026 (rango 2026) → `COT-260000001…`. Permite **asignar una serie
por defecto a cada usuario** (por tipo de documento) y **heredar el correlativo** de una serie
de la gestión anterior al crear la siguiente (`continueFromSeriesId`). Si un tipo NO tiene
series configuradas → fallback al generador clásico (cero regresión); si las tiene → todo
documento debe caer en una serie que cubra la fecha (exigir serie siempre, 400 claro si no).

- **Backend:** modelos `DocumentSeries` + `UserDocumentSeries` (migraciones
  `20260903000000_document_series`, `20260903010000_document_series_doc_links` con
  `documentSeriesId` en los 8 headers de venta); módulo `src/document-series/` (CRUD +
  asignación usuario + `resolveSeries` con prioridad usuario → default → única que cubre +
  `nextDocumentCode` atómico `UPDATE…RETURNING nextNumber-1` dentro de la tx del documento);
  integrado en los **9 servicios de venta** (32 call-sites: cotización 1, pedido 4, entrega 7,
  factura 8 vía dispatcher FVE/FRV, FRV 7, devolución 1, NC 2, ND 1, pago recibido 1) con la
  fecha contable del documento y el usuario creador; permiso `document-series` registrado.
- **Verificado live (2026-09-02):** COT-2025 → cotizaciones `COT-250000001`, `COT-250000002`;
  COT-2026 → `COT-260000001`; asignación usuario→serie OK; prioridad de resolución OK; fecha
  2024 fuera de rango → 400 «No existe una serie activa de SALES_QUOTATION que cubra la fecha…».
- **Tests:** document-series.service.spec 29 + controller 5; suite backend **1520/1520**;
  frontend página 35 + selector/forms 47; Karma **1421/1421**. Build + lint OK.
- **Plan:** `docs/plans/plan-series-numeracion.md`.
- **Frontend ✅ (2026-09-02):** página `/document-series` (listado + form + asignación usuario
  por tipo) y selector `app-document-series-select` integrado en los **9 forms de venta**
  (cotización, pedido, entrega, factura de venta, factura de reserva en Fase 1; devoluciones,
  NC, ND y pagos recibidos en **Fase 2**) con override `documentSeriesId` en el payload de
  creación. **Fase 3 ✅ COMPRAS (10 tipos):** columna `documentSeriesId` en los 10 headers de
  compra, integrado en los 10 servicios de compra (dispatcher FCP/FRC) y selector en los 10
  formularios de compra; `doc-types` = 19. Verificado live: serie PO-2026 → pedido de compra
  **PO-260000001**; backend 1521/1521, Karma 1421/1421. **Fase 4 ✅ INVENTARIO (5 tipos,
  2026-09-04):** enum `DocumentType` + `STOCK_COUNT` y columna `documentSeriesId` en los 5
  headers de inventario (entradas StockEntry, salidas StockExit, traspasos StockTransfer,
  ajustes StockAdjustment, tomas StockCount — migración `20260904000000_document_series_inventory`);
  integrado en los 5 servicios de inventario con la fecha contable del documento + usuario
  creador; `doc-types` = **24**; `_countUsages` cubre los 23 headers con series. Selector
  integrado en los 5 formularios de inventario (ENT/SAL/TRA/AJU/CON). **Cierre de huecos ✅
  (2026-09-04):** los flujos automáticos que generan un documento de OTRO tipo ya respetan la
  serie del tipo destino — `convertToOrder` → PO, abono NC venta → REC, abono NC compra →
  PAG y ajuste derivado de toma → AJU — todos vía `nextDocumentCode` (fecha del origen +
  usuario que ejecuta; fallback clásico si el tipo no tiene series; 400 claro si ninguna
  cubre la fecha); `documentSeriesId` persistido en cada header derivado. Backend 1524/1524.
  **Fase 4b ✅ LOGÍSTICA/PRODUCCIÓN (2 tipos, 2026-09-04):** guías de remisión
  (`TRANSPORT_GUIDE` — agregado al enum) y órdenes de ensamblaje (`ASSEMBLY_ORDER`) con
  series (migración `20260904100000_document_series_logistics`); `doc-types` = **26**;
  selector en los forms de guías y ensamblajes; `_countUsages` cubre 25 headers. **Deuda D ✅
  (2026-09-04):** `doc-types` devuelve `{value,label}` como fuente única del catálogo (el
  modelo frontend dejó de duplicar array/labels; se conserva el union type); specs de forms
  con template real mockean `DocumentSeriesService`; CHANGELOGs backend/frontend
  documentados. **Política de gestión contable ✅ (2026-09-04):** modo libre sin años
  fiscales (compatibilidad); al configurar gestión (≥1 año fiscal) los asientos automáticos
  deben caer en un período ACTIVO que cubra la fecha (409 fuera de rango; vínculo
  fiscalYearId/periodId) y las series deben enmarcarse en una gestión abierta; bugs del form
  de series corregidos (guard sin «¿guardar cambios?» tras guardar + docType visible en
  edición). Backend 1533/1533. **Rediseño serie→gestión + exigencia ✅ (2026-09-04):** la
  serie NUEVA exige año fiscal (vigencia derivada de la gestión, sin rango de fechas propio;
  progresivo para series existentes) y los DOCUMENTOS exigen serie definida (sin fallback
  clásico — 400 «Defina primero una serie de numeración…»). Backend 1532/1532, Karma
  1423/1423. **Cierre de huecos ✅ (2026-09-04):** borrado de gestión protegido contra series
  ligadas; selector avisa cuando el tipo no tiene series (evita el 400 sorpresa); código
  muerto `DOC_TYPE_SEQUENCE_MAP` eliminado. Backend 1533/1533, Karma 1425/1425.

| Prioridad | Feature | Descripción |
|-----------|---------|-------------|
| Alta | **F5.1 — Facturación Electrónica SIN Bolivia** | Firma digital, envío masivo, consulta de estado. *(siguiente feature prioritario)* |
| Alta | **F5.5 — Cumplimiento tributario BO (G2–G5, G9)** | IUE 25% + compensación IT (Art. 77), RC-IVA declarativo (Form 110), exportaciones tasa cero, prorrateo de crédito fiscal, **asientos contables del POS** (G9 — el checkout no postea al mayor). ~~Ventas menores POS (Art. 16)~~ ✅ T3, ~~UFV~~ ✅ T2, ~~ITF~~ ✅ T1. Plan detallado: `docs/plans/plan-cumplimiento-tributario-bo.md`. |
| Alta | **F5.2 — Integración Bancaria** | Conciliación automática de extractos, import CSV/Excel, matching de pagos. |
| Media | **F5.4 — CRM básico** | Oportunidades, actividades, pipeline. |
| Media | **F7.2 — Multi-divisa** | USD, EUR además de BOB. |
| Media | **F7.3 — Localización de reportes** | Para Chile, Perú, Argentina. |
| Baja→Alta | **F5.3 — SAP Integration Real (conector)** | Implementar el conector contra el SAP Service Layer (REST/OData): push/pull de maestros (sapItemCode/sapCardCode), cotizaciones, pedidos, entregas, facturas, pagos, devoluciones y NC (resolución por `sapDocEntry`), sincronización de estados (cerrar/cancelar), cola de reintentos y sync del abono de NC (`it_CreditMemo`). **La capa de datos ya está lista (Fase 3.x completa — 11 modelos con identidad SAP + idempotencia 409).** |

## Mejoras contables identificadas (auditoría 2026-07-20)

> Evaluación del motor de determinación de cuentas tras el endurecimiento contable.
> El diseño actual es correcto; estos son gaps para llevarlo al nivel SAP B1 completo.
> Implementar solo cuando el negocio lo requiera.

| Prioridad | Gap | Descripción / Alcance |
|-----------|-----|------------------------|
| Media | **Ingresos/gastos por jerarquía de artículo** | Hoy `SALES_REVENUE`/`PURCHASES` van solo por Account Mapping (una sola cuenta para todo el catálogo). Para P&L por línea de negocio: agregar `revenueAccountId`/`purchaseAccountId` a Item/ItemGroup/Warehouse + resolverlos en el engine antes del mapping. Tamaño mediano (schema + engine + forms). |
| Media | **Cuentas partner local/extranjero sin resolver** | Campos persistidos (AGENTS.md §5.2) pero sin resolución por país del partner. Al activar M/E real: CxC/CxP deben bifurcar M/N vs M/E automáticamente. |
| Baja | **Nivel ITEM no lee el maestro del artículo** | `Item.salesCreditAccountId` (y similares) existen en schema y forms pero la determinación nivel ITEM solo lee la matriz artículo-almacén (decisión deliberada con tests). Decidir: leer maestro como fallback (actualizando los 2 tests) o quitar el campo/mención del mensaje de error. |
| Baja | **Cuenta dedicada de redondeo** | El plug de redondeo (M9) postea a SALES_DISCOUNT; lo limpio sería una cuenta "Diferencias de redondeo" vía mapping. |
| Baja | **Descuento por pronto pago / retenciones en ventas** | No existen como entry types; evaluar cuando el negocio lo pida. |

---

## Criterios de aceptación por fase

| Fase | Criterio |
|------|----------|
| F0 | Schema sin errores, migración aplicada, tests pasando |
| F1 | Build limpio, 0 errores de Prisma, 0 inconsistencias |
| F2 | Feature completo con tests, frontend funcional, documentado |
| F3 | Flujo end-to-end funcional, traceability correcta |
| F4 | UX validada, reportes funcionando, permisos operativos |
| F5 | Integración probada con ambiente de pruebas del SIN/banco |
| F6 | Asientos cuadran, estados financieros correctos, auditoría aprobada |
| F8 | SLA verificado, backups validados, monitoreo operativo |

---

## Contabilidad opcional por tenant — "Habilitar Contabilización" + "Generar Plan de Cuentas" ✅ (2026-09-05)

Patrón SAP B1: los módulos existen; la parametrización decide. Un tenant puede operar
solo como **comercial/inventario** (sin asientos, sin exigencias de cuentas) o con
**contabilidad completa** (asientos automáticos + normativa de impuestos).

- **Flag `accountingEnabled` por tenant** (`SystemSettings`, default true — cero regresión;
  ausente = habilitado). Toggle en **Parametrización → Contabilidad** del tenant activo y
  switch en la **creación de tenants** (panel superadmin, default ON). Desactivar solo se
  permite sin asientos contables (409 backend + toggle inhabilitado en la UI).
- **Motor apagado:** los 18 métodos de creación automática del `AccountingEngineService`
  retornan sin efecto cuando el flag es false (el documento se confirma sin asiento y sin
  consultar cuentas); previews, asientos manuales y asiento de apertura responden 409/400.
- **Menú contable oculto:** con la contabilización deshabilitada el sidebar oculta los
  módulos cuya función es generar asientos — Asientos Contables, Plan de Cuentas, Mapeos
  Contables y **Activos Fijos** (categorías/activos/reporte, depreciación). **Pagos
  Recibidos/Efectuados, Bancos, Monedas, Tipos de Cambio, Extractos Bancarios y
  Reconciliaciones siguen visibles y operativos** (cobrar/pagar y el **control bancario**
  son operación comercial: el gate del motor salta su asiento y el saldo del partner se
  actualiza igual). **Años Fiscales permanece visible** (lo requieren las series de
  numeración). *Extractos/Reconciliaciones en modo comercial sin posteo (T12, 2026-09-05):
  `post()` registra el extracto sin generar asientos, el auto-match concilia contra
  pagos/cobros y el ajuste de diferencia (asiento) queda bloqueado con mensaje claro —
  ver AUDIT §8 T12.*
- **"Generar Plan de Cuentas"** (`GET/POST settings/chart-of-accounts`, idempotente):
  siembra el plan estándar **por país** (`resolveChartOfAccountsTemplate`: país →
  `UNIVERSAL` fallback → error). **Plantilla UNIVERSAL (2026-09-05):** estructura
  estándar IFRS-like en español que comparte códigos con BO — PE/CL/AR y cualquier país
  sin plan oficial generan plan + mappings + cuentas de mayor completos (antes 400);
  cuando un país registre su plan oficial, pasa a usarse automáticamente. Al habilitar
  sin plan, la UI pide generarlo explícitamente.
- **Seed de tenant:** un tenant que nace sin contabilidad no recibe plan/mappings/cuentas
  de mayor; `POST /tenants/:id/seed` respeta el flag actual.
- Tests: backend **1572/1572** (spec flaky de auth pasa en aislamiento); frontend Karma en
  verde + build AOT 0 errores. Plan: `docs/plans/plan-contabilidad-opcional.md`. **Guía de
  configuración paso a paso (por perfil, con/ sin contabilidad):**
  `docs/guides/guia-implementacion-configuracion.md`. **Centro de configuración ✅
  (2026-09-05):** pantalla `/setup` + `GET /setup/checklist` que valida automáticamente el
  checklist por perfil (qué falta y a qué pantalla ir) — Anexo C de la guía. **Mejoras ✅:
  mini-wizard "Resolver siguiente paso"** en `/setup` (navega al primer bloqueante en orden
  de la guía); **vista multi-tenant para superadmin** (`GET /admin/setup-overview` +
  `/super-admin/setup-overview`); **"Documentos que usaré"** (series solo para los tipos
  habilitados, `GET/PUT /setup/doc-types`); **badge proactivo** de bloqueantes en el menú
  (`GET /setup/status`); **checks de consistencia** (costos de artículos, impuesto por
  defecto de partners, tasa del día, **cuentas de mayor por nivel de determinación**);
  **guardas de ruta contables** (URLs directas redirigen al dashboard con contabilidad OFF);
  **prueba E2E guiada + gate go-live** (guía Anexo D + runbook-go-live §6).

---

## Notas técnicas

- **Deuda técnica consolidada (2026-09-05):** ver `AUDIT.md` §8 — foto única y priorizada
  (T1–T14) de la deuda vigente (drift BD, specs flaky ✅, carga multitenant ✅, special-prices ✅,
  cierre de ejercicio ✅, depreciación automática ✅, F7.2 contable ✅, assembly refactor ✅,
  sourceDocumentType enum, cosmética UX, POS numeración ✅, extractos modo comercial ✅,
  guardas de ruta ✅, planes por país).
- **Migraciones:** Cada fase requiere migración Prisma. En producción, usar `prisma migrate dev` con nombres descriptivos.
- **Frontend types:** Actualizar `prisma-types.ts` y modelos en `src/app/models/` tras cada cambio de schema.
- **Tests:** Mantener 118+ suites backend y 622+ tests frontend. Agregar tests para cada nuevo feature.
- **Zero `as any`:** Mantener la política de 0 casts `as any` en código de producción.
- **Multi-tenancy:** Cada nuevo modelo DEBE tener `tenantId` y `@@index([tenantId])`.

---

*Última actualización: 2026-09-05 (T11 ✅ POS numeración por series del módulo; antes: T4 special-prices ✅, T12 extractos modo comercial ✅, T3 carga multitenant ✅ y T8 AssemblyOrder ✅ cerradas en AUDIT §8)*
