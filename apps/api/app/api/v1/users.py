"""
User profile endpoints.
"""

import logging
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, Request, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.services.user_service import UserService
from app.services.mention_service import MentionService
from app.services.profile_photo_service import ProfilePhotoService
from app.core.responses import success_response

logger = logging.getLogger(__name__)
router = APIRouter()


class UserProfileUpdate(BaseModel):
    """User profile update request model."""
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    display_name: Optional[str] = None
    city: Optional[str] = None
    location_data: Optional[Dict] = None
    institutions: Optional[List[str]] = None
    websites: Optional[List[str]] = None


class UserProfileResponse(BaseModel):
    """User profile response model."""
    id: int
    username: str
    email: str
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    display_name: Optional[str] = None
    city: Optional[str] = None
    location: Optional[Dict] = None
    institutions: Optional[List[str]] = None
    websites: Optional[List[str]] = None
    created_at: str
    posts_count: int
    followers_count: int = 0  # Will be implemented with follow system
    following_count: int = 0  # Will be implemented with follow system

    model_config = ConfigDict(from_attributes=True)


class PublicUserProfileResponse(BaseModel):
    """Public user profile response model (no email)."""
    id: int
    username: str
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    display_name: Optional[str] = None
    city: Optional[str] = None
    location: Optional[Dict] = None
    institutions: Optional[List[str]] = None
    websites: Optional[List[str]] = None
    created_at: str
    posts_count: int
    followers_count: int = 0  # Will be implemented with follow system
    following_count: int = 0  # Will be implemented with follow system

    model_config = ConfigDict(from_attributes=True)


class UserPostResponse(BaseModel):
    """User post response model."""
    id: str
    content: str
    post_style: Optional[dict] = None
    post_type: str
    image_url: Optional[str] = None
    is_public: bool
    created_at: str
    updated_at: Optional[str] = None
    hearts_count: int = 0
    reactions_count: int = 0
    current_user_reaction: Optional[str] = None
    is_hearted: bool = False

    model_config = ConfigDict(from_attributes=True)


class UserSearchRequest(BaseModel):
    """User search request model."""
    query: str
    limit: Optional[int] = 10

    model_config = ConfigDict(from_attributes=True)


class UserSearchResult(BaseModel):
    """User search result model."""
    id: int
    username: str
    profile_image_url: Optional[str] = None
    bio: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UsernameValidationRequest(BaseModel):
    """Username validation request model."""
    usernames: List[str]

    model_config = ConfigDict(from_attributes=True)


class UsernameValidationResponse(BaseModel):
    """Username validation response model."""
    valid_usernames: List[str]
    invalid_usernames: List[str]

    model_config = ConfigDict(from_attributes=True)


class ProfilePhotoResponse(BaseModel):
    """Profile photo response model."""
    filename: str
    profile_image_url: str
    urls: dict
    success: bool

    model_config = ConfigDict(from_attributes=True)





