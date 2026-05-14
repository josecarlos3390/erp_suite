#!/usr/bin/env python3
"""Agrega customFields a DTOs de línea y servicios del backend."""
import os
import re

BASE = r"D:\ProyectosPython\erp_suite\backend-erp\src"

# Documentos comerciales que manejan líneas
DOC_MODULES = [
    "sales-quotations", "purchase-quotations",
    "sales-orders", "purchase-orders",
    "delivery-orders",
    "purchase-receipts",
    "sale-invoices", "purchase-invoices",
    "sale-reserve-invoices", "purchase-reserve-invoices",
    "sales-returns", "purchase-returns",
    "sales-credit-notes", "purchase-credit-notes",
]

def patch_dtos():
    for mod in DOC_MODULES:
        dto_dir = os.path.join(BASE, mod, "dto")
        if not os.path.exists(dto_dir):
            continue
        for fname in os.listdir(dto_dir):
            if not fname.endswith(".dto.ts"):
                continue
            path = os.path.join(dto_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            original = content

            # Buscar clases ItemDto/LineDto que NO tengan customFields
            # Patrón: class XxxItemDto { ... } o class XxxLineDto { ... }
            # Agregar customFields antes del último } de la clase
            def add_cf_to_class(match):
                body = match.group(1)
                if "customFields" in body:
                    return match.group(0)
                # Buscar el último campo antes del cierre
                # Insertar customFields antes del último }
                # Buscar el patrón del último campo (generalmente termina con ; o sin ;)
                # Simplemente agregamos antes del último }
                idx = body.rfind("}")
                if idx == -1:
                    return match.group(0)
                # Buscar la última línea con un campo
                lines = body[:idx].rstrip().split("\n")
                # Insertar después de la última línea no vacía
                insert_idx = len(lines)
                for i in range(len(lines) - 1, -1, -1):
                    if lines[i].strip():
                        insert_idx = i + 1
                        break
                new_lines = lines[:insert_idx] + [
                    "",
                    "  @IsOptional()",
                    "  @IsObject()",
                    "  customFields?: Record<string, any>;",
                ] + lines[insert_idx:]
                new_body = "\n".join(new_lines) + body[idx:]
                return match.group(0).replace(body, new_body)

            # Reemplazar clases que terminan en ItemDto o LineDto
            content = re.sub(
                r"(export class \w+(?:Item|Line)Dto \{)(.*?)(\}\s*$)",
                lambda m: m.group(1) + add_cf_to_class(m).split("{", 1)[1].rsplit("}", 1)[0] + m.group(3),
                content,
                flags=re.DOTALL | re.MULTILINE,
            )

            # También clases internas sin export
            content = re.sub(
                r"(class \w+(?:Item|Line)Dto \{)(.*?)(\}\s*$)",
                lambda m: m.group(1) + add_cf_to_class(m).split("{", 1)[1].rsplit("}", 1)[0] + m.group(3),
                content,
                flags=re.DOTALL | re.MULTILINE,
            )

            if content != original:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"  Patched DTO: {path}")


def patch_services():
    for mod in DOC_MODULES:
        svc_path = os.path.join(BASE, mod, f"{mod.replace('-', '_')}.service.ts")
        if not os.path.exists(svc_path):
            # try alternative naming
            alt = os.path.join(BASE, mod, f"{mod}.service.ts")
            if os.path.exists(alt):
                svc_path = alt
            else:
                continue

        with open(svc_path, "r", encoding="utf-8") as f:
            content = f.read()
        original = content

        # 1. Agregar customFields a createMany
        content = re.sub(
            r"(taxAmount:\s*l\.taxAmount[,\s]*)(\n\s*\}\))",
            r"\1\n          customFields:   (l as any).customFields ?? {},\2",
            content,
        )

        # 2. Agregar customFields a .update({ data: { ... taxAmount: ... } })
        content = re.sub(
            r"(taxAmount:\s*[^,\n]+[,\s]*)(\n\s*\}\s*\}\);)",
            r"\1\n              customFields:  (incoming as any).customFields ?? undefined,\2",
            content,
        )

        # 3. Agregar customFields a .create({ data: { ... taxAmount: ... } })
        content = re.sub(
            r"(taxAmount:\s*[^,\n]+[,\s]*)(\n\s*\}\s*\}\);)",
            r"\1\n              customFields:  (incoming as any).customFields ?? {},\2",
            content,
        )

        if content != original:
            with open(svc_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  Patched SVC: {svc_path}")


if __name__ == "__main__":
    print("Patching DTOs...")
    patch_dtos()
    print("\nPatching services...")
    patch_services()
