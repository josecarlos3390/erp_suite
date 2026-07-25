# PLAN CONSERVADOR Y SEGURO - Frontend Refactoring

**Fecha:** 2026-07-16 · **Última actualización de estado:** 2026-07-17
**Autor:** Arquitecto Senior (AI Assistant)
**Enfoque:** "Poco a poco, con validación constante"

---

## 🟢 ESTADO REAL (2026-07-17)

Verificado contra el repo, no contra lo que dice el resto del plan:

| Fase | Descripción | Estado |
|------|-------------|--------|
| Fase 0 | Validación post-migración async | ✅ Smoke test PASS |
| Fase 1 | Código muerto modal/dropdown | ✅ DONE — `sales-orders`, `purchase-orders`, `delivery-orders`, `purchase-receipts`, `sale-invoices`, `sale-reserve-invoices` limpios |
| Fase 3 | `PriceResolutionService` | ✅ DONE en forms de documento (`sale-invoices`, `sale-reserve-invoices`, `sales-orders`, `sales-quotations`, `delivery-orders`). Remanente: `pos.component.ts` (flujo-carrito, ver §Pendiente) |

**Trabajo adicional completado fuera del plan original:**
- ✅ Helpers `catchEmpty()` y `loadCatalogs()` en `src/app/shared/rxjs-utils.ts` (consolidan `.pipe(catchError(() => of([])))` y la carga paralela de catálogos).
- ✅ `MasterDataFormBase` aplicada a los 4 forms maestros simples (`account-form`, `asset-category-form`, `fixed-asset-form`, `discount-groups-form`) — ver [`PROMPT-refactor-standardization-v3.md`](./PROMPT-refactor-standardization-v3.md) Fase 2.
- ✅ Tests deterministas de `TenantBrandingService` (stub de `matchMedia`). Suite: **1066/1066 PASS**.

**⬜ Pendiente real** (ordenado por valor/riesgo):
1. ~~**`PROMPT-refactor-standardization-v3.md` Fase 3**~~ — ✅ DONE (`user-form` migrado; 0 `switchMap` en pages).
2. ~~**`PROMPT-refactor-standardization-v3.md` Fase 4**~~ — ✅ DONE (`recalculationVersion` + stale-partner guard en `pos.component.ts`).
3. ~~**`PROMPT-refactor-standardization-v3.md` Fase 5**~~ — ✅ DONE (`document-form-testing.ts` dividido en `factories`/`configure-testing-module`/`flush` + barrel; 1066/1066 specs). **Track v3 COMPLETO.**
4. ~~**`DocumentSnapshotService`**~~ — ⏸️ **DIFERIDO (bajo ROI)**: `_buildSnapshot`/`_saveSnapshot` es dirty-tracking por huella de string duplicado en 14 componentes. Duplicación real pero cada caso son ~15 líneas que ya funcionan, con selección de campos delicada y distinta por documento. Alto superficie de contacto, bajo beneficio — se deja pendiente salvo que cambie la prioridad.
5. ~~**`DocumentDraftBuilderService`**~~ — ✅ DONE (13 mappers extraídos + cableados; ver [`refactor-draft-builder-guia.md`](./refactor-draft-builder-guia.md)).

> **Conclusión (2026-07-17):** los tracks de refactoring core del frontend están **completos** — dead-code, `PriceResolutionService`, migración async, helpers RxJS, `MasterDataFormBase`, `save()` async/await, concurrencia POS, modularización de testing y `DocumentDraftBuilderService`. Quedan solo como opción de muy bajo ROI los métodos de precio de `pos.component.ts` (flujo-carrito específico) y el dirty-tracking por snapshot. Suite: **1066/1066 PASS**, build y lint limpios.

> El detalle fase-por-fase de abajo es el plan original (2026-07-16). La tabla de arriba refleja la realidad actual.

---

## 🎯 OBJETIVO

Reducir deuda técnica de forma **segura y controlada**, priorizando:
1. **Estabilidad del sistema** (no breaking changes)
2. **Validación funcional constante** (smoke tests)
3. **Progresión incremental** (un componente a la vez)
4. **Rollback fácil** (git revert, no feature flags)

---

## 📋 FASE 0: Validación de Estado Actual (Día 1)

### Objetivo
Confirmar que el sistema funciona después de migración async/await

### Acciones
1. Ejecutar `plan-smoke-test.md` (5 formularios críticos)
2. Documentar qué funciona/qué no
3. **Decisión:**
   - ✅ Todo funciona → Proceder a Fase 1
   - ❌ Bugs encontrados → Arreglar bugs primero, NO refactor

### Entregables
- Smoke test completado
- Documento con estado actual del sistema

**Duración:** 2-3 horas
**Riesgo:** MUY BAJO (solo observación, no cambios)

---

## 📋 FASE 1: Limpieza de Código Muerto (Semana 1)

