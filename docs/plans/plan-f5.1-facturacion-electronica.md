# Plan: facturación electrónica SIN (F5.1)

> **Estado: PROPUESTA — no hay una línea de código escrita.** Este documento fija el
> alcance, las decisiones que **no puedo tomar yo** y el orden de los incrementos. Se
> escribe **antes** del código a propósito: SIN tiene requisitos de cumplimiento que no
> conviene descubrir a mitad de la implementación.
>
> **Origen**: `ROADMAP.md` la marca como **«(siguiente feature prioritario)»** y es el único
> bloqueante **legal** del negocio: todo lo demás se puede operar sin ello; facturar en
> Bolivia a escala, no.
>
> **Medido antes de proponer**: en `backend-erp` **no existe nada** — ni módulo, ni `cuf` en
> el esquema, ni plan previo (`Get-ChildItem docs/plans -Filter "*sin*"` y `*factura*` ⇒
> vacío; `Select-String cuf|CUF|electronic` en `schema.prisma` ⇒ 0). Es greenfield.

## 1. Lo que NO pude verificar (y por qué es la primera puerta)

La documentación técnica oficial **no es accesible desde el entorno de desarrollo**. Medido
el 2026-11-07:

| URL | Resultado |
|---|---|
| `siatinfo.impuestos.gob.bo/…/factura-de-compra-y-venta` (XSD) | **fetch failed** |
| `siatanexo.impuestos.gob.bo/…/recepcion-factura-electronica` | **fetch failed** |
| `siatinfo.impuestos.gob.bo/…/factura-electronica` | **fetch failed** |
| `impuestos.gob.bo/pdf/GACCT/BOLETIN 4-18.pdf` | responde 200 pero devuelve el **portal**, no el PDF |

