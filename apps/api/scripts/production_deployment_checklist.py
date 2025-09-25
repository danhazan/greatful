#!/usr/bin/env python3
"""
Production Deployment Checklist

Comprehensive checklist for production deployment validation.
This script performs all necessary checks before deploying to production.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables from config/.env
env_path = Path(__file__).parent.parent / "config" / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.security_config import SecurityConfig


class ProductionDeploymentChecker:
    """Comprehensive production deployment checker."""
    
    def __init__(self):
        self.results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {},
            "overall_status": "unknown",
            "deployment_ready": False,
            "critical_issues": [],
            "warnings": [],
            "recommendations": []
        }
    
    def print_header(self, title: str):
        """Print formatted header."""
        print("\\n" + "=" * 70)
        print(f" {title}")
        print("=" * 70)
    
    def print_status(self, status: str, message: str, details: str = None):
        """Print status message with formatting."""
        symbols = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "INFO": "ℹ️"}
        symbol = symbols.get(status, "•")
        print(f"{symbol} {message}")
        if details:
            print(f"   {details}")
    
    def run_all_checks(self) -> bool:
        """Run all deployment checks."""
        self.print_header("Production Deployment Checklist")
        
        # Simple validation checks
        config = SecurityConfig()
        
        # Check environment
        if config.environment.lower() == "production":
            self.print_status("PASS", "Environment set to production")
        else:
            self.print_status("FAIL", f"Environment is '{config.environment}', should be 'production'")
            self.results["critical_issues"].append("Environment not set to production")
        
        # Check secret key
        if config.is_secure_secret_key():
            self.print_status("PASS", "Secret key is secure")
        else:
            self.print_status("FAIL", "Secret key is not secure enough")
            self.results["critical_issues"].append("Secret key needs improvement")
        
        # Check SSL redirect
        if config.ssl_redirect:
            self.print_status("PASS", "SSL redirect enabled")
        else:
            self.print_status("FAIL", "SSL redirect disabled")
            self.results["critical_issues"].append("SSL redirect must be enabled")
        
        # Check HTTPS origins
        if config.has_https_origins():
            self.print_status("PASS", "All CORS origins use HTTPS")
        else:
            self.print_status("FAIL", "Some CORS origins don't use HTTPS")
            self.results["critical_issues"].append("All CORS origins must use HTTPS")
        
        # Check database URL
        database_url = os.getenv("DATABASE_URL", "")
        if database_url and "postgresql" in database_url:
            self.print_status("PASS", "Database URL configured")
        else:
            self.print_status("FAIL", "Database URL not properly configured")
            self.results["critical_issues"].append("DATABASE_URL must be a PostgreSQL connection string")
        
        # Overall assessment
        deployment_ready = len(self.results["critical_issues"]) == 0
        self.results["deployment_ready"] = deployment_ready
        
        if deployment_ready:
            self.results["overall_status"] = "READY"
        else:
            self.results["overall_status"] = "NOT_READY"
        
        return deployment_ready
    
    def print_summary(self):
        """Print deployment summary."""
        self.print_header("Deployment Summary")
        
        self.print_status("INFO", f"Overall Status: {self.results['overall_status']}")
        
        if self.results["critical_issues"]:
            print(f"\\nCritical Issues ({len(self.results['critical_issues'])}):")
            for i, issue in enumerate(self.results["critical_issues"], 1):
                print(f"  {i}. {issue}")
        
        if self.results["warnings"]:
            print(f"\\nWarnings ({len(self.results['warnings'])}):")
            for i, warning in enumerate(self.results["warnings"], 1):
                print(f"  {i}. {warning}")
        
        if self.results["deployment_ready"]:
            self.print_status("PASS", "🚀 Ready for production deployment!")
        else:
            self.print_status("FAIL", "❌ Not ready for production deployment")
            self.print_status("INFO", "Please address critical issues before deploying")


def main():
    """Main function."""
    checker = ProductionDeploymentChecker()
    
    success = checker.run_all_checks()
    checker.print_summary()
    
    # Save detailed report
    report_file = f"deployment_checklist_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w') as f:
        json.dump(checker.results, f, indent=2)
    
    checker.print_status("INFO", f"Detailed report saved to: {report_file}")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()