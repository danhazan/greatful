"""add_feed_filter_search_indexes

Revision ID: b7f2a6c9d1e3
Revises: a1b2c3d4e5f6
Create Date: 2026-06-22
"""

from alembic import op
from sqlalchemy import text


revision = "b7f2a6c9d1e3"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_posts_content_fts "
            "ON posts USING GIN (to_tsvector('simple', coalesce(content, ''))) "
            "WHERE deleted_at IS NULL"
        ))
        op.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_posts_created_active_desc "
            "ON posts (created_at DESC) WHERE deleted_at IS NULL"
        ))
    else:
        op.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_posts_created_active_desc "
            "ON posts (created_at DESC) WHERE deleted_at IS NULL"
        ))


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute(text("DROP INDEX IF EXISTS idx_posts_content_fts"))
    op.execute(text("DROP INDEX IF EXISTS idx_posts_created_active_desc"))
