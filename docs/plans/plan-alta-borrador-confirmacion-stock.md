# Plan — Alta en borrador y confirmación explícita en los documentos de stock

> **Estado:** propuesto el **2026-09-21** a pedido del usuario. Origen: el **hallazgo medido** de AUDIT
> **T177** al cerrar el PATCH con líneas —«hoy **ningún endpoint** crea un documento de stock `OPEN`»—
> y la decisión del usuario de **planificar antes de tocar código** (opción elegida: «Plan nuevo y lo
> aprobamos antes de tocar código»).
>
> **No se escribe una línea de código hasta que el usuario decida la opción de §0 y responda las
> preguntas de §4.**
>
> Relacionado: AUDIT **T177** (el PATCH con líneas), `docs/plans/plan-cuentas-contables-editables.md`
> (la cuenta capturada por línea) y `docs/plans/plan-centros-costo-y-reparto.md` (la norma de reparto
> por línea): las dos capturas **solo se pueden editar en un borrador**, y hoy no hay camino de API
> que produzca uno.

---

## 0. Decisión del usuario (pendiente)

| Pregunta | Decisión |
|---|---|
| ¿Opción **A**, **B** o **C** de §2? | **PENDIENTE** (recomendación: **A**) |
| ¿El default de `confirm` es `true` (compatibilidad) o `false`? | **PENDIENTE** (recomendación: `true`) |
| ¿«Confirmar» lleva permiso propio o el del alta? | **PENDIENTE** (recomendación: permiso propio `confirm`) |
| ¿El alta masiva de stock inicial sigue confirmando? | **PENDIENTE** (recomendación: sí, sin cambios) |

---

## 1. Qué existe hoy (medido, 2026-09-21)

| Hecho | Evidencia |
|---|---|
| Los tres `POST` crean el documento `OPEN` y **confirman en la misma request** | `stock-entries.service.ts:289` (`createManual`), `:377` (`status: StockEntryStatus.OPEN`), `:399-401` (`return … this.confirm(...)`); espejo en `stock-exits.service.ts:380` y `stock-adjustments.service.ts:387` |
| El `timeoutMs` opcional **no** evita la confirmación | `stock-entries.service.ts:394-401`: la rama solo propaga el margen de la transacción al `confirm` (import masivo de stock inicial) |
| `confirm()` **existe** en los tres servicios y está cubierto por unitarios | `stock-entries.service.ts:405` (`confirm`), `stock-entries.service.spec.ts:408` («debería confirmar y generar movimientos de stock», «…rechazar confirmar una entrada no abierta») |
| `confirm()` **no está expuesto** en ningún controlador de las tres familias | Rutas reales: `@Post('manual')` (entradas/salidas) y `@Post()` (ajustes), `@Post(':id/cancel')`, `@Patch(':id')` y los `GET` —no hay `:id/confirm` en ninguno— |
| El `PATCH :id` con `items` (T177) es **reemplazo**, exige `OPEN` y **no toca stock, kardex ni asiento** | AUDIT **T177**; `test/stock-document-lines-patch.e2e-spec.ts` **6/6** |
| La pantalla ya comparte el builder de líneas del alta y de la edición | frontend: `buildItemsPayload()` único en los tres formularios (T177) |
| Crear y confirmar son **dos transacciones**: el `create` commitea y después se confirma | `stock-entries.service.ts:321-395` (tx del create) y `:399-401` (confirm, otra tx). **Leído en el código, no medido en runtime**: si el `confirm` falla (p. ej. `:465` «el artículo de la línea no tiene costo definido») queda un documento `OPEN` creado —hoy la única forma de tener uno— |
| El módulo de **borradores** existente **no cubre stock** | `src/document-drafts/document-drafts.service.ts:239` filtra por `SALES_DOCUMENT_TYPES` (documentos comerciales); no hay borrador para las tres familias de stock |
| `stock-counts` y `stock-transfers` quedan **fuera** | `stock-counts` ajusta por su propio camino (no usa este `PATCH`); el traspaso ya está declarado fuera de las cuentas/normas capturadas |
| Permisos actuales de las tres familias | `@RequirePermission('stock-entries', 'create' | 'cancel' | 'edit')` y sus espejos (`stock-exits`, `stock-adjustments`) |

**Consecuencia práctica medida:** la cuenta capturada (P2) y la norma de reparto (C2) por línea se
pueden **cargar y editar** en un borrador… al que hoy solo se llega reseteando el estado por BD. En la
operación real, el usuario captura, guarda y el documento se contabiliza en el mismo gesto: no hay
«revisar antes de contabilizar».

---

## 2. La decisión de diseño (3 opciones)

| Opción | Qué es | Impacto en el contrato actual | Veredicto |
|---|---|---|---|
| **A — Bandera + endpoint de confirmación** | `POST` acepta `confirm?: boolean` (**default `true`**: el contrato observable no cambia) y se expone `POST /:id/confirm`; la pantalla gana **Guardar borrador** y **Confirmar** | **Nulo por defecto**: los llamadores actuales (pantalla, import masivo, E2E) siguen recibiendo el documento confirmado | **Recomendada**: es la más barata, explícita y no rompe nada |
| **B — `POST` siempre crea `OPEN`** | La confirmación pasa a ser un paso obligatorio para todos | **Alto**: rompe el import masivo, los E2E de stock y el flujo de la pantalla (habría que tocar cada llamador), y un alta que no se confirma deja stock sin mover | No recomendada |
| **C — Endpoint de borrador separado** (`POST /manual/draft`) | Dos rutas de alta | Medio: duplica el camino y deja dos formas de crear el mismo documento | No recomendada (la bandera es más explícita y no duplica) |

