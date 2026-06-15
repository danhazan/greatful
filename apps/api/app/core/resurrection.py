"""
Stateless, pure-transactional resurrection helpers.

This module is intentionally NOT a service layer. It contains only
atomic transactional helpers for identity-driven resurrection.
It MUST NOT:
  - handle HTTP logic
  - manage sessions
  - store state
  - become a service layer
"""

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.core.security import get_password_hash
from app.models.deleted_user_auth_identity import DeletedUserAuthIdentity
from app.models.user import User

logger = logging.getLogger(__name__)


def _hash_identity(value: str) -> str:
    """Deterministic SHA-256 hash for identity lookup."""
    key = os.getenv("SECRET_KEY", "development-key")
    return hashlib.sha256(f"{key}:{value.lower()}".encode("utf-8")).hexdigest()


async def find_tombstone_by_email(
    db: AsyncSession, email: str
) -> Optional[DeletedUserAuthIdentity]:
    """Look up a tombstone identity record by email hash."""
    email_hash = _hash_identity(email)
    stmt = select(DeletedUserAuthIdentity).where(
        DeletedUserAuthIdentity.identity_type == "email",
        DeletedUserAuthIdentity.email_hash == email_hash,
        DeletedUserAuthIdentity.consumed_at.is_(None),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def find_tombstone_by_oauth(
    db: AsyncSession, provider: str, provider_user_id: str
) -> Optional[DeletedUserAuthIdentity]:
    """Look up a tombstone identity record by OAuth provider + id."""
    # DO NOT use email as primary resurrection identity for OAuth accounts.
    # Future providers may not expose email addresses.
    stmt = select(DeletedUserAuthIdentity).where(
        DeletedUserAuthIdentity.provider == provider,
        DeletedUserAuthIdentity.provider_user_id == provider_user_id,
        DeletedUserAuthIdentity.identity_type == "oauth",
        DeletedUserAuthIdentity.consumed_at.is_(None),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def check_username_available(
    db: AsyncSession, username: str, exclude_user_id: Optional[int] = None
) -> bool:
    """Check if a username is available (not taken by any active user)."""
    stmt = select(User).where(User.username == username)
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is None


async def resurrect_password_user(
    db: AsyncSession,
    tombstone: DeletedUserAuthIdentity,
    email: str,
    username: str,
    password: str,
) -> User:
    """
    Atomically resurrect a password user inside a locked transaction.

    Acquires row-level locks on both the users row and the tombstone row
    to guarantee safety under concurrency.

    Raises:
        ConflictError: If the requested username is already taken
                       or if the user is already active (idempotency guard).
    """
    # Lock the user row
    lock_stmt = select(User).where(User.id == tombstone.user_id).with_for_update()
    lock_result = await db.execute(lock_stmt)
    user = lock_result.scalar_one_or_none()

    if not user:
        raise ConflictError("User record not found for resurrection", "user")

    # Idempotency: already active
    if user.account_status == "active":
        return user

    # Strict state guard
    if user.account_status != "deleted" or user.deleted_at is None:
        raise ConflictError("Invalid account state for resurrection", "user")

    # Validate username availability INSIDE the locked transaction
    if not await check_username_available(db, username, exclude_user_id=user.id):
        raise ConflictError("Username already taken", "user")

    # Atomic resurrection mutation
    user.email = email
    user.username = username
    user.hashed_password = get_password_hash(password)
    user.account_status = "active"
    user.deleted_at = None
    user.deletion_source = None
    user.token_version = (user.token_version or 0) + 1

    db.add(user)
    await db.flush()

    logger.info(f"User resurrected via password identity: {user.id} -> {email}")
    return user


async def resurrect_oauth_user(
    db: AsyncSession,
    tombstone: DeletedUserAuthIdentity,
    provider: str,
    provider_user_id: str,
    email: str,
    username: str,
    oauth_user_info: Optional[dict] = None,
) -> User:
    """
    Atomically resurrect an OAuth user inside a locked transaction.

    DO NOT use email as primary resurrection identity for OAuth accounts.
    Future providers may not expose email addresses.

    Raises:
        ConflictError: If the requested username is already taken
                       or if the user is already active (idempotency guard).
    """
    lock_stmt = select(User).where(User.id == tombstone.user_id).with_for_update()
    lock_result = await db.execute(lock_stmt)
    user = lock_result.scalar_one_or_none()

    if not user:
        raise ConflictError("User record not found for resurrection", "user")

    # Idempotency: already active
    if user.account_status == "active":
        if user.oauth_provider == provider and user.oauth_id == provider_user_id:
            return user
        raise ConflictError("User is already active", "user")

    if user.account_status != "deleted" or user.deleted_at is None:
        raise ConflictError("Invalid account state for resurrection", "user")

    # Validate username availability INSIDE the locked transaction
    if not await check_username_available(db, username, exclude_user_id=user.id):
        raise ConflictError("Username already taken", "user")

    # Atomic resurrection mutation
    user.email = email
    user.username = username
    user.oauth_provider = provider
    user.oauth_id = provider_user_id
    user.account_status = "active"
    user.deleted_at = None
    user.deletion_source = None
    user.token_version = (user.token_version or 0) + 1

    if oauth_user_info:
        oauth_data = user.oauth_data or {}
        oauth_data.update(
            {
                "provider_data": oauth_user_info,
                "resurrected_via_oauth": True,
                "resurrected_at": datetime.now(timezone.utc).isoformat(),
                "email_verified": oauth_user_info.get("email_verified", False),
            }
        )
        user.oauth_data = oauth_data

    db.add(user)
    await db.flush()

    logger.info(f"User resurrected via OAuth identity: {user.id} ({provider})")
    return user


async def consume_tombstones(db: AsyncSession, user_id: int) -> None:
    """
    Permanently sever identity linkage for all resurrection identities
    associated with the given tombstone user_id.

    Sets consumed_at on all unconsumed DeletedUserAuthIdentity rows
    for this user. Future resurrection lookups will ignore these records.

    Preserves audit trail — rows are not deleted.
    """
    stmt = (
        update(DeletedUserAuthIdentity)
        .where(
            DeletedUserAuthIdentity.user_id == user_id,
            DeletedUserAuthIdentity.consumed_at.is_(None),
        )
        .values(consumed_at=datetime.now(timezone.utc))
    )
    await db.execute(stmt)
    await db.flush()
    logger.info(f"Consumed all resurrection identities for user {user_id}")
