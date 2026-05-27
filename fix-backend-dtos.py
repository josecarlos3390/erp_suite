"""
Agrega projectCode, dimension1, dimension2 a todos los DTOs de línea
en los módulos de documentos comerciales del backend.
"""
import re, glob

FIELDS = """\n  @IsOptional()\n  @IsString()\n  projectCode?: string;\n\n  @IsOptional()\n  @IsString()\n  dimension1?: string;\n\n  @IsOptional()\n  @IsString()\n  dimension2?: string;"""

# Busca el bloque de imports de class-validator y agrega IsString si falta
def add_isstring_import(content: str) -> str:
    if 'IsString' in content:
        return content
    # Patrón: import { ..., IsOptional, ... } from 'class-validator';
    pattern = r"(import\s*\{[^}]*?)(\}\s*from\s*['\"]class-validator['\"];)"
    def repl(m):
        inner = m.group(1).rstrip()
        if inner.endswith(','):
            return f"{inner} IsString{m.group(2)}"
        return f"{inner}, IsString{m.group(2)}"
    return re.sub(pattern, repl, content, count=1)

# Agrega los campos antes del último } de cada clase export class
def add_fields_to_classes(content: str) -> str:
    # Divide en tokens de clase
    # Buscamos: export class Nombre { ... }
    # Agregamos los campos antes del } que cierra la clase
    # Usamos un approach simple: buscar el último } al final del archivo
    # y si antes hay propiedades de línea, agregamos los campos
    
    # Más simple: buscar "}\n}" o "}\n\n}" al final de clase
    # En su lugar, buscamos líneas que son solo "}" precedidas por indentación
    # y que están después de propiedades como quantity, price, etc.
    
    lines = content.split('\n')
    result = []
    in_class = False
    class_indent = 0
    brace_count = 0
    
    for i, line in enumerate(lines):
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        
        if stripped.startswith('export class '):
            in_class = True
            class_indent = indent
            brace_count = 0
        
        if in_class:
            for ch in stripped:
                if ch == '{':
                    brace_count += 1
                elif ch == '}':
                    brace_count -= 1
            
            # Si brace_count vuelve a 0 y estamos al nivel de indentación de la clase
            # y la línea es solo "}" con indentación, es el cierre de la clase
            if brace_count == 0 and stripped == '}' and indent == class_indent:
                # Verificar si la clase tiene propiedades de línea
                class_body = '\n'.join(result[class_indent:])
                if re.search(r'\b(quantity|price|itemId|warehouseId|discountPct)\b', class_body):
                    result.append(line[:indent] + FIELDS)
                in_class = False
        
        result.append(line)
    
    return '\n'.join(result)

modules = [
    'backend-erp/src/sales-orders/dto',
    'backend-erp/src/purchase-orders/dto',
    'backend-erp/src/sale-invoices/dto',
    'backend-erp/src/purchase-invoices/dto',
    'backend-erp/src/sale-reserve-invoices/dto',
]

updated = 0
for module in modules:
    for path in glob.glob(f'{module}/*.ts'):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'projectCode' in content:
            continue
        
        # Solo si parece un DTO de línea
        if not re.search(r'\b(quantity|price|itemId|warehouseId|discountPct)\b', content):
            continue
        
        new_content = add_isstring_import(content)
        new_content = add_fields_to_classes(new_content)
        
        if new_content != content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated: {path}')
            updated += 1

print(f'Total DTOs updated: {updated}')
