#!/usr/bin/env python3
"""
Railway Volume Persistence Fix Script

This script diagnoses and fixes Railway volume persistence issues for file uploads.
It addresses the common problem where uploads disappear after redeploy.

Usage:
    python scripts/fix_railway_volume_persistence.py --diagnose
    python scripts/fix_railway_volume_persistence.py --fix
    python scripts/fix_railway_volume_persistence.py --test-persistence
    python scripts/fix_railway_volume_persistence.py --migrate-to-s3

"""

import os
import sys
import json
import argparse
import subprocess
import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class RailwayVolumeFixer:
    """Helper class for fixing Railway volume persistence issues."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.expected_volume_path = "/app/uploads"
        self.volume_name = "grateful-volume"
        
    def diagnose_volume_issues(self) -> Dict[str, any]:
        """Diagnose current volume configuration and identify issues."""
        print("🔍 Diagnosing Railway Volume Configuration...\n")
        
        diagnosis = {
            "issues": [],
            "warnings": [],
            "config_status": {},
            "recommendations": []
        }
        
        # Check railway.toml configuration
        railway_toml = self.project_root / "railway.toml"
        if railway_toml.exists():
            content = railway_toml.read_text()
            if "volumes" in content and "/app/uploads" in content:
                diagnosis["config_status"]["railway_toml"] = "✅ Volume configured in railway.toml"
            else:
                diagnosis["issues"].append("❌ Volume not properly configured in railway.toml")
                diagnosis["recommendations"].append("Add volume configuration to railway.toml")
        else:
            diagnosis["issues"].append("❌ railway.toml not found")
        
        # Check environment configurations
        env_files = [".env", "config/.env.railway", "config/.env.production"]
        upload_path_configured = False
        
        for env_file in env_files:
            env_path = self.project_root / env_file
            if env_path.exists():
                content = env_path.read_text()
                if "UPLOAD_PATH" in content:
                    if "/app/uploads" in content:
                        diagnosis["config_status"][env_file] = "✅ UPLOAD_PATH correctly set to /app/uploads"
                        upload_path_configured = True
                    else:
                        diagnosis["issues"].append(f"❌ UPLOAD_PATH in {env_file} not set to /app/uploads")
                else:
                    diagnosis["warnings"].append(f"⚠️ UPLOAD_PATH not defined in {env_file}")
        
        if not upload_path_configured:
            diagnosis["issues"].append("❌ UPLOAD_PATH not configured for Railway volume")
            diagnosis["recommendations"].append("Set UPLOAD_PATH=/app/uploads in environment config")
        
        # Check FileUploadService configuration
        file_service_path = self.project_root / "app" / "services" / "file_upload_service.py"
        if file_service_path.exists():
            content = file_service_path.read_text()
            if "os.path.isabs" in content and "os.path.abspath" in content:
                diagnosis["config_status"]["file_service"] = "✅ FileUploadService handles absolute paths"
            else:
                diagnosis["issues"].append("❌ FileUploadService doesn't handle absolute paths properly")
                diagnosis["recommendations"].append("Update FileUploadService to handle absolute paths")
        
        # Check main.py startup configuration
        main_py = self.project_root / "main.py"
        if main_py.exists():
            content = main_py.read_text()
            if "os.path.isabs" in content and "uploads_path" in content:
                diagnosis["config_status"]["main_py"] = "✅ main.py handles upload path correctly"
            else:
                diagnosis["issues"].append("❌ main.py doesn't handle upload path properly")
                diagnosis["recommendations"].append("Update main.py startup code for proper path handling")
        
        # Check for code that might clear uploads directory
        python_files = list(self.project_root.rglob("*.py"))
        problematic_patterns = ["rmtree", "shutil.rmtree", "os.remove.*upload", "mkdir.*upload"]
        
        for py_file in python_files:
            try:
                content = py_file.read_text()
                for pattern in problematic_patterns:
                    if pattern.replace(".*", "") in content.lower():
                        diagnosis["warnings"].append(f"⚠️ Potential upload directory manipulation in {py_file.name}")
            except:
                continue
        
        return diagnosis
    
    def fix_configuration_issues(self) -> bool:
        """Fix identified configuration issues."""
        print("🔧 Fixing Railway Volume Configuration Issues...\n")
        
        success = True
        
        # Fix railway.toml
        railway_toml = self.project_root / "railway.toml"
        if railway_toml.exists():
            content = railway_toml.read_text()
            if "volumes" not in content or "/app/uploads" not in content:
                print("📝 Updating railway.toml...")
                
                # Add volume configuration if missing
                if "[[deploy.volumes]]" not in content:
                    volume_config = '''
[[deploy.volumes]]
mountPath = "/app/uploads"
name = "grateful-volume"
'''
                    content += volume_config
                    railway_toml.write_text(content)
                    print("   ✅ Added volume configuration to railway.toml")
        
        # Fix environment configurations
        env_configs = {
            "config/.env.railway": "/app/uploads",
            "config/.env.production": "/app/uploads"
        }
        
        for env_file, upload_path in env_configs.items():
            env_path = self.project_root / env_file
            if env_path.exists():
                content = env_path.read_text()
                if "UPLOAD_PATH" not in content:
                    print(f"📝 Adding UPLOAD_PATH to {env_file}...")
                    content += f"\nUPLOAD_PATH={upload_path}\n"
                    env_path.write_text(content)
                    print(f"   ✅ Added UPLOAD_PATH to {env_file}")
                elif "/app/uploads" not in content:
                    print(f"📝 Updating UPLOAD_PATH in {env_file}...")
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        if line.startswith('UPLOAD_PATH='):
                            lines[i] = f'UPLOAD_PATH={upload_path}'
                            break
                    env_path.write_text('\n'.join(lines))
                    print(f"   ✅ Updated UPLOAD_PATH in {env_file}")
        
        # Fix FileUploadService
        file_service_path = self.project_root / "app" / "services" / "file_upload_service.py"
        if file_service_path.exists():
            content = file_service_path.read_text()
            if "os.path.isabs" not in content:
                print("📝 Updating FileUploadService...")
                
                # Add absolute path handling
                old_init = '''    def __init__(self, db: AsyncSession):
        super().__init__(db)
        # Use environment variable for upload path, default to relative path for development
        upload_path = os.getenv("UPLOAD_PATH", "uploads")
        self.base_upload_dir = Path(upload_path)
        self.base_upload_dir.mkdir(parents=True, exist_ok=True)'''
        
                new_init = '''    def __init__(self, db: AsyncSession):
        super().__init__(db)
        # Use environment variable for upload path, default to relative path for development
        upload_path = os.getenv("UPLOAD_PATH", "uploads")
        
        # Ensure we use absolute path for Railway volume mounting
        if not os.path.isabs(upload_path):
            upload_path = os.path.abspath(upload_path)
            
        self.base_upload_dir = Path(upload_path)
        self.base_upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Set proper permissions for Railway volume
        try:
            os.chmod(self.base_upload_dir, 0o755)
            logger.info(f"FileUploadService initialized with upload directory: {self.base_upload_dir}")
        except Exception as e:
            logger.warning(f"Could not set permissions on upload directory: {e}")'''
        
                if old_init in content:
                    content = content.replace(old_init, new_init)
                    file_service_path.write_text(content)
                    print("   ✅ Updated FileUploadService for absolute path handling")
        
        # Fix main.py startup code
        main_py = self.project_root / "main.py"
        if main_py.exists():
            content = main_py.read_text()
            
            old_mount = '''# Mount static files for uploads
uploads_path = os.getenv("UPLOAD_PATH", "uploads")
uploads_dir = Path(uploads_path)
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")'''
            
            new_mount = '''# Mount static files for uploads with proper path handling
uploads_path = os.getenv("UPLOAD_PATH", "uploads")
# Ensure we use absolute path for Railway volume mounting
if not os.path.isabs(uploads_path):
    uploads_path = os.path.abspath(uploads_path)

uploads_dir = Path(uploads_path)
uploads_dir.mkdir(parents=True, exist_ok=True)

# Set proper permissions for Railway volume
try:
    os.chmod(uploads_path, 0o755)
    logger.info(f"Upload directory configured at: {uploads_path}")
except Exception as e:
    logger.warning(f"Could not set permissions on upload directory: {e}")

app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")'''
            
            if old_mount in content:
                content = content.replace(old_mount, new_mount)
                main_py.write_text(content)
                print("   ✅ Updated main.py startup code for proper path handling")
        
        return success
    
    def test_persistence(self) -> bool:
        """Test file persistence by creating sentinel files."""
        print("🧪 Testing File Persistence...\n")
        
        # This would need to be run in the Railway environment
        # For now, provide instructions
        
        test_instructions = """
