# Plan de cierre — Backlog grupos 3, 4 y 5 (2026-09-09)

> Objetivo (definido por el usuario): cerrar/terminar todo lo relacionado con
> los grupos **3** (features del backlog de ROADMAP), **4** (deuda) y **5**
> (QA) del listado de pendientes 2026-09-09. Quedan **pendientes solo el
> grupo 1** (gaps G1–G4) **y el grupo 2** (SIN/SAP/CRM/Nómina/localización).
> Cada ítem se cierra con fila en `AUDIT.md` (T43+), nota en el CHANGELOG de
> la capa, marca ✅ en ROADMAP/planes, tests en verde y commits/pushes por
> convención (backend dual-push). Seguimiento de olas: goal f07ad51d.

---

## Ola 1 — Grupo 3: features del backlog de ROADMAP

### T43 — Query Manager: parámetros al ejecutar + consultas compartidas por rol ✅ (2026-09-09, AUDIT T43)

- **Parámetros:** el constructor permite declarar filtros con valor
  parametrizado (`:{nombre}`). Al ejecutar desde el listado/editor se pide el
  valor (o se manda en el payload `run.params`); `runDefinition` sustituye y
  coercea igual que hoy (validación de tipos del catálogo). El SQL directo no
  gana parámetros (guard read-only sin interpolación nueva).
- **Compartir por rol:** `SavedQuery` gana alcance de visibilidad —
  `PRIVATE` (dueño) o `ROLE` (dueño + roles indicados, read-only salvo el
  dueño). Modelo: campo `visibility` + `roleIds` (relación/JSON según diseño
  de migración); `listMine` → lista visible al usuario (propias +
  compartidas a sus roles con marca `shared`); permisos/acciones del backend
  (`getOne` permite ver compartidas; update/delete solo dueño).
- **UI:** en el editor toggle "Compartir con roles" (multi-select de roles,
  solo para el dueño); en listado badge Compartida y bloque de parámetros al
  ejecutar cuando la consulta los declara.
- Aceptación: backend specs (nuevos: sustitución de parámetros con/ sin
  valor, coerciones, guard de dueño, visibilidad por rol) + Karma frontend
  (list/editor) + typecheck; E2E si el entorno lo permite.
- Nota: **no** tocar el compilador SQL/guard (T22) ni el catálogo.

### T44 — Escaneo de barcode en el POS ✅ (2026-09-09, AUDIT T44)

- Input de escaneo en el checkout POS: al detectar un código (Enter o lectura
  rápida) se resuelve el artículo por barcode (`item-barcodes`; el backend ya
  indexa barcode en items y/o `GET /items?search=`) y se agrega la línea con
  la UoM/cantidad 1, sin perder el foco para lecturas en ráfaga.
- Aceptación: Karma de pos.component (mock de resolución), typecheck y build;
  verificación manual/live opcional.

### T45 — UoMGroup (grupos de unidades, patrón SAP B1) ✅ (2026-09-09, AUDIT T45)

- Decisión de semántica (implementada 2026-09-09): el grupo es una
  **plantilla reutilizable** — master `UoMGroup` (código/nombre/unidad base +
  conversiones del grupo) que al **aplicarse a un artículo se materializa en
  sus `uomConversions`** (sin indirección en runtime ni cambios en el motor
  transaccional). Implementación: página única `/uom-groups` (listado +
  editor inline + acción **Aplicar** por código de artículo, match exacto) en
  lugar del selector dentro de `item-form` previsto inicialmente — el aplicar
  por código cubre la materialización sin tocar el formulario del artículo
  (anotado como mejora futura: mostrar/asignar el grupo desde `item-form`).
- Aceptación: schema + migración (+SQL manual si drift), specs backend/front
  de CRUD y de materialización, Karma + typecheck.
- ✅ Cerrado (2026-09-09, AUDIT T45): backend `uom-groups` 6/6 + suite
  completa en verde; frontend Karma `uom-groups.service.spec.ts` 11/11 y
  build AOT OK; commits dual-push backend y push frontend/root.

