# Query Manager — consultas personalizadas (constructor seguro, estilo SAP B1)

> Plan (2026-09-06). Estado: MVP en curso — ver `ROADMAP.md` 5.7 y `AUDIT.md` T21.

## Objetivo

Permitir que un usuario del ERP cree, guarde, ejecute y exporte **consultas
personalizadas en formato tabla** sobre los datos del negocio, sin escribir SQL:
el usuario arma la consulta desde un **catálogo curado** (entidad → campos →
filtros → orden → límite), el backend la compila a una consulta **Prisma
tipada** y el resultado se muestra en una grilla dinámica (exportable a
CSV/Excel).

## Decisiones tomadas (con el usuario)

1. **Motor:** constructor visual por catálogo (NO SQL crudo). Seguro por
   diseño: sin inyección y aislado por tenant (la extensión de aislamiento de
   Prisma inyecta `tenantId` automáticamente en `findMany`; el SQL crudo no lo
   hace → descartado para multi-tenant).
2. **Alcance MVP:** consultas **personales** (por usuario) + tabla de
   resultados + exportación CSV/Excel.
3. **Catálogo inicial:** conjunto **curado** de entidades/campos con etiquetas
   y tipos (no todas las tablas).

## Modo SQL directo (implementado, T22)

El Query Manager incluye una pestana **SQL directo** (solo lectura) para consultas que el constructor no cubre (LEFT/RIGHT/INNER JOIN, UNION, subconsultas, CTE): textarea + ejecutar + guardar {mode:sql} + toggle del flag. Seguridad: el flag query_manager_sql_enabled solo se puede activar con 1 tenant (instancia dedicada; con mas de uno se fuerza deshabilitado con mensaje); sql-guard.util permite una sola sentencia SELECT/WITH sin DML/DDL ni acceso a tablas sensibles (User/Tenant/SystemSettings/roles/…); ejecucion con statement_timeout 30 s y tope de 5000 filas.

## Fases futuras (fuera del MVP)

- Fase 2: parámetros al ejecutar (fechas, textos) y consultas **compartidas
  por rol** dentro del tenant (SAP: user vs global queries).
- Fase 3 (opcional): modo SQL directo, habilitable solo en instancias
  dedicadas y con guardarraíles (rol Postgres de solo lectura, una sola
  sentencia SELECT, `statement_timeout`, límite de filas/columnas, lista
  blanca de tablas, bloqueo DML/DDL, auditoría de ejecución).

## Modelo de datos

`SavedQuery` (nuevo):

| Campo | Tipo | Notas |
|---|---|---|
| id | Int PK | |
| tenantId | Int | índice `(tenantId, userId)` |
| userId | Int | dueño (MVP personal) |
| name | VarChar(120) | obligatorio |
| description | String? | |
| definition | Json | `{ entity, fields[], filters[], orderBy[], limit }` |
| isFavorite | Bool | default false |
| createdAt / updatedAt | | |

## Definición de consulta (JSON guardado)

```jsonc
{
  "entity": "saleInvoice",           // clave del catálogo curado
  "fields": ["code", "date", "partner.name", "total"],
  "filters": [
    { "field": "date", "op": "gte", "value": "2026-01-01" },
    { "field": "status", "op": "in", "value": ["OPEN", "CLOSED"] }
  ],
  "orderBy": [{ "field": "date", "direction": "desc" }],
  "limit": 500
}
```

Operadores por tipo: `eq / notEq / contains (texto) / in / gt / gte / lt /
lte / isNull / notNull`. Límite máximo impuesto por el backend (500 por
defecto, tope 5 000).

## Catálogo curado v1 (entidades + campos etiquetados)

Constante `backend-erp/src/query-manager/query-catalog.constants.ts` con, por
entidad: `entity` (clave), `model` (modelo Prisma), `label`, `fields`
(relaciones de 1 nivel permitidas con `relation` + `fields`), `defaultOrder`.

V1 (cabeceras, con `partner`/`item`/`branch`/`warehouse`/`serie` embebidos):

- `saleInvoice` (Facturas de venta), `purchaseInvoice` (Facturas de compra)
- `salesOrder`, `deliveryOrder`, `salesQuotation`
- `purchaseOrder`, `purchaseReceipt`, `purchaseQuotation`
- `incomingPayment`, `outgoingPayment`
- `salesCreditNote`, `purchaseCreditNote`
- `partner` (clientes/proveedores), `item` (artículos)
- `stockEntry`, `stockExit`, `stockTransfer`

Cada campo declara: `key`, `label`, `type` (`string|number|date|boolean|enum|
decimal`), `filterable`, `sortable`. El backend mapea `key` → columna real o
relación (`partner.name` → include `partner.select.name`) y **nunca** acepta
claves fuera del catálogo (denegación por allowlist → imposible inyección).

## API

Prefijo `query-manager` (permiso `query-manager: view/create/edit/delete/run`):

- `GET /query-manager/catalog` → catálogo curado (entidades + campos) y
  operadores por tipo.
- `GET /query-manager` → consultas del usuario (listado).
- `GET /query-manager/:id` → una consulta (solo del usuario o compartida).
- `POST /query-manager` → crear (name, description, definition).
- `PATCH /query-manager/:id` → editar (dueño).
- `DELETE /query-manager/:id` → eliminar (dueño).
- `POST /query-manager/run` → ejecuta una definición (guardada o ad-hoc):
  valida contra el catálogo, compila `findMany` (select/include/where/
  orderBy/take), devuelve `{ columns: [{key,label,type}], rows: [...] }`.

## Seguridad

- Sin SQL crudo; compilación a Prisma tipado (0 `as any`).
- Allowlist estricta de entidades/campos/relaciones del catálogo.
- Aislamiento por tenant automático (extensión `tenantIsolationExtension`).
- Consultas solo lectura; `take` con tope; validación de tipos de operadores.
- DTOs formales (whitelist + forbidNonWhitelisted) y `@RequirePermission`.

## UI (frontend)

### Dos vistas con submenú superior (T23, 2026-09-06)

El módulo **Consultas personalizadas** se divide en dos vistas con URL
propia (patrón SAP B1: Query Manager vs Query Generator), unidas por una
subnavegación superior compartida (`app-query-manager-subnav` con
`routerLinkActive`), visible en ambas páginas:

| Vista | Ruta | Componente | Qué contiene |
|---|---|---|---|
| **Consultas guardadas** | `/reports/query-manager` | `QueryManagerListComponent` | `luna-data-table` de consultas personales (nombre, descripción, badge SQL/Constructor, actualizado) con filtro local, fila clic = ejecutar (resultado en la misma página), acciones: abrir en el editor, favorita, eliminar (ConfirmDialog); botón **Nueva consulta**. |
| **Editor de Consultas** | `/reports/query-manager/editor` (+ `/editor/:id` para editar una guardada) | `QueryManagerEditorComponent` | Constructor (entidad → campos → filtros → orden → límite) o **SQL directo** (flag, textarea con hint); carga de existente por `:id`; **Ejecutar** y **Guardar** (create/update; tras crear se sigue editando el mismo id). |

El panel de resultado (grilla dinámica con columnas formateadas por tipo +
exportación CSV) vive en el componente compartido
`app-query-manager-result`, usado por ambas vistas (sin duplicación).

## Validación

- Backend: tests unitarios (catálogo, compilación de filtros/select,
  CRUD + aislamiento por tenant) y suite completa.
- Frontend: build AOT + Karma (spec de la página) + verificación UI
  (crear consulta, ejecutar, exportar).
