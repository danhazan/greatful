"""
API endpoints for heart reactions (likes).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from app.core.database import get_db
from app.models.like import Like
from app.models.post import Post
from app.models.user import User
from app.core.security import decode_token
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


class LikeResponse(BaseModel):
    """Response model for like data."""
    id: str
    user_id: int
    post_id: str
    created_at: str
    user: dict

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


@router.post("/posts/{post_id}/heart", response_model=LikeResponse, status_code=status.HTTP_201_CREATED)
async def add_heart(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a heart (like) to a post.
    
    - **post_id**: ID of the post to heart
    
    Returns the created like.
    """
    try:
        # Check if post exists
        post_result = await db.execute(select(Post).where(Post.id == post_id))
        post = post_result.scalar_one_or_none()
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        # Check if user already hearted this post
        existing_like_result = await db.execute(
            select(Like).where(Like.user_id == current_user_id, Like.post_id == post_id)
        )
        existing_like = existing_like_result.scalar_one_or_none()
        
        if existing_like:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Post already hearted by user"
            )

        # Get user info
        user_result = await db.execute(select(User).where(User.id == current_user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Create like
        like = Like(
            id=str(uuid.uuid4()),
            user_id=current_user_id,
            post_id=post_id
        )
        
        db.add(like)
        await db.commit()
        await db.refresh(like)
        
        logger.info(f"User {current_user_id} hearted post {post_id}")
        
        return LikeResponse(
            id=like.id,
            user_id=like.user_id,
            post_id=like.post_id,
            created_at=like.created_at.isoformat(),
            user={
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
        )
        
    except HTTPException:
        raise
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Post already hearted by user"
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error adding heart: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add heart"
        )


@router.delete("/posts/{post_id}/heart", status_code=status.HTTP_204_NO_CONTENT)
async def remove_heart(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a heart (like) from a post.
    
    - **post_id**: ID of the post to unheart
    
    Returns 204 No Content on success, 404 if no heart exists.
    """
    try:
        # Find existing like
        like_result = await db.execute(
            select(Like).where(Like.user_id == current_user_id, Like.post_id == post_id)
        )
        like = like_result.scalar_one_or_none()
        
        if not like:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No heart found to remove"
            )
        
        await db.delete(like)
        await db.commit()
        
        logger.info(f"User {current_user_id} removed heart from post {post_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error removing heart: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove heart"
        )


@router.get("/posts/{post_id}/hearts")
async def get_post_hearts(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get heart count and current user's heart status for a post.
    
    - **post_id**: ID of the post to get heart info for
    
    Returns heart count and whether current user has hearted the post.
    """
    try:
        # Get total heart count
        from sqlalchemy import func
        count_result = await db.execute(
            select(func.count(Like.id)).where(Like.post_id == post_id)
        )
        hearts_count = count_result.scalar() or 0
        
        # Check if current user has hearted
        user_heart_result = await db.execute(
            select(Like).where(Like.user_id == current_user_id, Like.post_id == post_id)
        )
        is_hearted = user_heart_result.scalar_one_or_none() is not None
        
        return {
            "hearts_count": hearts_count,
            "is_hearted": is_hearted
        }
        
    except Exception as e:
        logger.error(f"Error getting post hearts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get heart information"
        )