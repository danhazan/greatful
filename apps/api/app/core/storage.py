"""
Unified storage adapter - S3-compatible (works with Supabase, R2, AWS S3, etc.)
Stores relative paths in DB, generates URLs dynamically
"""
import os
import logging
from pathlib import Path
from typing import BinaryIO, Optional
import uuid

logger = logging.getLogger(__name__)


class StorageAdapter:
    """Unified storage adapter that works with any S3-compatible storage"""
    
    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.is_production = self.environment == "production"
        
        # Log environment detection for debugging
        logger.info(f"🔧 Storage initialization:")
        logger.info(f"   ENVIRONMENT variable: {self.environment}")
        logger.info(f"   is_production: {self.is_production}")
        
        if self.is_production:
            self._init_s3_storage()
        else:
            self._init_local_storage()
    
    def _init_s3_storage(self):
        """Initialize S3-compatible storage (Supabase, R2, AWS S3, etc.)"""
        try:
            import boto3
            from botocore.config import Config
            
            # Generic S3-compatible configuration
            s3_endpoint = os.getenv("S3_ENDPOINT_URL")
            s3_region = os.getenv("S3_REGION", "auto")
            s3_access_key = os.getenv("S3_ACCESS_KEY_ID")
            s3_secret_key = os.getenv("S3_SECRET_ACCESS_KEY")
            self.bucket_name = os.getenv("S3_BUCKET", "uploads")
            self.public_url_base = os.getenv("S3_PUBLIC_URL")  # Optional custom public URL
            
            # Debug logging
            logger.info(f"   S3_ENDPOINT_URL: {s3_endpoint}")
            logger.info(f"   S3_BUCKET: {self.bucket_name}")
            logger.info(f"   S3_PUBLIC_URL: {self.public_url_base}")
            logger.info(f"   S3_ACCESS_KEY_ID: {'✓ Set' if s3_access_key else '✗ Not set'}")
            logger.info(f"   S3_SECRET_ACCESS_KEY: {'✓ Set' if s3_secret_key else '✗ Not set'}")
            
            if not s3_endpoint or not s3_access_key or not s3_secret_key:
                raise ValueError(
                    "S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY "
                    "required for production storage"
                )
            
            # Create S3 client (works with any S3-compatible service)
            self.s3_client = boto3.client(
                's3',
                endpoint_url=s3_endpoint,
                region_name=s3_region,
                aws_access_key_id=s3_access_key,
                aws_secret_access_key=s3_secret_key,
                config=Config(signature_version='s3v4')
            )
            
            self.storage_backend = "s3"
            logger.info(f"✓ Using S3-compatible storage (bucket: {self.bucket_name}, endpoint: {s3_endpoint})")
            
        except ImportError:
            logger.error("boto3 package not installed! Run: pip install boto3")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize S3 storage: {e}")
            raise
    
    def _init_local_storage(self):
        """Initialize local filesystem storage for development"""
        self.upload_path = Path(os.getenv("UPLOAD_PATH", "uploads"))
        self.upload_path.mkdir(parents=True, exist_ok=True)
        self.storage_backend = "local"
        
        logger.info(f"✓ Using local storage (path: {self.upload_path})")
    
    def upload_file(
        self, 
        file_data: bytes, 
        folder: str, 
        filename: str,
        content_type: Optional[str] = None
    ) -> str:
        """
        Upload file to storage.
        
        Args:
            file_data: File contents as bytes
            folder: Folder name ('posts', 'profile_photos', etc.)
            filename: Name of the file
            content_type: MIME type (optional)
        
        Returns:
            CLEAN relative path WITHOUT /uploads/ prefix (e.g., 'profile_photos/file.jpg')
            This MUST be stored AS-IS in the database - DO NOT add /uploads/ prefix!
        """
        # Ensure folder doesn't have /uploads/ prefix
        folder = folder.lstrip('/').replace('uploads/', '', 1)
        
        # Construct clean relative path (no /uploads/ prefix)
        relative_path = f"{folder}/{filename}"
        
        if self.is_production:
            self._upload_to_s3(file_data, relative_path, content_type)
        else:
            self._upload_to_local(file_data, folder, filename)
        
        # CRITICAL: Always return clean relative path for DB storage
        # Services MUST save this exact value to the database
        logger.info(f"📦 Uploaded file, DB path: {relative_path}")
        return relative_path
    
    def _upload_to_s3(self, file_data: bytes, relative_path: str, content_type: Optional[str]) -> None:
        """Upload to S3-compatible storage"""
        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=relative_path,
                Body=file_data,
                **extra_args
            )
            
            logger.info(f"✓ Uploaded to S3: {relative_path}")
            
        except Exception as e:
            logger.error(f"Failed to upload to S3: {e}")
            raise
    
    def _upload_to_local(self, file_data: bytes, folder: str, filename: str) -> None:
        """Upload to local filesystem"""
        # Create folder if it doesn't exist
        folder_path = self.upload_path / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        
        # Write file
        file_path = folder_path / filename
        with open(file_path, "wb") as f:
            f.write(file_data)
        
        logger.info(f"✓ Uploaded locally: {folder}/{filename}")
    
    def delete_file(self, relative_path: str) -> bool:
        """
        Delete file from storage using relative path.
        
        Args:
            relative_path: Path like 'profile_photos/file.jpg' or '/uploads/profile_photos/file.jpg'
        
        Returns:
            True if deleted successfully
        """
        # Normalize path (remove /uploads/ prefix if present)
        clean_path = self.normalize_path(relative_path)
        
        if not clean_path:
            logger.warning("Empty path provided to delete_file")
            return False
        
        if self.is_production:
            return self._delete_from_s3(clean_path)
        else:
            # Split into folder and filename for local storage
            parts = clean_path.split('/', 1)
            if len(parts) == 2:
                folder, filename = parts
                return self._delete_from_local(folder, filename)
            logger.warning(f"Invalid path format for deletion: {clean_path}")
            return False
    
    def _delete_from_s3(self, relative_path: str) -> bool:
        """Delete from S3-compatible storage"""
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=relative_path)
            logger.info(f"✓ Deleted from S3: {relative_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete from S3: {e}")
            return False
    
    def _delete_from_local(self, folder: str, filename: str) -> bool:
        """Delete from local filesystem"""
        try:
            file_path = self.upload_path / folder / filename
            if file_path.exists():
                file_path.unlink()
                logger.info(f"✓ Deleted locally: {folder}/{filename}")
                return True
            logger.warning(f"File not found for deletion: {folder}/{filename}")
            return False
        except Exception as e:
            logger.error(f"Failed to delete locally: {e}")
            return False
    
    def normalize_path(self, path: str) -> str:
        """
        Convert any path format to clean relative path.
        
        Handles:
        - Legacy paths with /uploads/ prefix
        - Full URLs from S3/Supabase
        - Already clean paths
        
        Examples:
          /uploads/profile_photos/file.jpg -> profile_photos/file.jpg
          https://example.com/.../profile_photos/file.jpg -> profile_photos/file.jpg
          profile_photos/file.jpg -> profile_photos/file.jpg
        
        Args:
            path: Any path format from DB or user input
        
        Returns:
            Clean relative path without /uploads/ prefix
        """
        if not path:
            return path
        
        # Remove any URL scheme and domain (for full S3 URLs in DB)
        if path.startswith('http://') or path.startswith('https://'):
            try:
                from urllib.parse import urlparse
                parsed = urlparse(path)
                path = parsed.path
                # Remove bucket name if it's in the path
                # e.g., /grateful-uploads/profile_photos/file.jpg -> profile_photos/file.jpg
                if self.is_production and self.bucket_name and f"/{self.bucket_name}/" in path:
                    path = path.split(f"/{self.bucket_name}/", 1)[1]
                # Also handle Supabase path structure: /storage/v1/object/public/bucket/path
                if "/object/public/" in path:
                    parts = path.split("/object/public/")
                    if len(parts) > 1:
                        # Remove bucket name from the path
                        remaining = parts[1]
                        if "/" in remaining:
                            path = remaining.split("/", 1)[1]
            except Exception as e:
                logger.warning(f"Error parsing URL in path: {e}")
        
        # Remove leading /uploads/ if present (legacy local format)
        if path.startswith('/uploads/'):
            path = path[9:]  # Remove '/uploads/'
        elif path.startswith('uploads/'):
            path = path[8:]  # Remove 'uploads/'
        
        # Remove leading slash
        path = path.lstrip('/')
        
        return path
    
    def get_url(self, relative_path: str) -> str:
        """
        Convert relative path from DB to full URL for frontend.
        
        This is THE central place for URL generation. Call this when:
        - Serializing API responses
        - Returning data to frontend
        
        CRITICAL: This method expects clean relative paths from DB (no /uploads/ prefix)
        but will handle legacy paths gracefully.
        
        Examples:
          Production:  profile_photos/file.jpg -> https://supabase.co/.../grateful-uploads/profile_photos/file.jpg
          Development: profile_photos/file.jpg -> /uploads/profile_photos/file.jpg
          Legacy:      /uploads/profile_photos/file.jpg -> (normalized then converted)
        
        Args:
            relative_path: Path from database (should be 'profile_photos/file.jpg')
        
        Returns:
            Full URL for frontend to access the file
        """
        if not relative_path:
            return relative_path
        
        # Normalize the path first (handles legacy /uploads/ prefix and full URLs)
        clean_path = self.normalize_path(relative_path)
        
        if not clean_path:
            logger.warning(f"Empty path after normalization: {relative_path}")
            return relative_path
        
        if self.is_production:
            # Return full S3 URL
            if self.public_url_base:
                # Use custom public URL (e.g., Supabase public URL)
                # Ensure no double slashes and proper joining
                base_url = self.public_url_base.rstrip('/')
                url = f"{base_url}/{clean_path}"
                logger.debug(f"🔗 Generated S3 URL: {clean_path} -> {url}")
                return url
            else:
                # Fallback to endpoint URL
                s3_endpoint = os.getenv("S3_ENDPOINT_URL", "").rstrip('/')
                url = f"{s3_endpoint}/{self.bucket_name}/{clean_path}"
                logger.debug(f"🔗 Generated S3 URL (endpoint): {clean_path} -> {url}")
                return url
        else:
            # Return local URL with /uploads/ prefix
            url = f"/uploads/{clean_path}"
            logger.debug(f"🔗 Generated local URL: {clean_path} -> {url}")
            return url
    
    def generate_unique_filename(self, original_filename: str) -> str:
        """
        Generate a unique filename to prevent collisions.
        
        Args:
            original_filename: Original filename with extension
            
        Returns:
            Unique filename with preserved extension
        """
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
        unique_name = f"{uuid.uuid4()}"
        return f"{unique_name}.{ext}" if ext else unique_name


# Global storage instance
storage = StorageAdapter()
