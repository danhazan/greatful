"""
Integration tests for notification API endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post
from app.models.notification import Notification
from app.services.notification_service import NotificationService


class TestNotificationsAPI:
    """Test notification API endpoints."""

    @pytest.mark.asyncio
    async def test_get_notifications_empty(self, client: AsyncClient, auth_headers: dict):
        """Test getting notifications when user has none."""
        response = client.get("/api/v1/notifications", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_get_notifications_with_data(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User):
        """Test getting notifications when user has some."""
        # Use the existing test_user from fixture
        user = test_user

        # Create some test notifications
        notification1 = await NotificationService.create_notification(
            db=db_session,
            user_id=user.id,
            notification_type="emoji_reaction",
            title="New Reaction",
            message="Someone reacted to your post",
            data={"post_id": "test-post", "emoji_code": "heart_eyes"}
        )

        notification2 = await NotificationService.create_notification(
            db=db_session,
            user_id=user.id,
            notification_type="emoji_reaction",
            title="Another Reaction",
            message="Another reaction on your post",
            data={"post_id": "test-post-2", "emoji_code": "fire"}
        )

        response = client.get("/api/v1/notifications", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        
        # Check notification structure
        notification = data[0]  # Most recent first
        assert "id" in notification
        assert "type" in notification
        assert "title" in notification
        assert "message" in notification
        assert "data" in notification
        assert "read" in notification
        assert "created_at" in notification
        assert notification["read"] is False

    @pytest.mark.asyncio
    async def test_get_notifications_with_pagination(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User):
        """Test notification pagination."""
        # Use the existing test_user from fixture
        user = test_user

        # Create multiple notifications
        for i in range(5):
            await NotificationService.create_notification(
                db=db_session,
                user_id=user.id,
                notification_type="emoji_reaction",
                title=f"Reaction {i}",
                message=f"Reaction {i} message",
                data={"post_id": f"post-{i}"}
            )

        # Test with limit
        response = client.get("/api/v1/notifications?limit=3", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Test with offset
        response = client.get("/api/v1/notifications?limit=3&offset=2", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    @pytest.mark.asyncio
    async def test_get_notification_summary(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User):
        """Test getting notification summary."""
        # Use the existing test_user from fixture
        user = test_user

        # Create some notifications (some read, some unread)
        notification1 = await NotificationService.create_notification(
            db=db_session,
            user_id=user.id,
            notification_type="emoji_reaction",
            title="Unread Notification",
            message="This is unread",
            data={}
        )

        notification2 = await NotificationService.create_notification(
            db=db_session,
            user_id=user.id,
            notification_type="emoji_reaction",
            title="Read Notification",
            message="This is read",
            data={}
        )

        # Mark one as read
        await NotificationService.mark_as_read(db=db_session, notification_id=notification2.id, user_id=user.id)

        response = client.get("/api/v1/notifications/summary", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        assert "total_count" in data
        assert data["unread_count"] == 1
        assert data["total_count"] == 2

    @pytest.mark.asyncio
    async def test_mark_notification_as_read(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User):
        """Test marking a notification as read."""
        # Use the existing test_user from fixture
        user = test_user

        # Create a notification
        notification = await NotificationService.create_notification(
            db=db_session,
            user_id=user.id,
            notification_type="emoji_reaction",
            title="Test Notification",
            message="Test message",
            data={}
        )

        assert not notification.read

        # Mark as read via API
        response = client.post(f"/api/v1/notifications/{notification.id}/read", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify it's marked as read in database
        await db_session.refresh(notification)
        assert notification.read is True
        assert notification.read_at is not None

    @pytest.mark.asyncio
    async def test_mark_all_notifications_as_read(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User):
        """Test marking all notifications as read."""
        # Use the existing test_user from fixture
        user = test_user

        # Create multiple notifications
        notifications = []
        for i in range(3):
            notification = await NotificationService.create_notification(
                db=db_session,
                user_id=user.id,
                notification_type="emoji_reaction",
                title=f"Notification {i}",
                message=f"Message {i}",
                data={}
            )
            notifications.append(notification)

        # Verify all are unread
        for notification in notifications:
            assert not notification.read

        # Mark all as read via API
        response = client.post("/api/v1/notifications/read-all", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["marked_count"] == 3

        # Verify all are marked as read in database
        for notification in notifications:
            await db_session.refresh(notification)
            assert notification.read is True
            assert notification.read_at is not None

    @pytest.mark.asyncio
    async def test_unauthorized_access(self, client: AsyncClient):
        """Test that notification endpoints require authentication."""
        # Test without auth headers
        response = client.get("/api/v1/notifications")
        assert response.status_code == 403

        response = client.get("/api/v1/notifications/summary")
        assert response.status_code == 403

        response = client.post("/api/v1/notifications/some-id/read")
        assert response.status_code == 403

        response = client.post("/api/v1/notifications/read-all")
        assert response.status_code == 403