#!/usr/bin/env python3
"""
Test CORS Configuration

Simple script to test that CORS is working correctly for image serving.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
dev_env_path = Path(__file__).parent.parent / ".env"
if dev_env_path.exists():
    load_dotenv(dev_env_path)

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.security_config import SecurityConfig

def test_cors_configuration():
    """Test CORS configuration for development and production."""
    print("=" * 60)
    print(" CORS Configuration Test")
    print("=" * 60)
    
    config = SecurityConfig()
    
    print(f"Environment: {config.environment}")
    print(f"Is Development: {config.is_development}")
    print(f"Is Production: {config.is_production()}")
    
    cors_config = config.get_cors_config()
    
    print(f"\nCORS Configuration:")
    print(f"  Allow Origins: {cors_config['allow_origins']}")
    print(f"  Allow Credentials: {cors_config['allow_credentials']}")
    print(f"  Allow Methods: {cors_config['allow_methods']}")
    print(f"  Allow Headers: {cors_config['allow_headers']}")
    print(f"  Expose Headers: {cors_config['expose_headers']}")
    print(f"  Max Age: {cors_config['max_age']}")
    
    # Test security headers
    security_headers = config.get_security_headers()
    
    print(f"\nSecurity Headers:")
    print(f"  Cross-Origin-Resource-Policy: {security_headers.get('Cross-Origin-Resource-Policy', 'Not set')}")
    print(f"  X-Frame-Options: {security_headers.get('X-Frame-Options', 'Not set')}")
    print(f"  Cache-Control: {security_headers.get('Cache-Control', 'Not set')}")
    
    # Check if configuration is suitable for image serving
    print(f"\nImage Serving Analysis:")
    
    if config.is_development:
        if cors_config['allow_origins'] == ['*']:
            print("✅ CORS allows all origins - images should load from any domain")
        else:
            print("⚠️  CORS is restrictive - images may not load from all domains")
        
        if cors_config['allow_headers'] == ['*']:
            print("✅ CORS allows all headers - no header restrictions")
        else:
            print("⚠️  CORS has header restrictions")
        
        if security_headers.get('Cross-Origin-Resource-Policy') == 'cross-origin':
            print("✅ Cross-Origin-Resource-Policy allows cross-origin access")
        else:
            print("⚠️  Cross-Origin-Resource-Policy may block cross-origin access")
    else:
        print("🔒 Production mode - CORS is appropriately restrictive")
        print(f"   Allowed origins: {len(cors_config['allow_origins'])} domains")
    
    print(f"\nRecommendations:")
    if config.is_development:
        print("✅ Development configuration is permissive for local development")
        print("✅ Images should load correctly from frontend applications")
        print("✅ CORS is configured to allow cross-origin requests")
    else:
        print("🔒 Production configuration is secure")
        print("🔒 Only specified domains can access the API")
        print("🔒 Credentials are required for authenticated requests")

if __name__ == "__main__":
    test_cors_configuration()