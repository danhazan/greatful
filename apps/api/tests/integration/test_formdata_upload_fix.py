"""
Integration tests for FormData upload bug fix.

This test suite verifies that the 422 Unprocessable Entity bug
has been fixed for file upload endpoints.
"""

import pytest
from httpx import AsyncClient
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import create_access_token
from unittest.mock import patch
import io
from PIL import Image


def create_test_image() -> bytes:
    """Create a valid test image that PIL can process."""
    # Create a simple 10x10 red image
    img = Image.new('RGB', (10, 10), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    return img_bytes.getvalue()


class TestFormDataUploadFix:
    """Test FormData upload functionality after bug fix."""

    @pytest.mark.asyncio
    async def test_profile_photo_upload_with_proper_formdata(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        test_user: User
    ):
        """
        Test that profile photo upload works with proper FormData.
        
        This test verifies the fix for the 422 Unprocessable Entity bug
        where Content-Type: application/json was overriding multipart boundaries.
        """
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        
        # Create proper multipart FormData with valid image
        test_image_data = create_test_image()
        files = {"file": ("test.png", test_image_data, "image/png")}
        
        # Make request with proper multipart Content-Type
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers={"Authorization": f"Bearer {token}"},
            files=files  # httpx automatically sets multipart Content-Type
        )
        
        # Should succeed (not 422!)
        assert response.status_code == 200
        
        # Verify response structure
        data = response.json()
        assert data["success"] is True
        assert "data" in data

    @pytest.mark.asyncio
    async def test_profile_photo_upload_rejects_wrong_content_type(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        test_user: User
    ):
        """
        Test that manually setting wrong Content-Type causes issues.
        
        This demonstrates the original bug condition.
        """
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        
        # Create FormData but send with wrong Content-Type
        test_image_data = b"fake image data for testing"
        
        # Simulate the bug: send multipart data with application/json Content-Type
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"  # ← This causes the bug!
            },
            content=test_image_data  # Raw data, not multipart
        )
        
        # Should fail with 422 (validation error) because FastAPI can't parse the file
        assert response.status_code == 422
        
        # Verify error details
        data = response.json()
        assert "detail" in data
        # Should indicate missing file field
        assert any("file" in str(error).lower() for error in data["detail"])

    @pytest.mark.asyncio
    async def test_profile_photo_upload_without_file(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        test_user: User
    ):
        """Test that missing file parameter is handled correctly."""
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        
        # Send request without file
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers={"Authorization": f"Bearer {token}"},
            json={}  # No file data
        )
        
        # Should fail with 422 (missing required field)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_profile_photo_upload_without_auth(
        self, 
        async_client: AsyncClient
    ):
        """Test that authentication is required."""
        # Create proper multipart FormData
        test_image_data = b"fake image data for testing"
        files = {"file": ("test.png", test_image_data, "image/png")}
        
        # Make request without auth
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            files=files
        )
        
        # Should fail with 403 (not 422!)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_profile_photo_upload_with_invalid_auth(
        self, 
        async_client: AsyncClient
    ):
        """
        Test that invalid auth returns 401, not 422.
        
        This is the key test that verifies the FormData fix:
        - Before fix: 422 (FormData not parsed due to wrong Content-Type)
        - After fix: 401 (FormData parsed correctly, auth fails as expected)
        """
        # Create proper multipart FormData
        test_image_data = b"fake image data for testing"
        files = {"file": ("test.png", test_image_data, "image/png")}
        
        # Make request with invalid auth token
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers={"Authorization": "Bearer invalid-token"},
            files=files
        )
        
        # Should fail with 401 (auth error), NOT 422 (validation error)
        # This proves FormData is being parsed correctly
        assert response.status_code == 401
        
        # Verify it's an auth error, not validation error
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_multipart_boundary_preservation(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        test_user: User
    ):
        """
        Test that multipart boundaries are preserved correctly.
        
        This test ensures that the Content-Type header includes
        the proper boundary parameter for multipart parsing.
        """
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        
        # Create multipart data with specific boundary
        boundary = "----test-boundary-12345"
        content_type = f"multipart/form-data; boundary={boundary}"
        
        # Create valid image data
        test_image_data = create_test_image()
        
        # Manually construct multipart data with valid image
        multipart_data = (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"file\"; filename=\"test.png\"\r\n"
            f"Content-Type: image/png\r\n"
            f"\r\n"
        ).encode() + test_image_data + f"\r\n--{boundary}--\r\n".encode()
        
        # Send with proper multipart Content-Type
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": content_type
            },
            content=multipart_data
        )
        
        # Should succeed with proper multipart parsing
        assert response.status_code == 200
        
        # Verify file was processed
        data = response.json()
        assert data["success"] is True