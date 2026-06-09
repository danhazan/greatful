"""Shared user serialization helpers for public user references."""

from typing import Any, Dict, Optional

from app.core.image_urls import serialize_image_url
from app.models.user import User


DELETED_USER_DISPLAY_NAME = "Deleted user"


def is_deleted_user(user: Optional[User]) -> bool:
    return bool(user and getattr(user, "account_status", "active") == "deleted")


def serialize_public_user_reference(user: Optional[User]) -> Dict[str, Any]:
    """Serialize a user reference for comments, notifications, reactions, and authors."""
    if user is None:
        return {
            "id": "0",
            "username": "unknown",
            "display_name": None,
            "name": "Unknown User",
            "profile_image_url": None,
            "image": None,
            "is_deleted": False,
            "account_status": "unknown",
        }

    if is_deleted_user(user):
        return {
            "id": user.id,
            "username": user.username,
            "display_name": None,
            "name": DELETED_USER_DISPLAY_NAME,
            "profile_image_url": None,
            "image": None,
            "is_deleted": True,
            "account_status": "deleted",
        }

    image_url = serialize_image_url(user.profile_image_url)
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "name": user.display_name or user.username,
        "profile_image_url": image_url,
        "image": image_url,
        "is_deleted": False,
        "account_status": getattr(user, "account_status", "active"),
    }


def serialize_deleted_profile(user: User, include_email: bool = False) -> Dict[str, Any]:
    """Serialize the profile tombstone for a deleted user."""
    profile = {
        "id": user.id,
        "username": user.username,
        "bio": None,
        "profile_image_url": None,
        "display_name": None,
        "city": None,
        "location": None,
        "institutions": [],
        "websites": [],
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        "posts_count": 0,
        "followers_count": 0,
        "following_count": 0,
        "oauth_provider": None,
        "account_status": "deleted",
        "is_deleted": True,
        "message": "This profile has been deleted.",
    }
    if include_email:
        profile["email"] = None
    return profile
