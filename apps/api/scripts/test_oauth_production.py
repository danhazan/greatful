#!/usr/bin/env python3
"""
OAuth Production Configuration Testing Script

This script tests the OAuth configuration for production deployment,
verifying that all components are properly configured for the production environment.

Usage:
    python scripts/test_oauth_production.py [--frontend-url https://grateful-net.vercel.app] [--backend-url https://your-api.railway.app]
"""

import asyncio
import sys
import os
import json
import logging
from typing import Dict, Any, Optional
import httpx
from urllib.parse import urljoin, urlparse

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.oauth_config import OAuthConfig, get_oauth_config
from app.core.security_config import SecurityConfig

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OAuthProductionTester:
    """Test OAuth configuration for production deployment."""
    
    def __init__(self, frontend_url: str = "https://grateful-net.vercel.app", 
                 backend_url: str = "https://grateful-production.up.railway.app"):
        self.frontend_url = frontend_url.rstrip('/')
        self.backend_url = backend_url.rstrip('/')
        self.test_results = []
        
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all OAuth production configuration tests."""
        logger.info("🚀 Starting OAuth Production Configuration Tests")
        logger.info(f"Frontend URL: {self.frontend_url}")
        logger.info(f"Backend URL: {self.backend_url}")
        
        # Test 1: OAuth Configuration Validation
        await self._test_oauth_config_validation()
        
        # Test 2: Environment Variables
        await self._test_environment_variables()
        
        # Test 3: CORS Configuration
        await self._test_cors_configuration()
        
        # Test 4: Security Headers
        await self._test_security_headers()
        
        # Test 5: OAuth Endpoints
        await self._test_oauth_endpoints()
        
        # Test 6: Redirect URI Validation
        await self._test_redirect_uri_validation()
        
        # Test 7: Session Security
        await self._test_session_security()
        
        # Generate test report
        return self._generate_test_report()
    
    async def _test_oauth_config_validation(self):
        """Test OAuth configuration validation."""
        logger.info("📋 Testing OAuth Configuration Validation...")
        
        try:
            # Test OAuth config initialization
            oauth_config = OAuthConfig()
            status = oauth_config.get_provider_status()
            
            # Check Google provider
            google_available = status['providers'].get('google', False)
            self._add_test_result(
                "OAuth Config - Google Provider",
                google_available,
                "Google OAuth provider is configured and available" if google_available 
                else "Google OAuth provider is not properly configured"
            )
            
            # Check redirect URI
            redirect_uri = status.get('redirect_uri', '')
            is_https = redirect_uri.startswith('https://')
            self._add_test_result(
                "OAuth Config - HTTPS Redirect URI",
                is_https,
                f"Redirect URI uses HTTPS: {redirect_uri}" if is_https 
                else f"Redirect URI should use HTTPS in production: {redirect_uri}"
            )
            
            # Check environment
            is_production = status.get('environment') == 'production'
            self._add_test_result(
                "OAuth Config - Production Environment",
                is_production,
                "Environment is set to production" if is_production 
                else f"Environment is set to: {status.get('environment')}"
            )
            
        except Exception as e:
            self._add_test_result(
                "OAuth Config - Initialization",
                False,
                f"OAuth configuration failed to initialize: {e}"
            )
    
    async def _test_environment_variables(self):
        """Test that all required environment variables are set."""
        logger.info("🔧 Testing Environment Variables...")
        
        required_vars = {
            'GOOGLE_CLIENT_ID': 'Google OAuth Client ID',
            'GOOGLE_CLIENT_SECRET': 'Google OAuth Client Secret',
            'OAUTH_REDIRECT_URI': 'OAuth Redirect URI',
            'SESSION_SECRET': 'Session Secret Key',
            'SECRET_KEY': 'JWT Secret Key',
            'ALLOWED_ORIGINS': 'CORS Allowed Origins'
        }
        
        for var_name, description in required_vars.items():
            value = os.getenv(var_name)
            is_set = bool(value and value != f"your-{var_name.lower().replace('_', '-')}-here")
            
            # Special validation for specific variables
            if var_name == 'OAUTH_REDIRECT_URI' and value:
                is_https = value.startswith('https://')
                is_correct_domain = 'grateful-net.vercel.app' in value
                is_valid = is_https and is_correct_domain
                
                self._add_test_result(
                    f"Environment - {description}",
                    is_valid,
                    f"✅ {value}" if is_valid else f"❌ Should be HTTPS with correct domain: {value}"
                )
            elif var_name == 'ALLOWED_ORIGINS' and value:
                origins = [origin.strip() for origin in value.split(',')]
                all_https = all(origin.startswith('https://') or origin.startswith('http://localhost') for origin in origins)
                has_production_domain = any('grateful-net.vercel.app' in origin for origin in origins)
                is_valid = all_https and has_production_domain
                
                self._add_test_result(
                    f"Environment - {description}",
                    is_valid,
                    f"✅ {value}" if is_valid else f"❌ Should include production domain with HTTPS: {value}"
                )
            else:
                self._add_test_result(
                    f"Environment - {description}",
                    is_set,
                    "✅ Configured" if is_set else "❌ Not configured or using default value"
                )
    
    async def _test_cors_configuration(self):
        """Test CORS configuration for OAuth."""
        logger.info("🌐 Testing CORS Configuration...")
        
        try:
            async with httpx.AsyncClient() as client:
                # Test preflight request for OAuth endpoint
                response = await client.options(
                    f"{self.backend_url}/api/v1/oauth/google/login",
                    headers={
                        'Origin': self.frontend_url,
                        'Access-Control-Request-Method': 'POST',
                        'Access-Control-Request-Headers': 'Content-Type,Authorization'
                    },
                    timeout=10.0
                )
                
                cors_headers = response.headers
                allow_origin = cors_headers.get('Access-Control-Allow-Origin')
                allow_credentials = cors_headers.get('Access-Control-Allow-Credentials')
                allow_methods = cors_headers.get('Access-Control-Allow-Methods', '')
                
                # Check CORS configuration
                origin_allowed = allow_origin == self.frontend_url or allow_origin == '*'
                credentials_allowed = allow_credentials == 'true'
                post_allowed = 'POST' in allow_methods
                
                self._add_test_result(
                    "CORS - Origin Allowed",
                    origin_allowed,
                    f"✅ Origin allowed: {allow_origin}" if origin_allowed 
                    else f"❌ Origin not allowed. Expected: {self.frontend_url}, Got: {allow_origin}"
                )
                
                self._add_test_result(
                    "CORS - Credentials Allowed",
                    credentials_allowed,
                    "✅ Credentials allowed for OAuth" if credentials_allowed 
                    else "❌ Credentials not allowed - required for OAuth"
                )
                
                self._add_test_result(
                    "CORS - POST Method Allowed",
                    post_allowed,
                    "✅ POST method allowed" if post_allowed 
                    else f"❌ POST method not allowed. Methods: {allow_methods}"
                )
                
        except Exception as e:
            self._add_test_result(
                "CORS - Configuration Test",
                False,
                f"❌ Failed to test CORS: {e}"
            )
    
    async def _test_security_headers(self):
        """Test security headers for OAuth endpoints."""
        logger.info("🔒 Testing Security Headers...")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.backend_url}/api/v1/oauth/google/login",
                    timeout=10.0
                )
                
                headers = response.headers
                
                # Check security headers
                security_checks = {
                    'X-Frame-Options': 'DENY',
                    'X-Content-Type-Options': 'nosniff',
                    'X-XSS-Protection': '1; mode=block',
                    'Strict-Transport-Security': None,  # Should exist in production
                    'Content-Security-Policy': None,  # Should exist
                }
                
                for header, expected in security_checks.items():
                    value = headers.get(header)
                    if expected:
                        is_correct = value == expected
                        self._add_test_result(
                            f"Security Headers - {header}",
                            is_correct,
                            f"✅ {header}: {value}" if is_correct 
                            else f"❌ Expected: {expected}, Got: {value}"
                        )
                    else:
                        is_present = bool(value)
                        self._add_test_result(
                            f"Security Headers - {header}",
                            is_present,
                            f"✅ {header}: Present" if is_present 
                            else f"❌ {header}: Missing"
                        )
                
        except Exception as e:
            self._add_test_result(
                "Security Headers - Test",
                False,
                f"❌ Failed to test security headers: {e}"
            )
    
    async def _test_oauth_endpoints(self):
        """Test OAuth endpoints availability."""
        logger.info("🔗 Testing OAuth Endpoints...")
        
        endpoints = [
            '/api/v1/oauth/google/login',
            '/api/v1/oauth/google/callback',
            '/api/v1/oauth/providers',
        ]
        
        async with httpx.AsyncClient() as client:
            for endpoint in endpoints:
                try:
                    url = f"{self.backend_url}{endpoint}"
                    response = await client.get(url, timeout=10.0)
                    
                    # OAuth endpoints should not return 404
                    is_available = response.status_code != 404
                    
                    self._add_test_result(
                        f"OAuth Endpoint - {endpoint}",
                        is_available,
                        f"✅ Available (Status: {response.status_code})" if is_available 
                        else f"❌ Not found (Status: {response.status_code})"
                    )
                    
                except Exception as e:
                    self._add_test_result(
                        f"OAuth Endpoint - {endpoint}",
                        False,
                        f"❌ Failed to test: {e}"
                    )
    
    async def _test_redirect_uri_validation(self):
        """Test OAuth redirect URI validation."""
        logger.info("🔄 Testing Redirect URI Validation...")
        
        try:
            # Test that the configured redirect URI matches expected format
            redirect_uri = os.getenv('OAUTH_REDIRECT_URI', '')
            
            # Parse the URI
            parsed = urlparse(redirect_uri)
            
            # Validation checks
            is_https = parsed.scheme == 'https'
            is_correct_domain = 'grateful-net.vercel.app' in parsed.netloc
            is_correct_path = '/auth/callback/google' in parsed.path
            
            self._add_test_result(
                "Redirect URI - HTTPS",
                is_https,
                f"✅ Uses HTTPS: {redirect_uri}" if is_https 
                else f"❌ Should use HTTPS: {redirect_uri}"
            )
            
            self._add_test_result(
                "Redirect URI - Domain",
                is_correct_domain,
                f"✅ Correct domain: {parsed.netloc}" if is_correct_domain 
                else f"❌ Should use grateful-net.vercel.app: {parsed.netloc}"
            )
            
            self._add_test_result(
                "Redirect URI - Path",
                is_correct_path,
                f"✅ Correct path: {parsed.path}" if is_correct_path 
                else f"❌ Should include /auth/callback/google: {parsed.path}"
            )
            
        except Exception as e:
            self._add_test_result(
                "Redirect URI - Validation",
                False,
                f"❌ Failed to validate redirect URI: {e}"
            )
    
    async def _test_session_security(self):
        """Test session security configuration."""
        logger.info("🍪 Testing Session Security...")
        
        try:
            # Test session configuration
            session_secret = os.getenv('SESSION_SECRET', '')
            is_secure_session = len(session_secret) >= 32 and session_secret != 'dev-secret'
            
            self._add_test_result(
                "Session Security - Secret Key",
                is_secure_session,
                "✅ Session secret is secure" if is_secure_session 
                else "❌ Session secret should be at least 32 characters and not default"
            )
            
            # Test cookie security settings
            environment = os.getenv('ENVIRONMENT', 'development')
            secure_cookies = os.getenv('SECURE_COOKIES', 'false').lower() == 'true'
            httponly_cookies = os.getenv('COOKIE_HTTPONLY', 'true').lower() == 'true'
            samesite = os.getenv('COOKIE_SAMESITE', 'Lax')
            
            if environment == 'production':
                self._add_test_result(
                    "Session Security - Secure Cookies",
                    secure_cookies,
                    "✅ Secure cookies enabled for production" if secure_cookies 
                    else "❌ Secure cookies should be enabled in production"
                )
            
            self._add_test_result(
                "Session Security - HttpOnly Cookies",
                httponly_cookies,
                "✅ HttpOnly cookies enabled" if httponly_cookies 
                else "❌ HttpOnly cookies should be enabled"
            )
            
            valid_samesite = samesite in ['Lax', 'Strict', 'None']
            self._add_test_result(
                "Session Security - SameSite Setting",
                valid_samesite,
                f"✅ SameSite setting: {samesite}" if valid_samesite 
                else f"❌ Invalid SameSite setting: {samesite}"
            )
            
        except Exception as e:
            self._add_test_result(
                "Session Security - Configuration",
                False,
                f"❌ Failed to test session security: {e}"
            )
    
    def _add_test_result(self, test_name: str, passed: bool, message: str):
        """Add a test result to the results list."""
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'message': message
        })
        
        # Log the result
        status = "✅ PASS" if passed else "❌ FAIL"
        logger.info(f"{status} {test_name}: {message}")
    
    def _generate_test_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report."""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['passed'])
        failed_tests = total_tests - passed_tests
        
        report = {
            'summary': {
                'total_tests': total_tests,
                'passed': passed_tests,
                'failed': failed_tests,
                'success_rate': f"{(passed_tests/total_tests)*100:.1f}%" if total_tests > 0 else "0%",
                'overall_status': 'READY' if failed_tests == 0 else 'NEEDS_ATTENTION'
            },
            'test_results': self.test_results,
            'recommendations': self._generate_recommendations()
        }
        
        return report
    
    def _generate_recommendations(self) -> list:
        """Generate recommendations based on test results."""
        recommendations = []
        
        failed_tests = [result for result in self.test_results if not result['passed']]
        
        if any('OAuth Config' in test['test'] for test in failed_tests):
            recommendations.append(
                "🔧 Update Google OAuth Console with production redirect URIs: "
                "https://grateful-net.vercel.app/auth/callback/google"
            )
        
        if any('Environment' in test['test'] for test in failed_tests):
            recommendations.append(
                "⚙️ Set missing environment variables in Railway dashboard"
            )
        
        if any('CORS' in test['test'] for test in failed_tests):
            recommendations.append(
                "🌐 Update ALLOWED_ORIGINS to include production frontend domain"
            )
        
        if any('Security' in test['test'] for test in failed_tests):
            recommendations.append(
                "🔒 Enable security headers and HTTPS-only cookies for production"
            )
        
        if any('Session' in test['test'] for test in failed_tests):
            recommendations.append(
                "🍪 Generate secure session secret and enable secure cookie settings"
            )
        
        if not recommendations:
            recommendations.append("🎉 All tests passed! OAuth is ready for production.")
        
        return recommendations

