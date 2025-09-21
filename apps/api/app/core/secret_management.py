"""
Production Secret Management System

This module provides utilities for managing production secrets including:
- Secret key generation and validation
- Key rotation procedures
- Backup and recovery processes
- Security validation
"""

import os
import secrets
import string
import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class SecretManager:
    """Manages production secrets with rotation and backup capabilities."""
    
    def __init__(self, env_file_path: str = ".env.production"):
        self.env_file_path = Path(env_file_path)
        self.backup_dir = Path("secret_backups")
        self.backup_dir.mkdir(exist_ok=True)
    
    def generate_secret_key(self, length: int = 64) -> str:
        """
        Generate a cryptographically secure secret key.
        
        Args:
            length: Length of the secret key (minimum 64 characters)
            
        Returns:
            Cryptographically secure secret key
        """
        if length < 64:
            raise ValueError("Secret key must be at least 64 characters long")
        
        return secrets.token_urlsafe(length)
    
    def generate_health_check_token(self, length: int = 32) -> str:
        """Generate a secure health check token."""
        return secrets.token_urlsafe(length)
    
    def validate_secret_strength(self, secret: str) -> Dict[str, any]:
        """
        Validate the strength of a secret key.
        
        Args:
            secret: Secret key to validate
            
        Returns:
            Dictionary with validation results
        """
        validation = {
            "is_valid": True,
            "issues": [],
            "strength": "strong",
            "entropy_bits": 0
        }
        
        # Check minimum length
        if len(secret) < 64:
            validation["is_valid"] = False
            validation["issues"].append(f"Secret too short: {len(secret)} chars (minimum 64)")
            validation["strength"] = "weak"
        
        # Check for default/weak values
        weak_secrets = [
            "your-super-secret-key-change-this-in-production",
            "change-this-secret-key",
            "default-secret-key",
            "secret-key",
            "password",
            "123456"
        ]
        
        if secret.lower() in [s.lower() for s in weak_secrets]:
            validation["is_valid"] = False
            validation["issues"].append("Using default or weak secret key")
            validation["strength"] = "weak"
        
        # Calculate entropy (approximate)
        unique_chars = len(set(secret))
        validation["entropy_bits"] = unique_chars * 6.5  # Approximate for base64-like strings
        
        if validation["entropy_bits"] < 256:
            validation["strength"] = "medium" if validation["entropy_bits"] > 128 else "weak"
        
        # Check character diversity
        has_upper = any(c.isupper() for c in secret)
        has_lower = any(c.islower() for c in secret)
        has_digit = any(c.isdigit() for c in secret)
        has_special = any(c in "-_" for c in secret)
        
        char_types = sum([has_upper, has_lower, has_digit, has_special])
        if char_types < 3:
            validation["issues"].append("Low character diversity")
            if validation["strength"] == "strong":
                validation["strength"] = "medium"
        
        return validation
    
    def backup_current_secrets(self) -> str:
        """
        Create a backup of current secrets.
        
        Returns:
            Path to backup file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"secrets_backup_{timestamp}.json"
        backup_path = self.backup_dir / backup_filename
        
        # Read current environment file
        current_secrets = {}
        if self.env_file_path.exists():
            with open(self.env_file_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        # Only backup secret-related keys
                        if any(secret_key in key.upper() for secret_key in [
                            'SECRET', 'PASSWORD', 'TOKEN', 'KEY', 'WEBHOOK'
                        ]):
                            # Hash the value for security (don't store plain text)
                            current_secrets[key] = {
                                "hash": hashlib.sha256(value.encode()).hexdigest(),
                                "length": len(value),
                                "timestamp": timestamp
                            }
        
        # Save backup
        backup_data = {
            "timestamp": timestamp,
            "env_file": str(self.env_file_path),
            "secrets": current_secrets
        }
        
        with open(backup_path, 'w') as f:
            json.dump(backup_data, f, indent=2)
        
        logger.info(f"Secrets backup created: {backup_path}")
        return str(backup_path)
    
    def rotate_secret_key(self, backup: bool = True) -> Dict[str, str]:
        """
        Rotate the SECRET_KEY with backup.
        
        Args:
            backup: Whether to create a backup before rotation
            
        Returns:
            Dictionary with old and new secret keys (hashed for security)
        """
        if backup:
            backup_path = self.backup_current_secrets()
            logger.info(f"Created backup before rotation: {backup_path}")
        
        # Generate new secret key
        new_secret = self.generate_secret_key()
        
        # Read current environment file
        if not self.env_file_path.exists():
            raise FileNotFoundError(f"Environment file not found: {self.env_file_path}")
        
        with open(self.env_file_path, 'r') as f:
            lines = f.readlines()
        
        # Update SECRET_KEY line
        old_secret_hash = None
        updated = False
        
        for i, line in enumerate(lines):
            if line.strip().startswith('SECRET_KEY='):
                old_value = line.split('=', 1)[1].strip()
                old_secret_hash = hashlib.sha256(old_value.encode()).hexdigest()
                lines[i] = f"SECRET_KEY={new_secret}\n"
                updated = True
                break
        
        if not updated:
            # Add SECRET_KEY if not found
            lines.append(f"SECRET_KEY={new_secret}\n")
        
        # Write updated file
        with open(self.env_file_path, 'w') as f:
            f.writelines(lines)
        
        new_secret_hash = hashlib.sha256(new_secret.encode()).hexdigest()
        
        logger.info("SECRET_KEY rotated successfully")
        
        return {
            "old_secret_hash": old_secret_hash,
            "new_secret_hash": new_secret_hash,
            "rotation_timestamp": datetime.now().isoformat()
        }
    
    def rotate_health_check_token(self, backup: bool = True) -> Dict[str, str]:
        """Rotate the health check token."""
        if backup:
            self.backup_current_secrets()
        
        new_token = self.generate_health_check_token()
        
        # Update environment file
        if not self.env_file_path.exists():
            raise FileNotFoundError(f"Environment file not found: {self.env_file_path}")
        
        with open(self.env_file_path, 'r') as f:
            lines = f.readlines()
        
        updated = False
        for i, line in enumerate(lines):
            if line.strip().startswith('HEALTH_CHECK_TOKEN='):
                lines[i] = f"HEALTH_CHECK_TOKEN={new_token}\n"
                updated = True
                break
        
        if not updated:
            lines.append(f"HEALTH_CHECK_TOKEN={new_token}\n")
        
        with open(self.env_file_path, 'w') as f:
            f.writelines(lines)
        
        logger.info("HEALTH_CHECK_TOKEN rotated successfully")
        
        return {
            "new_token_hash": hashlib.sha256(new_token.encode()).hexdigest(),
            "rotation_timestamp": datetime.now().isoformat()
        }
    
    def validate_production_secrets(self) -> Dict[str, any]:
        """
        Validate all production secrets for security compliance.
        
        Returns:
            Comprehensive validation report
        """
        validation_report = {
            "overall_status": "valid",
            "issues": [],
            "warnings": [],
            "secrets_validated": 0,
            "validation_timestamp": datetime.now().isoformat()
        }
        
        if not self.env_file_path.exists():
            validation_report["overall_status"] = "invalid"
            validation_report["issues"].append(f"Environment file not found: {self.env_file_path}")
            return validation_report
        
        # Read environment file
        env_vars = {}
        with open(self.env_file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
        
        # Validate SECRET_KEY
        if 'SECRET_KEY' in env_vars:
            secret_validation = self.validate_secret_strength(env_vars['SECRET_KEY'])
            validation_report["secrets_validated"] += 1
            
            if not secret_validation["is_valid"]:
                validation_report["overall_status"] = "invalid"
                validation_report["issues"].extend([
                    f"SECRET_KEY: {issue}" for issue in secret_validation["issues"]
                ])
            elif secret_validation["strength"] != "strong":
                validation_report["warnings"].append(
                    f"SECRET_KEY strength is {secret_validation['strength']}"
                )
        else:
            validation_report["overall_status"] = "invalid"
            validation_report["issues"].append("SECRET_KEY not found in environment file")
        
        # Validate database password
        if 'DATABASE_URL' in env_vars:
            db_url = env_vars['DATABASE_URL']
            if 'CHANGE_THIS_PASSWORD' in db_url:
                validation_report["overall_status"] = "invalid"
                validation_report["issues"].append("Database password not changed from default")
            validation_report["secrets_validated"] += 1
        
        # Validate HTTPS origins
        if 'ALLOWED_ORIGINS' in env_vars:
            origins = env_vars['ALLOWED_ORIGINS']
            if 'http://' in origins and 'localhost' not in origins:
                validation_report["overall_status"] = "invalid"
                validation_report["issues"].append("HTTP origins not allowed in production")
            validation_report["secrets_validated"] += 1
        
        # Check for other default values
        default_checks = {
            'SMTP_PASSWORD': ['CHANGE_THIS_SMTP_PASSWORD'],
            'SECURITY_ALERT_EMAIL': ['security@yourdomain.com'],
            'FRONTEND_BASE_URL': ['https://yourdomain.com']
        }
        
        for key, default_values in default_checks.items():
            if key in env_vars and env_vars[key] in default_values:
                validation_report["warnings"].append(f"{key} appears to use default value")
        
        return validation_report
    
    def emergency_key_rotation(self) -> Dict[str, any]:
        """
        Emergency key rotation procedure for security incidents.
        
        Returns:
            Emergency rotation report
        """
        logger.warning("EMERGENCY KEY ROTATION INITIATED")
        
        # Create emergency backup
        backup_path = self.backup_current_secrets()
        
        # Rotate all critical secrets
        results = {
            "emergency_rotation_timestamp": datetime.now().isoformat(),
            "backup_path": backup_path,
            "rotated_secrets": []
        }
        
        try:
            # Rotate SECRET_KEY
            secret_result = self.rotate_secret_key(backup=False)  # Already backed up
            results["rotated_secrets"].append({
                "secret_type": "SECRET_KEY",
                "status": "rotated",
                "new_hash": secret_result["new_secret_hash"]
            })
            
            # Rotate health check token
            token_result = self.rotate_health_check_token(backup=False)
            results["rotated_secrets"].append({
                "secret_type": "HEALTH_CHECK_TOKEN", 
                "status": "rotated",
                "new_hash": token_result["new_token_hash"]
            })
            
            results["status"] = "success"
            logger.warning("EMERGENCY KEY ROTATION COMPLETED SUCCESSFULLY")
            
        except Exception as e:
            results["status"] = "failed"
            results["error"] = str(e)
            logger.error(f"EMERGENCY KEY ROTATION FAILED: {e}")
        
        return results
    
    def list_backups(self) -> List[Dict[str, any]]:
        """List all available secret backups."""
        backups = []
        
        for backup_file in self.backup_dir.glob("secrets_backup_*.json"):
            try:
                with open(backup_file, 'r') as f:
                    backup_data = json.load(f)
                
                backups.append({
                    "filename": backup_file.name,
                    "path": str(backup_file),
                    "timestamp": backup_data.get("timestamp"),
                    "secrets_count": len(backup_data.get("secrets", {})),
                    "file_size": backup_file.stat().st_size
                })
            except Exception as e:
                logger.warning(f"Could not read backup file {backup_file}: {e}")
        
        return sorted(backups, key=lambda x: x["timestamp"], reverse=True)
    
    def cleanup_old_backups(self, retention_days: int = 30) -> Dict[str, any]:
        """Clean up old backup files."""
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        
        cleaned_files = []
        total_size_freed = 0
        
        for backup_file in self.backup_dir.glob("secrets_backup_*.json"):
            file_time = datetime.fromtimestamp(backup_file.stat().st_mtime)
            
            if file_time < cutoff_date:
                file_size = backup_file.stat().st_size
                backup_file.unlink()
                
                cleaned_files.append({
                    "filename": backup_file.name,
                    "size": file_size,
                    "age_days": (datetime.now() - file_time).days
                })
                total_size_freed += file_size
        
        return {
            "cleaned_files": len(cleaned_files),
            "total_size_freed": total_size_freed,
            "files": cleaned_files
        }


def generate_production_secrets() -> Dict[str, str]:
    """Generate all required production secrets."""
    return {
        "SECRET_KEY": secrets.token_urlsafe(64),
        "HEALTH_CHECK_TOKEN": secrets.token_urlsafe(32),
        "DATABASE_PASSWORD": secrets.token_urlsafe(32),
        "SMTP_PASSWORD": secrets.token_urlsafe(24)
    }


def validate_environment_security() -> bool:
    """
    Validate production environment security.
    
    Returns:
        True if environment is secure, False otherwise
    """
    secret_manager = SecretManager()
    validation = secret_manager.validate_production_secrets()
    
    if validation["overall_status"] != "valid":
        logger.error("Production environment security validation failed:")
        for issue in validation["issues"]:
            logger.error(f"  - {issue}")
        return False
    
    if validation["warnings"]:
        logger.warning("Production environment security warnings:")
        for warning in validation["warnings"]:
            logger.warning(f"  - {warning}")
    
    logger.info(f"Production environment security validated successfully "
                f"({validation['secrets_validated']} secrets checked)")
    return True


if __name__ == "__main__":
    # CLI interface for secret management
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python secret_management.py <command>")
        print("Commands:")
        print("  generate - Generate new production secrets")
        print("  validate - Validate current secrets")
        print("  rotate - Rotate SECRET_KEY")
        print("  emergency - Emergency key rotation")
        print("  backup - Create secrets backup")
        print("  list-backups - List all backups")
        print("  cleanup - Clean up old backups")
        sys.exit(1)
    
    command = sys.argv[1]
    secret_manager = SecretManager()
    
    if command == "generate":
        secrets_dict = generate_production_secrets()
        print("Generated production secrets:")
        for key, value in secrets_dict.items():
            print(f"{key}={value}")
    
    elif command == "validate":
        validation = secret_manager.validate_production_secrets()
        print(f"Validation status: {validation['overall_status']}")
        if validation["issues"]:
            print("Issues:")
            for issue in validation["issues"]:
                print(f"  - {issue}")
        if validation["warnings"]:
            print("Warnings:")
            for warning in validation["warnings"]:
                print(f"  - {warning}")
    
    elif command == "rotate":
        result = secret_manager.rotate_secret_key()
        print(f"SECRET_KEY rotated at {result['rotation_timestamp']}")
    
    elif command == "emergency":
        result = secret_manager.emergency_key_rotation()
        print(f"Emergency rotation status: {result['status']}")
        if result["status"] == "success":
            print(f"Backup created: {result['backup_path']}")
            print(f"Rotated {len(result['rotated_secrets'])} secrets")
    
    elif command == "backup":
        backup_path = secret_manager.backup_current_secrets()
        print(f"Backup created: {backup_path}")
    
    elif command == "list-backups":
        backups = secret_manager.list_backups()
        print(f"Found {len(backups)} backup files:")
        for backup in backups:
            print(f"  {backup['filename']} - {backup['timestamp']} "
                  f"({backup['secrets_count']} secrets)")
    
    elif command == "cleanup":
        result = secret_manager.cleanup_old_backups()
        print(f"Cleaned up {result['cleaned_files']} old backup files")
        print(f"Freed {result['total_size_freed']} bytes")
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)