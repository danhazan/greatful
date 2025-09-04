"""
NotificationService for handling notification business logic using repository pattern.

For notification creation, use NotificationFactory:
from app.core.notification_factory import NotificationFactory

This service handles notification retrieval, batching, and management operations.
"""

import datetime
import logging
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.service_base import BaseService
from app.core.query_monitor import monitor_query
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)


class NotificationService(BaseService):
    """Service for managing user notifications using repository pattern."""

    # Maximum notifications per hour per type
    # Reasonable limit for social apps - allows active engagement without spam
    MAX_NOTIFICATIONS_PER_HOUR = 20

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.notification_repo = NotificationRepository(db)
        self.user_repo = UserRepository(db)
        self.user_repo = UserRepository(db)

    @monitor_query("check_notification_rate_limit")
    async def _check_notification_rate_limit(
        self,
        user_id: int,
        notification_type: str
    ) -> bool:
        """
        Check if user has exceeded the notification rate limit for a specific type.
        
        Args:
            user_id: ID of the user to check
            notification_type: Type of notification to check
            
        Returns:
            bool: True if under rate limit, False if exceeded
        """
        print(f"🔍 DEBUG: Rate limit check - user: {user_id}, type: {notification_type}")
        
        is_under_limit = await self.notification_repo.check_rate_limit(
            user_id, notification_type, NotificationService.MAX_NOTIFICATIONS_PER_HOUR
        )
        
        print(f"🔍 DEBUG: Under limit: {is_under_limit}")
        
        return is_under_limit

    @monitor_query("create_notification")
    async def create_notification(
        self,
        user_id: int,
        notification_type: str,
        title: str,
        message: str,
        data: dict = None,
        respect_rate_limit: bool = True
    ) -> Optional[Notification]:
        """
        Create a new notification for a user.
        
        Args:
            user_id: ID of the user to notify
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            data: Additional data for the notification
            respect_rate_limit: Whether to respect rate limiting (default True)
            
        Returns:
            Optional[Notification]: The created notification, or None if rate limited
        """
        # Check rate limit if enabled
        if respect_rate_limit:
            if not await self._check_notification_rate_limit(user_id, notification_type):
                logger.info(
                    f"Notification creation blocked due to rate limit: "
                    f"user {user_id}, type {notification_type}"
                )
                return None
        
        notification = await self.notification_repo.create(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            data=data or {}
        )
        
        logger.info(f"Created notification for user {user_id}: {notification_type}")
        return notification

    @staticmethod
    async def _find_existing_batch(
        db: AsyncSession,
        user_id: int,
        batch_key: str,
        max_age_hours: int = 24
    ) -> Optional[Notification]:
        """
        Find an existing batch notification for the given batch key.
        
        Args:
            db: Database session
            user_id: ID of the user
            batch_key: Key for grouping similar notifications
            max_age_hours: Maximum age of batch to consider (default 24 hours)
            
        Returns:
            Optional[Notification]: Existing batch notification or None
        """
        notification_repo = NotificationRepository(db)
        return await notification_repo.find_existing_batch(user_id, batch_key, max_age_hours)

    @staticmethod
    async def _convert_to_batch(
        db: AsyncSession,
        existing_notification: Notification,
        new_notification: Notification
    ) -> Notification:
        """
        Convert an existing single notification to a batch and add the new one as a child.
        
        Args:
            db: Database session
            existing_notification: The existing single notification
            new_notification: The new notification to add to the batch
            
        Returns:
            Notification: The batch notification
        """
        # Mark existing notification as a batch
        existing_notification.is_batch = True
        existing_notification.batch_count = 2
        
        # Update title and message to batch format
        title, message = existing_notification.create_batch_summary(2)
        existing_notification.title = title
        existing_notification.message = message
        
        # Update last_updated_at to show latest activity (moves to top of list)
        existing_notification.last_updated_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        
        # Mark batch as unread when converting to batch
        existing_notification.read = False
        existing_notification.read_at = None
        
        # Set the new notification as a child
        new_notification.parent_id = existing_notification.id
        
        # Add both to session and commit once
        db.add(existing_notification)
        db.add(new_notification)
        
        await db.commit()
        await db.refresh(existing_notification)
        
        logger.info(f"Converted notification {existing_notification.id} to batch with 2 items")
        return existing_notification

    @staticmethod
    async def _add_to_batch(
        db: AsyncSession,
        batch_notification: Notification,
        new_notification: Notification
    ) -> Notification:
        """
        Add a new notification to an existing batch.
        
        Args:
            db: Database session
            batch_notification: The existing batch notification
            new_notification: The new notification to add to the batch
            
        Returns:
            Notification: The updated batch notification
        """
        # Increment batch count
        batch_notification.batch_count += 1
        
        # Update title and message to reflect new count
        title, message = batch_notification.create_batch_summary(batch_notification.batch_count)
        batch_notification.title = title
        batch_notification.message = message
        
        # Update last_updated_at to show latest activity (this moves it to top of list)
        batch_notification.last_updated_at = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        
        # Mark batch as unread when new notifications are added
        batch_notification.read = False
        batch_notification.read_at = None
        
        # Set the new notification as a child
        new_notification.parent_id = batch_notification.id
        
        # Add both to session
        db.add(batch_notification)
        db.add(new_notification)
        
        await db.commit()
        await db.refresh(batch_notification)
        await db.refresh(new_notification)
        
        logger.info(f"Added notification to batch {batch_notification.id}, now has {batch_notification.batch_count} items")
        return new_notification



    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        unread_only: bool = False,
        include_children: bool = False
    ) -> List[Notification]:
        """
        Get notifications for a user, excluding child notifications by default.
        
        Args:
            db: Database session
            user_id: ID of the user
            limit: Maximum number of notifications to return
            offset: Number of notifications to skip
            unread_only: If True, only return unread notifications
            include_children: If True, include child notifications
            
        Returns:
            List[Notification]: List of notifications
        """
        notification_repo = NotificationRepository(db)
        return await notification_repo.get_user_notifications(
            user_id, limit, offset, unread_only, include_children
        )

    @staticmethod
    async def get_batch_children(
        db: AsyncSession,
        batch_id: str,
        user_id: int
    ) -> List[Notification]:
        """
        Get child notifications for a batch.
        
        Args:
            db: Database session
            batch_id: ID of the batch notification
            user_id: ID of the user (for security)
            
        Returns:
            List[Notification]: List of child notifications
        """
        notification_repo = NotificationRepository(db)
        return await notification_repo.get_batch_children(batch_id, user_id)

    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: int) -> int:
        """
        Get count of unread notifications for a user (only parent notifications).
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            int: Number of unread notifications
        """
        notification_repo = NotificationRepository(db)
        return await notification_repo.get_unread_count(user_id)

    @staticmethod
    async def mark_as_read(db: AsyncSession, notification_id: str, user_id: int) -> bool:
        """
        Mark a notification as read. If it's a batch, mark all children as read too.
        
        Args:
            db: Database session
            notification_id: ID of the notification
            user_id: ID of the user (for security)
            
        Returns:
            bool: True if notification was marked as read, False if not found
        """
        notification_repo = NotificationRepository(db)
        return await notification_repo.mark_as_read(notification_id, user_id)

    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: int) -> int:
        """
        Mark all notifications as read for a user (including children).
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            int: Number of parent notifications marked as read
        """
        notification_repo = NotificationRepository(db)
        return await notification_repo.mark_all_as_read(user_id)

    @staticmethod
    async def get_notification_stats(
        db: AsyncSession,
        user_id: int,
        notification_type: str = None
    ) -> dict:
        """
        Get notification statistics for a user.
        
        Args:
            db: Database session
            user_id: ID of the user
            notification_type: Optional type filter
            
        Returns:
            dict: Statistics including counts by time period
        """
        # Base query
        base_query = select(Notification).where(Notification.user_id == user_id)
        if notification_type:
            base_query = base_query.where(Notification.type == notification_type)
        
        # Count in last hour
        one_hour_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
        one_hour_ago = one_hour_ago.replace(tzinfo=None)  # Convert to naive datetime
        hour_query = base_query.where(Notification.created_at >= one_hour_ago)
        hour_result = await db.execute(select(func.count()).select_from(hour_query.subquery()))
        hour_count = hour_result.scalar() or 0
        
        # Count in last day
        one_day_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1)
        one_day_ago = one_day_ago.replace(tzinfo=None)  # Convert to naive datetime
        day_query = base_query.where(Notification.created_at >= one_day_ago)
        day_result = await db.execute(select(func.count()).select_from(day_query.subquery()))
        day_count = day_result.scalar() or 0
        
        # Total count
        total_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
        total_count = total_result.scalar() or 0
        
        return {
            'user_id': user_id,
            'notification_type': notification_type,
            'last_hour': hour_count,
            'last_day': day_count,
            'total': total_count,
            'rate_limit_remaining': max(0, NotificationService.MAX_NOTIFICATIONS_PER_HOUR - hour_count)
        }