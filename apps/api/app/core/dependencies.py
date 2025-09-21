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


async def get_current_user_id(auth: HTTPAuthorizationCredentials = Depends(security)) -> int:
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
        payload = decode_token(auth.credentials)
        user_id = int(payload.get("sub"))
        return user_id
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
        # Get user ID from token
        user_id = await get_current_user_id(auth)
        
        # Fetch user from database
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if user is None:
            logger.warning(f"User not found for ID: {user_id}")
            raise AuthenticationError("User not found")
        
        # Check if user is active
        if not user.is_active:
            logger.warning(f"Inactive user attempted access: {user_id}")
            raise AuthenticationError("User account is inactive")
        
        return user
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Failed to get current user: {e}")
        raise AuthenticationError("Failed to authenticate user")