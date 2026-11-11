# Objetivo: **todo se hace desde la interfaz**

> **Para pegar en la sesión nueva:**
> *«Lee `docs/plans/objetivo-todo-por-ui.md` (el objetivo y sus criterios de aceptación) y
> `docs/plans/traspaso-proxima-sesion.md` (el estado medido y los pasos). Empieza por el Paso 1: la
> prueba del Enter para decidir dónde está el defecto de la recepción desde el pedido.»*

---

## 1 · El objetivo, en una frase

**Una instalación limpia se pone en marcha, se opera y se audita ENTERAMENTE por la pantalla**: sin
`seed`, sin SQL, sin llamar al API a mano y sin tocar la base. El usuario es el que crea la empresa,
la configura, vende, compra, cobra y lee sus informes.

**La tesis que lo sostiene** (y que este ejercicio ya probó en las dos direcciones): *de cualquiera
de las formas hay que llegar al mismo resultado, y lo único que cambia es la figura.* Los mismos
números — importe, costo, IVA, asiento — se obtienen configurando por pantalla, y el mayor cuadra.

**Corolario duro**: si algo **solo** se puede hacer por API, por SQL o con el seed, **no está
terminado**, aunque el API funcione. El API es el **instrumento** que mide; la **pantalla** es el juez.

---

## 2 · Reglas del juego (no son preferencias, son el criterio)

1. **La UI es el juez.** Cada capacidad se demuestra **con un navegador**, como lo haría el usuario:
   Playwright sobre la app de desarrollo (`erp_db`), no un `curl` que después se declara «hecho».
2. **El API se usa como instrumento**, y se dice cuándo: para cargar existencia, para provocar un
   error conocido, para comparar. Un instrumento **no** sustituye la prueba de la pantalla.
3. **Nada de «cobertura» disfrazada de arreglo.** Si un caso no se puede resolver, se dice **qué**
   queda abierto y **dónde**, con el síntoma y la prueba que lo decide. Un verde que tapa un hueco es
   peor que un rojo.
4. **Se mide antes y después**, con el comando que lo produjo. Una mejora sin cifra se revierte.
5. **Los límites se declaran.** Deuda congelada, campos que faltan, pantallas que no existen: se
   escriben, no se esconden.
6. **Un arreglo, un commit.** Familias de defectos, un commit por sitio, para poder revertir uno sin
   deshacer los demás. Los gates no se saltan (`--no-verify` prohibido).
7. **Un diagnóstico que se corrige se escribe.** Los errores propios se documentan igual que los
   hallazgos (en este plan hay tres correcciones a diagnósticos del agente: T669, T677, T681).

---

## 3 · Criterios de aceptación (la lista que hay que poder marcar **por pantalla**)

Cada línea se marca **solo** si hay una corrida por navegador que la demuestre, y con su evidencia.

### A · Poner en marcha una instalación limpia

- [x] **Monedas** (`/currencies`): BOB local, USD del sistema.
- [x] **Tipo de cambio del día** (`/exchange-rates`): sin él, la app **bloquea** toda la operación
      (el guard lo dice con su `msg`).
- [x] **Datos fiscales** (`/company-profile`): razón social y NIT **impresos en la factura**.
- [x] **Plan de cuentas** (`/settings` → «Generar Plan de Cuentas»): 316 cuentas.
- [x] **Mapeos** (`/account-mappings` → «Restaurar Defaults»): 77.
- [x] **Gestión y períodos** (`/fiscal-years` → detalle → «Generar Períodos»): 2026 y 12 meses.
      *Sin período, cualquier documento contabilizado da 409.*
- [x] **Series, una por TIPO de documento** (`/document-series`): FVE, PV, ENT, ING, PC, REC, FVC.
- [x] **Sucursal y almacén** (bootstrap + asistente): el documento exige sucursal.
- [x] **Catálogo**: unidades, lista de precios, grupo, impuestos (maestros base del Centro), y
      **artículos** con UoM, impuesto y precio, marcados **venta / compra** según su uso.
