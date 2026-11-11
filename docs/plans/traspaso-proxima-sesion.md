# Traspaso — próxima sesión

> **Qué es esto.** El estado medido al cerrar la sesión del 2026-11-10/11 y el plan para continuar
> **sin repetir los tropiezos**. Todo lo que aquí se afirma está medido y su fila del ledger
> (`AUDIT.md`, T668–T681) lleva el comando o la captura que lo produjo.
>
> **La regla de la casa sigue siendo la misma**: si algo no se mide, no se adopta; y si un diagnóstico
> se corrige, **se escribe** (aquí hay tres correcciones a diagnósticos míos: T669, T677 y T681).

---

## 1 · Estado de la base `erp_db` (todo configurado **por pantalla**)

| Elemento | Valor | Cómo se creó |
|---|---|---|
| Empresa | `Empresa Principal S.R.L.` · NIT `1234567890` | `/company-profile` |
| Sucursales · almacén | `SUC-01` (+ la del asistente) · `ALM-01` | bootstrap + `/branches/wizard` |
| Monedas · tasa | BOB, UFV, USD · USD→BOB **6,96** (2026-11-11) | T659/T660 |
| **Plan de cuentas** | **316 cuentas** | `/settings` → «Generar Plan de Cuentas» |
| **Mapeos** | **77** | `/account-mappings` → «Restaurar Defaults» |
| Gestión · períodos | 2026 · **12** | `/fiscal-years` → detalle → «Generar Períodos» |
| **Series** | **7** (`FVE-01`, `PV-01`, `ENT-01`, `ING-01`, `PC-01`, `REC-01`, `FVC-01`) | `/document-series` |
| Terceros | `Cliente Demo S.A.` · `Proveedor Demo Ltda.` | `/partners/new` |
| Artículos | `ART-00001` (venta+compra+inventario), `ART-00002` (venta), `ART-00003` (compra) | `/items/new` |
| **Ventas** | `FVE-1`, `FVE-2`, `FVE-3` (100 c/u) con **asientos cuadrados** | `/sale-invoices/new?manual=1` |
| **Compra manual** | `FVC-3` (**120,00**) con asiento 104,40 + 15,60 = 120,00 | `/purchase-invoices/new?manual=1` |
| **Pedido** | `PC-1` (**150,00**) | `/purchase-orders/new?manual=1` |
| Mayor | **7 asientos, todos cuadrados** (200=200, 143=143, 200=200, 143=143, 120=120) | `audit:reconcile` |

**Repos** (sesión cerrada): `backend-erp` = `12ff3f19` (origin = deploy) · `erp-frontend` = `2d65e665` ·
raíz = `18b54c7`. Árboles limpios.

---

## 2 · Lo que queda, en el orden que recomiendo

### Paso 1 · Recepción desde el pedido (BLOQUEADO — empezar por aquí)

**Síntoma medido (T681)**: `/purchase-orders/1` → «Copiar a» → «Crear recepción de compra desde esta
orden» abre «Nueva Recepción desde Orden» con la **cantidad precargada (3)**, el botón «Crear
Recepción» está **habilitado**… y al pulsarlo **no pasa nada**: cero peticiones, cero errores, cero
avisos.

**Lo ya descartado midiendo** (no repetir): el artículo es `trackingType: NONE`; la serie no era (se
eligió `REC-01`); no hay `.ng-invalid` ni `.luna-field__error`; la rama de código **existe**
(`createReceipt()` tiene el fallback «¿Crear recepción? … recepción parcial del pedido»).

**Dónde se corta**: `save()` **no se ejecuta** (instrumentado con `console.warn`, el clic no dejó
rastro) ⇒ el `submit` no llega a `(ngSubmit)`.

**La prueba decisiva (1 minuto)**: pulsar **Enter** dentro de un campo del formulario.
- Si aparece el modal «¿Crear recepción?» ⇒ el defecto es de la **barra de acciones**
  (`app-document-action-bar` + `lunaFormActions` proyecta fuera del `<form>`): hay que darle
  `(lunaClick)="save()"` al botón (como hace el pedido) o dejar de proyectar.
- Si **no** aparece ⇒ el defecto está en el `(ngSubmit)` del `<form>` (o en `luna-button` no
  propagando `type`), y el arreglo va por ahí.

**Archivos**: `pages/purchase-receipts/purchase-receipts-form.component.html` (botón, línea ~937;
`<form>` en 149) y `.ts` (`save()` ~2550, `createReceipt()` ~2165, `loadDraft()` ~1632).

### Paso 2 · Factura desde la recepción

