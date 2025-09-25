#!/usr/bin/env python3
"""
Production Configuration Setup Script

This script sets up and validates production configuration for secure deployment.
It generates secure secrets, validates HTTPS settings, and ensures all security
configurations are properly set for production deployment.

Usage:
    python scripts/setup_production_config.py [--validate-only]
    
Options:
    --validate-only    Only validate existing configuration without making changes
"""

import os
import sys
import json
import secrets
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from config/.env
env_path = Path(__file__).parent.parent / "config" / ".env"
if env_path.exists():
    load_dotenv(env_path)
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.security_config import SecurityConfig
from app.core.security import SECRET_KEY


class ProductionConfigManager:
    """Manages production configuration setup and validation."""
    
    def __init__(self, validate_only: bool = False):
        self.validate_only = validate_only
        self.config_file = Path(__file__).parent.parent / "config" / ".env"
        self.results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "operation": "validate" if validate_only else "setup",
            "validations": {},
            "changes_made": [],
            "recommendations": [],
            "security_status": "unknown"
        }
    
    def print_header(self, title: str):
        """Print formatted header."""
        print("\n" + "=" * 60)
        print(f" {title}")
        print("=" * 60)
    
    def print_status(self, status: str, message: str, details: str = None):
        """Print status message with formatting."""
        symbols = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "INFO": "ℹ️"}
        symbol = symbols.get(status, "•")
        print(f"{symbol} {message}")
        if details:
            print(f"   {details}")
    
    def generate_secure_jwt_secret(self) -> str:
        """Generate a cryptographically secure JWT secret key."""
        # Generate 64+ character secure key
        return secrets.token_urlsafe(64)
    
    def generate_health_check_token(self) -> str:
        """Generate a secure health check token."""
        return secrets.token_urlsafe(32)
    
    def validate_jwt_configuration(self) -> Tuple[bool, Dict[str, Any]]:
        """Validate JWT configuration for production security."""
        validation = {
            "test_name": "JWT Configuration",
            "passed": False,
            "details": {}
        }
        
        try:
            # Check secret key strength
            secret_key = SECRET_KEY
            key_length = len(secret_key)
            validation["details"]["secret_key_length"] = key_length
            
            # Check if using default key
            default_keys = [
                "your-super-secret-key-change-this-in-production",
                "your-super-secure-secret-key-at-least-32-characters",
                "test-secret-key"
            ]
            is_default = secret_key in default_keys
            validation["details"]["is_default_key"] = is_default
            
            # Check complexity
            has_upper = any(c.isupper() for c in secret_key)
            has_lower = any(c.islower() for c in secret_key)
            has_digit = any(c.isdigit() for c in secret_key)
            has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/-_" for c in secret_key)
            
            complexity_score = sum([has_upper, has_lower, has_digit, has_special])
            validation["details"]["complexity_score"] = f"{complexity_score}/4"
            
            # Check token expiration settings
            config = SecurityConfig()
            access_expire = config.access_token_expire_minutes
            refresh_expire = config.refresh_token_expire_days
            
            validation["details"]["access_token_expire_minutes"] = access_expire
            validation["details"]["refresh_token_expire_days"] = refresh_expire
            
            # Validate expiration times for production
            reasonable_access = 15 <= access_expire <= 120  # 15 minutes to 2 hours
            reasonable_refresh = 1 <= refresh_expire <= 30   # 1 to 30 days
            
            validation["details"]["reasonable_access_expiration"] = reasonable_access
            validation["details"]["reasonable_refresh_expiration"] = reasonable_refresh
            
            # Overall validation
            validation["passed"] = (
                key_length >= 64 and
                not is_default and
                complexity_score >= 3 and
                reasonable_access and
                reasonable_refresh
            )
            
            if not validation["passed"]:
                if key_length < 64:
                    self.results["recommendations"].append("Generate new SECRET_KEY with at least 64 characters")
                if is_default:
                    self.results["recommendations"].append("Replace default SECRET_KEY with cryptographically secure value")
                if complexity_score < 3:
                    self.results["recommendations"].append("Use more complex SECRET_KEY with mixed case, digits, and symbols")
                if not reasonable_access:
                    self.results["recommendations"].append(f"Adjust ACCESS_TOKEN_EXPIRE_MINUTES to 15-120 range (current: {access_expire})")
                if not reasonable_refresh:
                    self.results["recommendations"].append(f"Adjust REFRESH_TOKEN_EXPIRE_DAYS to 1-30 range (current: {refresh_expire})")
        
        except Exception as e:
            validation["details"]["error"] = str(e)
            validation["passed"] = False
        
        return validation["passed"], validation
    
    def validate_https_configuration(self) -> Tuple[bool, Dict[str, Any]]:
        """Validate HTTPS and SSL configuration."""
        validation = {
            "test_name": "HTTPS Configuration",
            "passed": False,
            "details": {}
        }
        
        try:
            config = SecurityConfig()
            
            # Check SSL redirect
            ssl_redirect = config.ssl_redirect
            validation["details"]["ssl_redirect_enabled"] = ssl_redirect
            
            # Check HSTS settings
            hsts_max_age = config.hsts_max_age
            hsts_preload = config.hsts_preload
            hsts_subdomains = config.hsts_include_subdomains
            
            validation["details"]["hsts_max_age"] = hsts_max_age
            validation["details"]["hsts_preload"] = hsts_preload
            validation["details"]["hsts_include_subdomains"] = hsts_subdomains
            
            # Check minimum HSTS age (1 year minimum for production)
            min_hsts_age = 31536000  # 1 year
            hsts_sufficient = hsts_max_age >= min_hsts_age
            validation["details"]["hsts_sufficient"] = hsts_sufficient
            
            # Check allowed origins for HTTPS
            allowed_origins = config.allowed_origins
            https_origins = [origin for origin in allowed_origins if origin.startswith("https://")]
            http_origins = [origin for origin in allowed_origins if origin.startswith("http://") and "localhost" not in origin]
            
            validation["details"]["total_origins"] = len(allowed_origins)
            validation["details"]["https_origins"] = len(https_origins)
            validation["details"]["insecure_origins"] = len(http_origins)
            validation["details"]["origins_list"] = allowed_origins
            
            # Overall validation
            validation["passed"] = (
                ssl_redirect and
                hsts_sufficient and
                hsts_preload and
                hsts_subdomains and
                len(http_origins) == 0 and
                len(https_origins) > 0
            )
            
            if not validation["passed"]:
                if not ssl_redirect:
                    self.results["recommendations"].append("Enable SSL_REDIRECT=true for production")
                if not hsts_sufficient:
                    self.results["recommendations"].append(f"Increase HSTS_MAX_AGE to at least {min_hsts_age} (1 year)")
                if not hsts_preload:
                    self.results["recommendations"].append("Enable HSTS_PRELOAD=true for enhanced security")
                if not hsts_subdomains:
                    self.results["recommendations"].append("Enable HSTS_INCLUDE_SUBDOMAINS=true")
                if len(http_origins) > 0:
                    self.results["recommendations"].append("Replace HTTP origins with HTTPS in ALLOWED_ORIGINS")
                if len(https_origins) == 0:
                    self.results["recommendations"].append("Add at least one HTTPS origin to ALLOWED_ORIGINS")
        
        except Exception as e:
            validation["details"]["error"] = str(e)
            validation["passed"] = False
        
        return validation["passed"], validation
    
    def validate_cors_configuration(self) -> Tuple[bool, Dict[str, Any]]:
        """Validate CORS configuration for production."""
        validation = {
            "test_name": "CORS Configuration",
            "passed": False,
            "details": {}
        }
        
        try:
            config = SecurityConfig()
            cors_config = config.get_cors_config()
            
            allowed_origins = cors_config.get("allow_origins", [])
            allow_credentials = cors_config.get("allow_credentials", False)
            
            validation["details"]["allowed_origins"] = allowed_origins
            validation["details"]["allow_credentials"] = allow_credentials
            
            # Check for security issues
            has_wildcard = "*" in allowed_origins
            has_insecure_origins = any(
                origin.startswith("http://") and "localhost" not in origin 
                for origin in allowed_origins
            )
            
            validation["details"]["has_wildcard"] = has_wildcard
            validation["details"]["has_insecure_origins"] = has_insecure_origins
            
            # Check allowed methods and headers
            allowed_methods = cors_config.get("allow_methods", [])
            allowed_headers = cors_config.get("allow_headers", [])
            
            validation["details"]["allowed_methods"] = allowed_methods
            validation["details"]["allowed_headers"] = allowed_headers
            
            # Validate security
            secure_methods = not any(method in ["TRACE", "CONNECT"] for method in allowed_methods)
            has_auth_header = "Authorization" in allowed_headers
            
            validation["details"]["secure_methods"] = secure_methods
            validation["details"]["has_auth_header"] = has_auth_header
            
            # Overall validation
            validation["passed"] = (
                not has_wildcard and
                not has_insecure_origins and
                allow_credentials and
                secure_methods and
                has_auth_header and
                len(allowed_origins) > 0
            )
            
            if not validation["passed"]:
                if has_wildcard:
                    self.results["recommendations"].append("Remove wildcard (*) from CORS allowed origins")
                if has_insecure_origins:
                    self.results["recommendations"].append("Replace HTTP origins with HTTPS in CORS configuration")
                if not allow_credentials:
                    self.results["recommendations"].append("Enable allow_credentials in CORS configuration")
                if not secure_methods:
                    self.results["recommendations"].append("Remove insecure HTTP methods (TRACE, CONNECT) from CORS")
                if not has_auth_header:
                    self.results["recommendations"].append("Add Authorization header to CORS allowed headers")
        
        except Exception as e:
            validation["details"]["error"] = str(e)
            validation["passed"] = False
        
        return validation["passed"], validation
    
    def validate_rate_limiting_configuration(self) -> Tuple[bool, Dict[str, Any]]:
        """Validate rate limiting configuration."""
        validation = {
            "test_name": "Rate Limiting Configuration",
            "passed": False,
            "details": {}
        }
        
        try:
            config = SecurityConfig()
            rate_limits = config.get_rate_limits()
            
            validation["details"]["rate_limits"] = rate_limits
            
            # Check essential rate limits
            default_limit = rate_limits.get("default", 0)
            auth_limit = rate_limits.get("auth", 0)
            upload_limit = rate_limits.get("upload", 0)
            
            validation["details"]["default_limit"] = default_limit
            validation["details"]["auth_limit"] = auth_limit
            validation["details"]["upload_limit"] = upload_limit
            
            # Validate limits are reasonable for production
            reasonable_default = 50 <= default_limit <= 500
            reasonable_auth = 5 <= auth_limit <= 50
            reasonable_upload = 10 <= upload_limit <= 100
            
            # Auth should be more restrictive than default
            auth_more_restrictive = auth_limit <= default_limit
            
            validation["details"]["reasonable_default"] = reasonable_default
            validation["details"]["reasonable_auth"] = reasonable_auth
            validation["details"]["reasonable_upload"] = reasonable_upload
            validation["details"]["auth_more_restrictive"] = auth_more_restrictive
            
            # Overall validation
            validation["passed"] = (
                reasonable_default and
                reasonable_auth and
                reasonable_upload and
                auth_more_restrictive
            )
            
            if not validation["passed"]:
                if not reasonable_default:
                    self.results["recommendations"].append(f"Adjust DEFAULT_RATE_LIMIT to 50-500 range (current: {default_limit})")
                if not reasonable_auth:
                    self.results["recommendations"].append(f"Adjust AUTH_RATE_LIMIT to 5-50 range (current: {auth_limit})")
                if not reasonable_upload:
                    self.results["recommendations"].append(f"Adjust UPLOAD_RATE_LIMIT to 10-100 range (current: {upload_limit})")
                if not auth_more_restrictive:
                    self.results["recommendations"].append("AUTH_RATE_LIMIT should be lower than DEFAULT_RATE_LIMIT")
        
        except Exception as e:
            validation["details"]["error"] = str(e)
            validation["passed"] = False
        
        return validation["passed"], validation
    
    def validate_environment_variables(self) -> Tuple[bool, Dict[str, Any]]:
        """Validate essential environment variables."""
        validation = {
            "test_name": "Environment Variables",
            "passed": False,
            "details": {}
        }
        
        try:
            # Required environment variables for production
            required_vars = {
                "SECRET_KEY": "JWT secret key",
                "DATABASE_URL": "Database connection string",
                "ALLOWED_ORIGINS": "CORS allowed origins",
                "ENVIRONMENT": "Environment type"
            }
            
            missing_vars = []
            present_vars = []
            
            for var, description in required_vars.items():
                value = os.getenv(var)
                if value:
                    present_vars.append(var)
                    # Don't log sensitive values
                    if var == "SECRET_KEY":
                        validation["details"][f"{var}_length"] = len(value)
                    elif var == "DATABASE_URL":
                        validation["details"][f"{var}_configured"] = "postgresql" in value.lower()
                    else:
                        validation["details"][var] = value
                else:
                    missing_vars.append(var)
            
            validation["details"]["present_vars"] = present_vars
            validation["details"]["missing_vars"] = missing_vars
            
            # Check environment type
            environment = os.getenv("ENVIRONMENT", "development")
            validation["details"]["environment"] = environment
            validation["details"]["is_production"] = environment == "production"
            
            # Overall validation
            validation["passed"] = len(missing_vars) == 0
            
            if not validation["passed"]:
                for var in missing_vars:
                    self.results["recommendations"].append(f"Set {var} environment variable ({required_vars[var]})")
        
        except Exception as e:
            validation["details"]["error"] = str(e)
            validation["passed"] = False
        
        return validation["passed"], validation
    
    def setup_production_secrets(self) -> bool:
        """Generate and update production secrets."""
        if self.validate_only:
            return True
        
        try:
            self.print_status("INFO", "Generating new production secrets...")
            
            # Generate new JWT secret
            new_jwt_secret = self.generate_secure_jwt_secret()
            self.print_status("PASS", f"Generated new JWT secret ({len(new_jwt_secret)} characters)")
            
            # Generate health check token
            new_health_token = self.generate_health_check_token()
            self.print_status("PASS", f"Generated new health check token ({len(new_health_token)} characters)")
            
            # Read current config file
            if not self.config_file.exists():
                self.print_status("FAIL", f"Configuration file not found: {self.config_file}")
                return False
            
            config_content = self.config_file.read_text()
            
            # Update JWT secret
            import re
            config_content = re.sub(
                r'SECRET_KEY=.*',
                f'SECRET_KEY={new_jwt_secret}',
                config_content
            )
            
            # Update health check token
            config_content = re.sub(
                r'HEALTH_CHECK_TOKEN=.*',
                f'HEALTH_CHECK_TOKEN={new_health_token}',
                config_content
            )
            
            # Update refresh token expiration to 7 days for better security
            config_content = re.sub(
                r'REFRESH_TOKEN_EXPIRE_DAYS=.*',
                'REFRESH_TOKEN_EXPIRE_DAYS=7',
                config_content
            )
            
            # Write updated config
            self.config_file.write_text(config_content)
            
            self.results["changes_made"].extend([
                "Generated new cryptographically secure JWT secret",
                "Generated new health check token",
                "Updated refresh token expiration to 7 days"
            ])
            
            self.print_status("PASS", "Production secrets updated successfully")
            return True
            
        except Exception as e:
            self.print_status("FAIL", f"Failed to setup production secrets: {e}")
            return False
    
    def run_security_validation(self) -> bool:
        """Run comprehensive security validation."""
        self.print_header("Production Security Validation")
        
        validations = [
            ("Environment Variables", self.validate_environment_variables),
            ("JWT Configuration", self.validate_jwt_configuration),
            ("HTTPS Configuration", self.validate_https_configuration),
            ("CORS Configuration", self.validate_cors_configuration),
            ("Rate Limiting", self.validate_rate_limiting_configuration),
        ]
        
        all_passed = True
        
        for name, validator in validations:
            self.print_status("INFO", f"Validating {name}...")
            try:
                passed, details = validator()
                self.results["validations"][name] = details
                
                if passed:
                    self.print_status("PASS", f"{name}: Passed")
                else:
                    self.print_status("FAIL", f"{name}: Failed")
                    all_passed = False
                    
            except Exception as e:
                self.print_status("FAIL", f"{name}: Error - {e}")
                all_passed = False
        
        return all_passed
    
    def generate_summary(self) -> Dict[str, Any]:
        """Generate configuration summary."""
        total_validations = len(self.results["validations"])
        passed_validations = sum(
            1 for v in self.results["validations"].values() 
            if v.get("passed", False)
        )
        
        success_rate = (passed_validations / total_validations * 100) if total_validations > 0 else 0
        
        # Determine security status
        if success_rate >= 95:
            security_status = "EXCELLENT"
        elif success_rate >= 85:
            security_status = "STRONG"
        elif success_rate >= 70:
            security_status = "MODERATE"
        else:
            security_status = "WEAK"
        
        self.results["security_status"] = security_status
        
        summary = {
            "total_validations": total_validations,
            "passed_validations": passed_validations,
            "failed_validations": total_validations - passed_validations,
            "success_rate": success_rate,
            "security_status": security_status,
            "production_ready": success_rate >= 95,
            "changes_made": len(self.results["changes_made"]),
            "recommendations": len(self.results["recommendations"])
        }
        
        return summary
    
    def run_setup(self) -> bool:
        """Run complete production configuration setup."""
        self.print_header("Production Configuration Setup")
        
        if not self.validate_only:
            # Setup production secrets
            secrets_ok = self.setup_production_secrets()
            if not secrets_ok:
                return False
        
        # Run security validation
        validation_ok = self.run_security_validation()
        
        # Generate summary
        summary = self.generate_summary()
        
        # Print summary
        self.print_header("Configuration Summary")
        self.print_status("INFO", f"Total Validations: {summary['total_validations']}")
        self.print_status("INFO", f"Passed: {summary['passed_validations']}")
        self.print_status("INFO", f"Failed: {summary['failed_validations']}")
        self.print_status("INFO", f"Success Rate: {summary['success_rate']:.1f}%")
        self.print_status("INFO", f"Security Status: {summary['security_status']}")
        
        if summary["production_ready"]:
            self.print_status("PASS", "Configuration is production ready!")
        else:
            self.print_status("FAIL", "Configuration needs improvements before production")
        
        # Print recommendations
        if self.results["recommendations"]:
            print(f"\nRecommendations ({len(self.results['recommendations'])}):")
            for i, rec in enumerate(self.results["recommendations"], 1):
                print(f"  {i}. {rec}")
        
        # Print changes made
        if self.results["changes_made"]:
            print(f"\nChanges Made ({len(self.results['changes_made'])}):")
            for i, change in enumerate(self.results["changes_made"], 1):
                print(f"  {i}. {change}")
        
        # Save detailed report
        report_file = f"production_config_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        self.print_status("INFO", f"Detailed report saved to: {report_file}")
        
        return summary["production_ready"]


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Production Configuration Setup")
    parser.add_argument(
        "--validate-only", 
        action="store_true", 
        help="Only validate existing configuration without making changes"
    )
    
    args = parser.parse_args()
    
    manager = ProductionConfigManager(validate_only=args.validate_only)
    success = manager.run_setup()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()