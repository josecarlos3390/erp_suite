#!/usr/bin/env python3
"""
Script para migrar tablas manuales (<table class="lines-table">) a <luna-data-table>.
Genera los getters de columnas TypeScript y los templates HTML.
"""

import re
import sys
from pathlib import Path


def extract_tables(html_path: str):
    """Extrae las tablas manuales del HTML."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Encontrar cada tabla
    pattern = r'<table class="lines-table">(.*?)</table>'
    tables = re.findall(pattern, content, re.DOTALL)
    
    results = []
    for i, table_html in enumerate(tables, 1):
        # Extraer headers
        thead_match = re.search(r'<thead>(.*?)</thead>', table_html, re.DOTALL)
        if not thead_match:
            continue
        
        ths = re.findall(r'<th[^>]*>(.*?)</th>', thead_match.group(1), re.DOTALL)
        headers = []
        for th in ths:
            # Limpiar HTML interno y Angular bindings
            label = re.sub(r'<[^>]+>', '', th).strip()
            # Limpiar interpolaciones
            label = re.sub(r'\{\{.*?\}\}', '', label).strip()
            label = re.sub(r'\s+', ' ', label)
            headers.append(label if label else f'Col_{len(headers)}')
        
        results.append({
            'index': i,
            'headers': headers,
            'html': table_html
        })
    
    return results


def generate_column_getters(tables, prefix=''):
    """Genera los getters de columnas TypeScript."""
    getters = []
    tab_names = ['detail', 'discount', 'cost', 'tax', 'advance']
    
    for i, table in enumerate(tables):
        tab = tab_names[i] if i < len(tab_names) else f'tab{i}'
        getter_name = f'{tab}Columns'
        
        lines = [f"  get {getter_name}(): LunaColumn<any>[] {{"]
        lines.append(f"    const cols: LunaColumn<any>[] = [")
        
        for j, h in enumerate(table['headers']):
            key = f"col{j}"
            # Si es la última columna vacía, es actions
            if j == len(table['headers']) - 1 and not h.replace('_', ''):
                lines.append(f"      {{ key: '{key}', label: '', type: 'actions' }},")
            else:
                lines.append(f"      {{ key: '{key}', label: '{h}', type: 'custom' }},")
        
        lines.append("    ];")
        lines.append("    return cols;")
        lines.append("  }")
        lines.append("")
        
        getters.append('\n'.join(lines))
    
    return '\n'.join(getters)


def generate_luna_html(tables):
    """Genera el HTML de reemplazo para cada tabla."""
    templates = []
    tab_names = ['detail', 'discount', 'cost', 'tax', 'advance']
    
    for i, table in enumerate(tables):
        tab = tab_names[i] if i < len(tab_names) else f'tab{i}'
        columns_getter = f'{tab}Columns'
        
        lines = []
        lines.append(f'      <luna-data-table')
        lines.append(f'        [data]="itemsArray.controls"')
        lines.append(f'        [formArray]="itemsArray"')
        lines.append(f'        [columns]="{columns_getter}"')
        lines.append(f'        [showPaginator]="false"')
        lines.append(f'        [trackByIndex]="true"')
        lines.append(f'        [sortable]="false">')
        lines.append('')
        lines.append('        <ng-template #cell let-row let-column="column" let-index="index">')
        lines.append('          @switch (column.key) {')
        
        for j, h in enumerate(table['headers']):
            key = f"col{j}"
            if j == len(table['headers']) - 1 and not h.replace('_', ''):
                continue  # actions column handled separately
            lines.append(f"            @case ('{key}') {{")
            lines.append(f"              <!-- {h} -->")
            lines.append("              <span>TODO: migrate cell content</span>")
            lines.append("            }")
        
        lines.append('          }')
        lines.append('        </ng-template>')
        lines.append('')
        lines.append('        <ng-template #actions let-row let-index="index">')
        lines.append('          <luna-button')
        lines.append('            variant="destructive"')
        lines.append('            size="sm"')
        lines.append('            (lunaClick)="removeItem(index)"')
        lines.append('            text="✕"')
        lines.append('          ></luna-button>')
        lines.append('        </ng-template>')
        lines.append('      </luna-data-table>')
        lines.append('')
        
        templates.append('\n'.join(lines))
    
    return templates


def main():
    forms = [
        'erp-frontend/src/app/pages/purchase-quotations/purchase-quotations-form.component.html',
        'erp-frontend/src/app/pages/delivery-orders/delivery-orders-form.component.html',
        'erp-frontend/src/app/pages/purchase-orders/purchase-orders-form.component.html',
        'erp-frontend/src/app/pages/purchase-receipts/purchase-receipts-form.component.html',
        'erp-frontend/src/app/pages/sale-reserve-invoices/sale-reserve-invoices-form.component.html',
        'erp-frontend/src/app/pages/purchase-reserve-invoices/purchase-reserve-invoices-form.component.html',
        'erp-frontend/src/app/pages/sale-invoices/sale-invoices-form.component.html',
        'erp-frontend/src/app/pages/purchase-invoices/purchase-invoices-form.component.html',
    ]
    
    for form_html in forms:
        print(f"\n{'='*60}")
        print(f"FORM: {form_html}")
        print(f"{'='*60}")
        
        tables = extract_tables(form_html)
        print(f"Tables found: {len(tables)}")
        
        for t in tables:
            print(f"\n  Table {t['index']}: {t['headers']}")
        
        # Generate column getters
        getters = generate_column_getters(tables)
        print(f"\n--- Column Getters ---")
        print(getters[:500] + "...")
        
        # Generate HTML
        html_parts = generate_luna_html(tables)
        print(f"\n--- Luna HTML (first table) ---")
        print(html_parts[0][:500] + "...")


if __name__ == '__main__':
    main()
