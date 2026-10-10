---
name: practicas-frontend
description: Prácticas portables para construir y mantener el frontend de una aplicación Angular con un sistema de diseño propio, sin arrastrar el dominio ni la librería de componentes de ningún proyecto concreto. Se invoca al crear una página de listado o de formulario, al escribir un servicio de datos o un modelo, al montar un formulario reactivo con líneas, al declarar un control de formulario propio, al tratar el estado asíncrono y la detección de cambios, al escribir SCSS con tokens y modo oscuro, al auditar una página heredada, al escribir pruebas de componente con Karma o Jasmine y al revisar accesibilidad, responsive o estilos antes de entregar. Cubre la arquitectura de componentes standalone, el patrón listado + formulario, el seguimiento de cambios sucio, la accesibilidad medida, la especificidad frente a las supresiones de CSS, la densidad por variables, los contratos de DOM en las pruebas de extremo a extremo y la hidratación de la trazabilidad. Portable entre proyectos del mismo stack, no depende del dominio. Use when scaffolding or reviewing an Angular frontend — pages, forms, services, models, SCSS tokens, accessibility, Karma specs or Playwright DOM contracts.
---

# Prácticas de frontend — Angular con sistema de diseño propio

> **Esta skill es de prácticas, no de un proyecto.** No depende de ningún modelo, ruta, componente de
> una librería concreta ni sistema de diseño: se puede copiar a otro frontend del **mismo stack** sin
> cambiar una palabra de las reglas.
>
> **Los componentes de los ejemplos son marcadores de posición.** `<app-data-table>`,
> `<app-form-page>`, `<app-form-field>`, `<app-button>`… **no existen en tu proyecto**: son los
> **roles** que hay que mapear a tu librería real. El paso 0 del lineamiento (§J) es precisamente
> inventariar la librería y sustituir los marcadores. **Una skill que nombra ficheros que no existen es
> peor que no tener skill**, porque el agente que la lee los busca o se los inventa.
>
> **Por qué cada práctica lleva su caso pegado.** Una práctica sin el caso que la originó es un
> consejo, y un consejo no sobrevive a la siguiente prisa. El caso —generalizado— es lo que la hace
> comprobable y lo que impide que alguien la «simplifique» dentro de un mes.
>
> **Frontera con las otras skills.** Aquí está el **cómo se construye**. Para lo que es **prueba**
> —gates que bloquean de verdad, líneas base, medir antes y después— sigue la skill
> `verificacion-y-medicion`. Para las **clases de defecto** que no gritan —fechas, dinero, hidratación,
> dobles de prueba— sigue `trampas-conocidas`.

## Cuándo se invoca

| Si vas a… | Ve a |
|---|---|
| arrancar una aplicación o declarar componentes, rutas, servicios y modelos | **A** |
| crear una página de listado | **B** |
| crear una página de formulario o mejorarla | **C** |
| crear un control de formulario propio (selector de entidad, campo compuesto) | **D** |
| montar tablas, líneas editables o pestañas | **E** |
| tratar el estado asíncrono, la detección de cambios o la cancelación | **F** |
| escribir SCSS, tokens, modo oscuro, densidad o responsive | **G** |
| revisar accesibilidad | **H** |
| escribir pruebas de componente o contratos de DOM | **I** |
| auditar o reescribir una página heredada | el apartado de páginas heredadas de **J** |
| revisar una entrega | la checklist de **J** |

Y la puerta de entrada: **ningún valor visual se escribe a mano y ninguna regla de negocio vive en una
plantilla**. Los colores, las alturas y los espaciados vienen de tokens; los importes y las reglas
vienen del servicio.

---

## A. Arquitectura de la aplicación

### F1 · Componentes standalone, dependencias explícitas, sin módulos de Angular.

**La práctica.** Cada componente es autónomo y declara en su `imports` exactamente lo que usa. No hay
módulos de funcionalidad ni un módulo raíz: el arranque es una función de configuración
(`bootstrapApplication`).

**Por qué.** Las dependencias declaradas en el propio componente son lo que hace que una página se
pueda mover, borrar o cargar sola. Un módulo compartido convierte cualquier componente en dependiente
de todo lo que se declaró en él.

**→ Qué hacer.**
- `standalone: true` en cada componente y directiva; los `imports` solo con lo que la plantilla usa.
- El enrutado se declara con `loadComponent` por página (carga diferida por defecto).
- Las dependencias de plataforma y de datos se proveen en la configuración del arranque, no en un
  módulo.

### F2 · Una página es un listado y un formulario; el servicio es lo único compartido.

**La práctica.** Cada funcionalidad son tres piezas:

- `<feature>.component.ts` — **listado**: tabla paginada, búsqueda con retardo, filtros, acciones de
  fila.
- `<feature>-form.component.ts` — **formulario**: formulario reactivo (con arreglo de líneas cuando el
  documento las tiene), carga de catálogos en paralelo, estado de solo lectura cuando el documento está
  cerrado o anulado.
- `<feature>.service.ts` — **servicio**: las llamadas HTTP y los tipos de la respuesta.

Y las rutas, con el formulario reutilizado para alta y edición:

