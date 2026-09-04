# Planes de Cuentas por País — registro de planes oficiales (T14)

> Fecha: 2026-09-05 · Backend `src/common/chart-of-accounts*` + `localization.profiles.ts`
> Patrón SAP B1: los módulos existen y la parametrización/plantilla decide. Un país sin
> plan oficial usa la plantilla **UNIVERSAL** (estructura IFRS-like en español que comparte
> códigos con BO → la determinación de cuentas y los mappings funcionan de inmediato).

---

## 1. Estado actual

| País | Plan registrado | Perfil de localización | Estado |
|------|-----------------|------------------------|--------|
| BO (Bolivia) | **BO** — plan oficial boliviano (5 niveles) en `CHART_OF_ACCOUNTS_TEMPLATES['BO']` | `BO` (SIN: IVA por dentro, IT, ICE, split 87/13) | ✅ Operativo |
| PE (Perú) | — (usa UNIVERSAL) | `PE` (cálculo estándar NIC, indicador por defecto IGV) | 🟢 Cobertura UNIVERSAL |
| CL / AR / resto | — (usa UNIVERSAL) | Genérico NIC (STANDARD) | 🟢 Cobertura UNIVERSAL |

`resolveChartOfAccountsTemplate(countryCode)`: plantilla del país → `UNIVERSAL` (fallback) →
error. **Registrar un plan oficial nuevo lo activa automáticamente** para ese país.

---

## 2. Cómo registrar un plan oficial nuevo (checklist)

> ⚠️ **Regla de oro:** nunca registrar un "plan oficial" inventado. El contenido debe
> provenir de una **fuente normativa** del país (p. ej. Perú: Plan Contable General
> Empresarial — Res. CONASEV/SUNAT vigente) y validarse contablemente antes de activarse.
> Un plan con códigos erróneos es PEOR que la plantilla UNIVERSAL.

1. **Fuente normativa.** Identificar el plan oficial vigente del país y su estructura
   (niveles, codificación, agrupaciones). Documentarla en el código junto al array.
2. **Plantilla** (`src/common/chart-of-accounts.data.ts`): declarar
   `const CHART_OF_ACCOUNTS_<PAIS>: SeedAccount[]` con los códigos OFICIALES y registrarla
   en `CHART_OF_ACCOUNTS_TEMPLATES['<ISO>']`.
   - Respetar las invariantes que valida la suite
     (`src/common/chart-of-accounts-integrity.util.ts`): códigos únicos, padres existentes,
     `level` = cantidad de segmentos del código.
3. **Mappings por país** (`src/common/account-mappings.util.ts`). Si el plan usa códigos
   propios (≠ BO), `checkMappingCoverage` **fallará** hasta registrar la capa de mappings
   por país (documentType/entryType → código del país) — es deliberado: la determinación
   de cuentas resuelve contra los códigos del plan. El validador fuerza a no activar un
   plan sin su capa de mappings.
4. **Cuentas de mayor por defecto** (`src/common/master-accounts.util.ts`): revisar que las
   cuentas asignadas a maestros (CxC/CxP, ingresos, inventario…) existan en el plan o se
   parametriza el fallback por país.
5. **Perfil de localización** (`src/common/localization.profiles.ts`): registrar el país con
   su método de cálculo por defecto, indicador fiscal, IVA por dentro/fuera y reglas país
   (o heredar el genérico NIC si no hay reglas especiales).
6. **Tests:** (a) el nuevo plan pasa `chart-of-accounts-integrity.spec.ts`
   (estructura + cobertura); (b) generar el plan en un tenant de prueba del país
   (`POST /settings/chart-of-accounts`) y confirmar cuentas + mappings; (c) un flujo
   contable representativo (factura de venta/compra) cuadra con la determinación por país.
7. **Docs:** actualizar la tabla del §1 y el CHANGELOG.

### Cómo se fuerza (sin intervención manual)

`validateRegisteredTemplates()` se ejecuta en la suite de tests: **toda plantilla
registrada debe pasar** las invariantes y la cobertura de mappings. Un plan nuevo que no
cumpla rompe CI → feedback inmediato.

---

## 3. Relación con el resto del sistema

- **Seed de tenant:** `seedTenantData(…, countryCode, accountingEnabled)` siembra el plan
  según `resolveChartOfAccountsTemplate(countryCode)`; `POST /tenants/:id/seed` respeta el
  flag actual.
- **"Generar Plan de Cuentas"** (`POST /settings/chart-of-accounts`) usa la misma resolución:
  el país registrado pasa a usarse automáticamente sin tocar el motor.
- **Localización fiscal** (`localization.profiles.ts`) es independiente del plan: las reglas
  país (SIN/IT/ICE, split 87/13) solo aplican cuando la localización lo declara; los demás
  países operan con cálculo estándar según sus indicadores de impuesto.
- **T9 (sourceDocumentType enum)** y la determinación de cuentas no dependen del país: los
  entry types son los mismos; solo cambia el código de cuenta al que se mapean.
