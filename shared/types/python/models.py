"""
Python equivalent of TypeScript shared types for backend integration.
These Pydantic models mirror the TypeScript interfaces for API contracts.
"""

from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, EmailStr, validator
import uuid

# ============================================================================
# Core Enums (matching TypeScript enums)
# ============================================================================

class PostType(str, Enum):
    DAILY = "daily"
    PHOTO = "photo"
    SPONTANEOUS = "spontaneous"

class EmojiCode(str, Enum):
    HEART_EYES = "heart_eyes"
    HUG = "hug"
    PRAY = "pray"
    MUSCLE = "muscle"
    STAR = "star"
    FIRE = "fire"
    HEART_FACE = "heart_face"
    CLAP = "clap"

class NotificationType(str, Enum):
    EMOJI_REACTION = "emoji_reaction"
    POST_SHARED = "post_shared"
    MENTION = "mention"
    NEW_FOLLOWER = "new_follower"
    SHARE_MILESTONE = "share_milestone"
    HEART = "heart"

class ShareMethod(str, Enum):
    URL = "url"
    MESSAGE = "message"

class FollowStatus(str, Enum):
    ACTIVE = "active"
    PENDING = "pending"
    BLOCKED = "blocked"

class PrivacyLevel(str, Enum):
    PUBLIC = "public"
    FOLLOWERS = "followers"
    PRIVATE = "private"

class ErrorType(str, Enum):
    INVALID_TOKEN = "invalid_token"
    TOKEN_EXPIRED = "token_expired"
    UNAUTHORIZED = "unauthorized"
    VALIDATION_ERROR = "validation_error"
    INVALID_INPUT = "invalid_input"
    MISSING_REQUIRED_FIELD = "missing_required_field"
    NOT_FOUND = "not_found"
    ALREADY_EXISTS = "already_exists"
    PERMISSION_DENIED = "permission_denied"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INVALID_EMOJI_CODE = "invalid_emoji_code"
    CONTENT_TOO_LONG = "content_too_long"
    INVALID_POST_TYPE = "invalid_post_type"
    SELF_FOLLOW_FORBIDDEN = "self_follow_forbidden"
    ALREADY_REACTED = "already_reacted"
    NO_REACTION_TO_REMOVE = "no_reaction_to_remove"
    DATABASE_ERROR = "database_error"
    EXTERNAL_SERVICE_ERROR = "external_service_error"
    INTERNAL_ERROR = "internal_error"

# ============================================================================
# Constants
# ============================================================================

POST_TYPE_LIMITS = {
    PostType.DAILY: 500,
    PostType.PHOTO: 300,
    PostType.SPONTANEOUS: 200
}

EMOJI_DISPLAY = {
    EmojiCode.HEART_EYES: "😍",
    EmojiCode.HUG: "🤗",
    EmojiCode.PRAY: "🙏",
    EmojiCode.MUSCLE: "💪",
    EmojiCode.STAR: "⭐",
    EmojiCode.FIRE: "🔥",
    EmojiCode.HEART_FACE: "🥰",
    EmojiCode.CLAP: "👏"
}

RATE_LIMITS = {
    "SHARES_PER_HOUR": 20,
    "NOTIFICATIONS_PER_HOUR": 5,
    "MENTIONS_PER_POST": 10,
    "SHARE_RECIPIENTS_MAX": 5
}

# ============================================================================
# Base Models
# ============================================================================

class BaseEntity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime
    updated_at: Optional[datetime] = None

class UserIdentity(BaseModel):
    id: int
    username: str
    email: EmailStr

class UserInfo(UserIdentity):
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    created_at: datetime

# ============================================================================
# Authentication API Models
# ============================================================================

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @validator('username')
    def validate_username(cls, v):
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, underscores, and hyphens')
        return v

class SignupResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class SessionResponse(BaseModel):
    id: int
    email: EmailStr
    username: str

# ============================================================================
# Posts API Models
# ============================================================================

class CreatePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
    post_type: PostType
    title: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = None
    location: Optional[str] = Field(None, max_length=100)
    is_public: bool = True

    @validator('content')
    def validate_content_length(cls, v, values):
        if 'post_type' in values:
            max_length = POST_TYPE_LIMITS[values['post_type']]
            if len(v) > max_length:
                raise ValueError(f'Content too long. Maximum {max_length} characters for {values["post_type"]} posts')
        return v

class PostResponse(BaseModel):
    id: str
    author_id: int
    title: Optional[str] = None
    content: str
    post_type: PostType
    image_url: Optional[str] = None
    location: Optional[str] = None
    is_public: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    author: UserInfo
    hearts_count: int = 0
    reactions_count: int = 0
    current_user_reaction: Optional[EmojiCode] = None
    is_hearted: Optional[bool] = False

# ============================================================================
# Reactions API Models
# ============================================================================

class AddReactionRequest(BaseModel):
    emoji_code: EmojiCode

class ReactionResponse(BaseModel):
    id: str
    user_id: int
    post_id: str
    emoji_code: EmojiCode
    emoji_display: str
    created_at: datetime
    user: UserInfo

    @validator('emoji_display', pre=True, always=True)
    def set_emoji_display(cls, v, values):
        if 'emoji_code' in values:
            return EMOJI_DISPLAY.get(values['emoji_code'], '❓')
        return v

