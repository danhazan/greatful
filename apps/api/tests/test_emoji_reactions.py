"""
Unit tests for emoji reactions functionality.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.user import User
from app.models.post import Post, PostType
from app.models.emoji_reaction import EmojiReaction
from app.services.reaction_service import ReactionService
from app.core.security import get_password_hash
import uuid

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create test engine and session
test_engine = create_async_engine(TEST_DATABASE_URL, echo=True)
TestSessionLocal = sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture
async def db_session():
    """Create a test database session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("testpassword")
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_post(db_session: AsyncSession, test_user: User):
    """Create a test post."""
    post = Post(
        id=str(uuid.uuid4()),
        author_id=test_user.id,
        content="I'm grateful for testing!",
        post_type=PostType.daily,
        is_public=True
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


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
        reaction = await ReactionService.add_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        assert reaction.user_id == test_user.id
        assert reaction.post_id == test_post.id
        assert reaction.emoji_code == 'heart_eyes'

    async def test_add_reaction_invalid_emoji(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test adding reaction with invalid emoji code."""
        with pytest.raises(ValueError, match="Invalid emoji code"):
            await ReactionService.add_reaction(
                db=db_session,
                user_id=test_user.id,
                post_id=test_post.id,
                emoji_code='invalid_emoji'
            )

    async def test_add_reaction_nonexistent_user(self, db_session: AsyncSession, test_post: Post):
        """Test adding reaction with nonexistent user."""
        with pytest.raises(Exception, match="User .* not found"):
            await ReactionService.add_reaction(
                db=db_session,
                user_id=99999,
                post_id=test_post.id,
                emoji_code='heart_eyes'
            )

    async def test_add_reaction_nonexistent_post(self, db_session: AsyncSession, test_user: User):
        """Test adding reaction with nonexistent post."""
        with pytest.raises(Exception, match="Post .* not found"):
            await ReactionService.add_reaction(
                db=db_session,
                user_id=test_user.id,
                post_id="nonexistent-post-id",
                emoji_code='heart_eyes'
            )

    async def test_update_existing_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test updating an existing reaction."""
        # Add initial reaction
        reaction1 = await ReactionService.add_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Update to different emoji
        reaction2 = await ReactionService.add_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='pray'
        )
        
        # Should be the same reaction object, just updated
        assert reaction1.id == reaction2.id
        assert reaction2.emoji_code == 'pray'

    async def test_remove_reaction_success(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test successfully removing a reaction."""
        # Add reaction first
        await ReactionService.add_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Remove reaction
        removed = await ReactionService.remove_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert removed is True

    async def test_remove_nonexistent_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test removing a reaction that doesn't exist."""
        removed = await ReactionService.remove_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert removed is False

    async def test_get_post_reactions(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting all reactions for a post."""
        # Add a reaction
        await ReactionService.add_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Get reactions
        reactions = await ReactionService.get_post_reactions(
            db=db_session,
            post_id=test_post.id
        )
        
        assert len(reactions) == 1
        assert reactions[0].emoji_code == 'heart_eyes'
        assert reactions[0].user.username == test_user.username

    async def test_get_user_reaction(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting a specific user's reaction."""
        # Add reaction
        await ReactionService.add_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='pray'
        )
        
        # Get user's reaction
        reaction = await ReactionService.get_user_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id
        )
        
        assert reaction is not None
        assert reaction.emoji_code == 'pray'

    async def test_get_reaction_counts(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting reaction counts grouped by emoji."""
        # Add reaction
        await ReactionService.add_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Get counts
        counts = await ReactionService.get_reaction_counts(
            db=db_session,
            post_id=test_post.id
        )
        
        assert counts['heart_eyes'] == 1

    async def test_get_total_reaction_count(self, db_session: AsyncSession, test_user: User, test_post: Post):
        """Test getting total reaction count for a post."""
        # Initially should be 0
        count = await ReactionService.get_total_reaction_count(
            db=db_session,
            post_id=test_post.id
        )
        assert count == 0
        
        # Add reaction
        await ReactionService.add_reaction(
            db=db_session,
            user_id=test_user.id,
            post_id=test_post.id,
            emoji_code='heart_eyes'
        )
        
        # Should now be 1
        count = await ReactionService.get_total_reaction_count(
            db=db_session,
            post_id=test_post.id
        )
        assert count == 1