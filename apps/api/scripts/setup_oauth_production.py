#!/usr/bin/env python3
"""
OAuth Production Setup Script

This script helps set up OAuth configuration for production deployment on Railway.
It generates secure secrets and provides the exact commands to set environment variables.

Usage:
    python scripts/setup_oauth_production.py
"""

import secrets
import string
import os
from typing import Dict, List

def generate_secure_secret(length: int = 32) -> str:
    """Generate a cryptographically secure secret."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_jwt_secret(length: int = 64) -> str:
    """Generate a secure JWT secret."""
    return secrets.token_urlsafe(length)

def get_production_env_vars() -> Dict[str, str]:
    """Get all required production environment variables."""
    return {
        # OAuth Configuration
        'GOOGLE_CLIENT_ID': '[YOUR_GOOGLE_CLIENT_ID]',
        'GOOGLE_CLIENT_SECRET': '[YOUR_GOOGLE_CLIENT_SECRET]',
        'OAUTH_REDIRECT_URI': 'https://grateful-net.vercel.app/auth/callback/google',
        
        # Session & Security
        'SESSION_SECRET': generate_secure_secret(32),
        'SECRET_KEY': generate_jwt_secret(64),
        
        # CORS & Frontend
        'ALLOWED_ORIGINS': 'https://grateful-net.vercel.app,https://www.grateful-net.vercel.app',
        'FRONTEND_BASE_URL': 'https://grateful-net.vercel.app',
        
        # Security Settings
        'ENVIRONMENT': 'production',
        'SECURE_COOKIES': 'true',
        'COOKIE_HTTPONLY': 'true',
        'COOKIE_SAMESITE': 'Lax',
        
        # Database
        'DATABASE_URL': '${DATABASE_URL}',  # Railway will provide this
        
        # Content Security Policy
        'CSP_DOMAINS': 'https://grateful-net.vercel.app https://www.grateful-net.vercel.app',
    }

def generate_railway_commands(env_vars: Dict[str, str]) -> List[str]:
    """Generate Railway CLI commands to set environment variables."""
    commands = []
    
    for key, value in env_vars.items():
        if value.startswith('${') and value.endswith('}'):
            # Skip variables that Railway provides automatically
            continue
        
        # Escape special characters for shell
        escaped_value = value.replace('"', '\\"').replace('$', '\\$')
        commands.append(f'railway variables set {key}="{escaped_value}"')
    
    return commands

def generate_vercel_env_vars() -> Dict[str, str]:
    """Get Vercel environment variables for frontend."""
    return {
        'NODE_ENV': 'production',
        'NEXT_PUBLIC_APP_URL': 'https://grateful-net.vercel.app',
        'NEXT_PUBLIC_API_URL': 'https://grateful-production.up.railway.app',
        'NEXT_TELEMETRY_DISABLED': '1',
    }

def main():
    """Main setup function."""
    print("🚀 OAuth Production Setup for Railway & Vercel")
    print("=" * 50)
    
    # Generate environment variables
    env_vars = get_production_env_vars()
    railway_commands = generate_railway_commands(env_vars)
    vercel_env_vars = generate_vercel_env_vars()
    
    print("\\n📋 STEP 1: Set Railway Environment Variables")
    print("-" * 40)
    print("Run these commands in your terminal (with Railway CLI installed):")
    print()
    
    for command in railway_commands:
        print(f"  {command}")
    
    print("\\n📋 STEP 2: Set Vercel Environment Variables")
    print("-" * 40)
    print("Set these in your Vercel dashboard (Production environment):")
    print()
    
    for key, value in vercel_env_vars.items():
        print(f"  {key}={value}")
    
    print("\\n📋 STEP 3: Update Google OAuth Console")
    print("-" * 40)
    print("Add these redirect URIs in Google Cloud Console:")
    print("  • https://grateful-net.vercel.app/auth/callback/google")
    print("  • https://www.grateful-net.vercel.app/auth/callback/google")
    print()
    print("Add these JavaScript origins:")
    print("  • https://grateful-net.vercel.app")
    print("  • https://www.grateful-net.vercel.app")
    
    print("\\n📋 STEP 4: Deploy & Test")
    print("-" * 40)
    print("1. Deploy backend to Railway (push to main branch)")
    print("2. Deploy frontend to Vercel (push to main branch)")
    print("3. Run OAuth test:")
    print("   python scripts/test_oauth_production.py \\\\")
    print("     --frontend-url https://grateful-net.vercel.app \\\\")
    print("     --backend-url https://grateful-production.up.railway.app")
    
    print("\\n🔐 SECURITY NOTES:")
    print("-" * 40)
    print("• Generated secure secrets - keep them safe!")
    print("• Use HTTPS-only in production")
    print("• Restrict CORS to your domains only")
    print("• Monitor OAuth logs for security events")
    
    print("\\n💾 BACKUP SECRETS:")
    print("-" * 40)
    print("Save these generated secrets securely:")
    print(f"SESSION_SECRET: {env_vars['SESSION_SECRET']}")
    print(f"SECRET_KEY: {env_vars['SECRET_KEY']}")
    
    print("\\n✅ Setup Complete!")
    print("Follow the steps above to configure OAuth for production.")

if __name__ == "__main__":
    main()