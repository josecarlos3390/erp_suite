import os

files = [
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-credit-notes\purchase-credit-notes-form.component.ts',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-returns\purchase-returns-form.component.ts',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-credit-notes\sales-credit-notes-form.component.ts',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-orders\sales-orders-form.component.ts',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-returns\sales-returns-form.component.ts',
]
imp = "import { UdfService, UserDefinedField } from '@shared/udf/udf.service';"
for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if imp in content:
        print(f'SKIP {path}')
        continue
    lines = content.split('\n')
    idx = 0
    for i, line in enumerate(lines):
        if line.startswith('import ') and ('@shared/' in line or '@core/' in line):
            idx = i + 1
    lines.insert(idx, imp)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'FIXED {path}')
