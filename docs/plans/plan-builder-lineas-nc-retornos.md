# Plan — Builder compartido de líneas de NC y retornos (T38)

> **Origen:** mejora futura documentada en el cierre D2 del
> `docs/plans/plan-gaps-deuda-2026-09.md` (2026-09-08, AUDIT T36) y en
> `AUDIT.md` T36: *"builder compartido de línea para el par de NC
> (sales/purchase-credit-notes ~170 líneas casi literales) y retornos (P1/P2)
> con ~4 variaciones de negocio a parametrizar — requiere tests de regresión de
> NC/retornos antes de tocar código"*.
>
> **Última actualización:** 2026-09-09. **Estado:** 🔄 — **P1 (par de NC) ✅
> ejecutado (2026-09-09, AUDIT T38)**; P2 (retornos) ☐ pendiente.

---

## 1. Objetivo

Eliminar la duplicación de los builders de líneas de **NC** (venta/compra) y
**retornos** (venta/compra) del frontend: hoy cada uno de los 4 forms define su
propio `buildLineGroup(l: LineInput)` (y su propio builder de línea vacía en
`addItem`) con el mismo núcleo y pocas variaciones de negocio. El objetivo es
**un solo builder parametrizado** en `shared/`, con forma de FormGroup
**byte-idéntica** a la actual por form, sin tocar semánticas (validators,
disabled, redondeos) y con regresión NC/retornos en verde ANTES y DESPUÉS.

**NO unifica comportamiento:** los valores por form (min de cantidad, precio
editable, etc.) se conservan como parámetros. Cualquier cambio de regla (p. ej.
`min(1)` de ventas vs `min(0.001)` de compras) es decisión de producto aparte.

---

## 2. Evidencia de la duplicación (2026-09-09)

| Form | `buildLineGroup` | Builder línea vacía (`addItem`) |
|---|---|---|
| `sales-credit-notes-form.component.ts` | 794–870 (77 líneas) | 873–~918 (~45) |
| `purchase-credit-notes-form.component.ts` | 822–907 (86 líneas) | 910–~950 (~45) |
| `sales-returns-form.component.ts` | 827–~900 | existe (`addItem`) |
| `purchase-returns-form.component.ts` | 769–~850 | existe (`addItem`) |

Los pares sales/purchase comparten >85% del cuerpo (mismos controles con
`this.fb.group({...})`, mismos `?? null` / `Number()` / `disabled`). Además cada
form tiene un `addItem()` que re-declara el FormGroup de línea vacía (~45
líneas casi literales entre los 4).

### Diferencias reales NC venta vs NC compra (parametrizables)

| # | Aspecto | NC venta | NC compra |
|---|---|---|---|
| 1 | Validator de `quantity` | `min(1)` | `min(0.001)` |
| 2 | `price` | `{ value, disabled: true }` (heredado de la factura) | `[price]` editable (ajuste en NC) |
| 3 | Motivos SAP en línea (`returnAction`/`returnReason`/`returnReasonId`) | ✅ presentes | ❌ |
| 4 | `cost` / `totalCost` (asiento NC acredita INVENTORY por costo) | ❌ | ✅ presentes |
| 5 | `lineSubtotal` fallback | `priceNet × qty` sin redondear | prefiere `lineSubtotal` y redondea a 2 (`Math.round(x*100)/100`) |

> Los retornos (P2) tienen la misma mecánica y presumiblemente variaciones
> equivalentes (dirección del tracking, `baseDocType` DELIVERY_ORDER /
> PURCHASE_RECEIPT, costo de devolución); su diff exacto se levanta al arrancar
> P2 (misma metodología que la tabla de arriba).

---

## 3. Diseño propuesto

### 3.1 Builder único parametrizado (nuevo)

`erp-frontend/src/app/shared/document-form/build-credit-note-line.util.ts`
(util pura, testeable standalone — no crece la base):

```ts
export interface NcLineBuildOptions {
  quantityMin: number;           // ventas 1 | compras 0.001
  priceEditable: boolean;        // ventas false | compras true
  includeReturnReasons: boolean; // ventas true | compras false
  includeCostFields: boolean;    // compras true (cost/totalCost) | ventas false
  roundLineSubtotal: boolean;    // compras true | ventas false
}

export function buildNcLineGroup(
  fb: FormBuilder,
  l: LineInput,
  opts: NcLineBuildOptions,
  defaultWarehouseId: number | null | undefined,
): FormGroup;

export function buildEmptyNcLineGroup(
  fb: FormBuilder,
  opts: NcLineBuildOptions,
  defaultWarehouseId: number | null | undefined,
): FormGroup;
```

