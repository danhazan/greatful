#!/usr/bin/env python3
"""
Production Secret Rotation Script

This script provides safe secret rotation procedures for production environments.
It includes backup, validation, and rollback capabilities.

Usage:
    python scripts/rotate_secrets.py --help
    python scripts/rotate_secrets.py rotate --secret-key
    python scripts/rotate_secrets.py emergency-rotation
    python scripts/rotate_secrets.py validate
"""

import argparse
import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.secret_management import SecretManager, validate_environment_security
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def rotate_secret_key(env_file: str, backup: bool = True):
    """Rotate the SECRET_KEY with backup and validation."""
    logger.info("Starting SECRET_KEY rotation...")
    
    secret_manager = SecretManager(env_file)
    
    try:
        # Validate current environment
        logger.info("Validating current environment...")
        current_validation = secret_manager.validate_production_secrets()
        
        if current_validation["overall_status"] == "invalid":
            logger.error("Current environment has critical issues:")
            for issue in current_validation["issues"]:
                logger.error(f"  - {issue}")
            
            response = input("Continue with rotation despite issues? (y/N): ")
            if response.lower() != 'y':
                logger.info("Rotation cancelled by user")
                return False
        
        # Perform rotation
        result = secret_manager.rotate_secret_key(backup=backup)
        
        # Validate new environment
        logger.info("Validating new environment...")
        new_validation = secret_manager.validate_production_secrets()
        
        if new_validation["overall_status"] == "valid":
            logger.info("✅ SECRET_KEY rotation completed successfully")
            logger.info(f"Rotation timestamp: {result['rotation_timestamp']}")
            return True
        else:
            logger.error("❌ New environment validation failed")
            for issue in new_validation["issues"]:
                logger.error(f"  - {issue}")
            return False
            
    except Exception as e:
        logger.error(f"❌ SECRET_KEY rotation failed: {e}")
        return False


def emergency_rotation(env_file: str):
    """Perform emergency rotation of all critical secrets."""
    logger.warning("🚨 INITIATING EMERGENCY SECRET ROTATION")
    
    secret_manager = SecretManager(env_file)
    
    try:
        result = secret_manager.emergency_key_rotation()
        
        if result["status"] == "success":
            logger.warning("✅ Emergency rotation completed successfully")
            logger.info(f"Backup created: {result['backup_path']}")
            logger.info(f"Rotated secrets: {len(result['rotated_secrets'])}")
            
            for secret in result["rotated_secrets"]:
                logger.info(f"  - {secret['secret_type']}: {secret['status']}")
            
            return True
        else:
            logger.error(f"❌ Emergency rotation failed: {result.get('error')}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Emergency rotation failed: {e}")
        return False


def validate_secrets(env_file: str):
    """Validate production secrets."""
    logger.info("Validating production secrets...")
    
    secret_manager = SecretManager(env_file)
    validation = secret_manager.validate_production_secrets()
    
    print(f"\n🔍 Secret Validation Report")
    print(f"{'='*50}")
    print(f"Overall Status: {validation['overall_status'].upper()}")
    print(f"Secrets Validated: {validation['secrets_validated']}")
    print(f"Validation Time: {validation['validation_timestamp']}")
    
    if validation["issues"]:
        print(f"\n❌ Critical Issues ({len(validation['issues'])}):")
        for issue in validation["issues"]:
            print(f"  - {issue}")
    
    if validation["warnings"]:
        print(f"\n⚠️  Warnings ({len(validation['warnings'])}):")
        for warning in validation["warnings"]:
            print(f"  - {warning}")
    
    if validation["overall_status"] == "valid" and not validation["warnings"]:
        print(f"\n✅ All secrets are secure and properly configured")
    
    return validation["overall_status"] == "valid"


def create_backup(env_file: str):
    """Create a backup of current secrets."""
    logger.info("Creating secrets backup...")
    
    secret_manager = SecretManager(env_file)
    
    try:
        backup_path = secret_manager.backup_current_secrets()
        logger.info(f"✅ Backup created successfully: {backup_path}")
        return True
    except Exception as e:
        logger.error(f"❌ Backup creation failed: {e}")
        return False


