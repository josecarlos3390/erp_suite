#!/usr/bin/env python3
"""Fix frontend line customFields: fb.group initialization and payload."""
import os
import re

BASE = r"D:\ProyectosPython\erp_suite\erp-frontend\src\app\pages"

DOCUMENTS = [
    "sales-quotations", "sales-orders", "delivery-orders",
    "sale-invoices", "sale-reserve-invoices",
    "sales-returns", "sales-credit-notes",
    "purchase-quotations", "purchase-orders", "purchase-receipts",
    "purchase-invoices", "purchase-reserve-invoices",
    "purchase-returns", "purchase-credit-notes",
]

def fix_fb_group(content):
    """Add customFields: this.fb.group({}) to line fb.group blocks inside itemsArray.push."""
    # Pattern: this.itemsArray.push(\n      this.fb.group({\n        ...
    # We need to add customFields before the closing })
    
    # Find all itemsArray.push followed by fb.group
    pattern = re.compile(r'(this\.itemsArray\.push\(\s*\n\s*this\.fb\.group\(\{)')
    
    def replacer(m):
        start = m.start()
        # Find the matching })) or }) or }),
        # We need to find the closing of fb.group({...})
        # This is tricky. Let's find from start forward.
        brace_count = 0
        i = start
        group_start = -1
        while i < len(content):
            if content[i:i+14] == 'this.fb.group(':
                if group_start == -1:
                    group_start = i + 14  # position after 'this.fb.group('
            if group_start != -1:
                if content[i] == '{':
                    brace_count += 1
                elif content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        # Found the closing of fb.group({})
                        # Check if customFields is already there
                        block = content[group_start:i]
                        if 'customFields' in block:
                            return content[start:i+1]  # no change
                        # Insert customFields before the closing }
                        # Find the last property (look for comma before closing)
                        insert_pos = i
                        return content[start:insert_pos] + ',\n          customFields: this.fb.group({})' + content[insert_pos:i+1]
            i += 1
        return content[start:i]  # fallback
    
    # Actually, a simpler approach: use regex to find fb.group blocks and check context
    # But regex with nested braces is hard. Let's use a simpler heuristic.
    
    # Find positions of "this.itemsArray.push("
    result = content
    offset = 0
    for m in re.finditer(r'this\.itemsArray\.push\(', content):
        pos = m.start()
        # Find the fb.group call inside
        fg_match = re.search(r'this\.fb\.group\(\{', content[pos:pos+500])
        if not fg_match:
            continue
        fg_start = pos + fg_match.start()
        # Find the matching closing brace of the object literal
        brace = 0
        j = fg_start + len('this.fb.group({')
        found = False
        while j < len(content):
            if content[j] == '{':
                brace += 1
            elif content[j] == '}':
                brace -= 1
                if brace == 0:
                    found = True
                    break
            j += 1
        if not found:
            continue
        # Check if customFields is in this block
        block = content[fg_start:j+1]
        if 'customFields' in block:
            continue
        # Insert customFields before the last }
        # Find the last non-whitespace/comma before }
        k = j - 1
        while k > fg_start and content[k] in ' \t\n,':
            k -= 1
        insert = ',\n          customFields: this.fb.group({})'
        result = result[:k+1] + insert + result[j:]
        offset += len(insert)
    
    return result

def fix_line_payload(content):
    """Add customFields: rv.customFields ?? {} to items: ...map blocks."""
    # Find all items: ...controls.map blocks
    # Pattern items: this.itemsArray.controls.map((l) => ({ or .map((ctrl) => ({
    pattern = re.compile(r'items:\s*\w+.*?\.map\s*\(\s*\(\s*\w+\s*\)\s*=>\s*\(\{')
    
    result = content
    for m in pattern.finditer(content):
        start = m.end() - 1  # position at the opening {
        # Find the matching })
        brace = 1
        j = start + 1
        while j < len(content) and brace > 0:
            if content[j] == '{':
                brace += 1
            elif content[j] == '}':
                brace -= 1
            j += 1
        # j now points after the closing }
        block = content[start:j]
        if 'customFields' in block:
            continue
        # Find the variable name used in the map (l, ctrl, rv, etc.)
        var_match = re.search(r'\((\w+)\)\s*=>\s*\(\{', content[m.start():m.end()])
        var_name = var_match.group(1) if var_match else 'rv'
        # If var_name is not 'rv', we need to construct the payload accordingly
        # Common patterns: (l) => ({...}), (ctrl) => ({...})
        if var_name == 'l':
            payload_key = 'l.getRawValue().customFields'
        elif var_name == 'ctrl':
            payload_key = 'ctrl.getRawValue().customFields'
        else:
            payload_key = f'{var_name}.customFields'
        
        # Insert before the closing })
        # Find the last non-whitespace before })
        k = j - 1
        while k > start and content[k] in ' \t\n,':
            k -= 1
        insert = f',\n            customFields: {payload_key} ?? {{}}'
        result = result[:k+1] + insert + result[j-1:]
    
    return result

def main():
    for doc in DOCUMENTS:
        ts_path = os.path.join(BASE, doc, f"{doc}-form.component.ts")
        if not os.path.exists(ts_path):
            print(f"NOT FOUND: {ts_path}")
            continue
        
        with open(ts_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        original = content
        content = fix_fb_group(content)
        content = fix_line_payload(content)
        
        if content != original:
            with open(ts_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"FIXED: {doc}")
        else:
            print(f"SKIP: {doc}")

if __name__ == "__main__":
    main()
