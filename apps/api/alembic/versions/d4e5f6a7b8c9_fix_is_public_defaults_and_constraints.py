"""Fix is_public defaults, correct data drift, and add consistency constraint.

Addresses two issues:
1. Database DEFAULT for is_public was 'true', creating drift risk when
   posts are created without explicit privacy settings.
2. Existing data shows 2 rows with privacy_level='private' AND is_public=true,
   proving drift has already occurred.

This migration:
- Changes the is_public column DEFAULT to false (private by default).
- Corrects all existing rows to align is_public with privacy_level.
- Adds a CHECK constraint to prevent future desync at the database level.

Rollback Implications:
- If rolled back, the `posts_visibility_consistency_chk` constraint is dropped,
  allowing silent privacy leaks to occur if the codebase writes mismatched values.
- If a future migration attempts to remove `is_public` entirely (which is the
  long-term goal since `privacy_level` is canonical), it MUST drop this
  constraint first.

Revision ID: d4e5f6a7b8c9
Revises: 0c9b06962232
Create Date: 2026-05-08 13:18:00.000000+00:00
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = '0c9b06962232'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Correct existing data drift BEFORE adding the constraint.
    # This fixes the 2 known rows where privacy_level='private' but is_public=true,
    # and ensures all rows are consistent going forward.
    op.execute(
        "UPDATE posts SET is_public = false WHERE privacy_level IN ('private', 'custom') AND is_public = true"
    )
    op.execute(
        "UPDATE posts SET is_public = true WHERE privacy_level = 'public' AND is_public = false"
    )

    # 2. Change the column DEFAULT to false (private by default).
    op.alter_column(
        'posts',
        'is_public',
        server_default='false',
    )

    # 3. Add a CHECK constraint to prevent future desync.
    # Any write that violates this will produce a hard DB error
    # instead of a silent privacy leak.
    op.execute("""
        ALTER TABLE posts
        ADD CONSTRAINT posts_visibility_consistency_chk CHECK (
            (privacy_level = 'public' AND is_public = true)
            OR
            (privacy_level IN ('private', 'custom') AND is_public = false)
        )
    """)


def downgrade() -> None:
    # Remove the constraint first
    op.execute("ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_visibility_consistency_chk")

    # Restore the original default
    op.alter_column(
        'posts',
        'is_public',
        server_default='true',
    )
