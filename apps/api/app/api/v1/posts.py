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

from app.schemas.user import AuthorResponse
from app.core.database import get_db
from app.core.security import decode_token
from app.models.post import Post
from app.models.user import User
from app.services.share_service import ShareService
from app.core.storage import storage
from app.services.mention_service import MentionService
from app.services.post_privacy_service import PostPrivacyService
from app.utils.html_sanitizer import sanitize_html
from app.core.responses import success_response
from app.core.image_urls import serialize_image_url

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


def _normalize_reaction_emoji_codes(value: Any) -> List[str]:
    """Normalize DB reaction_emoji_codes payload into a list of emoji codes."""
    if value is None:
        return []
    if isinstance(value, str):
        return [item for item in value.split(",") if item]
    if isinstance(value, (list, tuple, set)):
        return [str(item) for item in value if item]
    return []


class PostCreate(BaseModel):
    """Post creation request model with automatic type detection and rich content support."""
    content: str = Field(default="", min_length=0)
    rich_content: Optional[str] = Field(None, description="HTML formatted content")
    post_style: Optional[dict] = Field(None, description="Post styling information")
    image_url: Optional[str] = None
    location: Optional[str] = Field(None, max_length=150)
    location_data: Optional[dict] = Field(None, description="Structured location data from LocationService")
    is_public: bool = True
    privacy_level: Optional[str] = Field(None, description="Post privacy: public, private, custom")
    rules: List[str] = Field(default_factory=list, description="Custom privacy rules")
    specific_users: List[int] = Field(default_factory=list, description="Explicit user IDs for custom privacy")

    @field_validator('post_style')
    @classmethod
    def validate_post_style(cls, v):
        if v is not None:
            from app.utils.post_style_validator import PostStyleValidator
            return PostStyleValidator.validate_post_style(v)
        return v

    @field_validator("privacy_level")
    @classmethod
    def validate_privacy_level(cls, value):
        if value is None:
            return value
        normalized = value.strip().lower()
        if normalized not in PostPrivacyService.SUPPORTED_LEVELS:
            raise ValueError(
                f"Invalid privacy_level. Must be one of: {sorted(PostPrivacyService.SUPPORTED_LEVELS)}"
            )
        return normalized




