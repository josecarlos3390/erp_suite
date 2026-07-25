# Frente 1 — Plan de Migración de Tokens Legacy → Tokens Luna

**Fecha:** 2026-07-24  
**Archivos afectados:** 78 archivos con tokens legacy  
**Tiempo estimado:** 4-5 días  
**Prioridad:** 🔴 ALTA - Mayor impacto en consistencia visual

---

## Estado Actual

| Métrica | Cantidad |
|---------|----------|
| **Archivos con tokens legacy** | 78 |
| **Archivos con tokens nuevos** | 141 |
| **Progreso de migración** | 64% (141/219 archivos) |
| **Deuda técnica restante** | 78 archivos |

---

## Tokens Legacy Identificados

### 1. Tokens de Color Primario
```scss
// LEGACY → NUEVO
--color-primary        → --accent-600       // (o --text-accent para texto)
--color-primary-hover  → --accent-700
--color-primary-bg     → --accent-50
--color-primary-border → --accent-300
--color-primary-text   → --accent-700
```

### 2. Tokens de Estados de Documento (Status)
```scss
// ABIERTO → INFO/ACCENT
--status-open-bg       → --info-50       // (o --accent-50)
--status-open-color    → --info-600       // (o --accent-600)
--status-open-border   → --info-200       // (o --accent-200)

// CERRADO → SUCCESS
--status-closed-bg     → --success-50
--status-closed-color  → --success-800
--status-closed-border → --success-200

// CANCELADO → ERROR
--status-cancelled-bg     → --error-50
--status-cancelled-color  → --error-700
--status-cancelled-border → --error-200

// CONFIRMADO → WARNING
--status-confirmed-bg     → --warning-50
--status-confirmed-color  → --warning-800
--status-confirmed-border → --warning-200
```

### 3. Tokens de Estados Semánticos
```scss
// SUCCESS → WARNING/SUCCESS
--status-success-bg     → --success-50
--status-success-color  → --success-800
--status-success-border → --success-200

// WARNING → WARNING
--status-warning-bg     → --warning-50
--status-warning-color  → --warning-800
--status-warning-border → --warning-200

// DANGER → ERROR
--status-danger-bg      → --error-50
--status-danger-color   → --error-700
--status-danger-border  → --error-200
```

### 4. Tokens de Badges
```scss
// BADGE SUCCESS → SUCCESS
--badge-success-bg   → --success-100
--badge-success-text → --success-800

// BADGE WARNING → WARNING
--badge-warning-bg   → --warning-100
--badge-warning-text → --warning-800

// BADGE ERROR → ERROR
--badge-error-bg     → --error-100
--badge-error-text   → --error-700
```

### 5. Tokens de Peligro/Color
```scss
// COLOR DANGER → ERROR
--color-danger        → --error-600
--color-danger-bg     → --error-50
--color-danger-border → --error-300
--color-danger-text   → --error-700
```

---

## Estrategia de Migración

### **FASE 1: Preparación (0.5 día)**

1. **Backup de estilos principales**
   ```bash
   cp src/styles.scss src/styles.scss.backup
   cp src/styles/tokens/_02-semantic.scss src/styles/tokens/_02-semantic.scss.backup
   ```

2. **Validación de mapeo**
   - Revisar que todos los tokens legacy tengan equivalente nuevo
   - Verificar que no haya dependencias circulares
   - Confirmar compatibilidad con dark mode

### **FASE 2: Migración Automatizada (1 día)**

1. **Script de búsqueda y reemplazo**
   ```bash
   # Crear script de migración
   node scripts/migrate-tokens.js
   ```

2. **Reemplazos por lotes**
   - Priorizar tokens más usados (status-*, badge-*, color-*)
   - Validar después de cada lote
   - Mantener registro de cambios

### **FASE 3: Validación Visual (1 día)**

1. **Pruebas por contexto de uso**
   - Estados de documentos (badges, filas de tablas)
   - Botones de acción (primary, danger, warning)
   - Fondos de banners y notificaciones
   - Bordes de inputs y selects

2. **Validación de dark mode**
   - Verificar que los nuevos tokens funcionen en ambos temas
   - Probar switches de tema en components afectados

### **FASE 4: Limpieza Final (1 día)**

1. **Eliminación de tokens legacy de `styles.scss`**
   - Remover bloque `:root` legacy
   - Validar que no queden referencias huérfanas
   - Actualizar documentación

2. **Actualización de guards de lint**
   - Agregar regla para prevenir re-introducción de tokens legacy
   - Configurar prettier para forzar tokens nuevos

### **FASE 5: Testing y QA (0.5-1 día)**

1. **Validación de regresión visual**
   - Comparación de screenshots antes/después
   - Validación de componentes críticos (document lines, forms, badges)

2. **Validación funcional**
   - Verificar que no haya broken styles
   - Validar interacciones y estados hover/focus

---

## Archivos Críticos Prioritarios

### **Prioridad ALTA (Componentes Core)**

