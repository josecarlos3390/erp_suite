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

    # Replace multi-line import of ItemSearchModalComponent + ItemSearchResult
    content = content.replace(
        "import {\n  ItemSearchModalComponent,\n  ItemSearchResult,\n} from '@shared/item-search-modal/item-search-modal.component';",
        "import { ItemSearchResult } from '@shared/item-search-modal/item-search-modal.component';"
    )
    
    # Also try single-line version just in case
    content = content.replace(
        "import { ItemSearchModalComponent, ItemSearchResult } from '@shared/item-search-modal/item-search-modal.component';",
        "import { ItemSearchResult } from '@shared/item-search-modal/item-search-modal.component';"
    )

    # Remove from imports array
    content = content.replace(
        '    ItemSearchModalComponent,\n',
        ''
    )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed', path)
