"""
API endpoints for comments and replies.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.services.comment_service import CommentService
from app.core.responses import success_response
from app.core.exceptions import NotFoundError
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class CommentCreateRequest(BaseModel):
    """Request model for creating a comment."""
    content: str = Field(..., min_length=1, max_length=500, description="Comment content (1-500 characters)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content": "This is such an inspiring post! 😊"
            }
        }
    )

    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        """Validate content is not empty after stripping whitespace."""
        if not v.strip():
            raise ValueError('Content cannot be empty or only whitespace')
        return v.strip()


class ReplyCreateRequest(BaseModel):
    """Request model for creating a reply to a comment."""
    content: str = Field(..., min_length=1, max_length=500, description="Reply content (1-500 characters)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content": "Thank you for your kind words! 💜"
            }
        }
    )

    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        """Validate content is not empty after stripping whitespace."""
        if not v.strip():
            raise ValueError('Content cannot be empty or only whitespace')
        return v.strip()


class UserInfo(BaseModel):
    """User information embedded in comment responses."""
    id: int
    username: str
    display_name: Optional[str] = None
    profile_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CommentResponse(BaseModel):
    """Response model for comment data."""
    id: str
    post_id: str
    user_id: int
    content: str
    parent_comment_id: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    edited_at: Optional[str] = None  # Timestamp of when the comment was edited by user
    user: UserInfo
    is_reply: bool = Field(default=False, description="Whether this is a reply to another comment")
    reply_count: int = Field(default=0, description="Number of replies to this comment")

    model_config = ConfigDict(from_attributes=True)


class CommentUpdateRequest(BaseModel):
    """Request model for updating/editing a comment."""
    content: str = Field(..., min_length=1, max_length=500, description="Updated comment content (1-500 characters)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content": "This is my updated comment! 📝"
            }
        }
    )

    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        """Validate content is not empty after stripping whitespace."""
        if not v.strip():
            raise ValueError('Content cannot be empty or only whitespace')
        return v.strip()


@router.post("/posts/{post_id}/comments", status_code=201)
async def create_comment(
    post_id: str,
    comment_request: CommentCreateRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new comment on a post.
    
    - **post_id**: ID of the post to comment on
    - **content**: Comment content (1-500 characters, supports emojis)
    
    Returns the created comment with user information.
    """
    comment_service = CommentService(db)
    comment_data = await comment_service.create_comment(
        post_id=post_id,
        user_id=current_user_id,
        content=comment_request.content
    )
    
    # Add is_reply flag
    comment_data['is_reply'] = False
    comment_data['reply_count'] = 0
    
    logger.info(
        f"Created comment on post {post_id} by user {current_user_id}",
        extra={"post_id": post_id, "user_id": current_user_id}
    )
    
    return success_response(comment_data, getattr(request.state, 'request_id', None))