```typescript
{
  path: 'orders',
  canActivate: [roleGuard(['ADMIN'])],
  children: [
    { path: '',      loadComponent: () => import('./pages/orders/orders.component').then((m) => m.OrdersComponent) },
    { path: 'new',   loadComponent: () => import('./pages/orders/orders-form.component').then((m) => m.OrdersFormComponent) },
    { path: ':id',   loadComponent: () => import('./pages/orders/orders-form.component').then((m) => m.OrdersFormComponent) },
  ],
}
```

**Por qué.** Es lo que hace que treinta pantallas se parezcan sin coordinación: la misma forma de
listar y la misma forma de editar, una vez resueltas, se heredan. Y un formulario que sirve para alta y
edición evita la clase de defecto más común de un frontend con documentos: dos formularios que validan
distinto.

### F3 · El servicio habla HTTP y devuelve tipos; no decide ni formatea.

**La práctica.** El servicio construye la petición, tipa la respuesta y para. No conoce la interfaz, no
guarda estado de pantalla y no transforma importes para pintarlos.

```typescript
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/orders`;

  getAll(query: OrderQuery = {}) {
    let params = new HttpParams();
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.limit != null) params = params.set('limit', String(query.limit));
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<PaginatedResult<Order>>(this.api, { params });
  }

  getOne(id: number) {
    return this.http.get<Order>(`${this.api}/${id}`);
  }

  create(data: CreateOrderPayload) {
    return this.http.post<Order>(this.api, data);
  }

  update(id: number, data: UpdateOrderPayload) {
    return this.http.patch<Order>(`${this.api}/${id}`, data);
  }

  close(id: number) {
    return this.http.post<Order>(`${this.api}/${id}/close`, {});
  }

  cancel(id: number) {
    return this.http.post<Order>(`${this.api}/${id}/cancel`, {});
  }
}
```

**Por qué.** El servicio es el único sitio que sabe la forma de la API. Si además formatea, decide o
guarda estado, cualquier cambio de servidor obliga a tocar la interfaz.

**→ Qué hacer.**
- Los parámetros **solo se añaden si tienen valor**: un `search=` vacío cambia la consulta del backend.
- El cuerpo de creación y el de actualización tienen **su propio tipo** (no `any`): un `any` aquí
  desactiva la comprobación justo en el borde con el servidor.
- Un servicio por recurso. Si dos recursos comparten un servicio «de utilidades», es que faltaba un
  servicio.

### F4 · Los modelos son interfaces puras, con uniones de literales para los estados.

**La práctica.** Los modelos son TypeScript puro (interfaces y tipos) en una carpeta de modelos, sin
clases, sin decoradores y sin lógica. Los estados son uniones de literales, no cadenas sueltas.

```typescript
export type OrderStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface Order {
  id: number;
  code: string;
  status: OrderStatus;
  partner: { id: number; name: string };
  items: OrderLine[];
  total: number;
}

export interface OrderLine {
  item: { id: number; name: string };
  quantity: number;
  price: number;
  subtotal: number;
}
```

**Por qué.** Una unión de literales convierte un error de tecleo en un error de compilación, y hace que
la plantilla pueda ramificar sin adivinar. Interfaces mínimas: cada campo que se declara y no se usa es
una promesa que el servidor no está obligado a cumplir.

---

## B. El listado

### F5 · Todo listado tiene la misma anatomía.

**La práctica.** Un contenedor de página, una cabecera con **un** título de primer nivel, la acción
primaria de alta, una barra de filtros, la tabla con su estado vacío y el paginador:

```
página
 ├── cabecera:  <h1> + [acción primaria]
 ├── aviso informativo (opcional, recomendado)
 ├── barra de filtros: búsqueda + filtros
 ├── tabla: datos, columnas, estado vacío, acciones de fila
 └── paginador
```

**Por qué.** La anatomía repetida es lo que hace que un usuario que aprendió una pantalla sepa usar las
sesenta. Y un listado sin estado vacío no dice «no hay datos»: dice «algo se rompió».

**→ Qué hacer.** Ver `references/plantillas.md` §2 para el esqueleto y `references/patrones-de-pagina.md`
§1 para las reglas que no se ven en la plantilla.

### F6 · La búsqueda espera, la paginación reinicia y las acciones de fila no navegan.

**La práctica.** La búsqueda se emite por un sujeto con **retardo** y **solo si cambió**; cualquier
cambio de filtro o de búsqueda vuelve a la **página 1**; y los botones dentro de una fila detienen la
propagación para no disparar el clic de la fila.

```typescript
private readonly searchSubject = new Subject<string>();
private readonly destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.searchSubject
    .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
    .subscribe(() => {
      this.page = 1;
      this.load();
    });
  this.load();
}

onSearch(value: string) {
  this.search = value;
  this.searchSubject.next(value);
}
```

```html
<app-button action="edit" variant="secondary"
            (click)="openEdit(item); $event.stopPropagation()"></app-button>
