"""
Tests for enhanced follow relationship multiplier functionality.
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from app.services.algorithm_service import AlgorithmService
from app.models.post import Post, PostType
from app.models.follow import Follow
from app.models.user_interaction import UserInteraction
from app.config.algorithm_config import get_algorithm_config


class TestEnhancedFollowMultiplier:
    """Test enhanced follow relationship multiplier calculations."""

    @pytest.fixture
    async def algorithm_service(self, db_session):
        """Create AlgorithmService instance for testing."""
        return AlgorithmService(db_session)

    @pytest.fixture
    async def sample_users(self, db_session):
        """Create sample users for testing."""
        from app.models.user import User
        
        users = []
        for i in range(5):
            user = User(
                username=f"testuser{i}",
                email=f"test{i}@example.com",
                hashed_password="hashed_password"
            )
            db_session.add(user)
            users.append(user)
        
        await db_session.commit()
        for user in users:
            await db_session.refresh(user)
        
        return users

    @pytest.fixture
    async def sample_post(self, db_session, sample_users):
        """Create a sample post for testing."""
        post = Post(
            author_id=sample_users[1].id,  # Author is user 1
            content="Test gratitude post",
            post_type=PostType.spontaneous,
            is_public=True
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        return post

    async def test_no_follow_relationship(self, algorithm_service, sample_users, sample_post):
        """Test that no follow relationship returns 1.0 multiplier."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        assert multiplier == 1.0

    async def test_direct_follow_base_multiplier(self, algorithm_service, db_session, sample_users, sample_post):
        """Test direct follow relationship returns base multiplier."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        # Create follow relationship (older than new follow threshold)
        follow = Follow(
            follower_id=user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=15)  # 15 days old
        )
        db_session.add(follow)
        await db_session.commit()
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        config = get_algorithm_config()
        expected = config.follow_bonuses.established_follow_bonus
        assert multiplier == expected

    async def test_new_follow_bonus_with_recent_boost(self, algorithm_service, db_session, sample_users, sample_post):
        """Test new follow relationship gets new follow bonus with recent boost."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        # Create follow relationship within both new threshold and recent boost range
        follow = Follow(
            follower_id=user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=5)  # 5 days old (within both thresholds)
        )
        db_session.add(follow)
        await db_session.commit()
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        config = get_algorithm_config()
        # Should get new follow bonus + recent boost
        expected_base = config.follow_bonuses.new_follow_bonus
        expected_recency = 1.0 + config.follow_bonuses.recent_follow_boost
        expected = expected_base * expected_recency
        assert multiplier == expected

    async def test_established_follow_bonus(self, algorithm_service, db_session, sample_users, sample_post):
        """Test established follow relationship gets established follow bonus."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        # Create follow relationship outside new threshold but within established threshold
        follow = Follow(
            follower_id=user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=15)  # 15 days old (established)
        )
        db_session.add(follow)
        await db_session.commit()
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        config = get_algorithm_config()
        expected = config.follow_bonuses.established_follow_bonus
        assert multiplier == expected

    async def test_mutual_follow_bonus(self, algorithm_service, db_session, sample_users, sample_post):
        """Test mutual follow relationship gets highest bonus."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        # Create mutual follow relationships
        follow1 = Follow(
            follower_id=user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=15)
        )
        follow2 = Follow(
            follower_id=post_author_id,
            followed_id=user_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=10)
        )
        db_session.add_all([follow1, follow2])
        await db_session.commit()
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        config = get_algorithm_config()
        expected = config.follow_bonuses.mutual_follow_bonus
        assert multiplier == expected

    async def test_recent_follow_boost(self, algorithm_service, db_session, sample_users, sample_post):
        """Test recent follow gets additional recency boost."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        # Create very recent follow relationship
        follow = Follow(
            follower_id=user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=2)  # 2 days old
        )
        db_session.add(follow)
        await db_session.commit()
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        config = get_algorithm_config()
        # Should get new follow bonus + recency boost
        expected_base = config.follow_bonuses.new_follow_bonus
        expected_recency = 1.0 + config.follow_bonuses.recent_follow_boost
        expected = expected_base * expected_recency
        
        assert multiplier == expected

    async def test_high_engagement_bonus(self, algorithm_service, db_session, sample_users, sample_post):
        """Test high engagement follow gets additional engagement bonus."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        # Create follow relationship
        follow = Follow(
            follower_id=user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=15)
        )
        db_session.add(follow)
        
        # Create multiple interactions to trigger high engagement bonus
        config = get_algorithm_config()
        interaction_count = config.follow_bonuses.high_engagement_threshold + 2
        
        for i in range(interaction_count):
            interaction = UserInteraction(
                user_id=user_id,
                target_user_id=post_author_id,
                interaction_type="heart",
                weight=1.0,
                created_at=datetime.now(timezone.utc) - timedelta(days=i)
            )
            db_session.add(interaction)
        
        await db_session.commit()
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        # Should get established follow bonus + engagement bonus
        expected_base = config.follow_bonuses.established_follow_bonus
        expected_engagement = 1.0 + config.follow_bonuses.high_engagement_bonus
        expected = expected_base * expected_engagement
        
        assert multiplier == expected

    async def test_second_tier_follow_bonus(self, algorithm_service, db_session, sample_users, sample_post):
        """Test second-tier follow relationship (users followed by your follows)."""
        user_id = sample_users[0].id  # Current user
        intermediate_user_id = sample_users[2].id  # User that current user follows
        post_author_id = sample_users[1].id  # Post author followed by intermediate user
        
        # Create first-tier follow: user -> intermediate_user
        follow1 = Follow(
            follower_id=user_id,
            followed_id=intermediate_user_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=10)
        )
        
        # Create second-tier follow: intermediate_user -> post_author
        follow2 = Follow(
            follower_id=intermediate_user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=5)
        )
        
        db_session.add_all([follow1, follow2])
        await db_session.commit()
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        config = get_algorithm_config()
        expected = config.follow_bonuses.second_tier_multiplier
        assert multiplier == expected

    async def test_combined_bonuses_mutual_recent_high_engagement(self, algorithm_service, db_session, sample_users, sample_post):
        """Test combination of mutual follow, recency, and high engagement bonuses."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        # Create mutual follow relationships (recent)
        follow1 = Follow(
            follower_id=user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=3)  # Recent
        )
        follow2 = Follow(
            follower_id=post_author_id,
            followed_id=user_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=2)
        )
        db_session.add_all([follow1, follow2])
        
        # Create high engagement interactions
        config = get_algorithm_config()
        interaction_count = config.follow_bonuses.high_engagement_threshold + 3
        
        for i in range(interaction_count):
            interaction = UserInteraction(
                user_id=user_id,
                target_user_id=post_author_id,
                interaction_type="reaction",
                weight=1.5,
                created_at=datetime.now(timezone.utc) - timedelta(days=i)
            )
            db_session.add(interaction)
        
        await db_session.commit()
        
        multiplier = await algorithm_service._calculate_follow_relationship_multiplier(
            user_id, post_author_id
        )
        
        # Should get mutual follow bonus + recency boost + engagement bonus
        expected_base = config.follow_bonuses.mutual_follow_bonus
        expected_recency = 1.0 + config.follow_bonuses.recent_follow_boost
        expected_engagement = 1.0 + config.follow_bonuses.high_engagement_bonus
        expected = expected_base * expected_recency * expected_engagement
        
        assert multiplier == expected

    async def test_post_score_with_enhanced_follow_multiplier(self, algorithm_service, db_session, sample_users, sample_post):
        """Test that enhanced follow multiplier is properly applied to post scoring."""
        user_id = sample_users[0].id
        post_author_id = sample_users[1].id
        
        # Create mutual follow relationship
        follow1 = Follow(
            follower_id=user_id,
            followed_id=post_author_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=5)
        )
        follow2 = Follow(
            follower_id=post_author_id,
            followed_id=user_id,
            status="active",
            created_at=datetime.now(timezone.utc) - timedelta(days=3)
        )
        db_session.add_all([follow1, follow2])
        await db_session.commit()
        
        # Calculate post score
        score = await algorithm_service.calculate_post_score(
            sample_post, 
            user_id=user_id,
            hearts_count=2,
            reactions_count=1,
            shares_count=0,
            consider_read_status=False
        )
        
        # Verify that the score includes the enhanced follow multiplier
        config = get_algorithm_config()
        expected_multiplier = config.follow_bonuses.mutual_follow_bonus * (1.0 + config.follow_bonuses.recent_follow_boost)
        
        # Base score calculation
        base_score = (2 * config.scoring_weights.hearts) + (1 * config.scoring_weights.reactions)
        
        # Score should be significantly higher due to follow multiplier
        assert score > base_score
        
        # Verify the multiplier is applied (allowing for time factors and other bonuses)
        assert score >= base_score * expected_multiplier * 0.8  # Allow some variance for time factors

    async def test_engagement_bonus_calculation(self, algorithm_service, db_session, sample_users):
        """Test engagement bonus calculation with different interaction counts."""
        user_id = sample_users[0].id
        target_user_id = sample_users[1].id
        
        # Test with no interactions
        bonus = await algorithm_service._calculate_follow_engagement_bonus(user_id, target_user_id)
        assert bonus == 1.0
        
        # Add interactions below threshold
        config = get_algorithm_config()
        for i in range(config.follow_bonuses.high_engagement_threshold - 1):
            interaction = UserInteraction(
                user_id=user_id,
                target_user_id=target_user_id,
                interaction_type="heart",
                weight=1.0,
                created_at=datetime.now(timezone.utc) - timedelta(days=i)
            )
            db_session.add(interaction)
        
        await db_session.commit()
        
        # Should still be 1.0 (below threshold)
        bonus = await algorithm_service._calculate_follow_engagement_bonus(user_id, target_user_id)
        assert bonus == 1.0
        
        # Add one more interaction to reach threshold
        interaction = UserInteraction(
            user_id=user_id,
            target_user_id=target_user_id,
            interaction_type="reaction",
            weight=1.5,
            created_at=datetime.now(timezone.utc)
        )
        db_session.add(interaction)
        await db_session.commit()
        
        # Should now get engagement bonus
        bonus = await algorithm_service._calculate_follow_engagement_bonus(user_id, target_user_id)
        expected = 1.0 + config.follow_bonuses.high_engagement_bonus
        assert bonus == expected

    async def test_second_tier_follow_detection(self, algorithm_service, db_session, sample_users):
        """Test second-tier follow detection with complex relationship chains."""
        user_id = sample_users[0].id
        intermediate1_id = sample_users[1].id
        intermediate2_id = sample_users[2].id
        target_user_id = sample_users[3].id
        
        # Create first-tier follows: user -> intermediate1, user -> intermediate2
        follow1 = Follow(
            follower_id=user_id,
            followed_id=intermediate1_id,
            status="active"
        )
        follow2 = Follow(
            follower_id=user_id,
            followed_id=intermediate2_id,
            status="active"
        )
        
        # Create second-tier follow: intermediate1 -> target_user
        follow3 = Follow(
            follower_id=intermediate1_id,
            followed_id=target_user_id,
            status="active"
        )
        
        db_session.add_all([follow1, follow2, follow3])
        await db_session.commit()
        
        # Should detect second-tier relationship
        bonus = await algorithm_service._calculate_second_tier_follow_bonus(user_id, target_user_id)
        config = get_algorithm_config()
        assert bonus == config.follow_bonuses.second_tier_multiplier
        
        # Test with non-existent second-tier relationship
        non_connected_user_id = sample_users[4].id
        bonus = await algorithm_service._calculate_second_tier_follow_bonus(user_id, non_connected_user_id)
        assert bonus == 1.0