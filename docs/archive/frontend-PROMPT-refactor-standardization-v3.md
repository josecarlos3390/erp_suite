# Prompt v3: Refactor de estandarización y robustez post-migración async/await

> **Estado (2026-07-17):** track ACTIVO.
> - ✅ **Fase 1** (helper `firstValueFromWithDefault` + 0 warnings de lint).
> - ✅ **Fase 2** (`MasterDataFormBase` aplicada a `account-form`, `asset-category-form`, `fixed-asset-form`, `discount-groups-form`).
> - ✅ **Fase 3** (estandarizar `save()` a `async/await`) — DONE: `user-form` era el único con `switchMap`+`subscribe` (rama create); migrada a `firstValueFrom`. 0 `switchMap` en `src/app/pages`.
> - ✅ **Fase 4** (guarda de concurrencia en `pos.component.ts`) — DONE: `recalculationVersion` aborta recálculos obsoletos tras cada `await`; `onPartnerChange` ignora respuestas HTTP de partners ya no seleccionados.
> - ✅ **Fase 5** (modularizar `document-form-testing.ts`) — DONE: dividido en `factories.ts` / `configure-testing-module.ts` / `flush.ts` + barrel `index.ts`. Los 13 specs que importan `@shared/testing/document-form-testing` siguen pasando sin cambios (1066/1066).
>
> **Pre-requisito cumplido:** la migración `forkJoin` → `async/await` (track v2.1) está completa y mergeada (0 `forkJoin` en `src/app/pages`). El doc de ese track se retiró de `docs/` al ser histórico.
>
> **Nota de consistencia:** en paralelo se añadieron los helpers `catchEmpty()` y `loadCatalogs()` en `src/app/shared/rxjs-utils.ts` (consolidan `.pipe(catchError(() => of([])))` y la carga paralela de catálogos). Solapan conceptualmente con `firstValueFromWithDefault` — al tocar un archivo, unificar hacia uno solo de los dos mecanismos y dejar el otro deprecado.
>
> **Objetivo:** eliminar duplicación, estandarizar patrones y cerrar deuda técnica leve detectada durante la migración.

---

## 1. Contexto del proyecto

- **Proyecto:** `D:\ProyectosPython\erp_suite\erp-frontend`
- **Framework:** Angular 19.2.19, standalone components, OnPush, SSR habilitado.
- **Estado actual:** todos los `forkJoin` de `src/app/pages` fueron migrados a `async/await` + `firstValueFrom`.
- **Deuda técnica detectada:**
  - Cuatro formularios maestros (`account-form`, `asset-category-form`, `fixed-asset-form`, `discount-groups-form`) repiten el mismo patrón de carga.
  - Algunos `save()` aún mezclan `async/await` con `switchMap` + `subscribe`.
  - Se repite el patrón `firstValueFrom(obs).catch(() => [] as T[])` en muchos archivos.
  - `document-form-testing.ts` supera las 700 líneas y mezcla responsabilidades.
  - `pos.component.ts` recalcula precios en `onPartnerChange` sin guarda de concurrencia.
  - Quedan 7 warnings de ESLint preexistentes que no fueron introducidos por la migración.

---

## 2. Objetivo

Aplicar mejoras estructurales de estandarización y robustez **sin cambiar lógica de negocio** ni romper la suite de tests. Las mejoras deben dejar el código más mantenible, uniforme y fácil de testear.

---

## 3. Alcance por fases

### Fase 1 — Helper tipado y limpieza de lint (rápida)

1. Crear helper:
   - `src/app/shared/rxjs/first-value-from-with-default.ts`
   - `export async function firstValueFromWithDefault<T>(obs: Observable<T>, fallback: T): Promise<T>`
2. Reemplazar usos repetidos de `firstValueFrom(...).catch(() => [] as T[])` y `firstValueFrom(...).catch(() => null)` por el helper, **solo en archivos que toques en este prompt**.
3. Corregir los 7 warnings preexistentes de ESLint:
   - `partner-form.component.ts` — `first` sin usar.
   - `purchase-quotations-form.component.ts` — `TaxIndicator` sin usar.
   - `stock-entries-form.component.ts` — `Warehouse` sin usar.
   - `stock-exits-form.component.ts` — `Warehouse` sin usar.
   - `stock-transfers-form.component.ts` — `Warehouse` sin usar.
   - `luna-data-table.component.stories.ts` — `LunaDensity` sin usar.
   - `partner-selector.component.ts` — `eslint-disable` directive sin uso.

