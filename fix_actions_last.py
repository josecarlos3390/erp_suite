import os

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
                    print(path)

print(f"\nTotal files with actions before projectCode: {len(results)}")
