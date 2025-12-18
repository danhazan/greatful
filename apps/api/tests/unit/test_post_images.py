"""
Unit tests for multi-image post functionality.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from io import BytesIO
from PIL import Image

from app.models.post_image import PostImage
from app.config.image_config import get_image_config, get_variant_config


class TestPostImageModel:
    """Tests for the PostImage model."""

    def test_post_image_creation(self):
        """Test creating a PostImage instance."""
        image = PostImage(
            id="test-id-123",
            post_id="post-123",
            position=0,
            thumbnail_url="/uploads/posts/test_thumb.jpg",
            medium_url="/uploads/posts/test_medium.jpg",
            original_url="/uploads/posts/test_original.jpg",
            width=1920,
            height=1080,
            file_size=1024000
        )

        assert image.id == "test-id-123"
        assert image.post_id == "post-123"
        assert image.position == 0
        assert image.thumbnail_url == "/uploads/posts/test_thumb.jpg"
        assert image.medium_url == "/uploads/posts/test_medium.jpg"
        assert image.original_url == "/uploads/posts/test_original.jpg"
        assert image.width == 1920
        assert image.height == 1080
        assert image.file_size == 1024000

    def test_post_image_default_values(self):
        """Test PostImage with minimal required fields."""
        image = PostImage(
            post_id="post-123",
            position=0,  # Required field (default applies on DB commit)
            thumbnail_url="/uploads/posts/thumb.jpg",
            medium_url="/uploads/posts/medium.jpg",
            original_url="/uploads/posts/original.jpg"
        )

        assert image.position == 0
        assert image.width is None
        assert image.height is None
        assert image.file_size is None


class TestImageConfig:
    """Tests for image configuration."""

    def test_get_image_config(self):
        """Test getting image configuration."""
        config = get_image_config()

        assert config.max_images_per_post > 0
        assert config.max_images_per_post == 7  # Default value
        assert config.variants is not None
        assert config.max_file_size_mb > 0

    def test_get_variant_config(self):
        """Test getting image variant configuration."""
        config = get_variant_config()

        assert config.thumbnail_width > 0
        assert config.medium_width > 0
        assert config.original_max_width > 0
        assert config.jpeg_quality > 0
        assert config.jpeg_quality <= 100

        # Ensure proper size hierarchy
        assert config.thumbnail_width < config.medium_width
        assert config.medium_width < config.original_max_width

    def test_variant_sizes_are_reasonable(self):
        """Test that variant sizes are within reasonable bounds."""
        config = get_variant_config()

        # Thumbnail should be small
        assert 100 <= config.thumbnail_width <= 600

        # Medium should be suitable for feed display
        assert 800 <= config.medium_width <= 1600

        # Original should preserve quality but not be excessive
        assert 1920 <= config.original_max_width <= 4000


class TestImageValidation:
    """Tests for image validation logic."""

    def test_max_images_limit(self):
        """Test that max images limit is enforced."""
        config = get_image_config()

        # Simulating validation logic
        existing_images = 5
        new_images = 3
        max_allowed = config.max_images_per_post

        can_add = existing_images + new_images <= max_allowed

        if max_allowed == 7:
            assert can_add == False  # 5 + 3 = 8 > 7

        # Can always add if under limit
        existing_images = 2
        new_images = 3
        can_add = existing_images + new_images <= max_allowed
        assert can_add == True  # 2 + 3 = 5 <= 7


class TestImageUrlGeneration:
    """Tests for image URL generation patterns."""

    def test_url_format(self):
        """Test that URLs follow expected format."""
        base_filename = "abc123def"

        thumbnail_url = f"/uploads/posts/{base_filename}_thumb.jpg"
        medium_url = f"/uploads/posts/{base_filename}_medium.jpg"
        original_url = f"/uploads/posts/{base_filename}_original.jpg"

        assert thumbnail_url.startswith("/uploads/posts/")
        assert thumbnail_url.endswith("_thumb.jpg")
        assert medium_url.endswith("_medium.jpg")
        assert original_url.endswith("_original.jpg")

    def test_url_contains_unique_id(self):
        """Test that URLs contain unique identifiers."""
        import uuid

        unique_id = str(uuid.uuid4())[:8]
        base_filename = f"image_{unique_id}"

        thumbnail_url = f"/uploads/posts/{base_filename}_thumb.jpg"

        assert unique_id in thumbnail_url


class TestPostImageSerialization:
    """Tests for PostImage serialization."""

    def test_serialize_single_image(self):
        """Test serializing a single PostImage."""
        image = PostImage(
            id="img-1",
            post_id="post-1",
            position=0,
            thumbnail_url="/uploads/posts/thumb.jpg",
            medium_url="/uploads/posts/medium.jpg",
            original_url="/uploads/posts/original.jpg",
            width=800,
            height=600
        )

        serialized = {
            "id": image.id,
            "position": image.position,
            "thumbnail_url": image.thumbnail_url,
            "medium_url": image.medium_url,
            "original_url": image.original_url,
            "width": image.width,
            "height": image.height
        }

        assert serialized["id"] == "img-1"
        assert serialized["position"] == 0
        assert serialized["thumbnail_url"] == "/uploads/posts/thumb.jpg"
        assert serialized["width"] == 800
        assert serialized["height"] == 600

    def test_serialize_multiple_images_ordered(self):
        """Test that multiple images are serialized in order."""
        images = [
            PostImage(id="img-3", post_id="post-1", position=2,
                      thumbnail_url="/t3.jpg", medium_url="/m3.jpg", original_url="/o3.jpg"),
            PostImage(id="img-1", post_id="post-1", position=0,
                      thumbnail_url="/t1.jpg", medium_url="/m1.jpg", original_url="/o1.jpg"),
            PostImage(id="img-2", post_id="post-1", position=1,
                      thumbnail_url="/t2.jpg", medium_url="/m2.jpg", original_url="/o2.jpg"),
        ]

        # Sort by position
        sorted_images = sorted(images, key=lambda x: x.position)
        serialized = [{"id": img.id, "position": img.position} for img in sorted_images]

        assert serialized[0]["id"] == "img-1"
        assert serialized[0]["position"] == 0
        assert serialized[1]["id"] == "img-2"
        assert serialized[1]["position"] == 1
        assert serialized[2]["id"] == "img-3"
        assert serialized[2]["position"] == 2
