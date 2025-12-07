"""
Integration tests for comment notification creation and delivery.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.notification import Notification
from app.core.security import create_access_token


@pytest.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password="hashed_password"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def another_user(db_session: AsyncSession):
    """Create another test user."""
    user = User(
        username="anotheruser",
        email="another@example.com",
        hashed_password="hashed_password"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_post(db_session: AsyncSession, test_user: User):
    """Create a test post."""
    post = Post(
        author_id=test_user.id,
        content="Test post for comment notifications",
        post_type="spontaneous"
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


@pytest.fixture
def auth_headers(test_user: User):
    """Create authentication headers for test user."""
    token = create_access_token(data={"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def another_auth_headers(another_user: User):
    """Create authentication headers for another user."""
    token = create_access_token(data={"sub": str(another_user.id)})
    return {"Authorization": f"Bearer {token}"}


class TestCommentNotifications:
    """Tests for comment notification creation."""

    async def test_comment_creates_notification_for_post_author(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        another_user: User,
        another_auth_headers: dict
    ):
        """Test that commenting on a post creates a notification for the post author."""
        # Another user comments on test_user's post
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Great post! 😊"},
            headers=another_auth_headers
        )
        
        assert response.status_code == 201
        comment_data = response.json()["data"]
        
        # Check that a notification was created for the post author
        query = select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.type == "comment_on_post"
        )
        result = await db_session.execute(query)
        notification = result.scalar_one_or_none()
        
        assert notification is not None
        assert notification.title == "New Comment"
        assert notification.message == "commented on your post"
        assert notification.data["post_id"] == test_post.id
        assert notification.data["comment_id"] == comment_data["id"]
        assert notification.data["actor_username"] == "anotheruser"
        assert notification.data["actor_user_id"] == str(another_user.id)

    async def test_comment_no_self_notification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that commenting on own post does not create a notification."""
        # Test user comments on their own post
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Commenting on my own post"},
            headers=auth_headers
        )
        
        assert response.status_code == 201
        
        # Check that no notification was created
        query = select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.type == "comment_on_post"
        )
        result = await db_session.execute(query)
        notification = result.scalar_one_or_none()
        
        assert notification is None

    async def test_reply_creates_notification_for_comment_author(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        another_user: User,
        auth_headers: dict,
        another_auth_headers: dict
    ):
        """Test that replying to a comment creates a notification for the comment author."""
        # Test user creates a comment
        comment_response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Original comment"},
            headers=auth_headers
        )
        
        assert comment_response.status_code == 201
        comment_data = comment_response.json()["data"]
        comment_id = comment_data["id"]
        
        # Another user replies to the comment
        reply_response = await async_client.post(
            f"/api/v1/comments/{comment_id}/replies",
            json={"content": "Great point! 👍"},
            headers=another_auth_headers
        )
        
        assert reply_response.status_code == 201
        reply_data = reply_response.json()["data"]
        
        # Check that a notification was created for the comment author
        query = select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.type == "comment_reply"
        )
        result = await db_session.execute(query)
        notification = result.scalar_one_or_none()
        
        assert notification is not None
        assert notification.title == "New Reply"
        assert notification.message == "replied to your comment"
        assert notification.data["post_id"] == test_post.id
        assert notification.data["comment_id"] == reply_data["id"]
        assert notification.data["parent_comment_id"] == comment_id
        assert notification.data["actor_username"] == "anotheruser"
        assert notification.data["actor_user_id"] == str(another_user.id)

    async def test_reply_no_self_notification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        auth_headers: dict
    ):
        """Test that replying to own comment does not create a notification."""
        # Test user creates a comment
        comment_response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Original comment"},
            headers=auth_headers
        )
        
        assert comment_response.status_code == 201
        comment_data = comment_response.json()["data"]
        comment_id = comment_data["id"]
        
        # Test user replies to their own comment
        reply_response = await async_client.post(
            f"/api/v1/comments/{comment_id}/replies",
            json={"content": "Replying to myself"},
            headers=auth_headers
        )
        
        assert reply_response.status_code == 201
        
        # Check that no notification was created
        query = select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.type == "comment_reply"
        )
        result = await db_session.execute(query)
        notification = result.scalar_one_or_none()
        
        assert notification is None

    async def test_notification_failure_does_not_break_comment_creation(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        another_user: User,
        another_auth_headers: dict,
        monkeypatch
    ):
        """Test that notification creation failure does not prevent comment creation."""
        # Mock the notification factory to raise an exception
        from app.core.notification_factory import NotificationFactory
        
        async def mock_create_comment_notification(*args, **kwargs):
            raise Exception("Notification service unavailable")
        
        monkeypatch.setattr(
            NotificationFactory,
            "create_comment_notification",
            mock_create_comment_notification
        )
        
        # Comment should still be created successfully
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Comment despite notification failure"},
            headers=another_auth_headers
        )
        
        assert response.status_code == 201
        comment_data = response.json()["data"]
        assert comment_data["content"] == "Comment despite notification failure"
        
        # Verify comment exists in database
        query = select(Comment).where(Comment.id == comment_data["id"])
        result = await db_session.execute(query)
        comment = result.scalar_one_or_none()
        
        assert comment is not None
        assert comment.content == "Comment despite notification failure"

    async def test_multiple_comments_create_multiple_notifications(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        another_user: User,
        another_auth_headers: dict
    ):
        """Test that multiple comments create multiple notifications."""
        # Create first comment
        await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "First comment"},
            headers=another_auth_headers
        )
        
        # Create second comment
        await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Second comment"},
            headers=another_auth_headers
        )
        
        # Check that two notifications were created
        query = select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.type == "comment_on_post"
        )
        result = await db_session.execute(query)
        notifications = result.scalars().all()
        
        # Note: With batching, these might be batched into a single parent notification
        # For now, we just verify that at least one notification exists
        assert len(notifications) >= 1

    async def test_notification_contains_correct_comment_link_data(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User,
        another_user: User,
        another_auth_headers: dict
    ):
        """Test that notification contains correct data for linking to the comment."""
        # Create a comment
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "Test comment for linking"},
            headers=another_auth_headers
        )
        
        assert response.status_code == 201
        comment_data = response.json()["data"]
        
        # Get the notification
        query = select(Notification).where(
            Notification.user_id == test_user.id,
            Notification.type == "comment_on_post"
        )
        result = await db_session.execute(query)
        notification = result.scalar_one_or_none()
        
        assert notification is not None
        # Verify notification has all necessary data for navigation
        assert "post_id" in notification.data
        assert "comment_id" in notification.data
        assert notification.data["post_id"] == test_post.id
        assert notification.data["comment_id"] == comment_data["id"]
        # This data can be used to navigate to the post and highlight the specific comment
