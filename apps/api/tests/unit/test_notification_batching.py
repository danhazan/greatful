"""
Tests for notification batching functionality.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.notification_service import NotificationService
from app.models.notification import Notification
from app.models.user import User
import datetime


@pytest.fixture
async def mock_db():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def sample_notification():
    """Sample notification for testing."""
    notification = Notification(
        id="test-id",
        user_id=1,
        type='emoji_reaction',
        title='New Reaction',
        message='user1 reacted with 😍 to your post',
        data={
            'post_id': 'post-123',
            'emoji_code': 'heart_eyes',
            'reactor_username': 'user1'
        }
    )
    notification.batch_key = notification.generate_batch_key()
    return notification


class TestNotificationBatching:
    """Test notification batching functionality."""

    async def test_generate_batch_key(self):
        """Test batch key generation for different notification types."""
        # Emoji reaction
        notification = Notification(
            user_id=1,
            type='emoji_reaction',
            data={'post_id': 'post-123'}
        )
        key = notification.generate_batch_key()
        assert key == "emoji_reaction_1_post-123"

        # Like notification
        notification = Notification(
            user_id=2,
            type='like',
            data={'post_id': 'post-456'}
        )
        key = notification.generate_batch_key()
        assert key == "like_2_post-456"

        # Follow notification
        notification = Notification(
            user_id=3,
            type='new_follower',
            data={}
        )
        key = notification.generate_batch_key()
        assert key == "new_follower_3"

    async def test_create_batch_summary_single(self):
        """Test batch summary creation for single notification."""
        notification = Notification(
            type='emoji_reaction',
            data={
                'emoji_code': 'heart_eyes',
                'reactor_username': 'user1'
            }
        )
        
        title, message = notification.create_batch_summary(1)
        assert title == "New Reaction"
        assert message == "user1 reacted with 😍 to your post"

    async def test_create_batch_summary_multiple(self):
        """Test batch summary creation for multiple notifications."""
        notification = Notification(
            type='emoji_reaction',
            data={
                'emoji_code': 'heart_eyes',
                'reactor_username': 'user1'
            }
        )
        
        title, message = notification.create_batch_summary(3)
        assert title == "New Reactions"
        assert message == "3 people reacted to your post"

    @patch('app.models.user.User.get_by_username')
    async def test_find_existing_batch(self, mock_get_user, mock_db):
        """Test finding existing batch notifications."""
        # Mock user lookup
        mock_user = User(id=2, username='reactor')
        mock_get_user.return_value = mock_user

        # Mock database query for existing batch
        mock_batch = Notification(
            id="batch-123",
            user_id=1,
            type='emoji_reaction',
            is_batch=True,
            batch_count=2,
            batch_key="emoji_reaction_1_post-123"
        )
        
        # Mock the async database operation
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_batch
        mock_db.execute.return_value = mock_result

        result = await NotificationService._find_existing_batch(
            mock_db, 1, "emoji_reaction_1_post-123"
        )
        
        assert result == mock_batch
        mock_db.execute.assert_called_once()

    @patch('app.models.user.User.get_by_username')
    async def test_convert_to_batch(self, mock_get_user, mock_db):
        """Test converting single notification to batch."""
        # Mock user lookup
        mock_user = User(id=2, username='reactor')
        mock_get_user.return_value = mock_user

        existing = Notification(
            id="existing-123",
            user_id=1,
            type='emoji_reaction',
            title='New Reaction',
            message='user1 reacted with 😍 to your post',
            is_batch=False,
            batch_count=1
        )

        new_notification = Notification(
            id="new-456",
            user_id=1,
            type='emoji_reaction',
            title='New Reaction',
            message='user2 reacted with 🙏 to your post'
        )

        result = await NotificationService._convert_to_batch(
            mock_db, existing, new_notification
        )

        # Check that existing notification was converted to batch
        assert existing.is_batch == True
        assert existing.batch_count == 2
        assert existing.title == "New Reactions"
        assert existing.message == "2 people reacted to your post"

        # Check that new notification is a child
        assert new_notification.parent_id == existing.id

        # Check database operations
        mock_db.add.assert_called()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(existing)

    @patch('app.models.user.User.get_by_username')
    async def test_add_to_batch(self, mock_get_user, mock_db):
        """Test adding notification to existing batch."""
        # Mock user lookup
        mock_user = User(id=2, username='reactor')
        mock_get_user.return_value = mock_user

        batch = Notification(
            id="batch-123",
            user_id=1,
            type='emoji_reaction',
            is_batch=True,
            batch_count=2,
            title="New Reactions",
            message="2 people reacted to your post"
        )

        new_notification = Notification(
            id="new-789",
            user_id=1,
            type='emoji_reaction'
        )

        result = await NotificationService._add_to_batch(
            mock_db, batch, new_notification
        )

        # Check batch was updated
        assert batch.batch_count == 3
        assert batch.title == "New Reactions"
        assert batch.message == "3 people reacted to your post"

        # Check new notification is a child
        assert new_notification.parent_id == batch.id

        # Check database operations
        mock_db.add.assert_called()
        mock_db.commit.assert_called_once()
        # Should refresh both batch and new notification
        assert mock_db.refresh.call_count == 2
        mock_db.refresh.assert_any_call(batch)
        mock_db.refresh.assert_any_call(new_notification)

    @patch('app.models.user.User.get_by_username')
    async def test_create_emoji_reaction_notification_new_single(self, mock_get_user, mock_db):
        """Test creating new single emoji reaction notification."""
        # Mock user lookup
        mock_user = User(id=2, username='reactor')
        mock_get_user.return_value = mock_user

        # Mock no existing batch or single notification
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await NotificationService.create_emoji_reaction_notification(
            mock_db, 1, 'reactor', 'heart_eyes', 'post-123'
        )

        # Should create new single notification
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    @patch('app.models.user.User.get_by_username')
    async def test_create_emoji_reaction_notification_add_to_batch(self, mock_get_user, mock_db):
        """Test adding emoji reaction to existing batch."""
        # Mock user lookup
        mock_user = User(id=2, username='reactor')
        mock_get_user.return_value = mock_user

        # Mock existing batch
        mock_batch = Notification(
            id="batch-123",
            user_id=1,
            type='emoji_reaction',
            is_batch=True,
            batch_count=2
        )
        
        # First call returns existing batch, second returns None (no single notification)
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = mock_batch
        mock_result2 = MagicMock()
        mock_result2.scalar_one_or_none.return_value = None
        mock_db.execute.side_effect = [mock_result1, mock_result2]

        result = await NotificationService.create_emoji_reaction_notification(
            mock_db, 1, 'reactor', 'heart_eyes', 'post-123'
        )

        # Should add to existing batch
        assert mock_batch.batch_count == 3
        mock_db.add.assert_called()
        mock_db.commit.assert_called()

    @patch('app.models.user.User.get_by_username')
    async def test_create_emoji_reaction_notification_convert_to_batch(self, mock_get_user, mock_db):
        """Test converting single notification to batch."""
        # Mock user lookup
        mock_user = User(id=2, username='reactor')
        mock_get_user.return_value = mock_user

        # Mock existing single notification
        mock_single = Notification(
            id="single-123",
            user_id=1,
            type='emoji_reaction',
            is_batch=False,
            batch_count=1
        )
        
        # First call returns None (no batch), second returns single notification
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = None
        mock_result2 = MagicMock()
        mock_result2.scalar_one_or_none.return_value = mock_single
        mock_db.execute.side_effect = [mock_result1, mock_result2]

        result = await NotificationService.create_emoji_reaction_notification(
            mock_db, 1, 'reactor', 'heart_eyes', 'post-123'
        )

        # Should convert to batch
        assert mock_single.is_batch == True
        assert mock_single.batch_count == 2
        mock_db.add.assert_called()
        mock_db.commit.assert_called()

    async def test_get_user_notifications_excludes_children(self, mock_db):
        """Test that get_user_notifications excludes child notifications by default."""
        mock_notifications = [
            Notification(id="parent-1", user_id=1, parent_id=None),
            Notification(id="parent-2", user_id=1, parent_id=None)
        ]
        
        # Mock the async database operation chain
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_notifications
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        result = await NotificationService.get_user_notifications(mock_db, 1)

        # Should only return parent notifications
        assert len(result) == 2
        mock_db.execute.assert_called_once()

    async def test_get_batch_children(self, mock_db):
        """Test getting children of a batch notification."""
        mock_children = [
            Notification(id="child-1", user_id=1, parent_id="batch-123"),
            Notification(id="child-2", user_id=1, parent_id="batch-123")
        ]
        
        # Mock the async database operation chain
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_children
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        result = await NotificationService.get_batch_children(mock_db, "batch-123", 1)

        assert len(result) == 2
        assert all(child.parent_id == "batch-123" for child in result)
        mock_db.execute.assert_called_once()

    async def test_get_unread_count_only_parents(self, mock_db):
        """Test that unread count only includes parent notifications."""
        # Mock the async database operation
        mock_result = MagicMock()
        mock_result.scalar.return_value = 3
        mock_db.execute.return_value = mock_result

        result = await NotificationService.get_unread_count(mock_db, 1)

        assert result == 3
        # Should query with parent_id IS NULL condition
        mock_db.execute.assert_called_once()

    async def test_mark_as_read_batch_marks_children(self, mock_db):
        """Test that marking batch as read also marks children."""
        # Mock batch notification
        batch = Notification(
            id="batch-123",
            user_id=1,
            is_batch=True,
            read=False
        )
        
        # Mock children
        children = [
            Notification(id="child-1", user_id=1, parent_id="batch-123", read=False),
            Notification(id="child-2", user_id=1, parent_id="batch-123", read=False)
        ]
        
        # Mock database calls - first call gets the notification, second gets children
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = batch
        
        mock_result2 = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = children
        mock_result2.scalars.return_value = mock_scalars
        
        mock_db.execute.side_effect = [mock_result1, mock_result2]

        result = await NotificationService.mark_as_read(mock_db, "batch-123", 1)

        assert result == True
        assert batch.read == True
        assert all(child.read == True for child in children)
        mock_db.commit.assert_called_once()

    async def test_mark_all_as_read_counts_parents_only(self, mock_db):
        """Test that mark_all_as_read returns count of parent notifications only."""
        notifications = [
            Notification(id="parent-1", user_id=1, parent_id=None, read=False),
            Notification(id="parent-2", user_id=1, parent_id=None, read=False),
            Notification(id="child-1", user_id=1, parent_id="parent-1", read=False),
            Notification(id="child-2", user_id=1, parent_id="parent-2", read=False)
        ]
        
        # Mock the async database operation chain
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = notifications
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        result = await NotificationService.mark_all_as_read(mock_db, 1)

        # Should return count of parent notifications only (2)
        assert result == 2
        # All notifications should be marked as read
        assert all(n.read == True for n in notifications)
        mock_db.commit.assert_called_once()

    async def test_self_notification_prevention(self, mock_db):
        """Test that users don't get notifications for their own actions."""
        # Mock user lookup - same user as post author
        with patch('app.models.user.User.get_by_username') as mock_get_user:
            mock_user = User(id=1, username='author')  # Same ID as post_author_id
            mock_get_user.return_value = mock_user

            result = await NotificationService.create_emoji_reaction_notification(
                mock_db, 1, 'author', 'heart_eyes', 'post-123'
            )

            # Should return None (no notification created)
            assert result is None
            mock_db.add.assert_not_called()
            mock_db.commit.assert_not_called()