```

**Por qué.** Sin retardo, cada tecla es una petición: el listado parpadea y el servidor recibe diez
consultas para una búsqueda. Sin `distinctUntilChanged`, el mismo término repetido vuelve a pedir.
Sin volver a la página 1, buscar desde la página 7 muestra «sin resultados» sobre un resultado que sí
existe. Y sin detener la propagación, editar una fila abre además el detalle.

**→ Qué hacer.**
- Todo `subscribe` que escribe estado lleva `takeUntilDestroyed`: una suscripción viva tras destruir el
  componente sigue pintando.
- Las acciones de fila van agrupadas en un contenedor y con **iconos de la librería**, nunca símbolos
  de texto sueltos (`✎`, `✕`): un símbolo no tiene nombre accesible ni se ve igual en todas las fuentes.

---

## C. El formulario

### F7 · Un solo armazón para todos los formularios, y el estado del documento manda.

**La práctica.** Todo formulario se monta sobre el mismo armazón: un contenedor de página, una cabecera
con el título y el **estado** del documento, el cuerpo con secciones y filas, y una **barra de acciones**
que lleva únicamente la acción primaria.

Dos variantes, y no más:

| Variante | Cuándo | Qué la distingue |
|---|---|---|
| Formulario de **documento** | tiene cabecera, líneas y efectos | cabecera con estado, sección de líneas, acciones de ciclo de vida (cerrar, anular) |
| Formulario de **maestro** | edita un registro simple | pestañas o secciones apiladas, y **solo** el botón de guardar en la barra |

**Por qué.** La barra de acciones fija es lo que hace que el botón de guardar esté siempre en el mismo
sitio, y que el formulario no dependa de que el usuario baje hasta el final. Y la cabecera ya tiene la
vuelta atrás: un botón «Cancelar» adicional es una segunda forma de lo mismo, con dos comportamientos
distintos el día que alguien cambie uno.

**→ Qué hacer.**
- En los formularios de maestro, la barra lleva **solo** la acción primaria.
- Cuando el documento está cerrado o anulado, el formulario entra en **solo lectura** y lo dice (un
  aviso, o las secciones bloqueadas), en vez de dejar campos deshabilitados sin explicación.
- Un campo de solo lectura **se explica**: una pista en el campo o un aviso en la sección, en lugar de
  un control apagado y mudo.

### F8 · Seguimiento de cambios sucio: instantánea, comparación y guardar deshabilitado.

**La práctica.** Todo formulario guarda una **instantánea** de sus valores en el momento de cargarse y
compara contra ella. El botón de guardar está deshabilitado si el formulario es inválido, si está
guardando o si **no hay cambios**. Y el aviso de cambios sin guardar usa la misma señal.

```typescript
private initialValues: unknown = null;
hasChanges = false;

private snapshot() {
  this.initialValues = this.form.getRawValue();
  this.hasChanges = false;
}

private checkDirty(): boolean {
  if (!this.isEditing) return true;   // un alta sin tocar nada sigue siendo un cambio
  return JSON.stringify(this.form.getRawValue()) !== JSON.stringify(this.initialValues);
}
```

**Por qué.** Sin instantánea no se puede saber si algo cambió, y el usuario sale de la pantalla
perdiendo lo tecleado —o no puede salir porque el aviso salta siempre—. Con instantánea, la señal es
una sola y todos los consumidores (botón, aviso, guardia de salida) coinciden.

**→ Qué hacer.**
- Toma la instantánea **después** de parchear el formulario con lo que vino del servidor, y con
  `emitEvent: false` para no disparar el ciclo sucio con la propia carga.
- Compara con `getRawValue()` (incluye los controles deshabilitados), no con `value`.
- En un formulario de configuración **plano**, compara campo a campo; en uno con estructura anidada
  (una matriz, un diccionario), compara por serialización. Mezclar los dos criterios es lo que hace que
  un formulario marque cambios que no existen.
- El estado `hasChanges` se recalcula en **cada** mutación relevante, incluidas las del arreglo de
  líneas (añadir, quitar, reordenar).

### F9 · El estado de la vista es explícito: cargando, guardando, guardado y error.

**La práctica.** El componente declara tres banderas —`isLoading`, `isSaving`, `hasChanges`— y la
plantilla las usa. Ningún botón se deshabilita «por si acaso»: se deshabilita por una de esas señales.

**Por qué.** Sin banderas explícitas, la interfaz se queda muda durante la petición y el usuario pulsa
dos veces. Un doble envío en un documento crea dos documentos.

**→ Qué hacer.**
- El error de una petición se muestra con el mensaje que devolvió el servicio, no con un «error» genérico
  (y el error se tipa como `unknown` y se estrecha antes de leer `.error.message`).
- Las banderas se apagan en **ambas** ramas (`next` y `error`): una bandera que solo se apaga en el
  camino feliz deja el botón cargando para siempre.
- Toda actualización de estado en un componente con detección de cambios `OnPush` termina en una marca
  de verificación (F18).

### F10 · Alta y edición en el mismo formulario, y el formulario de línea en su propio grupo.

**La práctica.** El identificador de la ruta decide si es alta o edición. Las líneas son un **arreglo de
formularios** con un constructor tipado por línea, y **la misma** función construye la línea cuando
viene del servidor y cuando la añade el usuario.

```typescript
get lines(): FormArray {
  return this.form.get('items') as FormArray;
}

