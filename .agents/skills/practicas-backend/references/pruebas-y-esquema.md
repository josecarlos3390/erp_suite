# Pruebas, esquema y datos masivos

Desarrolla **P18–P22**. Recetas genéricas: sustituye nombres antes de copiar.

---

## 1. Doble del cliente del ORM (unitario)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { PrismaService } from '../../db/prisma.service';
import type { CreateOrderDto } from '../dto/create-order.dto';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockTx = {
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    orderLine: { createMany: jest.fn(), deleteMany: jest.fn() },
    partner: { findFirst: jest.fn() },
    item: { findMany: jest.fn() },
    stock: { upsert: jest.fn(), updateMany: jest.fn() },
  };

  const mockDb = {
    // El doble de la transacción INVOCA el callback con el cliente simulado.
    // Sin esto, las aserciones sobre las escrituras pasan en vacío.
    $transaction: jest.fn(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    ),
    order: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockSettings = {
    getAll: jest.fn().mockResolvedValue({ useInclusiveTax: false }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockDb },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get(OrdersService);
    jest.clearAllMocks(); // sin esto, «no se llamó» mide las llamadas de otra prueba
  });

  it('crea el documento con líneas y devuelve el agregado', async () => {
    const dto = {
      partnerId: 1,
      items: [{ itemId: 10, quantity: 2 }],
    } satisfies Partial<CreateOrderDto>;

    mockTx.partner.findFirst.mockResolvedValue({ id: 1, name: 'Tercero A' });
    mockTx.item.findMany.mockResolvedValue([{ id: 10, price: 100, cost: 60 }]);
    mockTx.order.create.mockResolvedValue({ id: 1, code: 'ORD-000001' });
    mockTx.order.findUniqueOrThrow.mockResolvedValue({
      id: 1, code: 'ORD-000001', items: [{ id: 1, itemId: 10, quantity: 2 }],
    });

    const result = await service.create(dto as unknown as CreateOrderDto, 99, 1);

    expect(mockDb.$transaction).toHaveBeenCalled();      // se abrió transacción
    expect(mockTx.order.create).toHaveBeenCalled();      // y se escribió dentro
    expect(result.code).toBe('ORD-000001');              // y se DEVOLVIÓ el agregado
  });

  it('rechaza el alta si el tercero no existe', async () => {
    const dto = { partnerId: 1, items: [] } satisfies Partial<CreateOrderDto>;
    mockTx.partner.findFirst.mockResolvedValue(null);

    await expect(
      service.create(dto as unknown as CreateOrderDto, 99, 1),
    ).rejects.toThrow(BadRequestException);
    expect(mockTx.order.create).not.toHaveBeenCalled();  // no se escribe nada
  });

  it('lanza «no encontrado» cuando el documento no es del inquilino', async () => {
    mockDb.order.findFirst.mockResolvedValue(null);
    await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
  });
});
```

### Lo que hay que mirar en un doble de este tipo

| Detalle | Por qué importa |
|---|---|
| `$transaction` invoca el callback | si no, no se ejecuta nada y la prueba es verde por vacío |
| `jest.clearAllMocks()` en `beforeEach` | sin él, las aserciones negativas mienten |
| Se afirma el **valor de retorno** | caza el `201 {}` (transacción sin `return`) |
| Se afirma la **rama de fallo** | la mitad del contrato es lo que se rechaza |
| Los dobles se tipan (`as unknown as T`, `satisfies Partial<T>`) | la regla del `any` vale también en pruebas |
| La lectura que el servicio espera devuelve algo plausible | un `undefined` del doble hace fallar la prueba por el doble |

---

## 2. Doble del controlador

Si el controlador solo traduce, su prueba afirma **la traducción**: que parseó los query params y que
firmó la llamada con el autor y el inquilino correctos.

```typescript
describe('OrdersController', () => {
  const mockService = {
    create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), close: jest.fn(), cancel: jest.fn(),
  };
  const mockUser = { sub: 99, tenantId: 1, role: 'ADMIN' };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockService }],
    }).compile();
    controller = module.get(OrdersController);
    jest.clearAllMocks();
  });

  it('parsea la paginación antes de delegar', async () => {
    mockService.findAll.mockResolvedValue({
      data: [], total: 0, page: 2, limit: 50, totalPages: 0,
    });

    await controller.findAll(mockUser, '2', '50', 'termino', 'OPEN');

    expect(mockService.findAll).toHaveBeenCalledWith(
      { page: 2, limit: 50, search: 'termino', status: 'OPEN' },
      1,
    );
  });
});
```

Si el controlador necesita el cliente del ORM (porque resuelve algo en el borde), el módulo de prueba
tiene que proveerlo: un controlador con una dependencia sin proveer falla al compilar el módulo, no al
ejecutar la prueba.

---

## 3. Qué se prueba con base real (integración)

Un comportamiento con **efecto real** no está probado por una prueba con dobles: los dobles devuelven
exactamente lo que la prueba necesita. Se cubre con las dos mitades:

```typescript
it('confirmar genera un asiento cuadrado y anularlo lo revierte', async () => {
  const document = await createDocumentThroughApi({ items: [{ itemId: 10, quantity: 2 }] });
  await confirmThroughApi(document.id);

  const entry = await prisma.journalEntry.findFirst({
    where: { docType: 'ORDER', docId: document.id, tenantId },
    include: { lines: true },
  });

  const debit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const credit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
  expect(round2(debit)).toBe(round2(credit));
  expect(entry.lines.some((l) => Number(l.taxAmount) > 0)).toBe(true);

  await cancelThroughApi(document.id);
  const reversal = await prisma.journalEntry.findFirst({
    where: { docType: 'ORDER', docId: document.id, reversalOf: entry.id },
  });
  expect(reversal).not.toBeNull();
});
```

Reglas de las pruebas de integración:

- **Cada prueba crea lo que mide.** Un verde que depende del estado acumulado de la máquina de
  desarrollo no es un verde.
- Los datos que hagan falta se crean con ayudantes **idempotentes** (`ensureExchangeRate`,
  `ensureOpenPeriod`, `ensureDocumentSeries`, `ensureTerminal`), invocados por la prueba. Un
  `test.skip` condicional es una prueba que ya no existe.
- Las credenciales y URLs salen **del entorno**, nunca de un literal en el fichero de prueba (una
  contraseña en la historia del repositorio hay que rotarla, no solo borrarla del código).
- La **zona horaria del proceso se declara**: si el dominio tiene fechas de negocio, una prueba que no
  fija la zona solo pasa en la zona de quien la escribió.
- Las pruebas de integración que reescriben una base **no se corren en paralelo** con otras que usan la
  misma base: el resultado es un fallo que no reproduce en aislamiento.

---

## 4. Cambiar el esquema cuando la base tiene deriva

Cuando la base real no coincide con las migraciones versionadas, el gestor de migraciones pide un
**reset** —y el reset borra datos—. El procedimiento real:

```bash
# 1. Escribe el cambio en el esquema y VALÍDALO
npx prisma validate

