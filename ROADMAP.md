# ROADMAP ERP Suite

> Roadmap de mejoras y nuevos módulos. Ordenado por fases de prioridad.

---

## Fase 1 — Operación esencial *(bloqueante para usar en producción)*

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 1.1 | **PDF de documentos** | Generar PDF para facturas, pedidos, cotizaciones y recibos de pago con membrete institucional. Backend con `pdfmake`. | ✅ Funcionando para: Factura de Venta, Factura de Compra, Pedido de Venta, Cotización. |
| ✅ 1.2 | **Estado de cuenta por partner** | Pantalla que muestre todas las transacciones (facturas, pagos, NC/ND) de un partner con saldo corriente. | ✅ Implementado en `partner-detail` (tabs: Estado de Cuenta + Documentos Abiertos). |
| ✅ 1.3 | **Aging report / Vencimientos** | Reporte de deudas por cobrar/pagar agrupado por 0-30, 31-60, 61-90, 90+ días. | ✅ Endpoint `GET /reports/aging` con filtros CLIENTE/SUPPLIER. Frontend en `/reports/aging` con resumen y tabla exportable a CSV. |
| ✅ 1.4 | **Alertas de vencimiento** | Toast/alerta automática al iniciar sesión si hay facturas por vencer o vencidas. | ✅ Backend: reglas `INVOICE_OVERDUE` (venta+compra) y `INVOICE_DUE_SOON`. Frontend: toasts automáticos en `LayoutComponent`. |
| ✅ 1.5 | **Solicitudes de Compra** | Flujo completo: creación → envío a aprobación → aprobación/rechazo → conversión a Orden de Compra. Estados: DRAFT/PENDING/APPROVED/REJECTED/CLOSED. | ✅ Backend: `PurchaseRequestsModule` (16 endpoints, 9 tests). Frontend: listado con filtros, formulario con action bar condicional, modal de conversión con partner-selector. Prisma: `PurchaseRequest` + `PurchaseRequestItem`. |

### Notas técnicas Fase 1.1
- Servicio `PdfService` creado en `backend-erp/src/common/pdf/pdf.service.ts` usando `pdfmake/js/Printer`.
- Plantillas:
  - `sale-invoice.template.ts` — Factura de Venta
  - `purchase-invoice.template.ts` — Factura de Compra
  - `sales-order.template.ts` — Pedido de Venta
  - `sales-quotation.template.ts` — Cotización
- Endpoints: `GET /:resource/:id/pdf` devuelve `application/pdf` con `Content-Disposition: inline`.
- Frontend: botón "📄 Descargar PDF" en cada formulario (visible cuando el documento tiene ID).
- Patrón replicable: agregar `CommonModule` al módulo, inyectar `PdfService`, crear plantilla, agregar endpoint, agregar botón en frontend.

### Notas técnicas Fase 1.3
- Backend: `GET /reports/aging?type=CUSTOMER|SUPPLIER` calcula antigüedad de facturas pendientes (`balanceDue > 0`) usando `dueDate` vs fecha actual.
- Frontend: componente `aging-report` con tabs Cliente/Proveedor, cards de resumen por rango, tabla con alertas visuales (rojo para 90+ días), exportación CSV.

### Notas técnicas Fase 1.5 — Solicitudes de Compra
- **Backend**: `PurchaseRequestsModule` con 16 endpoints REST. Flujo de estados: `DRAFT` → `submit()` → `PENDING` → `approve()` → `APPROVED` → `convertToOrder()` → `CLOSED`. Rechazo y cancelación disponibles desde `PENDING`.
- **Conversión a Orden de Compra**: `POST /purchase-requests/:id/convert` crea `PurchaseOrder` vinculada (`purchaseRequestId`), genera código con `purchase_orders_code_seq`, copia líneas recalculadas con `isInclusive` real del indicador, y cierra la solicitud.
- **Frontend**: `PurchaseRequestsFormComponent` NO extiende `DocumentFormBase` (componente standalone). Action bar condicional por estado (`canEdit`, `canSubmit`, `canApprove`, `canReject`, `canConvertToOrder`, `canClose`). Modal de conversión con `app-partner-selector mode="modal"`.
- **Prisma**: modelo `PurchaseRequest` con `status: PurchaseRequestStatus` (enum nativo PostgreSQL), relación `items: PurchaseRequestItem[]`, y `purchaseOrders: PurchaseOrder[]`.

