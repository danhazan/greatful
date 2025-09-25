#!/usr/bin/env python3
"""
Railway Deployment Helper Script

This script helps prepare and validate the Grateful API for Railway deployment.
It performs pre-deployment checks, generates secure configurations, and provides
deployment guidance.

Usage:
    python scripts/railway_deploy.py --check
    python scripts/railway_deploy.py --generate-config
    python scripts/railway_deploy.py --validate

"""

import os
import sys
import json
import secrets
import argparse
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from urllib.parse import urlparse

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class RailwayDeploymentHelper:
    """Helper class for Railway deployment preparation and validation."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.required_files = [
            'main.py',
            'requirements.txt',
            'railway.toml',
            'alembic.ini'
        ]
        self.required_env_vars = [
            'DATABASE_URL',
            'SECRET_KEY',
            'ALLOWED_ORIGINS',
            'ENVIRONMENT'
        ]
        
    def check_prerequisites(self) -> Tuple[bool, List[str]]:
        """Check if all prerequisites for Railway deployment are met."""
        issues = []
        
        # Check required files
        for file_name in self.required_files:
            file_path = self.project_root / file_name
            if not file_path.exists():
                issues.append(f"Missing required file: {file_name}")
        
        # Check railway.toml configuration
        railway_config = self.project_root / 'railway.toml'
        if railway_config.exists():
            content = railway_config.read_text()
            if '$PORT' not in content:
                issues.append("railway.toml missing $PORT variable in start command")
            if '/health' not in content:
                issues.append("railway.toml missing health check path")
        
        # Check requirements.txt
        requirements_file = self.project_root / 'requirements.txt'
        if requirements_file.exists():
            content = requirements_file.read_text()
            required_packages = ['fastapi', 'uvicorn', 'sqlalchemy', 'alembic', 'asyncpg']
            for package in required_packages:
                if package not in content.lower():
                    issues.append(f"Missing required package in requirements.txt: {package}")
        
        # Check if alembic is configured
        alembic_dir = self.project_root / 'alembic'
        if not alembic_dir.exists():
            issues.append("Alembic migrations directory not found")
        
        return len(issues) == 0, issues
    
    def generate_secure_config(self) -> Dict[str, str]:
        """Generate secure configuration values for Railway deployment."""
        config = {
            'SECRET_KEY': secrets.token_urlsafe(64),
            'ENVIRONMENT': 'production',
            'DATABASE_URL': '${Postgres.DATABASE_URL}',
            'REDIS_URL': '${Redis.REDIS_URL}',
            'ALLOWED_ORIGINS': 'https://your-frontend.vercel.app',
            'SSL_REDIRECT': 'true',
            'SECURE_COOKIES': 'true',
            'HSTS_MAX_AGE': '63072000',
            'HSTS_PRELOAD': 'true',
            'HSTS_INCLUDE_SUBDOMAINS': 'true',
            'ENABLE_DOCS': 'false',
            'LOG_LEVEL': 'INFO',
            'DEFAULT_RATE_LIMIT': '100',
            'AUTH_RATE_LIMIT': '10',
            'UPLOAD_RATE_LIMIT': '20',
            'MAX_REQUEST_SIZE': '10485760',
            'MAX_UPLOAD_SIZE': '10485760',
            'UPLOAD_PATH': '/app/uploads',
            'ACCESS_TOKEN_EXPIRE_MINUTES': '60',
            'REFRESH_TOKEN_EXPIRE_DAYS': '7'
        }
        return config
    
    def validate_environment_config(self, env_file: Optional[str] = None) -> Tuple[bool, List[str]]:
        """Validate environment configuration for Railway deployment."""
        issues = []
        
        # Load environment variables
        env_vars = {}
        if env_file and os.path.exists(env_file):
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        # Remove inline comments
                        value = value.split('#')[0].strip()
                        env_vars[key.strip()] = value
        else:
            env_vars = dict(os.environ)
        
        # Check required environment variables
        for var in self.required_env_vars:
            if var not in env_vars or not env_vars[var]:
                issues.append(f"Missing or empty required environment variable: {var}")
        
        # Validate specific configurations
        if 'SECRET_KEY' in env_vars:
            secret_key = env_vars['SECRET_KEY']
            if len(secret_key) < 32:
                issues.append("SECRET_KEY should be at least 32 characters long")
            if secret_key == 'CHANGE-THIS-TO-A-SECURE-64-CHARACTER-SECRET-KEY-GENERATED-WITH-SECRETS-MODULE':
                issues.append("SECRET_KEY is still using default placeholder value")
        
        if 'DATABASE_URL' in env_vars:
            db_url = env_vars['DATABASE_URL']
            if not db_url.startswith(('postgresql://', 'postgresql+asyncpg://', '${')):
                issues.append("DATABASE_URL should use PostgreSQL with asyncpg driver or Railway variable reference")
        
        if 'ALLOWED_ORIGINS' in env_vars:
            origins = env_vars['ALLOWED_ORIGINS']
            if 'localhost' in origins and env_vars.get('ENVIRONMENT') == 'production':
                issues.append("ALLOWED_ORIGINS contains localhost in production environment")
        
        # Check SSL configuration
        if env_vars.get('ENVIRONMENT') == 'production':
            ssl_vars = ['SSL_REDIRECT', 'SECURE_COOKIES']
            for var in ssl_vars:
                if var not in env_vars or env_vars[var].lower() not in ['true', '1']:
                    issues.append(f"SSL configuration variable {var} should be enabled in production")
            
            # Check HSTS_MAX_AGE separately (should be a number, not true/false)
            if 'HSTS_MAX_AGE' not in env_vars or not env_vars['HSTS_MAX_AGE'].isdigit():
                issues.append("HSTS_MAX_AGE should be set to a numeric value in production")
        
        return len(issues) == 0, issues
    
    def check_health_endpoints(self) -> Tuple[bool, List[str]]:
        """Check if health endpoints are properly configured."""
        issues = []
        
        # Check if health endpoints exist in the codebase
        health_files = [
            self.project_root / 'app' / 'api' / 'v1' / 'health.py',
            self.project_root / 'main.py'
        ]
        
        health_endpoint_found = False
        for file_path in health_files:
            if file_path.exists():
                content = file_path.read_text()
                if '/health' in content and 'def health' in content:
                    health_endpoint_found = True
                    break
        
        if not health_endpoint_found:
            issues.append("Health endpoint (/health) not found in application")
        
        return len(issues) == 0, issues
    
    def generate_railway_env_file(self, output_file: str = '.env.railway') -> bool:
        """Generate Railway-specific environment file."""
        try:
            config = self.generate_secure_config()
            
            env_content = "# Railway Production Environment Configuration\n"
            env_content += "# Generated by railway_deploy.py script\n\n"
            
            for key, value in config.items():
                env_content += f"{key}={value}\n"
            
            output_path = self.project_root / output_file
            output_path.write_text(env_content)
            
            print(f"✅ Generated Railway environment file: {output_file}")
            print("⚠️  IMPORTANT: Update the following values before deployment:")
            print("   - SECRET_KEY: Use the generated secure key")
            print("   - ALLOWED_ORIGINS: Add your actual frontend domain(s)")
            print("   - DATABASE_URL: Use Railway's PostgreSQL service variable")
            
            return True
        except Exception as e:
            print(f"❌ Error generating environment file: {e}")
            return False
    
    def run_deployment_checks(self) -> bool:
        """Run comprehensive deployment checks."""
        print("🚀 Running Railway Deployment Checks...\\n")
        
        all_passed = True
        
        # Check prerequisites
        print("1. Checking Prerequisites...")
        prereq_ok, prereq_issues = self.check_prerequisites()
        if prereq_ok:
            print("   ✅ All prerequisites met")
        else:
            print("   ❌ Prerequisites issues found:")
            for issue in prereq_issues:
                print(f"      - {issue}")
            all_passed = False
        
        # Check health endpoints
        print("\\n2. Checking Health Endpoints...")
        health_ok, health_issues = self.check_health_endpoints()
        if health_ok:
            print("   ✅ Health endpoints configured")
        else:
            print("   ❌ Health endpoint issues found:")
            for issue in health_issues:
                print(f"      - {issue}")
            all_passed = False
        
        # Check environment configuration
        print("\\n3. Checking Environment Configuration...")
        env_files = ['.env.railway', '.env.production']
        env_checked = False
        
        for env_file in env_files:
            env_path = self.project_root / env_file
            if env_path.exists():
                env_ok, env_issues = self.validate_environment_config(str(env_path))
                if env_ok:
                    print(f"   ✅ Environment configuration valid ({env_file})")
                else:
                    print(f"   ❌ Environment issues found in {env_file}:")
                    for issue in env_issues:
                        print(f"      - {issue}")
                    all_passed = False
                env_checked = True
                break
        
        if not env_checked:
            print("   ⚠️  No environment configuration file found")
            print("      Run with --generate-config to create one")
        
        # Summary
        print("\\n" + "="*50)
        if all_passed:
            print("🎉 All checks passed! Ready for Railway deployment.")
            print("\\nNext steps:")
            print("1. Create Railway project and connect GitHub repository")
            print("2. Add PostgreSQL database service")
            print("3. Configure environment variables in Railway dashboard")
            print("4. Deploy and verify health endpoints")
        else:
            print("❌ Some checks failed. Please fix the issues before deployment.")
        
        return all_passed
    
    def print_deployment_guide(self):
        """Print Railway deployment guide."""
        guide = """