### T46 — Lógica de licencias sobre los roles ✅ (2026-09-09, AUDIT T46)

- Infraestructura mínima y honesta (el modelo comercial se definirá con el
  usuario): `Tenant/Subscription.plan` ya existe (TRIAL/ACTIVE/…); se agrega
  una **matriz plan→capacidades** documentada (default: SHARED/DEDICATED
  habilitan los módulos actuales; las features 2 SIN/SAP/etc. quedan fuera
  del gating por ahora) y un guard/util `planIncludes(plan, module)` +
  endpoint informativo de capacidades del tenant; **sin** bloquear
  funcionalidad existente (no romper operación).
- Aceptación: specs de la matriz/util + endpoint; documentación de la
  decisión pendiente de producto (qué plan incluye qué) en el plan.
- ✅ Cerrado (2026-09-09, AUDIT T46): `plan-capabilities.ts` (matriz
  `2026-09-09.1` + `planIncludes`) + `GET /billing/capabilities`;
  `plan-capabilities.spec.ts` 5/5 y billing service/controller ampliados
  (29/29 en las 4 suites de billing); typecheck y eslint OK. Commit dual-push
  backend. **Decisión de producto PENDIENTE (no bloqueante):** qué plan
  comercial incluye qué feature del grupo 2 (SIN/SAP/CRM/Nómina/
  localización) cuando se implementen — hoy ambas planes (SHARED/DEDICATED)
  habilitan lo mismo y el gating se aplicará sobre esta matriz sin cambiar la
  operación.
- ➕ **Decisiones de producto aplicadas y D3 con enforcement (2026-09-09,
  acordado con el usuario):** D1 (piso común, sin gating de módulos actuales),
  D2 (SIN/CRM/divisa en ambos; SAP/nómina avanzada/localización solo DEDICATED)
  y D3 (volumetría) aprobadas e implementadas en la matriz `2026-09-09.3`.
  Aprobada además la ampliación de D3: **bloquear el alta, nunca la operación** —
  `PlanLimitsService.assertCanAdd` (403 con mensaje accionable) cableado en los
  `create()` de usuarios/almacenes/terminales POS (un alta inactiva no consume
  cupo; `planLimit()` `null`/`undefined` permiten), y `GET /billing/limits`
  (consumo vs cupo) para que la UI avise antes del 403. Backend 162 suites /
  1747 tests; ver AUDIT T46 (ampliación 2) y `docs/plans/propuesta-matriz-licencias-2026-09.md` §2.3/§5.
  Queda **pendiente de producto** (no bloqueante): gating real de las capacidades
  nuevas del grupo 2 y su superficie en la UI cuando se implementen.

---

## Ola 2 — Grupo 4: deuda

### T47 — Mocks `any` en specs backend → 0 `any` en `.spec.ts` ✅ (2026-09-09, AUDIT T47)

- Barrido por módulo (workflow con subagentes por dominio): reemplazar
  `let mockPrisma: any`/`as any`/`(args: any)` por mocks tipados
  (`as unknown as PrismaService`, `satisfies Partial<…>`, tipos locales).
  Criterio del BACKEND_GUIDE §2 (Fase 7) aplicado al estado real.
- Aceptación: eslint `@typescript-eslint/no-explicit-any` en 0 en specs;
  `npm test` completo en verde (158 suites/1695).
- ✅ Cerrado (2026-09-09, AUDIT T47): gate activado (`no-explicit-any:
  'error'` para `src/**/*.spec.ts`) y barrido de los 50 specs con `any`
  (234 tokens) → 0, con mocks tipados estructurales de solo `jest.Mock`,
  casts `as unknown as T` y eliminación de `as any` donde el literal ya
  satisfacía el DTO; `expect.any(...)` intacto. eslint `src/**/*.ts` 0
  errores (1 warning informativo preexistente); `tsc` proyecto y specs en 0;
  `npm test` 161 suites / 1719 tests. Además se autofijó con `--fix` deuda
  prettier preexistente de commits con hooks desactivados (T43/T45). Commit
  dual-push backend.

