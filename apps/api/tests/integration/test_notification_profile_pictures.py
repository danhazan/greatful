"""
Integration tests for notification profile pictures functionality.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.notification_factory import NotificationFactory
from app.core.security import create_access_token


class TestNotificationProfilePictures:
    """Test notification API with profile picture integration."""

    def _create_auth_headers(self, user_id: int) -> dict:
        """Helper to create auth headers for any user."""
        token = create_access_token({"sub": str(user_id)})
        return {"Authorization": f"Bearer {token}"}

    async def test_notification_with_profile_picture(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        test_user_with_profile,
        test_user_2
    ):
        """Test that notifications include profile pictures when available."""
        # Create a notification using the factory
        notification_factory = NotificationFactory(db_session)
        
        # Create a reaction notification from user with profile picture to user without
        await notification_factory.create_reaction_notification(
            post_author_id=test_user_2.id,
            reactor_username=test_user_with_profile.username,
            reactor_id=test_user_with_profile.id,
            post_id="test-post-123",
            emoji_code="heart_eyes"
        )
        
        await db_session.commit()
        
        # Get notifications for the recipient
        headers = self._create_auth_headers(test_user_2.id)
        
        response = await async_client.get(
            "/api/v1/notifications",
            headers=headers
        )
        
        assert response.status_code == 200
        notifications = response.json()
        
        assert len(notifications) == 1
        notification = notifications[0]
        
        # Verify the notification has profile picture data
        assert notification["from_user"] is not None
        assert notification["from_user"]["id"] == str(test_user_with_profile.id)
        assert notification["from_user"]["username"] == test_user_with_profile.username
        assert notification["from_user"]["name"] == test_user_with_profile.display_name
        assert notification["from_user"]["image"] == test_user_with_profile.profile_image_url

    async def test_notification_without_profile_picture(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        test_user,
        test_user_2
    ):
        """Test that notifications work correctly when user has no profile picture."""
        # Create a notification using the factory
        notification_factory = NotificationFactory(db_session)
        
        # Create a reaction notification from user without profile picture
        await notification_factory.create_reaction_notification(
            post_author_id=test_user_2.id,
            reactor_username=test_user.username,
            reactor_id=test_user.id,
            post_id="test-post-456",
            emoji_code="thumbs_up"
        )
        
        await db_session.commit()
        
        # Get notifications for the recipient
        headers = self._create_auth_headers(test_user_2.id)
        
        response = await async_client.get(
            "/api/v1/notifications",
            headers=headers
        )
        
        assert response.status_code == 200
        notifications = response.json()
        
        assert len(notifications) == 1
        notification = notifications[0]
        
        # Verify the notification has user data but no profile picture
        assert notification["from_user"] is not None
        assert notification["from_user"]["id"] == str(test_user.id)
        assert notification["from_user"]["username"] == test_user.username
        assert notification["from_user"]["name"] == test_user.username  # Falls back to username
        assert notification["from_user"]["image"] is None