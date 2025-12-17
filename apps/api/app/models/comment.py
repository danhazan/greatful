"""
Comment model for handling comments and replies on posts.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class Comment(Base):
    """
    Comment model for storing user comments on posts.
    
    Supports threaded comments with parent-child relationships for replies.
    Content supports emojis and Unicode characters (PostgreSQL text fields natively support Unicode).
    """
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_comment_id = Column(String, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    edited_at = Column(DateTime(timezone=True), nullable=True)  # Tracks when comment content was edited by user

    # Constraints
    __table_args__ = (
        # Check constraint for content length (1-500 characters)
        CheckConstraint('LENGTH(content) >= 1 AND LENGTH(content) <= 500', name='check_content_length'),
        # Composite index for efficient post comment retrieval (ordered by creation time)
        Index('idx_comments_post_created', 'post_id', 'created_at'),
    )

    def __repr__(self):
        return f"<Comment(id={self.id}, post_id={self.post_id}, user_id={self.user_id})>"

    # Relationships
    user = relationship("User", backref="comments")
    post = relationship("Post", backref="comments")
    
    # Self-referential relationship for replies
    parent_comment = relationship("Comment", remote_side=[id], backref="replies")
