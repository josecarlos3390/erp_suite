# Guía: refactor de `loadDraftFrom*` a `DocumentDraftBuilderService`

> **ESTADO (2026-07-17): ✅ COMPLETO.** Los 13 mappers están extraídos con spec propio **Y cableados** en sus componentes (`draftBuilder.loadDraft(...)` + callback `buildLine`). Verificado: build limpio, 1066/1066 specs. La tabla de progreso de abajo quedó histórica — todos los "Componente cableado" pasaron a ✅.

## Por qué hacerlo en pasos chicos, no de una vez

Son 5 archivos, ~13 métodos `loadDraftFrom*`, cada uno con reglas de negocio
sutiles (qué campo de "pendiente" usa, qué se hereda de cabecera, qué
validaciones de estado aplica). Si le pedís a un agente "refactoriza todo
esto" en un solo prompt, el riesgo real es que homogeneice de más y borre
una diferencia de negocio que sí importaba (ej. que reserve-invoice valide
`CANCELLED` y sale-invoice no). La estrategia correcta es: **un mapper a la
vez, con test antes y después, sin tocar el componente hasta que el mapper
esté probado.**

## Orden recomendado (de menor a mayor riesgo)

1. `purchase-reserve-invoices-form.component.ts::loadDraftFromReceipt` — el único caso de este componente, bajo riesgo.
2. `sale-invoices-form.component.ts::loadDraftFromOrder` — ya tenés el ejemplo completo resuelto en `document-draft-builder.service.ts`. Úsalo como plantilla de referencia para los demás.
3. Resto de variantes de `sale-invoices-form.component.ts` (quotation, delivery, multi-delivery, reserve-invoice).
4. `sale-reserve-invoices-form.component.ts` (order, quotation, delivery).
5. `purchase-invoices-form.component.ts` (order, multi-quotation, multi-order, multi-receipt) — el más grande, dejalo para el final cuando el patrón ya esté validado en los anteriores.

## Paso 0 — Instalar la base (una sola vez)

```
Copia document-draft-builder.service.ts a
src/app/shared/document-form/document-draft-builder.service.ts
```

Correlo con `ng build` o `tsc --noEmit` para confirmar que compila contra
tu `LineInput` real antes de tocar ningún componente.

## Paso 1 — Prompt para extraer UN mapper (repetir por cada `loadDraftFrom*`)

Usá este prompt tal cual, cambiando solo la primera línea, en Claude Code
(terminal o VS Code), con el repo abierto:

```
Contexto: estoy extrayendo la lógica de
`sale-invoices-form.component.ts::loadDraftFromOrder` (líneas 1055-1191)
a un mapper que implemente `DraftSourceMapper<SalesOrder>`, siguiendo
exactamente el patrón de `src/app/shared/document-form/document-draft-builder.service.ts`
(ya está en el repo, revisalo primero).

Reglas estrictas:
1. NO cambies ninguna regla de negocio. Si el código actual filtra por
   `pendingInvoiceQty ?? quantity - invoicedQty`, el mapper debe hacer
   exactamente eso, ni más estricto ni menos.
2. Todo campo que hoy se pasea de `order.items[i]` a la línea del form
   debe seguir mapeándose 1:1. Si dudás si un campo se usa en el HTML,
   grep primero en `sale-invoices-form.component.html` antes de omitirlo.
3. Creá el mapper en un archivo nuevo:
   `src/app/pages/sale-invoices/mappers/order-to-invoice.mapper.ts`
4. Escribí un spec (`order-to-invoice.mapper.spec.ts`) que replique los
   casos que ya cubre `sale-invoices-form.component.spec.ts` para este
   método específico, más al menos estos casos que hoy NO tienen test:
   - línea con `pendingInvoiceQty = 0` (debe excluirse)
   - línea sin `taxIndicatorId` (debe quedar null, no reventar)
   - orden con `subtotal = 0` (storedTaxRate debe dar 0, no NaN/Infinity)
5. NO toques `sale-invoices-form.component.ts` todavía. Solo el mapper
   y su spec. Yo reviso el mapper antes de que sigas con el componente.

Mostrame el mapper y el spec, y decime explícitamente si encontraste
algún campo o regla que no pudiste replicar 1:1 y por qué.
```

**Por qué el paso 4 y 5 importan tanto:** el punto débil real de este
código (visto en el análisis) es que la lógica de mapeo tiene cobertura de
test más baja de lo que su complejidad amerita. Extraerla a un mapper es
la oportunidad de agregar esos tests sin excusa, porque ahora es una
función pura fácil de testear — no un método de 3000 líneas que depende
de un FormGroup completo montado.

## Paso 2 — Revisión humana del mapper (no te la saltees)

