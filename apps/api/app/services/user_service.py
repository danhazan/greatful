"""
User service with standardized patterns using repository layer.
"""

import logging
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ConflictError, ValidationException
from app.core.query_monitor import monitor_query
from app.repositories.user_repository import UserRepository
from app.repositories.post_repository import PostRepository
from app.models.user import User

logger = logging.getLogger(__name__)


class UserService(BaseService):
    """Service for user operations using repository pattern."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.user_repo = UserRepository(db)
        self.post_repo = PostRepository(db)

    @monitor_query("get_user_profile")
    async def get_user_profile(self, user_id: int) -> Dict[str, any]:
        """
        Get user profile with stats.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict containing user profile data
            
        Raises:
            NotFoundError: If user is not found
        """
        user = await self.user_repo.get_by_id_or_404(user_id)
        stats = await self.user_repo.get_user_stats(user_id)
        
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "bio": user.bio,
            "profile_image_url": user.profile_image_url,
            "created_at": user.created_at.isoformat(),
            "posts_count": stats["posts_count"],
            "followers_count": stats["followers_count"],
            "following_count": stats["following_count"]
        }

    async def get_public_user_profile(self, user_id: int) -> Dict[str, any]:
        """
        Get public user profile (no email).
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict containing public user profile data
            
        Raises:
            NotFoundError: If user is not found
        """
        profile = await self.get_user_profile(user_id)
        # Remove email from public profile
        profile.pop("email", None)
        return profile

    async def get_user_by_username(self, username: str) -> Dict[str, any]:
        """
        Get public user profile by username.
        
        Args:
            username: Username to look up
            
        Returns:
            Dict containing public user profile data
            
        Raises:
            NotFoundError: If user is not found
        """
        user = await self.user_repo.get_by_username(username)
        if not user:
            raise NotFoundError("User", username)
        
        return await self.get_public_user_profile(user.id)

    @monitor_query("update_user_profile")
    async def update_user_profile(
        self,
        user_id: int,
        username: Optional[str] = None,
        bio: Optional[str] = None,
        profile_image_url: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Update user profile.
        
        Args:
            user_id: ID of the user
            username: New username (optional)
            bio: New bio (optional)
            profile_image_url: New profile image URL (optional)
            
        Returns:
            Dict containing updated user profile data
            
        Raises:
            NotFoundError: If user is not found
            ConflictError: If username is already taken
            ValidationException: If validation fails
        """
        user = await self.user_repo.get_by_id_or_404(user_id)
        
        # Prepare update data
        update_data = {}
        
        # Validate and update username if provided
        if username is not None:
            self.validate_field_length(username, "username", 50, 3)
            
            # Check if username is already taken by another user
            if not await self.user_repo.check_username_availability(username, user_id):
                raise ConflictError("Username already taken", "user")
            
            update_data["username"] = username

        # Validate and update bio if provided
        if bio is not None:
            self.validate_field_length(bio, "bio", 500, 0)
            update_data["bio"] = bio

        # Update profile image URL if provided
        if profile_image_url is not None:
            update_data["profile_image_url"] = profile_image_url

        # Only update if there are changes
        if update_data:
            await self.user_repo.update(user, **update_data)
        
        logger.info(f"Updated profile for user {user_id}")
        
        return await self.get_user_profile(user_id)

    @monitor_query("get_user_posts")
    async def get_user_posts(
        self,
        user_id: int,
        current_user_id: int,
        limit: int = 20,
        offset: int = 0,
        public_only: bool = False
    ) -> List[Dict[str, any]]:
        """
        Get user's posts with engagement data.
        
        Args:
            user_id: ID of the user whose posts to get
            current_user_id: ID of the current user (for engagement data)
            limit: Maximum number of posts to return
            offset: Number of posts to skip
            public_only: Whether to only return public posts
            
        Returns:
            List of post dictionaries with engagement data
            
        Raises:
            NotFoundError: If user is not found
        """
        # Verify the user exists
        await self.user_repo.get_by_id_or_404(user_id)
        
        # Use repository method for posts with engagement data
        posts = await self.post_repo.get_posts_with_engagement(
            user_id=current_user_id,
            author_id=user_id,
            public_only=public_only,
            limit=limit,
            offset=offset
        )

        logger.info(f"Retrieved {len(posts)} posts for user {user_id}")
        return posts

    @monitor_query("validate_usernames_batch")
    async def validate_usernames_batch(self, usernames: List[str]) -> Dict[str, List[str]]:
        """
        Validate multiple usernames in a single database query.
        
        Args:
            usernames: List of usernames to validate
            
        Returns:
            Dict with 'valid_usernames' and 'invalid_usernames' lists
        """
        if not usernames:
            return {"valid_usernames": [], "invalid_usernames": []}
        
        # Get existing usernames from database
        existing_usernames = await self.user_repo.get_existing_usernames(usernames)
        
        # Convert to sets for efficient lookup
        existing_set = set(existing_usernames)
        input_set = set(usernames)
        
        # Determine valid and invalid usernames
        valid_usernames = [username for username in usernames if username in existing_set]
        invalid_usernames = [username for username in usernames if username not in existing_set]
        
        logger.info(f"Validated {len(usernames)} usernames: {len(valid_usernames)} valid, {len(invalid_usernames)} invalid")
        
        return {
            "valid_usernames": valid_usernames,
            "invalid_usernames": invalid_usernames
        }