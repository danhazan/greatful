"""
Profile photo service for handling image upload, processing, and management.
"""

import logging
from typing import Dict, Any

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError
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
        file: UploadFile
    ) -> Dict[str, Any]:
        """
        Upload and process profile photo.
        
        Args:
            user_id: ID of the user
            file: Uploaded image file
            
        Returns:
            Dict containing photo data and URLs
            
        Raises:
            NotFoundError: If user doesn't exist
            ValidationException: If file validation fails
            BusinessLogicError: If image processing fails
        """
        # Validate file
        self.file_service.validate_image_file(file, max_size_mb=5)
        
        # Check if user exists
        user = await self.get_by_id_or_404(User, user_id, "User")
        
        # Clean up old photo if exists
        await self._cleanup_old_photo(user_id)
        
        # Generate unique filename
        filename = self.file_service.generate_unique_filename(file.filename, "profile")
        
        # Process and save image variants
        file_urls = await self.file_service.process_and_save_image_variants(
            file, "profile_photos", filename, self.sizes
        )
        
        # Update user record with medium size URL
        profile_image_url = file_urls["medium"]
        user.profile_image_url = profile_image_url
        await self.db.commit()
        
        logger.info(f"Profile photo uploaded for user {user_id}: {filename}")
        
        return {
            "filename": filename,
            "profile_image_url": profile_image_url,
            "urls": file_urls,
            "success": True
        }

    async def delete_profile_photo(self, user_id: int) -> bool:
        """
        Delete user's profile photo and cleanup files.
        
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
        
        # Extract filename from URL
        filename = self.file_service.extract_filename_from_url(user.profile_image_url)
        
        # Delete files
        self.file_service.cleanup_files("profile_photos", filename, list(self.sizes.keys()))
        
        # Update user record
        user.profile_image_url = None
        await self.db.commit()
        
        logger.info(f"Profile photo deleted for user {user_id}")
        return True

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

    async def _cleanup_old_photo(self, user_id: int) -> None:
        """Clean up old profile photo files for a user."""
        user = await self.get_by_id(User, user_id)
        if user and user.profile_image_url:
            filename = self.file_service.extract_filename_from_url(user.profile_image_url)
            self.file_service.cleanup_files("profile_photos", filename, list(self.sizes.keys()))