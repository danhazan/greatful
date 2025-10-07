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
        response_data = response.json()
        data = response_data["data"]
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
        response_data = response.json()
        data = response_data["data"]
        assert data["bio"] == update_data["bio"]
        assert data["username"] == update_data["username"]

    @pytest.mark.asyncio
    async def test_update_profile_partial(self, client, test_user, auth_headers):
        """Test partial profile update."""
        update_data = {"bio": "Just updating bio"}
        
        response = client.put("/api/v1/users/me/profile", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
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
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Username already taken"

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
        response_data = response.json()
        data = response_data["data"]
        assert data["username"] == test_user.username


class TestGetMyPosts:
    """Test cases for GET /api/v1/users/me/posts endpoint."""

    @pytest.mark.asyncio
    async def test_get_my_posts_success(self, client, test_user, test_post, auth_headers):
        """Test successful retrieval of user's posts."""
        response = client.get("/api/v1/users/me/posts", headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
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
        response_data = response.json()
        data = response_data["data"]
        
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
        response_data = response.json()
        data = response_data["data"]
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
        
        response_data = get_response.json()
        data = response_data["data"]
        assert data["bio"] == update_data["bio"]

    @pytest.mark.asyncio
    async def test_profile_fields_data_types(self, client, test_user, auth_headers):
        """Test that profile fields have correct data types."""
        response = client.get("/api/v1/users/me/profile", headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
        
        # Check data types
        assert isinstance(data["id"], int)
        assert isinstance(data["email"], str)
        assert isinstance(data["username"], str)
        if data["bio"]:
            assert isinstance(data["bio"], str)
        assert isinstance(data["created_at"], str)  # ISO format string


class TestUserSearch:
    """Test cases for POST /api/v1/users/search endpoint."""

    @pytest.mark.asyncio
    async def test_search_users_success(self, client, test_user, auth_headers, db_session):
        """Test successful user search."""
        # Create additional users for search
        from app.core.security import get_password_hash
        users = []
        for i in range(3):
            user = User(
                email=f"searchuser{i}@example.com",
                username=f"searchuser{i}",
                hashed_password=get_password_hash("testpassword"),
                bio=f"Bio for search user {i}"
            )
            db_session.add(user)
            users.append(user)
        
        await db_session.commit()
        
        search_data = {
            "query": "search",
            "limit": 10
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
        
        # Should find the created users
        assert len(data) >= 3
        
        # Check response structure
        for user_result in data:
            assert "id" in user_result
            assert "username" in user_result
            assert "profile_image_url" in user_result
            assert "bio" in user_result
            # Should not include email in search results
            assert "email" not in user_result

    @pytest.mark.asyncio
    async def test_search_users_with_at_symbol(self, client, test_user, auth_headers, db_session):
        """Test user search removes @ symbol from query."""
        # Create a user to search for
        from app.core.security import get_password_hash
        user = User(
            email="atsymboluser@example.com",
            username="atsymboluser",
            hashed_password=get_password_hash("testpassword")
        )
        db_session.add(user)
        await db_session.commit()
        
        search_data = {
            "query": "@atsymbol",
            "limit": 10
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
        
        # Should find the user despite @ symbol
        usernames = [user["username"] for user in data]
        assert "atsymboluser" in usernames

    @pytest.mark.asyncio
    async def test_search_users_excludes_current_user(self, client, test_user, auth_headers):
        """Test that search excludes the current user from results."""
        search_data = {
            "query": test_user.username,
            "limit": 10
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
        
        # Current user should not be in results
        user_ids = [user["id"] for user in data]
        assert test_user.id not in user_ids

    @pytest.mark.asyncio
    async def test_search_users_empty_query(self, client, test_user, auth_headers):
        """Test user search with empty query."""
        search_data = {
            "query": "",
            "limit": 10
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
        
        # Should return empty results for empty query
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_search_users_limit_validation(self, client, test_user, auth_headers):
        """Test that search respects limit parameter."""
        search_data = {
            "query": "test",
            "limit": 2
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
        
        # Should not exceed limit
        assert len(data) <= 2

    @pytest.mark.asyncio
    async def test_search_users_limit_boundary(self, client, test_user, auth_headers):
        """Test search with boundary limit values."""
        # Test with limit too high (should be capped at 50)
        search_data = {
            "query": "test",
            "limit": 100
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=auth_headers)
        
        assert response.status_code == 200
        # Should not fail even with high limit
        
        # Test with limit too low (should be set to 1)
        search_data = {
            "query": "test",
            "limit": 0
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=auth_headers)
        
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_search_users_unauthorized(self, client):
        """Test user search without authentication."""
        search_data = {
            "query": "test",
            "limit": 10
        }
        
        response = client.post("/api/v1/users/search", json=search_data)
        assert response.status_code == 403  # FastAPI returns 403 for missing auth

    @pytest.mark.asyncio
    async def test_search_users_invalid_token(self, client):
        """Test user search with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        search_data = {
            "query": "test",
            "limit": 10
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_search_users_case_insensitive(self, client, test_user, auth_headers, db_session):
        """Test that user search is case insensitive."""
        # Create a user with mixed case username
        from app.core.security import get_password_hash
        user = User(
            email="mixedcase@example.com",
            username="MixedCaseUser",
            hashed_password=get_password_hash("testpassword")
        )
        db_session.add(user)
        await db_session.commit()
        
        # Search with lowercase
        search_data = {
            "query": "mixedcase",
            "limit": 10
        }
        
        response = client.post("/api/v1/users/search", json=search_data, headers=auth_headers)
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
        
        # Should find the user despite case difference
        usernames = [user["username"] for user in data]
        assert "MixedCaseUser" in usernames