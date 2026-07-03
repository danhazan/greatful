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
        json={"login": "oauth_login_test@example.com", "password": "anything"},
    )

    assert response.status_code == 401
    data = response.json()

    assert data.get("success") is False
    error_obj = data.get("error", {})
    error_message = error_obj.get("message", "")
    assert "google" in error_message.lower(), f"Expected provider hint, got: {error_message}"
    assert "continue with" in error_message.lower(), f"Expected actionable hint, got: {error_message}"


async def test_login_password_user_succeeds_with_email(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Password-only user can log in with email."""
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
        json={"login": "normal_login@example.com", "password": "correct_password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    payload = data.get("data", {})
    assert "access_token" in payload
    assert "refresh_token" in payload
    assert payload["user"]["email"] == "normal_login@example.com"


async def test_login_password_user_succeeds_with_username(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Password-only user can log in with username."""
    user = User(
        email="username_login@example.com",
        username="someuser",
        hashed_password=get_password_hash("correct_password"),
        display_name="Username Login",
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"login": "someuser", "password": "correct_password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    payload = data.get("data", {})
    assert payload["user"]["username"] == "someuser"


async def test_login_email_case_insensitive(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Email login is case-insensitive."""
    user = User(
        email="casemixin@example.com",
        username="casemixin",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"login": "CaseMixin@Example.COM", "password": "password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True


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
        json={"login": "linked_login@example.com", "password": "password_for_linked"},
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
        json={"login": "bare_oauth_login@example.com", "password": "anything"},
    )

    assert response.status_code == 401
    data = response.json()
    error_obj = data.get("error", {})
    error_message = error_obj.get("message", "")
    assert "social" in error_message.lower() or "authentic" in error_message.lower(), \
        f"Expected social fallback, got: {error_message}"


async def test_login_nonexistent_email_returns_401(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Non-existent email returns 401."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"login": "nobody@example.com", "password": "anything"},
    )

    assert response.status_code == 401
    data = response.json()
    error_obj = data.get("error", {})
    error_message = error_obj.get("message", "")
    assert "email/username" in error_message.lower() or "incorrect" in error_message.lower()


async def test_login_nonexistent_username_returns_401(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Non-existent username returns 401."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"login": "nonexistent_user", "password": "anything"},
    )

    assert response.status_code == 401
    data = response.json()
    error_obj = data.get("error", {})
    error_message = error_obj.get("message", "")
    assert "email/username" in error_message.lower() or "incorrect" in error_message.lower()


async def test_full_signup_then_login_flow(
    async_client: AsyncClient,
):
    """Reproduce reported bug: signup then login with email."""
    # Sign up via API (goes through sanitization)
    signup_resp = await async_client.post("/api/v1/auth/signup", json={
        "username": "flowtestuser",
        "email": "FlowTest@Example.COM",
        "password": "StrongPass1!",
    })
    assert signup_resp.status_code in (200, 201), f"Signup failed: {signup_resp.text}"

    # Login with exact case email
    login_resp = await async_client.post("/api/v1/auth/login", json={
        "login": "FlowTest@Example.COM",
        "password": "StrongPass1!",
    })
    assert login_resp.status_code == 200, f"Login (exact case) failed: {login_resp.text}"
    data = login_resp.json()
    assert data.get("success") is True

    # Login with different case email
    login2_resp = await async_client.post("/api/v1/auth/login", json={
        "login": "flowtest@example.com",
        "password": "StrongPass1!",
    })
    assert login2_resp.status_code == 200, f"Login (lowercase) failed: {login2_resp.text}"

    # Login with username
    login3_resp = await async_client.post("/api/v1/auth/login", json={
        "login": "flowtestuser",
        "password": "StrongPass1!",
    })
    assert login3_resp.status_code == 200, f"Login (username) failed: {login3_resp.text}"


async def test_login_whitespace_padded_username(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Leading/trailing whitespace in login is handled."""
    user = User(
        email="whitespace_login@example.com",
        username="whitespace_user",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"login": "  whitespace_user  ", "password": "password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True


async def test_login_username_case_insensitive(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Username login is case-insensitive (usernames stored lowercase at signup)."""
    user = User(
        email="caseusername@example.com",
        username="john_doe",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"login": "John_Doe", "password": "password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True


async def test_login_whitespace_padded_email(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Leading/trailing whitespace in email login is handled."""
    user = User(
        email="pad_email@example.com",
        username="pad_email",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(user)
    await db_session.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"login": "  pad_email@example.com  ", "password": "password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
