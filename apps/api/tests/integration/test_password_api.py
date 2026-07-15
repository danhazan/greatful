#!/usr/bin/env python3
"""
Integration tests for password management API endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.token import PasswordResetToken
from app.core.security import get_password_hash

# Mark all tests in this file as async
pytestmark = pytest.mark.asyncio

GENERIC_SUCCESS_MSG = (
    "If an account with that email exists and is eligible for "
    "password reset, a password reset link has been sent."
)

@pytest.fixture
async def password_user_in_db(db_session: AsyncSession) -> User:
    """Fixture for a standard user that exists in the database."""
    user = User(
        email="password.user@example.com",
        username="password_user",
        hashed_password=get_password_hash("current_password"),
        oauth_provider=None
    )
    db_session.add(user)
    await db_session.commit()
    return user

@pytest.fixture
async def oauth_user_in_db(db_session: AsyncSession) -> User:
    """Fixture for an OAuth user that exists in the database."""
    user = User(
        email="oauth.user@example.com",
        username="oauth_user",
        hashed_password="",
        oauth_provider="google"
    )
    db_session.add(user)
    await db_session.commit()
    return user

@pytest.fixture
def auth_headers_for(client: AsyncClient):
    """Factory fixture to create auth headers for a specific user."""
    async def _auth_headers_for(user_email: str, password: str = "password"):
        login_data = {"login": user_email, "password": password}
        res = client.post("/api/v1/auth/login", json=login_data)
        res.raise_for_status()
        token = res.json()["data"]["access_token"]
        return {"Authorization": f"Bearer {token}"}
    return _auth_headers_for


async def test_change_password_success_for_password_user(client: AsyncClient, password_user_in_db: User, auth_headers_for):
    """Verify a standard user can change their password."""
    headers = await auth_headers_for(password_user_in_db.email, "current_password")
    payload = {"current_password": "current_password", "new_password": "new_secure_password"}

    response = client.put("/api/v1/users/me/password", json=payload, headers=headers)

    assert response.status_code == 200
    assert response.json()["data"]["message"] == "Password updated successfully"

    # Verify the password was actually changed by logging in with the new one
    new_headers = await auth_headers_for(password_user_in_db.email, "new_secure_password")
    assert "Authorization" in new_headers

async def test_change_password_fails_with_wrong_current_password(client: AsyncClient, password_user_in_db: User, auth_headers_for):
    """Ensure incorrect password is rejected."""
    headers = await auth_headers_for(password_user_in_db.email, "current_password")
    payload = {"current_password": "wrong_password", "new_password": "new_secure_password"}

    response = client.put("/api/v1/users/me/password", json=payload, headers=headers)

    assert response.status_code == 401
    assert "Incorrect current password" in response.json()["detail"]

async def test_change_password_forbidden_for_oauth_user(client: AsyncClient, oauth_user_in_db: User, auth_headers_for):
    """Enforce the rule that OAuth users cannot use this endpoint."""
    from app.core.security import create_access_token
    token = create_access_token({"sub": str(oauth_user_in_db.id)})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"current_password": "", "new_password": "any_password"}

    response = client.put("/api/v1/users/me/password", json=payload, headers=headers)

    assert response.status_code == 403
    assert "Users with a linked social account cannot change a password" in response.json()["detail"]

async def test_forgot_password_password_user_returns_generic_response(client: AsyncClient, password_user_in_db: User, db_session: AsyncSession):
    """Registered password user: 200, generic message, no reset_token, token stored internally."""
    payload = {"email": password_user_in_db.email}

    response = client.post("/api/v1/auth/forgot-password", json=payload)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["message"] == GENERIC_SUCCESS_MSG
    assert "reset_token" not in data

    # Verify token was created in the DB (internal behavior unchanged)
    result = await db_session.execute(select(PasswordResetToken))
    tokens = result.scalars().all()
    assert len(tokens) == 1
    assert tokens[0].user_id == password_user_in_db.id

async def test_forgot_password_unknown_email_returns_generic_response(client: AsyncClient, db_session: AsyncSession):
    """Unknown email: 200, identical message, no reset_token, no token stored."""
    payload = {"email": "nonexistent@example.com"}

    response = client.post("/api/v1/auth/forgot-password", json=payload)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["message"] == GENERIC_SUCCESS_MSG
    assert "reset_token" not in data

    # No token should be created
    result = await db_session.execute(select(PasswordResetToken))
    tokens = result.scalars().all()
    assert len(tokens) == 0

async def test_forgot_password_oauth_user_returns_generic_response(client: AsyncClient, oauth_user_in_db: User, db_session: AsyncSession):
    """OAuth user: 200, identical message, no reset_token, no token stored, no account leak."""
    payload = {"email": oauth_user_in_db.email}

    response = client.post("/api/v1/auth/forgot-password", json=payload)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["message"] == GENERIC_SUCCESS_MSG
    assert "reset_token" not in data

    # No token should be created for OAuth user
    result = await db_session.execute(select(PasswordResetToken))
    tokens = result.scalars().all()
    assert len(tokens) == 0

async def test_forgot_password_all_responses_identical(client: AsyncClient, password_user_in_db: User, oauth_user_in_db: User):
    """Password user, unknown email, and OAuth user all get the same response structure."""
    unknown_response = client.post("/api/v1/auth/forgot-password", json={"email": "unknown@example.com"})
    known_response = client.post("/api/v1/auth/forgot-password", json={"email": password_user_in_db.email})
    oauth_response = client.post("/api/v1/auth/forgot-password", json={"email": oauth_user_in_db.email})

    for r in (unknown_response, known_response, oauth_response):
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["message"] == GENERIC_SUCCESS_MSG
        # No sensitive fields leaked
        assert "reset_token" not in d
        # Only message (and optional request_id) should be present
        extra = set(d.keys()) - {"message", "request_id"}
        assert extra == set(), f"Unexpected fields: {extra}"

async def test_reset_password_success_with_valid_token(client: AsyncClient, password_user_in_db: User, auth_headers_for, db_session: AsyncSession):
    """End-to-end: forgot-password (token from DB) -> reset-password -> login with new password."""
    # 1. Generate a token via forgot-password
    forgot_payload = {"email": password_user_in_db.email}
    forgot_response = client.post("/api/v1/auth/forgot-password", json=forgot_payload)
    assert forgot_response.status_code == 200

    # 2. Get the token from DB (no longer returned in API response)
    result = await db_session.execute(select(PasswordResetToken))
    tokens = result.scalars().all()
    assert len(tokens) == 1
    token = tokens[0].token

    # 3. Use the token to reset the password
    reset_payload = {"token": token, "new_password": "brand_new_password"}
    reset_response = client.post("/api/v1/auth/reset-password", json=reset_payload)

    assert reset_response.status_code == 200
    assert "Password has been reset successfully" in reset_response.json()["data"]["message"]

    # 4. Verify by logging in with the new password
    await auth_headers_for(password_user_in_db.email, "brand_new_password")

async def test_reset_password_fails_with_bad_token(client: AsyncClient):
    """Ensure the reset endpoint rejects invalid tokens."""
    reset_payload = {"token": "this-token-is-not-real", "new_password": "any_password"}

    response = client.post("/api/v1/auth/reset-password", json=reset_payload)

    assert response.status_code == 400
    assert "Invalid or expired password reset token" in response.json()["detail"]
