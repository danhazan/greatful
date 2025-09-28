#!/usr/bin/env python3
"""
OAuth Production Migration Verification Script

This script verifies that the OAuth production configuration migration is complete
and all components are properly configured for production deployment.
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Any

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

class OAuthMigrationVerifier:
    """Verify OAuth production migration completion."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent.parent
        self.api_root = Path(__file__).parent.parent
        self.web_root = self.project_root / "apps" / "web"
        self.issues = []
        self.warnings = []
        self.successes = []
    
    def log_issue(self, category: str, message: str, severity: str = "ERROR"):
        """Log an issue found during verification."""
        issue = {
            "category": category,
            "message": message,
            "severity": severity
        }
        
        if severity == "ERROR":
            self.issues.append(issue)
        elif severity == "WARNING":
            self.warnings.append(issue)
        else:
            self.successes.append(issue)
        
        # Color coding
        colors = {
            "ERROR": "\033[91m",    # Red
            "WARNING": "\033[93m",  # Yellow
            "SUCCESS": "\033[92m"   # Green
        }
        reset = "\033[0m"
        color = colors.get(severity, "")
        
        print(f"{color}[{severity}]{reset} {category}: {message}")
    
    def verify_file_exists(self, file_path: Path, description: str) -> bool:
        """Verify that a file exists."""
        if file_path.exists():
            self.log_issue(
                "File Check",
                f"{description} exists: {file_path}",
                "SUCCESS"
            )
            return True
        else:
            self.log_issue(
                "File Check",
                f"{description} missing: {file_path}",
                "ERROR"
            )
            return False
    
    def verify_file_content(self, file_path: Path, required_content: List[str], description: str):
        """Verify that a file contains required content."""
        if not file_path.exists():
            self.log_issue(
                "Content Check",
                f"{description} file missing: {file_path}",
                "ERROR"
            )
            return
        
        try:
            content = file_path.read_text()
            missing_content = []
            
            for required in required_content:
                if required not in content:
                    missing_content.append(required)
            
            if missing_content:
                self.log_issue(
                    "Content Check",
                    f"{description} missing required content: {', '.join(missing_content)}",
                    "ERROR"
                )
            else:
                self.log_issue(
                    "Content Check",
                    f"{description} contains all required content",
                    "SUCCESS"
                )
        
        except Exception as e:
            self.log_issue(
                "Content Check",
                f"Error reading {description}: {str(e)}",
                "ERROR"
            )
    
    def verify_oauth_config_file(self):
        """Verify OAuth configuration file."""
        print("\n=== Verifying OAuth Configuration File ===")
        
        oauth_config_path = self.api_root / "app" / "core" / "oauth_config.py"
        
        if not self.verify_file_exists(oauth_config_path, "OAuth configuration file"):
            return
        
        required_content = [
            "GOOGLE_REDIRECT_URI",
            "FACEBOOK_REDIRECT_URI", 
            "FRONTEND_SUCCESS_URL",
            "FRONTEND_ERROR_URL",
            "ALLOWED_ORIGINS",
            "SECURE_COOKIES",
            "SAME_SITE_COOKIES",
            "OAUTH_SESSION_TIMEOUT",
            "OAUTH_STATE_EXPIRY",
            "def get_provider_status",
            "production",
            "staging",
            "development"
        ]
        
        self.verify_file_content(
            oauth_config_path,
            required_content,
            "OAuth configuration"
        )
    
    def verify_security_config_file(self):
        """Verify security configuration file."""
        print("\n=== Verifying Security Configuration File ===")
        
        security_config_path = self.api_root / "app" / "core" / "security_config.py"
        
        if not self.verify_file_exists(security_config_path, "Security configuration file"):
            return
        
        required_content = [
            "from app.core.oauth_config import ALLOWED_ORIGINS as OAUTH_ORIGINS",
            "oauth_origins = OAUTH_ORIGINS",
            "all_origins = list(set(oauth_origins + env_origins))"
        ]
        
        self.verify_file_content(
            security_config_path,
            required_content,
            "Security configuration OAuth integration"
        )
    
    def verify_oauth_service_file(self):
        """Verify OAuth service file."""
        print("\n=== Verifying OAuth Service File ===")
        
        oauth_service_path = self.api_root / "app" / "services" / "oauth_service.py"
        
        if not self.verify_file_exists(oauth_service_path, "OAuth service file"):
            return
        
        required_content = [
            "GOOGLE_REDIRECT_URI",
            "FACEBOOK_REDIRECT_URI",
            "FRONTEND_SUCCESS_URL",
            "FRONTEND_ERROR_URL",
            "ALLOWED_ORIGINS",
            "SECURE_COOKIES",
            "SAME_SITE_COOKIES"
        ]
        
        self.verify_file_content(
            oauth_service_path,
            required_content,
            "OAuth service imports"
        )
    
    def verify_environment_files(self):
        """Verify environment configuration files."""
        print("\n=== Verifying Environment Files ===")
        
        # Backend production environment
        backend_env_path = self.api_root / ".env.production"
        if self.verify_file_exists(backend_env_path, "Backend production environment file"):
            required_backend_content = [
                "ENVIRONMENT=production",
                "GOOGLE_CLIENT_ID=",
                "GOOGLE_CLIENT_SECRET=",
                "OAUTH_REDIRECT_URI=",
                "OAUTH_ALLOWED_DOMAINS=",
                "SESSION_SECRET=",
                "SECRET_KEY="
            ]
            
            self.verify_file_content(
                backend_env_path,
                required_backend_content,
                "Backend production environment"
            )
        
        # Frontend production environment
        frontend_env_path = self.web_root / ".env.production"
        if self.verify_file_exists(frontend_env_path, "Frontend production environment file"):
            required_frontend_content = [
                "NEXT_PUBLIC_API_URL=",
                "NEXT_PUBLIC_APP_URL=",
                "NODE_ENV=production"
            ]
            
            self.verify_file_content(
                frontend_env_path,
                required_frontend_content,
                "Frontend production environment"
            )
    
    def verify_documentation_files(self):
        """Verify documentation files."""
        print("\n=== Verifying Documentation Files ===")
        
        # OAuth production checklist
        checklist_path = self.project_root / "OAUTH_PRODUCTION_CHECKLIST.md"
        self.verify_file_exists(checklist_path, "OAuth production checklist")
        
        # OAuth production setup guide
        setup_guide_path = self.api_root / "docs" / "OAUTH_PRODUCTION_SETUP.md"
        self.verify_file_exists(setup_guide_path, "OAuth production setup guide")
    
    def verify_test_scripts(self):
        """Verify test scripts."""
        print("\n=== Verifying Test Scripts ===")
        
        # Production test script
        test_script_path = self.api_root / "scripts" / "test_oauth_production.py"
        if self.verify_file_exists(test_script_path, "OAuth production test script"):
            required_content = [
                "class OAuthProductionTester",
                "test_environment_variables",
                "test_oauth_configuration",
                "test_redirect_uris",
                "test_cors_configuration",
                "test_api_endpoints",
                "test_security_configuration"
            ]
            
            self.verify_file_content(
                test_script_path,
                required_content,
                "OAuth production test script"
            )
        
        # Verification script (this file)
        verify_script_path = self.api_root / "scripts" / "verify_oauth_migration.py"
        self.verify_file_exists(verify_script_path, "OAuth migration verification script")
    
    def verify_oauth_service_imports(self):
        """Verify OAuth service has correct imports."""
        print("\n=== Verifying OAuth Service Imports ===")
        
        oauth_service_path = self.api_root / "app" / "services" / "oauth_service.py"
        
        if not oauth_service_path.exists():
            self.log_issue(
                "Import Check",
                "OAuth service file not found",
                "ERROR"
            )
            return
        
        try:
            content = oauth_service_path.read_text()
            
            # Check for production configuration imports
            production_imports = [
                "GOOGLE_REDIRECT_URI",
                "FACEBOOK_REDIRECT_URI", 
                "FRONTEND_SUCCESS_URL",
                "FRONTEND_ERROR_URL",
                "ALLOWED_ORIGINS",
                "SECURE_COOKIES",
                "SAME_SITE_COOKIES"
            ]
            
            missing_imports = []
            for import_name in production_imports:
                if import_name not in content:
                    missing_imports.append(import_name)
            
            if missing_imports:
                self.log_issue(
                    "Import Check",
                    f"OAuth service missing production imports: {', '.join(missing_imports)}",
                    "ERROR"
                )
            else:
                self.log_issue(
                    "Import Check",
                    "OAuth service has all required production imports",
                    "SUCCESS"
                )
        
        except Exception as e:
            self.log_issue(
                "Import Check",
                f"Error checking OAuth service imports: {str(e)}",
                "ERROR"
            )
    
    def verify_configuration_consistency(self):
        """Verify configuration consistency across files."""
        print("\n=== Verifying Configuration Consistency ===")
        
        # Check that production URLs are configured (flexible for different domains)
        files_to_check = [
            (self.api_root / ".env.production", "Backend production env"),
            (self.web_root / ".env.production", "Frontend production env")
        ]
        
        for file_path, description in files_to_check:
            if file_path.exists():
                try:
                    content = file_path.read_text()
                    
                    # Check for HTTPS URLs (production requirement)
                    if "https://" in content:
                        self.log_issue(
                            "URL Configuration",
                            f"{description} contains HTTPS URLs (production ready)",
                            "SUCCESS"
                        )
                    else:
                        self.log_issue(
                            "URL Configuration",
                            f"{description} may be missing HTTPS URLs for production",
                                "WARNING"
                            )
                
                except Exception as e:
                    self.log_issue(
                        "URL Consistency",
                        f"Error checking {description}: {str(e)}",
                        "WARNING"
                    )
    
    def generate_migration_report(self):
        """Generate migration verification report."""
        print("\n" + "="*70)
        print("OAUTH PRODUCTION MIGRATION VERIFICATION REPORT")
        print("="*70)
        
        total_checks = len(self.issues) + len(self.warnings) + len(self.successes)
        
        print(f"\nTotal Checks: {total_checks}")
        print(f"✅ Successful: {len(self.successes)}")
        print(f"⚠️  Warnings: {len(self.warnings)}")
        print(f"❌ Errors: {len(self.issues)}")
        
        # Migration status
        if self.issues:
            print(f"\n🔴 MIGRATION STATUS: INCOMPLETE")
            print(f"❌ {len(self.issues)} critical issues must be resolved")
        elif self.warnings:
            print(f"\n🟡 MIGRATION STATUS: COMPLETE WITH WARNINGS")
            print(f"⚠️  {len(self.warnings)} warnings should be addressed")
        else:
            print(f"\n🟢 MIGRATION STATUS: COMPLETE")
            print("✅ All OAuth production configuration checks passed")
        
        # Error summary
        if self.issues:
            print("\n🔴 CRITICAL ISSUES:")
            for issue in self.issues:
                print(f"  - {issue['category']}: {issue['message']}")
        
        # Warning summary
        if self.warnings:
            print("\n🟡 WARNINGS:")
            for warning in self.warnings:
                print(f"  - {warning['category']}: {warning['message']}")
        
        # Next steps
        print("\n📋 NEXT STEPS:")
        if self.issues:
            print("1. Fix all critical issues listed above")
            print("2. Re-run this verification script")
            print("3. Run the OAuth production test script")
            print("4. Configure OAuth credentials in Google Console")
        elif self.warnings:
            print("1. Address warnings if needed")
            print("2. Run the OAuth production test script")
            print("3. Configure OAuth credentials in Google Console")
            print("4. Deploy to production")
        else:
            print("1. Run the OAuth production test script:")
            print("   python apps/api/scripts/test_oauth_production.py")
            print("2. Configure OAuth credentials in Google Console")
            print("3. Set environment variables in Railway/Vercel")
            print("4. Deploy and test OAuth flow")
        
        return len(self.issues) == 0
    
    def run_verification(self):
        """Run all verification checks."""
        print("🔍 Starting OAuth Production Migration Verification...")
        print(f"Project Root: {self.project_root}")
        print(f"API Root: {self.api_root}")
        print(f"Web Root: {self.web_root}")
        
        # Run all verification checks
        self.verify_oauth_config_file()
        self.verify_security_config_file()
        self.verify_oauth_service_file()
        self.verify_environment_files()
        self.verify_documentation_files()
        self.verify_test_scripts()
        self.verify_oauth_service_imports()
        self.verify_configuration_consistency()
        
        # Generate report
        success = self.generate_migration_report()
        
        return success

def main():
    """Main verification runner."""
    verifier = OAuthMigrationVerifier()
    success = verifier.run_verification()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()