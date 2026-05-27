"""
Agrega projectCode, dimension1, dimension2 a builders y payloads
en los 6 formularios del frontend.
"""
import re, glob

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

    # Evitar duplicados
    if content.count('projectCode: [data.projectCode') > 0:
        # Ya tiene en builders, verificar payloads
        pass

    # 1. Builders: agregar después de customFields: this.fb.group(data.customFields ?? {}),
    content = re.sub(
        r"(\s+)(customFields:\s*this\.fb\.group\((?:data|l|line|i|di)\.(?:customFields|custom_fields)\s*\?\?\s*\{\}\),)",
        lambda m: f"{m.group(1)}{m.group(2)}\n{m.group(1)}projectCode: [{m.group(2).split('.')[1]}.projectCode ?? ''],\n{m.group(1)}dimension1: [{m.group(2).split('.')[1]}.dimension1 ?? ''],\n{m.group(1)}dimension2: [{m.group(2).split('.')[1]}.dimension2 ?? ''],",
        content,
    )

    # 2. Payloads: agregar después de customFields: ... ?? {},
    content = re.sub(
        r"(\s+)(customFields:\s*(?:rv|ctrl|l|line|item|di|i)\.\w+\(\)\?\.value\s*\?\?\s*\{\},)",
        lambda m: f"{m.group(1)}{m.group(2)}\n{m.group(1)}projectCode: {m.group(2).split(':')[0].strip()}.get('projectCode')?.value || undefined,\n{m.group(1)}dimension1: {m.group(2).split(':')[0].strip()}.get('dimension1')?.value || undefined,\n{m.group(1)}dimension2: {m.group(2).split(':')[0].strip()}.get('dimension2')?.value || undefined,",
        content,
    )

    # 3. Payloads alternativos: customFields: rv.customFields ?? {},
    content = re.sub(
        r"(\s+)(customFields:\s*(?:rv|l|line|i|di)\.(?:customFields|custom_fields)\s*\?\?\s*\{\},)",
        lambda m: f"{m.group(1)}{m.group(2)}\n{m.group(1)}projectCode: {m.group(2).split('.')[0].split(':')[-1].strip()}.projectCode || undefined,\n{m.group(1)}dimension1: {m.group(2).split('.')[0].split(':')[-1].strip()}.dimension1 || undefined,\n{m.group(1)}dimension2: {m.group(2).split('.')[0].split(':')[-1].strip()}.dimension2 || undefined,",
        content,
    )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated: {path}')