### T48 — Barrido de densidad visual (px crudos + tablas) — plan visual v2 F2 ✅ (2026-09-09, AUDIT T48)

- Correr `npm run audit:density`; corregir los hallazgos **sin riesgo visual**
  (px → tokens/`--size-*`/spacing donde aplique; tablas crudas → variables de
  densidad con overrides Compacta/Espaciosa o `density-ok` justificado);
  regenerar baselines.
- Aceptación: `audit:density` sin hallazgos nuevos; Karma + build; QA visual
  puntual de pantallas tocadas.
- ✅ Cerrado (2026-09-09, AUDIT T48): el gate CI (`--baseline`) fallaba con
  76 hallazgos nuevos post-baseline (09-06). Acciones: (A) bug real de T45 —
  4 alias `--fs-md/sm/xs` inexistentes en `uom-groups.component.scss` →
  tokens canónicos; (B) migración sin riesgo visual del editor de uom-groups
  a `--space-*` (+ constante local `--ug-gap-10`); (C) baseline regenerado
  (307 conocidos + 28 tablas) y script `npm run audit:density:ci` → exit 0.
  **Residual honesto (backlog del plan visual v2 Fase 2):** migración de
  densidad completa de controles bespoke (POS/QM/reportes/shared) y de las
  28 tablas HTML crudas requiere QA visual por pantalla — ahora gobernado por
  el gate CI (solo hallazgos NUEVOS fallan). Build AOT OK; sin cambios de
  runtime.
- ➕ **Fase 2 — incremento 1 (2026-09-09, acordado con el usuario):** convención
  "Comfortable/Compacta = look actual; solo Espaciosa relaja" (documentada en
  FRONTEND_GUIDE §12). Convertidas a variables de densidad: **8 archivos de
  tablas crudas** (bank-reconciliation ×3 tablas, bank-statement ×2,
  price-list con guard mobile, anticipos en purchase/sale-invoices,
  quotation-items-picker, transport-guides, parcial `report-tables.scss`) +
  `shared/payment-term-installments-preview` (14 formularios) + global
  `.modal-table` (8 formularios) + **Query Manager** (editor/list/result).
  Hallazgos **276 → 252**; baseline regenerado y `audit:density:ci` ✓;
  `ng build` OK; Karma QM 8/8 + 8/8; `e2e:visual` 52/52 (sin regresión).
  Residual: POS (27), selectores `shared/` y tablas `fiscal-years`/
  `permissions`/`item-detail`; la verificación dinámica de tablas crudas
  requiere datos (la BD dev recién seedeada no renderiza filas).
- ➕ **Fase 2 — incremento 2 (2026-09-09):** POS (31 valores px →
  `--pos-padding-*`, nueva `--pos-padding-3`; `pos-density.spec` 2/2) y los
  **13 selectores de `shared/`** (47 reglas; `combobox-base` es mixin y arrastra
  a item/batch/serial-combobox). Hallazgos **252 → 186**; baseline regenerado y
  `audit:density:ci` ✓; `ng build` OK; `e2e:visual` 52/52. Residual: páginas de
  reportes y otras páginas (186), tablas `fiscal-years`/`permissions`/
  `item-detail`, y verificación dinámica con datos.
- ➕ **Fase 2 — incremento 3 y cierre (2026-09-09):** codemod determinista sobre
  el JSON del audit → **230 conversiones en 51 archivos** + **7 `density-ok`
  justificados**; **audit estático 307 → 0**; baseline regenerado (0 + 28
  tablas) y `audit:density:ci` ✓; `maximumWarning` de estilos 36→37 kB (los
  `var()` pesan más). Verificación: build AOT sin warnings, `e2e:visual` 52/52,
  Karma en el push; **dinámica con datos**: 0 offenders en las tablas crudas
  medidas (`/fiscal-years/1`, `/permissions`) y `audit:density:e2e` oficial con
  **0 problemas nuevos** en esas rutas. **Fase 2 cerrada** (28 tablas crudas
  quedan en seguimiento del gate CI).
