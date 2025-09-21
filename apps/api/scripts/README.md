# Backend Scripts

This folder contains **backend-specific scripts** for database operations, security validation, and API maintenance.

## Scripts Overview

### Database & User Management
- **`print_user_profile.py`** - Print user profile information from database

### Security & Production
- **`ssl_certificate_monitor.py`** - SSL certificate monitoring and validation
- **`validate_production_security.py`** - Comprehensive production security validation
- **`production_security_validation.py`** - Production security configuration validation
- **`rotate_secrets.py`** - Production secret rotation and management

## Usage

All scripts in this folder should be run from the **backend directory** with the virtual environment activated:

```bash
# Navigate to backend
cd apps/api

# Activate virtual environment
source venv/bin/activate

# Run scripts
python scripts/print_user_profile.py --email user@example.com
python scripts/ssl_certificate_monitor.py --check-configured
python scripts/validate_production_security.py
python scripts/production_security_validation.py
python scripts/rotate_secrets.py validate
```

## Script Categories

### ✅ Belongs in `/apps/api/scripts`:
- Database operations and queries
- User management utilities
- Security validation and monitoring
- SSL/TLS certificate management
- Production deployment validation
- Backend-specific maintenance tasks
- API-specific utilities

### ❌ Does NOT belong here:
- Cross-project utilities (use `/scripts` instead)
- Frontend-specific scripts (use `/apps/web/scripts` instead)
- General development tools that don't require backend context

## Environment Requirements

Most scripts require:
- **Virtual Environment**: `source venv/bin/activate`
- **Database Access**: Proper DATABASE_URL configuration
- **Environment Variables**: Production scripts may require specific env vars
- **Working Directory**: Must be run from `apps/api/` directory

## Security Scripts

The security-related scripts have specific requirements:

- **Production Environment**: Some validations only run with `ENVIRONMENT=production`
- **Secret Keys**: Production validation requires proper SECRET_KEY (64+ chars)
- **SSL Configuration**: Certificate monitoring requires HTTPS origins
- **Permissions**: Secret rotation may require elevated permissions