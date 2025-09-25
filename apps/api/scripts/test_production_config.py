#!/usr/bin/env python3
"""
Test Production Configuration

Simple script to test that production configuration is working correctly.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from config/.env
env_path = Path(__file__).parent.parent / "config" / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ Loaded environment from: {env_path}")
else:
    print(f"❌ Environment file not found: {env_path}")
    sys.exit(1)

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.security_config import SecurityConfig

def test_production_config():
    """Test production configuration."""
    print("\n" + "=" * 60)
    print(" Production Configuration Test")
    print("=" * 60)
    
    config = SecurityConfig()
    
    # Test environment
    print(f"Environment: {config.environment}")
    if config.environment.lower() == "production":
        print("✅ Running in production mode")
    else:
        print("⚠️  Not running in production mode")
    
    # Test secret key
    print(f"Secret Key Length: {len(config.secret_key)} characters")
    if config.is_secure_secret_key():
        print("✅ Secret key is secure")
    else:
        print("❌ Secret key needs improvement")
    
    # Test HTTPS configuration
    print(f"SSL Redirect: {config.ssl_redirect}")
    print(f"HSTS Max Age: {config.hsts_max_age} seconds")
    print(f"HSTS Preload: {config.hsts_preload}")
    print(f"HSTS Include Subdomains: {config.hsts_include_subdomains}")
    
    # Test CORS configuration
    print(f"Allowed Origins: {len(config.allowed_origins)} origins")
    for origin in config.allowed_origins:
        print(f"  - {origin}")
    
    if config.has_https_origins():
        print("✅ All origins use HTTPS")
    else:
        print("⚠️  Some origins don't use HTTPS")
    
    # Test rate limiting
    print(f"Default Rate Limit: {config.default_rate_limit}/min")
    print(f"Auth Rate Limit: {config.auth_rate_limit}/min")
    print(f"Upload Rate Limit: {config.upload_rate_limit}/min")
    
    # Test cookie security
    print(f"Secure Cookies: {config.secure_cookies}")
    print(f"Cookie SameSite: {config.cookie_samesite}")
    print(f"Cookie HttpOnly: {config.cookie_httponly}")
    
    # Overall assessment
    print("\n" + "=" * 60)
    print(" Configuration Assessment")
    print("=" * 60)
    
    issues = []
    
    if config.environment.lower() != "production":
        issues.append("Environment not set to production")
    
    if not config.is_secure_secret_key():
        issues.append("Secret key is not secure enough")
    
    if not config.ssl_redirect:
        issues.append("SSL redirect is disabled")
    
    if not config.has_https_origins():
        issues.append("Some CORS origins don't use HTTPS")
    
    if not config.secure_cookies:
        issues.append("Secure cookies are disabled")
    
    if issues:
        print("❌ Configuration Issues Found:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ Configuration is production ready!")
        return True

if __name__ == "__main__":
    success = test_production_config()
    sys.exit(0 if success else 1)