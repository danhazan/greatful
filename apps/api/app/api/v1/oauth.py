"""
OAuth authentication endpoints for social login integration.
"""

import logging
import os
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
            return {
                'providers': {},
                'redirect_uri': '',
                'environment': 'unknown',
                'initialized': False
            }
        
        status = oauth_config.get_provider_status()
        return status
        
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
        logger.info(f"OAuth login redirect URI: {callback_uri}")
        
        # Store custom redirect URI in state if provided
        state_data = {}
        if redirect_uri:
            state_data['redirect_uri'] = redirect_uri
        
        # Generate authorization URL manually to ensure consistency
        import urllib.parse
        import secrets
        
        # Generate state for CSRF protection
        state_value = f"{provider}:{secrets.token_urlsafe(20)}"
        
        # Build authorization URL manually
        auth_params = {
            'response_type': 'code',
            'client_id': os.getenv('GOOGLE_CLIENT_ID') if provider == 'google' else os.getenv('FACEBOOK_CLIENT_ID'),
            'redirect_uri': callback_uri,
            'scope': 'openid email profile',
            'state': state_value,
            'prompt': 'select_account'
        }
        
        if provider == 'google':
            base_url = 'https://accounts.google.com/o/oauth2/v2/auth'
        elif provider == 'facebook':
            base_url = 'https://www.facebook.com/v18.0/dialog/oauth'
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
        
        authorization_url = f"{base_url}?{urllib.parse.urlencode(auth_params)}"
        logger.info(f"Generated authorization URL with redirect_uri: {callback_uri}")
        logger.info(f"Authorization URL: {authorization_url[:100]}...")
        
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
    import traceback
    import json
    
    try:
        # Step 2: Enhanced logging for debugging OAuth callback flow
        logger.info("OAuth callback invoked", extra={
            "provider": provider, 
            "incoming_code_len": len(callback_data.code or ""), 
            "incoming_state_len": len(callback_data.state or "")
        })
        
        # Log presence of session keys (do not log secret values)
        session_keys = list(request.session.keys()) if hasattr(request, 'session') else None
        logger.info("Session keys snapshot", extra={"session_keys": session_keys})
        
        # If you store state in session, log the stored key presence
        if session_keys and "oauth_state" in session_keys:
            logger.info("oauth_state present in session")
        else:
            logger.info("oauth_state not present in session")
        
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
        logger.info("Using redirect_uri for exchange", extra={"redirect_uri": callback_uri})
        
        try:
            # For SPA flow, we need to manually exchange the code since session state is not available
            # Instead of using authorize_access_token which expects session state, use fetch_token directly
            import httpx
            
            # Get token endpoint URL for Google
            if provider == 'google':
                token_url = 'https://oauth2.googleapis.com/token'
            elif provider == 'facebook':
                token_url = 'https://graph.facebook.com/v18.0/oauth/access_token'
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
            
            # Prepare token exchange data
            client_id = os.getenv('GOOGLE_CLIENT_ID') if provider == 'google' else os.getenv('FACEBOOK_CLIENT_ID')
            client_secret = os.getenv('GOOGLE_CLIENT_SECRET') if provider == 'google' else os.getenv('FACEBOOK_CLIENT_SECRET')
            
            token_data = {
                'client_id': client_id,
                'client_secret': client_secret,
                'code': callback_data.code,
                'grant_type': 'authorization_code',
                'redirect_uri': callback_uri
            }
            
            # Enhanced logging for debugging
            logger.info("=== OAUTH TOKEN EXCHANGE DEBUG ===")
            logger.info(f"Provider: {provider}")
            logger.info(f"Token URL: {token_url}")
            logger.info(f"Code length: {len(callback_data.code or '')}")
            logger.info(f"Code first 10 chars: {callback_data.code[:10] if callback_data.code else 'None'}...")
            logger.info(f"Client ID: {client_id[:12] + '...' + client_id[-12:] if client_id else 'None'}")
            logger.info(f"Client Secret: ***{client_secret[-4:] if client_secret else 'None'}")
            logger.info(f"Redirect URI: {callback_uri}")
            logger.info(f"Grant Type: authorization_code")
            logger.info(f"State: {callback_data.state}")
            
            # Log exact request payload (mask secrets)
            masked_payload = {
                'client_id': client_id[:12] + '...' + client_id[-12:] if client_id else 'None',
                'client_secret': '***' + client_secret[-4:] if client_secret else 'None',
                'code': callback_data.code[:10] + '...' if callback_data.code else 'None',
                'grant_type': 'authorization_code',
                'redirect_uri': callback_uri
            }
            logger.info(f"Request payload (masked): {masked_payload}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(token_url, data=token_data, timeout=20.0)
                
                # Enhanced response logging
                logger.info(f"Response status: {response.status_code}")
                logger.info(f"Response headers: {dict(response.headers)}")
                logger.info(f"Response body: {response.text[:1000]}")
                logger.info("=== END OAUTH DEBUG ===")
                
                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    error_type = error_data.get('error', 'unknown_error')
                    error_desc = error_data.get('error_description', 'Unknown error')
                    
                    # Provide specific error messages
                    if error_type == 'redirect_uri_mismatch':
                        detail = "OAuth redirect URI mismatch. Please check Google Console configuration."
                    elif error_type == 'invalid_grant':
                        detail = "Invalid or expired authorization code. Please try logging in again."
                    elif error_type == 'invalid_client':
                        detail = "OAuth client configuration error. Please check credentials."
                    else:
                        detail = f"OAuth error: {error_type} - {error_desc}"
                    
                    raise HTTPException(status_code=400, detail=detail)
                
                token = response.json()
                logger.info("Token exchange succeeded")
                
        except HTTPException:
            raise
        except Exception as token_ex:
            logger.error("Token exchange failed: %s", token_ex)
            # If token_ex has .response, attempt to log response status/text snippet
            if hasattr(token_ex, "response"):
                try:
                    logger.error("Provider response status: %s", getattr(token_ex.response, "status_code", None))
                    # Only log small snippet and avoid secrets
                    response_text = getattr(token_ex.response, "text", "") or ""
                    logger.error("Provider response text (snippet): %s", response_text[:1000])
                except Exception:
                    pass
            raise
        
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
        
        logger.info("OAuth service result", extra={"has_tokens": bool(response_data.get("tokens"))})
        # Return raw data for Pydantic model validation (don't wrap in success_response)
        return response_data
        
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
        # Full stack trace in logs (non-secret)
        tb = traceback.format_exc()
        logger.error(f"OAuth callback error: {e.__class__.__name__} - {str(e)}")
        logger.error("Traceback: %s", tb)
        
        # If the exception was from an HTTP exchange with provider, attempt to capture response snippet
        if hasattr(e, "response"):
            try:
                logger.error("Provider response status: %s", getattr(e.response, "status_code", None))
                # only log small snippet and avoid secrets
                logger.error("Provider response text (snippet): %s", (e.response.text or "")[:1000])
            except Exception:
                pass
        
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