### Objetivo
Eliminar código muerto (modal/dropdown) de **formularios que YA migraron a `<app-item-combobox>`**

### Estrategia Conservadora
- **UN componente a la vez**
- **EDICIÓN MANUAL** (NO sed scripts)
- **Validación manual después de cada cambio**
- **Commits pequeños** (uno por componente)

### Componentes Candidatos
Basado en `reporte-sesion.md`, estos YA migraron a `<app-item-combobox>`:
1. ✅ `sale-invoices-form.component.ts` (ya limpiado)
2. ✅ `sale-reserve-invoices-form.component.ts` (ya limpiado)
3. ❓ `sales-orders-form.component.ts` (POR VALIDAR)
4. ❓ `purchase-orders-form.component.ts` (POR VALIDAR)
5. ❓ `delivery-orders-form.component.ts` (POR VALIDAR)

### Proceso por Componente

#### Paso 1: Validar que `<app-item-combobox>` cubre todo
```bash
# Verificar que NO hay referencias en HTML al código viejo
grep "showItemModal\|activeDropdownIndex\|filteredManualItems" \
  src/app/pages/sales-orders/sales-orders-form.component.html

# Si resultado es 0 → SAFE TO DELETE
# Si resultado > 0 → INVESTIGAR más
```

#### Paso 2: Backup antes de tocar
```bash
git checkout -b refactor/remove-dead-code-sales-orders
# Git ya hace backup del original
```

#### Paso 3: Eliminar código MANUALMENTE
- Abrir archivo en editor
- Buscar y eliminar BLOQUES COMPLETOS:
  - Propiedades: `showItemModal`, `activeRowIndex`, `dropdownRect`, `activeDropdownIndex`
  - Arrays: `filteredManualItems`, `filteredCatalogItems`
  - Métodos: `openItemModal`, `closeItemModal`, `onItemSelectedFromModal`
  - Métodos: `openManualDropdown`, `closeManualDropdown`, `onManualTermChange`
  - ViewChildren: `itemSearchInputs`

#### Paso 4: Validar
```bash
# 1. Lint
npm run lint -- src/app/pages/sales-orders/sales-orders-form.component.ts

# 2. Build
ng build --configuration development

# 3. Tests
npm run test -- --include='**/sales-orders-form.component.spec.ts' --watch=false

# 4. Manual validation
ng serve
# - Abrir pedidos de venta en browser
# - Crear pedido (verificar combobox funciona)
# - Agregar items (verificar modal/dropdown funciona)
# - Editar items
```

#### Paso 5: Commit y Merge
```bash
git add .
git commit -m "refactor(sales-orders): remove dead modal/dropdown code

- Removed showItemModal, activeRowIndex, openItemModal, closeItemModal
- Removed dropdownRect, activeDropdownIndex, openManualDropdown, closeManualDropdown
- <app-item-combobox> handles all item selection
- Verified: no HTML references, all functionality covered
- Manual test: PASSED
- Size reduction: 82 lines

Reviewed-by: _____________"

git push origin refactor/remove-dead-code-sales-orders
# Create PR, get code review, merge to main
```

### Orden de Ejecución
1. `sales-orders-form.component.ts` (más crítico)
2. `purchase-orders-form.component.ts`
3. `delivery-orders-form.component.ts`
4. `purchase-receipts-form.component.ts` (si aplica)

**Duración:** 1 semana (1-2 componentes por día)
**Riesgo:** BAJO (cambio mecánico, fácil rollback)
**Entregables:** 3-4 PRs merged, ~200-300 líneas eliminadas

---

## 📋 FASE 2: Decisión de Continuar (Post-Fase 1)

### Evaluar Resultados

#### SI todo funcionó perfectamente:
- ✅ Smoke tests pasan
- ✅ Sin bugs regresionados
- ✅ Team satisfecho con progreso
→ **PROCEDEDER a Fase 3**

#### SI hubo problemas:
- ❌ Bugs encontrados
- ❌ Rollbacks necesarios
- ❌ Team insatisfecho
→ **DETENERSE, reevaluar estrategia**

---

## 📋 FASE 3: Consolidación de Servicios (Semana 2-3) - CONDICIONAL

### SOLO SI Fase 1 fue exitosa

### Objetivo
Unificar lógica de precios en `PriceResolutionService` compartido

### Pre-condición
- Fase 1 completada sin incidentes
- `PriceResolutionService` tiene >85% test coverage
- Tests existentes pasan

### Estrategia
Mismo patrón conservador que Fase 1:
- **UN componente a la vez**
- **EDICIÓN MANUAL**
- **Validación constante**

### Componentes a Migrar
Basado en `reporte-sesion.md`:
1. ❓ `sales-orders-form.component.ts` (sí tiene `_resolveAutoDiscount`)
2. ❓ `purchase-quotations-form.component.ts`
3. ❓ `purchase-orders-form.component.ts`
4. ❓ `sales-quotations-form.component.ts`

