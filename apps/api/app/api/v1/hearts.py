"""
Hearts API endpoints - wrapper around reactions system for heart emoji.
"""

from typing import List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.services.reaction_service import ReactionService
from app.core.responses import success_response
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/posts/{post_id}/heart", status_code=201)
async def add_heart(
    post_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a heart (like) to a post.
    
    This is a convenience endpoint that adds an emoji reaction with emoji_code 'heart'.
    
    - **post_id**: ID of the post to heart
    
    Returns the created heart reaction.
    """
    reaction_service = ReactionService(db)
    reaction_data = await reaction_service.add_reaction(
        user_id=current_user_id,
        post_id=post_id,
        emoji_code="heart"
    )
    
    return success_response(reaction_data, getattr(request.state, 'request_id', None))


@router.delete("/posts/{post_id}/heart", status_code=204)
async def remove_heart(
    post_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a heart (like) from a post.
    
    This removes the user's heart emoji reaction from the post.
    
    - **post_id**: ID of the post to remove heart from
    
    Returns 204 No Content on success, 404 if no heart exists.
    """
    reaction_service = ReactionService(db)
    removed = await reaction_service.remove_reaction(
        user_id=current_user_id,
        post_id=post_id
    )
    
    if not removed:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Heart")
        
    return success_response({"message": "Heart removed"}, getattr(request.state, 'request_id', None))


@router.get("/posts/{post_id}/hearts")
async def get_heart_info(
    post_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get heart information for a post.
    
    Returns heart count and whether the current user has hearted the post.
    
    - **post_id**: ID of the post to get heart info for
    
    Returns heart count and user's heart status.
    """
    reaction_service = ReactionService(db)
    
    # Get heart count (reactions with emoji_code 'heart')
    reaction_counts = await reaction_service.get_reaction_counts(post_id=post_id)
    heart_count = reaction_counts.get("heart", 0)
    
    # Get current user's heart status
    user_reaction = await reaction_service.get_user_reaction(
        user_id=current_user_id, 
        post_id=post_id
    )
    
    has_hearted = user_reaction is not None and user_reaction.emoji_code == "heart"
    
    heart_info = {
        "heart_count": heart_count,
        "has_hearted": has_hearted
    }
    
    return success_response(heart_info, getattr(request.state, 'request_id', None))


@router.get("/posts/{post_id}/hearts/users")
async def get_hearts_users(
    post_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all users who hearted a specific post.
    
    - **post_id**: ID of the post to get heart users for
    
    Returns a list of users who hearted the post.
    """
    reaction_service = ReactionService(db)
    
    # Get all heart reactions for this post
    all_reactions = await reaction_service.get_post_reactions(post_id=post_id)
    
    # Filter for heart reactions only
    heart_reactions = [r for r in all_reactions if r.get('emoji_code') == 'heart']
    
    return success_response(heart_reactions, getattr(request.state, 'request_id', None))