# Runbook — Declaración retroactiva del ancla de una devolución manual

> **Qué resuelve.** T291 cerró el camino manual: una devolución de venta sin
> entrega, sin factura y sin ancla declarada responde **400
> `RETURN_ANCHOR_REQUIRED`**, y R14 la marca **ERROR**. Quedó abierta la decisión
> sobre las devoluciones manuales **históricas**: declararlas retroactivamente
> (con un motivo y una persona, con fecha) o dejarlas como deuda declarada. Este
> runbook mide el universo, enseña la tabla que se firma y documenta el reparador
> que ejecuta la declaración.

- **Fecha de la medición:** 2026-10-19 (America/La_Paz).
- **Repositorio medido:** `backend-erp`, rama de trabajo desde `main` = `ad6234a9`
  (T291 publicado).
- **Base medida:** `erp_db` **solo lectura** (`BEGIN READ ONLY` / `SET
  default_transaction_read_only = on`). **No se ejecutó `--apply` contra `erp_db`.**
- **Alcance de la declaración:** `SalesReturn` con `deliveryOrderId IS NULL` y
  `returnAnchor IS NULL` (la devolución manual histórica).

---

## 1. La medición: dónde están de verdad las manuales

### 1.1 `erp_db`

| Medida | Valor |
|---|---|
| `SalesReturn` totales | **30** |
| `deliveryOrderId IS NULL` (manuales) | **0** |
| `returnAnchor IS NULL` | **no evaluable**: la columna no existe en `erp_db` |
| Devoluciones con `deliveryOrderId NOT NULL` (ancla `DELIVERY`) | **30** |

**El dato que decide: en `erp_db` no hay ninguna devolución manual que declarar.
Cero.** Las 30 devoluciones existentes tienen entrega; su ancla es `DELIVERY` por
definición de T291, no una manual sin ancla.

**Segundo hallazgo, medido y bloqueante para un `--apply`:** `erp_db` **no tiene
aplicada la migración de T291** (`20261019170000_sales_return_anchor`). Comprobado
por dos vías:

```sql
-- information_schema: no devuelve ninguna fila
SELECT column_name FROM information_schema.columns
WHERE table_name = 'SalesReturn' AND column_name = 'returnAnchor';

-- _prisma_migrations: no devuelve ninguna fila
SELECT migration_name FROM "_prisma_migrations"
WHERE migration_name LIKE '%return_anchor%';
```

Por eso el dry-run del reparador contra `erp_db` **aborta con la guarda de
esquema**, no con una lista vacía:

```text
DECLARACIÓN ABORTADA: ABORTADO: la base "erp_db" no tiene la columna
"SalesReturn.returnAnchor" (la migración 20261019170000_sales_return_anchor de
T291 no está aplicada). No se puede medir ni declarar. No se ha tocado nada.
```

**La medición de las manuales sigue siendo válida sin la columna:** el predicado
`deliveryOrderId IS NULL` devuelve **0**, así que no hay ninguna fila que pudiera
tener `returnAnchor` nulo. Para declarar en `erp_db` haría falta primero aplicar
la migración de T291; eso es una escritura y **no la hace este encargo**.

### 1.2 Las 10 DEV-6…15 del ledger son del ARNÉS, no de `erp_db`

El ledger de T291 dice, literal (`backend-erp/CHANGELOG.md:10`): «medido a volumen
5: **10 manuales (DEV-6…15), 15 u, todas 201**». El comentario de la invariante
precisa su composición (`src/tenant-health/invariant-rules.ts:1669`): «5 × 2 u del
lote (194) y 5 × 1 u de la serie (195)».

Esas filas vivían en el **volumen 5 del arnés, tenants 29 y 927**, que están
**borrados**. Se comprobaron las bases locales:

