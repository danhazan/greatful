"""
Unit tests for OAuth service functionality.
Tests OAuth user authentication, account linking, and user creation flows.
"""

import pytest
import pytest_asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timezone
from typing import Dict, Any

from app.services.oauth_service import OAuthService
from app.models.user import User
from app.core.exceptions import (
    AuthenticationError,
    ValidationException,
    ConflictError,
    BusinessLogicError
)


class TestOAuthService:
    """Test OAuth service functionality."""
    
    @pytest_asyncio.fixture
    async def oauth_service(self, db_session):
        """Create OAuth service instance for testing."""
        return OAuthService(db_session)
    
    @pytest_asyncio.fixture
    async def mock_oauth_user_info(self):
        """Mock OAuth user info from provider."""
        return {
            'id': 'google_user_123',
            'email': 'test@example.com',
            'name': 'Test User',
            'given_name': 'Test',
            'family_name': 'User',
            'picture': 'https://example.com/photo.jpg',
            'email_verified': True,
            'locale': 'en'
        }
    
    @pytest_asyncio.fixture
    async def mock_oauth_token(self):
        """Mock OAuth token from provider."""
        return {
            'access_token': 'mock_access_token_12345',
            'token_type': 'Bearer',
            'expires_in': 3600,
            'refresh_token': 'mock_refresh_token_67890',
            'scope': 'openid email profile'
        }
    
    @pytest_asyncio.fixture
    async def existing_user(self, db_session):
        """Create an existing user for testing."""
        user = User(
            email='existing@example.com',
            username='existinguser',
            hashed_password='hashed_password',
            display_name='Existing User'
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user
    
    @pytest_asyncio.fixture
    async def existing_oauth_user(self, db_session):
        """Create an existing OAuth user for testing."""
        user = User(
            email='oauth@example.com',
            username='oauthuser',
            hashed_password='',
            display_name='OAuth User',
            oauth_provider='google',
            oauth_id='google_existing_123',
            oauth_data={'provider_data': {'id': 'google_existing_123'}}
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_new_user(self, oauth_service, mock_oauth_user_info, mock_oauth_token):
        """Test OAuth authentication for new user creation."""
        with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
            mock_get_info.return_value = mock_oauth_user_info
            
            # Mock User.get_by_oauth to return None (no existing user)
            with patch.object(User, 'get_by_oauth', return_value=None):
                # Mock User.get_by_email to return None (no existing email user)
                with patch.object(User, 'get_by_email', return_value=None):
                    # Mock user creation
                    mock_user = Mock()
                    mock_user.id = 1
                    mock_user.email = mock_oauth_user_info['email']
                    mock_user.username = 'testuser'
                    mock_user.display_name = mock_oauth_user_info['name']
                    mock_user.oauth_provider = 'google'
                    mock_user.oauth_id = mock_oauth_user_info['id']
                    mock_user.oauth_data = {'last_login_via_oauth': True}
                    mock_user.created_at = datetime.now()
                    
                    # Mock the service's create_entity method
                    with patch.object(oauth_service, 'create_entity', return_value=mock_user):
                        # Mock token creation
                        with patch('app.core.security.create_access_token') as mock_access_token:
                            with patch('app.core.security.create_refresh_token') as mock_refresh_token:
                                mock_access_token.return_value = 'access_token_123'
                                mock_refresh_token.return_value = 'refresh_token_123'
                                
                                user_data, is_new_user = await oauth_service.authenticate_oauth_user(
                                    'google', mock_oauth_token
                                )
                                
                                assert is_new_user is True
                                assert 'user' in user_data
                                assert 'tokens' in user_data
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_existing_oauth_user(self, oauth_service, mock_oauth_user_info, mock_oauth_token, existing_oauth_user):
        """Test OAuth authentication for existing OAuth user."""
        with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
            mock_get_info.return_value = mock_oauth_user_info
            
            # Ensure oauth_data is properly initialized
            existing_oauth_user.oauth_data = existing_oauth_user.oauth_data or {}
            
            # Mock User.get_by_oauth to return existing user
            with patch.object(User, 'get_by_oauth', return_value=existing_oauth_user):
                # Mock the service's update_entity method
                updated_user = Mock()
                updated_user.id = existing_oauth_user.id
                updated_user.email = existing_oauth_user.email
                updated_user.username = existing_oauth_user.username
                updated_user.oauth_data = {'last_login_via_oauth': True}
                
                with patch.object(oauth_service, 'update_entity', return_value=updated_user):
                    # Mock token creation
                    with patch('app.core.security.create_access_token') as mock_access_token:
                        with patch('app.core.security.create_refresh_token') as mock_refresh_token:
                            mock_access_token.return_value = 'access_token_123'
                            mock_refresh_token.return_value = 'refresh_token_123'
                            
                            user_data, is_new_user = await oauth_service.authenticate_oauth_user(
                                'google', mock_oauth_token
                            )
                            
                            assert is_new_user is False
                            assert 'user' in user_data
                            assert 'tokens' in user_data
                            assert user_data['user']['id'] == existing_oauth_user.id
                            assert user_data['user']['email'] == existing_oauth_user.email
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_account_linking(self, oauth_service, mock_oauth_user_info, mock_oauth_token, existing_user):
        """Test OAuth authentication with account linking."""
        # Update mock to match existing user's email
        mock_oauth_user_info['email'] = existing_user.email
        
        with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
            mock_get_info.return_value = mock_oauth_user_info
            
            # Mock User.get_by_oauth to return None (no existing OAuth user)
            with patch.object(User, 'get_by_oauth', return_value=None):
                # Mock User.get_by_email to return existing user
                with patch.object(User, 'get_by_email', return_value=existing_user):
                    # Mock the linked user
                    linked_user = Mock()
                    linked_user.id = existing_user.id
                    linked_user.email = existing_user.email
                    linked_user.username = existing_user.username
                    linked_user.oauth_provider = 'google'
                    linked_user.oauth_id = mock_oauth_user_info['id']
                    linked_user.oauth_data = {'linked_via_oauth': True}
                    
                    # Mock the service's update_entity method
                    with patch.object(oauth_service, 'update_entity', return_value=linked_user):
                        # Mock token creation
                        with patch('app.core.security.create_access_token') as mock_access_token:
                            with patch('app.core.security.create_refresh_token') as mock_refresh_token:
                                mock_access_token.return_value = 'access_token_123'
                                mock_refresh_token.return_value = 'refresh_token_123'
                                
                                user_data, is_new_user = await oauth_service.authenticate_oauth_user(
                                    'google', mock_oauth_token
                                )
                                
                                assert is_new_user is False
                                assert user_data['user']['id'] == existing_user.id
                                assert user_data['user']['email'] == existing_user.email
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_invalid_user_data(self, oauth_service, mock_oauth_token):
        """Test OAuth authentication with invalid user data."""
        invalid_user_info = {
            'id': '',  # Missing ID
            'email': '',  # Missing email
            'name': 'Test User'
        }
        
        with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
            mock_get_info.return_value = invalid_user_info
            
            with pytest.raises(AuthenticationError) as exc_info:
                await oauth_service.authenticate_oauth_user('google', mock_oauth_token)
            
            assert "Invalid user data from OAuth provider" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_missing_oauth_id(self, oauth_service, mock_oauth_token):
        """Test OAuth authentication with missing OAuth ID."""
        invalid_user_info = {
            'email': 'test@example.com',
            'name': 'Test User'
            # Missing 'id' field
        }
        
        with patch('app.core.oauth_config.get_oauth_user_info') as mock_get_info:
            mock_get_info.return_value = invalid_user_info
            
            with pytest.raises(AuthenticationError):
                await oauth_service.authenticate_oauth_user('google', mock_oauth_token)
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_missing_email(self, oauth_service, mock_oauth_token):
        """Test OAuth authentication with missing email."""
        invalid_user_info = {
            'id': 'google_user_123',
            'name': 'Test User'
            # Missing 'email' field
        }
        
        with patch('app.core.oauth_config.get_oauth_user_info') as mock_get_info:
            mock_get_info.return_value = invalid_user_info
            
            with pytest.raises(AuthenticationError):
                await oauth_service.authenticate_oauth_user('google', mock_oauth_token)
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_provider_error(self, oauth_service, mock_oauth_token):
        """Test OAuth authentication when provider returns error."""
        with patch('app.core.oauth_config.get_oauth_user_info') as mock_get_info:
            mock_get_info.side_effect = Exception("Provider API error")
            
            with pytest.raises(AuthenticationError) as exc_info:
                await oauth_service.authenticate_oauth_user('google', mock_oauth_token)
            
            assert "OAuth authentication failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_create_oauth_user(self, oauth_service, mock_oauth_user_info):
        """Test creating new OAuth user."""
        with patch.object(oauth_service, '_ensure_unique_username') as mock_unique:
            mock_unique.return_value = 'testuser123'
            
            user = await oauth_service._create_oauth_user('google', mock_oauth_user_info)
            
            assert user.email == mock_oauth_user_info['email']
            assert user.username == 'testuser123'
            assert user.display_name == mock_oauth_user_info['name']
            assert user.oauth_provider == 'google'
            assert user.oauth_id == mock_oauth_user_info['id']
            assert user.hashed_password == ''  # OAuth users don't have passwords
    
    @pytest.mark.asyncio
    async def test_create_oauth_user_with_profile_image(self, oauth_service, mock_oauth_user_info):
        """Test creating OAuth user with profile image."""
        mock_oauth_user_info['picture'] = 'https://example.com/profile.jpg'
        
        with patch.object(oauth_service, '_ensure_unique_username') as mock_unique:
            mock_unique.return_value = 'testuser123'
            
            user = await oauth_service._create_oauth_user('google', mock_oauth_user_info)
            
            assert user.profile_image_url == 'https://example.com/profile.jpg'
    
    @pytest.mark.asyncio
    async def test_update_oauth_user(self, oauth_service, existing_oauth_user, mock_oauth_user_info):
        """Test updating existing OAuth user."""
        # Update mock data with new information
        mock_oauth_user_info['name'] = 'Updated Name'
        mock_oauth_user_info['picture'] = 'https://example.com/new_photo.jpg'
        
        # Mock the updated user
        updated_user = Mock()
        updated_user.id = existing_oauth_user.id
        updated_user.display_name = 'Updated Name'
        updated_user.profile_image_url = 'https://example.com/new_photo.jpg'
        updated_user.oauth_data = {
            'last_login_via_oauth': True,
            'last_login_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Mock the service's update_entity method
        with patch.object(oauth_service, 'update_entity', return_value=updated_user):
            result = await oauth_service._update_oauth_user(
                existing_oauth_user, mock_oauth_user_info
            )
            
            assert result.id == existing_oauth_user.id
            assert result.display_name == 'Updated Name'
            assert result.profile_image_url == 'https://example.com/new_photo.jpg'
            assert result.oauth_data['last_login_via_oauth'] is True
            assert 'last_login_at' in result.oauth_data
    
    @pytest.mark.asyncio
    async def test_link_oauth_account_success(self, oauth_service, existing_user, mock_oauth_user_info):
        """Test successful OAuth account linking."""
        # Mock the linked user
        linked_user = Mock()
        linked_user.id = existing_user.id
        linked_user.oauth_provider = 'google'
        linked_user.oauth_id = mock_oauth_user_info['id']
        linked_user.oauth_data = {'linked_via_oauth': True}
        
        # Mock the service's update_entity method
        with patch.object(oauth_service, 'update_entity', return_value=linked_user):
            result = await oauth_service._link_oauth_account_with_validation(
                existing_user, 'google', mock_oauth_user_info
            )
            
            assert result.id == existing_user.id
            assert result.oauth_provider == 'google'
            assert result.oauth_id == mock_oauth_user_info['id']
            assert result.oauth_data['linked_via_oauth'] is True
    
    @pytest.mark.asyncio
    async def test_link_oauth_account_conflict_different_provider(self, oauth_service, existing_oauth_user, mock_oauth_user_info):
        """Test OAuth account linking with different provider conflict."""
        # Try to link Facebook to user who already has Google
        with pytest.raises(ConflictError) as exc_info:
            await oauth_service._link_oauth_account_with_validation(
                existing_oauth_user, 'facebook', mock_oauth_user_info
            )
        
        assert "already linked to google" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_link_oauth_account_conflict_same_provider_different_account(self, oauth_service, existing_oauth_user, mock_oauth_user_info):
        """Test OAuth account linking with same provider but different account."""
        # Change OAuth ID to simulate different account
        mock_oauth_user_info['id'] = 'different_google_id'
        
        with pytest.raises(ConflictError) as exc_info:
            await oauth_service._link_oauth_account_with_validation(
                existing_oauth_user, 'google', mock_oauth_user_info
            )
        
        assert "different google account" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_generate_username_from_oauth(self, oauth_service, mock_oauth_user_info):
        """Test username generation from OAuth data."""
        # Test with given_name
        username = oauth_service._generate_username_from_oauth(mock_oauth_user_info)
        assert username == 'test'  # from given_name
        
        # Test with full name only
        oauth_info_name_only = {
            'name': 'John Doe',
            'email': 'john@example.com'
        }
        username = oauth_service._generate_username_from_oauth(oauth_info_name_only)
        assert username == 'john'  # first part of name
        
        # Test with email only
        oauth_info_email_only = {
            'email': 'jane.smith@example.com'
        }
        username = oauth_service._generate_username_from_oauth(oauth_info_email_only)
        assert username == 'janesmith'  # email prefix with dots removed
    
    @pytest.mark.asyncio
    async def test_extract_profile_data_google(self, oauth_service):
        """Test profile data extraction for Google provider."""
        google_user_info = {
            'id': 'google_123',
            'email': 'test@gmail.com',
            'name': 'Test User',
            'given_name': 'Test',
            'family_name': 'User',
            'picture': 'https://lh3.googleusercontent.com/photo.jpg',
            'locale': 'en-US'
        }
        
        profile_data = oauth_service._extract_profile_data(google_user_info, 'google')
        
        assert profile_data['display_name'] == 'Test User'
        assert profile_data['profile_image_url'] == 'https://lh3.googleusercontent.com/photo.jpg'
        assert profile_data['location']['locale'] == 'en-US'
    
    @pytest.mark.asyncio
    async def test_extract_profile_data_facebook(self, oauth_service):
        """Test profile data extraction for Facebook provider."""
        facebook_user_info = {
            'id': 'facebook_123',
            'email': 'test@facebook.com',
            'name': 'Test User',
            'picture': {
                'data': {
                    'url': 'https://graph.facebook.com/photo.jpg'
                }
            }
        }
        
        profile_data = oauth_service._extract_profile_data(facebook_user_info, 'facebook')
        
        assert profile_data['display_name'] == 'Test User'
        assert profile_data['profile_image_url'] == 'https://graph.facebook.com/photo.jpg'
    
    @pytest.mark.asyncio
    async def test_extract_profile_data_fallback(self, oauth_service):
        """Test profile data extraction with fallback logic."""
        minimal_user_info = {
            'id': 'provider_123',
            'email': 'fallback@example.com'
        }
        
        profile_data = oauth_service._extract_profile_data(minimal_user_info, 'google')
        
        assert profile_data['display_name'] == 'fallback'  # email prefix fallback
        assert profile_data['profile_image_url'] is None
    
    @pytest.mark.asyncio
    async def test_detect_oauth_conflicts_no_conflict(self, oauth_service, existing_user, mock_oauth_user_info):
        """Test OAuth conflict detection with no conflicts."""
        conflict_info = await oauth_service._detect_oauth_conflicts(
            existing_user, 'google', mock_oauth_user_info
        )
        
        assert conflict_info['has_conflicts'] is False
        assert conflict_info['conflict_type'] is None
    
    @pytest.mark.asyncio
    async def test_detect_oauth_conflicts_different_provider(self, oauth_service, existing_oauth_user, mock_oauth_user_info):
        """Test OAuth conflict detection with different provider."""
        conflict_info = await oauth_service._detect_oauth_conflicts(
            existing_oauth_user, 'facebook', mock_oauth_user_info
        )
        
        assert conflict_info['has_conflicts'] is True
        assert conflict_info['conflict_type'] == 'different_provider'
        assert conflict_info['existing_provider'] == 'google'
    
    @pytest.mark.asyncio
    async def test_detect_oauth_conflicts_same_provider_different_account(self, oauth_service, existing_oauth_user, mock_oauth_user_info):
        """Test OAuth conflict detection with same provider, different account."""
        # Change OAuth ID to simulate different account
        mock_oauth_user_info['id'] = 'different_google_id'
        
        conflict_info = await oauth_service._detect_oauth_conflicts(
            existing_oauth_user, 'google', mock_oauth_user_info
        )
        
        assert conflict_info['has_conflicts'] is True
        assert conflict_info['conflict_type'] == 'same_provider_different_account'
    
    @pytest.mark.asyncio
    async def test_format_user_response(self, oauth_service, existing_user):
        """Test user response formatting."""
        response = await oauth_service._format_user_response(existing_user)
        
        assert 'user' in response
        assert 'tokens' in response
        assert response['user']['id'] == existing_user.id
        assert response['user']['email'] == existing_user.email
        assert response['user']['username'] == existing_user.username
        assert 'access_token' in response['tokens']
        assert 'refresh_token' in response['tokens']
    
    @pytest.mark.asyncio
    async def test_ensure_unique_username(self, oauth_service):
        """Test unique username generation."""
        with patch.object(User, 'get_by_username') as mock_get_by_username:
            # First call returns None (username available)
            mock_get_by_username.return_value = None
            
            username = await oauth_service._ensure_unique_username('testuser')
            assert username == 'testuser'
    
    @pytest.mark.asyncio
    async def test_ensure_unique_username_with_collision(self, oauth_service, existing_user):
        """Test unique username generation with collision."""
        with patch.object(User, 'get_by_username') as mock_get_by_username:
            # First call returns existing user (collision), second call returns None
            mock_get_by_username.side_effect = [existing_user, None]
            
            username = await oauth_service._ensure_unique_username('existinguser')
            assert username != 'existinguser'  # Should be modified to avoid collision
            assert 'existinguser' in username  # Should contain original base
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_with_state(self, oauth_service, mock_oauth_user_info, mock_oauth_token):
        """Test OAuth authentication with state parameter."""
        state = 'google:secure_state_12345'
        
        with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
            mock_get_info.return_value = mock_oauth_user_info
            
            # Mock User.get_by_oauth to return None (no existing user)
            with patch.object(User, 'get_by_oauth', return_value=None):
                # Mock User.get_by_email to return None (no existing email user)
                with patch.object(User, 'get_by_email', return_value=None):
                    # Mock user creation
                    mock_user = Mock()
                    mock_user.id = 1
                    mock_user.email = mock_oauth_user_info['email']
                    mock_user.username = 'testuser'
                    mock_user.display_name = mock_oauth_user_info['name']
                    mock_user.oauth_provider = 'google'
                    mock_user.oauth_id = mock_oauth_user_info['id']
                    mock_user.oauth_data = {'last_login_via_oauth': True}
                    
                    # Mock the service's create_entity method
                    with patch.object(oauth_service, 'create_entity', return_value=mock_user):
                        # Mock token creation
                        with patch('app.core.security.create_access_token') as mock_access_token:
                            with patch('app.core.security.create_refresh_token') as mock_refresh_token:
                                mock_access_token.return_value = 'access_token_123'
                                mock_refresh_token.return_value = 'refresh_token_123'
                                
                                user_data, is_new_user = await oauth_service.authenticate_oauth_user(
                                    'google', mock_oauth_token, state
                                )
                                
                                assert is_new_user is True
                                assert user_data['user']['email'] == mock_oauth_user_info['email']
    
    @pytest.mark.asyncio
    async def test_authenticate_oauth_user_with_request_context(self, oauth_service, mock_oauth_user_info, mock_oauth_token):
        """Test OAuth authentication with request context for security logging."""
        mock_request = Mock()
        mock_request.client.host = '127.0.0.1'
        
        with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
            mock_get_info.return_value = mock_oauth_user_info
            
            # Mock User.get_by_oauth to return None (no existing user)
            with patch.object(User, 'get_by_oauth', return_value=None):
                # Mock User.get_by_email to return None (no existing email user)
                with patch.object(User, 'get_by_email', return_value=None):
                    # Mock user creation
                    mock_user = Mock()
                    mock_user.id = 1
                    mock_user.email = mock_oauth_user_info['email']
                    mock_user.username = 'testuser'
                    mock_user.display_name = mock_oauth_user_info['name']
                    mock_user.oauth_provider = 'google'
                    mock_user.oauth_id = mock_oauth_user_info['id']
                    mock_user.oauth_data = {'last_login_via_oauth': True}
                    
                    # Mock the service's create_entity method
                    with patch.object(oauth_service, 'create_entity', return_value=mock_user):
                        # Mock token creation
                        with patch('app.core.security.create_access_token') as mock_access_token:
                            with patch('app.core.security.create_refresh_token') as mock_refresh_token:
                                mock_access_token.return_value = 'access_token_123'
                                mock_refresh_token.return_value = 'refresh_token_123'
                                
                                with patch('app.core.security_audit.SecurityAuditor.log_security_event') as mock_log:
                                    user_data, is_new_user = await oauth_service.authenticate_oauth_user(
                                        'google', mock_oauth_token, request=mock_request
                                    )
                                    
                                    assert is_new_user is True
                                    # Verify security logging was called
                                    assert mock_log.called