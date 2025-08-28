"""
Integration tests for mention notifications functionality.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post
from app.models.mention import Mention
from app.models.notification import Notification
from app.services.notification_service import NotificationService


class TestMentionNotifications:
    """Test mention notifications integration."""

    async def test_post_creation_with_mentions_creates_notifications(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that creating a post with mentions creates notifications for mentioned users."""
        # Create test users
        user1 = User(
            username="author",
            email="author@example.com",
            hashed_password="hashed_password"
        )
        user2 = User(
            username="mentioned_user",
            email="mentioned@example.com", 
            hashed_password="hashed_password"
        )
        user3 = User(
            username="another_user",
            email="another@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add_all([user1, user2, user3])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)
        await db_session.refresh(user3)

        # Create post with mentions
        post_data = {
            "content": "Thanks @mentioned_user and @another_user for your help!",
            "post_type": "spontaneous",
            "title": "Gratitude Post"
        }

        # Mock the auth to use user1 as the author
        headers = {"Authorization": f"Bearer {auth_headers['Authorization'].split(' ')[1]}"}
        
        # Update the auth headers to use user1's ID (we'll need to create a proper token)
        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(user1.id)})
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        assert response.status_code == 201
        post_response = response.json()
        post_id = post_response["id"]

        # Verify mentions were created
        from sqlalchemy import text
        mentions = await db_session.execute(
            text("SELECT * FROM mentions WHERE post_id = :post_id"),
            {"post_id": post_id}
        )
        mention_rows = mentions.fetchall()
        assert len(mention_rows) == 2

        # Verify notifications were created for mentioned users
        notifications = await db_session.execute(
            text("SELECT * FROM notifications WHERE type = 'mention' AND user_id IN (:user2_id, :user3_id)"),
            {"user2_id": user2.id, "user3_id": user3.id}
        )
        notification_rows = notifications.fetchall()
        assert len(notification_rows) == 2

        # Verify notification content
        import json
        for notification_row in notification_rows:
            assert notification_row.type == "mention"
            assert "author mentioned you in a post" in notification_row.message
            notification_data = json.loads(notification_row.data)
            assert notification_data["post_id"] == post_id
            assert notification_data["author_username"] == "author"

    async def test_self_mention_does_not_create_notification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that mentioning yourself does not create a notification."""
        # Create test user
        user = User(
            username="self_mentioner",
            email="self@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create post with self-mention
        post_data = {
            "content": "I'm grateful for @self_mentioner (myself) today!",
            "post_type": "daily",
            "title": "Self Gratitude"
        }

        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        assert response.status_code == 201
        post_response = response.json()
        post_id = post_response["id"]

        # Verify mention was not created (self-mentions are filtered out)
        from sqlalchemy import text
        mentions = await db_session.execute(
            text("SELECT * FROM mentions WHERE post_id = :post_id"),
            {"post_id": post_id}
        )
        mention_rows = mentions.fetchall()
        assert len(mention_rows) == 0

        # Verify no notification was created
        notifications = await db_session.execute(
            text("SELECT * FROM notifications WHERE type = 'mention' AND user_id = :user_id"),
            {"user_id": user.id}
        )
        notification_rows = notifications.fetchall()
        assert len(notification_rows) == 0

    async def test_mention_nonexistent_user_does_not_create_notification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that mentioning a nonexistent user does not create notifications."""
        # Create test user
        user = User(
            username="author",
            email="author@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create post with mention of nonexistent user
        post_data = {
            "content": "Thanks @nonexistent_user for the inspiration!",
            "post_type": "spontaneous",
            "title": "Gratitude Post"
        }

        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        assert response.status_code == 201
        post_response = response.json()
        post_id = post_response["id"]

        # Verify no mentions were created
        from sqlalchemy import text
        mentions = await db_session.execute(
            text("SELECT * FROM mentions WHERE post_id = :post_id"),
            {"post_id": post_id}
        )
        mention_rows = mentions.fetchall()
        assert len(mention_rows) == 0

        # Verify no notifications were created
        notifications = await db_session.execute(
            text("SELECT * FROM notifications WHERE type = 'mention'")
        )
        notification_rows = notifications.fetchall()
        assert len(notification_rows) == 0

    async def test_multiple_mentions_same_user_creates_single_notification(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that mentioning the same user multiple times creates only one notification."""
        # Create test users
        user1 = User(
            username="author",
            email="author@example.com",
            hashed_password="hashed_password"
        )
        user2 = User(
            username="mentioned_user",
            email="mentioned@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)

        # Create post with multiple mentions of the same user
        post_data = {
            "content": "Thanks @mentioned_user for your help! @mentioned_user is amazing!",
            "post_type": "spontaneous",
            "title": "Gratitude Post"
        }

        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(user1.id)})
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        assert response.status_code == 201
        post_response = response.json()
        post_id = post_response["id"]

        # Verify only one mention was created (duplicates are filtered)
        from sqlalchemy import text
        mentions = await db_session.execute(
            text("SELECT * FROM mentions WHERE post_id = :post_id"),
            {"post_id": post_id}
        )
        mention_rows = mentions.fetchall()
        assert len(mention_rows) == 1

        # Verify only one notification was created
        notifications = await db_session.execute(
            text("SELECT * FROM notifications WHERE type = 'mention' AND user_id = :user_id"),
            {"user_id": user2.id}
        )
        notification_rows = notifications.fetchall()
        assert len(notification_rows) == 1

    async def test_mention_notification_content_format(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that mention notification has correct content format."""
        # Create test users
        user1 = User(
            username="grateful_author",
            email="author@example.com",
            hashed_password="hashed_password"
        )
        user2 = User(
            username="helpful_friend",
            email="friend@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)

        # Create post with mention
        long_content = "I'm so grateful for @helpful_friend who helped me through a difficult time. " * 3
        post_data = {
            "content": long_content,
            "post_type": "daily",
            "title": "Deep Gratitude"
        }

        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(user1.id)})
        headers = {"Authorization": f"Bearer {token}"}

        response = await async_client.post("/api/v1/posts/", json=post_data, headers=headers)
        
        assert response.status_code == 201
        post_response = response.json()
        post_id = post_response["id"]

        # Get the notification
        from sqlalchemy import text
        notifications = await db_session.execute(
            text("SELECT * FROM notifications WHERE type = 'mention' AND user_id = :user_id"),
            {"user_id": user2.id}
        )
        notification_row = notifications.fetchone()
        
        assert notification_row is not None
        assert notification_row.title == "You were mentioned"
        assert "grateful_author mentioned you in a post:" in notification_row.message
        
        # Verify notification data
        import json
        notification_data = json.loads(notification_row.data)
        assert notification_data["post_id"] == post_id
        assert notification_data["author_username"] == "grateful_author"
        assert "post_preview" in notification_data
        # Preview should be truncated if content is long
        assert len(notification_data["post_preview"]) <= 103  # 100 chars + "..."

    async def test_post_creation_with_file_upload_processes_mentions(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict
    ):
        """Test that file upload post creation also processes mentions."""
        # Create test users
        user1 = User(
            username="photo_author",
            email="photo@example.com",
            hashed_password="hashed_password"
        )
        user2 = User(
            username="photo_friend",
            email="photofriend@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        await db_session.refresh(user1)
        await db_session.refresh(user2)

        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(user1.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Create form data for file upload
        form_data = {
            "content": "Beautiful sunset with @photo_friend today!",
            "post_type": "photo",
            "title": "Sunset Gratitude"
        }

        response = await async_client.post(
            "/api/v1/posts/upload", 
            data=form_data, 
            headers=headers
        )
        
        assert response.status_code == 201
        post_response = response.json()
        post_id = post_response["id"]

        # Verify mention was created
        from sqlalchemy import text
        mentions = await db_session.execute(
            text("SELECT * FROM mentions WHERE post_id = :post_id"),
            {"post_id": post_id}
        )
        mention_rows = mentions.fetchall()
        assert len(mention_rows) == 1

        # Verify notification was created
        notifications = await db_session.execute(
            text("SELECT * FROM notifications WHERE type = 'mention' AND user_id = :user_id"),
            {"user_id": user2.id}
        )
        notification_rows = notifications.fetchall()
        assert len(notification_rows) == 1