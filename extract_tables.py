import re, sys

files = [
    'erp-frontend/src/app/pages/purchase-quotations/purchase-quotations-form.component.html',
    'erp-frontend/src/app/pages/delivery-orders/delivery-orders-form.component.html',
    'erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.html',
    'erp-frontend/src/app/pages/purchase-receipts/purchase-receipts-form.component.html',
    'erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.html',
    'erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.html',
    'erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.html',
    'erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.html',
]

for f in files:
    print(f'=== {f} ===')
    try:
        with open(f, 'r', encoding='utf-8') as fh:
            content = fh.read()
        tables = content.split('<table class="lines-table">')
        print(f'  Tables found: {len(tables)-1}')
        for i, t in enumerate(tables[1:], 1):
            thead = t.split('</thead>')[0] if '</thead>' in t else t[:500]
            ths = re.findall(r'<th[^>]*>(.*?)</th>', thead, re.DOTALL)
            labels = [re.sub(r'<[^>]+>', '', th).strip() for th in ths]
            print(f'    Table {i}: {labels}')
    except Exception as e:
        print(f'  Error: {e}')
    print()
