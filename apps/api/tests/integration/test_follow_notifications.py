"""
Integration tests for follow notifications.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.notification import Notification
from app.services.follow_service import FollowService
from app.services.notification_service import NotificationService


class TestFollowNotifications:
    """Test follow notification integration."""

    @pytest.mark.asyncio
    async def test_follow_creates_notification(self, db_session: AsyncSession):
        """Test that following a user creates a notification for the followed user."""
        # Create two users
        follower = User(
            username="follower_user",
            email="follower@example.com",
            hashed_password="hashed_password"
        )
        followed = User(
            username="followed_user", 
            email="followed@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add(follower)
        db_session.add(followed)
        await db_session.commit()
        await db_session.refresh(follower)
        await db_session.refresh(followed)
        
        # Follow the user
        follow_service = FollowService(db_session)
        result = await follow_service.follow_user(follower.id, followed.id)
        
        # Verify follow was created
        assert result["follower_id"] == follower.id
        assert result["followed_id"] == followed.id
        assert result["status"] == "active"
        
        # Verify notification was created
        notifications = await NotificationService.get_user_notifications(
            db_session, followed.id, limit=10
        )
        
        assert len(notifications) == 1
        notification = notifications[0]
        assert notification.type == "new_follower"
        assert notification.title == "New Follower"
        assert notification.message == f"{follower.username} started following you"
        assert notification.data["follower_id"] == follower.id
        assert notification.data["follower_username"] == follower.username
        assert not notification.read

    @pytest.mark.asyncio
    async def test_self_follow_no_notification(self, db_session: AsyncSession):
        """Test that self-following doesn't create a notification."""
        # Create a user
        user = User(
            username="test_user",
            email="test@example.com", 
            hashed_password="hashed_password"
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # Try to follow self (should fail)
        follow_service = FollowService(db_session)
        
        with pytest.raises(Exception):  # Should raise ValidationException
            await follow_service.follow_user(user.id, user.id)
        
        # Verify no notification was created
        notifications = await NotificationService.get_user_notifications(
            db_session, user.id, limit=10
        )
        
        assert len(notifications) == 0

    @pytest.mark.asyncio
    async def test_multiple_follows_create_multiple_notifications(self, db_session: AsyncSession):
        """Test that multiple users following creates separate notifications."""
        # Create three users - one followed, two followers
        followed = User(
            username="popular_user",
            email="popular@example.com",
            hashed_password="hashed_password"
        )
        follower1 = User(
            username="follower1",
            email="follower1@example.com",
            hashed_password="hashed_password"
        )
        follower2 = User(
            username="follower2",
            email="follower2@example.com", 
            hashed_password="hashed_password"
        )
        
        db_session.add_all([followed, follower1, follower2])
        await db_session.commit()
        await db_session.refresh(followed)
        await db_session.refresh(follower1)
        await db_session.refresh(follower2)
        
        # Both users follow the popular user
        follow_service = FollowService(db_session)
        
        await follow_service.follow_user(follower1.id, followed.id)
        await follow_service.follow_user(follower2.id, followed.id)
        
        # Verify two notifications were created
        notifications = await NotificationService.get_user_notifications(
            db_session, followed.id, limit=10
        )
        
        assert len(notifications) == 2
        
        # Check first notification
        notification1 = notifications[0]  # Most recent first
        assert notification1.type == "new_follower"
        assert notification1.data["follower_username"] == follower2.username
        
        # Check second notification
        notification2 = notifications[1]
        assert notification2.type == "new_follower"
        assert notification2.data["follower_username"] == follower1.username

    @pytest.mark.asyncio
    async def test_follow_notification_rate_limiting(self, db_session: AsyncSession):
        """Test that follow notifications respect rate limiting."""
        # Create users
        followed = User(
            username="followed_user",
            email="followed@example.com",
            hashed_password="hashed_password"
        )
        
        db_session.add(followed)
        await db_session.commit()
        await db_session.refresh(followed)
        
        # Create many followers to test rate limiting
        followers = []
        for i in range(25):  # More than the rate limit of 20
            follower = User(
                username=f"follower_{i}",
                email=f"follower_{i}@example.com",
                hashed_password="hashed_password"
            )
            followers.append(follower)
            db_session.add(follower)
        
        await db_session.commit()
        
        # Follow with all users
        follow_service = FollowService(db_session)
        
        for follower in followers:
            await db_session.refresh(follower)
            await follow_service.follow_user(follower.id, followed.id)
        
        # Verify notifications were rate limited
        notifications = await NotificationService.get_user_notifications(
            db_session, followed.id, limit=50
        )
        
        # Should have at most 20 notifications due to rate limiting
        assert len(notifications) <= 20
        
        # All notifications should be follow notifications
        for notification in notifications:
            assert notification.type == "new_follower"
            assert not notification.read