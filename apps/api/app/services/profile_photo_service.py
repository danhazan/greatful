"""
Profile photo service for handling image upload, processing, and management.
"""

import logging
from pathlib import Path
from typing import Dict, Any

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ValidationException, BusinessLogicError
from app.core.storage import storage  # Import the storage adapter
from app.models.user import User
from app.services.file_upload_service import FileUploadService

logger = logging.getLogger(__name__)


class ProfilePhotoService(BaseService):
    """Service for profile photo management with image processing."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.file_service = FileUploadService(db)
        
        # Image size variants for profile photos
        self.sizes = {
            "thumbnail": (64, 64),
            "small": (128, 128),
            "medium": (256, 256),
            "large": (512, 512)
        }

    async def upload_profile_photo(
        self,
        user_id: int,
        file: UploadFile,
        crop_data: Dict[str, Any] = None,
        force_upload: bool = False
    ) -> Dict[str, Any]:
        """
        Upload and process profile photo with circular cropping.
        Profile photos are completely disconnected from deduplication system.
        Each user gets individual variants that are not shared.
        
        Args:
            user_id: ID of the user
            file: Uploaded image file
            crop_data: Optional crop parameters (x, y, radius)
            force_upload: If True, upload even if duplicate exists (ignored for profiles)
            
        Returns:
            Dict containing photo data and URLs
            
        Raises:
            NotFoundError: If user doesn't exist
            ValidationException: If file validation fails
            BusinessLogicError: If image processing fails
        """
        try:
            # Check if user exists
            user = await self.get_by_id_or_404(User, user_id, "User")
            
            # Validate the image file
            self.file_service.validate_image_file(file)
            
            try:
                # Clean up old profile photo and all variants if it exists
                if user.profile_image_url:
                    await self._delete_profile_photo_variants(user.profile_image_url)
                
                # Create individual variants for this user (no deduplication)
                await file.seek(0)
                sizes_result = await self._create_individual_variants(file, user_id, crop_data)
                
                # Update user's profile image URL (use medium size as default)
                medium_url = sizes_result.get("medium")
                if not medium_url:
                    raise BusinessLogicError("Failed to create medium size variant")
                    
                user.profile_image_url = medium_url
                await self.db.commit()
                await self.db.refresh(user)
                
                logger.info(f"Profile photo uploaded successfully for user {user_id}")
                
                return {
                    "success": True,
                    "message": "Profile photo uploaded successfully",
                    "profile_image_url": medium_url,
                    "sizes": sizes_result,
                    "is_duplicate": False,
                    "similar_images": [],  # No similarity checking for profiles
                    "user_id": user_id
                }
                
            except Exception as e:
                logger.error(f"Failed to process profile photo for user {user_id}: {e}")
                raise BusinessLogicError(f"Failed to generate profile photo sizes: {str(e)}")
            
        except ValidationException:
            raise
        except BusinessLogicError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error uploading profile photo for user {user_id}: {e}")
            raise BusinessLogicError(f"Failed to upload profile photo: {str(e)}")

    async def check_profile_photo_duplicate(self, user_id: int, file: UploadFile) -> Dict[str, Any]:
        """
        Profile photos don't use deduplication, so this always returns no duplicates.
        Kept for API compatibility.
        
        Args:
            user_id: ID of the user
            file: Uploaded image file to check
            
        Returns:
            Dictionary with no duplicate results
            
        Raises:
            ValidationException: If file validation fails
        """
        try:
            # Validate the file
            self.file_service.validate_image_file(file)
            
            return {
                "success": True,
                "has_exact_duplicate": False,
                "exact_duplicate": None,
                "similar_images": [],
                "has_similar_images": False
            }
            
        except ValidationException:
            raise
        except Exception as e:
            logger.error(f"Error checking profile photo for user {user_id}: {e}")
            raise BusinessLogicError(f"Failed to check profile photo: {str(e)}")

    async def delete_profile_photo(self, user_id: int) -> bool:
        """
        Delete user's profile photo and all variants with deduplication handling.
        
        Args:
            user_id: ID of the user
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If user doesn't exist or has no photo
        """
        user = await self.get_by_id_or_404(User, user_id, "User")
        
        if not user.profile_image_url:
            raise NotFoundError("Profile photo", "user profile")
        
        # Delete all profile photo variants
        await self._delete_profile_photo_variants(user.profile_image_url)
        
        # Update user record
        user.profile_image_url = None
        await self.db.commit()
        
        logger.info(f"Profile photo and all variants deleted for user {user_id}")
        return True

    async def _create_individual_variants(self, file: UploadFile, user_id: int, crop_data: Dict[str, Any] = None) -> Dict[str, str]:
        """
        Create individual profile photo variants for a specific user.
        Each user gets their own variants, not shared with other users.
        
        Args:
            file: UploadFile to create variants from
            user_id: ID of the user (for unique filename)
            crop_data: Optional circular crop parameters
            
        Returns:
            Dict mapping size names to variant URLs
        """
        # Generate unique filename base for this user
        import uuid
        unique_id = str(uuid.uuid4())
        filename_base = f"profile_{user_id}_{unique_id}"
        
        # Create variants using the dedicated profile photo method (no deduplication)
        sizes_result = await self.file_service.save_profile_photo_variants(
            file, filename_base, self.sizes, crop_data
        )
        
        return sizes_result

    def _extract_base_filename_from_variant_url(self, variant_url: str) -> tuple[str, str]:
        """
        Extract base filename and extension from a variant URL.
        
        Args:
            variant_url: URL like /uploads/profile_photos/profile_uuid_medium.jpg
            
        Returns:
            tuple: (base_filename, extension) like ("profile_uuid", ".jpg")
        """
        url_path = Path(variant_url)
        filename_with_size = url_path.stem  # profile_uuid_medium
        extension = url_path.suffix  # .jpg
        
        # Remove the size suffix to get base filename
        parts = filename_with_size.split('_')
        if len(parts) >= 2 and parts[-1] in self.sizes:
            base_filename = '_'.join(parts[:-1])  # profile_uuid
        else:
            base_filename = filename_with_size
            
        return base_filename, extension

    async def _delete_profile_photo_variants(self, profile_image_url: str) -> None:
        """
        Delete individual profile photo variants using storage adapter.
        Since each user has individual variants, we delete all variants directly.
        
        Args:
            profile_image_url: URL of the main profile photo (usually the medium variant)
        """
        try:
            # Extract base filename from the variant URL
            base_filename, extension = self._extract_base_filename_from_variant_url(profile_image_url)
            
            # Delete all size variants using storage adapter
            logger.info(f"Deleting individual profile photo variants for {base_filename}")
            
            for size_name in self.sizes.keys():
                variant_filename = f"{base_filename}_{size_name}{extension}"
                
                try:
                    # Use storage adapter to delete file
                    storage.delete_file(folder="profile_photos", filename=variant_filename)
                    logger.debug(f"Deleted profile photo variant: {variant_filename}")
                except Exception as e:
                    logger.warning(f"Failed to delete variant {variant_filename}: {e}")
            
        except Exception as e:
            logger.warning(f"Error deleting profile photo variants for {profile_image_url}: {e}")
            # Fallback: try to delete the main file directly
            self.file_service.cleanup_single_file(profile_image_url)

    async def get_default_avatar_url(self, user_id: int) -> str:
        """
        Generate default avatar URL for users without profile photos.
        
        Args:
            user_id: ID of the user
            
        Returns:
            URL to default avatar
        """
        # Use a simple color-based avatar system
        colors = [
            "#7C3AED", "#A855F7", "#C084FC", "#DDD6FE",
            "#8B5CF6", "#9333EA", "#A21CAF", "#BE185D"
        ]
        color = colors[user_id % len(colors)]
        
        # For now, return a placeholder URL with the user's color
        # In production, this could generate actual avatar images
        return f"/api/avatar/{user_id}?color={color.replace('#', '')}"
