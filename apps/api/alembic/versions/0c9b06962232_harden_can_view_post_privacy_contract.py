"""harden_can_view_post_privacy_contract

Revision ID: 0c9b06962232
Revises: 3c3ad964c4be
Create Date: 2026-05-07 18:02:43.565233

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0c9b06962232'
down_revision = '3c3ad964c4be'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return

    op.execute(sa.text("""
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
    """))


def downgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return

    # Restore legacy fallback for downgrade safety
    op.execute(sa.text("""
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
    """))