"""
User service with standardized patterns.
"""

import logging
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ConflictError, ValidationException
from app.models.user import User
from app.models.post import Post

logger = logging.getLogger(__name__)


class UserService(BaseService):
    """Service for user operations."""

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
        user = await self.get_by_id_or_404(User, user_id, "User")
        
        # Get posts count
        posts_result = await self.db.execute(
            select(Post).where(Post.author_id == user_id)
        )
        posts_count = len(posts_result.scalars().all())
        
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "bio": user.bio,
            "profile_image_url": user.profile_image_url,
            "created_at": user.created_at.isoformat(),
            "posts_count": posts_count,
            "followers_count": 0,  # TODO: Implement with follow system
            "following_count": 0   # TODO: Implement with follow system
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
        user = await self.get_by_id_or_404(User, user_id, "User")
        
        # Validate and update username if provided
        if username is not None:
            self.validate_field_length(username, "username", 50, 3)
            
            # Check if username is already taken by another user
            existing_user = await User.get_by_username(self.db, username)
            if existing_user and existing_user.id != user_id:
                raise ConflictError("Username already taken", "user")
            
            user.username = username

        # Validate and update bio if provided
        if bio is not None:
            self.validate_field_length(bio, "bio", 500, 0)
            user.bio = bio

        # Update profile image URL if provided
        if profile_image_url is not None:
            user.profile_image_url = profile_image_url

        await self.db.commit()
        await self.db.refresh(user)
        
        logger.info(f"Updated profile for user {user_id}")
        
        return await self.get_user_profile(user_id)

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
        await self.get_by_id_or_404(User, user_id, "User")
        
        # Check if likes table exists
        has_likes_table = True
        try:
            await self.db.execute(text("SELECT 1 FROM likes LIMIT 1"))
        except Exception:
            has_likes_table = False
            logger.info("Likes table not found, using emoji reactions only")

        # Build query with engagement counts
        if has_likes_table:
            query = text("""
                SELECT p.id,
                       p.content,
                       p.post_type,
                       p.image_url,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       COALESCE(hearts.hearts_count, 0) as hearts_count,
                       COALESCE(reactions.reactions_count, 0) as reactions_count,
                       user_reactions.emoji_code as current_user_reaction,
                       CASE WHEN user_hearts.user_id IS NOT NULL THEN true ELSE false END as is_hearted
                FROM posts p
                LEFT JOIN (
                    SELECT post_id, COUNT(*) as hearts_count
                    FROM likes
                    GROUP BY post_id
                ) hearts ON hearts.post_id = p.id
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    GROUP BY post_id
                ) reactions ON reactions.post_id = p.id
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :current_user_id
                LEFT JOIN likes user_hearts ON user_hearts.post_id = p.id 
                    AND user_hearts.user_id = :current_user_id
                WHERE p.author_id = :target_user_id
                """ + (" AND p.is_public = true" if public_only else "") + """
                ORDER BY p.created_at DESC
                LIMIT :limit OFFSET :offset
            """)
        else:
            query = text("""
                SELECT p.id,
                       p.content,
                       p.post_type,
                       p.image_url,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       0 as hearts_count,
                       COALESCE(reactions.reactions_count, 0) as reactions_count,
                       user_reactions.emoji_code as current_user_reaction,
                       false as is_hearted
                FROM posts p
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    GROUP BY post_id
                ) reactions ON reactions.post_id = p.id
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :current_user_id
                WHERE p.author_id = :target_user_id
                """ + (" AND p.is_public = true" if public_only else "") + """
                ORDER BY p.created_at DESC
                LIMIT :limit OFFSET :offset
            """)

        result = await self.db.execute(query, {
            "current_user_id": current_user_id,
            "target_user_id": user_id,
            "limit": limit,
            "offset": offset
        })
        rows = result.fetchall()

        posts = []
        for row in rows:
            posts.append({
                "id": row.id,
                "content": row.content,
                "post_type": row.post_type,
                "image_url": row.image_url,
                "is_public": row.is_public,
                "created_at": str(row.created_at),
                "updated_at": str(row.updated_at) if row.updated_at else None,
                "hearts_count": int(row.hearts_count) if row.hearts_count else 0,
                "reactions_count": int(row.reactions_count) if row.reactions_count else 0,
                "current_user_reaction": row.current_user_reaction,
                "is_hearted": bool(row.is_hearted) if hasattr(row, 'is_hearted') else False
            })

        logger.info(f"Retrieved {len(posts)} posts for user {user_id}")
        return posts