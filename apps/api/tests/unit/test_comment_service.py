"""
Unit tests for CommentService.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.comment_service import CommentService
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User
from app.core.exceptions import NotFoundError, ValidationException, PermissionDeniedError
from datetime import datetime


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    return AsyncMock()


@pytest.fixture
def comment_service(mock_db):
    """Create a CommentService instance with mock database."""
    return CommentService(mock_db)


@pytest.fixture
def sample_user():
    """Create a sample user."""
    user = User(
        id=1,
        username="testuser",
        display_name="Test User",
        email="test@example.com",
        profile_image_url="https://example.com/profile.jpg"
    )
    return user


@pytest.fixture
def sample_post():
    """Create a sample post."""
    post = Post(
        id="post-123",
        author_id=1,
        content="Test post content",
        post_type="daily"
    )
    return post


@pytest.fixture
def sample_comment():
    """Create a sample comment."""
    comment = Comment(
        id="comment-123",
        post_id="post-123",
        user_id=1,
        content="Test comment",
        created_at=datetime.utcnow()
    )
    return comment


class TestCreateComment:
    """Tests for create_comment method."""

    @pytest.mark.asyncio
    async def test_create_comment_success(self, comment_service, sample_user, sample_post):
        """Test successful comment creation."""
        # Mock the service methods
        comment_service.validate_field_length = MagicMock()
        comment_service.get_by_id_or_404 = AsyncMock(side_effect=[sample_post, sample_user])
        
        # Mock create_entity to return a comment
        created_comment = Comment(
            id="comment-new",
            post_id="post-123",
            user_id=1,
            content="Great post!",
            created_at=datetime.utcnow()
        )
        comment_service.create_entity = AsyncMock(return_value=created_comment)
        
        # Mock NotificationFactory
        with patch('app.services.comment_service.NotificationFactory') as mock_factory:
            mock_factory.return_value.create_notification = AsyncMock()
            
            # Create comment
            result = await comment_service.create_comment(
                post_id="post-123",
                user_id=1,
                content="Great post!"
            )
        
        # Verify result
        assert result["id"] == "comment-new"
        assert result["post_id"] == "post-123"
        assert result["user_id"] == 1
        assert result["content"] == "Great post!"
        assert result["parent_comment_id"] is None
        assert result["user"]["username"] == "testuser"
        
        # Verify validation was called
        comment_service.validate_field_length.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_comment_notifies_post_author(self, comment_service, sample_user, sample_post):
        """Test that post author receives notification for new comment."""
        # Create a different user for the post author
        post_author = User(id=2, username="postauthor", display_name="Post Author", email="author@example.com")
        sample_post.author_id = 2
        
        comment_service.validate_field_length = MagicMock()
        comment_service.get_by_id_or_404 = AsyncMock(side_effect=[sample_post, sample_user])
        
        created_comment = Comment(
            id="comment-new",
            post_id="post-123",
            user_id=1,
            content="Great post!",
            created_at=datetime.utcnow()
        )
        comment_service.create_entity = AsyncMock(return_value=created_comment)
        
        # Mock NotificationFactory
        with patch('app.services.comment_service.NotificationFactory') as mock_factory:
            mock_notification_factory = AsyncMock()
            mock_factory.return_value = mock_notification_factory
            
            await comment_service.create_comment(
                post_id="post-123",
                user_id=1,
                content="Great post!"
            )
            
            # Verify notification was created for post author
            mock_notification_factory.create_notification.assert_called_once()
            call_args = mock_notification_factory.create_notification.call_args
            assert call_args[1]["user_id"] == 2  # Post author ID
            assert call_args[1]["notification_type"] == "comment"

    @pytest.mark.asyncio
    async def test_create_comment_no_self_notification(self, comment_service, sample_user, sample_post):
        """Test that user doesn't receive notification for commenting on own post."""
        comment_service.validate_field_length = MagicMock()
        comment_service.get_by_id_or_404 = AsyncMock(side_effect=[sample_post, sample_user])
        
        created_comment = Comment(
            id="comment-new",
            post_id="post-123",
            user_id=1,
            content="My own comment",
            created_at=datetime.utcnow()
        )
        comment_service.create_entity = AsyncMock(return_value=created_comment)
        
        with patch('app.services.comment_service.NotificationFactory') as mock_factory:
            mock_notification_factory = AsyncMock()
            mock_factory.return_value = mock_notification_factory
            
            await comment_service.create_comment(
                post_id="post-123",
                user_id=1,  # Same as post author
                content="My own comment"
            )
            
            # Verify no notification was created (self-notification prevented)
            mock_notification_factory.create_notification.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_reply_success(self, comment_service, sample_user, sample_post, sample_comment):
        """Test successful reply creation."""
        comment_service.validate_field_length = MagicMock()
        comment_service.get_by_id_or_404 = AsyncMock(side_effect=[sample_post, sample_user, sample_comment])
        
        created_reply = Comment(
            id="reply-new",
            post_id="post-123",
            user_id=1,
            parent_comment_id="comment-123",
            content="Great comment!",
            created_at=datetime.utcnow()
        )
        comment_service.create_entity = AsyncMock(return_value=created_reply)
        comment_service.get_by_id = AsyncMock(return_value=sample_comment)
        
        with patch('app.services.comment_service.NotificationFactory') as mock_factory:
            mock_factory.return_value.create_notification = AsyncMock()
            
            result = await comment_service.create_comment(
                post_id="post-123",
                user_id=1,
                content="Great comment!",
                parent_comment_id="comment-123"
            )
        
        assert result["parent_comment_id"] == "comment-123"

    @pytest.mark.asyncio
    async def test_create_reply_notifies_parent_author(self, comment_service, sample_user, sample_post, sample_comment):
        """Test that parent comment author receives notification for reply."""
        # Create different user for parent comment
        parent_author = User(id=2, username="parentauthor", display_name="Parent Author", email="parent@example.com")
        sample_comment.user_id = 2
        
        comment_service.validate_field_length = MagicMock()
        comment_service.get_by_id_or_404 = AsyncMock(side_effect=[sample_post, sample_user, sample_comment])
        
        created_reply = Comment(
            id="reply-new",
            post_id="post-123",
            user_id=1,
            parent_comment_id="comment-123",
            content="Great comment!",
            created_at=datetime.utcnow()
        )
        comment_service.create_entity = AsyncMock(return_value=created_reply)
        comment_service.get_by_id = AsyncMock(return_value=sample_comment)
        
        with patch('app.services.comment_service.NotificationFactory') as mock_factory:
            mock_notification_factory = AsyncMock()
            mock_factory.return_value = mock_notification_factory
            
            await comment_service.create_comment(
                post_id="post-123",
                user_id=1,
                content="Great comment!",
                parent_comment_id="comment-123"
            )
            
            # Verify notification was created for parent comment author
            mock_notification_factory.create_notification.assert_called_once()
            call_args = mock_notification_factory.create_notification.call_args
            assert call_args[1]["user_id"] == 2  # Parent comment author ID
            assert call_args[1]["notification_type"] == "comment_reply"

    @pytest.mark.asyncio
    async def test_create_reply_wrong_post(self, comment_service, sample_user, sample_post, sample_comment):
        """Test that reply fails if parent comment belongs to different post."""
        sample_comment.post_id = "different-post"
        
        comment_service.validate_field_length = MagicMock()
        comment_service.get_by_id_or_404 = AsyncMock(side_effect=[sample_post, sample_user, sample_comment])
        
        with pytest.raises(ValidationException) as exc_info:
            await comment_service.create_comment(
                post_id="post-123",
                user_id=1,
                content="Reply",
                parent_comment_id="comment-123"
            )
        
        assert "does not belong to this post" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_reply_to_reply_fails(self, comment_service, sample_user, sample_post):
        """Test that replies to replies are prevented (single-level nesting only)."""
        # Create a reply (has parent_comment_id)
        parent_reply = Comment(
            id="reply-123",
            post_id="post-123",
            user_id=1,
            parent_comment_id="comment-original",
            content="This is a reply"
        )
        
        comment_service.validate_field_length = MagicMock()
        comment_service.get_by_id_or_404 = AsyncMock(side_effect=[sample_post, sample_user, parent_reply])
        
        with pytest.raises(ValidationException) as exc_info:
            await comment_service.create_comment(
                post_id="post-123",
                user_id=1,
                content="Reply to reply",
                parent_comment_id="reply-123"
            )
        
        assert "single-level nesting" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_create_comment_content_too_short(self, comment_service):
        """Test that empty content is rejected."""
        comment_service.validate_field_length = MagicMock(
            side_effect=ValidationException("Content too short", {"content": "Minimum length is 1"})
        )
        
        with pytest.raises(ValidationException):
            await comment_service.create_comment(
                post_id="post-123",
                user_id=1,
                content=""
            )

    @pytest.mark.asyncio
    async def test_create_comment_content_too_long(self, comment_service):
        """Test that content exceeding 500 characters is rejected."""
        long_content = "x" * 501
        comment_service.validate_field_length = MagicMock(
            side_effect=ValidationException("Content too long", {"content": "Maximum length is 500"})
        )
        
        with pytest.raises(ValidationException):
            await comment_service.create_comment(
                post_id="post-123",
                user_id=1,
                content=long_content
            )

    @pytest.mark.asyncio
    async def test_create_comment_post_not_found(self, comment_service):
        """Test that comment creation fails if post doesn't exist."""
        comment_service.validate_field_length = MagicMock()
        comment_service.get_by_id_or_404 = AsyncMock(
            side_effect=NotFoundError("Post", "nonexistent-post")
        )
        
        with pytest.raises(NotFoundError):
            await comment_service.create_comment(
                post_id="nonexistent-post",
                user_id=1,
                content="Comment"
            )