### Fase 2 — Base class `MasterDataFormBase` (media)

1. Crear clase abstracta en `src/app/shared/master-data-form/master-data-form.base.ts`.
2. Debe exponer al menos:

   ```ts
   protected abstract buildForm(): FormGroup;
   protected abstract get catalogRequests(): CatalogRequest[];
   protected abstract patchForm(entity: T): void;

   async loadEntity(id: number, svc: { getOne(id: number): Observable<T> }): Promise<void>
   async loadCatalogs(): Promise<void>
   ```

3. Debe manejar unificado:
   - `isLoading`
   - `viewMode` (deshabilitar formulario)
   - `dirtyTracker.track(this.form)`
   - `cdr.detectChanges()` en `finally`
   - error genérico con `toast.error('...')` y `goBack()` opcional
4. Aplicar la base a los formularios maestros que repiten el patrón:
   - `accounts/account-form.component.ts`
   - `asset-categories/asset-category-form.component.ts`
   - `fixed-assets/fixed-asset-form.component.ts`
   - `discount-groups/discount-groups-form.component.ts`
5. Cada formulario hijo solo debe definir:
   - `buildForm()`
   - `catalogRequests`
   - `patchForm(entity)`
   - `save()` (si aplica)

### Fase 3 — Estandarizar todos los `save()` a `async/await` (media)

1. Buscar todos los métodos `save()` en `src/app/pages` que aún usen `switchMap` + `subscribe`.
2. Convertirlos a `async save(): Promise<void>` usando `firstValueFrom`.
3. Patrón canónico:

   ```ts
   async save(): Promise<void> {
     if (this.form.invalid || this.isSaving) return;
     this.isSaving = true;
     try {
       const result = await firstValueFrom(
         this.isEditing && this.id
           ? this.svc.update(this.id, payload)
           : this.svc.create(payload),
       );
       this.toast.success('...');
       this.dirtyTracker.reset(this.form);
       this.router.navigate(['/ruta']);
     } catch (err: unknown) {
       const msg = (err as { error?: { message?: string } }).error?.message ?? 'Error';
       this.toast.error(msg);
     } finally {
       this.isSaving = false;
       this.cdr.detectChanges();
     }
   }
   ```

4. Si el `save()` requiere lógica condicional extra (ej. `user-form` con warehouses), mantenerla dentro del mismo flujo `async/await` con `Promise.all` cuando aplique.

### Fase 4 — Guarda de concurrencia en POS (media)

1. En `pos.component.ts`, agregar una bandera:
   - `private recalculationVersion = 0;`
2. Al inicio de `recalculateCartPrices()`, incrementar la versión y capturarla localmente.
3. Después de cada `await`, verificar que la versión local siga siendo la actual. Si cambió, abortar silenciosamente el flujo anterior.
4. Asegurar que `onPartnerChange()` no inicie múltiples recálculos simultáneos que compitan por mutar `this.cart`.

### Fase 5 — Modularizar `document-form-testing.ts` (media)

1. Mover el archivo actual a `src/app/shared/testing/document-form-testing/index.ts` manteniendo exports compatibles.
2. Dividir en:
   - `factories.ts` — todas las funciones `mockXxx()`.
   - `configure-testing-module.ts` — `configureDocumentFormTestingModule()` y mocks de servicios.
   - `flush.ts` — `flushMicrotasksAndDetect()`.
   - `index.ts` — re-exporta todo para no romper imports existentes.
3. Asegurar que todos los specs que importan desde `@shared/testing/document-form-testing` sigan funcionando sin cambios.

---

## 4. Reglas técnicas obligatorias

### 4.1. Cero cambios de lógica de negocio
Solo estandarizar mecanismos. No modificar comportamiento visible del usuario.

### 4.2. `async/await` canónico
- Todos los métodos que cargan datos o guardan deben ser `async`.
- Usar `firstValueFrom` para observables HTTP one-shot.
- Nunca usar `toPromise()`.

