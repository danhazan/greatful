"""
Unified storage adapter - S3-compatible (works with Supabase, R2, AWS S3, etc.)
Automatically uses S3 storage in production, local storage in development
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
        Upload file to storage (S3 in production, local in dev)
        
        Args:
            file_data: File contents as bytes
            folder: Folder name ('posts', 'profile_photos', etc.)
            filename: Name of the file
            content_type: MIME type (optional)
        
        Returns:
            URL to access the file
        """
        if self.is_production:
            return self._upload_to_s3(file_data, folder, filename, content_type)
        else:
            return self._upload_to_local(file_data, folder, filename)
    
    def _upload_to_s3(
        self, 
        file_data: bytes, 
        folder: str, 
        filename: str,
        content_type: Optional[str]
    ) -> str:
        """Upload to S3-compatible storage"""
        try:
            # Construct path: folder/filename
            file_path = f"{folder}/{filename}"
            
            # Upload to S3
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_path,
                Body=file_data,
                **extra_args
            )
            
            # Get public URL
            if self.public_url_base:
                # Use custom public URL if provided
                public_url = f"{self.public_url_base}/{file_path}"
            else:
                # Generate URL from endpoint
                s3_endpoint = os.getenv("S3_ENDPOINT_URL")
                public_url = f"{s3_endpoint}/{self.bucket_name}/{file_path}"
            
            logger.info(f"✓ Uploaded to S3: {file_path}")
            return public_url
            
        except Exception as e:
            logger.error(f"Failed to upload to S3: {e}")
            raise
    
    def _upload_to_local(self, file_data: bytes, folder: str, filename: str) -> str:
        """Upload to local filesystem"""
        # Create folder if it doesn't exist
        folder_path = self.upload_path / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        
        # Write file
        file_path = folder_path / filename
        with open(file_path, "wb") as f:
            f.write(file_data)
        
        # Return relative URL
        url = f"/uploads/{folder}/{filename}"
        logger.info(f"✓ Uploaded locally: {url}")
        return url
    
    def delete_file(self, folder: str, filename: str) -> bool:
        """Delete file from storage"""
        if self.is_production:
            return self._delete_from_s3(folder, filename)
        else:
            return self._delete_from_local(folder, filename)
    
    def _delete_from_s3(self, folder: str, filename: str) -> bool:
        """Delete from S3-compatible storage"""
        try:
            file_path = f"{folder}/{filename}"
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=file_path)
            logger.info(f"✓ Deleted from S3: {file_path}")
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
                logger.info(f"✓ Deleted locally: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete locally: {e}")
            return False
    
    def get_file_url(self, folder: str, filename: str) -> str:
        """Get URL to access a file"""
        if self.is_production:
            file_path = f"{folder}/{filename}"
            if self.public_url_base:
                return f"{self.public_url_base}/{file_path}"
            else:
                s3_endpoint = os.getenv("S3_ENDPOINT_URL")
                return f"{s3_endpoint}/{self.bucket_name}/{file_path}"
        else:
            return f"/uploads/{folder}/{filename}"
    
    def generate_unique_filename(self, original_filename: str) -> str:
        """Generate a unique filename"""
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
        unique_name = f"{uuid.uuid4()}"
        return f"{unique_name}.{ext}" if ext else unique_name


# Global storage instance
storage = StorageAdapter()