private buildLineGroup(line?: Partial<OrderLine>): FormGroup {
  return this.formBuilder.group({
    itemId: [line?.item?.id ?? null, Validators.required],
    quantity: [line?.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
    price: [line?.price ?? 0, [Validators.required, Validators.min(0)]],
    discountPct: [line?.discountPct ?? 0],
  });
}

addLine(line?: Partial<OrderLine>) {
  this.lines.push(this.buildLineGroup(line));
  this.hasChanges = this.checkDirty();
}

removeLine(index: number) {
  this.lines.removeAt(index);
  this.hasChanges = this.checkDirty();
}
```

**Por qué.** Dos constructores de línea (uno para hidratar y otro para añadir) es la forma más común de
que un campo aparezca solo cuando el usuario añade la línea a mano. Y sin el `hasChanges` en las
mutaciones del arreglo, el botón de guardar se queda deshabilitado en un formulario que el usuario acaba
de cambiar.

**→ Qué hacer.**
- El identificador de la ruta `new` no es un identificador: `isEditing` es `id && id !== 'new'`.
- Al hidratar, distingue las líneas **existentes** (que traen identificador) de las nuevas, si el
  backend necesita esa distinción al actualizar.
- Cierra el ciclo con una prueba que recorra el flujo completo y afirme que **el vínculo con el
  documento de origen sobrevivió** (ver F20).

---

## D. Controles de formulario propios

### F11 · Todo control propio es un `ControlValueAccessor` y todo control tiene nombre accesible.

**La práctica.** Un selector de entidad (o cualquier control que no sea un `input` nativo) implementa
`ControlValueAccessor` para poder usarse con `formControlName`, y **siempre** se envuelve en un campo
etiquetado que enlaza su `for` con el `id` del control.

```html
<app-form-field label="Tercero" inputId="order-partner" [required]="true">
  <app-partner-selector
    [id]="'order-partner'"
    formControlName="partnerId"
  ></app-partner-selector>
</app-form-field>
```

Y el control **reenvía** ese `id` a su elemento disparador:

```typescript
@Input() id?: string;
// en la plantilla del control:
<button type="button" [attr.id]="id" (click)="open()">…</button>
```

**Por qué.** Un control sin `ControlValueAccessor` no participa del formulario (no se valida, no entra
en `valueChanges`, no se marca como tocado). Y un control sin etiqueta asociada no tiene nombre
accesible: un lector de pantalla anuncia «botón», y el formulario deja de ser usable sin ratón. Es un
defecto que ningún tipo detecta.

**→ Qué hacer.**
- Un contrato visual **único** para todos los selectores de entidad de la aplicación (mismo alto, mismo
  borde, mismo icono de flecha, misma variante compacta). Si cada selector se diseñó por su cuenta, la
  pantalla se ve distinta según el campo.
- La variante `compact` es para celdas de tabla y líneas de documento; el alto de la variante compacta
  se declara **una vez**, no por selector.
- Un `inputId` que no coincide con el `[id]` del control rompe la asociación **en silencio**: se ve
  bien y no funciona.
- Los controles de solo lectura muestran el valor en un elemento de lectura, no en un campo
  deshabilitado.

---

## E. Tablas, líneas y pestañas

### F12 · Nada de tablas crudas para datos editables.

**La práctica.** Los datos tabulares se pintan con el componente de tabla de la librería, tanto si la
fuente es un arreglo de datos como si es un arreglo de formularios. Una tabla HTML cruda es la
excepción declarada (una matriz de permisos, una previsualización), nunca la norma.

**Por qué.** Una tabla cruda se salta el sistema de diseño: pierde la densidad configurable, el
comportamiento responsive, la reordenación y visibilidad de columnas, y el estado vacío. Y como no
tiene reglas, cada una se ve distinto.

**→ Qué hacer.**
- Columnas declaradas como **datos** (clave, etiqueta, ancho, tipo, alineación), no repetidas en la
  plantilla.
- El tipo `custom` para celdas con controles, y un tipo `actions` aparte para las acciones: mezclar
  acciones dentro de la plantilla de celda rompe la alineación y las pruebas.
- Cuando renombres columnas, **cambia la clave** de la tabla: las preferencias de columnas guardadas en
  el navegador pisarán las etiquetas nuevas.
- Las etiquetas de columna son legibles («Nº de cuota», «Plazo (días)»), no abreviaturas crípticas.

### F13 · Las líneas de un documento van en su propio contenedor con pestañas fijas.

**La práctica.** En un documento comercial, las líneas se montan en el componente de líneas del sistema
de diseño, con **una pestaña por faceta** (detalle, descuentos, costes, impuestos, campos propios) y las
pestañas declaradas de forma fija, no inventadas por pantalla.

**Por qué.** Un documento tiene más información por línea de la que cabe en una fila. Repartirla en
pestañas fijas hace que el usuario encuentre el descuento siempre en el mismo sitio; dejar que cada
pantalla invente sus pestañas hace que aprender una no sirva para la siguiente.

**→ Qué hacer.**
- Los totales por pestaña y el totalizador del documento se calculan con la **misma** función pura que
  usa el resto del formulario: dos cálculos del mismo número divergen.
- La validación de una línea (cantidad mayor que cero, artículo obligatorio) vive en el grupo de la
  línea, no en un `if` del guardado.
- Un formulario con líneas **no** se guarda si alguna línea es inválida: se marca la pestaña que
  contiene el error y se navega a ella.

### F14 · Pestañas: claves de texto, elementos nativos y responsive.

**La práctica.** Una clave de pestaña es un **texto** semántico, no un índice. Las pestañas son botones
nativos con una clase compartida; su contenido se renderiza condicionalmente. En móvil se envuelven o
se desplazan, nunca se salen.

**Por qué.** Un índice numérico se rompe en cuanto alguien reordena o esconde una pestaña: el índice 2
pasa a ser otra cosa y nadie ve el error. Y adoptar un componente de pestañas de terceros suele traer
hacks de encapsulación y problemas de hidratación en el servidor.

**→ Qué hacer.**
- `activeTab = 'general'` y `@switch`/`@if` sobre la clave.
- Cada pestaña lleva su etiqueta accesible e icono propio; sin iconos si solo hay una pestaña.
- En móvil: `flex-wrap: wrap` con ancho mínimo cuando hay muchas pestañas cortas, `overflow-x: auto`
  cuando hay pocas y largas. Siempre reduciendo el relleno.
- Un componente de pestañas que exige desactivar la encapsulación de estilos **no se adopta**: se
  envuelve o se sustituye.

### F15 · Los estados vacíos son accionables y están acentuados.

**La práctica.** Todo listado y toda sección que pueda estar vacía muestra un estado vacío con icono,
título y —cuando el usuario puede crear el primer registro— una acción. El texto va acentuado y
correcto.

**Por qué.** El estado vacío es **el primer texto que ve un usuario nuevo**: es la única pantalla que
se lee el primer día. Un «Sin registros» mal acentuado, o sin acción, es la primera impresión del
producto.

**Caso (generalizado).** Una auditoría de textos encontró **18** estados vacíos sin sus acentos y **7**
botones fuera de la convención. **No había gate de textos**: el cierre fue un inventario **manual**, que
es exactamente la razón por la que sobrevivieron. Trata cualquier afirmación sobre los textos como no
verificada hasta que revises las plantillas.

---

## F. Estado, asincronía y detección de cambios

### F16 · Los catálogos se cargan en paralelo, la ruta se resuelve con cambio de observable.

**La práctica.** Un formulario que necesita tres catálogos y un documento hace **una** composición en
paralelo, y el parámetro de la ruta se convierte en petición con un cambio de observable:

```typescript
forkJoin({
  partners: this.partnersService.getAll(),
  warehouses: this.warehousesService.getAll(),
  doc: this.route.paramMap.pipe(
    switchMap((params) => {
      const id = params.get('id');
      return id && id !== 'new' ? this.service.getOne(Number(id)) : of(null);
    }),
  ),
}).subscribe({
  next: ({ partners, warehouses, doc }) => {
    this.partners = partners;
    this.warehouses = warehouses;
    if (doc) this.patchForm(doc);
  },
  error: (err: unknown) => this.showError(err),
});
```

**Por qué.** En cadena, tres catálogos son tres viajes de ida y vuelta antes de que el formulario
pinte: el usuario ve un formulario vacío y luego todo a la vez. Y `switchMap` cancela la petición
anterior cuando el parámetro cambia: sin él, navegar rápido entre dos documentos pinta el que llegó
último, que no es el que está en la URL.

### F17 · Señales para el estado local; sin almacén global.

**La práctica.** El estado local de la interfaz (un panel abierto, la fila con el menú desplegado, un
filtro) usa señales. No hay almacén global; el estado compartido vive en servicios con `BehaviorSubject`
solo cuando **de verdad** se comparte entre componentes que no son padre e hijo.

**Por qué.** Un almacén global para estado de pantalla convierte cada pantalla en dependiente de todas
las demás: el estado que nadie limpió reaparece al volver a entrar. Y para lo que sí se comparte
(sesión, preferencias), un servicio es suficiente.

### F18 · `OnPush` obliga a marcar la verificación tras cada cambio asíncrono.

**La práctica.** Con detección de cambios `OnPush`, **cada** manejador asíncrono termina marcando la
verificación (`markForCheck()`), y las actualizaciones que deben ser inmediatas (escribir un valor en
un control, mutar un arreglo) se hacen con la detección explícita y sin emitir eventos cuando
corresponde.

**Por qué.** `OnPush` no es una optimización opcional: es un contrato. Si el componente no marca la
verificación, la vista se queda con el valor viejo **hasta el siguiente evento de usuario**, y el
síntoma («los datos no aparecen hasta que hago clic») se atribuye a la petición, no a la detección.

**→ Qué hacer.**
- Marca la verificación en `next` **y** en `error`: la bandera de carga debe apagarse también cuando
  falla.
- Usa `emitEvent: false` al parchear el formulario con datos del servidor, para no disparar el ciclo
  sucio ni validaciones prematuras.
- Un `writeValue` de un `ControlValueAccessor` actualiza la vista de forma síncrona.

---

## G. Estilo: tokens, especificidad y responsive

### F19 · Ningún valor visual a mano: tokens, y un solo sistema de tokens por fichero.

**La práctica.** Colores, espaciados, tipografías, radios, sombras y transiciones salen de **tokens**.
No se escribe `#2563eb`, ni `16px`, ni `0.15s`. Y si conviven dos familias de tokens (una heredada y
una nueva), un fichero usa **una** y no las mezcla.

