# Propuesta — Matriz de licencias plan→capacidades (T46, 2026-09-09)

> **Estado: APROBADA e IMPLEMENTADA (2026-09-09).** Decisiones del usuario:
> **D1** no regresión aceptada · **D2** destino por plan aceptado tal cual ·
> **D3** volumetría diferida. Implementación: matriz `2026-09-09.2` en
> `backend-erp/src/billing/plan-capabilities.ts` (módulos core = piso común;
> capacidades del grupo 2 con su plan + marca `planned` para las no
> implementadas) y `GET /billing/capabilities` expone `planned` por módulo.
> **Sin gating** de módulos actuales (principio D1).
>
> Base técnica previa: matriz `2026-09-09.1` (10 áreas, sin gating), util
> `planIncludes(plan, module)` y endpoint informativo.

## 1. Principios propuestos

1. **No regresión de operación:** los tenants existentes en `SHARED` conservan
   TODOS los módulos que hoy usan (la matriz actual queda como piso para
   ellos). La diferenciación por plan se aplica a **capacidades nuevas** y a
   **tenants nuevos** — así ninguna empresa en operación pierde funciones.
2. **Cumplimiento legal primero:** lo que la norma boliviana exige (facturación
   electrónica SIN) no puede quedar fuera de ningún plan.
3. **Gating informado, no sorpresivo:** el endpoint de capacidades alimenta la
   UI (módulos visibles/ocultos y mensajes) antes de activar bloqueos en API.
4. **Un solo vocabulario:** cada capacidad nueva entra a la matriz con la misma
   clave que usará el guard; nada de nombres paralelos.

## 2. Matriz propuesta

### 2.1 Módulos actuales (piso común, sin cambios)

| Capacidad | SHARED | DEDICATED |
|---|---|---|
| Ventas (cotizaciones→pedidos→entregas→facturas→NC/ND→devoluciones) | ✅ | ✅ |
| Compras (solicitudes→cotizaciones→pedidos→recepciones→facturas→NC/ND→devoluciones) | ✅ | ✅ |
| Inventario (entradas/salidas/transferencias/ajustes/conteos/ensamblajes/lotes/seriados) | ✅ | ✅ |
| POS (terminales, sesiones, facturación POS) | ✅ | ✅ |
| Finanzas y contabilidad (asientos, pagos, bancos, activos fijos, cierres, conciliación, TC) | ✅ | ✅ |
| Catálogos maestros | ✅ | ✅ |
| Nómina y RRHH (parámetros, RC-IVA, crédito fiscal, IUE/IT) | ✅ | ✅ |
| Reportes y Query Manager | ✅ | ✅ |
| Configuración y permisos | ✅ | ✅ |
| Carga masiva | ✅ | ✅ |

> Nota: hoy ambos planes son idénticos. Diferenciar estos módulos rompería la
> operación de tenants SHARED existentes → **no se propone**.

### 2.2 Capacidades nuevas (grupo 2) — destino propuesto

| Capacidad futura | Clave propuesta | SHARED | DEDICATED | Razón |
|---|---|---|---|---|
| Facturación electrónica SIN (F5.1) | `e-invoicing-sin` | ✅ | ✅ | Obligación legal en Bolivia: excluirla de un plan dejaría al tenant incumpliendo. |
| Conector SAP Business One (F5.3) | `sap-connector` | — | ✅ | Integración de plataforma (Service Layer, sincronización): valor de plan superior. |
| CRM básico (F5.4) | `crm` | ✅ | ✅ | Volumen bajo, mejora la retención; sin costo operativo relevante. |
| Nómina avanzada / RRHH extendido | `payroll-advanced` | — | ✅ | Módulo de alto valor y soporte intensivo. |
| Localización multi-país (F7.3) | `localization-multi` | — | ✅ | Requiere mantenimiento normativo por país. |
| Multi-divisa (F7.2) | `multi-currency` | ✅ | ✅ | **Ya implementada** (Fase 7.2): pasa a piso común, no se gatea. |

### 2.3 Diferenciación por volumetría (opcional, requiere extensión de modelo)

Hoy la matriz es booleana. Si querés diferenciar por tamaño, la propuesta es
extenderla a `{ included: boolean; limit?: number | null }` y definir cupos —
**sugerencia de arranque** (a validar comercialmente):

| Recurso | SHARED | DEDICATED |
|---|---|---|
| Usuarios activos | hasta 15 | sin límite |
| Almacenes | hasta 5 | sin límite |
| Terminales POS | hasta 3 | sin límite |
| Base de datos | compartida (aislamiento lógico) | **propia** (`Tenant.dbUrl`) |
| Backup/restauración | diario administrado | a demanda + ventana propia |

## 3. Cómo se implementaría (una vez aprobado)

1. `plan-capabilities.ts`: agregar las claves nuevas al catálogo y a la matriz
   (con `planned: true` mientras la feature no exista, para que el endpoint ya
   informe el destino por plan).
2. Guard/util: `planIncludes(plan, key)` en los módulos nuevos (nunca en los
   actuales, por el principio 1).
3. UI: consumir `GET /billing/capabilities` para mostrar/ocultar módulos y
   mensajes de upgrade (sin bloquear rutas existentes de SHARED).
4. Docs: actualizar esta matriz + `ROADMAP` Fase 8.1 y registrar la decisión en
   `AUDIT` (fila T46, ampliación "decisión de producto").

## 4. Decisiones (aprobadas 2026-09-09)

- **D1 — ✅ Aceptado.** SHARED conserva los módulos actuales (piso común); la
  diferenciación aplica a capacidades nuevas y tenants nuevos.
- **D2 — ✅ Aceptado tal cual.** SIN y CRM en ambos; SAP, nómina avanzada y
  localización multi-país solo en DEDICATED; multi-divisa en piso común.
- **D3 — ✅ Diferida.** La volumetría por plan se definirá en una fase
  comercial posterior; la matriz permanece booleana.

*Implementado: `PLAN_CORE_MODULES` / `PLAN_FEATURE_MODULES`, matriz
`2026-09-09.2`, `PLANNED_CAPABILITIES` y `planned` en el endpoint. Tests:
`plan-capabilities.spec.ts` (D1/D2/planned) + `billing.service.spec` (SHARED vs
DEDICATED) → billing 4 suites / 30 tests en verde.*
