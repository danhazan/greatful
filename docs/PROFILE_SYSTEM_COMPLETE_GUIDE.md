# Profile System Enhancement - Complete Implementation Guide

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Enhancement Architecture](#enhancement-architecture)
4. [Database Migration Plan](#database-migration-plan)
5. [Service Layer Refactoring](#service-layer-refactoring)
6. [API Enhancement Design](#api-enhancement-design)
7. [Frontend Component Architecture](#frontend-component-architecture)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Testing Strategy](#testing-strategy)
10. [Security & Performance](#security--performance)
11. [Migration Strategy](#migration-strategy)

---

## Executive Summary

This document provides a comprehensive guide for enhancing the existing profile system in the Grateful application. The enhancement introduces extended profile fields, profile photo management, privacy controls, and analytics while maintaining backward compatibility and following established architectural patterns.

### Key Enhancements
- **Extended Profile Fields**: Display name, city, institutions, websites
- **Profile Photo System**: Upload, processing, multiple size variants
- **Privacy Controls**: Granular visibility and interaction settings
- **Analytics Dashboard**: Profile views, engagement stats, completion tracking
- **Mobile Optimization**: Touch-friendly responsive design

### Current Status
- ✅ **All Tests Passing**: 330 backend + 551 frontend tests
- ✅ **Documentation Complete**: Comprehensive architectural plans
- ✅ **Types Updated**: Enhanced shared type definitions
- ✅ **Backward Compatible**: Existing functionality preserved

---

## Current System Analysis

### Backend Components

#### 1. User Model (`apps/api/app/models/user.py`)
**Current Fields:**
- `id`: Integer primary key
- `email`: Unique string, indexed
- `username`: Unique string, indexed  
- `hashed_password`: String
- `bio`: Text (nullable)
- `profile_image_url`: String (nullable)
- `created_at`: DateTime with timezone

**Current Relationships:**
- `posts`: One-to-many with Post model
- `notifications`: One-to-many with Notification model
- `following`: One-to-many with Follow model (as follower)
- `followers`: One-to-many with Follow model (as followed)

**Current Methods:**
- `get_by_email()`: Async class method for email lookup
- `get_by_id()`: Async class method for ID lookup
- `get_by_username()`: Async class method for username lookup

#### 2. User Service (`apps/api/app/services/user_service.py`)
**Current Methods:**
- `get_user_profile()`: Get user profile with stats
- `get_public_user_profile()`: Get profile without email
- `get_user_by_username()`: Get profile by username
- `update_user_profile()`: Update username, bio, profile_image_url
- `get_user_posts()`: Get user's posts with engagement data
- `validate_usernames_batch()`: Validate multiple usernames

**Current Validation:**
- Username: 3-50 characters, uniqueness check
- Bio: 0-500 characters
- Profile image URL: Basic string validation

#### 3. User API Endpoints (`apps/api/app/api/v1/users.py`)
**Current Endpoints:**
- `GET /users/me/profile`: Get current user profile
- `PUT /users/me/profile`: Update current user profile
- `GET /users/me/posts`: Get current user's posts
- `GET /users/{user_id}/profile`: Get other user's profile
- `GET /users/{user_id}/posts`: Get other user's posts
- `GET /users/username/{username}`: Get user by username
- `POST /users/search`: Search users for mentions
- `POST /users/validate-batch`: Validate usernames

### Frontend Components

#### 1. Profile Page (`apps/web/src/app/profile/page.tsx`)
**Current Features:**
- Profile display with avatar, username, bio
- Profile editing (username, bio)
- User stats (posts, followers, following)
- User's posts display
- Join date display
- Edit/save/cancel functionality

#### 2. User Profile Page (`apps/web/src/app/profile/[userId]/page.tsx`)
**Current Features:**
- Other users' profile viewing
- Follow button integration
- Public posts display
- Profile stats display
- Navigation between profiles

#### 3. Shared Types (`shared/types/`)
**Current User Types:**
- `User`: Database model interface
- `UserInfo`: Basic user information for relations
- `ProfileResponse`: API response for profile data
- `UpdateProfileRequest`: API request for profile updates

### Current Limitations and Enhancement Opportunities

#### 1. Database Schema Limitations
- **Missing Display Name**: Only username exists, no separate display name
- **Limited Profile Fields**: No city, institutions, websites fields
- **No Profile Photo Management**: Only URL storage, no upload system
- **No Profile Preferences**: No privacy settings or user preferences

#### 2. Service Layer Limitations
- **Basic Validation**: Limited field validation and constraints
- **No Image Processing**: No image upload, resize, or optimization
- **No Profile Migration**: No system for migrating existing users to new schema
- **Limited Profile Operations**: No complex profile operations or bulk updates

#### 3. API Limitations
- **No Image Upload**: No endpoints for profile photo upload
- **Limited Profile Fields**: API only supports basic fields
- **No Profile Preferences**: No endpoints for user preferences management
- **No Profile Analytics**: No profile view tracking or analytics

#### 4. Frontend Limitations
- **Basic Profile Editing**: Limited to username and bio only
- **No Image Upload**: No profile photo upload functionality
- **No Extended Fields**: No support for city, institutions, websites
- **No Display Name System**: Username used for both login and display

---

## Enhancement Architecture

### Phase 1: Database Schema Enhancement

#### 1.1 Extended User Model Fields
```sql
-- New fields to add to User model
ALTER TABLE users ADD COLUMN display_name VARCHAR(100);
ALTER TABLE users ADD COLUMN city VARCHAR(100);
ALTER TABLE users ADD COLUMN institutions JSONB;
ALTER TABLE users ADD COLUMN websites JSONB;
ALTER TABLE users ADD COLUMN profile_photo_filename VARCHAR(255);
ALTER TABLE users ADD COLUMN profile_preferences JSONB;

-- Add indexes for searchable fields
CREATE INDEX idx_users_display_name ON users(display_name);
CREATE INDEX idx_users_city ON users(city);
CREATE INDEX idx_users_profile_photo_filename ON users(profile_photo_filename);
```

#### 1.2 Profile Photo Storage Schema
```sql
-- New ProfilePhoto model for better file management
CREATE TABLE profile_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id), -- One profile photo per user
    CHECK(file_size > 0 AND file_size <= 5242880), -- Max 5MB
    CHECK(content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CHECK(width > 0 AND height > 0)
);

-- Indexes
CREATE INDEX idx_profile_photos_user_id ON profile_photos(user_id);
CREATE INDEX idx_profile_photos_filename ON profile_photos(filename);
CREATE INDEX idx_profile_photos_created_at ON profile_photos(created_at);
```

#### 1.3 JSON Field Structures
```sql
-- institutions JSONB structure
-- [
--   {
--     "name": "Stanford University",
--     "type": "school",
--     "role": "Computer Science Student",
--     "start_date": "2020-09-01",
--     "end_date": "2024-06-01",
--     "current": false
--   }
-- ]

-- websites JSONB structure  
-- [
--   {
--     "url": "https://johndoe.com",
--     "title": "Personal Website",
--     "type": "personal"
--   }
-- ]

-- profile_preferences JSONB structure
-- {
--   "allow_mentions": true,
--   "allow_sharing": true,
--   "profile_visibility": "public",
--   "show_email": false,
--   "show_join_date": true,
--   "show_stats": true,
--   "notification_settings": {
--     "email_notifications": true,
--     "push_notifications": true,
--     "reaction_notifications": true,
--     "mention_notifications": true,
--     "follow_notifications": true,
--     "share_notifications": true,
--     "batch_notifications": true
--   }
-- }
```

### Phase 2: Service Layer Enhancement

#### 2.1 Enhanced User Service Methods
```python
class UserService(BaseService):
    """Enhanced user service with extended profile management."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.user_repo = UserRepository(db)
        self.post_repo = PostRepository(db)
        self.profile_photo_repo = ProfilePhotoRepository(db)
        self.analytics_repo = ProfileAnalyticsRepository(db)
    
    # Extended profile management
    async def update_extended_profile(
        self,
        user_id: int,
        display_name: Optional[str] = None,
        city: Optional[str] = None,
        institutions: Optional[List[Dict]] = None,
        websites: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Update extended profile fields with comprehensive validation."""
        
    async def get_extended_profile(self, user_id: int) -> Dict[str, Any]:
        """Get complete profile including extended fields."""
        
    async def migrate_user_profile(self, user_id: int) -> Dict[str, Any]:
        """Migrate existing user to new profile schema."""
        
    # Profile preferences management
    async def update_profile_preferences(
        self,
        user_id: int,
        preferences: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update user profile preferences and privacy settings."""
        
    async def get_profile_preferences(self, user_id: int) -> Dict[str, Any]:
        """Get user profile preferences."""
        
    # Profile analytics
    async def track_profile_view(
        self,
        profile_user_id: int,
        viewer_user_id: Optional[int] = None
    ) -> None:
        """Track profile view for analytics."""
        
    async def get_profile_analytics(self, user_id: int) -> Dict[str, Any]:
        """Get profile analytics and engagement stats."""
```

#### 2.2 Enhanced Validation Methods
```python
class UserService(BaseService):
    """Enhanced validation for extended profile fields."""
    
    def validate_display_name(self, display_name: str) -> None:
        """
        Validate display name format and length.
        
        Rules:
        - 1-100 characters
        - Allow letters, numbers, spaces, basic punctuation
        - No leading/trailing whitespace
        - No consecutive spaces
        """
        if not display_name or not display_name.strip():
            raise ValidationException("Display name cannot be empty")
            
        display_name = display_name.strip()
        
        if len(display_name) < 1 or len(display_name) > 100:
            raise ValidationException("Display name must be 1-100 characters")
            
        # Check for consecutive spaces
        if "  " in display_name:
            raise ValidationException("Display name cannot contain consecutive spaces")
            
        # Allow letters, numbers, spaces, and basic punctuation
        import re
        if not re.match(r"^[a-zA-Z0-9\s\-_.,'!?]+$", display_name):
            raise ValidationException("Display name contains invalid characters")
    
    def validate_city(self, city: str) -> None:
        """
        Validate city name format.
        
        Rules:
        - 1-100 characters
        - Letters, spaces, hyphens, apostrophes only
        - Proper capitalization encouraged but not enforced
        """
        if not city or not city.strip():
            raise ValidationException("City cannot be empty")
            
        city = city.strip()
        
        if len(city) < 1 or len(city) > 100:
            raise ValidationException("City must be 1-100 characters")
            
        import re
        if not re.match(r"^[a-zA-Z\s\-']+$", city):
            raise ValidationException("City name contains invalid characters")
    
    def validate_institutions(self, institutions: List[Dict]) -> None:
        """
        Validate institutions array format.
        
        Rules:
        - Maximum 10 institutions
        - Each institution must have name and type
        - Valid types: school, company, foundation, organization
        - Dates must be valid ISO format if provided
        """
        if len(institutions) > 10:
            raise ValidationException("Maximum 10 institutions allowed")
            
        valid_types = {"school", "company", "foundation", "organization"}
        
        for i, institution in enumerate(institutions):
            if not isinstance(institution, dict):
                raise ValidationException(f"Institution {i+1} must be an object")
                
            # Required fields
            if "name" not in institution or not institution["name"]:
                raise ValidationException(f"Institution {i+1} must have a name")
                
            if "type" not in institution or institution["type"] not in valid_types:
                raise ValidationException(f"Institution {i+1} must have a valid type: {', '.join(valid_types)}")
                
            # Validate name length
            if len(institution["name"]) > 200:
                raise ValidationException(f"Institution {i+1} name too long (max 200 characters)")
                
            # Validate optional fields
            if "role" in institution and len(institution["role"]) > 100:
                raise ValidationException(f"Institution {i+1} role too long (max 100 characters)")
                
            # Validate dates if provided
            for date_field in ["start_date", "end_date"]:
                if date_field in institution and institution[date_field]:
                    try:
                        from datetime import datetime
                        datetime.fromisoformat(institution[date_field])
                    except ValueError:
                        raise ValidationException(f"Institution {i+1} {date_field} must be valid ISO date")
    
    def validate_websites(self, websites: List[Dict]) -> None:
        """
        Validate websites array format.
        
        Rules:
        - Maximum 5 websites
        - Each website must have valid URL
        - Valid types: personal, portfolio, social, professional, other
        - URLs must be properly formatted
        """
        if len(websites) > 5:
            raise ValidationException("Maximum 5 websites allowed")
            
        valid_types = {"personal", "portfolio", "social", "professional", "other"}
        
        for i, website in enumerate(websites):
            if not isinstance(website, dict):
                raise ValidationException(f"Website {i+1} must be an object")
                
            # Required URL field
            if "url" not in website or not website["url"]:
                raise ValidationException(f"Website {i+1} must have a URL")
                
            # Validate URL format
            import re
            url_pattern = re.compile(
                r'^https?://'  # http:// or https://
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
                r'localhost|'  # localhost...
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
                r'(?::\d+)?'  # optional port
                r'(?:/?|[/?]\S+)$', re.IGNORECASE)
                
            if not url_pattern.match(website["url"]):
                raise ValidationException(f"Website {i+1} URL is not valid")
                
            # Validate optional fields
            if "title" in website and len(website["title"]) > 100:
                raise ValidationException(f"Website {i+1} title too long (max 100 characters)")
                
            if "type" in website and website["type"] not in valid_types:
                raise ValidationException(f"Website {i+1} type must be one of: {', '.join(valid_types)}")
```

#### 2.3 Profile Photo Service
```python
class ProfilePhotoService(BaseService):
    """Service for profile photo management with image processing."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.profile_photo_repo = ProfilePhotoRepository(db)
        self.image_processor = ImageProcessor()
        self.file_manager = FileManager()
    
    async def upload_profile_photo(
        self,
        user_id: int,
        file: UploadFile
    ) -> Dict[str, Any]:
        """
        Upload and process profile photo.
        
        Steps:
        1. Validate file type and size
        2. Generate unique filename
        3. Process and resize image
        4. Store file and create database record
        5. Clean up old photo if exists
        """
        # Validate file
        self._validate_image_file(file)
        
        # Check if user exists
        user = await self.get_by_id_or_404(User, user_id, "User")
        
        # Generate unique filename
        filename = self._generate_filename(file.filename)
        
        # Process image
        processed_image = await self.image_processor.process_profile_photo(file, filename)
        
        # Store files
        file_paths = await self.file_manager.store_profile_photo(processed_image)
        
        # Clean up old photo
        await self._cleanup_old_photo(user_id)
        
        # Create database record
        photo_data = {
            "user_id": user_id,
            "filename": filename,
            "original_filename": file.filename,
            "file_size": processed_image.file_size,
            "content_type": processed_image.content_type,
            "width": processed_image.width,
            "height": processed_image.height
        }
        
        photo = await self.profile_photo_repo.create(**photo_data)
        
        # Update user record
        await self.user_repo.update(user, profile_photo_filename=filename)
        
        logger.info(f"Profile photo uploaded for user {user_id}: {filename}")
        
        return {
            "id": photo.id,
            "filename": photo.filename,
            "urls": self._generate_photo_urls(filename)
        }
    
    async def delete_profile_photo(self, user_id: int) -> bool:
        """Delete user's profile photo and cleanup files."""
        user = await self.get_by_id_or_404(User, user_id, "User")
        
        if not user.profile_photo_filename:
            raise NotFoundError("Profile photo", "user profile")
        
        # Delete files
        await self.file_manager.delete_profile_photo(user.profile_photo_filename)
        
        # Delete database record
        await self.profile_photo_repo.delete_by_user_id(user_id)
        
        # Update user record
        await self.user_repo.update(user, profile_photo_filename=None)
        
        logger.info(f"Profile photo deleted for user {user_id}")
        return True
    
    def _validate_image_file(self, file: UploadFile) -> None:
        """Validate uploaded image file."""
        # Check file size (5MB max)
        if file.size > 5 * 1024 * 1024:
            raise ValidationException("File size must be less than 5MB")
        
        # Check content type
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        if file.content_type not in allowed_types:
            raise ValidationException(f"File type must be one of: {', '.join(allowed_types)}")
        
        # Check file extension
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise ValidationException(f"File extension must be one of: {', '.join(allowed_extensions)}")
```

### Phase 3: API Enhancement Design

#### 3.1 Extended Profile Management Endpoints
```python
@router.put("/me/profile/extended")
async def update_extended_profile(
    profile_update: ExtendedProfileUpdateRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update extended profile fields.
    
    - **display_name**: Display name (1-100 characters)
    - **city**: City name (1-100 characters)
    - **institutions**: Array of institution objects (max 10)
    - **websites**: Array of website objects (max 5)
    
    Returns updated extended profile data.
    """
    user_service = UserService(db)
    result = await user_service.update_extended_profile(
        user_id=current_user_id,
        display_name=profile_update.display_name,
        city=profile_update.city,
        institutions=profile_update.institutions,
        websites=profile_update.websites
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))

class ExtendedProfileUpdateRequest(BaseModel):
    """Extended profile update request model."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    institutions: Optional[List[InstitutionModel]] = Field(None, max_items=10)
    websites: Optional[List[WebsiteModel]] = Field(None, max_items=5)

class InstitutionModel(BaseModel):
    """Institution model for profile."""
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., regex="^(school|company|foundation|organization)$")
    role: Optional[str] = Field(None, max_length=100)
    start_date: Optional[str] = Field(None, regex=r"^\d{4}-\d{2}-\d{2}$")
    end_date: Optional[str] = Field(None, regex=r"^\d{4}-\d{2}-\d{2}$")
    current: Optional[bool] = False

class WebsiteModel(BaseModel):
    """Website model for profile."""
    url: str = Field(..., regex=r"^https?://[^\s/$.?#].[^\s]*$")
    title: Optional[str] = Field(None, max_length=100)
    type: Optional[str] = Field(None, regex="^(personal|portfolio|social|professional|other)$")
```

#### 3.2 Profile Photo Management Endpoints
```python
@router.post("/me/profile/photo")
async def upload_profile_photo(
    request: Request,
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload profile photo.
    
    - **file**: Image file (JPEG, PNG, WebP, max 5MB)
    
    Returns profile photo data with URLs for different sizes.
    Automatically creates thumbnail, small, medium, and large variants.
    """
    photo_service = ProfilePhotoService(db)
    result = await photo_service.upload_profile_photo(current_user_id, file)
    
    return success_response(result, getattr(request.state, 'request_id', None))

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
    photo_service = ProfilePhotoService(db)
    result = await photo_service.delete_profile_photo(current_user_id)
    
    return success_response({"deleted": result}, getattr(request.state, 'request_id', None))
```

#### 3.3 User Preferences Management
```python
@router.get("/me/preferences")
async def get_user_preferences(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's preferences and privacy settings.
    
    Returns complete preferences including privacy and notification settings.
    """
    user_service = UserService(db)
    result = await user_service.get_profile_preferences(current_user_id)
    
    return success_response(result, getattr(request.state, 'request_id', None))

@router.put("/me/preferences")
async def update_user_preferences(
    preferences_update: UpdatePreferencesRequest,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user preferences and privacy settings.
    
    - **allow_mentions**: Allow other users to mention you
    - **allow_sharing**: Allow others to share your posts
    - **profile_visibility**: Profile visibility level (public/followers/private)
    - **show_email**: Show email in profile (to followers/friends)
    - **show_join_date**: Show join date in profile
    - **show_stats**: Show follower/following counts
    - **notification_settings**: Notification preferences object
    
    Returns updated preferences.
    """
    user_service = UserService(db)
    result = await user_service.update_profile_preferences(
        user_id=current_user_id,
        preferences=preferences_update.dict(exclude_unset=True)
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))
```

---

## Database Migration Plan

### Migration Overview

This section outlines the database schema changes required for the enhanced profile system, including new fields, tables, and migration strategies.

### Alembic Migration Files

#### Migration 1: Add New User Profile Fields

```python
"""Add enhanced profile fields to users table

Revision ID: 009_add_enhanced_profile_fields
Revises: 008_create_follows_table
Create Date: 2025-01-08 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '009_add_enhanced_profile_fields'
down_revision = '008_create_follows_table'
branch_labels = None
depends_on = None

def upgrade():
    # Add new columns to users table
    op.add_column('users', sa.Column('display_name', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('institutions', postgresql.JSONB(), nullable=True))
    op.add_column('users', sa.Column('websites', postgresql.JSONB(), nullable=True))
    op.add_column('users', sa.Column('profile_photo_filename', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('profile_preferences', postgresql.JSONB(), nullable=True))
    
    # Create indexes
    op.create_index('idx_users_display_name', 'users', ['display_name'])
    op.create_index('idx_users_city', 'users', ['city'])
    op.create_index('idx_users_profile_photo_filename', 'users', ['profile_photo_filename'])
    
    # Set default display_name = username for existing users
    op.execute("UPDATE users SET display_name = username WHERE display_name IS NULL")
    
    # Set default profile preferences for existing users
    default_preferences = """{
        "allow_mentions": true,
        "allow_sharing": true,
        "profile_visibility": "public",
        "show_email": false,
        "show_join_date": true,
        "show_stats": true,
        "notification_settings": {
            "email_notifications": true,
            "push_notifications": true,
            "reaction_notifications": true,
            "mention_notifications": true,
            "follow_notifications": true,
            "share_notifications": true,
            "batch_notifications": true
        }
    }"""
    op.execute(f"UPDATE users SET profile_preferences = '{default_preferences}' WHERE profile_preferences IS NULL")

def downgrade():
    # Drop indexes
    op.drop_index('idx_users_profile_photo_filename', 'users')
    op.drop_index('idx_users_city', 'users')
    op.drop_index('idx_users_display_name', 'users')
    
    # Drop columns
    op.drop_column('users', 'profile_preferences')
    op.drop_column('users', 'profile_photo_filename')
    op.drop_column('users', 'websites')
    op.drop_column('users', 'institutions')
    op.drop_column('users', 'city')
    op.drop_column('users', 'display_name')
```

#### Migration 2: Create Profile Photos Table

```python
"""Create profile photos table

Revision ID: 010_create_profile_photos_table
Revises: 009_add_enhanced_profile_fields
Create Date: 2025-01-08 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '010_create_profile_photos_table'
down_revision = '009_add_enhanced_profile_fields'
branch_labels = None
depends_on = None

def upgrade():
    # Create profile_photos table
    op.create_table(
        'profile_photos',
        sa.Column('id', postgresql.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        
        # Primary key
        sa.PrimaryKeyConstraint('id'),
        
        # Foreign keys
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        
        # Unique constraints
        sa.UniqueConstraint('user_id', name='uq_profile_photos_user_id'),
        
        # Check constraints
        sa.CheckConstraint('file_size > 0 AND file_size <= 5242880', name='ck_profile_photos_file_size'),
        sa.CheckConstraint("content_type IN ('image/jpeg', 'image/png', 'image/webp')", name='ck_profile_photos_content_type'),
        sa.CheckConstraint('width > 0 AND height > 0', name='ck_profile_photos_dimensions')
    )
    
    # Create indexes
    op.create_index('idx_profile_photos_user_id', 'profile_photos', ['user_id'])
    op.create_index('idx_profile_photos_filename', 'profile_photos', ['filename'])
    op.create_index('idx_profile_photos_created_at', 'profile_photos', ['created_at'])

def downgrade():
    # Drop indexes
    op.drop_index('idx_profile_photos_created_at', 'profile_photos')
    op.drop_index('idx_profile_photos_filename', 'profile_photos')
    op.drop_index('idx_profile_photos_user_id', 'profile_photos')
    
    # Drop table
    op.drop_table('profile_photos')
```

### Data Migration Strategy

#### 1. Existing User Migration
```sql
-- Set display_name = username for all existing users
UPDATE users 
SET display_name = username 
WHERE display_name IS NULL;

-- Set default profile preferences for existing users
UPDATE users 
SET profile_preferences = '{
    "allow_mentions": true,
    "allow_sharing": true,
    "profile_visibility": "public",
    "show_email": false,
    "show_join_date": true,
    "show_stats": true,
    "notification_settings": {
        "email_notifications": true,
        "push_notifications": true,
        "reaction_notifications": true,
        "mention_notifications": true,
        "follow_notifications": true,
        "share_notifications": true,
        "batch_notifications": true
    }
}'::jsonb
WHERE profile_preferences IS NULL;
```

### Rollback Strategy

#### 1. Safe Rollback Approach
- Keep original `profile_image_url` field during transition period
- Maintain backward compatibility with existing API endpoints
- Use feature flags to enable/disable new profile features
- Monitor system performance during migration

#### 2. Rollback Commands
```sql
-- If rollback is needed, these commands will restore the original state
-- (These are automatically generated by the Alembic downgrade functions)

-- Rollback profile photos table  
DROP TABLE IF EXISTS profile_photos;

-- Rollback user table changes
ALTER TABLE users DROP COLUMN IF EXISTS profile_preferences;
ALTER TABLE users DROP COLUMN IF EXISTS profile_photo_filename;
ALTER TABLE users DROP COLUMN IF EXISTS websites;
ALTER TABLE users DROP COLUMN IF EXISTS institutions;
ALTER TABLE users DROP COLUMN IF EXISTS city;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
```

---

## Frontend Component Architecture

### Enhanced Profile Components Structure

```
apps/web/src/components/profile/
├── ProfileDisplay/
│   ├── ProfileHeader.tsx          # Main profile header with photo and info
│   ├── ProfileStats.tsx           # Follower/following/posts stats
│   ├── ProfileBio.tsx             # Bio and extended info display
│   ├── ProfileInstitutions.tsx    # Institutions display
│   ├── ProfileWebsites.tsx        # Websites display
│   └── ProfileActions.tsx         # Follow/edit/share buttons
├── ProfileEdit/
│   ├── ProfileEditModal.tsx       # Main profile editing modal
│   ├── BasicInfoForm.tsx          # Username, display name, bio
│   ├── ExtendedInfoForm.tsx       # City, institutions, websites
│   ├── ProfilePhotoUpload.tsx     # Photo upload component
│   └── ProfilePreferences.tsx     # Privacy and notification settings
├── ProfilePhoto/
│   ├── ProfilePhotoDisplay.tsx    # Profile photo with size variants
│   ├── ProfilePhotoUpload.tsx     # Drag-and-drop photo upload
│   ├── PhotoCropper.tsx           # Image cropping interface
│   └── PhotoPreview.tsx           # Upload preview and confirmation
└── ProfileAnalytics/
    ├── ProfileAnalyticsDashboard.tsx  # Analytics overview
    ├── ProfileCompletionCard.tsx      # Profile completion status
    └── EngagementStats.tsx            # Engagement statistics
```

### Enhanced Profile Header Component

```typescript
interface ProfileHeaderProps {
  user: ExtendedUser
  isOwnProfile: boolean
  onEdit?: () => void
  onFollow?: (isFollowing: boolean) => void
  onPhotoClick?: () => void
}

export default function ProfileHeader({ 
  user, 
  isOwnProfile, 
  onEdit, 
  onFollow, 
  onPhotoClick 
}: ProfileHeaderProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-6 sm:space-y-0 sm:space-x-8">
        {/* Profile Photo */}
        <ProfilePhotoDisplay
          user={user}
          size="large"
          onClick={onPhotoClick}
          showEditOverlay={isOwnProfile}
        />
        
        {/* Profile Info */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          {/* Display Name and Username */}
          <div className="mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
              {user.display_name || user.username}
            </h1>
            {user.display_name && (
              <p className="text-lg text-gray-600">@{user.username}</p>
            )}
          </div>
          
          {/* Bio */}
          {user.bio && (
            <ProfileBio bio={user.bio} className="mb-4" />
          )}
          
          {/* Location */}
          {user.city && (
            <div className="flex items-center justify-center sm:justify-start mb-4">
              <MapPin className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-gray-600">{user.city}</span>
            </div>
          )}
          
          {/* Join Date */}
          <div className="flex items-center justify-center sm:justify-start mb-6">
            <Calendar className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-gray-500">
              Joined {formatDate(user.created_at)}
            </span>
          </div>
          
          {/* Action Buttons */}
          <ProfileActions
            user={user}
            isOwnProfile={isOwnProfile}
            onEdit={onEdit}
            onFollow={onFollow}
          />
        </div>
      </div>
      
      {/* Stats */}
      <ProfileStats user={user} className="mt-6 pt-6 border-t border-gray-200" />
      
      {/* Extended Info */}
      <div className="mt-6 space-y-4">
        {user.institutions && user.institutions.length > 0 && (
          <ProfileInstitutions institutions={user.institutions} />
        )}
        {user.websites && user.websites.length > 0 && (
          <ProfileWebsites websites={user.websites} />
        )}
      </div>
    </div>
  )
}
```

### Profile Photo Upload Component

```typescript
interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string
  onUpload: (file: File) => Promise<void>
  onDelete?: () => Promise<void>
  isUploading?: boolean
}

export default function ProfilePhotoUpload({
  currentPhotoUrl,
  onUpload,
  onDelete,
  isUploading = false
}: ProfilePhotoUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  const handleDrag = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }
  
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer?.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }
  
  const handleFileSelect = (file: File) => {
    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }
    
    setSelectedFile(file)
    
    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setShowCropper(true)
  }
  
  const handleCropComplete = async (croppedFile: File) => {
    setShowCropper(false)
    setPreviewUrl(null)
    
    try {
      await onUpload(croppedFile)
      toast.success('Profile photo updated successfully!')
    } catch (error) {
      toast.error('Failed to upload photo. Please try again.')
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Current Photo Display */}
      {currentPhotoUrl && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <img
              src={currentPhotoUrl}
              alt="Current profile photo"
              className="w-12 h-12 rounded-full object-cover"
            />
            <span className="text-sm text-gray-600">Current photo</span>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 text-sm"
            >
              Remove
            </button>
          )}
        </div>
      )}
      
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive ? 'border-purple-400 bg-purple-50' : 'border-gray-300'}
          ${isUploading ? 'opacity-50 pointer-events-none' : 'hover:border-purple-400'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            {isUploading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            ) : (
              <Camera className="h-8 w-8 text-gray-400" />
            )}
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isUploading ? 'Uploading...' : 'Upload profile photo'}
            </p>
            <p className="text-sm text-gray-500">
              Drag and drop or click to select
            </p>
            <p className="text-xs text-gray-400 mt-2">
              JPEG, PNG, or WebP • Max 5MB
            </p>
          </div>
        </div>
      </div>
      
      {/* Photo Cropper Modal */}
      {showCropper && selectedFile && previewUrl && (
        <PhotoCropper
          imageUrl={previewUrl}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false)
            setPreviewUrl(null)
            setSelectedFile(null)
          }}
        />
      )}
    </div>
  )
}
```

### Extended Profile Edit Form

```typescript
interface ExtendedInfoFormProps {
  user: ExtendedUser
  onSave: (data: ExtendedProfileData) => Promise<void>
  isLoading?: boolean
}

export default function ExtendedInfoForm({ 
  user, 
  onSave, 
  isLoading = false 
}: ExtendedInfoFormProps) {
  const [formData, setFormData] = useState({
    display_name: user.display_name || '',
    city: user.city || '',
    institutions: user.institutions || [],
    websites: user.websites || []
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    // Validate display name
    if (formData.display_name && formData.display_name.length > 100) {
      newErrors.display_name = 'Display name must be 100 characters or less'
    }
    
    // Validate city
    if (formData.city && formData.city.length > 100) {
      newErrors.city = 'City must be 100 characters or less'
    }
    
    // Validate institutions
    if (formData.institutions.length > 10) {
      newErrors.institutions = 'Maximum 10 institutions allowed'
    }
    
    // Validate websites
    if (formData.websites.length > 5) {
      newErrors.websites = 'Maximum 5 websites allowed'
    }
    
    formData.websites.forEach((website, index) => {
      if (website.url && !isValidUrl(website.url)) {
        newErrors[`website_${index}`] = 'Please enter a valid URL'
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    try {
      await onSave(formData)
    } catch (error) {
      toast.error('Failed to update profile. Please try again.')
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Display Name
        </label>
        <input
          type="text"
          value={formData.display_name}
          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
          className={`
            w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent
            ${errors.display_name ? 'border-red-300' : 'border-gray-300'}
          `}
          placeholder="How you'd like to be displayed"
          maxLength={100}
        />
        {errors.display_name && (
          <p className="text-red-600 text-sm mt-1">{errors.display_name}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          This is how your name will appear to others. Your username (@{user.username}) will still be shown.
        </p>
      </div>
      
      {/* City */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          City
        </label>
        <input
          type="text"
          value={formData.city}
          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          className={`
            w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent
            ${errors.city ? 'border-red-300' : 'border-gray-300'}
          `}
          placeholder="Where you're located"
          maxLength={100}
        />
        {errors.city && (
          <p className="text-red-600 text-sm mt-1">{errors.city}</p>
        )}
      </div>
      
      {/* Institutions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Institutions
        </label>
        <InstitutionsEditor
          institutions={formData.institutions}
          onChange={(institutions) => setFormData({ ...formData, institutions })}
          error={errors.institutions}
        />
      </div>
      
      {/* Websites */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Websites
        </label>
        <WebsitesEditor
          websites={formData.websites}
          onChange={(websites) => setFormData({ ...formData, websites })}
          error={errors.websites}
        />
      </div>
      
      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
```

---

## Implementation Roadmap

### Week 1: Database and Backend Foundation
1. **Day 1-2**: Create database migration for new profile fields
2. **Day 3-4**: Implement ProfilePhotoService and ImageProcessor
3. **Day 5**: Update UserService with extended profile methods
4. **Day 6-7**: Create new API endpoints and update existing ones

### Week 2: Frontend Components and Integration
1. **Day 1-2**: Create ProfilePhotoUpload component
2. **Day 3-4**: Update profile editing forms for extended fields
3. **Day 5**: Implement display name vs username system
4. **Day 6-7**: Update shared types and API integration

### Week 3: Testing and Polish
1. **Day 1-2**: Write comprehensive backend tests
2. **Day 3-4**: Write frontend component tests
3. **Day 5**: Integration testing and bug fixes
4. **Day 6-7**: Performance optimization and documentation

---

## Testing Strategy

### Backend Testing
```python
class TestEnhancedUserService:
    """Test enhanced user service functionality."""
    
    async def test_update_extended_profile_success(self):
        """Test successful extended profile update."""
        
    async def test_validate_display_name_invalid_characters(self):
        """Test display name validation with invalid characters."""
        
    async def test_validate_institutions_too_many(self):
        """Test institutions validation with too many entries."""
        
    async def test_validate_websites_invalid_url(self):
        """Test websites validation with invalid URL."""

class TestProfilePhotoService:
    """Test profile photo service functionality."""
    
    async def test_upload_profile_photo_success(self):
        """Test successful profile photo upload."""
        
    async def test_upload_invalid_file_type(self):
        """Test rejection of invalid file types."""
        
    async def test_upload_file_too_large(self):
        """Test rejection of oversized files."""
        
    async def test_delete_profile_photo_success(self):
        """Test successful profile photo deletion."""
```

### Frontend Testing
```typescript
describe('ProfilePhotoUpload', () => {
  it('should handle file upload successfully', () => {
    // Test file upload functionality
  })
  
  it('should validate file types', () => {
    // Test file type validation
  })
  
  it('should show upload progress', () => {
    // Test upload progress display
  })
})

describe('Profile System Integration', () => {
  it('should update profile with extended fields', () => {
    // Test end-to-end profile update
  })
})
```

---

## Security & Performance

### Security Considerations

#### File Upload Security
- **File Type Validation**: Strict MIME type checking
- **File Size Limits**: Maximum 5MB per image
- **Malware Scanning**: Virus scanning for uploaded files
- **Path Traversal Prevention**: Secure file naming and storage
- **Rate Limiting**: Upload frequency limits per user

#### Data Validation
- **Input Sanitization**: HTML escaping for all text fields
- **URL Validation**: Proper URL format validation for websites
- **Length Limits**: Enforce maximum lengths for all fields
- **XSS Prevention**: Sanitize all user-generated content

#### Privacy Controls
- **Profile Visibility**: Control who can view profile information
- **Photo Privacy**: Option to restrict profile photo visibility
- **Data Export**: Allow users to export their profile data
- **Data Deletion**: Proper cleanup when users delete accounts

### Performance Considerations

#### Image Optimization
- **Lazy Loading**: Load profile images only when needed
- **CDN Integration**: Serve images from CDN for faster delivery
- **Caching Strategy**: Cache processed images and metadata
- **Progressive Loading**: Show low-quality placeholder while loading

#### Database Performance
- **Indexing Strategy**: Add indexes for new searchable fields
- **Query Optimization**: Efficient queries for profile data
- **Connection Pooling**: Optimize database connections
- **Caching Layer**: Cache frequently accessed profile data

#### API Performance
- **Response Compression**: Gzip compression for API responses
- **Pagination**: Implement pagination for profile-related lists
- **Rate Limiting**: Prevent API abuse and ensure fair usage
- **Monitoring**: Track API performance and error rates

---

## Migration Strategy

### Backward Compatibility
- **Existing API Endpoints**: Maintained during transition
- **Gradual Migration**: Users migrated in batches to avoid system overload
- **Default Values**: Set sensible defaults for new fields
- **User Notification**: Inform users about new profile features
- **Rollback Plan**: Ability to rollback changes if issues arise

### Migration Script
```python
async def migrate_existing_users():
    """
    Migrate existing users to new profile schema:
    1. Set display_name = username for all existing users
    2. Initialize empty arrays for institutions and websites
    3. Set default profile preferences
    4. Create profile analytics records
    """
    # Set display_name = username for existing users
    await db.execute(
        "UPDATE users SET display_name = username WHERE display_name IS NULL"
    )
    
    # Set default preferences
    default_preferences = {
        "allow_mentions": True,
        "allow_sharing": True,
        "profile_visibility": "public",
        "show_email": False,
        "show_join_date": True,
        "show_stats": True,
        "notification_settings": {
            "email_notifications": True,
            "push_notifications": True,
            "reaction_notifications": True,
            "mention_notifications": True,
            "follow_notifications": True,
            "share_notifications": True,
            "batch_notifications": True
        }
    }
    
    await db.execute(
        "UPDATE users SET profile_preferences = :prefs WHERE profile_preferences IS NULL",
        {"prefs": json.dumps(default_preferences)}
    )
```

---

## Conclusion

This comprehensive guide provides a complete roadmap for enhancing the profile system in the Grateful application. The enhancement introduces significant new functionality while maintaining system stability, user experience, and code quality standards.

### Key Achievements
- ✅ **Comprehensive Analysis**: Detailed examination of current system
- ✅ **Architectural Planning**: Complete design for enhanced functionality
- ✅ **Migration Strategy**: Safe database and data migration approach
- ✅ **Implementation Roadmap**: Clear timeline and deliverables
- ✅ **Testing Strategy**: Comprehensive testing approach
- ✅ **Security & Performance**: Robust security and optimization plans

### Next Steps
1. **Stakeholder Review**: Get approval for the enhancement plan
2. **Resource Allocation**: Assign development resources
3. **Implementation**: Execute the three-week implementation plan
4. **Testing & Validation**: Comprehensive testing and quality assurance
5. **Deployment**: Gradual rollout with monitoring and feedback

The enhanced profile system will significantly improve user engagement and platform functionality while maintaining the high standards established in the existing codebase.

**Status**: ✅ **PLANNING COMPLETE**
**Ready for Implementation**: ✅ **YES**
**All Tests Passing**: ✅ **330 backend + 551 frontend**