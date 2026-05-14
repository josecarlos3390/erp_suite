# Document Flow Guide (NestJS ERP)

This guide explains how to create ERP documents that have a **header** (cabecera) and **lines** (líneas), with stock tracking and cross-document traceability.

Examples: SalesQuotation, SalesOrder, DeliveryOrder, PurchaseOrder, PurchaseReceipt, Invoice.

---

## 1. Document lifecycle

```
Create (OPEN)
   |
   v
Update lines / header
   |
   v
Close (CLOSED)  -> generates target document (e.g. Order from Quotation)
   |
   v
Cancel (CANCELLED / INACTIVE) -> soft delete, reverses stock
```

---

## 2. Header + lines creation checklist

When implementing `create()` in a document service, follow this order:

### 2.1 Start transaction

```typescript
return this.prisma.$transaction(async tx => {
  // all operations use tx, not this.prisma
});
```

### 2.2 Generate code

```typescript
const code = await this.generateCode(tx, tenantId);
```

### 2.3 Validate catalog entities

```typescript
const partner = await tx.partner.findUnique({ where: { id: dto.partnerId } });
if (!partner) throw new BadRequestException('Partner no encontrado');

const catalogItemIds = [...new Set(dto.items.map(i => i.itemId))];
const items = await tx.item.findMany({
  where: { id: { in: catalogItemIds }, tenantId },
});
if (items.length !== catalogItemIds.length) {
  throw new BadRequestException('Uno o mas articulos no existen');
}
```

### 2.4 Resolve settings and defaults

```typescript
const { useSinTaxCalculation } = await this.settings.getAll(tenantId);
const defaultIndicator = await loadDefaultIndicator(tx);
```

### 2.5 Build lines with business logic

For each line in the DTO:

1. **Resolve price** — use `PriceListsService.resolvePrice()` or direct item price.
2. **Resolve tax indicator** — use `resolveLineTaxIndicator(tx, ...)`, which considers: line override → item default → partner default → system default.
3. **Calculate line totals** — use `calcLineWithIndicator()` from `pricing.util` (handles discounts, IVA 13%, inclusive/exclusive modes).
4. **Validate stock** (for outbound documents) — ensure `stockAvailable >= quantity`.

```typescript
const lineResults = await Promise.all(dto.items.map(async i => {
  const item = items.find(it => it.id === i.itemId)!;
  const price = await this.priceLists.resolvePrice(item.id, dto.partnerId, Number(item.price));
  const { taxIndicatorId, taxRate, isInclusive } = await resolveLineTaxIndicator(
    tx, i.taxIndicatorId ?? null, item, partner, defaultIndicator,
  );
  const calc = calcLineWithIndicator({
    quantity: i.quantity,
    price,
    discountPct: i.discountPct ?? 0,
    discountAmt: i.discountAmt ?? 0,
    taxRate,
    isInclusive,
    useSinTaxCalculation,
  });
  return {
    itemId: i.itemId,
    quantity: i.quantity,
    price,
    discountPct: i.discountPct ?? 0,
    discountAmt: i.discountAmt ?? 0,
    discountTotal: calc.discountTotal,
    priceNet: calc.priceNet,
    subtotal: calc.subtotal,
    tax: calc.tax,
    total: calc.total,
    taxIndicatorId,
    warehouseId: i.warehouseId ?? dto.warehouseId,
    // ...any other fields
  };
}));
```

### 2.6 Calculate header totals

```typescript
const totals = calcDocumentTotalsWithIndicators(lineResults, {
  headerDiscountPct: dto.headerDiscountPct ?? 0,
  headerDiscountAmt: dto.headerDiscountAmt ?? 0,
  discountMode: dto.discountMode ?? 'line',
});
```

### 2.7 Create header record

```typescript
const doc = await tx.salesQuotation.create({
  data: {
    code,
    tenantId,
    createdById,
    status: 'OPEN',
    partnerId: dto.partnerId,
    notes: dto.notes,
    date: dto.date ? new Date(dto.date) : new Date(),
    invoiced: dto.invoiced ?? true,
    discountMode: dto.discountMode ?? 'line',
    headerDiscountPct: dto.headerDiscountPct ?? 0,
    headerDiscountAmt: dto.headerDiscountAmt ?? 0,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    totalCost: lineResults.reduce((s, l) => s + (l.totalCost ?? 0), 0),
    totalWeight: lineResults.reduce((s, l) => s + (l.totalWeight ?? 0), 0),
  },
});
```