---

## Fase 2 — Control de acceso y permisos

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 2.1 | **Tabla de permisos granulares** | Backend: `@RequirePermission` en todos los endpoints, `PermissionsGuard` global, permisos en JWT. | ✅ 24+ controllers migrados. `PermissionsGuard` lee permisos del JWT payload (sin DB hit). |
| ✅ 2.2 | **Gestor de roles** | Frontend: CRUD de roles con matriz de permisos (checklist por módulo). | ✅ Pantalla `/permissions` con editor de matriz por rol. |
| ☐ 2.3 | **Restricción por almacén** | Opcional: usuario solo ve documentos de ciertos almacenes. | Pendiente (requiere matriz usuario-almacén) |

---

## Fase 3 — Inventario avanzado

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 3.1 | **Lotes** | Campo `batchId` + `expiryDate` en `StockMovement` y líneas de documento; tracking en kardex. | ✅ Modelo `Batch` con `expiryDate`. `batchId` en todas las líneas de documento y en `StockMovement`. |
| ✅ 3.2 | **Números de serie** | Campo `serialNumberId` (1 unidad = 1 serie); validación de unicidad por almacén. | ✅ Modelo `SerialNumber` con `warehouseId` y `status`. `serialNumberId` en líneas de documento y `StockMovement`. Validación `validateSerialNumber()` verifica disponibilidad y almacén. |
| ✅ 3.3 | **Kardex formal** | Reporte independiente: movimientos de un artículo con saldo acumulado por fecha. | ✅ Endpoint `GET /items/:id/kardex`. Frontend `/kardex/:itemId` con tabla de movimientos y saldo acumulado. |
| ☐ 3.4 | **Importación masiva** | Upload CSV/Excel para artículos, partners y stock inicial; con validación de errores. | Pendiente (artículos ya tiene bulk import vía Excel; falta partners y stock) |

---

## Fase 4 — UX, notificaciones y reporting

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 4.1 | **Dashboard con KPIs** | Cards: ventas del mes, compras, top 5 artículos, stock bajo, cobranza pendiente. | ✅ Endpoint `GET /dashboard` con 10 métricas. Frontend con 6 cards de KPIs. |
| ✅ 4.2 | **Centro de notificaciones** | Badge en header con lista de: aprobaciones pendientes, stock bajo, vencimientos. | ✅ `AlertPanelComponent` con badge en sidebar y panel deslizable. |
| ✅ 4.3 | **Búsqueda global** | Input en header que busque partners, artículos y documentos por código. | ✅ Endpoint `GET /search`. Frontend `/search` con resultados agrupados. Input del sidebar navega a búsqueda global al presionar Enter. |
| ✅ 4.4 | **Logs de auditoría** | Tabla `AuditLog` (quién, qué, cuándo, valor anterior/nuevo) en documentos clave. | ✅ Modelo Prisma `AuditLog`, endpoint `GET /audit-logs` con filtros. Frontend `/audit-logs` con tabla paginada. |

---

## Fase 5 — Avanzado (diferenciadores)

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ☐ 5.1 | **Precios por escala** | Tabla `PriceScale` (cantidad mínima → precio) por artículo y lista de precio. | Pendiente (no existe en schema) |
| ✅ 5.2 | **Bancos y cuentas bancarias** | CRUD de cuentas; asociar pagos a cuenta bancaria; saldo bancario. | ✅ Modelos `Bank` y `BankAccount`. Endpoints CRUD. Frontend `/banks` con tabs Bancos/Cuentas. |
| ✅ 5.3 | **BOM / Ensamblaje** | Receta de fabricación (`ItemBom`) + ensamblaje de kits (`POST /items/:id/assemble`). Orden de producción formal pendiente para Fase 6. | ✅ Backend + frontend. Falta documento `ProductionOrder` como entidad separada. |
| ☐ 5.4 | **CRM básico** | Oportunidades de venta, actividades/calendario por partner, pipeline. | Pendiente (sin iniciar) |

