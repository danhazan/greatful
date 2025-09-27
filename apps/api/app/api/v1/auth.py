"""
Authentication endpoints with security audit logging.
"""

import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.services.auth_service import AuthService
from app.core.responses import success_response
from app.core.security_audit import log_login_success, log_login_failure, SecurityAuditor, SecurityEventType
from app.core.exceptions import AuthenticationError
from app.core.input_sanitization import sanitize_request_data
from app.core.oauth_config import get_oauth_config, get_oauth_redirect_uri, validate_oauth_state, log_oauth_security_event
from app.services.oauth_service import OAuthService
from fastapi.responses import RedirectResponse
from typing import Optional
from pydantic import field_validator, Field
import re

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer()


class UserCreate(BaseModel):
    """User creation request model."""
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    """User login request model."""
    email: EmailStr
    password: str


class Token(BaseModel):
    """Token response model."""
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    """User response model."""
    id: int
    username: str
    email: str


class RefreshTokenRequest(BaseModel):
    """Refresh token request model."""
    refresh_token: str


class OAuthCallbackRequest(BaseModel):
    """OAuth callback request model with validation."""
    code: str = Field(..., min_length=1, max_length=2048, description="Authorization code from OAuth provider")
    state: Optional[str] = Field(None, max_length=1024, description="State parameter for CSRF protection")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        """Validate authorization code format."""
        if not v or not v.strip():
            raise ValueError('Authorization code cannot be empty')
        # Basic validation - OAuth codes are typically alphanumeric with some special chars
        if not re.match(r'^[A-Za-z0-9._~:/?#[\]@!$&\'()*+,;=-]+$', v):
            raise ValueError('Invalid authorization code format')
        return v.strip()
    
    @field_validator('state')
    @classmethod
    def validate_state(cls, v):
        """Validate state parameter format."""
        if v is not None:
            if not re.match(r'^[A-Za-z0-9._~-]+$', v):
                raise ValueError('Invalid state parameter format')
        return v


class OAuthLoginRequest(BaseModel):
    """OAuth login request model with validation."""
    redirect_uri: Optional[str] = Field(None, max_length=2048, description="Custom redirect URI after authentication")
    
    @field_validator('redirect_uri')
    @classmethod
    def validate_redirect_uri(cls, v):
        """Validate redirect URI format."""
        if v is not None:
            if not re.match(r'^https?://[a-zA-Z0-9.-]+(?:\:[0-9]+)?(?:/[^\s]*)?$', v):
                raise ValueError('Invalid redirect URI format')
        return v


class OAuthLoginResponse(BaseModel):
    """OAuth login response model."""
    user: dict
    tokens: dict
    is_new_user: bool


class AccountLinkingEligibilityRequest(BaseModel):
    """Account linking eligibility check request."""
    email: EmailStr = Field(..., description="Email address from OAuth provider")
    provider: str = Field(..., description="OAuth provider name")
    oauth_user_id: str = Field(..., description="OAuth user ID from provider")


class AccountLinkingConfirmationRequest(BaseModel):
    """Account linking confirmation request."""
    user_id: int = Field(..., description="User ID to link OAuth account to")
    provider: str = Field(..., description="OAuth provider name")
    oauth_user_info: dict = Field(..., description="OAuth user information")
    user_consent: bool = Field(..., description="User consent for linking")


class AccountLinkingEligibilityResponse(BaseModel):
    """Account linking eligibility response."""
    eligible: bool
    action: str
    message: str
    user_id: Optional[int] = None
    existing_oauth_provider: Optional[str] = None
    requires_confirmation: Optional[bool] = None
    conflict_type: Optional[str] = None


class AccountLinkingConfirmationResponse(BaseModel):
    """Account linking confirmation response."""
    user_id: int
    existing_account: dict
    oauth_account: dict
    linking_benefits: list
    data_changes: dict
    confirmation_required: bool


