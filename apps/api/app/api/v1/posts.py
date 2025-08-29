"""
Posts API endpoints.
"""

import logging
import uuid
import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_token
from app.models.post import Post, PostType
from app.models.user import User
from app.services.share_service import ShareService
from app.services.mention_service import MentionService
from app.services.algorithm_service import AlgorithmService

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


class PostCreate(BaseModel):
    """Post creation request model."""
    content: str = Field(..., min_length=1)
    post_type: str = Field(..., description="Post type: daily, photo, or spontaneous")
    title: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = None
    location: Optional[str] = Field(None, max_length=100)
    is_public: bool = True

    @field_validator('post_type')
    @classmethod
    def validate_post_type(cls, v):
        valid_types = ['daily', 'photo', 'spontaneous']
        if v not in valid_types:
            raise ValueError(f'Invalid post type. Must be one of: {valid_types}')
        return v

    @model_validator(mode='after')
    def validate_content_length(self):
        # Define max lengths based on post type
        max_lengths = {
            'daily': 500,
            'photo': 300,
            'spontaneous': 200
        }
        
        if self.post_type in max_lengths:
            max_length = max_lengths[self.post_type]
            if len(self.content) > max_length:
                raise ValueError(f'Content too long. Maximum {max_length} characters for {self.post_type} posts')
        
        return self


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
    is_hearted: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)

    @field_validator('post_type')
    @classmethod
    def validate_post_type(cls, v):
        valid_types = ['daily', 'photo', 'spontaneous']
        if v not in valid_types:
            raise ValueError(f'Invalid post type. Must be one of: {valid_types}')
        return v

    @field_validator('current_user_reaction')
    @classmethod
    def validate_emoji_code(cls, v):
        if v is None:
            return v
        valid_emojis = ['heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap']
        if v not in valid_emojis:
            raise ValueError(f'Invalid emoji code. Must be one of: {valid_emojis}')
        return v


class ShareRequest(BaseModel):
    """Share request model."""
    share_method: str = Field(..., description="Share method: 'url' or 'message'")
    recipient_ids: Optional[List[int]] = Field(None, description="User IDs for message sharing (max 5)")
    message: Optional[str] = Field(None, max_length=200, description="Optional message for sharing")

    @field_validator('share_method')
    @classmethod
    def validate_share_method(cls, v):
        valid_methods = ['url', 'message']
        if v not in valid_methods:
            raise ValueError(f'Invalid share method. Must be one of: {valid_methods}')
        return v

    @field_validator('recipient_ids')
    @classmethod
    def validate_recipient_ids(cls, v, info):
        if info.data.get('share_method') == 'message':
            if not v:
                raise ValueError('recipient_ids is required for message sharing')
            if len(v) > 5:
                raise ValueError('Maximum 5 recipients allowed per share')
        return v


class ShareResponse(BaseModel):
    """Share response model."""
    id: str
    user_id: int
    post_id: str
    share_method: str
    share_url: Optional[str] = None
    recipient_count: Optional[int] = None
    message_content: Optional[str] = None
    created_at: str

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


async def get_optional_user_id(request: Request) -> Optional[int]:
    """Extract user ID from JWT token if present, otherwise return None."""
    try:
        auth_header = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        return user_id
    except Exception:
        return None


# Removed old create_post function - replaced with create_post_with_file below


