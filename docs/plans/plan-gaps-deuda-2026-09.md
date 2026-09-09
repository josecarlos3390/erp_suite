# Plan de Gaps y Deuda — ERP Suite (2026-09-08)

> Documento formal de brechas de producto y deuda técnica detectadas durante la
> sesión de trabajo T26–T32h (2026-09-08) más la revisión de código asociada.
> Objetivo: que ningún hallazgo se pierda con el cierre de la sesión; cada ítem
> tiene prioridad, descripción técnica y criterio de aceptación.
>
> **Cómo usar este documento:** cada ítem marcado `☐` es candidato a plan propio
> (como los existentes en `docs/plans/`). Al implementarse, moverse a
> `AUDIT.md` con su fila (T33+) y marcarse `✅` aquí.

---

## 1. Gaps de negocio (módulos ausentes o por potenciar)

### G1 — Costeo de importación: "Precios de Entrega" / Landing Cost ☐ · Prioridad ALTA

- **Qué falta:** no existe ningún documento de *landed cost* / "Precio de
  Entrega". El usuario lo necesita para costear una importación sumando todos
  los gastos adicionales (flete, seguro, nacionalización, despacho, etc.) al
  costo de los artículos.
- **Uso previsto (definido por el usuario):** agrupar todos los gastos de la
  importación en un **Proyecto** y luego aplicarlos en el documento de
  "Precio de Entrega", que reparte esos gastos sobre las líneas de la compra
  y actualiza el costo unitario/valorizado del inventario.
- **Aceptación sugerida:**
  - Documento cabecera + líneas donde el origen es una Factura de Compra
    (o Recepción) y los gastos extra se referencian por Proyecto.
  - Reparto de gastos prorrateado (por cantidad, valor o % configurable por
    línea) y persistencia del costo final en las líneas del artículo.
  - Actualización del costo promedio / valorización de inventario y su
    impacto contable (cuentas configurables por tipo de gasto).
  - Afectación de kardex y reportes de costo sin romper el flujo de
    importación manual actual.
- **Nota:** verificar sinergia con `ItemWarehouseAccounts` (cuentas por
  almacén) y con el módulo de revalorización G2 (comparten el motor de
  actualización de costos).

### G2 — Revalorización de artículos (por cantidad y por valor) ☐ · Prioridad ALTA

- **Qué falta:** el dato maestro deja claro que el costo NO se edita a mano
  ("se calcula por operaciones o revalorización futura" — ver ROADMAP DT.28);
  esa "revalorización futura" no existe aún.
- **Alcance esperado:**
  - **Por cantidad:** ajuste del costo unitario/cantidad valorizada de un
    artículo (o artículo+almacén+lote) cuando se detecta diferencia física o
    de registro.
  - **Por valor:** actualización del costo promedio / valor de inventario
    (p. ej. diferencia de cambio en mercadería importada, correcciones,
    gastos capitalizados).
- **Aceptación sugerida:**
  - Documento de revalorización con motivo, artículo(+almacén/lote), cantidad
    y costo nuevo; cálculo del delta valorizado.
  - Actualización de `avgCost`/stock valorizado + kardex con tipo de
    movimiento propio.
  - Asiento contable automático con cuentas configurables (y respetando el
    motor de determinación de cuentas por jerarquía).
  - Reversa/cancelación del documento sin romper promedios posteriores.
- **Relación:** comparte motor con G1; coordinar para no duplicar la
  actualización de costos.

### G3 — Módulo de Producción (potenciar) ☐ · Prioridad MEDIA

- **Estado actual:** existe el circuito de **ensamblaje** (Kits + BOMs +
  `AssemblyOrder` → asiento propio vía `AccountingEngine`), útil para
  producto terminado simple.
- **Qué falta (potenciar):**
  - Órdenes de fabricación con **múltiples componentes** y producto final
    (hoy el ensamblaje es 1 kit → 1 final).
  - **Costeo multi-nivel** (subensambles), mermas/desperdicio y subproductos.
  - Planificación simple (explosión de BOM, necesidades contra stock).
- **Aceptación sugerida:** ampliar `AssemblyOrder` o modelo nuevo
  `ProductionOrder` con líneas de componentes (cantidad, costo) y salida de
  producto(s); costeo por nivel y asientos de producción consistentes con el
  plan contable BO; UI acorde a los patrones LUNA de documentos con líneas.

### G4 — Módulo de Servicios (potenciar) ☐ · Prioridad MEDIA

- **Estado actual:** hay **líneas de servicio** (artículos de servicio,
  líneas de cuenta `isAccountLine`) dentro de facturas/pedidos.
- **Qué falta:**
  - Órdenes de servicio / OT (apertura, asignación, avance, cierre).
  - Contratos de servicio / suscripciones con facturación recurrente.
- **Aceptación sugerida:** decidir con el usuario si el servicio es
  "producto sin stock" (ya soportado) o requiere ciclo de vida OT/contrato.
  En el segundo caso, plan propio con estado y facturación.

### G5 — Documentación canónica desactualizada ☐ · Prioridad MEDIA (mantenimiento)

- **Hallazgo:** `AGENTS.md` y `ROADMAP.md` listan como **pendientes** módulos
  que **ya existen**: Activos Fijos (`fixed-assets`, con depreciación),
  Conciliación Bancaria (`bank-reconciliation`) y Revaluación por diferencia
  de cambio (`exchange-rate-adjustments`). La fecha de cabecera del ROADMAP
  (2026-09-05) y de AGENTS (2026-08-08) no reflejan el estado real.
