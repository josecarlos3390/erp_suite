# ROADMAP.md — ERP Suite

> Hoja de ruta única y consolidada. Estado actualizado al 2026-08-08.

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
| ✅ 3.4 | **Importación masiva** | Upload Excel (.xlsx/.xls) para artículos, partners y stock inicial; validación de errores. | ✅ Implementado para artículos, partners y stock. |

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
| ☐ 6.4 | **Estado de resultados y balance** | Reportes financieros estándar. | Pendiente (requiere F6.1 Accounting Engine primero) |

### Fase 6.1 — Accounting Engine Integrado (En progreso)

- ✅ Servicio `AccountingEngine` creado (`src/common/accounting-engine.service.ts`) con generación de asientos para ventas, compras, pagos y stock.
- ✅ Validación de partida doble al postear asientos (`totalDebit === totalCredit`).
- ✅ Saldos por cuenta en tiempo real vía `JournalEntryLine` POSTED.
- ⏳ Falta refactorizar `AssemblyOrder` para usar `AccountingEngine` en lugar de su lógica propia.

### Fase 6.2 — Dimensiones Contables (En progreso)

- ✅ Modelos `CostCenter` y `Project` creados; usados en documentos comerciales y asientos.
- ✅ `projectId` y `costCenterId` disponibles en `JournalEntryLine`.
- ⏳ `Dimension1` / `Dimension2` personalizables pendientes.

### Fase 6.3 — Estados Financieros (Pendiente)

- Balance General.
- Estado de Resultados.
- Estado de Flujo de Efectivo.

### Fase 6.4 — Cierre de Período (En progreso)

- ✅ Modelos `FiscalYear` y `AccountingPeriod` creados en Prisma.
- ✅ CRUD backend (`src/fiscal-years/`) + frontend (`src/app/pages/fiscal-years/`).
- ✅ Estados `OPEN` / `LOCKED` para bloquear modificaciones en períodos cerrados.
- ⏳ Asientos de cierre de ejercicio automáticos pendientes.

### Fase 6.5 — Activos Fijos (En progreso)

- ✅ Módulo `FixedAsset` creado en backend (`src/fixed-assets/`) y frontend (`src/app/pages/fixed-assets/`).
- ✅ Depreciación lineal implementada.
- ⏳ Depreciación acelerada pendiente.
- ⏳ Asientos de depreciación mensual automáticos pendientes.

### Fase 6.6 — Nómina (Pendiente)

- `Employee`, `Payroll`, `Salary`.
- Cálculo de haberes/descuentos según ley boliviana.

---

