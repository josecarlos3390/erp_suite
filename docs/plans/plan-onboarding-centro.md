# Plan — Onboarding guiado por el Centro de configuración (core vacío → flujo operativo)

> Fecha: 2026-09-05 · Backend `src/setup` + scripts · Frontend `pages/setup` · Docs guía.
> **Objetivo:** partir de una BD **vacía (solo tenant + admin/roles)** y usar el **Centro de
> configuración** como única guía para parametrizar/configurar paso a paso hasta poder
> generar un **flujo operativo completo** (ventas, compras, inventarios, tesorería, etc.).
> Si el Centro no contempla toda la configuración/parametrización necesaria, se actualiza.
>
> Decisiones aprobadas por el usuario (2026-09-05): **vacío total** (solo tenant + admin);
> **sí wizard de maestros base por país** en el Centro; **sí checklist de validación de
> flujo por módulo** en el Centro.

---

## 1. Fases

### Fase A — Reset reproducible a núcleo vacío ✅ (base)
- `npm run reset:core` en `backend-erp`:
  1. `prisma migrate reset --force --skip-seed` (schema limpio, migraciones al día, sin datos).
  2. `scripts/bootstrap-core.ts` (idempotente): crea **solo** tenant `default`
     (businessName/taxId **vacíos** → el perfil queda pendiente en el Centro), usuario
     `admin/admin123` y roles de sistema `ADMIN`/`USER` + vínculo `userRole`.
- Resultado: el Centro de configuración queda **todo en rojo** y guía la reconstrucción.
- Validación: login `admin/admin123` OK; `GET /setup/checklist` con `requiredPending > 0` y
  maestros/cuentas/series/settings en cero.

### Fase B — Auditoría de gaps del Centro vs flujos objetivo
- Tabla por módulo (Ventas / Compras / Inventario / Tesorería / Contabilidad / Transversal):
  qué parametrización exige cada flujo (maestros, cuentas, numeración, impuestos,
  condiciones, precios, settings) vs qué chequea hoy el Centro.
- Entrega: lista cerrada de ítems/grupos nuevos (issue-doc en este plan, §3).

### Fase C — Centro ampliado
- **Grupo "Parametrización"** (revisables OK/WARN): país/idioma/zona horaria, flags de
  stock/warehouse/POS/ERP, cuentas ganancia/pérdida por tipo de cambio, ventana/tolerancia
  de conciliación, `accountingEnabled` + nivel de determinación, habilitación de series.
- **Wizard "Maestros base por país"** (mismo patrón que "Generar Plan de Cuentas"):
  crea bajo demanda los maestros estándar del país — indicadores de impuesto (IVA/Exento/
  0%…), monedas, UoMs, condiciones de pago, grupo/lista de precios por defecto, sucursal/
  almacén por defecto y cuentas CxC/CxP de partners (parametrizable; por tipo de país).
- **Grupo "Validación operativa"** (por módulo): OK cuando existe ≥1 documento confirmado
  de la familia (venta / compra / inventario / tesorería/banco) + cierre de ejercicio si
  aplica (guiado por Anexo D).
- **Checks faltantes** surgidos de la auditoría (p. ej. series por defecto por usuario,
  cuentas de partners por tipo, retenciones si aplica).
- Tests: backend (setup spec ampliado), Karma del `/setup`, y actualización de la guía
  `guia-implementacion-configuracion.md` + `ROADMAP`.

