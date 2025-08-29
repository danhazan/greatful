"""
Follow model for handling user follow relationships.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class Follow(Base):
    """
    Follow model for storing user follow relationships.
    
    Represents a follower -> followed relationship between users.
    """
    __tablename__ = "follows"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    followed_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="active", nullable=False)  # 'active', 'pending', 'blocked'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Constraints
    __table_args__ = (
        UniqueConstraint('follower_id', 'followed_id', name='unique_follower_followed'),
        CheckConstraint('follower_id != followed_id', name='no_self_follow'),
    )

    def __repr__(self):
        return f"<Follow(follower_id={self.follower_id}, followed_id={self.followed_id}, status={self.status})>"

    # Relationships
    follower = relationship("User", foreign_keys=[follower_id], backref="following_relationships")
    followed = relationship("User", foreign_keys=[followed_id], backref="follower_relationships")