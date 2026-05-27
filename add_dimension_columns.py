import os
import re

BASE = r'D:\ProyectosPython\erp_suite'

forms = [
    ('erp-frontend/src/app/pages/sales-orders/sales-orders-form.component.ts',
     'erp-frontend/src/app/pages/sales-orders/sales-orders-form.component.html'),
    ('erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.ts',
     'erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.html'),
    ('erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.ts',
     'erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.html'),
    ('erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.ts',
     'erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.html'),
    ('erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.ts',
     'erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.html'),
    ('erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts',
     'erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.html'),
]

# Columns to add (before return cols; or before actions if present)
cols_to_add = """      { key: 'projectCode', label: 'Proy.', type: 'custom' },
      { key: 'dimension1', label: 'Dim1', type: 'custom' },
      { key: 'dimension2', label: 'Dim2', type: 'custom' },
"""

# HTML template snippet to add before closing @switch
html_snippet = """                                            @case ('projectCode') {
                                              <input
                                                type="text"
                                                class="line-dimension-input"
                                                [formControl]="row.get('projectCode')"
                                                placeholder="Proy."
                                                title="Código de proyecto"
                                                [attr.readonly]="!canEdit ? true : null"
                                              />
                                            }
                                            @case ('dimension1') {
                                              <input
                                                type="text"
                                                class="line-dimension-input"
                                                [formControl]="row.get('dimension1')"
                                                placeholder="Dim1"
                                                title="Dimensión 1"
                                                [attr.readonly]="!canEdit ? true : null"
                                              />
                                            }
                                            @case ('dimension2') {
                                              <input
                                                type="text"
                                                class="line-dimension-input"
                                                [formControl]="row.get('dimension2')"
                                                placeholder="Dim2"
                                                title="Dimensión 2"
                                                [attr.readonly]="!canEdit ? true : null"
                                              />
                                            }
"""

for ts_path, html_path in forms:
    ts_full = os.path.join(BASE, ts_path)
    html_full = os.path.join(BASE, html_path)

    # --- Update TS detailColumns ---
    with open(ts_full, 'r', encoding='utf-8') as f:
        content = f.read()

    if "{ key: 'projectCode'" in content:
        print(f'SKIP cols {ts_path}')
    else:
        # Find the last cols.push or single col push before return cols;
        # Pattern: look for the last push before "return cols;"
        # We'll insert before "return cols;"
        content = content.replace(
            '    return cols;\n  }\n\n  get discountColumns',
            cols_to_add + '    return cols;\n  }\n\n  get discountColumns'
        )
        # Also try without discountColumns (some files have other getters)
        if "{ key: 'projectCode'" not in content:
            content = content.replace(
                '    return cols;\n  }\n\n  ',
                cols_to_add + '    return cols;\n  }\n\n  ',
                1
            )
        with open(ts_full, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'FIXED cols {ts_path}')

    # --- Update HTML @switch ---
    with open(html_full, 'r', encoding='utf-8') as f:
        html = f.read()

    if "@case ('projectCode')" in html:
        print(f'SKIP html {html_path}')
        continue

    # Find @switch (column.key) blocks and add the cases before the closing }
    # We'll look for patterns like:
    #   @case ('actions') { ... }
    # }  <-- closing of @switch
    # </ng-template>
    # And insert before the last closing brace of @switch.

    # Heuristic: find all occurrences of "@switch (column.key)" and insert before the matching closing "}"
    # that appears before "</ng-template>" and after the last @case.

    # Simpler: replace the closing pattern of @switch for each #cell template
    # We need to handle multiple luna-data-table instances per file (some have 2 or 3)

    # Strategy: for each @switch (column.key) block, find its closing }
    # We'll use a simple regex to find the last @case before the closing } and insert after it.

    # Actually, let's just insert before "@case ('actions')" or before "@case ('lineStatus')" if no actions
    # or before the closing } of @switch if neither exists.

    # Let's try replacing specific patterns in each file
    inserted = False

    # Pattern 1: before @case ('actions')
    if "@case ('actions')" in html:
        html = html.replace(
            "@case ('actions')",
            html_snippet + "@case ('actions')"
        )
        inserted = True
    elif "@case ('lineStatus')" in html:
        html = html.replace(
            "@case ('lineStatus')",
            html_snippet + "@case ('lineStatus')"
        )
        inserted = True
    else:
        # Find the closing of @switch (column.key) blocks
        # Look for "}\n                                          </ng-template>" patterns
        # This is tricky; let's find the last "}" before "</ng-template>" that follows @switch
        switch_indices = [m.start() for m in re.finditer(r'@switch \(column\.key\)', html)]
        for idx in switch_indices:
            # Find the end of this @switch block (next "}\n" followed by whitespace and "</ng-template>")
            after = html[idx:]
            match = re.search(r'\}\s*\n\s*</ng-template>', after)
            if match:
                insert_pos = idx + match.start()
                html = html[:insert_pos] + html_snippet + html[insert_pos:]
                inserted = True
                break

    if inserted:
        with open(html_full, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'FIXED html {html_path}')
    else:
        print(f'WARN could not insert html {html_path}')
