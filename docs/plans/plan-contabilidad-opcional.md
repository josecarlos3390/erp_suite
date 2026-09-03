# Plan — Contabilidad opcional por tenant: "Habilitar Contabilización" + "Generar Plan de Cuentas"

> Fecha: 2026-09-05 · Backend `src/settings` + `src/common/accounting*` + seed tenants · Frontend `settings` + `admin` + sidebar
> Patrón SAP B1: los módulos existen; la parametrización decide. Un tenant puede operar
> solo como **comercial/inventario** (sin asientos) o con **contabilidad completa**.

---

## 1. Objetivo

Clientes que solo compran/venden y llevan inventario no deben verse obligados a la
infraestructura contable (plan de cuentas, mappings, cuentas de mayor, asientos
automáticos, períodos). Otros clientes sí quieren la opción completa (asientos +
normativa de impuestos).

Dos controles nuevos:

1. **Habilitar contabilización** (`accountingEnabled`, por tenant):
   - `true` (default) → el motor genera asientos automáticos y se muestra la
     parametrización contable (comportamiento actual).
   - `false` → el motor NO genera asientos, no exige cuentas ni períodos; el menú
     oculta los ítems contables (Asientos, Plan de Cuentas, Mapeos); **Años Fiscales
     permanece visible** porque las series de numeración lo requieren.
2. **Generar Plan de Cuentas** (acción idempotente): siembra/completa el plan estándar
   **por país** del tenant (hoy solo Bolivia, BO) + mappings por defecto + cuentas de
   mayor asignadas a los maestros. El mecanismo resuelve `país → plantilla universal
   (fallback) → error claro` para incorporar más países o un plan `UNIVERSAL` en el futuro.

## 2. Decisiones validadas con el usuario (2026-09-05)

| # | Decisión | Elección |
|---|----------|----------|
| 1 | Dónde activar | **Ambos**: checkbox en creación de tenant (panel superadmin, default ON) + toggle editable en Parametrización → Contabilidad (tenant activo) |
| 2 | Alcance del modo deshabilitado | **Motor apagado + menú contable oculto** (Asientos/Plan de Cuentas/Mapeos), manteniendo **Años Fiscales** (series) |
| 3 | Desactivar con datos | **Bloquear si hay asientos**: solo se permite apagar en tenants sin actividad contable (409 backend + toggle inhabilitado en UI) |
| 4 | Flujo al habilitar | **"Generar Plan de Cuentas" explícito**: habilitar solo enciende el flag; si no hay plan, la UI muestra aviso + botón; los asientos automáticos empiezan cuando el plan existe |

Semántica del default: `accountingEnabled` ausente en `SystemSettings` (tenants
pre-feature / mocks) se interpreta como **habilitado** → cero regresión.

## 3. Backend

### 3.1 Flag `accountingEnabled` (Settings)
- `AppSettings.accountingEnabled` en `src/settings/settings.service.ts`; `getAll()`:
  `map['accountingEnabled'] !== 'false'` (default true).
- `saveAll()` persiste la clave; **bloqueo de negocio**: `accountingEnabled=false` con
  `journalEntry.count > 0` → `409 Conflict` (mensaje claro).
- `UpdateSettingsDto` + `@IsBoolean()` en `settings.controller.ts`.

### 3.2 Motor contable (gate central, cero cambios en los ~20 servicios de dominio)
En `JournalEntryCore` (`src/common/accounting/journal-entry-core.ts`):
- `isAccountingEnabled(tenantId)` → `settings.accountingEnabled !== false`.
- `assertAccountingEnabled(tenantId)` → 409 «La contabilización está deshabilitada…».

En `AccountingEngineService` (`src/common/accounting-engine.service.ts`):
- Los **18 métodos de creación automática** arrancan con
  `if (!(await this.isAccountingEnabled(<doc>.tenantId))) return 0/null;` — el documento
  se confirma sin asiento y sin consultar cuentas (la determinación de cuentas fallaría
  sin plan, por eso el gate es ANTES de construir líneas).
- `reverseJournalEntry` no necesita gate: sin asiento previo ya devuelve `null`.
- `previewJournalEntry` / `previewJournalEntryFromDraft` / `persistManualJournalEntry`
  lanzan 409 (operaciones propias del módulo contable).

Otros:
- `JournalEntriesService.create` (asientos manuales): bloqueo si `accountingEnabled === false`.
- `FiscalYearsService.generateOpeningEntry` (asiento de apertura): 400 si la clave vale
  `'false'` (los Años Fiscales en sí siguen operativos para las series).

