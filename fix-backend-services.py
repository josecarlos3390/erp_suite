"""
Agrega projectCode, dimension1, dimension2 a los servicios del backend.
Busca interfaces de líneas y payloads de Prisma create/update.
"""
import re, glob

FIELDS = """projectCode: line.projectCode ?? null,
      dimension1: line.dimension1 ?? null,
      dimension2: line.dimension2 ?? null,"""

FIELDS_INTERFACE = """projectCode?: string | null;
  dimension1?: string | null;
  dimension2?: string | null;"""

modules = [
    'backend-erp/src/sales-orders/sales-orders.service.ts',
    'backend-erp/src/purchase-orders/purchase-orders.service.ts',
    'backend-erp/src/sale-invoices/sale-invoices.service.ts',
    'backend-erp/src/purchase-invoices/purchase-invoices.service.ts',
    'backend-erp/src/sale-reserve-invoices/sale-reserve-invoices.service.ts',
]

for path in modules:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'projectCode' in content:
        print(f'Skipped (already has): {path}')
        continue

    # 1. Agregar a interfaces de línea (buscar interfaces que tienen customFields o trackingAssignments)
    # Buscamos: interface XxxLineItem { ... }
    content = re.sub(
        r"(interface\s+\w+LineItem\s*\{[\s\S]*?)(\n\s*trackingAssignments\s*\??\s*:\s*[^;]+;)",
        lambda m: f"{m.group(1)}{m.group(2)}\n  {FIELDS_INTERFACE}",
        content,
    )

    # 2. Agregar a inline type definitions (type XxxLineItem = { ... })
    content = re.sub(
        r"(type\s+\w+LineItem\s*=\s*\{[\s\S]*?)(\n\s*trackingAssignments\s*\??\s*:\s*[^;]+;)",
        lambda m: f"{m.group(1)}{m.group(2)}\n  {FIELDS_INTERFACE}",
        content,
    )

    # 3. Agregar a objetos de creación/actualización de Prisma
    # Buscamos patrones como:
    #   customFields: line.customFields ?? {},
    #   trackingAssignments: ...
    # Y agregamos después:
    content = re.sub(
        r"(\s+)(customFields\s*:\s*[^,\n]+,\n)(\s+)(trackingAssignments\s*:\s*[^,\n]+,\n?)",
        lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}{m.group(4)}{m.group(3)}{FIELDS}\n",
        content,
    )

    # 4. También buscar sin trackingAssignments
    content = re.sub(
        r"(\s+)(customFields\s*:\s*[^,\n]+,)(\n)(\s+\}\s*\);)",
        lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}{m.group(1)}projectCode: line.projectCode ?? null,{m.group(3)}{m.group(1)}dimension1: line.dimension1 ?? null,{m.group(3)}{m.group(1)}dimension2: line.dimension2 ?? null,{m.group(3)}{m.group(4)}",
        content,
    )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated: {path}')