---

## Fase 6 — Contabilidad

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 6.1 | **Plan de cuentas** | CRUD de cuentas contables (activo, pasivo, patrimonio, ingreso, egreso). | ✅ Backend `AccountsModule` (CRUD + Prisma model `Account`). Frontend `AccountsComponent` con ruta `/accounts` y entrada en sidebar. |
| ✅ 6.2 | **Asientos contables** | Modelos `JournalEntry`/`JournalEntryLine`, enum `JournalEntryStatus`, `JOURNAL_ENTRY` en `DocumentType`. Backend `JournalEntriesModule` con CRUD + post/cancel. Frontend `JournalEntriesComponent` + `JournalEntriesFormComponent` con tabla dinámica de líneas y validación de cuadre. | ✅ Completado — ruta `/journal-entries`. |
| ✅ 6.3 | **Libro de compras/ventas** | Reportes fiscales bolivianos formateados. | ✅ Endpoints `GET /reports/sales-ledger` y `GET /reports/purchase-ledger`. Frontend con tabs y tablas detalladas. |
| ☐ 6.4 | **Estado de resultados y balance** | Reportes financieros estándar. | Pendiente (requiere F6.1 Accounting Engine primero) |

---

## Fase 7 — Internacionalización y zona horaria

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 7.1 | **Zona horaria parametrizable por tenant** | Campo `timeZone` en `Tenant`; helpers `toTenantDate`/`fromTenantDate`; `isQuotationExpired`, `resolvePaymentTerm`, `resolveDeliveryItemPrice`, reporting/PDFs y formularios de pagos migrados a usar zona tenant; tests parametrizados. | ✅ Completado |
| ☐ 7.2 | **Moneda multi-divisa** | Soporte para operar en USD, EUR además de BOB. Campo `currency` en documentos y tasa de cambio diaria. | ☐ Pendiente (sin iniciar) |
| ☐ 7.3 | **Localización de reportes fiscales** | Plantillas de libro de compras/ventas adaptables a otros países (Chile, Perú, Argentina). | ☐ Pendiente |

---

## Deuda técnica activa

| # | Item | Descripción | Estado |
|---|------|-------------|--------|
| ✅ DT.1 | **Route guards** | Migrados de `roleGuard` a `permissionGuard` basado en permisos del JWT. Toda ruta usa `module:view`. | ✅ Completado |
| ✅ DT.2 | **E2E tests** | `test-utils.ts` verificado: no contiene referencia a columna `existe`. Tests limpios. | ✅ Completado |
| ✅ DT.3 | **Refactor formularios** | Todos los formularios de documentos extienden `DocumentFormBase` y usan `DocumentLineArrayService`. El refactor está completo. | ✅ Completado |
| ✅ DT.4 | **Colores hardcodeados** | ~20 colores `#hex` más obvios en `styles.scss` migrados a tokens CSS. Quedan ~95 en partials/componentes. | ✅ Parcial |
| ✅ DT.5 | **Selectores nativos** | Formularios clave migrados a `app-enum-selector`. Quedan filtros de listados y selects de entidades dinámicas. | ✅ Parcial |
| ✅ DT.6 | **Responsive / touch targets** | Breakpoints unificados en `_breakpoints.scss` ($breakpoint-xs/sm/md/lg/xl). Todos los partials principales migrados. Quedan targets < 44px en componentes específicos. | ✅ Parcial |
| ✅ DT.7 | **Tests faltantes** | Creados `.spec.ts` para `accounts`, `incoming-payments-form`, `outgoing-payments-form`. | ✅ Completado |
| ✅ DT.8 | **Permisos audit-logs** | Módulo `audit-logs` agregado a `DEFAULT_PERMISSIONS` del backend; frontend usa `audit-logs:view`. | ✅ Completado |
| ✅ DT.9 | **Unificación cálculo de impuestos (compras)** | Eliminado `forceInclusive: true` hardcodeado en backend (`purchase-orders`, `purchase-quotations`, `purchase-requests`) y frontend (`PurchaseDocumentFormBase`, `purchase-quotations-form`, `purchase-credit-notes-form`, `purchase-returns-form`). Todos los documentos de compra respetan `taxIndicator.isInclusive`. | ✅ Completado |
| ☐ DT.10 | **Validación obligatoria de `date` y `postingDate`** | Regla de negocio: todo documento debe tener `date` obligatoria; todo documento que mueva contabilidad debe tener `postingDate` obligatoria. Hoy `postingDate` es `DateTime?` en Prisma para TODOS los modelos y los DTOs usan `@IsOptional()`. Algunos servicios (crédito/débito notas, devoluciones, POS) asignan explícitamente `null`. Requiere: (1) quitar `?` de `postingDate` en Prisma para documentos contables, (2) `@IsNotEmpty()` en DTOs, (3) eliminar defaults `null` en servicios, (4) actualizar tests. | ☐ Pendiente |

