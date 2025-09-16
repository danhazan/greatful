"""
Test token utilities for load testing.

This module provides utilities to generate real JWT tokens for load testing,
ensuring that load tests use the same authentication mechanism as production
while maintaining security isolation.
"""

import os
import time
import jwt
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone

# Use same JWT configuration as the main app
JWT_SECRET = os.environ.get("SECRET_KEY", "your-super-secret-key-change-this-in-production")
JWT_ALGO = os.environ.get("JWT_ALGO", "HS256")


def create_access_token_for_user(
    user_id: int, 
    expires_in: int = 60 * 60 * 24,  # 24 hours default
    additional_claims: Optional[Dict[str, Any]] = None
) -> str:
    """
    Create a real JWT access token for a test user.
    
    This generates tokens using the same secret and algorithm as the main app,
    ensuring load tests authenticate properly without bypassing security.
    
    Args:
        user_id: ID of the user to create token for
        expires_in: Token expiration time in seconds (default: 24 hours)
        additional_claims: Optional additional claims to include in token
        
    Returns:
        str: Valid JWT token that can be used with Authorization: Bearer header
        
    Example:
        token = create_access_token_for_user(123)
        headers = {"Authorization": f"Bearer {token}"}
    """
    now = int(time.time())
    
    # Standard JWT claims
    payload = {
        "sub": str(user_id),  # Subject (user ID as string)
        "iat": now,           # Issued at
        "exp": now + expires_in,  # Expiration
        "type": "access",     # Token type
        "jti": f"test_{user_id}_{now}",  # JWT ID for test tokens
    }
    
    # Add any additional claims
    if additional_claims:
        payload.update(additional_claims)
    
    # Encode the token
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)
    
    # Ensure we return a string (pyjwt sometimes returns bytes in older versions)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    
    return token


def create_refresh_token_for_user(
    user_id: int,
    expires_in: int = 60 * 60 * 24 * 30  # 30 days default
) -> str:
    """
    Create a refresh token for a test user.
    
    Args:
        user_id: ID of the user to create token for
        expires_in: Token expiration time in seconds (default: 30 days)
        
    Returns:
        str: Valid JWT refresh token
    """
    now = int(time.time())
    
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + expires_in,
        "type": "refresh",
        "jti": f"test_refresh_{user_id}_{now}",
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)
    
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    
    return token


def validate_test_token(token: str) -> Dict[str, Any]:
    """
    Validate a test token and return its payload.
    
    This is useful for debugging token issues during load testing.
    
    Args:
        token: JWT token to validate
        
    Returns:
        Dict containing token payload
        
    Raises:
        jwt.PyJWTError: If token is invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload
    except jwt.ExpiredSignatureError:
        raise jwt.PyJWTError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise jwt.PyJWTError(f"Invalid token: {e}")


def create_token_batch(user_ids: list, expires_in: int = 60 * 60 * 24) -> Dict[int, str]:
    """
    Create tokens for multiple users at once.
    
    This is efficient for load test setup where you need tokens for many users.
    
    Args:
        user_ids: List of user IDs to create tokens for
        expires_in: Token expiration time in seconds
        
    Returns:
        Dict mapping user_id -> token
        
    Example:
        tokens = create_token_batch([1, 2, 3, 4, 5])
        user_1_token = tokens[1]
    """
    tokens = {}
    for user_id in user_ids:
        tokens[user_id] = create_access_token_for_user(user_id, expires_in)
    return tokens


def debug_token_info(token: str) -> Dict[str, Any]:
    """
    Get debug information about a token without validating signature.
    
    Useful for troubleshooting token issues during load testing.
    
    Args:
        token: JWT token to inspect
        
    Returns:
        Dict with token information
    """
    try:
        # Decode without verification to see contents
        unverified = jwt.decode(token, options={"verify_signature": False})
        
        # Get header information
        header = jwt.get_unverified_header(token)
        
        return {
            "header": header,
            "payload": unverified,
            "is_expired": unverified.get("exp", 0) < time.time(),
            "user_id": unverified.get("sub"),
            "token_type": unverified.get("type"),
            "issued_at": datetime.fromtimestamp(unverified.get("iat", 0), tz=timezone.utc).isoformat(),
            "expires_at": datetime.fromtimestamp(unverified.get("exp", 0), tz=timezone.utc).isoformat(),
        }
    except Exception as e:
        return {"error": f"Failed to decode token: {e}"}


# Test-only endpoint helper (only use when LOAD_TESTING=true)
def is_load_testing_enabled() -> bool:
    """Check if load testing mode is enabled."""
    return os.environ.get("LOAD_TESTING", "").lower() == "true"


def create_test_mint_endpoint_response(user_id: int) -> Dict[str, Any]:
    """
    Create response for test token minting endpoint.
    
    Only use this when LOAD_TESTING environment variable is set.
    
    Args:
        user_id: User ID to create token for
        
    Returns:
        Dict with token and metadata
    """
    if not is_load_testing_enabled():
        raise ValueError("Test token minting only available when LOAD_TESTING=true")
    
    token = create_access_token_for_user(user_id)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 60 * 60 * 24,  # 24 hours
        "user_id": user_id,
        "test_token": True
    }