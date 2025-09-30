"""
Integration tests for reference counting system.
"""
import pytest
import io
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post
from app.models.image_hash import ImageHash


class TestReferenceCountingSystem:
    """Test cases for reference counting in deduplication system."""

    def create_test_image(self, color='red', size=(100, 100), format='JPEG'):
        """Create a test image file."""
        img = Image.new('RGB', size, color=color)
        img_bytes = io.BytesIO()
        img.save(img_bytes, format=format)
        img_bytes.seek(0)
        return img_bytes

    def test_reference_counting_with_duplicate_posts(self, client: TestClient, auth_headers):
        """Test that reference counting works when multiple posts use the same image."""
        # Create identical test images
        test_image1 = self.create_test_image(color='blue')
        test_image2 = self.create_test_image(color='blue')  # Same image
        
        # Upload first post with image
        response1 = client.post(
            "/api/v1/posts/upload",
            data={
                "content": "First post with image",
                "force_upload": "false"
            },
            files={"image": ("test1.jpg", test_image1, "image/jpeg")},
            headers=auth_headers
        )
        assert response1.status_code == 201
        post1_data = response1.json()
        post1_id = post1_data["id"]
        image_url = post1_data["image_url"]
        
        # Upload second post with same image (should detect duplicate)
        response2 = client.post(
            "/api/v1/posts/upload",
            data={
                "content": "Second post with same image",
                "force_upload": "false"
            },
            files={"image": ("test2.jpg", test_image2, "image/jpeg")},
            headers=auth_headers
        )
        assert response2.status_code == 201
        post2_data = response2.json()
        post2_id = post2_data["id"]
        
        # Both posts should have the same image URL (deduplication worked)
        assert post2_data["image_url"] == image_url
        
        # Delete first post
        delete_response1 = client.delete(f"/api/v1/posts/{post1_id}", headers=auth_headers)
        assert delete_response1.status_code == 200
        
        # Second post should still exist and have the image
        get_response = client.get(f"/api/v1/posts/{post2_id}", headers=auth_headers)
        assert get_response.status_code == 200
        remaining_post = get_response.json()
        assert remaining_post["image_url"] == image_url
        
        # Delete second post (should now delete the actual image file)
        delete_response2 = client.delete(f"/api/v1/posts/{post2_id}", headers=auth_headers)
        assert delete_response2.status_code == 200

    def test_profile_and_post_sharing_same_image(self, client: TestClient, auth_headers):
        """Test reference counting when profile photo and post use the same image."""
        # Create identical test images
        test_image1 = self.create_test_image(color='green')
        test_image2 = self.create_test_image(color='green')  # Same image
        
        # Upload as profile photo first
        profile_response = client.post(
            "/api/v1/users/me/profile/photo",
            files={"file": ("profile.jpg", test_image1, "image/jpeg")},
            headers=auth_headers
        )
        assert profile_response.status_code == 200
        profile_data = profile_response.json()["data"]
        profile_image_url = profile_data["profile_image_url"]
        
        # Upload same image in a post (should detect duplicate)
        post_response = client.post(
            "/api/v1/posts/upload",
            data={
                "content": "Post with same image as profile",
                "force_upload": "false"
            },
            files={"image": ("post.jpg", test_image2, "image/jpeg")},
            headers=auth_headers
        )
        assert post_response.status_code == 201
        post_data = post_response.json()
        post_id = post_data["id"]
        
        # Delete the post (image should still exist for profile)
        delete_response = client.delete(f"/api/v1/posts/{post_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Profile should still have the image
        profile_check = client.get("/api/v1/users/me/profile", headers=auth_headers)
        assert profile_check.status_code == 200
        # The profile should still have an image URL (wrapped in success_response)
        profile_data = profile_check.json()["data"]
        assert profile_data["profile_image_url"] is not None

    def test_force_upload_bypasses_deduplication(self, client: TestClient, auth_headers):
        """Test that force_upload creates separate files even for duplicates."""
        # Create identical test images
        test_image1 = self.create_test_image(color='yellow')
        test_image2 = self.create_test_image(color='yellow')  # Same image
        
        # Upload first post
        response1 = client.post(
            "/api/v1/posts/upload",
            data={
                "content": "First post",
                "force_upload": "false"
            },
            files={"image": ("test1.jpg", test_image1, "image/jpeg")},
            headers=auth_headers
        )
        assert response1.status_code == 201
        post1_data = response1.json()
        image_url1 = post1_data["image_url"]
        
        # Upload second post with force_upload=true
        response2 = client.post(
            "/api/v1/posts/upload",
            data={
                "content": "Second post with force upload",
                "force_upload": "true"
            },
            files={"image": ("test2.jpg", test_image2, "image/jpeg")},
            headers=auth_headers
        )
        assert response2.status_code == 201
        post2_data = response2.json()
        image_url2 = post2_data["image_url"]
        
        # Images should have different URLs (force upload bypassed deduplication)
        assert image_url1 != image_url2

    def test_reupload_after_deletion(self, client, test_user, auth_headers):
        """Test that re-uploading the same image after deletion works correctly."""
        # Create identical test images
        test_image1 = self.create_test_image(color='purple')
        test_image2 = self.create_test_image(color='purple')  # Same image
        
        # Upload image first
        response1 = client.post(
            "/api/v1/posts/upload",
            data={
                "content": "First post",
                "force_upload": "false"
            },
            files={"image": ("test1.jpg", test_image1, "image/jpeg")},
            headers=auth_headers
        )
        assert response1.status_code == 201
        post1_data = response1.json()
        post1_id = post1_data["id"]
        
        # Delete the post (which should delete the image)
        delete_response = client.delete(f"/api/v1/posts/{post1_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Upload the same image again - this should work without errors
        response2 = client.post(
            "/api/v1/posts/upload",
            data={
                "content": "Second post with same image",
                "force_upload": "false"
            },
            files={"image": ("test2.jpg", test_image2, "image/jpeg")},
            headers=auth_headers
        )
        assert response2.status_code == 201
        post2_data = response2.json()
        
        # Verify the new post was created successfully
        assert post2_data["content"] == "Second post with same image"
        assert post2_data["image_url"] is not None

    def test_profile_photo_variant_cleanup(self, client, test_user, auth_headers):
        """Test that profile photo variants are properly cleaned up when deleted."""
        # Create test image
        test_image = self.create_test_image(color='orange')
        
        # Upload profile photo
        response = client.post(
            "/api/v1/users/me/profile/photo",
            files={"file": ("profile.jpg", test_image, "image/jpeg")},
            headers=auth_headers
        )
        assert response.status_code == 200
        profile_response = response.json()
        profile_data = profile_response["data"]
        
        # Verify variants were created
        sizes_data = profile_data.get("sizes", {})
        assert "thumbnail" in sizes_data
        assert "small" in sizes_data
        assert "medium" in sizes_data
        assert "large" in sizes_data
        
        # Check that variant files exist on disk
        from pathlib import Path
        upload_dir = Path("/home/danha/Projects/Kiro/greatful/apps/api/uploads") / "profile_photos"
        variant_files = []
        for size_name, size_url in sizes_data.items():
            filename = size_url.split('/')[-1]
            file_path = upload_dir / filename
            assert file_path.exists(), f"Variant file {filename} should exist"
            variant_files.append(file_path)
        
        # Delete profile photo
        delete_response = client.delete("/api/v1/users/me/profile/photo", headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Verify all variant files are deleted from disk
        for file_path in variant_files:
            assert not file_path.exists(), f"Variant file {file_path.name} should be deleted"
        
        # Verify user profile image URL is cleared
        user_response = client.get("/api/v1/users/me/profile", headers=auth_headers)
        assert user_response.status_code == 200
        user_data = user_response.json()
        assert user_data["data"]["profile_image_url"] is None

    def test_profile_photo_individual_variants_per_user(self, client, test_user, test_user_2, auth_headers, auth_headers_2):
        """Test that profile photo variants are individual per user (not shared)."""
        # Create test image
        test_image1 = self.create_test_image(color='purple')
        test_image2 = self.create_test_image(color='purple')  # Same image
        
        # User 1 uploads profile photo
        response1 = client.post(
            "/api/v1/users/me/profile/photo",
            files={"file": ("profile1.jpg", test_image1, "image/jpeg")},
            headers=auth_headers
        )
        assert response1.status_code == 200
        profile_data1 = response1.json()["data"]
        
        # Get variant file paths for user 1
        sizes_data1 = profile_data1.get("sizes", {})
        upload_dir = Path("/home/danha/Projects/Kiro/greatful/apps/api/uploads") / "profile_photos"
        variant_files_user1 = []
        for size_name, size_url in sizes_data1.items():
            filename = size_url.split('/')[-1]
            file_path = upload_dir / filename
            assert file_path.exists(), f"Variant file {filename} should exist"
            variant_files_user1.append(file_path)
        
        # User 2 uploads the same image (should create individual variants)
        response2 = client.post(
            "/api/v1/users/me/profile/photo",
            files={"file": ("profile2.jpg", test_image2, "image/jpeg")},
            headers=auth_headers_2
        )
        assert response2.status_code == 200
        profile_data2 = response2.json()["data"]
        
        # Each user should have individual variants (different base filenames)
        sizes_data2 = profile_data2.get("sizes", {})
        
        # Extract base filenames to compare
        def extract_base_filename(url):
            filename = url.split('/')[-1]
            parts = filename.split('_')
            if len(parts) >= 3:  # profile_userid_uuid
                return '_'.join(parts[:-1])  # Remove size suffix
            return filename
        
        base1 = extract_base_filename(list(sizes_data1.values())[0])
        base2 = extract_base_filename(list(sizes_data2.values())[0])
        assert base1 != base2, "Each user should have individual variants (different base filenames)"
        
        # Verify user IDs are in the filenames
        assert "profile_1_" in base1, "User 1's variants should contain user ID"
        assert "profile_2_" in base2, "User 2's variants should contain user ID"
        
        # Get variant file paths for user 2
        variant_files_user2 = []
        for size_name, size_url in sizes_data2.items():
            filename = size_url.split('/')[-1]
            file_path = upload_dir / filename
            assert file_path.exists(), f"Variant file {filename} should exist"
            variant_files_user2.append(file_path)
        
        # User 1 deletes their profile photo
        delete_response1 = client.delete("/api/v1/users/me/profile/photo", headers=auth_headers)
        assert delete_response1.status_code == 200
        
        # User 1's variants should be deleted, but User 2's should remain
        for file_path in variant_files_user1:
            assert not file_path.exists(), f"User 1's variant file {file_path.name} should be deleted"
        
        for file_path in variant_files_user2:
            assert file_path.exists(), f"User 2's variant file {file_path.name} should still exist"
        
        # User 2 deletes their profile photo
        delete_response2 = client.delete("/api/v1/users/me/profile/photo", headers=auth_headers_2)
        assert delete_response2.status_code == 200
        
        # Now User 2's variants should also be deleted
        for file_path in variant_files_user2:
            assert not file_path.exists(), f"User 2's variant file {file_path.name} should be deleted"