import os, re
src = r'D:\ProyectosPython\erp_suite\backend-erp\src'
imports = {}
for root, dirs, files in os.walk(src):
    for f in files:
        if not f.endswith('.ts'): continue
        path = os.path.join(root, f)
        mod = os.path.relpath(path, src).split(os.sep)[0]
        with open(path, 'r', encoding='utf-8') as fh:
            content = fh.read()
        for m in re.finditer(r"import\s+.*?\s+from\s+'([^']+)';", content):
            imp = m.group(1)
            if imp.startswith('src/'):
                target = imp.split('/')[1] if len(imp.split('/'))>1 else imp
                if target != mod:
                    imports.setdefault(mod, set()).add(target)
cycles = []
mods = list(imports.keys())
for a in mods:
    for b in imports.get(a, set()):
        if b in imports and a in imports.get(b, set()):
            pair = tuple(sorted([a,b]))
            if pair not in cycles:
                cycles.append(pair)
print('Ciclos 2-way:', len(cycles))
for c in cycles:
    print(c[0], '<->', c[1])
for a in mods:
    for b in imports.get(a, set()):
        for c in imports.get(b, set()):
            if c != a and a in imports.get(c, set()):
                print('Ciclo 3:', a, '->', b, '->', c, '->', a)
