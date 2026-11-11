# Traspaso — próxima sesión

> **Qué es esto.** El estado medido al cerrar la sesión del 2026-11-10/11 y el plan para continuar
> **sin repetir los tropiezos**. Todo lo que aquí se afirma está medido y su fila del ledger
> (`AUDIT.md`, T668–T684) lleva el comando o la captura que lo produjo.
>
> **La regla de la casa sigue siendo la misma**: si algo no se mide, no se adopta; y si un diagnóstico
> se corrige, **se escribe** (aquí hay cuatro correcciones a diagnósticos míos: T669, T677, T681→T682
> y T662→T684).

---

## 0 · Lo que quedó hecho en la sesión siguiente (2026-11-11)

| Paso | Estado | Evidencia |
|---|---|---|
| **1 · Recepción desde el pedido** | ✅ **hecho** — T681 era un falso negativo: el botón **sí** registra (`REC-1` desde `PC-1`, y `REC-2` desde `PC-2` en una segunda vuelta) | T682 |
| **2 · Factura desde la recepción** | ✅ **hecho** — `FVC-4` (150,00) y `FVC-5` (100,00), con asiento cuadrado; y **corregido** el borrador que enseñaba otro total (T683) | T683 |
| **3 · Cobro de las ventas** | ✅ **hecho** — `COB-1` por 200,00 cobra `FVE-1`+`FVE-2` (las deja en cero), con asiento cuadrado; antes **faltaba la serie** del tipo «Pago recibido» | T684 |
| **4 · P3 (celdas proyectadas)** | ✅ **hecho en la COMPRA** (T685): las once celdas del tipo, del pedido y de la recepción pasan a la rejilla, con gate nuevo `R3` | T685 |

`npm run audit:reconcile` al cierre: **0 errores · 12 asientos que cuentan**. Repos: ver §1 (los SHA
de la cabecera son los de la sesión anterior; esta sesión añadió commits en `erp-frontend` y raíz).

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
| **Series** | **8** (`FVE-01`, `PV-01`, `ENT-01`, `ING-01`, `PC-01`, `REC-01`, `FVC-01`, **`COB-01`**) | `/document-series` (la del cobro, T684) |
| Terceros | `Cliente Demo S.A.` · `Proveedor Demo Ltda.` | `/partners/new` |
| Artículos | `ART-00001` (venta+compra+inventario), `ART-00002` (venta), `ART-00003` (compra) | `/items/new` |
| **Ventas** | `FVE-1`, `FVE-2` (100 c/u, **cobradas por `COB-1`**) · `FVE-3` (100) | `/sale-invoices/new?manual=1` |
| **Compra manual** | `FVC-3` (**120,00**) con asiento 104,40 + 15,60 = 120,00 | `/purchase-invoices/new?manual=1` |
| **Pedidos** | `PC-1` (**150,00**, recibido) · `PC-2` (**100,00**, recibido) | `/purchase-orders/new?manual=1` / API |
| **Recepciones** | `REC-1` (**150,00**, desde `PC-1`) · `REC-2` (**100,00**, desde `PC-2`) | «Copiar a» del pedido (T682) |
| **Facturas de compra desde recepción** | `FVC-4` (**150,00**, desde `REC-1`) · `FVC-5` (**100,00**, desde `REC-2`) | «Copiar a» de la recepción (T683) |
| **Cobro** | `COB-1` (**200,00**, efectivo, `FVE-1`+`FVE-2`) | `/incoming-payments/new` (T684) |
| Mayor | **12 asientos, todos cuadrados** | `audit:reconcile` (0 errores) |

**Repos**: `backend-erp` = `12ff3f19` (origin = deploy; esta sesión **no** tocó el backend) ·
`erp-frontend` = `ec85d4d2` (T683 + T685) · raíz = `3552936` + el commit de este cierre. Árboles
limpios; los instrumentos de sondeo (`erp-frontend/scripts/probe-*.mjs`) se borraron al cerrar.

**Aviso de concurrencia (medido).** Durante esta sesión **otro actor commiteó en el repo raíz**
(`0a340c1` con `docs/plans/objetivo-todo-por-ui.md` y `3552936`, que se llevó mis tres documentos con
un mensaje distinto al que escribí). El contenido quedó correcto y el árbol limpio, pero **comprueba el
actor antes de empujar**: el `pre-commit` del frontend falló al arrancar en `ec85d4d2`
(`env.exe … fatal error - add_item`, errno 1) y **no corrió `lint-staged`** —la verificación se hizo a
mano: `ng lint` 0/0, `prettier --check`, Karma 3 095/3 095 y `audit:ci`—. Los dos commits están
**sin empujar**.

---

## 2 · Lo que queda, en el orden que recomiendo

### Pasos 1–3 · hechos el 2026-11-11 (no repetirlos)

Los tres están medidos y cerrados en el ledger; el detalle de lo que se corrigió va en **T682**
(recepción), **T683** (factura desde la recepción) y **T684** (cobro). Resumen de lo aprendido:

