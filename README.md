# erp_suite

ERP modular para el mercado boliviano, inspirado en SAP Business One. Monorepo físico con backend (NestJS + Prisma) y frontend (Angular + LUNA design system).

## Stack

| Capa | Tecnología | Versión |
|------|------------|---------|
| Backend | NestJS + TypeScript + Prisma | 11.0.1 / 5.7.3 / 6.19.2 |
| Frontend | Angular + TypeScript + Angular Material | 19.2.19 / ~5.7.2 |
| Base de datos | PostgreSQL | — |
| Tests | Jest (backend), Karma + Playwright (frontend) | — |

## Estructura

```
erp_suite/
├── backend-erp/      # API REST NestJS (repo Git anidado)
├── erp-frontend/     # SPA Angular (repo Git anidado)
├── luna/             # Componentes standalone del design system
├── docs/             # Documentación del proyecto
│   ├── guides/       # Guías canónicas de dominio
│   ├── plans/        # Planes de trabajo activos
│   ├── reference/    # Análisis y referencias técnicas
│   └── archive/      # Informes históricos completados
├── AGENTS.md         # Reglas de entrada para agentes
├── FRONTEND_GUIDE.md # Guía canónica frontend
├── BACKEND_GUIDE.md  # Guía canónica backend
├── ROADMAP.md        # Hoja de ruta
└── AUDIT.md          # Auditoría y tracking
```

## Documentación canónica

Antes de trabajar en código, lee la guía correspondiente:

- [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) — Angular, LUNA, OnPush, formularios, listados.
- [BACKEND_GUIDE.md](./BACKEND_GUIDE.md) — NestJS, Prisma, DTOs, seguridad de tipos, testing.
- [ROADMAP.md](./ROADMAP.md) — fases, prioridades y criterios de aceptación.
- [AUDIT.md](./AUDIT.md) — hallazgos, fixes y métricas.
- [AGENTS.md](./AGENTS.md) — protocolo de inicio de trabajo y reglas transversales.

## Levantar el proyecto

> Cada subproyecto tiene su propio `package.json` y se ejecuta desde su carpeta.

### Backend

```bash
cd backend-erp
npm install              # también ejecuta prisma generate
npm run start:dev        # watch mode en http://localhost:3000
```

### Frontend

```bash
cd erp-frontend
npm install
npm start                # ng serve
```

## Tests

### Backend

```bash
cd backend-erp
npm run build
npm run lint
npm test                 # 118 suites / 1018 tests
npm run test:e2e         # 11 suites / 57 tests
```

### Frontend

```bash
cd erp-frontend
npm run build
npm run lint
npm test -- --watch=false --browsers=ChromeHeadless   # 1172 tests
npm run e2e              # 184 escenarios E2E
```

## Comandos útiles

```bash
# Backend
npx prisma migrate dev --name <nombre>
npx prisma db seed

# Frontend
npm run generate-types   # sincroniza tipos Prisma desde backend
```

## Convenciones

- Componentes Angular standalone; sin `NgModule`s de dominio.
- Change detection `OnPush` en formularios de documentos.
- Cero `as any` en código de producción (`src/**/*.ts` sin `.spec`).
- Cada modelo Prisma incluye `tenantId` + `@@index([tenantId])`.

---

*Para detalles de implementación, patrones de código y decisiones de arquitectura, consultar las guías canónicas enlazadas arriba.*
