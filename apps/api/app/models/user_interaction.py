"""
User interaction tracking model for preference learning.
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class UserInteraction(Base):
    """
    Track user interactions for preference learning and diversity control.
    
    This model tracks various types of interactions between users to build
    preference profiles for personalized feed ranking.
    """
    __tablename__ = "user_interactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # User who performed the interaction
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # User who was interacted with (post author, mentioned user, etc.)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Type of interaction: 'heart', 'reaction', 'share', 'mention', 'follow'
    interaction_type = Column(String(20), nullable=False)
    
    # Related post ID (if applicable)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=True)
    
    # Interaction weight/score for preference calculation
    weight = Column(Float, default=1.0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="interactions_given")
    target_user = relationship("User", foreign_keys=[target_user_id], back_populates="interactions_received")
    post = relationship("Post", back_populates="user_interactions")

    # Indexes for efficient querying
    __table_args__ = (
        Index('idx_user_interactions_user_id', 'user_id'),
        Index('idx_user_interactions_target_user_id', 'target_user_id'),
        Index('idx_user_interactions_type', 'interaction_type'),
        Index('idx_user_interactions_created_at', 'created_at'),
        Index('idx_user_interactions_user_target', 'user_id', 'target_user_id'),
        Index('idx_user_interactions_user_type', 'user_id', 'interaction_type'),
    )

    def __repr__(self):
        return f"<UserInteraction(id={self.id}, user_id={self.user_id}, target_user_id={self.target_user_id}, type={self.interaction_type})>"