1. **Core Layout**
   - `src/app/core/layout/layout.component.scss`
   - `src/app/core/layout/sidebar/sidebar.component.scss`
   - **Impacto:** Layout base, sidebar, navegación principal

2. **Dashboard** 
   - `src/app/pages/dashboard/dashboard.component.scss`
   - **Impacto:** Pantalla principal, KPIs, resúmenes

3. **Document Forms** (alta visibilidad)
   - `src/app/pages/delivery-orders/delivery-orders-form.component.scss`
   - `src/app/pages/incoming-payments/incoming-payments-form.component.scss`
   - `src/app/pages/outgoing-payments/outgoing-payments-form.component.scss`
   - **Impacto:** Formularios de documentos, líneas de documentos

### **Prioridad MEDIA (Componentes de Negocio)**

4. **Estados y Badges**
   - `src/app/pages/accounts/accounts.component.scss`
   - `src/app/pages/approvals/approvals.component.scss`
   - **Impacto:** Badges de estado, filtros, estados contables

5. **Tablas y Listados**
   - `src/app/pages/journal-entries/journal-entries.component.scss`
   - `src/app/pages/bank-reconciliation/bank-reconciliation-form.component.scss`
   - **Impacto:** Tablas de datos, filas con estados

### **Prioridad BAJA (Componentes Isolados)**

6. **Modales y Overlays**
   - Form components específicos
   - **Impacto:** Componentes con alcance limitado

---

## Comandos de Verificación

### **Antes de Migración**
```bash
# Contar archivos con tokens legacy
grep -rlE --include="*.scss" -- "--(color-primary|color-danger|status-|badge-)" src/app | wc -l
# Expected: 78

# Ver archivos específicos
grep -rlE --include="*.scss" -- "--(color-primary|color-danger|status-|badge-)" src/app > legacy-before.txt
```

### **Durante Migración**
```bash
# Verificar progreso por lote
echo "=== PROGRESO ===" && \
echo "Legacy restantes: $(grep -rlE --include="*.scss" -- "status-open" src/app | wc -l)" && \
echo "Nuevos agregados: $(grep -rlE --include="*.scss" -- "--info-50" src/app | wc -l)"
```

### **Después de Migración**
```bash
# Validar que no queden tokens legacy
grep -rlE --include="*.scss" -- "--(color-primary|color-danger|status-|badge-)" src/app | wc -l
# Expected: 0

# Verificar adopción de tokens nuevos
grep -rlE --include="*.scss" -- "--(accent-|success-|warning-|error-)" src/app | wc -l
# Expected: +78 (ahora 219 total)
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Cambios de color visibles** | Media | Alto | Validación visual por contexto |
| **Dark mode roto** | Baja | Alto | Validación explícita de ambos temas |
| **Regresión en badges** | Media | Medio | Testing de badges en tablas/forms |
| **Dependencias circulares** | Baja | Alto | Validación de mapeo antes de aplicar |
| **Screenshots de documentación** | Baja | Medio | Actualizar documentación visual |

---

## Criterios de Éxito

✅ **Migración Completa:**
- [ ] 0 archivos con tokens legacy
- [ ] 78 archivos migrados a tokens nuevos
- [ ] 100% de adopción del sistema Luna

✅ **Validación Visual:**
- [ ] Sin regresiones visuales en componentes core
- [ ] Badges de estado correctos en documentos
- [ ] Colores de acción (botones, links) consistentes

✅ **Dark Mode:**
- [ ] Todos los componentes funcionan en ambos temas
- [ ] Tokens nuevos adaptan correctamente en dark mode

✅ **Testing:**
- [ ] Sin broken styles tras migración
- [ ] Validación de estados hover/focus/action
- [ ] Documentación actualizada

---

## Timeline Detallado

| Día | Actividad | Entregable |
|-----|-----------|------------|
| **0.5** | Preparación y backup | Archivos backup + mapeo validado |
| **1** | Migración automatizada | Script ejecutado + 78 archivos actualizados |
| **1** | Validación visual base | Componentes core validados |
| **1** | Validación extendida | Components negocio + badges validados |
| **0.5** | Limpieza y testing | Tokens legacy eliminados + testing completo |

**Total:** 4-5 días

---

## Herramientas Necesarias

1. **Script de migración:** `scripts/migrate-tokens.js`
2. **Validación visual:** Storybook o screenshots
3. **Testing manual:** Lista de componentes críticos
4. **Backup:** Git branch + archivos de respaldo

---

## Próximos Pasos Inmediatos

1. ✅ **Análisis completado** - 78 archivos identificados
2. ⏳ **Crear script de migración** - Automatizar reemplazos
3. ⏳ **Ejecutar migración por fases** - Core → Business → Isolated
4. ⏳ **Validación visual intensiva** - Todos los contextos de uso
5. ⏳ **Limpieza final y testing** - Eliminar tokens legacy

---

**Estado del Plan:** ✅ **COMPLETADO** - Listo para ejecución  
**Siguiente acción:** Crear script `migrate-tokens.js` y comenzar Fase 1
