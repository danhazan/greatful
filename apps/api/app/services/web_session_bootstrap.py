"""
SW2-P2: single-use bootstrap tokens that transfer a native app session into
the Social WebView session.

An opaque random token (secrets.token_urlsafe(32)) is returned to the native
app exactly once. Only its salted SHA-256 hash is stored in
web_session_bootstraps; the raw token is never persisted, logged, or reusable.
Consumption is atomic (SELECT ... FOR UPDATE) so concurrent consumers can
never double-spend a token, and every failure returns the same generic error
so the server does not leak whether a token existed, was expired, or was
already consumed.

This module intentionally mirrors the transactional style of
app/core/resurrection.py: pure session-scoped helpers, no HTTP logic.
"""

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError
from app.core.oauth_config import FRONTEND_BASE_URL
from app.models.user import User
from app.models.web_session_bootstrap import WebSessionBootstrap

logger = logging.getLogger(__name__)

BOOTSTRAP_TTL_SECONDS = 300
BOOTSTRAP_PURPOSE = "web_session"
_BOOTSTRAP_GENERIC_ERROR = "Invalid or expired bootstrap token"


class BootstrapTokenInvalid(AuthenticationError):
    """Generic failure for any invalid/expired/consumed bootstrap token.

    The message is intentionally identical for every failure mode so the
    server never reveals whether a token existed, was expired, or was already
    consumed (SW2-P2 contract).
    """

    def __init__(self, message: str = _BOOTSTRAP_GENERIC_ERROR):
        super().__init__(message)


def _secret_key() -> str:
    """Salt for bootstrap-token hashing (same convention as resurrection)."""
    return os.getenv("SECRET_KEY", "development-key")


def hash_bootstrap_token(token: str) -> str:
    """Salted SHA-256 hash of the raw bootstrap token (what the DB stores)."""
    return hashlib.sha256(f"{_secret_key()}:{token}".encode("utf-8")).hexdigest()


def bootstrap_hash_prefix(token: str, length: int = 8) -> str:
    """Diagnostic-only hash prefix for logging — never logs the raw token."""
    return hash_bootstrap_token(token)[:length]


def _as_utc(value: datetime) -> datetime:
    """Normalize a stored timestamp to aware UTC.

    SQLite stores DateTime(timezone=True) as naive values, while Postgres
    returns aware ones. Comparisons against aware 'now' must be tz-safe.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def issue_bootstrap_token(
    db: AsyncSession,
    user: User,
    audience: Optional[str] = None,
) -> Tuple[str, WebSessionBootstrap]:
    """Create a single-use bootstrap record for an authenticated native user.

    The raw token is returned exactly once to the caller; the record stores
    only its salted hash. Expired unconsumed records for this user are deleted
    opportunistically (lazy cleanup — no cron, no background job).

    Args:
        db: Database session.
        user: Authenticated native user (server-derived, never client-supplied).
        audience: Configured web origin the token is bound to. Defaults to the
            current FRONTEND_BASE_URL.

    Returns:
        (raw_token, record) — raw_token is the only place the secret exists.
    """
    now = datetime.now(timezone.utc)

    # Lazy cleanup: drop this user's expired, unconsumed records while we are
    # already writing one. Consistent with the existing transactional style —
    # no scheduled maintenance is needed.
    await db.execute(
        delete(WebSessionBootstrap).where(
            WebSessionBootstrap.user_id == user.id,
            WebSessionBootstrap.consumed_at.is_(None),
            WebSessionBootstrap.expires_at <= now,
        )
    )

    token = secrets.token_urlsafe(32)
    record = WebSessionBootstrap(
        user_id=user.id,
        token_hash=hash_bootstrap_token(token),
        purpose=BOOTSTRAP_PURPOSE,
        audience=audience or FRONTEND_BASE_URL,
        expires_at=now + timedelta(seconds=BOOTSTRAP_TTL_SECONDS),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    logger.info(
        "Web session bootstrap issued",
        extra={
            "user_id": user.id,
            "purpose": record.purpose,
            "audience": record.audience,
            "expires_in": BOOTSTRAP_TTL_SECONDS,
            "token_hash_prefix": record.token_hash[:8],
        },
    )
    return token, record


async def consume_bootstrap_token(
    db: AsyncSession,
    token: str,
    audience: Optional[str] = None,
) -> User:
    """Atomically consume a bootstrap token and return its bound user.

    Consumption is race-safe: the row is selected FOR UPDATE inside the
    transaction, validated, marked consumed, and only then committed. A
    concurrent consumer blocks on the row lock, then observes consumed_at and
    fails with the same generic error.

    Tokens are minted by the caller AFTER this commit (mint-after-commit), so
    a token can never be issued for a record that failed consumption.

    Raises:
        BootstrapTokenInvalid: generic 401-equivalent for unknown, expired,
            consumed, wrong-purpose, or wrong-audience tokens, and for users
            that are no longer active.
    """
    token_hash = hash_bootstrap_token(token)
    now = datetime.now(timezone.utc)
    expected_audience = audience or FRONTEND_BASE_URL

    stmt = (
        select(WebSessionBootstrap)
        .where(WebSessionBootstrap.token_hash == token_hash)
        .with_for_update()
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()

    invalid = (
        record is None
        or record.consumed_at is not None
        or _as_utc(record.expires_at) <= now
        or record.purpose != BOOTSTRAP_PURPOSE
        or record.audience != expected_audience
    )
    if invalid:
        raise BootstrapTokenInvalid()

    user_stmt = (
        select(User).where(User.id == record.user_id).with_for_update()
    )
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    account_active = user is not None and (
        not isinstance(getattr(user, "account_status", None), str)
        or user.account_status == "active"
    )
    if not account_active:
        # Burn the record anyway so a token for a dead user cannot be replayed
        # once that user row is restored.
        record.consumed_at = now
        await db.commit()
        raise BootstrapTokenInvalid()

    record.consumed_at = now
    await db.commit()
    await db.refresh(user)

    logger.info(
        "Web session bootstrap consumed",
        extra={
            "user_id": user.id,
            "purpose": record.purpose,
            "token_hash_prefix": record.token_hash[:8],
        },
    )
    return user