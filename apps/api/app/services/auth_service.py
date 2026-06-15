"""
Authentication service with standardized patterns.
"""

import logging
from typing import Dict, Optional
from datetime import datetime as dt, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.service_base import BaseService
from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    ResurrectionRequired,
    ValidationException,
)
from app.models.user import User
from app.models.token import PasswordResetToken
import secrets
from app.core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password

logger = logging.getLogger(__name__)


class AuthService(BaseService):
    """Service for authentication operations."""

    def _ensure_active_user(self, user: User) -> None:
        status = getattr(user, "account_status", None)
        if isinstance(status, str) and status != "active":
            raise AuthenticationError("User account is inactive")

    def _token_data_for_user(self, user: User) -> Dict[str, any]:
        return {
            "sub": str(user.id),
            "username": user.username,
            "token_version": getattr(user, "token_version", 0) or 0,
        }

    async def signup(
        self,
        username: str,
        email: str,
        password: str,
        resurrect_action: Optional[str] = None,
    ) -> Dict[str, any]:
        """
        Create a new user account with identity-driven resurrection.

        Two-phase resurrection flow:
          1. If a tombstone exists for the email and no resurrect_action
             is provided → raises ConflictError with resurrection_available
             detail so the frontend can prompt the user.
          2. Frontend resubmits the same request with
             resurrect_action="accept" or "decline".

        Args:
            username: User's username
            email: User's email address
            password: User's password
            resurrect_action: Optional ("accept" | "decline")

        Returns:
            Dict containing user data and access token

        Raises:
            ValidationException: If input validation fails
            ConflictError: If email/username conflict or resurrection needed
        """
        self.validate_required_fields(
            {"username": username, "email": email, "password": password},
            ["username", "email", "password"]
        )

        self.validate_field_length(username, "username", 50, 3)
        self.validate_field_length(password, "password", 128, 8)

        # --- Phase 1: Tombstone identity resolution ---
        from app.core.resurrection import find_tombstone_by_email, resurrect_password_user, check_username_available

        tombstone = await find_tombstone_by_email(self.db, email)

        if tombstone:
            if resurrect_action == "accept":
                user = await resurrect_password_user(
                    self.db, tombstone, email, username, password
                )
                await self.db.commit()
                await self.db.refresh(user)
                token_data = self._token_data_for_user(user)
                return {
                    "user": {"id": user.id, "email": user.email, "username": user.username},
                    "access_token": create_access_token(token_data),
                    "refresh_token": create_refresh_token(token_data),
                    "token_type": "bearer",
                }

            if resurrect_action == "decline":
                from app.core.resurrection import consume_tombstones
                await consume_tombstones(self.db, tombstone.user_id)
                pass  # fall through to new user creation below

            if resurrect_action is None:
                raise ResurrectionRequired(
                    identity_type="email",
                    message=(
                        "An account with this email was previously deleted. "
                        "You can resurrect it or create a new account."
                    ),
                )

        # --- Phase 2: New user creation ---
        existing_user = await User.get_by_email(self.db, email)
        if existing_user:
            raise ConflictError("Email already registered", "user")

        if not await check_username_available(self.db, username):
            raise ConflictError("Username already taken", "user")

        hashed_password = get_password_hash(password)
        user = await self.create_entity(
            User,
            email=email,
            username=username,
            hashed_password=hashed_password,
        )

        token_data = self._token_data_for_user(user)
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        logger.info(f"User signed up successfully: {user.email}")

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
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
        self._ensure_active_user(user)
        
        # Create access and refresh tokens
        token_data = self._token_data_for_user(user)
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
            self._ensure_active_user(user)
            payload_version = payload.get("token_version", payload.get("tv"))
            if payload_version is not None and int(payload_version) != int(user.token_version or 0):
                raise AuthenticationError("Authentication token has been invalidated")
            
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
            self._ensure_active_user(user)
            payload_version = payload.get("token_version", payload.get("tv"))
            if payload_version is not None and int(payload_version) != int(user.token_version or 0):
                raise AuthenticationError("Refresh token has been invalidated")
            
            # Create new access and refresh tokens
            token_data = self._token_data_for_user(user)
            new_access_token = create_access_token(token_data)
            new_refresh_token = create_refresh_token(token_data)
            
            logger.info(f"Token refreshed with rotation for user: {user.email}")
            
            return {
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username
                },
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
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

        self._ensure_active_user(user)

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

        if not reset_token or reset_token.is_used or reset_token.expires_at < dt.now().replace(tzinfo=None):
            raise AuthenticationError("Invalid or expired password reset token")

        # Get the user associated with the token
        user = await self.get_by_id(User, reset_token.user_id)
        if not user:
            raise AuthenticationError("User not found")
        self._ensure_active_user(user)

        # Update the password
        from app.services.user_service import UserService
        user_service = UserService(self.db)
        await user_service.update_password(user, new_password)

        # Invalidate the token
        reset_token.is_used = True
        await self.db.commit()

        logger.info(f"Password has been reset for user: {user.email}")
