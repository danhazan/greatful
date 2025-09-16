"""
Common dependencies for API endpoints.
"""

import logging
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.exceptions import AuthenticationError
from app.core.security import decode_token

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