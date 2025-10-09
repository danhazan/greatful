#!/usr/bin/env python3
"""
Unit tests for password management functionality in the service layer.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import datetime

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.models.user import User
from app.models.token import PasswordResetToken
from app.core.exceptions import AuthenticationError

# Mark all tests in this file as async
pytestmark = pytest.mark.asyncio

@pytest.fixture
def mock_db():
    """Fixture for a mock database session."""
    db = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()
    return db

@pytest.fixture
def mock_user_service(mock_db):
    """Fixture for a mock UserService."""
    return UserService(mock_db)

@pytest.fixture
def mock_auth_service(mock_db):
    """Fixture for a mock AuthService."""
    return AuthService(mock_db)

@pytest.fixture
def password_user():
    """Fixture for a standard password-based user."""
    return User(
        id=1,
        email="test@example.com",
        username="testuser",
        hashed_password="$2b$12$EixZAe3sYCoB1s5qjBq9Uu.2Zz.0jZz.0jZz.0jZz.0jZz.0jZ",  # "password"
        oauth_provider=None
    )

@pytest.fixture
def oauth_user():
    """Fixture for an OAuth-based user."""
    return User(
        id=2,
        email="oauth@example.com",
        username="oauthuser",
        hashed_password="",
        oauth_provider="google"
    )

async def test_update_password_hashes_correctly(mock_user_service, password_user):
    """Verify that the UserService.update_password function correctly hashes and updates a user's password."""
    mock_user_service.user_repo.update = AsyncMock()
    with patch('app.services.user_service.get_password_hash') as mock_get_hash:
        mock_get_hash.return_value = "new_hashed_password"
        
        await mock_user_service.update_password(password_user, "new_password_123")
        
        mock_get_hash.assert_called_once_with("new_password_123")
        mock_user_service.user_repo.update.assert_called_once_with(password_user, hashed_password="new_hashed_password")

async def test_generate_reset_token_for_password_user(mock_auth_service, password_user):
    """Ensure a token is successfully generated for a standard user."""
    with patch('app.services.auth_service.User.get_by_email', new_callable=AsyncMock) as mock_get_user:
        mock_get_user.return_value = password_user
        
        token = await mock_auth_service.generate_password_reset_token("test@example.com")
        
        assert token is not None
        assert len(token) > 20
        mock_auth_service.db.add.assert_called_once()
        created_token = mock_auth_service.db.add.call_args[0][0]
        assert isinstance(created_token, PasswordResetToken)
        assert created_token.user_id == password_user.id

async def test_generate_reset_token_blocked_for_oauth_user(mock_auth_service, oauth_user):
    """Verify that OAuth users cannot initiate a password reset."""
    with patch('app.services.auth_service.User.get_by_email', new_callable=AsyncMock) as mock_get_user:
        mock_get_user.return_value = oauth_user
        
        token = await mock_auth_service.generate_password_reset_token("oauth@example.com")
        
        assert token is None
        mock_auth_service.db.add.assert_not_called()

async def test_generate_reset_token_for_nonexistent_user(mock_auth_service):
    """Confirm the function fails gracefully and doesn't leak user existence."""
    with patch('app.services.auth_service.User.get_by_email', new_callable=AsyncMock) as mock_get_user:
        mock_get_user.return_value = None
        
        token = await mock_auth_service.generate_password_reset_token("ghost@example.com")
        
        assert token is None
        mock_auth_service.db.add.assert_not_called()

async def test_reset_password_with_valid_token(mock_auth_service, password_user):
    """Test the complete successful password reset flow."""
    valid_token = PasswordResetToken(
        user_id=password_user.id,
        token="valid-token",
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        is_used=False
    )
    
    result = MagicMock()
    result.scalar_one_or_none.return_value = valid_token
    mock_auth_service.db.execute.return_value = result
    
    with patch.object(mock_auth_service, 'get_by_id', new_callable=AsyncMock) as mock_get_by_id, \
         patch.object(UserService, 'update_password', new_callable=AsyncMock) as mock_update_password:
        
        mock_get_by_id.return_value = password_user
        
        await mock_auth_service.reset_password_with_token("valid-token", "new_secure_password")
        
        mock_update_password.assert_called_once_with(password_user, "new_secure_password")
        assert valid_token.is_used is True
        mock_auth_service.db.commit.assert_called_once()

async def test_reset_password_fails_with_invalid_token(mock_auth_service):
    """Ensure an invalid token is rejected."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    mock_auth_service.db.execute.return_value = result
    
    with pytest.raises(AuthenticationError, match="Invalid or expired password reset token"):
        await mock_auth_service.reset_password_with_token("invalid-token", "any-password")

async def test_reset_password_fails_with_expired_token(mock_auth_service, password_user):
    """Ensure an expired token is rejected."""
    expired_token = PasswordResetToken(
        user_id=password_user.id,
        token="expired-token",
        expires_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=1),
        is_used=False
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = expired_token
    mock_auth_service.db.execute.return_value = result
    
    with pytest.raises(AuthenticationError, match="Invalid or expired password reset token"):
        await mock_auth_service.reset_password_with_token("expired-token", "any-password")

async def test_reset_password_fails_with_used_token(mock_auth_service, password_user):
    """Ensure a token can only be used once."""
    used_token = PasswordResetToken(
        user_id=password_user.id,
        token="used-token",
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        is_used=True
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = used_token
    mock_auth_service.db.execute.return_value = result
    
    with pytest.raises(AuthenticationError, match="Invalid or expired password reset token"):
        await mock_auth_service.reset_password_with_token("used-token", "any-password")
