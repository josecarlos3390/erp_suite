#!/usr/bin/env python3
"""Arregla customFields para que sea FormGroup en lugar de FormControl."""
import os
import re

BASE = r"D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages"

DOCUMENTS = [
    "purchase-quotations", "purchase-orders", "purchase-receipts",
    "delivery-orders", "sale-invoices", "purchase-invoices",
    "sale-reserve-invoices", "purchase-reserve-invoices",
    "sales-orders", "sales-returns", "purchase-returns",
    "sales-credit-notes", "purchase-credit-notes",
    "sales-quotations",
]

for name in DOCUMENTS:
    ts_path = os.path.join(BASE, name, f"{name}-form.component.ts")
    if not os.path.exists(ts_path):
        print(f"NOT FOUND: {ts_path}")
        continue

    with open(ts_path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # 1. En buildLineGroup / createLineGroup: customFields: [l.customFields ?? {}],
    #    → customFields: this.fb.group(l.customFields ?? {}),
    content = content.replace(
        "customFields: [l.customFields ?? {}],",
        "customFields: this.fb.group(l.customFields ?? {}),"
    )

    # 2. En addItem / addLine: customFields: [{}],
    #    → customFields: this.fb.group({}),
    content = content.replace(
        "customFields: [{}],",
        "customFields: this.fb.group({}),"
    )

    if content != original:
        with open(ts_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"FIXED: {ts_path}")
    else:
        print(f"SKIP: {ts_path}")