---

## Mejoras detectadas en el camino

- ✅ **StockAdjustment integrado en trazabilidad**: modelo `StockMovement` frontend actualizado con `stockAdjustment`; navegación desde detalle de artículo al ajuste.
- ✅ **Relación `stockAdjustment` en movimientos de almacén**: backend `warehouses.service.ts` incluye `stockAdjustment` en el `include` de `getMovements`.
- ✅ **Trazabilidad de pagos**: `INCOMING_PAYMENT` y `OUTGOING_PAYMENT` agregados a `DocType` del mapa de flujo; navegación doble-clic funciona.
- ✅ **Cálculo de impuestos unificado en documentos de compra**: Eliminado `forceInclusive: true` hardcodeado en `purchase-orders`, `purchase-quotations`, `purchase-requests`, `purchase-credit-notes`, `purchase-returns`. Todos los documentos de compra ahora respetan el campo `isInclusive` del `TaxIndicator` (igual que la factura de compra).
- ✅ **Fix visual en dropdown "Copiar a"**: CSS mobile en `_forms.scss` cortaba texto del dropdown por selector demasiado amplio (`button` → `> .btn-primary`).
- ✅ **Fix en partner-selector dentro de modales**: Cambiado a `mode="modal"` para evitar clipping por `overflow: hidden` del `.modal-card`.
- ✅ **Fix en proyección de ng-content con OnPush**: `app-document-action-bar` envuelto en `@if (request || !isEditing)` para que `ng-content` proyecte botones condicionales correctamente desde el inicio.

---

*Última actualización: 2026-05-26*

---

## Nota sobre Fase 7

La Fase 7 es un requisito previo para desplegar el ERP en países fuera de Bolivia. Sin ella, un tenant en Chile (UTC-4/-3) o Perú (UTC-5) vería fechas de documentos desfasadas, cierres de ejercicio fiscal inconsistentes y reportes con fechas incorrectas. El bug de `_normalizeDate` (arreglado el 26/05/2026) fue un síntoma de esta deuda técnica.

---

## Nota sobre Fase 3 (Flujos Comerciales)

Las siguientes features del roadmap detallado (`ROADMAP_ERP.md`) también están completas:
- ✅ **F3.6** Múltiples códigos de barras por item
- ✅ **F3.7** Direcciones múltiples por partner
- ✅ **F3.8** Cuentas bancarias del partner
- ✅ **F3.9** Historial de precios
- ✅ **F3.10** Kit / Ensamblaje (BOM + ensamblaje)
- ✅ **F3.11** PaymentTerms avanzado (cuotas y descuentos)

**F3.4 y F3.5** están cubiertas por implementaciones existentes:
- **F3.4 (Reserva de stock):** Cubierta por `stockCommitted` en tabla `Stock` + `recalcCommitted()`.
- **F3.5 (BackOrder):** Cubierta por generación manual desde pedidos (`POST /sales-orders/:id/backorder`).
