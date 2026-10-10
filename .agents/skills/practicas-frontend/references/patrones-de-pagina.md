# Patrones de página

Desarrolla **F5–F15** y **F19–F22** con el detalle que no cabe en la plantilla.

---

## 1. Listado, paso a paso

| Paso | Qué | Por qué |
|---|---|---|
| 1 | Contenedor de página como **raíz única** | es el punto donde el sistema de diseño aplica el relleno y el ancho |
| 2 | Cabecera con **un** `h1` y la acción primaria | un listado con dos títulos de primer nivel rompe la navegación por encabezados |
| 3 | Aviso informativo de la sección | es el único sitio donde el usuario nuevo lee qué hace la pantalla |
| 4 | Barra de filtros: búsqueda con retardo + filtros | sin retardo, cada tecla es una petición |
| 5 | Tabla con `tableKey`, ordenación y visibilidad de columnas, y estado vacío | la clave es la que guarda las preferencias; el estado vacío es la primera impresión |
| 6 | Acciones de fila en su contenedor, con `stopPropagation` | sin él, editar abre además el detalle |
| 7 | Paginador | la página efectiva la devuelve el servidor: úsala, no la supongas |

**Síntomas de un listado heredado** (reescríbelo, no lo parches): falta el contenedor de página; el
título es de primer nivel pero los subtítulos también; los botones son crudos; la búsqueda no tiene
retardo; la tabla no tiene clave de columnas; las acciones son símbolos de texto.

---

## 2. Formulario: las cuatro piezas que se olvidan

### 2.1 La instantánea de cambios sucios

```typescript
private initialValues: unknown = null;

private takeSnapshot(): void {
  this.initialValues = this.form.getRawValue();
  this.hasChanges = false;
}

private checkDirty(): boolean {
  if (!this.isEditing) return true;   // en un alta, cualquier estado es «cambiable»
  return JSON.stringify(this.form.getRawValue()) !== JSON.stringify(this.initialValues);
}
```

- Se toma **después** de parchear con los datos del servidor y con `emitEvent: false`.
- Se compara con `getRawValue()` (incluye deshabilitados).
- Formulario **plano** (configuración): compara campo a campo, es más barato y más legible el día que
  falla. Estructura **anidada** (diccionario, matriz): serializa.
- Se recalcula en cada mutación del arreglo de líneas.

### 2.2 Las banderas de estado

`isLoading`, `isSaving`, `hasChanges`. Las tres se apagan en `next` **y** en `error`. Un botón que solo
se deshabilita cuando el formulario es inválido permite el doble envío cuando el formulario es válido y
la red es lenta.

### 2.3 El modo de solo lectura

Cuando el documento no admite edición, el formulario **lo dice**: un aviso en la cabecera o las
secciones bloqueadas visualmente. Un campo deshabilitado sin explicación se lee como un defecto.

Y un campo que **siempre** es de solo lectura se explica: una pista en el propio campo («viene del
documento de origen») o un aviso en la sección, en lugar de un control apagado y mudo.

### 2.4 El formulario de configuración es otra cosa

Un formulario de configuración no es un documento: no tiene cabecera de estado, ni líneas, ni acciones
de ciclo de vida. Sus diferencias, y son deliberadas:

| Aspecto | Documento | Configuración |
|---|---|---|
| Contenedor de secciones | secciones de formulario | tarjetas por grupo de ajustes |
| Barra de acciones | siempre visible | **condicional**: guardar solo si hay cambios; «OK»/volver si no |
| Comparación sucia | serializada (estructura anidada) | campo a campo (estructura plana) |
| Interruptores | — | usan el patrón de interruptor del sistema de diseño, no un `checkbox` crudo |

---

## 3. Arreglo de líneas, con validación por línea

```typescript
private buildLineGroup(line?: Partial<OrderLine>): FormGroup {
  return this.fb.group({
    id: [line?.id ?? null],                       // distingue existente de nueva
    itemId: [line?.itemId ?? null, Validators.required],
    quantity: [line?.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
    price: [line?.price ?? 0, [Validators.required, Validators.min(0)]],
    discountPct: [line?.discountPct ?? 0, [Validators.min(0), Validators.max(100)]],
  });
}

get hasInvalidLine(): boolean {
  return this.lines.controls.some((group) => group.invalid);
}
```

- La validación vive en el grupo de la línea, no en un `if` del guardado: así el usuario ve **qué** línea
  está mal.