class PostImageResponse(BaseModel):
    """Response model for individual post images."""
    id: str
    position: int
    thumbnail_url: str = Field(alias="thumbnailUrl")
    medium_url: str = Field(alias="mediumUrl")
    original_url: str = Field(alias="originalUrl")
    width: Optional[int] = None
    height: Optional[int] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PostResponse(BaseModel):
    """Post response model with rich content support."""
    id: str
    author_id: int = Field(alias="authorId")
    content: str
    rich_content: Optional[str] = Field(None, alias="richContent")
    post_style: Optional[dict] = Field(None, alias="postStyle")
    image_url: Optional[str] = Field(None, alias="imageUrl")  # Deprecated: kept for backward compatibility
    images: List[PostImageResponse] = []  # Multi-image support
    location: Optional[str] = None
    location_data: Optional[dict] = Field(None, alias="locationData")
    is_public: bool = Field(alias="isPublic")
    created_at: str = Field(alias="createdAt")
    updated_at: Optional[str] = Field(None, alias="updatedAt")
    author: AuthorResponse
    hearts_count: int = Field(0, alias="heartsCount")
    reactions_count: int = Field(0, alias="reactionsCount")
    comments_count: int = Field(0, alias="commentsCount")
    current_user_reaction: Optional[str] = Field(None, alias="currentUserReaction")
    is_hearted: Optional[bool] = Field(False, alias="isHearted")
    reaction_emoji_codes: List[str] = Field(default_factory=list, alias="reactionEmojiCodes")
    emoji_counts: Dict[str, int] = Field(default_factory=dict, alias="emojiCounts")
    privacy_level: Optional[str] = Field(None, alias="privacyLevel")
    privacy_rules: Optional[List[str]] = Field(None, alias="privacyRules")
    specific_users: Optional[List[int]] = Field(None, alias="specificUsers")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )

    @model_validator(mode='before')
    @classmethod
    def check_duplicate_follow_state(cls, data: Any) -> Any:
        if isinstance(data, dict):
            top_level = data.get('is_following') or data.get('isFollowing')
            author = data.get('author')
            if top_level is not None and author and isinstance(author, dict):
                author_follow = author.get('is_following') or author.get('isFollowing')
                if author_follow is not None:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(
                        "ARCHITECTURE VIOLATION: Duplicate follow indicators detected. "
                        "Follow state should be strictly nested under 'author'."
                    )
        return data

    @field_validator('current_user_reaction')
    @classmethod
    def validate_emoji_code(cls, v):
        if v is None:
            return v
        # Use the single source of truth from EmojiReaction model
        from app.models.emoji_reaction import EmojiReaction
        if not EmojiReaction.is_valid_emoji(v):
            valid_emojis = list(EmojiReaction.VALID_EMOJIS.keys())
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
    privacy_level: Optional[str] = Field(None, description="Post privacy: public, private, custom")
    rules: Optional[List[str]] = Field(None, description="Custom privacy rules")
    specific_users: Optional[List[int]] = Field(None, description="Explicit user IDs for custom privacy")

    @field_validator('post_style')
    @classmethod
    def validate_post_style(cls, v):
        if v is not None:
            from app.utils.post_style_validator import PostStyleValidator
            return PostStyleValidator.validate_post_style(v)
        return v

    @field_validator("privacy_level")
    @classmethod
    def validate_privacy_level(cls, value):
        if value is None:
            return value
        normalized = value.strip().lower()
        if normalized not in PostPrivacyService.SUPPORTED_LEVELS:
            raise ValueError(
                f"Invalid privacy_level. Must be one of: {sorted(PostPrivacyService.SUPPORTED_LEVELS)}"
            )
        return normalized


class DeleteResponse(BaseModel):
    """Delete response model."""
    success: bool
    message: str



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
        ) from e


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
        ) from e


async def _save_post_images(
    files: List[UploadFile],
    db: AsyncSession,
    post_id: str,
    uploader_id: int
) -> List["PostImage"]:
    """
    Save multiple images for a post with variant generation.

    Args:
        files: List of uploaded image files
        db: Database session
        post_id: ID of the post to attach images to
        uploader_id: ID of the user uploading

    Returns:
        List of created PostImage records
    """
    from app.services.file_upload_service import FileUploadService
    from app.models.post_image import PostImage
    from app.config.image_config import get_max_post_images

    max_images = get_max_post_images()
    if len(files) > max_images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {max_images} images allowed per post"
        )

    file_service = FileUploadService(db)
    post_images = []

    for position, file in enumerate(files):
        try:
            # Reset file pointer
            await file.seek(0)

            # Generate variants (thumbnail, medium, original)
            variant_result = await file_service.save_post_image_variants(
                file=file,
                position=position
            )

            # Create PostImage record
            post_image = PostImage(
                post_id=post_id,
                position=variant_result['position'],
                thumbnail_url=variant_result['thumbnail_url'],
                medium_url=variant_result['medium_url'],
                original_url=variant_result['original_url'],
                width=variant_result.get('width'),
                height=variant_result.get('height'),
                file_size=variant_result.get('file_size')
            )

            db.add(post_image)
            post_images.append(post_image)

        except Exception as e:
            logger.error(f"Error processing image at position {position}: {e}")
            # Clean up any already-created variants
            for img in post_images:
                file_service.cleanup_post_image_variants(
                    img.thumbnail_url, img.medium_url, img.original_url
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process image: {str(e)}"
            ) from e

    return post_images


def _serialize_post_images(images) -> List[Dict[str, Any]]:
    """Convert PostImage models to response dictionaries with full URLs."""
    return [
        {
            "id": img.id,
            "position": img.position,
            "thumbnail_url": serialize_image_url(img.thumbnail_url),
            "medium_url": serialize_image_url(img.medium_url),
            "original_url": serialize_image_url(img.original_url),
            "width": img.width,
            "height": img.height
        }
        for img in sorted(images, key=lambda x: x.position)
    ]


