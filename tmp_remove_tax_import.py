import os, re

# Map HTML file -> TS file
pairs = [
    (r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\delivery-orders\delivery-orders-form.component.ts'),
    (r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-credit-notes\purchase-credit-notes-form.component.ts'),
    (r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-orders\purchase-orders-form.component.ts'),
    (r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-receipts\purchase-receipts-form.component.ts'),
    (r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-credit-notes\sales-credit-notes-form.component.ts'),
    (r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-orders\sales-orders-form.component.ts'),
    (r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-quotations\sales-quotations-form.component.ts'),
]

pattern = re.compile(r'^\s*TaxIndicatorSelectorComponent,\s*\n', re.MULTILINE)

for path in pairs:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = pattern.sub('', content)
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Removed import: {os.path.basename(path)}')
    else:
        print(f'Not found: {os.path.basename(path)}')