Con la recepción registrada, `REC-01` → «Copiar a» → «Factura de compra» (`FVC-01`). Ahí nace el
asiento de la compra **heredando el precio del pedido**. Verificar: total > 0 y asiento cuadrado
(CxP / IVA crédito / inventario).

### Paso 3 · Cobro de las ventas

`/incoming-payments/new`: tercero + documentos a cancelar (+ «Agregar método»). Comprobar el asiento
de cobro y que la CxC quede en cero.

### Paso 4 · P3 (deuda declarada del frontend)

Subir a la rejilla canónica las celdas que hoy se **proyectan** (el `type` de la factura, el
`receivedQty` del pedido y las diez de la recepción), para que las cuatro familias de compra no
tengan **ninguna** celda propia. Mecanismo: añadir el `@case` a `luna-document-lines-detail`, borrar
la proyección, y el gate + los specs lo confirman.

---

## 3 · El plan original, y cómo va

| Fase | Estado |
|---|---|
| Documento de servicio en ventas/compras (8 sitios) | ✅ hecho (sesiones anteriores) |
| Centro de Configuración + circuito por pantalla | ✅ hecho (T658–T667) |
| **Un solo motor de líneas** (8 familias) | ✅ **cerrado** (T668–T673: 8/8, baseline vacío, −1 362 líneas) |
| Compra **manual** con asiento | ✅ (T678) |
| Pedido con precio | ✅ (T679) |
| **Recepción desde pedido** | ⏳ **bloqueada** (T681) → Paso 1 |
| Factura desde recepción · cobro · informes | pendiente |
| Informe «entregas sin cargo» | ✅ (T656) con filtro por usuario (T657) |

---

## 4 · Los tropiezos del camino (para no repetirlos)

1. **`ng serve` sirviendo un bundle viejo**: un «no funciona» que era del arnés. **Reiniciar el dev
   server** antes de concluir (pasó dos veces: T660 y T675).
2. **El botón que registra abre un modal de confirmación** («¿Registrar…?» → «Sí, registrar»): el
   pedido lo hace; si no se pulsa, **no hay POST** y la pantalla no dice nada.
3. **`type="submit"` en la barra de acciones** puede no llegar al `<form>` (T681, pendiente de la
   prueba del Enter).
4. **La acción «Crear recepción» vive en un menú** («Copiar a»): sin abrirlo, el localizador la
   encuentra pero **no es visible**.
5. **La URL no precarga la orden**: `?purchaseOrderId=1` abre la **Manual**; el camino es el menú.
6. **La rejilla canónica tenía dos supuestos de venta**: `canBeSold` fijo (T675) y `price` de solo
   lectura (T678). Ya hay `itemScope` y `priceEditable`; si aparece otro, es la misma familia.
7. **`Item.cost` es derivado** (costeo promedio): no se puede `PATCH`.
8. **Un guardián que retorna en silencio es un defecto** (T681): si el formulario es inválido, se
   marca y se dice **qué falta**.
9. **`Select-String -Path src\app\**\*.ts` no es recursivo** (T662): un «no existe» exige mirar el
   árbol entero.
10. **Los gates de fixtures piden la marca** del T citado en la cabecera del spec y el T en el ledger.
11. **`prisma migrate diff --from-url` no existe en Prisma 7** (T664): el gate de migraciones medía
    nada; ahora usa `--from-migrations` y **falla si el comando falla**.
12. **PowerShell no es un buen escritor de SQL/JSON**: `>` redirigido saca UTF-16 y Postgres lo
    rechaza (T664). Escribir con Node y `encoding: 'utf8'`.

---

## 5 · Cómo se trabaja (lo que ya está montado)

- **La herramienta**: `erp-frontend/scripts/configurar-erp-por-ui.mjs` — 10 pasos idempotentes
  (`monedas · tasa · fiscal · contabilidad · cuentas · mapeos · gestión · series · partners ·
  articulos`) contra la app de desarrollo. `--solo=<paso>` y `--dump=<ruta>` para sondear una
  pantalla. **Un login por corrida** (el login admite 5/min).
- **Los gates**: `audit:ci` (frontend, incluye `audit:document-lines-grid` y su autoprueba),
  `gate:rapido` (backend), `audit:migrations:check` + `:self-test`, `audit:reconcile` (necesita BD),
  y `ci:local` en la raíz.
- **Antes de empujar**: los tres árboles limpios, la suite completa (el `pre-push` la corre), y
  **comprobar los dos espejos** del backend.
- **Al añadir un caso que cita un T**: marca `// fixture-medido: T…` en el spec, fila en `AUDIT.md`, y
  `npm run audit:fixtures:update-baseline`.
