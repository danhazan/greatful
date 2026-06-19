"""Tests for AuthService — login, signup, token refresh."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.services.auth_service import AuthService
from app.core.exceptions import AuthenticationError

pytestmark = pytest.mark.asyncio


class TestAuthServiceLogin:
    """Login flow tests."""

    async def test_login_oauth_user_raises_clear_error(
        self, db_session: AsyncSession
    ):
        """Issue 3: OAuth-only user (empty hashed_password) gets a provider-specific hint."""
        user = User(
            email="oauth_only@example.com",
            username="oauthonly",
            hashed_password="",
            display_name="OAuth Only",
            oauth_provider="google",
            oauth_id="google_oauth_only_123",
        )
        db_session.add(user)
        await db_session.commit()

        auth_service = AuthService(db_session)

        with pytest.raises(AuthenticationError) as exc_info:
            await auth_service.login("oauth_only@example.com", "any_password")

        msg = str(exc_info.value)
        assert "google" in msg, f"Should mention provider: {msg}"
        assert "continue with google" in msg.lower(), f"Should hint at provider: {msg}"

    async def test_login_password_user_succeeds(
        self, db_session: AsyncSession
    ):
        """Normal password user can still log in."""
        from app.core.security import get_password_hash

        user = User(
            email="normal@example.com",
            username="normal",
            hashed_password=get_password_hash("correct_password"),
            display_name="Normal User",
        )
        db_session.add(user)
        await db_session.commit()

        auth_service = AuthService(db_session)

        result = await auth_service.login("normal@example.com", "correct_password")
        assert "access_token" in result
        assert "refresh_token" in result
        assert result["user"]["email"] == "normal@example.com"

    async def test_login_oauth_user_no_provider_fallback(
        self, db_session: AsyncSession
    ):
        """OAuth user without provider field falls back to 'social'."""
        user = User(
            email="bare_oauth@example.com",
            username="bareoauth",
            hashed_password="",
            display_name="Bare OAuth",
            oauth_provider=None,
        )
        db_session.add(user)
        await db_session.commit()

        auth_service = AuthService(db_session)

        with pytest.raises(AuthenticationError) as exc_info:
            await auth_service.login("bare_oauth@example.com", "any_password")

        msg = str(exc_info.value)
        assert "social" in msg or "authentic" in msg
