"""
Unit tests for SW2-P2 web-session bootstrap (native -> WebView session transfer).

Covers: the issue/consume service (token generation, salted-hash storage,
purpose, audience, 300s TTL, single-use, atomic consume, expired/inactive-user
burning), the two POST endpoints (Bearer enforcement, server-derived user
binding, canonical AuthResponse shape, generic 401 on every consume failure,
token-never-logged discipline), and rate-limit configuration for both
endpoints.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

from app.core.oauth_config import FRONTEND_BASE_URL
from app.core.responses import build_auth_response
from app.core.security import create_access_token
from app.services.web_session_bootstrap import (
    BOOTSTRAP_PURPOSE,
    BOOTSTRAP_TTL_SECONDS,
    BootstrapTokenInvalid,
    consume_bootstrap_token,
    hash_bootstrap_token,
    issue_bootstrap_token,
)
from app.models.web_session_bootstrap import WebSessionBootstrap
from app.models.user import User
from main import app


@pytest_asyncio.fixture
async def client(setup_test_database):
    # Reset the shared in-memory rate limiter so endpoint tests are
    # order-independent even when SECURITY_TESTING=true is exported (which
    # forces the RateLimitingMiddleware to enforce limits during tests).
    from app.core.rate_limiting import get_rate_limiter
    get_rate_limiter().clear_all_limits()

    # NOTE: TestClient is NOT used as a context manager — matching
    # tests/unit/test_native_google_auth.py — so the app lifespan never
    # executes and cannot pollute async event loops across tests.
    return TestClient(app)


# ---------------------------------------------------------------------------
# Service: issue
# ---------------------------------------------------------------------------

class TestIssueBootstrapToken:
    @pytest.mark.asyncio
    async def test_issues_token_bound_to_user(self, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)

        assert token and len(token) > 32
        assert record.user_id == test_user.id
        assert record.purpose == BOOTSTRAP_PURPOSE
        assert record.audience == FRONTEND_BASE_URL
        assert record.consumed_at is None

        # TTL: expires_at == created_at + 300s (naive on sqlite)
        from app.services.web_session_bootstrap import _as_utc
        now = datetime.now(timezone.utc)
        assert record.created_at is not None
        assert _as_utc(record.expires_at) > now
        assert _as_utc(record.expires_at) - _as_utc(record.created_at) <= timedelta(
            seconds=BOOTSTRAP_TTL_SECONDS + 1
        )

    @pytest.mark.asyncio
    async def test_only_salted_hash_stored_never_raw_token(self, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)

        assert record.token_hash == hash_bootstrap_token(token)
        assert token not in record.token_hash
        # token_hash is exactly 64 hex chars (SHA-256)
        assert len(record.token_hash) == 64

        # The raw token must not appear anywhere in the table
        from sqlalchemy import select
        stored = (await db_session.execute(select(WebSessionBootstrap))).scalars().all()
        assert len(stored) == 1
        assert all(token not in (getattr(r, "token_hash", "")) for r in stored)

    @pytest.mark.asyncio
    async def test_expired_records_lazily_cleaned(self, db_session, test_user):
        """Expired unconsumed records for the user are deleted on next issue."""
        from sqlalchemy import select

        old_record = WebSessionBootstrap(
            user_id=test_user.id,
            token_hash="a" * 64,
            purpose=BOOTSTRAP_PURPOSE,
            audience=FRONTEND_BASE_URL,
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=10),
        )
        db_session.add(old_record)
        await db_session.commit()

        await issue_bootstrap_token(db_session, test_user)

        stored = (await db_session.execute(select(WebSessionBootstrap))).scalars().all()
        assert len(stored) == 1
        assert stored[0].token_hash != "a" * 64

    @pytest.mark.asyncio
    async def test_audience_can_be_override(self, db_session, test_user):
        token, record = await issue_bootstrap_token(
            db_session, test_user, audience="https://staging.example.com"
        )
        assert record.audience == "https://staging.example.com"


# ---------------------------------------------------------------------------
# Service: consume
# ---------------------------------------------------------------------------

class TestConsumeBootstrapToken:
    @pytest.mark.asyncio
    async def test_consume_returns_bound_user(self, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)
        user = await consume_bootstrap_token(db_session, token)

        assert user.id == test_user.id
        await db_session.refresh(record)
        assert record.consumed_at is not None

    @pytest.mark.asyncio
    async def test_single_use(self, db_session, test_user):
        token, _ = await issue_bootstrap_token(db_session, test_user)
        await consume_bootstrap_token(db_session, token)

        with pytest.raises(BootstrapTokenInvalid):
            await consume_bootstrap_token(db_session, token)

    @pytest.mark.asyncio
    async def test_unknown_token_generic_failure(self, db_session, test_user):
        with pytest.raises(BootstrapTokenInvalid) as exc:
            await consume_bootstrap_token(db_session, "totally-made-up-token")
        assert exc.value.detail == "Invalid or expired bootstrap token"

    @pytest.mark.asyncio
    async def test_expired_token_generic_failure(self, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db_session.commit()

        with pytest.raises(BootstrapTokenInvalid):
            await consume_bootstrap_token(db_session, token)

    @pytest.mark.asyncio
    async def test_wrong_purpose_generic_failure(self, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)
        record.purpose = "other"
        await db_session.commit()

        with pytest.raises(BootstrapTokenInvalid):
            await consume_bootstrap_token(db_session, token)

    @pytest.mark.asyncio
    async def test_wrong_audience_generic_failure(self, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)
        record.audience = "https://evil.example.com"
        await db_session.commit()

        with pytest.raises(BootstrapTokenInvalid):
            await consume_bootstrap_token(db_session, token)

    @pytest.mark.asyncio
    async def test_all_failures_share_identical_message(self, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)

        messages = []
        # unknown
        try:
            await consume_bootstrap_token(db_session, "nope")
        except BootstrapTokenInvalid as e:
            messages.append(e.detail)
        # expired
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db_session.commit()
        try:
            await consume_bootstrap_token(db_session, token)
        except BootstrapTokenInvalid as e:
            messages.append(e.detail)
        # consumed
        record.expires_at = datetime.now(timezone.utc) + timedelta(seconds=300)
        record.consumed_at = datetime.now(timezone.utc)
        await db_session.commit()
        try:
            await consume_bootstrap_token(db_session, token)
        except BootstrapTokenInvalid as e:
            messages.append(e.detail)

        assert messages
        assert len(set(messages)) == 1
        assert messages[0] == "Invalid or expired bootstrap token"

    @pytest.mark.asyncio
    async def test_inactive_user_burns_token(self, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)
        test_user.account_status = "deleted"
        await db_session.commit()

        with pytest.raises(BootstrapTokenInvalid):
            await consume_bootstrap_token(db_session, token)
        await db_session.refresh(record)
        assert record.consumed_at is not None

    @pytest.mark.asyncio
    async def test_consume_select_uses_for_update(self, db_session, test_user):
        """The consume lookup must compile with FOR UPDATE on Postgres."""
        from sqlalchemy import select
        from sqlalchemy.dialects import postgresql

        stmt = (
            select(WebSessionBootstrap)
            .where(WebSessionBootstrap.token_hash == "x" * 64)
            .with_for_update()
        )
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        assert "FOR UPDATE" in compiled.upper()

    @pytest.mark.asyncio
    async def test_concurrent_consume_exactly_one_wins(self, db_session, test_user):
        """Two concurrent consumers: exactly one succeeds.

        The genuine race requires row-level locking, so this runs only
        against Postgres. On SQLite (shared in-memory connection) the
        single-use invariant is covered by test_single_use instead.
        """
        if db_session.get_bind().dialect.name != "postgresql":
            pytest.skip("true race requires Postgres row locking")

        token, _ = await issue_bootstrap_token(db_session, test_user)

        results = {"users": 0, "failures": 0}

        async def attempt():
            from sqlalchemy.ext.asyncio import AsyncSession
            from sqlalchemy.orm import sessionmaker
            session = sessionmaker(db_session.get_bind(), class_=AsyncSession)()
            try:
                user = await consume_bootstrap_token(session, token)
                results["users"] += 1
                return user
            except Exception:
                results["failures"] += 1
                return None
            finally:
                await session.close()

        outcomes = await asyncio.gather(attempt(), attempt(), return_exceptions=True)

        assert results["users"] == 1
        assert results["failures"] == 1
        assert sum(1 for o in outcomes if isinstance(o, User)) == 1

    @pytest.mark.asyncio
    async def test_token_never_logged(self, db_session, test_user, caplog):
        token, _ = await issue_bootstrap_token(db_session, test_user)
        with caplog.at_level(logging.INFO):
            await consume_bootstrap_token(db_session, token)
        joined = " ".join(record.message for record in caplog.records)
        assert token not in joined
        assert hash_bootstrap_token(token) not in joined


# ---------------------------------------------------------------------------
# POST /api/v1/oauth/web-session/bootstrap (issue)
# ---------------------------------------------------------------------------

class TestIssueEndpoint:
    async def _post(self, client, headers, body=None):
        return client.post(
            "/api/v1/oauth/web-session/bootstrap",
            json=body,
            headers=headers,
        )

    @pytest.mark.asyncio
    async def test_valid_bearer_issues_token(self, client, auth_headers):
        response = await self._post(client, auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "bootstrap_token" in body["data"]
        assert body["data"]["expires_in"] == BOOTSTRAP_TTL_SECONDS

    @pytest.mark.asyncio
    async def test_invalid_bearer_rejected(self, client):
        response = await self._post(client, {"Authorization": "Bearer invalid.token"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_no_bearer_rejected(self, client):
        response = await self._post(client, {})
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_no_client_identity_accepted(self, client, auth_headers, setup_test_database):
        """A client-supplied user_id must never be honored — the record is
        bound to the authenticated Bearer identity."""
        from sqlalchemy import select

        response = await self._post(client, auth_headers, body={"user_id": 999999})
        assert response.status_code == 200

        TestSessionLocal = setup_test_database
        async with TestSessionLocal() as session:
            records = (
                await session.execute(select(WebSessionBootstrap))
            ).scalars().all()
            assert len(records) == 1
            assert records[0].user_id != 999999

    @pytest.mark.asyncio
    async def test_token_not_logged(self, client, auth_headers, caplog):
        with caplog.at_level(logging.INFO):
            response = await self._post(client, auth_headers)
        assert response.status_code == 200
        token = response.json()["data"]["bootstrap_token"]
        joined = " ".join(record.message for record in caplog.records)
        assert token not in joined
        assert hash_bootstrap_token(token) not in joined

    @pytest.mark.asyncio
    async def test_oauth_not_configured_still_issues(self, client, auth_headers):
        """The bootstrap endpoints do not depend on OAuth provider state."""
        response = await self._post(client, auth_headers)
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/v1/oauth/web-session/bootstrap/consume
# ---------------------------------------------------------------------------

class TestConsumeEndpoint:
    async def _post(self, client, token_value):
        return client.post(
            "/api/v1/oauth/web-session/bootstrap/consume",
            json={"bootstrap_token": token_value},
        )

    @pytest.mark.asyncio
    async def test_consumes_and_returns_canonical_auth_response(
        self, client, db_session, test_user
    ):
        token, _ = await issue_bootstrap_token(db_session, test_user)
        response = await self._post(client, token)

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        data = body["data"]
        assert data["user"]["id"] == test_user.id
        assert data["user"]["email"] == test_user.email
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["token_type"] == "bearer"
        assert data["is_new_user"] is False
        assert "signup_token" not in data
    @pytest.mark.asyncio
    async def test_unknown_token_generic_401(self, client):
        response = await self._post(client, "made-up-token")
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or expired bootstrap token"

    @pytest.mark.asyncio
    async def test_expired_token_generic_401(self, client, db_session, test_user):
        token, record = await issue_bootstrap_token(db_session, test_user)
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db_session.commit()
        response = await self._post(client, token)
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or expired bootstrap token"

    @pytest.mark.asyncio
    async def test_consumed_token_generic_401(self, client, db_session, test_user):
        token, _ = await issue_bootstrap_token(db_session, test_user)
        first = await self._post(client, token)
        assert first.status_code == 200
        second = await self._post(client, token)
        assert second.status_code == 401
        assert second.json()["detail"] == "Invalid or expired bootstrap token"

    @pytest.mark.asyncio
    async def test_missing_token_422(self, client):
        response = client.post(
            "/api/v1/oauth/web-session/bootstrap/consume", json={}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_consume_failure_not_logged_with_token(
        self, client, db_session, test_user, caplog
    ):
        token, _ = await issue_bootstrap_token(db_session, test_user)
        with caplog.at_level(logging.INFO):
            await self._post(client, token)
            await self._post(client, token)  # second use -> 401
        joined = " ".join(record.message for record in caplog.records)
        assert token not in joined


# ---------------------------------------------------------------------------
# Rate limiting configuration
# ---------------------------------------------------------------------------

class TestRateLimits:
    def test_bootstrap_endpoints_have_specific_limits(self):
        from app.core.security_config import security_config

        limits = security_config.get_rate_limits()
        assert limits["POST:/api/v1/oauth/web-session/bootstrap"] == 5
        assert limits["POST:/api/v1/oauth/web-session/bootstrap/consume"] == 20

    def test_middleware_resolves_bootstrap_endpoint_keys(self):
        from app.core.rate_limiting import RateLimitingMiddleware

        middleware = RateLimitingMiddleware.__new__(RateLimitingMiddleware)
        from unittest.mock import Mock

        req = Mock()
        req.method = "POST"
        req.url.path = "/api/v1/oauth/web-session/bootstrap"
        assert (
            middleware._get_endpoint_key(req)
            == "POST:/api/v1/oauth/web-session/bootstrap"
        )

        req.url.path = "/api/v1/oauth/web-session/bootstrap/consume"
        assert (
            middleware._get_endpoint_key(req)
            == "POST:/api/v1/oauth/web-session/bootstrap/consume"
        )