- ➕ **Cierre de los 3 pendientes del frente (2026-09-09, acordado con el usuario):**
  (1) **Calidad de bloques**: nuevas herramientas `npm run audit:density:vars`
  (audita construcción: huérfanas, sin base, Δ<2px en espaciado, `--x: var(--x)`,
  bloques duplicados, nombre-vs-valor, llaves) y `npm run audit:density:fix`
  (corrección mecánica) integradas en `audit:density:ci` → **0 hallazgos** tras
  eliminar 66 vars huérfanas y fusionar 17 bloques duplicados en 19 archivos;
  además se corrigieron **3 referencias cíclicas** (`--det-gap` en
  item/partner-detail, `--rep-opt-gap` en revaluación) que dejaban el espaciado
  en 0 en densidad Normal y 4 deltas POS <2px. Método documentado en
  `FRONTEND_GUIDE` §12 y `docs/reference/densidad-interfaz-auditoria.md`.
  (2) **28 tablas crudas**: clasificadas por familia (15 `.modal-table` global,
  13 `.group-table` compartido, 11 con vars locales, 2 de `item-detail` con
  **regla nueva 1px→4px** = cero cambio visual en Compacta/Comfortable, 3
  tablas-pie dentro de `luna-data-table` excluidas por diseño).
  (3) **Cobertura dinámica**: manifiesto 152 → **163 URLs** (11 rutas
  `/reports/*` que antes quedaban fuera del barrido) y nueva spec
  `e2e/density-raw-tables.spec.ts` con datos reales (kit `KIT-PC01` del seed):
  BOM 1px/1px en Compacta → 4px/4px en Espaciosa; corrida conjunta QA
  (ventas/compras/stock) + audit `/reports` → **19/19 passed**, 7 reportes con
  `.group-table` medidos con datos y **0 offenders**. Estado: estático 0, calidad
  0, `ng build` 0 errores, `e2e:visual` 52/52.

### T49 — `::ng-deep` (Fase 7 visual) ✅ (2026-09-09, AUDIT T49)

- Auditoría de usos: mantener solo los **justificados** (contenido proyectado
  en tablas LUNA/overlays donde no hay otra vía) documentándolos con marcador;
  migrar los evitables a selectores de componente o CSS global explícito.
- Aceptación: informe de N→M usos con justificación; sin regresiones visuales
  (screenshots de referencia).
- ✅ Cerrado (2026-09-09, AUDIT T49): auditoría N=60 líneas (31 archivos) →
  M=9 reglas activas (9 archivos); las 51 restantes son comentarios del
  refactor T10 que ya migró los evitables. Las 9 activas son contenido
  proyectado/encapsulado sin vía alternativa y quedan **marcadas como
  justificadas** (se añadió el marcador faltante en
  `styles/_inventory-form-lines.scss`). Informe completo en
  `docs/reference/ng-deep-audit-2026-09.md`. Cero cambios de reglas CSS →
  sin regresiones visuales. Política: `::ng-deep` nuevo requiere marcador
  justificado. Commit frontend + docs root.

---

## Ola 3 — Grupo 5: QA / serie por sucursal

### T50 — Serie de numeración por sucursal ✅ (2026-09-09, AUDIT T50)

- Correlativos independientes por tienda: `DocumentSeries`/asignación por
  sucursal (diseño acotado: serie opcionalmente ligada a `branchId`; al crear
  documento se elige la serie de la sucursal). Requiere decisión de producto
  mínima (¿serie por sucursal o permitir varias series por sucursal?) —
  propuesta default: serie puede marcarse "solo sucursal X"; si la sucursal
  del doc tiene serie propia se prioriza.
- Aceptación: migración + backend (resolución de serie por sucursal) +
  frontend (selector/auto) + specs/E2E.
