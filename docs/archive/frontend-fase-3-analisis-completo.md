# 📋 FASE 3: PATRONES DE CÓDIGO DUPLICADO - ANÁLISIS COMPLETO

**Fecha:** 2026-07-16 · **Estado actualizado:** 2026-07-17
**Objetivo:** Identificar patrones de duplicación después de Fase 1 y Fase 2

---

## 🟢 ESTADO DE EJECUCIÓN (2026-07-17)

| Item | Descripción | Estado |
|------|-------------|--------|
| **3A** | Helper `catchEmpty()` | ✅ DONE — creado en `src/app/shared/rxjs-utils.ts`; reemplaza 23+ instancias de `.pipe(catchError(() => of([])))` en `item-form`, `partner-form`, `item-boms-form`, `delivery-orders-form` |
| **3B** | Helper `loadCatalogs()` | ✅ DONE — en `rxjs-utils.ts` y como método protegido en `DocumentFormBase`; consolida el patrón `Promise.all` + `firstValueFrom` en `partner-form`, `item-form`, `item-boms-form` |
| **3C** | `MasterDataDocumentFormBase` para los 4 forms complejos | ❌ **DESCARTADO** (ver justificación abajo) |

### Por qué 3C se descartó

El análisis original proponía crear una base para `partner-form`, `item-form`, `item-boms-form` y `price-list-form`. Tras evaluarlo:

- **Ya existe `MasterDataFormBase`** (`src/app/shared/master-data-form/master-data-form.base.ts`), usada por los 4 forms maestros **simples** (`account-form`, `asset-category-form`, `fixed-asset-form`, `discount-groups-form`) — hecho en el track v3 Fase 2.
- Los 4 forms objetivo de 3C son los **más complejos** del sistema (469-885 líneas) y **no encajan** en esa base:
  - `item-boms-form` carga por `parentItemId` + `getByParent` (no por `id` + `getOne` como asume la base) y su `save()` hace CRUD por línea.
  - `partner-form`, `item-form`, `price-list-form` tienen `save()` anidado (sub-formularios, variantes, escalas) que no se beneficia de ninguna base de save.
- Forzarlos requeriría tantos `override`s que restaría claridad en vez de sumarla. El ROI es bajo y el riesgo alto.

**Conclusión:** la consolidación de catálogos (3A/3B) ya capturó el valor real de esta fase. Para el resto de forms simples que aún no usen `MasterDataFormBase`, migrarlos individualmente si aparece oportunidad — no como un esfuerzo masivo.

> El detalle de patrones de abajo es el análisis original (2026-07-16), conservado como referencia.

---

## 📊 **INVENTARIO DE COMPONENTES**

### **Total de componentes:**
- **57 componentes form** en `src/app/pages`
- **24 componentes** que heredan de bases (42%)
- **33 componentes** que NO heredan de bases (58%)

### **Bases utilizadas:**
- `CommercialDocumentFormBase` (7 componentes de ventas)
- `PurchaseDocumentFormBase` (6 componentes de compras)
- `DocumentFormBase` (2 componentes de pagos)
- `MasterDataFormBase` (4 componentes master)

---

## 🔍 **PATRONES DE DUPLICACIÓN IDENTIFICADOS**

### **1. Patrón catchError - MÁS CRÍTICO** ⚠️

**Instancias encontradas:** 23+

**Patrón:**
```typescript
.pipe(catchError(() => of([])))
```

**Componentes afectados:**
- **delivery-orders-form:** 8 instancias
- **item-boms-form:** 3 instancias  
- **item-form:** 5 instancias
- **partner-form:** 3 instancias
- **Más componentes:** 4+ instancias

**Ejemplo concreto (item-form):**
```typescript
firstValueFrom(this.groupSvc.getAll().pipe(catchError(() => of([])))),
this.catalogs.taxIndicators$.pipe(catchError(() => of([]))),
this.accountsSvc.getAll().pipe(catchError(() => of([]))),
this.catalogs.warehouses$.pipe(catchError(() => of([]))),
this.catalogs.priceLists$.pipe(catchError(() => of([]))),
```

**Impacto:** ALTO - Patrón repetido en casi todos los componentes con catálogos

---

### **2. Patrón loadCatalogs - MEDIO** ⚠️

**Instancias encontradas:** ~10

**Patrón:**
```typescript
async loadCatalogs() {
  const [catalog1, catalog2, catalog3] = await Promise.all([
    firstValueFrom(this.catalog1$.pipe(catchError(() => of([])))),
    firstValueFrom(this.catalog2$.pipe(catchError(() => of([])))),
    // ...
  ]);
  this.catalog1 = catalog1;
  this.catalog2 = catalog2;
  // ...
}
```

**Componentes afectados:**
- partner-form
- item-form
- item-boms-form
- Y otros sin base class

**Impacto:** MEDIO - Código repetitivo pero menos crítico que catchError

---

### **3. Patrón Validación de Forms - BAJO** ℹ️

**Instancias encontradas:** 74

**Patrón:**
```typescript
if (this.form.invalid) {
  // show error
  return;
}
```

**Impacto:** BAJO - Código simple, poco valor en consolidar

---

### **4. Patrón Toast Handlers - BAJO** ℹ️

**Instancias encontradas:** 23

**Ejemplo:**
```typescript
this.toast.showError('Error saving data');
this.toast.showSuccess('Data saved successfully');
```

**Impacto:** BAJO - Cada toast es específico al contexto

---

## 🎯 **TOP 5 PATRONES PARA FASE 3**

### **#1: catchError Helper** 🔥 **MÁS PRIORITARIO**

**Instancias:** 23+
**Impacto:** ALTO
**Complejidad:** BAJA
**Valor:** ALTO

