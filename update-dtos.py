import os
import glob

# Campos comunes para TODOS los documentos
COMMON_FIELDS = '''
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  shipToAddress?: string;

  @IsOptional()
  @IsInt()
  paymentTermsId?: number | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
'''

# Campos solo para documentos de venta
SALES_FIELDS = '''
  @IsOptional()
  @IsInt()
  salesPersonId?: number | null;
'''

# Documentos y si son de venta
DOCS = {
    'sales-quotations': True,
    'sales-orders': True,
    'delivery-orders': True,
    'sale-invoices': True,
    'sale-reserve-invoices': True,
    'purchase-quotations': False,
    'purchase-orders': False,
    'purchase-receipts': False,
    'purchase-invoices': False,
    'purchase-reserve-invoices': False,
}

# Archivos DTO a actualizar por documento
DTO_FILES = {
    'sales-quotations': ['create-sales-quotation.dto.ts', 'update-sales-quotation.dto.ts'],
    'sales-orders': ['create-sales-order-manual.dto.ts', 'create-sales-order-from-quotation.dto.ts', 'update-sales-order.dto.ts'],
    'delivery-orders': ['create-delivery-order.dto.ts', 'create-delivery-order-manual.dto.ts', 'create-delivery-order-from-source.dto.ts', 'update-delivery-order.dto.ts'],
    'sale-invoices': ['create-sale-invoice.dto.ts', 'sale-invoice.dto.ts'],
    'sale-reserve-invoices': ['sale-reserve-invoice.dto.ts'],
    'purchase-quotations': ['create-purchase-quotation.dto.ts', 'update-purchase-quotation.dto.ts'],
    'purchase-orders': ['purchase-order.dto.ts', 'create-purchase-order-from-quotation.dto.ts'],
    'purchase-receipts': ['purchase-receipt.dto.ts', 'create-purchase-receipt-manual.dto.ts'],
    'purchase-invoices': ['create-purchase-invoice.dto.ts', 'purchase-invoice.dto.ts'],
    'purchase-reserve-invoices': ['purchase-reserve-invoice.dto.ts'],
}

# Agregar IsDateString a los imports si no existe
def ensure_imports(content):
    if 'IsDateString' not in content:
        content = content.replace(
            "import {",
            "import {\n  IsDateString,"
        )
    return content

def add_fields_to_dto(filepath, is_sales):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    content = ensure_imports(content)

    # Buscar la última propiedad antes de los items o cierre de clase
    # Estrategia: buscar "items!:" o "items?:" o "items =" o "items" seguido de tipo
    # Insertar antes de la línea que tiene items
    lines = content.split('\n')
    insert_idx = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('items!:'):
            insert_idx = i
            break
        if stripped.startswith('items?:'):
            insert_idx = i
            break
        if stripped.startswith('@IsArray()'):
            # Buscar hacia atrás para encontrar el campo anterior
            for j in range(i-1, -1, -1):
                if lines[j].strip().endswith(';') or lines[j].strip().endswith('null;'):
                    insert_idx = j + 1
                    break
            break

    if insert_idx is None:
        print(f'  WARN: No se encontro punto de insercion en {filepath}')
        return

    fields = COMMON_FIELDS
    if is_sales:
        fields += SALES_FIELDS

    lines.insert(insert_idx, fields)
    content = '\n'.join(lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  OK: {filepath}')

for doc, is_sales in DOCS.items():
    print(f'Procesando: {doc}')
    base = f'backend-erp/src/{doc}/dto'
    for filename in DTO_FILES[doc]:
        filepath = os.path.join(base, filename)
        if os.path.exists(filepath):
            add_fields_to_dto(filepath, is_sales)
        else:
            print(f'  SKIP: {filepath} no existe')

print('DTOs actualizados')
