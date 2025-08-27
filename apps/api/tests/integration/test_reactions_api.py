"""
Integration tests for emoji reactions API endpoints.
Uses shared fixtures from conftest.py files.
"""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.post import Post, PostType
import uuid


class TestReactionsAPI:
    """Test reactions API endpoints."""

    @pytest.mark.asyncio
    async def test_add_reaction_success(self, client, test_user_and_post):
        """Test successful reaction addition."""
        user_data = test_user_and_post
        
        response = client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 201
        response_data = response.json()
        data = response_data["data"]
        assert data["emoji_code"] == "heart_eyes"

    @pytest.mark.asyncio
    async def test_add_reaction_invalid_emoji(self, client, test_user_and_post):
        """Test reaction addition with invalid emoji."""
        user_data = test_user_and_post
        
        response = client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "invalid_emoji"},
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 422  # FastAPI returns 422 for validation errors

    @pytest.mark.asyncio
    async def test_add_reaction_unauthorized(self, client, test_user_and_post):
        """Test reaction addition without authentication."""
        user_data = test_user_and_post
        
        response = client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"}
        )
        
        assert response.status_code == 403  # FastAPI returns 403 for missing auth

    @pytest.mark.asyncio
    async def test_update_existing_reaction(self, client, test_user_and_post):
        """Test updating an existing reaction."""
        user_data = test_user_and_post
        
        # First add a reaction
        client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        # Then update it
        response = client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "fire"},
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 201  # API returns 201 for updates
        response_data = response.json()
        data = response_data["data"]
        assert data["emoji_code"] == "fire"

    @pytest.mark.asyncio
    async def test_remove_reaction_success(self, client, test_user_and_post):
        """Test successful reaction removal."""
        user_data = test_user_and_post
        
        # First add a reaction
        client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        # Then remove it
        response = client.delete(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 204  # API returns 204 for successful deletion

    @pytest.mark.asyncio
    async def test_remove_nonexistent_reaction(self, client, test_user_and_post):
        """Test removing a reaction that doesn't exist."""
        user_data = test_user_and_post
        
        response = client.delete(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_post_reactions(self, client, test_user_and_post):
        """Test getting reactions for a post."""
        user_data = test_user_and_post
        
        # Add a reaction first
        client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        response = client.get(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_get_reaction_summary(self, client, test_user_and_post):
        """Test getting reaction summary for a post."""
        user_data = test_user_and_post
        
        # Add a reaction first
        client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        response = client.get(
            f"/api/v1/posts/{user_data['post'].id}/reactions/summary",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        data = response_data["data"]
        assert "total_count" in data
        assert "emoji_counts" in data  # API returns emoji_counts instead of reactions

    @pytest.mark.asyncio
    async def test_get_reactions_nonexistent_post(self, client, auth_headers):
        """Test getting reactions for a non-existent post."""
        response = client.get(
            "/api/v1/posts/nonexistent-id/reactions",
            headers=auth_headers
        )
        
        assert response.status_code == 200  # API returns empty list for nonexistent posts
        response_data = response.json()
        data = response_data["data"]
        assert len(data) == 0  # Should return empty list

    @pytest.mark.asyncio
    async def test_invalid_token(self, client, test_user_and_post):
        """Test API calls with invalid token."""
        user_data = test_user_and_post
        
        response = client.post(
            f"/api/v1/posts/{user_data['post'].id}/reactions",
            json={"emoji_code": "heart_eyes"},
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401