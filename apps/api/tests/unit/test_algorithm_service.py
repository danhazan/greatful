"""
Unit tests for AlgorithmService.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.algorithm_service import AlgorithmService
from app.models.post import Post, PostType
from app.models.user import User
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.share import Share
from app.models.follow import Follow
from app.config.algorithm_config import AlgorithmConfigManager


class TestAlgorithmService:
    """Test cases for AlgorithmService."""

    @pytest.fixture
    def mock_db_session(self):
        """Create a mock database session."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def algorithm_service(self, mock_db_session):
        """Create AlgorithmService instance with mock session."""
        # Use production config for consistent test results
        with patch.dict('os.environ', {'ENVIRONMENT': 'production'}):
            # Clear the global config manager to force reload
            import app.config.algorithm_config as config_module
            config_module._config_manager = None
            return AlgorithmService(mock_db_session)

    @pytest.fixture
    def sample_post(self):
        """Create a sample post for testing."""
        post = Post(
            id="test-post-1",
            author_id=1,

            content="This is a test gratitude post",
            post_type=PostType.daily,
            image_url=None,
            is_public=True,
            created_at=datetime.now(timezone.utc)
        )
        return post

    @pytest.fixture
    def sample_user(self):
        """Create a sample user for testing."""
        user = User(
            id=1,
            username="testuser",
            email="test@example.com",
            hashed_password="hashed_password",
            bio="Test user bio",
            profile_image_url=None
        )
        return user

    async def test_calculate_post_score_basic(self, algorithm_service, sample_post, mock_db_session):
        """Test basic post score calculation with provided counts."""
        # Test with basic engagement
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=None,
            hearts_count=5,
            reactions_count=3,
            shares_count=2
        )
        
        # Expected: ((5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 2.0) * time_factor
        # Base: 5 + 4.5 + 8 + 2 = 19.5 (daily_gratitude_bonus changed from 3.0 to 2.0)
        # Time factor for recent post (default created_at is now): 1.0 + 4.0 = 5.0
        expected_base = 19.5
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_score = expected_base * time_factor
        assert score == expected_score

    async def test_calculate_post_score_photo_bonus(self, algorithm_service, sample_post, mock_db_session):
        """Test post score calculation with photo bonus."""
        sample_post.post_type = PostType.photo
        
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=None,
            hearts_count=5,
            reactions_count=3,
            shares_count=2
        )
        
        # Expected: ((5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 1.5) * time_factor
        # Base: 5 + 4.5 + 8 + 1.5 = 19.0 (photo_bonus changed from 2.5 to 1.5)
        expected_base = 19.0
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_score = expected_base * time_factor
        assert score == expected_score

    async def test_calculate_post_score_spontaneous_no_bonus(self, algorithm_service, sample_post, mock_db_session):
        """Test post score calculation for spontaneous posts (no content bonus)."""
        sample_post.post_type = PostType.spontaneous
        
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=None,
            hearts_count=5,
            reactions_count=3,
            shares_count=2
        )
        
        # Expected: ((5 * 1.0) + (3 * 1.5) + (2 * 4.0)) * time_factor
        # Base: 5 + 4.5 + 8 = 17.5
        expected_base = 17.5
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_score = expected_base * time_factor
        assert score == expected_score

    async def test_calculate_post_score_with_relationship_multiplier(self, algorithm_service, sample_post, mock_db_session):
        """Test post score calculation with relationship multiplier."""
        sample_post.author_id = 2  # Different from user_id
        
        # Mock follow relationship exists
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = "follow-id"
        mock_db_session.execute.return_value = mock_result
        
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=1,
            hearts_count=5,
            reactions_count=3,
            shares_count=2
        )
        
        # Expected: ((5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 2.0) * 5.0 * time_factor
        # Base: 19.5 * 5.0 = 97.5 (daily_gratitude_bonus changed from 3.0 to 2.0)
        expected_base = 97.5
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_score = expected_base * time_factor
        assert score == expected_score

    async def test_calculate_post_score_no_relationship_multiplier(self, algorithm_service, sample_post, mock_db_session):
        """Test post score calculation without relationship multiplier."""
        sample_post.author_id = 2  # Different from user_id
        
        # Mock no follow relationship
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result
        
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=1,
            hearts_count=5,
            reactions_count=3,
            shares_count=2
        )
        
        # Expected: ((5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 2.0) * time_factor
        # Base: 19.5 (no relationship multiplier, daily_gratitude_bonus changed from 3.0 to 2.0)
        expected_base = 19.5
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_score = expected_base * time_factor
        assert score == expected_score

    async def test_calculate_post_score_own_post_with_bonus(self, algorithm_service, sample_post, mock_db_session):
        """Test that own posts get own post bonus but no relationship multiplier."""
        sample_post.author_id = 1  # Same as user_id
        
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=1,
            hearts_count=5,
            reactions_count=3,
            shares_count=2
        )
        
        # Expected: ((5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 3.0) * time_factor * own_post_bonus
        # Base: 20.5 (no relationship multiplier for own post)
        expected_base = 20.5
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        
        # Calculate own post bonus (should be max bonus for recent post)
        from datetime import datetime, timezone
        current_time = datetime.now(timezone.utc)
        post_created_at = sample_post.created_at
        if post_created_at.tzinfo is None:
            post_created_at = post_created_at.replace(tzinfo=timezone.utc)
        minutes_old = (current_time - post_created_at).total_seconds() / 60
        own_post_bonus = algorithm_service._calculate_own_post_bonus(minutes_old)
        
        expected_score = expected_base * time_factor * own_post_bonus
        assert score == expected_score

    async def test_calculate_post_score_queries_counts_when_not_provided(self, algorithm_service, sample_post, mock_db_session):
        """Test that service queries engagement counts when not provided."""
        # Mock database queries for engagement counts
        mock_results = [
            MagicMock(scalar=MagicMock(return_value=5)),  # hearts
            MagicMock(scalar=MagicMock(return_value=3)),  # reactions
            MagicMock(scalar=MagicMock(return_value=2)),  # shares
        ]
        mock_db_session.execute.side_effect = mock_results
        
        score = await algorithm_service.calculate_post_score(sample_post, user_id=None)
        
        # Should have made 3 queries for engagement counts
        assert mock_db_session.execute.call_count == 3
        
        # Expected: ((5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 2.0) * time_factor
        # Base: 19.5 (daily_gratitude_bonus changed from 3.0 to 2.0)
        expected_base = 19.5
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_score = expected_base * time_factor
        assert score == expected_score

    async def test_calculate_post_score_zero_engagement(self, algorithm_service, sample_post, mock_db_session):
        """Test post score calculation with zero engagement."""
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=None,
            hearts_count=0,
            reactions_count=0,
            shares_count=0
        )
        
        # Expected: ((0 * 1.0) + (0 * 1.5) + (0 * 4.0) + 2.0) * time_factor
        # Base: 2.0 (only daily bonus, changed from 3.0 to 2.0)
        expected_base = 2.0
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_score = expected_base * time_factor
        assert score == expected_score

    async def test_get_personalized_feed_algorithm_disabled(self, algorithm_service, mock_db_session):
        """Test personalized feed with algorithm disabled (recency only)."""
        # Mock the _get_recent_feed method
        expected_posts = [
            {"id": "post-1", "algorithm_score": 0.0},
            {"id": "post-2", "algorithm_score": 0.0}
        ]
        algorithm_service._get_recent_feed = AsyncMock(return_value=(expected_posts, 2))
        
        # Mock get_by_id to return a user with last_feed_view
        mock_user = AsyncMock()
        mock_user.last_feed_view = None
        algorithm_service.get_by_id = AsyncMock(return_value=mock_user)
        
        posts, total_count = await algorithm_service.get_personalized_feed(
            user_id=1,
            limit=20,
            algorithm_enabled=False
        )
        
        assert posts == expected_posts
        assert total_count == 2
        algorithm_service._get_recent_feed.assert_called_once_with(1, 20, 0, True, None)

    async def test_get_personalized_feed_algorithm_enabled(self, algorithm_service, mock_db_session):
        """Test personalized feed with algorithm enabled (80/20 split)."""
        # Mock the helper methods
        algorithm_posts = [{"id": "algo-post-1", "algorithm_score": 25.0}]
        recent_posts = [{"id": "recent-post-1", "algorithm_score": 0.0}]
        
        algorithm_service._get_algorithm_scored_posts = AsyncMock(return_value=algorithm_posts)
        algorithm_service._get_recent_posts_excluding = AsyncMock(return_value=recent_posts)
        
        # Mock get_by_id to return a user with last_feed_view
        mock_user = AsyncMock()
        mock_user.last_feed_view = None
        algorithm_service.get_by_id = AsyncMock(return_value=mock_user)
        
        # Mock total count query
        mock_result = MagicMock()
        mock_result.scalar.return_value = 100
        mock_db_session.execute.return_value = mock_result
        
        posts, total_count = await algorithm_service.get_personalized_feed(
            user_id=1,
            limit=10,
            algorithm_enabled=True
        )
        
        # Should return combined posts
        assert len(posts) == 2
        assert posts[0]["id"] == "algo-post-1"
        assert posts[1]["id"] == "recent-post-1"
        assert total_count == 100
        
        # Verify 80/20 split calculations with updated parameters
        algorithm_service._get_algorithm_scored_posts.assert_called_once_with(1, 8, 0, True, None)  # 80% of 10
        algorithm_service._get_recent_posts_excluding.assert_called_once_with(1, 2, 0, {"algo-post-1"}, True, None)  # 20% of 10

    async def test_update_post_scores_batch(self, algorithm_service, sample_post, mock_db_session):
        """Test batch score updates for multiple posts."""
        # Mock get_by_id to return sample post
        algorithm_service.get_by_id = AsyncMock(return_value=sample_post)
        
        # Mock calculate_post_score
        algorithm_service.calculate_post_score = AsyncMock(return_value=15.5)
        
        post_ids = ["post-1", "post-2", "post-3"]
        scores = await algorithm_service.update_post_scores_batch(post_ids)
        
        assert len(scores) == 3
        assert all(score == 15.5 for score in scores.values())
        assert algorithm_service.get_by_id.call_count == 3
        assert algorithm_service.calculate_post_score.call_count == 3

    async def test_update_post_scores_batch_with_missing_post(self, algorithm_service, mock_db_session):
        """Test batch score updates handles missing posts gracefully."""
        # Mock get_by_id to return None for missing post
        algorithm_service.get_by_id = AsyncMock(side_effect=[None, None])
        
        post_ids = ["missing-post-1", "missing-post-2"]
        scores = await algorithm_service.update_post_scores_batch(post_ids)
        
        # Should return empty dict for missing posts
        assert len(scores) == 0

    async def test_get_trending_posts(self, algorithm_service, sample_post, sample_user, mock_db_session):
        """Test getting trending posts within time window."""
        # Mock database query result
        mock_row = MagicMock()
        mock_row.Post = sample_post
        mock_row.hearts_count = 10
        mock_row.reactions_count = 5
        mock_row.shares_count = 3
        
        sample_post.author = sample_user
        sample_post.created_at = datetime.now(timezone.utc) - timedelta(hours=2)  # 2 hours old
        
        mock_result = MagicMock()
        mock_result.all.return_value = [mock_row]
        mock_db_session.execute.return_value = mock_result
        
        trending_posts = await algorithm_service.get_trending_posts(
            user_id=1,
            limit=10,
            time_window_hours=24
        )
        
        assert len(trending_posts) == 1
        post = trending_posts[0]
        assert post["id"] == sample_post.id
        assert post["hearts_count"] == 10
        assert post["reactions_count"] == 5
        assert post["shares_count"] == 3
        assert "trending_score" in post
        assert post["trending_score"] > 0

    async def test_get_trending_posts_no_engagement(self, algorithm_service, sample_post, mock_db_session):
        """Test trending posts filters out posts with no engagement."""
        # Mock database query result with zero engagement
        mock_row = MagicMock()
        mock_row.Post = sample_post
        mock_row.hearts_count = 0
        mock_row.reactions_count = 0
        mock_row.shares_count = 0
        
        sample_post.created_at = datetime.now(timezone.utc)
        
        mock_result = MagicMock()
        mock_result.all.return_value = [mock_row]
        mock_db_session.execute.return_value = mock_result
        
        trending_posts = await algorithm_service.get_trending_posts(
            user_id=1,
            limit=10,
            time_window_hours=24
        )
        
        # Should filter out posts with zero engagement
        assert len(trending_posts) == 0

    async def test_scoring_formula_weights(self, algorithm_service, sample_post, mock_db_session):
        """Test that scoring formula uses correct weights."""
        # Get time factor for consistent calculation
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        
        # Test shares have highest weight (4.0)
        shares_score = await algorithm_service.calculate_post_score(
            sample_post, user_id=None, hearts_count=0, reactions_count=0, shares_count=1
        )
        
        # Test reactions have medium weight (1.5)
        reactions_score = await algorithm_service.calculate_post_score(
            sample_post, user_id=None, hearts_count=0, reactions_count=1, shares_count=0
        )
        
        # Test hearts have lowest weight (1.0)
        hearts_score = await algorithm_service.calculate_post_score(
            sample_post, user_id=None, hearts_count=1, reactions_count=0, shares_count=0
        )
        
        # Remove daily bonus and time factor for comparison
        # Formula: (base + daily_bonus) * time_factor
        shares_base = (shares_score / time_factor) - 2.0  # Should be 4.0 (daily_bonus changed to 2.0)
        reactions_base = (reactions_score / time_factor) - 2.0  # Should be 1.5
        hearts_base = (hearts_score / time_factor) - 2.0  # Should be 1.0
        
        assert abs(shares_base - 4.0) < 0.001
        assert abs(reactions_base - 1.5) < 0.001
        assert abs(hearts_base - 1.0) < 0.001
        assert shares_base > reactions_base > hearts_base

    async def test_content_type_bonuses(self, algorithm_service, sample_post, mock_db_session):
        """Test content type bonuses are applied correctly."""
        # Get time factor for consistent calculation
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        
        # Daily gratitude bonus (+3.0)
        sample_post.post_type = PostType.daily
        daily_score = await algorithm_service.calculate_post_score(
            sample_post, user_id=None, hearts_count=0, reactions_count=0, shares_count=0
        )
        
        # Photo bonus (+2.5)
        sample_post.post_type = PostType.photo
        photo_score = await algorithm_service.calculate_post_score(
            sample_post, user_id=None, hearts_count=0, reactions_count=0, shares_count=0
        )
        
        # Spontaneous (no bonus)
        sample_post.post_type = PostType.spontaneous
        spontaneous_score = await algorithm_service.calculate_post_score(
            sample_post, user_id=None, hearts_count=0, reactions_count=0, shares_count=0
        )
        
        # Account for time factor: score = bonus * time_factor
        expected_daily = 2.0 * time_factor  # Changed from 3.0 to 2.0
        expected_photo = 1.5 * time_factor  # Changed from 2.5 to 1.5
        expected_spontaneous = 0.0 * time_factor
        
        assert abs(daily_score - expected_daily) < 0.001
        assert abs(photo_score - expected_photo) < 0.001
        assert abs(spontaneous_score - expected_spontaneous) < 0.001
        assert daily_score > photo_score > spontaneous_score

    async def test_algorithm_service_uses_configuration(self, algorithm_service, sample_post, mock_db_session):
        """Test that AlgorithmService uses configuration values instead of hardcoded ones."""
        # Verify that the service has loaded configuration
        assert algorithm_service.config is not None
        assert hasattr(algorithm_service.config, 'scoring_weights')
        assert hasattr(algorithm_service.config, 'time_factors')
        assert hasattr(algorithm_service.config, 'follow_bonuses')
        
        # Test that scoring uses config values
        config = algorithm_service.config
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=None,
            hearts_count=1,
            reactions_count=1,
            shares_count=1
        )
        
        # Expected score should use config values including time factor
        expected_base = (
            1 * config.scoring_weights.hearts +
            1 * config.scoring_weights.reactions +
            1 * config.scoring_weights.shares
        )
        expected_with_bonus = expected_base + config.scoring_weights.daily_gratitude_bonus
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_total = expected_with_bonus * time_factor
        
        assert abs(score - expected_total) < 0.001

    async def test_algorithm_service_config_reload(self, algorithm_service, mock_db_session):
        """Test that AlgorithmService can reload configuration."""
        original_config = algorithm_service.config
        
        # Reload configuration
        algorithm_service.reload_config()
        
        # Should have reloaded (same values since environment didn't change)
        new_config = algorithm_service.config
        assert new_config.scoring_weights.hearts == original_config.scoring_weights.hearts

    async def test_get_config_summary(self, algorithm_service, mock_db_session):
        """Test that AlgorithmService can provide config summary."""
        summary = algorithm_service.get_config_summary()
        
        assert 'environment' in summary
        assert 'config' in summary
        assert isinstance(summary['config'], dict)

    async def test_apply_diversity_and_own_post_factors(self, algorithm_service, mock_db_session):
        """Test diversity limits and own post factors application."""
        # Create test posts
        current_time = datetime.now(timezone.utc)
        posts = [
            {
                'id': 'post-1',
                'author_id': 1,  # User's own post
                'algorithm_score': 10.0,
                'created_at': current_time.isoformat()
            },
            {
                'id': 'post-2',
                'author_id': 2,  # Other user's post
                'algorithm_score': 15.0,
                'created_at': (current_time - timedelta(hours=1)).isoformat()
            },
            {
                'id': 'post-3',
                'author_id': 1,  # Another own post (older)
                'algorithm_score': 8.0,
                'created_at': (current_time - timedelta(hours=2)).isoformat()
            }
        ]
        
        # Apply diversity and own post factors
        result_posts = algorithm_service._apply_diversity_and_own_post_factors(posts, user_id=1)
        
        # Should have applied own post multipliers
        own_posts = [p for p in result_posts if p['author_id'] == 1]
        other_posts = [p for p in result_posts if p['author_id'] != 1]
        
        # Own posts should have higher scores due to multipliers
        for own_post in own_posts:
            assert own_post['algorithm_score'] > 10.0  # Should be boosted
        
        # Other posts should have randomization applied but no own post boost
        for other_post in other_posts:
            # Score should be close to original (within randomization range)
            assert 12.0 <= other_post['algorithm_score'] <= 18.0  # 15.0 ± 15%

    async def test_relationship_multiplier_uses_config(self, algorithm_service, sample_post, mock_db_session):
        """Test that relationship multiplier uses configuration value."""
        sample_post.author_id = 2  # Different from user_id
        
        # Mock follow relationship exists
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = "follow-id"
        mock_db_session.execute.return_value = mock_result
        
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=1,
            hearts_count=1,
            reactions_count=1,
            shares_count=1
        )
        
        # Should use config follow bonus instead of hardcoded 2.0
        config = algorithm_service.config
        expected_base = (
            1 * config.scoring_weights.hearts +
            1 * config.scoring_weights.reactions +
            1 * config.scoring_weights.shares +
            config.scoring_weights.daily_gratitude_bonus
        )
        # Include time factor in calculation
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected_total = expected_base * config.follow_bonuses.base_multiplier * time_factor
        
        assert score == expected_total

    def test_calculate_time_factor_recent_posts(self, algorithm_service, sample_post):
        """Test time factor calculation for recent posts with graduated bonuses."""
        current_time = datetime.now(timezone.utc)
        
        # Test 30 minutes old (should get 1hr boost)
        sample_post.created_at = current_time - timedelta(minutes=30)
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected = 1.0 + algorithm_service.config.time_factors.recent_boost_1hr  # 1.0 + 4.0 = 5.0
        assert time_factor == expected
        
        # Test 3 hours old (should get 6hr boost)
        sample_post.created_at = current_time - timedelta(hours=3)
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected = 1.0 + algorithm_service.config.time_factors.recent_boost_6hr  # 1.0 + 2.0 = 3.0
        assert time_factor == expected
        
        # Test 12 hours old (should get 24hr boost)
        sample_post.created_at = current_time - timedelta(hours=12)
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected = 1.0 + algorithm_service.config.time_factors.recent_boost_24hr  # 1.0 + 1.0 = 2.0
        assert time_factor == expected

    def test_calculate_time_factor_older_posts(self, algorithm_service, sample_post):
        """Test time factor calculation for older posts with decay."""
        current_time = datetime.now(timezone.utc)
        
        # Test 30 hours old (should start decay)
        sample_post.created_at = current_time - timedelta(hours=30)
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        # Should be less than 1.0 due to decay, but greater than minimum
        assert 0.1 < time_factor < 1.0
        
        # Test at decay_hours (72 hours) - should reach minimum
        sample_post.created_at = current_time - timedelta(hours=72)
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        assert time_factor == 0.1
        
        # Test beyond decay_hours - should stay at minimum
        sample_post.created_at = current_time - timedelta(hours=100)
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        assert time_factor == 0.1

    def test_calculate_time_factor_no_created_at(self, algorithm_service, sample_post):
        """Test time factor calculation when post has no created_at."""
        sample_post.created_at = None
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        assert time_factor == 1.0

    def test_calculate_time_factor_timezone_handling(self, algorithm_service, sample_post):
        """Test time factor calculation handles timezone-naive datetimes."""
        current_time = datetime.now()  # timezone-naive
        sample_post.created_at = current_time - timedelta(minutes=30)
        
        # Should handle timezone-naive datetime without errors
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected = 1.0 + algorithm_service.config.time_factors.recent_boost_1hr
        assert time_factor == expected

    async def test_enhanced_time_factoring_in_score_calculation(self, algorithm_service, sample_post, mock_db_session):
        """Test that enhanced time factoring is applied in post score calculation."""
        current_time = datetime.now(timezone.utc)
        
        # Test recent post (1 hour old) gets time boost
        sample_post.created_at = current_time - timedelta(minutes=30)
        
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=None,
            hearts_count=1,
            reactions_count=1,
            shares_count=1
        )
        
        # Calculate expected score with time factor
        config = algorithm_service.config
        base_score = (
            1 * config.scoring_weights.hearts +
            1 * config.scoring_weights.reactions +
            1 * config.scoring_weights.shares +
            config.scoring_weights.daily_gratitude_bonus
        )
        time_factor = 1.0 + config.time_factors.recent_boost_1hr  # 5.0
        expected_score = base_score * time_factor
        
        assert score == expected_score

    async def test_time_factoring_prevents_feed_staleness(self, algorithm_service, sample_post, mock_db_session):
        """Test that time factoring prevents old high-engagement posts from dominating feed."""
        current_time = datetime.now(timezone.utc)
        
        # Create old high-engagement post
        old_post = Post(
            id="old-post",
            author_id=1,
            content="Old high-engagement post",
            post_type=PostType.daily,
            created_at=current_time - timedelta(hours=48),  # 2 days old
            is_public=True
        )
        
        # Create recent low-engagement post
        recent_post = Post(
            id="recent-post",
            author_id=1,
            content="Recent low-engagement post",
            post_type=PostType.daily,
            created_at=current_time - timedelta(minutes=30),  # 30 minutes old
            is_public=True
        )
        
        # Calculate scores
        old_score = await algorithm_service.calculate_post_score(
            old_post,
            user_id=None,
            hearts_count=50,  # High engagement
            reactions_count=30,
            shares_count=10
        )
        
        recent_score = await algorithm_service.calculate_post_score(
            recent_post,
            user_id=None,
            hearts_count=5,  # Low engagement
            reactions_count=3,
            shares_count=1
        )
        
        # Recent post should compete effectively due to time boost
        # Even with much lower engagement, it should get a significant boost
        assert recent_score > 0
        
        # The time factor should make recent posts more competitive
        recent_time_factor = algorithm_service._calculate_time_factor(recent_post)
        old_time_factor = algorithm_service._calculate_time_factor(old_post)
        
        # Recent post should have much higher time factor
        assert recent_time_factor > old_time_factor
        assert recent_time_factor > 4.0  # Should get the 1hr boost
        assert old_time_factor < 1.0  # Should get decay penalty

    def test_time_factor_configuration_usage(self, algorithm_service, sample_post):
        """Test that time factor calculation uses configuration values."""
        current_time = datetime.now(timezone.utc)
        config = algorithm_service.config.time_factors
        
        # Test that configuration values are used correctly
        sample_post.created_at = current_time - timedelta(minutes=30)
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        expected = 1.0 + config.recent_boost_1hr
        assert time_factor == expected
        
        # Test decay hours configuration
        sample_post.created_at = current_time - timedelta(hours=config.decay_hours)
        time_factor = algorithm_service._calculate_time_factor(sample_post)
        assert time_factor == 0.1  # Minimum decay value

    def test_time_factor_diversity_prevention(self, algorithm_service, sample_post):
        """Test that time factoring adds diversity to prevent feed staleness."""
        current_time = datetime.now(timezone.utc)
        
        # Test posts at different ages get different time factors
        ages_and_factors = []
        
        for hours in [0.5, 3, 12, 30, 48, 72]:
            sample_post.created_at = current_time - timedelta(hours=hours)
            time_factor = algorithm_service._calculate_time_factor(sample_post)
            ages_and_factors.append((hours, time_factor))
        
        # Verify that time factors decrease with age (generally)
        # Recent posts should have higher factors than old posts
        recent_factor = ages_and_factors[0][1]  # 0.5 hours
        old_factor = ages_and_factors[-1][1]  # 72 hours
        
        assert recent_factor > old_factor
        assert recent_factor > 4.0  # Should get significant boost
        assert old_factor == 0.1  # Should reach minimum decay