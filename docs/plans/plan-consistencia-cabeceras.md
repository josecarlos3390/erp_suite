# Plan de consistencia de cabeceras en documentos comerciales

> **Estado:** auditoría completada (2026-08-17); migración pendiente.
> **Objetivo:** igualar diseño, posición y distribución de los campos comunes de la sección "Información general" en todos los formularios de documentos comerciales (ventas y compras).

## Problema

Los documentos comerciales comparten ~10 campos (entidad, sucursal, almacén, fechas, moneda, vendedor, referencias, notas, descuento), pero cada formulario los distribuye en distinto orden y agrupación. El usuario percibe la inconsistencia al navegar entre documentos (p.ej. las Notas cambian de posición, la Moneda cambia de fila, la Referencia del cliente cambia de distribución según el modo de creación).

## Hallazgos de la auditoría (2026-08-17)

| # | Hallazgo | Formularios afectados | Severidad |
|---|----------|----------------------|-----------|
| A1 | La **Referencia del cliente/proveedor** cambia de distribución según el modo: desde documento base se muestra en fila de 3 columnas; en modo manual ocupa una fila completa de 1 columna (bloques `@if` paralelos con distinto `luna-form-row`) | FV, FRV, FCP | P2 |
| A2 | El orden de la fila de **Notas** varía: antes de las fechas (COT), después de referencias (SO/PO), después de sucursal (FV/FRV), al inicio (NC venta) | Todos | P2 |
| A3 | La **Moneda** vive en filas distintas: fila de vendedor (COT), fila de almacén (FRV), fila de fechas (NC), y en FV/FCP no aparece en el mapeo por label (el `app-document-currency-field` renderiza su propio label) | Todos | P2 |
| A4 | El **descuento de cabecera** estaba desalineado: el valor "Descuento aplicado" usaba `min-height: 40px` y label de 1 línea vs los `luna-input` vecinos (contenedor `--md` 36px y label con reserva de 2 líneas) — **YA CORREGIDO** (verificado: label y=844 h=32, controles y=880 h=36 alineados) | Componente compartido `document-discount-mode` | ✅ resuelto |

## Orden canónico propuesto

Para la sección "Información general" de TODOS los documentos comerciales:

```
Fila 1  [Entidad (Cliente/Proveedor)] [Documento origen (Pedido/Entrega/Recepción/OC)] [Sucursal]
Fila 2  [Almacén] [Fecha del documento] [F. Contab.]
Fila 3  [Vendedor] [Nº Referencia] [Referencia del cliente] [Moneda]
Fila 4  [Notas]
Bloque  [Descuento] (componente compartido app-document-discount-mode)
```

Campos propios de cada documento (Válida hasta, Fecha de entrega, Exportación, Uso del crédito fiscal, Condiciones de pago, Vencimiento, Monto/Impuesto/Motivo en ND) se ubican en la fila natural contigua sin alterar el orden de los campos comunes.

## Reglas de implementación

1. **Orden fijo de los campos comunes** en los 10 formularios: COT, PED, DEL, FV, FRV, NC venta, PO, FCP, FRC (ND queda como caso especial por su naturaleza de monto/impuesto/motivo).
2. **La Referencia del cliente/proveedor siempre en la misma fila** (fila 3), con la misma distribución, sin importar el modo de creación (unificar los bloques `@if` paralelos en uno solo).
3. **Notas siempre en la fila 4** (antes del bloque de descuento).
4. **Moneda siempre en la fila 3** (vía `app-document-currency-field`).
5. Verificación por build + medición DOM (y/height de labels y controles por fila) tras cada formulario migrado.

## Estado por formulario

| Formulario | Estado |
|------------|--------|
| Componente `document-discount-mode` | ✅ Migrado (alineación A4) |
| COT / PED / FV / FRV / NC / PO / FCP / FRC | ✅ Migrados (commit `540d3f1`, verificado en browser) — DEL ya cumplía el canónico |
| ND | ⏭️ Fuera de alcance (form especial) |

*Creado como parte de la auditoría visual frontend 2026-08-17.*
