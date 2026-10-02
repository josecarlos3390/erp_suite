# Plan de migración a Dokploy (autoalojado) — ERP Suite

> **Última actualización:** 2026-10-02.
> **Estado:** **propuesta**, sin nada ejecutado. Este documento es el plan; la ejecución es la
> **Fase 0** y necesita el OK del usuario.
> **Complementa:** `docs/plans/runbook-go-live.md` (procedimiento de despliegue vigente),
> `AGENTS.md` (estado del proyecto) y el §38 del plan del e-commerce (medios).

---

## 0. Qué se decidió y qué no

**Lo que pidió el usuario:** migrar a la **versión open source de Dokploy** en un VPS propio y, sobre
ella, **añadir** lo que dan las plataformas gestionadas: monitorización, backups automáticos y
alertas.

**Lo que este plan NO decide:** la región y el proveedor definitivos. Eso se elige con una medición
real en la Fase 0 (ver §4.1), porque la medición de latencia que hice desde el portátil **no es
concluyente** y así queda declarado.

**Regla de oro de esta migración:** cada fase se acepta con **los mismos gates que ya usamos** y se
puede **deshacer** sin perder datos. Nada se corta sin haber restaurado antes una copia.

---

## 1. Qué hay hoy (inventario medido en el repo, no supuesto)

| Pieza | Estado real medido | Consecuencia para la migración |
|---|---|---|
| **Backend** | `backend-erp/Dockerfile` (node:22-slim, multi-stage, `prisma generate` + `nest build`) y entrypoint `scripts/start-prod.sh`: `prisma migrate deploy` + SQL manuales con `--best-effort` + `node dist/main.js` | **Ya es desplegable en Docker tal cual**; Dokploy solo tiene que construir la imagen |
| **Compose** | `backend-erp/docker-compose.yml` — **escrito para "Oracle Cloud Always Free (VM ARM): backend + PostgreSQL en la misma VM, cero latencia app↔DB"** — y `backend-erp/docker-compose.neon.yml` (base **externa** + perfil `cloudflared` para HTTPS por túnel) | La Fase 0 **no parte de cero**: se reutiliza el compose; falta añadirle Traefik/dominios (lo pone Dokploy) y backups |
| **Frontend** | Angular 19 con **SSR** (`@angular/ssr`, `CommonEngine`), `node dist/erp-frontend/server/server.mjs` en **:4000**, headers de seguridad y CSP, `ALLOWED_HOST` | **No es estático**: en Dokploy es una app Node. **No tiene Dockerfile** ⇒ hay que escribirlo (entregable de Fase 0) |
| **`.angular/cache`** | Tenía **62,46 GB** de caché de build; liberados el 2026-10-02 | Construir en el VPS sin límite de disco es un riesgo real: el build se lleva GB |
| **Tienda** | Next 14 App Router, `sharp` ya en dependencias, `next.config.mjs` sin `output: 'standalone'`, hosts de imagen por `IMAGE_REMOTE_HOSTS` | Para Docker conviene `output: 'standalone'` (cambio de una línea) y un volumen para la caché de `next/image` |
| **Base de datos** | PostgreSQL **16** (local 16.6) + `prisma/manual/*.sql` (drift histórico) | Mantener **16** en el VPS: la paridad es lo que hace reproducible el `pg_dump`/restore |
| **Backups** | `npm run backup:db` → `pg_dump --format=c` **local**, retención 7 diarios + 4 semanales (`BACKUP_KEEP_DAILY`/`WEEKLY`). **No sube a ningún sitio** | Falta la capa externa: es justo lo que aporta Dokploy (destino S3-compatible + cron) |
| **Observabilidad** | El backend **ya expone** `GET /health` (Terminus: prisma, memoria, disco) y `GET /metrics` (Prometheus, `prom-client`), más Swagger en `/api` | No hay que inventar métricas: hay que **scrapearlas** y **alertar** |
| **CORS / hosts** | `FRONTEND_URL` obligatorio con `NODE_ENV=production`; el frontend **hornea** el API en `erp-frontend/src/environments/environment.prod.ts` (Vercel **no** lee variables para eso) | Cambiar de backend = **editar esa constante y reconstruir**. Es el paso más delicado del corte |
| **CI** | **No hay** `.github/workflows`: los gates corren en los **hooks de pre-push** locales | Dokploy despliega por webhook de Git; los gates siguen siendo locales (no cambia la disciplina actual) |
| **Datos** | Producción (Railway) tiene el catálogo con **137** artículos y sus tarjetas en R2; la base local tiene la misma huella | La migración se valida con la **huella de 199 tablas** del arnés E2E |

