"""
Follow API endpoints for user follow/unfollow functionality.
"""

import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.core.responses import success_response, error_response
from app.core.exceptions import NotFoundError, ConflictError, ValidationException, PermissionDeniedError
from app.services.follow_service import FollowService
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class BatchFollowStatusRequest(BaseModel):
    """Batch follow status request model."""
    user_ids: List[int]


@router.post("/follows/batch-status", status_code=200)
async def get_batch_follow_status(
    batch_request: BatchFollowStatusRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get follow status for multiple users in a single request.
    
    - **user_ids**: List of user IDs to check follow status with (max 50)
    
    Returns a dict mapping user_id to follow status information.
    This prevents N+1 API calls when loading feed pages.
    """
    try:
        # Validate input
        if not batch_request.user_ids:
            return success_response({}, getattr(request.state, 'request_id', None))
        
        # Limit to 50 users to prevent abuse
        user_ids = batch_request.user_ids[:50]
        
        # Remove duplicates while preserving order
        unique_user_ids = list(dict.fromkeys(user_ids))
        
        follow_service = FollowService(db)
        
        # Get batch follow status
        status_map = await follow_service.bulk_check_following(
            follower_id=current_user_id,
            user_ids=unique_user_ids
        )
        
        logger.info(f"Batch checked follow status for {len(unique_user_ids)} users")
        
        return success_response(
            status_map,
            getattr(request.state, 'request_id', None)
        )
        
    except Exception:
        logger.exception(
            "Unexpected error in get_batch_follow_status",
            extra={
                "follower_id": current_user_id
            }
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/follows/{user_id}", status_code=201)
async def follow_user(
    user_id: int,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Follow a user.
    
    - **user_id**: ID of the user to follow
    
    Creates a follow relationship between the current user and the target user.
    Prevents self-following and duplicate follows.
    """
    try:
        follow_service = FollowService(db)
        
        # Follow the user
        follow_data = await follow_service.follow_user(
            follower_id=current_user_id,
            followed_id=user_id
        )
        
        logger.info(
            f"User {current_user_id} followed user {user_id}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
        return success_response(
            follow_data, 
            getattr(request.state, 'request_id', None)
        )
        
    except ValidationException as e:
        logger.warning(
            f"Follow validation failed: {e.detail}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=422, detail=e.detail)
        
    except ConflictError as e:
        logger.warning(
            f"Follow conflict: {e.detail}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=409, detail=e.detail)
        
    except NotFoundError as e:
        logger.warning(
            f"User not found for follow: {e.detail}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=404, detail=e.detail)
        
    except PermissionDeniedError as e:
        logger.warning(
            f"Follow permission denied: {e.detail}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=403, detail=e.detail)
        
    except Exception as e:
        logger.error(
            f"Unexpected error in follow_user: {str(e)}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/follows/{user_id}", status_code=200)
async def unfollow_user(
    user_id: int,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Unfollow a user.
    
    - **user_id**: ID of the user to unfollow
    
    Removes the follow relationship between the current user and the target user.
    """
    try:
        follow_service = FollowService(db)
        
        # Unfollow the user
        success = await follow_service.unfollow_user(
            follower_id=current_user_id,
            followed_id=user_id
        )
        
        logger.info(
            f"User {current_user_id} unfollowed user {user_id}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
        return success_response(
            {"success": success, "message": "Successfully unfollowed user"}, 
            getattr(request.state, 'request_id', None)
        )
        
    except NotFoundError as e:
        logger.warning(
            f"Follow relationship not found for unfollow: {e.detail}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=404, detail=e.detail)
        
    except Exception as e:
        logger.error(
            f"Unexpected error in unfollow_user: {str(e)}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")




@router.get("/follows/{user_id}/status", status_code=200)
async def get_follow_status(
    user_id: int,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get follow status between current user and target user.
    
    - **user_id**: ID of the user to check follow status with
    
    Returns detailed follow status information including mutual follows.
    """
    try:
        follow_service = FollowService(db)
        
        # Get follow status
        status = await follow_service.get_follow_status(
            follower_id=current_user_id,
            followed_id=user_id
        )
        
        return success_response(
            status, 
            getattr(request.state, 'request_id', None)
        )
        
    except Exception as e:
        logger.error(
            f"Unexpected error in get_follow_status: {str(e)}",
            extra={
                "follower_id": current_user_id,
                "followed_id": user_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/users/{user_id}/followers", status_code=200)
async def get_user_followers(
    user_id: int,
    request: Request,
    limit: int = Query(50, ge=1, le=100, description="Number of followers to return"),
    offset: int = Query(0, ge=0, description="Number of followers to skip"),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get followers for a specific user.
    
    - **user_id**: ID of the user whose followers to retrieve
    - **limit**: Maximum number of followers (1-100, default: 50)
    - **offset**: Number of followers to skip for pagination (default: 0)
    
    Returns paginated list of followers with follow status relative to current user.
    """
    try:
        follow_service = FollowService(db)
        
        # Get followers
        followers_data = await follow_service.get_followers(
            user_id=user_id,
            current_user_id=current_user_id,
            limit=limit,
            offset=offset
        )
        
        return success_response(
            followers_data, 
            getattr(request.state, 'request_id', None)
        )
        
    except NotFoundError as e:
        logger.warning(
            f"User not found for followers: {e.detail}",
            extra={
                "user_id": user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=404, detail=e.detail)
        
    except Exception as e:
        logger.error(
            f"Unexpected error in get_user_followers: {str(e)}",
            extra={
                "user_id": user_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/users/{user_id}/following", status_code=200)
async def get_user_following(
    user_id: int,
    request: Request,
    limit: int = Query(50, ge=1, le=100, description="Number of following to return"),
    offset: int = Query(0, ge=0, description="Number of following to skip"),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get users that the specified user is following.
    
    - **user_id**: ID of the user whose following list to retrieve
    - **limit**: Maximum number of following (1-100, default: 50)
    - **offset**: Number of following to skip for pagination (default: 0)
    
    Returns paginated list of users being followed with follow status relative to current user.
    """
    try:
        follow_service = FollowService(db)
        
        # Get following
        following_data = await follow_service.get_following(
            user_id=user_id,
            current_user_id=current_user_id,
            limit=limit,
            offset=offset
        )
        
        return success_response(
            following_data, 
            getattr(request.state, 'request_id', None)
        )
        
    except NotFoundError as e:
        logger.warning(
            f"User not found for following: {e.detail}",
            extra={
                "user_id": user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=404, detail=e.detail)
        
    except Exception as e:
        logger.error(
            f"Unexpected error in get_user_following: {str(e)}",
            extra={
                "user_id": user_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/users/{user_id}/follow-stats", status_code=200)
async def get_user_follow_stats(
    user_id: int,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get follow statistics for a user.
    
    - **user_id**: ID of the user whose stats to retrieve
    
    Returns comprehensive follow statistics including followers, following, and pending counts.
    """
    try:
        follow_service = FollowService(db)
        
        # Get follow stats
        stats = await follow_service.get_follow_stats(user_id)
        
        return success_response(
            stats, 
            getattr(request.state, 'request_id', None)
        )
        
    except NotFoundError as e:
        logger.warning(
            f"User not found for follow stats: {e.detail}",
            extra={
                "user_id": user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=404, detail=e.detail)
        
    except Exception as e:
        logger.error(
            f"Unexpected error in get_user_follow_stats: {str(e)}",
            extra={
                "user_id": user_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/follows/suggestions", status_code=200)
async def get_follow_suggestions(
    request: Request,
    limit: int = Query(10, ge=1, le=20, description="Number of suggestions to return"),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get follow suggestions for the current user.
    
    - **limit**: Maximum number of suggestions (1-20, default: 10)
    
    Returns list of suggested users to follow based on mutual connections.
    """
    try:
        follow_service = FollowService(db)
        
        # Get follow suggestions
        suggestions = await follow_service.get_follow_suggestions(
            user_id=current_user_id,
            limit=limit
        )
        
        return success_response(
            {"suggestions": suggestions}, 
            getattr(request.state, 'request_id', None)
        )
        
    except NotFoundError as e:
        logger.warning(
            f"User not found for follow suggestions: {e.detail}",
            extra={
                "user_id": current_user_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=404, detail=e.detail)
        
    except Exception as e:
        logger.error(
            f"Unexpected error in get_follow_suggestions: {str(e)}",
            extra={
                "user_id": current_user_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal server error")