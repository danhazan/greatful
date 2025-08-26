"""
Posts API endpoints.
"""

import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_token
from app.models.post import Post, PostType
from app.models.user import User

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
    """Get user's personalized feed with accurate engagement counts from database."""
    try:
        from sqlalchemy import text
        from app.models.emoji_reaction import EmojiReaction
        
        # Import the likes model
        try:
            from app.models.like import Like
            has_likes_table = True
        except ImportError:
            has_likes_table = False
            logger.warning("Likes table not found, hearts count will be 0")

        # Build query with engagement counts using efficient LEFT JOINs
        if has_likes_table:
            # Query with both likes (hearts) and emoji reactions
            query = text("""
                SELECT p.id,
                       p.author_id,
                       p.title,
                       p.content,
                       p.post_type,
                       p.image_url,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       u.id as author_id,
                       u.username as author_username,
                       u.email as author_email,
                       COALESCE(hearts.hearts_count, 0) as hearts_count,
                       COALESCE(reactions.reactions_count, 0) as reactions_count,
                       user_reactions.emoji_code as current_user_reaction,
                       CASE WHEN user_hearts.user_id IS NOT NULL THEN true ELSE false END as is_hearted
                FROM posts p
                LEFT JOIN users u ON u.id = p.author_id
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as hearts_count
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
                WHERE p.is_public = true
                ORDER BY p.created_at DESC
                LIMIT :limit OFFSET :offset
            """)
        else:
            # Query with only emoji reactions (no likes table yet)
            query = text("""
                SELECT p.id,
                       p.author_id,
                       p.title,
                       p.content,
                       p.post_type,
                       p.image_url,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       u.id as author_id,
                       u.username as author_username,
                       u.email as author_email,
                       0 as hearts_count,
                       COALESCE(reactions.reactions_count, 0) as reactions_count,
                       user_reactions.emoji_code as current_user_reaction,
                       false as is_hearted
                FROM posts p
                LEFT JOIN users u ON u.id = p.author_id
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    GROUP BY post_id
                ) reactions ON reactions.post_id = p.id
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :current_user_id
                WHERE p.is_public = true
                ORDER BY p.created_at DESC
                LIMIT :limit OFFSET :offset
            """)

        result = await db.execute(query, {
            "current_user_id": current_user_id,
            "limit": limit,
            "offset": offset
        })
        
        rows = result.fetchall()

        posts_with_counts = []
        for row in rows:
            posts_with_counts.append(PostResponse(
                id=row.id,
                author_id=row.author_id,
                title=row.title,
                content=row.content,
                post_type=row.post_type,
                image_url=row.image_url,
                is_public=row.is_public,
                created_at=row.created_at.isoformat(),
                updated_at=row.updated_at.isoformat() if row.updated_at else None,
                author={
                    "id": row.author_id,
                    "username": row.author_username,
                    "name": row.author_username  # Use username as display name for now
                },
                hearts_count=int(row.hearts_count) if row.hearts_count else 0,
                reactions_count=int(row.reactions_count) if row.reactions_count else 0,
                current_user_reaction=row.current_user_reaction
            ))

        logger.info(f"Retrieved {len(posts_with_counts)} posts with engagement counts - Hearts: {sum(p.hearts_count for p in posts_with_counts)}, Reactions: {sum(p.reactions_count for p in posts_with_counts)}")
        return posts_with_counts

    except Exception as e:
        logger.error(f"Error getting feed with engagement counts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get feed"
        )