**Por qué.** Un valor a mano es una decisión que no se puede cambiar en un sitio. Y mezclar dos
sistemas de tokens en el mismo bloque produce el defecto más caro de diagnosticar: el modo oscuro
funciona en unas pantallas y en otras no.

**→ Qué hacer.**
- Si añades un token, añade también su variante oscura: un token sin variante es una pantalla rota en
  oscuro que nadie ve hasta que alguien cambia el tema.
- El tema se selecciona por un **atributo en la raíz** (`[data-theme='dark']`; el nombre del atributo y de
  sus valores son los de tu proyecto), nunca con la consulta de preferencia del sistema: eso ignora la
  preferencia **guardada** por el usuario.
- La densidad (compacta/espaciosa) se expresa con **variables por componente** y un valor base que no
  cambia el aspecto actual; el modo espacioso solo relaja. Un `px` crudo en relleno, hueco, tamaño de
  fuente o alto es un rechazo, no un aviso.

**Caso (generalizado).** Envolver las ~176 clases de un módulo con encapsulación desactivada en un
selector de ámbito subió su CSS de **36,67 kB a 40,78 kB (+11,2 %)** y **no arregló ninguna fuga real**.
La conclusión quedó escrita: **prefiere un gate a una envoltura masiva**.

### F20 · Nunca `!important`: se gana por especificidad, y el ámbito se hace con `:where`.