async def main():
    """Main test execution."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test OAuth production configuration')
    parser.add_argument('--frontend-url', default='https://grateful-net.vercel.app',
                       help='Frontend URL (default: https://grateful-net.vercel.app)')
    parser.add_argument('--backend-url', default='https://grateful-production.up.railway.app',
                       help='Backend URL (default: https://grateful-production.up.railway.app)')
    parser.add_argument('--output', help='Output file for test results (JSON)')
    
    args = parser.parse_args()
    
    # Run tests
    tester = OAuthProductionTester(args.frontend_url, args.backend_url)
    report = await tester.run_all_tests()
    
    # Print summary
    print("\n" + "="*60)
    print("🎯 OAUTH PRODUCTION CONFIGURATION TEST SUMMARY")
    print("="*60)
    print(f"Total Tests: {report['summary']['total_tests']}")
    print(f"Passed: {report['summary']['passed']}")
    print(f"Failed: {report['summary']['failed']}")
    print(f"Success Rate: {report['summary']['success_rate']}")
    print(f"Overall Status: {report['summary']['overall_status']}")
    
    # Print recommendations
    if report['recommendations']:
        print("\n📋 RECOMMENDATIONS:")
        for i, rec in enumerate(report['recommendations'], 1):
            print(f"{i}. {rec}")
    
    # Save report if requested
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n📄 Full report saved to: {args.output}")
    
    # Exit with appropriate code
    sys.exit(0 if report['summary']['failed'] == 0 else 1)

if __name__ == "__main__":
    asyncio.run(main())