## Fase 7 — Internacionalización y zona horaria ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 7.1 | **Zona horaria parametrizable por tenant** | Campo `timeZone` en `Tenant`; helpers `toTenantDate`/`fromTenantDate`; formularios, reporting y PDFs migrados. | ✅ Completado |
| ✅ 7.2 | **Moneda multi-divisa** | Soporte para USD, EUR además de BOB. Campo `currency` en documentos y tasa de cambio diaria. **Backend contable implementado:** `Account.currencyMode` (LOCAL/SYSTEM/MULTI/SPECIFIC), `Tenant.localCurrency`/`systemCurrency`, doble expresión en `JournalEntryLine`. **Frontend completo (2026-08-09):** account-form con `currencyMode`/`currency` + hint con monedas del tenant, columna Moneda legible en el listado de cuentas, journal-entries-form con moneda por línea y M/E editable/calculado, listado de asientos con totales M/N + M/E, ledger con las 4 expresiones. Pendiente: diferencia de cambio automática en asientos manuales (hoy el usuario agrega la línea a mano) y gain/loss accounts del settings sin consumo por builders. | ✅ Completado (UI) |
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
| ☐ DT.16 | **POS delegando en `sale-invoices.service`** | `pos.service.ts` crea la factura con lógica propia; migrar a delegación para no replicar fixes contables. **Nota:** análisis en S2 concluyó que la delegación pura rompería el comportamiento del POS (venta atómica con pago); se resolvió con helpers compartidos (`applyOutgoingStock`). Queda como opcional si se decide homogeneizar completamente. | ☐ Pendiente |
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
| ✅ DT.32 | **Mismo tratamiento contable FRV/FRC + reversa del IT + reporte Form 200 (S19)** | (2026-08-10) **Corrección de negocio validada con el ejemplo oficial del SIN (Formulario 200):** la factura de reserva (FRV) y la normal (FV) tienen el **mismo tratamiento contable** — CxC, ingreso, IVA débito (13% por dentro), descuento 87/13, IT 3% e ICE — y solo difieren en que la **reserva no mueve inventario** (el stock se mueve por la entrega/recepción). Igual en compras: FRC = FPI financieramente (CxP, IVA crédito, retenciones, descuento), con `ALLOCATION` en vez de `INVENTORY`. Cambios: (1) el **IT ahora aplica también a la FRV** (antes se excluía con `isReserve !== 'Y'`); (2) **reversa del IT** en NC de venta (Dr IT por Pagar / Cr IT gasto), **IT adicional** en ND de venta, y **reversa del IT** en devolución de venta con reversa financiera — para que la cuenta de IT por pagar cuadre con los ingresos netos del período; (3) NC/ND/devolución ahora desglosan el descuento **87/13** y revierten el **descuento de cabecera** (plug espejo de la factura, con ajuste de redondeo). Nuevo **reporte de declaración tributaria** `GET /reports/tax-declaration` (Formulario 200: ingresos brutos, débito/crédito fiscal, descuentos otorgados/obtenidos, IT, ICE, retenciones RC-IVA/IUE/IT, saldo a favor) + pantalla en Reports. Validación normativa completa de las 4 familias (ventas, compras, pagos, inventario) contra Ley 843 TO 30/09/2023, DS 21530, DS 21532 y el ejemplo oficial del Form 200 del SIN (débito = ingresos × 13%, crédito = compras × 13%). 5 tests unitarios A8 + 1 E2E. Backend 133 suites/1311 tests y frontend en verde. | ✅ Completado |
| ✅ DT.33 | **Split 87/13 indicator-aware + Form 200 completo (S20)** | (2026-08-12) **1)** El desglose del descuento 87/13 en **ventas** ahora respeta el **método del indicador fiscal de la línea** (helper `resolveDiscountSplit` en `journal-entry-core.ts`), igual que compras: una línea STANDARD o tasa cero en un tenant BO ya no se desglosa 87/13; sin indicador, usa el método por defecto del país. Aplicado a FV, NC, ND y devolución. **2)** El reporte de declaración se completa con la **base de compras** (casilla 26: FPI/FRC − NC de compra) y el **detalle de documentos de compra** (facturas y NC) en la pantalla del Form 200. Frontend actualizado. 1 test unitario nuevo. | ✅ Completado |
| ✅ DT.34 | **Retención type-aware en el pago + ICE por artículo (S21)** | (2026-08-12) **1) Retención type-aware en el pago saliente:** nuevo campo `OutgoingPayment.withholdingTaxTypeId` (migración + db push erp_db/erp_test). Al registrar una retención con su tipo (IT/IUE/RC-IVA), el asiento del pago acredita la **cuenta específica del tipo** (`WithholdingTaxType.accountId`: RC-IVA→2.1.2.01.006/007, IUE→2.1.2.01.008, IT→2.1.2.01.009) en lugar de la genérica de IT (2.1.2.01.009). Sin tipo, se conserva el fallback legacy (mapping `WITHHOLDING_TAX_PAYABLE`). DTOs create/update + validación + preview de borrador + selector de tipo en el form de pagos (consume `WithholdingTaxesService`). **2) ICE por artículo (Form 605/608):** el reporte de declaración ahora desglosa el ICE por artículo (base, tasa y monto por ítem) además del total del pasivo. 1 test unitario nuevo. | ✅ Completado |
| ✅ DT.35 | **ICE específico por unidad (DS 24053) + Libro de Compras y Ventas (S22)** | (2026-08-12) **1) ICE específico por unidad:** el ICE boliviano (DS 24053) se liquida en su mayoría por **monto fijo por unidad** (Bs/litro, Bs/paquete) y no solo por porcentaje. Nuevos campos `Item.iceBasis` (`PERCENTAGE` | `SPECIFIC`) + `Item.iceAmountPerUnit` (migración + db push). El builder de venta calcula la línea de ICE según la base: `SPECIFIC` → cantidad × monto por unidad; `PERCENTAGE` → neto × tasa. Form de artículo con selector de base ICE y campo de monto por unidad (condicional). **2) Libro de Compras y Ventas (IVA):** nuevo reporte `GET /reports/iva-books?from&to` (solo countryCode BO) con el detalle mensual por factura — ventas (FV+FRV), compras (FPI+FRC) y NC como filas — con código, fecha, NIT, razón social, total, base e IVA, más débito/crédito fiscal netos (respaldo del Form 200). Pantalla en Reports con tabs Ventas/Compras. 1 test unitario nuevo (ICE específico). | ✅ Completado |
| ✅ DT.36 | **Cierre de período contable — protección en el motor (S23)** | (2026-08-12) La infraestructura de períodos contables ya existía (`FiscalYear`/`AccountingPeriod`, `AccountingPeriodsService.close/reopen/validatePostingDate`, controller y UI de fiscal-years), y protegía los **asientos manuales** y activos fijos — pero **no los asientos automáticos** (confirmación de documentos). Fix en `JournalEntryCore._persist` (punto único por el que pasan TODOS los asientos): (1) si existe un período para la fecha del asiento y está **cerrado/bloqueado** (o su año fiscal cerrado), se bloquea la creación del asiento con `ConflictException` — cubre facturas de venta/compra, pagos, stock, etc.; (2) cuando existe período, el asiento queda **vinculado** a `fiscalYearId`/`periodId` (trazabilidad + control de borradores al cerrar); (3) si no existe período configurado, se permite (compatibilidad con tenants sin años fiscales). 2 tests unitarios nuevos (bloqueo en período cerrado + vínculo del asiento). | ✅ Completado |
| ✅ DT.37 | **Fix: descuento no figura en FRV desde entrega (S24)** | (2026-08-12) Caso reportado: FRV de venta con descuento desde la entrega (DEL-000057) — el asiento preliminar no mostraba el descuento. Tres bugs encadenados corregidos: **(1)** `delivery-orders.createManual` ignoraba `line.discountPct` del payload (solo usaba el descuento automático de grupo/periodo) → la entrega nacía sin descuento; **(2)** el módulo `sale-reserve-invoices.createFromDelivery` usaba solo el `discountPct` del payload sin heredar el del ítem de la entrega (viola R1 — el descuento se propaga del origen) en las ramas "entrega suelta" y "resolver genérico"; **(3)** el módulo FRV persistía `item.subtotal = lineTotal` (con IVA) en lugar del neto y no persistía `lineSubtotal`, corrompiendo el preview del documento confirmado (doble conteo del descuento). Fix: subtotal neto + `lineSubtotal` persistidos (con fallback para registros viejos en `_generateJournalEntry`). 1 test unitario (descuento de línea 350×5/8% → 87/13) + 1 E2E (entrega manual con descuento → FRV → asiento con SALES_DISCOUNT y preview con descuento). | ✅ Completado |
| ✅ DT.38 | **Fix: previewFromDraft descartaba discountTotal (S25)** | (2026-08-12) Caso reportado: al generar la FRV con "copiar a" desde la entrega (DEL-000059, del flujo COT-000071→PED-000048) el **asiento preliminar del formulario** no mostraba el descuento (aunque la factura sí lo tenía). Causa raíz: `JournalEntriesService.previewFromDraft` mapeaba las líneas del DTO al draft del preview **omitiendo `discountTotal`** (y también `taxIndicatorId`, `purchaseReceiptItemId`, `receiptExchangeRate`, `baseDocType`). El backend recibía el descuento en el payload pero lo descartaba → el builder contabilizaba el ingreso por el neto sin la línea de SALES_DISCOUNT. Fix: el mapeo ahora incluye **todos** los campos de `DraftPreviewDocument.lines`. Verificado en vivo contra la API (preview muestra 87% → 73.08 SALES_DISCOUNT + 13% → 10.92 IVA crédito) y con test E2E de regresión `preview-draft`. | ✅ Completado |

