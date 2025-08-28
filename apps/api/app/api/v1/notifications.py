"""
API endpoints for notifications.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.notification import Notification
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


class NotificationResponse(BaseModel):
    """Response model for notification data."""
    id: str
    type: str
    title: str
    message: str
    data: dict
    read: bool
    created_at: str
    last_updated_at: str | None = None
    post_id: str | None = None
    from_user: dict | None = None
    # Batching fields
    is_batch: bool = False
    batch_count: int = 1
    parent_id: str | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationSummary(BaseModel):
    """Summary of notifications for a user."""
    unread_count: int
    total_count: int


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


@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    current_user_id: int = Depends(get_current_user_id),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """
    Get notifications for the current user.
    
    - **limit**: Maximum number of notifications to return (1-100)
    - **offset**: Number of notifications to skip
    - **unread_only**: If true, only return unread notifications
    
    Returns a list of notifications with metadata.
    """
    try:
        notifications = await NotificationService.get_user_notifications(
            db=db,
            user_id=current_user_id,
            limit=limit,
            offset=offset,
            unread_only=unread_only
        )
        
        response_notifications = []
        for notification in notifications:
            # Extract post_id and from_user from data if available
            post_id = notification.data.get('post_id') if notification.data else None
            from_user = None
            
            if notification.data and 'reactor_username' in notification.data:
                from_user = {
                    'id': '0',  # We don't store user ID in notification data yet
                    'username': notification.data['reactor_username'],
                    'profile_image_url': None
                }
            elif notification.data and 'author_username' in notification.data:
                from_user = {
                    'id': '0',  # We don't store user ID in notification data yet
                    'username': notification.data['author_username'],
                    'profile_image_url': None
                }
            
            response_notifications.append(NotificationResponse(
                id=notification.id,
                type=notification.type,
                title=notification.title,
                message=notification.message,
                data=notification.data or {},
                read=notification.read,
                created_at=notification.created_at.isoformat(),
                last_updated_at=notification.last_updated_at.isoformat() if notification.last_updated_at else None,
                post_id=post_id,
                from_user=from_user,
                is_batch=notification.is_batch,
                batch_count=notification.batch_count,
                parent_id=notification.parent_id
            ))
        
        return response_notifications
        
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get notifications"
        )


@router.get("/notifications/summary", response_model=NotificationSummary)
async def get_notification_summary(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get notification summary for the current user.
    
    Returns unread count and total count.
    """
    try:
        unread_count = await NotificationService.get_unread_count(db=db, user_id=current_user_id)
        
        # Get total count by fetching all notifications (we can optimize this later)
        all_notifications = await NotificationService.get_user_notifications(
            db=db, 
            user_id=current_user_id, 
            limit=1000  # Large limit to get all
        )
        total_count = len(all_notifications)
        
        return NotificationSummary(
            unread_count=unread_count,
            total_count=total_count
        )
        
    except Exception as e:
        logger.error(f"Error getting notification summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get notification summary"
        )


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_notification_as_read(
    notification_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark a specific notification as read.
    
    - **notification_id**: ID of the notification to mark as read
    
    Returns success status.
    """
    try:
        success = await NotificationService.mark_as_read(
            db=db,
            notification_id=notification_id,
            user_id=current_user_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
            
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notification as read"
        )


@router.post("/notifications/read-all", status_code=status.HTTP_200_OK)
async def mark_all_notifications_as_read(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark all notifications as read for the current user.
    
    Returns the number of notifications marked as read.
    """
    try:
        count = await NotificationService.mark_all_as_read(
            db=db,
            user_id=current_user_id
        )
        
        return {"success": True, "marked_count": count}
        
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all notifications as read"
        )


@router.get("/notifications/{batch_id}/children", response_model=List[NotificationResponse])
async def get_batch_children(
    batch_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get child notifications for a batch notification.
    
    - **batch_id**: ID of the batch notification
    
    Returns a list of child notifications.
    """
    try:
        children = await NotificationService.get_batch_children(
            db=db,
            batch_id=batch_id,
            user_id=current_user_id
        )
        
        response_notifications = []
        for notification in children:
            # Extract post_id and from_user from data if available
            post_id = notification.data.get('post_id') if notification.data else None
            from_user = None
            
            if notification.data and 'reactor_username' in notification.data:
                from_user = {
                    'id': '0',  # We don't store user ID in notification data yet
                    'username': notification.data['reactor_username'],
                    'profile_image_url': None
                }
            elif notification.data and 'author_username' in notification.data:
                from_user = {
                    'id': '0',  # We don't store user ID in notification data yet
                    'username': notification.data['author_username'],
                    'profile_image_url': None
                }
            
            response_notifications.append(NotificationResponse(
                id=notification.id,
                type=notification.type,
                title=notification.title,
                message=notification.message,
                data=notification.data or {},
                read=notification.read,
                created_at=notification.created_at.isoformat(),
                last_updated_at=notification.last_updated_at.isoformat() if notification.last_updated_at else None,
                post_id=post_id,
                from_user=from_user,
                is_batch=notification.is_batch,
                batch_count=notification.batch_count,
                parent_id=notification.parent_id
            ))
        
        return response_notifications
        
    except Exception as e:
        logger.error(f"Error getting batch children: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get batch children"
        )


@router.get("/notifications/stats")
async def get_notification_stats(
    notification_type: str = Query(None, description="Filter by notification type"),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get notification statistics for the current user.
    
    - **notification_type**: Optional filter by notification type
    
    Returns statistics including counts by time period and rate limit info.
    """
    try:
        stats = await NotificationService.get_notification_stats(
            db=db,
            user_id=current_user_id,
            notification_type=notification_type
        )
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting notification stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get notification statistics"
        )