"""
Common dependencies for API endpoints.
"""

import logging
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.exceptions import AuthenticationError
from app.core.security import decode_token
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
security = HTTPBearer()


def _token_version_matches(payload, user: User) -> bool:
    token_version = payload.get("token_version")
    if token_version is None:
        token_version = payload.get("tv")
    if token_version is None:
        return getattr(user, "token_version", 0) == 0
    try:
        return int(token_version) == int(getattr(user, "token_version", 0) or 0)
    except (TypeError, ValueError):
        return False


async def get_active_user_from_credentials(
    auth: HTTPAuthorizationCredentials,
    db: AsyncSession,
    token_type: str = "access",
) -> User:
    """Decode a token, fetch the user, and enforce active-account state."""
    payload = decode_token(auth.credentials, token_type=token_type)
    user_id = int(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthenticationError("User not found")
    status = getattr(user, "account_status", None)
    if isinstance(status, str) and status != "active":
        raise AuthenticationError("User account is inactive")
    if not _token_version_matches(payload, user):
        raise AuthenticationError("Authentication token has been invalidated")
    return user


async def get_current_user_id(
    auth: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> int:
    """
    Extract user ID from JWT token.
    
    Args:
        auth: HTTP authorization credentials
        
    Returns:
        int: User ID
        
    Raises:
        AuthenticationError: If token is invalid
    """
    # Check for test authentication bypass
    from app.core.test_auth import get_test_user_id_from_token, is_test_environment
    
    if is_test_environment():
        test_user_id = get_test_user_id_from_token(auth)
        if test_user_id is not None:
            return test_user_id
    
    try:
        user = await get_active_user_from_credentials(auth, db)
        return user.id
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise AuthenticationError("Invalid authentication token")


async def get_current_user(
    auth: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Args:
        auth: HTTP authorization credentials
        db: Database session
        
    Returns:
        User: Current authenticated user object
        
    Raises:
        AuthenticationError: If token is invalid or user not found
    """
    try:
        return await get_active_user_from_credentials(auth, db)
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Failed to get current user: {e}")
        raise AuthenticationError("Failed to authenticate user")
