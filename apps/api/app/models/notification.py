"""
Notification model for handling user notifications.
"""

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Integer, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime
import uuid


class Notification(Base):
    """Model for user notifications."""
    
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # 'emoji_reaction', 'post_shared', 'mention', 'new_follower'
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)  # Additional data like post_id, emoji_code, etc.
    read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC).replace(tzinfo=None), nullable=False)
    read_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type})>"

    def mark_as_read(self):
        """Mark notification as read."""
        self.read = True
        self.read_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)

    @classmethod
    def create_emoji_reaction_notification(
        cls, 
        user_id: int, 
        reactor_username: str, 
        emoji_code: str, 
        post_id: str
    ) -> "Notification":
        """Create a notification for emoji reaction."""
        emoji_display = {
            'heart_eyes': '😍',
            'hugs': '🤗', 
            'pray': '🙏',
            'muscle': '💪',
            'star': '🌟',
            'fire': '🔥',
            'heart_face': '🥰',
            'clap': '👏'
        }.get(emoji_code, '😊')
        
        return cls(
            user_id=user_id,
            type='emoji_reaction',
            title='New Reaction',
            message=f'{reactor_username} reacted with {emoji_display} to your post',
            data={
                'post_id': post_id,
                'emoji_code': emoji_code,
                'reactor_username': reactor_username
            }
        )