#!/usr/bin/env python3
import json
import os
import sys

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    shared_path = os.path.join(root_dir, 'shared', 'reactions.json')
    
    if not os.path.exists(shared_path):
        print(f"Error: {shared_path} not found.")
        sys.exit(1)
        
    with open(shared_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    inventory = data.get('inventory', [])
    popular_by_group = data.get('popular_by_group', {})
    legacy_mappings = data.get('legacy_mappings', {})
    
    valid_groups = {'heart', 'face', 'hands', 'misc'}
    canonical_codes = set()
    
    # 1. Validation
    for item in inventory:
        code = item.get('code')
        if not code:
            print("Error: Missing code in inventory item.")
            sys.exit(1)
        if code in canonical_codes:
            print(f"Error: Duplicate code in inventory: {code}")
            sys.exit(1)
        canonical_codes.add(code)
        
        group = item.get('group')
        if group not in valid_groups:
            print(f"Error: Invalid group '{group}' for code '{code}'.")
            sys.exit(1)
            
    for group, codes in popular_by_group.items():
        if group not in valid_groups:
            print(f"Error: Invalid group '{group}' in popular_by_group.")
            sys.exit(1)
        if len(codes) != len(set(codes)):
            print(f"Error: Duplicates found in popular_by_group for '{group}'.")
            sys.exit(1)
        for code in codes:
            if code not in canonical_codes:
                print(f"Error: Popular code '{code}' in group '{group}' not in inventory.")
                sys.exit(1)
                
    for legacy, canonical in legacy_mappings.items():
        if canonical not in canonical_codes:
            print(f"Error: Legacy mapping target '{canonical}' not in inventory.")
            sys.exit(1)
            
    # 2. Generate Python Artifact
    py_path = os.path.join(root_dir, 'apps', 'api', 'app', 'generated', 'reactions.py')
    os.makedirs(os.path.dirname(py_path), exist_ok=True)
    
    with open(py_path, 'w', encoding='utf-8') as f:
        f.write("# AUTO-GENERATED FILE. DO NOT EDIT.\n")
        f.write("# Generated from shared/reactions.json\n\n")
        
        f.write(f"VALID_EMOJIS = {{\n")
        for item in inventory:
            f.write(f"    '{item['code']}': '{item['character']}',\n")
        f.write("}\n\n")
        
        f.write(f"VALID_GROUPS = {valid_groups}\n\n")
        
        f.write("POPULAR_BY_GROUP = {\n")
        for group, codes in popular_by_group.items():
            f.write(f"    '{group}': {codes},\n")
        f.write("}\n\n")
        
        f.write("LEGACY_MAPPINGS = {\n")
        for legacy, canonical in legacy_mappings.items():
            f.write(f"    '{legacy}': '{canonical}',\n")
        f.write("}\n")
        
    # 3. Generate TypeScript Artifact
    ts_path = os.path.join(root_dir, 'apps', 'web', 'src', 'generated', 'reactions.ts')
    os.makedirs(os.path.dirname(ts_path), exist_ok=True)
    
    with open(ts_path, 'w', encoding='utf-8') as f:
        f.write("/**\n")
        f.write(" * AUTO-GENERATED FILE. DO NOT EDIT.\n")
        f.write(" * Generated from shared/reactions.json\n")
        f.write(" */\n\n")
        
        f.write("export interface ReactionItem {\n")
        f.write("  code: string;\n")
        f.write("  character: string;\n")
        f.write("  label: string;\n")
        f.write("  group: string;\n")
        f.write("}\n\n")
        
        f.write("export const REACTION_INVENTORY: ReactionItem[] = ")
        json.dump(inventory, f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        
        f.write("export const POPULAR_BY_GROUP: Record<string, string[]> = ")
        json.dump(popular_by_group, f, indent=2)
        f.write(";\n\n")
        
        f.write("export const LEGACY_MAPPINGS: Record<string, string> = ")
        json.dump(legacy_mappings, f, indent=2)
        f.write(";\n\n")
        
        f.write("export const VALID_GROUPS = ['heart', 'face', 'hands', 'misc'] as const;\n")
        f.write("export type ReactionGroup = typeof VALID_GROUPS[number];\n\n")
        
        f.write("const inventoryByCode = new Map(REACTION_INVENTORY.map(item => [item.code, item]));\n\n")
        f.write("export function getReactionByCode(code: string): ReactionItem | undefined {\n")
        f.write("  return inventoryByCode.get(code) || inventoryByCode.get(LEGACY_MAPPINGS[code] || '');\n")
        f.write("}\n\n")
        
        f.write("export function getEmojiFromCode(code: string): string {\n")
        f.write("  const reaction = getReactionByCode(code);\n")
        f.write("  return reaction?.character || '👍';\n")
        f.write("}\n\n")

        f.write("export function getAvailableEmojis(): { code: string; emoji: string; label: string }[] {\n")
        f.write("  return REACTION_INVENTORY.map(item => ({ code: item.code, emoji: item.character, label: item.label }));\n")
        f.write("}\n\n")

        f.write("export function getTopEmojis(emojiCounts: Record<string, number>, limit: number = 3): { code: string; count: number }[] {\n")
        f.write("  if (!emojiCounts) return [];\n")
        f.write("  return Object.entries(emojiCounts)\n")
        f.write("    .sort((a, b) => b[1] - a[1])\n")
        f.write("    .slice(0, limit)\n")
        f.write("    .map(([code, count]) => ({ code, count }));\n")
        f.write("}\n\n")

        f.write("/**\n")
        f.write(" * Composes a compact row of exact length `slots`.\n")
        f.write(" * Prioritizes recent items, removes duplicates, and backfills with popular items.\n")
        f.write(" */\n")
        f.write("export function composeCompactRow(recentList: string[], popularList: string[], slots: number): string[] {\n")
        f.write("  const result: string[] = [];\n")
        f.write("  const seen = new Set<string>();\n\n")
        f.write("  // Add from recent first\n")
        f.write("  for (const code of recentList) {\n")
        f.write("    if (!seen.has(code) && inventoryByCode.has(code)) {\n")
        f.write("      result.push(code);\n")
        f.write("      seen.add(code);\n")
        f.write("      if (result.length === slots) return result;\n")
        f.write("    }\n")
        f.write("  }\n\n")
        f.write("  // Backfill with popular\n")
        f.write("  for (const code of popularList) {\n")
        f.write("    if (!seen.has(code) && inventoryByCode.has(code)) {\n")
        f.write("      result.push(code);\n")
        f.write("      seen.add(code);\n")
        f.write("      if (result.length === slots) return result;\n")
        f.write("    }\n")
        f.write("  }\n\n")
        f.write("  return result;\n")
        f.write("}\n")

    print("Successfully generated reaction artifacts.")

if __name__ == '__main__':
    main()
