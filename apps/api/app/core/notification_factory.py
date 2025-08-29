"""
Notification Factory - Centralized notification creation to prevent common issues.

This factory eliminates the need for developers to remember notification creation patterns
and prevents static/instance method conflicts that cause notifications to fail silently.
"""

import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.notification_repository import NotificationRepository

logger = logging.getLogger(__name__)


class NotificationFactory:
    """
    Centralized factory for creating notifications with consistent patterns.
    
    This factory:
    1. Prevents static/instance method conflicts
    2. Provides a simple, consistent API
    3. Handles all boilerplate (logging, error handling, etc.)
    4. Ensures notifications are created successfully
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_repo = NotificationRepository(db)
    
    async def create_notification(
        self,
        user_id: int,
        notification_type: str,
        title: str,
        message: str,
        data: Dict[str, Any],
        prevent_self_notification: bool = True,
        self_user_id: Optional[int] = None
    ) -> Optional[Any]:
        """
        Create a notification with standardized error handling and logging.
        
        Args:
            user_id: ID of user to notify
            notification_type: Type of notification (e.g., 'post_shared', 'mention', etc.)
            title: Notification title
            message: Notification message
            data: Additional data (must include username field)
            prevent_self_notification: Whether to prevent self-notifications
            self_user_id: ID of user performing the action (for self-notification check)
            
        Returns:
            Created notification or None if prevented/failed
        """
        try:
            # Prevent self-notifications if requested
            if prevent_self_notification and self_user_id and user_id == self_user_id:
                logger.debug(f"Prevented self-notification for user {user_id}")
                return None
            
            # Create the notification
            created_notification = await self.notification_repo.create(
                user_id=user_id,
                type=notification_type,
                title=title,
                message=message,
                data=data
            )
            
            logger.info(f"Created {notification_type} notification for user {user_id}")
            return created_notification
            
        except Exception as e:
            logger.error(f"Failed to create {notification_type} notification for user {user_id}: {e}")
            # Don't raise exception to avoid breaking the main flow
            return None
    
    # Convenience methods for common notification types
    
    async def create_share_notification(
        self,
        recipient_id: int,
        sharer_username: str,
        post_id: str,
        share_method: str = "message"
    ) -> Optional[Any]:
        """Create a share notification."""
        if share_method == "message":
            title = "Post Sent"
            message = f'{sharer_username} sent you a post'
        else:
            title = "Post Shared"
            message = f'{sharer_username} shared your post'
        
        return await self.create_notification(
            user_id=recipient_id,
            notification_type='post_shared',
            title=title,
            message=message,
            data={
                'post_id': post_id,
                'sharer_username': sharer_username,
                'share_method': share_method
            },
            prevent_self_notification=False  # Share notifications don't need self-prevention
        )
    
    async def create_mention_notification(
        self,
        mentioned_user_id: int,
        author_username: str,
        author_id: int,
        post_id: str,
        post_preview: str
    ) -> Optional[Any]:
        """Create a mention notification."""
        return await self.create_notification(
            user_id=mentioned_user_id,
            notification_type='mention',
            title='You were mentioned',
            message=f'{author_username} mentioned you in a post: {post_preview[:50]}...',
            data={
                'post_id': post_id,
                'author_username': author_username,
                'post_preview': post_preview
            },
            prevent_self_notification=True,
            self_user_id=author_id
        )
    
    async def create_reaction_notification(
        self,
        post_author_id: int,
        reactor_username: str,
        reactor_id: int,
        post_id: str,
        emoji_code: str
    ) -> Optional[Any]:
        """Create a reaction notification."""
        return await self.create_notification(
            user_id=post_author_id,
            notification_type='emoji_reaction',
            title='New Reaction',
            message=f'{reactor_username} reacted to your post with {emoji_code}',
            data={
                'post_id': post_id,
                'reactor_username': reactor_username,
                'emoji_code': emoji_code
            },
            prevent_self_notification=True,
            self_user_id=reactor_id
        )
    
    async def create_like_notification(
        self,
        post_author_id: int,
        liker_username: str,
        liker_id: int,
        post_id: str
    ) -> Optional[Any]:
        """Create a like notification."""
        return await self.create_notification(
            user_id=post_author_id,
            notification_type='like',
            title='New Like',
            message=f'{liker_username} liked your post',
            data={
                'post_id': post_id,
                'liker_username': liker_username
            },
            prevent_self_notification=True,
            self_user_id=liker_id
        )
    
    async def create_follow_notification(
        self,
        followed_user_id: int,
        follower_username: str,
        follower_id: int
    ) -> Optional[Any]:
        """Create a follow notification."""
        return await self.create_notification(
            user_id=followed_user_id,
            notification_type='follow',
            title='New Follower',
            message=f'{follower_username} started following you',
            data={
                'follower_username': follower_username,
                'follower_id': follower_id
            },
            prevent_self_notification=True,
            self_user_id=follower_id
        )