### 3.3 "Generar Plan de Cuentas" (por país, idempotente)
- Util `resolveChartOfAccountsTemplate(countryCode)` en
  `src/common/chart-of-accounts.util.ts`: plantilla del país → `'UNIVERSAL'` (fallback,
  aún no existe) → `null`.
- `SettingsService.getChartOfAccountsStatus(tenantId)` (GET `settings/chart-of-accounts`):
  estado SIN cache → `{ accountingEnabled, countryCode, templateCountry,
  templateAvailable, chartOfAccountsGenerated, accountCount, mappingsConfigured,
  journalEntryCount, canDisableAccounting }`.
- `SettingsService.generateChartOfAccounts(tenantId)` (POST `settings/chart-of-accounts`,
  permiso `settings:edit`): valida flag habilitado (409) y plantilla disponible (400
  «No existe plantilla… disponibles: BO»); en una transacción: siembra plan
  (`seedChartOfAccountsForTenant`), mappings (`ensureAccountMappingsForTenant`) y cuentas
  de mayor en maestros (`ensureMasterAccountsForTenant`). Upsert/updateMany → idempotente.

### 3.4 Creación de tenants
- `CreateTenantDto.accountingEnabled?` (default true).
- `TenantService.create` lo desestructura del payload de Prisma y lo pasa a
  `seedTenantData(prisma, id, currency, country, accountingEnabled)`.
- `seedTenantData` persiste la clave en `SystemSettings` y solo ejecuta el bloque
  «plan de cuentas + mappings + cuentas de mayor» si `accountingEnabled` es true.
- `POST /tenants/:id/seed` respeta el flag actual del tenant (lee la clave antes de re-seed).

## 4. Frontend

- **Modelos/servicio** (`pages/settings/settings.service.ts`): `AppSettings.accountingEnabled`
  (default true), `ChartOfAccountsStatus`, `ChartOfAccountsGenerationResult` y métodos
  `getChartOfAccountsStatus()` / `generateChartOfAccounts()`.
- **Parametrización → Contabilidad** (`pages/settings`): toggle "Habilitar contabilización"
  (inhabilitado si el tenant tiene asientos) + aviso del modo solo comercial; al estar
  habilitada muestra determinación de cuentas, cuentas de diferencia de cambio y el bloque
  de estado/acción del plan (generado → resumen + «Completar/regenerar»; sin plan →
  botón «Generar Plan de Cuentas»; país sin plantilla → aviso). Errores del backend
  (409/400) se muestran en el toast.
- **Panel superadmin → creación de tenant** (`pages/admin`): switch "Contabilización"
  (default ON) incluido en el payload `CreateTenantPayload.accountingEnabled`.
- **Sidebar** (`core/layout/sidebar`): `SidebarChild.accountingOnly` — Asientos Contables,
  Plan de Cuentas y Mapeos Contables se ocultan cuando `accountingEnabled` es false;
  Años Fiscales y el resto del menú se mantienen.

## 5. Archivos tocados

**Backend:** `settings/settings.service.ts|controller.ts|spec`, `common/chart-of-accounts.util.ts`,
`common/tenant-seed.util.ts`, `common/accounting/journal-entry-core.ts`,
`common/accounting-engine.service.ts` (+spec), `tenants/tenant.service.ts|controller.ts`,
`tenants/dto/create-tenant.dto.ts`, `fiscal-years/fiscal-years.service.ts` (+spec),
`journal-entries/journal-entries.service.ts`.

**Frontend:** `pages/settings/settings.service.ts|component.ts|html|scss|spec`,
`pages/admin/admin.component.ts|html|spec`, `models/admin.model.ts`,
`core/layout/sidebar/sidebar.config.ts|component.ts`.

## 6. Tests y verificación

- Backend suite completa verde (1547 tests: +5 settings flag/status/generación, +1 fiscal
  apertura bloqueada, +4 gates del engine; el spec `super-admin-auth.controller.spec.ts`
  es el flaky conocido y pasa en aislamiento).
- Frontend build AOT 0 errores; Karma suite completa verde.
- Verificación live: crear tenant con `accountingEnabled=false` → sin cuentas; habilitar →
  `GET settings/chart-of-accounts` reporta plan pendiente; `POST` genera el plan BO;
  desactivar con asientos → 409.

## 7. Pendientes futuros (no bloqueantes)

- Plantilla **universal** (`UNIVERSAL`) y planes por país (PE, CL, AR…) — el mecanismo ya
  resuelve `país → universal → error`.
- Decidir ocultamiento de otros módulos que generan asientos en tenants no contables
  (activos fijos, tesorería/bancos) — hoy solo se ocultan los tres ítems acordados.
- Guardas de ruta para URLs directas de módulos contables (hoy la ocultación es de menú y
  el backend bloquea las operaciones).
