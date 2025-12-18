"""
Image Configuration System

This module contains all configurable parameters for multi-image post support,
including image limits, variant dimensions, and quality settings.

This is the SINGLE SOURCE OF TRUTH for image processing parameters.
Frontend configuration (NEXT_PUBLIC_MAX_POST_IMAGES) mirrors these values
for UX purposes only - backend validation is authoritative.
"""

import os
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ImageVariantConfig:
    """
    Configuration for image variant sizes.

    Variants are optimized for different display contexts:
    - thumbnail: Quick loading for upload previews and reorder UI
    - medium: Primary display size for feed and fullscreen viewer
    - original: Preserved full quality, capped to prevent excessive storage
    """
    # Thumbnail: Used for upload previews, reorder UI in post creation
    # Small enough for fast loading, large enough to see content
    thumbnail_width: int = 400

    # Medium: Primary display variant for feed stacked preview and fullscreen viewer
    # Balances quality with load time for typical device screens
    medium_width: int = 1200

    # Original: Maximum preserved size to prevent excessive storage
    # Full quality images larger than this are resized down
    original_max_width: int = 2560

    # JPEG compression quality (0-100)
    # 85 provides good balance of quality vs file size
    jpeg_quality: int = 85


@dataclass
class MultiImageConfig:
    """
    Configuration for multi-image posts.

    This is the authoritative configuration for image limits.
    Frontend configuration should mirror these values for UX only.
    """
    # Maximum number of images allowed per post
    # This is the AUTHORITATIVE limit - backend validation enforces this
    # Frontend (NEXT_PUBLIC_MAX_POST_IMAGES) mirrors for UX only
    max_images_per_post: int = 7

    # Variant configuration
    variants: ImageVariantConfig = None

    # Maximum file size per image in MB
    max_file_size_mb: int = 5

    # Allowed image MIME types
    allowed_mime_types: tuple = ("image/jpeg", "image/png", "image/webp", "image/gif")

    # Allowed file extensions
    allowed_extensions: tuple = (".jpg", ".jpeg", ".png", ".webp", ".gif")

    def __post_init__(self):
        if self.variants is None:
            self.variants = ImageVariantConfig()

    @classmethod
    def from_env(cls) -> "MultiImageConfig":
        """
        Create configuration from environment variables.

        Environment variables:
        - MAX_POST_IMAGES: Maximum images per post (default: 7)
        """
        max_images = int(os.getenv("MAX_POST_IMAGES", "7"))

        config = cls(max_images_per_post=max_images)

        logger.info(
            f"Image configuration loaded: max_images={config.max_images_per_post}, "
            f"variants=(thumb={config.variants.thumbnail_width}px, "
            f"medium={config.variants.medium_width}px, "
            f"original_max={config.variants.original_max_width}px)"
        )

        return config


# Global configuration instance
_config: Optional[MultiImageConfig] = None


def get_image_config() -> MultiImageConfig:
    """
    Get the global image configuration.

    Returns:
        MultiImageConfig: Current image configuration
    """
    global _config
    if _config is None:
        _config = MultiImageConfig.from_env()
    return _config


def get_max_post_images() -> int:
    """
    Get the maximum number of images allowed per post.

    This is the authoritative limit enforced by the backend.

    Returns:
        int: Maximum images per post
    """
    return get_image_config().max_images_per_post


def get_variant_config() -> ImageVariantConfig:
    """
    Get image variant configuration.

    Returns:
        ImageVariantConfig: Variant dimensions and quality settings
    """
    return get_image_config().variants


def reload_image_config() -> None:
    """Reload the image configuration (useful for testing)."""
    global _config
    _config = None
    get_image_config()
