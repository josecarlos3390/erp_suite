# Plan — Cierre de los restos declarados (barrido corto)

> Estado: **EJECUTADO (2026-09-22)** — aprobado por el usuario con los tres criterios
> recomendados (ejecutar F1–F4, dejar los fallbacks legacy marcados y justificados, y declarar
> R14f como aviso informativo). Ver §4 para la evidencia medida.
> Origen: pedido del usuario («cerrar restos declarados») tras medir que **C4 ya estaba
> resuelto** (§3.5 del plan de centros de costo) y que los pendientes «grandes» del ROADMAP
> son features nuevas (F5.1 SIN, 6.6 Nómina, F5.4 CRM, F7.3 localización, F5.3 SAP).

## 0. Qué se midió (antes de proponer)

| Resto | Lo que decía la doc | Medición de hoy |
|---|---|---|
| **C4** (matriz, guía y detector) | «Queda C4» (última línea del tramo de C2-UI en el header de `AGENTS.md`) | **Ya cerrado** (§3.5 del plan: bloque **R17** con sonda medida, matriz §5.b, guía paso A.4b, gate 238 · 0 · 3). Solo queda **anotar la línea** para que no vuelva a inducir a error |
| **`audit:money:taint`** | «192 sitios declarados» (§9 de AUDIT) | **0 sitios** y **3 justificados**: el límite 12 se promovió a gate (**R2a v5**). El resto está cerrado; la doc quedó vieja |
| **Avisos del detector de flujos** | «0 errores / 2 avisos (R7 y R9)» | **0 errores / 4 avisos**: **R14f ×2** (NC con mercancía acreditada sin devolver — depende del estado de la BD), **R13c** (4 tipos de producción sin comprobación de anulación) y **R9** (6 lecturas de modelos legacy) |
| **Norma no capturada en cotizaciones/pedidos/ensamblaje** | límite declarado (plan T174/T175–T178) | Sigue **declarado con su razón medida** (no contabilizan / el reparto sería inerte). No hay nada que cerrar: se re-afirma en la doc |

**R9, sitio por sitio (medido, los 6 son el mismo patrón deliberado):** el código prefiere el
**modelo unificado** (`isReserve = 'Y'`) y **cae al legacy solo si no lo encuentra**
—`document-flow.service.ts` ×4 (detalle y `findRawDocument` de FRV y FRC),
`document-series.service.ts` (cuenta de uso de la serie) y
`common/accounting/drafts.journal-builder.ts` (total/pagado de una FRC aplicada)—. Borrar el
fallback dejaría **ilegibles los documentos históricos** de una instalación vieja; el cierre
honesto es **justificarlos** y que el detector deje de contarlos como sospecha.

**R13c, alcance real:** `checkAnnulmentReversals()` tiene su tabla `DOC_MODELS` de tipo de
origen → modelo; los 4 tipos del ciclo productivo no están, así que sus anulaciones no se
comprueban (un asiento POSTED de un documento anulado sin reversa pasaría inadvertido).

## 1. Fases