**La práctica.** Para sobreescribir un componente de la librería se repite la clase propia
(`.field.field .input { … }`) y se gana por especificidad. Y cuando un componente con encapsulación
desactivada emite CSS global, sus clases genéricas se limitan con `:where(<host>)`, que **no aporta
especificidad**.

**Por qué.** `!important` gana la batalla y pierde la guerra: el siguiente que necesite sobreescribir
usa dos, y la cascada deja de ser predecible. Y `:where()` aporta **0** de especificidad: la regla deja
de aplicarse fuera del componente **y conserva su lugar exacto en la cascada interna**.

**Caso (generalizado).** Un prefijo de host sin `:where` (`.app-modulo .algo`) subió la especificidad de
(0,1,0) a (0,2,0) y cambió el aspecto **dentro** del componente: el icono de marca pasó de blanco a
gris. Medido y escrito al lado de la regla, para que nadie lo «arregle» dentro de un mes.

**Caso (generalizado) del ámbito mal puesto.** Un script que prefijaba reglas **anidadas** produjo un
selector con el host **dentro** del contenedor (`.barra :where(.app-modulo) .filtro`), que nunca casa:
**4** reglas de búsqueda dejaron de aplicarse y **ningún gate lo notó**. Regla que quedó escrita:
**al limitar el ámbito, comprueba que la regla es de primer nivel.**

**→ Qué hacer.**
- Cuando un `!important` o una desactivación de encapsulación sean inevitables, exige un **marcador con
  el motivo** en la misma línea (o en las dos líneas anteriores, o en las primeras 30 del fichero) y un
  gate que cuente los que quedan. Un `!important` sin motivo escrito es deuda invisible.
- Antes de forzar, prueba las recetas de personalización: una variante del componente, una variable CSS
  que el primitivo ya consume, o una propiedad publicada desde la plantilla cuando lo que se pelea es un
  estilo en línea.

### F21 · Responsive: se colapsa solo, y el desbordamiento horizontal tiene una causa concreta.

**La práctica.** Los formularios y los listados **no** llevan estilos móviles propios: las rejillas de
formulario colapsan y la tabla se convierte en tarjetas por sí solas. Lo que sí se escribe es la
prevención del desbordamiento horizontal, que **siempre** tiene la misma causa: un texto largo dentro
de un contenedor flexible.

