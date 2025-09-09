"""
Integration tests for share API endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post, PostType


class TestShareAPI:
    """Test share API endpoints."""

    @pytest.fixture
    async def test_user(self, db_session: AsyncSession):
        """Create a test user."""
        user = User(
            email="testuser@example.com",
            username="testuser",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def test_recipient(self, db_session: AsyncSession):
        """Create a test recipient user."""
        user = User(
            email="recipient@example.com",
            username="recipient",
            hashed_password="hashed_password"
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def test_post(self, db_session: AsyncSession, test_user: User):
        """Create a test post."""
        post = Post(
            author_id=test_user.id,
            content="Test gratitude post for sharing",
            post_type=PostType.daily,
            is_public=True
        )
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        return post

    @pytest.fixture
    def auth_headers(self, test_user: User):
        """Create authentication headers."""
        from app.core.security import create_access_token
        token = create_access_token(data={"sub": str(test_user.id)})
        return {"Authorization": f"Bearer {token}"}

    async def test_share_post_via_url(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test sharing a post via URL."""
        share_data = {
            "share_method": "url"
        }
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["user_id"] == test_user.id
        assert data["post_id"] == test_post.id
        assert data["share_method"] == "url"
        assert "share_url" in data
        assert f"/post/{test_post.id}" in data["share_url"]
        assert data["recipient_count"] is None
        assert data["message_content"] is None

    async def test_share_post_via_message(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_recipient: User,
        test_post: Post, 
        auth_headers: dict
    ):
        """Test sharing a post via message."""
        share_data = {
            "share_method": "message",
            "recipient_ids": [test_recipient.id],
            "message": "Check out this amazing post!"
        }
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["user_id"] == test_user.id
        assert data["post_id"] == test_post.id
        assert data["share_method"] == "message"
        assert data["share_url"] is None
        assert data["recipient_count"] == 1
        assert data["message_content"] is None  # Simplified design: no message content

    async def test_share_post_invalid_method(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test sharing with invalid method."""
        share_data = {
            "share_method": "invalid_method"
        }
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422

    async def test_share_message_without_recipients(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test message sharing without recipients."""
        share_data = {
            "share_method": "message",
            "message": "Test message"
        }
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422

    async def test_share_message_too_many_recipients(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test message sharing with too many recipients."""
        share_data = {
            "share_method": "message",
            "recipient_ids": [1, 2, 3, 4, 5, 6],  # More than 5
            "message": "Test message"
        }
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422

    async def test_share_message_too_long(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_recipient: User,
        test_post: Post, 
        auth_headers: dict
    ):
        """Test message sharing with message too long."""
        share_data = {
            "share_method": "message",
            "recipient_ids": [test_recipient.id],
            "message": "x" * 5001  # More than 5000 characters
        }
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422

    async def test_share_nonexistent_post(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        auth_headers: dict
    ):
        """Test sharing a nonexistent post."""
        share_data = {
            "share_method": "url"
        }
        
        response = await async_client.post(
            "/api/v1/posts/nonexistent-post-id/share",
            json=share_data,
            headers=auth_headers
        )
        
        assert response.status_code == 404

    async def test_share_without_auth(
        self, 
        async_client: AsyncClient, 
        test_post: Post
    ):
        """Test sharing without authentication."""
        share_data = {
            "share_method": "url"
        }
        
        response = await async_client.post(
            f"/api/v1/posts/{test_post.id}/share",
            json=share_data
        )
        
        # FastAPI HTTPBearer returns 403 when no token is provided
        assert response.status_code == 403

    async def test_rate_limiting_simulation(
        self, 
        async_client: AsyncClient, 
        test_user: User, 
        test_post: Post, 
        auth_headers: dict
    ):
        """Test that multiple shares work (rate limiting tested in unit tests)."""
        share_data = {
            "share_method": "url"
        }
        
        # Make multiple share requests (should work within rate limit)
        for _ in range(3):
            response = await async_client.post(
                f"/api/v1/posts/{test_post.id}/share",
                json=share_data,
                headers=auth_headers
            )
            assert response.status_code == 201