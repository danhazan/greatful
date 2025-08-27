"""
Authentication service with standardized patterns.
"""

import logging
from typing import Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    ValidationException
)
from app.models.user import User
from app.core.security import create_access_token, get_password_hash, verify_password

logger = logging.getLogger(__name__)


class AuthService(BaseService):
    """Service for authentication operations."""

    async def signup(
        self,
        username: str,
        email: str,
        password: str
    ) -> Dict[str, any]:
        """
        Create a new user account.
        
        Args:
            username: User's username
            email: User's email address
            password: User's password
            
        Returns:
            Dict containing user data and access token
            
        Raises:
            ValidationException: If input validation fails
            ConflictError: If email or username already exists
        """
        # Validate input
        self.validate_required_fields(
            {"username": username, "email": email, "password": password},
            ["username", "email", "password"]
        )
        
        self.validate_field_length(username, "username", 50, 3)
        self.validate_field_length(password, "password", 128, 8)
        
        # Check if email already exists
        existing_user = await User.get_by_email(self.db, email)
        if existing_user:
            raise ConflictError("Email already registered", "user")
        
        # Check if username already exists
        existing_username = await User.get_by_username(self.db, username)
        if existing_username:
            raise ConflictError("Username already taken", "user")
        
        # Create new user
        hashed_password = get_password_hash(password)
        user = await self.create_entity(
            User,
            email=email,
            username=username,
            hashed_password=hashed_password
        )
        
        # Create access token
        token_data = {"sub": str(user.id)}
        access_token = create_access_token(token_data)
        
        logger.info(f"User signed up successfully: {user.email}")
        
        return {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "access_token": access_token,
            "token_type": "bearer"
        }

    async def login(self, email: str, password: str) -> Dict[str, str]:
        """
        Authenticate user and return access token.
        
        Args:
            email: User's email address
            password: User's password
            
        Returns:
            Dict containing access token
            
        Raises:
            ValidationException: If input validation fails
            AuthenticationError: If credentials are invalid
        """
        # Validate input
        self.validate_required_fields(
            {"email": email, "password": password},
            ["email", "password"]
        )
        
        # Get user by email
        user = await User.get_by_email(self.db, email)
        if not user or not verify_password(password, user.hashed_password):
            raise AuthenticationError("Incorrect email or password")
        
        # Create access token
        token_data = {"sub": str(user.id)}
        access_token = create_access_token(token_data)
        
        logger.info(f"User logged in successfully: {user.email}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }

    async def get_user_from_token(self, token: str) -> Dict[str, any]:
        """
        Get user information from access token.
        
        Args:
            token: JWT access token
            
        Returns:
            Dict containing user information
            
        Raises:
            AuthenticationError: If token is invalid or user not found
        """
        try:
            from app.core.security import decode_token
            
            # Decode token
            payload = decode_token(token)
            user_id = int(payload.get("sub"))
            
            # Get user from database
            user = await self.get_by_id(User, user_id)
            if not user:
                raise AuthenticationError("User not found")
            
            return {
                "id": user.id,
                "email": user.email,
                "username": user.username
            }
            
        except Exception as e:
            logger.error(f"Token validation error: {e}")
            raise AuthenticationError("Invalid token")

    async def logout(self) -> Dict[str, str]:
        """
        Logout user (placeholder for future token blacklisting).
        
        Returns:
            Dict with success message
        """
        # In a real implementation, you might want to blacklist the token
        # For now, we just return a success message
        return {"message": "Successfully logged out"}