- **Aceptación:** revisar y marcar como ✅ los módulos existentes, actualizar
  las fechas y el bloque "Próximos pasos" de AGENTS.md.

---

## 2. Deuda técnica / hallazgos de la sesión

### D1 — Borradores: migrar a "foto completa" (snapshot) en vez de hidratación manual ☐ · Prioridad ALTA

- **Evidencia (T32, T32b, T32c):** cuatro bugs encadenados del ciclo
  guardar → listar → recuperar (cliente no restaurado, total con IVA
  duplicado, código de artículo perdido, price-check con falso positivo +
  doble descuento en "Actualizar precios"). Causa de fondo: cada form
  re-hidrata el borrador a mano (`hydrateFromDraft`, builders por form,
  resoluciones contra catálogos paginados), en vez de guardar y restaurar la
  misma estructura que produce el formulario.
- **Propuesta:** el borrador persiste el **payload serializado del documento**
  (lo que el form enviaría al crear) y al recuperar se construye con el MISMO
  camino que crea el documento nuevo (un solo `buildLineGroup`/builder por
  docType, sin parches por form). Esto elimina la clase entera de bugs y
  simplifica `saveAsDraft`/`hydrateFromDraft`.
- **Aceptación:** T32/T32b/T32c cubiertos por E2E (ya existen
  `qa-document-drafts.spec.ts`) + prueba manual de borrador viejo (pre-fix)
  recuperado correctamente; ningún form con lógica de hidratación propia.

### D2 — Costeo/validación de líneas duplicado entre servicios ☐ · Prioridad MEDIA

- **Evidencia:** el patrón "recálculo de costo promedio por línea + validación
  de almacén de línea + propagación" se repite en delivery-orders,
  sale-invoices, sale-reserve-invoices, returns, credit-notes y el lado de
  compras, con variaciones sutiles (origen de estos bugs en DT.37/DT.40).
- **Propuesta:** extraer un helper/`DocumentLineService` compartido
  (actualización de `avgCost`, `validateLineWarehouseAssignment`,
  propagación) usado por todos los servicios, como ya se hizo con
  `assertWarehousesInBranch` y `discount-propagation.util.ts`.
- **Aceptación:** mismo comportamiento observado (sin cambios de API) con
  tests de regresión de las suites de ventas/compras; sin `as any`.

### D3 — Auditoría de settings "huérfanos" ☐ · Prioridad MEDIA

- **Evidencia:** `enableBranches` existía en Ajustes y en `AppSettings` sin
  gobernar ninguna UI hasta T32h (se conectó hoy). Sospecha fundada de más
  flags con efecto parcial o nulo (p. ej. `enableWarehouseRestriction`,
  `enableSapIntegration` y otros).
- **Propuesta:** tabla de trazabilidad settings → dónde se lee en frontend y
  backend; marcar huérfanos y decidir: implementar el efecto, ocultar el
  switch o eliminarlo.
- **Aceptación:** documento/matriz con cada flag y su consumo real; cero
  switches en Ajustes sin efecto documentado.

### D4 — Copy y textos sin normalizar ☐ · Prioridad BAJA

- **Evidencia:** "Almacen" vs "Almacén", "Seleccionar almacen..." (sales-
  returns), encabezados con espacios que obligan a aserciones parciales en
  E2E.
- **Propuesta:** pasada de copy/accentos en labels y placeholders; revisar
  los E2E que dependen de texto exacto.
- **Aceptación:** grep de acentos/typos conocidos en `pages/` y `shared/`;
  E2E con `toHaveText` donde hoy se usa `toContainText` por espacios.

### D5 — Estado de la deuda de UX/cosmética ya conocida (referencia) ✅/🔄

- Residual ya documentado en ROADMAP (tokens de altura, `::ng-deep`,
  budget del POS 35.35 kB sobre 35.00 kB) — se deja constancia aquí para no
  perderlo; no requiere acción nueva.

---

## 3. Priorización sugerida (orden de trabajo)

| Orden | Ítem | Tipo | Justificación |
|---|---|---|---|
| 1 | **D1 borradores snapshot** | Deuda técnica | Es donde aparecen los bugs del día a día del usuario; desbloquea confianza en borradores |
| 2 | **G1 Precios de Entrega / Landing Cost** | Negocio | El usuario lo pidió explícitamente (importaciones) |
| 3 | **G2 Revalorización de artículos** | Negocio | El usuario lo pidió explícitamente; comparte motor con G1 |
| 4 | **G5 Doc canónica desactualizada** | Mantenimiento | Bajo esfuerzo, evita decisiones sobre datos falsos |
| 5 | **D2 costeo duplicado backend** | Deuda técnica | Reduce la clase de bugs de costos antes de tocar G1/G2 |
| 6 | **D3 settings huérfanos** | Deuda técnica | Preventivo, bajo riesgo |
| 7 | **G3 Producción / G4 Servicios** | Negocio | Requieren definición de alcance con el usuario |
| 8 | **D4 copy normalizado** | Cosmético | Puede intercalarse en cualquier tanda |

---

## 4. Criterios de cierre (generales)

- Todo cambio de schema: migración Prisma + SQL manual si hay drift (patrón
  existente `prisma/manual/`) + `npm run generate-types`.
- Tests: unitarios por módulo + E2E autolimpiante cuando aplique; cero
  `as any` en código de producción.
- Multi-tenancy: todo modelo nuevo con `tenantId` + `@@index([tenantId])`.
- Al cerrar cada ítem: fila en `AUDIT.md`, nota en el CHANGELOG de la capa y
  marca `✅` aquí con fecha.

---

*Última actualización: 2026-09-08 (sesión T26–T32h).*
