"""
Posts API endpoints.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.models.user import User
from app.models.post import Post, PostType
from app.core.security import decode_token
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


class PostCreate(BaseModel):
    """Post creation request model."""
    content: str = Field(..., min_length=1, max_length=500)
    post_type: str = Field(..., description="Post type: daily, photo, or spontaneous")
    title: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = None
    location: Optional[str] = Field(None, max_length=100)
    is_public: bool = True


class PostResponse(BaseModel):
    """Post response model."""
    id: str
    author_id: int
    title: Optional[str] = None
    content: str
    post_type: str
    image_url: Optional[str] = None
    location: Optional[str] = None
    is_public: bool
    created_at: str
    updated_at: Optional[str] = None
    author: dict
    hearts_count: int = 0
    reactions_count: int = 0
    current_user_reaction: Optional[str] = None

    class Config:
        from_attributes = True


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


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Create a new gratitude post."""
    try:
        # Validate post type
        try:
            post_type_enum = PostType(post_data.post_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid post type. Must be one of: {[t.value for t in PostType]}"
            )

        # Validate content length based on post type
        max_lengths = {
            PostType.daily: 500,
            PostType.photo: 300,
            PostType.spontaneous: 200
        }
        
        max_length = max_lengths[post_type_enum]
        if len(post_data.content) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Content too long. Maximum {max_length} characters for {post_type_enum.value} posts"
            )

        # Get user to verify they exist
        user = await User.get_by_id(db, current_user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Create post
        post = Post(
            id=str(uuid.uuid4()),
            author_id=current_user_id,
            title=post_data.title,
            content=post_data.content,
            post_type=post_type_enum,
            image_url=post_data.image_url,
            is_public=post_data.is_public
        )

        db.add(post)
        await db.commit()
        await db.refresh(post)

        # Return post with author information
        return PostResponse(
            id=post.id,
            author_id=post.author_id,
            title=post.title,
            content=post.content,
            post_type=post.post_type.value,
            image_url=post.image_url,
            location=post_data.location,
            is_public=post.is_public,
            created_at=post.created_at.isoformat(),
            updated_at=post.updated_at.isoformat() if post.updated_at else None,
            author={
                "id": user.id,
                "username": user.username,
                "email": user.email
            },
            hearts_count=0,
            reactions_count=0,
            current_user_reaction=None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating post: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create post"
        )


@router.get("/feed", response_model=List[PostResponse])
async def get_feed(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0
):
    """Get user's personalized feed."""
    try:
        # For now, get all public posts ordered by creation date
        # TODO: Implement algorithm-based feed in TASK 8
        result = await db.execute(
            select(Post)
            .options(selectinload(Post.author))
            .where(Post.is_public == True)
            .order_by(Post.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        posts = result.scalars().all()

        return [
            PostResponse(
                id=post.id,
                author_id=post.author_id,
                title=post.title,
                content=post.content,
                post_type=post.post_type.value,
                image_url=post.image_url,
                is_public=post.is_public,
                created_at=post.created_at.isoformat(),
                updated_at=post.updated_at.isoformat() if post.updated_at else None,
                author={
                    "id": post.author.id,
                    "username": post.author.username,
                    "name": post.author.username  # Use username as display name for now
                },
                hearts_count=0,  # TODO: Calculate from interactions
                reactions_count=0,  # TODO: Calculate from emoji reactions
                current_user_reaction=None  # TODO: Get user's reaction
            )
            for post in posts
        ]

    except Exception as e:
        logger.error(f"Error getting feed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get feed"
        )