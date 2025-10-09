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
from app.models.token import PasswordResetToken
import secrets
from app.core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password

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
        
        # Create access and refresh tokens
        token_data = {"sub": str(user.id), "username": user.username}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        logger.info(f"User signed up successfully: {user.email}")
        
        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
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
        
        # Create access and refresh tokens
        token_data = {"sub": str(user.id), "username": user.username}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        logger.info(f"User logged in successfully: {user.email}")
        
        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
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
            # Decode token
            payload = decode_token(token, token_type="access")
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

    async def refresh_token(self, refresh_token: str) -> Dict[str, any]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: JWT refresh token
            
        Returns:
            Dict containing new access token and user info
            
        Raises:
            AuthenticationError: If refresh token is invalid
        """
        try:
            # Decode refresh token
            payload = decode_token(refresh_token, token_type="refresh")
            user_id = int(payload.get("sub"))
            
            # Get user from database
            user = await self.get_by_id(User, user_id)
            if not user:
                raise AuthenticationError("User not found")
            
            # Create new access token
            token_data = {"sub": str(user.id), "username": user.username}
            new_access_token = create_access_token(token_data)
            
            logger.info(f"Token refreshed for user: {user.email}")
            
            return {
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username
                },
                "access_token": new_access_token,
                "token_type": "bearer"
            }
            
        except Exception as e:
            logger.error(f"Refresh token validation error: {e}")
            raise AuthenticationError("Invalid refresh token")

    async def logout(self) -> Dict[str, str]:
        """
        Logout user (placeholder for future token blacklisting).
        
        Returns:
            Dict with success message
        """
        # In a real implementation, you might want to blacklist the token
        # For now, we just return a success message
        return {"message": "Successfully logged out"}

    async def generate_password_reset_token(self, email: str) -> Optional[str]:
        """
        Generate a password reset token for a user.

        Args:
            email: The user's email address.

        Returns:
            The generated token, or None if the user is an OAuth user.
        """
        user = await User.get_by_email(self.db, email)
        if not user:
            # To prevent email enumeration attacks, we don't reveal that the user doesn't exist.
            logger.warning(f"Password reset requested for non-existent email: {email}")
            return None

        if user.oauth_provider:
            # Users who signed up with OAuth cannot reset passwords.
            logger.warning(f"Password reset requested for OAuth user: {email}")
            # Here you might trigger an informational email.
            return None

        # Generate a secure token
        token = secrets.token_urlsafe(32)

        # Store the token in the database
        reset_token = PasswordResetToken(user_id=user.id, token=token)
        self.db.add(reset_token)
        await self.db.commit()

        logger.info(f"Generated password reset token for user: {email}")
        return token

    async def reset_password_with_token(self, token: str, new_password: str) -> None:
        """
        Reset a user's password using a valid reset token.

        Args:
            token: The password reset token.
            new_password: The new password.

        Raises:
            AuthenticationError: If the token is invalid, expired, or already used.
        """
        from sqlalchemy.future import select
        import datetime

        # Find the token in the database
        query = select(PasswordResetToken).where(PasswordResetToken.token == token)
        result = await self.db.execute(query)
        reset_token = result.scalar_one_or_none()

        if not reset_token or reset_token.is_used or reset_token.expires_at < datetime.datetime.utcnow():
            raise AuthenticationError("Invalid or expired password reset token")

        # Get the user associated with the token
        user = await self.get_by_id(User, reset_token.user_id)
        if not user:
            raise AuthenticationError("User not found")

        # Update the password
        from app.services.user_service import UserService
        user_service = UserService(self.db)
        await user_service.update_password(user, new_password)

        # Invalidate the token
        reset_token.is_used = True
        await self.db.commit()

        logger.info(f"Password has been reset for user: {user.email}")