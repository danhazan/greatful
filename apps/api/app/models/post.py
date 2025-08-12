"""
Post model for gratitude posts.
"""

from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid

class PostType(str, enum.Enum):
    DAILY = "daily"
    PHOTO = "photo"
    SPONTANEOUS = "spontaneous"

class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    post_type = Column(Enum(PostType, name="posttype", schema="public"), default=PostType.DAILY, nullable=False)
    image_url = Column(String, nullable=True)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Post(id={self.id}, author_id={self.author_id}, type={self.post_type})>" 

    # Relationships
    author = relationship("User", back_populates="posts")