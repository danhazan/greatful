"""add_post_privacy_tables_and_indexes

Revision ID: c9f8a1b2d3e4
Revises: a7b3c9d2e4f1
Create Date: 2026-03-05 13:45:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = "c9f8a1b2d3e4"
down_revision = "a7b3c9d2e4f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)

    # Add column idempotently for drifted environments.
    op.execute(
        text(
            """
            ALTER TABLE posts
            ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20) DEFAULT 'public' NOT NULL
            """
        )
    )

    # Backfill from legacy boolean visibility.
    op.execute(
        text(
            """
            UPDATE posts
            SET privacy_level = CASE
                WHEN is_public = true THEN 'public'
                ELSE 'private'
            END
            WHERE privacy_level IS NULL OR privacy_level = ''
            """
        )
    )

    table_names = set(inspector.get_table_names())
    if "post_privacy_rules" not in table_names:
        op.create_table(
            "post_privacy_rules",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("post_id", sa.String(), nullable=False),
            sa.Column("rule_type", sa.String(length=50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("post_id", "rule_type", name="unique_post_privacy_rule"),
        )

    if "post_privacy_users" not in table_names:
        op.create_table(
            "post_privacy_users",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("post_id", sa.String(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("post_id", "user_id", name="unique_post_privacy_user"),
        )

    # Feed and visibility indexes (idempotent).
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_posts_privacy_created_at ON posts (privacy_level, created_at)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_posts_author_created_at ON posts (author_id, created_at)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_follows_follower_followed_status ON follows (follower_id, followed_id, status)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_follows_followed_follower_status ON follows (followed_id, follower_id, status)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_post_privacy_rules_post_rule ON post_privacy_rules (post_id, rule_type)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_post_privacy_users_post_user ON post_privacy_users (post_id, user_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_post_privacy_users_user_post ON post_privacy_users (user_id, post_id)"))


def downgrade() -> None:
    op.drop_index("idx_post_privacy_users_user_post", table_name="post_privacy_users")
    op.drop_index("idx_post_privacy_users_post_user", table_name="post_privacy_users")
    op.drop_index("idx_post_privacy_rules_post_rule", table_name="post_privacy_rules")
    op.drop_index("idx_follows_followed_follower_status", table_name="follows")
    op.drop_index("idx_follows_follower_followed_status", table_name="follows")
    op.drop_index("idx_posts_author_created_at", table_name="posts")
    op.drop_index("idx_posts_privacy_created_at", table_name="posts")

    op.drop_table("post_privacy_users")
    op.drop_table("post_privacy_rules")
    op.drop_column("posts", "privacy_level")
