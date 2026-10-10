# Documentos con líneas y efectos derivados

Esta referencia desarrolla las prácticas **P7–P9, P13–P17**. Nombres genéricos: `Order`/`orderLine`,
`partner`, `item`, `warehouse`, `tenantId`, `code`. Sustitúyelos por los tuyos.

---

## 1. El orden de la escritura, con el porqué de cada paso

```
$transaction
 ├─ 1. numerar            (secuencia + autocuración)          → §2
 ├─ 2. cargar configuración y valores por defecto             → §7
 ├─ 3. validar lo referenciado (tercero, artículos, almacén)
 ├─ 4. construir líneas (precio, impuesto, descuento, coste)  → §3
 ├─ 5. calcular totales de cabecera A PARTIR de las líneas
 ├─ 6. crear cabecera
 ├─ 7. crear líneas en bloque, numeradas por posición
 ├─ 8. aplicar efectos derivados (existencias, saldos)        → §6
 └─ 9. devolver el agregado con relaciones
```

**Por qué este orden y no otro.**

| Si cambias el orden… | Lo que pasa |
|---|---|
| totales antes de las líneas | dos fuentes del mismo número; la segunda se queda atrás |
| escribir antes de validar catálogos | cabecera huérfana si la validación falla |
| efectos fuera de la transacción | documento sin efectos cuando algo falla después |
| devolver el resultado de la transacción sin capturarlo | `201 {}`: el cliente no puede pintar lo que creó |

---

## 2. Numeración legible, con autocuración

**El problema medido (generalizado).** El código del documento es `prefijo + contador` y **no**
incluye el ejercicio. Dos series activas del mismo tipo con el mismo prefijo colisionan contra el
índice único `(tenantId, code)`: un 500 de restricción única en un documento recién tecleado.

**La cura, en el consumo de la secuencia:**

```typescript
async function consumeSeries(
  tx: Prisma.TransactionClient,
  tenantId: number,
  docType: string,
  prefix: string,
  pad: number,
): Promise<string> {
  // 1. curar el contador contra el máximo ya emitido para ese prefijo
  const last = await tx.order.findFirst({
    where: { tenantId, code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const fromData = last ? Number(last.code.slice(prefix.length)) : 0;

  // 2. consumir y, si el número está tomado, reintentar (tope explícito)
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      prefix + String(Math.max(fromData, await nextValue(tx, tenantId, docType)) + attempt)
        .padStart(pad, '0');
    const taken = await tx.order.findFirst({
      where: { tenantId, code: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error(`No se pudo asignar un código libre para ${prefix}`);
}
```

Reglas:

- El prefijo y la secuencia viven en **un solo** mapa (`SEQUENCES`), y ese mapa es también el que crea
  las secuencias en la base al arrancar (idempotente).
- El tope de reintentos es explícito: un bucle sin tope aquí es un cuelgue.
- **Datos de QA**: contadores altos (por ejemplo `1000`). Los datos de integración que se crean en una
  base limpia y se borran enteros pueden empezar en 1; los datos compartidos o de larga vida, no.
- No «arregles» una colisión editando el contador a mano: la curación es del servicio, y un contador
  bajo volverá a colisionar.

---

## 3. Construcción de líneas: una sola implementación

```typescript
export interface LineCalc {
  itemId: number;
  quantity: number;
  price: number;
  discountPct: number;
  discountAmt: number;
  priceNet: number;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  totalCost: number;
  warehouseId: number | null;
}

private async buildLines(
  tx: Prisma.TransactionClient,
  dtos: CreateOrderLineDto[],
  items: Item[],
  partner: Partner,
  options: { useInclusiveTax: boolean },
): Promise<LineCalc[]> {
  const byId = new Map(items.map((i) => [i.id, i]));

  return Promise.all(dtos.map(async (dto) => {
    const item = byId.get(dto.itemId);
    if (!item) throw new BadRequestException('Artículo inexistente');

    const price = await this.prices.resolvePrice(item.id, partner.id, Number(item.price));
    const { taxIndicatorId, taxRate, isInclusive } =
      await resolveTaxIndicator(tx, dto.taxIndicatorId ?? null, item, partner);
    const calc = calcLine({
      quantity: dto.quantity,
      price,
      discountPct: dto.discountPct ?? 0,
      discountAmt: dto.discountAmt ?? 0,
      taxRate,
      isInclusive,
      useInclusiveTax: options.useInclusiveTax,
    });

    return {
      itemId: dto.itemId,
      quantity: dto.quantity,
      price,
      discountPct: dto.discountPct ?? 0,
      discountAmt: dto.discountAmt ?? 0,
      priceNet: calc.priceNet,
      subtotal: calc.subtotal,
      taxRate, tax: calc.tax, total: calc.total,
      totalCost: (item.cost ?? 0) * dto.quantity,
      warehouseId: dto.warehouseId ?? null,
      taxIndicatorId,
    } as LineCalc & { taxIndicatorId: number | null };
  }));
}
```

