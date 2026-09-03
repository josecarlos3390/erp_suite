# Guía de implementación — Configuración y parametrización del ERP

> Fecha: 2026-09-05 · Aplica a cualquier tenant nuevo o existente que se quiera dejar operativo.
> Objetivo: **orden canónico de configuración** para que, al usar el ERP, no aparezcan errores
> de "falta configurar o crear algo". Se apoya en el orden del seed (`seedTenantData`) y en el
> nuevo modelo de **contabilidad opcional por tenant** (`accountingEnabled`).
> Referencia técnica del flag: `docs/plans/plan-contabilidad-opcional.md`.

---

## 0. Lo primero: definir el perfil del cliente

| Perfil | Contabilidad | Qué necesita sí o sí |
|--------|--------------|----------------------|
| **A — Contabilidad completa** | `accountingEnabled = true` | Plan de cuentas → gestión y períodos → series → maestros → parametrización |
| **B — Solo comercial / inventario** | `accountingEnabled = false` | **NO** plan de cuentas, mappings ni períodos; **SÍ** gestión (año fiscal) para las series, maestros e impuestos |

El perfil se decide en el **alta del tenant** (panel superadmin → switch "Contabilización")
o después, en **Parametrización → Contabilidad** del tenant activo.

> Regla de oro: el flag es **progresivo**.
> - B → A: se habilita contabilidad y se ejecuta "Generar Plan de Cuentas" + gestión/períodos.
>   Los documentos anteriores no generan asientos retroactivos.
> - A → B: solo se permite si el tenant **no tiene asientos** (409 si los tiene).

---

## Fase 0 — Alta del tenant (panel superadmin)

| # | Paso | Dónde | Verificación |
|---|------|-------|--------------|
| 0.1 | Crear tenant: slug, nombre, plan (SHARED/DEDICATED), **país** (BO = plan oficial; otro país = plan universal), zona horaria, **switch contabilización**, usuario admin inicial | Panel superadmin (modal "Nuevo tenant") | Login con el usuario admin; `GET /tenants` lo lista |
| 0.2 | Completar **perfil fiscal de la empresa** (razón social, NIT, dirección, teléfono, logo…) — se usa en PDFs/facturas | Administración → Perfil de la empresa | `GET settings/company-profile` con datos |
| 0.3 | Verificar país/idioma/zona horaria/monedas | Administración → Parametrización | `GET /settings` |

> El alta por panel ejecuta el seed: moneda base, UoMs, sucursal PRIN, almacén ALM-01,
> grupo GEN, impuestos, condiciones de pago, lista LP-01, cliente/proveedor/artículo de
> prueba. **Con contabilidad activada** además siembra plan de cuentas + mappings + cuentas
> de mayor. Con contabilidad desactivada **no** siembra el bloque contable (se genera luego).

---

## Perfil A — Con contabilidad (secuencia estricta)

> El orden importa: cada paso desbloquea el siguiente. Los errores típicos se listan al final.

### Paso A.1 — Habilitar contabilidad + generar el plan de cuentas
1. En **Parametrización → Contabilidad**, toggle "Habilitar contabilización" en ON.
2. Ejecutar **"Generar Plan de Cuentas"** (botón en el mismo bloque).
   - Crea el **plan estándar del país** (BO → plan boliviano; otro país → plan universal),
     los **mapeos contables por defecto** y las **cuentas de mayor asignadas a los maestros**
     (grupos, almacenes, artículos, matrices artículo-almacén y partners sin cuenta).
3. Verificación: el bloque muestra "Plan de cuentas generado — Bolivia (BO) · N cuentas ·
   mapeos configurados". En `/accounts` (Plan de Cuentas) se navega la jerarquía.

> ⚠️ Si no se genera el plan y se confirma un documento: la determinación de cuentas
> fallará ("no se encontró cuenta…") — es el error más común al arrancar con contabilidad.

### Paso A.2 — Gestión contable: año fiscal + períodos
1. Crear el **Año Fiscal / gestión** (código, nombre, rango de fechas): Finanzas → Años Fiscales
   (backend: `POST /fiscal-years`).
2. Generar los **períodos contables** de la gestión (mensual / trimestral / anual):
   botón en el detalle de la gestión (`POST /fiscal-years/:id/generate-periods`).
3. Verificación: la gestión lista sus períodos ACTIVOS; la fecha de cada documento debe caer
   en un período activo.

> ⚠️ Con contabilidad habilitada y ≥1 gestión, todo asiento exige un **período activo** que
> cubra la fecha del documento. Sin períodos generados → 409 «No existe un período contable
> activo que cubra la fecha…». Si aún no hay gestión → modo libre (sin exigencia de período).

> Opcional avanzado: asiento de **apertura** con arrastre de saldos del ejercicio anterior
> (`POST /fiscal-years/:id/generate-opening-entry`), solo si existe gestión previa contabilizada.