---

## Features de negocio pendientes (roadmap)

| Prioridad | Feature | Descripción |
|-----------|---------|-------------|
| Alta | **F5.1 — Facturación Electrónica SIN Bolivia** | Firma digital, envío masivo, consulta de estado. *(siguiente feature prioritario)* |
| Alta | **F5.2 — Integración Bancaria** | Conciliación automática de extractos, import CSV/Excel, matching de pagos. |
| Media | **F5.4 — CRM básico** | Oportunidades, actividades, pipeline. |
| Media | **F7.2 — Multi-divisa** | USD, EUR además de BOB. |
| Media | **F7.3 — Localización de reportes** | Para Chile, Perú, Argentina. |
| Baja | **F5.3 — SAP Integration Real** | Reemplazar mock por conector real a SAP B1. |

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

## Notas técnicas

- **Migraciones:** Cada fase requiere migración Prisma. En producción, usar `prisma migrate dev` con nombres descriptivos.
- **Frontend types:** Actualizar `prisma-types.ts` y modelos en `src/app/models/` tras cada cambio de schema.
- **Tests:** Mantener 118+ suites backend y 622+ tests frontend. Agregar tests para cada nuevo feature.
- **Zero `as any`:** Mantener la política de 0 casts `as any` en código de producción.
- **Multi-tenancy:** Cada nuevo modelo DEBE tener `tenantId` y `@@index([tenantId])`.

---

*Última actualización: 2026-08-08*