🚀 Railway Deployment Guide

1. Prerequisites:
   - Railway account (https://railway.app)
   - GitHub repository with your code
   - Domain name (optional)

2. Create Railway Project:
   - Go to Railway dashboard
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Set root directory to "apps/api"

3. Add Database Services:
   - Click "New Service" → "Database" → "PostgreSQL"
   - Optionally add Redis for caching

4. Configure Environment Variables:
   - Copy variables from .env.railway.example
   - Update SECRET_KEY with generated secure key
   - Update ALLOWED_ORIGINS with your frontend domain
   - Use Railway variable references: ${Postgres.DATABASE_URL}

5. Deploy:
   - Railway automatically deploys on git push
   - Monitor deployment in Railway dashboard
   - Verify health endpoint: https://your-app.railway.app/health

6. Optional - Custom Domain:
   - Add custom domain in Railway service settings
   - Update DNS CNAME record
   - Update ALLOWED_ORIGINS with custom domain

For detailed instructions, see: docs/PRODUCTION_DEPLOYMENT.md
        """
        print(guide)

def main():
    parser = argparse.ArgumentParser(description='Railway Deployment Helper')
    parser.add_argument('--check', action='store_true', help='Run deployment checks')
    parser.add_argument('--generate-config', action='store_true', help='Generate Railway environment config')
    parser.add_argument('--validate', metavar='ENV_FILE', help='Validate environment configuration file')
    parser.add_argument('--guide', action='store_true', help='Show deployment guide')
    
    args = parser.parse_args()
    
    helper = RailwayDeploymentHelper()
    
    if args.check:
        success = helper.run_deployment_checks()
        sys.exit(0 if success else 1)
    
    elif args.generate_config:
        success = helper.generate_railway_env_file()
        sys.exit(0 if success else 1)
    
    elif args.validate:
        env_ok, issues = helper.validate_environment_config(args.validate)
        if env_ok:
            print(f"✅ Environment configuration is valid: {args.validate}")
        else:
            print(f"❌ Environment configuration issues found in {args.validate}:")
            for issue in issues:
                print(f"   - {issue}")
        sys.exit(0 if env_ok else 1)
    
    elif args.guide:
        helper.print_deployment_guide()
    
    else:
        parser.print_help()
        print("\\nExamples:")
        print("  python scripts/railway_deploy.py --check")
        print("  python scripts/railway_deploy.py --generate-config")
        print("  python scripts/railway_deploy.py --validate .env.railway")
        print("  python scripts/railway_deploy.py --guide")

if __name__ == '__main__':
    main()