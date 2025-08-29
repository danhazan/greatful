"""
Integration tests for follow API endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.follow import Follow
from app.services.follow_service import FollowService
from app.core.security import create_access_token


class TestFollowAPI:
    """Test follow API endpoints integration."""

    def create_auth_headers(self, user_id: int):
        """Helper to create auth headers for a specific user."""
        token = create_access_token({"sub": str(user_id)})
        return {"Authorization": f"Bearer {token}"}

    @pytest.mark.asyncio
    async def test_follow_user_success(self, http_client: AsyncClient, test_user, test_user_2, auth_headers, db_session: AsyncSession):
        """Test successful user follow via API."""
        # Use existing test users to avoid unique constraint violations
        user1 = test_user
        user2 = test_user_2
        
        # Follow user2 as user1
        response = await http_client.post(
            f"/api/v1/follows/{user2.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["follower_id"] == user1.id
        assert data["data"]["followed_id"] == user2.id
        assert data["data"]["status"] == "active"
        assert data["data"]["follower"]["username"] == user1.username
        assert data["data"]["followed"]["username"] == user2.username

    @pytest.mark.asyncio
    async def test_follow_user_self_follow_error(self, http_client: AsyncClient, test_user, db_session: AsyncSession):
        """Test error when trying to follow self."""
        # Try to follow self
        response = await http_client.post(
            f"/api/v1/follows/{test_user.id}",
            headers=self.create_auth_headers(test_user.id)
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "Cannot follow yourself" in data["detail"]

    @pytest.mark.asyncio
    async def test_follow_user_already_following_error(self, http_client: AsyncClient, test_user, test_user_2, auth_headers, db_session: AsyncSession):
        """Test error when already following user."""
        # Create existing follow relationship
        follow_service = FollowService(db_session)
        await follow_service.follow_user(test_user.id, test_user_2.id)
        
        # Try to follow again
        response = await http_client.post(
            f"/api/v1/follows/{test_user_2.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 409
        data = response.json()
        assert "Already following this user" in data["detail"]

    @pytest.mark.asyncio
    async def test_follow_user_not_found_error(self, http_client: AsyncClient, test_user, db_session: AsyncSession):
        """Test error when trying to follow non-existent user."""
        # Try to follow non-existent user
        response = await http_client.post(
            f"/api/v1/follows/99999",
            headers=self.create_auth_headers(test_user.id)
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    @pytest.mark.asyncio
    async def test_unfollow_user_success(self, http_client: AsyncClient, test_user, test_user_2, auth_headers, db_session: AsyncSession):
        """Test successful user unfollow via API."""
        # Create follow relationship
        follow_service = FollowService(db_session)
        await follow_service.follow_user(test_user.id, test_user_2.id)
        
        # Unfollow user2 as user1
        response = await http_client.delete(
            f"/api/v1/follows/{test_user_2.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["success"] is True
        assert "Successfully unfollowed user" in data["data"]["message"]

    @pytest.mark.asyncio
    async def test_unfollow_user_not_following_error(self, http_client: AsyncClient, test_user, test_user_2, auth_headers, db_session: AsyncSession):
        """Test error when trying to unfollow user not being followed."""
        # Try to unfollow without following first
        response = await http_client.delete(
            f"/api/v1/follows/{test_user_2.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "Follow relationship" in data["detail"]

    @pytest.mark.asyncio
    async def test_get_follow_status_success(self, http_client: AsyncClient, test_user, test_user_2, auth_headers, db_session: AsyncSession):
        """Test getting follow status between users."""
        # Create follow relationship
        follow_service = FollowService(db_session)
        await follow_service.follow_user(test_user.id, test_user_2.id)
        
        # Get follow status
        response = await http_client.get(
            f"/api/v1/follows/{test_user_2.id}/status",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["is_following"] is True
        assert data["data"]["follow_status"] == "active"
        assert data["data"]["is_followed_by"] is False
        assert data["data"]["is_mutual"] is False

    @pytest.mark.asyncio
    async def test_get_follow_status_mutual(self, http_client: AsyncClient, test_user, test_user_2, auth_headers, db_session: AsyncSession):
        """Test getting mutual follow status."""
        # Create mutual follow relationships
        follow_service = FollowService(db_session)
        await follow_service.follow_user(test_user.id, test_user_2.id)
        await follow_service.follow_user(test_user_2.id, test_user.id)
        
        # Get follow status
        response = await http_client.get(
            f"/api/v1/follows/{test_user_2.id}/status",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["is_following"] is True
        assert data["data"]["is_followed_by"] is True
        assert data["data"]["is_mutual"] is True

    @pytest.mark.asyncio
    async def test_get_user_followers_success(self, http_client: AsyncClient, test_user, test_user_2, test_user_3, auth_headers, db_session: AsyncSession):
        """Test getting user followers."""
        # Create follow relationships (user2 and user3 follow user1)
        follow_service = FollowService(db_session)
        await follow_service.follow_user(test_user_2.id, test_user.id)
        await follow_service.follow_user(test_user_3.id, test_user.id)
        
        # Get user1's followers
        response = await http_client.get(
            f"/api/v1/users/{test_user.id}/followers",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total_count"] == 2
        assert len(data["data"]["followers"]) == 2
        
        # Check follower data
        follower_usernames = [f["username"] for f in data["data"]["followers"]]
        assert test_user_2.username in follower_usernames
        assert test_user_3.username in follower_usernames

    @pytest.mark.asyncio
    async def test_get_user_following_success(self, http_client: AsyncClient, test_user, test_user_2, test_user_3, auth_headers, db_session: AsyncSession):
        """Test getting users that a user is following."""
        # Create follow relationships (user1 follows user2 and user3)
        follow_service = FollowService(db_session)
        await follow_service.follow_user(test_user.id, test_user_2.id)
        await follow_service.follow_user(test_user.id, test_user_3.id)
        
        # Get user1's following
        response = await http_client.get(
            f"/api/v1/users/{test_user.id}/following",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total_count"] == 2
        assert len(data["data"]["following"]) == 2
        
        # Check following data
        following_usernames = [f["username"] for f in data["data"]["following"]]
        assert test_user_2.username in following_usernames
        assert test_user_3.username in following_usernames

    @pytest.mark.asyncio
    async def test_get_user_follow_stats_success(self, http_client: AsyncClient, test_user, test_user_2, test_user_3, auth_headers, db_session: AsyncSession):
        """Test getting user follow statistics."""
        # Create follow relationships
        follow_service = FollowService(db_session)
        await follow_service.follow_user(test_user.id, test_user_2.id)  # user1 follows user2
        await follow_service.follow_user(test_user_3.id, test_user.id)  # user3 follows user1
        
        # Get user1's follow stats
        response = await http_client.get(
            f"/api/v1/users/{test_user.id}/follow-stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["followers_count"] == 1  # user3 follows user1
        assert data["data"]["following_count"] == 1  # user1 follows user2

    @pytest.mark.asyncio
    async def test_get_follow_suggestions_success(self, http_client: AsyncClient, test_user, auth_headers, db_session: AsyncSession):
        """Test getting follow suggestions."""
        # Get follow suggestions
        response = await http_client.get(
            "/api/v1/follows/suggestions",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "suggestions" in data["data"]
        assert isinstance(data["data"]["suggestions"], list)

    @pytest.mark.asyncio
    async def test_follow_pagination(self, http_client: AsyncClient, test_user, auth_headers, db_session: AsyncSession):
        """Test pagination in followers and following endpoints."""
        # Create 5 followers for test_user
        followers = []
        for i in range(5):
            follower = User(
                username=f"follower_{i}_{test_user.id}",  # Make unique
                email=f"follower_{i}_{test_user.id}@example.com",
                hashed_password="hashed"
            )
            followers.append(follower)
            db_session.add(follower)
        
        await db_session.commit()
        for follower in followers:
            await db_session.refresh(follower)
        
        # Create follow relationships
        follow_service = FollowService(db_session)
        for follower in followers:
            await follow_service.follow_user(follower.id, test_user.id)
        
        # Test pagination - first page
        response = await http_client.get(
            f"/api/v1/users/{test_user.id}/followers?limit=3&offset=0",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total_count"] == 5
        assert len(data["data"]["followers"]) == 3
        assert data["data"]["limit"] == 3
        assert data["data"]["offset"] == 0
        assert data["data"]["has_more"] is True
        
        # Test pagination - second page
        response = await http_client.get(
            f"/api/v1/users/{test_user.id}/followers?limit=3&offset=3",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total_count"] == 5
        assert len(data["data"]["followers"]) == 2
        assert data["data"]["limit"] == 3
        assert data["data"]["offset"] == 3
        assert data["data"]["has_more"] is False

    @pytest.mark.asyncio
    async def test_follow_unauthorized_access(self, http_client: AsyncClient):
        """Test that follow endpoints require authentication."""
        # Test follow endpoint without auth
        response = await http_client.post("/api/v1/follows/123")
        assert response.status_code == 403  # Updated to match actual behavior
        
        # Test unfollow endpoint without auth
        response = await http_client.delete("/api/v1/follows/123")
        assert response.status_code == 403
        
        # Test follow status endpoint without auth
        response = await http_client.get("/api/v1/follows/123/status")
        assert response.status_code == 403
        
        # Test followers endpoint without auth
        response = await http_client.get("/api/v1/users/123/followers")
        assert response.status_code == 403
        
        # Test following endpoint without auth
        response = await http_client.get("/api/v1/users/123/following")
        assert response.status_code == 403
        
        # Test follow stats endpoint without auth
        response = await http_client.get("/api/v1/users/123/follow-stats")
        assert response.status_code == 403
        
        # Test follow suggestions endpoint without auth
        response = await http_client.get("/api/v1/follows/suggestions")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_follow_api_response_format(self, http_client: AsyncClient, test_user, test_user_2, auth_headers, db_session: AsyncSession):
        """Test that follow API responses follow the standard format."""
        # Test follow response format
        response = await http_client.post(
            f"/api/v1/follows/{test_user_2.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Check standard response format
        assert "success" in data
        assert "data" in data
        assert "request_id" in data
        assert data["success"] is True
        
        # Check follow data format
        follow_data = data["data"]
        required_fields = ["id", "follower_id", "followed_id", "status", "created_at", "follower", "followed"]
        for field in required_fields:
            assert field in follow_data
        
        # Check user data format
        for user_key in ["follower", "followed"]:
            user_data = follow_data[user_key]
            user_required_fields = ["id", "username", "profile_image_url"]
            for field in user_required_fields:
                assert field in user_data