### 2.8 Create lines

```typescript
await tx.salesQuotationLine.createMany({
  data: lineResults.map((l, idx) => ({
    salesQuotationId: doc.id,
    lineNum: idx + 1,
    ...l,
    lineStatus: 'OPEN',
  })),
});
```

### 2.9 Update stock (denormalized)

For documents that affect stock:

```typescript
for (const l of lineResults) {
  await recalcQuoted(tx, l.itemId, l.warehouseId, tenantId, /* delta */ l.quantity);
}
```

Or use `upsertStock()` / `recalcCommitted()` / `recalcOrdered()` depending on document type.

### 2.10 Return with relations

```typescript
return tx.salesQuotation.findUnique({
  where: { id: doc.id },
  include: {
    partner: true,
    items: { include: { item: true, warehouse: true } },
  },
});
```

---

## 3. Update with line reconciliation

When updating a document, distinguish:
- **Existing lines** with `id` → update
- **New lines** without `id` → create
- **Missing lines** from the original → delete (or set quantity to 0)

```typescript
async update(id: number, dto: UpdateSalesQuotationDto, updatedById: number, tenantId: number) {
  return this.prisma.$transaction(async tx => {
    const existing = await tx.salesQuotation.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Documento no encontrado');

    // Reverse old stock impact
    for (const oldLine of existing.items) {
      await recalcQuoted(tx, oldLine.itemId, oldLine.warehouseId, tenantId, -oldLine.quantity);
    }

    // Build new lines (same logic as create)
    const lineResults = await Promise.all(dto.items.map(async i => { /* ... */ }));

    // Delete old lines
    await tx.salesQuotationLine.deleteMany({ where: { salesQuotationId: id } });

    // Create new lines
    await tx.salesQuotationLine.createMany({
      data: lineResults.map((l, idx) => ({ salesQuotationId: id, lineNum: idx + 1, ...l })),
    });

    // Apply new stock impact
    for (const l of lineResults) {
      await recalcQuoted(tx, l.itemId, l.warehouseId, tenantId, l.quantity);
    }

    // Update header totals
    const totals = calcDocumentTotalsWithIndicators(lineResults, { ... });
    return tx.salesQuotation.update({
      where: { id },
      data: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total, updatedById },
      include: { items: true },
    });
  });
}
```

---

## 4. Close → create target document

When closing a document (e.g. Quotation → Order), use traceability fields:

```typescript
async close(id: number, updatedById: number, tenantId: number) {
  return this.prisma.$transaction(async tx => {
    const quotation = await tx.salesQuotation.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!quotation) throw new NotFoundException('Cotizacion no encontrada');

    // Create target document with baseDoc references
    const order = await tx.salesOrder.create({
      data: {
        code: await generateCode(tx, tenantId, CODE_SEQUENCES.salesOrders.seq, 'PED', 6),
        tenantId,
        createdById: updatedById,
        status: 'OPEN',
        partnerId: quotation.partnerId,
        baseDocType: 'SALES_QUOTATION',
        baseDocId: quotation.id,
        items: {
          create: quotation.items.map(l => ({
            lineNum: l.lineNum,
            itemId: l.itemId,
            quantity: l.quantity,
            price: l.price,
            baseDocType: 'SALES_QUOTATION',
            baseDocId: quotation.id,
            baseLineId: l.id,
          })),
        },
      },
    });

    // Mark source as closed
    await tx.salesQuotation.update({
      where: { id },
      data: { status: 'CLOSED', updatedById },
    });

    // Update progress / line statuses if needed
    // ...

    return order;
  });
}
```

---

## 5. Cancel (soft delete)

```typescript
async cancel(id: number, updatedById: number, tenantId: number) {
  return this.prisma.$transaction(async tx => {
    const doc = await tx.salesQuotation.findUnique({ where: { id }, include: { items: true } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    // Reverse stock impact
    for (const l of doc.items) {
      await recalcQuoted(tx, l.itemId, l.warehouseId, tenantId, -l.quantity);
    }

    return tx.salesQuotation.update({
      where: { id },
      data: { status: 'CANCELLED', updatedById },
    });
  });
}
```