Con **A**, el flujo de SAP B1 queda completo: **documento sin contabilizar → revisar/editar → añadir
(documento contabilizado)**, con el borrador del ERP (`DocumentDraft`) reservado a los documentos
comerciales donde ya existe.

---

## 3. Fases propuestas (si se aprueba la opción A)

| Fase | Qué se hace | Gate / medición |
|---|---|---|
| **F1 — Backend: la bandera y la ruta** | `confirm?: boolean` (default `true`) en los tres DTO de alta; `POST /:id/confirm` en los tres controladores (permiso decidido en §4, Swagger, `@HttpCode`) reutilizando el `confirm()` que ya existe; el alta con `confirm: false` devuelve el documento `OPEN` **sin** stock, kardex ni asiento | Unitarios: bandera off → `OPEN` y cero movimientos; `:id/confirm` confirma y genera stock/kardex/asiento; confirmar dos veces → 400; confirmar un `CANCELLED` → 400; default sin la bandera → comportamiento actual intacto. E2E: alta en borrador → `PATCH` de líneas (T177) → `:id/confirm` → el mayor abre la pata con la **cuenta capturada** y el reparto en los centros de la norma |
| **F2 — Atomicidad (decidir y declarar)** | Medir en runtime qué deja hoy un `confirm` fallido (documento `OPEN` huérfano, ya leído en el código) y elegir: **(a)** declararlo —el borrador queda, el usuario corrige y confirma, que es justo lo que este plan hace posible— o **(b)** envolver create+confirm en una transacción (el import masivo ya subió el margen a 60 s por los *advisory locks*: riesgo real de `P2028`) | Medición con un caso E2E que fuerza el fallo del confirm (artículo sin costo) y comprueba el estado que queda; la decisión se escribe en AUDIT y en el contrato |
| **F3 — Frontend: borrador y confirmación** | «**Guardar borrador**» en la barra de acciones de los tres formularios (mismo payload con `confirm: false`) y acción «**Confirmar**» en el detalle y en el menú de fila del listado (solo `OPEN`), con diálogo de confirmación y el badge de estado que ya existe; el formulario de un `OPEN` sigue editable (T177) | Unitarios de los tres formularios (payload del borrador, botón visible solo en `OPEN`, la acción llama al endpoint y refresca) y del listado; `e2e:visual` **sin regenerar baselines** (los 53 formularios capturan el alta, no el borrador: comprobar y declarar si alguno cambia) |
| **F4 — Documentación y gates** | AUDIT (fila nueva), `docs/reference/matriz-flujos-documentos.md` (§5.c: estados y transiciones del stock, con el nuevo camino), `AGENTS.md` (comandos y métricas) y CHANGELOG de los dos repos | Gates completos: `npm run build`, `lint`, `npm test`, `test:e2e`, Karma, `e2e:visual` y `e2e:functional` **sobre BD recreada** (regla de proceso de AUDIT T172) |

**Orden de cierre:** cada fase con su evidencia medida, commit **sin acentos** y push a todos los
remotos (backend `origin` + `deploy`; frontend y raíz `origin`), como el resto del proyecto.

---

## 4. Preguntas abiertas para el usuario

1. **¿Opción A, B o C?** *Recomendación:* **A** (bandera `confirm` con default `true` + `POST :id/confirm`).
2. **¿El default de `confirm` debe ser `true`** (compatibilidad total con pantalla, import masivo y E2E) **o `false`** (el ERP nunca confirma solo y cada llamador decide)? *Recomendación:* `true`.
3. **¿La confirmación lleva permiso propio** (`stock-entries:confirm`, `stock-exits:confirm`, `stock-adjustments:confirm`) **o el del alta?** *Recomendación:* propio (separar «quien carga» de «quien contabiliza» es la razón de ser del frente).
4. **¿El alta masiva de stock inicial** (import) **debe seguir confirmando?** *Recomendación:* sí, sin cambios.
5. **¿El borrador caduca?** ¿Un `OPEN` de hace semanas se avisa en el listado o se puede confirmar sin límite? *Recomendación:* sin caducidad y con el estado visible (el listado ya tiene el badge), a evaluar tras el primer uso.
6. **¿El módulo de aprobaciones** (`Approval`) debe poder engancharse a la confirmación del stock, o queda fuera? *Recomendación:* fuera de este plan (frente aparte).

---

## 5. Límites declarados

- **No** se toca `stock-transfers` ni `stock-counts`: el hallazgo es de las tres familias que hoy
  confirman solas (entrada, salida y ajuste), y el traspaso ya arrastra su excepción declarada (su
  contabilidad es la de cada almacén).
- **No** hay migración de datos: no se esperan documentos `OPEN` legítimos en una instalación en uso
  (los que hubiera son restos de un `confirm` fallido, y el plan decide en F2 qué hacer con ellos).
- **No** se introduce un estado «preliminar» nuevo en el schema: se usa el `OPEN` que ya existe (el
  `CONFIRMED` y el `CANCELLED` no cambian), así que el kardex, el motor contable y los informes no se
  tocan.
- **No** se promete edición de líneas de un documento confirmado: sigue prohibida (T177), y este plan
  no la abre.
