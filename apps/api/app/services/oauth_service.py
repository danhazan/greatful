"""
OAuth authentication service for social login integration.
"""

import logging
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.service_base import BaseService
from app.core.exceptions import (
    ValidationException, 
    ConflictError, 
    NotFoundError,
    AuthenticationError,
    BusinessLogicError
)
from app.models.user import User
from app.core.oauth_config import get_oauth_user_info, log_oauth_security_event
from app.core.security import create_access_token, create_refresh_token
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
        state: Optional[str] = None
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Authenticate user via OAuth provider.
        
        Args:
            provider: OAuth provider name ('google' or 'facebook')
            oauth_token: OAuth token from provider
            state: OAuth state parameter for CSRF protection
            
        Returns:
            Tuple of (user_data, is_new_user)
            
        Raises:
            AuthenticationError: If OAuth authentication fails
            ValidationException: If user data is invalid
        """
        try:
            # Get user info from OAuth provider
            oauth_user_info = await get_oauth_user_info(provider, oauth_token)
            
            # Validate required fields
            if not oauth_user_info.get('id'):
                log_oauth_security_event('invalid_user_data', provider, details={'error': 'missing_id'})
                raise AuthenticationError("Invalid user data from OAuth provider")
            
            if not oauth_user_info.get('email'):
                log_oauth_security_event('invalid_user_data', provider, details={'error': 'missing_email'})
                raise AuthenticationError("Email is required for OAuth authentication")
            
            # Check if user exists by OAuth credentials
            existing_user = await User.get_by_oauth(
                self.db, 
                provider, 
                oauth_user_info['id']
            )
            
            if existing_user:
                # Update existing OAuth user
                updated_user = await self._update_oauth_user(existing_user, oauth_user_info)
                log_oauth_security_event('login_success', provider, user_id=updated_user.id)
                return await self._format_user_response(updated_user), False
            
            # Check if user exists by email (for account linking)
            existing_email_user = await User.get_by_email(self.db, oauth_user_info['email'])
            
            if existing_email_user:
                # Link OAuth account to existing email account
                linked_user = await self._link_oauth_account(existing_email_user, provider, oauth_user_info)
                log_oauth_security_event('account_linked', provider, user_id=linked_user.id)
                return await self._format_user_response(linked_user), False
            
            # Create new user from OAuth data
            new_user = await self._create_oauth_user(provider, oauth_user_info)
            log_oauth_security_event('user_created', provider, user_id=new_user.id)
            return await self._format_user_response(new_user), True
            
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"OAuth authentication failed for {provider}: {e}")
            log_oauth_security_event('authentication_error', provider, details={'error': str(e)})
            raise AuthenticationError(f"OAuth authentication failed: {str(e)}")
    
    async def _create_oauth_user(self, provider: str, oauth_user_info: Dict[str, Any]) -> User:
        """
        Create a new user from OAuth provider data.
        
        Args:
            provider: OAuth provider name
            oauth_user_info: User information from OAuth provider
            
        Returns:
            Created User instance
        """
        try:
            # Generate unique username from OAuth data
            base_username = self._generate_username_from_oauth(oauth_user_info)
            username = await self._ensure_unique_username(base_username)
            
            # Prepare user data
            user_data = {
                'email': oauth_user_info['email'],
                'username': username,
                'hashed_password': '',  # OAuth users don't have passwords
                'display_name': oauth_user_info.get('name', ''),
                'oauth_provider': provider,
                'oauth_id': oauth_user_info['id'],
                'oauth_data': {
                    'provider_data': oauth_user_info,
                    'created_via_oauth': True,
                    'email_verified': oauth_user_info.get('email_verified', False)
                }
            }
            
            # Set profile image if available
            if oauth_user_info.get('picture'):
                user_data['profile_image_url'] = oauth_user_info['picture']
            
            # Create user
            user = await self.create_entity(User, **user_data)
            
            logger.info(f"Created new OAuth user: {user.id} via {provider}")
            return user
            
        except IntegrityError as e:
            logger.error(f"Database integrity error creating OAuth user: {e}")
            raise ConflictError("User account creation failed", "User")
        except Exception as e:
            logger.error(f"Error creating OAuth user: {e}")
            raise BusinessLogicError(f"Failed to create user account: {str(e)}")
    
    async def _update_oauth_user(self, user: User, oauth_user_info: Dict[str, Any]) -> User:
        """
        Update existing OAuth user with latest provider data.
        
        Args:
            user: Existing User instance
            oauth_user_info: Updated user information from OAuth provider
            
        Returns:
            Updated User instance
        """
        try:
            # Update OAuth data
            oauth_data = user.oauth_data or {}
            oauth_data.update({
                'provider_data': oauth_user_info,
                'last_login_via_oauth': True,
                'email_verified': oauth_user_info.get('email_verified', False)
            })
            
            # Update user fields
            update_data = {
                'oauth_data': oauth_data
            }
            
            # Update display name if not set or if OAuth provides a better one
            if not user.display_name or oauth_user_info.get('name'):
                update_data['display_name'] = oauth_user_info.get('name', user.display_name)
            
            # Update profile image if OAuth provides one and user doesn't have one
            if oauth_user_info.get('picture') and not user.profile_image_url:
                update_data['profile_image_url'] = oauth_user_info['picture']
            
            # Update user
            updated_user = await self.update_entity(user, **update_data)
            
            logger.info(f"Updated OAuth user: {user.id}")
            return updated_user
            
        except Exception as e:
            logger.error(f"Error updating OAuth user: {e}")
            raise BusinessLogicError(f"Failed to update user account: {str(e)}")
    
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
    
    async def _ensure_unique_username(self, base_username: str) -> str:
        """
        Ensure username is unique by appending numbers if necessary.
        
        Args:
            base_username: Base username to make unique
            
        Returns:
            Unique username
        """
        username = base_username
        counter = 1
        
        while True:
            existing_user = await User.get_by_username(self.db, username)
            if not existing_user:
                return username
            
            username = f"{base_username}{counter}"
            counter += 1
            
            # Prevent infinite loop
            if counter > 9999:
                import uuid
                username = f"{base_username}{str(uuid.uuid4())[:8]}"
                break
        
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