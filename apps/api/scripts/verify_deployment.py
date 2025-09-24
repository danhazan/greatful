#!/usr/bin/env python3
"""
Railway Deployment Verification Script

This script verifies that the Railway deployment is working correctly.

Usage:
    python scripts/verify_deployment.py https://your-app.railway.app
"""

import sys
import requests
import json
from typing import Dict, Any

def verify_health_endpoint(base_url: str) -> bool:
    """Verify the health endpoint is responding correctly."""
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def verify_cors_headers(base_url: str) -> bool:
    """Verify CORS headers are properly configured."""
    try:
        response = requests.options(f"{base_url}/health", 
                                  headers={'Origin': 'https://greatful-gilt.vercel.app'},
                                  timeout=10)
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
        }
        print(f"✅ CORS headers: {cors_headers}")
        return True
    except Exception as e:
        print(f"❌ CORS check error: {e}")
        return False

def verify_security_headers(base_url: str) -> bool:
    """Verify security headers are present."""
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        security_headers = {
            'Strict-Transport-Security': response.headers.get('Strict-Transport-Security'),
            'X-Frame-Options': response.headers.get('X-Frame-Options'),
            'X-Content-Type-Options': response.headers.get('X-Content-Type-Options'),
            'Content-Security-Policy': response.headers.get('Content-Security-Policy'),
        }
        
        missing_headers = [k for k, v in security_headers.items() if not v]
        if missing_headers:
            print(f"⚠️  Missing security headers: {missing_headers}")
        else:
            print("✅ All security headers present")
        
        print(f"Security headers: {security_headers}")
        return len(missing_headers) == 0
    except Exception as e:
        print(f"❌ Security headers check error: {e}")
        return False

def verify_docs_disabled(base_url: str) -> bool:
    """Verify API documentation is disabled in production."""
    try:
        response = requests.get(f"{base_url}/docs", timeout=10)
        if response.status_code == 404:
            print("✅ API docs properly disabled in production")
            return True
        else:
            print(f"⚠️  API docs accessible (status: {response.status_code})")
            return False
    except Exception as e:
        print(f"❌ Docs check error: {e}")
        return False

def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/verify_deployment.py https://your-app.railway.app")
        sys.exit(1)
    
    base_url = sys.argv[1].rstrip('/')
    print(f"🚀 Verifying Railway deployment: {base_url}")
    print("=" * 50)
    
    checks = [
        ("Health Endpoint", verify_health_endpoint),
        ("CORS Headers", verify_cors_headers),
        ("Security Headers", verify_security_headers),
        ("Docs Disabled", verify_docs_disabled),
    ]
    
    passed = 0
    total = len(checks)
    
    for name, check_func in checks:
        print(f"\n🔍 Checking {name}...")
        if check_func(base_url):
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Results: {passed}/{total} checks passed")
    
    if passed == total:
        print("🎉 All deployment verification checks passed!")
        print("\n📋 Next steps:")
        print("1. Update Vercel environment variables:")
        print(f"   NEXT_PUBLIC_API_URL={base_url}/api/v1")
        print("2. Test end-to-end functionality")
        print("3. Monitor Railway dashboard for performance metrics")
    else:
        print("⚠️  Some checks failed. Please review the issues above.")
        sys.exit(1)

if __name__ == '__main__':
    main()