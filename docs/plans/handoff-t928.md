# Handoff — T928 (reclasificación «dejar a favor»)

> Para una sesión nueva. Rama `feat/cancelacion-documento-ui` en los tres repos, **empujada en T927**:
> raíz `f9a32ed`, backend `d24ec60`, frontend `b5e987a`. Árboles limpios.

## Cerrado y empujado

- **T925** — formulario propio de la factura de cancelación (CAN-V/CAN-C), rutas
  `/{familia}/cancellations/:id`, listado, PDF propio (`GET /document-cancellations/:id/pdf`) y el
  nodo del mapa abriendo ese formulario. Recorrido `flujo-cancelacion-form-ui.mjs` **15/15**.
- **T926** — compras con datos: `CAN-C-2` verificada 24/24 (`flujo-cancelacion-compra-ui.mjs`),
  asiento espejo 80/80, `audit:reconcile` 0 errores.
- **T927** — la guarda de tipo de cambio no pide la tasa del día a anulaciones/reversas
  (`@SkipExchangeRate()` en 8 handlers). A/B medido: alta sin tasa → 400, anulación sin tasa → 201.

## T928 — lo acordado

«Dejar a favor» como **reclasificación de una entrada**, no dos documentos, cuando el cobro/pago está
**100 % sin aplicar**: una sola entrada **Dr CxC / Cr Anticipo de clientes** (compras: Dr Anticipo a
proveedores / Cr CxP), el **mismo pago** pasa a `isAdvance` con `advanceBalance = total`, sin tocar
caja/banco ni la fecha/método. Con aplicaciones vivas → **409** y se mantiene el camino de dos
documentos (ese caso queda declarado).

## Lo que ya se probó y se revirtió (no hay código en el árbol)

Se implementaron: enum `ADVANCE_RECLASSIFICATION` + migración, dos métodos del motor y
`leaveAsAdvance`/`leaveAsPayable`, endpoints y build. La prueba dejó el pago `COB-5` en
`isAdvance=true` y el favor del socio en +50, **sin asiento y sin error**. Se revirtió todo y se
restauraron los datos (`COB-5` a `isAdvance=false`/0, favor 0), se borró la carpeta de migración y su
fila en `_prisma_migrations`.

**Medido y descartado**: `accountingEnabled = True` en el tenant `default` (no es el modo comercial);
y **no existe** asiento de reclasificación bajo **ningún** tipo (SQL por `REC-%`, notas y
`sourceDocumentId`).

**Artefacto declarado**: el enum de Postgres conserva el valor `ADVANCE_RECLASSIFICATION` (inerte; la
BD es recreable con `npm run db:recreate`).

## Siguiente paso, en este orden

1. Re-aplicar **solo** enum + migración + `createAdvanceReclassificationJournalEntry(Outgoing)`.
2. **Spec del motor** con `tx` simulado: dos líneas Dr CxC / Cr Anticipo, cuentas resueltas,
   `sourceDocumentType`/`sourceDocumentId`, y período cerrado. Ahí se ve si el fallo es el motor o
   `_persist`/`persistManualJournalEntry`.
3. Con el asiento verificado por SQL, re-aplicar servicio + endpoints (`POST
   /incoming-payments/:id/leave-as-advance`, `/outgoing-payments/:id/leave-as-payable`, con
   `@SkipExchangeRate()`), y la pantalla (sustituir el cancel+create del modo CREDIT; el 409 cae al
   camino de dos documentos **corrigiendo el `CASH` fijo** por el método real).
4. Runbook por UI: cobro por transferencia sin aplicar → «dejar a favor» ⇒ una entrada `REC-…`, Banco
   sin movimiento, Anticipo +, CxC 0, sin documento nuevo; y con aplicación viva ⇒ 409.
5. AUDIT T928 + CHANGELOGs, gates, commit y push (pre-push backend ~34 min).

## Entorno

Backend `:3000` (dist), Angular `:4200`, tenant `default`, «hoy» 2026-11-19. Gates y protocolo:
`AGENTS.md`, `BACKEND_GUIDE.md`, `FRONTEND_GUIDE.md`.

