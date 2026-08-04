"""
OAuth authentication endpoints for social login integration.
"""

import logging
import os
from typing import Dict, Any, Optional
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.responses import success_response, error_response, AuthResponse, build_auth_response
from app.core.exceptions import AuthenticationError, AuthenticationMethodMismatch, ConflictError, ValidationException, BusinessLogicError, ResurrectionRequired
from app.core.oauth_config import (
    get_oauth_config, 
    validate_oauth_state, 
    validate_mobile_oauth_state,
    compute_pkce_challenge,
    is_valid_code_verifier,
    get_oauth_redirect_uri,
    MOBILE_OAUTH_APP_SCHEME,
    log_oauth_security_event
)
from app.core.security import create_oauth_state_token
from app.services.oauth_service import OAuthService

logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic models for request/response validation
class OAuthCallbackRequest(BaseModel):
    """OAuth callback request model."""
    code: str = Field(..., description="Authorization code from OAuth provider")
    state: Optional[str] = Field(None, description="State parameter for CSRF protection")
    code_verifier: Optional[str] = Field(None, description="PKCE code verifier (required for mobile flow)")

# OAuthLoginResponse removed in favor of canonical AuthResponse

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
        raise HTTPException(status_code=500, detail="Failed to get OAuth provider status") from e

