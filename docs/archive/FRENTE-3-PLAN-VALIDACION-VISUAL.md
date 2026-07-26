# Frente 3 - Plan de Validación Visual

**Fecha:** 2026-07-24  
**Propósito:** Validar que los 24 archivos migrados al mixin responsive no tengan regresiones visuales  
**Estrategia:** Validación por capas - archivos críticos → archivos medios → archivos simples

---

## 🎯 **Objetivo de Validación**

Asegurar que la migración al mixin responsive **NO** haya introducido regresiones visuales en:

1. **Action bars** - `.flex-wrap-mobile-8` aplicado correctamente
2. **Show/hide labels** - `.dt-text-desktop/mobile` funcionando
3. **Grids** - `.grid-col-mobile` y `.grid-2-cols-mobile` collapsing correctamente
4. **Breakpoint** - 768px activando los cambios responsive

---

## 📋 **Checklist de Validación**

### **Capa 1: Formularios Principales (ALTA PRIORIDAD)**

#### **1. delivery-orders-form.component.scss**
- [ ] **Action bar:** Botones envuelven en mobile con gap: 8px
- [ ] **Labels dt:** Desktop labels ocultan, mobile labels muestran en breakpoint 768px
- [ ] **Sin errores:** No hay errores de compilación SCSS

#### **2. sale-invoices-form.component.scss**
- [ ] **Action bar:** Botones envuelven en mobile con gap: 8px
- [ ] **Labels dt:** Desktop labels ocultan, mobile labels muestran
- [ ] **UDF cards:** Layout mantenido sin cambios

#### **3. purchase-invoices-form.component.scss**
- [ ] **Action bar:** Botones envuelven en mobile con gap: 8px
- [ ] **Labels dt:** Desktop labels ocultan, mobile labels muestran
- [ ] **Approval badges:** Posicionamiento mantenido

#### **4. incoming-payments-form.component.scss**
- [ ] **Grid collapse:** Method rows colapsan a 1 columna en mobile
- [ ] **Grid 2-cols:** Method dates colapsan a 2 columnas en mobile
- [ ] **Sin errores:** Grid patterns funcionan correctamente

#### **5. outgoing-payments-form.component.scss**
- [ ] **Grid collapse:** Method rows colapsan a 1 columna en mobile
- [ ] **Grid 2-cols:** Method dates colapsan a 2 columnas en mobile
- [ ] **Account lines:** Grid collapse a 1fr funciona

### **Capa 2: Formularios Medianos (PRIORIDAD MEDIA)**

#### **6. purchase-orders-form.component.scss**
- [ ] **Action bar:** Flex-wrap con gap: 8px
- [ ] **Labels dt:** Show/hide funcionando

#### **7. purchase-quotations-form.component.scss**
- [ ] **Action bar:** Principal + action-bar-right con flex-wrap
- [ ] **Labels dt:** Desktop/mobile toggle funcionando

#### **8. sales-credit-notes-form.component.scss**
- [ ] **Action bar:** Flex-wrap aplicado
- [ ] **Labels dt:** Toggle desktop/mobile funcionando

#### **9. stock-adjustments-form.component.scss**
- [ ] **Action bar:** Flex-wrap con gap: 8px
- [ ] **Labels dt:** Show/hide labels funcionando

### **Capa 3: Componentes No-Formularios (PRIORIDAD MEDIA)**

#### **10. pos.component.scss**
- [ ] **Header:** Flex-wrap aplicado
- [ ] **Products grid:** 2 columnas en mobile
- [ ] **Checkout modal:** 1 columna en mobile
- [ ] **Payment rows:** 1 columna en mobile
- [ ] **Add payment buttons:** Flex-wrap aplicado

#### **11. profile.component.scss**
- [ ] **Layout:** Grid collapse a 1fr funciona
- [ ] **Padding:** Responsive mantenido

#### **12. permissions.component.scss**
- [ ] **Role selector:** Flex-wrap con gap: 8px aplicado
- [ ] **Permission table:** Grid 2-cols funcionando

---

## 🔍 **Método de Validación**

### **Opción 1: Validación en Código (AHORA)**
- Revisar que las clases helper estén correctamente aplicadas
- Verificar que no haya errores de sintaxis SCSS
- Confirmar que los patrones sean consistentes

### **Opción 2: Validación Visual en Browser (DESPUÉS)**
- Abrir formularios principales en navegador
- Activar responsive mode (≤768px)
- Verificar que action bars, labels, grids funcionen
- Comparar con diseño esperado

---

## 🚀 **Plan de Ejecución**

### **FASE 1: Validación en Código (5-10 min)**
1. ✅ Verificar clases helper definidas en `_mixins.scss`
2. ⏳ Revisar muestra de archivos migrados (5-10 archivos)
3. ⏳ Confirmar patrones consistentes aplicados
4. ⏳ Verificar no errores de compilación

### **FASE 2: Validación Visual (OPCIONAL - 10-15 min)**
5. ⏳ Abrir 2-3 formularios principales en navegador
6. ⏳ Activar responsive mode y verificar comportamiento
7. ⏳ Documentar cualquier hallazgo

---

## 📊 **Criterios de Éxito**

### **✅ Validación Exitosa Si:**
- Todos los formularios principales tienen clases helper aplicadas
- No hay errores de compilación SCSS
- Patrones son consistentes across archivos
- Action bars envuelven correctamente
- Labels desktop/mobile toggle funcionan
- Grids colapsan a 1/2 columnas correctamente

### **⚠️ Requiere Arreglos Si:**
- Errores de compilación SCSS encontrados
- Clases helper no aplicadas correctamente
- Patrones inconsistentes across archivos
- Regresiones visuales identificadas

---

## 📋 **Resultados de Validación**

### **Archivos Validados:**
1. ⏳ delivery-orders-form.component.scss
2. ⏳ sale-invoices-form.component.scss  
3. ⏳ purchase-invoices-form.component.scss
4. ⏳ incoming-payments-form.component.scss
5. ⏳ outgoing-payments-form.component.scss
6. ⏳ pos.component.scss
7. ⏳ profile.component.scss
8. ⏳ permissions.component.scss

### **Hallazgos:**
- [ ] Sin errores
- [ ] Errores menores encontrados (documentar abajo)
- [ ] Errores críticos encontrados (documentar abajo)

### **Acciones Tomadas:**
- [ ] Ninguna necesaria
- [ ] Arreglos menores aplicados
- [ ] Arreglos críticos aplicados

---

## 🎉 **Finalización**

**Estado:** ⏳ En validación  
**Fecha de inicio:** 2026-07-24  
**Fecha estimada de completación:** 2026-07-24  

**Resultado esperado:** Validación exitosa con 0 regresiones visuales
