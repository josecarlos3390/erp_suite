import os
import re

base = r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages'

for root, dirs, files in os.walk(base):
    for f in files:
        if f.endswith('-form.component.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
            if "get detailColumns" not in content or "'projectCode'" not in content:
                continue
            m = re.search(r'get detailColumns\(\).*?return cols;', content, re.DOTALL)
            if not m:
                print(f'NO return cols in detailColumns: {path}')
                continue
            block = m.group(0)
            if "{ key: 'actions'" not in block:
                print(f'MISSING actions in detailColumns: {path}')
            if "{ key: 'projectCode'" not in block:
                print(f'MISSING projectCode in detailColumns: {path}')
            actions_idx = block.find("{ key: 'actions'")
            proj_idx = block.find("{ key: 'projectCode'")
            if actions_idx != -1 and proj_idx != -1 and actions_idx < proj_idx:
                print(f'WRONG ORDER (actions before projectCode): {path}')