Y los totales de cabecera, **desde las líneas ya construidas**:

```typescript
private totalsFrom(lines: LineCalc[], dto: Partial<CreateOrderDto>) {
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const tax = round2(lines.reduce((s, l) => s + l.tax, 0));
  const total = round2(subtotal + tax);
  return { subtotal, tax, total };
}
```

Reglas:

- El cálculo de línea es una **función pura**: recibe números, devuelve números. No consulta la base.
- El redondeo es explícito y ocurre **al aplicar**, no al serializar.
- `totalCost` sale de la **misma** pasada que el resto: si se calcula en otro sitio, diverge.
- La misma función se usa en crear y en actualizar. Es el punto exacto donde una regla nueva se olvida
  en una de las dos ramas.

---

## 4. Cierre: crear el documento destino con trazabilidad

```typescript
async close(id: number, updatedById: number, tenantId: number) {
  return this.db.$transaction(async (tx) => {
    const source = await tx.order.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!source) throw new NotFoundException('El documento no existe');
    if (source.status !== 'OPEN') {
      throw new BadRequestException('El documento no está abierto');
    }

    const target = await tx.deliveryNote.create({
      data: {
        code: await consumeSeries(tx, tenantId, 'DELIVERY_NOTE', 'ALB', 6),
        tenantId,
        createdById: updatedById,
        status: 'OPEN',
        partnerId: source.partnerId,
        baseDocType: 'ORDER',
        baseDocId: source.id,
        items: {
          create: source.items.map((l) => ({
            lineNum: l.lineNum,
            itemId: l.itemId,
            quantity: l.quantity,
            price: l.price,
            baseDocType: 'ORDER',
            baseDocId: source.id,
            baseLineId: l.id, // ← el id de la LÍNEA, no solo el del documento
          })),
        },
      },
      include: { items: true },
    });

    await tx.order.update({
      where: { id },
      data: { status: 'CLOSED', updatedById },
    });

    return target;
  });
}
```

**Por qué `baseLineId`.** Sin el identificador de la línea de origen no se puede calcular cuánto queda
pendiente, y el sistema acepta en silencio que se entregue o se facture dos veces lo mismo. El
documento sigue funcionando; la comprobación desaparece.

**El campo que se cae en silencio.** Un campo de trazabilidad que la capa de hidratación del cliente
no conoce se pierde por el camino (el serializador **omite** las claves `undefined`), y el backend
rechaza la petición con un error que parece suyo. Al añadir un campo de estos:

1. añádelo al constructor compartido de líneas del cliente **y** a la lectura del cuerpo de la
   petición;
2. prevé un respaldo al nombre genérico cuando el flujo lo permita;
3. deja una prueba que afirme que **el vínculo sobrevivió**, no solo que la respuesta fue 201.

---

## 5. Anulación: borrado lógico y reverso

```typescript
async cancel(id: number, updatedById: number, tenantId: number) {
  return this.db.$transaction(async (tx) => {
    const doc = await tx.order.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!doc) throw new NotFoundException('El documento no existe');
    if (doc.status === 'CANCELLED') {
      throw new BadRequestException('El documento ya está anulado');
    }

    for (const line of doc.items) await this.reverseStock(tx, line, tenantId);
    await this.reverseJournalEntry(tx, 'ORDER', doc.id, tenantId, updatedById);

    return tx.order.update({
      where: { id },
      data: { status: 'CANCELLED', updatedById },
      include: { items: true },
    });
  });
}
```

- Anular es **un estado**, no un `DELETE`. Los registros de negocio no se borran.
- El reverso de efectos y el cambio de estado van en la **misma** transacción.
- El reverso del asiento es una operación del motor contable, no un borrado de filas.

---

## 6. Efectos derivados: aplicar y revertir, simétricos

```typescript
private async applyStock(tx: Prisma.TransactionClient, line: LineCalc, tenantId: number) {
  if (!line.warehouseId) return;
  await tx.stock.upsert({
    where: { tenantId_itemId_warehouseId: { tenantId, itemId: line.itemId, warehouseId: line.warehouseId } },
    create: { tenantId, itemId: line.itemId, warehouseId: line.warehouseId, quantity: line.quantity },
    update: { quantity: { increment: line.quantity } },
  });
}

private async reverseStock(tx: Prisma.TransactionClient, line: LineCalc, tenantId: number) {
  if (!line.warehouseId) return;
  await tx.stock.updateMany({
    where: { tenantId, itemId: line.itemId, warehouseId: line.warehouseId },
    data: { quantity: { decrement: line.quantity } },
  });
}
```

Reglas:

- Una función por dirección y por familia de efecto. **Ninguna** aritmética de existencias suelta en un
  servicio.
- Actualizar un documento = revertir el impacto viejo **y** aplicar el nuevo. Si te falta la mitad de
  reverso, el estado derivado se va acumulando sin que nada falle.
