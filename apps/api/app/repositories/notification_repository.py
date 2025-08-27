"""
Notification repository with specialized query methods.
"""

import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, text, and_, or_
from app.core.repository_base import BaseRepository
from app.models.notification import Notification


class NotificationRepository(BaseRepository):
    """Repository for Notification model with specialized queries."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, Notification)
    
    async def get_user_notifications(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        unread_only: bool = False,
        include_children: bool = False
    ) -> List[Notification]:
        """
        Get notifications for a user, excluding child notifications by default.
        
        Args:
            user_id: ID of the user
            limit: Maximum number of notifications to return
            offset: Number of notifications to skip
            unread_only: If True, only return unread notifications
            include_children: If True, include child notifications
            
        Returns:
            List[Notification]: List of notifications
        """
        builder = self.query().filter(Notification.user_id == user_id)
        
        if not include_children:
            # Only show parent notifications (batch parents or standalone notifications)
            builder = builder.filter(Notification.parent_id.is_(None))
        
        if unread_only:
            builder = builder.filter(Notification.read == False)
        
        # Order by last_updated_at for proper batch ordering, fallback to created_at
        builder = builder.order_by(
            desc(func.coalesce(Notification.last_updated_at, Notification.created_at))
        ).limit(limit).offset(offset)
        
        query = builder.build()
        result = await self._execute_query(query, "get user notifications")
        return result.scalars().all()
    
    async def get_batch_children(
        self,
        batch_id: str,
        user_id: int
    ) -> List[Notification]:
        """
        Get child notifications for a batch.
        
        Args:
            batch_id: ID of the batch notification
            user_id: ID of the user (for security)
            
        Returns:
            List[Notification]: List of child notifications
        """
        return await self.find_all(
            filters={
                "parent_id": batch_id,
                "user_id": user_id
            },
            order_by=desc(Notification.created_at)
        )
    
    async def get_unread_count(self, user_id: int) -> int:
        """
        Get count of unread notifications for a user (only parent notifications).
        
        Args:
            user_id: ID of the user
            
        Returns:
            int: Number of unread notifications
        """
        return await self.count({
            "user_id": user_id,
            "read": False,
            "parent_id": None  # Only count parent notifications
        })
    
    async def find_existing_batch(
        self,
        user_id: int,
        batch_key: str,
        max_age_hours: int = 24
    ) -> Optional[Notification]:
        """
        Find an existing batch notification for the given batch key.
        
        Args:
            user_id: ID of the user
            batch_key: Key for grouping similar notifications
            max_age_hours: Maximum age of batch to consider (default 24 hours)
            
        Returns:
            Optional[Notification]: Existing batch notification or None
        """
        cutoff_time = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=max_age_hours)
        cutoff_time = cutoff_time.replace(tzinfo=None)
        
        builder = self.query().filter(
            and_(
                Notification.user_id == user_id,
                Notification.batch_key == batch_key,
                Notification.is_batch == True,
                Notification.created_at >= cutoff_time
            )
        ).order_by(desc(Notification.created_at)).limit(1)
        
        query = builder.build()
        result = await self._execute_query(query, "find existing batch")
        return result.scalar_one_or_none()
    
    async def find_existing_single_notification(
        self,
        user_id: int,
        batch_key: str,
        max_age_hours: int = 1
    ) -> Optional[Notification]:
        """
        Find an existing single notification to convert to batch.
        
        Args:
            user_id: ID of the user
            batch_key: Key for grouping similar notifications
            max_age_hours: Maximum age to consider (default 1 hour)
            
        Returns:
            Optional[Notification]: Existing single notification or None
        """
        cutoff_time = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=max_age_hours)
        cutoff_time = cutoff_time.replace(tzinfo=None)
        
        builder = self.query().filter(
            and_(
                Notification.user_id == user_id,
                Notification.batch_key == batch_key,
                Notification.is_batch == False,
                Notification.parent_id.is_(None),
                Notification.created_at >= cutoff_time
            )
        ).order_by(desc(Notification.created_at)).limit(1)
        
        query = builder.build()
        result = await self._execute_query(query, "find existing single notification")
        return result.scalar_one_or_none()
    
    async def mark_as_read(self, notification_id: str, user_id: int) -> bool:
        """
        Mark a notification as read. If it's a batch, mark all children as read too.
        
        Args:
            notification_id: ID of the notification
            user_id: ID of the user (for security)
            
        Returns:
            bool: True if notification was marked as read, False if not found
        """
        notification = await self.find_one({
            "id": notification_id,
            "user_id": user_id
        })
        
        if notification and not notification.read:
            notification.mark_as_read()
            
            # If it's a batch notification, mark all children as read too
            if notification.is_batch:
                children = await self.get_batch_children(notification_id, user_id)
                
                for child in children:
                    if not child.read:
                        child.mark_as_read()
                
                self.logger.info(f"Marked batch notification {notification_id} and {len(children)} children as read")
            
            await self.db.commit()
            self.logger.info(f"Marked notification {notification_id} as read for user {user_id}")
            return True
            
        return False
    
    async def mark_all_as_read(self, user_id: int) -> int:
        """
        Mark all notifications as read for a user (including children).
        
        Args:
            user_id: ID of the user
            
        Returns:
            int: Number of parent notifications marked as read
        """
        notifications = await self.find_all({
            "user_id": user_id,
            "read": False
        })
        
        parent_count = 0
        for notification in notifications:
            notification.mark_as_read()
            # Only count parent notifications for the return value
            if notification.parent_id is None:
                parent_count += 1
            
        if len(notifications) > 0:
            await self.db.commit()
            self.logger.info(f"Marked {len(notifications)} total notifications ({parent_count} parents) as read for user {user_id}")
            
        return parent_count
    
    async def get_notification_stats(
        self,
        user_id: int,
        notification_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get notification statistics for a user.
        
        Args:
            user_id: ID of the user
            notification_type: Optional type filter
            
        Returns:
            Dict: Statistics including counts by time period
        """
        # Base conditions
        where_conditions = ["user_id = :user_id"]
        params = {"user_id": user_id}
        
        if notification_type:
            where_conditions.append("type = :notification_type")
            params["notification_type"] = notification_type
        
        base_where = " AND ".join(where_conditions)
        
        # Count in last hour
        one_hour_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
        one_hour_ago = one_hour_ago.replace(tzinfo=None)
        
        hour_query = text(f"""
            SELECT COUNT(*) as count
            FROM notifications
            WHERE {base_where} AND created_at >= :one_hour_ago
        """)
        
        hour_result = await self.execute_raw_query(hour_query, {**params, "one_hour_ago": one_hour_ago})
        hour_count = hour_result.scalar() or 0
        
        # Count in last day
        one_day_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1)
        one_day_ago = one_day_ago.replace(tzinfo=None)
        
        day_query = text(f"""
            SELECT COUNT(*) as count
            FROM notifications
            WHERE {base_where} AND created_at >= :one_day_ago
        """)
        
        day_result = await self.execute_raw_query(day_query, {**params, "one_day_ago": one_day_ago})
        day_count = day_result.scalar() or 0
        
        # Total count
        total_query = text(f"""
            SELECT COUNT(*) as count
            FROM notifications
            WHERE {base_where}
        """)
        
        total_result = await self.execute_raw_query(total_query, params)
        total_count = total_result.scalar() or 0
        
        return {
            'user_id': user_id,
            'notification_type': notification_type,
            'last_hour': hour_count,
            'last_day': day_count,
            'total': total_count,
            'rate_limit_remaining': max(0, 20 - hour_count)  # Assuming 20/hour limit
        }
    
    async def check_rate_limit(
        self,
        user_id: int,
        notification_type: str,
        max_per_hour: int = 20
    ) -> bool:
        """
        Check if user has exceeded the notification rate limit for a specific type.
        
        Args:
            user_id: ID of the user to check
            notification_type: Type of notification to check
            max_per_hour: Maximum notifications per hour
            
        Returns:
            bool: True if under rate limit, False if exceeded
        """
        one_hour_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
        one_hour_ago = one_hour_ago.replace(tzinfo=None)
        
        count = await self.count({
            "user_id": user_id,
            "type": notification_type
        })
        
        # For rate limiting, we need to check within the last hour
        # This is a simplified check - in production you'd want more sophisticated rate limiting
        builder = self.query().filter(
            and_(
                Notification.user_id == user_id,
                Notification.type == notification_type,
                Notification.created_at >= one_hour_ago
            )
        )
        
        query = select(func.count()).select_from(builder.build().subquery())
        result = await self._execute_query(query, "check rate limit")
        recent_count = result.scalar() or 0
        
        is_under_limit = recent_count < max_per_hour
        
        if not is_under_limit:
            self.logger.info(
                f"Rate limit exceeded for user {user_id}, type {notification_type}: "
                f"{recent_count} notifications in last hour"
            )
        
        return is_under_limit
    
    async def get_notifications_by_type(
        self,
        user_id: int,
        notification_type: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[Notification]:
        """
        Get notifications of a specific type for a user.
        
        Args:
            user_id: ID of the user
            notification_type: Type of notifications to retrieve
            limit: Maximum number of notifications
            offset: Number of notifications to skip
            
        Returns:
            List[Notification]: List of notifications of the specified type
        """
        return await self.find_all(
            filters={
                "user_id": user_id,
                "type": notification_type
            },
            order_by=desc(Notification.created_at)
        )
    
    async def delete_old_notifications(
        self,
        days_old: int = 90,
        batch_size: int = 1000
    ) -> int:
        """
        Delete notifications older than specified days.
        
        Args:
            days_old: Number of days old to consider for deletion
            batch_size: Number of notifications to delete in each batch
            
        Returns:
            int: Number of notifications deleted
        """
        cutoff_date = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=days_old)
        cutoff_date = cutoff_date.replace(tzinfo=None)
        
        query = text("""
            DELETE FROM notifications
            WHERE created_at < :cutoff_date
            LIMIT :batch_size
        """)
        
        total_deleted = 0
        while True:
            result = await self.execute_raw_query(query, {
                "cutoff_date": cutoff_date,
                "batch_size": batch_size
            })
            
            deleted_count = result.rowcount
            total_deleted += deleted_count
            
            if deleted_count < batch_size:
                break
        
        self.logger.info(f"Deleted {total_deleted} old notifications (older than {days_old} days)")
        return total_deleted