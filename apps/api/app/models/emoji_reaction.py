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
    emoji_code = Column(String(20), nullable=False)  # 'heart_eyes', 'pray', 'star', etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Ensure one reaction per user per specific object
    __table_args__ = (
        UniqueConstraint('user_id', 'object_type', 'object_id', name='unique_user_object_reaction'),
        Index('idx_emoji_reactions_post_object', 'post_id', 'object_type', 'object_id'),
    )

    # Valid emoji codes mapping to actual emojis
    # Expanded set with 56 positive emojis organized by category
    # Note: Database CHECK constraint is NOT updated - Python validation is sufficient
    VALID_EMOJIS = {
        # Row 1 - Original emojis
        'heart': '💜',           # Purple heart (unified with likes)
        'heart_eyes': '😍',      # Heart eyes
        'hug': '🤗',             # Hug
        'touched': '🥹',         # Touched/emotional - Position 4 "Grateful" (bug fix)
        'muscle': '💪',          # Muscle/strength
        'grateful': '🙏',        # Grateful hands - Position 6 "Thankful"
        'praise': '🙌',          # Praise hands
        'clap': '👏',            # Clap

        # Row 2 - Love/Warmth
        'star': '⭐',
        'fire': '🔥',
        'sparkles': '✨',
        'heart_face': '🥰',
        'sparkling_heart': '💖',
        'gift_heart': '💝',
        'two_hearts': '💕',
        'growing_heart': '💗',

        # Row 3 - Joy/Celebration
        'party': '🎉',
        'confetti': '🎊',
        'partying_face': '🥳',
        'blush': '😊',
        'grinning': '😄',
        'beaming': '😁',
        'starstruck': '🤩',
        'smile': '🙂',

        # Row 4 - Encouragement
        'hundred': '💯',
        'trophy': '🏆',
        'glowing_star': '🌟',
        'crown': '👑',
        'gem': '💎',
        'bullseye': '🎯',
        'check': '✅',
        'dizzy': '💫',

        # Row 5 - Nature/Peace
        'rainbow': '🌈',
        'sunflower': '🌻',
        'cherry_blossom': '🌸',
        'four_leaf_clover': '🍀',
        'hibiscus': '🌺',
        'tulip': '🌷',
        'blossom': '🌼',
        'butterfly': '🦋',

        # Row 6 - Affection
        'heart_hands': '🫶',
        'handshake': '🤝',
        'open_hands': '👐',
        'hugging_people': '🫂',
        'bouquet': '💐',
        'gift': '🎁',
        'dove': '🕊️',
        'sun': '☀️',

        # Row 7 - Expressions
        'innocent': '😇',
        'holding_back_tears': '🥲',
        'relieved': '😌',
        'face_with_hand': '🤭',
        'cool': '😎',
        'warm_hug': '🤗',
        'yum': '😋',
        'salute': '🫡',

        # Legacy codes for backward compatibility with existing reactions
        'pray': '🙏',            # Keep for existing reactions using 'pray' code
    }

    def __repr__(self):
        return f"<EmojiReaction(user_id={self.user_id}, post_id={self.post_id}, emoji={self.emoji_code})>"

    @property
    def emoji_display(self):
        """Get the actual emoji character for display."""
        return self.VALID_EMOJIS.get(self.emoji_code, '❓')

    @classmethod
    def is_valid_emoji(cls, emoji_code: str) -> bool:
        """Check if the emoji code is valid."""
        return emoji_code in cls.VALID_EMOJIS

    # Relationships
    user = relationship("User", backref="emoji_reactions")
    post = relationship("Post", backref="emoji_reactions")