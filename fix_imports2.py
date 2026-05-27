import os

forms = [
    'erp-frontend/src/app/pages/sales-orders/sales-orders-form.component.ts',
    'erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.ts',
    'erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.ts',
    'erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.ts',
    'erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.ts',
    'erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts',
]

import_line = "import { ItemSearchModeToggleComponent } from '@shared/item-search-mode-toggle/item-search-mode-toggle.component';"

for path in forms:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'ItemSearchModeToggleComponent' in content:
        continue
    
    content = content.replace(
        "} from '@shared/item-search-modal/item-search-modal.component';",
        "} from '@shared/item-search-modal/item-search-modal.component';\n" + import_line
    )
    
    content = content.replace(
        '    ItemSearchModalComponent,',
        '    ItemSearchModalComponent,\n    ItemSearchModeToggleComponent,'
    )
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed', path)
