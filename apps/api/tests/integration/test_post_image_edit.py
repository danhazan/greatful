"""
Integration tests for post image editing functionality.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post


@pytest.mark.asyncio
class TestPostImageEdit:
    """Test post image editing functionality."""
    
    async def test_edit_post_add_image(self, async_client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession):
        """Test adding an image to an existing post."""
        # Create a post without an image
        post = Post(
            id="test-post-id",
            author_id=test_user.id,
            content="Original content without image",
            image_url=None
        )
        db_session.add(post)
        await db_session.commit()
        
        # Update post to add an image
        update_data = {
            "image_url": "https://example.com/new-image.jpg"
        }
        
        response = await async_client.put(f"/api/v1/posts/{post.id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["image_url"] == "https://example.com/new-image.jpg"
        assert data["content"] == "Original content without image"  # Content unchanged
    
    async def test_edit_post_update_image(self, async_client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession):
        """Test updating an existing image in a post."""
        # Create a post with an image
        post = Post(
            id="test-post-id-2",
            author_id=test_user.id,
            content="Content with image",
            image_url="https://example.com/old-image.jpg"
        )
        db_session.add(post)
        await db_session.commit()
        
        # Update post to change the image
        update_data = {
            "image_url": "https://example.com/new-image.jpg"
        }
        
        response = await async_client.put(f"/api/v1/posts/{post.id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["image_url"] == "https://example.com/new-image.jpg"
        assert data["content"] == "Content with image"  # Content unchanged
    
    async def test_edit_post_remove_image(self, async_client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession):
        """Test removing an image from a post."""
        # Create a post with an image
        post = Post(
            id="test-post-id-3",
            author_id=test_user.id,
            content="Content with image to be removed",
            image_url="https://example.com/image-to-remove.jpg"
        )
        db_session.add(post)
        await db_session.commit()
        
        # Update post to remove the image
        update_data = {
            "image_url": None
        }
        
        response = await async_client.put(f"/api/v1/posts/{post.id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["image_url"] is None
        assert data["content"] == "Content with image to be removed"  # Content unchanged
    
    async def test_edit_post_image_affects_post_type(self, async_client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession):
        """Test that adding/removing images affects post type analysis."""
        # Create a text-only post
        post = Post(
            id="test-post-id-4",
            author_id=test_user.id,
            content="Short text",  # Would be spontaneous without image
            image_url=None,
            post_type="spontaneous"
        )
        db_session.add(post)
        await db_session.commit()
        
        # Add an image - should change to photo type
        update_data = {
            "image_url": "https://example.com/new-image.jpg"
        }
        
        response = await async_client.put(f"/api/v1/posts/{post.id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["image_url"] == "https://example.com/new-image.jpg"
        # Post type should be re-analyzed based on content + image
        # Short text + image typically becomes "photo" type
        assert data["post_type"] in ["photo", "daily"]  # Could be either depending on analysis
    
    async def test_edit_post_content_and_image_together(self, async_client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession):
        """Test updating both content and image in the same request."""
        # Create a post
        post = Post(
            id="test-post-id-5",
            author_id=test_user.id,
            content="Original content",
            image_url="https://example.com/old-image.jpg"
        )
        db_session.add(post)
        await db_session.commit()
        
        # Update both content and image
        update_data = {
            "content": "Updated content with new image",
            "image_url": "https://example.com/new-image.jpg"
        }
        
        response = await async_client.put(f"/api/v1/posts/{post.id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["content"] == "Updated content with new image"
        assert data["image_url"] == "https://example.com/new-image.jpg"
        # Post type should be re-analyzed based on new content + new image
        assert data["post_type"] in ["daily", "photo", "spontaneous"]