"""
ReactionService for handling emoji reactions business logic.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ValidationException, BusinessLogicError
from app.models.emoji_reaction import EmojiReaction
from app.models.user import User
from app.models.post import Post
from app.services.notification_service import NotificationService
import logging

logger = logging.getLogger(__name__)


class ReactionService(BaseService):
    """Service for managing emoji reactions on posts."""

    async def add_reaction(
        self, 
        user_id: int, 
        post_id: str, 
        emoji_code: str
    ) -> Dict[str, Any]:
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

        # Validate emoji code
        if not EmojiReaction.is_valid_emoji(emoji_code):
            raise ValidationException(f"Invalid emoji code: {emoji_code}")
        
        # Check if user and post exist
        user = await self.get_by_id_or_404(User, user_id, "User")
        post = await self.get_by_id_or_404(Post, post_id, "Post")
        
        # Check if user already has a reaction on this post
        existing_reaction = await self.get_user_reaction(user_id, post_id)
        
        if existing_reaction:
            # Update existing reaction
            existing_reaction.emoji_code = emoji_code
            await self.db.commit()
            await self.db.refresh(existing_reaction)
            # Load the user relationship
            existing_reaction.user = user
            logger.info(f"Updated reaction for user {user_id} on post {post_id} to {emoji_code}")
            
            # Create notification for updated reaction (only if it's a different emoji)
            if post.author_id != user_id:  # Don't notify if user reacts to their own post
                try:
                    notification = await NotificationService.create_emoji_reaction_notification(
                        db=self.db,
                        post_author_id=post.author_id,
                        reactor_username=user.username,
                        emoji_code=emoji_code,
                        post_id=post_id
                    )
                except Exception as e:
                    logger.error(f"Failed to create notification for reaction update: {e}")
                    # Don't fail the reaction if notification fails
            
            return {
                "id": existing_reaction.id,
                "user_id": existing_reaction.user_id,
                "post_id": existing_reaction.post_id,
                "emoji_code": existing_reaction.emoji_code,
                "emoji_display": existing_reaction.emoji_display,
                "created_at": existing_reaction.created_at.isoformat(),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "profile_image_url": user.profile_image_url
                }
            }
        else:
            # Create new reaction
            reaction = await self.create_entity(
                EmojiReaction,
                user_id=user_id,
                post_id=post_id,
                emoji_code=emoji_code
            )
            # Load the user relationship
            reaction.user = user
            logger.info(f"Created new reaction for user {user_id} on post {post_id}: {emoji_code}")
            
            # Create notification for new reaction
            if post.author_id != user_id:  # Don't notify if user reacts to their own post
                try:
                    notification = await NotificationService.create_emoji_reaction_notification(
                        db=self.db,
                        post_author_id=post.author_id,
                        reactor_username=user.username,
                        emoji_code=emoji_code,
                        post_id=post_id
                    )
                except Exception as e:
                    logger.error(f"Failed to create notification for new reaction: {e}")
                    # Don't fail the reaction if notification fails
            
            return {
                "id": reaction.id,
                "user_id": reaction.user_id,
                "post_id": reaction.post_id,
                "emoji_code": reaction.emoji_code,
                "emoji_display": reaction.emoji_display,
                "created_at": reaction.created_at.isoformat(),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "profile_image_url": user.profile_image_url
                }
            }

    async def remove_reaction(self, user_id: int, post_id: str) -> bool:
        """
        Remove a user's reaction from a post.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            bool: True if reaction was removed, False if no reaction existed
        """
        reaction = await self.get_user_reaction(user_id, post_id)
        
        if reaction:
            await self.delete_entity(reaction)
            logger.info(f"Removed reaction for user {user_id} on post {post_id}")
            return True
        
        return False

    async def get_post_reactions(self, post_id: str) -> List[Dict[str, Any]]:
        """
        Get all reactions for a specific post with user information.
        
        Args:
            post_id: ID of the post
            
        Returns:
            List[Dict]: List of reaction dictionaries with user data
        """
        result = await self.db.execute(
            select(EmojiReaction)
            .options(selectinload(EmojiReaction.user))
            .where(EmojiReaction.post_id == post_id)
            .order_by(EmojiReaction.created_at.desc())
        )
        reactions = result.scalars().all()
        
        return [
            {
                "id": reaction.id,
                "user_id": reaction.user_id,
                "post_id": reaction.post_id,
                "emoji_code": reaction.emoji_code,
                "emoji_display": reaction.emoji_display,
                "created_at": reaction.created_at.isoformat(),
                "user": {
                    "id": reaction.user.id,
                    "username": reaction.user.username,
                    "profile_image_url": reaction.user.profile_image_url
                }
            }
            for reaction in reactions
        ]

    async def get_user_reaction(
        self, 
        user_id: int, 
        post_id: str
    ) -> Optional[EmojiReaction]:
        """
        Get a specific user's reaction to a post.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            Optional[EmojiReaction]: The user's reaction if it exists
        """
        result = await self.db.execute(
            select(EmojiReaction)
            .where(
                EmojiReaction.user_id == user_id,
                EmojiReaction.post_id == post_id
            )
        )
        return result.scalar_one_or_none()

    async def get_reaction_counts(self, post_id: str) -> Dict[str, int]:
        """
        Get reaction counts grouped by emoji for a post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            dict: Dictionary with emoji codes as keys and counts as values
        """
        result = await self.db.execute(
            select(EmojiReaction.emoji_code, func.count(EmojiReaction.id))
            .where(EmojiReaction.post_id == post_id)
            .group_by(EmojiReaction.emoji_code)
        )
        
        counts = {}
        for emoji_code, count in result.fetchall():
            counts[emoji_code] = count
            
        return counts

    async def get_total_reaction_count(self, post_id: str) -> int:
        """
        Get total number of reactions for a post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            int: Total reaction count
        """
        result = await self.db.execute(
            select(func.count(EmojiReaction.id))
            .where(EmojiReaction.post_id == post_id)
        )
        return result.scalar() or 0