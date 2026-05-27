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

    # Remove the incorrectly placed lines (bare object literals after if block)
    bad_block = """    if (this.canEdit) {
      cols.push({ key: 'actions', label: '', type: 'actions' });
    }
      { key: 'projectCode', label: 'Proy.', type: 'custom' },
      { key: 'dimension1', label: 'Dim1', type: 'custom' },
      { key: 'dimension2', label: 'Dim2', type: 'custom' },
    return cols;"""

    good_block = """    if (this.canEdit) {
      cols.push({ key: 'actions', label: '', type: 'actions' });
    }
    cols.push(
      { key: 'projectCode', label: 'Proy.', type: 'custom' },
      { key: 'dimension1', label: 'Dim1', type: 'custom' },
      { key: 'dimension2', label: 'Dim2', type: 'custom' },
    );
    return cols;"""

    if bad_block in content:
        content = content.replace(bad_block, good_block)
    else:
        # Try other patterns where actions may not exist
        bad_block2 = """    if (this.canEdit) cols.push({ key: 'actions', label: '', type: 'actions' });
      { key: 'projectCode', label: 'Proy.', type: 'custom' },
      { key: 'dimension1', label: 'Dim1', type: 'custom' },
      { key: 'dimension2', label: 'Dim2', type: 'custom' },
    return cols;"""
        good_block2 = """    if (this.canEdit) cols.push({ key: 'actions', label: '', type: 'actions' });
    cols.push(
      { key: 'projectCode', label: 'Proy.', type: 'custom' },
      { key: 'dimension1', label: 'Dim1', type: 'custom' },
      { key: 'dimension2', label: 'Dim2', type: 'custom' },
    );
    return cols;"""
        if bad_block2 in content:
            content = content.replace(bad_block2, good_block2)
        else:
            # Try pattern without actions at all
            bad_block3 = """      { key: 'projectCode', label: 'Proy.', type: 'custom' },
      { key: 'dimension1', label: 'Dim1', type: 'custom' },
      { key: 'dimension2', label: 'Dim2', type: 'custom' },
    return cols;"""
            good_block3 = """    cols.push(
      { key: 'projectCode', label: 'Proy.', type: 'custom' },
      { key: 'dimension1', label: 'Dim1', type: 'custom' },
      { key: 'dimension2', label: 'Dim2', type: 'custom' },
    );
    return cols;"""
            if bad_block3 in content:
                content = content.replace(bad_block3, good_block3)
            else:
                print(f'WARN: could not fix {path}')
                continue

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'FIXED {path}')
