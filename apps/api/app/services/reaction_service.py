"""
ReactionService for handling emoji reactions business logic using repository pattern.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ValidationException, BusinessLogicError
from app.core.query_monitor import monitor_query
from app.repositories.emoji_reaction_repository import EmojiReactionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.post_repository import PostRepository
from app.models.emoji_reaction import EmojiReaction
from app.models.user import User
from app.models.post import Post
from app.core.notification_factory import NotificationFactory
import logging

logger = logging.getLogger(__name__)


class ReactionService(BaseService):
    """Service for managing emoji reactions on posts using repository pattern."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.reaction_repo = EmojiReactionRepository(db)
        self.user_repo = UserRepository(db)
        self.post_repo = PostRepository(db)

    @monitor_query("add_reaction")
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
        user = await self.user_repo.get_by_id_or_404(user_id)
        post = await self.post_repo.get_by_id_or_404(post_id)
        
        # Check if user already has a reaction on this post
        existing_reaction = await self.reaction_repo.get_user_reaction(user_id, post_id)
        
        if existing_reaction:
            # Update existing reaction
            updated_reaction = await self.reaction_repo.update(existing_reaction, emoji_code=emoji_code)
            # Load the user relationship
            updated_reaction.user = user
            logger.info(f"Updated reaction for user {user_id} on post {post_id} to {emoji_code}")
            
            # Create notification for updated reaction using NotificationFactory
            if post.author_id != user_id:  # Don't notify if user reacts to their own post
                try:
                    notification_factory = NotificationFactory(self.db)
                    await notification_factory.create_reaction_notification(
                        post_author_id=post.author_id,
                        reactor_username=user.username,
                        reactor_id=user_id,
                        post_id=post_id,
                        emoji_code=emoji_code
                    )
                except Exception as e:
                    logger.error(f"Failed to create notification for reaction update: {e}")
                    # Don't fail the reaction if notification fails
            
            return {
                "id": updated_reaction.id,
                "user_id": updated_reaction.user_id,
                "post_id": updated_reaction.post_id,
                "emoji_code": updated_reaction.emoji_code,
                "emoji_display": updated_reaction.emoji_display,
                "created_at": updated_reaction.created_at.isoformat(),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "profile_image_url": user.profile_image_url
                }
            }
        else:
            # Create new reaction
            reaction = await self.reaction_repo.create(
                user_id=user_id,
                post_id=post_id,
                emoji_code=emoji_code
            )
            # Load the user relationship
            reaction.user = user
            logger.info(f"Created new reaction for user {user_id} on post {post_id}: {emoji_code}")
            
            # Create notification for new reaction using NotificationFactory
            if post.author_id != user_id:  # Don't notify if user reacts to their own post
                try:
                    notification_factory = NotificationFactory(self.db)
                    await notification_factory.create_reaction_notification(
                        post_author_id=post.author_id,
                        reactor_username=user.username,
                        reactor_id=user_id,
                        post_id=post_id,
                        emoji_code=emoji_code
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

    @monitor_query("remove_reaction")
    async def remove_reaction(self, user_id: int, post_id: str) -> bool:
        """
        Remove a user's reaction from a post.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            bool: True if reaction was removed, False if no reaction existed
        """
        removed = await self.reaction_repo.delete_user_reaction(user_id, post_id)
        
        if removed:
            logger.info(f"Removed reaction for user {user_id} on post {post_id}")
        
        return removed

    @monitor_query("get_post_reactions")
    async def get_post_reactions(self, post_id: str) -> List[Dict[str, Any]]:
        """
        Get all reactions for a specific post with user information.
        
        Args:
            post_id: ID of the post
            
        Returns:
            List[Dict]: List of reaction dictionaries with user data
        """
        reactions = await self.reaction_repo.get_post_reactions(post_id, load_users=True)
        
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

    async def delete_all_post_reactions(self, post_id: str) -> int:
        """
        Delete all reactions for a specific post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            int: Number of reactions deleted
        """
        count = await self.reaction_repo.delete_all_post_reactions(post_id)
        logger.info(f"Deleted {count} reactions for post {post_id}")
        return count

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
        return await self.reaction_repo.get_user_reaction(user_id, post_id)

    @monitor_query("get_reaction_counts")
    async def get_reaction_counts(self, post_id: str) -> Dict[str, int]:
        """
        Get reaction counts grouped by emoji for a post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            dict: Dictionary with emoji codes as keys and counts as values
        """
        return await self.reaction_repo.get_reaction_counts(post_id)

    @monitor_query("get_total_reaction_count")
    async def get_total_reaction_count(self, post_id: str) -> int:
        """
        Get total number of reactions for a post.
        
        Args:
            post_id: ID of the post
            
        Returns:
            int: Total reaction count
        """
        return await self.reaction_repo.get_total_reaction_count(post_id)