# FRONTEND_GUIDE.md — erp-frontend

> Guía única y canónica para el desarrollo frontend del ERP. Cualquier nuevo formulario, listado, o módulo debe seguir estos patrones. 
> **Última actualización:** 2026-07-25 (limpieza y consolidación de documentación).  
> **Scope:** Angular 19.2.19, standalone components, LUNA design system.

---

## Índice

1. [Patrones de diseño canónicos](#1-patrones-de-diseño-canónicos)
2. [Regla crítica: OnPush + Async = markForCheck()](#2-regla-crítica-onpush--async--markforcheck)
3. [Patrón preferido: toSignal()](#3-patrón-preferido-tosignal)
4. [Layout de formularios (LUNA)](#4-layout-de-formularios-luna)
5. [Document Action Bar Standard](#5-document-action-bar-standard)
6. [Header Toolbar (formToolbar)](#6-header-toolbar-formtoolbar)
7. [Selectores modales estándar](#7-selectores-modales-estándar)
8. [Patrón toggle switch](#8-patrón-toggle-switch)
9. [Estándares de tipado](#9-estándares-de-tipado)
10. [Líneas de documento — estándar luna-document-lines](#10-líneas-de-documento--estándar-luna-document-lines)
11. [Checklists](#11-checklists)

---

## 1. Patrones de diseño canónicos

### 1.1. Patrón Ver/Editar en formularios

**Aplicable a:** Todos los formularios de documentos comerciales y datos maestros (excepto items y partners, que usan páginas de detalle).

**Implementación en TypeScript:**

```typescript
export class MyFormComponent implements OnInit {
  viewMode = false;

  ngOnInit() {
    const viewParam = this.route.snapshot.queryParamMap.get('view');
    this.viewMode = viewParam === '1' || viewParam === 'true';
    // ... resto del init
  }

  // Después de cargar datos:
  if (this.viewMode) {
    this.form.disable({ emitEvent: false });
  }

  enterEditMode(): void {
    if (!this.id) return;
    this.router.navigate(['/ruta-del-formulario', this.id]);
  }
}
```

**Si hereda de `DocumentFormBase`:**
```typescript
export class MyFormComponent extends DocumentFormBase implements OnInit {
  override viewMode = false;
  override applyEditRestrictions(): void {
    this.form.disable({ emitEvent: false });
  }
}
```

**En el template HTML (header):**
```html
@if (id && viewMode) {
  <luna-button formToolbar variant="primary" action="edit" text="Editar"
    (lunaClick)="enterEditMode()"></luna-button>
}
```

**En el template HTML (action bar):**
```html
@if (!viewMode) {
  <luna-button variant="primary" (lunaClick)="save()">Guardar</luna-button>
}
```

**En el listado (navegación):**
```typescript
goView(row: MyEntity) {
  this.router.navigate(['/ruta-del-formulario', row.id, 'edit'], {
    queryParams: { view: 1 }
  });
}

goEdit(row: MyEntity) {
  this.router.navigate(['/ruta-del-formulario', row.id, 'edit']);
}
```

---

### 1.2. Patrón de botones en listados

**Reglas (NO negociables):**

| # | Regla | Por qué |
|---|-------|---------|
| 1 | **Solo un botón visible por fila**: el **ojo** (`action="view"`). | Reduce clutter visual |
| 2 | **Editar SIEMPRE va dentro del `luna-menu`**. | Mantiene acción principal destacada |
| 3 | **Cancelar/Eliminar/Cerrar SIEMPRE van dentro del menú**. | Acciones destructivas agrupadas |
| 4 | **El `rowClick` de la tabla navega a Ver** (modo solo lectura). | Consistente con el ojo |
| 5 | **El trigger del menú (`⋯`) solo se muestra cuando hay acciones disponibles**. | Evita menús vacíos |

**Implementación canónica:**

```html
<ng-template #actions let-row>
  <luna-button action="view" variant="secondary" size="sm"
    (lunaClick)="goView(row); $event.stopPropagation()"></luna-button>

  <luna-menu [(open)]="menuOpen[row.id]">
    <luna-button lunaMenuTrigger variant="ghost" size="sm" action="moreHorizontal"
      [style.visibility]="
        (row.status === 'OPEN' || canCancel(row)) && processingId !== row.id
          ? 'visible' : 'hidden'"></luna-button>

    @if (row.status === 'OPEN') {
      <button type="button" class="luna-menu__item row-item" lunaMenuItem
        (click)="goEdit(row); $event.stopPropagation()">
        <span class="item-icon"><luna-action-icon action="edit"></luna-action-icon></span>
        Editar
      </button>
    }

    @if (canCancel(row) && processingId !== row.id) {
      <div class="row-divider"></div>
      <button type="button" class="luna-menu__item row-item item-danger" lunaMenuItem
        [disabled]="processingId === row.id" (click)="cancel(row); $event.stopPropagation()">
        <span class="item-icon"><luna-action-icon action="close"></luna-action-icon></span>
        Cancelar
      </button>
    }
  </luna-menu>
</ng-template>
```

**En el componente TS:**
```typescript
menuOpen: Record<number, boolean> = {};
```

### 1.2.1. Barra de filtros

El buscador **nunca** debe estar envuelto en `.filter-field` con `<label>`. El `leadingAction="search"` del `luna-input` ya actúa como label visual; envolverlo genera un label extra, doble fondo/borde y desalineación.

**Patrón correcto:**

```html
<div class="filter-bar">
  <!-- Buscador: SIN .filter-field, SIN <label> -->
  <div class="filter-search">
    <luna-input
      type="text"
      [(ngModel)]="search"
      placeholder="Buscar..."
      leadingAction="search"
      [clearable]="true"
      (cleared)="clearSearch()"
    ></luna-input>
  </div>

  <!-- Filtros adicionales: CON .filter-field + <label> -->
  <div class="filter-group">
    <div class="filter-field">
      <label>Estado</label>
      <luna-select ...></luna-select>
    </div>
    <div class="filter-field">
      <label>Fecha</label>
      <luna-input type="date" ...></luna-input>
    </div>
  </div>
</div>
```

**Reglas:**

- El buscador vive en `<div class="filter-search">`, hermano de `<div class="filter-group">`.
- El buscador no lleva `<label>` explícito.
- Los demás filtros sí usan `<div class="filter-field">` con `<label>` arriba.
- No duplicar estilos globales de `.filter-bar`, `.filter-group`, `.filter-field` ni `.filter-search` en componentes locales; ya existen en `src/styles/_layout.scss` y `src/styles/_lists.scss`.
- Si se necesita ajustar el ancho del buscador, mantener proporciones: `flex: 1 1 0`, `min-width: 180px`, `max-width: 240px`, `align-self: flex-end`.

---

### 1.3. Protección de UI por permisos

**Implementación:**

```typescript
private auth = inject(AuthService);
canEdit = false;

ngOnInit() {
  this.canEdit = this.auth.permissions.includes('mi-modulo:edit');
  if (!this.canEdit) {
    this.form.disable({ emitEvent: false });
  }
}
```

```html
<!-- Banner informativo cuando no se puede editar -->
@if (!canEdit) {
  <div class="info-banner info-warning">
    <luna-action-icon action="lock"></luna-action-icon>
    <span><strong>Modo solo lectura:</strong> No tienes permisos para editar.</span>
  </div>
}

<!-- Ocultar botón guardar -->
@if (hasChanges && canEdit) {
  <luna-button variant="primary" (lunaClick)="save()">Guardar cambios</luna-button>
}
```

**Convenio de permisos por módulo:**

| Módulo | Permiso de view | Permiso de edit |
|--------|-----------------|-----------------|
| Documentos comerciales | `sales-orders:view`, etc. | `sales-orders:edit`, etc. |
| Datos maestros | `accounts:view`, etc. | `accounts:edit`, etc. |
| Settings | `settings:view` | `settings:edit` |
| Permisos | `permissions:view` | `permissions:edit` |

---

### 1.4. Base classes para documentos

**`DocumentFormBase` (abstracta):**
```typescript
export abstract class DocumentFormBase {
  viewMode = false;
  abstract enterEditMode(): void;
  abstract applyEditRestrictions(): void;
}
```

**`CommercialDocumentFormBase` (extiende `DocumentFormBase`)** — para documentos comerciales con líneas, totales, impuestos.

**`DocumentListBase<T>` (abstracta):**
```typescript
export abstract class DocumentListBase<T> {
  protected router = inject(Router);
  menuOpen: Record<number, boolean> = {};
  // paginación, filtros, búsqueda
}
```

---

### 1.5. Datos maestros vs comerciales

**Datos maestros con página de detalle (items, partners, assembly-orders):**
- No usan `viewMode` en el formulario.
- `goView` navega a página de detalle; `goEdit` navega al formulario.

**Datos maestros sin página de detalle (accounts, banks, branches, etc.):**
- Usan el patrón Ver/Editar **dentro del mismo formulario** (`viewMode` + `queryParams: { view: 1 }`).

**Documentos comerciales (ventas, compras, stock, pagos, contabilidad):**
- Siempre usan el patrón Ver/Editar dentro del formulario. No hay páginas de detalle separadas.

---

## 2. Regla crítica: OnPush + Async = markForCheck()

> **Contexto:** Todos los componentes de formularios de documentos usan `ChangeDetectionStrategy.OnPush`. En esta estrategia, Angular **no** refresca la vista automáticamente cuando una suscripción asíncrona modifica el estado del componente.

### Patrón obligatorio

Toda suscripción en `ngOnInit` que modifique propiedades usadas en el template DEBE terminar con `this.cdr.markForCheck();`:

```typescript
// ✅ CORRECTO
forkJoin({
  partners: this.partnersService.getAllClients(),
  items: this.itemsService.getAll({ ... }),
}).subscribe(({ partners, items }) => {
  this.partners = partners;
  this.catalogItems = items;
  this.isLoading = false;
  this.cdr.markForCheck();   // ← OBLIGATORIO en OnPush
});

// ✅ CORRECTO — subscribe separados
this.itemsService.getAll({ ... }).subscribe((items) => {
  this.catalogItems = items;
  this.cdr.markForCheck();   // ← OBLIGATORIO
});

// ✅ CORRECTO — path de error también
this.partnersService.getAll().subscribe({
  next: (partners) => {
    this.partners = partners;
    this.cdr.markForCheck();
  },
  error: () => {
    this.partners = [];
    this.cdr.markForCheck();   // ← OBLIGATORIO (el skeleton sigue visible)
  },
});
```

### Excepciones (donde NO es necesario)

| Situación | Razón |
|-----------|-------|
| `valueChanges` de un `FormGroup` | Angular maneja la detección de cambios de formularios reactivos internamente |
| `router.events` con `takeUntilDestroyed` | Los eventos de router disparan change detection global |
| Métodos que solo navegan (`this.router.navigate`) | No hay estado visual que actualizar |

### Anti-patrón letal: `setTimeout` + OnPush

```typescript
// ❌ INCORRECTO — la UI nunca se actualiza
ngOnInit() {
  setTimeout(() => this.load(), 0);   // fuera de NgZone
}

load() {
  this.loading = true;
  this.cdr.markForCheck();            // Angular NO ejecuta el ciclo porque
                                      // el callback corre fuera de NgZone
  this.http.get(...).subscribe((data) => {
    this.items = data;
    this.loading = false;
    this.cdr.markForCheck();          // igualmente ignorado
  });
}
```

**Solución:** Nunca usar `setTimeout` para posponer carga de datos en `OnPush`. Llamar directamente desde `ngOnInit`.

```typescript
// ✅ CORRECTO — dentro de NgZone
ngOnInit() {
  this.load();
}
```

---

### Cuándo usar `detectChanges()` en lugar de `markForCheck()`

`markForCheck()` marca la rama como sucia y Angular la revisará en el **próximo ciclo** de detección. Eso es suficiente cuando el cambio viene de una suscripción async (la zona dispara el ciclo).

`detectChanges()` fuerza un ciclo de detección **inmediato** en el componente y sus hijos. Usarlo cuando:

| Escenario | Por qué `detectChanges()` | Ejemplo |
|-----------|---------------------------|---------|
| `ControlValueAccessor.writeValue()` | El formulario padre llama `writeValue` síncronamente; sin render inmediato el selector no muestra el valor seleccionado. | Selectores modales LUNA |
| Handler síncrono que cambia el DOM | Se necesita que la UI refleje el cambio antes de que termine el evento. | Cambio de impuesto en línea de documento |
| Validación/visibilidad condicional tras mutar el formulario | Se requiere que Angular re-evalúe `@if` / `[disabled]` inmediatamente. | Mostrar/ocultar botón eliminar en pestaña |

#### Ejemplo: selector modal

```typescript
writeValue(value: number | null): void {
  this.selectedId = value;
  if (value) {
    this.resolveLabel(value).then(() => this.cdr.detectChanges());
  } else {
    this.label = this.placeholder;
    this.cdr.detectChanges();
  }
}
```

#### Ejemplo: cambio de impuesto en línea de documento

```typescript
onLineTaxChange(index: number): void {
  const line = this.itemsArray.at(index);
  const taxInd = this.taxIndicators.find(t => t.id === line.get('taxIndicatorId')?.value);
  line.patchValue({ taxRate: taxInd?.rate ?? 0 }, { emitEvent: false });
  this.recalculateLineTotal(index);
  this.cdr.detectChanges(); // ← render inmediato del total de la línea y del documento
}
```

#### Regla mnemotécnica

- ¿El cambio viene de una suscripción HTTP/WebSocket? → `markForCheck()`.
- ¿El cambio viene de un evento síncrono que debe reflejarse **ahora**? → `detectChanges()`.

---

## 3. Patrón preferido: toSignal()

> **Contexto:** Angular 16+ introduce Signals como sistema reactivo granular. `toSignal()` convierte un `Observable` en un `Signal` que Angular monitorea automáticamente. En componentes `OnPush`, un Signal elimina la necesidad de `markForCheck()`, `takeUntilDestroyed()` y suscripciones manuales.

**Regla:** en componentes **nuevos** (no refactorizar existentes), preferir `toSignal()` sobre suscripciones manuales.

### Ejemplo: antes vs. después

**ANTES** (suscripción manual + `markForCheck`):
```typescript
export class ItemsComponent implements OnInit {
  items: Item[] = [];
  loading = true;
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.svc.getItems()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => { this.items = list; this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.cdr.markForCheck(); },
      });
  }
}
```

**DESPUÉS** (`toSignal`):
```typescript
import { toSignal } from '@angular/core/rxjs-interop';

export class ItemsComponent {
  private svc = inject(ItemsService);
  items = toSignal(this.svc.getItems(), { initialValue: [] as Item[] });
}
```

Template: `@for (item of items(); track item.id) { ... }`

### Cuándo NO usar `toSignal`

| Situación | Razón | Alternativa |
|-----------|-------|-------------|
| Side effects (navegar, toast, logout) | Signals solo leen datos; no ejecutan lógica | `.subscribe()` normal |
| Observable que se re-crea | Requiere `injector` explícito | `.subscribe()` o `toSignal(obs, { injector })` |
| Eventos de usuario (click, keyup) | No vienen de HTTP | Callbacks o `output()` |
| Refactor de componentes existentes | Alto riesgo de regresión | Dejar como está |

### `computed()` para valores derivados

```typescript
import { toSignal, computed } from '@angular/core/rxjs-interop';

export class InvoiceFormComponent {
  private svc = inject(InvoiceService);
  invoice = toSignal(this.svc.getById(this.id), { initialValue: null });
  total = computed(() => this.invoice()?.lines.reduce((s, l) => s + l.total, 0) ?? 0);
  hasDiscount = computed(() => (this.invoice()?.discount ?? 0) > 0);
}
```

### `signal()` y `computed()` en código nuevo (sin migrar existentes)

Esta guía **no es una migración**: el código existente con RxJS + `takeUntilDestroyed` está bien y no se toca. En código **nuevo**, la regla es:

| Situación | Usar | Por qué |
|---|---|---|
| Estado local simple de UI (tab activa, término de búsqueda, flag de modal) | `signal()` | Sin boilerplate de suscripción; lectura síncrona en cualquier lado |
| Valor derivado de otros estados | `computed()` | Se recalcula solo; sin `subscribe` manual ni `markForCheck` |
| Estado de servicio compartido (ej. panel abierto) | `signal()` | Los consumidores reaccionan automáticamente |
| Stream async: HTTP, `valueChanges`, websockets | RxJS | Son secuencias; signals no modelan "flujo de eventos en el tiempo" |
| Combinar múltiples fuentes async / debounce / switchMap | RxJS | Es lo que RxJS resuelve mejor |
| Reaccionar a un observable en un componente (1 suscripción) | RxJS + `takeUntilDestroyed` o `toSignal()` | `toSignal` puentea el observable a signal sin subscribe manual |

Regla rápida: **estado = signal; flujo de eventos = RxJS.** Si dudás, quedate con RxJS (es el default seguro del proyecto).

```typescript
// ✅ signal para estado local de UI
query = signal('');
activeTabId = signal('all');
favoriteCount = computed(() => this.help.favoriteIds().size);
```

#### Interoperabilidad

- **Observable → signal:** `toSignal(obs, { requireSync?: true })` (`@angular/core/rxjs-interop`). Útil para consumir un servicio que expone un observable sin escribir `subscribe`.
- **signal → observable:** `toObservable(signal)` cuando necesites operadores RxJS sobre un estado signal.
- **OnPush:** las signals integran con `ChangeDetectionStrategy.OnPush` automáticamente. Si el componente muta estado dentro de un callback async, la signal igual dispara la detección; igualmente, mantened `cdr.detectChanges()` en `finally` de flujos async que muten colecciones (las signals no reemplazan la detección cuando se muta el contenido de un array existente sin reasignar).

#### Qué NO hacer

- **No migrar RxJS existente a signals "de paso".** Cambio de estructura y cambio de lógica en el mismo PR hacen imposible aislar la causa de un bug.
- **No usar signals para modelar flujos de eventos** (HTTP, websockets, debounce). Ahí RxJS es la herramienta correcta.
- **No mezclar `markForCheck()` manual con signals** para el mismo estado: o es signal (se auto-detecta) o es campo plano + `markForCheck`, no ambos.

---

## 4. Layout de formularios (LUNA)

### Estructura canónica

```html
<luna-form-page>
  <app-document-form-header lunaFormHeader (back)="goBack()">
    <h2 formTitle>{{ isEditing ? (viewMode ? 'Ver entidad' : 'Editar entidad') : 'Nueva entidad' }}</h2>
  </app-document-form-header>

  <form [formGroup]="form" (ngSubmit)="save()" class="luna-form-page__body" novalidate>
    <luna-form-section title="Información general">
      <luna-form-row [columns]="3">
        <!-- campos -->
      </luna-form-row>
    </luna-form-section>
  </form>

  <app-document-action-bar lunaFormActions (back)="goBack()">
    @if (!viewMode) {
      <luna-button variant="primary" (lunaClick)="save()">Guardar</luna-button>
    }
  </app-document-action-bar>
</luna-form-page>
```

### Reglas de layout

- Todo formulario nuevo debe usar `<luna-form-page>` como contenedor raíz.
- Agrupar campos relacionados en `<luna-form-section>`.
- Usar `<luna-form-row [columns]="N">` para alinear controles; **no** escribir grids custom en SCSS de página.
- `lunaFormHeader` y `lunaFormActions` se aplican **directamente** sobre los componentes proyectables. No envolverlos en `<div>` ni `<ng-container>`.
- Densidad: `density="compact | comfortable | spacious"` (default `comfortable`).

### Componentes de layout LUNA

| Componente | Selector | Uso |
|------------|----------|-----|
| `LunaFormPageComponent` | `<luna-form-page>` | Contenedor raíz. Slots `lunaFormHeader` / `lunaFormActions`. |
| `LunaFormSectionComponent` | `<luna-form-section>` | Tarjeta de sección con `title`, `hint`, `status`. |
| `LunaFormRowComponent` | `<luna-form-row>` | Fila grid configurable (`columns` 1-4, `gap` sm/md/lg). |
| `LunaFormFieldComponent` | `<luna-form-field>` | Wrapper `label + hint + error` para controles custom. |
| `LunaFormTabsComponent` | `<luna-form-tabs>` | Pestañas accesibles unificadas. |

---

## 5. Document Action Bar Standard

### Ubicación

La barra debe vivir **dentro del `<form>`**, justo antes del cierre `</form>`. Esto permite que el botón principal use `type="submit"` y que el formulario maneje `(ngSubmit)`.

```html
<form [formGroup]="form" (ngSubmit)="save()" class="luna-form-page__body" novalidate>
  <!-- ... contenido ... -->

  <app-document-action-bar lunaFormActions (back)="goBack()">
    <!-- botones -->
  </app-document-action-bar>
</form>
```

### Slots obligatorios

| Slot | Posición | Qué va ahí | Ejemplo |
|------|----------|------------|---------|
| `[start]` | Izquierda, junto a "Volver" | Botón principal de creación/confirmación y menú "Copiar a" | `Crear Pedido`, `Guardar cambios`, `Copiar a` |
| `[actions]` | Centro-derecha | Acciones contextuales secundarias | `Recalcular líneas`, `Distribuir automáticamente` |
| `[end]` | Extremo derecho | "Guardar borrador" y menú "⋮" | `Guardar borrador`, `⋮` |

### Botón principal "Crear [Documento]"

- Siempre usa `type="submit"`.
- Nunca use `(lunaClick)="save()"` en el botón principal.
- El formulario debe tener `(ngSubmit)="save()"`.

```html
<luna-button start="" variant="primary" type="submit"
  [disabled]="form.invalid || isSaving">
  {{ isSaving ? 'Guardando...' : 'Crear Pedido' }}
</luna-button>
```

### Menú "Copiar a"

- Va en slot `[start]`.
- Usa `<luna-menu>` con `align="left"` y `[teleport]="false"`.
- El botón disparador usa `lunaMenuTrigger`, `action="chevronDown"`, `iconPosition="right"`.
- Cada ítem usa `class="dropdown-item"`, `[fullWidth]="true"` y `<span class="item-text">` con `<strong>` + `<small>`.

```html
<luna-menu start [(open)]="copyMenuOpen" align="left" [teleport]="false"
  menuClass="document-menu-dropdown">
  <luna-button lunaMenuTrigger variant="primary" size="md"
    action="chevronDown" iconPosition="right" text="Copiar a"></luna-button>
  <luna-button class="dropdown-item" variant="ghost" size="md" [fullWidth]="true"
    (lunaClick)="createDelivery()">
    <span class="item-icon"><luna-action-icon action="truck"></luna-action-icon></span>
    <span class="item-text"><strong>Entrega</strong><small>Crea una entrega desde este pedido.</small></span>
  </luna-button>
</luna-menu>
```

### Menú "⋮" de acciones (cerrar / cancelar / backorder)

- Va en slot `[end]`.
- Usa `<luna-menu>` con `align="right"` y `[teleport]="false"`.
- Acciones destructivas: `class="dropdown-item item-danger"`.
- Acciones de cierre: `class="dropdown-item item-warning"`.
- Acciones positivas: `class="dropdown-item item-primary"`.

```html
<luna-menu end [(open)]="moreMenuOpen" align="right" [teleport]="false"
  menuClass="document-menu-dropdown">
  <luna-button lunaMenuTrigger variant="ghost" size="sm" action="moreHorizontal"></luna-button>
  <luna-button class="dropdown-item item-danger" variant="ghost" size="md" [fullWidth]="true"
    (lunaClick)="cancel()">
    <span class="item-icon"><luna-action-icon action="close"></luna-action-icon></span>
    <span class="item-text"><strong>Cancelar documento</strong><small>Esta acción no se puede deshacer.</small></span>
  </luna-button>
</luna-menu>
```

### Fix: ítems de dropdown con texto largo

En `src/styles/_buttons.scss`, dentro de `.more-dropdown`:

```scss
.more-dropdown {
  .dropdown-item, .dropdown-item .luna-btn, .dropdown-item .item-text,
  .dropdown-item .item-text strong, .dropdown-item .item-text small {
    white-space: normal !important;
  }
  .dropdown-item .luna-btn {
    align-items: flex-start;
    height: auto !important;
    min-height: 44px;
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .dropdown-item .item-text {
    display: flex; flex-direction: column; gap: 2px;
    max-width: 100%; min-width: 0;
  }
  .dropdown-item .item-text strong, .dropdown-item .item-text small {
    display: block; width: 100%; word-break: break-word; overflow-wrap: break-word; hyphens: auto;
  }
}
```

---

## 6. Header Toolbar (formToolbar)

### Arquitectura

```
┌─ app-document-form-header ─────────────────────────┐
│  ┌─ form-title-group ─┐    ┌─ form-header-right ─┐│
│  │  < Volver | Título │    │ [formToolbar]       ││
│  └────────────────────┘    │ [formStatus]        ││
│                            └─────────────────────┘│
└────────────────────────────────────────────────────┘
```

- **`[formTitle]`** — título del documento (`<h2>`).
- **`[formToolbar]`** — iconos de acción secundarias (asiento preliminar, exportar, etc.).
- **`[formStatus]`** — badge de estado (`Abierta`, `Cerrada`, etc.).

### Cómo agregar un nuevo icono al toolbar

1. Crear el componente standalone (o reutilizar uno existente). Debe ser un icono de ~16×16 px con `title` para tooltip nativo.
2. Proyectarlo en el formulario dentro de `<app-document-form-header>`:

```html
<app-document-form-header (back)="goBack()">
  <h2 formTitle>Nueva Factura</h2>
  <app-journal-entry-preview-toolbar-button
    formToolbar [documentType]="'SALE_INVOICE'" [documentId]="invoiceId" [previewForm]="form">
  </app-journal-entry-preview-toolbar-button>
  <span formStatus class="status-badge status-open">Abierta</span>
</app-document-form-header>
```

3. Importar el componente en el `*.component.ts` del formulario.

### Reglas de estilo

Los estilos viven en `src/styles/_forms.scss`:

| Clase | Comportamiento |
|-------|----------------|
| `.form-header-right` | `display: flex; gap: 12px;` alinea toolbar + status. |
| `.form-toolbar` | `display: flex; gap: 4px;` apila iconos horizontalmente. |
| `.form-toolbar .btn-icon` | Botón cuadrado ~32×32 px, color muted, sin fondo. Hover → `bg-hover` + `text-primary`. Disabled → `opacity: 0.4`. |

### ¿Qué NO poner en el toolbar?

| Acción | Dónde va | Razón |
|--------|----------|-------|
| Guardar borrador | `document-action-bar` → slot `[end]` | Acción primaria del documento |
| Confirmar / Crear | `document-action-bar` → slot `[end]` | Botón principal con peso visual |
| Recalcular líneas | `document-action-bar` → slot `[actions]` | Acción contextual del formulario |
| Asiento preliminar | `document-form-header` → `[formToolbar]` | Utility de solo lectura |
| Exportar PDF | `document-form-header` → `[formToolbar]` | Utility de salida |
| Imprimir layout | `document-form-header` → `[formToolbar]` | Utility de salida |

---

## 7. Selectores modales estándar

> **Estado actual (2026-07-25):** los selectores del ERP se migraron a envoltorios sobre `<luna-entity-select>`. La sección anterior (prefijos `acc-`, `ws-`, etc. y markup propio) quedó obsoleta; el markup y la lógica de modal/búsqueda/lista viven ahora en el componente genérico de LUNA.

### Arquitectura actual

Existen dos familias de selectores:

1. **Selectores con lista por `@Input`** — el componente padre carga y pasa el catálogo.
   - Ejemplos: `account-selector`, `warehouse-selector`, `item-selector`, `bank-selector`.
   - Responsabilidades del wrapper:
     - Recibir `[items]` (o `[accounts]`, `[warehouses]`, etc.) por `@Input`.
     - Implementar `ControlValueAccessor`.
     - Recuperar el item preseleccionado si no está en la lista (ej. inactivo, o el padre cargó el documento después del selector).

2. **Selectores async** — el selector carga su propia lista por HTTP.
   - Ejemplos: `branch-selector`, `employee-selector`, `payment-term-selector`, `sales-person-selector`, `uom-selector`, `user-selector`.
   - Extienden `AsyncEntitySelectorBase<T>` (`src/app/shared/async-entity-selector-base/`).
   - Solo requieren implementar `fetchList()` y `fetchOne(id)`.

### Contrato común

Todo selector debe:

```typescript
/** Modo compacto: para celdas de tabla / líneas de documento. */
@Input() compact = false;

/** Placeholder del trigger. */
@Input() placeholder = 'Buscar...';

/** Título del modal. */
@Input() title = 'Seleccionar';

/** Solo lectura. */
@Input() readonly = false;
```

Y exponer `@Output() <entity>Selected` cuando el consumidor necesite el objeto completo (no solo el id).

### ControlValueAccessor y detección de cambios

Todos los selectores usan `ChangeDetectionStrategy.OnPush`. Como la carga de datos y los `writeValue()` pueden venir de `HttpClient` con `withFetch()` (no zone-aware), se requiere `detectChanges()` para forzar el render inmediato.

```typescript
writeValue(id: number | null): void {
  this.value = id ?? null;
  this.ensureSelectedResolved();
  this.cdr.detectChanges();   // ← inmediato, no markForCheck()
}
```

En suscripciones async (carga inicial o recuperación de item ausente) también se usa `detectChanges()`:

```typescript
this.fetchList().subscribe((list) => {
  this.items = list ?? [];
  this.listLoaded = true;
  this.handlePreselectedMissing();
  this.cdr.detectChanges();
});
```

### Recuperación de preseleccionados ausentes

Cuando un documento se carga en modo ver/editar, `writeValue()` puede llegar con un id que aún no está en la lista del selector (item inactivo, lista no cargada, etc.). El selector **no debe dejar el campo vacío para siempre**.

- **Selectores async:** `AsyncEntitySelectorBase.handlePreselectedMissing()` llama a `fetchOne(id)` y agrega el item a `items`.
- **Selectores por `@Input`:** cada wrapper implementa su propia lógica (ver `warehouse-selector.component.ts` como referencia: `ensureSelectedResolved()` usa `WarehousesService.getOne()`).

### Selectores async — patrón mínimo

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-branch-selector',
  imports: [FormsModule, LunaEntitySelectComponent],
  templateUrl: './branch-selector.component.html',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => BranchSelectorComponent),
    multi: true,
  }],
})
export class BranchSelectorComponent
  extends AsyncEntitySelectorBase<Branch>
  implements OnInit
{
  protected cdr = inject(ChangeDetectorRef);
  protected destroyRef = inject(DestroyRef);
  private svc = inject(BranchesService);

  protected fetchList() {
    return this.svc.getAll();
  }

  protected fetchOne(id: number) {
    return this.svc.getOne(id);
  }
}
```

Template típico:

```html
<luna-entity-select
  [(ngModel)]="value"
  [items]="items"
  [placeholder]="placeholder"
  [title]="title"
  [compact]="compact"
  [readonly]="readonly"
  [disabled]="isDisabled"
  [searchFn]="searchFn"
  [filterFn]="filterFn"
  [getKey]="getKey"
  [getLabel]="getLabel"
  (selectionChange)="onValueChange($event)">
</luna-entity-select>
```

### Selectores por `@Input` — patrón mínimo

```typescript
@Component({...})
export class WarehouseSelectorComponent implements ControlValueAccessor, OnChanges {
  @Input() warehouses: Warehouse[] = [];
  @Input() branchId: number | null = null;
  @Input() compact = false;

  value: number | null = null;
  private resolvedMissing: Warehouse | null = null;

  get displayItems(): Warehouse[] {
    if (this.resolvedMissing && !this.warehouses.some(w => w.id === this.resolvedMissing!.id)) {
      return [...this.warehouses, this.resolvedMissing];
    }
    return this.warehouses;
  }

  writeValue(id: number | null): void {
    this.value = id ?? null;
    this.resolvedMissing = null;
    this.ensureSelectedResolved();
    this.cdr.detectChanges();
  }

  private ensureSelectedResolved(): void {
    if (this.value == null) return;
    if (this.warehouses.some(w => w.id === this.value)) return;
    this.svc.getOne(this.value)
      .pipe(catchError(() => of(null)))
      .subscribe(w => {
        if (w && w.id === this.value) {
          this.resolvedMissing = w;
          this.cdr.detectChanges();
        }
      });
  }
}
```

### Lista de selectores vigentes

| Selector | Origen de datos | Notas |
|----------|-----------------|-------|
| `account-selector` | `@Input` `[accounts]` | Filtra por `level`, recupera por id |
| `bank-selector` | `@Input` `[banks]` | — |
| `branch-selector` | Async (`AsyncEntitySelectorBase`) | — |
| `cost-center-selector` | `@Input` `[costCenters]` | — |
| `currency-selector` | `@Input` `[currencies]` | — |
| `employee-selector` | Async | — |
| `invoice-selector` | `@Input` `[invoices]` | — |
| `item-group-selector` | `@Input` `[itemGroups]` | — |
| `item-selector` | `@Input` `[items]` | — |
| `partner-group-selector` | `@Input` `[partnerGroups]` | — |
| `partner-selector` | Custom | Selector propio de partner |
| `payment-term-selector` | Async | Auto-selecciona default si aplica |
| `price-list-selector` | `@Input` `[priceLists]` | — |
| `project-selector` | `@Input` `[projects]` | — |
| `sales-person-selector` | Async | Notifica al padre si el preseleccionado no existe |
| `tax-indicator-selector` | `@Input` `[taxIndicators]` | Usado en líneas de documento |
| `uom-selector` | Async | — |
| `user-selector` | Async | Notifica al padre si el preseleccionado no existe |
| `warehouse-selector` | `@Input` `[warehouses]` | Filtra por `branchId`, recupera por id |

### Anti-patrón a evitar

- **No duplicar markup de modal/búsqueda/lista** en cada selector. Usar `<luna-entity-select>`.
- **No usar `markForCheck()` solo en `writeValue()`** de un selector; puede no renderizar si el padre no dispara un tick de CD.
- **No dejar el selector vacío** cuando el valor preseleccionado no está en la lista inicial; recuperarlo vía `fetchOne()` / `getOne()`.

### Change detection en handlers del formulario padre

Cuando un selector de cabecera dispara la carga de datos dependientes (por ejemplo, cambiar el partner actualiza condición de pago, vendedor y datos de contacto), el handler del formulario padre debe forzar change detection al finalizar. De lo contrario, los selectores dependientes pueden quedar desactualizados en componentes `OnPush`.

```typescript
onPartnerSelected(partner: Partner | null): void {
  this.selectedPartner = partner;
  this.applyPartnerDefaults(partner);   // muta el FormGroup
  // ... recálculos de líneas si aplica ...
  this.cdr.detectChanges();             // ← refresca selectores de cabecera inmediatamente
}
```

Regla: si el handler muta el `FormGroup` o propiedades usadas por selectores del template, termina con `this.cdr.detectChanges()`. Esto es complementario al `detectChanges()` interno del selector: el selector se encarga de su propio label/lista, y el formulario padre se encarga de propagar el cambio a los demás controles.

---

## 8. Patrón toggle switch

Los toggles usan el componente visual definido en `styles/_forms.scss`. **No** inventar clases propias ni estilos inline.

```html
<label class="toggle-row" [class.toggle-row--active]="form.get('isActive')?.value">
  <div class="toggle-content">
    <span class="toggle-label">Activo</span>
    <span class="toggle-hint">Descripción opcional del toggle.</span>
  </div>
  <div class="toggle-wrap">
    <input type="checkbox" class="toggle-input" formControlName="isActive" />
    <span class="toggle-switch"></span>
  </div>
</label>
```

### Reglas

| Clase | Uso |
|-------|-----|
| `.toggle-row` | Contenedor flex. Envuelve contenido + switch. `cursor: pointer` y hover. |
| `.toggle-row--active` | Clase dinámica cuando el toggle está activo. Cambia fondo y borde a primary. |
| `.toggle-content` | Columna flex con título + hint. Ocupa el espacio restante. |
| `.toggle-label` | Título del toggle (`font-weight: 600`). |
| `.toggle-hint` | Descripción pequeña (`font-size: 12.5px`, `color: muted`). |
| `.toggle-wrap` | Contenedor del input + switch. `flex-shrink: 0`. |
| `.toggle-input` | Checkbox real. `position: absolute; opacity: 0;`. El estado `:checked` estiliza el `.toggle-switch` adyacente. |
| `.toggle-switch` | El switch visual (barra redondeada + knob). No requiere JavaScript. |

---

## 9. Estándares de tipado

### Política de `any`

| Situación | Qué hacer |
|-----------|-----------|
| Modelo de dominio le falta un campo que el backend envía | **Agregar el campo opcional al interface** en vez de `(line as any).baseDocType` |
| Builder de líneas recibe objetos heterogéneos | Usar `unknown` + `Record<string, unknown>` + bracket access |
| Callback genérico de tabla (`format`, `badgeVariant`) | **Excepción aceptada:** `any` permitido solo en `LunaColumn.format` y `LunaColumn.badgeVariant` |
| Errores HTTP (`err?.error?.message`) | Tipar `error` como `unknown`, castear a `{ error?: { message?: string } }` antes de acceder |
| Campos dinámicos JSON (`customFields`) | Usar `Record<string, any>` en el interface del modelo (única excepción de modelo) |

### Patrón `buildLineGroup` — objetos heterogéneos sin `any`

```typescript
private buildLineGroup(l: unknown) {
  const li = l as Record<string, unknown>;
  const price = Number(li['price']);
  const qty   = Number(li['quantity']);

  return this.fb.group({
    itemId:   [li['itemId'], Validators.required],
    quantity: [qty, [Validators.required, Validators.min(0.001)]],
    price:    [price],
    baseDocType: [(li['baseDocType'] as string | null | undefined) ?? null],
    baseDocId:   [(li['baseDocId']   as number | null | undefined) ?? null],
    customFields: this.fb.group((li['customFields'] as Record<string, unknown> | undefined) ?? {}),
  });
}
```

**Ventajas:**
- Evita `TS4111` (index signature access) porque `Record<string, unknown>` sí tiene índice string.
- Evita `TS2339` (missing property) porque no declara que `l` sea `PurchaseInvoiceItem`.
- El cast es explícito y localizado; no contamina el resto del método.

### Extender modelos canónicos en vez de `any`

```typescript
// ✅ Correcto
export interface PurchaseInvoiceItem {
  // ... campos existentes ...
  lineNum?:     number | null;
  baseDocType?: string | null;
  baseDocId?:   number | null;
  baseLineId?:  number | null;
  baseLineNum?: number | null;
  lineStatus?:  string;
}

// ❌ Prohibido
(draft as any).baseDocType = 'PURCHASE_ORDER';
```

### Type guards para fechas

```typescript
// ✅ Correcto
const d = typeof value === 'string' || value instanceof Date
  ? new Date(value)
  : null;

// ❌ Prohibido
const d = new Date(value as any);
```

### Errores HTTP tipados

```typescript
// ✅ Correcto
.subscribe({
  next: () => { ... },
  error: (err: unknown) => {
    const msg = (err as { error?: { message?: string } }).error?.message ?? 'Error desconocido';
    this.toast.error(msg);
  },
})

// ❌ Prohibido
error: (err: any) => { this.toast.error(err?.error?.message); }
```

---

## 10. Líneas de documento — estándar `luna-document-lines`

> **Patrón canónico completo:** `docs/guides/ESTANDAR_LINEAS_DOCUMENTO.md` (arquitectura, celdas canónicas, celdas custom, checklist de migración, estado por formulario, change detection). Ventas está 100% migrado (2026-07-20); compras e inventario siguen ese documento.

Reglas rápidas (detalle en el doc enlazado):

- Todo documento comercial usa `<luna-document-lines>` (shell) + `<luna-document-lines-detail>` con `lineDetailColumns` declarativo para la tab Detalle.
- **Ninguna columna puede quedar fuera** al migrar: las que no tengan celda canónica se proyectan con `<ng-template lunaDocumentLineDetailCell="key">`.
- En tabs Descuentos/Costos (`<luna-data-table>` propia): `[formArray]="itemsArray"`, slots `#cell`/`#actions`. Si hay varias tablas en el mismo componente, usar `#cell2`/`#actions2` (o `#cell3`/`#actions3`); `luna-data-table` las reconoce.
- **Botón eliminar estandarizado**: columna `actions` siempre presente; el botón se envuelve con `@if (canEdit)` dentro del template de acciones. Aplica a detail, discounts, costs y taxes. Aplicado en todos los formularios de ventas y compras migrados (2026-07-25).
- Prohibido `[formControl]` + `[disabled]` en el mismo control: usar `@if (canEdit) { input } @if (!canEdit) { span }`.
- Selectores por línea (cuenta, etc.): siempre `[formControl]="row.get('campo')"`, nunca `formControlName` sin contexto de fila.
- **Cambio de impuesto**: `onLineTaxChange()` debe llamar `applyLineTax()` y luego `this.cdr.detectChanges()` para refrescar los totales del documento, porque los montos afectados viven en controles `disabled` con `emitEvent: false`.
- **`detectChanges()` vs `markForCheck()`**: con `HttpClient` + `withFetch()` (no Zone.js) usar `detectChanges()` tras async; para refresco síncrono inmediato de totales tras mutar el FormArray usar `detectChanges()`; `markForCheck()` solo cuando un ancestro ya garantizará un tick de CD.

---

## 11. Checklists

### Checklist para nuevo formulario

- [ ] ¿Usa `<luna-form-page>` como raíz?
- [ ] ¿Usa `DocumentFormHeader` con `lunaFormHeader`?
- [ ] ¿Usa `DocumentActionBar` con `lunaFormActions`?
- [ ] ¿Tiene `viewMode` + `enterEditMode()`?
- [ ] ¿Desactiva el formulario con `form.disable()` en modo ver?
- [ ] ¿El botón Editar del header solo aparece en `id && viewMode`?
- [ ] ¿El botón Guardar solo aparece en `!viewMode`?
- [ ] ¿Protege la UI con `canEdit` si aplica?
- [ ] ¿Usa `markForCheck()` en todas las suscripciones que modifican estado visual (OnPush)?
- [ ] ¿No usa `setTimeout` para posponer carga de datos en OnPush?
- [ ] ¿Usa `toSignal()` en componentes nuevos (en lugar de suscripciones manuales)?

### Checklist para nuevo listado

- [ ] ¿El botón Ver usa `action="view"` (icono ojo)?
- [ ] ¿El botón Editar está **dentro** del `luna-menu`?
- [ ] ¿Las acciones destructivas (cancelar, eliminar) están dentro del menú?
- [ ] ¿El `rowClick` navega a Ver (modo solo lectura)?
- [ ] ¿El trigger del menú (`⋯`) es condicional y no aparece vacío?
- [ ] ¿Tiene `menuOpen: Record<number, boolean> = {}`?
- [ ] ¿Importa `LunaMenuComponent`?
- [ ] ¿Usa `goView()` / `goEdit()` para navegación?
- [ ] ¿Protege acciones con `canEdit` si aplica?
