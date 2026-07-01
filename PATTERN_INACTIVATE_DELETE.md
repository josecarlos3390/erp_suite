# Patrón inactivar / eliminar físico en maestros

> Documento vivo. Se actualiza cada vez que aplicamos el patrón a un nuevo módulo maestro.

## 1. Propósito

Permitir eliminar físicamente un registro de maestro cuando fue creado por error y **no tiene trazabilidad**, pero **inactivarlo** cuando ya tiene movimientos, dependencias o registros históricos vinculados.

Esto evita basura en la base de datos (registros huérfanos sin uso) sin romper la integridad histórica de documentos comerciales, contables o de inventario.

## 2. Contrato del endpoint `DELETE /:module/:id`

```json
{
  "action": "INACTIVATED" | "DELETED",
  "id": 123,
  "message": "..."
}
```

- **`DELETED`**: el registro se eliminó físicamente porque no tenía dependencias.
- **`INACTIVATED`**: el registro se inactivó (`isActive = false` o `status = INACTIVE`) porque tenía movimientos/dependencias.

## 3. Responsabilidades

### Backend

- `*MovementChecker`: helper inyectable que determina si el registro tiene dependencias.
- `*Service.remove()`: consulta el movement checker y decide entre `delete()` o actualización a inactivo.
- Proteger registros predeterminados (`isDefault`, almacén por defecto, etc.) cuando aplique.
- Limpiar dependencias directas antes de eliminar físico si es necesario (ej. `itemWarehouseAccount`, `userWarehouse`, `stock` en warehouses).

### Frontend

- El servicio expone `remove(id)` retornando `{ action, id, message }`.
- El componente usa `ConfirmDialogService.ask()` y muestra el mensaje devuelto por el backend.
- Se mantiene una acción separada de reactivación cuando el maestro usa `status` (p. ej. `warehouses`).

## 4. Estado por módulo

| Módulo | Campo de estado | `MovementChecker` | Dependencias revisadas | Estado |
|--------|-----------------|-------------------|------------------------|--------|
| **Accounts** | `isActive` | `AccountMovementChecker` | `journalEntryLine`, cuentas hijas (`parentId`) | ✅ Aplicado |
| **Banks** | `isActive` | `BankMovementChecker` | `incomingPayment`, `outgoingPayment` (directo y por `bankAccountId`) | ✅ Aplicado |
| **Branches** | `isActive` | `BranchMovementChecker` | Documentos comerciales, stock, empleados, terminales POS, usuarios | ✅ Aplicado |
| **Currencies** | `isActive` | `CurrencyMovementChecker` | Tasa de cambio, documentos, artículos, empresas | ✅ Aplicado |
| **Discount Groups** | `status` | `DiscountGroupMovementChecker` | Artículos asignados al grupo (`item.groupId`) | ✅ Aplicado |
| **Employees** | `status` | `EmployeeMovementChecker` | Partners asignados (`partner.employeeId`) | ✅ Aplicado |
| **Item Groups** | `status` | `ItemGroupMovementChecker` | `item`, `itemGroupDiscount` | ✅ Aplicado |
| **Items** | `isActive` | `ItemMovementChecker` | Líneas de documentos, stock, lotes, series, listas de precio | ✅ Aplicado |
| **Partner Groups** | `status` | `PartnerGroupMovementChecker` | `partner`, `itemGroupDiscount` | ✅ Aplicado |
| **Partners** | `status` | `PartnerMovementChecker` | Documentos comerciales, pagos, direcciones, cuentas bancarias | ✅ Aplicado |
| **Payment Terms** | `isActive` | `PaymentTermMovementChecker` | Partners, documentos comerciales | ✅ Aplicado |
| **Price Lists** | `status` | `PriceListMovementChecker` | Partners, items, historial de precios, listas derivadas, special prices | ✅ Aplicado |
| **Projects** | `status` | `ProjectMovementChecker` | Documentos comerciales, stock, asientos contables, pagos | ✅ Aplicado |
| **Special Prices** | `status` | `SpecialPriceMovementChecker` | Líneas de special price (`specialPriceItem`) | ✅ Aplicado |
| **Tax Indicators** | `isActive` | `TaxIndicatorMovementChecker` | Líneas de documentos, artículos, partners | ✅ Aplicado |
| **UOM Conversions** | `status` | `UomConversionMovementChecker` | Artículos que usan ambas UoMs de la conversión | ✅ Aplicado |
| **UOMs** | `status` | `UomMovementChecker` | Artículos (`salesUomId`, `purchaseUomId`, `inventoryUomId`) y conversiones | ✅ Aplicado |
| **Warehouses** | `status` | `WarehouseMovementChecker` | Documentos comerciales, líneas, stock, transferencias, ajustes, contabilidad, borradores | ✅ Aplicado |
| **Withholding Tax Types** | `isActive` | `WithholdingTaxMovementChecker` | Retenciones en facturas de compra (`purchaseInvoiceWithholdingTax`) | ✅ Aplicado |

## 5. Módulos pendientes del patrón

| Módulo | Campo de estado | Complejidad | Notas |
|--------|-----------------|-------------|-------|
| **POS Terminals** | `isActive` | Baja | Relaciones con sesiones POS |

> Módulos secundarios/configuración como `exchange-rates`, `item-warehouse-accounts` y `account-mappings` aún eliminan físicamente. Se pueden incorporar al patrón si se decide extender el alcance más allá de los maestros principales.

## 6. Decisiones de diseño

- **No agregamos validaciones de negocio adicionales** en el movement checker; solo verificamos la existencia de registros vinculados.
- **El mensaje del backend es canónico**: el frontend solo lo muestra, no construye mensajes propios.
- **Reactivación**: cuando un maestro usa `status`, mantenemos un endpoint/método separado `activar()`. Cuando usa `isActive`, se reactiva con el `update()` normal del maestro.

## 7. Referencias

- `AGENTS.md` — convenciones generales del monorepo.
- Implementaciones de referencia:
  - `backend-erp/src/warehouses/warehouse-movement-checker.ts`
  - `backend-erp/src/accounts/account-movement-checker.ts`
  - `backend-erp/src/item-groups/item-group-movement-checker.ts`
  - `backend-erp/src/partner-groups/partner-group-movement-checker.ts`
  - `backend-erp/src/discount-groups/discount-group-movement-checker.ts`
  - `backend-erp/src/uoms/uom-movement-checker.ts`
  - `backend-erp/src/uom-conversions/uom-conversion-movement-checker.ts`
