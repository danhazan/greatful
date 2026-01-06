"""
Shared file upload service for handling image uploads across the application.
"""

import logging
import uuid
import os
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import io

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.service_base import BaseService
from app.core.exceptions import ValidationException, BusinessLogicError
from app.core.storage import storage  # Import the storage adapter
from app.services.image_hash_service import ImageHashService
from app.models.image_hash import ImageHash

try:
    from PIL import Image, ImageOps
except ImportError:
    raise ImportError("PIL (Pillow) is required for image processing. Install with: pip install Pillow")

logger = logging.getLogger(__name__)


class FileUploadService(BaseService):
    """Shared service for file upload operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.hash_service = ImageHashService(db)
        
        # Keep for backward compatibility and local file operations
        upload_path = os.getenv("UPLOAD_PATH", "uploads")
        if not os.path.isabs(upload_path):
            upload_path = os.path.abspath(upload_path)
        self.base_upload_dir = Path(upload_path)
        
        logger.info(f"FileUploadService initialized with storage backend: {storage.storage_backend}")

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
            Clean relative path (e.g., 'posts/abc.jpg') - NOT a URL!
            Caller should use storage.get_url() to convert to URL for API responses.
            
        Raises:
            BusinessLogicError: If save operation fails
        """
        try:
            # Generate unique filename
            file_extension = Path(file.filename).suffix if file.filename else '.jpg'
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            
            # Read file content
            content = await file.read()
            
            # Upload using storage adapter
            # Returns clean relative path: 'posts/abc.jpg'
            relative_path = storage.upload_file(
                file_data=content,
                folder=subdirectory,
                filename=unique_filename,
                content_type=file.content_type
            )
            
            logger.info(f"Saved simple file: {unique_filename} to {subdirectory}, path: {relative_path}")
            return relative_path

        except Exception as e:
            logger.error(f"Error saving uploaded file: {e}")
            raise BusinessLogicError(f"Failed to save uploaded file: {str(e)}")

    async def save_post_image_variants(
        self,
        file: UploadFile,
        position: int = 0
    ) -> Dict[str, Any]:
        """
        Save post image with thumbnail, medium, and original variants.

        Creates three size variants optimized for different display contexts:
        - thumbnail: For upload previews and reorder UI
        - medium: For feed display and fullscreen viewer
        - original: Preserved full quality, capped to prevent excessive storage

        Args:
            file: Uploaded image file
            position: Position index for this image in the post (0-indexed)

        Returns:
            Dictionary containing:
            - thumbnail_url: Clean relative path for thumbnail
            - medium_url: Clean relative path for medium
            - original_url: Clean relative path for original
            - width: Original image width
            - height: Original image height
            - file_size: Original file size in bytes
            - position: Position index
            
            NOTE: All URLs are clean relative paths (e.g., 'posts/abc.jpg')
            Caller must use storage.get_url() to convert to full URLs for API responses.

        Raises:
            ValidationException: If image file is invalid
            BusinessLogicError: If processing fails
        """
        from app.config.image_config import get_variant_config

        config = get_variant_config()

        try:
            # Read file content
            content = await file.read()
            file_size = len(content)

            # Open and process image with PIL
            try:
                image = Image.open(io.BytesIO(content))

                # Store original dimensions before any processing
                original_width = image.width
                original_height = image.height

                # Convert to RGB if necessary (handles RGBA, P mode images)
                if image.mode in ('RGBA', 'LA', 'P'):
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

            # Generate unique base filename for all variants
            base_filename = str(uuid.uuid4())
            variant_paths = {}

            # Helper function to resize maintaining aspect ratio
            def resize_to_max_width(img: Image.Image, max_width: int) -> Image.Image:
                if img.width <= max_width:
                    return img.copy()
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                return img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            # Create thumbnail variant
            thumb_image = resize_to_max_width(image, config.thumbnail_width)
            thumb_buffer = io.BytesIO()
            thumb_image.save(thumb_buffer, "JPEG", quality=config.jpeg_quality, optimize=True)
            thumb_filename = f"{base_filename}_thumb.jpg"
            thumb_path = storage.upload_file(
                file_data=thumb_buffer.getvalue(),
                folder="posts",
                filename=thumb_filename,
                content_type="image/jpeg"
            )
            variant_paths['thumbnail_url'] = thumb_path

            # Create medium variant
            medium_image = resize_to_max_width(image, config.medium_width)
            medium_buffer = io.BytesIO()
            medium_image.save(medium_buffer, "JPEG", quality=config.jpeg_quality, optimize=True)
            medium_filename = f"{base_filename}_medium.jpg"
            medium_path = storage.upload_file(
                file_data=medium_buffer.getvalue(),
                folder="posts",
                filename=medium_filename,
                content_type="image/jpeg"
            )
            variant_paths['medium_url'] = medium_path

            # Create original variant (capped to max width)
            original_image = resize_to_max_width(image, config.original_max_width)
            original_buffer = io.BytesIO()
            original_image.save(original_buffer, "JPEG", quality=config.jpeg_quality, optimize=True)
            original_filename = f"{base_filename}_original.jpg"
            original_path = storage.upload_file(
                file_data=original_buffer.getvalue(),
                folder="posts",
                filename=original_filename,
                content_type="image/jpeg"
            )
            variant_paths['original_url'] = original_path

            logger.info(
                f"Created post image variants: {base_filename} "
                f"(thumb={thumb_image.width}x{thumb_image.height}, "
                f"medium={medium_image.width}x{medium_image.height}, "
                f"original={original_image.width}x{original_image.height})"
            )

            return {
                'position': position,
                'width': original_width,
                'height': original_height,
                'file_size': file_size,
                **variant_paths
            }

        except ValidationException:
            raise
        except Exception as e:
            logger.error(f"Error creating post image variants: {e}")
            raise BusinessLogicError(f"Failed to process post image: {str(e)}")

    def cleanup_post_image_variants(self, thumbnail_url: str, medium_url: str, original_url: str) -> None:
        """
        Delete all variants of a post image.

        Args:
            thumbnail_url: Relative path of thumbnail variant
            medium_url: Relative path of medium variant
            original_url: Relative path of original variant
        """
        for relative_path in [thumbnail_url, medium_url, original_url]:
            if relative_path:
                try:
                    storage.delete_file(relative_path)
                    logger.debug(f"Deleted post image variant: {relative_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete variant {relative_path}: {e}")

    async def save_profile_photo_variants(
        self, 
        file: UploadFile, 
        filename_base: str,
        sizes: Dict[str, tuple],
        crop_data: Dict[str, Any] = None
    ) -> Dict[str, str]:
        """
        Save profile photo variants without deduplication.
        This is specifically for profile photos which are individual per user.
        
        Args:
            file: Uploaded file
            filename_base: Base filename (without extension)
            sizes: Dict mapping size names to (width, height) tuples
            crop_data: Optional circular crop parameters
            
        Returns:
            Dict mapping size names to clean relative paths (e.g., 'profile_photos/abc.jpg')
            Caller must use storage.get_url() to convert to URLs for API responses.
            
        Raises:
            BusinessLogicError: If processing fails
        """
        try:
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
            
            # Apply circular cropping if crop_data is provided
            if crop_data:
                image = self._apply_circular_crop(image, crop_data)
            
            file_paths = {}
            
            # Create and save each size variant
            for size_name, (width, height) in sizes.items():
                try:
                    # Create a copy of the original image
                    resized_image = image.copy()
                    
                    # For circular cropped images, maintain aspect ratio and create square variants
                    if crop_data:
                        # Resize to fit the target size while maintaining aspect ratio
                        resized_image.thumbnail((width, height), Image.Resampling.LANCZOS)
                        
                        # Create square canvas with transparent background
                        final_image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                        
                        # Calculate position to center the image
                        x = (width - resized_image.width) // 2
                        y = (height - resized_image.height) // 2
                        final_image.paste(resized_image, (x, y))
                        
                        # Convert to RGB with white background for JPEG
                        if final_image.mode == 'RGBA':
                            background = Image.new('RGB', final_image.size, (255, 255, 255))
                            background.paste(final_image, mask=final_image.split()[-1])
                            final_image = background
                    else:
                        # Original rectangular cropping logic
                        # Resize image maintaining aspect ratio, then crop to exact size
                        resized_image.thumbnail((width, height), Image.Resampling.LANCZOS)
                        
                        # Create new image with exact dimensions and paste resized image centered
                        final_image = Image.new('RGB', (width, height), (255, 255, 255))
                        
                        # Calculate position to center the image
                        x = (width - resized_image.width) // 2
                        y = (height - resized_image.height) // 2
                        final_image.paste(resized_image, (x, y))
                    
                    # Save the image to buffer
                    buffer = io.BytesIO()
                    final_image.save(buffer, "JPEG", quality=85, optimize=True)
                    
                    # Upload using storage adapter
                    filename = f"{filename_base}_{size_name}.jpg"
                    relative_path = storage.upload_file(
                        file_data=buffer.getvalue(),
                        folder="profile_photos",
                        filename=filename,
                        content_type="image/jpeg"
                    )
                    
                    # Store clean relative path
                    file_paths[size_name] = relative_path
                    
                except Exception as e:
                    logger.error(f"Error creating {size_name} variant: {e}")
                    # Clean up any files created so far
                    self.cleanup_profile_photo_files(filename_base, list(file_paths.keys()))
                    raise BusinessLogicError(f"Failed to create image variant: {str(e)}")
            
            return file_paths
            
        except Exception as e:
            if isinstance(e, (ValidationException, BusinessLogicError)):
                raise
            logger.error(f"Error processing profile photo variants: {e}")
            raise BusinessLogicError(f"Failed to process profile photo: {str(e)}")

    async def process_and_save_image_variants(
        self, 
        file: UploadFile, 
        subdirectory: str, 
        filename_base: str,
        sizes: Dict[str, tuple],
        crop_data: Dict[str, Any] = None
    ) -> Dict[str, str]:
        """
        Process image and save multiple size variants with optional circular cropping.
        
        Args:
            file: Uploaded file
            subdirectory: Subdirectory under uploads/
            filename_base: Base filename (without extension)
            sizes: Dict mapping size names to (width, height) tuples
            crop_data: Optional circular crop parameters (x, y, radius)
            
        Returns:
            Dict mapping size names to clean relative paths
            
        Raises:
            BusinessLogicError: If processing fails
        """
        try:
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
            
            # Apply circular cropping if crop_data is provided
            if crop_data:
                image = self._apply_circular_crop(image, crop_data)
            
            file_paths = {}
            
            # Create and save each size variant
            for size_name, (width, height) in sizes.items():
                try:
                    # Create a copy of the original image
                    resized_image = image.copy()
                    
                    # For circular cropped images, maintain aspect ratio and create square variants
                    if crop_data:
                        # Resize to fit the target size while maintaining aspect ratio
                        resized_image.thumbnail((width, height), Image.Resampling.LANCZOS)
                        
                        # Create square canvas with transparent background
                        final_image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                        
                        # Calculate position to center the image
                        x = (width - resized_image.width) // 2
                        y = (height - resized_image.height) // 2
                        final_image.paste(resized_image, (x, y))
                        
                        # Convert to RGB with white background for JPEG
                        if final_image.mode == 'RGBA':
                            background = Image.new('RGB', final_image.size, (255, 255, 255))
                            background.paste(final_image, mask=final_image.split()[-1])
                            final_image = background
                    else:
                        # Original rectangular cropping logic
                        # Resize image maintaining aspect ratio, then crop to exact size
                        resized_image.thumbnail((width, height), Image.Resampling.LANCZOS)
                        
                        # Create new image with exact dimensions and paste resized image centered
                        final_image = Image.new('RGB', (width, height), (255, 255, 255))
                        
                        # Calculate position to center the image
                        x = (width - resized_image.width) // 2
                        y = (height - resized_image.height) // 2
                        final_image.paste(resized_image, (x, y))
                    
                    # Save the image to buffer
                    buffer = io.BytesIO()
                    final_image.save(buffer, "JPEG", quality=85, optimize=True)
                    
                    # Upload using storage adapter
                    filename = f"{filename_base}_{size_name}.jpg"
                    relative_path = storage.upload_file(
                        file_data=buffer.getvalue(),
                        folder=subdirectory,
                        filename=filename,
                        content_type="image/jpeg"
                    )
                    
                    # Store clean relative path
                    file_paths[size_name] = relative_path
                    
                except Exception as e:
                    logger.error(f"Error creating {size_name} variant: {e}")
                    # Clean up any files created so far
                    self.cleanup_files(subdirectory, filename_base, list(file_paths.keys()))
                    raise BusinessLogicError(f"Failed to create image variant: {str(e)}")
            
            return file_paths
            
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
        for size_name in size_names:
            filename = f"{filename_base}_{size_name}.jpg"
            relative_path = f"{subdirectory}/{filename}"
            try:
                storage.delete_file(relative_path)
                logger.debug(f"Deleted file: {relative_path}")
            except Exception as e:
                logger.warning(f"Failed to delete file {relative_path}: {e}")

    def cleanup_profile_photo_files(self, filename_base: str, size_names: List[str]) -> None:
        """
        Delete profile photo files for all size variants.
        
        Args:
            filename_base: Base filename (without extension)
            size_names: List of size variant names
        """
        for size_name in size_names:
            filename = f"{filename_base}_{size_name}.jpg"
            relative_path = f"profile_photos/{filename}"
            try:
                storage.delete_file(relative_path)
                logger.debug(f"Deleted profile photo: {relative_path}")
            except Exception as e:
                logger.warning(f"Failed to delete profile photo {relative_path}: {e}")

    def cleanup_single_file(self, file_path: str) -> None:
        """
        Delete a single file by its path.
        
        Args:
            file_path: Relative path or URL to the file
                      (e.g., 'posts/filename.jpg' or '/uploads/posts/filename.jpg')
        """
        try:
            # Use storage adapter's delete which handles normalization
            success = storage.delete_file(file_path)
            if success:
                logger.info(f"Deleted file: {file_path}")
            else:
                logger.warning(f"File not found or already deleted: {file_path}")
            
        except Exception as e:
            logger.warning(f"Failed to delete file {file_path}: {e}")

    def extract_filename_from_url(self, url: str) -> str:
        """
        Extract base filename from URL.
        
        Args:
            url: File URL (e.g., "profile_photos/filename_medium.jpg")
            
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

    async def check_for_duplicate(
        self, 
        file: UploadFile,
        upload_context: str = None
    ) -> Tuple[Optional[ImageHash], List[Tuple[ImageHash, int]]]:
        """
        Check for exact and similar duplicates of an uploaded file.
        
        Args:
            file: Uploaded file to check
            upload_context: Context of upload ('profile', 'post', etc.)
            
        Returns:
            Tuple of (exact_duplicate, similar_images_list)
            exact_duplicate: ImageHash if exact duplicate found, None otherwise
            similar_images_list: List of (ImageHash, distance) for similar images
            
        Raises:
            ValidationException: If file validation fails
        """
        # Validate the file first
        self.validate_image_file(file)
        
        # Read file content
        content = await file.read()
        await file.seek(0)  # Reset file pointer
        
        # Calculate file hash
        file_hash = await self.hash_service.calculate_file_hash(content)
        
        # Check for exact duplicate
        exact_duplicate = await self.hash_service.check_duplicate_by_hash(file_hash)
        
        # Calculate perceptual hash for similarity detection
        similar_images = []
        try:
            image = Image.open(io.BytesIO(content))
            perceptual_hash = await self.hash_service.calculate_perceptual_hash(image)
            
            if perceptual_hash:
                similar_images = await self.hash_service.find_similar_images(perceptual_hash)
                # Filter out the exact duplicate from similar images
                if exact_duplicate:
                    similar_images = [
                        (img_hash, distance) for img_hash, distance in similar_images 
                        if img_hash.id != exact_duplicate.id
                    ]
        except Exception as e:
            logger.warning(f"Failed to calculate perceptual hash: {e}")
        
        return exact_duplicate, similar_images

    async def save_with_deduplication(
        self,
        file: UploadFile,
        subdirectory: str,
        upload_context: str = None,
        uploader_id: int = None,
        force_upload: bool = False
    ) -> Dict[str, Any]:
        """
        Save file with deduplication check.
        
        Args:
            file: Uploaded file
            subdirectory: Subdirectory under uploads/
            upload_context: Context of upload ('profile', 'post', etc.)
            uploader_id: ID of user uploading the file
            force_upload: If True, upload even if duplicate exists
            
        Returns:
            Dictionary with file information and deduplication status
            
        Raises:
            ValidationException: If file validation fails
            BusinessLogicError: If save operation fails
        """
        # Check for duplicates
        exact_duplicate, similar_images = await self.check_for_duplicate(file, upload_context)
        
        if exact_duplicate and not force_upload:
            # Increment reference count for existing image
            await self.hash_service.increment_reference_count(exact_duplicate)
            
            # Log deduplication success for monitoring
            logger.info(
                f"Deduplication: Reused existing file {exact_duplicate.file_path} "
                f"(hash: {exact_duplicate.file_hash[:8]}..., refs: {exact_duplicate.reference_count + 1}, "
                f"context: {upload_context}, uploader: {uploader_id})"
            )
            
            return {
                "is_duplicate": True,
                "existing_image": {
                    "id": exact_duplicate.id,
                    "file_path": exact_duplicate.file_path,
                    "original_filename": exact_duplicate.original_filename,
                    "reference_count": exact_duplicate.reference_count,
                    "created_at": exact_duplicate.created_at.isoformat()
                },
                "similar_images": [
                    {
                        "id": img_hash.id,
                        "file_path": img_hash.file_path,
                        "similarity_distance": distance,
                        "original_filename": img_hash.original_filename
                    }
                    for img_hash, distance in similar_images[:5]  # Limit to top 5 similar
                ],
                "file_url": self._convert_file_path_to_url(exact_duplicate.file_path),
                "success": True
            }
        
        # No duplicate found or force upload requested - proceed with upload
        return await self._save_new_file(file, subdirectory, upload_context, uploader_id, similar_images, force_upload)

    async def _save_new_file(
        self,
        file: UploadFile,
        subdirectory: str,
        upload_context: str,
        uploader_id: int,
        similar_images: List[Tuple[ImageHash, int]],
        force_upload: bool = False
    ) -> Dict[str, Any]:
        """
        Save a new file and create hash record.
        
        Args:
            file: Uploaded file
            subdirectory: Subdirectory under uploads/
            upload_context: Context of upload
            uploader_id: ID of user uploading
            similar_images: List of similar images found
            
        Returns:
            Dictionary with file information
        """
        try:
            # Generate unique filename
            file_extension = Path(file.filename).suffix if file.filename else '.jpg'
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            
            # Read file content
            content = await file.read()
            
            # Upload using storage adapter - returns clean relative path
            relative_path = storage.upload_file(
                file_data=content,
                folder=subdirectory,
                filename=unique_filename,
                content_type=file.content_type
            )
            
            # Store hash information (skip for force uploads to avoid conflicts)
            image_hash_id = None
            if not force_upload:
                try:
                    # Store the relative path for hash tracking
                    image_hash = await self.hash_service.store_image_hash(
                        file_content=content,
                        original_filename=file.filename or unique_filename,
                        file_path=relative_path,  # Store clean relative path
                        mime_type=file.content_type or "image/jpeg",
                        upload_context=upload_context,
                        uploader_id=uploader_id
                    )
                    image_hash_id = image_hash.id
                    
                    # Log new file upload for monitoring
                    logger.info(
                        f"New upload: Stored {unique_filename} "
                        f"(hash: {image_hash.file_hash[:8]}..., size: {len(content)} bytes, "
                        f"context: {upload_context}, uploader: {uploader_id})"
                    )
                except Exception as e:
                    # If hash storage fails (e.g., duplicate), log but continue
                    logger.warning(f"Failed to store hash for {unique_filename}: {e}")
            else:
                # Log force upload
                logger.info(
                    f"Force upload: Stored {unique_filename} "
                    f"(size: {len(content)} bytes, context: {upload_context}, uploader: {uploader_id}) "
                    f"- skipped deduplication"
                )
            
            return {
                "is_duplicate": False,
                "file_url": relative_path,  # Return clean relative path
                "image_hash_id": image_hash_id,
                "similar_images": [
                    {
                        "id": img_hash.id,
                        "file_path": img_hash.file_path,
                        "similarity_distance": distance,
                        "original_filename": img_hash.original_filename
                    }
                    for img_hash, distance in similar_images[:5]  # Limit to top 5 similar
                ],
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error saving new file: {e}")
            raise BusinessLogicError(f"Failed to save file: {str(e)}")

    async def delete_with_deduplication(self, file_path: str) -> bool:
        """
        Delete file with deduplication handling.
        
        Args:
            file_path: Relative path or URL of the file to delete
            
        Returns:
            True if file was actually deleted, False if still referenced
        """
        try:
            # Normalize the path
            clean_path = storage.normalize_path(file_path)
            
            # Find the image hash record by path
            image_hash = await self.hash_service.get_hash_by_file_path(clean_path)
            
            if image_hash:
                # Decrement reference count
                should_delete = await self.hash_service.decrement_reference_count(image_hash)
                
                if should_delete:
                    # Actually delete the file using storage adapter
                    storage.delete_file(clean_path)
                    logger.info(f"Deleted file: {clean_path}")
                    return True
                else:
                    logger.info(f"File {clean_path} still has {image_hash.reference_count} references, not deleting")
                    return False
            else:
                # No hash record found, delete file directly (legacy behavior)
                storage.delete_file(clean_path)
                logger.info(f"Deleted file (no hash record): {clean_path}")
                return True
            
        except Exception as e:
            logger.warning(f"Failed to delete file with deduplication {file_path}: {e}")
            return False

    def _apply_circular_crop(self, image: Image.Image, crop_data: Dict[str, Any]) -> Image.Image:
        """
        Apply circular cropping to an image.
        
        Args:
            image: PIL Image to crop
            crop_data: Dict with 'x', 'y', 'radius' keys
            
        Returns:
            Circularly cropped PIL Image
        """
        try:
            x = float(crop_data.get('x', 0))
            y = float(crop_data.get('y', 0))
            radius = float(crop_data.get('radius', 100))
            
            # Calculate crop bounds
            left = max(0, int(x - radius))
            top = max(0, int(y - radius))
            right = min(image.width, int(x + radius))
            bottom = min(image.height, int(y + radius))
            
            # Crop to square containing the circle
            crop_size = int(radius * 2)
            cropped = image.crop((left, top, right, bottom))
            
            # Resize to exact crop size if needed
            if cropped.size != (crop_size, crop_size):
                cropped = cropped.resize((crop_size, crop_size), Image.Resampling.LANCZOS)
            
            # Create circular mask
            mask = Image.new('L', (crop_size, crop_size), 0)
            from PIL import ImageDraw
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, crop_size, crop_size), fill=255)
            
            # Apply circular mask
            result = Image.new('RGBA', (crop_size, crop_size), (0, 0, 0, 0))
            result.paste(cropped, (0, 0))
            result.putalpha(mask)
            
            return result
            
        except Exception as e:
            logger.warning(f"Failed to apply circular crop: {e}")
            return image  # Return original image if cropping fails

    def _convert_file_path_to_url(self, file_path: str) -> str:
        """
        Convert file path to URL using storage adapter.
        
        Args:
            file_path: Clean relative path or legacy path
            
        Returns:
            Full URL for frontend
        """
        return storage.get_url(file_path)
