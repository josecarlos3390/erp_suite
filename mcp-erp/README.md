# erp-mcp — MCP del ERP (solo lectura)

Servidor [MCP](https://modelcontextprotocol.io) por **stdio** que expone el ERP de este
monorepo a cualquier cliente MCP (DSH, Claude Desktop, Cursor, Zed…): consultas de
negocio contra la API real y la **documentación canónica** del proyecto.

Está pensado para que un agente pueda responder preguntas como *«¿cuadra el asiento de
este cobro?»*, *«¿qué stock tiene este artículo y por qué almacén?»*, *«¿por qué el
documento salió con este correlativo?»* o *«¿qué reglas tiene este ERP para el
frontend?»* **sin acceso directo a la base de datos** y sin copiar documentación al
prompt.

## Garantías de seguridad

- **Solo lectura por construcción.** La única petición que no es `GET` es el login, y
  toda ruta pasa por una **lista blanca** (`src/erp-client.ts`): un endpoint de escritura
  no se puede invocar ni por error (un test lo verifica).
- **Sin secretos en el repositorio.** Las credenciales se leen del entorno; el MCP no
  escribe nada en disco ni guarda tokens más allá del proceso.
- **Recorte de contexto.** Los listados se proyectan a las columnas útiles y se limitan a
  `ERP_MAX_ROWS` filas (default 25); las lecturas de documentación se limitan a 40 000
  caracteres por llamada.

## Instalación y uso

```bash
cd mcp-erp
npm install
npm run build
npm test              # 16 tests con `node:test` y un fetch falso (sin red)
npm run smoke         # habla MCP por stdio contra la API de desarrollo (lecturas reales)
npm run validate:overlay   # valida el overlay de DSH (sintaxis + esquema esperado)
```

Variables de entorno:

| Variable | Default | Para qué |
|---|---|---|
| `ERP_API_URL` | `http://localhost:3001` | URL base de la API del ERP |
| `ERP_TENANT_SLUG` | `default` | Tenant con el que se autentica |
| `ERP_USERNAME` / `ERP_PASSWORD` | — | Credenciales de la API (**sin ellas solo funciona `erp_project_docs`**) |
| `ERP_TIMEOUT_MS` | `20000` | Timeout por petición |
| `ERP_MAX_ROWS` | `25` (máx 200) | Tope de filas que devuelve cualquier listado |
| `ERP_PROJECT_ROOT` | raíz del monorepo | Raíz para leer la documentación |

```bash
# Arranque directo (habla MCP por stdin/stdout)
ERP_USERNAME=admin ERP_PASSWORD=… node dist/index.js
```

## Herramientas

| Herramienta | Qué resuelve |
|---|---|
| `erp_health` | Estado del backend (Prisma/memoria/disco) y sesión actual (usuario, tenant) |
| `erp_list_documents` | Lista por tipo (`sale-invoices`, `purchase-orders`, `incoming-payments`, `items`, `partners`, `accounts`, `journal-entries`, `batches`…) con filtros de texto, estado, fechas y socio |
| `erp_get_document` | Un documento por id **y su asiento contable** con el chequeo de cuadre (débitos = créditos) |
| `erp_journal_entry` | Asiento por id con líneas proyectadas y cuadre |
| `erp_item_stock` | Stock por almacén de un artículo (por id o código) y, opcionalmente, su kardex |
| `erp_low_stock` | Artículos por debajo del mínimo |
| `erp_trial_balance` | Balance de sumas y saldos por rango de fechas |
| `erp_account_ledger` | Libro mayor de una cuenta (por id o código), con el socio de cada línea |
| `erp_partner_statement` | Saldo y transacciones de un cliente/proveedor |
| `erp_document_series` | Series con prefijo y próximo correlativo (+ vista previa por tipo) |
| `erp_withholding_taxes` | Tipos de retención con su tasa y **sus dos cuentas** (pasivo cuando retenemos, activo cuando nos retienen) |
| `erp_report` | Cualquier reporte de solo lectura por nombre técnico (`trial-balance`, `stock-valuation`, `aging`, …) |
| `erp_project_docs` | Documentación canónica del monorepo (protocolo, guías, auditoría, guía de asientos, runbook, skills) con paginación y búsqueda de texto |

## Conectarlo a DSH

DSH carga MCP por overlays de Cordis. El repo incluye un ejemplo listo:
`mcp-erp/dsh-mcp-erp.cordis.yml`.

```bash
# desde la raíz del monorepo (ajusta la ruta si tu checkout está en otro sitio)
dsh web --patch "$PWD/mcp-erp/dsh-mcp-erp.cordis.yml"
```

Las herramientas aparecen como `mcp__erp__erp_health`, `mcp__erp__erp_get_document`, etc.
Hay que **abrir una sesión nueva** (no hace falta reiniciar el host) y esperar a que la
detección inicial termine antes de usar las herramientas.

## Conectarlo a otros clientes

Cualquier cliente que acepte servidores MCP por stdio sirve; el formato es el habitual
(`command` + `args` + `env`). Ejemplo de bloque para un cliente tipo Claude Desktop:

```json
{
  "mcpServers": {
    "erp": {
      "command": "node",
      "args": ["D:/ProyectosPython/erp_suite/mcp-erp/dist/index.js"],
      "env": {
        "ERP_API_URL": "http://localhost:3001",
        "ERP_TENANT_SLUG": "default",
        "ERP_USERNAME": "admin",
        "ERP_PASSWORD": "…"
      }
    }
  }
}
```

## Estructura y verificación

```
mcp-erp/
├── src/
│   ├── index.ts        # servidor MCP: registra herramientas y arranca stdio
│   ├── config.ts       # entorno → configuración (con topes)
│   ├── erp-client.ts   # login + GET con lista blanca, timeout y reintento por 401
│   ├── tools.ts        # las herramientas de negocio (proyección y límites)
│   ├── docs.ts         # lectura con lista blanca de la documentación del proyecto
│   └── __tests__/      # node:test con fetch falso (sin red ni BD)
├── scripts/smoke.mjs   # smoke real: protocolo MCP por stdio + lecturas contra la API
├── scripts/validate-overlay.mjs  # valida el overlay de DSH
└── dsh-mcp-erp.cordis.yml  # overlay de ejemplo para `dsh web --patch`
```

- `npm test` cubre lo que puede romperse en silencio: la lista blanca de rutas (que un
  endpoint de escritura nunca pase), el tope de filas, la proyección de columnas, el
  **chequeo de cuadre del asiento** (incluido el caso descuadrado real de T91) y la
  lectura paginada/buscable de documentación.
- `npm run smoke` verifica el servidor **como lo usa un cliente**: `initialize`,
  `tools/list` y una batería de llamadas reales (salud, series, retenciones, facturas,
  asiento enlazado, balance, documentación y un id inválido). Requiere la API en marcha
  (`cd backend-erp && npm run start:prod`) y credenciales de desarrollo.
- Nota de layout: el smoke vive en `scripts/` y el `.gitignore` de la raíz ignora
  `scripts/` (por los scripts sueltos de migración), así que ese directorio tiene una
  excepción explícita en `.gitignore`.

## Fuera de alcance (a propósito)

- **No escribe nada**: ni documentos, ni asientos, ni configuración. Si algún día hace
  falta, debe ir en herramientas separadas con permiso explícito, confirmación humana y
  auditoría, no dentro de este paquete.
- **No habla con la base de datos**: solo API, con las credenciales de un usuario real,
  así que respeta tenant, permisos y reglas de negocio.
- **No sustituye a las guías**: `erp_project_docs` las sirve para leerlas, no las
  reinterpreta.