| Base | `SalesReturn` | ¿Tiene `returnAnchor`? |
|---|---:|---|
| `erp_db` | 30 (todas con entrega) | **no** |
| `erp_test` | **0** | sí |
| `erp_db_shadow` | **0** | no |
| `erp_k6` | **0** | no |
| `erp_db_18_previo` | no existe la tabla `SalesReturn` | — |

**Conclusión:** no hay ninguna base local que contenga las 10 DEV. No se pueden
declarar retroactivamente porque **no hay fila que declarar**. Si el usuario
quiere declararlas en una **base de cliente** o en una **copia de seguridad** del
arnés, el mecanismo es el mismo y el alcance es esa base: hay que apuntar
`DATABASE_URL` allí, aplicar la migración de T291 y ejecutar el dry-run del
reparador con `--database=<nombre>`.

### 1.3 La tabla que se firma

La tabla se llena con el dry-run del reparador. **Definiciones de las columnas:**

- **saldo abierto:** `SaleInvoice.balanceDue` de la factura candidata (el saldo
  que la devolución ayuda a explicar). Si el ancla no es `INVOICE`, se escribe
  `—` y el importe de la devolución va en la celda de la devolución.
- **techo medido:** la cantidad de la línea de factura (`INVOICE`) o lo facturado
  del artículo en la ventana menos lo ya devuelto por `ITEM_WINDOW`; `REASON` se
  declara **sin techo** a propósito.
- **cabe:** `cantidad ≤ disponible`. En `REASON` no hay comparación comercial: la
  contención es el motivo firmado.

| devolución | fecha | cliente | artículo | cantidad | saldo abierto | ancla propuesta | techo medido | cabe | motivo propuesto |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | **0 filas medidas en `erp_db` el 2026-10-19: no hay devolución manual sin ancla.** |

**Esta tabla vacía es el resultado de la medición, no un olvido.** Si se firma,
se firma la constancia de que **en `erp_db` no hay nada que declarar**; para otra
base, se vuelve a ejecutar el dry-run y se sustituye la tabla por la que salga.

### 1.4 Línea de firma

**Autorizado por: ___ · Fecha: ___ · Motivo: ___**

> **Advertencia medida.** `--apply` **sin los tres campos no escribe nada**:
> `--authorized-by=<userId>`, `--reason=<texto>` y `--database=<nombre>` (este
> último también en dry-run). Sin `--apply` el script es dry-run y no escribe.
> La declaración sin persona es exactamente lo que el gate prohíbe.

---

## 2. El reparador: `scripts/declare-return-anchors.ts`

### 2.1 Qué mide y qué propone

Para cada devolución manual (`deliveryOrderId IS NULL`, `returnAnchor IS NULL`)
mide, **con las mismas consultas que el motor de T291**
(`resolveSalesReturnCeilings`), un ancla viable:

1. **`INVOICE`** — una factura viva del mismo socio con una línea del mismo
   artículo y cantidad disponible. Es la más fuerte: el techo es la línea de
   factura menos lo ya devuelto contra ella. **Si se declara, el reparador
   escribe también el vínculo por línea** (`baseDocType='SALE_INVOICE'`,
   `baseDocId`, `baseLineId`, `baseLineNum`): sin él R14 sigue en ERROR.
2. **`ITEM_WINDOW`** — lo facturado del artículo en la ventana (90 días por
   defecto, configurable con `--window-days`), menos lo ya devuelto por esa misma
   vía. El techo se suma de `SaleInvoiceItem`, nunca de una columna
   denormalizada.
3. **`REASON`** — reposición/garantía, **sin techo comercial**. Solo se puede
   declarar con un motivo y un autorizador firmados; el script no puede demostrar
   que sea una garantía.

La precedencia es `INVOICE` > `ITEM_WINDOW` > `REASON`. Las **reservas se
comparten entre devoluciones de la misma pasada**: dos manuales que compiten por
la misma línea de factura o la misma ventana no gastan el techo dos veces. El plan
que imprime el dry-run es el que se escribe con `--apply`.

