#!/usr/bin/env python3
"""
Script para aplicar UDFs (cabecera + línea) a todos los formularios de documentos.
"""
import re
import os

BASE = r"D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages"

# Configuración de cada documento:
# - table_name: nombre de tabla para UDFs
# - has_header_udf: True si YA tiene app-udf-form-section para cabecera
# - line_method_name: nombre del método que crea el FormGroup de línea (ej: buildLineGroup)
# - add_method_name: nombre del método que agrega línea vacía (ej: addItem)
# - save_payload_pattern: fragmento de código donde insertar customFields en el payload
DOCUMENTS = [
    {
        "name": "purchase-quotations",
        "table_name": "PurchaseQuotation",
        "has_header_udf": False,
        "line_method_name": "buildLineGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "purchase-orders",
        "table_name": "PurchaseOrder",
        "has_header_udf": False,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "purchase-receipts",
        "table_name": "PurchaseReceipt",
        "has_header_udf": False,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "delivery-orders",
        "table_name": "DeliveryOrder",
        "has_header_udf": False,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "sale-invoices",
        "table_name": "SaleInvoice",
        "has_header_udf": False,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "purchase-invoices",
        "table_name": "PurchaseInvoice",
        "has_header_udf": False,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "sale-reserve-invoices",
        "table_name": "SaleReserveInvoice",
        "has_header_udf": False,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "purchase-reserve-invoices",
        "table_name": "PurchaseReserveInvoice",
        "has_header_udf": False,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "sales-orders",
        "table_name": "SalesOrder",
        "has_header_udf": True,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "sales-returns",
        "table_name": "SalesReturn",
        "has_header_udf": True,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "purchase-returns",
        "table_name": "PurchaseReturn",
        "has_header_udf": True,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "sales-credit-notes",
        "table_name": "SalesCreditNote",
        "has_header_udf": True,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
    {
        "name": "purchase-credit-notes",
        "table_name": "PurchaseCreditNote",
        "has_header_udf": True,
        "line_method_name": "buildItemGroup",
        "add_method_name": "addItem",
    },
]


def patch_ts(path, doc):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    table = doc["table_name"]
    has_header = doc["has_header_udf"]

    # 1. Imports
    udf_import = """import { UdfFormSectionComponent } from '@shared/udf-form-section/udf-form-section.component';
import { UdfService, UserDefinedField } from '@shared/udf/udf.service';"""

    if "UdfFormSectionComponent" not in content:
        # Insertar después del último import @shared/... o @core/...
        # Buscar una línea de import que sea buena referencia
        lines = content.split("\n")
        insert_idx = 0
        for i, line in enumerate(lines):
            if line.startswith("import ") and ("@shared/" in line or "@core/" in line or "@auth/" in line or "@models/" in line):
                insert_idx = i + 1
        lines.insert(insert_idx, udf_import)
        content = "\n".join(lines)

    # 2. Component imports array
    if "UdfFormSectionComponent," not in content:
        content = content.replace(
            "    LunaButtonComponent,\n    LunaDataTableComponent,",
            "    LunaButtonComponent,\n    LunaDataTableComponent,\n    UdfFormSectionComponent,"
        )
        # Fallback si no tiene LunaButtonComponent
        if "UdfFormSectionComponent," not in content:
            content = content.replace(
                "    LunaDataTableComponent,\n  ],",
                "    LunaDataTableComponent,\n    UdfFormSectionComponent,\n  ],"
            )

    # 3. Inyectar udfService
    if "private udfService = inject(UdfService);" not in content:
        content = content.replace(
            "  private taxIndicatorsService = inject(TaxIndicatorsService);",
            "  private taxIndicatorsService = inject(TaxIndicatorsService);\n  private udfService = inject(UdfService);"
        )
        # Fallback
        if "private udfService = inject(UdfService);" not in content:
            content = content.replace(
                "  private itemsService = inject(ItemsService);",
                "  private itemsService = inject(ItemsService);\n  private udfService = inject(UdfService);"
            )

    # 4. Propiedades
    props = "\n  // ── Campos definidos por el usuario (UDF) ──────────────────────\n  loadedCustomFields: Record<string, any> = {};\n  lineUdfFields: UserDefinedField[] = [];"
    if "lineUdfFields: UserDefinedField[] = [];" not in content:
        # Insertar después de una propiedad conocida
        if "  showItemModal = false;" in content:
            content = content.replace("  showItemModal = false;", "  showItemModal = false;" + props)
        elif "  showSerialSelector = false;" in content:
            content = content.replace("  showSerialSelector = false;", "  showSerialSelector = false;" + props)
        else:
            # Buscar alguna propiedad booleana típica
            content = content.replace(
                "  override hasChanges = false;",
                "  override hasChanges = false;" + props
            )

    # 5. Precargar UDFs en ngOnInit (después de this.form = this.fb.group)
    preload = f"""      // Precargar UDFs de línea para evitar N llamadas HTTP
      this.udfService.findAll('{table}').subscribe((fields) => {{
        this.lineUdfFields = fields.filter(
          (f) => f.appliesTo === 'LINE' && f.isActive,
        );
      }});

"""
    if "Precargar UDFs de línea" not in content:
        # Insertar después de la creación del form
        if "      this.form = this.fb.group({" in content:
            # Buscar el cierre del fb.group y el if/else siguiente
            pattern = r"(      this\.form = this\.fb\.group\(\{.*?\}\);)"
            match = re.search(pattern, content, re.DOTALL)
            if match:
                # Encontrar la siguiente línea después del form
                end = match.end()
                rest = content[end:]
                # Buscar el primer if o this.addItem
                next_lines = rest.split("\n")
                insert_after = 0
                for i, line in enumerate(next_lines):
                    if line.strip().startswith("if (") or line.strip().startswith("this.add"):
                        insert_after = i
                        break
                # Insertar antes de esa línea
                before = content[:end] + "\n".join(next_lines[:insert_after]) + "\n"
                after = "\n".join(next_lines[insert_after:])
                content = before + preload + after
        else:
            # Fallback: insertar al inicio de ngOnInit
            pass  # too complex, skip

    # 6. loadedCustomFields en método de carga
    cf_load = "      this.loadedCustomFields = q.customFields ?? {};"
    if "loadedCustomFields = q.customFields" not in content and "loadedCustomFields = doc.customFields" not in content:
        if has_header:
            # Ya tiene loadedCustomFields probablemente
            pass
        else:
            # Buscar el método load (varía por documento)
            # Patrón: .subscribe((q) => {\n      this.status =
            content = re.sub(
                r"(\.subscribe\(\(q\) => \{\n      this\.status = )",
                r"\1",
                content
            )
            # Too complex for regex, use a simpler approach:
            # Insertar después de la línea que asigna código/status
            lines = content.split("\n")
            for i, line in enumerate(lines):
                if "this.quotationCode = q.code" in line or "this.orderCode = q.code" in line or "this.invoiceCode = q.code" in line or "this.code = q.code" in line or "this.receiptCode = q.code" in line or "this.returnCode = q.code" in line or "this.documentCode = q.code" in line:
                    lines.insert(i + 1, cf_load)
                    break
                elif "this.status = q.status" in line:
                    # Buscar la siguiente línea vacía o que asigne algo
                    for j in range(i + 1, min(i + 5, len(lines))):
                        if lines[j].strip() == "" or "this." in lines[j]:
                            lines.insert(j, cf_load)
                            break
                    break
            content = "\n".join(lines)

    # 7. customFields en buildLineGroup
    if "customFields: [l.customFields ?? {}]," not in content:
        # Buscar el cierre del fb.group en buildLineGroup/createLineGroup
        # Patrón: alguna propiedad conocida seguida de });\n  }
        content = content.replace(
            "      taxAmount: [\n        {\n          value: l.taxAmount != null ? Number(l.taxAmount) : null,\n          disabled: true,\n        },\n      ],\n    });",
            "      taxAmount: [\n        {\n          value: l.taxAmount != null ? Number(l.taxAmount) : null,\n          disabled: true,\n        },\n      ],\n      customFields: [l.customFields ?? {}],\n    });"
        )
        # Fallback más simple
        if "customFields: [l.customFields ?? {}]," not in content:
            content = content.replace(
                "      taxIndicatorId: [l.taxIndicatorId ?? null],\n      taxRate:",
                "      taxIndicatorId: [l.taxIndicatorId ?? null],\n      customFields: [l.customFields ?? {}],\n      taxRate:"
            )
            content = content.replace(
                "      taxIndicatorId: [l.taxIndicatorId ?? null],\n      taxAmount:",
                "      taxIndicatorId: [l.taxIndicatorId ?? null],\n      customFields: [l.customFields ?? {}],\n      taxAmount:"
            )

    # 8. customFields en addItem
    if "customFields: [{}]," not in content:
        content = content.replace(
            "        taxIndicatorId: [null],\n        taxRate: [{ value: null, disabled: true }],\n        taxAmount: [{ value: null, disabled: true }],\n        itemName: [{ value: '', disabled: true }],",
            "        taxIndicatorId: [null],\n        taxRate: [{ value: null, disabled: true }],\n        taxAmount: [{ value: null, disabled: true }],\n        itemName: [{ value: '', disabled: true }],\n        customFields: [{}],"
        )

    # 9. customFields en payload
    if "customFields: rv.customFields ?? {}," not in content:
        content = content.replace(
            "            warehouseId: rv.warehouseId ?? null,\n            taxIndicatorId: rv.taxIndicatorId ?? null,",
            "            warehouseId: rv.warehouseId ?? null,\n            taxIndicatorId: rv.taxIndicatorId ?? null,\n            customFields: rv.customFields ?? {},"
        )
        # Fallback
        if "customFields: rv.customFields ?? {}," not in content:
            content = content.replace(
                "            taxIndicatorId: rv.taxIndicatorId ?? null,\n          };",
                "            taxIndicatorId: rv.taxIndicatorId ?? null,\n            customFields: rv.customFields ?? {},\n          };"
            )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Patched TS: {path}")


def patch_html(path, doc):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    table = doc["table_name"]
    has_header = doc["has_header_udf"]

    # 1. UDF cabecera (solo si no lo tiene)
    header_udf = f"""    <!-- Campos definidos por el usuario (UDF) — CABECERA -->
    <app-udf-form-section
      [formGroup]="form"
      tableName="{table}"
      appliesTo="HEADER"
      [initialValues]="loadedCustomFields"
    ></app-udf-form-section>

"""
    if not has_header and "Campos definidos por el usuario (UDF) — CABECERA" not in content:
        # Insertar antes de "<!-- Artículos -->" o similar
        if "    <!-- Artículos -->" in content:
            content = content.replace("    <!-- Artículos -->", header_udf + "    <!-- Artículos -->")
        elif "    <!-- ── SECCIÓN ARTÍCULOS ── -->" in content:
            content = content.replace("    <!-- ── SECCIÓN ARTÍCULOS ── -->", header_udf + "    <!-- ── SECCIÓN ARTÍCULOS ── -->")
        elif "    <!-- ─── Artículos ─────────────────────────────────────────────── -->" in content:
            content = content.replace("    <!-- ─── Artículos ─────────────────────────────────────────────── -->", header_udf + "    <!-- ─── Artículos ─────────────────────────────────────────────── -->")
        elif "    <!-- Artículos / Líneas -->" in content:
            content = content.replace("    <!-- Artículos / Líneas -->", header_udf + "    <!-- Artículos / Líneas -->")

    # 2. Pestaña UDFs
    tab_btn = f"""          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'udfs'"
            (click)="activeTab = 'udfs'"
            *ngIf="lineUdfFields.length > 0"
          >
            📎 Campos adicionales
          </button>
"""
    if "📎 Campos adicionales" not in content:
        # Insertar después de la última pestaña (antes del cierre del div tab-switcher)
        content = content.replace(
            "          </button>\n        </div>\n      </div>\n\n      <!-- ── PESTAÑA",
            "          </button>\n" + tab_btn + "        </div>\n      </div>\n\n      <!-- ── PESTAÑA"
        )
        # Fallback
        if "📎 Campos adicionales" not in content:
            content = content.replace(
                "          </button>\n        </div>\n\n      <!-- ── PESTAÑA",
                "          </button>\n" + tab_btn + "        </div>\n\n      <!-- ── PESTAÑA"
            )

    # 3. Contenido de pestaña UDFs
    udf_tab = """      <!-- ── PESTAÑA UDFs (línea) ── -->
      <ng-container *ngIf="activeTab === 'udfs'">
        <div class="udf-lines-list" *ngIf="itemsArray.length > 0; else noUdfLines">
          <div
            class="udf-line-card"
            *ngFor="let row of itemsArray.controls; let index = index"
          >
            <div class="udf-line-header">
              <span class="udf-line-num">Línea {{ index + 1 }}</span>
              <span class="udf-line-item" *ngIf="itemNameForRow(index)">{{ itemNameForRow(index) }}</span>
              <span class="udf-line-empty" *ngIf="!itemNameForRow(index)">— Sin artículo —</span>
            </div>
            <app-udf-form-section
              [formGroup]="$any(row)"
              tableName=""" + table + """
              appliesTo="LINE"
              [udfFields]="lineUdfFields"
            ></app-udf-form-section>
          </div>
        </div>
        <ng-template #noUdfLines>
          <div class="udf-empty-state">No hay líneas para mostrar campos adicionales.</div>
        </ng-template>
      </ng-container>

"""
    if "PESTAÑA UDFs (línea)" not in content:
        # Insertar antes del botón "Agregar artículo"
        content = content.replace(
            "      <button\n        type=\"button\"\n        class=\"btn-add-line\"",
            udf_tab + "      <button\n        type=\"button\"\n        class=\"btn-add-line\""
        )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Patched HTML: {path}")


def patch_scss(path):
    if not os.path.exists(path):
        # Crear archivo si no existe
        with open(path, "w", encoding="utf-8") as f:
            f.write(UDF_SCSS)
        print(f"  Created SCSS: {path}")
        return

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if ".udf-lines-list" not in content:
        content += "\n" + UDF_SCSS + "\n"
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  Patched SCSS: {path}")


UDF_SCSS = """
// ── UDFs por línea ──────────────────────────────────────────────
.udf-lines-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0;
}

.udf-line-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-elevated);
  overflow: hidden;
}

.udf-line-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.udf-line-num {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.udf-line-item {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.udf-line-empty {
  font-size: 0.875rem;
  font-style: italic;
  color: var(--color-text-muted);
}

.udf-empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}
"""


def main():
    for doc in DOCUMENTS:
        name = doc["name"]
        print(f"\nProcessing {name}...")
        ts_path = os.path.join(BASE, name, f"{name}-form.component.ts")
        html_path = os.path.join(BASE, name, f"{name}-form.component.html")
        scss_path = os.path.join(BASE, name, f"{name}-form.component.scss")

        if os.path.exists(ts_path):
            patch_ts(ts_path, doc)
        else:
            print(f"  TS NOT FOUND: {ts_path}")

        if os.path.exists(html_path):
            patch_html(html_path, doc)
        else:
            print(f"  HTML NOT FOUND: {html_path}")

        patch_scss(scss_path)


if __name__ == "__main__":
    main()
