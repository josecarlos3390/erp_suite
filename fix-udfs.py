#!/usr/bin/env python3
"""Script para arreglar errores del patch masivo de UDFs."""
import os
import re

BASE = r"D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages"

DOCUMENTS = [
    "purchase-quotations", "purchase-orders", "purchase-receipts",
    "delivery-orders", "sale-invoices", "purchase-invoices",
    "sale-reserve-invoices", "purchase-reserve-invoices",
    "sales-orders", "sales-returns", "purchase-returns",
    "sales-credit-notes", "purchase-credit-notes",
]

for name in DOCUMENTS:
    ts_path = os.path.join(BASE, name, f"{name}-form.component.ts")
    with open(ts_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Verificar/Agregar imports de UdfService y UserDefinedField
    if "UdfService" not in content:
        # Insertar import
        imp = "import { UdfService, UserDefinedField } from '@shared/udf/udf.service';"
        lines = content.split("\n")
        idx = 0
        for i, line in enumerate(lines):
            if line.startswith("import ") and ("@shared/" in line or "@core/" in line):
                idx = i + 1
        lines.insert(idx, imp)
        content = "\n".join(lines)

    # 2. Verificar/Agregar import de UdfFormSectionComponent
    if "UdfFormSectionComponent" not in content:
        imp = "import { UdfFormSectionComponent } from '@shared/udf-form-section/udf-form-section.component';"
        lines = content.split("\n")
        idx = 0
        for i, line in enumerate(lines):
            if line.startswith("import ") and ("@shared/" in line or "@core/" in line):
                idx = i + 1
        lines.insert(idx, imp)
        content = "\n".join(lines)

    # 3. Verificar/Agregar UdfFormSectionComponent al array de imports del @Component
    if "UdfFormSectionComponent," not in content:
        # Buscar el array de imports del @Component
        content = content.replace(
            "    LunaDataTableComponent,\n  ],",
            "    LunaDataTableComponent,\n    UdfFormSectionComponent,\n  ],"
        )
        if "UdfFormSectionComponent," not in content:
            content = content.replace(
                "    LunaDataTableComponent,\n    ],",
                "    LunaDataTableComponent,\n    UdfFormSectionComponent,\n    ],"
            )

    # 4. Eliminar duplicados de loadedCustomFields
    count = content.count("loadedCustomFields: Record<string, any> = {};")
    if count > 1:
        # Eliminar todos menos el primero
        lines = content.split("\n")
        new_lines = []
        found = False
        for line in lines:
            if "loadedCustomFields: Record<string, any> = {};" in line:
                if not found:
                    new_lines.append(line)
                    found = True
                else:
                    continue  # skip duplicate
            else:
                new_lines.append(line)
        content = "\n".join(new_lines)

    # 5. Verificar/Agregar inyección de udfService
    if "private udfService = inject(UdfService);" not in content:
        content = content.replace(
            "  private taxIndicatorsService = inject(TaxIndicatorsService);",
            "  private taxIndicatorsService = inject(TaxIndicatorsService);\n  private udfService = inject(UdfService);"
        )
        if "private udfService = inject(UdfService);" not in content:
            content = content.replace(
                "  private itemsService = inject(ItemsService);",
                "  private itemsService = inject(ItemsService);\n  private udfService = inject(UdfService);"
            )

    # 6. Verificar/Agregar lineUdfFields property
    if "lineUdfFields: UserDefinedField[] = [];" not in content:
        props = "\n  // ── Campos definidos por el usuario (UDF) ──────────────────────\n  loadedCustomFields: Record<string, any> = {};\n  lineUdfFields: UserDefinedField[] = [];"
        # Insertar después de showItemModal o similar
        if "  showItemModal = false;" in content:
            content = content.replace("  showItemModal = false;", "  showItemModal = false;" + props)
        elif "  showSerialSelector = false;" in content:
            content = content.replace("  showSerialSelector = false;", "  showSerialSelector = false;" + props)
        else:
            content = content.replace(
                "  override hasChanges = false;",
                "  override hasChanges = false;" + props
            )

    with open(ts_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Fixed: {ts_path}")