- [x] **Terceros**: un cliente y un proveedor.

### B · Operar

- [x] **Venta**: factura manual por pantalla, con precio de lista → **asiento cuadrado**
      (factura 100,00 = 87,00 + IVA 13,00; asiento **143 = 143**: CxC 100 + costo 40 + IT 3 /
      ventas 87 + IVA 13 + inventario 40 + IT 3).
- [x] **Compra manual**: factura de compra con el **precio del proveedor tecleado** → **asiento
      cuadrado** (Inventario 104,40 + IVA crédito 15,60 = CxP 120,00).
- [x] **Pedido de compra** con precio (150,00), confirmando en el modal «Sí, registrar».
- [ ] **Recepción desde el pedido** ⛔ **bloqueada** (T681): el botón está habilitado y no dispara.
- [ ] **Factura desde la recepción** (hereda el precio del pedido).
- [ ] **Cobro** de una venta (tercero + documentos a cancelar).

### C · Auditar

- [x] **Balance de comprobación** por pantalla: **343,00 = 343,00** (y 686 = 686 con dos facturas).
- [x] **Informe de entregas sin cargo** (`/reports/free-of-charge`), con **importe y costo**, filtros
      de fecha, sucursal, motivo y **usuario**.
- [x] **Cuadre global** (`audit:reconcile`): **0 errores, 0 avisos**.
- [ ] **Estado de resultados** y **balance general** con datos del ejercicio completo.

### D · Que no vuelva a romperse

- [x] **Un solo motor de líneas** en las **8 familias** (`audit:document-lines-grid`: **8/8**, baseline
      **vacío**), con autoprueba.
- [x] **Migraciones desde cero** = esquema (`audit:migrations:check`: 97 / **0 sentencias**), con
      autoprueba que incluye «un comando roto sale rojo».
- [x] Los gates de la casa en verde: `audit:ci`, `gate:rapido`, Karma, `build`, `lint`, `format`,
      `audit:encoding`, `ci:local`.

---

## 4 · Dónde estamos frente a ese objetivo

| Bloque | Estado |
|---|---|
| **A · Poner en marcha** | ✅ **completo** y medido por pantalla (260 líneas del traspaso lo detallan) |
| **B · Operar** | 🟡 venta ✅ · compra manual ✅ · pedido ✅ · **recepción ⛔** · factura y cobro pendientes |
| **C · Auditar** | 🟡 balance ✅ · entregas sin cargo ✅ · cuadre ✅ · estados financieros pendientes |
| **D · Sostenibilidad** | ✅ gate de líneas 8/8 · migraciones 97/0 · todas las suites verdes |

**El bloqueo actual está acotado a una prueba de un minuto**: pulsar **Enter** en un campo de la
recepción que nace de un pedido. Si sale el modal, el defecto es la **barra de acciones**; si no, el
`(ngSubmit)` del formulario. Todo el detalle, con lo ya descartado midiendo, está en
`docs/plans/traspaso-proxima-sesion.md` §2.

---

## 5 · Cómo se demuestra (lo que ya está montado)

| Instrumento | Para qué |
|---|---|
| `erp-frontend/scripts/configurar-erp-por-ui.mjs` | 10 pasos idempotentes por pantalla; `--solo=<paso>`, `--dump=<ruta>` para sondear |
| Playwright (el repo) | los circuitos: `e2e/alta-sucursal-ui.spec.ts` (13/13, incluido el informe de entregas sin cargo) |
| `npm run audit:reconcile` | el cuadre contable (necesita BD) |
| `/reports/trial-balance` | la lectura del balance **como la ve el usuario** |
| `audit:document-lines-grid` + `audit:migrations:*` | que la estandarización y el esquema no vuelvan atrás |

**Regla de oro al cerrar cada punto**: la evidencia es **una captura o una cifra**, no una frase.
Si no se puede enseñar, no está hecho.