| Fase | Qué se hace | Cómo se verifica |
|---|---|---|
| **F1 — R9 a 0 sin justificar** | Marcador `legacy-fallback-ok: <razón>` (idioma ya usado por `::ng-deep-ok`, `money-ok`, `select-options-ok`…) en los 6 sitios, y el detector clasifica: marcado → **contado aparte**; sin marcar → aviso (el guard de T103 sigue vivo: dos defectos reales nacieron de lecturas legacy sin camino unificado) | `npm run audit:flows` con R9 en **0 sin justificar**; **sonda**: quitar un marcador y ver que el aviso vuelve y la cuenta lo nombra |
| **F2 — R13c cerrado (cobertura)** | Mapear `PRODUCTION_ISSUE`, `PRODUCTION_RECEIPT`, `PRODUCTION_RESOURCE` y `PRODUCTION_CLOSE` a su modelo real (a medir en schema y en el camino de anulación de cada uno) para que R13 compruebe el par anulado+reversa | `npm run audit:flows` en **0 errores**. Si aparece un ERROR, es un **defecto real**: se investiga el camino de anulación y se cierra (o se declara con su razón medida si el tipo no genera asiento propio) |
| **F3 — R14f declarado** | Aviso **informativo de estado** (la mercancía acreditada se devuelve con otro documento, acción del usuario): se declara en el propio detector y en la doc, sin cambiar producto | Mensaje del detector explícito de que es estado, no defecto |
| **F4 — Doc y cierre** | `AGENTS.md`: anotar «C4 cerrado» en el tramo que lo dejaba pendiente. `AUDIT.md` §9: medición de hoy y retiro de los «192 sitios» como deuda viva. `AUDIT.md`: fila del barrido con la evidencia | `docs` coherentes con la salida real de los gates |
| **Evidencia** | `npm run audit:flows` (0 errores), `npm run audit:money:taint` (0), `npm test` del backend (185 suites/2238, solo si se toca `src/`), `npx tsc --noEmit` y `lint`, y push (backend + raíz) | Corridas reales, sin skips |

## 2. Decisiones que necesito de ti

1. **Fallbacks legacy (F1):** ¿los dejamos **marcados y justificados** (recomendado: cero
   riesgo y los documentos históricos siguen legibles) o preferís **eliminarlos**? Eliminarlos
   exige afirmar que **ninguna instalación** tiene filas en las tablas legacy, y eso no es
   medible desde este entorno (la BD local tiene 0 filas, pero es la BD de desarrollo).
2. **R14f (F3):** ¿lo dejamos como **aviso informativo** (recomendado) o querés que la nota de
   crédito **genere la devolución automáticamente**? Lo segundo es decisión de producto y otro
   alcance (toca el flujo de NC).

## 3. Cierre ejecutado (evidencia medida)

| Fase | Qué se hizo | Evidencia |
|---|---|---|
| **F1 — R9 justificado** | Marcador `legacy-fallback-ok: <razón>` en las **6** lecturas legacy (4 en `document-flow.service.ts`, el conteo de series y el borrador de pago) y severidad **INFO** en el detector para lo marcado | `audit:flows`: **1 justificado(s)** con las 6 lecturas listadas; **sonda**: al quitar un marcador vuelve `1 aviso(s)` nombrando la lectura sin justificar (y 5 justificadas) |
| **F2 — R13c cerrado** | Los 4 tipos del ciclo productivo mapeados en `DOC_MODELS` (`productionIssue`, `productionReceipt`, `productionOrderResource` —por `cancelledAt`— y `productionOrder`) | El aviso «tipos de documento sin comprobación» **desaparece** y **no** aparece ningún ERROR: los pares anulado+reversa de producción están consistentes |
| **F3 — R14f declarado** | El aviso empieza con «AVISO DE ESTADO (no es un defecto del producto…)» y explica que la devolución es acción del usuario | Los dos avisos R14f se imprimen con ese texto en la corrida |
| **F4 — Doc** | `AGENTS.md`: la línea que dejaba C4 pendiente ahora lo anota cerrado (y el barrido de T170); el conteo fijo de avisos del detector deja de ser fósil. `AUDIT.md`: actualización fechada en §9 y fila **T181** con este cierre | `git diff` de los dos archivos + esta tabla |

**Medición final del detector**: `Resumen: 0 error(es), 2 aviso(s), 1 justificado(s) · bloques de reglas evaluados: 10` (exit 0). `npm run audit:money:taint`: **0 sitios** (3 justificados).

## 4. Fuera de alcance

- Los cuatro frentes de features (F5.1 SIN, 6.6 Nómina, F5.4 CRM, F7.3 localización) y el
  conector SAP: cada uno arranca con su propio plan.
- El límite de la norma en cotizaciones/pedidos/ensamblaje: se re-afirma, no se cambia.