To test persistence in Railway:

1. Deploy the fixed configuration to Railway
2. Create a test file via the debug endpoint:
   curl -X POST https://your-app.railway.app/_debug/create-sentinel

3. Check the file exists:
   curl https://your-app.railway.app/_debug/uploads-status

4. Redeploy the application (push a small change)

5. Check if the file still exists after redeploy:
   curl https://your-app.railway.app/_debug/uploads-status

If the sentinel file persists after redeploy, the volume is working correctly.
If it disappears, there may be Railway-specific volume attachment issues.
        """
        
        print(test_instructions)
        return True
    
    def generate_s3_migration_guide(self) -> str:
        """Generate guide for migrating to S3 if Railway volumes are unreliable."""
        
        guide = """
🚀 S3 Migration Guide (Recommended for Production)

If Railway volumes prove unreliable, migrate to AWS S3 or compatible service:

1. Create S3 Bucket:
   - AWS S3, DigitalOcean Spaces, or Cloudflare R2
   - Configure CORS for web uploads
   - Set up lifecycle policies for cleanup

2. Install Dependencies:
   pip install boto3

3. Environment Variables:
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_S3_BUCKET_NAME=your-bucket-name
   AWS_S3_REGION=us-east-1
   AWS_S3_ENDPOINT_URL=https://s3.amazonaws.com  # or your provider's endpoint

