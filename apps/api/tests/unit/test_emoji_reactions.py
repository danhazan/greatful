"""
Unit tests for emoji reactions functionality.
Uses shared fixtures from conftest.py files.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post, PostType
from app.models.emoji_reaction import EmojiReaction
from app.services.reaction_service import ReactionService
import uuid


# Using shared test_post fixture from conftest.py


class TestEmojiReactionModel:
    """Test the EmojiReaction model."""

    def test_valid_emojis(self):
        """Test that valid emoji codes are recognized."""
        valid_codes = ['heart_eyes', 'heart_face', 'hug', 'pray', 'muscle', 'star', 'fire', 'clap', 'joy', 'thinking']
        
        for code in valid_codes:
            assert EmojiReaction.is_valid_emoji(code)

    def test_invalid_emojis(self):
        """Test that invalid emoji codes are rejected."""
        invalid_codes = ['angry', 'sad', 'thumbs_down', 'invalid']
        
        for code in invalid_codes:
            assert not EmojiReaction.is_valid_emoji(code)

    def test_emoji_display_property(self):
        """Test that emoji_display returns correct emoji characters."""
        reaction = EmojiReaction(emoji_code='heart_eyes')
        assert reaction.emoji_display == '😍'
        
    def test_missing_emojis_now_supported(self):
        """Test that previously missing emojis (joy, thinking) are now supported."""
        # These were causing issues before - now they should work
        assert EmojiReaction.is_valid_emoji('joy')
        assert EmojiReaction.is_valid_emoji('thinking')
        
        # Test their display
        joy_reaction = EmojiReaction(emoji_code='joy')
        assert joy_reaction.emoji_display == '😂'
        
        thinking_reaction = EmojiReaction(emoji_code='thinking')
        assert thinking_reaction.emoji_display == '🤔'
        
        # Test other emojis as well
        pray_reaction = EmojiReaction(emoji_code='pray')
        assert pray_reaction.emoji_display == '🙏'
        
        # Test invalid emoji fallback
        invalid_reaction = EmojiReaction(emoji_code='invalid')
        assert invalid_reaction.emoji_display == '❓'

    async def test_create_emoji_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test creating an emoji reaction."""
        reaction = EmojiReaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        db_session.add(reaction)
        await db_session.commit()
        await db_session.refresh(reaction)
        
        assert reaction.id is not None
        assert reaction.user_id == test_user.id
        assert reaction.post_id == test_post.id
        assert reaction.emoji_code == 'heart_eyes'
        assert reaction.emoji_display == '😍'


class TestReactionService:
    """Test the ReactionService business logic."""

    async def test_add_reaction_success(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test successfully adding a reaction."""
        service = ReactionService(db_session)
        reaction_data = await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        assert reaction_data["user_id"] == test_user.id
        assert reaction_data["post_id"] == test_post.id
        assert reaction_data["emoji_code"] == 'heart_eyes'

    async def test_add_reaction_invalid_emoji(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test adding reaction with invalid emoji code."""
        service = ReactionService(db_session)
        with pytest.raises(Exception, match="Invalid emoji code"):
            await service.add_reaction(
                user_id=test_user.id,
                post_id=test_post.id,
                emoji_code='invalid_emoji'
            )

    async def test_add_reaction_nonexistent_user(self, db_session: AsyncSession, test_post: Post):
        """Test adding reaction with nonexistent user."""
        from app.core.exceptions import NotFoundError
        service = ReactionService(db_session)
        with pytest.raises(NotFoundError) as exc_info:
            await service.add_reaction(
                user_id=99999,
                post_id=test_post.id,
                emoji_code='heart_eyes'
            )
        assert "User not found" in exc_info.value.detail

    async def test_add_reaction_nonexistent_post(self, db_session: AsyncSession, test_user: User):
        """Test adding reaction with nonexistent post."""
        from app.core.exceptions import NotFoundError
        service = ReactionService(db_session)
        with pytest.raises(NotFoundError) as exc_info:
            await service.add_reaction(
                user_id=test_user.id,
                post_id="nonexistent-post-id",
                emoji_code='heart_eyes'
            )
        assert "Post not found" in exc_info.value.detail

    async def test_update_existing_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test updating an existing reaction."""
        service = ReactionService(db_session)
        # Add initial reaction
        reaction1 = await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Update to different emoji
        reaction2 = await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='pray'
        )
        
        # Should be the same reaction object, just updated
        assert reaction1["id"] == reaction2["id"]
        assert reaction2["emoji_code"] == 'pray'

    async def test_remove_reaction_success(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test successfully removing a reaction."""
        service = ReactionService(db_session)
        # Add reaction first
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Remove reaction
        removed = await service.remove_reaction(
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert removed is True

    async def test_remove_nonexistent_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test removing a reaction that doesn't exist."""
        service = ReactionService(db_session)
        removed = await service.remove_reaction(
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert removed is False

    async def test_get_post_reactions(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting all reactions for a post."""
        service = ReactionService(db_session)
        # Add a reaction
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Get reactions
        reactions = await service.get_post_reactions(
            post_id=test_post.id
        )
        
        assert len(reactions) == 1
        assert reactions[0]["emoji_code"] == 'heart_eyes'
        assert reactions[0]["user"]["username"] == test_user.username

    async def test_get_user_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting a specific user's reaction."""
        service = ReactionService(db_session)
        # Add reaction
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='pray'
        )
        
        # Get user's reaction
        reaction = await service.get_user_reaction(
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert reaction is not None
        assert reaction.emoji_code == 'pray'

    async def test_get_reaction_counts(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting reaction counts grouped by emoji."""
        service = ReactionService(db_session)
        # Add reaction
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Get counts
        counts = await service.get_reaction_counts(
            post_id=test_post.id
        )
        
        assert counts['heart_eyes'] == 1

    async def test_get_total_reaction_count(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting total reaction count for a post."""
        service = ReactionService(db_session)
        # Initially should be 0
        count = await service.get_total_reaction_count(
            post_id=test_post.id
        )
        assert count == 0
        
        # Add reaction
        await service.add_reaction(
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Should now be 1
        count = await service.get_total_reaction_count(
            post_id=test_post.id
        )
        assert count == 1