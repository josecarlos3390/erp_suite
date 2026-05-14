#!/usr/bin/env python3
"""Precise audit of UDF support across documents."""
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

def find_file(dir_path, patterns):
    if not os.path.isdir(dir_path):
        return None
    for f in os.listdir(dir_path):
        for p in patterns:
            if re.match(p, f):
                return os.path.join(dir_path, f)
    return None

def audit():
    for doc in DOCUMENTS:
        print(f"\n{'='*60}")
        print(f"DOCUMENT: {doc}")
        print(f"{'='*60}")
        
        # === FRONTEND ===
        ts_path = os.path.join(BASE_FE, doc, f"{doc}-form.component.ts")
        fe_issues = []
        fe_ok = []
        
        if os.path.exists(ts_path):
            with open(ts_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Header payload
            if "getCustomFieldsPayload(this.form)" in content:
                fe_ok.append("Header payload has customFields")
            else:
                fe_issues.append("Header payload MISSING customFields")
            
            # Line FormGroup initialization
            if "customFields: this.fb.group(l.customFields" in content or "customFields: this.fb.group({" in content:
                fe_ok.append("Line FormGroup initialized as fb.group")
            else:
                # Check if it uses the old pattern
                if "customFields: [l.customFields" in content or "customFields: [{}]" in content:
                    fe_issues.append("Line customFields uses OLD FormControl pattern [l.customFields ?? {}]")
                else:
                    fe_issues.append("Line customFields fb.group NOT FOUND")
            
            # Line payload - look for .map blocks that build items
            # Count how many items: ...map blocks exist
            map_blocks = list(re.finditer(r'items:\s*\w+.*\.map\s*\(', content))
            line_payload_count = 0
            for m in map_blocks:
                start = m.start()
                # Find the end of this map block (closing }) or similar
                # Simpler: search forward for customFields in the next 500 chars
                segment = content[start:start+800]
                if "customFields" in segment:
                    line_payload_count += 1
            
            if len(map_blocks) == 0:
                fe_issues.append("No line payload map blocks found")
            elif line_payload_count < len(map_blocks):
                fe_issues.append(f"Line payload: {line_payload_count}/{len(map_blocks)} map blocks have customFields")
            else:
                fe_ok.append(f"All {len(map_blocks)} line payload map blocks have customFields")
        else:
            fe_issues.append("TS file not found")
        
        # === BACKEND DTO ===
        dto_dir = os.path.join(BASE_BE, doc)
        dto_issues = []
        dto_ok = []
        
        if os.path.isdir(dto_dir):
            create_dto = find_file(dto_dir, [r'create-.+\.dto\.ts'])
            update_dto = find_file(dto_dir, [r'update-.+\.dto\.ts'])
            
            for label, path in [("Create", create_dto), ("Update", update_dto)]:
                if not path:
                    dto_issues.append(f"{label} DTO not found")
                    continue
                with open(path, "r", encoding="utf-8") as f:
                    dto_content = f.read()
                
                # Header customFields
                if "customFields?: Record<string, any>" in dto_content or "customFields?: Record<string,any>" in dto_content:
                    dto_ok.append(f"{label} DTO header has customFields")
                else:
                    dto_issues.append(f"{label} DTO header MISSING customFields")
                
                # Item DTO customFields - find inner classes
                inner_classes = list(re.finditer(r'class\s+(\w+Item\w*Dto)\s*\{', dto_content))
                if not inner_classes:
                    inner_classes = list(re.finditer(r'class\s+(\w+Line\w*Dto)\s*\{', dto_content))
                
                for m in inner_classes:
                    cls_name = m.group(1)
                    start = m.start()
                    # Extract class body (rough)
                    brace = 0
                    i = start
                    while i < len(dto_content):
                        if dto_content[i] == '{':
                            brace += 1
                        elif dto_content[i] == '}':
                            brace -= 1
                            if brace == 0:
                                break
                        i += 1
                    cls_body = dto_content[start:i+1]
                    if "customFields" in cls_body:
                        dto_ok.append(f"{label} DTO {cls_name} has customFields")
                    else:
                        dto_issues.append(f"{label} DTO {cls_name} MISSING customFields")
        else:
            dto_issues.append("Backend dir not found")
        
        # === BACKEND SERVICE ===
        svc_path = os.path.join(BASE_BE, doc, f"{doc}.service.ts")
        svc_issues = []
        svc_ok = []
        
        if os.path.exists(svc_path):
            with open(svc_path, "r", encoding="utf-8") as f:
                svc = f.read()
            
            # Create header
            if "dto.customFields ??" in svc:
                svc_ok.append("Service create/update uses dto.customFields")
            else:
                svc_issues.append("Service MISSING dto.customFields")
            
            # Check if line operations include customFields
            # Look for patterns like customFields: (i as any).customFields or customFields: (incoming as any).customFields
            if "(i as any).customFields" in svc or "(incoming as any).customFields" in svc or "(l as any).customFields" in svc:
                svc_ok.append("Service line operations include customFields")
            else:
                svc_issues.append("Service line operations MISSING customFields")
        else:
            svc_issues.append("Service file not found")
        
        # Print results
        if fe_ok:
            print("  FRONTEND OK:")
            for i in fe_ok:
                print(f"    [OK] {i}")
        if fe_issues:
            print("  FRONTEND NEEDS FIX:")
            for i in fe_issues:
                print(f"    [FIX] {i}")
        
        if dto_ok:
            print("  DTO OK:")
            for i in dto_ok:
                print(f"    [OK] {i}")
        if dto_issues:
            print("  DTO NEEDS FIX:")
            for i in dto_issues:
                print(f"    [FIX] {i}")
        
        if svc_ok:
            print("  SERVICE OK:")
            for i in svc_ok:
                print(f"    [OK] {i}")
        if svc_issues:
            print("  SERVICE NEEDS FIX:")
            for i in svc_issues:
                print(f"    [FIX] {i}")

if __name__ == "__main__":
    audit()
