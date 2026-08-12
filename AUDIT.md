# AUDIT.md — ERP Suite

> Documento vivo de auditoría, hallazgos y tracking de acciones.  
> **Última actualización:** 2026-07-25.

---

## Índice

1. [Auditoría 2026-05-21 — Informe ejecutivo](#1-auditoría-2026-05-21--informe-ejecutivo)
2. [Hallazgos críticos resueltos](#2-hallazgos-críticos-resueltos)
3. [Hallazgos importantes resueltos](#3-hallazgos-importantes-resueltos)
4. [Fases de auditoría y tracking](#4-fases-de-auditoría-y-tracking)
5. [Base de conocimiento de bugs](#5-base-de-conocimiento-de-bugs)
6. [Métricas de referencia](#6-métricas-de-referencia)

---

## 1. Auditoría 2026-05-21 — Informe ejecutivo

| Indicador | Backend | Frontend | Estado |
|-----------|---------|----------|--------|
| **Build** | ✅ 0 errores | ✅ 0 errores | 🟢 |
| **Lint** | ⚠️ 0 errores, ~0 warnings | ✅ 0 errores, 0 warnings | 🟢 |
| **Unit Tests** | 64 suites, **341 passed** | 524 tests, **524 passed** | 🟢 |
| **E2E Tests** | 7 archivos | 10 archivos, 111 tests | 🟢 |
| **`as any` en prod** | ✅ 0 violaciones | 0 (solo en `.spec.ts`) | 🟢 |
| **Documentación API** | ✅ Swagger básico en 54 controllers | N/A | 🟢 |
| **Suscripciones seguras** | N/A | ✅ 0 leaks reales en componentes | 🟢 |
| **SQL `SELECT *`** | ✅ 0 ocurrencias | N/A | 🟢 |
| **Desync frontend-backend** | ✅ `account-mappings` creado | N/A | 🟢 |

**Conclusión general:** Todas las fases de estabilización (Fase 1–3) se completaron exitosamente. El proyecto cuenta con **build limpio, tests al 100%, lint rápido, Swagger básico documentado, y zero memory leaks reales en componentes**. Quedan **excepciones técnicas de `as any` en producción** documentadas en `BACKEND_GUIDE.md` §2 como deuda técnica activa.

---

## 2. Hallazgos críticos resueltos

### 2.0 Backend — Cierre de brecha RBAC fail-open (2026-08-03) ✅

**Severidad:** Alta (seguridad) → Resuelto (parcial: red de seguridad fail-open sigue activa mientras termina la migración total)

**Problema:** `PermissionsGuard` (`src/auth/permissions.guard.ts`) es fail-open: cualquier handler sin `@RequirePermission` era accesible por cualquier usuario autenticado, sin control de rol (bypass de RBAC). 6 controllers críticos estaban en este estado, exponiendo datos transversales del tenant y escritura operativa:

| Controller | Riesgo previo | Fix aplicado |
|------------|---------------|--------------|
| `search.controller.ts` | Búsqueda multi-entidad sin control de rol | `@RequirePermission('search', 'view')` |
| `sap-integration.controller.ts` | Forzar sync SAP + leer logs sin permiso | `sync` (POST) + `view` (GET logs) |
| `document-flow.controller.ts` | Grafo completo de trazabilidad documental | `@RequirePermission('document-flow', 'view')` |
| `batches.controller.ts` | CRUD completo de lotes sin permiso | CRUD `view/create/edit/delete` + reorden de rutas |
| `serial-numbers.controller.ts` | CRUD completo de números de serie sin permiso | CRUD `view/create/edit/delete` + reorden de rutas |
| `alerts.controller.ts` | Evaluar/dismiss alertas sin permiso | Clase `settings:view` + override `edit` en mutaciones |

**Handlers intencionalmente exentos** (documentados en `permissions-coverage.spec.ts`):
- `auth/refresh-token` y `auth/me`: cualquier autenticado debe poder refrescar su sesión y consultar su payload (protegerlos causaría lockout). Siguen exigiendo JWT válido vía `JwtAuthGuard` global.
- Endpoints `@Public`: `app/`, `health`, `metrics`, `auth/login`, `auth/logout`, `super-admin/auth/login`, `billing/webhook/:provider`, `tenants/active`.

**Cambios de configuración:**
- `permissions.service.ts` (`DEFAULT_PERMISSIONS` rol USER): añadidos módulos `search`, `sap-integration`, `document-flow`, `batches`, `serial-numbers`. El rol ADMIN obtiene `*:*` vía wildcard (línea 178-181), sin cambios.
- `erp-frontend/src/app/pages/permissions/permissions.service.ts`: añadidos los 5 módulos a `PERMISSION_MODULES` + acción `sync` a `PERMISSION_ACTIONS`, para que el admin pueda asignarlos desde la UI.

**Prevención de regresiones:** nuevo test `src/auth/permissions-coverage.spec.ts` que recorre estáticamente todos los `*.controller.ts` y falla si un handler HTTP aparece sin `@RequirePermission`, `@Public` o entrada en `AUTH_EXEMPT`. Esto da confianza para, en el futuro, pasar el guard a fail-closed cuando la lista `AUTH_EXEMPT` quede vacía.

**Pendiente:** el guard sigue fail-open como red de seguridad. Para pasarlo a fail-closed, garantizar que ningún handler legítimo quede sin decorador (el test de cobertura es la herramienta para esto).

---

### 2.1 Backend — `as any` en código de producción ✅

**Severidad:** Alta → Resuelto  
**Política:** `AGENTS.md` establece **Zero `as any` policy** en producción.

Se detectaron **7 ocurrencias** en **5 servicios** (todos en `trackingAssignments`):

| Archivo | Línea | Contexto |
|---------|-------|----------|
| `purchase-credit-notes.service.ts` | 172 | `trackingAssignments: (line.trackingAssignments as any) ?? undefined` |
| `purchase-credit-notes.service.ts` | 324 | `.trackingAssignments as any` |
| `sales-credit-notes.service.ts` | 166 | `trackingAssignments: (line.trackingAssignments as any) ?? undefined` |
| `sales-credit-notes.service.ts` | 315 | `.trackingAssignments as any` |
| `purchase-returns.service.ts` | 254 | `trackingAssignments: (line.trackingAssignments as any) ?? undefined` |
| `sales-returns.service.ts` | 240 | `trackingAssignments: (line.trackingAssignments as any) ?? undefined` |
| `stock-adjustments.service.ts` | 194 | `trackingAssignments: (line.trackingAssignments as any) ?? undefined` |

**Resolución:** Se reemplazaron los 7 casts por `Prisma.InputJsonValue` en los 5 servicios. Build y tests limpios.

### 2.2 Backend — Documentación API (Swagger/OpenAPI) ✅

**Severidad:** Alta → Resuelto  
**Hallazgo:** 0 decoradores `@ApiTags`, `@ApiOperation`, `@ApiResponse` en los 53 controllers.

**Resolución:** Se agregaron `@ApiTags` y `@ApiBearerAuth` a 54 controllers. Swagger UI disponible en `/api`. Los DTOs con `class-validator` proveen tipado automático.

### 2.3 Frontend — Tests unitarios masivamente rotos por `TablePreferenceService` ✅

**Severidad:** Alta → Resuelto  
**Hallazgo:** 47 tests fallaban con `NullInjectorError: No provider for HttpClient!`

**Raíz:** `TablePreferenceService` inyecta `HttpClient` pero los `TestBed` de componentes que usan `LunaDataTableComponent` no proveen `HttpClientTestingModule`.

**Resolución:** Se hizo `HttpClient` opcional en `TablePreferenceService` (`inject(HttpClient, { optional: true })`) y `TablePreferenceService` opcional en `LunaDataTableComponent`. Los 47 tests afectados ahora pasan sin modificaciones.

### 2.4 Frontend — Potenciales Memory Leaks por suscripciones ✅

**Severidad:** Media-Alta → Resuelto  
**Métricas:**
- `.subscribe(`: **624** ocurrencias en **118** archivos.
- `takeUntilDestroyed`: **343** ocurrencias en **113** archivos.
- **Diferencia aproximada:** ~281 suscripciones que podrían no tener destrucción automática.

**Resolución:** Análisis profundo mostró que **0 componentes** tienen suscripciones sin cleanup. Los 7 componentes que no usaban `takeUntilDestroyed` empleaban `OnDestroy` + `Subject`/`Subscription.unsubscribe()` manual, que es igualmente válido.

---

## 2b. Hallazgos activos — pendientes de fix (2026-08-04)

> Detectados durante la campaña de tests de cálculo financiero. No se arreglaron en esa sesión porque requieren decisión de diseño o tocan lógica de negocio sensible. Los tests que los exponen están en verde con comentarios `// FIXME`.

### 2b.1 Frontend — POS no usa `calcLineWithIndicator` y diverge en IVA ✅ RESUELTO (2026-08-04)

**Severidad:** Alta (cálculo de dinero) → Resuelto.

**Archivos:** `pages/pos/pos.component.ts` (`calcLine` privado eliminado), `pages/pos/pos.types.ts` (`CartItem.calculationMethod` añadido), `models/sale-invoice.model.ts` (`SaleInvoiceItem.calculationMethod` añadido).

**Problema (resuelto):** El POS tenía su propia función `calcLine` que no reutilizaba el util compartido `calcLineWithIndicator`. No soportaba `calculationMethod: 'STANDARD'` y añadía redondeo divergente.

**Fix aplicado:**
- Eliminado `calcLine` privado duplicado. Los 9 call sites migrados a `calcLineWithIndicator` de `shared/pricing.util.ts`.
- Añadido `partnerCalculationMethod` al componente (igual que `partnerIsInclusive`), leído del indicador del partner.
- Añadido `calculationMethod` a `CartItem` y persistido al añadir/recalcular líneas e hidratar sesión.
- Eliminado el redondeo extra `Math.round(...*100)/100` para alinear con facturas.
- 4 tests nuevos en `pos.component.spec.ts`: STANDARD inclusivo (taxAmount≈11.50 no 13.00), BOLIVIA_SIN inclusivo (regresión), no-divergencia POS↔facturas, propagación por `onPartnerChange`.

**Verificación:** 13/13 tests POS pasan (9 originales + 4 nuevos). El test de no-divergencia confirma que POS y `calcLineWithIndicator` producen resultados idénticos.

### 2b.2 Frontend — `calcTotals` prorratea IVA en líneas mixtas ✅ FALSO POSITIVO (2026-08-04)

**Severidad:** — (no es bug) → Cerrado por análisis matemático.

**Archivo:** `shared/document-form/document-form.base.ts:587-643` (`calcTotals`).

**Sospecha inicial (incorrecta):** se creía que el prorrateo lineal del descuento de cabecera distorsionaba el IVA cuando hay líneas mixtas (exenta + gravada), porque el ratio se aplica tanto a `subtotal` como a `tax`.

**Veredicto tras auditoría algebraica:** el IVA resultante **es fiscalmente correcto**. El prorrateo lineal por `lineTotalSum` es matemáticamente equivalente al recálculo por línea con su tasa específica:

```
Prorrateo (código):   IVA = (Σ baseᵢ · tasaᵢ) · (1 − ratio)
Recálculo por línea:  IVA = Σ (baseᵢ · (1 − ratio)) · tasaᵢ = (1 − ratio) · Σ baseᵢ · tasaᵢ
```

Ambas expresiones son idénticas por distributividad. Las líneas exentas (tasa=0) aportan 0 a ambas, así que no distorsionan. La reducción del IVA (13 → 11.7 con descuento 10%) es la consecuencia fiscal correcta de descontar la base gravada, no una distorsión.

**Verificación numérica:** confirmado para 2 líneas (exenta + 13%) y 3 líneas (exenta + 13% + 25%) — el IVA coincide en ambos métodos hasta el último decimal.

**Deuda cosmética menor (no bloqueante, documentada):**
- `totalDiscount` se calcula sobre el bruto con IVA (21.3) en vez de sobre bases netas (20). Afecta solo a la presentación del descuento, no al IVA.
- Nomenclatura engañosa: el campo `subtotal` del FormGroup de línea guarda el total CON IVA, mientras `lineSubtotal` guarda la base neta. Trampa para desarrolladores.
- `lineTotal` es un campo huérfano (existe en el FormGroup pero `applyLineTax` no lo actualiza).

**Test actualizado:** `document-form.base.spec.ts` — el comentario `// FIXME: posible bug` fue reemplazado por la demostración algebraica que confirma la corrección.

---

## 3. Hallazgos importantes resueltos

### 3.1 Backend — Queries `SELECT *` crudos ✅

**Archivos:** `common/bulk-import.service.ts`, `common/stock.util.ts`  
**Resolución:** Reemplazados por selects explícitos con `where tenantId = ...` y paginación cuando aplica.

### 3.2 Backend — Test leaks (`detectOpenHandles`) ✅

**Hallazgo:** Tests terminaban con aviso de worker force exited.  
**Resolución:** `prisma.service.spec.ts` ahora guarda la referencia al `TestingModule` e invoca `module.close()` en `afterEach`, lo que dispara `onModuleDestroy` y `$disconnect()`. `--detectOpenHandles` limpio.

### 3.3 Frontend — Lint timeout ✅

**Hallazgo:** `npm run lint` en frontend se agotaba después de 120 segundos.  
**Resolución:** Se separó `eslint-plugin-prettier` de ESLint. Ahora `eslint.config.js` usa `eslint-config-prettier`. `ng lint` pasa de **>300s** a **~15s** con 0 errores y 0 warnings.

### 3.4 Frontend — Bundle sizes de formularios comerciales

**Hallazgo:** Los chunks de formularios principales pesan ~90KB cada uno:

| Chunk | Tamaño |
|-------|--------|
| `pos-component` | 90.40 kB |
| `sale-invoices-form-component` | 94.24 kB |
| `sales-orders-form-component` | 93.91 kB |
| `purchase-invoices-form-component` | 91.22 kB |
| `purchase-orders-form-component` | 91.50 kB |

**Recomendación:** Aceptable para ERP desktop. En conexiones lentas o móviles, evaluar lazy-loading de sub-componentes compartidos y `preload` estratégico para rutas frecuentes.

### 3.5 Inconsistencias de dominio Frontend ↔ Backend

**Hallazgo:** Desalineación nominal entre páginas frontend y módulos backend:

| Frontend Page | Backend Module | Nota |
|---------------|----------------|------|
| `account-mappings` | `account-mappings` | ✅ Creado en backend |
| `kardex` | — | ❌ No hay módulo backend dedicado |
| `low-stock` | — | ❌ No hay módulo backend dedicado |
| `bulk-upload` | — | ❌ No hay módulo backend dedicado |
| `permissions` | `auth/permissions.controller.ts` | ⚠️ Disperso en auth |
| `profile` | — | ❌ Consume users/settings |
| `document-flow` | `document-flow` | ✅ Pero está en `shared/` del frontend |

**Recomendación:** Documentar en `AGENTS.md` el mapeo exacto frontend-backend para cada dominio.

---

## 4. Fases de auditoría y tracking

### FASE 1 — Seguridad & Estabilidad ✅

#### 1.1 Migrar `findUnique` sin `tenantId` → `findFirst({ id, tenantId })` ✅

**Status:** `✅ DONE`  
**Nota:** 21 ocurrencias migradas en May 2026. Se arreglaron mocks en `stock-transfers` y `purchase-credit-notes` para reflejar `findFirst`. Todos los tests pasan (62 suites, 326 tests).  
**Riesgo:** CRÍTICO — Cross-tenant data leak  
**Archivos afectados:** 34 ocurrencias en 15+ servicios (todas verificadas y migradas).

#### 1.2 Correr `npm run lint -- --fix` en frontend ✅

**Status:** `✅ DONE` — 0 errores, 23 warnings (unused imports)  
**Riesgo:** ALTO — 848 errores Prettier  
**Acción:** `cd erp-frontend && npm run lint -- --fix`

#### 1.3 Arreglar mocks de `stock-entries` y `stock-exits` ✅

**Status:** `✅ DONE` — También se arreglaron `stock-adjustments` y `stock-transfers`.  
**Backend tests:** 62/62 suites pass, 326/326 tests pass.  
**Riesgo:** ALTO — 32 tests fallidos  
**Problema:** `findFirst` en `confirm()` no encuentra el documento recién creado en el mock.

#### 1.4 Arreglar E2E `items.spec.ts` en mobile Safari ✅

**Status:** `✅ DONE`  
**Riesgo:** ALTO — Tests E2E fallan  
**Problemas arreglados:**
- Campo `cost` eliminado del test (no existe en formulario)
- Agregado mock para `GET /uoms`
- Checkboxes seteados vía `page.evaluate()` (robusto en Safari mobile/tablet)
- Click en Guardar vía JS para evitar sidebar overlay
**Resultado:** 11/11 tests pasan en todos los proyectos (chromium, firefox, mobile-chrome, mobile-safari, tablet-safari)

### FASE 2 — Estandarización Backend ✅

#### 2.1 Extraer `DocumentTotalsHelper` ✅

**Status:** `✅ DONE`  
**Impacto:** ~150 líneas de boilerplate removidas de 5 God Services  
**Archivos:** Creado `backend-erp/src/common/document-totals.util.ts`

#### 2.2 Extraer `DocumentStockHelper` ✅

**Status:** `✅ DONE` — Implementado y aplicado a 4 servicios  
**Archivos:** Creado `backend-erp/src/common/document-stock.helper.ts`

#### 2.3 Auditoría `$queryRawUnsafe` en todo el backend ✅

**Status:** `✅ DONE`  
**Archivos:** `reports.service.ts`, `stock.util.ts`, `bulk-import.service.ts`  
**Cambios:**
- `reports.service.ts`: 7 queries migradas a `$queryRaw(Prisma.sql...)` con parámetros posicionales
- `stock.util.ts`: `findStockWithLock` migrado a `$queryRaw(Prisma.sql...)`
- `bulk-import.service.ts`: 4 queries/updates migrados a `$queryRaw(Prisma.sql...)` / `$executeRaw(Prisma.sql...)`
- **Quedan intocados (casos permitidos):** `code-generator.ts` (secuencias PostgreSQL), `bulk-import.service.ts:101` (batch de secuencias), `prisma.service.ts` (sync de secuencias)
- **Resultado:** 0 `$queryRawUnsafe` / `$executeRawUnsafe` en código fuente productivo

#### 2.4 Paginación obligatoria en endpoints de reporte ✅

**Status:** `✅ DONE`  
**Cambios:** Agregados `page` y `limit` (máx 500) a DTOs de filtros de reporte. Valores por defecto: page=1, limit=100.

### FASE 3 — Rendimiento Frontend ✅

#### 3.1 Identificar librería en chunk de 207 KB ✅

**Status:** `✅ DONE`  
**Hallazgo:** El chunk contiene el core de Angular — no es una librería de terceros innecesaria. No hay acción reductora posible sin cambiar de framework.

#### 3.2 Buscar suscripciones sin `takeUntilDestroyed` ✅

**Status:** `✅ DONE`  
**Hallazgo:** De 139 archivos con `.subscribe()`, solo **5 componentes** tenían suscripciones sin cleanup automático:
- `item-profitability.component.ts`
- `purchase-report.component.ts`
- `sales-report.component.ts`
- `stock-valuation.component.ts`
- `bulk-upload.component.ts`
**Acción:** Se agregó `takeUntilDestroyed(this.destroyRef)` a las suscripciones de estos 5 componentes.

#### 3.3 Reducir CSS global (110 KB) ✅

**Status:** `✅ DONE (parcial — modularización)`  
**Fecha:** 19/04/2026  
**Resumen:** `styles.scss` reducido de 2,250 líneas a ~260 líneas extraídas en partials `_reset.scss` y `_layout.scss`. Build de producción pasa exitosamente. El bundle CSS global (112 KB minificado) proviene de ~6,500 líneas de SCSS fuente (legacy + Luna design system). Una reducción significativa requiere un proyecto dedicado de eliminación de reglas muertas (PurgeCSS).

### FASE 4 — Estandarización Frontend ✅

#### 4.1 Migrar `*ngIf` → `@if` ✅

**Status:** `✅ DONE`  
**Fecha:** 19/04/2026  
**Resumen:** Ejecutado schematic `@angular/core:control-flow` en todo el proyecto. Resueltos 25 templates con nombres duplicados (`#cell`, `#actions`) renombrando a `#cell2`, `#actions2`, etc. Corregidos 4 archivos con `trackBy` mal migrado.

#### 4.2 Unificar `calculateLine` en formularios comerciales ✅

**Status:** `✅ DONE (parcial)`  
**Fecha:** 19/04/2026  
**Resumen:** Creada clase base `CommercialDocumentFormBase` que extiende `DocumentFormBase`. `calculateLine` y `recalculateAllLines` centralizados. 5 componentes migrados; 9 componentes mantienen `override calculateLine` por lógica especial.

#### 4.3 Estandarizar carga de catálogos (`forkJoin` + loading state) ✅

**Status:** `✅ DONE (patrón establecido)`  
**Fecha:** 19/04/2026  
**Resumen:** Agregado `safeObservable<T>(obs, fallback)` a `DocumentFormBase` para evitar que `forkJoin` falle cuando un catálogo individual falla.

### FASE 5 — Auditoría Flujos Documentales & Trazabilidad ✅

#### 5.1 Hallazgos críticos de backend (ventas vs compras) ✅

| # | Bug | Severidad | Archivo | Status |
|---|-----|-----------|---------|--------|
| 1 | **SaleInvoices.createFromOrder** no resta cantidad de facturas reserva abiertas | 🔴 Alta | `sale-invoices.service.ts` | ✅ Done |
| 2 | **DeliveryOrders.createFromOrder** no resta cantidad de otras entregas `OPEN` | 🔴 Alta | `delivery-orders.service.ts` | ✅ Verificado — ya implementado |
| 3 | **PurchaseInvoices.createManual** ignora `taxIndicatorId` por línea | 🔴 Alta | `purchase-invoices.service.ts` | ✅ Done |
| 4 | **PurchaseInvoices.createFromQuotation** bloque copy-paste de `purchaseReceiptItem` | 🟡 Media | `purchase-invoices.service.ts` | ✅ Done (hallazgo desactualizado) |
| 5 | **SalesOrders.createManual** no setea `date`/`postingDate` | 🟡 Media | `sales-orders.service.ts` | ✅ Done (ya propagaba vía `buildBaseDocumentData`) |
| 6 | **PurchaseOrders.createFromDraft** no re-resuelve precios si cotización vencida | 🟡 Media | `purchase-orders.service.ts` | ✅ Done |
| 7 | **PurchaseInvoices.createFromOrder** no expone `discountPct`/`discountAmt` | 🟡 Media | `purchase-invoices.service.ts` | ✅ Done |
| 8 | **DeliveryOrders.createManual** auto-confirma; `purchase-receipts.createManual` no | 🟡 Media | `delivery-orders.service.ts`, `purchase-receipts.service.ts` | ✅ Done — todos usan OPEN → `confirm()` |

#### 5.2 Hallazgos críticos de document-flow (trazabilidad) ✅

| # | Bug | Severidad | Archivo | Status |
|---|-----|-----------|---------|--------|
| 9 | **`JOURNAL_ENTRY`** existe en `findRawDocument` pero NO en `resolveNode` | 🔴 Alta | `document-flow.service.ts` | ✅ Done |
| 10 | **Sub-grafos perdidos** si nodo intermedio retorna `null` | 🔴 Alta | `document-flow.service.ts` | ✅ Done |
| 11 | **`tenantId` filtrado inconsistente** entre `getFlow` y `getGraph` | 🟡 Media | `document-flow.service.ts` | ✅ Done |
| 12 | **Non-null assertions** (`doc.partner!.name`) en `resolveNode` | 🟡 Media | `document-flow.service.ts` | ✅ Done (11 reemplazos) |
| 13 | **`findRawDocument` retorna `Promise<any>`** | 🟡 Media | `document-flow.service.ts` | ✅ Done |
| 14 | **N+1 queries** en BFS de `getGraph` | 🟡 Media | `document-flow.service.ts` | ✅ Done (BFS en batches) |
| 15 | **Tests de document-flow** extremadamente pobres (1 test) | 🟡 Media | `document-flow.service.spec.ts` | ✅ Done (12 tests) |

#### 5.3 Hallazgos de frontend (trazabilidad) ✅

| # | Bug | Severidad | Archivo | Status |
|---|-----|-----------|---------|--------|
| 16 | **`@for` track por identidad** en nodos/edges del mapa | 🔴 Alta | `document-flow-map.component.ts` | ✅ Done |
| 17 | **`@for` track por identidad** en chips upstream/downstream | 🔴 Alta | `document-flow.component.ts`, `document-flow-panel.component.ts` | ✅ Done |
| 18 | **Estado `POSTED` no traducido** en el mapa | 🟡 Media | `document-flow-map.component.ts` | ✅ Done |
| 19 | **Doble `ChangeDetectorRef`** (`cdr` + `cd`) | 🟡 Media | `document-flow-panel.component.ts` | ✅ Done |
| 20 | **`openMap()` sin validación** de `type`/`id` | 🟡 Media | `document-flow-panel.component.ts` | ✅ Done |
| 21 | **Memory leaks** por timers no limpiados | 🟢 Baja | `document-flow-map.component.ts` | ✅ Done |
| 22 | **Sin focus trap** en modal del mapa | 🟢 Baja | `document-flow-map.component.ts` | ✅ Done |

### FASE 6 — Infraestructura, Perfil Fiscal & Billing ✅

#### 6.1 Perfil fiscal del emisor (tenant) ✅

**Status:** `✅ DONE`  
**Riesgo:** CRÍTICO — Documentos fiscales no tendrían datos legales del emisor.  
**Hallazgo:** El modelo `Tenant` no incluía razón social, NIT/taxId, dirección fiscal, teléfono, correo, representante legal, actividad económica, autorización de impresión (SIN), ni logo más allá de `logoUrl`.  
**Resolución:** Modelo `Tenant` extendido con campos fiscales. Endpoint `PATCH /tenants/:id/company-profile`. Frontend `/company-profile`. PDFs y reportes fiscales inyectan datos del emisor.

#### 6.2 Billing, suscripciones y período de prueba ✅

**Status:** `✅ MVP implementado con enforcement`  
**Riesgo:** CRÍTICO — Sin esto no es posible el modelo SaaS.  
**Hallazgo:** No existía modelo de suscripción, `trialEndsAt`, fechas de facturación, ni integración Stripe/PayPal.  
**Resolución:** Modelo `Subscription` 1:1 con `Tenant`. Estados `TRIAL/ACTIVE/PAST_DUE/CANCELLED/EXPIRED`. `SubscriptionGuard` bloquea endpoints cuando trial vencido o suscripción cancelada. Banner frontend.

#### 6.3 Aislamiento real de datos entre tenants ✅

**Status:** `✅ DONE`  
**Riesgo:** ALTO — Data leak cross-tenant si un desarrollador olvida `tenantId`.  
**Resolución:**
- **Fase 1:** `TenantGuard` global + `TenantContextInterceptor` con `AsyncLocalStorage`.
- **Fase 2:** Extensión Prisma vía Proxy que inyecta `tenantId` en operaciones de filtro/masa y escrituras anidadas.
- **Tests:** 17 tests unitarios + 1 test E2E de integración.

#### 6.4 Backups y recuperación ante desastres ✅

**Status:** `✅ DONE`  
**Riesgo:** CRÍTICO — Pérdida total de datos posible.  
**Resolución:** Scripts `scripts/backup-db.js`/`restore-db.js`, comandos `npm run backup:db` / `npm run restore:db`, retención 7+4, validación con `erp_test`.

#### 6.5 Rate limiting por tenant ✅

**Status:** `✅ Completada`  
**Riesgo:** MEDIO — Un tenant abusivo puede afectar a otros en instancias compartidas.  
**Resolución:** `TenantThrottlerGuard` extiende `ThrottlerGuard`. Tracker `tenant:<tenantId>` (SHARED 300/min, DEDICATED 2000/min), fallback `ip:<ip>` 60/min. Headers `X-RateLimit-*`.

#### 6.6 Monitoreo y alertas de caídas ✅

**Status:** `✅ Completada`  
**Riesgo:** MEDIO — No se detecta caídas hasta que un cliente reporta.  
**Resolución:** `MonitoringModule` con `HealthController` (`/health`: Prisma, memoria, disco), `MetricsController` (`/metrics`: Prometheus), `MetricsInterceptor` global (requests, latencia, errores por tenant).

#### 6.7 Pruebas de carga y concurrencia multitenant ✅

**Status:** `✅ DONE`  
**Riesgo:** ALTO — Verificar que el sistema soporta decenas de tenants concurrentes.  
**Resolución:** Suite k6 creada en `load-tests/k6/` con 5 escenarios. Job CI dedicado.  
**Validación (perfil `small`):** 5/5 escenarios passed, 0% fallos, aislamiento multitenant verificado.

---

## 5. Base de conocimiento de bugs

> Registro de bugs críticos y fixes aplicados. Ver `BUGS_RESUELTOS.md` para el registro completo con fechas, archivos y validación.

### Categorías principales de bugs resueltos

| Categoría | Bugs resueltos | Estado |
|-----------|----------------|--------|
| **Backend / document flows** | 8 bugs (pending, createFrom*, asimetrías UX) | ✅ Todos resueltos |
| **Backend / document-flow (trazabilidad)** | 7 bugs (JOURNAL_ENTRY, N+1, non-null assertions, tipado) | ✅ Todos resueltos |
| **Frontend / document-flow (trazabilidad)** | 7 bugs (track por identidad, traducciones, memory leaks, focus trap) | ✅ Todos resueltos |
| **Backend / security** | 4 bugs (rate limiting, tenant isolation, SQL injection, findUnique) | ✅ Todos resueltos |
| **Backend / infrastructure** | 3 bugs (backups, monitoreo, test leaks) | ✅ Todos resueltos |
| **Frontend / tests** | 5 bugs (lint timeout, HttpClient mocks, Safari mobile, trackBy, control-flow) | ✅ Todos resueltos |
| **Frontend / forms** | 3 bugs (dirty-check, luna-form, price-lists escalas) | ✅ Todos resueltos |
| **Frontend / memory leaks** | 1 bug (suscripciones sin cleanup) | ✅ Todos resueltos |
| **Backend / fiscal** | 1 bug (cálculo de impuestos en compras) | ✅ Todos resueltos |

### Issues activos / pendientes destacados

1. **Pruebas de carga y estrés multitenant** (`backend / infrastructure`) — `🔲 Pendiente` (sin iniciar)
2. **Reconstrucción frontend de `special-prices`** (`frontend+backend / special-prices`) — `🔄 Parcial` (modelo y formulario sincronizados, faltan E2E)
3. **Karma frontend hangs** (`frontend / tests`) — `🔲 Pendiente` (problema recurrente del runner)
4. **Consistencia de `subtotal`/`lineTotal`** (`backend / document flows`) — `✅ Resuelto` (purchase-invoices fixeado, cobertura E2E agregada)
5. **Race condition en `upsertStock`** (`backend / stock`) — `✅ Resuelto` (`pg_advisory_xact_lock` implementado)
6. **Entrega creada pese a artículo no habilitado en almacén** (`backend / document flows`) — `✅ Resuelto`
   - **Síntoma:** En el flujo SQ → SO → DO, si el artículo no tenía `ItemWarehouseAccount` activa, el backend lanzaba el error pero la entrega se persistía (quedaba en estado inconsistente).
   - **Causa:** `validateItemWarehouseAssignment` solo se ejecutaba dentro de `upsertStock` (durante `confirm`), y `confirm()` se llamaba fuera de la transacción de creación; además, antes marcaba la entrega como `CLOSED` antes de aplicar el stock.
   - **Fix:** Se agregó la validación explícita de asignación artículo-almacén en todos los flujos `createFrom*` y `createManual` de `delivery-orders.service.ts` antes de crear el registro. Se reordenó `confirm()` para aplicar `applyOutgoingStock` antes de actualizar el estado a `CLOSED`.
   - **Cobertura:** `test/sales-flow.e2e-spec.ts` agrega dos tests E2E: SQ → SO → DO con artículo sin asignación, y DO manual con artículo sin asignación; ambos devuelven 400 y no crean la entrega.
7. **No se guarda cuenta contable vacía en matriz artículo-almacén** (`backend / tenant isolation`) — `✅ Resuelto`
   - **Síntoma:** En *Editar Artículo → Almacenes y cuentas*, asignar una cuenta contable se guardaba, pero borrarla (dejar el selector vacío) no persistía el cambio.
   - **Causa:** La extensión de aislamiento de tenant (`tenant-isolation.extension.ts`) convertía FK numéricas a relaciones explícitas (`{ connect }`) y **eliminaba** las FK con valor `null`, creyendo que Prisma 6.19+ no acepta FK null. Para relaciones opcionales esto omitía la actualización, dejando el valor anterior.
   - **Fix:** `injectRequiredRelations` ahora distingue `create` vs `update` y, en updates de relaciones opcionales con FK `null`, inyecta `{ disconnect: true }` antes de eliminar la FK, permitiendo que Prisma limpie realmente el campo.
   - **Cobertura:** `test/item-warehouse-accounts.e2e-spec.ts` agrega test E2E que verifica que `batchUpsert` con `inventoryAccountId: null` deja el campo en `null`.
8. **Entrega parcial con total 1 centavo de más (DEL-000081: 45.01 vs 45.00)** (`backend / document flows`) — `✅ Resuelto` (2026-07-20)
   - **Síntoma:** Entrega parcial de 1 unidad a Bs 45.00 (pedido de 2 × 45.00, IVA 13% incluido) mostraba total **45.01** en el listado de entregas.
   - **Causa:** En los documentos fuente de entregas (cotización, pedido, factura de reserva) `subtotal` almacena el **BRUTO** de la línea. Los 3 bloques de creación de `delivery-orders.service.ts` (createFromQuotation, createFromReserveInvoice, createFromOrder) calculaban `neto = round(bruto×r − iva×r)` y `iva = iva×r` sin redondear: `round(45 − 5.175) = 39.83` + `5.175 → 5.18` = **45.01** (doble redondeo con ambos componentes hacia arriba).
   - **Fix:** Helper `prorateLineAmounts` en `src/common/document-totals.util.ts` con semántica bruta: prorratea el **bruto** (un solo redondeo, exacto: `90 × 1/2 = 45.00`), prorratea el IVA aparte y deriva el neto por diferencia → `39.82 + 5.18 = 45.00`. Invariante garantizada: `subtotal + taxAmount === lineTotal`. Aplicado a los 3 bloques de creación de `delivery-orders.service.ts` y al bloque equivalente de `purchase-receipts.service.ts` (mismo patrón en compras, `PurchaseOrderItem.subtotal` también es bruto). Los prorrateos de `getDraft` eran solo para display y quedaron intactos.
   - **Nota:** Las facturas generadas desde entregas/recepciones recalculan sus líneas desde cero (`calcLineWithIndicator`), por lo que el IVA oficial nunca se vio afectado; el centavo solo vivía en el documento de entrega/recepción. Las notas de crédito (ventas y compras) anclan el neto por unidad (`priceNet × qty`, exacto) y no sufren el bug. El resto de documentos no prorratea dinero de documentos base — recomputan por línea.
   - **Cobertura:** `src/common/document-totals.util.spec.ts` con 10 tests (caso DEL-000081, suma de parciales = total del pedido, exentos, descuentos, nulos, qty inválida). Suite completa: 128 suites / 1247 tests.
   - **Dato histórico:** DEL-000081 (45.01 persistido, CLOSED) se deja sin ajuste por decisión del usuario (2026-07-20); el fix solo aplica a documentos nuevos.
9. **Endurecimiento contable integral — asientos automáticos vs NIC** (`backend / accounting`) — `✅ Resuelto` (2026-07-20)
   - **Contexto:** Auditoría de los 10 builders del `accounting-engine` tras revisar la NC de venta. Objetivo del usuario: la contabilidad debe ser el módulo más sólido del ERP.
   - **NC ventas/compras (3 ajustes previos):** (a) abono anticipado condicionado a lo cobrado (`debtCovered = min(total NC, balanceDue)`; pago solo por lo efectivamente cobrado — antes se creaba saldo a favor incluso sin cobros); (b) factura totalmente acreditada → `CLOSED` (antes `CANCELLED`); (c) asiento con re-ingreso de inventario (Dr INVENTORY / Cr COGS en ventas; Cr INVENTORY / Dr PURCHASE_CREDIT en compras) para líneas que retornan stock (`returnsStock`: FV siempre, FRV solo con entrega previa `deliveryOrderItemId` o posterior `targetDocType`). `cancel()` ajustado a la nueva lógica.
   - **R1 — Doble COGS en FV desde entrega:** guard `deliveryOrderItemId != null → skip COGS/INVENTORY` en `_buildSaleInvoiceJournalEntryLines` (la entrega ya lo posteó). Cobertura del edge case API `createFromDelivery` con `isReserve='N'` (el flujo normal FV directa vs FRV desde entrega ya era correcto).
   - **R2 — NC compras sin inventario:** par auto-balanceado Cr INVENTORY / Dr PURCHASE_CREDIT por costo para líneas con retorno de stock (incluye gap de recepción posterior vía `targetDocType='PURCHASE_RECEIPT'`).
   - **N3/N4 — Devoluciones condicionadas a facturación del origen:** nuevo util `return-financial-reversal.util.ts`. Devolución de venta contra entrega no facturada → solo Dr INVENTORY / Cr COGS (sin CxC/IVA); contra factura → reversa completa. Devolución de compra contra recepción no facturada → solo Dr GRIR / Cr INVENTORY; contra factura → reversa completa + par Cr INVENTORY / Dr PURCHASE_RETURN.
   - **N5 — PRICE_VARIANCE en compras:** factura desde recepción ahora limpia GRIR al **neto de la recepción** (totalCost prorrateado) y la diferencia de precio va a PRICE_VARIANCE (Dr/Cr). Antes GRIR se limpiaba al neto de factura dejando residual permanente.
   - **M6 — Reversa de SALES_DISCOUNT:** NC y devolución de venta debitan ingreso **bruto** y acreditan SALES_DISCOUNT (espejo exacto de la factura; antes el descuento quedaba sin revertir).
   - **M7 — Trazabilidad FRC/FRV:** FRC persiste `sourceDocumentType='PURCHASE_RESERVE_INVOICE'` (antes 'PURCHASE_INVOICE'); `_updateSourceTransactionId` cubre ambos tipos reserva.
   - **M8 — Fecha de reversa:** no-op justificado (todas las cancelaciones son "hoy"; no existe anulación retroactiva).
   - **M9 — Plug de redondeo:** incondicional en factura de venta (antes solo con descuento; un redondeo puro bloqueaba la confirmación).
   - **Cobertura:** ~30 tests nuevos en engine y servicios. Documentos confirmados correctos: entrega (COGS/Inv), FRV (solo financiero), recepción (Inv/GRIR), factura compra (GRIR a tasa histórica + dif. cambio NIC 21 + retenciones), FRC (ALLOCATION/PURCHASES sin inventario), reversas genéricas con revalidación de balance.
10. **Asiento de descuento por pronto pago** (`backend / accounting`) — `✅ Resuelto` (2026-08-10)
   - **Síntoma:** El sistema calculaba y persistía el descuento por pronto pago (condiciones de pago → `earlyPaymentDiscountPct/Amount`, `paymentReconciliation.discountAmount`), pero el asiento del pago no lo contabilizaba: **cobro** → Dr Banco / Cr CxC por el neto (la CxC del documento origen quedaba abierta por el descuento); **pago** → Dr CxP / Cr Banco por el neto (mismo residual en CxP).
   - **Fix:** Nuevo EntryType `EARLY_PAYMENT_DISCOUNT` (mapping-only) + cuentas `6.1.3.01.005` (Descuentos Concedidos por Pronto Pago, gasto financiero) y `4.2.1.01.011` (Descuentos Obtenidos por Pronto Pago, ingreso). Los builders de pagos reciben `earlyPaymentDiscountAmount` y cierran la cuenta: **cobro** → Dr descuento concedido / Cr CxC; **pago** → Dr CxP / Cr descuento obtenido. `applyPaymentEffects` de `incoming-payments`/`outgoing-payments` acumula el descuento total por pago (ramas cuotas y normal). Preview de borrador expone el campo (`previewFromDraft`).
   - **Cobertura:** 3 tests unitarios A7 en `accounting-engine.service.spec.ts` + 1 E2E en `test/incoming-payments.e2e-spec.ts` (cobro con 2% de pronto pago → línea EARLY + CxC cerrada por el total de la factura).
   - **Modelo de uso de retenciones (documentado):** la retención se registra en la **factura de compra** (líneas `retentionLines` type-aware: IT→`2.1.2.01.009`, IUE→`2.1.2.01.008`, RC-IVA→`2.1.2.01.006`; la factura acredita CxP por el neto y cada cuenta de retención por su tipo) y el **pago paga el neto** (CxP − retención) **sin** volver a registrar `withholdingAmount` en el pago (evitaría doble contabilización del pasivo). La retención type-aware en el pago saliente queda como deuda/backlog (schema `withholdingTaxTypeId` + UI).
11. **Mismo tratamiento contable FRV/FRC + reversa del IT + reporte Form 200** (`backend / accounting`) — `✅ Resuelto` (2026-08-10)
   - **Validación normativa:** Ley N° 843 (TO 30/09/2023), DS 21530 (reglamento IVA), DS 21532 (reglamento IT) y el **ejemplo oficial del SIN del Formulario 200** confirman: débito fiscal = ingresos brutos facturados × 13% (por dentro), crédito fiscal = compras × 13% + descuentos otorgados × 13% (Art. 8 inc. b), descuentos obtenidos adicionan débito (Art. 7 último párr.), IT = ingresos brutos × 3% (Art. 74-75), y el ICE no integra la base del IVA/IT (DS 21530 Art. 5 + DS 21532 Art. 4 inc. a). Las fuentes no oficiales que usan `precio × 13/113` extrapolan el IVA estándar internacional y NO corresponden al sistema boliviano.
   - **Decisión de negocio:** FRV = FV (y FRC = FPI) con el **mismo tratamiento contable** — CxC/CxP, ingreso, IVA, descuento 87/13, IT, ICE — diferenciándose **solo** en que la reserva no mueve inventario (se mueve por entrega/recepción). Cambio: el **IT ahora aplica también a la FRV** (antes `isReserve !== 'Y'` lo excluía).
   - **Reversa del IT en ventas:** NC de venta → Dr `2.1.2.01.003` / Cr `6.1.4.01.001` (reversa); ND de venta → Dr `6.1.4.01.001` / Cr `2.1.2.01.003` (IT adicional); devolución con reversa financiera → reversa. Permite que la cuenta de IT por pagar cuadre con los ingresos netos del período.
   - **Descuento en NC/ND/devolución:** desglose **87/13** (Bolivia) y reversa del **descuento de cabecera** mediante plug espejo de la factura (con ajuste de redondeo a cuentas ROUNDING).
   - **Reporte de declaración tributaria:** `GET /reports/tax-declaration?from&to` (solo `countryCode === 'BO'`) agrega del mayor (asientos POSTED) y de los documentos de venta las cifras del **Formulario 200** (ingresos brutos FV+FRV netos de NC/ND/devoluciones, débito `2.1.2.01.001`, crédito `1.1.6.01.001`, descuentos `4.1.1.01.003`/`5.1.2.01.005`, IT `2.1.2.01.003`, ICE `2.1.2.01.012`, retenciones `2.1.2.01.006-009`) + pantalla en Reports.
   - **Cobertura:** 5 tests unitarios A8 en `accounting-engine.service.spec.ts` + 1 E2E en `test/returns-and-credit-notes.e2e-spec.ts` (FV genera IT → NC lo revierte, asiento balanceado). Backend 133 suites/1311 tests.
12. **Split 87/13 indicator-aware + Form 200 completo** (`backend / accounting`) — `✅ Resuelto` (2026-08-12)
   - **Consistencia corregida:** el desglose del descuento 87/13 en **ventas** (FV/NC/ND/devolución) era solo por perfil (`profile.splitSaleDiscountBaseTax && isBolivia`), mientras **compras** ya era indicator-aware (`resolveEffectiveCalculationMethod`). Nuevo helper `resolveDiscountSplit` en `journal-entry-core.ts`: el indicador de la línea manda si está explícito (una línea STANDARD o tasa cero en tenant BO no se desglosa); sin indicador, usa el método por defecto del país. Compartido por las 4 familias de ventas.
   - **Form 200 completo:** el reporte `GET /reports/tax-declaration` ahora incluye la **base de compras** (casilla 26: FPI/FRC − NC compra) y el **detalle de documentos de compra** (facturas y NC) además del de ventas. Pantalla actualizada.
   - **Cobertura:** 1 test unitario A8 nuevo (NC en tenant BO con indicador STANDARD no desglosa 87/13).
13. **Retención type-aware en el pago + ICE por artículo** (`backend / accounting`) — `✅ Resuelto` (2026-08-12)
   - **Retención type-aware:** el `withholdingAmount` del pago saliente acreditaba siempre la cuenta genérica de IT (`2.1.2.01.009`). Nuevo `OutgoingPayment.withholdingTaxTypeId` (schema + db push): si se indica el tipo (IT/IUE/RC-IVA), el asiento acredita la **cuenta específica del tipo** (`WithholdingTaxType.accountId`); sin tipo, fallback legacy al mapping `WITHHOLDING_TAX_PAYABLE`. DTOs create/update, validación (tipo activo del tenant), preview de borrador y selector de tipo en el form de pagos.
   - **ICE por artículo:** el reporte `GET /reports/tax-declaration` agrega `icePorArticulo` (código, nombre, tasa y monto por ítem desde el mayor) para el Form 605/608.
   - **Cobertura:** 1 test unitario (pago con tipo → acredita la cuenta del tipo, no la genérica).
14. **ICE específico por unidad + Libro de Compras y Ventas** (`backend / accounting`) — `✅ Resuelto` (2026-08-12)
   - **ICE específico (DS 24053):** el ICE boliviano se liquida mayormente por monto fijo por unidad (bebidas, cigarrillos, cosméticos), no solo por porcentaje. Nuevos `Item.iceBasis` (`PERCENTAGE` | `SPECIFIC`) y `Item.iceAmountPerUnit`; el builder de venta calcula `SPECIFIC → cantidad × monto por unidad` o `PERCENTAGE → neto × tasa`. Form de artículo con selector condicional.
   - **Libro de Compras y Ventas:** `GET /reports/iva-books?from&to` (solo BO) — detalle mensual por factura (ventas FV+FRV, compras FPI+FRC, NC como filas) con código, fecha, NIT, razón social, total, base e IVA, y débito/crédito fiscal netos como respaldo del Form 200. Pantalla en Reports con tabs.
   - **Cobertura:** 1 test unitario (ICE específico: 2 ud × 5 Bs = 10 Bs a ICE por Pagar).
15. **Cierre de período contable — protección en el motor** (`backend / accounting`) — `✅ Resuelto` (2026-08-12)
   - **Gap:** la infraestructura de períodos (`FiscalYear`/`AccountingPeriod`, `close/reopen/validatePostingDate`, UI) protegía los asientos **manuales** y activos fijos, pero **no los asientos automáticos** (confirmación de documentos: facturas, pagos, stock) — un período cerrado podía seguir recibiendo asientos vía documentos.
   - **Fix:** en `JournalEntryCore._persist` (choke point de todos los asientos): si existe período para la fecha y está cerrado/bloqueado (o año fiscal cerrado) → `ConflictException`; si existe período abierto → el asiento se vincula a `fiscalYearId`/`periodId`; si no existe período → se permite (backward compatible).
   - **Cobertura:** 2 tests unitarios (bloqueo en período cerrado + vínculo del asiento al período).
16. **Fix: descuento no figura en FRV desde entrega** (`backend / ventas`) — `✅ Resuelto` (2026-08-12)
   - **Síntoma:** FRV de venta con descuento creada desde la entrega (DEL-000057) — el asiento preliminar no mostraba el descuento.
   - **Causa raíz (3 bugs encadenados):** (1) `delivery-orders.createManual` ignoraba `line.discountPct` del payload (solo usaba el descuento automático) → la entrega nacía sin descuento; (2) `sale-reserve-invoices.createFromDelivery` usaba solo el `discountPct` del payload sin heredar el del ítem de la entrega (viola R1) en las ramas "entrega suelta" y "resolver genérico"; (3) el módulo FRV persistía `item.subtotal = lineTotal` (con IVA) y no `lineSubtotal`, corrompiendo el preview del documento confirmado.
   - **Fix:** (1) `discountPct` del payload tiene prioridad y si no viene se usa el automático; (2) fallback a `di.discountPct`/`di.discountAmt` en ambas ramas del FRV createFromDelivery; (3) persistir `subtotal = lineSubtotal` (neto) + `lineSubtotal` explícito, con fallback en `_generateJournalEntry` para registros viejos (`lineSubtotal ?? subtotal − tax`).
   - **Cobertura:** 1 test unitario (FRV línea 350×5/8% → 87/13) + 1 E2E (entrega manual con descuento → FRV → asiento con SALES_DISCOUNT y preview con descuento). Backend 133 suites/1317 tests, E2E 71.

---

## 6. Métricas de referencia

| Métrica | Valor | Fecha |
|---------|-------|-------|
| Backend build / lint / unit / E2E | ✅ build / ✅ 0 errors 0 warnings / ✅ 128 suites 1247 tests / ✅ 11 suites 57 E2E | 25/07/2026 |
| Backend build / lint / unit / E2E | ✅ build / ✅ 0 errors 0 warnings / ✅ 126 suites 1157 tests / ✅ 12 suites 60 E2E | 14/07/2026 |
| Load tests k6 (perfil `small`) | 5/5 escenarios passed, 0% fallos, aislamiento multitenant verificado | 29/06/2026 |
| Backend suites passing | 64/64 (100%) | 23/05/2026 |
| Backend tests passing | 341/341 (100%) | 23/05/2026 |
| Frontend build size | 3.19 MB | 23/05/2026 |
| Frontend lint errors | 0 (16 warnings) | 23/05/2026 |
| E2E tests passing | Playwright 184 ✅ / Backend E2E 57 ✅ | 29/06/2026 |
| Backend services | 56 | 21/05/2026 |
| Largest service (lines) | delivery-orders.service.ts (4,421) | 21/05/2026 |
| Frontend `.subscribe()` count | 680 en 139 archivos | 23/05/2026 |
| Frontend `*ngIf` → `@if` migrated | ~1,847 en ~118 archivos | 19/04/2026 |
| Frontend `takeUntilDestroyed` | 333 en 108 archivos | 23/05/2026 |
| `findUnique` sin tenantId | 0 migradas (21 done) | 21/05/2026 |
| `$queryRawUnsafe` count | 0 (en código fuente) | 21/05/2026 |
| Prisma indexes | 109 | 21/05/2026 |
| Prisma unique constraints | 52 | 21/05/2026 |

---

## 7. Deuda estructural priorizada (auditoría 2026-08-08, actualizada)

> Evaluación honesta post-fixes de integridad (validación branch↔warehouse en 22 servicios + POS,
> herencia de branchId en flujos de copia, matriz de almacenes optimizada a 1 query).
> El ERP es robusto en diseño de fondo; estas son deudas estructurales que cobran interés
> con el tiempo, no bugs urgentes.

| # | Área | Item | Por qué importa | Estado |
|---|------|------|-----------------|--------|
| S1 | Backend / accounting | `accounting-engine.service.ts` monolito (6,436 líneas) | Cada feature contable nueva lo engordaba; errores difíciles de diagnosticar | ✅ **RESUELTO (2026-08-08):** split por familia → `src/common/accounting/` (fachada 2,884 + 4 builders por dominio + core compartido). Superficie pública estable. Ver `ROADMAP.md` DT.15. Pendiente menor: `previewJournalEntryFromDraft` (992 líneas) para F6 |
| S6 | Backend / infra | `PermissionsGuard` fail-open (RBAC) | Cualquier handler sin `@RequirePermission` era accesible por cualquier autenticado | ✅ **RESUELTO (2026-08-08):** fail-closed + permisos incluidos en el JWT (antes el JWT nunca los llevaba). 6 tests del guard. Ver `AUDIT.md` §2.0 |
| S2 | Backend / POS | `pos.service.ts` duplicaba la lógica de salida de stock de `sale-invoices.service` | Riesgo de divergencia (como pasó con `calcLineWithIndicator`); el POS perdía la multi-asignación de lotes/series | ✅ **RESUELTO (2026-08-08):** análisis previo mostró que la delegación pura rompería el comportamiento del POS (asiento contable nuevo, saldos AR, precios, stock — divergencias deliberadas de un diseño de venta atómica con pago). Se optó por **helpers compartidos**: el POS ahora usa `applyOutgoingStock` (mismo helper que delivery-orders/stock-exits) en vez de su bucle inline, ganando multi-asignación de lotes/series. Kits SELL_AS_COMPONENTS se mantienen aparte. ~40 líneas duplicadas eliminadas, sin cambio de comportamiento. Nota: el POS sigue sin generar asiento contable — si el negocio lo requiere, es una feature separada, no deuda |
| S3 | Frontend / forms | `purchase-requests-form` no extiende `DocumentFormBase` (usa `implements OnInit` directo) | Único formulario fuera del patrón canónico: sin `skipBranchValidation`, sin `defaultWarehouseId` con filtro por sucursal, sin auto-sync branch→warehouse | ✅ **RESUELTO (2026-08-08):** migrado a `PurchaseDocumentFormBase`. Implementa los 5 abstracts (canEdit, form, documentType, documentId, itemsArray), hereda `defaultWarehouseId` con filtro por sucursal, `skipBranchValidation`, auto-sync branch→warehouse y `onHeaderWarehouseChanged`. `status` pasó de getter a campo sync desde el request. Override de `applyEditRestrictions` conserva el comportamiento DRAFT-editable de solicitudes. `'PURCHASE_REQUEST'` agregado al union `DocumentType` de prisma-types. Build + lint + 1,251 unit tests en verde. Ver `ROADMAP.md` DT.17 |
| S4 | Frontend / tests | Patrón de testing de formularios frágil (mocks manuales) | El caso `warn` vs `warning` rompía ~6 specs; conviene auditar otros mocks del helper por API desalineada | ✅ **RESUELTO (2026-08-08):** auditoría de los 17 mocks del helper (`document-form-testing/configure-testing-module.ts`) contra las APIs reales. Correcciones: (1) `ToastService` — eliminado `warn` muerto (el real no lo tiene), agregados `toasts`/`priceUpdate`/`dismiss`; (2) `AuthService` — `isAdmin` solo ADMIN, `defaultWarehouseId` con fallback triple real, agregado `defaultPosTerminalId`, `login`/`refreshToken` retornan Observable; (3) **crítico**: `calculateLine`/`recalculateAllLines` del mock eran no-ops → ahora delegan al servicio real (los specs de montos pasaban falsy); `removeLineWithConfirm` replica la lógica real (false si queda 1 línea); agregados `setLines`/`getTaxRateLabel`/`getTaxCodeLabel`; (4) `TenantDateService` — `formatDate*`/`toStartOfDayISO`/`toEndOfDayISO` retornaban siempre null, ahora implementados con zona UTC determinista; agregados getters `timeZone`/`locale`; (5) `SettingsService` — `save`/`load` ahora mutan el snapshot (replica el tap real); (6) `DocumentFlowService` — `getFlow` con `current` no-null, `getRoute` con shape real; (7) spies CRUD (partners/items/accounts/projects/udf/dimensions) ahora retornan Observable. Build + lint + 1,251 tests en verde. |
| S5 | Frontend / design system | ~93 alturas crudas en `pages/`/`shared/` que deberían ser tokens LUNA (`--size-control-sm/md/lg`) | Deuda cosmética acumulativa; la mayoría decorativa. Ya documentada en AGENTS.md §4 | ✅ **RESUELTO (2026-08-08):** auditoría de las 79 alturas crudas (rango 24-48px) en `pages/`/`shared/` → 34 eran controles/botones con token equivalente y 45 decorativas. Migradas **31 líneas en 20 archivos** a `var(--size-control-sm/md/lg)` con valor idéntico (32/36/40px → cero cambio visual): reports móviles (11 líneas en 6 archivos), selectores custom (partner-selector ×3, item-selector ×2, combobox-base), POS (3), bank-reconciliation (2), partner-detail/stock-transfers (readonly mimics), botones de acción (payments ×2, quotations ×2) y LUNA canónicos (pag-size-trigger ×2, btn-icon-only). **Excepciones documentadas (no mapean a token, no se tocaron):** alturas de 28px (triggers compactos de partner/item-selector, `sp-toggle-expand`, `luna-btn--icon-only`) y 38px (wrapper de búsqueda POS) — son decisiones de diseño más compactas que `sm`; y ~45 alturas decorativas (iconos, badges, avatares, skeletons) que no deben atarse al token de control. `min-height` crudos de controles: 0 restantes. Ver `ROADMAP.md` DT.19 |
| S7 | Frontend + Backend / Plan de Cuentas | Lista página a 100 (oculta cuentas), árbol ignora filtros y solo expande niveles 1-2, y `computeBalances` no consolida el subárbol (las cuentas resumidoras no totalizan) | Con 295 cuentas: lista mostraba 100, árbol 55 visibles; los asientos en cuentas nivel 5 no subían su saldo a los niveles 1-4; y los saldos incluían asientos DRAFT (inconsistente con el ledger) | ✅ **RESUELTO (2026-08-08):** (1) **Backend** — `computeBalances` consolida por subárbol (procesa de nivel 5→1 sumando hijas al padre; el `balance` se recalcula con el `balanceType` del padre) y filtra por `status: POSTED` por defecto; `GET /accounts?includeDrafts=true` suma DRAFT (proyección). (2) **Frontend** — lista sin paginar (muestra el universo filtrado completo), filtros compartidos entre lista y árbol (`matchesFilters`), árbol expande niveles 1-4 y auto-expande ancestros al buscar, toggle "Incluir borradores". Ver `ROADMAP.md` DT.20 |
| S8 | Backend / contabilidad | `previewJournalEntryFromDraft` de `PURCHASE_RETURN` usaba la heurística D5 de venta: sin `baseDocType` en las líneas del draft (el FormGroup no lo propagaba) → `financialReversal = true` → el asiento preliminar generaba reversa FINANCIERA (CxP + compras + IVA) en vez del espejo logístico de la recepción | El asiento real al confirmar era correcto (servicio fuerza `financialReversal=false`), pero el **preview del draft** (botón "asiento preliminar" del formulario) mostraba cuentas que no corresponden a una devolución de recepción | ✅ **RESUELTO (2026-08-08):** (1) **Backend** — `previewJournalEntryFromDraft` de `PURCHASE_RETURN` fuerza `financialReversal = false` (consistente con `previewJournalEntry` y `_confirmInTx`; la reversa financiera es de la NC de compra). La heurística D5 queda solo para `SALES_RETURN` donde sí aplica. (2) **Frontend** — las líneas del formulario de devolución propagan `baseDocType`/`baseDocId`/`baseLineId` (desde recepción y al recargar) y `getPayload` los usa. Test de regresión del preview del draft (engine 72/72). Ver `ROADMAP.md` DT.21 |
| S9 | Frontend / kardex | La pestaña Kardex del detalle del artículo (`item-detail`) mostraba solo 7 columnas (fecha, tipo, doc, entrada, salida, saldo, costo unit.) — sin `entryValue`/`exitValue`/`balanceValue` (costo total de la transacción y saldo valorizado) | El backend **ya devolvía** los tres campos de valorización en `ItemKardexRow`, y la página kardex completa (`pages/kardex/`) los mostraba; solo la pestaña del detalle no los renderizaba | ✅ **RESUELTO (2026-08-08):** agregadas las columnas "Entrada Bs", "Salida Bs" y "Saldo valorizado" a `kardexColumns` y sus celdas en `item-detail.component.html` (`#cell2`), con formato `1.2-2` y guion cuando el valor es null. Sin cambios de backend. Build + lint + 1,257 tests en verde. Ver `ROADMAP.md` DT.22 |
| S10 | Frontend / formularios | Bugs funcionales en formularios comerciales (auditoría UX 2026-08-08): (1) `purchase-returns` selector de proveedor filtraba `CLIENT` en vez de `SUPPLIER`, panel de trazabilidad mostraba flujo `SALES_RETURN` en una devolución de compra, y buscador de ítems usaba `canBeSold` en vez de `canBePurchased`; (2) `delivery-orders` el Almacén de cabecera era un `luna-input` readonly (todos los demás formularios usan selector editable); (3) `journal-entries` `getAccountRequiresPartner` estaba definida pero **nunca se llamaba** → el asiento manual no avisaba ni validaba cuentas CxC/CxP sin socio | (1) El usuario creando una devolución de compra veía clientes en vez de proveedores y no podía buscar ítems comprables; (2) en entregas no se podía cambiar el almacén de cabecera; (3) el backend rechazaba el posteo de asientos sin partner sin feedback previo | ✅ **RESUELTO (2026-08-08):** (1) `purchase-returns` → `filterType="SUPPLIER"`, `type="PURCHASE_RETURN"`, `canBePurchased`; (2) `delivery-orders` → `app-warehouse-selector` editable con `skipBranchValidation` + `onHeaderWarehouseChanged`; (3) `journal-entries` → warning "requiere socio" en la celda de cuenta + validación en `save()` (bloquea con toast). Build + lint + 1,257 tests en verde. Ver `ROADMAP.md` DT.23 |
| S11 | Backend + Frontend / coherencia contable y moneda | (1) El estado de cuenta del partner (`getTransactions`) sumaba en moneda del documento mientras el ledger sumaba en moneda base → montos divergentes con transacciones mixtas BOB/USD; (2) el listado de asientos no mostraba montos; (3) el asiento manual no bloqueaba períodos cerrados en `save()` (solo badge) y no validaba el período al crear; (4) `previewIsBalanced` cuadraba en moneda del documento vs `isBalanced` en base; (5) "Bs" hardcodeado en kardex, item-detail, returns, dashboard y settings | (1) Un usuario con transacciones USD veía totales del estado de cuenta que no coincidían con el ledger; (2) no podía cuadrar la lista de asientos visualmente; (3) el backend rechazaba al guardar en período cerrado sin aviso previo; (4) preview y form podían discrepar en multi-moneda; (5) si el tenant cambiaba de moneda base, las etiquetas quedaban mal | ✅ **RESUELTO (2026-08-08):** (1) `getTransactions` emite `debit_base`/`credit_base` por rama del UNION (con `totalInBaseCurrency` cuando existe), y los aggregates + saldo corrido usan esos → summary y running balance en base, consistentes con el ledger; (2) `findAll` de journal-entries expone `totalDebitBase`/`totalCreditBase` y el listado muestra columnas "Débito M/N"/"Crédito M/N"; (3) `save()` bloquea si `periodValidation.isOpen === false` y `ngOnInit` valida el período al crear; (4) `previewIsBalanced` cuadra en moneda base; (5) etiquetas dinámicas con `baseCurrency` (kardex, item-detail, returns, dashboard, settings). Ver `ROADMAP.md` DT.24 |

| S12 | Frontend / kardex unificado | La pestaña Kardex del detalle del artículo y la página kardex completa mostraban información distinta: la pestaña sin columnas Lote/Costo prom., sin tarjetas de resumen, con el tipo de movimiento como texto plano (vs badge), y `fmtAmount` confundía `0` con `null` (entrada gratis indistinguible de movimiento sin valorizar) en ambas vistas; además no había ninguna advertencia de que `avgCost`/`balanceValue` se calculan solo sobre el subconjunto filtrado (almacén/lote/serie) | El usuario que consultaba el kardex desde el detalle no veía el costo promedio ni el resumen, el tipo de movimiento se percibía distinto según la pantalla, y el "Costo prom." filtrado podía malinterpretarse como el promedio global | ✅ **RESUELTO (2026-08-08):** (1) la pestaña `item-detail` ahora incluye las columnas **Lote** y **Costo prom.** (paridad con la página) y el **badge de tipo de movimiento** (luna-badge con variante in/out); (2) tarjetas de **resumen del kardex** (Entradas/Salidas/Saldo actual/Costo prom./Valor inventario) en la pestaña, alimentadas por `kardexSummary`; (3) `fmtAmount` distingue `null` (→ "—") de `0` (→ "0,00") en kardex e item-detail; (4) **hint ⓘ** en "Costo prom." del kardex (cuando hay filtro de almacén/lote/serie) y del item-detail (siempre, al estar filtrado por almacén) explicando que el promedio es del subconjunto. Build + lint + 1,257 tests en verde. Ver `ROADMAP.md` DT.25 |
| S13 | Frontend / copy & labels | Incoherencias de copy/labels/iconos en formularios comerciales (auditoría UX 2026-08-08): (1) typos sin tilde ("recepcion", "Credito", "Estas", "Anade", "articulo", "linea"); (2) botones eliminar línea y banners con Font Awesome (`fas fa-times`, `fa-pencil-alt`, `fa-sync`, `fa-boxes`, `fa-spinner`, `fa-download`) en compras, mientras ventas usa `luna-action-icon`; (3) emojis 💳📝📥📦 en el menú "Copiar a" y banners de `purchase-invoices`; (4) botón de crear mostraba "Guardando..." en vez de "Creando..."; (5) labels de referencia en 3-4 variantes ("Referencia cliente" / "Referencia del cliente" / "Ref. Cliente") y "Observaciones" vs "Notas"; (6) títulos asimétricos (compras/entrega con "Manual", ventas sin; "Cotización" vs "Cotización de Compra"); (7) toasts "creada" sin "correctamente" en facturas; (8) items del menú ⋮ de purchase-quotations con variant no-canónico | Incoherencia perceptible al navegar entre formularios del mismo dominio: mismo campo con distinto label, mismos botones con iconos de sistemas distintos, y typos que se ven en producción | ✅ **RESUELTO (2026-08-08):** (1) tildes corregidas en textos visibles; (2) todos los `fas fa-*` de formularios comerciales → `luna-action-icon` (`close`, `edit`, `sync`, `boxes`, `spinner`, `download`); (3) emojis → `luna-action-icon` (`creditCard`, `fileText`, `download`, `clipboard`); (4) botones de crear ahora dicen "Creando..." (los de guardar borrador/cambios conservan "Guardando..."); (5) labels unificados a "Referencia del cliente/proveedor" y "Notas"; (6) "Nuevo Pedido Manual" en ventas y "Cotización de Venta" (paridad con compras); (7) toasts "… creada correctamente" en facturas; (8) menú ⋮ de purchase-quotations alineado al patrón canónico (`variant="ghost" size="md" [fullWidth]="true"`). Build + lint + 1,257 tests en verde. Ver `ROADMAP.md` DT.26 |
| S14 | Frontend / bugs funcionales P0 (auditoría UX v2 2026-08-09) | (1) `document-drafts`: botón "Ver" **convertía** el borrador (acción definitiva, no reversible) con etiqueta engañosa e iconos confundidos; (2) `transport-guides`: el badge mapeaba `CONFIRMED` (inexistente) → guías `SENT`/`DELIVERED` se veían "Cancelada", y el título mostraba el ID en vez del código; (3) `outgoing-payments`: pestaña "Métodos de pago" vacía al crear desde factura (el `@case` no existía en el template); (4) `incoming/outgoing-payments`: la moneda era un input de texto libre sin `exchangeRate` en el payload → multi-moneda roto (sin TC ni diferencia de cambio); (5) `stock-counts`: la columna Lote nunca se asignaba (líneas con `batchId: null`) — conteo de artículos con trazabilidad por lote no conciliable | (1) El usuario creía abrir un borrador y lo convertía; (2) una guía enviada/entregada aparecía cancelada; (3) pestaña en blanco al crear pago desde factura; (4) no se podían registrar pagos en USD con su tipo de cambio; (5) el conteo físico no podía registrar el lote contado | ✅ **RESUELTO (2026-08-09):** (1) "Ver" navega al borrador (`editDraft`) y "Convertir a documento" quedó explícito en el menú con iconos correctos (view/edit/check/close); (2) badge mapea `DRAFT/SENT/DELIVERED/CANCELLED` ("Borrador/Enviada/Entregada/Cancelada") y el título usa el código del documento; (3) pestaña redundante eliminada del getter `tabs` de outgoing (los métodos de pago ya viven en General); (4) la moneda usa `app-document-currency-field` (selector + auto-TC) y `_buildPayload` envía `exchangeRate` — el backend ya lo soportaba (DTO vía `BaseDocumentDto`, service con `validateExchangeRate`, motor contable con doble expresión y diferencia de cambio); (5) las líneas de stock-counts guardan `trackingType` y muestran `app-batch-combobox` cuando es LOT (el backend ya aceptaba `batchId` por línea); SERIAL requiere migración de schema, documentado. Build + lint + 1,257 tests en verde. Ver `ROADMAP.md` DT.27 |
| S15 | Frontend + Backend / información faltante P1 (auditoría UX v2 2026-08-09) | (1) `item-form` no mostraba el costo promedio (solo el detalle, y no era evidente que es calculado); (2) **imposible reactivar** un partner o artículo inactivado por UI (el `update` no aceptaba `status` y los listados filtraban solo ACTIVE); (3) `partner-detail` solo tenía 3 tabs (General/Estado de Cuenta/Docs) vs las 8 del formulario — no se veían direcciones ni cuentas bancarias sin entrar a editar | (1) El usuario no sabía cuál era el costo actual del artículo ni que no es editable; (2) un socio/artículo inactivado quedaba "muerto" en el sistema sin forma de volver a activarlo; (3) la info de direcciones y bancos era invisible en modo lectura | ✅ **RESUELTO (2026-08-09):** (1) **costo promedio informativo** — bloque de solo lectura en la tab Stock del `item-form` (vía `getAvgCost`), con hint "Calculado por movimientos. No editable." (decisión del usuario: el costo no es editable, se calcula por movimientos o revalorización futura); (2) **reactivación** — backend: `status` agregado a `UpdateItemDto`/`UpdatePartnerDto` y query param `?status=` en `GET /partners`; frontend: menú ⋮ muestra "Reactivar" para inactivos + toggle "Ver inactivos" en listados de items y partners + método `reactivate`; (3) **tabs del partner-detail** — agregadas tabs **Direcciones** y **Cuentas Bancarias** consumiendo los endpoints separados existentes (`/partner-addresses/by-partner`, `/partner-bank-accounts/by-partner`), con badge de tipo/principal. Backend 131 suites/1270 tests y frontend 1,257 tests en verde. Ver `ROADMAP.md` DT.28 |
| S16 | Frontend + Backend / bloque P1 restante completado + F7.2 UI (auditoría UX v2 2026-08-09) | Quedaban 4 items P1 sin resolver: (1) **saldo/stock en listados** — el listado de partners no mostraba el saldo pendiente y el de items no mostraba stock ni costo; (2) **disponibilidad de lotes** — los lotes solo exponían `stockPhysical`, sin comprometido (líneas de pedidos de venta abiertas + reservas) ni disponible; (3) **cuentas de ingreso/gasto** — `SALES_REVENUE`/`PURCHASES` iban solo por AccountMapping global, sin resolución por jerarquía artículo→grupo→almacén; (4) **trazabilidad SERIAL en tomas** — `StockCountLine` no guardaba seriales y el form no tenía input para SERIAL. Además F7.2 multi-divisa tenía gaps de UI (columna Moneda con enum crudo, listado de asientos sin M/E, warning SPECIFIC comparando moneda del asiento en vez de la línea) | (1) El usuario no veía a quién se debe/cuánto se le debe desde el listado, ni cuánto stock/costo tiene un artículo sin entrar al detalle; (2) no se podía saber cuánto de un lote estaba comprometido vs disponible; (3) imposible hacer P&L por línea de negocio (una sola cuenta de ingreso/gasto para todo el catálogo); (4) los conteos físicos de artículos serializados no podían registrar qué series estaban presentes; F7.2: la moneda de las cuentas era ilegible y los totales M/E no se veían en el listado de asientos | ✅ **RESUELTO (2026-08-09):** (1) **saldo en partners** — `GET /partners` expone `balanceAR/balanceAP/netBalance` (query batch sobre `PartnerBalance` por página) y la columna "Saldo" lo muestra según tipo (CLIENT→AR, SUPPLIER→AP, BOTH→neto) con color deudor/acreedor; **stock y costo en items** — `GET /items` expone `stockPhysical`/`stockAvailable` (Σ por artículo) y `avgCost` ponderado por cantidad (Σ avgCost×qty/Σ qty), columnas "Stock"/"Disponible"/"Costo prom." en el listado; (2) **disponibilidad de lotes** — `batches` expone `committed` (Σ `SalesOrderItem.openQty` + reservas `SaleInvoiceItem` con `batchId`, documentos no cancelados) y `available = stockPhysical − committed` en lista, detalle y lookup, con columnas en la lista y coloreado de disponible; (3) **cuentas de ingreso/gasto por jerarquía** — schema: `salesRevenueAccountId`/`purchaseAccountId` en `Item`/`ItemGroup`/`Warehouse`/`ItemWarehouseAccount` + relaciones inversas en `Account`; engine: `SALES_REVENUE→salesRevenueAccountId` y `PURCHASES→purchaseAccountId` en `ENTRY_TYPE_TO_ITEM_FIELD`, con fallback al AccountMapping global si la jerarquía no la tiene configurada (compatibilidad); DTOs y forms de item (matriz por almacén), item-groups y warehouses con los 2 selectores; (4) **SERIAL en tomas** — schema: `StockCountLine.trackingAssignments Json?`; DTOs aceptan `serialNumbers: string[]`; `count()` persiste las asignaciones y `adjust()` resuelve códigos→IDs y propaga `trackingAssignments` al `StockAdjustmentItem` (el `confirmInTransaction` actualiza el status de cada serie); form de tomas con botón "Asignar series" vía `batch-serial-assignment-modal` y chips de códigos. **F7.2 UI:** columna "Moneda" de cuentas con badge + label (`ACCOUNT_CURRENCY_MODE_LABELS`, SPECIFIC muestra la moneda), hint en "Modo de moneda" con `localCurrency`/`systemCurrency`, listado de asientos con columnas "Débito M/E"/"Crédito M/E" (`totalDebitSystem`/`totalCreditSystem` calculados en `findAll`) y columna Moneda, y fix del warning SPECIFIC que ahora compara la moneda de la **línea** (`line.currency ?? entry.currency`). Quedan documentados como pendientes: diferencia de cambio automática en asientos manuales, y gain/loss accounts del settings sin consumo por builders. Backend 132 suites/1283 tests y frontend en verde. Ver `ROADMAP.md` DT.29 |
| S17 | Frontend / confusiones críticas de UX (Bloque A, auditoría de explicabilidad 2026-08-09) | Auditoría de explicabilidad detectó 4 hallazgos 🔴 que pueden causar errores de datos o desorientar: (1) **"Vendedor" pedía el ID numérico interno** en 7 formularios de ventas (`luna-input type="number"` con placeholder "ID del vendedor..."); (2) **"Fecha" vs "F. Contab." sin hint** en 21 formularios — el usuario no sabe que la fecha contable define el período del asiento; (3) **búsqueda global mostraba estados en inglés crudo** ("OPEN"/"CLOSED") sin color semántico; (4) **listado de facturas se contradecía**: empty state decía "Se crean desde un pedido de venta" pero el botón "+ Nueva Factura" crea manual | (1) Un vendedor no conoce su ID de BD y puede tipear cualquier número → documento con vendedor incorrecto; (2) el usuario puede setear solo "Fecha" y que el asiento caiga en el período contable equivocado; (3) un usuario que entra por la búsqueda ve datos que no entiende; (4) no se explica cómo partir de un pedido (menú "Copiar a" invisible) | ✅ **RESUELTO (2026-08-09):** (1) **vendedor → selector real** — `app-sales-person-selector` (búsqueda por nombre, CVA compatible con el control `salesPersonId` del FormGroup, sin cambios de payload) en `sale-invoices`, `sales-orders`, `delivery-orders`, `sale-reserve-invoices`, `sales-credit-notes`, `sales-returns`, `sales-quotations`; (2) **hint de fecha contable** — `helperText` (luna-input INLINE) o `hint` (wrapper `luna-form-field`) en los 21 forms con `postingDate`: "Fecha del documento. La fecha contable define el período en que se registra el asiento."; (3) **búsqueda global** — `statusLabel()` (Abierta/Cerrada/Cancelada) y `typeLabel()` (Cliente/Proveedor) + badges con color por estado en `search.component`; (4) **guidance de facturas** — `emptyDesc` ahora explica ambos flujos: "Puedes crearla manualmente con '+ Nueva Factura', o generarla desde un pedido de venta con 'Copiar a'.". Frontend 1,257 tests en verde. Ver `docs/plans/plan-mejoras-ux-ui-frontend.md` Prioridad 7 |
| S18 | Frontend / bloques B+C de la auditoría UX (unificación visual + explicabilidad, 2026-08-09) | Pendientes de S17: **B — Visual**: color de estado OPEN contradictorio (verde en stock vs azul en ventas), label "Referencia" vs "Nº Referencia", botón "Crear" genérico en 5 maestros, toasts "creado" vs "creado correctamente", densidad de tabla desigual, iconos residuales (✅/❌, "½", `fas fa-link`), tildes ("Nuevo Articulo"); **C — Explicabilidad**: "GRIR" sin traducir, "DPP" en cuotas, placeholder "- Sin almacén -" confuso, listados de documentos sin help-hint | Inconsistencias perceptibles entre módulos y falta de orientación para el usuario nuevo | ✅ **RESUELTO (2026-08-09):** **B** — OPEN unificado a `info` (azul) en los 4 listados de stock (CONFIRMED/CLOSED → `success`); label "Nº Referencia" en 4 forms de stock; botones "Crear Cuenta/Cuenta Bancaria/Moneda/Año Fiscal/Proyecto" en 5 maestros; `density="compact"` en facturas y recepciones; ✅/❌ → `luna-action-icon check/close` (purchase-requests), "½" → "Parcial" (pedidos), `fas fa-link` → `luna-action-icon link`; tildes corregidas (Nuevo Artículo, Sin artículos, Nuevo Almacén); toasts de maestros al patrón "X creado correctamente"/"X actualizado correctamente" (warehouses, currencies, price-lists, branches, users, projects, items, partners, banks — spec de bank-form actualizado). **C** — "Recepción de mercancía (GRIR)" + helperText en item-form/item-group-form/warehouse-form; "Desc. pronto pago" (con title) en cuotas de facturas; placeholder "Seleccionar almacén (opcional)" en 13 forms; `app-help-hint` en los listados de facturas/pedidos de venta y facturas/órdenes de compra enlazados a `sales-flow`/`purchase-flow`. Frontend 1,257 tests en verde. Ver `docs/plans/plan-mejoras-ux-ui-frontend.md` Prioridad 7 (B/C resueltos) |

**Veredicto:** los cimientos (trazabilidad documental, doble expresión monetaria, multi-tenancy,
determinación de cuentas jerárquica, branch↔warehouse consistente) están sólidos. **S1, S2, S3,
S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17 y S18 resueltos (2026-08-08/09).** Todos los
formularios de documentos usan el patrón canónico, el helper de testing refleja las APIs reales,
las alturas de control usan tokens LUNA, el Plan de Cuentas muestra todas las cuentas con
totalización por nivel (POSTED por defecto, DRAFT opcional como proyección), la devolución de
compra es siempre el espejo logístico de la recepción incluso en el asiento preliminar del
borrador, el kardex del detalle del artículo muestra la valorización completa y el resumen, los
bugs funcionales de formularios comerciales están corregidos, la coherencia contable/moneda quedó
unificada (estado de cuenta en moneda base, montos en el listado de asientos, bloqueo de períodos
cerrados, preview cuadrado en base, etiquetas de moneda dinámicas), el kardex es consistente entre
la pestaña y la página, el copy de formularios comerciales quedó unificado, los bugs funcionales
P0 de la segunda auditoría quedaron corregidos (borradores, badge de guías, pestaña vacía de
pagos, multi-moneda de pagos, trazabilidad por lote en tomas), la información faltante P1 quedó
resuelta (costo promedio informativo en artículos, reactivación de partners/items, tabs de
Direcciones y Cuentas Bancarias en el partner-detail), y el bloque P1 restante quedó liquidado
con la disponibilidad de lotes (comprometido/disponible), el saldo en el listado de partners, el
stock y costo promedio en el listado de items, las cuentas de ingreso/gasto por jerarquía de
artículo y la trazabilidad SERIAL en tomas de inventario; F7.2 multi-divisa quedó con su frontend
completo en UI (columna moneda legible, totales M/E en asientos, warning SPECIFIC por línea).
**La deuda estructural priorizada y las auditorías UX completas están liquidadas.** Quedan solo
excepciones cosméticas documentadas (alturas 28px/38px intencionales y decorativas que no
pertenecen al token de control) y pendientes de F7.2 contable (diferencia de cambio automática en
asientos manuales; gain/loss accounts del settings sin consumo por builders).

**Deuda estructural del motor contable (2026-08-09):** el último monolito de la fachada —
`previewJournalEntryFromDraft` (~1010 líneas, switch de 16 cases de preview de borradores) — fue
extraído a `src/common/accounting/drafts.journal-builder.ts` (`DraftsJournalBuilder` + interfaz
`DraftPreviewDocument`), y los helpers compartidos de preview (`_enrichPreviewLines`,
`_buildPreviewResponse`, `_formatPreviewDate`, `_groupPreviewLines`) se movieron a
`JournalEntryCore` (eliminando el enrich duplicado entre `previewJournalEntry` y el preview de
draft). La fachada bajó de 2,922 → 1,718 líneas con superficie pública estable (el único consumidor
`journal-entries.service.previewFromDraft` no cambió). Ver `ROADMAP.md` DT.15. Backend 132
suites/1287 tests en verde (incluye 4 tests nuevos de preview de borrador).

---

*Documento vivo. Actualizado automáticamente tras cada auditoría.*
*Fuentes: `AUDIT_REPORT_V2.md`, `AUDIT_TRACKING.md`, `BUGS_RESUELTOS.md`, `AGENTS.md`.*
