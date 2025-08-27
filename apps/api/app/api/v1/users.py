"""
User profile endpoints.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.services.user_service import UserService
from app.core.responses import success_response

logger = logging.getLogger(__name__)
router = APIRouter()


class UserProfileUpdate(BaseModel):
    """User profile update request model."""
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None


class UserProfileResponse(BaseModel):
    """User profile response model."""
    id: int
    username: str
    email: str
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    created_at: str
    posts_count: int
    followers_count: int = 0  # Will be implemented with follow system
    following_count: int = 0  # Will be implemented with follow system

    model_config = ConfigDict(from_attributes=True)


class PublicUserProfileResponse(BaseModel):
    """Public user profile response model (no email)."""
    id: int
    username: str
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    created_at: str
    posts_count: int
    followers_count: int = 0  # Will be implemented with follow system
    following_count: int = 0  # Will be implemented with follow system

    model_config = ConfigDict(from_attributes=True)


class UserPostResponse(BaseModel):
    """User post response model."""
    id: str
    content: str
    post_type: str
    image_url: Optional[str] = None
    is_public: bool
    created_at: str
    updated_at: Optional[str] = None
    hearts_count: int = 0
    reactions_count: int = 0
    current_user_reaction: Optional[str] = None
    is_hearted: bool = False

    model_config = ConfigDict(from_attributes=True)





@router.get("/me/profile")
async def get_my_profile(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's profile."""
    user_service = UserService(db)
    result = await user_service.get_user_profile(current_user_id)
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.put("/me/profile")
async def update_my_profile(
    profile_update: UserProfileUpdate,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile."""
    user_service = UserService(db)
    result = await user_service.update_user_profile(
        user_id=current_user_id,
        username=profile_update.username,
        bio=profile_update.bio,
        profile_image_url=profile_update.profile_image_url
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.get("/me/posts")
async def get_my_posts(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's posts with engagement data."""
    user_service = UserService(db)
    result = await user_service.get_user_posts(
        user_id=current_user_id,
        current_user_id=current_user_id,
        public_only=False
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.get("/{user_id}/profile")
async def get_user_profile(
    user_id: int,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get another user's profile."""
    user_service = UserService(db)
    result = await user_service.get_public_user_profile(user_id)
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.get("/{user_id}/posts")
async def get_user_posts(
    user_id: int,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get another user's posts with engagement data."""
    user_service = UserService(db)
    result = await user_service.get_user_posts(
        user_id=user_id,
        current_user_id=current_user_id,
        public_only=True  # Only show public posts for other users
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))