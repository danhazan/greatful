"""
Test circular cropping functionality for profile photos.
"""

import pytest
import json
from httpx import AsyncClient
from fastapi import status
from io import BytesIO
from PIL import Image

from app.core.database import get_db
from app.models.user import User


class TestCircularCropProfilePhoto:
    """Test circular cropping functionality for profile photos."""

    def create_test_image(self, size=(200, 200), color=(255, 0, 0)):
        """Create a test image in memory."""
        image = Image.new('RGB', size, color)
        img_bytes = BytesIO()
        image.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        return img_bytes.getvalue()

    @pytest.mark.asyncio
    async def test_profile_photo_upload_with_crop_data(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test profile photo upload with circular crop data."""
        # Create test image
        test_image = self.create_test_image()
        
        # Create crop data
        crop_data = {
            "x": 100,
            "y": 100,
            "radius": 50
        }
        
        # Prepare multipart form data
        files = {"file": ("test.jpg", test_image, "image/jpeg")}
        data = {"crop_data": json.dumps(crop_data)}
        
        # Make request with crop data
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        # Verify response
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        
        assert response_data["success"] is True
        assert "profile_image_url" in response_data["data"]
        assert "sizes" in response_data["data"]
        
        # Verify all size variants were created
        sizes = response_data["data"]["sizes"]
        expected_sizes = ["thumbnail", "small", "medium", "large"]
        for size in expected_sizes:
            assert size in sizes
            assert sizes[size].startswith("/uploads/profile_photos/")

    @pytest.mark.asyncio
    async def test_profile_photo_upload_without_crop_data(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test profile photo upload without crop data (should work normally)."""
        # Create test image
        test_image = self.create_test_image()
        
        # Prepare multipart form data without crop data
        files = {"file": ("test.jpg", test_image, "image/jpeg")}
        
        # Make request without crop data
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files
        )
        
        # Verify response
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        
        assert response_data["success"] is True
        assert "profile_image_url" in response_data["data"]
        assert "sizes" in response_data["data"]

    @pytest.mark.asyncio
    async def test_profile_photo_upload_with_invalid_crop_data(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test profile photo upload with invalid crop data."""
        # Create test image
        test_image = self.create_test_image()
        
        # Create invalid crop data (not valid JSON)
        invalid_crop_data = "invalid json"
        
        # Prepare multipart form data
        files = {"file": ("test.jpg", test_image, "image/jpeg")}
        data = {"crop_data": invalid_crop_data}
        
        # Make request with invalid crop data
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        # Should still work (crop data is optional and invalid data is ignored)
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        
        assert response_data["success"] is True
        assert "profile_image_url" in response_data["data"]

    @pytest.mark.asyncio
    async def test_individual_variants_creation(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test that individual variants are created for each user."""
        # Create test image
        test_image = self.create_test_image()
        
        # Create crop data
        crop_data = {
            "x": 100,
            "y": 100,
            "radius": 50
        }
        
        # Prepare multipart form data
        files = {"file": ("test.jpg", test_image, "image/jpeg")}
        data = {"crop_data": json.dumps(crop_data)}
        
        # Upload first time
        response1 = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        assert response1.status_code == status.HTTP_200_OK
        response1_data = response1.json()
        first_profile_url = response1_data["data"]["profile_image_url"]
        
        # Upload second time with different crop data
        crop_data2 = {
            "x": 80,
            "y": 80,
            "radius": 40
        }
        
        files2 = {"file": ("test2.jpg", test_image, "image/jpeg")}
        data2 = {"crop_data": json.dumps(crop_data2)}
        
        response2 = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files2,
            data=data2
        )
        
        assert response2.status_code == status.HTTP_200_OK
        response2_data = response2.json()
        second_profile_url = response2_data["data"]["profile_image_url"]
        
        # URLs should be different (individual variants)
        assert first_profile_url != second_profile_url
        
        # Both should contain user-specific identifiers
        assert "profile_" in first_profile_url
        assert "profile_" in second_profile_url