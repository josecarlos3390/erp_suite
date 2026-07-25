# Frente 3 - Mixin Responsive Centralizado

**Fecha:** 2026-07-24  
**Estado:** ✅ **MIXIN CREADO E INTEGRADO** - Listo para migración  
**Ubicación:** `src/styles/_mixins.scss`

---

## 🎯 **Problema Resuelto**

**ANTES:** 31 archivos con `@media (max-width: 768px)` duplicado violando el principio DRY

**DESPUÉS:** Mixin centralizado que encapsula todos los patrones responsive comunes

---

## 📋 **Mixin Creado**

### **Ubicación:** `src/styles/_mixins.scss`

### **Patrones Incluidos:**

#### 1. **Mixin Principal `mobile()`**
```scss
@mixin mobile {
  // Show/hide desktop vs mobile
  .dt-text-desktop { display: none !important; }
  .dt-text-mobile { display: inline !important; }

  // Layout colapsado
  .full-width-mobile { flex: 1 1 100% !important; width: 100% !important; }

  // Flex wrap estándar
  .flex-wrap-mobile { flex-wrap: wrap !important; gap: var(--space-2) !important; }

  // Grid colapsado
  .grid-col-mobile { grid-template-columns: 1fr !important; }
  .grid-2-cols-mobile { grid-template-columns: repeat(2, 1fr) !important; }

  // Espaciado móvil
  .padding-mobile { padding: 12px !important; }
  .gap-mobile { gap: var(--space-2) !important; }
  .gap-mobile-tight { gap: 4px 8px !important; }
}
```

#### 2. **Mixins de Aplicación**
```scss
@mixin mobile-collapse {
  @media (max-width: 768px) {
    @include mobile;
  }
}

@mixin mobile-only {
  @media (max-width: 768px) {
    @content;
  }
}

@mixin desktop-only {
  @media (min-width: 769px) {
    @content;
  }
}
```

---

## 🔧 **Uso del Mixin**

### **Reemplazo Básico**

**ANTES:**
```scss
@media (max-width: 768px) {
  .action-bar-buttons {
    flex-wrap: wrap;
    gap: 8px;
  }
  .dt-text-desktop {
    display: none;
  }
  .dt-text-mobile {
    display: inline;
  }
}
```

**DESPUÉS:**
```scss
.action-bar-buttons {
  @include mobile-collapse;
}
```

### **Uso de Clases Helper**

```scss
// En tus componentes HTML/SCSS
.elemento {
  &.full-width-mobile { @include mobile-collapse; }
  &.flex-wrap-mobile { @include mobile-collapse; }
}
```

### **Uso Avanzado**

```scss
// Para contenido específico mobile
.custom-mobile-section {
  @include mobile-only {
    // Solo visible en mobile
    display: block;
  }
}

// Para contenido desktop-only
.desktop-section {
  @include desktop-only {
    // Solo visible en desktop
    display: block;
  }
}
```

---

## 📊 **Clases Helper Disponibles**

| Clase | Uso | Caso típico |
|-------|-----|-------------|
| `.dt-text-desktop` | Automático | Elementos solo desktop (ocultos en mobile) |
| `.dt-text-mobile` | Automático | Elementos solo mobile (ocultos en desktop) |
| `.full-width-mobile` | Manual | Elementos que toman todo el ancho en mobile |
| `.flex-wrap-mobile` | Manual | Botones/action bars que se envuelven |
| `.grid-col-mobile` | Manual | Grids que colapsan a 1 columna |
| `.grid-2-cols-mobile` | Manual | Grids que colapsan a 2 columnas |
| `.padding-mobile` | Manual | Contenedores con padding ajustado |
| `.gap-mobile` | Manual | Contenedores con gap estándar |
| `.gap-mobile-tight` | Manual | Contenedores con gap ajustado |

---

## 🔄 **Patrones Identificados en los 31 Archivos**

