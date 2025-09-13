"""
Integration tests for mention system fixes.
Tests for:
1. "Unknown user" issue fix in notifications
2. Special characters highlighting fix
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.core.security import create_access_token


class TestMentionFixes:
    """Test mention system fixes for notifications and special characters."""

    async def test_mention_notification_shows_correct_author_username(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test that mention notifications show correct author username, not 'Unknown user'."""
        # Create test users
        author = User(
            username="grateful_author",
            email="author@example.com",
            hashed_password="hashed_password"
        )
        mentioned_user = User(
            username="mentioned_friend",
            email="friend@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add_all([author, mentioned_user])
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(mentioned_user)

        # Create post with mention
        post_data = {
            "content": "Thank you @mentioned_friend for everything!",
            "post_type": "daily",
            "title": "Daily Gratitude"
        }

        author_token = create_access_token(data={"sub": str(author.id)})
        author_headers = {"Authorization": f"Bearer {author_token}"}

        response = await async_client.post("/api/v1/posts/", json=post_data, headers=author_headers)
        assert response.status_code == 201

        # Check notification via API for mentioned user
        mentioned_token = create_access_token(data={"sub": str(mentioned_user.id)})
        mentioned_headers = {"Authorization": f"Bearer {mentioned_token}"}

        notifications_response = await async_client.get(
            "/api/v1/notifications", 
            headers=mentioned_headers
        )
        assert notifications_response.status_code == 200
        notifications_data = notifications_response.json()
        
        # Should have one mention notification
        assert len(notifications_data) == 1
        notification = notifications_data[0]
        
        # Verify notification shows correct author username (not "Unknown user")
        assert notification["type"] == "mention"
        assert notification["title"] == "You were mentioned"
        assert notification["message"] == "mentioned you in a post"
        assert "Unknown user" not in notification["message"]
        
        # Verify from_user field is properly set
        assert notification["from_user"] is not None
        assert notification["from_user"]["username"] == "grateful_author"
        assert notification["data"]["author_username"] == "grateful_author"
        assert notification["data"]["actor_username"] == "grateful_author"

    async def test_mention_notification_with_special_characters_in_username(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test that mentions work with usernames containing special characters."""
        # Create test users with special characters in usernames
        author = User(
            username="author_user",
            email="author@example.com",
            hashed_password="hashed_password"
        )
        user_with_special_chars = User(
            username="Bob7??",  # Username with special characters
            email="bob@example.com",
            hashed_password="hashed_password"
        )
        user_with_dots_dashes = User(
            username="alice.doe-123",  # Username with dots and dashes
            email="alice@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add_all([author, user_with_special_chars, user_with_dots_dashes])
        await db_session.commit()
        await db_session.refresh(author)
        await db_session.refresh(user_with_special_chars)
        await db_session.refresh(user_with_dots_dashes)

        # Create post with mentions of users with special characters
        post_data = {
            "content": "Thanks @Bob7?? and @alice.doe-123 for your help!",
            "post_type": "spontaneous",
            "title": "Gratitude Post"
        }

        author_token = create_access_token(data={"sub": str(author.id)})
        author_headers = {"Authorization": f"Bearer {author_token}"}

        response = await async_client.post("/api/v1/posts/", json=post_data, headers=author_headers)
        assert response.status_code == 201
        post_response = response.json()
        post_id = post_response["id"]

        # Verify mentions were created for both users
        from sqlalchemy import text
        mentions = await db_session.execute(
            text("SELECT * FROM mentions WHERE post_id = :post_id"),
            {"post_id": post_id}
        )
        mention_rows = mentions.fetchall()
        assert len(mention_rows) == 2

        # Check notifications for user with special characters
        special_char_token = create_access_token(data={"sub": str(user_with_special_chars.id)})
        special_char_headers = {"Authorization": f"Bearer {special_char_token}"}

        notifications_response = await async_client.get(
            "/api/v1/notifications", 
            headers=special_char_headers
        )
        assert notifications_response.status_code == 200
        notifications_data = notifications_response.json()
        
        # Should have one mention notification
        assert len(notifications_data) == 1
        notification = notifications_data[0]
        
        # Verify notification content
        assert notification["type"] == "mention"
        assert notification["title"] == "You were mentioned"
        assert notification["message"] == "mentioned you in a post"
        assert notification["from_user"]["username"] == "author_user"
        assert notification["data"]["author_username"] == "author_user"
        assert notification["data"]["actor_username"] == "author_user"

        # Check notifications for user with dots and dashes
        dots_dashes_token = create_access_token(data={"sub": str(user_with_dots_dashes.id)})
        dots_dashes_headers = {"Authorization": f"Bearer {dots_dashes_token}"}

        notifications_response = await async_client.get(
            "/api/v1/notifications", 
            headers=dots_dashes_headers
        )
        assert notifications_response.status_code == 200
        notifications_data = notifications_response.json()
        
        # Should have one mention notification
        assert len(notifications_data) == 1
        notification = notifications_data[0]
        
        # Verify notification content
        assert notification["type"] == "mention"
        assert notification["title"] == "You were mentioned"
        assert notification["message"] == "mentioned you in a post"
        assert notification["from_user"]["username"] == "author_user"
        assert notification["data"]["author_username"] == "author_user"
        assert notification["data"]["actor_username"] == "author_user"