# Plan — Corrida general de validación (operación intensiva + cuadre)

> Estado: **cerrada con huecos declarados** (2026-09-22). Pedido del usuario: «asumiendo que tenemos 50
> usuarios registrando compras, ventas, importaciones, ventas POS, revalorizaciones, pagos,
> cuotas… que todas las baterías cubran todas las funcionalidades del ERP, documentar los
> huecos, y al final que la contabilidad, el stock (general y por lote/serie), los kardex de
> productos y clientes, las CxC/CxP y los costos queden cuadrados». Resultado medido: **§Resultados**.

## Fases

| Fase | Qué se corre | Qué prueba |
|---|---|---|
| **F1 — Gate funcional** | `npm run db:recreate` + `npm run e2e:functional` (241 pruebas, ~40-45 min) | Valida el cambio de la pantalla de Configuración (retiro de los interruptores inertes) y las rondas anteriores sobre BD recreada |
| **F2 — Tráfico: barrida operativa completa** | `node scripts/flow-sweep.mjs` (sin `--only`), que recorre **12 secciones**: ventas, compras, inventario, retenciones, POS, tomas, ensamblaje, lotes, bancos, activos, importación (Precio de Entrega) y cierre de período | Cada paso verifica **inventario** (existencia por artículo y por lote/serie) y **contabilidad** (asiento POSTED y cuadrado; al anular, original `CANCELLED` + espejo `REVERSAL`), y cierra con el detector de flujos |
| **F3 — Tráfico concurrente (k6)** | `PERF_BASE_URL=http://localhost:3001 npm run perf:k6` (perfil `small`, 5 escenarios) | Carga simultánea sobre los caminos que la suite cubre: **facturas de venta** (carga y smoke), **import masivo en concurrencia**, **kardex** (lectura) y **aislamiento multi-tenant** |
| **F4 — Cuadre final** | `node scripts/audit-reconcile.mjs --snapshot` (después de recrear, **antes** del tráfico) y `--baseline` (después) + `npm run audit:tracking` + `npm run audit:flows` | Ver §Criterios |
| **F5 — Documentación** | AUDIT/CHANGELOG/ROADMAP/AGENTS/planes + commits y push a todos los remotos | — |

## Orden de la corrida (por qué no es el orden de las letras)

El **arnés de k6 empieza limpiando el tenant** (`resetTenantState` →
`cleanupDocuments`, que además deja `Stock.stockPhysical = 100` y `avgCost = null`),
así que correrlo **después** de la barrida borra el tráfico que se quiere cuadrar y
deja una existencia sin respaldo. Orden medido y adoptado:

1. **k6** (tráfico concurrente; su limpieza inicial da igual porque el paso 2 rehace la BD).
2. **`npm run db:recreate`** (apertura coherente) y **`audit:reconcile --snapshot`** → foto de la apertura.
3. **Barrida operativa** (F2) → tráfico funcional amplio sobre esa apertura.
4. **Cuadre** (F4) con `--baseline`: mide **variaciones** contra la apertura.

### Por qué el cuadre necesita la apertura

El seed valora **todo el almacén** al costo del maestro (T136,
`ensureStockValuation`) **sin crear movimientos de kardex**: exigirle kardex a esa
existencia inicial daría 29 falsos errores en toda corrida sobre BD recreada
(medido: `kardex 0.0000 vs existencia 100.0000`). Con `--baseline`, R2 exige
`existencia − apertura = kardex` y R3 promedia **incluyendo** la existencia y el
costo de apertura (que es lo que hace el motor de costo promedio); la apertura sin
kardex se **declara** aparte (R2b INFO), no se esconde.

## Criterios de cierre (F4)

| Regla | Qué exige | Severidad |
|---|---|---|
| **R1** | El diario cuadra: Σ debe = Σ haber de los asientos que cuentan para informes (POSTED y no `REVERSAL`) | ERROR |
| **R2** | **Inventario = kardex** por (artículo, almacén): `Stock.stockPhysical − apertura` = Σ entradas − Σ salidas, con la clasificación canónica y sin los movimientos de solo valorización | ERROR |
| **R2b** | Declara cuántas filas tienen existencia de apertura **sin** kardex (la valoración del seed) y cuántas pares tocó la corrida | INFO |
| **R3** | `avgCost` = promedio ponderado de las entradas **más la apertura** (se **excluyen y cuentan** los pares con Revalorización o Precio de Entrega, que fijan el costo a mano) | WARN |
| **R3b** | Declara los pares con apertura **sin costo** en el maestro (T136 los deja sin valorar a propósito) | INFO |
| **R4** | CxC/CxP por socio: neto del mayor en cuentas de activo/pasivo con `partnerId` vs Σ `balanceDue` de sus documentos (aproximación declarada: el mayor puede incluir anticipos) | WARN |
| **R5** | Sub-baterías `audit:tracking` (lotes/series) y `audit:flows` (vínculos entre documentos) limpias | ERROR |
| **R6** | Cobertura: cuántas de las **31 familias** de documentos tienen documentos en la corrida y **cuáles quedaron vacías** | INFO |


## Huecos ya medidos de las baterías (declarados antes de correr)