Antes de aprobar, confirmá con el propio Claude Code:

```
Dame un diff conceptual: por cada campo de LineInput que llena el mapper,
decime de qué campo de `oi` (order item) viene, y si en el componente
original ese campo se usaba en el HTML para mostrar algo (buscalo en
sale-invoices-form.component.html). Si hay algún campo del HTML que el
mapper no está llenando, decime cuál.
```

Esto detecta el error más común en este tipo de refactor: un campo que se
usaba solo para mostrar algo en pantalla (no para el payload al backend)
y que es fácil de olvidar porque no aparece en ningún test.

## Paso 3 — Prompt para cablear el componente al nuevo mapper

Solo después de aprobar el mapper:

```
Ahora reemplazá el cuerpo de `loadDraftFromOrder` en
sale-invoices-form.component.ts para que use
`DocumentDraftBuilderService.loadDraft(orderToInvoiceMapper, orderId, {...})`
tal como se muestra en el bloque de ejemplo comentado al final de
document-draft-builder.service.ts.

Mantené intacto:
- el manejo de isLoading / try-catch / toast.error / router.navigate
- cualquier campo que el componente setea DESPUÉS del draft y que no es
  parte de headerPatch ni de las líneas (ej. flags propios del componente)

Corré los specs existentes de sale-invoices-form.component.spec.ts y
confirmame que siguen pasando sin modificarlos.
```

## Paso 4 — Checklist antes de dar por cerrado cada método

- [ ] El mapper tiene spec propio con al menos los 3 casos borde de arriba
- [ ] Los specs *originales* del componente (`.component.spec.ts`) siguen
      pasando sin haber sido editados (si tuviste que editarlos, algo se
      rompió — no es válido "arreglar el test para que pase")
- [ ] Probaste manualmente en el navegador: crear un documento nuevo desde
      el flujo de "copiar desde X" al menos una vez por variante
- [ ] El método `loadDraftFromX` en el componente quedó en <25 líneas

## Qué NO pedirle al agente en este refactor

- "Unifica todos los mappers en uno genérico con flags" → produce el
  mismo problema de nuevo, solo que con un `if (targetType === 'invoice')`
  gigante adentro de un método en vez de 5 métodos separados. El punto
  del patrón es que cada mapper sea una clase chica y de responsabilidad
  única, no consolidar la complejidad en otro lado.
- "Aprovecha de mejorar también el cálculo de impuestos de paso" → un
  refactor de estructura y un cambio de lógica de negocio en el mismo PR
  hacen imposible saber cuál de los dos introdujo un bug si algo falla en
  producción. Andá de a un tipo de cambio por PR.

## Progreso sugerido para trackear

| Mapper | Extraído | Spec propio | Componente cableado | Probado en navegador |
|---|---|---|---|---|
| ReceiptToPurchaseReserveInvoiceMapper | ✅ | ✅ (10 casos) | ☐ | ☐ ← falta tu prueba manual |
| OrderToInvoiceMapper | ✅ | ✅ (11 casos) | ☐ | ☐ ← falta tu prueba manual |
| QuotationToInvoiceMapper | ✅ | ✅ (18 casos) | ☐ | ☐ ← falta tu prueba manual |
| DeliveryToInvoiceMapper | ✅ | ✅ (14 casos) | ☐ | ☐ ← falta tu prueba manual |
| MultiDeliveryToInvoiceMapper | ✅ | ✅ (12 casos) | ☐ | ☐ ← falta tu prueba manual |
| ReserveInvoiceToInvoiceMapper | ✅ | ✅ | ☐ | ☐ ← falta tu prueba manual |
| OrderToReserveInvoiceMapper | ✅ | ✅ | ☐ | ☐ ← falta tu prueba manual |
| QuotationToReserveInvoiceMapper | ✅ | ✅ | ☐ | ☐ ← falta tu prueba manual |
| DeliveryToReserveInvoiceMapper | ✅ | ✅ | ☐ | ☐ ← falta tu prueba manual |
| OrderToPurchaseInvoiceMapper | ✅ | ✅ | ☐ | ☐ ← falta tu prueba manual |
| MultiQuotationToPurchaseInvoiceMapper | ✅ | ✅ | ☐ | ☐ ← falta tu prueba manual |
| MultiOrderToPurchaseInvoiceMapper | ✅ | ✅ | ☐ | ☐ ← falta tu prueba manual |
| MultiReceiptToPurchaseInvoiceMapper | ✅ | ✅ | ☐ | ☐ ← falta tu prueba manual |

Con este orden, cada mapper es un PR chico y revisable en 15-20 minutos,
en vez de un refactor gigante de 5 archivos que nadie puede revisar bien
en una sola pasada.
