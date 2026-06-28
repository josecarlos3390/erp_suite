# AGENTS.md — erp_suite (monorepo)

> **Última actualización:** 2026-06-24.  
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
npm test                 # Karma headless
npm run e2e              # Playwright
```

---

## 5. Estado actual del proyecto

### Completado recientemente
- ✅ Fase 1-6 de limpieza de tipos (`as any`, acumuladores, parámetros, casts, payloads `createFrom*`).
- ✅ Fase 8: extensión Prisma de aislamiento de tenant fortalecida (inyección recursiva).
- ✅ Fase 9: eliminación de diagnósticos temporales en `special-prices`.
- ✅ Fase 10: mitigación del aviso intermitente de worker process force exited.
- ✅ Fase 7: limpieza de `as any` en 20 archivos `.spec.ts` del backend.

### Métricas de referencia
| Métrica | Valor |
|---------|-------|
| `as any` en backend `src/` | **0** |
| `as any` en backend `*.spec.ts` | **0** |
| Backend tests | **114 suites / 958 passed** |
| Backend E2E | **10 suites / 51 passed** |
| Frontend tests | **608 passed** |
| Build backend | **0 errores** |
| Build frontend | **0 errores** |

---

## 6. Próximos pasos prioritarios

Ordenados por impacto y dependencias:

1. **Pruebas de carga y concurrencia multitenant** (k6/Locust) — pendiente en `ROADMAP.md`, `AUDIT_TRACKING.md` y `BUGS_RESUELTOS.md`.
2. **Validación obligatoria de `date`/`postingDate`** (DT.10) — quitar opcionalidad en Prisma/DTOs y eliminar defaults `null`.
3. **Baseline visual de formularios** con Playwright (`e2e/forms-reference-screenshots.spec.ts`).
4. **Completar E2E críticos** faltantes: ventas, compras, stock, pagos parciales, devoluciones, conciliación.
5. **Estabilizar runner Karma** del frontend o planificar migración progresiva.
6. **Reconstrucción frontend de `special-prices`** — E2E `special-price-quantity-breaks.e2e-spec.ts` y ajustes de listado.
7. **Features de negocio** (por orden de madurez operativa):
   - Restricción por almacén por usuario (F2.3).
   - Bulk import de partners y stock inicial (F3.4).
   - CRM básico (F5.4).
   - Facturación electrónica SIN Bolivia (F5.1).
   - Módulo contable completo (F6) — estados financieros, cierre, activos fijos, nómina.

---

## 7. Cómo mantener actualizada esta guía

Cada vez que se introduzca, modifique o retire una **convención transversal**, actualizar este archivo. Si el cambio es específico de backend o frontend, actualizar también:

- Backend: `backend-erp/TECH_DEBT.md` o `backend-erp/docs/TYPE_SAFETY.md`.
- Frontend: `erp-frontend/AGENTS.md` o `erp-frontend/docs/monorepo/AGENTS.md`.

La meta es que ningún agente futuro tenga que adivinar restricciones que ya fueron aprendidas en sesiones anteriores.