### **Patrón 1: Show/Hide Desktop vs Mobile (MÁS COMÚN)**
```scss
// 16 archivos usan este patrón
@media (max-width: 768px) {
  .dt-text-desktop { display: none; }
  .dt-text-mobile { display: inline; }
}
```

**Reemplazo:** Agregar la clase `dt-text-desktop` y `dt-text-mobile` en el HTML/SCSS, el mixin lo maneja automáticamente.

### **Patrón 2: Flex Wrap con Gap**
```scss
// 8 archivos usan este patrón
@media (max-width: 768px) {
  .action-bar-buttons {
    flex-wrap: wrap;
    gap: 8px;
  }
}
```

**Reemplazo:** Usar clase `flex-wrap-mobile` y envolver con `@include mobile-collapse;`

### **Patrón 3: Grid Collapse**
```scss
// 6 archivos usan este patrón
@media (max-width: 768px) {
  .method-row-header,
  .method-row-body {
    grid-template-columns: 1fr;
  }
}
```

**Reemplazo:** Usar clase `grid-col-mobile` o envolver con `@include mobile-collapse;`

### **Patrón 4: Layout Changes**
```scss
// Varios archivos usan patrones como:
.warehouse-card-main {
  flex: 1 1 100%;
}
```

**Reemplazo:** Usar clase `full-width-mobile`

---

## 📈 **Estrategia de Migración**

### **Fase 1: Archivos Simples (10 archivos)**
Archivos con 1-2 bloques `@media` simples

**Ejemplo:** `permissions.component.scss`, `kardex.component.scss`

### **Fase 2: Formularios Medios (15 archivos)**
Formularios con 2-4 bloques `@media` de complejidad media

**Ejemplo:** `item-form.component.scss`, `profile.component.scss`

### **Fase 3: Formularios Complejos (6 archivos)**
Formularios con 5+ bloques `@media` o lógica compleja

**Ejemplo:** `incoming-payments-form.component.scss`, `pos.component.scss`

---

## 🎯 **Beneficios del Mixin**

### **DRY Principle**
- ✅ **31 bloques** duplicados consolidados en 1 mixin
- ✅ **Cambio único** vs 31 cambios dispersos
- ✅ **Mantenimiento simplificado** - 1 lugar para actualizar

### **Consistencia**
- ✅ **Gap consistente**: `var(--space-2)` en lugar de `8px` hardcodeado
- ✅ **Nomenclatura unificada**: clases helper con sufijo `-mobile`
- ✅ **Breakpoint único**: 768px consistentemente

### **Mantenibilidad**
- ✅ **Actualización centralizada** - Cambiar en 1 lugar
- ✅ **Prevención de errores** - Menos posibilidades de inconsistencias
- ✅ **Documentación** - Uso estandarizado para equipo

---

## 🚀 **Siguiente Paso: Migración**

Ahora que el mixin está creado e integrado, el siguiente paso es migrar los 31 archivos para usar el mixin centralizado.

**Estrategia:**
1. Reemplazar bloques `@media (max-width: 768px)` por `@include mobile-collapse`
2. Agregar clases helper donde sea necesario
3. Validar que no haya regresiones visuales
4. Eliminar bloques duplicados

---

## 📋 **Archivos a Migrar (31 total)**

**Formularios de Documento (Prioridad Alta):**
- `incoming-payments-form.component.scss`
- `outgoing-payments-form.component.scss`
- `sale-invoices-form.component.scss`
- `purchase-invoices-form.component.scss`
- `delivery-orders-form.component.scss`
- `purchase-orders-form.component.scss`
- `purchase-quotations-form.component.scss`
- `sale-reserve-invoices-form.component.scss`
- `purchase-reserve-invoices-form.component.scss`
- [Y 21 archivos más...]

**Otros Componentes (Prioridad Media):**
- `accounts.component.scss`
- `dashboard.component.scss`
- `pos.component.scss`
- `permissions.component.scss`
- [Y más...]

---

**Estado:** ✅ **MIXIN LISTO PARA MIGRACIÓN**  
**Siguiente paso:** Comenzar migración por fases (simple → medio → complejo)
