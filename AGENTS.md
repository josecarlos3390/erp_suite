# AGENTS.md — erp_suite (monorepo)

> **Última actualización:** 2026-06-29.  
> Este es el archivo canónico de restricciones, convenciones y comandos para todo el monorepo. Todo agente de código debe consultarlo antes de modificar archivos en `backend-erp/` o `erp-frontend/`. Para detalles específicos de cada subproyecto, ver:
>
> - Backend: `backend-erp/TECH_DEBT.md`, `backend-erp/docs/TYPE_SAFETY.md`.
> - Frontend: `erp-frontend/AGENTS.md`, `erp-frontend/docs/monorepo/AGENTS.md`, `erp-frontend/docs/monorepo/ROADMAP.md`.

---

## 1. Estructura del monorepo

```
erp_suite/
├── backend-erp/          # API NestJS (repo Git propio)
│   ├── src/              # ~90 módulos de dominio
│   ├── prisma/           # schema, migraciones, seed
│   ├── test/             # tests E2E con Jest
│   └── docs/             # TYPE_SAFETY.md, BACKUPS.md, MONITORING.md, etc.
├── erp-frontend/         # SPA Angular (repo Git propio)
│   ├── src/app/          # páginas, modelos, shared, core, auth
│   ├── e2e/              # tests E2E con Playwright
│   └── docs/monorepo/    # ROADMAP.md, AGENTS.md, AUDIT_TRACKING.md, etc.
├── luna/                 # copia de referencia del design system
└── .agents/skills/       # skills de Kimi para backend/frontend
```

- **No hay workspace unificado** (ni Nx, ni Lerna, ni Turbo). Cada subproyecto se instala y construye por separado.
- Los hooks de Husky viven en tres niveles: raíz, `backend-erp/.husky/` y `erp-frontend/.husky/`.
- El `.gitignore` raíz excluye `/backend-erp/` y `/erp-frontend/` porque son repositorios Git anidados.

---

## 2. Reglas transversales (no negociables)

| # | Regla | Razón |
|---|-------|-------|
| 1 | **Cero `as any` en código de producción.** En tests se permite solo `as unknown as T` o `satisfies Partial<T>`; nunca `as any`. | Evita regresiones de tipo y deuda técnica. |
| 2 | **Un commit por archivo.** Agrupar solo cuando un cambio es indivisible (ej. DTO + controller + service de la misma funcionalidad). | Historial limpio y revertible. |
| 3 | **Build limpio y tests verdes antes de push.** | `npm run build` (backend) / `ng build` (frontend) sin errores; `npm test` / `ng test` al 100%. |
| 4 | **No `// @ts-ignore` ni `// @ts-expect-error`.** | Cero supresiones de tipos. |
| 5 | **No redefinir modelos de dominio en servicios.** Frontend: usar `src/app/models/`. Backend: usar tipos Prisma/DTOs. | Fuente única de verdad. |
| 6 | **Documentar cambios arquitectónicos.** Si tocas convenciones, patrones o deuda técnica, actualiza `AGENTS.md`, `TECH_DEBT.md` o `ROADMAP.md`. | Evita que decisiones se pierdan. |
| 7 | **No tocar archivos fuera del working directory** salvo instrucción explícita. | Seguridad e integridad del sistema. |

---

## 3. Backend (`backend-erp/`)

### Stack
- NestJS 11.0.1, TypeScript 5.7.3, Prisma 6.19.2, PostgreSQL.
- Auth: JWT en cookie `access_token` HttpOnly + header `X-XSRF-TOKEN`.
- Tests: Jest + ts-jest. E2E en `test/`.

### Reglas clave
- DTOs con `class-validator`; nunca `body: any`.
- Servicios con tipos de retorno explícitos.
- Prisma payloads tipados con `Prisma.*GetPayload<typeof include>` o `as const`.
- Utilitarios genéricos; nunca `any` en parámetros.
- `tenantId` se inyecta automáticamente vía `tenant-isolation.extension.ts`; no exponer `tenantId` en DTOs públicos.
- Patrón `createFrom*`: usar DTOs formales en `dto/from-*.dto.ts`, no payloads anónimos.

