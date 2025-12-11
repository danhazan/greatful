"""
Posts API endpoints.
"""

import logging
import uuid
import os
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

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
from app.services.content_analysis_service import ContentAnalysisService
from app.utils.html_sanitizer import sanitize_html
from app.core.responses import success_response

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


class PostCreate(BaseModel):
    """Post creation request model with automatic type detection and rich content support."""
    content: str = Field(default="", min_length=0)
    rich_content: Optional[str] = Field(None, description="HTML formatted content")
    post_style: Optional[dict] = Field(None, description="Post styling information")
    image_url: Optional[str] = None
    location: Optional[str] = Field(None, max_length=150)
    location_data: Optional[dict] = Field(None, description="Structured location data from LocationService")
    is_public: bool = True
    # Optional override for post type (for future use or manual override)
    post_type_override: Optional[str] = Field(None, description="Optional manual override for post type")

    @field_validator('post_type_override')
    @classmethod
    def validate_post_type_override(cls, v):
        if v is not None:
            valid_types = ['daily', 'photo', 'spontaneous']
            if v not in valid_types:
                raise ValueError(f'Invalid post type override. Must be one of: {valid_types}')
        return v

    @field_validator('post_style')
    @classmethod
    def validate_post_style(cls, v):
        if v is not None:
            from app.utils.post_style_validator import PostStyleValidator
            return PostStyleValidator.validate_post_style(v)
        return v




class PostResponse(BaseModel):
    """Post response model with rich content support."""
    id: str
    author_id: int
    content: str
    rich_content: Optional[str] = None
    post_style: Optional[dict] = None
    post_type: str
    image_url: Optional[str] = None
    location: Optional[str] = None
    location_data: Optional[dict] = None
    is_public: bool
    created_at: str
    updated_at: Optional[str] = None
    author: dict
    hearts_count: int = 0
    reactions_count: int = 0
    comments_count: int = 0
    current_user_reaction: Optional[str] = None
    is_hearted: Optional[bool] = False
    is_read: Optional[bool] = False
    is_unread: Optional[bool] = False
    algorithm_score: Optional[float] = None

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
        valid_emojis = ['heart', 'heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap', 'grateful', 'praise']
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
        valid_methods = ['url', 'message', 'whatsapp']
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
    whatsapp_url: Optional[str] = None
    whatsapp_text: Optional[str] = None
    recipient_count: Optional[int] = None
    message_content: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class PostUpdate(BaseModel):
    """Post update request model."""
    content: Optional[str] = Field(None, min_length=1)
    rich_content: Optional[str] = Field(None, description="HTML formatted content")
    post_style: Optional[dict] = Field(None, description="Post styling information")
    image_url: Optional[str] = Field(None, description="Image URL for the post")
    location: Optional[str] = Field(None, max_length=150)
    location_data: Optional[dict] = Field(None, description="Structured location data from LocationService")

    @field_validator('post_style')
    @classmethod
    def validate_post_style(cls, v):
        if v is not None:
            from app.utils.post_style_validator import PostStyleValidator
            return PostStyleValidator.validate_post_style(v)
        return v


class DeleteResponse(BaseModel):
    """Delete response model."""
    success: bool
    message: str


class ReadStatusRequest(BaseModel):
    """Read status tracking request model."""
    post_ids: List[str] = Field(..., description="List of post IDs that were read")

    @field_validator('post_ids')
    @classmethod
    def validate_post_ids(cls, v):
        if not v:
            raise ValueError('post_ids cannot be empty')
        if len(v) > 50:
            raise ValueError('Maximum 50 post IDs allowed per request')
        return v


class ReadStatusResponse(BaseModel):
    """Read status response model."""
    success: bool
    message: str
    read_count: int
    post_ids: List[str]


