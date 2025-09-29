"""
Image hash model for deduplication system.
"""

from sqlalchemy import Column, String, DateTime, Integer, Text, Boolean, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ImageHash(Base):
    """Model for storing image hashes for deduplication."""
    __tablename__ = "image_hashes"

    id = Column(Integer, primary_key=True, index=True)
    file_hash = Column(String(64), unique=True, nullable=False, index=True)  # SHA-256 hash
    perceptual_hash = Column(String(16), nullable=True, index=True)  # pHash for similarity detection
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # Path to the stored file
    file_size = Column(Integer, nullable=False)  # File size in bytes
    mime_type = Column(String(100), nullable=False)
    width = Column(Integer, nullable=True)  # Image width
    height = Column(Integer, nullable=True)  # Image height
    reference_count = Column(Integer, nullable=False, default=1)  # Number of references to this image
    is_active = Column(Boolean, nullable=False, default=True)  # Whether the file still exists
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Metadata for admin interface
    upload_context = Column(String(50), nullable=True)  # 'profile', 'post', etc.
    first_uploader_id = Column(Integer, nullable=True)  # ID of first user who uploaded this image

    def __repr__(self):
        return f"<ImageHash(id={self.id}, hash={self.file_hash[:8]}..., refs={self.reference_count})>"


# Create indexes for performance
Index('idx_image_hash_file_hash', ImageHash.file_hash)
Index('idx_image_hash_perceptual', ImageHash.perceptual_hash)
Index('idx_image_hash_active', ImageHash.is_active)
Index('idx_image_hash_context', ImageHash.upload_context)