**Trampa de fecha medida el 2026-10-19:** una devolución guardada a las 00:00 y
una factura del **mismo día** a las 04:00 (la representación del día del tenant)
no casaban con `date <= return.date`, y la devolución caía a `REASON` teniendo una
factura viva. El script compara por **día calendario**: el «hasta» es el final del
día de la devolución y la ventana arranca al inicio del día `windowDays` antes.

### 2.2 Qué escribe (solo con `--apply` y firma)

En **una transacción** por pasada:

1. `SalesReturn.returnAnchor`, `anchorInvoiceId` (solo `INVOICE`),
   `anchorWindowDays` (solo `ITEM_WINDOW`) y `anchorReason` con la **MARK**
   `[DECLARACION-ANCLA-20261019]`.
2. Si el ancla es `INVOICE`, el vínculo por línea del punto 2.1.
3. Una fila `AuditLog` `RETURN_ANCHOR` con **el mismo formato que T291**:
   `kind: 'return-anchor'`, `anchor`, `reason`, `authorizedByUserId`,
   `permission` (`returns:manual` en `ITEM_WINDOW`, `returns:replacement` en
   `REASON`, `null` en `INVOICE`), `windowDays`, `windowFrom`, `ceilings` y
   `declaration.declaredAt` (fecha de la declaración).

**Idempotencia:** la segunda pasada no encuentra candidatas
(`returnAnchor IS NULL`) y lo dice; una fila ya declarada no se vuelve a tocar.
La escritura es condicional (`updateMany` con `returnAnchor: null`), así que una
declaración concurrente no se pisa.

### 2.3 Guardas que abortan

| Guarda | Efecto |
|---|---|
| `--database` ausente o distinto de `DATABASE_URL` | aborta, no conecta a escribir |
| base `erp_shadow` o cualquier `*shadow*` | aborta |
| `--apply` sin `--authorized-by` | aborta |
| `--apply` sin `--reason` | aborta |
| base sin la columna `returnAnchor` | aborta (migración T291 no aplicada) |
| autorizador inexistente, no `ACTIVE` o sin el permiso del ancla | aborta antes de escribir |
| devolución sin líneas / cantidad no positiva | bloquea y revierte la transacción |
| línea ya vinculada a otro documento | no propone `INVOICE`; cae a `ITEM_WINDOW`/`REASON` |
| `--prove-one` sin candidata (o `--return-id` inexistente) | aborta |

### 2.4 Uso

```bash
cd backend-erp

# 1) Medir (dry-run por defecto: NO escribe)
npm run declare:return-anchors -- --database=erp_db

# 2) Medir un tenant / mostrar una sola
npm run declare:return-anchors -- --database=erp_db --tenant=6
npm run declare:return-anchors -- --database=erp_db --prove-one

# 3) Escribir UNA (antes/después, sin tocar el resto)
npm run declare:return-anchors -- --database=erp_db --apply --prove-one \
  --authorized-by=<userId> --reason="<motivo firmado>"

# 4) Escribir todas las del plan (una transacción)
npm run declare:return-anchors -- --database=erp_db --apply \
  --authorized-by=<userId> --reason="<motivo firmado>"

# 5) Segunda pasada (debe decir 0 escritas y N ya ancladas)
npm run declare:return-anchors -- --database=erp_db --apply \
  --authorized-by=<userId> --reason="<motivo firmado>"

# Autoprueba del planificador y de las guardas (sin BD)
npm run declare:return-anchors:self-test
```

**`--prove-one` no salta la firma:** si escribe (`--apply`), exige
`--authorized-by` y `--reason`; sin `--apply` solo muestra la primera candidata.

---

## 3. Prueba con datos fabricados (`erp_test`, no es la tabla a firmar)