---

## 2. Arquitectura destino

```
                        Internet
                           │
                  ┌────────▼─────────┐
                  │   Cloudflare     │  DNS + proxy + caché estática (ya se usa para R2)
                  └────────┬─────────┘
                           │  80/443
   ┌───────────────────────▼───────────────────────────────────────┐
   │  VPS (São Paulo o Santiago) — Dokploy (open source, gratis)    │
   │  Docker Swarm + Traefik (TLS Let's Encrypt)                    │
   │                                                                │
   │  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐   │
   │  │ erp-frontend │  │  backend-erp  │  │  storefront (Next) │   │
   │  │ Angular SSR  │─▶│   NestJS      │◀─│  (Fase 2)          │   │
   │  │   :4000      │  │    :3000      │  │    :3000           │   │
   │  └──────────────┘  └───────┬───────┘  └────────────────────┘   │
   │                            │ red interna de Docker             │
   │                     ┌──────▼───────┐   ┌───────────────────┐   │
   │                     │ postgres:16  │   │ uptime-kuma       │   │
   │                     │  (volumen)   │   │ (alertas)         │   │
   │                     └──────┬───────┘   └───────────────────┘   │
   └────────────────────────────┼───────────────────────────────────┘
                                │  pg_dump programado (S3-compatible)
                       ┌────────▼─────────┐
                       │  Cloudflare R2   │  backups + fotos (ya pagado, egreso gratis)
                       └──────────────────┘
```

**Decisiones de arquitectura**

- **D1 — El panel y la carga en la misma máquina (Fase 0-1) y se separan cuando moleste.** Dokploy
  autoalojado corre UI + su Postgres + Redis + Traefik **en el mismo servidor** que tus apps; su
  propia documentación lo dice. Con 1-3 clientes eso está bien; si el panel empieza a competir, la
  salida natural es **Dokploy Cloud** ($4,50/mes por servidor) para mover el plano de control.
- **D2 — La base de datos se queda en el VPS (Docker), no gestionada.** Es lo que da cero latencia
  app↔DB y lo que el compose ya asume. Se acepta a cambio de **tres capas de backup** (§6).
- **D3 — La tienda se queda en Vercel en la Fase 1.** Es la cara pública, gana con el CDN y el
  optimizador de `next/image`, y no gana nada moviéndose antes de tiempo.
- **D4 — Nada de un VPS por cliente.** El ERP ya es **multi-empresa** (`tenantId`) y la tienda
  soporta **N dominios en un despliegue**: un VPS sirve a varios. Se escala por carga, no por
  cliente.
- **D5 — Cloudflare delante.** Ya se usa para R2: el DNS y el proxy los pone Cloudflare y Dokploy
  emite el certificado con Let's Encrypt.

---

## 3. Dimensionamiento y coste (números verificados el 2026-10-02)

