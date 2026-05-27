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
        content = f.read()

    # Find the dimension block (cols.push with projectCode...)
    dim_match = re.search(
        r"(\s+cols\.push\(\n\s+\{ key: 'projectCode'.*?\n\s+\}\);)",
        content, re.DOTALL
    )
    if not dim_match:
        print(f'WARN: no dim block in {path}')
        continue
    dim_block = dim_match.group(1)

    # Find the actions block: it can be multiline if or single-line if
    # Try multiline first
    actions_match = re.search(
        r"(\s+if\s*\([^)]+\)\s*\{\n\s+cols\.push\(\{ key: 'actions'.*?\}\);\n\s+\}\n)(?=\s+cols\.push\(\n\s+\{ key: 'projectCode')",
        content, re.DOTALL
    )
    if not actions_match:
        # Try single-line if
        actions_match = re.search(
            r"(\s+if\s*\([^)]+\)\s+cols\.push\(\{ key: 'actions'.*?\}\);\n)(?=\s+cols\.push\(\n\s+\{ key: 'projectCode')",
            content, re.DOTALL
        )
    if not actions_match:
        print(f'WARN: no actions block in {path}')
        continue

    actions_block = actions_match.group(1)

    # Replace: remove both blocks and reinsert in correct order
    new_content = content.replace(dim_block, '', 1)
    new_content = new_content.replace(actions_block, '', 1)

    # Insert dim block before actions block
    insert_pos = new_content.find(actions_block.strip())
    if insert_pos == -1:
        # The actions_block was removed; find where it was by looking for the pattern after removal
        # Actually, since we removed both, we need to find the right spot.
        # The actions block was right before the dim block. After removing both,
        # we need to insert dim + actions where actions was.
        # Find the position using a marker: search for text after the original actions block
        pass

    # Simpler approach: just swap the two blocks directly in the original content
    original = content
    swapped = original.replace(actions_block + dim_block, dim_block + actions_block, 1)
    if swapped == original:
        print(f'WARN: swap did not change {path}')
        continue

    with open(path, 'w', encoding='utf-8') as f:
        f.write(swapped)
    print(f'FIXED {path}')