```scss
// 1) el hijo flexible puede encogerse
.control { flex: 1 1 0%; min-width: 0; overflow: hidden; }

// 2) el texto se recorta con puntos suspensivos
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

**Por qué.** Un elemento flexible tiene `min-width: auto`: no se encoge por debajo del ancho de su
contenido, y un nombre largo estira la página entera. El usuario no ve «un nombre largo»: ve que la
pantalla se desplaza de lado y no puede llegar al botón.

**→ Qué hacer.**
- Usa los **tokens de punto de ruptura** (`$breakpoint-md`…), nunca un `@media (max-width: 768px)`
  literal: el día que cambie un punto de ruptura, los literales se quedan atrás.
- Nunca escondas una acción crítica en móvil: si no cabe, envuelve o muévela a la barra de acciones.
- En un componente de librería o un control propio, declara el host en **bloque** y a todo el ancho:

  ```scss
  :host { display: block; width: 100%; }
  ```

**Caso (generalizado).** Un elemento personalizado sin `display` explícito se comporta como **en línea**
en muchos navegadores: ignora `width: 100%` y se estira con su contenido. Le pasó a **tres**
componentes reutilizables a la vez (la tabla, la tarjeta y un selector), y el síntoma era «la tabla se
encoge en móvil» y «la tarjeta se sale de su columna».

---

## H. Accesibilidad

### F22 · Un solo título de primer nivel, sin saltos de nivel, y todo control con nombre.

**La práctica.** Seis reglas, todas verificables:

| # | Regla | Cómo se consigue |
|---|---|---|
| 1 | **Un solo `h1` por página**: el título del listado o el del formulario | el `h1` se estiliza por clase, no por etiqueta |
| 2 | **Sin saltos de nivel**: bajo el `h1`, todo es `h2` | el tamaño viene de la clase, no de la etiqueta («`h3` para que se vea más pequeño» es el antipatrón) |
| 3 | **Todo control tiene nombre accesible** | dentro de un campo etiquetado lo hereda; fuera (filtros, celdas, búsquedas de la barra) hay que pasarlo explícitamente |
| 4 | **Los botones de solo icono** llevan una acción con nombre o una etiqueta accesible | el icono no es texto |
| 5 | **El texto visible es el nombre accesible** (WCAG 2.5.3): no se pone una etiqueta accesible distinta del texto del botón | quien usa dictado por voz dice lo que ve |
| 6 | **Contraste AA**: para texto se usan los tokens de **texto**, no los de marca | un color de marca como texto suele quedar por debajo del mínimo |

**Por qué.** La accesibilidad no es una capa que se añade al final: es una propiedad de la plantilla.
Y la única forma de que sobreviva es que sea **medible**: si no hay un comando que la compruebe, la
regla es un deseo.

**→ Qué hacer.**
- Mide, no adivines: una auditoría automática de accesibilidad **no puede** auditar una aplicación de
  una sola página con sesión iniciada —la herramienta acaba en la pantalla de acceso—. Se mide
  **inyectando el analizador en una sesión de navegador real** y corriendo el análisis sobre el
  documento. Fija una línea base (por ejemplo, las páginas autenticadas con **0** violaciones) y
  defiéndela con un gate.
- Los contenedores de menú no llevan ARIA a mano: el componente lo cablea. Si lo escribes tú, lo
  rompes.

---

## I. Pruebas

### F23 · Pruebas de componente y de servicio con dobles, sin servidor.

**La práctica.** El servicio se prueba con el módulo de pruebas de HTTP y el controlador de pruebas
(petición esperada, método, cuerpo, respuesta simulada). El componente se prueba importando el
**componente standalone** y doblando **todos** los servicios que hacen HTTP o muestran interfaz.

```typescript
it('pide la lista con los parámetros de la consulta', () => {
  service.getAll({ page: 1, limit: 20, search: 'texto' }).subscribe((res) => {
    expect(res.data.length).toBe(1);
  });

  const req = httpMock.expectOne(
    `${environment.apiUrl}/orders?page=1&limit=20&search=texto`,
  );
  expect(req.request.method).toBe('GET');
  req.flush({ data: [{ id: 1 }], total: 1, page: 1, limit: 20, totalPages: 1 });
});

afterEach(() => httpMock.verify()); // sin esto, una petición no esperada pasa en silencio
```

**Por qué.** Una prueba de componente que habla con el servidor deja de ser una prueba y pasa a ser una
integración lenta y frágil. Y el `verify()` del controlador de pruebas es la mitad del valor: convierte
«no falló» en «no sobró ninguna petición».

**→ Qué hacer.**
- Provee el enrutador en las pruebas de componentes que navegan (`provideRouter([])`): sin él, el
  componente no compila y el fallo se lee como si el componente estuviera mal.
- Para retardos y temporizadores, usa el reloj falso de pruebas (`fakeAsync` + `tick`): una prueba de
  búsqueda con retardo sin reloj falso espera de verdad.
- Afirma la **validez del formulario antes** de llamar a guardar, y que guardar **no** llamó al
  servicio cuando era inválido.
- Las pruebas van **al lado** del código, con el sufijo del framework, y el mismo nombre que lo que
  prueban.

### F24 · Contratos de DOM en las pruebas de extremo a extremo: nada de guardas por existencia.

**La práctica.** Nunca se envuelve una aserción en una condición de existencia:

```typescript
// ❌ PROHIBIDO: si el elemento no existe, la comprobación no corre y la prueba sale verde
if ((await page.locator('.algo').count()) > 0) {
  await expect(page.locator('.algo')).toBeVisible();
}