def list_backups(env_file: str):
    """List all available backups."""
    secret_manager = SecretManager(env_file)
    backups = secret_manager.list_backups()
    
    if not backups:
        print("No backup files found")
        return
    
    print(f"\n📁 Available Backups ({len(backups)}):")
    print(f"{'='*70}")
    
    for backup in backups:
        size_kb = backup["file_size"] / 1024
        print(f"📄 {backup['filename']}")
        print(f"   Timestamp: {backup['timestamp']}")
        print(f"   Secrets: {backup['secrets_count']}")
        print(f"   Size: {size_kb:.1f} KB")
        print()


def cleanup_backups(env_file: str, retention_days: int = 30):
    """Clean up old backup files."""
    logger.info(f"Cleaning up backups older than {retention_days} days...")
    
    secret_manager = SecretManager(env_file)
    
    try:
        result = secret_manager.cleanup_old_backups(retention_days)
        
        if result["cleaned_files"] > 0:
            size_mb = result["total_size_freed"] / (1024 * 1024)
            logger.info(f"✅ Cleaned up {result['cleaned_files']} files, "
                       f"freed {size_mb:.2f} MB")
        else:
            logger.info("✅ No old backup files to clean up")
        
        return True
    except Exception as e:
        logger.error(f"❌ Backup cleanup failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Production Secret Management and Rotation Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Validate current secrets
  python scripts/rotate_secrets.py validate
  
  # Rotate SECRET_KEY with backup
  python scripts/rotate_secrets.py rotate --secret-key
  
  # Emergency rotation (all secrets)
  python scripts/rotate_secrets.py emergency-rotation
  
  # Create backup
  python scripts/rotate_secrets.py backup
  
  # List backups
  python scripts/rotate_secrets.py list-backups
  
  # Clean up old backups
  python scripts/rotate_secrets.py cleanup --retention-days 30
        """
    )
    
    parser.add_argument(
        '--env-file',
        default='.env.production',
        help='Path to environment file (default: .env.production)'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate production secrets')
    
    # Rotate command
    rotate_parser = subparsers.add_parser('rotate', help='Rotate secrets')
    rotate_parser.add_argument('--secret-key', action='store_true', 
                              help='Rotate SECRET_KEY')
    rotate_parser.add_argument('--no-backup', action='store_true',
                              help='Skip backup creation')
    
    # Emergency rotation command
    emergency_parser = subparsers.add_parser('emergency-rotation', 
                                           help='Emergency rotation of all secrets')
    
    # Backup command
    backup_parser = subparsers.add_parser('backup', help='Create secrets backup')
    
    # List backups command
    list_parser = subparsers.add_parser('list-backups', help='List available backups')
    
    # Cleanup command
    cleanup_parser = subparsers.add_parser('cleanup', help='Clean up old backups')
    cleanup_parser.add_argument('--retention-days', type=int, default=30,
                               help='Retention period in days (default: 30)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Check if environment file exists
    env_file_path = Path(args.env_file)
    if not env_file_path.exists() and args.command != 'validate':
        logger.error(f"Environment file not found: {args.env_file}")
        sys.exit(1)
    
    success = False
    
    try:
        if args.command == 'validate':
            success = validate_secrets(args.env_file)
        
        elif args.command == 'rotate':
            if args.secret_key:
                success = rotate_secret_key(args.env_file, backup=not args.no_backup)
            else:
                logger.error("Please specify what to rotate (--secret-key)")
                sys.exit(1)
        
        elif args.command == 'emergency-rotation':
            # Confirm emergency rotation
            print("🚨 WARNING: This will rotate ALL critical secrets immediately!")
            print("This should only be used in security emergencies.")
            response = input("Are you sure you want to proceed? (type 'EMERGENCY' to confirm): ")
            
            if response == 'EMERGENCY':
                success = emergency_rotation(args.env_file)
            else:
                logger.info("Emergency rotation cancelled")
                sys.exit(0)
        
        elif args.command == 'backup':
            success = create_backup(args.env_file)
        
        elif args.command == 'list-backups':
            list_backups(args.env_file)
            success = True
        
        elif args.command == 'cleanup':
            success = cleanup_backups(args.env_file, args.retention_days)
        
        else:
            logger.error(f"Unknown command: {args.command}")
            sys.exit(1)
    
    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
    
    if success:
        logger.info("✅ Operation completed successfully")
        sys.exit(0)
    else:
        logger.error("❌ Operation failed")
        sys.exit(1)


if __name__ == "__main__":
    main()