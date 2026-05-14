#!/usr/bin/env python3
"""
Script para migrar tablas manuales a luna-data-table.
Extrae el contenido EXACTO de cada <td> y lo coloca en el template #cell.
"""

import re
import sys
from pathlib import Path


def extract_tables(html_path: str):
    """Extrae las tablas manuales del HTML."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    pattern = r'<table class="lines-table">(.*?)</table>'
    tables = re.findall(pattern, content, re.DOTALL)
    
    results = []
    for i, table_html in enumerate(tables, 1):
        # Extraer headers
        thead_match = re.search(r'<thead>(.*?)</thead>', table_html, re.DOTALL)
        headers = []
        if thead_match:
            ths = re.findall(r'<th[^>]*>(.*?)</th>', thead_match.group(1), re.DOTALL)
            for th in ths:
                label = re.sub(r'<[^>]+>', '', th).strip()
                label = re.sub(r'\{\{.*?\}\}', '', label).strip()
                label = re.sub(r'\s+', ' ', label)
                headers.append(label if label else '')
        
        # Extraer una fila de muestra del tbody (la primera <tr> con formGroupName)
        tbody_match = re.search(r'<tbody[^>]*>(.*?)</tbody>', table_html, re.DOTALL)
        sample_cells = []
        if tbody_match:
            first_tr = re.search(r'<tr[^>]*>(.*?)</tr>', tbody_match.group(1), re.DOTALL)
            if first_tr:
                # Extraer <td> de la primera fila (puede tener nested tags)
                tds = re.findall(r'<td[^>]*>(.*?)</td>', first_tr.group(1), re.DOTALL)
                for td in tds:
                    sample_cells.append(td.strip())
        
        results.append({
            'index': i,
            'headers': headers,
            'sample_cells': sample_cells,
            'html': table_html
        })
    
    return results


def generate_ts_getters(tables):
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
            if j == len(table['headers']) - 1 and not h:
                lines.append(f"      {{ key: '{key}', label: '', type: 'actions' }},")
            else:
                # Escapar comillas simples
                safe_label = h.replace("'", "\\'")
                lines.append(f"      {{ key: '{key}', label: '{safe_label}', type: 'custom' }},")
        
        lines.append("    ];")
        lines.append("    return cols;")
        lines.append("  }")
        lines.append("")
        
        getters.append('\n'.join(lines))
    
    return '\n'.join(getters)


def transform_cell_content(cell_html: str) -> str:
    """Transforma el contenido de una celda para funcionar con Luna."""
    # Reemplazar line.get('field') por row.get('field')
    cell = re.sub(r'\bline\b', 'row', cell_html)
    # Reemplazar i por index en ciertos contextos (cuidadoso)
    # No reemplazamos globalmente porque podría afectar otras cosas
    # Pero en general, dentro de las celdas, i es el índice de la fila
    return cell


def generate_luna_table(table, tab_name: str):
    """Genera el HTML de luna-data-table para una tabla."""
    lines = []
    lines.append(f'      <luna-data-table')
    lines.append(f'        [data]="itemsArray.controls"')
    lines.append(f'        [formArray]="itemsArray"')
    lines.append(f'        [columns]="{tab_name}Columns"')
    lines.append(f'        [showPaginator]="false"')
    lines.append(f'        [trackByIndex]="true"')
    lines.append(f'        [sortable]="false">')
    lines.append('')
    lines.append('        <ng-template #cell let-row let-column="column" let-index="index">')
    lines.append('          @switch (column.key) {')
    
    for j, h in enumerate(table['headers']):
        key = f"col{j}"
        if j == len(table['headers']) - 1 and not h:
            continue
        
        lines.append(f"            @case ('{key}') {{")
        if j < len(table['sample_cells']):
            cell_content = transform_cell_content(table['sample_cells'][j])
            # Indentar el contenido
            for line in cell_content.split('\n'):
                lines.append(f"              {line}")
        else:
            lines.append(f"              <!-- {h} -->")
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
    
    return '\n'.join(lines)


def generate_all_luna_html(tables):
    """Genera el HTML de luna-data-table para todas las tablas."""
    tab_names = ['detail', 'discount', 'cost', 'tax', 'advance']
    results = []
    for i, table in enumerate(tables):
        tab = tab_names[i] if i < len(tab_names) else f'tab{i}'
        results.append(generate_luna_table(table, tab))
    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python migrate_to_luna_v2.py <html_file>")
        sys.exit(1)
    
    html_file = sys.argv[1]
    tables = extract_tables(html_file)
    
    print(f"Tables found: {len(tables)}\n")
    
    # Generar getters
    getters = generate_ts_getters(tables)
    print("=== TYPESCRIPT GETTERS ===")
    print(getters)
    print()
    
    # Generar HTML
    html_parts = generate_all_luna_html(tables)
    for i, part in enumerate(html_parts, 1):
        print(f"=== LUNA HTML TABLE {i} ===")
        print(part)
        print()


if __name__ == '__main__':
    main()