// ✅ el localizador se verifica contra la plantilla y se afirma su existencia
await expect(page.locator('.algo')).toBeVisible();
```

**Por qué.** Una guarda por existencia convierte «no está» y «se llamó de otra forma» en el mismo
silencio. Es un `if` que **oculta el defecto que la prueba existía para encontrar**.

**Caso (generalizado).** **Seis** comprobaciones de un fichero de pruebas **nunca se ejecutaron** por
esta guarda, y **dos** de ellas afirmaban sobre localizadores que **no existen en ninguna plantilla**:
la barra lateral se consultaba con un selector de componente cuando los enlaces reales son clases, y el
paginador se consultaba con tres nombres alternativos cuando el componente tiene otro. La prueba era
verde y no medía nada.

**→ Qué hacer.**
- **Verifica el localizador contra la plantilla** (busca la clase en el código) antes de escribirlo, y
  afirma la existencia de forma explícita.
- Una condición legítima es sobre **estado**, no sobre **existencia**: el diálogo de cambios sin guardar
  solo aparece si el formulario está sucio; el botón «siguiente» está habilitado solo si hay más de una
  página.
- Prefiere aserciones reales a esperas fijas; cuando la prueba necesite datos, usa **ayudantes
  idempotentes** que los creen a través de la API.
- Un gate visual **solo compara estados asentados**.

**Caso (generalizado).** Una línea base capturó un estado **transitorio** (un texto de 58 px en lugar
de los 73 px del estado final). Falla en cuanto cambia el tiempo de carga, con la diferencia
**localizada en una caja**. Se diagnostica **sin mirar la imagen**: un perfil por bandas de filas —para
separar un desplazamiento de un cambio real— y la búsqueda del desplazamiento vertical que mejor encaja
por regiones (el resto del formulario coincidía con un desplazamiento exacto: era una fila nueva).
Congela el reloj, desactiva transiciones y animaciones, y espera a que el contenido volátil esté
**resuelto** antes de comparar.

---

## J. Lineamiento: cómo se trabaja un incremento de interfaz

1. **Mapea la librería antes de escribir nada.** Inventaría los componentes del sistema de diseño y
   sustituye los marcadores de posición de esta skill (`<app-data-table>`, `<app-form-page>`…) por los
   nombres reales. **Si no existen, no los nombres en el código**: usa lo que haya.
2. **Lee la guía canónica del repositorio** (arquitectura de estilos, guía de interfaz). Si discrepa con
   esta skill, **gana la guía**; la discrepancia se anota en la skill del proyecto.
3. **Decide la variante**: listado, formulario de documento o formulario de maestro. No hay una cuarta.
4. **Escribe el servicio y los modelos** (F3, F4): la forma de los datos primero.
5. **Escribe el listado** (F5, F6) y compruébalo con la página vacía.
6. **Escribe el formulario** (F7–F10): armazón, instantánea de cambios sucios, banderas de estado y
   líneas si las hay.
7. **Comprueba accesibilidad y estilo mientras escribes**, no después: nombres accesibles (F11, F22),
   tokens y sin valores a mano (F19), `:host` en bloque (F21).
8. **Escribe las pruebas** (F23) en el mismo incremento, incluido el caso inválido.
9. **Pasa la lista de entrega** y no declares nada verde sin la salida del comando.

### Si la página ya existe y es heredada: se reescribe, no se parchea

Una página heredada se detecta por síntomas inequívocos (falta el contenedor de página, el título es de
primer nivel, los botones son crudos, falta el retardo en la búsqueda, la tabla no tiene clave de
columnas, las acciones de fila son símbolos, los controles de un formulario no tienen etiqueta
asociada, faltan las marcas de verificación de cambios).

**Regla:** ante una página heredada, **no** cambies un botón ni un campo.

1. **Para.**
2. **Reescribe la plantilla** al patrón canónico completo.
3. **Conserva la lógica de negocio**: columnas, llamadas, navegación, validadores.
4. **Añade lo que falta** (imports, sujetos de búsqueda, referencia de destrucción).
5. **Actualiza el servicio** si necesita soportar la búsqueda.
6. **Comprueba la compilación** antes de terminar.

**Por qué.** El parche superficial es peor que no tocar: deja una pantalla que parece nueva en un botón
y sigue siendo heredada en todo lo demás, y la siguiente auditoría vuelve a encontrarla —ahora con dos
estilos mezclados—.

### Lista de entrega del frontend

- [ ] Compila sin errores; revisa el presupuesto de tamaño de estilos por componente y del paquete
      inicial.
- [ ] Lint 0 errores / 0 avisos; sin anotaciones `any` nuevas y sin imports muertos (la causa más común
      de un aviso es un import que sobrevivió a un refactor).
- [ ] Suite de pruebas completa en verde —no solo el fichero tocado—.
- [ ] Tipos de las pruebas de extremo a extremo, formato y accesibilidad comprobados.
- [ ] Gates de estilo en verde: supresiones de CSS contadas, ámbito de estilos, densidad (0 `px` crudos
      en páginas y componentes compartidos).
- [ ] Si cambió una **maqueta de formulario**: regresión visual, y si el cambio es legítimo se regenera
      **solo** la línea base afectada y se dice en el commit (un cambio de línea base es evidencia, no
      ruido).
- [ ] Si cambió un **componente compartido o la maqueta**: gate móvil.
- [ ] Detección de cambios: marca de verificación tras cada cambio asíncrono.
- [ ] Controles nuevos: nombre accesible donde la etiqueta del contenedor no llega; botones de icono con
      su acción.
- [ ] Todo listado nuevo tiene su acción de alta y su estado vacío acentuado.
- [ ] El resultado se documenta donde el proyecto lo busca (bitácora de cambios; registro de auditoría
      si fue un defecto).

---

## Lo que NO entra aquí

Estas prácticas conviven con la **receta de un proyecto concreto**: su sistema de diseño con sus
tokens, su lista de componentes compartidos, sus modelos, sus rutas, sus textos y su vocabulario de
estados. Esa receta **no** se copia a un proyecto nuevo: se queda en su repositorio, porque **nombra
ficheros que en otro proyecto no existen**.

> **El filtro, en una frase:** si al quitar los nombres propios del proyecto la frase deja de ser
> verdad, no es una práctica: es dominio. La práctica se generaliza; el dominio se queda.

Los detalles operativos están en `references/`:

- **Plantillas**: `references/plantillas.md` — servicio, listado, formulario y registro de rutas.
- **Patrones de página**: `references/patrones-de-pagina.md` — listado paso a paso, formulario,
  instantánea sucia, arreglo de líneas, pestañas, estado vacío, control propio y accesibilidad.
- **Pruebas y entrega**: `references/pruebas-y-entrega.md` — recetas de Karma/Jasmine, contratos de DOM,
  gate de estilos, accesibilidad medida y la lista de entrega ampliada.

**Skills hermanas.** `verificacion-y-medicion` (para lo que es *prueba*) y `trampas-conocidas` (para las
clases de defecto que no gritan —hidratación, fechas, dinero, dobles de prueba—).