- El cuerpo replica **literal** el de los `buildLineGroup` actuales; las 5
  diferencias de la tabla se resuelven con los flags de `opts`.
- `defaultWarehouseId` reemplaza `this.form.get('warehouseId')?.value ?? null`
  (cada form pasa su valor actual en el call-site — sin cambio de runtime).
- `buildEmptyNcLineGroup` centraliza también el FormGroup de `addItem` (hoy
  duplicado en los 4 forms), con `opts` para los mismos flags (motivos/costos).

### 3.2 Consumo en los forms

Cada form define una constante privada con sus opciones y delega:

```ts
private readonly ncLineOpts: NcLineBuildOptions = {
  quantityMin: 1, priceEditable: false,
  includeReturnReasons: true, includeCostFields: false,
  roundLineSubtotal: false,
};
// buildLineGroup(l) { return buildNcLineGroup(this.fb, l, this.ncLineOpts,
//   this.form.get('warehouseId')?.value ?? null); }
```

Los call-sites de `buildLineGroup`/`addItem` no cambian de nombre ni firma
externa (métodos privados existentes) → el diff queda acotado al cuerpo.

### 3.3 Alcance

- **P1 (NC):** `sales-credit-notes-form` + `purchase-credit-notes-form`.
- **P2 (retornos):** `sales-returns-form` + `purchase-returns-form` (misma
  mecánica; levantar su diff propio antes de migrar; pueden tener 1-2 flags
  adicionales, p. ej. control `baseDocType`/`baseDocId`/`returnCost`).

---

## 4. Puerta de regresión (OBLIGATORIA, ANTES de tocar código)

Se ejecuta y se deja en verde ANTES del refactor y se re-ejecuta DESPUÉS
(mismo comando, mismo resultado). Backend no cambia; se incluye para verificar
que el payload de NC/retornos (shape de controles → DTO) sigue intacto.

1. **Karma (frontend)** — specs de forms (P1):
   - `sales-credit-notes-form.component.spec.ts`
   - `purchase-credit-notes-form.component.spec.ts`
   (P2 cuando se ejecute: `sales-returns-form.component.spec.ts`,
   `purchase-returns-form.component.spec.ts`).
2. **Jest (backend)** — suites de NC/retornos (contrato de creación intacto):
   - `sales-credit-notes.service.spec.ts`, `purchase-credit-notes.service.spec.ts`
   - `sales-returns.service.spec.ts`, `purchase-returns.service.spec.ts`
3. **E2E (Playwright, chromium)** — flujos de NC/retornos por UI con **fecha
   fija dentro de un FY abierto** de la BD dev (2027 o 2031; la Gestión 2026
   está cerrada en dev, y los journey specs con fecha dinámica fallan por
   serie/FY, no por código). Candidatos (verificar fecha fija antes de correr):
   `sales-full-flow-credit-note.spec.ts`,
   `purchase-full-flow-credit-note.spec.ts`,
   `sales-multi-delivery-credit-note.spec.ts`, `qa-tax-calculations.spec.ts`.

> **Nota de entorno:** si un spec usa la fecha de hoy y dev tiene la gestión del
> año cerrada, NO es regresión del refactor — documentar y elegir el spec con
> fecha fija (o correr contra FY abierto).

---

## 5. Pasos de migración (P1)

1. Ejecutar la puerta de regresión (§4) → guardar resultado.
2. Crear `build-credit-note-line.util.ts` con el cuerpo literal del
   `buildLineGroup` de compras (el más completo) parametrizado por `opts`.
3. Spec unitario nuevo del util (`build-credit-note-line.util.spec.ts`):
   para **ambos** conjuntos de opciones y varios inputs representativos,
   assert sobre los valores iniciales/validators/disabled de cada control —
   expectativas extraídas de los builders actuales (si un control difiere al
   migrar, este spec lo atrapa).
