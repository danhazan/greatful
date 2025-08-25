d: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all notifications as read"
        )


@router.get("/notifications/stats")
async def get_notification_stats(
    notification_type: str = Query(None, description="Filter by notification type"),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get notification statistics for the current user.
    
    - **notification_type**: Optional filter by notification type
    
    Returns statistics including counts by time period and rate limit info.
    """
    try:
        stats = await NotificationService.get_notification_stats(
            db=db,
            user_id=current_user_id,
            notification_type=notification_type
        )
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting notification stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get notification statistics"
        )
```
### app
s/api/app/api/v1/reactions.py
```python
"""
API endpoints for emoji reactions.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict
from app.core.database import get_db
from app.services.reaction_service import ReactionService
from app.models.emoji_reaction import EmojiReaction
from app.core.security import decode_token
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


class ReactionRequest(BaseModel):
    """Request model for adding/updating reactions."""
    emoji_code: str = Field(..., description="Emoji code (e.g., 'heart_eyes', 'pray')")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "emoji_code": "heart_eyes"
            }
        }
    )


class ReactionResponse(BaseModel):
    """Response model for reaction data."""
    id: str
    user_id: int
    post_id: str
    emoji_code: str
    emoji_display: str
    created_at: str
    user: dict = Field(..., description="User information")

    model_config = ConfigDict(from_attributes=True)


class ReactionSummary(BaseModel):
    """Summary of reactions for a post."""
    total_count: int
    emoji_counts: dict
    user_reaction: str | None = None  # Current user's reaction emoji_code