`impuestos.gob.bo` sí responde (HTTP 200) y su menú enlaza las piezas que hacen falta
([Sistema de Facturación Electrónica](https://siatinfo.impuestos.gob.bo/),
[Especificación técnica del servicio web de ciclos](https://www.impuestos.gob.bo/wp-content/uploads/2025/09/modalidad-de-facturacion-por-ciclos.pdf),
[RND 10-0021-16 Sistema de Facturación Virtual](https://www.impuestos.gob.bo/wp-content/uploads/2025/09/RND-10-0021-16.pdf),
[Factura de Compra y Venta — XML/XSD](https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/archivos-xml-xsd-de-facturas-electronicas/factura-de-compra-y-venta)).

> **Puerta 0 (bloqueante)**: **no se escribe código de formato hasta que los `.xsd` y la
> especificación técnica estén EN EL REPOSITORIO** (`docs/reference/sin/`), con su versión y
> su fecha de descarga. Todo lo que sigue describe la **arquitectura**, no el formato: los
> nombres de campo, longitudes y códigos se copian del XSD, **no** de este documento.

## 2. Lo que el ERP ya tiene y SIN necesita

Nada de esto hay que inventarlo; es mapear:

| Pieza SIN | Ya existe en el ERP |
|---|---|
| NIT y razón social del emisor | `Tenant` (perfil de empresa del Centro de configuración) |
| Sucursal / punto de venta | `Branch`, `Warehouse` |
| Serie y correlativo por documento | `DocumentSeries` (patrón SAP B1, con sucursal) |
| Importes, descuentos, ICE, IVA, exportación | `SaleInvoice` + `calcLineWithIndicator` + `resolveLineTaxIndicator` |
| Moneda y tipo de cambio | `currency`, `exchangeRate`, tabla de tasas |
| Nota de crédito que referencia la factura | `SalesCreditNote` (con `saleInvoiceId`) |
| Usuario que emite | `createdById` + `AuditActorContext` |
| Fecha «hoy» del tenant | `tenantToday()` |

**Lo que falta por completo**: dosificación, CUF/CUFD, leyendas, actividad económica,
certificado y firma, y todo el transporte hacia el SIN.

## 3. Las decisiones que necesito de ti (no las puedo tomar yo)

1. **Modalidad.** Electrónica **en línea** (recepción inmediata), **portal web** (gratuito,
   facturación manual) o **por ciclos** (envío diferido). Cambia todo el diseño.
   *Recomiendo en línea*; las otras dos son otra arquitectura y otro producto.
2. **Certificado digital.** ¿Ya lo tienes, con qué entidad, y puede exportarse como `.p12`?
   Sin él no hay firma y sin firma no hay factura válida.
3. **Ambiente de pruebas del SIN.** Hay que **solicitarlo** (es un trámite, no un endpoint
   que se abre solo). Hasta tenerlo, la fase 1 se prueba contra un **doble local**.
4. **Moneda y alcance.** ¿Se factura en Bs y en USD? ¿Hay **exportación** (tasa cero)?
5. **Puntos de venta.** ¿Cuántas sucursales/cajas emiten, y quién administra la dosificación
   de cada una?

## 4. Arquitectura propuesta

Un módulo **`sin/`** que no sabe de facturas: recibe un «documento fiscal» ya armado y
devuelve un sobre firmado. La factura del ERP **no** se acopla al XML.

```
SaleInvoice (ya existe)
      │  mapeo (una función, testeada)
      ▼
DocumentoFiscal  ← modelo propio, sin nombres del XSD
      │  generar()
      ▼
XML sin firmar ──validar contra XSD──▶ error de esquema (antes de firmar)
      │  firmar(.p12)
      ▼
XML firmado ──verificar firma──▶ sobre listo para enviar
      │  enviar()   ← fase 1
      ▼
Respuesta del SIN (código, mensaje, CUF) → estado del documento en el ERP
```

**Tres decisiones de diseño, y su razón:**

- **El generador es puro**: mismas entradas ⇒ mismo XML (salvo el CUF, que depende de la
  fecha). Se puede probar con vectores fijos, sin red y sin base.
- **La firma va aparte del generador**: así se puede validar el XML contra el XSD **antes**
  de firmar, y un error de esquema se ve como error de esquema, no como «firma inválida».
- **El transporte es lo último**: la fase 0 no abre un socket. Todo lo demás se puede
  verificar sin certificado real y sin ambiente del SIN.

## 5. Fases e incrementos

### Fase 0 — sin red, sin certificado real (la que se puede hacer ya)

| # | Incremento | Criterio de aceptación (medible) |
|---|---|---|
| 0.1 | **Los XSD en el repositorio** + versión y fecha en `docs/reference/sin/` | los ficheros están; un test los carga y valida un XML mínimo |
| 0.2 | **Modelo fiscal** (`SinConfig` por tenant: NIT, razón social, actividad, dosificación, punto de venta) + migración | alta y consulta por API; `tenantId` en toda query |
| 0.3 | **CUF** (módulo 11) con sus dígitos | casos con **vectores del SIN** (no inventados): 3 conocidos + 3 de borde |
| 0.4 | **Generador** factura / NC / ND | **validación contra el XSD oficial** en un test que falla si el XML se desvía |
| 0.5 | **Firma** con `.p12` local (XMLDSig) | el XML firmado **verifica**; y un byte cambiado **no** verifica (caso negativo) |
| 0.6 | **Mapeo `SaleInvoice` → documento fiscal** | un E2E: factura real de la BD ⇒ XML **firmado y válido**, con **0 llamadas de red** |
| 0.7 | **`SinConfig` y el certificado en la UI** (subir `.p12`, contraseña, fecha de vencimiento) | pantalla con `dirtyCheckGuard`; la contraseña **nunca** vuelve al cliente |

**Cierre de la fase 0**: `npm test` del módulo en verde, XSD validando, firma verificando y
un E2E que produce un XML firmado desde una factura real **sin tocar la red**.

### Fase 1 — el transporte (necesita el ambiente de pruebas del SIN)

| # | Incremento | Criterio |
|---|---|---|
| 1.1 | Cliente del servicio de **recepción** con reintentos y `requestId` | contra el **doble local** primero; luego contra el ambiente de pruebas |
| 1.2 | **Estado del documento**: `PENDIENTE → ENVIADO → ACEPTADO / RECHAZADO / OBSERVADO` | el estado sale del ERP y se ve en la factura |
| 1.3 | **Anulación** y **eventos** | casos con sus plazos, declarados |
| 1.4 | **Rechazos**: el mensaje del SIN se guarda y se muestra tal cual | el usuario ve el código y el texto del SIN, no un «error 500» |

### Fase 2 — contingencia y operación

| # | Incremento |
|---|---|
| 2.1 | Emisión **fuera de línea** y reenvío (paquetes), con su plazo declarado |
| 2.2 | **Reintentos** con cola y backoff; una caída del SIN **no** pierde facturas |
| 2.3 | **Reportes**: facturas emitidas, rechazadas, pendientes; y el enlace al libro de ventas |
| 2.4 | **Monitor**: cuántos documentos en cada estado, y los que llevan demasiado tiempo pendientes |

### Fase 3 — cumplimiento fino

- Nota de crédito que referencia el CUF de la factura (y su efecto en el libro).
- Exportación (tasa cero) y factura en USD con su tipo de cambio.
- «Código de control» para la modalidad **no** electrónica (si se elige portal web/ciclos).
- Conciliación contra el SIAT y **prueba de aceptación con el SIN** (el trámite real).

## 6. Trampas que ya sé que existen (y cómo las trato)

| Trampa | Cómo se trata |
|---|---|
| **La versión del esquema cambia** y el XML deja de validar | el XSD **vive en el repo** con su versión; un test lo valida en cada corrida, así un cambio de XSD es un rojo visible |
| **No puedo verificar el formato desde aquí** | **Puerta 0**: no se escribe el generador hasta tener los XSD; el plan no inventa nombres de campo |
| **El redondeo a 2 decimales** en cabecera vs suma de líneas | el XML se genera del **mismo** cálculo que el documento (no se recalcula): la diferencia de un céntimo no puede aparecer en el sobre |
| **La NC debe referenciar el CUF de la factura** | se guarda el CUF en la factura al aceptarla y la NC lo lee; si falta, **no** se emite |
| **Contingencia con plazo** | el plazo y el estado se declaran en la UI; no se promete lo que el SIN no acepte |
| **La contraseña del `.p12`** | cifrada en reposo y **nunca** devuelta por la API; el log no la toca |
| **Un certificado vencido** | se avisa antes (fecha de vencimiento en `SinConfig`) y el envío falla con mensaje claro, no con un 500 |

## 7. Lo que este plan NO incluye

- **No** incluye la modalidad **portal web** ni **por ciclos**: son otra arquitectura. Si se
  eligen, este plan se reescribe.
- **No** incluye firma con **HSM** ni servicio externo de firma: `.p12` local.
- **No** incluye la **facturación de compras** (esa la emite el proveedor; el ERP solo la
  registra, como hoy).
- **No** promete el ambiente de producción: eso es el trámite de la fase 3.

## 8. Qué necesito para arrancar

1. La respuesta a las **cinco decisiones** de §3 (sobre todo: modalidad y certificado).
2. Un **acceso a los XSD** (que los descargue el usuario y los deje en el repo, o que me dé
   la versión exacta y los busco con red disponible).
3. Nada más: la fase 0 **no** necesita certificado real ni ambiente del SIN.

> **Orden recomendado**: 0.1 → 0.2 → 0.3 → 0.4 → 0.5 → 0.6 → 0.7. Cada uno es un commit con
> su medición en `AUDIT.md`, como el resto del repositorio.
