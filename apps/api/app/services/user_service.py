"""
User service with standardized patterns using repository layer.
"""

import logging
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import NotFoundError, ConflictError, ValidationException
from app.core.query_monitor import monitor_query
from app.repositories.user_repository import UserRepository
from app.repositories.post_repository import PostRepository
from app.models.user import User

logger = logging.getLogger(__name__)


class UserService(BaseService):
    """Service for user operations using repository pattern."""

    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.user_repo = UserRepository(db)
        self.post_repo = PostRepository(db)

    @monitor_query("get_user_profile")
    async def get_user_profile(self, user_id: int) -> Dict[str, any]:
        """
        Get user profile with stats.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict containing user profile data
            
        Raises:
            NotFoundError: If user is not found
        """
        user = await self.user_repo.get_by_id_or_404(user_id)
        stats = await self.user_repo.get_user_stats(user_id)
        
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "bio": user.bio,
            "profile_image_url": user.profile_image_url,
            "display_name": user.display_name,
            "city": user.city,
            "location": user.location,
            "institutions": user.institutions or [],
            "websites": user.websites or [],
            "created_at": user.created_at.isoformat(),
            "posts_count": stats["posts_count"],
            "followers_count": stats["followers_count"],
            "following_count": stats["following_count"]
        }

    async def get_public_user_profile(self, user_id: int) -> Dict[str, any]:
        """
        Get public user profile (no email).
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dict containing public user profile data
            
        Raises:
            NotFoundError: If user is not found
        """
        profile = await self.get_user_profile(user_id)
        # Remove email from public profile
        profile.pop("email", None)
        return profile

    async def get_user_by_username(self, username: str) -> Dict[str, any]:
        """
        Get public user profile by username.
        
        Args:
            username: Username to look up
            
        Returns:
            Dict containing public user profile data
            
        Raises:
            NotFoundError: If user is not found
        """
        user = await self.user_repo.get_by_username(username)
        if not user:
            raise NotFoundError("User", username)
        
        return await self.get_public_user_profile(user.id)

    @monitor_query("update_user_profile")
    async def update_user_profile(
        self,
        user_id: int,
        username: Optional[str] = None,
        bio: Optional[str] = None,
        profile_image_url: Optional[str] = None,
        city: Optional[str] = None,
        location_data: Optional[Dict] = None,
        institutions: Optional[List[str]] = None,
        websites: Optional[List[str]] = None,
        display_name: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Update user profile.
        
        Args:
            user_id: ID of the user
            username: New username (optional)
            bio: New bio (optional)
            profile_image_url: New profile image URL (optional)
            city: City name (optional)
            location_data: Structured location data from Nominatim (optional)
            institutions: List of institutions (optional)
            websites: List of website URLs (optional)
            display_name: Display name (optional)
            
        Returns:
            Dict containing updated user profile data
            
        Raises:
            NotFoundError: If user is not found
            ConflictError: If username is already taken
            ValidationException: If validation fails
        """
        user = await self.user_repo.get_by_id_or_404(user_id)
        
        # Prepare update data
        update_data = {}
        
        # Validate and update username if provided
        if username is not None:
            self.validate_field_length(username, "username", 50, 3)
            
            # Check if username is already taken by another user
            if not await self.user_repo.check_username_availability(username, user_id):
                raise ConflictError("Username already taken", "user")
            
            update_data["username"] = username

        # Validate and update bio if provided
        if bio is not None:
            self.validate_field_length(bio, "bio", 500, 0)
            update_data["bio"] = bio

        # Update profile image URL if provided
        if profile_image_url is not None:
            update_data["profile_image_url"] = profile_image_url

        # Validate and update display name if provided
        if display_name is not None:
            self.validate_field_length(display_name, "display_name", 100, 1)
            update_data["display_name"] = display_name

        # Validate and update city if provided
        if city is not None:
            self.validate_field_length(city, "city", 100, 0)
            update_data["city"] = city

        # Validate and update location data if provided
        if location_data is not None:
            if location_data:  # If not empty dict
                from app.services.location_service import LocationService
                location_service = LocationService(self.db)
                if not location_service.validate_location_data(location_data):
                    raise ValidationException(
                        "Invalid location data format",
                        {"location_data": "Must contain valid display_name, lat, and lon"}
                    )
            update_data["location"] = location_data

        # Validate and update institutions if provided
        if institutions is not None:
            if len(institutions) > 10:
                raise ValidationException(
                    "Too many institutions",
                    {"institutions": "Maximum 10 institutions allowed"}
                )
            
            # Validate each institution
            for i, institution in enumerate(institutions):
                if not isinstance(institution, str):
                    raise ValidationException(
                        "Invalid institution format",
                        {"institutions": f"Institution {i+1} must be a string"}
                    )
                if len(institution.strip()) > 100:
                    raise ValidationException(
                        "Institution name too long",
                        {"institutions": f"Institution {i+1} must be 100 characters or less"}
                    )
            
            update_data["institutions"] = [inst.strip() for inst in institutions if inst.strip()]

        # Validate and update websites if provided
        if websites is not None:
            if len(websites) > 5:
                raise ValidationException(
                    "Too many websites",
                    {"websites": "Maximum 5 websites allowed"}
                )
            
            # Validate each website URL
            import re
            url_pattern = re.compile(
                r'^https?://'  # http:// or https://
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
                r'localhost|'  # localhost...
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
                r'(?::\d+)?'  # optional port
                r'(?:/?|[/?]\S+)$', re.IGNORECASE)
            
            for i, website in enumerate(websites):
                if not isinstance(website, str):
                    raise ValidationException(
                        "Invalid website format",
                        {"websites": f"Website {i+1} must be a string"}
                    )
                
                website = website.strip()
                if website and not url_pattern.match(website):
                    raise ValidationException(
                        "Invalid website URL",
                        {"websites": f"Website {i+1} must be a valid HTTP/HTTPS URL"}
                    )
            
            update_data["websites"] = [url.strip() for url in websites if url.strip()]

        # Only update if there are changes
        if update_data:
            await self.user_repo.update(user, **update_data)
        
        logger.info(f"Updated profile for user {user_id}")
        
        return await self.get_user_profile(user_id)

    @monitor_query("get_user_posts")
    async def get_user_posts(
        self,
        user_id: int,
        current_user_id: int,
        limit: int = 20,
        offset: int = 0,
        public_only: bool = False
    ) -> List[Dict[str, any]]:
        """
        Get user's posts with engagement data.
        
        Args:
            user_id: ID of the user whose posts to get
            current_user_id: ID of the current user (for engagement data)
            limit: Maximum number of posts to return
            offset: Number of posts to skip
            public_only: Whether to only return public posts
            
        Returns:
            List of post dictionaries with engagement data
            
        Raises:
            NotFoundError: If user is not found
        """
        # Verify the user exists
        await self.user_repo.get_by_id_or_404(user_id)
        
        # Use repository method for posts with engagement data
        posts = await self.post_repo.get_posts_with_engagement(
            user_id=current_user_id,
            author_id=user_id,
            public_only=public_only,
            limit=limit,
            offset=offset
        )

        logger.info(f"Retrieved {len(posts)} posts for user {user_id}")
        return posts

    @monitor_query("validate_usernames_batch")
    async def validate_usernames_batch(self, usernames: List[str]) -> Dict[str, List[str]]:
        """
        Validate multiple usernames in a single database query.
        
        Args:
            usernames: List of usernames to validate
            
        Returns:
            Dict with 'valid_usernames' and 'invalid_usernames' lists
        """
        if not usernames:
            return {"valid_usernames": [], "invalid_usernames": []}
        
        # Get existing usernames from database
        existing_usernames = await self.user_repo.get_existing_usernames(usernames)
        
        # Convert to sets for efficient lookup
        existing_set = set(existing_usernames)
        input_set = set(usernames)
        
        # Determine valid and invalid usernames
        valid_usernames = [username for username in usernames if username in existing_set]
        invalid_usernames = [username for username in usernames if username not in existing_set]
        
        logger.info(f"Validated {len(usernames)} usernames: {len(valid_usernames)} valid, {len(invalid_usernames)} invalid")
        
        return {
            "valid_usernames": valid_usernames,
            "invalid_usernames": invalid_usernames
        }

    @monitor_query("resolve_username_to_id")
    async def resolve_username_to_id(self, username: str) -> Dict[str, any]:
        """
        Resolve username to user ID for navigation purposes.
        
        Args:
            username: Username to resolve
            
        Returns:
            Dict containing user ID and username
            
        Raises:
            NotFoundError: If username is not found
        """
        user = await self.user_repo.get_by_username_or_404(username)
        
        logger.info(f"Resolved username '{username}' to user ID {user.id}")
        
        return {
            "id": user.id,
            "username": user.username
        }