### 4.3. Manejo de errores tipado
```ts
const msg = (err as { error?: { message?: string } }).error?.message ?? 'Error genérico';
```

### 4.4. OnPush
- Después de cualquier flujo `async` que modifique estado, llamar `this.cdr.detectChanges()` en `finally`.
- En suscripciones reactivas que queden (`valueChanges`, etc.), mantener `this.cdr.markForCheck()`.

### 4.5. No romper el API público del helper de testing
Si se modulariza, el `index.ts` debe seguir exportando los mismos símbolos con los mismos nombres.

### 4.6. Tipado estricto
- No usar `any`.
- No relajar `strictNullChecks`.
- Los helpers genéricos deben inferir correctamente el tipo `T`.

---

## 5. Criterio de terminado por fase

### Fase 1
- [x] Existe `firstValueFromWithDefault` y se usa en archivos tocados.
- [x] `npm run lint` pasa con 0 errores y 0 warnings.

### Fase 2
- [x] Existe `MasterDataFormBase` y es usada por al menos los 4 formularios maestros objetivo.
- [x] Cada formulario hijo elimina su `loadCatalogs()`/`loadEntity()` duplicado.
- [x] Los formularios maestros siguen funcionando en modo crear y editar.

### Fase 3
- [x] Todos los `save()` de `src/app/pages` usan `async/await`.
- [x] No quedan `switchMap` + `subscribe` en métodos `save()`.

### Fase 4
- [x] `pos.component.ts` tiene guarda de versión para recálculos.
- [x] Cambiar de partner rápidamente no deja el carrito en estado inconsistente.

### Fase 5
- [x] `document-form-testing.ts` fue dividido en módulos sin romper imports.
- [x] Todos los specs que lo usan siguen pasando.

---

## 6. Criterios de aceptación globales

Antes de declarar terminado:

- [x] `grep -R "forkJoin" src/app/pages` sigue sin resultados.
- [x] `grep -R "toPromise()" src/app/pages` sigue sin resultados.
- [x] `npm run lint` pasa con 0 errores y 0 warnings.
- [x] `npx ng test --watch=false --browsers=ChromeHeadlessCI` pasa con **1066 SUCCESS**.
- [x] `npm run build` pasa con 0 errores.
- [x] No hay cambios de lógica de negocio introducidos.
- [x] Working tree limpio y push exitoso.

> **Track COMPLETO (2026-07-17):** las 5 fases están DONE. Quedan fuera de este track `DocumentSnapshotService` y `DocumentDraftBuilderService` (ver `plan-conservador-seguro.md`).

---

## 7. Estrategia de rollback

- Trabajar una fase a la vez.
- Si una fase no se puede completar en 30 minutos, revertir solo los archivos de esa fase y dejarla para otra sesión.
- No dejar la suite en rojo.
- Commits frecuentes por fase o por componente.

---

## 8. Comandos de verificación obligatorios

```bash
cd D:\ProyectosPython\erp_suite\erp-frontend

# 1. Buscar patrones prohibidos/duplicados
npx grep -R "forkJoin" src/app/pages --include="*.ts"
npx grep -R "toPromise()" src/app/pages --include="*.ts"
npx grep -R "switchMap" src/app/pages --include="*.ts"

# 2. Lint
npm run lint

# 3. Tests
npx ng test --watch=false --browsers=ChromeHeadless

# 4. Build producción
npm run build
```

---

## 9. Archivos de referencia obligatorios

- `FRONTEND_GUIDE.md`
- `src/app/shared/document-form/document-form.base.ts`
- `src/app/shared/document-form/document-catalogs.service.ts`
- `src/app/shared/testing/document-form-testing.ts`
- `src/app/shared/rxjs-utils.ts` (helpers `catchEmpty` / `loadCatalogs`)

---

## 10. Entregable esperado

Al finalizar, el árbol debe contener:

- Helper `firstValueFromWithDefault`.
- Base class `MasterDataFormBase`.
- Formularios maestros refactorizados con la base class.
- Todos los `save()` estandarizados a `async/await`.
- Guarda de concurrencia en POS.
- `document-form-testing` modularizado.
- 0 warnings de lint.
- Prompt v3 actualizado si se detectan desviaciones durante la ejecución.

No agregar dependencias nuevas. No tocar backend.
