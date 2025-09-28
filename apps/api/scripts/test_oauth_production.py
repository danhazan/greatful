#!/usr/bin/env python3
"""
Production OAuth Configuration Testing Script

This script tests OAuth configuration for production deployment.
Run this script to verify OAuth setup before going live.
"""

import os
import sys
import asyncio
import httpx
import json
from typing import Dict, Any, Optional
from urllib.parse import urlparse, parse_qs

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.oauth_config import (
    get_oauth_config,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    FACEBOOK_REDIRECT_URI,
    FRONTEND_SUCCESS_URL,
    FRONTEND_ERROR_URL,
    ALLOWED_ORIGINS,
    ENVIRONMENT
)

class OAuthProductionTester:
    """Test OAuth configuration for production deployment."""
    
    def __init__(self):
        self.base_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.results = []
        
    def log_result(self, test_name: str, status: str, message: str, details: Optional[Dict] = None):
        """Log test result."""
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {}
        }
        self.results.append(result)
        
        # Color coding for terminal output
        color = {
            "PASS": "\033[92m",  # Green
            "FAIL": "\033[91m",  # Red
            "WARN": "\033[93m",  # Yellow
            "INFO": "\033[94m"   # Blue
        }.get(status, "")
        reset = "\033[0m"
        
        print(f"{color}[{status}]{reset} {test_name}: {message}")
        if details:
            for key, value in details.items():
                print(f"  {key}: {value}")
    
    def test_environment_variables(self):
        """Test that all required environment variables are set."""
        print("\n=== Testing Environment Variables ===")
        
        required_vars = {
            "GOOGLE_CLIENT_ID": GOOGLE_CLIENT_ID,
            "GOOGLE_CLIENT_SECRET": GOOGLE_CLIENT_SECRET,
            "ENVIRONMENT": ENVIRONMENT
        }
        
        for var_name, var_value in required_vars.items():
            if not var_value or var_value in ["your-google-client-id-here", "your-google-client-secret-here"]:
                self.log_result(
                    f"Environment Variable: {var_name}",
                    "FAIL",
                    f"{var_name} is not properly configured",
                    {"current_value": var_value or "None"}
                )
            else:
                # Mask sensitive values
                display_value = var_value[:8] + "..." if len(var_value) > 8 else var_value
                if "secret" in var_name.lower():
                    display_value = "***configured***"
                
                self.log_result(
                    f"Environment Variable: {var_name}",
                    "PASS",
                    f"{var_name} is configured",
                    {"value": display_value}
                )
    
    def test_oauth_configuration(self):
        """Test OAuth configuration object."""
        print("\n=== Testing OAuth Configuration ===")
        
        try:
            oauth_config = get_oauth_config()
            status = oauth_config.get_provider_status()
            
            self.log_result(
                "OAuth Config Initialization",
                "PASS",
                "OAuth configuration initialized successfully",
                {
                    "environment": status.get("environment"),
                    "initialized": status.get("initialized"),
                    "providers": status.get("providers", {})
                }
            )
            
            # Test provider availability
            providers = status.get("providers", {})
            for provider, available in providers.items():
                status_text = "PASS" if available else "WARN"
                message = f"{provider} provider is {'available' if available else 'not available'}"
                self.log_result(f"OAuth Provider: {provider}", status_text, message)
            
        except Exception as e:
            self.log_result(
                "OAuth Config Initialization",
                "FAIL",
                f"Failed to initialize OAuth configuration: {str(e)}"
            )
    
    def test_redirect_uris(self):
        """Test OAuth redirect URI configuration."""
        print("\n=== Testing Redirect URIs ===")
        
        uris_to_test = {
            "Google Redirect URI": GOOGLE_REDIRECT_URI,
            "Facebook Redirect URI": FACEBOOK_REDIRECT_URI,
            "Frontend Success URL": FRONTEND_SUCCESS_URL,
            "Frontend Error URL": FRONTEND_ERROR_URL
        }
        
        for uri_name, uri_value in uris_to_test.items():
            if not uri_value:
                self.log_result(uri_name, "FAIL", f"{uri_name} is not configured")
                continue
            
            # Parse URI
            parsed = urlparse(uri_value)
            
            # Check if URI uses HTTPS in production
            if ENVIRONMENT == "production" and parsed.scheme != "https":
                self.log_result(
                    uri_name,
                    "FAIL",
                    f"{uri_name} should use HTTPS in production",
                    {"uri": uri_value, "scheme": parsed.scheme}
                )
            else:
                self.log_result(
                    uri_name,
                    "PASS",
                    f"{uri_name} is properly configured",
                    {"uri": uri_value}
                )
    
    def test_cors_configuration(self):
        """Test CORS configuration."""
        print("\n=== Testing CORS Configuration ===")
        
        if not ALLOWED_ORIGINS:
            self.log_result(
                "CORS Origins",
                "FAIL",
                "No CORS origins configured"
            )
            return
        
        for origin in ALLOWED_ORIGINS:
            if not origin:
                continue
                
            parsed = urlparse(origin)
            
            # Check if origin uses HTTPS in production
            if ENVIRONMENT == "production" and parsed.scheme != "https":
                self.log_result(
                    f"CORS Origin: {origin}",
                    "WARN",
                    f"CORS origin should use HTTPS in production",
                    {"origin": origin}
                )
            else:
                self.log_result(
                    f"CORS Origin: {origin}",
                    "PASS",
                    f"CORS origin is properly configured",
                    {"origin": origin}
                )
    
    async def test_api_endpoints(self):
        """Test OAuth API endpoints."""
        print("\n=== Testing API Endpoints ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test health endpoint
            try:
                response = await client.get(f"{self.base_url}/health")
                if response.status_code == 200:
                    self.log_result(
                        "Health Endpoint",
                        "PASS",
                        "Health endpoint is accessible",
                        {"status_code": response.status_code}
                    )
                else:
                    self.log_result(
                        "Health Endpoint",
                        "FAIL",
                        f"Health endpoint returned {response.status_code}",
                        {"status_code": response.status_code}
                    )
            except Exception as e:
                self.log_result(
                    "Health Endpoint",
                    "FAIL",
                    f"Cannot reach health endpoint: {str(e)}"
                )
            
            # Test OAuth providers endpoint
            try:
                response = await client.get(f"{self.base_url}/api/v1/oauth/providers")
                if response.status_code == 200:
                    data = response.json()
                    self.log_result(
                        "OAuth Providers Endpoint",
                        "PASS",
                        "OAuth providers endpoint is accessible",
                        {
                            "status_code": response.status_code,
                            "providers": data.get("data", {}).get("providers", {})
                        }
                    )
                else:
                    self.log_result(
                        "OAuth Providers Endpoint",
                        "FAIL",
                        f"OAuth providers endpoint returned {response.status_code}",
                        {"status_code": response.status_code}
                    )
            except Exception as e:
                self.log_result(
                    "OAuth Providers Endpoint",
                    "FAIL",
                    f"Cannot reach OAuth providers endpoint: {str(e)}"
                )
            
            # Test OAuth login redirect (should return 302 redirect)
            try:
                response = await client.get(
                    f"{self.base_url}/api/v1/oauth/login/google",
                    follow_redirects=False
                )
                if response.status_code in [302, 307]:
                    location = response.headers.get("location", "")
                    if "accounts.google.com" in location:
                        self.log_result(
                            "OAuth Login Redirect",
                            "PASS",
                            "OAuth login redirects to Google",
                            {"status_code": response.status_code}
                        )
                    else:
                        self.log_result(
                            "OAuth Login Redirect",
                            "WARN",
                            "OAuth login redirect location unexpected",
                            {"location": location[:100] + "..." if len(location) > 100 else location}
                        )
                else:
                    self.log_result(
                        "OAuth Login Redirect",
                        "FAIL",
                        f"OAuth login should redirect (302/307), got {response.status_code}",
                        {"status_code": response.status_code}
                    )
            except Exception as e:
                self.log_result(
                    "OAuth Login Redirect",
                    "FAIL",
                    f"Cannot test OAuth login redirect: {str(e)}"
                )
    
    def test_security_configuration(self):
        """Test security configuration."""
        print("\n=== Testing Security Configuration ===")
        
        # Test environment-specific security settings
        if ENVIRONMENT == "production":
            # Production security checks
            security_checks = [
                ("HTTPS URLs", all(url.startswith("https://") for url in [self.base_url, self.frontend_url] if url)),
                ("Secure Origins", all(origin.startswith("https://") for origin in ALLOWED_ORIGINS if origin)),
            ]
            
            for check_name, check_result in security_checks:
                status = "PASS" if check_result else "FAIL"
                message = f"{check_name} {'configured correctly' if check_result else 'needs attention'}"
                self.log_result(f"Security: {check_name}", status, message)
        else:
            self.log_result(
                "Security: Environment",
                "INFO",
                f"Running in {ENVIRONMENT} environment - some security checks skipped"
            )
    
    def generate_report(self):
        """Generate test report."""
        print("\n" + "="*60)
        print("OAUTH PRODUCTION CONFIGURATION TEST REPORT")
        print("="*60)
        
        # Count results
        total_tests = len(self.results)
        passed = len([r for r in self.results if r["status"] == "PASS"])
        failed = len([r for r in self.results if r["status"] == "FAIL"])
        warnings = len([r for r in self.results if r["status"] == "WARN"])
        
        print(f"\nTotal Tests: {total_tests}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Warnings: {warnings}")
        
        # Overall status
        if failed > 0:
            print(f"\n🔴 OVERALL STATUS: FAILED ({failed} critical issues)")
            print("❌ OAuth is NOT ready for production deployment")
        elif warnings > 0:
            print(f"\n🟡 OVERALL STATUS: WARNINGS ({warnings} issues need attention)")
            print("⚠️  OAuth may work but has configuration issues")
        else:
            print(f"\n🟢 OVERALL STATUS: PASSED")
            print("✅ OAuth is ready for production deployment")
        
        # Failed tests summary
        if failed > 0:
            print("\n🔴 CRITICAL ISSUES TO FIX:")
            for result in self.results:
                if result["status"] == "FAIL":
                    print(f"  - {result['test']}: {result['message']}")
        
        # Warnings summary
        if warnings > 0:
            print("\n🟡 WARNINGS TO ADDRESS:")
            for result in self.results:
                if result["status"] == "WARN":
                    print(f"  - {result['test']}: {result['message']}")
        
        # Next steps
        print("\n📋 NEXT STEPS:")
        if failed > 0:
            print("1. Fix all critical issues listed above")
            print("2. Re-run this test script")
            print("3. Configure OAuth credentials in Google Console")
            print("4. Set environment variables in Railway/Vercel")
        elif warnings > 0:
            print("1. Address warnings if possible")
            print("2. Configure OAuth credentials in Google Console")
            print("3. Set environment variables in Railway/Vercel")
            print("4. Deploy and test OAuth flow")
        else:
            print("1. Configure OAuth credentials in Google Console")
            print("2. Set environment variables in Railway/Vercel")
            print("3. Deploy to production")
            print("4. Test OAuth flow end-to-end")
        
        return failed == 0
    
    async def run_all_tests(self):
        """Run all OAuth production tests."""
        print("🔍 Starting OAuth Production Configuration Tests...")
        print(f"Environment: {ENVIRONMENT}")
        print(f"Backend URL: {self.base_url}")
        print(f"Frontend URL: {self.frontend_url}")
        
        # Run tests
        self.test_environment_variables()
        self.test_oauth_configuration()
        self.test_redirect_uris()
        self.test_cors_configuration()
        await self.test_api_endpoints()
        self.test_security_configuration()
        
        # Generate report
        success = self.generate_report()
        
        return success

async def main():
    """Main test runner."""
    tester = OAuthProductionTester()
    success = await tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())