- **La recepción registra.** El «no pasa nada» de T681 no se reproduce con el build actual: la barra
  de acciones **está dentro del `<form>`** (se mide con
  `document.querySelector('form')?.contains($0)`), el botón es `type="submit"` con `form` asociado y el
  clic abre «¿Crear recepción?» → `201 POST /purchase-receipts/from-order/{id}`.
- **La factura desde la recepción hereda el origen**: proveedor (id, no nombre), tasa y **montos**
  (neto + IVA del documento origen, proporcionales si se factura menos). Antes el borrador publicaba
  147,47 para un documento de 150,00.
- **El cobro necesitaba su serie**: `INCOMING_PAYMENT` no tenía ninguna y el formulario lo decía
  («No hay series de numeración definidas para este tipo»). Se creó `COB-01` por `/document-series`
  —y de paso se corrigió la nota de T662: `luna-select` **sí** es un `<select>` nativo; hay que
  localizarlo como `luna-select[formcontrolname="…"] select`.

### Paso 4 · P3 (deuda declarada del frontend) — ✅ hecho en la compra (T685)

Las **once** celdas que la compra proyectaba (el `type` de la factura, el `receivedQty` del pedido y
las diez de la recepción) ya son celdas canónicas de la rejilla. Lo que queda **no** es de la compra:

- **Migrar las familias que proyectan claves ya canónicas.** El gate nuevo
  `audit:document-lines-grid` (R3) las cuenta: hoy **8** declaradas en el baseline y con su razón
  —`sale-invoices` 2 (`manualAccount`, `distributionRule`) y `delivery-orders` 6—. Fuera del censo del
  gate quedan reservas, devoluciones y los tres de stock, que también proyectan: están declaradas en
  AUDIT.md T685.
- **La frontera que no hay que romper**: una familia enciende la celda canónica con
  `[purchaseCells]="true"`; apagada, la rejilla **sigue pintando la plantilla proyectada**. Si migras
  una familia, borra su `ng-template` en el mismo cambio o la celda canónica quedará **muerta en
  silencio** (el gate R3 es justo el que lo impide).



---

## 3 · El plan original, y cómo va

| Fase | Estado |
|---|---|
| Documento de servicio en ventas/compras (8 sitios) | ✅ hecho (sesiones anteriores) |
| Centro de Configuración + circuito por pantalla | ✅ hecho (T658–T667) |
| **Un solo motor de líneas** (8 familias) | ✅ **cerrado** (T668–T673: 8/8, baseline vacío, −1 362 líneas) |
| Compra **manual** con asiento | ✅ (T678) |
| Pedido con precio | ✅ (T679) |
| **Recepción desde pedido** | ✅ `REC-1` y `REC-2` (T681 era falso negativo → T682) |
| **Factura desde recepción** | ✅ `FVC-4` y `FVC-5`, con asiento (T683) |
| **Cobro** | ✅ `COB-1` 200,00, CxC en cero (T684) |
| Informe «entregas sin cargo» | ✅ (T656) con filtro por usuario (T657) |
| **P3 del frontend** (celdas proyectadas) | ✅ en la compra (T685); el resto, declarado en el gate R3 |

---

## 4 · Los tropiezos del camino (para no repetirlos)

1. **`ng serve` sirviendo un bundle viejo**: un «no funciona» que era del arnés. **Reiniciar el dev
   server** antes de concluir (pasó dos veces: T660 y T675).
2. **El botón que registra abre un modal de confirmación** («¿Registrar…?» → «Sí, registrar»): el
   pedido lo hace; si no se pulsa, **no hay POST** y la pantalla no dice nada.
3. **`type="submit"` en la barra de acciones** solo falla si la barra es **hija directa** de
   `luna-form-page` (entonces se proyecta fuera del `<form>`). Escrita **dentro** del `<form>` (el
   layout de §5) se queda donde está y el submit funciona: **medirlo con
   `document.querySelector('form')?.contains($0)`** antes de tocar nada (T682; la nota de la guía ya
   lleva la condición).
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
13. **PowerShell tampoco es un buen EDITOR de scripts**: `(Get-Content -Raw) -replace … | Set-Content`
    leyó el `.mjs` como cp1252 y lo devolvió doble-codificado (cada acento pasa a dos caracteres), y
    una regex con acentos en el localizador dejó de casar **en silencio** (el «Agregar método» contaba
    0). Editar con la herramienta del agente, no por round-trip (pasó tres veces en esta sesión).
14. **`luna-select` ES un `<select>` nativo, pero el `formControlName` vive en el host**: el localizador
    es `luna-select[formcontrolname="docType"] select`, no `select[formcontrolname=…]` (T684). La nota
    de T662 que decía lo contrario era falsa.
15. **La primera fila de una tabla larga puede quedar bajo la barra de acciones**: un `click()` normal
    lo intercepta la barra; en la sonda se usó `elemento.click()` nativo (T684).

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
