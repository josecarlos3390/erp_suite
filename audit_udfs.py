#!/usr/bin/env python3
"""Audit UDF support across all commercial document forms and backend services."""
import os
import re

BASE_FE = r"D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages"
BASE_BE = r"D:\ProyectosPython\erp_suite\backend-erp\src"

DOCUMENTS = [
    "sales-quotations", "sales-orders", "delivery-orders",
    "sale-invoices", "sale-reserve-invoices",
    "sales-returns", "sales-credit-notes",
    "purchase-quotations", "purchase-orders", "purchase-receipts",
    "purchase-invoices", "purchase-reserve-invoices",
    "purchase-returns", "purchase-credit-notes",
]

def audit():
    for doc in DOCUMENTS:
        print(f"\n{'='*60}")
        print(f"DOCUMENT: {doc}")
        print(f"{'='*60}")
        
        # Frontend
        ts_path = os.path.join(BASE_FE, doc, f"{doc}-form.component.ts")
        html_path = os.path.join(BASE_FE, doc, f"{doc}-form.component.html")
        
        fe_issues = []
        if os.path.exists(ts_path):
            with open(ts_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            if "getCustomFieldsPayload(this.form)" not in content:
                fe_issues.append("Missing header customFields in payload")
            
            if "customFields: this.fb.group(l.customFields" not in content and "customFields: this.fb.group({" not in content:
                fe_issues.append("Missing fb.group for line customFields")
            
            # Check if line payload includes customFields
            if "customFields: rv.customFields" not in content and "customFields: l.getRawValue().customFields" not in content:
                fe_issues.append("Missing line customFields in payload map")
        else:
            fe_issues.append("TS file not found")
        
        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                html = f.read()
            if "app-udf-form-section" not in html:
                fe_issues.append("Missing UDF section in HTML")
        else:
            fe_issues.append("HTML file not found")
        
        # Backend DTO
        be_doc = doc.replace("-", "")
        dto_dir = os.path.join(BASE_BE, doc)
        dto_issues = []
        
        if os.path.isdir(dto_dir):
            create_dto = None
            update_dto = None
            for f in os.listdir(dto_dir):
                if f.startswith("create") and f.endswith(".dto.ts"):
                    create_dto = os.path.join(dto_dir, f)
                if f.startswith("update") and f.endswith(".dto.ts"):
                    update_dto = os.path.join(dto_dir, f)
            
            if create_dto and os.path.exists(create_dto):
                with open(create_dto, "r", encoding="utf-8") as f:
                    dto_content = f.read()
                if "customFields?: Record<string, any>" not in dto_content:
                    dto_issues.append("Create DTO missing customFields")
                # Check inner item DTO
                item_dto_match = re.search(r'class\s+\w+Item\w*Dto\s*\{', dto_content)
                if item_dto_match:
                    # Find the class and check if it has customFields
                    start = item_dto_match.start()
                    # rough extraction until next class or end of file
                    class_end = dto_content.find('\nclass ', start + 1)
                    if class_end == -1:
                        class_end = len(dto_content)
                    item_class = dto_content[start:class_end]
                    if "customFields" not in item_class:
                        dto_issues.append("Create DTO item class missing customFields")
            else:
                dto_issues.append("Create DTO not found")
        else:
            dto_issues.append("Backend dir not found")
        
        # Backend Service
        svc_path = os.path.join(BASE_BE, doc, f"{doc}.service.ts")
        svc_issues = []
        
        if os.path.exists(svc_path):
            with open(svc_path, "r", encoding="utf-8") as f:
                svc_content = f.read()
            
            # Check create method
            if "dto.customFields ??" not in svc_content:
                svc_issues.append("Service create missing customFields")
            
            # Check line customFields in create (createMany or loop)
            if "customFields" not in svc_content:
                svc_issues.append("Service missing any customFields")
            else:
                # Check if createMany or line creation includes customFields
                if "createMany" in svc_content:
                    # Find createMany block and check for customFields inside
                    createmany_blocks = []
                    for m in re.finditer(r'createMany\s*\(\s*\{', svc_content):
                        start = m.start()
                        brace_count = 0
                        i = start
                        while i < len(svc_content):
                            if svc_content[i] == '{':
                                brace_count += 1
                            elif svc_content[i] == '}':
                                brace_count -= 1
                                if brace_count == 0:
                                    break
                            i += 1
                        block = svc_content[start:i+1]
                        createmany_blocks.append(block)
                    
                    has_line_cf = any("customFields" in b for b in createmany_blocks)
                    if not has_line_cf:
                        svc_issues.append("Service createMany missing line customFields")
                
                # Check update method
                if re.search(r'update\s*\(', svc_content):
                    update_section = svc_content[svc_content.find("async update"):]
                    if "customFields" not in update_section[:2000]:
                        svc_issues.append("Service update missing customFields")
        else:
            svc_issues.append("Service file not found")
        
        if fe_issues:
            print("  FRONTEND ISSUES:")
            for i in fe_issues:
                print(f"    - {i}")
        else:
            print("  FRONTEND: OK")
        
        if dto_issues:
            print("  BACKEND DTO ISSUES:")
            for i in dto_issues:
                print(f"    - {i}")
        else:
            print("  BACKEND DTO: OK")
        
        if svc_issues:
            print("  BACKEND SERVICE ISSUES:")
            for i in svc_issues:
                print(f"    - {i}")
        else:
            print("  BACKEND SERVICE: OK")

if __name__ == "__main__":
    audit()