async def get_current_user_id(auth: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Extract user ID from JWT token."""
    # Check for test authentication bypass
    from app.core.test_auth import get_test_user_id_from_token, is_test_environment
    
    if is_test_environment():
        test_user_id = get_test_user_id_from_token(auth)
        if test_user_id is not None:
            return test_user_id
    
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


async def _save_uploaded_file(file: UploadFile, db: AsyncSession, uploader_id: int, force_upload: bool = False) -> Dict[str, Any]:
    """Save uploaded file with deduplication and return upload results."""
    from app.services.file_upload_service import FileUploadService
    
    try:
        file_service = FileUploadService(db)
        
        # Reset file pointer in case it was read before
        await file.seek(0)
        
        # Save with deduplication (same approach as profile photos)
        upload_result = await file_service.save_with_deduplication(
            file=file,
            subdirectory="posts",
            upload_context="post",
            uploader_id=uploader_id,
            force_upload=force_upload
        )
        
        if not upload_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save uploaded file"
            )
        
        return upload_result
        
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file"
        )


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_json(
    post_data: PostCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Create a new gratitude post with automatic type detection (JSON only)."""
    try:
        # Get user to verify they exist using repository
        from app.repositories.user_repository import UserRepository
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id_or_404(current_user_id)

        # Validate that either content or image is provided
        if not post_data.content.strip() and not post_data.image_url:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[{
                    "type": "value_error",
                    "loc": ["body"],
                    "msg": "Either content or image must be provided",
                    "input": None
                }]
            )

        # Analyze content to determine post type automatically
        content_analysis_service = ContentAnalysisService(db)
        has_image = bool(post_data.image_url)
        
        analysis_result = content_analysis_service.analyze_content(
            content=post_data.content,
            has_image=has_image
        )
        
        # Use override if provided, otherwise use analyzed type
        final_post_type = PostType(post_data.post_type_override) if post_data.post_type_override else analysis_result.suggested_type
        
        # Validate content length for the determined type
        validation_result = content_analysis_service.validate_content_for_type(
            content=post_data.content,
            post_type=final_post_type
        )
        
        if not validation_result["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Content too long. Maximum {validation_result['character_limit']} characters for {final_post_type.value} posts. Current: {validation_result['character_count']} characters."
            )

        # Validate location_data if provided
        if post_data.location_data:
            from app.services.location_service import LocationService
            location_service = LocationService(db)
            if not location_service.validate_location_data(post_data.location_data):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid location data format"
                )

        # Sanitize content to prevent XSS attacks (only during security tests or production)
        import os
        if os.getenv('SECURITY_TESTING') == 'true' or os.getenv('ENVIRONMENT') == 'production':
            from app.core.input_sanitization import InputSanitizer
            sanitizer = InputSanitizer()
            sanitized_content = sanitizer.sanitize_text(post_data.content, "post_content")
        else:
            sanitized_content = post_data.content
        
        # Create post with automatically determined type and rich content support
        db_post = Post(
            id=str(uuid.uuid4()),
            author_id=current_user_id,
            content=sanitized_content,
            rich_content=sanitize_html(post_data.rich_content),
            post_style=post_data.post_style,
            post_type=final_post_type,
            image_url=post_data.image_url,
            location=post_data.location,
            location_data=post_data.location_data,
            is_public=post_data.is_public,
            created_at=datetime.now(timezone.utc)
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
            content=db_post.content,
            rich_content=db_post.rich_content,
            post_style=db_post.post_style,
            post_type=db_post.post_type.value,
            image_url=db_post.image_url,
            location=db_post.location,
            location_data=db_post.location_data,
            is_public=db_post.is_public,
            created_at=db_post.created_at.isoformat() if db_post.created_at else None,
            updated_at=db_post.updated_at.isoformat() if db_post.updated_at else None,
            author={
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "name": user.display_name or user.username,
                "email": user.email
            },
            hearts_count=0,
            reactions_count=0,
            comments_count=0,
            current_user_reaction=None,
            is_hearted=False
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating post: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create post"
        )


