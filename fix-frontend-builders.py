"""
Agrega projectCode, dimension1, dimension2 a los builders de líneas
y payloads de los 6 formularios del frontend.
"""
import re, glob

# Campos para agregar al FormGroup builder
FORM_FIELDS = """      projectCode: [l.projectCode ?? ''],
      dimension1: [l.dimension1 ?? ''],
      dimension2: [l.dimension2 ?? ''],"""

EMPTY_FORM_FIELDS = """      projectCode: [''],
      dimension1: [''],
      dimension2: [''],"""

# Campos para agregar al payload
PAYLOAD_FIELDS = """          projectCode: l.getRawValue().projectCode || undefined,
          dimension1: l.getRawValue().dimension1 || undefined,
          dimension2: l.getRawValue().dimension2 || undefined,"""

PAYLOAD_FIELDS_SIMPLE = """          projectCode: l.get('projectCode')?.value || undefined,
          dimension1: l.get('dimension1')?.value || undefined,
          dimension2: l.get('dimension2')?.value || undefined,"""

files = [
    'erp-frontend/src/app/pages/sales-orders/sales-orders-form.component.ts',
    'erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.ts',
    'erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.ts',
    'erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.ts',
    'erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.ts',
    'erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts',
]

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'projectCode' in content:
        print(f'Skipped (already has): {path}')
        continue

    # 1. Agregar a builders de líneas (cuando se crea desde modelo)
    # Buscamos: customFields: this.fb.group(l.customFields ?? {}),
    # Y agregamos después
    content = re.sub(
        r"(\s+)(customFields:\s*this\.fb\.group\(l\.customFields\s*\?\?\s*\{\}\),)",
        lambda m: f"{m.group(1)}{m.group(2)}\n{m.group(1)}projectCode: [l.projectCode ?? ''],\n{m.group(1)}dimension1: [l.dimension1 ?? ''],\n{m.group(1)}dimension2: [l.dimension2 ?? ''],",
        content,
    )

    # 2. Agregar a builders de líneas vacías (cuando se crea línea nueva)
    content = re.sub(
        r"(\s+)(customFields:\s*this\.fb\.group\(\{\}\),)",
        lambda m: f"{m.group(1)}{m.group(2)}\n{m.group(1)}projectCode: [''],\n{m.group(1)}dimension1: [''],\n{m.group(1)}dimension2: [''],",
        content,
    )

    # 3. Agregar a payloads (cuando se envía al backend)
    # Buscamos: customFields: l.getRawValue().customFields ?? {},
    content = re.sub(
        r"(\s+)(customFields:\s*l\.getRawValue\(\)\.customFields\s*\?\?\s*\{\},)",
        lambda m: f"{m.group(1)}{m.group(2)}\n{m.group(1)}projectCode: l.getRawValue().projectCode || undefined,\n{m.group(1)}dimension1: l.getRawValue().dimension1 || undefined,\n{m.group(1)}dimension2: l.getRawValue().dimension2 || undefined,",
        content,
    )

    # 4. Alternativa de payload con get()
    content = re.sub(
        r"(\s+)(customFields:\s*l\.get\('customFields'\)\?\.value\s*\?\?\s*\{\},)",
        lambda m: f"{m.group(1)}{m.group(2)}\n{m.group(1)}projectCode: l.get('projectCode')?.value || undefined,\n{m.group(1)}dimension1: l.get('dimension1')?.value || undefined,\n{m.group(1)}dimension2: l.get('dimension2')?.value || undefined,",
        content,
    )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated: {path}')
