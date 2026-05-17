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

---

## Fase 2 — Control de acceso y permisos

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 2.1 | **Tabla de permisos granulares** | Backend: `@RequirePermission` en todos los endpoints, `PermissionsGuard` global, permisos en JWT. | ✅ 24+ controllers migrados. `PermissionsGuard` lee permisos del JWT payload (sin DB hit). |
| ✅ 2.2 | **Gestor de roles** | Frontend: CRUD de roles con matriz de permisos (checklist por módulo). | ✅ Pantalla `/permissions` con editor de matriz por rol. |
| ☐ 2.3 | **Restricción por almacén** | Opcional: usuario solo ve documentos de ciertos almacenes. | Pendiente |

---

## Fase 3 — Inventario avanzado

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 3.1 | **Lotes** | Campo `batchId` + `expiryDate` en `StockMovement` y líneas de documento; tracking en kardex. | ✅ Modelo `Batch` con `expiryDate`. `batchId` en todas las líneas de documento y en `StockMovement`. |
| ✅ 3.2 | **Números de serie** | Campo `serialNumberId` (1 unidad = 1 serie); validación de unicidad por almacén. | ✅ Modelo `SerialNumber` con `warehouseId` y `status`. `serialNumberId` en líneas de documento y `StockMovement`. Validación `validateSerialNumber()` verifica disponibilidad y almacén. |
| ✅ 3.3 | **Kardex formal** | Reporte independiente: movimientos de un artículo con saldo acumulado por fecha. | ✅ Endpoint `GET /items/:id/kardex`. Frontend `/kardex/:itemId` con tabla de movimientos y saldo acumulado. |
| ☐ 3.4 | **Importación masiva** | Upload CSV/Excel para artículos, partners y stock inicial; con validación de errores. | Pendiente |

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
| ☐ 5.1 | **Precios por escala** | Tabla `PriceScale` (cantidad mínima → precio) por artículo y lista de precio. | Pendiente |
| ✅ 5.2 | **Bancos y cuentas bancarias** | CRUD de cuentas; asociar pagos a cuenta bancaria; saldo bancario. | ✅ Modelos `Bank` y `BankAccount`. Endpoints CRUD. Frontend `/banks` con tabs Bancos/Cuentas. |
| ☐ 5.3 | **BOM / Órdenes de producción** | Receta de fabricación (materia prima → producto terminado); orden de producción con consumo automático. | Pendiente |
| ☐ 5.4 | **CRM básico** | Oportunidades de venta, actividades/calendario por partner, pipeline. | Pendiente |

---

## Fase 6 — Contabilidad

| # | Módulo | Descripción | Estado |
|---|--------|-------------|--------|
| ✅ 6.1 | **Plan de cuentas** | CRUD de cuentas contables (activo, pasivo, patrimonio, ingreso, egreso). | ✅ Backend `AccountsModule` (CRUD + Prisma model `Account`). Frontend `AccountsComponent` con ruta `/accounts` y entrada en sidebar. |
| ✅ 6.2 | **Asientos contables** | Modelos `JournalEntry`/`JournalEntryLine`, enum `JournalEntryStatus`, `JOURNAL_ENTRY` en `DocumentType`. Backend `JournalEntriesModule` con CRUD + post/cancel. Frontend `JournalEntriesComponent` + `JournalEntriesFormComponent` con tabla dinámica de líneas y validación de cuadre. | ✅ Completado — ruta `/journal-entries`. |
| ☐ 6.3 | **Libro de compras/ventas** | Reportes fiscales bolivianos formateados. | Pendiente |
| ☐ 6.4 | **Estado de resultados y balance** | Reportes financieros estándar. | Pendiente |

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

---

## Mejoras detectadas en el camino

- ✅ **StockAdjustment integrado en trazabilidad**: modelo `StockMovement` frontend actualizado con `stockAdjustment`; navegación desde detalle de artículo al ajuste.
- ✅ **Relación `stockAdjustment` en movimientos de almacén**: backend `warehouses.service.ts` incluye `stockAdjustment` en el `include` de `getMovements`.
- ✅ **Trazabilidad de pagos**: `INCOMING_PAYMENT` y `OUTGOING_PAYMENT` agregados a `DocType` del mapa de flujo; navegación doble-clic funciona.

---

*Última actualización: 2026-04-19*
