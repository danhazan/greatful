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
from app.core.image_urls import serialize_image_url
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
        emoji_code: str,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add or update a user's emoji reaction to a post or object.
        
        Returns:
            Dict[str, Any]: The created or updated reaction
            
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
        
        # Check if user already has a reaction on this object
        existing_reaction = await self.reaction_repo.get_user_reaction(user_id, post_id, object_type, object_id)
        
        if existing_reaction:
            # Update existing reaction
            updated_reaction = await self.reaction_repo.update(existing_reaction, emoji_code=emoji_code)
            # Load the user relationship
            updated_reaction.user = user
            logger.info(f"Updated reaction for user {user_id} on {object_type} {object_id or post_id} to {emoji_code}")
            
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
            
            # Runtime invariant check: At most one reaction per user per object
            reaction_count = await self.reaction_repo.get_user_reaction_count(user_id, post_id, object_type, object_id)
            if reaction_count > 1:
                logger.error(
                    f"[REACTION_UNIQUENESS_ERROR] User {user_id} has {reaction_count} reactions on {object_type} {object_id or post_id}. "
                    f"Invariant violated: at most one reaction per user per object. "
                    f"See SYSTEM_CONTRACT_MAP.md#reaction-system"
                )
                from app.core.exceptions import InternalServerError
                raise InternalServerError("Reaction uniqueness invariant violated")
            
            return {
                "id": updated_reaction.id,
                "user_id": updated_reaction.user_id,
                "post_id": updated_reaction.post_id,
                "object_type": updated_reaction.object_type,
                "object_id": updated_reaction.object_id,
                "emoji_code": updated_reaction.emoji_code,
                "emoji_display": updated_reaction.emoji_display,
                "created_at": updated_reaction.created_at.isoformat(),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "profile_image_url": serialize_image_url(user.profile_image_url)
                }
            }
        else:
            # Create new reaction
            actual_object_id = object_id if object_id is not None else post_id
            reaction = await self.reaction_repo.create(
                user_id=user_id,
                post_id=post_id,
                object_type=object_type,
                object_id=actual_object_id,
                emoji_code=emoji_code
            )
            # Load the user relationship
            reaction.user = user
            logger.info(f"Created new reaction for user {user_id} on {object_type} {actual_object_id}: {emoji_code}")
            
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
                "object_type": reaction.object_type,
                "object_id": reaction.object_id,
                "emoji_code": reaction.emoji_code,
                "emoji_display": reaction.emoji_display,
                "created_at": reaction.created_at.isoformat(),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "profile_image_url": serialize_image_url(user.profile_image_url)
                }
            }

    @monitor_query("remove_reaction")
    async def remove_reaction(self, user_id: int, post_id: str, object_type: str = "post", object_id: Optional[str] = None) -> bool:
        """
        Remove a user's reaction from an object.
        """
        removed = await self.reaction_repo.delete_user_reaction(user_id, post_id, object_type, object_id)
        
        if removed:
            logger.info(f"Removed reaction for user {user_id} on {object_type} {object_id or post_id}")
        
        return removed

    @monitor_query("get_post_reactions")
    async def get_post_reactions(self, post_id: str, object_type: str = "post", object_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get all reactions for a specific object with user information.
        """
        reactions = await self.reaction_repo.get_post_reactions(post_id, load_users=True, object_type=object_type, object_id=object_id)
        
        return [
            {
                "id": reaction.id,
                "user_id": reaction.user_id,
                "post_id": reaction.post_id,
                "object_type": reaction.object_type,
                "object_id": reaction.object_id,
                "emoji_code": reaction.emoji_code,
                "emoji_display": reaction.emoji_display,
                "created_at": reaction.created_at.isoformat(),
                "user": {
                    "id": reaction.user.id,
                    "username": reaction.user.username,
                    "profile_image_url": serialize_image_url(reaction.user.profile_image_url)
                }
            }
            for reaction in reactions
        ]

    async def delete_all_post_reactions(self, post_id: str, object_type: Optional[str] = None, object_id: Optional[str] = None) -> int:
        """
        Delete all reactions for a specific post (or object).
        """
        count = await self.reaction_repo.delete_all_post_reactions(post_id, object_type, object_id)
        logger.info(f"Deleted {count} reactions for {object_type or 'post'} {object_id or post_id}")
        return count

    async def get_user_reaction(
        self, 
        user_id: int, 
        post_id: str,
        object_type: str = "post",
        object_id: Optional[str] = None
    ) -> Optional[EmojiReaction]:
        """
        Get a specific user's reaction to an object.
        """
        return await self.reaction_repo.get_user_reaction(user_id, post_id, object_type, object_id)

    @monitor_query("get_reaction_counts")
    async def get_reaction_counts(self, post_id: str, object_type: str = "post", object_id: Optional[str] = None) -> Dict[str, int]:
        """
        Get reaction counts grouped by emoji for an object or group.
        """
        return await self.reaction_repo.get_reaction_counts(post_id, object_type, object_id)

    @monitor_query("get_total_reaction_count")
    async def get_total_reaction_count(self, post_id: str, object_type: str = "post", object_id: Optional[str] = None) -> int:
        """
        Get total number of reactions for an object.
        """
        return await self.reaction_repo.get_total_reaction_count(post_id, object_type, object_id)

    async def get_user_interaction(self, user_id: int, post_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a user's interaction (reaction) with a post.
        This is the unified method that replaces separate like/reaction checks.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            Optional[Dict]: User's interaction data or None if no interaction
        """
        reaction = await self.get_user_reaction(user_id, post_id)
        
        if reaction:
            return {
                "type": "reaction",
                "emoji_code": reaction.emoji_code,
                "emoji_display": reaction.emoji_display,
                "created_at": reaction.created_at.isoformat()
            }
        
        return None

    async def set_user_interaction(
        self, 
        user_id: int, 
        post_id: str, 
        emoji_code: str
    ) -> Dict[str, Any]:
        """
        Set a user's interaction (reaction) with a post.
        This is the unified method that replaces separate like/reaction operations.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            emoji_code: Emoji code for the reaction
            
        Returns:
            Dict: Updated interaction data
        """
        return await self.add_reaction(user_id, post_id, emoji_code)

    async def remove_user_interaction(self, user_id: int, post_id: str) -> bool:
        """
        Remove a user's interaction (reaction) with a post.
        This is the unified method that replaces separate like/reaction removal.
        
        Args:
            user_id: ID of the user
            post_id: ID of the post
            
        Returns:
            bool: True if interaction was removed, False if no interaction existed
        """
        return await self.remove_reaction(user_id, post_id)
    @monitor_query("get_reaction_summary")
    async def get_reaction_summary(self, post_id: str, object_type: str = "post", object_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get a comprehensive summary of reactions for an object.
        Enforces invariant: total_count === sum(emoji_counts.values())
        """
        # Fetch counts from repository (which should now return unified counts)
        emoji_counts = await self.get_reaction_counts(post_id, object_type, object_id)
        
        # Calculate total directly from the map to guarantee the invariant
        calculated_total = sum(emoji_counts.values())
        
        # We can fetch the raw total just to verify integrity
        raw_total = await self.get_total_reaction_count(post_id)
        
        # Strictly enforce the invariant
        if calculated_total != raw_total:
            logger.error(
                f"[REACTION INTEGRITY ERROR] Invariant violated for post {post_id}: "
                f"calculated_total ({calculated_total}) != raw_total ({raw_total}). "
                f"Emoji counts: {emoji_counts}"
            )
            # User specifically requested this not silently proceed
            from app.core.exceptions import InternalServerError
            raise InternalServerError("Reaction count integrity violation")
            
        return {
            "post_id": post_id,
            "total_count": calculated_total,
            "emoji_counts": emoji_counts
        }
