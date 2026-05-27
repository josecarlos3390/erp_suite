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
            # Find detailColumns block
            m = re.search(r'(get detailColumns\(\).*?)(\n  get \w+\(\))', content, re.DOTALL)
            if not m:
                continue
            block = m.group(1)
            # Check if it ends correctly
            if not block.strip().endswith('}'):
                print(f'BROKEN: {path}')
                print(f'  Last 100 chars: {block[-100:]}')
