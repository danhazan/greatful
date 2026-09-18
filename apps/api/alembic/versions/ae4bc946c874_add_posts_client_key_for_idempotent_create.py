"""add_posts_client_key_for_idempotent_create

Revision ID: ae4bc946c874
Revises: b3500c2dcc55
Create Date: 2026-09-18 00:00:00.000000

J7 Slice 6a: nullable opaque client publication key on posts with an
ownership-scoped partial unique index — at most one non-deleted post per
author may hold a given key. Existing rows stay NULL; tombstoned rows never
reserve a key, so deleted-key reuse stays possible.
"""

from alembic import op
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = "ae4bc946c874"
down_revision = "b3500c2dcc55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_key VARCHAR(128)"))
    op.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_author_client_key "
            "ON posts (author_id, client_key) "
            "WHERE deleted_at IS NULL AND client_key IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS uq_posts_author_client_key"))
    op.execute(text("ALTER TABLE posts DROP COLUMN IF EXISTS client_key"))
