"""
Integration tests for rich content support in posts API.
"""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.post import Post, PostType
from app.models.user import User


class TestRichContentAPI:
    """Test rich content support in posts API endpoints."""

    @pytest.mark.asyncio
    async def test_get_single_post_with_rich_content(self, client, test_user_and_post):
        """Test that single post endpoint returns rich content fields."""
        user_data = test_user_and_post
        
        # Get the post (should have rich_content and post_style fields in response)
        response = client.get(
            f"/api/v1/posts/{user_data['post'].id}",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 200
        post_data = response.json()
        
        # Verify rich content fields are present in response (even if null)
        assert "rich_content" in post_data
        assert "post_style" in post_data

    @pytest.mark.asyncio
    async def test_get_single_post_without_rich_content(self, client, test_user_and_post):
        """Test that posts without rich content return null for rich content fields."""
        user_data = test_user_and_post
        
        # Get the post (should not have rich content by default)
        response = client.get(
            f"/api/v1/posts/{user_data['post'].id}",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 200
        post_data = response.json()
        
        # Verify rich content fields are null
        assert post_data["rich_content"] is None
        assert post_data["post_style"] is None

    @pytest.mark.asyncio
    async def test_create_post_with_rich_content(self, client, test_user_and_post):
        """Test creating a post with rich content."""
        user_data = test_user_and_post
        
        post_style = {
            "id": "new-style",
            "name": "New Style",
            "backgroundColor": "#fff0f0",
            "textColor": "#800000"
        }
        
        # Create post with rich content
        response = client.post(
            "/api/v1/posts/",
            headers={"Authorization": f"Bearer {user_data['token']}"},
            json={
                "content": "Plain content for creation",
                "rich_content": "Rich content with **formatting**",
                "post_style": post_style,
                "is_public": True
            }
        )
        
        assert response.status_code == 201
        post_data = response.json()
        
        # Verify rich content was saved
        assert post_data["content"] == "Plain content for creation"
        assert post_data["rich_content"] == "Rich content with **formatting**"
        assert post_data["post_style"] is not None
        assert post_data["post_style"]["id"] == "new-style"
        assert post_data["post_style"]["backgroundColor"] == "#fff0f0"

    @pytest.mark.asyncio
    async def test_public_post_access_includes_rich_content(self, client, test_user_and_post):
        """Test that public posts can be accessed without auth and include rich content fields."""
        user_data = test_user_and_post
        
        # Access post without authentication
        response = client.get(f"/api/v1/posts/{user_data['post'].id}")
        
        assert response.status_code == 200
        post_data = response.json()
        
        # Verify rich content fields are present in response (even if null)
        assert "rich_content" in post_data
        assert "post_style" in post_data

    @pytest.mark.asyncio
    async def test_profile_posts_include_rich_content(self, client, test_user_and_post):
        """Test that profile posts endpoint includes rich content fields."""
        user_data = test_user_and_post
        
        # Get user's posts from profile endpoint
        response = client.get(
            f"/api/v1/users/{user_data['user'].id}/posts",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "data" in response_data
        posts = response_data["data"]
        assert len(posts) >= 1
        
        # Verify rich content fields are present in profile posts
        for post in posts:
            assert "rich_content" in post
            assert "post_style" in post

    @pytest.mark.asyncio
    async def test_my_posts_include_rich_content(self, client, test_user_and_post):
        """Test that my posts endpoint includes rich content fields."""
        user_data = test_user_and_post
        
        # Get current user's posts
        response = client.get(
            "/api/v1/users/me/posts",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "data" in response_data
        posts = response_data["data"]
        assert len(posts) >= 1
        
        # Verify rich content fields are present in my posts
        for post in posts:
            assert "rich_content" in post
            assert "post_style" in post