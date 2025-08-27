"""
API endpoints for emoji reactions.
"""

from typing import List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.services.reaction_service import ReactionService
from app.models.emoji_reaction import EmojiReaction
from app.core.responses import success_response
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class ReactionRequest(BaseModel):
    """Request model for adding/updating reactions."""
    emoji_code: str = Field(..., description="Emoji code (e.g., 'heart_eyes', 'pray')")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "emoji_code": "heart_eyes"
            }
        }
    )

    @field_validator('emoji_code')
    @classmethod
    def validate_emoji_code(cls, v):
        from app.models.emoji_reaction import EmojiReaction
        if not EmojiReaction.is_valid_emoji(v):
            valid_emojis = list(EmojiReaction.VALID_EMOJIS.keys())
            raise ValueError(f'Invalid emoji code. Must be one of: {valid_emojis}')
        return v


class ReactionResponse(BaseModel):
    """Response model for reaction data."""
    id: str
    user_id: int
    post_id: str
    emoji_code: str
    emoji_display: str
    created_at: str
    user: dict = Field(..., description="User information")

    model_config = ConfigDict(from_attributes=True)

    @field_validator('emoji_code')
    @classmethod
    def validate_emoji_code(cls, v):
        from app.models.emoji_reaction import EmojiReaction
        if not EmojiReaction.is_valid_emoji(v):
            valid_emojis = list(EmojiReaction.VALID_EMOJIS.keys())
            raise ValueError(f'Invalid emoji code. Must be one of: {valid_emojis}')
        return v


class ReactionSummary(BaseModel):
    """Summary of reactions for a post."""
    total_count: int
    emoji_counts: dict
    user_reaction: str | None = None  # Current user's reaction emoji_code





@router.post("/posts/{post_id}/reactions", status_code=201)
async def add_reaction(
    post_id: str,
    reaction_request: ReactionRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Add or update an emoji reaction to a post.
    
    - **post_id**: ID of the post to react to
    - **emoji_code**: Code for the emoji reaction
    
    Returns the created or updated reaction.
    """
    reaction_service = ReactionService(db)
    reaction_data = await reaction_service.add_reaction(
        user_id=current_user_id,
        post_id=post_id,
        emoji_code=reaction_request.emoji_code
    )
    
    return success_response(reaction_data, getattr(request.state, 'request_id', None))


@router.delete("/posts/{post_id}/reactions", status_code=204)
async def remove_reaction(
    post_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove the current user's reaction from a post.
    
    - **post_id**: ID of the post to remove reaction from
    
    Returns 204 No Content on success, 404 if no reaction exists.
    """
    reaction_service = ReactionService(db)
    removed = await reaction_service.remove_reaction(
        user_id=current_user_id,
        post_id=post_id
    )
    
    if not removed:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Reaction")
        
    return success_response({"message": "Reaction removed"}, getattr(request.state, 'request_id', None))


@router.get("/posts/{post_id}/reactions")
async def get_post_reactions(
    post_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all reactions for a specific post.
    
    - **post_id**: ID of the post to get reactions for
    
    Returns a list of all reactions with user information.
    """
    reaction_service = ReactionService(db)
    reactions = await reaction_service.get_post_reactions(post_id=post_id)
    
    return success_response(reactions, getattr(request.state, 'request_id', None))


@router.get("/posts/{post_id}/reactions/summary")
async def get_reaction_summary(
    post_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get reaction summary for a post including counts and current user's reaction.
    
    - **post_id**: ID of the post to get reaction summary for
    
    Returns total count, emoji counts, and current user's reaction.
    """
    # Get total count and emoji counts
    reaction_service = ReactionService(db)
    total_count = await reaction_service.get_total_reaction_count(post_id=post_id)
    emoji_counts = await reaction_service.get_reaction_counts(post_id=post_id)
    
    # Get current user's reaction
    user_reaction = await reaction_service.get_user_reaction(
        user_id=current_user_id, 
        post_id=post_id
    )
    
    summary = {
        "total_count": total_count,
        "emoji_counts": emoji_counts,
        "user_reaction": user_reaction.emoji_code if user_reaction else None
    }
    
    return success_response(summary, getattr(request.state, 'request_id', None))