**Mínimo de Dokploy:** 2 GB de RAM y 30 GB de disco, puertos 80/443/3000 libres
([instalación](https://docs.dokploy.com/docs/core/installation)).

**Lo que yo contrataría para tu caso:** **4 vCPU / 8 GB RAM / 160 GB NVMe**. El mínimo no basta para
tu realidad: el build del backend (`npm ci` + `prisma generate` + `nest build`) es pesado —recuerda
el contenedor de 1 GB que murió con `Reached heap limit` al sembrar— y en la misma máquina viven
Postgres, la API, el SSR y (Fase 2) Next.

| Concepto | Hoy | Con Dokploy |
|---|---|---|
| Vercel | Hobby **gratis pero solo uso no comercial**; Pro **$20/usuario/mes** ([doc](https://vercel.com/docs/plans/hobby)) | $0 (tienda en Vercel Hobby **solo mientras sea de pruebas**) o incluido en el VPS |
| Railway | Hobby **$5/mes** + uso (memoria $10/GB-mes, CPU $20/vCPU-mes, egreso $0.05/GB) ([precios](https://railway.com/pricing)) | $0 |
| VPS | — | **~$20-24/mes** (2 vCPU/4 GB) a **~$40-48/mes** (4 vCPU/8 GB) en São Paulo/Santiago |
| Dokploy | — | **$0** (open source) o **$4,50/mes por servidor** en Cloud ([doc](https://docs.dokploy.com/docs/core/cloud)) |
| R2 (fotos + backups) | ~$0 | ~$0 (egreso gratis) |

**Conclusión honesta de coste:** con **1 cliente y Vercel Hobby**, migrar **cuesta más** ($20-48/mes
frente a ~$5-10). El punto de cruce llega cuando la tienda sea comercial (Vercel Pro: **$20/usuario**)
o cuando Railway crezca por uso. **No migres por ahorro con un cliente: migra por control, latencia y
coste plano.**

---

## 4. Fases

### Fase 0 — Ensayo medible (reversible, ~1 fin de semana)

**Objetivo:** decidir región y proveedor **con datos** y validar que el stack levanta, sin tocar
producción.

| Paso | Qué se hace | Cómo se verifica |
|---|---|---|
| 0.1 | Contratar VPS **pequeño** (2 vCPU/4 GB) en São Paulo **y** probar también Santiago si el proveedor las tiene (Vultr tiene las dos) | — |
| 0.2 | Endurecer el SO **antes** de instalar: SSH solo con clave, `ufw` con 22/80/443, el puerto **3000 cerrado** al público (al panel se entra por túnel SSH), actualizaciones de seguridad automáticas | `nmap` desde fuera: solo 22/80/443 |
| 0.3 | Instalar Dokploy (`curl -sSL https://dokploy.com/install.sh \| sh`) y **activar 2FA** | Panel accesible, 2FA activo |
| 0.4 | Traer una **copia** de la base de producción (volcado, no conexión) y restaurarla en el Postgres **16** del VPS | `select count(*)` de `Item` = **137** y huella del arnés idéntica |
| 0.5 | Desplegar el **backend** desde el repo con el compose existente; añadir el Dockerfile que falta para el **frontend SSR** | `/health` **200** con `prisma:up`, `/metrics` responde, Swagger en `/api` |
| 0.6 | **Medir latencia de verdad** (lo que desde el portátil no pude): desde el propio VPS y, sobre todo, **desde el navegador del usuario** | Comparar contra el baseline de hoy: `/health` de Railway desde su PC = **589 ms** (conexión 63 ms). Se anota p50/p95 de 20 peticiones desde el ERP real |
| 0.7 | Correr **los gates contra el VPS**: arnés E2E de la tienda contra el backend nuevo, y el ciclo de ventas de punta a punta | Huella de **199 tablas** idéntica antes/después; suite funcional en verde |
| 0.8 | **Decidir** región y tamaño con la tabla de la 0.6 delante | Documento con la medición |

**Reversión:** borrar el VPS. Coste hundido: unos días de VPS.

### Fase 1 — El ERP se muda (ventana de mantenimiento)

**Alcance:** backend + Postgres + frontend SSR al VPS. **La tienda se queda en Vercel.**

1. Volcado final de producción + restauración en el VPS **verificada** (§6).
2. Dominios: `api.<dominio>` y `app.<dominio>` con certificado de Let's Encrypt. **Ojo:** el
   frontend SSR necesita `ALLOWED_HOST` con el host nuevo y la CSP `connect-src` apuntando al API
   nuevo.
3. **Reconstruir el frontend** con `environment.prod.ts` → `apiUrl` del VPS (Vercel no lee variables
   para eso: está horneado). Es el paso que más se olvida.
4. `FRONTEND_URL` del backend → el host nuevo (si no, **CORS** y el login fallan en producción).
5. TTL del DNS a **300 s** desde 24 h antes; el corte se hace cambiando el registro.
6. **Railway se queda encendido** como respaldo una o dos semanas (mismo volcado, sin tráfico).

**Criterio de aceptación (todo medido):** `/health` 200 · login real · ciclo de venta completo
(pedido web → cobro → reserva + pago → entrega) · suite del backend en verde · arnés E2E con huella
idéntica · p95 del API **menor** que el baseline de Railway · la tienda de Vercel sigue funcionando
contra el API nuevo.

**Reversión:** devolver el DNS a Railway (TTL 300 s ⇒ minutos). Nada se pierde: la base de Railway
sigue intacta.

### Fase 2 — La tienda también (opcional)

Cambio de una línea (`output: 'standalone'` en `next.config.mjs`) + Dockerfile + volumen para la
caché de `next/image` + las variables del canal. Se gana: un solo sitio que pagar y administrar, y la
tienda deja de salir a internet para hablar con el API (red interna). Se pierde: el CDN de Vercel —
se compensa con Cloudflare delante, que ya se paga.

### Fase 3 — Alta disponibilidad de verdad (cuando un cliente la exija)

Dos nodos con **Dokploy sobre servidores remotos** (un panel, varios servidores) y la base con
réplica o gestionada. **Esto ya no son $20/mes** y no se hace hasta que alguien lo pida por contrato.

---

## 5. Inventario de variables (nombres, nunca valores)

| Servicio | Variables | Origen |
|---|---|---|
| **backend-erp** | `DATABASE_URL`, `SHADOW_DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `PORT`, `NODE_ENV`, `THROTTLE_LIMIT_SHARED/DEDICATED/PUBLIC`, `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD_HASH`, `BULK_IMPORT_SAFE_MODE`, `HEALTH_MEMORY_THRESHOLD_PERCENT`, `HEALTH_DISK_THRESHOLD_PERCENT` | compose actual + runbook |
| **backend-erp (medios y correo)** | `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_BASE`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`, `STOREFRONT_PUBLIC_URL` | `.env` (gitignored) y variables de Railway |
| **frontend (SSR)** | `PORT=4000`, `ALLOWED_HOST`, `NODE_ENV` **y el API horneado en `environment.prod.ts`** | runbook §4 |
| **storefront** | `STOREFRONT_API_KEY`, `STOREFRONT_CHANNELS`, `IMAGE_REMOTE_HOSTS`, `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_DESCRIPTION`, `STOREFRONT_SHOW_PLACEHOLDERS` | proyecto de Vercel + `.env.example` |
| **backups** | `POSTGRES_PASSWORD`, credenciales de R2 para el destino S3-compatible | nuevo |

**Regla:** los secretos se cargan **en el panel de Dokploy**, nunca en el repo; y como el bucket de
R2 ya está en juego, la pareja S3 y el token `cfat_…` que se compartieron por chat se **rotan** antes
de la Fase 1.

---

## 6. Backups: tres capas y una prueba

| Capa | Qué | Frecuencia | Retención |
|---|---|---|---|
| **1. Lógica (la importante)** | `pg_dump` programado por **Dokploy** con destino **S3-compatible** → **Cloudflare R2** ([backups](https://mintlify.wiki/Dokploy/dokploy/databases/backups)) | diaria, 03:00 hora de Bolivia | 7 diarios + 4 semanales |
| **2. Del sistema** | Snapshot del VPS del proveedor | semanal (y antes de cada actualización grande) | 2-4 |
| **3. Antes de tocar** | `npm run backup:db` (ya existe) guardado **fuera** del VPS | manual, antes de migraciones | indefinida |

**La prueba que convierte "hay backup" en "el backup restaura":** una vez al mes, restaurar el último
`pg_dump` en una base descartable y comparar la **huella de las 199 tablas** con la del arnés
(`storefront/e2e/harness/db-snapshot.mjs`, que ya hace exactamente eso). Sin esa prueba, el backup es
una promesa.

**Dos detalles medidos que hay que respetar:**
- **Versión mayor de `pg_dump` = versión del servidor.** Ya nos mordió: el cliente de PostgreSQL 18
  volcaba el 16 y la restauración moría con `SET transaction_timeout`. El VPS va con **16** y el
  arnés ya resuelve las herramientas por versión, pero hay que **instalar los clientes**.
- **El respaldo de la app no reemplaza al del sistema:** el programado cubre la corrupción lógica; el
  snapshot cubre el disco muerto.

---

## 7. Monitorización, alertas y logs

**Lo que ya existe y hay que aprovechar:** `GET /health` (prisma, memoria, disco) y `GET /metrics`
(Prometheus) — no hay que instrumentar nada nuevo.

| Capa | Herramienta | Qué vigila |
|---|---|---|
| Contenedores y VPS | **Dokploy Monitoring** (incluido) | CPU, memoria, disco, reinicios |
| Disponibilidad | **Uptime Kuma** (contenedor en el VPS) + **un chequeo externo gratis** (UptimeRobot/BetterStack) | `/health` cada minuto, home de la tienda, certificado TLS |
| Métricas de aplicación | **Prometheus + Grafana** (opcional, Fase 2) | p95 por endpoint, 5xx por empresa, `http_requests_total` |
| Logs | stdout del contenedor en Dokploy (retención limitada) | errores del motor contable, `ConflictException` de períodos |
| Alertas | Notificaciones de Dokploy + Uptime Kuma → correo/Telegram | caída, disco > 85 %, memoria > 90 %, backup fallido |

**Por qué dos monitores:** el que vive en el VPS **no puede avisar** de que el VPS se cayó. Uptime
Kuma da el detalle; el chequeo externo es el que grita cuando no hay nada que grite.

**Umbrales:** el backend ya trae `HEALTH_MEMORY_THRESHOLD_PERCENT` y `HEALTH_DISK_THRESHOLD_PERCENT`
(90 % por defecto) — con el disco, que fue justo lo que provocó un `/health` en 503, conviene bajarlos
a **85 %** y alertar.

---

## 8. Seguridad y endurecimiento

- SSH **solo con clave**, contraseñas deshabilitadas, `PermitRootLogin no`, usuario con `sudo`.
- Firewall: **22, 80, 443** y nada más. El **3000 del panel cerrado** (túnel SSH) y el 5432 **jamás**
  expuesto.
- **2FA** en Dokploy; el panel no se publica en un subdominio adivinable.
- Actualizaciones de seguridad automáticas del SO y ventana mensual para Docker/Dokploy.
- Cloudflare delante (proxy) + `FRONTEND_URL`/CSP bien puestos, o el navegador bloqueará las llamadas.
- Rotación de secretos **antes** del corte (los de R2 y Resend ya se compartieron por chat).
- Nada de `--accept-data-loss` ni resets en producción: los resets son de local (regla ya escrita).

---

## 9. Runbook de corte (Fase 1)

1. **24 h antes:** TTL del DNS a 300 s; rotar secretos; avisar al cliente de la ventana.
2. **Ventana:** bloquear escritura (o mejor: copiar el volcado final con la app de Railway aún
   arriba), restaurar en el VPS y **verificar la huella**.
3. Desplegar backend y frontend en el VPS con la configuración nueva; verificar `/health`, `/metrics`
   y login **contra el host nuevo**.
4. Cambiar el DNS y esperar la propagación; verificar por `curl` **y en el navegador**.
5. Reconstruir/redesplegar la tienda de Vercel apuntando al API nuevo (si aplica) y probar una compra
   real de punta a punta.
6. Dejar Railway **encendido y sin tráfico** 1-2 semanas: es el botón de deshacer.
7. Documentar el corte en `runbook-go-live.md` (hosts, versiones, mediciones) y **actualizar la
   huella** de referencia.

**Rollback:** DNS de vuelta a Railway (minutos, con TTL 300 s) y, si hubo escrituras nuevas en el
VPS, restaurar el volcado del VPS sobre la base de Railway **antes** de devolver el tráfico.

---

## 10. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Punto único de fallo** (API + base + frontend + panel en una máquina) | Media | Alto | Snapshot + backup a R2 + Railway en caliente durante el corte; HA real en Fase 3 |
| Build pesado tumba el VPS (OOM) | Media | Alto | 8 GB, **build server remoto** de Dokploy o construir la imagen fuera y desplegar por registro |
| Disco lleno (Postgres + imágenes + logs + caché de build) | **Alta** (ya pasó) | Alto | Alertas al 85 %, retención de logs, caché de build en un volumen con limpieza, snapshots |
| El panel compite por recursos con las apps | Media | Medio | Separar a Dokploy Cloud ($4,50/mes) si molesta |
| Olvidar el `apiUrl` horneado del frontend | **Alta** | Alto | Está en el checklist del corte (paso 3) y se verifica en el bundle desplegado |
| CORS roto por `FRONTEND_URL` | Media | Alto | Verificación explícita con `curl -I` y login real |
| Restauración del backup no probada | Media | **Catastrófico** | Prueba mensual con la huella de 199 tablas: es un **criterio de aceptación**, no un extra |
| Pago internacional rechazado desde Bolivia | Media | Bajo | Probar la tarjeta antes de decidir proveedor; varios aceptan PayPal |
| Depender del panel (o de su actualización) para operar | Baja | Medio | Los `docker-compose` del repo siguen siendo el plan B: `docker compose up -d --build` a mano |

---

## 11. Checklist de aceptación (por fase)

**Fase 0**
- [ ] VPS endurecido: solo 22/80/443, SSH con clave, updates automáticas
- [ ] Dokploy instalado con **2FA**
- [ ] Copia de producción restaurada y **huella de 199 tablas idéntica**
- [ ] `/health` 200 y `/metrics` scrapeando
- [ ] Latencia p50/p95 medida **desde el navegador del usuario** y comparada con el baseline (589 ms)
- [ ] Gates E2E en verde contra el VPS
- [ ] Región y tamaño **decididos con la tabla delante**

**Fase 1**
- [ ] Volcado final + restauración verificada **antes** de tocar el DNS
- [ ] Backend, base y SSR arriba con TLS válido
- [ ] Frontend reconstruido con el `apiUrl` nuevo (verificado en el bundle)
- [ ] `FRONTEND_URL` y CORS verificados con login real
- [ ] Ciclo de venta completo medido de punta a punta
- [ ] Backup programado a R2 **corriendo** y **restaurado una vez** a mano
- [ ] Alertas activas (caída, disco 85 %, memoria 90 %, backup fallido)
- [ ] Railway intacto y accesible como rollback

**Fase 2**
- [ ] Tienda en el VPS con Cloudflare delante
- [ ] `next/image` funcionando con su volumen de caché
- [ ] Gate visual 17/17, a11y 20/20 y perf 6/6 contra el despliegue nuevo

---

## 12. Lo que NO entra en este plan

- **No se migra nada este mes**: sin dominio propio comprado, la Fase 1 no tiene sentido todavía (los
  certificados y las URLs canónicas necesitan dominio real). La Fase 0 **sí** se puede hacer ya con
  un subdominio de pruebas.
- **No se toca la huella de datos**: la migración es de infraestructura, no de esquema.
- **No se añade CI**: los gates siguen en los hooks de pre-push; Dokploy aporta el despliegue, no el
  control de calidad.
- **No se pasa el `apiUrl` a variable de entorno** en el frontend: sería el arreglo definitivo para
  no reconstruir en cada cambio de host, pero es un **incremento aparte** (con su medición y sus
  gates), no un efecto colateral de la migración.
- **No se promete alta disponibilidad** hasta la Fase 3: un VPS es un punto único de fallo y eso se
  dice antes, no después.

---

## 13. Alternativas evaluadas: Dokploy vs OpenShip (verificado 2026-10-02)

**Por qué esta sección existe:** antes de contratar nada hay que decidir **la plataforma**, y esa
decisión se toma con datos del repositorio, no con impresiones. El usuario preguntó por OpenShip.

### OpenShip — qué es (medido hoy)

| Dato | Valor |
|---|---|
| Repositorio | `oblien/openship` — «Self-hosted deployment platform» ([GitHub](https://github.com/oblien/openship)) |
| Licencia | **Apache-2.0**, con un matiz que ellos mismos documentan: el motor de correo (**iRedMail**) es **GPL** y viaja en varias distribuciones del panel **aunque no uses el correo** |
| Antigüedad | Creado el **2026-03-05** ⇒ **~7 meses** |
| Actividad | Último push **2026-10-02** (hoy); **14 341** estrellas, **1 280** forks, **141** issues abiertas |
| Cómo corre | Linux con Docker ⇒ **modo Compose**: Postgres + Redis + API + panel + **borde OpenResty en :80/:443**. El contenedor de la API **monta el socket de Docker del host** (su documentación avisa: solo en un host de confianza) |
| Interfaces | App de escritorio, panel web, CLI, SDK y **endpoint MCP** |

**Lo que trae y a nosotros nos sirve:** backups con políticas y **restauración** (retención por
defecto **7**, incrementales por bloques de 8 MiB, verificación por checksum, restauración de
Postgres **transaccional**) · **monitorización con coste medido** (~1,4 µs por petición, fuera del
camino de respuesta, IP con hash salado diario y **nunca persistida**) · **correo propio** (SMTP con
DKIM/SPF/DMARC) · **CDN** (HTTP/3, Brotli, purga) · **dominio gratis `*.opsh.io`** · despliegue de un
`docker-compose` **tal cual**.

**Lo que hay que mirar con lupa — y no lo digo por prejuicio, lo dicen sus documentos:**

1. **Su gate de release no está verde por su propia cuenta.** La auditoría de backups del
   2026-09-25 declara **cuatro errores de tipos preexistentes** en el SDK de Cloud y concluye
   literalmente que el gate completo **no puede considerarse verde** hasta resolverlos.
2. **El destino S3 no está probado contra un proveedor real:** su E2E de Docker «*does not exercise
   … a live S3 provider*». Es decir: **no verifiqué que sus backups puedan ir a nuestro R2**, y ellos
   tampoco lo garantizan por prueba.
3. **El respaldo pasa por su worker**, no va directo origen→destino: si el worker se cae a mitad, el
   backup no termina.
4. **Sin cifrado a nivel de aplicación** en reposo (hay que ponerlo en el destino).
5. **El dominio gratis `*.opsh.io` se sirve por su nube y llega a la caja por `:80` plano** (el TLS lo
   termina su borde) ⇒ tráfico **sin cifrar** entre su borde y el VPS. Para un ERP con login: **solo
   para el ensayo**, nunca con datos de cliente.
6. **Correo propio:** tienta para resolver de una vez el bloqueo de Resend, pero el servidor SMTP no
   es la parte difícil — lo difícil es la **reputación de la IP** (muchos proveedores bloquean el
   puerto 25 saliente, hace falta PTR y calentar la IP para que Gmail/Outlook no lo manden a spam).

### Comparación en los ejes que deciden **para nosotros**

| Eje | Dokploy | OpenShip |
|---|---|---|
| Madurez | Más recorrido y mucha más superficie de respuestas de terceros | **7 meses**, muy activo, documentación «en construcción» por su propio aviso |
| Encaje con nuestro repo | Compose + Dockerfile: directo | Compose + Dockerfile: **igual de directo** |
| Backups a nuestro R2 | **Verificado en su documentación** (destino S3-compatible) | Políticas mejores (incrementales), pero **S3 sin verificar** por su E2E |
| Monitorización | Métricas de contenedor | **Mejor**: analítica por petición, con coste medido y privacidad por diseño |
| Correo | No trae | **Sí** (con el coste de reputación y la licencia GPL del motor) |
| CDN | No trae (se pone Cloudflare delante) | **Integrado** |
| Dominio sin comprar | No | **`*.opsh.io`** (solo válido para el ensayo) |
| Superficie de seguridad | Panel + Docker del host | Panel + **socket de Docker montado**: host-privilegiado por diseño |

### Veredicto

- **Para producción del ERP de un cliente, hoy: Dokploy.** No porque sea mejor en funciones —en
  monitorización, correo y CDN OpenShip va por delante— sino porque es **más viejo, más probado y con
  más gente que ya se chocó con lo mismo**. Y porque el criterio que **no** se negocia en nuestro caso
  es *«el backup restaura»*: ahí Dokploy tiene la pieza verificada (destino S3-compatible → nuestro
  R2) y OpenShip la tiene **sin verificar**.
- **OpenShip merece una prueba, y su sitio natural es la Fase 0**, porque toca de frente tres de
  nuestros problemas abiertos: **dominio sin comprar** (`*.opsh.io` para el ensayo), **correo sin
  Resend** y **CDN sin Vercel**.
- **La decisión no es irreversible, y eso es lo importante:** el activo real son los
  **`docker-compose` y los Dockerfile del repositorio**, no el panel. Las dos plataformas despliegan
  un compose tal cual, así que cambiar de panel es **un día de trabajo, no un proyecto**. Regla que se
  fija aquí: **el compose del repositorio es la fuente de verdad** y ninguna plataforma se lleva nada
  propio dentro.
- **Coolify** pertenece a la misma familia y se evaluaría con **esta misma lista de comprobación**;
  no lo he medido hoy y no opinaré de memoria.

### Qué añadir a la Fase 0 si se prueba OpenShip

1. Instalarlo en **el mismo VPS** (o en un segundo VPS pequeño) y desplegar **el mismo compose**.
2. **Probar el backup contra nuestro R2 de verdad** —es el punto débil que ellos declaran— y
   **restaurarlo**, con la huella de las **199 tablas**.
3. Medir el coste real de la monitorización con **nuestro** tráfico (su cifra de 1,4 µs está medida
   en **su** imagen y su hardware, y ellos mismos la califican de orden de magnitud).
4. Confirmar el modo de correo **sin** encenderlo para producción hasta tener PTR y reputación.
5. **No** usar `*.opsh.io` con datos de cliente (llega por `:80` plano).

---

*Este plan se ejecuta por fases y se actualiza con cada una. El procedimiento operativo vigente sigue
en `docs/plans/runbook-go-live.md`; la versión canónica de restricciones, en `AGENTS.md`.*
