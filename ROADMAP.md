# ROADMAP.md — ERP Suite

> Hoja de ruta única y consolidada. Estado actualizado al 2026-07-03.

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

---

## Fase 5 — Avanzado (diferenciadores) ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 5.1 | **Precios por escala** | Tabla `PriceListItemScale` con `maxQty`, descuentos/precios por cantidad. | ✅ Implementado y testeado. |
| ✅ 5.2 | **Bancos y cuentas bancarias** | CRUD de cuentas; asociar pagos a cuenta bancaria; saldo bancario. | ✅ Modelos `Bank` y `BankAccount`. Endpoints CRUD. Frontend `/banks`. |
| ✅ 5.3 | **BOM / Ensamblaje** | Receta de fabricación (`ItemBom`) + ensamblaje de kits (`POST /items/:id/assemble`). | ✅ Backend + frontend. Falta `ProductionOrder` como entidad separada (Fase 6). |
| ☐ 5.4 | **CRM básico** | Oportunidades de venta, actividades/calendario por partner, pipeline. | Pendiente |

---

## Fase 6 — Contabilidad 🔄

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 6.1 | **Plan de cuentas** | CRUD de cuentas contables (activo, pasivo, patrimonio, ingreso, egreso). | ✅ Backend + frontend. Ruta `/accounts`. |
| ✅ 6.2 | **Asientos contables** | Modelos `JournalEntry`/`JournalEntryLine`, CRUD + post/cancel. Doble expresión monetaria (`debitLocal`/`creditLocal`/`debitSystem`/`creditSystem`) + validación de moneda por cuenta. | ✅ Backend completo. Frontend pendiente (Fase 9). |
| ✅ 6.3 | **Libro de compras/ventas** | Reportes fiscales bolivianos formateados. | ✅ Endpoints `GET /reports/sales-ledger` y `GET /reports/purchase-ledger`. |
| ☐ 6.4 | **Estado de resultados y balance** | Reportes financieros estándar. | Pendiente (requiere F6.1 Accounting Engine primero) |

### Fase 6.1 — Accounting Engine Integrado (Pendiente)

- Generación automática de asientos desde documentos comerciales.
- Validación de partida doble (debit == credit).
- Saldos por cuenta en tiempo real.

### Fase 6.2 — Dimensiones Contables (Pendiente)

- `CostCenter`, `Project`, `Dimension1`, `Dimension2` en `JournalEntryLine`.

### Fase 6.3 — Estados Financieros (Pendiente)

- Balance General.
- Estado de Resultados.
- Estado de Flujo de Efectivo.

### Fase 6.4 — Cierre de Período (Pendiente)

- `FiscalPeriod` / `AccountingPeriod`.
- Bloqueo de modificaciones en períodos cerrados.
- Asientos de cierre de ejercicio.

### Fase 6.5 — Activos Fijos (Pendiente)

- `FixedAsset` con depreciación (lineal, acelerada).
- Asientos de depreciación mensual.

### Fase 6.6 — Nómina (Pendiente)

- `Employee`, `Payroll`, `Salary`.
- Cálculo de haberes/descuentos según ley boliviana.

---

## Fase 7 — Internacionalización y zona horaria ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 7.1 | **Zona horaria parametrizable por tenant** | Campo `timeZone` en `Tenant`; helpers `toTenantDate`/`fromTenantDate`; formularios, reporting y PDFs migrados. | ✅ Completado |
| 🔄 7.2 | **Moneda multi-divisa** | Soporte para USD, EUR además de BOB. Campo `currency` en documentos y tasa de cambio diaria. **Backend contable implementado:** `Account.currencyMode` (LOCAL/SYSTEM/MULTI/SPECIFIC), `Tenant.localCurrency`/`systemCurrency`, doble expresión en `JournalEntryLine`. Falta frontend de cuentas y asientos. | 🔄 Backend listo. Frontend pendiente. |
| ☐ 7.3 | **Localización de reportes fiscales** | Plantillas de libro de compras/ventas adaptables a otros países (Chile, Perú, Argentina). | ☐ Pendiente |

---

## Fase 8 — SaaS & Operaciones ✅

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 8.1 | **Billing y suscripciones** | Modelo `Subscription` 1:1 con `Tenant`, estados `TRIAL/ACTIVE/PAST_DUE/CANCELLED/EXPIRED`, activación/cancelación manual, cron diario. | ✅ MVP implementado: backend + frontend `/billing`. |
| ✅ 8.2 | **Rate limiting por tenant** | `TenantThrottlerGuard` diferencia límites por plan (`SHARED` 300 req/min, `DEDICATED` 2000 req/min). | ✅ Backend: tests unitarios, docs `RATE_LIMITING.md`. |
| ✅ 8.3 | **Backups y disaster recovery** | Scripts de backup/restore de PostgreSQL, documentación de RPO/RTO y validación periódica. | ✅ Scripts `backup-db.js`/`restore-db.js`, `docs/BACKUPS.md`. |
| ✅ 8.4 | **Monitoreo y alertas** | Health checks (`@nestjs/terminus`) y métricas Prometheus (`prom-client`). | ✅ Backend: `/health`, `/metrics`, `docs/MONITORING.md`. |
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

*Última actualización: 2026-07-03*