@router.get("/me/profile")
async def get_my_profile(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's profile."""
    user_service = UserService(db)
    result = await user_service.get_user_profile(current_user_id)
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.put("/me/profile")
async def update_my_profile(
    profile_update: UserProfileUpdate,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile."""
    user_service = UserService(db)
    result = await user_service.update_user_profile(
        user_id=current_user_id,
        username=profile_update.username,
        bio=profile_update.bio,
        profile_image_url=profile_update.profile_image_url,
        display_name=profile_update.display_name,
        city=profile_update.city,
        location_data=profile_update.location_data,
        institutions=profile_update.institutions,
        websites=profile_update.websites
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.get("/me/posts")
async def get_my_posts(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's posts with engagement data."""
    user_service = UserService(db)
    result = await user_service.get_user_posts(
        user_id=current_user_id,
        current_user_id=current_user_id,
        public_only=False
    )
    
    # Add logging to trace data shape
    from fastapi.encoders import jsonable_encoder
    logger.debug("users.get_my_posts - result payload: %s", jsonable_encoder(result))
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.get("/{user_id}/profile")
async def get_user_profile(
    user_id: int,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get another user's profile."""
    user_service = UserService(db)
    result = await user_service.get_public_user_profile(user_id)
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.get("/{user_id}/posts")
async def get_user_posts(
    user_id: int,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get another user's posts with engagement data."""
    user_service = UserService(db)
    result = await user_service.get_user_posts(
        user_id=user_id,
        current_user_id=current_user_id,
        public_only=True  # Only show public posts for other users
    )
    
    # Add logging to trace data shape
    from fastapi.encoders import jsonable_encoder
    logger.debug("users.get_user_posts - result payload: %s", jsonable_encoder(result))
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.get("/username/{username}")
async def get_user_by_username(
    username: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user profile by username.
    
    - **username**: Username to look up
    
    Returns user profile data if found.
    """
    user_service = UserService(db)
    result = await user_service.get_user_by_username(username)
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.get("/by-username/{username}")
async def resolve_username_to_id(
    username: str,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Resolve username to user ID for navigation purposes.
    
    - **username**: Username to resolve
    
    Returns minimal user data with ID and username for profile navigation.
    """
    user_service = UserService(db)
    result = await user_service.resolve_username_to_id(username)
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.post("/search")
async def search_users(
    search_request: UserSearchRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Search users by username for mention autocomplete.
    
    - **query**: Search query (partial username)
    - **limit**: Maximum number of results (1-50, default: 10)
    
    Returns list of users matching the search query.
    Excludes the current user from results.
    """
    # Validate limit
    limit = min(max(search_request.limit or 10, 1), 50)
    
    mention_service = MentionService(db)
    result = await mention_service.search_users(
        query=search_request.query,
        limit=limit,
        exclude_user_id=current_user_id
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.post("/validate-batch")
async def validate_usernames_batch(
    validation_request: UsernameValidationRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Validate multiple usernames in a single request.
    
    - **usernames**: List of usernames to validate (max 50)
    
    Returns which usernames are valid (exist in database) and which are invalid.
    This prevents 404 errors when checking mention validity.
    """
    # Validate input
    if not validation_request.usernames:
        return success_response(
            UsernameValidationResponse(valid_usernames=[], invalid_usernames=[]),
            getattr(request.state, 'request_id', None)
        )
    
    # Limit to 50 usernames to prevent abuse
    usernames = validation_request.usernames[:50]
    
    # Remove duplicates while preserving order
    unique_usernames = list(dict.fromkeys(usernames))
    
    user_service = UserService(db)
    result = await user_service.validate_usernames_batch(unique_usernames)
    
    return success_response(result, getattr(request.state, 'request_id', None))

@router.post("/me/profile/photo/check-duplicate")
async def check_profile_photo_duplicate(
    request: Request,
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if a profile photo is a duplicate before uploading.
    
    - **file**: Image file to check for duplicates
    
    Returns duplicate check results including exact matches and similar images.
    """
    try:
        photo_service = ProfilePhotoService(db)
        result = await photo_service.check_profile_photo_duplicate(current_user_id, file)
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        logger.error(f"Error checking profile photo duplicate: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/me/profile/photo")
async def upload_profile_photo(
    request: Request,
    file: UploadFile = File(...),
    force_upload: bool = False,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload profile photo with deduplication.
    
    - **file**: Image file (JPEG, PNG, WebP, max 5MB)
    - **force_upload**: If true, upload even if duplicate exists
    
    Returns profile photo data with URLs for different sizes.
    Automatically creates thumbnail, small, medium, and large variants.
    Includes deduplication information if duplicates are detected.
    """
    try:
        photo_service = ProfilePhotoService(db)
        result = await photo_service.upload_profile_photo(current_user_id, file, force_upload)
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        logger.error(f"Error uploading profile photo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/me/profile/photo")
async def delete_profile_photo(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete current profile photo.
    
    Removes profile photo and all variants from storage.
    """
    try:
        photo_service = ProfilePhotoService(db)
        result = await photo_service.delete_profile_photo(current_user_id)
        
        return success_response({"deleted": result}, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        logger.error(f"Error deleting profile photo for user {current_user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/me/profile/photo/default")
async def get_default_avatar(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get default avatar URL for current user.
    
    Returns a generated avatar URL based on user ID.
    """
    photo_service = ProfilePhotoService(db)
    avatar_url = await photo_service.get_default_avatar_url(current_user_id)
    
    return success_response({"avatar_url": avatar_url}, getattr(request.state, 'request_id', None))


class LocationSearchRequest(BaseModel):
    """Location search request model."""
    query: str
    limit: Optional[int] = 10
    max_length: Optional[int] = 150

    model_config = ConfigDict(from_attributes=True)


class LocationResult(BaseModel):
    """Location search result model."""
    display_name: str
    lat: float
    lon: float
    place_id: Optional[str] = None
    address: dict
    importance: Optional[float] = None
    type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


@router.post("/location/search")
async def search_locations(
    search_request: LocationSearchRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for locations using OpenStreetMap Nominatim API.
    
    - **query**: Search query (city, neighborhood, place name, minimum 2 characters)
    - **limit**: Maximum number of results (1-10, default: 10)
    - **max_length**: Maximum length for location display names (default: 150)
    
    Returns list of location suggestions with display names, coordinates, and address data.
    Used for location autocomplete in profile editing.
    """
    from app.services.location_service import LocationService
    
    # Validate limit and max_length
    limit = min(max(search_request.limit or 10, 1), 10)
    max_length = min(max(search_request.max_length or 150, 50), 300)
    
    location_service = LocationService(db)
    try:
        results = await location_service.search_locations(
            query=search_request.query,
            limit=limit,
            max_length=max_length
        )
        
        return success_response(results, getattr(request.state, 'request_id', None))
        
    finally:
        # Clean up HTTP client
        await location_service.cleanup()