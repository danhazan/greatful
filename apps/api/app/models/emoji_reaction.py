"""
EmojiReaction model for handling positive emoji reactions on posts.
"""

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class EmojiReaction(Base):
    """
    EmojiReaction model for storing user emoji reactions on posts.
    
    Supports 8 positive emotions: heart_eyes, hug, pray, muscle, star, fire, heart_face, clap
    Corresponding to emojis: 😍, 🤗, 🙏, 💪, 🌟, 🔥, 🥰, 👏
    """
    __tablename__ = "emoji_reactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    emoji_code = Column(String(20), nullable=False)  # 'heart_eyes', 'pray', 'star', etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Ensure one reaction per user per post
    __table_args__ = (
        UniqueConstraint('user_id', 'post_id', name='unique_user_post_reaction'),
    )

    # Valid emoji codes mapping to actual emojis
    VALID_EMOJIS = {
        'heart_eyes': '😍',
        'hug': '🤗', 
        'pray': '🙏',
        'muscle': '💪',
        'star': '🌟',
        'fire': '🔥',
        'heart_face': '🥰',
        'clap': '👏'
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