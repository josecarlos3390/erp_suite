# Tres sucursales en el ERP: sucursal única con almacenes + centros de costo, o tres sucursales

> **Qué es este documento.** El ejercicio pedido: una empresa con **3 sucursales** quiere
> informes de venta por punto y contabilidad separada por punto. Se probaron **dos formas de
> modelarlo** en el ERP, con datos reales y **pruebas automatizadas**, y aquí está la comparación
> con lo **medido**, no con lo supuesto.
>
> **Fecha**: 2026-11-09 · **Commit de referencia**: backend `bac22d10` + el fix de dimensiones de
> este incremento (T615).
>
> **Reproducir** (en `backend-erp`, base de test):
> ```bash
> node --experimental-vm-modules --max-old-space-size=6144 \
>   node_modules/jest/bin/jest.js --config ./test/jest-e2e.json \
>   test/sucursales-circuito-a.e2e-spec.ts test/sucursales-circuito-b.e2e-spec.ts
> ```

---

## 1. Los dos circuitos

| | **A — una sucursal + un almacén por punto** | **B — tres sucursales reales** |
|---|---|---|
| Sucursales (`Branch`) | 1 | 3 |
| Almacenes (`Warehouse`) | 3, todos de esa sucursal | 1 por sucursal (3) |
| Usuarios | **1** sirve para los tres puntos | **1 por sucursal** |
| Separación de **ventas** | por **almacén** | por **sucursal** |
| Separación **contable** | por **centro de costo** (`dimensionN`) | por **sucursal** (`branchId` del asiento) |
| Serie de numeración | una | una por sucursal (recomendado) |
| Spec | `test/sucursales-circuito-a.e2e-spec.ts` (**5 casos**) | `test/sucursales-circuito-b.e2e-spec.ts` (**5 casos**) |

### Importes medidos (deterministas: cantidad × precio)

| Punto | Circuito A (almacén / centro) | Circuito B (sucursal) |
|---|---|---|
| Punto 1 | ALM-C · CC-CASA · 2 × 100 = **200** | SUC-01 · 2 × 100 = **200** |
| Punto 2 | ALM-N · CC-NORTE · 3 × 100 = **300** | SUC-02 · 5 × 100 = **500** |
| Punto 3 | ALM-S · CC-SUR · 1 × 100 = **100** | SUC-03 · 1 × 250 = **250** |
| **Total** | **600** | **950** |

## 2. Lo que cada circuito **puede** informar (medido)

| Informe | Circuito A | Circuito B |
|---|---|---|
| Ventas **por punto de venta** | ✅ `GET /reports/sales?groupBy=warehouse` → **3 filas** con su importe | ✅ `GET /reports/sales?groupBy=branch` → **3 filas** con su importe |
| Ventas **por sucursal** | ⚠️ **1 sola fila** (todo es la misma sucursal): el punto **no** se distingue por sucursal | ✅ 3 filas |
| Ventas acotadas a un punto | ✅ `?warehouseId=X` (suma **por línea**) | ✅ `?branchId=X` |
| Balance de comprobación por punto | ⚠️ solo **por centro de costo** (`/reports/trial-balance` no filtra por centro) | ✅ `?branchId=X` |
| Estado de resultados por punto | ⚠️ solo vía costos por centro | ✅ `?branchId=X`, con el ingreso de **esa** sucursal |
| Ingreso por **centro de costo** | ✅ `/reports/cost-centers?dimensionNumber=1` → 200 / 300 / 100 | ❌ no se usa (no hay centros en el circuito) |
| Asiento con el punto identificado | ✅ `dimension1` por línea (**tras el arreglo T615**) | ✅ `branchId` por línea, **por construcción** |

## 3. Ventajas y desventajas

### Circuito A — una sucursal, un almacén por punto, contabilidad por centro de costo

**Ventajas**
1. **Un solo usuario, un solo juego de series, un solo cierre.** Medido: el mismo usuario creó
   las tres ventas **sin ningún 403**; en B, el usuario de una sucursal **no** puede facturar en
   otra.
2. **Informe de ventas por punto sin configuración extra**: `groupBy=warehouse` sale del almacén
   de **la línea**, que es un dato que el vendedor ya elige al facturar.
3. **La contabilidad separa por criterio de negocio**, no por estructura: sirve igual para
   "punto de venta", "línea de producto" o "proyecto", cambiando el eje y el valor.
4. **Menos datos maestros**: no hay que crear sucursales, series por sucursal ni usuarios por
   sucursal.

**Desventajas (medidas)**
1. **La venta no se puede informar "por sucursal"**: `groupBy=branch` devuelve **una fila** con
   los 600, no tres. Si el negocio pide "ventas de la sucursal Norte", hay que leerlo **por
   almacén** y traducir mentalmente almacén → punto.
2. **La contabilidad depende de que alguien capture el centro en cada línea.** El centro es
   **analítico**: si falta, el ingreso cae en la fila «sin centro» del informe y **nadie lo
   bloquea**. Y hasta este incremento **el centro no llegaba al asiento**: el
   `sales.journal-builder` lo copiaba, pero la factura de venta **no se lo pasaba** al motor
   (T615) — es decir, el informe por centro existía y devolvía **cero** para el ingreso.
3. **El balance de comprobación y el estado de resultados no filtran por centro**: la
   contabilidad por punto se obtiene del informe de **costos** por centro, que mezcla débitos y
   créditos por cuenta dentro de cada centro.
