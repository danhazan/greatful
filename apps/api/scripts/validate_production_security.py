#!/usr/bin/env python3
"""
Production Security Validation Script

This script performs comprehensive security validation before production deployment.
Run this script to ensure all security configurations are properly set up.

Usage:
    python scripts/validate_production_security.py
    
Environment Variables:
    Set ENVIRONMENT=production to enable production-specific validations
"""

import os
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, List

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.production_security import (
    ProductionSecurityManager,
    SecurityConfigurationValidator
)
from app.core.security_monitoring import security_monitor
from app.core.security_config import security_config


def print_header(title: str):
    """Print a formatted header."""
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{title}:")
    print("-" * len(title + ":"))


def print_status(status: str, message: str, details: str = None):
    """Print a status message with color coding."""
    status_symbols = {
        "PASS": "✅",
        "FAIL": "❌",
        "WARN": "⚠️",
        "INFO": "ℹ️"
    }
    
    symbol = status_symbols.get(status, "•")
    print(f"{symbol} {message}")
    if details:
        print(f"   {details}")


def validate_environment_setup() -> bool:
    """Validate basic environment setup."""
    print_section("Environment Setup Validation")
    
    all_valid = True
    
    # Check Python version
    python_version = sys.version_info
    if python_version >= (3, 8):
        print_status("PASS", f"Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")
    else:
        print_status("FAIL", f"Python version too old: {python_version.major}.{python_version.minor}.{python_version.micro}")
        all_valid = False
    
    # Check required environment variables
    required_vars = ["SECRET_KEY", "DATABASE_URL"]
    for var in required_vars:
        if os.getenv(var):
            if var == "SECRET_KEY":
                # Don't print the actual secret key
                print_status("PASS", f"{var}: Set (length: {len(os.getenv(var))})")
            else:
                print_status("PASS", f"{var}: Set")
        else:
            print_status("FAIL", f"{var}: Not set")
            all_valid = False
    
    # Check environment type
    environment = os.getenv("ENVIRONMENT", "development")
    if environment == "production":
        print_status("INFO", f"Environment: {environment} (production mode enabled)")
    else:
        print_status("WARN", f"Environment: {environment} (not production)")
    
    return all_valid


def validate_security_configuration() -> bool:
    """Validate security configuration."""
    print_section("Security Configuration Validation")
    
    try:
        validation_result = ProductionSecurityManager.validate_production_security()
        
        if validation_result.is_valid:
            print_status("PASS", "Security configuration validation passed")
        else:
            print_status("FAIL", "Security configuration validation failed")
        
        # Print issues
        if validation_result.issues:
            print("\n   Critical Issues:")
            for issue in validation_result.issues:
                print_status("FAIL", issue)
        
        # Print warnings
        if validation_result.warnings:
            print("\n   Warnings:")
            for warning in validation_result.warnings:
                print_status("WARN", warning)
        
        # Print recommendations
        if validation_result.recommendations:
            print("\n   Recommendations:")
            for recommendation in validation_result.recommendations:
                print_status("INFO", recommendation)
        
        return validation_result.is_valid
        
    except Exception as e:
        print_status("FAIL", f"Security validation failed: {e}")
        return False


def validate_security_monitoring() -> bool:
    """Validate security monitoring system."""
    print_section("Security Monitoring Validation")
    
    try:
        # Check monitoring status
        if security_monitor.monitoring_enabled:
            print_status("PASS", "Security monitoring enabled")
        else:
            print_status("WARN", "Security monitoring disabled")
        
        # Check threat detection rules
        rule_count = len(security_monitor.threat_detection_rules)
        if rule_count > 0:
            print_status("PASS", f"Threat detection rules: {rule_count} active")
            for rule_name in security_monitor.threat_detection_rules.keys():
                print_status("INFO", f"  - {rule_name.replace('_', ' ').title()}")
        else:
            print_status("FAIL", "No threat detection rules configured")
            return False
        
        # Check alert handlers
        handler_count = len(security_monitor.alert_handlers)
        if handler_count > 0:
            print_status("PASS", f"Alert handlers: {handler_count} configured")
        else:
            print_status("WARN", "No alert handlers configured")
        
        return True
        
    except Exception as e:
        print_status("FAIL", f"Security monitoring validation failed: {e}")
        return False


def validate_jwt_configuration() -> bool:
    """Validate JWT token configuration."""
    print_section("JWT Token Configuration Validation")
    
    try:
        # Check secret key
        secret_key = security_config.secret_key
        if secret_key == "your-super-secret-key-change-this-in-production":
            print_status("FAIL", "SECRET_KEY is using default value")
            return False
        elif len(secret_key) < 32:
            print_status("FAIL", f"SECRET_KEY too short: {len(secret_key)} characters (minimum: 32)")
            return False
        else:
            print_status("PASS", f"SECRET_KEY length: {len(secret_key)} characters")
        
        # Check token expiration times
        access_expire = security_config.access_token_expire_minutes
        refresh_expire = security_config.refresh_token_expire_days
        
        if access_expire <= 60:
            print_status("PASS", f"Access token expiration: {access_expire} minutes")
        else:
            print_status("WARN", f"Access token expiration: {access_expire} minutes (consider ≤60 minutes)")
        
        if refresh_expire <= 90:
            print_status("PASS", f"Refresh token expiration: {refresh_expire} days")
        else:
            print_status("WARN", f"Refresh token expiration: {refresh_expire} days (consider ≤90 days)")
        
        return True
        
    except Exception as e:
        print_status("FAIL", f"JWT configuration validation failed: {e}")
        return False