# 2. Genera el delta entre la BASE VIVA y el esquema nuevo (no a mano)
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script

# 3. Guárdalo como migración y haz el DDL IDEMPOTENTE:
#    ADD COLUMN IF NOT EXISTS; claves ajenas dentro de un bloque condicional;
#    prisma/migrations/<timestamp>_<nombre>/migration.sql

# 4. Ejecútalo contra la base y REGÍSTRALO como aplicado
npx prisma db execute --schema prisma/schema.prisma --file <migración>.sql
npx prisma migrate resolve --applied <timestamp>_<nombre>

# 5. Regenera el cliente (con el servidor parado: el cliente puede tener el binario abierto)
npx prisma generate
```

**Por qué idempotente.** Un despliegue que aplica las migraciones **y** los SQL manuales de deriva
puede ejecutar el mismo script dos veces. Un `CREATE`/`ALTER` no idempotente deja la migración aplicada
a medias y **sin registrar**, y el gestor se queda bloqueado en estado «migración fallida» (`P3009`).

Lista de comprobación del cambio de esquema:

- [ ] `validate` en verde **antes** de generar el delta.
- [ ] El SQL generado se ha **leído** (es donde se ve si algo se va a borrar).
- [ ] El DDL es idempotente y el script se puede correr dos veces sin romper.
- [ ] La migración queda **registrada como aplicada**, no solo ejecutada.
- [ ] El cliente del ORM se ha regenerado después, con el servidor parado.
- [ ] Los datos derivados se re-alinean con un script **idempotente y de solo-relleno** (nunca
      sobreescribe lo que el inquilino configuró).
- [ ] Los ficheros que **ningún** `tsconfig` incluye (semillas, scripts de datos) se comprueban con la
      configuración que sí los cubre.

---

## 5. Importación masiva: contrato

**Formato del libro** — uno solo para todas las importaciones:

| Hoja | Contenido |
|---|---|
| Datos | cabeceras amigables y filas `EJEMPLO:` que el importador **salta** |
| Instrucciones | qué es cada columna, qué valores admite, qué es obligatorio |
| Catálogos | los códigos válidos **del inquilino** (para que el fichero se pueda rellenar sin adivinar) |

**Contrato del endpoint:**

1. **Upsert por clave de negocio** (el código): reimportar el mismo fichero corregido **actualiza**, no
   duplica.
2. **Una transacción por agregado** (por ejemplo, por lista de precios), no una por fichero: una fila
   mala no puede tirar las demás, pero tampoco puede dejar media entidad.
3. **Resumen** con `created` / `updated` / `errors` / `total`, y el detalle de errores **por fila** con
   número de fila y motivo.
4. **Límite de filas** explícito, y el error lo dice.
5. Plantilla vacía servida por el propio backend, generada de la misma definición que el importador.
6. Endpoints con la forma `<recurso>/bulk-import` y `<recurso>/bulk-import/template`.

---

## 6. Pruebas de carga y herramientas externas

- El **contexto operativo** (tasas del día, ejercicio abierto, series, terminales) lo crea el propio
  arnés a través de la API: la semilla de desarrollo no lo crea todo, y el fallo se manifiesta como un
  400 que parece de rendimiento.
- Los **umbrales de latencia van por escenario**, no por perfil: el job que solo reporta y el que
  bloquea son dos configuraciones distintas, y se documentan al lado del job.
- **Valida la herramienta corriéndola**: un motor de scripts distinto del de Node no soporta el mismo
  lenguaje. Una comprobación previa en Node puede dar por bueno un escenario que el motor real no
  carga.

---

## 7. Lista de entrega, ampliada

- [ ] Compilación y comprobación de tipos **de todas** las configuraciones que cubren el árbol
      (aplicación, pruebas y scripts de datos): 0 errores.
- [ ] Lint 0 errores / 0 avisos; ninguna supresión nueva (`as any`, `@ts-ignore`, regla desactivada sin
      nombrar).
- [ ] Suite unitaria completa en verde —no solo el fichero tocado—.
- [ ] Aislamiento por inquilino comprobado en **todas** las consultas, incluidas las operaciones que el
      ORM no filtra solo (`findUnique`, `delete`, `upsert`).
- [ ] Autorización declarada en los endpoints nuevos; DTO validado con lista blanca cerrada.
- [ ] Efectos de dinero y de existencias **dentro de una** transacción; el endpoint devuelve el
      agregado.
- [ ] Si el esquema cambió: migración idempotente + registrada + cliente regenerado + alineación de
      datos actualizada.
- [ ] Si hay efecto contable: asiento cuadrado probado (unitario del motor + integración con documentos
      reales) y la guía de dominio del tipo de documento actualizada.
- [ ] Si se tocaron escenarios de carga: ejecutados con la herramienta real, no solo revisados.
- [ ] El resultado se documenta donde el proyecto lo busca (bitácora de cambios; registro de auditoría
      si fue un defecto), **con el comando que produjo cada número**.
