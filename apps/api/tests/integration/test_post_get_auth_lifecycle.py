"""
J7.6 Issue 1 (T2A evidence / T2B regression): GET /api/v1/posts/{post_id} auth lifecycle.

Contract (per owner-approved J7.6 plan):
- No Authorization header          -> anonymous (public 200, private/custom 404, missing 404)
- Header present but expired/invalid/malformed -> 401 (drives client refresh flow)
- Valid bearer                     -> normal visibility rules; genuinely missing post -> 404

Before the fix, invalid/expired bearers degrade to anonymous via
get_optional_user_id() -> 404 for private/custom posts, which the mobile
client authoritatively classifies as remote-missing.
"""

import uuid
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.user import User


async def _create_post(async_client: AsyncClient, auth_headers: dict, payload: dict) -> str:
    response = await async_client.post("/api/v1/posts", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _expired_headers(user: User) -> dict:
    token = create_access_token(
        {"sub": str(user.id)}, expires_delta=timedelta(seconds=-30)
    )
    return {"Authorization": f"Bearer {token}"}


class TestAnonymousNoHeader:
    """Case B: no Authorization header must stay anonymous."""

    @pytest.mark.asyncio
    async def test_private_post_anonymous_404(
        self, async_client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "private anon", "privacy_level": "private"},
        )
        response = await async_client.get(f"/api/v1/posts/{post_id}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_public_post_anonymous_200(
        self, async_client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "public anon", "privacy_level": "public"},
        )
        response = await async_client.get(f"/api/v1/posts/{post_id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_missing_post_anonymous_404(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        response = await async_client.get(f"/api/v1/posts/{uuid.uuid4()}")
        assert response.status_code == 404


class TestValidBearer:
    """Valid bearer keeps current visibility behavior."""

    @pytest.mark.asyncio
    async def test_own_private_post_200(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "private valid", "privacy_level": "private"},
        )
        response = await async_client.get(
            f"/api/v1/posts/{post_id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["authorId"] == test_user.id

    @pytest.mark.asyncio
    async def test_missing_post_valid_auth_404(
        self, async_client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        """A genuine 404 must remain a 404 under valid auth."""
        response = await async_client.get(
            f"/api/v1/posts/{uuid.uuid4()}", headers=auth_headers
        )
        assert response.status_code == 404


class TestExpiredBearer:
    """Case A: expired bearer must be 401, never silent anonymous fallback."""

    @pytest.mark.asyncio
    async def test_private_post_expired_401(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "private expired", "privacy_level": "private"},
        )
        response = await async_client.get(
            f"/api/v1/posts/{post_id}", headers=_expired_headers(test_user)
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_custom_post_expired_401(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "custom expired", "privacy_level": "custom",
             "rules": ["followers"]},
        )
        response = await async_client.get(
            f"/api/v1/posts/{post_id}", headers=_expired_headers(test_user)
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_public_post_expired_401(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "public expired", "privacy_level": "public"},
        )
        response = await async_client.get(
            f"/api/v1/posts/{post_id}", headers=_expired_headers(test_user)
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_missing_post_expired_401(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Auth is evaluated before existence: invalid creds -> 401, not 404."""
        response = await async_client.get(
            f"/api/v1/posts/{uuid.uuid4()}", headers=_expired_headers(test_user)
        )
        assert response.status_code == 401, response.text


class TestInvalidBearer:
    """Invalid/malformed credentials must be 401, not anonymous fallback."""

    @pytest.mark.asyncio
    async def test_garbage_token_private_post_401(
        self, async_client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "private garbage", "privacy_level": "private"},
        )
        response = await async_client.get(
            f"/api/v1/posts/{post_id}",
            headers={"Authorization": "Bearer not-a-real-jwt"},
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_malformed_header_private_post_401(
        self, async_client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "private malformed", "privacy_level": "private"},
        )
        response = await async_client.get(
            f"/api/v1/posts/{post_id}",
            headers={"Authorization": "Bearer"},
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_unsupported_scheme_private_post_401(
        self, async_client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "private basic-scheme", "privacy_level": "private"},
        )
        response = await async_client.get(
            f"/api/v1/posts/{post_id}",
            headers={"Authorization": "Basic dXNlcjpwYXNzd29yZA=="},
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_empty_header_private_post_401(
        self, async_client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        """Header present but empty is invalid credentials, not anonymous."""
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "private empty-header", "privacy_level": "private"},
        )
        response = await async_client.get(
            f"/api/v1/posts/{post_id}",
            headers={"Authorization": ""},
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_other_users_valid_token_still_404(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user_2: User,
        auth_headers: dict,
    ):
        """A valid token from a non-visibility user keeps 404 (not 401)."""
        post_id = await _create_post(
            async_client, auth_headers,
            {"content": "private other-user", "privacy_level": "private"},
        )
        other_headers = {
            "Authorization": f"Bearer {create_access_token({'sub': str(test_user_2.id)})}"
        }
        response = await async_client.get(
            f"/api/v1/posts/{post_id}", headers=other_headers
        )
        assert response.status_code == 404
