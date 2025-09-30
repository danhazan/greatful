"""
Test profile photo deletion functionality.
"""

import pytest
from httpx import AsyncClient
from fastapi import status
from io import BytesIO
from PIL import Image
from pathlib import Path

from app.core.database import get_db
from app.models.user import User


class TestProfilePhotoDeletion:
    """Test profile photo deletion functionality."""

    def create_test_image(self, size=(200, 200), color=(255, 0, 0)):
        """Create a test image in memory."""
        image = Image.new('RGB', size, color)
        img_bytes = BytesIO()
        image.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        return img_bytes.getvalue()

    @pytest.mark.asyncio
    async def test_profile_photo_deletion_removes_all_files(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test that profile photo deletion removes all variant files."""
        # Create test image
        test_image = self.create_test_image()
        
        # Upload profile photo
        files = {"file": ("test.jpg", test_image, "image/jpeg")}
        
        response = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        
        # Get the uploaded file URLs
        sizes = response_data["data"]["sizes"]
        upload_dir = Path("/home/danha/Projects/Kiro/greatful/apps/api/uploads") / "profile_photos"
        
        # Verify all variant files exist
        variant_files = []
        for size_name, size_url in sizes.items():
            filename = size_url.split('/')[-1]
            file_path = upload_dir / filename
            assert file_path.exists(), f"Variant file {filename} should exist after upload"
            variant_files.append(file_path)
        
        # Delete profile photo
        delete_response = await async_client.delete(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers
        )
        
        assert delete_response.status_code == status.HTTP_200_OK
        
        # Verify all variant files are deleted
        for file_path in variant_files:
            assert not file_path.exists(), f"Variant file {file_path.name} should be deleted"

    @pytest.mark.asyncio
    async def test_multiple_users_deletion_independence(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        test_user_2: User,
        auth_headers: dict,
        auth_headers_2: dict
    ):
        """Test that deleting one user's profile photo doesn't affect another user's."""
        # Create test images
        test_image1 = self.create_test_image(color=(255, 0, 0))  # Red
        test_image2 = self.create_test_image(color=(0, 255, 0))  # Green
        
        # User 1 uploads profile photo
        files1 = {"file": ("test1.jpg", test_image1, "image/jpeg")}
        response1 = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files1
        )
        assert response1.status_code == status.HTTP_200_OK
        
        # User 2 uploads profile photo
        files2 = {"file": ("test2.jpg", test_image2, "image/jpeg")}
        response2 = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers_2,
            files=files2
        )
        assert response2.status_code == status.HTTP_200_OK
        
        # Get file paths for both users
        sizes1 = response1.json()["data"]["sizes"]
        sizes2 = response2.json()["data"]["sizes"]
        upload_dir = Path("/home/danha/Projects/Kiro/greatful/apps/api/uploads") / "profile_photos"
        
        user1_files = []
        user2_files = []
        
        for size_url in sizes1.values():
            filename = size_url.split('/')[-1]
            file_path = upload_dir / filename
            user1_files.append(file_path)
            
        for size_url in sizes2.values():
            filename = size_url.split('/')[-1]
            file_path = upload_dir / filename
            user2_files.append(file_path)
        
        # Verify all files exist
        for file_path in user1_files + user2_files:
            assert file_path.exists(), f"File {file_path.name} should exist"
        
        # User 1 deletes their profile photo
        delete_response1 = await async_client.delete(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers
        )
        assert delete_response1.status_code == status.HTTP_200_OK
        
        # User 1's files should be deleted, User 2's should remain
        for file_path in user1_files:
            assert not file_path.exists(), f"User 1's file {file_path.name} should be deleted"
            
        for file_path in user2_files:
            assert file_path.exists(), f"User 2's file {file_path.name} should still exist"
        
        # User 2 deletes their profile photo
        delete_response2 = await async_client.delete(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers_2
        )
        assert delete_response2.status_code == status.HTTP_200_OK
        
        # Now User 2's files should also be deleted
        for file_path in user2_files:
            assert not file_path.exists(), f"User 2's file {file_path.name} should be deleted"

    @pytest.mark.asyncio
    async def test_profile_photo_replacement_cleans_old_files(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        auth_headers: dict
    ):
        """Test that uploading a new profile photo cleans up the old one."""
        # Upload first profile photo
        test_image1 = self.create_test_image(color=(255, 0, 0))  # Red
        files1 = {"file": ("test1.jpg", test_image1, "image/jpeg")}
        
        response1 = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files1
        )
        assert response1.status_code == status.HTTP_200_OK
        
        # Get first set of files
        sizes1 = response1.json()["data"]["sizes"]
        upload_dir = Path("/home/danha/Projects/Kiro/greatful/apps/api/uploads") / "profile_photos"
        
        first_files = []
        for size_url in sizes1.values():
            filename = size_url.split('/')[-1]
            file_path = upload_dir / filename
            first_files.append(file_path)
            assert file_path.exists(), f"First upload file {filename} should exist"
        
        # Upload second profile photo
        test_image2 = self.create_test_image(color=(0, 255, 0))  # Green
        files2 = {"file": ("test2.jpg", test_image2, "image/jpeg")}
        
        response2 = await async_client.post(
            "/api/v1/users/me/profile/photo",
            headers=auth_headers,
            files=files2
        )
        assert response2.status_code == status.HTTP_200_OK
        
        # Get second set of files
        sizes2 = response2.json()["data"]["sizes"]
        second_files = []
        for size_url in sizes2.values():
            filename = size_url.split('/')[-1]
            file_path = upload_dir / filename
            second_files.append(file_path)
            assert file_path.exists(), f"Second upload file {filename} should exist"
        
        # First files should be deleted, second files should exist
        for file_path in first_files:
            assert not file_path.exists(), f"First upload file {file_path.name} should be deleted"
            
        for file_path in second_files:
            assert file_path.exists(), f"Second upload file {file_path.name} should exist"