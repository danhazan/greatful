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
            reason=f"Unexpected error: {str(e)}"
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