- Si las líneas están repartidas en pestañas, un guardado inválido **navega a la pestaña del error**.
- Al quitar una línea, deshabilita en lugar de eliminar cuando el backend necesite conservar la traza;
  elimina cuando el backend reconstruya las líneas desde cero (lo más común).
- `[formControl]="$any(row.get('campo'))"` es el precio de la plantilla estricta; decide **una** forma de
  hacerlo y úsala en todo el proyecto.

---

## 4. Pestañas

```typescript
readonly tabs = [
  { key: 'general', label: 'General', action: 'clipboard' },
  { key: 'stock', label: 'Stock', action: 'box' },
  { key: 'accounting', label: 'Contabilidad', action: 'book' },
] as const;

activeTab: string = 'general';
```

```html
<app-form-tabs [tabs]="tabs" [(activeTab)]="activeTab" ariaLabel="Secciones"></app-form-tabs>

@switch (activeTab) {
  @case ('general') { … }
  @case ('stock') { … }
}
```

| Regla | Motivo |
|---|---|
| Clave de **texto**, no índice numérico | reordenar o esconder una pestaña rompe el índice sin error |
| Botones nativos con clase compartida | un componente de pestañas de terceros suele traer hacks de encapsulación y problemas de hidratación |
| Condicional con `@if`/`@switch` | más claro y sin sobrecarga de proyección |
| Cada pestaña con su icono | diferencia las pestañas de los botones y mejora el barrido visual |
| Sin emoji en la etiqueta | el emoji no tiene nombre accesible y se ve distinto por plataforma |
| En móvil: envolver o desplazar | una barra de pestañas que se sale obliga a desplazar la página entera |

```scss
@media (max-width: bp.$breakpoint-md) {
  .tab-switcher { flex-wrap: wrap; gap: var(--space-1); }
  .tab-btn { flex: 1 1 auto; min-width: 80px; padding: var(--space-1) var(--space-3); white-space: nowrap; }
}
```

---

## 5. Control propio (selector de entidad)

Contrato completo:

```typescript
@Component({ /* … */ providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PartnerSelectorComponent), multi: true }] })
export class PartnerSelectorComponent implements ControlValueAccessor {
  @Input() id?: string;                  // se reenvía al disparador: [attr.id]="id"
  @Input() compact = false;              // true en celdas de tabla y líneas
  @Input() readonly = false;
  @Input() disabled = false;
  @Input() placeholder = '— Seleccionar —';
  @Output() readonly partnerSelected = new EventEmitter<Partner>();

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number | null): void { /* actualiza la vista de forma SÍNCRONA */ }
  registerOnChange(fn: (value: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}
```

Reglas:

- **Un solo contrato visual** para todos los selectores de entidad: mismo alto, mismo borde, mismo icono
  de flecha, misma variante compacta. Una pantalla con dos selectores distintos se lee como un defecto.
- El disparador es un `<button type="button">` nativo, **no** un botón de la librería: el botón de la
  librería trae su propia altura y su propio relleno y rompe la alineación del campo.
- El control **emite el objeto completo** además del valor: el formulario casi siempre necesita más que
  el identificador (el precio, el nombre, el tipo).
- El `[id]` se reenvía al disparador con `[attr.id]`. Sin eso, el `for` de la etiqueta no apunta a nada
  y el control se queda sin nombre accesible —en silencio—.

---

## 6. Estado vacío

```html
<!-- en una tabla: por props del componente -->
<app-data-table emptyTitle="Sin órdenes" emptyDescription="Aún no hay documentos."
                emptyActionLabel="Crear la primera" (emptyAction)="goNew()"></app-data-table>

<!-- en línea (modal, tarjeta, sección) -->
<app-empty-state icon="box" title="Sin registros"
                 description="No hay elementos para mostrar."></app-empty-state>
```

- Un estado vacío **sin** icono y **sin** acción (cuando el usuario puede crear) es a medias.
- Cuando el vacío es consecuencia de un filtro, el texto lo dice: «Sin resultados para la búsqueda» no es
  lo mismo que «Sin datos».
- Los textos van **acentuados** y en la convención del proyecto. Los de listado, en el formato que use el
  proyecto para botones de alta (`+ Nuevo <Sustantivo>`, con el sustantivo capitalizado si esa es la
  convención mayoritaria) y los títulos de formulario en frase.

**Aviso medido (generalizado):** una auditoría encontró **18** estados vacíos sin acentos y **7** botones
fuera de convención, **y no existía ningún gate de textos**: el cierre fue un inventario manual. Es
exactamente la razón por la que sobrevivieron. Da por no verificada cualquier afirmación sobre textos
hasta que revises las plantillas.

