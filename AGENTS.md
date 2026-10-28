# AGENTS.md — erp_suite

> **Instrucciones VIVAS del monorepo.** Aquí está solo lo que un agente necesita para trabajar:
> protocolo de lectura, convenciones, **gates y cómo se corren**, reglas de proceso y despliegue.
> **El registro histórico no vive aquí**: está íntegro y navegable en
> [`docs/plans/historial-sesiones.md`](docs/plans/historial-sesiones.md) (134 entradas fechadas
> 2026-09-18 → 2026-10-07, los bloques retirados de este archivo y una sección de «pendiente de
> revisar»).
>
> **Motivo del corte.** Este archivo pesaba **579 985 B** (580 748 B con finales CRLF) y **440 336 B**
> (el 76 %) eran **una sola línea** (432 023 caracteres) con el registro; el arnés solo lee los
> **primeros 65 536 B** de las instrucciones de workspace, así que el registro **nunca llegaba al
> modelo**. Nada se borró: la verificación byte a byte está documentada en el encabezado del histórico.
>
> **Qué es.** `erp_suite`: ERP modular (Bolivia) con `backend-erp/` (NestJS + Prisma), `erp-frontend/`
> (Angular + LUNA, con SSR) y `storefront/` (Next.js); detalle en el **Anexo F** del histórico.

---
> **Versión canónica de restricciones transversales.**  
> Para detalles específicos de frontend, backend, roadmap o auditoría, ver los archivos enlazados abajo.

---

## 🔒 Protocolo de inicio de trabajo (OBLIGATORIO)

Antes de realizar **cualquier acción** de código, diseño, planificación, refactorización, bugfix o auditoría en este monorepo, el agente **DEBE** leer el archivo de guía correspondiente según la naturaleza de la tarea. No se asumirá conocimiento previo de patrones, reglas de tipado, layouts ni estándares de UI.

| Tipo de tarea | Archivo obligatorio | Qué contiene |
|---------------|---------------------|--------------|
| **Frontend** (Angular, UI, componentes, formularios, listados, selectores, LUNA) | `FRONTEND_GUIDE.md` | Patrones canónicos, OnPush, LUNA, action bars, selectores, tipado, checklists |
| **Backend** (NestJS, API, Prisma, DTOs, servicios, queries, tests) | `BACKEND_GUIDE.md` | Arquitectura, seguridad de tipos (0 `as any`), deuda técnica, infraestructura, testing |
| **Planificación** (nuevas features, priorización, alcance, fases) | `ROADMAP.md` | Fases completadas, pendientes, criterios de aceptación, próximos pasos |
| **Bug / Auditoría** (investigar errores, fixes, regresiones, performance) | `AUDIT.md` | Hallazgos resueltos, base de bugs, métricas de referencia, issues activos |
| **General / Transversal** (tarea ambigua, onboarding, duda de arquitectura) | **Todos los anteriores** | — |

### Reglas de lectura

1. **Si la tarea toca `erp-frontend/src/`** (`.ts`, `.html`, `.scss`) → leer `FRONTEND_GUIDE.md` **completo** antes de escribir o modificar cualquier archivo.
2. **Si la tarea toca `backend-erp/src/`** (`.ts`, schema Prisma, DTOs, tests) → leer `BACKEND_GUIDE.md` **completo** antes de escribir o modificar cualquier archivo.
3. **Si la tarea es una nueva feature** → leer `ROADMAP.md` para verificar prioridades, fases y criterios de aceptación antes de proponer implementación.
4. **Si la tarea es un bug o fix** → leer `AUDIT.md` para verificar si el problema ya fue documentado, resuelto, o si hay un patrón de fix establecido.
5. **Nunca asumir conocimiento** de patrones que viven en estos archivos. Siempre leer primero.
6. **Después de leer**, seguir las **checklists** al final de cada guía antes de entregar el trabajo.

> ⚠️ **Incumplimiento:** Si un agente modifica código sin haber leído la guía correspondiente, está autorizado el usuario a rechazar el cambio y solicitar relectura.

---

## Índice de documentación canónica

| Archivo | Contenido | Ubicación |
|---------|-----------|-----------|
| **FRONTEND_GUIDE.md** | Patrones de diseño, OnPush, LUNA, action bars, selectores, tipado | `./FRONTEND_GUIDE.md` |
| **BACKEND_GUIDE.md** | Arquitectura, seguridad de tipos, deuda técnica, infraestructura | `./BACKEND_GUIDE.md` |
| **ROADMAP.md** | Roadmap de features por fases, deuda técnica, criterios de aceptación | `./ROADMAP.md` |
| **AUDIT.md** | Hallazgos de auditoría, tracking de acciones, métricas, bugs | `./AUDIT.md` |
| **README.md** | Onboarding, stack y comandos principales del monorepo | `./README.md` |

### Documentación por dominio

| Carpeta | Propósito | Archivos clave |
|---------|-----------|----------------|
| `docs/guides/` | Guías canónicas de dominio específico | `ESTANDAR_LINEAS_DOCUMENTO.md`, `ACCOUNTING_ENTRIES_GUIDE.md`, `guia-implementacion-configuracion.md` (orden de configuración/parametrización por perfil: contabilidad completa vs solo comercial/inventario; checklist + errores típicos), `reglas-medidas.md` (texto íntegro de las reglas de proceso que `AGENTS.md` comprime por tener gate; una ancla por regla) |
| `docs/plans/` | Planes de trabajo activos | `plan-consistencia-visual-v2.md`, `plan-mejoras-ux-ui-frontend.md`, `plan-g3-produccion.md` (plan del módulo de Producción: **aprobado el 2026-09-19**, con las **siete fases implementadas**) |
| `docs/reference/` | Análisis técnicos y referencias de arquitectura | `ACCOUNTS_DETERMINATION_FIX.md`, `SAP_B1_VS_ERP_COMPARATIVE_ANALYSIS.md`, `SAP_B1_INTEGRATION.md` (capa de integración bidireccional SAP B1: modelos, mapeos, idempotencia, migraciones), `PRODUCCION_ERP_COMPARATIVA.md` (cómo resuelven producción SAP B1 / Odoo 19 / Dynamics 365, verificado contra documentación pública) |
| `docs/archive/` | Informes históricos de migraciones completadas | Índice de frentes y cierres de fase |

---


---

## Convenciones transversales (lo que ningún incremento puede saltarse)

- **Backend:** `0` `as any`; DTOs estrictos. **Multi-tenant: ninguna query sin `tenantId`** (regla
  propia `local/no-raw-without-tenant` en `error`). Contrato de error con `code` estable
  (`VALIDATION_ERROR`, …) y `requestId` (`X-Request-Id`).