### Comandos esenciales
```bash
cd backend-erp
npm run build
npm run lint
npm test                 # 114 suites / 958 tests
npm run test:e2e         # 10 suites / 51 tests
npm run perf             # Performance con autocannon (local)
npm run perf:k6          # Performance y concurrencia multitenant con k6 (local)
npx prisma migrate dev   # crear/aplicar migración
npx prisma db seed
```

### Estado de deuda técnica
Ver `backend-erp/TECH_DEBT.md`. **Fases 1-10 completadas.** Actualmente:
- 0 `as any` en `src/**/*.ts`.
- Build limpio, tests verdes.

---

## 4. Frontend (`erp-frontend/`)

### Stack
- Angular 19.2.19, TypeScript ~5.7.2, Angular Material 19.2.19, standalone components, SSR habilitado.
- Design System LUNA en `src/app/shared/luna/`.
- Tests: Karma + Jasmine (unitarios), Playwright (E2E).

### Reglas clave
- Modelos en `src/app/models/` son la **única fuente de verdad**.
- Cero `: any` (salvo excepción documentada en `LunaDataTable.format` / `badgeVariant`).
- Formularios nuevos usan `<luna-form-page>` y componentes LUNA.
- Selectores modales usan el trigger estándar (ver `erp-frontend/AGENTS.md`).
- Componentes con `OnPush` requieren `cdr.markForCheck()` tras suscripciones (ver `erp-frontend/AGENTS.md`).

### Comandos esenciales
```bash
cd erp-frontend
npm run build
npm run lint
npm test                 # Karma en modo watch (desarrollo)
npx ng test --watch=false --browsers=ChromeHeadless  # Karma CI / pre-push
npm run e2e              # Playwright (backend + seed y frontend automáticos)
npm run e2e:functional   # Todos los E2E excepto regresión visual de formularios
npm run e2e:visual       # Regresión visual de los 51 formularios (Chromium, workers=4)
npm run e2e:baseline     # Regenerar baseline visual de los 51 formularios
```

---

## 5. Estado actual del proyecto

### Completado recientemente
- ✅ Ejecución green de la suite de carga k6 (perfil `small`): 5/5 escenarios passed, 0% fallos, aislamiento multitenant verificado.
- ✅ Fase 1-6 de limpieza de tipos (`as any`, acumuladores, parámetros, casts, payloads `createFrom*`).
- ✅ Fase 8: extensión Prisma de aislamiento de tenant fortalecida (inyección recursiva).
- ✅ Fase 9: eliminación de diagnósticos temporales en `special-prices`.
- ✅ Fase 10: mitigación del aviso intermitente de worker process force exited.
- ✅ Fase 7: limpieza de `as any` en 20 archivos `.spec.ts` del backend.
- ✅ DT.10 Fase 2: `date`/`postingDate` obligatorios en stock/logística (schema, DTOs, servicios, frontend).
- ✅ DT.10 Fase 3: `date`/`postingDate` obligatorios en pagos y contabilidad (schema, DTOs, servicios, frontend).
- ✅ Limpieza de archivos temporales de DT.10.

### Métricas de referencia
| Métrica | Valor |
|---------|-------|
| `as any` en backend `src/` | **0** |
| `as any` en backend `*.spec.ts` | **0** |
| Backend tests | **118 suites / 1018 passed** |
| Load tests k6 (perfil `small`) | **5/5 escenarios passed** |
| Backend E2E | **57 tests / 11 suites passed** |
| Playwright E2E (Chromium) | **184 passed** |
| Playwright E2E (Firefox — flujos críticos) | **27 passed** |
| Frontend tests | **622 passed** |
| Build backend | **0 errores** |
| Build frontend | **0 errores** |

---

## 6. Próximos pasos prioritarios

Ordenados por impacto y dependencias:

1. **Pruebas de carga y concurrencia multitenant** (k6):
   - ✅ Suite k6 creada en `backend-erp/load-tests/k6/` (smoke, load, bulk-import, kardex, multitenant isolation).
   - ✅ CI separado en job `load-tests` del backend.
   - ✅ **Primera ejecución green validada localmente** (perfil `small`, 5/5 escenarios, 0% fallos, ~229 s).
   - ✅ **Ejecución green validada en GitHub Actions** (perfil `small`, 0% fallos, aislamiento multitenant verificado, ~216 s).
2. **Validación obligatoria de `date`/`postingDate`** (DT.10):
   - ✅ **Fase 1 — Documentos comerciales** completada.
   - ✅ **Fase 2 — Stock/logística** completada.
   - ✅ **Fase 3 — Pagos y contabilidad** completada.
