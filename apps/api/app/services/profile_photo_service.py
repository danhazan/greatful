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
        force_upload: bool = False
    ) -> Dict[str, Any]:
        """
        Upload and process profile photo with deduplication.
        
        Args:
            user_id: ID of the user
            file: Uploaded image file
            force_upload: If True, upload even if duplicate exists
            
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
            
            # Save with deduplication
            upload_result = await self.file_service.save_with_deduplication(
                file=file,
                subdirectory="profile_photos",
                upload_context="profile",
                uploader_id=user_id,
                force_upload=force_upload
            )
            
            if not upload_result["success"]:
                raise BusinessLogicError("Failed to save profile photo")
            
            file_url = upload_result["file_url"]
            
            # If it's a duplicate, use the existing file and ensure variants exist
            if upload_result["is_duplicate"]:
                # Clean up old profile photo and all variants if it exists
                if user.profile_image_url:
                    await self._delete_profile_photo_variants(user.profile_image_url)
                
                # Ensure variants exist for the duplicate image (create if missing)
                sizes_result = await self._ensure_variants_exist(file_url, file)
                
                # Update user's profile image URL (use medium size as default)
                medium_url = sizes_result.get("medium", file_url)
                user.profile_image_url = medium_url
                await self.db.commit()
                await self.db.refresh(user)
                
                logger.info(f"Profile photo set to existing duplicate for user {user_id}")
                
                return {
                    "success": True,
                    "message": "Profile photo set (duplicate detected)",
                    "profile_image_url": medium_url,
                    "sizes": sizes_result,
                    "is_duplicate": True,
                    "existing_image": upload_result["existing_image"],
                    "similar_images": upload_result.get("similar_images", []),
                    "user_id": user_id
                }
            
            # For new uploads, we need to generate different sizes
            # Extract filename from URL for variant processing
            filename_parts = file_url.split('/')[-1].split('.')
            filename_base = '.'.join(filename_parts[:-1])  # Remove extension
            
            try:
                # Clean up old profile photo and all variants if it exists
                if user.profile_image_url:
                    await self._delete_profile_photo_variants(user.profile_image_url)
                
                # Create variants for the new upload
                sizes_result = await self._ensure_variants_exist(file_url, file)
                
                # Update user's profile image URL (use medium size as default)
                medium_url = sizes_result.get("medium", file_url)
                user.profile_image_url = medium_url
                
            except Exception as e:
                # Clean up the original file if size generation failed
                await self.file_service.delete_with_deduplication(file_url)
                raise BusinessLogicError(f"Failed to generate profile photo sizes: {str(e)}")
            await self.db.commit()
            await self.db.refresh(user)
            
            logger.info(f"Profile photo uploaded successfully for user {user_id}")
            
            return {
                "success": True,
                "message": "Profile photo uploaded successfully",
                "profile_image_url": medium_url,
                "sizes": sizes_result,
                "is_duplicate": False,
                "similar_images": upload_result.get("similar_images", []),
                "user_id": user_id
            }
            
        except ValidationException:
            raise
        except BusinessLogicError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error uploading profile photo for user {user_id}: {e}")
            raise BusinessLogicError(f"Failed to upload profile photo: {str(e)}")

    async def check_profile_photo_duplicate(self, user_id: int, file: UploadFile) -> Dict[str, Any]:
        """
        Check if a profile photo is a duplicate without uploading.
        
        Args:
            user_id: ID of the user
            file: Uploaded image file to check
            
        Returns:
            Dictionary with duplicate check results
            
        Raises:
            ValidationException: If file validation fails
            BusinessLogicError: If check fails
        """
        try:
            # Check for duplicates
            exact_duplicate, similar_images = await self.file_service.check_for_duplicate(
                file=file,
                upload_context="profile"
            )
            
            return {
                "success": True,
                "has_exact_duplicate": exact_duplicate is not None,
                "exact_duplicate": {
                    "id": exact_duplicate.id,
                    "file_path": exact_duplicate.file_path,
                    "original_filename": exact_duplicate.original_filename,
                    "reference_count": exact_duplicate.reference_count,
                    "created_at": exact_duplicate.created_at.isoformat()
                } if exact_duplicate else None,
                "similar_images": [
                    {
                        "id": img_hash.id,
                        "file_path": img_hash.file_path,
                        "similarity_distance": distance,
                        "original_filename": img_hash.original_filename,
                        "created_at": img_hash.created_at.isoformat()
                    }
                    for img_hash, distance in similar_images[:5]  # Limit to top 5 similar
                ],
                "has_similar_images": len(similar_images) > 0
            }
            
        except ValidationException:
            raise
        except Exception as e:
            logger.error(f"Error checking profile photo duplicate for user {user_id}: {e}")
            raise BusinessLogicError(f"Failed to check for duplicates: {str(e)}")

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

    async def _ensure_variants_exist(self, original_file_url: str, file: UploadFile) -> Dict[str, str]:
        """
        Ensure that variants exist for the given original file.
        If variants don't exist, create them.
        
        Args:
            original_file_url: URL of the original file
            file: UploadFile to create variants from (if needed)
            
        Returns:
            Dict mapping size names to variant URLs
        """
        # Extract filename from the original file URL
        filename_parts = original_file_url.split('/')[-1].split('.')
        filename_base = '.'.join(filename_parts[:-1])  # Remove extension
        extension = filename_parts[-1] if len(filename_parts) > 1 else 'jpg'
        
        # Check if variants already exist on disk
        upload_dir = Path(self.file_service.base_upload_dir) / "profile_photos"
        sizes_result = {}
        all_variants_exist = True
        
        for size_name in self.sizes.keys():
            variant_filename = f"{filename_base}_{size_name}.{extension}"
            variant_path = upload_dir / variant_filename
            variant_url = f"/uploads/profile_photos/{variant_filename}"
            
            if variant_path.exists():
                sizes_result[size_name] = variant_url
            else:
                all_variants_exist = False
                break
        
        # If all variants exist, return them
        if all_variants_exist:
            logger.debug(f"Using existing variants for {filename_base}")
            return sizes_result
        
        # If variants don't exist, create them
        logger.info(f"Creating missing variants for {filename_base}")
        await file.seek(0)
        sizes_result = await self.file_service.process_and_save_image_variants(
            file, "profile_photos", filename_base, self.sizes
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
        Delete profile photo through deduplication system.
        Variants are only deleted when the original image reference count reaches 0.
        
        Args:
            profile_image_url: URL of the main profile photo (usually the medium variant)
        """
        try:
            # Extract base filename from the variant URL
            base_filename, extension = self._extract_base_filename_from_variant_url(profile_image_url)
            
            # Delete the original image through deduplication system
            # The original image (without size suffix) is what's tracked in deduplication
            original_url = f"/uploads/profile_photos/{base_filename}{extension}"
            
            # This will decrement reference count and delete the original if count reaches 0
            was_deleted = await self.file_service.delete_with_deduplication(original_url)
            
            if was_deleted:
                # Original was deleted (reference count reached 0), so delete all variants
                logger.info(f"Original image deleted, cleaning up variants for {base_filename}")
                upload_dir = Path(self.file_service.base_upload_dir) / "profile_photos"
                
                for size_name in self.sizes.keys():
                    variant_filename = f"{base_filename}_{size_name}{extension}"
                    variant_path = upload_dir / variant_filename
                    
                    try:
                        if variant_path.exists():
                            variant_path.unlink()
                            logger.debug(f"Deleted profile photo variant from disk: {variant_filename}")
                    except Exception as e:
                        logger.warning(f"Failed to delete variant {variant_filename}: {e}")
            else:
                # Original still has references, variants should remain
                logger.debug(f"Original image still has references, keeping variants for {base_filename}")
            
        except Exception as e:
            logger.warning(f"Error deleting profile photo variants for {profile_image_url}: {e}")
            # Fallback: try to delete the main file through deduplication
            await self.file_service.delete_with_deduplication(profile_image_url)

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
        """Clean up old profile photo files for a user with deduplication handling."""
        user = await self.get_by_id(User, user_id)
        if user and user.profile_image_url:
            await self.file_service.delete_with_deduplication(user.profile_image_url)