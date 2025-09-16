"""
Test-only authentication endpoints for load testing.

These endpoints are only available when LOAD_TESTING environment variable is set.
They provide a way to mint valid JWT tokens for load testing without compromising
production security.
"""

import os
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Dict, Any

from app.core.database import get_db
from app.models.user import User
from app.utils.test_tokens import (
    create_access_token_for_user,
    create_test_mint_endpoint_response,
    is_load_testing_enabled,
    debug_token_info,
    validate_test_token
)

# Only create router if load testing is enabled
router = APIRouter(prefix="/_test", tags=["test-auth"])


class TokenRequest(BaseModel):
    """Request model for token minting."""
    user_id: int


class TokenResponse(BaseModel):
    """Response model for token minting."""
    access_token: str
    token_type: str
    expires_in: int
    user_id: int
    test_token: bool


class TokenDebugResponse(BaseModel):
    """Response model for token debugging."""
    header: Dict[str, Any]
    payload: Dict[str, Any]
    is_expired: bool
    user_id: str
    token_type: str
    issued_at: str
    expires_at: str


def check_load_testing_enabled():
    """Dependency to ensure load testing is enabled."""
    if not is_load_testing_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test endpoints only available when LOAD_TESTING=true"
        )


@router.post("/mint-token", response_model=TokenResponse)
async def mint_token_for_user(
    request: TokenRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(check_load_testing_enabled)
):
    """
    Mint a valid JWT token for a test user.
    
    This endpoint is only available when LOAD_TESTING environment variable is set.
    It creates real JWT tokens that can be used for load testing.
    
    Args:
        request: Token request with user_id
        db: Database session
        
    Returns:
        TokenResponse with valid JWT token
        
    Raises:
        HTTPException: If user not found or load testing not enabled
    """
    # Verify user exists
    user = await db.get(User, request.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {request.user_id} not found"
        )
    
    # Create token
    response_data = create_test_mint_endpoint_response(request.user_id)
    return TokenResponse(**response_data)


@router.post("/mint-tokens-batch")
async def mint_tokens_batch(
    user_ids: list[int],
    db: AsyncSession = Depends(get_db),
    _: None = Depends(check_load_testing_enabled)
):
    """
    Mint tokens for multiple users at once.
    
    Efficient for load test setup where you need many tokens.
    
    Args:
        user_ids: List of user IDs to create tokens for
        db: Database session
        
    Returns:
        Dict mapping user_id -> token_data
    """
    tokens = {}
    
    for user_id in user_ids:
        # Verify user exists
        user = await db.get(User, user_id)
        if user:
            token_data = create_test_mint_endpoint_response(user_id)
            tokens[user_id] = token_data
        else:
            tokens[user_id] = {"error": f"User {user_id} not found"}
    
    return {"tokens": tokens}


@router.post("/debug-token", response_model=TokenDebugResponse)
async def debug_token(
    token: str,
    _: None = Depends(check_load_testing_enabled)
):
    """
    Debug a JWT token to see its contents and validity.
    
    Useful for troubleshooting authentication issues during load testing.
    
    Args:
        token: JWT token to debug
        
    Returns:
        Token debug information
    """
    debug_info = debug_token_info(token)
    
    if "error" in debug_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=debug_info["error"]
        )
    
    return TokenDebugResponse(**debug_info)


@router.post("/validate-token")
async def validate_token(
    token: str,
    _: None = Depends(check_load_testing_enabled)
):
    """
    Validate a JWT token and return its payload.
    
    Args:
        token: JWT token to validate
        
    Returns:
        Token payload if valid
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        payload = validate_test_token(token)
        return {"valid": True, "payload": payload}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid token: {e}"
        )


@router.get("/health")
async def test_auth_health(_: None = Depends(check_load_testing_enabled)):
    """Health check for test auth endpoints."""
    return {
        "status": "healthy",
        "load_testing_enabled": is_load_testing_enabled(),
        "environment": os.environ.get("ENVIRONMENT", "unknown")
    }