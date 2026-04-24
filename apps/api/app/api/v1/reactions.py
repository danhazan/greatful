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
    object_type: str = Field(default="post", description="Type of object being reacted to (post, image, comment)")
    object_id: str | None = Field(default=None, description="ID of specific object being reacted to")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=lambda s: ''.join(word.capitalize() if i > 0 else word for i, word in enumerate(s.split('_'))),
        json_schema_extra={
            "example": {
                "emojiCode": "heart_eyes"
            }
        }
    )

    @field_validator('emoji_code', mode='before')
    @classmethod
    def validate_emoji_code(cls, v):
        if not v or not isinstance(v, str):
            logger.warning("Invalid emoji payload rejected: null or empty", extra={"invalid_payload": v})
            raise ValueError("emoji_code must be a non-empty string")
            
        from app.models.emoji_reaction import EmojiReaction
        if not EmojiReaction.is_valid_emoji(v):
            valid_emojis = list(EmojiReaction.VALID_EMOJIS.keys())
            
            # Log structured error for invalid emoji code
            logger.warning(
                f"Invalid emoji code rejected: '{v}'",
                extra={"invalid_emoji_code": v, "expected_codes": valid_emojis}
            )
            
            raise ValueError(f'Invalid emoji code. Must be one of: {valid_emojis}')
        return v


class ReactionResponse(BaseModel):
    """Response model for reaction data."""
    id: str
    user_id: int
    post_id: str
    object_type: str = Field(default="post", alias="objectType")
    object_id: str | None = Field(default=None, alias="objectId")
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
    total_count: int = Field(alias="totalCount")
    emoji_counts: dict = Field(alias="emojiCounts")
    user_reaction: str | None = Field(default=None, alias="userReaction")  # Current user's reaction emoji_code

    model_config = ConfigDict(
        populate_by_name=True
    )





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
        emoji_code=reaction_request.emoji_code,
        object_type=reaction_request.object_type,
        object_id=reaction_request.object_id
    )
    
    return success_response(reaction_data, getattr(request.state, 'request_id', None))


@router.delete("/posts/{post_id}/reactions", status_code=204)
async def remove_reaction(
    post_id: str,
    request: Request,
    object_type: str = "post",
    object_id: str | None = None,
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
        post_id=post_id,
        object_type=object_type,
        object_id=object_id
    )
    
    if not removed:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Reaction")
        
    return success_response({"message": "Reaction removed"}, getattr(request.state, 'request_id', None))


@router.get("/posts/{post_id}/reactions")
async def get_post_reactions(
    post_id: str,
    request: Request,
    object_type: str = "post",
    object_id: str | None = None,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all reactions for a specific post or sub-object (image, comment).
    
    - **post_id**: ID of the primary post
    - **object_type**: Type of object ('post', 'image', 'comment')
    - **object_id**: Specific ID of the sub-object
    
    Returns a list of all reactions with user information.
    """
    reaction_service = ReactionService(db)
    reactions = await reaction_service.get_post_reactions(
        post_id=post_id,
        object_type=object_type,
        object_id=object_id
    )
    
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
    reaction_service = ReactionService(db)
    summary_data = await reaction_service.get_reaction_summary(post_id=post_id)
    
    # Get current user's reaction separately for the summary
    user_reaction = await reaction_service.get_user_reaction(
        user_id=current_user_id, 
        post_id=post_id
    )
    
    summary = ReactionSummary(
        total_count=summary_data["total_count"],
        emoji_counts=summary_data["emoji_counts"],
        user_reaction=user_reaction.emoji_code if user_reaction else None
    )
    
    return success_response(summary.model_dump(by_alias=True), getattr(request.state, 'request_id', None))

@router.get("/posts/{post_id}/image-reactions")
async def get_image_reactions(
    post_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all image reactions for a specific post.
    Returns a sparse mapping of image_id -> lightweight reaction summary.
    """
    reaction_service = ReactionService(db)
    # Fetch all reactions for 'image' type linked to this post
    # We use the raw list to aggregate both counts and current user's reaction in one pass
    reactions = await reaction_service.reaction_repo.get_post_reactions(
        post_id=post_id, 
        load_users=False, # We don't need user details for the summary
        object_type="image"
    )
    
    grouped = {}
    for r in reactions:
        obj_id = r.object_id
        if not obj_id: continue # Should not happen for image reactions
        
        if obj_id not in grouped:
            grouped[obj_id] = {
                "totalCount": 0,
                "emojiCounts": {},
                "userReaction": None
            }
        
        group = grouped[obj_id]
        group["totalCount"] += 1
        
        code = r.emoji_code
        group["emojiCounts"][code] = group["emojiCounts"].get(code, 0) + 1
        
        if r.user_id == current_user_id:
            group["userReaction"] = code
            
    return success_response(grouped, getattr(request.state, 'request_id', None))