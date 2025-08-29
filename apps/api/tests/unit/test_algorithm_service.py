"""
Unit tests for AlgorithmService.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.algorithm_service import AlgorithmService
from app.models.post import Post, PostType
from app.models.user import User
from app.models.like import Like
from app.models.emoji_reaction import EmojiReaction
from app.models.share import Share
from app.models.follow import Follow


class TestAlgorithmService:
    """Test cases for AlgorithmService."""

    @pytest.fixture
    def mock_db_session(self):
        """Create a mock database session."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def algorithm_service(self, mock_db_session):
        """Create AlgorithmService instance with mock session."""
        return AlgorithmService(mock_db_session)

    @pytest.fixture
    def sample_post(self):
        """Create a sample post for testing."""
        post = Post(
            id="test-post-1",
            author_id=1,
            title="Test Post",
            content="This is a test gratitude post",
            post_type=PostType.daily,
            image_url=None,
            is_public=True,
            created_at=datetime.utcnow()
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
        
        # Expected: (5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 3.0 (daily bonus) = 5 + 4.5 + 8 + 3 = 20.5
        expected_score = 20.5
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
        
        # Expected: (5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 2.5 (photo bonus) = 5 + 4.5 + 8 + 2.5 = 20.0
        expected_score = 20.0
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
        
        # Expected: (5 * 1.0) + (3 * 1.5) + (2 * 4.0) = 5 + 4.5 + 8 = 17.5
        expected_score = 17.5
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
        
        # Expected: ((5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 3.0) * 2.0 = 20.5 * 2.0 = 41.0
        expected_score = 41.0
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
        
        # Expected: (5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 3.0 = 20.5 (no multiplier)
        expected_score = 20.5
        assert score == expected_score

    async def test_calculate_post_score_own_post_no_multiplier(self, algorithm_service, sample_post, mock_db_session):
        """Test that own posts don't get relationship multiplier."""
        sample_post.author_id = 1  # Same as user_id
        
        score = await algorithm_service.calculate_post_score(
            sample_post,
            user_id=1,
            hearts_count=5,
            reactions_count=3,
            shares_count=2
        )
        
        # Expected: (5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 3.0 = 20.5 (no multiplier for own post)
        expected_score = 20.5
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
        
        # Expected: (5 * 1.0) + (3 * 1.5) + (2 * 4.0) + 3.0 = 20.5
        expected_score = 20.5
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
        
        # Expected: (0 * 1.0) + (0 * 1.5) + (0 * 4.0) + 3.0 = 3.0 (only daily bonus)
        expected_score = 3.0
        assert score == expected_score

    async def test_get_personalized_feed_algorithm_disabled(self, algorithm_service, mock_db_session):
        """Test personalized feed with algorithm disabled (recency only)."""
        # Mock the _get_recent_feed method
        expected_posts = [
            {"id": "post-1", "algorithm_score": 0.0},
            {"id": "post-2", "algorithm_score": 0.0}
        ]
        algorithm_service._get_recent_feed = AsyncMock(return_value=(expected_posts, 2))
        
        posts, total_count = await algorithm_service.get_personalized_feed(
            user_id=1,
            limit=20,
            algorithm_enabled=False
        )
        
        assert posts == expected_posts
        assert total_count == 2
        algorithm_service._get_recent_feed.assert_called_once_with(1, 20, 0)

    async def test_get_personalized_feed_algorithm_enabled(self, algorithm_service, mock_db_session):
        """Test personalized feed with algorithm enabled (80/20 split)."""
        # Mock the helper methods
        algorithm_posts = [{"id": "algo-post-1", "algorithm_score": 25.0}]
        recent_posts = [{"id": "recent-post-1", "algorithm_score": 0.0}]
        
        algorithm_service._get_algorithm_scored_posts = AsyncMock(return_value=algorithm_posts)
        algorithm_service._get_recent_posts_excluding = AsyncMock(return_value=recent_posts)
        
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
        
        # Verify 80/20 split calculations
        algorithm_service._get_algorithm_scored_posts.assert_called_once_with(1, 8, 0)  # 80% of 10
        algorithm_service._get_recent_posts_excluding.assert_called_once_with(1, 2, 0, {"algo-post-1"})  # 20% of 10

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
        sample_post.created_at = datetime.utcnow() - timedelta(hours=2)  # 2 hours old
        
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
        
        sample_post.created_at = datetime.utcnow()
        
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
        
        # Remove daily bonus for comparison (subtract 3.0)
        shares_base = shares_score - 3.0  # Should be 4.0
        reactions_base = reactions_score - 3.0  # Should be 1.5
        hearts_base = hearts_score - 3.0  # Should be 1.0
        
        assert shares_base == 4.0
        assert reactions_base == 1.5
        assert hearts_base == 1.0
        assert shares_base > reactions_base > hearts_base

    async def test_content_type_bonuses(self, algorithm_service, sample_post, mock_db_session):
        """Test content type bonuses are applied correctly."""
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
        
        assert daily_score == 3.0
        assert photo_score == 2.5
        assert spontaneous_score == 0.0
        assert daily_score > photo_score > spontaneous_score