4. Migrar `sales-credit-notes-form` → constantes `ncLineOpts` + delegación;
   `addItem` → `buildEmptyNcLineGroup`.
5. Migrar `purchase-credit-notes-form` (idem).
6. Typecheck app (`tsc --noEmit -p tsconfig.app.json`) + build AOT.
7. Re-ejecutar la puerta de regresión → idéntica.
8. Cerrar: fila en `AUDIT.md` (T38), nota en `erp-frontend/CHANGELOG.md`,
   marca ✅ acá, commit/push frontend + root.
9. (Opcional, decisión de producto) revisar el smell `min(1)` ventas vs
   `min(0.001)` compras ahora que queda parametrizado.

P2 (retornos) repite 1–8 sobre los 2 forms de retornos.

---

## 6. Criterios de aceptación

- [ ] Cero cambios de comportamiento: mismos controles, validators, disabled y
      redondeos por form (verificado por los specs de forms + spec del util).
- [ ] FormGroup resultante byte-idéntico (nombres de control) — el payload de
      NC/retornos no cambia (backend suites verdes).
- [ ] Puerta de regresión (§4) verde antes y después.
- [ ] `buildLineGroup`/`addItem` duplicados eliminados de los 4 forms (P1+P2);
      un solo builder en `shared/document-form/`.
- [ ] Zero `as any`; typecheck + build AOT OK; lint 0.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Un control difiere al consolidar (orden/nombre/disabled) | Spec del util con expectativas de los builders actuales; forms specs verdes |
| `defaultWarehouseId` cambia el valor del control al cargar | Cada call-site pasa el mismo valor que hoy resuelve (`form.get('warehouseId')?.value ?? null`) |
| Redondeo `lineSubtotal` (fallback) distinto por form | Flag `roundLineSubtotal` conserva el cálculo exacto de cada form |
| Regresión silenciosa en payload de NC/retornos | Suites backend de NC/retornos en la puerta |
| E2E bloqueado por FY/serie (fecha de hoy) | Usar specs con fecha fija en FY abierto; documentar, no "arreglar" BD |

---

## 8. Referencias

- `docs/plans/plan-gaps-deuda-2026-09.md` → D2 (mejora futura documentada).
- `AUDIT.md` → T36 (auditoría D2) y T38 (esta tarea al cerrarse).
- Builders actuales: `sales-credit-notes-form.component.ts:794`,
  `purchase-credit-notes-form.component.ts:822`,
  `sales-returns-form.component.ts:827`,
  `purchase-returns-form.component.ts:769`.
- Patrón de builder heterogéneo tipado (guía §9):
  `FRONTEND_GUIDE.md` "Estándares de tipado".

---

## 9. Registro de ejecución — P1 (par de NC) ✅ 2026-09-09 (AUDIT T38)

- **Puerta de regresión (baseline, ANTES):** backend NC 44/44
  (`sales-credit-notes.service.spec` + `purchase-credit-notes.service.spec`);
  Karma forms NC — ventas 12/12, compras 9/9. (E2E NC con fecha fija
  2026-08-09 bloqueados por entorno: Gestión 2026 cerrada en dev.)
- **Util creado:** `shared/document-form/build-credit-note-line.util.ts`
  (`buildNcLineGroup` + `buildEmptyNcLineGroup`) con las opciones de §3.1
  (`NcLineBuildOptions` / `NcEmptyLineBuildOptions`).
- **Forms migrados:** `sales-credit-notes-form` y `purchase-credit-notes-form`
  delegan en el util (métodos privados conservados; call-sites intactos).
- **Evidencia (DESPUÉS):** spec del util 13/13 (ambos conjuntos de opciones;
  incluye preferencia de `lineSubtotal` guardado vs fallback redondeado);
  Karma forms NC idéntico al baseline (ventas 12/12, compras 9/9); typecheck
  app OK. Backend sin cambios.
- **Nota:** el shape del FormGroup es equivalente (controles/validators/
  disabled/redondeos por form); no se unificó comportamiento (p. ej. `min(1)`
  ventas vs `min(0.001)` compras queda parametrizado — decisión de producto
  pendiente si se quisiera alinear).
- **Pendiente:** P2 (retornos) — repetir §4–§6 sobre `sales-returns-form` y
  `purchase-returns-form` (levantar su diff propio antes).
