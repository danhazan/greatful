"""fix_emoji_codes_constraint

Revision ID: 457cde4eec06
Revises: 5ab93526582b
Create Date: 2025-12-10 23:53:30.710091

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '457cde4eec06'
down_revision = '5ab93526582b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use double quotes for the string to avoid escaping the inner single quotes
    # The original line 20: op.execute(\'ALTER TABLE emoji_reactions DROP CONSTRAINT IF EXISTS valid_emoji_codes;\')
    op.execute("ALTER TABLE emoji_reactions DROP CONSTRAINT IF EXISTS valid_emoji_codes;")

    # Define the set of *currently desired* valid emoji codes
    valid_emoji_codes = ('heart', 'heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap', 'grateful', 'praise')
    valid_emoji_codes_str = ", ".join(f"'{code}'" for code in valid_emoji_codes)

    # Clean up any existing data that violates the *new* constraint
    op.execute(
        f"DELETE FROM emoji_reactions WHERE emoji_code NOT IN ({valid_emoji_codes_str});"
    )
    
    # Add the updated constraint with the correct emoji codes that match frontend
    op.create_check_constraint(
        'valid_emoji_codes',
        'emoji_reactions',
        f"emoji_code IN ({valid_emoji_codes_str})"  # Fixed extra backslash on the original file's f-string
    )


def downgrade() -> None:
    # Drop the new constraint
    op.execute('ALTER TABLE emoji_reactions DROP CONSTRAINT IF EXISTS valid_emoji_codes;')
    
    # Restore the original constraint
    op.create_check_constraint(
        'valid_emoji_codes',
        'emoji_reactions',
        "emoji_code IN ('heart_eyes', 'hug', 'pray', 'muscle', 'star', 'fire', 'heart_face', 'clap')"
    )