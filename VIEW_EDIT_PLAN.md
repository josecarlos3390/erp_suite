# Fase 1 — Modo Ver / Editar restringido (Documentos comerciales)

> **Estado:** Planificado, pendiente de implementación post-deploy.
> **Piloto:** `sales-orders-form` → luego replicar a 14 documentos comerciales.

---

## 🎯 Objetivo

Separar claramente tres modos en todos los formularios de documentos comerciales:

| Modo | URL | Comportamiento | Botones disponibles |
|------|-----|---------------|---------------------|
| **Ver** | `/sales-orders/:id?view=1` | Solo lectura absoluta. Todos los controles deshabilitados. | Volver, Editar (si no cancelado) |
| **Editar** | `/sales-orders/:id` | Edición restringida. Solo campos no sensibles. | Volver, Guardar, Cancelar |
| **Crear** | `/sales-orders/new` | Creación completa. Todos los campos editables. | Volver, Guardar, Guardar borrador |

---

## 📐 Arquitectura propuesta

### 1. Propiedades en `CommercialDocumentFormBase`

```typescript
export abstract class CommercialDocumentFormBase extends DocumentFormBase {
  /**
   * Modo de visualización: true = solo lectura absoluta.
   * Se activa vía query param ?view=1 o @Input().
   */
  @Input() viewMode = false;

  /**
   * El documento está cancelado. No se permite editar nunca.
   */
  get isCancelled(): boolean {
    return this.status === 'CANCELLED';
  }

  /**
   * ¿Este documento permite edición restringida?
   * Cada documento redefine: OPEN, no tiene entregas/facturas, etc.
   */
  abstract get canEdit(): boolean;

  /**
   * ¿Estamos en modo edición restringida?
   * true cuando NO es viewMode, NO está cancelado, Y canEdit es true.
   */
  get isEditMode(): boolean {
    return !this.viewMode && !this.isCancelled && this.canEdit;
  }

  /**
   * ¿Estamos en modo creación?
   */
  get isCreateMode(): boolean {
    return !this.documentId;  // o !this.orderId, etc.
  }

  /**
   * ¿Un campo específico es editable en el modo actual?
   * Cada formulario puede redefinir para campos especiales.
   */
  isFieldEditable(fieldName: string): boolean {
    if (this.viewMode) return false;
    if (this.isCreateMode) return true;
    if (this.isCancelled) return false;
    if (!this.canEdit) return false;
    return EDITABLE_FIELDS_COMMERCIAL.includes(fieldName);
  }
}
```

### 2. Campos editables por defecto (documentos comerciales)

```typescript
export const EDITABLE_FIELDS_COMMERCIAL = [
  'notes',           // Comentarios
  'customerRef',     // Referencia cliente
  'shipToAddress',   // Dirección de envío
  'dueDate',         // Fecha de vencimiento
  'deliveryDate',    // Fecha de entrega
  'contactPerson',   // Persona de contacto
  'contactPhone',    // Teléfono de contacto
  // UDFs se manejan por su propio mecanismo
] as const;
```

**Campos SIEMPRE bloqueados post-creación:**
- `partnerId` / `supplierId` (cambiar partner rompe traceability)
- `itemId`, `quantity`, `price`, `priceNet` (cambiar líneas rompe totales y downstream docs)
- `warehouseId` (cambiar almacén rompe stock y tracking)
- `taxIndicatorId` (cambiar impuesto rompe totales y contabilidad)
- `date`, `postingDate` (cambiar fecha rompe período fiscal)
- `currency`, `exchangeRate` (cambiar moneda rompe totales)
- `discountPct`, `discountAmt` (cambiar descuento rompe totales)

### 3. Manejo de UDFs (User Defined Fields)

Los UDFs **son editables** en modo edición restringida porque:
- No afectan totales ni contabilidad
- No afectan traceability
- Son campos personalizados que el usuario puede necesitar corregir

El componente `UdfFormSectionComponent` debe respetar el `viewMode`:
```html
<app-udf-form-section
  [readonly]="viewMode"
  [formGroup]="udfForm">
</app-udf-form-section>
```

### 4. Componentes de acción compartidos

#### `document-form-header.component`
```html
<!-- Slot de toolbar: el formulario inyecta botones según modo -->
<ng-content select="[formToolbar]"></ng-content>

<!-- Ejemplo de uso en sales-orders-form -->
<app-document-form-header>
  @if (viewMode && !isCancelled) {
    <luna-button (lunaClick)="enterEditMode()">Editar</luna-button>
  }
</app-document-form-header>
```