Para demostrar el mecanismo **sin tocar `erp_db`**, se crearon tres devoluciones
manuales en `erp_test`, tenant de prueba **913**, socio 1468, artículo 5118,
factura viva **FVE-1** (línea 1534, 5 u):

| devolución | fecha | cliente | artículo | cantidad | saldo abierto | ancla propuesta | techo medido | cabe | resultado |
|---|---|---|---:|---:|---:|---|---|---|---|
| `TEST-DECL-A-20261019` (id 208; Bs 226,00) | 2026-10-19 | CLI-001 | ART-001 | 2 | Bs 565,00 | `INVOICE` FVE-1 | línea 5 u · ya devuelto 0 · disp. 5 | sí | `--prove-one` la declaró |
| `TEST-DECL-B-20261019` (id 209; Bs 226,00) | 2026-10-19 | CLI-001 | ART-001 | 2 | Bs 565,00 | `INVOICE` FVE-1 | línea 5 u · ya devuelto 2 · disp. 3 | sí | `--apply` la declaró |
| `TEST-DECL-C-20261019` (id 210; Bs 678,00) | 2026-10-19 | CLI-001 | ART-001 | 6 | — (sin factura) | `REASON` | sin techo | — | `--apply` la declaró con motivo firmado |

Lo medido, literal:

1. **Dry-run:** A y B → `INVOICE` (la segunda ve el techo que dejó la primera:
   disponible 3), C → `REASON` (no cabe en la línea de 5 ni en la ventana de 5).
   Resumen: `3 candidatas · 2 con ancla MEDIDA · 1 solo con motivo firmado`.
2. **`--prove-one --apply`:** declaró **solo A** (`returnAnchor=INVOICE`,
   `anchorInvoiceId=1358`, línea 258 → `SALE_INVOICE/1358/1534`, `anchorReason`
   con la MARK); B y C quedaron con `returnAnchor` nulo.
3. **Dry-run después:** B → `INVOICE` con disponible 3; C → `REASON`.
4. **`--apply`:** declaró B y C. B quedó `INVOICE` con su línea vinculada; C
   quedó `REASON` **sin tocar su línea** (no tiene vínculo comercial).
5. **Auditoría:** tres filas `RETURN_ANCHOR` en `AuditLog`, `userId=857`,
   `authorizedByUserId=857`, `permission=null` en A/B (INVOICE no exige permiso)
   y `returns:replacement` en C, con `declaredAt` y `database='erp_test'`.
6. **Segunda pasada:** `sin ancla: 0 · ya ancladas: 3` → **0 escritas**, y el
   script lo dice.
7. **Limpieza:** se borraron las tres devoluciones, sus líneas y sus filas de
   auditoría; `erp_test` quedó con **0** `TEST-DECL-%`.

Estos datos **no** están en la tabla que se firma: eran el banco de prueba del
mecanismo y se borraron.

---

## 4. Límites declarados

- **`erp_db` no tiene la migración de T291 aplicada.** El dry-run aborta con la
  guarda de esquema. Para declarar allí hay que aplicar la migración primero
  (escritura del usuario, no de este encargo).
- **`REASON` no se puede verificar.** El script comprueba permiso, persona y
  motivo, pero no puede demostrar que la devolución sea una reposición/garantía.
  La firma es la que lo declara; el script lo escribe en su salida.
- **`INVOICE` reescribe el vínculo de la línea** (necesario para R14). No toca
  `baseQty` si ya existía; si era nulo, lo deja en la cantidad devuelta.
- **No toca importes, stock, asientos ni estados.** Solo el ancla, el vínculo de
  factura y la fila de auditoría.
- **El autorizador es una persona por tenant.** Si el plan toca varios tenants,
  el mismo `userId` tiene que existir y tener permiso en cada uno; si no, aborta
  antes de escribir.
- **Sin gate propio.** El `--self-test` (9/9) se ejecuta a mano; no se añadió al
  `pre-push` para no alargar la puerta. Se declara aquí.