---

## 7. Estilo: recetas cortas

### 7.1 Ganar por especificidad sin `!important`

```scss
/* ❌ pierde la cascada para siempre */
.campo .input { color: red !important; }

/* ✅ se repite la clase propia: sube la especificidad sin ensuciar la cascada */
.campo.campo .input { color: red; }
```

Si de verdad es inevitable, el marcador con el motivo va en la misma línea (o en las dos anteriores, o
en las primeras 30 del fichero) y el proyecto mantiene un gate que **cuenta** los que quedan. Sin motivo
escrito, es deuda invisible.

### 7.2 Limitar el ámbito de CSS global

```scss
/* ❌ sube la especificidad (0,1,0 → 0,2,0) y cambia el aspecto DENTRO del componente */
.app-modulo .filtro { … }

/* ✅ :where() aporta 0 de especificidad: limita fuera y conserva el lugar en la cascada interna */
:where(.app-modulo) .filtro { … }
```

Y **comprueba que la regla es de primer nivel**: prefijar reglas anidadas produce un selector con el
host **dentro** del contenedor, que nunca casa.

**Caso (generalizado).** Un script que prefijaba reglas anidadas dejó **4** reglas de búsqueda sin
aplicarse y **ningún gate lo notó**. El prefijo sin `:where` cambió el color de un icono de marca
(blanco → gris) **dentro** del componente.

### 7.3 Densidad

El `px` crudo en relleno, hueco, tamaño de fuente o alto se rechaza. La receta es una **variable por
componente** cuyo valor base reproduce el aspecto actual, y solo el modo espacioso relaja (con una
diferencia mínima declarada por eje). Los tokens de espaciado y de texto son **constantes**: si algo
escala, es porque se declaró explícitamente que escala.

Y una tabla HTML cruda (la excepción permitida) hereda el relleno del navegador: declara su variable de
densidad con base igual al aspecto actual para no cambiar nada.

### 7.4 Modo oscuro

```scss
/* ✅ el atributo y sus valores son los que use tu proyecto */
[data-theme='dark'] .mi-componente { --mi-var-local: #valor-oscuro; }

/* ❌ ignora la preferencia GUARDADA del usuario */
@media (prefers-color-scheme: dark) { … }
```

Un token nuevo **sin** su variante oscura es una pantalla rota en oscuro que nadie ve hasta que alguien
cambia el tema. Y si conviven dos familias de tokens, decide cuál usa cada carpeta: mezclarlas en el
mismo bloque produce el defecto más caro de diagnosticar.

### 7.5 Desbordamiento horizontal

Es **siempre** la misma causa: contenido variable dentro de un contenedor flexible.

```scss
.control { flex: 1 1 0%; min-width: 0; overflow: hidden; }
.texto { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

Regla de dedo: si añades `flex-shrink: 0` a algo que contiene texto variable (un selector, una etiqueta,
una insignia), acabas de crear un desbordamiento en móvil.

---

## 8. Accesibilidad, con el cómo

| # | Regla | Cómo se cumple |
|---|---|---|
| 1 | Un `h1` por página | el título del listado, o el `formTitle` del formulario |
| 2 | Sin saltos de nivel | bajo el `h1` todo es `h2`; el tamaño viene de la clase |
| 3 | Todo control con nombre accesible | dentro de un campo etiquetado lo hereda; fuera, se pasa explícito |
| 4 | Botones de solo icono | con la acción nombrada o una etiqueta accesible |
| 5 | El texto visible es el nombre accesible (WCAG 2.5.3) | nunca una etiqueta accesible distinta del texto |
| 6 | Contraste AA | tokens de **texto** para texto, no tokens de marca |
| 7 | Menús | no se escribe ARIA a mano: el componente lo cablea |

**Medir, no suponer.** Una herramienta de auditoría de accesibilidad basada en navegador **no puede**
auditar una aplicación de una sola página con sesión iniciada: acaba en la pantalla de acceso. Se mide
**inyectando el analizador en una sesión autenticada real** y corriendo el análisis sobre el documento.
Fija una línea base (por ejemplo, un conjunto de páginas autenticadas con **0** violaciones) y
defiéndela con un gate.

**Sobre el contraste:** un color de marca como color de texto suele quedar por debajo del mínimo AA. Usa
los tokens de texto (éxito, error, aviso, cuerpo) y deja los de marca para fondos y bordes.
