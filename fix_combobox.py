import os

forms = [
    'erp-frontend/src/app/pages/sales-orders/sales-orders-form.component.ts',
    'erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.ts',
    'erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.ts',
    'erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.ts',
    'erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.ts',
    'erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts',
]

import_line = "import { ItemComboboxComponent } from '@shared/item-combobox/item-combobox.component';"

for path in forms:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'ItemComboboxComponent' in content:
        print(f'SKIP (already has import) {path}')
        continue

    # Add import after ItemSearchModalComponent import block
    content = content.replace(
        "} from '@shared/item-search-modal/item-search-modal.component';",
        "} from '@shared/item-search-modal/item-search-modal.component';\n" + import_line
    )

    # Add to imports array after ItemSearchModalComponent
    content = content.replace(
        '    ItemSearchModalComponent,',
        '    ItemSearchModalComponent,\n    ItemComboboxComponent,'
    )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'FIXED import {path}')
