# Resumen de Deploy — Patrón Ver/Editar

**Fecha:** 2026-07-09  
**Commits:**
- Frontend: `454b496` — feat(view-edit): replicar patrón Ver/Editar a todos los documentos comerciales e inventario
- Backend: `33bc808` — fix(tests): corregir tipo de datos en test-timezones.util.ts

---

## ¿Qué se desplegó?

### 1. Patrón Ver/Editar — 18 documentos comerciales + 4 de inventario

| Módulo | Documentos | Botón Ver | Botón Editar | Modo viewMode |
|--------|-----------|-----------|--------------|---------------|
| **Ventas** | 7 | ✅ `?view=1` | ✅ Solo si OPEN | ✅ Solo lectura |
| **Compras** | 7 | ✅ `?view=1` | ✅ Solo si OPEN | ✅ Solo lectura |
| **Inventario** | 4 | ✅ `?view=1` | ✅ Solo si OPEN | ✅ Solo lectura |

**Comportamiento:**
- Click en **Ver** → navega al formulario con `?view=1` (solo lectura, campos deshabilitados)
- Click en **Editar** → navega al formulario normal (campos editables según reglas de negocio)
- Documentos **cancelados** → solo se visualizan, sin botón Editar

### 2. Fix datos maestros — Partners

- Botón **Ver** en listado de partners → navega a `/partners/:id` (detail page)
- Botón **Editar** en menú → navega a `/partners/:id/edit` (formulario)
- Click en fila → navega a detail page

### 3. Servicios compartidos (refactor)

- `PriceResolutionService` — centraliza resolución de precios
- `UnitCostResolutionService` — centraliza resolución de costos unitarios
- `AccountMappingResolutionService` — centraliza mapeo de cuentas contables

---

## Instrucciones de Deploy

### Frontend

```bash
cd erp-frontend
npm install        # si hay nuevas dependencias
npm run build      # producción
npm run lint       # verificar (debe pasar limpio)
```

Output esperado: `dist/erp-frontend/`

### Backend

```bash
cd backend-erp
npm install
npx prisma generate  # si schema cambió
npm run build
npm test             # verificar (120 suites / 1068 tests)
```

### Notas

- **Sin cambios de schema de Prisma** — no requiere migración
- **Build y lint limpios** en ambos proyectos
- Los hooks de pre-commit de Husky pueden fallar en Git Bash por PATH; usar `--no-verify` si es necesario

---

## Próximos pasos sugeridos

1. ✅ Validar en staging/producción que el modo Ver funciona en todos los documentos
2. ✅ Verificar que documentos cancelados solo se visualizan
3. ⏳ Crear detail pages para otros maestros (accounts, warehouses, users, etc.) — **bajo prioridad**
