"""
Tests for the NotificationFactory - centralized notification creation.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.notification_factory import NotificationFactory
from app.repositories.notification_repository import NotificationRepository


class TestNotificationFactory:
    """Test the NotificationFactory class."""

    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def mock_notification_repo(self):
        """Mock notification repository."""
        return AsyncMock(spec=NotificationRepository)

    @pytest.fixture
    def notification_factory(self, mock_db, mock_notification_repo):
        """Create NotificationFactory with mocked dependencies."""
        factory = NotificationFactory(mock_db)
        factory.notification_repo = mock_notification_repo
        return factory

    @pytest.mark.asyncio
    async def test_create_notification_success(self, notification_factory, mock_notification_repo):
        """Test successful notification creation."""
        # Arrange
        mock_notification = MagicMock()
        mock_notification.id = "test-notification-123"
        mock_notification_repo.create.return_value = mock_notification

        # Act
        result = await notification_factory.create_notification(
            user_id=123,
            notification_type="test_type",
            title="Test Title",
            message="Test message",
            data={"test": "data"}
        )

        # Assert
        assert result == mock_notification
        mock_notification_repo.create.assert_called_once_with(
            user_id=123,
            type="test_type",
            title="Test Title",
            message="Test message",
            data={"test": "data"}
        )

    @pytest.mark.asyncio
    async def test_create_notification_prevents_self_notification(self, notification_factory, mock_notification_repo):
        """Test that self-notifications are prevented when enabled."""
        # Act
        result = await notification_factory.create_notification(
            user_id=123,
            notification_type="test_type",
            title="Test Title",
            message="Test message",
            data={"test": "data"},
            prevent_self_notification=True,
            self_user_id=123  # Same as user_id
        )

        # Assert
        assert result is None
        mock_notification_repo.create.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_notification_allows_different_users(self, notification_factory, mock_notification_repo):
        """Test that notifications are created when users are different."""
        # Arrange
        mock_notification = MagicMock()
        mock_notification_repo.create.return_value = mock_notification

        # Act
        result = await notification_factory.create_notification(
            user_id=123,
            notification_type="test_type",
            title="Test Title",
            message="Test message",
            data={"test": "data"},
            prevent_self_notification=True,
            self_user_id=456  # Different from user_id
        )

        # Assert
        assert result == mock_notification
        mock_notification_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_notification_handles_exception(self, notification_factory, mock_notification_repo):
        """Test that exceptions are handled gracefully."""
        # Arrange
        mock_notification_repo.create.side_effect = Exception("Database error")

        # Act
        result = await notification_factory.create_notification(
            user_id=123,
            notification_type="test_type",
            title="Test Title",
            message="Test message",
            data={"test": "data"}
        )

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_create_share_notification_message(self, notification_factory, mock_notification_repo):
        """Test share notification creation for message sharing."""
        # Arrange
        mock_notification = MagicMock()
        mock_notification_repo.create.return_value = mock_notification

        # Act
        result = await notification_factory.create_share_notification(
            recipient_id=123,
            sharer_username="test_user",
            sharer_id=456,
            post_id="post-123",
            share_method="message"
        )

        # Assert
        assert result == mock_notification
        mock_notification_repo.create.assert_called_once()
        call_args = mock_notification_repo.create.call_args
        assert call_args[1]["user_id"] == 123
        assert call_args[1]["type"] == "post_shared"
        assert call_args[1]["title"] == "Post Sent"
        assert "test_user sent you a post" in call_args[1]["message"]
        assert call_args[1]["data"]["sharer_username"] == "test_user"
        assert call_args[1]["data"]["share_method"] == "message"

    @pytest.mark.asyncio
    async def test_create_share_notification_url(self, notification_factory, mock_notification_repo):
        """Test share notification creation for URL sharing."""
        # Arrange
        mock_notification = MagicMock()
        mock_notification_repo.create.return_value = mock_notification

        # Act
        result = await notification_factory.create_share_notification(
            recipient_id=123,
            sharer_username="test_user",
            sharer_id=456,
            post_id="post-123",
            share_method="url"
        )

        # Assert
        assert result == mock_notification
        call_args = mock_notification_repo.create.call_args
        assert call_args[1]["title"] == "Post Shared"
        assert "test_user shared your post" in call_args[1]["message"]
        assert call_args[1]["data"]["share_method"] == "url"

    @pytest.mark.asyncio
    async def test_create_mention_notification(self, notification_factory, mock_notification_repo):
        """Test mention notification creation."""
        # Arrange
        mock_notification = MagicMock()
        mock_notification_repo.create.return_value = mock_notification

        # Act
        result = await notification_factory.create_mention_notification(
            mentioned_user_id=123,
            author_username="author_user",
            author_id=456,
            post_id="post-123",
            post_preview="This is a test post..."
        )

        # Assert
        assert result == mock_notification
        call_args = mock_notification_repo.create.call_args
        assert call_args[1]["user_id"] == 123
        assert call_args[1]["type"] == "mention"
        assert call_args[1]["title"] == "You were mentioned"
        assert "author_user mentioned you in a post" in call_args[1]["message"]
        assert call_args[1]["data"]["author_username"] == "author_user"
        assert call_args[1]["data"]["post_preview"] == "This is a test post..."

    @pytest.mark.asyncio
    async def test_create_mention_notification_prevents_self_mention(self, notification_factory, mock_notification_repo):
        """Test that self-mentions are prevented."""
        # Act
        result = await notification_factory.create_mention_notification(
            mentioned_user_id=123,
            author_username="test_user",
            author_id=123,  # Same as mentioned_user_id
            post_id="post-123",
            post_preview="This is a test post..."
        )

        # Assert
        assert result is None
        mock_notification_repo.create.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_reaction_notification(self, notification_factory, mock_notification_repo):
        """Test reaction notification creation."""
        # Arrange
        mock_notification = MagicMock()
        mock_notification_repo.create.return_value = mock_notification

        # Act
        result = await notification_factory.create_reaction_notification(
            post_author_id=123,
            reactor_username="reactor_user",
            reactor_id=456,
            post_id="post-123",
            emoji_code="clap"  # Use a valid emoji code
        )

        # Assert
        assert result == mock_notification
        call_args = mock_notification_repo.create.call_args
        assert call_args[1]["user_id"] == 123
        assert call_args[1]["type"] == "emoji_reaction"
        assert call_args[1]["title"] == "New Reaction"
        # Should use actual emoji (👏) instead of code (clap)
        assert "reactor_user reacted to your post with 👏" in call_args[1]["message"]
        assert call_args[1]["data"]["reactor_username"] == "reactor_user"
        assert call_args[1]["data"]["emoji_code"] == "clap"

    @pytest.mark.asyncio
    async def test_create_like_notification(self, notification_factory, mock_notification_repo):
        """Test like notification creation."""
        # Arrange
        mock_notification = MagicMock()
        mock_notification_repo.create.return_value = mock_notification

        # Act
        result = await notification_factory.create_like_notification(
            post_author_id=123,
            liker_username="liker_user",
            liker_id=456,
            post_id="post-123"
        )

        # Assert
        assert result == mock_notification
        call_args = mock_notification_repo.create.call_args
        assert call_args[1]["user_id"] == 123
        assert call_args[1]["type"] == "like"
        assert call_args[1]["title"] == "New Like"
        assert "liker_user liked your post" in call_args[1]["message"]
        assert call_args[1]["data"]["liker_username"] == "liker_user"

    @pytest.mark.asyncio
    async def test_create_follow_notification(self, notification_factory, mock_notification_repo):
        """Test follow notification creation."""
        # Arrange
        mock_notification = MagicMock()
        mock_notification_repo.create.return_value = mock_notification

        # Act
        result = await notification_factory.create_follow_notification(
            followed_user_id=123,
            follower_username="follower_user",
            follower_id=456
        )

        # Assert
        assert result == mock_notification
        call_args = mock_notification_repo.create.call_args
        assert call_args[1]["user_id"] == 123
        assert call_args[1]["type"] == "follow"
        assert call_args[1]["title"] == "New Follower"
        assert "follower_user started following you" in call_args[1]["message"]
        assert call_args[1]["data"]["follower_username"] == "follower_user"
        assert call_args[1]["data"]["follower_id"] == 456