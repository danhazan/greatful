#!/usr/bin/env python3
"""
Comprehensive configuration validation script
Checks all configuration files for placeholder values and common issues
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple

def check_file_for_placeholders(file_path: Path) -> Tuple[List[str], List[str]]:
    """Check a file for placeholder values and return issues and warnings"""
    if not file_path.exists():
        return [], [f"File not found: {file_path}"]
    
    issues = []
    warnings = []
    
    # Skip critical issue checking for template and example files
    is_template = any(keyword in file_path.name for keyword in ['.example', '.template'])
    if is_template:
        return [], [f"Template/example file - placeholders expected"]
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Define placeholder patterns
        critical_patterns = [
            (r'CHANGE_THIS_PASSWORD', 'Contains placeholder password'),
            (r'yourdomain\.com', 'Contains placeholder domain yourdomain.com'),
            (r'CHANGE-THIS-TO-A-SECURE', 'Contains placeholder secret key'),
            (r'GENERATE_NEW_SECRET_KEY', 'Contains placeholder secret key'),
        ]
        
        warning_patterns = [
            (r'localhost:5432.*grateful_prod', 'Production database on localhost'),
            (r'example\.com', 'Contains example.com domain'),
            (r'your-.*-here', 'Contains placeholder text'),
            (r'admin@localhost', 'Using localhost email (development only)'),
        ]
        
        # Check for critical issues
        for pattern, description in critical_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                matches = re.findall(f'.*{pattern}.*', content, re.IGNORECASE)
                for match in matches[:3]:  # Limit to first 3 matches
                    issues.append(f"{description}: {match.strip()}")
        
        # Check for warnings
        for pattern, description in warning_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                matches = re.findall(f'.*{pattern}.*', content, re.IGNORECASE)
                for match in matches[:2]:  # Limit to first 2 matches
                    warnings.append(f"{description}: {match.strip()}")
                    
    except Exception as e:
        issues.append(f"Error reading file: {e}")
    
    return issues, warnings

def validate_all_configs():
    """Validate all configuration files"""
    
    print("=== Configuration Validation Report ===\n")
    
    # Configuration files to check
    config_files = [
        Path("config/.env"),
        Path("config/.env.production"),
        Path("config/.env.production.example"),
        Path("config/.env.production.template"),
        Path("config/.env.railway"),
        Path("config/.env.monitoring"),
        Path("config/alembic.ini"),
        Path("railway.toml"),
    ]
    
    total_issues = 0
    total_warnings = 0
    
    for config_file in config_files:
        print(f"📁 Checking: {config_file}")
        
        issues, warnings = check_file_for_placeholders(config_file)
        
        if issues:
            print(f"  ❌ CRITICAL ISSUES ({len(issues)}):")
            for issue in issues:
                print(f"    - {issue}")
            total_issues += len(issues)
        
        if warnings:
            print(f"  ⚠️  WARNINGS ({len(warnings)}):")
            for warning in warnings:
                print(f"    - {warning}")
            total_warnings += len(warnings)
        
        if not issues and not warnings:
            print(f"  ✅ No issues found")
        
        print()
    
    # Summary
    print("=== SUMMARY ===")
    print(f"Total files checked: {len(config_files)}")
    print(f"Critical issues: {total_issues}")
    print(f"Warnings: {total_warnings}")
    
    if total_issues > 0:
        print("\n❌ CRITICAL ISSUES FOUND!")
        print("These issues will cause production failures and must be fixed.")
        return False
    elif total_warnings > 0:
        print("\n⚠️  Warnings found - review recommended")
        print("These may need attention depending on your deployment.")
        return True
    else:
        print("\n✅ All configuration files look good!")
        return True

def check_environment_variables():
    """Check current environment variables for issues"""
    print("\n=== Current Environment Variables ===")
    
    important_vars = [
        'DATABASE_URL',
        'FRONTEND_BASE_URL',
        'ALLOWED_ORIGINS',
        'SECRET_KEY',
        'ENVIRONMENT'
    ]
    
    for var in important_vars:
        value = os.environ.get(var, 'NOT SET')
        if value == 'NOT SET':
            print(f"  ⚠️  {var}: Not set")
        elif 'CHANGE_THIS' in value or 'yourdomain.com' in value:
            print(f"  ❌ {var}: Contains placeholder value")
        else:
            # Mask sensitive values
            if 'SECRET' in var or 'PASSWORD' in var:
                masked_value = value[:10] + '...' if len(value) > 10 else '***'
                print(f"  ✅ {var}: {masked_value}")
            else:
                print(f"  ✅ {var}: {value}")

if __name__ == "__main__":
    success = validate_all_configs()
    check_environment_variables()
    
    if success:
        print("\n🎉 Configuration validation completed successfully!")
    else:
        print("\n💥 Configuration validation failed - please fix critical issues!")
    
    exit(0 if success else 1)