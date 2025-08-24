"""
NotificationService for handling notification business logic.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, desc, and_
from app.models.notification import Notification
from app.models.user import User
import logging
import datetime

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing user notifications."""

    # Maximum notifications per hour per type
    MAX_NOTIFICATIONS_PER_HOUR = 5

    @staticmethod
    async def _check_notification_rate_limit(
        db: AsyncSession,
        user_id: int,
        notification_type: str
    ) -> bool:
        """
        Check if user has exceeded the notification rate limit for a specific type.
        
        Args:
            db: Database session
            user_id: ID of the user to check
            notification_type: Type of notification to check
            
        Returns:
            bool: True if under rate limit, False if exceeded
        """
        # Calculate the time threshold (1 hour ago)
        one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
        print(f"🔍 DEBUG: Rate limit check - user: {user_id}, type: {notification_type}")
        print(f"🔍 DEBUG: Checking notifications since: {one_hour_ago}")
        
        # Count notifications of this type in the last hour
        result = await db.execute(
            select(func.count(Notification.id))
            .where(
                and_(
                    Notification.user_id == user_id,
                    Notification.type == notification_type,
                    Notification.created_at >= one_hour_ago
                )
            )
        )
        
        count = result.scalar() or 0
        is_under_limit = count < NotificationService.MAX_NOTIFICATIONS_PER_HOUR
        
        print(f"🔍 DEBUG: Found {count} notifications in last hour (limit: {NotificationService.MAX_NOTIFICATIONS_PER_HOUR})")
        print(f"🔍 DEBUG: Under limit: {is_under_limit}")
        
        if not is_under_limit:
            logger.info(
                f"Rate limit exceeded for user {user_id}, type {notification_type}: "
                f"{count} notifications in last hour"
            )
        
        return is_under_limit

    @staticmethod
    async def create_notification(
        db: AsyncSession,
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
            db: Database session
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
            if not await NotificationService._check_notification_rate_limit(
                db, user_id, notification_type
            ):
                logger.info(
                    f"Notification creation blocked due to rate limit: "
                    f"user {user_id}, type {notification_type}"
                )
                return None
        
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            data=data or {}
        )
        
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        
        logger.info(f"Created notification for user {user_id}: {notification_type}")
        return notification

    @staticmethod
    async def create_emoji_reaction_notification(
        db: AsyncSession,
        post_author_id: int,
        reactor_username: str,
        emoji_code: str,
        post_id: str
    ) -> Optional[Notification]:
        """
        Create a notification for emoji reaction with rate limiting.
        
        Args:
            db: Database session
            post_author_id: ID of the post author to notify
            reactor_username: Username of the person who reacted
            emoji_code: Code of the emoji used
            post_id: ID of the post that was reacted to
            
        Returns:
            Optional[Notification]: The created notification, or None if not created
        """
        print(f"🔍 DEBUG: create_emoji_reaction_notification called")
        print(f"🔍 DEBUG: post_author_id: {post_author_id}")
        print(f"🔍 DEBUG: reactor_username: {reactor_username}")
        print(f"🔍 DEBUG: emoji_code: {emoji_code}")
        print(f"🔍 DEBUG: post_id: {post_id}")

        # Don't create notification if user reacted to their own post
        reactor = await User.get_by_username(db, reactor_username)
        print(f"🔍 DEBUG: Found reactor: {reactor.username if reactor else 'None'} (ID: {reactor.id if reactor else 'None'})")
        
        if reactor and reactor.id == post_author_id:
            print(f"⚠️ DEBUG: Self-notification prevented (reactor {reactor.id} == author {post_author_id})")
            return None
        
        # Check rate limit for emoji_reaction notifications
        rate_limit_ok = await NotificationService._check_notification_rate_limit(
            db, post_author_id, 'emoji_reaction'
        )
        print(f"🔍 DEBUG: Rate limit check result: {rate_limit_ok}")
        
        if not rate_limit_ok:
            logger.info(
                f"Emoji reaction notification blocked due to rate limit for user {post_author_id}"
            )
            print(f"⚠️ DEBUG: Rate limit hit for user {post_author_id}!")
            return None
            
        print(f"✅ DEBUG: Creating notification for user {post_author_id}")
        
        notification = Notification.create_emoji_reaction_notification(
            user_id=post_author_id,
            reactor_username=reactor_username,
            emoji_code=emoji_code,
            post_id=post_id
        )
        
        print(f"🔍 DEBUG: Notification object created: {notification}")
        print(f"🔍 DEBUG: Adding to database session...")
        
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        
        print(f"✅ DEBUG: Notification committed to database with ID: {notification.id}")
        logger.info(f"Created emoji reaction notification for user {post_author_id}")
        return notification

    @staticmethod
    async def create_like_notification(
        db: AsyncSession,
        post_author_id: int,
        liker_username: str,
        post_id: str
    ) -> Optional[Notification]:
        """
        Create a notification for post like with rate limiting.
        
        Args:
            db: Database session
            post_author_id: ID of the post author to notify
            liker_username: Username of the person who liked
            post_id: ID of the post that was liked
            
        Returns:
            Optional[Notification]: The created notification, or None if not created
        """
        # Don't create notification if user liked their own post
        liker = await User.get_by_username(db, liker_username)
        if liker and liker.id == post_author_id:
            return None
        
        # Check rate limit for like notifications
        if not await NotificationService._check_notification_rate_limit(
            db, post_author_id, 'like'
        ):
            logger.info(
                f"Like notification blocked due to rate limit for user {post_author_id}"
            )
            return None
        
        return await NotificationService.create_notification(
            db=db,
            user_id=post_author_id,
            notification_type='like',
            title='New Like',
            message=f'{liker_username} liked your post',
            data={
                'post_id': post_id,
                'liker_username': liker_username
            },
            respect_rate_limit=False  # Already checked above
        )

    @staticmethod
    async def create_follow_notification(
        db: AsyncSession,
        followed_user_id: int,
        follower_username: str,
        follower_id: int
    ) -> Optional[Notification]:
        """
        Create a notification for new follower with rate limiting.
        
        Args:
            db: Database session
            followed_user_id: ID of the user being followed
            follower_username: Username of the new follower
            follower_id: ID of the new follower
            
        Returns:
            Optional[Notification]: The created notification, or None if not created
        """
        # Check rate limit for follow notifications
        if not await NotificationService._check_notification_rate_limit(
            db, followed_user_id, 'new_follower'
        ):
            logger.info(
                f"Follow notification blocked due to rate limit for user {followed_user_id}"
            )
            return None
        
        return await NotificationService.create_notification(
            db=db,
            user_id=followed_user_id,
            notification_type='new_follower',
            title='New Follower',
            message=f'{follower_username} started following you',
            data={
                'follower_id': follower_id,
                'follower_username': follower_username
            },
            respect_rate_limit=False  # Already checked above
        )

    @staticmethod
    async def create_mention_notification(
        db: AsyncSession,
        mentioned_user_id: int,
        author_username: str,
        post_id: str,
        post_preview: str
    ) -> Optional[Notification]:
        """
        Create a notification for mention with rate limiting.
        
        Args:
            db: Database session
            mentioned_user_id: ID of the mentioned user
            author_username: Username of the post author
            post_id: ID of the post containing the mention
            post_preview: Preview of the post content
            
        Returns:
            Optional[Notification]: The created notification, or None if not created
        """
        # Check rate limit for mention notifications
        if not await NotificationService._check_notification_rate_limit(
            db, mentioned_user_id, 'mention'
        ):
            logger.info(
                f"Mention notification blocked due to rate limit for user {mentioned_user_id}"
            )
            return None
        
        return await NotificationService.create_notification(
            db=db,
            user_id=mentioned_user_id,
            notification_type='mention',
            title='You were mentioned',
            message=f'{author_username} mentioned you in a post: {post_preview[:50]}...',
            data={
                'post_id': post_id,
                'author_username': author_username,
                'post_preview': post_preview
            },
            respect_rate_limit=False  # Already checked above
        )

    @staticmethod
    async def create_share_notification(
        db: AsyncSession,
        post_author_id: int,
        sharer_username: str,
        post_id: str
    ) -> Optional[Notification]:
        """
        Create a notification for post share with rate limiting.
        
        Args:
            db: Database session
            post_author_id: ID of the post author
            sharer_username: Username of the person who shared
            post_id: ID of the shared post
            
        Returns:
            Optional[Notification]: The created notification, or None if not created
        """
        # Don't create notification if user shared their own post
        sharer = await User.get_by_username(db, sharer_username)
        if sharer and sharer.id == post_author_id:
            return None
        
        # Check rate limit for share notifications
        if not await NotificationService._check_notification_rate_limit(
            db, post_author_id, 'post_shared'
        ):
            logger.info(
                f"Share notification blocked due to rate limit for user {post_author_id}"
            )
            return None
        
        return await NotificationService.create_notification(
            db=db,
            user_id=post_author_id,
            notification_type='post_shared',
            title='Post Shared',
            message=f'{sharer_username} shared your post',
            data={
                'post_id': post_id,
                'sharer_username': sharer_username
            },
            respect_rate_limit=False  # Already checked above
        )

    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        unread_only: bool = False
    ) -> List[Notification]:
        """
        Get notifications for a user.
        
        Args:
            db: Database session
            user_id: ID of the user
            limit: Maximum number of notifications to return
            offset: Number of notifications to skip
            unread_only: If True, only return unread notifications
            
        Returns:
            List[Notification]: List of notifications
        """
        query = select(Notification).where(Notification.user_id == user_id)
        
        if unread_only:
            query = query.where(Notification.read == False)
            
        query = query.order_by(desc(Notification.created_at)).limit(limit).offset(offset)
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: int) -> int:
        """
        Get count of unread notifications for a user.
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            int: Number of unread notifications
        """
        result = await db.execute(
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id, Notification.read == False)
        )
        return result.scalar() or 0

    @staticmethod
    async def mark_as_read(db: AsyncSession, notification_id: str, user_id: int) -> bool:
        """
        Mark a notification as read.
        
        Args:
            db: Database session
            notification_id: ID of the notification
            user_id: ID of the user (for security)
            
        Returns:
            bool: True if notification was marked as read, False if not found
        """
        result = await db.execute(
            select(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        notification = result.scalar_one_or_none()
        
        if notification and not notification.read:
            notification.mark_as_read()
            await db.commit()
            logger.info(f"Marked notification {notification_id} as read for user {user_id}")
            return True
            
        return False

    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: int) -> int:
        """
        Mark all notifications as read for a user.
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            int: Number of notifications marked as read
        """
        result = await db.execute(
            select(Notification)
            .where(Notification.user_id == user_id, Notification.read == False)
        )
        notifications = result.scalars().all()
        
        count = 0
        for notification in notifications:
            notification.mark_as_read()
            count += 1
            
        if count > 0:
            await db.commit()
            logger.info(f"Marked {count} notifications as read for user {user_id}")
            
        return count

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
        one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
        hour_query = base_query.where(Notification.created_at >= one_hour_ago)
        hour_result = await db.execute(select(func.count()).select_from(hour_query.subquery()))
        hour_count = hour_result.scalar() or 0
        
        # Count in last day
        one_day_ago = datetime.datetime.utcnow() - datetime.timedelta(days=1)
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