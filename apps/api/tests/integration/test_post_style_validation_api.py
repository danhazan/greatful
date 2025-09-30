"""
Integration tests for post style validation in API endpoints.
"""

import pytest
import json
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post


@pytest.mark.asyncio
class TestPostStyleValidationAPI:
    """Test post style validation in API endpoints."""
    
    async def test_create_post_valid_style(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with valid style."""
        valid_style = {
            "id": "default",
            "name": "Default Style",
            "backgroundColor": "#FFFFFF"
        }
        
        post_data = {
            "content": "Test post with valid style",
            "post_style": valid_style
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 201
        
        data = response.json()
        assert data["post_style"]["id"] == "default"
        assert data["post_style"]["name"] == "Default Style"
        assert data["post_style"]["backgroundColor"] == "#FFFFFF"
    
    async def test_create_post_style_removes_font_properties(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test that font properties are removed from post style during creation."""
        style_with_fonts = {
            "id": "default",
            "name": "Test Style",
            "backgroundColor": "#FFFFFF",
            "textColor": "#000000",  # Should be removed
            "fontSize": "16px",      # Should be removed
            "fontFamily": "Arial",   # Should be removed
            "backgroundOpacity": 0.8  # Should be kept
        }
        
        post_data = {
            "content": "Test post with font properties",
            "post_style": style_with_fonts
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 201
        
        data = response.json()
        post_style = data["post_style"]
        
        # Should keep required and allowed properties
        assert post_style["id"] == "default"
        assert post_style["name"] == "Test Style"
        assert post_style["backgroundColor"] == "#FFFFFF"
        assert post_style["backgroundOpacity"] == 0.8
        
        # Should remove font properties
        assert "textColor" not in post_style
        assert "fontSize" not in post_style
        assert "fontFamily" not in post_style
    
    async def test_create_post_invalid_style_id(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with invalid style ID."""
        invalid_style = {
            "id": "invalid-style-id",
            "name": "Invalid Style",
            "backgroundColor": "#FFFFFF"
        }
        
        post_data = {
            "content": "Test post with invalid style",
            "post_style": invalid_style
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 422
        
        data = response.json()
        assert "Invalid style ID" in str(data["detail"])
    
    async def test_create_post_invalid_background_color(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with invalid background color."""
        invalid_style = {
            "id": "default",
            "name": "Test Style",
            "backgroundColor": "invalid-color"
        }
        
        post_data = {
            "content": "Test post with invalid color",
            "post_style": invalid_style
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 422
        
        data = response.json()
        assert "Invalid background color" in str(data["detail"])
    
    async def test_create_post_missing_required_fields(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with missing required style fields."""
        incomplete_style = {
            "id": "default",
            # Missing name and backgroundColor
        }
        
        post_data = {
            "content": "Test post with incomplete style",
            "post_style": incomplete_style
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 422
        
        data = response.json()
        assert "missing required field" in str(data["detail"]).lower()
    
    async def test_create_post_gradient_background(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with gradient background."""
        gradient_style = {
            "id": "gradient",
            "name": "Gradient Style",
            "backgroundColor": {
                "type": "linear",
                "colors": ["#FF0000", "#00FF00"]
            }
        }
        
        post_data = {
            "content": "Test post with gradient",
            "post_style": gradient_style
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 201
        
        data = response.json()
        bg_color = data["post_style"]["backgroundColor"]
        assert bg_color["type"] == "linear"
        assert bg_color["colors"] == ["#FF0000", "#00FF00"]
    
    async def test_create_post_invalid_gradient(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with invalid gradient."""
        invalid_gradient_style = {
            "id": "gradient",
            "name": "Invalid Gradient Style",
            "backgroundColor": {
                "type": "invalid",
                "colors": ["#FF0000"]  # Too few colors
            }
        }
        
        post_data = {
            "content": "Test post with invalid gradient",
            "post_style": invalid_gradient_style
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 422
        
        data = response.json()
        assert "Invalid background" in str(data["detail"])
    
    async def test_update_post_valid_style(self, async_client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession):
        """Test updating a post with valid style."""
        # Create a post first
        post = Post(
            id="test-post-id",
            author_id=test_user.id,
            content="Original content",
            post_style={"id": "default", "name": "Default", "backgroundColor": "#FFFFFF"}
        )
        db_session.add(post)
        await db_session.commit()
        
        # Update with new style
        new_style = {
            "id": "warm",
            "name": "Warm Style",
            "backgroundColor": "#FF5733"
        }
        
        update_data = {
            "post_style": new_style
        }
        
        response = await async_client.put(f"/api/v1/posts/{post.id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["post_style"]["id"] == "warm"
        assert data["post_style"]["backgroundColor"] == "#FF5733"
    
    async def test_update_post_removes_font_properties(self, async_client: AsyncClient, test_user: User, auth_headers: dict, db_session: AsyncSession):
        """Test that font properties are removed during post update."""
        # Create a post first
        post = Post(
            id="test-post-id-2",
            author_id=test_user.id,
            content="Original content",
            post_style={"id": "default", "name": "Default", "backgroundColor": "#FFFFFF"}
        )
        db_session.add(post)
        await db_session.commit()
        
        # Update with style containing font properties
        style_with_fonts = {
            "id": "default",
            "name": "Updated Style",
            "backgroundColor": "#00FF00",
            "textColor": "#000000",  # Should be removed
            "fontWeight": "bold",    # Should be removed
            "backgroundOpacity": 0.9  # Should be kept
        }
        
        update_data = {
            "post_style": style_with_fonts
        }
        
        response = await async_client.put(f"/api/v1/posts/{post.id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        post_style = data["post_style"]
        
        # Should keep allowed properties
        assert post_style["backgroundColor"] == "#00FF00"
        assert post_style["backgroundOpacity"] == 0.9
        
        # Should remove font properties
        assert "textColor" not in post_style
        assert "fontWeight" not in post_style
    
    async def test_create_post_with_form_data_valid_style(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with form data and valid style."""
        valid_style = {
            "id": "default",
            "name": "Default Style",
            "backgroundColor": "#FFFFFF"
        }
        
        form_data = {
            "content": "Test post with form data",
            "post_style": json.dumps(valid_style)
        }
        
        response = await async_client.post("/api/v1/posts/upload", data=form_data, headers=auth_headers)
        assert response.status_code == 201
        
        data = response.json()
        assert data["post_style"]["id"] == "default"
        assert data["post_style"]["backgroundColor"] == "#FFFFFF"
    
    async def test_create_post_with_form_data_invalid_style_json(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with invalid JSON in form data."""
        form_data = {
            "content": "Test post with invalid JSON",
            "post_style": "invalid-json"
        }
        
        response = await async_client.post("/api/v1/posts/upload", data=form_data, headers=auth_headers)
        assert response.status_code == 422
        
        data = response.json()
        assert "Invalid post_style JSON format" in str(data["detail"])
    
    async def test_create_post_with_form_data_removes_font_properties(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test that font properties are removed from form data post style."""
        style_with_fonts = {
            "id": "default",
            "name": "Test Style",
            "backgroundColor": "#FFFFFF",
            "textColor": "#000000",  # Should be removed
            "fontSize": "18px",      # Should be removed
        }
        
        form_data = {
            "content": "Test post with font properties in form data",
            "post_style": json.dumps(style_with_fonts)
        }
        
        response = await async_client.post("/api/v1/posts/upload", data=form_data, headers=auth_headers)
        assert response.status_code == 201
        
        data = response.json()
        post_style = data["post_style"]
        
        # Should keep required properties
        assert post_style["id"] == "default"
        assert post_style["backgroundColor"] == "#FFFFFF"
        
        # Should remove font properties
        assert "textColor" not in post_style
        assert "fontSize" not in post_style
    
    async def test_create_post_no_style(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post without style (should work)."""
        post_data = {
            "content": "Test post without style"
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 201
        
        data = response.json()
        assert data["post_style"] is None
    
    async def test_create_post_custom_style_id(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with custom style ID."""
        custom_style = {
            "id": "custom-12345678-1234-1234-1234-123456789abc",
            "name": "My Custom Style",
            "backgroundColor": "#FF5733"
        }
        
        post_data = {
            "content": "Test post with custom style",
            "post_style": custom_style
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 201
        
        data = response.json()
        assert data["post_style"]["id"] == custom_style["id"]
    
    async def test_create_post_user_style_id(self, async_client: AsyncClient, test_user: User, auth_headers: dict):
        """Test creating a post with user-specific style ID."""
        user_style = {
            "id": f"user-{test_user.id}-my-style",
            "name": "My Personal Style",
            "backgroundColor": "#9B59B6"
        }
        
        post_data = {
            "content": "Test post with user style",
            "post_style": user_style
        }
        
        response = await async_client.post("/api/v1/posts", json=post_data, headers=auth_headers)
        assert response.status_code == 201
        
        data = response.json()
        assert data["post_style"]["id"] == user_style["id"]