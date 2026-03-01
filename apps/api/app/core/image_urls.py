"""
Centralized image URL serialization helpers.
"""

from app.core.storage import storage


def serialize_image_url(path: str | None) -> str | None:
    """
    Serialize a stored DB image path into a public URL.

    API response mappers must use this function for display image fields.
    API responses must never return raw/relative storage image paths.
    """
    if not path:
        return None
    return storage.get_url(path)
