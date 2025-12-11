"""
Notification Factory - Centralized notification creation with generic batching support.

This factory eliminates the need for developers to remember notification creation patterns
and prevents static/instance method conflicts that cause notifications to fail silently.
Now includes generic batching system for all notification types.
"""

import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.notification_repository import NotificationRepository
from app.core.notification_batcher import NotificationBatcher, PostInteractionBatcher, UserInteractionBatcher

logger = logging.getLogger(__name__)


class NotificationFactory:
    """
    Centralized factory for creating notifications with consistent patterns and batching.
    
    This factory:
    1. Prevents static/instance method conflicts
    2. Provides a simple, consistent API
    3. Handles all boilerplate (logging, error handling, etc.)
    4. Ensures notifications are created successfully
    5. Implements generic batching for all notification types
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_repo = NotificationRepository(db)
        self.batcher = NotificationBatcher(db)
        self.post_interaction_batcher = PostInteractionBatcher(db)
        self.user_interaction_batcher = UserInteractionBatcher(db)
    
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
        sharer_id: int,
        post_id: str,
        share_method: str = "message"
    ) -> Optional[Any]:
        """Create a share notification with batching support."""
        try:
            if share_method == "message":
                title = "Post Sent"
                message = 'sent you a post'
            else:
                title = "Post Shared"
                message = 'shared your post'
            
            # Create notification object for batching
            from app.models.notification import Notification
            notification = Notification(
                user_id=recipient_id,
                type='post_shared',
                title=title,
                message=message,
                data={
                    'post_id': post_id,
                    'sharer_username': sharer_username,
                    'share_method': share_method,
                    'actor_user_id': str(sharer_id),
                    'actor_username': sharer_username
                }
            )
            
            # Use generic batcher for share notifications
            result = await self.batcher.create_or_update_batch(notification)
            
            logger.info(f"Created post_shared notification for user {recipient_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to create post_shared notification for user {recipient_id}: {e}")
            return None
    
    async def create_mention_notification(
        self,
        mentioned_user_id: int,
        author_username: str,
        author_id: int,
        post_id: str
    ) -> Optional[Any]:
        """Create a mention notification with batching support."""
        # Prevent self-notifications
        if mentioned_user_id == author_id:
            logger.debug(f"Prevented self-notification for user {mentioned_user_id}")
            return None
        
        try:
            # Create notification object for batching
            from app.models.notification import Notification
            notification = Notification(
                user_id=mentioned_user_id,
                type='mention',
                title='You were mentioned',
                message='mentioned you in a post',
                data={
                    'post_id': post_id,
                    'author_username': author_username,
                    'actor_user_id': str(author_id),
                    'actor_username': author_username
                }
            )
            
            # Use generic batcher for mention notifications
            result = await self.batcher.create_or_update_batch(notification)
            
            logger.info(f"Created mention notification for user {mentioned_user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to create mention notification for user {mentioned_user_id}: {e}")
            return None
    
    async def create_reaction_notification(
        self,
        post_author_id: int,
        reactor_username: str,
        reactor_id: int,
        post_id: str,
        emoji_code: str
    ) -> Optional[Any]:
        """Create a reaction notification with batching support."""
        # Prevent self-notifications
        if post_author_id == reactor_id:
            logger.debug(f"Prevented self-notification for user {post_author_id}")
            return None
        
        try:
            # Use the post interaction batcher for emoji reactions
            result = await self.post_interaction_batcher.create_interaction_notification(
                notification_type="emoji_reaction",
                post_id=post_id,
                user_id=post_author_id,
                actor_data={
                    "user_id": reactor_id,
                    "username": reactor_username,
                    "emoji_code": emoji_code
                }
            )
            
            logger.info(f"Created emoji_reaction notification for user {post_author_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to create emoji_reaction notification for user {post_author_id}: {e}")
            return None
    
    async def create_like_notification(
        self,
        post_author_id: int,
        liker_username: str,
        liker_id: int,
        post_id: str
    ) -> Optional[Any]:
        """Create a like notification by calling create_reaction_notification with 'heart' emoji."""
        # Leverage existing unified batching system by treating likes as heart reactions
        return await self.create_reaction_notification(
            post_author_id=post_author_id,
            reactor_username=liker_username,
            reactor_id=liker_id,
            post_id=post_id,
            emoji_code="heart"
        )
    
    async def create_follow_notification(
        self,
        followed_user_id: int,
        follower_username: str,
        follower_id: int
    ) -> Optional[Any]:
        """Create a follow notification with batching support."""
        # Prevent self-notifications
        if followed_user_id == follower_id:
            logger.debug(f"Prevented self-notification for user {followed_user_id}")
            return None
        
        try:
            # Use the user interaction batcher for follows
            result = await self.user_interaction_batcher.create_user_notification(
                notification_type="follow",
                target_user_id=followed_user_id,
                actor_data={
                    "user_id": follower_id,
                    "username": follower_username
                }
            )
            
            logger.info(f"Created follow notification for user {followed_user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to create follow notification for user {followed_user_id}: {e}")
            return None
    
    async def create_comment_notification(
        self,
        post_author_id: int,
        commenter_username: str,
        commenter_id: int,
        post_id: str,
        comment_id: str
    ) -> Optional[Any]:
        """Create a comment notification with batching support."""
        # Prevent self-notifications
        if post_author_id == commenter_id:
            logger.debug(f"Prevented self-notification for user {post_author_id}")
            return None
        
        try:
            # Create notification object for batching
            from app.models.notification import Notification
            notification = Notification(
                user_id=post_author_id,
                type='comment_on_post',
                title='New Comment',
                message='commented on your post',
                data={
                    'post_id': post_id,
                    'comment_id': comment_id,
                    'actor_user_id': str(commenter_id),
                    'actor_username': commenter_username
                }
            )
            
            # Use generic batcher for comment notifications
            result = await self.batcher.create_or_update_batch(notification)
            
            logger.info(f"Created comment_on_post notification for user {post_author_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to create comment_on_post notification for user {post_author_id}: {e}")
            return None
    
    async def create_comment_reply_notification(
        self,
        comment_author_id: int,
        replier_username: str,
        replier_id: int,
        post_id: str,
        comment_id: str,
        parent_comment_id: str
    ) -> Optional[Any]:
        """Create a comment reply notification with batching support."""
        # Prevent self-notifications
        if comment_author_id == replier_id:
            logger.debug(f"Prevented self-notification for user {comment_author_id}")
            return None
        
        try:
            # Create notification object for batching
            from app.models.notification import Notification
            notification = Notification(
                user_id=comment_author_id,
                type='comment_reply',
                title='New Reply',
                message='replied to your comment',
                data={
                    'post_id': post_id,
                    'comment_id': comment_id,
                    'parent_comment_id': parent_comment_id,
                    'actor_user_id': str(replier_id),
                    'actor_username': replier_username
                }
            )
            
            # Use generic batcher for comment reply notifications
            result = await self.batcher.create_or_update_batch(notification)
            
            logger.info(f"Created comment_reply notification for user {comment_author_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to create comment_reply notification for user {comment_author_id}: {e}")
            return None