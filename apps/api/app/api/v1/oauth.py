"""
OAuth authentication endpoints for social login integration.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.responses import success_response, error_response
from app.core.exceptions import AuthenticationError, ValidationException, BusinessLogicError
from app.core.oauth_config import (
    get_oauth_config, 
    validate_oauth_state, 
    get_oauth_redirect_uri,
    log_oauth_security_event
)
from app.services.oauth_service import OAuthService

logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic models for request/response validation
class OAuthCallbackRequest(BaseModel):
    """OAuth callback request model."""
    code: str = Field(..., description="Authorization code from OAuth provider")
    state: Optional[str] = Field(None, description="State parameter for CSRF protection")

class OAuthLoginResponse(BaseModel):
    """OAuth login response model."""
    user: Dict[str, Any] = Field(..., description="User information")
    tokens: Dict[str, Any] = Field(..., description="JWT tokens")
    is_new_user: bool = Field(..., description="Whether this is a newly created user")

class OAuthProviderStatus(BaseModel):
    """OAuth provider status model."""
    providers: Dict[str, bool] = Field(..., description="Available OAuth providers")
    redirect_uri: str = Field(..., description="OAuth redirect URI")
    environment: str = Field(..., description="Current environment")
    initialized: bool = Field(..., description="Whether OAuth is initialized")

@router.get("/providers", response_model=OAuthProviderStatus)
async def get_oauth_providers(request: Request):
    """
    Get available OAuth providers and their status.
    
    Returns:
        Dictionary containing OAuth provider information
    """
    try:
        oauth_config = getattr(request.app.state, 'oauth_config', None)
        
        if not oauth_config:
            return success_response({
                'providers': {},
                'redirect_uri': '',
                'environment': 'unknown',
                'initialized': False
            }, getattr(request.state, 'request_id', None))
        
        status = oauth_config.get_provider_status()
        return success_response(status, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        logger.error(f"Error getting OAuth provider status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get OAuth provider status")

@router.get("/login/{provider}")
async def oauth_login(
    provider: str,
    request: Request,
    redirect_uri: Optional[str] = Query(None, description="Custom redirect URI after authentication")
):
    """
    Initiate OAuth login flow for specified provider.
    
    Args:
        provider: OAuth provider name ('google' or 'facebook')
        redirect_uri: Optional custom redirect URI
        
    Returns:
        Redirect to OAuth provider authorization URL
    """
    try:
        oauth_config = getattr(request.app.state, 'oauth_config', None)
        oauth_instance = getattr(request.app.state, 'oauth', None)
        
        if not oauth_config or not oauth_instance:
            log_oauth_security_event('oauth_not_configured', provider)
            raise HTTPException(status_code=503, detail="OAuth service not available")
        
        if not oauth_config.is_provider_available(provider):
            log_oauth_security_event('provider_not_available', provider)
            raise HTTPException(status_code=400, detail=f"OAuth provider '{provider}' is not available")
        
        # Get OAuth client for provider
        oauth_client = oauth_config.get_oauth_client(provider)
        
        # Generate redirect URI
        callback_uri = get_oauth_redirect_uri(provider)
        
        # Store custom redirect URI in state if provided
        state_data = {}
        if redirect_uri:
            state_data['redirect_uri'] = redirect_uri
        
        # Generate authorization URL
        authorization_url = await oauth_client.create_authorization_url(
            callback_uri,
            state=state_data
        )
        
        log_oauth_security_event('login_initiated', provider)
        logger.info(f"OAuth login initiated for {provider}")
        
        return RedirectResponse(url=authorization_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating OAuth login for {provider}: {e}")
        log_oauth_security_event('login_error', provider, details={'error': str(e)})
        raise HTTPException(status_code=500, detail="Failed to initiate OAuth login")

@router.post("/callback/{provider}", response_model=OAuthLoginResponse)
async def oauth_callback(
    provider: str,
    callback_data: OAuthCallbackRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OAuth callback and authenticate user.
    
    Args:
        provider: OAuth provider name ('google' or 'facebook')
        callback_data: OAuth callback data including authorization code
        db: Database session
        
    Returns:
        User information and JWT tokens
    """
    try:
        oauth_config = getattr(request.app.state, 'oauth_config', None)
        oauth_instance = getattr(request.app.state, 'oauth', None)
        
        if not oauth_config or not oauth_instance:
            log_oauth_security_event('oauth_not_configured', provider)
            raise HTTPException(status_code=503, detail="OAuth service not available")
        
        if not oauth_config.is_provider_available(provider):
            log_oauth_security_event('provider_not_available', provider)
            raise HTTPException(status_code=400, detail=f"OAuth provider '{provider}' is not available")
        
        # Validate state parameter for CSRF protection
        if callback_data.state and not validate_oauth_state(callback_data.state):
            log_oauth_security_event('invalid_state', provider, details={'state': callback_data.state})
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Get OAuth client for provider
        oauth_client = oauth_config.get_oauth_client(provider)
        
        # Exchange authorization code for access token
        callback_uri = get_oauth_redirect_uri(provider)
        token = await oauth_client.authorize_access_token(
            request,
            code=callback_data.code,
            redirect_uri=callback_uri
        )
        
        if not token:
            log_oauth_security_event('token_exchange_failed', provider)
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code for token")
        
        # Authenticate user with OAuth service
        oauth_service = OAuthService(db)
        user_data, is_new_user = await oauth_service.authenticate_oauth_user(
            provider, 
            token, 
            callback_data.state
        )
        
        response_data = {
            'user': user_data['user'],
            'tokens': user_data['tokens'],
            'is_new_user': is_new_user
        }
        
        return success_response(response_data, getattr(request.state, 'request_id', None))
        
    except HTTPException:
        raise
    except AuthenticationError as e:
        log_oauth_security_event('authentication_failed', provider, details={'error': str(e)})
        raise HTTPException(status_code=401, detail=str(e))
    except ValidationException as e:
        log_oauth_security_event('validation_failed', provider, details={'error': str(e)})
        raise HTTPException(status_code=422, detail=str(e))
    except BusinessLogicError as e:
        log_oauth_security_event('business_logic_error', provider, details={'error': str(e)})
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in OAuth callback for {provider}: {e}")
        log_oauth_security_event('callback_error', provider, details={'error': str(e)})
        raise HTTPException(status_code=500, detail="OAuth authentication failed")

