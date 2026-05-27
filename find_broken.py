import os
import re

base = r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages'

for root, dirs, files in os.walk(base):
    for f in files:
        if f.endswith('-form.component.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
            if "get detailColumns" not in content:
                continue
            # Extract detailColumns block
            m = re.search(r'get detailColumns\(\).*?\n  \}', content, re.DOTALL)
            if not m:
                continue
            block = m.group(0)
            if "return cols;" not in block:
                print(f'MISSING return cols in detailColumns: {path}')
            if "{ key: 'actions'" not in block and "{ key: 'projectCode'" in block:
                print(f'MISSING actions in detailColumns: {path}')