@router.get("/login/{provider}")
async def oauth_login(
    provider: str,
    request: Request,
    redirect_uri: Optional[str] = Query(None, description="Custom redirect URI after authentication"),
    client: Optional[str] = Query(None, description="OAuth client type ('mobile' enables the mobile flow)"),
    code_challenge: Optional[str] = Query(None, description="PKCE code challenge (required when client=mobile)"),
    code_challenge_method: Optional[str] = Query(None, description="PKCE code challenge method (S256 only)")
):
    """
    Initiate OAuth login flow for specified provider.

    Web/default requests keep the existing behavior: a 302 redirect to the
    provider authorization URL with an opaque `provider:token` state.

    client=mobile requests return 200 JSON {authorization_url} and use a
    signed JWT state with the PKCE code challenge bound inside it.

    Args:
        provider: OAuth provider name ('google' or 'apple')
        redirect_uri: Optional custom redirect URI (web only; dead for mobile)
        client: OAuth client type
        code_challenge: PKCE code challenge (mobile only)
        code_challenge_method: PKCE method — only 'S256' is accepted

    Returns:
        Web: Redirect to OAuth provider authorization URL
        Mobile: JSON {"authorization_url": "..."}
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
        
        # Mobile flow parameters
        is_mobile = client == "mobile"
        if client is not None and not is_mobile:
            raise HTTPException(status_code=422, detail="client must be 'mobile'")
        if is_mobile:
            if not code_challenge:
                raise HTTPException(status_code=422, detail="code_challenge is required for client=mobile")
            if code_challenge_method != "S256":
                raise HTTPException(status_code=422, detail="only S256 code_challenge_method is supported")
        
        # Get OAuth client for provider
        oauth_client = oauth_config.get_oauth_client(provider)
        
        # Generate redirect URI (server-derived; client-supplied redirect_uri is never used)
        callback_uri = get_oauth_redirect_uri(provider, client="mobile") if is_mobile else get_oauth_redirect_uri(provider)
        logger.info(f"OAuth login redirect URI: {callback_uri}")
        
        # Store custom redirect URI in state if provided
        state_data = {}
        if redirect_uri:
            state_data['redirect_uri'] = redirect_uri
        
        # Generate authorization URL manually to ensure consistency
        import urllib.parse
        import secrets
        
        # Generate state for CSRF protection: signed JWT for mobile, opaque
        # provider:token for web (web behavior unchanged).
        if is_mobile:
            state_value = create_oauth_state_token(provider, "mobile", code_challenge)
        else:
            state_value = f"{provider}:{secrets.token_urlsafe(20)}"
        
        # Build authorization URL manually
        auth_params = {
            'response_type': 'code',
            'client_id': os.getenv('GOOGLE_CLIENT_ID') if provider == 'google' else os.getenv('APPLE_CLIENT_ID'),
            'redirect_uri': callback_uri,
            'scope': 'openid email profile' if provider == 'google' else 'email public_profile',
            'state': state_value,
        }
        if is_mobile:
            auth_params['code_challenge'] = code_challenge
            auth_params['code_challenge_method'] = 'S256'
        if provider == 'google':
            auth_params['prompt'] = 'select_account'
        
        if provider == 'google':
            base_url = 'https://accounts.google.com/o/oauth2/v2/auth'
        elif provider == 'apple':
            base_url = 'https://apple.placeholder.com/auth/authorize'
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
        
        authorization_url = f"{base_url}?{urllib.parse.urlencode(auth_params)}"
        
        log_oauth_security_event('login_initiated', provider)
        logger.info(f"OAuth login initiated for {provider}")
        
        if is_mobile:
            return {"authorization_url": authorization_url}
        
        return RedirectResponse(url=authorization_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating OAuth login for {provider}: {e}")
        log_oauth_security_event('login_error', provider, details={'error': str(e)})
        raise HTTPException(status_code=500, detail="Failed to initiate OAuth login") from e

@router.get("/callback/{provider}")
async def oauth_callback_relay(
    provider: str,
    code: Optional[str] = Query(None, description="Authorization code from OAuth provider"),
    state: Optional[str] = Query(None, description="State parameter from OAuth provider"),
    error: Optional[str] = Query(None, description="OAuth provider error code"),
    error_description: Optional[str] = Query(None, description="OAuth provider error description")
):
    """
    Minimal delivery relay for the mobile OAuth flow.

    Google redirects the mobile browser to this HTTPS route; this handler
    only forwards code/state (or error) to the mobile app via its custom
    URI scheme (MOBILE_OAUTH_APP_SCHEME).

    This is a delivery hop, NOT an authentication endpoint: it performs no
    state validation, exchanges no tokens, fetches no user info, creates no
    session, and consumes no authorization code. The authoritative security
    checks live on POST /callback/{provider}.

    Args:
        provider: OAuth provider name ('google' or 'apple')
        code: Authorization code to relay
        state: State parameter to relay
        error: Provider error code to relay
        error_description: Provider error description to relay

    Returns:
        302 redirect to the mobile app's custom URI scheme
    """
    import urllib.parse

    relay_params = {}
    if code:
        relay_params['code'] = code
    if state:
        relay_params['state'] = state
    if error:
        relay_params['error'] = error
    if error_description:
        relay_params['error_description'] = error_description

    relay_url = f"{MOBILE_OAUTH_APP_SCHEME}://oauth/callback"
    if relay_params:
        relay_url = f"{relay_url}?{urllib.parse.urlencode(relay_params)}"

    logger.info("OAuth mobile relay", extra={
        "provider": provider,
        "relayed_params": list(relay_params.keys()),
        "target": MOBILE_OAUTH_APP_SCHEME,
    })

    return RedirectResponse(url=relay_url, status_code=302)

@router.post("/callback/{provider}", response_model=AuthResponse)
async def oauth_callback(
    provider: str,
    callback_data: OAuthCallbackRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OAuth callback and authenticate user.
    
    Args:
        provider: OAuth provider name ('google' or 'apple')
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
        
        # Discriminate by state format. Web states are ALWAYS "provider:token"
        # (colon-delimited); mobile states are signed JWTs, and base64url-encoded
        # JWTs can never contain a colon. Every colon-less state is therefore
        # routed to the strict mobile JWT validator and fails closed unless it is
        # a genuine signed state token. This is intentionally not a dot-count
        # heuristic: the web validator is format-agnostic (length-only), so a
        # truncated/tampered JWT could otherwise fall through to the web path and
        # be accepted as web state.
        is_mobile_state = callback_data.state is not None and ":" not in callback_data.state

        # Validate state parameter for CSRF protection
        if is_mobile_state:
            # State validation FIRST (per the approved contract), then PKCE.
            try:
                state_payload = validate_mobile_oauth_state(callback_data.state, provider=provider)
            except (jwt.PyJWTError, ValueError):
                log_oauth_security_event('invalid_state', provider)
                raise HTTPException(status_code=400, detail="Invalid state parameter")

            if not callback_data.code_verifier:
                log_oauth_security_event('missing_code_verifier', provider)
                raise HTTPException(status_code=400, detail="code_verifier is required")

            # PKCE verification: recompute the S256 challenge from the verifier
            # and compare it to the challenge bound into the signed state. The
            # client cannot replace the challenge at callback time — only
            # code/state/code_verifier are accepted.
            if not is_valid_code_verifier(callback_data.code_verifier):
                log_oauth_security_event('pkce_mismatch', provider)
                raise HTTPException(status_code=400, detail="Invalid code verifier")
            if compute_pkce_challenge(callback_data.code_verifier) != state_payload.get("code_challenge"):
                log_oauth_security_event('pkce_mismatch', provider)
                raise HTTPException(status_code=400, detail="Invalid code verifier")
        else:
            if callback_data.state and not validate_oauth_state(callback_data.state):
                log_oauth_security_event('invalid_state', provider)
                raise HTTPException(status_code=400, detail="Invalid state parameter")
            
        if not callback_data.code:
            log_oauth_security_event('empty_code', provider)
            raise HTTPException(status_code=400, detail="Authorization code is required")
        
        # Get OAuth client for provider
        oauth_client = oauth_config.get_oauth_client(provider)
        
        # Exchange authorization code for access token
        callback_uri = get_oauth_redirect_uri(provider, client="mobile") if is_mobile_state else get_oauth_redirect_uri(provider)
        logger.info("Using redirect_uri for exchange", extra={"redirect_uri": callback_uri})
        
        try:
            # For SPA flow, we need to manually exchange the code since session state is not available
            # Instead of using authorize_access_token which expects session state, use fetch_token directly
            import httpx
            
            # Get token endpoint URL for Google
            if provider == 'google':
                token_url = 'https://oauth2.googleapis.com/token'
            elif provider == 'apple':
                token_url = 'https://apple.placeholder.com/auth/token'
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
            
            # Prepare token exchange data
            client_id = os.getenv('GOOGLE_CLIENT_ID') if provider == 'google' else os.getenv('APPLE_CLIENT_ID')
            client_secret = os.getenv('GOOGLE_CLIENT_SECRET') if provider == 'google' else os.getenv('APPLE_CLIENT_SECRET')
            
            token_data = {
                'client_id': client_id,
                'client_secret': client_secret,
                'code': callback_data.code,
                'grant_type': 'authorization_code',
                'redirect_uri': callback_uri
            }
            if is_mobile_state:
                token_data['code_verifier'] = callback_data.code_verifier
            
            # Structured diagnostics only — never log code, state, or secret values
            logger.info("OAuth token exchange", extra={
                "provider": provider,
                "token_url": token_url,
                "code_len": len(callback_data.code or ""),
                "redirect_uri": callback_uri,
                "grant_type": "authorization_code",
            })
            
            async with httpx.AsyncClient() as client:
                response = await client.post(token_url, data=token_data, timeout=20.0)
                
                logger.info(f"Response status: {response.status_code}")
                
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
            # If token_ex has .response, attempt to log response status only
            if hasattr(token_ex, "response"):
                try:
                    logger.error("Provider response status: %s", getattr(token_ex.response, "status_code", None))
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
        
        return build_auth_response(
            user=user_data["user"],
            access_token=user_data["access_token"],
            refresh_token=user_data["refresh_token"],
            is_new_user=is_new_user,
            request_id=getattr(request.state, 'request_id', None)
        )
        
    except AuthenticationMethodMismatch as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=409,
            content={
                "type": "auth_method_mismatch",
                "code": e.code,
                "message": e.message,
                "provider": e.provider,
            },
        )
    except ResurrectionRequired as e:
        from app.core.resurrection_response import build_oauth_resurrection_response
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=409,
            content=build_oauth_resurrection_response(
                provider=e.provider,
                provider_user_id=e.provider_user_id,
                tombstone_user_id=e.tombstone_user_id,
                oauth_email=e.oauth_email,
                oauth_user_info=e.oauth_user_info,
            ),
        )
    except AuthenticationError as e:
        log_oauth_security_event('authentication_failed', provider, details={'error': str(e)})
        raise HTTPException(status_code=401, detail=str(e))
    except ValidationException as e:
        log_oauth_security_event('validation_failed', provider, details={'error': str(e)})
        raise HTTPException(status_code=422, detail=str(e))
    except BusinessLogicError as e:
        log_oauth_security_event('business_logic_error', provider, details={'error': str(e)})
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        # Full stack trace in logs (non-secret)
        tb = traceback.format_exc()
        logger.error(f"OAuth callback error: {e.__class__.__name__} - {str(e)}")
        logger.error("Traceback: %s", tb)
        
        # If the exception was from an HTTP exchange with provider, attempt to capture response status only
        if hasattr(e, "response"):
            try:
                logger.error("Provider response status: %s", getattr(e.response, "status_code", None))
            except Exception:
                pass
        
        log_oauth_security_event('callback_error', provider, details={'error': str(e)})
        raise HTTPException(status_code=500, detail="OAuth authentication failed") from e

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
        raise HTTPException(status_code=500, detail="Failed to unlink OAuth account") from e

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
        raise HTTPException(status_code=500, detail="Failed to get OAuth statistics") from e