@router.delete("/unlink")
async def unlink_oauth_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(lambda: None)  # TODO: Add proper auth dependency when available
):
    """
    Unlink OAuth account from current user.
    
    Args:
        request: FastAPI request object
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Success message
    """
    try:
        # TODO: Replace with proper authentication dependency
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        oauth_service = OAuthService(db)
        updated_user = await oauth_service.unlink_oauth_account(current_user.id)
        
        return success_response(
            {'message': 'OAuth account unlinked successfully'},
            getattr(request.state, 'request_id', None)
        )
        
    except HTTPException:
        raise
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error unlinking OAuth account: {e}")
        raise HTTPException(status_code=500, detail="Failed to unlink OAuth account")

@router.get("/stats")
async def get_oauth_stats(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(lambda: None)  # TODO: Add proper admin auth dependency when available
):
    """
    Get OAuth usage statistics (admin only).
    
    Args:
        request: FastAPI request object
        db: Database session
        current_user: Current authenticated user (must be admin)
        
    Returns:
        OAuth usage statistics
    """
    try:
        # TODO: Replace with proper admin authentication dependency
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # TODO: Add admin role check
        # if not current_user.is_admin:
        #     raise HTTPException(status_code=403, detail="Admin access required")
        
        oauth_service = OAuthService(db)
        stats = await oauth_service.get_oauth_users_stats()
        
        return success_response(stats, getattr(request.state, 'request_id', None))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting OAuth stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get OAuth statistics")