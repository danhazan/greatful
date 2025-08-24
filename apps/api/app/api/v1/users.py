"""
User profile endpoints.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models.user import User
from app.models.post import Post
from app.core.security import decode_token

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


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

    model_config = ConfigDict(from_attributes=True)


async def get_current_user_id(auth: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Extract user ID from JWT token."""
    try:
        payload = decode_token(auth.credentials)
        user_id = int(payload.get("sub"))
        return user_id
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )


@router.get("/me/profile", response_model=UserProfileResponse)
async def get_my_profile(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's profile."""
    try:
        user = await User.get_by_id(db, current_user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Get posts count
        posts_result = await db.execute(
            select(Post).where(Post.author_id == current_user_id)
        )
        posts_count = len(posts_result.scalars().all())

        return UserProfileResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            bio=user.bio,
            profile_image_url=user.profile_image_url,
            created_at=user.created_at.isoformat(),
            posts_count=posts_count,
            followers_count=0,  # TODO: Implement with follow system
            following_count=0   # TODO: Implement with follow system
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get profile"
        )


@router.put("/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    profile_update: UserProfileUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile."""
    try:
        user = await User.get_by_id(db, current_user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Update fields if provided
        if profile_update.username is not None:
            # Check if username is already taken by another user
            existing_user = await User.get_by_username(db, profile_update.username)
            if existing_user and existing_user.id != current_user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already taken"
                )
            user.username = profile_update.username

        if profile_update.bio is not None:
            user.bio = profile_update.bio

        if profile_update.profile_image_url is not None:
            user.profile_image_url = profile_update.profile_image_url

        await db.commit()
        await db.refresh(user)

        # Get posts count
        posts_result = await db.execute(
            select(Post).where(Post.author_id == current_user_id)
        )
        posts_count = len(posts_result.scalars().all())

        return UserProfileResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            bio=user.bio,
            profile_image_url=user.profile_image_url,
            created_at=user.created_at.isoformat(),
            posts_count=posts_count,
            followers_count=0,
            following_count=0
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )


@router.get("/me/posts", response_model=List[UserPostResponse])
async def get_my_posts(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's posts."""
    try:
        result = await db.execute(
            select(Post)
            .where(Post.author_id == current_user_id)
            .order_by(Post.created_at.desc())
        )
        posts = result.scalars().all()

        return [
            UserPostResponse(
                id=post.id,
                content=post.content,
                post_type=post.post_type.value,
                image_url=post.image_url,
                is_public=post.is_public,
                created_at=post.created_at.isoformat(),
                updated_at=post.updated_at.isoformat() if post.updated_at else None,
                hearts_count=0,  # TODO: Calculate from interactions
                reactions_count=0  # TODO: Calculate from emoji reactions
            )
            for post in posts
        ]

    except Exception as e:
        logger.error(f"Error getting user posts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get posts"
        )


@router.get("/{user_id}/profile", response_model=PublicUserProfileResponse)
async def get_user_profile(
    user_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get another user's profile."""
    try:
        user = await User.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Get posts count
        posts_result = await db.execute(
            select(Post).where(Post.author_id == user_id)
        )
        posts_count = len(posts_result.scalars().all())

        return PublicUserProfileResponse(
            id=user.id,
            username=user.username,
            bio=user.bio,
            profile_image_url=user.profile_image_url,
            created_at=user.created_at.isoformat(),
            posts_count=posts_count,
            followers_count=0,
            following_count=0
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user profile"
        )