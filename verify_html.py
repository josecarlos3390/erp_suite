import os

forms = [
    'erp-frontend/src/app/pages/sales-orders/sales-orders-form.component.html',
    'erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.html',
    'erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.html',
    'erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.html',
    'erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.html',
    'erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.html',
]

for path in forms:
    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()
    has_pc = "@case ('projectCode')" in html
    has_d1 = "@case ('dimension1')" in html
    has_d2 = "@case ('dimension2')" in html
    print(os.path.basename(path), 'projectCode=' + str(has_pc), 'dim1=' + str(has_d1), 'dim2=' + str(has_d2))
