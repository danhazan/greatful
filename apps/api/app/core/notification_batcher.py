"""
Generic Notification Batching System

This module provides a generic, reusable notification batching system that can handle
various notification types and scopes (post-based and user-based).
"""

import datetime
import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.notification_repository import NotificationRepository
from app.models.notification import Notification

logger = logging.getLogger(__name__)


@dataclass
class BatchConfig:
    """Configuration for notification batching behavior."""
    notification_type: str
    batch_scope: str  # "post" or "user"
    max_age_hours: int = 24
    batch_window_minutes: int = 60
    summary_template: str = "{count} interactions"
    icon_type: str = "notification"
    max_batch_size: int = 10


# Predefined batch configurations
BATCH_CONFIGS: Dict[str, BatchConfig] = {
    "emoji_reaction": BatchConfig(
        notification_type="emoji_reaction",
        batch_scope="post",
        summary_template="{count} people reacted to your post",
        icon_type="reaction"
    ),
    "like": BatchConfig(
        notification_type="like", 
        batch_scope="post",
        summary_template="{count} people liked your post",
        icon_type="heart"
    ),
    "post_interaction": BatchConfig(  # Combined likes + reactions
        notification_type="post_interaction",
        batch_scope="post", 
        summary_template="{count} people engaged with your post",
        icon_type="engagement"
    ),
    "follow": BatchConfig(  # User-based batching (Post-MVP)
        notification_type="follow",
        batch_scope="user",
        summary_template="{count} people started following you",
        icon_type="follow",
        batch_window_minutes=60,
        max_batch_size=10
    ),
    "post_shared": BatchConfig(
        notification_type="post_shared",
        batch_scope="post",
        summary_template="Your post was shared {count} times",
        icon_type="share"
    ),
    "mention": BatchConfig(
        notification_type="mention",
        batch_scope="post",
        summary_template="You were mentioned in {count} posts",
        icon_type="mention"
    )
}


