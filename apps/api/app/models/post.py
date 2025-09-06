"""
Post model for gratitude posts.
"""

from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
import enum
import uuid

class PostType(str, enum.Enum):
    daily = "daily"
    photo = "photo"
    spontaneous = "spontaneous"

class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    post_type = Column(Enum(PostType, name="posttype", schema="public"), default=PostType.daily, nullable=False)
    image_url = Column(String, nullable=True)
    location = Column(String, nullable=True)  # Keep for backward compatibility
    location_data = Column(JSON, nullable=True)  # New structured location data (JSON for SQLite compatibility)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Engagement count columns for performance optimization
    hearts_count = Column(Integer, nullable=False, server_default="0")
    reactions_count = Column(Integer, nullable=False, server_default="0")
    shares_count = Column(Integer, nullable=False, server_default="0")

    def __repr__(self):
        return f"<Post(id={self.id}, author_id={self.author_id}, type={self.post_type})>" 

    # Relationships
    author = relationship("User", back_populates="posts")