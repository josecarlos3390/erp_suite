import os
import re

# Campos a agregar en cada data: de creacion/update
def get_fields(module_name):
    is_sales = module_name in ['sales-quotations', 'sales-orders', 'delivery-orders', 'sale-invoices', 'sale-reserve-invoices']
    base = """          contactPerson: dto.contactPerson ?? null,
          contactPhone: dto.contactPhone ?? null,
          shipToAddress: dto.shipToAddress ?? null,
          paymentTermsId: dto.paymentTermsId ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,"""
    if is_sales:
        base += "\n          salesPersonId: dto.salesPersonId ?? null,"
    return base

def update_service(filepath, module_name):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    fields = get_fields(module_name)

    # Estrategia: buscar bloques data: { ... } donde se crea el documento principal
    # Buscamos el patron: createdById, (o updatedById para updates) seguido de },
    # e insertamos antes del cierre

    # Para creates - buscar createdById seguido de },
    # Usamos regex para encontrar "createdById," seguido de opcionalmente un valor y luego "},"
    pattern_create = r'(createdById,\n)(\s*\},)'
    replacement_create = r'\1' + fields + '\n\2'
    content_new = re.sub(pattern_create, replacement_create, content)

    # Para updates - buscar updatedById seguido de },
    pattern_update = r'(updatedById,\n)(\s*\},)'
    replacement_update = r'\1' + fields + '\n\2'
    content_new = re.sub(pattern_update, replacement_update, content_new)

    # Tambien buscar casos donde no hay createdById pero hay partnerId y es el data principal
    # Buscar "status: ...Status.OPEN," o "status: ...Status.CONFIRMED,"
    # Si no se reemplazo nada, intentar otro patron
    if content_new == content:
        # Patron alternativo: despues del status
        pattern_status = r'(status:\s*\w+Status\.\w+,\n)(\s*\},)'
        replacement_status = r'\1' + fields + '\n\2'
        content_new = re.sub(pattern_status, replacement_status, content)

    if content_new != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content_new)
        print(f'  OK: {filepath}')
    else:
        print(f'  WARN: No se encontro punto de insercion en {filepath}')

# Mapeo de servicios
SERVICES = {
    'sales-quotations': 'sales-quotations.service.ts',
    'sales-orders': 'sales-orders.service.ts',
    'delivery-orders': 'delivery-orders.service.ts',
    'sale-invoices': 'sale-invoices.service.ts',
    'sale-reserve-invoices': 'sale-reserve-invoices.service.ts',
    'purchase-quotations': 'purchase-quotations.service.ts',
    'purchase-orders': 'purchase-orders.service.ts',
    'purchase-receipts': 'purchase-receipts.service.ts',
    'purchase-invoices': 'purchase-invoices.service.ts',
    'purchase-reserve-invoices': 'purchase-reserve-invoices.service.ts',
}

for module, filename in SERVICES.items():
    print(f'Procesando: {module}')
    filepath = f'backend-erp/src/{module}/{filename}'
    if os.path.exists(filepath):
        update_service(filepath, module)
    else:
        print(f'  SKIP: {filepath} no existe')

print('Servicios actualizados')
