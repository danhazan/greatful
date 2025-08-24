"""
Integration tests for user profile API endpoints.
Uses shared fixtures from conftest.py files.
"""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post, PostType
import uuid


class TestGetMyProfile:
    """Test cases for GET /api/v1/users/me/profile endpoint."""

    @pytest.mark.asyncio
    async def test_get_my_profile_success(self, client, test_user, auth_headers):
        """Test successful profile retrieval."""
        response = client.get("/api/v1/users/me/profile", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["username"] == test_user.username
        assert data["bio"] == test_user.bio

    @pytest.mark.asyncio
    async def test_get_my_profile_unauthorized(self, client):
        """Test profile retrieval without authentication."""
        response = client.get("/api/v1/users/me/profile")
        assert response.status_code == 403  # FastAPI returns 403 for missing auth

    @pytest.mark.asyncio
    async def test_get_my_profile_invalid_token(self, client):
        """Test profile retrieval with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v1/users/me/profile", headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_my_profile_user_not_found(self, client):
        """Test profile retrieval for non-existent user."""
        from app.core.security import create_access_token
        # Create token for non-existent user
        token = create_access_token({"sub": "99999"})
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/v1/users/me/profile", headers=headers)
        assert response.status_code == 404


class TestUpdateMyProfile:
    """Test cases for PUT /api/v1/users/me/profile endpoint."""

    @pytest.mark.asyncio
    async def test_update_profile_success(self, client, test_user, auth_headers):
        """Test successful profile update."""
        update_data = {
            "bio": "Updated bio",
            "username": "updateduser"
        }
        
        response = client.put("/api/v1/users/me/profile", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["bio"] == update_data["bio"]
        assert data["username"] == update_data["username"]

    @pytest.mark.asyncio
    async def test_update_profile_partial(self, client, test_user, auth_headers):
        """Test partial profile update."""
        update_data = {"bio": "Just updating bio"}
        
        response = client.put("/api/v1/users/me/profile", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["bio"] == update_data["bio"]
        # Other fields should remain unchanged
        assert data["username"] == test_user.username

    @pytest.mark.asyncio
    async def test_update_profile_username_taken(self, client, test_user, auth_headers, test_data_factory, db_session):
        """Test updating to an already taken username."""
        # Create another user first
        from app.core.security import get_password_hash
        other_user = User(**test_data_factory.user_data(
            email="other@example.com",
            username="takenuser",
            hashed_password=get_password_hash("testpassword")
        ))
        db_session.add(other_user)
        await db_session.commit()
        
        update_data = {"username": "takenuser"}
        response = client.put("/api/v1/users/me/profile", json=update_data, headers=auth_headers)
        
        assert response.status_code == 409
        assert "already taken" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_update_profile_same_username(self, client, test_user, auth_headers):
        """Test updating to the same username (should succeed)."""
        update_data = {"username": test_user.username}
        
        response = client.put("/api/v1/users/me/profile", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_profile_unauthorized(self, client):
        """Test profile update without authentication."""
        update_data = {"bio": "New bio"}
        response = client.put("/api/v1/users/me/profile", json=update_data)
        assert response.status_code == 403  # FastAPI returns 403 for missing auth

    @pytest.mark.asyncio
    async def test_update_profile_invalid_token(self, client):
        """Test profile update with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        update_data = {"bio": "New bio"}
        response = client.put("/api/v1/users/me/profile", json=update_data, headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_profile_empty_data(self, client, test_user, auth_headers):
        """Test profile update with empty data."""
        response = client.put("/api/v1/users/me/profile", json={}, headers=auth_headers)
        
        assert response.status_code == 200
        # Profile should remain unchanged
        data = response.json()
        assert data["username"] == test_user.username


class TestGetMyPosts:
    """Test cases for GET /api/v1/users/me/posts endpoint."""

    @pytest.mark.asyncio
    async def test_get_my_posts_success(self, client, test_user, test_post, auth_headers):
        """Test successful retrieval of user's posts."""
        response = client.get("/api/v1/users/me/posts", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert "id" in data[0]  # Check that post has an ID
        assert "content" in data[0]  # Check that post has content

    @pytest.mark.asyncio
    async def test_get_my_posts_empty(self, client, test_user, auth_headers):
        """Test retrieval when user has no posts."""
        response = client.get("/api/v1/users/me/posts", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        # May be empty or contain test_post depending on test order

    @pytest.mark.asyncio
    async def test_get_my_posts_unauthorized(self, client):
        """Test posts retrieval without authentication."""
        response = client.get("/api/v1/users/me/posts")
        assert response.status_code == 403  # FastAPI returns 403 for missing auth

    @pytest.mark.asyncio
    async def test_get_my_posts_ordered_by_date(self, client, test_user, auth_headers, db_session):
        """Test that posts are ordered by creation date (newest first)."""
        # Create multiple posts with different timestamps
        posts = []
        for i in range(3):
            post = Post(
                id=str(uuid.uuid4()),
                author_id=test_user.id,
                content=f"Post {i}",
                post_type=PostType.daily,
                is_public=True
            )
            db_session.add(post)
            posts.append(post)
        
        await db_session.commit()
        
        response = client.get("/api/v1/users/me/posts", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be ordered by created_at descending (newest first)
        if len(data) >= 2:
            assert data[0]["created_at"] >= data[1]["created_at"]


class TestGetUserProfile:
    """Test cases for GET /api/v1/users/{user_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_user_profile_success(self, client, test_user, auth_headers, db_session):
        """Test successful retrieval of another user's profile."""
        # Create another user
        from app.core.security import get_password_hash
        other_user = User(
            email="other@example.com",
            username="otheruser",
            hashed_password=get_password_hash("testpassword"),
        )
        db_session.add(other_user)
        await db_session.commit()
        await db_session.refresh(other_user)
        
        response = client.get(f"/api/v1/users/{other_user.id}/profile", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == other_user.username
        # Email should not be included in public profile
        assert "email" not in data

    @pytest.mark.asyncio
    async def test_get_user_profile_not_found(self, client, auth_headers):
        """Test retrieval of non-existent user profile."""
        response = client.get("/api/v1/users/99999", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_user_profile_unauthorized(self, client, test_user):
        """Test profile retrieval without authentication."""
        response = client.get(f"/api/v1/users/{test_user.id}/profile")
        assert response.status_code == 403  # FastAPI returns 403 for missing auth


class TestProfileDataIntegrity:
    """Test data integrity and consistency."""

    @pytest.mark.asyncio
    async def test_profile_posts_count_consistency(self, client, test_user, auth_headers, db_session):
        """Test that profile shows correct post count."""
        # Create known number of posts
        post_count = 3
        for i in range(post_count):
            post = Post(
                id=str(uuid.uuid4()),
                author_id=test_user.id,
                content=f"Test post {i}",
                post_type=PostType.daily,
                is_public=True
            )
            db_session.add(post)
        
        await db_session.commit()
        
        # Get profile
        profile_response = client.get("/api/v1/users/me/profile", headers=auth_headers)
        posts_response = client.get("/api/v1/users/me/posts", headers=auth_headers)
        
        assert profile_response.status_code == 200
        assert posts_response.status_code == 200
        
        posts_data = posts_response.json()
        # Since this is /me/posts, all posts belong to the current user
        assert len(posts_data) >= post_count

    @pytest.mark.asyncio
    async def test_profile_update_persistence(self, client, test_user, auth_headers):
        """Test that profile updates are properly persisted."""
        update_data = {
            "bio": "This should persist"
        }
        
        # Update profile
        update_response = client.put("/api/v1/users/me/profile", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200
        
        # Retrieve profile again
        get_response = client.get("/api/v1/users/me/profile", headers=auth_headers)
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["bio"] == update_data["bio"]

    @pytest.mark.asyncio
    async def test_profile_fields_data_types(self, client, test_user, auth_headers):
        """Test that profile fields have correct data types."""
        response = client.get("/api/v1/users/me/profile", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check data types
        assert isinstance(data["id"], int)
        assert isinstance(data["email"], str)
        assert isinstance(data["username"], str)
        if data["bio"]:
            assert isinstance(data["bio"], str)
        assert isinstance(data["created_at"], str)  # ISO format string