---

## CIERRE (2026-11-19) — T928 cerrado

Los cinco pasos se completaron en el orden escrito, y el paso 2 fue el que faltaba la vez anterior:

1. **Enum + migración + motor.** `JournalSourceType.ADVANCE_RECLASSIFICATION` y
   `prisma/migrations/20261119193000_t928_advance_reclassification` con `ADD VALUE IF NOT EXISTS`
   (el valor ya existía en la base de desarrollo, artefacto del intento revertido).
   `createAdvanceReclassificationJournalEntry(Outgoing)` en `accounting-engine.service.ts`:
   **Dr CxC / Cr Anticipo de clientes** (compras: **Dr Anticipo a proveedores / Cr CxP**), cuentas
   por literales, tasa del propio pago. De paso, `persistManualJournalEntry` gana `branchId` (la
   cabecera del asiento manual nacía sin sucursal).
2. **Spec del motor ANTES de cablear nada**: 4 casos con `tx` simulado (dos líneas, cuentas del
   socio, `sourceDocumentType`/`sourceDocumentId`, sucursal, `partnerCode` y **409 de período
   cerrado**). El fallo anterior no estaba en el motor: era el cableado del servicio.
3. **Servicio + endpoints + pantalla.** `leaveAsAdvance` / `leaveAsPayable` con
   `@SkipExchangeRate()` y permiso `edit`; la anulación revierte **los dos** asientos
   (`INCOMING_PAYMENT` + `ADVANCE_RECLASSIFICATION`). La pantalla hace **un solo POST**; el respaldo
   de dos documentos queda para el **409** y lleva el **método real** (el `CASH` fijo movía el saldo
   de banco a caja). Además la pantalla lee las aplicaciones **antes**, para no pintar el 409 como
   error cuando el respaldo va a funcionar.
4. **Runbooks.** El del backend (API + SQL, temporal) y el de la UI
   (`erp-frontend/scripts/recorridos/flujo-t928-dejar-a-favor-ui.mjs`, **19/19**) están en el
   `CHANGELOG` de cada repo y en `AUDIT.md` T928.
5. **Cierre documental y gates**: `AUDIT.md` T928, `CHANGELOG` de backend y frontend, `gate:rapido`
   **7/7**, `typecheck` **0**, `build` **0**, Karma de las dos listas **12/12** y **9/9**, `ng build`
   **0**, `lint` 0/0, `audit:copy` **0**, `a11y` **0**.

**Lo que sigue declarado** (no deuda escondida): el caso con **aplicaciones vivas** sigue yendo por
dos documentos (el 409 es la frontera); el cobro «a cuenta» no llega (sin socio ⇒ muere antes); y el
artefacto del enum en la base de desarrollo se declara en la propia migración.

### Flecos cerrados después del push (2026-11-19)

- **Espejo `deploy`**: la rama quedó en los **dos** remotos del backend (`origin` y `deploy`,
  `4b4b0edd`), con el sello por contenido saltándose la segunda pasada de la suite.
- **Recorrido por UI de compras**: `flujo-t928-dejar-a-favor-ui.mjs` cubre ahora **las dos
  direcciones** (cobro y pago a proveedor) y pasa de 19 a **37/37** comprobaciones.
- **Los dos gates de UI que el pre-push no corre, medidos**: `e2e:functional` **563/37/40** (55 min) y
  `e2e:mobile` **54/14/18** (23 min). **Rojo de arnés y datos, no de T928**: la mitad son specs que
  piden una FV normal desde entrega/recepción cuando la guarda de **T865** exige la FRV (ficheros que
  T928 no toca), el resto son conteos y acciones que dependen del estado acumulado de `erp_test`
  («137 resultados» contra 138 reales) y tres casos de layout/a11y en `/partners`. **Ningún spec del
  suite maneja el diálogo «dejar a favor»** y el recorrido propio da 37/37. El arnés restauró
  `erp_test` con huella idéntica (`e048abb9d58d`, 204 tablas) en las dos corridas. El desglose
  completo, con la prueba de cada familia, está en `AUDIT.md` T928.


