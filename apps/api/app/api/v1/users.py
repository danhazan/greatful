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
    current_user_reaction: Optional[str] = None
    is_hearted: bool = False

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
    """Get current user's posts with engagement data."""
    try:
        # Import here to avoid circular imports
        from sqlalchemy import text
        
        # Check if likes table exists
        has_likes_table = True
        try:
            await db.execute(text("SELECT 1 FROM likes LIMIT 1"))
        except Exception:
            has_likes_table = False
            logger.info("Likes table not found, using emoji reactions only")

        # Build query with engagement counts using efficient LEFT JOINs
        if has_likes_table:
            # Query with both likes (hearts) and emoji reactions
            query = text("""
                SELECT p.id,
                       p.content,
                       p.post_type,
                       p.image_url,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       COALESCE(hearts.hearts_count, 0) as hearts_count,
                       COALESCE(reactions.reactions_count, 0) as reactions_count,
                       user_reactions.emoji_code as current_user_reaction,
                       CASE WHEN user_hearts.user_id IS NOT NULL THEN true ELSE false END as is_hearted
                FROM posts p
                LEFT JOIN (
                    SELECT post_id, COUNT(*) as hearts_count
                    FROM likes
                    GROUP BY post_id
                ) hearts ON hearts.post_id = p.id
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    GROUP BY post_id
                ) reactions ON reactions.post_id = p.id
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :current_user_id
                LEFT JOIN likes user_hearts ON user_hearts.post_id = p.id 
                    AND user_hearts.user_id = :current_user_id
                WHERE p.author_id = :current_user_id
                ORDER BY p.created_at DESC
            """)
        else:
            # Query with only emoji reactions (no likes table yet)
            query = text("""
                SELECT p.id,
                       p.content,
                       p.post_type,
                       p.image_url,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       0 as hearts_count,
                       COALESCE(reactions.reactions_count, 0) as reactions_count,
                       user_reactions.emoji_code as current_user_reaction,
                       false as is_hearted
                FROM posts p
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    GROUP BY post_id
                ) reactions ON reactions.post_id = p.id
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :current_user_id
                WHERE p.author_id = :current_user_id
                ORDER BY p.created_at DESC
            """)

        result = await db.execute(query, {"current_user_id": current_user_id})
        rows = result.fetchall()

        posts_with_counts = []
        for row in rows:
            posts_with_counts.append(UserPostResponse(
                id=row.id,
                content=row.content,
                post_type=row.post_type,
                image_url=row.image_url,
                is_public=row.is_public,
                created_at=str(row.created_at),
                updated_at=str(row.updated_at) if row.updated_at else None,
                hearts_count=int(row.hearts_count) if row.hearts_count else 0,
                reactions_count=int(row.reactions_count) if row.reactions_count else 0,
                current_user_reaction=row.current_user_reaction,
                is_hearted=bool(row.is_hearted) if hasattr(row, 'is_hearted') else False
            ))

        logger.info(f"Retrieved {len(posts_with_counts)} posts for user {current_user_id} with engagement counts")
        return posts_with_counts

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


@router.get("/{user_id}/posts", response_model=List[UserPostResponse])
async def get_user_posts(
    user_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get another user's posts with engagement data."""
    try:
        # Verify the user exists
        user = await User.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Import here to avoid circular imports
        from sqlalchemy import text
        
        # Check if likes table exists
        has_likes_table = True
        try:
            await db.execute(text("SELECT 1 FROM likes LIMIT 1"))
        except Exception:
            has_likes_table = False
            logger.info("Likes table not found, using emoji reactions only")

        # Build query with engagement counts using efficient LEFT JOINs
        if has_likes_table:
            # Query with both likes (hearts) and emoji reactions
            query = text("""
                SELECT p.id,
                       p.content,
                       p.post_type,
                       p.image_url,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       COALESCE(hearts.hearts_count, 0) as hearts_count,
                       COALESCE(reactions.reactions_count, 0) as reactions_count,
                       user_reactions.emoji_code as current_user_reaction,
                       CASE WHEN user_hearts.user_id IS NOT NULL THEN true ELSE false END as is_hearted
                FROM posts p
                LEFT JOIN (
                    SELECT post_id, COUNT(*) as hearts_count
                    FROM likes
                    GROUP BY post_id
                ) hearts ON hearts.post_id = p.id
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    GROUP BY post_id
                ) reactions ON reactions.post_id = p.id
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :current_user_id
                LEFT JOIN likes user_hearts ON user_hearts.post_id = p.id 
                    AND user_hearts.user_id = :current_user_id
                WHERE p.author_id = :target_user_id AND p.is_public = true
                ORDER BY p.created_at DESC
            """)
        else:
            # Query with only emoji reactions (no likes table yet)
            query = text("""
                SELECT p.id,
                       p.content,
                       p.post_type,
                       p.image_url,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       0 as hearts_count,
                       COALESCE(reactions.reactions_count, 0) as reactions_count,
                       user_reactions.emoji_code as current_user_reaction,
                       false as is_hearted
                FROM posts p
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    GROUP BY post_id
                ) reactions ON reactions.post_id = p.id
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :current_user_id
                WHERE p.author_id = :target_user_id AND p.is_public = true
                ORDER BY p.created_at DESC
            """)

        result = await db.execute(query, {
            "current_user_id": current_user_id,
            "target_user_id": user_id
        })
        rows = result.fetchall()

        posts_with_counts = []
        for row in rows:
            posts_with_counts.append(UserPostResponse(
                id=row.id,
                content=row.content,
                post_type=row.post_type,
                image_url=row.image_url,
                is_public=row.is_public,
                created_at=str(row.created_at),
                updated_at=str(row.updated_at) if row.updated_at else None,
                hearts_count=int(row.hearts_count) if row.hearts_count else 0,
                reactions_count=int(row.reactions_count) if row.reactions_count else 0,
                current_user_reaction=row.current_user_reaction,
                is_hearted=bool(row.is_hearted) if hasattr(row, 'is_hearted') else False
            ))

        logger.info(f"Retrieved {len(posts_with_counts)} posts for user {user_id} with engagement counts")
        return posts_with_counts

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user posts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get posts"
        )