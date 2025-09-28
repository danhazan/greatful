"""
Production Environment Checker for Share Functionality
"""

import os
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class ProductionEnvironmentChecker:
    """Check production environment for share functionality requirements."""
    
    @staticmethod
    def check_environment_variables() -> Dict[str, Any]:
        """Check required environment variables."""
        required_vars = [
            "DATABASE_URL",
            "SECRET_KEY",
            "FRONTEND_BASE_URL"
        ]
        
        optional_vars = [
            "NEXT_PUBLIC_API_URL",
            "VERCEL_URL",
            "ENVIRONMENT"
        ]
        
        results = {
            "required": {},
            "optional": {},
            "missing_required": [],
            "warnings": []
        }
        
        # Check required variables
        for var in required_vars:
            value = os.getenv(var)
            if value:
                results["required"][var] = "✅ Set"
                
                # Additional validation
                if var == "DATABASE_URL" and not value.startswith(("postgresql://", "postgresql+asyncpg://")):
                    results["warnings"].append(f"{var} should use PostgreSQL with async driver")
                elif var == "SECRET_KEY" and len(value) < 32:
                    results["warnings"].append(f"{var} should be at least 32 characters")
                elif var == "FRONTEND_BASE_URL" and not value.startswith(("http://", "https://")):
                    results["warnings"].append(f"{var} should include protocol (http/https)")
            else:
                results["required"][var] = "❌ Missing"
                results["missing_required"].append(var)
        
        # Check optional variables
        for var in optional_vars:
            value = os.getenv(var)
            results["optional"][var] = "✅ Set" if value else "⚠️ Not set"
        
        return results
    
    @staticmethod
    def check_database_configuration() -> Dict[str, Any]:
        """Check database configuration."""
        db_url = os.getenv("DATABASE_URL", "")
        
        results = {
            "url_format": "❌ Invalid",
            "driver": "❌ Not async",
            "ssl_config": "⚠️ Unknown",
            "recommendations": []
        }
        
        if db_url:
            if db_url.startswith("postgresql+asyncpg://"):
                results["url_format"] = "✅ Valid"
                results["driver"] = "✅ Async (asyncpg)"
            elif db_url.startswith("postgresql://"):
                results["url_format"] = "⚠️ Needs conversion"
                results["driver"] = "⚠️ Will be converted to asyncpg"
                results["recommendations"].append("URL will be auto-converted to postgresql+asyncpg://")
            else:
                results["recommendations"].append("Use PostgreSQL with asyncpg driver")
            
            # Check SSL configuration
            if "sslmode=" in db_url:
                results["ssl_config"] = "✅ Configured"
            elif os.getenv("ENVIRONMENT") == "production":
                results["ssl_config"] = "⚠️ Should use SSL in production"
                results["recommendations"].append("Add SSL configuration for production")
        
        return results
    
    @staticmethod
    def check_share_dependencies() -> Dict[str, Any]:
        """Check share functionality dependencies."""
        results = {
            "imports": {},
            "services": {},
            "models": {},
            "errors": []
        }
        
        # Test imports
        import_tests = [
            ("ShareService", "app.services.share_service", "ShareService"),
            ("ShareRepository", "app.repositories.share_repository", "ShareRepository"),
            ("Share Model", "app.models.share", "Share"),
            ("UserPreferenceService", "app.services.user_preference_service", "UserPreferenceService"),
            ("NotificationFactory", "app.core.notification_factory", "NotificationFactory"),
        ]
        
        for name, module, class_name in import_tests:
            try:
                exec(f"from {module} import {class_name}")
                results["imports"][name] = "✅ Available"
            except ImportError as e:
                results["imports"][name] = f"❌ Failed: {str(e)}"
                results["errors"].append(f"Import error for {name}: {str(e)}")
            except Exception as e:
                results["imports"][name] = f"❌ Error: {str(e)}"
                results["errors"].append(f"Unexpected error for {name}: {str(e)}")
        
        return results
    
    @staticmethod
    def generate_production_report() -> str:
        """Generate a comprehensive production readiness report."""
        report = []
        report.append("🔍 Production Share Functionality Report")
        report.append("=" * 50)
        
        # Environment variables
        env_results = ProductionEnvironmentChecker.check_environment_variables()
        report.append("\n📋 Environment Variables:")
        
        for var, status in env_results["required"].items():
            report.append(f"  {status} {var}")
        
        if env_results["missing_required"]:
            report.append("\n❌ Missing Required Variables:")
            for var in env_results["missing_required"]:
                report.append(f"  - {var}")
        
        if env_results["warnings"]:
            report.append("\n⚠️ Warnings:")
            for warning in env_results["warnings"]:
                report.append(f"  - {warning}")
        
        # Database configuration
        db_results = ProductionEnvironmentChecker.check_database_configuration()
        report.append("\n🗄️ Database Configuration:")
        report.append(f"  URL Format: {db_results['url_format']}")
        report.append(f"  Driver: {db_results['driver']}")
        report.append(f"  SSL Config: {db_results['ssl_config']}")
        
        if db_results["recommendations"]:
            report.append("\n💡 Database Recommendations:")
            for rec in db_results["recommendations"]:
                report.append(f"  - {rec}")
        
        # Dependencies
        dep_results = ProductionEnvironmentChecker.check_share_dependencies()
        report.append("\n📦 Dependencies:")
        
        for name, status in dep_results["imports"].items():
            report.append(f"  {status} {name}")
        
        if dep_results["errors"]:
            report.append("\n❌ Dependency Errors:")
            for error in dep_results["errors"]:
                report.append(f"  - {error}")
        
        # Overall status
        has_errors = (
            env_results["missing_required"] or 
            dep_results["errors"] or
            "❌" in str(db_results)
        )
        
        report.append("\n" + "=" * 50)
        if has_errors:
            report.append("❌ Production readiness: ISSUES FOUND")
            report.append("Please resolve the issues above before deploying.")
        else:
            report.append("✅ Production readiness: READY")
            report.append("Share functionality should work correctly in production.")
        
        return "\n".join(report)


def check_production_readiness():
    """Check production readiness and return results."""
    checker = ProductionEnvironmentChecker()
    return checker.generate_production_report()
