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
            logger.info(f"Updated reaction for user {user_id} on post {post_id} to {emoji_code}")
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
            logger.info(f"Created new reaction for user {user_id} on post {post_id}: {emoji_code}")
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