async def _fetch_post_images(db: AsyncSession, post_id: str) -> List[Dict[str, Any]]:
    """
    Fetch and serialize post images with full URLs.
    Centralized helper to avoid code duplication.
    """
    from sqlalchemy import text as sql_text
    
    images_query = sql_text("""
        SELECT id, position, thumbnail_url, medium_url, original_url, width, height
        FROM post_images
        WHERE post_id = :post_id
        ORDER BY position
    """)
    images_result = await db.execute(images_query, {"post_id": post_id})
    images_rows = images_result.fetchall()
    
    return [
        {
            "id": img_row.id,
            "position": img_row.position,
            "thumbnail_url": serialize_image_url(img_row.thumbnail_url),
            "medium_url": serialize_image_url(img_row.medium_url),
            "original_url": serialize_image_url(img_row.original_url),
            "width": img_row.width,
            "height": img_row.height
        }
        for img_row in images_rows
    ]


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

        # Validate content length
        if len(post_data.content.strip()) > 5000:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Content too long. Maximum 5000 characters. Current: {len(post_data.content.strip())} characters."
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

        privacy_service = PostPrivacyService(db)
        logger.debug(
            "[PRIVACY][create_post][parsed_input] privacy_level=%s rules=%s specific_users=%s is_public=%s author_id=%s",
            post_data.privacy_level,
            post_data.rules,
            post_data.specific_users,
            post_data.is_public,
            current_user_id,
        )
        try:
            privacy_config = privacy_service.resolve_config(
                privacy_level=post_data.privacy_level,
                rules=post_data.rules,
                specific_users=post_data.specific_users,
                is_public=post_data.is_public,
                author_id=current_user_id,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc
        logger.debug(
            "[PRIVACY][create_post][resolved_config] level=%s normalized_rules=%s normalized_specific_user_ids=%s",
            privacy_config.level,
            privacy_config.rules,
            privacy_config.specific_user_ids,
        )
        
        # Create post with automatically determined type and rich content support
        db_post = Post(
            id=str(uuid.uuid4()),
            author_id=current_user_id,
            content=sanitized_content,
            rich_content=sanitize_html(post_data.rich_content),
            post_style=post_data.post_style,
            image_url=post_data.image_url,
            location=post_data.location,
            location_data=post_data.location_data,
            is_public=privacy_config.is_public,
            privacy_level=privacy_config.level,
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(db_post)
        await db.flush()
        await privacy_service.apply_post_config(db_post, privacy_config)
        await db.commit()
        await db.refresh(db_post)
        if privacy_config.level == PostPrivacyService.CUSTOM:
            persisted = await privacy_service.get_privacy_details_for_posts([db_post.id])
            logger.debug(
                "[PRIVACY][create_post][persisted] post_id=%s details=%s",
                db_post.id,
                persisted.get(db_post.id, {}),
            )
        
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
        
        # Format response (JSON endpoint doesn't support image upload, so images=[] )
        return PostResponse(
            id=db_post.id,
            author_id=db_post.author_id,
            content=db_post.content,
            rich_content=db_post.rich_content,
            post_style=db_post.post_style,
            image_url=serialize_image_url(db_post.image_url),
            images=[],  # JSON endpoint doesn't support image upload
            location=db_post.location,
            location_data=db_post.location_data,
            is_public=db_post.is_public,
            privacy_level=privacy_config.level,
            privacy_rules=privacy_config.rules,
            specific_users=privacy_config.specific_user_ids,
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
        ) from e


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
        ) from e

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
    is_public: Optional[bool] = Form(None),
    privacy_level: Optional[str] = Form(None),
    rules: Optional[str] = Form(None),  # JSON array string
    specific_users: Optional[str] = Form(None),  # JSON array string
    force_upload: bool = Form(False),
    # Multi-image support: accepts multiple files via 'images' field
    images: List[UploadFile] = File(default=[]),
    # Backward compatibility: single image upload (deprecated)
    image: Optional[UploadFile] = File(None)
):
    """
    Create a new gratitude post with automatic type detection and optional file upload.

    Supports multi-image uploads via the 'images' field. The single 'image' field
    is deprecated but maintained for backward compatibility.
    """
    from app.config.image_config import get_max_post_images

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

        parsed_rules = []
        if rules:
            try:
                candidate_rules = json.loads(rules)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid rules JSON format"
                )
            if not isinstance(candidate_rules, list):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="rules must be a JSON array"
                )
            parsed_rules = candidate_rules

        parsed_specific_users = []
        if specific_users:
            try:
                candidate_users = json.loads(specific_users)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid specific_users JSON format"
                )
            if not isinstance(candidate_users, list):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="specific_users must be a JSON array"
                )
            parsed_specific_users = candidate_users

        logger.debug(
            "[PRIVACY][create_post_with_file][parsed_form_input] privacy_level=%s rules=%s specific_users=%s is_public=%s author_id=%s",
            privacy_level,
            parsed_rules,
            parsed_specific_users,
            is_public,
            current_user_id,
        )

        # Create PostCreate object and validate it
        post_data_dict = {
            "content": content,
            "rich_content": rich_content,
            "post_style": parsed_post_style,
            "location": location,
            "location_data": parsed_location_data,
            "is_public": True if is_public is None else bool(is_public),
            "privacy_level": privacy_level,
            "rules": parsed_rules,
            "specific_users": parsed_specific_users,
        }

        # This will trigger Pydantic validation and raise 422 if invalid
        post_data = PostCreate(**post_data_dict)

        # Get user to verify they exist using repository
        from app.repositories.user_repository import UserRepository
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id_or_404(current_user_id)

        # Collect all images (from both new multi-image and legacy single-image params)
        all_images: List[UploadFile] = []

        # Add images from multi-image field
        for img in images:
            if img and img.filename:
                all_images.append(img)

        # Add legacy single image if provided (for backward compatibility)
        if image and image.filename:
            all_images.append(image)

        # Validate image count
        max_images = get_max_post_images()
        if len(all_images) > max_images:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {max_images} images allowed per post"
            )

        # Validate each image
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        max_size = 5 * 1024 * 1024  # 5MB

        for img in all_images:
            file_extension = Path(img.filename).suffix.lower()
            if file_extension not in allowed_extensions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file type for '{img.filename}'. Allowed types: {', '.join(allowed_extensions)}"
                )

            if img.size and img.size > max_size:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{img.filename}' too large. Maximum size is 5MB"
                )

        has_images = len(all_images) > 0

        # Validate that either content or image is provided
        if not post_data.content.strip() and not has_images:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[{
                    "type": "value_error",
                    "loc": ["body"],
                    "msg": "Either content or image must be provided",
                    "input": None
                }]
            )

        # Validate content length
        if len(post_data.content.strip()) > 5000:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Content too long. Maximum 5000 characters. Current: {len(post_data.content.strip())} characters."
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

        privacy_service = PostPrivacyService(db)
        try:
            privacy_config = privacy_service.resolve_config(
                privacy_level=post_data.privacy_level,
                rules=post_data.rules,
                specific_users=post_data.specific_users,
                is_public=post_data.is_public,
                author_id=current_user_id,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc
        logger.debug(
            "[PRIVACY][create_post_with_file][resolved_config] level=%s normalized_rules=%s normalized_specific_user_ids=%s",
            privacy_config.level,
            privacy_config.rules,
            privacy_config.specific_user_ids,
        )

        # Generate post ID for image association
        post_id = str(uuid.uuid4())

        # Process multiple images with variants
        post_images = []
        primary_image_url = None  # For backward compatibility

        if all_images:
            post_images = await _save_post_images(
                files=all_images,
                db=db,
                post_id=post_id,
                uploader_id=current_user_id
            )
            # Set primary image URL for backward compatibility (first image's medium variant)
            if post_images:
                primary_image_url = post_images[0].medium_url

        # Create post with automatically determined type and rich content support
        db_post = Post(
            id=post_id,
            author_id=current_user_id,
            content=sanitized_content,
            rich_content=sanitize_html(post_data.rich_content),
            post_style=post_data.post_style,
            image_url=primary_image_url,  # Backward compatibility
            location=post_data.location,
            location_data=post_data.location_data,
            is_public=privacy_config.is_public,
            privacy_level=privacy_config.level,
            created_at=datetime.now(timezone.utc)
        )

        db.add(db_post)
        await db.flush()
        await privacy_service.apply_post_config(db_post, privacy_config)
        await db.commit()
        await db.refresh(db_post)
        if privacy_config.level == PostPrivacyService.CUSTOM:
            persisted = await privacy_service.get_privacy_details_for_posts([db_post.id])
            logger.debug(
                "[PRIVACY][create_post_with_file][persisted] post_id=%s details=%s",
                db_post.id,
                persisted.get(db_post.id, {}),
            )

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

        # Format response with multi-image support
        return PostResponse(
            id=db_post.id,
            author_id=db_post.author_id,
            content=db_post.content,
            rich_content=db_post.rich_content,
            post_style=db_post.post_style,
            image_url=serialize_image_url(db_post.image_url),  # Backward compatibility
            images=_serialize_post_images(post_images),  # Multi-image support
            location=db_post.location,
            location_data=db_post.location_data,
            is_public=db_post.is_public,
            privacy_level=privacy_config.level,
            privacy_rules=privacy_config.rules,
            specific_users=privacy_config.specific_user_ids,
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
        ) from e


class FeedResponse(BaseModel):
    """Response model for feed with cursor-based pagination."""
    posts: List[PostResponse] = []
    next_cursor: Optional[str] = Field(None, alias="nextCursor")

    model_config = ConfigDict(populate_by_name=True)


@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    cursor: Optional[str] = None,
    page_size: Optional[int] = None,
):
    """
    Feed endpoint with cursor-based pagination.

    Scores computed in SQL (recency + engagement + relationship + own-post boost).
    Cursor-based pagination for stable ordering across pages.
    """
    from app.config.feed_config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
    from app.services.feed_service_v2 import FeedServiceV2

    if page_size is None:
        page_size = DEFAULT_PAGE_SIZE
    if page_size < 1 or page_size > MAX_PAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"page_size must be between 1 and {MAX_PAGE_SIZE}",
        )

    debug = request.headers.get("X-Feed-Debug", "").lower() == "true"

    try:
        service = FeedServiceV2(db)
        result = await service.get_feed(
            user_id=current_user_id,
            cursor=cursor,
            page_size=page_size,
            debug=debug,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error(f"Error in feed v2: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get feed",
        ) from e


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
        dialect = db.bind.dialect.name if db.bind is not None else ""
        
        # Hearts are implemented as emoji reactions with emoji_code='heart'
        has_likes_table = True  # Hearts available through emoji reactions system

        reaction_agg_expression = (
            "ARRAY_AGG(DISTINCT emoji_code ORDER BY emoji_code)"
            if dialect == "postgresql"
            else "GROUP_CONCAT(DISTINCT emoji_code)"
        )
        reaction_default_expression = "ARRAY[]::text[]" if dialect == "postgresql" else "''"

        # Build query with engagement counts using efficient LEFT JOINs
        query = text(f"""
            SELECT p.id,
                   p.author_id,
                   p.content,
                   p.rich_content,
                   p.post_style,
                   p.image_url,
                   p.location,
                   p.location_data,
                   p.is_public,
                   p.privacy_level,
                   p.created_at,
                   p.updated_at,
                   p.comments_count,
                   u.id as author_id,
                   u.username as author_username,
                   u.display_name as author_display_name,
                   u.email as author_email,
                   u.profile_image_url as author_profile_image,
                   COALESCE(engagement.hearts_count, 0) as hearts_count,
                   COALESCE(engagement.reactions_count, 0) as reactions_count,
                   COALESCE(engagement.reaction_emoji_codes, {reaction_default_expression}) as reaction_emoji_codes,
                   user_reactions.emoji_code as current_user_reaction,
                   CASE WHEN user_hearts.user_id IS NOT NULL THEN true ELSE false END as is_hearted,
                   CASE WHEN user_follows.follower_id IS NOT NULL THEN true ELSE false END as is_following
            FROM posts p
            LEFT JOIN users u ON u.id = p.author_id
            LEFT JOIN (
                SELECT post_id, 
                       COUNT(DISTINCT CASE WHEN emoji_code = 'heart' THEN user_id END) as hearts_count,
                       COUNT(DISTINCT CASE WHEN emoji_code != 'heart' THEN user_id END) as reactions_count,
                       {reaction_agg_expression} as reaction_emoji_codes
                FROM emoji_reactions
                GROUP BY post_id
            ) engagement ON engagement.post_id = p.id
            LEFT JOIN emoji_reactions user_reactions ON user_reactions.post_id = p.id 
                AND user_reactions.user_id = :current_user_id AND user_reactions.emoji_code != 'heart'
            LEFT JOIN emoji_reactions user_hearts ON user_hearts.post_id = p.id 
                AND user_hearts.user_id = :current_user_id AND user_hearts.emoji_code = 'heart'
            LEFT JOIN follows user_follows ON user_follows.followed_id = p.author_id
                AND user_follows.follower_id = :current_user_id AND user_follows.status = 'active'
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
        
        privacy_service = PostPrivacyService(db)
        has_access = await privacy_service.can_user_view_post(post_id, current_user_id)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this post"
            )

        privacy_rules = None
        specific_users = None
        is_author_view = bool(current_user_id and current_user_id == row.author_id)
        if is_author_view:
            privacy_details = await privacy_service.get_privacy_details_for_posts([post_id])
            details = privacy_details.get(post_id, {})
            privacy_rules = details.get("privacy_rules", [])
            specific_users = details.get("specific_users", [])

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

        # Fetch post images with full URLs
        images = await _fetch_post_images(db, post_id)

        # Fetch author stats
        from app.repositories.user_repository import UserRepository
        user_repo = UserRepository(db)
        author_stats = await user_repo.get_user_stats_batch([row.author_id])
        stats = author_stats.get(row.author_id, {})

        return PostResponse(
            id=row.id,
            author_id=row.author_id,
            content=row.content,
            rich_content=getattr(row, 'rich_content', None),
            post_style=post_style,
            image_url=serialize_image_url(row.image_url),
            images=images,  # Multi-image support
            location=row.location,
            location_data=location_data,
            is_public=(row.privacy_level == "public") if getattr(row, "privacy_level", None) else row.is_public,
            privacy_level=getattr(row, "privacy_level", None) if is_author_view else None,
            privacy_rules=privacy_rules,
            specific_users=specific_users,
            created_at=row.created_at.isoformat() if hasattr(row.created_at, 'isoformat') else str(row.created_at),
            updated_at=row.updated_at.isoformat() if row.updated_at and hasattr(row.updated_at, 'isoformat') else str(row.updated_at) if row.updated_at else None,
            author={
                "id": row.author_id,
                "username": row.author_username,
                "display_name": row.author_display_name,
                "name": row.author_display_name or row.author_username,
                "image": serialize_image_url(getattr(row, 'author_profile_image', None)),
                "follower_count": stats.get("followers_count", 0),
                "following_count": stats.get("following_count", 0),
                "posts_count": stats.get("posts_count", 0),
                "is_following": bool(row.is_following) if current_user_id and current_user_id != row.author_id else None
            },
            hearts_count=int(row.hearts_count) if row.hearts_count else 0,
            reactions_count=int(row.reactions_count) if row.reactions_count else 0,
            comments_count=int(row.comments_count) if row.comments_count else 0,
            current_user_reaction=row.current_user_reaction,
            is_hearted=bool(row.is_hearted) if hasattr(row, 'is_hearted') else False,
            algorithm_score=None,  # Individual post view doesn't include algorithm score
            reaction_emoji_codes=_normalize_reaction_emoji_codes(getattr(row, 'reaction_emoji_codes', None))
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting post {post_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get post"
        ) from e


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
                ) from e


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
        privacy_service = PostPrivacyService(db)
        
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
        # Only update if the field was provided to avoid clearing existing images unintentionally
        if 'image_url' in post_update.model_fields_set:
            update_data['image_url'] = post_update.image_url
        # Handle location fields - use model_fields_set to detect if field was explicitly provided
        # This allows clearing location by sending null
        if 'location' in post_update.model_fields_set:
            update_data['location'] = post_update.location
        if 'location_data' in post_update.model_fields_set:
            update_data['location_data'] = post_update.location_data

        privacy_update_requested = any(
            field in post_update.model_fields_set
            for field in ["privacy_level", "rules", "specific_users"]
        )
        privacy_config = None
        if privacy_update_requested:
            existing_privacy_details = await privacy_service.get_privacy_details_for_posts([post.id])
            existing = existing_privacy_details.get(post.id, {})
            existing_rules = existing.get("privacy_rules", [])
            existing_specific_users = existing.get("specific_users", [])

            try:
                privacy_config = privacy_service.resolve_config(
                    privacy_level=post_update.privacy_level or post.privacy_level,
                    rules=post_update.rules if post_update.rules is not None else existing_rules,
                    specific_users=(
                        post_update.specific_users
                        if post_update.specific_users is not None
                        else existing_specific_users
                    ),
                    is_public=post.is_public,
                    author_id=current_user_id,
                )
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(exc),
                ) from exc
            update_data["privacy_level"] = privacy_config.level
            update_data["is_public"] = privacy_config.is_public
        
        # Validate content length if content is being updated
        if 'content' in update_data:
            content_to_validate = update_data['content']
            if len(content_to_validate.strip()) > 5000:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Content too long. Maximum 5000 characters. Current: {len(content_to_validate.strip())} characters."
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

        if privacy_config is not None:
            await privacy_service.apply_post_config(post, privacy_config)
        
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

        # Fetch post images with full URLs
        images = await _fetch_post_images(db, post.id)
        privacy_details_map = await privacy_service.get_privacy_details_for_posts([post.id])
        post_privacy_details = privacy_details_map.get(post.id, {})

        # Format response
        return PostResponse(
            id=post.id,
            author_id=post.author_id,
            content=post.content,
            rich_content=post.rich_content,
            post_style=post.post_style,
            image_url=serialize_image_url(post.image_url),
            images=images,  # Multi-image support
            location=post.location,
            location_data=post.location_data,
            is_public=post.is_public,
            privacy_level=post.privacy_level,
            privacy_rules=post_privacy_details.get("privacy_rules", []),
            specific_users=post_privacy_details.get("specific_users", []),
            created_at=post.created_at.isoformat(),
            updated_at=post.updated_at.isoformat() if post.updated_at else None,
            author={
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "name": user.display_name or user.username,
                "email": user.email,
                "profile_image_url": serialize_image_url(user.profile_image_url)
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
        ) from e


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
        
        # Delete comments/replies first to avoid ORM attempting post_id NULL updates.
        from app.services.comment_service import CommentService
        comment_service = CommentService(db)
        await comment_service.delete_comments_for_post(post.id, commit=False)

        # Delete other related data first
        try:
            # Delete mentions
            mention_service = MentionService(db)
            await mention_service.delete_post_mentions(post.id, commit=False)
            
            # Delete reactions
            from app.services.reaction_service import ReactionService
            reaction_service = ReactionService(db)
            await reaction_service.delete_all_post_reactions(post.id)

            from sqlalchemy import text
            
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
        await db.rollback()
        logger.error(f"Error deleting post: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete post"
        ) from e
