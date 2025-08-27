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
    try:
        payload = decode_token(auth.credentials)
        user_id = int(payload.get("sub"))
        return user_id
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise AuthenticationError("Invalid authentication token")