- **`branchId` obligatorio en todo documento, con la misma fuerza que `tenantId`** (2026-10-26): un
  documento sin sucursal existe y **nadie lo ve** (lo esconde cualquier listado filtrado). Un solo
  motor, `resolveDocumentBranchId` (cuerpo → sucursal del usuario → **400**), y `assertBranchRequired`
  delega en él. Gate `npm run audit:branch-required:check` (medido el 2026-10-27 en `backend-erp`:
  **0** controllers con la forma vieja y **48** `branchId: … ?? null` en servicios, **congelados por
  clase**: `parametro` **0** —pagada—, `cuerpo` **3** —serie global, asiento del tenant y borrador,
  **declarados con su razón**; el gate falla si aparece un `cuerpo` nuevo sin declarar—,
  `copiaOrigen` **43** y `otro` **2** —las **tres** clases declaradas con su razón: la de `otro` desde el 2026-10-27, con los dos sitios mirados (`journal-entries` hereda la del asiento, y la forma `(line['branchId'] as …)` esconde que es una copia; `withholding-reports` publica la columna prefiriendo la relación), y un `otro` nuevo sin declarar es ROJO—). Un `update` **no** puede reescribir la sucursal a `null`: se
  escribe solo si el payload la trae. Y un **usuario sin sucursal por defecto no puede crearla ni
  quedarse sin ella**: `PATCH /users` la rechaza. **El documento tiene que ser de la sucursal DEL
  USUARIO** (2026-10-27): el cuerpo solo manda si coincide con la del usuario —si pide otra, **403**—,
  y la **copia hereda la del origen** y valida la pertenencia; sin usuario con sucursal (SUPERADMIN,
  canal) no hay contra qué validar. **La regla vive en los dos lados**: el formulario la exige con
  `Validators.required` y la explica con `[required]`/`[error]`, y el interceptor **lee el mensaje del
  403** del backend en vez de sustituirlo por «no tienes permisos», que es lo que deja al usuario sin
  saber que le falta la asignación. Las tres excepciones —serie global, asiento del tenant y
  borrador— están declaradas y **no** se marcan.
  [Texto completo](BACKEND_GUIDE.md) · [El patrón de la pantalla](FRONTEND_GUIDE.md#17-la-sucursal-del-documento-branchid-también-en-el-formulario)
- **Frontend:** `0` `!important` sin marca y `0` `::ng-deep` sin marca (`!important-ok` / `::ng-deep-ok`);
  overrides por **especificidad**; un `h1` por página y nombre accesible en todo control (WCAG 2.5.3);
  alturas y densidades por variables, nunca `px` crudos en `pages/`+`shared/`.
- **Un solo motor por dominio** — precios (`price-resolver.util.ts`), contabilidad (`AccountingEngine`,
  punto único `_persist`), reparto por centros de costo, impuestos (`resolveLineTaxIndicator` +
  `calcLineWithIndicator`), el progreso del pedido (`computeSalesOrderProgress`,
  `backend-erp/src/common/progress.util.ts:61`) y **la sucursal del documento**
  (`resolveDocumentBranchId`). **Ninguna pantalla ni la tienda replican la regla: la consumen.** Gate:
  `npm run audit:single-engine:check` (medido el 2026-10-27 en `backend-erp`: **5** conceptos con su
  motor citado y **0** segundas fórmulas en TODO el repositorio el 2026-10-27: se pagaron **las 5**
  —la fórmula del disponible se extrajo a `computeStockAvailable` (un motor, cuatro llamadores:
  `assembly-orders`, `kit-expansion`, `items` y el propio `stock.util`) y el estado de facturación
  de la entrega a `resolveDeliveryInvoiceStatus`, con el cuarto valor `NA` que el pedido no tiene y
  **cinco casos que lo fijan**; los **2 del fallback de la sucursal** ya se habían pagado el mismo
  día al pasar por el motor—). [Texto completo](docs/guides/reglas-medidas.md#un-solo-motor)
- **Dinero al centavo** (`Decimal` / `Money` / `isZeroMoney`; `.toFixed()` solo para **serializar**) y
  **fechas con `tenantToday()`** en specs y seeds, nunca `toISOString()`.
- **Cantidad derivada que se publique y se lea en pantalla** (pendiente, saldo, progreso, total,
  disponible, facturado, entregado, recibido, consumido…): se entrega con su **invariante canónica
  citada (`fichero:línea`)** y **un caso que la compare**, y **se deriva de los documentos ACTIVOS**,
  nunca de una columna denormalizada (`openQty`, `receivedQty`, `invoicedQty`…): puede estar desviada y
  nadie la mira, pero **en cuanto alguien la lee, publica un número falso** (T265). Censo buscable:
  `npm run census:derived` (en `backend-erp`; medido el 2026-10-24: **229** nombres censados y **72**
  diana). Gate: `npm run audit:derived-invariants:check` —de las **73** diana, **50** están declaradas
  (**50** con cita que resuelve y **46** que comparan de verdad) y **23** siguen sin declarar, con la
  línea base en **23** y el gate rojo si sube; los lotes 1–11 cerraron fixed-assets (6), journal-entries
  (4), delivery-orders (4), common (9, con `totalPending` re-anclado), reports (9, con motor y **caso
  E2E** de fixture propia), landed-costs (2), exchange-rate-adjustments (2), dashboard (2),
  incoming-payments (1), special-prices (1) y pos-sessions (1)—. **La cita rota está en 0.** Los
  dos antídotos ya escritos valen aquí —medir que dos funciones del mismo
  concepto siguen de acuerdo (`backend-erp/src/common/timezone.predicates.spec.ts`) y **el mismo
  ALCANCE** para el instrumento que MIDE y el que ACTÚA—; la evidencia con importes de la familia
  (T259–T266), en `BACKEND_GUIDE.md` §2. [Texto completo](docs/guides/reglas-medidas.md#cantidad-derivada)
- **Cuentas con `requiresPartner`:** la línea de asiento exige `partnerId` y el `partnerCode`
  (ShortName) se denormaliza (Anexo B).
- **E2E:** los maestros se resuelven **por código, nunca por posición**.
- **`0`** `@ts-ignore` / **`--no-verify`**; `eslint-disable` **sólo con la regla nombrada** —y ese
  calificativo alcanza a las **12** escritas a mano **en `src/`**, **no** a las **207** de
  `src/generated/`, que son `/* eslint-disable */` en bloque, sin regla nombrada, y viven **fuera del
  lint**— y `--force` **sólo** en `prisma migrate reset --force` (ver *Reglas de proceso*).

El detalle **obligatorio** vive en los 5 archivos canónicos del protocolo de arriba y en los planes de
`docs/plans/`.

---

## Gates: qué se corre y cómo

Ningún gate se sustituye por inspección visual. Salida y comandos uno a uno, con sus reglas medidas:
**Anexo D** del histórico; los gates nacidos después del 2026-09-12, fechados en el registro.

Las cifras de los ratchets que siguen se **midieron el 2026-10-11** con el `--check` de cada gate, **en
`backend-erp`** (el repo anidado del backend). La procedencia se declara por **repositorio y fecha**,
no por un SHA suelto: un hash en un documento **caduca** y, sin el repo al lado, apunta a otro árbol
—el `71110f0` que decía aquí era un commit de la **raíz** y **no existe** en `backend-erp`—, así que el
SHA se cita **con su repo** y el gate comprueba que **resuelve** ahí (`git cat-file -t 8c6d2f92`
devuelve **1** línea; `8c6d2f92` era el HEAD de `backend-erp` cuando se midieron). Un ratchet **baja**
cuando alguien paga la deuda: la cifra que se lee aquí es la **vigente**, no la del día en que nació el
gate, y se actualiza al mismo tiempo que su `--update-baseline`.

### Backend (`cd backend-erp`)

```bash
npm run build                # nest build — 0 errores
npm run typecheck:all        # GATE: typecheck (src/ + test/) + typecheck:tools (scripts, prisma, perf) — 0 errores
npm run typecheck            # subconjunto del gate: solo src/ + test/ (`tsconfig.spec.json`); NO ve scripts/
npm run lint:ci              # eslint — 0 errores / 0 avisos (lint lleva --fix: NO en CI)
npm test                     # Jest unitario
npm run test:e2e             # Jest E2E (sincroniza erp_test antes)
npm run db:recreate          # BD dev reproducible (reset + db push + SQL + seed)
npm run audit:line-accounts  # la cuenta capturada se valida y el builder la prefiere
npm run audit:tracking       # lote/serie coherentes (necesita BD)
npm run audit:reconcile      # cuadre general (necesita BD) (+ :self-test)
npm run audit:invariants:coverage # toda invariante que publica `measure()` tiene al menos un caso en el `--self-test` (A/B; medido el 2026-10-19 en `backend-erp`)
npm run audit:money:check    # dinero al centavo (ratchet en 0)
npm run audit:non-null:check # aserciones no nulas (`!`): ratchet **congelado en 1112** (2026-10-27: el censo de las 1146 se partió y **solo 31 eran de RIESGO** —aserciones sobre el resultado de `find`/`get`/`pop`/`shift` o sobre una cadena `?.`, las únicas que pueden lanzar en producción—; el resto son declaraciones `x!: T` de DTO y aserciones **después de una guarda**. **las 31 se pagaron el 2026-10-27** (8 en el lote 1 y 26 en el lote 2): el censo de RIESGO está en **CERO** y esas aserciones ya no pueden lanzar —descartan con criterio o responden 400 diciendo qué falta—) (medido el 2026-10-22 en `backend-erp`; T303 quitó 340 del camino de dinero y stock: 43 en el lote 1, 104 en el lote 2 —cobros 53 y pagos 51—, 85 en el lote 3 —sale-invoices 47 y sale-reserve-invoices 38— y 108 en el lote 4 —purchase-receipts 37, purchase-invoices 32, purchase-credit-notes 20 y delivery-orders 19—; y T307 pagó los **11** de RIESGO que quedaban: 7 de fecha —`exchange-rates`, `reports` ×2, `stock-revaluations` ×2, `purchase-requests` y `timezone.util`—, `sales-orders` ×1 y `prisma/seed` ×3)
npm run audit:explicit-any:check # `any` explícitos: ratchet en 1 (producción 0, specs 1)
npm run audit:spec-clock:check   # reloj del proceso en specs: 0 hallazgos (2 excepciones declaradas)
npm run audit:collection-caps:check # consultas sin cota (`produccionSinCota`): ratchet en 0 (medido el 2026-10-27 en `backend-erp`; **el ratchet llegó a CERO** el 2026-10-27 (de **654** a **0**: 182 acotados con `take`/`skip`/`cursor` —**4** de ellos arreglos reales— y **684** declarados con su razón en el código), y en el cierre se **partió la clase `lote`** en `escribe` (158: el bucle escribe; su deuda es de `census:bulk`) y `serializa` (207: el `.map` arma la respuesta), porque la escritura está en el **cuerpo** del bucle y no se veía desde la variable; el lote 4 declaró los **66** `visible` acotados por la regla —líneas de un documento, `in:` del llamador o maestro del selector— y **arregló la cota CONDICIONAL** de `delivery-orders`, cuya rama de filtro en memoria traía la tabla entera y ahora lleva el tope de la casa con el `take` como propiedad literal; el lote 3 declaró los **107** `agregado` —el `where` los acota: las líneas de UN documento, el `in:` del llamador o el maestro del selector; **su cota no es el problema, y sumar en la base es del censo `census:inmemory`**, que tiene su propio ratchet—, así que `agregado` = 0 y solo quedan `visible` (64) y `lote` (365); bajó de 671 a 659 con los 12 agregados, a 654 con los 5 del segundo lote, a **625** al declarar los **29** del reparto `lookup/predicado` —acotados por la regla, no candidatos a `findFirst`—, a **618** al desvelar que el detector era **ciego a la forma corta** `{ where, take }` (`take` como `ShorthandPropertyAssignment`: 6 sitios de `search.service` ya estaban acotados) y a **536** al cerrar los **82 `indeterminado`**, que ya son 0: 80 declarados con la razón extraída de su propio `where` y **2 arreglos reales** —el `take` de `items.findAll` pasa a ser incondicional (`UNPAGINATED_LIST_CAP`) y `master-accounts` deja de necesitar el paréntesis para su cota—) · y el **detector de SQL crudo** (`$queryRaw`/`$queryRawUnsafe` de lectura sin `LIMIT`) cuenta aparte y se congela en su línea base
npm run census:inmemory:check # agregados que se SUMAN EN MEMORIA (`findMany`/`findFirst` cuyas filas se reducen en JS): el censo parte los sitios en MOVIBLES (el resultado sería idéntico con `count`/`aggregate`/`groupBy`) y NO movibles (regla de negocio encima); ratchet en 70 movibles de 99 sitios (medido el 2026-10-25 en `backend-erp`; el lote 1 dejó 75 de 104 y el lote 2 pagó los 5 «solo para el número», así que quedan **0** de esos). **Los «113 agregados» de la campaña NO eran 113 agregados**: medido con este censo, 80 son GUARDAS `.length` (`if (filas.length)`), 2 no tienen binding atribuible, 2 usan las filas como filas y solo 29 son una suma real (`AUDIT.md` T318)
npm run census:bulk:check # ESCRITURAS POR FILA («BULK»): `create`/`update`/`upsert`/`delete` dentro de un bucle (`for`/`for…of`/`forEach`/`map`/`while`) y `$transaction` por fila; el censo parte los sitios en MOVIBLES (mismo resultado con `createMany`/`updateMany`/`deleteMany` o una sola `$transaction`) y NO movibles (condición/guarda por fila, dependencia de la escritura anterior, lectura previa, acumulador, `upsert` o el `id` de la fila escrita consumido —razón nueva `id-de-la-fila`, el falso positivo medido: **27 de los 67 «movibles»** lo eran); ratchet en 10 movibles de 274 sitios en 181 bucles (medido el 2026-10-25 en `backend-erp` tras el lote 2: el lote 1 dejó 292/23 —19 sitios migrados a lote, 17 movibles y 2 que el censo ya contaba como no movibles, la rama `else` del mismo bucle— y 27 reclasificados por la regla del `id`; el lote 2 migró **13 movibles**, y con ellos salieron **5** sitios más de las ramas `else` del kardex, así que el universo bajó 18: 292 → 274 y 23 → 10; quedan los **10 `update` con `data` distinto por fila**, que ningún `updateMany` reproduce; 23 ya en lote y 148 indirectas —ayudante que escribe— declaradas aparte). **La trampa 4 (una LECTURA por fila que el censo no ve) se midió en el lote 2**: `stock-revaluations:590` se MIGRÓ —el `unitCost`/`reason` salen de un `lockStockRow` por fila y la lectura se queda DENTRO del bucle; lo que se difiere es el INSERT—, así que no hubo segundo falso positivo y lo que se corrigió fue la conclusión del ejemplo en la cabecera del censo. **El «377 BULK» de la campaña NO era este conjunto**: es la clase BULK de `audit-collection-caps` (LECTURA sin cota que se itera), que hoy mide 366 y cuyos `.map` a DTO no escriben una fila; el censo la RECALCULA con su detector y no compara por línea (la lectura y la escritura son líneas distintas)
npm run audit:security-headers # postura de cabeceras en el código (gate estático de DECLARACIÓN): x-powered-by desactivado una sola vez en el arranque, nada la vuelve a encender y 0 hallazgos (medido el 2026-10-12 en `backend-erp`; los sitios que ponen cabeceras DERIVAN con cada endpoint legítimo y NO se congelan — prueba que el código lo dice, NO que la cabecera haya desaparecido)
npm run audit:derived-invariants:check # la cantidad derivada publicada y leída en pantalla cita su invariante (`fichero:línea`) en su declaración y tiene un caso que la asevera; la diana (**73**) sale del MISMO censo que `census:derived`, la deuda está en **23** y el gate falla si sube (medido el 2026-10-28 en `backend-erp`: lotes 1–11 pagados —fixed-assets 6, journal-entries 4, delivery-orders 4, common 9, reports 9 con E2E, landed-costs 2, exchange-rate-adjustments 2, dashboard 2, incoming-payments 1, special-prices 1 y pos-sessions 1—; **cita rota 0**)
npm run audit:detectors:check # el ALCANCE de cada detector: ejecuta el `--self-test` de los 20 `audit-*.mjs`, exige un caso declarado de cada patrón que aplique (multilínea T126 / nombre distinto / sufijo) y lista los 2 sin `--self-test`; 12 sin caso difícil, deuda congelada (medido el 2026-10-25 en `backend-erp`; eran 19/17/5 el 2026-10-24 y el gate del exit code añadió el detector 20)
npm run audit:citations:reanchor # REPARADOR de las citas por `fichero:línea` de `single-engine` y
                             # `derived-invariants`: re-resuelve la línea por la `evidencia` ya declarada
                             # (informe; `--apply` reescribe registros y citas en línea; `--self-test` 4/4)
npm run audit:single-engine:check # un solo motor por dominio: 5 conceptos con su motor citado (`fichero:línea` + evidencia) y la segunda fórmula prohibida en los ficheros ajenos; 0 segundas fórmulas en TODO el repositorio (T316 y las 5 de la entrega/stock, pagadas el 2026-10-27), congelado (medido el 2026-10-27 en `backend-erp`; los 2 del fallback de la sucursal se pagaron ese día)
npm run perf:k6              # k6 perfil small (el large, programado)
```

> **Pre-push del backend:** `npm test` + `npm run typecheck:all` + `npm run lint:ci`. Los dos últimos
> llevan el **heap dentro del script** porque sin él mueren por OOM. Nada se empuja sin los tres verdes.

### Frontend (`cd erp-frontend`)

```bash
npm run build                # ng build (AOT) — 0 errores
npm run lint                 # ng lint — 0 errores, 0 warnings
npm test                     # Karma + Jasmine (ChromeHeadless)
npm run typecheck:e2e        # tsc del suite E2E
npm run e2e:functional       # gate funcional de escritorio
npm run e2e:mobile           # gate móvil/tablet (lista curada)
npm run e2e:visual           # regresión visual (baselines propios)
npm run e2e:baseline         # regenera baselines (con atribución medida)
npm run e2e:ssr              # smoke del build SSR
npm run audit:ci             # las auditorías del frontend (pre-push)
npm run format:check:touched # prettier: solo lo tocado vs origin/main
npm run migrate:heights:check# 0 px crudos en pages/+shared/ (medido el 2026-10-11; el censo de archivos/líneas deriva y no se congela: se vigila el 0)
```

Auditorías individuales del `audit:ci`: `audit:density:ci`, `audit:important`, `audit:ng-deep`,
`audit:pos-scope`, `audit:tokens`, `audit:e2e-conditional`, `audit:list-actions`,
`audit:line-accounts`, `audit:select-options`, `audit:ui-fields`, `a11y:check`, `format:check`.

> **Pre-push del frontend:** `audit:ci` **antes** de Karma + build de producción, para que una regla
> nueva no bloquee todos los pushes durante ~10 min. Lección escrita: **una regla sin gate es un deseo.**

### Tienda (`cd storefront`)

```bash
npm run typecheck            # tsc --noEmit — 0 errores
npm run lint                 # next lint --max-warnings=0 — 0/0
npm run build                # next build — 0 errores (OBLIGATORIO antes del E2E)
npm run sync:tokens:check    # tokens de la tienda = los del ERP
npm run sync:fonts:check     # fuentes = las del ERP
npm run e2e                  # Playwright (sirve el build, :3100)
npm run e2e:visual           # gate visual (fixture del canal)
npm run e2e:a11y             # axe-core, claro y oscuro
npm run e2e:perf             # presupuesto LCP/CLS y peso (ratchet)
npm run audit:contrast       # contraste WCAG de la paleta
```

### Reglas de entorno medidas (E2E): no diagnosticar producto desde ellas

1. **Nunca dos suites E2E completas del backend a la vez**: comparten `erp_test`, que `test:e2e`
   reescribe (medido: 18 fallos en suites que en aislamiento pasan).
2. **El login del ERP admite 5 intentos/min por IP** y cada corrida de Playwright hace **2**: varias
   corridas seguidas fallan con «Límite de solicitudes excedido» y el síntoma engañoso «la tarjeta de
   empresa no aparece». Esperar ~1 min entre corridas.
3. **Tienda:** el dev server (:3000) y el E2E/build comparten `.next`; con el dev server levantado, el
   E2E lo pisa y la tienda responde **500**. Parar :3000 antes.
4. **Los E2E del ERP y de la tienda no comparten estado**: los dos arneses vuelcan y restauran `erp_db`
   con huella de contenido, así que una corrida a mitad de la otra mueve los datos (medido: el visual
   del ERP falló con `partners 23→17`).
5. **Playwright sin esperas sin tope:** `actionTimeout: 30000` y `{ timeout }` en los helpers que
   actúan sobre un popup que la app puede cerrar. Un `click()` sin tope reintenta para siempre: la
   prueba muere por su tope, **sin traza** y con la página viva.
6. **Un caso E2E debe crear lo que mide.** El 2026-10-08, **tres** casos del job `e2e` pasaban por el
   **estado acumulado de la máquina de desarrollo** y caían en un entorno limpio: el login de
   super-admin (credenciales solo en el `.env` **no versionado** ⇒ 401 y **264** `did not run`;
   `39fbba2c`), la Nota de Crédito (el «hoy» del tenant salía del reloj de la máquina —La Paz— y no del
   caso: con el runner en **UTC** los **5** casos se rechazan como futuros; `9eabacab` + la regla **7**)
   y el selector de medios (`erp_db` con **23** filas de `MediaAsset` que dejó
   `backend-erp/scripts/generate-store-cards.ts`, mientras el seed crea **0** ⇒ `picker-grid`
   «element(s) not found»; `1724af21` con `e2e/helpers/ensure-media-library.ts`). Los **4** casos
   resultantes pasan en el entorno limpio **sin relajar una aserción**.
7. **La zona horaria del PROCESO se declara a propósito.** `TZ: America/La_Paz` va **solo** donde la
   zona entra en el render —`visual-regression` (`ci.yml:458`) y `ssr-smoke` (`ci.yml:596`)— y en el job
   `baseline` de `update-baselines.yml`; el job `e2e` se queda en **UTC a propósito**: es el único
   entorno donde el defecto de la doble conversión de zona se manifiesta, y alinearlo lo taparía
   (`4a7e5b5e`). El defecto y su medición van escritos al lado, en el `env` de los tres jobs, para que
   nadie lo «arregle» dentro de un mes.
8. **El `node` del `PATH` no es el Node que ejecuta un `npm run`, y ninguno de los dos es el que fija el
   repo.** Medido el **2026-10-12**: el `node` del `PATH` es **v24.14.0** (`C:\Program Files\nodejs`)
   mientras `backend-erp/.nvmrc` y `erp-frontend/.nvmrc` fijan **24.21.0** y los dos CI anidados lo leen
   con `node-version-file: '.nvmrc'` (la raíz —la tienda, que **no** tiene `.nvmrc` a propósito porque
   Vercel elegiría otro Node— lo fija con `node-version: '24'` en su `setup-node`). Rompió **cuatro**
   puertas: dos `pre-push` del frontend, uno del backend y el arranque de los E2E, donde `ng serve` sale
   con **exit 3** y el literal «Node.js version v24.14.0 detected.» + «The Angular CLI requires a minimum
   Node.js version of v22.22.3 or v24.15.0 or v26.0.0.».
   **Lo que hay que medir es la versión que ve el SCRIPT, no la del `PATH`.** Comprobación verificada, la
   más simple: un script del `package.json` que imprima su propia versión
   (`"pv": "node -p \"process.version\""`) y `npm run pv` ⇒ **v24.14.0** con el `PATH` tal cual. Sirve
   también `npm run env`, que publica además la versión que ve **npm** (`npm_node_execpath` y
   `npm_config_user_agent`); **`npm exec -- node -p "process.version"` NO sirve de sonda** (medido:
   resuelve el paquete `node` del registro y devuelve **v26.11.1**, no el `node` del `PATH`).
   **Y la sutileza medida**: anteponer el Node del repo al `PATH` hace que el SCRIPT vea **v24.21.0**
   —medido— pero **el proceso `npm` sigue corriendo bajo v24.14.0**, porque el `npm.ps1`/`npm.cmd` de
   `C:\Program Files\nodejs` llama al **`node.exe` hermano** del propio shim: con el `PATH` preparado,
   `npm run env` publica `npm_node_execpath=C:\Program Files\nodejs\node.exe` y
   `npm_config_user_agent=… node/v24.14.0`. **Mitigación medida, en dos piezas**: (a) anteponer el Node
   del repo al `PATH` (`C:\Users\jdiaz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin`),
   que arregla el script; y (b) cuando haga falta que **npm** también sea el fijado, invocar el CLI **con
   ese Node**: `& "<node>\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run
   <script>` ⇒ **el proceso `npm`** pasa a ser el Node del repo (`npm_node_execpath`, con el `user_agent`
   en `node/v24.21.0`, medido). **Las dos piezas NO son alternativas, y la que arregla el SCRIPT es la
   (a)**: medido el **2026-10-15**, un `ng lint` lanzado **solo con (b)** —el CLI bajo el Node del repo,
   sin tocar el `PATH`— sale con **exit 3 en 0 segundos** (literal de Angular: «The Angular CLI requires a
   minimum Node.js version…»), porque `npm` resuelve el script al shim `node_modules/.bin/ng.cmd` y **ese
   shim llama al `node` del `PATH`**, no al que arrancó `npm`. Con `tsc` la diferencia **no se ve** (no
   exige ≥ v24.15.0), y **ese es el caso que enmascara el error**: la fila del typecheck pasa igual con
   solo (b). Regla: **si el script es un binario de `.bin` (`ng`, `karma`, `next`), hacen falta LAS DOS**
   —(a) para el hijo, (b) para `npm`—; medir la versión que ve **el script**, no la del `PATH`.
   **Ningún gate vigila esto** y por eso se escribe: la trampa es que `node -v` responde lo correcto
   mientras la puerta falla por la vía de npm.

9. **La `E2E_DATABASE_URL` que se deriva del `.env` conserva las COMILLAS, y Prisma lo denuncia acusando al
   esquema (medido el 2026-10-15).** El `.env` trae el valor entrecomillado (`DATABASE_URL="postgresql://…"`),
   así que una derivación naive —`-replace '^DATABASE_URL=', ''` sobre la línea— **deja la comilla de
   apertura dentro de la URL** y `node scripts/prepare-test-db.mjs` muere con **`P1013: The provided database
   string is invalid. The scheme is not recognized in database URL`**: el mensaje **acusa al esquema**, que
   está perfecto, y manda a revisar la parte que no falla. La resta que lo delata: la URL sin comillas mide
   **67** caracteres y la derivada midió **69**. Regla: derivarla con el patrón **anclado**
   (`^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?`, el que ya usan las sondas de este repo) y **comprobar el valor
   con dos aserciones que ABORTEN** —esquema `postgres*` y base `erp_test`—, porque «derivé algo» no es una
   comprobación. Y **cuidado con la herramienta**: `Select-String` devuelve `MatchInfo`, cuya representación
   en texto lleva **la ruta y el número de línea delante**, así que un `-replace` sobre él **no casa con el
   principio de la línea**; `Get-Content` sí devuelve strings. **Y la lección hermana, del mismo día**: cuando
   la causa no aparece, **quite el filtro** — un `Where-Object` que no casa con el mensaje real **esconde la
   causa** y deja acusar a la hipótesis equivocada (pasó en esta misma medición: el error de Prisma no casaba
   con ninguno de los patrones pedidos y estuve a punto de declarar que el problema era el nombre de la base).

10. **`Invoke-WebRequest` de PS 5.1 NO entrega el cuerpo de una respuesta de error: un «cuerpo vacío» leído por
   esa vía es un artefacto del INSTRUMENTO, no del servidor (medido el 2026-10-16).** Sondeando el API
   desplegado, `Invoke-WebRequest` + `$_.Exception.Response.GetResponseStream()` devolvió **cuerpo vacío** en un
   **400** y en varios **404**, y estuvo a punto de entrar al ledger como **defecto de producto** («el contrato
   de error no devuelve `code` ni `requestId`», que el manual exige). **La respuesta real, leída con
   `curl.exe -i`, traía `Content-Length: 640`** y su cuerpo entero:
   `{"code":"VALIDATION_ERROR","requestId":"c365a058-…","path":"/auth/login",…}`, con el `requestId`
   **idéntico** a la cabecera `x-request-id`. Regla: **para leer el cuerpo de una respuesta de error, use
   `curl.exe`** (o cualquier cliente que no pase por el manejo de errores del framework). **Y la lección
   hermana, que es la de toda esta lista**: cuando quedan **dos explicaciones incompatibles vivas** —«el
   servidor no manda cuerpo» frente a «mi sonda no lo sabe leer»—, **NO SE CONCLUYE: se cambia de instrumento**.
   Lo que evitó el falso hallazgo no fue saberlo, fue **negarse a concluir con un instrumento que podía estar
   ciego** — y ese mismo patrón explica las otras cuatro trampas medidas el mismo día: `audit:flows` R10b
   **callaba** (le faltaba un campo en el `select`), `ng lint` **moría en 0 segundos** (el shim cogía otro
   `node`), un `Where-Object` **no casaba con el mensaje real** y escondía la causa, y `P1013` **acusaba al
   esquema** cuando sobraba una comilla en la URL del `.env`. **Las cinco señalaban al sitio equivocado; las
   cinco se resolvieron igual: quitar el filtro, mirar el valor crudo y medir el conjunto que de verdad se
   toca.**

11. **El `pre-push` NO existe en un worktree recién creado: el gate no corre, el push sale con `exit 0`
   y con CERO salida de gates, y no deja rastro en ningún sitio (medido el 2026-10-16).** Reproducción
   medida, no hipótesis:
   ```powershell
   git -C D:\ProyectosPython\erp_suite\backend-erp worktree add --detach $env:TEMP\wt-hook-probe main
   git -C $env:TEMP\wt-hook-probe config --get core.hooksPath    # -> .husky/_
   Test-Path -LiteralPath "$env:TEMP\wt-hook-probe\.husky\_"     # -> False
   Get-ChildItem "$env:TEMP\wt-hook-probe\.husky" -Force         # -> solo pre-commit y pre-push (los VERSIONADOS)
   # y un PUSH REAL contra un remoto desechable:
   git init --bare $env:TEMP\probe-remote.git
   git -C $env:TEMP\wt-hook-probe remote add probe $env:TEMP\probe-remote.git
   # ...añadir un fichero, commit y:
   git -C $env:TEMP\wt-hook-probe push probe HEAD:refs/heads/probe   # -> PUSH_EXIT=0 y CERO salida de gates
   ```
   **Causa**: `core.hooksPath = .husky/_`, y **ese directorio lo GENERA husky en el `install`**; **git lo
   ignora** ⇒ **no viaja en el checkout de un worktree nuevo**. Medido además: **el commit salió sin
   `lint-staged` y el push sin `typecheck:all`, sin la suite y sin `audit:pg-tools:self-test`** (ni una
   línea). **SEGUNDA INSTANCIA medida**: el worktree de otro agente (`%TEMP%\inc2\main-tree`, en `main`)
   **tampoco** lo tiene.
   **Por qué importa**: **es peor que un `--no-verify`** — aquél deja rastro en la línea de comandos y
   **esto no deja rastro en ningún sitio** ⇒ **un push desde un worktree sin hook no es «un push sin
   verificar»: es un push que PARECE verificado.** Caso concreto que casi ocurrió: **el gate que
   bloqueaba a otro agente (`audit:collection-caps`, base 683) era justo el que no habría corrido.**
   **Arreglo, por worktree**: `npm run prepare` **dentro del worktree** (crea `.husky/_` con los shims)
   — es lo que hizo que un push pasara el hook **entero**. **Y la comprobación OBLIGATORIA antes de
   empujar**: `Test-Path -LiteralPath '<worktree>\.husky\_\pre-push'` **tiene que decir `True`**.
   **Regla: no basta con no usar `--no-verify`; hay que comprobar que el hook EXISTE.**

12. **El build de la tienda hace fallar `ci:local` de forma INTERMITENTE por contención de `.next`: es un
   rojo FALSO, no un defecto del producto (medido el 2026-10-16, en la misma máquina y con el mismo
   commit).** `ci:local` (**7** pasos) **falló en el paso 5** con
   `Error: ENOENT: no such file or directory, rename 'D:\ProyectosPython\erp_suite\storefront\.next\export\500.html' -> ...`
   y **`RESUMEN: 5 pasos en verde en 3m19s`**; **a los dos minutos, el MISMO gate dio
   `RESUMEN: 7 pasos en verde en 1m52s`** ⇒ **es un rojo FALSO por contención de `.next`**, **no un
   defecto del producto**: **la regla 3 de esta misma lista ya lo dice** («el dev server (:3000) y el
   E2E/build comparten `.next`»). ⇒ **antes de atribuir ese rojo al cambio que estás empujando, comprueba
   quién más está usando `.next` (un `next build`, un `next start`, un E2E de la tienda, otro agente) y
   repítelo en aislamiento.**

13. **`npm run e2e:visual` SIEMBRA `erp_db`, la base del usuario, porque el `webServer` de
   `erp-frontend/playwright.config.ts` corre `prisma db seed` contra `backend-erp/.env` (medido el
   2026-10-17).** El `webServer` del backend declara, literal:
   `command: \`cd "${BACKEND_DIR}" && npx prisma db seed && 'npm run start'\``, con
   `BACKEND_DIR` = `../backend-erp` por defecto. Ese `prisma db seed` **no recibe un `DATABASE_URL`
   de test**: lo resuelve el `.env` de `backend-erp`, que apunta a **`erp_db`**. Reproducción literal
   (sin ejecutarla en este incremento):
   ```powershell
   cd D:\ProyectosPython\erp_suite\erp-frontend
   npm run e2e:visual
   # webServer[0]: cd "../backend-erp" && npx prisma db seed && 'npm run start'
   # backend-erp/.env: DATABASE_URL="postgresql://…@localhost:5432/erp_db"
   # ⇒ el seed escribe en erp_db (la base del usuario), no en erp_test
   ```
   **Por qué importa.** `erp_db` es la base de desarrollo del usuario y este manual prohíbe el
   seed/reset destructivo contra ella sin su decisión explícita; además, el arnés visual no es un
   gate de producto que deba tocar datos reales. **Arreglo IMPLEMENTADO el 2026-10-18** (el diagnóstico de arriba se conserva íntegro; esta
   regla decía «NO implementado aquí»): el `webServer` del backend **ya no siembra contra el
   `.env`**. `playwright.config.ts` deriva la URL en `e2e/harness/test-database-url.cjs` con el
   patrón **anclado** (`^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?`), **quita las comillas**, cambia la
   base a `erp_test` y la pasa al `env` del `webServer` (nunca al `.env`), junto con
   `E2E_DATABASE_URL` para que `test:e2e:prepare` —el camino que ya usa `npm run test:e2e` del
   backend— sincronice el esquema; el `command` encadena `test:e2e:prepare && prisma db seed &&
   npm run start`. **Dos aserciones abortan** (esquema `postgres*` y base **exactamente**
   `erp_test`) y una **guarda** aborta si la URL resuelta es `erp_db`: el arnés **no arranca**.
   Además el `webServer` **no reutiliza** un backend levantado (`reuseExistingServer: false`),
   porque un `npm run start` de desarrollo habla con `erp_db` y la suite escribiría ahí; y las
   bases de CI y de `update-baselines.yml` se llaman `erp_test`, para que la guarda sea la misma
   en local y en el runner. **Medido**: `E2E_DATABASE_URL=…/erp_db` ⇒ `playwright test --list`
   aborta con `ABORTA: la base resuelta para el arnés es "erp_db"…` y exit 1 **sin arrancar el
   seed**; la derivación de `backend-erp/.env` da `…/erp_test` (65 caracteres limpios frente a
   los 67 con comillas, la resta de la regla 9) y el `webServer` imprime la base con la que
   trabaja. La huella de `erp_db` —conteos de `Tenant`, `Partner`, `Item`, `SaleInvoice`,
   `PurchaseInvoice`, `Stock`, `StockMovement`, `Batch` y `SerialNumber`, más su `updatedAt`
   máximo— quedó **idéntica** antes y después de `e2e:visual` y de regenerar el baseline
   `-win32`. Autoprueba de la derivación y de la guarda:
   `node e2e/harness/test-database-url.cjs --self-test`. **Lo que el cambio destapó** (medido y
   atribuido en el `CHANGELOG.md` del frontend): el `auth.setup` daba por hecho `branchId = 1` y
   en `erp_test` la sucursal del seed es `SUC-01` con otro id ⇒ se resuelve **por código**; y
   `/discount-groups/groups` devuelve **una fila por (grupo, descuento)**; el seed duplicaba
   los descuentos en cada pasada, así que la huella contaba los `groupId` **distintos**. **Eso
   quedó arreglado el 2026-10-18**: el seed hacía `upsert({ where: { id: 1 } })` —el id es un
   autoincremento global que en una BD ya sembrada vale otro— y creaba **+2 filas por pasada**
   (medido: `ItemGroupDiscount` 18 → 20 → 22; de las **199** tablas, la única que cambiaba).
   Ahora usa la clave de negocio `(tenantId, groupId, partnerId, partnerGroupId, partnerType)`
   —la misma que `DiscountGroupsService.bulkUpsert`—, conserva la primera fila y borra solo los
   duplicados de esa clave (`ensureSeedItemGroupDiscount` en `backend-erp/prisma/seed.ts`). La
   BD converge (22 → 2 en la primera pasada con el arreglo) y la segunda pasada deja las **199**
   tablas idénticas, así que la huella del seed ya cuenta **filas** (`discount-groups` = 9:
   una por grupo, con su descuento; antes las filas duplicadas la hacían derivar) en vez de
   `groupId` distintos.
   La regla 1 (dos suites E2E completas comparten `erp_test`) no cubre este caso: aquí la base
   que se tocaba no era `erp_test`, era `erp_db`.**

---

## Reglas de proceso (obligatorias)

### Trabajo y commits

- **Nunca `--no-verify`** (ni `--force`, `@ts-ignore`, `eslint-disable`, `xit`): **el hook se arregla, no se salta**; `--no-verify` y `--force` son **comandos** y **no se gatean** (esa mitad es prosa). Gate del resto: `npm run audit:suppressions:check` —0 `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, 0 `eslint-disable` sin regla, 0 `xit`, y **12** directivas con regla en `src/` (8 `local/no-raw-without-tenant` + 4 `@typescript-eslint/no-require-imports`) más las de `scripts/`/`perf/`, congeladas con su mapa—. [Texto completo](docs/guides/reglas-medidas.md#nunca-no-verify).
- **Cero `!` nuevos** (gate: `npm run audit:non-null:check` en las **tres** puertas —CI, `pre-push` y `ci-local.mjs`—; cifra **congelada en 1112**: `expresión!` 459 + `x!: T` 653; 759 en producción, 353 en specs): la deuda está **CONGELADA en su suelo MEDIDO** (los **11** de riesgo de T307 se pagaron el 2026-10-22) y el ratchet falla si sube. [Texto completo](docs/guides/reglas-medidas.md#cero-no-nulos).
- **Nunca reescribir un commit ya empujado**: sin `push --force`/`--force-with-lease` sobre ramas
  compartidas y sin `amend`/`rebase` de historia publicada. Si algo salió mal, se **añade** un commit
  que lo corrige y, si aplica, se despliega la reversión.
- **Antes de commitear, comprobar la rama** (`git rev-parse --abbrev-ref HEAD`); los cambios no
  triviales van en una rama. Solo **dos** repos están anidados (`backend-erp`, `erp-frontend`) y cada uno tiene su Husky:**un
  commit por repo tocado**. `storefront/` **vive en el repo raíz** (no tiene `.git` propio: sus 218
  ficheros los trackea la raíz, y con ellos su CHANGELOG y su CI).
- **El costo está en el `pre-push`** (suite completa, **una vez por cada `pushurl`**). Un commit nuevo
  o un `amend` lo invalidan; si el sello por contenido (`.git/pre-push-verified`) no puede calcular la
  clave, la suite **corre igual** —degrada al comportamiento de siempre, nunca salta la verificación
  por accidente.
- **No hacer *round-trip* de código por PowerShell** (`Get-Content -Raw` + `Set-Content` mojibakea los
  acentos en PS 5.1): usar las herramientas del agente o Node, y comprobar con `git diff --numstat` que
  solo aparezcan las inserciones esperadas.
- **Un commit por sitio al arreglar una familia de bugs.** Si uno sale mal, se revierte **uno** sin
  deshacer los demás. El barrido de la doble conversión de zona (los **7** sitios que declaró
  `e33b0b4c`) va así aunque cuatro vivan en el mismo fichero: `76688c98` (los cuatro avisos de
  vencimiento) y `95fa7edf` (los tramos del aging) son **dos commits, no uno**.

### Despliegue

- **Empujar `main` despliega:** `erp-frontend` y `storefront` en **Vercel**, `backend-erp` en
  **Railway**. A `main` de producción solo con el **hook completo en verde** y con el **visto bueno
  del usuario** cuando el cambio es de producto.
- **Backend, dos remotos:** `git push origin main` y `git push deploy main` (`origin` =
  `josecarlos3390/backend-erp`; `deploy` → `josekilla3390/backend-erp`). El frontend y la raíz tienen
  uno solo. **Los dos espejos se empujan y se verifican siempre** (ver *Disciplina de medición y
  declaración*): el sello cubre la **verificación**, no el envío. El 2026-10-07 `deploy` se quedó
  **2 commits atrás** (`origin` en `0417acd`) porque su hook falló y el resultado global no lo dijo.
- **Verificar el despliegue por medición, nunca por suposición:** `/health` **200** con `prisma: up`,
  contrato de error vivo (`code` + `requestId`), **OpenAPI igual** al del build local del mismo
  commit (medido así, no contra un fichero: ver la viñeta siguiente), **huella del bundle** servido
  igual a la del build local del mismo commit y **sonda de navegador** con **0 errores de consola**
  que acabe en `/login`. Un `/health/live` que responde **404 y luego 200** es la prueba del
  **relevo del contenedor**.
- **`/` → `/login` es del ROUTER DE ANGULAR, y por HTTP no se puede ver (medido el 2026-10-12).** Gate: `e2e/auth-guard.spec.ts` (raíz sin sesión ⇒ `page.url()` acaba en `/login`, y `/` y `/login` sirven el mismo `sha256`); la app tiene que llevar al login y el `curl` a `/` devuelve **200** a propósito. [Texto completo](docs/guides/reglas-medidas.md#raiz-a-login).
- **El OpenAPI no se compara contra un FICHERO: se compara contra el build local del MISMO commit
  (medido el 2026-10-12).** El manual pedía «OpenAPI idéntico a la línea base» y **esa línea base no
  existe**: `*openapi*`/`*swagger*` fuera de `node_modules`/`.git`/`dist`/`.next` ⇒ **vacío** (medido).
  El criterio era **inejecutable**. Se elige **comparar contra el build local del mismo commit**, y
  **no** congelar un fichero, por una razón **medida**: los **404** `schemas` del despliegue traen los
  **114** DTO de línea anidados que el servidor publica como *huérfanos* (no los referencia ningún
  `path`), así que esa cifra **deriva con cada DTO de línea que se añada** — igual que el censo de
  `heights`, **se vigila lo que no deriva**; `paths` (**647**) es estable hoy, pero deriva con cada
  endpoint nuevo y la comparación ya lo cubre, así que **tampoco se congela**. El procedimiento, tal
  como se midió:
  1. `curl -s <api>/api-json > /tmp/desplegado.json` (medido: **200**, **963 744** B).
  2. **Build local del mismo commit** (`npm run build` en `backend-erp`; el commit, declarado — el
     desplegado era `f32248be`, que es el `HEAD` de `backend-erp` y el de **sus dos** espejos) y
     arrancarlo; `curl -s http://localhost:3000/api-json > /tmp/local.json`.
  3. Comparar los dos **canónicamente** (un Node en `%TEMP%` que ordena las claves y los **`enum`** y
     hashea), no byte a byte.
  Medido así: **647** `paths`, **871** operaciones y **404** `schemas` en los **dos**, sha256
  **canónico** `DCFAF74FAC9D…` **idéntico**. Tres trampas, las tres **medidas**, y las tres dan un
  rojo **falso**:
  - **El build local tiene que ser `npm run build` (`nest build`), NO `tsc` a secas.** El repo usa el
    **plugin del CLI de Swagger** (`backend-erp/nest-cli.json`, `"plugins": [{"name": "@nestjs/swagger"}]`),
    y es el plugin —no los decoradores— el que rellena `properties` y `required` de los DTO. Medido:
    `tsc` a secas ⇒ **290** `schemas` y los DTO anidados con **`properties: {}`** (vacío), frente a
    **404**; un `dist/` **viejo de un día** ⇒ **402** (le faltaban los dos DTO de
    `CreatePurchaseOrderManual*Dto`, medido). **El instrumento que MIDE y el que ACTÚA tienen que
    tener el mismo ALCANCE.**
  - **Un `sha256` del fichero crudo NO sirve:** el servidor serializa cada `enum` **en el orden de
    declaración del DTO**, no ordenado, así que los **963 744 B** de los dos daban hashes **distintos**
    con el mismo contenido (primera divergencia en el byte **23634**: el `enum` de `type` de un
    `@ApiQuery`). Por eso la comparación **canoniza**; el diff byte a byte es un falso rojo.
  **Quién lo compara: un humano en la verificación del despliegue** — esto **no** tiene gate, y se
  declara: no lo tiene porque la cifra que se podría congelar **deriva** (las dos de arriba) y porque
  exige un despliegue vivo y una BD, que ningún gate de este repo levanta.
- **Nunca el reset/seed destructivo contra una base con datos del usuario** sin su decisión explícita
  (`db:recreate` borra). Procedimiento completo —backup, orden de migraciones, **SQL manuales por
  drift**, rollback y go/no-go—: **`docs/plans/runbook-go-live.md`**.

### Disciplina de medición y declaración

- **Si no se mide, no se adopta.** Todo incremento entrega el **antes y el después** con el comando que
  lo produjo; una mejora sin beneficio demostrable **se revierte** (caso medido: la hidratación de
  Angular, revertida y re-adoptada solo al construir la configuración que permite medirla).
- **Los gates se declaran con su salida**, no con un «debería pasar». Un rojo por **entorno o arnés**
  se declara como tal con su evidencia, y se repite en aislamiento antes de atribuirlo al producto.
- **El veredicto de un gate es su RESUMEN, no el exit code de un wrapper que mezcla stderr** (medido el
  2026-10-25). `npm run ci:local` termina con **`EXITCODE_CI_LOCAL=0`** y `RESUMEN: 23 pasos en verde en
  29m42s` (jest 268 suites / 3 625 tests): el script **no** devuelve 1. El `[exit code: 1]` lo pone el
  **invocador**: `node -e "console.error('X')" 2>&1 | Out-Null` ⇒ 1, la misma con `; echo $LASTEXITCODE`
  ⇒ 0. Se mide el exit code del **PROCESO** (`$LASTEXITCODE`/`spawnSync().status`), nunca el de una
  tubería con `2>&1`; y un script cuyo código no corresponde a su veredicto **sí es un defecto**. Gate:
  `npm run audit:exit-codes` (en `pre-push` y `ci:local`), que ejecuta una tabla declarada de gates con
  `spawnSync` y exige verde⇒0 / rojo⇒≠0, más la forma de `ci-local.mjs` y del `pre-push`; **no es
  gateable genéricamente** (cada gate inventa su resumen): la forma mínima es esa tabla, una línea por
  gate. [Texto completo](docs/guides/reglas-medidas.md#el-veredicto-es-el-resumen).
- **Si un diagnóstico se corrige, se escribe**: la corrección va al CHANGELOG o al plan; el diagnóstico
  anterior **no se borra**.
- **Una verificación de despliegue empieza esperando una HUELLA DE VERSIÓN**, nunca asumiendo que el
  despliegue ya ocurrió. `curl /health` devolviendo 200 **no** distingue builds: el 2026-10-06 el
  contenedor nuevo tardó ~11 min en estar servido y una verificación «200 y sano» dos minutos después
  del push midió el **build viejo** (medido: el 200 sin `X-Request-Id` seis veces y con él en el
  séptimo). La huella es algo que **solo** existe en el build nuevo (un endpoint, una cabecera, un
  hash de bundle); si no lo hay, **declare** que la identidad del build se confirma en el panel.
- **Un script que no arranca es un gate que no existe** (gate: `npm run audit:tracking:self-test`, `audit:reconcile:self-test`, `audit:pg-tools:self-test` y `declare:return-anchors:self-test` en `.husky/pre-push`; el CI ejecuta los dos primeros): ejecute el script, no lo parsee; si un `--self-test` no existe de verdad, no invente el alias. [Texto completo](docs/guides/reglas-medidas.md#script-que-no-arranca).
- **Después de empujar, compruebe LOS DOS espejos** (`git ls-remote origin refs/heads/main` y
  `git ls-remote deploy refs/heads/main`). El 2026-10-07 el push «salió bien» y el espejo `deploy` se
  quedó **2 commits atrás** (`origin` en `0417acd`, `deploy` en `4948689`) sin que el resultado global
  lo gritara: el hook corre la suite **una vez por `pushurl`** y el segundo falló. Un desfase de espejo
  es un despliegue que no ocurrió.
- **No empuje con otro proceso trabajando en el mismo árbol** (un agente, otra sesión, un E2E). Medido
  el 2026-10-07: tres pushes seguidos con un agente con el árbol sucio (41 ficheros) y corriendo
  suites ⇒ `husky - pre-push script failed` y espejo atrasado. El hook corre la suite entera por cada
  remoto y dos suites compitiendo por las mismas bases fallan (ver *Reglas de entorno medidas*).
- **Ninguna credencial en el código, tampoco en las specs.** Medido el 2026-10-07: **39 de 42** specs
  E2E construían su propio `PrismaClient` con el literal
  `postgresql://postgres:<password-local>@localhost:5432/erp_test` — la contraseña del `.env` local, que
  **no está versionado**. El CI usa `postgres`, así que `prepare-test-db.mjs` (que sí lee
  `E2E_DATABASE_URL`) conectaba y **las specs no**: 392 casos caídos por `Authentication failed`. Regla:
  las specs leen `process.env.DATABASE_URL` y **nunca** un literal con credenciales. Y como esa
  contraseña **sigue en la historia de git**, hay que **rotarla** (no basta con limpiar el código).
- **Declarar lo que no se midió** y los límites (flakes, datos ausentes, decisiones pendientes del
  usuario) en vez de taparlos. **Un entorno que nadie prueba es un gate que no existe.**
- **Una puerta tiene que comprobar el VALOR, no solo que el texto sea válido** (gate: `npm run audit:workflow-inputs`, en el CI de la raíz y `ci-local.mjs`): el YAML parsea aunque `node-version:` valga `null`; ejecute el valor, no el documento. [Texto completo](docs/guides/reglas-medidas.md#puerta-comprueba-el-valor).
- **La prueba de borde se escribe ANTES y se ve en ROJO.** Los dos arreglos de la doble conversión de
  zona del 2026-10-08 llevan el caso escrito y **fallando con el código viejo** antes de tocar el
  código: Notas de Crédito (`9eabacab`) **2 failed / 50 passed** con la zona del proceso por defecto y
  **6 failed / 46 passed** con `TZ=UTC`; `pricing.util` (`e33b0b4c`) **1 failed / 61 passed** con la
  zona por defecto y **3 failed / 59 passed** con `TZ=UTC`. Un test que nunca ha estado en rojo no es
  un gate. Y los **dos signos** del desplazamiento van puestos (tenant detrás y tenant delante) para
  que algo sea rojo en **cualquier** zona de proceso.
- **Al arreglar algo compartido, barra TODOS los sitios de la misma expresión.**
  `startOfTenantDay(nowInTenantTimeZone(tz), tz)` estaba en los **4** llamadores de Notas de Crédito
  (`9eabacab`), luego en `pricing.util.ts:362` (`e33b0b4c`) — y ese commit **declaró 7 sitios más** con
  la misma expresión: `alerts.service.ts` ×4 (341-344, 373-376, 401-404, 448-451),
  `reports.service.ts:694-697` y el precio de línea en `sale-invoices.service.ts:4952-4955` y
  `sale-reserve-invoices.service.ts:5215-5218`. El barrido va **un commit por sitio** (T258:
  `76688c98` avisos ×4, `95fa7edf` aging). Arreglar el útil **no** cierra la familia.
- **Un workflow que nunca se ejecuta es un workflow que nadie sabe si funciona** (gate: `npm run audit:workflow-inputs`, que exige `workflow_dispatch` o la marca `manual-only-ok:`): un run que no existe no prueba nada. [Texto completo](docs/guides/reglas-medidas.md#workflow-que-nunca-se-ejecuta).

- **Al migrar el ÍNDICE de un ratchet, el orden es: quitar la sonda → congelar el formato → sondear →
  quitar la sonda.** Regenerar la línea base **con la sonda dentro del árbol** hace que el índice
  viejo (`file:line`) no case con las claves nuevas y **TODO** aparezca como `NUEVA`: medido en el
  gate del `!` con un rojo intermedio de **1586** cuando la aserción de verdad era **una**, y en
  `audit:explicit-any` con **230**. El arreglo lleva las **dos** mitades: índice por **CONTENIDO**
  (`fichero::fragmento normalizado`) **y** lo que **DESAPARECE también se lista** al bajar (hasta 40),
  porque un informe que solo habla cuando empeora obliga a creerse la resta. Límite declarado: dos
  hallazgos idénticos en el mismo fichero comparten clave (inocuo para la **CUENTA**, que es lo que
  bloquea; afecta solo a la lista de sitios). La cuenta de **aquel** momento **no se movió**, y esas dos
  cifras son **históricas** (el rojo intermedio y la cuenta del día de la migración, no la vigente):
  `1585 = 1585` y `229 = 229`
  (`backend-erp`: `112a04c7`; su hermano `dca02341` aplica el mismo arreglo al segundo gate y
  comprueba el tercero —`audit:spec-clock` **no** lo tiene, porque su base no guarda `findings`—). La
  cifra **vigente** de esa familia, medida el **2026-10-11** con `npm run audit:explicit-any:check`, es
  **1** `any` explícito en total —**0** en producción y **1** en specs, el único sitio en
  `test/usage-marathon.e2e-spec.ts`—, y su tabla por familia deja **0** `as any`: está declarada
  arriba, en la lista de comandos del backend.
- **El delta por commit lo da el INSTRUMENTO, no la aritmética de quien migra.** Cuando la migración
  toca varios ficheros y va **un commit por fichero**, los otros se apartan para que el commit lleve
  **su** delta y no el de la tanda: `git stash push -- <fichero>` → `--check` → `--update-baseline` →
  commit → `git stash pop` (`backend-erp`, lote 1 de los ayudantes de fecha: `7418d513`, `82e67568`,
  `e1bd8bab`, `acf265e0`).
- **Una cita por número de línea caduca en cuanto algo se inserta por encima; el reparador existe**
  (2026-10-27, `scripts/reanchor-citations.mjs`). Medido en la campaña de `collection-caps`: **tres**
  empujones rechazados por motores que se habían movido (`progress.util` 221 → 223 → 226,
  `stock.util` 470 → 471 → 474, `pending-return` 370 → 371 → 375). El reparador usa la `evidencia`
  que cada concepto **ya declara** —un fragmento real de la línea— para volver a encontrarla: exige
  **una sola aparición** (con dos, el ancla no identifica nada y **se niega a escribir**: son los
  gemelos venta/compra), reescribe el número y la **cita en línea del código**. Su A/B está hecho:
  insertar una línea pone el gate en ROJO, `--apply` lo devuelve a VERDE. **Un re-anclador que se
  equivoca es peor que ninguno**, por eso se niega en vez de adivinar. **Y el `pre-commit` también
  mueve líneas**: lint-staged corre `eslint --fix` sobre los ficheros del commit, así que una cita
  puede romperse **después** de congelada (medido el 2026-10-28: el útil de la revaluación pasó de 30 a
  34 líneas al expandir un `return` y dos citas quedaron rotas; el gate lo cazó en la verificación
  posterior al commit). **Regla: tras commitear, vuelva a correr el gate** —o pase el `--fix` de
  lint-staged antes de medir las líneas—.
- **`--check` y `--update-baseline` son DOS pasos, y el segundo es el que deja el commit
  reproducible.** `8f944748` (`sales-orders`) corrió `--check` y **se olvidó** `--update-baseline`: la
  base quedó en **1524** con la cuenta real en **1521**, el gate **no falló** (bajar da verde) y la
  deuda dejó de estar congelada en su cifra. Hubo que congelarla en un commit aparte —`56770484`,
  `1524 → 1521`, **sin tocar una línea de código**—. Sin el segundo paso el delta **se pierde aunque
  el commit lo anuncie**.
- **La cifra global puede BAJAR mientras un fichero se queda sin migrar: la defensa es el delta por
  fichero, no el total.** Medido en `document-utils.ts`, donde la variable de zona se llama
  `timeZone` y no `settings.timeZone`: un `sed` por texto habría dejado sus **4** sitios sin migrar
  **y el contador habría bajado igual**, porque la cifra global la mueven los demás (`backend-erp`,
  `17897c18`; el mismo patrón en `2ef7d1b9`). Y el **censo por `!` nunca es el mapa del fichero**:
  `sale-reserve-invoices` **7** en el censo frente a **15** llamadas, `delivery-orders` **7** frente a
  **24**, `purchase-receipts` **5** frente a **6** (`7418d513`, `36b33ad7`, `e1bd8bab`).
- **Una herramienta que no encuentra lo que busca debe GRITAR, no callar.** El transformador de la
  migración tocaba el `import` solo cuando **no** quedaban llamadas al ayudante viejo; en tres
  ficheros sí quedaba una (con guarda), así que decidía «no hacía falta»… **y no hacía nada**, dejando
  `fromTenantDay` sin importar en **12** líneas. Lo cazó `typecheck:all`, y el agujero se arregló **en
  la herramienta**: amplía el import o dice `NO SE PUDO AÑADIR (revisar a mano)`, y cuando no
  sustituye nada avisa `⚠️ NINGUN SITIO SUSTITUIDO: ¿forma distinta? REVISAR` (`backend-erp`,
  `4cfd1c11`).
- **`typecheck:all` POR FICHERO** (gate: `npm run typecheck:all`, en el CI y el `pre-push` del backend): el delta del ratchet y el `eslint` por fichero no ven un identificador de TypeScript que no existe; va por fichero y no por tanda, en cualquier cambio. [Texto completo](docs/guides/reglas-medidas.md#typecheck-all-por-fichero).
- **Una herramienta puede hacer BIEN su tarea sobre el CONJUNTO EQUIVOCADO, y ningún gate lo verá:
  compruebe el ALCANCE antes de dejarla correr.** `audit:date-class` daba **0 hallazgos** mientras tres
  sitios leían mal `Batch.expiryDate`/`manufactureDate`, porque **no estaban en el registro
  `COLUMNS`**; declararlas subió las apariciones vigiladas **1345 → 1366** (hoy **1382**: el ratchet
  vigila los hallazgos, no las apariciones, y `audit:agents-figures` es el que cierra ese hueco — por
  eso la cifra se mueve EN EL MISMO empujón que el código que la mueve). **De dónde viene cada
  movimiento de esa cifra** (para que no vuelva a moverse sin saber por qué): de **1360 a 1361** la
  movió la reversa de **T280** (`backend-erp`, `29d8f472`), que añade el `documentDate` de la anulación
  al movimiento de stock; y de **1361 a 1364** la movió **T287**, la cadena del flujo de documentos
  (`backend-erp/src/document-flow/document-flow-chain*.ts`), que nombra `date` en el contrato y en sus
  dos specs — con la misma cifra se movieron los **ambiguos** declarados (**1101 → 1104**), porque el
  nombre `date` es ambiguo por diseño. Y el **desfase que había quedado anotado** entre el manual
  (1361) y la línea base del instrumento (**1360**) era exactamente eso, un número **viejo** en la
  línea base que el ratchet **no compara** (los dos contadores son de CENSO, no de deuda): se congeló
  en su cifra medida (**1364 / 1104**) en el mismo empujón, y por eso `audit:agents-figures` cierra en
  **26/26** con la cifra del manual igual a la del instrumento y el «0»
  pasó a ser cierto sobre el esquema y no sobre lo declarado (`backend-erp`, `017e46f9`, sobre el gate
  de `819cc493`).
  Desde el otro lado, la misma lección: en la migración de fechas el ratchet del `!` «hacía bien su
  trabajo; su trabajo no era este» (`4cfd1c11`). Aplica a **cualquier** cambio.
- **El instrumento que MIDE y el instrumento que ACTÚA tienen que tener el mismo ALCANCE.** Un censo
  orientado a líneas (`rg`) y un ejecutor con AST/JS no ven lo mismo, así que **el censo será una cota
  inferior**. Caso medido, en `AUDIT.md` **T126** (2026-09-14): el escáner del gate de dinero no veía
  los redondeos **multilínea** —`Math.round(` en una línea, la expresión con `* 100,` en la siguiente,
  `) / 100` en la tercera— y el **0** con el que se declaró cerrada R2b era un **artefacto de
  medición**: el valor real era **54**. Ese mismo gate siguió publicando cotas inferiores —**R1 = 22**;
  **R2c = 14** frente a ~**19** reales— hasta que se arregló el detector (`10a298c0`, `30db7d37`). La
  lección de T126, literal: **una métrica en 0 solo vale si el detector está probado contra los casos
  difíciles.** Aplica a **cualquier** cambio. Gate: `npm run audit:detectors:check` (en `backend-erp`),
  que **ejecuta** el `--self-test` de cada `audit-*.mjs` y exige, en los declarados, un caso de cada
  patrón que aplique —**multilínea** (T126), **nombre distinto** (`timeZone` vs `settings.timeZone`) y
  **sufijo** (`*.e2e-spec.ts` vs `*.spec.ts`)—, con su nombre en la salida real y su fixture **dentro**
  de la autoprueba; medido el 2026-10-25: **20** detectores, **18** con `--self-test`, **2** sin él (el
  hallazgo), **6** declarados y **12** con deuda (eran 19/17/5 el 2026-10-24; el gate del exit code añadió
  el detector 20). [Texto completo](docs/guides/reglas-medidas.md#mismo-alcance).
- **Un gate que se puede APUNTAR a otro sitio (variable de entorno, argumento) es un gate que se puede
  burlar; la raíz se resuelve por el propio repositorio.** Caso medido: `--check --file` de
  `audit:collection-caps` salía **0 en silencio** diciendo «mejoró: produccionSinCota 687 → 32» —**el
  ratchet degradado a decoración**— y ahora declara que es un informe de fichero y no evalúa nada
  (`backend-erp`, `fe929d9f`). Por eso los **siete** ratchets de `backend-erp/scripts/audit-*.mjs`
  resuelven su raíz y su línea base por la ubicación del **propio script**
  (`repoRoot = path.resolve(__dirname, '..')`; `BASELINE = path.join(__dirname, …)`), nunca por `cwd`,
  por una variable de entorno ni por un argumento.
- **Un gate cuyo baseline vive junto al script se puede probar en ROJO fuera del repositorio, sin
  tocar el árbol.** `audit-workflow-inputs.mjs` y su `.declarations.json` se copiaron a **%TEMP%** en
  **tres** copias del árbol, cada una con **una** rotura —`node-version:` vacío, la `TZ` movida de
  `ssr-smoke` a `e2e`, `workflow_dispatch` quitado— ⇒ las tres con `exit 1`; y el árbol real de solo
  la raíz se reprodujo igual en `%TEMP%` para medir el antes/después de su modo informativo
  (`958cd66`; `aecda16`). Un gate que solo se puede probar rompiendo el repositorio no se prueba.
- **Un filtro que no casa no dice «no hay nada»: dice «no sé».** Compruebe que el filtro **puede**
  encontrar algo antes de creerse su cero. Caso medido: el `walk()` del gate `audit:spec-clock`
  filtraba `/\.spec\.ts$/`, que **no casa con `*.e2e-spec.ts`**, así que **reproducía exactamente el
  agujero de ámbito que venía a arreglar** y su primer rojo dijo **6** en vez de **25**; el gate nace
  con una fijación en su autoprueba para que no vuelva (`backend-erp`, `5169e9df`). La cifra **vigente**
  del gate, medida el **2026-10-11** con `npm run audit:spec-clock:check`, es **0** hallazgos con **2**
  excepciones declaradas (`spec-clock-ok:` en `seed-storefront-day.spec.ts` y `timezone.util.spec.ts`),
  declarada arriba en la lista de comandos del backend. Hermana de «una
  métrica en 0 solo vale si el detector está probado contra los casos difíciles».
- **Cuando dos funciones implementan el mismo concepto, no basta con que compartan la pieza: hay que
  medir que siguen de acuerdo.** Compartir código es una **intención**, no una garantía: dos funciones
  que llaman al mismo útil **pueden divergir** en cuanto una añade una guarda que la otra no tiene, y
  el defecto vuelve por la puerta de al lado. Caso medido: en `backend-erp`, el validador de la
  frontera (`isTenantDayOrInstant`, que decide si el `date` de un borrador entra por el API) y el
  conversor de días (`fromTenantDay`) comparten la pieza `isTenantDay`, y **aun así** se escribió una
  **red de equivalencia** —una tabla donde `isTenantDay(d)` es verdadero **exactamente** cuando
  `fromTenantDay(d)` no lanza—, con los **dos** signos y en las **cuatro** zonas del repo, porque la
  equivalencia **no se deduce de compartir la pieza: se mide**. Sin esa red, la guarda que se añada
  mañana a cualquiera de los dos lados no la ve nadie (`backend-erp`,
  `src/common/timezone.predicates.spec.ts`; la frontera, en
  `src/common/decorators/is-tenant-day-or-instant.decorator.ts`). **Escriba la tabla de equivalencia y
  ejecútela**: «son la misma cosa» no se declara porque llamen al mismo útil.
- **Los fixtures que reproducen un defecto medido NO se tocan** (gate: `npm run audit:fixtures:check` —en `backend-erp` **y** en `erp-frontend`: toda marca `fixture-medido: T<nnn>` con su `T` en `AUDIT.md`, y toda spec que CITA un `T` en un comentario con su marca; el `ci:local` de la raíz corre **los dos**—). **La mitad que ningún gate ve, explícita: antes de «arreglar» un fixture, compruebe qué payload real reproduce; el que está mal puede ser el validador, no el fixture.** [Texto completo](docs/guides/reglas-medidas.md#fixtures-medidos).
- **Una tabla de casos también es un instrumento, y también puede mentir.** Una tabla **sin ejecutar**
  es una afirmación; una tabla que **se ejecuta** encuentra sus propios errores. Caso medido: la red de
  equivalencia de arriba falló en su **primer acto** porque un día **válido** (`'2026-06-15'`) estaba
  en la lista de los que **no** lo son: el mismo valor estaba en **las dos** listas (`DIAS_VALIDOS` y
  `NO_DIAS`), así que la tabla **se contradecía a sí misma** y el rojo señalaba al instrumento, no al
  código. Y un cero solo vale si el instrumento **puede** encontrar algo: **compruebe que el filtro
  PUEDE encontrar algo antes de creerte su cero** —hermana de la regla del filtro que no casa («no
  sé», no «no hay nada»)—. (`backend-erp`, `src/common/timezone.predicates.spec.ts`.) **Ejecute la
  tabla y compruebe que sus dos listas no se solapan**: un caso que está en las dos es un error de la
  tabla, no del producto.
- **Toda invariante NUEVA entra con su A/B: sin el A/B, «verde» no es una prueba, es una opinión
  (2026-10-17).** El caso se escribe con el **código anterior** delante y tiene que marcar el defecto
  —su literal y su cifra—; con el arreglo, tiene que dar verde. El caso medido lo escribió un agente
  horas antes: `ANNULMENTS_LOT` con el código de `main` daba **12 lotes rojos** y con el arreglo **0**,
  sobre un universo de **32 lotes**. El A/B va dentro de la autoprueba del instrumento (`--self-test`),
  no en la prosa: un caso que nunca se ha visto en rojo no es un gate. Y si el A/B descubre que el rojo
  era del **alcance** del instrumento y no del producto (T126, R2b), lo que se corrige es el alcance y
  se declara; no se celebra el verde.

## 6. Variables de entorno críticas

Archivo de referencia: `backend-erp/.env` (no versionado; **sí existe y está trackeado**
`backend-erp/.env.example`).

```bash
# Base de datos
DATABASE_URL=postgresql://...
SHADOW_DATABASE_URL=postgresql://...

# Seguridad
JWT_SECRET=...

# CORS
FRONTEND_URL=...            # requerido en producción

# Puertos / entorno
PORT=3000                  # el API escucha en 3000: el .env no define PORT y main.ts cae a 3000
NODE_ENV=development|production|test

# Rate limiting
THROTTLE_TTL_MS=...
THROTTLE_LIMIT_DEDICATED=...
THROTTLE_LIMIT_SHARED=...
THROTTLE_LIMIT_PUBLIC=...

# Superadmin
SUPERADMIN_USERNAME=...
SUPERADMIN_PASSWORD_HASH=...

# Import masivo
BULK_IMPORT_SAFE_MODE=true   # instancia dedicada (default)
# BULK_IMPORT_SAFE_MODE=false  # instancia compartida

# Health checks
HEALTH_MEMORY_THRESHOLD_PERCENT=...
HEALTH_DISK_THRESHOLD_PERCENT=...
```

Frontend: la URL de la API se configura en `src/environments/environment.ts` (desarrollo apunta a `window.location.hostname:3000`) y `environment.prod.ts`.

---

## 7. Consideraciones de seguridad

- **JWT en cookie HttpOnly** + header XSRF. El token también puede venir por header Bearer o query param `token`.
- **CORS dinámico:** en producción solo se permiten orígenes configurados en `FRONTEND_URL`.
- **CSRF middleware** (`CsrfMiddleware`) y `SanitizeInterceptor` globales.
- **RBAC:** `@RequirePermission(...)` en endpoints; `PermissionsGuard` global.
- **Multitenancy:** `TenantGuard` + aislamiento automático en Prisma. Nunca ejecutar queries sin `tenantId`.
- **Superadmin:** credenciales separadas (`SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD_HASH`).
- **Login por username:** desde la migración `20260624212300_username_login`, el login usa `username` (no email).
- **Import masivo seguro:** `BULK_IMPORT_SAFE_MODE=true` nunca desactiva triggers; `false` desactiva triggers temporalmente y usa lock global.
- **Validación de entrada:** `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted`, `transform`.

---


---

## Documentación de referencia

Tabla completa en el **Anexo E** del histórico. Las entradas que más se usan:

- `.agents/skills/angular-solid-frontend/` y `.agents/skills/nestjs-solid-backend/` — recetas de
  generación al **crear** páginas, formularios, listados, servicios o módulos nuevos.
- `erp-frontend/src/styles/CSS-ARCHITECTURE.md` — **antes de escribir o modificar SCSS global**:
  capas, receta de especificidad sin `!important`, política de `::ng-deep`.
- `docs/guides/ESTANDAR_LINEAS_DOCUMENTO.md`, `docs/guides/ACCOUNTING_ENTRIES_GUIDE.md` y
  `docs/guides/guia-implementacion-configuracion.md` — líneas de documento, asientos por tipo de
  documento y orden de configuración por perfil.
- `docs/reference/matriz-flujos-documentos.md` — **antes de tocar cualquier flujo de copia entre
  documentos**, sus guards o la lectura del API (lo vigila `npm run audit:flows`).
- `docs/plans/runbook-go-live.md` — **al desplegar a producción** o preparar el corte.
- `mcp-erp/README.md` — **MCP del ERP**: servidor stdio de solo lectura (13 herramientas de consulta).

> Las reglas **obligatorias** de diseño, tipado, arquitectura y testing viven en los 5 archivos
> canónicos del protocolo de inicio de trabajo, no aquí.

---

## Histórico: qué hay y dónde

El registro de sesiones se separó el **2026-10-06** a
[`docs/plans/historial-sesiones.md`](docs/plans/historial-sesiones.md), **íntegro y reformateado** (la
reforma solo inserta saltos de línea y encabezados: **no** se reescribió ni se borró texto).

| Parte del histórico | Qué contiene |
|---|---|
| **Parte 1 — Registro** | **134 entradas** fechadas, la más reciente primero (2026-10-07 → 2026-09-18), con índice |
| **Anexo A** | Estado real del proyecto (2026-09-12): la evidencia medida de cada comando |
| **Anexo B** | Sistema ShortName: cuentas asociadas y trazabilidad en asientos |
| **Anexo C** | Próximos pasos recomendados (2026-09-08), lista fechada |
| **Anexo D** | Comandos detallados de los tres proyectos, git hooks y **reglas medidas de entorno** |
| **Anexo E** | Índice de documentación adicional completo (22 filas) |
| **Anexo F** | Visión general del proyecto y stack tecnológico (íntegros) |
| **Verificación y pendiente** | La prueba de que no se perdió nada y lo que queda **por decidir** |

**Cuándo consultarlo:** para saber **por qué** algo está como está, qué se midió y con qué comando, qué
decisiones tomó el usuario y qué quedó declarado. Es la memoria del proyecto; este archivo es el manual
de trabajo. **`§2 Stack` del Anexo F tiene versiones desactualizadas**: ver «Pendiente de revisar».