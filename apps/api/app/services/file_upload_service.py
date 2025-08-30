"""
Shared file upload service for handling image uploads across the application.
"""

import logging
import uuid
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
import io

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.service_base import BaseService
from app.core.exceptions import ValidationException, BusinessLogicError

try:
    from PIL import Image, ImageOps
except ImportError:
    raise ImportError("PIL (Pillow) is required for image processing. Install with: pip install Pillow")

logger = logging.getLogger(__name__)


class FileUploadService(BaseService):
    """Shared service for file upload operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.base_upload_dir = Path("uploads")
        self.base_upload_dir.mkdir(parents=True, exist_ok=True)

    def validate_image_file(self, file: UploadFile, max_size_mb: int = 5) -> None:
        """
        Validate uploaded image file.
        
        Args:
            file: Uploaded file
            max_size_mb: Maximum file size in MB
            
        Raises:
            ValidationException: If validation fails
        """
        # Check file size
        max_size_bytes = max_size_mb * 1024 * 1024
        if hasattr(file, 'size') and file.size and file.size > max_size_bytes:
            raise ValidationException(f"File size must be less than {max_size_mb}MB")
        
        # Check content type
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        if file.content_type not in allowed_types:
            raise ValidationException(f"File type must be one of: {', '.join(allowed_types)}")
        
        # Check file extension
        if file.filename:
            allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in allowed_extensions:
                raise ValidationException(f"File extension must be one of: {', '.join(allowed_extensions)}")
        
        # Basic validation - we'll validate the actual image content during processing
        # This avoids issues with file pointer manipulation during validation

    def generate_unique_filename(self, original_filename: Optional[str], prefix: str = "") -> str:
        """
        Generate unique filename for uploaded file.
        
        Args:
            original_filename: Original filename
            prefix: Prefix for the filename
            
        Returns:
            Unique filename without extension
        """
        unique_id = str(uuid.uuid4())
        if prefix:
            return f"{prefix}_{unique_id}"
        return unique_id

    async def save_simple_file(self, file: UploadFile, subdirectory: str) -> str:
        """
        Save uploaded file without processing (for posts).
        
        Args:
            file: Uploaded file
            subdirectory: Subdirectory under uploads/
            
        Returns:
            URL path to the saved file
            
        Raises:
            BusinessLogicError: If save operation fails
        """
        try:
            # Create upload directory
            upload_dir = self.base_upload_dir / subdirectory
            upload_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename
            file_extension = Path(file.filename).suffix if file.filename else '.jpg'
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = upload_dir / unique_filename
            
            # Save the file
            content = await file.read()
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            
            # Return the URL path (relative to the server)
            return f"/uploads/{subdirectory}/{unique_filename}"
            
        except Exception as e:
            logger.error(f"Error saving uploaded file: {e}")
            raise BusinessLogicError(f"Failed to save uploaded file: {str(e)}")

    async def process_and_save_image_variants(
        self, 
        file: UploadFile, 
        subdirectory: str, 
        filename_base: str,
        sizes: Dict[str, tuple]
    ) -> Dict[str, str]:
        """
        Process image and save multiple size variants.
        
        Args:
            file: Uploaded file
            subdirectory: Subdirectory under uploads/
            filename_base: Base filename (without extension)
            sizes: Dict mapping size names to (width, height) tuples
            
        Returns:
            Dict mapping size names to URL paths
            
        Raises:
            BusinessLogicError: If processing fails
        """
        try:
            # Create upload directory
            upload_dir = self.base_upload_dir / subdirectory
            upload_dir.mkdir(parents=True, exist_ok=True)
            
            # Read and process the uploaded file
            content = await file.read()
            
            # Open image with PIL
            try:
                image = Image.open(io.BytesIO(content))
                
                # Convert to RGB if necessary (handles RGBA, P mode images)
                if image.mode in ('RGBA', 'LA', 'P'):
                    # Create white background
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                    image = background
                elif image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Auto-orient image based on EXIF data
                image = ImageOps.exif_transpose(image)
                
            except Exception as e:
                raise ValidationException(f"Invalid image file: {str(e)}")
            
            file_urls = {}
            
            # Create and save each size variant
            for size_name, (width, height) in sizes.items():
                try:
                    # Create a copy of the original image
                    resized_image = image.copy()
                    
                    # Resize image maintaining aspect ratio, then crop to exact size
                    resized_image.thumbnail((width, height), Image.Resampling.LANCZOS)
                    
                    # Create new image with exact dimensions and paste resized image centered
                    final_image = Image.new('RGB', (width, height), (255, 255, 255))
                    
                    # Calculate position to center the image
                    x = (width - resized_image.width) // 2
                    y = (height - resized_image.height) // 2
                    final_image.paste(resized_image, (x, y))
                    
                    # Save the image
                    filename = f"{filename_base}_{size_name}.jpg"
                    file_path = upload_dir / filename
                    final_image.save(file_path, "JPEG", quality=85, optimize=True)
                    
                    # Store URL
                    file_urls[size_name] = f"/uploads/{subdirectory}/{filename}"
                    
                except Exception as e:
                    logger.error(f"Error creating {size_name} variant: {e}")
                    # Clean up any files created so far
                    self.cleanup_files(subdirectory, filename_base, list(sizes.keys()))
                    raise BusinessLogicError(f"Failed to create image variant: {str(e)}")
            
            return file_urls
            
        except Exception as e:
            if isinstance(e, (ValidationException, BusinessLogicError)):
                raise
            logger.error(f"Error processing image variants: {e}")
            raise BusinessLogicError(f"Failed to process image: {str(e)}")

    def cleanup_files(self, subdirectory: str, filename_base: str, size_names: List[str]) -> None:
        """
        Delete files for all size variants.
        
        Args:
            subdirectory: Subdirectory under uploads/
            filename_base: Base filename (without extension)
            size_names: List of size variant names
        """
        upload_dir = self.base_upload_dir / subdirectory
        
        for size_name in size_names:
            file_path = upload_dir / f"{filename_base}_{size_name}.jpg"
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete file {file_path}: {e}")

    def cleanup_single_file(self, file_url: str) -> None:
        """
        Delete a single file by its URL.
        
        Args:
            file_url: URL path to the file (e.g., "/uploads/posts/filename.jpg")
        """
        try:
            # Convert URL to file path
            if file_url.startswith('/uploads/'):
                relative_path = file_url[9:]  # Remove '/uploads/' prefix
                file_path = self.base_upload_dir / relative_path
                
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"Deleted file: {file_path}")
            
        except Exception as e:
            logger.warning(f"Failed to delete file {file_url}: {e}")

    def extract_filename_from_url(self, url: str) -> str:
        """
        Extract base filename from URL.
        
        Args:
            url: File URL (e.g., "/uploads/profile_photos/filename_medium.jpg")
            
        Returns:
            Base filename without size suffix and extension
        """
        path = Path(url)
        name_with_size = path.stem  # filename_medium
        # Remove the size suffix
        parts = name_with_size.split('_')
        if len(parts) >= 2:
            return '_'.join(parts[:-1])  # Remove last part (size)
        return name_with_size