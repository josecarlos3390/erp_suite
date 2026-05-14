import os
import re

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
    original = content

    # Patron 1: createdById: valor ?? null, seguido de },
    content = re.sub(
        r'(createdById:.*?\n)(\s*\},)',
        r'\1' + fields + '\n\2',
        content
    )

    # Patron 2: updatedById: valor ?? null, seguido de },
    content = re.sub(
        r'(updatedById:.*?\n)(\s*\},)',
        r'\1' + fields + '\n\2',
        content
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  OK: {filepath}')
    else:
        print(f'  WARN: No se encontro punto de insercion en {filepath}')

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
