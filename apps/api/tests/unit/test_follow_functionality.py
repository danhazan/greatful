"""
Unit tests for follow functionality.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.follow_service import FollowService
from app.repositories.follow_repository import FollowRepository
from app.repositories.user_repository import UserRepository
from app.models.follow import Follow
from app.models.user import User
from app.core.exceptions import NotFoundError, ConflictError, ValidationException, PermissionDeniedError


class TestFollowService:
    """Test cases for FollowService."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def mock_follow_repo(self):
        """Create mock follow repository."""
        return AsyncMock(spec=FollowRepository)

    @pytest.fixture
    def mock_user_repo(self):
        """Create mock user repository."""
        return AsyncMock(spec=UserRepository)

    @pytest.fixture
    def follow_service(self, mock_db, mock_follow_repo, mock_user_repo):
        """Create FollowService with mocked dependencies."""
        service = FollowService(mock_db)
        service.follow_repo = mock_follow_repo
        service.user_repo = mock_user_repo
        return service

    @pytest.fixture
    def sample_user1(self):
        """Create sample user 1."""
        from datetime import datetime, timezone
        return User(
            id=1,
            username="user1",
            email="user1@example.com",
            hashed_password="hashed",
            bio="User 1 bio",
            profile_image_url="https://example.com/user1.jpg",
            created_at=datetime.now(timezone.utc)
        )

    @pytest.fixture
    def sample_user2(self):
        """Create sample user 2."""
        from datetime import datetime, timezone
        return User(
            id=2,
            username="user2",
            email="user2@example.com",
            hashed_password="hashed",
            bio="User 2 bio",
            profile_image_url="https://example.com/user2.jpg",
            created_at=datetime.now(timezone.utc)
        )

    @pytest.fixture
    def sample_follow(self, sample_user1, sample_user2):
        """Create sample follow relationship."""
        from datetime import datetime, timezone
        return Follow(
            id="follow-123",
            follower_id=sample_user1.id,
            followed_id=sample_user2.id,
            status="active",
            created_at=datetime.now(timezone.utc)
        )

    async def test_follow_user_success(self, follow_service, mock_follow_repo, mock_user_repo, sample_user1, sample_user2, sample_follow):
        """Test successful user follow."""
        # Arrange
        mock_user_repo.get_by_id_or_404.side_effect = [sample_user1, sample_user2]
        mock_follow_repo.get_follow_relationship.return_value = None
        mock_follow_repo.create.return_value = sample_follow

        # Act
        result = await follow_service.follow_user(sample_user1.id, sample_user2.id)

        # Assert
        assert result["follower_id"] == sample_user1.id
        assert result["followed_id"] == sample_user2.id
        assert result["status"] == "active"
        assert result["follower"]["username"] == sample_user1.username
        assert result["followed"]["username"] == sample_user2.username
        
        mock_user_repo.get_by_id_or_404.assert_any_call(sample_user1.id)
        mock_user_repo.get_by_id_or_404.assert_any_call(sample_user2.id)
        mock_follow_repo.get_follow_relationship.assert_called_once_with(sample_user1.id, sample_user2.id)
        mock_follow_repo.create.assert_called_once_with(
            follower_id=sample_user1.id,
            followed_id=sample_user2.id,
            status="active"
        )

    async def test_follow_user_self_follow_error(self, follow_service, mock_user_repo):
        """Test error when trying to follow self."""
        # Arrange
        user_id = 1

        # Act & Assert
        with pytest.raises(ValidationException) as exc_info:
            await follow_service.follow_user(user_id, user_id)
        
        assert "Cannot follow yourself" in str(exc_info.value)
        mock_user_repo.get_by_id_or_404.assert_not_called()

    async def test_follow_user_already_following_error(self, follow_service, mock_follow_repo, mock_user_repo, sample_user1, sample_user2, sample_follow):
        """Test error when already following user."""
        # Arrange
        mock_user_repo.get_by_id_or_404.side_effect = [sample_user1, sample_user2]
        mock_follow_repo.get_follow_relationship.return_value = sample_follow

        # Act & Assert
        with pytest.raises(ConflictError) as exc_info:
            await follow_service.follow_user(sample_user1.id, sample_user2.id)
        
        assert "Already following this user" in str(exc_info.value)
        mock_follow_repo.create.assert_not_called()

    async def test_follow_user_pending_request_error(self, follow_service, mock_follow_repo, mock_user_repo, sample_user1, sample_user2):
        """Test error when follow request is pending."""
        # Arrange
        pending_follow = Follow(
            id="follow-123",
            follower_id=sample_user1.id,
            followed_id=sample_user2.id,
            status="pending"
        )
        
        mock_user_repo.get_by_id_or_404.side_effect = [sample_user1, sample_user2]
        mock_follow_repo.get_follow_relationship.return_value = pending_follow

        # Act & Assert
        with pytest.raises(ConflictError) as exc_info:
            await follow_service.follow_user(sample_user1.id, sample_user2.id)
        
        assert "Follow request already pending" in str(exc_info.value)

    async def test_follow_user_blocked_error(self, follow_service, mock_follow_repo, mock_user_repo, sample_user1, sample_user2):
        """Test error when user is blocked."""
        # Arrange
        blocked_follow = Follow(
            id="follow-123",
            follower_id=sample_user1.id,
            followed_id=sample_user2.id,
            status="blocked"
        )
        
        mock_user_repo.get_by_id_or_404.side_effect = [sample_user1, sample_user2]
        mock_follow_repo.get_follow_relationship.return_value = blocked_follow

        # Act & Assert
        with pytest.raises(PermissionDeniedError) as exc_info:
            await follow_service.follow_user(sample_user1.id, sample_user2.id)
        
        assert "Cannot follow this user" in str(exc_info.value)

    async def test_unfollow_user_success(self, follow_service, mock_follow_repo, sample_follow):
        """Test successful user unfollow."""
        # Arrange
        mock_follow_repo.get_follow_relationship.return_value = sample_follow
        mock_follow_repo.delete.return_value = True

        # Act
        result = await follow_service.unfollow_user(sample_follow.follower_id, sample_follow.followed_id)

        # Assert
        assert result is True
        mock_follow_repo.get_follow_relationship.assert_called_once_with(
            sample_follow.follower_id, sample_follow.followed_id
        )
        mock_follow_repo.delete.assert_called_once_with(sample_follow)

    async def test_unfollow_user_not_following_error(self, follow_service, mock_follow_repo):
        """Test error when trying to unfollow user not being followed."""
        # Arrange
        mock_follow_repo.get_follow_relationship.return_value = None

        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            await follow_service.unfollow_user(1, 2)
        
        assert "Follow relationship" in str(exc_info.value)
        mock_follow_repo.delete.assert_not_called()

    async def test_get_followers_success(self, follow_service, mock_follow_repo, mock_user_repo, sample_user1, sample_user2):
        """Test successful get followers."""
        # Arrange
        user_id = 1
        current_user_id = 3  # Different from follower ID
        followers = [sample_user2]
        total_count = 1
        
        mock_user_repo.get_by_id_or_404.return_value = sample_user1
        mock_follow_repo.get_followers.return_value = (followers, total_count)
        mock_follow_repo.is_following.return_value = True

        # Act
        result = await follow_service.get_followers(user_id, current_user_id, limit=10, offset=0)

        # Assert
        assert len(result["followers"]) == 1
        assert result["followers"][0]["id"] == sample_user2.id
        assert result["followers"][0]["username"] == sample_user2.username
        assert result["followers"][0]["is_following"] is True
        assert result["total_count"] == 1
        assert result["limit"] == 10
        assert result["offset"] == 0
        assert result["has_more"] is False

    async def test_get_following_success(self, follow_service, mock_follow_repo, mock_user_repo, sample_user1, sample_user2):
        """Test successful get following."""
        # Arrange
        user_id = 1
        current_user_id = 2
        following = [sample_user2]
        total_count = 1
        
        mock_user_repo.get_by_id_or_404.return_value = sample_user1
        mock_follow_repo.get_following.return_value = (following, total_count)
        mock_follow_repo.is_following.return_value = False

        # Act
        result = await follow_service.get_following(user_id, current_user_id, limit=10, offset=0)

        # Assert
        assert len(result["following"]) == 1
        assert result["following"][0]["id"] == sample_user2.id
        assert result["following"][0]["username"] == sample_user2.username
        assert result["following"][0]["is_following"] is False
        assert result["total_count"] == 1

    async def test_get_follow_status_mutual(self, follow_service, mock_follow_repo, sample_follow):
        """Test get follow status for mutual follow."""
        # Arrange
        reverse_follow = Follow(
            id="follow-456",
            follower_id=sample_follow.followed_id,
            followed_id=sample_follow.follower_id,
            status="active"
        )
        
        mock_follow_repo.get_follow_relationship.side_effect = [sample_follow, reverse_follow]

        # Act
        result = await follow_service.get_follow_status(sample_follow.follower_id, sample_follow.followed_id)

        # Assert
        assert result["is_following"] is True
        assert result["follow_status"] == "active"
        assert result["is_followed_by"] is True
        assert result["reverse_status"] == "active"
        assert result["is_mutual"] is True

    async def test_get_follow_status_one_way(self, follow_service, mock_follow_repo, sample_follow):
        """Test get follow status for one-way follow."""
        # Arrange
        mock_follow_repo.get_follow_relationship.side_effect = [sample_follow, None]

        # Act
        result = await follow_service.get_follow_status(sample_follow.follower_id, sample_follow.followed_id)

        # Assert
        assert result["is_following"] is True
        assert result["follow_status"] == "active"
        assert result["is_followed_by"] is False
        assert result["reverse_status"] is None
        assert result["is_mutual"] is False

    async def test_get_follow_stats_success(self, follow_service, mock_follow_repo, mock_user_repo, sample_user1):
        """Test successful get follow stats."""
        # Arrange
        stats = {
            "followers_count": 10,
            "following_count": 5,
            "pending_requests": 2,
            "pending_sent": 1
        }
        
        mock_user_repo.get_by_id_or_404.return_value = sample_user1
        mock_follow_repo.get_follow_stats.return_value = stats

        # Act
        result = await follow_service.get_follow_stats(sample_user1.id)

        # Assert
        assert result == stats
        mock_user_repo.get_by_id_or_404.assert_called_once_with(sample_user1.id)
        mock_follow_repo.get_follow_stats.assert_called_once_with(sample_user1.id)

    async def test_get_follow_suggestions_success(self, follow_service, mock_follow_repo, mock_user_repo, sample_user1, sample_user2):
        """Test successful get follow suggestions."""
        # Arrange
        suggestions = [sample_user2]
        
        mock_user_repo.get_by_id_or_404.return_value = sample_user1
        mock_follow_repo.get_follow_suggestions.return_value = suggestions

        # Act
        result = await follow_service.get_follow_suggestions(sample_user1.id, limit=10)

        # Assert
        assert len(result) == 1
        assert result[0]["id"] == sample_user2.id
        assert result[0]["username"] == sample_user2.username
        mock_follow_repo.get_follow_suggestions.assert_called_once_with(sample_user1.id, limit=10)

    async def test_bulk_check_following_success(self, follow_service, mock_follow_repo):
        """Test successful bulk check following."""
        # Arrange
        follower_id = 1
        user_ids = [2, 3, 4]
        status_map = {
            2: "active",
            3: None,
            4: "pending"
        }
        
        mock_follow_repo.bulk_check_following_status.return_value = status_map

        # Act
        result = await follow_service.bulk_check_following(follower_id, user_ids)

        # Assert
        assert result[2]["is_following"] is True
        assert result[2]["status"] == "active"
        assert result[3]["is_following"] is False
        assert result[3]["status"] is None
        assert result[4]["is_following"] is False
        assert result[4]["status"] == "pending"


class TestFollowModel:
    """Test cases for Follow model."""

    def test_follow_model_creation(self):
        """Test Follow model creation."""
        # Arrange & Act
        follow = Follow(
            id="follow-123",
            follower_id=1,
            followed_id=2,
            status="active"
        )

        # Assert
        assert follow.id == "follow-123"
        assert follow.follower_id == 1
        assert follow.followed_id == 2
        assert follow.status == "active"

    def test_follow_model_repr(self):
        """Test Follow model string representation."""
        # Arrange
        follow = Follow(
            id="follow-123",
            follower_id=1,
            followed_id=2,
            status="active"
        )

        # Act
        repr_str = repr(follow)

        # Assert
        assert "Follow(follower_id=1, followed_id=2, status=active)" in repr_str