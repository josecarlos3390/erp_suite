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

### T52 — Completar flujos críticos E2E

- Cobertura faltante según AGENTS §8: pagos parciales, devoluciones,
  conciliación y (si el entorno lo permite) ventas/compras/stock end-to-end
  con fecha fija en FY abierto; documentar bloqueos de entorno si persisten.

---

## Cierre transversal

- [ ] AUDIT.md T43–T52 con evidencia; CHANGELOGs backend/frontend por ola.
- [ ] ROADMAP: sección backlog → marcas ✅ por ítem (T43–T52) y puntero a
      este plan; AGENTS §8 QA actualizado.
- [ ] Verificación final: builds AOT (backend+frontend), Karma total,
      `npm test` backend, lint.
- [ ] Estado: quedan abiertos SOLO grupo 1 (G1–G4) y grupo 2 (features 2).

*Última actualización: 2026-09-09.*