class TestGetPostComments:
    """Tests for get_post_comments method."""

    @pytest.mark.asyncio
    async def test_get_post_comments_with_replies(self, comment_service, sample_user):
        """Test getting comments with replies included."""
        # Mock comments
        comment1 = Comment(
            id="comment-1",
            post_id="post-123",
            user_id=1,
            content="First comment",
            created_at=datetime.utcnow()
        )
        comment1.user = sample_user
        
        # Mock database query
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [comment1]
        comment_service.db.execute = AsyncMock(return_value=mock_result)
        
        # Mock get_comment_replies
        comment_service.get_comment_replies = AsyncMock(return_value=[
            {
                "id": "reply-1",
                "content": "Reply to first",
                "user": {"username": "replyuser"}
            }
        ])
        
        result = await comment_service.get_post_comments("post-123", include_replies=True)
        
        assert len(result) == 1
        assert result[0]["id"] == "comment-1"
        assert len(result[0]["replies"]) == 1

    @pytest.mark.asyncio
    async def test_get_post_comments_without_replies(self, comment_service, sample_user):
        """Test getting comments without replies (performance optimization)."""
        comment1 = Comment(
            id="comment-1",
            post_id="post-123",
            user_id=1,
            content="First comment",
            created_at=datetime.utcnow()
        )
        comment1.user = sample_user
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [comment1]
        comment_service.db.execute = AsyncMock(return_value=mock_result)
        
        result = await comment_service.get_post_comments("post-123", include_replies=False)
        
        assert len(result) == 1
        assert result[0]["replies"] == []


