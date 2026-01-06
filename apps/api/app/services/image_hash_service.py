"""
Image hash service for deduplication and similarity detection.
"""

import hashlib
import logging
from typing import Dict, Any, Optional, List, Tuple
import io
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, func

from app.core.service_base import BaseService
from app.core.exceptions import ValidationException, BusinessLogicError
from app.core.storage import storage  # Import storage adapter
from app.models.image_hash import ImageHash

try:
    from PIL import Image
    import imagehash
except ImportError:
    raise ImportError("PIL and imagehash are required. Install with: pip install Pillow imagehash")

logger = logging.getLogger(__name__)


class ImageHashService(BaseService):
    """Service for managing image hashes and deduplication."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)

    async def calculate_file_hash(self, file_content: bytes) -> str:
        """
        Calculate SHA-256 hash of file content.
        
        Args:
            file_content: Raw file bytes
            
        Returns:
            Hexadecimal hash string
        """
        return hashlib.sha256(file_content).hexdigest()

    async def calculate_perceptual_hash(self, image: Image.Image) -> str:
        """
        Calculate perceptual hash for similarity detection.
        
        Args:
            image: PIL Image object
            
        Returns:
            Perceptual hash string
        """
        try:
            # Use pHash (perceptual hash) for similarity detection
            phash = imagehash.phash(image)
            return str(phash)
        except Exception as e:
            logger.warning(f"Failed to calculate perceptual hash: {e}")
            return ""

    async def get_image_metadata(self, image: Image.Image) -> Dict[str, Any]:
        """
        Extract metadata from image.
        
        Args:
            image: PIL Image object
            
        Returns:
            Dictionary with image metadata
        """
        return {
            "width": image.width,
            "height": image.height,
            "format": image.format or "UNKNOWN",
            "mode": image.mode
        }

    async def check_duplicate_by_hash(self, file_hash: str, include_inactive: bool = False) -> Optional[ImageHash]:
        """
        Check if an image with the same hash already exists.
        
        Args:
            file_hash: SHA-256 hash of the file
            include_inactive: Whether to include inactive records
            
        Returns:
            ImageHash object if duplicate found, None otherwise
        """
        if include_inactive:
            # Check for any record with this hash (active or inactive)
            result = await self.db.execute(
                select(ImageHash).where(ImageHash.file_hash == file_hash)
            )
        else:
            # Only check active records
            result = await self.db.execute(
                select(ImageHash).where(
                    and_(
                        ImageHash.file_hash == file_hash,
                        ImageHash.is_active == True
                    )
                )
            )
        return result.scalar_one_or_none()

    async def find_similar_images(
        self, 
        perceptual_hash: str, 
        threshold: int = 5
    ) -> List[Tuple[ImageHash, int]]:
        """
        Find similar images using perceptual hash.
        
        Args:
            perceptual_hash: Perceptual hash to compare against
            threshold: Maximum hamming distance for similarity (default: 5)
            
        Returns:
            List of tuples (ImageHash, hamming_distance) for similar images
        """
        if not perceptual_hash:
            return []

        try:
            # Get all active images with perceptual hashes
            result = await self.db.execute(
                select(ImageHash).where(
                    and_(
                        ImageHash.perceptual_hash.isnot(None),
                        ImageHash.perceptual_hash != "",
                        ImageHash.is_active == True
                    )
                )
            )
            all_hashes = result.scalars().all()

            similar_images = []
            target_hash = imagehash.hex_to_hash(perceptual_hash)

            for img_hash in all_hashes:
                try:
                    stored_hash = imagehash.hex_to_hash(img_hash.perceptual_hash)
                    distance = target_hash - stored_hash  # Hamming distance
                    
                    if distance <= threshold:
                        similar_images.append((img_hash, distance))
                except Exception as e:
                    logger.warning(f"Error comparing hashes: {e}")
                    continue

            # Sort by similarity (lower distance = more similar)
            similar_images.sort(key=lambda x: x[1])
            return similar_images

        except Exception as e:
            logger.error(f"Error finding similar images: {e}")
            return []

    async def store_image_hash(
        self,
        file_content: bytes,
        original_filename: str,
        file_path: str,
        mime_type: str,
        upload_context: str = None,
        uploader_id: int = None
    ) -> ImageHash:
        """
        Store image hash information in database.
        
        Args:
            file_content: Raw file bytes
            original_filename: Original filename
            file_path: Clean relative path where file is stored (e.g., 'posts/abc.jpg')
            mime_type: MIME type of the file
            upload_context: Context of upload ('profile', 'post', etc.)
            uploader_id: ID of user who uploaded the image
            
        Returns:
            ImageHash object
            
        Raises:
            BusinessLogicError: If hash calculation or storage fails
        """
        try:
            # Normalize the file path (handles legacy formats)
            clean_path = storage.normalize_path(file_path)
            
            # Calculate file hash
            file_hash = await self.calculate_file_hash(file_content)
            
            # Check if any record with this hash already exists (active or inactive)
            existing_hash = await self.check_duplicate_by_hash(file_hash, include_inactive=True)
            
            if existing_hash:
                if not existing_hash.is_active:
                    # Reactivate the existing inactive record with new file path
                    existing_hash.file_path = clean_path
                    existing_hash.original_filename = original_filename
                    existing_hash.mime_type = mime_type
                    existing_hash.file_size = len(file_content)
                    existing_hash.reference_count = 1
                    existing_hash.is_active = True
                    existing_hash.upload_context = upload_context
                    existing_hash.first_uploader_id = uploader_id
                    
                    await self.db.commit()
                    await self.db.refresh(existing_hash)
                    
                    logger.info(f"Reactivated existing image hash {file_hash[:8]}...")
                    return existing_hash
                else:
                    # Active record exists, increment reference count
                    existing_hash.reference_count += 1
                    await self.db.commit()
                    await self.db.refresh(existing_hash)
                    
                    logger.info(f"Incremented reference count for existing hash {file_hash[:8]}...")
                    return existing_hash
            
            # Open image for metadata and perceptual hash
            image = Image.open(io.BytesIO(file_content))
            metadata = await self.get_image_metadata(image)
            perceptual_hash = await self.calculate_perceptual_hash(image)
            
            # Create ImageHash record with clean path
            image_hash = ImageHash(
                file_hash=file_hash,
                perceptual_hash=perceptual_hash,
                original_filename=original_filename,
                file_path=clean_path,  # Store clean relative path
                file_size=len(file_content),
                mime_type=mime_type,
                width=metadata["width"],
                height=metadata["height"],
                upload_context=upload_context,
                first_uploader_id=uploader_id,
                reference_count=1
            )
            
            self.db.add(image_hash)
            await self.db.commit()
            await self.db.refresh(image_hash)
            
            logger.info(f"Stored image hash: {file_hash[:8]}... for {original_filename}, path: {clean_path}")
            return image_hash
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error storing image hash: {e}")
            raise BusinessLogicError(f"Failed to store image hash: {str(e)}")

    async def increment_reference_count(self, image_hash: ImageHash) -> ImageHash:
        """
        Increment reference count for an existing image.
        
        Args:
            image_hash: ImageHash object to update
            
        Returns:
            Updated ImageHash object
        """
        image_hash.reference_count += 1
        await self.db.commit()
        await self.db.refresh(image_hash)
        
        logger.info(f"Incremented reference count for hash {image_hash.file_hash[:8]}... to {image_hash.reference_count}")
        return image_hash

    async def decrement_reference_count(self, image_hash: ImageHash) -> bool:
        """
        Decrement reference count for an image. Delete from database if count reaches 0.
        
        Args:
            image_hash: ImageHash object to update
            
        Returns:
            True if image was deleted (reference count reached 0)
        """
        image_hash.reference_count = max(0, image_hash.reference_count - 1)
        
        if image_hash.reference_count == 0:
            # Actually delete the record from database when no references remain
            logger.info(f"Deleting image hash record {image_hash.file_hash[:8]}... (no references)")
            await self.db.delete(image_hash)
            await self.db.commit()
            return True
        else:
            await self.db.commit()
            await self.db.refresh(image_hash)
            return False

    async def get_hash_by_file_path(self, file_path: str) -> Optional[ImageHash]:
        """
        Get ImageHash by file path.
        
        Args:
            file_path: Path to the file (can be legacy or clean format)
            
        Returns:
            ImageHash object if found, None otherwise
        """
        # Normalize the path to handle both old and new formats
        clean_path = storage.normalize_path(file_path)
        
        result = await self.db.execute(
            select(ImageHash).where(ImageHash.file_path == clean_path)
        )
        image_hash = result.scalar_one_or_none()
        
        # If not found with clean path, try original path (for transition period)
        if not image_hash and clean_path != file_path:
            result = await self.db.execute(
                select(ImageHash).where(ImageHash.file_path == file_path)
            )
            image_hash = result.scalar_one_or_none()
        
        return image_hash

    async def cleanup_orphaned_hashes(self) -> int:
        """
        Clean up ImageHash records with reference_count = 0.
        Uses storage adapter for cross-platform file deletion (local/S3).
        
        Returns:
            Number of records cleaned up
        """
        try:
            # Find inactive hashes
            result = await self.db.execute(
                select(ImageHash).where(
                    and_(
                        ImageHash.reference_count == 0,
                        ImageHash.is_active == False
                    )
                )
            )
            orphaned_hashes = result.scalars().all()
            
            count = 0
            for image_hash in orphaned_hashes:
                # Delete file using storage adapter (works for both local and S3)
                try:
                    success = storage.delete_file(image_hash.file_path)
                    if success:
                        logger.info(f"Deleted orphaned file: {image_hash.file_path}")
                    else:
                        logger.warning(f"Orphaned file not found or already deleted: {image_hash.file_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete orphaned file {image_hash.file_path}: {e}")
                
                # Delete the hash record from database
                await self.db.delete(image_hash)
                count += 1
            
            if count > 0:
                await self.db.commit()
                logger.info(f"Cleaned up {count} orphaned image hash records")
            
            return count
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error cleaning up orphaned hashes: {e}")
            return 0

    async def get_duplicate_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about duplicate images.
        
        Returns:
            Dictionary with deduplication statistics
        """
        try:
            # Total images
            total_result = await self.db.execute(
                select(func.count(ImageHash.id)).where(ImageHash.is_active == True)
            )
            total_images = total_result.scalar() or 0
            
            # Images with multiple references (duplicates saved)
            duplicate_result = await self.db.execute(
                select(func.count(ImageHash.id)).where(
                    and_(
                        ImageHash.is_active == True,
                        ImageHash.reference_count > 1
                    )
                )
            )
            duplicate_images = duplicate_result.scalar() or 0
            
            # Total references
            refs_result = await self.db.execute(
                select(func.sum(ImageHash.reference_count)).where(ImageHash.is_active == True)
            )
            total_references = refs_result.scalar() or 0
            
            # Calculate space saved
            space_saved = total_references - total_images if total_references > total_images else 0
            
            return {
                "total_unique_images": total_images,
                "images_with_duplicates": duplicate_images,
                "total_references": total_references,
                "duplicates_prevented": space_saved,
                "deduplication_ratio": (space_saved / total_references * 100) if total_references > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting duplicate statistics: {e}")
            return {
                "total_unique_images": 0,
                "images_with_duplicates": 0,
                "total_references": 0,
                "duplicates_prevented": 0,
                "deduplication_ratio": 0
            }