4. **La numeración fiscal es única** para los tres puntos: si la norma o el cliente exigen
   series por punto de emisión, este modelo **no** lo da sin trabajo extra.

### Circuito B — tres sucursales reales, cada una con su almacén

**Ventajas**
1. **Separación estructural, no declarativa**: el asiento lleva `branchId` **por construcción**
   (medido: `groupBy(['branchId'])` da exactamente 200 / 500 / 250, sin líneas cruzadas), así
   que **no depende de que nadie capture nada**.
2. **Informes por punto nativos y para todo**: ventas (`groupBy=branch`), balance de
   comprobación (`?branchId`), estado de resultados (`?branchId`). El Circuito A no tiene
   equivalente para los dos últimos.
3. **Sirve para lo que se audita por sucursal**: numeración por sucursal, cierre por sucursal,
   responsabilidad por sucursal, permisos por sucursal.
4. **El punto de venta es una entidad de primera clase**: si mañana hay que dar de alta la
   sucursal 4 con su dirección y su almacén, es una fila más, no una convención.

**Desventajas (medidas)**
1. **Un usuario por sucursal**: el usuario de la sucursal 1 que intenta facturar en la 2 recibe
   **403** («no puedes operar sobre otra sucursal: pide la operación a un usuario de esa
   sucursal»). Verificado en la suite.
2. **Incluso el alta del almacén de otra sucursal da 403**: en el caso de prueba hubo que crear
   el almacén de la sucursal 2 **por setup** (Prisma) porque con el usuario de la 1 la API
   responde 403. En la práctica significa que **la puesta en marcha de una sucursal la hace su
   propio usuario** (o un super-admin).
3. **Más setup por sucursal**: almacén **+ matriz de almacenes del artículo** (medido: sin la
   fila de `ItemWarehouseAccount` el primer movimiento responde 400 «no está habilitado para
   operar en el almacén»), serie, usuario(s) y sus permisos.
4. **Más coste operativo**: una persona por sucursal, un juego de series, y la contabilidad
   comparada exige sumar tres informes si se quiere el total del negocio (o usar el informe sin
   `branchId`).

## 4. Lo que el ERP **hoy** no resuelve (declarado, con su medición)

| Límite | Medido |
|---|---|
| El **balance general** (`/reports/balance-sheet`) no filtra por sucursal | solo `from`/`to`/`date` en su DTO. Comparte motor de saldos con el estado de resultados, así que agregarle `branchId` es una línea; **ninguno de los dos circuitos lo pide** |
| `/reports/trial-balance` **no** filtra por centro de costo | solo `accountId` + (nuevo) `branchId` |
| Una factura **multi-almacén** cuenta entera en cada almacén al filtrar el **listado** (`items.some`) | el informe por almacén sí reparte por línea |
| El centro de costo es **analítico**: no bloquea la línea sin centro | se ve en el informe como fila «sin centro»; no hay validación que lo exija |

## 5. Recomendación

**Depende de qué signifique «sucursal» para la empresa**, y la pregunta se responde en una línea:

> ¿La sucursal **emite** en su propio nombre (factura, número, cierre) o es **un punto de venta**
> de una misma empresa legal?

- **Si la sucursal emite y se audita por separado → Circuito B (tres sucursales).** Es el único
  que da informes por sucursal **para todo** (ventas, balance, resultado) y el que **no depende
  de que nadie capture un centro** para que la contabilidad cuadre. El precio es explícito y
  medido: **un usuario por sucursal**, el 403 al cruzar, y el setup de almacén + matriz + serie
  por sucursal.
- **Si la sucursal es un punto de venta comercial dentro de una sola empresa → Circuito A**
  (una sucursal, un almacén por punto, contabilidad por centro de costo). Es **más simple de
  operar** (un usuario, una serie, un cierre) y da **ventas por punto** sin configuración
  contable. Hay que aceptar dos cosas, medidas: el informe **por sucursal** no distingue el
  punto (una fila), y la contabilidad por punto **solo existe si cada línea lleva su centro**
  (con el arreglo T615 ya llega al asiento, pero **nada obliga** a capturarlo).
- **El híbrido, que es el que suele querer una empresa que crece**: **tres sucursales** (B) para
  la operación y **un centro de costo por línea de negocio** dentro de cada una. Los dos ejes
  conviven —`branchId` en la cabecera y `dimension1` en la línea— y los informes que ya existen
  se combinan: `sales?groupBy=branch`, `trial-balance?branchId=X` y
  `cost-centers?dimensionNumber=1&branchId=X` (el filtro por sucursal del informe de centros es
  de este incremento, T614).

**En una frase**: con **una** sucursal se compra **simplicidad** y se paga con informes por
punto que son de almacén y con una contabilidad que depende de la captura; con **tres**
sucursales se compra **separación real** y se paga con **una persona y un setup por sucursal**.

## 6. Qué se arregló para poder medir esto

- **T614** — los informes no filtraban por sucursal ni por almacén: se añadieron
  `branchId`/`warehouseId` y los agrupadores `branch`/`warehouse` al informe de ventas, y
  `branchId` a `journal`, `trial-balance`, `general-ledger`, `income-statement` y `cost-centers`.
- **T615** — **el centro de costo capturado en la línea no llegaba al asiento** (la factura de
  venta no le pasaba las dimensiones al motor): sin eso, el Circuito A **no podía** separar el
  ingreso por centro. Arreglado en la factura de venta (la de reserva ya lo hacía) y verificado
  con el caso «el asiento lleva el centro de cada línea».
