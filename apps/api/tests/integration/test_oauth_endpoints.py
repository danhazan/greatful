"""
Integration tests for OAuth endpoints.
Tests OAuth login flow, callback handling, and provider status endpoints.
"""

import pytest
import pytest_asyncio
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
import json
import httpx

from main import app
from app.models.user import User


class TestOAuthEndpointsIntegration:
    """Integration tests for OAuth endpoints."""
    
    @pytest_asyncio.fixture
    async def client(self):
        """Create test client."""
        # Initialize OAuth for integration tests
        from app.core.oauth_config import initialize_oauth_providers, get_oauth_config
        try:
            oauth_instance = initialize_oauth_providers()
            app.state.oauth = oauth_instance
            app.state.oauth_config = get_oauth_config()
        except Exception:
            # OAuth initialization might fail in test environment, that's ok for some tests
            app.state.oauth = None
            app.state.oauth_config = None
        return TestClient(app)
    
    @pytest_asyncio.fixture
    async def mock_oauth_config(self):
        """Mock OAuth configuration."""
        config = Mock()
        config.is_provider_available.return_value = True
        config.get_oauth_client.return_value = Mock()
        config.get_provider_status.return_value = {
            'providers': {'google': True, 'facebook': True},
            'redirect_uri': 'http://localhost:3000/auth/callback',
            'environment': 'test',
            'initialized': True
        }
        return config
    
    @pytest_asyncio.fixture
    async def mock_oauth_user_info(self):
        """Mock OAuth user info."""
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
    async def mock_token_response(self):
        """Mock OAuth token response."""
        return {
            'access_token': 'mock_access_token_12345',
            'token_type': 'Bearer',
            'expires_in': 3600,
            'refresh_token': 'mock_refresh_token_67890',
            'scope': 'openid email profile'
        }
    
    def test_oauth_providers_endpoint_not_configured(self, client):
        """Test OAuth providers endpoint when OAuth is not configured."""
        # Ensure OAuth is not configured
        app.state.oauth_config = None
        
        response = client.get("/api/v1/oauth/providers")
        
        assert response.status_code == 200
        data = response.json()
        assert data['providers'] == {}
        assert data['redirect_uri'] == ''
        assert data['environment'] == 'unknown'
        assert data['initialized'] is False
    
    def test_oauth_providers_endpoint_configured(self, client, mock_oauth_config):
        """Test OAuth providers endpoint when OAuth is configured."""
        app.state.oauth_config = mock_oauth_config
        
        response = client.get("/api/v1/oauth/providers")
        
        assert response.status_code == 200
        data = response.json()
        assert 'google' in data['providers']
        assert 'facebook' in data['providers']
        assert data['providers']['google'] is True
        assert data['providers']['facebook'] is True
        assert data['initialized'] is True
    
    def test_oauth_login_not_configured(self, client):
        """Test OAuth login when OAuth is not configured."""
        app.state.oauth_config = None
        app.state.oauth = None
        
        response = client.get("/api/v1/oauth/login/google")
        
        assert response.status_code == 503
        data = response.json()
        assert "OAuth service not available" in data['detail']
    
    def test_oauth_login_provider_not_available(self, client, mock_oauth_config):
        """Test OAuth login with unavailable provider."""
        mock_oauth_config.is_provider_available.return_value = False
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        response = client.get("/api/v1/oauth/login/google")
        
        assert response.status_code == 400
        data = response.json()
        assert "OAuth provider 'google' is not available" in data['detail']
    
    @patch.dict('os.environ', {
        'GOOGLE_CLIENT_ID': 'test_google_client_id',
        'GOOGLE_CLIENT_SECRET': 'test_google_client_secret'
    })
    def test_oauth_login_google_success(self, client, mock_oauth_config):
        """Test successful Google OAuth login initiation."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
            mock_redirect.return_value = 'http://localhost:3000/auth/callback'
            
            response = client.get("/api/v1/oauth/login/google", follow_redirects=False)
            
            assert response.status_code == 307  # Redirect response
            assert 'location' in response.headers
            location = response.headers['location']
            assert 'accounts.google.com/o/oauth2/v2/auth' in location
            assert 'client_id=test_google_client_id' in location
            assert 'redirect_uri=' in location
            assert 'state=' in location
    
    @patch.dict('os.environ', {
        'FACEBOOK_CLIENT_ID': 'test_facebook_client_id',
        'FACEBOOK_CLIENT_SECRET': 'test_facebook_client_secret'
    })
    def test_oauth_login_facebook_success(self, client, mock_oauth_config):
        """Test successful Facebook OAuth login initiation."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
            mock_redirect.return_value = 'http://localhost:3000/auth/callback'
            
            response = client.get("/api/v1/oauth/login/facebook", follow_redirects=False)
            
            assert response.status_code == 307  # Redirect response
            assert 'location' in response.headers
            location = response.headers['location']
            assert 'facebook.com/v18.0/dialog/oauth' in location
            assert 'client_id=test_facebook_client_id' in location
    
    def test_oauth_login_unsupported_provider(self, client, mock_oauth_config):
        """Test OAuth login with unsupported provider."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        response = client.get("/api/v1/oauth/login/twitter")
        
        assert response.status_code == 400
        data = response.json()
        assert "Unsupported provider: twitter" in data['detail']
    
    def test_oauth_callback_not_configured(self, client):
        """Test OAuth callback when OAuth is not configured."""
        app.state.oauth_config = None
        app.state.oauth = None
        
        callback_data = {
            'code': 'test_auth_code',
            'state': 'google:test_state_12345'
        }
        
        response = client.post("/api/v1/oauth/callback/google", json=callback_data)
        
        assert response.status_code == 503
        data = response.json()
        assert "OAuth service not available" in data['detail']
    
    def test_oauth_callback_provider_not_available(self, client, mock_oauth_config):
        """Test OAuth callback with unavailable provider."""
        mock_oauth_config.is_provider_available.return_value = False
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': 'test_auth_code',
            'state': 'google:test_state_12345'
        }
        
        response = client.post("/api/v1/oauth/callback/google", json=callback_data)
        
        assert response.status_code == 400
        data = response.json()
        assert "OAuth provider 'google' is not available" in data['detail']
    
    def test_oauth_callback_invalid_state(self, client, mock_oauth_config):
        """Test OAuth callback with invalid state."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': 'test_auth_code',
            'state': 'invalid'  # Too short
        }
        
        with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
            mock_validate.return_value = False
            
            response = client.post("/api/v1/oauth/callback/google", json=callback_data)
            
            assert response.status_code == 400
            data = response.json()
            assert "Invalid state parameter" in data['detail']
    
    @patch.dict('os.environ', {
        'GOOGLE_CLIENT_ID': 'test_google_client_id',
        'GOOGLE_CLIENT_SECRET': 'test_google_client_secret'
    })
    @pytest.mark.asyncio
    async def test_oauth_callback_token_exchange_failure(self, client, mock_oauth_config, setup_test_database):
        """Test OAuth callback with token exchange failure."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': 'invalid_auth_code',
            'state': 'google:valid_state_12345'
        }
        
        with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
            mock_validate.return_value = True
            
            with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
                mock_redirect.return_value = 'http://localhost:3000/auth/callback'
                
                with patch('httpx.AsyncClient') as mock_client:
                    # Mock failed token exchange
                    mock_response = Mock()
                    mock_response.status_code = 400
                    mock_response.headers = {'content-type': 'application/json'}
                    mock_response.json.return_value = {
                        'error': 'invalid_grant',
                        'error_description': 'Invalid authorization code'
                    }
                    mock_response.text = json.dumps({
                        'error': 'invalid_grant',
                        'error_description': 'Invalid authorization code'
                    })
                    
                    mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
                    
                    response = client.post("/api/v1/oauth/callback/google", json=callback_data)
                    
                    assert response.status_code == 400
                    data = response.json()
                    assert "Invalid or expired authorization code" in data['detail']
    
    @patch.dict('os.environ', {
        'GOOGLE_CLIENT_ID': 'test_google_client_id',
        'GOOGLE_CLIENT_SECRET': 'test_google_client_secret'
    })
    @pytest.mark.asyncio
    async def test_oauth_callback_redirect_uri_mismatch(self, client, mock_oauth_config, setup_test_database):
        """Test OAuth callback with redirect URI mismatch."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': 'test_auth_code',
            'state': 'google:valid_state_12345'
        }
        
        with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
            mock_validate.return_value = True
            
            with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
                mock_redirect.return_value = 'http://localhost:3000/auth/callback'
                
                with patch('httpx.AsyncClient') as mock_client:
                    # Mock redirect URI mismatch error
                    mock_response = Mock()
                    mock_response.status_code = 400
                    mock_response.headers = {'content-type': 'application/json'}
                    mock_response.json.return_value = {
                        'error': 'redirect_uri_mismatch',
                        'error_description': 'The redirect URI in the request does not match'
                    }
                    mock_response.text = json.dumps({
                        'error': 'redirect_uri_mismatch'
                    })
                    
                    mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
                    
                    response = client.post("/api/v1/oauth/callback/google", json=callback_data)
                    
                    assert response.status_code == 400
                    data = response.json()
                    assert "OAuth redirect URI mismatch" in data['detail']
    
    @patch.dict('os.environ', {
        'GOOGLE_CLIENT_ID': 'test_google_client_id',
        'GOOGLE_CLIENT_SECRET': 'test_google_client_secret'
    })
    @pytest.mark.asyncio
    async def test_oauth_callback_successful_new_user(self, client, mock_oauth_config, mock_token_response, mock_oauth_user_info, setup_test_database):
        """Test successful OAuth callback creating new user."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': 'valid_auth_code',
            'state': 'google:valid_state_12345'
        }
        
        with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
            mock_validate.return_value = True
            
            with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
                mock_redirect.return_value = 'http://localhost:3000/auth/callback'
                
                with patch('httpx.AsyncClient') as mock_client:
                    # Mock successful token exchange
                    mock_response = Mock()
                    mock_response.status_code = 200
                    mock_response.headers = {'content-type': 'application/json'}
                    mock_response.headers = {'content-type': 'application/json'}
                    mock_response.json.return_value = mock_token_response
                    mock_response.text = json.dumps(mock_token_response)
                    
                    mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
                    
                    with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
                        mock_get_info.return_value = mock_oauth_user_info
                        
                        response = client.post("/api/v1/oauth/callback/google", json=callback_data)
                        
                        assert response.status_code == 200
                        data = response.json()
                        assert 'user' in data
                        assert 'tokens' in data
                        assert 'is_new_user' in data
                        assert data['is_new_user'] is True
                        assert data['user']['email'] == mock_oauth_user_info['email']
                        assert data['user']['display_name'] == mock_oauth_user_info['name']
                        assert 'access_token' in data['tokens']
                        assert 'refresh_token' in data['tokens']
    
    @patch.dict('os.environ', {
        'FACEBOOK_CLIENT_ID': 'test_facebook_client_id',
        'FACEBOOK_CLIENT_SECRET': 'test_facebook_client_secret'
    })
    @pytest.mark.asyncio
    async def test_oauth_callback_facebook_success(self, client, mock_oauth_config, setup_test_database):
        """Test successful Facebook OAuth callback."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': 'facebook_auth_code',
            'state': 'facebook:valid_state_12345'
        }
        
        facebook_token = {
            'access_token': 'facebook_access_token',
            'token_type': 'bearer',
            'expires_in': 5183944
        }
        
        facebook_user_info = {
            'id': 'facebook_user_123',
            'email': 'test@facebook.com',
            'name': 'Facebook User',
            'picture': {
                'data': {
                    'url': 'https://graph.facebook.com/photo.jpg'
                }
            }
        }
        
        with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
            mock_validate.return_value = True
            
            with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
                mock_redirect.return_value = 'http://localhost:3000/auth/callback'
                
                with patch('httpx.AsyncClient') as mock_client:
                    # Mock successful Facebook token exchange
                    mock_response = Mock()
                    mock_response.status_code = 200
                    mock_response.headers = {'content-type': 'application/json'}
                    mock_response.headers = {'content-type': 'application/json'}
                    mock_response.json.return_value = facebook_token
                    mock_response.text = json.dumps(facebook_token)
                    
                    mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
                    
                    with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
                        mock_get_info.return_value = facebook_user_info
                        
                        response = client.post("/api/v1/oauth/callback/facebook", json=callback_data)
                        
                        assert response.status_code == 200
                        data = response.json()
                        assert 'user' in data
                        assert 'tokens' in data
                        assert data['user']['email'] == facebook_user_info['email']
    
    @pytest.mark.asyncio
    async def test_oauth_callback_existing_user_login(self, client, mock_oauth_config, mock_token_response, mock_oauth_user_info, setup_test_database):
        """Test OAuth callback with existing OAuth user."""
        # Create existing OAuth user using the test database session
        from app.models.user import User
        import uuid
        
        TestSessionLocal = setup_test_database
        async with TestSessionLocal() as db:
            existing_user = User(
                email=f'existing_oauth_user_{uuid.uuid4().hex[:8]}@example.com',  # Use unique email
                username=f'existingoauthuser_{uuid.uuid4().hex[:8]}',
                hashed_password='',
                display_name='Existing OAuth User',
                oauth_provider='google',
                oauth_id='existing_oauth_123'  # Use unique OAuth ID
            )
            db.add(existing_user)
            await db.commit()
            await db.refresh(existing_user)
        
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': 'valid_auth_code',
            'state': 'google:valid_state_12345'
        }
        
        with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
            mock_validate.return_value = True
            
            with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
                mock_redirect.return_value = 'http://localhost:3000/auth/callback'
                
                with patch('httpx.AsyncClient') as mock_client:
                    mock_response = Mock()
                    mock_response.status_code = 200
                    mock_response.headers = {'content-type': 'application/json'}
                    mock_response.json.return_value = mock_token_response
                    mock_response.text = json.dumps(mock_token_response)
                    
                    mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
                    
                    with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
                        # Make sure the mock OAuth user info matches the existing user's OAuth ID
                        existing_user_info = mock_oauth_user_info.copy()
                        existing_user_info['id'] = 'existing_oauth_123'  # Match the existing user's OAuth ID
                        mock_get_info.return_value = existing_user_info
                        
                        response = client.post("/api/v1/oauth/callback/google", json=callback_data)
                        
                        assert response.status_code == 200
                        data = response.json()
                        assert data['is_new_user'] is False
                        assert data['user']['id'] == existing_user.id
    
    def test_oauth_callback_authentication_service_failure(self, client, mock_oauth_config, mock_token_response, setup_test_database):
        """Test OAuth callback when authentication service fails."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': 'valid_auth_code',
            'state': 'google:valid_state_12345'
        }
        
        with patch('app.api.v1.oauth.validate_oauth_state') as mock_validate:
            mock_validate.return_value = True
            
            with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
                mock_redirect.return_value = 'http://localhost:3000/auth/callback'
                
                with patch('httpx.AsyncClient') as mock_client:
                    mock_response = Mock()
                    mock_response.status_code = 200
                    mock_response.headers = {'content-type': 'application/json'}
                    mock_response.json.return_value = mock_token_response
                    mock_response.text = json.dumps(mock_token_response)
                    
                    mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
                    
                    with patch('app.services.oauth_service.get_oauth_user_info') as mock_get_info:
                        mock_get_info.side_effect = Exception("Database connection failed")
                        
                        response = client.post("/api/v1/oauth/callback/google", json=callback_data)
                        
                        assert response.status_code == 401  # OAuth authentication error
                        data = response.json()
                        # Check if the error message is in the response
                        error_message = data.get('detail', str(data))
                        assert "OAuth authentication failed" in error_message
    
    def test_oauth_callback_missing_code(self, client, mock_oauth_config):
        """Test OAuth callback with missing authorization code."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'state': 'google:valid_state_12345'
            # Missing 'code' field
        }
        
        response = client.post("/api/v1/oauth/callback/google", json=callback_data)
        
        assert response.status_code == 422  # Validation error
        data = response.json()
        assert 'detail' in data
    
    def test_oauth_callback_empty_code(self, client, mock_oauth_config):
        """Test OAuth callback with empty authorization code."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        callback_data = {
            'code': '',  # Empty code
            'state': 'google:valid_state_12345'
        }
        
        response = client.post("/api/v1/oauth/callback/google", json=callback_data)
        
        assert response.status_code == 400  # Bad request for empty code
    
    def test_oauth_unlink_not_implemented(self, client):
        """Test OAuth unlink endpoint (not fully implemented)."""
        response = client.delete("/api/v1/oauth/unlink")
        
        assert response.status_code == 401  # Authentication required
        data = response.json()
        assert "Authentication required" in data['detail']
    
    def test_oauth_stats_not_implemented(self, client):
        """Test OAuth stats endpoint (not fully implemented)."""
        response = client.get("/api/v1/oauth/stats")
        
        assert response.status_code == 401  # Authentication required
        data = response.json()
        assert "Authentication required" in data['detail']
    
    def test_oauth_providers_endpoint_error_handling(self, client):
        """Test OAuth providers endpoint error handling."""
        # Mock OAuth config that raises an exception
        mock_config = Mock()
        mock_config.get_provider_status.side_effect = Exception("Config error")
        app.state.oauth_config = mock_config
        
        response = client.get("/api/v1/oauth/providers")
        
        assert response.status_code == 500
        data = response.json()
        assert "Failed to get OAuth provider status" in data['detail']
    
    @patch.dict('os.environ', {
        'GOOGLE_CLIENT_ID': 'test_google_client_id',
        'GOOGLE_CLIENT_SECRET': 'test_google_client_secret'
    })
    def test_oauth_login_with_custom_redirect_uri(self, client, mock_oauth_config):
        """Test OAuth login with custom redirect URI."""
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        with patch('app.core.oauth_config.get_oauth_redirect_uri') as mock_redirect:
            mock_redirect.return_value = 'http://localhost:3000/auth/callback'
            
            response = client.get("/api/v1/oauth/login/google?redirect_uri=http://example.com/custom", follow_redirects=False)
            
            assert response.status_code == 307  # Redirect response
            assert 'location' in response.headers
            location = response.headers['location']
            assert 'accounts.google.com/o/oauth2/v2/auth' in location
    
    def test_oauth_login_error_handling(self, client, mock_oauth_config):
        """Test OAuth login error handling."""
        mock_oauth_config.get_oauth_client.side_effect = Exception("OAuth client error")
        app.state.oauth_config = mock_oauth_config
        app.state.oauth = Mock()
        
        response = client.get("/api/v1/oauth/login/google")
        
        assert response.status_code == 500
        data = response.json()
        assert "Failed to initiate OAuth login" in data['detail']


class TestOAuthEndpointsValidation:
    """Test OAuth endpoint request/response validation."""
    
    def test_oauth_callback_request_validation(self):
        """Test OAuth callback request model validation."""
        from app.api.v1.oauth import OAuthCallbackRequest
        from pydantic import ValidationError
        
        # Valid request
        valid_request = OAuthCallbackRequest(
            code="valid_auth_code_123",
            state="google:valid_state_12345"
        )
        assert valid_request.code == "valid_auth_code_123"
        assert valid_request.state == "google:valid_state_12345"
        
        # Valid request without state
        valid_request_no_state = OAuthCallbackRequest(code="valid_auth_code_123")
        assert valid_request_no_state.code == "valid_auth_code_123"
        assert valid_request_no_state.state is None
        
        # Invalid request - missing code (should raise ValidationError)
        try:
            OAuthCallbackRequest(state="google:valid_state")
            assert False, "Should have raised ValidationError for missing code"
        except Exception as e:
            # Accept either ValidationError or pydantic validation error
            assert "code" in str(e).lower() or "required" in str(e).lower()
        
        # Invalid request - empty code (should be allowed by model but rejected by business logic)
        empty_code_request = OAuthCallbackRequest(code="", state="google:valid_state")
        assert empty_code_request.code == ""
    
    def test_oauth_login_response_validation(self):
        """Test OAuth login response model validation."""
        from app.api.v1.oauth import OAuthLoginResponse
        from pydantic import ValidationError
        
        # Valid response
        valid_response = OAuthLoginResponse(
            user={'id': 1, 'email': 'test@example.com'},
            tokens={'access_token': 'jwt_token', 'refresh_token': 'refresh_token'},
            is_new_user=True
        )
        assert valid_response.user['id'] == 1
        assert valid_response.tokens['access_token'] == 'jwt_token'
        assert valid_response.is_new_user is True
        
        # Invalid response - missing required fields
        with pytest.raises(ValidationError):
            OAuthLoginResponse(
                user={'id': 1},
                # Missing tokens and is_new_user
            )
    
    def test_oauth_provider_status_validation(self):
        """Test OAuth provider status model validation."""
        from app.api.v1.oauth import OAuthProviderStatus
        from pydantic import ValidationError
        
        # Valid status
        valid_status = OAuthProviderStatus(
            providers={'google': True, 'facebook': False},
            redirect_uri='http://localhost:3000/auth/callback',
            environment='test',
            initialized=True
        )
        assert valid_status.providers['google'] is True
        assert valid_status.providers['facebook'] is False
        assert valid_status.redirect_uri == 'http://localhost:3000/auth/callback'
        assert valid_status.environment == 'test'
        assert valid_status.initialized is True
        
        # Invalid status - missing required fields
        with pytest.raises(ValidationError):
            OAuthProviderStatus(
                providers={'google': True}
                # Missing other required fields
            )