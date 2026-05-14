import os

files = [
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\delivery-orders\delivery-orders-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-credit-notes\purchase-credit-notes-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-orders\purchase-orders-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-receipts\purchase-receipts-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-credit-notes\sales-credit-notes-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-orders\sales-orders-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-quotations\sales-quotations-form.component.html',
]

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    has_it = 'app-tax-indicator-selector' in content
    print(f"{'USED' if has_it else 'UNUSED'}: {os.path.basename(path)}")