def validate_cors_configuration() -> bool:
    """Validate CORS configuration."""
    print_section("CORS Configuration Validation")
    
    try:
        allowed_origins = security_config.allowed_origins
        
        if not allowed_origins:
            print_status("FAIL", "No CORS origins configured")
            return False
        
        print_status("PASS", f"CORS origins configured: {len(allowed_origins)}")
        
        # Check for production-safe origins
        has_https = False
        has_wildcard = False
        has_http_non_localhost = False
        
        for origin in allowed_origins:
            print_status("INFO", f"  - {origin}")
            
            if origin == "*":
                has_wildcard = True
            elif origin.startswith("https://"):
                has_https = True
            elif origin.startswith("http://") and "localhost" not in origin:
                has_http_non_localhost = True
        
        # Validate for production
        if security_config.is_production:
            if has_wildcard:
                print_status("FAIL", "Wildcard CORS origin (*) not allowed in production")
                return False
            
            if has_http_non_localhost:
                print_status("FAIL", "HTTP origins (non-localhost) not allowed in production")
                return False
            
            if not has_https:
                print_status("WARN", "No HTTPS origins configured for production")
        
        return True
        
    except Exception as e:
        print_status("FAIL", f"CORS configuration validation failed: {e}")
        return False


def validate_security_headers() -> bool:
    """Validate security headers configuration."""
    print_section("Security Headers Validation")
    
    try:
        headers = security_config.get_security_headers()
        
        required_headers = [
            "Content-Security-Policy",
            "X-Frame-Options",
            "X-Content-Type-Options",
        ]
        
        if security_config.is_production:
            required_headers.append("Strict-Transport-Security")
        
        all_present = True
        for header in required_headers:
            if header in headers:
                print_status("PASS", f"{header}: Present")
            else:
                print_status("FAIL", f"{header}: Missing")
                all_present = False
        
        # Check additional security headers
        additional_headers = [
            "Cross-Origin-Embedder-Policy",
            "Cross-Origin-Opener-Policy",
            "Permissions-Policy"
        ]
        
        for header in additional_headers:
            if header in headers:
                print_status("PASS", f"{header}: Present")
            else:
                print_status("INFO", f"{header}: Not configured (recommended)")
        
        return all_present
        
    except Exception as e:
        print_status("FAIL", f"Security headers validation failed: {e}")
        return False


def generate_security_report() -> Dict[str, Any]:
    """Generate a comprehensive security report."""
    try:
        status_report = SecurityConfigurationValidator.get_security_status_report()
        dashboard_data = security_monitor.get_security_dashboard_data()
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "validation_summary": {
                "overall_status": "SECURE" if status_report["validation_result"]["is_valid"] else "ISSUES_DETECTED",
                "issues_count": status_report["validation_result"]["issues_count"],
                "warnings_count": status_report["validation_result"]["warnings_count"],
                "recommendations_count": status_report["validation_result"]["recommendations_count"]
            },
            "configuration_status": status_report,
            "monitoring_status": dashboard_data
        }
    except Exception as e:
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": f"Failed to generate security report: {e}"
        }


def main():
    """Main validation function."""
    print_header("Production Security Validation")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    
    # Run all validations
    validations = [
        ("Environment Setup", validate_environment_setup),
        ("Security Configuration", validate_security_configuration),
        ("JWT Configuration", validate_jwt_configuration),
        ("CORS Configuration", validate_cors_configuration),
        ("Security Headers", validate_security_headers),
        ("Security Monitoring", validate_security_monitoring),
    ]
    
    results = {}
    overall_success = True
    
    for name, validator in validations:
        try:
            result = validator()
            results[name] = result
            if not result:
                overall_success = False
        except Exception as e:
            print_status("FAIL", f"{name} validation failed: {e}")
            results[name] = False
            overall_success = False
    
    # Print summary
    print_section("Validation Summary")
    
    for name, result in results.items():
        if result:
            print_status("PASS", f"{name}: Passed")
        else:
            print_status("FAIL", f"{name}: Failed")
    
    print_header("Overall Result")
    
    if overall_success:
        print_status("PASS", "All security validations passed!")
        print("\n🎉 Your application is ready for production deployment.")
        exit_code = 0
    else:
        print_status("FAIL", "Some security validations failed!")
        print("\n⚠️  Please fix the issues above before deploying to production.")
        exit_code = 1
    
    # Generate detailed report
    print_section("Detailed Security Report")
    report = generate_security_report()
    
    # Save report to file
    report_file = "security_validation_report.json"
    try:
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        print_status("INFO", f"Detailed report saved to: {report_file}")
    except Exception as e:
        print_status("WARN", f"Failed to save report: {e}")
    
    print("\n" + "=" * 60)
    return exit_code


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)