### Paso A.3 — Series de numeración (exigen la gestión)
1. Crear la gestión (paso A.2) **antes** que las series: cada serie se liga a un año fiscal
   y su vigencia se deriva de la gestión.
2. Definir una **serie por tipo de documento** que la empresa emite: Administración → Series de
   numeración (26 tipos: 9 ventas, 10 compras, 5 inventario, 2 logística/producción).
3. Asignar la **serie por defecto por usuario** (pestaña Asignaciones).
4. Verificación: `GET /document-series/doc-types` lista los 26 tipos; al confirmar cualquier
   documento sin serie → 400 «Defina primero una serie de numeración para [TIPO]».

> ⚠️ **Toda la operación depende de este paso**: sin series no se puede registrar ningún
> documento (venta, compra, inventario). Es el primer "bloqueante" operativo real.

### Paso A.4 — Datos maestros comerciales (orden del seed)
Orden sugerido (coincide con `seedTenantData`):

| # | Maestro | Pantalla | Notas |
|---|---------|----------|-------|
| A.4.1 | **Sucursales** | Datos Maestros → Sucursales | Crear las reales; la sucursal principal con almacén por defecto |
| A.4.2 | **Almacenes** | Inventario → Almacenes | Con cuentas de mayor por defecto (si se crearon antes del plan, "Completar/regenerar" las asigna) |
| A.4.3 | **Monedas** | Tesorería → Monedas / Parametrización | Moneda base y secundaria definidas en Parametrización |
| A.4.4 | **Condiciones de pago** | Administración → Condiciones de Pago | Contado + crédito (15/30) si aplica |
| A.4.5 | **Indicadores de impuesto** | Administración → Indicadores de Impuesto | BO: IVA-13 / IVA-0 (necesarios para facturar aunque sea solo comercial) |
| A.4.6 | **Grupos de artículos** | Datos Maestros → Catálogo → Grupos de Artículos | Con cuentas de mayor (ingreso/costo/inventario) si hay contabilidad |
| A.4.7 | **Listas de precios** | Catálogo Comercial → Listas de Precio | Moneda + vigencia |
| A.4.8 | **Unidades de medida + conversiones** | Catálogo Comercial → UoM | Sobre todo si hay artículos por unidad/caja/kg |
| A.4.9 | **Partners** (clientes/proveedores) | Datos Maestros → Partners | Pestaña **Contabilidad**: cuentas CxC/CxP/anticipos (la generación del plan asigna las por defecto a los que no las tienen) |
| A.4.10 | **Artículos** | Inventario → Artículos | Precio/costo, impuesto, cuentas (pestaña Almacenes y cuentas / matriz artículo-almacén) |

> Opcionales según necesidad: empleados/vendedores, proyectos, dimensiones, motivos de
> devolución/NC, reglas de alertas y aprobaciones.

### Paso A.5 — Parametrización fina y usuarios
| # | Paso | Dónde |
|---|------|-------|
| A.5.1 | Nivel de determinación de cuentas (Artículo / Grupo / Almacén) y cuentas de diferencia de cambio | Parametrización → Contabilidad |
| A.5.2 | Roles y permisos (ADMIN, FINANCIERA, LOGISTICA…) | Administración → Roles / Permisos |
| A.5.3 | Usuarios con sucursal/almacén por defecto y **serie por defecto por tipo** | Datos Maestros → Usuarios + Series → Asignaciones |
| A.5.4 | **Prueba end-to-end**: crear 1 documento por familia (venta, compra, stock) y validar que confirma y genera su asiento | Pantallas de documentos + Finanzas → Asientos Contables |

### Checklist A (verificación final)
- [ ] Parametrización: contabilidad ON, país correcto, monedas, zona horaria.
- [ ] Plan de cuentas generado (N cuentas + mappings) y navegable en /accounts.
- [ ] Año fiscal con períodos generados (estado ACTIVO que cubre el año).
- [ ] Series creadas para los tipos que se usan + asignación por usuario.
- [ ] Perfil de empresa completo (NIT/razón social) — usado por PDFs/facturas.
- [ ] Sucursal principal + almacén por defecto asignados al usuario admin.
- [ ] Impuestos (IVA), condiciones de pago, lista de precios, UoMs creados.
- [ ] Prueba E2E: documento → asiento automático POSTED sin errores de cuentas.

---

## Perfil B — Solo comercial / inventario (sin contabilidad)

**Qué NO se hace** (el menú ya lo oculta con el flag en OFF):
- Plan de cuentas, mappings, cuentas de mayor (el motor no las pide).
- Períodos contables (no hay asientos; la validación de período nunca corre).
- Asientos Contables, Activos Fijos, Extractos/Reconciliaciones (ocultos en el menú;
  sus endpoints responderían 409 si se invocan directo).

**Qué SÍ se hace:**