#### `document-action-bar.component`
```html
<!-- Botones estándar según modo -->
@if (viewMode) {
  <luna-button (lunaClick)="goBack()">Volver</luna-button>
} @else if (isEditMode) {
  <luna-button type="submit" [disabled]="!hasChanges">Guardar cambios</luna-button>
  <luna-button (lunaClick)="cancelEdit()">Cancelar</luna-button>
} @else if (isCreateMode) {
  <luna-button type="submit">Crear</luna-button>
  <luna-button (lunaClick)="saveAsDraft()">Guardar borrador</luna-button>
}
```

### 5. Deshabilitación de controles

#### Opción A: `form.disable()` en la base (simple)
```typescript
// En CommercialDocumentFormBase, después de cargar el documento
if (this.viewMode || this.isCancelled || !this.canEdit) {
  this.form.disable({ emitEvent: false });
}
```

**Problema:** Deshabilita TODO, incluyendo campos que queremos editables en modo edición.

#### Opción B: Deshabilitar campo por campo (preciso, recomendado)
```typescript
// En cada formulario, después de cargar datos
private applyEditRestrictions() {
  if (this.isCreateMode) return; // Todo editable en creación

  if (this.viewMode || this.isCancelled || !this.canEdit) {
    this.form.disable({ emitEvent: false });
    return;
  }

  // Modo edición restringida: deshabilitar campos sensibles
  const blockedFields = [
    'partnerId', 'warehouseId', 'date', 'postingDate',
    'currency', 'exchangeRate', 'salesPersonId', 'branchId',
  ];
  blockedFields.forEach(f => this.form.get(f)?.disable({ emitEvent: false }));

  // Las líneas: deshabilitar campos sensibles de cada línea
  this.itemsArray.controls.forEach((line) => {
    const lineBlocked = ['itemId', 'quantity', 'price', 'priceNet', 'warehouseId', 'taxIndicatorId'];
    lineBlocked.forEach(f => line.get(f)?.disable({ emitEvent: false }));
  });
}
```

#### Opción C: Atributo `readonly` en controles LUNA (template)
```html
<luna-input
  [formControl]="form.get('notes')"
  [readonly]="!isFieldEditable('notes')">
</luna-input>

<luna-input
  [formControl]="form.get('partnerId')"
  [readonly]="true">  <!-- Siempre readonly post-creación -->
</luna-input>
```

**Recomendación:** Opción B (programática) para campos de cabecera, Opción C (template) para líneas (que ya usan `readonly` en selectores modales).

### 6. Navegación desde listados

```typescript
// En sales-orders.component.ts (listado)
viewOrder(id: number) {
  this.router.navigate(['/sales-orders', id], { queryParams: { view: 1 } });
}

editOrder(id: number) {
  this.router.navigate(['/sales-orders', id]);
}
```

```html
<!-- En la tabla de listado -->
<luna-button (lunaClick)="viewOrder(row.id)">Ver</luna-button>
<luna-button (lunaClick)="editOrder(row.id)" [disabled]="row.status !== 'OPEN'">Editar</luna-button>
```

---

## 🏗️ Implementación por pasos (piloto: sales-orders)

### Paso 1: Añadir `viewMode` a `CommercialDocumentFormBase`
- Añadir `@Input() viewMode = false`
- Añadir getters `isEditMode`, `isCreateMode`, `isCancelled`
- Añadir `isFieldEditable(fieldName)`
- Añadir lista `EDITABLE_FIELDS_COMMERCIAL`

### Paso 2: Modificar `sales-orders-form.component.ts`
- Leer `view` query param en `ngOnInit`
- Ajustar `canEdit` para que respete `viewMode`
- Implementar `applyEditRestrictions()`
- Añadir método `enterEditMode()` que navega a la misma ruta sin `?view=1`

### Paso 3: Modificar template de `sales-orders-form`
- Añadir condicionales `@if (viewMode)` para mostrar botones correctos
- Añadir `readonly` a controles de cabecera según `isFieldEditable()`
- Asegurar que líneas ya tienen `readonly` en selectores modales

### Paso 4: Modificar `sales-orders.component.ts` (listado)
- Separar botón "Ver" (navega a `?view=1`) de "Editar" (navega a ruta normal)
- Deshabilitar "Editar" si `status !== 'OPEN'` o tiene entregas/facturas