### Fase D — Caminata guiada (local, solo con el Centro)
- Desde core vacío hasta flujo operativo completo (1 venta, 1 compra, movimiento de
  inventario y 1 cobro/pago conciliado) usando exclusivamente el Centro ("Resolver
  siguiente paso") + pantallas destino. Anotar y corregir fricciones del propio Centro.
- E2E Playwright de la caminata como prueba de humo (opcional en esta fase).

### Fase E — Replicar en Railway y cierre
- En Railway: reset de la BD (procedimiento §3.1 del runbook ya documentado) + `reset:core`
  (migrate deploy + bootstrap) + redeploy; caminata equivalente con datos de prueba.
- Docs finales: guía, plan, ROADMAP, CHANGELOGs; commits por repo.

## 2. Criterios de aceptación
- `reset:core` reproducible: tras correrlo, `/setup/checklist` en rojo total y sin
  transacciones/maestros/settings.
- El Centro cubre TODA la parametrización de los flujos objetivo (auditoría cerrada).
- Con solo el Centro + pantallas destino se llega de vacío a flujo operativo (verificado
  local y en Railway).
- Suite backend/Karma/E2E en verde; modo comercial (T12) y multi-tenant intactos.

## 3. Registro de gaps del Centro (auditoría Fase B ✅ 2026-09-05)

Análisis por módulo de "lo que exige un flujo operativo" vs "lo que chequea el Centro"
(los ítems marcados **nuevo** se implementan en Fase C):

| Módulo / flujo | Parametrización que exige | Chequeo en el Centro | Estado |
|---|---|---|---|
| Transversal | Perfil (razón social/NIT) | `companyProfile` | ✅ |
| Transversal | Moneda base (+ secundaria) en catálogo | `baseCurrency` / `foreignCurrency` | ✅ |
| Transversal | Plan de cuentas + mapeos (perfil A) | `chartOfAccounts` | ✅ |
| Transversal | Tasa de cambio del día (multi-moneda) | `exchangeRateToday` | ✅ (F5.2: ahora bloqueante) |
| Transversal | País / idioma / zona horaria | — | ⚠️ informativo (viven en Tenant; no bloquean) |
| Contabilidad | Gestión (año fiscal) + períodos | `fiscalYear` / `periods` | ✅ |
| Contabilidad | Cuentas ganancia/pérdida por TC (revaluación, NC M/E) | **nuevo** `exchangeRateAccounts` (Parametrización) | ⏳ en Fase C ✅ backend |
| Contabilidad | Cuentas bancarias → cuenta contable | `bankAccounts` | ✅ (F5.2) |
| Numeración | Series por tipo de documento (26) | `series` (tipos "que usaré") | ✅ |
| Ventas | Cliente + impuestos + condición + precio | `partners`, `taxIndicators`, `paymentTerms`, `priceLists`, `uoms`, `itemGroups` | ✅ |
| Ventas | Cuenta de ingreso por artículo/grupo/matriz | `determinationAccounts` | ✅ |
| Compras | Proveedor + impuestos + condición | idem Maestros | ✅ |
| Compras | CxC/CxP de partners | `partnerAccounts` | ✅ (WARN) |
| Inventario | Sucursal/almacén (+ default) | `branches`, `warehouses`, `defaultWarehouse` | ✅ |
| Inventario | Costo de artículos / matriz | `itemCosts` | ✅ |
| Tesorería | Bancos + cuentas bancarias | (maestro bancos) | ⚠️ no hay ítem propio de "bancos" (sí cuenta bancaria→GL) |
| Parametrización global | Flags stock/POS/warehouse, conciliación, etc. | — | ⚠️ parcial: muchos viven solo en Parametrización (sin check) — se cubren como revisables recomendados en Fase C |
| Maestros base por país | Impuestos BO, monedas, UoMs, condiciones, grupo/lista por defecto, sucursal/almacén (los creaba el seed) | — (no hay generador) | ⏳ **wizard `base-masters` por país (aprobado)** — Fase C |
| **Flujo operativo** | ≥1 documento confirmado por familia (venta, compra, inventario, tesorería) | **nuevo** grupo `Validación operativa` (flowSales/flowPurchases/flowInventory/flowTreasury) | ⏳ en Fase C ✅ backend |

### Avance
- **Fase C (backend, 2026-09-05):** grupo **Parametrización** (`exchangeRateAccounts`,
  WARN recomendado con acción a `/settings`) y grupo **Validación operativa**
  (`flowSales/flowPurchases/flowInventory/flowTreasury`, MISSING recomendado hasta existir
  documento por familia). Verificado en vivo: checklist 25 ítems / 7 grupos sobre núcleo
  vacío. Commit backend `d6a9391`.
- **Fase C (wizard maestros base por país, en implementación):** `POST /setup/base-masters`
  (idempotente; datos exactos del seed para BO: monedas, impuestos, UoMs, condiciones,
  grupo/lista por defecto, sucursal/almacén, return reasons) + acción en el Centro.
- **Fase D (2026-09-05, ✅ completada localmente):** configuración guiada verificada
  (`npm run walkthrough:config` → `requiredPending = 0`) y **validación de flujo por
  módulo OK** (venta, compra, inventario y tesorería con al menos un documento confirmado;
  los 4 ítems `flow*` del Centro en OK) partiendo del núcleo vacío.
- **Fase E (pendiente):** replicar en Railway y cierre de docs.