@router.post("/signup", status_code=201)
async def signup(
    user: UserCreate, 
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create new user with security audit logging."""
    auth_service = AuthService(db)
    
    # Sanitize input data for storage (but not password)
    user_data = sanitize_request_data(request, user.model_dump())
    
    try:
        result = await auth_service.signup(
            username=user_data.get('username', user.username),
            email=user_data.get('email', user.email),
            password=user.password  # Don't sanitize password
        )
        
        # Log successful registration
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.REGISTRATION,
            request=request,
            user_id=result.get('user', {}).get('id'),
            details={
                "username": user.username,
                "email": user.email,
                "success": True
            },
            severity="INFO"
        )
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        # Log failed registration
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.REGISTRATION,
            request=request,
            details={
                "username": user.username,
                "email": user.email,
                "success": False,
                "error": str(e)
            },
            severity="WARNING"
        )
        raise


@router.post("/login")
async def login(
    user: UserLogin, 
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Login user with security audit logging."""
    auth_service = AuthService(db)
    
    # For login, we don't sanitize email/password as they're used for lookup/verification
    # Sanitization is more important for data storage (signup) than authentication
    try:
        result = await auth_service.login(
            email=user.email,
            password=user.password
        )
        
        # Log successful login
        log_login_success(
            request=request,
            user_id=result.get('user', {}).get('id'),
            username=result.get('user', {}).get('username', user.email)
        )
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except AuthenticationError as e:
        # Log failed login attempt
        log_login_failure(
            request=request,
            username=user.email,
            failure_reason=str(e)
        )
        raise
    except Exception as e:
        # Log unexpected login error
        log_login_failure(
            request=request,
            username=user.email,
            failure_reason=f"Unexpected error: {str(e)}"
        )
        raise


@router.get("/session")
async def get_session(
    request: Request,
    auth: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current user session."""
    auth_service = AuthService(db)
    result = await auth_service.get_user_from_token(auth.credentials)
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.post("/logout")
async def logout(
    request: Request,
    auth: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Logout user with security audit logging."""
    auth_service = AuthService(db)
    
    # Get user info before logout
    try:
        user_info = await auth_service.get_user_from_token(auth.credentials)
        user_id = user_info.get('id')
        username = user_info.get('username')
    except:
        user_id = None
        username = None
    
    result = await auth_service.logout()
    
    # Log logout event
    SecurityAuditor.log_security_event(
        event_type=SecurityEventType.LOGOUT,
        request=request,
        user_id=user_id,
        details={"username": username},
        severity="INFO"
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.post("/refresh")
async def refresh_token(
    refresh_request: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token."""
    auth_service = AuthService(db)
    
    try:
        result = await auth_service.refresh_token(refresh_request.refresh_token)
        
        # Log token refresh
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.TOKEN_REFRESH,
            request=request,
            user_id=result.get('user', {}).get('id'),
            details={"success": True},
            severity="INFO"
        )
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        # Log failed token refresh
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.TOKEN_REFRESH,
            request=request,
            details={
                "success": False,
                "error": str(e)
            },
            severity="WARNING"
        )
        raise


# OAuth Authentication Endpoints

@router.post("/oauth/google")
async def oauth_google_login(
    oauth_request: OAuthLoginRequest,
    request: Request
):
    """
    Initiate Google OAuth login flow.
    
    Args:
        request: FastAPI request object
        redirect_uri: Optional custom redirect URI after authentication
        
    Returns:
        Redirect to Google OAuth authorization URL
    """
    try:
        oauth_config = getattr(request.app.state, 'oauth_config', None)
        oauth_instance = getattr(request.app.state, 'oauth', None)
        
        if not oauth_config or not oauth_instance:
            log_oauth_security_event('oauth_not_configured', 'google')
            raise HTTPException(status_code=503, detail="OAuth service not available")
        
        if not oauth_config.is_provider_available('google'):
            log_oauth_security_event('provider_not_available', 'google')
            raise HTTPException(status_code=400, detail="Google OAuth provider is not available")
        
        # Get OAuth client for Google
        oauth_client = oauth_config.get_oauth_client('google')
        
        # Generate redirect URI
        callback_uri = get_oauth_redirect_uri('google')
        
        # Validate and store custom redirect URI in state if provided
        state_data = {}
        redirect_uri = oauth_request.redirect_uri
        if redirect_uri:
            # Additional security: only allow specific domains in production
            from app.core.oauth_config import ENVIRONMENT
            if ENVIRONMENT == 'production':
                allowed_domains = ['yourdomain.com', 'www.yourdomain.com']  # Configure as needed
                from urllib.parse import urlparse
                parsed_uri = urlparse(redirect_uri)
                if parsed_uri.hostname not in allowed_domains:
                    log_oauth_security_event('unauthorized_redirect_uri', 'google', details={'redirect_uri': redirect_uri})
                    raise HTTPException(status_code=400, detail="Unauthorized redirect URI")
            
            state_data['redirect_uri'] = redirect_uri
        
        # Generate authorization URL with PKCE
        authorization_url, state = oauth_client.create_authorization_url(
            callback_uri,
            state=state_data
        )
        
        # Add security monitoring for OAuth initiation
        SecurityAuditor.log_oauth_event(
            event_type=SecurityEventType.OAUTH_LOGIN_INITIATED,
            provider='google',
            request=request,
            details={
                'callback_uri': callback_uri,
                'has_custom_redirect': bool(redirect_uri),
                'user_agent': request.headers.get('user-agent', ''),
                'referer': request.headers.get('referer', '')
            }
        )
        
        log_oauth_security_event('login_initiated', 'google')
        logger.info("Google OAuth login initiated")
        
        return RedirectResponse(url=authorization_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating Google OAuth login: {e}")
        log_oauth_security_event('login_error', 'google', details={'error': str(e)})
        raise HTTPException(status_code=500, detail="Failed to initiate Google OAuth login")


@router.post("/oauth/facebook")
async def oauth_facebook_login(
    oauth_request: OAuthLoginRequest,
    request: Request
):
    """
    Initiate Facebook OAuth login flow.
    
    Args:
        request: FastAPI request object
        redirect_uri: Optional custom redirect URI after authentication
        
    Returns:
        Redirect to Facebook OAuth authorization URL
    """
    try:
        oauth_config = getattr(request.app.state, 'oauth_config', None)
        oauth_instance = getattr(request.app.state, 'oauth', None)
        
        if not oauth_config or not oauth_instance:
            log_oauth_security_event('oauth_not_configured', 'facebook')
            raise HTTPException(status_code=503, detail="OAuth service not available")
        
        if not oauth_config.is_provider_available('facebook'):
            log_oauth_security_event('provider_not_available', 'facebook')
            raise HTTPException(status_code=400, detail="Facebook OAuth provider is not available")
        
        # Get OAuth client for Facebook
        oauth_client = oauth_config.get_oauth_client('facebook')
        
        # Generate redirect URI
        callback_uri = get_oauth_redirect_uri('facebook')
        
        # Validate and store custom redirect URI in state if provided
        state_data = {}
        redirect_uri = oauth_request.redirect_uri
        if redirect_uri:
            # Additional security: only allow specific domains in production
            from app.core.oauth_config import ENVIRONMENT
            if ENVIRONMENT == 'production':
                allowed_domains = ['yourdomain.com', 'www.yourdomain.com']  # Configure as needed
                from urllib.parse import urlparse
                parsed_uri = urlparse(redirect_uri)
                if parsed_uri.hostname not in allowed_domains:
                    log_oauth_security_event('unauthorized_redirect_uri', 'facebook', details={'redirect_uri': redirect_uri})
                    raise HTTPException(status_code=400, detail="Unauthorized redirect URI")
            
            state_data['redirect_uri'] = redirect_uri
        
        # Generate authorization URL with PKCE
        authorization_url, state = oauth_client.create_authorization_url(
            callback_uri,
            state=state_data
        )
        
        # Add security monitoring for OAuth initiation
        SecurityAuditor.log_oauth_event(
            event_type=SecurityEventType.OAUTH_LOGIN_INITIATED,
            provider='facebook',
            request=request,
            details={
                'callback_uri': callback_uri,
                'has_custom_redirect': bool(redirect_uri),
                'user_agent': request.headers.get('user-agent', ''),
                'referer': request.headers.get('referer', '')
            }
        )
        
        log_oauth_security_event('login_initiated', 'facebook')
        logger.info("Facebook OAuth login initiated")
        
        return RedirectResponse(url=authorization_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating Facebook OAuth login: {e}")
        log_oauth_security_event('login_error', 'facebook', details={'error': str(e)})
        raise HTTPException(status_code=500, detail="Failed to initiate Facebook OAuth login")


@router.get("/oauth/callback", response_model=OAuthLoginResponse)
async def oauth_callback(
    request: Request,
    code: str,
    state: Optional[str] = None,
    provider: str = "google",
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OAuth callback and authenticate user.
    
    Args:
        request: FastAPI request object
        code: Authorization code from OAuth provider
        state: State parameter for CSRF protection
        provider: OAuth provider name ('google' or 'facebook')
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
        if state and not validate_oauth_state(state):
            log_oauth_security_event('invalid_state', provider, details={'state': state})
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Get OAuth client for provider
        oauth_client = oauth_config.get_oauth_client(provider)
        
        # Exchange authorization code for access token
        callback_uri = get_oauth_redirect_uri(provider)
        token = await oauth_client.authorize_access_token(
            request,
            code=code,
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
            state,
            request
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
    except Exception as e:
        logger.error(f"Error in OAuth callback for {provider}: {e}")
        log_oauth_security_event('callback_error', provider, details={'error': str(e)})
        raise HTTPException(status_code=500, detail="OAuth authentication failed")


@router.post("/oauth/check-linking-eligibility", response_model=AccountLinkingEligibilityResponse)
async def check_oauth_linking_eligibility(
    eligibility_request: AccountLinkingEligibilityRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Check if an OAuth account can be linked to an existing account.
    
    Args:
        eligibility_request: Account linking eligibility check request
        request: FastAPI request object
        db: Database session
        
    Returns:
        Account linking eligibility information
    """
    try:
        oauth_service = OAuthService(db)
        
        # Log eligibility check for security monitoring
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.OAUTH_LOGIN_INITIATED,
            request=request,
            details={
                'provider': eligibility_request.provider,
                'email': eligibility_request.email,
                'oauth_user_id': eligibility_request.oauth_user_id,
                'action': 'eligibility_check'
            },
            severity="INFO"
        )
        
        result = await oauth_service.check_account_linking_eligibility(
            email=eligibility_request.email,
            provider=eligibility_request.provider,
            oauth_user_id=eligibility_request.oauth_user_id
        )
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        logger.error(f"Error checking OAuth linking eligibility: {e}")
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
            request=request,
            details={
                'provider': eligibility_request.provider,
                'error': 'eligibility_check_failed',
                'error_message': str(e)
            },
            severity="ERROR",
            success=False
        )
        raise HTTPException(status_code=500, detail="Failed to check account linking eligibility")


@router.post("/oauth/prepare-linking-confirmation", response_model=AccountLinkingConfirmationResponse)
async def prepare_oauth_linking_confirmation(
    user_id: int,
    provider: str,
    oauth_user_info: dict,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Prepare account linking confirmation data for UI.
    
    Args:
        user_id: User ID to link OAuth account to
        provider: OAuth provider name
        oauth_user_info: OAuth user information
        request: FastAPI request object
        db: Database session
        
    Returns:
        Account linking confirmation data
    """
    try:
        oauth_service = OAuthService(db)
        
        # Log confirmation preparation for security monitoring
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.OAUTH_LOGIN_INITIATED,
            request=request,
            user_id=user_id,
            details={
                'provider': provider,
                'oauth_user_id': oauth_user_info.get('id', 'unknown'),
                'action': 'prepare_confirmation'
            },
            severity="INFO"
        )
        
        result = await oauth_service.prepare_account_linking_confirmation(
            user_id=user_id,
            provider=provider,
            oauth_user_info=oauth_user_info
        )
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error preparing OAuth linking confirmation: {e}")
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
            request=request,
            user_id=user_id,
            details={
                'provider': provider,
                'error': 'confirmation_preparation_failed',
                'error_message': str(e)
            },
            severity="ERROR",
            success=False
        )
        raise HTTPException(status_code=500, detail="Failed to prepare account linking confirmation")


@router.post("/oauth/confirm-linking")
async def confirm_oauth_account_linking(
    confirmation_request: AccountLinkingConfirmationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Confirm and execute OAuth account linking with user consent.
    
    Args:
        confirmation_request: Account linking confirmation request
        request: FastAPI request object
        db: Database session
        
    Returns:
        Account linking result
    """
    try:
        oauth_service = OAuthService(db)
        
        # Log linking confirmation attempt
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.OAUTH_ACCOUNT_LINKED,
            request=request,
            user_id=confirmation_request.user_id,
            details={
                'provider': confirmation_request.provider,
                'oauth_user_id': confirmation_request.oauth_user_info.get('id', 'unknown'),
                'user_consent': confirmation_request.user_consent,
                'action': 'confirm_linking'
            },
            severity="INFO"
        )
        
        result = await oauth_service.confirm_account_linking(
            user_id=confirmation_request.user_id,
            provider=confirmation_request.provider,
            oauth_user_info=confirmation_request.oauth_user_info,
            user_consent=confirmation_request.user_consent,
            request=request
        )
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except ValidationException as e:
        raise HTTPException(status_code=422, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"Error confirming OAuth account linking: {e}")
        SecurityAuditor.log_security_event(
            event_type=SecurityEventType.OAUTH_LOGIN_FAILURE,
            request=request,
            user_id=confirmation_request.user_id,
            details={
                'provider': confirmation_request.provider,
                'error': 'linking_confirmation_failed',
                'error_message': str(e)
            },
            severity="ERROR",
            success=False
        )
        raise HTTPException(status_code=500, detail="Failed to confirm account linking")


@router.get("/oauth/security-audit")
async def get_oauth_security_audit(
    request: Request,
    hours: int = 24,
    auth: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Get OAuth security audit information (admin only).
    
    Args:
        hours: Number of hours to look back for events
        request: FastAPI request object
        auth: Authorization credentials
        db: Database session
        
    Returns:
        OAuth security audit data
    """
    try:
        # This would typically require admin authentication
        # For now, just return the audit data structure
        
        oauth_service = OAuthService(db)
        result = await oauth_service.audit_oauth_security_events(hours=hours)
        
        return success_response(result, getattr(request.state, 'request_id', None))
        
    except Exception as e:
        logger.error(f"Error getting OAuth security audit: {e}")
        raise HTTPException(status_code=500, detail="Failed to get OAuth security audit data")