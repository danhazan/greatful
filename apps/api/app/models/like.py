"""
Like model for handling heart reactions on posts.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Like(Base):
    """
    Like model for storing user heart reactions on posts.
    
    This is separate from emoji reactions - hearts are a distinct interaction type.
    """
    __tablename__ = "likes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Ensure one heart per user per post
    __table_args__ = (
        UniqueConstraint('user_id', 'post_id', name='unique_user_post_like'),
    )

    def __repr__(self):
        return f"<Like(user_id={self.user_id}, post_id={self.post_id})>"

    # Relationships
    user = relationship("User", backref="likes")
    post = relationship("Post", backref="likes")