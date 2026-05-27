import re
import os

# Files to process and their item model names
files = [
    (r'backend-erp\src\sale-invoices\sale-invoices.service.ts', 'saleInvoiceItem', 'SaleInvoiceLineItem'),
    (r'backend-erp\src\purchase-invoices\purchase-invoices.service.ts', 'purchaseInvoiceItem', 'PurchaseInvoiceLineItem'),
    (r'backend-erp\src\sale-reserve-invoices\sale-reserve-invoices.service.ts', 'saleReserveInvoiceItem', 'SaleReserveInvoiceLineItem'),
    (r'backend-erp\src\purchase-reserve-invoices\purchase-reserve-invoices.service.ts', 'purchaseReserveInvoiceItem', 'PurchaseReserveInvoiceLineItem'),
]

BASE = r'D:\ProyectosPython\erp_suite'

def add_fields_to_interface(content, iface_name):
    pattern = rf'(interface {iface_name} \{{[\s\S]*?)(\}})'
    def repl(m):
        body = m.group(1)
        if 'projectCode' in body:
            return m.group(0)
        # Add before the last }
        return body + '  projectCode?: string | null;\n  dimension1?: string | null;\n  projectCode?: string | null;\n  dimension2?: string | null;\n}\n'
    return re.sub(pattern, repl, content)

def add_fields_to_push_blocks(content):
    # Find invoiceItems.push({ ... }) blocks and add fields before the closing })
    # This is a heuristic: we look for push({\n  ... \n}) and add fields before the last })
    # We'll use a simpler approach: for each push block, add the fields line before the closing `});`
    # But this is hard with regex. Instead, let's find specific patterns.
    pass

for rel_path, model, iface in files:
    path = os.path.join(BASE, rel_path)
    if not os.path.exists(path):
        print(f"SKIP {path}")
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Add to interface
    if iface in content:
        content = add_fields_to_interface(content, iface)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"DONE {path}")