### Proceso (similar a Fase 1)
1. Validar que servicio compartido cubre toda la lógica
2. Backup (branch)
3. Eliminar métodos privados `_resolveAutoDiscount`, `_resolvePriceFromList`
4. Inyectar `PriceResolutionService`
5. Reemplazar llamadas
6. Validar (lint + build + tests + manual)
7. Commit y merge

**Duración:** 2 semanas (1 componente por día)
**Riesgo:** MEDIO (cambio de lógica de negocio)

---

## 📋 FASE 4: PAUSA Y EVALUACIÓN (Post-Fase 3)

### Decisión de Continuar

#### SI todo funcionó:
→ Evaluar si vale la pena continuar con Fase 5 (DocumentFormBuilder)

#### SI problemas:
→ DETENERSE, consolidar ganancias

---

## 📋 FASE 5: DocumentFormBuilder - OPCIONAL (Semana 4+)

### CONDICIONES para proceder:
- ✅ Fase 1-3 completadas sin problemas mayores
- ✅ Team tiene tiempo y bandwidth
- ✅ Stakeholders de acuerdo con alcance

### SI NO se cumplen:
→ **DETENERSE aquí. Las fases 1-3 YA son mejora significativa.**

---

## 🎯 MÉTRICAS DE ÉXITO

### Corto Plazo (Fase 1-2, 2 semanas)
- ✅ 0 bugs regresionados
- ✅ 200-300 líneas de código muerto eliminadas
- ✅ 3-4 PRs merged sin incidentes
- ✅ Tests pasando al 100%

### Mediano Plazo (Fase 1-3, 4-5 semanas)
- ✅ 500-700 líneas eliminadas
- ✅ 7-10 PRs merged
- ✅ 0 incidentes en producción
- ✅ Test coverage mantenido o mejorado

### Largo Plazo (si Fase 4-5)
- ✅ 1500-2000 líneas eliminadas
- ✅ 15-20 PRs merged
- ✅ Arquitectura más escalable

---

## ⚠️ RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Bug regresionado | Baja | Alto | Smoke tests + validación manual |
| Break en build | Media | Medio | Lint + build después de cada cambio |
| Team overload | Baja | Medio | Un componente a la vez, ritmo sostenible |
| Scope creep | Media | Medio | Fases claras con stop/go gates |
| Feature flag complexity | Baja | Alto | NO usar feature flags, usar git revert |

---

## 📌 CRITERIOS DE STOP/GO

### STOP (detener refactorización)
- ❌ Bug crítico en producción
- ❌ Más de 2 rollbacks en una semana
- ❌ Team insatisfecho o abrumado
- ❌ Tests coverage baja significativamente

### GO (continuar)
- ✅ 0 bugs en producción
- ✅ Progreso sostenible (1-2 PRs por semana)
- ✅ Team satisfecho
- ✅ Tests coverage mantenido

---

## 📅 CALENDARIO RESUMIDO

```
Semana 0 (HOY): Fase 0 - Smoke Test (2-3 horas)
├─ Ejecutar plan-smoke-test.md
└─ Decisión: Go/No-Go

Semana 1: Fase 1 - Código Muerto
├─ sales-orders (Lun-Mar)
├─ purchase-orders (Mié)
├─ delivery-orders (Jue)
└─ PAUSA y evaluación (Vie)

Semana 2-3: Fase 2/3 - Servicios (CONDICIONAL)
└─ SOLO si Fase 1 fue exitosa

Semana 4+: Fase 4/5 - Builder (OPCIONAL)
└─ SOLO si todo lo anterior funcionó
```

---

## 🚀 RECOMENDACIÓN FINAL

**HOY:**
1. Ejecutar `plan-smoke-test.md` (2-3 horas)
2. Si todo funciona → iniciar Fase 1 mañana
3. Si hay bugs → arreglar bugs primero

**NO hacer:**
- ❌ Ejecutar scripts sed masivos
- ❌ Cambiar múltiples componentes a la vez
- ❌ Implementar feature flags complejos
- ❌ Refactorizar sin validación funcional

**SÍ hacer:**
- ✅ Un cambio a la vez
- ✅ Validación constante (manual + tests)
- ✅ Commits pequeños y frecuentes
- ✅ Code review obligatorio
- ✅ Rollback fácil con git revert

---

## 📞 APOYO Y DECISIONES

**Dudas durante ejecución:**
- Consultar arquitecto senior
- Code review obligatorio para cada PR
- Daily standup de 15 min si team lo necesita

**Decisiones mayores:**
- Stop/Go gates al final de cada fase
- Team vote si hay incertidumbre
- Fallback a "hacer nada" si riesgos son altos

---

**Este plan es CONSERVADOR por diseño.**

Mejor ir despacio y seguro, que rápido y romper todo.