def _save_uploaded_file(file: UploadFile) -> str:
    """Save uploaded file and return the URL path."""
    try:
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads/posts")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix if file.filename else '.jpg'
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save the file
        with open(file_path, "wb") as buffer:
            content = file.file.read()
            buffer.write(content)
        
        # Return the URL path (relative to the server)
        return f"/uploads/posts/{unique_filename}"
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file"
        )


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_json(
    post_data: PostCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Create a new gratitude post (JSON only)."""
    try:
        # Get user to verify they exist
        user = await User.get_by_id(db, current_user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Create post directly
        db_post = Post(
            id=str(uuid.uuid4()),
            author_id=current_user_id,
            title=post_data.title,
            content=post_data.content,
            post_type=PostType(post_data.post_type),
            image_url=post_data.image_url,
            location=post_data.location,
            is_public=post_data.is_public
        )
        
        db.add(db_post)
        await db.commit()
        await db.refresh(db_post)
        
        # Process mentions in the post content
        try:
            mention_service = MentionService(db)
            await mention_service.create_mentions(
                post_id=db_post.id,
                author_id=current_user_id,
                content=post_data.content
            )
        except Exception as e:
            logger.error(f"Error processing mentions for post {db_post.id}: {e}")
            # Don't fail post creation if mention processing fails
        
        # Format response
        return PostResponse(
            id=db_post.id,
            author_id=db_post.author_id,
            title=db_post.title,
            content=db_post.content,
            post_type=db_post.post_type.value,
            image_url=db_post.image_url,
            location=db_post.location,
            is_public=db_post.is_public,
            created_at=db_post.created_at.isoformat(),
            updated_at=db_post.updated_at.isoformat() if db_post.updated_at else None,
            author={
                "id": user.id,
                "username": user.username,
                "email": user.email
            },
            hearts_count=0,
            reactions_count=0,
            current_user_reaction=None,
            is_hearted=False
        )

    except Exception as e:
        logger.error(f"Error creating post: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create post"
        )


@router.post("/upload", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_with_file(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    # FormData parameters
    content: str = Form(...),
    post_type: str = Form(...),
    title: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None)
):
    """Create a new gratitude post with optional file upload."""
    try:
        # Create PostCreate object and validate it
        post_data_dict = {
            "content": content,
            "post_type": post_type,
            "title": title,
            "location": location,
            "is_public": True
        }
        
        # This will trigger Pydantic validation and raise 422 if invalid
        post_data = PostCreate(**post_data_dict)

        # Get user to verify they exist
        user = await User.get_by_id(db, current_user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Handle image upload if provided
        image_url = None
        if image and image.filename:
            # Validate file type
            allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
            file_extension = Path(image.filename).suffix.lower()
            if file_extension not in allowed_extensions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
                )
            
            # Validate file size (max 5MB)
            max_size = 5 * 1024 * 1024  # 5MB
            if image.size and image.size > max_size:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File too large. Maximum size is 5MB"
                )
            
            image_url = _save_uploaded_file(image)

        # Create post
        db_post = Post(
            id=str(uuid.uuid4()),
            author_id=current_user_id,
            title=post_data.title,
            content=post_data.content,
            post_type=PostType(post_data.post_type),
            image_url=image_url,
            location=post_data.location,
            is_public=post_data.is_public
        )

        db.add(db_post)
        await db.commit()
        await db.refresh(db_post)

        # Process mentions in the post content
        try:
            mention_service = MentionService(db)
            await mention_service.create_mentions(
                post_id=db_post.id,
                author_id=current_user_id,
                content=post_data.content
            )
        except Exception as e:
            logger.error(f"Error processing mentions for post {db_post.id}: {e}")
            # Don't fail post creation if mention processing fails

        # Format response
        return PostResponse(
            id=db_post.id,
            author_id=db_post.author_id,
            title=db_post.title,
            content=db_post.content,
            post_type=db_post.post_type.value,
            image_url=db_post.image_url,
            location=db_post.location,
            is_public=db_post.is_public,
            created_at=db_post.created_at.isoformat(),
            updated_at=db_post.updated_at.isoformat() if db_post.updated_at else None,
            author={
                "id": user.id,
                "username": user.username,
                "email": user.email
            },
            hearts_count=0,
            reactions_count=0,
            current_user_reaction=None,
            is_hearted=False
        )

    except Exception as e:
        logger.error(f"Error creating post with file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create post"
        )


@router.get("/feed", response_model=List[PostResponse])
async def get_feed(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
    algorithm: bool = True
):
    """
    Get user's personalized feed with algorithm-based ranking.
    
    - **algorithm=true** (default): Uses 80/20 split between algorithm-scored and recent posts
    - **algorithm=false**: Returns posts in chronological order (backward compatibility)
    """
    try:
        from app.services.algorithm_service import AlgorithmService
        from sqlalchemy import text
        from app.models.emoji_reaction import EmojiReaction
        
        # Import the likes model
        try:
            from app.models.like import Like
            has_likes_table = True
        except ImportError:
            has_likes_table = False
            logger.warning("Likes table not found, hearts count will be 0")

        # Use AlgorithmService for personalized feed
        if algorithm:
            algorithm_service = AlgorithmService(db)
            posts_data, total_count = await algorithm_service.get_personalized_feed(
                user_id=current_user_id,
                limit=limit,
                offset=offset,
                algorithm_enabled=True
            )
            
            # Get current user's reactions and hearts for each post
            posts_with_user_data = []
            for post_data in posts_data:
                # Get current user's reaction
                current_user_reaction = None
                is_hearted = False
                
                if has_likes_table:
                    # Check for user's heart
                    heart_query = text("""
                        SELECT 1 FROM likes 
                        WHERE post_id = :post_id AND user_id = :user_id
                    """)
                    heart_result = await db.execute(heart_query, {
                        "post_id": post_data['id'],
                        "user_id": current_user_id
                    })
                    is_hearted = heart_result.fetchone() is not None
                
                # Check for user's emoji reaction
                reaction_query = text("""
                    SELECT emoji_code FROM emoji_reactions 
                    WHERE post_id = :post_id AND user_id = :user_id
                """)
                reaction_result = await db.execute(reaction_query, {
                    "post_id": post_data['id'],
                    "user_id": current_user_id
                })
                reaction_row = reaction_result.fetchone()
                if reaction_row:
                    current_user_reaction = reaction_row.emoji_code
                
                posts_with_user_data.append(PostResponse(
                    id=post_data['id'],
                    author_id=post_data['author_id'],
                    title=post_data['title'],
                    content=post_data['content'],
                    post_type=post_data['post_type'],
                    image_url=post_data['image_url'],
                    location=post_data.get('location'),
                    is_public=post_data['is_public'],
                    created_at=post_data['created_at'],
                    updated_at=post_data['updated_at'],
                    author=post_data['author'] or {
                        "id": post_data['author_id'],
                        "username": "Unknown",
                        "name": "Unknown"
                    },
                    hearts_count=post_data['hearts_count'],
                    reactions_count=post_data['reactions_count'],
                    current_user_reaction=current_user_reaction,
                    is_hearted=is_hearted
                ))
            
            logger.debug(f"Retrieved {len(posts_with_user_data)} algorithm-ranked posts for user {current_user_id}")
            return posts_with_user_data
        
        # Fallback to original chronological feed (backward compatibility)
        else:
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
                           p.location,
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
                           p.location,
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
                    location=getattr(row, 'location', None),
                    is_public=row.is_public,
                    created_at=row.created_at.isoformat() if hasattr(row.created_at, 'isoformat') else str(row.created_at),
                    updated_at=row.updated_at.isoformat() if row.updated_at and hasattr(row.updated_at, 'isoformat') else str(row.updated_at) if row.updated_at else None,
                    author={
                        "id": row.author_id,
                        "username": row.author_username,
                        "name": row.author_username  # Use username as display name for now
                    },
                    hearts_count=int(row.hearts_count) if row.hearts_count else 0,
                    reactions_count=int(row.reactions_count) if row.reactions_count else 0,
                    current_user_reaction=row.current_user_reaction,
                    is_hearted=bool(getattr(row, 'is_hearted', False))
                ))

            logger.debug(f"Retrieved {len(posts_with_counts)} chronological posts")
            return posts_with_counts

    except Exception as e:
        logger.error(f"Error getting feed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get feed"
        )


@router.get("/{post_id}", response_model=PostResponse)
async def get_post_by_id(
    post_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get a single post by ID. Public posts can be viewed without authentication."""
    try:
        # Get user ID if authenticated, otherwise None
        current_user_id = await get_optional_user_id(request)
        
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
                       p.location,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       u.id as author_id,
                       u.username as author_username,
                       u.email as author_email,
                       u.profile_image_url as author_profile_image,
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
                WHERE p.id = :post_id
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
                       p.location,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       u.id as author_id,
                       u.username as author_username,
                       u.email as author_email,
                       u.profile_image_url as author_profile_image,
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
                WHERE p.id = :post_id
            """)

        result = await db.execute(query, {
            "current_user_id": current_user_id,
            "post_id": post_id
        })
        
        row = result.fetchone()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        # Check if post is public or user has access
        if not row.is_public and current_user_id != row.author_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This post is private"
            )

        return PostResponse(
            id=row.id,
            author_id=row.author_id,
            title=row.title,
            content=row.content,
            post_type=row.post_type,
            image_url=row.image_url,
            location=row.location,
            is_public=row.is_public,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat() if row.updated_at else None,
            author={
                "id": row.author_id,
                "username": row.author_username,
                "name": row.author_username,
                "profile_image_url": row.author_profile_image
            },
            hearts_count=int(row.hearts_count) if row.hearts_count else 0,
            reactions_count=int(row.reactions_count) if row.reactions_count else 0,
            current_user_reaction=row.current_user_reaction,
            is_hearted=bool(row.is_hearted) if hasattr(row, 'is_hearted') else False
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting post {post_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get post"
        )


@router.post("/{post_id}/share", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
async def share_post(
    post_id: str,
    share_data: ShareRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Share a post via URL or message.
    
    - **URL sharing**: Generates a shareable URL for the post (no rate limit)
    - **Message sharing**: Sends the post to specific users with optional message (rate limited: 20 per hour)
    """
    try:
        share_service = ShareService(db)
        
        if share_data.share_method == "url":
            # Share via URL
            result = await share_service.share_via_url(
                user_id=current_user_id,
                post_id=post_id
            )
            
            return ShareResponse(
                id=result["id"],
                user_id=result["user_id"],
                post_id=result["post_id"],
                share_method=result["share_method"],
                share_url=result["share_url"],
                created_at=result["created_at"]
            )
            
        elif share_data.share_method == "message":
            # Share via message
            result = await share_service.share_via_message(
                sender_id=current_user_id,
                post_id=post_id,
                recipient_ids=share_data.recipient_ids or [],
                message=share_data.message or ""
            )
            
            return ShareResponse(
                id=result["id"],
                user_id=result["user_id"],
                post_id=result["post_id"],
                share_method=result["share_method"],
                recipient_count=result["recipient_count"],
                message_content=result["message_content"],
                created_at=result["created_at"]
            )
            
    except Exception as e:
        logger.error(f"Error sharing post {post_id}: {str(e)}")
        
        # Import custom exceptions
        from app.core.exceptions import (
            NotFoundError, ValidationException, BusinessLogicError, 
            PermissionDeniedError, RateLimitError
        )
        
        # Handle specific custom exceptions
        if isinstance(e, NotFoundError):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        elif isinstance(e, ValidationException):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e)
            )
        elif isinstance(e, BusinessLogicError):
            # Check if it's a rate limit error
            if "rate limit exceeded" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=str(e)
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e)
                )
        elif isinstance(e, PermissionDeniedError):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e)
            )
        elif isinstance(e, RateLimitError):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=str(e)
            )
        else:
            # Handle string-based error checking for backward compatibility
            error_str = str(e).lower()
            if "rate limit exceeded" in error_str:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=str(e)
                )
            elif "not found" in error_str:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=str(e)
                )
            elif any(keyword in error_str for keyword in ["validation", "invalid", "required", "maximum"]):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(e)
                )
            elif "privacy" in error_str or "cannot be shared" in error_str:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=str(e)
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to share post"
                )