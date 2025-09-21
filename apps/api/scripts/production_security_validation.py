#!/usr/bin/env python3
"""
Production Security Validation Script

This script validates security configuration and implementation
for production deployment with HTTPS enforcement.
"""

import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.security_config import SecurityConfig
from app.core.ssl_middleware import SSLConfigurationManager
from app.core.security_audit import SecurityAuditor


class ProductionSecurityValidator:
    """Validates production security configuration and implementation."""
    
    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "validation_type": "production_security",
            "environment": os.getenv("ENVIRONMENT", "development"),
            "tests": {},
            "summary": {},
            "recommendations": []
        }
    
    def validate_secret_key_strength(self):
        """Validate JWT secret key strength for production."""
        from app.core.security import SECRET_KEY
        
        test_result = {
            "test_name": "Secret Key Strength",
            "passed": False,
            "details": {}
        }
        
        # Check length
        key_length = len(SECRET_KEY)
        test_result["details"]["length"] = key_length
        
        if key_length >= 64:
            test_result["details"]["length_check"] = "PASS"
        else:
            test_result["details"]["length_check"] = "FAIL"
            test_result["details"]["length_requirement"] = "64+ characters"
        
        # Check complexity
        has_upper = any(c.isupper() for c in SECRET_KEY)
        has_lower = any(c.islower() for c in SECRET_KEY)
        has_digit = any(c.isdigit() for c in SECRET_KEY)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/-_" for c in SECRET_KEY)
        
        complexity_score = sum([has_upper, has_lower, has_digit, has_special])
        test_result["details"]["complexity_score"] = f"{complexity_score}/4"
        
        # Check for default values
        default_keys = [
            "your-super-secret-key-change-this-in-production",
            "your-super-secure-secret-key-at-least-32-characters",
            "test-secret-key",
            "development-secret-key"
        ]
        
        is_default = SECRET_KEY in default_keys
        test_result["details"]["is_default_key"] = is_default
        
        # Overall pass/fail
        test_result["passed"] = (
            key_length >= 64 and 
            complexity_score >= 3 and 
            not is_default
        )
        
        if not test_result["passed"]:
            if key_length < 64:
                self.results["recommendations"].append("Increase SECRET_KEY length to at least 64 characters")
            if complexity_score < 3:
                self.results["recommendations"].append("Improve SECRET_KEY complexity (use uppercase, lowercase, digits, and special characters)")
            if is_default:
                self.results["recommendations"].append("Replace default SECRET_KEY with a cryptographically secure value")
        
        self.results["tests"]["secret_key_strength"] = test_result
        return test_result["passed"]
    
    def validate_https_configuration(self):
        """Validate HTTPS and SSL/TLS configuration."""
        test_result = {
            "test_name": "HTTPS Configuration",
            "passed": False,
            "details": {}
        }
        
        # Check SSL redirect
        ssl_redirect = os.getenv("SSL_REDIRECT", "").lower() == "true"
        test_result["details"]["ssl_redirect_enabled"] = ssl_redirect
        
        # Check HSTS configuration
        hsts_max_age = int(os.getenv("HSTS_MAX_AGE", "0"))
        test_result["details"]["hsts_max_age"] = hsts_max_age
        test_result["details"]["hsts_min_requirement"] = 31536000  # 1 year
        
        # Check allowed origins
        allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
        https_origins = [origin.strip() for origin in allowed_origins if origin.strip().startswith("https://")]
        http_origins = [origin.strip() for origin in allowed_origins if origin.strip().startswith("http://") and "localhost" not in origin]
        
        test_result["details"]["https_origins"] = len(https_origins)
        test_result["details"]["insecure_origins"] = len(http_origins)
        
        # Overall pass/fail
        test_result["passed"] = (
            ssl_redirect and
            hsts_max_age >= 31536000 and
            len(http_origins) == 0
        )
        
        if not test_result["passed"]:
            if not ssl_redirect:
                self.results["recommendations"].append("Enable SSL_REDIRECT=true for production")
            if hsts_max_age < 31536000:
                self.results["recommendations"].append("Set HSTS_MAX_AGE to at least 31536000 (1 year)")
            if len(http_origins) > 0:
                self.results["recommendations"].append("Replace HTTP origins with HTTPS in ALLOWED_ORIGINS")
        
        self.results["tests"]["https_configuration"] = test_result
        return test_result["passed"]
    
    def validate_security_headers(self):
        """Validate security headers configuration."""
        test_result = {
            "test_name": "Security Headers",
            "passed": False,
            "details": {}
        }
        
        try:
            config = SecurityConfig()
            headers = config.get_security_headers()
            
            # Required headers
            required_headers = [
                "Content-Security-Policy",
                "X-Frame-Options", 
                "X-Content-Type-Options",
                "X-XSS-Protection",
                "Referrer-Policy"
            ]
            
            present_headers = []
            missing_headers = []
            
            for header in required_headers:
                if header in headers:
                    present_headers.append(header)
                else:
                    missing_headers.append(header)
            
            test_result["details"]["present_headers"] = present_headers
            test_result["details"]["missing_headers"] = missing_headers
            test_result["details"]["total_required"] = len(required_headers)
            test_result["details"]["total_present"] = len(present_headers)
            
            # Check specific header values
            header_checks = {}
            
            if "X-Frame-Options" in headers:
                header_checks["x_frame_options"] = headers["X-Frame-Options"] == "DENY"
            
            if "X-Content-Type-Options" in headers:
                header_checks["x_content_type_options"] = headers["X-Content-Type-Options"] == "nosniff"
            
            if "Content-Security-Policy" in headers:
                csp = headers["Content-Security-Policy"]
                header_checks["csp_default_src_self"] = "default-src 'self'" in csp
                header_checks["csp_object_src_none"] = "object-src 'none'" in csp
            
            test_result["details"]["header_checks"] = header_checks
            
            # Overall pass/fail
            test_result["passed"] = len(missing_headers) == 0 and all(header_checks.values())
            
            if not test_result["passed"]:
                if missing_headers:
                    self.results["recommendations"].append(f"Add missing security headers: {', '.join(missing_headers)}")
                for check, passed in header_checks.items():
                    if not passed:
                        self.results["recommendations"].append(f"Fix security header configuration: {check}")
        
        except Exception as e:
            test_result["details"]["error"] = str(e)
            test_result["passed"] = False
        
        self.results["tests"]["security_headers"] = test_result
        return test_result["passed"]
    
    def validate_cors_configuration(self):
        """Validate CORS configuration for production."""
        test_result = {
            "test_name": "CORS Configuration",
            "passed": False,
            "details": {}
        }
        
        try:
            config = SecurityConfig()
            cors_config = config.get_cors_config()
            
            # Check allowed origins
            allowed_origins = cors_config.get("allow_origins", [])
            test_result["details"]["allowed_origins"] = allowed_origins
            
            # Check for wildcard origins in production
            has_wildcard = "*" in allowed_origins
            test_result["details"]["has_wildcard_origin"] = has_wildcard
            
            # Check for HTTP origins (excluding localhost)
            http_origins = [
                origin for origin in allowed_origins 
                if origin.startswith("http://") and "localhost" not in origin
            ]
            test_result["details"]["insecure_origins"] = http_origins
            
            # Check credentials setting
            allow_credentials = cors_config.get("allow_credentials", False)
            test_result["details"]["allow_credentials"] = allow_credentials
            
            # Overall pass/fail
            test_result["passed"] = (
                not has_wildcard and
                len(http_origins) == 0 and
                allow_credentials
            )
            
            if not test_result["passed"]:
                if has_wildcard:
                    self.results["recommendations"].append("Remove wildcard (*) from CORS allowed origins in production")
                if http_origins:
                    self.results["recommendations"].append("Replace HTTP origins with HTTPS in CORS configuration")
                if not allow_credentials:
                    self.results["recommendations"].append("Enable allow_credentials in CORS configuration")
        
        except Exception as e:
            test_result["details"]["error"] = str(e)
            test_result["passed"] = False
        
        self.results["tests"]["cors_configuration"] = test_result
        return test_result["passed"]
    
    def validate_rate_limiting(self):
        """Validate rate limiting configuration."""
        test_result = {
            "test_name": "Rate Limiting",
            "passed": False,
            "details": {}
        }
        
        try:
            config = SecurityConfig()
            rate_limits = config.get_rate_limits()
            
            test_result["details"]["rate_limits"] = rate_limits
            
            # Check that rate limits are reasonable
            default_limit = rate_limits.get("default", 0)
            auth_limit = rate_limits.get("auth", 0)
            
            test_result["details"]["default_limit"] = default_limit
            test_result["details"]["auth_limit"] = auth_limit
            
            # Validate limits are within reasonable ranges
            reasonable_limits = (
                10 <= default_limit <= 1000 and
                5 <= auth_limit <= 50 and
                auth_limit <= default_limit
            )
            
            test_result["details"]["reasonable_limits"] = reasonable_limits
            test_result["passed"] = reasonable_limits
            
            if not test_result["passed"]:
                if default_limit < 10 or default_limit > 1000:
                    self.results["recommendations"].append("Set DEFAULT_RATE_LIMIT between 10-1000 requests per minute")
                if auth_limit < 5 or auth_limit > 50:
                    self.results["recommendations"].append("Set AUTH_RATE_LIMIT between 5-50 requests per minute")
                if auth_limit > default_limit:
                    self.results["recommendations"].append("AUTH_RATE_LIMIT should be lower than DEFAULT_RATE_LIMIT")
        
        except Exception as e:
            test_result["details"]["error"] = str(e)
            test_result["passed"] = False
        
        self.results["tests"]["rate_limiting"] = test_result
        return test_result["passed"]
    
    def run_pytest_security_tests(self):
        """Run pytest security test suite."""
        test_result = {
            "test_name": "Security Test Suite",
            "passed": False,
            "details": {}
        }
        
        try:
            # Run security compliance tests
            cmd = [
                "python", "-m", "pytest", 
                "tests/security/test_security_compliance.py",
                "-q", "--tb=short"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent.parent)
            
            test_result["details"]["exit_code"] = result.returncode
            test_result["details"]["stdout"] = result.stdout[-1000:]  # Last 1000 chars
            test_result["details"]["stderr"] = result.stderr[-1000:] if result.stderr else ""
            
            # Parse test results from stdout
            if "passed" in result.stdout:
                import re
                match = re.search(r'(\d+) passed', result.stdout)
                if match:
                    test_result["details"]["tests_passed"] = int(match.group(1))
                
                # Check for failures
                fail_match = re.search(r'(\d+) failed', result.stdout)
                if fail_match:
                    test_result["details"]["tests_failed"] = int(fail_match.group(1))
                else:
                    test_result["details"]["tests_failed"] = 0
            
            test_result["passed"] = result.returncode == 0
            
            if not test_result["passed"]:
                self.results["recommendations"].append("Fix failing security tests before production deployment")
        
        except Exception as e:
            test_result["details"]["error"] = str(e)
            test_result["passed"] = False
        
        self.results["tests"]["security_test_suite"] = test_result
        return test_result["passed"]
    
    def generate_summary(self):
        """Generate validation summary."""
        total_tests = len(self.results["tests"])
        passed_tests = sum(1 for test in self.results["tests"].values() if test["passed"])
        
        self.results["summary"] = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "success_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0,
            "production_ready": passed_tests == total_tests,
            "critical_issues": total_tests - passed_tests,
            "recommendations_count": len(self.results["recommendations"])
        }
        
        # Determine overall security status
        success_rate = self.results["summary"]["success_rate"]
        if success_rate >= 95:
            self.results["summary"]["security_status"] = "EXCELLENT"
        elif success_rate >= 85:
            self.results["summary"]["security_status"] = "STRONG"
        elif success_rate >= 70:
            self.results["summary"]["security_status"] = "MODERATE"
        else:
            self.results["summary"]["security_status"] = "WEAK"
    
    def run_validation(self):
        """Run complete production security validation."""
        print("🔒 Production Security Validation")
        print("=" * 60)
        
        # Run all validation tests
        validation_tests = [
            ("Secret Key Strength", self.validate_secret_key_strength),
            ("HTTPS Configuration", self.validate_https_configuration),
            ("Security Headers", self.validate_security_headers),
            ("CORS Configuration", self.validate_cors_configuration),
            ("Rate Limiting", self.validate_rate_limiting),
            ("Security Test Suite", self.run_pytest_security_tests)
        ]
        
        for test_name, test_func in validation_tests:
            print(f"\n🔍 {test_name}...")
            try:
                passed = test_func()
                status = "✅ PASS" if passed else "❌ FAIL"
                print(f"   {status}")
            except Exception as e:
                print(f"   ❌ ERROR: {e}")
        
        # Generate summary
        self.generate_summary()
        
        # Print summary
        print(f"\n{'=' * 60}")
        print("🔒 VALIDATION SUMMARY")
        print(f"{'=' * 60}")
        
        summary = self.results["summary"]
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed_tests']}")
        print(f"Failed: {summary['failed_tests']}")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print(f"Security Status: {summary['security_status']}")
        print(f"Production Ready: {'✅ YES' if summary['production_ready'] else '❌ NO'}")
        
        if self.results["recommendations"]:
            print(f"\n📋 RECOMMENDATIONS ({len(self.results['recommendations'])}):")
            for i, rec in enumerate(self.results["recommendations"], 1):
                print(f"  {i}. {rec}")
        
        # Save detailed report
        report_file = f"production_security_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n📄 Detailed report saved to: {report_file}")
        
        return self.results


if __name__ == "__main__":
    validator = ProductionSecurityValidator()
    results = validator.run_validation()
    
    # Exit with appropriate code
    sys.exit(0 if results["summary"]["production_ready"] else 1)