class TestGetCommentReplies:
    """Tests for get_comment_replies method."""

    @pytest.mark.asyncio
    async def test_get_comment_replies(self, comment_service, sample_user):
        """Test getting replies for a comment."""
        reply1 = Comment(
            id="reply-1",
            post_id="post-123",
            user_id=1,
            parent_comment_id="comment-123",
            content="First reply",
            created_at=datetime.utcnow()
        )
        reply1.user = sample_user
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [reply1]
        comment_service.db.execute = AsyncMock(return_value=mock_result)
        
        result = await comment_service.get_comment_replies("comment-123")
        
        assert len(result) == 1
        assert result[0]["id"] == "reply-1"
        assert result[0]["parent_comment_id"] == "comment-123"


class TestDeleteComment:
    """Tests for delete_comment method."""

    @pytest.mark.asyncio
    async def test_delete_comment_success(self, comment_service, sample_comment, sample_post):
        """Test successful comment deletion by owner."""
        comment_service.get_by_id_or_404 = AsyncMock(return_value=sample_comment)
        comment_service.get_by_id = AsyncMock(return_value=sample_post)
        comment_service.delete_entity = AsyncMock(return_value=True)
        
        # Mock database execute for reply count query
        mock_result = MagicMock()
        mock_result.scalar.return_value = 0  # No replies
        comment_service.db.execute = AsyncMock(return_value=mock_result)
        comment_service.db.commit = AsyncMock()
        comment_service.db.refresh = AsyncMock()
        
        # Set initial comments_count
        sample_post.comments_count = 5
        
        result = await comment_service.delete_comment("comment-123", user_id=1)
        
        assert result is True
        comment_service.delete_entity.assert_called_once_with(sample_comment)
        # Verify comments_count was decremented (5 - 1 = 4, since no replies)
        assert sample_post.comments_count == 4

    @pytest.mark.asyncio
    async def test_delete_comment_not_owner(self, comment_service, sample_comment):
        """Test that non-owner cannot delete comment."""
        comment_service.get_by_id_or_404 = AsyncMock(return_value=sample_comment)
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            await comment_service.delete_comment("comment-123", user_id=999)
        
        assert "Cannot delete other user's comment" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_comment_not_found(self, comment_service):
        """Test that deleting non-existent comment raises error."""
        comment_service.get_by_id_or_404 = AsyncMock(
            side_effect=NotFoundError("Comment", "nonexistent")
        )
        
        with pytest.raises(NotFoundError):
            await comment_service.delete_comment("nonexistent", user_id=1)


class TestGetCommentCount:
    """Tests for get_comment_count method."""

    @pytest.mark.asyncio
    async def test_get_comment_count(self, comment_service):
        """Test getting total comment count for a post."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        comment_service.db.execute = AsyncMock(return_value=mock_result)
        
        count = await comment_service.get_comment_count("post-123")
        
        assert count == 5

    @pytest.mark.asyncio
    async def test_get_comment_count_zero(self, comment_service):
        """Test getting comment count when no comments exist."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = None
        comment_service.db.execute = AsyncMock(return_value=mock_result)
        
        count = await comment_service.get_comment_count("post-123")
        
        assert count == 0
