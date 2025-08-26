"""Tests for batch notification behavior fixes."""

import pytest
from unittest.mock import AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.notification_service import NotificationService
from app.models.notification import Notification
import datetime


@pytest.fixture
async def mock_db():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


class TestBatchBehavior:
    """Test batch notification behavior fixes."""

    async def test_add_to_batch_marks_as_unread(self, mock_db):
        """Test that adding to batch marks it as unread and updates last_updated_at."""
        # Create existing batch (read)
        batch = Notification(
            id="batch-123",
            user_id=1,
            type='emoji_reaction',
            is_batch=True,
            batch_count=2,
            read=True,
            read_at=datetime.datetime.now(datetime.UTC).replace(tzinfo=None),
            last_updated_at=datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        )
        
        # Create new notification to add
        new_notification = Notification(
            id="new-456",
            user_id=1,
            type='emoji_reaction'
        )
        
        original_time = batch.last_updated_at
        
        # Add to batch
        result = await NotificationService._add_to_batch(mock_db, batch, new_notification)
        
        # Verify batch is marked as unread
        assert batch.read == False
        assert batch.read_at is None
        
        # Verify batch count increased
        assert batch.batch_count == 3
        
        # Verify last_updated_at was updated (should be newer)
        assert batch.last_updated_at != original_time
        
        # Verify new notification is a child
        assert new_notification.parent_id == batch.id
        
        # Verify database operations
        mock_db.add.assert_called()
        mock_db.commit.assert_called_once()
        # Should refresh both batch and new notification
        assert mock_db.refresh.call_count == 2
        mock_db.refresh.assert_any_call(batch)
        mock_db.refresh.assert_any_call(new_notification)

    async def test_convert_to_batch_marks_as_unread(self, mock_db):
        """Test that converting to batch marks it as unread and updates last_updated_at."""
        # Create existing single notification (read)
        existing = Notification(
            id="existing-123",
            user_id=1,
            type='emoji_reaction',
            is_batch=False,
            batch_count=1,
            read=True,
            read_at=datetime.datetime.now(datetime.UTC).replace(tzinfo=None),
            last_updated_at=datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        )
        
        # Create new notification
        new_notification = Notification(
            id="new-456",
            user_id=1,
            type='emoji_reaction'
        )
        
        original_time = existing.last_updated_at
        
        # Convert to batch
        result = await NotificationService._convert_to_batch(mock_db, existing, new_notification)
        
        # Verify converted to batch and marked as unread
        assert existing.is_batch == True
        assert existing.batch_count == 2
        assert existing.read == False
        assert existing.read_at is None
        
        # Verify last_updated_at was updated
        assert existing.last_updated_at != original_time
        
        # Verify new notification is a child
        assert new_notification.parent_id == existing.id
        
        # Verify database operations
        mock_db.add.assert_called()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(existing)

    def test_batch_summary_updates_correctly(self):
        """Test that batch summaries update correctly with count."""
        notification = Notification(
            type='emoji_reaction',
            data={
                'emoji_code': 'heart_eyes',
                'reactor_username': 'user1'
            }
        )
        
        # Test single notification
        title, message = notification.create_batch_summary(1)
        assert title == "New Reaction"
        assert "user1 reacted with 😍" in message
        
        # Test batch notification
        title, message = notification.create_batch_summary(3)
        assert title == "New Reactions"
        assert message == "3 people reacted to your post"
        
        # Test different notification types
        notification.type = 'like'
        notification.data = {'liker_username': 'user1'}
        
        title, message = notification.create_batch_summary(1)
        assert title == "New Like"
        assert "user1 liked your post" in message
        
        title, message = notification.create_batch_summary(5)
        assert title == "New Likes"
        assert message == "5 people liked your post"