class ReactionSummaryResponse(BaseModel):
    total_count: int
    emoji_counts: Dict[EmojiCode, int]
    user_reaction: Optional[EmojiCode] = None

class GetPostReactionsResponse(BaseModel):
    reactions: List[ReactionResponse]
    total_count: int

# ============================================================================
# Notifications API Models
# ============================================================================

class NotificationResponse(BaseModel):
    id: str
    user_id: int
    type: NotificationType
    message: str
    read: bool
    post_id: Optional[str] = None
    related_user_id: Optional[int] = None
    emoji_code: Optional[EmojiCode] = None
    created_at: datetime
    last_updated_at: Optional[datetime] = None
    
    # Batching fields
    is_batch: bool = False
    batch_count: int = 1
    parent_id: Optional[str] = None
    
    # Relations
    related_user: Optional[UserInfo] = None
    post: Optional[PostResponse] = None

class GetNotificationsResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    total_count: int
    has_more: bool

class MarkNotificationsReadRequest(BaseModel):
    notification_ids: List[str]

class MarkNotificationsReadResponse(BaseModel):
    marked_count: int

# ============================================================================
# Error Models
# ============================================================================

class ValidationErrorDetail(BaseModel):
    field: str
    message: str
    code: str
    value: Optional[Any] = None

class BaseError(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None

class ValidationError(BaseError):
    error: str = ErrorType.VALIDATION_ERROR
    details: Dict[str, List[ValidationErrorDetail]]

class RateLimitError(BaseError):
    error: str = ErrorType.RATE_LIMIT_EXCEEDED
    details: Dict[str, Union[int, str]] = Field(..., example={
        "limit": 20,
        "reset_time": "2025-01-08T15:30:00Z",
        "retry_after": 3600
    })

class NotFoundError(BaseError):
    error: str = ErrorType.NOT_FOUND
    details: Dict[str, Union[str, int]] = Field(..., example={
        "resource": "post",
        "id": "123"
    })

class ApiErrorResponse(BaseModel):
    success: bool = False
    error: BaseError
    timestamp: datetime
    request_id: Optional[str] = None

class ApiSuccessResponse(BaseModel):
    success: bool = True
    data: Any
    timestamp: datetime
    request_id: Optional[str] = None

# ============================================================================
# Pagination Models
# ============================================================================

class PaginationParams(BaseModel):
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)

class PaginatedResponse(BaseModel):
    data: List[Any]
    total_count: int
    limit: int
    offset: int
    has_more: bool

# ============================================================================
# Service Layer Models
# ============================================================================

class ReactionCreateData(BaseModel):
    user_id: int
    post_id: str
    emoji_code: EmojiCode

class NotificationCreateData(BaseModel):
    user_id: int
    type: NotificationType
    message: str
    post_id: Optional[str] = None
    related_user_id: Optional[int] = None
    emoji_code: Optional[EmojiCode] = None
    data: Optional[Dict[str, Any]] = None

class ShareViaMessageData(BaseModel):
    sender_id: int
    post_id: str
    recipient_ids: List[int] = Field(..., max_items=RATE_LIMITS["SHARE_RECIPIENTS_MAX"])
    message_content: Optional[str] = Field(None, max_length=200)

class EngagementMetrics(BaseModel):
    hearts_count: int
    reactions_count: int
    shares_count: int
    comments_count: int = 0
    engagement_score: float

class UserStats(BaseModel):
    posts_count: int
    followers_count: int
    following_count: int
    total_hearts_received: int
    total_reactions_received: int
    total_shares_received: int
    join_date: datetime
    last_active: datetime

# ============================================================================
# Configuration Models
# ============================================================================

class FeedAlgorithmConfig(BaseModel):
    heart_weight: float = 1.0
    reaction_weight: float = 1.5
    share_weight: float = 4.0
    photo_bonus: float = 2.5
    daily_gratitude_multiplier: float = 3.0
    relationship_multiplier: float = 2.0
    recency_decay_hours: int = 24
    high_score_threshold: float = 10.0
    feed_mix_ratio: float = 0.8

class NotificationBatchingConfig(BaseModel):
    max_notifications_per_hour: int = RATE_LIMITS["NOTIFICATIONS_PER_HOUR"]
    batch_window_minutes: int = 60
    batch_threshold: int = 2

# ============================================================================
# Utility Functions
# ============================================================================

def create_api_success_response(data: Any, request_id: Optional[str] = None) -> ApiSuccessResponse:
    """Create a standardized success response."""
    return ApiSuccessResponse(
        success=True,
        data=data,
        timestamp=datetime.utcnow(),
        request_id=request_id
    )

def create_api_error_response(
    error_type: ErrorType,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None
) -> ApiErrorResponse:
    """Create a standardized error response."""
    return ApiErrorResponse(
        success=False,
        error=BaseError(
            error=error_type,
            message=message,
            details=details
        ),
        timestamp=datetime.utcnow(),
        request_id=request_id
    )

def validate_emoji_code(emoji_code: str) -> bool:
    """Validate if emoji code is valid."""
    try:
        EmojiCode(emoji_code)
        return True
    except ValueError:
        return False

def get_post_content_max_length(post_type: PostType) -> int:
    """Get maximum content length for post type."""
    return POST_TYPE_LIMITS[post_type]

def get_emoji_display(emoji_code: EmojiCode) -> str:
    """Get emoji display character for code."""
    return EMOJI_DISPLAY.get(emoji_code, '❓')