@router.post("/check-image-duplicate")
async def check_post_image_duplicate(
    request: Request,
    image: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Check if a post image is a duplicate before uploading."""
    try:
        from app.services.file_upload_service import FileUploadService
        
        file_service = FileUploadService(db)
        exact_duplicate, similar_images = await file_service.check_for_duplicate(
            file=image,
            upload_context="post"
        )
        
        return success_response({
            "has_exact_duplicate": exact_duplicate is not None,
            "exact_duplicate": {
                "id": exact_duplicate.id,
                "file_path": exact_duplicate.file_path,
                "original_filename": exact_duplicate.original_filename,
                "reference_count": exact_duplicate.reference_count,
                "created_at": exact_duplicate.created_at.isoformat()
            } if exact_duplicate else None,
            "similar_images": [
                {
                    "id": img_hash.id,
                    "file_path": img_hash.file_path,
                    "similarity_distance": distance,
                    "original_filename": img_hash.original_filename,
                    "created_at": img_hash.created_at.isoformat()
                }
                for img_hash, distance in similar_images[:5]  # Limit to top 5 similar
            ],
            "has_similar_images": len(similar_images) > 0
        }, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        logger.error(f"Error checking post image duplicate: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check for duplicates"
        )

@router.post("/upload", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_with_file(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    # FormData parameters
    content: str = Form(default=""),
    rich_content: Optional[str] = Form(None),
    post_style: Optional[str] = Form(None),  # JSON string
    location: Optional[str] = Form(None),
    location_data: Optional[str] = Form(None),  # JSON string
    post_type_override: Optional[str] = Form(None),
    force_upload: bool = Form(False),
    image: Optional[UploadFile] = File(None)
):
    """Create a new gratitude post with automatic type detection and optional file upload."""
    try:
        # Parse JSON fields if provided
        import json
        
        parsed_location_data = None
        if location_data:
            try:
                parsed_location_data = json.loads(location_data)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid location_data JSON format"
                )
        
        parsed_post_style = None
        if post_style:
            try:
                parsed_post_style = json.loads(post_style)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid post_style JSON format"
                )

        # Create PostCreate object and validate it
        post_data_dict = {
            "content": content,
            "rich_content": rich_content,
            "post_style": parsed_post_style,
            "location": location,
            "location_data": parsed_location_data,
            "post_type_override": post_type_override,
            "is_public": True
        }
        
        # This will trigger Pydantic validation and raise 422 if invalid
        post_data = PostCreate(**post_data_dict)

        # Get user to verify they exist using repository
        from app.repositories.user_repository import UserRepository
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id_or_404(current_user_id)

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
            
            upload_result = await _save_uploaded_file(image, db, current_user_id, force_upload)
            image_url = upload_result["file_url"]

        # Validate that either content or image is provided (after processing uploaded file)
        if not post_data.content.strip() and not image_url:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[{
                    "type": "value_error",
                    "loc": ["body"],
                    "msg": "Either content or image must be provided",
                    "input": None
                }]
            )

        # Analyze content to determine post type automatically
        content_analysis_service = ContentAnalysisService(db)
        has_image = bool(image_url)
        
        analysis_result = content_analysis_service.analyze_content(
            content=post_data.content,
            has_image=has_image
        )
        
        # Use override if provided, otherwise use analyzed type
        final_post_type = PostType(post_data.post_type_override) if post_data.post_type_override else analysis_result.suggested_type
        
        # Validate content length for the determined type
        validation_result = content_analysis_service.validate_content_for_type(
            content=post_data.content,
            post_type=final_post_type
        )
        
        if not validation_result["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Content too long. Maximum {validation_result['character_limit']} characters for {final_post_type.value} posts. Current: {validation_result['character_count']} characters."
            )

        # Validate location_data if provided
        if post_data.location_data:
            from app.services.location_service import LocationService
            location_service = LocationService(db)
            if not location_service.validate_location_data(post_data.location_data):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid location data format"
                )

        # Sanitize content to prevent XSS attacks (only during security tests or production)
        import os
        if os.getenv('SECURITY_TESTING') == 'true' or os.getenv('ENVIRONMENT') == 'production':
            from app.core.input_sanitization import InputSanitizer
            sanitizer = InputSanitizer()
            sanitized_content = sanitizer.sanitize_text(post_data.content, "post_content")
        else:
            sanitized_content = post_data.content
        
        # Create post with automatically determined type and rich content support
        db_post = Post(
            id=str(uuid.uuid4()),
            author_id=current_user_id,
            content=sanitized_content,
            rich_content=sanitize_html(post_data.rich_content),
            post_style=post_data.post_style,
            post_type=final_post_type,
            image_url=image_url,
            location=post_data.location,
            location_data=post_data.location_data,
            is_public=post_data.is_public,
            created_at=datetime.now(timezone.utc)
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
            content=db_post.content,
            rich_content=db_post.rich_content,
            post_style=db_post.post_style,
            post_type=db_post.post_type.value,
            image_url=db_post.image_url,
            location=db_post.location,
            location_data=db_post.location_data,
            is_public=db_post.is_public,
            created_at=db_post.created_at.isoformat() if db_post.created_at else None,
            updated_at=db_post.updated_at.isoformat() if db_post.updated_at else None,
            author={
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "name": user.display_name or user.username,
                "email": user.email
            },
            hearts_count=0,
            reactions_count=0,
            current_user_reaction=None,
            is_hearted=False
        )

    except HTTPException:
        raise
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
    algorithm: bool = True,
    consider_read_status: bool = True,
    refresh: bool = False
):
    """
    Get user's personalized feed with algorithm-based ranking.
    
    - **algorithm=true** (default): Uses 80/20 split between algorithm-scored and recent posts
    - **algorithm=false**: Returns posts in chronological order (backward compatibility)
    - **consider_read_status=true** (default): Deprioritizes already-read posts in algorithm scoring
    - **consider_read_status=false**: Ignores read status in algorithm calculations
    - **refresh=true**: Prioritizes unread posts over older content for refresh mechanism
    """
    try:
        from app.services.algorithm_service import AlgorithmService
        from sqlalchemy import text
        from app.models.emoji_reaction import EmojiReaction
        
        # Hearts are implemented as emoji reactions with emoji_code='heart'
        has_likes_table = True  # Hearts available through emoji reactions system

        # Use OptimizedAlgorithmService for personalized feed with performance monitoring
        if algorithm:
            try:
                from app.services.optimized_algorithm_service import OptimizedAlgorithmService
                algorithm_service = OptimizedAlgorithmService(db)
                posts_data, total_count = await algorithm_service.get_personalized_feed_optimized(
                    user_id=current_user_id,
                    limit=limit,
                    offset=offset,
                    algorithm_enabled=True,
                    consider_read_status=consider_read_status,
                    refresh_mode=refresh
                )
            except ImportError:
                # Fallback to regular AlgorithmService if optimized version not available
                logger.warning("OptimizedAlgorithmService not available, falling back to regular AlgorithmService")
                algorithm_service = AlgorithmService(db)
                posts_data, total_count = await algorithm_service.get_personalized_feed(
                    user_id=current_user_id,
                    limit=limit,
                    offset=offset,
                    algorithm_enabled=True,
                    consider_read_status=consider_read_status,
                    refresh_mode=refresh
                )
            
            # Get current user's reactions and hearts for each post
            posts_with_user_data = []
            for post_data in posts_data:
                # Get current user's reaction
                current_user_reaction = None
                is_hearted = False
                
                if has_likes_table:
                    # Check for user's heart (using emoji reactions with 'heart' emoji_code)
                    heart_query = text("""
                        SELECT 1 FROM emoji_reactions 
                        WHERE post_id = :post_id AND user_id = :user_id AND emoji_code = 'heart'
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
                    content=post_data['content'],
                    rich_content=post_data.get('rich_content'),
                    post_style=post_data.get('post_style'),
                    post_type=post_data['post_type'],
                    image_url=post_data['image_url'],
                    location=post_data.get('location'),
                    location_data=post_data.get('location_data'),
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
                    comments_count=post_data['comments_count'],
                    current_user_reaction=current_user_reaction,
                    is_hearted=is_hearted,
                    is_read=post_data.get('is_read', False),
                    is_unread=post_data.get('is_unread', False),
                    algorithm_score=post_data.get('algorithm_score')
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
                           p.content,
                           p.rich_content,
                           p.post_style,
                           p.post_type,
                           p.image_url,
                           p.location,
                           p.location_data,
                           p.is_public,
                           p.created_at,
                           p.updated_at,
                           p.comments_count,
                           u.id as author_id,
                           u.username as author_username,
                           u.display_name as author_display_name,
                           u.email as author_email,
                           COALESCE(hearts.hearts_count, 0) as hearts_count,
                           COALESCE(reactions.reactions_count, 0) as reactions_count,
                           user_reactions.emoji_code as current_user_reaction,
                           CASE WHEN user_hearts.user_id IS NOT NULL THEN true ELSE false END as is_hearted
                    FROM posts p
                    LEFT JOIN users u ON u.id = p.author_id
                    LEFT JOIN (
                        SELECT post_id, COUNT(DISTINCT user_id) as hearts_count
                        FROM emoji_reactions
                        WHERE emoji_code = 'heart'
                        GROUP BY post_id
                    ) hearts ON hearts.post_id = p.id
                    LEFT JOIN (
                        SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                        FROM emoji_reactions
                        WHERE emoji_code != 'heart'
                        GROUP BY post_id
                    ) reactions ON reactions.post_id = p.id
                    LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                        AND user_reactions.user_id = :current_user_id AND user_reactions.emoji_code != 'heart'
                    LEFT JOIN emoji_reactions user_hearts ON user_hearts.post_id = p.id 
                        AND user_hearts.user_id = :current_user_id AND user_hearts.emoji_code = 'heart'
                    WHERE p.is_public = true
                    ORDER BY p.created_at DESC
                    LIMIT :limit OFFSET :offset
                """)
            else:
                # Query with only emoji reactions (no likes table yet)
                query = text("""
                    SELECT p.id,
                           p.author_id,
                           p.content,
                           p.rich_content,
                           p.post_style,
                           p.post_type,
                           p.image_url,
                           p.location,
                           p.location_data,
                           p.is_public,
                           p.created_at,
                           p.updated_at,
                           p.comments_count,
                           u.id as author_id,
                           u.username as author_username,
                           u.display_name as author_display_name,
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

            # Get read status for chronological posts if enabled
            algorithm_service = AlgorithmService(db) if consider_read_status else None
            
            posts_with_counts = []
            for row in rows:
                is_read = False
                if algorithm_service and consider_read_status:
                    is_read = algorithm_service.is_post_read(current_user_id, row.id)
                
                posts_with_counts.append(PostResponse(
                    id=row.id,
                    author_id=row.author_id,
                    content=row.content,
                    rich_content=getattr(row, 'rich_content', None),
                    post_style=getattr(row, 'post_style', None),
                    post_type=row.post_type,
                    image_url=row.image_url,
                    location=getattr(row, 'location', None),
                    location_data=getattr(row, 'location_data', None),
                    is_public=row.is_public,
                    created_at=row.created_at.isoformat() if hasattr(row.created_at, 'isoformat') else str(row.created_at),
                    updated_at=row.updated_at.isoformat() if row.updated_at and hasattr(row.updated_at, 'isoformat') else str(row.updated_at) if row.updated_at else None,
                    author={
                        "id": row.author_id,
                        "username": row.author_username,
                        "display_name": row.author_display_name,
                        "name": row.author_display_name or row.author_username
                    },
                    hearts_count=int(row.hearts_count) if row.hearts_count else 0,
                    reactions_count=int(row.reactions_count) if row.reactions_count else 0,
                    comments_count=int(row.comments_count) if row.comments_count else 0,
                    current_user_reaction=row.current_user_reaction,
                    is_hearted=bool(getattr(row, 'is_hearted', False)),
                    is_read=is_read,
                    is_unread=False,  # Chronological feed doesn't mark posts as unread
                    algorithm_score=None  # No algorithm score for chronological feed
                ))

            logger.debug(f"Retrieved {len(posts_with_counts)} chronological posts")
            return posts_with_counts

    except Exception as e:
        logger.error(f"Error getting feed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get feed"
        )


@router.post("/read-status", response_model=ReadStatusResponse)
async def mark_posts_as_read(
    read_request: ReadStatusRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark posts as read for the current user.
    
    This endpoint is used to track which posts the user has viewed,
    allowing the algorithm to deprioritize already-read content in future feeds.
    """
    try:
        algorithm_service = AlgorithmService(db)
        
        # Validate that all post IDs exist and are public
        from sqlalchemy import select
        if read_request.post_ids:
            # Use SQLAlchemy ORM query for better compatibility
            query = select(Post.id).where(
                Post.id.in_(read_request.post_ids),
                Post.is_public == True
            )
            result = await db.execute(query)
            valid_post_ids = [row.id for row in result.fetchall()]
        else:
            valid_post_ids = []
        
        if len(valid_post_ids) != len(read_request.post_ids):
            invalid_ids = set(read_request.post_ids) - set(valid_post_ids)
            logger.warning(f"Invalid post IDs provided: {invalid_ids}")
            # Continue with valid IDs only
        
        # Mark valid posts as read
        if valid_post_ids:
            algorithm_service.mark_posts_as_read(current_user_id, valid_post_ids)
        
        return ReadStatusResponse(
            success=True,
            message=f"Marked {len(valid_post_ids)} posts as read",
            read_count=len(valid_post_ids),
            post_ids=valid_post_ids
        )

    except Exception as e:
        logger.error(f"Error marking posts as read: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark posts as read"
        )


@router.get("/read-status/summary")
async def get_read_status_summary(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get summary of read status for the current user.
    
    Returns information about how many posts have been read and recent activity.
    Useful for debugging and analytics.
    """
    try:
        algorithm_service = AlgorithmService(db)
        summary = algorithm_service.get_read_status_summary(current_user_id)
        
        return {
            "success": True,
            "user_id": current_user_id,
            **summary
        }

    except Exception as e:
        logger.error(f"Error getting read status summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get read status summary"
        )


@router.delete("/read-status")
async def clear_read_status(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Clear all read status for the current user.
    
    This resets the read tracking, causing all posts to be treated as unread
    in future feed algorithm calculations. Useful for testing or user preference.
    """
    try:
        algorithm_service = AlgorithmService(db)
        algorithm_service.clear_read_status(current_user_id)
        
        return {
            "success": True,
            "message": "Read status cleared successfully"
        }

    except Exception as e:
        logger.error(f"Error clearing read status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear read status"
        )


@router.post("/update-feed-view", response_model=dict)
async def update_feed_view(
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's last feed view timestamp to current time.
    
    This endpoint should be called when the user views their feed to track
    when they last saw posts, enabling unread post detection for refresh.
    """
    try:
        from app.services.algorithm_service import AlgorithmService
        
        algorithm_service = AlgorithmService(db)
        await algorithm_service.update_user_last_feed_view(current_user_id)
        
        return {
            "success": True,
            "message": "Feed view timestamp updated",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error updating feed view timestamp: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update feed view timestamp"
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
        
        # Hearts are implemented as emoji reactions with emoji_code='heart'
        has_likes_table = True  # Hearts available through emoji reactions system

        # Build query with engagement counts using efficient LEFT JOINs
        if has_likes_table:
            # Query includes hearts (emoji_code='heart') and other emoji reactions
            query = text("""
                SELECT p.id,
                       p.author_id,
                       p.content,
                       p.rich_content,
                       p.post_style,
                       p.post_type,
                       p.image_url,
                       p.location,
                       p.location_data,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       p.comments_count,
                       u.id as author_id,
                       u.username as author_username,
                       u.display_name as author_display_name,
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
                    FROM emoji_reactions
                    WHERE emoji_code = 'heart'
                    GROUP BY post_id
                ) hearts ON hearts.post_id = p.id
                LEFT JOIN (
                    SELECT post_id, COUNT(DISTINCT user_id) as reactions_count
                    FROM emoji_reactions
                    WHERE emoji_code != 'heart'
                    GROUP BY post_id
                ) reactions ON reactions.post_id = p.id
                LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                    AND user_reactions.user_id = :current_user_id AND user_reactions.emoji_code != 'heart'
                LEFT JOIN emoji_reactions user_hearts ON user_hearts.post_id = p.id 
                    AND user_hearts.user_id = :current_user_id AND user_hearts.emoji_code = 'heart'
                WHERE p.id = :post_id
            """)
        else:
            # Query with only emoji reactions (no likes table yet)
            query = text("""
                SELECT p.id,
                       p.author_id,
                       p.content,
                       p.rich_content,
                       p.post_style,
                       p.post_type,
                       p.image_url,
                       p.location,
                       p.location_data,
                       p.is_public,
                       p.created_at,
                       p.updated_at,
                       p.comments_count,
                       u.id as author_id,
                       u.username as author_username,
                       u.display_name as author_display_name,
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

        # Parse JSON fields
        post_style = None
        if row.post_style and row.post_style != 'null':
            try:
                post_style = json.loads(row.post_style) if isinstance(row.post_style, str) else row.post_style
            except (json.JSONDecodeError, TypeError):
                post_style = None
        
        location_data = None
        if row.location_data and row.location_data != 'null':
            try:
                location_data = json.loads(row.location_data) if isinstance(row.location_data, str) else row.location_data
            except (json.JSONDecodeError, TypeError):
                location_data = None

        return PostResponse(
            id=row.id,
            author_id=row.author_id,
            content=row.content,
            rich_content=getattr(row, 'rich_content', None),
            post_style=post_style,
            post_type=row.post_type,
            image_url=row.image_url,
            location=row.location,
            location_data=location_data,
            is_public=row.is_public,
            created_at=row.created_at.isoformat() if hasattr(row.created_at, 'isoformat') else str(row.created_at),
            updated_at=row.updated_at.isoformat() if row.updated_at and hasattr(row.updated_at, 'isoformat') else str(row.updated_at) if row.updated_at else None,
            author={
                "id": row.author_id,
                "username": row.author_username,
                "display_name": row.author_display_name,
                "name": row.author_display_name or row.author_username,
                "image": row.author_profile_image
            },
            hearts_count=int(row.hearts_count) if row.hearts_count else 0,
            reactions_count=int(row.reactions_count) if row.reactions_count else 0,
            comments_count=int(row.comments_count) if row.comments_count else 0,
            current_user_reaction=row.current_user_reaction,
            is_hearted=bool(row.is_hearted) if hasattr(row, 'is_hearted') else False,
            algorithm_score=None  # Individual post view doesn't include algorithm score
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
    Share a post via URL, message, or WhatsApp.
    
    - **URL sharing**: Generates a shareable URL for the post (no rate limit)
    - **Message sharing**: Sends the post to specific users with optional message (rate limited: 20 per hour)
    - **WhatsApp sharing**: Generates WhatsApp Web/app URL with formatted text (no rate limit)
    """
    try:
        # Use enhanced ShareService for better production error handling in production
        # Use regular ShareService in development/testing for compatibility
        if os.getenv("ENVIRONMENT") == "production":
            try:
                from app.services.enhanced_share_service import EnhancedShareService
                share_service = EnhancedShareService(db)
                logger.info("Using EnhancedShareService for production reliability")
            except ImportError:
                share_service = ShareService(db)
                logger.warning("Enhanced ShareService not available, using regular ShareService")
        else:
            # Use regular ShareService in development/testing for test compatibility
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
            
        elif share_data.share_method == "whatsapp":
            # Share via WhatsApp
            result = await share_service.share_via_whatsapp(
                user_id=current_user_id,
                post_id=post_id
            )
            
            return ShareResponse(
                id=result["id"],
                user_id=result["user_id"],
                post_id=result["post_id"],
                share_method=result["share_method"],
                share_url=result["share_url"],
                whatsapp_url=result["whatsapp_url"],
                whatsapp_text=result["whatsapp_text"],
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


@router.put("/{post_id}", response_model=PostResponse)
async def edit_post(
    post_id: str,
    post_update: PostUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Edit a post. Only the post author can edit their posts."""
    try:
        # Get the post using repository
        from app.repositories.post_repository import PostRepository
        post_repo = PostRepository(db)
        post = await post_repo.get_by_id_or_404(post_id)
        
        # Check permission - only author can edit
        if post.author_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own posts"
            )
        
        # Update only provided fields
        update_data = {}
        if post_update.content is not None:
            update_data['content'] = post_update.content
        if post_update.rich_content is not None:
            update_data['rich_content'] = sanitize_html(post_update.rich_content)
        if post_update.post_style is not None:
            update_data['post_style'] = post_update.post_style
        # Handle image_url explicitly - allow setting to None to remove image
        if hasattr(post_update, 'image_url'):
            update_data['image_url'] = post_update.image_url
        if post_update.location is not None:
            update_data['location'] = post_update.location
        if post_update.location_data is not None:
            update_data['location_data'] = post_update.location_data
        
        # If content or image is being updated, re-analyze post type
        if 'content' in update_data or 'image_url' in update_data:
            content_analysis_service = ContentAnalysisService(db)
            # Use updated image_url if provided, otherwise use existing
            has_image = bool(update_data.get('image_url', post.image_url))
            # Use updated content if provided, otherwise use existing
            content_to_analyze = update_data.get('content', post.content)
            
            analysis_result = content_analysis_service.analyze_content(
                content=content_to_analyze,
                has_image=has_image
            )
            
            # Update post type based on new content
            update_data['post_type'] = analysis_result.suggested_type
            
            # Validate content length for the new type
            validation_result = content_analysis_service.validate_content_for_type(
                content=content_to_analyze,
                post_type=analysis_result.suggested_type
            )
            
            if not validation_result["is_valid"]:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Content too long. Maximum {validation_result['character_limit']} characters for {analysis_result.suggested_type.value} posts. Current: {validation_result['character_count']} characters."
                )
        
        # Validate location_data if provided
        if 'location_data' in update_data and update_data['location_data']:
            from app.services.location_service import LocationService
            location_service = LocationService(db)
            if not location_service.validate_location_data(update_data['location_data']):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid location data format"
                )
        
        # Update the post
        for field, value in update_data.items():
            setattr(post, field, value)
        
        # Set updated_at timestamp manually
        from datetime import datetime, timezone
        post.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(post)
        
        # Process mentions if content was updated
        if 'content' in update_data:
            try:
                mention_service = MentionService(db)
                # Remove old mentions
                await mention_service.delete_post_mentions(post.id)
                # Create new mentions
                await mention_service.create_mentions(
                    post_id=post.id,
                    author_id=current_user_id,
                    content=update_data['content']
                )
            except Exception as e:
                logger.error(f"Error processing mentions for updated post {post.id}: {e}")
                # Don't fail post update if mention processing fails
        
        # Get user info for response using repository
        from app.repositories.user_repository import UserRepository
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id_or_404(current_user_id)
        
        # Format response
        return PostResponse(
            id=post.id,
            author_id=post.author_id,
            content=post.content,
            rich_content=post.rich_content,
            post_style=post.post_style,
            post_type=post.post_type.value,
            image_url=post.image_url,
            location=post.location,
            location_data=post.location_data,
            is_public=post.is_public,
            created_at=post.created_at.isoformat(),
            updated_at=post.updated_at.isoformat() if post.updated_at else None,
            author={
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "name": user.display_name or user.username,
                "email": user.email,
                "profile_image_url": user.profile_image_url
            },
            hearts_count=post.hearts_count or 0,
            reactions_count=post.reactions_count or 0,
            current_user_reaction=None,  # Will be populated by frontend if needed
            is_hearted=False  # Will be populated by frontend if needed
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error editing post: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to edit post"
        )


@router.delete("/{post_id}", response_model=DeleteResponse)
async def delete_post(
    post_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Delete a post. Only the post author can delete their posts."""
    try:
        # Get the post using repository
        from app.repositories.post_repository import PostRepository
        post_repo = PostRepository(db)
        post = await post_repo.get_by_id_or_404(post_id)
        
        # Check permission - only author can delete
        if post.author_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own posts"
            )
        
        # Delete related data first (cascade delete)
        try:
            # Delete mentions
            mention_service = MentionService(db)
            await mention_service.delete_post_mentions(post.id)
            
            # Delete reactions
            from app.services.reaction_service import ReactionService
            reaction_service = ReactionService(db)
            await reaction_service.delete_all_post_reactions(post.id)
            
            # Delete hearts (emoji reactions with 'heart' emoji_code)
            from sqlalchemy import text
            await db.execute(text("DELETE FROM emoji_reactions WHERE post_id = :post_id AND emoji_code = 'heart'"), {"post_id": post.id})
            
            # Delete shares
            await db.execute(text("DELETE FROM shares WHERE post_id = :post_id"), {"post_id": post.id})
            
            # Delete notifications related to this post
            # Notifications store post_id in the data JSON field, not as a direct column
            await db.execute(text("DELETE FROM notifications WHERE data::jsonb @> :post_data"), {"post_data": json.dumps({"post_id": post.id})})
            
        except Exception as e:
            logger.warning(f"Error cleaning up related data for post {post.id}: {e}")
            # Continue with post deletion even if cleanup fails
        
        # Delete the post itself
        await db.delete(post)
        await db.commit()
        
        # Clean up image file with deduplication handling
        if post.image_url:
            try:
                from app.services.file_upload_service import FileUploadService
                file_service = FileUploadService(db)
                
                # Use deduplication-aware deletion (decrements reference count)
                await file_service.delete_with_deduplication(post.image_url)
                logger.info(f"Processed image deletion with deduplication for post {post.id}: {post.image_url}")
                
            except Exception as e:
                logger.warning(f"Error processing image deletion for post {post.id}: {e}")
                # Don't fail the deletion if file cleanup fails
        
        return DeleteResponse(
            success=True,
            message="Post deleted successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting post: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete post"
        )