**Solución:**
```typescript
// Helper en document-form.base.ts
protected catchEmpty<T>(): MonoTypeOperatorFunction<T> {
  return catchError(() => of([] as T));
}

// Uso en componentes:
this.catalogs.taxIndicators$.pipe(this.catchEmpty())
```

**Beneficio:**
- Eliminar 23+ instancias duplicadas
- Código más mantenible
- Patrón consistente

---

### **#2: loadCatalogs Helper** ⚡ **PRIORIDAD MEDIA**

**Instancias:** ~10
**Impacto:** MEDIO  
**Complejidad:** MEDIA
**Valor:** MEDIO

**Solución:**
```typescript
// Helper en document-form.base.ts
protected async loadCatalogs<T>(sources: {[key: string]: Observable<T>}) {
  const entries = Object.entries(sources);
  const results = await Promise.all(
    entries.map(([key, source$]) =>
      firstValueFrom(source$.pipe(this.catchEmpty())).then(data => [key, data])
    )
  );
  
  results.forEach(([key, data]) => {
    this[key] = data;
  });
}

// Uso:
await this.loadCatalogs({
  taxIndicators: this.catalogs.taxIndicators$,
  warehouses: this.catalogs.warehouses$,
  priceLists: this.catalogs.priceLists$,
});
```

---

### **#3: DocumentFormBase para Master Data** 📋

**Componentes sin base:**
- partner-form
- item-form
- item-boms-form
- price-list-form

**Impacto:** MEDIO
**Complejidad:** ALTA
**Valor:** MEDIO-ALTO

**Solución:** Crear `MasterDataDocumentFormBase` con:
- loadCatalogs()
- buildForm()
- validate()
- save()
- Templates comunes

---

### **#4: Validación Helper** ✅

**Prioridad:** BAJA
**Valor:** BAJO
- Helpers simples para validaciones comunes
- Poco impacto real

---

### **#5: Toast Handler Helper** 📢

**Prioridad:** MUY BAJA
**Valor:** MUY BAJO
- Ya es suficientemente simple
- Consolidación no agrega mucho valor

---

## 🚀 **RECOMENDACIÓN PARA FASE 3**

### **Opción A: catchError Helper (Recomendado)** ⚡

**Duración:** 2-3 horas
**Componentes:** ~10
**Líneas eliminadas:** ~50-70
**Impacto:** ALTO

**Por qué:**
- ✅ Patrón OBVIAMENTE duplicado (23+ instancias)
- ✅ Solución SIMPLE (helper de 3 líneas)
- ✅ Impacto INMEDIATO (mejora mantenibilidad)
- ✅ Fácil de validar (misma funcionalidad)

---

### **Opción B: loadCatalogs Helper** 📋

**Duración:** 4-6 horas
**Componentes:** ~8
**Líneas eliminadas:** ~80-100
**Impacto:** MEDIO

**Por qué:**
- ✅ Elimina código repetitivo
- ⚠️ Más complejo que catchError
- ⚠️ Requiere más validación
- ✅ Buen valor a largo plazo

---

### **Opción C: MasterDataDocumentFormBase** 🏗️

**Duración:** 1-2 días
**Componentes:** ~4
**Líneas eliminadas:** ~200-300
**Impacto:** ALTO

**Por qué:**
- ✅ Mayor consolidación
- ⚠️ Requiere arquitectura más compleja
- ⚠️ Más tiempo de validación
- ✅ Valor a largo plazo

---

### **Opción D: Análisis Más Profundo** 🔍

**Duración:** 2-3 horas
**Objetivo:** Buscar patrones más específicos
**Valor:** Depende de descubrimientos

---

## 🎯 **MI RECOMENDACIÓN COMO ARQUITECTO SENIOR**

**OPINO:** **Opción A → Opción B → Opción C**

**Secuencia recomendada:**

1. **Fase 3A: catchError Helper** (2-3 horas)
   - Máximo impacto con mínimo esfuerzo
   - Patrón obviamente duplicado
   - Fácil de validar

2. **Fase 3B: loadCatalogs Helper** (4-6 horas)
   - Siguiente paso natural
   - Construye sobre Fase 3A
   - Buen valor a largo plazo

3. **Fase 3C: MasterDataDocumentFormBase** (1-2 días)
   - Consolidación mayor
   - Requiere más arquitectura
   - Valor a largo plazo

---

## 📋 **CHECKLIST PARA FASE 3**

### **Antes de Fase 3:**
- [ ] Identificar todos los componentes con catchError pattern
- [ ] Crear helper catchEmpty()
- [ ] Validar que no rompe funcionalidad
- [ ] Documentar patrón

### **Durante Fase 3:**
- [ ] Reemplazar catchError(() => of([])) por catchEmpty()
- [ ] Validar cada componente
- [ ] Tests pasan
- [ ] Build OK

### **Post-Fase 3:**
- [ ] Smoke test completo
- [ ] Code review
- [ ] Merge a main
- [ ] Documentar

---

## 🚀 **¿QUÉ QUIERES HACER?**

**A)** **Fase 3A: catchError Helper** (2-3 horas, RECOMENDADO)

**B)** **Fase 3B: loadCatalogs Helper** (4-6 horas)

**C)** **Fase 3C: MasterDataDocumentFormBase** (1-2 días)

**D)** **Análisis más profundo** (2-3 horas)

---

**¿Cuál prefieres?**

---

**NOTA:** Fase 3A es la obvia siguiente paso. Hay 23+ instancias de `.pipe(catchError(() => of([])))` que es un patrón claramente duplicado y fácil de consolidar.

**Recomendación: A) Fase 3A - catchError Helper**
