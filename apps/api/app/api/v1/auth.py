"""
Authentication endpoints.
"""

import logging
from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.services.auth_service import AuthService
from app.core.responses import success_response

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


@router.post("/signup", status_code=201)
async def signup(
    user: UserCreate, 
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create new user."""
    auth_service = AuthService(db)
    result = await auth_service.signup(
        username=user.username,
        email=user.email,
        password=user.password
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))


@router.post("/login")
async def login(
    user: UserLogin, 
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Login user."""
    auth_service = AuthService(db)
    result = await auth_service.login(
        email=user.email,
        password=user.password
    )
    
    return success_response(result, getattr(request.state, 'request_id', None))


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
    db: AsyncSession = Depends(get_db)
):
    """Logout user."""
    auth_service = AuthService(db)
    result = await auth_service.logout()
    
    return success_response(result, getattr(request.state, 'request_id', None))