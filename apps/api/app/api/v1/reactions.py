"""
API endpoints for emoji reactions.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.core.database import get_db
from app.services.reaction_service import ReactionService
from app.models.emoji_reaction import EmojiReaction
from app.core.security import decode_token
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


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
        valid_emojis = ['heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap']
        if v not in valid_emojis:
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
        valid_emojis = ['heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap']
        if v not in valid_emojis:
            raise ValueError(f'Invalid emoji code. Must be one of: {valid_emojis}')
        return v


class ReactionSummary(BaseModel):
    """Summary of reactions for a post."""
    total_count: int
    emoji_counts: dict
    user_reaction: str | None = None  # Current user's reaction emoji_code


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


@router.post("/posts/{post_id}/reactions", response_model=ReactionResponse, status_code=status.HTTP_201_CREATED)
async def add_reaction(
    post_id: str,
    reaction_request: ReactionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Add or update an emoji reaction to a post.
    
    - **post_id**: ID of the post to react to
    - **emoji_code**: Code for the emoji reaction
    
    Returns the created or updated reaction.
    """
    try:
        reaction = await ReactionService.add_reaction(
            db=db,
            user_id=current_user_id,
            post_id=post_id,
            emoji_code=reaction_request.emoji_code
        )
        
        # Create response data and validate with Pydantic
        response_data = {
            "id": reaction.id,
            "user_id": reaction.user_id,
            "post_id": reaction.post_id,
            "emoji_code": reaction.emoji_code,
            "emoji_display": reaction.emoji_display,
            "created_at": reaction.created_at.isoformat(),
            "user": {
                "id": reaction.user.id,
                "username": reaction.user.username,
                "email": reaction.user.email
            }
        }
        
        # Validate response structure at runtime
        return ReactionResponse(**response_data)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error adding reaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add reaction"
        )


@router.delete("/posts/{post_id}/reactions", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reaction(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove the current user's reaction from a post.
    
    - **post_id**: ID of the post to remove reaction from
    
    Returns 204 No Content on success, 404 if no reaction exists.
    """
    try:
        removed = await ReactionService.remove_reaction(
            db=db,
            user_id=current_user_id,
            post_id=post_id
        )
        
        if not removed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No reaction found to remove"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing reaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove reaction"
        )


@router.get("/posts/{post_id}/reactions", response_model=List[ReactionResponse])
async def get_post_reactions(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all reactions for a specific post.
    
    - **post_id**: ID of the post to get reactions for
    
    Returns a list of all reactions with user information.
    """
    try:
        reactions = await ReactionService.get_post_reactions(db=db, post_id=post_id)
        
        return [
            ReactionResponse(
                id=reaction.id,
                user_id=reaction.user_id,
                post_id=reaction.post_id,
                emoji_code=reaction.emoji_code,
                emoji_display=reaction.emoji_display,
                created_at=reaction.created_at.isoformat(),
                user={
                    "id": reaction.user.id,
                    "username": reaction.user.username,
                    "email": reaction.user.email
                }
            )
            for reaction in reactions
        ]
        
    except Exception as e:
        logger.error(f"Error getting post reactions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get reactions"
        )


@router.get("/posts/{post_id}/reactions/summary", response_model=ReactionSummary)
async def get_reaction_summary(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get reaction summary for a post including counts and current user's reaction.
    
    - **post_id**: ID of the post to get reaction summary for
    
    Returns total count, emoji counts, and current user's reaction.
    """
    try:
        # Get total count and emoji counts
        total_count = await ReactionService.get_total_reaction_count(db=db, post_id=post_id)
        emoji_counts = await ReactionService.get_reaction_counts(db=db, post_id=post_id)
        
        # Get current user's reaction
        user_reaction = await ReactionService.get_user_reaction(
            db=db, 
            user_id=current_user_id, 
            post_id=post_id
        )
        
        return ReactionSummary(
            total_count=total_count,
            emoji_counts=emoji_counts,
            user_reaction=user_reaction.emoji_code if user_reaction else None
        )
        
    except Exception as e:
        logger.error(f"Error getting reaction summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get reaction summary"
        )