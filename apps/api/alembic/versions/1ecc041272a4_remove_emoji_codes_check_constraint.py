"""remove_emoji_codes_check_constraint

Revision ID: 1ecc041272a4
Revises: 457cde4eec06
Create Date: 2025-12-16 17:47:40.152989

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1ecc041272a4'
down_revision = '457cde4eec06'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove the CHECK constraint on emoji_code column
    # Python validation in EmojiReaction.is_valid_emoji() is sufficient
    # This allows adding new emojis without requiring database migrations
    op.execute("ALTER TABLE emoji_reactions DROP CONSTRAINT IF EXISTS valid_emoji_codes;")


def downgrade() -> None:
    # Restore the original constraint (with the 11 emoji codes that were allowed before)
    valid_emoji_codes = ('heart', 'heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap', 'grateful', 'praise')
    valid_emoji_codes_str = ", ".join(f"'{code}'" for code in valid_emoji_codes)

    op.create_check_constraint(
        'valid_emoji_codes',
        'emoji_reactions',
        f"emoji_code IN ({valid_emoji_codes_str})"
    )