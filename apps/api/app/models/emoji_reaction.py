"""
EmojiReaction model for handling positive emoji reactions on posts.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid

class ObjectType(str, enum.Enum):
    post = "post"
    image = "image"
    comment = "comment"

class EmojiReaction(Base):
    """
    EmojiReaction model for storing user emoji reactions on posts.

    Supports 56 positive emoji reactions organized in 7 rows:
    - Row 1: Heart, Love it, Hug, Grateful, Strong, Thankful, Praise, Applause
    - Row 2-7: Additional love, celebration, encouragement, nature, affection, expression emojis

    The 'heart' emoji_code represents the unified heart/like system (purple heart 💜).
    Validation is done in Python via VALID_EMOJIS dict (database CHECK constraint not updated).
    """
    __tablename__ = "emoji_reactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    object_type = Column(
        SQLEnum(ObjectType),
        nullable=False,
        default=ObjectType.post,
        server_default="post"
    )
    object_id = Column(String, nullable=True)  # Populated via backfill or upon creation
    emoji_code = Column(String(50), nullable=False)  # 'heart_eyes', 'pray', 'star', etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Ensure one reaction per user per specific object
    __table_args__ = (
        UniqueConstraint('user_id', 'object_type', 'object_id', name='unique_user_object_reaction'),
        Index('idx_emoji_reactions_post_object', 'post_id', 'object_type', 'object_id'),
    )

    from app.generated.reactions import VALID_EMOJIS, LEGACY_MAPPINGS

    def __repr__(self):
        return f"<EmojiReaction(user_id={self.user_id}, post_id={self.post_id}, emoji={self.emoji_code})>"

    @property
    def emoji_display(self):
        """Get the actual emoji character for display."""
        # Use imported VALID_EMOJIS
        from app.generated.reactions import VALID_EMOJIS
        return VALID_EMOJIS.get(self.emoji_code, '❓')

    @classmethod
    def is_valid_emoji(cls, emoji_code: str) -> bool:
        """Check if the emoji code is valid."""
        from app.generated.reactions import VALID_EMOJIS
        return emoji_code in VALID_EMOJIS

    # Relationships
    user = relationship("User", backref="emoji_reactions")
    post = relationship("Post", backref="emoji_reactions")