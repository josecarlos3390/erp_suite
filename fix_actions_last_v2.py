import os
import re

base = r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages'

results = []
for root, dirs, files in os.walk(base):
    for f in files:
        if f.endswith('-form.component.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
            if "get detailColumns" in content and "'projectCode'" in content:
                actions_idx = content.find("{ key: 'actions'")
                proj_idx = content.find("{ key: 'projectCode'")
                if actions_idx != -1 and proj_idx != -1 and actions_idx < proj_idx:
                    results.append(path)

for path in results:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the start and end of the dimension block and actions block
    dim_start = None
    dim_end = None
    actions_start = None
    actions_end = None

    for i, line in enumerate(lines):
        if dim_start is None and "{ key: 'projectCode'" in line:
            # Go back to find the cols.push( or the start of the push
            for j in range(i, -1, -1):
                if 'cols.push(' in lines[j]:
                    dim_start = j
                    break
            # Go forward to find the closing );
            for j in range(i, len(lines)):
                if ');' in lines[j] and dim_start is not None:
                    dim_end = j
                    break

    for i, line in enumerate(lines):
        if actions_start is None and "{ key: 'actions'" in line:
            # Go back to find the if statement
            for j in range(i, -1, -1):
                if 'if ' in lines[j] and ('canEdit' in lines[j] or 'deliveryId' in lines[j] or 'orderId' in lines[j] or 'receiptId' in lines[j]):
                    actions_start = j
                    break
            # Go forward to find the closing brace or semicolon
            for j in range(i, len(lines)):
                if j > i and (lines[j].strip() == '}' or lines[j].strip().endswith('};')):
                    actions_end = j
                    break
                if j > i and lines[j].strip().endswith(');') and 'actions' in lines[j]:
                    actions_end = j
                    break

    if dim_start is None or dim_end is None or actions_start is None or actions_end is None:
        print(f'WARN: could not find blocks in {path}')
        print(f'  dim_start={dim_start} dim_end={dim_end} actions_start={actions_start} actions_end={actions_end}')
        continue

    # Extract blocks
    dim_block = lines[dim_start:dim_end+1]
    actions_block = lines[actions_start:actions_end+1]

    # Ensure actions is before dim in the original
    if actions_start > dim_start:
        print(f'SKIP: already correct order in {path}')
        continue

    # Build new lines: remove both blocks, then insert dim before actions
    new_lines = []
    i = 0
    while i < len(lines):
        if i == actions_start:
            # Skip actions block, insert dim block instead
            new_lines.extend(dim_block)
            i = actions_end + 1
        elif i == dim_start:
            # Skip dim block, insert actions block instead
            new_lines.extend(actions_block)
            i = dim_end + 1
        else:
            new_lines.append(lines[i])
            i += 1

    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f'FIXED {path}')