@router.post("/comments/{comment_id}/replies", status_code=201)
async def create_reply(
    comment_id: str,
    reply_request: ReplyCreateRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a reply to an existing comment.
    
    - **comment_id**: ID of the comment to reply to
    - **content**: Reply content (1-500 characters, supports emojis)
    
    Returns the created reply with user information.
    Note: Only single-level nesting is allowed (cannot reply to a reply).
    """
    comment_service = CommentService(db)
    
    # Get the parent comment to extract post_id
    from app.models.comment import Comment
    parent_comment = await comment_service.get_by_id_or_404(Comment, comment_id, "Comment")
    
    reply_data = await comment_service.create_comment(
        post_id=parent_comment.post_id,
        user_id=current_user_id,
        content=reply_request.content,
        parent_comment_id=comment_id
    )
    
    # Add is_reply flag
    reply_data['is_reply'] = True
    reply_data['reply_count'] = 0
    
    logger.info(
        f"Created reply to comment {comment_id} by user {current_user_id}",
        extra={"comment_id": comment_id, "user_id": current_user_id}
    )
    
    return success_response(reply_data, getattr(request.state, 'request_id', None))


@router.get("/posts/{post_id}/comments")
async def get_post_comments(
    post_id: str,
    request: Request,
    include_replies: bool = Query(False, description="Whether to include replies (default: False for performance)"),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all top-level comments for a post.
    
    - **post_id**: ID of the post to get comments for
    - **include_replies**: Whether to include replies (default: False for performance optimization)
    
    Returns a list of comments with user information.
    By default, replies are NOT included and should be fetched separately via /comments/{comment_id}/replies.
    """
    comment_service = CommentService(db)
    
    # Get comments (without replies by default for performance)
    comments = await comment_service.get_post_comments(
        post_id=post_id,
        include_replies=include_replies
    )
    
    # Add reply_count and is_reply flags to each comment
    from sqlalchemy import select, func
    from app.models.comment import Comment
    
    for comment in comments:
        # Count replies for this comment
        reply_count_query = select(func.count(Comment.id)).where(
            Comment.parent_comment_id == comment['id']
        )
        result = await db.execute(reply_count_query)
        reply_count = result.scalar() or 0
        
        comment['reply_count'] = reply_count
        comment['is_reply'] = False
    
    logger.info(
        f"Retrieved {len(comments)} comments for post {post_id}",
        extra={"post_id": post_id, "comment_count": len(comments)}
    )
    
    return success_response(comments, getattr(request.state, 'request_id', None))


@router.get("/comments/{comment_id}/replies")
async def get_comment_replies(
    comment_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all replies for a specific comment.
    
    - **comment_id**: ID of the comment to get replies for
    
    Returns a list of replies with user information.
    This endpoint is called when the user clicks "X replies" to expand a comment.
    """
    comment_service = CommentService(db)
    
    # Verify the parent comment exists
    from app.models.comment import Comment
    await comment_service.get_by_id_or_404(Comment, comment_id, "Comment")
    
    # Get replies
    replies = await comment_service.get_comment_replies(comment_id)

    # Add is_reply flag to each reply (can_delete is included from service)
    for reply in replies:
        reply['is_reply'] = True

    logger.info(
        f"Retrieved {len(replies)} replies for comment {comment_id}",
        extra={"comment_id": comment_id, "reply_count": len(replies)}
    )
    
    return success_response(replies, getattr(request.state, 'request_id', None))


@router.put("/comments/{comment_id}", status_code=200)
async def update_comment(
    comment_id: str,
    update_request: CommentUpdateRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Edit/update a comment (owner only).

    - **comment_id**: ID of the comment to edit
    - **content**: New comment content (1-500 characters)

    Returns the updated comment with user information.
    Only the comment owner can edit their comment.
    Sets the edited_at timestamp to indicate the comment was modified.
    """
    comment_service = CommentService(db)

    updated_comment = await comment_service.edit_comment(
        comment_id=comment_id,
        user_id=current_user_id,
        content=update_request.content
    )

    logger.info(
        f"Updated comment {comment_id} by user {current_user_id}",
        extra={"comment_id": comment_id, "user_id": current_user_id}
    )

    return success_response(updated_comment, getattr(request.state, 'request_id', None))


@router.delete("/comments/{comment_id}", status_code=200)
async def delete_comment(
    comment_id: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a comment (owner only).

    - **comment_id**: ID of the comment to delete

    Returns success message on deletion.
    Only the comment owner can delete their comment.

    **Important**:
    - Deleting a top-level comment also deletes its direct replies.
    - For replies, only the chronologically last reply in a thread can be deleted.
    """
    comment_service = CommentService(db)

    deleted = await comment_service.delete_comment(
        comment_id=comment_id,
        user_id=current_user_id
    )

    if not deleted:
        raise NotFoundError("Comment", comment_id)

    logger.info(
        f"Deleted comment {comment_id} by user {current_user_id}",
        extra={"comment_id": comment_id, "user_id": current_user_id}
    )

    return success_response(
        {"message": "Comment deleted successfully"},
        getattr(request.state, 'request_id', None)
    )
