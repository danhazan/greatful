"""
ShareService for handling post sharing business logic using repository pattern.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ValidationException, BusinessLogicError
from app.core.query_monitor import monitor_query
from app.repositories.share_repository import ShareRepository
from app.repositories.user_repository import UserRepository
from app.repositories.post_repository import PostRepository
from app.models.share import Share, ShareMethod
from app.models.user import User
from app.models.post import Post
from app.services.notification_service import NotificationService
import logging
import os

logger = logging.getLogger(__name__)

MAX_RECIPIENTS = 5


def _validate_share_payload(share_method: str, recipients: Optional[List[int]], message: Optional[str]) -> None:
    """Validate share payload based on method."""
    if share_method == "url":
        if recipients is not None:
            raise ValidationException("URL share must not include recipients")
    elif share_method == "message":
        if not recipients:
            raise ValidationException("Message share requires at least one recipient")
        if len(recipients) > MAX_RECIPIENTS:
            raise ValidationException(f"Maximum {MAX_RECIPIENTS} recipients allowed")
    else:
        raise ValidationException("Invalid share method")


class ShareService(BaseService):
    """Service for managing post sharing using repository pattern."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.share_repo = ShareRepository(db)
        self.user_repo = UserRepository(db)
        self.post_repo = PostRepository(db)

    @monitor_query("generate_share_url")
    async def generate_share_url(self, post_id: str) -> str:
        """
        Generate a shareable URL for a post.
        
        Args:
            post_id: ID of the post to share
            
        Returns:
            str: The shareable URL
            
        Raises:
            NotFoundError: If post doesn't exist
        """
        # Verify post exists
        post = await self.post_repo.get_by_id_or_404(post_id)
        
        # Get base URL from environment or use default
        base_url = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
        
        # Generate SEO-friendly URL
        share_url = f"{base_url}/post/{post_id}"
        
        logger.info(f"Generated share URL for post {post_id}: {share_url}")
        return share_url

    @monitor_query("share_via_url")
    async def share_via_url(
        self, 
        user_id: int, 
        post_id: str
    ) -> Dict[str, Any]:
        """
        Record a URL share and generate the shareable URL.
        
        Args:
            user_id: ID of the user sharing
            post_id: ID of the post being shared
            
        Returns:
            Dict: Share data with URL
            
        Raises:
            NotFoundError: If user or post doesn't exist
        """
        # Note: URL sharing (copy link) is not rate limited - only message sharing is
        
        # Verify user and post exist
        user = await self.user_repo.get_by_id_or_404(user_id)
        post = await self.post_repo.get_by_id_or_404(post_id)
        
        # Check if post allows sharing (privacy settings)
        if not await self._can_share_post(user_id, post):
            raise BusinessLogicError("This post cannot be shared due to privacy settings.")
        
        # Validate payload
        _validate_share_payload("url", None, None)
        
        # Create share record (don't pass recipient_user_ids for URL shares)
        share = await self.share_repo.create(
            user_id=user_id,
            post_id=post_id,
            share_method=ShareMethod.url.value
        )
        
        # Generate share URL
        share_url = await self.generate_share_url(post_id)
        
        # Create notification for post author (if not sharing own post)
        if post.author_id != user_id:
            try:
                await NotificationService.create_share_notification(
                    db=self.db,
                    post_author_id=post.author_id,
                    sharer_username=user.username,
                    post_id=post_id,
                    share_method="url"
                )
            except Exception as e:
                logger.error(f"Failed to create share notification: {e}")
                # Don't fail the share if notification fails
        
        # Track analytics
        await self.track_share_analytics(user_id, post_id, "url")
        
        logger.info(f"User {user_id} shared post {post_id} via URL")
        
        return {
            "id": share.id,
            "user_id": share.user_id,
            "post_id": share.post_id,
            "share_method": share.share_method,
            "share_url": share_url,
            "created_at": share.created_at.isoformat()
        }

    @monitor_query("share_via_message")
    async def share_via_message(
        self, 
        sender_id: int, 
        post_id: str, 
        recipient_ids: List[int], 
        message: str = ""
    ) -> Dict[str, Any]:
        """
        Share a post via in-app message to specific users.
        
        Args:
            sender_id: ID of the user sharing
            post_id: ID of the post being shared
            recipient_ids: List of user IDs to share with (max 5)
            message: Optional message to include (max 200 chars)
            
        Returns:
            Dict: Share data with recipients
            
        Raises:
            ValidationException: If validation fails
            BusinessLogicError: If rate limit exceeded or privacy violation
        """
        # Validate inputs
        _validate_share_payload("message", recipient_ids, message)
        
        if len(message or "") > 200:
            raise ValidationException("Message cannot exceed 200 characters.")
        
        # Check rate limit
        rate_limit_status = await self.check_rate_limit(sender_id)
        if rate_limit_status["is_exceeded"]:
            raise BusinessLogicError(
                f"Share rate limit exceeded. You can share {rate_limit_status['max_allowed']} posts per hour. "
                f"Try again in {rate_limit_status['reset_time'].strftime('%H:%M')}."
            )
        
        # Verify sender and post exist
        sender = await self.user_repo.get_by_id_or_404(sender_id)
        post = await self.post_repo.get_by_id_or_404(post_id)
        
        # Check if post allows sharing
        if not await self._can_share_post(sender_id, post):
            raise BusinessLogicError("This post cannot be shared due to privacy settings.")
        
        # Verify all recipients exist and can receive shares
        valid_recipients = []
        for recipient_id in recipient_ids:
            recipient = await self.user_repo.get_by_id_or_404(recipient_id)
            
            # Check if recipient allows messages/shares (privacy settings)
            if await self._can_receive_share(sender_id, recipient_id):
                valid_recipients.append(recipient_id)
            else:
                logger.warning(f"Skipping recipient {recipient_id} due to privacy settings")
        
        if not valid_recipients:
            raise BusinessLogicError("No valid recipients found. Check privacy settings.")
        
        # Create share record with recipients
        share = await self.share_repo.create(
            user_id=sender_id,
            post_id=post_id,
            share_method=ShareMethod.message.value,
            recipient_user_ids=valid_recipients,  # Store directly as JSON array
            message_content=message.strip() if message else None
        )
        
        # Create notifications for recipients
        for recipient_id in valid_recipients:
            try:
                await NotificationService.create_share_notification(
                    db=self.db,
                    post_author_id=recipient_id,  # Recipient gets the notification
                    sharer_username=sender.username,
                    post_id=post_id,
                    share_method="message",
                    message_content=message
                )
            except Exception as e:
                logger.error(f"Failed to create share notification for recipient {recipient_id}: {e}")
                # Continue with other recipients
        
        # Track analytics
        await self.track_share_analytics(sender_id, post_id, "message")
        
        logger.info(f"User {sender_id} shared post {post_id} via message to {len(valid_recipients)} recipients")
        
        return {
            "id": share.id,
            "user_id": share.user_id,
            "post_id": share.post_id,
            "share_method": share.share_method,
            "recipient_count": len(valid_recipients),
            "message_content": share.message_content,
            "created_at": share.created_at.isoformat()
        }

    @monitor_query("check_rate_limit")
    async def check_rate_limit(self, user_id: int) -> Dict[str, Any]:
        """
        Check if user has exceeded share rate limit (20 shares per hour).
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict: Rate limit status
        """
        return await self.share_repo.check_user_rate_limit(
            user_id=user_id,
            hours=1,
            max_shares=20
        )

    @monitor_query("track_share_analytics")
    async def track_share_analytics(
        self, 
        user_id: int, 
        post_id: str, 
        method: str
    ) -> None:
        """
        Track share analytics for reporting and insights.
        
        Args:
            user_id: ID of the user sharing
            post_id: ID of the post being shared
            method: Share method ('url' or 'message')
        """
        # This could be extended to send data to analytics services
        # For now, we just log the event
        logger.info(f"Share analytics: user={user_id}, post={post_id}, method={method}")

    @monitor_query("get_post_shares")
    async def get_post_shares(self, post_id: str) -> List[Dict[str, Any]]:
        """
        Get all shares for a specific post with user information.
        
        Args:
            post_id: ID of the post
            
        Returns:
            List[Dict]: List of share dictionaries with user data
        """
        shares = await self.share_repo.get_post_shares(post_id, load_users=True)
        
        return [
            {
                "id": share.id,
                "user_id": share.user_id,
                "post_id": share.post_id,
                "share_method": share.share_method,
                "recipient_count": share.recipient_count,
                "message_content": share.message_content,
                "created_at": share.created_at.isoformat(),
                "user": {
                    "id": share.user.id,
                    "username": share.user.username,
                    "profile_image_url": share.user.profile_image_url
                }
            }
            for share in shares
        ]

    @monitor_query("get_share_counts")
    async def get_share_counts(self, post_id: str) -> Dict[str, Any]:
        """
        Get share counts for a post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            Dict: Share counts by method and total
        """
        counts_by_method = await self.share_repo.get_share_counts_by_method(post_id)
        total_count = await self.share_repo.get_total_share_count(post_id)
        
        return {
            "total": total_count,
            "url_shares": counts_by_method.get("url", 0),
            "message_shares": counts_by_method.get("message", 0),
            "by_method": counts_by_method
        }

    @monitor_query("get_recent_recipients")
    async def get_recent_recipients(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get recently messaged users for quick-select in share modal.
        
        Args:
            user_id: ID of the user
            
        Returns:
            List[Dict]: List of recent recipients
        """
        return await self.share_repo.get_recent_message_recipients(user_id, limit=5)

    async def _can_share_post(self, user_id: int, post: Post) -> bool:
        """
        Check if a post can be shared based on privacy settings.
        
        Args:
            user_id: ID of the user wanting to share
            post: Post object
            
        Returns:
            bool: True if post can be shared
        """
        # For now, allow sharing of public posts
        # This can be extended with user preferences later
        if not post.is_public:
            return False
        
        # TODO: Check user preferences for sharing permissions
        # user_prefs = await self.get_user_preferences(post.author_id)
        # if not user_prefs.allow_sharing:
        #     return False
        
        return True

    async def _can_receive_share(self, sender_id: int, recipient_id: int) -> bool:
        """
        Check if a user can receive shares based on privacy settings.
        
        Args:
            sender_id: ID of the user sending the share
            recipient_id: ID of the user receiving the share
            
        Returns:
            bool: True if user can receive shares
        """
        # For now, allow all shares between users
        # This can be extended with blocking/privacy settings later
        
        # TODO: Check blocking relationships
        # if await self.is_blocked(sender_id, recipient_id):
        #     return False
        
        # TODO: Check user preferences for receiving shares
        # user_prefs = await self.get_user_preferences(recipient_id)
        # if not user_prefs.allow_shares:
        #     return False
        
        return True