"""
Notification model for handling user notifications.
"""

import datetime
import uuid
from datetime import timezone

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
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    read_at = Column(DateTime, nullable=True)
    
    # Batching fields
    parent_id = Column(String, ForeignKey("notifications.id"), nullable=True, index=True)
    is_batch = Column(Boolean, default=False, nullable=False)
    batch_count = Column(Integer, default=1, nullable=False)
    batch_key = Column(String, nullable=True, index=True)  # For grouping similar notifications
    last_updated_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)  # Track when notification was last updated

    # Relationships (using string references to avoid circular imports)
    user = relationship("User", back_populates="notifications")
    parent = relationship("Notification", remote_side=[id], back_populates="children")
    children = relationship("Notification", back_populates="parent", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type})>"

    def mark_as_read(self):
        """Mark notification as read."""
        self.read = True
        self.read_at = datetime.datetime.now(timezone.utc).replace(tzinfo=None)

    def generate_batch_key(self) -> str:
        """Generate a key for grouping similar notifications using new generic format."""
        data = self.data or {}
        
        # Post-based notifications
        if self.type in ['emoji_reaction', 'post_shared', 'mention', 'post_interaction']:
            post_id = data.get('post_id')
            if post_id:
                return f"{self.type}:post:{post_id}"
            else:
                # Fallback to old format if no post_id
                return f"{self.type}_{self.user_id}"
        
        # User-based notifications  
        elif self.type == 'follow':
            return f"{self.type}:user:{self.user_id}"
        
        # Default format for unknown types
        else:
            return f"{self.type}_{self.user_id}"

    def create_batch_summary(self, count: int) -> tuple[str, str]:
        """Create batch summary title and message."""
        if self.type == 'emoji_reaction':
            data = self.data or {}
            from app.core.notification_formatters import format_reaction_notification
            title, message = format_reaction_notification(
                data.get('emoji_code', ''),
                data.get('object_type', 'post')
            )
            
            if count == 1:
                return title, message
            else:
                return "New Reactions", f"{count} people reacted to your post"
        elif self.type == 'post_interaction':
            # Combined likes and reactions
            if count == 1:
                return "New Engagement 💜", "Someone engaged with your post 💜"
            else:
                return "New Engagement 💜", f"{count} people engaged with your post 💜"
        elif self.type == 'follow':
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
        from app.core.notification_formatters import format_reaction_notification
        title, message = format_reaction_notification(emoji_code, 'post')
        
        notification = cls(
            user_id=user_id,
            type='emoji_reaction',
            title=title,
            message=message,
            data={
                'post_id': post_id,
                'object_type': 'post',
                'object_id': post_id,
                'target': 'post',
                'emoji_code': emoji_code,
                'reactor_username': reactor_username
            }
        )
        notification.batch_key = notification.generate_batch_key()
        return notification

    @classmethod
    def create_mention_notification(
        cls,
        user_id: int,
        author_username: str,
        post_id: str,
        post_preview: str
    ) -> "Notification":
        """Create a notification for mention."""
        # Import here to avoid circular imports
        from app.core.notification_factory import _strip_html_tags
        
        # Strip HTML from post preview for clean notification text
        plain_text_preview = _strip_html_tags(post_preview)
        
        notification = cls(
            user_id=user_id,
            type='mention',
            title='You were mentioned',
            message=f'{author_username} mentioned you in a post: {plain_text_preview[:50]}...',
            data={
                'post_id': post_id,
                'author_username': author_username,
                'post_preview': plain_text_preview
            }
        )
        notification.batch_key = notification.generate_batch_key()
        return notification
