"""add_can_view_post_function

Revision ID: e4c2a9d8f1b0
Revises: c9f8a1b2d3e4
Create Date: 2026-03-07 14:10:00.000000

"""

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "e4c2a9d8f1b0"
down_revision = "c9f8a1b2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return

    op.execute(text("DROP FUNCTION IF EXISTS can_view_post(integer, text);"))

    op.execute(
        text(
            """
            CREATE OR REPLACE FUNCTION can_view_post(p_viewer_id integer, p_post_id uuid)
            RETURNS boolean
            LANGUAGE SQL
            STABLE
            AS $$
                SELECT EXISTS (
                    SELECT 1
                    FROM posts p
                    WHERE p.id = p_post_id::text
                      AND (
                        p.author_id = p_viewer_id
                        OR p.privacy_level = 'public'
                        OR (p.privacy_level IS NULL AND p.is_public = true)
                        OR (
                            p.privacy_level = 'custom'
                            AND (
                                (
                                    EXISTS (
                                        SELECT 1
                                        FROM post_privacy_rules r
                                        WHERE r.post_id = p.id
                                          AND r.rule_type = 'followers'
                                    )
                                    AND EXISTS (
                                        SELECT 1
                                        FROM follows f
                                        WHERE f.follower_id = p_viewer_id
                                          AND f.followed_id = p.author_id
                                          AND f.status = 'active'
                                    )
                                )
                                OR (
                                    EXISTS (
                                        SELECT 1
                                        FROM post_privacy_rules r
                                        WHERE r.post_id = p.id
                                          AND r.rule_type = 'following'
                                    )
                                    AND EXISTS (
                                        SELECT 1
                                        FROM follows f
                                        WHERE f.follower_id = p.author_id
                                          AND f.followed_id = p_viewer_id
                                          AND f.status = 'active'
                                    )
                                )
                                OR EXISTS (
                                    SELECT 1
                                    FROM post_privacy_users pu
                                    WHERE pu.post_id = p.id
                                      AND pu.user_id = p_viewer_id
                                )
                            )
                        )
                      )
                );
            $$;
            """
        )
    )


def downgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return

    op.execute(text("DROP FUNCTION IF EXISTS can_view_post(integer, uuid);"))
