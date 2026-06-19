"""Integration tests for login — verifies response shapes for all account types."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import get_password_hash

pytestmark = pytest.mark.asyncio


async def test_login_oauth_user_returns_provider_hint(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Issue 2: Password login against OAuth-only user returns provider-specific hint.

    Backend returns: 401 with { success: false, error: { message: "This account
    uses google authentication. Please continue with google." } }
    """
    user = User(
        email="oauth_login_test@example.com",
        username="oauth_logintest",
        hashed_password="",
        display_name="OAuth Login Test",
        oauth_provider="google",
        oauth_id="google_oauth_login_test",
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "oauth_login_test@example.com", "password": "anything"},
    )

    assert response.status_code == 401
    data = response.json()

    # Expected shape: { success: false, error: { code, message, details } }
    assert data.get("success") is False
    error_obj = data.get("error", {})
    error_message = error_obj.get("message", "")
    assert "google" in error_message.lower(), f"Expected provider hint, got: {error_message}"
    assert "continue with" in error_message.lower(), f"Expected actionable hint, got: {error_message}"


async def test_login_password_user_succeeds(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Password-only user can still log in successfully."""
    user = User(
        email="normal_login@example.com",
        username="normal_login",
        hashed_password=get_password_hash("correct_password"),
        display_name="Normal Login",
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "normal_login@example.com", "password": "correct_password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    payload = data.get("data", {})
    assert "access_token" in payload
    assert "refresh_token" in payload
    assert payload["user"]["email"] == "normal_login@example.com"


async def test_login_linked_account_allows_password(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Password + OAuth linked account MUST still allow password login.

    The check is: has_password (bool(hashed_password)), not oauth_provider.
    """
    user = User(
        email="linked_login@example.com",
        username="linked_login",
        hashed_password=get_password_hash("password_for_linked"),
        display_name="Linked Login",
        oauth_provider="google",
        oauth_id="google_linked_account",
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "linked_login@example.com", "password": "password_for_linked"},
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert data.get("success") is True


async def test_login_oauth_user_no_provider_fallback(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """OAuth user without provider field falls back to 'social' in message."""
    user = User(
        email="bare_oauth_login@example.com",
        username="bare_oauth_login",
        hashed_password="",
        display_name="Bare OAuth Login",
        oauth_provider=None,
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "bare_oauth_login@example.com", "password": "anything"},
    )

    assert response.status_code == 401
    data = response.json()
    error_obj = data.get("error", {})
    error_message = error_obj.get("message", "")
    assert "social" in error_message.lower() or "authentic" in error_message.lower(), \
        f"Expected social fallback, got: {error_message}"
