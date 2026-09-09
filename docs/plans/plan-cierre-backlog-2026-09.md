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

### T43 — Query Manager: parámetros al ejecutar + consultas compartidas por rol

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

### T44 — Escaneo de barcode en el POS

- Input de escaneo en el checkout POS: al detectar un código (Enter o lectura
  rápida) se resuelve el artículo por barcode (`item-barcodes`; el backend ya
  indexa barcode en items y/o `GET /items?search=`) y se agrega la línea con
  la UoM/cantidad 1, sin perder el foco para lecturas en ráfaga.
- Aceptación: Karma de pos.component (mock de resolución), typecheck y build;
  verificación manual/live opcional.

### T45 — UoMGroup (grupos de unidades, patrón SAP B1)

- Decisión de semántica (a validar en implementación): el grupo es una
  **plantilla reutilizable** — master `UoMGroup` (código/nombre/unidad base +
  conversiones del grupo) que al **asignarse a un artículo se materializa en
  sus `uomConversions`** (sin indirección en runtime ni cambios en el motor
  transaccional). CRUD de grupos + selector en `item-form` (+ botón aplicar)
  + lista en el catálogo de unidades.
- Aceptación: schema + migración (+SQL manual si drift), specs backend/front
  de CRUD y de materialización, Karma + typecheck.

### T46 — Lógica de licencias sobre los roles

- Infraestructura mínima y honesta (el modelo comercial se definirá con el
  usuario): `Tenant/Subscription.plan` ya existe (TRIAL/ACTIVE/…); se agrega
  una **matriz plan→capacidades** documentada (default: SHARED/DEDICATED
  habilitan los módulos actuales; las features 2 SIN/SAP/etc. quedan fuera
  del gating por ahora) y un guard/util `planIncludes(plan, module)` +
  endpoint informativo de capacidades del tenant; **sin** bloquear
  funcionalidad existente (no romper operación).
- Aceptación: specs de la matriz/util + endpoint; documentación de la
  decisión pendiente de producto (qué plan incluye qué) en el plan.

---

## Ola 2 — Grupo 4: deuda

### T47 — Mocks `any` en specs backend → 0 `any` en `.spec.ts`

- Barrido por módulo (workflow con subagentes por dominio): reemplazar
  `let mockPrisma: any`/`as any`/`(args: any)` por mocks tipados
  (`as unknown as PrismaService`, `satisfies Partial<…>`, tipos locales).
  Criterio del BACKEND_GUIDE §2 (Fase 7) aplicado al estado real.
- Aceptación: eslint `@typescript-eslint/no-explicit-any` en 0 en specs;
  `npm test` completo en verde (158 suites/1695).

### T48 — Barrido de densidad visual (px crudos + tablas) — plan visual v2 F2

- Correr `npm run audit:density`; corregir los hallazgos **sin riesgo visual**
  (px → tokens/`--size-*`/spacing donde aplique; tablas crudas → variables de
  densidad con overrides Compacta/Espaciosa o `density-ok` justificado);
  regenerar baselines.
- Aceptación: `audit:density` sin hallazgos nuevos; Karma + build; QA visual
  puntual de pantallas tocadas.

### T49 — `::ng-deep` (Fase 7 visual)

- Auditoría de usos: mantener solo los **justificados** (contenido proyectado
  en tablas LUNA/overlays donde no hay otra vía) documentándolos con marcador;
  migrar los evitables a selectores de componente o CSS global explícito.
- Aceptación: informe de N→M usos con justificación; sin regresiones visuales
  (screenshots de referencia).

---

## Ola 3 — Grupo 5: QA / serie por sucursal

### T50 — Serie de numeración por sucursal

- Correlativos independientes por tienda: `DocumentSeries`/asignación por
  sucursal (diseño acotado: serie opcionalmente ligada a `branchId`; al crear
  documento se elige la serie de la sucursal). Requiere decisión de producto
  mínima (¿serie por sucursal o permitir varias series por sucursal?) —
  propuesta default: serie puede marcarse "solo sucursal X"; si la sucursal
  del doc tiene serie propia se prioriza.
- Aceptación: migración + backend (resolución de serie por sucursal) +
  frontend (selector/auto) + specs/E2E.

### T51 — Baseline visual consolidado

- Ejecutar/ajustar `e2e/forms-reference-screenshots.spec.ts` + `forms-visual-
  regression.spec.ts`: generar baselines y dejar la suite con verificación.
- Nota entorno: algunas rutas de formularios necesitan FY abierto/serie
  (documentado; elegir fechas fijas 2031 donde aplique).

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