class NotificationBatcher:
    """Generic notification batching system."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_repo = NotificationRepository(db)    

    def generate_batch_key(
        self,
        notification_type: str,
        target_id: str,  # post_id or user_id
        batch_scope: str = "post"  # "post" or "user"
    ) -> str:
        """Generate standardized batch key."""
        return f"{notification_type}:{batch_scope}:{target_id}"
    
    async def create_or_update_batch(
        self,
        notification: Notification,
        batch_config: Optional[BatchConfig] = None
    ) -> Optional[Notification]:
        """
        Create new notification or add to existing batch.
        
        Args:
            notification: The notification to create or batch
            batch_config: Optional batch configuration (uses default if None)
            
        Returns:
            Optional[Notification]: The created/updated notification or None if rate limited
        """
        if batch_config is None:
            batch_config = BATCH_CONFIGS.get(notification.type)
            
        if not batch_config:
            # No batching config, create as single notification
            return await self._create_single_notification(notification)
        
        # Generate batch key based on configuration
        if batch_config.batch_scope == "post":
            target_id = notification.data.get("post_id")
            if not target_id:
                # No post_id, create as single notification
                return await self._create_single_notification(notification)
        elif batch_config.batch_scope == "user":
            target_id = str(notification.user_id)
        else:
            # Unknown scope, create as single notification
            return await self._create_single_notification(notification)
        
        batch_key = self.generate_batch_key(
            notification.type, 
            target_id, 
            batch_config.batch_scope
        )
        notification.batch_key = batch_key
        
        # Check for existing batch
        existing_batch = await self.notification_repo.find_existing_batch(
            notification.user_id, 
            batch_key, 
            batch_config.max_age_hours
        )
        
        if existing_batch:
            return await self._add_to_existing_batch(existing_batch, notification, batch_config)
        
        # Check for existing single notification to convert to batch
        existing_single = await self.notification_repo.find_existing_single_notification(
            notification.user_id, 
            batch_key, 
            max_age_hours=1  # Only convert recent single notifications
        )
        
        if existing_single:
            return await self._convert_to_batch(existing_single, notification, batch_config)
        
        # Create new single notification
        return await self._create_single_notification(notification)
    
    async def _create_single_notification(self, notification: Notification) -> Notification:
        """Create a single notification."""
        created = await self.notification_repo.create(
            user_id=notification.user_id,
            type=notification.type,
            title=notification.title,
            message=notification.message,
            data=notification.data,
            batch_key=notification.batch_key
        )
        logger.info(f"Created single notification {created.id} for user {notification.user_id}")
        return created 
   
    async def _add_to_existing_batch(
        self, 
        batch_notification: Notification, 
        new_notification: Notification,
        batch_config: BatchConfig
    ) -> Notification:
        """Add a new notification to an existing batch."""
        # Increment batch count
        batch_notification.batch_count += 1
        
        # Update title and message using generic batch summary
        title, message = self._generate_batch_summary(
            batch_notification, 
            batch_notification.batch_count,
            batch_config
        )
        batch_notification.title = title
        batch_notification.message = message
        
        # Update last_updated_at to show latest activity
        batch_notification.last_updated_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        
        # Mark batch as unread when new notifications are added
        batch_notification.read = False
        batch_notification.read_at = None
        
        # Set the new notification as a child
        new_notification.parent_id = batch_notification.id
        
        # Save both notifications
        self.db.add(batch_notification)
        created_child = await self.notification_repo.create(
            user_id=new_notification.user_id,
            type=new_notification.type,
            title=new_notification.title,
            message=new_notification.message,
            data=new_notification.data,
            parent_id=batch_notification.id
        )
        
        await self.db.commit()
        await self.db.refresh(batch_notification)
        
        logger.info(f"Added notification to batch {batch_notification.id}, now has {batch_notification.batch_count} items")
        return created_child
    
    async def _convert_to_batch(
        self, 
        existing_notification: Notification, 
        new_notification: Notification,
        batch_config: BatchConfig
    ) -> Notification:
        """Convert an existing single notification to a batch by creating a dedicated batch notification."""
        # Generate batch summary for 2 items
        title, message = self._generate_batch_summary(
            existing_notification, 
            2,
            batch_config
        )
        
        # Create a new dedicated batch notification
        batch_notification = await self.notification_repo.create(
            user_id=existing_notification.user_id,
            type=existing_notification.type,
            title=title,
            message=message,
            data=existing_notification.data,  # Use same data as the original for context
            batch_key=existing_notification.batch_key,
            is_batch=True,
            batch_count=2,
            last_updated_at=datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        )
        
        # Update the existing notification to be a child of the batch
        existing_notification.parent_id = batch_notification.id
        self.db.add(existing_notification)
        
        # Create the new notification as a child of the batch
        created_child = await self.notification_repo.create(
            user_id=new_notification.user_id,
            type=new_notification.type,
            title=new_notification.title,
            message=new_notification.message,
            data=new_notification.data,
            parent_id=batch_notification.id
        )
        
        await self.db.commit()
        await self.db.refresh(batch_notification)
        
        logger.info(f"Created new batch notification {batch_notification.id} with 2 child items")
        return batch_notification    

    def _generate_batch_summary(
        self, 
        notification: Notification, 
        count: int,
        batch_config: BatchConfig
    ) -> tuple[str, str]:
        """Generate batch summary title and message using generic patterns."""
        if count == 1:
            # Single notification - use original title and message
            return notification.title, notification.message
        
        # Use notification model's existing batch summary logic for consistency
        return notification.create_batch_summary(count)


class PostInteractionBatcher(NotificationBatcher):
    """Specialized batcher for post interactions (likes + reactions)."""
    
    async def create_interaction_notification(
        self,
        notification_type: str,  # "like" or "emoji_reaction"
        post_id: str,
        user_id: int,
        actor_data: dict
    ) -> Optional[Notification]:
        """Create like or reaction notification with unified batching."""
        
        # Create the notification object
        if notification_type == "like":
            notification = Notification(
                user_id=user_id,
                type="like",
                title="New Like 💜",  # Purple heart styling
                message="liked your post 💜",  # Purple heart emoji added to match reaction styling
                data={
                    "post_id": post_id,
                    "liker_username": actor_data["username"],
                    "actor_user_id": str(actor_data["user_id"]),
                    "actor_username": actor_data["username"]
                }
            )
        elif notification_type == "emoji_reaction":
            from app.models.emoji_reaction import EmojiReaction
            emoji_display = EmojiReaction.VALID_EMOJIS.get(actor_data["emoji_code"], actor_data["emoji_code"])
            
            notification = Notification(
                user_id=user_id,
                type="emoji_reaction",
                title="New Reaction",
                message=f"reacted to your post with {emoji_display}",
                data={
                    "post_id": post_id,
                    "reactor_username": actor_data["username"],
                    "emoji_code": actor_data["emoji_code"],
                    "actor_user_id": str(actor_data["user_id"]),
                    "actor_username": actor_data["username"]
                }
            )
        else:
            raise ValueError(f"Unsupported interaction type: {notification_type}")
        
        # Use unified batch key for all post interactions from the start
        batch_key = self.generate_batch_key("post_interaction", post_id, "post")
        notification.batch_key = batch_key
        
        # Check for existing combined batch
        existing_batch = await self.notification_repo.find_existing_batch(
            notification.user_id, 
            batch_key, 
            24  # 24 hour window for batching
        )
        
        if existing_batch:
            return await self._add_to_combined_batch(existing_batch, notification)
        
        # Check for existing single notification of any interaction type to convert to batch
        existing_single = await self._find_existing_interaction_notification(
            notification.user_id, 
            post_id
        )
        
        if existing_single:
            return await self._convert_to_combined_batch(existing_single, notification)
        
        # Create new single notification
        return await self._create_single_notification(notification)
    
    async def _create_combined_interaction_batch(
        self,
        notification: Notification,
        post_id: str
    ) -> Optional[Notification]:
        """Create or update combined batch for likes and reactions on the same post."""
        
        # Use unified batch key for all post interactions
        batch_key = self.generate_batch_key("post_interaction", post_id, "post")
        notification.batch_key = batch_key
        
        logger.info(f"Creating combined interaction batch with key: {batch_key} for user {notification.user_id}")
        
        # Check for existing combined batch
        existing_batch = await self.notification_repo.find_existing_batch(
            notification.user_id, 
            batch_key, 
            24  # 24 hour window for batching
        )
        
        if existing_batch:
            logger.info(f"Found existing combined batch {existing_batch.id}, adding to it")
            return await self._add_to_combined_batch(existing_batch, notification)
        
        # Check for existing single notification of any interaction type to convert to batch
        existing_single = await self._find_existing_interaction_notification(
            notification.user_id, 
            post_id
        )
        
        if existing_single:
            logger.info(f"Found existing single notification {existing_single.id} of type {existing_single.type}, converting to combined batch")
        else:
            logger.info(f"No existing single notification found, creating new single notification")
        
        if existing_single:
            return await self._convert_to_combined_batch(existing_single, notification)
        
        # Create new single notification
        return await self._create_single_notification(notification)
    
    async def _find_existing_interaction_notification(
        self,
        user_id: int,
        post_id: str
    ) -> Optional[Notification]:
        """Find existing single interaction notification for the same post."""
        
        # Look for recent single notifications with the unified batch key
        unified_batch_key = self.generate_batch_key("post_interaction", post_id, "post")
        
        # Check for existing interaction notification with unified key
        existing_interaction = await self.notification_repo.find_existing_single_notification(
            user_id, unified_batch_key, max_age_hours=1
        )
        if existing_interaction:
            return existing_interaction
        
        return None
    
    async def _add_to_combined_batch(
        self,
        batch_notification: Notification,
        new_notification: Notification
    ) -> Notification:
        """Add notification to existing combined batch."""
        
        # Increment batch count
        batch_notification.batch_count += 1
        
        # Update title and message with combined summary
        title, message = self._generate_combined_batch_summary(
            batch_notification.batch_count,
            batch_notification.data or {}
        )
        batch_notification.title = title
        batch_notification.message = message
        
        # Update last_updated_at and mark as unread
        batch_notification.last_updated_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        batch_notification.read = False
        batch_notification.read_at = None
        
        # Set the new notification as a child
        new_notification.parent_id = batch_notification.id
        
        # Save both notifications
        self.db.add(batch_notification)
        created_child = await self.notification_repo.create(
            user_id=new_notification.user_id,
            type=new_notification.type,
            title=new_notification.title,
            message=new_notification.message,
            data=new_notification.data,
            parent_id=batch_notification.id
        )
        
        await self.db.commit()
        await self.db.refresh(batch_notification)
        
        logger.info(f"Added {new_notification.type} to combined batch {batch_notification.id}, now has {batch_notification.batch_count} items")
        return created_child
    
    async def _convert_to_combined_batch(
        self,
        existing_notification: Notification,
        new_notification: Notification
    ) -> Notification:
        """Convert existing single notification to combined batch."""
        
        # Generate combined batch summary for 2 items
        title, message = self._generate_combined_batch_summary(2, existing_notification.data or {})
        
        # Create a new dedicated combined batch notification
        batch_notification = await self.notification_repo.create(
            user_id=existing_notification.user_id,
            type="post_interaction",  # Use combined type
            title=title,
            message=message,
            data=existing_notification.data,  # Use same data for context
            batch_key=self.generate_batch_key("post_interaction", existing_notification.data.get("post_id"), "post"),
            is_batch=True,
            batch_count=2,
            last_updated_at=datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        )
        
        # Update the existing notification to be a child of the batch
        existing_notification.parent_id = batch_notification.id
        self.db.add(existing_notification)
        
        # Create the new notification as a child of the batch
        created_child = await self.notification_repo.create(
            user_id=new_notification.user_id,
            type=new_notification.type,
            title=new_notification.title,
            message=new_notification.message,
            data=new_notification.data,
            parent_id=batch_notification.id
        )
        
        await self.db.commit()
        await self.db.refresh(batch_notification)
        
        logger.info(f"Created combined batch notification {batch_notification.id} with 2 child items")
        return batch_notification
    
    def _generate_combined_batch_summary(
        self,
        count: int,
        batch_data: dict
    ) -> tuple[str, str]:
        """Generate intelligent batch summary for mixed likes and reactions."""
        
        if count == 1:
            # Single notification - shouldn't happen in batch context
            return "New Engagement 💜", "Someone engaged with your post 💜"
        elif count == 2:
            return "New Engagement 💜", f"{count} people engaged with your post 💜"
        else:
            return "New Engagement 💜", f"{count} people engaged with your post 💜"


class UserInteractionBatcher(NotificationBatcher):
    """Specialized batcher for user-directed interactions (follows, etc.)."""
    
    async def create_user_notification(
        self,
        notification_type: str,  # "follow"
        target_user_id: int,
        actor_data: dict
    ) -> Optional[Notification]:
        """Create user-directed notification with batching."""
        
        if notification_type == "follow":
            notification = Notification(
                user_id=target_user_id,
                type="follow",
                title="New Follower",
                message="started following you",
                data={
                    "follower_username": actor_data["username"],
                    "follower_id": actor_data["user_id"],
                    "actor_user_id": str(actor_data["user_id"]),
                    "actor_username": actor_data["username"]
                }
            )
        else:
            raise ValueError(f"Unsupported user interaction type: {notification_type}")
        
        # Use user-based batching configuration
        batch_config = BATCH_CONFIGS.get("follow")
        return await self.create_or_update_batch(notification, batch_config)