import os

base = r'D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages'
files = []
for root, dirs, fnames in os.walk(base):
    for f in fnames:
        if f.endswith('-form.component.html'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
            if 'appDocumentLineTab="discounts"' in content and 'class="col-tax"' in content:
                files.append(path)

for p in files:
    print(p)