- Los efectos y el documento comparten transacción y `tx`.
- Si el efecto es un saldo con signo, la prueba de integración debe afirmar el **valor**, no solo que
  la operación no lanzó.

---

## 7. Valores por defecto en cadena, y materializados

```typescript
async function resolvePaymentTerm(
  tx: Prisma.TransactionClient,
  tenantId: number,
  input: { paymentTermId?: number | null; partnerId: number; baseDate: Date; totalAmount: number },
) {
  // 1) lo que pidió el cliente  2) el maestro  3) el grupo del maestro
  const term = input.paymentTermId
    ? await tx.paymentTerm.findFirst({ where: { id: input.paymentTermId, tenantId } })
    : (await tx.partner.findFirst({
        where: { id: input.partnerId, tenantId },
        include: { group: true },
      }))?.paymentTermId
      ? await tx.paymentTerm.findFirst({
          where: {
            id: (await tx.partner.findFirst({ where: { id: input.partnerId, tenantId } }))!
              .paymentTermId!,
            tenantId,
          },
        })
      : null;

  if (!term) return { paymentTermId: null, dueDate: input.baseDate, discountPct: 0 };

  const dueDate = addDays(input.baseDate, term.days);
  const installments = term.lines.length
    ? buildInstallments(term, input.totalAmount, input.baseDate)
    : null;

  return { paymentTermId: term.id, dueDate, discountPct: term.discountPct, installments };
}
```

Y en el documento se **materializa lo resuelto**, no el puntero:

```typescript
const resolved = await resolvePaymentTerm(tx, tenantId, { … });
await tx.invoice.create({
  data: {
    // …
    paymentTermId: resolved.paymentTermId,
    dueDate: resolved.dueDate,            // ← el resultado, no una referencia
    earlyPaymentDiscountPct: resolved.discountPct,
  },
});
if (resolved.installments) {
  await tx.invoiceInstallment.createMany({
    data: resolved.installments.map((i) => ({ invoiceId: invoice.id, ...i })),
  });
}
```

**Por qué materializar.** Si el documento solo guarda el puntero al maestro, cambiar el maestro
reescribe la historia de las facturas ya emitidas. Guardar el resultado resuelto congela la operación.

---

## 8. Asiento contable: cuadrado, en la transacción, y reversible

```typescript
await this.accounting.createOrderJournalEntry(tx, {
  id: source.id, code: source.code, tenantId,
  partnerId: source.partnerId, warehouseId: source.warehouseId,
  subtotal: source.subtotal, tax: source.tax, total: source.total,
  items: source.items.map((i) => ({
    itemId: i.itemId, itemGroupId: i.itemGroupId, warehouseId: i.warehouseId,
    subtotal: i.subtotal, taxAmount: i.tax, totalCost: i.totalCost,
    quantity: i.quantity,
  })),
});
```

Dentro del motor, **antes de persistir**:

```typescript
const debit = lines.reduce((s, l) => s + l.debit, 0);
const credit = lines.reduce((s, l) => s + l.credit, 0);
if (round2(debit) !== round2(credit)) {
  throw new Error(
    `Asiento descuadrado en ${docType} ${code} (id=${id}): ` +
    `D=${debit} C=${credit} (dif=${round2(debit - credit)})`,
  );
}
```

**Caso (generalizado) que originó la verificación.** Un importe que movía el total se aceptaba en el
formulario, en el DTO y en la validación, pero el constructor **no lo leía**: cualquier operación con
ese importe moría con una diferencia exactamente igual a él. Además, solo una de las ramas del
constructor (el camino heredado) seguía usando el importe bruto, así que arreglar una rama no cuadraba
la otra. Dos reglas que quedaron escritas:

1. **Un campo que mueve dinero tiene que aparecer en el constructor, o la petición se rechaza con un
   400.** Aceptarlo e ignorarlo es el peor de los tres estados.
2. **Revisa todas las ramas** (los distintos modos de pago, las líneas manuales, el camino heredado)
   con la misma aritmética.

Y una consecuencia de diseño: un importe que retiene un tercero es un **activo**, no un pasivo. Reusar
la cuenta del pasivo para él descuadra el cierre por el lado equivocado. La configuración de ese mapeo
vive en los datos del inquilino, y el script que la rellena es **idempotente y de solo-relleno**: nunca
sobreescribe lo que el inquilino ya configuró.

---

## 9. Trazabilidad de documentos: campos mínimos

| Nivel | Campo | Significado |
|---|---|---|
| Cabecera | `baseDocType` | tipo del documento origen |
| Cabecera | `baseDocId` | documento origen |
| Línea | `baseLineId` | **línea** origen (sin él no hay pendientes) |
| Línea | `lineNum` | posición en el documento (se regenera al reconstruir) |
| Línea | `lineStatus` | estado por línea (abierta/cerrada) cuando el documento se cierra parcialmente |

Al encadenar (presupuesto → pedido → albarán → factura) los tres campos se copian **en cada salto**, y
la prueba de integración del flujo afirma el vínculo, no solo el 201.
