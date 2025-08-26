"""
Notification model for handling user notifications.
"""

import datetime
import uuid

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Integer, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


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
    
    # Batching fields
    parent_id = Column(String, ForeignKey("notifications.id"), nullable=True, index=True)
    is_batch = Column(Boolean, default=False, nullable=False)
    batch_count = Column(Integer, default=1, nullable=False)
    batch_key = Column(String, nullable=True, index=True)  # For grouping similar notifications
    last_updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC).replace(tzinfo=None), nullable=False)  # Track when notification was last updated

    # Relationships (using string references to avoid circular imports)
    user = relationship("User", back_populates="notifications")
    parent = relationship("Notification", remote_side=[id], back_populates="children")
    children = relationship("Notification", back_populates="parent", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type})>"

    def mark_as_read(self):
        """Mark notification as read."""
        self.read = True
        self.read_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)

    def generate_batch_key(self) -> str:
        """Generate a key for grouping similar notifications."""
        data = self.data or {}
        if self.type == 'emoji_reaction':
            return f"emoji_reaction_{self.user_id}_{data.get('post_id')}"
        elif self.type == 'like':
            return f"like_{self.user_id}_{data.get('post_id')}"
        elif self.type == 'new_follower':
            return f"new_follower_{self.user_id}"
        elif self.type == 'post_shared':
            return f"post_shared_{self.user_id}_{data.get('post_id')}"
        elif self.type == 'mention':
            return f"mention_{self.user_id}_{data.get('post_id')}"
        else:
            return f"{self.type}_{self.user_id}"

    def create_batch_summary(self, count: int) -> tuple[str, str]:
        """Create batch summary title and message."""
        if self.type == 'emoji_reaction':
            data = self.data or {}
            emoji_display = {
                'heart_eyes': '😍',
                'hugs': '🤗', 
                'pray': '🙏',
                'muscle': '💪',
                'star': '🌟',
                'fire': '🔥',
                'heart_face': '🥰',
                'clap': '👏'
            }.get(data.get('emoji_code', ''), '😊')
            
            if count == 1:
                return "New Reaction", f"{data.get('reactor_username')} reacted with {emoji_display} to your post"
            else:
                return "New Reactions", f"{count} people reacted to your post"
        elif self.type == 'like':
            data = self.data or {}
            if count == 1:
                return "New Like", f"{data.get('liker_username')} liked your post"
            else:
                return "New Likes", f"{count} people liked your post"
        elif self.type == 'new_follower':
            data = self.data or {}
            if count == 1:
                return "New Follower", f"{data.get('follower_username')} started following you"
            else:
                return "New Followers", f"{count} people started following you"
        elif self.type == 'post_shared':
            data = self.data or {}
            if count == 1:
                return "Post Shared", f"{data.get('sharer_username')} shared your post"
            else:
                return "Post Shared", f"Your post was shared {count} times"
        elif self.type == 'mention':
            data = self.data or {}
            if count == 1:
                return "You were mentioned", f"{data.get('author_username')} mentioned you in a post"
            else:
                return "You were mentioned", f"You were mentioned in {count} posts"
        else:
            return self.title, self.message

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
        
        notification = cls(
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
        notification.batch_key = notification.generate_batch_key()
        return notification