3. ✅ **Baseline visual de formularios** con Playwright (`e2e/forms-reference-screenshots.gen.ts`) — 51 screenshots generados.
   - ✅ Generación completada.
   - ✅ Regresión visual automatizada (`e2e/forms-visual-regression.spec.ts`) con `maxDiffPixels: 100` — 51/51 passed en Chromium.
   - ✅ CI separado en job `visual-regression` con `workers=4`.
4. ✅ **E2E críticos completados**: ventas, compras, stock, pagos parciales, devoluciones y conciliación.
5. ✅ **Runner Karma estabilizado**: `npx ng test --watch=false --browsers=ChromeHeadless` termina limpio con **622/622 SUCCESS**. El `npm test` por defecto entra en modo watch y no termina el proceso; usarlo solo en desarrollo.
6. ✅ **Cross-browser Playwright** (config CI con `ng serve --watch=false`):
   - ✅ **Chromium**: **184/184 passed** (confirmado formalmente).
   - ✅ **Firefox**: **184/184 passed**.
   - ✅ **Mobile Chrome**: **184/184 passed**.
   - ✅ **Mobile Safari**: **184/184 passed**. Se aplicó `test.setTimeout(60000)` en `qa-tax-calculations.spec.ts` porque los tests API-only excedían 30s bajo carga de WebKit mobile.
   - ✅ **Tablet Safari**: **184/184 passed**.
   - ⚠️ **WebKit worker cleanup** (Playwright 1.60.0 en Windows): Mobile/Tablet Safari terminan funcionalmente bien, pero Playwright reporta `worker process did not exit within 300000ms after stop, force-killed it` y dejan huérfanos `WebKitNetworkProcess`. No afecta el pass rate.
     - Script: `erp-frontend/scripts/cleanup-playwright-webkit.ps1`.
     - Uso local (dry-run): `powershell -ExecutionPolicy Bypass -File erp-frontend/scripts/cleanup-playwright-webkit.ps1 -DryRun`.
     - Uso local (limpieza real): `powershell -ExecutionPolicy Bypass -File erp-frontend/scripts/cleanup-playwright-webkit.ps1`.
     - **Uso en CI (Windows runners):** ejecutar el script incondicionalmente después de cualquier paso de Playwright que incluya Safari (mobile/tablet). El script es idempotente y no falla si no hay procesos huérfanos. Ejemplo de paso en GitHub Actions:
       ```yaml
       - name: Cleanup orphan WebKit processes
         if: runner.os == 'Windows' && always()
         shell: pwsh
         run: |
           .\erp-frontend\scripts\cleanup-playwright-webkit.ps1
       ```
     - A largo plazo: actualizar Playwright cuando se valide una versión estable sin la regresión.
7. ✅ **Advertencia `Cannot find control with name: 'acctCode'`** en `sale-reserve-invoices-form` — no se reproduce con la implementación actual (UDFs usan `[formControl]` sobre `customFields`, no `formControlName` en la fila).
8. ✅ **Archivos temporales de DT.10 eliminados** (`scripts/add_posting_date.py`, `apply_dt10_dtos.py`, `dt10-phase1-schema.js`, `dt10_backfill.sql`, `tmp_check_tenant.js`).
9. ✅ **Reconstrucción frontend de `special-prices`** — completada.
10. **Features de negocio** (por orden de madurez operativa):
    - ✅ Restricción por almacén por usuario (F2.3).
    - ✅ Bulk import de partners y stock inicial (F3.4).
    - CRM básico (F5.4).
    - Facturación electrónica SIN Bolivia (F5.1).
    - Módulo contable completo (F6) — estados financieros, cierre, activos fijos, nómina.

---

## 7. Cómo mantener actualizada esta guía

Cada vez que se introduzca, modifique o retire una **convención transversal**, actualizar este archivo. Si el cambio es específico de backend o frontend, actualizar también:

- Backend: `backend-erp/TECH_DEBT.md` o `backend-erp/docs/TYPE_SAFETY.md`.
- Frontend: `erp-frontend/AGENTS.md` o `erp-frontend/docs/monorepo/AGENTS.md`.

La meta es que ningún agente futuro tenga que adivinar restricciones que ya fueron aprendidas en sesiones anteriores.
