"""
Integration tests for notification batching API functionality.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post
from app.models.notification import Notification
from app.services.notification_service import NotificationService
from app.core.security import create_access_token


class TestNotificationBatchingAPI:
    """Integration tests for notification batching with API endpoints."""

    @pytest.fixture
    async def test_users(self, db_session: AsyncSession):
        """Create test users."""
        # Create post author
        author = User(
            username="author",
            email="author@example.com",
            hashed_password="hashed"
        )
        db_session.add(author)
        
        # Create reactor user
        reactor = User(
            username="reactor",
            email="reactor@example.com",
            hashed_password="hashed"
        )
        db_session.add(reactor)
        
        await db_session.commit()
        
        # Refresh to get IDs
        await db_session.refresh(author)
        await db_session.refresh(reactor)
        
        return author, reactor

    @pytest.fixture
    async def test_post(self, db_session: AsyncSession, test_users):
        """Create a test post."""
        author, _ = test_users
        
        post = Post(
            content="Test gratitude post",
            author_id=author.id,
            post_type="spontaneous"
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        return post

    @pytest.fixture
    async def auth_headers(self, test_users):
        """Create authentication headers for the author."""
        author, _ = test_users
        token = create_access_token(data={"sub": str(author.id)})
        return {"Authorization": f"Bearer {token}"}

    async def test_notification_stats_api_endpoint(
        self, 
        client: AsyncClient, 
        db_session: AsyncSession, 
        test_users, 
        auth_headers
    ):
        """Test the notification stats API endpoint."""
        author, _ = test_users
        
        # Create some notifications directly
        for i in range(3):
            await NotificationService.create_notification(
                db=db_session,
                user_id=author.id,
                notification_type="emoji_reaction",
                title="Test",
                message="Test message"
            )
        
        # Test the API endpoint
        response = client.get(
            "/api/v1/notifications/stats?notification_type=emoji_reaction",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['user_id'] == author.id
        assert data['notification_type'] == "emoji_reaction"
        assert data['last_hour'] == 3
        assert data['rate_limit_remaining'] == 2  # 5 - 3 = 2

    async def test_notification_batching_with_emoji_reactions(
        self, 
        client: AsyncClient, 
        db_session: AsyncSession, 
        test_users, 
        test_post,
        auth_headers
    ):
        """Test that notification batching works with emoji reaction API."""
        author, reactor = test_users
        
        # Create reactor auth headers
        reactor_token = create_access_token(data={"sub": str(reactor.id)})
        reactor_headers = {"Authorization": f"Bearer {reactor_token}"}
        
        # Create 5 emoji reactions (at the limit)
        for i in range(5):
            response = client.post(
                f"/api/v1/posts/{test_post.id}/reactions",
                json={"emoji_code": "heart_eyes"},
                headers=reactor_headers
            )
            assert response.status_code == 201
            
            # Remove the reaction to create a new one
            if i < 4:  # Don't remove the last one
                client.delete(
                    f"/api/v1/posts/{test_post.id}/reactions",
                    headers=reactor_headers
                )
        
        # Check that the author received notifications (should be 5)
        response = client.get(
            "/api/v1/notifications",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        notifications = response.json()
        
        # Should have exactly 5 notifications (at the rate limit)
        emoji_notifications = [n for n in notifications if n['type'] == 'emoji_reaction']
        assert len(emoji_notifications) == 5
        
        # Try to create one more reaction (should not create a notification due to rate limiting)
        client.delete(
            f"/api/v1/posts/{test_post.id}/reactions",
            headers=reactor_headers
        )
        
        response = client.post(
            f"/api/v1/posts/{test_post.id}/reactions",
            json={"emoji_code": "pray"},
            headers=reactor_headers
        )
        assert response.status_code == 201
        
        # Check notifications again - should still be 5
        response = client.get(
            "/api/v1/notifications",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        notifications = response.json()
        emoji_notifications = [n for n in notifications if n['type'] == 'emoji_reaction']
        assert len(emoji_notifications) == 5  # No new notification due to rate limiting

    async def test_notification_stats_shows_rate_limit_info(
        self, 
        client: AsyncClient, 
        db_session: AsyncSession, 
        test_users, 
        auth_headers
    ):
        """Test that notification stats show correct rate limit information."""
        author, _ = test_users
        
        # Create notifications up to the limit
        for i in range(5):
            await NotificationService.create_notification(
                db=db_session,
                user_id=author.id,
                notification_type="emoji_reaction",
                title="Test",
                message="Test message"
            )
        
        # Check stats
        response = client.get(
            "/api/v1/notifications/stats?notification_type=emoji_reaction",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['last_hour'] == 5
        assert data['rate_limit_remaining'] == 0  # At the limit
        
        # Try to create one more (should be blocked)
        blocked_notification = await NotificationService.create_notification(
            db=db_session,
            user_id=author.id,
            notification_type="emoji_reaction",
            title="Test",
            message="Test message"
        )
        
        assert blocked_notification is None
        
        # Stats should remain the same
        response = client.get(
            "/api/v1/notifications/stats?notification_type=emoji_reaction",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['last_hour'] == 5
        assert data['rate_limit_remaining'] == 0

    async def test_different_notification_types_separate_limits_api(
        self, 
        client: AsyncClient, 
        db_session: AsyncSession, 
        test_users, 
        auth_headers
    ):
        """Test that different notification types have separate limits via API."""
        author, _ = test_users
        
        # Fill up emoji_reaction limit
        for i in range(5):
            await NotificationService.create_notification(
                db=db_session,
                user_id=author.id,
                notification_type="emoji_reaction",
                title="Test",
                message="Test message"
            )
        
        # Check emoji_reaction stats (should be at limit)
        response = client.get(
            "/api/v1/notifications/stats?notification_type=emoji_reaction",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['rate_limit_remaining'] == 0
        
        # Create like notifications (should work as it's a different type)
        for i in range(3):
            await NotificationService.create_notification(
                db=db_session,
                user_id=author.id,
                notification_type="like",
                title="Test",
                message="Test message"
            )
        
        # Check like stats (should have remaining capacity)
        response = client.get(
            "/api/v1/notifications/stats?notification_type=like",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['last_hour'] == 3
        assert data['rate_limit_remaining'] == 2  # 5 - 3 = 2

    async def test_unauthorized_access_to_stats(self, client: AsyncClient):
        """Test that unauthorized users cannot access notification stats."""
        response = client.get("/api/v1/notifications/stats")
        
        assert response.status_code == 403