"""
API endpoints for heart reactions (likes).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models.like import Like
from app.models.post import Post
from app.models.user import User
from app.core.security import decode_token
from app.core.notification_factory import NotificationFactory
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


@router.post("/posts/{post_id}/heart", status_code=status.HTTP_201_CREATED)
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
        
        # Create notification for post author (if not liking own post) using factory
        post_result = await db.execute(select(Post).where(Post.id == post_id))
        post = post_result.scalar_one_or_none()
        if post and post.author_id != current_user_id:
            try:
                notification_factory = NotificationFactory(db)
                await notification_factory.create_like_notification(
                    post_author_id=post.author_id,
                    liker_username=user.username,
                    liker_id=current_user_id,
                    post_id=post_id
                )
            except Exception as e:
                logger.error(f"Failed to create like notification: {e}")
                # Don't fail the like if notification fails
        
        logger.info(f"User {current_user_id} hearted post {post_id}")
        
        # Get updated heart count and status
        from sqlalchemy import func
        
        # Count total hearts for this post
        hearts_count_result = await db.execute(
            select(func.count(Like.id)).where(Like.post_id == post_id)
        )
        hearts_count = hearts_count_result.scalar() or 0
        
        # Check if current user has hearted this post
        user_heart_result = await db.execute(
            select(Like).where(Like.user_id == current_user_id, Like.post_id == post_id)
        )
        is_hearted = user_heart_result.scalar_one_or_none() is not None
        
        return {
            "hearts_count": hearts_count,
            "is_hearted": is_hearted,
            "post_id": post_id
        }
        
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


@router.delete("/posts/{post_id}/heart", status_code=status.HTTP_200_OK)
async def remove_heart(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a heart (like) from a post.
    
    - **post_id**: ID of the post to unheart
    
    Returns updated post heart data.
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
        
        # Get updated heart count and status
        from sqlalchemy import func
        
        # Count total hearts for this post
        hearts_count_result = await db.execute(
            select(func.count(Like.id)).where(Like.post_id == post_id)
        )
        hearts_count = hearts_count_result.scalar() or 0
        
        # Check if current user has hearted this post (should be False after deletion)
        user_heart_result = await db.execute(
            select(Like).where(Like.user_id == current_user_id, Like.post_id == post_id)
        )
        is_hearted = user_heart_result.scalar_one_or_none() is not None
        
        return {
            "hearts_count": hearts_count,
            "is_hearted": is_hearted,
            "post_id": post_id
        }
        
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


@router.get("/posts/{post_id}/hearts/users")
async def get_post_hearts_users(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of users who hearted a post.
    
    - **post_id**: ID of the post to get hearts for
    
    Returns a list of users who hearted the post with their information and timestamp.
    """
    try:
        # Get all hearts for the post with user information
        from sqlalchemy.orm import selectinload
        hearts_result = await db.execute(
            select(Like)
            .options(selectinload(Like.user))
            .where(Like.post_id == post_id)
            .order_by(Like.created_at.desc())
        )
        hearts = hearts_result.scalars().all()
        
        return [
            {
                "id": heart.id,
                "userId": str(heart.user_id),
                "userName": heart.user.username,
                "userImage": heart.user.profile_image_url,
                "createdAt": heart.created_at.isoformat()
            }
            for heart in hearts
        ]
        
    except Exception as e:
        logger.error(f"Error getting post hearts users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get hearts users"
        )