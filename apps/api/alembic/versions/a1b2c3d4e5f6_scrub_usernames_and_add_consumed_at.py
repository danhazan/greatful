"""scrub_usernames_for_deleted_users_add_consumed_at

Revision ID: a1b2c3d4e5f6
Revises: 9d31d2a4b6c8
Create Date: 2026-06-13 00:00:00.000000

"""
import hashlib
import os
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


revision = "a1b2c3d4e5f6"
down_revision = "9d31d2a4b6c8"
branch_labels = None
depends_on = None


def _scrubbed_username(user_id: int) -> str:
    """Deterministic scrubbed username matching UserDeletionService.
    Uses underscores to satisfy username_validation_check (^[a-z0-9_]+$, LENGTH 3-30)."""
    key = os.getenv("SECRET_KEY", "development-key")
    short_hash = hashlib.sha256(f"{key}:{user_id}".encode()).hexdigest()[:6]
    return f"deleted_user_{user_id}_{short_hash}"


def upgrade() -> None:
    op.add_column('deleted_user_auth_identities', sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True))

    conn = op.get_bind()

    result = conn.execute(
        text(
            "SELECT id, username FROM users "
            "WHERE account_status = 'deleted' "
            "AND username NOT LIKE 'deleted_user_%'"
        )
    )
    rows = result.fetchall()

    for user_id, old_username in rows:
        new_username = _scrubbed_username(user_id)

        existing = conn.execute(
            text("SELECT id FROM users WHERE username = :un AND id != :uid"),
            {"un": new_username, "uid": user_id},
        ).fetchone()

        if existing:
            new_username = f"{new_username}-{user_id}"

        conn.execute(
            text("UPDATE users SET username = :un WHERE id = :uid AND account_status = 'deleted'"),
            {"un": new_username, "uid": user_id},
        )


def downgrade() -> None:
    op.drop_column('deleted_user_auth_identities', 'consumed_at')
    raise NotImplementedError("Full rollback requires database restore — irreversible migration")