| # | Paso | Dónde |
|---|------|-------|
| B.1 | Año Fiscal (gestión) — **sigue siendo necesario** porque las series exigen gestión | Finanzas → Años Fiscales (crear; **no hace falta generar períodos**) |
| B.2 | Series de numeración + asignación por usuario (igual que A.3) | Administración → Series de numeración |
| B.3 | Maestros comerciales: sucursales, almacenes, monedas, condiciones de pago, **indicadores de impuesto** (se factura igual), grupos de artículos, listas de precios, UoMs, partners, artículos | Igual que A.4 (sin la pestaña contable obligatoria) |
| B.4 | Parametrización: país, moneda, zona horaria, perfil de empresa, usuarios/roles | Igual que A.5.1–A.5.3 |
| B.5 | **Prueba E2E comercial**: factura de venta/compra y movimientos de stock confirman **sin** pedir cuentas ni períodos | Pantallas de documentos |
| B.6 | **Pagos**: cobros a clientes y pagos a proveedores se registran normal (saldo de partner actualizado; **sin asiento**) | Tesorería → Pagos Recibidos/Efectuados |

### Checklist B (verificación final)
- [ ] Contabilidad OFF en Parametrización; menú sin Asientos/Plan de Cuentas/Activos Fijos/Extractos.
- [ ] Año fiscal creado (basta la gestión; sin períodos) y series definidas.
- [ ] Impuestos/condiciones/precios/UoMs/almacenes/partners/artículos creados.
- [ ] Prueba E2E: documentos y pagos confirman sin errores de cuentas ni períodos.
- [ ] Si mañana se habilita contabilidad: generar plan → crear gestión/períodos → seguir (progresivo).

---

## Anexo A — Mapa del seed → pasos manuales

Lo que crea `seedTenantData` al alta (con contabilidad ON) y su equivalente manual para
cuando se parte de cero o se replica en un cliente real:

| # seed | Crea | Paso manual equivalente |
|--------|------|------------------------|
| 0 | Flag `accountingEnabled` (SystemSettings) | Parametrización → Contabilidad (toggle) |
| 1 | Moneda base (BOB/USD) | Parametrización → Moneda base / Tesorería → Monedas |
| 2 | UoMs (UNIDAD/CAJA/KG/LT/MTR) | Catálogo Comercial → UoM |
| 3 | Sucursal principal PRIN | Datos Maestros → Sucursales |
| 4 | Almacén principal ALM-01 (default de la sucursal) | Inventario → Almacenes |
| 5 | Grupo de artículos GEN | Grupos de Artículos |
| 6 | Indicadores de impuesto (BO: IVA-13/IVA-0) | Administración → Indicadores de Impuesto |
| 7 | Condiciones de pago (Contado/Crédito 15/30) | Administración → Condiciones de Pago |
| 8 | Lista de precios LP-01 | Catálogo Comercial → Listas de Precio |
| 9 | Cliente de prueba | Datos Maestros → Partners (CLIENTE) |
| 10 | Proveedor de prueba | Datos Maestros → Partners (PROVEEDOR) |
| 11 | Artículo de prueba (con impuesto/precios) | Inventario → Artículos |
| 12 | Matriz artículo-almacén | Artículo → Almacenes y cuentas |
| 13 (solo contabilidad) | Plan de cuentas + mappings + cuentas de mayor en maestros | Parametrización → Contabilidad → **Generar Plan de Cuentas** |

> **Con contabilidad OFF** los pasos 13 del seed se omiten; la gestión (año fiscal) y las
> series se crean por pantalla igual que en los perfiles A/B (no son parte del seed).

---

## Anexo B — Errores típicos → causa → solución

| Error al usar el ERP | Causa probable | Solución |
|----------------------|----------------|----------|
| 400 «Defina primero una serie de numeración para X» | Falta la serie del tipo X (o no cubre la fecha) | Administración → Series de numeración (ligada a la gestión vigente) |
| 409 «No existe un período contable activo que cubra la fecha…» | Gestión sin períodos o documento fuera del rango | Generar períodos; ajustar fecha del documento |
| «No se encontró cuenta…» al confirmar | Plan no generado o cuenta sin asignar (artículo/grupo/mapping) | Generar plan de cuentas; revisar pestaña contable del maestro |
| 409 «La contabilización está deshabilitada…» | Operación contable en tenant sin contabilidad | Habilitar contabilidad (solo si el cliente la necesita) |
| Factura sin impuesto/IVA | Falta indicador de impuesto o no está en el artículo/partner | Administración → Indicadores de Impuesto + maestro del artículo |
| PDF sin razón social/NIT | Perfil de empresa incompleto | Administración → Perfil de la empresa |
| Usuario no ve documentos de su almacén | Restricción por almacén sin asignar sucursal/almacén al usuario | Usuarios → sucursal/almacén por defecto |
| Stock con costo cero / sin matriz | Artículo sin costo o sin matriz artículo-almacén | Costear el artículo; crear matriz (pestaña Almacenes y cuentas) |
