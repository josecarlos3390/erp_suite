# Pruebas y entrega (frontend)

Desarrolla **F23, F24** y las listas de entrega.

---

## 1. Servicio, con el controlador de pruebas HTTP

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrdersService } from './orders.service';
import { environment } from '../../../environments/environment';

describe('OrdersService', () => {
  let service: OrdersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrdersService],
    });
    service = TestBed.inject(OrdersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());   // «no falló» → «no sobró ninguna petición»

  it('pide la lista con los parámetros presentes', () => {
    service.getAll({ page: 1, limit: 20, search: 'texto' }).subscribe((res) => {
      expect(res.data.length).toBe(1);
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/orders?page=1&limit=20&search=texto`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ id: 1, code: 'ORD-000001' }], total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('no envía el parámetro de búsqueda cuando está vacío', () => {
    service.getAll({ page: 1 }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/orders?page=1`);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  });

  it('envía el cuerpo tal cual en la creación', () => {
    const payload = {
      partnerId: 1,
      items: [{ itemId: 10, quantity: 2, price: 100 }],
    };
    service.create(payload).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/orders`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 1, code: 'ORD-000001' });
  });
});
```

El segundo caso es el que más defectos caza: un parámetro vacío que viaja cambia la consulta del
servidor, y el listado devuelve otra cosa.

---

## 2. Componente de listado, con dobles

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrdersComponent } from './orders.component';
import { OrdersService } from './orders.service';
import { ToastService } from '../../core/toast/toast.service';

class MockOrdersService {
  getAll = jasmine.createSpy('getAll').and.returnValue(of({
    data: [{ id: 1, code: 'ORD-000001', partner: { name: 'Tercero A' }, total: 100, status: 'OPEN' }],
    total: 1, page: 1, limit: 20, totalPages: 1,
  }));
  close = jasmine.createSpy('close').and.returnValue(of({}));
  cancel = jasmine.createSpy('cancel').and.returnValue(of({}));
}

class MockToastService { success = jasmine.createSpy('success'); error = jasmine.createSpy('error'); }

describe('OrdersComponent', () => {
  let component: OrdersComponent;
  let fixture: ComponentFixture<OrdersComponent>;
  let service: MockOrdersService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersComponent],                 // componente standalone, directo
      providers: [
        provideRouter([]),                        // sin esto, no compila si navega
        { provide: OrdersService, useClass: MockOrdersService },
        { provide: ToastService, useClass: MockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(OrdersService) as unknown as MockOrdersService;
    fixture.detectChanges();
  });

  it('carga el listado al iniciar', () => {
    expect(service.getAll).toHaveBeenCalled();
    expect(component.orders.length).toBe(1);
  });

  it('vuelve a la página 1 al cambiar un filtro', () => {
    component.page = 7;
    component.onFilterChange();
    expect(component.page).toBe(1);
  });
});
```

---

## 3. Componente de formulario

```typescript
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrdersFormComponent } from './orders-form.component';

const routeNew = { snapshot: { paramMap: { get: () => 'new' } } };

class MockOrdersService {
  create = jasmine.createSpy('create').and.returnValue(of({ id: 1 }));
  update = jasmine.createSpy('update').and.returnValue(of({ id: 1 }));
  getOne = jasmine.createSpy('getOne').and.returnValue(of({ id: 1, partnerId: 1, items: [] }));
}

