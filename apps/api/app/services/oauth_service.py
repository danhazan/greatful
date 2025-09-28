"""
OAuth authentication service for social login integration.
"""

import logging
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

from app.core.service_base import BaseService
from app.core.exceptions import (
    ValidationException, 
    ConflictError, 
    NotFoundError,
    AuthenticationError,
    BusinessLogicError
)
from app.models.user import User
from app.core.oauth_config import get_oauth_user_info, log_oauth_security_event, log_oauth_production_error
from app.core.security import create_access_token, create_refresh_token
from app.core.security_audit import SecurityAuditor, SecurityEventType
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

class OAuthService(BaseService):
    """Service for handling OAuth authentication and user management."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)
        self.user_service = UserService(db)
    
    async def authenticate_oauth_user(
        self, 
        provider: str, 
        oauth_token: Dict[str, Any],
        state: Optional[str] = None,
        request: Optional[Any] = None
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Authenticate user via OAuth provider with enhanced account management.
        
        Args:
            provider: OAuth provider name ('google' or 'facebook')
            oauth_token: OAuth token from provider
            state: OAuth state parameter for CSRF protection
            request: FastAPI request object for security logging
            
        Returns:
            Tuple of (user_data, is_new_user)
            
        Raises:
            AuthenticationError: If OAuth authentication fails
            ValidationException: If user data is invalid
            ConflictError: If account linking conflicts occur
        """
        try:
            # Enhanced security logging for OAuth authentication attempt
            if request:
                SecurityAuditor.log_security_event(
                    event_type=SecurityEventType.OAUTH_LOGIN_INITIATED,
                    request=request,
                    details={
                        'provider': provider,
                        'has_state': bool(state),
                        'token_type': oauth_token.get('token_type', 'unknown')
                    },
                    severity="INFO"
                )
            
            # Get user info from OAuth provider
            oauth_user_info = await get_oauth_user_info(provider, oauth_token)
            
            # Debug: Log what we received from get_oauth_user_info
            logger.info(f"=== OAUTH SERVICE DEBUG ===")
            logger.info(f"Received oauth_user_info: {oauth_user_info}")
            logger.info(f"oauth_user_info type: {type(oauth_user_info)}")
            if oauth_user_info:
                logger.info(f"oauth_user_info keys: {list(oauth_user_info.keys())}")
                logger.info(f"ID field: {oauth_user_info.get('id', 'NOT_FOUND')}")
                logger.info(f"Email field: {oauth_user_info.get('email', 'NOT_FOUND')}")
            else:
                logger.error("oauth_user_info is None or empty!")
            
            # Enhanced validation with security logging
            validation_errors = []
            if not oauth_user_info.get('id'):
                validation_errors.append('missing_oauth_id')
            if not oauth_user_info.get('email'):
                validation_errors.append('missing_email')
            
            if validation_errors:
                log_oauth_security_event('invalid_user_data', provider, details={'errors': validation_errors})
                if request:
                    SecurityAuditor.log_security_event(
                        event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
                        request=request,
                        details={
                            'provider': provider,
                            'validation_errors': validation_errors,
                            'oauth_user_id': oauth_user_info.get('id', 'unknown')
                        },
                        severity="WARNING",
                        success=False
                    )
                raise AuthenticationError("Invalid user data from OAuth provider")
            
            # Check if user exists by OAuth credentials
            existing_user = await User.get_by_oauth(
                self.db, 
                provider, 
                oauth_user_info['id']
            )
            
            if existing_user:
                # Update existing OAuth user
                updated_user = await self._update_oauth_user(existing_user, oauth_user_info, request)
                log_oauth_security_event('login_success', provider, user_id=updated_user.id)
                if request:
                    SecurityAuditor.log_security_event(
                        event_type=SecurityEventType.OAUTH_LOGIN_SUCCESS,
                        request=request,
                        user_id=updated_user.id,
                        username=updated_user.username,
                        details={
                            'provider': provider,
                            'oauth_user_id': oauth_user_info['id'],
                            'account_type': 'existing_oauth'
                        },
                        severity="INFO"
                    )
                return await self._format_user_response(updated_user), False
            
            # Check if user exists by email (for account linking)
            existing_email_user = await User.get_by_email(self.db, oauth_user_info['email'])
            
            if existing_email_user:
                # Enhanced account linking with conflict detection
                linked_user = await self._link_oauth_account_with_validation(
                    existing_email_user, provider, oauth_user_info, request
                )
                log_oauth_security_event('account_linked', provider, user_id=linked_user.id)
                if request:
                    SecurityAuditor.log_security_event(
                        event_type=SecurityEventType.OAUTH_ACCOUNT_LINKED,
                        request=request,
                        user_id=linked_user.id,
                        username=linked_user.username,
                        details={
                            'provider': provider,
                            'oauth_user_id': oauth_user_info['id'],
                            'existing_oauth_provider': existing_email_user.oauth_provider,
                            'account_type': 'linked_existing'
                        },
                        severity="INFO"
                    )
                return await self._format_user_response(linked_user), False
            
            # Create new user from OAuth data
            new_user = await self._create_oauth_user(provider, oauth_user_info, request)
            log_oauth_security_event('user_created', provider, user_id=new_user.id)
            if request:
                SecurityAuditor.log_security_event(
                    event_type=SecurityEventType.OAUTH_USER_CREATED,
                    request=request,
                    user_id=new_user.id,
                    username=new_user.username,
                    details={
                        'provider': provider,
                        'oauth_user_id': oauth_user_info['id'],
                        'account_type': 'new_oauth'
                    },
                    severity="INFO"
                )
            return await self._format_user_response(new_user), True
            
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"OAuth authentication failed for {provider}: {e}")
            log_oauth_security_event('authentication_error', provider, details={'error': str(e)})
            log_oauth_production_error('authentication_failure', provider, str(e), 
                                     user_context={'provider': provider})
            raise AuthenticationError(f"OAuth authentication failed: {str(e)}")
    
    async def _create_oauth_user(self, provider: str, oauth_user_info: Dict[str, Any], request: Optional[Any] = None) -> User:
        """
        Create a new user from OAuth provider data with enhanced profile extraction.
        
        Args:
            provider: OAuth provider name
            oauth_user_info: User information from OAuth provider
            request: FastAPI request object for security logging
            
        Returns:
            Created User instance
        """
        try:
            # Generate unique username from OAuth data
            base_username = self._generate_username_from_oauth(oauth_user_info)
            username = await self._ensure_unique_username(base_username)
            
            # Enhanced profile data extraction
            profile_data = self._extract_profile_data(oauth_user_info, provider)
            
            # Prepare user data with enhanced profile information
            user_data = {
                'email': oauth_user_info['email'],
                'username': username,
                'hashed_password': '',  # OAuth users don't have passwords
                'display_name': profile_data['display_name'],
                'oauth_provider': provider,
                'oauth_id': oauth_user_info['id'],
                'oauth_data': {
                    'provider_data': oauth_user_info,
                    'created_via_oauth': True,
                    'email_verified': oauth_user_info.get('email_verified', False),
                    'profile_extracted_at': datetime.now(timezone.utc).isoformat(),
                    'provider_locale': oauth_user_info.get('locale'),
                    'provider_verified': oauth_user_info.get('verified_email', oauth_user_info.get('email_verified', False))
                }
            }
            
            # Set profile image if available
            if profile_data['profile_image_url']:
                user_data['profile_image_url'] = profile_data['profile_image_url']
            
            # Add location data if available
            if profile_data.get('location'):
                user_data['location'] = profile_data['location']
            
            # Create user with enhanced error handling
            try:
                user = await self.create_entity(User, **user_data)
            except IntegrityError as e:
                # Handle unique constraint violations
                if 'email' in str(e).lower():
                    # Email already exists - this shouldn't happen as we checked, but handle race condition
                    existing_user = await User.get_by_email(self.db, oauth_user_info['email'])
                    if existing_user:
                        logger.warning(f"Race condition detected: email {oauth_user_info['email']} already exists")
                        if request:
                            SecurityAuditor.log_security_event(
                                event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
                                request=request,
                                details={
                                    'provider': provider,
                                    'error': 'email_race_condition',
                                    'oauth_user_id': oauth_user_info['id']
                                },
                                severity="WARNING",
                                success=False
                            )
                        raise ConflictError("Email address is already registered", "User")
                elif 'username' in str(e).lower():
                    # Username collision - regenerate and retry
                    logger.warning(f"Username collision for {username}, regenerating")
                    username = await self._ensure_unique_username(base_username, force_suffix=True)
                    user_data['username'] = username
                    user = await self.create_entity(User, **user_data)
                else:
                    raise
            
            logger.info(f"Created new OAuth user: {user.id} via {provider} with enhanced profile data")
            return user
            
        except IntegrityError as e:
            logger.error(f"Database integrity error creating OAuth user: {e}")
            raise ConflictError("User account creation failed", "User")
        except Exception as e:
            logger.error(f"Error creating OAuth user: {e}")
            log_oauth_production_error('user_creation_failure', 'oauth', str(e))
            raise BusinessLogicError(f"Failed to create user account: {str(e)}")
    
    def _extract_profile_data(self, oauth_user_info: Dict[str, Any], provider: str) -> Dict[str, Any]:
        """
        Extract and normalize profile data from OAuth provider.
        
        Args:
            oauth_user_info: User information from OAuth provider
            provider: OAuth provider name
            
        Returns:
            Dictionary with normalized profile data
        """
        profile_data = {
            'display_name': '',
            'profile_image_url': None,
            'location': None
        }
        
        # Extract display name with fallback logic
        if oauth_user_info.get('name'):
            profile_data['display_name'] = oauth_user_info['name'].strip()
        elif oauth_user_info.get('given_name') and oauth_user_info.get('family_name'):
            profile_data['display_name'] = f"{oauth_user_info['given_name']} {oauth_user_info['family_name']}".strip()
        elif oauth_user_info.get('given_name'):
            profile_data['display_name'] = oauth_user_info['given_name'].strip()
        else:
            # Fallback to email prefix
            email = oauth_user_info.get('email', '')
            profile_data['display_name'] = email.split('@')[0] if email else 'User'
        
        # Extract profile image with provider-specific logic
        if provider == 'google':
            picture_url = oauth_user_info.get('picture')
            if picture_url:
                # Google provides high-quality images, prefer larger size
                if 's96-c' in picture_url:
                    picture_url = picture_url.replace('s96-c', 's200-c')
                profile_data['profile_image_url'] = picture_url
        elif provider == 'facebook':
            picture_data = oauth_user_info.get('picture', {})
            if isinstance(picture_data, dict):
                picture_url = picture_data.get('data', {}).get('url')
                if picture_url:
                    profile_data['profile_image_url'] = picture_url
            elif isinstance(picture_data, str):
                profile_data['profile_image_url'] = picture_data
        
        # Extract location data if available
        if oauth_user_info.get('locale'):
            profile_data['location'] = {
                'locale': oauth_user_info['locale'],
                'source': 'oauth_provider',
                'provider': provider
            }
        
        return profile_data
    
    async def _update_oauth_user(self, user: User, oauth_user_info: Dict[str, Any], request: Optional[Any] = None) -> User:
        """
        Update existing OAuth user with latest provider data.
        
        Args:
            user: Existing User instance
            oauth_user_info: Updated user information from OAuth provider
            request: FastAPI request object for security logging
            
        Returns:
            Updated User instance
        """
        try:
            # Extract enhanced profile data
            profile_data = self._extract_profile_data(oauth_user_info, user.oauth_provider)
            
            # Update OAuth data with enhanced information
            oauth_data = user.oauth_data or {}
            oauth_data.update({
                'provider_data': oauth_user_info,
                'last_login_via_oauth': True,
                'last_login_at': datetime.now(timezone.utc).isoformat(),
                'email_verified': oauth_user_info.get('email_verified', False),
                'profile_updated_at': datetime.now(timezone.utc).isoformat(),
                'login_count': oauth_data.get('login_count', 0) + 1
            })
            
            # Update user fields with enhanced logic
            update_data = {
                'oauth_data': oauth_data
            }
            
            # Update display name with improved logic
            if not user.display_name or (profile_data['display_name'] and len(profile_data['display_name']) > len(user.display_name or '')):
                update_data['display_name'] = profile_data['display_name']
            
            # Update profile image with provider preference
            if profile_data['profile_image_url']:
                # Always update if user doesn't have an image, or if it's from the same OAuth provider
                if not user.profile_image_url or user.oauth_provider == user.oauth_provider:
                    update_data['profile_image_url'] = profile_data['profile_image_url']
            
            # Update location data if available and not set
            if profile_data.get('location') and not user.location:
                update_data['location'] = profile_data['location']
            
            # Update user
            updated_user = await self.update_entity(user, **update_data)
            
            logger.info(f"Updated OAuth user: {user.id} with enhanced profile data")
            return updated_user
            
        except Exception as e:
            logger.error(f"Error updating OAuth user: {e}")
            raise BusinessLogicError(f"Failed to update user account: {str(e)}")
    
    async def _link_oauth_account_with_validation(self, user: User, provider: str, oauth_user_info: Dict[str, Any], request: Optional[Any] = None) -> User:
        """
        Link OAuth account to existing user with enhanced validation and conflict handling.
        
        Args:
            user: Existing User instance
            provider: OAuth provider name
            oauth_user_info: User information from OAuth provider
            request: FastAPI request object for security logging
            
        Returns:
            Updated User instance with linked OAuth account
            
        Raises:
            ConflictError: If OAuth account conflicts occur
            BusinessLogicError: If linking fails for business reasons
        """
        try:
            # Enhanced conflict detection
            conflict_details = await self._detect_oauth_conflicts(user, provider, oauth_user_info)
            
            if conflict_details['has_conflicts']:
                # Log the conflict for security monitoring
                if request:
                    SecurityAuditor.log_security_event(
                        event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
                        request=request,
                        user_id=user.id,
                        username=user.username,
                        details={
                            'provider': provider,
                            'conflict_type': conflict_details['conflict_type'],
                            'existing_provider': conflict_details.get('existing_provider'),
                            'oauth_user_id': oauth_user_info['id']
                        },
                        severity="WARNING",
                        success=False
                    )
                
                # Handle different types of conflicts
                if conflict_details['conflict_type'] == 'different_provider':
                    raise ConflictError(
                        f"Account already linked to {conflict_details['existing_provider']}. "
                        f"Please unlink the existing OAuth account first or use {conflict_details['existing_provider']} to sign in.",
                        "OAuth",
                        details={
                            'existing_provider': conflict_details['existing_provider'],
                            'requested_provider': provider,
                            'user_id': user.id
                        }
                    )
                elif conflict_details['conflict_type'] == 'same_provider_different_account':
                    raise ConflictError(
                        f"A different {provider} account is already linked to this user. "
                        f"Please unlink the existing account first.",
                        "OAuth",
                        details={
                            'provider': provider,
                            'existing_oauth_id': user.oauth_id,
                            'requested_oauth_id': oauth_user_info['id'],
                            'user_id': user.id
                        }
                    )
            
            # Proceed with linking
            return await self._perform_oauth_linking(user, provider, oauth_user_info, request)
            
        except ConflictError:
            raise
        except Exception as e:
            logger.error(f"Error in OAuth account linking validation: {e}")
            if request:
                SecurityAuditor.log_security_event(
                    event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
                    request=request,
                    user_id=user.id,
                    details={
                        'provider': provider,
                        'error': 'linking_validation_failed',
                        'error_message': str(e)
                    },
                    severity="ERROR",
                    success=False
                )
            raise BusinessLogicError(f"Failed to validate OAuth account linking: {str(e)}")
    
    async def _detect_oauth_conflicts(self, user: User, provider: str, oauth_user_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detect OAuth account linking conflicts.
        
        Args:
            user: Existing User instance
            provider: OAuth provider name
            oauth_user_info: User information from OAuth provider
            
        Returns:
            Dictionary with conflict detection results
        """
        conflict_info = {
            'has_conflicts': False,
            'conflict_type': None,
            'existing_provider': user.oauth_provider,
            'existing_oauth_id': user.oauth_id
        }
        
        # Check if user already has OAuth account linked
        if user.oauth_provider and user.oauth_id:
            if user.oauth_provider == provider:
                if user.oauth_id != oauth_user_info['id']:
                    # Same provider, different account
                    conflict_info.update({
                        'has_conflicts': True,
                        'conflict_type': 'same_provider_different_account'
                    })
                # If same provider and same ID, no conflict (just update)
            else:
                # Different provider
                conflict_info.update({
                    'has_conflicts': True,
                    'conflict_type': 'different_provider'
                })
        
        return conflict_info
    
    async def _perform_oauth_linking(self, user: User, provider: str, oauth_user_info: Dict[str, Any], request: Optional[Any] = None) -> User:
        """
        Perform the actual OAuth account linking after validation.
        
        Args:
            user: Existing User instance
            provider: OAuth provider name
            oauth_user_info: User information from OAuth provider
            request: FastAPI request object for security logging
            
        Returns:
            Updated User instance with linked OAuth account
        """
        try:
            # Extract enhanced profile data
            profile_data = self._extract_profile_data(oauth_user_info, provider)
            
            # Prepare OAuth data
            oauth_data = user.oauth_data or {}
            oauth_data.update({
                'provider_data': oauth_user_info,
                'linked_via_oauth': True,
                'linked_at': datetime.now(timezone.utc).isoformat(),
                'email_verified': oauth_user_info.get('email_verified', False),
                'profile_extracted_at': datetime.now(timezone.utc).isoformat()
            })
            
            update_data = {
                'oauth_provider': provider,
                'oauth_id': oauth_user_info['id'],
                'oauth_data': oauth_data
            }
            
            # Update display name if not set or OAuth provides better data
            if not user.display_name and profile_data['display_name']:
                update_data['display_name'] = profile_data['display_name']
            
            # Update profile image if not set and OAuth provides one
            if not user.profile_image_url and profile_data['profile_image_url']:
                update_data['profile_image_url'] = profile_data['profile_image_url']
            
            # Update location if not set and OAuth provides data
            if not user.location and profile_data.get('location'):
                update_data['location'] = profile_data['location']
            
            # Update user
            updated_user = await self.update_entity(user, **update_data)
            
            logger.info(f"Successfully linked {provider} OAuth account to user: {user.id}")
            return updated_user
            
        except Exception as e:
            logger.error(f"Error performing OAuth account linking: {e}")
            if request:
                SecurityAuditor.log_security_event(
                    event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
                    request=request,
                    user_id=user.id,
                    details={
                        'provider': provider,
                        'error': 'linking_failed',
                        'error_message': str(e)
                    },
                    severity="ERROR",
                    success=False
                )
            raise BusinessLogicError(f"Failed to link OAuth account: {str(e)}")
    
    async def _link_oauth_account(self, user: User, provider: str, oauth_user_info: Dict[str, Any]) -> User:
        """
        Link OAuth account to existing user account.
        
        Args:
            user: Existing User instance
            provider: OAuth provider name
            oauth_user_info: User information from OAuth provider
            
        Returns:
            Updated User instance with linked OAuth account
        """
        try:
            # Check if user already has OAuth account linked
            if user.oauth_provider and user.oauth_id:
                if user.oauth_provider == provider and user.oauth_id == oauth_user_info['id']:
                    # Same OAuth account, just update
                    return await self._update_oauth_user(user, oauth_user_info)
                else:
                    # Different OAuth account - for now, we don't support multiple OAuth providers per user
                    raise ConflictError(
                        f"User already has {user.oauth_provider} account linked", 
                        "OAuth"
                    )
            
            # Link OAuth account
            oauth_data = user.oauth_data or {}
            oauth_data.update({
                'provider_data': oauth_user_info,
                'linked_via_oauth': True,
                'email_verified': oauth_user_info.get('email_verified', False)
            })
            
            update_data = {
                'oauth_provider': provider,
                'oauth_id': oauth_user_info['id'],
                'oauth_data': oauth_data
            }
            
            # Update display name if not set
            if not user.display_name and oauth_user_info.get('name'):
                update_data['display_name'] = oauth_user_info['name']
            
            # Update profile image if not set
            if not user.profile_image_url and oauth_user_info.get('picture'):
                update_data['profile_image_url'] = oauth_user_info['picture']
            
            # Update user
            updated_user = await self.update_entity(user, **update_data)
            
            logger.info(f"Linked {provider} OAuth account to user: {user.id}")
            return updated_user
            
        except ConflictError:
            raise
        except Exception as e:
            logger.error(f"Error linking OAuth account: {e}")
            raise BusinessLogicError(f"Failed to link OAuth account: {str(e)}")
    
    def _generate_username_from_oauth(self, oauth_user_info: Dict[str, Any]) -> str:
        """
        Generate username from OAuth user information.
        
        Args:
            oauth_user_info: User information from OAuth provider
            
        Returns:
            Generated username
        """
        # Try to use name parts
        if oauth_user_info.get('given_name'):
            base = oauth_user_info['given_name'].lower()
        elif oauth_user_info.get('name'):
            # Use first part of full name
            base = oauth_user_info['name'].split()[0].lower()
        else:
            # Fall back to email prefix
            base = oauth_user_info['email'].split('@')[0].lower()
        
        # Clean username (remove non-alphanumeric characters)
        import re
        base = re.sub(r'[^a-z0-9]', '', base)
        
        # Ensure minimum length
        if len(base) < 3:
            base = f"user{base}"
        
        return base[:20]  # Limit length
    
    async def _ensure_unique_username(self, base_username: str, force_suffix: bool = False) -> str:
        """
        Ensure username is unique by appending numbers if necessary.
        
        Args:
            base_username: Base username to make unique
            force_suffix: Force adding a suffix even if base username is available
            
        Returns:
            Unique username
        """
        import uuid
        import random
        
        # Clean and validate base username
        base_username = base_username.lower().strip()
        if len(base_username) < 3:
            base_username = f"user{base_username}"
        
        # Truncate if too long to leave room for suffix
        if len(base_username) > 15:
            base_username = base_username[:15]
        
        username = base_username
        counter = 1
        max_attempts = 50  # Prevent excessive database queries
        
        # If force_suffix is True, start with a suffix
        if force_suffix:
            username = f"{base_username}{random.randint(10, 99)}"
        
        while counter <= max_attempts:
            existing_user = await User.get_by_username(self.db, username)
            if not existing_user:
                return username
            
            # Try different suffix strategies
            if counter <= 10:
                # Simple numeric suffix
                username = f"{base_username}{counter}"
            elif counter <= 20:
                # Random two-digit suffix
                username = f"{base_username}{random.randint(10, 99)}"
            elif counter <= 30:
                # Three-digit suffix
                username = f"{base_username}{random.randint(100, 999)}"
            else:
                # UUID suffix as last resort
                uuid_suffix = str(uuid.uuid4())[:6]
                username = f"{base_username}{uuid_suffix}"
            
            counter += 1
        
        # Final fallback with timestamp
        import time
        timestamp_suffix = str(int(time.time()))[-6:]
        username = f"{base_username}{timestamp_suffix}"
        
        logger.warning(f"Username generation required {counter} attempts, using timestamp fallback: {username}")
        return username
    
    async def _format_user_response(self, user: User) -> Dict[str, Any]:
        """
        Format user data for OAuth response including tokens.
        
        Args:
            user: User instance
            
        Returns:
            Formatted user response with tokens
        """
        # Create JWT tokens
        token_data = {"sub": str(user.id), "email": user.email, "username": user.username}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        return {
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'display_name': user.display_name,
                'profile_image_url': user.profile_image_url,
                'oauth_provider': user.oauth_provider,
                'created_at': user.created_at.isoformat() if user.created_at else None
            },
            'tokens': {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'token_type': 'bearer'
            }
        }
    
    async def unlink_oauth_account(self, user_id: int) -> User:
        """
        Unlink OAuth account from user (if they have a password set).
        
        Args:
            user_id: User ID
            
        Returns:
            Updated User instance
            
        Raises:
            NotFoundError: If user not found
            BusinessLogicError: If user cannot unlink OAuth (no password)
        """
        user = await self.get_by_id_or_404(User, user_id, "User")
        
        # Check if user has a password (can't unlink OAuth if it's the only auth method)
        if not user.hashed_password:
            raise BusinessLogicError(
                "Cannot unlink OAuth account without setting a password first"
            )
        
        # Unlink OAuth account
        updated_user = await self.update_entity(
            user,
            oauth_provider=None,
            oauth_id=None,
            oauth_data=None
        )
        
        log_oauth_security_event('account_unlinked', user.oauth_provider or 'unknown', user_id=user.id)
        logger.info(f"Unlinked OAuth account for user: {user.id}")
        
        return updated_user
    
    async def check_account_linking_eligibility(self, email: str, provider: str, oauth_user_id: str) -> Dict[str, Any]:
        """
        Check if an account can be linked and provide linking information.
        
        Args:
            email: Email address from OAuth provider
            provider: OAuth provider name
            oauth_user_id: OAuth user ID from provider
            
        Returns:
            Dictionary with linking eligibility information
        """
        try:
            # Check if user exists by email
            existing_user = await User.get_by_email(self.db, email)
            
            if not existing_user:
                return {
                    'eligible': True,
                    'action': 'create_new_account',
                    'message': 'New account will be created',
                    'user_id': None,
                    'existing_oauth_provider': None
                }
            
            # Check if user already has OAuth linked
            if existing_user.oauth_provider and existing_user.oauth_id:
                if existing_user.oauth_provider == provider and existing_user.oauth_id == oauth_user_id:
                    return {
                        'eligible': True,
                        'action': 'login_existing',
                        'message': 'Login with existing OAuth account',
                        'user_id': existing_user.id,
                        'existing_oauth_provider': existing_user.oauth_provider
                    }
                else:
                    return {
                        'eligible': False,
                        'action': 'conflict_resolution_required',
                        'message': f'Account already linked to {existing_user.oauth_provider}',
                        'user_id': existing_user.id,
                        'existing_oauth_provider': existing_user.oauth_provider,
                        'conflict_type': 'different_provider' if existing_user.oauth_provider != provider else 'different_account'
                    }
            
            # User exists but no OAuth linked - can link
            return {
                'eligible': True,
                'action': 'link_to_existing',
                'message': 'OAuth account can be linked to existing account',
                'user_id': existing_user.id,
                'existing_oauth_provider': None,
                'requires_confirmation': True
            }
            
        except Exception as e:
            logger.error(f"Error checking account linking eligibility: {e}")
            return {
                'eligible': False,
                'action': 'error',
                'message': f'Unable to check account eligibility: {str(e)}',
                'user_id': None,
                'existing_oauth_provider': None
            }
    
    async def prepare_account_linking_confirmation(self, user_id: int, provider: str, oauth_user_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare account linking confirmation data for UI.
        
        Args:
            user_id: Existing user ID
            provider: OAuth provider name
            oauth_user_info: User information from OAuth provider
            
        Returns:
            Dictionary with confirmation data for UI
        """
        try:
            user = await self.get_by_id_or_404(User, user_id, "User")
            profile_data = self._extract_profile_data(oauth_user_info, provider)
            
            return {
                'user_id': user.id,
                'existing_account': {
                    'username': user.username,
                    'email': user.email,
                    'display_name': user.display_name,
                    'profile_image_url': user.profile_image_url,
                    'created_at': user.created_at.isoformat() if user.created_at else None
                },
                'oauth_account': {
                    'provider': provider,
                    'oauth_id': oauth_user_info['id'],
                    'email': oauth_user_info['email'],
                    'display_name': profile_data['display_name'],
                    'profile_image_url': profile_data['profile_image_url']
                },
                'linking_benefits': [
                    f'Sign in with {provider.title()}',
                    'Sync profile information',
                    'Enhanced security with OAuth'
                ],
                'data_changes': self._calculate_profile_changes(user, profile_data),
                'confirmation_required': True
            }
            
        except Exception as e:
            logger.error(f"Error preparing account linking confirmation: {e}")
            raise BusinessLogicError(f"Failed to prepare linking confirmation: {str(e)}")
    
    def _calculate_profile_changes(self, user: User, oauth_profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate what profile changes would occur from OAuth linking.
        
        Args:
            user: Existing User instance
            oauth_profile_data: Profile data from OAuth provider
            
        Returns:
            Dictionary describing potential changes
        """
        changes = {
            'display_name': {
                'current': user.display_name,
                'new': oauth_profile_data['display_name'],
                'will_change': bool(oauth_profile_data['display_name'] and 
                                  oauth_profile_data['display_name'] != user.display_name)
            },
            'profile_image': {
                'current': user.profile_image_url,
                'new': oauth_profile_data['profile_image_url'],
                'will_change': bool(oauth_profile_data['profile_image_url'] and 
                                  not user.profile_image_url)
            },
            'location': {
                'current': user.location,
                'new': oauth_profile_data.get('location'),
                'will_change': bool(oauth_profile_data.get('location') and not user.location)
            }
        }
        
        return changes
    
    async def confirm_account_linking(self, user_id: int, provider: str, oauth_user_info: Dict[str, Any], 
                                    user_consent: bool, request: Optional[Any] = None) -> Dict[str, Any]:
        """
        Confirm and execute account linking with user consent.
        
        Args:
            user_id: User ID to link OAuth account to
            provider: OAuth provider name
            oauth_user_info: User information from OAuth provider
            user_consent: Whether user has given consent for linking
            request: FastAPI request object for security logging
            
        Returns:
            Dictionary with linking result
            
        Raises:
            ValidationException: If user consent is not given
            BusinessLogicError: If linking fails
        """
        try:
            if not user_consent:
                if request:
                    SecurityAuditor.log_security_event(
                        event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
                        request=request,
                        user_id=user_id,
                        details={
                            'provider': provider,
                            'error': 'user_consent_denied',
                            'oauth_user_id': oauth_user_info['id']
                        },
                        severity="INFO",
                        success=False
                    )
                raise ValidationException("User consent is required for account linking")
            
            user = await self.get_by_id_or_404(User, user_id, "User")
            
            # Perform the linking
            linked_user = await self._perform_oauth_linking(user, provider, oauth_user_info, request)
            
            # Log successful linking with consent
            if request:
                SecurityAuditor.log_security_event(
                    event_type=SecurityEventType.OAUTH_ACCOUNT_LINKED,
                    request=request,
                    user_id=linked_user.id,
                    username=linked_user.username,
                    details={
                        'provider': provider,
                        'oauth_user_id': oauth_user_info['id'],
                        'consent_given': True,
                        'linking_method': 'user_confirmed'
                    },
                    severity="INFO"
                )
            
            return {
                'success': True,
                'message': f'{provider.title()} account successfully linked',
                'user': await self._format_user_response(linked_user)
            }
            
        except ValidationException:
            raise
        except Exception as e:
            logger.error(f"Error confirming account linking: {e}")
            if request:
                SecurityAuditor.log_security_event(
                    event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
                    request=request,
                    user_id=user_id,
                    details={
                        'provider': provider,
                        'error': 'linking_confirmation_failed',
                        'error_message': str(e)
                    },
                    severity="ERROR",
                    success=False
                )
            raise BusinessLogicError(f"Failed to confirm account linking: {str(e)}")
    
    async def get_oauth_users_stats(self) -> Dict[str, Any]:
        """
        Get statistics about OAuth users for monitoring.
        
        Returns:
            Dictionary with OAuth user statistics
        """
        try:
            from sqlalchemy import func, select
            
            # Count users by OAuth provider
            result = await self.db.execute(
                select(
                    User.oauth_provider,
                    func.count(User.id).label('count')
                )
                .where(User.oauth_provider.isnot(None))
                .group_by(User.oauth_provider)
            )
            
            provider_stats = {row.oauth_provider: row.count for row in result.fetchall()}
            
            # Count total OAuth users
            total_oauth_result = await self.db.execute(
                select(func.count(User.id))
                .where(User.oauth_provider.isnot(None))
            )
            total_oauth_users = total_oauth_result.scalar()
            
            # Count total users
            total_users_result = await self.db.execute(
                select(func.count(User.id))
            )
            total_users = total_users_result.scalar()
            
            return {
                'total_users': total_users,
                'total_oauth_users': total_oauth_users,
                'oauth_percentage': (total_oauth_users / total_users * 100) if total_users > 0 else 0,
                'provider_breakdown': provider_stats
            }
            
        except Exception as e:
            logger.error(f"Error getting OAuth user stats: {e}")
            return {'error': str(e)}
    
    async def audit_oauth_security_events(self, hours: int = 24) -> Dict[str, Any]:
        """
        Get OAuth security audit information for monitoring.
        
        Args:
            hours: Number of hours to look back for events
            
        Returns:
            Dictionary with OAuth security audit data
        """
        try:
            # This would typically query security logs from a database or log aggregation system
            # For now, return structure for monitoring dashboard
            
            return {
                'time_period_hours': hours,
                'oauth_events': {
                    'total_login_attempts': 0,
                    'successful_logins': 0,
                    'failed_logins': 0,
                    'new_accounts_created': 0,
                    'accounts_linked': 0,
                    'accounts_unlinked': 0,
                    'conflicts_detected': 0
                },
                'security_events': {
                    'invalid_state_attempts': 0,
                    'token_exchange_failures': 0,
                    'provider_errors': 0,
                    'configuration_errors': 0
                },
                'provider_breakdown': {
                    'google': {'attempts': 0, 'successes': 0, 'failures': 0},
                    'facebook': {'attempts': 0, 'successes': 0, 'failures': 0}
                },
                'top_failure_reasons': [],
                'suspicious_activity': {
                    'multiple_provider_attempts': 0,
                    'rapid_retry_attempts': 0,
                    'unusual_user_agents': 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting OAuth security audit data: {e}")
            return {'error': str(e)}
    
    def log_oauth_security_event(self, event_type: str, provider: str, user_id: Optional[int] = None, 
                                request: Optional[Any] = None, details: Optional[Dict[str, Any]] = None):
        """
        Enhanced OAuth security event logging.
        
        Args:
            event_type: Type of OAuth event
            provider: OAuth provider name
            user_id: User ID if available
            request: FastAPI request object
            details: Additional event details
        """
        # Use the existing log_oauth_security_event function
        log_oauth_security_event(event_type, provider, user_id, details)
        
        # Also log to SecurityAuditor if request is available
        if request:
            # Map OAuth event types to SecurityEventType
            event_mapping = {
                'login_success': SecurityEventType.OAUTH_LOGIN_SUCCESS,
                'login_failure': SecurityEventType.OAUTH_LOGIN_FAILURE,
                'user_created': SecurityEventType.OAUTH_USER_CREATED,
                'account_linked': SecurityEventType.OAUTH_ACCOUNT_LINKED,
                'account_unlinked': SecurityEventType.OAUTH_ACCOUNT_UNLINKED,
                'invalid_state': SecurityEventType.OAUTH_INVALID_STATE,
                'token_error': SecurityEventType.OAUTH_TOKEN_EXCHANGE_FAILED,
                'provider_error': SecurityEventType.OAUTH_PROVIDER_ERROR,
                'configuration_error': SecurityEventType.OAUTH_CONFIGURATION_ERROR
            }
            
            security_event_type = event_mapping.get(event_type, SecurityEventType.OAUTH_LOGIN_FAILURE)
            severity = "ERROR" if 'error' in event_type or 'failure' in event_type else "INFO"
            success = 'success' in event_type or 'created' in event_type or 'linked' in event_type
            
            audit_details = {
                'provider': provider,
                'oauth_event_type': event_type
            }
            if details:
                audit_details.update(details)
            
            SecurityAuditor.log_security_event(
                event_type=security_event_type,
                request=request,
                user_id=user_id,
                details=audit_details,
                severity=severity,
                success=success
            )