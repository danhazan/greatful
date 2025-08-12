"""
Authentication endpoints.
"""

import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.models.user import User
from app.core.security import create_access_token, get_password_hash, verify_password, decode_token

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


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create new user."""
    try:
        # Check if user exists
        existing_user = await User.get_by_email(db, user.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        
        # Check if username exists
        existing_username = await User.get_by_username(db, user.username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken"
            )
        
        # Create new user
        hashed_password = get_password_hash(user.password)
        db_user = User(
            email=user.email,
            username=user.username,
            hashed_password=hashed_password
        )
        
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        
        # Create access token
        token_data = {"sub": str(db_user.id)}
        access_token = create_access_token(token_data)
        
        return {
            "id": db_user.id,
            "email": db_user.email,
            "username": db_user.username,
            "access_token": access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


@router.post("/login", response_model=Token)
async def login(user: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login user."""
    try:
        db_user = await User.get_by_email(db, user.email)
        if not db_user or not verify_password(user.password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Create access token
        token_data = {"sub": str(db_user.id)}
        access_token = create_access_token(token_data)
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.get("/session")
async def get_session(
    auth: HTTPAuthorizationCredentials = Depends(security), 
    db: AsyncSession = Depends(get_db)
):
    """Get current user session."""
    try:
        logger.info(f"Received token: {auth.credentials[:20]}...")
        
        # Decode token
        payload = decode_token(auth.credentials)
        logger.info(f"Token payload: {payload}")
        
        # Get user from database
        user_id = int(payload.get("sub"))
        db_user = await User.get_by_id(db, user_id)
        logger.info(f"Found user: {db_user.email if db_user else 'None'}")
        
        if not db_user:
            logger.error("User not found in database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return {
            "id": db_user.id,
            "email": db_user.email,
            "username": db_user.username
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


@router.post("/logout")
async def logout():
    """Logout user."""
    return {"message": "Successfully logged out"}