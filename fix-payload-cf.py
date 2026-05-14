#!/usr/bin/env python3
"""Agrega customFields de cabecera al payload de guardado en formularios."""
import os

BASE = r"D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages"

FILES = [
    "purchase-quotations/purchase-quotations-form.component.ts",
    "purchase-orders/purchase-orders-form.component.ts",
    "purchase-receipts/purchase-receipts-form.component.ts",
    "delivery-orders/delivery-orders-form.component.ts",
    "sale-invoices/sale-invoices-form.component.ts",
    "purchase-invoices/purchase-invoices-form.component.ts",
    "sale-reserve-invoices/sale-reserve-invoices-form.component.ts",
    "purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts",
]

for rel in FILES:
    path = os.path.join(BASE, rel)
    if not os.path.exists(path):
        print(f"NOT FOUND: {path}")
        continue

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if "getCustomFieldsPayload" in content:
        print(f"SKIP (already has): {rel}")
        continue

    original = content

    # Buscar el payload y agregar customFields antes de 'items:'
    # Patrón: buscar una línea que termina con 'items:' o similar
    # Estrategia: buscar "items: this.itemsArray" o "items: validLines"
    # e insertar customFields antes
    import re

    # Patrón 1: items: this.itemsArray.controls
    content = re.sub(
        r"(      items: this\.itemsArray\.controls)",
        r"      customFields: this.getCustomFieldsPayload(this.form),\n\1",
        content,
    )

    # Patrón 2: items: validLines.map
    content = re.sub(
        r"(      items: validLines\.map)",
        r"      customFields: this.getCustomFieldsPayload(this.form),\n\1",
        content,
    )

    # Patrón 3: items: this.buildPayload
    content = re.sub(
        r"(      items: this\.buildPayload)",
        r"      customFields: this.getCustomFieldsPayload(this.form),\n\1",
        content,
    )

    # Patrón 4: items: payloadLines
    content = re.sub(
        r"(      items: payloadLines)",
        r"      customFields: this.getCustomFieldsPayload(this.form),\n\1",
        content,
    )

    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"FIXED: {rel}")
    else:
        print(f"NO MATCH: {rel}")