### Paso 5: Verificar comportamiento
- Crear SO → guardar → verificar botón "Ver" abre modo solo lectura
- Verificar botón "Editar" abre modo edición restringida
- Verificar que solo `notes`, `customerRef`, etc. son editables
- Verificar que guardar cambios solo envía campos editables
- Verificar que cancelar SO lo pone en modo solo lectura

### Paso 6: Replicar a otros 14 documentos comerciales

---

## 📋 Lista de documentos comerciales a migrar

### Ventas (7)
- [ ] `sales-quotations-form` (piloto #2 si SO sale bien)
- [x] `sales-orders-form` (piloto #1)
- [ ] `delivery-orders-form`
- [ ] `sale-invoices-form`
- [ ] `sale-reserve-invoices-form`
- [ ] `sales-credit-notes-form`
- [ ] `sales-debit-notes-form`
- [ ] `sales-returns-form`

### Compras (7)
- [ ] `purchase-quotations-form`
- [ ] `purchase-orders-form`
- [ ] `purchase-receipts-form`
- [ ] `purchase-invoices-form`
- [ ] `purchase-reserve-invoices-form`
- [ ] `purchase-credit-notes-form`
- [ ] `purchase-returns-form`

### Inventario (4)
- [ ] `stock-entries-form`
- [ ] `stock-exits-form`
- [ ] `stock-adjustments-form`
- [ ] `stock-transfers-form`

**Nota:** Los documentos de inventario son más simples (no tienen partner, menos campos sensibles). Podrían hacerse en paralelo al piloto si el patrón es estable.

---

## 🔧 Datos maestros (separado, fase 2)

Los datos maestros ya tienen páginas detail separadas (`/partners/:id`).

### Problema actual
El botón "Ver" en los listados navega al **formulario editable** (`/partners/:id/edit`) en vez de la página detail (`/partners/:id`).

### Fix simple
```typescript
// En partners.component.ts
viewPartner(id: number) {
  this.router.navigate(['/partners', id]);  // detail page (solo lectura)
}

editPartner(id: number) {
  this.router.navigate(['/partners', id, 'edit']);
}
```

```html
<luna-button (lunaClick)="viewPartner(row.id)">Ver</luna-button>
<luna-button (lunaClick)="editPartner(row.id)">Editar</luna-button>
```

**Datos maestros a arreglar:**
- [ ] Partners
- [ ] Items
- [ ] Warehouses
- [ ] Banks / Bank Accounts
- [ ] Branches
- [ ] Employees
- [ ] Tax Indicators
- [ ] Price Lists
- [ ] Discount Groups
- [ ] Etc.

---

## ⚠️ Consideraciones de backend

Cuando el frontend envía un PUT/PATCH en modo edición restringida, **el backend debe ignorar campos no permitidos**.

```typescript
// Ejemplo en sales-orders.controller.ts o service
update(id: number, dto: UpdateSalesOrderDto) {
  // Campos que NUNCA se actualizan en edición restringida
  const blockedFields = ['partnerId', 'date', 'postingDate', 'currency'];
  
  // Solo permitir campos de la whitelist
  const allowedFields = ['notes', 'customerRef', 'shipToAddress', 'dueDate', 'deliveryDate', 'contactPerson', 'contactPhone'];
  
  // Implementar en el DTO o en el service
  const sanitized = pick(dto, allowedFields);
  
  return this.service.update(id, sanitized);
}
```

**Alternativa:** El backend recibe todo el DTO pero ignora los campos bloqueados. Esto es más seguro (defense in depth) porque evita que un usuario malicioso modifique campos sensibles via API directa.

---

## 📊 Estimación de esfuerzo

| Fase | Documentos | Esfuerzo estimado |
|------|-----------|-------------------|
| Piloto SO | 1 | 2-3 horas |
| Replicar ventas | 6 | 4-6 horas (patrón estable) |
| Replicar compras | 7 | 4-6 horas |
| Replicar inventario | 4 | 2-3 horas |
| Datos maestros (fix botón Ver) | ~10 | 2-3 horas |
| Backend whitelist | 1 | 1-2 horas |
| **Total** | **~28** | **15-23 horas** |

---

## 🚦 Dependencias

- **Este deploy debe estar en producción** antes de empezar la Fase 1.
- Los 3 servicios compartidos (`PriceResolutionService`, `UnitCostResolutionService`, `AccountMappingResolutionService`) deben estar estable.
- `CommercialDocumentFormBase` debe tener el getter `effectivePartnerId` estable.