4. Update FileUploadService:
   - Add S3 upload methods
   - Use pre-signed URLs for direct uploads
   - Keep local volume as temporary processing space

5. Benefits:
   - Persistent across all deployments
   - CDN integration
   - Better scalability
   - Backup and versioning
   - Multi-region support

Example S3 upload code:
```python
import boto3
from botocore.exceptions import ClientError

class S3FileUploadService:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_S3_REGION', 'us-east-1')
        )
        self.bucket_name = os.getenv('AWS_S3_BUCKET_NAME')
    
    async def upload_file(self, file_obj, key: str) -> str:
        try:
            self.s3_client.upload_fileobj(file_obj, self.bucket_name, key)
            return f"https://{self.bucket_name}.s3.amazonaws.com/{key}"
        except ClientError as e:
            raise Exception(f"S3 upload failed: {e}")
```
        """
        
        return guide
    
    def run_comprehensive_fix(self) -> bool:
        """Run comprehensive diagnosis and fix."""
        print("🚀 Railway Volume Persistence Comprehensive Fix\n")
        print("=" * 60)
        
        # Diagnose issues
        diagnosis = self.diagnose_volume_issues()
        
        # Print diagnosis results
        if diagnosis["issues"]:
            print("\n❌ Issues Found:")
            for issue in diagnosis["issues"]:
                print(f"   {issue}")
        
        if diagnosis["warnings"]:
            print("\n⚠️ Warnings:")
            for warning in diagnosis["warnings"]:
                print(f"   {warning}")
        
        if diagnosis["config_status"]:
            print("\n✅ Configuration Status:")
            for status in diagnosis["config_status"].values():
                print(f"   {status}")
        
        # Apply fixes
        print("\n" + "=" * 60)
        success = self.fix_configuration_issues()
        
        # Print recommendations
        if diagnosis["recommendations"]:
            print("\n📋 Additional Recommendations:")
            for rec in diagnosis["recommendations"]:
                print(f"   • {rec}")
        
        # Print next steps
        print("\n" + "=" * 60)
        print("🎯 Next Steps:")
        print("1. Commit and push the configuration changes")
        print("2. In Railway Dashboard:")
        print("   - Go to your service → Volumes")
        print("   - Ensure 'grateful-volume' is attached")
        print("   - Mount path should be '/app/uploads'")
        print("   - Environment should match your deployment")
        print("3. Set UPLOAD_PATH=/app/uploads in Railway environment variables")
        print("4. Deploy and test with debug endpoints")
        print("5. If issues persist, consider migrating to S3")
        
        return success

def main():
    parser = argparse.ArgumentParser(description='Railway Volume Persistence Fixer')
    parser.add_argument('--diagnose', action='store_true', help='Diagnose volume issues')
    parser.add_argument('--fix', action='store_true', help='Fix configuration issues')
    parser.add_argument('--test-persistence', action='store_true', help='Test file persistence')
    parser.add_argument('--migrate-to-s3', action='store_true', help='Show S3 migration guide')
    parser.add_argument('--comprehensive', action='store_true', help='Run comprehensive diagnosis and fix')
    
    args = parser.parse_args()
    
    fixer = RailwayVolumeFixer()
    
    if args.diagnose:
        diagnosis = fixer.diagnose_volume_issues()
        print(json.dumps(diagnosis, indent=2))
    
    elif args.fix:
        success = fixer.fix_configuration_issues()
        sys.exit(0 if success else 1)
    
    elif args.test_persistence:
        fixer.test_persistence()
    
    elif args.migrate_to_s3:
        guide = fixer.generate_s3_migration_guide()
        print(guide)
    
    elif args.comprehensive:
        success = fixer.run_comprehensive_fix()
        sys.exit(0 if success else 1)
    
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python scripts/fix_railway_volume_persistence.py --comprehensive")
        print("  python scripts/fix_railway_volume_persistence.py --diagnose")
        print("  python scripts/fix_railway_volume_persistence.py --fix")
        print("  python scripts/fix_railway_volume_persistence.py --migrate-to-s3")

if __name__ == '__main__':
    main()