async def get_current_user_id(auth: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Extract user ID from JWT token."""
    try:
        payload = decode_token(auth.credentials)
        user_id = int(payload.get("sub"))
        return user_id
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )


@router.post("/posts/{post_id}/reactions", response_model=ReactionResponse, status_code=status.HTTP_201_CREATED)
async def add_reaction(
    post_id: str,
    reaction_request: ReactionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Add or update an emoji reaction to a post.
    
    - **post_id**: ID of the post to react to
    - **emoji_code**: Code for the emoji reaction
    
    Returns the created or updated reaction.
    """
    try:
        reaction = await ReactionService.add_reaction(
            db=db,
            user_id=current_user_id,
            post_id=post_id,
            emoji_code=reaction_request.emoji_code
        )
        
        # Format response
        return ReactionResponse(
            id=reaction.id,
            user_id=reaction.user_id,
            post_id=reaction.post_id,
            emoji_code=reaction.emoji_code,
            emoji_display=reaction.emoji_display,
            created_at=reaction.created_at.isoformat(),
            user={
                "id": reaction.user.id,
                "username": reaction.user.username,
                "email": reaction.user.email
            }
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error adding reaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add reaction"
        )


@router.delete("/posts/{post_id}/reactions", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reaction(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove the current user's reaction from a post.
    
    - **post_id**: ID of the post to remove reaction from
    
    Returns 204 No Content on success, 404 if no reaction exists.
    """
    try:
        removed = await ReactionService.remove_reaction(
            db=db,
            user_id=current_user_id,
            post_id=post_id
        )
        
        if not removed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No reaction found to remove"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing reaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove reaction"
        )


@router.get("/posts/{post_id}/reactions", response_model=List[ReactionResponse])
async def get_post_reactions(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all reactions for a specific post.
    
    - **post_id**: ID of the post to get reactions for
    
    Returns a list of all reactions with user information.
    """
    try:
        reactions = await ReactionService.get_post_reactions(db=db, post_id=post_id)
        
        return [
            ReactionResponse(
                id=reaction.id,
                user_id=reaction.user_id,
                post_id=reaction.post_id,
                emoji_code=reaction.emoji_code,
                emoji_display=reaction.emoji_display,
                created_at=reaction.created_at.isoformat(),
                user={
                    "id": reaction.user.id,
                    "username": reaction.user.username,
                    "email": reaction.user.email
                }
            )
            for reaction in reactions
        ]
        
    except Exception as e:
        logger.error(f"Error getting post reactions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get reactions"
        )


@router.get("/posts/{post_id}/reactions/summary", response_model=ReactionSummary)
async def get_reaction_summary(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get reaction summary for a post including counts and current user's reaction.
    
    - **post_id**: ID of the post to get reaction summary for
    
    Returns total count, emoji counts, and current user's reaction.
    """
    try:
        # Get total count and emoji counts
        total_count = await ReactionService.get_total_reaction_count(db=db, post_id=post_id)
        emoji_counts = await ReactionService.get_reaction_counts(db=db, post_id=post_id)
        
        # Get current user's reaction
        user_reaction = await ReactionService.get_user_reaction(
            db=db, 
            user_id=current_user_id, 
            post_id=post_id
        )
        
        return ReactionSummary(
            total_count=total_count,
            emoji_counts=emoji_counts,
            user_reaction=user_reaction.emoji_code if user_reaction else None
        )
        
    except Exception as e:
        logger.error(f"Error getting reaction summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get reaction summary"
        )
```###
 apps/api/app/services/notification_service.py
```python
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
        one_hour_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
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
        one_hour_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
        hour_query = base_query.where(Notification.created_at >= one_hour_ago)
        hour_result = await db.execute(select(func.count()).select_from(hour_query.subquery()))
        hour_count = hour_result.scalar() or 0
        
        # Count in last day
        one_day_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1)
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
```### a
pps/api/app/services/reaction_service.py
```python
"""
ReactionService for handling emoji reactions business logic.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from app.models.emoji_reaction import EmojiReaction
from app.models.user import User
from app.models.post import Post
from app.services.notification_service import NotificationService
import logging

logger = logging.getLogger(__name__)


class ReactionService:
    """Service for managing emoji reactions on posts."""

    @staticmethod
    async def add_reaction(
        db: AsyncSession, 
        user_id: int, 
        post_id: str, 
        emoji_code: str
    ) -> EmojiReaction:
        """
        Add or update a user's emoji reaction to a post.
        
        Args:
            db: Database session
            user_id: ID of the user reacting
            post_id: ID of the post being reacted to
            emoji_code: Code for the emoji (e.g., 'heart_eyes', 'pray')
            
        Returns:
            EmojiReaction: The created or updated reaction
            
        Raises:
            ValueError: If emoji_code is invalid
            Exception: If user or post doesn't exist
        """

        print(f"🔍 DEBUG: Starting add_reaction - user: {user_id}, post: {post_id}, emoji: {emoji_code}")
        
        # Validate emoji code
        if not EmojiReaction.is_valid_emoji(emoji_code):
            raise ValueError(f"Invalid emoji code: {emoji_code}")
        
        # Check if user and post exist
        user = await User.get_by_id(db, user_id)
        if not user:
            raise Exception(f"User {user_id} not found")
            
        post_result = await db.execute(select(Post).where(Post.id == post_id))
        post = post_result.scalar_one_or_none()
        if not post:
            raise Exception(f"Post {post_id} not found")
        
        # Check if user already has a reaction on this post
        existing_reaction = await ReactionService.get_user_reaction(db, user_id, post_id)
        
        if existing_reaction:
            # Update existing reaction
            existing_reaction.emoji_code = emoji_code
            await db.commit()
            await db.refresh(existing_reaction)
            # Load the user relationship
            existing_reaction.user = user
            logger.info(f"Updated reaction for user {user_id} on post {post_id} to {emoji_code}")
            
            # Create notification for updated reaction (only if it's a different emoji)
            if post.author_id != user_id:  # Don't notify if user reacts to their own post
                print(f"🔍 DEBUG: Calling notification service for updated reaction...")
                print(f"🔍 DEBUG: Post author: {post.author_id}, Reactor: {user_id}")
                try:
                    notification = await NotificationService.create_emoji_reaction_notification(
                        db=db,
                        post_author_id=post.author_id,
                        reactor_username=user.username,
                        emoji_code=emoji_code,
                        post_id=post_id
                    )
                    print(f"🔍 DEBUG: Notification service returned: {notification}")
                except Exception as e:
                    logger.error(f"Failed to create notification for reaction update: {e}")
                    print(f"❌ DEBUG: Exception in notification creation: {e}")
                    # Don't fail the reaction if notification fails
            else:
                print(f"⚠️ DEBUG: Self-notification prevented (user {user_id} updating own post reaction)")
            
            return existing_reaction
        else:
            # Create new reaction
            reaction = EmojiReaction(
                user_id=user_id,
                post_id=post_id,
                emoji_code=emoji_code
            )
            db.add(reaction)
            await db.commit()
            await db.refresh(reaction)
            # Load the user relationship
            reaction.user = user
            logger.info(f"Created new reaction for user {user_id} on post {post_id}: {emoji_code}")
            
            # Create notification for new reaction
            if post.author_id != user_id:  # Don't notify if user reacts to their own post
                print(f"🔍 DEBUG: Calling notification service for new reaction...")
                print(f"🔍 DEBUG: Post author: {post.author_id}, Reactor: {user_id}")
                try:
                    notification = await NotificationService.create_emoji_reaction_notification(
                        db=db,
                        post_author_id=post.author_id,
                        reactor_username=user.username,
                        emoji_code=emoji_code,
                        post_id=post_id
                    )
                    print(f"🔍 DEBUG: Notification service returned: {notification}")
                except Exception as e:
                    logger.error(f"Failed to create notification for new reaction: {e}")
                    print(f"❌ DEBUG: Exception in notification creation: {e}")
                    # Don't fail the reaction if notification fails
            else:
                print(f"⚠️ DEBUG: Self-notification prevented (user {user_id} reacting to own post)")
            
            return reaction

    @staticmethod
    async def remove_reaction(db: AsyncSession, user_id: int, post_id: str) -> bool:
        """
        Remove a user's reaction from a post.
        
        Args:
            db: Database session
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            bool: True if reaction was removed, False if no reaction existed
        """
        reaction = await ReactionService.get_user_reaction(db, user_id, post_id)
        
        if reaction:
            await db.delete(reaction)
            await db.commit()
            logger.info(f"Removed reaction for user {user_id} on post {post_id}")
            return True
        
        return False

    @staticmethod
    async def get_post_reactions(db: AsyncSession, post_id: str) -> List[EmojiReaction]:
        """
        Get all reactions for a specific post with user information.
        
        Args:
            db: Database session
            post_id: ID of the post
            
        Returns:
            List[EmojiReaction]: List of reactions with user data loaded
        """
        result = await db.execute(
            select(EmojiReaction)
            .options(selectinload(EmojiReaction.user))
            .where(EmojiReaction.post_id == post_id)
            .order_by(EmojiReaction.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def get_user_reaction(
        db: AsyncSession, 
        user_id: int, 
        post_id: str
    ) -> Optional[EmojiReaction]:
        """
        Get a specific user's reaction to a post.
        
        Args:
            db: Database session
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            Optional[EmojiReaction]: The user's reaction if it exists
        """
        result = await db.execute(
            select(EmojiReaction)
            .where(
                EmojiReaction.user_id == user_id,
                EmojiReaction.post_id == post_id
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_reaction_counts(db: AsyncSession, post_id: str) -> dict:
        """
        Get reaction counts grouped by emoji for a post.
        
        Args:
            db: Database session
            post_id: ID of the post
            
        Returns:
            dict: Dictionary with emoji codes as keys and counts as values
        """
        result = await db.execute(
            select(EmojiReaction.emoji_code, func.count(EmojiReaction.id))
            .where(EmojiReaction.post_id == post_id)
            .group_by(EmojiReaction.emoji_code)
        )
        
        counts = {}
        for emoji_code, count in result.fetchall():
            counts[emoji_code] = count
            
        return counts

    @staticmethod
    async def get_total_reaction_count(db: AsyncSession, post_id: str) -> int:
        """
        Get total number of reactions for a post.
        
        Args:
            db: Database session
            post_id: ID of the post
            
        Returns:
            int: Total reaction count
        """
        result = await db.execute(
            select(func.count(EmojiReaction.id))
            .where(EmojiReaction.post_id == post_id)
        )
        return result.scalar() or 0
```### 
apps/api/app/models/notification.py
```python
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
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC), nullable=False)
    read_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type})>"

    def mark_as_read(self):
        """Mark notification as read."""
        self.read = True
        self.read_at = datetime.datetime.now(datetime.UTC)

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
```

## Frontend Files (Next.js)

### apps/web/src/app/api/notifications/[id]/read/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const notificationId = params.id

    // Forward the request to the FastAPI backend
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to mark notification as read' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```### a
pps/web/src/components/NotificationSystem.tsx
```typescript
"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

interface Notification {
  id: string
  type: 'reaction' | 'comment' | 'share'
  message: string
  postId: string
  fromUser: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  read: boolean
}

interface NotificationSystemProps {
  userId: number
}

export default function NotificationSystem({ userId }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch notifications on mount and periodically
  useEffect(() => {
    if (!userId) return

    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("access_token")
        if (!token) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('No access token found for notifications')
          }
          return
        }

        const response = await fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          setNotifications(data)
          
          const unreadCount = data.filter((n: Notification) => !n.read).length
          setUnreadCount(unreadCount)
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.debug('Failed to fetch notifications:', response.status, await response.text())
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Failed to fetch notifications:', error)
        }
      }
    }

    // Fetch immediately
    fetchNotifications()

    // Set up periodic fetching every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)

    return () => clearInterval(interval)
  }, [userId])

  const markAsRead = async (notificationId: string) => {
    // Update local state immediately
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    // Try to sync with backend, but don't block UI if it fails
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok && process.env.NODE_ENV === 'development') {
        console.debug('Backend sync failed for notification read status')
      }
    } catch (error) {
      // Silently handle errors - local state is already updated
      if (process.env.NODE_ENV === 'development') {
        console.debug('Backend unavailable for notification sync:', error)
      }
    }
  }

  const markAllAsRead = async () => {
    // Update local state immediately
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)

    // Try to sync with backend, but don't block UI if it fails
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return

      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok && process.env.NODE_ENV === 'development') {
        console.debug('Backend sync failed for mark all notifications as read')
      }
    } catch (error) {
      // Silently handle errors - local state is already updated
      if (process.env.NODE_ENV === 'development') {
        console.debug('Backend unavailable for notification sync:', error)
      }
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60)
    
    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 text-purple-600 hover:text-purple-700 transition-colors"
          aria-label="Notifications"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-purple-600 hover:text-purple-700"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 text-4xl mb-2">🔔</div>
                  <p className="text-gray-500">No notifications yet</p>
                  <p className="text-sm text-gray-400 mt-1">You'll see reactions and comments here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-purple-50' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead(notification.id)
                        }
                        // Navigate to post (you can implement this)
                        setShowNotifications(false)
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        {/* User Avatar */}
                        <div className="flex-shrink-0">
                          {notification.fromUser.image ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                              <img
                                src={notification.fromUser.image}
                                alt={notification.fromUser.name}
                                className="w-full h-full object-cover object-center"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-purple-600 text-sm font-medium">
                                {notification.fromUser.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Notification Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{notification.fromUser.name}</span>
                            {' '}
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>

                        {/* Unread Indicator */}
                        {!notification.read && (
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </>
  )
}
```

### apps/web/src/components/PostCard.tsx
```typescript
"use client"

import { useState, useRef, useEffect } from "react"
import { Heart, Share, Calendar, MapPin, Plus } from "lucide-react"
import EmojiPicker from "./EmojiPicker"
import ReactionViewer from "./ReactionViewer"
import HeartsViewer from "./HeartsViewer"
import analyticsService from "@/services/analytics"
import { getEmojiFromCode } from "@/utils/emojiMapping"

interface Post {
  id: string
  content: string
  author: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  location?: string
  heartsCount?: number
  isHearted?: boolean
  reactionsCount?: number
  currentUserReaction?: string
}

interface PostCardProps {
  post: Post
  currentUserId?: string
  onHeart?: (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => void
  onReaction?: (postId: string, emojiCode: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => void
  onRemoveReaction?: (postId: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => void
  onShare?: (postId: string) => void
  onUserClick?: (userId: string) => void
}

export default function PostCard({ 
  post, 
  currentUserId,
  onHeart, 
  onReaction,
  onRemoveReaction,
  onShare,
  onUserClick 
}: PostCardProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionViewer, setShowReactionViewer] = useState(false)
  const [showHeartsViewer, setShowHeartsViewer] = useState(false)
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 })
  const [reactions, setReactions] = useState<any[]>([])
  const [hearts, setHearts] = useState<any[]>([])
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const reactionButtonRef = useRef<HTMLButtonElement>(null)

  // Track post view when component mounts
  useEffect(() => {
    if (!hasTrackedView && currentUserId) {
      analyticsService.trackViewEvent(post.id, currentUserId)
      setHasTrackedView(true)
    }
  }, [post.id, hasTrackedView, currentUserId])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    return date.toLocaleDateString()
  }

  const handleReactionButtonClick = async (event: React.MouseEvent) => {
    event.preventDefault()
    
    // If user already has a reaction, remove it
    if (post.currentUserReaction && onRemoveReaction) {
      // Track analytics event for reaction removal
      if (currentUserId) {
        analyticsService.trackReactionEvent(
          'reaction_remove',
          post.id,
          currentUserId,
          undefined,
          post.currentUserReaction
        )
      }
      
      try {
        const token = localStorage.getItem("access_token")
        
        // Make API call to remove reaction
        const response = await fetch(`/api/posts/${post.id}/reactions`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (response.ok) {
          // Get updated reaction summary from server
          const summaryResponse = await fetch(`/api/posts/${post.id}/reactions/summary`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })
          
          if (summaryResponse.ok) {
            const reactionSummary = await summaryResponse.json()
            // Call handler with updated server data
            onRemoveReaction(post.id, reactionSummary)
          } else {
            // Fallback to original handler if summary fetch fails
            onRemoveReaction(post.id)
          }
        } else {
          console.error('Failed to remove reaction')
        }
      } catch (error) {
        console.error('Error removing reaction:', error)
      }
      return
    }
    
    if (reactionButtonRef.current) {
      const rect = reactionButtonRef.current.getBoundingClientRect()
      setEmojiPickerPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      })
    }
    
    setShowEmojiPicker(true)
  }

  const handleEmojiSelect = async (emojiCode: string) => {
    // Track analytics event
    if (currentUserId) {
      const eventType = post.currentUserReaction ? 'reaction_change' : 'reaction_add'
      analyticsService.trackReactionEvent(
        eventType,
        post.id,
        currentUserId,
        emojiCode,
        post.currentUserReaction
      )
    }
    
    try {
      const token = localStorage.getItem("access_token")
      
      // Make API call to add/update reaction
      const response = await fetch(`/api/posts/${post.id}/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji_code: emojiCode })
      })
      
      if (response.ok) {
        // Get updated reaction summary from server
        const summaryResponse = await fetch(`/api/posts/${post.id}/reactions/summary`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (summaryResponse.ok) {
          const reactionSummary = await summaryResponse.json()
          // Call handler with updated server data
          onReaction?.(post.id, emojiCode, reactionSummary)
        } else {
          // Fallback to original handler if summary fetch fails
          onReaction?.(post.id, emojiCode)
        }
      } else {
        console.error('Failed to update reaction')
      }
    } catch (error) {
      console.error('Error updating reaction:', error)
    }
    
    setShowEmojiPicker(false)
  }

  const handleReactionCountClick = async () => {
    // Fetch reactions from API
    try {
      const token = localStorage.getItem("access_token")
      const response = await fetch(`/api/posts/${post.id}/reactions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const reactionsData = await response.json()
        setReactions(reactionsData)
        setShowReactionViewer(true)
      }
    } catch (error) {
      console.error('Failed to fetch reactions:', error)
    }
  }

  const handleHeartsCountClick = async () => {
    // Fetch hearts from API
    try {
      const token = localStorage.getItem("access_token")
      const response = await fetch(`/api/posts/${post.id}/hearts/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const heartsData = await response.json()
        setHearts(heartsData)
        setShowHeartsViewer(true)
      }
    } catch (error) {
      console.error('Failed to fetch hearts:', error)
    }
  }

  const handleUserClick = (userId: number) => {
    if (onUserClick) {
      onUserClick(userId.toString())
    }
  }

  // Get styling based on post type
  const getPostStyling = () => {
    switch (post.postType) {
      case 'daily':
        return {
          container: 'bg-white rounded-xl shadow-lg border-2 border-purple-100 overflow-hidden mb-8',
          header: 'p-6 border-b border-gray-100',
          avatar: 'w-12 h-12',
          name: 'font-bold text-lg',
          badge: 'text-sm px-3 py-2 bg-purple-100 text-purple-700 rounded-full capitalize font-medium',
          content: 'p-6',
          text: 'text-lg leading-relaxed',
          image: 'w-full h-80 object-contain rounded-lg mt-4 bg-gray-50',
          actions: 'px-6 py-4 border-t border-gray-100',
          iconSize: 'h-6 w-6',
          textSize: 'text-base font-medium'
        }
      case 'photo':
        return {
          container: 'bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6',
          header: 'p-5 border-b border-gray-100',
          avatar: 'w-10 h-10',
          name: 'font-semibold text-base',
          badge: 'text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full capitalize',
          content: 'p-5',
          text: 'text-base leading-relaxed',
          image: 'w-full h-64 object-contain rounded-lg mt-4 bg-gray-50',
          actions: 'px-5 py-3 border-t border-gray-100',
          iconSize: 'h-5 w-5',
          textSize: 'text-sm'
        }
      default: // spontaneous
        return {
          container: 'bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4',
          header: 'p-3 border-b border-gray-100',
          avatar: 'w-8 h-8',
          name: 'font-medium text-sm',
          badge: 'text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize',
          content: 'p-3',
          text: 'text-sm leading-relaxed',
          image: 'w-full h-48 object-contain rounded-lg mt-3 bg-gray-50',
          actions: 'px-3 py-2 border-t border-gray-100',
          iconSize: 'h-4 w-4',
          textSize: 'text-xs'
        }
    }
  }

  const styling = getPostStyling()

  return (
    <>
      <article className={styling.container}>
        {/* Post Header */}
        <div className={styling.header}>
          <div className="flex items-center space-x-3">
            <img
              src={post.author.image || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"}
              alt={post.author.name}
              className={`${styling.avatar} rounded-full cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all`}
              onClick={() => onUserClick?.(post.author.id)}
            />
            <div className="flex-1">
              <h3 
                className={`${styling.name} text-gray-900 cursor-pointer hover:text-purple-700 transition-colors`}
                onClick={() => onUserClick?.(post.author.id)}
              >
                {post.author.name}
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(post.createdAt)}</span>
                {post.location && (
                  <>
                    <MapPin className="h-4 w-4" />
                    <span>{post.location}</span>
                  </>
                )}
              </div>
            </div>
            <div className={styling.badge}>
              {post.postType}
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className={styling.content}>
          <p className={`${styling.text} text-gray-900`}>{post.content}</p>
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt="Post image"
              className={styling.image}
            />
          )}
        </div>

        {/* Post Actions */}
        <div className={styling.actions}>
          {/* Engagement Summary for highly engaged posts */}
          {((post.heartsCount || 0) + (post.reactionsCount || 0)) > 5 && (
            <div className="mb-2 px-2 py-1 bg-gradient-to-r from-purple-50 to-red-50 rounded-full">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <span className="flex items-center space-x-1">
                  <Heart className="h-3 w-3 text-red-400 fill-current" />
                  <span>{post.heartsCount || 0}</span>
                </span>
                {(post.reactionsCount || 0) > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <span className="text-purple-400">😊</span>
                      <span>{post.reactionsCount}</span>
                    </span>
                  </>
                )}
                <span className="text-gray-400">•</span>
                <span className="font-medium text-purple-600">
                  {(post.heartsCount || 0) + (post.reactionsCount || 0)} total reactions
                </span>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Heart Button */}
              <button 
                onClick={async () => {
                  const isCurrentlyHearted = post.isHearted || false
                  
                  // Track analytics event
                  if (currentUserId) {
                    analyticsService.trackHeartEvent(post.id, currentUserId, !isCurrentlyHearted)
                  }
                  
                  try {
                    const token = localStorage.getItem("access_token")
                    const method = isCurrentlyHearted ? 'DELETE' : 'POST'
                    
                    const response = await fetch(`/api/posts/${post.id}/heart`, {
                      method,
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                    })
                    
                    if (response.ok) {
                      // Get updated heart info from server
                      const heartInfoResponse = await fetch(`/api/posts/${post.id}/hearts`, {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                        },
                      })
                      
                      if (heartInfoResponse.ok) {
                        const heartInfo = await heartInfoResponse.json()
                        // Call handler with updated server data
                        onHeart?.(post.id, isCurrentlyHearted, heartInfo)
                      } else {
                        // Fallback to original handler if heart info fetch fails
                        onHeart?.(post.id, isCurrentlyHearted)
                      }
                    } else {
                      console.error('Failed to update heart status')
                    }
                  } catch (error) {
                    console.error('Error updating heart:', error)
                  }
                }}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-full transition-all duration-200 ${
                  post.isHearted 
                    ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100' 
                    : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                }`}
              >
                <Heart className={`${styling.iconSize} ${post.isHearted ? 'fill-current' : ''}`} />
                <span 
                  className={`${styling.textSize} font-medium cursor-pointer hover:underline`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleHeartsCountClick()
                  }}
                >
                  {post.heartsCount || 0}
                </span>
              </button>

              {/* Emoji Reaction Button */}
              <button
                ref={reactionButtonRef}
                onClick={handleReactionButtonClick}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-full transition-all duration-200 ${
                  post.currentUserReaction
                    ? 'text-purple-500 hover:text-purple-600 bg-purple-50 hover:bg-purple-100'
                    : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50'
                } ${(post.reactionsCount || 0) > 0 ? 'ring-1 ring-purple-200' : ''}`}
                title="React with emoji"
              >
                {post.currentUserReaction ? (
                  <span className={styling.iconSize.includes('h-6') ? 'text-xl' : styling.iconSize.includes('h-5') ? 'text-lg' : 'text-base'}>
                    {getEmojiFromCode(post.currentUserReaction)}
                  </span>
                ) : (
                  <div className={`${styling.iconSize} rounded-full border-2 border-current flex items-center justify-center`}>
                    <Plus className="h-3 w-3" />
                  </div>
                )}
                <span 
                  className={`${styling.textSize} font-medium cursor-pointer hover:underline`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReactionCountClick()
                  }}
                >
                  {post.reactionsCount || 0}
                </span>
              </button>

              {/* Share Button */}
              <button 
                onClick={() => {
                  // Track analytics event for share
                  if (currentUserId) {
                    analyticsService.trackShareEvent(post.id, currentUserId, 'url')
                  }
                  onShare?.(post.id)
                }}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-gray-500 hover:text-green-500 hover:bg-green-50 transition-all duration-200 ${styling.textSize}`}
              >
                <Share className={styling.iconSize} />
                <span className="font-medium">Share</span>
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
        currentReaction={post.currentUserReaction}
        position={emojiPickerPosition}
      />

      {/* Reaction Viewer Modal */}
      <ReactionViewer
        isOpen={showReactionViewer}
        onClose={() => setShowReactionViewer(false)}
        postId={post.id}
        reactions={reactions}
        onUserClick={handleUserClick}
      />

      {/* Hearts Viewer Modal */}
      <HeartsViewer
        isOpen={showHeartsViewer}
        onClose={() => setShowHeartsViewer(false)}
        postId={post.id}
        hearts={hearts}
        onUserClick={handleUserClick}
      />
    </>
  )
}
```

## Quick Test Results

### Notification endpoints in FastAPI:
- ✅ `/notifications` - GET endpoint exists
- ✅ `/notifications/{notification_id}/read` - POST endpoint exists  
- ✅ `/notifications/read-all` - POST endpoint exists
- ✅ `/notifications/summary` - GET endpoint exists
- ✅ `/notifications/stats` - GET endpoint exists

### Mark as read implementation:
- ✅ `mark_notification_as_read` function exists in notifications.py
- ✅ Calls `NotificationService.mark_as_read()` 
- ✅ Returns success/failure status

### Reaction notification integration:
- ❌ **NO** notification imports in `reactions.py` API endpoint
- ✅ **YES** notification calls in `reaction_service.py` 
- ✅ Extensive debug logging in reaction service
- ✅ `create_emoji_reaction_notification` method exists

## Summary of Issues Found:

1. **Bug 1**: Frontend route structure mismatch - `[id]` vs `[notificationId]`
2. **Bug 2**: Data format mismatch between backend response and frontend interface
3. **Bug 2**: Backend returns `snake_case` but frontend expects `camelCase`