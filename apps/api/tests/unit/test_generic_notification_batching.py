"""
Tests for the generic notification batching system.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.notification_batcher import (
    NotificationBatcher, 
    PostInteractionBatcher, 
    UserInteractionBatcher,
    BATCH_CONFIGS
)
from app.models.notification import Notification
from app.models.user import User
import datetime


@pytest.fixture
async def mock_db():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def notification_batcher(mock_db):
    """Create NotificationBatcher instance."""
    return NotificationBatcher(mock_db)


@pytest.fixture
def post_interaction_batcher(mock_db):
    """Create PostInteractionBatcher instance."""
    return PostInteractionBatcher(mock_db)


@pytest.fixture
def user_interaction_batcher(mock_db):
    """Create UserInteractionBatcher instance."""
    return UserInteractionBatcher(mock_db)


class TestGenericNotificationBatcher:
    """Test the generic notification batching system."""

    def test_batch_configs_exist(self):
        """Test that batch configurations are properly defined."""
        assert "emoji_reaction" in BATCH_CONFIGS
        assert "like" in BATCH_CONFIGS
        assert "post_interaction" in BATCH_CONFIGS
        assert "follow" in BATCH_CONFIGS
        assert "post_shared" in BATCH_CONFIGS
        assert "mention" in BATCH_CONFIGS
        
        # Test post-based configurations
        emoji_config = BATCH_CONFIGS["emoji_reaction"]
        assert emoji_config.batch_scope == "post"
        assert emoji_config.notification_type == "emoji_reaction"
        
        like_config = BATCH_CONFIGS["like"]
        assert like_config.batch_scope == "post"
        assert like_config.notification_type == "like"
        
        # Test user-based configurations
        follow_config = BATCH_CONFIGS["follow"]
        assert follow_config.batch_scope == "user"
        assert follow_config.notification_type == "follow"

    def test_generate_batch_key(self, notification_batcher):
        """Test generic batch key generation."""
        # Post-based batch key
        key = notification_batcher.generate_batch_key("emoji_reaction", "post-123", "post")
        assert key == "emoji_reaction:post:post-123"
        
        # User-based batch key
        key = notification_batcher.generate_batch_key("follow", "456", "user")
        assert key == "follow:user:456"
        
        # Like batch key
        key = notification_batcher.generate_batch_key("like", "post-789", "post")
        assert key == "like:post:post-789"

    async def test_create_single_notification_no_config(self, notification_batcher, mock_db):
        """Test creating single notification when no batch config exists."""
        notification = Notification(
            user_id=1,
            type="unknown_type",
            title="Test",
            message="Test message",
            data={}
        )
        
        # Mock repository create method
        mock_created = Notification(id="test-123", user_id=1, type="unknown_type")
        notification_batcher.notification_repo.create = AsyncMock(return_value=mock_created)
        
        result = await notification_batcher.create_or_update_batch(notification)
        
        assert result == mock_created
        notification_batcher.notification_repo.create.assert_called_once()

    async def test_create_single_notification_no_post_id(self, notification_batcher, mock_db):
        """Test creating single notification when post_id is missing for post-based type."""
        notification = Notification(
            user_id=1,
            type="emoji_reaction",
            title="Test",
            message="Test message",
            data={}  # No post_id
        )
        
        # Mock repository create method
        mock_created = Notification(id="test-123", user_id=1, type="emoji_reaction")
        notification_batcher.notification_repo.create = AsyncMock(return_value=mock_created)
        
        result = await notification_batcher.create_or_update_batch(notification)
        
        assert result == mock_created
        notification_batcher.notification_repo.create.assert_called_once()


class TestPostInteractionBatcher:
    """Test the post interaction batcher for likes and reactions."""

    async def test_create_like_notification(self, post_interaction_batcher, mock_db):
        """Test creating a like notification with purple heart styling."""
        # Mock no existing batch or single notification
        post_interaction_batcher.notification_repo.find_existing_batch = AsyncMock(return_value=None)
        post_interaction_batcher._find_existing_interaction_notification = AsyncMock(return_value=None)
        
        mock_created = Notification(id="like-123", user_id=1, type="like")
        post_interaction_batcher.notification_repo.create = AsyncMock(return_value=mock_created)
        
        result = await post_interaction_batcher.create_interaction_notification(
            notification_type="like",
            post_id="post-123",
            user_id=1,
            actor_data={"user_id": 2, "username": "liker"}
        )
        
        assert result == mock_created
        post_interaction_batcher.notification_repo.create.assert_called_once()
        
        # Check that the notification has purple heart styling
        call_args = post_interaction_batcher.notification_repo.create.call_args
        assert "💜" in call_args.kwargs["title"]

    async def test_create_emoji_reaction_notification(self, post_interaction_batcher, mock_db):
        """Test creating an emoji reaction notification."""
        # Mock no existing batch or single notification
        post_interaction_batcher.notification_repo.find_existing_batch = AsyncMock(return_value=None)
        post_interaction_batcher._find_existing_interaction_notification = AsyncMock(return_value=None)
        
        mock_created = Notification(id="reaction-123", user_id=1, type="emoji_reaction")
        post_interaction_batcher.notification_repo.create = AsyncMock(return_value=mock_created)
        
        result = await post_interaction_batcher.create_interaction_notification(
            notification_type="emoji_reaction",
            post_id="post-123",
            user_id=1,
            actor_data={"user_id": 2, "username": "reactor", "emoji_code": "heart_eyes"}
        )
        
        assert result == mock_created
        post_interaction_batcher.notification_repo.create.assert_called_once()

    async def test_combined_batching_like_then_reaction(self, post_interaction_batcher, mock_db):
        """Test combined batching when like is followed by reaction."""
        # Mock existing like notification
        existing_like = Notification(
            id="like-123",
            user_id=1,
            type="like",
            title="New Like 💜",
            message="user1 liked your post",
            data={"post_id": "post-123", "liker_username": "user1"},
            batch_key="like:post:post-123"
        )
        
        # Mock no existing batch but existing single notification
        post_interaction_batcher.notification_repo.find_existing_batch = AsyncMock(return_value=None)
        post_interaction_batcher._find_existing_interaction_notification = AsyncMock(return_value=existing_like)
        
        # Mock batch creation
        mock_batch = Notification(
            id="batch-456", 
            user_id=1, 
            type="post_interaction",
            is_batch=True,
            batch_count=2,
            title="New Engagement 💜",
            message="2 people engaged with your post"
        )
        mock_child = Notification(id="child-789", parent_id="batch-456")
        
        post_interaction_batcher.notification_repo.create = AsyncMock(side_effect=[mock_batch, mock_child])
        
        # Mock database operations
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        
        result = await post_interaction_batcher.create_interaction_notification(
            notification_type="emoji_reaction",
            post_id="post-123",
            user_id=1,
            actor_data={"user_id": 2, "username": "reactor", "emoji_code": "heart_eyes"}
        )
        
        # Check that a combined batch was created
        assert result == mock_batch
        assert result.type == "post_interaction"
        assert result.batch_count == 2
        assert "💜" in result.title
        assert "engaged" in result.message
        
        # Check that existing notification becomes a child
        assert existing_like.parent_id == mock_batch.id

    async def test_combined_batching_reaction_then_like(self, post_interaction_batcher, mock_db):
        """Test combined batching when reaction is followed by like."""
        # Mock existing reaction notification
        existing_reaction = Notification(
            id="reaction-123",
            user_id=1,
            type="emoji_reaction",
            title="New Reaction",
            message="user1 reacted with 😍 to your post",
            data={"post_id": "post-123", "reactor_username": "user1", "emoji_code": "heart_eyes"},
            batch_key="emoji_reaction:post:post-123"
        )
        
        # Mock no existing batch but existing single notification
        post_interaction_batcher.notification_repo.find_existing_batch = AsyncMock(return_value=None)
        post_interaction_batcher._find_existing_interaction_notification = AsyncMock(return_value=existing_reaction)
        
        # Mock batch creation
        mock_batch = Notification(
            id="batch-456", 
            user_id=1, 
            type="post_interaction",
            is_batch=True,
            batch_count=2,
            title="New Engagement 💜",
            message="2 people engaged with your post"
        )
        mock_child = Notification(id="child-789", parent_id="batch-456")
        
        post_interaction_batcher.notification_repo.create = AsyncMock(side_effect=[mock_batch, mock_child])
        
        # Mock database operations
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        
        result = await post_interaction_batcher.create_interaction_notification(
            notification_type="like",
            post_id="post-123",
            user_id=1,
            actor_data={"user_id": 2, "username": "liker"}
        )
        
        # Check that a combined batch was created
        assert result == mock_batch
        assert result.type == "post_interaction"
        assert result.batch_count == 2
        assert "💜" in result.title
        assert "engaged" in result.message

    async def test_add_to_existing_combined_batch(self, post_interaction_batcher, mock_db):
        """Test adding notification to existing combined batch."""
        # Mock existing combined batch
        existing_batch = Notification(
            id="batch-123",
            user_id=1,
            type="post_interaction",
            is_batch=True,
            batch_count=2,
            title="New Engagement 💜",
            message="2 people engaged with your post",
            data={"post_id": "post-123"}
        )
        
        post_interaction_batcher.notification_repo.find_existing_batch = AsyncMock(return_value=existing_batch)
        
        # Mock child creation
        mock_child = Notification(id="child-456", parent_id="batch-123")
        post_interaction_batcher.notification_repo.create = AsyncMock(return_value=mock_child)
        
        # Mock database operations
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        
        result = await post_interaction_batcher.create_interaction_notification(
            notification_type="like",
            post_id="post-123",
            user_id=1,
            actor_data={"user_id": 3, "username": "liker2"}
        )
        
        # Check batch was updated
        assert existing_batch.batch_count == 3
        assert "3 people engaged" in existing_batch.message
        assert existing_batch.read == False
        
        # Check child was created
        assert result == mock_child

    async def test_combined_batch_summary_generation(self, post_interaction_batcher):
        """Test intelligent batch summary generation for mixed interactions."""
        # Test summary for 2 people
        title, message = post_interaction_batcher._generate_combined_batch_summary(2, {})
        assert title == "New Engagement 💜"
        assert message == "2 people engaged with your post"
        
        # Test summary for 5 people
        title, message = post_interaction_batcher._generate_combined_batch_summary(5, {})
        assert title == "New Engagement 💜"
        assert message == "5 people engaged with your post"
        
        # Test summary for 1 person (edge case)
        title, message = post_interaction_batcher._generate_combined_batch_summary(1, {})
        assert title == "New Engagement 💜"
        assert message == "Someone engaged with your post"

    async def test_find_existing_interaction_notification(self, post_interaction_batcher):
        """Test finding existing like or reaction notifications for the same post."""
        # Mock existing like notification
        existing_like = Notification(id="like-123", type="like")
        post_interaction_batcher.notification_repo.find_existing_single_notification = AsyncMock(
            side_effect=[existing_like, None]  # First call finds like, second call for reaction returns None
        )
        
        result = await post_interaction_batcher._find_existing_interaction_notification(1, "post-123")
        
        assert result == existing_like
        assert post_interaction_batcher.notification_repo.find_existing_single_notification.call_count == 1

    async def test_find_existing_interaction_notification_reaction(self, post_interaction_batcher):
        """Test finding existing interaction notification with unified batch key."""
        # Mock existing interaction notification
        existing_interaction = Notification(id="interaction-123", type="emoji_reaction")
        post_interaction_batcher.notification_repo.find_existing_single_notification = AsyncMock(
            return_value=existing_interaction
        )
        
        result = await post_interaction_batcher._find_existing_interaction_notification(1, "post-123")
        
        assert result == existing_interaction
        # Should only call once with unified batch key
        assert post_interaction_batcher.notification_repo.find_existing_single_notification.call_count == 1
        # Verify it was called with the unified batch key
        call_args = post_interaction_batcher.notification_repo.find_existing_single_notification.call_args
        assert call_args[0][1] == "post_interaction:post:post-123"  # batch_key argument

    async def test_unsupported_interaction_type(self, post_interaction_batcher):
        """Test that unsupported interaction types raise ValueError."""
        with pytest.raises(ValueError, match="Unsupported interaction type: invalid"):
            await post_interaction_batcher.create_interaction_notification(
                notification_type="invalid",
                post_id="post-123",
                user_id=1,
                actor_data={"user_id": 2, "username": "user"}
            )


class TestUserInteractionBatcher:
    """Test the user interaction batcher for follows and other user-directed notifications."""

    async def test_create_follow_notification(self, user_interaction_batcher, mock_db):
        """Test creating a follow notification."""
        # Mock no existing batch
        user_interaction_batcher.notification_repo.find_existing_batch = AsyncMock(return_value=None)
        user_interaction_batcher.notification_repo.find_existing_single_notification = AsyncMock(return_value=None)
        
        mock_created = Notification(id="follow-123", user_id=1, type="follow")
        user_interaction_batcher.notification_repo.create = AsyncMock(return_value=mock_created)
        
        result = await user_interaction_batcher.create_user_notification(
            notification_type="follow",
            target_user_id=1,
            actor_data={"user_id": 2, "username": "follower"}
        )
        
        assert result == mock_created
        user_interaction_batcher.notification_repo.create.assert_called_once()

    async def test_unsupported_user_interaction_type(self, user_interaction_batcher):
        """Test that unsupported user interaction types raise ValueError."""
        with pytest.raises(ValueError, match="Unsupported user interaction type: invalid"):
            await user_interaction_batcher.create_user_notification(
                notification_type="invalid",
                target_user_id=1,
                actor_data={"user_id": 2, "username": "user"}
            )


class TestBatchingLogic:
    """Test the core batching logic."""

    async def test_add_to_existing_batch(self, notification_batcher, mock_db):
        """Test adding notification to existing batch."""
        # Create existing batch
        existing_batch = Notification(
            id="batch-123",
            user_id=1,
            type="emoji_reaction",
            is_batch=True,
            batch_count=2,
            title="New Reactions",
            message="2 people reacted to your post"
        )
        
        # Create new notification
        new_notification = Notification(
            user_id=1,
            type="emoji_reaction",
            title="New Reaction",
            message="user3 reacted to your post",
            data={"post_id": "post-123"}
        )
        
        # Mock repository methods
        mock_created_child = Notification(id="child-456", parent_id="batch-123")
        notification_batcher.notification_repo.create = AsyncMock(return_value=mock_created_child)
        
        # Mock database operations
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        
        from app.core.notification_batcher import BATCH_CONFIGS
        batch_config = BATCH_CONFIGS["emoji_reaction"]
        
        result = await notification_batcher._add_to_existing_batch(
            existing_batch, new_notification, batch_config
        )
        
        # Check batch was updated
        assert existing_batch.batch_count == 3
        assert existing_batch.message == "3 people reacted to your post"
        assert existing_batch.read == False  # Should be marked as unread
        
        # Check child was created
        assert result == mock_created_child
        notification_batcher.notification_repo.create.assert_called_once()
        mock_db.commit.assert_called_once()

    async def test_convert_to_batch(self, notification_batcher, mock_db):
        """Test converting single notification to batch by creating dedicated batch notification."""
        # Create existing single notification
        existing_single = Notification(
            id="single-123",
            user_id=1,
            type="emoji_reaction",
            is_batch=False,
            batch_count=1,
            title="New Reaction",
            message="user1 reacted to your post",
            data={"post_id": "post-123"},
            batch_key="emoji_reaction:post:post-123"
        )
        
        # Create new notification
        new_notification = Notification(
            user_id=1,
            type="emoji_reaction",
            title="New Reaction",
            message="user2 reacted to your post",
            data={"post_id": "post-123"}
        )
        
        # Mock repository methods - first call creates batch, second creates child
        mock_batch_notification = Notification(
            id="batch-789", 
            user_id=1, 
            type="emoji_reaction",
            is_batch=True,
            batch_count=2,
            title="New Reactions",
            message="2 people reacted to your post"
        )
        mock_created_child = Notification(id="child-456", parent_id="batch-789")
        
        notification_batcher.notification_repo.create = AsyncMock(side_effect=[
            mock_batch_notification,  # First call creates the batch
            mock_created_child        # Second call creates the child
        ])
        
        # Mock database operations
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        
        from app.core.notification_batcher import BATCH_CONFIGS
        batch_config = BATCH_CONFIGS["emoji_reaction"]
        
        result = await notification_batcher._convert_to_batch(
            existing_single, new_notification, batch_config
        )
        
        # Check that existing notification becomes a child (parent_id set)
        assert existing_single.parent_id == mock_batch_notification.id
        
        # Check that a new batch notification was created
        assert result == mock_batch_notification
        assert result.is_batch == True
        assert result.batch_count == 2
        assert result.title == "New Reactions"
        assert result.message == "2 people reacted to your post"
        
        # Check that both notifications were created (batch + child)
        assert notification_batcher.notification_repo.create.call_count == 2
        mock_db.add.assert_called_once_with(existing_single)  # Existing notification updated to be child
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(mock_batch_notification)


class TestNotificationModelBatchSummary:
    """Test notification model batch summary generation."""

    def test_like_batch_summary_single(self):
        """Test like notification batch summary for single notification."""
        notification = Notification(
            type="like",
            data={"liker_username": "john"}
        )
        
        title, message = notification.create_batch_summary(1)
        assert title == "New Like 💜"
        assert message == "john liked your post"

    def test_like_batch_summary_multiple(self):
        """Test like notification batch summary for multiple notifications."""
        notification = Notification(
            type="like",
            data={"liker_username": "john"}
        )
        
        title, message = notification.create_batch_summary(3)
        assert title == "New Likes 💜"
        assert message == "3 people liked your post"

    def test_post_interaction_batch_summary_single(self):
        """Test post_interaction notification batch summary for single notification."""
        notification = Notification(
            type="post_interaction",
            data={}
        )
        
        title, message = notification.create_batch_summary(1)
        assert title == "New Engagement 💜"
        assert message == "Someone engaged with your post"

    def test_post_interaction_batch_summary_multiple(self):
        """Test post_interaction notification batch summary for multiple notifications."""
        notification = Notification(
            type="post_interaction",
            data={}
        )
        
        title, message = notification.create_batch_summary(5)
        assert title == "New Engagement 💜"
        assert message == "5 people engaged with your post"

    def test_generate_batch_key_post_interaction(self):
        """Test batch key generation for post_interaction type."""
        notification = Notification(
            type="post_interaction",
            data={"post_id": "post-123"}
        )
        
        batch_key = notification.generate_batch_key()
        assert batch_key == "post_interaction:post:post-123"