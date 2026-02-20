"""
Follow service with standardized patterns using repository layer.
"""

import logging
from typing import Dict, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ConflictError, ValidationException, PermissionDeniedError
from app.core.query_monitor import monitor_query
from app.repositories.follow_repository import FollowRepository
from app.repositories.user_repository import UserRepository
from app.models.follow import Follow
from app.models.user import User

logger = logging.getLogger(__name__)


class FollowService(BaseService):
    """Service for follow operations using repository pattern."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.follow_repo = FollowRepository(db)
        self.user_repo = UserRepository(db)

    @monitor_query("follow_user")
    async def follow_user(
        self, 
        follower_id: int, 
        followed_id: int
    ) -> Dict[str, Any]:
        """
        Create a follow relationship between two users.
        
        Args:
            follower_id: ID of the user who wants to follow
            followed_id: ID of the user to be followed
            
        Returns:
            Dict containing follow relationship data
            
        Raises:
            NotFoundError: If either user is not found
            ValidationException: If trying to follow self
            ConflictError: If follow relationship already exists
        """
        # Prevent self-following
        if follower_id == followed_id:
            raise ValidationException(
                "Cannot follow yourself",
                {"followed_id": "You cannot follow yourself"}
            )
        
        # Validate users exist
        follower = await self.user_repo.get_by_id_or_404(follower_id)
        followed = await self.user_repo.get_by_id_or_404(followed_id)
        
        # Check if follow relationship already exists
        existing_follow = await self.follow_repo.get_follow_relationship(
            follower_id, followed_id
        )
        
        if existing_follow:
            if existing_follow.status == "active":
                raise ConflictError("Already following this user", "follow")
            elif existing_follow.status == "pending":
                raise ConflictError("Follow request already pending", "follow")
            elif existing_follow.status == "blocked":
                raise PermissionDeniedError(
                    "Cannot follow this user", 
                    "Follow", 
                    "create"
                )
        
        # Create follow relationship
        # For now, all follows are active (no approval required)
        # TODO: Add privacy settings support for pending status
        follow = await self.follow_repo.create(
            follower_id=follower_id,
            followed_id=followed_id,
            status="active"
        )
        
        logger.info(f"User {follower_id} started following user {followed_id}")
        
        # Create notification for followed user using factory
        try:
            from app.core.notification_factory import NotificationFactory
            notification_factory = NotificationFactory(self.db)
            await notification_factory.create_follow_notification(
                followed_user_id=followed_id,
                follower_username=follower.username,
                follower_id=follower_id
            )
        except Exception as e:
            logger.error(f"Failed to create follow notification: {e}")
            # Don't fail the follow if notification fails
        
        # Track interaction for preference learning
        try:
            from app.services.user_preference_service import UserPreferenceService
            preference_service = UserPreferenceService(self.db)
            await preference_service.track_follow_interaction(
                user_id=follower_id,
                followed_user_id=followed_id
            )
        except Exception as e:
            logger.error(f"Failed to track follow interaction: {e}")
            # Don't fail the follow if preference tracking fails
        
        return {
            "id": follow.id,
            "follower_id": follow.follower_id,
            "followed_id": follow.followed_id,
            "status": follow.status,
            "created_at": follow.created_at.isoformat(),
            "follower": {
                "id": follower.id,
                "username": follower.username,
                "profile_image_url": follower.profile_image_url
            },
            "followed": {
                "id": followed.id,
                "username": followed.username,
                "profile_image_url": followed.profile_image_url
            }
        }

    @monitor_query("unfollow_user")
    async def unfollow_user(
        self, 
        follower_id: int, 
        followed_id: int
    ) -> bool:
        """
        Remove a follow relationship between two users.
        
        Args:
            follower_id: ID of the user who wants to unfollow
            followed_id: ID of the user to be unfollowed
            
        Returns:
            bool: True if unfollowed successfully
            
        Raises:
            NotFoundError: If follow relationship doesn't exist
        """
        # Get existing follow relationship
        follow = await self.follow_repo.get_follow_relationship(
            follower_id, followed_id
        )
        
        if not follow:
            raise NotFoundError("Follow relationship", f"{follower_id}->{followed_id}")
        
        # Delete the follow relationship
        await self.follow_repo.delete(follow)
        
        logger.info(f"User {follower_id} unfollowed user {followed_id}")
        
        return True

    @monitor_query("get_followers")
    async def get_followers(
        self, 
        user_id: int,
        current_user_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get followers for a user with pagination.
        
        Args:
            user_id: ID of the user whose followers to get
            current_user_id: ID of the current user (for follow status)
            limit: Maximum number of followers to return
            offset: Number of followers to skip
            
        Returns:
            Dict containing followers list and pagination info
            
        Raises:
            NotFoundError: If user is not found
        """
        # Verify user exists
        await self.user_repo.get_by_id_or_404(user_id)
        
        # Get followers with pagination
        followers, total_count = await self.follow_repo.get_followers(
            user_id, limit=limit, offset=offset
        )
        
        # Format follower data
        followers_data = []
        for follower in followers:
            follower_data = {
                "id": follower.id,
                "username": follower.username,
                "bio": follower.bio,
                "profile_image_url": follower.profile_image_url,
                "created_at": follower.created_at.isoformat()
            }
            
            # Add follow status if current user is provided
            if current_user_id and current_user_id != follower.id:
                is_following = await self.follow_repo.is_following(
                    current_user_id, follower.id
                )
                follower_data["is_following"] = is_following
            else:
                follower_data["is_following"] = False
            
            followers_data.append(follower_data)
        
        logger.info(f"Retrieved {len(followers)} followers for user {user_id}")
        
        return {
            "followers": followers_data,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(followers) < total_count
        }

    @monitor_query("get_following")
    async def get_following(
        self, 
        user_id: int,
        current_user_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get users that the given user is following with pagination.
        
        Args:
            user_id: ID of the user whose following list to get
            current_user_id: ID of the current user (for follow status)
            limit: Maximum number of following to return
            offset: Number of following to skip
            
        Returns:
            Dict containing following list and pagination info
            
        Raises:
            NotFoundError: If user is not found
        """
        # Verify user exists
        await self.user_repo.get_by_id_or_404(user_id)
        
        # Get following with pagination
        following, total_count = await self.follow_repo.get_following(
            user_id, limit=limit, offset=offset
        )
        
        # Format following data
        following_data = []
        for followed_user in following:
            followed_data = {
                "id": followed_user.id,
                "username": followed_user.username,
                "bio": followed_user.bio,
                "profile_image_url": followed_user.profile_image_url,
                "created_at": followed_user.created_at.isoformat()
            }
            
            # Add follow status if current user is provided
            if current_user_id and current_user_id != followed_user.id:
                is_following = await self.follow_repo.is_following(
                    current_user_id, followed_user.id
                )
                followed_data["is_following"] = is_following
            else:
                followed_data["is_following"] = False
            
            following_data.append(followed_data)
        
        logger.info(f"Retrieved {len(following)} following for user {user_id}")
        
        return {
            "following": following_data,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(following) < total_count
        }

    @monitor_query("get_follow_status")
    async def get_follow_status(
        self, 
        follower_id: int, 
        followed_id: int
    ) -> Dict[str, Any]:
        """
        Get follow status between two users.
        
        Args:
            follower_id: ID of the potential follower
            followed_id: ID of the potential followed user
            
        Returns:
            Dict containing follow status information
        """
        # Check if follower follows followed
        follow_relationship = await self.follow_repo.get_follow_relationship(
            follower_id, followed_id
        )
        
        # Check if followed follows follower (mutual)
        reverse_relationship = await self.follow_repo.get_follow_relationship(
            followed_id, follower_id
        )
        
        return {
            "is_following": follow_relationship is not None and follow_relationship.status == "active",
            "follow_status": follow_relationship.status if follow_relationship else None,
            "is_followed_by": reverse_relationship is not None and reverse_relationship.status == "active",
            "reverse_status": reverse_relationship.status if reverse_relationship else None,
            "is_mutual": (
                follow_relationship is not None and 
                reverse_relationship is not None and
                follow_relationship.status == "active" and 
                reverse_relationship.status == "active"
            )
        }

    @monitor_query("get_follow_stats")
    async def get_follow_stats(self, user_id: int) -> Dict[str, int]:
        """
        Get follow statistics for a user.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict containing follow statistics
            
        Raises:
            NotFoundError: If user is not found
        """
        # Verify user exists
        await self.user_repo.get_by_id_or_404(user_id)
        
        # Get comprehensive follow stats
        stats = await self.follow_repo.get_follow_stats(user_id)
        
        logger.info(f"Retrieved follow stats for user {user_id}: {stats}")
        
        return stats

    @monitor_query("get_follow_suggestions")
    async def get_follow_suggestions(
        self, 
        user_id: int, 
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get follow suggestions for a user.
        
        Args:
            user_id: ID of the user to get suggestions for
            limit: Maximum number of suggestions
            
        Returns:
            List of suggested users to follow
            
        Raises:
            NotFoundError: If user is not found
        """
        # Verify user exists
        await self.user_repo.get_by_id_or_404(user_id)
        
        # Get suggestions from repository
        suggested_users = await self.follow_repo.get_follow_suggestions(
            user_id, limit=limit
        )
        
        # Format suggestions
        suggestions = []
        for user in suggested_users:
            suggestions.append({
                "id": user.id,
                "username": user.username,
                "bio": user.bio,
                "profile_image_url": user.profile_image_url,
                "created_at": user.created_at.isoformat()
            })
        
        logger.info(f"Retrieved {len(suggestions)} follow suggestions for user {user_id}")
        
        return suggestions

    @monitor_query("bulk_check_following")
    async def bulk_check_following(
        self, 
        follower_id: int, 
        user_ids: List[int]
    ) -> Dict[int, bool]:
        """
        Check following status for multiple users at once.
        
        Args:
            follower_id: ID of the follower user
            user_ids: List of user IDs to check
            
        Returns:
            Dict mapping user_id to boolean follow status (active ONLY)
        """
        if not user_ids:
            return {}
        
        # Get bulk following status (boolean map from repository)
        return await self.follow_repo.bulk_check_following_status(
            follower_id, user_ids
        )