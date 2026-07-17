#!/usr/bin/env python3
"""
Test script to verify OAuth credentials are properly configured.
"""
import os
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def test_oauth_credentials():
    """Test OAuth credentials configuration."""
    print("🔐 Testing OAuth Credentials Configuration...")
    
    # Check environment variables
    required_vars = {
        'GOOGLE_CLIENT_ID': os.getenv('GOOGLE_CLIENT_ID'),
        'GOOGLE_CLIENT_SECRET': os.getenv('GOOGLE_CLIENT_SECRET'),
        'APPLE_CLIENT_ID': os.getenv('APPLE_CLIENT_ID'),
        'APPLE_CLIENT_SECRET': os.getenv('APPLE_CLIENT_SECRET'),
        'OAUTH_REDIRECT_URI': os.getenv('OAUTH_REDIRECT_URI')
    }
    
    print("\n📋 Environment Variables Check:")
    all_configured = True
    
    for var_name, var_value in required_vars.items():
        if var_value and not var_value.startswith('your-'):
            print(f"✅ {var_name}: Configured")
        else:
            print(f"❌ {var_name}: Not configured (using placeholder or missing)")
            all_configured = False
    
    if all_configured:
        print("\n🎉 All OAuth credentials are configured!")
        
        # Test OAuth configuration initialization
        try:
            from app.core.oauth_config import get_oauth_config, initialize_oauth_providers
            
            print("\n🔧 Testing OAuth Configuration...")
            oauth_config = get_oauth_config()
            oauth_instance = initialize_oauth_providers()
            
            status = oauth_config.get_provider_status()
            print(f"✅ OAuth providers initialized successfully")
            print(f"   - Google: {'✅' if status['providers'].get('google') else '❌'}")
            print(f"   - Apple: {'✅' if status['providers'].get('apple') else '❌'}")
            print(f"   - Redirect URI: {status['redirect_uri']}")
            
            # Test endpoints
            print("\n🌐 Testing OAuth Endpoints...")
            from fastapi.testclient import TestClient
            from main import app
            
            client = TestClient(app)
            
            # Test Google OAuth (should work now)
            response = client.post('/api/v1/auth/oauth/google', json={})
            if response.status_code == 200:
                print("✅ Google OAuth endpoint: Working (redirects to Google)")
            else:
                print(f"⚠️  Google OAuth endpoint: {response.status_code} - {response.json().get('detail', 'Unknown error')}")
            
            # Test Apple OAuth (should work now)
            response = client.post('/api/v1/auth/oauth/apple', json={})
            if response.status_code == 200:
                print("✅ Apple OAuth endpoint: Working (redirects to Apple)")
            else:
                print(f"⚠️  Apple OAuth endpoint: {response.status_code} - {response.json().get('detail', 'Unknown error')}")
            
            print("\n🚀 OAuth is ready for testing!")
            print("\nNext steps:")
            print("1. Start your backend: uvicorn main:app --reload")
            print("2. Start your frontend: npm run dev")
            print("3. Test OAuth login in your browser")
            
        except Exception as e:
            print(f"\n❌ OAuth configuration test failed: {e}")
            return False
            
    else:
        print("\n⚠️  OAuth credentials need to be configured")
        print("\nTo configure OAuth:")
        print("1. Follow the setup guide for Google Cloud Console and Apple Developers")
        print("2. Copy your credentials to the .env file")
        print("3. Run this test again")
        
        # Show example configuration
        print("\n📝 Example .env configuration:")
        print("GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com")
        print("GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here")
        print("APPLE_CLIENT_ID=1234567890123456")
        print("APPLE_CLIENT_SECRET=your-apple-secret-here")
        print("OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback")
        
        return False
    
    return True

if __name__ == "__main__":
    success = test_oauth_credentials()
    sys.exit(0 if success else 1)