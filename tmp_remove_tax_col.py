import os, re

files = [
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\delivery-orders\delivery-orders-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-credit-notes\purchase-credit-notes-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-orders\purchase-orders-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\purchase-receipts\purchase-receipts-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-credit-notes\sales-credit-notes-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-orders\sales-orders-form.component.html',
    r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages\sales-quotations\sales-quotations-form.component.html',
]

# Regex to remove the <th>Impuesto</th> header
th_pattern = re.compile(r'\s*<th\s+class="col-tax">Impuesto</th>\n')

# Regex to remove the entire <td data-label="Impuesto" ...>...</td> cell
# This spans multiple lines and contains app-tax-indicator-selector
td_pattern = re.compile(
    r'\s*<td\s+data-label="Impuesto"\s+class="col-tax">\s*'
    r'<app-tax-indicator-selector[^>]*>.*?</app-tax-indicator-selector>\s*'
    r'</td>\n',
    re.DOTALL
)

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    content = th_pattern.sub('\n', content)
    content = td_pattern.sub('\n', content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated: {os.path.basename(path)}')
    else:
        print(f'No changes: {os.path.basename(path)}')