- **k6 no cubre compras, POS, pagos, producción ni revalorizaciones** bajo concurrencia: sus 5 escenarios son facturas de venta (carga y smoke), import masivo, kardex y aislamiento multi-tenant. Esos caminos se ejercitan **secuencialmente** por la barrida operativa, no en paralelo bajo 50 usuarios. **Hueco declarado**: falta una batería de carga para compras/POS/pagos.
- **k6 necesita `PERF_BASE_URL`**: su default es `http://localhost:3000` y la API de desarrollo escucha en **3001** (`perf/config.ts`). Sin esa variable el arnés limpia el tenant, falla en el login (`ECONNREFUSED`) y **deja la BD sin tráfico**: es un modo de fallo silencioso del arnés, medido en esta ronda.
- **Los umbrales de latencia de k6 no se cumplen en esta máquina** (medido con `K6_LATENCY_MODE=enforce`: `sale-invoice-load` p95 2,03 s vs 2 s y `bulk-import-concurrency` p95 47,17 s vs 30 s, con **0 % de fallos y 100 % de checks**). Es el mismo techo de escritura que ya obligó al perfil `large` a correr en modo medición: el veredicto **funcional** se toma con `K6_LATENCY_MODE=report` (que es también el modo del job programado) y la latencia se **reporta**, no se esconde.
- La barrida **no** recorre el IUE/compensación del IT ni los borradores de entrega (nota de alcance de AUDIT §9).
- El `cleanupDocuments` del arnés **no borra** tomas de inventario, órdenes de ensamblaje, extractos bancarios ni sesiones POS (medido: sobreviven a la limpieza de k6); no afecta al cuadre —esas tablas no tienen kardex propio— pero conviene saberlo al leer una BD «limpia».
- El perfil `large` de k6 (25 VUs) existe y corre programado en modo medición (`K6_LATENCY_MODE=report`); en esta corrida se usa el perfil `small` para no mezclar medición de latencia con el cuadre funcional.

## Alcance declarado de lo que **no** se puede afirmar

- «50 usuarios» se aproxima con **concurrencia real (k6) + volumen funcional (barrida)**; no se levantan 50 sesiones humanas simultáneas.
- El cuadre se mide **después** del tráfico, sobre la BD de desarrollo, sin cerrar el período: no incluye el asiento de cierre de ejercicio.

## Resultados medidos (2026-09-22)

| Fase | Resultado |
|---|---|
| **F1 — Gate funcional** | `db:recreate` OK y `e2e:functional` **236 passed · 1 failed · 3 skipped · 1 did not run** (43,0 min, 241 programadas) sobre BD recreada. El **único** fallo es `traceability-flow.spec.ts:118` con el síntoma de **T172 reabierto** (contexto JS del navegador inutilizable ~14 min; vueltas del viaje 21/40/59 s y ninguna cuarta) — **AUDIT T185**. El cambio de Configuración (retiro de los interruptores inertes de trazabilidad) **no** rompió ninguna otra prueba, y la pantalla cambiada tiene medición **directa**: `qa-visual-checks.spec.ts` (recorre `/settings` como «Visual: Configuración» y corre dentro del gate) **26/26** en 2,9 min y el spec unitario del componente **5/5** |
| **F3 — k6 (concurrencia)** | Perfil `small`, **5/5 escenarios**, **100 % de checks** (12/448/9230/9/273) y **0 % de `http_req_failed`** (0 de 5.126 requests), multitenant **sin fuga** (131 vs 140 facturas por tenant). `K6_LATENCY_MODE=report` (278,3 s); con `enforce` se cruzaban dos umbrales de latencia sin ningún fallo funcional |
| **F2 — Barrida operativa** | **13 secciones** (se sumó Revalorización), **390/390 comprobaciones OK**, detector de flujos **0 errores · 1 aviso de estado (R7) · 1 justificado** |
| **F4 — Cuadre** | `audit:reconcile --baseline` → **0 errores · 0 avisos · 4 informativos**: diario cuadrado sobre **106 asientos** que cuentan, **33** pares (artículo, almacén) con existencia (**9** tocados por el tráfico), CxC/CxP cuadrando con los documentos, **21** pares de apertura sin kardex declarados, **6** líneas de anticipo declaradas fuera del control, **3** pares de costo no reconstruibles (existencia final 0) declarados y **23 de 31** familias con documentos. Sub-baterías: `audit:tracking` **0 errores / 0 avisos** (4 artículos con seguimiento, 6 lotes, 6 series) y `audit:flows` **0 errores** |
| **F5 — Documentación** | AUDIT **T184** (batería de cuadre + corrida) y **T185** (T172 reabierto), CHANGELOG, AGENTS, ROADMAP y este plan |

**Respuesta a las cinco preguntas del cierre**: contabilidad **cuadrada** (R1), stock general **igual al kardex** contando la apertura (R2) y stock por lote/serie coherente (`audit:tracking` T1–T5 en 0), kardex de productos y **de clientes/proveedores** cuadrando con los documentos (R4), y costos **iguales al promedio corrido** del motor (R3: 0 desvíos con la regla correcta).

**Dos defectos de la propia batería** aparecieron en la corrida y quedaron corregidos con medición: el costo promedio se calculaba **solo con las entradas** (artículo 19: 34,517544 calculado vs **32,457627** real del motor, que era el correcto) y el saldo del socio se restaba en **convención de activo** mezclando el anticipo del cliente (proveedor 9: «−1000 vs 1000» cuando cuadraba). Los dos casos medidos son ahora **casos de la autoprueba** (11/11).
