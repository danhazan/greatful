"""
Mention model for handling @username mentions in posts.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Mention(Base):
    """
    Mention model for storing @username mentions in posts.
    
    Tracks when users are mentioned in posts to enable notifications
    and mention-based interactions.
    """
    __tablename__ = "mentions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mentioned_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Ensure one mention per user per post
    __table_args__ = (
        UniqueConstraint('post_id', 'mentioned_user_id', name='unique_post_mentioned_user'),
    )

    def __repr__(self):
        return f"<Mention(post_id={self.post_id}, author_id={self.author_id}, mentioned_user_id={self.mentioned_user_id})>"

    # Relationships
    post = relationship("Post", backref="mentions")
    author = relationship("User", foreign_keys=[author_id], backref="authored_mentions")
    mentioned_user = relationship("User", foreign_keys=[mentioned_user_id], backref="received_mentions")