- ✅ Cerrado (2026-09-09, AUDIT T50) con la decisión default aplicada: serie
  con `branchId` opcional (varias series por docType permitidas, códigos
  distintos), resolución con prioridad sucursal→global y exclusión de series
  de otras sucursales; threading en los 28 servicios de documentos; UI
  (columna + campo Sucursal). Migración aplicada por SQL manual (drift).
  Evidencia: document-series 49/49, suite 161/1726, eslint 0, tsc 0, karma
  form 9/9 + list 8/8, builds AOT. **Nota E2E:** el escenario crear-serie-de-
  sucursal → documento-usa-su-serie requiere entorno dev (backend+frontend) y
  FY abiertos; se ejecuta en la ola **T52**.

### T51 — Baseline visual consolidado ✅ (2026-09-09, AUDIT T51)

- Ejecutar/ajustar `e2e/forms-reference-screenshots.spec.ts` + `forms-visual-
  regression.spec.ts`: generar baselines y dejar la suite con verificación.
- Nota entorno: algunas rutas de formularios necesitan FY abierto/serie
  (documentado; elegir fechas fijas 2031 donde aplique).
- ✅ Cerrado (2026-09-09, AUDIT T51): (A) fix de infra E2E en el seed del
  backend (orden de borrado de cabeceras de anulación → P2003 que rompía el
  `webServer` de Playwright); (B) `npm run e2e:baseline` → **52/52** y
  baselines de `e2e/screenshots/` regenerados (51 PNG actualizados);
  (C) `npm run e2e:visual` → **52/52 passed** contra los baselines nuevos
  (chromium, backend+frontend levantados por Playwright). Pendiente de la ola
  E2E (T52): el caso de serie por sucursal y los flujos críticos restantes.

### T52 — Completar flujos críticos E2E ✅ (2026-09-09, AUDIT T52)

- Cobertura faltante según AGENTS §8: pagos parciales, devoluciones,
  conciliación y (si el entorno lo permite) ventas/compras/stock end-to-end
  con fecha fija en FY abierto; documentar bloqueos de entorno si persisten.
- ✅ Cerrado (2026-09-09, AUDIT T52): (A) flujos críticos **31/31** en verde
  (pagos parciales + devoluciones, conciliación/anticipos, ventas end-to-end
  API+UI, compras, stock, recepción→factura→pago); (B) resto de la ola QA
  verde y **`banking-reconciliation-flow` corregido** (fechas en la gestión
  abierta 2027 + selección de gestión abierta; antes 409 por GEST-2026
  cerrada) → 2 passed / 1 skipped condicional documentado; (C) **caso E2E de
  serie por sucursal (T50)** agregado a `qa-document-series.spec.ts` → 3/3.
  Cierre transversal en el plan: marcas ✅ en ROADMAP (tabla de backlog) y
  AGENTS §8 QA; quedan abiertos SOLO los grupos 1 y 2.

---

## Cierre transversal ✅ (2026-09-09)

- [x] AUDIT.md T43–T52 con evidencia (10 filas); CHANGELOGs backend/frontend
      por ola (T43–T52).
- [x] ROADMAP: sección backlog → filas ✅ por ítem (UoMGroup, barcode POS,
      licencias, QM, densidad, `::ng-deep`, mocks `any`, budget POS,
      devoluciones + serie por sucursal, baseline visual, flujos E2E) y
      puntero a este plan; **AGENTS §8 QA** actualizado (ítems 6 y 7 ✅).
- [x] Verificación final: backend `npm test` **161 suites / 1726 tests**;
      frontend Karma **1525/1525**; builds AOT backend y frontend OK;
      `npm run audit:density:ci` ✓; eslint backend 0 errores.
- [x] Estado: quedan abiertos SOLO el grupo 1 (gaps G1–G4) y el grupo 2
      (features SIN/SAP/CRM/Nómina/localización).

*Última actualización: 2026-09-09.*
