"""
Integration tests for mention multiplier functionality.
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.algorithm_service import AlgorithmService
from app.models.post import Post, PostType
from app.models.user import User
from app.models.mention import Mention


class TestMentionMultiplierIntegration:
    """Integration tests for mention multiplier in algorithm scoring."""

    @pytest.fixture
    async def users(self, db_session: AsyncSession):
        """Create test users."""
        user1 = User(
            username="author",
            email="author@example.com",
            hashed_password="hashed_password"
        )
        user2 = User(
            username="mentioned_user",
            email="mentioned@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add(user1)
        db_session.add(user2)
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        
        return user1, user2

    @pytest.fixture
    async def post_with_mention(self, db_session: AsyncSession, users):
        """Create a post with a mention."""
        author, mentioned_user = users
        
        post = Post(
            author_id=author.id,
            content="Thanks @mentioned_user for your help!",
            post_type=PostType.spontaneous,
            is_public=True,
            created_at=datetime.now(timezone.utc)
        )
        
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        # Create the mention record
        mention = Mention(
            post_id=post.id,
            author_id=author.id,
            mentioned_user_id=mentioned_user.id
        )
        
        db_session.add(mention)
        await db_session.commit()
        
        return post

    @pytest.fixture
    async def post_without_mention(self, db_session: AsyncSession, users):
        """Create a post without a mention."""
        author, _ = users
        
        post = Post(
            author_id=author.id,
            content="Just a regular post without mentions",
            post_type=PostType.spontaneous,
            is_public=True,
            created_at=datetime.now(timezone.utc)
        )
        
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        return post

    async def test_mention_bonus_applied_when_user_mentioned(
        self, 
        db_session: AsyncSession, 
        users, 
        post_with_mention
    ):
        """Test that mention bonus is applied when user is mentioned in post."""
        author, mentioned_user = users
        algorithm_service = AlgorithmService(db_session)
        
        # Calculate score for the mentioned user viewing the post
        score = await algorithm_service.calculate_post_score(
            post_with_mention,
            user_id=mentioned_user.id,
            hearts_count=0,
            reactions_count=0,
            shares_count=0
        )
        
        # Expected with multiplicative approach:
        # base_score = 1.0
        # engagement_multiplier = 1.0 + (0 * 1.0) + (0 * 1.5) + (0 * 4.0) = 1.0
        # content_multiplier = 1.0 (spontaneous post, no bonus)
        # mention_multiplier = 1.0 + 8.0 = 9.0 (mention bonus)
        # Final: 1.0 * 1.0 * 1.0 * 9.0 * time_factor = 9.0 * time_factor
        time_factor = algorithm_service._calculate_time_factor(post_with_mention)
        expected_score = 1.0 * 1.0 * 1.0 * 9.0 * time_factor
        
        assert score == expected_score

    async def test_no_mention_bonus_when_user_not_mentioned(
        self, 
        db_session: AsyncSession, 
        users, 
        post_without_mention
    ):
        """Test that no mention bonus is applied when user is not mentioned."""
        author, mentioned_user = users
        algorithm_service = AlgorithmService(db_session)
        
        # Calculate score for the mentioned user viewing a post without mentions
        score = await algorithm_service.calculate_post_score(
            post_without_mention,
            user_id=mentioned_user.id,
            hearts_count=0,
            reactions_count=0,
            shares_count=0
        )
        
        # Expected with multiplicative approach:
        # base_score = 1.0
        # engagement_multiplier = 1.0 + (0 * 1.0) + (0 * 1.5) + (0 * 4.0) = 1.0
        # content_multiplier = 1.0 (spontaneous post, no bonus)
        # mention_multiplier = 1.0 (no mention)
        # Final: 1.0 * 1.0 * 1.0 * 1.0 * time_factor = 1.0 * time_factor
        time_factor = algorithm_service._calculate_time_factor(post_without_mention)
        expected_score = 1.0 * 1.0 * 1.0 * 1.0 * time_factor
        
        assert score == expected_score

    async def test_mention_bonus_not_applied_to_author(
        self, 
        db_session: AsyncSession, 
        users, 
        post_with_mention
    ):
        """Test that mention bonus is not applied when post author views their own post."""
        author, mentioned_user = users
        algorithm_service = AlgorithmService(db_session)
        
        # Calculate score for the author viewing their own post
        score = await algorithm_service.calculate_post_score(
            post_with_mention,
            user_id=author.id,
            hearts_count=0,
            reactions_count=0,
            shares_count=0
        )
        
        # The score should include own post bonus but not mention bonus
        # Base score: 0 + 0 + 0 = 0
        # Own post base score: 1.0 (minimum for own posts)
        # No mention bonus (author doesn't get bonus for their own post)
        # Own post multiplier: varies based on post age
        # Time factor: varies but should be > 1 for recent posts
        
        time_factor = algorithm_service._calculate_time_factor(post_with_mention)
        
        # Calculate own post multiplier
        current_time = datetime.now(timezone.utc)
        post_created_at = post_with_mention.created_at
        if post_created_at.tzinfo is None:
            post_created_at = post_created_at.replace(tzinfo=timezone.utc)
        
        minutes_old = (current_time - post_created_at).total_seconds() / 60
        own_post_multiplier = algorithm_service._calculate_own_post_bonus(minutes_old)
        
        expected_base = 1.0  # Own post base score
        expected_score = expected_base * own_post_multiplier * time_factor
        
        assert score == expected_score

    async def test_mention_bonus_configuration_value(self, db_session: AsyncSession):
        """Test that mention bonus uses the configured value."""
        algorithm_service = AlgorithmService(db_session)
        
        # Check that the configured mention bonus value is used
        mention_bonuses = algorithm_service.config.mention_bonuses
        assert mention_bonuses.direct_mention == 8.0
        
        # Test the method directly
        # Create a mock mention in database for testing
        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        post = Post(
            author_id=1,  # Different author
            content="Test post",
            post_type=PostType.spontaneous,
            is_public=True,
            created_at=datetime.now(timezone.utc)
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        mention = Mention(
            post_id=post.id,
            author_id=1,
            mentioned_user_id=user.id
        )
        db_session.add(mention)
        await db_session.commit()
        
        # Test the mention bonus calculation
        bonus = await algorithm_service._calculate_mention_bonus(user.id, post.id)
        assert bonus == 8.0