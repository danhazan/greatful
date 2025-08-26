"""
API Contract Integration Tests

These tests validate that API responses match our Pydantic models
and catch type drift between frontend and backend.
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.security import create_access_token


class TestPostsAPIContracts:
    """Test Posts API response contracts."""
    
    def test_create_post_response_structure(self, setup_test_database, test_user):
        """Test that POST /api/v1/posts/ returns valid PostResponse structure."""
        client = TestClient(app)
        
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        valid_post_data = {
            "content": "Grateful for this beautiful day!",
            "post_type": "spontaneous",
            "is_public": True
        }
        
        response = client.post(
            "/api/v1/posts/",
            json=valid_post_data,
            headers=headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Validate response structure matches PostResponse model
        assert "id" in data
        assert isinstance(data["id"], str)
        assert len(data["id"]) > 0
        
        assert "author_id" in data
        assert isinstance(data["author_id"], int)
        assert data["author_id"] > 0
        
        assert "content" in data
        assert isinstance(data["content"], str)
        assert data["content"] == valid_post_data["content"]
        
        assert "post_type" in data
        assert data["post_type"] in ["daily", "photo", "spontaneous"]
        
        assert "is_public" in data
        assert isinstance(data["is_public"], bool)
        
        assert "created_at" in data
        assert isinstance(data["created_at"], str)
        
        assert "author" in data
        assert isinstance(data["author"], dict)
        assert "id" in data["author"]
        assert "username" in data["author"]
        assert "email" in data["author"]
        
        assert "hearts_count" in data
        assert isinstance(data["hearts_count"], int)
        assert data["hearts_count"] >= 0
        
        assert "reactions_count" in data
        assert isinstance(data["reactions_count"], int)
        assert data["reactions_count"] >= 0
        
        # Optional fields should be present but can be null
        assert "title" in data
        assert "image_url" in data
        assert "location" in data
        assert "updated_at" in data
        assert "current_user_reaction" in data
        assert "is_hearted" in data

    def test_invalid_post_type_validation(self, setup_test_database, test_user):
        """Test that invalid post_type is rejected by Pydantic validation."""
        client = TestClient(app)
        
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        invalid_post_data = {
            "content": "Test content",
            "post_type": "invalid_type",  # Invalid enum value
            "is_public": True
        }
        
        response = client.post(
            "/api/v1/posts/",
            json=invalid_post_data,
            headers=headers
        )
        
        assert response.status_code == 400
        error_data = response.json()
        assert "detail" in error_data
        assert "Invalid post type" in error_data["detail"]

    def test_content_length_validation(self, setup_test_database, test_user):
        """Test that content length validation works for different post types."""
        client = TestClient(app)
        
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test daily post with content too long (>500 chars)
        long_content = "a" * 501
        invalid_daily_post = {
            "content": long_content,
            "post_type": "daily",
            "is_public": True
        }
        
        response = client.post(
            "/api/v1/posts/",
            json=invalid_daily_post,
            headers=headers
        )
        
        assert response.status_code == 422  # FastAPI returns 422 for validation errors
        error_data = response.json()
        assert "detail" in error_data


class TestReactionsAPIContracts:
    """Test Reactions API response contracts."""
    
    def test_add_reaction_response_structure(self, setup_test_database, test_user, test_post):
        """Test that POST /api/v1/posts/{id}/reactions returns valid ReactionResponse."""
        client = TestClient(app)
        
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        valid_reaction_data = {
            "emoji_code": "heart_eyes"
        }
        
        response = client.post(
            f"/api/v1/posts/{test_post.id}/reactions",
            json=valid_reaction_data,
            headers=headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Validate response structure matches ReactionResponse model
        assert "id" in data
        assert isinstance(data["id"], str)
        assert len(data["id"]) > 0
        
        assert "user_id" in data
        assert isinstance(data["user_id"], int)
        assert data["user_id"] > 0
        
        assert "post_id" in data
        assert isinstance(data["post_id"], str)
        assert data["post_id"] == test_post.id
        
        assert "emoji_code" in data
        assert data["emoji_code"] in [
            "heart_eyes", "hug", "pray", "muscle", 
            "star", "fire", "heart_face", "clap"
        ]
        
        assert "emoji_display" in data
        assert isinstance(data["emoji_display"], str)
        assert len(data["emoji_display"]) > 0
        
        assert "created_at" in data
        assert isinstance(data["created_at"], str)
        
        assert "user" in data
        assert isinstance(data["user"], dict)
        assert "id" in data["user"]
        assert "username" in data["user"]
        assert "email" in data["user"]

    def test_invalid_emoji_code_validation(self, setup_test_database, test_user, test_post):
        """Test that invalid emoji_code is rejected by Pydantic validation."""
        client = TestClient(app)
        
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        invalid_reaction_data = {
            "emoji_code": "invalid_emoji"  # Invalid enum value
        }
        
        response = client.post(
            f"/api/v1/posts/{test_post.id}/reactions",
            json=invalid_reaction_data,
            headers=headers
        )
        
        assert response.status_code == 422  # FastAPI returns 422 for validation errors
        error_data = response.json()
        assert "detail" in error_data


class TestAuthAPIContracts:
    """Test Auth API response contracts."""
    
    def test_session_response_structure(self, setup_test_database, test_user):
        """Test that GET /api/v1/auth/session returns valid SessionResponse."""
        client = TestClient(app)
        
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(
            "/api/v1/auth/session",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate SessionResponse structure
        assert "id" in data
        assert isinstance(data["id"], int)
        assert data["id"] > 0
        
        assert "email" in data
        assert isinstance(data["email"], str)
        assert "@" in data["email"]  # Basic email validation
        
        assert "username" in data
        assert isinstance(data["username"], str)
        assert len(data["username"]) >= 3

    def test_signup_response_structure(self, setup_test_database):
        """Test that POST /api/v1/auth/signup returns valid SignupResponse."""
        client = TestClient(app)
        
        signup_data = {
            "username": "newuser123",
            "email": "newuser@example.com",
            "password": "newpassword123"
        }
        
        response = client.post("/api/v1/auth/signup", json=signup_data)
        
        assert response.status_code == 201
        data = response.json()
        
        # Validate SignupResponse structure
        assert "id" in data
        assert isinstance(data["id"], int)
        assert data["id"] > 0
        
        assert "email" in data
        assert isinstance(data["email"], str)
        assert data["email"] == signup_data["email"]
        
        assert "username" in data
        assert isinstance(data["username"], str)
        assert data["username"] == signup_data["username"]
        
        assert "access_token" in data
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0
        
        assert "token_type" in data
        assert isinstance(data["token_type"], str)
        assert data["token_type"] == "bearer"


class TestErrorResponseContracts:
    """Test that error responses have consistent structure."""
    
    def test_validation_error_structure(self, setup_test_database):
        """Test that validation errors have consistent structure."""
        client = TestClient(app)
        
        invalid_post_data = {
            "content": "",  # Empty content should fail validation
            "post_type": "invalid",  # Invalid post type
            "is_public": "not_boolean"  # Invalid boolean
        }
        
        response = client.post(
            "/api/v1/posts/",
            json=invalid_post_data,
            headers={"Authorization": "Bearer invalid-token"}
        )
        
        # Should return error (either 400 for validation or 401 for auth)
        assert response.status_code in [400, 401, 422]
        data = response.json()
        
        # Should have error information
        assert "detail" in data
        assert isinstance(data["detail"], str)

    def test_unauthorized_error_structure(self, setup_test_database):
        """Test that unauthorized errors have consistent structure."""
        client = TestClient(app)
        
        response = client.get("/api/v1/posts/feed")  # No auth header
        
        assert response.status_code == 403  # FastAPI returns 403 for forbidden access
        data = response.json()
        
        # Should have error information
        assert "detail" in data
        assert isinstance(data["detail"], str)