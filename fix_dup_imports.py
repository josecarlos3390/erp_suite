import os

forms = [
    'erp-frontend/src/app/pages/sales-orders/sales-orders-form.component.ts',
    'erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.ts',
    'erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.ts',
    'erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.ts',
    'erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.ts',
    'erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts',
]

for path in forms:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove duplicate import lines
    for comp in ['ItemComboboxComponent', 'ItemSearchModeToggleComponent']:
        import_line = f"import {{ {comp} }} from"
        count = content.count(import_line)
        if count > 1:
            first_idx = content.find(import_line)
            second_idx = content.find(import_line, first_idx + 1)
            while second_idx != -1:
                line_start = second_idx
                line_end = content.find('\n', line_start) + 1
                content = content[:line_start] + content[line_end:]
                second_idx = content.find(import_line, first_idx + 1)

    # Remove duplicate in imports array
    for comp in ['ItemComboboxComponent', 'ItemSearchModeToggleComponent']:
        arr_line = f'    {comp},'
        count = content.count(arr_line)
        if count > 1:
            first_idx = content.find(arr_line)
            second_idx = content.find(arr_line, first_idx + 1)
            while second_idx != -1:
                line_start = second_idx
                line_end = content.find('\n', line_start) + 1
                content = content[:line_start] + content[line_end:]
                second_idx = content.find(arr_line, first_idx + 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed', path)