describe('OrdersFormComponent', () => {
  let component: OrdersFormComponent;
  let fixture: ComponentFixture<OrdersFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersFormComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeNew },
        { provide: OrdersService, useClass: MockOrdersService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('añade y quita líneas', () => {
    component.addLine();
    component.addLine();
    expect(component.lines.length).toBe(2);
    component.removeLine(0);
    expect(component.lines.length).toBe(1);
  });

  it('no guarda si el formulario es inválido', () => {
    const svc = TestBed.inject(OrdersService) as unknown as MockOrdersService;
    component.form.patchValue({ partnerId: null });
    component.save();
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('marca cambios sucios al añadir una línea', () => {
    expect(component.hasChanges).toBe(false);   // el alta empieza «cambiable» en el original
    component.addLine();
    expect(component.hasChanges).toBe(true);
  });

  it('espera el retardo de búsqueda con reloj falso', fakeAsync(() => {
    const svc = TestBed.inject(OrdersService) as unknown as MockOrdersService;
    component.onSearch('a');
    component.onSearch('ab');
    tick(400);
    expect(svc.getAll).toHaveBeenCalledTimes(1);   // una sola, no dos
  }));
});
```

---

## 4. Ejecutar una prueba suelta

```bash
# toda la suite (abre navegador)
npm test

# un solo fichero, sin cabeza de navegador
npx ng test --include="**/orders.service.spec.ts" --watch=false --browsers=ChromeHeadless

# un solo componente
npx ng test --include="**/orders.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

**Nunca** corras la suite de pruebas unitarias y la de extremo a extremo a la vez: compiten por el
navegador y por el servidor de desarrollo, y los fallos no reproducen en aislamiento. Y no edites el
código mientras una corrida de extremo a extremo está en vuelo: el servidor reconstruye y la corrida lee
una aplicación a medio construir.

---

## 5. Contratos de DOM en las pruebas de extremo a extremo

### 5.1 La guarda por existencia está prohibida

```typescript
// ❌ si el elemento no está, la comprobación no corre y la prueba sale verde
if ((await page.locator('.orders-table').count()) > 0) {
  await expect(page.locator('.orders-table')).toBeVisible();
}

// ✅
await expect(page.locator('.orders-table')).toBeVisible();
```

**Caso (generalizado).** **Seis** comprobaciones de un fichero **nunca se ejecutaron** por esta guarda, y
**dos** afirmaban sobre localizadores que **no existen en ninguna plantilla**: la barra lateral se
consultaba por el selector del componente cuando los enlaces reales son clases, y el paginador por tres
nombres alternativos cuando el componente tiene otro. Antes de escribir un localizador, **búscalo en la
plantilla**.

### 5.2 Las condiciones legítimas son sobre estado, no sobre existencia

| Legítimo | Ilegítimo |
|---|---|
| el diálogo de cambios sin guardar solo aparece si el formulario está sucio | «si el elemento existe, compruébalo» |
| el botón «siguiente» está habilitado solo si hay más de una página | «si el paginador existe, pulsa siguiente» |
| el aviso aparece solo si el documento está cerrado | «si el aviso existe…» |

### 5.3 Los datos los crea la prueba, con ayudantes idempotentes

Un caso de extremo a extremo **crea lo que mide**. Un verde que depende del estado acumulado de la
máquina de desarrollo no es un verde: cuando el entorno está limpio, falla.

**Caso (generalizado).** Tres casos de un flujo de integración continua pasaban solo con el estado
acumulado de la máquina: uno dependía de credenciales que vivían en un fichero **no versionado**
(falló con `401` y dejó **264** casos sin ejecutar); otro tomaba «hoy» del reloj de la máquina en lugar
de la zona del negocio (sus **5** casos se rechazaban como futuros cuando el ejecutor corría en UTC); y
el tercero necesitaba datos que un script había dejado en la base (el selector buscaba una fila que la
semilla no crea). **Los cuatro casos resultantes pasan en un entorno limpio sin relajar una sola
aserción.**

Consecuencias prácticas:

- Un ayudante idempotente por dato requerido (`ensureExchangeRate`, `ensureOpenPeriod`,
  `ensureDocumentSeries`, `ensureTerminal`), invocado por el caso.
- Sustituye un `test.skip` condicional por una aserción real: un caso que se salta solo es un caso que ya
  no existe.
- Los contadores de series de QA, **altos**: dos series activas del mismo tipo comparten prefijo y
  colisionan contra el índice único.
- Un `429` local tras varias corridas seguidas suele ser el limitador del servidor de desarrollo, no un
  defecto del producto: reinicia el servidor antes de culpar a la prueba.

### 5.4 El gate visual solo compara estados asentados

Congela el reloj, desactiva transiciones y animaciones, y espera a que el contenido volátil esté
resuelto antes de comparar.

**Caso (generalizado).** Una línea base capturó un estado **transitorio** (un texto de 58 px en lugar de
los 73 px del estado final). Falla en cuanto cambia el tiempo de carga, con la diferencia **localizada en
una caja**. Se diagnostica **sin mirar la imagen**: un perfil por **bandas de filas** —separa un
desplazamiento de un cambio real— y la búsqueda del **desplazamiento vertical** que mejor encaja por
regiones (el resto de la pantalla coincidía con un desplazamiento exacto: era una fila nueva).

### 5.5 La trazabilidad, probada por el vínculo

Cuando un documento se crea a partir de otro, el caso de extremo a extremo debe afirmar que **el vínculo
sobrevivió** (el identificador de la línea de origen del documento creado es el de la línea del
documento de origen), no solo que la respuesta fue correcta.

**Caso (generalizado).** Un mapeador emitía el identificador de la línea de origen con el nombre propio
del documento, y el constructor compartido de líneas **no lo conocía**: se caía en silencio (el
serializador **omite** las claves `undefined`) y el guardado salía sin él, con un error del backend que
*parecía* suyo. Reglas que quedaron escritas:

1. Añadir un mapeador o un campo de trazabilidad obliga a añadir su control al constructor compartido
   **y** a leerlo en el cuerpo que se envía.
2. Al diagnosticar, reproduce contra la API **el cuerpo exacto** que envía el formulario: la diferencia
   entre `undefined` (clave omitida) y un valor equivocado **es** el diagnóstico entero.
3. Deja una prueba que recorra el flujo completo y afirme **el vínculo**: una prueba del cuerpo por
   separado no habría cazado el hueco de la hidratación.

---

## 6. Puertas de estilo, accesibilidad y densidad

| Puerta | Qué rechaza |
|---|---|
| Formato | deriva del formateador en el código de pruebas y en **todo** el SCSS |
| Tipos de las pruebas de extremo a extremo | errores de tipo en el árbol de pruebas |
| Supresiones de CSS | cada `!important` sin marcador con motivo |
| Encapsulación | cada desactivación de encapsulación sin marcador con motivo |
| Ámbito de estilos globales | una clase de un módulo con encapsulación desactivada usada fuera de él sin `:where` |
| Densidad | `px` crudos en relleno, hueco, tamaño de fuente y alto; tablas crudas sin regla de densidad; variables de CSS sin definir |
| Alturas | cualquier alto crudo que quede en páginas y componentes compartidos |
| Accesibilidad | botones de solo icono sin acción, imágenes sin texto alternativo, controles sin nombre accesible |
| Textos | **no hay puerta**: es inventario manual (por eso sobreviven los defectos de texto) |

**El marcador** lleva el motivo en la misma línea, en las dos anteriores, o en las primeras 30 del
fichero. Antes de usarlo, prueba las recetas de personalización (variante del componente, variable CSS
que el primitivo ya consume, propiedad publicada desde la plantilla).

**Orden de verificación** (de lo barato a lo caro, para que una regla nueva no bloquee todo el trabajo
durante diez minutos): compilación → lint → tipos de pruebas y formato y accesibilidad → puertas de
estilo → suite unitaria → regresión visual → gate móvil → flujo funcional completo.

---

## 7. Lista de entrega, ampliada

- [ ] Compilación limpia; revisa el presupuesto de tamaño de estilos por componente y del paquete
      inicial (los avisos de presupuesto preexistentes se declaran como tales, no se silencian).
- [ ] Lint 0 errores / **0 avisos**; sin `any` nuevos; sin imports muertos.
- [ ] Suite unitaria completa en verde, no solo el fichero tocado.
- [ ] Tipos de las pruebas de extremo a extremo + formato + accesibilidad en verde.
- [ ] Supresiones de CSS, ámbito de estilos y densidad en verde (con marcador justificado solo cuando el
      motivo es real).
- [ ] Si cambió una **maqueta de formulario**: regresión visual; y si el cambio es legítimo, se regenera
      **solo** la línea base afectada y se dice en el commit y en la bitácora.
- [ ] Si cambió un **componente compartido o la maqueta**: gate móvil.
- [ ] `OnPush`: marca de verificación tras cada cambio asíncrono; actualización síncrona al escribir un
      valor; mutaciones del arreglo de líneas con las banderas actualizadas.
- [ ] Controles nuevos: nombre accesible donde la etiqueta del contenedor no llega; botones de solo icono
      con su acción.
- [ ] Todo listado nuevo tiene su botón de alta y su estado vacío acentuado.
- [ ] La página está alcanzable desde la navegación, no solo por URL.
- [ ] El resultado se documenta donde el proyecto lo busca (bitácora de cambios; registro de auditoría si
      fue un defecto), con el comando que produjo cada número.
