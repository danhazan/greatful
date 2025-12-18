"""
PostImage model for storing multiple images per post with variants.

Each post can have up to MAX_POST_IMAGES images (configured via environment).
Images are stored with three variants: thumbnail, medium, and original.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class PostImage(Base):
    """
    Model for storing multiple images per post with size variants.

    Each image has three URL variants optimized for different display contexts:
    - thumbnail_url: For upload previews and reorder UI
    - medium_url: For feed display and fullscreen viewer
    - original_url: Preserved for future use, capped to prevent excessive storage
    """
    __tablename__ = "post_images"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(
        String,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    position = Column(Integer, nullable=False, default=0)  # Order within the post (0-indexed)

    # Image variants for different display contexts
    thumbnail_url = Column(String(500), nullable=False)  # For upload previews, reorder UI
    medium_url = Column(String(500), nullable=False)     # For feed display, fullscreen viewer
    original_url = Column(String(500), nullable=False)   # Preserved, capped to prevent large files

    # Metadata
    width = Column(Integer, nullable=True)   # Original image width
    height = Column(Integer, nullable=True)  # Original image height
    file_size = Column(Integer, nullable=True)  # Original file size in bytes

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship back to Post
    post = relationship("Post", back_populates="images")

    def __repr__(self):
        return f"<PostImage(id={self.id}, post_id={self.post_id}, position={self.position})>"


# Performance index for fetching images by post in order
Index('idx_post_images_post_position', PostImage.post_id, PostImage.position)
